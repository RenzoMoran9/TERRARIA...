// Service worker: permite instalar el juego como app y jugar sin internet.
// - Archivos con hash (carpeta bundle/): se sirven desde la caché (nunca cambian).
// - Todo lo demás (index.html, imágenes de assets/): primero la red, para recibir
//   actualizaciones; si no hay conexión, la copia guardada.
const CACHE = 'terra2d-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const save = (res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
    }
    return res;
  };

  if (new URL(req.url).pathname.includes('/bundle/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(save)));
    return;
  }
  // cache: 'no-cache' = preguntarle siempre al servidor si cambió (si no, el navegador
  // puede usar una copia de hasta 10 minutos y la actualización tarda en llegar)
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(save)
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
