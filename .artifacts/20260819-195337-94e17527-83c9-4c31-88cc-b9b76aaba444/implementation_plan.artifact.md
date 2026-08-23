# Implementation Plan - Fix Android Blocker Sync and Emergency Pass

The goal is to fix the issue where the Android blocking overlay does not disappear after an Emergency Pass is granted, and to ensure that Doomscroll Cooldowns are correctly enforced on Android (disabling Emergency Passes).

## Problem Analysis
1.  **Inconsistent Matching**: The logic to match Android package names to domains (e.g., `com.zhiliaoapp.musically` for TikTok) is failing for apps that don't have the domain name in their package string. (Fixed in previous step)
2.  **Delayed State Update**: When a pass is granted on the phone, the UI relies on the next poll. (Fixed in previous step)
3.  **Local/Cloud Sync Mismatch**: `SyncService` now merges `activePasses` from both Local and Cloud. (Fixed in previous step)
4.  **Doomscroll Cooldown Bypass**: Currently, Android detects the Doomscroll state but still shows the "Emergency Pass" buttons, allowing the user to bypass the cooldown. Doomscroll cooldowns should NOT allow Emergency Passes.
5.  **Missing Cooldown Timer**: The Android blocker doesn't show the remaining cooldown time for Doomscroll limits.

## Proposed Changes

### [Android] Enforce Doomscroll Cooldown

#### [FocusBlockerService.kt](file:///F:/Android Project/FocusGrow/android/app/src/main/java/com/genesfi/focusgrow/FocusBlockerService.kt)
- Update `showBlocker` to explicitly disable Emergency Pass UI when `isDoomscroll` is true.
- Add a countdown timer to the "Doomscroll Limit" screen using the `cooldownStart` data from Firebase.
- Update `checkCloudDoomscroll` to return the remaining seconds instead of just a boolean, so the UI can display it.

---

## Detailed Logic Changes

### Cooldown Timer in Blocker
When `isDoomscroll` is true, we should:
1.  Hide the "USE EMERGENCY PASS" section.
2.  Show a "COOLDOWN ACTIVE" text with a timer (e.g., `26:48`).
3.  Use a Runnable/Handler to update this timer every second while the blocker is showing.

---

## Verification Plan

### Manual Verification
1.  **Trigger Doomscroll on PC**: Reach the limit on Facebook/TikTok on the browser until the cooldown starts.
2.  **Open App on Android**: Open the same app on Android. Verify the blocker says "Doomscroll Limit" and DOES NOT show the 5m/10m/15m buttons.
3.  **Check Timer**: Verify the cooldown timer on Android matches the one on the PC/Extension.
