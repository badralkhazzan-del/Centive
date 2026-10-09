/*
 * PiringTani service worker.
 *
 * Goal: the demo keeps working offline after the first load. No dependencies,
 * no build step. Registered by src/components/layout/providers.tsx in production.
 *
 * Strategies
 * - install: precache every app route (HTML) plus the /_next/static assets those
 *   pages reference, following lazy chunks and CSS url() references.
 * - /_next/static/*: cache first (file names are content hashed).
 * - page navigations: network first with a short timeout, then the cached page
 *   (search params ignored). /trace/<code> falls back to a cached trace page.
 * - RSC (flight) requests: network first, then the cached copy for that exact URL,
 *   else Response.error() so Next.js falls back to a full page navigation.
 * - OpenStreetMap tiles: cache first, opportunistic, never fails the request.
 * - any other same-origin GET: stale while revalidate.
 *
 * Bump VERSION to drop every cache from older versions on activate.
 */

const VERSION = "v1";
const PREFIX = "piringtani-";
const CACHE = {
  pages: `${PREFIX}pages-${VERSION}`,
  static: `${PREFIX}static-${VERSION}`,
  rsc: `${PREFIX}rsc-${VERSION}`,
  runtime: `${PREFIX}runtime-${VERSION}`,
  tiles: `${PREFIX}tiles-${VERSION}`,
};

const ROUTES = [
  "/",
  "/kitchen",
  "/kitchen/menu",
  "/kitchen/forecast",
  "/kitchen/switch",
  "/kitchen/receive",
  "/kitchen/feedback",
  "/kopdes",
  "/kopdes/farmers",
  "/kopdes/delivery",
  "/kopdes/payments",
  "/farmer",
  "/regency",
  "/simulation",
  "/settings",
  "/about",
];

// A trace page for a code nobody will use. Offline, a trace link for a batch that was
// never opened online is served from this page, retargeted to the requested code.
const TRACE_TEMPLATE = "/trace/PT-OFFLINE";

const TILE_ORIGIN = "https://tile.openstreetmap.org";
const NAV_TIMEOUT_MS = 3000;
const RSC_TIMEOUT_MS = 4000;
const MAX_TILES = 600;
const MAX_RSC = 250;
const MAX_CRAWL_DEPTH = 4;
const TIMED_OUT = Symbol("timed-out");

const noop = () => undefined;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sameOrigin = (url) => url.origin === self.location.origin;

/* ------------------------------------------------------------------ install */

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precache().catch(noop));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set(Object.values(CACHE));
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function precache() {
  const pages = await caches.open(CACHE.pages);
  const found = new Set();
  const results = await Promise.allSettled(
    [...ROUTES, TRACE_TEMPLATE].map(async (route) => {
      const url = new URL(route, self.location.origin);
      const res = await fetch(new Request(url.href, { cache: "reload", credentials: "same-origin" }));
      if (!isGoodHtml(res)) throw new Error(`precache ${route}: ${res.status}`);
      const html = await res.clone().text();
      await pages.put(pageKey(url), res);
      for (const asset of assetsInHtml(html, url)) found.add(asset);
    }),
  );
  await crawlStatic(found);
  return results;
}

/** Same-origin static assets named by an HTML page (scripts, CSS, fonts, icons). */
function assetsInHtml(html, base) {
  const out = new Set();
  // Next.js static files, including the ones only named inside the inline flight data.
  for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s<>()]+/g)) out.add(cleanAssetPath(m[0]));
  // Other same-origin files with an extension, such as /icon.svg?<hash>.
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    const raw = m[1].replace(/&amp;/g, "&");
    const path = raw.split("?")[0];
    if (raw.startsWith("/_next/") || !/\.[a-z0-9]{2,12}$/i.test(path) || path === "/sw.js") continue;
    out.add(raw);
  }
  return [...out].map((p) => new URL(p, base).href).filter((href) => sameOrigin(new URL(href)));
}

function cleanAssetPath(p) {
  return p.replace(/[.,;:]+$/, "");
}

/**
 * Cache static assets, then follow what they reference: lazy chunks named inside
 * JS ("static/chunks/<hash>.js") and url(...) references inside CSS (fonts, images).
 */
async function crawlStatic(initial) {
  const staticCache = await caches.open(CACHE.static);
  // Files outside /_next/static (such as /icon.svg) are answered by the
  // stale-while-revalidate handler, which reads the runtime cache.
  const runtimeCache = await caches.open(CACHE.runtime);
  const seen = new Set();
  let wave = [...initial];
  for (let depth = 0; depth < MAX_CRAWL_DEPTH && wave.length > 0; depth++) {
    const next = new Set();
    const todo = wave.filter((href) => !seen.has(href));
    todo.forEach((href) => seen.add(href));
    await Promise.allSettled(
      todo.map(async (href) => {
        const isStaticNext = new URL(href).pathname.startsWith("/_next/static/");
        const cache = isStaticNext ? staticCache : runtimeCache;
        let res = await cache.match(href, { ignoreVary: true });
        if (!res) {
          const fresh = await fetch(href, { credentials: "same-origin" });
          if (!isGoodBasic(fresh)) return;
          await cache.put(href, fresh.clone());
          res = fresh;
        }
        if (!isStaticNext) return;
        const path = new URL(href).pathname;
        if (path.endsWith(".js")) {
          const text = await res.text();
          for (const m of text.matchAll(/(?:\/_next\/)?static\/(?:chunks|media|css)\/[^"'\\\s<>()]+/g)) {
            const p = cleanAssetPath(m[0]);
            next.add(new URL(p.startsWith("/_next/") ? p : `/_next/${p}`, self.location.origin).href);
          }
        } else if (path.endsWith(".css")) {
          const text = await res.text();
          for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
            const ref = m[2].trim();
            if (ref.startsWith("data:") || ref.startsWith("#")) continue;
            const abs = new URL(ref, href);
            if (sameOrigin(abs)) next.add(abs.href);
          }
        }
      }),
    );
    wave = [...next];
  }
}

/* -------------------------------------------------------------------- fetch */

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin === TILE_ORIGIN) {
    event.respondWith(handleTile(event));
    return;
  }
  if (!sameOrigin(url)) return;
  if (url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(event, url));
    return;
  }
  if (isRscRequest(req, url)) {
    event.respondWith(handleRsc(event));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleStatic(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});

function isRscRequest(req, url) {
  return req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

/**
 * fetch() the request and, when the response passes the check, store a copy.
 * The event stays alive until the copy is written.
 */
function fetchAndStore(event, request, cacheName, key, isGood) {
  let release = noop;
  event.waitUntil(new Promise((resolve) => (release = resolve)));
  return fetch(request).then(
    (res) => {
      if (isGood(res)) {
        const copy = res.clone();
        caches
          .open(cacheName)
          .then((cache) => cache.put(key, copy))
          .then(() => (cacheName === CACHE.rsc ? trimCache(CACHE.rsc, MAX_RSC) : undefined))
          .catch(noop)
          .then(release);
      } else {
        release();
      }
      return res;
    },
    (err) => {
      release();
      throw err;
    },
  );
}

/** Resolve with the network result, null on a network error, or TIMED_OUT. */
function raceTimeout(promise, ms) {
  return Promise.race([promise.then((r) => r, () => null), wait(ms).then(() => TIMED_OUT)]);
}

/* -------------------------------------------------------------- navigations */

async function handleNavigation(event, url) {
  const key = pageKey(url);
  const network = fetchAndStore(event, event.request, CACHE.pages, key, isGoodHtml);
  const first = await raceTimeout(network, NAV_TIMEOUT_MS);

  if (first && first !== TIMED_OUT) {
    if (first.status < 500) return first;
    return (await matchPage(key)) ?? first;
  }
  if (first === TIMED_OUT) {
    const cached = await matchPage(key);
    if (cached) return cached;
    const late = await network.then((r) => r, () => null);
    if (late) return late;
  }
  return pageFallback(url);
}

/** Offline answer for a page: the cached copy, a retargeted trace page, or a notice. */
async function pageFallback(url) {
  const exact = await matchPage(pageKey(url));
  if (exact) return exact;
  if (url.pathname.startsWith("/trace/")) {
    const trace = await anyTracePage(url);
    if (trace) return trace;
    const home = await matchPage(pageKey(new URL("/", self.location.origin)));
    if (home) return home;
  }
  return offlineFallbackResponse();
}

/** Cache key for a page: origin + path, no search, no trailing slash. */
function pageKey(url) {
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return `${url.origin}${path}`;
}

async function matchPage(key) {
  const cache = await caches.open(CACHE.pages);
  return (await cache.match(key, { ignoreSearch: true, ignoreVary: true })) ?? null;
}

const SAFE_CODE = /^[A-Za-z0-9_.~-]{1,80}$/;

function codeFromPath(pathname) {
  const seg = pathname.split("/")[2] ?? "";
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * Serve another cached trace page for /trace/<code>. The page reads the code from
 * the route params embedded in its flight data, so the cached code is swapped for
 * the requested one. Without that the page would show the wrong batch.
 */
async function anyTracePage(url) {
  const cache = await caches.open(CACHE.pages);
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/trace/"));
  if (keys.length === 0) return null;
  // Prefer the template, it was fetched for exactly this purpose.
  const pick = keys.find((r) => new URL(r.url).pathname === TRACE_TEMPLATE) ?? keys[keys.length - 1];
  const res = await cache.match(pick, { ignoreVary: true });
  if (!res) return null;
  const from = codeFromPath(new URL(pick.url).pathname);
  const to = codeFromPath(url.pathname);
  if (!SAFE_CODE.test(from) || !SAFE_CODE.test(to) || from === to) return res;
  const html = await res.text();
  const swapped = html
    .split(`\\"k\\":\\"${from}\\"`)
    .join(`\\"k\\":\\"${to}\\"`)
    .split(`\\"trace\\",\\"${from}`)
    .join(`\\"trace\\",\\"${to}`);
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.delete("etag");
  return new Response(swapped, { status: 200, statusText: "OK", headers });
}

function offlineFallbackResponse() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · PiringTani</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f5ef; --fg: #1d2420; --muted: #55605a; --card: #ffffff; --line: #ddd8cc; --primary: #1f6f4a; --on-primary: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #121614; --fg: #ecefe9; --muted: #a9b2ac; --card: #1b201d; --line: #2f3631; --primary: #5cc28e; --on-primary: #0d1f15; } }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { box-sizing: border-box; width: min(28rem, 100% - 32px); padding: 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
  h1 { margin: 0 0 8px; font-size: 1.25rem; }
  p { margin: 0 0 12px; color: var(--muted); }
  a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 12px; background: var(--primary); color: var(--on-primary); font-weight: 600; text-decoration: none; }
  a:focus-visible { outline: 3px solid var(--fg); outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <h1>You are offline</h1>
  <p>This page is not saved on this device yet. The main PiringTani screens still work offline.</p>
  <p lang="id">Anda sedang offline. Halaman ini belum tersimpan di perangkat ini. Layar utama PiringTani tetap bisa dipakai tanpa internet.</p>
  <a href="/">Open PiringTani / Buka PiringTani</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ---------------------------------------------------------------------- RSC */

async function handleRsc(event) {
  const req = event.request;
  const cache = await caches.open(CACHE.rsc);
  const cached = await cache.match(req.url, { ignoreVary: true });
  const network = fetchAndStore(event, req, CACHE.rsc, req.url, isGoodRsc);
  const first = cached ? await raceTimeout(network, RSC_TIMEOUT_MS) : await network.then((r) => r, () => null);
  if (first && first !== TIMED_OUT && (first.ok || !cached)) return first;
  if (cached) return cached;
  // Nothing usable: a network error makes Next.js fall back to a full navigation,
  // which the navigation handler can answer from the page cache.
  return Response.error();
}

/* ------------------------------------------------------------------- static */

async function handleStatic(event) {
  const req = event.request;
  const cache = await caches.open(CACHE.static);
  const cached = await cache.match(req, { ignoreVary: true });
  if (cached) return cached;
  try {
    return await fetchAndStore(event, req, CACHE.static, req.url, isGoodBasic);
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const req = event.request;
  const cache = await caches.open(CACHE.runtime);
  const cached = await cache.match(req, { ignoreVary: true });
  const network = fetchAndStore(event, req, CACHE.runtime, req.url, isGoodBasic);
  if (cached) {
    network.catch(noop);
    return cached;
  }
  try {
    return await network;
  } catch {
    return Response.error();
  }
}

/* -------------------------------------------------------------------- tiles */

async function handleTile(event) {
  const req = event.request;
  try {
    const cache = await caches.open(CACHE.tiles);
    const cached = await cache.match(req.url);
    if (cached) return cached;
    // A CORS request gives a readable response that is cheap to store (an opaque one
    // is padded heavily in the storage quota). OSM tiles allow CORS.
    const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil(
        cache
          .put(req.url, copy)
          .then(() => trimCache(CACHE.tiles, MAX_TILES))
          .catch(noop),
      );
      return res;
    }
    return await fetch(req);
  } catch {
    try {
      return await fetch(req);
    } catch {
      return Response.error();
    }
  }
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

/* ------------------------------------------------------------------- checks */

function isGoodBasic(res) {
  return !!res && res.status === 200 && res.type === "basic" && !res.redirected;
}

function isGoodHtml(res) {
  return isGoodBasic(res) && (res.headers.get("Content-Type") ?? "").includes("text/html");
}

function isGoodRsc(res) {
  return isGoodBasic(res) && (res.headers.get("Content-Type") ?? "").includes("text/x-component");
}
