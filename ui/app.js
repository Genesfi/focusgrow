// FocusGrow UI Logic, Notifications, Custom Local GIF Upload, Realtime Preview & Dynamic Scaling

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const setupView = document.getElementById('setup-view');
    const timerView = document.getElementById('timer-view');
    
    const pickerMinsDisplay = document.getElementById('picker-mins-display');
    const btnPickerUp = document.getElementById('btn-picker-up');
    const btnPickerDown = document.getElementById('btn-picker-down');

    const pickerBreakDisplay = document.getElementById('picker-break-display');
    const btnBreakUp = document.getElementById('btn-break-up');
    const btnBreakDown = document.getElementById('btn-break-down');

    const pickerPeriodDisplay = document.getElementById('picker-period-display');
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
        customGifData: '',
        customGifName: '',
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

    // Realtime GIF Theme & Display Mode Renderer
    function applyGifTheme() {
        const opacity = (userData.gifOpacity || 78) / 100;
        const isFullMode = (userData.gifDisplayMode === 'full');
        const plantGrowthContainer = document.getElementById('plant-growth-container');
        const defaultChip = document.querySelector('.gif-chip[data-gif="none"]');

        if (userData.customGifData && userData.customGifData.length > 50) {
            if (plantGrowthContainer) plantGrowthContainer.style.display = 'none';

            if (defaultChip) defaultChip.classList.remove('active');
            if (btnSelectCustomGif) btnSelectCustomGif.classList.add('active');

            if (isFullMode) {
                cardGifImg.src = userData.customGifData;
                cardGifImg.style.opacity = opacity;
                cardGifContainer.style.display = 'block';
                gaugeGifContainer.style.display = 'none';
            } else {
                gaugeGifImg.src = userData.customGifData;
                gaugeGifImg.style.opacity = opacity;
                gaugeGifContainer.style.display = 'block';
                cardGifContainer.style.display = 'none';
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
            if (gifOpacityRow) gifOpacityRow.style.display = 'block';
            if (gifOpacitySlider) gifOpacitySlider.value = userData.gifOpacity || 78;
            if (opacityLabel) opacityLabel.textContent = `${userData.gifOpacity || 78}%`;

            document.querySelectorAll('.gif-mode-chip').forEach(chip => {
                chip.classList.toggle('active', chip.getAttribute('data-mode') === (userData.gifDisplayMode || 'circle'));
            });
        } else {
            if (defaultChip) defaultChip.classList.add('active');
            if (btnSelectCustomGif) btnSelectCustomGif.classList.remove('active');

            gaugeGifContainer.style.display = 'none';
            cardGifContainer.style.display = 'none';
            gaugeGifImg.src = '';
            cardGifImg.src = '';
            if (plantGrowthContainer) plantGrowthContainer.style.display = 'flex';
            if (gifPreviewWrapper) gifPreviewWrapper.style.display = 'none';
            if (gifStyleSection) gifStyleSection.style.display = 'none';
            if (gifOpacityRow) gifOpacityRow.style.display = 'none';
            if (customGifNameDisplay) customGifNameDisplay.textContent = '';
        }
    }

    applyGifTheme();

    // File Upload Handler
    btnSelectCustomGif.addEventListener('click', () => {
        gifFileInput.click();
    });

    gifFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            userData.customGifData = evt.target.result;
            userData.customGifName = file.name;
            userData.gifOpacity = userData.gifOpacity || 78;
            userData.gifDisplayMode = userData.gifDisplayMode || 'circle';
            saveUserData();
            applyGifTheme();
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

    // None GIF Preset Button
    document.querySelector('.gif-chip[data-gif="none"]')?.addEventListener('click', () => {
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
    function updatePickerDisplay() {
        pickerMinsDisplay.textContent = selectedMins;
        if (pickerPeriodDisplay) pickerPeriodDisplay.textContent = selectedPeriodMins;
        pickerBreakDisplay.textContent = selectedBreakMins;

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
    btnCloseGoalModal.addEventListener('click', () => goalModal.classList.remove('active'));

    document.querySelectorAll('.goal-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const hours = parseInt(chip.getAttribute('data-hours')) || 1;
            userData.dailyGoalHours = hours;
            saveUserData();
            updateStatsUI();
            goalModal.classList.remove('active');
        });
    });

    btnOptions.addEventListener('click', () => {
        chkNotificationsToggle.checked = userData.notificationsEnabled;
        applyGifTheme();
        optionsModal.classList.add('active');
    });
    btnCloseOptionsModal.addEventListener('click', () => optionsModal.classList.remove('active'));

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

    // Process C++ IPC Messages & Trigger Notifications
    window.onCppStateUpdate = function(data, isPip) {
        if (!data) return;

        activeState = data.state;
        isPaused = data.isPaused;

        if (activeState !== previousState) {
            if (activeState === 'focusing' && previousState === 'idle') {
                sendNotification('Focus Mode Started', `Session started! Period 1 of ${data.totalPeriods || 1}. Stay focused!`);
            } else if (activeState === 'resting') {
                sendNotification('Time to Rest', `Focus period done! Step away from your computer for a ${selectedBreakMins} min break.`);
            } else if (activeState === 'focusing' && previousState === 'resting') {
                sendNotification('Focus Mode Active', `Break finished! Return to your work application.`);
            } else if (activeState === 'idle' && (previousState === 'focusing' || previousState === 'resting')) {
                sendNotification('Session Completed', `Great job! Focus session completed successfully.`);
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
            activeStatusLabel.textContent = isPaused ? 'PAUSED' : 'MINUTES REMAINING';
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
});
