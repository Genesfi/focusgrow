package com.genesfi.focusgrow

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

class FocusBlockerService : AccessibilityService() {

    companion object {
        var currentPackage: String? = null
    }

    private var windowManager: WindowManager? = null
    private var blockerLayout: View? = null
    private var passTimerLayout: View? = null
    
    private var currentShowingType: String? = null // "doom_block", "focus_block", "PASS", "LIMIT"
    private var currentShowingPkg: String? = null
    
    private var doomRemainingSec: Int = 0
    
    private var handler: android.os.Handler? = null
    private val timerRunnable = object : Runnable {
        override fun run() {
            tickTimers()
            handler?.postDelayed(this, 1000)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        handler = android.os.Handler(android.os.Looper.getMainLooper())
        handler?.post(timerRunnable)
        android.util.Log.d("FocusBlocker", "Accessibility Service Connected (Domain Isolation Fix)")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && 
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) return
            
        val packageName = event.packageName?.toString() ?: return
        currentPackage = packageName
        
        // 1. IGNORE SYSTEM NOISE
        if (packageName == "com.android.systemui" || packageName == "android" || packageName == "com.google.android.inputmethod.latin") {
            return 
        }

        // 2. EXEMPT HOME/SETTINGS
        if (packageName.contains("launcher") || packageName.contains("settings")) {
            hideAllOverlays()
            return
        }
        
        // 3. IGNORE OUR OWN APP
        if (packageName == "com.genesfi.focusgrow") return

        val status = SyncManager.currentStatus
        val remainingDoomSec = checkCloudDoomscroll(packageName)
        val isDoomscrollBlocked = remainingDoomSec > 0
        val isFocusing = status.state == "focusing"

        // 4. DECISION TREE - DOMAIN ISOLATION V33
        // V33 FIX: ALWAYS check for active passes first (Global Auth)
        val activePass = status.activePasses.find { SyncManager.isPackageMatch(packageName, it.domain) }
        
        if (activePass != null && activePass.remainingSec > 0) {
            // We have a pass (from HP or PC)! Show Floating Timer
            showFloatingTimerPersistence(packageName, activePass.remainingSec, "PASS")
            return
        }

        if (isDoomscrollBlocked) {
            doomRemainingSec = remainingDoomSec
            showBlockerPersistence(packageName, true)
        } else {
            // No Pass. Are we in LIMIT?
            val targetDomain = getTargetDomain(packageName)
            val tracker = SyncManager.doomData
            val doomLimitSec = (SyncManager.doomSettings?.optInt("doomLimit", 5) ?: 5) * 60
            
            var foundLimit = false
            if (tracker != null && targetDomain != null) {
                val key = targetDomain.replace(".", "_")
                val info = tracker.optJSONObject(key)
                if (info != null && info.optLong("cooldownStart", 0) == 0L) {
                    val spentSec = info.optInt("totalSecThisSession", 0)
                    val remaining = doomLimitSec - spentSec
                    if (remaining > 0 && remaining <= doomLimitSec) {
                        showFloatingTimerPersistence(packageName, remaining, "LIMIT")
                        foundLimit = true
                    }
                }
            }
            
            if (!foundLimit) {
                // Not blocked, no pass, no limit -> Should we block?
                if (isFocusing && SyncManager.isAppRestricted(packageName)) {
                    showBlockerPersistence(packageName, false)
                } else if (targetDomain != null) {
                    showBlockerPersistence(packageName, true)
                } else {
                    hideAllOverlays()
                }
            }
        }
    }

    private fun tickTimers() {
        val type = currentShowingType ?: return
        val pkg = currentShowingPkg ?: return

        if (type == "doom_block") {
            val tv = blockerLayout?.findViewWithTag<TextView>("doom_timer") ?: return
            if (doomRemainingSec > 0) {
                doomRemainingSec--
                tv.text = String.format(Locale.US, "%02d:%02d", doomRemainingSec / 60, doomRemainingSec % 60)
            } else {
                hideAllOverlays()
            }
        } else if (type == "PASS" || type == "LIMIT") {
            val tv = passTimerLayout?.findViewWithTag<TextView>("timer_text") ?: return
            var secondsLeft = 0
            if (type == "PASS") {
                // Isolated Tick check
                secondsLeft = SyncManager.currentStatus.activePasses.find { SyncManager.isPackageMatch(pkg, it.domain) }?.remainingSec ?: 0
            } else {
                val domain = getTargetDomain(pkg) ?: return
                val info = SyncManager.doomData?.optJSONObject(domain.replace(".", "_")) ?: return
                val limit = (SyncManager.doomSettings?.optInt("doomLimit", 5) ?: 5) * 60
                secondsLeft = limit - info.optInt("totalSecThisSession", 0)
            }

            if (secondsLeft > 0) {
                tv.text = String.format(Locale.US, "%s: %02d:%02d", type, secondsLeft / 60, secondsLeft % 60)
            } else {
                hideAllOverlays()
            }
        }
    }

    private fun getTargetDomain(pkg: String): String? {
        val domains = listOf("facebook.com", "instagram.com", "tiktok.com", "youtube.com", "twitter.com", "reddit.com", "x.com")
        return domains.find { SyncManager.isPackageMatch(pkg, it) }
    }

    private fun showFloatingTimerPersistence(pkg: String, seconds: Int, label: String) {
        if (currentShowingType == label && currentShowingPkg == pkg) return
        
        hideAllOverlays()
        currentShowingType = label
        currentShowingPkg = pkg

        val color = if (label == "LIMIT") 0xFF38BDF8.toInt() else 0xFF10B981.toInt()
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL; y = 120 }

        val layout = LinearLayout(this).apply {
            val drawable = android.graphics.drawable.GradientDrawable().apply {
                setColor(0xDD0F172A.toInt()); cornerRadius = 40f
                setStroke(2, color)
            }
            background = drawable; setPadding(40, 15, 40, 15)
            addView(TextView(context).apply {
                tag = "timer_text"
                text = String.format(Locale.US, "%s: %02d:%02d", label, seconds / 60, seconds % 60)
                setTextColor(color); textSize = 13f; typeface = android.graphics.Typeface.DEFAULT_BOLD
            })
        }
        
        try { windowManager?.addView(layout, params); passTimerLayout = layout } catch (e: Exception) {}
    }

    private fun showBlockerPersistence(pkg: String, isDoom: Boolean) {
        val type = if (isDoom) "doom_block" else "focus_block"
        if (currentShowingType == type && currentShowingPkg == pkg) return
        
        hideAllOverlays()
        currentShowingType = type
        currentShowingPkg = pkg

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { flags = flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv() }

        val layout = createBlockerLayout(pkg, isDoom)
        try { windowManager?.addView(layout, params); blockerLayout = layout } catch (e: Exception) { backToHome() }
    }

    private fun hideAllOverlays() {
        if (blockerLayout != null) {
            try { windowManager?.removeView(blockerLayout) } catch (e: Exception) {}
            blockerLayout = null
        }
        if (passTimerLayout != null) {
            try { windowManager?.removeView(passTimerLayout) } catch (e: Exception) {}
            passTimerLayout = null
        }
        currentShowingType = null
        currentShowingPkg = null
    }

    private fun createBlockerLayout(pkg: String, isDoom: Boolean): View {
        val isFocusing = SyncManager.currentStatus.state == "focusing"
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setBackgroundColor(0xFF0F172A.toInt()); setPadding(60, 60, 60, 60)
            
            addView(ImageView(context).apply {
                setImageResource(android.R.drawable.ic_menu_compass); setColorFilter(0xFF38BDF8.toInt())
                layoutParams = LinearLayout.LayoutParams(140, 140).apply { setMargins(0,0,0,60) }
            })

            addView(TextView(context).apply {
                text = if (isDoom) "Doomscroll Limit" else "Focus Active"
                textSize = 28f; setTextColor(0xFF38BDF8.toInt()); gravity = Gravity.CENTER
                typeface = android.graphics.Typeface.create("sans-serif-black", android.graphics.Typeface.NORMAL)
            })
            
            addView(TextView(context).apply {
                text = if (isDoom) "Daily limit reached.\nTake a break and recharge!" else "Take a deep breath and\nfocus on your goal!"
                textSize = 16f; setTextColor(0xFFF8FAFC.toInt()); gravity = Gravity.CENTER
                setPadding(0, 20, 0, 40)
            })

            if (isDoom && doomRemainingSec > 0) {
                addView(TextView(context).apply {
                    text = "COOLDOWN ACTIVE"; textSize = 11f; setTextColor(0xFFFF4B4B.toInt())
                    gravity = Gravity.CENTER; setPadding(0, 20, 0, 10); typeface = android.graphics.Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    tag = "doom_timer"; text = String.format(Locale.US, "%02d:%02d", doomRemainingSec / 60, doomRemainingSec % 60)
                    textSize = 42f; setTextColor(0xFFF8FAFC.toInt()); gravity = Gravity.CENTER
                    typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL); setPadding(0, 0, 0, 40)
                })
            }

            addView(LinearLayout(context).apply {
                background = android.graphics.drawable.GradientDrawable().apply { setColor(0x11FFFFFF.toInt()); cornerRadius = 24f }
                setPadding(40, 30, 40, 30)
                addView(TextView(context).apply {
                    val quotes = listOf("\"Distraction is the enemy of greatness.\"", "\"Focus on being productive instead of busy.\"", "\"Energy flows where attention goes.\"")
                    text = quotes.random(); textSize = 12f; setTextColor(0x99FFFFFF.toInt()); gravity = Gravity.CENTER
                    setTypeface(null, android.graphics.Typeface.ITALIC)
                })
            })

            if ((isDoom || isFocusing) && doomRemainingSec <= 0) {
                val currentDomain = getTargetDomain(pkg) ?: "other.com"
                val passesLeft = SyncManager.currentStatus.activePasses.find { it.domain == currentDomain }?.passesLeft ?: 2
                
                addView(TextView(context).apply {
                    text = if (passesLeft > 0) "USE EMERGENCY PASS ($passesLeft LEFT)" else "LIMIT REACHED"
                    textSize = 10f; setTextColor(if(passesLeft > 0) 0xFF38BDF8.toInt() else 0xFFFF4B4B.toInt())
                    gravity = Gravity.CENTER; setPadding(0, 60, 0, 20)
                })

                if (passesLeft > 0) {
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
                        listOf(5, 10, 15).forEach { mins ->
                            addView(Button(context).apply {
                                text = "$mins m"; textSize = 11f; setTextColor(0xFF0F172A.toInt())
                                background = android.graphics.drawable.GradientDrawable().apply { setColor(0xFF38BDF8.toInt()); cornerRadius = 30f }
                                setOnClickListener { SyncService.grantPass(currentDomain, mins); hideAllOverlays() }
                            }, LinearLayout.LayoutParams(160, 100).apply { setMargins(10, 0, 10, 0) })
                        }
                    })
                }
            }

            addView(Button(context).apply {
                text = "GO BACK"; setTextColor(0xFFF8FAFC.toInt()); textSize = 13f; typeface = android.graphics.Typeface.DEFAULT_BOLD
                background = android.graphics.drawable.GradientDrawable().apply { setColor(0x22FFFFFF.toInt()); cornerRadius = 24f; setStroke(1, 0x33FFFFFF.toInt()) }
                setOnClickListener { backToHome() }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 130).apply { setMargins(0, 100, 0, 0) })
        }
    }

    private fun backToHome() {
        val intent = Intent(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_HOME); flags = Intent.FLAG_ACTIVITY_NEW_TASK }
        startActivity(intent); hideAllOverlays()
    }

    private fun checkCloudDoomscroll(pkg: String): Int {
        val tracker = SyncManager.doomData ?: return 0
        val targetDomain = getTargetDomain(pkg) ?: return 0
        val key = targetDomain.replace(".", "_")
        val info = tracker.optJSONObject(targetDomain) ?: tracker.optJSONObject(key) ?: return 0
        val cooldownStart = if (info.has("cooldownStart")) info.optLong("cooldownStart") else info.optLong("lastLimitReached", 0)
        if (cooldownStart > 0) {
            val cooldownMins = SyncManager.doomSettings?.optInt("doomCooldown", 30) ?: 30
            val elapsedSec = (System.currentTimeMillis() - cooldownStart) / 1000
            val remaining = (cooldownMins * 60) - elapsedSec.toInt()
            if (remaining > 0) return remaining
        }
        return 0
    }

    override fun onInterrupt() {}
    override fun onDestroy() { super.onDestroy(); hideAllOverlays() }
}
