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
  setupButton('btn-play',     BASE + 'play_idle.png',     null,                            () => window.location.href = 'gameplay.html');
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
});
