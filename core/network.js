/* network.js — política de red empresarial (PWA + Apps Script)
 *
 * REGLA FIJA (no bajar en caliente por “perf” offline):
 * - Sin internet → corte rápido (no colgar la UI).
 * - Con internet → margen amplio + reintentos (cold start de Apps Script).
 *
 * Nunca uses < 12s online para listados / estado_operativo / detalle:
 * un tope bajo (~4s) genera “La planilla tardó demasiado” en producción.
 */
(function initNetworkUtils() {
    // —— Perfil PRODUCCIÓN (Apps Script / Sheets) ——
    // Medido en red real (2026-07-15): listado ~6.4s, estado ~5s, detalle ~8–12s.
    // Margen ×1.8 para WiFi empresa / proxy (no bajar bajo estos valores).
    var JSONP_DEFAULT_MS = 20000;
    var JSONP_LISTADO_MS = 20000;   // listado de muestras del día
    var JSONP_PLANILLA_MS = 20000;  // estado_operativo / N° muestra
    var JSONP_DETALLE_MS = 16000;   // detalle (pico medido ~12s + margen; no 22s×3)
    var JSONP_MAX_MS = 30000;
    var JSONP_OFFLINE_MS = 600;     // sin red: fallo inmediato
    var FETCH_POST_MS = 15000;      // envío POST a Apps Script
    var RETRY_GAP_MS = 400;         // pausa entre reintentos

    function isOnline() {
        return typeof navigator !== 'undefined' ? !!navigator.onLine : true;
    }

    function onConnectivityChange(callback) {
        if (typeof callback !== 'function') return function noop() {};
        const up = () => callback(true);
        const down = () => callback(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return function unsubscribe() {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }

    function triggerPendingSync() {
        if (typeof window.sincronizarPendientes === 'function') {
            return window.sincronizarPendientes();
        }
        return Promise.resolve();
    }

    /**
     * Tope JSONP efectivo:
     * - offline → 0.6s
     * - online → preferido (máx 25s) o 15s por defecto
     */
    function jsonpTimeoutMs(preferido) {
        if (!isOnline()) return JSONP_OFFLINE_MS;
        var n = Number(preferido);
        if (Number.isFinite(n) && n > 0) return Math.min(Math.max(n, 1000), JSONP_MAX_MS);
        return JSONP_DEFAULT_MS;
    }

    /** Listado de muestras: 2 intentos con margen de cold start. */
    function listadoTimeoutsMs() {
        if (!isOnline()) return [JSONP_OFFLINE_MS];
        return [JSONP_LISTADO_MS, JSONP_LISTADO_MS];
    }

    /** Detalle de muestra: 2 intentos (pico medido ~12s). No 3×22s: cuelga la pestaña. */
    function detalleTimeoutsMs() {
        if (!isOnline()) return [JSONP_OFFLINE_MS];
        return [JSONP_DETALLE_MS, JSONP_DETALLE_MS];
    }

    /** Revalidación en segundo plano cuando ya hay borrador local (1 intento corto). */
    function detalleRevalidarTimeoutsMs() {
        if (!isOnline()) return [JSONP_OFFLINE_MS];
        return [Math.min(JSONP_DETALLE_MS, 14000)];
    }

    /** N° muestra / estado_operativo (Campo): 3 intentos al forzar, 2 normales. */
    function planillaTimeoutsMs(force) {
        if (!isOnline()) return [JSONP_OFFLINE_MS];
        var n = force ? 3 : 2;
        var out = [];
        for (var i = 0; i < n; i++) out.push(JSONP_PLANILLA_MS);
        return out;
    }

    function sleepMs(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    /** Ejecuta fn(timeoutMs) por cada tope en la lista; primera respuesta gana. */
    async function conReintentosTimeouts(timeouts, fn) {
        var lista = Array.isArray(timeouts) && timeouts.length ? timeouts : [JSONP_DEFAULT_MS];
        var ultimoErr = null;
        for (var i = 0; i < lista.length; i++) {
            try {
                return await fn(lista[i], i);
            } catch (err) {
                ultimoErr = err;
                if (i < lista.length - 1) await sleepMs(RETRY_GAP_MS);
            }
        }
        throw ultimoErr || new Error('La planilla tardó demasiado. Reintenta.');
    }

    /** true si el error parece red/timeout (no romper flujo: cola o borrador). */
    function esErrorRed(err) {
        var msg = String(err && (err.message || err) || '').toLowerCase();
        if (!msg) return !isOnline();
        return /sin internet|timeout|jsonp|network|failed to fetch|abort|nav-timeout|planilla tard|conexi/.test(msg);
    }

    function abortSignalConTope(ms) {
        var tope = Math.max(400, Number(ms) || FETCH_POST_MS);
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            try {
                return AbortSignal.timeout(tope);
            } catch (_) { /* fallback abajo */ }
        }
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        if (!ctrl) return undefined;
        setTimeout(function () {
            try { ctrl.abort(); } catch (_2) { /* ignore */ }
        }, tope);
        return ctrl.signal;
    }

    /**
     * POST a Apps Script con tope (evita colgar minutos sin red).
     * mode no-cors se mantiene; el abort corta la espera del cliente.
     */
    function fetchApiPost(url, body, timeoutMs) {
        if (!isOnline()) {
            return Promise.reject(new Error('Sin internet'));
        }
        var opts = {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: typeof body === 'string' ? body : JSON.stringify(body)
        };
        var signal = abortSignalConTope(timeoutMs || FETCH_POST_MS);
        if (signal) opts.signal = signal;
        return fetch(url, opts);
    }

    function fetchConTope(url, init, timeoutMs) {
        var opts = Object.assign({}, init || {});
        var signal = abortSignalConTope(timeoutMs || FETCH_POST_MS);
        if (signal) opts.signal = signal;
        return fetch(url, opts);
    }

    /** Mensaje estándar cuando hay borrador y la planilla no respondió a tiempo. */
    var MSG_BORRADOR_PLANILLA_LENTA = 'Planilla sin respuesta a tiempo: mostrando borrador guardado en este equipo.';

    function esFalloConsultaPlanilla_(err) {
        return esErrorRed(err);
    }

    window.NetworkSync = {
        isOnline: isOnline,
        onConnectivityChange: onConnectivityChange,
        triggerPendingSync: triggerPendingSync,
        jsonpTimeoutMs: jsonpTimeoutMs,
        listadoTimeoutsMs: listadoTimeoutsMs,
        detalleTimeoutsMs: detalleTimeoutsMs,
        detalleRevalidarTimeoutsMs: detalleRevalidarTimeoutsMs,
        planillaTimeoutsMs: planillaTimeoutsMs,
        conReintentosTimeouts: conReintentosTimeouts,
        fetchApiPost: fetchApiPost,
        fetchConTope: fetchConTope,
        esErrorRed: esErrorRed,
        esFalloConsultaPlanilla_: esFalloConsultaPlanilla_,
        MSG_BORRADOR_PLANILLA_LENTA: MSG_BORRADOR_PLANILLA_LENTA,
        JSONP_DEFAULT_MS: JSONP_DEFAULT_MS,
        JSONP_LISTADO_MS: JSONP_LISTADO_MS,
        JSONP_PLANILLA_MS: JSONP_PLANILLA_MS,
        FETCH_POST_MS: FETCH_POST_MS
    };
}());
