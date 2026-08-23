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
    document.getElementById('btn-min')?.addEventListener('click', () => sendToCpp({ action: 'minimize' }));
    document.getElementById('btn-max')?.addEventListener('click', () => sendToCpp({ action: 'maximize' }));
    document.getElementById('btn-close')?.addEventListener('click', () => sendToCpp({ action: 'close' }));

    // Native Window Drag Handler
    const setupDragArea = (element) => {
        if (!element) return;
        element.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.target.closest('button, input, label, a, .switch, .window-controls')) {
                sendToCpp({ action: 'startDrag' });
            }
        });
    };

    setupDragArea(document.getElementById('app-titlebar'));
    setupDragArea(document.querySelector('.titlebar'));

    let isInitializingPip = false;

    document.querySelectorAll('.btn-pip-toggle, #btn-pip-restore').forEach(btn => {
        btn.addEventListener('click', () => {
            const isCurrentlyPip = document.body.classList.contains('pip-mode');

            const isEnteringPip = !isCurrentlyPip;
            const targetW = isEnteringPip ? (userData.pipWidth || 280) : undefined;
            const targetH = isEnteringPip ? (userData.pipHeight || 400) : undefined;

            if (isEnteringPip) {
                console.log(`[PIP] Entering PIP with target size: ${targetW}x${targetH}`);
                // Enable cooldown to prevent capturing initial window snap
                isInitializingPip = true;
                setTimeout(() => { isInitializingPip = false; }, 1000); // 1s cooldown
            } else {
                console.log(`[PIP] Exiting PIP. Keeping last manual resize: ${userData.pipWidth}x${userData.pipHeight}`);
            }

            sendToCpp({
                action: 'togglePip',
                width: targetW,
                height: targetH
            });
        });
    });

    // Request Notification Permissions
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

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
        accentColor: '#60cdff',
        customGifData: '',
        customGifName: '',
        recentGifs: [], // Stores up to 5 recently used custom GIFs: { id, name, data }
        blockedApps: ['facebook.exe', 'tiktok.exe', 'instagram.exe'],
        restrictedSites: ['facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'reddit.com'],
        pipWidth: 280,
        pipHeight: 400,
        timerTheme: 'classic', // 'classic', 'hourglass', 'wave', 'blocks', 'dots', 'orbit'
        isStealthMode: false,
        showVinylSpindle: true
    };

    function loadUserData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                userData = { ...userData, ...parsed };

                if (userData.lastDateStr !== todayDateStr) {
                    const yesterdayMins = userData.completedMinutesToday || 0;
                    userData.yesterdayHours = (yesterdayMins / 60).toFixed(1);

                    const targetMins = userData.dailyGoalHours * 60;
                    if (yesterdayMins >= targetMins) {
                        userData.streakDays = (userData.streakDays || 0) + 1;
                    } else if (yesterdayMins === 0) {
                        userData.streakDays = 0;
                    }

                    userData.completedMinutesToday = 0;
                    userData.lastDateStr = todayDateStr;
                    saveUserData();
                }
            }
        } catch (e) {
            console.error('Error loading local user data:', e);
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

    // Notification Helper (Sends exclusively via C++ Native Windows Toast API)
    function sendNotification(title, body) {
        if (!userData.notificationsEnabled) return;
        sendToCpp({ action: 'notify', title: title, body: body });
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
                    if (data && data.metadata) {
                        isUsingExtension = true; // Confirmed working extension
                        ytTrackData.title = data.metadata.title || '';
                        ytTrackData.author = data.metadata.author || '';

                        console.log(`[YTMPX] Track Update: ${ytTrackData.title} — ${ytTrackData.author}`);

                        // PRIORITIZE image from extension metadata
                        if (data.metadata.image) {
                            ytTrackData.image = data.metadata.image;
                        }

                        if (data.event === 'track' || data.event === 'resume') {
                            ytTrackData.isPlaying = true;
                        } else if (data.event === 'pause') {
                            ytTrackData.isPlaying = false;
                        }

                        updateYtMusicUI();
                    }
                } catch (err) {
                    console.error('[YTMPX] Error parsing message:', err);
                }
            };

            ytmpxSocket.onclose = () => {
                isUsingExtension = false;
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
        if (isUsingExtension) return; // Skip backup detection if high-quality extension is active
        if (!apps || !Array.isArray(apps)) return;

        // Find all potential YouTube Music/YouTube tabs
        const ytApps = apps.filter(app => {
            if (!app.title) return false;
            const t = app.title.toLowerCase();
            // ONLY target YouTube Music or YT Music tabs
            return t.includes('youtube music') || t.includes('yt music');
        });

        if (ytApps.length > 0) {
            // Prefer a tab that looks like a track (has a separator) over a generic one
            const ytApp = ytApps.find(app => app.title.includes(' - ') || app.title.includes(' | ')) || ytApps[0];

            let rawTitle = ytApp.title;
            let cleaned = rawTitle.replace(/\s*[\-\|]\s*YouTube Music/gi, '')
                                 .replace(/^YouTube Music\s*[\-\|]\s*/gi, '')
                                 .replace(/\s*[\-\|]\s*YouTube/gi, '')
                                 .trim();

            // If the title is JUST a generic app name, it's likely just the home page or paused without track info
            const isGeneric = !cleaned ||
                              cleaned.toLowerCase() === 'youtube music' ||
                              cleaned.toLowerCase() === 'yt music' ||
                              cleaned.toLowerCase() === 'youtube';

            if (!isGeneric) {
                const parts = cleaned.split(/\s*[\-\|]\s*/);
                let newTitle = '';
                let newAuthor = '';
                if (parts.length >= 2) {
                    newTitle = parts[0].trim();
                    newAuthor = parts[1].trim();
                } else {
                    newTitle = cleaned;
                    newAuthor = 'YouTube Music';
                }

                // Update if the track changed OR if we were previously "not playing"
                if (ytTrackData.title !== newTitle || ytTrackData.author !== newAuthor || !ytTrackData.isPlaying) {
                    const trackChanged = ytTrackData.title !== newTitle || ytTrackData.author !== newAuthor;
                    ytTrackData.title = newTitle;
                    ytTrackData.author = newAuthor;
                    ytTrackData.isPlaying = true;

                    console.log(`[Backup] Track Update from Tab: ${ytTrackData.title} — ${ytTrackData.author}`);

                    // ALWAYS try to fetch art if we don't have it, especially when track changes
                    if (trackChanged || !ytTrackData.image) {
                        fetchAlbumArtFromiTunes(ytTrackData.title, ytTrackData.author);
                    }
                    updateYtMusicUI();
                }
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
        const hasTrack = (ytTrackData.title || ytTrackData.author);

        const trackString = (hasTrack)
            ? `${ytTrackData.title} — ${ytTrackData.author}` 
            : 'Not playing — YT Music';

        if (textSetup) textSetup.textContent = trackString;
        if (textTimer) textTimer.textContent = trackString;

        // FORCE SHOW ticker and album elements if we have track info OR in YT mode
        const showTicker = isYtMode || hasTrack;
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
        if (userData.accentMode === 'ytmusic_dynamic') {
            // Keep dynamic color if we have a track, even if paused
            if (hasTrack && coverSrc && coverSrc !== defaultCover) {
                extractDominantColor(coverSrc, (dynamicHex) => {
                    applyAccentTheme(dynamicHex);
                });
            } else if (!hasTrack) {
                // Only revert to default blue if no music is detected at all
                applyAccentTheme('#60cdff');
            }
        } else if (userData.accentMode === 'custom' || userData.accentMode === 'preset') {
            applyAccentTheme(userData.accentColor || '#60cdff');
        }

    }

    // Dynamic Accent Color Manager & Realtime CSS Variable Applicator
    function applyAccentTheme(hexColor) {
        if (!hexColor) return;
        document.documentElement.style.setProperty('--accent-blue', hexColor);
        document.documentElement.style.setProperty('--accent-blue-hover', hexColor);
        const picker = document.getElementById('accent-color-picker');
        if (picker && hexColor.startsWith('#')) picker.value = hexColor;
    }

    // Extract Vibrant Dominant Color from Album Cover Canvas
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
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2];
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const saturation = max === 0 ? 0 : (max - min) / max;
                    if (max > 40 && max < 240 && saturation > 0.15) {
                        rSum += r; gSum += g; bSum += b;
                        count++;
                    }
                }
                if (count > 0) {
                    const r = Math.round(rSum / count);
                    const g = Math.round(gSum / count);
                    const b = Math.round(bSum / count);
                    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                    callback(hex);
                } else {
                    callback('#60cdff');
                }
            } catch (e) {
                callback('#60cdff');
            }
        };
        img.onerror = () => callback('#60cdff');
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

        // BUG FIX: Prevent saving PIP size when transition is happening or if window is huge (Dashboard size)
        if (document.body.classList.contains('pip-mode') && !isInitializingPip) {
            const w = document.documentElement.clientWidth;
            const h = document.documentElement.clientHeight;

            // Only save if it's a valid small size (threshold is 600px to distinguish from Dashboard)
            if (w > 120 && h > 120 && w < 600 && h < 600) {
                userData.pipWidth = w;
                userData.pipHeight = h;
                saveUserData();
                console.log(`[PIP] Manual Resize Saved: ${w}x${h}`);
            } else {
                console.log(`[PIP] Resize Ignored (Transition or too large): ${w}x${h}`);
            }
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
            const sandStream = document.getElementById('sand-stream');

            if (topGroup && bottomGroup) {
                // Top chamber: Drains from full (y=40) to empty (y=100)
                // Path baseline is at 100. Translate from -60 to 0.
                const topY = -60 + (60 * progressRatio);
                topGroup.style.transform = `translateY(${topY}px)`;

                // Bottom chamber: Fills from empty (y=160) to full (y=100)
                // Path baseline is at 100. Translate from 60 to 0.
                const bottomY = 60 - (60 * progressRatio);
                bottomGroup.style.transform = `translateY(${bottomY}px)`;

                if (sandStream) {
                    const isFlowing = activeState === 'focusing' && !isPaused && ratio > 0;
                    sandStream.style.display = isFlowing ? 'block' : 'none';
                }
            }
        } else if (theme === 'orbit') {
            const particle = document.getElementById('orbit-particle');
            if (particle) {
                const angle = progressRatio * 360;
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

        const currentSpeed = userData.vinylSpeed || 6;
        const currentSize = userData.vinylSize || 340;
        document.documentElement.style.setProperty('--vinyl-speed', `${currentSpeed}s`);
        document.documentElement.style.setProperty('--vinyl-size', `${currentSize}px`);

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
                chip.classList.toggle('active', parseInt(chip.getAttribute('data-speed')) === currentSpeed);
            });
            setTimeout(syncVinylCenterPosition, 10);

            document.querySelectorAll('.size-preset-chip').forEach(chip => {
                chip.classList.toggle('active', parseInt(chip.getAttribute('data-size')) === currentSize);
            });

            document.querySelectorAll('.gif-mode-chip').forEach(chip => {
                chip.classList.toggle('active', chip.getAttribute('data-mode') === (userData.gifDisplayMode || 'circle'));
            });

            updateYtMusicUI();

        } else if (userData.ambientMode === 'custom' && userData.customGifData && userData.customGifData.length > 50) {
            if (btnSelectCustomGif) btnSelectCustomGif.classList.add('active');

            if (isFullMode) {
                cardGifImg.src = userData.customGifData;
                cardGifImg.style.opacity = opacity;
                cardGifContainer.style.display = 'block';
            } else {
                gaugeGifImg.src = userData.customGifData;
                gaugeGifImg.style.opacity = opacity;
                gaugeGifContainer.style.display = 'block';
            }

            // Sync modal preview thumbnail & controls
            if (gifPreviewImg) {
                gifPreviewImg.src = userData.customGifData;
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
    }

    // Render Recent GIFs History (Max 5 items)
    function renderRecentGifs() {
        const recentGifsSection = document.getElementById('recent-gifs-section');
        const recentGifsContainer = document.getElementById('recent-gifs-container');
        if (!recentGifsSection || !recentGifsContainer) return;

        userData.recentGifs = userData.recentGifs || [];
        
        // Auto-add current active GIF to recent list if not present
        if (userData.customGifData && userData.customGifData.length > 50) {
            const exists = userData.recentGifs.some(g => g.data === userData.customGifData);
            if (!exists) {
                userData.recentGifs.unshift({
                    id: Date.now().toString(),
                    name: userData.customGifName || 'Custom GIF',
                    data: userData.customGifData
                });
                if (userData.recentGifs.length > 5) {
                    userData.recentGifs = userData.recentGifs.slice(0, 5);
                }
                saveUserData();
            }
        }

        if (userData.recentGifs.length === 0) {
            recentGifsSection.style.display = 'none';
            return;
        }

        recentGifsSection.style.display = 'block';
        recentGifsContainer.innerHTML = '';

        userData.recentGifs.forEach((gif, index) => {
            const isActive = (userData.customGifData === gif.data);
            const card = document.createElement('div');
            card.className = `recent-gif-card ${isActive ? 'active' : ''}`;
            card.title = gif.name;

            card.innerHTML = `
                <img class="recent-gif-thumb" src="${gif.data}" alt="thumb">
                <div class="recent-gif-info">
                    <span class="recent-gif-title">${gif.name}</span>
                </div>
                <button class="btn-remove-recent" title="Remove from history">&times;</button>
            `;

            // Click card to switch to this GIF
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-recent')) return;
                userData.ambientMode = 'custom';
                userData.customGifData = gif.data;
                userData.customGifName = gif.name;
                saveUserData();
                applyGifTheme();
                renderRecentGifs();
            });

            // Click remove button
            card.querySelector('.btn-remove-recent')?.addEventListener('click', (e) => {
                e.stopPropagation();
                userData.recentGifs.splice(index, 1);
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

            recentGifsContainer.appendChild(card);
        });
    }

    applyGifTheme();
    applyTimerTheme();
    renderRecentGifs();

    // Clear Recent GIFs Button Listener
    document.getElementById('btn-clear-recent-gifs')?.addEventListener('click', () => {
        userData.recentGifs = [];
        saveUserData();
        renderRecentGifs();
    });

    // YT Music Vinyl Preset Button
    document.querySelector('.gif-chip[data-gif="ytmusic"]')?.addEventListener('click', () => {
        userData.ambientMode = 'ytmusic';
        saveUserData();
        applyGifTheme();
        renderRecentGifs();
    });

    // File Upload Handler
    btnSelectCustomGif.addEventListener('click', () => {
        gifFileInput.click();
    });

    gifFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const newData = evt.target.result;
            const newName = file.name;

            userData.ambientMode = 'custom';
            userData.customGifData = newData;
            userData.customGifName = newName;
            userData.gifOpacity = userData.gifOpacity || 78;
            userData.gifDisplayMode = userData.gifDisplayMode || 'circle';

            userData.recentGifs = userData.recentGifs || [];
            userData.recentGifs = userData.recentGifs.filter(g => g.data !== newData);
            userData.recentGifs.unshift({
                id: Date.now().toString(),
                name: newName,
                data: newData
            });
            if (userData.recentGifs.length > 5) {
                userData.recentGifs = userData.recentGifs.slice(0, 5);
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

    // Vinyl Rotation Speed Selector Switcher
    document.querySelectorAll('.speed-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            userData.vinylSpeed = parseInt(chip.getAttribute('data-speed')) || 6;
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

    // Accent Color Preset Chips Listener
    document.querySelectorAll('.accent-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const accentVal = chip.getAttribute('data-accent');
            document.querySelectorAll('.accent-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            if (accentVal === 'ytmusic_dynamic') {
                userData.accentMode = 'ytmusic_dynamic';
                saveUserData();
                updateYtMusicUI();
            } else {
                userData.accentMode = 'preset';
                userData.accentColor = accentVal;
                saveUserData();
                applyAccentTheme(accentVal);
            }
        });
    });

    // Custom Color Picker Listener
    document.getElementById('accent-color-picker')?.addEventListener('input', (e) => {
        const hex = e.target.value;
        userData.accentMode = 'custom';
        userData.accentColor = hex;
        document.querySelectorAll('.accent-chip').forEach(c => c.classList.remove('active'));
        saveUserData();
        applyAccentTheme(hex);
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

    // None GIF Preset Button
    document.querySelector('.gif-chip[data-gif="none"]')?.addEventListener('click', () => {
        userData.ambientMode = 'plant';
        userData.customGifData = '';
        userData.customGifName = '';
        saveUserData();
        applyGifTheme();
        renderRecentGifs();
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
            applyGifTheme();
            optionsModal.classList.add('active');
        });
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

        const searchQuery = (appSearchInput.value || '').trim().toLowerCase();

        let displayApps = cachedAppList.filter(app => {
            const isBlocked = blockedApps.some(a =>
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
            chk.checked = blockedApps.some(a =>
                a.toLowerCase() === app.exeName.toLowerCase()
            );

            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider';

            switchLabel.appendChild(chk);
            switchLabel.appendChild(sliderSpan);

            chk.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!blockedApps.includes(app.exeName)) blockedApps.push(app.exeName);
                } else {
                    blockedApps = blockedApps.filter(a =>
                        a.toLowerCase() !== app.exeName.toLowerCase()
                    );
                }
                userData.blockedApps = blockedApps;
                saveUserData();
                sendToCpp({ action: 'setBlacklist', blacklist: blockedApps });
            });

            item.appendChild(iconImg);
            item.appendChild(infoDiv);
            item.appendChild(switchLabel);

            appListContainer.appendChild(item);
        });
    };

    function updateStatsUI() {
        statGoalHours.textContent = userData.dailyGoalHours;
        statYesterday.textContent = userData.yesterdayHours;
        statStreak.textContent = userData.streakDays;
        statCompletedMins.textContent = userData.completedMinutesToday;

        const goalMins = userData.dailyGoalHours * 60;
        const donutRatio = Math.min(1.0, userData.completedMinutesToday / goalMins);
        goalDonutFill.style.strokeDashoffset = 301.5 * (1 - donutRatio);
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
        { text: "Fokus adalah seni mengatakan 'tidak' pada seribu hal baik lainnya.", author: "Steve Jobs" }
    ];

    const REST_QUOTES = [
        { text: "Istirahat bukan berarti berhenti, melainkan mengisi ulang energi untuk melangkah lebih jauh.", author: "Nasihat Sehat" },
        { text: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", author: "Ralph Marston" },
        { text: "Jauhkan pandangan dari layar, regangkan tubuhmu, dan hirup udara segar.", author: "Panduan Istirahat" },
        { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
        { text: "Kesehatan dan ketenangan pikiranmu adalah investasi terbaik untuk masa depan.", author: "Renungan Diri" },
        { text: "Take a break. A rested mind can solve problems that a tired mind cannot.", author: "Wellness Wisdom" },
        { text: "Minum air putih, berdiri sejenak, dan biarkan matamu beristirahat.", author: "Tips Sehat FocusGrow" },
        { text: "Rest is not idleness, and to lie sometimes on the grass under trees is by no means a waste of time.", author: "John Lubbock" },
        { text: "Tubuhmu butuh jeda agar bisa berlari kencang kembali nanti.", author: "Wejangan Bijak" },
        { text: "He who holds his breath for too long will collapse. Breathe and rest now.", author: "Ancient Wisdom" }
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

        // Goal Bar
        document.getElementById('stats-goal-target-text').textContent = `${(targetGoalMins / 60).toFixed(1)} hrs (${range})`;
        const remMins = Math.max(0, targetGoalMins - totalMins);
        document.getElementById('stats-goal-status-text').textContent = remMins > 0 ? `${(remMins / 60).toFixed(1)} hrs remaining` : `Goal Met! 🎉`;
        document.getElementById('stats-goal-bar-fill').style.width = `${goalPercent}%`;

        // Ranked App List
        const statsAppListContainer = document.getElementById('stats-app-list-container');
        statsAppListContainer.innerHTML = '';

        const sortedApps = Object.keys(appMap)
            .map(exe => ({ exe, secs: appMap[exe] }))
            .sort((a, b) => b.secs - a.secs);

        if (sortedApps.length === 0) {
            statsAppListContainer.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">No focus data recorded for this period yet. Start a focus session to track app statistics!</div>`;
            return;
        }

        const maxAppSecs = sortedApps[0].secs || 1;

        sortedApps.forEach(item => {
            const percent = totalSecs > 0 ? Math.round((item.secs / totalSecs) * 100) : 0;
            const relativePercent = Math.round((item.secs / maxAppSecs) * 100);

            // Lookup real extracted icon from userData.appIconMap or cachedAppList
            const lowerExe = item.exe.toLowerCase();
            let appIcon = (userData.appIconMap && userData.appIconMap[lowerExe]) || '';
            if (!appIcon && cachedAppList && cachedAppList.length > 0) {
                const found = cachedAppList.find(a => a.exeName && a.exeName.toLowerCase() === lowerExe);
                if (found && found.icon && found.icon.length > 30) appIcon = found.icon;
            }
            if (!appIcon) appIcon = defaultIconSvg;

            const div = document.createElement('div');
            div.className = 'stats-app-item';

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

            const timeDiv = document.createElement('div');
            timeDiv.className = 'stats-app-time';
            timeDiv.textContent = `${formatSecs(item.secs)} (${percent}%)`;

            topDiv.appendChild(nameDiv);
            topDiv.appendChild(timeDiv);

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

    // Process C++ IPC Messages & Trigger Notifications
    window.onCppStateUpdate = function(data, isPip) {
        if (!data) return;

        activeState = data.state;
        isPaused = data.isPaused;

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

        if (activeState !== previousState) {
            if (activeState === 'focusing' && previousState === 'idle') {
                sendNotification('Focus Mode Started', `Session started! Period 1 of ${data.totalPeriods || 1}. Stay focused!`);
                updateRandomQuote('focus');
            } else if (activeState === 'resting') {
                sendNotification('Time to Rest', `Focus period done! Step away from your computer for a ${selectedBreakMins} min break.`);
                updateRandomQuote('rest');
            } else if (activeState === 'focusing' && previousState === 'resting') {
                sendNotification('Focus Mode Active', `Break finished! Return to your work application.`);
                updateRandomQuote('focus');
            } else if (activeState === 'idle' && (previousState === 'focusing' || previousState === 'resting')) {
                sendNotification('Session Completed', `Great job! Focus session completed successfully.`);
                updateRandomQuote('focus');
            }
            previousState = activeState;
            notifiedOneMinWarning = false;
        }

        const warnSec = (data.maxPeriodSec <= 60) ? 30 : 60;
        if (data.remainingSec === warnSec && !notifiedOneMinWarning) {
            notifiedOneMinWarning = true;
            const warnText = (data.maxPeriodSec <= 60) ? '30 seconds' : '1 minute';
            if (activeState === 'focusing') {
                sendNotification('Period Warning', `${warnText} left of focus period! Get ready to take a break.`);
            } else if (activeState === 'resting') {
                sendNotification('Break Warning', `${warnText} left of break! Prepare to resume focus.`);
            }
        }

        const titlebarText = document.getElementById('titlebar-text');

        if (isPip) {
            document.body.classList.add('pip-mode');
        } else {
            document.body.classList.remove('pip-mode');
        }
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

        if (activeState === 'focusing') {
            setupView.classList.remove('active');
            timerView.classList.add('active');
            activeStatusLabel.textContent = isPaused ? 'PAUSED' : 'REMAINING';
            focusPeriodTitle.textContent = `Focus period (${data.currentPeriod || 1} of ${data.totalPeriods || 1})`;
            upNextText.textContent = `Up next: ${selectedBreakMins} min break`;
            
            pauseIcon.style.display = isPaused ? 'none' : 'block';
            playIcon.style.display = isPaused ? 'block' : 'none';
            setTimeout(syncVinylCenterPosition, 20);
        } else if (activeState === 'resting') {
            setupView.classList.remove('active');
            timerView.classList.add('active');
            activeStatusLabel.textContent = 'RESTING & STEP OUTSIDE';
            focusPeriodTitle.textContent = 'Mandatory Break';
            upNextText.textContent = 'Step away from screen & walk outside';
            setTimeout(syncVinylCenterPosition, 20);
        } else {
            timerView.classList.remove('active');
            setupView.classList.add('active');
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
    sendToCpp({ action: 'getRunningApps' });
    
    // Auto-poll running browser apps every 4 seconds to sync YouTube Music track titles
    setInterval(() => {
        sendToCpp({ action: 'getRunningApps' });
    }, 4000);
});
