(function initThermokingApp() {
    const API_URL = String(window.APPS_SCRIPT_API_URL || '').trim();
    const SYNC_QUEUE_KEY = 'tiempos-sync-queue-v1';
    const SYNC_HISTORY_KEY = 'tiempos-sync-history-v1';
    const SYNC_MAX_HISTORY = 200;
    const DRAFT_STORAGE_KEY = 'tiempos-mptk-draft-v1';
    const CHIPS_COLLAPSED_KEY = 'mptk-chips-collapsed-v1';
    const MIN_LOADER_MS = 350;

    /** Plantilla demo MP-TK: control global + cards Thermo-King (como Packing). */
    const MPTK_DEMO_PLANTILLA = {
        responsable: 'Demo MP-TK',
        horaSalidaFrio: '06:00',
        baseHoraTiempos: '06:30',
        offsetsTiemposMin: [0, 105, 135, 230],
        offsetsTiemposPorCardMin: 5,
        pesosBase: { ic: 143.8, st: 142.1, it: 141.5, dp: 140.9 },
        pesoDeltaPorCard: 0.4,
        temperatura: {
            temp_ic_cm_tk: '2.0',
            temp_ic_pu_tk: '1.5',
            temp_st_cm_tk: '2.5',
            temp_st_pu_tk: '2.0',
            temp_it_amb_tk: '18.0',
            temp_it_veh_tk: '4.0',
            temp_it_pu_tk: '3.5',
            temp_dp_amb_tk: '20.0',
            temp_dp_veh_tk: '5.0',
            temp_dp_pu_tk: '4.5'
        },
        humedad: {
            hum_ic_tk: '88.0',
            hum_st_tk: '86.0',
            hum_aei_tk: '56.0',
            hum_ivi_tk: '88.0',
            hum_aed_tk: '55.4',
            hum_ivd_tk: '88.0'
        },
        observacionPrefijo: 'SIM-TK-',
        placaThermoking: ''
    };

    const elFecha = document.getElementById('mptk-fecha');
    const elMuestra = document.getElementById('mptk-muestra');
    const elStatus = document.getElementById('mptk-status');
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
    const elCardsWrap = document.getElementById('mptk-cards-wrap');
    const elControlBar = document.getElementById('control_equitativo_bar_mptk');
    const elBtnPlacaMptk = document.getElementById('btn_placa_mptk');
    const elPlacaModalMptk = document.getElementById('mptk-placa-modal-overlay');
    const elPlacaInputMptk = document.getElementById('mptk-placa-inp');
    const elHoraRow = document.getElementById('mptk-hora-row');
    const elBtnEnviar = document.getElementById('btn-guardar-enviar-tk');
    const elEnvioBarMptk = document.getElementById('mptk-envio-bar');
    const elHeaderCard = document.getElementById('header-status-card');
    const elHeaderConn = document.getElementById('header-conn-label');
    const elHeaderPend = document.getElementById('header-pendientes-count');
    const elHeaderWifi = document.getElementById('header-status-wifi');
    const elFabMenu = document.getElementById('fab-menu-mptk');
    const elFabOptionsBtn = document.getElementById('fab-options-btn-mptk');
    const elFabRestanteBadge = document.getElementById('fab-mptk-restante-badge');
    const elFabAgregar = document.getElementById('fab-mptk-agregar');
    const elFabPdf = document.getElementById('fab-mptk-pdf');
    const elFechaRingWidget = document.getElementById('mptk-fecha-ring-widget');
    const elFechaRingCircle = document.getElementById('mptk-fecha-ring-circle');
    const elFechaRingPopover = document.getElementById('mptk-fecha-ring-popover');

    const INPUT_IDS_EDITABLES = [
        'fecha_inspeccion_tk', 'placa_thermoking_tk',
        'tiempo_ic_tk', 'tiempo_st_tk', 'tiempo_it_tk', 'tiempo_dp_tk',
        'peso_ic_tk', 'peso_st_tk', 'peso_it_tk', 'peso_dp_tk',
        'temp_ic_cm_tk', 'temp_ic_pu_tk', 'temp_st_cm_tk', 'temp_st_pu_tk',
        'temp_it_amb_tk', 'temp_it_veh_tk', 'temp_it_pu_tk',
        'temp_dp_amb_tk', 'temp_dp_veh_tk', 'temp_dp_pu_tk',
        'hum_ic_tk', 'hum_st_tk', 'hum_aei_tk', 'hum_ivi_tk', 'hum_aed_tk', 'hum_ivd_tk',
        'observacion_tk'
    ];

    const PRESION_IDS_COMPUTED_MPTK = [
        'pres_ic_tk', 'pres_st_tk', 'pres_aei_tk', 'pres_ivi_tk', 'pres_aed_tk', 'pres_ivd_tk',
        'vapor_ic_tk', 'vapor_scm_tk', 'vapor_it_tk', 'vapor_st_tk'
    ];

    let cargandoMuestrasSeq = 0;
    let lastDetalleTk = null;
    let tkYaEnServidor = false;
    let muestrasPendientesTkCount = 0;
    let mptkBadgeWasComplete = false;
    let fabAgregarMptkEnCurso_ = false;
    let fabAgregarMptkTs_ = 0;
    const mptkQuota = {
        filasTotalCampo: 0,
        filasPackingRegistradas: 0,
        filasTkRegistradas: 0,
        maxClamshell: 0
    };
    let envioTkEnCurso = false;
    let syncTkEnCurso = false;
    let draftSaveTimer = null;
    let omitirAutoguardado = false;
    let mptkRestaurandoBorrador = false;
    let mptkMuestraAnterior = '';
    let foldBtnSyncRaf = 0;
    const mptkListaMuestrasMetaCache_ = Object.create(null);

    function cacheKeyMuestraMptk_(fecha, raw) {
        const f = normalizarFechaIso(fecha || elFecha?.value);
        const r = String(raw || '').trim();
        return f && r ? (f + '::' + r) : '';
    }

    function metaListaMuestraMptk_(raw) {
        return mptkListaMuestrasMetaCache_[cacheKeyMuestraMptk_(elFecha?.value, raw)] || null;
    }

    function actualizarCacheListaMuestrasMptk_(fechaIso, lista) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return;
        (lista || []).forEach((item) => {
            const num = String(item?.num_muestra || '').trim();
            const en = String(item?.ensayo_numero || '').trim();
            if (!num || !en) return;
            const raw = num + '|' + en;
            const key = cacheKeyMuestraMptk_(fecha, raw);
            if (!key) return;
            mptkListaMuestrasMetaCache_[key] = {
                tieneThermoKing: item.tieneThermoKing === true,
                packing_completo_en_servidor: item.packing_completo_en_servidor === true,
                puede_continuar_thermoking: item.puede_continuar_thermoking === true
            };
            if (item.tieneThermoKing === true) {
                guardarMarcaServidorMptkDesdeDetalle_(fecha, raw, { tieneThermoKing: true });
            }
        });
    }

    function ensayosSatisfechosSecuenciaMptk_(analisis) {
        const set = new Set();
        (analisis?.resumenes || []).forEach((r) => {
            if (r.estado === 'enviada' || r.estado === 'lista') {
                const n = numeroEnsayoMptkDesdeRaw_(r.raw);
                if (n > 0) set.add(n);
            }
        });
        obtenerOpcionesMuestraMptkSelect_().forEach((raw) => {
            if (muestraMptkYaCompletaEnServidor_(raw)) {
                const n = numeroEnsayoMptkDesdeRaw_(raw);
                if (n > 0) set.add(n);
            }
        });
        return set;
    }

    function huecosSinSatisfechosMptk_(huecos, satisfechos) {
        return (huecos || []).filter((n) => !satisfechos.has(n));
    }

    function hoyIsoLocal() {
        const d = new Date();
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function horaLocalAhora() {
        const d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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

    function ensayoSeleccionado() {
        const raw = elMuestra?.value || '';
        const parts = String(raw).split('|');
        const opt = elMuestra?.selectedOptions?.[0];
        const modoOpt = String(opt?.dataset?.modoRegistro || '').trim().toLowerCase();
        const modoDet = String(lastDetalleTk?.modo_registro || '').trim().toLowerCase();
        const modo = (modoDet === 'acopio' || modoDet === 'visual')
            ? modoDet
            : ((modoOpt === 'acopio' || modoOpt === 'visual') ? modoOpt : '');
        return {
            num_muestra: parts[0] || '',
            ensayo_numero: parts.length >= 2 ? parts[1] : '',
            modo_registro: modo
        };
    }

    function modoRegistroSeleccionado() {
        const sel = ensayoSeleccionado();
        return sel.modo_registro === 'acopio' ? 'acopio' : (sel.modo_registro === 'visual' ? 'visual' : '');
    }

    function claveBorradorTk(fecha, rawMuestra) {
        const f = normalizarFechaIso(fecha);
        const r = String(rawMuestra || '').trim();
        if (!f || !r) return '';
        return f + '::' + r;
    }

    function rawMuestraDesdeClaveActivaMptk_(fecha) {
        const f = normalizarFechaIso(fecha);
        if (!f) return '';
        const activa = String(leerStoreBorradorTk().activo || '').trim();
        const prefix = f + '::';
        if (!activa.startsWith(prefix)) return '';
        return activa.slice(prefix.length);
    }

    function leerStoreBorradorTk() {
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

    function guardarStoreBorradorTk(store) {
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(store));
        } catch (_) { /* ignore */ }
    }

    function purgarBorradoresMptkOtrosDias_() {
        const hoy = hoyIsoLocal();
        const store = leerStoreBorradorTk();
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
        if (changed) guardarStoreBorradorTk(store);
    }

    function valInput(id) {
        const el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    }

    function setInput(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val == null ? '' : String(val);
    }

    function numeroSeguroMptk_(raw) {
        const s = String(raw ?? '').trim().replace(',', '.');
        if (!s || s.endsWith('.')) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    function calcularPresionVaporAmbienteAshraeMptk_(tempC, humedadRelativa) {
        const t = numeroSeguroMptk_(tempC);
        const hr = numeroSeguroMptk_(humedadRelativa);
        if (t === null || hr === null || hr < 0 || hr > 100) return '';

        const T = t + 273.15;
        const c8 = -5.8002206e+03;
        const c9 = 1.3914993e+00;
        const c10 = -4.8640239e-02;
        const c11 = 4.1764768e-05;
        const c12 = -1.4452093e-08;
        const c13 = 6.5459673e+00;

        const lnPs = (c8 / T) + c9 + (c10 * T) + (c11 * (T ** 2)) + (c12 * (T ** 3)) + (c13 * Math.log(T));
        const pSatKpa = Math.exp(lnPs) / 1000;
        const pV = pSatKpa * (hr / 100);
        if (!Number.isFinite(pV)) return '';
        return pV.toFixed(3);
    }

    function calcularPresionVaporPulpaAshraeMptk_(tempPulpaC) {
        const t = numeroSeguroMptk_(tempPulpaC);
        if (t === null) return '';

        const T = t + 273.15;
        const c8 = -5.8002206e+03;
        const c9 = 1.3914993e+00;
        const c10 = -4.8640239e-02;
        const c11 = 4.1764768e-05;
        const c12 = -1.4452093e-08;
        const c13 = 6.5459673e+00;

        const lnPs = (c8 / T) + c9 + (c10 * T) + (c11 * (T ** 2)) + (c12 * (T ** 3)) + (c13 * Math.log(T));
        const pPulpa = Math.exp(lnPs) / 1000;
        if (!Number.isFinite(pPulpa)) return '';
        return pPulpa.toFixed(3);
    }

    /** Presión ambiente/fruta calculada desde T° y HR (igual que Packing). */
    function recalcularPresionesMptk_(opts) {
        const ambPairs = [
            ['pres_ic_tk', 'temp_ic_cm_tk', 'hum_ic_tk'],
            ['pres_st_tk', 'temp_st_cm_tk', 'hum_st_tk'],
            ['pres_aei_tk', 'temp_it_amb_tk', 'hum_aei_tk'],
            ['pres_ivi_tk', 'temp_it_veh_tk', 'hum_ivi_tk'],
            ['pres_aed_tk', 'temp_dp_amb_tk', 'hum_aed_tk'],
            ['pres_ivd_tk', 'temp_dp_veh_tk', 'hum_ivd_tk']
        ];
        ambPairs.forEach(([presKey, tempKey, humKey]) => {
            const t = numeroSeguroMptk_(valInput(tempKey));
            const h = numeroSeguroMptk_(valInput(humKey));
            const v = (t !== null && h !== null)
                ? calcularPresionVaporAmbienteAshraeMptk_(t, h)
                : '';
            setInput(presKey, v);
        });

        const frutaPairs = [
            ['vapor_ic_tk', 'temp_ic_pu_tk'],
            ['vapor_scm_tk', 'temp_st_pu_tk'],
            ['vapor_it_tk', 'temp_it_pu_tk'],
            ['vapor_st_tk', 'temp_dp_pu_tk']
        ];
        frutaPairs.forEach(([vaporKey, tempKey]) => {
            const t = numeroSeguroMptk_(valInput(tempKey));
            const v = t !== null ? calcularPresionVaporPulpaAshraeMptk_(t) : '';
            setInput(vaporKey, v);
        });

        if (opts?.render !== false && window.MptkUi?.render) {
            window.MptkUi.render();
        }
    }

    function leerEstadoFormularioTk_() {
        recalcularPresionesMptk_({ render: false });
        const estado = { campos: {} };
        INPUT_IDS_EDITABLES.forEach((id) => {
            estado.campos[id] = valInput(id);
        });
        PRESION_IDS_COMPUTED_MPTK.forEach((id) => {
            estado.campos[id] = valInput(id);
        });
        estado.campos.responsable_tk = valInput('responsable_tk');
        estado.campos.hora_salida_frio_tk = valInput('hora_salida_frio_tk');
        if (window.MptkUi?.exportCardsState) {
            estado.mptkCards = window.MptkUi.exportCardsState();
        }
        return estado;
    }

    function migrarEstadoLegacyCardsMptk_(estado) {
        if (!estado || typeof estado !== 'object') return estado;
        if (Array.isArray(estado.mptkCards) && estado.mptkCards.length) return estado;
        const campos = estado.campos || {};
        const tieneCard = ['peso_ic_tk', 'peso_st_tk', 'peso_it_tk', 'peso_dp_tk',
            'tiempo_ic_tk', 'tiempo_st_tk', 'tiempo_it_tk', 'tiempo_dp_tk', 'observacion_tk']
            .some((k) => String(campos[k] || '').trim());
        if (!tieneCard) return estado;
        return {
            ...estado,
            mptkCards: [{
                id: 1,
                clamshellNum: 1,
                pesos: {
                    ic: campos.peso_ic_tk || '',
                    st: campos.peso_st_tk || '',
                    it: campos.peso_it_tk || '',
                    dp: campos.peso_dp_tk || ''
                },
                tiempos: {
                    ic: campos.tiempo_ic_tk || '',
                    st: campos.tiempo_st_tk || '',
                    it: campos.tiempo_it_tk || '',
                    dp: campos.tiempo_dp_tk || ''
                },
                observacion: campos.observacion_tk || ''
            }],
            mptkActiveCardId: 1
        };
    }

    const CAMPOS_AUTO_META_MPTK = new Set(['fecha_inspeccion_tk']);

    function aplicarEstadoFormularioTk_(estado) {
        const migrado = migrarEstadoLegacyCardsMptk_(estado);
        const campos = migrado?.campos || migrado || {};
        INPUT_IDS_EDITABLES.forEach((id) => {
            if (campos[id] != null) setInput(id, campos[id]);
        });
        if (campos.responsable_tk != null) setInput('responsable_tk', campos.responsable_tk);
        if (campos.hora_salida_frio_tk != null) setInput('hora_salida_frio_tk', campos.hora_salida_frio_tk);
        if (Array.isArray(migrado?.mptkCards) && migrado.mptkCards.length && window.MptkUi?.importCardsState) {
            window.MptkUi.importCardsState(migrado.mptkCards, migrado.mptkActiveCardId);
        } else {
            window.MptkUi?.resetCards?.();
        }
        actualizarChipPlacaTk_();
        actualizarBtnPlacaMptkTitulo_();
        recalcularPresionesMptk_();
    }

    function getPlacaTkMptk_() {
        return String(valInput('placa_thermoking_tk') || '').trim().toUpperCase();
    }

    /** Placa del campo/packing (GET); solo referencia visual, no se envía a PLACA_TK. */
    function getPlacaCampoDesdeDetalleMptk_(detalle) {
        const d = detalle || lastDetalleTk;
        return String(d?.PLACA_VEHICULO ?? '').trim().toUpperCase();
    }

    function actualizarChipPlacaTk_() {
        const capturada = getPlacaTkMptk_();
        const refCampo = getPlacaCampoDesdeDetalleMptk_();
        const mostrar = capturada || refCampo;
        setChip('mptk-placa', mostrar || '--', !mostrar);
    }

    function actualizarBtnPlacaMptkTitulo_() {
        if (!elBtnPlacaMptk) return;
        const p = getPlacaTkMptk_();
        const muestraActiva = !!String(elMuestra?.value || '').trim() && !tkYaEnServidor;
        elBtnPlacaMptk.title = !muestraActiva
            ? 'Selecciona una muestra'
            : (p ? 'Placa TK: ' + p : 'Placa vehículo TK');
    }

    function normalizarPlacaTkInput_(raw) {
        return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 20);
    }

    function ocultarModalPlacaMptk_() {
        if (!elPlacaModalMptk) return;
        const focused = elPlacaModalMptk.querySelector(':focus');
        if (focused && typeof focused.blur === 'function') focused.blur();
        elPlacaModalMptk.style.display = 'none';
        elPlacaModalMptk.setAttribute('aria-hidden', 'true');
    }

    function abrirModalPlacaTk_() {
        if (!String(elMuestra?.value || '').trim() || tkYaEnServidor || !elPlacaModalMptk) return;
        const refCampo = getPlacaCampoDesdeDetalleMptk_();
        if (elPlacaInputMptk) {
            elPlacaInputMptk.value = getPlacaTkMptk_();
            elPlacaInputMptk.placeholder = refCampo
                ? ('Referencia campo: ' + refCampo)
                : 'Ej. 9967-OK';
        }
        elPlacaModalMptk.style.display = 'flex';
        elPlacaModalMptk.setAttribute('aria-hidden', 'false');
        elPlacaInputMptk?.focus();
    }

    function cerrarModalPlacaTk_() {
        ocultarModalPlacaMptk_();
    }

    function guardarModalPlacaTk_() {
        const placa = normalizarPlacaTkInput_(elPlacaInputMptk?.value);
        if (!placa) {
            mostrarToastTk('warning', 'Placa requerida', 'Ingresa la placa del vehículo.');
            return;
        }
        setInput('placa_thermoking_tk', placa);
        if (elPlacaInputMptk) elPlacaInputMptk.value = placa;
        actualizarChipPlacaTk_();
        actualizarBtnPlacaMptkTitulo_();
        cerrarModalPlacaTk_();
        programarGuardadoBorradorTk_();
        programarActualizarStatusValidacionMptk_();
        mostrarToastTk('success', 'Guardado', 'Placa TK registrada.');
    }

    function firmaEstadoCapturaMptk_(estado) {
        if (!estado) return '';
        try {
            const norm = migrarEstadoLegacyCardsMptk_(estado);
            const cards = (Array.isArray(norm?.mptkCards) ? norm.mptkCards : [])
                .map((c) => ({
                    n: Number(c.clamshellNum) || 0,
                    p: c.pesos || {},
                    t: c.tiempos || {},
                    o: String(c.observacion || '')
                }));
            const campos = norm?.campos || {};
            const vals = INPUT_IDS_EDITABLES
                .filter((id) => !CAMPOS_AUTO_META_MPTK.has(id))
                .map((id) => String(campos[id] || ''));
            return JSON.stringify({
                cards,
                vals,
                r: String(campos.responsable_tk || ''),
                h: String(campos.hora_salida_frio_tk || '')
            });
        } catch (_) {
            return '';
        }
    }

    function hayPesoEnCardMptk_(card) {
        const p = card?.pesos || {};
        return ['ic', 'st', 'it', 'dp'].some((k) => Number(String(p[k] || '').replace(',', '.')) > 0);
    }

    function hayPesoBrutoMuestraMptk_(estado) {
        if (!estado || typeof estado !== 'object') return false;
        const cards = Array.isArray(estado.mptkCards) ? estado.mptkCards : [];
        return cards.some(hayPesoEnCardMptk_);
    }

    function mensajeSinPesoBrutoPdfMptk_(etiquetaMuestra) {
        const pref = etiquetaMuestra ? `${etiquetaMuestra}: ` : '';
        return pref + 'Captura al menos un peso en PESO BRUTO MUESTRA (GR) antes de generar el PDF.';
    }

    /** Captura real (cards, control, tiempos). No cuenta fecha/placa auto del detalle. */
    function hayDatosCapturaMptk_(estado) {
        if (!estado || typeof estado !== 'object') return false;
        if (hayPesoBrutoMuestraMptk_(estado)) return true;
        const campos = estado.campos || {};
        const cards = Array.isArray(estado.mptkCards) ? estado.mptkCards : [];
        if (cards.some((c) => {
            const t = c?.tiempos || {};
            if (Object.values(t).some((v) => String(v || '').trim())) return true;
            return !!String(c?.observacion || '').trim();
        })) return true;
        if (INPUT_IDS_EDITABLES.some((id) => {
            if (CAMPOS_AUTO_META_MPTK.has(id)) return false;
            return String(campos[id] || '').trim() !== '';
        })) return true;
        if (String(campos.responsable_tk || '').trim()) return true;
        if (String(campos.hora_salida_frio_tk || '').trim()) return true;
        return false;
    }

    function hayDatosTrabajoTk_(estado) {
        return hayDatosCapturaMptk_(estado);
    }

    function reiniciarCardsCapturaMptk_() {
        if (tkYaEnServidor) {
            window.MptkUi?.resetCards?.();
            return;
        }
        const start = filasTkHechasMptk_() + 1;
        window.MptkUi?.reiniciarCards?.(start);
    }

    function cancelarGuardadoBorradorProgramadoMptk_() {
        if (draftSaveTimer) clearTimeout(draftSaveTimer);
        draftSaveTimer = null;
    }

    function detalleSnapIndicaTkCompletoEnServidorMptk_(detalle) {
        return !!(detalle && typeof detalle === 'object' && detalle.tieneThermoKing === true);
    }

    function guardarMarcaServidorMptkDesdeDetalle_(fechaIso, rawMuestra, detalle) {
        if (!detalleSnapIndicaTkCompletoEnServidorMptk_(detalle)) return;
        const fecha = normalizarFechaIso(fechaIso || elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        const key = claveBorradorTk(fecha, raw);
        if (!fecha || !key) return;
        const partes = raw.split('|');
        const store = leerStoreBorradorTk();
        const existing = store.porClave[key] || {};
        store.porClave[key] = {
            meta: Object.assign({
                fecha,
                raw,
                num_muestra: partes[0] || '',
                ensayo_numero: partes[1] || ''
            }, existing.meta || {}),
            estado: existing.estado || { campos: {}, mptkCards: [] },
            detalleSnap: detalle,
            tkYaEnServidor: true,
            guardado_en: Date.now()
        };
        guardarStoreBorradorTk(store);
    }

    function escribirBorradorMuestraMptk_(key, payload, opts) {
        if (!key) return;
        const store = leerStoreBorradorTk();
        const forzar = !!(opts && opts.forzar);
        const estado = payload?.estado || payload;
        const hayTrabajo = hayDatosTrabajoTk_(estado);
        const existing = store.porClave[key];
        const detalleSnap = payload?.detalleSnap !== undefined
            ? payload.detalleSnap
            : (existing?.detalleSnap || lastDetalleTk);
        const marcaServidor = payload?.tkYaEnServidor === true
            || detalleSnapIndicaTkCompletoEnServidorMptk_(detalleSnap)
            || existing?.tkYaEnServidor === true
            || detalleSnapIndicaTkCompletoEnServidorMptk_(existing?.detalleSnap);
        if (hayTrabajo || marcaServidor) {
            store.porClave[key] = {
                meta: payload?.meta || existing?.meta || {},
                estado: hayTrabajo ? estado : (existing?.estado || estado),
                detalleSnap,
                tkYaEnServidor: payload?.tkYaEnServidor !== undefined
                    ? payload.tkYaEnServidor
                    : (marcaServidor || existing?.tkYaEnServidor || tkYaEnServidor),
                guardado_en: Date.now()
            };
        } else if (forzar) {
            delete store.porClave[key];
        } else if (!existing || !hayDatosTrabajoTk_(existing.estado)) {
            delete store.porClave[key];
        }
        if (opts?.activa !== false) store.activo = key;
        guardarStoreBorradorTk(store);
    }

    function snapshotBorradorTk_(fecha, rawMuestra, opts) {
        const key = claveBorradorTk(fecha, rawMuestra);
        if (!key) return;
        const raw = String(rawMuestra || '').trim();
        const estado = opts?.estado || leerEstadoFormularioTk_();
        const partes = raw.split('|');
        const esActiva = raw === String(elMuestra?.value || '').trim();
        const sel = esActiva ? ensayoSeleccionado() : null;
        const existing = leerStoreBorradorTk().porClave[key];
        const meta = {
            fecha: normalizarFechaIso(fecha),
            raw,
            num_muestra: String(sel?.num_muestra || existing?.meta?.num_muestra || partes[0] || '').trim(),
            ensayo_numero: String(sel?.ensayo_numero || existing?.meta?.ensayo_numero || partes[1] || '').trim(),
            modo_registro: String(sel?.modo_registro || existing?.meta?.modo_registro || '').trim()
        };
        const detalleSnap = opts?.detalleSnap !== undefined
            ? opts.detalleSnap
            : (esActiva ? lastDetalleTk : (existing?.detalleSnap || null));
        escribirBorradorMuestraMptk_(key, {
            meta,
            estado,
            detalleSnap,
            tkYaEnServidor: opts?.tkYaEnServidor
        }, { activa: opts?.activa });
    }

    function snapshotMuestraMptkSiHayTrabajo_(fecha, rawMuestra, estadoUi, detalleUi) {
        if (omitirAutoguardado) return;
        const snapDetalle = detalleUi !== undefined ? detalleUi : lastDetalleTk;
        if (detalleSnapIndicaTkCompletoEnServidorMptk_(snapDetalle)) {
            guardarMarcaServidorMptkDesdeDetalle_(fecha, rawMuestra, snapDetalle);
        }
        const estado = estadoUi || leerEstadoFormularioTk_();
        if (!hayDatosTrabajoTk_(estado)) return;
        snapshotBorradorTk_(fecha, rawMuestra, {
            estado,
            activa: false,
            detalleSnap: snapDetalle,
            tkYaEnServidor: detalleSnapIndicaTkCompletoEnServidorMptk_(snapDetalle)
        });
    }

    function guardarBorradorMuestraActivaMptk_() {
        if (omitirAutoguardado || mptkRestaurandoBorrador) return;
        const fecha = elFecha?.value || '';
        const raw = elMuestra?.value || '';
        if (!fecha || !raw) return;
        snapshotBorradorTk_(fecha, raw, { activa: true });
    }

    function guardarBorradorMuestraActivaInmediatoMptk_() {
        if (omitirAutoguardado || mptkRestaurandoBorrador) return '';
        const fecha = elFecha?.value || '';
        const raw = elMuestra?.value || '';
        if (!fecha || !raw) return '';
        snapshotBorradorTk_(fecha, raw, { activa: true });
        return claveBorradorTk(fecha, raw);
    }

    /** Solo localStorage — nunca envía a planilla ni cola de sync. */
    function persistirSoloLocalMptk_() {
        cancelarGuardadoBorradorProgramadoMptk_();
        guardarBorradorMuestraActivaInmediatoMptk_();
    }

    function programarGuardadoBorradorTk_() {
        if (omitirAutoguardado || mptkRestaurandoBorrador) return;
        cancelarGuardadoBorradorProgramadoMptk_();
        draftSaveTimer = setTimeout(() => {
            draftSaveTimer = null;
            guardarBorradorMuestraActivaMptk_();
            actualizarFabRestanteBadgeMptk();
        }, 220);
    }

    function callbackJsonp(params, timeoutMs) {
        const limiteMs = Number(timeoutMs);
        const espera = Number.isFinite(limiteMs) && limiteMs > 0 ? limiteMs : 14000;
        return new Promise((resolve, reject) => {
            const cb = '__mptk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
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

    /** Misma lógica que Packing: filas con HORA_REGISTRO (col 91) en servidor. */
    function filasPackingHechasDesdeDetalleTk_(d) {
        if (!d || typeof d !== 'object') return 0;
        const conHora = Number(d.FILAS_PACKING_CON_HORA_REGISTRO);
        if (Number.isFinite(conHora) && conHora >= 0) return conHora;
        return Number(d.FILAS_PACKING_REGISTRADAS ?? 0) || 0;
    }

    function aplicarCuotaDesdeDetalleTk_(d) {
        if (!d || typeof d !== 'object') {
            mptkQuota.filasTotalCampo = 0;
            mptkQuota.filasPackingRegistradas = 0;
            mptkQuota.filasTkRegistradas = 0;
            mptkQuota.maxClamshell = 0;
            return;
        }
        const totalCampo = Number(d.FILAS_TOTAL_CAMPO ?? d.numFilas ?? 0);
        mptkQuota.filasTotalCampo = Number.isFinite(totalCampo) && totalCampo >= 0 ? totalCampo : 0;
        const hechas = filasPackingHechasDesdeDetalleTk_(d);
        mptkQuota.filasPackingRegistradas = Number.isFinite(hechas) && hechas >= 0 ? hechas : 0;
        mptkQuota.filasTkRegistradas = d?.tieneThermoKing === true ? (Number(d.MAX_CLAMSHELL) || mptkQuota.filasTotalCampo || 0) : 0;
        let max = Number(d.MAX_CLAMSHELL ?? 0);
        if (!max && d.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        if (mptkQuota.filasTotalCampo > 0 && (max <= 0 || max < mptkQuota.filasTotalCampo)) {
            max = mptkQuota.filasTotalCampo;
        }
        mptkQuota.maxClamshell = max > 0 ? max : 0;
    }

    function cuotaMaximaEfectivaMptk_() {
        if (mptkQuota.maxClamshell > 0) return mptkQuota.maxClamshell;
        if (mptkQuota.filasTotalCampo > 0) return mptkQuota.filasTotalCampo;
        return 0;
    }

    /** Cuota packing desde campo (HORA_REGISTRO): igual que restantesPorAgregarPacking. */
    function restantesPackingDesdeCampoMptk_() {
        const max = cuotaMaximaEfectivaMptk_();
        if (max <= 0) return 0;
        return Math.max(0, max - mptkQuota.filasPackingRegistradas);
    }

    function filasTkHechasMptk_() {
        if (tkYaEnServidor) return cuotaMaximaEfectivaMptk_();
        return Math.max(0, Number(mptkQuota.filasTkRegistradas) || 0);
    }

    /** Slots TK libres en servidor (sin contar cards en pantalla). */
    function slotsDisponiblesTkMptk_() {
        const max = cuotaMaximaEfectivaMptk_();
        return Math.max(0, max - filasTkHechasMptk_());
    }

    /** Como Packing ensureCardPorDefecto: primera card real para que el badge reste en pantalla. */
    function ensureCardPorDefectoMptk_() {
        if (!String(elMuestra?.value || '').trim() || tkYaEnServidor) return null;
        if (!lastDetalleTk || !muestraPackingCompletaParaTk_(lastDetalleTk)) return null;
        if ((window.MptkUi?.getCardsCount?.() || 0) > 0) return null;
        if (slotsDisponiblesTkMptk_() <= 0) {
            window.MptkUi?.resetCards?.();
            return null;
        }
        const start = filasTkHechasMptk_() + 1;
        window.MptkUi?.reiniciarCards?.(start);
        return window.MptkUi?.getCardsCount?.() ? true : null;
    }

    /** Igual que Packing: cuota del ensayo menos filas TK en servidor menos cards en pantalla. */
    function restantesPorAgregarMptk_() {
        const max = cuotaMaximaEfectivaMptk_();
        if (max <= 0) return 0;
        if (!(String(elMuestra?.value || '').trim())) return 0;
        const enServidor = filasTkHechasMptk_();
        const enPantalla = window.MptkUi?.getCardsCount?.() || 0;
        return Math.max(0, max - enServidor - enPantalla);
    }

    function muestraMptkCompletaEnPantalla_() {
        if (!String(elMuestra?.value || '').trim()) return false;
        if (tkYaEnServidor) return false;
        if (!muestraPackingCompletaParaTk_(lastDetalleTk)) return false;
        if (restantesPorAgregarMptk_() > 0) return false;
        if (!hayDatosCapturaMptk_(leerEstadoFormularioTk_())) return false;
        return validarCompletitudTkParaEnvio().ok;
    }

    function setButtonLoadingMptk_(btn, loading, textoCargando) {
        if (!btn) return;
        if (loading) {
            if (!btn.dataset.mptkLabelOriginal) {
                btn.dataset.mptkLabelOriginal = btn.textContent || 'Enviar registro';
            }
            btn.disabled = true;
            btn.textContent = textoCargando || 'Enviando...';
        } else {
            btn.textContent = btn.dataset.mptkLabelOriginal || 'Enviar registro';
            delete btn.dataset.mptkLabelOriginal;
            actualizarBtnEnviarMptk_();
        }
    }

    function puedeIntentarEnviarMptk_() {
        if (!(String(elMuestra?.value || '').trim())) return false;
        if (tkYaEnServidor) return false;
        if (!muestraPackingCompletaParaTk_(lastDetalleTk)) return false;
        if (restantesPorAgregarMptk_() > 0) return false;
        if (elCardsWrap?.classList.contains('is-disabled')) return false;
        return true;
    }

    function actualizarBtnEnviarMptk_() {
        if (!elBtnEnviar || envioTkEnCurso) return;
        const hayMuestra = !!(String(elMuestra?.value || '').trim());
        const puedeEnviar = puedeIntentarEnviarMptk_();
        elBtnEnviar.disabled = !puedeEnviar;
        if (elEnvioBarMptk) {
            elEnvioBarMptk.classList.toggle('is-disabled', !hayMuestra);
        }
    }

    function actualizarFabRestanteBadgeMptk() {
        const hayMuestra = !!(String(elMuestra?.value || '').trim());
        const max = cuotaMaximaEfectivaMptk_();
        let rest = 0;
        if (hayMuestra && lastDetalleTk && muestraPackingCompletaParaTk_(lastDetalleTk)) {
            rest = restantesPorAgregarMptk_();
        }
        const contadorCero = rest === 0;
        const hayTrabajo = hayMuestra && hayDatosTrabajoTk_(leerEstadoFormularioTk_());
        let listaParaEnviar = false;
        if (hayMuestra && !tkYaEnServidor && contadorCero && hayTrabajo) {
            listaParaEnviar = validarCompletitudTkParaEnvio().ok;
        }

        if (listaParaEnviar && !mptkBadgeWasComplete) {
            snapshotBorradorTk_(elFecha?.value, elMuestra?.value);
        }
        mptkBadgeWasComplete = listaParaEnviar;

        if (elFabRestanteBadge) {
            if (!hayMuestra || !lastDetalleTk) {
                elFabRestanteBadge.setAttribute('aria-hidden', 'true');
                elFabRestanteBadge.classList.remove('is-complete', 'is-pending');
            } else {
                elFabRestanteBadge.removeAttribute('aria-hidden');
                elFabRestanteBadge.textContent = String(rest);
                elFabRestanteBadge.classList.toggle('is-complete', contadorCero);
                elFabRestanteBadge.classList.toggle('is-pending', rest > 0);
            }
        }
        if (elFabAgregar) {
            const ratioTk = max > 0 ? ((filasTkHechasMptk_() + (window.MptkUi?.getCardsCount?.() || 0)) + '/' + max + ' clamshells') : '';
            elFabAgregar.disabled = false;
            if (!hayMuestra) {
                elFabAgregar.title = 'Selecciona muestra para continuar';
            } else if (!lastDetalleTk || !muestraPackingCompletaParaTk_(lastDetalleTk)) {
                elFabAgregar.title = 'Termina packing en servidor para continuar con esta muestra';
            } else if (tkYaEnServidor) {
                elFabAgregar.title = 'Thermo-King ya en planilla'
                    + (ratioTk ? (' · ' + ratioTk) : '');
            } else if (listaParaEnviar) {
                elFabAgregar.title = 'Lista para enviar MP-TK'
                    + (ratioTk ? (' · ' + ratioTk) : '');
            } else if (rest > 0) {
                elFabAgregar.title = 'Agregar Thermo-King · faltan ' + rest + ' de ' + max;
            } else {
                elFabAgregar.title = ratioTk
                    ? ('Abrir captura MP-TK · ' + ratioTk)
                    : 'Abrir captura MP-TK';
            }
        }
        if (elFabPdf) {
            const puedePdf = puedeGenerarPdfMptk_();
            elFabPdf.disabled = !puedePdf;
            elFabPdf.title = puedePdf
                ? 'Generar PDF del registro MP-TK'
                : 'Captura datos en una muestra pendiente para generar el PDF';
        }
        actualizarBtnEnviarMptk_();
    }

    function muestraPackingCompletaParaTk_(d) {
        if (!d) return false;
        if (d.packing_completo_en_servidor === true) return true;
        if (d.packing_completo_en_servidor === false) return false;
        const max = Number(d.MAX_CLAMSHELL) || Number(d.FILAS_TOTAL_CAMPO) || 0;
        const hechas = filasPackingHechasDesdeDetalleTk_(d);
        if (max > 0 && hechas >= max) return true;
        if (d.puede_registrar_mas === true) return false;
        return false;
    }

    function fundoHabilitaMptk_(d) {
        return window.FundoFlujoTk20?.habilitaDesdeDetalle?.(d || lastDetalleTk) === true;
    }

    function mptkCapturaPermitida_(d) {
        const det = d || lastDetalleTk;
        if (!det) return false;
        if (!fundoHabilitaMptk_(det)) return false;
        if (det.tieneThermoKing === true) return false;
        return muestraPackingCompletaParaTk_(det);
    }

    function muestraTkPendienteEnServidor_(d) {
        if (!d) return false;
        if (!fundoHabilitaMptk_(d)) return false;
        if (d.puede_continuar_thermoking === true) return true;
        if (d.puede_continuar_thermoking === false) return false;
        return muestraPackingCompletaParaTk_(d) && d.tieneThermoKing !== true;
    }

    async function fetchMuestrasPorFecha(fechaIso) {
        const r = await callbackJsonp({
            listado_muestras_fecha: '1',
            fecha: fechaIso
        });
        if (r && r.ok === true && Array.isArray(r.muestras)) return r.muestras;
        const r2 = await callbackJsonp({
            listado_registrados: '1',
            fecha_desde: fechaIso,
            fecha_hasta: fechaIso
        });
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

    function normalizarItemMuestraTk_(item) {
        return {
            num_muestra: String(item?.num_muestra || '').trim(),
            ensayo_numero: String(item?.ensayo_numero || '').trim(),
            modo_registro: String(item?.modo_registro || '').trim().toLowerCase(),
            offline: !!item?.offline,
            tieneThermoKing: item?.tieneThermoKing === true,
            packing_completo_en_servidor: item?.packing_completo_en_servidor === true,
            puede_continuar_thermoking: item?.puede_continuar_thermoking === true
        };
    }

    /** Todas las muestras operativas del día (como Packing). Validación al elegir; completas muestran status. */
    function normalizarListaMuestrasOperativasTk_(lista) {
        if (!lista.length) return [];
        const out = [];
        const seen = new Set();
        lista.forEach((item) => {
            const norm = normalizarItemMuestraTk_(item);
            if (!norm.ensayo_numero) return;
            const key = norm.num_muestra + '|' + norm.ensayo_numero;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(norm);
        });
        out.sort((a, b) => (Number(a.ensayo_numero) || 0) - (Number(b.ensayo_numero) || 0));
        return out;
    }

    function muestrasOfflineDesdeBorradorTk(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return [];
        const store = leerStoreBorradorTk();
        const lista = [];
        const visto = new Set();
        Object.keys(store.porClave || {}).forEach((key) => {
            if (!key.startsWith(fecha + '::')) return;
            const raw = key.slice(fecha.length + 2);
            if (!raw || visto.has(raw)) return;
            visto.add(raw);
            const entry = store.porClave[key];
            const partes = raw.split('|');
            lista.push({
                num_muestra: String(entry?.meta?.num_muestra || partes[0] || '').trim(),
                ensayo_numero: String(entry?.meta?.ensayo_numero || partes[1] || '').trim(),
                modo_registro: String(entry?.meta?.modo_registro || entry?.detalleSnap?.modo_registro || '').trim().toLowerCase(),
                offline: true
            });
        });
        return lista.filter((m) => m.num_muestra || m.ensayo_numero);
    }

    function textoSelectMuestra(num, en, extra) {
        const n = String(num || '').trim();
        const e = String(en || '').trim();
        const base = n && e ? (n + ' - ' + e + ' muestra') : (n || e);
        return extra ? (base + ' ' + extra) : base;
    }

    function poblarSelectMuestra(lista) {
        if (!elMuestra) return;
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
            const hojaTag = modo === 'acopio' ? ' · Acopio' : (modo === 'visual' ? ' · Visual' : '');
            opt.textContent = textoSelectMuestra(num, en, (item.offline ? '(borrador)' : '') + hojaTag);
            elMuestra.appendChild(opt);
        });
        elMuestra.disabled = n === 0;
        if (n === 0) elMuestra.setAttribute('disabled', 'disabled');
        else elMuestra.removeAttribute('disabled');
        muestrasPendientesTkCount = n;
        actualizarFabRestanteBadgeMptk();
    }

    let mptkStatusValidacionEnVivo_ = false;
    let mptkStatusSeguimientoEnvio_ = false;
    let mptkStatusValidacionRaf_ = 0;

    function esMensajeValidacionEnvioMptk_(txt) {
        const t = String(txt || '').trim();
        if (!t) return false;
        const prefijos = [
            'Control ·',
            'Pesos ',
            'Tiempos ',
            'Presión ·',
            'Cabecera ·',
            'Clamshells ·',
            'La simulación no pasó validación:'
        ];
        return prefijos.some((p) => t.startsWith(p));
    }

    function setStatus(msg, tipo) {
        if (!elStatus) return;
        const texto = msg || '';
        if (!texto) {
            mptkStatusValidacionEnVivo_ = false;
            mptkStatusSeguimientoEnvio_ = false;
        } else if (texto.startsWith('La simulación no pasó validación:')) {
            mptkStatusValidacionEnVivo_ = true;
        } else if (esMensajeValidacionEnvioMptk_(texto)) {
            mptkStatusSeguimientoEnvio_ = true;
        }
        elStatus.textContent = texto;
        elStatus.className = 'packing-status-msg' + (tipo ? ' packing-status-msg--' + tipo : '');
        elStatus.hidden = !texto;
        syncFoldBtnAnchor();
    }

    function actualizarStatusValidacionEnVivoMptk_() {
        if (!elMuestra?.value) return;
        const txt = String(elStatus?.textContent || '').trim();
        const siguiendo = mptkStatusValidacionEnVivo_
            || mptkStatusSeguimientoEnvio_
            || esMensajeValidacionEnvioMptk_(txt);
        if (!siguiendo) return;

        const val = validarCompletitudTkParaEnvio();
        if (val.ok) {
            mptkStatusValidacionEnVivo_ = false;
            mptkStatusSeguimientoEnvio_ = false;
            setStatus('');
            return;
        }
        const msg = mptkStatusValidacionEnVivo_
            ? ('La simulación no pasó validación: ' + (val.errores[0] || 'revisa los datos.'))
            : (val.errores[0] || 'Revisa los datos antes de enviar.');
        if (txt !== msg) setStatus(msg, 'warn');
    }

    function programarActualizarStatusValidacionMptk_() {
        if (mptkStatusValidacionRaf_) cancelAnimationFrame(mptkStatusValidacionRaf_);
        mptkStatusValidacionRaf_ = requestAnimationFrame(() => {
            mptkStatusValidacionRaf_ = 0;
            actualizarStatusValidacionEnVivoMptk_();
        });
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
            if (on) {
                elResumenToggle.title = 'Espera mientras cargan los datos';
            } else {
                const collapsed = elChipsPanel?.classList.contains('is-collapsed');
                const titulo = collapsed ? 'Mostrar datos del registro' : 'Ocultar datos del registro';
                elResumenToggle.title = titulo;
            }
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
        setResumenVisible(false);
        lastDetalleTk = null;
        tkYaEnServidor = false;
        mptkMuestraAnterior = '';
        aplicarCuotaDesdeDetalleTk_(null);
        limpiarFormularioTk_();
        window.MptkUi?.resetCards?.();
        setFormularioHabilitado(false);
        limpiarPreviewChips();
        actualizarFabRestanteBadgeMptk();
    }

    function logMetaServidorMptkConsola(_d) {
        /* Sin log en consola: saturaba DevTools al cargar muestras con muchas filas packing. */
    }

    function limitePesoIngresoMpDesdeDetalleMptk_(clamshellNum, detalle) {
        const d = detalle || lastDetalleTk;
        if (!d) return null;
        const porFila = Array.isArray(d.pesoSalidaPrefrioPorFila) ? d.pesoSalidaPrefrioPorFila : [];
        const idx = Math.max(0, Number(clamshellNum) - 1);
        const v = porFila[idx];
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function pintarPreview(d) {
        if (!d) {
            limpiarPreview();
            return;
        }
        logMetaServidorMptkConsola(d);
        const etapa = String(d.TRAZ_ETAPA ?? '').trim();
        const campo = String(d.TRAZ_CAMPO ?? '').trim();
        const turno = String(d.TRAZ_TURNO ?? d.TRAZ_LIBRE ?? '').trim();
        const traz = [etapa, campo, turno].filter(Boolean).join('-');
        setChip('mptk-traz', traz, !traz, 'packing-chip-value--traz');
        setChip('mptk-variedad', d.VARIEDAD, !d.VARIEDAD);
        actualizarChipPlacaTk_();
        if (elPreview) {
            elPreview.classList.remove('is-loading-preview');
            elPreview.classList.add('is-loaded');
        }

        const num = String(d.NUM_MUESTRA || ensayoSeleccionado().num_muestra || '').trim();
        const ens = String(d.ENSAYO_NOMBRE || d.ENSAYO_NUMERO || ensayoSeleccionado().ensayo_numero || '').trim();
        setInput('rotulo_muestra_tk', num && ens ? (num + ' · ' + ens) : (num || ens));
        setInput('variedad_info_tk', d.VARIEDAD);
        setInput('etapa_info_tk', etapa);
        setInput('campo_info_tk', campo);
        setInput('turno_info_tk', turno);
        if (window.MptkUi) window.MptkUi.render();
        syncFoldBtnAnchor();
    }

    function setFormularioHabilitado(on) {
        if (elHoraRow) {
            elHoraRow.classList.toggle('is-disabled', !on);
            elHoraRow.setAttribute('aria-disabled', on ? 'false' : 'true');
        }
        if (elControlBar) {
            elControlBar.classList.toggle('is-disabled', !on);
            ['btn_temp_mp_mptk', 'btn_temp_tk_mptk', 'btn_hum_mptk', 'btn_placa_mptk'].forEach((id) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                if (on) btn.removeAttribute('disabled');
                else btn.setAttribute('disabled', 'disabled');
            });
            actualizarBtnPlacaMptkTitulo_();
        }
        if (elCardsWrap) {
            elCardsWrap.classList.toggle('is-disabled', !on);
            elCardsWrap.setAttribute('aria-disabled', on ? 'false' : 'true');
        }
        const elResp = document.getElementById('responsable_tk');
        const elHora = document.getElementById('hora_salida_frio_tk');
        if (elResp) {
            if (on) elResp.removeAttribute('disabled');
            else elResp.setAttribute('disabled', 'disabled');
        }
        if (elHora) {
            if (on) {
                elHora.removeAttribute('disabled');
                initTimePickersMptk_(document.getElementById('mptk-hora-row') || elHora.parentElement);
            } else {
                elHora.setAttribute('disabled', 'disabled');
            }
        }
        if (on) {
            ensureCardPorDefectoMptk_();
        }
        if (elBtnEnviar) actualizarBtnEnviarMptk_();
        if (window.MptkUi) window.MptkUi.render();
    }

    function limpiarFormularioTk_() {
        omitirAutoguardado = true;
        INPUT_IDS_EDITABLES.forEach((id) => setInput(id, ''));
        setInput('responsable_tk', '');
        setInput('hora_salida_frio_tk', '');
        setInput('rotulo_muestra_tk', '');
        setInput('variedad_info_tk', '');
        setInput('etapa_info_tk', '');
        setInput('campo_info_tk', '');
        setInput('turno_info_tk', '');
        setInput('placa_thermoking_tk', '');
        [
            'mptk-inp-peso-ic', 'mptk-inp-peso-st', 'mptk-inp-peso-it', 'mptk-inp-peso-dp',
            'mptk-inp-tiempo-ic', 'mptk-inp-tiempo-st', 'mptk-inp-tiempo-it', 'mptk-inp-tiempo-dp'
        ].forEach((id) => setInput(id, ''));
        omitirAutoguardado = false;
        actualizarChipPlacaTk_();
        actualizarBtnPlacaMptkTitulo_();
        if (window.MptkUi) window.MptkUi.render();
    }

    function limpiarUiCapturaMuestraMptk_() {
        limpiarFormularioTk_();
        window.MptkUi?.resetCards?.();
    }

    function prepararUiNuevaMuestraMptk_() {
        limpiarUiCapturaMuestraMptk_();
        setResumenVisible(true);
        setChipsPanelCollapsed(false, false);
        setPreviewLoading(true, 'Cargando datos…');
        limpiarPreviewChips();
    }

    function syncFechaInspeccionDesdeSelector_() {
        const f = normalizarFechaIso(elFecha?.value) || hoyIsoLocal();
        setInput('fecha_inspeccion_tk', f);
    }

    function initTimePickersMptk_(root) {
        if (!window.CustomTimePicker || typeof window.CustomTimePicker.init !== 'function') return;
        window.CustomTimePicker.init(root || document.getElementById('mptk-main') || document);
        const btnClear = document.getElementById('time-picker-clear-mptk');
        if (btnClear && btnClear.dataset.mptkBound !== '1') {
            btnClear.dataset.mptkBound = '1';
            btnClear.addEventListener('click', () => {
                if (typeof window.CustomTimePicker.limpiar === 'function') {
                    window.CustomTimePicker.limpiar();
                }
            });
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function swalFireMptk_(options) {
        if (!(window.Swal && typeof window.Swal.fire === 'function')) return null;
        const incoming = options || {};
        const isToast = !!incoming.toast;
        const opts = Object.assign({}, incoming);
        if (!isToast) {
            const active = document.activeElement;
            if (active && typeof active.blur === 'function') active.blur();
            opts.returnFocus = false;
        } else {
            delete opts.returnFocus;
        }
        return window.Swal.fire(opts);
    }

    function confirmarSwalMptk_(opts) {
        return swalFireMptk_(opts).then((r) => !!(r && r.isConfirmed));
    }

    async function mostrarErroresCompletitudMptk_(errores, titulo) {
        const lista = (Array.isArray(errores) ? errores : []).map((e) => String(e || '').trim()).filter(Boolean);
        if (!lista.length) return;
        const top = lista.slice(0, 12);
        const extra = Math.max(0, lista.length - top.length);
        const listHtml = top.map((txt) => (
            '<li class="swal-campos-item">'
            + '<span class="swal-campos-dot"></span>'
            + '<span class="swal-campos-item-text">' + txt.replace(/</g, '&lt;') + '</span>'
            + '</li>'
        )).join('');
        const extraHtml = extra > 0
            ? '<div style="margin-top:8px;font-size:12px;color:#64748b;">... y ' + extra + ' punto(s) más</div>'
            : '';
        const tituloFinal = titulo || ('Datos incompletos (' + lista.length + ')');
        if (window.Swal && typeof window.Swal.fire === 'function') {
            await swalFireMptk_({
                icon: 'warning',
                title: tituloFinal,
                html: '<div class="swal-campos-wrap">'
                    + '<div class="swal-campos-head">Completa estos puntos antes de enviar</div>'
                    + '<ul class="swal-campos-list">' + listHtml + '</ul>'
                    + '<div class="swal-campos-foot">'
                    + (extraHtml || '<span>Revisa pesos, tiempos, temperatura, humedad y presión.</span>')
                    + '</div></div>',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#1f4f82',
                width: 480,
                customClass: {
                    popup: 'swal-campos-popup',
                    title: 'swal-campos-title',
                    confirmButton: 'swal-campos-confirm-btn'
                },
                allowOutsideClick: false
            });
            return;
        }
        alert(tituloFinal + '\n- ' + top.join('\n- ') + (extra > 0 ? '\n... y ' + extra + ' más' : ''));
    }

    function establecerMenuFlotanteMptk(open) {
        if (!elFabMenu || !elFabOptionsBtn) return;
        elFabMenu.classList.toggle('is-open', open);
        elFabOptionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function mensajeFechaRingMptk(d) {
        const mesLargo = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d);
        const dia = d.getDate();
        const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        if (dia <= 7) {
            return mesLargo + ' recién comenzó — día ' + dia + ' de ' + diasMes;
        }
        return 'Estamos en ' + mesLargo + ' — día ' + dia + ' de ' + diasMes;
    }

    function actualizarArcoFechaRingMptk(d) {
        if (!elFechaRingCircle) return;
        const dia = d.getDate();
        const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const progreso = Math.min(1, Math.max(0, dia / diasMes));
        const arcoDeg = Math.round(70 * progreso);
        const corte = 280 - arcoDeg;
        elFechaRingCircle.style.background = 'conic-gradient(from 210deg, rgba(22, 76, 124, 0.18) 0deg '
            + corte + 'deg, rgba(29, 78, 137, 0.92) ' + corte + 'deg 360deg)';
    }

    function actualizarFechaRingMptk() {
        const dayEl = document.getElementById('fecha-ring-day-mptk');
        const monthEl = document.getElementById('fecha-ring-month-mptk');
        if (!dayEl || !monthEl) return;
        const d = new Date();
        dayEl.textContent = String(d.getDate()).padStart(2, '0');
        const mes = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '');
        monthEl.textContent = (mes + ' ' + d.getFullYear()).toUpperCase();
        const msg = mensajeFechaRingMptk(d);
        if (elFechaRingPopover && !elFechaRingWidget?.classList.contains('is-popover-open')) {
            elFechaRingPopover.textContent = msg;
        }
        if (elFechaRingWidget) elFechaRingWidget.title = msg;
        actualizarArcoFechaRingMptk(d);
    }

    function togglePopoverFechaRingMptk(forceOpen) {
        if (!elFechaRingWidget || !elFechaRingPopover) return;
        const abrir = forceOpen === true
            ? true
            : (forceOpen === false ? false : !elFechaRingWidget.classList.contains('is-popover-open'));
        const d = new Date();
        elFechaRingPopover.textContent = mensajeFechaRingMptk(d);
        elFechaRingWidget.classList.toggle('is-popover-open', abrir);
        elFechaRingPopover.hidden = !abrir;
    }

    async function sincronizarConPlanillaMptk() {
        establecerMenuFlotanteMptk(false);
        if (!navigator.onLine) {
            setStatus('Sin internet para sincronizar con la planilla.', 'warn');
            return;
        }
        setSelectLoading(true, 'Sincronizando planilla…');
        try {
            await sincronizarPendientesTk();
            await acotarFechaDesdePlanilla();
            const fecha = elFecha?.value || '';
            if (fecha) await cargarMuestrasPorFecha(fecha);
            const sel = ensayoSeleccionado();
            if (fecha && sel.ensayo_numero) await cargarDetalle(fecha, sel.ensayo_numero);
            setStatus('Planilla actualizada.', '');
            if (elStatus) elStatus.hidden = true;
        } catch (err) {
            setStatus(String(err.message || err), 'error');
        } finally {
            setSelectLoading(false);
        }
    }
    window.sincronizarConPlanillaMptk = sincronizarConPlanillaMptk;
    window.establecerMenuFlotanteMptk = establecerMenuFlotanteMptk;
    window.actualizarFabRestanteBadgeMptk = actualizarFabRestanteBadgeMptk;

    async function borrarTodoLocalMptk_() {
        establecerMenuFlotanteMptk(false);
        const confirmado = await confirmarSwalMptk_({
            icon: 'warning',
            title: 'Eliminar borradores MP-TK',
            html: '<p style="margin:0 0 8px;font-size:14px;line-height:1.45;">'
                + 'Se borrarán borradores locales de MP-TK, tiempos, pesos, control y pendientes Thermo-King en cola.'
                + '</p>'
                + '<p style="margin:0;font-size:13px;color:#64748b;line-height:1.4;">'
                + 'La app se recargará. Responsable y hora salida frío quedarán vacíos para capturar de nuevo.'
                + '</p>',
            showCancelButton: true,
            confirmButtonText: 'Sí, borrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#D92D20',
            allowOutsideClick: false
        });
        if (!confirmado) return;

        omitirAutoguardado = true;
        if (draftSaveTimer) clearTimeout(draftSaveTimer);

        try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (_) { /* ignore */ }
        try { localStorage.removeItem(CHIPS_COLLAPSED_KEY); } catch (_) { /* ignore */ }
        try {
            const queue = cargarColaSync().filter((r) => !esRegistroColaTk(r));
            guardarColaSync(queue);
        } catch (_) { /* ignore */ }

        lastDetalleTk = null;
        tkYaEnServidor = false;
        limpiarUiCapturaMuestraMptk_();
        limpiarPreview();
        actualizarHeaderPendientes();
        mostrarToastTk('success', 'Limpieza completa', 'Recargando MP-TK…');
        setTimeout(() => {
            try { window.location.reload(); } catch (_) { /* ignore */ }
        }, 450);
    }

    function minutosDesdeHoraMptk_(hora) {
        if (!hora) return null;
        const [h, m] = String(hora).split(':').map(Number);
        if ([h, m].some((x) => Number.isNaN(x))) return null;
        return (h * 60) + m;
    }

    function sumarMinutosHoraMptk_(hora, minutosAgregar) {
        const m = minutosDesdeHoraMptk_(hora);
        if (m === null) return '';
        const total = ((m + minutosAgregar) % (24 * 60) + (24 * 60)) % (24 * 60);
        return String(Math.floor(total / 60)).padStart(2, '0') + ':'
            + String(total % 60).padStart(2, '0');
    }

    function pesosDemoParaCardMptk_(clamshellNum, plantilla) {
        const p = plantilla || MPTK_DEMO_PLANTILLA;
        const delta = (Number(clamshellNum) - 1) * (p.pesoDeltaPorCard || 0.4);
        const r1 = (n) => Math.round(Math.max(0.1, n) * 10) / 10;
        const b = p.pesosBase || {};
        return {
            ic: String(r1((b.ic || 143.8) - delta)),
            st: String(r1((b.st || 142.1) - delta)),
            it: String(r1((b.it || 141.5) - delta)),
            dp: String(r1((b.dp || 140.9) - delta))
        };
    }

    function tiemposDemoParaCardMptk_(clamshellNum, plantilla) {
        const p = plantilla || MPTK_DEMO_PLANTILLA;
        const base = p.baseHoraTiempos || '06:30';
        const offsets = Array.isArray(p.offsetsTiemposMin) ? p.offsetsTiemposMin : [0, 105, 135, 230];
        const extra = (Number(clamshellNum) - 1) * (p.offsetsTiemposPorCardMin || 5);
        return {
            ic: sumarMinutosHoraMptk_(base, (offsets[0] || 0) + extra),
            st: sumarMinutosHoraMptk_(base, (offsets[1] || 0) + extra),
            it: sumarMinutosHoraMptk_(base, (offsets[2] || 0) + extra),
            dp: sumarMinutosHoraMptk_(base, (offsets[3] || 0) + extra)
        };
    }

    function llenarControlEquitativoDemoMptk_(plantilla) {
        const p = plantilla || MPTK_DEMO_PLANTILLA;
        Object.entries(p.temperatura || {}).forEach(([id, v]) => setInput(id, v));
        Object.entries(p.humedad || {}).forEach(([id, v]) => setInput(id, v));
    }

    /** Demo MP-TK: cards + control global; solo localStorage (no envía a planilla). */
    function aplicarDemoMptkEnMuestraActiva_(objetivoLocal, sel, plantilla) {
        const p = plantilla || MPTK_DEMO_PLANTILLA;
        const prefObs = String(p.observacionPrefijo || 'SIM-TK-');
        const startNum = filasTkHechasMptk_() + 1;
        const cards = [];
        for (let i = 0; i < objetivoLocal; i++) {
            const num = startNum + i;
            cards.push({
                id: i + 1,
                clamshellNum: num,
                pesos: pesosDemoParaCardMptk_(num, p),
                tiempos: tiemposDemoParaCardMptk_(num, p),
                observacion: prefObs + num
            });
        }
        window.MptkUi?.importCardsState?.(cards, cards[0]?.id);
        syncFechaInspeccionDesdeSelector_();
        setInput('responsable_tk', p.responsable || 'Demo MP-TK');
        const horaFrio = String(p.horaSalidaFrio || '').trim()
            || sumarMinutosHoraMptk_(p.baseHoraTiempos || '06:30', -30);
        setInput('hora_salida_frio_tk', horaFrio);
        const placaDemo = normalizarPlacaTkInput_(
            p.placaThermoking
            || getPlacaCampoDesdeDetalleMptk_()
            || String(lastDetalleTk?.PLACA_TK ?? '').trim()
            || 'TK-DEMO'
        );
        setInput('placa_thermoking_tk', placaDemo);
        actualizarChipPlacaTk_();
        actualizarBtnPlacaMptkTitulo_();
        llenarControlEquitativoDemoMptk_(p);
        recalcularPresionesMptk_();
        actualizarFabRestanteBadgeMptk();
        guardarBorradorMuestraActivaInmediatoMptk_();
        return {
            etiqueta: textoSelectMuestra(sel.num_muestra, sel.ensayo_numero),
            ensayo: sel.ensayo_numero
        };
    }

    function reafirmarBorradorMptkAlVolverVisible_() {
        persistirSoloLocalMptk_();
        const raw = String(elMuestra?.value || '').trim();
        if (!raw || tkYaEnServidor) return false;
        const key = claveBorradorTk(elFecha?.value, raw);
        const borrador = key ? leerStoreBorradorTk().porClave[key] : null;
        if (!borrador || !hayDatosCapturaMptk_(borrador.estado)) return false;
        const actual = leerEstadoFormularioTk_();
        if (firmaEstadoCapturaMptk_(actual) === firmaEstadoCapturaMptk_(borrador.estado)) {
            actualizarFabRestanteBadgeMptk();
            return false;
        }
        if (!hayDatosCapturaMptk_(actual) && hayDatosCapturaMptk_(borrador.estado)) {
            mptkRestaurandoBorrador = true;
            try {
                aplicarEstadoFormularioTk_(borrador.estado);
                actualizarFabRestanteBadgeMptk();
            } finally {
                mptkRestaurandoBorrador = false;
            }
            return true;
        }
        actualizarFabRestanteBadgeMptk();
        return false;
    }

    async function fabIniciarRegistroMptk_() {
        establecerMenuFlotanteMptk(false);
        const rawMuestra = String(elMuestra?.value || '').trim();
        if (!rawMuestra) {
            mostrarToastTk('info', 'Seleccionar muestra', 'Selecciona una muestra antes de cargar datos de prueba.');
            return;
        }
        const sel = ensayoSeleccionado();
        if (!sel.ensayo_numero) {
            mostrarToastTk('info', 'Seleccionar muestra', 'Espera a que cargue la muestra en el selector.');
            return;
        }
        if (tkYaEnServidor) {
            mostrarToastTk('info', 'MP-TK completo', 'Thermo-King ya está en la planilla para esta muestra.');
            return;
        }
        if (!lastDetalleTk) {
            mostrarToastTk('info', 'Espera el detalle', 'Carga el detalle de la muestra (planilla) antes de simular.');
            return;
        }
        if (!muestraPackingCompletaParaTk_(lastDetalleTk)) {
            mostrarToastTk('warn', 'Packing incompleto', 'Termina packing en servidor antes de simular MP-TK.');
            return;
        }
        const maxEfectivo = cuotaMaximaEfectivaMptk_();
        if (maxEfectivo <= 0) {
            mostrarToastTk('warn', 'Sin cuota', 'No hay clamshells definidos para esta muestra.');
            return;
        }
        const enServidor = filasTkHechasMptk_();
        const objetivoLocal = Math.max(0, maxEfectivo - enServidor);
        if (objetivoLocal <= 0) {
            mostrarToastTk(
                'info',
                'MP-TK completo',
                'Esta muestra ya tiene todos sus Thermo-King (' + maxEfectivo + ').'
            );
            return;
        }

        const info = aplicarDemoMptkEnMuestraActiva_(objetivoLocal, sel, MPTK_DEMO_PLANTILLA);
        const validacionDemo = validarCompletitudTkParaEnvio();
        if (!validacionDemo.ok) {
            setStatus(
                'La simulación no pasó validación: ' + (validacionDemo.errores[0] || 'revisa los datos.'),
                'warn'
            );
            if (elStatus) elStatus.hidden = false;
            await mostrarErroresCompletitudMptk_(validacionDemo.errores, 'Simulación incompleta');
        } else {
            mptkStatusValidacionEnVivo_ = false;
            setStatus('');
            if (elStatus) elStatus.hidden = true;
            mostrarToastTk(
                'success',
                'Datos de prueba',
                info.etiqueta + ' (muestra ' + (info.ensayo || '—') + '): '
                    + objetivoLocal + ' Thermo-King válidos para enviar.'
            );
        }
        setFormularioHabilitado(true);
    }

    const MPTK_PDF_FILAS = 20;
    const MPTK_PDF_FILAS_TK = 8;
    const MPTK_PDF_FILAS_POR_MUESTRA = 10;
    const MPTK_PDF_INICIO_SEGUNDA_MUESTRA = 10;
    const MPTK_PDF_FILAS_SEGUNDA_BLOQUE = 10;
    const MPTK_TITULO_PDF = 'MEDICIÓN DE TIEMPOS, TEMPERATURA Y PESOS EN CÁMARA DE MATERIA PRIMA Y THERMO-KING - ARÁNDANO - A9';

    function fechaDisplayDdMmYyyyMptk_(iso) {
        const p = String(iso || hoyIsoLocal()).split('-');
        if (p.length !== 3) return String(iso || '');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }

    function formatoHoraPdfMptk_(hora) {
        const s = String(hora || '').trim();
        if (!s || !s.includes(':')) return s;
        const [h, m] = s.split(':');
        const hh = Number(h);
        if (Number.isNaN(hh)) return s;
        return `${hh}:${String(m || '00').padStart(2, '0')}`;
    }

    function valorPesoPdfMptk_(v) {
        const n = Number(String(v || '').replace(',', '.'));
        return Number.isFinite(n) && n > 0 ? String(n) : '';
    }

    function rotuloMuestraPdfMptk_(ensayoNumero) {
        const numEnsayo = Number(String(ensayoNumero ?? '').trim());
        if (Number.isFinite(numEnsayo) && numEnsayo > 0) return 'Ensayo ' + numEnsayo;
        const n = String(ensayoNumero || '').trim();
        if (!n) return '';
        if (/^(Ensayo|Muestra)\s/i.test(n)) return n;
        return 'Ensayo ' + n;
    }

    function filaPdfVaciaMptk_() {
        return {
            horaSalidaFrio: '', rotulo: '', variedad: '', etapa: '', campo: '', turno: '', placa: '',
            tIc: '', tSt: '', tIt: '', tDp: '',
            pIc: '', pSt: '', pIt: '', pDp: '',
            tempIcCm: '', tempIcPu: '', tempStCm: '', tempStPu: '',
            tempItAmb: '', tempItVeh: '', tempItPu: '',
            tempDpAmb: '', tempDpVeh: '', tempDpPu: '',
            hIc: '', hSt: '', hAei: '', hIvi: '', hAed: '', hIvd: '',
            presIc: '', presSt: '', presAei: '', presIvi: '', presAed: '', presIvd: '',
            vaporIc: '', vaporSt: '', vaporIt: '', vaporDp: ''
        };
    }

    function controlGlobalPdfMptk_(campos) {
        const c = campos || {};
        return {
            tempIcCm: String(c.temp_ic_cm_tk || '').trim(),
            tempIcPu: String(c.temp_ic_pu_tk || '').trim(),
            tempStCm: String(c.temp_st_cm_tk || '').trim(),
            tempStPu: String(c.temp_st_pu_tk || '').trim(),
            tempItAmb: String(c.temp_it_amb_tk || '').trim(),
            tempItVeh: String(c.temp_it_veh_tk || '').trim(),
            tempItPu: String(c.temp_it_pu_tk || '').trim(),
            tempDpAmb: String(c.temp_dp_amb_tk || '').trim(),
            tempDpVeh: String(c.temp_dp_veh_tk || '').trim(),
            tempDpPu: String(c.temp_dp_pu_tk || '').trim(),
            hIc: String(c.hum_ic_tk || '').trim(),
            hSt: String(c.hum_st_tk || '').trim(),
            hAei: String(c.hum_aei_tk || '').trim(),
            hIvi: String(c.hum_ivi_tk || '').trim(),
            hAed: String(c.hum_aed_tk || '').trim(),
            hIvd: String(c.hum_ivd_tk || '').trim(),
            presIc: String(c.pres_ic_tk || '').trim(),
            presSt: String(c.pres_st_tk || '').trim(),
            presAei: String(c.pres_aei_tk || '').trim(),
            presIvi: String(c.pres_ivi_tk || '').trim(),
            presAed: String(c.pres_aed_tk || '').trim(),
            presIvd: String(c.pres_ivd_tk || '').trim(),
            vaporIc: String(c.vapor_ic_tk || '').trim(),
            vaporSt: String(c.vapor_scm_tk || '').trim(),
            vaporIt: String(c.vapor_it_tk || '').trim(),
            vaporDp: String(c.vapor_st_tk || '').trim()
        };
    }

    function controlVacioPdfMptk_() {
        return {
            tempIcCm: '', tempIcPu: '', tempStCm: '', tempStPu: '',
            tempItAmb: '', tempItVeh: '', tempItPu: '',
            tempDpAmb: '', tempDpVeh: '', tempDpPu: '',
            hIc: '', hSt: '', hAei: '', hIvi: '', hAed: '', hIvd: '',
            presIc: '', presSt: '', presAei: '', presIvi: '', presAed: '', presIvd: '',
            vaporIc: '', vaporSt: '', vaporIt: '', vaporDp: ''
        };
    }

    function filaPdfDesdeCardMptk_(card, metaBase, control, incluirGlobal) {
        if (!incluirGlobal) {
            if (!card) return filaPdfVaciaMptk_();
            const p = card.pesos || {};
            return {
                ...filaPdfVaciaMptk_(),
                pIc: valorPesoPdfMptk_(p.ic),
                pSt: valorPesoPdfMptk_(p.st),
                pIt: valorPesoPdfMptk_(p.it),
                pDp: valorPesoPdfMptk_(p.dp)
            };
        }
        const t = card?.tiempos || {};
        const p = card?.pesos || {};
        const g = control || controlVacioPdfMptk_();
        return {
            horaSalidaFrio: metaBase.horaSalidaFrio,
            rotulo: metaBase.rotulo,
            variedad: metaBase.variedad,
            etapa: metaBase.etapa,
            campo: metaBase.campo,
            turno: metaBase.turno,
            placa: metaBase.placa,
            tIc: formatoHoraPdfMptk_(t.ic),
            tSt: formatoHoraPdfMptk_(t.st),
            tIt: formatoHoraPdfMptk_(t.it),
            tDp: formatoHoraPdfMptk_(t.dp),
            pIc: valorPesoPdfMptk_(p.ic),
            pSt: valorPesoPdfMptk_(p.st),
            pIt: valorPesoPdfMptk_(p.it),
            pDp: valorPesoPdfMptk_(p.dp),
            ...g
        };
    }

    function filasMuestraPdfMptk_(cards, metaBase, control) {
        const lista = (Array.isArray(cards) ? cards : []).slice(0, MPTK_PDF_FILAS_TK);
        const filas = [];
        for (let r = 0; r < MPTK_PDF_FILAS_TK; r++) {
            filas.push(filaPdfDesdeCardMptk_(lista[r] || null, metaBase, control, r === 0));
        }
        for (let i = MPTK_PDF_FILAS_TK; i < MPTK_PDF_FILAS_POR_MUESTRA; i++) {
            filas.push(filaPdfVaciaMptk_());
        }
        return filas;
    }

    function asegurarFilasMuestraPdfMptk_(filas, n) {
        const out = (Array.isArray(filas) ? filas : []).slice(0, n);
        while (out.length < n) out.push(filaPdfVaciaMptk_());
        return out;
    }

    function prepararHojaPdfSolaMuestraMptk_(item) {
        const filasA = asegurarFilasMuestraPdfMptk_(item.filas, MPTK_PDF_FILAS_POR_MUESTRA);
        const filas = [...filasA];
        while (filas.length < MPTK_PDF_FILAS) filas.push(filaPdfVaciaMptk_());
        const obsLista = Array.from({ length: MPTK_PDF_FILAS }, (_, i) => (
            String(item.pagina2?.observacionesLista?.[i] || '').trim()
        ));
        return {
            ...item,
            filas: filas.slice(0, MPTK_PDF_FILAS),
            pdfInicioSegundaMuestra: null,
            pagina2: {
                ...item.pagina2,
                observacionesLista: obsLista
            }
        };
    }

    function combinarDosMuestrasEnHojaPdfMptk_(a, b) {
        const filasA = asegurarFilasMuestraPdfMptk_(a.filas, MPTK_PDF_FILAS_POR_MUESTRA);
        const filasB = asegurarFilasMuestraPdfMptk_(b.filas, MPTK_PDF_FILAS_SEGUNDA_BLOQUE);
        const filas = [...filasA, ...filasB].slice(0, MPTK_PDF_FILAS);
        while (filas.length < MPTK_PDF_FILAS) filas.push(filaPdfVaciaMptk_());
        const obsLista = [
            ...filasA.map((_, i) => String(a.pagina2?.observacionesLista?.[i] || '').trim()),
            ...filasB.map((_, i) => String(b.pagina2?.observacionesLista?.[i] || '').trim())
        ].slice(0, MPTK_PDF_FILAS);
        while (obsLista.length < MPTK_PDF_FILAS) obsLista.push('');
        const nums = [a.meta?.numMuestra, b.meta?.numMuestra].map((s) => String(s || '').trim()).filter(Boolean);
        return {
            ...a,
            meta: {
                ...a.meta,
                numMuestra: nums.join(' · '),
                trazabilidad: [a.meta?.trazabilidad, b.meta?.trazabilidad].filter(Boolean).join(' · ')
                    || a.meta?.trazabilidad
            },
            filas,
            pdfInicioSegundaMuestra: MPTK_PDF_INICIO_SEGUNDA_MUESTRA,
            pagina2: {
                observacionesLista: obsLista,
                observaciones: obsLista.filter(Boolean).join(' · ')
            }
        };
    }

    function agruparMuestrasEnHojasPdfMptk_(muestras) {
        const hojas = [];
        for (let i = 0; i < muestras.length; i += 2) {
            const itemA = muestras[i];
            const itemB = muestras[i + 1] || null;
            hojas.push(itemB
                ? combinarDosMuestrasEnHojaPdfMptk_(itemA, itemB)
                : prepararHojaPdfSolaMuestraMptk_(itemA));
        }
        return hojas;
    }

    function numeroEnsayoPdfMptkDesdeRaw_(raw) {
        const parts = String(raw || '').split('|');
        return Number(parts[1]) || 0;
    }

    function ordenarMuestrasPdfMptkPorEnsayo_(muestras) {
        return (muestras || []).slice().sort((a, b) => {
            const na = Number(a?.ensayo) || 0;
            const nb = Number(b?.ensayo) || 0;
            return na - nb;
        });
    }

    function deduplicarMuestrasPdfMptkPorEnsayo_(muestras) {
        const seen = new Set();
        const out = [];
        ordenarMuestrasPdfMptkPorEnsayo_(muestras).forEach((m) => {
            const key = String(m?.ensayo || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(m);
        });
        return out;
    }

    function leerBorradorMuestraMptk_(fechaIso, rawMuestra) {
        const key = claveBorradorTk(fechaIso, rawMuestra);
        if (!key) return null;
        return leerStoreBorradorTk().porClave[key] || null;
    }

    function muestraMptkYaCompletaEnServidor_(raw) {
        const rawStr = String(raw || '').trim();
        if (!rawStr) return false;
        if (rawStr === String(elMuestra?.value || '').trim() && tkYaEnServidor) return true;
        if (metaListaMuestraMptk_(rawStr)?.tieneThermoKing) return true;
        const fecha = normalizarFechaIso(elFecha?.value);
        const entry = leerBorradorMuestraMptk_(fecha, rawStr);
        if (entry?.tkYaEnServidor) return true;
        return detalleSnapIndicaTkCompletoEnServidorMptk_(entry?.detalleSnap);
    }

    function obtenerOpcionesMuestraMptkSelect_() {
        if (!elMuestra) return [];
        return Array.from(elMuestra.options)
            .map((o) => String(o.value || '').trim())
            .filter(Boolean);
    }

    function numeroEnsayoMptkDesdeRaw_(raw) {
        return numeroEnsayoPdfMptkDesdeRaw_(raw);
    }

    function numeroEnsayoItemMptk_(item) {
        if (item == null) return 0;
        if (typeof item === 'string') return numeroEnsayoMptkDesdeRaw_(item);
        const en = Number(item.ensayo_numero || item.ensayo || 0);
        if (Number.isFinite(en) && en > 0) return en;
        return numeroEnsayoMptkDesdeRaw_(item.raw);
    }

    function ordenarMuestrasMptkPorEnsayo_(lista) {
        return (lista || []).slice().sort((a, b) => {
            const na = numeroEnsayoItemMptk_(a);
            const nb = numeroEnsayoItemMptk_(b);
            return na - nb;
        });
    }

    function recogerCandidatosMuestrasMptkDelDia_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return [];
        const vistos = new Set(obtenerOpcionesMuestraMptkSelect_());
        Object.keys(leerStoreBorradorTk().porClave || {}).forEach((key) => {
            if (!key.startsWith(fecha + '::')) return;
            const raw = key.slice(fecha.length + 2);
            if (raw) vistos.add(raw);
        });
        return Array.from(vistos);
    }

    function quotaDesdeDetalleMptk_(d) {
        if (!d || typeof d !== 'object') return { max: 0, filasTkHechas: 0 };
        const totalCampo = Number(d.FILAS_TOTAL_CAMPO ?? d.numFilas ?? 0);
        let max = Number(d.MAX_CLAMSHELL ?? 0);
        if (!max && d.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        if (totalCampo > 0 && (max <= 0 || max < totalCampo)) max = totalCampo;
        const filasTkHechas = d.tieneThermoKing === true
            ? (max > 0 ? max : (totalCampo > 0 ? totalCampo : 0))
            : 0;
        return { max: max > 0 ? max : 0, filasTkHechas };
    }

    function restantesDesdeEstadoMuestraMptk_(estado, detalleSnap) {
        const q = quotaDesdeDetalleMptk_(detalleSnap);
        const max = q.max;
        if (max <= 0) return 0;
        const cards = Array.isArray(estado?.mptkCards) ? estado.mptkCards.length : 0;
        return Math.max(0, max - q.filasTkHechas - cards);
    }

    function itemMuestraMptkParaLista_(raw, numMuestra, ensayoNumero) {
        return {
            raw,
            num_muestra: numMuestra,
            ensayo_numero: ensayoNumero,
            etiqueta: textoSelectMuestra(numMuestra, ensayoNumero)
        };
    }

    function valEstadoMptk_(estado, id) {
        return String(estado?.campos?.[id] ?? '').trim();
    }

    function validarCompletitudTkParaEnvioDesdeEstado_(estado, detalleSnap) {
        const errores = [];
        const msg = (grupo, texto) => grupo + ' · ' + texto;
        const q = quotaDesdeDetalleMptk_(detalleSnap);
        const max = q.max;

        if (!valEstadoMptk_(estado, 'responsable_tk')) {
            errores.push(msg('Cabecera', 'Completa Responsable.'));
        }
        if (!horaValida_(valEstadoMptk_(estado, 'hora_salida_frio_tk'))) {
            errores.push(msg('Cabecera', 'Completa Hora salida frío.'));
        }
        if (!valEstadoMptk_(estado, 'placa_thermoking_tk')) {
            errores.push(msg('Cabecera', 'Registra la placa del vehículo TK.'));
        }

        if (restantesDesdeEstadoMuestraMptk_(estado, detalleSnap) > 0) {
            errores.push(msg('Clamshells', 'Agrega todos los Thermo-King (' + max + ').'));
        }

        const cards = Array.isArray(estado?.mptkCards) ? estado.mptkCards : [];
        const horaSalida = valEstadoMptk_(estado, 'hora_salida_frio_tk');
        const cardTiemposRef = cards.slice().sort((a, b) => Number(a.clamshellNum) - Number(b.clamshellNum))[0];
        cards.forEach((c) => {
            const n = c.clamshellNum || '';
            const pesosSeq = window.MptkUi?.validarSecuenciaPesos
                ? window.MptkUi.validarSecuenciaPesos(c.pesos || {}, c.clamshellNum)
                : [];
            pesosSeq.forEach((txt) => errores.push(msg('Pesos #' + n, txt)));
        });
        if (cardTiemposRef) {
            const nT = cardTiemposRef.clamshellNum || '1';
            const tiemposSeq = window.MptkUi?.validarSecuenciaTiempos
                ? window.MptkUi.validarSecuenciaTiempos({
                    horaSalidaFrio: horaSalida,
                    ic: cardTiemposRef.tiempos?.ic || '',
                    st: cardTiemposRef.tiempos?.st || '',
                    it: cardTiemposRef.tiempos?.it || '',
                    dp: cardTiemposRef.tiempos?.dp || ''
                })
                : [];
            tiemposSeq.forEach((txt) => errores.push(msg('Tiempos #' + nT, txt)));
        }

        const campos = estado?.campos || {};
        const coherencia = window.MptkUi?.validarCoherenciaRutasEnvio
            ? window.MptkUi.validarCoherenciaRutasEnvio(estado, cards)
            : [];
        coherencia.forEach((txt) => errores.push(msg('Control', txt)));

        validarPresionesCalculadasMptk_(campos).forEach((txt) => errores.push(msg('Presión', txt)));

        return { ok: errores.length === 0, errores };
    }

    function muestraMptkEstadoCompleto_(estado, detalleSnap) {
        if (!estado || !hayDatosCapturaMptk_(estado)) return false;
        if (!muestraPackingCompletaParaTk_(detalleSnap)) return false;
        if (restantesDesdeEstadoMuestraMptk_(estado, detalleSnap) > 0) return false;
        return validarCompletitudTkParaEnvioDesdeEstado_(estado, detalleSnap).ok;
    }

    function muestraMptkPendienteDeEnvio_(estado, detalleSnap, rawMuestra) {
        if (muestraMptkYaCompletaEnServidor_(rawMuestra)) return false;
        return muestraMptkEstadoCompleto_(estado, detalleSnap);
    }

    function capturaEstadoMuestraParaValidacionMptk_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        const parts = raw.split('|');
        const borrador = leerBorradorMuestraMptk_(fecha, raw);
        if (raw === String(elMuestra?.value || '').trim()) {
            const estadoLive = leerEstadoFormularioTk_();
            const detalleLive = lastDetalleTk || borrador?.detalleSnap || null;
            return {
                raw,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || '',
                estado: estadoLive,
                detalleSnap: detalleLive
            };
        }
        if (!borrador?.estado) return null;
        return {
            raw,
            num_muestra: parts[0] || '',
            ensayo_numero: parts[1] || '',
            estado: borrador.estado,
            detalleSnap: borrador.detalleSnap || null
        };
    }

    function capturaEstadoMuestraParaEnvioMptk_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (muestraMptkYaCompletaEnServidor_(raw)) return null;
        const parts = raw.split('|');

        if (raw === String(elMuestra?.value || '').trim()) {
            const estado = leerEstadoFormularioTk_();
            if (hayDatosCapturaMptk_(estado)) {
                return {
                    raw,
                    num_muestra: parts[0] || '',
                    ensayo_numero: parts[1] || '',
                    estado,
                    detalleSnap: lastDetalleTk
                };
            }
        }

        const borrador = leerBorradorMuestraMptk_(fecha, raw);
        if (borrador?.estado && hayDatosCapturaMptk_(borrador.estado)) {
            return {
                raw,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || '',
                estado: borrador.estado,
                detalleSnap: borrador.detalleSnap || null
            };
        }

        return capturaEstadoMuestraParaValidacionMptk_(raw);
    }

    function detectarHuecosSecuenciaMptk_(completas) {
        const numeros = ordenarMuestrasMptkPorEnsayo_(completas)
            .map((c) => numeroEnsayoMptkDesdeRaw_(c.raw))
            .filter((n) => n > 0);
        const huecos = [];
        if (!numeros.length) return { numeros, huecos };
        const min = numeros[0];
        const max = numeros[numeros.length - 1];
        for (let n = min; n <= max; n++) {
            if (!numeros.includes(n)) huecos.push(n);
        }
        return { numeros, huecos };
    }

    function muestraMptkListaParaModal_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (muestraMptkYaCompletaEnServidor_(raw)) return null;
        const parts = raw.split('|');
        const numMuestra = parts[0] || '';
        const ensayoNumero = parts[1] || '';
        if (!ensayoNumero) return null;

        if (raw === String(elMuestra?.value || '').trim()) {
            if (!muestraPackingCompletaParaTk_(lastDetalleTk)) return null;
            const estado = leerEstadoFormularioTk_();
            if (!hayDatosCapturaMptk_(estado)) return null;
            if (restantesPorAgregarMptk_() !== 0) return null;
            if (!validarCompletitudTkParaEnvio().ok) return null;
            return itemMuestraMptkParaLista_(raw, numMuestra, ensayoNumero);
        }

        const borrador = leerBorradorMuestraMptk_(fecha, raw);
        if (!borrador?.estado || !hayDatosCapturaMptk_(borrador.estado)) return null;
        if (!muestraPackingCompletaParaTk_(borrador.detalleSnap)) return null;
        const rest = restantesDesdeEstadoMuestraMptk_(borrador.estado, borrador.detalleSnap);
        if (rest !== 0) return null;
        if (!validarCompletitudTkParaEnvioDesdeEstado_(borrador.estado, borrador.detalleSnap).ok) return null;
        return itemMuestraMptkParaLista_(raw, numMuestra, ensayoNumero);
    }

    function obtenerMuestrasListasModalEnvioMptk_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        const vistos = new Set();
        const out = [];
        recogerCandidatosMuestrasMptkDelDia_(fecha).forEach((raw) => {
            if (!raw || vistos.has(raw)) return;
            vistos.add(raw);
            const item = muestraMptkListaParaModal_(raw);
            if (item) out.push(item);
        });
        return ordenarMuestrasMptkPorEnsayo_(out);
    }

    function resumenMuestraMptkDelDia_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (!muestraMptkEnUso_(raw)) return null;
        const parts = raw.split('|');
        const numMuestra = parts[0] || '';
        const ensayoNumero = parts[1] || '';
        const etiqueta = textoSelectMuestra(numMuestra, ensayoNumero);
        const base = { raw, num_muestra: numMuestra, ensayo_numero: ensayoNumero, etiqueta };

        if (muestraMptkYaCompletaEnServidor_(raw)) {
            return Object.assign(base, { estado: 'enviada', restantes: 0 });
        }

        const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
        if (!cap || !hayDatosCapturaMptk_(cap.estado)) {
            return Object.assign(base, { estado: 'sin_datos', restantes: null });
        }

        const rest = restantesDesdeEstadoMuestraMptk_(cap.estado, cap.detalleSnap);
        const lista = muestraMptkPendienteDeEnvio_(cap.estado, cap.detalleSnap, raw);
        return Object.assign(base, {
            estado: lista ? 'lista' : 'incompleta',
            restantes: rest
        });
    }

    function analizarMuestrasMptkDelDia_() {
        const opciones = obtenerOpcionesMuestraMptkSelect_();
        const resumenes = opciones.map((raw) => resumenMuestraMptkDelDia_(raw)).filter(Boolean);
        const listas = resumenes
            .filter((r) => r.estado === 'lista')
            .map((r) => itemMuestraMptkParaLista_(r.raw, r.num_muestra, r.ensayo_numero));
        const incompletas = resumenes.filter((r) => r.estado === 'incompleta');
        const sinDatos = resumenes.filter((r) => r.estado === 'sin_datos');
        const pendientes = incompletas.concat(sinDatos);
        const enUso = resumenes.map((r) => r.raw);
        const numerosDia = enUso
            .map((raw) => numeroEnsayoMptkDesdeRaw_(raw))
            .filter((n) => n > 0)
            .sort((a, b) => a - b);
        const numerosListas = listas
            .map((item) => numeroEnsayoMptkDesdeRaw_(item.raw))
            .filter((n) => n > 0);
        const numerosEnviadas = resumenes
            .filter((r) => r.estado === 'enviada')
            .map((r) => numeroEnsayoMptkDesdeRaw_(r.raw))
            .filter((n) => n > 0);
        const huecosEntreListas = detectarHuecosSecuenciaMptk_(listas).huecos;
        const huecosEnDia = [];
        if (numerosDia.length) {
            const min = numerosDia[0];
            const max = numerosDia[numerosDia.length - 1];
            for (let n = min; n <= max; n++) {
                const enDia = numerosDia.includes(n);
                const satisfecha = numerosListas.includes(n) || numerosEnviadas.includes(n);
                if (enDia && !satisfecha) huecosEnDia.push(n);
            }
        }
        return {
            opciones,
            enUso,
            resumenes,
            listas: ordenarMuestrasMptkPorEnsayo_(listas),
            incompletas,
            sinDatos,
            pendientes,
            huecosEntreListas,
            huecosEnDia
        };
    }

    function textoPendienteMuestraMptk_(r) {
        const etiqueta = r.etiqueta || textoSelectMuestra(r.num_muestra, r.ensayo_numero);
        if (r.estado === 'sin_datos') {
            return '<li><b>' + etiqueta + '</b> — sin datos de MP-TK</li>';
        }
        const rest = Number(r.restantes);
        if (Number.isFinite(rest) && rest > 0) {
            return '<li><b>' + etiqueta + '</b> — faltan <b>' + rest + '</b> Thermo-King (contador del + debe estar en <b>0</b>)</li>';
        }
        const cap = capturaEstadoMuestraParaValidacionMptk_(r.raw);
        if (cap) {
            const val = validarCompletitudTkParaEnvioDesdeEstado_(cap.estado, cap.detalleSnap);
            if (!val.ok && val.errores[0]) {
                return '<li><b>' + etiqueta + '</b> — ' + String(val.errores[0]).replace(/</g, '&lt;') + '</li>';
            }
        }
        return '<li><b>' + etiqueta + '</b> — revisa pesos, tiempos, temperatura, humedad y presión</li>';
    }

    async function confirmarContinuarEnvioConPendientesMptk_(analisis) {
        const pendientes = analisis?.pendientes || [];
        if (!pendientes.length) return true;

        const listas = analisis.listas || [];
        const htmlPend = '<ul style="margin:8px 0 0;padding-left:18px;text-align:left;font-size:13px;color:#475569;">'
            + pendientes.map((r) => textoPendienteMuestraMptk_(r)).join('')
            + '</ul>';
        const htmlListas = listas.length
            ? '<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Listas para enviar (contador en 0): <b>'
                + listas.map((x) => x.etiqueta || x.ensayo_numero).join(', ')
                + '</b></p>'
            : '';
        const html = '<p style="margin:0;font-size:13px;color:#475569;">Hay muestras del día que <b>no están completas</b> '
            + '(el badge del + debe estar en <b>0 verde</b>):</p>'
            + htmlPend
            + htmlListas
            + '<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Completa esos datos o continúa solo con las muestras listas.</p>';

        if (window.Swal && typeof window.Swal.fire === 'function') {
            const r = await swalFireMptk_({
                icon: 'warning',
                title: 'Muestras incompletas',
                html: html,
                showCancelButton: true,
                cancelButtonText: 'Completar datos',
                confirmButtonText: listas.length ? 'Continuar a enviar' : 'Entendido',
                allowOutsideClick: false
            });
            if (!listas.length) return false;
            return !!(r && r.isConfirmed);
        }
        if (!listas.length) {
            mostrarToastTk('warning', 'Muestras incompletas', 'Completa todas las muestras (contador en 0) antes de enviar.');
            return false;
        }
        return true;
    }

    function unirMuestrasMptkParaEnvio_(listas) {
        const map = new Map();
        (listas || []).forEach((lista) => {
            (lista || []).forEach((item) => {
                if (item?.raw) map.set(item.raw, item);
            });
        });
        return ordenarMuestrasMptkPorEnsayo_(Array.from(map.values()));
    }

    function obtenerMuestrasCompletasMptkParaEnvio_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        const candidatos = recogerCandidatosMuestrasMptkDelDia_(fecha);
        const vistos = new Set();
        const out = [];
        candidatos.forEach((raw) => {
            if (!raw || vistos.has(raw)) return;
            vistos.add(raw);
            const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
            if (!cap || !muestraMptkPendienteDeEnvio_(cap.estado, cap.detalleSnap, raw)) return;
            out.push(itemMuestraMptkParaLista_(cap.raw, cap.num_muestra, cap.ensayo_numero));
        });
        return ordenarMuestrasMptkPorEnsayo_(out);
    }

    function resolverCandidatasModalEnvioMptk_(completas) {
        const analisis = analizarMuestrasMptkDelDia_();
        const listasModal = analisis.listas.length
            ? analisis.listas
            : obtenerMuestrasListasModalEnvioMptk_();
        return unirMuestrasMptkParaEnvio_([completas, listasModal]);
    }

    function persistirBorradoresContadorCeroMptk_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso || elFecha?.value);
        if (!fecha) return;
        const store = leerStoreBorradorTk();
        const rawActivo = String(elMuestra?.value || '').trim();

        if (rawActivo) {
            const estadoActivo = leerEstadoFormularioTk_();
            if (hayDatosTrabajoTk_(estadoActivo)) {
                const keyActiva = claveBorradorTk(fecha, rawActivo);
                if (keyActiva) {
                    const existing = store.porClave[keyActiva] || {};
                    store.porClave[keyActiva] = {
                        meta: existing.meta || {},
                        estado: estadoActivo,
                        detalleSnap: lastDetalleTk,
                        tkYaEnServidor: tkYaEnServidor,
                        guardado_en: Date.now()
                    };
                }
            }
        }

        recogerCandidatosMuestrasMptkDelDia_(fecha).forEach((raw) => {
            if (!raw || raw === rawActivo) return;
            const borrador = leerBorradorMuestraMptk_(fecha, raw);
            if (borrador?.estado && hayDatosTrabajoTk_(borrador.estado)) {
                const key = claveBorradorTk(fecha, raw);
                if (key) store.porClave[key] = borrador;
                return;
            }
            const cap = capturaEstadoMuestraParaEnvioMptk_(raw);
            if (!cap || !hayDatosTrabajoTk_(cap.estado)) return;
            const key = claveBorradorTk(fecha, raw);
            if (key) {
                store.porClave[key] = {
                    meta: {
                        fecha,
                        raw,
                        num_muestra: cap.num_muestra,
                        ensayo_numero: cap.ensayo_numero
                    },
                    estado: cap.estado,
                    detalleSnap: cap.detalleSnap,
                    tkYaEnServidor: false,
                    guardado_en: Date.now()
                };
            }
        });

        if (rawActivo) store.activo = claveBorradorTk(fecha, rawActivo);
        guardarStoreBorradorTk(store);
    }

    function persistirBorradoresCompletasMptk_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return;
        const store = leerStoreBorradorTk();
        const rawActivo = String(elMuestra?.value || '').trim();
        const candidatos = recogerCandidatosMuestrasMptkDelDia_(fecha);
        ordenarMuestrasMptkPorEnsayo_(candidatos.map((raw) => {
            const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
            if (!cap || !muestraMptkPendienteDeEnvio_(cap.estado, cap.detalleSnap, raw)) return null;
            return { raw };
        }).filter(Boolean)).reverse().forEach((item) => {
            const cap = capturaEstadoMuestraParaValidacionMptk_(item.raw);
            if (!cap || !hayDatosTrabajoTk_(cap.estado)) return;
            const key = claveBorradorTk(fecha, item.raw);
            if (key) {
                store.porClave[key] = {
                    meta: {
                        fecha,
                        raw: item.raw,
                        num_muestra: cap.num_muestra,
                        ensayo_numero: cap.ensayo_numero
                    },
                    estado: cap.estado,
                    detalleSnap: cap.detalleSnap,
                    tkYaEnServidor: false,
                    guardado_en: Date.now()
                };
            }
        });
        if (rawActivo) store.activo = claveBorradorTk(fecha, rawActivo);
        guardarStoreBorradorTk(store);
    }

    function prepararDeteccionEnvioMptkLocal_() {
        guardarBorradorMuestraActivaInmediatoMptk_();
        persistirBorradoresContadorCeroMptk_(elFecha?.value);
        persistirBorradoresCompletasMptk_(elFecha?.value);
        return obtenerMuestrasCompletasMptkParaEnvio_();
    }

    function asegurarBorradoresAntesEnvioMptk_(lista) {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return;
        guardarBorradorMuestraActivaInmediatoMptk_();
        const store = leerStoreBorradorTk();
        const raws = new Set((lista || []).map((item) => String(item?.raw || '').trim()).filter(Boolean));
        obtenerOpcionesMuestraMptkSelect_().forEach((raw) => raws.add(raw));
        raws.forEach((raw) => {
            const cap = capturaEstadoMuestraParaEnvioMptk_(raw);
            if (!cap || !hayDatosTrabajoTk_(cap.estado)) return;
            const key = claveBorradorTk(fecha, raw);
            if (key) {
                store.porClave[key] = {
                    meta: {
                        fecha,
                        raw,
                        num_muestra: cap.num_muestra,
                        ensayo_numero: cap.ensayo_numero
                    },
                    estado: cap.estado,
                    detalleSnap: cap.detalleSnap,
                    tkYaEnServidor: muestraMptkYaCompletaEnServidor_(raw),
                    guardado_en: Date.now()
                };
            }
        });
        const rawActivo = String(elMuestra?.value || '').trim();
        if (rawActivo) store.activo = claveBorradorTk(fecha, rawActivo);
        guardarStoreBorradorTk(store);
    }

    async function cargarMuestraMptkParaEnvio_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        const parts = raw.split('|');
        const ensayoNumero = parts[1] || '';
        if (!fecha || !raw || !ensayoNumero) return false;
        const prev = String(elMuestra?.value || '').trim();
        cancelarGuardadoBorradorProgramadoMptk_();
        if (prev && prev !== raw) {
            const estadoUi = leerEstadoFormularioTk_();
            const detalleUi = lastDetalleTk;
            snapshotMuestraMptkSiHayTrabajo_(fecha, prev, estadoUi, detalleUi);
        }
        mptkRestaurandoBorrador = true;
        if (elMuestra) elMuestra.value = raw;
        mptkMuestraAnterior = raw;
        mptkRestaurandoBorrador = false;
        const key = claveBorradorTk(fecha, raw);
        const store = leerStoreBorradorTk();
        store.activo = key;
        guardarStoreBorradorTk(store);
        const borrador = key ? store.porClave[key] : null;
        if (borrador?.estado && hayDatosCapturaMptk_(borrador.estado)) {
            if (borrador.detalleSnap) {
                lastDetalleTk = borrador.detalleSnap;
                tkYaEnServidor = !!borrador.tkYaEnServidor;
                aplicarCuotaDesdeDetalleTk_(lastDetalleTk);
            }
            aplicarEstadoFormularioTk_(borrador.estado);
            setFormularioHabilitado(!tkYaEnServidor && mptkCapturaPermitida_(lastDetalleTk));
            actualizarFabRestanteBadgeMptk();
            return true;
        }
        await cargarDetalle(fecha, ensayoNumero);
        return true;
    }

    async function asegurarCapturaEnvioMptk_(rawMuestra) {
        let cap = capturaEstadoMuestraParaEnvioMptk_(rawMuestra);
        if (cap && hayDatosTrabajoTk_(cap.estado)) return cap;
        const raw = String(rawMuestra || '').trim();
        if (!raw || raw === String(elMuestra?.value || '').trim()) return cap;
        await cargarMuestraMptkParaEnvio_(raw);
        cap = capturaEstadoMuestraParaEnvioMptk_(raw);
        if (cap && hayDatosTrabajoTk_(cap.estado)) return cap;
        return null;
    }

    async function seleccionarMuestraMptkParaEnviar_(preferida, completas, analisis) {
        const lista = ordenarMuestrasMptkPorEnsayo_(completas || []);
        if (!lista.length) return null;
        const info = analisis || analizarMuestrasMptkDelDia_();
        const satisfechos = ensayosSatisfechosSecuenciaMptk_(info);
        const huecosLista = huecosSinSatisfechosMptk_(detectarHuecosSecuenciaMptk_(lista).huecos, satisfechos);
        const huecosDia = huecosSinSatisfechosMptk_(info.huecosEnDia || [], satisfechos);
        const secuenciaContinua = huecosLista.length === 0 && huecosDia.length === 0;
        if (lista.length === 1) return { modo: 'una', raw: lista[0].raw };

        const opts = {};
        lista.forEach((item) => {
            opts[item.raw] = (item.etiqueta || textoSelectMuestra(item.num_muestra, item.ensayo_numero))
                + ' · contador 0';
        });
        const pref = lista.find((x) => x.raw === preferida)?.raw || lista[lista.length - 1].raw;

        let htmlSecuencia = '<p style="margin:0 0 10px;font-size:13px;color:#64748b;">'
            + 'Solo aparecen muestras con contador en <b>0</b> (badge verde en el botón +).</p>';
        if (secuenciaContinua) {
            htmlSecuencia += '<p style="margin:0 0 10px;font-size:13px;color:#64748b;">'
                + 'Puedes enviar una o todas juntas en orden.</p>';
        } else {
            const faltan = huecosDia.length ? huecosDia : huecosLista;
            htmlSecuencia += '<p style="margin:0 0 10px;font-size:13px;color:#b45309;">'
                + '<b>Hay hueco en la secuencia</b> (ensayo ' + faltan.join(', ')
                + ' sin datos listos). Completa esos datos o envía <b>una muestra</b> a la vez.</p>';
        }
        if (info.pendientes?.length) {
            htmlSecuencia += '<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">No listadas (incompletas): '
                + info.pendientes.map((r) => r.etiqueta || r.ensayo_numero).join(', ')
                + '</p>';
        }

        if (window.Swal && typeof window.Swal.fire === 'function') {
            const r = await swalFireMptk_({
                icon: 'question',
                title: 'MP-TK listo para enviar',
                html: htmlSecuencia,
                input: 'select',
                inputOptions: opts,
                inputValue: pref,
                confirmButtonText: 'Enviar muestra',
                showDenyButton: secuenciaContinua,
                denyButtonText: 'Enviar muestras juntas',
                showCancelButton: true,
                cancelButtonText: 'Cancelar',
                denyButtonColor: '#1f4f82',
                allowOutsideClick: false
            });
            if (r.isDenied && secuenciaContinua) return { modo: 'todas', lista };
            if (!r.isConfirmed) return null;
            return { modo: 'una', raw: String(r.value || '').trim() || pref };
        }
        return { modo: 'una', raw: pref };
    }

    function muestraMptkEnUso_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return false;
        if (muestraMptkYaCompletaEnServidor_(raw)) return true;
        const borrador = leerBorradorMuestraMptk_(fecha, raw);
        if (borrador?.estado && hayDatosCapturaMptk_(borrador.estado)) return true;
        if (raw === String(elMuestra?.value || '').trim()) {
            return hayDatosCapturaMptk_(leerEstadoFormularioTk_());
        }
        return false;
    }

    function persistirBorradoresConTrabajoMptk_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso || elFecha?.value);
        if (!fecha) return;
        const store = leerStoreBorradorTk();
        const rawActivo = String(elMuestra?.value || '').trim();
        const prefix = fecha + '::';

        if (rawActivo && !tkYaEnServidor) {
            guardarBorradorMuestraActivaInmediatoMptk_();
        }

        Object.keys(store.porClave || {}).forEach((key) => {
            if (!key.startsWith(prefix)) return;
            const entry = store.porClave[key];
            if (entry?.estado && hayDatosTrabajoTk_(entry.estado)) {
                store.porClave[key] = Object.assign({}, entry, { guardado_en: Date.now() });
            }
        });

        recogerCandidatosMuestrasMptkDelDia_(fecha).forEach((raw) => {
            if (!raw || raw === rawActivo) return;
            const borrador = leerBorradorMuestraMptk_(fecha, raw);
            if (!borrador?.estado || !hayDatosTrabajoTk_(borrador.estado)) return;
            const key = claveBorradorTk(fecha, raw);
            if (key) store.porClave[key] = borrador;
        });

        if (rawActivo) store.activo = claveBorradorTk(fecha, rawActivo);
        guardarStoreBorradorTk(store);
    }

    function prepararCapturasPdfMptkDelDia_() {
        persistirBorradoresConTrabajoMptk_(elFecha?.value);
        persistirBorradoresContadorCeroMptk_(elFecha?.value);
        persistirBorradoresCompletasMptk_(elFecha?.value);
    }

    /** PDF manual: hay captura local, aunque falte clamshell o contador > 0. */
    function muestraMptkTieneDatosPdfManualMptk_(raw) {
        if (muestraMptkYaCompletaEnServidor_(raw)) return false;
        const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
        return !!(cap && hayDatosCapturaMptk_(cap.estado));
    }

    /** PDF manual: datos + al menos un peso bruto en alguna fila. */
    function muestraMptkElegiblePdfManualMptk_(raw) {
        if (!muestraMptkTieneDatosPdfManualMptk_(raw)) return false;
        const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
        return !!(cap && hayPesoBrutoMuestraMptk_(cap.estado));
    }

    function puedeGenerarPdfMptk_() {
        prepararCapturasPdfMptkDelDia_();
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return false;
        return recogerCandidatosMuestrasMptkDelDia_(fecha).some((raw) => (
            muestraMptkElegiblePdfManualMptk_(raw) || muestraMptkTieneDatosPdfManualMptk_(raw)
        ));
    }

    /** Historial al enviar: solo muestras que llegaron a contador 0 con peso. */
    function capturaMptkElegibleHistorialPdf_(c) {
        if (!c?.estado) return false;
        const detalle = c.detalle || c.detalleSnap || null;
        if (!muestraMptkEstadoCompleto_(c.estado, detalle)) return false;
        return hayPesoBrutoMuestraMptk_(c.estado);
    }

    function muestrasPendientesPdfMptkDelDia_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        return recogerCandidatosMuestrasMptkDelDia_(fecha).filter(muestraMptkElegiblePdfManualMptk_);
    }

    function muestrasConDatosPdfManualMptkDelDia_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        return recogerCandidatosMuestrasMptkDelDia_(fecha).filter(muestraMptkTieneDatosPdfManualMptk_);
    }

    function deduplicarItemsMuestraMptk_(lista) {
        const seen = new Set();
        const out = [];
        (lista || []).forEach((item) => {
            const raw = String(item?.raw || '').trim();
            if (!raw || seen.has(raw)) return;
            seen.add(raw);
            out.push(item);
        });
        return out.sort((a, b) => numeroEnsayoPdfMptkDesdeRaw_(a.raw) - numeroEnsayoPdfMptkDesdeRaw_(b.raw));
    }

    function capturaEstadoMuestraParaPdfMptk_(rawMuestra) {
        const cap = capturaEstadoMuestraParaValidacionMptk_(rawMuestra);
        if (!cap || muestraMptkYaCompletaEnServidor_(rawMuestra)) return null;
        return {
            raw: cap.raw,
            num_muestra: cap.num_muestra,
            ensayo_numero: cap.ensayo_numero,
            estado: cap.estado,
            detalle: cap.detalleSnap || null
        };
    }

    function asegurarBorradorActivoParaPdfMptk_() {
        prepararCapturasPdfMptkDelDia_();
    }

    function construirDatosPdfMptkDesdeEstado_(numMuestra, ensayoNumero, estado, detalle, fechaIso) {
        const campos = estado?.campos || {};
        const cards = (Array.isArray(estado?.mptkCards) ? estado.mptkCards : [])
            .slice()
            .sort((a, b) => Number(a.clamshellNum) - Number(b.clamshellNum))
            .slice(0, MPTK_PDF_FILAS_TK);
        const control = controlGlobalPdfMptk_(campos);
        const etapa = String(campos.etapa_info_tk || detalle?.TRAZ_ETAPA || '').trim();
        const campo = String(campos.campo_info_tk || detalle?.TRAZ_CAMPO || '').trim();
        const turno = String(campos.turno_info_tk || detalle?.TRAZ_TURNO || detalle?.TRAZ_LIBRE || '').trim();
        const metaBase = {
            horaSalidaFrio: formatoHoraPdfMptk_(campos.hora_salida_frio_tk || ''),
            rotulo: rotuloMuestraPdfMptk_(ensayoNumero),
            variedad: String(campos.variedad_info_tk || detalle?.VARIEDAD || '').trim(),
            etapa,
            campo,
            turno,
            placa: String(campos.placa_thermoking_tk || '').trim().toUpperCase()
        };
        const filas = filasMuestraPdfMptk_(cards, metaBase, control);
        const observacionesLista = Array.from({ length: MPTK_PDF_FILAS_POR_MUESTRA }, (_, i) => (
            String(cards[i]?.observacion || '').trim()
        ));
        const obsTexto = observacionesLista.filter(Boolean).join(' · ');
        const fechaPdf = fechaDisplayDdMmYyyyMptk_(
            campos.fecha_inspeccion_tk || normalizarFechaIso(fechaIso) || hoyIsoLocal()
        );
        return {
            ensayo: ensayoNumero,
            fecha: fechaPdf,
            empresa: 'AGROVISION',
            codigo: 'PE-F-QPH-371',
            version: '1',
            tituloHoja1: 'FORMATO ' + MPTK_TITULO_PDF,
            tituloHoja2: 'FORMATO ' + MPTK_TITULO_PDF,
            meta: {
                fecha: fechaPdf,
                variedad: metaBase.variedad,
                etapa,
                campo,
                turno,
                rotulo: metaBase.rotulo,
                responsable: String(campos.responsable_tk || '').trim(),
                numMuestra: String(numMuestra || '').trim(),
                trazabilidad: [etapa, campo, turno].filter(Boolean).join('-')
            },
            filas: filas.slice(0, MPTK_PDF_FILAS_POR_MUESTRA),
            pagina2: {
                observacionesLista,
                observaciones: obsTexto
            }
        };
    }

    window.obtenerDatosPdfMptk = function obtenerDatosPdfMptk() {
        prepararCapturasPdfMptkDelDia_();
        const rawActivo = String(elMuestra?.value || '').trim();
        const activoYaEnPlanilla = rawActivo && muestraMptkYaCompletaEnServidor_(rawActivo);
        let items = deduplicarItemsMuestraMptk_(
            muestrasPendientesPdfMptkDelDia_().map((raw) => {
                const parts = String(raw || '').split('|');
                return {
                    raw,
                    num_muestra: parts[0] || '',
                    ensayo_numero: parts[1] || ''
                };
            }).filter((item) => item.num_muestra && item.ensayo_numero)
        );
        if (!items.length) {
            items = deduplicarItemsMuestraMptk_(
                muestrasConDatosPdfManualMptkDelDia_().map((raw) => {
                    const parts = String(raw || '').split('|');
                    return {
                        raw,
                        num_muestra: parts[0] || '',
                        ensayo_numero: parts[1] || ''
                    };
                }).filter((item) => item.num_muestra && item.ensayo_numero)
            );
        }
        if (rawActivo && !activoYaEnPlanilla && !items.some((item) => item.raw === rawActivo)) {
            if (muestraMptkElegiblePdfManualMptk_(rawActivo) || muestraMptkTieneDatosPdfManualMptk_(rawActivo)) {
                const parts = rawActivo.split('|');
                items.push({
                    raw: rawActivo,
                    num_muestra: parts[0] || '',
                    ensayo_numero: parts[1] || ''
                });
            }
        }
        if (!items.length) {
            if (activoYaEnPlanilla) {
                throw new Error(
                    'La muestra seleccionada ya está en la planilla. '
                    + 'Su PDF se guardará al enviar. '
                    + 'Selecciona la siguiente muestra y captura datos para un PDF nuevo.'
                );
            }
            throw new Error('Selecciona una muestra y captura datos antes de generar el PDF.');
        }
        const muestras = [];
        items.forEach((item) => {
            const cap = capturaEstadoMuestraParaValidacionMptk_(item.raw);
            if (!cap || !muestraMptkElegiblePdfManualMptk_(item.raw)) return;
            muestras.push(construirDatosPdfMptkDesdeEstado_(
                item.num_muestra,
                item.ensayo_numero,
                cap.estado,
                cap.detalleSnap,
                normalizarFechaIso(elFecha?.value)
            ));
        });
        if (!muestras.length) {
            const conDatos = muestrasConDatosPdfManualMptkDelDia_();
            if (conDatos.length) {
                const rawSinPeso = conDatos.find((raw) => {
                    const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
                    return cap && !hayPesoBrutoMuestraMptk_(cap.estado);
                }) || (rawActivo && muestraMptkTieneDatosPdfManualMptk_(rawActivo) ? rawActivo : '');
                if (rawSinPeso) {
                    const parts = String(rawSinPeso).split('|');
                    throw new Error(mensajeSinPesoBrutoPdfMptk_(
                        textoSelectMuestra(parts[0] || '', parts[1] || '')
                    ));
                }
            }
            if (rawActivo && !activoYaEnPlanilla) {
                const parts = rawActivo.split('|');
                throw new Error(mensajeSinPesoBrutoPdfMptk_(
                    textoSelectMuestra(parts[0] || '', parts[1] || '')
                ));
            }
            throw new Error(mensajeSinPesoBrutoPdfMptk_());
        }
        const muestrasUnicas = deduplicarMuestrasPdfMptkPorEnsayo_(muestras);
        return {
            muestras: agruparMuestrasEnHojasPdfMptk_(muestrasUnicas),
            muestrasTitulo: muestrasUnicas.slice()
        };
    };

    function armarCapturaPdfMptk_(fecha, rawMuestra, sel, estadoUi) {
        const raw = String(rawMuestra || '').trim();
        const parts = raw.split('|');
        const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
        const estado = estadoUi || cap?.estado || leerEstadoFormularioTk_();
        return {
            fecha: normalizarFechaIso(fecha),
            num_muestra: String(sel?.num_muestra || cap?.num_muestra || parts[0] || '').trim(),
            ensayo_numero: String(sel?.ensayo_numero || cap?.ensayo_numero || parts[1] || '').trim(),
            raw,
            estado,
            detalle: cap?.detalleSnap || null
        };
    }

    async function guardarPdfMptkHistorialTrasEnvio_(capturas, fechaIso) {
        if (!window.HistPdfEnvio || typeof window.HistPdfEnvio.guardarMptk !== 'function') return;
        const lista = (Array.isArray(capturas) ? capturas : []).filter(capturaMptkElegibleHistorialPdf_);
        if (!lista.length) return;
        try {
            await window.HistPdfEnvio.guardarMptk(lista, fechaIso);
        } catch (err) {
            console.warn('[HistPDF] No se pudo guardar PDF MP-TK:', err);
        }
    }

    window.obtenerDatosPdfMptkParaCapturas = function obtenerDatosPdfMptkParaCapturas(capturas) {
        const lista = (Array.isArray(capturas) ? capturas : []).filter(capturaMptkElegibleHistorialPdf_);
        const muestras = [];
        lista.forEach((c) => {
            if (!hayPesoBrutoMuestraMptk_(c.estado)) {
                throw new Error(mensajeSinPesoBrutoPdfMptk_(
                    textoSelectMuestra(c.num_muestra, c.ensayo_numero)
                ));
            }
            muestras.push(construirDatosPdfMptkDesdeEstado_(
                c.num_muestra,
                c.ensayo_numero,
                c.estado,
                c.detalle || c.detalleSnap,
                c.fecha
            ));
        });
        if (!muestras.length) {
            throw new Error(mensajeSinPesoBrutoPdfMptk_());
        }
        const muestrasUnicas = deduplicarMuestrasPdfMptkPorEnsayo_(muestras);
        return {
            muestras: agruparMuestrasEnHojasPdfMptk_(muestrasUnicas),
            muestrasTitulo: muestrasUnicas.slice()
        };
    };

    function avanzarSiguienteMuestraMptk_() {
        if (!elMuestra || elMuestra.disabled) {
            mostrarToastTk('info', 'Muestras', 'Selecciona fecha y muestra primero.');
            return;
        }
        const opts = Array.from(elMuestra.options).filter((o) => o.value);
        const idx = opts.findIndex((o) => o.value === elMuestra.value);
        if (idx < 0 || idx >= opts.length - 1) {
            mostrarToastTk('info', 'Muestras', 'No hay otra muestra pendiente en la lista.');
            return;
        }
        elMuestra.value = opts[idx + 1].value;
        elMuestra.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function buildPayloadEnvioTk_() {
        const sel = ensayoSeleccionado();
        const fechaReg = normalizarFechaIso(elFecha?.value);
        const modo = modoRegistroSeleccionado();
        const cardArrays = window.MptkUi?.buildThermokingArrays
            ? window.MptkUi.buildThermokingArrays()
            : { thermoking_tiempos: [], thermoking_peso: [], thermoking_obs: [] };
        const n = Math.max(
            cardArrays.thermoking_peso?.length || 0,
            cardArrays.thermoking_tiempos?.length || 0,
            1
        );
        const tempRow = {
            ic_cm: valInput('temp_ic_cm_tk'),
            ic_pu: valInput('temp_ic_pu_tk'),
            st_cm: valInput('temp_st_cm_tk'),
            st_pu: valInput('temp_st_pu_tk'),
            it_amb: valInput('temp_it_amb_tk'),
            it_veh: valInput('temp_it_veh_tk'),
            it_pu: valInput('temp_it_pu_tk'),
            d_amb: valInput('temp_dp_amb_tk'),
            d_veh: valInput('temp_dp_veh_tk'),
            d_pu: valInput('temp_dp_pu_tk')
        };
        const humRow = {
            ic: valInput('hum_ic_tk'),
            st: valInput('hum_st_tk'),
            aei: valInput('hum_aei_tk'),
            ivi: valInput('hum_ivi_tk'),
            aed: valInput('hum_aed_tk'),
            ivd: valInput('hum_ivd_tk')
        };
        const presRow = {
            ic: valInput('pres_ic_tk'),
            st: valInput('pres_st_tk'),
            aei: valInput('pres_aei_tk'),
            ivi: valInput('pres_ivi_tk'),
            aed: valInput('pres_aed_tk'),
            ivd: valInput('pres_ivd_tk')
        };
        const vaporRow = {
            ic: valInput('vapor_ic_tk'),
            scm: valInput('vapor_scm_tk'),
            it: valInput('vapor_it_tk'),
            st: valInput('vapor_st_tk')
        };
        const payload = {
            mode: 'packing',
            guardar_packing: false,
            guardar_thermoking: true,
            actualizar_c5: false,
            fecha: fechaReg,
            ensayo_numero: sel.ensayo_numero,
            num_muestra: sel.num_muestra,
            fecha_inspeccion_thermoking: valInput('fecha_inspeccion_tk') || normalizarFechaIso(elFecha?.value) || hoyIsoLocal(),
            responsable_thermoking: valInput('responsable_tk'),
            hora_salida_thermoking: valInput('hora_salida_frio_tk'),
            placa_thermoking: valInput('placa_thermoking_tk'),
            thermoking_tiempos: cardArrays.thermoking_tiempos || [],
            thermoking_peso: cardArrays.thermoking_peso || [],
            thermoking_temp: Array.from({ length: n }, () => ({ ...tempRow })),
            thermoking_humedad: Array.from({ length: n }, () => ({ ...humRow })),
            thermoking_presion_tk: Array.from({ length: n }, () => ({ ...presRow })),
            thermoking_vapor: Array.from({ length: n }, () => ({ ...vaporRow })),
            thermoking_obs: cardArrays.thermoking_obs || []
        };
        if (modo === 'acopio' || modo === 'visual') payload.modo_registro = modo;
        return payload;
    }

    function buildThermokingArraysFromEstadoMptk_(estado) {
        const cards = (Array.isArray(estado?.mptkCards) ? estado.mptkCards : [])
            .slice()
            .sort((a, b) => Number(a.clamshellNum) - Number(b.clamshellNum));
        return {
            thermoking_tiempos: cards.map((c) => ({
                ic: c.tiempos?.ic || '',
                st: c.tiempos?.st || '',
                it: c.tiempos?.it || '',
                dp: c.tiempos?.dp || ''
            })),
            thermoking_peso: cards.map((c) => ({
                ic: c.pesos?.ic || '',
                st: c.pesos?.st || '',
                it: c.pesos?.it || '',
                dp: c.pesos?.dp || ''
            })),
            thermoking_obs: cards.map((c) => ({
                observacion: c.observacion || ''
            }))
        };
    }

    function buildPayloadEnvioTkDesdeEstado_(estado, sel, fechaReg, detalleSnap) {
        const campos = estado?.campos || {};
        const val = (id) => String(campos[id] ?? '').trim();
        const cardArrays = buildThermokingArraysFromEstadoMptk_(estado);
        const n = Math.max(
            cardArrays.thermoking_peso?.length || 0,
            cardArrays.thermoking_tiempos?.length || 0,
            1
        );
        const tempRow = {
            ic_cm: val('temp_ic_cm_tk'),
            ic_pu: val('temp_ic_pu_tk'),
            st_cm: val('temp_st_cm_tk'),
            st_pu: val('temp_st_pu_tk'),
            it_amb: val('temp_it_amb_tk'),
            it_veh: val('temp_it_veh_tk'),
            it_pu: val('temp_it_pu_tk'),
            d_amb: val('temp_dp_amb_tk'),
            d_veh: val('temp_dp_veh_tk'),
            d_pu: val('temp_dp_pu_tk')
        };
        const humRow = {
            ic: val('hum_ic_tk'),
            st: val('hum_st_tk'),
            aei: val('hum_aei_tk'),
            ivi: val('hum_ivi_tk'),
            aed: val('hum_aed_tk'),
            ivd: val('hum_ivd_tk')
        };
        const presRow = {
            ic: val('pres_ic_tk'),
            st: val('pres_st_tk'),
            aei: val('pres_aei_tk'),
            ivi: val('pres_ivi_tk'),
            aed: val('pres_aed_tk'),
            ivd: val('pres_ivd_tk')
        };
        const vaporRow = {
            ic: val('vapor_ic_tk'),
            scm: val('vapor_scm_tk'),
            it: val('vapor_it_tk'),
            st: val('vapor_st_tk')
        };
        const modoRaw = String(
            sel?.modo_registro
            || detalleSnap?.modo_registro
            || ''
        ).trim().toLowerCase();
        const modo = modoRaw === 'acopio' ? 'acopio' : (modoRaw === 'visual' ? 'visual' : '');
        const payload = {
            mode: 'packing',
            guardar_packing: false,
            guardar_thermoking: true,
            actualizar_c5: false,
            fecha: fechaReg,
            ensayo_numero: sel.ensayo_numero,
            num_muestra: sel.num_muestra,
            fecha_inspeccion_thermoking: val('fecha_inspeccion_tk') || fechaReg || hoyIsoLocal(),
            responsable_thermoking: val('responsable_tk'),
            hora_salida_thermoking: val('hora_salida_frio_tk'),
            placa_thermoking: val('placa_thermoking_tk'),
            thermoking_tiempos: cardArrays.thermoking_tiempos || [],
            thermoking_peso: cardArrays.thermoking_peso || [],
            thermoking_temp: Array.from({ length: n }, () => ({ ...tempRow })),
            thermoking_humedad: Array.from({ length: n }, () => ({ ...humRow })),
            thermoking_presion_tk: Array.from({ length: n }, () => ({ ...presRow })),
            thermoking_vapor: Array.from({ length: n }, () => ({ ...vaporRow })),
            thermoking_obs: cardArrays.thermoking_obs || []
        };
        if (modo === 'acopio' || modo === 'visual') payload.modo_registro = modo;
        return payload;
    }

    function campoVacio_(v) {
        return v == null || String(v).trim() === '';
    }

    function horaValida_(v) {
        return /^\d{1,2}:\d{2}$/.test(String(v || '').trim());
    }

    function numeroValido_(v) {
        const n = Number(String(v || '').replace(',', '.'));
        return Number.isFinite(n);
    }

    function campoNumericoLleno_(v) {
        return String(v ?? '').trim() !== '' && numeroValido_(v);
    }

    function validarPresionesCalculadasMptk_(campos) {
        const errores = [];
        const ambPairs = [
            ['pres_ic_tk', 'temp_ic_cm_tk', 'hum_ic_tk', 'Ing. cám. MP'],
            ['pres_st_tk', 'temp_st_cm_tk', 'hum_st_tk', 'Sal. cám. MP'],
            ['pres_aei_tk', 'temp_it_amb_tk', 'hum_aei_tk', 'Amb. inicio traslado'],
            ['pres_ivi_tk', 'temp_it_veh_tk', 'hum_ivi_tk', 'Int. veh. inicio traslado'],
            ['pres_aed_tk', 'temp_dp_amb_tk', 'hum_aed_tk', 'Amb. despacho'],
            ['pres_ivd_tk', 'temp_dp_veh_tk', 'hum_ivd_tk', 'Int. veh. despacho']
        ];
        ambPairs.forEach(([pres, temp, hum, lbl]) => {
            if (campoNumericoLleno_(campos[temp]) && campoNumericoLleno_(campos[hum])
                && !campoNumericoLleno_(campos[pres])) {
                errores.push('Presión ambiente · ' + lbl + ': falta calcular (revisa T° y HR).');
            }
        });
        const frutaPairs = [
            ['vapor_ic_tk', 'temp_ic_pu_tk', 'Pulpa ing. cám. MP'],
            ['vapor_scm_tk', 'temp_st_pu_tk', 'Pulpa sal. cám. MP'],
            ['vapor_it_tk', 'temp_it_pu_tk', 'Pulpa inicio traslado'],
            ['vapor_st_tk', 'temp_dp_pu_tk', 'Pulpa despacho']
        ];
        frutaPairs.forEach(([vapor, temp, lbl]) => {
            if (campoNumericoLleno_(campos[temp]) && !campoNumericoLleno_(campos[vapor])) {
                errores.push('Presión fruta · ' + lbl + ': falta calcular (revisa T° pulpa).');
            }
        });
        return errores;
    }

    function validarCompletitudTkParaEnvio() {
        recalcularPresionesMptk_({ render: false });
        return validarCompletitudTkParaEnvioDesdeEstado_(leerEstadoFormularioTk_(), lastDetalleTk);
    }

    function validarAntesEnvioTk_() {
        if (!elMuestra?.value) return 'Selecciona una muestra.';
        if (tkYaEnServidor) return 'Thermo-King ya fue registrado en la planilla para esta muestra.';
        if (!muestraPackingCompletaParaTk_(lastDetalleTk)) {
            return 'Packing aún no está completo en servidor. Termina packing antes de continuar.';
        }
        const val = validarCompletitudTkParaEnvio();
        if (!val.ok) return val.errores[0] || 'Completa todos los datos antes de enviar.';
        return '';
    }

    function mostrarToastTk(icon, title, text) {
        if (window.Swal && typeof window.Swal.fire === 'function') {
            void swalFireMptk_({
                toast: true,
                position: 'top-end',
                icon: icon || 'info',
                title: title || '',
                text: text || '',
                showConfirmButton: false,
                timer: icon === 'success' ? 2200 : 3200,
                timerProgressBar: true
            });
            return;
        }
        setStatus((title ? title + ': ' : '') + (text || ''), icon === 'error' ? 'error' : 'warn');
    }

    function uidLocalTk() {
        return 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
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

    function esRegistroColaTk(reg) {
        const modo = String(reg?.modo || '');
        if (modo === 'thermoking') return true;
        const p = reg?.payload || {};
        return p.guardar_thermoking === true && p.guardar_packing === false;
    }

    function compactarColaSyncMptk_(queue) {
        return (Array.isArray(queue) ? queue : []).filter(
            (r) => String(r?.estado || '') === 'pendiente'
        );
    }

    function colaTkPendienteCount_() {
        return cargarColaSync().filter((r) => (
            String(r?.estado || '') === 'pendiente' && esRegistroColaTk(r)
        )).length;
    }

    function marcarColaTkEnviada_(fecha, ensayoNumero, numMuestra) {
        const f = normalizarFechaIso(fecha) || String(fecha || '').trim();
        const en = String(ensayoNumero || '').trim();
        const nm = String(numMuestra || '').trim();
        if (!f || !en) return false;
        const queue = cargarColaSync();
        let hubo = false;
        queue.forEach((reg) => {
            if (String(reg?.estado || '') !== 'pendiente' || !esRegistroColaTk(reg)) return;
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
        if (hubo) guardarColaSync(compactarColaSyncMptk_(queue));
        return hubo;
    }

    async function reconciliarColaTkPendientes_() {
        if (!navigator.onLine || !API_URL) return;
        const queue = cargarColaSync();
        let huboCambios = false;
        for (let i = 0; i < queue.length; i++) {
            const reg = queue[i];
            if (!reg || String(reg.estado || '') !== 'pendiente' || !esRegistroColaTk(reg)) continue;
            const body = reg.payload || reg;
            try {
                const ok = await confirmarTkEnServidorTrasPost_(body);
                if (ok) {
                    reg.estado = 'enviado';
                    reg.actualizado_en = Date.now();
                    huboCambios = true;
                }
            } catch (_) { /* ignore */ }
        }
        if (huboCambios) guardarColaSync(compactarColaSyncMptk_(queue));
    }

    function encolarTkPendiente(payload) {
        const body = payload || buildPayloadEnvioTk_();
        const f = String(body.fecha || '').trim();
        const en = String(body.ensayo_numero || '').trim();
        const nm = String(body.num_muestra || '').trim();
        const dup = cargarColaSync().some((r) => {
            if (String(r?.estado || '') !== 'pendiente' || !esRegistroColaTk(r)) return false;
            return String(r.fecha || '') === f
                && String(r.ensayo_numero || '') === en
                && String(r.num_muestra || '') === nm;
        });
        if (dup) return { duplicado: true };
        const reg = {
            uid: uidLocalTk(),
            modo: 'thermoking',
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
        actualizarHeaderPendientes();
        return reg;
    }

    async function confirmarTkEnServidorTrasPost_(payload) {
        const fecha = String(payload?.fecha || '').trim();
        const ensayo = String(payload?.ensayo_numero || '').trim();
        if (!fecha || !ensayo || !API_URL) return false;
        try {
            const r = await callbackJsonp({ fecha, ensayo_numero: ensayo }, 12000);
            return !!(r?.ok && r.data?.tieneThermoKing === true);
        } catch (_) {
            return false;
        }
    }

    async function sincronizarPendientesTk() {
        if (syncTkEnCurso) return;
        if (!navigator.onLine || !API_URL) {
            actualizarHeaderPendientes();
            return;
        }
        await reconciliarColaTkPendientes_();
        const queue = cargarColaSync();
        if (!queue.some((r) => String(r?.estado || '') === 'pendiente' && esRegistroColaTk(r))) {
            actualizarHeaderPendientes();
            return;
        }
        syncTkEnCurso = true;
        let huboCambios = false;
        try {
            for (let i = 0; i < queue.length; i++) {
                const reg = queue[i];
                if (!reg || String(reg.estado || '') !== 'pendiente' || !esRegistroColaTk(reg)) continue;
                const body = reg.payload;
                try {
                    await fetch(API_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const ok = await confirmarTkEnServidorTrasPost_(body);
                    if (ok) {
                        reg.estado = 'enviado';
                        reg.actualizado_en = Date.now();
                        huboCambios = true;
                        const fechaSync = String(body.fecha || '').trim();
                        const numSync = String(body.num_muestra || '').trim();
                        const ensSync = String(body.ensayo_numero || '').trim();
                        const rawSync = numSync && ensSync ? (numSync + '|' + ensSync) : '';
                        if (fechaSync && rawSync) {
                            const borradorSync = leerBorradorMuestraMptk_(fechaSync, rawSync);
                            const capSync = borradorSync?.estado ? {
                                fecha: fechaSync,
                                num_muestra: numSync,
                                ensayo_numero: ensSync,
                                raw: rawSync,
                                estado: borradorSync.estado,
                                detalle: borradorSync.detalleSnap || null
                            } : null;
                            if (capSync && capturaMptkElegibleHistorialPdf_(capSync)) {
                                void guardarPdfMptkHistorialTrasEnvio_([capSync], fechaSync);
                            }
                            limpiarBorradorMuestraPorClaveMptk_(fechaSync, rawSync);
                        }
                    } else {
                        reg.intentos = (Number(reg.intentos) || 0) + 1;
                        reg.actualizado_en = Date.now();
                    }
                } catch (err) {
                    reg.intentos = (Number(reg.intentos) || 0) + 1;
                    reg.error = String(err.message || err);
                    reg.actualizado_en = Date.now();
                }
            }
            if (huboCambios) guardarColaSync(compactarColaSyncMptk_(queue));
        } finally {
            syncTkEnCurso = false;
            actualizarHeaderPendientes();
        }
    }

    function limpiarBorradorMuestraPorClaveMptk_(fecha, rawMuestra) {
        const key = claveBorradorTk(fecha, rawMuestra);
        if (!key) return;
        const store = leerStoreBorradorTk();
        if (store.porClave[key]) {
            delete store.porClave[key];
            if (store.activo === key) store.activo = '';
            guardarStoreBorradorTk(store);
        }
    }

    function limpiarBorradorMuestraActiva_() {
        limpiarBorradorMuestraPorClaveMptk_(elFecha?.value || '', elMuestra?.value || '');
    }

    function limpiarTrasEnvioLocalMptk_(fecha, rawMuestra) {
        limpiarBorradorMuestraPorClaveMptk_(fecha, rawMuestra);
        if (String(elMuestra?.value || '').trim() === String(rawMuestra || '').trim()) {
            tkYaEnServidor = true;
            setFormularioHabilitado(false);
            limpiarUiCapturaMuestraMptk_();
            actualizarFabRestanteBadgeMptk();
        }
    }

    async function aplicarExitoEnvioTk_(sel, opts) {
        opts = opts || {};
        const fecha = elFecha?.value || '';
        const rawMuestra = (sel?.num_muestra && sel?.ensayo_numero)
            ? (sel.num_muestra + '|' + sel.ensayo_numero)
            : (elMuestra?.value || '');
        const estadoEnvio = opts.estado || leerEstadoFormularioTk_();
        const selEnvio = sel || ensayoSeleccionado();
        marcarColaTkEnviada_(fecha, selEnvio?.ensayo_numero, selEnvio?.num_muestra);
        if (typeof window.archivarEnvioLocalExitoso_ === 'function') {
            window.archivarEnvioLocalExitoso_({
                uid: uidLocalTk(),
                fecha: fecha,
                ensayo_numero: String(selEnvio?.ensayo_numero || '').trim(),
                num_muestra: String(selEnvio?.num_muestra || '').trim(),
                ensayo: String(selEnvio?.ensayo_numero || '').trim(),
                modo: 'thermoking',
                creado_en: Date.now(),
                intentos: 0
            });
        }
        if (!opts.sinPdf) {
            await guardarPdfMptkHistorialTrasEnvio_(
                [armarCapturaPdfMptk_(fecha, rawMuestra, sel, estadoEnvio)],
                normalizarFechaIso(fecha)
            );
        }
        persistirBorradoresConTrabajoMptk_(fecha);
        limpiarTrasEnvioLocalMptk_(fecha, rawMuestra);
        actualizarHeaderPendientes();
        if (!opts.sinUi) {
            mostrarToastTk('success', 'Enviado', 'Thermo-King guardado en la planilla.');
            if (fecha) {
                await cargarMuestrasPorFecha(fecha);
                if (rawMuestra) {
                    const parts = rawMuestra.split('|');
                    if (elMuestra) {
                        mptkRestaurandoBorrador = true;
                        elMuestra.value = rawMuestra;
                        mptkMuestraAnterior = rawMuestra;
                        mptkRestaurandoBorrador = false;
                    }
                    if (parts[1]) await cargarDetalle(fecha, parts[1]);
                }
            }
        }
    }

    async function ejecutarEnvioTkBody_(body, sel, estado, opts) {
        opts = opts || {};
        const fecha = normalizarFechaIso(body?.fecha || elFecha?.value);
        const rawMuestra = (sel?.num_muestra && sel?.ensayo_numero)
            ? (sel.num_muestra + '|' + sel.ensayo_numero)
            : (elMuestra?.value || '');

        function limpiarTrasEnvioLocal_() {
            limpiarTrasEnvioLocalMptk_(fecha, rawMuestra);
        }

        async function guardarPdfTrasEnvio_() {
            await guardarPdfMptkHistorialTrasEnvio_(
                [armarCapturaPdfMptk_(fecha, rawMuestra, sel, estado)],
                fecha
            );
        }

        persistirBorradoresConTrabajoMptk_(fecha);

        if (!navigator.onLine || !API_URL) {
            const encolado = encolarTkPendiente(body);
            if (encolado?.duplicado) {
                if (!opts.sinToast) {
                    mostrarToastTk('info', 'Ya en cola', 'Este MP-TK ya está pendiente de envío.');
                }
                return false;
            }
            if (encolado) {
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
                if (!opts.sinUi) {
                    setStatus('');
                    if (elStatus) elStatus.hidden = true;
                }
                if (!opts.sinToast) {
                    mostrarToastTk('warning', 'Sin internet', 'Quedó en cola y se enviará al volver la conexión.');
                }
                return true;
            }
            return false;
        }

        if (!opts.sinLoading) {
            envioTkEnCurso = true;
            setButtonLoadingMptk_(elBtnEnviar, true, 'Enviando...');
        }
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const confirmado = await confirmarTkEnServidorTrasPost_(body);
            if (confirmado) {
                marcarColaTkEnviada_(fecha, sel?.ensayo_numero || body?.ensayo_numero, sel?.num_muestra || body?.num_muestra);
                actualizarHeaderPendientes();
                if (opts.sinUi) {
                    limpiarTrasEnvioLocal_();
                    return true;
                }
                if (!opts.sinLoading) {
                    envioTkEnCurso = false;
                    setButtonLoadingMptk_(elBtnEnviar, false);
                }
                await aplicarExitoEnvioTk_(sel, { estado });
                return true;
            }
            const encolado = encolarTkPendiente(body);
            if (encolado && !encolado.duplicado) {
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
            }
            if (!opts.sinToast) {
                mostrarToastTk('info', 'En cola', 'POST enviado; se confirmará con la planilla en breve.');
            }
            if (!opts.sinUi) {
                setStatus('');
                if (elStatus) elStatus.hidden = true;
            }
            return true;
        } catch (_) {
            const encolado = encolarTkPendiente(body);
            if (encolado && !encolado.duplicado) {
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
                if (!opts.sinToast) {
                    mostrarToastTk('warning', 'Conexión inestable', 'Quedó en cola para reenviar.');
                }
                if (!opts.sinUi) {
                    setStatus('');
                    if (elStatus) elStatus.hidden = true;
                }
                return true;
            }
            if (!opts.sinToast) {
                mostrarToastTk('error', 'Error', 'No se pudo enviar el registro.');
            }
            return false;
        } finally {
            if (!opts.sinLoading) {
                envioTkEnCurso = false;
                setButtonLoadingMptk_(elBtnEnviar, false);
            }
        }
    }

    async function enviarMptkDesdeCaptura_(cap, opts) {
        if ((!opts?.sinLoading && envioTkEnCurso) || !cap?.estado) return false;
        const val = validarCompletitudTkParaEnvioDesdeEstado_(cap.estado, cap.detalleSnap);
        if (!val.ok) {
            const msg = val.errores[0] || 'Completa todos los datos de MP-TK antes de enviar.';
            const etiqueta = textoSelectMuestra(cap.num_muestra, cap.ensayo_numero);
            setStatus(msg, 'warn');
            await mostrarErroresCompletitudMptk_(val.errores, etiqueta + ' · datos incompletos');
            return false;
        }
        const fecha = normalizarFechaIso(elFecha?.value);
        const sel = {
            num_muestra: cap.num_muestra,
            ensayo_numero: cap.ensayo_numero,
            modo_registro: cap.detalleSnap?.modo_registro || ''
        };
        const body = buildPayloadEnvioTkDesdeEstado_(cap.estado, sel, fecha, cap.detalleSnap);
        return ejecutarEnvioTkBody_(body, sel, cap.estado, opts);
    }

    async function refrescarMuestraMptkActivaTrasLote_(rawActivo, listaReferencia) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const ordenRef = ordenarMuestrasMptkPorEnsayo_(listaReferencia || []);
        const rawUltimoEnsayo = ordenRef.length ? ordenRef[ordenRef.length - 1].raw : '';
        const raw = String(rawActivo || rawUltimoEnsayo || elMuestra?.value || '').trim();
        if (!fecha || !raw) return;
        const parts = raw.split('|');
        const ensayoNumero = parts[1] || '';
        if (!ensayoNumero) return;
        if (String(elMuestra?.value || '').trim() !== raw) {
            mptkRestaurandoBorrador = true;
            if (elMuestra) elMuestra.value = raw;
            mptkMuestraAnterior = raw;
            mptkRestaurandoBorrador = false;
        }
        const borrador = leerBorradorMuestraMptk_(fecha, raw);
        if (borrador?.estado && hayDatosCapturaMptk_(borrador.estado)) {
            if (borrador.detalleSnap) {
                lastDetalleTk = borrador.detalleSnap;
                tkYaEnServidor = !!borrador.tkYaEnServidor;
                aplicarCuotaDesdeDetalleTk_(lastDetalleTk);
            }
            aplicarEstadoFormularioTk_(borrador.estado);
        } else {
            limpiarUiCapturaMuestraMptk_();
            window.MptkUi?.resetCards?.();
        }
        await cargarDetalle(fecha, ensayoNumero);
        actualizarFabRestanteBadgeMptk();
    }

    async function enviarMptkMuestraActual_(opts) {
        if (envioTkEnCurso && !opts?.sinLoading) return false;
        if (!elMuestra?.value) {
            setStatus('Selecciona una muestra antes de enviar.', 'warn');
            return false;
        }
        if (tkYaEnServidor) {
            mostrarToastTk('info', 'Ya en planilla', 'Thermo-King ya está registrado para esta muestra.');
            return false;
        }
        if (!muestraPackingCompletaParaTk_(lastDetalleTk)) {
            setStatus('Packing aún no está completo en servidor.', 'warn');
            return false;
        }
        const validacion = validarCompletitudTkParaEnvio();
        if (!validacion.ok) {
            mptkStatusSeguimientoEnvio_ = true;
            const msg = validacion.errores[0] || 'Revisa los datos antes de enviar.';
            setStatus(msg, 'warn');
            await mostrarErroresCompletitudMptk_(validacion.errores, 'Datos incompletos');
            return false;
        }
        const body = buildPayloadEnvioTk_();
        const sel = ensayoSeleccionado();
        const estadoEnvio = leerEstadoFormularioTk_();
        return ejecutarEnvioTkBody_(body, sel, estadoEnvio, opts);
    }

    async function enviarMptkMuestrasEnSecuencia_(lista) {
        const ordenadasAsc = ordenarMuestrasMptkPorEnsayo_(lista || []);
        const analisisLote = analizarMuestrasMptkDelDia_();
        const satisfechos = ensayosSatisfechosSecuenciaMptk_(analisisLote);
        const huecos = huecosSinSatisfechosMptk_(detectarHuecosSecuenciaMptk_(ordenadasAsc).huecos, satisfechos);
        const huecosDia = huecosSinSatisfechosMptk_(analisisLote.huecosEnDia || [], satisfechos);
        const faltanSecuencia = huecosDia.length ? huecosDia : huecos;
        if (faltanSecuencia.length) {
            const pend = analisisLote.pendientes.find(
                (r) => Number(r.ensayo_numero) === faltanSecuencia[0]
            );
            const etiqueta = pend?.etiqueta || ('muestra ' + faltanSecuencia[0]);
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireMptk_({
                    icon: 'warning',
                    title: 'No se puede enviar todas juntas',
                    html: '<p style="margin:0;font-size:13px;color:#475569;">'
                        + '<b>' + etiqueta + '</b> no tiene contador en <b>0</b> '
                        + '(badge verde en el botón +). Completa sus datos antes de enviar la secuencia.</p>',
                    confirmButtonText: 'Entendido',
                    allowOutsideClick: false
                });
            } else {
                mostrarToastTk(
                    'warning',
                    'Secuencia incompleta',
                    'Completa ' + etiqueta + ' (contador en 0) antes de enviar todas juntas.'
                );
            }
            return false;
        }
        const rawActivo = String(elMuestra?.value || '').trim();
        asegurarBorradoresAntesEnvioMptk_(lista);
        persistirBorradoresContadorCeroMptk_(elFecha?.value);
        persistirBorradoresCompletasMptk_(elFecha?.value);
        const ordenadas = ordenadasAsc.slice().reverse();
        const capturas = [];
        for (const item of ordenadas) {
            const cap = await asegurarCapturaEnvioMptk_(item.raw);
            if (!cap || !hayDatosTrabajoTk_(cap.estado)) {
                const etiqueta = item.etiqueta || textoSelectMuestra(item.num_muestra, item.ensayo_numero);
                mostrarToastTk(
                    'warning',
                    'Datos no disponibles',
                    'No hay datos guardados para ' + (etiqueta || 'la muestra') + '. Ábrela, verifica el 0 verde y reintenta.'
                );
                await refrescarMuestraMptkActivaTrasLote_(rawActivo, ordenadasAsc);
                return false;
            }
            capturas.push({ item, cap });
        }

        const optsLote = { sinUi: true, sinLoading: true, sinToast: true };
        envioTkEnCurso = true;
        setButtonLoadingMptk_(elBtnEnviar, true, 'Enviando muestras...');
        let enviados = 0;
        try {
            for (const { cap } of capturas) {
                const ok = await enviarMptkDesdeCaptura_(cap, optsLote);
                if (!ok) {
                    if (enviados > 0) {
                        mostrarToastTk(
                            'info',
                            'Envío parcial',
                            enviados + ' muestra(s) enviada(s); revisa la siguiente.'
                        );
                    }
                    await refrescarMuestraMptkActivaTrasLote_(rawActivo, ordenadasAsc);
                    return false;
                }
                enviados++;
            }
        } finally {
            envioTkEnCurso = false;
            setButtonLoadingMptk_(elBtnEnviar, false);
        }

        if (enviados > 0) {
            const fechaLote = normalizarFechaIso(elFecha?.value);
            capturas.forEach(({ cap }) => {
                marcarColaTkEnviada_(fechaLote, cap.ensayo_numero, cap.num_muestra);
            });
            actualizarHeaderPendientes();
            await guardarPdfMptkHistorialTrasEnvio_(
                capturas.map(({ item, cap }) => ({
                    fecha: fechaLote,
                    num_muestra: cap.num_muestra,
                    ensayo_numero: cap.ensayo_numero,
                    raw: item.raw,
                    estado: cap.estado,
                    detalle: cap.detalleSnap || null
                })),
                fechaLote
            );
            await refrescarMuestraMptkActivaTrasLote_(rawActivo, ordenadasAsc);
            const fecha = elFecha?.value || '';
            if (fecha) await cargarMuestrasPorFecha(fecha);
            mostrarToastTk(
                'success',
                'Enviado',
                enviados + ' muestra(s) MP-TK guardadas en la planilla.'
            );
        }
        return enviados > 0;
    }

    async function guardarRegistroYEnviarDesdePantallaMptk_() {
        if (envioTkEnCurso) return;

        let validandoUi = true;
        setButtonLoadingMptk_(elBtnEnviar, true, 'Validando…');
        const liberarValidacionUi = () => {
            if (!validandoUi) return;
            validandoUi = false;
            if (!envioTkEnCurso) setButtonLoadingMptk_(elBtnEnviar, false);
        };

        try {
            const rawActivo = String(elMuestra?.value || '').trim();

            if (!rawActivo) {
                setStatus('Selecciona una muestra antes de enviar.', 'warn');
                return;
            }
            if (tkYaEnServidor) {
                mostrarToastTk(
                    'info',
                    'Ya en planilla',
                    'Thermo-King ya está completo en el servidor. Selecciona otra muestra pendiente.'
                );
                return;
            }
            if (!muestraPackingCompletaParaTk_(lastDetalleTk)) {
                setStatus('Packing aún no está completo en servidor.', 'warn');
                return;
            }
            if (restantesPorAgregarMptk_() > 0) {
                const rest = restantesPorAgregarMptk_();
                mostrarToastTk(
                    'warning',
                    'Faltan Thermo-King',
                    'Agrega ' + rest + ' más (el contador del + debe estar en 0).'
                );
                return;
            }

            const completas = prepararDeteccionEnvioMptkLocal_();
            const analisis = analizarMuestrasMptkDelDia_();
            const candidatas = resolverCandidatasModalEnvioMptk_(completas);
            asegurarBorradoresAntesEnvioMptk_(candidatas);

            if (!candidatas.length) {
                validandoUi = false;
                await enviarMptkMuestraActual_();
                return;
            }

            if (analisis.pendientes.length) {
                liberarValidacionUi();
                const ok = await confirmarContinuarEnvioConPendientesMptk_(analisis);
                if (!ok) return;
                setButtonLoadingMptk_(elBtnEnviar, true, 'Validando…');
                validandoUi = true;
            }

            let plan = null;
            if (candidatas.length >= 2) {
                liberarValidacionUi();
                plan = await seleccionarMuestraMptkParaEnviar_(rawActivo, candidatas, analisis);
                if (!plan) return;
                setButtonLoadingMptk_(elBtnEnviar, true, 'Enviando…');
                validandoUi = false;
            } else {
                validandoUi = false;
                plan = { modo: 'una', raw: candidatas[0].raw };
            }

            if (plan.modo === 'todas') {
                await enviarMptkMuestrasEnSecuencia_(plan.lista);
                return;
            }

            const raw = String(plan.raw || rawActivo).trim();
            const cap = capturaEstadoMuestraParaValidacionMptk_(raw);
            if (cap && muestraMptkPendienteDeEnvio_(cap.estado, cap.detalleSnap, raw)) {
                if (raw !== rawActivo) {
                    const ok = await enviarMptkDesdeCaptura_(cap);
                    if (ok) await refrescarMuestraMptkActivaTrasLote_(rawActivo, candidatas);
                    return;
                }
                await enviarMptkMuestraActual_();
                return;
            }
            if (raw && raw !== rawActivo) {
                await cargarMuestraMptkParaEnvio_(raw);
            }
            await enviarMptkMuestraActual_();
        } finally {
            liberarValidacionUi();
        }
    }

    async function enviarRegistroTk(opts) {
        return enviarMptkMuestraActual_(opts);
    }

    async function fetchDetalleTk_(fechaIso, ensayoNumero) {
        const params = { fecha: fechaIso, ensayo_numero: ensayoNumero };
        const intentos = [22000, 28000];
        let ultimoErr = null;
        for (let i = 0; i < intentos.length; i++) {
            try {
                return await callbackJsonp(params, intentos[i]);
            } catch (err) {
                ultimoErr = err;
                if (i >= intentos.length - 1) break;
            }
        }
        throw ultimoErr || new Error('La planilla tardó demasiado. Reintenta.');
    }

    function textoStatusTkMptk_() {
        if (!tkYaEnServidor) return '';
        const max = cuotaMaximaEfectivaMptk_();
        const hechas = max > 0 ? max : Math.max(0, filasTkHechasMptk_());
        if (max > 0) {
            return 'MP-TK completo en servidor (' + hechas + '/' + max + ').';
        }
        return 'MP-TK completo en servidor.';
    }

    async function cargarDetalle(fechaIso, ensayoNumero) {
        if (!fechaIso || !ensayoNumero) return;
        cancelarGuardadoBorradorProgramadoMptk_();
        omitirAutoguardado = true;
        const rawMuestra = String(elMuestra?.value || '').trim();
        const key = claveBorradorTk(fechaIso, rawMuestra);

        if (!navigator.onLine) {
            const borrador = key ? leerStoreBorradorTk().porClave[key] : null;
            if (borrador?.detalleSnap) {
                lastDetalleTk = borrador.detalleSnap;
                tkYaEnServidor = !!borrador.tkYaEnServidor
                    || detalleSnapIndicaTkCompletoEnServidorMptk_(borrador.detalleSnap);
                aplicarCuotaDesdeDetalleTk_(lastDetalleTk);
                if (tkYaEnServidor) {
                    guardarMarcaServidorMptkDesdeDetalle_(fechaIso, rawMuestra, lastDetalleTk);
                }
                setResumenVisible(true);
                setChipsPanelCollapsed(false, false);
                setPreviewLoading(false);
                limpiarUiCapturaMuestraMptk_();
                syncFechaInspeccionDesdeSelector_();
                pintarPreview(lastDetalleTk);
                if (!tkYaEnServidor && borrador.estado && hayDatosCapturaMptk_(borrador.estado)) {
                    mptkRestaurandoBorrador = true;
                    try {
                        aplicarEstadoFormularioTk_(borrador.estado);
                    } finally {
                        mptkRestaurandoBorrador = false;
                    }
                }
                setFormularioHabilitado(!tkYaEnServidor && mptkCapturaPermitida_(lastDetalleTk));
                actualizarFabRestanteBadgeMptk();
                const msgTk = textoStatusTkMptk_();
                if (msgTk) {
                    setStatus(msgTk, 'warn');
                } else {
                    setStatus('');
                    if (elStatus) elStatus.hidden = true;
                }
                omitirAutoguardado = false;
                return;
            }
            setStatus('Sin internet para cargar el detalle.', 'warn');
            omitirAutoguardado = false;
            return;
        }

        prepararUiNuevaMuestraMptk_();
        setStatus('');
        if (elStatus) elStatus.hidden = true;

        try {
            const r = await withMinLoader(() => fetchDetalleTk_(fechaIso, ensayoNumero));
            if (!r || r.ok !== true || !r.data) {
                throw new Error(r?.error || 'Registro no encontrado');
            }
            lastDetalleTk = r.data;
            tkYaEnServidor = r.data.tieneThermoKing === true;
            aplicarCuotaDesdeDetalleTk_(r.data);
            if (tkYaEnServidor) {
                guardarMarcaServidorMptkDesdeDetalle_(fechaIso, rawMuestra, r.data);
            }

            if (!fundoHabilitaMptk_(r.data)) {
                throw new Error(
                    window.FundoFlujoTk20?.mensajeFundoNoHabilitado?.(r.data) || 'MP-TK solo para fundo A9.'
                );
            }

            if (!muestraPackingCompletaParaTk_(r.data)) {
                throw new Error('Packing aún no está completo en servidor. Termina packing primero.');
            }

            const borrador = key ? leerStoreBorradorTk().porClave[key] : null;
            syncFechaInspeccionDesdeSelector_();
            if (!tkYaEnServidor && borrador && hayDatosCapturaMptk_(borrador.estado)) {
                pintarPreview(r.data);
                mptkRestaurandoBorrador = true;
                try {
                    aplicarEstadoFormularioTk_(borrador.estado);
                } finally {
                    mptkRestaurandoBorrador = false;
                }
            } else {
                limpiarUiCapturaMuestraMptk_();
                syncFechaInspeccionDesdeSelector_();
                pintarPreview(r.data);
            }
            setFormularioHabilitado(!tkYaEnServidor && mptkCapturaPermitida_(lastDetalleTk));
            actualizarFabRestanteBadgeMptk();
            const msgTk = textoStatusTkMptk_();
            if (msgTk) {
                setStatus(msgTk, 'warn');
            } else {
                setStatus('');
                if (elStatus) elStatus.hidden = true;
            }
        } catch (err) {
            setStatus(String(err.message || err), 'error');
            limpiarPreview();
        } finally {
            setPreviewLoading(false);
            omitirAutoguardado = false;
        }
    }

    function restaurarMuestraActivaDesdeBorrador() {
        const store = leerStoreBorradorTk();
        const activo = String(store?.activo || '').trim();
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!activo || !fecha || !elMuestra) return false;
        if (!activo.startsWith(fecha + '::')) return false;
        const rawMuestra = activo.slice(fecha.length + 2);
        if (!rawMuestra) return false;
        const opt = Array.from(elMuestra.options).find((o) => o.value === rawMuestra);
        if (!opt) return false;
        mptkRestaurandoBorrador = true;
        elMuestra.value = rawMuestra;
        mptkMuestraAnterior = rawMuestra;
        mptkRestaurandoBorrador = false;
        const ensayoNumero = rawMuestra.split('|')[1] || '';
        if (ensayoNumero) void cargarDetalle(fecha, ensayoNumero);
        return true;
    }

    async function cargarMuestrasPorFecha(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) {
            poblarSelectMuestra([]);
            return;
        }
        const seq = ++cargandoMuestrasSeq;
        if (elMuestra) {
            elMuestra.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Cargando…';
            elMuestra.appendChild(opt);
            elMuestra.disabled = true;
        }
        limpiarPreview();

        if (!navigator.onLine) {
            const listaLocal = muestrasOfflineDesdeBorradorTk(fecha);
            if (seq !== cargandoMuestrasSeq) return;
            poblarSelectMuestra(listaLocal);
            restaurarMuestraActivaDesdeBorrador();
            setStatus(listaLocal.length
                ? 'Sin internet: muestras recuperadas del borrador local.'
                : 'Sin internet. No hay borradores guardados para esta fecha.', 'warn');
            if (elStatus) elStatus.hidden = false;
            return;
        }

        setSelectLoading(true, 'Cargando muestras…');
        setStatus('');
        if (elStatus) elStatus.hidden = true;

        try {
            const base = await withMinLoader(() => fetchMuestrasPorFecha(fecha));
            if (seq !== cargandoMuestrasSeq) return;
            const operativas = normalizarListaMuestrasOperativasTk_(base);
            if (seq !== cargandoMuestrasSeq) return;
            const offline = muestrasOfflineDesdeBorradorTk(fecha);
            const merged = [];
            const seen = new Set();
            [...operativas, ...offline].forEach((item) => {
                const key = String(item.num_muestra || '') + '|' + String(item.ensayo_numero || '');
                if (!key || seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            });
            poblarSelectMuestra(merged);
            actualizarCacheListaMuestrasMptk_(fecha, merged);
            restaurarMuestraActivaDesdeBorrador();
            if (!merged.length) {
                setStatus('No hay registros de campo para esa fecha.', 'warn');
            }
        } catch (err) {
            if (seq !== cargandoMuestrasSeq) return;
            const msg = String(err.message || err);
            setStatus(msg, 'error');
            if (elMuestra) {
                elMuestra.innerHTML = '';
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Error — cambia la fecha';
                elMuestra.appendChild(opt);
                elMuestra.disabled = false;
            }
            poblarSelectMuestra([]);
        } finally {
            if (seq === cargandoMuestrasSeq) setSelectLoading(false);
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
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    function actualizarHeaderPendientes() {
        if (!elHeaderPend) return;
        const n = colaTkPendienteCount_();
        elHeaderPend.textContent = String(n).padStart(2, '0');
        elHeaderPend.classList.toggle('header-status-pend-num--alert', n > 0);
    }

    function crearIconos() {
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    elFecha?.addEventListener('change', () => {
        if (elFecha && window.FechaOperativa?.esFechaOperativaPermitida
            && !window.FechaOperativa.esFechaOperativaPermitida(elFecha.value)) {
            window.FechaOperativa.aplicarRangoInputFecha(elFecha, { forzar: true });
        }
        syncFechaInspeccionDesdeSelector_();
        const rawPrev = elMuestra?.value || '';
        const fechaPrev = elFecha?.dataset?.prev || elFecha?.value || '';
        const detallePrev = lastDetalleTk;
        cancelarGuardadoBorradorProgramadoMptk_();
        if (rawPrev && fechaPrev) {
            snapshotBorradorTk_(fechaPrev, rawPrev, { activa: false, detalleSnap: detallePrev });
        }
        elFecha.dataset.prev = elFecha.value || '';
        mptkMuestraAnterior = '';
        void cargarMuestrasPorFecha(elFecha.value || '');
    });

    elMuestra?.addEventListener('focus', () => {
        mptkMuestraAnterior = String(elMuestra?.value || '').trim();
    });

    elMuestra?.addEventListener('change', () => {
        mptkBadgeWasComplete = false;
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(elMuestra?.value || '').trim();
        let prev = mptkMuestraAnterior || '';
        if ((!prev || prev === raw) && fecha) {
            const desdeActiva = rawMuestraDesdeClaveActivaMptk_(fecha);
            if (desdeActiva && desdeActiva !== raw) prev = desdeActiva;
        }
        const detallePrev = lastDetalleTk;
        const estadoPrev = (prev && prev !== raw) ? leerEstadoFormularioTk_() : null;

        cancelarGuardadoBorradorProgramadoMptk_();

        if (prev && prev !== raw && fecha) {
            snapshotMuestraMptkSiHayTrabajo_(fecha, prev, estadoPrev, detallePrev);
        }
        mptkMuestraAnterior = raw;

        if (!fecha || !raw) {
            limpiarPreview();
            setStatus('');
            return;
        }
        const parts = raw.split('|');
        const ensayoNumero = parts.length >= 2 ? parts[1] : '';
        if (!ensayoNumero) {
            limpiarPreview();
            setStatus('');
            return;
        }
        const store = leerStoreBorradorTk();
        store.activo = claveBorradorTk(fecha, raw);
        guardarStoreBorradorTk(store);
        void cargarDetalle(fecha, ensayoNumero);
    });

    elResumenToggle?.addEventListener('click', toggleChipsPanelCollapsed);

    elBtnEnviar?.addEventListener('click', () => { void guardarRegistroYEnviarDesdePantallaMptk_(); });

    elBtnPlacaMptk?.addEventListener('click', abrirModalPlacaTk_);
    document.getElementById('mptk-placa-cancel')?.addEventListener('click', cerrarModalPlacaTk_);
    document.getElementById('mptk-placa-guardar')?.addEventListener('click', guardarModalPlacaTk_);
    elPlacaModalMptk?.addEventListener('click', (ev) => {
        if (ev.target === elPlacaModalMptk) cerrarModalPlacaTk_();
    });
    elPlacaInputMptk?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            guardarModalPlacaTk_();
        }
    });

    elFabOptionsBtn?.addEventListener('click', () => {
        establecerMenuFlotanteMptk(!elFabMenu?.classList.contains('is-open'));
    });
    function onFabAgregarMptkClick() {
        const ahora = Date.now();
        if (fabAgregarMptkEnCurso_ || ahora - fabAgregarMptkTs_ < 450) return;
        fabAgregarMptkTs_ = ahora;
        fabAgregarMptkEnCurso_ = true;
        try {
            establecerMenuFlotanteMptk(false);
            if (!elMuestra?.value) {
                mostrarToastTk('info', 'Seleccionar muestra', 'Selecciona muestra para continuar.');
                return;
            }
            if (tkYaEnServidor) {
                mostrarToastTk('info', 'Ya en planilla', 'Thermo-King ya fue registrado para esta muestra.');
                return;
            }
            if (!muestraPackingCompletaParaTk_(lastDetalleTk)) {
                const max = cuotaMaximaEfectivaMptk_();
                mostrarToastTk(
                    'info',
                    'Packing incompleto',
                    'Termina packing en servidor antes de continuar ('
                        + mptkQuota.filasPackingRegistradas + '/' + max + ').'
                );
                return;
            }
            if (restantesPorAgregarMptk_() <= 0 && !window.MptkUi?.cardSinDatos?.()) {
                const max = cuotaMaximaEfectivaMptk_();
                mostrarToastTk(
                    'info',
                    'Límite alcanzado',
                    'Ya no puedes agregar Thermo-King (' + max + ' clamshells).'
                );
                return;
            }
            if (window.MptkUi?.agregarCardYAbrirPesos) {
                window.MptkUi.agregarCardYAbrirPesos();
            }
        } finally {
            fabAgregarMptkEnCurso_ = false;
        }
    }

    document.getElementById('fab-mptk-sync')?.addEventListener('click', () => {
        if (typeof window.actualizarAppCompletoDesdeFab === 'function') {
            void window.actualizarAppCompletoDesdeFab();
        } else {
            void sincronizarConPlanillaMptk();
        }
    });
    document.getElementById('fab-mptk-borrar')?.addEventListener('click', () => { void borrarTodoLocalMptk_(); });
    document.getElementById('fab-mptk-demo')?.addEventListener('click', () => {
        establecerMenuFlotanteMptk(false);
        void fabIniciarRegistroMptk_();
    });
    document.getElementById('fab-mptk-agregar')?.addEventListener('click', onFabAgregarMptkClick);
    document.addEventListener('click', (e) => {
        if (elFabMenu && !elFabMenu.contains(e.target)) establecerMenuFlotanteMptk(false);
    });

    elFechaRingWidget?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePopoverFechaRingMptk();
    });
    elFechaRingWidget?.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        togglePopoverFechaRingMptk();
    });
    document.addEventListener('click', () => togglePopoverFechaRingMptk(false));

    INPUT_IDS_EDITABLES.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', programarGuardadoBorradorTk_);
        el.addEventListener('change', programarGuardadoBorradorTk_);
    });
    ['responsable_tk', 'hora_salida_frio_tk'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', programarGuardadoBorradorTk_);
        el.addEventListener('change', () => {
            programarGuardadoBorradorTk_();
            window.MptkUi?.revalidarTiemposModalEnVivo?.();
            programarActualizarStatusValidacionMptk_();
        });
    });

    if (window.MptkUi) {
        window.MptkUi.init({
            onChange: () => {
                recalcularPresionesMptk_();
                programarGuardadoBorradorTk_();
                programarActualizarStatusValidacionMptk_();
            },
            onCardsChange: () => {
                actualizarFabRestanteBadgeMptk();
                programarGuardadoBorradorTk_();
                programarActualizarStatusValidacionMptk_();
            },
            recalcPresiones: recalcularPresionesMptk_,
            toast: mostrarToastTk,
            muestraActiva: () => !!(String(elMuestra?.value || '').trim() && !tkYaEnServidor),
            getFilasTkServidor: filasTkHechasMptk_,
            getCuotaMax: cuotaMaximaEfectivaMptk_,
            getVariedad: () => {
                const v = valInput('variedad_info_tk') || String(lastDetalleTk?.VARIEDAD || '').trim();
                return v || '—';
            },
            getLimitePesoIngresoMp: (clamshellNum) => limitePesoIngresoMpDesdeDetalleMptk_(clamshellNum, lastDetalleTk)
        });
    }

    window.addEventListener('online', () => {
        actualizarHeaderConexion();
        void sincronizarPendientesTk();
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

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            persistirSoloLocalMptk_();
            return;
        }
        purgarBorradoresMptkOtrosDias_();
        aplicarFechaHoy_({ forzar: true });
        if (reafirmarBorradorMptkAlVolverVisible_()) return;
        void sincronizarPendientesTk();
    });

    window.addEventListener('beforeunload', () => {
        persistirSoloLocalMptk_();
    });
    window.addEventListener('pagehide', () => {
        persistirSoloLocalMptk_();
    });

    const MPTK_DRAFT_AUTOSAVE_MS = 3000;
    setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        if (omitirAutoguardado || mptkRestaurandoBorrador) return;
        if (!String(elMuestra?.value || '').trim()) return;
        persistirSoloLocalMptk_();
    }, MPTK_DRAFT_AUTOSAVE_MS);

    actualizarHeaderConexion();
    actualizarHeaderPendientes();
    actualizarFechaRingMptk();
    crearIconos();
    purgarBorradoresMptkOtrosDias_();
    syncFechaInspeccionDesdeSelector_();
    aplicarFechaHoy_({ forzar: true });
    elFecha.dataset.prev = elFecha?.value || '';
    setChipsPanelCollapsed(false, false);
    try {
        const collapsed = localStorage.getItem(CHIPS_COLLAPSED_KEY) === '1';
        if (collapsed) setChipsPanelCollapsed(true, false);
    } catch (_) { /* ignore */ }
    limpiarPreview();
    syncFoldBtnAnchor();
    initTimePickersMptk_();
    actualizarFabRestanteBadgeMptk();
    void acotarFechaDesdePlanilla().then(() => {
        const fecha = elFecha?.value || '';
        if (fecha) return cargarMuestrasPorFecha(fecha);
    }).then(() => sincronizarPendientesTk());
})();
