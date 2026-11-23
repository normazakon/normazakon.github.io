/* Сервис-воркер: сохраняет приложение, чтобы оно открывалось без интернета.
   Файлы берём сначала из сети (так всегда видна свежая версия), а без сети из сохранённой копии.
   Запросы на другие адреса (проверка контрагента в DaData) не трогаем: они идут прямо в сеть. */
"use strict";

const CACHE = "norma-app-v64";
const NETWORK_TIMEOUT_MS = 4000;
const EXTRA = ["manifest.webmanifest", "404.html", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];

/** Локальные файлы, на которые ссылается страница: скрипты, стили, значки. */
function localAssets(html) {
  const urls = [...html.matchAll(/\b(?:src|href)="([^"#:?]+)"/g)].map((match) => match[1]);
  return [...new Set([...urls, ...EXTRA])];
}

/** Файлы шрифтов из таблицы стилей, адреса считаются от неё. */
function cssAssets(css, base) {
  return [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
    .map((match) => match[1])
    .filter((url) => !/^(data|https?):/.test(url))
    .map((url) => new URL(url, base).href);
}

// страницы, которые работают без интернета: лендинг в корне и само приложение
const PAGES = ["", "app.html"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const assets = [];
    for (const name of PAGES) {
      const url = new URL(name, self.registration.scope).href;
      const page = await fetch(url, { cache: "no-cache" });
      if (!page.ok) throw new Error(`Страница не загрузилась: ${page.status}`);
      await cache.put(url, page.clone());
      assets.push(...localAssets(await page.text()).map((item) => new URL(item, self.registration.scope).href));
    }
    // шаблоны подгружаются по требованию и в app.html не перечислены: их список берем из manifest.json,
    // чтобы без сети открывался любой шаблон, а не только уже открытые
    const templates = await fetch(new URL("data/templates/manifest.json", self.registration.scope).href, { cache: "no-cache" });
    if (templates.ok) {
      for (const name of await templates.json()) assets.push(new URL(`data/templates/${name}.js`, self.registration.scope).href);
    }
    const fonts = [];
    for (const url of assets.filter((item) => item.endsWith(".css"))) {
      const response = await fetch(url, { cache: "no-cache" });
      if (response.ok) fonts.push(...cssAssets(await response.text(), url));
    }
    await cache.addAll([...new Set([...assets, ...fonts])].map((url) => new Request(url, { cache: "no-cache" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

/** Сначала сеть. Если сеть молчит дольше таймаута, а копия есть, отдаём копию; ответ сети всё равно сохранится. */
async function networkFirst(request, key) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  const network = fetch(request, { cache: "no-cache" }).then((response) => {
    if (response.ok) cache.put(key, response.clone());
    return response;
  });
  if (!cached) return network;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  try {
    return await Promise.race([network, timeout]);
  } catch (error) {
    return cached;
  }
}

/** Переход на страницу. Главную сохраняем; чужой адрес отдаём как есть, чтобы сервер показал страницу 404. */
async function navigation(request) {
  const scope = self.registration.scope;
  const path = new URL(request.url).pathname;
  const scopePath = new URL(scope).pathname;
  if (path === scopePath || path === `${scopePath}index.html`) return networkFirst(new Request(scope), scope);
  if (path === `${scopePath}app.html`) return networkFirst(new Request(`${scope}app.html`), `${scope}app.html`);
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    return (await cache.match(`${scope}404.html`)) || (await cache.match(scope)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(request.mode === "navigate" ? navigation(request) : networkFirst(request, request));
});
