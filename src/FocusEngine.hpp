#pragma once

#include <windows.h>
#include <string>
#include <vector>
#include <algorithm>
#include <functional>
#include <sstream>
#include <iomanip>
#include <ctime>
#include "AppDetector.hpp"
#include "OverlayWindow.hpp"

enum class SessionState {
    Idle,
    Focusing,
    Resting
};

struct FocusStats {
    int totalGoalMinutes = 60;
    int completedMinutesToday = 0;
    int yesterdayHoursX10 = 0;
    int streakDays = 0;
};

struct RestrictedSite {
    std::wstring domain;
    int maxPassesPerSession = 2;
    int usedPassesThisSession = 0;
    int passRemainingSec = 0;
};

class FocusEngine {
private:
    SessionState m_state = SessionState::Idle;
    int m_totalFocusMinutes = 30;
    int m_singlePeriodSec = 25 * 60; // Customizable work period length (e.g., 25 mins Pomodoro)
    int m_breakDurationSec = 5 * 60;  // Break duration per rest
    int m_remainingSec = 0;
    bool m_skipBreaks = false;
    bool m_isPaused = false;
    bool m_isAutoPaused = false;
    bool m_autoPauseEnabled = true;
    int m_autoPauseSec = 15;

    int m_totalPeriods = 1;
    int m_currentPeriod = 1;

    int m_focusSecAccumulator = 0;
    time_t m_lastTickTime = 0;

    std::vector<std::wstring> m_systemWhitelist = {
        L"FocusGrow.exe",
        L"explorer.exe",
        L"msedgewebview2.exe",
        L"Photos.exe",
        L"Microsoft.Photos.exe",
        L"OpenWith.exe",
        L"PickerHost.exe",
        L"SnippingTool.exe",
        L"ScreenClippingHost.exe",
        L"ScreenSketch.exe",
        L"ApplicationFrameHost.exe",
        L"Taskmgr.exe",
        L"SearchHost.exe",
        L"ShellExperienceHost.exe",
        L"SystemSettings.exe",
        L"TextInputHost.exe"
    };

    std::vector<std::wstring> m_blacklist = {
        L"facebook.exe",
        L"tiktok.exe",
        L"instagram.exe"
    };

    std::vector<RestrictedSite> m_restrictedSites = {
        { L"facebook.com", 2, 0, 0 },
        { L"youtube.com", 2, 0, 0 },
        { L"instagram.com", 2, 0, 0 },
        { L"tiktok.com", 2, 0, 0 },
        { L"twitter.com", 2, 0, 0 },
        { L"x.com", 2, 0, 0 },
        { L"reddit.com", 2, 0, 0 }
    };

    std::wstring m_activeDomain = L"";
    std::wstring m_activeUrl = L"";

    HWINEVENTHOOK m_hEventHook = nullptr;
    OverlayWindow m_overlay;
    HINSTANCE m_hInstance = nullptr;
    HWND m_mainHwnd = nullptr;
    HWND m_lastDismissedHwnd = nullptr;

    FocusStats m_stats;

    std::function<void(const std::wstring& jsonState)> m_onStateChanged;
    std::function<void()> m_onAppListNeedsUpdate;

    static FocusEngine* s_instance;

    static void CALLBACK WinEventProc(
        HWINEVENTHOOK hWinEventHook,
        DWORD event,
        HWND hwnd,
        LONG idObject,
        LONG idChild,
        DWORD dwEventThread,
        DWORD dwmsEventTime)
    {
        if (s_instance && event == EVENT_SYSTEM_FOREGROUND && hwnd) {
            s_instance->OnForegroundWindowChanged(hwnd);
        }
    }

public:
    FocusEngine() {
        s_instance = this;
    }

    ~FocusEngine() {
        StopMonitoring();
    }

    void Init(HINSTANCE hInstance, HWND mainHwnd) {
        m_hInstance = hInstance;
        m_mainHwnd = mainHwnd;
        m_overlay.Create(hInstance);
        m_overlay.SetPassCallback([this](const std::wstring& domain, int minutes) {
            this->GrantTemporaryPass(domain, minutes);
        });
        StartMonitoring();
    }

    void SetStateCallback(std::function<void(const std::wstring& jsonState)> callback) {
        m_onStateChanged = callback;
    }

    void SetAppListUpdateCallback(std::function<void()> callback) {
        m_onAppListNeedsUpdate = callback;
    }

    void StartMonitoring() {
        if (!m_hEventHook) {
            m_hEventHook = SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND,
                NULL, WinEventProc, 0, 0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
            );
        }
    }

    void StopMonitoring() {
        if (m_hEventHook) {
            UnhookWinEvent(m_hEventHook);
            m_hEventHook = nullptr;
        }
    }

    void SetBlacklist(const std::vector<std::wstring>& list) {
        m_blacklist = list;
    }

    const std::vector<std::wstring>& GetBlacklist() const {
        return m_blacklist;
    }

    void SetRestrictedSites(const std::vector<RestrictedSite>& sites) {
        m_restrictedSites = sites;
    }

    const std::vector<RestrictedSite>& GetRestrictedSites() const {
        return m_restrictedSites;
    }

    void ResetSessionPasses() {
        for (auto& site : m_restrictedSites) {
            site.usedPassesThisSession = 0;
            site.passRemainingSec = 0;
        }
    }

    bool IsDomainBlocked(const std::wstring& domain, RestrictedSite* outSiteInfo = nullptr) const {
        if (domain.empty() || m_state != SessionState::Focusing || m_isPaused) return false;

        std::wstring lowerDomain = domain;
        std::transform(lowerDomain.begin(), lowerDomain.end(), lowerDomain.begin(), ::tolower);

        // Explicitly Allow YouTube Music (music.youtube.com)
        // Also allow common titles for YouTube Music Desktop apps
        if (lowerDomain.find(L"music.youtube.com") != std::wstring::npos ||
            lowerDomain.find(L"youtube music") != std::wstring::npos) {
            return false;
        }

        for (const auto& site : m_restrictedSites) {
            std::wstring lowerSite = site.domain;
            std::transform(lowerSite.begin(), lowerSite.end(), lowerSite.begin(), ::tolower);

            // Suffix-based domain match: youtube.com matches youtube.com and m.youtube.com
            // but we must ensure we don't accidentally match subdomains we want to allow (handled above)
            bool matches = (lowerDomain == lowerSite) || (lowerDomain.size() > lowerSite.size() &&
                           lowerDomain.compare(lowerDomain.size() - lowerSite.size() - 1, 1, L".") == 0 &&
                           lowerDomain.compare(lowerDomain.size() - lowerSite.size(), lowerSite.size(), lowerSite) == 0);

            if (!lowerSite.empty() && matches) {
                if (site.passRemainingSec > 0) {
                    return false; // Active pass! Allowed!
                }
                if (outSiteInfo) *outSiteInfo = site;
                return true; // Restricted and no active pass -> Blocked!
            }
        }
        return false;
    }

    void GrantTemporaryPass(const std::wstring& domain, int minutes) {
        std::wstring lowerDomain = domain;
        std::transform(lowerDomain.begin(), lowerDomain.end(), lowerDomain.begin(), ::tolower);

        for (auto& site : m_restrictedSites) {
            std::wstring lowerSite = site.domain;
            std::transform(lowerSite.begin(), lowerSite.end(), lowerSite.begin(), ::tolower);

            if (!lowerSite.empty() && lowerDomain.find(lowerSite) != std::wstring::npos) {
                // VALIDASI KETAT: Jika sudah pakai 2 jatah, TOLAK mentah-mentah
                if (site.usedPassesThisSession < site.maxPassesPerSession) {
                    site.usedPassesThisSession++;
                    site.passRemainingSec = minutes * 60;
                    m_overlay.Hide();
                    NotifyState();
                    OutputDebugStringW(L"[FocusGrow] Pass GRANTED\n");
                } else {
                    OutputDebugStringW(L"[FocusGrow] Pass DENIED: Limit reached\n");
                }
                break;
            }
        }
    }

    bool IsBrowserApp(const std::wstring& exeName) const {
        if (exeName.empty()) return false;
        std::wstring lowerExe = exeName;
        std::transform(lowerExe.begin(), lowerExe.end(), lowerExe.begin(), ::tolower);
        return (lowerExe == L"chrome.exe" || lowerExe == L"msedge.exe" || lowerExe == L"firefox.exe" || 
                lowerExe == L"opera.exe" || lowerExe == L"brave.exe" || lowerExe == L"vivaldi.exe" ||
                lowerExe == L"arc.exe" || lowerExe == L"thorium.exe" || lowerExe == L"librewolf.exe" ||
                lowerExe == L"waterfox.exe" || lowerExe == L"whale.exe");
    }

    void UpdateActiveTabUrl(const std::wstring& url, const std::wstring& domain, const std::wstring& title) {
        m_activeUrl = url;
        m_activeDomain = domain;

        if (m_state == SessionState::Focusing && !m_isPaused) {
            // We no longer trigger the native black overlay from here for browsers.
            // The browser extension handles the blocking UI (blocked.html) inside the tab.
            // This prevents the "double" blocking screen issue.
            
            RestrictedSite siteInfo;
            if (!IsDomainBlocked(domain, &siteInfo)) {
                if (m_overlay.GetMode() == OverlayMode::FocusBlock) {
                    m_overlay.Hide();
                }
            }
        }
    }

    bool IsAppAllowed(const std::wstring& exeName, const std::wstring& windowTitle) const {
        if (exeName.empty() && windowTitle.empty()) return true;

        std::wstring lowerExe = exeName;
        std::transform(lowerExe.begin(), lowerExe.end(), lowerExe.begin(), ::tolower);
        std::wstring lowerTitle = windowTitle;
        std::transform(lowerTitle.begin(), lowerTitle.end(), lowerTitle.begin(), ::tolower);

        // Explicitly Allow YouTube Music Desktop apps or windows
        if (lowerExe.find(L"youtube music") != std::wstring::npos ||
            lowerTitle.find(L"youtube music") != std::wstring::npos) {
            return true;
        }

        // System apps are ALWAYS allowed
        for (const auto& sysApp : m_systemWhitelist) {
            if (!exeName.empty() && _wcsicmp(sysApp.c_str(), exeName.c_str()) == 0) {
                return true;
            }
        }

        // Browsers are allowed as apps (URL blocking is separate)
        if (IsBrowserApp(exeName)) {
            return true;
        }

        // NEW BLACKLIST LOGIC: If the app is in the blacklist, it's NOT allowed.
        // If it's NOT in the blacklist, it's allowed!
        for (const auto& item : m_blacklist) {
            std::wstring lowerItem = item;
            std::transform(lowerItem.begin(), lowerItem.end(), lowerItem.begin(), ::tolower);

            if (!exeName.empty() && lowerExe == lowerItem) {
                return false; // BLOCKED
            }
            if (!windowTitle.empty() && lowerTitle.find(lowerItem) != std::wstring::npos) {
                return false; // BLOCKED
            }
        }

        return true; // Everything else is ALLOWED
    }

    void StartSession(int totalFocusMinutes, int focusChunkMinutes, int breakMinutes, bool skipBreaks) {
        m_totalFocusMinutes = totalFocusMinutes;
        m_breakDurationSec = breakMinutes * 60;
        m_skipBreaks = skipBreaks;

        // Custom work period length (default 25 or user-selected)
        int chunkMins = (focusChunkMinutes > 0) ? focusChunkMinutes : 25;
        if (chunkMins > totalFocusMinutes) chunkMins = totalFocusMinutes;

        m_singlePeriodSec = chunkMins * 60;
        m_totalPeriods = max(1, (int)ceil((double)totalFocusMinutes / chunkMins));
        m_currentPeriod = 1;

        m_remainingSec = m_singlePeriodSec; // Starts counting down from user's selected period length!

        ResetSessionPasses();

        m_state = SessionState::Focusing;
        m_isPaused = false;
        m_isAutoPaused = false;
        m_focusSecAccumulator = 0;
        m_lastTickTime = time(nullptr);

        m_overlay.Hide();
        NotifyState();
    }

    void ResumeSession(const std::wstring& stateStr, int remainingSec, int currentPeriod, int totalPeriods, int focusMins, int chunkMins, int breakMins, bool skipBreaks) {
        if (stateStr == L"focusing") m_state = SessionState::Focusing;
        else if (stateStr == L"resting") m_state = SessionState::Resting;
        else m_state = SessionState::Idle;

        if (m_state == SessionState::Idle) return;

        m_remainingSec = remainingSec;
        m_currentPeriod = currentPeriod;
        m_totalPeriods = totalPeriods;
        m_totalFocusMinutes = focusMins;
        m_singlePeriodSec = chunkMins * 60;
        m_breakDurationSec = breakMins * 60;
        m_skipBreaks = skipBreaks;
        m_isPaused = true; // Always resume in paused state for safety
        m_isAutoPaused = false;
        m_lastTickTime = time(nullptr);

        NotifyState();
    }

    void PauseSession() {
        if (m_state != SessionState::Idle) {
            m_isPaused = !m_isPaused;
            m_isAutoPaused = false;
            if (!m_isPaused) m_lastTickTime = time(nullptr);
            NotifyState();
        }
    }

    void StopSession() {
        m_state = SessionState::Idle;
        m_isPaused = false;
        m_isAutoPaused = false;
        m_remainingSec = 0;
        ResetSessionPasses();
        m_overlay.Hide();
        NotifyState();
    }

    void SetInitialStats(int completedMins, int goalMins) {
        m_stats.completedMinutesToday = completedMins;
        m_stats.totalGoalMinutes = goalMins;
        NotifyState();
    }

    void SetAutoPauseConfig(bool enabled, int sec) {
        m_autoPauseEnabled = enabled;
        m_autoPauseSec = (sec > 0) ? sec : 15;
    }

    void TickOneSecond() {
        time_t now = time(nullptr);
        int delta = (m_lastTickTime == 0) ? 1 : (int)(now - m_lastTickTime);
        m_lastTickTime = now;

        // Auto-pause detection on user inactivity (keyboard/mouse input) during Focusing state
        if (m_state == SessionState::Focusing && m_autoPauseEnabled && m_autoPauseSec > 0) {
            LASTINPUTINFO lii = { sizeof(LASTINPUTINFO) };
            lii.cbSize = sizeof(LASTINPUTINFO);
            if (GetLastInputInfo(&lii)) {
                DWORD currentTick = GetTickCount();
                DWORD idleMs = (currentTick >= lii.dwTime) ? (currentTick - lii.dwTime) : 0;
                DWORD thresholdMs = (DWORD)m_autoPauseSec * 1000;

                if (!m_isPaused && idleMs >= thresholdMs) {
                    m_isPaused = true;
                    m_isAutoPaused = true;
                    NotifyState();
                } else if (m_isPaused && m_isAutoPaused && idleMs < thresholdMs) {
                    m_isPaused = false;
                    m_isAutoPaused = false;
                    m_lastTickTime = now;
                    NotifyState();
                }
            }
        }

        if (m_state == SessionState::Idle || m_isPaused) return;

        // Tick temporary site passes
        for (auto& site : m_restrictedSites) {
            if (site.passRemainingSec > 0) {
                site.passRemainingSec = max(0, site.passRemainingSec - delta);
                if (site.passRemainingSec == 0) {
                    HWND hwndForeground = GetForegroundWindow();
                    if (hwndForeground) OnForegroundWindowChanged(hwndForeground);
                }
            }
        }

        if (m_remainingSec > 0) {
            int oldSec = m_remainingSec;
            m_remainingSec = max(0, m_remainingSec - delta);
            int elapsedSec = oldSec - m_remainingSec;

            if (m_state == SessionState::Focusing) {
                m_focusSecAccumulator += elapsedSec;
                if (m_focusSecAccumulator >= 60) {
                    m_stats.completedMinutesToday += (m_focusSecAccumulator / 60);
                    m_focusSecAccumulator %= 60;
                }
            }
        }

        std::wstring timerFormatted = GetFormattedTime();
        if (m_overlay.IsVisible()) {
            m_overlay.UpdateTimer(timerFormatted);
        }

        if (m_remainingSec <= 0) {
            if (m_state == SessionState::Focusing) {
                if (m_focusSecAccumulator >= 30) {
                    m_stats.completedMinutesToday += 1;
                }
                m_focusSecAccumulator = 0;

                if (!m_skipBreaks && m_breakDurationSec > 0 && m_currentPeriod < m_totalPeriods) {
                    // Work period done -> Start Rest Period
                    m_state = SessionState::Resting;
                    m_remainingSec = m_breakDurationSec;
                    m_overlay.ShowOnMonitor(OverlayMode::RestBreak, GetFormattedTime());
                } else if (m_currentPeriod >= m_totalPeriods || m_skipBreaks) {
                    // Session fully completed!
                    m_state = SessionState::Idle;
                    m_overlay.Hide();
                }
            } else if (m_state == SessionState::Resting) {
                // Rest period finished -> Advance to next work period
                m_currentPeriod++;
                m_state = SessionState::Focusing;
                m_remainingSec = m_singlePeriodSec;
                ResetSessionPasses();
                m_overlay.Hide();
            }
        }

        NotifyState();
    }

    void OnForegroundWindowChanged(HWND hwndForeground) {
        if (m_onAppListNeedsUpdate) {
            m_onAppListNeedsUpdate();
        }

        if (m_state == SessionState::Idle) {
            if (m_overlay.IsVisible()) m_overlay.Hide();
            return;
        }

        if (m_state == SessionState::Resting) {
            if (hwndForeground != m_overlay.GetHwnd()) {
                m_overlay.ShowOnMonitor(OverlayMode::RestBreak, GetFormattedTime(), hwndForeground);
            }
            return;
        }

        if (m_state == SessionState::Focusing && !m_isPaused) {
            if (hwndForeground == m_mainHwnd || hwndForeground == m_overlay.GetHwnd()) {
                if (m_overlay.GetMode() == OverlayMode::FocusBlock) {
                    m_overlay.Hide();
                }
                return;
            }

            std::wstring exeName = AppDetector::GetProcessNameFromHwnd(hwndForeground);
            wchar_t wtitleBuf[512] = { 0 };
            GetWindowTextW(hwndForeground, wtitleBuf, 512);
            std::wstring windowTitle(wtitleBuf);

            // If user goes to an allowed app, reset the manual dismissal tracker
            if (IsAppAllowed(exeName, windowTitle)) {
                m_lastDismissedHwnd = nullptr;
                if (m_overlay.GetMode() == OverlayMode::FocusBlock) {
                    m_overlay.Hide();
                }
                return;
            }

            // Coordination Fix:
            // IF the foreground app IS a browser, we let the Extension handle the blocking
            // inside the tab (the extension shows its own blocked.html).
            // We HIDE the native black overlay entirely for browsers to avoid "double UI".
            if (IsBrowserApp(exeName)) {
                if (m_overlay.GetMode() == OverlayMode::FocusBlock) {
                    m_overlay.Hide();
                }
                return;
            }

            // Step 3: Check general non-whitelisted apps (e.g. Games, Desktop Apps)
            if (!exeName.empty() || !windowTitle.empty()) {
                if (!IsAppAllowed(exeName, windowTitle)) {
                    RestrictedSite siteInfo;
                    IsDomainBlocked(windowTitle, &siteInfo);
                    int passesRemaining = siteInfo.domain.empty() ? 0 : max(0, siteInfo.maxPassesPerSession - siteInfo.usedPassesThisSession);
                    m_overlay.ShowOnMonitor(OverlayMode::FocusBlock, GetFormattedTime(), hwndForeground, siteInfo.domain, passesRemaining);
                } else {
                    if (m_overlay.GetMode() == OverlayMode::FocusBlock) {
                        m_overlay.Hide();
                    }
                }
            }
        }
    }

    std::wstring GetFormattedTime() const {
        int mins = m_remainingSec / 60;
        int secs = m_remainingSec % 60;
        wchar_t buf[32];
        swprintf_s(buf, L"%02d:%02d", mins, secs);
        return buf;
    }

    SessionState GetState() const { return m_state; }
    int GetRemainingSec() const { return m_remainingSec; }
    int GetMaxPeriodSec() const { return (m_state == SessionState::Resting) ? m_breakDurationSec : m_singlePeriodSec; }
    FocusStats GetStats() const { return m_stats; }

    std::wstring GetStateJson() const {
        HWND hwndForeground = GetForegroundWindow();
        std::wstring activeExe = L"";
        if (hwndForeground) {
            DWORD pid = 0;
            GetWindowThreadProcessId(hwndForeground, &pid);
            if (pid > 0) {
                std::wstring dummyPath;
                activeExe = AppDetector::GetProcessNameFromPid(pid, dummyPath);
            }
        }

        std::wstringstream ss;
        ss << L"{"
           << L"\"state\":\"" << (m_state == SessionState::Idle ? L"idle" : (m_state == SessionState::Focusing ? L"focusing" : L"resting")) << L"\","
           << L"\"remainingSec\":" << m_remainingSec << L","
           << L"\"maxPeriodSec\":" << GetMaxPeriodSec() << L","
           << L"\"formattedTime\":\"" << GetFormattedTime() << L"\","
           << L"\"isPaused\":" << (m_isPaused ? L"true" : L"false") << L","
           << L"\"isAutoPaused\":" << (m_isAutoPaused ? L"true" : L"false") << L","
           << L"\"currentPeriod\":" << m_currentPeriod << L","
           << L"\"totalPeriods\":" << m_totalPeriods << L","
           << L"\"completedMinutes\":" << m_stats.completedMinutesToday << L","
           << L"\"dailyGoalHours\":" << (m_stats.totalGoalMinutes / 60) << L","
           << L"\"yesterdayHours\":" << (m_stats.yesterdayHoursX10 / 10.0) << L","
           << L"\"streakDays\":" << m_stats.streakDays << L","
           << L"\"activeExe\":\"" << activeExe << L"\","
           << L"\"activeDomain\":\"" << m_activeDomain << L"\",";
        ss << L"\"activePasses\":[";
        bool firstPass = true;
        for (const auto& site : m_restrictedSites) {
            int passesLeft = max(0, site.maxPassesPerSession - site.usedPassesThisSession);
            if (site.passRemainingSec > 0 || passesLeft >= 0) { // Kirim info pass sisa juga
                if (!firstPass) ss << L",";
                ss << L"{\"domain\":\"" << site.domain
                   << L"\",\"remainingSec\":" << site.passRemainingSec
                   << L",\"passesLeft\":" << passesLeft << L"}";
                firstPass = false;
            }
        }
        ss << L"]";
        ss << L"}";
        return ss.str();
    }

    void NotifyState() {
        if (m_onStateChanged) {
            m_onStateChanged(GetStateJson());
        }
    }
};

FocusEngine* FocusEngine::s_instance = nullptr;
