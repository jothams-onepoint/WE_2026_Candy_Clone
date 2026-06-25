"use strict";
const BASE = '../assets/animations/menu animations/';
const clickSound = new Audio('../assets/Sounds/pop.mp3');

function showLevelUpFlourish(oldLevel, newLevel, coinsEarned, isMilestone) {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fHoverCenter {
      0%, 100% { transform: translate(-50%,-50%) scale(1); }
      50%       { transform: translate(-50%,calc(-50% - 7px)) scale(1.02); }
    }
    @keyframes fShakeCenter {
      0%,100% { transform: translate(-50%,-50%) rotate(0deg) scale(1); }
      12%  { transform: translate(calc(-50% - 14px),calc(-50% - 6px)) rotate(-4deg) scale(1.04); }
      28%  { transform: translate(calc(-50% + 14px),calc(-50% + 5px)) rotate( 4deg) scale(0.96); }
      44%  { transform: translate(calc(-50% - 10px),calc(-50% - 3px)) rotate(-2deg) scale(1.02); }
      60%  { transform: translate(calc(-50% + 10px),calc(-50% + 3px)) rotate( 2deg) scale(0.98); }
      76%  { transform: translate(calc(-50% -  5px),-50%) rotate(-1deg); }
      90%  { transform: translate(calc(-50% +  5px),-50%) rotate( 1deg); }
    }
    @keyframes fExplodeCenter {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 1; filter: brightness(1); }
      30%  { transform: translate(-50%,-50%) scale(1.8); opacity: 0.8; filter: brightness(4) blur(1px); }
      100% { transform: translate(-50%,-50%) scale(6);   opacity: 0;  filter: brightness(10) blur(16px); }
    }
    @keyframes fParticle {
      0%   { transform: translate(0,0) scale(1); opacity: 1; }
      80%  { opacity: 0.5; }
      100% { transform: translate(var(--px),var(--py)) scale(0); opacity: 0; }
    }
    @keyframes fPopupIn {
      0%   { transform: translate(-50%,-50%) translateY(90px) scale(0.78); opacity: 0; }
      60%  { transform: translate(-50%,-50%) translateY(-18px) scale(1.04); opacity: 1; }
      80%  { transform: translate(-50%,-50%) translateY(7px) scale(0.99); }
      100% { transform: translate(-50%,-50%) translateY(0) scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0);backdrop-filter:blur(0px);transition:background 0.5s ease,backdrop-filter 0.5s ease;`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.background = 'rgba(0,0,0,0.84)';
    overlay.style.backdropFilter = 'blur(4px)';
  }));

  const levelNumEl = document.getElementById('level-number-display');
  const infoEl = document.getElementById('level-info-display');

  // Get start position (center of level bar display)
  const startRect = (levelNumEl || infoEl)?.getBoundingClientRect();
  const startX = startRect ? startRect.left + startRect.width / 2 : window.innerWidth / 2;
  const startY = startRect ? startRect.top + startRect.height / 2 : 80;

  function mkEl(css) {
    const e = document.createElement('div');
    e.style.cssText = css;
    document.body.appendChild(e);
    return e;
  }

  function numStyle(color, extra) {
    return `position:fixed;font-family:Fredoka,sans-serif;font-weight:900;
      font-size:clamp(80px,20vmin,160px);letter-spacing:-2px;
      color:${color};pointer-events:none;z-index:6001;
      ${extra || ''}`;
  }

  // Track all created elements for cleanup
  const flourishEls = [];

  let cancelled = false;
  function cancelFlourish() {
    if (cancelled) return;
    cancelled = true;
    flourishEls.forEach(el => { try { el.remove(); } catch(_) {} });
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.opacity = '0';
    setTimeout(() => { try { overlay.remove(); style.remove(); } catch(_) {} }, 260);
  }

  setTimeout(() => {
    if (cancelled) return;
    const CX = window.innerWidth / 2;
    const CY = window.innerHeight / 2;
    const offX = startX - CX;
    const offY = startY - CY;

    // Old number: start at bar position (via transform offset from screen center), transition to center
    const oldEl = mkEl(numStyle('#ffffff',
      `left:${CX}px;top:${CY}px;
       transform:translate(calc(-50% + ${offX}px),calc(-50% + ${offY}px)) scale(0.3);
       opacity:0;filter:blur(10px);
       text-shadow:0 0 50px rgba(255,255,255,0.35),0 8px 30px rgba(0,0,0,1);
       transition:transform 0.65s cubic-bezier(0.34,1.3,0.64,1),opacity 0.6s,filter 0.6s;`
    ));
    oldEl.textContent = String(oldLevel);
    flourishEls.push(oldEl);

    // Rise to center
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      oldEl.style.transform = 'translate(-50%,-50%) scale(1)';
      oldEl.style.opacity = '1';
      oldEl.style.filter = 'blur(0)';
    }));

    // Hover at center
    setTimeout(() => {
      if (cancelled) return;
      oldEl.style.transition = 'none';
      oldEl.style.animation = 'fHoverCenter 0.48s ease-in-out 1';
    }, 780);

    // Shake
    setTimeout(() => {
      if (cancelled) return;
      oldEl.style.animation = 'fShakeCenter 0.5s ease-in-out forwards';
    }, 1260);

    // Explode → particles + gold number at same center
    setTimeout(() => {
      if (cancelled) return;
      const CX2 = window.innerWidth / 2;
      const CY2 = window.innerHeight / 2;

      oldEl.style.animation = 'fExplodeCenter 0.42s ease-in forwards';

      // Particles from screen center
      const emojis = ['✨','⭐','💫','🌟','🎊','🎉','💥','🔆','⚡'];
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist  = 100 + Math.random() * 270;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        const size = (16 + Math.random() * 20).toFixed(0);
        const dur  = (0.7 + Math.random() * 0.55).toFixed(2);
        const del  = (Math.random() * 0.08).toFixed(2);
        const p = mkEl(`position:fixed;left:${CX2}px;top:${CY2}px;
          transform:translate(-50%,-50%);
          font-size:${size}px;pointer-events:none;z-index:6002;
          --px:${px}px;--py:${py}px;
          animation:fParticle ${dur}s ease-out ${del}s forwards;`);
        p.textContent = emojis[i % emojis.length];
        flourishEls.push(p);
        setTimeout(() => p.remove(), (parseFloat(dur) + parseFloat(del)) * 1000 + 150);
      }

      // Gold number at EXACT same pixel center as old number
      const goldEl = mkEl(numStyle('#ffd700',
        `left:${CX2}px;top:${CY2}px;
         transform:translate(-50%,-50%) scale(0.05);
         opacity:0;filter:blur(25px);
         text-shadow:0 0 100px rgba(255,215,0,1),0 0 50px rgba(255,165,0,0.8),0 8px 30px rgba(0,0,0,1);
         transition:transform 0.62s cubic-bezier(0.34,1.4,0.64,1),opacity 0.58s,filter 0.58s;`
      ));
      goldEl.textContent = String(newLevel);
      flourishEls.push(goldEl);

      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return;
        goldEl.style.transform = 'translate(-50%,-50%) scale(1)';
        goldEl.style.opacity = '1';
        goldEl.style.filter = 'blur(0)';
      }));
      setTimeout(() => oldEl.remove(), 500);

      // Gold number shines for a moment, then fades out as popup appears
      setTimeout(() => {
        if (cancelled) return;
        goldEl.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
        goldEl.style.opacity = '0';
        goldEl.style.transform = 'translate(-50%,-50%) scale(1.35)';

        // Update level bar quietly in the background
        if (levelNumEl) levelNumEl.textContent = String(newLevel);
        const fill = document.getElementById('level-progress-fill');
        if (fill) fill.style.width = '0%';

        setTimeout(() => {
          if (cancelled) return;
          goldEl.remove();
          overlay.style.transition = 'background 0.4s ease';
          overlay.style.background = 'rgba(8,4,22,0.9)';
          setTimeout(() => {
            if (cancelled) return;
            showLevelUpPopup(oldLevel, newLevel, coinsEarned, isMilestone, overlay, style);
          }, 280);
        }, 580);
      }, 1200);

    }, 1760); // after shake (1260+500)
  }, 350);
}

function showLevelUpPopup(oldLevel, newLevel, coinsEarned, isMilestone, overlay, flourishStyle) {
  const multiplier = newLevel >= 20 ? '3x' : newLevel >= 10 ? '2x' : null;

  const popup = document.createElement('div');
  popup.style.cssText = `
    position:fixed;left:50%;top:50%;z-index:6002;
    background:linear-gradient(145deg,#0b0b1e 0%,#18102e 50%,#0c1a2e 100%);
    border:2px solid #ffd700;border-radius:28px;
    padding:clamp(26px,5vmin,46px) clamp(22px,6vw,54px);
    min-width:clamp(270px,68vw,400px);max-width:92vw;text-align:center;
    box-shadow:0 0 90px rgba(255,215,0,0.25),0 0 30px rgba(255,165,0,0.12),0 28px 80px rgba(0,0,0,0.95);
    animation:fPopupIn 0.72s cubic-bezier(0.34,1.56,0.64,1) forwards;
    font-family:Fredoka,sans-serif;color:white;
  `;
  popup.innerHTML = `
    <div style="font-size:clamp(10px,1.8vmin,13px);letter-spacing:5px;color:#666;margin-bottom:8px;font-weight:700;">ACHIEVEMENT UNLOCKED</div>
    <div style="font-size:clamp(26px,6.5vmin,48px);font-weight:900;color:#ffd700;letter-spacing:1px;margin-bottom:6px;text-shadow:0 0 40px rgba(255,215,0,0.55);">⬆ LEVEL UP!</div>
    <div style="font-size:clamp(14px,2.8vmin,19px);color:#bbb;margin-bottom:28px;">
      You are now <span style="color:#ffd700;font-weight:900;font-size:1.25em;">${newLevel}</span>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px 20px;margin-bottom:26px;text-align:left;">
      <div style="font-size:clamp(10px,1.6vmin,12px);letter-spacing:4px;color:#555;margin-bottom:12px;font-weight:700;">REWARDS</div>
      <div style="font-size:clamp(13px,2.3vmin,15px);color:#ddd;line-height:2.1;">
        💰&nbsp; <strong style="color:#ffd700;">${coinsEarned}</strong> coins earned
        ${multiplier ? `<br>📈&nbsp; Coin multiplier unlocked: <strong style="color:#ffd700;">${multiplier}</strong>` : ''}
        ${isMilestone ? `<br>🎉&nbsp; <strong style="color:#7af0b0;">Milestone bonus — double coins!</strong>` : ''}
      </div>
    </div>
    <button id="flourish-claim-btn" style="
      background:linear-gradient(135deg,#ffd700 0%,#ff8c00 100%);
      color:#1a0e00;border:none;border-radius:50px;
      padding:clamp(11px,1.8vmin,15px) clamp(30px,6vw,52px);
      font-size:clamp(13px,2.4vmin,17px);font-weight:900;
      font-family:Fredoka,sans-serif;cursor:pointer;letter-spacing:1px;
      box-shadow:0 6px 30px rgba(255,180,0,0.45);
      transition:transform 0.12s,box-shadow 0.12s;
    ">✓&nbsp; CLAIM REWARDS</button>
  `;
  document.body.appendChild(popup);

  const btn = document.getElementById('flourish-claim-btn');
  btn.addEventListener('mouseenter', () => { btn.style.transform='scale(1.07)'; btn.style.boxShadow='0 10px 44px rgba(255,180,0,0.7)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform='scale(1)'; btn.style.boxShadow='0 6px 30px rgba(255,180,0,0.45)'; });
  btn.addEventListener('click', () => {
    popup.style.animation = 'none';
    popup.style.transform = 'translate(-50%,-50%)';
    void popup.offsetWidth;
    popup.style.transition = 'transform 0.3s ease,opacity 0.3s ease';
    popup.style.transform = 'translate(-50%,-50%) scale(0.88)';
    popup.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      popup.remove();
      overlay.remove();
      flourishStyle.remove();
      updateLevelDisplay();
    }, 420);
  });
}

function getWinsNeeded(level) {
  if (level <= 2) return 3;
  if (level <= 4) return 4;
  return 5;
}

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
  const winsPerLevel = getWinsNeeded(currentLevel);

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
  const winsPerLevel = getWinsNeeded(currentLevel);
  const nextLevel = currentLevel + 1;
  const isMilestone = nextLevel % 5 === 0;

  document.getElementById('level-popup-number').textContent = String(currentLevel);
  document.getElementById('level-popup-wins').textContent = String(currentLevelWins);
  document.getElementById('level-popup-wins-needed').textContent = String(winsPerLevel);
  document.getElementById('level-popup-next').textContent = String(nextLevel);

  const progressPercent = Math.min(100, (currentLevelWins / winsPerLevel) * 100);
  const progressBar = document.getElementById('level-popup-progress');
  if (progressBar) {
    progressBar.style.width = progressPercent + '%';
  }

  const rewardEl = document.getElementById('level-popup-rewards');
  if (rewardEl) {
    let rewardText = `<strong>Level ${nextLevel} Rewards:</strong><br>`;
    rewardText += `💰 Coin multiplier: ${nextLevel >= 20 ? '3x' : (nextLevel >= 10 ? '2x' : '1x')}<br>`;
    if (isMilestone) {
      rewardText += `🎉 <span style="color:#7af0b0;">MILESTONE BONUS: Double coins!</span>`;
    }
    rewardEl.innerHTML = rewardText;
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

function claimQuestReward(questId) {
  const coins = parseInt(localStorage.getItem('candyCoins') || '0');
  const quest = Object.values(QUESTS).flat().find(q => q.id === questId);
  if (!quest) return;
  const claimed = JSON.parse(localStorage.getItem('questsClaimed') || '{}');
  if (claimed[questId]) return;
  localStorage.setItem('candyCoins', String(coins + quest.reward));
  claimed[questId] = true;
  localStorage.setItem('questsClaimed', JSON.stringify(claimed));
  renderQuests();
}

function refreshQuests() {
  localStorage.removeItem('dailyQuests');
  localStorage.removeItem('questProgress');
  localStorage.removeItem('questsClaimed');
  localStorage.setItem('questsDate', '');
  renderQuests();
}

function renderQuests() {
  const quests = getDailyQuests();
  const progress = JSON.parse(localStorage.getItem('questProgress') || '{}');
  const claimed = JSON.parse(localStorage.getItem('questsClaimed') || '{}');

  const html = quests.map(quest => {
    const current = progress[quest.id] || 0;
    const percent = Math.min(100, (current / quest.target) * 100);
    const completed = current >= quest.target;
    const isClaimed = claimed[quest.id];
    const tier = Object.keys(QUESTS).find(t => QUESTS[t].some(q => q.id === quest.id));

    const rewardBtn = completed && !isClaimed
      ? `<button class="quest-claim-btn" data-quest-id="${quest.id}" style="padding:8px 20px;background:#7af0b0;color:#0a0a0a;border:none;border-radius:6px;font-weight:700;cursor:pointer;transition:all 0.2s;font-size:12px;">Claim ${quest.reward}💰</button>`
      : isClaimed
      ? `<div class="quest-reward">Claimed ✓</div>`
      : `<div class="quest-reward">💰 ${quest.reward} coins</div>`;

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
        ${rewardBtn}
      </div>
    `;
  }).join('');

  const container = document.getElementById('quests-container');
  if (container) {
    const refreshBtn = `<button id="refresh-quests-btn" style="width:100%;padding:12px;background:#ff8c42;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-bottom:16px;transition:all 0.2s;font-size:13px;letter-spacing:1px;">🔄 REFRESH QUESTS</button>`;
    container.innerHTML = refreshBtn + (html || '<p style="color:#666;text-align:center;">No quests available</p>');
    document.getElementById('refresh-quests-btn')?.addEventListener('click', refreshQuests);
    document.getElementById('refresh-quests-btn')?.addEventListener('mouseenter', (e) => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 6px 20px rgba(255,140,66,0.6)'; });
    document.getElementById('refresh-quests-btn')?.addEventListener('mouseleave', (e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = 'none'; });
    container.querySelectorAll('.quest-claim-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.08)'; btn.style.boxShadow = '0 6px 20px rgba(122,240,176,0.6)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = 'none'; });
      btn.addEventListener('click', () => claimQuestReward(btn.dataset.questId));
    });
  }
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

  // Draggable particle system
  let draggedParticle = null;
  let dragOffsetX = 0, dragOffsetY = 0;
  function makeParticleDraggable(p, origX, origY) {
    p.style.cursor = 'grab';
    p.addEventListener('mousedown', (e) => {
      e.preventDefault();
      draggedParticle = p;
      const rect = p.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      p.style.animation = 'none';
      p.style.cursor = 'grabbing';
      p.style.zIndex = '9999';
      p.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.4)) scale(1.2)';
    });
  }
  document.addEventListener('mousemove', (e) => {
    if (!draggedParticle) return;
    draggedParticle.style.left = (e.clientX - dragOffsetX) + 'px';
    draggedParticle.style.top = (e.clientY - dragOffsetY) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (draggedParticle) {
      draggedParticle.style.cursor = 'grab';
      draggedParticle.style.zIndex = '1';
      draggedParticle.style.filter = 'none';
      draggedParticle = null;
    }
  });

  // Upper zone: fast insects, doves, feathers, floating leaves
  const upperTypes = ['🐝','🦗','🐝','🦗','🕊️','🪶','🌿','🐝','🦗','🐝','🦗','🕊️','🪶','🌿','🐝'];
  const upperClass = {'🐝':'bee','🦗':'bee','🕊️':'petal','🪶':'petal','🌿':'petal'};
  for (let i = 0; i < upperTypes.length; i++) {
    const p = document.createElement('div');
    const type = upperTypes[i];
    p.className = `particle-upper ${upperClass[type] || 'bee'}`;
    p.textContent = type;
    const left = i / upperTypes.length * 92 + Math.random() * 6;
    const top = Math.random() * 35;
    p.style.left = left + 'vw';
    p.style.top = top + 'vh';
    p.style.setProperty('--seed', i);
    document.body.appendChild(p);
    makeParticleDraggable(p, left, top);
  }

  // Lower zone: ground insects, leaves, seedlings, rocks
  const lowerTypes = ['🍃','🐛','🪲','🐌','🌿','🐜','🍃','🐛','🪲','🐌','🌱','🐜','🕷️','🪨','🍃','🐛','🐜','🌱'];
  const lowerClass = {'🍃':'leaf','🐛':'beetle','🪲':'beetle','🐌':'snail','🌿':'leaf','🐜':'beetle','🌱':'leaf','🕷️':'beetle','🪨':'leaf'};
  for (let i = 0; i < lowerTypes.length; i++) {
    const p = document.createElement('div');
    const type = lowerTypes[i];
    p.className = `particle-lower ${lowerClass[type] || 'leaf'}`;
    p.textContent = type;
    const left = i / lowerTypes.length * 92 + Math.random() * 6;
    const top = 72 + Math.random() * 20;
    p.style.left = left + 'vw';
    p.style.top = top + 'vh';
    p.style.setProperty('--seed', i);
    document.body.appendChild(p);
    makeParticleDraggable(p, left, top);
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

  // Check if a level-up happened during the last game session
  const rawPending = localStorage.getItem('pendingLevelUp');
  if (rawPending) {
    localStorage.removeItem('pendingLevelUp');
    try {
      const pending = JSON.parse(rawPending);
      setTimeout(() => showLevelUpFlourish(pending.oldLevel, pending.newLevel, pending.coinsEarned, pending.isMilestone), 400);
    } catch (e) {}
  }
  updateLevelDisplay();

  // New animated play button
  document.getElementById('btn-play')?.addEventListener('click', () => {
    playClickSound();
    openPopup('popup-difficulty');
  });
  setupButton('btn-settings', BASE + 'settings_idle.png', null,                            () => openPopup('popup-settings'));
  setupButton('btn-home',     BASE + 'home_idle.png',     null,                            () => { window.location.href = 'inventory.html'; });
  setupButton('btn-quests',   BASE + 'quests_idle.png',   null,                            () => { renderQuests(); openPopup('popup-quests'); });
  setupButton('btn-shop',     BASE + 'shop_idle.png',     null,                            () => { window.location.href = 'shop.html'; });

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

  // Background switch welcome toast
  const bgJustSwitched = sessionStorage.getItem('bgJustSwitched');
  if (bgJustSwitched) {
    sessionStorage.removeItem('bgJustSwitched');
    const BG_NAMES = {
      'bg_lush_meadow': 'Lush Meadow',
      'bg_autumn_garden': 'Autumn Garden',
      'bg_morning_dew': 'Morning Dew',
      'bg_shaded_grove': 'Shaded Grove',
      'bg_sunlit_garden': 'Sunlit Garden',
      'bg_wildflower_patch': 'Wildflower Patch'
    };
    setTimeout(() => {
      const toast = document.getElementById('bg-toast');
      if (toast) {
        const bgName = BG_NAMES[bgJustSwitched] || 'your new background';
        toast.textContent = `Welcome to ${bgName} 🌿`;
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
      }
    }, 100);
  }

});
