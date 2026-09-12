// FocusGrow StayFree-Grade In-Page Overlay Modal & Floating Pass Pill

(function () {
  // Global error suppressor to prevent "Extension context invalidated" from polluting chrome://extensions
  window.addEventListener('error', (e) => {
    if (e && e.message && e.message.includes('Extension context invalidated')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
  }, true);

  // If extension context is already invalid, bail out immediately
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  // Only run in top-level window (prevent rogue iframe duplication and multi-frame timer conflicts)
  if (window.self !== window.top) return;

  // 1. Completely exempt YouTube Music from any blocks, overlays, or floating pills
  const currentHost = window.location.hostname.toLowerCase();
  if (currentHost === 'music.youtube.com' || currentHost.endsWith('.music.youtube.com')) {
    document.querySelectorAll('#focusgrow-floating-pill, [id^="focusgrow-floating"], #focusgrow-block-backdrop').forEach(el => {
      try { el.remove(); } catch (e) {}
    });
    return;
  }

  // Immediately purge any orphan floating pills or overlay backdrops from previous extension instances
  document.querySelectorAll('#focusgrow-floating-pill, [id^="focusgrow-floating"], #focusgrow-block-backdrop').forEach(el => {
    try { el.remove(); } catch (e) {}
  });

  // Quotes Database (Motivational & Rest Wisdom Quotes matching Native Windows FocusGrow)
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
    { text: "Tidur adalah meditasi terbaik. Tapi saat ini, cukup regangkan badanmu saja.", author: "Dalai Lama" },
    { text: "Sometimes the most productive thing you can do is relax.", author: "Mark Black" },
    { text: "Jangan merasa bersalah karena beristirahat. Mesin pun butuh pendinginan.", author: "Modern Productivity" },
    { text: "Tenangkan pikiranmu, dan jiwamu akan berbicara.", author: "Spirit Quote" },
    { text: "Your body hears everything your mind says. Give it some peace.", author: "Health First" },
    { text: "A change of pace is as good as a rest. Look away from the screen for a bit.", author: "Proverb" },
    { text: "Refresh your mind, clear your vision, and recharge your soul.", author: "Zen Master" },
    { text: "Breathe in confidence, breathe out doubt. Take this moment for yourself.", author: "Mindfulness" }
  ];

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
    { text: "Disiplin adalah jembatan antara cita-cita dan pencapaian.", author: "Success Logic" }
  ];

  function getRandomQuote(isCooldown) {
    const list = isCooldown ? REST_QUOTES : FOCUS_QUOTES;
    return list[Math.floor(Math.random() * list.length)];
  }

  function isExtensionAlive() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function cleanupSelf() {
    try {
      if (activeCooldownInterval) {
        clearInterval(activeCooldownInterval);
        activeCooldownInterval = null;
      }
      if (floatingTickerInterval) {
        clearInterval(floatingTickerInterval);
        floatingTickerInterval = null;
      }
      activeFloatingEndTime = 0;
      document.querySelectorAll('#focusgrow-floating-pill, [id^="focusgrow-floating"], #focusgrow-block-backdrop').forEach(el => {
        try { el.remove(); } catch (e) {}
      });
    } catch (e) {}
  }

  // Safe sendMessage helper that ignores errors and cleans up if extension was reloaded in chrome://extensions
  function safeSendMessage(msg, callback) {
    if (!isExtensionAlive()) {
      cleanupSelf();
      return;
    }
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        try {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
          if (callback) callback(res);
        } catch (e) {
          cleanupSelf();
        }
      });
    } catch (e) {
      cleanupSelf();
    }
  }

  let modalBackdrop = null;
  let timerWidget = null;
  let timerTextSpan = null;
  let labelSpan = null;
  let dotSpan = null;
  let isDragging = false;
  let userDismissedWidget = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let widgetStartX = 0;
  let widgetStartY = 0;
  let activeCooldownInterval = null;

  let currentSiteCooldownMins = 30;

  function showBlockModal(data) {
    if (data && typeof data.cooldownMins === 'number') {
      currentSiteCooldownMins = data.cooldownMins;
    }

    // Pause all HTML5 media on the page to prevent background noise
    try {
      document.querySelectorAll('video, audio').forEach(el => {
        try { el.pause(); } catch (e) {}
      });
    } catch (e) {}

    // Lock page scrolling
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');

    if (modalBackdrop && document.getElementById('focusgrow-block-backdrop')) {
      modalBackdrop.style.display = 'flex';
      updateModalContent(data);
      return;
    }

    modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'focusgrow-block-backdrop';
    modalBackdrop.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(10, 12, 16, 0.88) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      z-index: 2147483645 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      user-select: none !important;
      animation: fgFadeIn 0.25s ease-out !important;
    `;

    // FocusGrow Original Fluent Stepper & Dial UI (Distinct from StayFree)
    const card = document.createElement('div');
    card.id = 'focusgrow-modal-card';
    card.style.cssText = `
      background: #181920 !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 18px !important;
      box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.9), 0 0 1px rgba(255,255,255,0.2) !important;
      width: 380px !important;
      max-width: 90vw !important;
      padding: 24px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      color: #f8fafc !important;
      box-sizing: border-box !important;
      animation: fgScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
    `;

    card.innerHTML = `
      <!-- Header -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px;">
        <div>
          <div id="fg-modal-title" style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">Session Allowance</div>
          <div id="fg-modal-subtitle" style="font-size: 12px; color: #60cdff; margin-top: 2px;">x.com</div>
        </div>
        <button id="fg-modal-close-btn" style="background: none; border: none; font-size: 20px; color: #64748b; cursor: pointer; padding: 0 4px; line-height: 1; border-radius: 4px; transition: color 0.15s;" title="Close Tab">&times;</button>
      </div>

      <!-- Duration Selection Mode -->
      <div id="fg-duration-section">
        <!-- Focus Wisdom Quote Card -->
        <div id="fg-focus-quote-box" style="margin-bottom: 14px; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-left: 3px solid #60cdff; border-radius: 8px; text-align: left;">
          <div id="fg-focus-quote-text" style="font-size: 12px; font-style: italic; color: #cbd5e1; line-height: 1.5;">“Tetap fokus pada tujuanmu. Hasil besar dibangun dari langkah-langkah kecil setiap hari.”</div>
          <div id="fg-focus-quote-author" style="font-size: 10.5px; color: #64748b; margin-top: 4px; font-weight: 600; text-align: right;">— FocusGrow Wisdom</div>
        </div>

        <!-- Big Interactive Stepper Time Display -->
        <div style="background: #111217; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <button id="fg-step-minus" style="width: 36px; height: 36px; border-radius: 50%; background: #222430; border: 1px solid rgba(255,255,255,0.06); color: #e2e8f0; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">&minus;</button>
          
          <div style="text-align: center;">
            <div style="display: flex; align-items: baseline; justify-content: center; gap: 4px;">
              <input type="number" id="fg-stepper-val" value="5" min="1" max="240" style="width: 76px; background: transparent; border: none; outline: none; font-family: 'Segoe UI Variable Display', -apple-system, sans-serif; font-variant-numeric: tabular-nums; font-size: 38px; font-weight: 800; color: #60cdff; text-align: center; padding: 0;">
              <span style="font-size: 14px; font-weight: 600; color: #64748b;">min</span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: -2px;">Active screen allowance</div>
          </div>

          <button id="fg-step-plus" style="width: 36px; height: 36px; border-radius: 50%; background: #222430; border: 1px solid rgba(255,255,255,0.06); color: #e2e8f0; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">&#43;</button>
        </div>

        <!-- Quick Jump Chips (Equal width, perfect centering) -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 16px; width: 100%; box-sizing: border-box;">
          <button class="fg-chip-btn" data-mins="1" style="height: 36px; display: flex; align-items: center; justify-content: center; background: #222430; border: 1.5px solid transparent; border-radius: 8px; color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; box-sizing: border-box;">1m</button>
          <button class="fg-chip-btn" data-mins="5" style="height: 36px; display: flex; align-items: center; justify-content: center; background: #222430; border: 1.5px solid transparent; border-radius: 8px; color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; box-sizing: border-box;">5m</button>
          <button class="fg-chip-btn" data-mins="15" style="height: 36px; display: flex; align-items: center; justify-content: center; background: #222430; border: 1.5px solid transparent; border-radius: 8px; color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; box-sizing: border-box;">15m</button>
          <button class="fg-chip-btn" data-mins="30" style="height: 36px; display: flex; align-items: center; justify-content: center; background: #222430; border: 1.5px solid transparent; border-radius: 8px; color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; box-sizing: border-box;">30m</button>
          <button class="fg-chip-btn" data-mins="60" style="height: 36px; display: flex; align-items: center; justify-content: center; background: #222430; border: 1.5px solid transparent; border-radius: 8px; color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; box-sizing: border-box;">1h</button>
        </div>

        <!-- Primary Action -->
        <button id="fg-btn-launch-session" style="width: 100%; height: 42px; display: flex; align-items: center; justify-content: center; background: #60cdff; color: #041a2f; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; margin-bottom: 8px; box-sizing: border-box;">Begin Browsing</button>
        <button id="fg-btn-close-action" style="width: 100%; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; color: #64748b; border: none; font-size: 12px; cursor: pointer; transition: color 0.15s; box-sizing: border-box;">Leave Site</button>
      </div>

      <!-- Cooldown Section (shown when in cooldown) -->
      <div id="fg-cooldown-section" style="display: none; text-align: center;">
        <div id="fg-cooldown-timer" style="font-family: 'Segoe UI Variable Display', -apple-system, system-ui, sans-serif !important; font-variant-numeric: tabular-nums !important; font-size: 52px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1; margin: 4px 0 8px 0; text-align: center;">00:00</div>
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">Browsing is paused until this timer expires.</div>

        <!-- Rest Wisdom Quote Card (Native Windows Match) -->
        <div id="fg-cooldown-quote-box" style="margin: 0 0 18px 0; padding: 12px 16px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); border-left: 3px solid #f43f5e; border-radius: 10px; text-align: left; box-sizing: border-box;">
          <div id="fg-quote-text" style="font-size: 12.5px; font-style: italic; color: #cbd5e1; line-height: 1.55;">“Istirahat bukan berarti berhenti, melainkan mengisi ulang energi untuk melangkah lebih jauh.”</div>
          <div id="fg-quote-author" style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 600; text-align: right;">— Nasihat Sehat</div>
        </div>

        <div id="fg-cooldown-pass-box" style="margin-bottom: 26px; width: 100%; display: none;">
          <button id="fg-btn-emergency-pass" style="width: 100%; height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; box-sizing: border-box;">
            <span>5m Emergency Pass</span>
            <span style="font-size: 11px; padding: 2px 7px; border-radius: 10px; background: rgba(56, 189, 248, 0.2); color: #7dd3fc;"><span id="fg-cooldown-passes-left">2</span> left</span>
          </button>
        </div>

        <button id="fg-btn-cooldown-close" style="width: 100%; height: 34px; display: flex; align-items: center; justify-content: center; background: transparent; color: #94a3b8; border: none; font-size: 12px; cursor: pointer; transition: color 0.15s; box-sizing: border-box;">Close Tab</button>
      </div>
    `;

    // Inject Styles
    if (!document.getElementById('fg-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'fg-modal-styles';
      style.textContent = `
        @keyframes fgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fgScaleUp { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        #fg-step-minus:hover, #fg-step-plus:hover {
          background: #2f3344 !important;
          color: #ffffff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .fg-chip-btn:hover {
          background: #2a2d3d !important;
          color: #ffffff !important;
          border-color: rgba(96, 205, 255, 0.3) !important;
        }
        .fg-chip-btn.active {
          background: rgba(96, 205, 255, 0.12) !important;
          color: #60cdff !important;
          border-color: #60cdff !important;
        }
        #fg-btn-launch-session:hover {
          background: #70d3ff !important;
          box-shadow: 0 4px 14px rgba(96, 205, 255, 0.35);
        }
        #fg-btn-close-action:hover, #fg-btn-cooldown-close:hover {
          color: #e2e8f0 !important;
        }
        #fg-modal-close-btn:hover {
          color: #f43f5e !important;
        }
      `;
      document.head.appendChild(style);
    }

    modalBackdrop.appendChild(card);
    document.body.appendChild(modalBackdrop);

    // Bind Close Tab (x button & Close button)
    modalBackdrop.querySelector('#fg-modal-close-btn').addEventListener('click', () => {
      safeSendMessage({ type: 'CLOSE_ACTIVE_TAB' });
    });
    modalBackdrop.querySelector('#fg-btn-close-action').addEventListener('click', () => {
      safeSendMessage({ type: 'CLOSE_ACTIVE_TAB' });
    });
    modalBackdrop.querySelector('#fg-btn-cooldown-close').addEventListener('click', () => {
      safeSendMessage({ type: 'CLOSE_ACTIVE_TAB' });
    });

    // Stepper Input Element & Controls
    const stepperVal = modalBackdrop.querySelector('#fg-stepper-val');
    const stepMinus = modalBackdrop.querySelector('#fg-step-minus');
    const stepPlus = modalBackdrop.querySelector('#fg-step-plus');
    const launchBtn = modalBackdrop.querySelector('#fg-btn-launch-session');
    const chipBtns = modalBackdrop.querySelectorAll('.fg-chip-btn');

    function setMinutes(m) {
      const clamped = Math.max(1, Math.min(240, m));
      if (stepperVal) stepperVal.value = clamped;
      chipBtns.forEach(c => {
        if (parseInt(c.getAttribute('data-mins'), 10) === clamped) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
    }

    if (stepMinus) {
      stepMinus.addEventListener('click', () => {
        const cur = parseInt(stepperVal.value, 10) || 5;
        const delta = cur <= 5 ? 1 : 5;
        setMinutes(cur - delta);
      });
    }

    if (stepPlus) {
      stepPlus.addEventListener('click', () => {
        const cur = parseInt(stepperVal.value, 10) || 5;
        const delta = cur < 5 ? 1 : 5;
        setMinutes(cur + delta);
      });
    }

    if (stepperVal) {
      stepperVal.addEventListener('change', () => {
        setMinutes(parseInt(stepperVal.value, 10) || 5);
      });
      stepperVal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && launchBtn) {
          launchBtn.click();
        }
      });
    }

    // Quick chips click
    chipBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.getAttribute('data-mins'), 10) || 5;
        setMinutes(mins);
      });
    });

    // Launch Session Button -> Starts Session Limit!
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        const mins = parseInt(stepperVal ? stepperVal.value : '5', 10) || 5;
        startSessionAndDismiss(data.domain, mins, launchBtn);
      });
    }

    // Set initial active chip for 5m default
    setMinutes(5);

    // Bind Emergency Pass during Cooldown
    const emergencyBtn = modalBackdrop.querySelector('#fg-btn-emergency-pass');
    if (emergencyBtn) {
      emergencyBtn.addEventListener('click', () => {
        grantEmergencyPassAndDismiss(data.domain, 5, emergencyBtn);
      });
    }

    updateModalContent(data);
  }

  function updateModalContent(data) {
    if (!modalBackdrop) return;

    const durationSection = modalBackdrop.querySelector('#fg-duration-section');
    const cooldownSection = modalBackdrop.querySelector('#fg-cooldown-section');
    const cooldownTimer = modalBackdrop.querySelector('#fg-cooldown-timer');
    const modalTitle = modalBackdrop.querySelector('#fg-modal-title');
    const modalSubtitle = modalBackdrop.querySelector('#fg-modal-subtitle');
    const passBox = modalBackdrop.querySelector('#fg-cooldown-pass-box');
    const passesLeftSpan = modalBackdrop.querySelector('#fg-cooldown-passes-left');

    if (activeCooldownInterval) {
      clearInterval(activeCooldownInterval);
      activeCooldownInterval = null;
    }

    const isCooldown = !!(data.isCooldown || (data.cooldownStart > 0));

    if (isCooldown) {
      durationSection.style.display = 'none';
      cooldownSection.style.display = 'block';
      modalTitle.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;color:#f43f5e;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f43f5e;box-shadow:0 0 8px #f43f5e;"></span>Cooldown Active</span>';
      modalSubtitle.textContent = data.domain || 'this site';
      modalSubtitle.style.color = '#94a3b8';

      // Populate random rest/wisdom quote
      const restQuote = getRandomQuote(true);
      const qText = modalBackdrop.querySelector('#fg-quote-text');
      const qAuthor = modalBackdrop.querySelector('#fg-quote-author');
      if (qText && restQuote) qText.textContent = `“${restQuote.text}”`;
      if (qAuthor && restQuote) qAuthor.textContent = `— ${restQuote.author}`;

      if (passBox && passesLeftSpan) {
        const pLeft = typeof data.passesLeft === 'number' ? data.passesLeft : 0;
        if (pLeft > 0) {
          passBox.style.display = 'block';
          passesLeftSpan.textContent = pLeft;
        } else {
          passBox.style.display = 'none';
        }
      }

      const cooldownMins = data.cooldownMins || 30;
      const startTime = data.cooldownStart > 0 ? data.cooldownStart : Date.now();

      function tickCooldown() {
        const now = Date.now();
        const elapsedMins = (now - startTime) / (1000 * 60);
        const remainingSec = Math.max(0, Math.floor((cooldownMins - elapsedMins) * 60));

        if (remainingSec <= 0) {
          // Cooldown finished! Return to duration selection
          durationSection.style.display = 'block';
          cooldownSection.style.display = 'none';
          modalTitle.textContent = "Session Allowance";
          modalSubtitle.textContent = data.domain || 'this site';
          modalSubtitle.style.color = '#60cdff';

          const fQuote = getRandomQuote(false);
          const fText = modalBackdrop.querySelector('#fg-focus-quote-text');
          const fAuthor = modalBackdrop.querySelector('#fg-focus-quote-author');
          if (fText && fQuote) fText.textContent = `“${fQuote.text}”`;
          if (fAuthor && fQuote) fAuthor.textContent = `— ${fQuote.author}`;
          return true;
        }

        const m = Math.floor(remainingSec / 60);
        const s = remainingSec % 60;
        if (cooldownTimer) {
          cooldownTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return false;
      }

      if (!tickCooldown()) {
        activeCooldownInterval = setInterval(() => {
          if (tickCooldown()) {
            clearInterval(activeCooldownInterval);
            activeCooldownInterval = null;
          }
        }, 1000);
      }
    } else {
      durationSection.style.display = 'block';
      cooldownSection.style.display = 'none';
      modalTitle.textContent = "Session Allowance";
      modalSubtitle.textContent = data.domain || 'this site';
      modalSubtitle.style.color = '#60cdff';

      const fQuote = getRandomQuote(false);
      const fText = modalBackdrop.querySelector('#fg-focus-quote-text');
      const fAuthor = modalBackdrop.querySelector('#fg-focus-quote-author');
      if (fText && fQuote) fText.textContent = `“${fQuote.text}”`;
      if (fAuthor && fQuote) fAuthor.textContent = `— ${fQuote.author}`;
    }
  }

  function hideBlockModal() {
    if (activeCooldownInterval) {
      clearInterval(activeCooldownInterval);
      activeCooldownInterval = null;
    }
    if (modalBackdrop && modalBackdrop.parentNode) {
      modalBackdrop.remove();
      modalBackdrop = null;
    }
    // Restore page scrolling
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
  }

  // Starts a normal session limit (does NOT consume emergency passes)
  function startSessionAndDismiss(domain, minutes, btn) {
    if (btn) {
      btn.style.opacity = '0.5';
      btn.textContent = '...';
    }

    safeSendMessage({
      type: 'START_SESSION_LIMIT',
      domain: domain,
      minutes: minutes
    }, (res) => {
      if (res && res.success) {
        userDismissedWidget = false;
        hideBlockModal();
      } else {
        if (btn) {
          btn.style.opacity = '1';
          btn.textContent = 'Retry';
        }
      }
    });
  }

  // Grants an Emergency Pass during Cooldown / Focus Mode (consumes emergency pass)
  function grantEmergencyPassAndDismiss(domain, minutes, btn) {
    if (btn) {
      btn.style.opacity = '0.5';
      btn.textContent = '...';
    }

    // Direct ping to PC desktop app as well for zero latency
    try {
      fetch('http://127.0.0.1:8766/tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantPass: true, domain: domain, minutes: minutes })
      }).catch(() => {});
    } catch (e) {}

    safeSendMessage({
      type: 'GRANT_PASS_LOCAL',
      domain: domain,
      minutes: minutes
    }, (res) => {
      if (res && res.success) {
        userDismissedWidget = false;
        hideBlockModal();
      } else {
        alert(res?.reason || "No emergency passes left!");
        if (btn) {
          btn.style.opacity = '1';
          btn.textContent = 'Limit Reached';
        }
      }
    });
  }

  // ====================================================
  // 2. IN-PAGE FLOATING PASS PILL WIDGET
  // ====================================================

  function createWidget() {
    if (!isExtensionAlive()) return;
    const currentHost = window.location.hostname.toLowerCase();
    if (currentHost === 'music.youtube.com' || currentHost.endsWith('.music.youtube.com')) return;

    // 1. Clean up any existing or orphaned pills in the DOM first
    const existingPills = document.querySelectorAll('#focusgrow-floating-pill, [id^="focusgrow-floating"]');
    if (existingPills.length > 0) {
      existingPills.forEach((p, idx) => {
        if (idx === 0) {
          timerWidget = p;
        } else {
          p.remove();
        }
      });
      if (timerWidget) {
        timerTextSpan = timerWidget.querySelector('#fg-pass-countdown');
        labelSpan = timerWidget.querySelector('#fg-label');
        dotSpan = timerWidget.querySelector('#fg-pulse-dot');
        return;
      }
    }

    timerWidget = document.createElement('div');
    timerWidget.id = 'focusgrow-floating-pill';
    timerWidget.style.cssText = `
      position: fixed !important;
      top: 80px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      background: rgba(15, 23, 42, 0.90) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 1px solid rgba(16, 185, 129, 0.45) !important;
      box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.65), 0 0 15px rgba(16, 185, 129, 0.25) !important;
      border-radius: 9999px !important;
      padding: 6px 14px 6px 12px !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      color: #f8fafc !important;
      font-size: 12px !important;
      user-select: none !important;
      cursor: grab !important;
      transition: border-color 0.3s ease, box-shadow 0.3s ease !important;
    `;

    timerWidget.innerHTML = `
      <div id="fg-drag-grip" style="display: flex; align-items: center; opacity: 0.4; margin-right: -2px; cursor: grab;" title="Drag to move">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="2" cy="2" r="1.5"/>
          <circle cx="8" cy="2" r="1.5"/>
          <circle cx="2" cy="7" r="1.5"/>
          <circle cx="8" cy="7" r="1.5"/>
          <circle cx="2" cy="12" r="1.5"/>
          <circle cx="8" cy="12" r="1.5"/>
        </svg>
      </div>
      <span id="fg-pulse-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; animation: fgGlowPulse 1.8s infinite;"></span>
      <span id="fg-label" style="color: #10b981; font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">PASS:</span>
      <span id="fg-pass-countdown" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; font-size: 13px; font-weight: 700; color: #ffffff;">00:00</span>
      <span id="fg-btn-close-pill" style="cursor: pointer; opacity: 0.5; margin-left: 4px; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 4px; transition: opacity 0.2s;" title="Hide for now">&times;</span>
    `;

    if (!document.getElementById('fg-floating-styles')) {
      const style = document.createElement('style');
      style.id = 'fg-floating-styles';
      style.textContent = `
        @keyframes fgGlowPulse {
          0% { opacity: 0.5; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.12); }
          100% { opacity: 0.5; transform: scale(0.92); }
        }
        #focusgrow-floating-pill:hover { border-color: rgba(56, 189, 248, 0.7) !important; }
        #fg-btn-close-pill:hover { opacity: 1 !important; color: #f43f5e !important; }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(timerWidget);

    timerTextSpan = timerWidget.querySelector('#fg-pass-countdown');
    labelSpan = timerWidget.querySelector('#fg-label');
    dotSpan = timerWidget.querySelector('#fg-pulse-dot');

    timerWidget.querySelector('#fg-btn-close-pill').addEventListener('click', (e) => {
      e.stopPropagation();
      userDismissedWidget = true;
      timerWidget.style.display = 'none';
    });

    setupDraggable(timerWidget);
  }

  function setupDraggable(el) {
    el.addEventListener('mousedown', (e) => {
      if (e.target.id === 'fg-btn-close-pill') return;
      isDragging = true;
      el.style.cursor = 'grabbing';
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = el.getBoundingClientRect();
      widgetStartX = rect.left;
      widgetStartY = rect.top;

      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = widgetStartX + 'px';
      el.style.top = widgetStartY + 'px';

      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || !timerWidget) return;
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;

      let newLeft = widgetStartX + deltaX;
      let newTop = widgetStartY + deltaY;

      const maxLeft = window.innerWidth - timerWidget.offsetWidth - 10;
      const maxTop = window.innerHeight - timerWidget.offsetHeight - 10;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft));
      newTop = Math.max(10, Math.min(newTop, maxTop));

      timerWidget.style.left = newLeft + 'px';
      timerWidget.style.top = newTop + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (isDragging && timerWidget) {
        isDragging = false;
        timerWidget.style.cursor = 'grab';
      }
    });
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  let activeFloatingEndTime = 0;
  let activeFloatingLabel = "LIMIT";
  let floatingTickerInterval = null;

  function renderFloatingState(label, remainingSec) {
    if (!timerWidget) return;
    if (labelSpan) labelSpan.textContent = `${label || 'LIMIT'}:`;
    if (timerTextSpan) timerTextSpan.textContent = formatTime(remainingSec);

    if (remainingSec <= 20) {
      timerWidget.style.borderColor = 'rgba(244, 63, 94, 0.85)';
      timerWidget.style.boxShadow = '0 12px 30px -4px rgba(0, 0, 0, 0.7), 0 0 16px rgba(244, 63, 94, 0.4)';
      if (dotSpan) {
        dotSpan.style.background = '#f43f5e';
        dotSpan.style.boxShadow = '0 0 10px #f43f5e';
      }
      if (labelSpan) labelSpan.style.color = '#f43f5e';
      if (timerTextSpan) timerTextSpan.style.color = '#fecdd3';
    } else if (label === "PASS") {
      timerWidget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
      timerWidget.style.boxShadow = '0 12px 30px -4px rgba(0, 0, 0, 0.65), 0 0 15px rgba(16, 185, 129, 0.25)';
      if (dotSpan) {
        dotSpan.style.background = '#10b981';
        dotSpan.style.boxShadow = '0 0 8px #10b981';
      }
      if (labelSpan) labelSpan.style.color = '#10b981';
      if (timerTextSpan) timerTextSpan.style.color = '#ffffff';
    } else {
      // LIMIT / SESSION mode
      timerWidget.style.borderColor = 'rgba(56, 189, 248, 0.6)';
      timerWidget.style.boxShadow = '0 12px 30px -4px rgba(0, 0, 0, 0.65), 0 0 15px rgba(56, 189, 248, 0.25)';
      if (dotSpan) {
        dotSpan.style.background = '#38bdf8';
        dotSpan.style.boxShadow = '0 0 8px #38bdf8';
      }
      if (labelSpan) labelSpan.style.color = '#38bdf8';
      if (timerTextSpan) timerTextSpan.style.color = '#ffffff';
    }
  }

  function startFloatingTicker(targetEndTime, label) {
    activeFloatingEndTime = targetEndTime;
    activeFloatingLabel = label || 'LIMIT';
    if (floatingTickerInterval) clearInterval(floatingTickerInterval);
    floatingTickerInterval = setInterval(() => {
      if (!isExtensionAlive() || !activeFloatingEndTime) {
        if (floatingTickerInterval) clearInterval(floatingTickerInterval);
        return;
      }
      const rem = Math.max(0, Math.ceil((activeFloatingEndTime - Date.now()) / 1000));
      renderFloatingState(activeFloatingLabel, rem);
      if (rem === 0) {
        activeFloatingEndTime = 0;
        if (floatingTickerInterval) clearInterval(floatingTickerInterval);
        if (timerWidget) timerWidget.style.display = 'none';
        safeSendMessage({ type: 'CHECK_PAGE_RESTRICTION' });
      }
    }, 1000);
  }

  // ====================================================
  // 3. RUNTIME MESSAGE LISTENERS
  // ====================================================

  const messageListener = (msg) => {
    try {
      if (!isExtensionAlive()) {
        try { chrome.runtime.onMessage.removeListener(messageListener); } catch (e) {}
        cleanupSelf();
        return;
      }

      const currentHost = window.location.hostname.toLowerCase();
      if (currentHost === 'music.youtube.com' || currentHost.endsWith('.music.youtube.com')) {
        cleanupSelf();
        return;
      }

      // Show Modal Overlay
      if (msg.type === 'SHOW_BLOCK_MODAL') {
        showBlockModal(msg);
        if (timerWidget) timerWidget.style.display = 'none';
      }

      // Hide Modal Overlay
      if (msg.type === 'HIDE_BLOCK_MODAL') {
        hideBlockModal();
      }

      // Update Emergency Pass Availability in active modal
      if (msg.type === 'UPDATE_PASS_STATUS') {
        const passBox = document.getElementById('fg-cooldown-pass-box');
        const passesLeftSpan = document.getElementById('fg-cooldown-passes-left');
        if (passBox && passesLeftSpan) {
          if (msg.passesLeft > 0) {
            passBox.style.display = 'block';
            passesLeftSpan.textContent = msg.passesLeft;
          } else {
            passBox.style.display = 'none';
          }
        }
      }

      // Update Floating Timer Pill (Real-Time Synchronized)
      if (msg.type === 'PASS_STATUS_UPDATE') {
        if (msg.isPassActive && msg.remainingSec > 0) {
          hideBlockModal(); // Pass is active, ensure modal is closed

          // Remove any duplicates in DOM
          const allPills = document.querySelectorAll('#focusgrow-floating-pill, [id^="focusgrow-floating"]');
          if (allPills.length > 1) {
            allPills.forEach((p, idx) => {
              if (idx > 0) p.remove();
            });
          }

          if (!timerWidget || !document.body.contains(timerWidget)) {
            createWidget();
          }

          if (timerWidget) {
            if (!userDismissedWidget) {
              timerWidget.style.display = 'flex';
            }

            const targetEnd = msg.targetEndTime || (Date.now() + msg.remainingSec * 1000);
            renderFloatingState(msg.label, msg.remainingSec);
            startFloatingTicker(targetEnd, msg.label);
          }
        } else {
          activeFloatingEndTime = 0;
          if (floatingTickerInterval) {
            clearInterval(floatingTickerInterval);
            floatingTickerInterval = null;
          }
          if (timerWidget) timerWidget.style.display = 'none';
          document.querySelectorAll('#focusgrow-floating-pill, [id^="focusgrow-floating"]').forEach(el => {
            el.style.display = 'none';
          });
        }
      }
    } catch (err) {
      try { chrome.runtime.onMessage.removeListener(messageListener); } catch (e) {}
      cleanupSelf();
    }
  };

  try {
    chrome.runtime.onMessage.addListener(messageListener);
  } catch (e) {}

  // Query background on initial injection to immediately check policy
  safeSendMessage({ type: 'CHECK_PAGE_RESTRICTION' });

  // When user switches back to this tab, immediately refresh policy & timer state
  const handleVisibilityOrFocus = () => {
    if (!isExtensionAlive()) {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      cleanupSelf();
      return;
    }
    if (document.visibilityState === 'visible') {
      safeSendMessage({ type: 'CHECK_PAGE_RESTRICTION' });
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  window.addEventListener('focus', handleVisibilityOrFocus);
})();
