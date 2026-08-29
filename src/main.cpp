#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <windowsx.h>
#include <dwmapi.h>
#include <gdiplus.h>
#include <wrl.h>
#include <string>
#include <vector>
#include <memory>
#include <filesystem>
#include <sstream>
#include <thread>

#include "../packages/WebView2/build/native/include/WebView2.h"
#include "../packages/WebView2/build/native/include/WebView2EnvironmentOptions.h"
#include "AppDetector.hpp"
#include "FocusEngine.hpp"

#include <shobjidl.h>

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "psapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "winmm.lib")

#include <atomic>

using namespace Microsoft::WRL;

#define WM_WEBVIEW_POST_JSON (WM_USER + 1)
#define WM_TRAYICON          (WM_USER + 2)
#define IDM_TRAY_RESTORE     10001
#define IDM_TRAY_TOGGLE_PIP  10002
#define IDM_TRAY_EXIT        10003

// Global Handles
HWND g_hWnd = NULL;
ComPtr<ICoreWebView2Controller> g_webController;
ComPtr<ICoreWebView2> g_webView;
std::unique_ptr<FocusEngine> g_focusEngine;
ULONG_PTR g_gdiplusToken = 0;
bool g_isPipMode = false;
NOTIFYICONDATAW g_trayNid = {};
bool g_trayIconCreated = false;

// Helper function to escape JSON strings
std::wstring EscapeJsonString(const std::wstring &input) {
  std::wstringstream ss;
  for (wchar_t c : input) {
    if (c == L'\\')
      ss << L"\\\\";
    else if (c == L'"')
      ss << L"\\\"";
    else if (c == L'\n')
      ss << L"\\n";
    else if (c == L'\r')
      ss << L"\\r";
    else if (c == L'\t')
      ss << L"\\t";
    else
      ss << c;
  }
  return ss.str();
}

void ParseAndSetBlacklist(const std::wstring &msg) {
  size_t pos = msg.find(L"\"blacklist\":[");
  if (pos == std::wstring::npos)
    return;
  size_t endPos = msg.find(L"]", pos);
  if (endPos == std::wstring::npos)
    return;

  std::wstring arrStr = msg.substr(pos + 13, endPos - (pos + 13));
  std::vector<std::wstring> list;

  std::wstringstream ss(arrStr);
  std::wstring item;
  while (std::getline(ss, item, L',')) {
    size_t q1 = item.find(L'"');
    size_t q2 = item.rfind(L'"');
    if (q1 != std::wstring::npos && q2 != std::wstring::npos && q2 > q1) {
      std::wstring clean = item.substr(q1 + 1, q2 - q1 - 1);
      if (!clean.empty())
        list.push_back(clean);
    }
  }
  if (g_focusEngine) {
    g_focusEngine->SetBlacklist(list);
  }
}

void PostStateToUi() {
  if (!g_webView || !g_focusEngine)
    return;
  static std::wstring lastStateMsg = L"";
  std::wstring stateJson = g_focusEngine->GetStateJson();
  std::wstring msg = L"{\"type\":\"stateUpdate\",\"data\":" + stateJson +
                     L",\"isPip\":" + (g_isPipMode ? L"true" : L"false") + L"}";
  if (msg != lastStateMsg) {
    lastStateMsg = msg;
    g_webView->PostWebMessageAsJson(msg.c_str());
  }
}

void SendRunningAppsToUi() {
  if (!g_webView)
    return;

  // Throttling: Max once per 3 seconds to avoid spamming the UI thread and
  // WebView
  static DWORD lastScanTime = 0;
  static std::atomic<bool> isScanning(false);
  static std::wstring lastSentAppsJson = L"";

  DWORD now = GetTickCount();
  if (isScanning.load() || (now - lastScanTime < 1500))
    return;

  isScanning.store(true);
  lastScanTime = now;

  std::thread([]() {
    auto apps = AppDetector::GetRunningApps();

    std::wstringstream ss;
    ss << L"{\"type\":\"runningApps\",\"apps\":[";
    for (size_t i = 0; i < apps.size(); ++i) {
      if (i > 0)
        ss << L",";
      ss << L"{" << L"\"exeName\":\"" << EscapeJsonString(apps[i].exeName)
         << L"\"," << L"\"title\":\"" << EscapeJsonString(apps[i].title)
         << L"\"," << L"\"icon\":\"" << EscapeJsonString(apps[i].iconBase64)
         << L"\"" << L"}";
    }
    ss << L"]}";

    std::wstring newJson = ss.str();
    if (newJson != lastSentAppsJson) {
      lastSentAppsJson = newJson;
      std::wstring *msgPtr = new std::wstring(newJson);
      if (!PostMessage(g_hWnd, WM_WEBVIEW_POST_JSON, 0, (LPARAM)msgPtr)) {
        delete msgPtr;
      }
    }

    isScanning.store(false);
  }).detach();
}

void SetTaskbarIconVisible(HWND hwnd, bool visible) {
  ITaskbarList* pTaskbarList = NULL;
  HRESULT hr = CoCreateInstance(CLSID_TaskbarList, NULL, CLSCTX_INPROC_SERVER, IID_ITaskbarList, (void**)&pTaskbarList);
  if (SUCCEEDED(hr) && pTaskbarList) {
    pTaskbarList->HrInit();
    if (visible) {
      pTaskbarList->AddTab(hwnd);
    } else {
      pTaskbarList->DeleteTab(hwnd);
    }
    pTaskbarList->Release();
  }
}

void InitSystemTrayIcon(HWND hwnd) {
  if (g_trayIconCreated) return;
  g_trayNid = { sizeof(NOTIFYICONDATAW) };
  g_trayNid.hWnd = hwnd;
  g_trayNid.uID = 1002;
  g_trayNid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
  g_trayNid.uCallbackMessage = WM_TRAYICON;
  g_trayNid.hIcon = LoadIcon(GetModuleHandle(NULL), MAKEINTRESOURCE(101));
  if (!g_trayNid.hIcon) {
    g_trayNid.hIcon = LoadIcon(NULL, IDI_APPLICATION);
  }
  wcscpy_s(g_trayNid.szTip, L"FocusGrow - Pomodoro & Focus Timer");
  Shell_NotifyIconW(NIM_ADD, &g_trayNid);
  g_trayIconCreated = true;
}

void RemoveSystemTrayIcon() {
  if (g_trayIconCreated) {
    Shell_NotifyIconW(NIM_DELETE, &g_trayNid);
    g_trayIconCreated = false;
  }
}

void TogglePipMode(int width = 0, int height = 0, bool hideTaskbar = false) {
  g_isPipMode = !g_isPipMode;
  BOOL enableShadow = TRUE;
  DwmSetWindowAttribute(g_hWnd, 38 /*DWMWA_NATIVE_WINDOW_SHADOW*/, &enableShadow, sizeof(enableShadow));

  DWORD cornerPreference = DWMWCP_ROUND;
  DwmSetWindowAttribute(g_hWnd, DWMWA_WINDOW_CORNER_PREFERENCE, &cornerPreference, sizeof(cornerPreference));

  MARGINS margins = { -1, -1, -1, -1 };
  DwmExtendFrameIntoClientArea(g_hWnd, &margins);

  if (g_isPipMode) {
    int w = (width > 100) ? width : 270;
    int h = (height > 100) ? height : 400;
    SetWindowPos(g_hWnd, HWND_TOPMOST, 0, 0, w, h, SWP_NOMOVE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
    if (hideTaskbar) {
      SetTaskbarIconVisible(g_hWnd, false);
    } else {
      SetTaskbarIconVisible(g_hWnd, true);
    }
  } else {
    SetWindowPos(g_hWnd, HWND_NOTOPMOST, 0, 0, 960, 660,
                 SWP_NOMOVE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
    SetTaskbarIconVisible(g_hWnd, true);
  }
  PostStateToUi();
}

void ShowWindowsToastNotification(const std::wstring &title,
                                  const std::wstring &body) {
  // Reuse the persistent tray icon (uID 1002) to show balloon notification.
  // This avoids creating a duplicate icon in the system tray.
  if (!g_trayIconCreated) return;

  NOTIFYICONDATAW nid = g_trayNid;
  nid.uFlags = NIF_INFO;
  wcsncpy_s(nid.szInfoTitle, title.c_str(), _TRUNCATE);
  wcsncpy_s(nid.szInfo, body.c_str(), _TRUNCATE);
  nid.dwInfoFlags = NIIF_INFO | NIIF_LARGE_ICON | NIIF_NOSOUND;

  Shell_NotifyIconW(NIM_MODIFY, &nid);
}

void StartTabSyncHttpServer() {
  std::thread([]() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
      return;

    SOCKET listenSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listenSocket == INVALID_SOCKET) {
      WSACleanup();
      return;
    }

    BOOL reuse = TRUE;
    setsockopt(listenSocket, SOL_SOCKET, SO_REUSEADDR, (const char *)&reuse,
               sizeof(reuse));

    sockaddr_in serverAddr = {};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr =
        INADDR_ANY; // IZINKAN koneksi dari HP (WiFi), bukan cuma 127.0.0.1
    serverAddr.sin_port = htons(8766);

    if (bind(listenSocket, (sockaddr *)&serverAddr, sizeof(serverAddr)) ==
        SOCKET_ERROR) {
      closesocket(listenSocket);
      WSACleanup();
      return;
    }

    if (listen(listenSocket, SOMAXCONN) == SOCKET_ERROR) {
      closesocket(listenSocket);
      WSACleanup();
      return;
    }

    while (true) {
      SOCKET clientSocket = accept(listenSocket, NULL, NULL);
      if (clientSocket == INVALID_SOCKET)
        break;

      char buffer[2048] = {0};
      int bytesReceived = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
      if (bytesReceived > 0) {
        std::string req(buffer, bytesReceived);

        if (req.find("OPTIONS") == 0) {
          std::string resp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: "
                             "*\r\nAccess-Control-Allow-Headers: "
                             "*\r\nAccess-Control-Allow-Methods: POST, GET, "
                             "OPTIONS\r\nContent-Length: 0\r\n\r\n";
          send(clientSocket, resp.c_str(), (int)resp.length(), 0);
          closesocket(clientSocket);
          continue;
        }

        std::wstring domain = L"";
        std::wstring url = L"";
        std::wstring title = L"";

        size_t dPos = req.find("\"domain\":\"");
        if (dPos != std::string::npos) {
          size_t dEnd = req.find("\"", dPos + 10);
          if (dEnd != std::string::npos) {
            std::string dStr = req.substr(dPos + 10, dEnd - (dPos + 10));
            domain = std::wstring(dStr.begin(), dStr.end());
          }
        }

        size_t uPos = req.find("\"url\":\"");
        if (uPos != std::string::npos) {
          size_t uEnd = req.find("\"", uPos + 7);
          if (uEnd != std::string::npos) {
            std::string uStr = req.substr(uPos + 7, uEnd - (uPos + 7));
            url = std::wstring(uStr.begin(), uStr.end());
          }
        }

        std::string statusStr = "ok";
        int remainingSec = 0;

        if (req.find("GET /state") != std::string::npos) {
          if (g_focusEngine) {
            std::wstring stateJson = g_focusEngine->GetStateJson();
            std::string bodyStr(stateJson.begin(), stateJson.end());
            std::stringstream resp;
            resp << "HTTP/1.1 200 OK\r\n"
                 << "Access-Control-Allow-Origin: *\r\n"
                 << "Content-Type: application/json\r\n"
                 << "Content-Length: " << bodyStr.length() << "\r\n\r\n"
                 << bodyStr;
            std::string respStr = resp.str();
            send(clientSocket, respStr.c_str(), (int)respStr.length(), 0);
            closesocket(clientSocket);
            continue;
          }
        }

        if (req.find("POST /grant") != std::string::npos) {
          // Cari data grantPass di body
          size_t actPos = req.find("\"action\":\"grantPass\"");
          if (actPos != std::string::npos) {
            std::wstring domain = L"";
            int mins = 5;

            size_t dPos = req.find("\"domain\":\"");
            if (dPos != std::string::npos) {
              size_t dEnd = req.find("\"", dPos + 10);
              if (dEnd != std::string::npos) {
                std::string dStr = req.substr(dPos + 10, dEnd - (dPos + 10));
                domain = std::wstring(dStr.begin(), dStr.end());
              }
            }

            size_t mPos = req.find("\"minutes\":");
            if (mPos != std::string::npos) {
              mins = atoi(req.c_str() + mPos + 10);
            }

            if (g_focusEngine && !domain.empty()) {
              g_focusEngine->GrantTemporaryPass(domain, mins);
            }

            std::string resp =
                "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: "
                "*\r\nContent-Length: 0\r\n\r\n";
            send(clientSocket, resp.c_str(), (int)resp.length(), 0);
            closesocket(clientSocket);
            continue;
          }
        }

        if (g_focusEngine) {
          // Check if extension is requesting a pass grant
          if (req.find("\"grantPass\":true") != std::string::npos) {
            int pMins = 5;
            size_t mPos = req.find("\"minutes\":");
            if (mPos != std::string::npos) {
              pMins = atoi(req.c_str() + mPos + 10);
            }
            if (!domain.empty()) {
              g_focusEngine->GrantTemporaryPass(domain, pMins);
            }
          }

          if (!domain.empty()) {
            g_focusEngine->UpdateActiveTabUrl(url, domain, title);
          }
          RestrictedSite siteInfo;
          if (g_focusEngine->IsDomainBlocked(domain, &siteInfo)) {
            statusStr = "blocked";
          } else {
            std::wstring lowerDomain = domain;
            std::transform(lowerDomain.begin(), lowerDomain.end(),
                           lowerDomain.begin(), ::tolower);
            for (const auto &site : g_focusEngine->GetRestrictedSites()) {
              std::wstring lowerSite = site.domain;
              std::transform(lowerSite.begin(), lowerSite.end(),
                             lowerSite.begin(), ::tolower);
              if (!lowerSite.empty() &&
                  lowerDomain.find(lowerSite) != std::wstring::npos &&
                  site.passRemainingSec > 0) {
                statusStr = "pass_active";
                remainingSec = site.passRemainingSec;
                break;
              }
            }
          }
        }

        std::stringstream respJson;
        respJson << "{\"status\":\"" << statusStr
                 << "\",\"remainingSec\":" << remainingSec << "}";
        std::string bodyStr = respJson.str();

        std::stringstream resp;
        resp << "HTTP/1.1 200 OK\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Type: application/json\r\n"
             << "Content-Length: " << bodyStr.length() << "\r\n\r\n"
             << bodyStr;

        std::string respStr = resp.str();
        send(clientSocket, respStr.c_str(), (int)respStr.length(), 0);
      }
      closesocket(clientSocket);
    }

    closesocket(listenSocket);
    WSACleanup();
  }).detach();
}

void ParseAndSetRestrictedSites(const std::wstring &msg) {
  size_t pos = msg.find(L"\"restrictedSites\":[");
  if (pos == std::wstring::npos)
    return;
  size_t endPos = msg.find(L"]", pos);
  if (endPos == std::wstring::npos)
    return;

  std::wstring arrStr = msg.substr(pos + 19, endPos - (pos + 19));
  std::vector<RestrictedSite> list;

  std::wstringstream ss(arrStr);
  std::wstring item;
  while (std::getline(ss, item, L',')) {
    size_t q1 = item.find(L'"');
    size_t q2 = item.rfind(L'"');
    if (q1 != std::wstring::npos && q2 != std::wstring::npos && q2 > q1) {
      std::wstring clean = item.substr(q1 + 1, q2 - q1 - 1);
      if (!clean.empty()) {
        RestrictedSite s;
        s.domain = clean;
        s.maxPassesPerSession = 2;
        s.usedPassesThisSession = 0;
        s.passRemainingSec = 0;
        list.push_back(s);
      }
    }
  }
  if (g_focusEngine) {
    g_focusEngine->SetRestrictedSites(list);
  }
}

void ProcessWebMessage(PCWSTR jsonMessage) {
  std::wstring msg(jsonMessage);

  if (msg.find(L"\"action\":\"startSession\"") != std::wstring::npos) {
    int mins = 30;
    int chunkMins = 25;
    int breakMins = 5;
    bool skipBreaks = false;

    size_t pos = msg.find(L"\"focusMinutes\":");
    if (pos != std::wstring::npos)
      mins = _wtoi(msg.c_str() + pos + 15);

    size_t posChunk = msg.find(L"\"focusChunkMinutes\":");
    if (posChunk != std::wstring::npos)
      chunkMins = _wtoi(msg.c_str() + posChunk + 20);

    size_t posBreak = msg.find(L"\"breakMinutes\":");
    if (posBreak != std::wstring::npos)
      breakMins = _wtoi(msg.c_str() + posBreak + 15);

    pos = msg.find(L"\"skipBreaks\":true");
    if (pos != std::wstring::npos)
      skipBreaks = true;

    ParseAndSetBlacklist(msg);
    ParseAndSetRestrictedSites(msg);
    g_focusEngine->StartSession(mins, chunkMins, breakMins, skipBreaks);
  } else if (msg.find(L"\"action\":\"resumeSession\"") != std::wstring::npos) {
    std::wstring state = L"idle";
    int rem = 0, cur = 1, tot = 1, foc = 30, chk = 25, brk = 5;
    bool skip = false;

    size_t p;
    if ((p = msg.find(L"\"sessionState\":\"")) != std::wstring::npos) {
      size_t end = msg.find(L"\"", p + 16);
      if (end != std::wstring::npos)
        state = msg.substr(p + 16, end - (p + 16));
    }
    if ((p = msg.find(L"\"remainingSec\":")) != std::wstring::npos)
      rem = _wtoi(msg.c_str() + p + 15);
    if ((p = msg.find(L"\"currentPeriod\":")) != std::wstring::npos)
      cur = _wtoi(msg.c_str() + p + 16);
    if ((p = msg.find(L"\"totalPeriods\":")) != std::wstring::npos)
      tot = _wtoi(msg.c_str() + p + 15);
    if ((p = msg.find(L"\"focusMinutes\":")) != std::wstring::npos)
      foc = _wtoi(msg.c_str() + p + 15);
    if ((p = msg.find(L"\"focusChunkMinutes\":")) != std::wstring::npos)
      chk = _wtoi(msg.c_str() + p + 20);
    if ((p = msg.find(L"\"breakMinutes\":")) != std::wstring::npos)
      brk = _wtoi(msg.c_str() + p + 15);
    if (msg.find(L"\"skipBreaks\":true") != std::wstring::npos)
      skip = true;

    g_focusEngine->ResumeSession(state, rem, cur, tot, foc, chk, brk, skip);
  } else if (msg.find(L"\"action\":\"syncStats\"") != std::wstring::npos) {
    int comp = 0, goal = 60;
    size_t p;
    if ((p = msg.find(L"\"completedMinutesToday\":")) != std::wstring::npos)
      comp = _wtoi(msg.c_str() + p + 24);
    if ((p = msg.find(L"\"dailyGoalMinutes\":")) != std::wstring::npos)
      goal = _wtoi(msg.c_str() + p + 19);
    if (g_focusEngine)
      g_focusEngine->SetInitialStats(comp, goal);
  } else if (msg.find(L"\"action\":\"setAutoPauseConfig\"") !=
             std::wstring::npos) {
    bool enabled = true;
    int sec = 15;
    if (msg.find(L"\"enabled\":false") != std::wstring::npos)
      enabled = false;
    size_t secPos = msg.find(L"\"sec\":");
    if (secPos != std::wstring::npos)
      sec = _wtoi(msg.c_str() + secPos + 6);
    if (g_focusEngine)
      g_focusEngine->SetAutoPauseConfig(enabled, sec);
  } else if (msg.find(L"\"action\":\"setBlacklist\"") != std::wstring::npos) {
    ParseAndSetBlacklist(msg);
  } else if (msg.find(L"\"action\":\"setRestrictedSites\"") !=
             std::wstring::npos) {
    ParseAndSetRestrictedSites(msg);
  } else if (msg.find(L"\"action\":\"grantPass\"") != std::wstring::npos) {
    std::wstring domain = L"";
    int mins = 5;
    size_t dPos = msg.find(L"\"domain\":\"");
    if (dPos != std::wstring::npos) {
      size_t dEnd = msg.find(L"\"", dPos + 10);
      if (dEnd != std::wstring::npos)
        domain = msg.substr(dPos + 10, dEnd - (dPos + 10));
    }
    size_t mPos = msg.find(L"\"minutes\":");
    if (mPos != std::wstring::npos)
      mins = _wtoi(msg.c_str() + mPos + 10);

    if (g_focusEngine && !domain.empty()) {
      g_focusEngine->GrantTemporaryPass(domain, mins);
    }
  } else if (msg.find(L"\"action\":\"pauseSession\"") != std::wstring::npos) {
    g_focusEngine->PauseSession();
  } else if (msg.find(L"\"action\":\"stopSession\"") != std::wstring::npos) {
    g_focusEngine->StopSession();
    if (g_isPipMode)
      TogglePipMode();
  } else if (msg.find(L"\"action\":\"getRunningApps\"") != std::wstring::npos) {
    SendRunningAppsToUi();
  } else if (msg.find(L"\"action\":\"mediaNext\"") != std::wstring::npos) {
    keybd_event(VK_MEDIA_NEXT_TRACK, 0, 0, 0);
    keybd_event(VK_MEDIA_NEXT_TRACK, 0, KEYEVENTF_KEYUP, 0);
  } else if (msg.find(L"\"action\":\"mediaPrev\"") != std::wstring::npos) {
    keybd_event(VK_MEDIA_PREV_TRACK, 0, 0, 0);
    keybd_event(VK_MEDIA_PREV_TRACK, 0, KEYEVENTF_KEYUP, 0);
  } else if (msg.find(L"\"action\":\"mediaPlayPause\"") != std::wstring::npos) {
    keybd_event(VK_MEDIA_PLAY_PAUSE, 0, 0, 0);
    keybd_event(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_KEYUP, 0);
  } else if (msg.find(L"\"action\":\"togglePip\"") != std::wstring::npos) {
    int w = 0, h = 0;
    size_t wPos = msg.find(L"\"width\":");
    if (wPos != std::wstring::npos)
      w = _wtoi(msg.c_str() + wPos + 8);
    size_t hPos = msg.find(L"\"height\":");
    if (hPos != std::wstring::npos)
      h = _wtoi(msg.c_str() + hPos + 9);
    bool hideTaskbar = (msg.find(L"\"hideTaskbar\":true") != std::wstring::npos);
    TogglePipMode(w, h, hideTaskbar);
  } else if (msg.find(L"\"action\":\"startDrag\"") != std::wstring::npos) {
    ReleaseCapture();
    PostMessage(g_hWnd, WM_SYSCOMMAND, SC_MOVE | 0x0002, 0);
  } else if (msg.find(L"\"action\":\"minimize\"") != std::wstring::npos) {
    ShowWindow(g_hWnd, SW_MINIMIZE);
  } else if (msg.find(L"\"action\":\"maximize\"") != std::wstring::npos) {
    if (IsZoomed(g_hWnd))
      ShowWindow(g_hWnd, SW_RESTORE);
    else
      ShowWindow(g_hWnd, SW_MAXIMIZE);
  } else if (msg.find(L"\"action\":\"notify\"") != std::wstring::npos) {
    std::wstring title = L"FocusGrow Notification";
    std::wstring body = L"Focus session update.";
    std::wstring sound = L"default";

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

    size_t soundPos = msg.find(L"\"sound\":\"");
    if (soundPos != std::wstring::npos) {
      size_t soundEnd = msg.find(L"\"", soundPos + 9);
      if (soundEnd != std::wstring::npos) {
        sound = msg.substr(soundPos + 9, soundEnd - (soundPos + 9));
      }
    }

    if (sound == L"reminder")
      PlaySoundW(L"Notification.Reminder", NULL, SND_ALIAS | SND_ASYNC);
    else if (sound == L"alarm")
      PlaySoundW(L"Notification.Looping.Alarm", NULL, SND_ALIAS | SND_ASYNC);
    else if (sound == L"chime")
      PlaySoundW(L"Notification.Proximity", NULL, SND_ALIAS | SND_ASYNC);
    else if (sound == L"none") { /* Silent */
    } else
      PlaySoundW(L"Notification.Default", NULL, SND_ALIAS | SND_ASYNC);

    ShowWindowsToastNotification(title, body);
  } else if (msg.find(L"\"action\":\"close\"") != std::wstring::npos) {
    DestroyWindow(g_hWnd);
  } else if (msg.find(L"\"action\":\"startResize\"") != std::wstring::npos) {
    WPARAM dir = SC_SIZE + 2;
    if (msg.find(L"\"edge\":\"bottom-right\"") != std::wstring::npos)
      dir = SC_SIZE + 8;
    else if (msg.find(L"\"edge\":\"bottom-left\"") != std::wstring::npos)
      dir = SC_SIZE + 7;
    else if (msg.find(L"\"edge\":\"top-right\"") != std::wstring::npos)
      dir = SC_SIZE + 5;
    else if (msg.find(L"\"edge\":\"top-left\"") != std::wstring::npos)
      dir = SC_SIZE + 4;
    else if (msg.find(L"\"edge\":\"bottom\"") != std::wstring::npos)
      dir = SC_SIZE + 6;
    else if (msg.find(L"\"edge\":\"top\"") != std::wstring::npos)
      dir = SC_SIZE + 3;
    else if (msg.find(L"\"edge\":\"left\"") != std::wstring::npos)
      dir = SC_SIZE + 1;
    else if (msg.find(L"\"edge\":\"right\"") != std::wstring::npos)
      dir = SC_SIZE + 2;

    ReleaseCapture();
    PostMessage(g_hWnd, WM_SYSCOMMAND, dir, 0);
  }
}

void ResizeWebView(HWND hWnd) {
  if (g_webController != nullptr) {
    RECT bounds;
    GetClientRect(hWnd, &bounds);
    g_webController->put_Bounds(bounds);
  }
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam,
                         LPARAM lParam) {
  switch (message) {
  case WM_ERASEBKGND:
    return 1;
  case WM_NCACTIVATE: {
    LRESULT res = DefWindowProc(hWnd, message, wParam, lParam);
    DWORD noBorderColor = 0xFFFFFFFE; // DWMWA_COLOR_NONE
    DwmSetWindowAttribute(hWnd, 34 /*DWMWA_BORDER_COLOR*/, &noBorderColor,
                          sizeof(noBorderColor));
    return res;
  }
  case WM_PAINT: {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hWnd, &ps);
    HBRUSH hBrush = CreateSolidBrush(RGB(24, 24, 24));
    FillRect(hdc, &ps.rcPaint, hBrush);
    DeleteObject(hBrush);
    EndPaint(hWnd, &ps);
  }
    return 0;
  case WM_NCCALCSIZE:
    if (wParam == TRUE) {
      return 0;
    }
    break;
  case WM_NCHITTEST: {
    POINT pt = {GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};
    RECT rect;
    GetWindowRect(hWnd, &rect);

    int borderWidth = 8;

    bool left = (pt.x >= rect.left) && (pt.x < rect.left + borderWidth);
    bool right = (pt.x <= rect.right) && (pt.x > rect.right - borderWidth);
    bool top = (pt.y >= rect.top) && (pt.y < rect.top + borderWidth);
    bool bottom = (pt.y <= rect.bottom) && (pt.y > rect.bottom - borderWidth);

    if (top && left)
      return HTTOPLEFT;
    if (top && right)
      return HTTOPRIGHT;
    if (bottom && left)
      return HTBOTTOMLEFT;
    if (bottom && right)
      return HTBOTTOMRIGHT;
    if (left)
      return HTLEFT;
    if (right)
      return HTRIGHT;
    if (top)
      return HTTOP;
    if (bottom)
      return HTBOTTOM;

    return HTCLIENT;
  }
  case WM_WEBVIEW_POST_JSON: {
    std::wstring *msgPtr = (std::wstring *)lParam;
    if (msgPtr) {
      if (g_webView) {
        g_webView->PostWebMessageAsJson(msgPtr->c_str());
      }
      delete msgPtr;
    }
  }
    return 0;
  case WM_GETMINMAXINFO: {
    LPMINMAXINFO lpmmi = (LPMINMAXINFO)lParam;
    if (lpmmi) {
      if (g_isPipMode) {
        lpmmi->ptMinTrackSize.x = 180; // Minimum PIP width limit
        lpmmi->ptMinTrackSize.y = 250; // Minimum PIP height limit
      } else {
        lpmmi->ptMinTrackSize.x =
            760; // Minimum width limit for Normal Dashboard mode
        lpmmi->ptMinTrackSize.y =
            520; // Minimum height limit for Normal Dashboard mode
      }
    }
  } break;
  case WM_SIZE:
    ResizeWebView(hWnd);
    break;
  case WM_TIMER:
    if (wParam == 1 && g_focusEngine) {
      g_focusEngine->TickOneSecond();
    }
    break;
  case WM_TRAYICON: {
    if (lParam == WM_LBUTTONUP || lParam == WM_LBUTTONDBLCLK) {
      // Just show/restore the window. Do NOT toggle PIP mode.
      ShowWindow(hWnd, SW_RESTORE);
      SetForegroundWindow(hWnd);
    } else if (lParam == WM_RBUTTONUP) {
      POINT pt;
      GetCursorPos(&pt);
      HMENU hMenu = CreatePopupMenu();
      if (hMenu) {
        InsertMenuW(hMenu, 0, MF_BYPOSITION | MF_STRING, IDM_TRAY_RESTORE, L"Restore Dashboard");
        InsertMenuW(hMenu, 1, MF_BYPOSITION | MF_STRING, IDM_TRAY_TOGGLE_PIP, g_isPipMode ? L"Exit Floating Timer (PiP)" : L"Pop out Floating Timer (PiP)");
        InsertMenuW(hMenu, 2, MF_BYPOSITION | MF_SEPARATOR, 0, NULL);
        InsertMenuW(hMenu, 3, MF_BYPOSITION | MF_STRING, IDM_TRAY_EXIT, L"Exit FocusGrow");
        SetForegroundWindow(hWnd);
        int cmd = TrackPopupMenu(hMenu, TPM_RETURNCMD | TPM_NONOTIFY, pt.x, pt.y, 0, hWnd, NULL);
        DestroyMenu(hMenu);
        if (cmd == IDM_TRAY_RESTORE) {
          if (g_isPipMode) TogglePipMode();
          ShowWindow(hWnd, SW_RESTORE);
          SetForegroundWindow(hWnd);
        } else if (cmd == IDM_TRAY_TOGGLE_PIP) {
          TogglePipMode();
        } else if (cmd == IDM_TRAY_EXIT) {
          DestroyWindow(hWnd);
        }
      }
    }
    break;
  }
  case WM_SETTEXT:
    // Intercept any title change (e.g. from WebView2/Chromium URL changes)
    // and force window title to permanently remain "FocusGrow" for Taskbar
    // Thumbnail & Alt+Tab
    return DefWindowProcW(hWnd, WM_SETTEXT, wParam, (LPARAM)L"FocusGrow");
  case WM_DESTROY:
    RemoveSystemTrayIcon();
    PostQuitMessage(0);
    break;
  default:
    return DefWindowProc(hWnd, message, wParam, lParam);
  }
  return 0;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                   LPSTR lpCmdLine, int nCmdShow) {
  SetCurrentProcessExplicitAppUserModelID(L"Genesfi.FocusGrow.App.v1");
  CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);

  Gdiplus::GdiplusStartupInput gdiplusStartupInput;
  Gdiplus::GdiplusStartup(&g_gdiplusToken, &gdiplusStartupInput, NULL);

  HICON hAppIcon = LoadIcon(hInstance, MAKEINTRESOURCE(101));

  WNDCLASSEXW wcex = {sizeof(WNDCLASSEXW)};
  wcex.style = CS_HREDRAW | CS_VREDRAW;
  wcex.lpfnWndProc = WndProc;
  wcex.hInstance = hInstance;
  wcex.hIcon = hAppIcon;
  wcex.hIconSm = hAppIcon;
  wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
  wcex.hbrBackground = CreateSolidBrush(RGB(24, 24, 24));
  wcex.lpszClassName = L"FocusGrowAppWindow";
  RegisterClassExW(&wcex);

  int screenWidth = GetSystemMetrics(SM_CXSCREEN);
  int screenHeight = GetSystemMetrics(SM_CYSCREEN);
  int windowWidth = 960;
  int windowHeight = 660;
  int xPos = (screenWidth - windowWidth) / 2;
  int yPos = (screenHeight - windowHeight) / 2;

  g_hWnd = CreateWindowExW(
      WS_EX_APPWINDOW, L"FocusGrowAppWindow", L"FocusGrow",
      WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX, xPos, yPos,
      windowWidth, windowHeight, NULL, NULL, hInstance, NULL);

  if (!g_hWnd)
    return 0;
  SetWindowTextW(g_hWnd, L"FocusGrow");
  InitSystemTrayIcon(g_hWnd);

  if (hAppIcon) {
    SendMessage(g_hWnd, WM_SETICON, ICON_BIG, (LPARAM)hAppIcon);
    SendMessage(g_hWnd, WM_SETICON, ICON_SMALL, (LPARAM)hAppIcon);
  }

  BOOL useDarkMode = TRUE;
  DwmSetWindowAttribute(g_hWnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &useDarkMode, sizeof(useDarkMode));

  BOOL enableShadow = TRUE;
  DwmSetWindowAttribute(g_hWnd, 38 /*DWMWA_NATIVE_WINDOW_SHADOW*/, &enableShadow, sizeof(enableShadow));

  DWORD cornerPreference = DWMWCP_ROUND;
  DwmSetWindowAttribute(g_hWnd, DWMWA_WINDOW_CORNER_PREFERENCE, &cornerPreference, sizeof(cornerPreference));

  DWORD noBorderColor = 0xFFFFFFFE; // DWMWA_COLOR_NONE
  DwmSetWindowAttribute(g_hWnd, 34 /*DWMWA_BORDER_COLOR*/, &noBorderColor, sizeof(noBorderColor));

  MARGINS margins = { -1, -1, -1, -1 };
  DwmExtendFrameIntoClientArea(g_hWnd, &margins);

  ShowWindow(g_hWnd, nCmdShow);
  UpdateWindow(g_hWnd);

  g_focusEngine = std::make_unique<FocusEngine>();
  g_focusEngine->Init(hInstance, g_hWnd);
  StartTabSyncHttpServer();
  g_focusEngine->SetStateCallback(
      [](const std::wstring &jsonState) { PostStateToUi(); });

  g_focusEngine->SetAppListUpdateCallback([]() { SendRunningAppsToUi(); });

  SetTimer(g_hWnd, 1, 1000, NULL);

  wchar_t exePathBuf[MAX_PATH];
  GetModuleFileNameW(NULL, exePathBuf, MAX_PATH);
  std::filesystem::path currentPath(exePathBuf);
  std::filesystem::path uiPath =
      currentPath.parent_path() / "ui" / "index.html";

  auto options = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();
  if (options) {
    options->put_AdditionalBrowserArguments(
        L"--disable-features=LayoutNG,MediaRouter,Translate,"
        L"CalculateNativeWinOcclusion,InterestFeedContentSuggestions "
        L"--enable-features=UseSkiaRenderer "
        L"--js-flags=\"--max-old-space-size=128\" "
        L"--disable-background-networking --disable-component-update "
        L"--disable-domain-reliability");
  }

  CreateCoreWebView2EnvironmentWithOptions(
      nullptr, nullptr, options.Get(),
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
          [uiPath](HRESULT result, ICoreWebView2Environment *env) -> HRESULT {
            if (FAILED(result))
              return result;

            env->CreateCoreWebView2Controller(
                g_hWnd,
                Callback<
                    ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [uiPath](HRESULT result,
                             ICoreWebView2Controller *controller) -> HRESULT {
                      if (FAILED(result))
                        return result;

                      g_webController = controller;
                      g_webController->get_CoreWebView2(&g_webView);

                      ComPtr<ICoreWebView2Controller2> controller2;
                      if (SUCCEEDED(g_webController->QueryInterface(
                              IID_PPV_ARGS(&controller2)))) {
                        COREWEBVIEW2_COLOR darkColor = {255, 24, 24, 24};
                        controller2->put_DefaultBackgroundColor(darkColor);
                      }

                      ResizeWebView(g_hWnd);

                      ComPtr<ICoreWebView2Settings> settings;
                      g_webView->get_Settings(&settings);
                      if (settings) {
                        settings->put_IsScriptEnabled(TRUE);
                        settings->put_AreDefaultContextMenusEnabled(FALSE);
                        settings->put_IsWebMessageEnabled(TRUE);
                      }

                      g_webView->add_WebMessageReceived(
                          Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                              [](ICoreWebView2 *sender,
                                 ICoreWebView2WebMessageReceivedEventArgs *args)
                                  -> HRESULT {
                                LPWSTR message = nullptr;
                                args->TryGetWebMessageAsString(&message);
                                if (message) {
                                  ProcessWebMessage(message);
                                  CoTaskMemFree(message);
                                }
                                return S_OK;
                              })
                              .Get(),
                          nullptr);

                      g_webView->add_PermissionRequested(
                          Callback<
                              ICoreWebView2PermissionRequestedEventHandler>(
                              [](ICoreWebView2 *sender,
                                 ICoreWebView2PermissionRequestedEventArgs
                                     *args) -> HRESULT {
                                COREWEBVIEW2_PERMISSION_KIND kind;
                                args->get_PermissionKind(&kind);
                                if (kind ==
                                    COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS) {
                                  args->put_State(
                                      COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                                }
                                return S_OK;
                              })
                              .Get(),
                          nullptr);

                      g_webView->add_NavigationCompleted(
                          Callback<
                              ICoreWebView2NavigationCompletedEventHandler>(
                              [](ICoreWebView2 *sender,
                                 ICoreWebView2NavigationCompletedEventArgs
                                     *args) -> HRESULT {
                                SetWindowTextW(g_hWnd, L"FocusGrow");
                                PostStateToUi();
                                SendRunningAppsToUi();
                                return S_OK;
                              })
                              .Get(),
                          nullptr);

                      g_webView->add_DocumentTitleChanged(
                          Callback<
                              ICoreWebView2DocumentTitleChangedEventHandler>(
                              [](ICoreWebView2 *sender,
                                 IUnknown *args) -> HRESULT {
                                SetWindowTextW(g_hWnd, L"FocusGrow");
                                return S_OK;
                              })
                              .Get(),
                          nullptr);

                      g_webView->Navigate(uiPath.c_str());

                      return S_OK;
                    })
                    .Get());
            return S_OK;
          })
          .Get());

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
