#pragma once

#include <windows.h>
#include <windowsx.h>
#include <gdiplus.h>
#include <string>
#include <memory>
#include <atomic>
#include <chrono>
#include <cmath>
#include <vector>
#include <mutex>
#include <functional>
#include <wininet.h>
#include <wincodec.h>
#include <wincrypt.h>

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "windowscodecs.lib")
#pragma comment(lib, "crypt32.lib")

enum class VinylTransitionState {
    Normal,
    Retracting,
    Extending
};

class PipVinylOverlay {
private:
    HWND m_hwnd = nullptr;
    HWND m_hParent = nullptr;
    HINSTANCE m_hInstance = nullptr;

    bool m_visible = false;
    bool m_isPlaying = false;
    std::string m_side = "left"; // "left" or "right"

    float m_rotationAngle = 0.0f;
    float m_slideProgress = 0.0f; // 0.0 (hidden behind card) to 1.0 (fully peeking)
    float m_targetSlide = 0.0f;

    VinylTransitionState m_transitionState = VinylTransitionState::Normal;

    std::wstring m_requestedUrl = L"__INIT__";
    std::wstring m_currentCoverUrl = L"";
    std::wstring m_pendingCoverUrl = L"";
    std::unique_ptr<Gdiplus::Bitmap> m_coverBitmap = nullptr;
    std::unique_ptr<Gdiplus::Bitmap> m_pendingCoverBitmap = nullptr;
    std::mutex m_bitmapMutex;
    bool m_hasPendingBitmap = false;

    int m_parentX = 0;
    int m_parentY = 0;
    int m_parentW = 280;
    int m_parentH = 400;

    int m_discSize = 270;
    float m_speedSec = 6.0f;
    std::chrono::steady_clock::time_point m_lastAnimTime = std::chrono::steady_clock::now();

    HDC m_hdcMem = nullptr;
    HBITMAP m_hBmp = nullptr;
    HGDIOBJ m_hOldBmp = nullptr;
    void* m_pBits = nullptr;
    int m_bufferSize = 0;

    UINT_PTR m_animTimerId = 0;
    int m_lastSetPosX = -99999;
    int m_lastSetPosY = -99999;
    int m_lastSetSize = -1;
    std::function<void()> m_onClick = nullptr;
    std::function<void(short delta)> m_onWheel = nullptr;

    static std::unique_ptr<Gdiplus::Bitmap> CreateBitmapFromStream(IStream* pStream) {
        if (!pStream) return nullptr;

        // 1. Try standard GDI+ first (JPEG, PNG, BMP, GIF)
        LARGE_INTEGER zero = { 0 };
        pStream->Seek(zero, STREAM_SEEK_SET, NULL);
        auto bmp = std::make_unique<Gdiplus::Bitmap>(pStream);
        if (bmp && bmp->GetLastStatus() == Gdiplus::Ok && bmp->GetWidth() > 0 && bmp->GetHeight() > 0) {
            return bmp;
        }

        // 2. Fallback to Windows Imaging Component (WIC) for WebP and modern web formats
        pStream->Seek(zero, STREAM_SEEK_SET, NULL);
        IWICImagingFactory* pFactory = nullptr;
        HRESULT hr = CoCreateInstance(CLSID_WICImagingFactory, NULL, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pFactory));
        if (SUCCEEDED(hr) && pFactory) {
            IWICBitmapDecoder* pDecoder = nullptr;
            hr = pFactory->CreateDecoderFromStream(pStream, NULL, WICDecodeMetadataCacheOnDemand, &pDecoder);
            if (SUCCEEDED(hr) && pDecoder) {
                IWICBitmapFrameDecode* pFrame = nullptr;
                hr = pDecoder->GetFrame(0, &pFrame);
                if (SUCCEEDED(hr) && pFrame) {
                    IWICFormatConverter* pConverter = nullptr;
                    hr = pFactory->CreateFormatConverter(&pConverter);
                    if (SUCCEEDED(hr) && pConverter) {
                        hr = pConverter->Initialize(pFrame, GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, NULL, 0.0, WICBitmapPaletteTypeCustom);
                        if (SUCCEEDED(hr)) {
                            UINT w = 0, h = 0;
                            pConverter->GetSize(&w, &h);
                            if (w > 0 && h > 0) {
                                auto wicBmp = std::make_unique<Gdiplus::Bitmap>(w, h, PixelFormat32bppPARGB);
                                if (wicBmp && wicBmp->GetLastStatus() == Gdiplus::Ok) {
                                    Gdiplus::Rect rect(0, 0, w, h);
                                    Gdiplus::BitmapData bmpData;
                                    if (wicBmp->LockBits(&rect, Gdiplus::ImageLockModeWrite, PixelFormat32bppPARGB, &bmpData) == Gdiplus::Ok) {
                                        pConverter->CopyPixels(NULL, bmpData.Stride, bmpData.Stride * h, (BYTE*)bmpData.Scan0);
                                        wicBmp->UnlockBits(&bmpData);
                                        pConverter->Release();
                                        pFrame->Release();
                                        pDecoder->Release();
                                        pFactory->Release();
                                        return wicBmp;
                                    }
                                }
                            }
                        }
                        pConverter->Release();
                    }
                    pFrame->Release();
                }
                pDecoder->Release();
            }
            pFactory->Release();
        }
        return nullptr;
    }

    static LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
        PipVinylOverlay* pThis = (PipVinylOverlay*)GetWindowLongPtr(hWnd, GWLP_USERDATA);
        switch (msg) {
        case WM_TIMER:
            if (pThis && wParam == 100) {
                pThis->OnAnimFrame();
            }
            return 0;
        case WM_MOUSEACTIVATE:
            return MA_NOACTIVATE;
        case WM_MOUSEWHEEL: {
            if (pThis && pThis->m_visible && pThis->m_slideProgress >= 0.15f) {
                short delta = GET_WHEEL_DELTA_WPARAM(wParam);
                if (pThis->m_onWheel) {
                    pThis->m_onWheel(delta);
                }
            }
            return 0;
        }
        case WM_NCHITTEST: {
            if (!pThis || !pThis->m_visible || pThis->m_slideProgress < 0.15f) {
                return HTTRANSPARENT;
            }
            POINT pt = { GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam) };
            ScreenToClient(hWnd, &pt);
            float cx = pThis->m_discSize / 2.0f;
            float cy = pThis->m_discSize / 2.0f;
            float radius = (pThis->m_discSize / 2.0f) - 4.0f;
            float dx = (float)pt.x - cx;
            float dy = (float)pt.y - cy;
            if ((dx * dx + dy * dy) <= (radius * radius)) {
                return HTCLIENT;
            }
            return HTTRANSPARENT;
        }
        case WM_SETCURSOR: {
            if (LOWORD(lParam) == HTCLIENT) {
                SetCursor(LoadCursor(NULL, IDC_HAND));
                return TRUE;
            }
            break;
        }
        case WM_LBUTTONDOWN:
            return 0;
        case WM_LBUTTONUP: {
            if (pThis && pThis->m_visible && pThis->m_slideProgress >= 0.15f) {
                POINT pt = { GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam) };
                float cx = pThis->m_discSize / 2.0f;
                float cy = pThis->m_discSize / 2.0f;
                float radius = (pThis->m_discSize / 2.0f) - 4.0f;
                float dx = (float)pt.x - cx;
                float dy = (float)pt.y - cy;
                if ((dx * dx + dy * dy) <= (radius * radius)) {
                    if (pThis->m_onClick) {
                        pThis->m_onClick();
                    }
                    if (pThis->m_hParent) {
                        SetWindowPos(hWnd, pThis->m_hParent, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER);
                    }
                }
            }
            return 0;
        }
        case WM_DESTROY:
            return 0;
        }
        return DefWindowProc(hWnd, msg, wParam, lParam);
    }

public:
    PipVinylOverlay() = default;
    ~PipVinylOverlay() {
        Destroy();
    }

    void SetOnClick(std::function<void()> onClick) {
        m_onClick = onClick;
    }

    void SetOnWheel(std::function<void(short delta)> onWheel) {
        m_onWheel = onWheel;
    }

    void SetSpeed(float speedSec) {
        if (speedSec >= 0.5f && speedSec <= 60.0f) {
            m_speedSec = speedSec;
        }
    }

    HWND GetHwnd() const { return m_hwnd; }

    void ReassertZOrder() {
        if (m_hwnd && m_visible && m_hParent && IsWindowVisible(m_hParent) && !IsIconic(m_hParent)) {
            SetWindowPos(m_hwnd, m_hParent, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }
    }

    void SetTopmost(bool topmost) {
        if (m_hwnd) {
            SetWindowPos(m_hwnd, topmost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0,
                         SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            if (topmost && m_hParent && IsWindowVisible(m_hParent)) {
                SetWindowPos(m_hwnd, m_hParent, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            }
        }
    }

    void Init(HINSTANCE hInstance, HWND hParent) {
        m_hInstance = hInstance;
        m_hParent = hParent;

        WNDCLASSEXW wc = { sizeof(WNDCLASSEXW) };
        wc.style = CS_HREDRAW | CS_VREDRAW;
        wc.lpfnWndProc = WndProc;
        wc.hInstance = hInstance;
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        wc.lpszClassName = L"FocusGrow_PipVinylOverlayClass";
        RegisterClassExW(&wc);

        m_hwnd = CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST,
            wc.lpszClassName,
            L"FocusGrow_VinylOverlay",
            WS_POPUP,
            0, 0, m_discSize, m_discSize,
            NULL, NULL, hInstance, NULL
        );

        if (m_hwnd) {
            SetWindowLongPtr(m_hwnd, GWLP_USERDATA, (LONG_PTR)this);
            m_lastAnimTime = std::chrono::steady_clock::now();
            m_animTimerId = SetTimer(m_hwnd, 100, 8, NULL); // ~125 FPS buttery smooth animation loop
        }
    }

    void Destroy() {
        if (m_animTimerId && m_hwnd) {
            KillTimer(m_hwnd, m_animTimerId);
            m_animTimerId = 0;
        }
        if (m_hwnd) {
            DestroyWindow(m_hwnd);
            m_hwnd = nullptr;
        }
        if (m_hdcMem) {
            if (m_hOldBmp) SelectObject(m_hdcMem, m_hOldBmp);
            if (m_hBmp) DeleteObject(m_hBmp);
            DeleteDC(m_hdcMem);
            m_hdcMem = nullptr;
            m_hBmp = nullptr;
            m_hOldBmp = nullptr;
            m_bufferSize = 0;
        }
        std::lock_guard<std::mutex> lock(m_bitmapMutex);
        m_coverBitmap.reset();
        m_pendingCoverBitmap.reset();
        m_requestedUrl = L"__INIT__";
    }

    void SetVisible(bool visible, const std::string& side = "left") {
        if (visible && (!IsWindowVisible(m_hParent) || IsIconic(m_hParent))) {
            visible = false;
        }
        m_visible = visible;
        if (!side.empty()) m_side = side;
        if (visible) {
            if (m_transitionState == VinylTransitionState::Normal) {
                m_targetSlide = 1.0f;
            }
        } else {
            m_targetSlide = 0.0f;
            m_transitionState = VinylTransitionState::Normal;
            m_lastSetPosX = -99999;
            m_lastSetPosY = -99999;
            m_lastSetSize = -1;
            if (m_hwnd) {
                ShowWindow(m_hwnd, SW_HIDE);
            }
        }
    }

    std::string GetSide() const {
        return m_side;
    }

    void SetParentPos(int x, int y, int w, int h) {
        bool sizeChanged = (m_parentW != w || m_parentH != h);
        m_parentX = x;
        m_parentY = y;
        m_parentW = w;
        m_parentH = h;
        // Large bold vinyl disc (93% of card height, scales infinitely with card size)
        m_discSize = (int)(h * 0.93f);
        if (m_discSize < 140) m_discSize = 140;
        if (m_discSize > 2500) m_discSize = 2500;

        if (m_hwnd && m_visible) {
            int size = m_discSize;
            int posY = m_parentY + (m_parentH - size) / 2;
            int posX = 0;

            if (m_side == "right") {
                int startX = m_parentX + m_parentW - size;
                int endX = m_parentX + m_parentW - (int)(size * 0.54f);
                posX = startX + (int)((endX - startX) * m_slideProgress);
            } else {
                int startX = m_parentX;
                int endX = m_parentX - (int)(size * 0.46f);
                posX = startX + (int)((endX - startX) * m_slideProgress);
            }

            if (sizeChanged) {
                RenderAndPosition();
            } else if (m_lastSetPosX != posX || m_lastSetPosY != posY) {
                m_lastSetPosX = posX;
                m_lastSetPosY = posY;
                // Synchronous instant repositioning during mouse drag (Zero Latency)
                SetWindowPos(m_hwnd, m_hParent, posX, posY, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
            }
        }
    }

    void SetPlaying(bool isPlaying) {
        m_isPlaying = isPlaying;
    }

    void LoadCoverFromUrl(const std::wstring& url) {
        if (url == m_requestedUrl) {
            return; // Already requested or currently active! Never spam or bounce!
        }
        m_requestedUrl = url;

        if (url.empty()) {
            std::lock_guard<std::mutex> lock(m_bitmapMutex);
            m_coverBitmap.reset();
            m_pendingCoverBitmap.reset();
            m_hasPendingBitmap = false;
            m_currentCoverUrl = L"";
            m_pendingCoverUrl = L"";
            m_transitionState = VinylTransitionState::Normal;
            if (m_visible) m_targetSlide = 1.0f;
            return;
        }

        // If currently peeking out, trigger slide-in retraction animation first
        if (m_visible && m_slideProgress > 0.15f) {
            m_pendingCoverUrl = url;
            m_transitionState = VinylTransitionState::Retracting;
            m_targetSlide = 0.0f; // Slide into card
        } else {
            m_currentCoverUrl = url;
            m_pendingCoverUrl = L"";
            m_transitionState = VinylTransitionState::Normal;
            if (m_visible) m_targetSlide = 1.0f;
        }

        // Run download in background thread so UI is 100% fluid
        std::wstring fetchUrl = url;
        std::thread([this, fetchUrl]() {
            CoInitializeEx(NULL, COINIT_MULTITHREADED);
            std::vector<BYTE> buffer;

            if (fetchUrl.rfind(L"data:image/", 0) == 0) {
                size_t b64Pos = fetchUrl.find(L"base64,");
                if (b64Pos != std::wstring::npos) {
                    std::wstring b64Str = fetchUrl.substr(b64Pos + 7);
                    DWORD binLen = 0;
                    if (CryptStringToBinaryW(b64Str.c_str(), (DWORD)b64Str.length(), CRYPT_STRING_BASE64, NULL, &binLen, NULL, NULL) && binLen > 0) {
                        buffer.resize(binLen);
                        CryptStringToBinaryW(b64Str.c_str(), (DWORD)b64Str.length(), CRYPT_STRING_BASE64, buffer.data(), &binLen, NULL, NULL);
                    }
                }
            } else if (fetchUrl.rfind(L"http", 0) == 0) {
                HINTERNET hInternet = InternetOpenW(L"Mozilla/5.0 (Windows NT 10.0; Win64; x64) FocusGrow/1.0", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
                if (hInternet) {
                    DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_DONT_CACHE | INTERNET_FLAG_IGNORE_REDIRECT_TO_HTTPS | INTERNET_FLAG_IGNORE_REDIRECT_TO_HTTP | INTERNET_FLAG_IGNORE_CERT_CN_INVALID | INTERNET_FLAG_IGNORE_CERT_DATE_INVALID | INTERNET_FLAG_NO_CACHE_WRITE;
                    if (fetchUrl.rfind(L"https://", 0) == 0) {
                        flags |= INTERNET_FLAG_SECURE;
                    }
                    HINTERNET hUrl = InternetOpenUrlW(hInternet, fetchUrl.c_str(), NULL, 0, flags, 0);
                    if (hUrl) {
                        BYTE chunk[8192];
                        DWORD bytesRead = 0;
                        while (InternetReadFile(hUrl, chunk, sizeof(chunk), &bytesRead) && bytesRead > 0) {
                            buffer.insert(buffer.end(), chunk, chunk + bytesRead);
                        }
                        InternetCloseHandle(hUrl);
                    }
                    InternetCloseHandle(hInternet);
                }
            } else {
                // Local file path
                HANDLE hFile = CreateFileW(fetchUrl.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
                if (hFile != INVALID_HANDLE_VALUE) {
                    DWORD fileSize = GetFileSize(hFile, NULL);
                    if (fileSize > 0 && fileSize < 20 * 1024 * 1024) {
                        buffer.resize(fileSize);
                        DWORD read = 0;
                        ReadFile(hFile, buffer.data(), fileSize, &read, NULL);
                    }
                    CloseHandle(hFile);
                }
            }

            bool loaded = false;
            if (!buffer.empty()) {
                HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, buffer.size());
                if (hMem) {
                    void* pMem = GlobalLock(hMem);
                    if (pMem) {
                        memcpy(pMem, buffer.data(), buffer.size());
                        GlobalUnlock(hMem);

                        IStream* pStream = nullptr;
                        if (SUCCEEDED(CreateStreamOnHGlobal(hMem, TRUE, &pStream))) {
                            auto bmp = CreateBitmapFromStream(pStream);
                            if (bmp && bmp->GetLastStatus() == Gdiplus::Ok && bmp->GetWidth() > 0) {
                                std::lock_guard<std::mutex> lock(m_bitmapMutex);
                                if (m_transitionState == VinylTransitionState::Retracting) {
                                    m_pendingCoverBitmap = std::move(bmp);
                                    m_hasPendingBitmap = true;
                                } else {
                                    m_coverBitmap = std::move(bmp);
                                    m_currentCoverUrl = fetchUrl;
                                    m_hasPendingBitmap = false;
                                }
                                loaded = true;
                            }
                            pStream->Release();
                        }
                    }
                }
            }

            if (!loaded) {
                // If download or format failed, ensure vinyl doesn't get stuck inside the card
                std::lock_guard<std::mutex> lock(m_bitmapMutex);
                m_currentCoverUrl = fetchUrl;
                m_hasPendingBitmap = false;
                if (m_transitionState == VinylTransitionState::Retracting) {
                    m_transitionState = VinylTransitionState::Extending;
                    if (m_visible) m_targetSlide = 1.0f;
                }
            }
            CoUninitialize();
        }).detach();
    }

    void OnAnimFrame() {
        if (!m_hwnd) return;

        // If parent window is hidden or minimized, force overlay hidden immediately
        if (m_hParent && (!IsWindowVisible(m_hParent) || IsIconic(m_hParent))) {
            if (IsWindowVisible(m_hwnd)) {
                ShowWindow(m_hwnd, SW_HIDE);
            }
            m_visible = false;
            return;
        }

        // Smooth physical slide animation
        float diff = m_targetSlide - m_slideProgress;
        float speed = (m_targetSlide > m_slideProgress) ? 0.12f : 0.18f;
        if (std::abs(diff) > 0.005f) {
            m_slideProgress += diff * speed;
        } else {
            m_slideProgress = m_targetSlide;
        }

        // Track Change Sequence: Retracting -> Swap Cover -> Extending
        if (m_transitionState == VinylTransitionState::Retracting) {
            if (m_slideProgress <= 0.06f) {
                // Vinyl is now tucked safely inside the card
                std::lock_guard<std::mutex> lock(m_bitmapMutex);
                if (m_hasPendingBitmap && m_pendingCoverBitmap) {
                    m_coverBitmap = std::move(m_pendingCoverBitmap);
                    m_currentCoverUrl = m_pendingCoverUrl;
                    m_hasPendingBitmap = false;
                }
                m_transitionState = VinylTransitionState::Extending;
                if (m_visible) {
                    m_targetSlide = 1.0f; // Slide back out with the new album cover!
                }
            }
        } else if (m_transitionState == VinylTransitionState::Extending) {
            if (m_slideProgress >= 0.95f) {
                m_transitionState = VinylTransitionState::Normal;
            }
        }

        auto now = std::chrono::steady_clock::now();
        float dt = std::chrono::duration<float>(now - m_lastAnimTime).count();
        m_lastAnimTime = now;
        if (dt <= 0.0f || dt > 0.1f) dt = 0.016f;

        // Continuous vinyl spin when playing - physically accurate real-time delta rotation
        if (m_isPlaying && m_slideProgress > 0.05f) {
            float degPerSec = (m_speedSec >= 0.5f) ? (360.0f / m_speedSec) : (360.0f / 6.0f);
            m_rotationAngle += degPerSec * dt;
            if (m_rotationAngle >= 360.0f) {
                m_rotationAngle = std::fmod(m_rotationAngle, 360.0f);
            }
        }

        // Hide window once fully retracted into the card
        if (m_slideProgress <= 0.001f && !m_visible) {
            ShowWindow(m_hwnd, SW_HIDE);
            return;
        }

        RenderAndPosition();
    }

private:
    void RenderAndPosition() {
        if (!m_hwnd || !m_hParent) return;

        int size = m_discSize;
        int posY = m_parentY + (m_parentH - size) / 2;
        int posX = 0;

        if (m_side == "right") {
            // Retracted (0.0): posX = m_parentX + m_parentW - size
            // Extended (1.0): posX = m_parentX + m_parentW - (int)(size * 0.54f)
            int startX = m_parentX + m_parentW - size;
            int endX = m_parentX + m_parentW - (int)(size * 0.54f);
            posX = startX + (int)((endX - startX) * m_slideProgress);
        } else {
            // Retracted (0.0): posX = m_parentX
            // Extended (1.0): posX = m_parentX - (int)(size * 0.46f)
            int startX = m_parentX;
            int endX = m_parentX - (int)(size * 0.46f);
            posX = startX + (int)((endX - startX) * m_slideProgress);
        }

        // Ensure persistent 32-bit ARGB DIB buffer
        if (!m_hdcMem || m_bufferSize != size) {
            if (m_hdcMem) {
                if (m_hOldBmp) SelectObject(m_hdcMem, m_hOldBmp);
                if (m_hBmp) DeleteObject(m_hBmp);
                DeleteDC(m_hdcMem);
            }
            HDC hdcScreen = GetDC(NULL);
            m_hdcMem = CreateCompatibleDC(hdcScreen);
            ReleaseDC(NULL, hdcScreen);

            BITMAPINFO bmi = { 0 };
            bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
            bmi.bmiHeader.biWidth = size;
            bmi.bmiHeader.biHeight = -size; // Top-down DIB
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;
            bmi.bmiHeader.biCompression = BI_RGB;

            m_hBmp = CreateDIBSection(m_hdcMem, &bmi, DIB_RGB_COLORS, &m_pBits, NULL, 0);
            m_hOldBmp = SelectObject(m_hdcMem, m_hBmp);
            m_bufferSize = size;
        }

        if (!m_hdcMem || !m_hBmp) return;

        {
            Gdiplus::Graphics g(m_hdcMem);
            g.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
            g.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBilinear);
            g.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
            g.Clear(Gdiplus::Color(0, 0, 0, 0)); // 100% transparent desktop background

            // Dynamic Sleeve Clipping Mask:
            // Prevents any pixel from EVER leaking to the opposite side of the card
            if (m_side == "right") {
                float cardLeftOffset = (float)(m_parentX - posX) + 4.0f;
                if (cardLeftOffset > 0.0f) {
                    g.SetClip(Gdiplus::RectF(cardLeftOffset, 0.0f, (float)size - cardLeftOffset, (float)size));
                }
            } else {
                float cardRightOffset = (float)((m_parentX + m_parentW) - posX) - 4.0f;
                if (cardRightOffset < (float)size) {
                    g.SetClip(Gdiplus::RectF(0.0f, 0.0f, cardRightOffset, (float)size));
                }
            }

            float center = size / 2.0f;
            float radius = (size / 2.0f) - 4.0f;

            // 1. Vinyl Base Outer Disc (Sleek Dark Glossy Rim)
            Gdiplus::GraphicsPath outerPath;
            outerPath.AddEllipse(center - radius, center - radius, radius * 2.0f, radius * 2.0f);

            Gdiplus::PathGradientBrush pgb(&outerPath);
            Gdiplus::Color centerColor(255, 22, 22, 22);
            Gdiplus::Color surroundColor(255, 6, 6, 6);
            int count = 1;
            pgb.SetCenterColor(centerColor);
            pgb.SetSurroundColors(&surroundColor, &count);
            g.FillPath(&pgb, &outerPath);

            // Vinyl Sleek Subtle Grooves (Slim Rim)
            Gdiplus::Pen groovePen(Gdiplus::Color(38, 255, 255, 255), 1.0f);
            for (float r = radius * 0.96f; r >= radius * 0.81f; r -= 3.5f) {
                g.DrawEllipse(&groovePen, center - r, center - r, r * 2.0f, r * 2.0f);
            }

            // 2. Large Album Cover Art Label in Center
            g.TranslateTransform(center, center);
            g.RotateTransform(m_rotationAngle);

            float labelRadius = radius * 0.80f; // Sleek slim outer rim, large cover art
            Gdiplus::GraphicsPath labelPath;
            labelPath.AddEllipse(-labelRadius, -labelRadius, labelRadius * 2.0f, labelRadius * 2.0f);

            std::lock_guard<std::mutex> lock(m_bitmapMutex);
            if (m_coverBitmap && m_coverBitmap->GetWidth() > 0) {
                Gdiplus::GraphicsState state = g.Save();
                g.SetClip(&labelPath, Gdiplus::CombineModeIntersect);

                int imgW = (int)m_coverBitmap->GetWidth();
                int imgH = (int)m_coverBitmap->GetHeight();

                // Professional Aspect Ratio "Cover" (Center-Crop without distortion)
                float destSize = labelRadius * 2.0f;
                float drawX = -labelRadius;
                float drawY = -labelRadius;
                float drawW = destSize;
                float drawH = destSize;

                if (imgW > 0 && imgH > 0) {
                    float imgAspect = (float)imgW / (float)imgH;
                    if (imgAspect > 1.0f) {
                        // Landscape (e.g. 16:9) -> preserve ratio, center horizontally
                        drawW = destSize * imgAspect;
                        drawH = destSize;
                        drawX = -drawW / 2.0f;
                        drawY = -labelRadius;
                    } else if (imgAspect < 1.0f) {
                        // Portrait -> preserve ratio, center vertically
                        drawW = destSize;
                        drawH = destSize / imgAspect;
                        drawX = -labelRadius;
                        drawY = -drawH / 2.0f;
                    }
                }

                g.DrawImage(m_coverBitmap.get(), drawX, drawY, drawW, drawH);
                g.Restore(state);
            } else {
                // Default Dark Label if no image yet
                Gdiplus::SolidBrush labelBrush(Gdiplus::Color(255, 25, 25, 30));
                g.FillPath(&labelBrush, &labelPath);

                // Note icon in center
                Gdiplus::Pen notePen(Gdiplus::Color(180, 255, 255, 255), 2.5f);
                g.DrawEllipse(&notePen, -16.0f, -16.0f, 32.0f, 32.0f);
            }

            // Outer ring of center label
            Gdiplus::Pen labelBorderPen(Gdiplus::Color(100, 0, 0, 0), 2.0f);
            g.DrawPath(&labelBorderPen, &labelPath);

            // 3. Center Spindle / Glass Bezel
            float spindleRadius = labelRadius * 0.20f;
            Gdiplus::GraphicsPath spindlePath;
            spindlePath.AddEllipse(-spindleRadius, -spindleRadius, spindleRadius * 2.0f, spindleRadius * 2.0f);

            Gdiplus::SolidBrush spindleGlass(Gdiplus::Color(230, 245, 245, 245));
            g.FillPath(&spindleGlass, &spindlePath);

            Gdiplus::SolidBrush spindleHole(Gdiplus::Color(255, 5, 5, 5));
            g.FillEllipse(&spindleHole, -spindleRadius * 0.35f, -spindleRadius * 0.35f, spindleRadius * 0.70f, spindleRadius * 0.70f);

            g.ResetTransform();
        }

        // Position directly behind m_hParent in Z-order only when position or size has changed
        bool posChanged = (m_lastSetPosX != posX || m_lastSetPosY != posY || m_lastSetSize != size);
        if (posChanged) {
            m_lastSetPosX = posX;
            m_lastSetPosY = posY;
            m_lastSetSize = size;
            SetWindowPos(
                m_hwnd,
                m_hParent, // Insert right behind the main PiP card
                posX, posY, size, size,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
        }

        HDC hdcScreen = GetDC(NULL);
        POINT ptSrc = { 0, 0 };
        SIZE sizeWnd = { size, size };
        POINT ptDst = { posX, posY };
        BYTE alpha = (BYTE)(255 * (m_slideProgress > 1.0f ? 1.0f : (m_slideProgress < 0.0f ? 0.0f : m_slideProgress)));
        BLENDFUNCTION blend = { AC_SRC_OVER, 0, alpha, AC_SRC_ALPHA };

        UpdateLayeredWindow(m_hwnd, hdcScreen, &ptDst, &sizeWnd, m_hdcMem, &ptSrc, 0, &blend, ULW_ALPHA);
        ReleaseDC(NULL, hdcScreen);
    }
};
