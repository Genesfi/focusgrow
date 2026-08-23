document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const domain = urlParams.get('domain') || 'restricted-site.com';
  const originalUrl = urlParams.get('target') || `https://${domain}`;
  const reason = urlParams.get('reason');
  const cooldownStart = parseInt(urlParams.get('start')) || 0;

  const domainDisplay = document.getElementById('domain-display');
  if (domainDisplay) domainDisplay.textContent = domain;

  const passTitle = document.getElementById('pass-title');
  const passButtons = document.getElementById('pass-buttons');
  const cooldownSection = document.getElementById('cooldown-section');
  const cooldownTimer = document.getElementById('cooldown-timer');

  const setupPassButtons = (isDoomscroll = false) => {
    // Show Pass UI
    if (passTitle) {
        passTitle.style.display = 'block';
        passTitle.textContent = "Use Emergency Pass for this session?";
    }
    if (passButtons) {
        passButtons.style.display = 'flex';
        // Always show the standard 5, 10, 15 buttons for both modes
        passButtons.innerHTML = `
            <button class="pass-btn" data-mins="5">⚡ 5 Mins</button>
            <button class="pass-btn" data-mins="10">⚡ 10 Mins</button>
            <button class="pass-btn" data-mins="15">⚡ 15 Mins</button>
        `;
    }
    if (cooldownSection) cooldownSection.style.display = 'none';

    document.querySelectorAll('.pass-btn').forEach(btn => {
      // Clean up old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', async () => {
        const mins = parseInt(newBtn.getAttribute('data-mins'));

        try {
          const res = await fetch('http://127.0.0.1:8766/tab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grantPass: true, domain: domain, minutes: mins })
          }).catch(() => null);

          if (res && res.ok) {
             const data = await res.json();
             if (data.status === "blocked") {
                alert("Limit Emergency Pass sudah habis untuk sesi ini!");
                return;
             }
             window.location.href = originalUrl;
             return;
          }

          // Offline Mode or Doomscroll Limit (Local)
          chrome.runtime.sendMessage({ type: 'GRANT_PASS_LOCAL', domain, minutes: mins }, (response) => {
             if (response && response.success) {
                 window.location.href = originalUrl;
             } else {
                 alert("Limit Emergency Pass sudah habis untuk sesi ini!");
             }
          });
        } catch (e) {
          console.error(e);
        }
      });
    });
  };

  if (reason === 'doomscroll') {
      const isInitialBlock = (cooldownStart === 0);

      if (isInitialBlock) {
          // V22: Blocked by default in Doomscroll mode. Show option to activate limit.
          setupPassButtons(true);
          document.querySelector('h1').textContent = "Site Restricted (Doomscroll)";
          document.querySelector('p').textContent = "This site is on your restricted list. Do you want to use your daily 5-minute limit now?";
      } else {
          // ANTI-DOOMSCROLL MODE: Show cooldown
          if (passTitle) passTitle.style.display = 'none';
          if (passButtons) passButtons.style.display = 'none';
          if (cooldownSection) cooldownSection.style.display = 'block';

          // Update heading
          document.querySelector('h1').textContent = "Doomscroll Limit Reached";
          document.querySelector('p').textContent = "You've used your daily limit for this site. Take a break and recharge!";

          chrome.storage.local.get(['doomCooldown'], (res) => {
              const cooldownMins = res.doomCooldown || 30;

              function updateTimer() {
                  const now = Date.now();
                  const elapsedMins = (now - cooldownStart) / (1000 * 60);
                  const remainingSec = Math.max(0, Math.floor((cooldownMins - elapsedMins) * 60));

                  if (remainingSec <= 0) {
                      // V17 FIX: Don't redirect! Show Pass Selection instead.
                      setupPassButtons(false);
                      document.querySelector('p').textContent = "Cooldown finished! Select an Emergency Pass to continue browsing.";
                      return true; // Stop timer
                  }

                  const m = Math.floor(remainingSec / 60);
                  const s = remainingSec % 60;
                  if (cooldownTimer) cooldownTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                  return false;
              }

              const stop = updateTimer();
              if (!stop) {
                  const interval = setInterval(() => {
                      if (updateTimer()) clearInterval(interval);
                  }, 1000);
              }
          });
      }
  } else {
      setupPassButtons();
  }

  document.getElementById('btn-close-tab')?.addEventListener('click', () => {
    window.close();
  });
});
