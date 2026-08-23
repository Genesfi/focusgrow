package com.genesfi.focusgrow

import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.snapshots.SnapshotStateList
import org.json.JSONObject

// Represents the focus status and active sessions/passes
data class FocusStatus(
    val state: String = "idle",
    val formattedTime: String = "00:00",
    val remainingSec: Int = 0,
    val maxPeriodSec: Int = 1,
    val currentPeriod: Int = 1,
    val totalPeriods: Int = 1,
    val isOnline: Boolean = false,
    val activePasses: List<ActivePass> = emptyList()
)

data class ActivePass(
    val domain: String,
    val remainingSec: Int,
    val passesLeft: Int,
    val isLocalOwner: Boolean = false,
    val lastGrantTime: Long = 0L // V30: Track exactly when it was started
)

object SyncManager {
    var currentStatus: FocusStatus = FocusStatus()
    var pcIpAddress: String = "192.168.1.13" // Fallback IP

    var doomData: JSONObject? = null
    var doomSettings: JSONObject? = null

    val restrictedApps: SnapshotStateList<String> = mutableStateListOf(
        "com.facebook.katana", "com.instagram.android", "com.zhiliaoapp.musically",
        "com.google.android.youtube", "com.twitter.android", "com.reddit.frontpage"
    )

    val restrictedSites: SnapshotStateList<String> = mutableStateListOf(
        "facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitter.com", "reddit.com", "x.com"
    )

    fun addApp(packageName: String) {
        if (!restrictedApps.contains(packageName)) {
            restrictedApps.add(packageName)
        }
    }

    fun removeApp(packageName: String) {
        restrictedApps.remove(packageName)
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

        val cleanDomain = domain.split(".")[0].lowercase()
        val keywords = mapping[cleanDomain] ?: listOf(cleanDomain)

        val match = keywords.any { pkg.lowercase().contains(it) }
        // android.util.Log.d("FocusGrowSync", "Matching: pkg=$pkg vs domain=$cleanDomain (keywords=$keywords) -> Result: $match")
        return match
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

        // V25 FIX: Immediately update doomData locally to prevent re-blocking
        val data = doomData ?: JSONObject()
        val key = domain.replace(".", "_")
        val info = data.optJSONObject(key) ?: JSONObject()
        info.put("isPassActive", true)
        info.put("totalSecThisSession", 0)
        info.put("cooldownStart", 0L)
        data.put(key, info)
        doomData = data
    }

    fun tickActivePasses(currentPackage: String?) {
        if (currentStatus.activePasses.isEmpty() && doomData == null) return
        
        // 1. Tick Active Passes (GLOBAL - Always tick)
        val updatedPasses = currentStatus.activePasses.map { 
            if (it.remainingSec > 0) it.copy(remainingSec = it.remainingSec - 1) else it
        }.filter { it.remainingSec > 0 }
        
        // V35 FIX: ALWAYS update currentStatus to trigger Compose UI refresh
        currentStatus = currentStatus.copy(activePasses = updatedPasses)

        // 2. Tick Doomscroll Tracker (Active App only)
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

                // Only increment if not in cooldown
                if (info.optLong("cooldownStart", 0) == 0L) {
                    val currentSec = info.optInt("totalSecThisSession", 0)
                    // V26 FIX: If pass is active, we ALSO tick the pass remaining time 
                    // (already handled above globally, but we keep isPassActive sync)
                    info.put("totalSecThisSession", currentSec + 1)
                    data.put(key, info)
                    doomData = data
                }
            }
        }
    }
}
