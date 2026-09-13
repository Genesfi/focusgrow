package com.genesfi.focusgrow

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.*
import org.json.JSONObject
import java.util.Locale

object FocusBlockerManager {

    var currentPackage: String? = null
    var isServiceDisabled: Boolean = false

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

    private var currentShowingType: String? = null // "doom_block", "focus_block", "PASS", "LIMIT", "prayer_block"
    private var currentShowingPkg: String? = null

    private var doomRemainingSec: Int = 0
    private fun dp(context: Context, v: Int): Int = (v * context.resources.displayMetrics.density).toInt()

    private fun getWindowManager(context: Context): WindowManager {
        if (windowManager == null) {
            windowManager = context.applicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        }
        return windowManager!!
    }

    fun handleAppSwitch(context: Context, packageName: String, fromAccessibility: Boolean) {
        if (isServiceDisabled) {
            hideAllOverlays()
            return
        }

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
        val isPrayerBreak = status.isPrayerBreak

        // Priority 1: Prayer Break - Block distracting apps for 15 minutes during prayer!
        if (isPrayerBreak && SyncManager.isAppRestricted(packageName)) {
            showPrayerBlockerPersistence(context, packageName, fromAccessibility)
            return
        }

        val domain = getTargetDomain(packageName)
        val cdStart = SyncManager.doomData?.optJSONObject(domain.replace(".", "_"))?.optLong("cooldownStart", 0L) ?: 0L
        val activePass = status.activePasses.find { SyncManager.isPackageMatch(packageName, it.domain) || it.domain.equals(packageName, ignoreCase = true) }

        // Priority 2: If cooldown is active, pass is ONLY valid if granted AFTER cooldown started!
        val isEmergencyPassValid = activePass != null && activePass.remainingSec > 0 && cdStart > 0 && activePass.lastGrantTime >= cdStart

        if (isEmergencyPassValid) {
            showFloatingTimerPersistence(context, packageName, activePass!!.remainingSec, "PASS", fromAccessibility)
            return
        }

        if (isDoomscrollBlocked) {
            doomRemainingSec = remainingDoomSec
            showBlockerPersistence(context, packageName, true, fromAccessibility)
            return
        }

        // Priority 3: Non-cooldown active pass allows browsing
        if (activePass != null && activePass.remainingSec > 0 && (System.currentTimeMillis() - activePass.lastGrantTime < 15 * 60 * 1000L)) {
            showFloatingTimerPersistence(context, packageName, activePass.remainingSec, "PASS", fromAccessibility)
            return
        }

        if (SyncManager.isAppRestricted(packageName)) {
            showBlockerPersistence(context, packageName, false, fromAccessibility)
        } else {
            hideAllOverlays()
        }
    }

    fun tickTimers(context: Context? = null) {
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
            if (isPassValid && context != null) {
                val fromA11y = FocusBlockerService.instance != null
                showFloatingTimerPersistence(context, currentPkg, activePass!!.remainingSec, "PASS", fromA11y)
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
                if (context != null) {
                    val fromA11y = FocusBlockerService.instance != null
                    showBlockerPersistence(context, pkg, true, fromA11y)
                }
            }
        }
    }

    private fun getOverlayWindowType(fromAccessibility: Boolean): Int {
        return if (fromAccessibility && FocusBlockerService.instance != null) {
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
    }

    fun showFloatingTimerPersistence(context: Context, pkg: String, seconds: Int, label: String, fromAccessibility: Boolean) {
        if (currentShowingType == label && currentShowingPkg == pkg) return

        hideAllOverlays()
        currentShowingType = label
        currentShowingPkg = pkg

        val isLimit = (label == "LIMIT")
        val accentColor = if (isLimit) Color.parseColor("#38BDF8") else Color.parseColor("#10B981")

        val wm = getWindowManager(context)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            getOverlayWindowType(fromAccessibility),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = 40
            y = 140
        }

        val pill = LinearLayout(context).apply {
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

            // Countdown Timer
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
                        try { wm.updateViewLayout(this, params) } catch (e: Exception) {}
                        true
                    }
                    else -> false
                }
            }
        }

        try {
            wm.addView(pill, params)
            passTimerLayout = pill
        } catch (e: Exception) {}
    }

    fun showBlockerPersistence(context: Context, pkg: String, isDoom: Boolean, fromAccessibility: Boolean) {
        val targetType = if (isDoom) "doom_block" else "focus_block"
        if (currentShowingType == targetType && currentShowingPkg == pkg && blockerLayout != null) {
            return
        }

        hideAllOverlays()
        currentShowingType = targetType
        currentShowingPkg = pkg

        val wm = getWindowManager(context)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            getOverlayWindowType(fromAccessibility),
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        val layout = createBlockerLayout(context, pkg, isDoom, fromAccessibility)
        try {
            wm.addView(layout, params)
            blockerLayout = layout
            layout.isFocusableInTouchMode = true
            layout.requestFocus()
        } catch (e: Exception) {
            backToHome(context)
        }
    }

    fun showPrayerBlockerPersistence(context: Context, pkg: String, fromAccessibility: Boolean) {
        if (currentShowingType == "prayer_block" && currentShowingPkg == pkg && blockerLayout != null) {
            return
        }

        hideAllOverlays()
        currentShowingType = "prayer_block"
        currentShowingPkg = pkg

        val wm = getWindowManager(context)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            getOverlayWindowType(fromAccessibility),
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        val layout = createPrayerBlockerLayout(context)
        try {
            wm.addView(layout, params)
            blockerLayout = layout
            layout.isFocusableInTouchMode = true
            layout.requestFocus()
        } catch (e: Exception) {
            backToHome(context)
        }
    }

    fun hideAllOverlays() {
        if (blockerLayout != null && windowManager != null) {
            try { windowManager?.removeView(blockerLayout) } catch (e: Exception) {}
            blockerLayout = null
        }
        if (passTimerLayout != null && windowManager != null) {
            try { windowManager?.removeView(passTimerLayout) } catch (e: Exception) {}
            passTimerLayout = null
        }
        currentShowingType = null
        currentShowingPkg = null
    }

    private fun createBlockerLayout(context: Context, pkg: String, isDoom: Boolean, fromAccessibility: Boolean): View {
        val isCooldown = (isDoom && doomRemainingSec > 0)
        val accentColor = if (isCooldown) Color.parseColor("#F43F5E") else Color.parseColor("#60CDFF")
        val targetDomain = getTargetDomain(pkg)

        val root = object : FrameLayout(context) {
            override fun dispatchKeyEvent(event: KeyEvent): Boolean {
                if (event.keyCode == KeyEvent.KEYCODE_BACK) {
                    if (event.action == KeyEvent.ACTION_UP) {
                        backToHome(context)
                    }
                    return true
                }
                return super.dispatchKeyEvent(event)
            }
        }.apply {
            setBackgroundColor(Color.parseColor("#E60B0E14"))
            isClickable = true
            isFocusable = true
            isFocusableInTouchMode = true
            setOnClickListener { backToHome(context) }
        }

        val card = LinearLayout(context).apply {
            isClickable = true
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#181920"))
                cornerRadius = dp(context, 20).toFloat()
                setStroke(dp(context, 1), Color.parseColor("#26FFFFFF"))
            }
            setPadding(dp(context, 22), dp(context, 20), dp(context, 22), dp(context, 20))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
                setMargins(dp(context, 20), dp(context, 20), dp(context, 20), dp(context, 20))
            }
        }

        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, dp(context, 14)) }
        }

        val headerTextCol = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val titleTv = TextView(context).apply {
            text = if (isCooldown) "Cooldown Active" else "Session Allowance"
            textSize = 16.5f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = -0.01f
        }
        val subtitleTv = TextView(context).apply {
            text = targetDomain
            textSize = 12f
            setTextColor(accentColor)
            setPadding(0, dp(context, 2), 0, 0)
        }
        headerTextCol.addView(titleTv)
        headerTextCol.addView(subtitleTv)

        val closeBtn = TextView(context).apply {
            text = "✕"
            textSize = 18f
            setTextColor(Color.parseColor("#64748B"))
            setPadding(dp(context, 8), dp(context, 4), dp(context, 4), dp(context, 4))
            setOnClickListener { backToHome(context) }
        }
        header.addView(headerTextCol)
        header.addView(closeBtn)
        card.addView(header)

        val quote = if (isCooldown) REST_QUOTES.random() else FOCUS_QUOTES.random()
        val quoteRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#08FFFFFF"))
                cornerRadius = dp(context, 8).toFloat()
                setStroke(dp(context, 1), Color.parseColor("#14FFFFFF"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, dp(context, 14)) }
        }

        val leftBar = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(context, 3), LinearLayout.LayoutParams.MATCH_PARENT)
            setBackgroundColor(accentColor)
        }
        val quoteInner = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(context, 12), dp(context, 10), dp(context, 12), dp(context, 10))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val quoteText = TextView(context).apply {
            text = "“${quote.text}”"
            textSize = 12f
            setTextColor(Color.parseColor("#CBD5E1"))
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.ITALIC)
            setLineSpacing(dp(context, 3).toFloat(), 1f)
        }
        val quoteAuthor = TextView(context).apply {
            text = "— ${quote.author}"
            textSize = 10.5f
            setTextColor(Color.parseColor("#64748B"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.END
            setPadding(0, dp(context, 4), 0, 0)
        }
        quoteInner.addView(quoteText)
        quoteInner.addView(quoteAuthor)
        quoteRow.addView(leftBar)
        quoteRow.addView(quoteInner)
        card.addView(quoteRow)

        if (!isCooldown) {
            var selectedMinutes = SyncManager.getAppLimit(targetDomain)

            val stepperBox = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#111217"))
                    cornerRadius = dp(context, 14).toFloat()
                    setStroke(dp(context, 1), Color.parseColor("#1AFFFFFF"))
                }
                setPadding(dp(context, 16), dp(context, 12), dp(context, 16), dp(context, 12))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, 0, dp(context, 14)) }
            }

            val stepMinus = TextView(context).apply {
                text = "−"
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#E2E8F0"))
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#222430"))
                    setStroke(dp(context, 1), Color.parseColor("#15FFFFFF"))
                }
                layoutParams = LinearLayout.LayoutParams(dp(context, 36), dp(context, 36))
            }

            val stepperCenter = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val stepperNumberRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
            }

            val numberTv = TextView(context).apply {
                text = selectedMinutes.toString()
                textSize = 36f
                setTextColor(Color.parseColor("#60CDFF"))
                typeface = Typeface.DEFAULT_BOLD
            }

            val minLabel = TextView(context).apply {
                text = "min"
                textSize = 14f
                setTextColor(Color.parseColor("#64748B"))
                typeface = Typeface.DEFAULT_BOLD
                setPadding(dp(context, 6), dp(context, 10), 0, 0)
            }
            stepperNumberRow.addView(numberTv)
            stepperNumberRow.addView(minLabel)

            val subLabel = TextView(context).apply {
                text = "Active screen allowance"
                textSize = 11f
                setTextColor(Color.parseColor("#64748B"))
            }
            stepperCenter.addView(stepperNumberRow)
            stepperCenter.addView(subLabel)

            val stepPlus = TextView(context).apply {
                text = "+"
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#E2E8F0"))
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#222430"))
                    setStroke(dp(context, 1), Color.parseColor("#15FFFFFF"))
                }
                layoutParams = LinearLayout.LayoutParams(dp(context, 36), dp(context, 36))
            }

            stepperBox.addView(stepMinus)
            stepperBox.addView(stepperCenter)
            stepperBox.addView(stepPlus)
            card.addView(stepperBox)

            val chipRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(context, 36)
                ).apply { setMargins(0, 0, 0, dp(context, 16)) }
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
                        cornerRadius = dp(context, 8).toFloat()
                        setStroke(if (isActive) dp(context, 1) else 0, if (isActive) Color.parseColor("#60CDFF") else Color.TRANSPARENT)
                    }
                    view.setTextColor(if (isActive) Color.parseColor("#60CDFF") else Color.parseColor("#94A3B8"))
                }
            }

            chips.forEach { (label, mins) ->
                val chip = TextView(context).apply {
                    text = label
                    textSize = 12f
                    typeface = Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f).apply {
                        setMargins(dp(context, 3), 0, dp(context, 3), 0)
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

            val beginBtn = Button(context).apply {
                text = "Begin Browsing"
                textSize = 13.5f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#041A2F"))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#60CDFF"))
                    cornerRadius = dp(context, 10).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(context, 44)
                ).apply { setMargins(0, 0, 0, dp(context, 8)) }

                setOnClickListener {
                    SyncService.grantPass(targetDomain, selectedMinutes)
                    showFloatingTimerPersistence(context, pkg, selectedMinutes * 60, "PASS", fromAccessibility)
                }
            }
            card.addView(beginBtn)

            val leaveBtn = TextView(context).apply {
                text = "Leave Site"
                textSize = 12f
                setTextColor(Color.parseColor("#64748B"))
                gravity = Gravity.CENTER
                setPadding(0, dp(context, 6), 0, dp(context, 6))
                setOnClickListener { backToHome(context) }
            }
            card.addView(leaveBtn)

        } else {
            val timerTv = TextView(context).apply {
                tag = "doom_timer"
                text = String.format(Locale.US, "%02d:%02d", doomRemainingSec / 60, doomRemainingSec % 60)
                textSize = 50f
                setTextColor(Color.WHITE)
                typeface = Typeface.create("sans-serif-black", Typeface.NORMAL)
                gravity = Gravity.CENTER
                setPadding(0, dp(context, 8), 0, dp(context, 4))
            }
            val descTv = TextView(context).apply {
                text = "Browsing is paused until this timer expires."
                textSize = 12f
                setTextColor(Color.parseColor("#94A3B8"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, dp(context, 16))
            }
            card.addView(timerTv)
            card.addView(descTv)

            val passesLeft = SyncManager.currentStatus.activePasses.find { it.domain == targetDomain }?.passesLeft ?: 2
            if (passesLeft > 0) {
                val emergencyBtn = Button(context).apply {
                    text = "5m Emergency Pass ($passesLeft left)"
                    textSize = 13f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#38BDF8"))
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#1F38BDF8"))
                        cornerRadius = dp(context, 10).toFloat()
                        setStroke(dp(context, 1), Color.parseColor("#5938BDF8"))
                    }
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        dp(context, 44)
                    ).apply { setMargins(0, 0, 0, dp(context, 26)) }

                    setOnClickListener {
                        SyncService.grantPass(targetDomain, 5)
                        hideAllOverlays()
                    }
                }
                card.addView(emergencyBtn)
            }

            val closeAppBtn = TextView(context).apply {
                text = "Close App"
                textSize = 12f
                setTextColor(Color.parseColor("#94A3B8"))
                gravity = Gravity.CENTER
                setPadding(0, dp(context, 10), 0, dp(context, 10))
                setOnClickListener { backToHome(context) }
            }
            card.addView(closeAppBtn)
        }

        root.addView(card)
        return root
    }

    private fun createPrayerBlockerLayout(context: Context): View {
        val root = object : FrameLayout(context) {
            override fun dispatchKeyEvent(event: KeyEvent): Boolean {
                if (event.keyCode == KeyEvent.KEYCODE_BACK) {
                    if (event.action == KeyEvent.ACTION_UP) {
                        backToHome(context)
                    }
                    return true
                }
                return super.dispatchKeyEvent(event)
            }
        }.apply {
            setBackgroundColor(Color.parseColor("#EE060A10"))
            isClickable = true
            isFocusable = true
            isFocusableInTouchMode = true
            setOnClickListener { backToHome(context) }
        }

        val card = LinearLayout(context).apply {
            isClickable = true
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0E1A16"))
                cornerRadius = dp(context, 20).toFloat()
                setStroke(dp(context, 1), Color.parseColor("#2510B981"))
            }
            setPadding(dp(context, 22), dp(context, 24), dp(context, 22), dp(context, 20))
            layoutParams = FrameLayout.LayoutParams(
                dp(context, 340),
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply { gravity = Gravity.CENTER }
        }

        val iconBadge = TextView(context).apply {
            text = "🕌"
            textSize = 34f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(context, 4))
        }
        card.addView(iconBadge)

        val titleTv = TextView(context).apply {
            text = "WAKTU SHOLAT TIBA"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#10B981"))
            gravity = Gravity.CENTER
            letterSpacing = 0.05f
        }
        card.addView(titleTv)

        val subTitleTv = TextView(context).apply {
            text = "Istirahat Sholat 15 Menit"
            textSize = 12f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            setPadding(0, dp(context, 2), 0, dp(context, 14))
        }
        card.addView(subTitleTv)

        val timerSec = SyncManager.currentStatus.prayerBreakSec
        val timerTv = TextView(context).apply {
            tag = "prayer_timer"
            text = String.format(Locale.US, "%02d:%02d", timerSec / 60, timerSec % 60)
            textSize = 48f
            setTextColor(Color.WHITE)
            typeface = Typeface.create("sans-serif-black", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(0, dp(context, 4), 0, dp(context, 12))
        }
        card.addView(timerTv)

        val quoteBox = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0A1412"))
                cornerRadius = dp(context, 12).toFloat()
                setStroke(dp(context, 1), Color.parseColor("#1A10B981"))
            }
            setPadding(dp(context, 14), dp(context, 12), dp(context, 14), dp(context, 12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, dp(context, 18)) }
        }

        val quoteTv = TextView(context).apply {
            text = "\"Sesungguhnya shalat itu adalah fardhu yang ditentukan waktunya atas orang-orang yang beriman.\""
            textSize = 12f
            setTextColor(Color.parseColor("#CBD5E1"))
            setTypeface(typeface, Typeface.ITALIC)
            setLineSpacing(0f, 1.25f)
        }
        val quoteRef = TextView(context).apply {
            text = "— QS. An-Nisa: 103"
            textSize = 10f
            setTextColor(Color.parseColor("#10B981"))
            gravity = Gravity.END
            setPadding(0, dp(context, 6), 0, 0)
        }
        quoteBox.addView(quoteTv)
        quoteBox.addView(quoteRef)
        card.addView(quoteBox)

        val closeBtn = Button(context).apply {
            text = "Tutup Aplikasi & Ambil Wudhu"
            textSize = 13.5f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#042217"))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#10B981"))
                cornerRadius = dp(context, 10).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(context, 44)
            )
            setOnClickListener { backToHome(context) }
        }
        card.addView(closeBtn)

        root.addView(card)
        return root
    }

    fun backToHome(context: Context) {
        try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            FocusBlockerService.instance?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
        }
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

    fun getTargetDomain(pkg: String): String {
        return SyncManager.getMatchedDomain(pkg) ?: pkg
    }
}
