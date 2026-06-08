const SW_VERSION = 'v226';
const STATIC_CACHE = `tiempos-static-${SW_VERSION}`;
const RUNTIME_CACHE = `tiempos-runtime-${SW_VERSION}`;
const MAX_RUNTIME_ENTRIES = 120;

/** Todo lo que cada pestaña necesita para verse bien sin internet */
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './campo-pdf.js',
    './packing-pdf.js',
    './librerias/jspdf.umd.min.js',
    './librerias/pdf.min.js',
    './librerias/pdf.worker.min.js',
    './librerias/standard_fonts/FoxitFixed.pfb',
    './librerias/standard_fonts/FoxitFixedBold.pfb',
    './librerias/standard_fonts/FoxitFixedBoldItalic.pfb',
    './librerias/standard_fonts/FoxitFixedItalic.pfb',
    './librerias/standard_fonts/FoxitSerif.pfb',
    './librerias/standard_fonts/FoxitSerifBold.pfb',
    './librerias/standard_fonts/FoxitSerifBoldItalic.pfb',
    './librerias/standard_fonts/FoxitSerifItalic.pfb',
    './librerias/standard_fonts/LiberationSans-Bold.ttf',
    './librerias/standard_fonts/LiberationSans-BoldItalic.ttf',
    './librerias/standard_fonts/LiberationSans-Italic.ttf',
    './librerias/standard_fonts/LiberationSans-Regular.ttf',
    './network.js',
    './script.js',
    './catalogo-json.js',
    './mapeo-parcelas-data.js',
    './data/catalogo-app.json',
    './time-picker.js',
    './librerias/lucide.min.js',
    './librerias/sweetalert2.all.min.js',
    './librerias/flatpickr.min.js',
    './librerias/flatpickr.min.css',
    './librerias/flatpickr-l10n-es.js',
    './manifest.json',
    './QA2026-2.0.png',
    './log.png',
    './icons/icon-32.png',
    './packing/',
    './packing/index.html',
    './packing/packing.js',
    './historial/',
    './historial/index.html',
    './recomendaciones/',
    './recomendaciones/index.html'
];

const SHELL_BY_SECTION = [
    { test: /\/packing(\/|$)/i, url: './packing/index.html' },
    { test: /\/historial(\/|$)/i, url: './historial/index.html' },
    { test: /\/recomendaciones(\/|$)/i, url: './recomendaciones/index.html' },
    { test: /.*/, url: './index.html' }
];

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

async function cacheAddAllResiliente(cache, urls) {
    await Promise.allSettled(
        urls.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cacheAddAllResiliente(cache, APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

function shouldCacheRuntimeRequest(req) {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return false;
    if (url.search && url.search.length > 0) return false;
    return ['document', 'script', 'style', 'image', 'font'].includes(req.destination);
}

function shellUrlForPathname(pathname) {
    for (const rule of SHELL_BY_SECTION) {
        if (rule.test.test(pathname)) return rule.url;
    }
    return './index.html';
}

function normalizeNavigatePathname(pathname) {
    let p = String(pathname || '/');
    if (p.endsWith('/')) return p + 'index.html';
    const last = p.split('/').pop() || '';
    if (!/\.html?$/i.test(last)) return p + '/index.html';
    return p;
}

function pathnameEndsWith(pathname, suffix) {
    const p = String(pathname || '');
    const s = String(suffix || '');
    return p === s || p.endsWith(s);
}

async function matchInAllCaches(req) {
    const direct = await caches.match(req);
    if (direct) return direct;

    try {
        const ignore = await caches.match(req, { ignoreSearch: true });
        if (ignore) return ignore;
    } catch (_) { /* ignore */ }

    const url = new URL(req.url);
    const pathname = url.pathname;
    const keys = await caches.keys();
    for (const name of keys) {
        if (!/^tiempos-(static|runtime)-/i.test(name)) continue;
        const cache = await caches.open(name);
        const entries = await cache.keys();
        for (const entry of entries) {
            try {
                const ep = new URL(entry.url).pathname;
                if (ep === pathname || pathnameEndsWith(ep, pathname) || pathnameEndsWith(pathname, ep)) {
                    const res = await cache.match(entry);
                    if (res) return res;
                }
            } catch (_) { /* ignore */ }
        }
    }
    return undefined;
}

async function offlineNavigateFallback(req) {
    const url = new URL(req.url);
    const normalizedUrl = url.origin + normalizeNavigatePathname(url.pathname) + url.search;

    let cached = await matchInAllCaches(req);
    if (cached) return cached;

    cached = await caches.match(normalizedUrl) || await caches.match(normalizedUrl, { ignoreSearch: true });
    if (cached) return cached;

    const shell = shellUrlForPathname(url.pathname);
    const fb = await caches.match(shell) || await caches.match(shell, { ignoreSearch: true });
    if (fb) return fb;

    return caches.match('./index.html');
}

async function putRuntimeWithLimit(req, res) {
    if (!shouldCacheRuntimeRequest(req)) return;
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(req, res);
    const keys = await cache.keys();
    if (keys.length <= MAX_RUNTIME_ENTRIES) return;
    const overflow = keys.length - MAX_RUNTIME_ENTRIES;
    for (let i = 0; i < overflow; i++) {
        await cache.delete(keys[i]);
    }
}

function revalidarEnSegundoPlano(req, event) {
    if (!event || !event.waitUntil) return;
    event.waitUntil(
        fetch(req)
            .then((res) => {
                if (res && res.ok) return putRuntimeWithLimit(req, res.clone());
            })
            .catch(() => undefined)
    );
}

/** Online: red primero. Sin red: caché (pestañas + estilos). */
async function respondNavigate(req, event) {
    try {
        const res = await fetch(req);
        if (res && res.ok) {
            putRuntimeWithLimit(req, res.clone());
            return res;
        }
    } catch (_) { /* sin red */ }
    const cached = await offlineNavigateFallback(req);
    if (cached) return cached;
    return caches.match('./index.html');
}

/** Caché primero para CSS/JS: no romper estilos al cambiar pestaña offline */
async function respondAsset(req, event) {
    const cached = await matchInAllCaches(req);
    if (cached) {
        revalidarEnSegundoPlano(req, event);
        return cached;
    }
    try {
        const res = await fetch(req);
        if (res && res.ok) {
            putRuntimeWithLimit(req, res.clone());
            return res;
        }
        if (res) return res;
    } catch (_) { /* sin red */ }
    if (cached) return cached;
    return Response.error();
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    if (req.mode === 'navigate') {
        event.respondWith(respondNavigate(req, event));
        return;
    }

    event.respondWith(respondAsset(req, event));
});
