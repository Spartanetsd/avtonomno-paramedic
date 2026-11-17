// Service Worker «Автономно»: повна робота офлайн після першого завантаження.
// Під час оновлення коду змініть VERSION — браузер встановить нову версію,
// а дані користувача (localStorage) кеш не зачіпає.
// Ілюстрації лежать в окремому кеші PICS_CACHE і не завантажуються заново
// з кожною версією коду. Нова картинка дозберігається сама (кеш доповнюється лише відсутніми),
// а замінили наявну — збільште PICS_CACHE.

const VERSION = 'avtonomno-v2.3.1';
const PICS_CACHE = 'avtonomno-pics-v1';
const PREFIX = 'avtonomno-';

const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './ui.js',
  './screens.js',
  './calcui.js',
  './engine.js',
  './data.js',
  './solutions.js',
  './safety.js',
  './calc.js',
  './physics.js',
  './store.js',
  './pics.js',
  './shelter.js',
  './shelterui.js',
  './tools.js',
  './qr.js',
  './aid.js',
  './aidui.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// Ілюстрації: зберігаються у фоні після того, як застосунок уже готовий до офлайну
const PICS = [
  './pic-home-morning.webp',
  './pic-home-day.webp',
  './pic-home-evening.webp',
  './pic-home-night.webp',
  './pic-ico-heat.webp',
  './pic-ico-food.webp',
  './pic-ico-water.webp',
  './pic-ico-energy.webp',
  './pic-ico-cool.webp',
  './pic-ico-hygiene.webp',
  './pic-need-heat.webp',
  './pic-need-food.webp',
  './pic-need-water.webp',
  './pic-need-energy.webp',
  './pic-need-cool.webp',
  './pic-need-hygiene.webp',
  './pic-season-winter.webp',
  './pic-season-spring.webp',
  './pic-season-summer.webp',
  './pic-season-autumn.webp',
  './pic-state.webp',
  './pic-setup-start.webp',
  './pic-setup-done.webp',
  './pic-reserve.webp',
  './pic-calc.webp',
  './pic-safety.webp',
  './pic-warm-place.webp',
  './pic-offline.webp',
  './pic-empty-saved.webp',
  './pic-empty-search.webp',
  './pic-empty-reserve.webp',
  './pic-empty-none.webp',
  './pic-phys-joule.webp',
  './pic-phys-faraday.webp',
  './pic-phys-carnot.webp',
  './pic-phys-fourier.webp',
  './pic-phys-newton.webp',
  './pic-phys-einstein.webp',
  './pic-shelter.webp',
  './pic-bag.webp',
  './pic-prep.webp',
  './pic-after.webp',
];

// Сайт проєкту — необов’язкові файли: якщо їх немає на сервері (наприклад, робочий процес
// GitHub Actions їх не скопіював), застосунок однаково оновлюється, а не лишається на старій версії.
const EXTRA = ['./pro.html', './landing.css', './policeman-paramedic.webp'];

const urls = CORE.map((p) => new URL(p, self.location).href);
const extraUrls = EXTRA.map((p) => new URL(p, self.location).href);
// Окремі сторінки, які відкриваються як є, а не оболонкою застосунку: сайт проєкту
const PAGES = ['./pro.html'].map((p) => new URL(p, self.location).href);
const picUrls = PICS.map((p) => new URL(p, self.location).href);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache: 'reload' — оминаємо HTTP-кеш, щоб зберегти саме нову версію
    try {
      await cache.addAll(urls.map((u) => new Request(u, { cache: 'reload' })));
    } catch (err) {
      // Без цього оновлення «мовчки» не стається: розповідаємо відкритим сторінкам, яких файлів бракує
      const missing = await missingFiles();
      const all = await self.clients.matchAll({ includeUncontrolled: true });
      all.forEach((c) => c.postMessage({ type: 'INSTALL_FAILED', version: VERSION, missing, total: urls.length }));
      await caches.delete(VERSION); // недобудований кеш не лишаємо
      throw err;
    }
    await Promise.allSettled(extraUrls.map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (res.ok) await cache.put(u, res);
    }));
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: 'CACHED', version: VERSION }));
    // Перше встановлення активуємо одразу; оновлення чекає підтвердження користувача
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION && k !== PICS_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Файли застосунку, яких сервер не віддав (короткі імена). */
async function missingFiles() {
  const out = [];
  await Promise.all(urls.map(async (u) => {
    let ok = false;
    try { ok = (await fetch(new Request(u, { cache: 'reload' }))).ok; } catch { ok = false; }
    if (!ok) out.push(u.slice(self.registration.scope.length) || 'index.html');
  }));
  return out.sort();
}

/** Зберегти відсутні ілюстрації. Помилка однієї картинки не заважає іншим і не ламає застосунок. */
async function cachePics() {
  const cache = await caches.open(PICS_CACHE);
  await Promise.allSettled(picUrls.map(async (u) => {
    if (await cache.match(u)) return;
    const res = await fetch(new Request(u, { cache: 'reload' }));
    if (res.ok) await cache.put(u, res);
  }));
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'CACHE_PICS') {
    event.waitUntil(cachePics().catch(() => {}));
    return;
  }
  if (data.type === 'STATUS') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    (async () => {
      const cache = await caches.open(VERSION);
      const pics = await caches.open(PICS_CACHE);
      let cached = 0;
      let picsCached = 0;
      for (const u of urls) if (await cache.match(u)) cached++;
      for (const u of picUrls) if (await pics.match(u)) picsCached++;
      port.postMessage({ version: VERSION, total: urls.length, cached, ready: cached === urls.length, picsTotal: picUrls.length, picsCached });
    })().catch(() => port.postMessage({ version: VERSION, total: urls.length, cached: 0, ready: false, picsTotal: picUrls.length, picsCached: 0 }));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // зовнішні посилання (джерела) — лише з мережі
  const clean = url.origin + url.pathname;

  // Навігація: оболонка застосунку з кешу; маршрути на хеші, тож завжди index.html.
  // Виняток — окремі сторінки (pro.html): їх віддаємо самих, інакше сайт проєкту відкрив би застосунок.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      if (PAGES.includes(clean)) {
        const page = await cache.match(clean);
        if (page) return page;
        try {
          const res = await fetch(req);
          if (res.ok && res.type === 'basic') cache.put(clean, res.clone());
          return res;
        } catch { /* немає мережі — далі оболонка застосунку */ }
      }
      const shell = (await cache.match(new URL('./index.html', self.location).href)) || (await cache.match(new URL('./', self.location).href));
      if (shell) return shell;
      try { return await fetch(req); } catch { return new Response('<h1>Немає з’єднання</h1><p>Відкрийте застосунок, коли з’явиться інтернет, щоб зберегти його для офлайн-роботи.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }

  // Ілюстрації: окремий кеш, а якщо картинки ще немає — мережа й збереження
  if (picUrls.includes(clean)) {
    event.respondWith((async () => {
      const pics = await caches.open(PICS_CACHE);
      const hit = await pics.match(clean);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') pics.put(clean, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Файли застосунку: спершу кеш, потім мережа
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && (urls.includes(clean) || extraUrls.includes(clean))) cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
