// Timer Manager for Game
// Usage: const timer = new GameTimer(duration, onTick, onExpire);

class GameTimer {
  constructor(durationSeconds, onTick, onExpire) {
    this.duration = durationSeconds;
    this.remaining = durationSeconds;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.interval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.interval = setInterval(() => {
      this.remaining--;
      if (this.onTick) this.onTick(this.remaining);

      if (this.remaining <= 0) {
        this.stop();
        if (this.onExpire) this.onExpire();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
  }

  pause() {
    this.stop();
  }

  resume() {
    this.start();
  }
}

// Create timer UI element
function createTimerDisplay() {
  const timer = document.createElement('div');
  timer.id = 'game-timer';
  timer.className = 'game-timer';
  timer.innerHTML = `
    <div class="timer-content">
      <div class="timer-label">TIME</div>
      <div class="timer-value">0:00</div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #game-timer {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 5px solid #2d7a3e;
      border-radius: 20px;
      padding: 20px 50px;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .timer-content {
      text-align: center;
      color: #fff;
    }

    .timer-label {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #4ade80;
      margin-bottom: 8px;
      text-transform: uppercase;
      text-shadow: 0 3px 6px rgba(0, 0, 0, 0.9);
    }

    .timer-value {
      font-size: 72px;
      font-weight: 900;
      font-family: 'Courier New', monospace;
      letter-spacing: 6px;
      color: #fff;
      text-shadow: 0 6px 12px rgba(0, 0, 0, 0.9), 0 0 20px rgba(45, 122, 62, 0.6);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1;
    }

    #game-timer.warning {
      border-color: #ff4444;
      background: linear-gradient(135deg, #2d1a1a 0%, #3d2d2d 100%);
      animation: timer-flash 0.4s infinite;
    }

    #game-timer.warning .timer-label {
      color: #ff6b6b;
      animation: label-pulse 0.4s infinite;
    }

    #game-timer.warning .timer-value {
      color: #ffcccc;
    }

    @keyframes timer-flash {
      0%, 100% { box-shadow: 0 0 0 rgba(255, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
      50% { box-shadow: 0 0 30px rgba(255, 68, 68, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
    }

    @keyframes label-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* 10 Second Warning */
    #warning-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 200;
      background: linear-gradient(135deg, #ff4444 0%, #cc2222 100%);
      border: 4px solid #ffaaaa;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 0 60px rgba(255, 68, 68, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.3);
      animation: popup-appear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
    }

    #warning-popup.hide {
      animation: popup-disappear 0.3s ease-out forwards;
    }

    .warning-text {
      font-size: 64px;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 0, 0, 0.4);
      letter-spacing: 2px;
      margin: 0;
      animation: warning-bounce 0.6s ease-out;
    }

    .warning-subtext {
      font-size: 24px;
      font-weight: 700;
      color: #ffdddd;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      letter-spacing: 1px;
      margin: 12px 0 0 0;
      animation: subtext-slide 0.5s ease-out;
    }

    @keyframes popup-appear {
      0% {
        transform: translate(-50%, -50%) scale(0.5) rotateX(90deg);
        opacity: 0;
      }
      100% {
        transform: translate(-50%, -50%) scale(1) rotateX(0deg);
        opacity: 1;
      }
    }

    @keyframes popup-disappear {
      0% {
        transform: translate(-50%, -50%) scale(1) rotateX(0deg);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(0.8) rotateX(-90deg);
        opacity: 0;
      }
    }

    @keyframes warning-bounce {
      0% {
        transform: scale(0.3) rotateY(-90deg);
        opacity: 0;
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1) rotateY(0deg);
        opacity: 1;
      }
    }

    @keyframes subtext-slide {
      0% {
        transform: translateY(-20px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* 10 Seconds Flashing Warning */
    #timer-warning {
      position: fixed;
      top: 110px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99;
      font-size: 48px;
      font-weight: 900;
      color: #ff3333;
      text-shadow: 0 0 30px rgba(255, 50, 50, 0.9), 0 4px 12px rgba(0, 0, 0, 0.9);
      letter-spacing: 3px;
      pointer-events: none;
      animation: warning-flash 0.5s infinite;
    }

    @keyframes warning-flash {
      0%, 100% {
        opacity: 1;
        transform: translateX(-50%) scale(1);
      }
      50% {
        opacity: 0.4;
        transform: translateX(-50%) scale(0.95);
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(timer);

  return timer;
}

// Format seconds to MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Show 10 second warning
function show10SecondWarning() {
  let popup = document.getElementById('warning-popup');

  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'warning-popup';
    popup.innerHTML = `
      <p class="warning-text">10 SECONDS!</p>
      <p class="warning-subtext">⏱️ TIME'S RUNNING OUT ⏱️</p>
    `;
    document.body.appendChild(popup);
  } else {
    popup.classList.remove('hide');
  }

  // Show top warning text
  let topWarning = document.getElementById('timer-warning');
  if (!topWarning) {
    topWarning = document.createElement('div');
    topWarning.id = 'timer-warning';
    topWarning.textContent = '⚠️ 10 SECONDS LEFT! ⚠️';
    document.body.appendChild(topWarning);
  }

  // Auto-hide popup after 2 seconds, but keep top warning flashing
  setTimeout(() => {
    popup.classList.add('hide');
  }, 2000);
}

// Start game with difficulty
function startGameWithDifficulty() {
  const params = new URLSearchParams(window.location.search);
  const difficulty = params.get('difficulty') || 'medium';

  const durations = {
    easy: 120,
    medium: 90,
    hard: 60
  };

  const duration = durations[difficulty];
  const timerEl = createTimerDisplay();
  let tenSecondWarningShown = false;

  const timer = new GameTimer(
    duration,
    (remaining) => {
      // Update display
      timerEl.querySelector('.timer-value').textContent = formatTime(remaining);

      // Flash red in last 10 seconds
      if (remaining <= 10) {
        timerEl.classList.add('warning');

        // Create warning text if it doesn't exist
        if (!document.getElementById('timer-warning')) {
          const topWarning = document.createElement('div');
          topWarning.id = 'timer-warning';
          topWarning.textContent = '⚠️ 10 SECONDS LEFT! ⚠️';
          document.body.appendChild(topWarning);
        }

        // Show dramatic popup at exactly 10 seconds
        if (remaining === 10 && !tenSecondWarningShown) {
          tenSecondWarningShown = true;
          show10SecondWarning();
        }
      } else {
        timerEl.classList.remove('warning');
        // Remove warning text when above 10 seconds
        const warning = document.getElementById('timer-warning');
        if (warning && remaining > 10) {
          warning.remove();
        }
      }
    },
    () => {
      // Timer expired
      console.log('Game Over - Time Expired!');
      // Call your game over logic here
    }
  );

  timer.start();
  return timer;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameTimer, createTimerDisplay, formatTime, startGameWithDifficulty };
}
