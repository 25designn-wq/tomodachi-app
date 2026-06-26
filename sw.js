// オフライン対応。同一オリジンは network-first（古いJSが残りにくい）、
// 失敗時にキャッシュへフォールバック。外部(Firebase/gstatic)は素通し。
const CACHE = 'ojibu-v6';
const CORE = ['.', 'index.html', 'css/style.css', 'js/app.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-teru.svg', 'icons/teruteru.svg', 'icons/teruteru-sad.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 外部はそのまま
  e.respondWith(
    fetch(e.request)
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
  );
});
