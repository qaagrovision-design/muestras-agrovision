/** TK-2.0: borrador local por muestra (fecha + num|ensayo), como MP-TK. */
(function initTk20Draft() {
    const DRAFT_STORAGE_KEY = 'tk20-draft-v1';
    let draftSaveTimer = null;
    let restaurandoBorrador = false;
    let omitirAutoguardado = false;
    let ultimaClaveActiva = '';

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
        const activa = String(leerStore().activo || '').trim();
        const prefix = f + '::';
        if (!activa.startsWith(prefix)) return '';
        return activa.slice(prefix.length);
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

    function hayDatosCaptura(estado) {
        if (!estado || typeof estado !== 'object') return false;
        if (String(estado.responsable || '').trim()) return true;
        const t = estado.transporte || {};
        if (String(t.placa || '').trim() || String(t.guia || '').trim() || String(t.acopio || '').trim()) return true;
        const ctrl = estado.control || {};
        if (Object.values(ctrl).some((v) => String(v || '').trim())) return true;
        const etapas = estado.etapas || {};
        return Object.keys(etapas).some((k) => {
            const e = etapas[k];
            if (!e) return false;
            if (String(e.observacion || '').trim()) return true;
            if (String(e.horaRegistro || '').trim()) return true;
            const pesos = e.pesos || {};
            if (Object.values(pesos).some((p) => Number(p) > 0)) return true;
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
        if (!hayDatosCaptura(estado)) {
            const existing = store.porClave[key];
            if (!existing?.estado || !hayDatosCaptura(existing.estado)) {
                if (store.porClave[key]) {
                    delete store.porClave[key];
                    if (store.activo === key) store.activo = '';
                    guardarStore(store);
                }
            }
            return '';
        }
        store.porClave[key] = {
            estado,
            detalleSnap: opts?.detalleSnap || window.Tk20Header?.getLastDetalle?.() || null,
            actualizado: Date.now()
        };
        if (opts?.activa) store.activo = key;
        guardarStore(store);
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

    function guardarMuestraActivaInmediato() {
        if (restaurandoBorrador || omitirAutoguardado) return '';
        const fecha = window.Tk20Header?.getFecha?.() || '';
        const raw = window.Tk20Header?.getMuestraRaw?.() || '';
        return snapshotBorrador(fecha, raw, { activa: true });
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
        if (detalle?.tieneTk20 === true) {
            limpiarBorradorMuestra(fecha, raw);
            return false;
        }
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

    function persistirSoloLocal() {
        cancelarGuardadoProgramado();
        window.Tk20Modals?.persistirAbiertas?.();
        guardarMuestraActivaInmediato();
    }

    function setOmitirAutoguardado(on) {
        omitirAutoguardado = !!on;
    }

    function reafirmarBorradorAlVolverVisible() {
        persistirSoloLocal();
        const fecha = window.Tk20Header?.getFecha?.() || '';
        const raw = window.Tk20Header?.getMuestraRaw?.() || '';
        if (!fecha || !raw) return false;
        const detalle = window.Tk20Header?.getLastDetalle?.() || null;
        if (detalle?.tieneTk20 === true) return false;
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

    function limpiarTodo() {
        try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (_) { /* ignore */ }
        ultimaClaveActiva = '';
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
                persistirSoloLocal();
                return;
            }
            purgarBorradoresTk20OtrosDias_();
            reafirmarBorradorAlVolverVisible();
        });
        window.addEventListener('beforeunload', persistirSoloLocal);
        window.addEventListener('pagehide', persistirSoloLocal);
        window.addEventListener('freeze', persistirSoloLocal);
        const TK20_DRAFT_AUTOSAVE_MS = 3000;
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
        window.PdfPreviewLive?.programar?.();
    }

    bindAutosave();
    purgarBorradoresTk20OtrosDias_();

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
        limpiarTodo,
        purgarBorradoresOtrosDias: purgarBorradoresTk20OtrosDias_,
        muestrasConBorradorEnFecha,
        notificarCambio,
        notificarPdfVivo: notificarPdfVivoTk20_,
        claveBorrador,
        rawMuestraDesdeClaveActiva: rawMuestraDesdeClaveActiva_
    };
}());
