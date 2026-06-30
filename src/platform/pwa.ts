function upsertMeta(name: string, content: string) {
  const existing = document.head.querySelector(`meta[name="${name}"]`);
  if (existing) {
    existing.setAttribute('content', content);
    return;
  }

  const meta = document.createElement('meta');
  meta.setAttribute('name', name);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

export function setupPwa() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  upsertMeta('theme-color', '#090D10');
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  upsertMeta('apple-mobile-web-app-title', 'Setlog');

  if (!document.head.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.setAttribute('rel', 'manifest');
    manifest.setAttribute('href', '/manifest.webmanifest');
    document.head.appendChild(manifest);
  }

  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          registration.update().catch(() => undefined);
          if (registration.waiting) registration.waiting.postMessage('SKIP_WAITING');
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                worker.postMessage('SKIP_WAITING');
              }
            });
          });
        })
        .catch(() => undefined);
    }, { once: true });
  }
}
