# 🪴 FocusGrow — Time Focus & Aesthetic Productivity Guard

<p align="center">
  <b>A modern, high-performance Windows desktop application for Pomodoro focus, YouTube Music vinyl record synchronization, distraction-free app blocking, full-screen break overlays, and desktop-transparent floating PiP companion widgets.</b>
</p>

---

## ✨ Features Overview

### 🎯 1. Smart Pomodoro & Distraction Guard
- **Flexible Focus Sessions**: Configurable focus periods, short breaks, long breaks, and daily goal targets.
- **Process & Website Blocker**:
  - Automatically scans and blocks non-whitelisted desktop applications (e.g. social media, games) during active focus sessions.
  - Active browser tab inspection for Chrome, Edge, and Chromium browsers to block distracting websites.
- **Full-Screen Break & Prayer Overlays (`OverlayWindow.hpp` / `PrayerManager.hpp`)**:
  - Distraction-free full-screen overlay for mandatory rest breaks and prayer times.
  - Inspirational quotes, 5-second countdown warning before closing blocked apps, and emergency pass allowance system.
- **Historical Statistics & Streaks**:
  - Persistent daily focus tracking, yesterday's summary, and streak counter stored locally with zero cloud dependencies.

---

### 💿 2. Native Peeking Vinyl Record Companion (`PipVinylOverlay.hpp`)
- **100% Desktop-Transparent Vinyl Overlay**:
  - Utilizes a dedicated Win32 Layered Window (`WS_EX_LAYERED`) rendered with **GDI+ 32-bit ARGB (`UpdateLayeredWindow`)**.
  - Renders deep glossy vinyl grooves, concentric acoustic reflections, center spindle glass, and high-resolution album cover art.
  - **Zero black boxes or bounding box artifacts** — floats with genuine per-pixel transparency over your desktop wallpaper and windows.
- **Dynamic Sleeve In/Out Animations**:
  - **Track Change / Next / Prev**: The vinyl smoothly slides into the card sleeve (`retract`), updates the album artwork in memory, and slides back out (`extend`).
  - **Music Tab Close / Stop**: The vinyl gracefully retracts completely behind the card before hiding.
- **Dynamic Sleeve Clipping Mask**:
  - Real-time geometric clipping ensures the vinyl disc never leaks onto the opposite side of the card, even at extreme or compact PiP window sizes.
- **Zero-Latency Real-Time Drag Locking**:
  - Hooks directly into OS modal move events (`WM_MOVING` / `WM_MOVE`) for instant, microsecond-accurate synchronous docking during rapid mouse dragging.
- **Customizable Vinyl Position**:
  - Easily toggle peeking vinyl on/off and switch between **Left (`⬅️`)** or **Right (`➡️`)** docking in Settings.

---

### 🎵 3. YouTube Music Live Synchronization & Dynamic Accent
- **Live Metadata & Album Art Bridge**:
  - Communicates with the companion browser extension (`ytmpx-mod`) to sync song titles, artists, and live album art in real-time.
- **Integrated Media Player Controls**:
  - `⏮️` **Previous Track**
  - `⏯️` **Play / Pause (Dynamic Toggle & Spin Sync)**
  - `⏭️` **Next Track**
  - Control your media directly from the FocusGrow dashboard or floating PiP widget without switching windows.
- **Smart Dynamic Album Color Extraction**:
  - Automatically analyzes the current album cover artwork to extract vibrant primary and secondary colors.
  - Includes smart monochrome detection (adjusts brightness and contrast for black-and-white album covers).
  - Dynamically recolors circular progress rings, glow highlights, buttons, and control chips in real-time.
- **In-Card Vinyl & Ambient Modes**:
  - **Circle Inner Ring**: Centered vinyl dial within the timer gauge.
  - **Full Panel Fill**: Wall-to-wall vinyl backdrop across the focus card.
  - **Custom Ambient GIFs**: Upload custom GIF/image backgrounds with live opacity controls and recent history storage (IndexedDB).
  - **Sprout Growth Mode**: Dynamic SVG plant that grows progressively as your focus session advances.

---

### 📌 4. Floating PiP (Picture-in-Picture) Mini Widget
- **Windows 11 Native Rounded Corners & Shadows**:
  - Compact, distraction-free widget utilizing Windows 11 DWM native corner rounding (`DWMWCP_ROUND`) and soft drop shadows.
- **Persistent Manual Resize Memory**:
  - Resize freely from standard `280x400` down to an ultra-compact `180x250` minimum size (`WM_GETMINMAXINFO` guarded).
  - Your exact resized dimensions are saved and restored every time you enter PiP mode.
- **Taskbar Hide Option**:
  - Toggle whether the application icon appears in the Windows taskbar while in PiP mode.

---

### 🔔 5. System Tray & Custom Notification System
- **Background Minimization**:
  - Minimize to Windows System Tray on close to keep your focus timer running silently in the background.
- **Custom Sound Effects**:
  - Built-in audio alerts for Focus Start, Break Time, and Goal Completion (Default, Chime, Reminder, Alarm, or Custom Audio).
- **Windows Toast Notifications**:
  - Native Windows balloon and toast notifications for session milestones and daily goal achievements.

---

## 🧩 YouTube Music Companion Extension (`ytmpx-mod`)

To enable **live YouTube Music album art, track titles, media controls, and spinning vinyl synchronization**, install the companion browser extension:

🔗 **[ytmpx-mod on GitHub](https://github.com/Genesfi/ytmpx-mod)**

### Installation Steps:
1. Clone or download the repository from [https://github.com/Genesfi/ytmpx-mod](https://github.com/Genesfi/ytmpx-mod).
2. Open Chrome (or any Chromium browser like Edge, Brave, Opera) and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `ytmpx-mod` extension directory.
5. Open and play music on [YouTube Music](https://music.youtube.com). FocusGrow will automatically detect the stream, sync artwork, and animate the vinyl in real-time!

---

## 🛠️ Architecture & Tech Stack

```
┌───────────────────────────────────────────────────────────┐
│                      FocusGrow.exe                        │
├─────────────────────────────┬─────────────────────────────┤
│      Win32 C++ Engine       │   Layered Vinyl Companion   │
│   (MSVC / C++17 Native)     │ (GDI+ 32-bit ARGB Overlay)  │
├─────────────────────────────┴─────────────────────────────┤
│             Microsoft Edge WebView2 Runtime               │
│     (HTML5, Vanilla CSS3, JavaScript ES6 / IndexedDB)     │
└───────────────────────────────────────────────────────────┘
```

- **Core Engine**: Win32 C++17 (MSVC) — extremely low CPU and RAM footprint.
- **Vinyl Overlay**: Native GDI+ 32-bit ARGB with `UpdateLayeredWindow` and dynamic clipping masks.
- **UI System**: Microsoft WebView2 (`Edge Chromium`) executing modern Vanilla CSS and JavaScript.
- **Inter-Process Communication**: Local HTTP bridge (`127.0.0.1:38472`) for browser extension sync and bidirectional Win32 WebMessage JSON IPC.

---

## 🚀 Building & Running

### Prerequisites
- Windows 10 / 11 64-bit
- Visual Studio 2022 (with **Desktop development with C++** workload)
- MSVC C++ Build Tools

### Compiling Executable
Run the included build script from the project root in Developer Command Prompt or standard CMD/PowerShell:

```cmd
build.bat
```

The compiled binary and UI assets will be placed inside `bin/FocusGrow.exe`.

### Creating Official Windows Setup Installer
To create the standalone **`FocusGrow_Setup_v1.0.0.exe`** installer (powered by Inno Setup 6):

```cmd
build_installer.bat
```

The resulting setup installer will be generated inside the `dist/` directory.

---

## 📄 File Structure

```
FocusGrow/
├── bin/                       # Compiled output directory
│   ├── FocusGrow.exe          # Main application executable
│   └── ui/                    # Packaged web frontend assets
├── dist/                      # Official Windows Installer output
│   └── FocusGrow_Setup_v1.0.0.exe
├── src/                       # Win32 C++ native engine source
│   ├── main.cpp               # Application entry point, WndProc & IPC bridge
│   ├── FocusEngine.hpp        # Pomodoro state machine & focus session rules
│   ├── PipVinylOverlay.hpp    # GDI+ 32-bit ARGB layered vinyl overlay companion
│   ├── AppDetector.hpp        # Windows process scanner & browser tab detector
│   ├── OverlayWindow.hpp      # Full-screen break & restriction overlay
│   └── PrayerManager.hpp      # Prayer times schedule & break coordinator
├── ui/                        # Web interface source files
│   ├── index.html             # Dashboard markup & control layout
│   ├── style.css              # Glassmorphism, animations & dark UI styling
│   └── app.js                 # Frontend state manager, color extractor & IPC
├── packages/                  # WebView2 native SDK packages
├── resource.rc                # Windows application icon & version metadata
├── installer.iss              # Inno Setup 6 packaging configuration script
├── build_installer.bat        # 1-Click installer compilation script
├── build.bat                  # Automated MSVC build and asset sync script
└── README.md                  # Project documentation
```

---

## 📝 License

Developed with ❤️ for aesthetic productivity and deep work flow.
