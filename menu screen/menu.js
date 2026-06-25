"use strict";
const BASE = '../assets/animations/menu animations/';
const clickSound = new Audio('../assets/Sounds/pop.mp3');

function playClickSound() {
  if (localStorage.getItem('soundEnabled') === 'false') return;
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

function updateLevelDisplay() {
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const levelWinsKey = `levelWins_${currentLevel}`;
  const currentLevelWins = parseInt(localStorage.getItem(levelWinsKey) || '0');
  const winsPerLevel = 3;

  const levelDisplay = document.getElementById('level-number-display');
  if (levelDisplay) levelDisplay.textContent = String(currentLevel);

  const progressPercent = Math.min(100, (currentLevelWins / winsPerLevel) * 100);
  const progressFill = document.getElementById('level-progress-fill');
  if (progressFill) {
    progressFill.style.width = progressPercent + '%';
  }
}

function updateLevelPopup() {
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const levelWinsKey = `levelWins_${currentLevel}`;
  const currentLevelWins = parseInt(localStorage.getItem(levelWinsKey) || '0');
  const winsPerLevel = 3;

  document.getElementById('level-popup-number').textContent = String(currentLevel);
  document.getElementById('level-popup-wins').textContent = String(currentLevelWins);
  document.getElementById('level-popup-next').textContent = String(currentLevel + 1);

  const progressPercent = Math.min(100, (currentLevelWins / winsPerLevel) * 100);
  const progressBar = document.getElementById('level-popup-progress');
  if (progressBar) {
    progressBar.style.width = progressPercent + '%';
  }
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
  const winsPerLevel = 3;
  const currentLevelWins = parseInt(localStorage.getItem(`levelWins_${currentLevel}`) || '0');
  const winsUntilNext = Math.max(0, winsPerLevel - currentLevelWins);
  const progress = (currentLevelWins / winsPerLevel) * 100;

  document.getElementById('level-number-popup').textContent = String(currentLevel);
  document.getElementById('level-progress-bar').style.width = Math.min(100, progress) + '%';
  document.getElementById('wins-until-level').textContent = String(winsUntilNext);
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize animated background
  if (window.BgSystem) {
    window.BgSystem.init();
    const selectedBgId = localStorage.getItem('candySelectedBg');
    const bgMap = {
      'bg_lush_meadow': 0,
      'bg_autumn_garden': 1,
      'bg_morning_dew': 2,
      'bg_shaded_grove': 3,
      'bg_sunlit_garden': 4,
      'bg_wildflower_patch': 5
    };
    const bgIdx = selectedBgId && bgMap[selectedBgId] !== undefined ? bgMap[selectedBgId] : 0;
    window.BgSystem.start(bgIdx);
  }

  // Upper zone: fast insects, doves, feathers, floating leaves
  const upperTypes = ['🐝','🦗','🐝','🦗','🕊️','🪶','🌿','🐝','🦗','🐝','🦗','🕊️','🪶','🌿','🐝'];
  const upperClass = {'🐝':'bee','🦗':'bee','🕊️':'petal','🪶':'petal','🌿':'petal'};
  for (let i = 0; i < upperTypes.length; i++) {
    const p = document.createElement('div');
    const type = upperTypes[i];
    p.className = `particle-upper ${upperClass[type] || 'bee'}`;
    p.textContent = type;
    p.style.left = (i / upperTypes.length * 92 + Math.random() * 6) + 'vw';
    p.style.top = (Math.random() * 38) + 'vh';
    p.style.setProperty('--seed', i);
    document.body.appendChild(p);
  }

  // Lower zone: ground insects, leaves, seedlings, rocks
  const lowerTypes = ['🍃','🐛','🪲','🐌','🌿','🐜','🍃','🐛','🪲','🐌','🌱','🐜','🕷️','🪨','🍃','🐛','🐜','🌱'];
  const lowerClass = {'🍃':'leaf','🐛':'beetle','🪲':'beetle','🐌':'snail','🌿':'leaf','🐜':'beetle','🌱':'leaf','🕷️':'beetle','🪨':'leaf'};
  for (let i = 0; i < lowerTypes.length; i++) {
    const p = document.createElement('div');
    const type = lowerTypes[i];
    p.className = `particle-lower ${lowerClass[type] || 'leaf'}`;
    p.textContent = type;
    p.style.left = (i / lowerTypes.length * 92 + Math.random() * 6) + 'vw';
    p.style.top = (72 + Math.random() * 22) + 'vh';
    p.style.setProperty('--seed', i);
    document.body.appendChild(p);
  }

  renderQuests();

  updateLevelDisplay();

  // Level info display click handler
  document.getElementById('level-info-display')?.addEventListener('click', () => {
    openPopup('popup-level-info');
    updateLevelPopup();
  });

  document.getElementById('popup-level-info')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-level-info') closePopup('popup-level-info');
  });

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.checked = localStorage.getItem('soundEnabled') !== 'false';
    soundToggle.addEventListener('change', () => {
      localStorage.setItem('soundEnabled', soundToggle.checked ? 'true' : 'false');
    });
  }

  const musicToggle = document.getElementById('music-toggle');
  if (musicToggle) {
    musicToggle.checked = localStorage.getItem('musicEnabled') !== 'false';
    musicToggle.addEventListener('change', () => {
      localStorage.setItem('musicEnabled', musicToggle.checked ? 'true' : 'false');
    });
  }
  const levelDisplay = document.getElementById('level-display');
  if (levelDisplay) {
    levelDisplay.addEventListener('click', () => {
      updateLevelInfo();
      openPopup('popup-level');
    });
  }

  document.getElementById('popup-level')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-level') closePopup('popup-level');
  });

  // New animated play button
  document.getElementById('btn-play')?.addEventListener('click', () => {
    playClickSound();
    openPopup('popup-difficulty');
  });
  setupButton('btn-settings', BASE + 'settings_idle.png', null,                            () => openPopup('popup-settings'));
  setupButton('btn-home',     BASE + 'home_idle.png',     null,                            () => setTimeout(() => window.location.href = 'inventory.html', 200));
  setupButton('btn-quests',   BASE + 'quests_idle.png',   null,                            () => { renderQuests(); openPopup('popup-quests'); });
  setupButton('btn-shop',     BASE + 'shop_idle.png',     null,                            () => setTimeout(() => window.location.href = 'shop.html', 200));

  document.getElementById('popup-settings')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-settings') closePopup('popup-settings');
  });

  document.getElementById('popup-quests')?.addEventListener('click', (e) => {
    if (e.target.id === 'popup-quests') closePopup('popup-quests');
  });

  // Close buttons
  document.querySelectorAll('.popup-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const popup = e.target.closest('.popup');
      const silent = ['popup-quests', 'popup-settings', 'popup-level'];
      if (popup && !silent.includes(popup.id)) playClickSound();
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

});
