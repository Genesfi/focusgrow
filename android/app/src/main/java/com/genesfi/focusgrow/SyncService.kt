package com.genesfi.focusgrow

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
import java.text.SimpleDateFormat
import java.util.*
import com.batoulapps.adhan.Coordinates
import com.batoulapps.adhan.CalculationMethod
import com.batoulapps.adhan.PrayerTimes
import com.batoulapps.adhan.data.DateComponents

class SyncService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private val FIREBASE_URL = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/.json"

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        SyncManager.isServiceActive = true
        SyncManager.init(this)
        SyncManager.onBreakFinished = {
            showBreakFinishedAlarmNotification()
        }
        createNotificationChannel()
        updateForegroundNotification()
        startPolling()
    }

    private fun startPolling() {
        // Dedicated 1s Timer Loop for smooth local countdown & status bar updates
        serviceScope.launch {
            while (isActive) {
                val status = SyncManager.currentStatus
                val hasActivePass = status.activePasses.any { it.remainingSec > 0 }
                val isBusy = hasActivePass || status.state != "idle" || status.isPrayerBreak

                withContext(Dispatchers.Main) {
                    SyncManager.tickSessionTimer()
                    SyncManager.tickActivePasses(FocusBlockerService.currentPackage)
                }

                // Keep foreground notification updated live with Stop All Service button
                updateForegroundNotification()

                delay(1000)
            }
        }

        serviceScope.launch {
            while (isActive) {
                fetchAndSyncNow()

                // Smart sync delay: 2.5s when active session/pass, 5s when IDLE for fast auto-connect
                val status = SyncManager.currentStatus
                val hasActivePass = status.activePasses.any { it.remainingSec > 0 }
                val isBusy = hasActivePass || status.state != "idle" || status.isPrayerBreak
                val delayTime = if (isBusy) 2500L else 5000L
                delay(delayTime)
            }
        }
    }

    suspend fun fetchAndSyncNow() {
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
    }

    private suspend fun mergeAndUpdate(localJson: String?, cloudJson: String?) {
        try {
            val local = if (localJson != null) JSONObject(localJson) else null
            val cloud = if (cloudJson != null) JSONObject(cloudJson) else null
            
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
            
            SyncManager.doomData = mergeDoomData(SyncManager.doomData, cloudDoom)
            SyncManager.doomSettings = cloud?.optJSONObject("settings") ?: local?.optJSONObject("settings")
            val cloudConfigs = cloud?.optJSONObject("siteConfigs") ?: local?.optJSONObject("siteConfigs")
            if (cloudConfigs != null) {
                SyncManager.siteConfigs = cloudConfigs
            }
            
            val base = local ?: cloud ?: return
            val activePasses = mutableMapOf<String, ActivePass>()

            fun parsePasses(json: JSONObject?) {
                if (json == null) return
                val now = System.currentTimeMillis()
                val array = json.optJSONArray("activePasses")
                if (array != null) {
                    for (i in 0 until array.length()) {
                        val p = array.getJSONObject(i)
                        val domain = p.getString("domain")
                        val targetEnd = p.optLong("targetEndTime", 0L)
                        var sec = p.optInt("remainingSec", 0)
                        if (targetEnd > 0) {
                            sec = Math.max(0, Math.ceil((targetEnd - now) / 1000.0).toInt())
                        }
                        val left = p.optInt("passesLeft", 0)
                        val grantTime = p.optLong("lastGrantTime", 0L)
                        val isTargetExpired = (targetEnd > 0 && targetEnd <= now)
                        val isAgeExpired = (grantTime == 0L || (now - grantTime > 15 * 60 * 1000L))
                        if (sec > 0 && !isTargetExpired && !isAgeExpired) {
                            activePasses[domain] = ActivePass(domain, sec, left, lastGrantTime = grantTime)
                        }
                    }
                } else {
                    val obj = json.optJSONObject("activePasses")
                    if (obj != null) {
                        val keys = obj.keys()
                        while (keys.hasNext()) {
                            val key = keys.next()
                            val p = obj.optJSONObject(key)
                            if (p != null) {
                                val domain = p.optString("domain", key.replace("_", "."))
                                val targetEnd = p.optLong("targetEndTime", 0L)
                                var sec = p.optInt("remainingSec", 0)
                                if (targetEnd > 0) {
                                    sec = Math.max(0, Math.ceil((targetEnd - now) / 1000.0).toInt())
                                }
                                val left = p.optInt("passesLeft", 0)
                                val grantTime = p.optLong("lastGrantTime", 0L)
                                val isTargetExpired = (targetEnd > 0 && targetEnd <= now)
                                val isAgeExpired = (grantTime == 0L || (now - grantTime > 15 * 60 * 1000L))
                                if (sec > 0 && !isTargetExpired && !isAgeExpired) {
                                    activePasses[domain] = ActivePass(domain, sec, left, lastGrantTime = grantTime)
                                }
                            }
                        }
                    }
                }
            }

            parsePasses(local)
            parsePasses(cloud)

            val finalPasses = mutableMapOf<String, ActivePass>()
            val existingPasses = SyncManager.currentStatus.activePasses.associateBy { it.domain }

            activePasses.forEach { (domain, newPass) ->
                val existing = existingPasses[domain]
                val isOwner = existing?.isLocalOwner ?: newPass.isLocalOwner
                val localGrantTime = existing?.lastGrantTime ?: 0L
                val cloudGrantTime = newPass.lastGrantTime
                
                var bestSec = newPass.remainingSec
                var finalGrantTime = cloudGrantTime
                
                if (existing != null) {
                    if (cloudGrantTime > localGrantTime) {
                        // Brand new pass granted
                        bestSec = newPass.remainingSec
                        finalGrantTime = cloudGrantTime
                    } else if (localGrantTime > cloudGrantTime) {
                        // Local pass is newer
                        bestSec = existing.remainingSec
                        finalGrantTime = localGrantTime
                    } else {
                        // Same pass: monotonically decrement! Never jump backwards to lagging cloud polling
                        bestSec = Math.min(existing.remainingSec, newPass.remainingSec)
                        finalGrantTime = localGrantTime
                    }
                }
                finalPasses[domain] = ActivePass(domain, bestSec, newPass.passesLeft, isOwner, finalGrantTime)
            }

            // Crucial: preserve local passes so Android never wipes its own timer when cloud is delayed or empty
            existingPasses.values.filter { it.isLocalOwner && it.remainingSec > 0 }.forEach {
                if (!finalPasses.containsKey(it.domain)) {
                    finalPasses[it.domain] = it
                }
            }

            val prayerObj = base.optJSONObject("prayer")
            val isPrayerBreak = prayerObj?.optBoolean("isBreakActive", false) ?: false
            val prayerBreakSec = prayerObj?.optInt("breakRemainingSec", 0) ?: 0
            var prayerNextName = prayerObj?.optString("nextName", "") ?: ""
            var prayerNextTime = prayerObj?.optString("nextTime", "") ?: ""

            val prayerTimesList = mutableListOf<PrayerScheduleItem>()
            val allTimesArr = prayerObj?.optJSONArray("allTimes")
            if (allTimesArr != null && allTimesArr.length() > 0) {
                for (i in 0 until allTimesArr.length()) {
                    val item = allTimesArr.optJSONObject(i)
                    if (item != null) {
                        val name = item.optString("name", "")
                        val time = item.optString("time", "")
                        if (name.isNotEmpty() && time.isNotEmpty()) {
                            prayerTimesList.add(PrayerScheduleItem(name, time))
                        }
                    }
                }
            }

            // Offline calculation fallback using Adhan library if prayer list is empty
            if (prayerTimesList.isEmpty()) {
                try {
                    val coordinates = Coordinates(-2.8554, 115.3283) // Default coordinates (GMT+8)
                    val dateComponents = DateComponents.from(Date())
                    val params = CalculationMethod.SINGAPORE.parameters
                    val pt = PrayerTimes(coordinates, dateComponents, params)
                    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault()).apply {
                        timeZone = TimeZone.getTimeZone("GMT+8")
                    }
                    prayerTimesList.add(PrayerScheduleItem("Subuh", sdf.format(pt.fajr)))
                    prayerTimesList.add(PrayerScheduleItem("Dhuha", sdf.format(pt.sunrise)))
                    prayerTimesList.add(PrayerScheduleItem("Dzuhur", sdf.format(pt.dhuhr)))
                    prayerTimesList.add(PrayerScheduleItem("Ashar", sdf.format(pt.asr)))
                    prayerTimesList.add(PrayerScheduleItem("Maghrib", sdf.format(pt.maghrib)))
                    prayerTimesList.add(PrayerScheduleItem("Isya", sdf.format(pt.isha)))
                } catch (e: Exception) {
                    android.util.Log.e("SyncService", "Adhan calculation error: ${e.message}")
                }
            }

            // Determine next prayer if missing
            if (prayerNextName.isEmpty() && prayerTimesList.isNotEmpty()) {
                val nowCal = Calendar.getInstance()
                val curHour = nowCal.get(Calendar.HOUR_OF_DAY)
                val curMin = nowCal.get(Calendar.MINUTE)
                val curTotalMins = curHour * 60 + curMin

                for (item in prayerTimesList) {
                    val parts = item.time.split(":")
                    if (parts.size == 2) {
                        val pMins = (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
                        if (pMins > curTotalMins) {
                            prayerNextName = item.name
                            prayerNextTime = item.time
                            break
                        }
                    }
                }
                if (prayerNextName.isEmpty()) {
                    prayerNextName = prayerTimesList.first().name
                    prayerNextTime = prayerTimesList.first().time
                }
            }

            withContext(Dispatchers.Main) {
                // If on Prayer Break, prioritize prayer countdown (15 min window)
                val incomingSec = base.optInt("remainingSec", 0)
                val currentLocalSec = SyncManager.currentStatus.remainingSec
                val diff = Math.abs(incomingSec - currentLocalSec)
                val resolvedSec = if (isPrayerBreak && prayerBreakSec > 0) {
                    prayerBreakSec
                } else if (currentLocalSec > 0 && incomingSec > 0 && diff in 1..3 && SyncManager.currentStatus.state == base.optString("state", "idle")) {
                    currentLocalSec // Keep smooth local 1s tick
                } else {
                    incomingSec
                }

                val mins = resolvedSec / 60
                val secs = resolvedSec % 60
                val formattedTime = if (resolvedSec > 0) String.format(Locale.US, "%02d:%02d", mins, secs) else base.optString("formattedTime", "00:00")
                val maxPeriod = if (isPrayerBreak) 900 else base.optInt("maxPeriodSec", 1)

                SyncManager.currentStatus = FocusStatus(
                    state = base.optString("state", "idle"),
                    formattedTime = formattedTime,
                    remainingSec = resolvedSec,
                    maxPeriodSec = maxPeriod,
                    currentPeriod = base.optInt("currentPeriod", 1),
                    totalPeriods = base.optInt("totalPeriods", 1),
                    completedMinutes = base.optInt("completedMinutes", 0),
                    dailyGoalHours = base.optDouble("dailyGoalHours", 1.0),
                    yesterdayHours = base.optDouble("yesterdayHours", 0.0),
                    streakDays = base.optInt("streakDays", 0),
                    isPaused = base.optBoolean("isPaused", false),
                    isAutoPaused = base.optBoolean("isAutoPaused", false),
                    isOnline = local != null,
                    isPrayerBreak = isPrayerBreak,
                    prayerBreakSec = prayerBreakSec,
                    prayerNextName = if (prayerNextName.isNotEmpty()) prayerNextName else SyncManager.currentStatus.prayerNextName,
                    prayerNextTime = if (prayerNextTime.isNotEmpty()) prayerNextTime else SyncManager.currentStatus.prayerNextTime,
                    prayerTimes = if (prayerTimesList.isNotEmpty()) prayerTimesList else SyncManager.currentStatus.prayerTimes,
                    customGif = if (base.has("customGif")) base.optString("customGif", "") else SyncManager.currentStatus.customGif,
                    gifOpacity = if (base.has("gifOpacity")) base.optDouble("gifOpacity", 0.78).toFloat() else SyncManager.currentStatus.gifOpacity,
                    activePasses = finalPasses.values.toList()
                )

                if (base.has("customGif")) {
                    SyncManager.updateCustomGif(
                        base.optString("customGif", ""),
                        base.optDouble("gifOpacity", 0.78).toFloat()
                    )
                }

                val data = SyncManager.doomData ?: JSONObject()
                var doomChanged = false
                finalPasses.forEach { (domain, pass) ->
                    val key = domain.replace(".", "_")
                    val info = data.optJSONObject(key) ?: JSONObject()
                    val cdStart = info.optLong("cooldownStart", 0L)
                    val cdMins = SyncManager.getAppCooldown(domain)
                    val isCdActive = cdStart > 0 && (System.currentTimeMillis() - cdStart < cdMins * 60 * 1000L)
                    if (!isCdActive || pass.lastGrantTime >= cdStart) {
                        if (!info.optBoolean("isPassActive", false)) {
                            info.put("isPassActive", true)
                            info.put("totalSecThisSession", 0)
                            if (!isCdActive) info.put("cooldownStart", 0L)
                            data.put(key, info)
                            doomChanged = true
                        }
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
        val now = System.currentTimeMillis()
        while (localKeys.hasNext()) {
            val key = localKeys.next()
            val domain = key.replace("_", ".")
            val cooldownMins = SyncManager.getAppCooldown(domain)
            if (!result.has(key)) {
                result.put(key, local.get(key))
            } else {
                val localItem = local.getJSONObject(key)
                val cloudItem = result.getJSONObject(key)
                
                val localCd = localItem.optLong("cooldownStart", 0L)
                val cloudCd = cloudItem.optLong("cooldownStart", 0L)
                val isLocalCdActive = localCd > 0 && (now - localCd) < (cooldownMins * 60 * 1000L)
                val isCloudCdActive = cloudCd > 0 && (now - cloudCd) < (cooldownMins * 60 * 1000L)

                val bestCd = if (isLocalCdActive && isCloudCdActive) {
                    Math.max(localCd, cloudCd)
                } else if (isLocalCdActive) {
                    localCd
                } else if (isCloudCdActive) {
                    cloudCd
                } else {
                    0L
                }

                val isPassActive = (localItem.optBoolean("isPassActive", false) || cloudItem.optBoolean("isPassActive", false)) && (bestCd == 0L)
                val totalSec = Math.max(localItem.optInt("totalSecThisSession", 0), cloudItem.optInt("totalSecThisSession", 0))

                val merged = JSONObject().apply {
                    put("cooldownStart", bestCd)
                    put("isPassActive", isPassActive)
                    put("totalSecThisSession", totalSec)
                }
                result.put(key, merged)
            }
        }
        return result
    }

    fun pushLocalStateToCloud() {
        CoroutineScope(Dispatchers.IO).launch {
            pushLocalStateToCloudInternal()
        }
    }

    private suspend fun pushLocalStateToCloudInternal() {
        try {
            val patchObj = JSONObject()
            val doom = SyncManager.doomData
            if (doom != null) {
                patchObj.put("doomTracker", doom)
            }

            val configs = SyncManager.siteConfigs
            if (configs != null) {
                patchObj.put("siteConfigs", configs)
            }
            
            val passesObj = JSONObject()
            val activePassesMap = SyncManager.currentStatus.activePasses.associateBy { it.domain }
            val allDomains = listOf("facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitter.com", "reddit.com", "x.com")
            val now = System.currentTimeMillis()

            allDomains.forEach { d ->
                val k = d.replace(".", "_")
                val p = activePassesMap[d]
                if (p != null && p.remainingSec > 0 && (now - p.lastGrantTime < 15 * 60 * 1000L)) {
                    passesObj.put(k, JSONObject().apply {
                        put("domain", p.domain)
                        put("remainingSec", p.remainingSec)
                        put("passesLeft", p.passesLeft)
                        put("lastGrantTime", p.lastGrantTime)
                        put("targetEndTime", now + (p.remainingSec * 1000L))
                    })
                } else {
                    passesObj.put(k, JSONObject.NULL)
                }
            }
            patchObj.put("activePasses", passesObj)
            
            patchObj.put("lastUpdate", now)

            val body = patchObj.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(FIREBASE_URL).patch(body).build()
            client.newCall(request).execute().use { resp ->
                // Executed
            }
        } catch (e: Exception) {}
    }

    private fun buildForegroundNotification(): android.app.Notification {
        val status = SyncManager.currentStatus
        val title: String
        val text: String
        val isEn = SyncManager.currentLanguage == "en"

        val icon = when {
            status.isPrayerBreak || status.state == "resting" -> android.R.drawable.ic_dialog_info
            status.state == "focusing" -> android.R.drawable.stat_notify_sync_noanim
            else -> android.R.drawable.stat_notify_sync
        }

        if (status.isPrayerBreak || status.state == "resting") {
            title = if (isEn) "☕ Rest & Stretch" else "☕ Istirahat & Peregangan"
            text = if (isEn) "${status.formattedTime} remaining — Take a walk, stretch & hydrate!" else "${status.formattedTime} tersisa — Jalan santai, stretching & minum air!"
        } else if (status.state == "focusing") {
            val pauseNote = if (status.isPaused) (if (isEn) " (Paused)" else " (Dijeda)") else ""
            title = if (isEn) "🎯 Focus Session ${status.currentPeriod}/${status.totalPeriods}$pauseNote" else "🎯 Fokus Sesi ${status.currentPeriod}/${status.totalPeriods}$pauseNote"
            text = if (isEn) "${status.formattedTime} remaining — Stay focused on your task!" else "${status.formattedTime} tersisa — Tetap fokus pada tugasmu!"
        } else {
            title = if (isEn) "FocusGrow Ready" else "FocusGrow Siap"
            text = if (isEn) "Today's Target: ${status.completedMinutes} mins / ${status.dailyGoalHours} hrs" else "Target hari ini: ${status.completedMinutes} mnt / ${status.dailyGoalHours} jam"
        }

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, SyncService::class.java).apply {
            action = ACTION_STOP_SERVICE
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 2, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopText = if (isEn) "Stop All Service" else "Stop All Service"

        val publicNotification = NotificationCompat.Builder(this, "sync_channel_v3")
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(icon)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, stopText, stopPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        return NotificationCompat.Builder(this, "sync_channel_v3")
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(icon)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, stopText, stopPendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPublicVersion(publicNotification)
            .build()
    }

    private fun updateForegroundNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = buildForegroundNotification()
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(1, notification)
            }
        } catch (e: Exception) {
            manager.notify(1, notification)
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val status = SyncManager.currentStatus
        val hasActivePass = status.activePasses.any { it.remainingSec > 0 }
        val isBusy = hasActivePass || status.state != "idle" || status.isPrayerBreak

        // When user swipes away app from Recents while IDLE: stop service completely!
        if (!isBusy) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(1)
            stopSelf()
        }
    }

    private fun showBreakFinishedAlarmNotification() {
        val isEn = SyncManager.currentLanguage == "en"
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 1001, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, "break_alert_channel")
            .setContentTitle(if (isEn) "🔔 Break Time Finished!" else "🔔 Waktu Istirahat Selesai!")
            .setContentText(if (isEn) "Time to return to your desk to continue focusing." else "Saatnya kembali ke meja kerja untuk melanjutkan fokus.")
            .setStyle(NotificationCompat.BigTextStyle().bigText(if (isEn) "Break & stretch session finished! Time to return to your desk and continue making progress." else "Sesi istirahat dan peregangan sudah selesai! Yuk kembali ke layar & meja kerja untuk melanjutkan progres produktifmu."))
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(1001, builder.build())
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Remove legacy low importance channel so MIUI/HyperOS refreshes lockscreen channel settings
            try { manager.deleteNotificationChannel("sync_channel") } catch (e: Exception) {}

            // 1. Live Foreground Timer Status (IMPORTANCE_DEFAULT required for MIUI/POCO/HyperOS lockscreen)
            val syncChannel = NotificationChannel(
                "sync_channel_v3",
                "Status Timer Live",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Menampilkan timer fokus dan waktu istirahat secara real-time"
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(syncChannel)

            // 2. High-Priority Break Finished Alert
            val alertChannel = NotificationChannel(
                "break_alert_channel",
                "Peringatan Istirahat Selesai",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Memberi tahu dengan suara dan getaran ketika waktu istirahat habis"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 700)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(alertChannel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SERVICE) {
            stopAllServices()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    fun stopAllServices() {
        try {
            // 1. Disable blocker accessibility service & dismiss overlays
            FocusBlockerService.isServiceDisabled = true
            FocusBlockerService.instance?.hideAllOverlays()

            // 2. Remove foreground state and cancel all notifications
            try {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } catch (e: Exception) {}
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(1)
            manager?.cancelAll()

            // 3. Cancel scope and stop service
            SyncManager.isServiceActive = false
            serviceScope.cancel()
            instance = null
            stopSelf()
        } catch (e: Exception) {
            android.util.Log.e("SyncService", "Error stopping service: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        SyncManager.isServiceActive = false
        if (instance == this) instance = null
        serviceScope.cancel()
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(1)
            manager?.cancelAll()
        } catch (e: Exception) {}
    }

    companion object {
        const val ACTION_STOP_SERVICE = "ACTION_STOP_SERVICE"
        var instance: SyncService? = null

        fun triggerManualSync(onComplete: (() -> Unit)? = null) {
            CoroutineScope(Dispatchers.IO).launch {
                val svc = instance
                if (svc != null) {
                    svc.fetchAndSyncNow()
                } else {
                    try {
                        val client = OkHttpClient.Builder()
                            .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                            .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                            .build()
                        val req = Request.Builder()
                            .url("https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/.json")
                            .build()
                        client.newCall(req).execute().close()
                    } catch (e: Exception) {}
                }
                delay(400)
                withContext(Dispatchers.Main) {
                    onComplete?.invoke()
                }
            }
        }

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
                    val client = OkHttpClient()
                    val domainKey = domain.replace(".", "_")

                    // 1. Update Active Pass directly at its child key (never wipes other domains!)
                    val passData = JSONObject().apply {
                        put("domain", domain)
                        put("remainingSec", minutes * 60)
                        put("passesLeft", 1) 
                        put("lastGrantTime", System.currentTimeMillis())
                    }
                    val passUrl = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/activePasses/${domainKey}.json"
                    val passBody = passData.toString().toRequestBody("application/json".toMediaType())
                    val passReq = Request.Builder().url(passUrl).put(passBody).build()
                    client.newCall(passReq).execute().close()
                    
                    // 2. Update Doom Tracker directly at its child key
                    val trackerInfo = JSONObject().apply {
                        put("isPassActive", true)
                        put("totalSecThisSession", 0)
                        put("cooldownStart", 0L)
                    }
                    val doomUrl = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/doomTracker/${domainKey}.json"
                    val doomBody = trackerInfo.toString().toRequestBody("application/json".toMediaType())
                    val doomReq = Request.Builder().url(doomUrl).patch(doomBody).build()
                    client.newCall(doomReq).execute().close()

                    // 3. Update lastUpdate
                    val updateUrl = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/lastUpdate.json"
                    val updateBody = System.currentTimeMillis().toString().toRequestBody("application/json".toMediaType())
                    val updateReq = Request.Builder().url(updateUrl).put(updateBody).build()
                    client.newCall(updateReq).execute().close()

                    android.util.Log.d("FocusGrowSync", "Android Instant Child Push OK")
                } catch (e: Exception) {
                    android.util.Log.e("FocusGrowSync", "Android Instant Push Failed: ${e.message}")
                }
            }
        }

        fun updateCloudSiteConfig(domainKey: String, limit: Int, cooldown: Int) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val client = OkHttpClient()
                    val configData = JSONObject().apply {
                        put("limit", limit)
                        put("cooldown", cooldown)
                    }
                    val url = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/siteConfigs/${domainKey}.json"
                    val body = configData.toString().toRequestBody("application/json".toMediaType())
                    val req = Request.Builder().url(url).put(body).build()
                    client.newCall(req).execute().close()
                    android.util.Log.d("FocusGrowSync", "Pushed siteConfig for $domainKey: limit=$limit, cd=$cooldown")
                } catch (e: Exception) {
                    android.util.Log.e("FocusGrowSync", "Failed to push siteConfig: ${e.message}")
                }
            }
        }
    }
}
