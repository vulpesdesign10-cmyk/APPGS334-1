(() => {
  const VERSION = '6.2.0';
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function ensureUi() {
    if (document.getElementById('app-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'app-update-banner';
    banner.className = 'app-update-banner';
    banner.innerHTML = '<div><strong>Có phiên bản mới</strong><span>Nhấn cập nhật để dùng bản GS334 mới nhất.</span></div><button id="app-update-now" type="button">Cập nhật</button>';
    document.body.appendChild(banner);

    const offline = document.createElement('div');
    offline.id = 'app-offline-banner';
    offline.className = 'app-offline-banner';
    offline.textContent = 'Đang ngoại tuyến — dữ liệu mới sẽ tải lại khi có mạng.';
    document.body.appendChild(offline);

    const toast = document.createElement('div');
    toast.id = 'app-mode-toast';
    toast.className = 'app-mode-toast';
    document.body.appendChild(toast);
  }

  function toast(message) {
    const el = document.getElementById('app-mode-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function updateOnlineState() {
    document.documentElement.classList.toggle('is-offline', !navigator.onLine);
    const el = document.getElementById('app-offline-banner');
    if (el) el.classList.toggle('show', !navigator.onLine);
  }

  async function updateBadge() {
    if (!('setAppBadge' in navigator)) return;
    try {
      const ids = ['stat-processing', 'stat-waiting', 'stat-overdue', 'today-processing', 'waiting-pickup', 'overdue-count'];
      let total = 0;
      ids.forEach(id => {
        const el = document.getElementById(id);
        const n = Number(String(el?.textContent || '').replace(/\D/g, ''));
        if (Number.isFinite(n)) total += n;
      });
      if (total > 0) await navigator.setAppBadge(Math.min(total, 99));
      else if ('clearAppBadge' in navigator) await navigator.clearAppBadge();
    } catch (_) {}
  }

  function watchBadgeSources() {
    const observer = new MutationObserver(() => updateBadge());
    const targets = ['stat-processing', 'stat-waiting', 'stat-overdue', 'today-processing', 'waiting-pickup', 'overdue-count']
      .map(id => document.getElementById(id)).filter(Boolean);
    targets.forEach(el => observer.observe(el, { childList: true, subtree: true, characterData: true }));
    updateBadge();
  }

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then(reg => {
      const showUpdate = worker => {
        if (!worker || !navigator.serviceWorker.controller) return;
        const banner = document.getElementById('app-update-banner');
        if (banner) banner.classList.add('show');
        document.getElementById('app-update-now')?.addEventListener('click', () => worker.postMessage({ type: 'SKIP_WAITING' }), { once: true });
      };
      if (reg.waiting) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') showUpdate(worker);
        });
      });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  function setupStandaloneClass() {
    const apply = () => document.documentElement.classList.toggle('is-standalone', isStandalone());
    apply();
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', apply);
  }

  function setupLaunchTracking() {
    const params = new URLSearchParams(location.search);
    if (params.get('source') === 'pwa') sessionStorage.setItem('gs334-app-launch', '1');
    document.documentElement.dataset.appVersion = VERSION;
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureUi();
    setupStandaloneClass();
    setupLaunchTracking();
    setupServiceWorker();
    updateOnlineState();
    watchBadgeSources();
    const requestedPage = new URLSearchParams(location.search).get('open');
    if (requestedPage) {
      let tries = 0;
      const openRequestedPage = setInterval(() => {
        tries += 1;
        if (typeof window.navigate === 'function') {
          clearInterval(openRequestedPage);
          window.navigate(requestedPage);
          history.replaceState({}, '', '/?source=pwa');
        } else if (tries > 30) clearInterval(openRequestedPage);
      }, 200);
    }
    addEventListener('online', () => { updateOnlineState(); toast('Đã kết nối Internet.'); });
    addEventListener('offline', updateOnlineState);
  });
})();
