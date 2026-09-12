// FocusGrow Tab & URL Sync Extension - StayFree-Grade Service Worker (MV3)

const FIREBASE_URL = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/.json";
const PC_APP_URL = "http://127.0.0.1:8766";

// Default restricted sites
const DEFAULT_RESTRICTED = ['facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'reddit.com'];
const DOOMSCROLL_EXCEPTIONS = ['music.youtube.com'];

// Core runtime state
let settings = {
  doomLimit: 5,       // in minutes
  doomCooldown: 30,   // in minutes
  protectionEnabled: true
};

let restrictedSites = [...DEFAULT_RESTRICTED];
let siteConfigs = {};      // { [domain]: { limit: number, cooldown: number } }
let localPasses = {};      // { [domain]: { remainingSec, usedCount, isOwner, grantTimestamp } }
let cloudPasses = {};      // from Firebase
let doomTracker = {};      // { [domain]: { totalSecThisSession, cooldownStart, isPassActive } }
let dailyUsage = {};       // { [domain]: totalSecondsSpentToday }
let todayDate = getTodayString();
const MAX_EMERGENCY_PASSES = 2; // Strict limit: 2 Emergency Passes per session/day

function getSiteCooldown(domain) {
  if (!domain) return settings.doomCooldown;
  const pattern = getMatchedRestrictedPattern(domain) || domain;
  if (siteConfigs[pattern] && typeof siteConfigs[pattern].cooldown === 'number') {
    return siteConfigs[pattern].cooldown;
  }
  return settings.doomCooldown || 30;
}

function getSiteLimit(domain) {
  if (!domain) return settings.doomLimit;
  const pattern = getMatchedRestrictedPattern(domain) || domain;
  if (siteConfigs[pattern] && typeof siteConfigs[pattern].limit === 'number') {
    return siteConfigs[pattern].limit;
  }
  return settings.doomLimit || 5;
}

// Active tracking context
let currentActiveTab = null;
let isUserIdle = false;
let isWindowFocused = true;
let pcConnectionStatus = 'disconnected'; // 'connected' | 'disconnected'
let lastPcSyncTimestamp = 0;
let lastFirebaseSyncTimestamp = 0;
let storageDirty = false;

// Helpers
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

function matchesDomain(domain, pattern) {
  if (!domain || !pattern) return false;
  domain = domain.toLowerCase();
  pattern = pattern.toLowerCase();
  // YouTube Music exemption: music.youtube.com is an audio productivity app, NEVER treat as youtube.com
  if ((domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com')) && pattern === 'youtube.com') {
    return false;
  }
  return domain === pattern || domain.endsWith('.' + pattern);
}

function isDomainRestricted(domain) {
  if (!domain) return false;
  domain = domain.toLowerCase();
  if (domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com')) return false;
  const isExempt = DOOMSCROLL_EXCEPTIONS.some(e => matchesDomain(domain, e));
  if (isExempt) return false;
  return restrictedSites.some(d => matchesDomain(domain, d));
}

function getMatchedRestrictedPattern(domain) {
  if (!domain) return null;
  domain = domain.toLowerCase();
  if (domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com')) return null;
  if (DOOMSCROLL_EXCEPTIONS.some(e => matchesDomain(domain, e))) return null;
  return restrictedSites.find(d => matchesDomain(domain, d)) || null;
}

// Ensure daily usage resets at midnight
function checkDailyReset() {
  const currentToday = getTodayString();
  if (todayDate !== currentToday) {
    todayDate = currentToday;
    dailyUsage = {};
    doomTracker = {};
    chrome.storage.local.set({ todayDate, dailyUsage, doomTracker });
  }
}

// Initialize state from storage
chrome.storage.local.get([
  'doomLimit',
  'doomCooldown',
  'protectionEnabled',
  'restrictedSites',
  'siteConfigs',
  'localPasses',
  'cloudPasses',
  'doomTracker',
  'dailyUsage',
  'todayDate'
], (res) => {
  if (typeof res.doomLimit === 'number') settings.doomLimit = res.doomLimit;
  if (typeof res.doomCooldown === 'number') settings.doomCooldown = res.doomCooldown;
  if (typeof res.protectionEnabled === 'boolean') settings.protectionEnabled = res.protectionEnabled;
  if (Array.isArray(res.restrictedSites) && res.restrictedSites.length > 0) restrictedSites = res.restrictedSites;
  if (res.siteConfigs) siteConfigs = res.siteConfigs;
  if (res.localPasses) localPasses = res.localPasses;
  if (res.cloudPasses) cloudPasses = res.cloudPasses;
  if (res.doomTracker) doomTracker = res.doomTracker;

  const currentToday = getTodayString();
  if (res.todayDate === currentToday && res.dailyUsage) {
    dailyUsage = res.dailyUsage;
    todayDate = currentToday;
  } else {
    todayDate = currentToday;
    dailyUsage = {};
    chrome.storage.local.set({ todayDate, dailyUsage });
  }

  // Refresh active tab state immediately upon start
  updateActiveTabContext();
});

// Periodic save to local storage (throttled to save disk I/O)
function scheduleStorageSave() {
  storageDirty = true;
}

setInterval(() => {
  if (storageDirty) {
    storageDirty = false;
    chrome.storage.local.set({
      dailyUsage,
      doomTracker,
      localPasses,
      siteConfigs,
      todayDate
    });
  }
}, 3000);

// ==========================================
// MV3 Event-Driven Instant Tab Detection
// ==========================================

async function updateActiveTabContext(preferredTabId = null) {
  checkDailyReset();

  try {
    let tab = null;
    if (preferredTabId) {
      try {
        tab = await chrome.tabs.get(preferredTabId);
      } catch (e) {}
    }

    if (!tab) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        tab = tabs[0];
      } else {
        const fallbackTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (fallbackTabs && fallbackTabs.length > 0) tab = fallbackTabs[0];
      }
    }

    if (!tab) {
      currentActiveTab = null;
      return;
    }

    const domain = extractDomain(tab.url);

    // If current tab is internal extension page or system page, handle special logic
    if (tab.url && tab.url.includes(chrome.runtime.id) && tab.url.includes('blocked.html')) {
      handleBlockedPageTab(tab);
      return;
    }

    if (!domain) {
      currentActiveTab = null;
      return;
    }

    currentActiveTab = {
      id: tab.id,
      url: tab.url,
      domain: domain,
      title: tab.title || '',
      windowId: tab.windowId
    };

    // Check YouTube Music exception
    const isYtm = domain === 'music.youtube.com' || (tab.title && tab.title.toLowerCase().includes('youtube music'));
    if (isYtm) {
      updateFloatingTimer(tab.id, false, 0, "");
      syncWithPcApp(tab, false);
      return;
    }

    // Process website enforcement
    enforceTabPolicy(tab, domain);

  } catch (e) {
    // Ignore query errors during tab transition
  }
}

// Handle unblock check if user is on blocked.html
async function handleBlockedPageTab(tab) {
  try {
    const urlObj = new URL(tab.url);
    const targetDomain = urlObj.searchParams.get('domain');
    const originalUrl = urlObj.searchParams.get('target');

    if (!targetDomain || !originalUrl) return;

    // Check if domain now has an active pass
    const activeLocal = Object.keys(localPasses).find(d => matchesDomain(targetDomain, d) && localPasses[d].remainingSec > 0);
    if (activeLocal) {
      chrome.tabs.update(tab.id, { url: originalUrl });
      return;
    }

    const activeCloud = Object.keys(cloudPasses).find(d => {
      const cleanD = d.replace(/_/g, '.');
      return matchesDomain(targetDomain, cleanD) && cloudPasses[d].remainingSec > 0;
    });
    if (activeCloud) {
      chrome.tabs.update(tab.id, { url: originalUrl });
      return;
    }
  } catch (e) {}
}

// Core enforcement: Check restriction, active pass, or block
async function enforceTabPolicy(tab, domain) {
  if (domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com') || (tab && tab.url && tab.url.toLowerCase().includes('music.youtube.com'))) {
    syncWithPcApp(tab, false);
    return;
  }

  if (!settings.protectionEnabled) {
    updateFloatingTimer(tab.id, false, 0, "");
    syncWithPcApp(tab, false);
    return;
  }

  const matchedPattern = getMatchedRestrictedPattern(domain);

  // 1. Check if an Emergency Pass is active for this domain (HIGHEST PRIORITY)
  const activeLocalKey = Object.keys(localPasses).find(d => matchesDomain(domain, d) && localPasses[d].remainingSec > 0);
  const activeCloudKey = Object.keys(cloudPasses).find(d => {
    const cleanD = d.replace(/_/g, '.');
    return matchesDomain(domain, cleanD) && cloudPasses[d].remainingSec > 0;
  });

  if (activeLocalKey || activeCloudKey) {
    const passObj = activeLocalKey ? localPasses[activeLocalKey] : cloudPasses[activeCloudKey];
    const now = Date.now();
    let sec = passObj.targetEndTime > 0 ? Math.max(0, Math.ceil((passObj.targetEndTime - now) / 1000)) : passObj.remainingSec;

    if (sec > 0) {
      // While Emergency Pass is running, disable doomTracker competition
      const matched = getMatchedRestrictedPattern(domain);
      if (matched && doomTracker[matched]) {
        doomTracker[matched].isPassActive = false;
        doomTracker[matched].cooldownStart = 0;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'HIDE_BLOCK_MODAL' }).catch(() => {});
      updateFloatingTimer(tab.id, true, sec, "PASS", passObj.targetEndTime || (now + sec * 1000));
      syncWithPcApp(tab, false);
      return;
    } else {
      passObj.remainingSec = 0;
      passObj.targetEndTime = 0;
    }
  }

  // 2. If it's a restricted site and NO active pass
  if (matchedPattern) {
    const trackerKey = matchedPattern;
    if (!doomTracker[trackerKey]) {
      doomTracker[trackerKey] = { cooldownStart: 0, isPassActive: false, sessionEndTime: 0 };
    }

    const info = doomTracker[trackerKey];

    // Cooldown check using per-site cooldown duration
    if (info.cooldownStart > 0) {
      const elapsedMins = (Date.now() - info.cooldownStart) / (1000 * 60);
      const siteCooldown = getSiteCooldown(trackerKey);
      if (elapsedMins < siteCooldown) {
        // Active cooldown: HIDE floating timer and SHOW cooldown modal
        updateFloatingTimer(tab.id, false, 0, "");
        blockTab(tab, trackerKey, "doomscroll", info.cooldownStart);
        return;
      } else {
        // Cooldown expired
        info.cooldownStart = 0;
        info.isPassActive = false;
        info.sessionEndTime = 0;
        scheduleStorageSave();
      }
    }

    // Real-Time Wall-Clock Session Limit Mode (Only when session is active and not on cooldown)
    if (info.isPassActive && info.sessionEndTime > 0) {
      const sec = Math.max(0, Math.ceil((info.sessionEndTime - Date.now()) / 1000));
      if (sec > 0) {
        chrome.tabs.sendMessage(tab.id, { type: 'HIDE_BLOCK_MODAL' }).catch(() => {});
        updateFloatingTimer(tab.id, true, sec, "LIMIT", info.sessionEndTime);
        syncWithPcApp(tab, false);
        return;
      } else {
        // Real-time limit expired!
        info.isPassActive = false;
        info.sessionEndTime = 0;
        info.cooldownStart = Date.now();
        scheduleStorageSave();
      }
    }

    // Not active or limit exhausted: HIDE floating timer and block immediately
    updateFloatingTimer(tab.id, false, 0, "");
    blockTab(tab, trackerKey, "doomscroll", info.cooldownStart);
    return;
  } else {
    chrome.tabs.sendMessage(tab.id, { type: 'HIDE_BLOCK_MODAL' }).catch(() => {});
    updateFloatingTimer(tab.id, false, 0, "");
  }

  // Sync to PC
  syncWithPcApp(tab, false);
}

// Show In-Page StayFree Modal Overlay instead of redirecting URL
function blockTab(tab, domain, reason, cooldownStart = 0) {
  if (!tab || !tab.id || !tab.url) return;
  if (domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com')) return;
  if (tab.url && tab.url.toLowerCase().includes('music.youtube.com')) return;
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.includes(chrome.runtime.id)) return;

  const usageSec = dailyUsage[domain] || 0;
  const siteLimit = getSiteLimit(domain);
  const siteCooldown = getSiteCooldown(domain);
  const limitSec = siteLimit * 60;
  const passesLeft = (domain && localPasses[domain]) ? Math.max(0, MAX_EMERGENCY_PASSES - localPasses[domain].usedCount) : MAX_EMERGENCY_PASSES;

  let actualCooldownStart = cooldownStart;

  // Check if cooldown has finished using per-site cooldown duration
  if (actualCooldownStart > 0) {
    const elapsedMins = (Date.now() - actualCooldownStart) / (1000 * 60);
    if (elapsedMins >= siteCooldown) {
      if (localPasses[domain]) localPasses[domain].usedCount = 0;
      if (doomTracker[domain]) {
        doomTracker[domain].cooldownStart = 0;
        doomTracker[domain].totalSecThisSession = 0;
      }
      actualCooldownStart = 0;
      scheduleStorageSave();
    }
  }

  const isCooldownMode = (actualCooldownStart > 0);

  const modalPayload = {
    type: 'SHOW_BLOCK_MODAL',
    domain: domain,
    reason: reason,
    usageSec: usageSec,
    limitSec: limitSec,
    cooldownStart: actualCooldownStart,
    cooldownMins: siteCooldown,
    passesLeft: passesLeft,
    isCooldown: isCooldownMode
  };

  chrome.tabs.sendMessage(tab.id, modalPayload).catch((err) => {
    if (err && err.message && err.message.includes('context invalidated')) return;
    if (tab.url && tab.url.toLowerCase().includes('music.youtube.com')) return;
    // If content script isn't loaded yet, inject it and then dispatch modal
    if (chrome.scripting && chrome.scripting.executeScript) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).then(() => {
        chrome.tabs.sendMessage(tab.id, modalPayload).catch(() => {});
      }).catch(() => {});
    }
  });
}

// Send updates to in-page floating timer widget
const lastScriptInjectionMap = {};
function updateFloatingTimer(tabId, active, remaining, label, targetEndTime = 0) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, {
    type: 'PASS_STATUS_UPDATE',
    isPassActive: active,
    remainingSec: remaining,
    label: label,
    targetEndTime: targetEndTime || (active ? (Date.now() + remaining * 1000) : 0)
  }).catch(() => {
    // If floating timer is deactivated, do NOT inject content script!
    if (!active) return;

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab || !tab.url) return;
      const url = tab.url.toLowerCase();
      if (url.includes('music.youtube.com') || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return;

      // If content script isn't injected yet, inject safely (throttled to avoid injection storms)
      const now = Date.now();
      if (!lastScriptInjectionMap[tabId] || (now - lastScriptInjectionMap[tabId] > 10000)) {
        lastScriptInjectionMap[tabId] = now;
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).catch(() => {});
        }
      }
    });
  });
}

// ==========================================
// Real-time Event Listeners (StayFree Architecture)
// ==========================================

// 1. Instant tab switch
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateActiveTabContext(activeInfo.tabId);
});

// 2. Tab URL change or reload
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab.active) {
      updateActiveTabContext(tabId);
    }
  }
});

// 3. SPA (Single Page Application) Navigation Listener (YouTube, X, TikTok, Instagram)
if (chrome.webNavigation && chrome.webNavigation.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
      chrome.tabs.get(details.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;
        if (tab.active) {
          updateActiveTabContext(details.tabId);
        }
      });
    }
  });
}

// 4. Window focus change (stop tracking if user switches to another desktop app)
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
  } else {
    isWindowFocused = true;
    updateActiveTabContext();
  }
});

// 5. Idle state detection (stop tracking if user leaves PC)
if (chrome.idle) {
  chrome.idle.setDetectionInterval(60); // 60 seconds of inactivity = idle
  chrome.idle.onStateChanged.addListener((newState) => {
    isUserIdle = (newState === 'idle' || newState === 'locked');
  });
}

// ==========================================
// 1-Second Timer Tick (Time Tracking & Passes)
// ==========================================

function handleSecondTick() {
  checkDailyReset();

  const now = Date.now();

  // 1. Tick local passes down in real-time wall-clock
  let localPassesChanged = false;
  for (let d in localPasses) {
    if (localPasses[d].remainingSec > 0 || (localPasses[d].targetEndTime && localPasses[d].targetEndTime > 0)) {
      let rem = 0;
      if (localPasses[d].targetEndTime > 0) {
        rem = Math.max(0, Math.ceil((localPasses[d].targetEndTime - now) / 1000));
      } else {
        rem = Math.max(0, localPasses[d].remainingSec - 1);
      }
      localPasses[d].remainingSec = rem;
      localPassesChanged = true;

      // Pass expired right now!
      if (rem === 0) {
        localPasses[d].targetEndTime = 0;
        if (!doomTracker[d]) doomTracker[d] = { cooldownStart: 0, isPassActive: false, sessionEndTime: 0 };
        doomTracker[d].cooldownStart = now;
        doomTracker[d].isPassActive = false;
        doomTracker[d].sessionEndTime = 0;

        if (currentActiveTab && matchesDomain(currentActiveTab.domain, d)) {
          updateFloatingTimer(currentActiveTab.id, false, 0, "");
          chrome.tabs.get(currentActiveTab.id, (tab) => {
            if (!chrome.runtime.lastError && tab) {
              blockTab(tab, d, "focus", doomTracker[d].cooldownStart);
            }
          });
        }
      }
    }
  }
  if (localPassesChanged) scheduleStorageSave();

  // 2. Real-Time Session Limits in doomTracker (Wall-clock, podcast/video safe)
  let doomChanged = false;
  for (let pattern in doomTracker) {
    const tracker = doomTracker[pattern];
    if (tracker && tracker.isPassActive && tracker.sessionEndTime > 0) {
      const rem = Math.max(0, Math.ceil((tracker.sessionEndTime - now) / 1000));
      if (rem <= 0) {
        // Real-time session limit reached! Trigger cooldown
        tracker.isPassActive = false;
        tracker.sessionEndTime = 0;
        tracker.cooldownStart = now;
        doomChanged = true;

        if (currentActiveTab && matchesDomain(currentActiveTab.domain, pattern)) {
          updateFloatingTimer(currentActiveTab.id, false, 0, "");
          chrome.tabs.get(currentActiveTab.id, (tab) => {
            if (!chrome.runtime.lastError && tab) {
              blockTab(tab, pattern, "doomscroll", tracker.cooldownStart);
            }
          });
        }
      }
    }
  }
  if (doomChanged) scheduleStorageSave();

  // 3. Track daily cumulative usage only when active & focused
  if (!isUserIdle && isWindowFocused && currentActiveTab && currentActiveTab.domain) {
    const domain = currentActiveTab.domain;
    if (domain !== 'music.youtube.com' && !domain.endsWith('.music.youtube.com')) {
      dailyUsage[domain] = (dailyUsage[domain] || 0) + 1;
      scheduleStorageSave();
    }
  }

  // 4. Broadcast floating timer updates to currently active tab (Real-Time Wall Clock)
  if (currentActiveTab && currentActiveTab.domain) {
    const domain = currentActiveTab.domain;
    if (domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com')) return;

    const activeLocalKey = Object.keys(localPasses).find(d => matchesDomain(domain, d) && localPasses[d].remainingSec > 0);
    const doomPassKey = Object.keys(doomTracker).find(d => matchesDomain(domain, d) && doomTracker[d].isPassActive);

    if (activeLocalKey) {
      const pass = localPasses[activeLocalKey];
      const rem = pass.targetEndTime > 0 ? Math.max(0, Math.ceil((pass.targetEndTime - now) / 1000)) : pass.remainingSec;
      updateFloatingTimer(currentActiveTab.id, true, rem, "PASS", pass.targetEndTime || (now + rem * 1000));
    } else if (doomPassKey) {
      const tracker = doomTracker[doomPassKey];
      const siteCooldown = getSiteCooldown(domain);
      const isCooldown = tracker.cooldownStart > 0 && ((now - tracker.cooldownStart) / 60000 < siteCooldown);
      if (isCooldown) {
        updateFloatingTimer(currentActiveTab.id, false, 0, "");
      } else if (tracker.sessionEndTime > 0) {
        const rem = Math.max(0, Math.ceil((tracker.sessionEndTime - now) / 1000));
        if (rem > 0) {
          updateFloatingTimer(currentActiveTab.id, true, rem, "LIMIT", tracker.sessionEndTime);
        } else {
          updateFloatingTimer(currentActiveTab.id, false, 0, "");
        }
      }
    } else {
      updateFloatingTimer(currentActiveTab.id, false, 0, "");
    }
  }
}

// MV3 Resilient Alarm + Safe Interval Tick
setInterval(handleSecondTick, 1000);

// Use alarms to ensure worker wakes up if suspended
if (chrome.alarms) {
  chrome.alarms.create('fg_heartbeat', { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fg_heartbeat') {
      updateActiveTabContext();
      syncToFirebase();
    }
  });
}

// ==========================================
// PC App & Firebase Sync
// ==========================================

function syncRestrictedSitesFromPc(newSites) {
  if (!Array.isArray(newSites)) return;
  const cleanNewSites = newSites.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  const currentKey = [...restrictedSites].sort().join(',');
  const newKey = [...cleanNewSites].sort().join(',');
  if (currentKey !== newKey) {
    restrictedSites = cleanNewSites;
    chrome.storage.local.set({ restrictedSites });
    updateActiveTabContext();
  }
}

async function syncWithPcApp(tab, force = false) {
  if (!tab || !tab.url) return;
  const now = Date.now();
  if (!force && now - lastPcSyncTimestamp < 3000) return; // Debounce 3s
  lastPcSyncTimestamp = now;

  const domain = extractDomain(tab.url);

  // Check if this domain has an active emergency pass or active session limit
  const activeLocalKey = Object.keys(localPasses).find(d => matchesDomain(domain, d) && localPasses[d].remainingSec > 0);
  const activeCloudKey = Object.keys(cloudPasses).find(d => {
    const cleanD = d.replace(/_/g, '.');
    return matchesDomain(domain, cleanD) && cloudPasses[d].remainingSec > 0;
  });
  const matchedP = getMatchedRestrictedPattern(domain);
  const isSessionLimitActive = !!(matchedP && doomTracker[matchedP] && doomTracker[matchedP].isPassActive);
  const isPassActiveLocally = !!(activeLocalKey || activeCloudKey || isSessionLimitActive);

  const payload = {
    url: tab.url,
    domain: domain,
    title: tab.title || '',
    tabId: tab.id,
    timestamp: now
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${PC_APP_URL}/tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      pcConnectionStatus = 'connected';
      const data = await res.json();

      // Automatically synchronize restricted sites list from Windows app
      if (Array.isArray(data.restrictedSites)) {
        syncRestrictedSitesFromPc(data.restrictedSites);
      }

      if (data.status === 'blocked') {
        // ONLY block if local pass is NOT active!
        if (!isPassActiveLocally) {
          blockTab(tab, domain, "focus");
        }
      } else if (data.status === 'pass_active' && data.remainingSec > 0) {
        const targetDomain = data.activeDomain || domain;
        if (matchesDomain(domain, targetDomain)) {
          if (!localPasses[targetDomain]) localPasses[targetDomain] = { usedCount: 1, isOwner: false };
          if (!localPasses[targetDomain].isOwner || !localPasses[targetDomain].remainingSec) {
            localPasses[targetDomain].remainingSec = data.remainingSec;
          }

          // Turn OFF doomTracker session and cooldown so there is NO competing LIMIT timer!
          const matched = getMatchedRestrictedPattern(domain);
          if (matched && doomTracker[matched]) {
            doomTracker[matched].isPassActive = false;
            doomTracker[matched].cooldownStart = 0;
          }
        }
      }
    } else {
      pcConnectionStatus = 'disconnected';
    }
  } catch (e) {
    pcConnectionStatus = 'disconnected';
  }
}

async function syncToFirebase() {
  const now = Date.now();
  if (now - lastFirebaseSyncTimestamp < 8000) return; // Prevent quota burning (8s min interval)
  lastFirebaseSyncTimestamp = now;

  try {
    const res = await fetch(FIREBASE_URL);
    if (res.ok) {
      const cloudData = await res.json();

      if (cloudData && cloudData.activePasses) {
        cloudPasses = cloudData.activePasses;
        chrome.storage.local.set({ cloudPasses });

        for (let k in cloudPasses) {
          const pass = cloudPasses[k];
          if (!pass) continue;
          const domain = pass.domain;
          const cloudSec = pass.remainingSec;
          const cloudGrantTime = pass.lastGrantTime || 0;

          // Reject expired or stale passes older than 2 hours
          if (!cloudSec || cloudSec <= 0 || (Date.now() - cloudGrantTime > 7200 * 1000)) {
            if (localPasses[domain] && !localPasses[domain].isOwner) {
              localPasses[domain].remainingSec = 0;
            }
            continue;
          }

          if (!localPasses[domain]) {
            localPasses[domain] = {
              remainingSec: cloudSec,
              usedCount: 1,
              isOwner: false,
              grantTimestamp: cloudGrantTime
            };
          } else if (!localPasses[domain].isOwner && cloudGrantTime > (localPasses[domain].grantTimestamp || 0)) {
            localPasses[domain].remainingSec = cloudSec;
            localPasses[domain].grantTimestamp = cloudGrantTime;
          }
        }
        scheduleStorageSave();
      }
    }

    // Check PC App status
    let pcState = { state: "idle" };
    try {
      const resPC = await fetch(`${PC_APP_URL}/state`);
      if (resPC.ok) {
        pcState = await resPC.json();
        pcConnectionStatus = 'connected';
        if (Array.isArray(pcState.restrictedSites)) {
          syncRestrictedSitesFromPc(pcState.restrictedSites);
        }
      }
    } catch (e) {
      pcConnectionStatus = 'disconnected';
    }

    const activePassesMap = {};
    for (let d in localPasses) {
      const key = d.replace(/\./g, '_');
      if (localPasses[d].remainingSec > 0 && localPasses[d].isOwner) {
        activePassesMap[key] = {
          domain: d,
          remainingSec: localPasses[d].remainingSec,
          passesLeft: Math.max(0, MAX_EMERGENCY_PASSES - localPasses[d].usedCount),
          lastGrantTime: localPasses[d].grantTimestamp || 0
        };
      } else if (localPasses[d].remainingSec <= 0) {
        // Crucial: send null so Firebase RTDB deletes the expired pass!
        activePassesMap[key] = null;
      }
    }

    const safeDoomTracker = {};
    for (let d in doomTracker) safeDoomTracker[d.replace(/\./g, '_')] = doomTracker[d];

    const globalState = {
      state: pcState.state || "idle",
      formattedTime: pcState.formattedTime || "00:00",
      remainingSec: pcState.remainingSec || 0,
      activeDomain: pcState.activeDomain || "",
      activePasses: activePassesMap,
      settings: {
        doomLimit: settings.doomLimit,
        doomCooldown: settings.doomCooldown,
        protectionEnabled: settings.protectionEnabled
      },
      doomTracker: safeDoomTracker,
      lastUpdate: Date.now()
    };

    await fetch(FIREBASE_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(globalState)
    });
  } catch (err) {}
}

setInterval(syncToFirebase, 10000);

// ==========================================
// Runtime Messages (Popup & Blocked Page API)
// ==========================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_POPUP_DATA') {
    // Return rich StayFree statistics
    const domain = currentActiveTab ? currentActiveTab.domain : '';
    const isRestricted = isDomainRestricted(domain);
    const domainUsage = domain ? (dailyUsage[domain] || 0) : 0;
    const sessionTracker = (domain && doomTracker[domain]) ? doomTracker[domain] : null;

    // Format top visited sites today
    const topSites = Object.keys(dailyUsage)
      .map(d => ({ domain: d, seconds: dailyUsage[d], isRestricted: isDomainRestricted(d) }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);

    const activeLocalPass = Object.keys(localPasses).find(d => matchesDomain(domain, d) && localPasses[d].remainingSec > 0);
    const activePassSec = activeLocalPass ? localPasses[activeLocalPass].remainingSec : 0;

    sendResponse({
      activeDomain: domain,
      activeTitle: currentActiveTab ? currentActiveTab.title : '',
      isRestricted: isRestricted,
      todayUsageSec: domainUsage,
      sessionTracker: sessionTracker,
      settings: settings,
      siteConfigs: siteConfigs,
      currentSiteLimit: getSiteLimit(domain),
      currentSiteCooldown: getSiteCooldown(domain),
      activePassSec: activePassSec,
      restrictedSites: restrictedSites,
      topSites: topSites,
      pcConnectionStatus: pcConnectionStatus,
      passesLeft: (domain && localPasses[domain]) ? Math.max(0, MAX_EMERGENCY_PASSES - localPasses[domain].usedCount) : MAX_EMERGENCY_PASSES
    });
    return true;
  }

  if (msg.type === 'START_SESSION_LIMIT') {
    const { domain, minutes } = msg;
    if (!domain) {
      sendResponse({ success: false, reason: "Invalid domain" });
      return true;
    }

    const pattern = getMatchedRestrictedPattern(domain) || domain;

    // 1. Update siteConfigs limit
    if (!siteConfigs[pattern]) siteConfigs[pattern] = {};
    siteConfigs[pattern].limit = minutes;

    // 2. Start session limit in doomTracker (does NOT consume emergency passes!)
    const now = Date.now();
    const targetEndTime = now + (minutes * 60 * 1000);
    if (!doomTracker[pattern]) doomTracker[pattern] = { cooldownStart: 0, isPassActive: false, sessionEndTime: 0 };
    doomTracker[pattern].isPassActive = true;
    doomTracker[pattern].cooldownStart = 0;
    doomTracker[pattern].sessionLimitSec = minutes * 60;
    doomTracker[pattern].sessionEndTime = targetEndTime;

    // Clear any active emergency pass so session limit cleanly takes control
    if (localPasses[pattern]) { localPasses[pattern].remainingSec = 0; localPasses[pattern].targetEndTime = 0; }
    if (localPasses[domain]) { localPasses[domain].remainingSec = 0; localPasses[domain].targetEndTime = 0; }

    scheduleStorageSave();
    updateActiveTabContext();

    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'HIDE_BLOCK_MODAL' }).catch(() => {});
      updateFloatingTimer(sender.tab.id, true, minutes * 60, "LIMIT", targetEndTime);
    }

    sendResponse({ success: true, limitSec: minutes * 60, targetEndTime: targetEndTime });
    return true;
  }

  if (msg.type === 'GRANT_PASS_LOCAL') {
    const { domain, minutes } = msg;
    if (!domain) {
      sendResponse({ success: false, reason: "Invalid domain" });
      return true;
    }

    // 1. Immediately inform PC Desktop App so C++ marks it as pass_active
    fetch(`${PC_APP_URL}/tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantPass: true, domain: domain, minutes: minutes })
    }).catch(() => {});

    if (!localPasses[domain]) localPasses[domain] = { remainingSec: 0, usedCount: 0 };

    // Auto-reset pass count if previous pass was granted more than 1 hour ago
    const lastGrant = localPasses[domain].grantTimestamp || 0;
    if (Date.now() - lastGrant > 3600 * 1000) {
      localPasses[domain].usedCount = 0;
    }

    // Allow strict maximum of MAX_EMERGENCY_PASSES (2 passes per session/day)
    if (localPasses[domain].usedCount < MAX_EMERGENCY_PASSES) {
      const now = Date.now();
      const targetEndTime = now + (minutes * 60 * 1000);
      localPasses[domain].remainingSec = minutes * 60;
      localPasses[domain].targetEndTime = targetEndTime;
      localPasses[domain].usedCount++;
      localPasses[domain].isOwner = true;
      localPasses[domain].grantTimestamp = now;

      if (!doomTracker[domain]) doomTracker[domain] = { cooldownStart: 0, isPassActive: false, sessionEndTime: 0 };
      doomTracker[domain].isPassActive = false; // Emergency Pass takes over, NO competing limit timer!
      doomTracker[domain].sessionEndTime = 0;
      doomTracker[domain].cooldownStart = 0;

      scheduleStorageSave();
      syncToFirebase();
      updateActiveTabContext();

      // Dismiss the modal on the sender tab immediately
      if (sender && sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'HIDE_BLOCK_MODAL' }).catch(() => {});
        updateFloatingTimer(sender.tab.id, true, minutes * 60, "PASS", targetEndTime);
      }

      sendResponse({ success: true, passesLeft: Math.max(0, MAX_EMERGENCY_PASSES - localPasses[domain].usedCount), targetEndTime: targetEndTime });
    } else {
      sendResponse({ success: false, reason: "Emergency pass limit reached (2/2 used). Please wait for the cooldown to finish." });
    }
    return true;
  }

  if (msg.type === 'UPDATE_SETTINGS') {
    if (typeof msg.doomLimit === 'number') settings.doomLimit = msg.doomLimit;
    if (typeof msg.doomCooldown === 'number') settings.doomCooldown = msg.doomCooldown;
    if (typeof msg.protectionEnabled === 'boolean') settings.protectionEnabled = msg.protectionEnabled;

    chrome.storage.local.set({
      doomLimit: settings.doomLimit,
      doomCooldown: settings.doomCooldown,
      protectionEnabled: settings.protectionEnabled
    });

    syncToFirebase();
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === 'UPDATE_SITE_CONFIG') {
    const { domain, limit, cooldown } = msg;
    if (domain) {
      const pattern = getMatchedRestrictedPattern(domain) || domain;
      siteConfigs[pattern] = {
        limit: typeof limit === 'number' ? limit : getSiteLimit(pattern),
        cooldown: typeof cooldown === 'number' ? cooldown : getSiteCooldown(pattern)
      };
      // Save immediately to local storage
      chrome.storage.local.set({ siteConfigs });
      updateActiveTabContext();
      sendResponse({ success: true, siteConfigs });
    }
    return true;
  }

  if (msg.type === 'POLL_PC_STATE') {
    fetch(`${PC_APP_URL}/state`)
      .then(r => r.json())
      .then(pcState => {
        if (pcState && Array.isArray(pcState.restrictedSites)) {
          syncRestrictedSitesFromPc(pcState.restrictedSites);
        }
        sendResponse({ success: true, pcState });
      })
      .catch(() => {
        sendResponse({ success: false });
      });
    return true;
  }

  if (msg.type === 'UPDATE_RESTRICTED_SITES') {
    restrictedSites = (msg.sites && msg.sites.length > 0) ? msg.sites : [...DEFAULT_RESTRICTED];
    chrome.storage.local.set({ restrictedSites });
    updateActiveTabContext();
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === 'CLOSE_ACTIVE_TAB') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    return true;
  }

  if (msg.type === 'CHECK_PAGE_RESTRICTION') {
    if (sender.tab && sender.tab.url) {
      const d = extractDomain(sender.tab.url);
      enforceTabPolicy(sender.tab, d);
    }
    return true;
  }
});
