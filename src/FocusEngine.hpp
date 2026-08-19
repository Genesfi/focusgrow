#pragma once

#include <windows.h>
#include <string>
#include <vector>
#include <algorithm>
#include <functional>
#include <sstream>
#include <iomanip>
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

class FocusEngine {
private:
    SessionState m_state = SessionState::Idle;
    int m_totalFocusMinutes = 30;
    int m_singlePeriodSec = 25 * 60; // Customizable work period length (e.g., 25 mins Pomodoro)
    int m_breakDurationSec = 5 * 60;  // Break duration per rest
    int m_remainingSec = 0;
    bool m_skipBreaks = false;
    bool m_isPaused = false;

    int m_totalPeriods = 1;
    int m_currentPeriod = 1;

    std::vector<std::wstring> m_systemWhitelist = {
        L"FocusGrow.exe",
        L"explorer.exe",
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

    std::vector<std::wstring> m_whitelist = {
        L"code.exe",
        L"devenv.exe",
        L"idea64.exe",
        L"studio64.exe",
        L"notepad.exe",
        L"afterfx.exe"
    };

    HWINEVENTHOOK m_hEventHook = nullptr;
    OverlayWindow m_overlay;
    HINSTANCE m_hInstance = nullptr;
    HWND m_mainHwnd = nullptr;

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

    void SetWhitelist(const std::vector<std::wstring>& list) {
        m_whitelist = list;
    }

    const std::vector<std::wstring>& GetWhitelist() const {
        return m_whitelist;
    }

    bool IsAppAllowed(const std::wstring& exeName, const std::wstring& windowTitle) const {
        if (exeName.empty() && windowTitle.empty()) return true;

        for (const auto& sysApp : m_systemWhitelist) {
            if (!exeName.empty() && _wcsicmp(sysApp.c_str(), exeName.c_str()) == 0) {
                return true;
            }
        }

        for (const auto& item : m_whitelist) {
            if (!exeName.empty() && _wcsicmp(item.c_str(), exeName.c_str()) == 0) {
                return true;
            }
            if (!windowTitle.empty() && wcsstr(windowTitle.c_str(), item.c_str()) != nullptr) {
                return true;
            }
        }
        return false;
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

        m_state = SessionState::Focusing;
        m_isPaused = false;

        m_overlay.Hide();
        NotifyState();
    }

    void PauseSession() {
        if (m_state != SessionState::Idle) {
            m_isPaused = !m_isPaused;
            NotifyState();
        }
    }

    void StopSession() {
        m_state = SessionState::Idle;
        m_isPaused = false;
        m_remainingSec = 0;
        m_overlay.Hide();
        NotifyState();
    }

    void TickOneSecond() {
        if (m_state == SessionState::Idle || m_isPaused) return;

        if (m_remainingSec > 0) {
            m_remainingSec--;
            if (m_state == SessionState::Focusing && m_remainingSec % 60 == 0) {
                m_stats.completedMinutesToday++;
            }
        }

        std::wstring timerFormatted = GetFormattedTime();
        if (m_overlay.IsVisible()) {
            m_overlay.UpdateTimer(timerFormatted);
        }

        if (m_remainingSec <= 0) {
            if (m_state == SessionState::Focusing) {
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

            if (!exeName.empty() || !windowTitle.empty()) {
                if (!IsAppAllowed(exeName, windowTitle)) {
                    m_overlay.ShowOnMonitor(OverlayMode::FocusBlock, GetFormattedTime(), hwndForeground);
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
        std::wstringstream ss;
        ss << L"{"
           << L"\"state\":\"" << (m_state == SessionState::Idle ? L"idle" : (m_state == SessionState::Focusing ? L"focusing" : L"resting")) << L"\","
           << L"\"remainingSec\":" << m_remainingSec << L","
           << L"\"maxPeriodSec\":" << GetMaxPeriodSec() << L","
           << L"\"formattedTime\":\"" << GetFormattedTime() << L"\","
           << L"\"isPaused\":" << (m_isPaused ? L"true" : L"false") << L","
           << L"\"currentPeriod\":" << m_currentPeriod << L","
           << L"\"totalPeriods\":" << m_totalPeriods << L","
           << L"\"completedMinutes\":" << m_stats.completedMinutesToday << L","
           << L"\"dailyGoalHours\":" << (m_stats.totalGoalMinutes / 60) << L","
           << L"\"yesterdayHours\":" << (m_stats.yesterdayHoursX10 / 10.0) << L","
           << L"\"streakDays\":" << m_stats.streakDays
           << L"}";
        return ss.str();
    }

    void NotifyState() {
        if (m_onStateChanged) {
            m_onStateChanged(GetStateJson());
        }
    }
};

FocusEngine* FocusEngine::s_instance = nullptr;
