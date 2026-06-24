"use strict";
const BASE = '../assets/animations/menu animations/';
const clickSound = new Audio('../assets/Sounds/pop.mp3');

function playClickSound() {
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});
}

function setupButton(id, idleSrc, clickSrc, onClick) {
  const el = document.getElementById(id);
  if (!el) return;

  el.src = idleSrc;

  el.addEventListener('mousedown', () => {
    if (clickSrc) el.src = clickSrc;
    el.classList.add('pressed');
  });

  const restore = () => {
    el.src = idleSrc;
    el.classList.remove('pressed');
  };

  el.addEventListener('mouseup', () => {
    restore();
    playClickSound();
    onClick?.();
  });

  el.addEventListener('mouseleave', restore);
  el.addEventListener('touchend', () => {
    restore();
    playClickSound();
    onClick?.();
  });
}

function openPopup(popupId) {
  const popup = document.getElementById(popupId);
  if (popup) popup.classList.add('visible');
}

function closePopup(popupId) {
  const popup = document.getElementById(popupId);
  if (popup) popup.classList.remove('visible');
}

const QUESTS = {
  easy: [
    { id: 'win1', name: 'First Victory', desc: 'Win 1 game', target: 1, reward: 50 },
    { id: 'points200', name: 'Point Collector', desc: 'Earn 200 points in a game', target: 200, reward: 50 },
    { id: 'medium1', name: 'Medium Challenge', desc: 'Win 1 Medium difficulty game', target: 1, reward: 75 },
  ],
  medium: [
    { id: 'win5', name: 'Win Streak', desc: 'Win 5 games', target: 5, reward: 150 },
    { id: 'points1000', name: 'High Scorer', desc: 'Earn 1000 points in a game', target: 1000, reward: 150 },
    { id: 'booster3', name: 'Booster Master', desc: 'Use 3 boosters total', target: 3, reward: 100 },
  ],
  hard: [
    { id: 'win10', name: 'Legend', desc: 'Win 10 games', target: 10, reward: 300 },
    { id: 'points2500', name: 'Mega Score', desc: 'Earn 2500 points in a game', target: 2500, reward: 300 },
    { id: 'hard5', name: 'Fearless', desc: 'Win 5 Hard difficulty games', target: 5, reward: 250 },
  ],
};

function getDailyQuests() {
  const today = new Date().toDateString();
  const saved = localStorage.getItem('questsDate');
  const savedQuests = localStorage.getItem('dailyQuests');

  if (saved !== today) {
    localStorage.setItem('questsDate', today);
    const daily = [];
    Object.keys(QUESTS).forEach(tier => {
      daily.push(QUESTS[tier][Math.floor(Math.random() * QUESTS[tier].length)]);
    });
    localStorage.setItem('dailyQuests', JSON.stringify(daily.map(q => q.id)));
    localStorage.setItem('questProgress', JSON.stringify({}));
    return daily;
  }

  const questIds = JSON.parse(savedQuests || '[]');
  const daily = [];
  questIds.forEach(id => {
    Object.values(QUESTS).forEach(tier => {
      const q = tier.find(quest => quest.id === id);
      if (q) daily.push(q);
    });
  });
  return daily;
}

function renderQuests() {
  const quests = getDailyQuests();
  const progress = JSON.parse(localStorage.getItem('questProgress') || '{}');

  const html = quests.map(quest => {
    const current = progress[quest.id] || 0;
    const percent = Math.min(100, (current / quest.target) * 100);
    const completed = current >= quest.target;
    const tier = Object.keys(QUESTS).find(t => QUESTS[t].some(q => q.id === quest.id));

    return `
      <div class="quest-item ${completed ? 'quest-completed' : ''}">
        <h3>
          🎯 ${quest.name}
          <span class="quest-difficulty ${tier}">${tier.toUpperCase()}</span>
        </h3>
        <p class="quest-description">${quest.desc}</p>
        <div class="quest-progress-container">
          <div class="quest-progress-bar">
            <div class="quest-progress-fill" style="width: ${percent}%">
              ${percent > 5 ? `${Math.floor(percent)}%` : ''}
            </div>
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 2px;">${current} / ${quest.target}</div>
        </div>
        <div class="quest-reward">💰 ${quest.reward} coins ${completed ? '✓' : ''}</div>
      </div>
    `;
  }).join('');

  const container = document.getElementById('quests-container');
  if (container) container.innerHTML = html || '<p style="color:#666;text-align:center;">No quests available</p>';
}

function updateLevelInfo() {
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const nextLevel = currentLevel + 1;
  const winsPerLevel = 3;
  const currentLevelWins = parseInt(localStorage.getItem(`levelWins_${currentLevel}`) || '0');
  const winsUntilNext = Math.max(0, winsPerLevel - currentLevelWins);
  const progress = (currentLevelWins / winsPerLevel) * 100;

  document.getElementById('level-number-popup').textContent = String(currentLevel);
  document.getElementById('level-progress-bar').style.width = Math.min(100, progress) + '%';
  document.getElementById('wins-until-level').textContent = String(winsUntilNext);
}

document.addEventListener('DOMContentLoaded', () => {
  renderQuests();
  const level = parseInt(localStorage.getItem('candyLevel') || '1');
  const levelEl = document.getElementById('level-number');
  if (levelEl) {
    levelEl.textContent = String(level);
    levelEl.addEventListener('click', () => {
      updateLevelInfo();
      openPopup('popup-level');
    });
  }

  document.getElementById('popup-level')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-level') closePopup('popup-level');
  });

  setupButton('btn-play',     BASE + 'play_idle.png',     null,                            () => openPopup('popup-difficulty'));
  setupButton('btn-settings', BASE + 'settings_idle.png', null,                            () => openPopup('popup-settings'));
  setupButton('btn-home',     BASE + 'home_idle.png',     null,                            () => window.location.href = 'inventory.html');
  setupButton('btn-quests',   BASE + 'quests_idle.png',   null,                            () => { renderQuests(); openPopup('popup-quests'); });
  setupButton('btn-shop',     BASE + 'shop_idle.png',     null,                            () => window.location.href = 'shop.html');

  document.getElementById('popup-settings')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-settings') closePopup('popup-settings');
  });

  document.getElementById('popup-quests')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-quests') closePopup('popup-quests');
  });

  // Close buttons
  document.querySelectorAll('.popup-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      playClickSound();
      const popup = e.target.closest('.popup');
      if (popup) closePopup(popup.id);
    });
  });

  // Difficulty selection
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClickSound();
      const difficulty = btn.dataset.difficulty;
      window.location.href = `../index.html?autostart=1&difficulty=${difficulty}`;
    });
  });

  // Make floating items bump away from cursor
  let mouseX = 0;
  let mouseY = 0;
  const REPULSION_RADIUS = 120;
  const REPULSION_FORCE = 30;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    document.querySelectorAll('.draggable-item').forEach(item => {
      const rect = item.getBoundingClientRect();
      const itemX = rect.left + rect.width / 2;
      const itemY = rect.top + rect.height / 2;

      const dx = itemX - mouseX;
      const dy = itemY - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < REPULSION_RADIUS) {
        const angle = Math.atan2(dy, dx);
        const force = (REPULSION_RADIUS - distance) / REPULSION_RADIUS * REPULSION_FORCE;
        const moveX = Math.cos(angle) * force;
        const moveY = Math.sin(angle) * force;

        item.style.transform = `translate(${moveX}px, ${moveY}px)`;
      } else {
        item.style.transform = 'translate(0, 0)';
      }
    });
  });

});
