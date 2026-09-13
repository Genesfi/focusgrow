package com.genesfi.focusgrow

import android.app.AppOpsManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Process
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import org.json.JSONObject
import java.util.Locale

// Represents an individual prayer schedule time
data class PrayerScheduleItem(
    val name: String,
    val time: String
)

// Represents the focus status and active sessions/passes
data class FocusStatus(
    val state: String = "idle", // "idle", "focusing", "resting"
    val formattedTime: String = "00:00",
    val remainingSec: Int = 0,
    val maxPeriodSec: Int = 1,
    val currentPeriod: Int = 1,
    val totalPeriods: Int = 1,
    val completedMinutes: Int = 0,
    val dailyGoalHours: Double = 1.0,
    val yesterdayHours: Double = 0.0,
    val streakDays: Int = 0,
    val isPaused: Boolean = false,
    val isAutoPaused: Boolean = false,
    val isOnline: Boolean = false,
    val isPrayerBreak: Boolean = false,
    val prayerBreakSec: Int = 0,
    val prayerNextName: String = "",
    val prayerNextTime: String = "",
    val prayerTimes: List<PrayerScheduleItem> = emptyList(),
    val customGif: String = "",
    val gifOpacity: Float = 0.78f,
    val activePasses: List<ActivePass> = emptyList()
)

data class ActivePass(
    val domain: String,
    val remainingSec: Int,
    val passesLeft: Int,
    val isLocalOwner: Boolean = false,
    val lastGrantTime: Long = 0L
)

object SyncManager {
    var currentStatus by mutableStateOf(FocusStatus())
    var pcIpAddress by mutableStateOf("192.168.1.13")
    var isServiceActive by mutableStateOf(false)

    var doomData: JSONObject? = null
    var doomSettings: JSONObject? = null
    var siteConfigs by mutableStateOf<JSONObject?>(null)

    val restrictedApps: SnapshotStateList<String> = mutableStateListOf()
    val restrictedSites: SnapshotStateList<String> = mutableStateListOf(
        "facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitter.com", "reddit.com", "x.com"
    )

    private const val PREFS_NAME = "focusgrow_prefs"
    private const val KEY_RESTRICTED_APPS = "restricted_apps"
    private const val KEY_PC_IP = "pc_ip_address"
    private const val KEY_CUSTOM_GIF = "cached_custom_gif"
    private const val KEY_GIF_HASH = "cached_gif_hash"
    private const val KEY_GIF_OPACITY = "cached_gif_opacity"
    private const val KEY_LANGUAGE = "app_language"
    private const val KEY_SITE_CONFIGS = "cached_site_configs"
    private const val KEY_BLOCKER_MODE = "blocker_mode"
    private var prefs: SharedPreferences? = null

    var currentLanguage by mutableStateOf("id")
    var cachedGifHash by mutableStateOf("")
    var blockerMode by mutableStateOf("hybrid") // "hybrid", "accessibility", "usage_stats"

    var onBreakFinished: (() -> Unit)? = null
    private var wasResting: Boolean = false

    fun init(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            currentLanguage = prefs?.getString(KEY_LANGUAGE, "id") ?: "id"
            val savedIp = prefs?.getString(KEY_PC_IP, "192.168.1.13") ?: "192.168.1.13"
            pcIpAddress = savedIp

            val cachedGif = prefs?.getString(KEY_CUSTOM_GIF, "") ?: ""
            val cachedOpacity = prefs?.getFloat(KEY_GIF_OPACITY, 0.78f) ?: 0.78f
            cachedGifHash = prefs?.getString(KEY_GIF_HASH, "") ?: ""
            blockerMode = prefs?.getString(KEY_BLOCKER_MODE, "hybrid") ?: "hybrid"
            if (cachedGif.isNotEmpty()) {
                currentStatus = currentStatus.copy(customGif = cachedGif, gifOpacity = cachedOpacity)
            }

            val savedApps = prefs?.getStringSet(KEY_RESTRICTED_APPS, null)
            restrictedApps.clear()
            if (savedApps != null && savedApps.isNotEmpty()) {
                restrictedApps.addAll(savedApps)
            } else {
                // Default apps if fresh install
                val defaults = listOf(
                    "com.facebook.katana", "com.instagram.android", "com.zhiliaoapp.musically",
                    "com.google.android.youtube", "com.twitter.android", "com.reddit.frontpage"
                )
                restrictedApps.addAll(defaults)
                saveRestrictedApps()
            }

            val cachedConfigs = prefs?.getString(KEY_SITE_CONFIGS, null)
            if (cachedConfigs != null) {
                try { siteConfigs = JSONObject(cachedConfigs) } catch (e: Exception) {}
            }
        }
    }

    fun getMatchedDomain(pkg: String): String? {
        val domains = listOf("facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitter.com", "reddit.com", "x.com")
        return domains.find { isPackageMatch(pkg, it) }
    }

    fun getAppCooldown(pkgOrDomain: String): Int {
        val domain = getMatchedDomain(pkgOrDomain) ?: pkgOrDomain
        val key = domain.replace(".", "_")
        val cfg = siteConfigs?.optJSONObject(key) ?: siteConfigs?.optJSONObject(domain)
        if (cfg != null && cfg.has("cooldown")) {
            val cd = cfg.optInt("cooldown", 0)
            if (cd > 0) return cd
        }
        return doomSettings?.optInt("doomCooldown", 30) ?: 30
    }

    fun getAppLimit(pkgOrDomain: String): Int {
        val domain = getMatchedDomain(pkgOrDomain) ?: pkgOrDomain
        val key = domain.replace(".", "_")
        val cfg = siteConfigs?.optJSONObject(key) ?: siteConfigs?.optJSONObject(domain)
        if (cfg != null && cfg.has("limit")) {
            val lim = cfg.optInt("limit", 0)
            if (lim > 0) return lim
        }
        return doomSettings?.optInt("doomLimit", 5) ?: 5
    }

    fun saveAppConfig(pkgOrDomain: String, limit: Int, cooldown: Int) {
        val domain = getMatchedDomain(pkgOrDomain) ?: pkgOrDomain
        val key = domain.replace(".", "_")
        val data = if (siteConfigs != null) JSONObject(siteConfigs.toString()) else JSONObject()
        val item = JSONObject().apply {
            put("limit", limit)
            put("cooldown", cooldown)
        }
        data.put(key, item)
        siteConfigs = data

        prefs?.edit()?.putString(KEY_SITE_CONFIGS, data.toString())?.apply()
        SyncService.updateCloudSiteConfig(key, limit, cooldown)
    }

    fun updateCustomGif(gif: String, opacity: Float, hash: String = "") {
        val hashToStore = if (hash.isNotEmpty()) hash else cachedGifHash
        if (currentStatus.customGif != gif || currentStatus.gifOpacity != opacity || cachedGifHash != hashToStore) {
            currentStatus = currentStatus.copy(customGif = gif, gifOpacity = opacity)
            cachedGifHash = hashToStore
            prefs?.edit()?.apply {
                putString(KEY_CUSTOM_GIF, gif)
                putFloat(KEY_GIF_OPACITY, opacity)
                putString(KEY_GIF_HASH, hashToStore)
                apply()
            }
        }
    }

    fun setPcIp(ip: String) {
        pcIpAddress = ip
        prefs?.edit()?.putString(KEY_PC_IP, ip)?.apply()
    }

    fun setLanguage(lang: String) {
        currentLanguage = lang
        prefs?.edit()?.putString(KEY_LANGUAGE, lang)?.apply()
    }

    fun setBlockerModePref(mode: String) {
        blockerMode = mode
        prefs?.edit()?.putString(KEY_BLOCKER_MODE, mode)?.apply()
    }

    fun hasUsageStatsPermission(context: Context): Boolean {
        return try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
            } else {
                appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
            }
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            false
        }
    }

    private fun saveRestrictedApps() {
        prefs?.edit()?.putStringSet(KEY_RESTRICTED_APPS, restrictedApps.toSet())?.apply()
    }

    fun addApp(packageName: String) {
        if (!restrictedApps.contains(packageName)) {
            restrictedApps.add(packageName)
            saveRestrictedApps()
        }
    }

    fun removeApp(packageName: String) {
        if (restrictedApps.remove(packageName)) {
            saveRestrictedApps()
        }
    }

    fun addSite(domain: String) {
        if (!restrictedSites.contains(domain)) {
            restrictedSites.add(domain)
        }
    }

    fun removeSite(domain: String) {
        restrictedSites.remove(domain)
    }

    fun isAppRestricted(packageName: String): Boolean {
        return restrictedApps.any { packageName.contains(it, ignoreCase = true) }
    }

    fun isUrlRestricted(url: String): Boolean {
        return restrictedSites.any { url.contains(it, ignoreCase = true) }
    }

    fun isPackageMatch(pkg: String, domain: String): Boolean {
        val mapping = mapOf(
            "facebook" to listOf("facebook", "katana", "lite", "orca"),
            "instagram" to listOf("instagram"),
            "tiktok" to listOf("musically", "zhiliaoapp", "trill"),
            "youtube" to listOf("youtube", "googledashboard", "vending", "googlevideo"),
            "twitter" to listOf("twitter", "x.android", "twttr"),
            "reddit" to listOf("reddit"),
            "x" to listOf("twitter", "x.android", "twttr")
        )

        val cleanDomain = domain.lowercase(Locale.ROOT).removePrefix("www.").split(".")[0]
        val keywords = mapping[cleanDomain] ?: listOf(cleanDomain)
        return keywords.any { pkg.lowercase(Locale.ROOT).contains(it) }
    }

    fun updatePassOptimistically(domain: String, minutes: Int) {
        val currentPasses = currentStatus.activePasses.toMutableList()
        val existingIndex = currentPasses.indexOfFirst { it.domain == domain }
        
        val newPass = ActivePass(domain, minutes * 60, 0, isLocalOwner = true, lastGrantTime = System.currentTimeMillis())
        if (existingIndex >= 0) {
            currentPasses[existingIndex] = newPass
        } else {
            currentPasses.add(newPass)
        }
        
        currentStatus = currentStatus.copy(activePasses = currentPasses)

        val data = doomData ?: JSONObject()
        val key = domain.replace(".", "_")
        val info = data.optJSONObject(key) ?: JSONObject()
        info.put("isPassActive", true)
        info.put("totalSecThisSession", 0)
        info.put("cooldownStart", 0L)
        data.put(key, info)
        doomData = data
    }

    // Called every 1s by SyncService to ensure smooth countdown locally
    fun tickSessionTimer() {
        val status = currentStatus

        // 1. Dedicated Prayer Break tick down
        if (status.isPrayerBreak && status.prayerBreakSec > 0) {
            val newPrayerSec = status.prayerBreakSec - 1
            val mins = newPrayerSec / 60
            val secs = newPrayerSec % 60
            currentStatus = status.copy(
                prayerBreakSec = newPrayerSec,
                remainingSec = newPrayerSec,
                formattedTime = String.format(Locale.US, "%02d:%02d", mins, secs)
            )
            if (newPrayerSec == 0) {
                currentStatus = currentStatus.copy(isPrayerBreak = false)
                onBreakFinished?.invoke()
            }
            return
        }

        val isRestingState = status.state == "resting" || status.isPrayerBreak

        if (status.state != "idle" && !status.isPaused && status.remainingSec > 0) {
            val newSec = status.remainingSec - 1
            val mins = newSec / 60
            val secs = newSec % 60
            val newFormatted = String.format(Locale.US, "%02d:%02d", mins, secs)
            currentStatus = status.copy(
                remainingSec = newSec,
                formattedTime = newFormatted
            )

            // Check if resting period just ended
            if (newSec == 0 && (wasResting || isRestingState)) {
                wasResting = false
                onBreakFinished?.invoke()
            }
        } else if (status.remainingSec == 0 && wasResting) {
            wasResting = false
            onBreakFinished?.invoke()
        }

        if (isRestingState && status.remainingSec > 0) {
            wasResting = true
        } else if (status.state == "idle") {
            wasResting = false
        }
    }

    fun tickActivePasses(currentPackage: String?) {
        if (currentStatus.activePasses.isEmpty() && doomData == null) return
        
        val initialCount = currentStatus.activePasses.size
        val updatedPasses = currentStatus.activePasses.map { 
            if (it.remainingSec > 0) it.copy(remainingSec = it.remainingSec - 1) else it
        }.filter { it.remainingSec > 0 }
        
        currentStatus = currentStatus.copy(activePasses = updatedPasses)

        if (initialCount > 0 && updatedPasses.size < initialCount) {
            // A pass just expired! Push immediately so Firebase is purged of stale pass
            SyncService.instance?.pushLocalStateToCloud()
        }

        if (currentPackage != null) {
            val domains = listOf("facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitter.com", "reddit.com", "x.com")
            val matchedDomain = domains.find { isPackageMatch(currentPackage, it) }
            
            if (matchedDomain != null) {
                val data = doomData ?: JSONObject()
                val key = matchedDomain.replace(".", "_")
                val info = data.optJSONObject(key) ?: JSONObject().apply {
                    put("totalSecThisSession", 0)
                    put("cooldownStart", 0)
                    put("isPassActive", false)
                }

                if (info.optLong("cooldownStart", 0) == 0L) {
                    val currentSec = info.optInt("totalSecThisSession", 0)
                    info.put("totalSecThisSession", currentSec + 1)
                    data.put(key, info)
                    doomData = data
                }
            }
        }
    }
}
