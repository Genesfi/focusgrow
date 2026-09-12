// FocusGrow StayFree-Grade Blocked Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const domain = urlParams.get('domain') || 'restricted-site.com';
  const originalUrl = urlParams.get('target') || `https://${domain}`;
  const reason = urlParams.get('reason') || 'doomscroll';
  const cooldownStart = parseInt(urlParams.get('start')) || 0;
  const initialUsageSec = parseInt(urlParams.get('usage')) || 0;
  const initialLimitSec = parseInt(urlParams.get('limit')) || 300;

  // UI Elements
  const domainDisplay = document.getElementById('domain-display');
  const pageTitle = document.getElementById('page-title');
  const leadText = document.getElementById('lead-text');
  const siteFavicon = document.getElementById('site-favicon');
  const siteIconFallback = document.getElementById('site-icon-fallback');
  const statUsageToday = document.getElementById('stat-usage-today');
  const statDailyLimit = document.getElementById('stat-daily-limit');
  const passSection = document.getElementById('pass-section');
  const passNote = document.getElementById('pass-note');
  const cooldownSection = document.getElementById('cooldown-section');
  const cooldownTimer = document.getElementById('cooldown-timer');
  const btnCloseTab = document.getElementById('btn-close-tab');
  const btnGoBack = document.getElementById('btn-go-back');

  // Format Helper
  function formatDuration(totalSec) {
    if (!totalSec || totalSec <= 0) return '0m';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs > 0 ? secs + 's' : ''}`;
    return `${secs}s`;
  }

  // Display domain name
  if (domainDisplay) domainDisplay.textContent = domain;

  // Load website favicon
  if (siteFavicon && siteIconFallback) {
    siteFavicon.onload = () => {
      siteFavicon.style.display = 'block';
      siteIconFallback.style.display = 'none';
    };
    siteFavicon.onerror = () => {
      siteFavicon.style.display = 'none';
      siteIconFallback.style.display = 'block';
      siteIconFallback.textContent = domain.charAt(0).toUpperCase() || 'FG';
    };
    siteFavicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }

  // Set initial usage & limit
  if (statUsageToday) statUsageToday.textContent = formatDuration(initialUsageSec);
  if (statDailyLimit) statDailyLimit.textContent = formatDuration(initialLimitSec);

  // Query background for latest StayFree stats & passes
  chrome.runtime.sendMessage({ type: 'GET_POPUP_DATA' }, (res) => {
    if (res) {
      if (res.todayUsageSec && statUsageToday) {
        statUsageToday.textContent = formatDuration(res.todayUsageSec);
      }
      if (res.settings && res.settings.doomLimit && statDailyLimit) {
        statDailyLimit.textContent = `${res.settings.doomLimit}m`;
      }
      if (passNote && typeof res.passesLeft === 'number') {
        passNote.textContent = res.passesLeft > 0 
          ? `You have ${res.passesLeft} emergency pass${res.passesLeft > 1 ? 'es' : ''} left for this session.`
          : 'Emergency passes exhausted for this session.';
      }
    }
  });

  // Handle Cooldown Mode vs Pass Mode
  const isCooldownActive = (reason === 'doomscroll' && cooldownStart > 0);

  if (isCooldownActive) {
    // Show Cooldown View
    if (pageTitle) pageTitle.textContent = "Doomscroll Limit Reached";
    if (leadText) leadText.textContent = "You've reached your allowed browsing time. Step away and refresh your mind!";
    if (passSection) passSection.style.display = 'none';
    if (cooldownSection) cooldownSection.style.display = 'block';

    chrome.storage.local.get(['doomCooldown'], (res) => {
      const cooldownMins = res.doomCooldown || 30;

      function updateCountdown() {
        const now = Date.now();
        const elapsedMins = (now - cooldownStart) / (1000 * 60);
        const remainingSec = Math.max(0, Math.floor((cooldownMins - elapsedMins) * 60));

        if (remainingSec <= 0) {
          // Cooldown finished! Return to pass selection
          if (cooldownSection) cooldownSection.style.display = 'none';
          if (passSection) passSection.style.display = 'block';
          if (pageTitle) pageTitle.textContent = "Cooldown Complete";
          if (leadText) leadText.textContent = "Great job taking a break! Select a pass to continue or stay focused.";
          return true;
        }

        const m = Math.floor(remainingSec / 60);
        const s = remainingSec % 60;
        if (cooldownTimer) {
          cooldownTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return false;
      }

      const finished = updateCountdown();
      if (!finished) {
        const interval = setInterval(() => {
          if (updateCountdown()) clearInterval(interval);
        }, 1000);
      }
    });
  } else {
    // Standard Pass Mode
    if (passSection) passSection.style.display = 'block';
    if (cooldownSection) cooldownSection.style.display = 'none';
    if (reason === 'focus') {
      if (pageTitle) pageTitle.textContent = "Locked During Focus Mode";
      if (leadText) leadText.textContent = "A FocusGrow session is actively running on your desktop. Stay strong!";
    }
  }

  // Setup Emergency Pass Buttons
  document.querySelectorAll('.pass-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mins = parseInt(btn.getAttribute('data-mins')) || 5;

      // Disable button briefly
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';

      try {
        // 1. Try Desktop PC App first if connected
        let passGranted = false;
        try {
          const res = await fetch('http://127.0.0.1:8766/tab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grantPass: true, domain: domain, minutes: mins })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status !== "blocked") {
              passGranted = true;
            }
          }
        } catch (e) {}

        // 2. Fallback to Local Extension Pass
        if (!passGranted) {
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GRANT_PASS_LOCAL', domain, minutes: mins }, (response) => {
              if (response && response.success) {
                passGranted = true;
              }
              resolve();
            });
          });
        }

        if (passGranted) {
          // Redirect smoothly using replace so back button doesn't cycle
          window.location.replace(originalUrl);
        } else {
          alert("Limit Emergency Pass sudah habis untuk sesi ini!");
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
      } catch (err) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
    });
  });

  // Setup Actions
  if (btnCloseTab) {
    btnCloseTab.addEventListener('click', () => {
      window.close();
    });
  }

  if (btnGoBack) {
    btnGoBack.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });
  }
});
