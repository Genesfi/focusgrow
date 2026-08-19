# 🪴 FocusGrow — Time Focus & Rest Guard

<p align="center">
  <b>A modern, aesthetic Windows desktop application for Pomodoro productivity, YouTube Music vinyl background sync, app blocking, and floating PiP widgets.</b>
</p>

---

## ✨ Features Overview

### 🎯 1. Smart Productivity & Rest Guard
- **Custom Focus Sessions**: Flexible Pomodoro timer with configurable focus periods and break lengths.
- **App Whitelist & Guard**: Automatically blocks non-whitelisted applications during active focus periods to eliminate distractions.
- **Daily Focus Statistics**: Track your daily completed focus minutes against customizable goals with persistent local storage.

### 🎵 2. YouTube Music Vinyl Record Sync & Dynamic Accent
- **Live Album Art & Metadata Sync**: Connects with browser extension to display active song titles, artist names, and album art on a spinning vinyl record backdrop.
- **Integrated Media Player Controls**:
  - `⏮️` **Previous Track**
  - `⏯️` **Play / Pause (Dynamic Toggle)**
  - `⏭️` **Next Track**
  - Controls YouTube Music directly without switching tabs out of your workflow.
- **Dynamic Accent Theme & Color Customization**:
  - 🎨 Preset Accent Color chips (Blue, Pink, Green, Purple, Orange).
  - 🖌️ Custom HTML5 Color Picker (`<input type="color">`).
  - 🎵 **Dynamic Album Color Sync**: Automatically extracts prominent vibrant colors from active YouTube Music album art to dynamically color progress rings, buttons, and UI highlights.
- **Live Vinyl Customization Controls**:
  - 📏 **Real-time Disc Size Slider (`120px` – `850px`)**: Smoothly scale the vinyl record to any diameter with live preview.
  - ⚡ **Rotation Speed Selector**: Choose between `Fast (3s)`, `Normal (6s)`, `Slow (10s)`, or `Relaxed (16s)`.
  - 🖼️ **Display Style Modes**: Toggle between **`Circle Inner Ring`** (centered inside the clock dial) and **`Full Panel Fill`** (wall-to-wall card cover).

### 🎨 3. Ambient Custom GIFs & Plant Growth
- **Custom Ambient GIFs**: Upload custom GIF/image backgrounds with live opacity controls and recent history memory.
- **Dynamic Plant Growth**: Responsive SVG plant sprout that grows progressively as you complete your focus session.

### 📌 4. Floating PiP (Picture-in-Picture) Mini Widget
- **Pop-Out Floating Widget**: Switch into a top-most mini window mode to keep your focus timer visible alongside your workspace.
- **Native Window Resize Boundaries**: Built-in Windows `WM_GETMINMAXINFO` guard prevents window squashing while maintaining fluid responsive layouts.

---

## 🧩 YouTube Music Extension Requirement (`ytmpx-mod`)

To enable **live YouTube Music album art, track titles, and spinning vinyl background sync**, install the companion browser extension:

🔗 **[ytmpx-mod on GitHub](https://github.com/Genesfi/ytmpx-mod)**

### Installation Steps:
1. Clone or download the repository from [https://github.com/Genesfi/ytmpx-mod](https://github.com/Genesfi/ytmpx-mod).
2. Open Chrome (or Chromium-based browser like Edge/Brave) and go to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `ytmpx-mod` extension folder.
5. Open and play music on [YouTube Music](https://music.youtube.com). FocusGrow will automatically sync album art, song titles, media controls, and dynamic accent colors in real-time!

---

## 🛠️ Architecture & Tech Stack

- **Core Engine**: Win32 C++ (MSVC / C++17) for low CPU & RAM footprint.
- **UI System**: Microsoft WebView2 (`Edge Chromium`) executing modern HTML5, Vanilla CSS3, and JavaScript ES6.
- **IPC Protocol**: Bidirectional `postMessage` C++ to Web JSON IPC bridge.

---

## 🚀 Building & Running

### Prerequisites
- Windows 10 / 11 64-bit
- Visual Studio 2022 (with **Desktop development with C++** workload)
- MSVC C++ Build Tools

### Building Executable
Run the included build script in developer command prompt or standard CMD:

```cmd
build.bat
```

The compiled binary and UI assets will be placed inside `bin/FocusGrow.exe`.

---

## 📄 File Structure

```
FocusGrow/
├── bin/                 # Compiled executable and assets
│   ├── FocusGrow.exe
│   └── ui/              # Distribution UI bundle
├── src/                 # Win32 C++ engine source code
│   ├── main.cpp         # Main application entry point & WndProc
│   ├── FocusEngine.hpp  # Timer logic & app blocking guard
│   └── AppDetector.hpp  # Windows process & window detector
├── ui/                  # Web interface source files
│   ├── index.html       # Single-page dashboard markup
│   ├── style.css        # Responsive dark-theme styling
│   └── app.js           # UI logic, IPC bridge & vinyl renderer
├── build.bat            # MSVC compilation build script
└── README.md            # Project documentation
```

---

## 📝 License

Developed with ❤️ for maximum focus and aesthetic productivity.
