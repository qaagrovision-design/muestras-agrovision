/**
 * Al tocar la barra inferior, guarda el borrador local antes de cambiar de módulo.
 * Evita perder captura al ir a Campo / Packing / MP-TK / TK-2.0 / Historial.
 *
 * Regla de producto:
 * - Si NO enviaste: el borrador se queda (cerrar app, cambiar módulo, matar PWA).
 * - Solo se limpia al enviar con éxito, al cambiar de día operativo, o con "borrar local".
 */
(function navPersistDraftModule() {
    var DEFAULT_TOPE_MS = 120;

    function solicitarAlmacenamientoPersistenteApp() {
        try {
            if (navigator.storage && typeof navigator.storage.persist === 'function') {
                void navigator.storage.persist().catch(function () { /* ok si el navegador niega */ });
            }
        } catch (_) { /* ignore */ }
    }

    function bindNavPersistDraft(persistFn, opts) {
        if (typeof persistFn !== 'function') return;
        solicitarAlmacenamientoPersistenteApp();
        var topeMs = opts && opts.topeMs != null
            ? Math.max(0, Number(opts.topeMs) || 0)
            : DEFAULT_TOPE_MS;
        var flushAsync = opts && typeof opts.flushAsync === 'function' ? opts.flushAsync : null;

        document.querySelectorAll('#main-bottom-nav a[href]').forEach(function (a) {
            if (a.dataset.navPersistBound === '1') return;
            a.dataset.navPersistBound = '1';
            a.addEventListener('click', function (ev) {
                try { persistFn(); } catch (_) { /* ignore */ }
                var href = a.getAttribute('href');
                var destinoAbs = '';
                var mismaPagina = false;
                try {
                    destinoAbs = a.href || '';
                    var u = new URL(destinoAbs, window.location.href);
                    mismaPagina = u.pathname === window.location.pathname;
                } catch (_u) { /* ignore */ }
                // "active" no basta: en TK-2.0 el tab MP-TK está active pero href va a otra URL.
                if (!href || href === '#' || (a.classList.contains('active') && mismaPagina)) {
                    if (flushAsync) {
                        try { void flushAsync(); } catch (_2) { /* ignore */ }
                    }
                    return;
                }
                // Siempre esperar un tope corto: en móvil localStorage a veces no flushea si navegas al instante.
                ev.preventDefault();
                var destino = destinoAbs || a.href;
                var tareas = [
                    new Promise(function (r) { setTimeout(r, topeMs); })
                ];
                if (flushAsync) {
                    tareas.push(Promise.resolve().then(function () { return flushAsync(); }).catch(function () {}));
                }
                Promise.all(tareas)
                    .catch(function () {})
                    .then(function () {
                        window.location.href = destino;
                    });
            });
        });
    }

    solicitarAlmacenamientoPersistenteApp();
    window.solicitarAlmacenamientoPersistenteApp = solicitarAlmacenamientoPersistenteApp;
    window.bindNavPersistDraft = bindNavPersistDraft;
}());
