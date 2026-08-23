// FocusGrow Tab & URL Sync Extension - Background Service Worker

const FIREBASE_URL = "https://focusgrow-e2d8f-default-rtdb.asia-southeast1.firebasedatabase.app/.json";

let doomLimit = 5;
let doomCooldown = 30;
let doomTracker = {};
let localPasses = {}; // { domain: { remainingSec, usedCount } }

// Load settings and state from storage
const DEFAULT_RESTRICTED = ['facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'reddit.com'];
let restrictedSites = [...DEFAULT_RESTRICTED];

const DOOMSCROLL_EXCEPTIONS = ['music.youtube.com'];

chrome.storage.local.get(['doomLimit', 'doomCooldown', 'doomTracker', 'localPasses', 'restrictedSites'], (res) => {
  if (res.doomLimit) doomLimit = res.doomLimit;
  if (res.doomCooldown) doomCooldown = res.doomCooldown;
  if (res.doomTracker) doomTracker = res.doomTracker;
  if (res.localPasses) localPasses = res.localPasses;
  if (res.restrictedSites && res.restrictedSites.length > 0) restrictedSites = res.restrictedSites;
});

function extractDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) { return ''; }
}

function matchesDomain(domain, pattern) {
  return domain === pattern || domain.endsWith('.' + pattern);
}

async function syncActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const domain = extractDomain(tab.url);

    // V21 FIX: Strict Bidirectional Unblock Check
    if (tab.url.includes(chrome.runtime.id) && tab.url.includes('blocked.html')) {
        const urlObj = new URL(tab.url);
        const targetDomain = urlObj.searchParams.get('domain');
        const originalUrl = urlObj.searchParams.get('target');

        const activeLocal = Object.keys(localPasses).find(d => matchesDomain(targetDomain, d) && localPasses[d].remainingSec > 0);
        if (activeLocal) { chrome.tabs.update(tab.id, { url: originalUrl }); return; }

        const cloudPassesRes = await chrome.storage.local.get(['cloudPasses']);
        const cloudPasses = cloudPassesRes.cloudPasses || {};
        const activeCloud = Object.keys(cloudPasses).find(d => {
            const cleanD = d.replace(/_/g, '.');
            return matchesDomain(targetDomain, cleanD) && cloudPasses[d].remainingSec > 0;
        });
        if (activeCloud) { chrome.tabs.update(tab.id, { url: originalUrl }); return; }
        return;
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.includes(chrome.runtime.id)) {
      return;
    }

    const matchedRestricted = restrictedSites.find(d => matchesDomain(domain, d));

    // 1. Tick local passes
    for (let d in localPasses) {
        if (localPasses[d].remainingSec > 0) {
            localPasses[d].remainingSec--;
        }
    }
    chrome.storage.local.set({ localPasses });

    // 1b. Tick cloud passes (V27 FIX)
    const cpRes = await chrome.storage.local.get(['cloudPasses']);
    const cloudPasses = cpRes.cloudPasses || {};
    let cpChanged = false;
    for (let d in cloudPasses) {
        if (cloudPasses[d].remainingSec > 0) {
            cloudPasses[d].remainingSec--;
            cpChanged = true;
        }
    }
    if (cpChanged) chrome.storage.local.set({ cloudPasses });

    // 2. DOMAIN ISOLATION CHECK (V21 FIX - DO NOT LEAK STATUS)
    // Check if THIS SPECIFIC domain has a Pass (Either local or cloud)
    const activeLocalPassKey = Object.keys(localPasses).find(d => matchesDomain(domain, d) && localPasses[d].remainingSec > 0);
    const activeCloudPassKey = Object.keys(cloudPasses).find(d => {
        const cleanD = d.replace(/_/g, '.');
        return matchesDomain(domain, cleanD) && cloudPasses[d].remainingSec > 0;
    });

    // V22 FIX: Also check if there's an active DOOMSCROLL pass (User has explicitly allowed this domain for the session)
    const doomPassKey = Object.keys(doomTracker).find(d => matchesDomain(domain, d) && doomTracker[d].isPassActive && doomTracker[d].totalSecThisSession < doomLimit * 60);

    if (activeLocalPassKey || activeCloudPassKey || doomPassKey) {
        let sec = 0;
        let label = "PASS";

        if (activeLocalPassKey) sec = localPasses[activeLocalPassKey].remainingSec;
        else if (activeCloudPassKey) sec = cloudPasses[activeCloudPassKey].remainingSec;
        else {
            sec = (doomLimit * 60) - doomTracker[doomPassKey].totalSecThisSession;
            label = "LIMIT";

            // Increment Doomscroll counter ONLY if pass is explicitly active for THIS domain
            doomTracker[doomPassKey].totalSecThisSession += 1;
            if (doomTracker[doomPassKey].totalSecThisSession >= doomLimit * 60) {
                doomTracker[doomPassKey].cooldownStart = Date.now();
                doomTracker[doomPassKey].isPassActive = false;
                chrome.storage.local.set({ doomTracker });
                blockTab(tab, domain, "doomscroll", doomTracker[doomPassKey].cooldownStart);
                return;
            }
            chrome.storage.local.set({ doomTracker });
        }

        updateFloatingTimer(tab.id, true, sec, label);
        return;
    }

    // YouTube Music Exception
    const isYtm = domain === 'music.youtube.com' || domain.endsWith('.music.youtube.com') || (tab.title && tab.title.toLowerCase().includes('youtube music'));
    if (isYtm) {
        updateFloatingTimer(tab.id, false, 0, "");
        return;
    }

    // 3. DOOMSCROLL LOGIC - V22 STRICT BLOCK-FIRST
    const isExempt = DOOMSCROLL_EXCEPTIONS.some(e => domain === e || domain.endsWith('.' + e));

    if (!isExempt && matchedRestricted) {
      const trackerKey = matchedRestricted;
      if (!doomTracker[trackerKey]) {
          doomTracker[trackerKey] = { totalSecThisSession: 0, cooldownStart: 0, isPassActive: false };
      }

      const info = doomTracker[trackerKey];

      // A. Cooldown Check
      if (info.cooldownStart > 0) {
        const elapsedMins = (Date.now() - info.cooldownStart) / (1000 * 60);
        if (elapsedMins < doomCooldown) {
          blockTab(tab, trackerKey, "doomscroll", info.cooldownStart);
          return;
        } else {
          info.cooldownStart = 0;
          info.totalSecThisSession = 0;
          info.isPassActive = false;
        }
      }

      // B. Block if no active pass for this restricted site
      if (!info.isPassActive) {
          blockTab(tab, trackerKey, "doomscroll", 0);
          return;
      }

      // If we got here, it means isPassActive is true but the check at Step 2 somehow missed it.
      // This shouldn't happen with the new Step 2 logic.
    }

    // 4. Global Sync with PC App
    const payload = { url: tab.url, domain: domain, title: tab.title || '', tabId: tab.id, timestamp: Date.now() };
    try {
      const res = await fetch('http://127.0.0.1:8766/tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'blocked') {
          blockTab(tab, domain, "focus");
          return;
        } else if (data.status === 'pass_active' && data.remainingSec > 0 && matchesDomain(domain, data.activeDomain)) {
          updateFloatingTimer(tab.id, true, data.remainingSec, "PASS");
          return;
        }
      }
    } catch (e) {}

    // V32 FINAL CATCH: If restricted but we don't have an active pass, Block.
    if (matchedRestricted) {
        blockTab(tab, matchedRestricted, "doomscroll", 0);
    } else {
        updateFloatingTimer(tab.id, false, 0, "");
    }
  } catch (err) {}
}

function updateFloatingTimer(tabId, active, remaining, label) {
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type: 'PASS_STATUS_UPDATE', isPassActive: active, remainingSec: remaining, label: label })
        .catch(() => reinjectScript(tabId));
}

function blockTab(tab, domain, reason, cooldownStart = 0) {
  const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}&target=${encodeURIComponent(tab.url)}&reason=${reason}&start=${cooldownStart}`);
  if (tab.id && !tab.url.startsWith(chrome.runtime.getURL(''))) {
    chrome.tabs.update(tab.id, { url: blockedUrl });
  }
}

async function syncToFirebase() {
  try {
    const res = await fetch(FIREBASE_URL);
    if (res.ok) {
        const cloudData = await res.json();

        // V26 FIX: Merge cloud passes into local state instead of just overwriting cloudPasses
        if (cloudData.activePasses) {
            chrome.storage.local.set({ cloudPasses: cloudData.activePasses });

            for (let k in cloudData.activePasses) {
                const domain = cloudData.activePasses[k].domain;
                const cloudSec = cloudData.activePasses[k].remainingSec;
                const cloudGrantTime = cloudData.activePasses[k].lastGrantTime || 0;

                // V30: Timestamp Resolution Logic
                if (!localPasses[domain]) {
                    localPasses[domain] = {
                        remainingSec: cloudSec,
                        usedCount: 1,
                        isOwner: false,
                        grantTimestamp: cloudGrantTime
                    };
                } else {
                    const localGrantTime = localPasses[domain].grantTimestamp || 0;
                    if (cloudGrantTime > localGrantTime) {
                        // Cloud is newer
                        localPasses[domain].remainingSec = cloudSec;
                        localPasses[domain].grantTimestamp = cloudGrantTime;
                        localPasses[domain].isOwner = false;
                    } else if (cloudGrantTime === localGrantTime) {
                        // Same session, use minimum wins
                        if (cloudSec < localPasses[domain].remainingSec) {
                            localPasses[domain].remainingSec = cloudSec;
                        }
                    }
                    // If local is newer, we ignore cloud for now
                }

                // V33: BIDIRECTIONAL AUTH - If cloud has a pass, ensure doomTracker is authorized
                if (cloudSec > 0) {
                    if (!doomTracker[domain] || !doomTracker[domain].isPassActive) {
                        if (!doomTracker[domain]) doomTracker[domain] = { totalSecThisSession: 0, cooldownStart: 0, isPassActive: false };
                        doomTracker[domain].isPassActive = true;
                        doomTracker[domain].totalSecThisSession = 0;
                        chrome.storage.local.set({ doomTracker });
                    }
                }
            }
            chrome.storage.local.set({ localPasses });
        }

        // V21 FIX: Sync doomTracker from cloud as well to avoid "leak" from local state
        if (cloudData.doomTracker) {
            const translatedTracker = {};
            for (let k in cloudData.doomTracker) {
                translatedTracker[k.replace(/_/g, '.')] = cloudData.doomTracker[k];
            }
            // Deep merge or overwrite if cloud is more advanced
            for (let k in translatedTracker) {
                if (!doomTracker[k] || translatedTracker[k].totalSecThisSession > (doomTracker[k].totalSecThisSession || 0) || translatedTracker[k].isPassActive) {
                    doomTracker[k] = translatedTracker[k];
                }
            }
        }
    }

    let pcState = { state: "idle" };
    try {
      const resPC = await fetch('http://127.0.0.1:8766/state');
      if (resPC.ok) pcState = await resPC.json();
    } catch (e) {}

    const activePassesMap = {};
    if (pcState.activePasses && Array.isArray(pcState.activePasses)) {
        pcState.activePasses.forEach(p => { activePassesMap[p.domain.replace(/\./g, '_')] = p; });
    }

    for (let d in localPasses) {
        if (localPasses[d].remainingSec > 0) {
            // V34 STRICT: Only include in push if we are the OWNER
            // Non-owners only display the time locally, never report it back to cloud
            if (localPasses[d].isOwner) {
                activePassesMap[d.replace(/\./g, '_')] = {
                    domain: d,
                    remainingSec: localPasses[d].remainingSec,
                    passesLeft: 2 - localPasses[d].usedCount,
                    lastGrantTime: localPasses[d].grantTimestamp || 0
                };
            }
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
      settings: { doomLimit, doomCooldown },
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

function reinjectScript(tabId) {
    chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.includes("facebook.com") || tab.url.includes("youtube.com") || tab.url.includes("instagram.com") || tab.url.includes("tiktok.com"))) {
                reinjectScript(tab.id);
            }
        });
    });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.get(['doomLimit', 'doomCooldown'], (res) => {
      if (res.doomLimit) doomLimit = res.doomLimit;
      if (res.doomCooldown) doomCooldown = res.doomCooldown;
      syncToFirebase();
    });
  }
  if (msg.type === 'UPDATE_RESTRICTED_SITES') {
    restrictedSites = (msg.sites && msg.sites.length > 0) ? msg.sites : [...DEFAULT_RESTRICTED];
    chrome.storage.local.set({ restrictedSites });
  }
  if (msg.type === 'GRANT_PASS_LOCAL') {
      const { domain, minutes } = msg;

      // V23: Unified Pass Logic - Treat everything as a domain-specific emergency pass.
      // This works for both Focus Mode and standalone Doomscroll mode.
      if (!localPasses[domain]) localPasses[domain] = { remainingSec: 0, usedCount: 0 };

      if (localPasses[domain].usedCount < 2) {
          localPasses[domain].remainingSec = minutes * 60;
          localPasses[domain].usedCount++;
          localPasses[domain].isOwner = true;
          localPasses[domain].grantTimestamp = Date.now();

          // Ensure doomTracker knows this domain is now authorized
          if (!doomTracker[domain]) doomTracker[domain] = { totalSecThisSession: 0, cooldownStart: 0, isPassActive: false };
          doomTracker[domain].isPassActive = true;
          doomTracker[domain].totalSecThisSession = 0; // Reset session progress

          chrome.storage.local.set({ localPasses, doomTracker });
          syncToFirebase();
          sendResponse({ success: true });
      } else {
          sendResponse({ success: false, reason: "Limit reached" });
      }
      return true;
  }
  if (msg.type === 'GET_PASS_INFO') {
      const info = localPasses[msg.domain] || { usedCount: 0 };
      sendResponse({ passesLeft: 2 - info.usedCount });
  }
});

// V32: STABLE SYNC LOOPS
// 1. Sync Active Tab (Blocking & Floating Timer) - 1s
setInterval(syncActiveTab, 1000);

// 2. Sync with Cloud (Firebase) - 2s (Safe & Responsive)
setInterval(syncToFirebase, 2000);
