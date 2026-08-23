// FocusGrow In-Page Floating Pass Timer Widget

(function () {
  let timerWidget = null;
  let timerTextSpan = null;

  function createWidget() {
    if (timerWidget) return;

    timerWidget = document.createElement('div');
    timerWidget.id = 'focusgrow-pass-pill';
    timerWidget.style.cssText = `
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      z-index: 2147483647 !important;
      background: rgba(15, 23, 42, 0.88) !important;
      backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(16, 185, 129, 0.4) !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.2) !important;
      border-radius: 24px !important;
      padding: 6px 14px !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
      color: #f8fafc !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      user-select: none !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    `;

    timerWidget.innerHTML = `
      <span id="fg-pulse-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; animation: fgPulse 1.5s infinite;"></span>
      <span id="fg-label" style="color: #10b981; font-weight: 700;">⚡ PASS:</span>
      <span id="fg-pass-countdown" style="font-family: monospace; font-size: 13px; font-weight: 700; color: #f8fafc;">00:00</span>
      <span id="fg-btn-close-pill" style="cursor: pointer; opacity: 0.5; margin-left: 4px; font-size: 14px; line-height: 1;" title="Hide Floating Widget">&times;</span>
    `;

    // Add CSS keyframe animation for pulsing dot
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fgPulse {
        0% { opacity: 0.4; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.1); }
        100% { opacity: 0.4; transform: scale(0.9); }
      }
      #focusgrow-pass-pill:hover {
        transform: translateY(-2px);
        border-color: rgba(16, 185, 129, 0.7) !important;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(timerWidget);

    timerTextSpan = timerWidget.querySelector('#fg-pass-countdown');
    timerWidget.querySelector('#fg-btn-close-pill').addEventListener('click', () => {
      timerWidget.style.display = 'none';
    });
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Listen for pass updates from background service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PASS_STATUS_UPDATE') {
      if (msg.isPassActive && msg.remainingSec > 0) {
        if (!timerWidget) createWidget();
        if (timerWidget) {
          timerWidget.style.display = 'flex';
          const labelSpan = timerWidget.querySelector('#fg-label');
          const dotSpan = timerWidget.querySelector('#fg-pulse-dot');

          if (labelSpan) labelSpan.textContent = `⚡ ${msg.label || 'PASS'}:`;

          if (msg.label === "LIMIT") {
             if (labelSpan) labelSpan.style.color = "#38bdf8";
             if (dotSpan) {
                dotSpan.style.background = "#38bdf8";
                dotSpan.style.boxShadow = "0 0 8px #38bdf8";
             }
          } else {
             if (labelSpan) labelSpan.style.color = "#10b981";
             if (dotSpan) {
                dotSpan.style.background = "#10b981";
                dotSpan.style.boxShadow = "0 0 8px #10b981";
             }
          }

          if (timerTextSpan) {
            timerTextSpan.textContent = formatTime(msg.remainingSec);
            if (msg.remainingSec <= 60) {
              timerWidget.style.borderColor = 'rgba(239, 68, 68, 0.8)';
              timerTextSpan.style.color = '#ef4444';
            } else {
              timerWidget.style.borderColor = msg.label === "LIMIT" ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.4)';
              timerTextSpan.style.color = '#f8fafc';
            }
          }
        }
      } else {
        if (timerWidget) timerWidget.style.display = 'none';
      }
    }
  });
})();
