#include <windows.h>
#include <dwmapi.h>
#include <gdiplus.h>
#include <wrl.h>
#include <string>
#include <vector>
#include <memory>
#include <filesystem>
#include <sstream>

#include "../packages/WebView2/build/native/include/WebView2.h"
#include "FocusEngine.hpp"
#include "AppDetector.hpp"

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "psapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "gdiplus.lib")

using namespace Microsoft::WRL;

// Global Handles
HWND g_hWnd = NULL;
ComPtr<ICoreWebView2Controller> g_webController;
ComPtr<ICoreWebView2> g_webView;
std::unique_ptr<FocusEngine> g_focusEngine;
ULONG_PTR g_gdiplusToken = 0;
bool g_isPipMode = false;

// Helper function to escape JSON strings
std::wstring EscapeJsonString(const std::wstring& input) {
    std::wstringstream ss;
    for (wchar_t c : input) {
        if (c == L'\\') ss << L"\\\\";
        else if (c == L'"') ss << L"\\\"";
        else if (c == L'\n') ss << L"\\n";
        else if (c == L'\r') ss << L"\\r";
        else if (c == L'\t') ss << L"\\t";
        else ss << c;
    }
    return ss.str();
}

void ParseAndSetWhitelist(const std::wstring& msg) {
    size_t pos = msg.find(L"\"whitelist\":[");
    if (pos == std::wstring::npos) return;
    size_t endPos = msg.find(L"]", pos);
    if (endPos == std::wstring::npos) return;

    std::wstring arrStr = msg.substr(pos + 13, endPos - (pos + 13));
    std::vector<std::wstring> list;

    std::wstringstream ss(arrStr);
    std::wstring item;
    while (std::getline(ss, item, L',')) {
        size_t q1 = item.find(L'"');
        size_t q2 = item.rfind(L'"');
        if (q1 != std::wstring::npos && q2 != std::wstring::npos && q2 > q1) {
            std::wstring clean = item.substr(q1 + 1, q2 - q1 - 1);
            if (!clean.empty()) list.push_back(clean);
        }
    }
    if (g_focusEngine) {
        g_focusEngine->SetWhitelist(list);
    }
}

void PostStateToUi() {
    if (!g_webView || !g_focusEngine) return;
    std::wstring stateJson = g_focusEngine->GetStateJson();
    std::wstring msg = L"{\"type\":\"stateUpdate\",\"data\":" + stateJson + L",\"isPip\":" + (g_isPipMode ? L"true" : L"false") + L"}";
    g_webView->PostWebMessageAsJson(msg.c_str());
}

void SendRunningAppsToUi() {
    if (!g_webView) return;
    auto apps = AppDetector::GetRunningApps();

    std::wstringstream ss;
    ss << L"{\"type\":\"runningApps\",\"apps\":[";
    for (size_t i = 0; i < apps.size(); ++i) {
        if (i > 0) ss << L",";
        ss << L"{"
           << L"\"exeName\":\"" << EscapeJsonString(apps[i].exeName) << L"\","
           << L"\"title\":\"" << EscapeJsonString(apps[i].title) << L"\","
           << L"\"icon\":\"" << EscapeJsonString(apps[i].iconBase64) << L"\""
           << L"}";
    }
    ss << L"]}";
    g_webView->PostWebMessageAsJson(ss.str().c_str());
}

void TogglePipMode() {
    g_isPipMode = !g_isPipMode;
    if (g_isPipMode) {
        // Set Floating Mini Widget Mode (260 x 340, TOPMOST)
        SetWindowPos(g_hWnd, HWND_TOPMOST, 0, 0, 260, 340, SWP_NOMOVE | SWP_SHOWWINDOW);
    } else {
        // Restore Normal Dashboard Mode (960 x 660, NOTOPMOST)
        SetWindowPos(g_hWnd, HWND_NOTOPMOST, 0, 0, 960, 660, SWP_NOMOVE | SWP_SHOWWINDOW);
    }
    PostStateToUi();
}

void ShowWindowsToastNotification(const std::wstring& title, const std::wstring& body) {
    NOTIFYICONDATAW nid = { sizeof(NOTIFYICONDATAW) };
    nid.hWnd = g_hWnd;
    nid.uID = 1001;
    nid.uFlags = NIF_ICON | NIF_INFO | NIF_TIP;
    nid.hIcon = LoadIcon(GetModuleHandle(NULL), MAKEINTRESOURCE(101));
    if (!nid.hIcon) {
        nid.hIcon = LoadIcon(NULL, IDI_APPLICATION);
    }
    wcscpy_s(nid.szTip, L"FocusGrow");
    wcsncpy_s(nid.szInfoTitle, title.c_str(), _TRUNCATE);
    wcsncpy_s(nid.szInfo, body.c_str(), _TRUNCATE);
    nid.dwInfoFlags = NIIF_INFO | NIIF_LARGE_ICON;

    Shell_NotifyIconW(NIM_ADD, &nid);
    Shell_NotifyIconW(NIM_MODIFY, &nid);
    MessageBeep(MB_ICONASTERISK);
}

void ProcessWebMessage(PCWSTR jsonMessage) {
    std::wstring msg(jsonMessage);

    if (msg.find(L"\"action\":\"startSession\"") != std::wstring::npos) {
        int mins = 30;
        int chunkMins = 25;
        int breakMins = 5;
        bool skipBreaks = false;

        size_t pos = msg.find(L"\"focusMinutes\":");
        if (pos != std::wstring::npos) mins = _wtoi(msg.c_str() + pos + 15);

        size_t posChunk = msg.find(L"\"focusChunkMinutes\":");
        if (posChunk != std::wstring::npos) chunkMins = _wtoi(msg.c_str() + posChunk + 20);

        size_t posBreak = msg.find(L"\"breakMinutes\":");
        if (posBreak != std::wstring::npos) breakMins = _wtoi(msg.c_str() + posBreak + 15);

        pos = msg.find(L"\"skipBreaks\":true");
        if (pos != std::wstring::npos) skipBreaks = true;

        ParseAndSetWhitelist(msg);
        g_focusEngine->StartSession(mins, chunkMins, breakMins, skipBreaks);
    } else if (msg.find(L"\"action\":\"setWhitelist\"") != std::wstring::npos) {
        ParseAndSetWhitelist(msg);
    } else if (msg.find(L"\"action\":\"pauseSession\"") != std::wstring::npos) {
        g_focusEngine->PauseSession();
    } else if (msg.find(L"\"action\":\"stopSession\"") != std::wstring::npos) {
        g_focusEngine->StopSession();
        if (g_isPipMode) TogglePipMode();
    } else if (msg.find(L"\"action\":\"getRunningApps\"") != std::wstring::npos) {
        SendRunningAppsToUi();
    } else if (msg.find(L"\"action\":\"togglePip\"") != std::wstring::npos) {
        TogglePipMode();
    } else if (msg.find(L"\"action\":\"startDrag\"") != std::wstring::npos) {
        ReleaseCapture();
        PostMessage(g_hWnd, WM_SYSCOMMAND, SC_MOVE | 0x0002, 0);
    } else if (msg.find(L"\"action\":\"minimize\"") != std::wstring::npos) {
        ShowWindow(g_hWnd, SW_MINIMIZE);
    } else if (msg.find(L"\"action\":\"maximize\"") != std::wstring::npos) {
        if (IsZoomed(g_hWnd)) ShowWindow(g_hWnd, SW_RESTORE);
        else ShowWindow(g_hWnd, SW_MAXIMIZE);
    } else if (msg.find(L"\"action\":\"notify\"") != std::wstring::npos) {
        std::wstring title = L"FocusGrow Notification";
        std::wstring body = L"Focus session update.";

        size_t titlePos = msg.find(L"\"title\":\"");
        if (titlePos != std::wstring::npos) {
            size_t titleEnd = msg.find(L"\"", titlePos + 9);
            if (titleEnd != std::wstring::npos) {
                title = msg.substr(titlePos + 9, titleEnd - (titlePos + 9));
            }
        }

        size_t bodyPos = msg.find(L"\"body\":\"");
        if (bodyPos != std::wstring::npos) {
            size_t bodyEnd = msg.find(L"\"", bodyPos + 8);
            if (bodyEnd != std::wstring::npos) {
                body = msg.substr(bodyPos + 8, bodyEnd - (bodyPos + 8));
            }
        }

        ShowWindowsToastNotification(title, body);
    } else if (msg.find(L"\"action\":\"close\"") != std::wstring::npos) {
        DestroyWindow(g_hWnd);
    }
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
    case WM_SIZE:
        if (g_webController != nullptr) {
            RECT bounds;
            GetClientRect(hWnd, &bounds);
            g_webController->put_Bounds(bounds);
        }
        break;
    case WM_TIMER:
        if (wParam == 1 && g_focusEngine) {
            g_focusEngine->TickOneSecond();
        }
        break;
    case WM_DESTROY:
        PostQuitMessage(0);
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }
    return 0;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);

    Gdiplus::GdiplusStartupInput gdiplusStartupInput;
    Gdiplus::GdiplusStartup(&g_gdiplusToken, &gdiplusStartupInput, NULL);

    HICON hAppIcon = LoadIcon(hInstance, MAKEINTRESOURCE(101));

    WNDCLASSEXW wcex = { sizeof(WNDCLASSEXW) };
    wcex.style = CS_HREDRAW | CS_VREDRAW;
    wcex.lpfnWndProc = WndProc;
    wcex.hInstance = hInstance;
    wcex.hIcon = hAppIcon;
    wcex.hIconSm = hAppIcon;
    wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
    wcex.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wcex.lpszClassName = L"FocusGrowAppWindow";
    RegisterClassExW(&wcex);

    int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    int windowWidth = 960;
    int windowHeight = 660;
    int xPos = (screenWidth - windowWidth) / 2;
    int yPos = (screenHeight - windowHeight) / 2;

    g_hWnd = CreateWindowExW(
        WS_EX_APPWINDOW, L"FocusGrowAppWindow", L"FocusGrow - Time Focus & Rest Guard",
        WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX,
        xPos, yPos, windowWidth, windowHeight,
        NULL, NULL, hInstance, NULL
    );

    if (!g_hWnd) return 0;

    if (hAppIcon) {
        SendMessage(g_hWnd, WM_SETICON, ICON_BIG, (LPARAM)hAppIcon);
        SendMessage(g_hWnd, WM_SETICON, ICON_SMALL, (LPARAM)hAppIcon);
    }

    BOOL useDarkMode = TRUE;
    DwmSetWindowAttribute(g_hWnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &useDarkMode, sizeof(useDarkMode));
    DWORD cornerPreference = DWMWCP_ROUND;
    DwmSetWindowAttribute(g_hWnd, DWMWA_WINDOW_CORNER_PREFERENCE, &cornerPreference, sizeof(cornerPreference));

    MARGINS margins = { 1, 1, 1, 1 };
    DwmExtendFrameIntoClientArea(g_hWnd, &margins);

    ShowWindow(g_hWnd, nCmdShow);
    UpdateWindow(g_hWnd);

    g_focusEngine = std::make_unique<FocusEngine>();
    g_focusEngine->Init(hInstance, g_hWnd);
    g_focusEngine->SetStateCallback([](const std::wstring& jsonState) {
        PostStateToUi();
    });

    g_focusEngine->SetAppListUpdateCallback([]() {
        SendRunningAppsToUi();
    });

    SetTimer(g_hWnd, 1, 1000, NULL);

    wchar_t exePathBuf[MAX_PATH];
    GetModuleFileNameW(NULL, exePathBuf, MAX_PATH);
    std::filesystem::path currentPath(exePathBuf);
    std::filesystem::path uiPath = currentPath.parent_path() / "ui" / "index.html";

    CreateCoreWebView2EnvironmentWithOptions(
        nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [uiPath](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result)) return result;

                env->CreateCoreWebView2Controller(g_hWnd, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [uiPath](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                        if (FAILED(result)) return result;

                        g_webController = controller;
                        g_webController->get_CoreWebView2(&g_webView);

                        RECT bounds;
                        GetClientRect(g_hWnd, &bounds);
                        g_webController->put_Bounds(bounds);

                        ComPtr<ICoreWebView2Settings> settings;
                        g_webView->get_Settings(&settings);
                        if (settings) {
                            settings->put_IsScriptEnabled(TRUE);
                            settings->put_AreDefaultContextMenusEnabled(FALSE);
                            settings->put_IsWebMessageEnabled(TRUE);
                        }

                        g_webView->add_WebMessageReceived(
                            Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                [](ICoreWebView2* sender, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                    LPWSTR message = nullptr;
                                    args->TryGetWebMessageAsString(&message);
                                    if (message) {
                                        ProcessWebMessage(message);
                                        CoTaskMemFree(message);
                                    }
                                    return S_OK;
                                }).Get(), nullptr);

                        g_webView->add_PermissionRequested(
                            Callback<ICoreWebView2PermissionRequestedEventHandler>(
                                [](ICoreWebView2* sender, ICoreWebView2PermissionRequestedEventArgs* args) -> HRESULT {
                                    COREWEBVIEW2_PERMISSION_KIND kind;
                                    args->get_PermissionKind(&kind);
                                    if (kind == COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS) {
                                        args->put_State(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                                    }
                                    return S_OK;
                                }).Get(), nullptr);

                        g_webView->add_NavigationCompleted(
                            Callback<ICoreWebView2NavigationCompletedEventHandler>(
                                [](ICoreWebView2* sender, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
                                    PostStateToUi();
                                    SendRunningAppsToUi();
                                    return S_OK;
                                }).Get(), nullptr);

                        g_webView->Navigate(uiPath.c_str());

                        return S_OK;
                    }).Get());
                return S_OK;
            }).Get());

    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    if (g_gdiplusToken) {
        Gdiplus::GdiplusShutdown(g_gdiplusToken);
    }

    return (int)msg.wParam;
}
