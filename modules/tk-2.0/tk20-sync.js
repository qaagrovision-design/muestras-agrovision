/** TK-2.0: cola offline compartida (tiempos-sync-queue-v1) y sincronización al volver internet. */
(function initTk20Sync() {
    const SYNC_QUEUE_KEY = 'tiempos-sync-queue-v1';
    let syncTk20EnCurso = false;

    function normalizarFechaIso(f) {
        const s = String(f || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s;
    }

    function apiUrl_() {
        return String(window.APPS_SCRIPT_API_URL || '').trim();
    }

    function uidLocalTk20() {
        return 'tk20_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function cargarColaSync() {
        try {
            const raw = localStorage.getItem(SYNC_QUEUE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            return [];
        }
    }

    function guardarColaSync(queue) {
        try {
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
        } catch (_) { /* ignore */ }
    }

    function esRegistroColaTk20(reg) {
        const modo = String(reg?.modo || '').trim().toLowerCase();
        if (modo === 'tk20' || modo === 'tk-2.0') return true;
        const p = reg?.payload || {};
        const mode = String(p.mode || '').trim().toLowerCase();
        return mode === 'tk20' || mode === 'tk-2.0';
    }

    function compactarColaSyncTk20_(queue) {
        return (Array.isArray(queue) ? queue : []).filter(
            (r) => String(r?.estado || '') === 'pendiente'
        );
    }

    function colaTk20PendienteCount_() {
        return cargarColaSync().filter((r) => (
            String(r?.estado || '') === 'pendiente' && esRegistroColaTk20(r)
        )).length;
    }

    function marcarColaTk20Enviada_(fecha, ensayoNumero, numMuestra) {
        const f = normalizarFechaIso(fecha) || String(fecha || '').trim();
        const en = String(ensayoNumero || '').trim();
        const nm = String(numMuestra || '').trim();
        if (!f || !en) return false;
        const queue = cargarColaSync();
        let hubo = false;
        queue.forEach((reg) => {
            if (String(reg?.estado || '') !== 'pendiente' || !esRegistroColaTk20(reg)) return;
            const rf = normalizarFechaIso(reg.fecha || reg.payload?.fecha || '')
                || String(reg.fecha || reg.payload?.fecha || '').trim();
            const ren = String(reg.ensayo_numero || reg.payload?.ensayo_numero || '').trim();
            const rnm = String(reg.num_muestra || reg.payload?.num_muestra || '').trim();
            if (rf === f && ren === en && (!nm || !rnm || rnm === nm)) {
                reg.estado = 'enviado';
                reg.actualizado_en = Date.now();
                hubo = true;
            }
        });
        if (hubo) guardarColaSync(compactarColaSyncTk20_(queue));
        return hubo;
    }

    async function confirmarTk20EnServidorTrasPost_(payload) {
        const fecha = String(payload?.fecha || '').trim();
        const ensayo = String(payload?.ensayo_numero || '').trim();
        const modoRegistro = String(payload?.modo_registro || '').trim().toLowerCase();
        const fetchDet = window.Tk20Header?.fetchDetalleServidor;
        if (!fecha || !ensayo || typeof fetchDet !== 'function') return false;
        const fetchOpts = (modoRegistro === 'acopio' || modoRegistro === 'visual')
            ? { modo_registro: modoRegistro }
            : undefined;
        try {
            const r = await fetchDet(fecha, ensayo, fetchOpts);
            return !!(r?.ok && r.data?.tieneTk20 === true);
        } catch (_) {
            return false;
        }
    }

    async function reconciliarColaTk20Pendientes_() {
        if (!navigator.onLine || !apiUrl_()) return;
        const queue = cargarColaSync();
        let huboCambios = false;
        for (let i = 0; i < queue.length; i++) {
            const reg = queue[i];
            if (!reg || String(reg.estado || '') !== 'pendiente' || !esRegistroColaTk20(reg)) continue;
            const body = reg.payload || reg;
            try {
                const ok = await confirmarTk20EnServidorTrasPost_(body);
                if (ok) {
                    reg.estado = 'enviado';
                    reg.actualizado_en = Date.now();
                    huboCambios = true;
                }
            } catch (_) { /* ignore */ }
        }
        if (huboCambios) guardarColaSync(compactarColaSyncTk20_(queue));
    }

    function encolarTk20Pendiente(payload) {
        const body = payload || {};
        const f = String(body.fecha || '').trim();
        const en = String(body.ensayo_numero || '').trim();
        const nm = String(body.num_muestra || '').trim();
        const dup = cargarColaSync().some((r) => {
            if (String(r?.estado || '') !== 'pendiente' || !esRegistroColaTk20(r)) return false;
            return String(r.fecha || '') === f
                && String(r.ensayo_numero || '') === en
                && String(r.num_muestra || '') === nm;
        });
        if (dup) return { duplicado: true };
        const reg = {
            uid: uidLocalTk20(),
            modo: 'tk-2.0',
            payload: body,
            fecha: f,
            ensayo_numero: en,
            num_muestra: nm,
            estado: 'pendiente',
            intentos: 0,
            creado_en: Date.now(),
            actualizado_en: Date.now(),
            error: ''
        };
        const queue = cargarColaSync();
        queue.push(reg);
        guardarColaSync(queue);
        window.Tk20Header?.actualizarHeaderPendientes?.();
        return reg;
    }

    async function guardarPdfTk20SyncDesdeBorrador_(reg) {
        const body = reg?.payload || {};
        const fechaSync = String(body.fecha || reg.fecha || '').trim();
        const numSync = String(body.num_muestra || reg.num_muestra || '').trim();
        const ensSync = String(body.ensayo_numero || reg.ensayo_numero || '').trim();
        const rawSync = numSync && ensSync ? (numSync + '|' + ensSync) : '';
        if (!fechaSync || !rawSync) return;
        let yaHayPdf = false;
        if (window.HistPdfStore && typeof window.HistPdfStore.existe === 'function') {
            yaHayPdf = await window.HistPdfStore.existe(fechaSync, ensSync, numSync, 'tk-2.0');
        }
        if (yaHayPdf) return;
        const borrador = window.Tk20Draft?.leerBorrador?.(fechaSync, rawSync);
        const capFn = window.Tk20Envio?.capturaEstadoMuestraParaValidacionTk20_;
        const cap = typeof capFn === 'function'
            ? capFn(rawSync)
            : (borrador?.estado ? {
                fecha: fechaSync,
                num_muestra: numSync,
                ensayo_numero: ensSync,
                raw: rawSync,
                estado: borrador.estado,
                detalle: borrador.detalleSnap || null
            } : null);
        if (!cap || !window.Tk20Envio?.capturaTk20ElegibleHistorialPdf_?.(cap)) return;
        if (window.Tk20Envio?.guardarPdfTk20HistorialTrasEnvio_) {
            await window.Tk20Envio.guardarPdfTk20HistorialTrasEnvio_([cap], fechaSync);
        }
    }

    async function sincronizarPendientesTk20() {
        if (syncTk20EnCurso) return;
        if (!navigator.onLine || !apiUrl_()) {
            window.Tk20Header?.actualizarHeaderPendientes?.();
            return;
        }
        await reconciliarColaTk20Pendientes_();
        const queue = cargarColaSync();
        if (!queue.some((r) => String(r?.estado || '') === 'pendiente' && esRegistroColaTk20(r))) {
            window.Tk20Header?.actualizarHeaderPendientes?.();
            return;
        }
        syncTk20EnCurso = true;
        let huboCambios = false;
        try {
            for (let i = 0; i < queue.length; i++) {
                const reg = queue[i];
                if (!reg || String(reg.estado || '') !== 'pendiente' || !esRegistroColaTk20(reg)) continue;
                const body = reg.payload;
                try {
                    await fetch(apiUrl_(), {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const ok = await confirmarTk20EnServidorTrasPost_(body);
                    if (ok) {
                        reg.estado = 'enviado';
                        reg.actualizado_en = Date.now();
                        huboCambios = true;
                        await guardarPdfTk20SyncDesdeBorrador_(reg);
                        const fechaSync = String(body.fecha || '').trim();
                        const numSync = String(body.num_muestra || '').trim();
                        const ensSync = String(body.ensayo_numero || '').trim();
                        const rawSync = numSync && ensSync ? (numSync + '|' + ensSync) : '';
                        if (fechaSync && rawSync) {
                            window.Tk20Draft?.limpiarTrasEnvioLocal?.(fechaSync, rawSync);
                        }
                        const rawActivo = window.Tk20Header?.getMuestraRaw?.() || '';
                        if (rawActivo === rawSync) {
                            window.Tk20Envio?.limpiarUiCapturaMuestraTk20_?.();
                            await window.Tk20Header?.aplicarExitoEnvioTk20_?.(fechaSync, rawSync);
                        }
                        window.Tk20Swal?.success?.(
                            'Cola enviada',
                            'TK-2.0 de muestra ' + (numSync || '') + ' subido a la planilla.'
                        );
                    } else {
                        reg.intentos = (Number(reg.intentos) || 0) + 1;
                        reg.actualizado_en = Date.now();
                    }
                } catch (err) {
                    reg.intentos = (Number(reg.intentos) || 0) + 1;
                    reg.error = String(err?.message || err);
                    reg.actualizado_en = Date.now();
                }
            }
            if (huboCambios) guardarColaSync(compactarColaSyncTk20_(queue));
        } finally {
            syncTk20EnCurso = false;
            window.Tk20Header?.actualizarHeaderPendientes?.();
        }
    }

    window.Tk20Sync = {
        esRegistroColaTk20,
        encolarTk20Pendiente,
        marcarColaTk20Enviada_,
        colaTk20PendienteCount_,
        sincronizarPendientesTk20
    };
    window.sincronizarPendientesTk20 = sincronizarPendientesTk20;
    window.Tk20Header?.actualizarHeaderPendientes?.();
}());
