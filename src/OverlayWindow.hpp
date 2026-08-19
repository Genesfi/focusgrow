#pragma once

#include <windows.h>
#include <string>

enum class OverlayMode {
    None,
    FocusBlock,  // Block unapproved app during focus work session
    RestBreak    // Strict mandatory break mode - walk outside!
};

class OverlayWindow {
private:
    HWND m_hwnd = nullptr;
    OverlayMode m_mode = OverlayMode::None;
    std::wstring m_timerText = L"00:00";
    std::wstring m_currentQuote = L"";

    std::wstring GetRandomQuote(OverlayMode mode) {
        static const std::vector<std::wstring> focusQuotes = {
            L"\"Tetap fokus pada tujuanmu. Hasil besar dibangun dari langkah-langkah kecil setiap hari.\"",
            L"\"Focus on being productive instead of busy. — Tim Ferriss\"",
            L"\"Konsistensi adalah kunci keberhasilan. Kerjakan tugasmu dengan penuh kesungguhan.\"",
            L"\"Deep work is the superpower of the 21st century. — Cal Newport\"",
            L"\"Jangan biarkan gangguan kecil menghalangi impian besarmu.\"",
            L"\"Do what you have to do until you can do what you want to do. — Oprah Winfrey\"",
            L"\"Satu jam fokus penuh jauh lebih berharga daripada seharian bekerja setengah hati.\"",
            L"\"Starve your distractions, feed your focus.\"",
            L"\"Kerjakan yang paling penting terlebih dahulu, biarkan yang lain menyusul.\"",
            L"\"Action is the foundational key to all success. — Pablo Picasso\"",
            L"\"Impian tidak terwujud lewat keajaiban; itu membutuhkan keringat, tekad, dan kerja keras.\"",
            L"\"You don't need more time, you just need more focus.\"",
            L"\"Fokus pada proses, hasil indah akan mengikuti dengan sendirinya.\"",
            L"\"It's not that I'm so smart, it's just that I stay with problems longer. — Albert Einstein\"",
            L"\"Fokus adalah seni mengatakan 'tidak' pada seribu hal baik lainnya. — Steve Jobs\""
        };

        static const std::vector<std::wstring> restQuotes = {
            L"\"Istirahat bukan berarti berhenti, melainkan mengisi ulang energi untuk melangkah lebih jauh.\"",
            L"\"Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit. — Ralph Marston\"",
            L"\"Jauhkan pandangan dari layar, regangkan tubuhmu, dan hirup udara segar.\"",
            L"\"Almost everything will work again if you unplug it for a few minutes, including you. — Anne Lamott\"",
            L"\"Kesehatan dan ketenangan pikiranmu adalah investasi terbaik untuk masa depan.\"",
            L"\"Take a break. A rested mind can solve problems that a tired mind cannot.\"",
            L"\"Minum air putih, berdiri sejenak, dan biarkan matamu beristirahat.\"",
            L"\"Rest is not idleness; to lie on the grass under trees is by no means a waste of time. — John Lubbock\"",
            L"\"Tubuhmu butuh jeda agar bisa berlari kencang kembali nanti.\"",
            L"\"He who holds his breath for too long will collapse. Breathe and rest now.\""
        };

        const auto& list = (mode == OverlayMode::RestBreak) ? restQuotes : focusQuotes;
        return list[rand() % list.size()];
    }

    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
        OverlayWindow* self = nullptr;
        if (msg == WM_NCCREATE) {
            CREATESTRUCT* cs = reinterpret_cast<CREATESTRUCT*>(lParam);
            self = reinterpret_cast<OverlayWindow*>(cs->lpCreateParams);
            SetWindowLongPtr(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        } else {
            self = reinterpret_cast<OverlayWindow*>(GetWindowLongPtr(hwnd, GWLP_USERDATA));
        }

        if (self) {
            return self->HandleMessage(hwnd, msg, wParam, lParam);
        }
        return DefWindowProc(hwnd, msg, wParam, lParam);
    }

    LRESULT HandleMessage(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
        switch (msg) {
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            RECT rc;
            GetClientRect(hwnd, &rc);

            COLORREF bgColor = (m_mode == OverlayMode::RestBreak) ? RGB(15, 23, 42) : RGB(20, 20, 20);
            HBRUSH hBrush = CreateSolidBrush(bgColor);
            FillRect(hdc, &rc, hBrush);
            DeleteObject(hBrush);

            SetBkMode(hdc, TRANSPARENT);

            int centerY = (rc.bottom - rc.top) / 2;

            // Title
            HFONT hTitleFont = CreateFontW(-36, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");
            HFONT hOldFont = (HFONT)SelectObject(hdc, hTitleFont);

            SetTextColor(hdc, RGB(255, 255, 255));
            RECT rcTitle = rc;
            rcTitle.top = centerY - 180;
            rcTitle.bottom = rcTitle.top + 50;

            if (m_mode == OverlayMode::RestBreak) {
                DrawTextW(hdc, L"TIME TO REST & TAKE A BREAK", -1, &rcTitle, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
            } else {
                DrawTextW(hdc, L"STAY FOCUSED ON YOUR WORK", -1, &rcTitle, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
            }

            // Timer Text
            HFONT hTimerFont = CreateFontW(-72, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI Variable Display");
            SelectObject(hdc, hTimerFont);

            COLORREF accentColor = (m_mode == OverlayMode::RestBreak) ? RGB(52, 211, 153) : RGB(96, 205, 255);
            SetTextColor(hdc, accentColor);

            RECT rcTimer = rc;
            rcTimer.top = centerY - 110;
            rcTimer.bottom = rcTimer.top + 80;
            DrawTextW(hdc, m_timerText.c_str(), -1, &rcTimer, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

            // Subtitle Message
            HFONT hSubFont = CreateFontW(-20, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");
            SelectObject(hdc, hSubFont);
            SetTextColor(hdc, RGB(200, 200, 200));

            RECT rcSub = rc;
            rcSub.top = centerY - 10;
            rcSub.bottom = rcSub.top + 60;

            std::wstring subText;
            if (m_mode == OverlayMode::RestBreak) {
                subText = L"Step away from your screen. Stand up, stretch your body, get a drink, and enjoy fresh air!\nWork applications are locked until your break finishes.";
            } else {
                subText = L"This application is not on your allowed focus whitelist.\nSwitch back to your work app or enable it in FocusGrow allowed list.";
            }
            DrawTextW(hdc, subText.c_str(), -1, &rcSub, DT_CENTER | DT_WORDBREAK);

            // Motivational / Rest Quote Box Banner
            if (!m_currentQuote.empty()) {
                HFONT hQuoteFont = CreateFontW(-22, 0, 0, 0, FW_SEMIBOLD, TRUE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                    CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");
                SelectObject(hdc, hQuoteFont);
                SetTextColor(hdc, (m_mode == OverlayMode::RestBreak) ? RGB(167, 243, 208) : RGB(186, 230, 253));

                RECT rcQuote = rc;
                rcQuote.top = centerY + 80;
                rcQuote.bottom = rcQuote.top + 100;
                rcQuote.left += 60;
                rcQuote.right -= 60;

                DrawTextW(hdc, m_currentQuote.c_str(), -1, &rcQuote, DT_CENTER | DT_WORDBREAK);
                DeleteObject(hQuoteFont);
            }

            SelectObject(hdc, hOldFont);
            DeleteObject(hTitleFont);
            DeleteObject(hTimerFont);
            DeleteObject(hSubFont);

            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_ERASEBKGND:
            return 1;
        case WM_KEYDOWN:
            if (wParam == VK_ESCAPE && m_mode == OverlayMode::FocusBlock) {
                Hide();
            }
            return 0;
        }
        return DefWindowProc(hwnd, msg, wParam, lParam);
    }

public:
    OverlayWindow() {}

    void Create(HINSTANCE hInstance) {
        WNDCLASSEXW wc = { sizeof(WNDCLASSEXW) };
        wc.lpfnWndProc = OverlayWindow::WndProc;
        wc.hInstance = hInstance;
        wc.lpszClassName = L"FocusGrowOverlayWindow";
        wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        RegisterClassExW(&wc);

        m_hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED,
            L"FocusGrowOverlayWindow",
            L"FocusGrow Rest & Focus Lock",
            WS_POPUP,
            0, 0, 100, 100,
            NULL, NULL, hInstance, this
        );

        SetLayeredWindowAttributes(m_hwnd, 0, 242, LWA_ALPHA);
    }

    void ShowOnMonitor(OverlayMode mode, const std::wstring& timerText, HWND targetHwnd = nullptr) {
        m_mode = mode;
        m_timerText = timerText;
        m_currentQuote = GetRandomQuote(mode);
        if (!m_hwnd) return;

        HMONITOR hMon = nullptr;
        if (targetHwnd && IsWindow(targetHwnd)) {
            hMon = MonitorFromWindow(targetHwnd, MONITOR_DEFAULTTONEAREST);
        } else {
            POINT pt;
            GetCursorPos(&pt);
            hMon = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
        }

        MONITORINFO mi = { sizeof(MONITORINFO) };
        if (GetMonitorInfoW(hMon, &mi)) {
            RECT rc = mi.rcMonitor;
            int width = rc.right - rc.left;
            int height = rc.bottom - rc.top;

            SetWindowPos(m_hwnd, HWND_TOPMOST, rc.left, rc.top, width, height, SWP_SHOWWINDOW);
        } else {
            int screenWidth = GetSystemMetrics(SM_CXSCREEN);
            int screenHeight = GetSystemMetrics(SM_CYSCREEN);
            SetWindowPos(m_hwnd, HWND_TOPMOST, 0, 0, screenWidth, screenHeight, SWP_SHOWWINDOW);
        }

        InvalidateRect(m_hwnd, NULL, TRUE);
        UpdateWindow(m_hwnd);
    }

    void UpdateTimer(const std::wstring& timerText) {
        m_timerText = timerText;
        if (m_hwnd && IsWindowVisible(m_hwnd)) {
            InvalidateRect(m_hwnd, NULL, FALSE);
        }
    }

    void Hide() {
        if (m_hwnd) {
            ShowWindow(m_hwnd, SW_HIDE);
            m_mode = OverlayMode::None;
        }
    }

    bool IsVisible() const {
        return m_hwnd && IsWindowVisible(m_hwnd);
    }

    OverlayMode GetMode() const {
        return m_mode;
    }

    HWND GetHwnd() const {
        return m_hwnd;
    }
};
