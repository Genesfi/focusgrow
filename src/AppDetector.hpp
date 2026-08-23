#pragma once

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <psapi.h>
#include <shellapi.h>
#include <gdiplus.h>
#include <string>
#include <vector>
#include <algorithm>
#include <sstream>

#pragma comment(lib, "gdiplus.lib")

struct AppInfo {
    std::wstring exeName;
    std::wstring title;
    std::wstring fullPath;
    std::wstring iconBase64; // "data:image/png;base64,..."
    DWORD processId;
    HWND hwnd;
};

class AppDetector {
private:
    static std::wstring Base64Encode(const BYTE* data, size_t len) {
        static const char lookup[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        std::string out;
        out.reserve(((len + 2) / 3) * 4);
        int val = 0, valb = -6;
        for (size_t i = 0; i < len; ++i) {
            BYTE c = data[i];
            val = (val << 8) + c;
            valb += 8;
            while (valb >= 0) {
                out.push_back(lookup[(val >> valb) & 0x3F]);
                valb -= 6;
            }
        }
        if (valb > -6) out.push_back(lookup[((val << 8) >> (valb + 8)) & 0x3F]);
        while (out.size() % 4) out.push_back('=');
        
        std::wstring wout(out.begin(), out.end());
        return wout;
    }

    static int GetEncoderClsid(const WCHAR* format, CLSID* pClsid) {
        UINT num = 0, size = 0;
        Gdiplus::GetImageEncodersSize(&num, &size);
        if (size == 0) return -1;
        std::vector<BYTE> memory(size);
        Gdiplus::ImageCodecInfo* pImageCodecInfo = (Gdiplus::ImageCodecInfo*)(memory.data());
        Gdiplus::GetImageEncoders(num, size, pImageCodecInfo);
        for (UINT j = 0; j < num; ++j) {
            if (wcscmp(pImageCodecInfo[j].MimeType, format) == 0) {
                *pClsid = pImageCodecInfo[j].Clsid;
                return j;
            }
        }
        return -1;
    }

public:
    static std::wstring GetProcessNameFromPid(DWORD pid, std::wstring& outFullPath) {
        outFullPath.clear();
        HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if (!hProcess) return L"";

        wchar_t path[MAX_PATH] = { 0 };
        DWORD size = MAX_PATH;
        if (QueryFullProcessImageNameW(hProcess, 0, path, &size)) {
            CloseHandle(hProcess);
            outFullPath = path;
            std::wstring fullPath(path);
            size_t pos = fullPath.find_last_of(L"\\/");
            if (pos != std::wstring::npos) {
                return fullPath.substr(pos + 1);
            }
            return fullPath;
        }
        CloseHandle(hProcess);
        return L"";
    }

    static std::wstring GetProcessNameFromHwnd(HWND hwnd) {
        if (!hwnd) return L"";
        DWORD pid = 0;
        GetWindowThreadProcessId(hwnd, &pid);
        if (pid == 0) return L"";
        std::wstring dummy;
        return GetProcessNameFromPid(pid, dummy);
    }

    static std::wstring ExtractIconBase64(HWND hwnd, const std::wstring& exePath) {
        HICON hIcon = nullptr;

        // 1. Try ExtractIconExW from full executable path (Most reliable for Win32 apps & Edge/Adobe/Chrome)
        if (!exePath.empty()) {
            HICON hLarge = nullptr, hSmall = nullptr;
            if (ExtractIconExW(exePath.c_str(), 0, &hLarge, &hSmall, 1) > 0) {
                hIcon = hLarge ? hLarge : hSmall;
                if (hSmall && hSmall != hIcon) DestroyIcon(hSmall);
            }
        }

        // 2. Try ExtractAssociatedIconW
        if (!hIcon && !exePath.empty()) {
            WORD iconIndex = 0;
            wchar_t iconPath[MAX_PATH];
            wcsncpy_s(iconPath, exePath.c_str(), _TRUNCATE);
            hIcon = ExtractAssociatedIconW(GetModuleHandle(NULL), iconPath, &iconIndex);
        }

        // 3. Try SHGetFileInfoW
        if (!hIcon && !exePath.empty()) {
            SHFILEINFOW shfi = { 0 };
            if (SHGetFileInfoW(exePath.c_str(), 0, &shfi, sizeof(shfi), SHGFI_ICON | SHGFI_LARGEICON)) {
                hIcon = shfi.hIcon;
            }
        }

        // 4. Try getting window handle icon
        if (!hIcon && hwnd) {
            hIcon = (HICON)SendMessageW(hwnd, WM_GETICON, ICON_BIG, 0);
            if (!hIcon) hIcon = (HICON)SendMessageW(hwnd, WM_GETICON, ICON_SMALL, 0);
            if (!hIcon) hIcon = (HICON)GetClassLongPtrW(hwnd, GCLP_HICON);
            if (!hIcon) hIcon = (HICON)GetClassLongPtrW(hwnd, GCLP_HICONSM);
        }

        if (!hIcon) return L"";

        // Convert HICON to PNG Base64 via GDI+
        std::wstring base64Result = L"";
        Gdiplus::Bitmap bitmap(hIcon);
        if (bitmap.GetLastStatus() == Gdiplus::Ok) {
            IStream* pStream = nullptr;
            if (CreateStreamOnHGlobal(NULL, TRUE, &pStream) == S_OK) {
                CLSID pngClsid;
                if (GetEncoderClsid(L"image/png", &pngClsid) != -1) {
                    if (bitmap.Save(pStream, &pngClsid, NULL) == Gdiplus::Ok) {
                        HGLOBAL hGlobal = NULL;
                        GetHGlobalFromStream(pStream, &hGlobal);
                        if (hGlobal) {
                            SIZE_T size = GlobalSize(hGlobal);
                            BYTE* pData = (BYTE*)GlobalLock(hGlobal);
                            if (pData) {
                                base64Result = L"data:image/png;base64," + Base64Encode(pData, size);
                                GlobalUnlock(hGlobal);
                            }
                        }
                    }
                }
                pStream->Release();
            }
        }

        DestroyIcon(hIcon);
        return base64Result;
    }

    static std::vector<AppInfo> GetRunningApps() {
        std::vector<AppInfo> apps;

        EnumWindows([](HWND hwnd, LPARAM lParam) -> BOOL {
            if (!IsWindowVisible(hwnd)) return TRUE;
            int length = GetWindowTextLengthW(hwnd);
            if (length == 0) return TRUE;

            wchar_t title[512] = { 0 };
            GetWindowTextW(hwnd, title, 512);

            std::wstring wtitle(title);
            if (wtitle == L"Program Manager" || wtitle.empty()) return TRUE;

            LONG exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
            if (exStyle & WS_EX_TOOLWINDOW) return TRUE;

            DWORD pid = 0;
            GetWindowThreadProcessId(hwnd, &pid);
            if (pid == 0) return TRUE;

            std::wstring fullPath;
            std::wstring exeName = GetProcessNameFromPid(pid, fullPath);
            if (exeName.empty()) return TRUE;

            // Include all top-level window titles (allows browser tab / app window level tracking)
            auto* list = reinterpret_cast<std::vector<AppInfo>*>(lParam);

            // Check duplicate by title + pid
            bool duplicate = false;
            for (const auto& existing : *list) {
                if (existing.processId == pid && existing.title == wtitle) {
                    duplicate = true;
                    break;
                }
            }

            if (!duplicate) {
                AppInfo info;
                info.exeName = exeName;
                info.title = wtitle;
                info.fullPath = fullPath;
                info.processId = pid;
                info.hwnd = hwnd;
                info.iconBase64 = ExtractIconBase64(hwnd, fullPath);
                list->push_back(info);
            }

            return TRUE;
        }, reinterpret_cast<LPARAM>(&apps));

        return apps;
    }
};
