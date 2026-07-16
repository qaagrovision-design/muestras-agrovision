importScripts('./core/app-version.js');
const SW_VERSION = APP_VERSION;
const STATIC_CACHE = `tiempos-static-${SW_VERSION}`;
const RUNTIME_CACHE = `tiempos-runtime-${SW_VERSION}`;
const MAX_RUNTIME_ENTRIES = 120;

/** Todo lo que cada pestaña necesita para verse bien sin internet */
const APP_SHELL = [
    './',
    './index.html',
    './modules/',
    './modules/index.html',
    './assets/styles.css',
    './core/api-config.js',
    './modules/campo/campo.js',
    './core/pdf-nombre.js',
    './modules/campo/campo-pdf.js',
    './core/hist-pdf-store.js',
    './core/hist-pdf-envio.js',
    './modules/packing/packing-pdf.js',
    './modules/mp-tk/mptk-pdf.js',
    './assets/librerias/jspdf.umd.min.js',
    './assets/librerias/pdf.min.js',
    './assets/librerias/pdf.worker.min.js',
    './assets/librerias/standard_fonts/FoxitFixed.pfb',
    './assets/librerias/standard_fonts/FoxitFixedBold.pfb',
    './assets/librerias/standard_fonts/FoxitFixedBoldItalic.pfb',
    './assets/librerias/standard_fonts/FoxitFixedItalic.pfb',
    './assets/librerias/standard_fonts/FoxitSerif.pfb',
    './assets/librerias/standard_fonts/FoxitSerifBold.pfb',
    './assets/librerias/standard_fonts/FoxitSerifBoldItalic.pfb',
    './assets/librerias/standard_fonts/FoxitSerifItalic.pfb',
    './assets/librerias/standard_fonts/LiberationSans-Bold.ttf',
    './assets/librerias/standard_fonts/LiberationSans-BoldItalic.ttf',
    './assets/librerias/standard_fonts/LiberationSans-Italic.ttf',
    './assets/librerias/standard_fonts/LiberationSans-Regular.ttf',
    './core/network.js',
    './core/script.js',
    './core/nav-persist-draft.js',
    './core/app-version.js',
    './core/fecha-operativa.js',
    './core/flujo-bienvenida.css',
    './core/flujo-bienvenida.js',
    './core/pdf-preview-live.js',
    './core/mensajes-usuario.js',
    './core/fundo-flujo-tk20.js',
    './core/icono-app.js',
    './core/catalogo-json.js',
    './core/mapeo-parcelas-data.js',
    './assets/data/catalogo-app.json',
    './core/time-picker.js',
    './assets/librerias/lucide.min.js',
    './assets/librerias/sweetalert2.all.min.js',
    './assets/librerias/flatpickr.min.js',
    './assets/librerias/flatpickr.min.css',
    './assets/librerias/flatpickr-l10n-es.js',
    './assets/manifest.json',
    './assets/images/QA2026-2.0.png',
    './assets/images/log.png',
    './modules/campo/',
    './modules/campo/index.html',
    './modules/campo/campo-draft-idb.js',
    './modules/packing/',
    './modules/packing/index.html',
    './modules/packing/packing.js',
    './modules/packing/packing-variante-nav.js',
    './modules/packing-rc5/',
    './modules/packing-rc5/index.html',
    './modules/packing-rc5/packing-rc5-boot.js',
    './modules/mp-tk/',
    './modules/mp-tk/index.html',
    './modules/mp-tk/thermoking.js',
    './modules/mp-tk/mptk-ui.js',
    './modules/mp-tk/mptk-formato.js',
    './modules/tk-2.0/',
    './modules/tk-2.0/index.html',
    './modules/tk-2.0/tk20-formato.js',
    './modules/tk-2.0/tk20-header.js',
    './modules/tk-2.0/tk20-draft.js',
    './modules/tk-2.0/tk20-fields.js',
    './modules/tk-2.0/tk20-pesos-config.js',
    './modules/tk-2.0/tk20-body.js',
    './modules/tk-2.0/tk20-modals.js',
    './modules/tk-2.0/tk20-control.js',
    './modules/tk-2.0/tk20-swal.js',
    './modules/tk-2.0/tk20-sync.js',
    './modules/tk-2.0/tk20-pdf.js',
    './modules/tk-2.0/tk20-fab.js',
    './core/presion-vapor.js',
    './modules/tk-2.0/tk20-presion.js',
    './modules/tk-2.0/tk20-envio.js',
    './modules/tk-2.0/tk20-transporte.js',
    './modules/acopio/',
    './modules/acopio/index.html',
    './modules/historial/',
    './modules/historial/index.html',
    './modules/recomendaciones/',
    './modules/recomendaciones/index.html'
];

const SHELL_BY_SECTION = [
    { test: /\/packing-rc5(\/|$)|\/packingRC5(\/|$)/i, url: './modules/packing-rc5/index.html' },
    { test: /\/packing(\/|$)/i, url: './modules/packing/index.html' },
    { test: /\/tk-2\.0(\/|$)/i, url: './modules/tk-2.0/index.html' },
    { test: /\/mp-tk(\/|$)/i, url: './modules/mp-tk/index.html' },
    { test: /\/acopio(\/|$)/i, url: './modules/acopio/index.html' },
    { test: /\/historial(\/|$)/i, url: './modules/historial/index.html' },
    { test: /\/recomendaciones(\/|$)/i, url: './modules/recomendaciones/index.html' },
    { test: /\/campo(\/|$)/i, url: './modules/campo/index.html' },
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

/** Online: red con tope corto, luego caché. Offline: caché primero (sin esperar fallo de red). */
async function respondNavigate(req, event) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) {
        const cachedOff = await offlineNavigateFallback(req);
        if (cachedOff) return cachedOff;
        const home = await caches.match('./index.html');
        if (home) return home;
        return Response.error();
    }

    try {
        const res = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error('nav-timeout')), 1500))
        ]);
        if (res && res.ok) {
            putRuntimeWithLimit(req, res.clone());
            return res;
        }
    } catch (_) { /* sin red / timeout */ }

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
