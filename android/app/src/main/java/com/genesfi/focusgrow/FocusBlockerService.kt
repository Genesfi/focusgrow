package com.genesfi.focusgrow

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

class FocusBlockerService : AccessibilityService() {

    companion object {
        var instance: FocusBlockerService? = null

        var isServiceDisabled: Boolean
            get() = FocusBlockerManager.isServiceDisabled
            set(value) {
                FocusBlockerManager.isServiceDisabled = value
            }

        var currentPackage: String?
            get() = FocusBlockerManager.currentPackage
            set(value) {
                FocusBlockerManager.currentPackage = value
            }

        fun disableSelfFromAnywhere() {
            try {
                instance?.disableSelf()
            } catch (e: Exception) {
                android.util.Log.e("FocusBlocker", "Error disabling self: ${e.message}")
            }
        }
    }

    private var handler: Handler? = null
    private val timerRunnable = object : Runnable {
        override fun run() {
            FocusBlockerManager.tickTimers(this@FocusBlockerService)
            handler?.postDelayed(this, 1000)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        FocusBlockerManager.isServiceDisabled = false
        SyncManager.init(this)
        handler = Handler(Looper.getMainLooper())
        handler?.post(timerRunnable)
        android.util.Log.d("FocusBlocker", "Accessibility Service Connected (StayFree Hybrid v3)")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val packageName = event.packageName?.toString() ?: return
        FocusBlockerManager.handleAppSwitch(this, packageName, fromAccessibility = true)
    }

    fun hideAllOverlays() {
        FocusBlockerManager.hideAllOverlays()
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        FocusBlockerManager.hideAllOverlays()
        handler?.removeCallbacks(timerRunnable)
        instance = null
    }
}
