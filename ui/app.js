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

    // PIP Floating Widget Toggle & Restore Buttons
    document.querySelectorAll('.btn-pip-toggle, #btn-pip-restore').forEach(btn => {
        btn.addEventListener('click', () => sendToCpp({ action: 'togglePip' }));
    });

    // Request Notification Permissions
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    // Persistent State Management
    const STORAGE_KEY = 'focusgrow_user_data_v1';
    const todayDateStr = new Date().toISOString().split('T')[0];

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
        customGifData: '',
        customGifName: '',
        recentGifs: [], // Stores up to 5 recently used custom GIFs: { id, name, data }
        allowedItems: ['code.exe', 'devenv.exe', 'idea64.exe', 'studio64.exe', 'notepad.exe', 'afterfx.exe']
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

    let selectedMins = userData.selectedMins || 30;
    let selectedPeriodMins = userData.selectedPeriodMins || 25;
    let selectedBreakMins = userData.selectedBreakMins || 5;
    let allowedItems = userData.allowedItems || [];
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
            };

            ytmpxSocket.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data && data.metadata) {
                        ytTrackData.title = data.metadata.title || '';
                        ytTrackData.author = data.metadata.author || '';
                        ytTrackData.image = data.metadata.image || '';

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
                setTimeout(connectYtmpxWebSocket, 3000);
            };

            ytmpxSocket.onerror = () => {
                ytmpxSocket.close();
            };
        } catch (e) {
            setTimeout(connectYtmpxWebSocket, 3000);
        }
    }

    connectYtmpxWebSocket();

    let lastFetchedTrackKey = '';

    function fetchAlbumArtFromiTunes(title, author) {
        if (!title) return;
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
                .catch(() => tryNextQuery(index + 1));
        }

        tryNextQuery(0);
    }

    function detectYtMusicFromBrowserTabs(apps) {
        if (!apps || !Array.isArray(apps)) return;

        const ytApp = apps.find(app => {
            if (!app.title) return false;
            const t = app.title.toLowerCase();
            return t.includes('youtube music') || t.includes('yt music');
        });

        if (ytApp && ytApp.title) {
            let rawTitle = ytApp.title;
            rawTitle = rawTitle.replace(/\s*[\-\|]\s*YouTube Music/gi, '');
            rawTitle = rawTitle.replace(/^YouTube Music\s*[\-\|]\s*/gi, '');

            if (rawTitle.trim()) {
                const parts = rawTitle.split(/\s*[\-\|]\s*/);
                if (parts.length >= 2) {
                    ytTrackData.title = parts[0].trim();
                    ytTrackData.author = parts[1].trim();
                } else {
                    ytTrackData.title = rawTitle.trim();
                    ytTrackData.author = 'YouTube Music';
                }
                ytTrackData.isPlaying = true;
                if (!ytTrackData.image) {
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

        const isYtMode = (userData.ambientMode === 'ytmusic');
        const hasTrack = (ytTrackData.title || ytTrackData.author);

        const trackString = hasTrack 
            ? `${ytTrackData.title} — ${ytTrackData.author}` 
            : 'Not playing — YT Music';

        if (textSetup) textSetup.textContent = trackString;
        if (textTimer) textTimer.textContent = trackString;

        const showTicker = isYtMode || hasTrack;
        if (tickerSetup) tickerSetup.style.display = showTicker ? 'flex' : 'none';
        if (tickerTimer) tickerTimer.style.display = showTicker ? 'flex' : 'none';

        const defaultCover = 'https://music.youtube.com/img/on_platform_logo.svg';
        const coverSrc = ytTrackData.image || defaultCover;
        
        if (vinylCoverImg) {
            if (vinylCoverImg.src !== coverSrc) vinylCoverImg.src = coverSrc;
            vinylCoverImg.classList.toggle('paused', !ytTrackData.isPlaying);
        }
        if (cardVinylCoverImg) {
            if (cardVinylCoverImg.src !== coverSrc) cardVinylCoverImg.src = coverSrc;
            cardVinylCoverImg.classList.toggle('paused', !ytTrackData.isPlaying);
        }

        if (!ytTrackData.image && ytTrackData.title) {
            fetchAlbumArtFromiTunes(ytTrackData.title, ytTrackData.author);
        }

        // Update Play/Pause Media Control Icons (❚❚ vs ▶)
        const isPaused = ytTrackData.isPaused || !ytTrackData.isPlaying;
        document.querySelectorAll('.btn-yt-playpause').forEach(btn => {
            const pausePath = btn.querySelector('.icon-pause-path');
            const playPath = btn.querySelector('.icon-play-path');
            if (pausePath && playPath) {
                pausePath.style.display = isPaused ? 'none' : 'block';
                playPath.style.display = isPaused ? 'block' : 'none';
            }
        });
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

        const currentSpeed = userData.vinylSpeed || 6;
        const currentSize = userData.vinylSize || 340;
        document.documentElement.style.setProperty('--vinyl-speed', `${currentSpeed}s`);
        document.documentElement.style.setProperty('--vinyl-size', `${currentSize}px`);

        const vinylSizeSlider = document.getElementById('vinyl-size-slider');
        const vinylSizeLabel = document.getElementById('vinyl-size-label');
        if (vinylSizeSlider) vinylSizeSlider.value = currentSize;
        if (vinylSizeLabel) vinylSizeLabel.textContent = `${currentSize}px`;

        // Reset visibility
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

    // YT Music Media Control Buttons (Prev, Play/Pause, Next)
    document.querySelectorAll('.btn-yt-prev').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendToCpp({ action: 'mediaPrev' });
        });
    });
    document.querySelectorAll('.btn-yt-playpause').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            ytTrackData.isPaused = !ytTrackData.isPaused;
            updateYtMusicUI();
            sendToCpp({ action: 'mediaPlayPause' });
        });
    });
    document.querySelectorAll('.btn-yt-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendToCpp({ action: 'mediaNext' });
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

    // Start Focus Session
    btnStartFocus.addEventListener('click', () => {
        const skipBreaks = chkSkipBreaks.checked;

        sendToCpp({
            action: 'startSession',
            focusMinutes: selectedMins,
            focusChunkMinutes: selectedPeriodMins,
            breakMinutes: selectedBreakMins,
            skipBreaks: skipBreaks,
            whitelist: allowedItems
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

    document.querySelectorAll('.btn-options-trigger, #btn-options').forEach(btn => {
        btn.addEventListener('click', () => {
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
        allowedItems = ['FocusGrow.exe', 'explorer.exe'];
        userData.allowedItems = allowedItems;
        saveUserData();
        sendToCpp({ action: 'setWhitelist', whitelist: allowedItems });
        renderAppList(cachedAppList);
        optionsModal.classList.remove('active');
    });

    // Search Input Listener
    appSearchInput.addEventListener('input', () => {
        renderAppList(cachedAppList);
    });

    // Refresh Apps List
    btnRefreshApps.addEventListener('click', () => {
        sendToCpp({ action: 'getRunningApps' });
    });

    const defaultIconSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2360cdff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>`;

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
            if (!searchQuery) return true;
            return (app.title && app.title.toLowerCase().includes(searchQuery)) ||
                   (app.exeName && app.exeName.toLowerCase().includes(searchQuery));
        });

        if (displayApps.length === 0) {
            appListContainer.innerHTML = `<div style="text-align:center; padding: 20px; font-size: 12px; color: var(--text-muted);">No matching applications or tabs found</div>`;
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
            chk.checked = allowedItems.some(a => 
                a.toLowerCase() === app.exeName.toLowerCase() || 
                (app.title && app.title.toLowerCase().includes(a.toLowerCase()))
            );

            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider';

            switchLabel.appendChild(chk);
            switchLabel.appendChild(sliderSpan);

            chk.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!allowedItems.includes(app.exeName)) allowedItems.push(app.exeName);
                } else {
                    allowedItems = allowedItems.filter(a => 
                        a.toLowerCase() !== app.exeName.toLowerCase() && 
                        (!app.title || !app.title.toLowerCase().includes(a.toLowerCase()))
                    );
                }
                userData.allowedItems = allowedItems;
                saveUserData();
                sendToCpp({ action: 'setWhitelist', whitelist: allowedItems });
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

    // Statistics Modal Handlers
    btnOpenStats?.addEventListener('click', () => {
        statsModal.classList.add('active');
        renderStatsDashboard('today');
    });

    btnCloseStatsModal?.addEventListener('click', () => {
        statsModal.classList.remove('active');
    });

    document.querySelectorAll('.stats-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.getAttribute('data-range');
            renderStatsDashboard(range);
        });
    });

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

    // Render Statistics Dashboard Modal
    let activeStatsRange = 'today';
    function renderStatsDashboard(range = activeStatsRange) {
        activeStatsRange = range;
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

        document.querySelectorAll('.stats-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-range') === range);
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
        } else if (activeState === 'resting') {
            setupView.classList.remove('active');
            timerView.classList.add('active');
            activeStatusLabel.textContent = 'RESTING & STEP OUTSIDE';
            focusPeriodTitle.textContent = 'Mandatory Break';
            upNextText.textContent = 'Step away from screen & walk outside';
        } else {
            timerView.classList.remove('active');
            setupView.classList.add('active');
        }

        if (data.remainingSec !== undefined && data.maxPeriodSec > 0) {
            const ratio = data.remainingSec / data.maxPeriodSec;
            const offset = 477.5 * (1 - ratio);
            gaugeProgressBar.style.strokeDashoffset = offset;

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
