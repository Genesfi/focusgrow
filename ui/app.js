// FocusGrow UI Logic, Notifications, Custom Local GIF Upload, Realtime Preview & Dynamic Scaling

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const setupView = document.getElementById('setup-view');
    const timerView = document.getElementById('timer-view');
    
    const pickerMinsInput = document.getElementById('picker-mins-input') || document.getElementById('picker-mins-display');
    const btnPickerUp = document.getElementById('btn-picker-up');
    const btnPickerDown = document.getElementById('btn-picker-down');

    const pickerBreakInput = document.getElementById('picker-break-input') || document.getElementById('picker-break-display');
    const btnBreakUp = document.getElementById('btn-break-up');
    const btnBreakDown = document.getElementById('btn-break-down');

    const pickerPeriodInput = document.getElementById('picker-period-input') || document.getElementById('picker-period-display');
    const btnPeriodUp = document.getElementById('btn-period-up');
    const btnPeriodDown = document.getElementById('btn-period-down');

    const breaksCountText = document.getElementById('breaks-count-text');
    const sessionPredictionBadge = document.getElementById('session-prediction-badge');
    const sessionPredictionText = document.getElementById('session-prediction-text');
    const predictionIconClock = document.getElementById('prediction-icon-clock');
    const predictionIconMoon = document.getElementById('prediction-icon-moon');
    const chkSkipBreaks = document.getElementById('chk-skip-breaks');
    const btnStartFocus = document.getElementById('btn-start-focus');

    const focusPeriodTitle = document.getElementById('focus-period-title');
    const activeTimerDisplay = document.getElementById('active-timer-display');
    const activeStatusLabel = document.getElementById('active-status-label');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const pauseIcon = document.getElementById('pause-icon');
    const playIcon = document.getElementById('play-icon');
    const upNextText = document.getElementById('up-next-text');
    const gaugeProgressBar = document.getElementById('gauge-progress-bar');
    const gaugeTicks = document.getElementById('gauge-ticks');

    const gaugeGifContainer = document.getElementById('gauge-gif-container');
    const gaugeGifImg = document.getElementById('gauge-gif-img');
    const cardGifContainer = document.getElementById('card-gif-container');
    const cardGifImg = document.getElementById('card-gif-img');

    const statYesterday = document.getElementById('stat-yesterday');
    const statGoalHours = document.getElementById('stat-goal-hours');
    const statStreak = document.getElementById('stat-streak');
    const statCompletedMins = document.getElementById('stat-completed-mins');
    const goalDonutFill = document.getElementById('goal-donut-fill');
    const goalDonutBg = document.getElementById('goal-donut-bg');
    const goalDonutContainer = document.getElementById('goal-donut-container');
    const donutTierBadge = document.getElementById('donut-tier-badge');

    const appListContainer = document.getElementById('app-list-container');
    const appSearchInput = document.getElementById('app-search-input');
    const btnRefreshApps = document.getElementById('btn-refresh-apps');

    // Modals & Settings
    const btnEditGoal = document.getElementById('btn-edit-goal');
    const goalModal = document.getElementById('goal-modal');
    const btnCloseGoalModal = document.getElementById('btn-close-goal-modal');

    const btnOptions = document.getElementById('btn-options');
    const optionsModal = document.getElementById('options-modal');
    const btnCloseOptionsModal = document.getElementById('btn-close-options-modal');
    const btnResetProgress = document.getElementById('btn-reset-progress');
    const btnClearWhitelist = document.getElementById('btn-clear-whitelist');
    const chkNotificationsToggle = document.getElementById('chk-notifications-toggle');

    const btnSelectCustomGif = document.getElementById('btn-select-custom-gif');
    const gifFileInput = document.getElementById('gif-file-input');
    const customGifNameDisplay = document.getElementById('custom-gif-name');
    const gifPreviewWrapper = document.getElementById('gif-preview-wrapper');
    const gifPreviewContainer = document.getElementById('gif-preview-container');
    const gifPreviewImg = document.getElementById('gif-preview-img');
    const gifStyleSection = document.getElementById('gif-style-section');
    const gifOpacityRow = document.getElementById('gif-opacity-row');
    const gifOpacitySlider = document.getElementById('gif-opacity-slider');
    const opacityLabel = document.getElementById('opacity-label');

    // Titlebar Controls
    const handleCloseClick = (e) => {
        const forceExit = !!(e.ctrlKey || e.metaKey);
        sendToCpp({ action: 'close', forceExit: forceExit });
    };

    document.getElementById('btn-min')?.addEventListener('click', () => sendToCpp({ action: 'minimize' }));
    document.getElementById('btn-max')?.addEventListener('click', () => sendToCpp({ action: 'maximize' }));
    document.getElementById('btn-close')?.addEventListener('click', handleCloseClick);
    document.getElementById('btn-pip-close')?.addEventListener('click', handleCloseClick);

    // Native Window Drag Handler
    const setupDragArea = (element) => {
        if (!element) return;
        element.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.target.closest('button, input, label, a, .switch, .window-controls, #gauge-clickable-area, .gauge-center, .gauge-container, .timer-time, .up-next-info, .circle-btn, .icon-btn, .timer-action-bar')) {
                sendToCpp({ action: 'startDrag' });
            }
        });
    };

    document.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                sendToCpp({ action: 'startResize', edge: handle.dataset.edge });
            }
        });
    });

    setupDragArea(document.getElementById('app-titlebar'));
    setupDragArea(document.querySelector('.titlebar'));
    setupDragArea(document.getElementById('focus-period-title'));
    setupDragArea(document.querySelector('#timer-view .card-header'));

    let isInitializingPip = false;

    document.querySelectorAll('.btn-pip-toggle, #btn-pip-restore').forEach(btn => {
        btn.addEventListener('click', () => {
            const isCurrentlyPip = document.body.classList.contains('pip-mode');
            const isEnteringPip = !isCurrentlyPip;

            // Enable cooldown to prevent capturing transition window resize (e.g. 960x660 / 857x677)
            isInitializingPip = true;
            setTimeout(() => { isInitializingPip = false; }, 1500);

            if (!isEnteringPip) {
                document.body.classList.remove('pip-mode');
            }

            let targetW = isEnteringPip ? (userData.pipWidth || 280) : undefined;
            let targetH = isEnteringPip ? (userData.pipHeight || 400) : undefined;
            if (targetW && (targetW > 480 || targetW < 160)) targetW = 280;
            if (targetH && (targetH > 550 || targetH < 200)) targetH = 400;

            if (isEnteringPip) {
                console.log(`[PIP] Entering PIP with target size: ${targetW}x${targetH}`);
            } else {
                console.log(`[PIP] Exiting PIP.`);
            }

            sendToCpp({
                action: 'togglePip',
                width: targetW,
                height: targetH,
                hideTaskbar: !!userData.hideTaskbarInPip
            });
        });
    });

    // Request Notification Permissions
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    // --- IndexedDB for Large GIF Storage ---
    const DB_NAME = 'FocusGrowDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'gifs';

    const gifDb = {
        _db: null,
        init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
                request.onsuccess = (e) => {
                    this._db = e.target.result;
                    resolve(this._db);
                };
                request.onerror = (e) => reject(e.target.error);
            });
        },
        async save(id, data) {
            if (!this._db) await this.init();
            return new Promise((resolve, reject) => {
                const tx = this._db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ id, data });
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        },
        async get(id) {
            if (!id) return null;
            if (!this._db) await this.init();
            return new Promise((resolve, reject) => {
                const tx = this._db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result ? request.result.data : null);
                request.onerror = (e) => reject(e.target.error);
            });
        },
        async delete(id) {
            if (!this._db) await this.init();
            return new Promise((resolve, reject) => {
                const tx = this._db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        },
        async clearAll() {
            if (!this._db) await this.init();
            return new Promise((resolve, reject) => {
                const tx = this._db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.clear();
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        }
    };

    // Persistent State Management
    const STORAGE_KEY = 'focusgrow_user_data_v1';
    const todayDateStr = new Date().toISOString().split('T')[0];
    const defaultIconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2360cdff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>`;
    const defaultVinylSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><defs><radialGradient id="grooveGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23111115"/><stop offset="25%" stop-color="%231a1a22"/><stop offset="35%" stop-color="%230d0d12"/><stop offset="50%" stop-color="%2322222a"/><stop offset="65%" stop-color="%230f0f14"/><stop offset="80%" stop-color="%231c1c24"/><stop offset="95%" stop-color="%230a0a0d"/><stop offset="100%" stop-color="%23050507"/></radialGradient><linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="45%" stop-color="rgba(255,255,255,0.02)"/><stop offset="50%" stop-color="rgba(255,255,255,0.22)"/><stop offset="55%" stop-color="rgba(255,255,255,0.02)"/><stop offset="100%" stop-color="rgba(255,255,255,0.12)"/></linearGradient><radialGradient id="centerLabel" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%231e293b"/><stop offset="70%" stop-color="%230f172a"/><stop offset="100%" stop-color="%23020617"/></radialGradient><linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2360cdff"/><stop offset="100%" stop-color="%233b82f6"/></linearGradient></defs><circle cx="250" cy="250" r="248" fill="url(%23grooveGrad)" stroke="%232d3748" stroke-width="2"/><circle cx="250" cy="250" r="230" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5"/><circle cx="250" cy="250" r="210" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="2"/><circle cx="250" cy="250" r="190" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1.5"/><circle cx="250" cy="250" r="170" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="2"/><circle cx="250" cy="250" r="150" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5"/><circle cx="250" cy="250" r="130" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="2"/><circle cx="250" cy="250" r="248" fill="url(%23sheen)"/><circle cx="250" cy="250" r="95" fill="url(%23centerLabel)" stroke="url(%23goldAccent)" stroke-width="3"/><circle cx="250" cy="250" r="88" fill="none" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4 4" stroke-width="1"/><g transform="translate(250, 215) scale(1.3)" opacity="0.9"><path d="M-6 12 A6 6 0 1 1 -18 12 A6 6 0 1 1 -6 12 M-6 12 L-6 -10 L10 -15 L10 5 A6 6 0 1 1 -2 5 A6 6 0 1 1 10 5 L10 -15 L-6 -10" fill="none" stroke="%2360cdff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g><text x="250" y="272" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="700" fill="%23ffffff" text-anchor="middle" letter-spacing="2">FOCUS %26 FLOW</text><text x="250" y="290" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="600" fill="%2360cdff" text-anchor="middle" letter-spacing="1.5">HI-FI VINYL EDITION</text><text x="250" y="306" font-family="'Segoe UI', sans-serif" font-size="8" fill="%2394a3b8" text-anchor="middle" letter-spacing="1">PLAY MUSIC TO SYNC ALBUM ART</text><circle cx="250" cy="250" r="14" fill="%23020617" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/></svg>`;

    let userData = {
        selectedMins: 30,
        selectedPeriodMins: 25,
        selectedBreakMins: 5,
        dailyGoalHours: 1,
        completedMinutesToday: 0,
        yesterdayHours: 0.0,
        streakDays: 0,
        lastDateStr: todayDateStr,
        notificationsEnabled: true,
        gifOpacity: 78,
        gifDisplayMode: 'circle', // 'circle' or 'full'
        ambientMode: 'plant', // 'plant', 'custom', or 'ytmusic'
        accentMode: 'preset', // 'preset', 'custom', or 'ytmusic_dynamic'
        notificationSound: 'default', // 'default', 'reminder', 'alarm', 'chime', 'none'
        focusNotificationSound: 'default', // 'default', 'reminder', 'alarm', 'chime', 'custom', 'none'
        breakNotificationSound: 'chime',   // 'default', 'reminder', 'alarm', 'chime', 'custom', 'none'
        focusSoundFileName: '',
        breakSoundFileName: '',
        customGifName: '',
        recentGifs: [], // Stores up to 5 recently used custom GIFs: { id, name, data }
        blockedApps: ['facebook.exe', 'tiktok.exe', 'instagram.exe'],
        restrictedSites: ['facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'reddit.com'],
        pipWidth: 280,
        pipHeight: 400,
        pipVinylWidth: 440,
        pipVinylHeight: 400,
        pipPeekingVinylEnabled: false,
        pipPeekingVinylSide: 'left',
        timerTheme: 'classic', // 'classic', 'hourglass', 'wave', 'blocks', 'dots', 'orbit'
        isStealthMode: false,
        showVinylSpindle: true,
        autoPipOnStart: false,
        hideTaskbarInPip: false,
        autoPauseEnabled: true,
        autoPauseSec: 15,
        useComplementaryColor: true,
        hourglassAutoRotate: false,
        completedMinutesByDate: {}, // { 'YYYY-MM-DD': minutes }
        prayerEnabled: true,
        prayerBreakEnabled: true,
        prayerAdvance: 5,
        prayerLat: -2.8554,
        prayerLng: 115.3283,
        prayerTz: 8,
        neutralOverstayEnabled: true,
        neutralOverstayIntervalMins: 30,
        neutralSoftBlockEnabled: true,
        ignoredNudgeStatsByDate: {} // { 'YYYY-MM-DD': count }
    };

    let continuousNeutralSec = 0;
    let continuousProductiveSec = 0;
    let lastContinuousExe = '';
    let lastProductiveExe = '';
    let isNeutralSoftBlockActive = false;

    function isGoalMetWithTolerance(mins, targetMins, targetHours) {
        if (!mins || mins <= 0) return false;
        if (mins >= targetMins) return true;
        // Rounding tolerance: e.g. 238 mins -> (238/60).toFixed(1) = "4.0" which matches "4.0" target hours!
        const minsHoursFormatted = parseFloat((mins / 60).toFixed(1));
        const targetHoursFormatted = parseFloat(parseFloat(targetHours).toFixed(1));
        return minsHoursFormatted >= targetHoursFormatted;
    }

    function calculateStreakDays() {
        const dailyGoalHours = parseFloat(userData.dailyGoalHours) || 1;
        const dailyGoalMins = dailyGoalHours * 60;

        let streak = 0;

        // Check Today first: if today goal is met, include today in streak
        const todayMins = userData.completedMinutesToday || 0;
        const todayGoalMet = isGoalMetWithTolerance(todayMins, dailyGoalMins, dailyGoalHours);

        if (todayGoalMet) {
            streak += 1;
        }

        // Walk backwards starting from Yesterday (offset 1 day)
        const todayObj = new Date();
        for (let i = 1; i <= 365; i++) {
            const d = new Date();
            d.setDate(todayObj.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            let mins = (userData.completedMinutesByDate && userData.completedMinutesByDate[dateStr]) 
                ? userData.completedMinutesByDate[dateStr] 
                : 0;

            if (mins === 0 && userData.appStatsByDate && userData.appStatsByDate[dateStr]) {
                const dayApps = userData.appStatsByDate[dateStr];
                let totalSec = 0;
                for (const exe in dayApps) {
                    totalSec += dayApps[exe];
                }
                mins = Math.floor(totalSec / 60);
            }

            if (isGoalMetWithTolerance(mins, dailyGoalMins, dailyGoalHours)) {
                streak += 1;
            } else {
                // Break streak if a past day was missed
                break;
            }
        }

        return streak;
    }

    function loadUserData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                userData = { ...userData, ...parsed };

                // Sanitize corrupted PIP dimensions (prevent huge dashboard size like 960x660)
                if (userData.pipWidth > 480 || userData.pipWidth < 160 || userData.pipHeight > 550 || userData.pipHeight < 200) {
                    userData.pipWidth = 280;
                    userData.pipHeight = 400;
                }
                delete userData.pipVinylWidth;
                delete userData.pipVinylHeight;

                // Migration: Move base64 GIFs to IndexedDB
                migrateGifsToIndexedDB();

                if (userData.lastDateStr !== todayDateStr) {
                    const yesterdayMins = userData.completedMinutesToday || 0;

                    // Save yesterday's minutes to historical stats
                    userData.completedMinutesByDate = userData.completedMinutesByDate || {};
                    userData.completedMinutesByDate[userData.lastDateStr] = yesterdayMins;

                    userData.completedMinutesToday = 0;
                    userData.lastDateStr = todayDateStr;
                }

                // Compute Yesterday Hours dynamically from yesterday's actual date
                const yesterdayObj = new Date();
                yesterdayObj.setDate(new Date().getDate() - 1);
                const yDateStr = yesterdayObj.toISOString().split('T')[0];
                const yMins = (userData.completedMinutesByDate && userData.completedMinutesByDate[yDateStr]) 
                    ? userData.completedMinutesByDate[yDateStr] 
                    : 0;
                userData.yesterdayHours = (yMins / 60).toFixed(1);

                // Dynamically recalculate streak
                userData.streakDays = calculateStreakDays();
                saveUserData();
            }
        } catch (e) {
            console.error('Error loading local user data:', e);
        }
    }

    async function migrateGifsToIndexedDB() {
        let changed = false;

        // Migrate active custom GIF
        if (userData.customGifData && userData.customGifData.startsWith('data:image')) {
            const id = 'active_' + Date.now();
            await gifDb.save(id, userData.customGifData);
            userData.customGifData = id;
            changed = true;
        }

        // Migrate recent GIFs
        if (userData.recentGifs && userData.recentGifs.length > 0) {
            for (let i = 0; i < userData.recentGifs.length; i++) {
                const gif = userData.recentGifs[i];
                if (gif.data && gif.data.startsWith('data:image')) {
                    const id = gif.id || 'recent_' + Date.now() + '_' + i;
                    await gifDb.save(id, gif.data);
                    gif.data = id;
                    gif.id = id;
                    changed = true;
                }
            }
        }

        if (changed) {
            saveUserData();
            applyGifTheme();
            renderRecentGifs();
        }
    }

    function saveUserData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        } catch (e) {
            console.error('Error saving local user data:', e);
        }
    }

    loadUserData();

    // Migrate or initialize blockedApps
    if (!userData.blockedApps) {
        userData.blockedApps = [];
        saveUserData();
    }

    let selectedMins = userData.selectedMins || 30;
    let selectedPeriodMins = userData.selectedPeriodMins || 25;
    let selectedBreakMins = userData.selectedBreakMins || 5;
    let blockedApps = userData.blockedApps || [];
    let isPaused = false;
    let activeState = 'idle';
    let previousState = 'idle';
    let notifiedOneMinWarning = false;
    let cachedAppList = [];

    // Custom Notification Sound Loader & Playback
    window._customFocusAudio = null;
    window._customBreakAudio = null;

    async function initCustomSounds() {
        try {
            const focusData = await gifDb.get('focus_sound');
            if (focusData) {
                window._customFocusAudio = new Audio(focusData);
            }
            const breakData = await gifDb.get('break_sound');
            if (breakData) {
                window._customBreakAudio = new Audio(breakData);
            }
        } catch (e) {
            console.error('[Sound] Failed to initialize custom sounds:', e);
        }
    }
    initCustomSounds();

    function playNotificationSound(category = 'focus') {
        const soundType = (category === 'break')
            ? (userData.breakNotificationSound || 'chime')
            : (userData.focusNotificationSound || 'default');

        if (soundType === 'none') {
            return 'none';
        } else if (soundType === 'custom') {
            const audioObj = (category === 'break') ? window._customBreakAudio : window._customFocusAudio;
            if (audioObj) {
                audioObj.currentTime = 0;
                audioObj.play().catch(err => console.error('[Sound] Custom sound playback error:', err));
            } else {
                console.warn(`[Sound] Custom ${category} sound selected but no audio file is loaded.`);
            }
            return 'none'; // Return 'none' to Windows Toast so Windows doesn't double-play system chime
        } else {
            return soundType;
        }
    }

    // Notification Helper
    function sendNotification(title, body, category = 'focus') {
        if (!userData.notificationsEnabled) return;

        // Anti-spam: Don't send identical notification within 1 second
        const now = Date.now();
        const notifKey = title + body;
        if (window._lastNotifKey === notifKey && (now - (window._lastNotifTime || 0)) < 1000) {
            return;
        }
        window._lastNotifKey = notifKey;
        window._lastNotifTime = now;

        const soundToPlay = playNotificationSound(category);

        sendToCpp({
            action: 'notify',
            title: title,
            body: body,
            sound: soundToPlay
        });
    }

    // --- YTMPX WebSocket Realtime Sync ---
    let ytmpxSocket = null;
    let isUsingExtension = false; // Flag to prioritize extension data over browser tab titles
    let ytTrackData = {
        title: '',
        author: '',
        image: '',
        isPlaying: false
    };

    let trackClearTimer = null;

    function clearTrackDataGracefully(delayMs = 2500) {
        if (trackClearTimer) return;
        trackClearTimer = setTimeout(() => {
            trackClearTimer = null;
            console.log('[YTMusic] Grace period expired. Clearing track info.');
            ytTrackData.title = '';
            ytTrackData.author = '';
            ytTrackData.image = '';
            ytTrackData.isPlaying = false;
            lastFetchedTrackKey = '';
            updateYtMusicUI();
        }, delayMs);
    }

    function cancelTrackDataClear() {
        if (trackClearTimer) {
            clearTimeout(trackClearTimer);
            trackClearTimer = null;
        }
    }

    function connectYtmpxWebSocket() {
        if (ytmpxSocket && (ytmpxSocket.readyState === WebSocket.OPEN || ytmpxSocket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            ytmpxSocket = new WebSocket('ws://localhost:8765');

            ytmpxSocket.onopen = () => {
                console.log('[YTMPX] Connected to ws://localhost:8765');
                isUsingExtension = true;
            };

            ytmpxSocket.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data) {
                        // Ignore command echoes broadcasted by the server (e.g. volumeUp, volumeDown, playPause)
                        if (data.command) {
                            return;
                        }

                        isUsingExtension = true; // Confirmed working extension

                        if (data.event === 'stop' || !data.metadata || (!data.metadata.title && !data.metadata.author)) {
                            console.log('[YTMPX] Transient stop/empty track event. Scheduling graceful clear...');
                            ytTrackData.isPlaying = false;
                            updateYtMusicUI();
                            clearTrackDataGracefully(2500);
                        } else if (data.metadata && (data.metadata.title || data.metadata.author)) {
                            cancelTrackDataClear(); // New track info confirmed! Cancel any pending clear!

                            ytTrackData.title = data.metadata.title || ytTrackData.title;
                            ytTrackData.author = data.metadata.author || ytTrackData.author;

                            console.log(`[YTMPX] Track Update: ${ytTrackData.title} — ${ytTrackData.author}`);

                            // PRIORITIZE image from extension metadata
                            if (data.metadata.image) {
                                ytTrackData.image = data.metadata.image;
                            }

                            if (data.event === 'track' || data.event === 'resume') {
                                ytTrackData.isPlaying = true;
                            } else if (data.event === 'pause') {
                                // Ignore transient pause event if user just adjusted volume
                                if (Date.now() - lastVolumeScrollTime > 1500) {
                                    ytTrackData.isPlaying = false;
                                }
                            }

                            updateYtMusicUI();
                        }
                    }
                } catch (err) {
                    console.error('[YTMPX] Error parsing message:', err);
                }
            };

            ytmpxSocket.onclose = () => {
                console.log('[YTMPX] Extension websocket closed');
                isUsingExtension = false;
                detectYtMusicFromBrowserTabs(cachedAppList);
                setTimeout(connectYtmpxWebSocket, 3000);
            };

            ytmpxSocket.onerror = () => {
                isUsingExtension = false;
                ytmpxSocket.close();
            };
        } catch (e) {
            isUsingExtension = false;
            setTimeout(connectYtmpxWebSocket, 3000);
        }
    }

    connectYtmpxWebSocket();

    let lastFetchedTrackKey = '';

    function fetchAlbumArtFromiTunes(title, author) {
        if (!title || title.toLowerCase() === 'youtube music' || title.toLowerCase() === 'yt music') return;
        const trackKey = `${title}-${author}`;
        if (lastFetchedTrackKey === trackKey) return;
        lastFetchedTrackKey = trackKey;

        // Clean parentheticals like (feat. Aizawa), [MV], etc.
        const cleanTitle = title.replace(/\([^\)]+\)/g, '').replace(/\[[^\]]+\]/g, '').split(/\s*[\-\|]\s*/)[0].trim();
        const cleanAuthor = (author && author !== 'YouTube Music') 
            ? author.replace(/\([^\)]+\)/g, '').replace(/\[[^\]]+\]/g, '').split(/\s*[\-\|]\s*/)[0].trim() 
            : '';

        const searchQueries = [
            `${cleanTitle} ${cleanAuthor}`,
            cleanTitle,
            cleanAuthor
        ].filter(q => q && q.length > 0);

        function tryNextQuery(index) {
            if (index >= searchQueries.length) return;
            // Skip fetch if not on a server (CORS issues in some WebView2 environments)
            if (window.location.protocol === 'file:') {
                console.warn('[iTunes] Skip fetch on file:// to avoid CORS. Use WebSocket metadata if available.');
                return;
            }
            const q = encodeURIComponent(searchQueries[index]);
            fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=1`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
                        const hdCover = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                        ytTrackData.image = hdCover;
                        updateYtMusicUI();
                    } else {
                        tryNextQuery(index + 1);
                    }
                })
                .catch(err => {
                    console.error('[iTunes] Fetch error:', err);
                    tryNextQuery(index + 1);
                });
        }

        tryNextQuery(0);
    }

    function detectYtMusicFromBrowserTabs(apps) {
        if (!apps || !Array.isArray(apps)) return;

        // Find all potential YouTube Music/YouTube tabs or app processes
        const ytApps = apps.filter(app => {
            if (!app.title && !app.exeName) return false;
            const t = (app.title || '').toLowerCase();
            const e = (app.exeName || '').toLowerCase();
            return t.includes('youtube music') || t.includes('yt music') || e.includes('youtube music');
        });

        // 1. If NO YouTube Music tab/app exists on the system at all:
        if (ytApps.length === 0) {
            if (ytTrackData.title || ytTrackData.author || ytTrackData.isPlaying) {
                clearTrackDataGracefully(1500);
            }
            return;
        }

        // 2. If YouTube Music IS running:
        cancelTrackDataClear(); // Active YT Music app found! Cancel clear!

        if (isUsingExtension && ytTrackData.title) {
            return; // Extension is actively providing track info, so trust extension metadata
        }

        // 3. Fallback: Parse track from browser tab title
        const ytApp = ytApps.find(app => app.title.includes(' - ') || app.title.includes(' | ')) || ytApps[0];

        let rawTitle = ytApp.title || '';
        let cleaned = rawTitle.replace(/\s*[\-\|]\s*YouTube Music/gi, '')
                             .replace(/^YouTube Music\s*[\-\|]\s*/gi, '')
                             .replace(/\s*[\-\|]\s*YouTube/gi, '')
                             .trim();

        const isGeneric = !cleaned ||
                          cleaned.toLowerCase() === 'youtube music' ||
                          cleaned.toLowerCase() === 'yt music' ||
                          cleaned.toLowerCase() === 'youtube';

        if (!isGeneric) {
            const parts = cleaned.split(/\s*[\-\|]\s*/);
            let newTitle = parts.length >= 2 ? parts[0].trim() : cleaned;
            let newAuthor = parts.length >= 2 ? parts[1].trim() : 'YouTube Music';

            if (ytTrackData.title !== newTitle || ytTrackData.author !== newAuthor || !ytTrackData.isPlaying) {
                const trackChanged = ytTrackData.title !== newTitle || ytTrackData.author !== newAuthor;
                ytTrackData.title = newTitle;
                ytTrackData.author = newAuthor;
                ytTrackData.isPlaying = true;

                if (trackChanged || !ytTrackData.image) {
                    fetchAlbumArtFromiTunes(ytTrackData.title, ytTrackData.author);
                }
                updateYtMusicUI();
            }
        }
    }

    function updateYtMusicUI() {
        const textSetup = document.getElementById('ticker-text-setup');
        const textTimer = document.getElementById('ticker-text-timer');
        const tickerSetup = document.getElementById('ytmusic-ticker-setup');
        const tickerTimer = document.getElementById('ytmusic-ticker-timer');

        const vinylCoverImg = document.getElementById('vinyl-cover-img');
        const cardVinylCoverImg = document.getElementById('card-vinyl-cover-img');
        const vinylDisc = document.getElementById('vinyl-disc');
        const cardVinylDisc = document.getElementById('card-vinyl-disc');
        const cardVinylContainer = document.getElementById('card-vinyl-container');

        const isYtMode = (userData.ambientMode === 'ytmusic');
        const hasTrack = !!(ytTrackData.title || ytTrackData.author);

        const trackString = (hasTrack)
            ? `${ytTrackData.title} — ${ytTrackData.author}` 
            : 'Not playing — YT Music';

        if (textSetup) textSetup.textContent = trackString;
        if (textTimer) textTimer.textContent = trackString;

        // Automatically HIDE the YT Music ticker & control buttons when YT Music is not open/playing
        const showTicker = hasTrack;
        if (tickerSetup) tickerSetup.style.display = showTicker ? 'flex' : 'none';
        if (tickerTimer) tickerTimer.style.display = showTicker ? 'flex' : 'none';

        // ONLY SHOW vinyl container if in YT Music ambient mode AND a track is detected
        if (cardVinylContainer) {
            if (isYtMode && hasTrack) {
                cardVinylContainer.style.display = 'block';
                cardVinylContainer.style.opacity = '1';
                cardVinylContainer.style.visibility = 'visible';
            } else if (!isYtMode) {
                cardVinylContainer.style.display = 'none';
            }
        }

        const defaultCover = defaultVinylSvg;
        // Keep the image if it exists
        const coverSrc = (ytTrackData.image) ? ytTrackData.image : defaultCover;
        
        // Sync vinyl animation state with actual playback
        const isActuallyPlaying = ytTrackData.isPlaying;
        if (vinylCoverImg) {
            vinylCoverImg.src = coverSrc;
            vinylCoverImg.classList.toggle('paused', !isActuallyPlaying);
        }
        if (cardVinylCoverImg) {
            cardVinylCoverImg.src = coverSrc;
            cardVinylCoverImg.classList.toggle('paused', !isActuallyPlaying);
        }

        // Sync media control icons with isActuallyPlaying
        document.querySelectorAll('.btn-yt-playpause').forEach(btn => {
            const pausePath = btn.querySelector('.icon-pause-path');
            const playPath = btn.querySelector('.icon-play-path');
            if (pausePath && playPath) {
                pausePath.style.display = !isActuallyPlaying ? 'none' : 'block';
                playPath.style.display = !isActuallyPlaying ? 'block' : 'none';
            }
        });

        // If no image, keep trying to fetch it
        if (!ytTrackData.image && ytTrackData.title) {
            fetchAlbumArtFromiTunes(ytTrackData.title, ytTrackData.author);
        }

        // Dynamic YT Music Album Accent Color Extraction Mode
        const isDynamicAlbum = !!(userData.dynamicAlbumEnabled || userData.accentMode === 'ytmusic_dynamic');
        if (isDynamicAlbum) {
            // Keep dynamic color if we have a track, even if paused
            if (hasTrack && coverSrc && coverSrc !== defaultCover) {
                extractDominantColor(coverSrc, (dynamicHex) => {
                    applyAccentTheme(dynamicHex);
                });
            } else {
                // When no music is playing, seamlessly fallback to user's selected base accent color (e.g. Orange)!
                applyAccentTheme(userData.accentColor || '#60cdff');
            }
        } else {
            applyAccentTheme(userData.accentColor || '#60cdff');
        }

        // Update PIP Peeking Vinyl Disc
        updatePipPeekingVinyl();
    }

    let lastPeekingTrackKey = "";
    let isPeekingTransitioning = false;

    function updatePipPeekingVinyl() {
        const isPip = document.body.classList.contains('pip-mode');
        const isEnabled = !!userData.pipPeekingVinylEnabled;
        const side = userData.pipPeekingVinylSide || 'left';
        const hasTrack = !!(ytTrackData.title || ytTrackData.author);
        const isPlaying = !!ytTrackData.isPlaying;

        // Show peeking vinyl whenever enabled and track is active
        const shouldShowPeeking = isEnabled && hasTrack;

        // Sync with Native C++ Layered Vinyl Overlay
        sendToCpp({
            action: 'updatePipVinylOverlay',
            visible: shouldShowPeeking,
            side: side,
            isPlaying: isPlaying,
            imageUrl: ytTrackData.image || '',
            title: ytTrackData.title || '',
            speedSec: userData.vinylSpeed || 6
        });
    }

    // Dynamic Accent Color Manager & Realtime CSS Variable Applicator
    function applyAccentTheme(hexColor) {
        if (!hexColor) return;

        // --- Accessibility: Luminance Check ---
        const getLuminance = (hex) => {
            const rgb = hex.match(/[A-Za-z0-9]{2}/g).map(v => parseInt(v, 16) / 255);
            const a = rgb.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        };

        let finalColor = hexColor;
        const lum = getLuminance(hexColor);
        if (lum < 0.12) { // Too dark for dark theme - brighten it
            finalColor = '#80d8ff';
        }

        document.documentElement.style.setProperty('--accent-blue', finalColor);
        document.documentElement.style.setProperty('--accent-blue-hover', finalColor);

        // Dynamic Heatmap shades from Accent Color
        document.documentElement.style.setProperty('--heatmap-lvl-1', `color-mix(in srgb, ${finalColor} 25%, #161b22)`);
        document.documentElement.style.setProperty('--heatmap-lvl-2', `color-mix(in srgb, ${finalColor} 50%, #161b22)`);
        document.documentElement.style.setProperty('--heatmap-lvl-3', `color-mix(in srgb, ${finalColor} 75%, #161b22)`);
        document.documentElement.style.setProperty('--heatmap-lvl-4', finalColor);
        document.documentElement.style.setProperty('--heatmap-lvl-3-glow', `color-mix(in srgb, ${finalColor} 40%, transparent)`);
        document.documentElement.style.setProperty('--heatmap-lvl-4-glow', `color-mix(in srgb, ${finalColor} 60%, transparent)`);

        // Dynamic 24-Hour Productivity Flow SVG Wave Gradients & Peak Marker
        const waveFillGrad = document.getElementById('waveFillGrad');
        if (waveFillGrad) {
            waveFillGrad.innerHTML = `
                <stop offset="0%" stop-color="${finalColor}" stop-opacity="0.38"/>
                <stop offset="60%" stop-color="${finalColor}" stop-opacity="0.10"/>
                <stop offset="100%" stop-color="${finalColor}" stop-opacity="0.0"/>
            `;
        }
        const waveStrokeGrad = document.getElementById('waveStrokeGrad');
        if (waveStrokeGrad) {
            waveStrokeGrad.innerHTML = `
                <stop offset="0%" stop-color="${finalColor}"/>
                <stop offset="65%" stop-color="${finalColor}"/>
                <stop offset="100%" stop-color="${finalColor}"/>
            `;
        }
        const markerPulse = document.getElementById('peak-marker-pulse');
        if (markerPulse) markerPulse.setAttribute('fill', `color-mix(in srgb, ${finalColor} 35%, transparent)`);
        const markerDot = document.getElementById('peak-marker-dot');
        if (markerDot) markerDot.setAttribute('fill', finalColor);

        const picker = document.getElementById('accent-color-picker');
        if (picker && finalColor.startsWith('#')) picker.value = finalColor;

        // Sync active state of chips with base accent color
        document.querySelectorAll('.accent-chip').forEach(chip => {
            const val = chip.getAttribute('data-accent');
            chip.classList.toggle('active', val === (userData.accentColor || '#60cdff'));
        });

        const chkDynamicAlbum = document.getElementById('chk-dynamic-album');
        if (chkDynamicAlbum) {
            chkDynamicAlbum.checked = !!(userData.dynamicAlbumEnabled || userData.accentMode === 'ytmusic_dynamic');
        }

        // Show / Hide Dynamic Complementary Contrast Toggle Row in Options
        const rowDynamicContrast = document.getElementById('row-dynamic-contrast');
        if (rowDynamicContrast) {
            const isDynamic = !!(userData.dynamicAlbumEnabled || userData.accentMode === 'ytmusic_dynamic');
            rowDynamicContrast.style.display = isDynamic ? 'flex' : 'none';
        }
    }

    // Color Utility: RGB to HSL conversion
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    }

    // Color Utility: HSL to Hex conversion
    function hslToHex(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        const toHex = x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Calculate High-Contrast Complementary Color (Opposite Hue on Color Wheel)
    function getComplementaryColor(r, g, b) {
        let [h, s, l] = rgbToHsl(r, g, b);
        // Rotate hue by 180 degrees (0.5 in normalized 0-1 range)
        h = (h + 0.5) % 1.0;
        // Boost saturation & constrain lightness for max readability against album backdrop
        s = Math.max(s, 0.75);
        l = Math.max(0.55, Math.min(0.72, l));
        return hslToHex(h, s, l);
    }

    // Extract Vibrant Dominant (or Complementary) Color from Album Cover Canvas
    function extractDominantColor(imageUrl, callback) {
        if (!imageUrl) return;
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 32, 32);
                const data = ctx.getImageData(0, 0, 32, 32).data;
                
                let rSum = 0, gSum = 0, bSum = 0, colorCount = 0;
                let totalCount = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2];
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const saturation = max === 0 ? 0 : (max - min) / max;

                    if (max > 20 && max < 250) {
                        totalCount++;
                        // Only count as colorful pixel if saturation is clearly visible (> 0.22)
                        if (saturation > 0.22) {
                            rSum += r; gSum += g; bSum += b;
                            colorCount++;
                        }
                    }
                }

                // If less than 10% of pixels have rich color, it is a Monochrome/Grayscale artwork!
                if (colorCount < Math.max(12, totalCount * 0.10)) {
                    // Monochrome / Black & White / Grayscale -> Clean Sleek Silver/Ice-White
                    console.log('[Color] Monochrome/Grayscale album art detected -> applying #f1f5f9');
                    callback('#f1f5f9');
                    return;
                }

                const r = Math.round(rSum / colorCount);
                const g = Math.round(gSum / colorCount);
                const b = Math.round(bSum / colorCount);

                let [h, s, l] = rgbToHsl(r, g, b);

                if (userData.useComplementaryColor !== false && s > 0.35) {
                    // High contrast complementary for vivid colorful covers
                    h = (h + 0.5) % 1.0;
                    s = Math.max(s, 0.70);
                    l = Math.max(0.55, Math.min(0.72, l));
                    callback(hslToHex(h, s, l));
                } else {
                    // Dominant colorful tone with enhanced visibility
                    s = Math.max(s, 0.65);
                    l = Math.max(0.55, Math.min(0.75, l));
                    callback(hslToHex(h, s, l));
                }
            } catch (e) {
                console.error('[Color] Error extracting dominant color:', e);
                callback(userData.accentColor || '#f1f5f9');
            }
        };
        img.onerror = () => callback(userData.accentColor || '#60cdff');
        img.src = imageUrl;
    }

    // Synchronize Full-Panel Vinyl Center Point to Exact Center of Timer Clock Ring Dial
    function syncVinylCenterPosition() {
        const focusCard = document.getElementById('focus-card');
        const gaugeContainer = document.querySelector('.gauge-container');
        const cardVinylDisc = document.querySelector('.card-vinyl-disc');
        
        if (!focusCard || !cardVinylDisc) return;

        let centerY = 208;
        let centerX = focusCard.offsetWidth / 2;

        if (gaugeContainer) {
            const cardRect = focusCard.getBoundingClientRect();
            const gaugeRect = gaugeContainer.getBoundingClientRect();
            if (gaugeRect.height > 0 && cardRect.height > 0) {
                centerY = (gaugeRect.top + gaugeRect.height / 2) - cardRect.top;
                centerX = (gaugeRect.left + gaugeRect.width / 2) - cardRect.left;
            }
        }

        cardVinylDisc.style.top = `${centerY.toFixed(1)}px`;
        cardVinylDisc.style.left = `${centerX.toFixed(1)}px`;
    }
    window.addEventListener('resize', () => {
        syncVinylCenterPosition();

        // Save PIP size when user resizes window manually
        if (document.body.classList.contains('pip-mode') && !isInitializingPip) {
            const w = document.documentElement.clientWidth;
            const h = document.documentElement.clientHeight;

            // Strictly guard within valid PIP dimensions (prevents capturing dashboard window size e.g. 857x677)
            if (w >= 160 && w <= 480 && h >= 200 && h <= 550) {
                userData.pipWidth = w;
                userData.pipHeight = h;
                saveUserData();
                console.log(`[PIP] Manual Resize Saved: ${w}x${h}`);
            }
            updatePipPeekingVinyl();
        }
    });

    // Use ResizeObserver for more reliable centering during layout changes (like PIP toggle)
    const gaugeContainerForObserve = document.querySelector('.gauge-container');
    if (gaugeContainerForObserve) {
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(syncVinylCenterPosition);
        });
        ro.observe(gaugeContainerForObserve);
    }

    // Realtime GIF Theme & Display Mode Renderer
    function applyTimerTheme() {
        const gaugeSvg = document.querySelector('.gauge-svg');
        if (!gaugeSvg) return;

        // Apply Stealth Mode class to body for global text hiding
        document.body.classList.toggle('stealth-active', !!userData.isStealthMode);

        // Clean up classes
        gaugeSvg.classList.remove('theme-hourglass', 'theme-wave', 'theme-blocks', 'theme-dots', 'theme-orbit');

        // Hide all layers
        document.querySelectorAll('.theme-layer').forEach(layer => layer.style.display = 'none');
        const orbitParticle = document.getElementById('orbit-particle');
        if (orbitParticle) orbitParticle.style.display = 'none';

        const theme = userData.timerTheme || 'classic';
        if (theme !== 'classic') {
            gaugeSvg.classList.add(`theme-${theme}`);
        }

        // Toggle 5s hourglass rotation
        gaugeSvg.classList.toggle('no-hourglass-rotate', !userData.hourglassAutoRotate);

        const rowHourglassRotate = document.getElementById('row-hourglass-rotate');
        if (rowHourglassRotate) {
            rowHourglassRotate.style.display = (theme === 'hourglass') ? 'flex' : 'none';
        }

        if (theme === 'hourglass') {
            const isFlowing = activeState !== 'idle' && !isPaused;
            updateSandStreamState(isFlowing);
        } else {
            updateSandStreamState(false);
        }

        if (theme === 'wave') {
            const layer = document.querySelector('.layer-wave');
            if (layer) layer.style.display = 'block';
        } else if (theme === 'hourglass') {
            const layer = document.querySelector('.layer-hourglass');
            if (layer) layer.style.display = 'block';
        } else if (theme === 'orbit') {
            if (orbitParticle) orbitParticle.style.display = 'block';
        }

        // Update chips
        document.querySelectorAll('.ring-theme-chip').forEach(chip => {
            chip.classList.toggle('active', chip.getAttribute('data-theme') === theme);
        });
    }

    function updateSandStreamState(isFlowing) {
        const sandStream = document.getElementById('sand-stream');
        if (!sandStream) return;

        if (isFlowing) {
            sandStream.style.display = 'block';
            sandStream.classList.remove('stream-draining', 'stream-starting');
            sandStream.classList.add('stream-active');
        } else {
            sandStream.style.display = 'none';
            sandStream.classList.remove('stream-starting', 'stream-active', 'stream-draining');
        }
    }

    // Timer Ring Theme Switcher
    document.querySelectorAll('.ring-theme-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            userData.timerTheme = chip.getAttribute('data-theme') || 'classic';
            saveUserData();
            applyTimerTheme();
            // Trigger a refresh of the current progress
            if (lastRatio !== undefined) updateVisualProgress(lastRatio);
        });
    });

    // Stealth Mode Click Listener (Toggle visibility of digits)
    document.getElementById('gauge-clickable-area')?.addEventListener('click', () => {
        userData.isStealthMode = !userData.isStealthMode;
        saveUserData();
        document.body.classList.toggle('stealth-active', !!userData.isStealthMode);
        console.log(`[Stealth] Timer digits hidden: ${userData.isStealthMode}`);
    });

    let lastRatio = 1.0;

    function updateVisualProgress(ratio) {
        lastRatio = ratio;
        const theme = userData.timerTheme || 'classic';
        const progressRatio = Math.max(0, Math.min(1.0, 1 - ratio));

        // Update standard circle progress
        if (gaugeProgressBar) {
            const offset = 477.5 * (1 - ratio);
            gaugeProgressBar.style.strokeDashoffset = offset;
        }

        // Theme Specific Logic
        if (theme === 'wave') {
            const levelGroup = document.getElementById('wave-level-group');
            if (levelGroup) {
                // Precise math: Bottom of circle is Y=176, Top is Y=24. Total Range = 152px.
                // Baseline (group origin) is at Y=100.
                // Empty: translateY(76), Full: translateY(-76)
                const translateY = 76 - (152 * progressRatio);
                levelGroup.style.transform = `translateY(${translateY}px)`;
            }
        } else if (theme === 'hourglass') {
            const topGroup = document.getElementById('sand-top-level-group');
            const bottomGroup = document.getElementById('sand-bottom-level-group');

            if (topGroup && bottomGroup) {
                // Top chamber: Drains from full (y=40) to empty (y=100)
                // Path baseline is at 100. Translate from -60 to 0.
                const topY = -60 + (60 * progressRatio);
                topGroup.style.transform = `translateY(${topY}px)`;

                // Bottom chamber: Fills from empty (y=160) to full (y=100)
                // Path baseline is at 100. Translate from 60 to 0.
                const bottomY = 60 - (60 * progressRatio);
                bottomGroup.style.transform = `translateY(${bottomY}px)`;

                // Dynamically update stream feather mask endpoint (y2) to extend further down (+26px) into the sand wave
                // Ensures stream penetrates deep into the wave with a seamless soft-feathered fade out
                const streamMaskGrad = document.getElementById('stream-mask-grad');
                if (streamMaskGrad) {
                    const sandSurfaceY = Math.max(98, 160 - (60 * progressRatio));
                    streamMaskGrad.setAttribute('y2', (sandSurfaceY + 26).toFixed(1));
                }

                const isFlowing = activeState !== 'idle' && !isPaused && ratio > 0;
                updateSandStreamState(isFlowing);
            }
        } else if (theme === 'orbit') {
            const particle = document.getElementById('orbit-particle');
            if (particle) {
                const angle = ratio * 360;
                particle.style.transform = `rotate(${angle}deg)`;
                particle.style.display = 'block';
            }
        }
    }

    // Realtime GIF Theme & Display Mode Renderer
    function applyGifTheme() {
        const opacity = (userData.gifOpacity || 78) / 100;
        const isFullMode = (userData.gifDisplayMode === 'full');
        const plantGrowthContainer = document.getElementById('plant-growth-container');
        const defaultChip = document.querySelector('.gif-chip[data-gif="none"]');
        const ytMusicChip = document.querySelector('.gif-chip[data-gif="ytmusic"]');

        const vinylDiscContainer = document.getElementById('vinyl-disc-container');
        const cardVinylContainer = document.getElementById('card-vinyl-container');
        const vinylSpeedSection = document.getElementById('vinyl-speed-section');

        // Apply Spindle Visibility
        document.body.classList.toggle('hide-vinyl-spindle', !userData.showVinylSpindle);
        const chkSpindle = document.getElementById('chk-vinyl-spindle-toggle');
        if (chkSpindle) chkSpindle.checked = !!userData.showVinylSpindle;

        const currentSpeed = parseFloat(userData.vinylSpeed) || 6;
        const currentSize = userData.vinylSize || 340;
        document.documentElement.style.setProperty('--vinyl-speed', `${currentSpeed}s`);
        document.documentElement.style.setProperty('--vinyl-size', `${currentSize}px`);

        const vinylSpeedSlider = document.getElementById('vinyl-speed-slider');
        const vinylSpeedLabel = document.getElementById('vinyl-speed-label');
        if (vinylSpeedSlider) vinylSpeedSlider.value = currentSpeed;
        if (vinylSpeedLabel) vinylSpeedLabel.textContent = `${currentSpeed}s`;

        const vinylSizeSlider = document.getElementById('vinyl-size-slider');
        const vinylSizeLabel = document.getElementById('vinyl-size-label');
        if (vinylSizeSlider) vinylSizeSlider.value = currentSize;
        if (vinylSizeLabel) vinylSizeLabel.textContent = `${currentSize}px`;

        // Reset visibility: hide all ambient containers by default
        if (gaugeGifContainer) gaugeGifContainer.style.display = 'none';
        if (cardGifContainer) cardGifContainer.style.display = 'none';
        if (vinylDiscContainer) vinylDiscContainer.style.display = 'none';
        if (cardVinylContainer) cardVinylContainer.style.display = 'none';
        if (plantGrowthContainer) plantGrowthContainer.style.display = 'none';

        if (defaultChip) defaultChip.classList.remove('active');
        if (ytMusicChip) ytMusicChip.classList.remove('active');
        if (btnSelectCustomGif) btnSelectCustomGif.classList.remove('active');

        if (userData.ambientMode === 'ytmusic') {
            if (ytMusicChip) ytMusicChip.classList.add('active');

            if (isFullMode) {
                if (cardVinylContainer) cardVinylContainer.style.display = 'block';
            } else {
                if (vinylDiscContainer) vinylDiscContainer.style.display = 'block';
            }

            if (gifPreviewWrapper) gifPreviewWrapper.style.display = 'none';
            if (gifStyleSection) gifStyleSection.style.display = 'block';
            if (vinylSpeedSection) vinylSpeedSection.style.display = 'block';
            if (gifOpacityRow) gifOpacityRow.style.display = 'none';
            if (customGifNameDisplay) customGifNameDisplay.textContent = '';

            document.querySelectorAll('.speed-chip').forEach(chip => {
                chip.classList.toggle('active', parseFloat(chip.getAttribute('data-speed')) === currentSpeed);
            });
            setTimeout(syncVinylCenterPosition, 10);

            document.querySelectorAll('.size-preset-chip').forEach(chip => {
                chip.classList.toggle('active', parseInt(chip.getAttribute('data-size')) === currentSize);
            });

            document.querySelectorAll('.gif-mode-chip').forEach(chip => {
                chip.classList.toggle('active', chip.getAttribute('data-mode') === (userData.gifDisplayMode || 'circle'));
            });

            updateYtMusicUI();

        } else if (userData.ambientMode === 'custom' && userData.customGifData && (userData.customGifData.length > 50 || !userData.customGifData.startsWith('data:'))) {
            if (btnSelectCustomGif) btnSelectCustomGif.classList.add('active');

            // Load data from IndexedDB or use directly if it's still base64
            (async () => {
                let actualData = userData.customGifData;
                if (actualData && !actualData.startsWith('data:image')) {
                    actualData = await gifDb.get(actualData);
                }

                if (!actualData) return;

                if (isFullMode) {
                    cardGifImg.src = actualData;
                    cardGifImg.style.opacity = opacity;
                    cardGifContainer.style.display = 'block';
                } else {
                    gaugeGifImg.src = actualData;
                    gaugeGifImg.style.opacity = opacity;
                    gaugeGifContainer.style.display = 'block';
                }

                // Sync modal preview thumbnail & controls
                if (gifPreviewImg) {
                    gifPreviewImg.src = actualData;
                    gifPreviewImg.style.opacity = opacity;
                }
                if (gifPreviewContainer) {
                    gifPreviewContainer.style.borderRadius = isFullMode ? '8px' : '50%';
                }
                if (gifPreviewWrapper) gifPreviewWrapper.style.display = 'block';
                if (customGifNameDisplay) customGifNameDisplay.textContent = userData.customGifName || 'Custom GIF';
                if (gifStyleSection) gifStyleSection.style.display = 'block';
                if (vinylSpeedSection) vinylSpeedSection.style.display = 'none';
                if (gifOpacityRow) gifOpacityRow.style.display = 'block';
                if (gifOpacitySlider) gifOpacitySlider.value = userData.gifOpacity || 78;
                if (opacityLabel) opacityLabel.textContent = `${userData.gifOpacity || 78}%`;

                document.querySelectorAll('.gif-mode-chip').forEach(chip => {
                    chip.classList.toggle('active', chip.getAttribute('data-mode') === (userData.gifDisplayMode || 'circle'));
                });
            })();
        } else {
            if (defaultChip) defaultChip.classList.add('active');
            if (plantGrowthContainer) plantGrowthContainer.style.display = 'flex';
            if (gifPreviewWrapper) gifPreviewWrapper.style.display = 'none';
            if (gifStyleSection) gifStyleSection.style.display = 'none';
            if (vinylSpeedSection) vinylSpeedSection.style.display = 'none';
            if (gifOpacityRow) gifOpacityRow.style.display = 'none';
            if (customGifNameDisplay) customGifNameDisplay.textContent = '';
            updateYtMusicUI();
        }

        // In-place synchronization of active state on Recent GIF cards (Zero-Flicker)
        document.querySelectorAll('.recent-gif-card').forEach(c => {
            const isThisActive = (userData.ambientMode === 'custom' && c.getAttribute('data-gif-data') === userData.customGifData);
            c.classList.toggle('active', isThisActive);
        });
    }

    // Render Recent GIFs History (Max 5 items)
    async function renderRecentGifs() {
        const recentGifsSection = document.getElementById('recent-gifs-section');
        const recentGifsContainer = document.getElementById('recent-gifs-container');
        if (!recentGifsSection || !recentGifsContainer) return;

        userData.recentGifs = userData.recentGifs || [];
        
        // Auto-add current active GIF to recent list if not present
        if (userData.customGifData && (userData.customGifData.length > 50 || !userData.customGifData.startsWith('data:'))) {
            const exists = userData.recentGifs.some(g => g.data === userData.customGifData);
            if (!exists) {
                const newId = userData.customGifData.startsWith('data:') ? 'gif_' + Date.now() : userData.customGifData;
                if (userData.customGifData.startsWith('data:')) {
                    await gifDb.save(newId, userData.customGifData);
                    userData.customGifData = newId;
                }

                userData.recentGifs.unshift({
                    id: newId,
                    name: userData.customGifName || 'Custom GIF',
                    data: newId
                });
                if (userData.recentGifs.length > 5) {
                    const removed = userData.recentGifs.pop();
                    // Optional: Clean up removed GIF from IndexedDB if not active
                    if (removed.data !== userData.customGifData) {
                        await gifDb.delete(removed.data);
                    }
                }
                saveUserData();
            }
        }

        if (userData.recentGifs.length === 0) {
            recentGifsSection.style.display = 'none';
            recentGifsContainer.innerHTML = '';
            return;
        }

        recentGifsSection.style.display = 'block';

        // Fetch all thumbnails in parallel before touching DOM to avoid blank reload flicker
        const itemsWithThumbs = await Promise.all(userData.recentGifs.map(async (gif) => {
            const thumbData = gif.data.startsWith('data:') ? gif.data : await gifDb.get(gif.data);
            return { gif, thumbData };
        }));

        const fragment = document.createDocumentFragment();

        itemsWithThumbs.forEach(({ gif, thumbData }, index) => {
            const isActive = (userData.ambientMode === 'custom' && userData.customGifData === gif.data);
            const card = document.createElement('div');
            card.className = `recent-gif-card ${isActive ? 'active' : ''}`;
            card.setAttribute('data-gif-data', gif.data);
            card.title = gif.name;

            card.innerHTML = `
                <img class="recent-gif-thumb" src="${thumbData || ''}" alt="thumb">
                <div class="recent-gif-info">
                    <span class="recent-gif-title">${gif.name}</span>
                </div>
                <button class="btn-remove-recent" title="Remove from history">&times;</button>
            `;

            // Click card to switch to this GIF (Zero-Flicker in-place active switch)
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-recent')) return;
                userData.ambientMode = 'custom';
                userData.customGifData = gif.data;
                userData.customGifName = gif.name;
                saveUserData();
                applyGifTheme();
            });

            // Click remove button
            card.querySelector('.btn-remove-recent')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const removed = userData.recentGifs.splice(index, 1)[0];
                await gifDb.delete(removed.data);

                if (isActive) {
                    if (userData.recentGifs.length > 0) {
                        userData.ambientMode = 'custom';
                        userData.customGifData = userData.recentGifs[0].data;
                        userData.customGifName = userData.recentGifs[0].name;
                    } else {
                        userData.ambientMode = 'plant';
                        userData.customGifData = '';
                        userData.customGifName = '';
                    }
                }
                saveUserData();
                applyGifTheme();
                renderRecentGifs();
            });

            fragment.appendChild(card);
        });

        recentGifsContainer.replaceChildren(fragment);
    }

    applyGifTheme();
    applyTimerTheme();
    renderRecentGifs();
    updateYtMusicUI();

    // Clear Recent GIFs Button Listener
    document.getElementById('btn-clear-recent-gifs')?.addEventListener('click', async () => {
        userData.recentGifs = [];
        await gifDb.clearAll();
        // If current active is custom, reset it too
        if (userData.ambientMode === 'custom') {
            userData.ambientMode = 'plant';
            userData.customGifData = '';
            userData.customGifName = '';
        }
        saveUserData();
        applyGifTheme();
        renderRecentGifs();
    });

    // YT Music Vinyl Preset Button
    document.querySelector('.gif-chip[data-gif="ytmusic"]')?.addEventListener('click', () => {
        userData.ambientMode = 'ytmusic';
        saveUserData();
        applyGifTheme();
    });

    // File Upload Handler
    btnSelectCustomGif.addEventListener('click', () => {
        gifFileInput.click();
    });

    gifFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const newData = evt.target.result;
            const newName = file.name;
            const newId = 'gif_' + Date.now();

            await gifDb.save(newId, newData);

            userData.ambientMode = 'custom';
            userData.customGifData = newId;
            userData.customGifName = newName;
            userData.gifOpacity = userData.gifOpacity || 78;
            userData.gifDisplayMode = userData.gifDisplayMode || 'circle';

            userData.recentGifs = userData.recentGifs || [];
            // Remove if exists (by data/id)
            userData.recentGifs = userData.recentGifs.filter(g => g.data !== newId);

            userData.recentGifs.unshift({
                id: newId,
                name: newName,
                data: newId
            });
            if (userData.recentGifs.length > 5) {
                const removed = userData.recentGifs.pop();
                if (removed.data !== userData.customGifData) {
                    await gifDb.delete(removed.data);
                }
            }

            saveUserData();
            applyGifTheme();
            renderRecentGifs();
        };
        reader.readAsDataURL(file);
    });

    // Realtime Opacity Slider Listener
    gifOpacitySlider?.addEventListener('input', (e) => {
        userData.gifOpacity = parseInt(e.target.value);
        const opacity = userData.gifOpacity / 100;
        
        if (opacityLabel) opacityLabel.textContent = `${userData.gifOpacity}%`;
        if (gaugeGifImg) gaugeGifImg.style.opacity = opacity;
        if (cardGifImg) cardGifImg.style.opacity = opacity;
        if (gifPreviewImg) gifPreviewImg.style.opacity = opacity;
        
        saveUserData();
    });

    // Display Style Mode Switcher (Circle vs Full Panel)
    document.querySelectorAll('.gif-mode-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            userData.gifDisplayMode = chip.getAttribute('data-mode');
            saveUserData();
            applyGifTheme();
        });
    });

    // Center Spindle Toggle Listener
    document.getElementById('chk-vinyl-spindle-toggle')?.addEventListener('change', (e) => {
        userData.showVinylSpindle = e.target.checked;
        saveUserData();
        document.body.classList.toggle('hide-vinyl-spindle', !userData.showVinylSpindle);
    });

    // Realtime Vinyl Rotation Speed Slider Listener
    document.getElementById('vinyl-speed-slider')?.addEventListener('input', (e) => {
        userData.vinylSpeed = parseFloat(e.target.value);
        document.documentElement.style.setProperty('--vinyl-speed', `${userData.vinylSpeed}s`);
        const label = document.getElementById('vinyl-speed-label');
        if (label) label.textContent = `${userData.vinylSpeed}s`;

        document.querySelectorAll('.speed-chip').forEach(chip => {
            chip.classList.toggle('active', parseFloat(chip.getAttribute('data-speed')) === userData.vinylSpeed);
        });

        saveUserData();
        updatePipPeekingVinyl();
    });

    // Vinyl Rotation Speed Selector Switcher
    document.querySelectorAll('.speed-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            userData.vinylSpeed = parseFloat(chip.getAttribute('data-speed')) || 6;
            saveUserData();
            applyGifTheme();
        });
    });

    // Realtime Vinyl Disc Size Slider Listener
    document.getElementById('vinyl-size-slider')?.addEventListener('input', (e) => {
        userData.vinylSize = parseInt(e.target.value);
        document.documentElement.style.setProperty('--vinyl-size', `${userData.vinylSize}px`);
        const label = document.getElementById('vinyl-size-label');
        if (label) label.textContent = `${userData.vinylSize}px`;
        
        document.querySelectorAll('.size-preset-chip').forEach(chip => {
            chip.classList.toggle('active', parseInt(chip.getAttribute('data-size')) === userData.vinylSize);
        });

        saveUserData();
    });

    // Vinyl Size Preset Chips Switcher
    document.querySelectorAll('.size-preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            userData.vinylSize = parseInt(chip.getAttribute('data-size')) || 340;
            saveUserData();
            applyGifTheme();
        });
    });

    // Accent Color Preset Chips Listener (Selects Base Color)
    document.querySelectorAll('.accent-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const accentVal = chip.getAttribute('data-accent');
            userData.accentColor = accentVal;
            if (userData.accentMode !== 'ytmusic_dynamic' && !userData.dynamicAlbumEnabled) {
                userData.accentMode = 'preset';
            }
            document.querySelectorAll('.accent-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            saveUserData();
            updateYtMusicUI();
            if (!userData.dynamicAlbumEnabled && userData.accentMode !== 'ytmusic_dynamic') {
                applyAccentTheme(accentVal);
            }
        });
    });

    // Custom Color Picker Listener (Selects Base Color)
    document.getElementById('accent-color-picker')?.addEventListener('input', (e) => {
        const hex = e.target.value;
        userData.accentColor = hex;
        if (userData.accentMode !== 'ytmusic_dynamic' && !userData.dynamicAlbumEnabled) {
            userData.accentMode = 'custom';
        }
        document.querySelectorAll('.accent-chip').forEach(c => c.classList.remove('active'));
        saveUserData();
        updateYtMusicUI();
        if (!userData.dynamicAlbumEnabled && userData.accentMode !== 'ytmusic_dynamic') {
            applyAccentTheme(hex);
        }
    });

    // Dynamic YT Music Album Sync Toggle Switch Listener
    const chkDynamicAlbum = document.getElementById('chk-dynamic-album');
    if (chkDynamicAlbum) {
        chkDynamicAlbum.checked = !!(userData.dynamicAlbumEnabled || userData.accentMode === 'ytmusic_dynamic');
        chkDynamicAlbum.addEventListener('change', (e) => {
            userData.dynamicAlbumEnabled = e.target.checked;
            userData.accentMode = e.target.checked ? 'ytmusic_dynamic' : 'preset';
            saveUserData();
            updateYtMusicUI();
            if (!e.target.checked) {
                applyAccentTheme(userData.accentColor || '#60cdff');
            }
        });
    }

    // High-Contrast Complementary Accent Toggle Listener
    const chkDynamicContrast = document.getElementById('chk-dynamic-contrast');
    if (chkDynamicContrast) {
        chkDynamicContrast.checked = (userData.useComplementaryColor !== false);
        chkDynamicContrast.addEventListener('change', (e) => {
            userData.useComplementaryColor = e.target.checked;
            saveUserData();
            updateYtMusicUI();
        });
    }

    // Auto-Rotate Hourglass Every 5s Toggle Listener
    const chkHourglassRotate = document.getElementById('chk-hourglass-rotate');
    if (chkHourglassRotate) {
        chkHourglassRotate.checked = !!userData.hourglassAutoRotate;
        chkHourglassRotate.addEventListener('change', (e) => {
            userData.hourglassAutoRotate = e.target.checked;
            saveUserData();
            applyTimerTheme();
        });
    }

    // PIP Peeking Vinyl Toggle Listener
    const chkPipPeekingVinyl = document.getElementById('chk-pip-peeking-vinyl');
    if (chkPipPeekingVinyl) {
        chkPipPeekingVinyl.checked = !!userData.pipPeekingVinylEnabled;
        chkPipPeekingVinyl.addEventListener('change', (e) => {
            userData.pipPeekingVinylEnabled = e.target.checked;
            saveUserData();
            updatePipPeekingVinyl();
        });
    }

    // PIP Peeking Vinyl Side Selector Listeners
    document.querySelectorAll('.pip-side-btn').forEach(btn => {
        const side = btn.getAttribute('data-side');
        btn.classList.toggle('active', side === (userData.pipPeekingVinylSide || 'left'));
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pip-side-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            userData.pipPeekingVinylSide = side;
            saveUserData();
            updatePipPeekingVinyl();
        });
    });

    // YT Music Media Control Buttons (Prev, Play/Pause, Next)
    document.querySelectorAll('.btn-yt-prev').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[Media] Prev clicked');
            if (ytmpxSocket && ytmpxSocket.readyState === WebSocket.OPEN) {
                console.log('[YTMPX] Sending prev command');
                ytmpxSocket.send(JSON.stringify({ command: 'prev' }));
            } else {
                console.log('[Media] WS not open, falling back to C++');
                sendToCpp({ action: 'mediaPrev' });
            }
        });
    });
    document.querySelectorAll('.btn-yt-playpause').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[Media] PlayPause clicked');
            if (ytmpxSocket && ytmpxSocket.readyState === WebSocket.OPEN) {
                console.log('[YTMPX] Sending playPause command');
                ytmpxSocket.send(JSON.stringify({ command: 'playPause' }));
            } else {
                console.log('[Media] WS not open, falling back to C++');
                ytTrackData.isPaused = !ytTrackData.isPaused;
                updateYtMusicUI();
                sendToCpp({ action: 'mediaPlayPause' });
            }
        });
    });
    document.querySelectorAll('.btn-yt-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[Media] Next clicked');
            if (ytmpxSocket && ytmpxSocket.readyState === WebSocket.OPEN) {
                console.log('[YTMPX] Sending next command');
                ytmpxSocket.send(JSON.stringify({ command: 'next' }));
            } else {
                console.log('[Media] WS not open, falling back to C++');
                sendToCpp({ action: 'mediaNext' });
            }
        });
    });

    // Vinyl Disc Click: Toggle / Bring to front or minimize active Music window/tab
    const handleVinylDiscClick = (e) => {
        if (e) e.stopPropagation();
        console.log('[Media] Vinyl Disc clicked -> Toggling Music Window (Title:', ytTrackData.title, ')');
        sendToCpp({
            action: 'toggleMusicWindow',
            title: ytTrackData.title || ''
        });
    };

    // Vinyl Disc Scroll: Adjust YouTube Music Volume
    let lastVolumeScrollTime = 0;
    const handleVinylDiscWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        lastVolumeScrollTime = Date.now();
        const direction = e.deltaY < 0 ? 'volumeUp' : 'volumeDown';
        console.log(`[Media] Vinyl Wheel: ${direction}`);
        if (ytmpxSocket && ytmpxSocket.readyState === WebSocket.OPEN) {
            ytmpxSocket.send(JSON.stringify({ command: direction }));
        } else {
            sendToCpp({ action: direction === 'volumeUp' ? 'mediaVolumeUp' : 'mediaVolumeDown' });
        }
    };

    window.handleExternalVinylWheel = (direction) => {
        console.log(`[Media] External Vinyl Wheel: ${direction}`);
        lastVolumeScrollTime = Date.now();
        if (ytmpxSocket && ytmpxSocket.readyState === WebSocket.OPEN) {
            ytmpxSocket.send(JSON.stringify({ command: direction }));
        } else {
            sendToCpp({ action: direction === 'volumeUp' ? 'mediaVolumeUp' : 'mediaVolumeDown' });
        }
    };

    document.querySelectorAll('.card-vinyl-disc, .vinyl-disc, #card-vinyl-container, #vinyl-disc-container, .pip-peeking-vinyl-disc, .card-vinyl-backdrop').forEach(el => {
        el.addEventListener('click', handleVinylDiscClick);
        el.addEventListener('wheel', handleVinylDiscWheel, { passive: false });
        el.setAttribute('title', 'Click to toggle Music player • Scroll to adjust Volume');
    });

    // None GIF Preset Button
    document.querySelector('.gif-chip[data-gif="none"]')?.addEventListener('click', () => {
        userData.ambientMode = 'plant';
        userData.customGifData = '';
        userData.customGifName = '';
        saveUserData();
        applyGifTheme();
    });

    // Generate Gauge Radial Ticks
    function renderGaugeTicks() {
        if (!gaugeTicks) return;
        gaugeTicks.innerHTML = '';
        const totalTicks = 28;
        const cx = 100, cy = 100, r = 88;
        
        for (let i = 0; i < totalTicks; i++) {
            const angle = (i * 360 / totalTicks) * (Math.PI / 180);
            const x1 = cx + (r - 6) * Math.cos(angle);
            const y1 = cy + (r - 6) * Math.sin(angle);
            const x2 = cx + r * Math.cos(angle);
            const y2 = cy + r * Math.sin(angle);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-linecap', 'round');
            gaugeTicks.appendChild(line);
        }
    }
    renderGaugeTicks();

    // Time Picker Controls
    function updateSetupPrediction() {
        if (!sessionPredictionText) return;

        const periods = Math.ceil(selectedMins / selectedPeriodMins);
        const breaks = (periods > 1 && !chkSkipBreaks.checked) ? (periods - 1) : 0;
        const totalBreakMins = breaks * selectedBreakMins;
        const totalDurationMins = selectedMins + totalBreakMins;

        const now = new Date();
        const finishDate = new Date(now.getTime() + totalDurationMins * 60 * 1000);

        const hours = String(finishDate.getHours()).padStart(2, '0');
        const minutes = String(finishDate.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        const isNextDay = finishDate.getDate() !== now.getDate() || finishDate.getMonth() !== now.getMonth();
        const finishHour = finishDate.getHours();
        // Night / bedtime window (between 23:00 and 06:00)
        const isLateNight = (finishHour >= 23 || finishHour < 6);

        const durH = Math.floor(totalDurationMins / 60);
        const durM = totalDurationMins % 60;
        let durStr = '';
        if (durH > 0 && durM > 0) durStr = `${durH}h ${durM}m`;
        else if (durH > 0) durStr = `${durH}h`;
        else durStr = `${durM}m`;

        const daySuffix = isNextDay ? ' (+1d)' : '';
        sessionPredictionText.innerHTML = `Ends at <strong>${timeStr}</strong>${daySuffix} • ${durStr} total`;

        if (sessionPredictionBadge) {
            sessionPredictionBadge.classList.toggle('late-night', isLateNight);
            if (predictionIconClock && predictionIconMoon) {
                predictionIconClock.style.display = isLateNight ? 'none' : 'block';
                predictionIconMoon.style.display = isLateNight ? 'block' : 'none';
            }
        }
    }

    function updatePickerDisplay() {
        if (pickerMinsInput && document.activeElement !== pickerMinsInput) {
            pickerMinsInput.value = selectedMins;
        }
        if (pickerPeriodInput && document.activeElement !== pickerPeriodInput) {
            pickerPeriodInput.value = selectedPeriodMins;
        }
        if (pickerBreakInput && document.activeElement !== pickerBreakInput) {
            pickerBreakInput.value = selectedBreakMins;
        }

        const periods = Math.ceil(selectedMins / selectedPeriodMins);
        const breaks = (periods > 1 && !chkSkipBreaks.checked) ? (periods - 1) : 0;
        
        if (breaks > 0) {
            breaksCountText.textContent = `You'll have ${breaks} break${breaks > 1 ? 's' : ''} (${selectedBreakMins} mins each) across ${periods} focus periods (${selectedPeriodMins} mins each)`;
        } else {
            breaksCountText.textContent = `Continuous ${selectedMins} min focus session (${selectedPeriodMins} min period)`;
        }

        updateSetupPrediction();
        
        userData.selectedMins = selectedMins;
        userData.selectedPeriodMins = selectedPeriodMins;
        userData.selectedBreakMins = selectedBreakMins;
        saveUserData();
    }

    // Direct Typing & Keyboard Interaction Event Handlers
    [pickerMinsInput, pickerPeriodInput, pickerBreakInput].forEach(input => {
        if (!input) return;
        input.addEventListener('focus', () => input.select());
    });

    pickerMinsInput?.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            selectedMins = Math.min(val, 480);
            updatePickerDisplay();
        }
    });

    pickerMinsInput?.addEventListener('blur', () => {
        let val = parseInt(pickerMinsInput.value);
        if (isNaN(val) || val < 1) selectedMins = 1;
        else selectedMins = Math.min(val, 480);
        pickerMinsInput.value = selectedMins;
        updatePickerDisplay();
    });

    pickerMinsInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pickerMinsInput.blur();
    });

    pickerPeriodInput?.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            selectedPeriodMins = Math.min(val, 120);
            updatePickerDisplay();
        }
    });

    pickerPeriodInput?.addEventListener('blur', () => {
        let val = parseInt(pickerPeriodInput.value);
        if (isNaN(val) || val < 1) selectedPeriodMins = 1;
        else selectedPeriodMins = Math.min(val, 120);
        pickerPeriodInput.value = selectedPeriodMins;
        updatePickerDisplay();
    });

    pickerPeriodInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pickerPeriodInput.blur();
    });

    pickerBreakInput?.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            selectedBreakMins = Math.min(val, 60);
            updatePickerDisplay();
        }
    });

    pickerBreakInput?.addEventListener('blur', () => {
        let val = parseInt(pickerBreakInput.value);
        if (isNaN(val) || val < 1) selectedBreakMins = 1;
        else selectedBreakMins = Math.min(val, 60);
        pickerBreakInput.value = selectedBreakMins;
        updatePickerDisplay();
    });

    pickerBreakInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pickerBreakInput.blur();
    });

    chkSkipBreaks?.addEventListener('change', () => {
        updatePickerDisplay();
    });

    btnPickerUp.addEventListener('click', () => {
        if (selectedMins < 480) {
            if (selectedMins < 5) selectedMins += 1;
            else if (selectedMins < 15) selectedMins += 5;
            else selectedMins += 15;
            updatePickerDisplay();
        }
    });

    btnPickerDown.addEventListener('click', () => {
        if (selectedMins > 1) {
            if (selectedMins <= 5) selectedMins -= 1;
            else if (selectedMins <= 15) selectedMins -= 5;
            else selectedMins -= 15;
            updatePickerDisplay();
        }
    });

    btnPeriodUp?.addEventListener('click', () => {
        if (selectedPeriodMins < 120) {
            if (selectedPeriodMins < 5) selectedPeriodMins += 1;
            else selectedPeriodMins += 5;
            updatePickerDisplay();
        }
    });

    btnPeriodDown?.addEventListener('click', () => {
        if (selectedPeriodMins > 1) {
            if (selectedPeriodMins <= 5) selectedPeriodMins -= 1;
            else selectedPeriodMins -= 5;
            updatePickerDisplay();
        }
    });

    btnBreakUp.addEventListener('click', () => {
        if (selectedBreakMins < 60) {
            selectedBreakMins += 5;
            updatePickerDisplay();
        }
    });

    btnBreakDown.addEventListener('click', () => {
        if (selectedBreakMins > 1) {
            if (selectedBreakMins <= 5) selectedBreakMins -= 1;
            else selectedBreakMins -= 5;
            updatePickerDisplay();
        }
    });

    // Protection Card Segmented Tab Switching
    document.querySelectorAll('.guard-tab-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            const targetTab = btn.getAttribute('data-tab');
            console.log('Tab switch triggered:', targetTab);

            document.querySelectorAll('.guard-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-secondary)';
                b.style.fontWeight = '600';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--accent-blue)';
            btn.style.color = '#000';
            btn.style.fontWeight = '700';

            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });

            const activeContent = document.getElementById(`tab-content-${targetTab}`);
            if (activeContent) {
                activeContent.style.display = 'flex';
                activeContent.classList.add('active');
            }

            // Reset Prayer Display to Next Prayer whenever switching tabs
            if (window.allPrayerTimes && window.allPrayerTimes.length > 0 && typeof window.renderPrayerInfo === 'function') {
                window.displayedPrayerIndex = window.allPrayerTimes.findIndex(p => p.name === window.actualNextPrayerName);
                window.renderPrayerInfo();
            }
        });
    });

    // Restricted Websites UI Manager
    const restrictedSiteInput = document.getElementById('restricted-site-input');
    const btnAddRestrictedSite = document.getElementById('btn-add-restricted-site');
    const restrictedSitesContainer = document.getElementById('restricted-sites-container');

    function cleanDomain(input) {
        if (!input) return '';
        let d = input.trim().toLowerCase();
        d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
        return d;
    }

    // Sync restricted sites list to Chrome extension via runtime message
    function syncRestrictedSitesToExtension(sites) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'UPDATE_RESTRICTED_SITES', sites: sites });
            }
        } catch (e) {
            // Extension not available (e.g. standalone mode)
        }
    }

    function renderRestrictedSites() {
        if (!restrictedSitesContainer) return;
        restrictedSitesContainer.innerHTML = '';

        userData.restrictedSites = userData.restrictedSites || ['facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'reddit.com'];

        userData.restrictedSites.forEach((domain, idx) => {
            const chip = document.createElement('div');
            chip.className = 'restricted-site-chip';
            chip.style.cssText = 'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #60cdff; font-size: 11px; padding: 4px 10px; border-radius: 14px; display: inline-flex; align-items: center; gap: 6px; font-family: monospace;';

            chip.innerHTML = `
                <span>${domain}</span>
                <span class="btn-remove-site" style="cursor: pointer; opacity: 0.6; font-size: 14px; line-height: 1; margin-left: 2px;" title="Remove domain">&times;</span>
            `;

            chip.querySelector('.btn-remove-site').addEventListener('click', (e) => {
                e.stopPropagation();
                userData.restrictedSites.splice(idx, 1);
                saveUserData();
                renderRestrictedSites();
                syncRestrictedSitesToExtension(userData.restrictedSites);
                sendToCpp({ action: 'setRestrictedSites', restrictedSites: userData.restrictedSites });
            });

            restrictedSitesContainer.appendChild(chip);
        });
    }

    function handleAddRestrictedSite() {
        if (!restrictedSiteInput) return;
        const domain = cleanDomain(restrictedSiteInput.value);
        if (!domain) return;

        userData.restrictedSites = userData.restrictedSites || [];
        if (!userData.restrictedSites.includes(domain)) {
            userData.restrictedSites.push(domain);
            saveUserData();
            renderRestrictedSites();
            syncRestrictedSitesToExtension(userData.restrictedSites);
            sendToCpp({ action: 'setRestrictedSites', restrictedSites: userData.restrictedSites });
        }
        restrictedSiteInput.value = '';
    }

    if (btnAddRestrictedSite) btnAddRestrictedSite.addEventListener('click', handleAddRestrictedSite);
    if (restrictedSiteInput) {
        restrictedSiteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddRestrictedSite();
        });
    }

    renderRestrictedSites();
    syncRestrictedSitesToExtension(userData.restrictedSites || []);
    sendToCpp({ action: 'setBlacklist', blacklist: blockedApps || [] });
    sendToCpp({ action: 'setRestrictedSites', restrictedSites: userData.restrictedSites || [] });
    sendToCpp({ action: 'setAutoCloseBlocked', enabled: userData.autoCloseBlockedApps === true });

    // Start Focus Session
    btnStartFocus.addEventListener('click', () => {
        const skipBreaks = chkSkipBreaks.checked;

        sendToCpp({
            action: 'startSession',
            focusMinutes: selectedMins,
            focusChunkMinutes: selectedPeriodMins,
            breakMinutes: selectedBreakMins,
            skipBreaks: skipBreaks,
            blacklist: blockedApps,
            restrictedSites: userData.restrictedSites || []
        });

        if (userData.autoPipOnStart) {
            isInitializingPip = true;
            setTimeout(() => { isInitializingPip = false; }, 1500);

            let pipW = userData.pipWidth || 280;
            let pipH = userData.pipHeight || 400;
            if (pipW > 480 || pipW < 160) pipW = 280;
            if (pipH > 550 || pipH < 200) pipH = 400;

            sendToCpp({
                action: 'togglePip',
                width: pipW,
                height: pipH,
                hideTaskbar: !!userData.hideTaskbarInPip
            });
        }

        setupView.classList.remove('active');
        timerView.classList.add('active');
    });

    // Pause / Stop Session
    btnPause.addEventListener('click', () => {
        sendToCpp({ action: 'pauseSession' });
    });

    btnStop.addEventListener('click', () => {
        sendToCpp({ action: 'stopSession' });
        timerView.classList.remove('active');
        setupView.classList.add('active');
    });

    // Modals & Settings Options
    btnEditGoal.addEventListener('click', () => goalModal.classList.add('active'));
    btnCloseGoalModal.addEventListener('click', () => {
        saveUserData();
        goalModal.classList.remove('active');
    });

    document.querySelectorAll('.goal-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const hours = parseInt(chip.getAttribute('data-hours')) || 1;
            userData.dailyGoalHours = hours;
            saveUserData();
            updateStatsUI();
            goalModal.classList.remove('active');
            goalModal.classList.add('active');
        });
    });

    document.querySelectorAll('.btn-options-trigger, #btn-options, #btn-options-progress').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e?.stopPropagation();
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            chkNotificationsToggle.checked = userData.notificationsEnabled;

            const focusSoundSelect = document.getElementById('select-focus-sound');
            if (focusSoundSelect) {
                focusSoundSelect.value = userData.focusNotificationSound || 'default';
                const focusCustomRow = document.getElementById('focus-custom-sound-row');
                if (focusCustomRow) focusCustomRow.style.display = (focusSoundSelect.value === 'custom') ? 'flex' : 'none';
            }
            const focusFileName = document.getElementById('focus-sound-file-name');
            if (focusFileName) focusFileName.textContent = userData.focusSoundFileName || 'No file chosen';

            const breakSoundSelect = document.getElementById('select-break-sound');
            if (breakSoundSelect) {
                breakSoundSelect.value = userData.breakNotificationSound || 'chime';
                const breakCustomRow = document.getElementById('break-custom-sound-row');
                if (breakCustomRow) breakCustomRow.style.display = (breakSoundSelect.value === 'custom') ? 'flex' : 'none';
            }
            const breakFileName = document.getElementById('break-sound-file-name');
            if (breakFileName) breakFileName.textContent = userData.breakSoundFileName || 'No file chosen';

            const chkAutoPip = document.getElementById('chk-auto-pip');
            if (chkAutoPip) chkAutoPip.checked = !!userData.autoPipOnStart;

            const chkHideTaskbarPip = document.getElementById('chk-hide-taskbar-pip');
            if (chkHideTaskbarPip) chkHideTaskbarPip.checked = !!userData.hideTaskbarInPip;

            const chkNeutralOverstay = document.getElementById('chk-neutral-overstay-toggle');
            if (chkNeutralOverstay) chkNeutralOverstay.checked = userData.neutralOverstayEnabled !== false;

            const selectNeutralInterval = document.getElementById('select-neutral-overstay-interval');
            if (selectNeutralInterval) selectNeutralInterval.value = String(userData.neutralOverstayIntervalMins || 30);

            const chkNeutralSoftBlock = document.getElementById('chk-neutral-softblock-toggle');
            if (chkNeutralSoftBlock) chkNeutralSoftBlock.checked = userData.neutralSoftBlockEnabled !== false;

            applyGifTheme();
            optionsModal.classList.add('active');
        });
    });

    document.getElementById('chk-auto-pip')?.addEventListener('change', (e) => {
        userData.autoPipOnStart = e.target.checked;
        saveUserData();
    });

    document.getElementById('chk-hide-taskbar-pip')?.addEventListener('change', (e) => {
        userData.hideTaskbarInPip = e.target.checked;
        saveUserData();
    });

    // --- Work & Break Sound Option Handlers ---
    const focusSoundSelect = document.getElementById('select-focus-sound');
    const breakSoundSelect = document.getElementById('select-break-sound');
    const focusCustomRow = document.getElementById('focus-custom-sound-row');
    const breakCustomRow = document.getElementById('break-custom-sound-row');
    const focusFileInput = document.getElementById('focus-sound-file-input');
    const breakFileInput = document.getElementById('break-sound-file-input');
    const focusFileName = document.getElementById('focus-sound-file-name');
    const breakFileName = document.getElementById('break-sound-file-name');

    focusSoundSelect?.addEventListener('change', (e) => {
        userData.focusNotificationSound = e.target.value;
        if (focusCustomRow) focusCustomRow.style.display = (e.target.value === 'custom') ? 'flex' : 'none';
        if (e.target.value === 'custom' && !window._customFocusAudio) {
            focusFileInput?.click();
        }
        saveUserData();
    });

    breakSoundSelect?.addEventListener('change', (e) => {
        userData.breakNotificationSound = e.target.value;
        if (breakCustomRow) breakCustomRow.style.display = (e.target.value === 'custom') ? 'flex' : 'none';
        if (e.target.value === 'custom' && !window._customBreakAudio) {
            breakFileInput?.click();
        }
        saveUserData();
    });

    document.getElementById('btn-browse-focus-sound')?.addEventListener('click', () => focusFileInput?.click());
    document.getElementById('btn-browse-break-sound')?.addEventListener('click', () => breakFileInput?.click());

    function handleCustomSoundFileSelect(inputElement, category) {
        const file = inputElement?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            const dbKey = (category === 'break') ? 'break_sound' : 'focus_sound';
            try {
                await gifDb.save(dbKey, dataUrl);
                if (category === 'break') {
                    window._customBreakAudio = new Audio(dataUrl);
                    userData.breakSoundFileName = file.name;
                    if (breakFileName) breakFileName.textContent = file.name;
                } else {
                    window._customFocusAudio = new Audio(dataUrl);
                    userData.focusSoundFileName = file.name;
                    if (focusFileName) focusFileName.textContent = file.name;
                }
                saveUserData();
                console.log(`[Sound] Successfully loaded custom ${category} sound: ${file.name}`);
            } catch (err) {
                console.error(`[Sound] Failed to save custom ${category} sound:`, err);
            }
        };
        reader.readAsDataURL(file);
    }

    focusFileInput?.addEventListener('change', () => handleCustomSoundFileSelect(focusFileInput, 'focus'));
    breakFileInput?.addEventListener('change', () => handleCustomSoundFileSelect(breakFileInput, 'break'));

    // Sound Test Play Buttons
    document.getElementById('btn-play-focus-sound')?.addEventListener('click', () => {
        playNotificationSound('focus');
        sendNotification('Test Focus Sound', 'Testing your focus session notification sound.', 'focus');
    });

    document.getElementById('btn-play-break-sound')?.addEventListener('click', () => {
        playNotificationSound('break');
        sendNotification('Test Break Sound', 'Testing your break session notification sound.', 'break');
    });

    // --- GIF Maintenance Utility ---
    document.getElementById('btn-cleanup-gifs')?.addEventListener('click', async () => {
        if (!confirm('This will remove all GIF history data except for your current active GIF. Continue?')) return;

        const activeId = userData.customGifData;
        const recentIds = (userData.recentGifs || []).map(g => g.data);
        const keepIds = new Set([activeId, ...recentIds]);

        if (!gifDb._db) await gifDb.init();
        const tx = gifDb._db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => {
            const keys = request.result;
            keys.forEach(key => {
                if (!keepIds.has(key)) {
                    store.delete(key);
                }
            });
            alert('Cleanup complete! Unused GIF data removed.');
            renderRecentGifs();
        };
    });

    btnCloseOptionsModal.addEventListener('click', () => {
        saveUserData();
        optionsModal.classList.remove('active');
    });

    // Save & Close Modal when clicking outside the modal content card (on the backdrop overlay)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                saveUserData();
                overlay.classList.remove('active');
            }
        });
    });

    // Save & Close Modal when pressing the Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(overlay => {
                saveUserData();
                overlay.classList.remove('active');
            });
        }
    });

    chkNotificationsToggle.addEventListener('change', (e) => {
        userData.notificationsEnabled = e.target.checked;
        saveUserData();
    });

    const chkAutoCloseToggle = document.getElementById('chk-auto-close-toggle');
    if (chkAutoCloseToggle) {
        chkAutoCloseToggle.checked = userData.autoCloseBlockedApps === true;
        chkAutoCloseToggle.addEventListener('change', (e) => {
            userData.autoCloseBlockedApps = e.target.checked;
            saveUserData();
            sendToCpp({
                action: 'setAutoCloseBlocked',
                enabled: userData.autoCloseBlockedApps
            });
            if (userData.autoCloseBlockedApps) {
                sendNotification('Auto-Close Enabled', 'Blocked apps will close automatically when opened during focus.', 'focus');
            }
        });
    }

    const chkMinimizeTrayToggle = document.getElementById('chk-minimize-tray-toggle');
    if (chkMinimizeTrayToggle) {
        chkMinimizeTrayToggle.checked = userData.minimizeToTrayOnClose !== false;
        // Sync setting to C++ immediately on startup
        sendToCpp({
            action: 'setMinimizeToTrayConfig',
            enabled: userData.minimizeToTrayOnClose !== false
        });
        chkMinimizeTrayToggle.addEventListener('change', (e) => {
            userData.minimizeToTrayOnClose = e.target.checked;
            saveUserData();
            sendToCpp({
                action: 'setMinimizeToTrayConfig',
                enabled: userData.minimizeToTrayOnClose !== false
            });
        });
    }

    const chkAutoPauseToggle = document.getElementById('chk-auto-pause-toggle');
    const selectAutoPauseSec = document.getElementById('select-auto-pause-sec');
    const autoPauseSecRow = document.getElementById('auto-pause-sec-row');

    if (chkAutoPauseToggle) {
        chkAutoPauseToggle.checked = userData.autoPauseEnabled !== false;
        if (autoPauseSecRow) {
            autoPauseSecRow.style.opacity = (userData.autoPauseEnabled !== false) ? '1' : '0.5';
            autoPauseSecRow.style.pointerEvents = (userData.autoPauseEnabled !== false) ? 'auto' : 'none';
        }
        chkAutoPauseToggle.addEventListener('change', (e) => {
            userData.autoPauseEnabled = e.target.checked;
            if (autoPauseSecRow) {
                autoPauseSecRow.style.opacity = userData.autoPauseEnabled ? '1' : '0.5';
                autoPauseSecRow.style.pointerEvents = userData.autoPauseEnabled ? 'auto' : 'none';
            }
            saveUserData();
            sendToCpp({
                action: 'setAutoPauseConfig',
                enabled: userData.autoPauseEnabled,
                sec: userData.autoPauseSec || 15
            });
        });
    }

    if (selectAutoPauseSec) {
        selectAutoPauseSec.value = String(userData.autoPauseSec || 15);
        selectAutoPauseSec.addEventListener('change', (e) => {
            userData.autoPauseSec = parseInt(e.target.value, 10) || 15;
            saveUserData();
            sendToCpp({
                action: 'setAutoPauseConfig',
                enabled: userData.autoPauseEnabled !== false,
                sec: userData.autoPauseSec
            });
        });
    }

    const chkNeutralOverstayToggle = document.getElementById('chk-neutral-overstay-toggle');
    const selectNeutralInterval = document.getElementById('select-neutral-overstay-interval');
    const chkNeutralSoftBlockToggle = document.getElementById('chk-neutral-softblock-toggle');

    if (chkNeutralOverstayToggle) {
        chkNeutralOverstayToggle.checked = userData.neutralOverstayEnabled !== false;
        chkNeutralOverstayToggle.addEventListener('change', (e) => {
            userData.neutralOverstayEnabled = e.target.checked;
            saveUserData();
        });
    }

    if (selectNeutralInterval) {
        selectNeutralInterval.value = String(userData.neutralOverstayIntervalMins || 30);
        selectNeutralInterval.addEventListener('change', (e) => {
            userData.neutralOverstayIntervalMins = parseInt(e.target.value, 10) || 30;
            saveUserData();
        });
    }

    if (chkNeutralSoftBlockToggle) {
        chkNeutralSoftBlockToggle.checked = userData.neutralSoftBlockEnabled !== false;
        chkNeutralSoftBlockToggle.addEventListener('change', (e) => {
            userData.neutralSoftBlockEnabled = e.target.checked;
            saveUserData();
        });
    }

    btnResetProgress.addEventListener('click', () => {
        userData.completedMinutesToday = 0;
        saveUserData();
        updateStatsUI();
        optionsModal.classList.remove('active');
    });

    btnClearWhitelist.addEventListener('click', () => {
        blockedApps = [];
        userData.blockedApps = blockedApps;
        saveUserData();
        sendToCpp({ action: 'setBlacklist', blacklist: blockedApps });
        renderAppList(cachedAppList);
        optionsModal.classList.remove('active');
    });

    // Filter & Sort State for Blocked Applications List
    let currentAppFilter = 'all'; // 'all', 'blocked', 'unblocked'
    let currentAppSort = 'latest'; // 'latest', 'name'

    // Filter Chips Listeners
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentAppFilter = chip.getAttribute('data-filter') || 'all';
            renderAppList(cachedAppList);
        });
    });

    // Sort Dropdown Selector Listener
    document.getElementById('app-sort-select')?.addEventListener('change', (e) => {
        currentAppSort = e.target.value || 'latest';
        renderAppList(cachedAppList);
    });

    // Search Input Listener
    appSearchInput.addEventListener('input', () => {
        renderAppList(cachedAppList);
    });

    // Refresh Apps List
    btnRefreshApps.addEventListener('click', () => {
        sendToCpp({ action: 'getRunningApps' });
    });

    // Clean DOM Node App Whitelist Renderer
    window.renderAppList = function(apps) {
        if (apps) cachedAppList = apps;
        if (cachedAppList && Array.isArray(cachedAppList)) {
            userData.appIconMap = userData.appIconMap || {};
            cachedAppList.forEach(a => {
                if (a.exeName && a.icon && a.icon.length > 30) {
                    userData.appIconMap[a.exeName.toLowerCase()] = a.icon;
                }
            });
            saveUserData();
        }
        detectYtMusicFromBrowserTabs(cachedAppList);
        if (!appListContainer) return;
        appListContainer.innerHTML = '';

        const currentBlocked = userData.blockedApps || blockedApps || [];
        blockedApps = currentBlocked;

        // Combine currently open apps with any blocked apps (so blocked apps always show up in list)
        const knownExes = new Set((cachedAppList || []).map(a => (a.exeName || '').toLowerCase()));
        let combinedApps = [...(cachedAppList || [])];

        currentBlocked.forEach(bExe => {
            if (bExe && !knownExes.has(bExe.toLowerCase())) {
                const lower = bExe.toLowerCase();
                const icon = (userData.appIconMap && userData.appIconMap[lower]) || defaultIconSvg;
                combinedApps.push({
                    exeName: bExe,
                    title: bExe,
                    icon: icon
                });
            }
        });

        const searchQuery = (appSearchInput.value || '').trim().toLowerCase();

        let displayApps = combinedApps.filter(app => {
            const isBlocked = currentBlocked.some(a =>
                a.toLowerCase() === app.exeName.toLowerCase()
            );
            if (currentAppFilter === 'blocked' && !isBlocked) return false;
            if (currentAppFilter === 'unblocked' && isBlocked) return false;

            if (!searchQuery) return true;
            return (app.title && app.title.toLowerCase().includes(searchQuery)) ||
                   (app.exeName && app.exeName.toLowerCase().includes(searchQuery));
        });

        // Sort by Name (A-Z) or Latest Open
        if (currentAppSort === 'name') {
            displayApps.sort((a, b) => {
                const nameA = (a.title || a.exeName || '').toLowerCase();
                const nameB = (b.title || b.exeName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }

        if (displayApps.length === 0) {
            appListContainer.innerHTML = `<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--text-muted);">No matching applications found for filter: "${currentAppFilter}"</div>`;
            return;
        }

        displayApps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'app-item';

            const iconImg = document.createElement('img');
            iconImg.className = 'app-icon';
            iconImg.src = app.icon && app.icon.length > 30 ? app.icon : defaultIconSvg;
            iconImg.onerror = () => { iconImg.src = defaultIconSvg; };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'app-item-info';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'app-item-title';
            titleDiv.textContent = app.title || app.exeName;

            const exeDiv = document.createElement('div');
            exeDiv.className = 'app-item-exe';
            exeDiv.textContent = app.exeName;

            infoDiv.appendChild(titleDiv);
            infoDiv.appendChild(exeDiv);

            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = currentBlocked.some(a =>
                a.toLowerCase() === app.exeName.toLowerCase()
            );

            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider';

            switchLabel.appendChild(chk);
            switchLabel.appendChild(sliderSpan);

            chk.addEventListener('change', (e) => {
                let current = userData.blockedApps || blockedApps || [];
                if (e.target.checked) {
                    if (!current.some(a => a.toLowerCase() === app.exeName.toLowerCase())) {
                        current.push(app.exeName);
                    }
                } else {
                    current = current.filter(a =>
                        a.toLowerCase() !== app.exeName.toLowerCase()
                    );
                }
                userData.blockedApps = current;
                blockedApps = current;
                saveUserData();
                sendToCpp({ action: 'setBlacklist', blacklist: current });
                renderAppList(cachedAppList);
                if (typeof renderStatsDashboard === 'function') {
                    renderStatsDashboard(activeStatsRange);
                }
            });

            item.appendChild(iconImg);
            item.appendChild(infoDiv);
            item.appendChild(switchLabel);

            appListContainer.appendChild(item);
        });
    };

    // Daily Goal Multi-Tier Color Progression (Dual-Layer Clean Lap Rings)
    const GOAL_TIERS = [
        { name: 'Standard', color: 'rgba(255, 255, 255, 0.65)', baseColor: 'rgba(255, 255, 255, 0.1)' },
        { name: 'Electric Blue', color: '#38bdf8', baseColor: 'rgba(255, 255, 255, 0.4)' },
        { name: 'Emerald Green', color: '#22c55e', baseColor: '#38bdf8' },
        { name: 'Neon Pink', color: '#ec4899', baseColor: '#22c55e' },
        { name: 'Amber Gold', color: '#eab308', baseColor: '#ec4899' },
        { name: 'Crimson Flame', color: '#ef4444', baseColor: '#eab308' }
    ];

    function updateStatsUI() {
        userData.streakDays = calculateStreakDays();

        const yesterdayObj = new Date();
        yesterdayObj.setDate(new Date().getDate() - 1);
        const yDateStr = yesterdayObj.toISOString().split('T')[0];
        const yMins = (userData.completedMinutesByDate && userData.completedMinutesByDate[yDateStr]) 
            ? userData.completedMinutesByDate[yDateStr] 
            : 0;
        userData.yesterdayHours = (yMins / 60).toFixed(1);

        statGoalHours.textContent = userData.dailyGoalHours;
        statYesterday.textContent = userData.yesterdayHours;
        statStreak.textContent = userData.streakDays;
        statCompletedMins.textContent = userData.completedMinutesToday;

        const goalMins = Math.max(1, (Number(userData.dailyGoalHours) || 1) * 60);
        const completedMins = Math.max(0, Number(userData.completedMinutesToday) || 0);
        const totalRatio = completedMins / goalMins;
        const CIRCUMFERENCE = 301.5;

        if (goalDonutFill) {
            goalDonutFill.style.filter = 'none';

            if (totalRatio <= 0) {
                if (goalDonutBg) goalDonutBg.style.stroke = GOAL_TIERS[0].baseColor;
                goalDonutFill.style.stroke = GOAL_TIERS[0].color;
                goalDonutFill.style.strokeDashoffset = CIRCUMFERENCE;
                if (donutTierBadge) donutTierBadge.style.display = 'none';
                if (goalDonutContainer) goalDonutContainer.title = `Daily Goal: 0 / ${goalMins} mins (0%)`;
            } else if (totalRatio < 1.0) {
                if (goalDonutBg) goalDonutBg.style.stroke = GOAL_TIERS[0].baseColor;
                goalDonutFill.style.stroke = GOAL_TIERS[0].color;
                goalDonutFill.style.strokeDashoffset = (CIRCUMFERENCE * (1 - totalRatio)).toFixed(1);
                if (donutTierBadge) donutTierBadge.style.display = 'none';
                if (goalDonutContainer) goalDonutContainer.title = `Daily Goal: ${completedMins} / ${goalMins} mins (${Math.round(totalRatio * 100)}%)`;
            } else {
                const fullLaps = Math.floor(totalRatio);
                const lapProgress = totalRatio - fullLaps;
                const N = GOAL_TIERS.length - 1; // 5 colored tiers (Blue, Green, Pink, Yellow, Red)

                let activeTierIdx, fillRatio;
                if (lapProgress === 0) {
                    activeTierIdx = ((fullLaps - 1) % N) + 1;
                    fillRatio = 1.0;
                } else {
                    activeTierIdx = ((fullLaps - 1) % N) + 1;
                    fillRatio = lapProgress;
                }

                const currentTier = GOAL_TIERS[activeTierIdx] || GOAL_TIERS[1];

                if (goalDonutBg) goalDonutBg.style.stroke = currentTier.baseColor;
                goalDonutFill.style.stroke = currentTier.color;
                goalDonutFill.style.strokeDashoffset = (CIRCUMFERENCE * (1 - fillRatio)).toFixed(1);

                if (donutTierBadge) {
                    const multDisplay = totalRatio >= 10 ? totalRatio.toFixed(0) : totalRatio.toFixed(1);
                    donutTierBadge.style.display = 'inline-block';
                    donutTierBadge.style.color = currentTier.color;
                    donutTierBadge.style.borderColor = currentTier.color;
                    donutTierBadge.style.boxShadow = `0 2px 8px rgba(0, 0, 0, 0.6)`;
                    donutTierBadge.textContent = `${multDisplay}x`;
                }

                if (goalDonutContainer) {
                    const lapNumber = fullLaps + (lapProgress > 0 ? 1 : 0);
                    goalDonutContainer.title = `Daily Goal: ${completedMins} / ${goalMins} mins (${totalRatio.toFixed(1)}x - Lap ${lapNumber}: ${currentTier.name})`;
                }
            }
        }

        const statsKpiStreak = document.getElementById('stats-kpi-streak');
        if (statsKpiStreak) {
            statsKpiStreak.textContent = `${userData.streakDays || 0} Days`;
        }

        renderWeeklyChart();
    }

    // Statistics Modal Elements
    const statsModal = document.getElementById('stats-modal');
    const btnOpenStats = document.getElementById('btn-open-stats');
    const btnCloseStatsModal = document.getElementById('btn-close-stats-modal');

    // Quotes Database (Motivational & Wisdom Quotes in Indonesian & English)
    const FOCUS_QUOTES = [
        { text: "Tetap fokus pada tujuanmu. Hasil besar dibangun dari langkah-langkah kecil setiap hari.", author: "FocusGrow Wisdom" },
        { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
        { text: "Konsistensi adalah kunci keberhasilan. Kerjakan tugasmu dengan penuh kesungguhan.", author: "Pepatah Produktif" },
        { text: "Deep work is the superpower of the 21st century.", author: "Cal Newport" },
        { text: "Jangan biarkan gangguan kecil menghalangi impian besarmu.", author: "Motivasi Kerja" },
        { text: "Do what you have to do until you can do what you want to do.", author: "Oprah Winfrey" },
        { text: "Satu jam fokus penuh jauh lebih berharga daripada seharian bekerja setengah hati.", author: "Prinsip Produktivitas" },
        { text: "Starve your distractions, feed your focus.", author: "Anonymous" },
        { text: "Kerjakan yang paling penting terlebih dahulu, biarkan yang lain menyusul.", author: "Manajemen Waktu" },
        { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
        { text: "Impian tidak terwujud lewat keajaiban; itu membutuhkan keringat, tekad, dan kerja keras.", author: "Colin Powell" },
        { text: "You don't need more time, you just need more focus.", author: "Productivity Master" },
        { text: "Fokus pada proses, hasil indah akan mengikuti dengan sendirinya.", author: "Filosofi Kerja" },
        { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
        { text: "Fokus adalah seni mengatakan 'tidak' pada seribu hal baik lainnya.", author: "Steve Jobs" },
        { text: "Disiplin adalah jembatan antara cita-cita dan pencapaian.", author: "Success Logic" },
        { text: "Work hard in silence, let your success be your noise.", author: "Frank Ocean" },
        { text: "Cara terbaik untuk memulai adalah berhenti berbicara dan mulai melakukan.", author: "Walt Disney" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "Jangan menunggu waktu yang tepat. Ciptakan waktu itu sekarang juga.", author: "FocusGrow Wisdom" },
        { text: "Small steps in the right direction can turn out to be the biggest steps of your life.", author: "Daily Motivation" },
        { text: "Your mind is for having ideas, not holding them. Focus on the task at hand.", author: "David Allen" },
        { text: "Productivity is being able to do things that you were never able to do before.", author: "Franz Kafka" },
        { text: "Energi dan ketekunan menaklukkan segala hal.", author: "Benjamin Franklin" },
        { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
    ];

    const REST_QUOTES = [
        { text: "Istirahat bukan berarti berhenti, melainkan mengisi ulang energi untuk melangkah lebih jauh.", author: "Nasihat Sehat" },
        { text: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", author: "Ralph Marston" },
        { text: "Jauhkan pandangan dari layar, regangkan tubuhmu, dan hirup udara segar.", author: "Panduan Istirahat" },
        { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
        { text: "Kesehatan dan ketenangan pikiranmu adalah investasi terbaik untuk masa depan.", author: "Renungan Diri" },
        { text: "Take a break. A rested mind can solve problems that a tired mind cannot.", author: "Wellness Wisdom" },
        { text: "Minum air putih, berdiri sejenak, dan biarkan matamu beristirahat.", author: "Health Reminder" },
        { text: "Rest is not idleness; to lie on the grass under trees is by no means a waste of time.", author: "John Lubbock" },
        { text: "Tubuhmu butuh jeda agar bisa berlari kencang kembali nanti.", author: "FocusGrow Tips" },
        { text: "He who holds his breath for too long will collapse. Breathe and rest now.", author: "Ancient Wisdom" },
        { text: "Tidur adalah meditasi terbaik. Tapi saat ini, cukup regangkan badanmu saja.", author: "Dalai Lama" },
        { text: "Resting is a part of the process, not a reward for the process.", author: "Fitness Mental" },
        { text: "Sometimes the most productive thing you can do is relax.", author: "Mark Black" },
        { text: "Jangan merasa bersalah karena beristirahat. Mesin pun butuh pendinginan.", author: "Modern Productivity" },
        { text: "Tenangkan pikiranmu, dan jiwamu akan berbicara.", author: "Spirit Quote" },
        { text: "Your body hears everything your mind says. Give it some peace.", author: "Health First" },
        { text: "A change of pace is as good as a rest. Look away from the screen for a bit.", author: "Proverb" },
        { text: "The time to relax is when you don't have time for it.", author: "Sydney J. Harris" },
        { text: "Refresh your mind, clear your vision, and recharge your soul.", author: "Zen Master" },
        { text: "Breathe in confidence, breathe out doubt. Take this moment for yourself.", author: "Mindfulness" }
    ];

    function updateRandomQuote(mode = 'focus') {
        const quotes = (mode === 'rest' || mode === 'resting') ? REST_QUOTES : FOCUS_QUOTES;
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        
        const qTextSetup = document.getElementById('quote-text-setup');
        const qAuthorSetup = document.getElementById('quote-author-setup');
        const qTextTimer = document.getElementById('quote-text-timer');
        const qAuthorTimer = document.getElementById('quote-author-timer');

        if (qTextSetup) qTextSetup.textContent = `"${q.text}"`;
        if (qAuthorSetup) qAuthorSetup.textContent = `— ${q.author}`;
        if (qTextTimer) qTextTimer.textContent = `"${q.text}"`;
        if (qAuthorTimer) qAuthorTimer.textContent = `— ${q.author}`;
    }

    updateRandomQuote('focus');

    // Render Statistics Dashboard Modal
    let activeStatsRange = 'today';

    // Helper: Format Seconds to Human readable (e.g. 1h 24m or 45m)
    function formatSecs(secs) {
        if (!secs || secs <= 0) return '0m';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    function formatLiveStreak(sec, limitMins) {
        if (sec < 60) return `⚡ ${sec}s / ${limitMins}m`;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return (s > 0) ? `⚡ ${m}m ${s}s / ${limitMins}m` : `⚡ ${m}m / ${limitMins}m`;
    }

    // Helper: Get Date Strings Array for Today, Week (7 days), or Month (30 days)
    function getDateRangeArray(range) {
        const dates = [];
        const days = range === 'month' ? 30 : (range === 'week' ? 7 : 1);
        const now = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }

    // Statistics Modal Handlers
    document.querySelectorAll('#btn-open-stats, .btn-stats-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            const targetModal = document.getElementById('stats-modal');
            if (targetModal) {
                targetModal.classList.add('active');
                renderStatsDashboard('today');
            }
        });
    });

    btnCloseStatsModal?.addEventListener('click', () => {
        const targetModal = document.getElementById('stats-modal');
        if (targetModal) targetModal.classList.remove('active');
    });

    document.querySelectorAll('.stats-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.getAttribute('data-range');
            renderStatsDashboard(range);
        });
    });

    // Default classification for popular apps
    const DEFAULT_APP_CATEGORIES = {
        'afterfx.exe': 'productive',
        'premiere.exe': 'productive',
        'photoshop.exe': 'productive',
        'illustrator.exe': 'productive',
        'blender.exe': 'productive',
        'figma.exe': 'productive',
        'canva.exe': 'productive',
        'audition.exe': 'productive',
        'obs64.exe': 'productive',
        'studio64.exe': 'productive',
        'code.exe': 'productive',
        'devenv.exe': 'productive',
        'rider64.exe': 'productive',
        'idea64.exe': 'productive',
        'pycharm64.exe': 'productive',
        'clion64.exe': 'productive',
        'webstorm64.exe': 'productive',
        'unity.exe': 'productive',
        'unrealeditor.exe': 'productive',
        'sublime_text.exe': 'productive',
        'cursor.exe': 'productive',
        'zed.exe': 'productive',
        'resolve.exe': 'productive',
        'antigravity ide.exe': 'productive',
        'antigravity.exe': 'productive',
        'git-bash.exe': 'productive',
        'windowsterminal.exe': 'productive',
        'powershell.exe': 'productive',
        'cmd.exe': 'productive',
        'word.exe': 'productive',
        'excel.exe': 'productive',
        'powerpnt.exe': 'productive',
        'notion.exe': 'productive',
        'obsidian.exe': 'productive',
        'steam.exe': 'distracting',
        'epicgameslauncher.exe': 'distracting',
        'discord.exe': 'distracting',
        'spotify.exe': 'distracting',
        'telegram.exe': 'distracting',
        'whatsapp.exe': 'distracting',
        'tiktok.exe': 'distracting'
    };

    function getAppCategory(exeName) {
        if (!exeName) return 'neutral';
        const lower = exeName.toLowerCase();
        userData.appCategories = userData.appCategories || {};
        if (userData.appCategories[lower]) {
            return userData.appCategories[lower];
        }
        if (DEFAULT_APP_CATEGORIES[lower]) {
            return DEFAULT_APP_CATEGORIES[lower];
        }
        return 'neutral';
    }

    function toggleAppCategory(exeName) {
        if (!exeName) return;
        const lower = exeName.toLowerCase();
        const current = getAppCategory(exeName);
        const next = current === 'productive' ? 'neutral' : (current === 'neutral' ? 'distracting' : 'productive');
        userData.appCategories = userData.appCategories || {};
        userData.appCategories[lower] = next;
        saveUserData();
        renderStatsDashboard(activeStatsRange);
    }

    function toggleQuickBlockApp(exeName) {
        if (!exeName) return;
        let blocked = userData.blockedApps || [];
        const lower = exeName.toLowerCase();
        const idx = blocked.findIndex(a => a.toLowerCase() === lower);
        if (idx >= 0) {
            blocked.splice(idx, 1);
            sendNotification('App Unblocked', `${exeName} removed from restricted apps.`, 'focus');
        } else {
            blocked.push(exeName);
            sendNotification('App Blocked', `${exeName} added to restricted apps list.`, 'focus');
        }
        userData.blockedApps = blocked;
        blockedApps = blocked;
        saveUserData();
        sendToCpp({ action: 'setBlacklist', blacklist: blocked });
        renderStatsDashboard(activeStatsRange);
        if (typeof window.renderAppList === 'function') {
            window.renderAppList(cachedAppList);
        }
    }

    function renderWeeklyChart() {
        const chartContainer = document.getElementById('stats-weekly-chart');
        if (!chartContainer) return;

        chartContainer.innerHTML = '';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();

        // Target daily goal in mins
        const dailyGoalHours = parseFloat(userData.dailyGoalHours) || 1;
        const dailyGoalMins = dailyGoalHours * 60;

        // Gather 7 days data first to determine dynamic scale
        const daysData = [];
        let maxMins = dailyGoalMins;

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = dayNames[d.getDay()];

            let mins = (dateStr === todayDateStr) ? (userData.completedMinutesToday || 0) : ((userData.completedMinutesByDate && userData.completedMinutesByDate[dateStr]) || 0);

            if (mins === 0 && userData.appStatsByDate && userData.appStatsByDate[dateStr]) {
                const dayApps = userData.appStatsByDate[dateStr];
                let totalSec = 0;
                for (const exe in dayApps) {
                    totalSec += dayApps[exe];
                }
                mins = Math.floor(totalSec / 60);
            }

            if (mins > maxMins) {
                maxMins = mins;
            }

            daysData.push({
                index: i,
                dateStr,
                dayName: (i === 0 ? 'Today' : dayName),
                mins
            });
        }

        if (maxMins <= 0) maxMins = 60;

        daysData.forEach(item => {
            const ratio = item.mins / maxMins;
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';

            const displayPercent = item.mins > 0 ? Math.max(6, Math.round(ratio * 100)) : 0;
            const isGoalMet = isGoalMetWithTolerance(item.mins, dailyGoalMins, dailyGoalHours);
            const hoursPart = Math.floor(item.mins / 60);
            const minsPart = item.mins % 60;
            const timeFormattedStr = `${hoursPart}h ${minsPart}m`;

            barWrapper.innerHTML = `
                <div class="chart-tooltip">
                    <div class="chart-tooltip-title">${item.dayName} (${item.dateStr})</div>
                    <div class="chart-tooltip-time">⏱️ ${timeFormattedStr} (${item.mins}m)</div>
                    <div class="chart-tooltip-status">${isGoalMet ? '🎉 Goal Met!' : '⏳ Target: ' + dailyGoalHours + 'h'}</div>
                </div>
                <div class="chart-bar-container">
                    <div class="chart-bar-fill ${isGoalMet ? 'goal-met' : ''}" style="height: ${displayPercent}%;">
                        ${item.mins >= (maxMins * 0.12) ? `<span class="bar-val-hint">${item.mins}m</span>` : ''}
                    </div>
                </div>
                <div class="chart-day-label">${item.dayName}</div>
            `;
            chartContainer.appendChild(barWrapper);
        });
    }

    let heatmapWeekOffset = 0;

    function renderHeatmapMatrix() {
        const matrix = document.getElementById('stats-github-heatmap-matrix');
        const monthsBar = document.getElementById('github-heatmap-months');
        const totalText = document.getElementById('heatmap-total-contributions-text');
        const periodLabel = document.getElementById('heatmap-period-label');
        if (!matrix || !monthsBar) return;
        matrix.innerHTML = '';
        monthsBar.innerHTML = '';

        const WEEKS_TO_SHOW = 34; // 34 weeks distributed with justify-content: space-between fills 100% width
        const dailyGoalMins = (userData.dailyGoalHours || 1) * 60;

        // End date adjusted by heatmapWeekOffset
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (heatmapWeekOffset * 7));
        
        // Find the Saturday of that week (end of week column)
        const endDayOfWeek = endDate.getDay();
        const currentSaturday = new Date(endDate);
        currentSaturday.setDate(currentSaturday.getDate() + (6 - endDayOfWeek));

        // Start date: (WEEKS_TO_SHOW * 7 - 1) days before currentSaturday
        const totalDays = WEEKS_TO_SHOW * 7;
        const startDate = new Date(currentSaturday);
        startDate.setDate(startDate.getDate() - (totalDays - 1));

        let totalPeriodMins = 0;
        let activeDaysCount = 0;
        const monthPositions = [];
        let lastMonth = -1;

        // Render columns (weeks) and rows (days 0..6: Sun..Sat)
        for (let col = 0; col < WEEKS_TO_SHOW; col++) {
            const weekCol = document.createElement('div');
            weekCol.className = 'github-week-col';

            for (let row = 0; row < 7; row++) {
                const dayIndex = col * 7 + row;
                const cellDate = new Date(startDate);
                cellDate.setDate(cellDate.getDate() + dayIndex);

                const dateStr = cellDate.toISOString().split('T')[0];
                const dayName = cellDate.toLocaleDateString('en-US', { weekday: 'short' });
                const monthName = cellDate.toLocaleDateString('en-US', { month: 'short' });
                const monthNum = cellDate.getMonth();

                // Detect month header boundary
                if (row === 0 && monthNum !== lastMonth) {
                    monthPositions.push({ name: monthName, colIndex: col });
                    lastMonth = monthNum;
                }

                let mins = (dateStr === todayDateStr) ? (userData.completedMinutesToday || 0) : ((userData.completedMinutesByDate && userData.completedMinutesByDate[dateStr]) || 0);

                if (mins === 0 && userData.appStatsByDate && userData.appStatsByDate[dateStr]) {
                    let totalSec = 0;
                    for (const exe in userData.appStatsByDate[dateStr]) {
                        totalSec += userData.appStatsByDate[dateStr][exe];
                    }
                    mins = Math.floor(totalSec / 60);
                }

                totalPeriodMins += mins;
                if (mins > 0) activeDaysCount++;

                let lvl = 'lvl-0';
                if (mins > 0) {
                    if (mins >= dailyGoalMins || mins >= 120) lvl = 'lvl-4';
                    else if (mins >= 60) lvl = 'lvl-3';
                    else if (mins >= 30) lvl = 'lvl-2';
                    else lvl = 'lvl-1';
                }

                const cell = document.createElement('div');
                cell.className = `github-cell ${lvl}`;
                const hoursPart = Math.floor(mins / 60);
                const minsPart = mins % 60;
                const formattedTime = (hoursPart > 0 ? `${hoursPart}h ` : '') + `${minsPart}m`;

                cell.title = `${dateStr} (${dayName}): ${mins > 0 ? formattedTime + ' focused' : 'No focus recorded'}`;
                weekCol.appendChild(cell);
            }
            matrix.appendChild(weekCol);
        }

        // Render Month Headers aligned with columns percentage
        monthPositions.forEach(m => {
            const span = document.createElement('span');
            span.className = 'github-month-label';
            span.textContent = m.name;
            const pct = (m.colIndex / (WEEKS_TO_SHOW - 1)) * 96;
            span.style.left = `${pct}%`;
            monthsBar.appendChild(span);
        });

        // Update header summary text
        const totalHours = (totalPeriodMins / 60).toFixed(1);
        if (totalText) {
            totalText.textContent = `${totalHours} hours focused in ${WEEKS_TO_SHOW} weeks (${activeDaysCount} active days)`;
        }

        // Update period label
        if (periodLabel) {
            const startMonthStr = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const endMonthStr = currentSaturday.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            periodLabel.textContent = `${startMonthStr} — ${endMonthStr}`;
        }
    }

    document.getElementById('btn-heatmap-prev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        heatmapWeekOffset -= 12; // Go back ~3 months
        renderHeatmapMatrix();
    });

    document.getElementById('btn-heatmap-next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        heatmapWeekOffset = Math.min(0, heatmapWeekOffset + 12); // Advance towards today
        renderHeatmapMatrix();
    });

    function renderPeakHoursChart(range = activeStatsRange) {
        const svg = document.getElementById('peak-wave-svg');
        const areaPath = document.getElementById('peak-wave-area');
        const linePath = document.getElementById('peak-wave-line');
        const markerGroup = document.getElementById('peak-marker-group');
        const markerDot = document.getElementById('peak-marker-dot');
        const markerPulse = document.getElementById('peak-marker-pulse');
        const hoverLine = document.getElementById('wave-hover-line');
        const hoverDot = document.getElementById('wave-hover-dot');
        const hoverTooltip = document.getElementById('wave-hover-tooltip');
        const waveContainer = document.getElementById('stats-peak-wave-container');
        const badge = document.getElementById('stats-chronotype-badge');
        const insight = document.getElementById('stats-peak-hours-insight');
        if (!areaPath || !linePath) return;

        const targetDates = getDateRangeArray(range);
        const hourlyBuckets = new Array(24).fill(0);

        // Aggregate hourly focus time
        targetDates.forEach(dateStr => {
            if (userData.hourlyFocusStats && userData.hourlyFocusStats[dateStr]) {
                const dayHours = userData.hourlyFocusStats[dateStr];
                for (let h = 0; h < 24; h++) {
                    if (dayHours[h]) hourlyBuckets[h] += dayHours[h];
                }
            } else {
                let dayMins = (dateStr === todayDateStr) ? (userData.completedMinutesToday || 0) : ((userData.completedMinutesByDate && userData.completedMinutesByDate[dateStr]) || 0);
                if (dayMins > 0) {
                    const rangeInfo = (userData.workTimeRangesByDate && userData.workTimeRangesByDate[dateStr]);
                    let startH = 9, endH = 18;
                    if (rangeInfo && rangeInfo.firstStart && rangeInfo.lastActive) {
                        const parseH = (tStr) => {
                            const match = tStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                            if (match) {
                                let h = parseInt(match[1], 10);
                                const isPM = (match[3] || '').toUpperCase() === 'PM';
                                const isAM = (match[3] || '').toUpperCase() === 'AM';
                                if (isPM && h < 12) h += 12;
                                if (isAM && h === 12) h = 0;
                                return h;
                            }
                            return 9;
                        };
                        startH = parseH(rangeInfo.firstStart);
                        endH = parseH(rangeInfo.lastActive);
                        if (endH < startH) endH = Math.min(23, startH + 4);
                    }
                    const numHours = Math.max(1, (endH - startH + 1));
                    const minsPerHour = Math.round(dayMins / numHours);
                    let rem = dayMins;
                    for (let h = startH; h <= endH; h++) {
                        const chunk = (h === endH) ? rem : Math.min(rem, minsPerHour);
                        hourlyBuckets[h] += chunk;
                        rem -= chunk;
                    }
                }
            }
        });

        let maxH = Math.max(1, ...hourlyBuckets);
        let peakWindowStart = 0;
        let peakWindowSum = 0;
        let highestSingleHour = 0;
        let highestSingleVal = 0;

        for (let h = 0; h < 24; h++) {
            const twoHourSum = hourlyBuckets[h] + hourlyBuckets[(h + 1) % 24];
            if (twoHourSum > peakWindowSum) {
                peakWindowSum = twoHourSum;
                peakWindowStart = h;
            }
            if (hourlyBuckets[h] > highestSingleVal) {
                highestSingleVal = hourlyBuckets[h];
                highestSingleHour = h;
            }
        }

        let peakHour = peakWindowStart;
        let peakWindow = `${String(peakHour).padStart(2, '0')}:00 — ${String((peakHour + 2) % 24).padStart(2, '0')}:00`;

        // Chronotype classification
        let persona = '🌙 Night Owl Coder';
        let personaColor = '#c084fc';
        if (peakHour >= 5 && peakHour < 12) {
            persona = '🌅 Early Bird Champion';
            personaColor = '#fbbf24';
        } else if (peakHour >= 12 && peakHour < 18) {
            persona = '⚡ Afternoon Flow Master';
            personaColor = '#60cdff';
        } else if (peakHour >= 18 && peakHour <= 23) {
            persona = '🌙 Night Owl Coder';
            personaColor = '#c084fc';
        } else {
            persona = '🌌 Midnight Hacker';
            personaColor = '#a78bfa';
        }

        if (badge) {
            badge.textContent = persona;
            badge.style.color = personaColor;
        }

        if (insight) {
            if (peakWindowSum > 0) {
                const peakHPart = Math.floor(peakWindowSum / 60);
                const peakMPart = peakWindowSum % 60;
                const formattedPeak = (peakHPart > 0 ? `${peakHPart}h ` : '') + `${peakMPart}m`;
                insight.innerHTML = `🔥 Your peak concentration flow is around <strong>${peakWindow}</strong> (${formattedPeak} focused).`;
            } else {
                insight.innerHTML = `💡 Start focus sessions throughout the day to calculate your peak productivity curve.`;
            }
        }

        // Calculate 24 points for the SVG (viewBox 0 0 500 100)
        // Baseline Y = 88, Peak Y = 16
        const points = [];
        for (let h = 0; h < 24; h++) {
            const x = (h / 23) * 500;
            const val = hourlyBuckets[h];
            const y = (maxH > 0 && val > 0) ? (88 - ((val / maxH) * 70)) : 88;
            points.push({ x, y, val, hour: h });
        }

        // Generate Monotone Spline Path
        let lineD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i === 0 ? 0 : i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

            const cp1x = p1.x + (p2.x - p0.x) / 5;
            const cp1y = p1.y + (p2.y - p0.y) / 5;
            const cp2x = p2.x - (p3.x - p1.x) / 5;
            const cp2y = p2.y - (p3.y - p1.y) / 5;

            lineD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }

        const areaD = lineD + ` L 500 88 L 0 88 Z`;
        linePath.setAttribute('d', lineD);
        areaPath.setAttribute('d', areaD);

        // Position Peak Pulse Marker
        if (markerGroup && highestSingleVal > 0) {
            const peakPt = points[highestSingleHour];
            markerGroup.style.display = 'block';
            markerDot.setAttribute('cx', peakPt.x);
            markerDot.setAttribute('cy', peakPt.y);
            markerPulse.setAttribute('cx', peakPt.x);
            markerPulse.setAttribute('cy', peakPt.y);
        } else if (markerGroup) {
            markerGroup.style.display = 'none';
        }

        // Interactive Tooltip & Crosshair on Hover
        if (waveContainer && hoverLine && hoverDot && hoverTooltip) {
            waveContainer.onmousemove = (e) => {
                const rect = waveContainer.getBoundingClientRect();
                const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const ratio = mouseX / rect.width;
                const hourIndex = Math.round(ratio * 23);
                const pt = points[hourIndex];

                const svgX = (hourIndex / 23) * 500;
                hoverLine.setAttribute('x1', svgX);
                hoverLine.setAttribute('x2', svgX);
                hoverLine.style.display = 'block';

                hoverDot.setAttribute('cx', svgX);
                hoverDot.setAttribute('cy', pt.y);
                hoverDot.style.display = 'block';

                hoverTooltip.textContent = `${String(pt.hour).padStart(2, '0')}:00 — ${pt.val} min focused`;
                hoverTooltip.style.left = `${(svgX / 500) * rect.width}px`;
                hoverTooltip.classList.add('show');
            };

            waveContainer.onmouseleave = () => {
                hoverLine.style.display = 'none';
                hoverDot.style.display = 'none';
                hoverTooltip.classList.remove('show');
            };
        }
    }

    function renderStatsDashboard(range = activeStatsRange) {
        activeStatsRange = range;
        
        document.querySelectorAll('.stats-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-range') === range);
        });

        const targetDates = getDateRangeArray(range);
        
        let totalSecs = 0;
        const appMap = {};
        userData.appStatsByDate = userData.appStatsByDate || {};
        userData.workTimeRangesByDate = userData.workTimeRangesByDate || {};

        targetDates.forEach(dateStr => {
            const dayStats = userData.appStatsByDate[dateStr];
            if (dayStats) {
                Object.keys(dayStats).forEach(exe => {
                    const sec = dayStats[exe] || 0;
                    totalSecs += sec;
                    appMap[exe] = (appMap[exe] || 0) + sec;
                });
            }
        });

        // Summary Cards
        document.getElementById('stats-kpi-total-time').textContent = formatSecs(totalSecs);

        const totalMins = Math.floor(totalSecs / 60);
        const daysCount = (range === 'month' ? 30 : (range === 'week' ? 7 : 1));
        const targetGoalMins = (userData.dailyGoalHours || 1) * 60 * daysCount;
        const goalPercent = Math.min(100, Math.round((totalMins / targetGoalMins) * 100));
        
        document.getElementById('stats-kpi-goal-percent').textContent = `${goalPercent}%`;
        document.getElementById('stats-kpi-goal-sub').textContent = `Target: ${(targetGoalMins / 60).toFixed(0)} hrs`;
        document.getElementById('stats-kpi-streak').textContent = `${userData.streakDays || 0} Days`;

        // Active Work Window (First Start - Last Active)
        const todayRange = userData.workTimeRangesByDate[todayDateStr];
        const workWinElem = document.getElementById('stats-kpi-work-window');
        if (todayRange && todayRange.firstStart) {
            workWinElem.textContent = `${todayRange.firstStart} - ${todayRange.lastActive}`;
        } else {
            workWinElem.textContent = 'Not started';
        }

        // Productivity Score Calculation
        const sortedApps = Object.keys(appMap)
            .map(exe => ({ exe, secs: appMap[exe] }))
            .sort((a, b) => b.secs - a.secs);

        let productiveSecs = 0;
        let neutralSecs = 0;
        let distractingSecs = 0;

        sortedApps.forEach(item => {
            const cat = getAppCategory(item.exe);
            if (cat === 'productive') productiveSecs += item.secs;
            else if (cat === 'neutral') neutralSecs += item.secs;
            else distractingSecs += item.secs;
        });

        const prodScore = totalSecs > 0 ? Math.min(100, Math.round(((productiveSecs * 1.0 + neutralSecs * 0.5) / totalSecs) * 100)) : 100;
        const prodScoreElem = document.getElementById('stats-kpi-prod-score');
        if (prodScoreElem) {
            prodScoreElem.textContent = `${prodScore}%`;
            prodScoreElem.style.color = prodScore >= 80 ? 'var(--accent-green)' : (prodScore >= 50 ? 'var(--accent-blue)' : '#f87171');
        }

        const ignoredCount = (userData.ignoredNudgeStatsByDate && userData.ignoredNudgeStatsByDate[todayDateStr]) || 0;
        const distractionsElem = document.getElementById('stats-kpi-distractions');
        if (distractionsElem) {
            distractionsElem.textContent = `${ignoredCount}x`;
            distractionsElem.style.color = ignoredCount === 0 ? 'var(--accent-green)' : (ignoredCount <= 2 ? '#fb923c' : '#f87171');
        }

        // Goal Bar
        document.getElementById('stats-goal-target-text').textContent = `${(targetGoalMins / 60).toFixed(1)} hrs (${range})`;
        const remMins = Math.max(0, targetGoalMins - totalMins);
        document.getElementById('stats-goal-status-text').textContent = remMins > 0 ? `${(remMins / 60).toFixed(1)} hrs remaining` : `Goal Met! 🎉`;
        document.getElementById('stats-goal-bar-fill').style.width = `${goalPercent}%`;

        // Ranked App List
        const statsAppListContainer = document.getElementById('stats-app-list-container');
        statsAppListContainer.innerHTML = '';

        if (sortedApps.length === 0) {
            statsAppListContainer.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">No focus data recorded for this period yet. Start a focus session to track app statistics!</div>`;
            return;
        }

        const maxAppSecs = sortedApps[0].secs || 1;
        const blockedList = (userData.blockedApps || []).map(a => a.toLowerCase());

        renderWeeklyChart();
        renderHeatmapMatrix();
        renderPeakHoursChart(range);

        sortedApps.forEach(item => {
            const percent = totalSecs > 0 ? Math.round((item.secs / totalSecs) * 100) : 0;
            const relativePercent = Math.round((item.secs / maxAppSecs) * 100);
            const lowerExe = item.exe.toLowerCase();
            const category = getAppCategory(item.exe);
            const isBlocked = blockedList.includes(lowerExe);

            // Lookup real extracted icon from userData.appIconMap or cachedAppList
            let appIcon = (userData.appIconMap && userData.appIconMap[lowerExe]) || '';
            if (!appIcon && cachedAppList && cachedAppList.length > 0) {
                const found = cachedAppList.find(a => a.exeName && a.exeName.toLowerCase() === lowerExe);
                if (found && found.icon && found.icon.length > 30) appIcon = found.icon;
            }
            if (!appIcon) appIcon = defaultIconSvg;

            const div = document.createElement('div');
            div.className = 'stats-app-item';
            div.setAttribute('data-exe', lowerExe);

            const topDiv = document.createElement('div');
            topDiv.className = 'stats-app-top';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'stats-app-name';

            const imgNode = document.createElement('img');
            imgNode.className = 'stats-app-icon';
            imgNode.style.cssText = 'width: 16px; height: 16px; object-fit: contain; vertical-align: -3px; margin-right: 8px; border-radius: 3px;';
            imgNode.src = appIcon || defaultIconSvg;
            imgNode.onerror = () => { imgNode.src = defaultIconSvg; };

            const spanNode = document.createElement('span');
            spanNode.textContent = item.exe;

            nameDiv.appendChild(imgNode);
            nameDiv.appendChild(spanNode);

            // Category Pill (Clickable)
            const catPill = document.createElement('span');
            catPill.className = `cat-pill ${category}`;
            const catIcon = category === 'productive' ? '🟢' : (category === 'neutral' ? '🔵' : '🔴');
            catPill.innerHTML = `<span>${catIcon}</span> <span>${category}</span>`;
            catPill.title = 'Click to toggle category (Productive / Neutral / Distracting)';
            catPill.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleAppCategory(item.exe);
            });
            nameDiv.appendChild(catPill);

            // Live Overstay Streak Badge (Compact, real-time seconds & minutes)
            if (lastContinuousExe && lastContinuousExe.toLowerCase() === lowerExe && continuousNeutralSec > 0 && category !== 'productive') {
                const limitMins = parseInt(userData.neutralOverstayIntervalMins) || 30;
                const liveBadge = document.createElement('span');
                liveBadge.id = 'live-overstay-streak-badge';
                liveBadge.className = 'live-streak-pill';
                liveBadge.style.cssText = 'background: rgba(96, 205, 255, 0.12); border: 1px solid rgba(96, 205, 255, 0.3); color: #60cdff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; margin-left: 6px;';
                const liveMins = Math.floor(continuousNeutralSec / 60);
                if (liveMins >= limitMins) {
                    liveBadge.style.background = 'rgba(248, 113, 113, 0.15)';
                    liveBadge.style.borderColor = 'rgba(248, 113, 113, 0.35)';
                    liveBadge.style.color = '#f87171';
                } else if (liveMins >= limitMins * 0.7) {
                    liveBadge.style.background = 'rgba(251, 146, 60, 0.15)';
                    liveBadge.style.borderColor = 'rgba(251, 146, 60, 0.35)';
                    liveBadge.style.color = '#fb923c';
                }
                liveBadge.textContent = formatLiveStreak(continuousNeutralSec, limitMins);
                liveBadge.title = `Active continuous duration: ${continuousNeutralSec}s (Limit: ${limitMins}m)`;
                nameDiv.appendChild(liveBadge);
            }

            // Right side: Time and Quick Block Button
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'stats-app-actions';

            const timeDiv = document.createElement('div');
            timeDiv.className = 'stats-app-time';
            timeDiv.textContent = `${formatSecs(item.secs)} (${percent}%)`;

            const blockBtn = document.createElement('button');
            blockBtn.className = `btn-quick-block ${isBlocked ? 'blocked' : ''}`;
            blockBtn.innerHTML = isBlocked ? '🔒 Blocked' : '🚫 Block';
            blockBtn.title = isBlocked ? 'App is restricted during focus. Click to unblock.' : 'Click to restrict this app during focus sessions.';
            blockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleQuickBlockApp(item.exe);
            });

            actionsDiv.appendChild(timeDiv);
            actionsDiv.appendChild(blockBtn);

            topDiv.appendChild(nameDiv);
            topDiv.appendChild(actionsDiv);

            const barBgDiv = document.createElement('div');
            barBgDiv.className = 'stats-app-bar-bg';

            const barFillDiv = document.createElement('div');
            barFillDiv.className = 'stats-app-bar-fill';
            barFillDiv.style.width = `${relativePercent}%`;

            barBgDiv.appendChild(barFillDiv);

            div.appendChild(topDiv);
            div.appendChild(barBgDiv);

            statsAppListContainer.appendChild(div);
        });
    }

    // ============================================================
    // Share / Report Card Modal Logic & Canvas Image Exporter
    // ============================================================
    const btnOpenShareCard = document.getElementById('btn-open-share-card');
    const shareCardModal = document.getElementById('share-card-modal');
    const btnCloseShareModal = document.getElementById('btn-close-share-modal');
    const btnCopyShareText = document.getElementById('btn-copy-share-text');
    const btnDownloadShareCard = document.getElementById('btn-download-share-card');

    function openShareCardModal() {
        if (!shareCardModal) return;
        shareCardModal.classList.add('active');

        const todayStats = (userData.appStatsByDate && userData.appStatsByDate[todayDateStr]) || {};
        let totalSecs = 0;
        const appMap = {};
        Object.keys(todayStats).forEach(exe => {
            const sec = todayStats[exe] || 0;
            totalSecs += sec;
            appMap[exe] = sec;
        });

        const sortedApps = Object.keys(appMap)
            .map(exe => ({ exe, secs: appMap[exe] }))
            .sort((a, b) => b.secs - a.secs);

        let productiveSecs = 0;
        let neutralSecs = 0;
        sortedApps.forEach(item => {
            const cat = getAppCategory(item.exe);
            if (cat === 'productive') productiveSecs += item.secs;
            else if (cat === 'neutral') neutralSecs += item.secs;
        });

        const prodScore = totalSecs > 0 ? Math.min(100, Math.round(((productiveSecs * 1.0 + neutralSecs * 0.5) / totalSecs) * 100)) : 100;
        const totalMins = Math.floor(totalSecs / 60);
        const targetGoalMins = (userData.dailyGoalHours || 1) * 60;
        const goalPercent = Math.min(100, Math.round((totalMins / targetGoalMins) * 100));

        // Format Date
        const now = new Date();
        const dateOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
        document.getElementById('share-card-date-badge').textContent = now.toLocaleDateString('en-US', dateOptions);

        // Fill Hero
        document.getElementById('share-hero-time').textContent = formatSecs(totalSecs);
        document.getElementById('share-card-score-badge').textContent = `${prodScore}% Focus Score`;
        document.getElementById('share-card-streak-badge').textContent = `${userData.streakDays || 0} Days Streak`;

        // Fill Progress
        const todayRange = (userData.workTimeRangesByDate && userData.workTimeRangesByDate[todayDateStr]) || {};
        const winStr = todayRange.firstStart ? `${todayRange.firstStart} - ${todayRange.lastActive}` : '09:00 AM - Current';
        document.getElementById('share-card-goal-label').textContent = `Goal Met: ${goalPercent}% (${(userData.dailyGoalHours || 1).toFixed(1)} hrs)`;
        document.getElementById('share-card-window-label').textContent = `Window: ${winStr}`;
        document.getElementById('share-card-bar-fill').style.width = `${goalPercent}%`;

        // Fill Top 3 Apps
        const appsListContainer = document.getElementById('share-card-apps-list');
        appsListContainer.innerHTML = '';

        const top3 = sortedApps.slice(0, 3);
        if (top3.length === 0) {
            appsListContainer.innerHTML = `<div style="text-align:center; font-size:10px; color:var(--text-muted); padding:6px;">No focus apps logged today yet.</div>`;
        } else {
            top3.forEach(item => {
                const lowerExe = item.exe.toLowerCase();
                let appIcon = (userData.appIconMap && userData.appIconMap[lowerExe]) || '';
                if (!appIcon && cachedAppList && cachedAppList.length > 0) {
                    const found = cachedAppList.find(a => a.exeName && a.exeName.toLowerCase() === lowerExe);
                    if (found && found.icon && found.icon.length > 30) appIcon = found.icon;
                }
                if (!appIcon) appIcon = defaultIconSvg;

                const percent = totalSecs > 0 ? Math.round((item.secs / totalSecs) * 100) : 0;
                const row = document.createElement('div');
                row.className = 'share-app-row';
                row.innerHTML = `
                    <div class="share-app-row-left">
                        <img src="${appIcon}" class="share-app-row-icon" onerror="this.src='${defaultIconSvg}'" />
                        <span class="share-app-row-name">${item.exe}</span>
                    </div>
                    <span class="share-app-row-time">${formatSecs(item.secs)} (${percent}%)</span>
                `;
                appsListContainer.appendChild(row);
            });
        }
    }

    btnOpenShareCard?.addEventListener('click', openShareCardModal);
    btnCloseShareModal?.addEventListener('click', () => {
        if (shareCardModal) shareCardModal.classList.remove('active');
    });

    // Copy formatted report text
    btnCopyShareText?.addEventListener('click', () => {
        const todayStats = (userData.appStatsByDate && userData.appStatsByDate[todayDateStr]) || {};
        let totalSecs = 0;
        const appMap = {};
        Object.keys(todayStats).forEach(exe => {
            const sec = todayStats[exe] || 0;
            totalSecs += sec;
            appMap[exe] = sec;
        });

        const sortedApps = Object.keys(appMap)
            .map(exe => ({ exe, secs: appMap[exe] }))
            .sort((a, b) => b.secs - a.secs);

        let productiveSecs = 0;
        let neutralSecs = 0;
        sortedApps.forEach(item => {
            const cat = getAppCategory(item.exe);
            if (cat === 'productive') productiveSecs += item.secs;
            else if (cat === 'neutral') neutralSecs += item.secs;
        });
        const prodScore = totalSecs > 0 ? Math.min(100, Math.round(((productiveSecs * 1.0 + neutralSecs * 0.5) / totalSecs) * 100)) : 100;

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const todayRange = (userData.workTimeRangesByDate && userData.workTimeRangesByDate[todayDateStr]) || {};
        const winStr = todayRange.firstStart ? `${todayRange.firstStart} - ${todayRange.lastActive}` : 'Active session';

        let appText = '';
        sortedApps.slice(0, 3).forEach((item, idx) => {
            const percent = totalSecs > 0 ? Math.round((item.secs / totalSecs) * 100) : 0;
            appText += `\n  ${idx + 1}. ${item.exe} — ${formatSecs(item.secs)} (${percent}%)`;
        });

        const textReport = `🌱 FocusGrow Productivity Report — ${dateStr}
⏱️ Total Focus: ${formatSecs(totalSecs)}
⚡ Focus Efficiency: ${prodScore}%
🔥 Streak: ${userData.streakDays || 0} Days
🕒 Active Window: ${winStr}
🏆 Top Applications:${appText || ' None yet'}

#StayFocused #FocusGrow`;

        navigator.clipboard.writeText(textReport).then(() => {
            sendNotification('Report Copied', 'Daily focus report copied to clipboard!', 'focus');
        }).catch(() => {
            sendNotification('Copy Failed', 'Unable to access clipboard.', 'focus');
        });
    });

    // High-Resolution Canvas Card Exporter
    btnDownloadShareCard?.addEventListener('click', () => {
        const todayStats = (userData.appStatsByDate && userData.appStatsByDate[todayDateStr]) || {};
        let totalSecs = 0;
        const appMap = {};
        Object.keys(todayStats).forEach(exe => {
            const sec = todayStats[exe] || 0;
            totalSecs += sec;
            appMap[exe] = sec;
        });

        const sortedApps = Object.keys(appMap)
            .map(exe => ({ exe, secs: appMap[exe] }))
            .sort((a, b) => b.secs - a.secs);

        let productiveSecs = 0;
        let neutralSecs = 0;
        sortedApps.forEach(item => {
            const cat = getAppCategory(item.exe);
            if (cat === 'productive') productiveSecs += item.secs;
            else if (cat === 'neutral') neutralSecs += item.secs;
        });
        const prodScore = totalSecs > 0 ? Math.min(100, Math.round(((productiveSecs * 1.0 + neutralSecs * 0.5) / totalSecs) * 100)) : 100;

        const canvas = document.createElement('canvas');
        const width = 800;
        const height = 520;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#121824');
        bgGrad.addColorStop(1, '#080c10');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Neon ambient glow circles
        const glow1 = ctx.createRadialGradient(width - 50, 50, 10, width - 50, 50, 220);
        glow1.addColorStop(0, 'rgba(96, 205, 255, 0.28)');
        glow1.addColorStop(1, 'rgba(96, 205, 255, 0)');
        ctx.fillStyle = glow1;
        ctx.fillRect(0, 0, width, height);

        const glow2 = ctx.createRadialGradient(50, height - 50, 10, 50, height - 50, 220);
        glow2.addColorStop(0, 'rgba(74, 222, 128, 0.24)');
        glow2.addColorStop(1, 'rgba(74, 222, 128, 0)');
        ctx.fillStyle = glow2;
        ctx.fillRect(0, 0, width, height);

        // Card Border
        ctx.strokeStyle = 'rgba(96, 205, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        // Header: Brand & Date
        ctx.fillStyle = '#60cdff';
        ctx.font = 'bold 28px "Segoe UI", sans-serif';
        ctx.fillText('🌱 FocusGrow', 40, 60);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.fillText('Daily Focus Intelligence', 40, 82);

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 16px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(dateStr, width - 40, 60);
        ctx.textAlign = 'left';

        // Horizontal Separator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 100);
        ctx.lineTo(width - 40, 100);
        ctx.stroke();

        // Hero Metric: Big Time
        ctx.fillStyle = '#8899a6';
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
        ctx.fillText('TOTAL FOCUS TIME', 40, 140);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Segoe UI", sans-serif';
        ctx.fillText(formatSecs(totalSecs), 40, 200);

        // Badges on Right
        // Efficiency Badge
        ctx.fillStyle = 'rgba(74, 222, 128, 0.15)';
        ctx.fillRect(width - 260, 125, 220, 36);
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
        ctx.strokeRect(width - 260, 125, 220, 36);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 15px "Segoe UI", sans-serif';
        ctx.fillText(`⚡ ${prodScore}% Efficiency Score`, width - 245, 149);

        // Streak Badge
        ctx.fillStyle = 'rgba(251, 146, 60, 0.15)';
        ctx.fillRect(width - 260, 170, 220, 36);
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)';
        ctx.strokeRect(width - 260, 170, 220, 36);
        ctx.fillStyle = '#fb923c';
        ctx.font = 'bold 15px "Segoe UI", sans-serif';
        ctx.fillText(`🔥 ${userData.streakDays || 0} Days Streak`, width - 245, 194);

        // Top Apps Section
        ctx.fillStyle = '#8899a6';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.fillText('TOP FOCUS APPLICATIONS', 40, 250);

        const top3 = sortedApps.slice(0, 3);
        let startY = 270;
        if (top3.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '14px "Segoe UI", sans-serif';
            ctx.fillText('No focus activity recorded today.', 40, startY + 20);
        } else {
            top3.forEach((item, idx) => {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
                ctx.fillRect(40, startY, width - 80, 40);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.strokeRect(40, startY, width - 80, 40);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px "Segoe UI", sans-serif';
                ctx.fillText(`${idx + 1}.  ${item.exe}`, 60, startY + 25);

                const percent = totalSecs > 0 ? Math.round((item.secs / totalSecs) * 100) : 0;
                ctx.fillStyle = '#60cdff';
                ctx.textAlign = 'right';
                ctx.fillText(`${formatSecs(item.secs)} (${percent}%)`, width - 60, startY + 25);
                ctx.textAlign = 'left';

                startY += 48;
            });
        }

        // Footer
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(40, height - 55);
        ctx.lineTo(width - 40, height - 55);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'italic 13px "Segoe UI", sans-serif';
        ctx.fillText('"Deep focus creates masterpiece results."', 40, height - 30);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(96, 205, 255, 0.7)';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.fillText('FocusGrow OS • Windows', width - 40, height - 30);

        // Trigger Download
        const link = document.createElement('a');
        link.download = `FocusGrow-Productivity-Card-${todayDateStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        sendNotification('Card Downloaded', 'Focus productivity card exported as PNG image!', 'focus');
    });

    // Process C++ IPC Messages & Trigger Notifications
    window.onCppStateUpdate = function(data, isPip) {
        if (!data) return;

        activeState = data.state;
        isPaused = data.isPaused;

        // --- Session Persistence: Save active session metadata ---
        if (activeState !== 'idle') {
            userData.activeSession = {
                state: activeState,
                remainingSec: data.remainingSec,
                currentPeriod: data.currentPeriod,
                totalPeriods: data.totalPeriods,
                focusMins: selectedMins,
                chunkMins: selectedPeriodMins,
                breakMins: selectedBreakMins,
                skipBreaks: chkSkipBreaks.checked,
                timestamp: Date.now()
            };
        } else {
            delete userData.activeSession;
        }

        // --- Prayer Times State Sync ---
        if (data.prayer) {
            const prevActualNext = window.actualNextPrayerName;
            window.allPrayerTimes = data.prayer.allTimes || [];
            window.actualNextPrayerName = data.prayer.nextName;

            const isViewingActualNext = window.displayedPrayerIndex !== -1 &&
                window.allPrayerTimes[window.displayedPrayerIndex]?.name === prevActualNext;

            if (window.displayedPrayerIndex === undefined || window.displayedPrayerIndex === -1 || isViewingActualNext) {
                window.displayedPrayerIndex = window.allPrayerTimes.findIndex(p => p.name === window.actualNextPrayerName);
            }

            if (typeof window.renderPrayerInfo === 'function') window.renderPrayerInfo();
        }

        saveUserData();

        // Record per-app focus time tick (1 sec) & work hours window
        if (activeState === 'focusing' && !isPaused && data.activeExe) {
            userData.appStatsByDate = userData.appStatsByDate || {};
            userData.appStatsByDate[todayDateStr] = userData.appStatsByDate[todayDateStr] || {};
            const currentSec = userData.appStatsByDate[todayDateStr][data.activeExe] || 0;
            userData.appStatsByDate[todayDateStr][data.activeExe] = currentSec + 1;

            const timeNowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            userData.workTimeRangesByDate = userData.workTimeRangesByDate || {};
            if (!userData.workTimeRangesByDate[todayDateStr]) {
                userData.workTimeRangesByDate[todayDateStr] = { firstStart: timeNowStr, lastActive: timeNowStr };
            } else {
                userData.workTimeRangesByDate[todayDateStr].lastActive = timeNowStr;
            }

            saveUserData();
        }

        // Neutral App Overstay Guard & Gentle Distraction Nudge Tracking (Anti-Abuse Recovery Model)
        if (data.activeExe) {
            const exeCat = getAppCategory(data.activeExe);
            const lowerExe = data.activeExe.toLowerCase();

            if (exeCat === 'productive') {
                lastProductiveExe = data.activeExe;
                continuousProductiveSec += 1;

                // Temporarily hide soft-block overlay while user is viewing their productive work app
                if (isNeutralSoftBlockActive) {
                    sendToCpp({ action: 'hideNeutralOverstayBlock' });
                }

                // Anti-Abuse: Must sustain at least 60 seconds (1 min) of continuous productive work
                // to officially forgive and reset the neutral/distraction overstay streak
                if (continuousProductiveSec >= 60) {
                    continuousNeutralSec = 0;
                    isNeutralSoftBlockActive = false;
                }
            } else if (exeCat === 'neutral' || exeCat === 'distracting') {
                // Ignore internal and OS shell processes from distraction streak
                if (lowerExe !== 'focusgrow.exe' && lowerExe !== 'dwm.exe' && lowerExe !== 'explorer.exe' && lowerExe !== 'taskmgr.exe') {
                    // Reset productive recovery counter if user left the productive app before reaching 60s
                    continuousProductiveSec = 0;

                    if (lastContinuousExe === data.activeExe) {
                        continuousNeutralSec += 1;
                    } else {
                        lastContinuousExe = data.activeExe;
                        continuousNeutralSec += 1;
                    }

                    if (userData.neutralOverstayEnabled !== false) {
                        const intervalMins = parseInt(userData.neutralOverstayIntervalMins) || 30;
                        const intervalSec = intervalMins * 60;

                        // First Warning: 1x Interval reached (e.g. 15 / 30 mins)
                        if (continuousNeutralSec === intervalSec) {
                            userData.ignoredNudgeStatsByDate = userData.ignoredNudgeStatsByDate || {};
                            userData.ignoredNudgeStatsByDate[todayDateStr] = (userData.ignoredNudgeStatsByDate[todayDateStr] || 0) + 1;
                            saveUserData();
                            if (typeof renderStatsDashboard === 'function') renderStatsDashboard(activeStatsRange);

                            const targetApp = lastProductiveExe || 'your work app';
                            sendNotification(
                                'Neutral App Reminder',
                                `You've been in ${data.activeExe} for ${intervalMins} mins. Ready to return to ${targetApp}?`,
                                'focus'
                            );
                            playNotificationSound('reminder');
                        }
                        // Second Warning or Re-trigger: 2x Interval reached (e.g. 30 / 60 mins) -> Soft-Block!
                        else if (continuousNeutralSec >= intervalSec * 2) {
                            if (!isNeutralSoftBlockActive) {
                                isNeutralSoftBlockActive = true;
                                userData.ignoredNudgeStatsByDate = userData.ignoredNudgeStatsByDate || {};
                                userData.ignoredNudgeStatsByDate[todayDateStr] = (userData.ignoredNudgeStatsByDate[todayDateStr] || 0) + 1;
                                saveUserData();
                                if (typeof renderStatsDashboard === 'function') renderStatsDashboard(activeStatsRange);

                                sendNotification(
                                    'Time to Refocus',
                                    `2x warnings ignored (${Math.floor(continuousNeutralSec / 60)} mins in ${data.activeExe}). Take a step back and resume work!`,
                                    'focus'
                                );
                                playNotificationSound('alarm');
                            }

                            // Ensure soft block overlay is visible if user remains in or returns to neutral app
                            if (userData.neutralSoftBlockEnabled !== false) {
                                sendToCpp({
                                    action: 'showNeutralOverstayBlock',
                                    exeName: data.activeExe,
                                    durationMins: Math.floor(continuousNeutralSec / 60)
                                });
                            }
                        }
                    }
                }
            }
        }

        // Live Real-Time second-by-second ticker update on the active streak badge in Stats DOM
        function updateLiveStreakInStatsDOM() {
            const statsModal = document.getElementById('stats-modal');
            if (!statsModal || !statsModal.classList.contains('active')) return;

            const limitMins = parseInt(userData.neutralOverstayIntervalMins) || 30;
            const liveText = formatLiveStreak(continuousNeutralSec, limitMins);
            const liveMins = Math.floor(continuousNeutralSec / 60);

            // Remove any stale badge on non-active rows
            document.querySelectorAll('.live-streak-pill').forEach(el => {
                const parentRow = el.closest('.stats-app-item');
                const rowExe = parentRow?.getAttribute('data-exe') || '';
                if (!lastContinuousExe || rowExe.toLowerCase() !== lastContinuousExe.toLowerCase() || continuousNeutralSec <= 0) {
                    el.remove();
                }
            });

            if (lastContinuousExe && continuousNeutralSec > 0) {
                const targetLower = lastContinuousExe.toLowerCase();
                const targetCat = getAppCategory(lastContinuousExe);
                if (targetCat !== 'productive') {
                    const row = document.querySelector(`.stats-app-item[data-exe="${targetLower}"]`);
                    if (row) {
                        const nameDiv = row.querySelector('.stats-app-name');
                        if (nameDiv) {
                            let badge = nameDiv.querySelector('.live-streak-pill');
                            if (!badge) {
                                badge = document.createElement('span');
                                badge.className = 'live-streak-pill';
                                badge.id = 'live-overstay-streak-badge';
                                badge.style.cssText = 'background: rgba(96, 205, 255, 0.12); border: 1px solid rgba(96, 205, 255, 0.3); color: #60cdff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; margin-left: 6px;';
                                nameDiv.appendChild(badge);
                            }
                            badge.textContent = liveText;
                            if (liveMins >= limitMins) {
                                badge.style.background = 'rgba(248, 113, 113, 0.15)';
                                badge.style.borderColor = 'rgba(248, 113, 113, 0.35)';
                                badge.style.color = '#f87171';
                            } else if (liveMins >= limitMins * 0.7) {
                                badge.style.background = 'rgba(251, 146, 60, 0.15)';
                                badge.style.borderColor = 'rgba(251, 146, 60, 0.35)';
                                badge.style.color = '#fb923c';
                            } else {
                                badge.style.background = 'rgba(96, 205, 255, 0.12)';
                                badge.style.borderColor = 'rgba(96, 205, 255, 0.3)';
                                badge.style.color = '#60cdff';
                            }
                        }
                    }
                }
            }
        }
        updateLiveStreakInStatsDOM();

        if (activeState !== previousState) {
            if (activeState === 'focusing' && previousState === 'idle') {
                sendNotification('Focus Mode Started', `Session started! Period 1 of ${data.totalPeriods || 1}. Stay focused!`, 'focus');
                updateRandomQuote('focus');
            } else if (activeState === 'resting') {
                sendNotification('Time to Rest', `Focus period done! Step away from your computer for a ${selectedBreakMins} min break.`, 'break');
                updateRandomQuote('rest');
            } else if (activeState === 'focusing' && previousState === 'resting') {
                sendNotification('Focus Mode Active', `Break finished! Return to your work application.`, 'focus');
                updateRandomQuote('focus');
            } else if (activeState === 'idle' && (previousState === 'focusing' || previousState === 'resting')) {
                sendNotification('Session Completed', `Great job! Focus session completed successfully.`, 'focus');
                updateRandomQuote('focus');
                
                // Auto-exit PiP mode when focus session completes, restoring to full main window
                if (document.body.classList.contains('pip-mode')) {
                    isInitializingPip = true;
                    setTimeout(() => { isInitializingPip = false; }, 1500);
                    document.body.classList.remove('pip-mode');
                    sendToCpp({ action: 'togglePip' });
                }
            }
            previousState = activeState;
            notifiedOneMinWarning = false;
        }

        const warnSec = (data.maxPeriodSec <= 60) ? 30 : 60;
        if (data.remainingSec === warnSec && !notifiedOneMinWarning) {
            notifiedOneMinWarning = true;
            const warnText = (data.maxPeriodSec <= 60) ? '30 seconds' : '1 minute';
            if (activeState === 'focusing') {
                sendNotification('Period Warning', `${warnText} left of focus period! Get ready to take a break.`, 'focus');
            } else if (activeState === 'resting') {
                sendNotification('Break Warning', `${warnText} left of break! Prepare to resume focus.`, 'break');
            }
        }

        const titlebarText = document.getElementById('titlebar-text');

        if (isPip) {
            document.body.classList.add('pip-mode');
        } else {
            document.body.classList.remove('pip-mode');
        }
        updatePipPeekingVinyl();
        setTimeout(syncVinylCenterPosition, 10);
        setTimeout(syncVinylCenterPosition, 50);
        if (titlebarText) titlebarText.textContent = 'FocusGrow';

        if (data.formattedTime) {
            activeTimerDisplay.textContent = data.formattedTime;
        }

        if (data.completedMinutes !== undefined && data.completedMinutes > userData.completedMinutesToday) {
            userData.completedMinutesToday = data.completedMinutes;
            saveUserData();
        }

        updateStatsUI();

        const autoPauseLabel = document.getElementById('auto-pause-label');

        if (activeState === 'focusing') {
            setupView.classList.remove('active');
            timerView.classList.add('active');
            activeStatusLabel.textContent = isPaused ? 'PAUSED' : 'REMAINING';
            focusPeriodTitle.textContent = `Focus period (${data.currentPeriod || 1} of ${data.totalPeriods || 1})`;
            const hasMoreBreaks = (data.currentPeriod || 1) < (data.totalPeriods || 1) && !chkSkipBreaks.checked;
            upNextText.textContent = hasMoreBreaks ? `Up next: ${selectedBreakMins} min break` : `Final focus period`;
            
            pauseIcon.style.display = isPaused ? 'none' : 'block';
            playIcon.style.display = isPaused ? 'block' : 'none';

            if (autoPauseLabel) {
                autoPauseLabel.classList.toggle('show', isPaused && data.isAutoPaused);
            }
            setTimeout(syncVinylCenterPosition, 20);
        } else if (activeState === 'resting') {
            setupView.classList.remove('active');
            timerView.classList.add('active');
            activeStatusLabel.textContent = 'RESTING & STEP OUTSIDE';
            focusPeriodTitle.textContent = 'Mandatory Break';
            upNextText.textContent = 'Step away from screen & walk outside';

            if (autoPauseLabel) {
                autoPauseLabel.classList.remove('show');
            }
            setTimeout(syncVinylCenterPosition, 20);
        } else {
            timerView.classList.remove('active');
            setupView.classList.add('active');

            if (autoPauseLabel) {
                autoPauseLabel.classList.remove('show');
            }
            setTimeout(syncVinylCenterPosition, 20);
        }

        if (data.remainingSec !== undefined && data.maxPeriodSec > 0) {
            const ratio = data.remainingSec / data.maxPeriodSec;
            updateVisualProgress(ratio);

            // Real-time Plant Growth Animation (0.0 to 1.0)
            const progressRatio = Math.max(0, Math.min(1.0, 1 - ratio));

            const plantStem = document.getElementById('plant-stem');
            if (plantStem) {
                plantStem.style.strokeDashoffset = (60 * (1 - progressRatio)).toFixed(1);
            }

            const leaf1 = document.getElementById('leaf-pair-1');
            if (leaf1) leaf1.classList.toggle('grown', progressRatio >= 0.20);

            const leaf2 = document.getElementById('leaf-pair-2');
            if (leaf2) leaf2.classList.toggle('grown', progressRatio >= 0.45);

            const leaf3 = document.getElementById('leaf-pair-3');
            if (leaf3) leaf3.classList.toggle('grown', progressRatio >= 0.70);

            const topBud = document.getElementById('plant-top-bud');
            if (topBud) topBud.classList.toggle('grown', progressRatio >= 0.90);
        }
    };

    function sendToCpp(payload) {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify(payload));
        } else {
            console.log('C++ IPC bridge (Standalone mode):', payload);
        }
    }

    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener('message', event => {
            try {
                const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (msg.type === 'stateUpdate') {
                    window.onCppStateUpdate(msg.data, msg.isPip);
                } else if (msg.type === 'runningApps') {
                    window.renderAppList(msg.apps);
                }
            } catch (err) {
                console.error('IPC JSON parse error:', err);
            }
        });
    }

    updatePickerDisplay();
    updateStatsUI();

    // Sync initial stats to C++
    sendToCpp({
        action: 'syncStats',
        completedMinutesToday: userData.completedMinutesToday || 0,
        dailyGoalMinutes: (userData.dailyGoalHours || 1) * 60
    });

    // Sync initial auto-pause config to C++
    sendToCpp({
        action: 'setAutoPauseConfig',
        enabled: userData.autoPauseEnabled !== false,
        sec: userData.autoPauseSec || 15
    });

    // --- Session Persistence: Resume session if one was active ---
    if (userData.activeSession && userData.activeSession.state !== 'idle') {
        const s = userData.activeSession;
        // Optional: only resume if it was less than 2 hours ago?
        const twoHours = 2 * 60 * 60 * 1000;
        if (Date.now() - s.timestamp < twoHours) {
            sendToCpp({
                action: 'resumeSession',
                sessionState: s.state,
                remainingSec: s.remainingSec,
                currentPeriod: s.currentPeriod,
                totalPeriods: s.totalPeriods,
                focusMinutes: s.focusMins,
                focusChunkMinutes: s.chunkMins,
                breakMinutes: s.breakMins,
                skipBreaks: s.skipBreaks
            });
        } else {
            delete userData.activeSession;
            saveUserData();
        }
    }

    sendToCpp({ action: 'getRunningApps' });

    // --- Prayer Times UI Feature ---
    const prayerClockDisplay = document.getElementById('prayer-digital-clock');
    const prayerDateDisplay = document.getElementById('prayer-today-date');
    const prayerNextName = document.getElementById('prayer-next-name-val');
    const prayerNextTime = document.getElementById('prayer-next-time-val');

    const chkPrayerEnabled = document.getElementById('chk-prayer-enabled');
    const chkPrayerBreakEnabled = document.getElementById('chk-prayer-break-enabled');
    const inputPrayerAdvance = document.getElementById('input-prayer-advance');
    const inputPrayerLat = document.getElementById('input-prayer-lat');
    const inputPrayerLng = document.getElementById('input-prayer-lng');
    const inputPrayerTz = document.getElementById('input-prayer-tz');
    const btnSavePrayerConfig = document.getElementById('btn-save-prayer-config');

    const btnPrayerGps = document.getElementById('btn-prayer-gps');
    const inputCitySearch = document.getElementById('input-prayer-city-search');
    const btnCitySearch = document.getElementById('btn-prayer-city-search');

    window.allPrayerTimes = [];
    window.displayedPrayerIndex = -1;
    window.actualNextPrayerName = "";

    window.renderPrayerInfo = function() {
        if (window.displayedPrayerIndex === -1 || !window.allPrayerTimes.length) return;
        const p = window.allPrayerTimes[window.displayedPrayerIndex];
        const label = document.getElementById('prayer-display-label');
        if (label) {
            label.textContent = (p.name === window.actualNextPrayerName) ? "Next Prayer" : "Prayer Time";
            label.style.color = (p.name === window.actualNextPrayerName) ? "var(--accent-blue)" : "var(--text-muted)";
        }
        const nameEl = document.getElementById('prayer-next-name-val');
        const timeEl = document.getElementById('prayer-next-time-val');
        if (nameEl) {
            nameEl.textContent = p.name;
            nameEl.style.cursor = "pointer";
            nameEl.title = "Click to reset to Next Prayer";
        }
        if (timeEl) timeEl.textContent = p.time;
    };

    document.getElementById('btn-prayer-prev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.allPrayerTimes.length) return;
        window.displayedPrayerIndex = (window.displayedPrayerIndex - 1 + window.allPrayerTimes.length) % window.allPrayerTimes.length;
        window.renderPrayerInfo();
    });

    document.getElementById('btn-prayer-next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.allPrayerTimes.length) return;
        window.displayedPrayerIndex = (window.displayedPrayerIndex + 1) % window.allPrayerTimes.length;
        window.renderPrayerInfo();
    });

    document.getElementById('prayer-next-name-val')?.addEventListener('click', () => {
        window.displayedPrayerIndex = window.allPrayerTimes.findIndex(p => p.name === window.actualNextPrayerName);
        window.renderPrayerInfo();
    });

    if (chkPrayerEnabled) {
        chkPrayerEnabled.checked = !!userData.prayerEnabled;
        chkPrayerBreakEnabled.checked = !!userData.prayerBreakEnabled;
        inputPrayerAdvance.value = userData.prayerAdvance || 5;
        inputPrayerLat.value = userData.prayerLat || -2.8554;
        inputPrayerLng.value = userData.prayerLng || 115.3283;
        inputPrayerTz.value = userData.prayerTz || 8;

        // Initial sync to Native
        sendToCpp({
            action: 'setPrayerConfig',
            enabled: userData.prayerEnabled,
            breakEnabled: userData.prayerBreakEnabled,
            advance: userData.prayerAdvance,
            breakDuration: 15,
            lat: userData.prayerLat,
            lng: userData.prayerLng,
            tz: userData.prayerTz
        });
    }

    function savePrayerSettings() {
        if (!chkPrayerEnabled) return;
        userData.prayerEnabled = chkPrayerEnabled.checked;
        userData.prayerBreakEnabled = chkPrayerBreakEnabled.checked;
        userData.prayerAdvance = parseInt(inputPrayerAdvance.value);
        userData.prayerLat = parseFloat(inputPrayerLat.value);
        userData.prayerLng = parseFloat(inputPrayerLng.value);
        userData.prayerTz = parseInt(inputPrayerTz.value);
        saveUserData();

        sendToCpp({
            action: 'setPrayerConfig',
            enabled: userData.prayerEnabled,
            breakEnabled: userData.prayerBreakEnabled,
            advance: userData.prayerAdvance,
            breakDuration: 15,
            lat: userData.prayerLat,
            lng: userData.prayerLng,
            tz: userData.prayerTz
        });
    }

    [chkPrayerEnabled, chkPrayerBreakEnabled, inputPrayerAdvance, inputPrayerLat, inputPrayerLng, inputPrayerTz].forEach(el => {
        el?.addEventListener('change', savePrayerSettings);
    });

    btnPrayerGps?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by this browser.");
            return;
        }
        btnPrayerGps.textContent = "⌛ Locating...";
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            inputPrayerLat.value = lat.toFixed(6);
            inputPrayerLng.value = lng.toFixed(6);

            // Auto-Guess Timezone based on Longitude
            if (lng < 109) inputPrayerTz.value = 7;
            else if (lng < 126) inputPrayerTz.value = 8;
            else inputPrayerTz.value = 9;

            if (inputCitySearch) inputCitySearch.value = ""; // Clear search box to avoid confusion
            btnPrayerGps.textContent = "✅ Success";
            savePrayerSettings();
            setTimeout(() => btnPrayerGps.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Auto GPS', 2000);
        }, (err) => {
            alert("Failed to get GPS location. Please try searching for your city instead.");
            btnPrayerGps.textContent = "❌ Failed";
        });
    });

    const cityResultsDiv = document.getElementById('prayer-city-results');

    async function searchCity(query) {
        if (!query) {
            if (cityResultsDiv) cityResultsDiv.style.display = 'none';
            return;
        }
        btnCitySearch.textContent = "⌛";
        try {
            // Increase limit and add countrycodes=id to prioritize Indonesia
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=id`);
            const data = await resp.json();

            if (data && data.length > 0) {
                if (cityResultsDiv) {
                    cityResultsDiv.innerHTML = '';
                    cityResultsDiv.style.display = 'block';

                    data.forEach(item => {
                        const div = document.createElement('div');
                        div.style.padding = '8px 10px';
                        div.style.fontSize = '10px';
                        div.style.color = '#eee';
                        div.style.cursor = 'pointer';
                        div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        div.style.transition = 'background 0.2s';
                        div.textContent = item.display_name;

                        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
                        div.onmouseout = () => div.style.background = 'transparent';

                        div.onclick = () => {
                            const lat = parseFloat(item.lat);
                            const lng = parseFloat(item.lon);
                            inputPrayerLat.value = lat.toFixed(6);
                            inputPrayerLng.value = lng.toFixed(6);

                            if (lng < 109) inputPrayerTz.value = 7;
                            else if (lng < 126) inputPrayerTz.value = 8;
                            else inputPrayerTz.value = 9;

                            savePrayerSettings();
                            cityResultsDiv.style.display = 'none';
                            inputCitySearch.value = item.display_name.split(',')[0];
                        };
                        cityResultsDiv.appendChild(div);
                    });
                }
                btnCitySearch.textContent = "🔍";
            } else {
                alert("City not found. Try with a more specific name.");
                btnCitySearch.textContent = "🔍";
                if (cityResultsDiv) cityResultsDiv.style.display = 'none';
            }
        } catch (e) {
            console.error("Search failed", e);
            btnCitySearch.textContent = "🔍";
            if (cityResultsDiv) cityResultsDiv.style.display = 'none';
        }
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (cityResultsDiv && !cityResultsDiv.contains(e.target) && e.target !== btnCitySearch && e.target !== inputCitySearch) {
            cityResultsDiv.style.display = 'none';
        }
    });

    btnCitySearch?.addEventListener('click', () => searchCity(inputCitySearch.value));
    inputCitySearch?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity(inputCitySearch.value);
    });

    // ========================================================
    // Procedural Web Audio Ambient Soundscapes Engine
    // ========================================================
    class AmbientAudioEngine {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.tracks = {};
            this.isPlaying = false;
            this.isMasterMuted = false;
            this.typingTimer = null;
            this.nightCricketTimer = null;
            this.settings = userData.ambientSettings || {
                enabled: true,
                autoPlay: true,
                masterVolume: 80,
                activePreset: 'night_coder',
                tracks: {
                    typing: { active: true, volume: 65 },
                    night: { active: true, volume: 50 },
                    rain: { active: false, volume: 55 },
                    vinyl: { active: false, volume: 40 },
                    ocean: { active: false, volume: 45 },
                    alpha: { active: false, volume: 30 }
                }
            };
        }

        initContext() {
            if (!this.ctx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContextClass();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime((this.settings.masterVolume / 100) * (this.isMasterMuted ? 0 : 1), this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        createNoiseBuffer(type = 'pink', duration = 5) {
            const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
            const bufferSize = sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);

            if (type === 'white') {
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
            } else if (type === 'pink') {
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                    b6 = white * 0.115926;
                }
            } else if (type === 'brown') {
                let lastOut = 0.0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    data[i] = (lastOut + (0.02 * white)) / 1.02;
                    lastOut = data[i];
                    data[i] *= 3.5;
                }
            }
            return buffer;
        }

        createMechanicalKeyBuffer(isSpace = false) {
            const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
            const length = Math.floor(sampleRate * (isSpace ? 0.038 : 0.024));
            const buffer = this.ctx.createBuffer(1, length, sampleRate);
            const data = buffer.getChannelData(0);

            // Creamy Lubed Mechanical Switch ASMR (Warm, soothing, zero harsh piercing spikes)
            let prev = 0;
            let smooth = 0;
            const decay = isSpace ? 120 : 190;

            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                const white = (Math.random() * 2 - 1);

                // Smooth 2ms attack to eliminate any sharp ear-piercing click
                const attack = Math.min(1, t / 0.0022);
                const env = attack * Math.exp(-t * decay);

                // Soft tactile friction
                smooth = smooth * 0.7 + white * 0.3;
                const tactile = smooth * env * 1.6;

                // Warm keycap body tap
                const tap = (white - prev) * Math.exp(-t * 900) * 0.85;
                prev = white;

                data[i] = (tactile * 0.9 + tap * 0.35) * (0.85 + Math.random() * 0.25);
            }
            return buffer;
        }

        createMouseClickBuffer(isUpstroke = false) {
            const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
            const length = Math.floor(sampleRate * (isUpstroke ? 0.012 : 0.018));
            const buffer = this.ctx.createBuffer(1, length, sampleRate);
            const data = buffer.getChannelData(0);

            // Tactile Microswitch Mouse Click (Omron switch acoustic profile)
            let prev = 0;
            const decay = isUpstroke ? 750 : 480;
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                const white = (Math.random() * 2 - 1);
                const click = (white - prev) * Math.exp(-t * decay) * (isUpstroke ? 0.8 : 1.5);
                prev = white;
                data[i] = click * 0.7;
            }
            return buffer;
        }

        playMouseClick(isDoubleClick = false) {
            if (!this.tracks.typing || !this.tracks.typing.active || !this.isPlaying || this.isMasterMuted) return;
            const now = this.ctx.currentTime;

            const playClick = (timeOffset = 0) => {
                const clickTime = now + timeOffset;
                const src = this.ctx.createBufferSource();
                src.buffer = this.createMouseClickBuffer(false);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(2350 + Math.random() * 300, clickTime);
                filter.Q.setValueAtTime(1.4, clickTime);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.42 + Math.random() * 0.16, clickTime);

                src.connect(filter);
                filter.connect(gain);
                gain.connect(this.tracks.typing.gainNode);
                src.start(clickTime);

                // Upstroke release click (~22ms later)
                const upSrc = this.ctx.createBufferSource();
                upSrc.buffer = this.createMouseClickBuffer(true);
                upSrc.connect(filter);
                upSrc.start(clickTime + 0.022);
            };

            playClick(0);
            if (isDoubleClick) {
                playClick(0.095);
            }
        }

        startTypingTrack() {
            if (this.tracks.typing) return;
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime((this.settings.tracks.typing.volume / 100), this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            this.tracks.typing = { gainNode, active: true };

            const playSingleKeystroke = (isSpace = false) => {
                if (!this.tracks.typing || !this.tracks.typing.active || !this.isPlaying || this.isMasterMuted) return;
                const now = this.ctx.currentTime;

                const source = this.ctx.createBufferSource();
                source.buffer = this.createMechanicalKeyBuffer(isSpace);
                source.playbackRate.setValueAtTime(isSpace ? 0.88 : (0.94 + Math.random() * 0.14), now);

                // Warm Low-pass filter (removes any harsh/ear-piercing frequencies above 1500Hz)
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(isSpace ? 1100 : (1450 + Math.random() * 250), now);
                filter.Q.setValueAtTime(0.7, now);

                const keyGain = this.ctx.createGain();
                const vel = (0.5 + Math.random() * 0.3) * (isSpace ? 1.2 : 1.0);
                keyGain.gain.setValueAtTime(vel, now);

                source.connect(filter);
                filter.connect(keyGain);
                keyGain.connect(gainNode);

                source.start(now);
            };

            const scheduleTypingBurst = () => {
                if (!this.tracks.typing || !this.isPlaying) return;

                // 25% chance of doing mouse actions instead of typing (e.g. clicking links, selecting code, scrolling)
                if (Math.random() < 0.25) {
                    const isDouble = Math.random() < 0.35;
                    this.playMouseClick(isDouble);
                    const nextActionDelay = 500 + Math.random() * 900;
                    this.typingTimer = setTimeout(scheduleTypingBurst, nextActionDelay);
                    return;
                }

                // Random keystrokes count (from 3 to 12 strokes per burst)
                const keystrokesCount = 3 + Math.floor(Math.random() * 10);
                let delay = 0;

                for (let i = 0; i < keystrokesCount; i++) {
                    const isSpace = (i === keystrokesCount - 1) || (Math.random() < 0.18);
                    setTimeout(() => {
                        playSingleKeystroke(isSpace);
                    }, delay);
                    // Realistic typing speed: 70ms - 150ms per keystroke (human cadence)
                    delay += 70 + Math.floor(Math.random() * 80);
                }

                // Occasional mouse click immediately after typing a line (35% chance)
                if (Math.random() < 0.35) {
                    setTimeout(() => {
                        this.playMouseClick(Math.random() < 0.3);
                    }, delay + 120 + Math.floor(Math.random() * 200));
                }

                // Natural human thinking pause between words & sentences (0.4s - 2.2s)
                const nextBurstDelay = delay + (Math.random() < 0.3 ? (1100 + Math.random() * 1200) : (380 + Math.random() * 600));
                this.typingTimer = setTimeout(scheduleTypingBurst, nextBurstDelay);
            };

            scheduleTypingBurst();
        }

        stopTypingTrack() {
            if (this.typingTimer) clearTimeout(this.typingTimer);
            if (this.tracks.typing) {
                delete this.tracks.typing;
            }
        }

        startNightTrack() {
            if (this.tracks.night) return;
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(this.settings.tracks.night.volume / 100, this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            const windNoise = this.ctx.createBufferSource();
            windNoise.buffer = this.createNoiseBuffer('brown', 6);
            windNoise.loop = true;

            const windFilter = this.ctx.createBiquadFilter();
            windFilter.type = 'lowpass';
            windFilter.frequency.setValueAtTime(280, this.ctx.currentTime);

            const windGain = this.ctx.createGain();
            windGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

            windNoise.connect(windFilter);
            windFilter.connect(windGain);
            windGain.connect(gainNode);
            windNoise.start();

            const playCricketChirp = () => {
                if (!this.tracks.night || !this.tracks.night.active || !this.isPlaying || this.isMasterMuted) return;
                const now = this.ctx.currentTime;
                const chirps = 2 + Math.floor(Math.random() * 3);
                let t = now;

                for (let i = 0; i < chirps; i++) {
                    const osc1 = this.ctx.createOscillator();
                    const osc2 = this.ctx.createOscillator();
                    const chirpGain = this.ctx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(4550 + (Math.random() * 80), t);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(4820 + (Math.random() * 80), t);

                    chirpGain.gain.setValueAtTime(0.001, t);
                    chirpGain.gain.linearRampToValueAtTime(0.07, t + 0.015);
                    chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

                    osc1.connect(chirpGain);
                    osc2.connect(chirpGain);
                    chirpGain.connect(gainNode);

                    osc1.start(t);
                    osc1.stop(t + 0.06);
                    osc2.start(t);
                    osc2.stop(t + 0.06);

                    t += 0.075;
                }

                const nextChirp = 1200 + Math.random() * 2200;
                this.nightCricketTimer = setTimeout(playCricketChirp, nextChirp);
            };

            playCricketChirp();

            this.tracks.night = { gainNode, nodes: [windNoise], active: true };
        }

        stopNightTrack() {
            if (this.nightCricketTimer) clearTimeout(this.nightCricketTimer);
            if (this.tracks.night) {
                if (this.tracks.night.nodes) {
                    this.tracks.night.nodes.forEach(n => {
                        try { n.stop(); } catch(e){}
                    });
                }
                delete this.tracks.night;
            }
        }

        startRainTrack() {
            if (this.tracks.rain) return;
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(this.settings.tracks.rain.volume / 100, this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer('pink', 6);
            noise.loop = true;

            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(1100, this.ctx.currentTime);
            bandpass.Q.setValueAtTime(0.8, this.ctx.currentTime);

            const lowpass = this.ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.setValueAtTime(3200, this.ctx.currentTime);

            noise.connect(bandpass);
            bandpass.connect(lowpass);
            lowpass.connect(gainNode);
            noise.start();

            this.tracks.rain = { gainNode, nodes: [noise], active: true };
        }

        stopRainTrack() {
            if (this.tracks.rain) {
                if (this.tracks.rain.nodes) {
                    this.tracks.rain.nodes.forEach(n => {
                        try { n.stop(); } catch(e){}
                    });
                }
                delete this.tracks.rain;
            }
        }

        startVinylTrack() {
            if (this.tracks.vinyl) return;
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(this.settings.tracks.vinyl.volume / 100, this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            const hiss = this.ctx.createBufferSource();
            hiss.buffer = this.createNoiseBuffer('pink', 5);
            hiss.loop = true;

            const hissFilter = this.ctx.createBiquadFilter();
            hissFilter.type = 'lowpass';
            hissFilter.frequency.setValueAtTime(550, this.ctx.currentTime);

            const hissGain = this.ctx.createGain();
            hissGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

            hiss.connect(hissFilter);
            hissFilter.connect(hissGain);
            hissGain.connect(gainNode);
            hiss.start();

            const popInterval = setInterval(() => {
                if (!this.tracks.vinyl || !this.isPlaying || this.isMasterMuted) return;
                if (Math.random() < 0.6) {
                    const now = this.ctx.currentTime;
                    const pop = this.ctx.createBufferSource();
                    pop.buffer = this.createNoiseBuffer('white', 0.015);
                    const popGain = this.ctx.createGain();
                    popGain.gain.setValueAtTime(0.12 + Math.random() * 0.28, now);
                    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
                    pop.connect(popGain);
                    popGain.connect(gainNode);
                    pop.start(now);
                }
            }, 80);

            this.tracks.vinyl = { gainNode, nodes: [hiss], interval: popInterval, active: true };
        }

        stopVinylTrack() {
            if (this.tracks.vinyl) {
                if (this.tracks.vinyl.interval) clearInterval(this.tracks.vinyl.interval);
                if (this.tracks.vinyl.nodes) {
                    this.tracks.vinyl.nodes.forEach(n => {
                        try { n.stop(); } catch(e){}
                    });
                }
                delete this.tracks.vinyl;
            }
        }

        startOceanTrack() {
            if (this.tracks.ocean) return;
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(this.settings.tracks.ocean.volume / 100, this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer('brown', 6);
            noise.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(250, this.ctx.currentTime);

            const lfo = this.ctx.createOscillator();
            lfo.frequency.setValueAtTime(0.09, this.ctx.currentTime);
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.setValueAtTime(350, this.ctx.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);

            noise.connect(filter);
            filter.connect(gainNode);

            noise.start();
            lfo.start();

            this.tracks.ocean = { gainNode, nodes: [noise, lfo], active: true };
        }

        stopOceanTrack() {
            if (this.tracks.ocean) {
                if (this.tracks.ocean.nodes) {
                    this.tracks.ocean.nodes.forEach(n => {
                        try { n.stop(); } catch(e){}
                    });
                }
                delete this.tracks.ocean;
            }
        }

        startAlphaTrack() {
            if (this.tracks.alpha) return;
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(this.settings.tracks.alpha.volume / 100, this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            const merger = this.ctx.createChannelMerger(2);

            const oscLeft = this.ctx.createOscillator();
            oscLeft.type = 'sine';
            oscLeft.frequency.setValueAtTime(432, this.ctx.currentTime);

            const oscRight = this.ctx.createOscillator();
            oscRight.type = 'sine';
            oscRight.frequency.setValueAtTime(442, this.ctx.currentTime);

            oscLeft.connect(merger, 0, 0);
            oscRight.connect(merger, 0, 1);
            merger.connect(gainNode);

            oscLeft.start();
            oscRight.start();

            this.tracks.alpha = { gainNode, nodes: [oscLeft, oscRight], active: true };
        }

        stopAlphaTrack() {
            if (this.tracks.alpha) {
                if (this.tracks.alpha.nodes) {
                    this.tracks.alpha.nodes.forEach(n => {
                        try { n.stop(); } catch(e){}
                    });
                }
                delete this.tracks.alpha;
            }
        }

        startAllActiveTracks() {
            this.initContext();
            this.isPlaying = true;
            if (this.settings.tracks.typing && this.settings.tracks.typing.active) this.startTypingTrack();
            if (this.settings.tracks.night && this.settings.tracks.night.active) this.startNightTrack();
            if (this.settings.tracks.rain && this.settings.tracks.rain.active) this.startRainTrack();
            if (this.settings.tracks.vinyl && this.settings.tracks.vinyl.active) this.startVinylTrack();
            if (this.settings.tracks.ocean && this.settings.tracks.ocean.active) this.startOceanTrack();
            if (this.settings.tracks.alpha && this.settings.tracks.alpha.active) this.startAlphaTrack();
        }

        stopAllTracks() {
            this.isPlaying = false;
            this.stopTypingTrack();
            this.stopNightTrack();
            this.stopRainTrack();
            this.stopVinylTrack();
            this.stopOceanTrack();
            this.stopAlphaTrack();
        }

        setTrackVolume(soundKey, vol) {
            if (!this.settings.tracks[soundKey]) this.settings.tracks[soundKey] = { active: false, volume: 50 };
            this.settings.tracks[soundKey].volume = vol;
            if (this.tracks[soundKey] && this.tracks[soundKey].gainNode && this.ctx) {
                this.tracks[soundKey].gainNode.gain.setValueAtTime(vol / 100, this.ctx.currentTime);
            }
            this.save();
        }

        setTrackActive(soundKey, active) {
            if (!this.settings.tracks[soundKey]) this.settings.tracks[soundKey] = { active: false, volume: 50 };
            this.settings.tracks[soundKey].active = active;
            if (active) {
                if (this.isPlaying) {
                    if (soundKey === 'typing') this.startTypingTrack();
                    else if (soundKey === 'night') this.startNightTrack();
                    else if (soundKey === 'rain') this.startRainTrack();
                    else if (soundKey === 'vinyl') this.startVinylTrack();
                    else if (soundKey === 'ocean') this.startOceanTrack();
                    else if (soundKey === 'alpha') this.startAlphaTrack();
                }
            } else {
                if (soundKey === 'typing') this.stopTypingTrack();
                else if (soundKey === 'night') this.stopNightTrack();
                else if (soundKey === 'rain') this.stopRainTrack();
                else if (soundKey === 'vinyl') this.stopVinylTrack();
                else if (soundKey === 'ocean') this.stopOceanTrack();
                else if (soundKey === 'alpha') this.stopAlphaTrack();
            }
            this.save();
        }

        setMasterVolume(vol) {
            this.settings.masterVolume = vol;
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setValueAtTime((vol / 100) * (this.isMasterMuted ? 0 : 1), this.ctx.currentTime);
            }
            this.save();
        }

        toggleMasterMute() {
            this.isMasterMuted = !this.isMasterMuted;
            if (this.masterGain && this.ctx) {
                const vol = this.isMasterMuted ? 0 : (this.settings.masterVolume / 100);
                this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
            }
            return this.isMasterMuted;
        }

        applyPreset(presetName) {
            const presets = {
                night_coder: { typing: { active: true, volume: 65 }, night: { active: true, volume: 50 }, rain: { active: false, volume: 55 }, vinyl: { active: false, volume: 40 }, ocean: { active: false, volume: 45 }, alpha: { active: false, volume: 30 } },
                rainy_cafe: { typing: { active: false, volume: 60 }, night: { active: false, volume: 40 }, rain: { active: true, volume: 70 }, vinyl: { active: true, volume: 45 }, ocean: { active: false, volume: 45 }, alpha: { active: false, volume: 30 } },
                office_flow: { typing: { active: true, volume: 75 }, night: { active: false, volume: 40 }, rain: { active: false, volume: 50 }, vinyl: { active: false, volume: 35 }, ocean: { active: false, volume: 45 }, alpha: { active: true, volume: 35 } },
                zen_mind: { typing: { active: false, volume: 50 }, night: { active: false, volume: 40 }, rain: { active: false, volume: 40 }, vinyl: { active: false, volume: 30 }, ocean: { active: true, volume: 40 }, alpha: { active: true, volume: 55 } },
                ocean_night: { typing: { active: false, volume: 50 }, night: { active: true, volume: 45 }, rain: { active: false, volume: 40 }, vinyl: { active: false, volume: 30 }, ocean: { active: true, volume: 65 }, alpha: { active: false, volume: 30 } }
            };

            const p = presets[presetName];
            if (!p) return;

            this.settings.activePreset = presetName;
            for (const key in p) {
                this.setTrackVolume(key, p[key].volume);
                this.setTrackActive(key, p[key].active);
            }
            this.save();
        }

        save() {
            userData.ambientSettings = this.settings;
            saveUserData();
        }
    }

    const ambientEngine = new AmbientAudioEngine();
    window.ambientEngine = ambientEngine;

    // Ambient Mixer Modal UI Binding
    const ambientModal = document.getElementById('ambient-mixer-modal');
    const btnCloseAmbientModal = document.getElementById('btn-close-ambient-modal');
    const btnAmbientMasterToggle = document.getElementById('btn-ambient-master-toggle');
    const ambientMasterStatusText = document.getElementById('ambient-master-status-text');
    const ambientMasterVolume = document.getElementById('ambient-master-volume');
    const ambientMasterVolLabel = document.getElementById('ambient-master-vol-label');
    const btnAmbientMuteAll = document.getElementById('btn-ambient-mute-all');
    const chkAmbientAutoplay = document.getElementById('chk-ambient-autoplay');

    // Open Ambient Modal triggers
    document.querySelectorAll('#btn-open-ambient-mixer, .btn-open-ambient-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e?.stopPropagation();
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            syncAmbientUI();
            if (ambientModal) ambientModal.classList.add('active');
            ambientEngine.initContext();
            if (!ambientEngine.isPlaying) {
                ambientEngine.startAllActiveTracks();
                syncAmbientUI();
            }
        });
    });

    if (btnCloseAmbientModal && ambientModal) {
        btnCloseAmbientModal.addEventListener('click', () => {
            ambientModal.classList.remove('active');
        });
    }

    function syncAmbientUI() {
        if (!ambientEngine) return;
        const s = ambientEngine.settings;
        if (ambientMasterVolume) ambientMasterVolume.value = s.masterVolume || 80;
        if (ambientMasterVolLabel) ambientMasterVolLabel.textContent = `${s.masterVolume || 80}%`;
        if (chkAmbientAutoplay) chkAmbientAutoplay.checked = (s.autoPlay !== false);

        if (btnAmbientMasterToggle) {
            if (ambientEngine.isMasterMuted || !ambientEngine.isPlaying) {
                btnAmbientMasterToggle.className = 'ambient-master-btn muted';
                if (ambientMasterStatusText) ambientMasterStatusText.textContent = 'Audio Muted';
            } else {
                btnAmbientMasterToggle.className = 'ambient-master-btn active';
                if (ambientMasterStatusText) ambientMasterStatusText.textContent = 'Audio Active';
            }
        }

        // Preset Chips
        document.querySelectorAll('.ambient-preset-chip').forEach(chip => {
            const preset = chip.getAttribute('data-preset');
            if (preset === s.activePreset) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        // Tracks Cards & Sliders
        document.querySelectorAll('.ambient-track-card').forEach(card => {
            const soundKey = card.getAttribute('data-sound');
            const trackCfg = s.tracks[soundKey] || { active: false, volume: 50 };
            const toggle = card.querySelector('.track-toggle');
            const slider = card.querySelector('.track-volume-slider');
            const volText = card.querySelector('.track-vol-text');

            if (toggle) toggle.checked = !!trackCfg.active;
            if (slider) slider.value = trackCfg.volume || 50;
            if (volText) volText.textContent = `${trackCfg.volume || 50}%`;

            if (trackCfg.active && ambientEngine.isPlaying && !ambientEngine.isMasterMuted) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    // Preset Chips Click
    document.querySelectorAll('.ambient-preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const preset = chip.getAttribute('data-preset');
            ambientEngine.applyPreset(preset);
            syncAmbientUI();
        });
    });

    // Track Toggles & Volume Sliders
    document.querySelectorAll('.track-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const soundKey = e.target.getAttribute('data-sound');
            ambientEngine.setTrackActive(soundKey, e.target.checked);
            syncAmbientUI();
        });
    });

    document.querySelectorAll('.track-volume-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const soundKey = e.target.getAttribute('data-sound');
            const vol = parseInt(e.target.value, 10) || 0;
            ambientEngine.setTrackVolume(soundKey, vol);
            const volText = document.querySelector(`.track-vol-text[data-sound="${soundKey}"]`);
            if (volText) volText.textContent = `${vol}%`;
        });
    });

    // Master Controls
    if (btnAmbientMasterToggle) {
        btnAmbientMasterToggle.addEventListener('click', () => {
            if (!ambientEngine.isPlaying) {
                ambientEngine.startAllActiveTracks();
            } else {
                ambientEngine.toggleMasterMute();
            }
            syncAmbientUI();
        });
    }

    if (btnAmbientMuteAll) {
        btnAmbientMuteAll.addEventListener('click', () => {
            ambientEngine.toggleMasterMute();
            syncAmbientUI();
        });
    }

    if (ambientMasterVolume) {
        ambientMasterVolume.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value, 10) || 0;
            ambientEngine.setMasterVolume(vol);
            if (ambientMasterVolLabel) ambientMasterVolLabel.textContent = `${vol}%`;
        });
    }

    if (chkAmbientAutoplay) {
        chkAmbientAutoplay.addEventListener('change', (e) => {
            ambientEngine.settings.autoPlay = e.target.checked;
            ambientEngine.save();
        });
    }

    // Hook ambient audio playback into Focus Session events
    const originalStartSession = btnStartFocus.onclick;
    btnStartFocus.addEventListener('click', () => {
        if (ambientEngine.settings.autoPlay !== false) {
            ambientEngine.startAllActiveTracks();
        }
    });

    btnStop.addEventListener('click', () => {
        ambientEngine.stopAllTracks();
        syncAmbientUI();
    });

    btnPause.addEventListener('click', () => {
        if (isPaused) {
            if (ambientEngine.settings.autoPlay !== false) {
                ambientEngine.startAllActiveTracks();
            }
        } else {
            ambientEngine.stopAllTracks();
        }
        syncAmbientUI();
    });

    function updatePrayerClock() {
        if (!prayerClockDisplay) return;
        const now = new Date();
        prayerClockDisplay.textContent = now.toLocaleTimeString();
        if (prayerDateDisplay) prayerDateDisplay.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        // Keep finish time prediction fresh every second in setup view
        if (setupView && setupView.classList.contains('active')) {
            updateSetupPrediction();
        }
    }
    setInterval(updatePrayerClock, 1000);

    // Auto-poll running browser apps every 2 seconds to sync YouTube Music track titles
    setInterval(() => {
        sendToCpp({ action: 'getRunningApps' });
    }, 2000);
});

