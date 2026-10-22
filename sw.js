// Oflayn ishlash uchun: fayllarni keshda saqlaydi. Yangilash chiqarganda VERSION ni oshiring.
const VERSION = 'namoz-qazo-v22';
const FILES = ['./', 'index.html', 'app.js', 'prayer.js', 'location.js', 'official.js', 'notify.js', 'quotes.js', 'stats.js', 'learn.js', 'qibla.js', 'journey.js', 'geomag.js', 'channel.js', 'adhan.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Avval internetdan (yangilanish darhol keladi). Internet yo'q yoki 3 soniyada javob
// kelmasa — keshdagi nusxa ochiladi, yangisi esa fonda keshga yoziladi.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.includes('version.json')) return; // har doim internetdan
  const network = fetch(e.request, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(network.catch(() => {}));
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit && !done) { done = true; resolve(hit); }
      return hit;
    });
    const timer = setTimeout(fromCache, 3000);
    network
      .then((res) => { clearTimeout(timer); if (!done) { done = true; resolve(res); } })
      .catch(() => { clearTimeout(timer); fromCache().then((hit) => { if (!hit && !done) { done = true; resolve(Response.error()); } }); });
  }));
});
