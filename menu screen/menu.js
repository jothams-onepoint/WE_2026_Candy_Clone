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

document.addEventListener('DOMContentLoaded', () => {
  const level = parseInt(localStorage.getItem('candyLevel') || '1');
  const levelEl = document.getElementById('level-number');
  if (levelEl) levelEl.textContent = String(level);

  setupButton('btn-play',     BASE + 'play_idle.png',     null,                            () => window.location.href = '../index.html?autostart=1');
  setupButton('btn-settings', BASE + 'settings_idle.png', BASE + 'settings_click.png',     () => openPopup('popup-settings'));
  setupButton('btn-home',     BASE + 'home_idle.png',     BASE + 'home_click.png',         () => window.location.href = 'inventory.html');
  setupButton('btn-quests',   BASE + 'quests_idle.png',   BASE + 'quests_click.png',       () => openPopup('popup-quests'));
  setupButton('btn-shop',     BASE + 'shop_idle.png',     BASE + 'shop_click.png',         () => window.location.href = 'shop.html');

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

  // Make floating items draggable
  let draggedItem = null;
  let dragOffset = { x: 0, y: 0 };

  document.querySelectorAll('.draggable-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      draggedItem = item;
      const rect = item.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      item.style.animation = 'none';
      item.style.cursor = 'grabbing';
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!draggedItem) return;
    const menuContent = document.querySelector('.menu-content');
    const rect = menuContent.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    draggedItem.style.left = x + 'px';
    draggedItem.style.top = y + 'px';
    draggedItem.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (draggedItem) {
      draggedItem.style.cursor = 'grab';
      const animationName = draggedItem.className.includes('bird') ? 'bird-fly' :
                           draggedItem.className.includes('bee') ? 'bee-buzz' :
                           draggedItem.className.includes('leaf') ? 'leaf-fall' :
                           draggedItem.className.includes('star') ? 'star-twirl' :
                           draggedItem.className.includes('sparkle') ? 'sparkle-float' : 'flutter';
      draggedItem.style.animation = `${animationName} var(--animation-duration, 4s) infinite ease-in-out`;
      draggedItem = null;
    }
  });
});
