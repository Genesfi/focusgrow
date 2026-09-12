// FocusGrow StayFree-Grade Popup Dashboard Logic (with Per-Site Cooldown & Limits)

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const connStatus = document.getElementById('conn-status');
  const activeFavicon = document.getElementById('active-favicon');
  const activeDomain = document.getElementById('active-domain');
  const siteTag = document.getElementById('site-tag');
  const usageTime = document.getElementById('usage-time');
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');
  const limitText = document.getElementById('limit-text');
  const quickPassBox = document.getElementById('quick-pass-box');
  const passAvailableText = document.getElementById('pass-available-text');
  const btnQuickPass = document.getElementById('btn-quick-pass');
  const topSitesList = document.getElementById('top-sites-list');
  const perSiteCooldownList = document.getElementById('per-site-cooldown-list');
  const doomLimitInput = document.getElementById('doom-limit');
  const doomCooldownInput = document.getElementById('doom-cooldown');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Per-site config elements
  const siteConfigBox = document.getElementById('site-config-box');
  const siteConfigDomain = document.getElementById('site-config-domain');
  const siteLimitInput = document.getElementById('site-limit-input');
  const siteCooldownInput = document.getElementById('site-cooldown-input');
  const btnSaveSiteConfig = document.getElementById('btn-save-site-config');

  let currentDomain = '';
  let cachedSiteConfigs = {};
  let isEditingAnyInput = false;
  let cooldownListRendered = false;
  let lastRenderedSitesKey = '';

  function formatTimeDetailed(totalSec) {
    if (!totalSec || totalSec <= 0) return '0m 00s';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${String(secs).padStart(2, '0')}s`;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }

  function formatTimeShort(totalSec) {
    if (!totalSec || totalSec <= 0) return '0m';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `${totalSec}s`;
  }

  // Prevent input reset while user is typing
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.tagName === 'INPUT') {
      isEditingAnyInput = true;
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target && e.target.tagName === 'INPUT') {
      isEditingAnyInput = false;
    }
  });

  function renderPerSiteCooldowns(restrictedSites, defaultCd, defaultLim) {
    if (!perSiteCooldownList) return;
    perSiteCooldownList.innerHTML = '';

    restrictedSites.forEach(d => {
      const domainConfig = cachedSiteConfigs[d] || {};
      const currentCd = typeof domainConfig.cooldown === 'number' ? domainConfig.cooldown : defaultCd;
      const currentLim = typeof domainConfig.limit === 'number' ? domainConfig.limit : defaultLim;

      const row = document.createElement('div');
      row.className = 'site-row';
      row.style.padding = '5px 0';

      const left = document.createElement('div');
      left.className = 'site-row-left';

      const icon = document.createElement('img');
      icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=16`;
      icon.onerror = () => { icon.style.display = 'none'; };

      const name = document.createElement('span');
      name.className = 'site-row-domain';
      name.textContent = d;

      left.appendChild(icon);
      left.appendChild(name);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '6px';

      right.innerHTML = `
        <span style="font-size: 10px; color: #94a3b8;">Cool:</span>
        <input type="number" class="site-cd-quick-input" data-domain="${d}" value="${currentCd}" min="1" max="240" style="width: 44px; padding: 2px 4px; font-size: 11px; text-align: center; background: #0f172a; color: #38bdf8; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;">
        <span style="font-size: 10px; color: #64748b;">m</span>
      `;

      const cdInput = right.querySelector('.site-cd-quick-input');

      // Auto-save immediately on input (spinner click or keypress)
      const handleCooldownChange = () => {
        const val = parseInt(cdInput.value, 10);
        if (!isNaN(val) && val >= 1) {
          if (!cachedSiteConfigs[d]) cachedSiteConfigs[d] = {};
          cachedSiteConfigs[d].cooldown = val;

          chrome.runtime.sendMessage({
            type: 'UPDATE_SITE_CONFIG',
            domain: d,
            limit: currentLim,
            cooldown: val
          }, () => {
            cdInput.style.borderColor = '#10b981';
            setTimeout(() => { cdInput.style.borderColor = 'rgba(255,255,255,0.15)'; }, 800);
          });
        }
      };

      cdInput.addEventListener('input', handleCooldownChange);
      cdInput.addEventListener('change', handleCooldownChange);

      row.appendChild(left);
      row.appendChild(right);
      perSiteCooldownList.appendChild(row);
    });

    cooldownListRendered = true;
  }

  function loadPopupData() {
    chrome.runtime.sendMessage({ type: 'GET_POPUP_DATA' }, (data) => {
      if (!data) return;

      cachedSiteConfigs = data.siteConfigs || {};

      // 1. Connection status to desktop PC
      if (data.pcConnectionStatus === 'connected') {
        connStatus.textContent = '● Connected to PC';
        connStatus.className = 'conn-val online';
      } else {
        connStatus.textContent = '○ Standalone Mode';
        connStatus.className = 'conn-val offline';
      }

      // 2. Global settings inputs
      if (data.settings && !isEditingAnyInput) {
        if (data.settings.doomLimit) doomLimitInput.value = data.settings.doomLimit;
        if (data.settings.doomCooldown) doomCooldownInput.value = data.settings.doomCooldown;
      }

      // 3. Active Website Card
      currentDomain = data.activeDomain || '';
      const siteLimit = data.currentSiteLimit || 5;
      const siteCooldown = data.currentSiteCooldown || 30;
      const limitSec = siteLimit * 60;
      limitText.textContent = `Limit: ${siteLimit}m (Cooldown: ${siteCooldown}m)`;

      if (currentDomain) {
        activeDomain.textContent = currentDomain;

        // Load Favicon
        activeFavicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(currentDomain)}&sz=32`;
        activeFavicon.style.display = 'block';

        // Tag & Configuration Box
        if (data.isRestricted) {
          siteTag.textContent = 'RESTRICTED';
          siteTag.className = 'site-tag restricted';
          quickPassBox.style.display = 'flex';
          passAvailableText.textContent = `${data.passesLeft || 0} passes left`;

          if (data.activePassSec && data.activePassSec > 0) {
            btnQuickPass.textContent = `⚡ Active (${formatTimeShort(data.activePassSec)})`;
            btnQuickPass.style.background = '#10b981';
            btnQuickPass.style.color = '#090d16';
            btnQuickPass.style.cursor = 'default';
            btnQuickPass.disabled = true;
          } else if (data.passesLeft <= 0) {
            btnQuickPass.textContent = '❌ No Passes Left';
            btnQuickPass.style.background = 'rgba(244, 63, 94, 0.15)';
            btnQuickPass.style.color = '#f43f5e';
            btnQuickPass.style.cursor = 'not-allowed';
            btnQuickPass.disabled = true;
          } else {
            btnQuickPass.textContent = '⚡ 5m Emergency Pass';
            btnQuickPass.style.background = 'rgba(14, 165, 233, 0.15)';
            btnQuickPass.style.color = '#38bdf8';
            btnQuickPass.style.cursor = 'pointer';
            btnQuickPass.disabled = false;
          }
        } else {
          siteTag.textContent = 'SAFE';
          siteTag.className = 'site-tag safe';
          quickPassBox.style.display = 'none';
        }

        // Show per-site configuration controls for the active site
        if (siteConfigBox) {
          siteConfigBox.style.display = 'block';
          siteConfigDomain.textContent = currentDomain;
          if (!isEditingAnyInput) {
            if (siteLimitInput) siteLimitInput.value = siteLimit;
            if (siteCooldownInput) siteCooldownInput.value = siteCooldown;
          }
        }

        // Usage Time & Progress Bar
        const usedSec = data.todayUsageSec || 0;
        usageTime.textContent = formatTimeDetailed(usedSec);

        const pct = Math.min(100, Math.round((usedSec / limitSec) * 100));
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}% of session limit`;

        if (pct >= 85) {
          progressBar.className = 'progress-bar-fill warning';
        } else {
          progressBar.className = 'progress-bar-fill';
        }
      } else {
        activeDomain.textContent = 'No Webpage Active';
        activeFavicon.style.display = 'none';
        siteTag.textContent = 'IDLE';
        siteTag.className = 'site-tag safe';
        usageTime.textContent = '0m 00s';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0% of limit';
        quickPassBox.style.display = 'none';
        if (siteConfigBox) siteConfigBox.style.display = 'none';
      }

      // 4. StayFree Top Tracked Sites Today
      if (data.topSites && data.topSites.length > 0) {
        topSitesList.innerHTML = '';
        data.topSites.forEach(site => {
          const row = document.createElement('div');
          row.className = 'site-row';

          const left = document.createElement('div');
          left.className = 'site-row-left';

          const icon = document.createElement('img');
          icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(site.domain)}&sz=16`;
          icon.onerror = () => { icon.style.display = 'none'; };

          const name = document.createElement('span');
          name.className = 'site-row-domain';
          name.textContent = site.domain;
          if (site.isRestricted) {
            name.style.color = '#f43f5e';
          }

          left.appendChild(icon);
          left.appendChild(name);

          const time = document.createElement('span');
          time.className = 'site-row-time';
          time.textContent = formatTimeShort(site.seconds);

          row.appendChild(left);
          row.appendChild(time);
          topSitesList.appendChild(row);
        });
      } else {
        topSitesList.innerHTML = '<div class="empty-state">No browsing time recorded yet today.</div>';
      }

      // 5. Render Per-Site Cooldowns list (updates dynamically if list changed, without disrupting typing)
      const currentSitesKey = (data.restrictedSites || []).join(',');
      if (data.restrictedSites && (!cooldownListRendered || (!isEditingAnyInput && currentSitesKey !== lastRenderedSitesKey))) {
        renderPerSiteCooldowns(
          data.restrictedSites,
          data.settings ? data.settings.doomCooldown : 30,
          data.settings ? data.settings.doomLimit : 5
        );
        lastRenderedSitesKey = currentSitesKey;
        cooldownListRendered = true;
      }
    });
  }

  // Initial load and instant PC sync request
  chrome.runtime.sendMessage({ type: 'POLL_PC_STATE' }).catch(() => {});
  loadPopupData();

  // Refresh interval (does NOT overwrite inputs while typing)
  const refreshInterval = setInterval(() => {
    loadPopupData();
  }, 1000);
  window.addEventListener('unload', () => clearInterval(refreshInterval));

  // Quick Pass Button
  btnQuickPass.addEventListener('click', () => {
    if (!currentDomain) return;
    btnQuickPass.textContent = 'Granting...';
    btnQuickPass.disabled = true;

    chrome.runtime.sendMessage({ type: 'GRANT_PASS_LOCAL', domain: currentDomain, minutes: 5 }, (res) => {
      if (res && res.success) {
        btnQuickPass.textContent = '⚡ Pass Active (5m)';
        btnQuickPass.style.background = '#10b981';
        btnQuickPass.style.color = '#090d16';
        setTimeout(() => {
          loadPopupData();
        }, 1000);
      } else {
        alert(res?.reason || 'Failed to grant pass. Limit reached.');
        btnQuickPass.textContent = '⚡ 5m Emergency Pass';
        btnQuickPass.disabled = false;
      }
    });
  });

  // Save Settings for Current Site (Card Button)
  if (btnSaveSiteConfig) {
    btnSaveSiteConfig.addEventListener('click', () => {
      if (!currentDomain) return;
      const cooldown = parseInt(siteCooldownInput.value, 10) || 30;
      const currentLim = (cachedSiteConfigs[currentDomain] && cachedSiteConfigs[currentDomain].limit) || 5;

      btnSaveSiteConfig.disabled = true;
      btnSaveSiteConfig.textContent = 'SAVING...';

      chrome.runtime.sendMessage({
        type: 'UPDATE_SITE_CONFIG',
        domain: currentDomain,
        limit: currentLim,
        cooldown: cooldown
      }, () => {
        btnSaveSiteConfig.textContent = 'COOLDOWN SAVED!';
        btnSaveSiteConfig.style.background = '#10b981';

        // Update the quick list input as well if visible
        const matchInput = perSiteCooldownList ? perSiteCooldownList.querySelector(`input[data-domain="${currentDomain}"]`) : null;
        if (matchInput) {
          matchInput.value = cooldown;
        }

        setTimeout(() => {
          btnSaveSiteConfig.textContent = 'SAVE COOLDOWN';
          btnSaveSiteConfig.style.background = '#38bdf8';
          btnSaveSiteConfig.disabled = false;
          loadPopupData();
        }, 1500);
      });
    });
  }

  // Save Global Fallback Settings
  btnSaveSettings.addEventListener('click', () => {
    const limit = parseInt(doomLimitInput.value, 10) || 5;
    const cooldown = parseInt(doomCooldownInput.value, 10) || 30;

    btnSaveSettings.disabled = true;
    btnSaveSettings.textContent = 'SAVING...';

    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      doomLimit: limit,
      doomCooldown: cooldown
    }, () => {
      btnSaveSettings.textContent = 'SAVED & SYNCED!';
      btnSaveSettings.style.background = '#10b981';
      btnSaveSettings.style.color = '#090d16';

      setTimeout(() => {
        btnSaveSettings.textContent = 'SAVE & SYNC SETTINGS';
        btnSaveSettings.style.background = '#0ea5e9';
        btnSaveSettings.style.color = '#090d16';
        btnSaveSettings.disabled = false;
      }, 1800);
    });
  });
});
