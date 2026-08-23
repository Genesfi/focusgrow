# Task Management

- [x] Fix Android Blocker Sync and Emergency Pass
	- [x] Research root cause of sync failure
	- [x] Identify domain/package mismatch (TikTok case)
	- [x] Identify race condition in blocker re-showing
	- [x] Propose implementation plan
	- [x] Implement robust `isPackageMatch` in `SyncManager`
	- [x] Implement optimistic updates and data merging in `SyncService`
	- [x] Add grant-cooldown in `FocusBlockerService`
	- [x] Verify fix with TikTok and other apps
- [x] Enforce Doomscroll Cooldown on Android
	- [x] Modify `checkCloudDoomscroll` to return remaining time
	- [x] Update `showBlocker` to disable passes during Doomscroll
	- [x] Add countdown timer UI for Doomscroll limit
	- [x] Verify cooldown enforcement
