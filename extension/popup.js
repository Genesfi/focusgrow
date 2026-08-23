document.addEventListener('DOMContentLoaded', async () => {
  const connStatus = document.getElementById('conn-status');
  const activeDomain = document.getElementById('active-domain');
  const doomLimitInput = document.getElementById('doom-limit');
  const doomCooldownInput = document.getElementById('doom-cooldown');
  const btnSave = document.getElementById('btn-save-settings');

  // Load existing settings
  chrome.storage.local.get(['doomLimit', 'doomCooldown'], (res) => {
    if (res.doomLimit) doomLimitInput.value = res.doomLimit;
    if (res.doomCooldown) doomCooldownInput.value = res.doomCooldown;
  });

  // Check current status
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      try {
        const u = new URL(tab.url);
        activeDomain.textContent = u.hostname.replace(/^www\./, '');
      } catch (e) {
        activeDomain.textContent = '-';
      }
    }

    const res = await fetch('http://127.0.0.1:8766/tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true })
    });

    if (res.ok) {
      connStatus.textContent = 'Active (Local)';
      connStatus.className = 'val val-connected';
    } else {
      connStatus.textContent = 'Not Running';
      connStatus.className = 'val val-disconnected';
    }
  } catch (err) {
    connStatus.textContent = 'Not Running';
    connStatus.className = 'val val-disconnected';
  }

  // Save settings
  btnSave.addEventListener('click', () => {
    const limit = parseInt(doomLimitInput.value);
    const cooldown = parseInt(doomCooldownInput.value);

    chrome.storage.local.set({
      doomLimit: limit,
      doomCooldown: cooldown
    }, () => {
      btnSave.textContent = 'SAVED & SYNCED!';
      btnSave.style.background = '#10b981';
      setTimeout(() => {
        btnSave.textContent = 'SAVE & SYNC TO CLOUD';
        btnSave.style.background = '#38bdf8';
      }, 2000);

      // Notify background to update cloud immediately
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    });
  });
});
