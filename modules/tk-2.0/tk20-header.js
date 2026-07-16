/** TK-2.0: header compartido visualmente con MP-TK; solo consulta y muestra datos. */
(function initTk20Header() {
    const API_URL = String(window.APPS_SCRIPT_API_URL || '').trim();
    const CHIPS_COLLAPSED_KEY = 'tk20-chips-collapsed-v1';
    const MIN_LOADER_MS = 200;

    const elFecha = document.getElementById('mptk-fecha');
    const elMuestra = document.getElementById('mptk-muestra');
    const elStatus = document.getElementById('mptk-status');
    const elStatusWrap = document.getElementById('mptk-status-wrap');
    const elStatusRetry = document.getElementById('mptk-status-retry');
    const elSelectBlock = document.getElementById('mptk-select-block');
    const elSelectLoader = document.getElementById('mptk-select-loader');
    const elSelectLoaderMsg = document.getElementById('mptk-select-loader-msg');
    const elMetaShell = document.getElementById('mptk-meta-shell');
    const elResumen = document.getElementById('mptk-resumen');
    const elPreview = document.getElementById('mptk-preview');
    const elPreviewLoader = document.getElementById('mptk-preview-loader');
    const elPreviewLoaderMsg = document.getElementById('mptk-preview-loader-msg');
    const elChipsPanel = document.getElementById('mptk-chips-panel');
    const elResumenToggle = document.getElementById('mptk-resumen-toggle');
    const elHeaderCard = document.getElementById('header-status-card');
    const elHeaderConn = document.getElementById('header-conn-label');
    const elHeaderPend = document.getElementById('header-pendientes-count');
    const elHeaderWifi = document.getElementById('header-status-wifi');

    let cargandoMuestrasSeq = 0;
    let cargandoDetalleSeq = 0;
    let lastDetalle = null;
    let foldBtnSyncRaf = 0;
    let tk20ListaMuestrasMetaCache_ = { fecha: '', porRaw: {} };
    let tk20StatusRetryKind_ = '';
    let tk20StatusRetryBusy_ = false;

    function hoyIsoLocal() {
        const d = new Date();
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function sleepMs(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    async function withMinLoader(fn) {
        const t0 = Date.now();
        const out = await fn();
        const wait = MIN_LOADER_MS - (Date.now() - t0);
        if (wait > 0) await sleepMs(wait);
        return out;
    }

    function normalizarFechaIso(f) {
        const s = String(f || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s;
    }

    function callbackJsonp(params, timeoutMs) {
        if (!navigator.onLine) {
            return Promise.reject(new Error('Sin internet'));
        }
        const limiteMs = Number(timeoutMs);
        const espera = window.NetworkSync?.jsonpTimeoutMs
            ? window.NetworkSync.jsonpTimeoutMs(limiteMs)
            : (Number.isFinite(limiteMs) && limiteMs > 0 ? Math.min(limiteMs, 25000) : 15000);
        return new Promise((resolve, reject) => {
            const cb = '__tk20_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            const noop = function () {};
            const qs = new URLSearchParams(params || {});
            qs.set('callback', cb);
            qs.set('_ts', String(Date.now()));
            const src = API_URL + (API_URL.includes('?') ? '&' : '?') + qs.toString();
            const script = document.createElement('script');
            let done = false;
            const timeoutId = setTimeout(() => {
                if (done) return;
                done = true;
                window[cb] = noop;
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('La planilla tardó demasiado. Reintenta.'));
            }, espera);
            window[cb] = (payload) => {
                if (done) return;
                done = true;
                clearTimeout(timeoutId);
                window[cb] = noop;
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(payload);
            };
            script.onerror = () => {
                if (done) return;
                done = true;
                clearTimeout(timeoutId);
                window[cb] = noop;
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Error de conexión con el servidor'));
            };
            script.src = src;
            document.body.appendChild(script);
        });
    }

    async function fetchMuestrasPorFecha(fechaIso) {
        const topes = window.NetworkSync?.listadoTimeoutsMs?.() || [18000, 18000];
        const run = window.NetworkSync?.conReintentosTimeouts
            ? (fn) => window.NetworkSync.conReintentosTimeouts(topes, fn)
            : async (fn) => fn(topes[0] || 18000, 0);

        const r = await run((ms) => callbackJsonp({
            listado_muestras_fecha: '1',
            fecha: fechaIso
        }, ms));
        if (r && r.ok === true && Array.isArray(r.muestras)) {
            return r.muestras;
        }
        const err = String(r?.error || '');
        if (err === 'accion_no_soportada') {
            throw new Error('Redespliega code.gs en Apps Script (falta listado_muestras_fecha)');
        }
        const r2 = await run((ms) => callbackJsonp({
            listado_registrados: '1',
            fecha_desde: fechaIso,
            fecha_hasta: fechaIso
        }, ms));
        if (r2 && r2.ok === true && Array.isArray(r2.registrados)) {
            const seen = {};
            const lista = [];
            r2.registrados.forEach((item) => {
                const f = normalizarFechaIso(item?.fecha);
                if (f !== fechaIso) return;
                const num = String(item?.num_muestra || '').trim();
                const en = String(item?.ensayo_numero || '').trim();
                if (!num || !en) return;
                const key = num + '|' + en;
                if (seen[key]) return;
                seen[key] = true;
                lista.push({ num_muestra: num, ensayo_numero: en });
            });
            lista.sort((a, b) => (Number(a.ensayo_numero) || 0) - (Number(b.ensayo_numero) || 0));
            return lista;
        }
        throw new Error(String(r?.error || r2?.error || 'No se pudo leer el listado'));
    }

    function ensayoSeleccionado() {
        const raw = String(elMuestra?.value || '').trim();
        const parts = raw.split('|');
        const opt = elMuestra?.selectedOptions?.[0];
        const modoOpt = String(opt?.dataset?.modoRegistro || '').trim().toLowerCase();
        const modoDet = String(lastDetalle?.modo_registro || '').trim().toLowerCase();
        const modo = (modoDet === 'acopio' || modoDet === 'visual')
            ? modoDet
            : ((modoOpt === 'acopio' || modoOpt === 'visual') ? modoOpt : '');
        return {
            num_muestra: parts[0] || '',
            ensayo_numero: parts.length >= 2 ? parts[1] : '',
            modo_registro: modo,
            raw
        };
    }

    async function fetchDetalle(fechaIso, ensayoNumero, opts) {
        if (!navigator.onLine) {
            throw new Error('Sin internet');
        }
        const sel = ensayoSeleccionado();
        const modo = String(opts?.modo_registro || sel.modo_registro || '').trim().toLowerCase();
        const params = { fecha: fechaIso, ensayo_numero: ensayoNumero };
        if (modo === 'acopio' || modo === 'visual') params.modo_registro = modo;
        const intentos = opts?.revalidar
            ? (window.NetworkSync?.detalleRevalidarTimeoutsMs?.() || [14000])
            : (window.NetworkSync?.detalleTimeoutsMs?.() || [16000, 16000]);
        let ultimoErr = null;
        for (let i = 0; i < intentos.length; i++) {
            try {
                return await callbackJsonp(params, intentos[i]);
            } catch (err) {
                ultimoErr = err;
            }
        }
        throw ultimoErr || new Error('La planilla tardó demasiado. Reintenta.');
    }

    function claveRawMuestraTk20_(item) {
        const num = String(item?.num_muestra || '').trim();
        const en = String(item?.ensayo_numero || '').trim();
        return num && en ? (num + '|' + en) : '';
    }

    function actualizarCacheListaMuestrasTk20_(lista, fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        const porRaw = {};
        (lista || []).forEach((item) => {
            const raw = claveRawMuestraTk20_(item);
            if (raw) porRaw[raw] = item;
        });
        tk20ListaMuestrasMetaCache_ = { fecha, porRaw };
    }

    function getMetaListaMuestraTk20_(fechaIso, raw) {
        const fecha = normalizarFechaIso(fechaIso);
        const rawStr = String(raw || '').trim();
        if (!fecha || !rawStr || tk20ListaMuestrasMetaCache_.fecha !== fecha) return null;
        return tk20ListaMuestrasMetaCache_.porRaw[rawStr] || null;
    }

    function normalizarItemMuestraTk20_(item) {
        return {
            num_muestra: String(item?.num_muestra || '').trim(),
            ensayo_numero: String(item?.ensayo_numero || '').trim(),
            modo_registro: String(item?.modo_registro || '').trim().toLowerCase(),
            puede_continuar_tk20: item?.puede_continuar_tk20 === true,
            campo_completo_hora_registro: item?.campo_completo_hora_registro === true,
            tieneTk20: item?.tieneTk20 === true,
            filasCampoConHoraRegistro: Number(item?.filasCampoConHoraRegistro) || 0,
            numFilas: Number(item?.numFilas) || 0,
            maxClamshell: Number(item?.maxClamshell) || 0,
            tiene_campo_hora_registro: item?.tiene_campo_hora_registro === true,
            borrador_local: item?.borrador_local === true,
            FUNDO: String(item?.FUNDO ?? item?.fundo ?? '').trim(),
            fundo_habilita_flujo_tk20: item?.fundo_habilita_flujo_tk20 === true
        };
    }

    /** Todas las muestras del día (como Packing / MP-TK). Validación al elegir. */
    function normalizarListaMuestrasOperativasTk20_(lista) {
        if (!lista.length) return [];
        const out = [];
        const seen = new Set();
        lista.forEach((item) => {
            const norm = normalizarItemMuestraTk20_(item);
            if (!norm.ensayo_numero) return;
            const modo = (norm.modo_registro === 'acopio') ? 'acopio' : 'visual';
            const key = modo + '|' + norm.num_muestra + '|' + norm.ensayo_numero;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(norm);
        });
        out.sort((a, b) => (Number(a.ensayo_numero) || 0) - (Number(b.ensayo_numero) || 0));
        return out;
    }

    function fusionarBorradoresLocales(lista, fechaIso) {
        const merged = normalizarListaMuestrasOperativasTk20_(lista || []);
        const seen = new Set(merged.map((item) => {
            const modo = (item.modo_registro === 'acopio') ? 'acopio' : 'visual';
            return modo + '|' + item.num_muestra + '|' + item.ensayo_numero;
        }));
        (window.Tk20Draft?.muestrasConBorradorEnFecha?.(fechaIso) || []).forEach((raw) => {
            const parts = String(raw || '').split('|');
            const num = String(parts[0] || '').trim();
            const en = String(parts[1] || '').trim();
            if (!en) return;
            const borrador = window.Tk20Draft?.leerBorrador?.(fechaIso, raw);
            const snap = borrador?.detalleSnap || {};
            const modo = String(snap.modo_registro || '').trim().toLowerCase() === 'acopio' ? 'acopio' : 'visual';
            const key = modo + '|' + num + '|' + en;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(normalizarItemMuestraTk20_({
                num_muestra: num,
                ensayo_numero: en,
                modo_registro: snap.modo_registro || '',
                tieneTk20: snap.tieneTk20,
                campo_completo_hora_registro: snap.campo_completo_hora_registro,
                puede_continuar_tk20: snap.puede_continuar_tk20,
                filasCampoConHoraRegistro: snap.FILAS_CAMPO_CON_HORA_REGISTRO,
                numFilas: snap.numFilas ?? snap.FILAS_TOTAL_CAMPO,
                maxClamshell: snap.MAX_CLAMSHELL,
                FUNDO: snap.FUNDO ?? snap.fundo,
                fundo_habilita_flujo_tk20: snap.fundo_habilita_flujo_tk20,
                borrador_local: true
            }));
        });
        merged.sort((a, b) => (Number(a.ensayo_numero) || 0) - (Number(b.ensayo_numero) || 0));
        return merged;
    }

    function maxClamshellDesdeDetalle(d) {
        let max = Number(d?.MAX_CLAMSHELL ?? 0);
        if (!max && d?.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        const totalCampo = Number(d?.FILAS_TOTAL_CAMPO ?? d?.numFilas ?? 0);
        if (totalCampo > 0 && (max <= 0 || max < totalCampo)) max = totalCampo;
        return max > 0 ? max : 0;
    }

    function filasRegistradasDesdeDetalle(d) {
        if (!d || typeof d !== 'object') return 0;
        const conHoraCampo = Number(d.FILAS_CAMPO_CON_HORA_REGISTRO);
        if (Number.isFinite(conHoraCampo) && conHoraCampo >= 0) return conHoraCampo;
        return Number(d.FILAS_REGISTRADAS ?? d.FILAS_TOTAL_CAMPO ?? 0) || 0;
    }

    function etiquetaModoRegistro(d) {
        if (window.MensajesFlujo?.etiquetaOrigen) {
            const o = window.MensajesFlujo.etiquetaOrigen(d);
            return o === 'Campo o Acopio' ? '' : o;
        }
        const modo = String(d?.modo_registro || d?.hoja_registro || '').trim().toLowerCase();
        if (modo === 'acopio') return 'Acopio';
        if (modo === 'visual') return 'Campo';
        return '';
    }

    function fundoHabilitaTk20_(d) {
        return window.FundoFlujoTk20?.habilitaDesdeDetalle?.(d) === true;
    }

    function campoListoParaTk20Detalle(d) {
        if (!fundoHabilitaTk20_(d)) return false;
        if (!d || d.tieneTk20 === true) return false;
        if (d.campo_completo_hora_registro === true) return true;
        if (d.puede_continuar_tk20 === true) return true;
        const max = maxClamshellDesdeDetalle(d);
        const hechas = filasRegistradasDesdeDetalle(d);
        return max > 0 && hechas >= max;
    }

    function actualizarStatusDesdeDetalle(d) {
        const M = window.MensajesFlujo;
        if (!d) return;
        if (!fundoHabilitaTk20_(d)) {
            setStatus(prefijoOrigenStatus_(d) + (M?.fundoNoUsaTk20?.(d) || window.FundoFlujoTk20?.mensajeFundoNoHabilitado?.(d) || 'Solo fundo A9.'), 'warn');
            if (elStatus) elStatus.hidden = false;
            return;
        }
        const max = maxClamshellDesdeDetalle(d);
        const hechas = filasRegistradasDesdeDetalle(d);
        if (d.tieneTk20 === true) {
            setStatus(M?.tk20YaEnviado?.(d) || (prefijoOrigenStatus_(d) + 'TK-2.0 ya fue enviado.'), 'warn');
            return;
        }
        if (d.puede_continuar_tk20 === false && !campoListoParaTk20Detalle(d)) {
            setStatus(
                prefijoOrigenStatus_(d) + (M?.campoIncompletoTk20?.(d, hechas, max) || 'Termina Campo o Acopio primero.'),
                'warn'
            );
            return;
        }
        if (max > 0 && hechas >= max) {
            setStatus(
                prefijoOrigenStatus_(d) + (M?.campoListoTk20?.(d, hechas, max) || 'Campo listo para TK-2.0.'),
                ''
            );
            if (elStatus) elStatus.hidden = false;
            return;
        }
        setStatus('');
        if (elStatus) elStatus.hidden = true;
    }

    function prefijoOrigenStatus_(d) {
        const modo = etiquetaModoRegistro(d);
        return modo ? (modo + ' · ') : '';
    }

    function textoSelectMuestra(num, en) {
        const n = String(num || '').trim();
        const e = String(en || '').trim();
        return n && e ? (n + ' - ' + e + ' muestra') : (n || e);
    }

    function poblarSelectMuestra(lista, opts) {
        if (!elMuestra) return;
        const preserveRaw = String(opts?.preserveRaw || elMuestra.value || '').trim();
        elMuestra.innerHTML = '';
        const opt0 = document.createElement('option');
        opt0.value = '';
        const n = lista.length;
        opt0.textContent = n ? ('Seleccionar muestra (' + n + ')') : 'Sin muestras';
        elMuestra.appendChild(opt0);
        lista.forEach((item) => {
            const opt = document.createElement('option');
            const num = String(item.num_muestra || '').trim();
            const en = String(item.ensayo_numero || '').trim();
            const modo = String(item.modo_registro || '').trim().toLowerCase();
            opt.value = num + '|' + en;
            if (modo === 'acopio' || modo === 'visual') opt.dataset.modoRegistro = modo;
            if (item.tieneTk20 === true) opt.dataset.tieneTk20 = '1';
            const aplicaTk20 = fundoHabilitaTk20_(item);
            opt.dataset.fundoHabilitaTk20 = aplicaTk20 ? '1' : '0';
            if (item.FUNDO) opt.dataset.fundo = String(item.FUNDO).trim();
            const campoOk = campoListoParaTk20Detalle(item) || item.tieneTk20 === true;
            opt.dataset.campoListo = campoOk ? '1' : '0';
            const hojaTag = modo === 'acopio' ? ' · Acopio' : (modo === 'visual' ? ' · Campo' : '');
            opt.textContent = textoSelectMuestra(num, en) + hojaTag;
            elMuestra.appendChild(opt);
        });
        elMuestra.disabled = n === 0;
        if (n === 0) elMuestra.setAttribute('disabled', 'disabled');
        else elMuestra.removeAttribute('disabled');
        if (preserveRaw && Array.from(elMuestra.options).some((o) => o.value === preserveRaw)) {
            elMuestra.value = preserveRaw;
            tk20MuestraAnterior = preserveRaw;
        }
    }

    /**
     * Enlaza selector + detalle/borrador a la muestra activa.
     * soloSiHaceFalta: no recarga detalle si ya estamos en esa muestra con UI.
     */
    function asegurarMuestraActivaYDatosTk20_(fecha, rawPreferido, opts) {
        const fechaIso = normalizarFechaIso(fecha);
        if (!fechaIso || !elMuestra) return false;
        const rawActivo = String(rawPreferido || '').trim()
            || window.Tk20Draft?.rawMuestraDesdeClaveActiva?.(fechaIso)
            || '';
        if (!rawActivo) return false;
        const opt = Array.from(elMuestra.options).find((o) => o.value === rawActivo);
        if (!opt) return false;
        const yaSeleccionada = String(elMuestra.value || '').trim() === rawActivo;
        elMuestra.value = rawActivo;
        tk20MuestraAnterior = rawActivo;
        window.Tk20Draft?.setMuestraActivaClave?.(fechaIso, rawActivo);
        const ensayoNumero = String(rawActivo.split('|')[1] || '').trim();
        if (!ensayoNumero) return false;
        // Solo saltar si la UI YA tiene captura visible (vuelta de módulo con pantalla vacía → cargar).
        if (opts?.soloSiHaceFalta && yaSeleccionada) {
            const hayUi = !!(window.Tk20Draft?.hayDatosCaptura?.(window.Tk20Draft?.capturarEstadoUi?.()));
            if (hayUi) return true;
        }
        void cargarDetalle(fechaIso, ensayoNumero);
        return true;
    }

    function restaurarMuestraActivaDesdeBorradorTk20_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        return asegurarMuestraActivaYDatosTk20_(fecha, '', { soloSiHaceFalta: false });
    }

    function listaCacheMuestrasTk20_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha || tk20ListaMuestrasMetaCache_.fecha !== fecha) return [];
        return Object.keys(tk20ListaMuestrasMetaCache_.porRaw || {}).map((k) => tk20ListaMuestrasMetaCache_.porRaw[k]);
    }

    async function cargarMuestrasPorFecha(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) {
            poblarSelectMuestra([]);
            return;
        }
        const seq = ++cargandoMuestrasSeq;
        // No cancelar detalle en curso: el listado local-first no debe vaciar la captura.
        const rawAntes = String(elMuestra?.value || '').trim()
            || window.Tk20Draft?.rawMuestraDesdeClaveActiva?.(fecha)
            || '';

        // Guardar captura ANTES de tocar el selector (evita “desapareció la data”).
        try {
            window.Tk20Draft?.persistirSoloLocal?.({ forzar: true });
        } catch (_) { /* ignore */ }

        // Pintar ya cache + borradores locales (sin esperar al servidor).
        const listaInmediata = fusionarBorradoresLocales(listaCacheMuestrasTk20_(fecha), fecha);
        if (listaInmediata.length) {
            poblarSelectMuestra(listaInmediata, { preserveRaw: rawAntes });
            asegurarMuestraActivaYDatosTk20_(fecha, rawAntes, { soloSiHaceFalta: true });
        }

        if (!navigator.onLine) {
            if (seq !== cargandoMuestrasSeq) return;
            const listaLocal = fusionarBorradoresLocales([], fecha);
            poblarSelectMuestra(listaLocal, { preserveRaw: rawAntes });
            if (listaLocal.length) {
                asegurarMuestraActivaYDatosTk20_(fecha, rawAntes, { soloSiHaceFalta: false });
                setStatus('Sin internet: muestras recuperadas del borrador local.', 'warn');
            } else {
                setStatus('Sin internet. Conéctate para ver muestras del día.', 'warn');
            }
            return;
        }

        setSelectLoading(true, listaInmediata.length ? 'Actualizando listado…' : 'Cargando muestras…');
        setStatus('');
        if (elStatus) elStatus.hidden = true;

        try {
            const base = await withMinLoader(() => fetchMuestrasPorFecha(fecha));
            if (seq !== cargandoMuestrasSeq) return;
            const merged = fusionarBorradoresLocales(base, fecha);
            actualizarCacheListaMuestrasTk20_(merged, fecha);
            const rawKeep = String(elMuestra?.value || '').trim() || rawAntes;
            poblarSelectMuestra(merged, { preserveRaw: rawKeep });
            if (!merged.length) {
                setStatus('No hay registros de campo para esa fecha.', 'warn');
            } else {
                asegurarMuestraActivaYDatosTk20_(fecha, rawKeep, { soloSiHaceFalta: true });
            }
        } catch (err) {
            if (seq !== cargandoMuestrasSeq) return;
            const fallback = fusionarBorradoresLocales(listaCacheMuestrasTk20_(fecha), fecha);
            if (fallback.length) {
                const rawKeep = String(elMuestra?.value || '').trim() || rawAntes;
                poblarSelectMuestra(fallback, { preserveRaw: rawKeep });
                asegurarMuestraActivaYDatosTk20_(fecha, rawKeep, { soloSiHaceFalta: true });
                setStatus(
                    'Planilla lenta o sin respuesta: listado local. Puedes seguir editando.',
                    'warn',
                    { reintentar: true, reintentarKind: 'muestras' }
                );
            } else {
                setStatus(String(err.message || err), 'error', {
                    reintentar: true,
                    reintentarKind: 'muestras'
                });
                if (elMuestra && !String(elMuestra.value || '').trim()) {
                    elMuestra.innerHTML = '';
                    const opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = 'Error — reintenta o cambia la fecha';
                    elMuestra.appendChild(opt);
                    elMuestra.disabled = false;
                }
            }
        } finally {
            if (seq === cargandoMuestrasSeq) setSelectLoading(false);
        }
    }

    function mensajePlanillaReintentableTk20_(msg) {
        const s = String(msg || '');
        return /tardó demasiado|Reintenta|Error de conexión|conexión con el servidor|Timeout JSONP|Error JSONP|No se pudo leer el listado|Redespliega code\.gs/i.test(s);
    }

    function setStatus(msg, tipo, opts) {
        if (!elStatus) return;
        const texto = msg || '';
        const kindExplicito = opts && opts.reintentarKind ? String(opts.reintentarKind) : '';
        const showRetry = !!(opts && opts.reintentar)
            || (tipo === 'error' && mensajePlanillaReintentableTk20_(texto));
        if (!texto) {
            tk20StatusRetryKind_ = '';
        } else if (kindExplicito) {
            tk20StatusRetryKind_ = kindExplicito;
        } else if (showRetry && !tk20StatusRetryKind_) {
            tk20StatusRetryKind_ = 'ambos';
        }
        elStatus.textContent = texto;
        elStatus.className = 'packing-status-msg' + (tipo ? ' packing-status-msg--' + tipo : '');
        if (elStatusWrap) {
            elStatusWrap.hidden = !texto;
            elStatus.hidden = false;
        } else {
            elStatus.hidden = !texto;
        }
        if (elStatusRetry) {
            elStatusRetry.hidden = !(showRetry && texto);
            if (!texto) elStatusRetry.disabled = false;
        }
        syncFoldBtnAnchor();
    }

    async function forzarRefrescoPlanillaDesdeStatusTk20_() {
        if (tk20StatusRetryBusy_) return;
        if (!navigator.onLine) {
            setStatus('Sin internet para sincronizar con la planilla.', 'warn');
            return;
        }
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) {
            setStatus('Selecciona una fecha primero.', 'warn');
            return;
        }
        tk20StatusRetryBusy_ = true;
        if (elStatusRetry) elStatusRetry.disabled = true;
        const kind = tk20StatusRetryKind_ || 'ambos';
        try {
            setStatus('Reintentando consulta a la planilla…', 'info');
            const necesitaLista = kind === 'muestras' || kind === 'ambos' || kind === 'sync'
                || !String(elMuestra?.value || '').trim();
            if (necesitaLista) {
                await cargarMuestrasPorFecha(fecha);
            }
            const sel = ensayoSeleccionado();
            const necesitaDetalle = (kind === 'detalle' || kind === 'ambos' || kind === 'sync')
                && !!sel.ensayo_numero;
            if (necesitaDetalle) {
                await cargarDetalle(fecha, sel.ensayo_numero);
            }
        } catch (err) {
            setStatus(String(err.message || err), 'error', {
                reintentar: true,
                reintentarKind: kind
            });
        } finally {
            tk20StatusRetryBusy_ = false;
            if (elStatusRetry) elStatusRetry.disabled = false;
        }
    }

    function setSelectLoading(on, mensaje) {
        if (elSelectBlock) elSelectBlock.classList.toggle('is-busy', on);
        if (elSelectLoader) elSelectLoader.hidden = !on;
        if (elSelectLoaderMsg && mensaje) elSelectLoaderMsg.textContent = mensaje;
        if (elFecha) elFecha.disabled = on;
    }

    function setResumenVisible(visible) {
        if (!elResumen) return;
        elResumen.classList.toggle('is-empty', !visible);
        if (elResumenToggle) elResumenToggle.hidden = !visible;
        syncFoldBtnAnchor();
    }

    function syncFoldBtnAnchor() {
        if (foldBtnSyncRaf) cancelAnimationFrame(foldBtnSyncRaf);
        foldBtnSyncRaf = requestAnimationFrame(() => {
            foldBtnSyncRaf = 0;
            const shell = elMetaShell;
            const select = elSelectBlock;
            if (!shell || !select || elResumenToggle?.hidden) return;
            shell.style.setProperty('--pk-select-end', select.offsetHeight + 'px');
            const vacio = elResumen?.classList.contains('is-empty');
            const compact = !vacio && elResumen?.classList.contains('is-collapsed');
            shell.classList.toggle('is-fold-btn-compact', compact);
            shell.classList.toggle('is-fold-btn-expanded', !vacio && !compact);
        });
    }

    function setChipsPanelCollapsed(collapsed, persist) {
        if (!elChipsPanel || !elResumenToggle) return;
        elChipsPanel.classList.toggle('is-collapsed', collapsed);
        if (elResumen) elResumen.classList.toggle('is-collapsed', collapsed);
        elResumenToggle.classList.toggle('is-active', collapsed);
        elResumenToggle.setAttribute('aria-expanded', (!collapsed).toString());
        const titulo = collapsed ? 'Mostrar datos del registro' : 'Ocultar datos del registro';
        elResumenToggle.title = titulo;
        elResumenToggle.setAttribute('aria-label', titulo);
        if (persist) {
            try { localStorage.setItem(CHIPS_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (_) { /* ignore */ }
        }
        crearIconos();
        syncFoldBtnAnchor();
    }

    function toggleChipsPanelCollapsed() {
        if (elResumen?.classList.contains('is-loading-resumen')) return;
        setChipsPanelCollapsed(!elChipsPanel?.classList.contains('is-collapsed'), true);
    }

    function setPreviewLoading(on, mensaje) {
        if (on) setChipsPanelCollapsed(false, false);
        if (elResumen) elResumen.classList.toggle('is-loading-resumen', !!on);
        if (elPreview) {
            elPreview.classList.toggle('is-loading-preview', on);
            if (!on) elPreview.classList.remove('is-loaded');
        }
        if (elPreviewLoader) elPreviewLoader.hidden = !on;
        if (elPreviewLoaderMsg && mensaje) elPreviewLoaderMsg.textContent = mensaje;
        if (elResumenToggle) {
            elResumenToggle.disabled = !!on;
            elResumenToggle.setAttribute('aria-disabled', on ? 'true' : 'false');
            elResumenToggle.classList.toggle('is-loading-blocked', !!on);
        }
        syncFoldBtnAnchor();
    }

    function setChip(id, texto, vacio, extraClass) {
        const el = document.getElementById(id);
        if (!el) return;
        const val = String(texto ?? '').trim();
        el.textContent = val || '--';
        el.className = 'packing-chip-value' + (extraClass ? ' ' + extraClass : '');
        el.classList.toggle('packing-chip-value--empty', vacio || !val);
    }

    function limpiarPreviewChips() {
        if (elPreview) elPreview.classList.remove('is-loaded', 'is-loading-preview');
        setChip('mptk-traz', '', true, 'packing-chip-value--traz');
        setChip('mptk-variedad', '', true);
        setChip('mptk-placa', '', true);
    }

    function limpiarPreview() {
        setPreviewLoading(false);
        setResumenVisible(false);
        lastDetalle = null;
        limpiarPreviewChips();
        window.dispatchEvent(new CustomEvent('tk20:detalle', { detail: { data: null } }));
    }

    function pintarPreview(d) {
        if (!d) {
            limpiarPreview();
            return;
        }
        const etapa = String(d.TRAZ_ETAPA ?? '').trim();
        const campo = String(d.TRAZ_CAMPO ?? '').trim();
        const turno = String(d.TRAZ_TURNO ?? d.TRAZ_LIBRE ?? '').trim();
        const traz = [etapa, campo, turno].filter(Boolean).join('-');
        setChip('mptk-traz', traz, !traz, 'packing-chip-value--traz');
        setChip('mptk-variedad', d.VARIEDAD, !d.VARIEDAD);
        setChip('mptk-placa', d.PLACA_VEHICULO, !d.PLACA_VEHICULO);
        if (elPreview) {
            elPreview.classList.remove('is-loading-preview');
            elPreview.classList.add('is-loaded');
        }
        setResumenVisible(true);
        setChipsPanelCollapsed(false, false);
        syncFoldBtnAnchor();
    }

    let tk20MuestraAnterior = '';

    async function cargarDetalle(fechaIso, ensayoNumero) {
        if (!fechaIso || !ensayoNumero) return;
        const seq = ++cargandoDetalleSeq;
        const raw = window.Tk20Header?.getMuestraRaw?.() || String(elMuestra?.value || '').trim()
            || (String(elMuestra?.value || '').trim());
        const rawMuestra = String(elMuestra?.value || '').trim() || raw;

        window.Tk20Draft?.cancelarGuardadoProgramado?.();
        window.Tk20Draft?.setOmitirAutoguardado?.(true);

        async function aplicarDetalleYBorradorLocal_(detalle, opts) {
            const d = detalle || null;
            if (d) {
                lastDetalle = d;
                pintarPreview(d);
                actualizarStatusDesdeDetalle(d);
                window.dispatchEvent(new CustomEvent('tk20:detalle', { detail: { data: d } }));
            }
            const campoListo = d
                ? (campoListoParaTk20Detalle(d) || d.tieneTk20 === true)
                : false;
            let restaurado = !!window.Tk20Draft?.restaurarBorradorSiHay?.(fechaIso, rawMuestra, d);
            if (!restaurado) {
                const b = window.Tk20Draft?.leerBorrador?.(fechaIso, rawMuestra);
                if (b?.estado && window.Tk20Draft?.hayDatosCaptura?.(b.estado)) {
                    window.Tk20Draft?.aplicarEstado?.(b.estado);
                    restaurado = true;
                }
            }
            if (!restaurado && !opts?.mantenerUi) {
                window.Tk20Envio?.limpiarCamposCapturaTk20_?.();
            }
            if (!d || d.tieneTk20 === true || !campoListo) {
                window.Tk20Envio?.setRegistroHabilitado?.(false);
            } else {
                const fundoOk = window.FundoFlujoTk20?.habilitaDesdeDetalle?.(d) === true;
                window.Tk20Envio?.setRegistroHabilitado?.(fundoOk && campoListo);
            }
            window.Tk20Envio?.actualizarBtnEnviar?.();
            return restaurado;
        }

        // Sin internet: trabajar solo con borrador local (no dejar UI vacía).
        if (!navigator.onLine) {
            try {
                limpiarPreviewChips();
                setResumenVisible(true);
                setChipsPanelCollapsed(false, false);
                setPreviewLoading(false);
                const borrador = window.Tk20Draft?.leerBorrador?.(fechaIso, rawMuestra);
                if (borrador?.detalleSnap || (borrador?.estado && window.Tk20Draft?.hayDatosCaptura?.(borrador.estado))) {
                    window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
                    const ok = await aplicarDetalleYBorradorLocal_(borrador.detalleSnap || null, { mantenerUi: true });
                    // Offline: permitir seguir editando el borrador local si no está ya en planilla.
                    if (ok && borrador.detalleSnap?.tieneTk20 !== true) {
                        window.Tk20Envio?.setRegistroHabilitado?.(true);
                        window.Tk20Envio?.actualizarBtnEnviar?.();
                    }
                    setStatus(
                        ok
                            ? 'Sin internet: datos recuperados del borrador local.'
                            : 'Sin internet: muestra abierta con datos locales.',
                        'warn'
                    );
                    if (elStatus) elStatus.hidden = false;
                    return;
                }
                // Sin borrador de ESTA muestra: vaciar UI (no dejar pegada la anterior).
                window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
                lastDetalle = null;
                limpiarPreview();
                setStatus('Sin internet. Abre esta muestra con conexión una vez para poder trabajarla offline.', 'warn');
                if (elStatus) elStatus.hidden = false;
            } finally {
                if (seq === cargandoDetalleSeq) {
                    window.Tk20Draft?.setOmitirAutoguardado?.(false);
                }
            }
            return;
        }

        // Local-first: si hay captura de ESTA muestra, mostrarla ya y NO bloquear la pestaña.
        // La planilla se revalida en segundo plano (1 intento). Sin “colgado” de 40–60s.
        const borradorLocal = window.Tk20Draft?.leerBorrador?.(fechaIso, rawMuestra);
        const hayLocal = !!(borradorLocal?.detalleSnap
            || (borradorLocal?.estado && window.Tk20Draft?.hayDatosCaptura?.(borradorLocal.estado)));
        limpiarPreviewChips();
        setResumenVisible(true);
        setChipsPanelCollapsed(false, false);
        setStatus('');
        if (elStatus) elStatus.hidden = true;

        if (hayLocal) {
            window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
            await aplicarDetalleYBorradorLocal_(borradorLocal.detalleSnap || null, { mantenerUi: true });
            if (borradorLocal.detalleSnap?.tieneTk20 !== true) {
                window.Tk20Envio?.setRegistroHabilitado?.(true);
                window.Tk20Envio?.actualizarBtnEnviar?.();
            }
            setPreviewLoading(false);
            setStatus('');
            if (seq === cargandoDetalleSeq) {
                window.Tk20Draft?.setOmitirAutoguardado?.(false);
            }
            // Revalidar chips/meta sin trabar la UI ni pisar un modal abierto.
            void (async () => {
                try {
                    const r = await fetchDetalle(fechaIso, ensayoNumero, { revalidar: true });
                    if (seq !== cargandoDetalleSeq) return;
                    if (!r || r.ok !== true || !r.data) return;
                    if (window.Tk20Modals?.hayModalAbierto?.()) {
                        lastDetalle = r.data;
                        pintarPreview(r.data);
                        actualizarStatusDesdeDetalle(r.data);
                        return;
                    }
                    window.Tk20Draft?.setOmitirAutoguardado?.(true);
                    try {
                        await aplicarDetalleYBorradorLocal_(r.data);
                    } finally {
                        if (seq === cargandoDetalleSeq) {
                            window.Tk20Draft?.setOmitirAutoguardado?.(false);
                        }
                    }
                } catch (_) { /* local ya está operativo */ }
            })();
            return;
        }

        window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
        setPreviewLoading(true, 'Cargando datos…');
        try {
            const r = await withMinLoader(() => fetchDetalle(fechaIso, ensayoNumero));
            if (seq !== cargandoDetalleSeq) return;
            if (!r || r.ok !== true || !r.data) {
                throw new Error(r?.error || 'Registro no encontrado');
            }
            await aplicarDetalleYBorradorLocal_(r.data);
            setStatus('');
        } catch (err) {
            if (seq !== cargandoDetalleSeq) return;
            const borrador = window.Tk20Draft?.leerBorrador?.(fechaIso, rawMuestra);
            if (borrador?.detalleSnap || (borrador?.estado && window.Tk20Draft?.hayDatosCaptura?.(borrador.estado))) {
                await aplicarDetalleYBorradorLocal_(borrador.detalleSnap || null, { mantenerUi: true });
                setStatus('');
                if (elStatus) elStatus.hidden = true;
                return;
            }
            const msg = window.MensajesFlujo?.traducirErrorTecnico?.(err?.message || err)
                || String(err.message || err);
            setStatus(msg, 'error', { reintentar: true, reintentarKind: 'detalle' });
            limpiarPreview();
        } finally {
            if (seq === cargandoDetalleSeq) {
                setPreviewLoading(false);
                window.Tk20Draft?.setOmitirAutoguardado?.(false);
            }
        }
    }

    /** Tras envío exitoso: recarga listado y vuelve a la muestra enviada (como MP-TK). */
    async function aplicarExitoEnvioTk20_(fechaIso, rawEnviado) {
        const fecha = normalizarFechaIso(fechaIso);
        const raw = String(rawEnviado || '').trim();
        if (!fecha) return;
        try {
            await cargarMuestrasPorFecha(fecha);
            if (!raw || !elMuestra) return;
            const parts = raw.split('|');
            const ensayoNumero = String(parts[1] || '').trim();
            if (!ensayoNumero) return;
            const existe = Array.from(elMuestra.options).some((o) => o.value === raw);
            if (!existe) return;
            tk20MuestraAnterior = raw;
            elMuestra.value = raw;
            window.Tk20Draft?.setMuestraActivaClave?.(fecha, raw);
            await cargarDetalle(fecha, ensayoNumero);
        } catch (_) {
            setPreviewLoading(false);
        }
    }

    function aplicarFechaHoy_(opts) {
        if (window.FechaOperativa?.aplicarRangoInputFecha) {
            window.FechaOperativa.aplicarRangoInputFecha(elFecha, opts);
            return;
        }
        if (!elFecha) return;
        const hoy = hoyIsoLocal();
        elFecha.max = hoy;
        const prev = elFecha.value;
        const forzar = opts?.forzar !== false;
        if (forzar || !prev || prev > hoy) elFecha.value = hoy;
    }

    async function acotarFechaDesdePlanilla() {
        aplicarFechaHoy_({ forzar: false });
    }

    function actualizarHeaderConexion() {
        const on = navigator.onLine;
        if (elHeaderCard) {
            elHeaderCard.classList.toggle('is-online', on);
            elHeaderCard.classList.toggle('is-offline', !on);
        }
        if (elHeaderConn) elHeaderConn.textContent = on ? 'En línea' : 'Sin internet';
        if (elHeaderWifi) {
            elHeaderWifi.setAttribute('data-lucide', on ? 'wifi' : 'wifi-off');
            crearIconos();
        }
    }

    function actualizarHeaderPendientes() {
        if (!elHeaderPend) return;
        const n = window.Tk20Sync?.colaTk20PendienteCount_?.() || 0;
        elHeaderPend.textContent = String(n).padStart(2, '0');
        elHeaderPend.classList.toggle('header-status-pend-num--alert', n > 0);
    }

    function crearIconos() {
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    async function avanzarASiguienteMuestraTk20TrasEnvio_(rawEnviado) {
        if (!elMuestra) return;
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawEnviado || '').trim();
        window.Tk20Envio?.limpiarUiCapturaMuestraTk20_?.();
        const opts = [...elMuestra.options].filter((o) => String(o.value || '').trim());
        const idx = opts.findIndex((o) => o.value === raw);
        const next = idx >= 0 ? opts[idx + 1] : null;
        if (next && next.value) {
            tk20MuestraAnterior = raw;
            elMuestra.value = next.value;
            elMuestra.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        if (fecha && raw) {
            const ensayoNumero = String(raw.split('|')[1] || '').trim();
            if (ensayoNumero) {
                await cargarDetalle(fecha, ensayoNumero);
            }
        }
    }

    elFecha?.addEventListener('change', () => {
        if (elFecha && window.FechaOperativa?.esFechaOperativaPermitida
            && !window.FechaOperativa.esFechaOperativaPermitida(elFecha.value)) {
            window.FechaOperativa.aplicarRangoInputFecha(elFecha, { forzar: true });
        }
        try {
            window.Tk20Draft?.persistirSoloLocal?.({ forzar: true });
        } catch (_) { /* ignore */ }
        // Cambio de día: sí invalidar detalle en curso.
        cargandoDetalleSeq++;
        window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
        limpiarPreview();
        void cargarMuestrasPorFecha(elFecha.value || '');
    });

    elMuestra?.addEventListener('focus', () => {
        tk20MuestraAnterior = String(elMuestra?.value || '').trim();
    });

    elMuestra?.addEventListener('change', () => {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(elMuestra?.value || '').trim();
        let prev = tk20MuestraAnterior;
        if ((!prev || prev === raw) && fecha) {
            const desdeActiva = window.Tk20Draft?.rawMuestraDesdeClaveActiva?.(fecha) || '';
            if (desdeActiva && desdeActiva !== raw) prev = desdeActiva;
        }
        window.Tk20Draft?.cancelarGuardadoProgramado?.();
        if (prev && prev !== raw && fecha) {
            // Formulario aún tiene la captura de `prev`; no usar persistirSoloLocal (pisaría clave nueva).
            const estadoUi = window.Tk20Draft?.capturarEstadoUi?.();
            window.Tk20Draft?.snapshotBorrador?.(fecha, prev, { activa: false, estado: estadoUi });
        }
        tk20MuestraAnterior = raw;
        if (!fecha || !raw) {
            window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
            limpiarPreview();
            setStatus('');
            return;
        }
        const sel = ensayoSeleccionado();
        if (!sel.ensayo_numero) {
            limpiarPreview();
            setStatus('');
            return;
        }
        // Vaciar UI ya: evita mostrar la captura de la muestra anterior
        // mientras carga el detalle / borrador de la nueva.
        window.Tk20Envio?.prepararUiNuevaMuestraTk20_?.();
        window.Tk20Draft?.setMuestraActivaClave?.(fecha, raw);
        void cargarDetalle(fecha, sel.ensayo_numero);
    });

    elResumenToggle?.addEventListener('click', toggleChipsPanelCollapsed);
    elStatusRetry?.addEventListener('click', () => {
        void forzarRefrescoPlanillaDesdeStatusTk20_();
    });
    window.addEventListener('online', () => {
        actualizarHeaderConexion();
        void window.Tk20Sync?.sincronizarPendientesTk20?.();
        const fecha = elFecha?.value || '';
        if (fecha) void cargarMuestrasPorFecha(fecha);
    });
    window.addEventListener('offline', actualizarHeaderConexion);
    window.addEventListener('resize', syncFoldBtnAnchor, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
        const foldBtnResizeObs = new ResizeObserver(() => syncFoldBtnAnchor());
        if (elSelectBlock) foldBtnResizeObs.observe(elSelectBlock);
        const clip = elMetaShell?.querySelector('.packing-meta-clip');
        if (clip) foldBtnResizeObs.observe(clip);
    }

    actualizarHeaderConexion();
    actualizarHeaderPendientes();
    crearIconos();
    aplicarFechaHoy_({ forzar: true });
    setChipsPanelCollapsed(false, false);
    try {
        const collapsed = localStorage.getItem(CHIPS_COLLAPSED_KEY) === '1';
        if (collapsed) setChipsPanelCollapsed(true, false);
    } catch (_) { /* ignore */ }
    limpiarPreview();
    syncFoldBtnAnchor();

    function arrancarListaYBorradorTk20_() {
        if (window.__tk20ListaArrancada) return;
        window.__tk20ListaArrancada = true;
        void acotarFechaDesdePlanilla().then(() => {
            const fecha = elFecha?.value || '';
            if (fecha) return cargarMuestrasPorFecha(fecha);
        }).then(() => window.Tk20Sync?.sincronizarPendientesTk20?.());
    }

    // tk20-draft.js carga después de este archivo: arrancar cuando exista el store.
    if (window.Tk20Draft) {
        arrancarListaYBorradorTk20_();
    } else {
        window.addEventListener('tk20:draft-listo', arrancarListaYBorradorTk20_, { once: true });
        // Respaldo si el evento se perdió por orden de scripts.
        setTimeout(() => {
            if (!window.__tk20ListaArrancada) arrancarListaYBorradorTk20_();
        }, 0);
    }

    window.Tk20Header = {
        getLastDetalle: () => lastDetalle,
        getFecha: () => normalizarFechaIso(elFecha?.value),
        getMuestraRaw: () => String(elMuestra?.value || '').trim(),
        getMetaListaMuestraTk20: getMetaListaMuestraTk20_,
        ensayoSeleccionado,
        cargarMuestrasPorFecha,
        cargarDetalle,
        aplicarExitoEnvioTk20_,
        fetchDetalleServidor: fetchDetalle,
        setStatus,
        actualizarHeaderPendientes,
        avanzarASiguienteMuestraTk20TrasEnvio_
    };
}());
