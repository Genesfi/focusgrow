package com.genesfi.focusgrow

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.*
import org.json.JSONObject
import java.util.Locale

class FocusBlockerService : AccessibilityService() {

    companion object {
        var currentPackage: String? = null
        var isServiceDisabled: Boolean = false
        var instance: FocusBlockerService? = null
    }

    private data class Quote(val text: String, val author: String)

    private val REST_QUOTES = listOf(
        Quote("Istirahat bukan berarti berhenti, melainkan mengisi ulang energi untuk melangkah lebih jauh.", "Nasihat Sehat"),
        Quote("Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", "Ralph Marston"),
        Quote("Jauhkan pandangan dari layar, regangkan tubuhmu, dan hirup udara segar.", "Panduan Istirahat"),
        Quote("Almost everything will work again if you unplug it for a few minutes, including you.", "Anne Lamott"),
        Quote("Take a break. A rested mind can solve problems that a tired mind cannot.", "Wellness Wisdom"),
        Quote("Minum air putih, berdiri sejenak, dan biarkan matamu beristirahat.", "Health Reminder"),
        Quote("Tubuhmu butuh jeda agar bisa berlari kencang kembali nanti.", "FocusGrow Tips")
    )

    private val FOCUS_QUOTES = listOf(
        Quote("Tetap fokus pada tujuanmu. Hasil besar dibangun dari langkah-langkah kecil setiap hari.", "FocusGrow Wisdom"),
        Quote("Focus on being productive instead of busy.", "Tim Ferriss"),
        Quote("Deep work is the superpower of the 21st century.", "Cal Newport"),
        Quote("Starve your distractions, feed your focus.", "Anonymous"),
        Quote("Satu jam fokus penuh jauh lebih berharga daripada seharian bekerja setengah hati.", "Prinsip Produktivitas"),
        Quote("Action is the foundational key to all success.", "Pablo Picasso"),
        Quote("Disiplin adalah jembatan antara cita-cita dan pencapaian.", "Success Logic")
    )

    private var windowManager: WindowManager? = null
    private var blockerLayout: View? = null
    private var passTimerLayout: View? = null
    
    private var currentShowingType: String? = null // "doom_block", "focus_block", "PASS", "LIMIT"
    private var currentShowingPkg: String? = null
    
    private var doomRemainingSec: Int = 0
    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
    
    private var handler: android.os.Handler? = null
    private val timerRunnable = object : Runnable {
        override fun run() {
            tickTimers()
            handler?.postDelayed(this, 1000)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        isServiceDisabled = false
        SyncManager.init(this)
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        handler = android.os.Handler(android.os.Looper.getMainLooper())
        handler?.post(timerRunnable)
        android.util.Log.d("FocusBlocker", "Accessibility Service Connected (StayFree v2)")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (isServiceDisabled) {
            hideAllOverlays()
            return
        }
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
            
        val packageName = event.packageName?.toString() ?: return
        currentPackage = packageName
        
        // 1. Ignore system noise
        if (packageName == "com.android.systemui" || packageName == "android" || packageName == "com.google.android.inputmethod.latin") {
            return 
        }

        // 2. Exempt Home & Settings
        if (packageName.contains("launcher") || packageName.contains("settings")) {
            hideAllOverlays()
            return
        }
        
        // 3. Ignore our own app
        if (packageName == "com.genesfi.focusgrow") return

        val status = SyncManager.currentStatus
        val remainingDoomSec = checkCloudDoomscroll(packageName)
        val isDoomscrollBlocked = remainingDoomSec > 0
        val isFocusing = status.state == "focusing"
        val isPrayerBreak = status.isPrayerBreak

        // Priority 1: Prayer Break - Block distracting apps for 15 minutes during prayer!
        if (isPrayerBreak && SyncManager.isAppRestricted(packageName)) {
            showPrayerBlockerPersistence(packageName)
            return
        }

        val domain = getTargetDomain(packageName)
        val cdStart = SyncManager.doomData?.optJSONObject(domain.replace(".", "_"))?.optLong("cooldownStart", 0L) ?: 0L
        val activePass = status.activePasses.find { SyncManager.isPackageMatch(packageName, it.domain) || it.domain.equals(packageName, ignoreCase = true) }

        // Priority 2: If cooldown is active, pass is ONLY valid if granted AFTER cooldown started!
        val isEmergencyPassValid = activePass != null && activePass.remainingSec > 0 && cdStart > 0 && activePass.lastGrantTime >= cdStart

        if (isEmergencyPassValid) {
            showFloatingTimerPersistence(packageName, activePass!!.remainingSec, "PASS")
            return
        }

        if (isDoomscrollBlocked) {
            doomRemainingSec = remainingDoomSec
            showBlockerPersistence(packageName, true)
            return
        }

        // Priority 3: Non-cooldown active pass allows browsing
        if (activePass != null && activePass.remainingSec > 0 && (System.currentTimeMillis() - activePass.lastGrantTime < 15 * 60 * 1000L)) {
            showFloatingTimerPersistence(packageName, activePass.remainingSec, "PASS")
            return
        }

        if (SyncManager.isAppRestricted(packageName)) {
            // StayFree-Grade Doomscroll Guard: ALWAYS require Session Allowance even when PC is OFF / IDLE!
            showBlockerPersistence(packageName, false)
        } else {
            hideAllOverlays()
        }
    }

    private fun tickTimers() {
        if (isServiceDisabled) {
            hideAllOverlays()
            return
        }
        val currentPkg = currentShowingPkg
        // Real-time auto-unblock when session is allowed on PC Extension!
        if (blockerLayout != null && currentPkg != null && !SyncManager.currentStatus.isPrayerBreak) {
            val domain = getTargetDomain(currentPkg)
            val cdStart = SyncManager.doomData?.optJSONObject(domain.replace(".", "_"))?.optLong("cooldownStart", 0L) ?: 0L
            val activePass = SyncManager.currentStatus.activePasses.find { SyncManager.isPackageMatch(currentPkg, it.domain) || it.domain.equals(currentPkg, ignoreCase = true) }
            val isPassValid = activePass != null && activePass.remainingSec > 0 && (cdStart == 0L || activePass.lastGrantTime >= cdStart) && (System.currentTimeMillis() - activePass.lastGrantTime < 15 * 60 * 1000L)
            if (isPassValid) {
                showFloatingTimerPersistence(currentPkg, activePass!!.remainingSec, "PASS")
                return
            }
        }

        val type = currentShowingType ?: return
        val pkg = currentShowingPkg ?: return

        if (type == "prayer_block") {
            val tv = blockerLayout?.findViewWithTag<TextView>("prayer_timer") ?: return
            val sec = SyncManager.currentStatus.prayerBreakSec
            if (sec > 0 && SyncManager.currentStatus.isPrayerBreak) {
                tv.text = String.format(Locale.US, "%02d:%02d", sec / 60, sec % 60)
            } else {
                hideAllOverlays()
            }
            return
        } else if (type == "doom_block") {
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
                secondsLeft = SyncManager.currentStatus.activePasses.find { SyncManager.isPackageMatch(pkg, it.domain) || it.domain.equals(pkg, ignoreCase = true) }?.remainingSec ?: 0
            } else {
                val domain = getTargetDomain(pkg)
                val info = SyncManager.doomData?.optJSONObject(domain.replace(".", "_")) ?: return
                val limit = SyncManager.getAppLimit(domain) * 60
                secondsLeft = limit - info.optInt("totalSecThisSession", 0)
            }

            if (secondsLeft > 0) {
                tv.text = String.format(Locale.US, "%02d:%02d", secondsLeft / 60, secondsLeft % 60)
            } else {
                // Pass or session limit expired! Trigger Cooldown Active
                val targetDomain = getTargetDomain(pkg)
                val now = System.currentTimeMillis()
                val data = SyncManager.doomData ?: JSONObject()
                val key = targetDomain.replace(".", "_")
                val info = data.optJSONObject(key) ?: JSONObject()
                info.put("cooldownStart", now)
                info.put("isPassActive", false)
                info.put("totalSecThisSession", 0)
                data.put(key, info)
                SyncManager.doomData = data

                val updatedPasses = SyncManager.currentStatus.activePasses.filterNot { SyncManager.isPackageMatch(pkg, it.domain) || it.domain.equals(pkg, ignoreCase = true) }
                SyncManager.currentStatus = SyncManager.currentStatus.copy(activePasses = updatedPasses)

                val cooldownMins = SyncManager.getAppCooldown(targetDomain)
                doomRemainingSec = cooldownMins * 60

                SyncService.instance?.pushLocalStateToCloud()
                showBlockerPersistence(pkg, true)
            }
        }
    }

    private fun getTargetDomain(pkg: String): String {
        return SyncManager.getMatchedDomain(pkg) ?: pkg
    }

    // StayFree-Grade Draggable Floating Pill Widget
    private fun showFloatingTimerPersistence(pkg: String, seconds: Int, label: String) {
        if (currentShowingType == label && currentShowingPkg == pkg) return
        
        hideAllOverlays()
        currentShowingType = label
        currentShowingPkg = pkg

        val isLimit = (label == "LIMIT")
        val accentColor = if (isLimit) Color.parseColor("#38BDF8") else Color.parseColor("#10B981")

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = 40
            y = 140
        }

        val pill = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(32, 18, 32, 18)

            background = GradientDrawable().apply {
                setColor(Color.parseColor("#EE0B0F19"))
                cornerRadius = 100f
                setStroke(2, accentColor)
            }

            // Glowing Pulse Dot
            addView(View(context).apply {
                layoutParams = LinearLayout.LayoutParams(16, 16).apply { marginEnd = 16 }
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(accentColor)
                }
            })

            // Label (PASS / LIMIT)
            addView(TextView(context).apply {
                text = "$label:"
                setTextColor(accentColor)
                textSize = 11f
                typeface = Typeface.DEFAULT_BOLD
                letterSpacing = 0.05f
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = 12 }
            })

            // Countdown Timer (Monospace)
            addView(TextView(context).apply {
                tag = "timer_text"
                text = String.format(Locale.US, "%02d:%02d", seconds / 60, seconds % 60)
                setTextColor(Color.WHITE)
                textSize = 14f
                typeface = Typeface.MONOSPACE
            })

            // Dismiss (X)
            addView(TextView(context).apply {
                text = "✕"
                setTextColor(Color.parseColor("#64748B"))
                textSize = 12f
                setPadding(16, 0, 0, 0)
                setOnClickListener { hideAllOverlays() }
            })

            // Draggable Support
            var initialX = 0
            var initialY = 0
            var initialTouchX = 0f
            var initialTouchY = 0f

            setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX - (event.rawX - initialTouchX).toInt()
                        params.y = initialY + (event.rawY - initialTouchY).toInt()
                        try { windowManager?.updateViewLayout(this, params) } catch (e: Exception) {}
                        true
                    }
                    else -> false
                }
            }
        }
        
        try {
            windowManager?.addView(pill, params)
            passTimerLayout = pill
        } catch (e: Exception) {}
    }

    private fun showBlockerPersistence(pkg: String, isDoom: Boolean) {
        val targetType = if (isDoom) "doom_block" else "focus_block"
        if (currentShowingType == targetType && currentShowingPkg == pkg && blockerLayout != null) {
            return
        }

        hideAllOverlays()
        currentShowingType = targetType
        currentShowingPkg = pkg

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { flags = flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv() }

        val layout = createBlockerLayout(pkg, isDoom)
        try {
            windowManager?.addView(layout, params)
            blockerLayout = layout
        } catch (e: Exception) {
            backToHome()
        }
    }

    private fun showPrayerBlockerPersistence(pkg: String) {
        if (currentShowingType == "prayer_block" && currentShowingPkg == pkg && blockerLayout != null) {
            return
        }

        hideAllOverlays()
        currentShowingType = "prayer_block"
        currentShowingPkg = pkg

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { flags = flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv() }

        val layout = createPrayerBlockerLayout()
        try {
            windowManager?.addView(layout, params)
            blockerLayout = layout
        } catch (e: Exception) {
            backToHome()
        }
    }

    fun hideAllOverlays() {
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

    // Exact 1-to-1 Replica of Chrome Extension Session Allowance Modal
    private fun createBlockerLayout(pkg: String, isDoom: Boolean): View {
        val isCooldown = (isDoom && doomRemainingSec > 0)
        val accentColor = if (isCooldown) Color.parseColor("#F43F5E") else Color.parseColor("#60CDFF")
        val targetDomain = getTargetDomain(pkg) ?: pkg

        // Root Dim Backdrop
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#E60B0E14"))
            isClickable = true
            isFocusable = true
        }

        // Center Modal Card
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#181920"))
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), Color.parseColor("#26FFFFFF"))
            }
            setPadding(dp(22), dp(20), dp(22), dp(20))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
                setMargins(dp(20), dp(20), dp(20), dp(20))
            }
        }

        // 1. Header (Title, Subtitle, Close Button)
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, dp(14)) }
        }

        val headerTextCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val titleTv = TextView(this).apply {
            text = if (isCooldown) "Cooldown Active" else "Session Allowance"
            textSize = 16.5f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = -0.01f
        }
        val subtitleTv = TextView(this).apply {
            text = targetDomain
            textSize = 12f
            setTextColor(accentColor)
            setPadding(0, dp(2), 0, 0)
        }
        headerTextCol.addView(titleTv)
        headerTextCol.addView(subtitleTv)

        val closeBtn = TextView(this).apply {
            text = "✕"
            textSize = 18f
            setTextColor(Color.parseColor("#64748B"))
            setPadding(dp(8), dp(4), dp(4), dp(4))
            setOnClickListener { backToHome() }
        }
        header.addView(headerTextCol)
        header.addView(closeBtn)
        card.addView(header)

        // 2. Focus Wisdom Quote Card with Left Color Border
        val quote = if (isCooldown) REST_QUOTES.random() else FOCUS_QUOTES.random()
        val quoteRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#08FFFFFF"))
                cornerRadius = dp(8).toFloat()
                setStroke(dp(1), Color.parseColor("#14FFFFFF"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, dp(14)) }
        }

        val leftBar = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(3), LinearLayout.LayoutParams.MATCH_PARENT)
            setBackgroundColor(accentColor)
        }
        val quoteInner = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(10), dp(12), dp(10))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val quoteText = TextView(this).apply {
            text = "“${quote.text}”"
            textSize = 12f
            setTextColor(Color.parseColor("#CBD5E1"))
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.ITALIC)
            setLineSpacing(dp(3).toFloat(), 1f)
        }
        val quoteAuthor = TextView(this).apply {
            text = "— ${quote.author}"
            textSize = 10.5f
            setTextColor(Color.parseColor("#64748B"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.END
            setPadding(0, dp(4), 0, 0)
        }
        quoteInner.addView(quoteText)
        quoteInner.addView(quoteAuthor)
        quoteRow.addView(leftBar)
        quoteRow.addView(quoteInner)
        card.addView(quoteRow)

        // 3. Body: Stepper or Cooldown
        if (!isCooldown) {
            var selectedMinutes = SyncManager.getAppLimit(targetDomain)

            val stepperBox = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#111217"))
                    cornerRadius = dp(14).toFloat()
                    setStroke(dp(1), Color.parseColor("#1AFFFFFF"))
                }
                setPadding(dp(16), dp(12), dp(16), dp(12))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, 0, dp(14)) }
            }

            val stepMinus = TextView(this).apply {
                text = "−"
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#E2E8F0"))
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#222430"))
                    setStroke(dp(1), Color.parseColor("#15FFFFFF"))
                }
                layoutParams = LinearLayout.LayoutParams(dp(36), dp(36))
            }

            val stepperCenter = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val stepperNumberRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
            }

            val numberTv = TextView(this).apply {
                text = selectedMinutes.toString()
                textSize = 36f
                setTextColor(Color.parseColor("#60CDFF"))
                typeface = Typeface.DEFAULT_BOLD
            }

            val minLabel = TextView(this).apply {
                text = "min"
                textSize = 14f
                setTextColor(Color.parseColor("#64748B"))
                typeface = Typeface.DEFAULT_BOLD
                setPadding(dp(6), dp(10), 0, 0)
            }
            stepperNumberRow.addView(numberTv)
            stepperNumberRow.addView(minLabel)

            val subLabel = TextView(this).apply {
                text = "Active screen allowance"
                textSize = 11f
                setTextColor(Color.parseColor("#64748B"))
            }
            stepperCenter.addView(stepperNumberRow)
            stepperCenter.addView(subLabel)

            val stepPlus = TextView(this).apply {
                text = "+"
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#E2E8F0"))
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#222430"))
                    setStroke(dp(1), Color.parseColor("#15FFFFFF"))
                }
                layoutParams = LinearLayout.LayoutParams(dp(36), dp(36))
            }

            stepperBox.addView(stepMinus)
            stepperBox.addView(stepperCenter)
            stepperBox.addView(stepPlus)
            card.addView(stepperBox)

            // 4. Quick Selection Chips (1m, 5m, 15m, 30m, 1h)
            val chipRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(36)
                ).apply { setMargins(0, 0, 0, dp(16)) }
            }

            val chips = listOf(
                Pair("1m", 1),
                Pair("5m", 5),
                Pair("15m", 15),
                Pair("30m", 30),
                Pair("1h", 60)
            )
            val chipViews = mutableListOf<Pair<TextView, Int>>()

            fun updateChipsUI(mins: Int) {
                selectedMinutes = mins
                numberTv.text = mins.toString()
                chipViews.forEach { (view, m) ->
                    val isActive = (m == mins)
                    view.background = GradientDrawable().apply {
                        setColor(if (isActive) Color.parseColor("#2460CDFF") else Color.parseColor("#222430"))
                        cornerRadius = dp(8).toFloat()
                        setStroke(if (isActive) dp(1) else 0, if (isActive) Color.parseColor("#60CDFF") else Color.TRANSPARENT)
                    }
                    view.setTextColor(if (isActive) Color.parseColor("#60CDFF") else Color.parseColor("#94A3B8"))
                }
            }

            chips.forEach { (label, mins) ->
                val chip = TextView(this).apply {
                    text = label
                    textSize = 12f
                    typeface = Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f).apply {
                        setMargins(dp(3), 0, dp(3), 0)
                    }
                    setOnClickListener { updateChipsUI(mins) }
                }
                chipViews.add(Pair(chip, mins))
                chipRow.addView(chip)
            }
            card.addView(chipRow)

            stepMinus.setOnClickListener {
                val delta = if (selectedMinutes <= 5) 1 else 5
                val next = (selectedMinutes - delta).coerceAtLeast(1)
                updateChipsUI(next)
            }

            stepPlus.setOnClickListener {
                val delta = if (selectedMinutes < 5) 1 else 5
                val next = (selectedMinutes + delta).coerceAtMost(240)
                updateChipsUI(next)
            }

            updateChipsUI(5)

            // 5. Begin Browsing Primary Action Button
            val beginBtn = Button(this).apply {
                text = "Begin Browsing"
                textSize = 13.5f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#041A2F"))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#60CDFF"))
                    cornerRadius = dp(10).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(44)
                ).apply { setMargins(0, 0, 0, dp(8)) }

                setOnClickListener {
                    SyncService.grantPass(targetDomain, selectedMinutes)
                    showFloatingTimerPersistence(packageName, selectedMinutes * 60, "PASS")
                }
            }
            card.addView(beginBtn)

            // 6. Leave Site Footer Link
            val leaveBtn = TextView(this).apply {
                text = "Leave Site"
                textSize = 12f
                setTextColor(Color.parseColor("#64748B"))
                gravity = Gravity.CENTER
                setPadding(0, dp(6), 0, dp(6))
                setOnClickListener { backToHome() }
            }
            card.addView(leaveBtn)

        } else {
            // Cooldown Active Section
            val timerTv = TextView(this).apply {
                tag = "doom_timer"
                text = String.format(Locale.US, "%02d:%02d", doomRemainingSec / 60, doomRemainingSec % 60)
                textSize = 50f
                setTextColor(Color.WHITE)
                typeface = Typeface.create("sans-serif-black", Typeface.NORMAL)
                gravity = Gravity.CENTER
                setPadding(0, dp(8), 0, dp(4))
            }
            val descTv = TextView(this).apply {
                text = "Browsing is paused until this timer expires."
                textSize = 12f
                setTextColor(Color.parseColor("#94A3B8"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, dp(16))
            }
            card.addView(timerTv)
            card.addView(descTv)

            val passesLeft = SyncManager.currentStatus.activePasses.find { it.domain == targetDomain }?.passesLeft ?: 2
            if (passesLeft > 0) {
                val emergencyBtn = Button(this).apply {
                    text = "5m Emergency Pass ($passesLeft left)"
                    textSize = 13f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#38BDF8"))
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#1F38BDF8"))
                        cornerRadius = dp(10).toFloat()
                        setStroke(dp(1), Color.parseColor("#5938BDF8"))
                    }
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        dp(44)
                    ).apply { setMargins(0, 0, 0, dp(26)) }

                    setOnClickListener {
                        SyncService.grantPass(targetDomain, 5)
                        hideAllOverlays()
                    }
                }
                card.addView(emergencyBtn)
            }

            val closeAppBtn = TextView(this).apply {
                text = "Close App"
                textSize = 12f
                setTextColor(Color.parseColor("#94A3B8"))
                gravity = Gravity.CENTER
                setPadding(0, dp(10), 0, dp(10))
                setOnClickListener { backToHome() }
            }
            card.addView(closeAppBtn)
        }

        root.addView(card)
        return root
    }

    private fun createPrayerBlockerLayout(): View {
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#EE060A10"))
        }

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0E1A16"))
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), Color.parseColor("#2510B981"))
            }
            setPadding(dp(22), dp(24), dp(22), dp(20))
            layoutParams = FrameLayout.LayoutParams(
                dp(340),
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply { gravity = Gravity.CENTER }
        }

        // 1. Icon & Header
        val iconBadge = TextView(this).apply {
            text = "🕌"
            textSize = 34f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(4))
        }
        card.addView(iconBadge)

        val titleTv = TextView(this).apply {
            text = "WAKTU SHOLAT TIBA"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#10B981"))
            gravity = Gravity.CENTER
            letterSpacing = 0.05f
        }
        card.addView(titleTv)

        val subTitleTv = TextView(this).apply {
            text = "Istirahat Sholat 15 Menit"
            textSize = 12f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            setPadding(0, dp(2), 0, dp(14))
        }
        card.addView(subTitleTv)

        // 2. Large Digital Countdown Timer
        val timerSec = SyncManager.currentStatus.prayerBreakSec
        val timerTv = TextView(this).apply {
            tag = "prayer_timer"
            text = String.format(Locale.US, "%02d:%02d", timerSec / 60, timerSec % 60)
            textSize = 48f
            setTextColor(Color.WHITE)
            typeface = Typeface.create("sans-serif-black", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(12))
        }
        card.addView(timerTv)

        // 3. Wisdom / Islamic Advice Card
        val quoteBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0A1412"))
                cornerRadius = dp(12).toFloat()
                setStroke(dp(1), Color.parseColor("#1A10B981"))
            }
            setPadding(dp(14), dp(12), dp(14), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, dp(18)) }
        }

        val quoteTv = TextView(this).apply {
            text = "\"Sesungguhnya shalat itu adalah fardhu yang ditentukan waktunya atas orang-orang yang beriman.\""
            textSize = 12f
            setTextColor(Color.parseColor("#CBD5E1"))
            setTypeface(typeface, Typeface.ITALIC)
            setLineSpacing(0f, 1.25f)
        }
        val quoteRef = TextView(this).apply {
            text = "— QS. An-Nisa: 103"
            textSize = 10f
            setTextColor(Color.parseColor("#10B981"))
            gravity = Gravity.END
            setPadding(0, dp(6), 0, 0)
        }
        quoteBox.addView(quoteTv)
        quoteBox.addView(quoteRef)
        card.addView(quoteBox)

        // 4. Close App Button
        val closeBtn = Button(this).apply {
            text = "Tutup Aplikasi & Ambil Wudhu"
            textSize = 13.5f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#042217"))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#10B981"))
                cornerRadius = dp(10).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(44)
            )
            setOnClickListener { backToHome() }
        }
        card.addView(closeBtn)

        root.addView(card)
        return root
    }

    private fun backToHome() {
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(intent)
        hideAllOverlays()
    }

    private fun checkCloudDoomscroll(pkg: String): Int {
        val tracker = SyncManager.doomData ?: return 0
        val targetDomain = getTargetDomain(pkg)
        val key = targetDomain.replace(".", "_")
        val info = tracker.optJSONObject(targetDomain) ?: tracker.optJSONObject(key) ?: return 0
        val cooldownStart = if (info.has("cooldownStart")) info.optLong("cooldownStart") else info.optLong("lastLimitReached", 0)
        if (cooldownStart > 0) {
            val cooldownMins = SyncManager.getAppCooldown(targetDomain)
            val elapsedSec = (System.currentTimeMillis() - cooldownStart) / 1000
            val remaining = (cooldownMins * 60) - elapsedSec.toInt()
            if (remaining > 0) return remaining
        }
        return 0
    }

    override fun onInterrupt() {}
    override fun onDestroy() {
        super.onDestroy()
        hideAllOverlays()
        instance = null
    }
}

