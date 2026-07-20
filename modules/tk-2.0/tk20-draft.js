/** TK-2.0: borrador local por muestra (fecha + num|ensayo), como MP-TK. */
(function initTk20Draft() {
    const DRAFT_STORAGE_KEY = 'tk20-draft-v1';
    let draftSaveTimer = null;
    let restaurandoBorrador = false;
    let omitirAutoguardado = false;
    let ultimaClaveActiva = '';
    /** Evita reescribir localStorage cada 3–8s si el estado no cambió (presión de RAM/GC). */
    let ultimoGuardadoFirma_ = '';

    function toast() {
        return window.Tk20Swal;
    }

    function claveBorrador(fecha, rawMuestra) {
        const f = String(fecha || '').trim();
        const r = String(rawMuestra || '').trim();
        if (!f || !r) return '';
        return f + '::' + r;
    }

    function rawMuestraDesdeClaveActiva_(fecha) {
        const f = String(fecha || '').trim();
        if (!f) return '';
        const store = leerStore();
        const activa = String(store.activo || '').trim();
        const prefix = f + '::';
        if (activa.startsWith(prefix)) {
            const raw = activa.slice(prefix.length);
            const row = store.porClave[activa];
            if (raw && row?.estado && hayDatosCaptura(row.estado)) return raw;
        }
        // Si no hay "activo" válido: usar el borrador más reciente del día (vuelta desde Campo).
        let bestRaw = '';
        let bestTs = -1;
        Object.keys(store.porClave || {}).forEach((k) => {
            if (!k.startsWith(prefix)) return;
            const row = store.porClave[k];
            if (!row?.estado || !hayDatosCaptura(row.estado)) return;
            const ts = Number(row.actualizado) || 0;
            if (ts >= bestTs) {
                bestTs = ts;
                bestRaw = k.slice(prefix.length);
            }
        });
        return bestRaw;
    }

    function leerStore() {
        try {
            const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
            const obj = raw ? JSON.parse(raw) : null;
            if (!obj || typeof obj !== 'object') return { activo: '', porClave: {} };
            return {
                activo: String(obj.activo || ''),
                porClave: obj.porClave && typeof obj.porClave === 'object' ? obj.porClave : {}
            };
        } catch (_) {
            return { activo: '', porClave: {} };
        }
    }

    function guardarStore(store) {
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(store));
        } catch (_) { /* ignore */ }
    }

    function purgarBorradoresTk20OtrosDias_() {
        const hoy = String(window.Tk20Header?.hoyIsoLocal?.() || window.FechaOperativa?.hoyIsoLocal?.() || '').trim();
        if (!hoy) return;
        const store = leerStore();
        let changed = false;
        if (window.FechaOperativa?.purgarStorePorFecha?.(store, { hoy, activoKey: 'activo' })) {
            changed = true;
        }
        Object.keys(store.porClave || {}).forEach((key) => {
            const fecha = String(key.split('::')[0] || '').trim();
            if (fecha && fecha !== hoy) {
                delete store.porClave[key];
                changed = true;
            }
        });
        const activo = String(store.activo || '').trim();
        if (activo && !activo.startsWith(hoy + '::')) {
            store.activo = '';
            changed = true;
        }
        if (changed) guardarStore(store);
    }

    function etapaDesdeCard(etapaKey) {
        const exp = window.Tk20Body?.exportEstado?.()?.[etapaKey];
        const card = window.Tk20Body?.getEtapaCard?.(etapaKey);
        if (!exp && !card) return null;
        return {
            pesos: Object.assign({}, card?.pesos || {}, exp?.pesos || {}),
            presion: Object.assign({}, card?.presion || {}, exp?.presion || {}),
            observacion: String(exp?.observacion || card?.observacion || '').trim(),
            horaRegistro: String(exp?.horaRegistro || card?.horaRegistro || '').trim()
        };
    }

    function capturarEstadoUi() {
        window.Tk20Modals?.persistirAbiertas?.();
        window.Tk20Presion?.recalcularTodas?.({ render: false });
        return {
            responsable: window.Tk20Envio?.getResponsable?.() || '',
            transporte: window.Tk20Transporte?.getValores?.() || {},
            control: window.Tk20Control?.getValores?.() || {},
            etapas: {
                llegada: etapaDesdeCard('llegada'),
                traslado: etapaDesdeCard('traslado')
            }
        };
    }

    function pesoCapturaTieneValor_(p) {
        const n = Number(p);
        if (Number.isFinite(n) && n > 0) return true;
        const s = String(p ?? '').trim();
        if (!s || s === '0' || s === '00') return false;
        return Number(s.replace(',', '.')) > 0;
    }

    /**
     * Solo captura real del operador.
     * NO cuenta horaRegistro: se rellena sola al crear el card y, si contaba,
     * al reentrar se pisaba el borrador con pesos en 00.
     */
    function hayDatosCaptura(estado) {
        if (!estado || typeof estado !== 'object') return false;
        if (String(estado.responsable || '').trim()) return true;
        const t = estado.transporte || {};
        if (String(t.placa || '').trim() || String(t.guia || '').trim() || String(t.acopio || '').trim()) return true;
        const ctrl = estado.control || {};
        if (Object.values(ctrl).some((v) => {
            if (v && typeof v === 'object') {
                return Object.values(v).some((x) => String(x ?? '').trim() !== '');
            }
            return String(v || '').trim() !== '';
        })) return true;
        const etapas = estado.etapas || {};
        return Object.keys(etapas).some((k) => {
            const e = etapas[k];
            if (!e) return false;
            if (String(e.observacion || '').trim()) return true;
            const pesos = e.pesos || {};
            if (Object.values(pesos).some(pesoCapturaTieneValor_)) return true;
            const pres = e.presion || {};
            return Object.values(pres).some((p) => String(p || '').trim());
        });
    }

    function aplicarEstado(estado) {
        if (!estado) return;
        restaurandoBorrador = true;
        try {
            const elResp = document.getElementById('tk2_responsable');
            if (elResp) elResp.value = String(estado.responsable || '');
            window.Tk20Transporte?.aplicarValores?.(estado.transporte || {});
            window.Tk20Control?.setValores?.(estado.control || {});
            window.Tk20Body?.importEstado?.(estado.etapas || {});
            window.Tk20Presion?.recalcularTodas?.({ render: true });
            window.Tk20Envio?.actualizarBtnEnviar?.();
            window.Tk20Transporte?.actualizarBotonTransporte?.();
        } finally {
            restaurandoBorrador = false;
        }
    }

    function snapshotBorrador(fecha, rawMuestra, opts) {
        const key = claveBorrador(fecha, rawMuestra);
        if (!key) return '';
        const estado = opts?.estado || capturarEstadoUi();
        const store = leerStore();
        const existing = store.porClave[key];
        if (!hayDatosCaptura(estado)) {
            if (!existing?.estado || !hayDatosCaptura(existing.estado)) {
                if (store.porClave[key]) {
                    delete store.porClave[key];
                    if (store.activo === key) store.activo = '';
                    guardarStore(store);
                    ultimoGuardadoFirma_ = '';
                }
            } else if (opts?.activa) {
                // UI vacía al reentrar, pero hay borrador: no pisar; solo punta activa.
                store.activo = key;
                ultimaClaveActiva = key;
                guardarStore(store);
            }
            return existing && hayDatosCaptura(existing.estado) ? key : '';
        }
        // Firma solo del estado de captura: evita stringify de detalleSnap enorme cada tick.
        let firma = '';
        try {
            firma = key + '|' + JSON.stringify(estado);
        } catch (_) {
            firma = key + '|' + Date.now();
        }
        if (firma === ultimoGuardadoFirma_ && store.porClave[key]) {
            if (opts?.activa !== false) {
                ultimaClaveActiva = key;
                if (store.activo !== key) {
                    store.activo = key;
                    guardarStore(store);
                }
            }
            return key;
        }
        store.porClave[key] = {
            estado,
            detalleSnap: opts?.detalleSnap || existing?.detalleSnap
                || window.Tk20Header?.getLastDetalle?.() || null,
            actualizado: Date.now()
        };
        if (opts?.activa !== false) {
            store.activo = key;
            ultimaClaveActiva = key;
        }
        guardarStore(store);
        ultimoGuardadoFirma_ = firma;
        return key;
    }

    function leerBorrador(fecha, rawMuestra) {
        const key = claveBorrador(fecha, rawMuestra);
        if (!key) return null;
        return leerStore().porClave[key] || null;
    }

    function cancelarGuardadoProgramado() {
        if (draftSaveTimer) {
            clearTimeout(draftSaveTimer);
            draftSaveTimer = null;
        }
    }

    function guardarMuestraActivaInmediato(opts) {
        const forzar = !!(opts && opts.forzar);
        // Autoguardado normal respeta omitir; salida de módulo / cierre siempre fuerza.
        if (restaurandoBorrador) return '';
        if (omitirAutoguardado && !forzar) return '';
        let fecha = window.Tk20Header?.getFecha?.() || '';
        let raw = window.Tk20Header?.getMuestraRaw?.() || '';
        if ((!fecha || !raw) && ultimaClaveActiva) {
            const parts = String(ultimaClaveActiva).split('::');
            if (parts.length >= 2) {
                if (!fecha) fecha = parts[0];
                if (!raw) raw = parts.slice(1).join('::');
            }
        }
        if (!fecha || !raw) {
            // Último recurso: punta activa en store.
            const store = leerStore();
            const activa = String(store.activo || '').trim();
            const ix = activa.indexOf('::');
            if (ix > 0) {
                fecha = fecha || activa.slice(0, ix);
                raw = raw || activa.slice(ix + 2);
            }
        }
        return snapshotBorrador(fecha, raw, { activa: true, forzar });
    }

    function programarGuardado() {
        if (restaurandoBorrador || omitirAutoguardado) return;
        cancelarGuardadoProgramado();
        draftSaveTimer = setTimeout(() => {
            draftSaveTimer = null;
            guardarMuestraActivaInmediato();
        }, 220);
    }

    function guardarMuestraAnteriorSiHay() {
        if (!ultimaClaveActiva) return;
        const parts = ultimaClaveActiva.split('::');
        if (parts.length < 2) return;
        snapshotBorrador(parts[0], parts.slice(1).join('::'), { activa: false });
    }

    function restaurarBorradorSiHay(fecha, raw, detalle) {
        const borrador = leerBorrador(fecha, raw);
        if (!borrador?.estado || !hayDatosCaptura(borrador.estado)) return false;
        // Si hay borrador local, siempre restaurarlo (también con tieneTk20: falso positivo
        // o carrera). El envío queda bloqueado por UI; el draft se limpia solo al envío OK.
        void detalle;
        aplicarEstado(borrador.estado);
        return true;
    }

    function setMuestraActivaClave(fecha, rawMuestra) {
        const key = claveBorrador(fecha, rawMuestra);
        ultimaClaveActiva = key;
        if (!key) return;
        const store = leerStore();
        store.activo = key;
        guardarStore(store);
    }

    function snapshotMuestraExplicita(fecha, rawMuestra) {
        if (!fecha || !rawMuestra) return;
        snapshotBorrador(fecha, rawMuestra, { activa: false });
    }

    /** Persistencia local. forzar=true al salir de módulo / cerrar app (ignora omitirAutoguardado). */
    function persistirSoloLocal(opts) {
        cancelarGuardadoProgramado();
        window.Tk20Modals?.persistirAbiertas?.();
        guardarMuestraActivaInmediato({ forzar: !!(opts && opts.forzar) || !!(opts === true) });
    }

    function setOmitirAutoguardado(on) {
        omitirAutoguardado = !!on;
    }

    function reafirmarBorradorAlVolverVisible() {
        persistirSoloLocal({ forzar: true });
        const fecha = window.Tk20Header?.getFecha?.() || '';
        const raw = window.Tk20Header?.getMuestraRaw?.() || '';
        if (!fecha || !raw) return false;
        const borrador = leerBorrador(fecha, raw);
        if (!borrador?.estado || !hayDatosCaptura(borrador.estado)) return false;
        const actual = capturarEstadoUi();
        if (hayDatosCaptura(actual)) return false;
        restaurandoBorrador = true;
        try {
            aplicarEstado(borrador.estado);
        } finally {
            restaurandoBorrador = false;
        }
        return true;
    }

    function limpiarBorradorMuestraActiva() {
        const fecha = window.Tk20Header?.getFecha?.() || '';
        const raw = window.Tk20Header?.getMuestraRaw?.() || '';
        limpiarBorradorMuestra(fecha, raw);
        ultimaClaveActiva = '';
    }

    function limpiarBorradorMuestra(fecha, rawMuestra) {
        const key = claveBorrador(fecha, rawMuestra);
        if (!key) return;
        const store = leerStore();
        if (!store.porClave[key]) return;
        delete store.porClave[key];
        if (store.activo === key) store.activo = '';
        guardarStore(store);
    }

    function limpiarTrasEnvioLocal(fecha, rawMuestra) {
        limpiarBorradorMuestra(fecha, rawMuestra);
        const f = String(fecha || '').trim();
        const r = String(rawMuestra || '').trim();
        if (claveBorrador(f, r) === ultimaClaveActiva) ultimaClaveActiva = '';
        omitirAutoguardado = true;
        setTimeout(() => { omitirAutoguardado = false; }, 400);
    }

    function muestrasConBorradorEnFecha(fecha) {
        const f = String(fecha || '').trim();
        if (!f) return [];
        const store = leerStore();
        return Object.keys(store.porClave)
            .filter((k) => k.startsWith(f + '::'))
            .map((k) => k.slice(f.length + 2))
            .filter(Boolean);
    }

    function onDetalleCargado(ev) {
        const detalle = ev?.detail?.data || null;
        const fecha = window.Tk20Header?.getFecha?.() || '';
        const raw = window.Tk20Header?.getMuestraRaw?.() || '';
        if (!detalle || !fecha || !raw) {
            ultimaClaveActiva = '';
            return;
        }
        setMuestraActivaClave(fecha, raw);
    }

    function bindAutosave() {
        document.getElementById('tk2_responsable')?.addEventListener('input', programarGuardado);
        document.getElementById('tk2_responsable')?.addEventListener('change', programarGuardado);
        window.addEventListener('tk20:estado-cambiado', programarGuardado);
        window.addEventListener('tk20:detalle', onDetalleCargado);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                persistirSoloLocal({ forzar: true });
                return;
            }
            purgarBorradoresTk20OtrosDias_();
            reafirmarBorradorAlVolverVisible();
        });
        window.addEventListener('beforeunload', () => persistirSoloLocal({ forzar: true }));
        window.addEventListener('pagehide', () => persistirSoloLocal({ forzar: true }));
        window.addEventListener('freeze', () => persistirSoloLocal({ forzar: true }));
        const TK20_DRAFT_AUTOSAVE_MS = 8000;
        setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            if (restaurandoBorrador || omitirAutoguardado) return;
            if (!String(window.Tk20Header?.getMuestraRaw?.() || '').trim()) return;
            persistirSoloLocal();
        }, TK20_DRAFT_AUTOSAVE_MS);
    }

    function notificarCambio() {
        if (!restaurandoBorrador) {
            window.dispatchEvent(new CustomEvent('tk20:estado-cambiado'));
            notificarPdfVivoTk20_();
        }
    }

    function notificarPdfVivoTk20_() {
        if (!window.PdfPreviewLive?.modalAbierto?.()) return;
        window.PdfPreviewLive.programar();
    }

    bindAutosave();
    purgarBorradoresTk20OtrosDias_();
    if (typeof window.solicitarAlmacenamientoPersistenteApp === 'function') {
        window.solicitarAlmacenamientoPersistenteApp();
    }
    if (typeof window.bindNavPersistDraft === 'function') {
        // tope más alto: en móvil localStorage necesita un respiro al ir a Campo.
        window.bindNavPersistDraft(() => persistirSoloLocal({ forzar: true }), { topeMs: 220 });
    }
    try {
        window.dispatchEvent(new Event('tk20:draft-listo'));
    } catch (_) { /* ignore */ }

    window.Tk20Draft = {
        capturarEstadoUi,
        hayDatosCaptura,
        aplicarEstado,
        guardarMuestraActivaInmediato,
        programarGuardado,
        cancelarGuardadoProgramado,
        setOmitirAutoguardado,
        guardarMuestraAnteriorSiHay,
        restaurarBorradorSiHay,
        setMuestraActivaClave,
        snapshotMuestraExplicita,
        snapshotBorrador,
        leerBorrador,
        limpiarBorradorMuestra,
        limpiarBorradorMuestraActiva,
        limpiarTrasEnvioLocal,
        persistirSoloLocal,
        purgarBorradoresOtrosDias: purgarBorradoresTk20OtrosDias_,
        muestrasConBorradorEnFecha,
        notificarCambio,
        notificarPdfVivo: notificarPdfVivoTk20_,
        claveBorrador,
        rawMuestraDesdeClaveActiva: rawMuestraDesdeClaveActiva_
    };
}());
