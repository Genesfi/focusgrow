package com.genesfi.focusgrow

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.*

class SyncService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private val FIREBASE_URL = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/.json"

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, "sync_channel")
            .setContentTitle("FocusGrow Sync")
            .setContentText("Syncing with cloud and PC...")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        startForeground(1, notification)
        startPolling()
    }

    private fun startPolling() {
        // Dedicated 1s Timer Loop (V29 FIX)
        serviceScope.launch {
            while (isActive) {
                withContext(Dispatchers.Main) {
                    SyncManager.tickActivePasses(FocusBlockerService.currentPackage)
                }
                delay(1000)
            }
        }

        serviceScope.launch {
            while (isActive) {
                var localData: String? = null
                var cloudData: String? = null
                
                try {
                    val url = URL("http://${SyncManager.pcIpAddress}:8766/state")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.connectTimeout = 2000
                    conn.readTimeout = 2000
                    if (conn.responseCode == 200) {
                        localData = Scanner(conn.inputStream).useDelimiter("\\A").next()
                    }
                    conn.disconnect()
                } catch (e: Exception) {}

                try {
                    val request = Request.Builder().url(FIREBASE_URL).build()
                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            cloudData = response.body?.string()
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("SyncService", "Cloud error: ${e.message}")
                }

                mergeAndUpdate(localData, cloudData)
                pushLocalStateToCloud()

                // V32: STABLE SYNC - 2s when active, 5s when idle
                val hasActivePass = SyncManager.currentStatus.activePasses.any { it.remainingSec > 0 }
                val delayTime = if (hasActivePass || SyncManager.currentStatus.state == "focusing") 2000L else 5000L
                delay(delayTime)
            }
        }
    }

    private suspend fun mergeAndUpdate(localJson: String?, cloudJson: String?) {
        try {
            val local = if (localJson != null) JSONObject(localJson) else null
            val cloud = if (cloudJson != null) JSONObject(cloudJson) else null
            
            if (cloud != null) {
                // SMART MERGER V2: Extract all relevant keys to root
                if (cloud.has("status") && cloud.optJSONObject("status") != null) {
                    val statusObj = cloud.getJSONObject("status")
                    val keys = statusObj.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        if (!cloud.has(k)) cloud.put(k, statusObj.get(k))
                    }
                }
            }
            
            var cloudDoom: JSONObject? = null
            if (cloud != null) {
                cloudDoom = cloud.optJSONObject("doomTracker")
                if (cloudDoom == null) {
                    val keys = cloud.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        val nested = cloud.optJSONObject(k)
                        if (nested != null && nested.has("doomTracker")) {
                            cloudDoom = nested.optJSONObject("doomTracker")
                            break
                        }
                    }
                }
            }
            
            val localDoom = local?.optJSONObject("doomTracker")
            SyncManager.doomData = mergeDoomData(localDoom, cloudDoom)
            SyncManager.doomSettings = cloud?.optJSONObject("settings") ?: local?.optJSONObject("settings")
            
            val base = local ?: cloud ?: return
            val activePasses = mutableMapOf<String, ActivePass>()

            fun parsePasses(json: JSONObject?) {
                if (json == null) return
                // Try Array
                val array = json.optJSONArray("activePasses")
                if (array != null) {
                    for (i in 0 until array.length()) {
                        val p = array.getJSONObject(i)
                        val domain = p.getString("domain")
                        val sec = p.getInt("remainingSec")
                        val left = p.optInt("passesLeft", 0)
                        val grantTime = p.optLong("lastGrantTime", 0L)
                        if (sec > 0) activePasses[domain] = ActivePass(domain, sec, left, lastGrantTime = grantTime)
                    }
                } else {
                    // Try Object (Firebase typical)
                    val obj = json.optJSONObject("activePasses")
                    if (obj != null) {
                        val keys = obj.keys()
                        while (keys.hasNext()) {
                            val key = keys.next()
                            val p = obj.optJSONObject(key)
                            if (p != null) {
                                val domain = p.optString("domain", key.replace("_", "."))
                                val sec = p.optInt("remainingSec", 0)
                                val left = p.optInt("passesLeft", 0)
                                val grantTime = p.optLong("lastGrantTime", 0L)
                                if (sec > 0) activePasses[domain] = ActivePass(domain, sec, left, lastGrantTime = grantTime)
                            }
                        }
                    }
                }
            }

            parsePasses(local)
            parsePasses(cloud)

            // V29: ROBUST MERGE - Preserve Ownership and apply "Minimum Wins" logic
            val finalPasses = mutableMapOf<String, ActivePass>()
            val existingPasses = SyncManager.currentStatus.activePasses.associateBy { it.domain }

            activePasses.forEach { (domain, newPass) ->
                val existing = existingPasses[domain]
                
                // V30: TIMESTAMP PROTECTION
                // If cloud has a pass that was granted LATER, we must accept it.
                // If cloud has NO pass but our local one was granted < 10s ago, we PROTECT it.
                
                val isOwner = existing?.isLocalOwner ?: newPass.isLocalOwner
                val localGrantTime = existing?.lastGrantTime ?: 0L
                val cloudGrantTime = newPass.lastGrantTime
                
                var bestSec = newPass.remainingSec
                var finalGrantTime = cloudGrantTime
                
                if (existing != null) {
                    if (cloudGrantTime > localGrantTime) {
                        // Cloud is newer session, take it all
                        bestSec = newPass.remainingSec
                        finalGrantTime = cloudGrantTime
                    } else if (localGrantTime > cloudGrantTime) {
                        // Local is newer session, take local
                        bestSec = existing.remainingSec
                        finalGrantTime = localGrantTime
                    } else {
                        // V35: ROBUST OWNER PROTECTION
                        // If we own the pass, only take cloud value if it's strictly LESS
                        // This prevents stale cloud pulls from resetting our local tick
                        bestSec = if (isOwner) {
                            Math.min(existing.remainingSec, newPass.remainingSec)
                        } else {
                            newPass.remainingSec
                        }
                        finalGrantTime = localGrantTime
                    }
                }
                
                finalPasses[domain] = ActivePass(domain, bestSec, newPass.passesLeft, isOwner, finalGrantTime)
            }

            withContext(Dispatchers.Main) {
                SyncManager.currentStatus = FocusStatus(
                    state = base.optString("state", "idle"),
                    formattedTime = base.optString("formattedTime", "00:00"),
                    remainingSec = base.optInt("remainingSec", 0),
                    maxPeriodSec = base.optInt("maxPeriodSec", 1),
                    currentPeriod = base.optInt("currentPeriod", 1),
                    totalPeriods = base.optInt("totalPeriods", 1),
                    isOnline = local != null,
                    activePasses = finalPasses.values.toList()
                )

                // V33: BIDIRECTIONAL AUTH - If any pass is active in cloud, update doomData locally
                val data = SyncManager.doomData ?: JSONObject()
                var doomChanged = false
                finalPasses.forEach { (domain, pass) ->
                    val key = domain.replace(".", "_")
                    val info = data.optJSONObject(key) ?: JSONObject()
                    if (!info.optBoolean("isPassActive", false)) {
                        info.put("isPassActive", true)
                        info.put("totalSecThisSession", 0)
                        info.put("cooldownStart", 0L)
                        data.put(key, info)
                        doomChanged = true
                    }
                }
                if (doomChanged) SyncManager.doomData = data
            }
        } catch (e: Exception) {
            android.util.Log.e("SyncService", "Merge fail: ${e.message}")
        }
    }

    private fun mergeDoomData(local: JSONObject?, cloud: JSONObject?): JSONObject? {
        if (local == null) return cloud
        if (cloud == null) return local
        val result = JSONObject(cloud.toString())
        val localKeys = local.keys()
        while (localKeys.hasNext()) {
            val key = localKeys.next()
            if (!result.has(key)) {
                result.put(key, local.get(key))
            } else {
                val localItem = local.getJSONObject(key)
                val cloudItem = result.getJSONObject(key)
                
                // V32: ROBUST DOOM MERGE
                // 1. If either has a pass active, result has a pass active
                val isPassActive = localItem.optBoolean("isPassActive", false) || cloudItem.optBoolean("isPassActive", false)
                
                // 2. Take the one with more session progress OR the one with the active pass
                val useLocal = if (localItem.optBoolean("isPassActive", false) && !cloudItem.optBoolean("isPassActive", false)) {
                    true
                } else if (!localItem.optBoolean("isPassActive", false) && cloudItem.optBoolean("isPassActive", false)) {
                    false
                } else {
                    localItem.optInt("totalSecThisSession", 0) > cloudItem.optInt("totalSecThisSession", 0) ||
                    localItem.optLong("cooldownStart", 0) > cloudItem.optLong("cooldownStart", 0)
                }

                if (useLocal) {
                    val merged = JSONObject(localItem.toString())
                    merged.put("isPassActive", isPassActive)
                    result.put(key, merged)
                } else {
                    cloudItem.put("isPassActive", isPassActive)
                }
            }
        }
        return result
    }

    private suspend fun pushLocalStateToCloud() {
        try {
            val patchObj = JSONObject()
            val doom = SyncManager.doomData
            if (doom != null) {
                patchObj.put("doomTracker", doom)
            }
            
            // V34 STRICT: ONLY sync active passes if we are the OWNER
            // This prevents a device from overwriting the cloud with stale pull data
            val passesObj = JSONObject()
            var hasOwnedPass = false
            SyncManager.currentStatus.activePasses.forEach { 
                if (it.isLocalOwner) {
                    hasOwnedPass = true
                    passesObj.put(it.domain.replace(".", "_"), JSONObject().apply {
                        put("domain", it.domain)
                        put("remainingSec", it.remainingSec)
                        put("passesLeft", it.passesLeft)
                        put("lastGrantTime", it.lastGrantTime)
                    })
                }
            }
            if (hasOwnedPass) patchObj.put("activePasses", passesObj)
            
            patchObj.put("lastUpdate", System.currentTimeMillis())

            val body = patchObj.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(FIREBASE_URL).patch(body).build()
            client.newCall(request).execute().use { resp ->
                // Log if needed
            }
        } catch (e: Exception) {}
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel("sync_channel", "FocusGrow Sync", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    companion object {
        fun grantPass(domain: String, minutes: Int) {
            SyncManager.updatePassOptimistically(domain, minutes)
            CoroutineScope(Dispatchers.IO).launch {
                val json = JSONObject().apply {
                    put("action", "grantPass"); put("domain", domain); put("minutes", minutes); put("grantPass", true)
                }
                try {
                    val url = URL("http://${SyncManager.pcIpAddress}:8766/grant")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"; conn.doOutput = true
                    conn.outputStream.write(json.toString().toByteArray())
                    conn.responseCode; conn.disconnect()
                } catch (e: Exception) {}

                try {
                    // V25 FIX: INSTANT PUSH TO ROOT FIREBASE
                    val FIREBASE_UPDATE_URL = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/.json"
                    val client = OkHttpClient()
                    val patchObj = JSONObject()
                    
                    // 1. Update Active Passes
                    val passesObj = JSONObject()
                    val domainKey = domain.replace(".", "_")
                    val passData = JSONObject().apply {
                        put("domain", domain)
                        put("remainingSec", minutes * 60)
                        put("passesLeft", 1) 
                        put("lastGrantTime", System.currentTimeMillis())
                    }
                    passesObj.put(domainKey, passData)
                    patchObj.put("activePasses", passesObj)
                    
                    // 2. Update Doom Tracker (Set isPassActive immediately)
                    val doomObj = JSONObject()
                    val trackerInfo = JSONObject().apply {
                        put("isPassActive", true)
                        put("totalSecThisSession", 0)
                        put("cooldownStart", 0L)
                    }
                    doomObj.put(domainKey, trackerInfo)
                    patchObj.put("doomTracker", doomObj)
                    
                    patchObj.put("lastUpdate", System.currentTimeMillis())

                    val body = patchObj.toString().toRequestBody("application/json".toMediaType())
                    val request = Request.Builder()
                        .url(FIREBASE_UPDATE_URL)
                        .method("PATCH", body)
                        .addHeader("Content-Type", "application/json")
                        .build()
                        
                    client.newCall(request).execute().use { resp ->
                        android.util.Log.d("FocusGrowSync", "Android Instant Push OK: ${resp.code}")
                    }
                } catch (e: Exception) {
                    android.util.Log.e("FocusGrowSync", "Android Instant Push Failed: ${e.message}")
                }
            }
        }
    }
}
