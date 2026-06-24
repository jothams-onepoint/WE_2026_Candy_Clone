const BASE: string = '../assets/animations/menu animations/';

function setupButton(
  id: string,
  idleSrc: string,
  clickSrc: string | null,
  onClick?: () => void
): void {
  const el = document.getElementById(id) as HTMLImageElement | null;
  if (!el) return;

  el.src = idleSrc;

  el.addEventListener('mousedown', () => {
    if (clickSrc) el.src = clickSrc;
    el.classList.add('pressed');
  });

  const restore = (): void => {
    el.src = idleSrc;
    el.classList.remove('pressed');
  };

  el.addEventListener('mouseup', () => {
    restore();
    onClick?.();
  });

  el.addEventListener('mouseleave', restore);
  el.addEventListener('touchend', () => {
    restore();
    onClick?.();
  });
}

function openPopup(popupId: string): void {
  const popup = document.getElementById(popupId) as HTMLElement | null;
  if (popup) popup.classList.add('visible');
}

function closePopup(popupId: string): void {
  const popup = document.getElementById(popupId) as HTMLElement | null;
  if (popup) popup.classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', (): void => {
  setupButton('btn-play',     BASE + 'play_idle.png',     null,                            () => window.location.href = '../index.html?autostart=1');
  setupButton('btn-settings', BASE + 'settings_idle.png', BASE + 'settings_click.png',     () => openPopup('popup-settings'));
  setupButton('btn-home',     BASE + 'home_idle.png',     BASE + 'home_click.png');
  setupButton('btn-quests',   BASE + 'quests_idle.png',   BASE + 'quests_click.png',       () => openPopup('popup-quests'));
  setupButton('btn-shop',     BASE + 'shop_idle.png',     BASE + 'shop_click.png',         () => window.location.href = 'shop.html');

  // Close popups on background click
  document.getElementById('popup-settings')?.addEventListener('click', (e: Event) => {
    if ((e.target as HTMLElement).id === 'popup-settings') closePopup('popup-settings');
  });

  document.getElementById('popup-quests')?.addEventListener('click', (e: Event) => {
    if ((e.target as HTMLElement).id === 'popup-quests') closePopup('popup-quests');
  });
});
