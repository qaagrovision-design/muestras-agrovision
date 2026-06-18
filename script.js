/* script.js - bootstrap PWA, actualización controlada y reconexión */
(function bootstrapPwaAndSync() {
    let actualizacionAppEnCurso = false;

    function prefijoRaizApp() {
        const segs = String(window.location.pathname || '/').split('/').filter(Boolean);
        const depth = segs.length > 0 && /\.html?$/i.test(segs[segs.length - 1])
            ? segs.length - 1
            : segs.length;
        return depth <= 0 ? './' : '../'.repeat(depth);
    }

    function rutasPwaDesdePagina() {
        const root = prefijoRaizApp();
        return {
            sw: root + 'service-worker.js',
            scope: root,
            root
        };
    }

    const MODULOS_PRECARGA = [
        './',
        'packing/',
        'acopio/',
        'historial/',
        'recomendaciones/',
        'index.html',
        'packing/index.html',
        'acopio/index.html',
        'acopio/acopio-boot.js',
        'historial/index.html',
        'recomendaciones/index.html',
        'styles.css',
        'api-config.js',
        'app.js',
        'pdf-nombre.js',
        'campo-pdf.js',
        'hist-pdf-store.js',
        'hist-pdf-envio.js',
        'librerias/jspdf.umd.min.js',
        'librerias/pdf.min.js',
        'librerias/pdf.worker.min.js',
        'network.js',
        'script.js',
        'catalogo-json.js',
        'mapeo-parcelas-data.js',
        'data/catalogo-app.json',
        'time-picker.js',
        'packing/packing.js',
        'librerias/lucide.min.js',
        'librerias/sweetalert2.all.min.js',
        'librerias/flatpickr.min.js',
        'librerias/flatpickr.min.css',
        'librerias/flatpickr-l10n-es.js',
        'log.png'
    ];

    /** Precarga todas las pestañas y sus archivos (una vez con internet basta para siempre offline). */
    async function precalentarNavegacionModulos(root) {
        const base = root || prefijoRaizApp();
        const urls = MODULOS_PRECARGA.map((rel) => {
            try {
                return new URL(base + rel, window.location.href).href;
            } catch (_) {
                return '';
            }
        }).filter(Boolean);

        if (!navigator.onLine) return;

        await Promise.allSettled(
            urls.map((u) => fetch(u).catch(() => undefined))
        );
    }

    function cerrarMenusFabSiExisten() {
        try {
            if (typeof window.establecerMenuFlotanteAbierto === 'function') {
                window.establecerMenuFlotanteAbierto(false);
            }
        } catch (_) { /* ignore */ }
        try {
            if (typeof window.establecerMenuFlotantePacking === 'function') {
                window.establecerMenuFlotantePacking(false);
            }
        } catch (_) { /* ignore */ }
    }

    function marcarBotonSyncActualizando(activo) {
        document.querySelectorAll('.fab-mini--sync').forEach((btn) => {
            btn.classList.toggle('is-updating', activo);
            btn.disabled = !!activo;
        });
    }

    function mostrarProgresoActualizacion(texto) {
        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
                title: 'Actualizando app',
                text: texto,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    if (typeof window.Swal.showLoading === 'function') window.Swal.showLoading();
                }
            });
            return;
        }
        marcarBotonSyncActualizando(true);
    }

    function cerrarProgresoActualizacion() {
        if (window.Swal && typeof window.Swal.close === 'function') {
            try { window.Swal.close(); } catch (_) { /* ignore */ }
        }
        marcarBotonSyncActualizando(false);
    }

    function avisoActualizacion(tipo, titulo, mensaje) {
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(tipo, titulo, mensaje);
            return;
        }
        if (typeof window.setStatus === 'function') {
            window.setStatus(mensaje, tipo === 'error' ? 'error' : tipo === 'warning' ? 'warn' : '');
            return;
        }
        try { window.alert(`${titulo}\n${mensaje}`); } catch (_) { /* ignore */ }
    }

    function esperarEstadoWorker(worker, estado) {
        return new Promise((resolve) => {
            if (!worker) {
                resolve(false);
                return;
            }
            if (worker.state === estado) {
                resolve(true);
                return;
            }
            const onChange = () => {
                if (worker.state === estado) {
                    worker.removeEventListener('statechange', onChange);
                    resolve(true);
                }
            };
            worker.addEventListener('statechange', onChange);
            setTimeout(() => {
                worker.removeEventListener('statechange', onChange);
                resolve(worker.state === estado);
            }, 15000);
        });
    }

    function esperarNuevoControladorSw(timeoutMs) {
        if (!navigator.serviceWorker) return Promise.resolve(false);
        if (navigator.serviceWorker.controller) {
            return new Promise((resolve) => {
                let listo = false;
                const onCtrl = () => {
                    if (listo) return;
                    listo = true;
                    navigator.serviceWorker.removeEventListener('controllerchange', onCtrl);
                    resolve(true);
                };
                navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
                setTimeout(() => {
                    if (!listo) {
                        navigator.serviceWorker.removeEventListener('controllerchange', onCtrl);
                        resolve(false);
                    }
                }, timeoutMs);
            });
        }
        return Promise.resolve(true);
    }

    async function obtenerRegistroSw() {
        if (!('serviceWorker' in navigator)) return null;
        let reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg;
        try {
            const rutas = rutasPwaDesdePagina();
            reg = await navigator.serviceWorker.register(rutas.sw, { scope: rutas.scope });
        } catch (_) {
            return null;
        }
        return reg;
    }

    async function activarWorkerEnEspera(reg) {
        if (!reg) return false;
        if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            const ok = await esperarNuevoControladorSw(8000);
            return ok || !!navigator.serviceWorker.controller;
        }
        if (reg.installing) {
            await esperarEstadoWorker(reg.installing, 'installed');
            if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                await esperarNuevoControladorSw(8000);
            }
            return true;
        }
        return false;
    }

    /**
     * Solo caché runtime (revalidación). Nunca borra el shell estático:
     * así la app sigue con CSS/JS offline tras pulsar actualizar sin red.
     */
    async function purgarCachesArchivosApp() {
        if (typeof caches === 'undefined' || !caches.keys) return;
        try {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => /^tiempos-runtime-/i.test(k))
                    .map((k) => caches.delete(k))
            );
        } catch (_) { /* ignore */ }
    }

    async function buscarActualizacionSw(reg) {
        if (!reg || typeof reg.update !== 'function') return { hayNuevaVersion: false };
        try {
            await reg.update();
        } catch (_) {
            return { hayNuevaVersion: false, errorRed: true };
        }
        if (reg.installing || reg.waiting) {
            return { hayNuevaVersion: true };
        }
        return { hayNuevaVersion: false };
    }

    /**
     * Actualiza archivos de la PWA (JS/CSS/HTML) sin borrar datos del usuario.
     * @param {{ beforeReload?: () => Promise<unknown> }} [opts]
     */
    async function actualizarAppPwa(opts) {
        const beforeReload = opts && typeof opts.beforeReload === 'function' ? opts.beforeReload : null;

        mostrarProgresoActualizacion('Comprobando nueva versión…');
        const reg = await obtenerRegistroSw();
        const { hayNuevaVersion, errorRed } = await buscarActualizacionSw(reg);

        if (hayNuevaVersion && reg) {
            mostrarProgresoActualizacion('Descargando archivos nuevos…');
            if (reg.installing) {
                await esperarEstadoWorker(reg.installing, 'installed');
            }
            mostrarProgresoActualizacion('Aplicando actualización…');
            await activarWorkerEnEspera(reg);
        } else if (errorRed && !navigator.onLine) {
            avisoActualizacion(
                'info',
                'Sin internet',
                'Se recarga con los archivos guardados en el teléfono (borradores intactos).'
            );
        }

        mostrarProgresoActualizacion('Refrescando pantalla…');
        if (navigator.onLine) {
            await purgarCachesArchivosApp();
        }

        if (beforeReload && navigator.onLine) {
            mostrarProgresoActualizacion('Sincronizando planilla…');
            try {
                await beforeReload();
            } catch (_) { /* no bloquear recarga */ }
        }

        cerrarProgresoActualizacion();
        const url = new URL(window.location.href);
        url.searchParams.set('_refresh', String(Date.now()));
        window.location.replace(url.toString());
    }

    async function confirmarActualizacionAppDesdeFab() {
        const titulo = 'Actualizar app y planilla';
        const texto = 'Se descargará la versión más reciente de la app y, si hay internet, sincronizará con la planilla. '
            + 'Puede haber lentitud o algún fallo puntual durante el proceso; eso ayuda a que la app quede al día. '
            + 'No se borran borradores ni pendientes.';
        if (window.Swal && typeof window.Swal.fire === 'function') {
            const resp = await window.Swal.fire({
                icon: 'info',
                title: titulo,
                text: texto,
                showCancelButton: true,
                confirmButtonText: 'Sí, actualizar',
                cancelButtonText: 'Cancelar',
                reverseButtons: true,
                focusCancel: true
            });
            return !!(resp && resp.isConfirmed);
        }
        return window.confirm(titulo + '\n\n' + texto);
    }

    async function actualizarAppCompletoDesdeFab() {
        if (actualizacionAppEnCurso) return;
        if (!(await confirmarActualizacionAppDesdeFab())) return;
        actualizacionAppEnCurso = true;
        cerrarMenusFabSiExisten();
        marcarBotonSyncActualizando(true);

        let syncPlanilla = null;
        if (typeof window.sincronizarConPlanillaAhora === 'function') {
            syncPlanilla = window.sincronizarConPlanillaAhora;
        } else if (typeof window.sincronizarConPlanillaPacking === 'function') {
            syncPlanilla = window.sincronizarConPlanillaPacking;
        }

        try {
            await actualizarAppPwa({ beforeReload: syncPlanilla });
        } catch (err) {
            cerrarProgresoActualizacion();
            marcarBotonSyncActualizando(false);
            avisoActualizacion(
                'error',
                'Actualización',
                String(err && err.message ? err.message : err || 'No se pudo actualizar.')
            );
        } finally {
            actualizacionAppEnCurso = false;
        }
    }

    window.actualizarAppPwa = actualizarAppPwa;
    window.actualizarAppCompletoDesdeFab = actualizarAppCompletoDesdeFab;

    function limpiarParametroRefreshEnUrl() {
        try {
            const u = new URL(window.location.href);
            if (!u.searchParams.has('_refresh')) return;
            u.searchParams.delete('_refresh');
            const destino = u.pathname + (u.search || '') + (u.hash || '');
            window.history.replaceState(null, '', destino);
        } catch (_) { /* ignore */ }
    }

    async function registrarPwaGlobal() {
        const rutas = rutasPwaDesdePagina();
        const swUrl = new URL(rutas.sw, window.location.href).href;
        const scopeUrl = new URL(rutas.scope, window.location.href).href;
        await navigator.serviceWorker.register(swUrl, {
            scope: scopeUrl,
            updateViaCache: 'none'
        });
        void precalentarNavegacionModulos(rutas.root);
    }

    function resolverHrefCampoNav() {
        const links = document.querySelectorAll('#nav-campo[href]');
        if (!links.length) return;
        let modo = 'visual';
        try {
            modo = localStorage.getItem('tiempos-header-tipo-registro-v2') || 'visual';
        } catch (_) { /* ignore */ }
        const root = prefijoRaizApp();
        const href = modo === 'acopio' ? root + 'acopio/' : root;
        links.forEach((a) => { a.setAttribute('href', href); });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            resolverHrefCampoNav();
            limpiarParametroRefreshEnUrl();
            try {
                await registrarPwaGlobal();
            } catch (_) {
                void precalentarNavegacionModulos();
            }
        });
    } else {
        window.addEventListener('load', () => {
            resolverHrefCampoNav();
            limpiarParametroRefreshEnUrl();
            void precalentarNavegacionModulos();
        });
    }

    if (window.NetworkSync && typeof window.NetworkSync.onConnectivityChange === 'function') {
        window.NetworkSync.onConnectivityChange((online) => {
            if (online && typeof window.NetworkSync.triggerPendingSync === 'function') {
                window.NetworkSync.triggerPendingSync();
            }
        });
    }
}());
