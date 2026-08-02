(() => {
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  function showMessage(message) {
    const box = document.getElementById('pwa-install-message');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 6500);
  }

  function updateButton() {
    const button = document.getElementById('pwa-install-button');
    if (!button) return;
    if (isStandalone()) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    updateButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateButton();
    showMessage('Đã cài GS334 lên thiết bị.');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('pwa-install-button');
    updateButton();
    if (!button) return;
    button.addEventListener('click', async () => {
      if (isStandalone()) return;
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        updateButton();
        return;
      }
      if (isIOS) {
        showMessage('Trên iPhone/iPad: mở bằng Safari → nút Chia sẻ → Thêm vào Màn hình chính.');
      } else {
        showMessage('Mở menu trình duyệt ⋮ → chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.');
      }
    });
  });
})();
