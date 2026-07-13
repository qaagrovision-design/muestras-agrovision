const META_SAVE_IDS = [
    'visual-meta-muestra',
    'visual-responsable',
    'visual-guia-precosecha',
    'visual-hora',
    'visual-meta-fundo',
    'visual-traz-etapa',
    'visual-traz-campo',
    'visual-traz-turno',
    'visual-traz-acopio',
    'visual-meta-variedad',
    'visual-guia-acopio',
    'visual-placa-vehiculo',
    'visual-observacion-formato',
    'visual-trazabilidad',
    'visual-rotulo'
];

        /** Compatibilidad: datos guardados con ids viejos en localStorage. */
        const LEGACY_META_KEYS = {
            'visual-meta-muestra': ['meta-muestra'],
            'visual-meta-fundo': ['meta-fundo'],
            'visual-meta-variedad': ['meta-variedad'],
            'visual-traz-etapa': ['meta-traz-etapa'],
            'visual-traz-campo': ['meta-traz-campo']
        };

        function migrarClavesMetaObjeto(o) {
            if (!o || typeof o !== 'object') return;
            delete o['visual-num-muestra'];
            delete o._num_muestra_fijo;
            Object.keys(LEGACY_META_KEYS).forEach((nuevo) => {
                const cur = o[nuevo];
                if (cur !== undefined && cur !== null && String(cur).trim() !== '') return;
                const legacyList = LEGACY_META_KEYS[nuevo];
                for (let i = 0; i < legacyList.length; i++) {
                    const old = legacyList[i];
                    const v = o[old];
                    if (v !== undefined && v !== null && String(v).trim() !== '') {
                        o[nuevo] = v;
                        return;
                    }
                }
            });
        }
        const META_STORAGE_KEY_LEGACY = 'tiempos-operativo-meta-v4';
        const DRAFT_STORAGE_KEY_LEGACY = 'tiempos-draft-full-v1';
        /** Una sola vez por navegador: rellena meta de ejemplo para probar envío (solo campos vacíos). */
        const DEMO_META_CAMPO_SEED_KEY = 'tiempos-demo-meta-campo-seed-v1';
        const SYNC_QUEUE_KEY = 'tiempos-sync-queue-v1';
        const SYNC_HISTORY_KEY = 'tiempos-sync-history-v1';
        const SYNC_ENVIADOS_KEY = 'tiempos-sync-enviados-v1';
        const DRAFT_STORAGE_KEY = DRAFT_STORAGE_KEY_LEGACY;

        function claveModoCampoActual_() {
            return esModoRegistroAcopio_() ? 'acopio' : 'visual';
        }

        function draftStorageKeyCampo_() {
            return 'tiempos-draft-full-' + claveModoCampoActual_() + '-v1';
        }

        function metaStorageKeyCampo_() {
            return 'tiempos-operativo-meta-' + claveModoCampoActual_() + '-v4';
        }

        function todasClavesDraftCampo_() {
            return [
                'tiempos-draft-full-visual-v1',
                'tiempos-draft-full-acopio-v1',
                DRAFT_STORAGE_KEY_LEGACY
            ];
        }

        function todasClavesMetaCampo_() {
            return [
                'tiempos-operativo-meta-visual-v4',
                'tiempos-operativo-meta-acopio-v4',
                META_STORAGE_KEY_LEGACY
            ];
        }

        function hoyIsoLocal() {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        /** Borrador/meta válidos solo para la fecha operativa de hoy (evita arrancar en Muestra 6 tras otro día). */
        function borradorCampoEsDeHoy_(d) {
            if (!d || typeof d !== 'object') return false;
            const f = String(d.fechaOperativa || d.fecha || '').trim();
            if (f) return f === hoyIsoLocal();
            const ts = Number(d.ts);
            if (Number.isFinite(ts) && ts > 0) {
                const dt = new Date(ts);
                const hoy = new Date();
                return dt.getFullYear() === hoy.getFullYear()
                    && dt.getMonth() === hoy.getMonth()
                    && dt.getDate() === hoy.getDate();
            }
            return false;
        }

        function metaAlmacenadaEsDeHoy_(o) {
            if (!o || typeof o !== 'object') return false;
            const f = String(o.fechaOperativa || '').trim();
            return f === hoyIsoLocal();
        }

        function numMuestraUsadoEsDeHoy_(det) {
            if (!det || typeof det !== 'object') return false;
            return String(det.fecha || '').trim() === hoyIsoLocal();
        }

        function ultimoDiaCampoGuardado_() {
            try {
                return String(localStorage.getItem(ULTIMO_DIA_CAMP_KEY_PREFIX + claveModoCampoActual_()) || '').trim();
            } catch (_) {
                return '';
            }
        }

        function marcarDiaCampoOperativo_(fecha) {
            try {
                localStorage.setItem(ULTIMO_DIA_CAMP_KEY_PREFIX + claveModoCampoActual_(), fecha || hoyIsoLocal());
            } catch (_) { /* ignore */ }
        }

        /** true si cambió el día calendario desde la última vez en Campo/Acopio. */
        function esNuevoDiaCampo_() {
            const hoy = hoyIsoLocal();
            const ult = ultimoDiaCampoGuardado_();
            if (!ult) {
                marcarDiaCampoOperativo_(hoy);
                return false;
            }
            if (ult === hoy) return false;
            marcarDiaCampoOperativo_(hoy);
            return true;
        }

        function purgarNumMuestraUsadosDiasAnteriores_() {
            const hoy = hoyIsoLocal();
            const map = cargarNumMuestraUsadosLocal();
            let changed = false;
            Object.keys(map).forEach((k) => {
                if (String(map[k]?.fecha || '').trim() !== hoy) {
                    delete map[k];
                    changed = true;
                }
            });
            if (changed) guardarNumMuestraUsadosLocal(map);
        }

        function limpiarAlmacenamientoCampoNuevoDia_() {
            purgarBorradoresCampoDeOtroDia_();
            todasClavesDraftCampo_().forEach((k) => {
                try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
            });
            try { localStorage.removeItem(metaStorageKeyCampo_()); } catch (_) { /* ignore */ }
            try {
                const raw = localStorage.getItem(REGISTRADOS_HOY_CACHE_KEY);
                if (raw) {
                    const o = JSON.parse(raw);
                    if (!o || o.fecha !== hoyIsoLocal()) {
                        localStorage.removeItem(REGISTRADOS_HOY_CACHE_KEY);
                    }
                }
            } catch (_) { /* ignore */ }
            purgarNumMuestraUsadosDiasAnteriores_();
            NUM_MUESTRA_LS_KEYS_A_PURGAR.forEach((k) => {
                try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
            });
            bloqueoMuestraCacheNums = null;
            bloqueoMuestraUltimoFetchMs = 0;
            if (typeof window.borrarBorradorCampoIdb === 'function') {
                void window.borrarBorradorCampoIdb();
            }
        }

        function prepararCampoNuevoDiaSiCorresponde_() {
            purgarBorradoresCampoDeOtroDia_();
            purgarNumMuestraUsadosDiasAnteriores_();
            if (!esNuevoDiaCampo_()) return false;
            limpiarAlmacenamientoCampoNuevoDia_();
            campoInicioLimpioNuevoDia_ = true;
            return true;
        }

        function leerDraftRawCampo_() {
            const key = draftStorageKeyCampo_();
            try {
                let raw = localStorage.getItem(key);
                if (!raw && claveModoCampoActual_() === 'visual') {
                    raw = localStorage.getItem(DRAFT_STORAGE_KEY_LEGACY);
                    if (raw) {
                        localStorage.setItem(key, raw);
                        localStorage.removeItem(DRAFT_STORAGE_KEY_LEGACY);
                    }
                }
                return raw;
            } catch (_) {
                return null;
            }
        }

        function borradorCampoCoincideModoActual_(d) {
            if (!d || typeof d !== 'object') return false;
            const guardado = String(d.modoRegistro || '').trim().toLowerCase();
            if (!guardado) return true;
            return guardado === modoRegistroPostBody_();
        }
        const CLEAN_START_DONE_KEY = 'tiempos-clean-start-done-v2';
        const SYNC_MAX_HISTORY = 80;
        const SYNC_MAX_ENVIADOS = 48;
        const NUM_MUESTRA_MAX_LEN = 8;
        /** Pie OBSERVACIONES del PDF / input por clamshell. */
        const OBSERVACION_CLAMSHELL_MAX_CHARS = 57;
        const REGISTRADOS_HOY_CACHE_KEY = 'tiempos-registrados-hoy-cache-v1';
        const ULTIMO_DIA_CAMP_KEY_PREFIX = 'muestras-ultimo-dia-campo-v1:';
        let campoInicioLimpioNuevoDia_ = false;
        const CAMPO_LLENADO_COMPLETO_AVISO_KEY = 'tiempos-campo-llenado-completo-aviso-v1';
        const MAX_MUESTRAS_CAMPO = 10;
        const NUM_MUESTRA_USADOS_KEY = 'tiempos-num-muestra-usados-v1';
        /** Claves viejas de N° muestra en localStorage (no se usan; solo se borran al iniciar). */
        const NUM_MUESTRA_LS_KEYS_A_PURGAR = [
            'tiempos-num-muestra-max-cache-v1',
            'tiempos-num-muestra-offline-snapshot-v1',
            'tiempos-last-num-muestra-visual',
            'tiempos-last-num-muestra',
            'tiempos-num-muestra-visual'
        ];
        const REQUIRED_SEND_IDS = [
            // Info
            'visual-meta-muestra',
            'visual-num-muestra',
            'visual-responsable',
            'visual-hora',
            'visual-meta-fundo',
            'visual-traz-etapa',
            'visual-traz-campo',
            'visual-traz-turno',
            'visual-meta-variedad',
            'visual-fecha-ring-widget',
            // Peso bruto
            'visual-m-jarra',
            'visual-p1',
            'visual-p2',
            'visual-acopio',
            'visual-despacho',
            // Tiempos
            'visual-tiempo-1-iniciocosecha-1',
            'visual-tiempo-1-inicioperdida-2',
            'visual-tiempo-1-terminocosecha-3',
            'visual-tiempo-1-terminocosecha-4',
            'visual-tiempo-1-despachoacopio-5',
            // Temperatura muestra
            'visual-temp-amb-inicio',
            'visual-temp-pulpa-inicio',
            'visual-temp-amb-termino',
            'visual-temp-pulpa-termino',
            'visual-temp-amb-llegada',
            'visual-temp-pulpa-llegada',
            'visual-temp-amb-despacho',
            'visual-temp-pulpa-despacho',
            // Humedad relativa
            'visual-cg-humedad-inicio',
            'visual-cg-humedad-termino',
            'visual-cg-humedad-llegada',
            'visual-cg-humedad-despacho',
            // Presion ambiente
            'visual-presionambiente-1-presionambienteinicio-1',
            'visual-presionambiente-1-presionambientetermino-2',
            'visual-presionambiente-1-presionambientellegada-3',
            'visual-presionambiente-1-presionambientedespacho-4',
            // Presion fruta
            'visual-presionfruta-1-presionfrutainicio-1',
            'visual-presionfruta-1-presionfrutatermino-2',
            'visual-presionfruta-1-presionfrutallegada-3',
            'visual-presionfruta-1-presionfrutadespacho-4',
            // Observacion y logistica
            'visual-observation',
            'visual-guia-acopio',
            'visual-placa-vehiculo',
            'visual-observacion-formato'
        ];
        const API_URL = (String((typeof window !== 'undefined' && window.APPS_SCRIPT_API_URL) || '').trim()
            || String((typeof window !== 'undefined' && (window.API_URL || window.__API_URL)) || '').trim());
        const metaForm = document.getElementById('form-operativo-meta');
        const metaAccordion = document.getElementById('meta-accordion');
        const metaAccordionTrigger = document.getElementById('meta-accordion-trigger');
        const metaAccordionPanel = document.getElementById('meta-accordion-panel');
        const fabMenu = document.getElementById('fab-menu');
        const fabOptionsBtn = document.getElementById('fab-options-btn');
        const HEADER_TIPO_REGISTRO_KEY = 'tiempos-header-tipo-registro-v2';

        const IDS_PESO_MODAL_CAMPO = {
            visual: {
                p1: 'visual-p1',
                p2: 'visual-p2',
                acopio: 'visual-acopio',
                despacho: 'visual-despacho'
            },
            acopio: {
                p1: 'acopio-peso-1-termino-cosecha',
                p2: 'acopio-peso-2-llegada',
                acopio: 'acopio-peso-3-calibrado',
                p4: 'acopio-peso-4-clamshell-calibrado',
                despacho: 'acopio-peso-5-despacho-campo'
            }
        };

        const IDS_TIEMPO_MODAL_CAMPO = {
            visual: [
                'visual-tiempo-1-iniciocosecha-1',
                'visual-tiempo-1-inicioperdida-2',
                'visual-tiempo-1-terminocosecha-3',
                'visual-tiempo-1-terminocosecha-4',
                'visual-tiempo-1-despachoacopio-5'
            ],
            acopio: [
                'acopio-tiempo-1-iniciocosecha',
                'acopio-tiempo-2-terminocosecha',
                'acopio-tiempo-3-llegada-acopio',
                'acopio-tiempo-4-acopio-calibrado',
                'acopio-tiempo-5-termino-calibrado',
                'acopio-tiempo-6-despacho-acopio'
            ]
        };

        function esModoRegistroAcopio_() {
            return String(window.CAMPO_REGISTRO_MODO || '').trim() === 'acopio';
        }

        function modoRegistroPostBody_() {
            return esModoRegistroAcopio_() ? 'acopio' : 'visual';
        }

        function codigoPdfCampo_() {
            return esModoRegistroAcopio_() ? 'PE-F-QPH-305' : 'PE-F-QPH-306';
        }

        function idInputPesoModalCampo_(campo) {
            const modo = esModoRegistroAcopio_() ? 'acopio' : 'visual';
            return IDS_PESO_MODAL_CAMPO[modo][campo] || IDS_PESO_MODAL_CAMPO.visual[campo];
        }

        function elInputPesoModalCampo_(campo) {
            return document.getElementById(idInputPesoModalCampo_(campo));
        }

        function etiquetasPesoUiCampo_() {
            if (esModoRegistroAcopio_()) {
                return {
                    modal: [
                        'PESO 1 - TÉRMINO DE COSECHA (g)',
                        'PESO 2 - LLEGADA ACOPIO (g)',
                        'PESO 3 - ACOPIO CALIBRADO (g)',
                        'PESO 4 CLAMSHELL CALIBRADO (g)',
                        'PESO 5 DESPACHO ACOPIO - CAMPO (PESO CLAMSHELL) (g)'
                    ],
                    cardP1: 'Peso 1 · Término cosecha',
                    cardP2: 'Peso 2 · Llegada acopio',
                    cardP3: 'Peso 3 · Acopio calibrado',
                    cardP4: 'Peso 4 · Clamshell calibrado',
                    cardP5: 'Peso 5 · Despacho campo',
                    iconLogP3: 'warehouse',
                    iconLogP4: 'box',
                    iconLogP5: 'truck',
                    cardAcopio: 'Peso 3 · Acopio calibrado',
                    cardDespacho: 'Peso 5 · Despacho campo'
                };
            }
            return {
                modal: ['PESO 1 (g)', 'PESO 2 (g)', 'LLEGADA ACOPIO (g)', 'DESPACHO ACOPIO (g)'],
                cardP1: 'Peso Inicial 1',
                cardP2: 'Peso Inicial 2',
                cardAcopio: 'LLEGADA ACOPIO-CAMPO',
                cardDespacho: 'DESPACHO ACOPIO-CAMPO'
            };
        }

        function bloqueLogisticaPesosCardHtml_(item, lblPeso) {
            if (esModoRegistroAcopio_()) {
                return `
                    <div class="logistics-info logistics-info--tres">
                        <div class="logistic-point"><i data-lucide="${lblPeso.iconLogP3}"></i><div><p style="color: #94A3B8; font-size: 9px;">${lblPeso.cardP3}</p><b class="${pesoVacio(item.acopio) ? 'is-empty-peso' : ''}">${textoPesoCampo(item.acopio)}</b></div></div>
                        <div class="logistic-point"><i data-lucide="${lblPeso.iconLogP4}"></i><div><p style="color: #94A3B8; font-size: 9px;">${lblPeso.cardP4}</p><b class="${pesoVacio(item.p4) ? 'is-empty-peso' : ''}">${textoPesoCampo(item.p4)}</b></div></div>
                        <div class="logistic-point"><i data-lucide="${lblPeso.iconLogP5}"></i><div><p style="color: #94A3B8; font-size: 9px;">${lblPeso.cardP5}</p><b class="${pesoVacio(item.despacho) ? 'is-empty-peso' : ''}">${textoPesoCampo(item.despacho)}</b></div></div>
                    </div>`;
            }
            return `
                    <div class="logistics-info">
                        <div class="logistic-point"><i data-lucide="calendar-check-2"></i><div><p style="color: #94A3B8; font-size: 9px;">${lblPeso.cardAcopio}</p><b class="${pesoVacio(item.acopio) ? 'is-empty-peso' : ''}">${textoPesoCampo(item.acopio)}</b></div></div>
                        <div class="logistic-point"><i data-lucide="truck"></i><div><p style="color: #94A3B8; font-size: 9px;">${lblPeso.cardDespacho}</p><b class="${pesoVacio(item.despacho) ? 'is-empty-peso' : ''}">${textoPesoCampo(item.despacho)}</b></div></div>
                    </div>`;
        }

        function idsInputCriticosCampo_() {
            if (!esModoRegistroAcopio_()) return INPUT_IDS_CRITICOS;
            const omitirAcopio = new Set(['visual-p1', 'visual-p2', 'visual-acopio']);
            const mapaPeso = {
                'visual-p4': 'acopio-peso-4-clamshell-calibrado',
                'visual-despacho': 'acopio-peso-5-despacho-campo'
            };
            const mapaTiempo = {
                'visual-tiempo-1-iniciocosecha-1': 'acopio-tiempo-1-iniciocosecha',
                'visual-tiempo-1-inicioperdida-2': 'acopio-tiempo-4-acopio-calibrado',
                'visual-tiempo-1-terminocosecha-3': 'acopio-tiempo-2-terminocosecha',
                'visual-tiempo-1-terminocosecha-4': 'acopio-tiempo-3-llegada-acopio',
                'visual-tiempo-1-despachoacopio-5': 'acopio-tiempo-6-despacho-acopio'
            };
            const out = [];
            INPUT_IDS_CRITICOS.forEach((id) => {
                if (omitirAcopio.has(id)) return;
                out.push(mapaPeso[id] || mapaTiempo[id] || id);
                if (id === 'visual-m-jarra') out.push('acopio-peso-4-clamshell-calibrado');
            });
            return out;
        }

        function keysTiempoValidacionCampo_() {
            if (esModoRegistroAcopio_()) {
                return ['inicioCosecha', 'terminoCosecha', 'llegadaAcopio', 'acopioCalibrado', 'terminoCalibrado', 'despachoAcopio'];
            }
            return ['inicioCosecha', 'inicioPerdida', 'terminoCosecha', 'llegadaAcopio', 'despachoAcopio'];
        }

        function tiempoPerdidaPesoParaEnvioCampo_(t) {
            if (esModoRegistroAcopio_()) {
                const ac = strOrEmpty(t?.acopioCalibrado);
                const tc = strOrEmpty(t?.terminoCalibrado);
                if (ac && tc) return `${ac} / ${tc}`;
                return ac || tc;
            }
            return strOrEmpty(t?.inicioPerdida);
        }

        const FORZAR_NUM_DESDE_SERVIDOR_KEY = 'tiempos-forzar-num-desde-servidor-v1';

        (function limpiarDatosLocalesUnaVez() {
            try {
                const ya = localStorage.getItem(CLEAN_START_DONE_KEY);
                if (ya === '1') return;
                localStorage.removeItem(META_STORAGE_KEY_LEGACY);
                todasClavesMetaCampo_().forEach((k) => {
                    try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
                });
                localStorage.removeItem(DEMO_META_CAMPO_SEED_KEY);
                localStorage.removeItem(SYNC_QUEUE_KEY);
                localStorage.removeItem(SYNC_HISTORY_KEY);
                NUM_MUESTRA_LS_KEYS_A_PURGAR.forEach((k) => localStorage.removeItem(k));
                localStorage.setItem(CLEAN_START_DONE_KEY, '1');
            } catch (_) { /* ignore */ }
        }());

        /** N° muestra: nunca desde localStorage; solo memoria de esta sesión o servidor en vivo. */
        (function descartarCacheNumMuestraAlIniciar() {
            try {
                NUM_MUESTRA_LS_KEYS_A_PURGAR.forEach((k) => {
                    try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
                });
                if (sessionStorage.getItem(FORZAR_NUM_DESDE_SERVIDOR_KEY)) {
                    sessionStorage.removeItem(FORZAR_NUM_DESDE_SERVIDOR_KEY);
                }
            } catch (_) { /* ignore */ }
        }());

        (function initHeaderTipoRegistro() {
            const sel = document.getElementById('header-tipo-registro');
            if (!sel) return;
            const valid = [...sel.options].map((o) => o.value);
            const modoPagina = String(window.CAMPO_REGISTRO_MODO || 'visual').trim();
            const urlAcopio = modoPagina === 'acopio' ? './' : '../acopio/';
            const urlVisual = modoPagina === 'acopio' ? '../campo/' : './';
            try {
                const v = localStorage.getItem(HEADER_TIPO_REGISTRO_KEY);
                if (modoPagina === 'visual' && v === 'acopio') {
                    window.location.replace('../acopio/');
                    return;
                }
                if (modoPagina === 'acopio' && v === 'visual') {
                    window.location.replace('../campo/');
                    return;
                }
                if (v && valid.includes(v)) sel.value = v;
                else sel.value = modoPagina;
            } catch (e) { /* ignore */ }
            sel.addEventListener('change', () => {
                const v = sel.value;
                try {
                    localStorage.setItem(HEADER_TIPO_REGISTRO_KEY, v);
                } catch (e) { /* ignore */ }
                if (v === 'acopio' && modoPagina !== 'acopio') {
                    window.location.href = urlAcopio;
                } else if (v === 'visual' && modoPagina === 'acopio') {
                    window.location.href = urlVisual;
                }
            });
        }());

        function actualizarIconos() {
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }

        function inicializarFlatpickrInputs(root) {
            if (!(window.flatpickr && typeof window.flatpickr === 'function')) return;
            const scope = root || document;
            const localeEs = window.flatpickr?.l10ns?.es || 'es';

            // Hora se maneja con modal personalizado (sin flatpickr).

            scope.querySelectorAll('input[type="date"]').forEach((input) => {
                if (input.dataset.fpReady === '1') return;
                input.type = 'text';
                input.inputMode = 'numeric';
                input.placeholder = input.placeholder || 'YYYY-MM-DD';
                input.readOnly = true;
                input.classList.add('fp-input-date');
                const fpBase = window.FechaOperativa?.opcionesFlatpickrFechaOperativa?.(localeEs) || {
                    enableTime: false,
                    dateFormat: 'Y-m-d',
                    allowInput: false,
                    clickOpens: true,
                    disableMobile: true,
                    locale: localeEs,
                    static: false,
                    appendTo: document.body
                };
                window.flatpickr(input, {
                    ...fpBase,
                    onOpen: function (_selectedDates, _dateStr, instance) {
                        document.body.classList.add('fp-overlay-open');
                        window.FechaOperativa?.sincronizarFlatpickrRango?.(instance);
                    },
                    onClose: function () {
                        document.body.classList.remove('fp-overlay-open');
                    }
                });
                input.dataset.fpReady = '1';
            });
        }

        const timePickerState = {
            targetInput: null,
            hour: 0,
            minute: 0
        };

        function pad2_(n) { return String(Number(n) || 0).padStart(2, '0'); }

        function parseHHMM_(v) {
            const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})$/);
            if (!m) return null;
            const h = Number(m[1]);
            const mi = Number(m[2]);
            if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
            return { h, mi };
        }

        function normalizarEntradaHoraTeclado_(raw) {
            const digits = String(raw || '').replace(/\D/g, '').slice(0, 4);
            if (digits.length <= 2) return digits;
            return `${digits.slice(0, 2)}:${digits.slice(2)}`;
        }

        function sincronizarTimePickerEstadoDesdeEntrada_() {
            const cEl = document.getElementById('time-picker-current');
            if (!cEl) return false;
            const parsed = parseHHMM_(cEl.value) || parseHHMM_(normalizarEntradaHoraTeclado_(cEl.value));
            if (!parsed) return false;
            timePickerState.hour = parsed.h;
            timePickerState.minute = parsed.mi;
            return true;
        }

        function timePickerActualizarVista_() {
            const hEl = document.getElementById('time-picker-hour');
            const mEl = document.getElementById('time-picker-minute');
            const cEl = document.getElementById('time-picker-current');
            if (hEl) hEl.textContent = pad2_(timePickerState.hour);
            if (mEl) mEl.textContent = pad2_(timePickerState.minute);
            if (cEl && document.activeElement !== cEl) {
                const val = `${pad2_(timePickerState.hour)}:${pad2_(timePickerState.minute)}`;
                if (cEl.tagName === 'INPUT') cEl.value = val;
                else cEl.textContent = val;
            }
        }

        function configurarTimePickerEntradaTeclado_() {
            const cEl = document.getElementById('time-picker-current');
            if (!cEl || cEl.dataset.tpKb === '1') return;
            cEl.dataset.tpKb = '1';
            if (cEl.tagName === 'INPUT') {
                cEl.setAttribute('inputmode', 'numeric');
                cEl.setAttribute('autocomplete', 'off');
                cEl.setAttribute('spellcheck', 'false');
                if (!cEl.getAttribute('placeholder')) cEl.placeholder = 'HH:MM';
                if (!cEl.getAttribute('aria-label')) cEl.setAttribute('aria-label', 'Escribir hora');
                if (!cEl.title) cEl.title = 'Toca para escribir la hora con teclado';
            }
            const enfocarTexto = () => {
                if (cEl.tagName !== 'INPUT') return;
                try { cEl.select(); } catch (_) { /* ignore */ }
            };
            cEl.addEventListener('focus', enfocarTexto);
            cEl.addEventListener('click', enfocarTexto);
            if (cEl.tagName === 'INPUT') {
                cEl.addEventListener('input', () => {
                    const cur = cEl.value;
                    const norm = normalizarEntradaHoraTeclado_(cur);
                    if (cur !== norm) cEl.value = norm;
                    const parsed = parseHHMM_(norm);
                    if (parsed) {
                        timePickerState.hour = parsed.h;
                        timePickerState.minute = parsed.mi;
                        timePickerActualizarVista_();
                    }
                });
                cEl.addEventListener('blur', () => {
                    if (!sincronizarTimePickerEstadoDesdeEntrada_()) timePickerActualizarVista_();
                    else timePickerActualizarVista_();
                });
                cEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        sincronizarTimePickerEstadoDesdeEntrada_();
                        timePickerActualizarVista_();
                        cEl.blur();
                    }
                });
            }
        }

        function abrirTimePickerPersonalizado(input) {
            if (!input) return;
            const parsed = parseHHMM_(input.value);
            if (parsed) {
                timePickerState.hour = parsed.h;
                timePickerState.minute = parsed.mi;
            } else {
                const now = new Date();
                timePickerState.hour = now.getHours();
                timePickerState.minute = now.getMinutes();
            }
            timePickerState.targetInput = input;
            timePickerActualizarVista_();
            const overlay = document.getElementById('time-picker-modal-overlay');
            if (overlay) overlay.style.display = 'flex';
        }

        function cerrarTimePickerPersonalizado() {
            const overlay = document.getElementById('time-picker-modal-overlay');
            if (overlay) overlay.style.display = 'none';
        }

        function aplicarTimePickerPersonalizado() {
            const input = timePickerState.targetInput;
            sincronizarTimePickerEstadoDesdeEntrada_();
            if (!input) {
                cerrarTimePickerPersonalizado();
                return;
            }
            const val = `${pad2_(timePickerState.hour)}:${pad2_(timePickerState.minute)}`;
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            cerrarTimePickerPersonalizado();
        }

        function prepararCustomTimePickers(root) {
            const scope = root || document;
            scope.querySelectorAll('input[type="time"], input.fp-input-time').forEach((input) => {
                if (input.dataset.tpReady === '1') return;
                if (input.type !== 'time') input.classList.add('fp-input-time');
                input.type = 'text';
                input.readOnly = true;
                input.inputMode = 'none';
                input.placeholder = 'HH:MM';
                input.addEventListener('click', () => abrirTimePickerPersonalizado(input));
                input.addEventListener('focus', () => {
                    if (document.activeElement === input) input.blur();
                });
                input.dataset.tpReady = '1';
            });
        }

        async function defocusToBodySafe_() {
            const body = document.body;
            if (!body) return;
            const hadBodyTabindex = body.hasAttribute('tabindex');
            if (!hadBodyTabindex) body.setAttribute('tabindex', '-1');
            try {
                const active = document.activeElement;
                if (active && active !== body && typeof active.blur === 'function') active.blur();
            } catch (_) { /* ignore */ }
            // Reintenta un par de ticks por navegadores móviles que tardan en soltar foco.
            for (let i = 0; i < 3; i++) {
                try {
                    if (typeof body.focus === 'function') body.focus({ preventScroll: true });
                    const nowActive = document.activeElement;
                    if (nowActive === body) break;
                    if (nowActive && nowActive !== body && typeof nowActive.blur === 'function') nowActive.blur();
                } catch (_) { /* ignore */ }
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            if (!hadBodyTabindex) body.removeAttribute('tabindex');
        }

        async function swalFireSafe(options) {
            if (!(window.Swal && typeof window.Swal.fire === 'function')) return null;
            const incoming = options || {};
            const isToast = !!incoming.toast;
            const opts = Object.assign({}, incoming);
            if (!isToast) {
                await defocusToBodySafe_();
                opts.returnFocus = false;
            } else {
                // SweetAlert2 advierte si returnFocus se envía en toasts.
                delete opts.returnFocus;
            }
            return await window.Swal.fire(opts);
        }

        function mostrarAlertaRegla(titulo, texto) {
            if (window.Swal && typeof window.Swal.fire === 'function') {
                swalFireSafe({
                    icon: 'warning',
                    title: titulo,
                    text: texto,
                    confirmButtonText: 'Entendido'
                });
                return;
            }
            alert(texto);
        }

        function mostrarToast(icono, titulo, texto) {
            if (window.Swal && typeof window.Swal.fire === 'function') {
                swalFireSafe({
                    toast: true,
                    position: 'top-end',
                    icon: icono || 'info',
                    title: titulo || '',
                    text: texto || '',
                    showConfirmButton: false,
                    timer: 2600,
                    timerProgressBar: true
                });
                return;
            }
            if (texto) alert(texto);
        }

        let ultimoNumMuestraDuplicadoAlertado = '';
        async function alertarNumMuestraDuplicado(numMuestra) {
            const nm = String(numMuestra || '').trim();
            if (!nm) return 'keep';
            if (ultimoNumMuestraDuplicadoAlertado === nm) return 'keep';
            ultimoNumMuestraDuplicadoAlertado = nm;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                const resp = await swalFireSafe({
                    icon: 'warning',
                    title: 'N° muestra ya existe',
                    text: `El N° muestra "${nm}" ya está registrado. El sistema lo reasignará al enviar; si persiste, revisa conexión.`,
                    showDenyButton: true,
                    confirmButtonText: 'Entendido',
                    denyButtonText: 'No enviar',
                    allowOutsideClick: false
                });
                if (resp.isDenied) return 'cancel';
            } else {
                alert(`El N° muestra "${nm}" ya está registrado. El sistema lo reasignará al enviar.`);
            }
            establecerAcordeonMetaAbierto(true);
            return 'keep';
        }

        let offlineAlertShown = false;
        const OFFLINE_ALERT_TITULO = 'Atencion: modo offline';

        function cerrarAlertaModoOfflineSiAbierta() {
            if (!(window.Swal && typeof window.Swal.isVisible === 'function' && window.Swal.isVisible())) {
                return;
            }
            const tituloEl = document.querySelector('.swal2-title');
            const titulo = String(tituloEl?.textContent || '').trim();
            if (titulo === OFFLINE_ALERT_TITULO && typeof window.Swal.close === 'function') {
                try { window.Swal.close(); } catch (_) { /* ignore */ }
            }
        }

        function mostrarAlertaModoOffline() {
            if (offlineAlertShown) return;
            if (typeof navigator !== 'undefined' && navigator.onLine) return;
            offlineAlertShown = true;
            const texto = 'El sistema va a funcionar offline. Atencion y tener precaucion. Queda atento a todo.';
            if (window.Swal && typeof window.Swal.fire === 'function') {
                swalFireSafe({
                    icon: 'warning',
                    title: OFFLINE_ALERT_TITULO,
                    text: texto,
                    confirmButtonText: 'Entendido',
                    allowOutsideClick: false
                });
                return;
            }
            alert(texto);
        }

        function slugIdSeguro(valor) {
            return String(valor || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'na';
        }

        function mostrarMuestra(ensayo) {
            const texto = String(ensayo || '').trim();
            if (!texto) return 'Muestra --';
            return texto.replace(/^ensayo\s*/i, 'Muestra ');
        }

        function normalizarNumMuestraInput(v) {
            return String(v ?? '').trim().slice(0, NUM_MUESTRA_MAX_LEN);
        }

        function normalizarNumMuestraClave(v) {
            return String(v ?? '').trim().split('·')[0].trim().toUpperCase();
        }

        function mostrarToastSimpleInferior(texto, ms = 3200) {
            const id = 'simple-bottom-toast';
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.id = id;
                el.style.position = 'fixed';
                el.style.left = '50%';
                el.style.bottom = '18px';
                el.style.transform = 'translateX(-50%)';
                el.style.background = 'rgba(15, 23, 42, 0.96)';
                el.style.color = '#fff';
                el.style.padding = '10px 14px';
                el.style.borderRadius = '12px';
                el.style.fontSize = '13px';
                el.style.fontWeight = '600';
                el.style.boxShadow = '0 10px 24px rgba(2, 6, 23, 0.35)';
                el.style.zIndex = '99999';
                el.style.maxWidth = '92vw';
                el.style.textAlign = 'center';
                el.style.opacity = '0';
                el.style.transition = 'opacity 140ms ease';
                document.body.appendChild(el);
            }
            el.textContent = texto || 'Revisa los campos.';
            el.style.opacity = '1';
            clearTimeout(el.__hideTimer);
            el.__hideTimer = setTimeout(() => { el.style.opacity = '0'; }, Math.max(1200, ms));
        }

        function etiquetaFechaCampoParaAviso() {
            const day = String(document.getElementById('fecha-ring-day')?.textContent || '').trim();
            const month = String(document.getElementById('fecha-ring-month')?.textContent || '').trim();
            if (day && month && day !== '--') return `${day} ${month}`;
            return hoyIsoLocal();
        }

        /** Todas las muestras del selector (1–10) ya registradas hoy en planilla/cola. */
        function todasMuestrasCampoRegistradasHoy() {
            const sel = document.getElementById('visual-meta-muestra');
            if (!sel) return false;
            const opciones = [...sel.options].filter((o) => String(o.value || '').trim());
            if (!opciones.length) return false;
            return opciones.every((op) => {
                const num = numeroDesdeEnsayoTexto(op.value);
                return !!(num && ensayoNumeroRegistradoHoy(String(num)));
            });
        }

        function yaMostroAvisoLlenadoCompletoCampo(fechaClave) {
            try {
                const raw = localStorage.getItem(CAMPO_LLENADO_COMPLETO_AVISO_KEY);
                if (!raw) return false;
                const parsed = JSON.parse(raw);
                return String(parsed?.fecha || '') === String(fechaClave || '');
            } catch (_) {
                return false;
            }
        }

        function marcarAvisoLlenadoCompletoCampoMostrado(fechaClave) {
            try {
                localStorage.setItem(
                    CAMPO_LLENADO_COMPLETO_AVISO_KEY,
                    JSON.stringify({ fecha: String(fechaClave || ''), at: Date.now() })
                );
            } catch (_) { /* ignore */ }
        }

        function mostrarNubeAvisoLlenadoCompletoCampo() {
            const fechaClave = hoyIsoLocal();
            if (yaMostroAvisoLlenadoCompletoCampo(fechaClave)) return;
            if (document.getElementById('campo-nube-llenado-completo')) return;

            const fechaEtiqueta = etiquetaFechaCampoParaAviso();
            const el = document.createElement('div');
            el.id = 'campo-nube-llenado-completo';
            el.className = 'campo-nube-aviso';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = `
                <div class="campo-nube-aviso__inner">
                    <p class="campo-nube-aviso__titulo">¡Listo!</p>
                    <p class="campo-nube-aviso__texto">Se terminó el llenado para esta fecha (${fechaEtiqueta}). Gracias por tu comprensión.</p>
                    <button type="button" class="campo-nube-aviso__cerrar">Entendido</button>
                </div>
            `;
            document.body.appendChild(el);
            marcarAvisoLlenadoCompletoCampoMostrado(fechaClave);

            requestAnimationFrame(() => el.classList.add('is-visible'));

            const cerrar = () => {
                el.classList.remove('is-visible');
                el.classList.add('is-hiding');
                setTimeout(() => {
                    try { el.remove(); } catch (_) { /* ignore */ }
                }, 320);
            };
            el.querySelector('.campo-nube-aviso__cerrar')?.addEventListener('click', cerrar);
            clearTimeout(el.__autoHideTimer);
            el.__autoHideTimer = setTimeout(cerrar, 16000);
        }

        function evaluarAvisoLlenadoCompletoCampo() {
            if (!todasMuestrasCampoRegistradasHoy()) return;
            mostrarNubeAvisoLlenadoCompletoCampo();
        }

        function valorCampoRequerido(id) {
            if (id === 'visual-fecha-ring-widget') {
                const day = String(document.getElementById('fecha-ring-day')?.textContent || '').trim();
                const month = String(document.getElementById('fecha-ring-month')?.textContent || '').trim();
                return `${day}${month}`.trim();
            }
            const el = document.getElementById(id);
            if (!el) return '';
            if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? '1' : '';
            return String(el.value ?? '').trim();
        }

        function campoVacio(v) {
            return String(v ?? '').trim() === '';
        }

        function pesoVacio(v) {
            const n = Number(v);
            return !Number.isFinite(n) || n <= 0;
        }

        function jarraVaciaItem_(jarra) {
            if (jarra === '' || jarra === null || jarra === undefined) return true;
            const s = String(jarra).trim();
            if (s === '' || s === '-' || s === '—') return true;
            const n = Number(s);
            return !Number.isFinite(n) || n < 1;
        }

        /** '' = opción " - " (no aplica). null = valor inválido. número ≥ 1 = jarra. */
        function leerJarraSelectModal_(valorCrudo) {
            const raw = valorCrudo !== undefined
                ? valorCrudo
                : document.getElementById('visual-m-jarra')?.value;
            const s = String(raw ?? '').trim();
            if (s === '' || s === '-' || s === '—') return '';
            const n = Number(s);
            return Number.isFinite(n) && n >= 1 ? n : null;
        }

        function etiquetaJarraTarjeta_(item) {
            if (jarraVaciaItem_(item?.jarra)) return '—';
            const n = String(item?.jarra ?? '').trim();
            return n ? `Jarra ${n}` : '—';
        }

        function itemTienePesos123Acopio_(item, nClam) {
            if (!item) return false;
            return !pesoVacio(peso1EfectivoCampo(item, nClam))
                || !pesoVacio(item.p2)
                || !pesoVacio(item.acopio);
        }

        function textoPesoCampo(v) {
            if (pesoVacio(v)) return '00';
            return v + 'g';
        }

        function clasePesoCampo(v, base) {
            return (base || 'weight-value') + (pesoVacio(v) ? ' is-empty-peso' : '');
        }

        function valorPesoInput(v) {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? String(n) : '';
        }

        /** Temp, humedad y pesos: decimal con punto; ".5" → "0.5" (evita que Sheets interprete como fecha). */
        function decimalMedicionParaEnvio(v, decimales) {
            if (v === null || v === undefined || String(v).trim() === '') return '';
            let s = String(v).trim().replace(',', '.');
            if (s.charAt(0) === '.') s = '0' + s;
            const n = Number(s);
            if (!Number.isFinite(n)) return '';
            const d = Number.isFinite(decimales) ? decimales : 1;
            return n.toFixed(d);
        }

        function pesoStrOrEmpty(v) {
            if (pesoVacio(v)) return '';
            return decimalMedicionParaEnvio(v, 1);
        }

        /** Errores de cadena P1→P2→P3 (solo entre pesos con valor; grupos independientes de P4–P5). */
        function validarCadenaPesosOpcionalAcopio_(p1, p2, p3, nroClamshell) {
            const n = Number(nroClamshell) || 1;
            const p1Eff = clamshellUsaPeso1DesdePeso2(n) && !pesoVacio(p2) ? Number(p2) : Number(p1);
            const cadena = [];
            if (!pesoVacio(p1Eff)) cadena.push({ k: 'Peso 1', v: p1Eff });
            if (!pesoVacio(p2)) cadena.push({ k: 'Peso 2', v: Number(p2) });
            if (!pesoVacio(p3)) cadena.push({ k: 'Peso 3', v: Number(p3) });
            for (let i = 1; i < cadena.length; i++) {
                if (cadena[i].v > cadena[i - 1].v) {
                    return `${cadena[i].k} debe ser menor o igual a ${cadena[i - 1].k}.`;
                }
            }
            return '';
        }

        /** Peso 5 ≤ Peso 4 (sin relación con Pesos 1–3). */
        function validarPesos45Acopio_(p4, p5) {
            if (pesoVacio(p4) || pesoVacio(p5)) return '';
            if (Number(p5) > Number(p4)) {
                return 'Peso 5 debe ser menor o igual a Peso 4.';
            }
            return '';
        }

        function recolectarFaltantesCadenaPeso_(cadena, prefijo) {
            const faltantes = [];
            let ultimoIdx = -1;
            for (let i = cadena.length - 1; i >= 0; i--) {
                if (!pesoVacio(cadena[i].valor)) {
                    ultimoIdx = i;
                    break;
                }
            }
            if (ultimoIdx < 0) return faltantes;
            for (let i = 0; i <= ultimoIdx; i++) {
                if (pesoVacio(cadena[i].valor)) {
                    faltantes.push(`${prefijo}: ${cadena[i].etiqueta}`);
                }
            }
            return faltantes;
        }

        function cadenasPesoAcopioClamshell_(item, n) {
            const lbl = etiquetasPesoUiCampo_();
            return {
                grupo123: [
                    { etiqueta: lbl.cardP1, valor: peso1EfectivoCampo(item, n) },
                    { etiqueta: lbl.cardP2, valor: item?.p2 },
                    { etiqueta: lbl.cardP3, valor: item?.acopio }
                ],
                grupo45: [
                    { etiqueta: lbl.cardP4, valor: item?.p4 },
                    { etiqueta: lbl.cardP5, valor: item?.despacho }
                ]
            };
        }

        function cadenaPesoVisualClamshell_(item, n) {
            const lbl = etiquetasPesoUiCampo_();
            if (clamshellUsaPeso1DesdePeso2(n)) {
                return [
                    { etiqueta: lbl.cardP2, valor: item?.p2 },
                    { etiqueta: lbl.cardAcopio, valor: item?.acopio },
                    { etiqueta: lbl.cardDespacho, valor: item?.despacho }
                ];
            }
            return [
                { etiqueta: lbl.cardP1, valor: item?.p1 },
                { etiqueta: lbl.cardP2, valor: item?.p2 },
                { etiqueta: lbl.cardAcopio, valor: item?.acopio },
                { etiqueta: lbl.cardDespacho, valor: item?.despacho }
            ];
        }

        /**
         * Acopio: no exige huecos en modal; el orden solo aplica entre pesos con valor.
         * P4/P5 obligatorios se exigen solo al enviar (no al Guardar del modal).
         */
        function validarSecuenciaCompletaPesosAcopio_(/* item, n */) {
            return [];
        }

        /** Visual: no exige rellenar intermedios; solo orden entre valores capturados. */
        function validarSecuenciaCompletaPesosVisual_(/* item, n */) {
            return [];
        }

        /** Visual: cada peso con valor debe ser ≤ al anterior con valor (P1→P2→Llegada→Despacho). */
        function validarOrdenCadenaPesosVisual_(item, n) {
            const cadena = cadenaPesoVisualClamshell_(item, n);
            const vals = [];
            cadena.forEach((c) => {
                if (!pesoVacio(c.valor)) vals.push({ k: c.etiqueta, v: Number(c.valor) });
            });
            for (let i = 1; i < vals.length; i++) {
                if (vals[i].v > vals[i - 1].v) {
                    return `${vals[i].k} debe ser menor o igual a ${vals[i - 1].k}.`;
                }
            }
            return '';
        }

        function itemTieneAlgunPesoVisual_(item, n) {
            return cadenaPesoVisualClamshell_(item, n).some((c) => !pesoVacio(c.valor));
        }

        function erroresPesosVisualModal_(p1, p2, acopio, despacho, nro) {
            const item = { p1, p2, acopio, despacho };
            const msgOrden = validarOrdenCadenaPesosVisual_(item, nro);
            return msgOrden ? [msgOrden] : [];
        }

        function validarPesosVisualClamshell_(item, n) {
            const errs = [];
            if (!item || esClamshellSinDatos_(item)) return errs;
            const label = `Clamshell ${n}`;
            if (!itemTieneAlgunPesoVisual_(item, n)) {
                errs.push(`${label}: registra al menos un peso`);
            }
            const msgOrden = validarOrdenCadenaPesosVisual_(item, n);
            if (msgOrden) errs.push(`${label}: ${msgOrden}`);
            return errs;
        }

        function validarPesosVisualModalEnVivo() {
            if (esModoRegistroAcopio_()) return [];
            const itemEdit = editingCardId != null
                ? data.find((entry) => entry.id === editingCardId)
                : null;
            const nroModal = nroClamshellModalActual_(itemEdit);
            const p1 = Number(elInputPesoModalCampo_('p1')?.value || 0);
            const p2 = Number(elInputPesoModalCampo_('p2')?.value || 0);
            const acopio = Number(elInputPesoModalCampo_('acopio')?.value || 0);
            const despacho = Number(elInputPesoModalCampo_('despacho')?.value || 0);
            const errores = erroresPesosVisualModal_(p1, p2, acopio, despacho, nroModal);
            const alertEl = document.getElementById('visual-peso-alert');
            if (alertEl) {
                if (errores.length) {
                    alertEl.textContent = errores[0];
                    alertEl.style.display = 'block';
                } else {
                    alertEl.textContent = '';
                    alertEl.style.display = 'none';
                }
            }
            return errores;
        }

        /** Modal Acopio: solo orden entre inputs con data (sin exigir huecos). */
        function erroresPesosAcopioModal_(p1, p2, p3, p4, p5, nro) {
            return erroresOrdenPesosAcopio_(p1, p2, p3, p4, p5, nro);
        }

        function erroresOrdenPesosAcopio_(p1, p2, p3, p4, p5, nroClamshell) {
            const errs = [];
            const msgCadena = validarCadenaPesosOpcionalAcopio_(p1, p2, p3, nroClamshell);
            if (msgCadena) errs.push(msgCadena);
            const msg45 = validarPesos45Acopio_(p4, p5);
            if (msg45) errs.push(msg45);
            return errs;
        }

        function leerPesosDesdeModalAcopio_() {
            return {
                p1: Number(elInputPesoModalCampo_('p1')?.value || 0),
                p2: Number(elInputPesoModalCampo_('p2')?.value || 0),
                p3: Number(elInputPesoModalCampo_('acopio')?.value || 0),
                p4: Number(elInputPesoModalCampo_('p4')?.value || 0),
                p5: Number(elInputPesoModalCampo_('despacho')?.value || 0)
            };
        }

        function validarPesosAcopioModalEnVivo() {
            if (!esModoRegistroAcopio_()) return [];
            const itemEdit = editingCardId != null
                ? data.find((entry) => entry.id === editingCardId)
                : null;
            const nroModal = nroClamshellModalActual_(itemEdit);
            const pesos = leerPesosDesdeModalAcopio_();
            const errores = erroresPesosAcopioModal_(
                pesos.p1, pesos.p2, pesos.p3, pesos.p4, pesos.p5, nroModal
            );
            const alertEl = document.getElementById('acopio-peso-alert');
            if (alertEl) {
                if (errores.length) {
                    alertEl.textContent = errores[0];
                    alertEl.style.display = 'block';
                } else {
                    alertEl.textContent = '';
                    alertEl.style.display = 'none';
                }
            }
            return errores;
        }

        let validacionPesosModalCampoInit_ = false;
        function validarPesosModalCampoEnVivo() {
            if (esModoRegistroAcopio_()) return validarPesosAcopioModalEnVivo();
            return validarPesosVisualModalEnVivo();
        }

        function conectarValidacionPesosModalCampo_() {
            if (validacionPesosModalCampoInit_) return;
            validacionPesosModalCampoInit_ = true;
            ['p1', 'p2', 'acopio', 'p4', 'despacho'].forEach((campo) => {
                const inp = elInputPesoModalCampo_(campo);
                if (!inp) return;
                inp.addEventListener('input', validarPesosModalCampoEnVivo);
                inp.addEventListener('change', validarPesosModalCampoEnVivo);
            });
            const selJarra = document.getElementById('visual-m-jarra');
            if (selJarra) {
                selJarra.addEventListener('change', onCambioJarraModalAcopio_);
            }
        }

        /** Validación de pesos Acopio por clamshell (envío): P4/P5 obligatorios; orden solo si hay data. */
        function validarPesosAcopioClamshell_(item, n) {
            const errs = [];
            const label = `Clamshell ${n}`;
            if (pesoVacio(item?.p4)) errs.push(`${label}: Peso 4 · Clamshell calibrado`);
            if (pesoVacio(item?.despacho)) errs.push(`${label}: Peso 5 · Despacho campo`);
            const msg45 = validarPesos45Acopio_(item?.p4, item?.despacho);
            if (msg45) errs.push(`${label}: ${msg45}`);
            const msgCadena = validarCadenaPesosOpcionalAcopio_(
                item?.p1,
                item?.p2,
                item?.acopio,
                n
            );
            if (msgCadena) errs.push(`${label}: ${msgCadena}`);
            return errs;
        }

        /** Presión vapor (Kpa): siempre punto decimal y 3 cifras para el POST (servidor convierte a Number). */
        function presionStrParaEnvio(v) {
            if (v === null || v === undefined || String(v).trim() === '') return '';
            const n = Number(String(v).trim().replace(',', '.'));
            if (!Number.isFinite(n)) return '';
            return n.toFixed(3);
        }

        /** Visual: clamshell 5+ copia Peso 1 desde Peso 2. Acopio: los 5 pesos son editables en cada clamshell. */
        function clamshellUsaPeso1DesdePeso2(nroClamshell) {
            if (esModoRegistroAcopio_()) return false;
            return Number(nroClamshell) >= 5;
        }

        function peso1EfectivoCampo(item, nroClamshell) {
            const n = nroClamshell != null ? Number(nroClamshell) : numeroClamshellPorEnsayo(item);
            if (clamshellUsaPeso1DesdePeso2(n)) {
                const p2 = Number(item?.p2);
                if (Number.isFinite(p2) && p2 > 0) return p2;
            }
            return Number(item?.p1) || 0;
        }

        function nroClamshellModalActual_(item) {
            if (item) return numeroClamshellPorEnsayo(item);
            return listaClamshellsPorEnsayo_(obtenerEnsayoActivo()).length + 1;
        }

        function configurarModalPesosClamshell_(nroClamshell) {
            const inpP1 = elInputPesoModalCampo_('p1');
            const inpP2 = elInputPesoModalCampo_('p2');
            const inpAcopio = elInputPesoModalCampo_('acopio');
            const inpP4 = elInputPesoModalCampo_('p4');
            const inpDespacho = elInputPesoModalCampo_('despacho');
            if (esModoRegistroAcopio_()) {
                [inpP4, inpDespacho].forEach((inp) => {
                    if (inp) {
                        inp.disabled = false;
                        inp.removeAttribute('readonly');
                    }
                });
                aplicarEstadoPesos123ModalAcopioPorJarra_(nroClamshell);
                return;
            }
            const auto = clamshellUsaPeso1DesdePeso2(nroClamshell);
            if (inpP1) {
                inpP1.disabled = auto;
                inpP1.title = auto ? 'Se copia automáticamente desde Peso 2' : '';
                if (auto && inpP2) inpP1.value = inpP2.value;
            }
            [inpP2, inpAcopio, inpP4, inpDespacho].forEach((inp) => {
                if (inp) {
                    inp.disabled = false;
                    inp.removeAttribute('readonly');
                }
            });
        }

        /** Acopio: jarra " - " vacía y bloquea Pesos 1–3 (solo 4 y 5). */
        function aplicarEstadoPesos123ModalAcopioPorJarra_(nroClamshell) {
            if (!esModoRegistroAcopio_()) return;
            const inpP1 = elInputPesoModalCampo_('p1');
            const inpP2 = elInputPesoModalCampo_('p2');
            const inpAcopio = elInputPesoModalCampo_('acopio');
            const sinJarra = leerJarraSelectModal_() === '';
            const hint = 'No aplica con jarra " - " (solo Pesos 4 y 5)';
            if (sinJarra) {
                [inpP1, inpP2, inpAcopio].forEach((inp) => {
                    if (!inp) return;
                    inp.value = '';
                    inp.disabled = true;
                    inp.title = hint;
                });
                return;
            }
            if (inpP1) {
                inpP1.disabled = false;
                inpP1.title = '';
            }
            if (inpP2) {
                inpP2.disabled = false;
                inpP2.title = '';
            }
            if (inpAcopio) {
                inpAcopio.disabled = false;
                inpAcopio.title = '';
            }
            void nroClamshell;
        }

        function onCambioJarraModalAcopio_() {
            if (!esModoRegistroAcopio_()) return;
            const itemEdit = editingCardId != null
                ? data.find((entry) => entry.id === editingCardId)
                : null;
            aplicarEstadoPesos123ModalAcopioPorJarra_(nroClamshellModalActual_(itemEdit));
            validarPesosAcopioModalEnVivo();
        }

        function sincronizarPeso1DesdePeso2EnModal_() {
            const inpP1 = elInputPesoModalCampo_('p1');
            const inpP2 = elInputPesoModalCampo_('p2');
            if (!inpP1 || !inpP2 || !inpP1.disabled) return;
            inpP1.value = inpP2.value;
        }

        function valorCampoMetaEnsayo_(ensayo, id) {
            const clave = String(ensayo || 'Ensayo 1');
            if (id === 'visual-num-muestra') {
                return String(leerNumMuestraDesdePantalla(clave) || '').trim();
            }
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
            if (clave === activo) {
                if (id === 'visual-fecha-ring-widget') return hoyIsoLocal();
                if (id === 'visual-meta-muestra') return clave;
                if (id === 'visual-guia-acopio') {
                    return String(
                        ensayoMeta?.[clave]?.guiaRemision
                        || document.getElementById('visual-guia-acopio')?.value
                        || ''
                    ).trim();
                }
                if (id === 'visual-placa-vehiculo') {
                    return String(
                        ensayoMeta?.[clave]?.placaVehiculo
                        || document.getElementById('visual-placa-vehiculo')?.value
                        || ''
                    ).trim();
                }
                const live = valorCampoRequerido(id);
                if (live) return live;
            }
            const meta = metaPorEnsayo[clave] || {};
            if (id === 'visual-fecha-ring-widget') return hoyIsoLocal();
            if (id === 'visual-meta-muestra') return clave;
            if (id === 'visual-guia-acopio') {
                return String(
                    ensayoMeta?.[clave]?.guiaRemision
                    || meta['visual-guia-acopio']
                    || ''
                ).trim();
            }
            if (id === 'visual-placa-vehiculo') {
                return String(
                    ensayoMeta?.[clave]?.placaVehiculo
                    || meta['visual-placa-vehiculo']
                    || ''
                ).trim();
            }
            return String(meta[id] ?? '').trim();
        }

        function recolectarFaltantesEnvio(ensayoObjetivo) {
            const faltantes = [];
            const metaIds = [
                'visual-meta-muestra',
                'visual-num-muestra',
                'visual-responsable',
                'visual-hora',
                'visual-meta-fundo',
                'visual-traz-etapa',
                'visual-traz-campo',
                'visual-traz-turno',
                'visual-traz-acopio',
                'visual-meta-variedad',
                'visual-fecha-ring-widget',
                'visual-guia-acopio',
                'visual-placa-vehiculo'
            ];
            const ensayo = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1');
            metaIds.forEach((id) => {
                if (id === 'visual-num-muestra') {
                    if (!numMuestraValidoParaEnvioEnsayo(ensayo)) {
                        faltantes.push(etiquetaCampoRequerido(id));
                    }
                    return;
                }
                if (campoVacio(valorCampoMetaEnsayo_(ensayo, id))) faltantes.push(etiquetaCampoRequerido(id));
            });
            const items = data
                .filter((it) => String(it?.ensayo || 'Ensayo 1') === String(ensayo))
                .slice()
                .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
            if (!items.length) {
                faltantes.push('Agregar al menos un clamshell');
                return faltantes;
            }

            const keysTiempo = keysTiempoValidacionCampo_();
            const keysTemp = ['inicioAmbiente', 'inicioPulpa', 'terminoAmbiente', 'terminoPulpa', 'llegadaAmbiente', 'llegadaPulpa', 'despachoAmbiente', 'despachoPulpa'];
            const keysHum = ['inicio', 'termino', 'llegada', 'despacho'];
            const keysPresAmb = ['presionAmbienteInicio', 'presionAmbienteTermino', 'presionAmbienteLlegada', 'presionAmbienteDespacho'];
            const keysPresFru = ['presionFrutaInicio', 'presionFrutaTermino', 'presionFrutaLlegada', 'presionFrutaDespacho'];
            const primer = items[0] || null;

            items.forEach((item, idx) => {
                const n = idx + 1;
                // Jarra " - " es válida (sin data de llenado). Solo Acopio exige jarra si hay Pesos 1–3.
                if (esModoRegistroAcopio_() && jarraVaciaItem_(item?.jarra) && itemTienePesos123Acopio_(item, n)) {
                    faltantes.push(`Clamshell ${n}: N° jarra`);
                }
                if (esModoRegistroAcopio_()) {
                    validarPesosAcopioClamshell_(item, n).forEach((e) => faltantes.push(e));
                } else {
                    validarPesosVisualClamshell_(item, n).forEach((e) => faltantes.push(e));
                }

                const t = item?.metric?.tiempo || {};
                // Regla operativa: tiempos se capturan en el clamshell líder (primero) y se replican.
                if (idx === 0) {
                    if (keysTiempo.some((k) => campoVacio(t[k]))) {
                    faltantes.push('Tiempos de la muestra (Clamshell líder)');
                    } else {
                        validarSecuenciaTiempoMetrica(t).forEach((e) => faltantes.push(e));
                    }
                }
            });

            // Temperatura y presiones se gestionan global por muestra: validar solo en clamshell líder.
            const tempGlobal = primer?.metric?.temperatura || {};
            if (keysTemp.some((k) => campoVacio(tempGlobal[k]))) {
                faltantes.push('Temperatura global (ambiente/pulpa)');
            }
            // Aunque se calculen automáticamente, deben existir para considerar completo el ensayo.
            if (keysPresAmb.some((k) => campoVacio(tempGlobal[k]))) {
                faltantes.push('Presión vapor ambiente (global)');
            }
            if (keysPresFru.some((k) => campoVacio(tempGlobal[k]))) {
                faltantes.push('Presión vapor fruta (global)');
            }

            // Humedad es global para todos: validar una sola vez en el clamshell líder.
            const humGlobal = primer?.metric?.humedad || {};
            if (keysHum.some((k) => campoVacio(humGlobal[k]))) {
                faltantes.push('Humedad global');
            }
            return [...new Set(faltantes)];
        }

        function numMuestraValidoParaEnvioEnsayo(ensayo) {
            const clave = String(ensayo || '').trim();
            if (!clave || ensayoEstaRegistradoHoy(clave)) return true;
            const n = String(leerNumMuestraDesdePantalla(clave) || '').trim();
            if (n) return true;
            return !!String(calcularNumMuestraBaseDesdeContexto(clave) || '').trim();
        }

        function ensayosCandidatosConDatosCampo() {
            const set = new Set();
            data.forEach((it) => {
                const e = String(it?.ensayo || 'Ensayo 1').trim();
                if (e) set.add(e);
            });
            listarEnsayosEnCursoOrdenados().forEach((e) => {
                if (ensayoTieneCapturaOCompletoCampo_(e)) set.add(e);
            });
            Object.keys(metaPorEnsayo || {}).forEach((e) => {
                if (
                    metaEnsayoCompletaParaOrden(e)
                    || ensayoMetaTieneDatosTrabajo(e)
                    || data.some((it) => String(it?.ensayo || '') === e)
                ) {
                    set.add(e);
                }
            });
            return ordenarEnsayosPorNumeroMuestra(
                [...set].filter((e) => e && !ensayoEstaRegistradoHoy(e))
            );
        }

        function obtenerEnsayosCompletosParaEnvio() {
            return ensayosCandidatosConDatosCampo()
                .filter((ensayo) => recolectarFaltantesEnvio(ensayo).length === 0);
        }

        const ETIQUETAS_META_CAMPO = {
            'visual-meta-muestra': 'Muestra',
            'visual-num-muestra': 'N° muestra',
            'visual-responsable': 'Responsable',
            'visual-hora': 'Hora inicio',
            'visual-meta-fundo': 'Fundo',
            'visual-traz-etapa': 'Etapa',
            'visual-traz-campo': 'Campo',
            'visual-traz-turno': 'Turno',
            'visual-traz-acopio': 'Acopio',
            'visual-meta-variedad': 'Variedad',
            'visual-guia-acopio': 'N° guía despacho',
            'visual-placa-vehiculo': 'N° placa camioneta',
            'visual-fecha-ring-widget': 'Fecha'
        };

        function etiquetaCampoRequerido(id) {
            if (ETIQUETAS_META_CAMPO[id]) return ETIQUETAS_META_CAMPO[id];
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) {
                const txt = String(lbl.textContent || '').replace(/\s+/g, ' ').trim();
                if (txt) return txt;
            }
            const el = document.getElementById(id);
            const aria = el?.getAttribute('aria-label');
            if (aria) return String(aria).trim();
            return id;
        }

        /** Escribe meta demo en inputs y repuebla selects de catálogo (etapa/campo/variedad). */
        function aplicarMetaDemoEnFormularioCampo_(metaDemo, ensayo) {
            escribirMetaFormulario(metaDemo, ensayo);
            if (typeof window.aplicarParcelaCampoDesdeMeta === 'function') {
                window.aplicarParcelaCampoDesdeMeta(metaDemo);
            } else if (typeof window.refrescarSelectsCatalogoCampo === 'function') {
                window.refrescarSelectsCatalogoCampo();
            }
            actualizarBloqueoTrazabilidadPorFundo();
            asegurarOpcionesSelectAcopio(metaDemo['visual-traz-acopio']);
            sincronizarTrazabilidadCompuesta();
            sincronizarChipsDesdeAlmacenamiento();
            snapshotMetaEnsayoActual(ensayo);
            metaActivoEnsayo = ensayo;
        }

        async function mostrarFaltantesEnvioCampo_(faltantes, titulo) {
            const lista = Array.isArray(faltantes) ? faltantes.filter(Boolean) : [];
            if (!lista.length) return;
            const top = lista.slice(0, 12);
            const extra = Math.max(0, lista.length - top.length);
            const listHtml = top.map((txt) => `
                <li class="swal-campos-item">
                    <span class="swal-campos-dot"></span>
                    <span class="swal-campos-item-text">${txt}</span>
                </li>
            `).join('');
            const extraHtml = extra > 0
                ? `<div style="margin-top:8px;font-size:12px;color:#64748b;">... y ${extra} campo(s) más</div>`
                : '';
            const tituloFinal = titulo || `Campos incompletos (${lista.length})`;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireSafe({
                    icon: 'warning',
                    title: tituloFinal,
                    html: `
                        <div class="swal-campos-wrap">
                            <div class="swal-campos-head">
                                Completa estos campos antes de enviar
                            </div>
                            <ul class="swal-campos-list">
                                ${listHtml}
                            </ul>
                            <div class="swal-campos-foot">
                                ${extraHtml || '<span>Todo campo debe tener dato para continuar.</span>'}
                            </div>
                        </div>
                    `,
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
            } else {
                const texto = `${tituloFinal}\n- ${top.join('\n- ')}${extra > 0 ? `\n... y ${extra} más` : ''}`;
                alert(texto);
            }
        }

        async function validarCamposRequeridosAntesDeEnviar(ensayoObjetivo) {
            const faltantes = recolectarFaltantesEnvio(ensayoObjetivo);
            if (!faltantes.length) return true;
            actualizarErroresMetaFormularioCore();
            establecerAcordeonMetaAbierto(true);
            await mostrarFaltantesEnvioCampo_(faltantes);
            return false;
        }

        function descripcionMuestraConNumero(ensayo) {
            const claveEnsayo = String(ensayo || 'Ensayo 1');
            const numero = String(leerNumMuestraDesdePantalla(claveEnsayo) || '').trim() || '--';
            return `${mostrarMuestra(claveEnsayo)} · N°: ${numero}`;
        }

        function asegurarIdsInputsDinamicos(root, prefijo) {
            if (!root) return;
            const base = slugIdSeguro(prefijo);
            root.querySelectorAll('input:not([id])').forEach((input, idx) => {
                const key = input.getAttribute('data-metric')
                    || input.getAttribute('data-ensayo-placa')
                    || input.getAttribute('data-ensayo-guia')
                    || input.name
                    || input.className
                    || input.type
                    || 'campo';
                input.id = `${base}-${slugIdSeguro(key)}-${idx + 1}`;
            });
        }

        function actualizarVistaCompacta() {
            const ensayoVista = ensayoDesdeFormulario();
            const nMuestra = String(
                leerNumMuestraDesdePantalla(ensayoVista)
                || document.getElementById('visual-num-muestra')?.value?.trim()
                || ''
            );
            const muestra = document.getElementById('visual-meta-muestra')?.value?.trim() ?? '';
            const t = trazabilidadBaseDesdeMeta(leerMetaFormulario());
            const pNum = document.getElementById('preview-num');
            const pMuestra = document.getElementById('preview-muestra');
            const pTraz = document.getElementById('preview-traz');
            const muestraTexto = muestra ? String(muestra).replace(/^Ensayo\s*/i, 'Muestra ') : '';
            if (pNum) {
                pNum.textContent = `N° ${nMuestra || '--'}`;
                pNum.classList.toggle('meta-preview-pill--empty', !nMuestra);
            }
            if (pMuestra) {
                pMuestra.textContent = muestraTexto || '--';
                pMuestra.classList.toggle('meta-preview-pill--empty', !muestraTexto);
            }
            if (pTraz) {
                pTraz.textContent = t || '--';
                pTraz.classList.toggle('meta-preview-pill--empty', !t);
            }
        }

        function trazabilidadBaseDesdeMeta(meta) {
            const m = meta || {};
            const compuesto = String(m['visual-trazabilidad'] || '').trim();
            if (compuesto && !compuesto.includes(' / ')) return compuesto;
            const etapa = String(m['visual-traz-etapa'] || '').trim();
            const campo = String(m['visual-traz-campo'] || '').trim();
            const turno = String(m['visual-traz-turno'] || '').trim();
            const partes = [etapa, campo, turno].filter(Boolean);
            return partes.length ? partes.join('-') : '';
        }

        /** Solo visual (preview/PDF): E-C-T / Acopio N. No se envía a planilla. */
        function trazabilidadTextoMostrar(meta) {
            const base = trazabilidadBaseDesdeMeta(meta);
            const acopio = String(meta?.['visual-traz-acopio'] || '').trim();
            if (base && acopio) return `${base} / ${acopio}`;
            return base || acopio || '';
        }

        function sincronizarTrazabilidadCompuesta() {
            const etapaEl = document.getElementById('visual-traz-etapa');
            const campoEl = document.getElementById('visual-traz-campo');
            const turnoEl = document.getElementById('visual-traz-turno');
            if (!etapaEl || !campoEl || !turnoEl) return;
            const etapa = etapaEl.value?.trim() ?? '';
            const campo = campoEl.value?.trim() ?? '';
            const turno = turnoEl.value?.trim() ?? '';
            const traz = [etapa, campo, turno].filter(Boolean).join('-');
            const hidden = document.getElementById('visual-trazabilidad');
            if (hidden) hidden.value = traz;
        }

        function actualizarBloqueoTrazabilidadPorFundo() {
            const fundoEl = document.getElementById('visual-meta-fundo');
            const etapaEl = document.getElementById('visual-traz-etapa');
            const campoEl = document.getElementById('visual-traz-campo');
            const turnoEl = document.getElementById('visual-traz-turno');
            const variedadEl = document.getElementById('visual-meta-variedad');
            if (!fundoEl || !etapaEl || !campoEl || !turnoEl) return;
            const habilitado = String(fundoEl.value || '').trim() !== '';
            [etapaEl, campoEl, turnoEl].forEach((el) => {
                el.disabled = !habilitado;
            });
            if (!habilitado) {
                etapaEl.value = '';
                campoEl.value = '';
                turnoEl.value = '';
                if (variedadEl) variedadEl.value = '';
                sincronizarTrazabilidadCompuesta();
            }
            if (typeof window.aplicarFiltrosParcelaCampo === 'function') {
                window.aplicarFiltrosParcelaCampo();
            } else if (variedadEl) {
                variedadEl.disabled = !habilitado;
            }
        }

        function establecerAcordeonMetaAbierto(open) {
            if (!metaAccordion || !metaAccordionTrigger || !metaAccordionPanel) return;
            // Evita warning ARIA: no cerrar un contenedor aria-hidden con foco dentro.
            if (!open) {
                const active = document.activeElement;
                if (active && metaAccordionPanel.contains(active) && typeof active.blur === 'function') {
                    active.blur();
                }
            }
            metaAccordion.classList.toggle('is-open', open);
            metaAccordionTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            metaAccordionPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }

        metaAccordionTrigger?.addEventListener('click', () => {
            establecerAcordeonMetaAbierto(!metaAccordion?.classList.contains('is-open'));
        });

        let metaPorEnsayo = {};
        let metaActivoEnsayo = 'Ensayo 1';
        const ensayoMeta = {};
        let ensayoActivo = 'Ensayo 1';
        /** Muestras que el operador usa en esta sesión (1 y 4 → N° base+0 y base+1, no 01 y 04). */
        let ensayosActivadosSesion = new Set();
        /** Último max y próximo N° devueltos por Apps Script (fuente de verdad con internet). */
        let numMuestraMaxServidorCache = 0;
        let numMuestraPrefijoCache = '';
        let proximoNumMuestraServidorCache = '';
        /** true tras el primer estado_operativo OK: el N° muestra sale del servidor, no del localStorage. */
        let numMuestraSincronizadoServidor = false;
        let numMuestraLoaderCount = 0;
        let sincronizacionNumMuestraTimer = null;
        /** true = logs detallados en consola (F12). Dejar en false en uso normal. */
        const DEBUG_NUM_MUESTRA = false;
        let ultimoRefreshServidorOperativoMs = 0;
        const REFRESH_SERVIDOR_MIN_MS = 10000;
        const POLL_SERVIDOR_VISIBLE_MS = 35000;
        let ultimaFirmaEstadoServidor = '';
        let ultimoMaxPlanillaConocido = 0;
        let ultimoToastPlanillaSyncMs = 0;
        let ultimaRespuestaEstadoServidor = null;
        let bloqueoMuestraRefrescando = false;
        let bloqueoMuestraUltimoFetchMs = 0;
        let bloqueoMuestraCacheNums = null;
        /** N° asignado por muestra en esta sesión (no recalcular tras cada envío). */
        const numerosMuestraFijadosSesion = {};
        /** Debe declararse antes de leerNumMuestraDesdePantalla (arranque temprano). */
        let envioRegistroEnCurso = false;

        function logNumMuestra(etapa, extra) {
            if (!DEBUG_NUM_MUESTRA && !window.__DEBUG_NUM_MUESTRA_OVERRIDE__) return;
            const inp = document.getElementById('visual-num-muestra');
            console.log('[NUM_MUESTRA]', etapa, {
                ...(extra && typeof extra === 'object' ? extra : { detalle: extra }),
                max_en_memoria: numMuestraMaxServidorCache,
                proximo_en_memoria: proximoNumMuestraServidorCache,
                sincronizado_servidor: numMuestraSincronizadoServidor,
                valor_input: inp ? inp.value : '',
                online: navigator.onLine,
                muestra_activa: metaActivoEnsayo || ensayoDesdeFormulario()
            });
        }

        function dumpNumMuestraEstado() {
            logNumMuestra('DUMP manual', {});
            return {
                max_en_memoria: numMuestraMaxServidorCache,
                proximo_en_memoria: proximoNumMuestraServidorCache,
                sincronizado_servidor: numMuestraSincronizadoServidor,
                valor_input: document.getElementById('visual-num-muestra')?.value
            };
        }
        window.dumpNumMuestraEstado = dumpNumMuestraEstado;
        window.activarLogNumMuestra = (on = true) => {
            window.__DEBUG_NUM_MUESTRA_OVERRIDE__ = !!on;
            console.log('[NUM_MUESTRA] logs', on ? 'activados' : 'desactivados', '(recarga opcional)');
        };

        function purgarCacheNumMuestraLocalStorage() {
            try {
                NUM_MUESTRA_LS_KEYS_A_PURGAR.forEach((k) => localStorage.removeItem(k));
            } catch (_) { /* ignore */ }
        }

        function leerNumMuestraDesdePantalla(ensayo) {
            const e = String(ensayo || metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1').trim() || 'Ensayo 1';
            // Solo durante envío se respeta el N° congelado (evita 94 “pegado” en UI/PDF).
            if (envioRegistroEnCurso) {
                const fijadoEnvio = numerosMuestraFijadosSesion[e];
                if (fijadoEnvio) return fijadoEnvio;
            }
            const calc = calcularNumMuestraDesdeServidorParaEnsayo(e);
            if (calc) return calc;
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
            if (e === activo) {
                const dom = normalizarNumMuestraInput(document.getElementById('visual-num-muestra')?.value);
                if (dom) return dom;
            }
            return normalizarNumMuestraInput(metaPorEnsayo[e]?.['visual-num-muestra']) || '';
        }

        /** Solo pantalla: N° desde servidor (estado_operativo); nunca localStorage ni borrador. */
        function sincronizarNumMuestraPantallaDesdeServidor() {
            const activo = metaActivoEnsayo || ensayoDesdeFormulario();
            if (!activo) return;
            const num = calcularNumMuestraDesdeServidorParaEnsayo(activo);
            const inp = document.getElementById('visual-num-muestra');
            if (!num) {
                if (inp && navigator.onLine && API_URL && inp.value !== '') inp.value = '';
                actualizarVistaCompacta();
                return;
            }
            const actual = normalizarNumMuestraInput(inp?.value);
            if (actual === num) {
                actualizarVistaCompacta();
                return;
            }
            purgarTodosNumerosMuestraEnMeta();
            logNumMuestra('sincronizarNumMuestraPantallaDesdeServidor', { ensayo: activo, calculado: num });
            aplicarNumMuestraEnsayo(activo, num, false, 'sincronizarNumMuestraPantallaDesdeServidor');
        }

        function reiniciarNumeracionParaConsultaServidor() {
            if (!navigator.onLine || !API_URL) return;
            logNumMuestra('reiniciarNumeracionParaConsultaServidor', { motivo: 'vaciar hasta leer planilla' });
            numMuestraSincronizadoServidor = false;
            proximoNumMuestraServidorCache = '';
            numMuestraMaxServidorCache = 0;
            numMuestraPrefijoCache = '';
            purgarCacheNumMuestraLocalStorage();
            purgarTodosNumerosMuestraEnMeta();
            const inp = document.getElementById('visual-num-muestra');
            if (inp) inp.value = '';
        }

        /** N° muestra no se persiste en meta: siempre planilla + 1 (o caché solo offline). */
        function purgarTodosNumerosMuestraEnMeta() {
            Object.keys(metaPorEnsayo).forEach((k) => {
                if (!metaPorEnsayo[k]) return;
                delete metaPorEnsayo[k]['visual-num-muestra'];
                delete metaPorEnsayo[k]._num_muestra_fijo;
            });
        }

        function clonarMetaPorEnsayoSinNumeros(src) {
            const out = {};
            Object.keys(src || {}).forEach((k) => {
                const copy = { ...(src[k] || {}) };
                delete copy['visual-num-muestra'];
                delete copy._num_muestra_fijo;
                out[k] = copy;
            });
            return out;
        }

        function limpiarNumerosMuestraLocalesNoRegistrados() {
            purgarTodosNumerosMuestraEnMeta();
        }

        function aplicarNumeroMuestraDesdePlanilla(ensayo) {
            sincronizarNumMuestraPantallaDesdeServidor();
        }

        function setNumMuestraCargando(activo) {
            if (activo) numMuestraLoaderCount++;
            else numMuestraLoaderCount = Math.max(0, numMuestraLoaderCount - 1);
            const wrap = document.getElementById('visual-num-muestra-wrap');
            if (wrap) {
                wrap.classList.toggle('is-loading', numMuestraLoaderCount > 0);
                wrap.setAttribute('aria-busy', numMuestraLoaderCount > 0 ? 'true' : 'false');
            }
            actualizarHintNumMuestraPantalla();
        }

        function actualizarHintNumMuestraPantalla() {
            const inp = document.getElementById('visual-num-muestra');
            if (!inp) return;
            if (normalizarNumMuestraInput(inp.value)) {
                inp.placeholder = 'Automático';
                return;
            }
            if (numMuestraLoaderCount > 0) {
                inp.placeholder = 'Leyendo planilla…';
                return;
            }
            if (navigator.onLine && API_URL && !numMuestraSincronizadoServidor) {
                inp.placeholder = 'Sin planilla';
                return;
            }
            inp.placeholder = 'Automático';
        }

        let ultimoAvisoFalloNumMuestraMs = 0;
        function avisarFalloSincronizacionNumMuestra(origen) {
            actualizarHintNumMuestraPantalla();
            if (!navigator.onLine || !API_URL || numMuestraSincronizadoServidor) return;
            const ahora = Date.now();
            if (ahora - ultimoAvisoFalloNumMuestraMs < 12000) return;
            ultimoAvisoFalloNumMuestraMs = ahora;
            mostrarToast(
                'warning',
                'N° muestra',
                'No se pudo leer la planilla. Despliega code.gs en Apps Script (Implementar → Nueva implementación) o pulsa ↻ en el menú flotante.'
            );
            logNumMuestra('avisarFalloSincronizacionNumMuestra', { origen: origen || '(sin origen)' });
        }

        function contarMuestrasAnterioresEnSecuencia(numeroDestino) {
            const destino = Number(numeroDestino) || 1;
            let n = 0;
            for (let m = 1; m < destino; m++) {
                if (ensayoNumeroRegistradoHoy(String(m))) continue;
                if (muestraEstaEnSecuenciaLlenado(m)) n++;
            }
            return n;
        }

        function fijarNumMuestraEnsayoSesion(ensayo, num, origen) {
            const e = String(ensayo || '').trim();
            const t = normalizarNumMuestraInput(num);
            if (!e || !t) return '';
            numerosMuestraFijadosSesion[e] = t;
            aplicarNumMuestraEnsayo(e, t, true, origen || 'fijarNumMuestraEnsayoSesion');
            return t;
        }

        async function precongelarNumerosMuestraParaEnvio(ensayos) {
            const lista = ordenarEnsayosPorNumeroMuestra(ensayos);
            if (!lista.length) return;
            if (navigator.onLine && API_URL) {
                await refrescarEstadoServidorOperativo(true);
            } else {
                refrescarEstadoOperativoLocal();
            }
            lista.forEach((ensayo) => {
                const ya = numerosMuestraFijadosSesion[ensayo];
                if (ya) return;
                const num = ensayoEstaRegistradoHoy(ensayo)
                    ? calcularNumMuestraLoteAdicionalEnsayoRegistrado_(ensayo)
                    : calcularNumMuestraDesdeServidorParaEnsayo(ensayo);
                if (num) fijarNumMuestraEnsayoSesion(ensayo, num, 'precongelarEnvio');
            });
        }

        function aplicarNumMuestraParaEnsayoActivo(origen) {
            const e = String(metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1').trim() || 'Ensayo 1';
            const num = calcularNumMuestraDesdeServidorParaEnsayo(e);
            if (num) aplicarNumMuestraEnsayo(e, num, false, origen || 'aplicarNumMuestraParaEnsayoActivo');
            return num;
        }

        /** Cambio de muestra: vacía/carga meta al instante; N° sube en orden (8206, 8207…). */
        function aplicarCambioMuestraRapido(ensayo) {
            const e = String(ensayo || '').trim() || 'Ensayo 1';
            metaActivoEnsayo = e;
            asegurarMetaEnsayoSinDatosFantasma_(e);
            if (!metaPorEnsayo[e]) {
                metaPorEnsayo[e] = metaPlantillaVaciaEnsayo_(e);
            }
            cargarMetaDeEnsayo(e);
            aplicarCambioEnsayoActivo();

            const pintarNum = () => {
                aplicarNumMuestraParaEnsayoActivo('cambioMuestraRapido');
                actualizarVistaCompacta();
                actualizarProgresoMeta();
            };

            if (!navigator.onLine || !API_URL) {
                refrescarEstadoOperativoLocal();
                pintarNum();
                aplicarBloqueoMuestrasCacheLocal();
                return;
            }

            pintarNum();
            setNumMuestraCargando(true);
            void refrescarEstadoServidorOperativo(false, {
                reposicionarPrimera: false,
                avisar: false,
                invalidarFijados: false
            }).then((ok) => {
                const activo = ensayoDesdeFormulario();
                if (activo === e) {
                    if (ok) limpiarNumerosMuestraLocalesNoRegistrados();
                    pintarNum();
                }
            }).finally(() => {
                setNumMuestraCargando(false);
            });
            aplicarBloqueoMuestrasCacheLocal();
        }

        function sincronizarMaxNumMuestraDesdeContextoLocal() {
            // Online + planilla leída: no subir el max con basura local (causa saltos de N°).
            if (numMuestraSincronizadoServidor && navigator.onLine && API_URL) {
                const maxCola = (() => {
                    let m = numMuestraMaxServidorCache;
                    try {
                        cargarColaSync().forEach((reg) => {
                            const st = String(reg?.estado || '');
                            if (st !== 'pendiente' && st !== 'bloqueado') return;
                            const k = parseNumMuestraSoloDigitos(reg?.num_muestra);
                            if (k > m) m = k;
                        });
                    } catch (_) { /* ignore */ }
                    return m;
                })();
                if (maxCola > numMuestraMaxServidorCache) {
                    numMuestraMaxServidorCache = maxCola;
                }
                proximoNumMuestraServidorCache = formatearNumMuestraAutoDesdeN(
                    (Number(numMuestraMaxServidorCache) || 0) + 1
                );
                return;
            }
            const maxCtx = leerMaxNumericoNumMuestraTodoContexto();
            if (maxCtx > numMuestraMaxServidorCache) {
                logNumMuestra('sincronizarMaxNumMuestraDesdeContextoLocal', {
                    max_antes: numMuestraMaxServidorCache,
                    max_despues: maxCtx
                });
                numMuestraMaxServidorCache = maxCtx;
            }
            if (maxCtx > 0) {
                proximoNumMuestraServidorCache = formatearNumMuestraAutoDesdeN(maxCtx + 1);
            }
        }

        function invalidarNumerosMuestraFijadosObsoletos() {
            Object.keys(numerosMuestraFijadosSesion).forEach((ensayo) => {
                if (ensayoEstaRegistradoHoy(ensayo)) {
                    delete numerosMuestraFijadosSesion[ensayo];
                    return;
                }
                const calc = calcularNumMuestraBaseDesdeContexto(ensayo);
                const fij = numerosMuestraFijadosSesion[ensayo];
                if (!fij || parseNumMuestraSoloDigitos(fij) !== parseNumMuestraSoloDigitos(calc)) {
                    delete numerosMuestraFijadosSesion[ensayo];
                }
            });
        }

        function fusionarMaxNumMuestraCampo(n) {
            if (navigator.onLine && API_URL) return;
            const k = parseNumMuestraSoloDigitos(n);
            if (k > numMuestraMaxServidorCache) {
                numMuestraMaxServidorCache = k;
            }
            sincronizarMaxNumMuestraDesdeContextoLocal();
            invalidarNumerosMuestraFijadosObsoletos();
        }

        function leerMaxDesdeNumMuestraUsadosLocal() {
            let maxN = 0;
            try {
                const map = cargarNumMuestraUsadosLocal();
                Object.keys(map).forEach((clave) => {
                    const k = parseNumMuestraSoloDigitos(clave);
                    if (k > maxN) maxN = k;
                });
            } catch (_) { /* ignore */ }
            return maxN;
        }

        function ensayoDesdeFormulario() {
            const muestra = document.getElementById('visual-meta-muestra')?.value?.trim();
            const rotulo = document.getElementById('visual-rotulo')?.value?.trim();
            return muestra || rotulo || metaActivoEnsayo || 'Ensayo 1';
        }

        function leerMetaFormulario() {
            const o = {};
            META_SAVE_IDS.forEach((id) => {
                const el = document.getElementById(id);
                if (el) o[id] = el.value;
            });
            return o;
        }

        function metaPlantillaVaciaEnsayo_(ensayo) {
            const e = String(ensayo || 'Ensayo 1').trim() || 'Ensayo 1';
            const o = { 'visual-meta-muestra': e, 'visual-rotulo': e };
            META_SAVE_IDS.forEach((id) => {
                if (id === 'visual-meta-muestra' || id === 'visual-rotulo') return;
                o[id] = '';
            });
            return o;
        }

        function asegurarMetaEnsayoSinDatosFantasma_(ensayo) {
            const e = String(ensayo || '').trim();
            if (!e || ensayoEstaRegistradoHoy(e)) return;
            const meta = metaPorEnsayo[e];
            if (!meta) {
                metaPorEnsayo[e] = metaPlantillaVaciaEnsayo_(e);
                return;
            }
            const tieneTrabajo = ensayoMetaTieneDatosTrabajo(e);
            const completa = metaEnsayoCompletaParaOrden(e);
            if (!tieneTrabajo && !completa) {
                metaPorEnsayo[e] = metaPlantillaVaciaEnsayo_(e);
                return;
            }
            const visitada = ensayosActivadosSesion.has(e)
                || data.some((it) => String(it?.ensayo || '') === e);
            if (tieneTrabajo && !visitada) {
                metaPorEnsayo[e] = metaPlantillaVaciaEnsayo_(e);
            }
        }

        let metaGuardadoSuspendido = 0;
        function suspenderGuardadoMeta_() {
            metaGuardadoSuspendido++;
            clearTimeout(metaSaveTimer);
        }
        function reanudarGuardadoMeta_() {
            metaGuardadoSuspendido = Math.max(0, metaGuardadoSuspendido - 1);
        }

        function escribirMetaFormulario(o, ensayo) {
            suspenderGuardadoMeta_();
            try {
            const muestraObjetivo = ensayo || o?.['visual-meta-muestra'] || o?.['meta-muestra'] || ensayoDesdeFormulario() || 'Ensayo 1';
            META_SAVE_IDS.forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (id === 'visual-meta-muestra') {
                    el.value = muestraObjetivo;
                    return;
                }
                if (id === 'visual-rotulo') {
                    el.value = muestraObjetivo;
                    return;
                }
                if (id === 'visual-num-muestra') {
                    return;
                }
                const v = o?.[id];
                el.value = v !== undefined && v !== null ? String(v) : '';
            });
            } finally {
                reanudarGuardadoMeta_();
            }
        }

        function snapshotMetaEnsayoActual(ensayoForzado) {
            if (metaGuardadoSuspendido > 0 && !ensayoForzado) return;
            const ensayo = String(ensayoForzado || metaActivoEnsayo || 'Ensayo 1').trim() || 'Ensayo 1';
            const actual = leerMetaFormulario();
            actual['visual-meta-muestra'] = ensayo;
            actual['visual-rotulo'] = ensayo;
            delete actual['visual-num-muestra'];
            delete actual._num_muestra_fijo;
            metaPorEnsayo[ensayo] = actual;
            const g = String(actual['visual-guia-acopio'] || '').trim();
            const pl = String(actual['visual-placa-vehiculo'] || '').trim().toUpperCase();
                ensayoMeta[ensayo] = { guiaRemision: g, placaVehiculo: pl };
        }

        function marcarEnsayoEnUsoSesion(ensayo) {
            const e = String(ensayo || '').trim();
            if (!e || ensayoEstaRegistradoHoy(e)) return;
            ensayosActivadosSesion.add(e);
        }

        function ensayoMetaTieneDatosTrabajo(ensayo) {
            const meta = metaPorEnsayo[String(ensayo || '').trim()];
            if (!meta) return false;
            const ids = [
                'visual-responsable', 'visual-guia-precosecha', 'visual-hora',
                'visual-meta-fundo', 'visual-meta-variedad', 'visual-traz-etapa', 'visual-traz-campo',
                'visual-traz-turno', 'visual-traz-acopio',
                'visual-guia-acopio', 'visual-placa-vehiculo', 'visual-observacion-formato'
            ];
            return ids.some((id) => String(meta[id] || '').trim() !== '');
        }

        function reconstruirEnsayosEnUsoSesionDesdeEstado() {
            ensayosActivadosSesion = new Set();
            data.forEach((it) => marcarEnsayoEnUsoSesion(String(it?.ensayo || '')));
            Object.keys(metaPorEnsayo).forEach((e) => {
                if (ensayoMetaTieneDatosTrabajo(e)) marcarEnsayoEnUsoSesion(e);
            });
            try {
                cargarColaSync().forEach((reg) => marcarEnsayoEnUsoSesion(reg?.ensayo));
            } catch (_) { /* ignore */ }
        }

        function cargarMetaDeEnsayo(ensayo) {
            const objetivo = ensayo || 'Ensayo 1';
            asegurarMetaEnsayoSinDatosFantasma_(objetivo);
            suspenderGuardadoMeta_();
            try {
            const dataEnsayo = { ...(metaPorEnsayo[objetivo] || metaPlantillaVaciaEnsayo_(objetivo)) };
            delete dataEnsayo['visual-num-muestra'];
            delete dataEnsayo._num_muestra_fijo;
            escribirMetaFormulario(dataEnsayo, objetivo);
            metaActivoEnsayo = objetivo;
            if (numMuestraSincronizadoServidor || !navigator.onLine || !API_URL) {
                aplicarNumMuestraParaEnsayoActivo('cargarMetaDeEnsayo');
            } else {
                asegurarNumMuestraAsignadoSiVacio(objetivo);
            }
            if (typeof window.aplicarParcelaCampoDesdeMeta === 'function') {
                window.aplicarParcelaCampoDesdeMeta(dataEnsayo);
            } else if (typeof window.refrescarSelectsCatalogoCampo === 'function') {
                window.refrescarSelectsCatalogoCampo();
            }
            asegurarOpcionesSelectAcopio(dataEnsayo['visual-traz-acopio']);
            actualizarBloqueoTrazabilidadPorFundo();
            sincronizarTrazabilidadCompuesta();
            sincronizarChipsDesdeAlmacenamiento();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            programarActualizarErroresMetaFormulario();
            } finally {
                reanudarGuardadoMeta_();
            }
        }

        function cargarMetaDesdeAlmacenamiento() {
            let raw = null;
            try {
                raw = localStorage.getItem(metaStorageKeyCampo_());
                if (!raw && claveModoCampoActual_() === 'visual') {
                    raw = localStorage.getItem(META_STORAGE_KEY_LEGACY);
                }
            } catch (e) { /* ignore */ }
            if (!raw) return false;
            try {
                const o = JSON.parse(raw);
                if (!metaAlmacenadaEsDeHoy_(o)) {
                    try { localStorage.removeItem(metaStorageKeyCampo_()); } catch (_) { /* ignore */ }
                    if (claveModoCampoActual_() === 'visual') {
                        try { localStorage.removeItem(META_STORAGE_KEY_LEGACY); } catch (_) { /* ignore */ }
                    }
                    return false;
                }
                if (o && typeof o === 'object' && o.porEnsayo && typeof o.porEnsayo === 'object') {
                    metaPorEnsayo = o.porEnsayo;
                    Object.keys(metaPorEnsayo).forEach((k) => migrarClavesMetaObjeto(metaPorEnsayo[k]));
                    purgarTodosNumerosMuestraEnMeta();
                    const activo = o.activo || ensayoDesdeFormulario() || 'Ensayo 1';
                    cargarMetaDeEnsayo(activo);
                    return true;
                }
                // Compatibilidad con formato antiguo (un solo formulario global).
                const legado = {};
                Object.keys(o).forEach((k) => {
                    if (k === 'porEnsayo' || k === 'activo') return;
                    if (o[k] !== undefined && o[k] !== null) legado[k] = o[k];
                });
                migrarClavesMetaObjeto(legado);
                const ensayoLegado = String(legado['visual-meta-muestra'] || legado['meta-muestra'] || legado['visual-rotulo'] || 'Ensayo 1');
                metaPorEnsayo = { [ensayoLegado]: legado };
                purgarTodosNumerosMuestraEnMeta();
                cargarMetaDeEnsayo(ensayoLegado);
                return true;
            } catch (e) {
                return false;
            }
        }

        function guardarMetaEnAlmacenamiento() {
            if (metaGuardadoSuspendido > 0) return;
            snapshotMetaEnsayoActual();
            const activo = metaActivoEnsayo || ensayoDesdeFormulario();
            if (activo && ensayoMetaTieneDatosTrabajo(activo)) marcarEnsayoEnUsoSesion(activo);
            const o = {
                activo: metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1',
                porEnsayo: clonarMetaPorEnsayoSinNumeros(metaPorEnsayo),
                fechaOperativa: hoyIsoLocal()
            };
            try {
                localStorage.setItem(metaStorageKeyCampo_(), JSON.stringify(o));
            } catch (e) { /* ignore */ }
            programarGuardadoDraftCompleto();
        }

        let metaSaveTimer = null;
        function programarGuardadoMeta() {
            if (metaGuardadoSuspendido > 0) return;
            clearTimeout(metaSaveTimer);
            metaSaveTimer = setTimeout(guardarMetaEnAlmacenamiento, 280);
        }

        function sembrarMetaDemostracionCampoUnaVez() {
            try {
                if (localStorage.getItem(DEMO_META_CAMPO_SEED_KEY)) return;
            } catch (_) {
                return;
            }
            const ensayo = 'Ensayo 1';
            if (!metaPorEnsayo[ensayo]) metaPorEnsayo[ensayo] = {};
            const m = metaPorEnsayo[ensayo];
            const fill = (k, v) => {
                const cur = m[k];
                if (cur !== undefined && cur !== null && String(cur).trim() !== '') return;
                m[k] = v;
            };
            fill('visual-meta-muestra', ensayo);
            fill('visual-rotulo', ensayo);
            // N° muestra: lo asigna el servidor al cargar (no sembrar 0001).
            fill('visual-responsable', 'Operador demo');
            fill('visual-guia-precosecha', '5 / 12');
            const pad = (n) => String(n).padStart(2, '0');
            const now = new Date();
            fill('visual-hora', `${pad(now.getHours())}:${pad(now.getMinutes())}`);
            fill('visual-meta-fundo', 'A9');
            fill('visual-traz-etapa', 'E06');
            fill('visual-traz-campo', 'C01');
            fill('visual-meta-variedad', 'Sekoya Pop');
            fill('visual-traz-turno', 'T1');
            cargarMetaDeEnsayo(ensayo);
            const g = document.getElementById('visual-guia-acopio');
            const p = document.getElementById('visual-placa-vehiculo');
            if (g && !String(g.value || '').trim()) g.value = '208353';
            if (p && !String(p.value || '').trim()) p.value = '9967-OK';
            persistirLogisticaAcopioDesdeInputs();
            try {
                localStorage.setItem(DEMO_META_CAMPO_SEED_KEY, '1');
            } catch (_) { /* ignore */ }
            programarGuardadoMeta();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
        }

        /** Campos obligatorios del formulario meta para cerrar una muestra y desbloquear la siguiente. */
        const META_CAMPOS_ORDEN_LLENADO = [
            'visual-meta-muestra',
            'visual-num-muestra',
            'visual-responsable',
            'visual-hora',
            'visual-meta-fundo',
            'visual-meta-variedad',
            'visual-trazabilidad',
            'visual-traz-acopio'
        ];

        /** Campos visibles del acordeón meta: borde rojo suave en tiempo real si están vacíos. */
        const META_CAMPOS_UI_VALIDACION = [
            'visual-responsable',
            'visual-hora',
            'visual-meta-fundo',
            'visual-traz-acopio',
            'visual-traz-etapa',
            'visual-traz-campo',
            'visual-traz-turno',
            'visual-meta-variedad'
        ];

        function campoMetaUiVacio(id) {
            return campoVacio(valorCampoRequerido(id));
        }

        function recolectarMetaUiFaltantes_() {
            sincronizarTrazabilidadCompuesta();
            return META_CAMPOS_UI_VALIDACION.filter((id) => campoMetaUiVacio(id));
        }

        function pintarMetaUiFaltantes_(idsFaltantes) {
            const faltan = new Set(idsFaltantes || []);
            META_CAMPOS_UI_VALIDACION.forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.toggle('meta-inp--falta', faltan.has(id));
            });
            const elPreco = document.getElementById('visual-guia-precosecha');
            if (elPreco) elPreco.classList.remove('meta-inp--falta');
        }

        let metaValidacionPausada = false;
        let metaValidacionRaf = 0;

        function actualizarErroresMetaFormularioCore() {
            const faltantes = recolectarMetaUiFaltantes_();
            pintarMetaUiFaltantes_(faltantes);
            return faltantes;
        }

        function programarActualizarErroresMetaFormulario() {
            if (metaValidacionPausada) return;
            if (metaValidacionRaf) return;
            metaValidacionRaf = requestAnimationFrame(() => {
                metaValidacionRaf = 0;
                if (metaValidacionPausada) return;
                actualizarErroresMetaFormularioCore();
            });
        }

        function pausarValidacionMetaCampo(on) {
            metaValidacionPausada = !!on;
            if (!on) programarActualizarErroresMetaFormulario();
        }

        function actualizarErroresMetaFormulario() {
            if (metaValidacionPausada) return [];
            return actualizarErroresMetaFormularioCore();
        }
        window.actualizarErroresMetaFormulario = actualizarErroresMetaFormulario;
        window.programarActualizarErroresMetaFormulario = programarActualizarErroresMetaFormulario;
        window.pausarValidacionMetaCampo = pausarValidacionMetaCampo;

        function validarMetaCriticaAntesCambioMuestra() {
            const faltantes = actualizarErroresMetaFormularioCore();
            if (!faltantes.length) return true;
            establecerAcordeonMetaAbierto(true);
            const first = document.getElementById(faltantes[0]);
            if (first && typeof first.focus === 'function') first.focus();
            return false;
        }

        function conectarValidacionMetaTiempoReal() {
            const refrescar = () => programarActualizarErroresMetaFormulario();
            META_CAMPOS_UI_VALIDACION.forEach((id) => {
                const el = document.getElementById(id);
                if (!el || el.dataset.metaUiValBound === '1') return;
                el.dataset.metaUiValBound = '1';
                el.addEventListener('input', refrescar);
                el.addEventListener('change', refrescar);
            });
            const muestraEl = document.getElementById('visual-meta-muestra');
            if (muestraEl && muestraEl.dataset.metaUiValBound !== '1') {
                muestraEl.dataset.metaUiValBound = '1';
                muestraEl.addEventListener('change', refrescar);
            }
        }

        function valorMetaCampoOrden(meta, id) {
            if (!meta || typeof meta !== 'object') return '';
            if (id === 'visual-trazabilidad') {
                const t = String(meta['visual-trazabilidad'] || '').trim();
                if (t) return t;
                const e = String(meta['visual-traz-etapa'] || '').trim();
                const c = String(meta['visual-traz-campo'] || '').trim();
                const tu = String(meta['visual-traz-turno'] || '').trim();
                return (e && c && tu) ? `${e}-${c}-${tu}` : '';
            }
            return String(meta[id] ?? '').trim();
        }

        function metaObjetoParaOrden(ensayo) {
            const nombre = String(ensayo || '').trim();
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
            if (nombre && nombre === activo) return leerMetaFormulario();
            return metaPorEnsayo[nombre] || {};
        }

        function metaCampoOrdenCompleto(ensayo, id) {
            if (id === 'visual-num-muestra') {
                const meta = metaObjetoParaOrden(ensayo);
                if (valorMetaCampoOrden(meta, id)) return true;
                const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
                if (String(ensayo || '').trim() === activo) {
                    const dom = String(document.getElementById('visual-num-muestra')?.value || '').trim();
                    if (dom) return true;
                }
                if (ensayoEstaRegistradoHoy(ensayo)) return true;
                const sinNum = META_CAMPOS_ORDEN_LLENADO.filter((x) => x !== 'visual-num-muestra');
                const restoOk = sinNum.every((fid) => valorMetaCampoOrden(meta, fid) !== '');
                return restoOk && !!calcularNumMuestraDesdeServidorParaEnsayo(ensayo);
            }
            return valorMetaCampoOrden(metaObjetoParaOrden(ensayo), id) !== '';
        }

        /** Meta del formulario 8/8 (o ya registrada en planilla). Define orden y N° muestra sin huecos. */
        function metaEnsayoCompletaParaOrden(ensayo) {
            if (ensayoEstaRegistradoHoy(ensayo)) return true;
            const nombre = String(ensayo || '').trim();
            if (!nombre) return false;
            return META_CAMPOS_ORDEN_LLENADO.every((id) => metaCampoOrdenCompleto(nombre, id));
        }

        function progresoMetaCompletado() {
            const ensayo = ensayoDesdeFormulario();
            if (!ensayo) return 0;
            let n = 0;
            META_CAMPOS_ORDEN_LLENADO.forEach((id) => {
                if (metaCampoOrdenCompleto(ensayo, id)) n++;
            });
            return n;
        }

        function actualizarProgresoMeta(opts) {
            const done = progresoMetaCompletado();
            const max = META_CAMPOS_ORDEN_LLENADO.length;
            const pct = (done / max) * 100;
            const fill = document.getElementById('meta-progress-fill');
            const txt = document.getElementById('meta-progress-text');
            if (fill) fill.style.width = pct + '%';
            if (txt) txt.textContent = done + ' / ' + max;
            aplicarBloqueoMuestrasCacheLocal();
            if (!opts?.sinValidacion) programarActualizarErroresMetaFormulario();
        }

        function sincronizarChipsDesdeAlmacenamiento() {
            document.querySelectorAll('[data-chip-group]').forEach((group) => {
                const tid = group.getAttribute('data-target');
                const val = document.getElementById(tid)?.value;
                group.querySelectorAll('.meta-chip').forEach((chip) => {
                    chip.classList.toggle('is-on', val !== '' && chip.getAttribute('data-value') === val);
                });
            });
            document.querySelectorAll('[data-chip-group-pair]').forEach((group) => {
                const dEl = document.getElementById(group.getAttribute('data-target-dias'));
                const cEl = document.getElementById(group.getAttribute('data-target-cose'));
                const dVal = dEl?.value;
                const cVal = cEl?.value;
                group.querySelectorAll('.meta-chip').forEach((chip) => {
                    const match = dVal === chip.getAttribute('data-dias') && cVal === chip.getAttribute('data-cose');
                    chip.classList.toggle('is-on', match);
                });
            });
        }

        function conectarGruposChips() {
            document.querySelectorAll('[data-chip-group]').forEach((group) => {
                const tid = group.getAttribute('data-target');
                const input = document.getElementById(tid);
                group.querySelectorAll('.meta-chip').forEach((chip) => {
                    chip.addEventListener('click', () => {
                        group.querySelectorAll('.meta-chip').forEach((c) => c.classList.remove('is-on'));
                        chip.classList.add('is-on');
                        if (input) input.value = chip.getAttribute('data-value') || '';
                        if (tid === 'visual-rotulo') {
                            aplicarCambioEnsayoActivo();
                        }
                        actualizarVistaCompacta();
                        programarGuardadoMeta();
                        actualizarProgresoMeta();
                        programarActualizarErroresMetaFormulario();
                    });
                });
            });
            document.querySelectorAll('[data-chip-group-pair]').forEach((group) => {
                const dId = group.getAttribute('data-target-dias');
                const cId = group.getAttribute('data-target-cose');
                const dIn = document.getElementById(dId);
                const cIn = document.getElementById(cId);
                group.querySelectorAll('.meta-chip').forEach((chip) => {
                    chip.addEventListener('click', () => {
                        group.querySelectorAll('.meta-chip').forEach((c) => c.classList.remove('is-on'));
                        chip.classList.add('is-on');
                        if (dIn) dIn.value = chip.getAttribute('data-dias') || '';
                        if (cIn) cIn.value = chip.getAttribute('data-cose') || '';
                        actualizarVistaCompacta();
                        programarGuardadoMeta();
                        actualizarProgresoMeta();
                        programarActualizarErroresMetaFormulario();
                    });
                });
            });
        }

        if (metaForm) {
            metaForm.addEventListener('submit', (e) => e.preventDefault());
            metaForm.addEventListener('input', (e) => {
                actualizarBloqueoTrazabilidadPorFundo();
                sincronizarTrazabilidadCompuesta();
                const muestra = document.getElementById('visual-meta-muestra')?.value?.trim();
                const rotulo = document.getElementById('visual-rotulo');
                if (rotulo && muestra) rotulo.value = muestra;
                // Importante: no cambiar metaActivoEnsayo en vivo cuando se está tocando
                // el selector de muestra. El cambio oficial se maneja en "change"
                // para poder guardar snapshot del ensayo anterior sin arrastrar datos.
                if (e?.target?.id !== 'visual-meta-muestra') {
                    metaActivoEnsayo = ensayoDesdeFormulario();
                }
                programarGuardadoMeta();
                actualizarProgresoMeta();
                actualizarVistaCompacta();
                actualizarBloqueoControlesPorPeso1();
                programarActualizarErroresMetaFormulario();
            });
            metaForm.addEventListener('change', async () => {
                actualizarBloqueoTrazabilidadPorFundo();
                sincronizarTrazabilidadCompuesta();
                const muestraEl = document.getElementById('visual-meta-muestra');
                const muestra = muestraEl?.value?.trim();
                const rotulo = document.getElementById('visual-rotulo');
                if (rotulo && muestra) {
                    const anterior = metaActivoEnsayo || 'Ensayo 1';
                    if (muestraEl && muestra !== anterior) {
                        const permitido = await bloquearCambioMuestraFueraDeOrden(muestra, anterior);
                        if (!permitido) {
                            actualizarVistaCompacta();
                            actualizarProgresoMeta();
                            return;
                        }
                        persistirLogisticaAcopioDesdeInputs(anterior);
                        snapshotMetaEnsayoActual(anterior);
                        programarActualizarErroresMetaFormulario();
                        asegurarMetaEnsayoSinDatosFantasma_(muestra);
                        if (!metaPorEnsayo[muestra]) {
                            metaPorEnsayo[muestra] = metaPlantillaVaciaEnsayo_(muestra);
                        }
                        aplicarCambioMuestraRapido(muestra);
                    } else {
                        rotulo.value = muestra;
                    }
                }
                metaActivoEnsayo = ensayoDesdeFormulario();
                programarGuardadoMeta();
                actualizarProgresoMeta();
                actualizarVistaCompacta();
                actualizarBloqueoControlesPorPeso1();
                programarActualizarErroresMetaFormulario();
            });
        }

        const metaEnterOrder = [
            'visual-meta-muestra',
            'visual-num-muestra',
            'visual-responsable',
            'visual-guia-precosecha',
            'visual-hora',
            'visual-meta-fundo',
            'visual-traz-acopio',
            'visual-traz-etapa',
            'visual-traz-campo',
            'visual-traz-turno',
            'visual-meta-variedad'
        ];
        metaEnterOrder.forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const next = document.getElementById(metaEnterOrder[i + 1]);
                if (next) next.focus();
            });
        });

        function asegurarOpcionesSelectAcopio(valorPreferido) {
            const sel = document.getElementById('visual-traz-acopio');
            if (!sel) return;
            const actual = String(valorPreferido != null ? valorPreferido : sel.value || '').trim();
            const valores = new Set(['']);
            for (let i = 1; i <= 25; i++) valores.add(`Acopio ${i}`);
            if (sel.options.length < 26) {
                const prev = actual;
                sel.innerHTML = '<option value="">Acopio</option>';
                for (let i = 1; i <= 25; i++) {
                    const opt = document.createElement('option');
                    opt.value = `Acopio ${i}`;
                    opt.textContent = `Acopio ${i}`;
                    sel.appendChild(opt);
                }
                if (prev && !valores.has(prev)) {
                    const leg = document.createElement('option');
                    leg.value = prev;
                    leg.textContent = `${prev} (guardado)`;
                    sel.appendChild(leg);
                }
                sel.value = prev && [...sel.options].some((o) => o.value === prev) ? prev : '';
            } else if (actual && !valores.has(actual) && ![...sel.options].some((o) => o.value === actual)) {
                const leg = document.createElement('option');
                leg.value = actual;
                leg.textContent = `${actual} (guardado)`;
                sel.appendChild(leg);
                sel.value = actual;
            }
        }
        window.asegurarOpcionesSelectAcopio = asegurarOpcionesSelectAcopio;
        asegurarOpcionesSelectAcopio();

        conectarGruposChips();
        conectarValidacionMetaTiempoReal();
        const nuevoDiaCampo = prepararCampoNuevoDiaSiCorresponde_();
        const cargoMeta = nuevoDiaCampo ? false : cargarMetaDesdeAlmacenamiento();
        if (nuevoDiaCampo) {
            metaPorEnsayo = {};
            ensayoActivo = 'Ensayo 1';
            metaActivoEnsayo = 'Ensayo 1';
            ensayosActivadosSesion = new Set();
            Object.keys(numerosMuestraFijadosSesion).forEach((k) => delete numerosMuestraFijadosSesion[k]);
        }
        if (!cargoMeta) {
            metaActivoEnsayo = ensayoDesdeFormulario();
            snapshotMetaEnsayoActual();
        }
        sincronizarTrazabilidadCompuesta();
        actualizarBloqueoTrazabilidadPorFundo();
        const muestraInicial = document.getElementById('visual-meta-muestra')?.value?.trim();
        const rotuloInicial = document.getElementById('visual-rotulo');
        if (rotuloInicial && muestraInicial) rotuloInicial.value = muestraInicial;
        metaActivoEnsayo = muestraInicial || metaActivoEnsayo;
        sincronizarChipsDesdeAlmacenamiento();
        actualizarVistaCompacta();
        actualizarProgresoMeta();
        programarActualizarErroresMetaFormulario();
        function metricaVacia() {
            return {
                tiempo: {
                    inicioCosecha: '', inicioPerdida: '', terminoCosecha: '',
                    llegadaAcopio: '', despachoAcopio: '',
                    acopioCalibrado: '', terminoCalibrado: ''
                },
                temperatura: {
                    inicioAmbiente: '', inicioPulpa: '',
                    terminoAmbiente: '', terminoPulpa: '',
                    llegadaAmbiente: '', llegadaPulpa: '',
                    despachoAmbiente: '', despachoPulpa: '',
                    presionAmbienteInicio: '', presionAmbienteTermino: '', presionAmbienteLlegada: '', presionAmbienteDespacho: '',
                    presionFrutaInicio: '', presionFrutaTermino: '', presionFrutaLlegada: '', presionFrutaDespacho: ''
                },
                humedad: { inicio: '', termino: '', llegada: '', despacho: '' }
            };
        }

        const data = [];

        const metricModalState = { itemId: null, kind: null };
        const observationModalState = { itemId: null };
        const controlGlobalState = { tipo: null };
        const horasLlenadoModalState = { ensayo: '', idFila: null };
        const llenadoJarrasState = {
            porEnsayo: {},
            /** Ensayos donde el usuario borró todas las filas (no re-sembrar la fila 1). */
            usuarioVacio: {}
        };
        let siguienteIdFilaJarras = 1;
        (function inicializarIdsFilaJarras() {
            let maxId = 0;
            Object.values(llenadoJarrasState.porEnsayo).forEach((filas) => {
                filas.forEach((f) => {
                    const n = Number(f.id);
                    if (Number.isFinite(n)) maxId = Math.max(maxId, n);
                });
            });
            siguienteIdFilaJarras = maxId > 0 ? maxId + 1 : 1;
        }());
        let editingCardId = null;
        let guardandoModalTarjeta_ = false;
        let abrirModalTarjetaTs_ = 0;
        let omitirConfirmacionSalida = false;

        function setButtonLoading(btn, loading, loadingText) {
            if (!btn) return;
            if (loading) {
                if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent || '';
                btn.disabled = true;
                btn.classList.add('is-loading');
                btn.textContent = loadingText || 'Procesando...';
                return;
            }
            btn.disabled = false;
            btn.classList.remove('is-loading');
            if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
        }

        function marcarBotonGuardado(btnId) {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            const original = btn.textContent || 'Guardar';
            btn.textContent = 'Guardado';
            btn.disabled = true;
            setTimeout(() => {
                btn.textContent = original;
                btn.disabled = false;
            }, 900);
        }

        function obtenerEnsayoActivo() {
            const rotulo = document.getElementById('visual-rotulo')?.value?.trim();
            return rotulo || metaActivoEnsayo || ensayoActivo || 'Ensayo 1';
        }

        function listaClamshellsPorEnsayo_(ensayo) {
            return data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === String(ensayo || 'Ensayo 1'))
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id));
        }

        function ultimoClamshellPorEnsayo_(ensayo) {
            const lista = listaClamshellsPorEnsayo_(ensayo);
            return lista.length ? lista[lista.length - 1] : null;
        }

        function esUltimoClamshellPorEnsayo_(item) {
            if (!item) return false;
            const ultimo = ultimoClamshellPorEnsayo_(item.ensayo || 'Ensayo 1');
            return ultimo && Number(item.id) === Number(ultimo.id);
        }

        function numeroClamshellPorEnsayo(itemOrId) {
            const item = typeof itemOrId === 'object'
                ? itemOrId
                : data.find((entry) => entry.id === Number(itemOrId));
            if (!item) return Number(itemOrId) || 1;
            const lista = listaClamshellsPorEnsayo_(item.ensayo || 'Ensayo 1');
            const idx = lista.findIndex((it) => Number(it.id) === Number(item.id));
            return idx >= 0 ? idx + 1 : 1;
        }

        function aplicarCambioEnsayoActivo() {
            ensayoActivo = obtenerEnsayoActivo();
            editingCardId = null;
            metricModalState.itemId = null;
            metricModalState.kind = null;
            observationModalState.itemId = null;
            establecerMenuFlotanteAbierto(false);
            cerrarModalControlGlobal();
            asegurarClamshellInicialVacio(ensayoActivo);
            asegurarMetricasLimpiasEnsayoSinCaptura_(ensayoActivo);
            renderizarTarjetas();
            renderizarPanelLlenadoJarras();
            sincronizarLogisticaAcopioDesdeEnsayo();
            actualizarBloqueoControlesPorPeso1();
        }

        function leerCacheRegistradosHoy() {
            try {
                const raw = localStorage.getItem(REGISTRADOS_HOY_CACHE_KEY);
                if (!raw) return null;
                const o = JSON.parse(raw);
                if (!o || o.fecha !== hoyIsoLocal() || !Array.isArray(o.ensayos)) return null;
                return new Set(o.ensayos.map((x) => String(x)));
            } catch (_) {
                return null;
            }
        }

        function guardarCacheRegistradosHoy(setNums) {
            try {
                const ens = [...(setNums || new Set())].map((x) => String(x));
                localStorage.setItem(REGISTRADOS_HOY_CACHE_KEY, JSON.stringify({
                    fecha: hoyIsoLocal(),
                    ensayos: ens
                }));
            } catch (_) { /* ignore */ }
        }

        async function obtenerEnsayosRegistradosHoyServidor(force = false) {
            if (!API_URL || !navigator.onLine) return null;
            const now = Date.now();
            if (!force && bloqueoMuestraCacheNums && (now - bloqueoMuestraUltimoFetchMs) < 2500) {
                return new Set([...bloqueoMuestraCacheNums]);
            }
            try {
                const r = await callbackJsonp(API_URL, { fecha: hoyIsoLocal() }, 5000);
                if (!r || r.ok !== true || !Array.isArray(r.ensayos)) return null;
                const out = new Set(r.ensayos.map((e) => String(e).trim()).filter(Boolean));
                bloqueoMuestraCacheNums = out;
                bloqueoMuestraUltimoFetchMs = now;
                guardarCacheRegistradosHoy(out);
                return new Set([...out]);
            } catch (_) {
                return null;
            }
        }

        function obtenerEnsayosBloqueadosLocales() {
            const set = new Set();
            try {
                const q = cargarColaSync();
                q.forEach((reg) => {
                    const estado = String(reg?.estado || '');
                    if (estado !== 'pendiente' && estado !== 'bloqueado') return;
                    const en = String(reg?.ensayo_numero || '').trim();
                    if (en) set.add(en);
                });
            } catch (_) { /* ignore */ }
            return set;
        }

        /** Solo ensayos confirmados en planilla — no cuenta cola «pendiente» (aún no registrados). */
        function obtenerEnsayosRegistradosConfirmadosParaUiBloqueo_() {
            const set = new Set();
            if (bloqueoMuestraCacheNums) {
                bloqueoMuestraCacheNums.forEach((n) => set.add(String(n)));
            } else {
                const cache = leerCacheRegistradosHoy();
                if (cache) cache.forEach((n) => set.add(String(n)));
            }
            try {
                const map = cargarNumMuestraUsadosLocal();
                Object.values(map).forEach((det) => {
                    const st = String(det?.estado || '').toLowerCase();
                    const en = String(det?.ensayo_numero || '').trim();
                    if (en && (st === 'registrado' || st === 'subido' || st === 'bloqueado') && numMuestraUsadoEsDeHoy_(det)) {
                        set.add(en);
                    }
                });
            } catch (_) { /* ignore */ }
            return set;
        }

        function marcarEnsayoRegistradoHoyLocal(ensayoNumero) {
            const n = String(ensayoNumero || '').trim();
            if (!n) return;
            if (!bloqueoMuestraCacheNums) bloqueoMuestraCacheNums = new Set();
            bloqueoMuestraCacheNums.add(n);
            bloqueoMuestraUltimoFetchMs = Date.now();
            guardarCacheRegistradosHoy(bloqueoMuestraCacheNums);
            const nombre = ensayoNombreDesdeNumero(n);
            if (nombre) delete numerosMuestraFijadosSesion[nombre];
            if (nombre && metaPorEnsayo[nombre]) {
                delete metaPorEnsayo[nombre]['visual-num-muestra'];
                delete metaPorEnsayo[nombre]._num_muestra_fijo;
            }
            aplicarBloqueoSelectMuestra(obtenerEnsayosRegistradosConfirmadosParaUiBloqueo_());
        }

        function aplicarBloqueoSelectMuestra(ensayosRegistradosNums) {
            const sel = document.getElementById('visual-meta-muestra');
            if (!sel) return;
            const registrados = ensayosRegistradosNums || new Set();
            [...sel.options].forEach((op) => {
                const val = String(op.value || '').trim();
                if (!val) return;
                if (!op.dataset.baseLabel) op.dataset.baseLabel = op.textContent || val;
                const num = numeroDesdeEnsayoTexto(val);
                const registrado = !!(num && registrados.has(String(num)));
                const fueraOrden = !validarOrdenLlenadoAlElegirMuestra(val).ok;
                const isBlocked = registrado || fueraOrden;
                op.disabled = isBlocked;
                if (registrado) {
                    op.textContent = `${op.dataset.baseLabel} (registrado)`;
                    op.title = 'Ya registrada hoy';
                } else if (fueraOrden) {
                    op.textContent = `${op.dataset.baseLabel} (orden)`;
                    op.title = 'Completa el formulario 8/8 en las muestras anteriores (1, 2, 3…)';
                } else {
                    op.textContent = op.dataset.baseLabel;
                    op.title = '';
                }
            });

            const actual = String(sel.value || '').trim();
            const numActual = numeroDesdeEnsayoTexto(actual);
            if (numActual && registrados.has(String(numActual))) {
                const libre = [...sel.options].find((o) => String(o.value || '').trim() && !o.disabled);
                if (libre) {
                    sel.value = libre.value;
                    const rotulo = document.getElementById('visual-rotulo');
                    if (rotulo) rotulo.value = libre.value;
                    aplicarCambioMuestraRapido(libre.value);
                    mostrarToast('info', 'Muestra no disponible', 'Ese ensayo ya está registrado y fue bloqueado.');
                }
            }
            setTimeout(evaluarAvisoLlenadoCompletoCampo, 80);
        }

        async function refrescarBloqueoMuestrasEnTiempoReal(forceServer = false) {
            aplicarBloqueoMuestrasCacheLocal();
            if (!API_URL || !navigator.onLine) return;
            await refrescarEstadoServidorOperativo(forceServer);
        }

        /** Ensayos (1–10) ya guardados hoy en planilla (servidor manda la verdad si hay sync). */
        function obtenerEnsayosRegistradosHoySet() {
            const set = new Set();
            if (numMuestraSincronizadoServidor && bloqueoMuestraCacheNums) {
                bloqueoMuestraCacheNums.forEach((n) => set.add(String(n)));
            } else {
                const cache = leerCacheRegistradosHoy();
                if (cache) cache.forEach((n) => set.add(String(n)));
            }
            try {
                const hoy = hoyIsoLocal();
                cargarColaSync().forEach((reg) => {
                    const st = String(reg?.estado || '');
                    if (st !== 'pendiente' && st !== 'bloqueado') return;
                    if (String(reg?.fecha || hoy) === hoy && reg.ensayo_numero) {
                        set.add(String(reg.ensayo_numero));
                    }
                });
            } catch (_) { /* ignore */ }
            if (!numMuestraSincronizadoServidor) {
                try {
                    const map = cargarNumMuestraUsadosLocal();
                    Object.values(map).forEach((det) => {
                        const st = String(det?.estado || '').toLowerCase();
                        const en = String(det?.ensayo_numero || '').trim();
                        if (en && (st === 'registrado' || st === 'subido') && numMuestraUsadoEsDeHoy_(det)) {
                            set.add(en);
                        }
                    });
                } catch (_) { /* ignore */ }
            }
            return set;
        }

        function ensayoNumeroRegistradoHoy(ensayoNumero) {
            const n = String(ensayoNumero || '').trim();
            if (!n) return false;
            return obtenerEnsayosRegistradosHoySet().has(n);
        }

        function ensayoEstaRegistradoHoy(ensayoNombre) {
            return ensayoNumeroRegistradoHoy(numeroDesdeEnsayoTexto(ensayoNombre));
        }

        /** Mayor n° de muestra (1–10) ya registrada hoy (planilla + opciones bloqueadas). */
        function maxNumeroMuestraRegistradaHoy() {
            let max = 0;
            const subir = (n) => {
                const x = Number(n);
                if (x >= 1 && x <= MAX_MUESTRAS_CAMPO && x > max) max = x;
            };
            obtenerEnsayosRegistradosHoySet().forEach((en) => subir(en));
            const sel = document.getElementById('visual-meta-muestra');
            if (sel) {
                [...sel.options].forEach((op) => {
                    const val = String(op.value || '').trim();
                    if (!val || !op.disabled) return;
                    const lbl = String(op.textContent || '');
                    if (lbl.includes('registrado')) subir(numeroDesdeEnsayoTexto(val));
                });
            }
            return max;
        }

        function ultimoNumMuestraEnPlanilla() {
            return parseNumMuestraSoloDigitos(numMuestraMaxServidorCache);
        }

        function metaEnsayoCuentaParaCalculoNumMuestra(ensayoKey, ensayoActual) {
            if (ensayoActual && ensayoKey === ensayoActual) return false;
            if (ensayoEstaRegistradoHoy(ensayoKey)) return false;
            return true;
        }

        function ensayoNombreDesdeNumero(ensayoNumero) {
            const n = String(ensayoNumero || '').trim();
            return n ? `Ensayo ${n}` : '';
        }

        /** Muestra cerrada: meta 8/8 o registrada hoy (desbloquea la siguiente; no basta con visitarla o un clamshell vacío). */
        function muestraEstaEnSecuenciaLlenado(numeroMuestra) {
            const n = Number(numeroMuestra);
            if (!Number.isFinite(n) || n < 1 || n > MAX_MUESTRAS_CAMPO) return false;
            return metaEnsayoCompletaParaOrden(ensayoNombreDesdeNumero(n));
        }

        function validarOrdenLlenadoAlElegirMuestra(ensayoDestino) {
            const destino = Number(numeroDesdeEnsayoTexto(ensayoDestino)) || 1;
            if (destino <= 1) return { ok: true, faltan: [], destino };
            const faltan = [];
            for (let i = 1; i < destino; i++) {
                if (!muestraEstaEnSecuenciaLlenado(i)) faltan.push(i);
            }
            return { ok: faltan.length === 0, faltan, destino };
        }

        async function bloquearCambioMuestraFueraDeOrden(ensayoDestino, ensayoAnterior) {
            const destinoKey = String(ensayoDestino || '').trim();
            if (destinoKey && ensayoTieneDatosLocalesPendientes_(destinoKey)) return true;
            const destinoNum = Number(numeroDesdeEnsayoTexto(ensayoDestino)) || 1;
            const anteriorNum = Number(numeroDesdeEnsayoTexto(ensayoAnterior)) || 1;
            if (destinoNum < anteriorNum) return true;
            const v = validarOrdenLlenadoAlElegirMuestra(ensayoDestino);
            if (v.ok) return true;
            const prev = String(ensayoAnterior || metaActivoEnsayo || 'Ensayo 1').trim() || 'Ensayo 1';
            const sel = document.getElementById('visual-meta-muestra');
            const rotulo = document.getElementById('visual-rotulo');
            if (sel) sel.value = prev;
            if (rotulo) rotulo.value = prev;
            const txtFaltan = v.faltan.map((n) => `Muestra ${n}`).join(' y ');
            const html = `
                <div style="text-align:left;line-height:1.45;font-size:14px;">
                    <p style="margin:0 0 10px;">No puedes pasar a <b>Muestra ${v.destino}</b>.</p>
                    <p style="margin:0 0 8px;">Completa <b>todos los campos</b> del formulario (8/8) en <b>${txtFaltan}</b> antes de pasar a Muestra ${v.destino}.</p>
                    <p style="margin:0;color:#64748b;">El N° muestra avanza en orden (1→2→3…) sin huecos en planilla.</p>
                </div>
            `;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireSafe({
                    icon: 'error',
                    title: 'Fuera de orden de llenado',
                    html,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#1f4f82',
                    allowOutsideClick: false
                });
            } else {
                alert(`No puedes usar Muestra ${v.destino}. Primero completa ${txtFaltan}.`);
            }
            return false;
        }

        /** Muestra bloqueada (registrada): su N° ya está en planilla; quitar del meta local para no sumar +1 de más. */
        function purgarMetaNumMuestraEnsayosRegistradosHoy() {
            Object.keys(metaPorEnsayo).forEach((ensayoKey) => {
                if (!ensayoEstaRegistradoHoy(ensayoKey)) return;
                delete metaPorEnsayo[ensayoKey]['visual-num-muestra'];
                delete metaPorEnsayo[ensayoKey]._num_muestra_fijo;
            });
        }

        function conteoLlenadoMetrica(item, kind) {
            if (kind === 'tiempo') {
                const t = item?.metric?.tiempo || {};
                const keys = keysTiempoValidacionCampo_();
                const done = keys.filter((k) => String(t[k] ?? '').trim() !== '').length;
                return { done, total: keys.length };
            }
            const m = item?.metric?.[kind];
            if (!m) return { done: 0, total: 0 };
            const vals = Object.values(m);
            const done = vals.filter((v) => String(v ?? '').trim() !== '').length;
            return { done, total: vals.length };
        }

        function obtenerLiderTiempoPorJarra(itemBase) {
            if (!itemBase) return null;
            const ensayo = String(itemBase.ensayo || 'Ensayo 1');
            const jarra = Number(itemBase.jarra);
            if (!Number.isFinite(jarra)) return itemBase;
            const delEnsayoJarra = data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === ensayo && Number(it.jarra) === jarra)
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id));
            return delEnsayoJarra[0] || itemBase;
        }

        function idLiderTiempoPorJarraEnEnsayo(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const mapa = {};
            data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id))
                .forEach((it) => {
                    const j = Number(it.jarra);
                    if (!Number.isFinite(j)) return;
                    if (mapa[j] === undefined) mapa[j] = Number(it.id);
                });
            return mapa;
        }

        function sincronizarTiempoPorJarra(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const filasJ = obtenerFilasLlenadoJarras(clave);
            const visuales = data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id));

            // Inicio de cosecha: primer registro tipo Cosecha del ensayo (misma hora en todos los clamshells).
            let inicioCosechaEnsayo = '';
            filasJ.forEach((f) => {
                if (String(f.tipo || '').trim() !== 'C') return;
                const ini = String(f.inicio || '').trim();
                if (!ini || inicioCosechaEnsayo) return;
                inicioCosechaEnsayo = ini;
            });

            const trasvasados = filasJ.filter((f) => String(f.tipo || '').trim() === 'T');
            let terminoUltimoTrasvasadoEnsayo = '';
            let terminoUltimoTrasvasadoMin = -1;
            trasvasados.forEach((f) => {
                const fin = String(f.termino || '').trim();
                if (!fin) return;
                const m = minutosDesdeHora(fin);
                if (m === null) return;
                if (m >= terminoUltimoTrasvasadoMin) {
                    terminoUltimoTrasvasadoMin = m;
                    terminoUltimoTrasvasadoEnsayo = fin;
                }
            });

            const terminoTrasvasadoPorJarra = new Map();
            visuales.forEach((it) => {
                const nJarra = Number(it.jarra);
                if (!Number.isFinite(nJarra) || nJarra < 1) return;
                let mejor = '';
                let mejorMin = -1;
                trasvasados.forEach((f) => {
                    const fin = String(f.termino || '').trim();
                    if (!fin) return;
                    if (!trasladoVisualAplicaJarra(f.jarra, nJarra)) return;
                    const m = minutosDesdeHora(fin);
                    if (m === null) return;
                    if (m >= mejorMin) {
                        mejorMin = m;
                        mejor = fin;
                    }
                });
                if (mejor) terminoTrasvasadoPorJarra.set(nJarra, mejor);
            });

            const llegadaGlobal =
                visuales.map((it) => String(it?.metric?.tiempo?.llegadaAcopio || '').trim()).filter(Boolean).slice(-1)[0] || '';
            const despachoGlobal =
                visuales.map((it) => String(it?.metric?.tiempo?.despachoAcopio || '').trim()).filter(Boolean).slice(-1)[0] || '';
            const acopioCalibradoGlobal =
                visuales.map((it) => String(it?.metric?.tiempo?.acopioCalibrado || '').trim()).filter(Boolean).slice(-1)[0] || '';
            const terminoCalibradoGlobal =
                visuales.map((it) => String(it?.metric?.tiempo?.terminoCalibrado || '').trim()).filter(Boolean).slice(-1)[0] || '';

            visuales.forEach((it) => {
                const nJarra = Number(it.jarra);
                it.metric = it.metric || metricaVacia();
                it.metric.tiempo = it.metric.tiempo || {};
                const inicioCosechaActual = String(it.metric?.tiempo?.inicioCosecha || '').trim();
                const inicioPerdidaActual = String(it.metric?.tiempo?.inicioPerdida || '').trim();
                const terminoCosechaActual = String(it.metric?.tiempo?.terminoCosecha || '').trim();
                const llegadaActual = String(it.metric?.tiempo?.llegadaAcopio || '').trim();
                const despachoActual = String(it.metric?.tiempo?.despachoAcopio || '').trim();
                const acopioCalibradoActual = String(it.metric?.tiempo?.acopioCalibrado || '').trim();
                const terminoCalibradoActual = String(it.metric?.tiempo?.terminoCalibrado || '').trim();

                // Si no hay dato proveniente de jarras/trasvasados, conservar lo ya registrado.
                it.metric.tiempo.inicioCosecha = inicioCosechaEnsayo || inicioCosechaActual;
                it.metric.tiempo.terminoCosecha = terminoUltimoTrasvasadoEnsayo || terminoCosechaActual;
                it.metric.tiempo.llegadaAcopio = llegadaGlobal || llegadaActual;
                it.metric.tiempo.despachoAcopio = despachoGlobal || despachoActual;
                if (esModoRegistroAcopio_()) {
                    it.metric.tiempo.acopioCalibrado = acopioCalibradoGlobal || acopioCalibradoActual;
                    it.metric.tiempo.terminoCalibrado = terminoCalibradoGlobal || terminoCalibradoActual;
                } else {
                    it.metric.tiempo.inicioPerdida = terminoTrasvasadoPorJarra.get(nJarra) || inicioPerdidaActual;
                }
            });
        }

        function validarSecuenciaTiempoMetrica(t) {
            const errores = [];
            const cadena = esModoRegistroAcopio_()
                ? [
                    { k: 'Inicio de cosecha', v: String(t?.inicioCosecha || '').trim() },
                    { k: 'Término de cosecha', v: String(t?.terminoCosecha || '').trim() },
                    { k: 'Llegada acopio-campo', v: String(t?.llegadaAcopio || '').trim() },
                    { k: 'Acopio calibrado', v: String(t?.acopioCalibrado || '').trim() },
                    { k: 'Término de calibrado', v: String(t?.terminoCalibrado || '').trim() },
                    { k: 'Despacho acopio-campo', v: String(t?.despachoAcopio || '').trim() }
                ]
                : [
                    { k: 'Inicio de cosecha', v: String(t?.inicioCosecha || '').trim() },
                    { k: 'Inicio pérdida de peso', v: String(t?.inicioPerdida || '').trim() },
                    { k: 'Término de cosecha', v: String(t?.terminoCosecha || '').trim() },
                    { k: 'Llegada acopio-campo', v: String(t?.llegadaAcopio || '').trim() },
                    { k: 'Despacho acopio-campo', v: String(t?.despachoAcopio || '').trim() }
                ];
            const llenos = cadena.filter((c) => c.v);
            for (let i = 1; i < llenos.length; i++) {
                if (horarioFinalMenorQueInicio(llenos[i - 1].v, llenos[i].v)) {
                    errores.push(llenos[i].k + ' debe ser mayor o igual a ' + llenos[i - 1].k + '.');
                }
            }
            return errores;
        }

        function obtenerTiempoDesdeModalMetrica() {
            const read = (k) => document.querySelector(`#metric-modal-body [data-metric="${k}"]`)?.value || '';
            const base = {
                inicioCosecha: read('inicioCosecha'),
                terminoCosecha: read('terminoCosecha'),
                llegadaAcopio: read('llegadaAcopio'),
                despachoAcopio: read('despachoAcopio')
            };
            if (esModoRegistroAcopio_()) {
                return {
                    ...base,
                    acopioCalibrado: read('acopioCalibrado'),
                    terminoCalibrado: read('terminoCalibrado')
                };
            }
            return {
                ...base,
                inicioPerdida: read('inicioPerdida')
            };
        }

        function validarTiempoModalEnVivo() {
            const alertEl = document.getElementById('visual-tiempo-alert');
            const tiempo = obtenerTiempoDesdeModalMetrica();
            const errores = validarSecuenciaTiempoMetrica(tiempo);
            if (alertEl) {
                if (errores.length) {
                    alertEl.textContent = errores[0];
                    alertEl.style.display = 'block';
                } else {
                    alertEl.textContent = '';
                    alertEl.style.display = 'none';
                }
            }
            return errores;
        }

        function conteoLlenadoPresion(item, tipo) {
            const t = item?.metric?.temperatura || {};
            const campos = tipo === 'ambiente'
                ? ['presionAmbienteInicio', 'presionAmbienteTermino', 'presionAmbienteLlegada', 'presionAmbienteDespacho']
                : ['presionFrutaInicio', 'presionFrutaTermino', 'presionFrutaLlegada', 'presionFrutaDespacho'];
            const done = campos.filter((c) => String(t[c] ?? '').trim() !== '').length;
            return { done, total: 4 };
        }

        function contarTarjetasConMedicionesPendientes() {
            const ensayo = obtenerEnsayoActivo();
            let n = 0;
            data.forEach((item) => {
                if (String(item.ensayo || 'Ensayo 1') !== ensayo) return;
                const t = conteoLlenadoMetrica(item, 'tiempo');
                const h = conteoLlenadoMetrica(item, 'humedad');
                const temp = conteoLlenadoMetrica(item, 'temperatura');
                const pA = conteoLlenadoPresion(item, 'ambiente');
                const pF = conteoLlenadoPresion(item, 'fruta');
                const incompleto = (t.total > 0 && t.done < t.total)
                    || (h.total > 0 && h.done < h.total)
                    || (temp.total > 0 && temp.done < temp.total)
                    || pA.done < pA.total
                    || pF.done < pF.total;
                if (incompleto) n++;
            });
            return n;
        }

        function actualizarHeaderPendientesUI() {
            const el = document.getElementById('header-pendientes-count');
            if (!el) return;
            const n = Math.min(99, pendingsSyncCount());
            el.textContent = String(n).padStart(2, '0');
            el.classList.toggle('header-status-pend-num--alert', n > 0);
        }

        function actualizarHeaderConexionUI() {
            const card = document.getElementById('header-status-card');
            const label = document.getElementById('header-conn-label');
            const wifi = document.getElementById('header-status-wifi');
            if (!card || !label) return;
            const online = typeof navigator !== 'undefined' && navigator.onLine;
            card.classList.toggle('is-online', online);
            card.classList.toggle('is-offline', !online);
            label.textContent = online ? 'En línea' : 'Sin conexión';
            if (wifi) {
                wifi.setAttribute('data-lucide', online ? 'wifi' : 'wifi-off');
                actualizarIconos();
            }
        }

        function actualizarBarraHeaderEstado() {
            actualizarHeaderPendientesUI();
            actualizarHeaderConexionUI();
        }

        const elFechaRingWidgetCampo = document.getElementById('visual-fecha-ring-widget');
        const elFechaRingCircleCampo = document.getElementById('campo-fecha-ring-circle');
        const elFechaRingPopoverCampo = document.getElementById('campo-fecha-ring-popover');

        function mensajeFechaRingCampo(d) {
            const mesLargo = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d);
            const dia = d.getDate();
            const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            if (dia <= 7) {
                return mesLargo + ' recién comenzó — día ' + dia + ' de ' + diasMes;
            }
            return 'Estamos en ' + mesLargo + ' — día ' + dia + ' de ' + diasMes;
        }

        function actualizarArcoFechaRingCampo(d) {
            if (!elFechaRingCircleCampo) return;
            const dia = d.getDate();
            const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const progreso = Math.min(1, Math.max(0, dia / diasMes));
            const arcoDeg = Math.round(70 * progreso);
            const corte = 280 - arcoDeg;
            elFechaRingCircleCampo.style.background = 'conic-gradient(from 210deg, rgba(22, 76, 124, 0.18) 0deg '
                + corte + 'deg, rgba(29, 78, 137, 0.92) ' + corte + 'deg 360deg)';
        }

        function actualizarFechaRing() {
            const dayEl = document.getElementById('fecha-ring-day');
            const monthEl = document.getElementById('fecha-ring-month');
            if (!dayEl || !monthEl) return;
            const now = new Date();
            dayEl.textContent = String(now.getDate()).padStart(2, '0');
            const mes = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(now).replace('.', '');
            const anio = now.getFullYear();
            monthEl.textContent = `${mes} ${anio}`.toUpperCase();
            const msg = mensajeFechaRingCampo(now);
            if (elFechaRingPopoverCampo && !elFechaRingWidgetCampo?.classList.contains('is-popover-open')) {
                elFechaRingPopoverCampo.textContent = msg;
            }
            if (elFechaRingWidgetCampo) elFechaRingWidgetCampo.title = msg;
            actualizarArcoFechaRingCampo(now);
        }

        function togglePopoverFechaRingCampo(forceOpen) {
            if (!elFechaRingWidgetCampo || !elFechaRingPopoverCampo) return;
            const abrir = forceOpen === true
                ? true
                : (forceOpen === false ? false : !elFechaRingWidgetCampo.classList.contains('is-popover-open'));
            const d = new Date();
            elFechaRingPopoverCampo.textContent = mensajeFechaRingCampo(d);
            elFechaRingWidgetCampo.classList.toggle('is-popover-open', abrir);
            elFechaRingPopoverCampo.hidden = !abrir;
        }

        let fechaRingTimer = null;
        function iniciarAutoActualizacionFechaRing() {
            actualizarFechaRing();
            clearInterval(fechaRingTimer);
            // Revalida cada minuto por si cambia el día mientras la app sigue abierta.
            fechaRingTimer = setInterval(actualizarFechaRing, 60000);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) actualizarFechaRing();
            });
            elFechaRingWidgetCampo?.addEventListener('click', (ev) => {
                ev.stopPropagation();
                togglePopoverFechaRingCampo();
            });
            elFechaRingWidgetCampo?.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                ev.preventDefault();
                togglePopoverFechaRingCampo();
            });
            document.addEventListener('click', () => togglePopoverFechaRingCampo(false));
        }

        function obtenerMetaEnsayo(ensayo) {
            if (!ensayoMeta[ensayo]) {
                const first = data.find((item) => (item.ensayo || 'Ensayo 1') === ensayo);
                ensayoMeta[ensayo] = {
                    placaVehiculo: first?.placaVehiculo || '',
                    guiaRemision: first?.guiaRemision || ''
                };
            }
            return ensayoMeta[ensayo];
        }

        function persistirLogisticaAcopioDesdeInputs(ensayoOverride) {
            const ensayo = String(ensayoOverride || obtenerEnsayoActivo() || 'Ensayo 1').trim() || 'Ensayo 1';
            const gEl = document.getElementById('visual-guia-acopio');
            const pEl = document.getElementById('visual-placa-vehiculo');
            if (!gEl || !pEl) return;
            const g = String(gEl.value ?? '').trim();
            const pl = String(pEl.value ?? '').trim().toUpperCase();
            ensayoMeta[ensayo] = { placaVehiculo: pl, guiaRemision: g };
            const meta = metaPorEnsayo[ensayo] || {};
            meta['visual-guia-acopio'] = g;
            meta['visual-placa-vehiculo'] = pl;
            metaPorEnsayo[ensayo] = meta;
            data.forEach((item) => {
                if ((item.ensayo || 'Ensayo 1') === ensayo) {
                    item.placaVehiculo = pl;
                    item.guiaRemision = g;
                }
            });
            programarGuardadoDraftCompleto();
        }

        function leerLogisticaAcopioParaEnsayo_(ensayo) {
            const e = String(ensayo || 'Ensayo 1').trim() || 'Ensayo 1';
            const meta = metaPorEnsayo[e];
            if (meta && typeof meta === 'object') {
                return {
                    guiaRemision: String(meta['visual-guia-acopio'] || '').trim(),
                    placaVehiculo: String(meta['visual-placa-vehiculo'] || '').trim().toUpperCase()
                };
            }
            if (ensayoMeta[e]) {
                return {
                    guiaRemision: String(ensayoMeta[e].guiaRemision || '').trim(),
                    placaVehiculo: String(ensayoMeta[e].placaVehiculo || '').trim().toUpperCase()
                };
            }
            const first = data.find((item) => (item.ensayo || 'Ensayo 1') === e);
            return {
                guiaRemision: String(first?.guiaRemision || '').trim(),
                placaVehiculo: String(first?.placaVehiculo || '').trim().toUpperCase()
            };
        }

        function aplicarLogisticaAcopioEnPantalla_(ensayo, vals) {
            const e = String(ensayo || 'Ensayo 1').trim() || 'Ensayo 1';
            const g = String(vals?.guiaRemision || '').trim();
            const pl = String(vals?.placaVehiculo || '').trim().toUpperCase();
            ensayoMeta[e] = { guiaRemision: g, placaVehiculo: pl };
            data.forEach((item) => {
                if ((item.ensayo || 'Ensayo 1') === e) {
                    item.placaVehiculo = pl;
                    item.guiaRemision = g;
                }
            });
            const gEl = document.getElementById('visual-guia-acopio');
            const pEl = document.getElementById('visual-placa-vehiculo');
            if (gEl) gEl.value = g;
            if (pEl) pEl.value = pl;
        }

        function sincronizarLogisticaAcopioDesdeEnsayo(ensayoOverride) {
            const ensayo = String(ensayoOverride || obtenerEnsayoActivo() || 'Ensayo 1').trim() || 'Ensayo 1';
            aplicarLogisticaAcopioEnPantalla_(ensayo, leerLogisticaAcopioParaEnsayo_(ensayo));
        }

        (function initLogisticaAcopioRapida() {
            const g = document.getElementById('visual-guia-acopio');
            const p = document.getElementById('visual-placa-vehiculo');
            if (!g || !p) return;
            g.addEventListener('input', () => persistirLogisticaAcopioDesdeInputs());
            p.addEventListener('input', () => {
                p.value = p.value.toUpperCase();
                persistirLogisticaAcopioDesdeInputs();
            });
        }());

        (function initObservacionFormato() {
            const ta = document.getElementById('visual-observacion-formato');
            if (!ta) return;
            const guardar = () => programarGuardadoMeta();
            ta.addEventListener('input', guardar);
            ta.addEventListener('change', guardar);
        }());

        function establecerMenuFlotanteAbierto(open) {
            if (!fabMenu || !fabOptionsBtn) return;
            fabMenu.classList.toggle('is-open', open);
            fabOptionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        fabOptionsBtn?.addEventListener('click', () => {
            establecerMenuFlotanteAbierto(!fabMenu?.classList.contains('is-open'));
        });

        function renderizarTarjetas() {
            const container = document.getElementById('cards-container');
            container.innerHTML = '';
            const ensayoTrabajo = obtenerEnsayoActivo();
            sincronizarTiempoPorJarra(ensayoTrabajo);
            const dataEnsayo = data.filter((item) => String(item.ensayo || 'Ensayo 1') === ensayoTrabajo);
            const listaOrdenEnsayo = listaClamshellsPorEnsayo_(ensayoTrabajo);
            const ultimoEnsayo = listaOrdenEnsayo.length ? listaOrdenEnsayo[listaOrdenEnsayo.length - 1] : null;
            const nroUltimoEnsayo = ultimoEnsayo ? numeroClamshellPorEnsayo(ultimoEnsayo) : 0;
            const lideresTiempo = idLiderTiempoPorJarraEnEnsayo(ensayoTrabajo);
            dataEnsayo.forEach(item => {
                const nroClamshell = numeroClamshellPorEnsayo(item);
                const jarraNum = Number(item.jarra);
                const idLider = Number.isFinite(jarraNum) ? lideresTiempo[jarraNum] : Number(item.id);
                const itemLider = data.find((entry) => Number(entry.id) === Number(idLider)) || item;
                const esLiderTiempo = Number(item.id) === Number(idLider);
                const esUltimo = ultimoEnsayo && Number(item.id) === Number(ultimoEnsayo.id);
                const puedeEliminar = listaOrdenEnsayo.length > 1 && esUltimo;
                const tituloEliminar = puedeEliminar
                    ? 'Eliminar último clamshell'
                    : (listaOrdenEnsayo.length <= 1
                        ? 'Debe quedar al menos uno'
                        : 'Elimina primero el Clamshell #' + nroUltimoEnsayo);
                const tCount = conteoLlenadoMetrica(itemLider, 'tiempo');
                const pAmbCount = conteoLlenadoPresion(item, 'ambiente');
                const pFrutaCount = conteoLlenadoPresion(item, 'fruta');
                const card = document.createElement('div');
                card.className = 'clamshell-card';
                card.onclick = () => abrirModal(`Editar Clamshell #${nroClamshell}`, item);
                const obs = String(item.observacion || '').trim();
                const lblPeso = etiquetasPesoUiCampo_();
                card.innerHTML = `
                    <div class="card-header">
                        <div class="id-badge">
                            <div class="number-box">${nroClamshell}</div>
                            <div>
                                <p style="font-size: 14px; font-weight: 800;">Clamshell</p>
                                <span style="font-size: 11px; color: #64748B;">${descripcionMuestraConNumero(item.ensayo || 'Ensayo 1')}</span>
                            </div>
                        </div>
                        <div class="clamshell-header-actions">
                            <div class="jarra-tag">${etiquetaJarraTarjeta_(item)}</div>
                            <button type="button" class="clamshell-delete-btn" title="${tituloEliminar}" aria-label="Eliminar clamshell" ${puedeEliminar ? '' : 'disabled '}onclick="eliminarClamshell(event, ${item.id})">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>

                    <div class="weights-panel">
                        <div class="weights-grid">
                            <div class="weight-box"><label>${lblPeso.cardP1}</label><span class="${clasePesoCampo(peso1EfectivoCampo(item, nroClamshell))}">${textoPesoCampo(peso1EfectivoCampo(item, nroClamshell))}</span></div>
                            <div class="weight-box"><label>${lblPeso.cardP2}</label><span class="${clasePesoCampo(item.p2)}">${textoPesoCampo(item.p2)}</span></div>
                            <div class="observation-box">
                                <button type="button" onclick="abrirModalObservacion(event, ${item.id})" title="Editar observación">
                                    <span class="observation-text ${obs ? '' : 'is-empty'}">${obs || 'Sin observación registrada'}</span>
                                </button>
                            </div>
                        </div>
                        <div class="metric-actions">
                            <div class="metric-btn-wrap">
                                <button class="metric-btn ${esLiderTiempo ? '' : 'is-mirrored-time'}" type="button" title="${esLiderTiempo ? 'Tiempos de la muestra (hora)' : 'Tiempo compartido por jarra (abre el clamshell líder)'}" onclick="abrirModalMetrica(event, 'tiempo', ${item.id})">
                                    <i data-lucide="timer"></i>
                                </button>
                                <span class="metric-count ${tCount.done > 0 ? 'is-filled' : ''}">${tCount.done}/${tCount.total}</span>
                            </div>
                            <div class="metric-btn-wrap">
                                <button class="metric-btn" type="button" title="Presión de vapor ambiente (Kpa)" onclick="abrirModalMetrica(event, 'presionAmbiente', ${item.id})">
                                    <i data-lucide="cloud"></i>
                                </button>
                                <span class="metric-count ${pAmbCount.done > 0 ? 'is-filled' : ''}">${pAmbCount.done}/${pAmbCount.total}</span>
                            </div>
                            <div class="metric-btn-wrap">
                                <button class="metric-btn" type="button" title="Presión de vapor fruta (Kpa)" onclick="abrirModalMetrica(event, 'presionFruta', ${item.id})">
                                    <i data-lucide="apple"></i>
                                </button>
                                <span class="metric-count ${pFrutaCount.done > 0 ? 'is-filled' : ''}">${pFrutaCount.done}/${pFrutaCount.total}</span>
                            </div>
                        </div>
                    </div>

                    ${bloqueLogisticaPesosCardHtml_(item, lblPeso)}
                `;
                container.appendChild(card);
            });
            actualizarIconos();
            actualizarBloqueoControlesPorPeso1();
        }

        function esClamshellSinDatos_(item) {
            if (!item) return false;
            if (esModoRegistroAcopio_()) {
                if (!pesoVacio(item.p4)) return false;
                if (!pesoVacio(item.despacho)) return false;
                return !String(item.observacion || '').trim();
            }
            const n = numeroClamshellPorEnsayo(item);
            if (!pesoVacio(peso1EfectivoCampo(item, n))) return false;
            if (!pesoVacio(item.p2)) return false;
            if (!pesoVacio(item.acopio)) return false;
            if (!pesoVacio(item.despacho)) return false;
            return !String(item.observacion || '').trim();
        }

        function primerClamshellVacioEnsayo_(ensayo) {
            const lista = listaClamshellsPorEnsayo_(ensayo);
            return lista.find((it) => esClamshellSinDatos_(it)) || null;
        }

        function aplicarDatosModalAClamshell_(target, jarraSel, p1Val, p2Val, acopioVal, p4Val, despachoVal) {
            target.jarra = jarraSel;
            target.p1 = p1Val;
            target.p2 = Number.isFinite(p2Val) ? p2Val : 0;
            target.acopio = Number.isFinite(acopioVal) ? acopioVal : 0;
            target.p4 = Number.isFinite(p4Val) ? p4Val : 0;
            target.despacho = Number.isFinite(despachoVal) ? despachoVal : 0;
        }

        function asegurarClamshellInicialVacio(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const existe = data.some((it) => String(it?.ensayo || 'Ensayo 1') === clave);
            if (existe) return;
            const nuevoId = (data.length ? Math.max(...data.map((d) => Number(d.id) || 0)) : 0) + 1;
            data.push({
                id: nuevoId,
                jarra: 1,
                ensayo: clave,
                p1: 0,
                p2: 0,
                acopio: 0,
                p4: 0,
                despacho: 0,
                observacion: '',
                placaVehiculo: '',
                guiaRemision: '',
                metric: metricaVacia()
            });
        }

        function muestraCampoSeleccionada_() {
            return String(document.getElementById('visual-meta-muestra')?.value || '').trim() !== '';
        }

        function actualizarBloqueoControlesPorPeso1() {
            const habilitado = muestraCampoSeleccionada_();
            const controlBar = document.querySelector('.control-equitativo-bar');
            if (controlBar) {
                controlBar.classList.toggle('is-locked', !habilitado);
                controlBar.querySelectorAll('.control-equitativo-btn').forEach((btn) => {
                    if (!btn.dataset.defaultTitle) {
                        btn.dataset.defaultTitle = btn.getAttribute('title') || '';
                    }
                    btn.disabled = !habilitado;
                    btn.setAttribute('aria-disabled', (!habilitado).toString());
                    btn.title = habilitado ? btn.dataset.defaultTitle : 'Selecciona una muestra';
                });
            }
            document.querySelectorAll('.logistica-acopio-block').forEach((block) => {
                block.classList.toggle('is-locked', !habilitado);
            });
            document.querySelectorAll('.logistica-acopio-head').forEach((head) => {
                head.setAttribute('data-locked', habilitado ? '0' : '1');
            });
        }

        async function eliminarClamshell(event, itemId) {
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            const item = data.find((entry) => Number(entry.id) === Number(itemId));
            if (!item) return;
            const lista = listaClamshellsPorEnsayo_(item.ensayo || 'Ensayo 1');
            if (lista.length <= 1) {
                mostrarToast('info', 'No se puede eliminar', 'Debe quedar al menos un clamshell en la muestra.');
                return;
            }
            if (!esUltimoClamshellPorEnsayo_(item)) return;
            const nroClamshell = numeroClamshellPorEnsayo(item);
            const mensaje = `Se eliminará Clamshell #${nroClamshell} (Jarra ${item.jarra}) del ${item.ensayo || 'Ensayo 1'}. ¿Deseas continuar?`;
            let confirmado = false;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                const resp = await swalFireSafe({
                    icon: 'warning',
                    title: 'Confirmar eliminación',
                    text: mensaje,
                    showCancelButton: true,
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'No'
                });
                confirmado = !!resp.isConfirmed;
            } else {
                confirmado = window.confirm(mensaje);
            }
            if (!confirmado) return;
            const idx = data.findIndex((entry) => Number(entry.id) === Number(itemId));
            if (idx < 0) return;
            data.splice(idx, 1);
            if (editingCardId === Number(itemId)) editingCardId = null;
            renderizarTarjetas();
            programarGuardadoDraftCompleto();
            window.PdfPreviewLive?.programar?.();
        }

        function sanitizarValorControlGlobalEnVivo(raw, opts = {}) {
            const isDeleting = Boolean(opts && opts.isDeleting);
            let v = String(raw ?? '').replace(',', '.').replace(/[^\d.]/g, '');
            const firstDot = v.indexOf('.');
            if (firstDot >= 0) {
                v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
                const [entero, decimal = ''] = v.split('.');
                v = `${entero.slice(0, 2)}.${decimal.slice(0, 1)}`;
            } else {
                v = v.slice(0, 3);
                // Regla UX solicitada: al llegar a 2 dígitos, insertar punto automáticamente.
                if (!isDeleting && v.length >= 2) {
                    const ent = v.slice(0, 2);
                    const dec = v.slice(2, 3);
                    v = dec ? `${ent}.${dec}` : `${ent}.`;
                }
            }
            return v;
        }

        function normalizarValorControlGlobal(raw) {
            const live = sanitizarValorControlGlobalEnVivo(raw);
            if (!live) return '';
            if (live.includes('.')) return live;
            // Auto-inserta decimal al confirmar cuando hay 3 dígitos (ej: 111 -> 11.1)
            if (live.length >= 3) return `${live.slice(0, 2)}.${live.slice(2, 3)}`;
            return live;
        }

        function formatearInputControlGlobal(input, final = false, opts = {}) {
            if (!input) return;
            const normalizado = final
                ? normalizarValorControlGlobal(input.value)
                : sanitizarValorControlGlobalEnVivo(input.value, opts);
            if (input.value !== normalizado) input.value = normalizado;
        }

        function abrirModalControlGlobal(tipo) {
            controlGlobalState.tipo = tipo;
            const body = document.getElementById('control-global-modal-body');
            const titulo = document.getElementById('control-global-modal-title');

            if (tipo === 'temperatura') {
                const lider = liderClamshellEnsayo_(obtenerEnsayoActivo());
                const muestra = lider?.metric?.temperatura || {};
                titulo.textContent = 'Control equitativo · Temperatura ambiente y pulpa (todos)';
                body.innerHTML = `
                    <p class="metric-mini-title">Temperatura ambiente (°C)</p>
                    <div class="metric-grid-4">
                        <div class="form-group"><label>Inicio</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-amb-inicio" value="${muestra.inicioAmbiente || ''}"></div>
                        <div class="form-group"><label>Término</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-amb-termino" value="${muestra.terminoAmbiente || ''}"></div>
                        <div class="form-group"><label>Llegada</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-amb-llegada" value="${muestra.llegadaAmbiente || ''}"></div>
                        <div class="form-group"><label>Despacho</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-amb-despacho" value="${muestra.despachoAmbiente || ''}"></div>
                    </div>
                    <p class="metric-mini-title">Temperatura pulpa (°C)</p>
                    <div class="metric-grid-4">
                        <div class="form-group"><label>Inicio</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-pulpa-inicio" value="${muestra.inicioPulpa || ''}"></div>
                        <div class="form-group"><label>Término</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-pulpa-termino" value="${muestra.terminoPulpa || ''}"></div>
                        <div class="form-group"><label>Llegada</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-pulpa-llegada" value="${muestra.llegadaPulpa || ''}"></div>
                        <div class="form-group"><label>Despacho</label><input type="text" inputmode="decimal" maxlength="4" id="visual-temp-pulpa-despacho" value="${muestra.despachoPulpa || ''}"></div>
                    </div>
                `;
            } else {
                const lider = liderClamshellEnsayo_(obtenerEnsayoActivo());
                const muestra = lider?.metric?.humedad || {};
                titulo.textContent = 'Control equitativo · Humedad (todos)';
                body.innerHTML = `
                    <div class="metric-grid-4">
                        <div class="form-group"><label>Inicio</label><input type="text" inputmode="decimal" maxlength="4" id="visual-cg-humedad-inicio" value="${muestra.inicio || ''}"></div>
                        <div class="form-group"><label>Término</label><input type="text" inputmode="decimal" maxlength="4" id="visual-cg-humedad-termino" value="${muestra.termino || ''}"></div>
                        <div class="form-group"><label>Llegada</label><input type="text" inputmode="decimal" maxlength="4" id="visual-cg-humedad-llegada" value="${muestra.llegada || ''}"></div>
                        <div class="form-group"><label>Despacho</label><input type="text" inputmode="decimal" maxlength="4" id="visual-cg-humedad-despacho" value="${muestra.despacho || ''}"></div>
                    </div>
                `;
            }

            body.querySelectorAll('input').forEach((input) => {
                formatearInputControlGlobal(input, true);
                input.addEventListener('input', (ev) => {
                    const inputType = String(ev?.inputType || '');
                    const isDeleting = inputType.includes('delete');
                    formatearInputControlGlobal(input, false, { isDeleting });
                    aplicarControlGlobalDesdeFormulario(false);
                });
                input.addEventListener('change', () => {
                    formatearInputControlGlobal(input, true);
                    aplicarControlGlobalDesdeFormulario(false);
                });
            });
            document.getElementById('control-global-modal-overlay').style.display = 'flex';
        }

        function cerrarModalControlGlobal() {
            document.getElementById('control-global-modal-overlay').style.display = 'none';
            const cgBody = document.getElementById('control-global-modal-body');
            if (cgBody) cgBody.innerHTML = '';
        }

        function numeroSeguro(valor) {
            const n = Number(valor);
            return Number.isFinite(n) ? n : null;
        }

        function calcularPresionVaporAmbienteAshrae(tempC, humedadRelativa) {
            const t = numeroSeguro(tempC);
            const hr = numeroSeguro(humedadRelativa);
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

        function calcularPresionVaporPulpaAshrae(tempPulpaC) {
            const t = numeroSeguro(tempPulpaC);
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

        const CAMPOS_PRESION_VAPOR = [
            'presionAmbienteInicio', 'presionAmbienteTermino', 'presionAmbienteLlegada', 'presionAmbienteDespacho',
            'presionFrutaInicio', 'presionFrutaTermino', 'presionFrutaLlegada', 'presionFrutaDespacho'
        ];
        const CAMPOS_TEMP_MUESTRA = [
            'inicioAmbiente', 'inicioPulpa',
            'terminoAmbiente', 'terminoPulpa',
            'llegadaAmbiente', 'llegadaPulpa',
            'despachoAmbiente', 'despachoPulpa'
        ];
        const CAMPOS_HUM_MUESTRA = ['inicio', 'termino', 'llegada', 'despacho'];

        function clamshellsEnsayoOrdenados(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            return data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id));
        }

        function liderClamshellEnsayo_(ensayo) {
            return clamshellsEnsayoOrdenados(ensayo)[0] || null;
        }

        function limpiarPresionesSinFuenteMetrica_(metric) {
            if (!metric) return;
            const ta = metric.temperatura = metric.temperatura || metricaVacia().temperatura;
            const h = metric.humedad = metric.humedad || metricaVacia().humedad;
            const amb = [
                ['presionAmbienteInicio', 'inicioAmbiente', 'inicio'],
                ['presionAmbienteTermino', 'terminoAmbiente', 'termino'],
                ['presionAmbienteLlegada', 'llegadaAmbiente', 'llegada'],
                ['presionAmbienteDespacho', 'despachoAmbiente', 'despacho']
            ];
            amb.forEach(([pk, tk, hk]) => {
                const tempOk = String(ta[tk] || '').trim() !== '';
                const humOk = String(h[hk] || '').trim() !== '';
                if (!tempOk || !humOk) ta[pk] = '';
            });
            const fru = [
                ['presionFrutaInicio', 'inicioPulpa'],
                ['presionFrutaTermino', 'terminoPulpa'],
                ['presionFrutaLlegada', 'llegadaPulpa'],
                ['presionFrutaDespacho', 'despachoPulpa']
            ];
            fru.forEach(([pk, tk]) => {
                if (String(ta[tk] || '').trim() === '') ta[pk] = '';
            });
        }

        function asegurarMetricasLimpiasEnsayoSinCaptura_(ensayo) {
            const lista = clamshellsEnsayoOrdenados(ensayo);
            if (!lista.length) return;
            const sinCaptura = lista.every((it) => esClamshellSinDatos_(it));
            if (!sinCaptura) {
                lista.forEach((it) => limpiarPresionesSinFuenteMetrica_(it.metric));
                return;
            }
            lista.forEach((it) => {
                it.metric = metricaVacia();
                it.observacion = '';
                it.placaVehiculo = '';
                it.guiaRemision = '';
            });
        }

        function filaLlenadoJarraTieneDatosPdf_(fila) {
            if (!fila) return false;
            return ['inicio', 'termino', 'jarra', 'traslado', 'obs', 'tipo']
                .some((k) => String(fila[k] ?? '').trim() !== '');
        }

        function ensayoTieneFilasLlenadoJarrasConDatos_(ensayo) {
            const clave = String(ensayo || '').trim();
            if (!clave) return false;
            return obtenerFilasLlenadoJarras(clave).some((f) => filaLlenadoJarraTieneDatosPdf_(f));
        }

        function contarCamposControlMuestraMetrica_(metric) {
            if (!metric) return 0;
            const temp = metric.temperatura || {};
            const hum = metric.humedad || {};
            let n = 0;
            ['inicioAmbiente', 'terminoAmbiente', 'llegadaAmbiente', 'despachoAmbiente',
                'inicioPulpa', 'terminoPulpa', 'llegadaPulpa', 'despachoPulpa']
                .forEach((k) => { if (String(temp[k] || '').trim() !== '') n++; });
            ['inicio', 'termino', 'llegada', 'despacho']
                .forEach((k) => { if (String(hum[k] || '').trim() !== '') n++; });
            return n;
        }

        function ensayoTieneCapturaOCompletoCampo_(ensayo) {
            const clave = String(ensayo || '').trim();
            if (!clave || ensayoEstaRegistradoHoy(clave)) return false;
            if (ensayoAportaDatosPdfCampo_(clave)) return true;
            return metaEnsayoCompletaParaOrden(clave);
        }

        function ensayoAportaDatosPdfCampo_(ensayo) {
            const clave = String(ensayo || '').trim();
            if (!clave) return false;
            const items = data.filter((it) => String(it.ensayo || 'Ensayo 1') === clave);
            if (items.some((it) => !esClamshellSinDatos_(it))) return true;
            if (ensayoTieneFilasLlenadoJarrasConDatos_(clave)) return true;
            const camposControl = items.reduce((acc, it) => acc + contarCamposControlMuestraMetrica_(it?.metric), 0);
            if (camposControl < 1) return false;
            const soloMetaVisita = items.every((it) => esClamshellSinDatos_(it))
                && !ensayoTieneFilasLlenadoJarrasConDatos_(clave)
                && ensayoMetaTieneDatosTrabajo(clave)
                && !metaEnsayoCompletaParaOrden(clave);
            if (soloMetaVisita && camposControl < 2) return false;
            return true;
        }

        function muestraPdfCampoTieneContenido_(bloque) {
            if (!bloque) return false;
            const filas = Array.isArray(bloque.filas) ? bloque.filas : [];
            const hayFila = filas.some((f) => {
                const pesos = ['p1', 'p2', 'p3', 'p4', 'p5', 'llegada', 'despacho'];
                if (pesos.some((k) => {
                    const v = String(f?.[k] ?? '').trim();
                    return v !== '' && v !== '0';
                })) return true;
                const tiempos = ['tInicioCosecha', 'tPerdida', 'tTermino', 'tLlegada', 'tAcopioCalibrado', 'tTerminoCalibrado', 'tDespacho'];
                if (tiempos.some((k) => String(f?.[k] ?? '').trim() !== '')) return true;
                const llenado = ['jarraLlenado', 'jarraInicio', 'jarraTermino', 'jarraTiempo', 'trasladoObs'];
                if (llenado.some((k) => String(f?.[k] ?? '').trim() !== '')) return true;
                if (String(f?.observacion ?? '').trim() !== '') return true;
                return false;
            });
            if (hayFila) return true;
            const p2 = bloque.pagina2 || {};
            const tieneArr = (arr) => Array.isArray(arr) && arr.some((v) => String(v || '').trim() !== '');
            if (tieneArr(p2.humedad) || tieneArr(p2.tempAmbiente) || tieneArr(p2.presionAmb) || tieneArr(p2.presionFruta)) {
                return true;
            }
            if (String(p2.observaciones || '').trim() !== '') return true;
            if (String(bloque.observacionesFormato || '').trim() !== '') return true;
            return false;
        }

        function copiarPresionesVaporDesde(primer, destino) {
            if (!primer || !destino) return;
            if (!destino.metric) destino.metric = metricaVacia();
            if (!destino.metric.temperatura) destino.metric.temperatura = metricaVacia().temperatura;
            const taP = primer.metric?.temperatura || {};
            const taD = destino.metric.temperatura;
            CAMPOS_PRESION_VAPOR.forEach((k) => {
                taD[k] = taP[k] ?? '';
            });
        }

        /** Temp. y humedad son por muestra/ensayo: unificar desde el líder (o primer valor capturado) en todos los clamshells. */
        function sincronizarTempHumedadCompartidaEnsayo_(ensayo) {
            const lista = clamshellsEnsayoOrdenados(ensayo);
            if (!lista.length) return;

            const mergedTemp = {};
            const mergedHum = {};
            lista.forEach((item) => {
                const t = item.metric?.temperatura || {};
                const h = item.metric?.humedad || {};
                CAMPOS_TEMP_MUESTRA.forEach((k) => {
                    if (!String(mergedTemp[k] || '').trim() && String(t[k] || '').trim()) {
                        mergedTemp[k] = t[k];
                    }
                });
                CAMPOS_HUM_MUESTRA.forEach((k) => {
                    if (!String(mergedHum[k] || '').trim() && String(h[k] || '').trim()) {
                        mergedHum[k] = h[k];
                    }
                });
            });

            const hayDatos = CAMPOS_TEMP_MUESTRA.some((k) => String(mergedTemp[k] || '').trim())
                || CAMPOS_HUM_MUESTRA.some((k) => String(mergedHum[k] || '').trim());
            if (!hayDatos) return;

            lista.forEach((item) => {
                if (!item.metric) item.metric = metricaVacia();
                if (!item.metric.temperatura) item.metric.temperatura = metricaVacia().temperatura;
                if (!item.metric.humedad) item.metric.humedad = metricaVacia().humedad;
                CAMPOS_TEMP_MUESTRA.forEach((k) => {
                    item.metric.temperatura[k] = mergedTemp[k] || '';
                });
                CAMPOS_HUM_MUESTRA.forEach((k) => {
                    item.metric.humedad[k] = mergedHum[k] || '';
                });
            });
        }

        /** Presión ambiente y pulpa: se calculan con el Clamshell #1 del ensayo y se reflejan en sus clamshells. */
        function recalcularPresionesParaEnsayo(ensayo) {
            sincronizarTempHumedadCompartidaEnsayo_(ensayo);
            const lista = clamshellsEnsayoOrdenados(ensayo);
            if (!lista.length) return;
            const primer = lista[0];
            if (!primer.metric) primer.metric = metricaVacia();
            if (!primer.metric.temperatura) primer.metric.temperatura = metricaVacia().temperatura;
            if (!primer.metric.humedad) primer.metric.humedad = metricaVacia().humedad;

            const ta = primer.metric.temperatura;
            const h = primer.metric.humedad;
            ta.presionAmbienteInicio = calcularPresionVaporAmbienteAshrae(ta.inicioAmbiente, h.inicio);
            ta.presionAmbienteTermino = calcularPresionVaporAmbienteAshrae(ta.terminoAmbiente, h.termino);
            ta.presionAmbienteLlegada = calcularPresionVaporAmbienteAshrae(ta.llegadaAmbiente, h.llegada);
            ta.presionAmbienteDespacho = calcularPresionVaporAmbienteAshrae(ta.despachoAmbiente, h.despacho);
            ta.presionFrutaInicio = calcularPresionVaporPulpaAshrae(ta.inicioPulpa);
            ta.presionFrutaTermino = calcularPresionVaporPulpaAshrae(ta.terminoPulpa);
            ta.presionFrutaLlegada = calcularPresionVaporPulpaAshrae(ta.llegadaPulpa);
            ta.presionFrutaDespacho = calcularPresionVaporPulpaAshrae(ta.despachoPulpa);

            for (let i = 1; i < lista.length; i++) {
                copiarPresionesVaporDesde(primer, lista[i]);
            }
            limpiarPresionesSinFuenteMetrica_(primer.metric);
            for (let i = 1; i < lista.length; i++) {
                limpiarPresionesSinFuenteMetrica_(lista[i].metric);
            }
        }

        function recalcularPresionesParaTodos() {
            const ensayos = [...new Set(data.map((it) => String(it.ensayo || 'Ensayo 1')))];
            ensayos.forEach((ensayo) => recalcularPresionesParaEnsayo(ensayo));
        }

        function aplicarControlGlobalDesdeFormulario(cerrarAlFinal = false, opts = {}) {
            const ensayo = String(obtenerEnsayoActivo() || 'Ensayo 1');
            const itemsEnsayo = data.filter((item) => String(item.ensayo || 'Ensayo 1') === ensayo);
            if (controlGlobalState.tipo === 'temperatura') {
                const ambInicio = document.getElementById('visual-temp-amb-inicio')?.value ?? '';
                const ambTermino = document.getElementById('visual-temp-amb-termino')?.value ?? '';
                const ambLlegada = document.getElementById('visual-temp-amb-llegada')?.value ?? '';
                const ambDespacho = document.getElementById('visual-temp-amb-despacho')?.value ?? '';
                const pulpaInicio = document.getElementById('visual-temp-pulpa-inicio')?.value ?? '';
                const pulpaTermino = document.getElementById('visual-temp-pulpa-termino')?.value ?? '';
                const pulpaLlegada = document.getElementById('visual-temp-pulpa-llegada')?.value ?? '';
                const pulpaDespacho = document.getElementById('visual-temp-pulpa-despacho')?.value ?? '';
                itemsEnsayo.forEach((item) => {
                    if (!item.metric) item.metric = metricaVacia();
                    if (!item.metric.temperatura) item.metric.temperatura = metricaVacia().temperatura;
                    item.metric.temperatura.inicioAmbiente = ambInicio;
                    item.metric.temperatura.terminoAmbiente = ambTermino;
                    item.metric.temperatura.llegadaAmbiente = ambLlegada;
                    item.metric.temperatura.despachoAmbiente = ambDespacho;
                    item.metric.temperatura.inicioPulpa = pulpaInicio;
                    item.metric.temperatura.terminoPulpa = pulpaTermino;
                    item.metric.temperatura.llegadaPulpa = pulpaLlegada;
                    item.metric.temperatura.despachoPulpa = pulpaDespacho;
                });
            } else if (controlGlobalState.tipo === 'humedad') {
                const hInicio = document.getElementById('visual-cg-humedad-inicio')?.value ?? '';
                const hTermino = document.getElementById('visual-cg-humedad-termino')?.value ?? '';
                const hLlegada = document.getElementById('visual-cg-humedad-llegada')?.value ?? '';
                const hDesp = document.getElementById('visual-cg-humedad-despacho')?.value ?? '';
                itemsEnsayo.forEach((item) => {
                    if (!item.metric) item.metric = metricaVacia();
                    if (!item.metric.humedad) item.metric.humedad = metricaVacia().humedad;
                    item.metric.humedad.inicio = hInicio;
                    item.metric.humedad.termino = hTermino;
                    item.metric.humedad.llegada = hLlegada;
                    item.metric.humedad.despacho = hDesp;
                });
            }

            recalcularPresionesParaEnsayo(ensayo);
            if (!opts.silencioso) {
                renderizarTarjetas();
                programarGuardadoDraftCompleto();
            }
            if (cerrarAlFinal) cerrarModalControlGlobal();
        }

        function guardarModalControlGlobal() {
            if (!data.length) {
                mostrarAlertaRegla('Sin clamshell', 'Agrega al menos un clamshell para aplicar control global.');
                return;
            }
            const body = document.getElementById('control-global-modal-body');
            const incompleto = body
                ? [...body.querySelectorAll('input')].some((inp) => String(inp.value || '').trim().endsWith('.'))
                : false;
            if (incompleto) {
                mostrarAlertaRegla('Dato incompleto', 'Completa el decimal. Ejemplo válido: 11.2 (no 11.).');
                return;
            }
            aplicarControlGlobalDesdeFormulario(true);
            programarGuardadoDraftCompleto();
            marcarBotonGuardado('btn-save-control-global');
            mostrarToast('success', 'Guardado', 'Control global aplicado y capturado.');
        }

        function obtenerFilasLlenadoJarras(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            if (!llenadoJarrasState.porEnsayo[clave]) llenadoJarrasState.porEnsayo[clave] = [];
            return llenadoJarrasState.porEnsayo[clave];
        }

        function buscarIndiceFilaJarrasPorId(ensayo, idFila) {
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const idx = filas.findIndex((f) => Number(f.id) === Number(idFila));
            return idx;
        }

        function etiquetaTipoLlenadoJarras(tipo) {
            if (tipo === 'C') return 'Cosecha';
            if (tipo === 'T') return 'Traslado';
            return '—';
        }

        function parseRangoJarraLlenado(valor) {
            const s = String(valor ?? '').trim();
            if (!s.includes('-')) return null;
            const partes = s.split('-').map((p) => p.trim()).filter(Boolean);
            if (partes.length !== 2) return null;
            const a = Number(partes[0]);
            const b = Number(partes[1]);
            if (!Number.isFinite(a) || !Number.isFinite(b) || b !== a + 1) return null;
            return { a, b, key: `${a}-${b}` };
        }

        /** Si el usuario no vació el panel, deja al menos la fila inicial de cosecha. */
        function asegurarFilasInicialesEnsayo(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const filas = obtenerFilasLlenadoJarras(clave);
            if (!filas.length && !llenadoJarrasState.usuarioVacio?.[clave]) {
                filas.push({
                    id: siguienteIdFilaJarras++,
                    ensayo: clave,
                    jarra: '1',
                    tipo: 'C',
                    inicio: '',
                    termino: '',
                    tiempo: ''
                });
            }
            return filas;
        }

        function ensayoSinFilasLlenadoJarras_(ensayo) {
            return obtenerFilasLlenadoJarras(ensayo).length === 0;
        }

        function marcarLlenadoJarrasVacioPorUsuario_(ensayo, vacio) {
            const clave = String(ensayo || 'Ensayo 1');
            if (!llenadoJarrasState.usuarioVacio) llenadoJarrasState.usuarioVacio = {};
            if (vacio) llenadoJarrasState.usuarioVacio[clave] = true;
            else delete llenadoJarrasState.usuarioVacio[clave];
        }

        function limpiarJarraClamshellsSiSinLlenado_(ensayo) {
            if (!ensayoSinFilasLlenadoJarras_(ensayo)) return;
            const clave = String(ensayo || 'Ensayo 1');
            data.forEach((it) => {
                if (String(it?.ensayo || 'Ensayo 1') !== clave) return;
                it.jarra = '';
            });
        }

        function listaJarrasPesosPorEnsayo(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const jars = data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                .map((it) => Number(it.jarra))
                .filter((n) => Number.isFinite(n) && n > 0);
            return [...new Set(jars)].sort((x, y) => x - y);
        }

        function maxNumeroJarraPesosPorEnsayo(ensayo) {
            const lista = listaJarrasPesosPorEnsayo(ensayo);
            return lista.length ? Math.max(...lista) : 0;
        }

        function siguienteNumeroJarraDisponible(ensayo) {
            const maxPesos = maxNumeroJarraPesosPorEnsayo(ensayo);
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const nums = filas
                .flatMap((f) => {
                    const r = parseRangoJarraLlenado(f.jarra);
                    if (r) return [r.a, r.b];
                    const n = Number(String(f.jarra ?? '').trim());
                    return Number.isFinite(n) ? [n] : [];
                })
                .filter((n) => Number.isFinite(n) && n > 0);
            const maxFilas = nums.length ? Math.max(...nums) : 0;
            return Math.max(maxPesos, maxFilas, 0) + 1;
        }

        function filasLlenadoJarrasExcepto(ensayo, indiceExcluido) {
            return obtenerFilasLlenadoJarras(ensayo).filter((_, idx) => idx !== indiceExcluido);
        }

        function filaCosechaParaJarra(ensayo, nJarra, excluirIndice) {
            const otras = filasLlenadoJarrasExcepto(ensayo, excluirIndice);
            return otras.find((f) => f.tipo === 'C' && String(f.jarra) === String(nJarra)) || null;
        }

        function terminoCosechaParaJarra(ensayo, nJarra, excluirIndice) {
            const c = filaCosechaParaJarra(ensayo, nJarra, excluirIndice);
            const t = String(c?.termino || '').trim();
            return t || '';
        }

        function terminoTrasvasadoParaJarra(ensayo, nJarra, excluirIndice) {
            const t = filaTrasladoQueAplicaAJarra(ensayo, nJarra, excluirIndice);
            const fin = String(t?.termino || '').trim();
            return fin || '';
        }

        function inicioSugeridoCosecha(ensayo, valorJarra, excluirIndice) {
            const n = Number(String(valorJarra ?? '').trim());
            if (!Number.isFinite(n) || n <= 1) return '';
            const nPrev = n - 1;
            const finTrasPrev = terminoTrasvasadoParaJarra(ensayo, nPrev, excluirIndice);
            if (finTrasPrev) return finTrasPrev;
            const finCosPrev = terminoCosechaParaJarra(ensayo, nPrev, excluirIndice);
            if (finCosPrev) return finCosPrev;
            return '';
        }

        function inicioSugeridoTrasvasado(ensayo, valorJarra, excluirIndice) {
            const txt = String(valorJarra ?? '').trim();
            const rango = parseRangoJarraLlenado(txt);
            if (rango) {
                const tA = terminoCosechaParaJarra(ensayo, rango.a, excluirIndice);
                const tB = terminoCosechaParaJarra(ensayo, rango.b, excluirIndice);
                const mA = minutosDesdeHora(tA);
                const mB = minutosDesdeHora(tB);
                if (mA === null && mB === null) return '';
                if (mA === null) return tB;
                if (mB === null) return tA;
                return mA >= mB ? tA : tB;
            }
            const n = Number(txt);
            if (!Number.isFinite(n) || n <= 0) return '';
            return terminoCosechaParaJarra(ensayo, n, excluirIndice);
        }

        function sincronizarInicioTrasvasadoDesdeCosecha(ensayo, nJarraObjetivo = null) {
            const filas = obtenerFilasLlenadoJarras(ensayo);
            filas.forEach((f) => {
                if (f.tipo !== 'T') return;
                const txt = String(f.jarra ?? '').trim();
                const rango = parseRangoJarraLlenado(txt);
                if (nJarraObjetivo !== null) {
                    const objetivo = Number(nJarraObjetivo);
                    if (rango) {
                        if (rango.a !== objetivo && rango.b !== objetivo) return;
                    } else {
                        const n = Number(txt);
                        if (!Number.isFinite(n) || n !== objetivo) return;
                    }
                }
                const inicioSug = inicioSugeridoTrasvasado(ensayo, txt, -1);
                if (!inicioSug) return;
                f.inicio = inicioSug;
                f.tiempo = calcularTiempoEmpleado(f.inicio, f.termino);
            });
        }

        function sincronizarInicioCosechaDesdeAnterior(ensayo, nJarraObjetivo = null) {
            const filas = obtenerFilasLlenadoJarras(ensayo);
            filas.forEach((f, idx) => {
                if (f.tipo !== 'C') return;
                const n = Number(String(f.jarra ?? '').trim());
                if (!Number.isFinite(n) || n <= 1) return;
                if (nJarraObjetivo !== null && n !== Number(nJarraObjetivo)) return;
                const inicioSug = inicioSugeridoCosecha(ensayo, n, idx);
                if (!inicioSug) return;
                f.inicio = inicioSug;
                f.tiempo = calcularTiempoEmpleado(f.inicio, f.termino);
            });
        }

        function filaTrasladoQueAplicaAJarra(ensayo, nJarra, excluirIndice) {
            const otras = filasLlenadoJarrasExcepto(ensayo, excluirIndice);
            return otras.find((f) => {
                if (f.tipo !== 'T') return false;
                const r = parseRangoJarraLlenado(f.jarra);
                if (r) return nJarra === r.a || nJarra === r.b;
                return String(f.jarra) === String(nJarra);
            }) || null;
        }

        function jarraYaTieneCosechaCompleta(ensayo, nJarra, excluirIndice) {
            const c = filaCosechaParaJarra(ensayo, nJarra, excluirIndice);
            return !!(c && String(c.inicio || '').trim() && String(c.termino || '').trim());
        }

        function jarraYaTieneTrasladoCompleto(ensayo, nJarra, excluirIndice) {
            const t = filaTrasladoQueAplicaAJarra(ensayo, nJarra, excluirIndice);
            return !!(t && String(t.inicio || '').trim() && String(t.termino || '').trim());
        }

        function construirOpcionesJarraSegunTipo(ensayo, fila, indice) {
            const valorActualTxt = String(fila.jarra ?? '').trim() || '1';
            const valorActualNum = Number(valorActualTxt) || 1;
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const otras = filas.filter((_, idx) => idx !== indice);
            const estado = new Map();

            otras.forEach((f) => {
                const txt = String(f.jarra ?? '').trim();
                const r = parseRangoJarraLlenado(txt);
                if (r) {
                    [r.a, r.b].forEach((n) => {
                        if (!estado.has(n)) estado.set(n, { c: false, t: false });
                        const e = estado.get(n);
                        if (f.tipo === 'C') e.c = true;
                        if (f.tipo === 'T') e.t = true;
                    });
                    return;
                }
                const n = Number(txt);
                if (!Number.isFinite(n) || n <= 0) return;
                if (!estado.has(n)) estado.set(n, { c: false, t: false });
                const e = estado.get(n);
                if (f.tipo === 'C') e.c = true;
                if (f.tipo === 'T') e.t = true;
            });

            const jarrasRegistradas = [...estado.keys()].sort((a, b) => a - b);
            const maxActual = jarrasRegistradas.length ? Math.max(...jarrasRegistradas, valorActualNum) : valorActualNum;
            const posibles = [];

            if (fila.tipo === 'C') {
                for (let n = 1; n <= maxActual; n++) {
                    const e = estado.get(n) || { c: false, t: false };
                    if (!e.c) posibles.push(n);
                }
                posibles.push(maxActual + 1);
            } else if (fila.tipo === 'T') {
                for (let n = 1; n <= maxActual; n++) {
                    const e = estado.get(n) || { c: false, t: false };
                    if (e.c && !e.t) posibles.push(n);
                }
                for (let n = 1; n < maxActual; n++) {
                    const a = estado.get(n) || { c: false, t: false };
                    const b = estado.get(n + 1) || { c: false, t: false };
                    if (a.c && b.c && !a.t && !b.t) posibles.push(`${n}-${n + 1}`);
                }
                // Permite saltar a la siguiente jarra para iniciar nueva cosecha
                // (al seleccionar, el tipo se reajusta a Cosecha por reglas permitidas).
                posibles.push(maxActual + 1);
            } else {
                for (let n = 1; n <= maxActual + 1; n++) posibles.push(n);
            }

            const posiblesTxt = posibles.map((x) => String(x));
            const incluirActual = fila.tipo !== 'T' || posiblesTxt.includes(valorActualTxt);
            if (incluirActual && !posiblesTxt.includes(valorActualTxt)) posibles.push(valorActualTxt);
            const unicos = [...new Set(posibles.map((x) => String(x)))].sort((a, b) => {
                const ra = parseRangoJarraLlenado(a);
                const rb = parseRangoJarraLlenado(b);
                const va = ra ? ra.a : Number(a);
                const vb = rb ? rb.a : Number(b);
                return va - vb;
            });
            return unicos.map((v) => {
                const sel = v === valorActualTxt ? ' selected' : '';
                const esRango = !!parseRangoJarraLlenado(v);
                const label = esRango ? `Traslado ${v}` : `Jarra ${v}`;
                return `<option value="${v}"${sel}>${label}</option>`;
            }).join('');
        }

        function tiposPermitidosSegunJarra(ensayo, fila, indice) {
            const j = String(fila.jarra ?? '').trim();
            const rango = parseRangoJarraLlenado(j);
            if (rango) return ['T'];
            const n = Number(j);
            if (!Number.isFinite(n) || n <= 0) return [];
            const tieneC = jarraYaTieneCosechaCompleta(ensayo, n, indice);
            const tieneT = jarraYaTieneTrasladoCompleto(ensayo, n, indice);
            if (!tieneC) return ['C'];
            if (tieneC && !tieneT) return ['T'];
            return [];
        }

        function construirOpcionesTipo(ensayo, fila, indice) {
            const per = tiposPermitidosSegunJarra(ensayo, fila, indice);
            const v = fila.tipo;
            if (v === 'C') return '<option value="C" selected>Cosecha</option>';
            if (v === 'T') return '<option value="T" selected>Traslado</option>';
            const opts = [];
            const add = (val, lab) => {
                const sel = v === val ? ' selected' : '';
                opts.push(`<option value="${val}"${sel}>${lab}</option>`);
            };
            add('', 'Elegir…');
            if (per.includes('C')) add('C', 'Cosecha');
            if (per.includes('T')) add('T', 'Traslado');
            if (v && !per.includes(v)) add(v, `${v} · revisar jarra`);
            return opts.join('');
        }

        function minutosDesdeHora(hora) {
            if (!hora) return null;
            const [h, m] = String(hora).split(':').map(Number);
            if ([h, m].some((x) => Number.isNaN(x))) return null;
            return (h * 60) + m;
        }

        function horaMasMinutosCampo_(hhmm, minutos) {
            const base = minutosDesdeHora(hhmm);
            if (base === null) return '';
            let total = base + (Number(minutos) || 0);
            if (total < 0) total = 0;
            const nh = Math.floor(total / 60) % 24;
            const nm = total % 60;
            return String(nh).padStart(2, '0') + ':' + String(nm).padStart(2, '0');
        }

        /** Jarras + tiempos líder alineados con sincronizarTiempoPorJarra y validarSecuenciaTiempoMetrica. */
        function construirSimulacionJarrasYTiemposCampo_(esAcopio, ensayo, idInicial) {
            let idSeq = Number(idInicial) || 1;
            const j1cIni = '08:00';
            const j1cFin = '08:20';
            const j1tIni = '08:20';
            const j1tFin = '08:45';
            const j2cIni = '08:50';
            const j2cFin = '09:10';
            const j2tIni = '09:10';
            const j2tFin = '09:30';
            const terminoCosechaGlobal = j2tFin;
            const llegada = horaMasMinutosCampo_(terminoCosechaGlobal, 15);
            const despacho = horaMasMinutosCampo_(llegada, 15);
            const jarrasFilas = [
                { id: idSeq++, ensayo, jarra: '1', tipo: 'C', inicio: j1cIni, termino: j1cFin, tiempo: '' },
                { id: idSeq++, ensayo, jarra: '1', tipo: 'T', inicio: j1tIni, termino: j1tFin, tiempo: '' },
                { id: idSeq++, ensayo, jarra: '2', tipo: 'C', inicio: j2cIni, termino: j2cFin, tiempo: '' },
                { id: idSeq++, ensayo, jarra: '2', tipo: 'T', inicio: j2tIni, termino: j2tFin, tiempo: '' }
            ];
            const tiempoVisual = {
                inicioCosecha: j1cIni,
                inicioPerdida: j1tFin,
                terminoCosecha: terminoCosechaGlobal,
                llegadaAcopio: llegada,
                despachoAcopio: despacho
            };
            const tiempoAcopio = {
                inicioCosecha: j1cIni,
                terminoCosecha: terminoCosechaGlobal,
                llegadaAcopio: llegada,
                acopioCalibrado: horaMasMinutosCampo_(llegada, 5),
                terminoCalibrado: horaMasMinutosCampo_(llegada, 10),
                despachoAcopio: despacho
            };
            return {
                jarrasFilas,
                tiempoLider: esAcopio ? tiempoAcopio : tiempoVisual,
                nextId: idSeq
            };
        }

        function validarOrdenCosechaTrasladoFila(ensayo, fila, indice) {
            if (fila.tipo !== 'T') return '';
            const rango = parseRangoJarraLlenado(fila.jarra);
            const jarras = rango ? [rango.a, rango.b] : [Number(String(fila.jarra ?? '').trim())].filter((n) => Number.isFinite(n));
            const tin = minutosDesdeHora(fila.inicio);
            if (tin === null) return '';
            for (let k = 0; k < jarras.length; k++) {
                const n = jarras[k];
                const c = filaCosechaParaJarra(ensayo, n, indice);
                if (!c) return `Falta cosecha registrada para jarra ${n}.`;
                const tc = minutosDesdeHora(c.termino);
                if (tc === null) return `Completa término de cosecha (jarra ${n}) antes del traslado.`;
                if (tin < tc) return `Traslado: inicio debe ser ≥ término de cosecha (${c.termino}) en jarra ${n}.`;
            }
            return '';
        }

        function ordenVisualFilasJarras(filas) {
            const pesoTipo = (tipo) => (tipo === 'C' ? 0 : tipo === 'T' ? 1 : 9);
            const pesoJarra = (jarraVal) => {
                const r = parseRangoJarraLlenado(String(jarraVal ?? '').trim());
                if (r) return r.a;
                const n = Number(String(jarraVal ?? '').trim());
                return Number.isFinite(n) ? n : 9999;
            };
            return [...filas].sort((a, b) => {
                const ja = pesoJarra(a.jarra);
                const jb = pesoJarra(b.jarra);
                if (ja !== jb) return ja - jb;
                return pesoTipo(a.tipo) - pesoTipo(b.tipo);
            });
        }

        function maxJarraDesdeFilas(filas) {
            let max = 1;
            filas.forEach((f) => {
                const txt = String(f.jarra ?? '').trim();
                const r = parseRangoJarraLlenado(txt);
                if (r) {
                    max = Math.max(max, r.a, r.b);
                    return;
                }
                const n = Number(txt);
                if (Number.isFinite(n) && n > 0) max = Math.max(max, n);
            });
            return max;
        }

        function renderizarPanelLlenadoJarras() {
            const panel = document.getElementById('llenado-jarras-panel-body');
            if (!panel) return;
            const ensayos = [obtenerEnsayoActivo()];
            ensayos.forEach((ensayo) => obtenerFilasLlenadoJarras(ensayo));

            panel.innerHTML = ensayos.map((ensayo) => {
                const filas = asegurarFilasInicialesEnsayo(ensayo);
                filas.forEach((fila) => {
                    const t = calcularTiempoEmpleado(fila.inicio, fila.termino);
                    if (t) fila.tiempo = t;
                });
                const ordenadas = ordenVisualFilasJarras(filas);
                const filasHtml = ordenadas.map((fila, pos) => {
                    const indiceReal = buscarIndiceFilaJarrasPorId(ensayo, fila.id);
                    const tiempo = calcularTiempoEmpleado(fila.inicio, fila.termino) || fila.tiempo || "0'";
                    const tiempoLegible = `${String(tiempo).replace("'", '').trim() || '0'} mnts`;
                    const jarraVisual = String(fila.jarra || '1').trim() || '1';
                    const err = indiceReal >= 0 ? validarOrdenCosechaTrasladoFila(ensayo, fila, indiceReal) : '';
                    const filaErrClass = err ? ' lj-fila--alerta' : '';
                    return `
                        <article class="lj-fila-card${filaErrClass}" onclick="abrirModalHorasLlenado('${ensayo}', ${fila.id})">
                            <div class="lj-fila-left">
                                <select id="visual-m-jarra-${slugIdSeguro(ensayo)}-${fila.id}" data-link-master="visual-m-jarra" class="lj-campo-jarra lj-campo-jarra-selector" onchange="actualizarFilaLlenadoJarras('${ensayo}', ${fila.id}, 'jarra', this.value)" onclick="event.stopPropagation()">
                                    ${construirOpcionesJarraSegunTipo(ensayo, fila, indiceReal)}
                                </select>
                                <div class="lj-fila-jarra-num">${jarraVisual}</div>
                                <div class="lj-fila-tiempo-label">T. Empleado: ${tiempoLegible}</div>
                            </div>
                            <div class="lj-fila-right">
                                <div class="lj-fila-top">
                                    <div class="lj-fila-hint">Traslado u otra observación</div>
                                    <div class="lj-fila-actions">
                                        <button type="button" class="lj-mini-btn lj-mini-btn--danger lj-mini-btn--delete" title="Eliminar fila" aria-label="Eliminar fila" onclick="event.stopPropagation(); eliminarFilaLlenadoJarras('${ensayo}', ${fila.id})">
                                            <i data-lucide="trash-2"></i>
                                        </button>
                                    </div>
                                </div>
                                <select class="lj-campo-tipo" onchange="actualizarFilaLlenadoJarras('${ensayo}', ${fila.id}, 'tipo', this.value)" onclick="event.stopPropagation()">
                                    ${construirOpcionesTipo(ensayo, fila, indiceReal)}
                                </select>
                                <div class="lj-fila-horas">
                                    <div class="lj-time-col">
                                        <label class="lj-time-label">Inicio</label>
                                        <div class="lj-time-field" onclick="event.stopPropagation()">
                                            <input class="lj-campo-inicio" id="lj-inicio-${slugIdSeguro(ensayo)}-${fila.id}" type="time" value="${fila.inicio}" onchange="actualizarFilaLlenadoJarras('${ensayo}', ${fila.id}, 'inicio', this.value)" oninput="actualizarFilaLlenadoJarras('${ensayo}', ${fila.id}, 'inicio', this.value)">
                                        </div>
                                    </div>
                                    <div class="lj-time-col">
                                        <label class="lj-time-label">Final</label>
                                        <div class="lj-time-field" onclick="event.stopPropagation()">
                                            <input class="lj-campo-termino" id="lj-termino-${slugIdSeguro(ensayo)}-${fila.id}" type="time" value="${fila.termino}" onchange="actualizarFilaLlenadoJarras('${ensayo}', ${fila.id}, 'termino', this.value)" oninput="actualizarFilaLlenadoJarras('${ensayo}', ${fila.id}, 'termino', this.value)">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');
                return `
                    <section class="lj-ensayo-bloque">
                        <div class="lj-jarras-tabla-wrap">
                            <div class="lj-filas-stack" aria-label="Tiempo de llenado de jarras · ${ensayo}">
                                ${filasHtml}
                            </div>
                        </div>
                        <button type="button" class="llenado-jarras-add-btn" onclick="agregarFilaLlenadoJarras('${ensayo}')">Agregar uno nuevo</button>
                    </section>
                `;
            }).join('');
            actualizarIconos();
            inicializarFlatpickrInputs(panel);
            prepararCustomTimePickers(panel);
        }

        async function eliminarFilaLlenadoJarras(ensayo, idFila) {
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const idx = filas.findIndex((f) => Number(f.id) === Number(idFila));
            if (idx < 0) return;
            const filaBase = filas[idx];
            const txt = String(filaBase.jarra ?? '').trim();
            const r = parseRangoJarraLlenado(txt);
            const jarrasAfectadas = new Set();
            if (r) {
                jarrasAfectadas.add(r.a);
                jarrasAfectadas.add(r.b);
            } else {
                const n = Number(txt);
                if (Number.isFinite(n) && n > 0) jarrasAfectadas.add(n);
            }

            const idsEliminar = new Set([Number(filaBase.id)]);

            // Regla: si eliminas una cosecha de una jarra, elimina también
            // trasvasados que dependan de esa jarra (incluye grupales 1-2, etc.).
            if (filaBase.tipo === 'C' && jarrasAfectadas.size) {
                filas.forEach((f) => {
                    if (f.tipo !== 'T') return;
                    const aplica = [...jarrasAfectadas].some((n) => trasladoVisualAplicaJarra(f.jarra, n));
                    if (aplica) idsEliminar.add(Number(f.id));
                });
            }

            const eliminaRelacionados = idsEliminar.size > 1;
            const mensaje = eliminaRelacionados
                ? `Se va a eliminar Jarra ${txt} y su trasvasado relacionado. ¿Deseas continuar?`
                : '¿Estás seguro de eliminar este registro?';
            let confirmado = false;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                const resp = await swalFireSafe({
                    icon: 'warning',
                    title: 'Confirmar eliminación',
                    text: mensaje,
                    showCancelButton: true,
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'No'
                });
                confirmado = !!resp.isConfirmed;
            } else {
                confirmado = window.confirm(mensaje);
            }
            if (!confirmado) return;

            for (let i = filas.length - 1; i >= 0; i--) {
                if (idsEliminar.has(Number(filas[i].id))) filas.splice(i, 1);
            }

            if (!filas.length) marcarLlenadoJarrasVacioPorUsuario_(ensayo, true);
            limpiarJarraClamshellsSiSinLlenado_(ensayo);
            sincronizarInicioCosechaDesdeAnterior(ensayo);
            sincronizarInicioTrasvasadoDesdeCosecha(ensayo);
            renderizarPanelLlenadoJarras();
            sincronizarTiempoPorJarra(ensayo);
            renderizarTarjetas();
            if (modalCampoEstaAbierto_('modal-overlay')) {
                const itemEdit = editingCardId != null
                    ? data.find((entry) => entry.id === editingCardId)
                    : null;
                poblarSelectJarraModal(ensayo, itemEdit ? itemEdit.jarra : null);
            }
            programarGuardadoDraftCompleto();
        }

        function calcularTiempoEmpleado(inicio, termino) {
            if (!inicio || !termino) return '';
            const [hIni, mIni] = String(inicio).split(':').map(Number);
            const [hFin, mFin] = String(termino).split(':').map(Number);
            if ([hIni, mIni, hFin, mFin].some((n) => Number.isNaN(n))) return '';
            let minutosInicio = (hIni * 60) + mIni;
            let minutosTermino = (hFin * 60) + mFin;
            if (minutosTermino < minutosInicio) minutosTermino += 24 * 60;
            const total = minutosTermino - minutosInicio;
            return `${total}'`;
        }

        function horarioFinalMenorQueInicio(inicio, termino) {
            const minIni = minutosDesdeHora(inicio);
            const minFin = minutosDesdeHora(termino);
            if (minIni === null || minFin === null) return false;
            return minFin < minIni;
        }

        function actualizarFilaLlenadoJarras(ensayo, idFila, campo, valor) {
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const indice = buscarIndiceFilaJarrasPorId(ensayo, idFila);
            const fila = filas[indice];
            if (!fila) return;

            if (campo === 'jarra') {
                fila.jarra = String(valor ?? '').trim();
                const rangoValido = !!parseRangoJarraLlenado(fila.jarra);
                const nJarra = Number(fila.jarra);
                if (!rangoValido && (!Number.isFinite(nJarra) || nJarra < 1)) {
                    fila.jarra = '1';
                    mostrarAlertaRegla('Jarra inválida', 'El N° de jarra no puede ser menor que 1.');
                }
                if (fila.tipo === 'C' && parseRangoJarraLlenado(fila.jarra)) {
                    fila.jarra = '';
                }
                if (fila.tipo === 'T') {
                    const inicioSug = inicioSugeridoTrasvasado(ensayo, fila.jarra, indice);
                    if (inicioSug) fila.inicio = inicioSug;
                } else if (fila.tipo === 'C') {
                    const inicioSugC = inicioSugeridoCosecha(ensayo, fila.jarra, indice);
                    if (inicioSugC) fila.inicio = inicioSugC;
                }
            } else if (campo === 'tipo') {
                fila.tipo = String(valor ?? '').trim();
                if (fila.tipo === 'C' && parseRangoJarraLlenado(fila.jarra)) {
                    fila.jarra = '';
                }
                if (fila.tipo === 'T') {
                    const inicioSug = inicioSugeridoTrasvasado(ensayo, fila.jarra, indice);
                    if (inicioSug) fila.inicio = inicioSug;
                } else if (fila.tipo === 'C') {
                    const inicioSugC = inicioSugeridoCosecha(ensayo, fila.jarra, indice);
                    if (inicioSugC) fila.inicio = inicioSugC;
                }
            } else if (campo === 'inicio' || campo === 'termino') {
                fila[campo] = valor;
                if (String(fila.inicio || '').trim() && String(fila.termino || '').trim() && horarioFinalMenorQueInicio(fila.inicio, fila.termino)) {
                    mostrarAlertaRegla('Horario inválido', 'La hora final no puede ser menor que la hora de inicio.');
                    if (campo === 'termino') fila.termino = '';
                    if (campo === 'inicio') fila.inicio = '';
                }
                if (campo === 'termino' && fila.tipo === 'C') {
                    const nJarra = Number(String(fila.jarra ?? '').trim());
                    if (Number.isFinite(nJarra) && nJarra > 0) {
                        sincronizarInicioTrasvasadoDesdeCosecha(ensayo, nJarra);
                        sincronizarInicioTrasvasadoDesdeCosecha(ensayo, nJarra - 1);
                        sincronizarInicioTrasvasadoDesdeCosecha(ensayo, nJarra + 1);
                        sincronizarInicioCosechaDesdeAnterior(ensayo, nJarra + 1);
                    }
                }
                if (campo === 'termino' && fila.tipo === 'T') {
                    const txtJ = String(fila.jarra ?? '').trim();
                    const rJ = parseRangoJarraLlenado(txtJ);
                    if (rJ) sincronizarInicioCosechaDesdeAnterior(ensayo, rJ.b + 1);
                    else {
                        const nJ = Number(txtJ);
                        if (Number.isFinite(nJ) && nJ > 0) sincronizarInicioCosechaDesdeAnterior(ensayo, nJ + 1);
                    }
                }
            }

            const permitidos = tiposPermitidosSegunJarra(ensayo, fila, indice);
            if (fila.tipo && !permitidos.includes(fila.tipo)) {
                fila.tipo = permitidos[0] || '';
            }

            if (campo === 'inicio' || campo === 'termino') {
                fila.tiempo = calcularTiempoEmpleado(fila.inicio, fila.termino);
            } else if (fila.tipo === 'T' && campo !== 'termino') {
                fila.tiempo = calcularTiempoEmpleado(fila.inicio, fila.termino);
            }

            renderizarPanelLlenadoJarras();
            programarGuardadoDraftCompleto();
        }

        function agregarFilaLlenadoJarras(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const filas = obtenerFilasLlenadoJarras(clave);
            marcarLlenadoJarrasVacioPorUsuario_(clave, false);
            const incompleta = filas.find((f) => !String(f.inicio || '').trim() || !String(f.termino || '').trim());
            if (incompleta) {
                mostrarAlertaRegla('Completa horas primero', 'Para agregar otro registro debes completar Inicio y Final de las filas actuales.');
                return;
            }
            const invalida = filas.find((f) => horarioFinalMenorQueInicio(f.inicio, f.termino));
            if (invalida) {
                mostrarAlertaRegla('Horario inválido', 'No se puede agregar: existe una fila con hora final menor que la hora de inicio.');
                return;
            }
            let jarraNueva = '1';
            let tipoNuevo = 'C';
            const estado = new Map();
            let maxRef = 1;
            filas.forEach((f) => {
                const txt = String(f.jarra ?? '').trim();
                const r = parseRangoJarraLlenado(txt);
                const marcar = (n) => {
                    if (!estado.has(n)) estado.set(n, { c: false, t: false });
                    const e = estado.get(n);
                    if (f.tipo === 'C') e.c = true;
                    if (f.tipo === 'T') e.t = true;
                    maxRef = Math.max(maxRef, n);
                };
                if (r) {
                    marcar(r.a);
                    marcar(r.b);
                    return;
                }
                const n = Number(txt);
                if (Number.isFinite(n) && n > 0) marcar(n);
            });

            let asignada = false;
            for (let n = maxRef; n >= 1; n--) {
                const e = estado.get(n) || { c: false, t: false };
                if (!e.c) {
                    jarraNueva = String(n);
                    tipoNuevo = 'C';
                    asignada = true;
                    break;
                }
                if (!e.t) {
                    jarraNueva = String(n);
                    tipoNuevo = 'T';
                    asignada = true;
                    break;
                }
            }
            if (!asignada) {
                jarraNueva = String(maxRef + 1);
                tipoNuevo = 'C';
            }

            const nuevaFila = {
                id: siguienteIdFilaJarras++,
                ensayo: clave,
                jarra: String(jarraNueva),
                tipo: tipoNuevo,
                inicio: '',
                termino: '',
                tiempo: ''
            };
            if (nuevaFila.tipo === 'T') {
                const inicioSug = inicioSugeridoTrasvasado(clave, nuevaFila.jarra, -1);
                if (inicioSug) nuevaFila.inicio = inicioSug;
            } else if (nuevaFila.tipo === 'C') {
                const inicioSugC = inicioSugeridoCosecha(clave, nuevaFila.jarra, -1);
                if (inicioSugC) nuevaFila.inicio = inicioSugC;
            }
            filas.push(nuevaFila);
            renderizarPanelLlenadoJarras();
            sincronizarTiempoPorJarra(clave);
            renderizarTarjetas();
            programarGuardadoDraftCompleto();
        }

        function abrirModalHorasLlenado(ensayo, idFila) {
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const fila = filas.find((f) => Number(f.id) === Number(idFila));
            if (!fila) return;
            horasLlenadoModalState.ensayo = ensayo;
            horasLlenadoModalState.idFila = idFila;
            document.getElementById('visual-lhm-inicio').value = fila.inicio || '';
            document.getElementById('visual-lhm-termino').value = fila.termino || '';
            document.getElementById('llenado-horas-modal-overlay').style.display = 'flex';
            inicializarFlatpickrInputs(document.getElementById('llenado-horas-modal-overlay'));
            prepararCustomTimePickers(document.getElementById('llenado-horas-modal-overlay'));
        }

        function cerrarModalHorasLlenado() {
            document.getElementById('llenado-horas-modal-overlay').style.display = 'none';
        }

        function guardarModalHorasLlenado() {
            const ensayo = horasLlenadoModalState.ensayo;
            const idFila = horasLlenadoModalState.idFila;
            const filas = obtenerFilasLlenadoJarras(ensayo);
            const fila = filas.find((f) => Number(f.id) === Number(idFila));
            if (!fila) {
                cerrarModalHorasLlenado();
                return;
            }
            const inicioVal = document.getElementById('visual-lhm-inicio').value || '';
            const terminoVal = document.getElementById('visual-lhm-termino').value || '';
            if (inicioVal && terminoVal && horarioFinalMenorQueInicio(inicioVal, terminoVal)) {
                mostrarAlertaRegla('Horario inválido', 'La hora final no puede ser menor que la hora de inicio.');
                return;
            }
            fila.inicio = inicioVal;
            fila.termino = terminoVal;
            fila.tiempo = calcularTiempoEmpleado(fila.inicio, fila.termino);
            cerrarModalHorasLlenado();
            renderizarPanelLlenadoJarras();
            sincronizarTiempoPorJarra(ensayo);
            renderizarTarjetas();
            programarGuardadoDraftCompleto();
            marcarBotonGuardado('btn-save-horas');
            mostrarToast('success', 'Guardado', 'Horas de llenado guardadas.');
        }

        function trasladoVisualAplicaJarra(valorTrasladoJarra, nJarra) {
            const r = parseRangoJarraLlenado(String(valorTrasladoJarra ?? '').trim());
            if (r) return nJarra === r.a || nJarra === r.b;
            return String(valorTrasladoJarra ?? '').trim() === String(nJarra);
        }

        function unirPesosVisualConJarrasEnsayo(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const filasJ = obtenerFilasLlenadoJarras(clave);
            const visuales = data.filter((it) => String(it.ensayo || 'Ensayo 1') === clave);
            const combinados = visuales.map((it) => {
                const n = Number(it.jarra);
                const cosecha = filasJ.find((f) => f.tipo === 'C' && String(f.jarra) === String(n)) || null;
                const traslado = filasJ.find((f) => f.tipo === 'T' && trasladoVisualAplicaJarra(f.jarra, n)) || null;
                return {
                    ensayo: clave,
                    visual: { id: it.id, jarra: it.jarra },
                    cosecha,
                    traslado
                };
            });

            const jarsEnJarras = new Set();
            filasJ.forEach((f) => {
                const r = parseRangoJarraLlenado(String(f.jarra ?? '').trim());
                if (r) {
                    jarsEnJarras.add(r.a);
                    jarsEnJarras.add(r.b);
                } else {
                    const n = Number(String(f.jarra ?? '').trim());
                    if (Number.isFinite(n)) jarsEnJarras.add(n);
                }
            });
            const jarsEnPesos = new Set(visuales.map((it) => Number(it.jarra)).filter((n) => Number.isFinite(n)));
            const backup = [];
            jarsEnJarras.forEach((n) => {
                if (jarsEnPesos.has(n)) return;
                const cosecha = filasJ.find((f) => f.tipo === 'C' && String(f.jarra) === String(n)) || null;
                const traslado = filasJ.find((f) => f.tipo === 'T' && trasladoVisualAplicaJarra(f.jarra, n)) || null;
                if (cosecha || traslado) backup.push({ ensayo: clave, jarra: n, cosecha, traslado, nota: 'Sin fila de pesos (visual); fila combinada de respaldo.' });
            });

            return { combinados, backup };
        }

        function horaLocalActual() {
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }

        function numeroDesdeEnsayoTexto(ensayoTxt) {
            const txt = String(ensayoTxt || '').trim();
            const m = txt.match(/\d+/);
            return m ? m[0] : '';
        }

        function strOrEmpty(v) {
            if (v === null || v === undefined) return '';
            return String(v).trim();
        }

        function numColsRegistroCampo_() {
            return esModoRegistroAcopio_() ? 51 : 49;
        }

        function registroPostExpandedLenCampo_() {
            return numColsRegistroCampo_() + 6;
        }

        function construirFilaBaseRegistro(item, idx, totalItemsEnLote, horaRegistro) {
            const ensayoNombre = strOrEmpty(item?.ensayo || obtenerEnsayoActivo() || 'Ensayo 1');
            const ensayoNumero = numeroDesdeEnsayoTexto(ensayoNombre);
            const meta = metaPorEnsayo[ensayoNombre] || {};
            const m = item?.metric || metricaVacia();
            const t = m.tiempo || {};
            const temp = m.temperatura || {};
            const hum = m.humedad || {};
            const numMuestraUnica = String(leerNumMuestraDesdePantalla(ensayoNombre) || '').trim();
            const esAcopio = esModoRegistroAcopio_();
            const celdasPesos = esAcopio ? [
                pesoStrOrEmpty(peso1EfectivoCampo(item, idx + 1)),
                pesoStrOrEmpty(item?.p2),
                pesoStrOrEmpty(item?.acopio),
                pesoStrOrEmpty(item?.p4),
                pesoStrOrEmpty(item?.despacho)
            ] : [
                pesoStrOrEmpty(peso1EfectivoCampo(item, idx + 1)),
                pesoStrOrEmpty(item?.p2),
                pesoStrOrEmpty(item?.acopio),
                pesoStrOrEmpty(item?.despacho)
            ];
            const celdasTiempos = esAcopio ? [
                strOrEmpty(t.inicioCosecha),
                strOrEmpty(t.terminoCosecha),
                strOrEmpty(t.llegadaAcopio),
                strOrEmpty(t.acopioCalibrado),
                strOrEmpty(t.terminoCalibrado),
                strOrEmpty(t.despachoAcopio)
            ] : [
                strOrEmpty(t.inicioCosecha),
                strOrEmpty(t.inicioPerdida),
                strOrEmpty(t.terminoCosecha),
                strOrEmpty(t.llegadaAcopio),
                strOrEmpty(t.despachoAcopio)
            ];

            return [
                // Visual: 49 cols. Acopio: 51 cols. TRAZ_ACOPIO (Acopio 1–25) tras PLACA.
                hoyIsoLocal(),
                strOrEmpty(ensayoNombre),
                numMuestraUnica,
                strOrEmpty(meta['visual-responsable']),
                strOrEmpty(meta['visual-guia-precosecha']),
                strOrEmpty(meta['visual-hora']),
                strOrEmpty(meta['visual-meta-fundo'] || meta['meta-fundo']),
                strOrEmpty(meta['visual-traz-etapa'] || meta['meta-traz-etapa']),
                strOrEmpty(meta['visual-traz-campo'] || meta['meta-traz-campo']),
                strOrEmpty(meta['visual-traz-turno']),
                strOrEmpty(meta['visual-meta-variedad'] || meta['meta-variedad']),
                strOrEmpty(item?.guiaRemision || document.getElementById('visual-guia-acopio')?.value),
                strOrEmpty(item?.placaVehiculo || document.getElementById('visual-placa-vehiculo')?.value).toUpperCase(),
                strOrEmpty(meta['visual-traz-acopio'] || document.getElementById('visual-traz-acopio')?.value),
                ensayoNumero,
                String(idx + 1),
                strOrEmpty(item?.jarra),
                ...celdasPesos,
                decimalMedicionParaEnvio(temp.inicioAmbiente, 1),
                decimalMedicionParaEnvio(temp.inicioPulpa, 1),
                decimalMedicionParaEnvio(temp.terminoAmbiente, 1),
                decimalMedicionParaEnvio(temp.terminoPulpa, 1),
                decimalMedicionParaEnvio(temp.llegadaAmbiente, 1),
                decimalMedicionParaEnvio(temp.llegadaPulpa, 1),
                decimalMedicionParaEnvio(temp.despachoAmbiente, 1),
                decimalMedicionParaEnvio(temp.despachoPulpa, 1),
                ...celdasTiempos,
                decimalMedicionParaEnvio(hum.inicio, 1),
                decimalMedicionParaEnvio(hum.termino, 1),
                decimalMedicionParaEnvio(hum.llegada, 1),
                decimalMedicionParaEnvio(hum.despacho, 1),
                presionStrParaEnvio(temp.presionAmbienteInicio),
                presionStrParaEnvio(temp.presionAmbienteTermino),
                presionStrParaEnvio(temp.presionAmbienteLlegada),
                presionStrParaEnvio(temp.presionAmbienteDespacho),
                presionStrParaEnvio(temp.presionFrutaInicio),
                presionStrParaEnvio(temp.presionFrutaTermino),
                presionStrParaEnvio(temp.presionFrutaLlegada),
                presionStrParaEnvio(temp.presionFrutaDespacho),
                strOrEmpty(limitarObservacionClamshell_(item?.observacion)),
                strOrEmpty(meta['visual-observacion-formato'] || document.getElementById('visual-observacion-formato')?.value),
                strOrEmpty(horaRegistro)
            ];
        }

        /**
         * Hoja 2: INICIO_C/TERMINO_C/MIN_C = fila Cosecha de esa jarra; INICIO_T/TERMINO_T/MIN_T = fila Trasvasado.
         * Se envían en el hueco 21-26 de una fila expandida (el servidor hace toRowRegistro y copia a Hoja 2).
         */
        function minutosDiferenciaHorasHoja2(horaIni, horaFin) {
            if (!horaIni || !horaFin) return '';
            const [hIni, mIni] = String(horaIni).split(':').map(Number);
            const [hFin, mFin] = String(horaFin).split(':').map(Number);
            if ([hIni, mIni, hFin, mFin].some((x) => Number.isNaN(x))) return '';
            let minutosInicio = hIni * 60 + mIni;
            let minutosTermino = hFin * 60 + mFin;
            if (minutosTermino < minutosInicio) minutosTermino += 24 * 60;
            return String(minutosTermino - minutosInicio);
        }

        function seisCeldasHoja2DesdeLlenadoJarras(ensayo, nJarra) {
            const n = Number(nJarra);
            if (!Number.isFinite(n) || n < 1) return ['', '', '', '', '', ''];
            const clave = String(ensayo || 'Ensayo 1');
            const c = filaCosechaParaJarra(clave, n, -1);
            const t = filaTrasladoQueAplicaAJarra(clave, n, -1);
            const inicioC = c ? String(c.inicio || '').trim() : '';
            const terminoC = c ? String(c.termino || '').trim() : '';
            const inicioT = t ? String(t.inicio || '').trim() : '';
            const terminoT = t ? String(t.termino || '').trim() : '';
            return [
                inicioC,
                terminoC,
                minutosDiferenciaHorasHoja2(inicioC, terminoC),
                inicioT,
                terminoT,
                minutosDiferenciaHorasHoja2(inicioT, terminoT)
            ];
        }

        /** POST expandido: 22 + hueco Hoja2 (6) + cierre → 55 Visual / 57 Acopio. */
        const REGISTRO_PRE_JARRA_COLS = 22;

        function construirFilaPostExpandidaConHoja2(item, idx, totalEnLote, horaRegistro) {
            const nCols = numColsRegistroCampo_();
            const fila = construirFilaBaseRegistro(item, idx, totalEnLote, horaRegistro);
            const h6 = seisCeldasHoja2DesdeLlenadoJarras(String(item.ensayo || 'Ensayo 1'), item?.jarra);
            return fila.slice(0, REGISTRO_PRE_JARRA_COLS).concat(h6, fila.slice(REGISTRO_PRE_JARRA_COLS, nCols));
        }

        // Filas para POST (expandidas con tiempos Hoja 2 desde panel jarras).
        function construirRowsRegistroBasePorEnsayo(ensayoObjetivo) {
            const ensayo = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1');
            sincronizarTiempoPorJarra(ensayo);
            recalcularPresionesParaEnsayo(ensayo);
            const items = data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === String(ensayo))
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id));
            const n = items.length;
            const horaRegistro = horaLocalActual();
            return items.map((item, idx) => construirFilaPostExpandidaConHoja2(item, idx, n, horaRegistro));
        }
        function construirRowsRegistroBase() {
            return construirRowsRegistroBasePorEnsayo(obtenerEnsayoActivo());
        }
        window.construirRowsRegistroBase = construirRowsRegistroBase;

        const INPUT_IDS_CRITICOS = [
            'visual-meta-muestra',
            'visual-responsable',
            'visual-guia-precosecha',
            'visual-hora',
            'visual-meta-fundo',
            'visual-traz-etapa',
            'visual-traz-campo',
            'visual-traz-turno',
            'visual-traz-acopio',
            'visual-meta-variedad',
            'visual-guia-acopio',
            'visual-placa-vehiculo',
            'visual-m-jarra',
            'visual-p1',
            'visual-p2',
            'visual-acopio',
            'visual-despacho',
            'visual-tiempo-1-iniciocosecha-1',
            'visual-tiempo-1-inicioperdida-2',
            'visual-tiempo-1-terminocosecha-3',
            'visual-tiempo-1-terminocosecha-4',
            'visual-tiempo-1-despachoacopio-5',
            'visual-temp-amb-inicio',
            'visual-temp-pulpa-inicio',
            'visual-temp-amb-termino',
            'visual-temp-pulpa-termino',
            'visual-temp-amb-llegada',
            'visual-temp-pulpa-llegada',
            'visual-temp-amb-despacho',
            'visual-temp-pulpa-despacho',
            'visual-cg-humedad-inicio',
            'visual-cg-humedad-termino',
            'visual-cg-humedad-llegada',
            'visual-cg-humedad-despacho',
            'visual-presionambiente-1-presionambienteinicio-1',
            'visual-presionambiente-1-presionambientetermino-2',
            'visual-presionambiente-1-presionambientellegada-3',
            'visual-presionambiente-1-presionambientedespacho-4',
            'visual-presionfruta-1-presionfrutainicio-1',
            'visual-presionfruta-1-presionfrutatermino-2',
            'visual-presionfruta-1-presionfrutallegada-3',
            'visual-presionfruta-1-presionfrutadespacho-4',
            'visual-observation',
            'visual-guia-acopio',
            'visual-placa-vehiculo',
            'visual-observacion-formato'
        ];

        const LEGACY_INPUT_IDS = {
            'visual-meta-muestra': ['meta-muestra'],
            'visual-meta-fundo': ['meta-fundo'],
            'visual-meta-variedad': ['meta-variedad'],
            'visual-traz-etapa': ['meta-traz-etapa'],
            'visual-traz-campo': ['meta-traz-campo'],
            'visual-m-jarra': ['m-jarra'],
            'visual-tiempo-1-iniciocosecha-1': ['metric-tiempo-1-iniciocosecha-1'],
            'visual-tiempo-1-inicioperdida-2': ['metric-tiempo-1-inicioperdida-2'],
            'visual-tiempo-1-terminocosecha-3': ['metric-tiempo-1-terminocosecha-3'],
            'visual-tiempo-1-terminocosecha-4': ['metric-tiempo-1-terminocosecha-4'],
            'visual-tiempo-1-despachoacopio-5': ['metric-tiempo-1-despachoacopio-5'],
            'visual-temp-amb-inicio': ['cg-temp-amb-inicio'],
            'visual-temp-pulpa-inicio': ['cg-temp-pulpa-inicio'],
            'visual-temp-amb-termino': ['cg-temp-amb-termino'],
            'visual-temp-pulpa-termino': ['cg-temp-pulpa-termino'],
            'visual-temp-amb-llegada': ['cg-temp-amb-llegada'],
            'visual-temp-pulpa-llegada': ['cg-temp-pulpa-llegada'],
            'visual-temp-amb-despacho': ['cg-temp-amb-despacho'],
            'visual-temp-pulpa-despacho': ['cg-temp-pulpa-despacho'],
            'visual-cg-humedad-inicio': ['cg-humedad-inicio'],
            'visual-cg-humedad-termino': ['cg-humedad-termino'],
            'visual-cg-humedad-llegada': ['cg-humedad-llegada'],
            'visual-cg-humedad-despacho': ['cg-humedad-despacho'],
            'visual-presionambiente-1-presionambienteinicio-1': ['metric-presionambiente-1-presionambienteinicio-1'],
            'visual-presionambiente-1-presionambientetermino-2': ['metric-presionambiente-1-presionambientetermino-2'],
            'visual-presionambiente-1-presionambientellegada-3': ['metric-presionambiente-1-presionambientellegada-3'],
            'visual-presionambiente-1-presionambientedespacho-4': ['metric-presionambiente-1-presionambientedespacho-4'],
            'visual-presionfruta-1-presionfrutainicio-1': ['metric-presionfruta-1-presionfrutainicio-1'],
            'visual-presionfruta-1-presionfrutatermino-2': ['metric-presionfruta-1-presionfrutatermino-2'],
            'visual-presionfruta-1-presionfrutallegada-3': ['metric-presionfruta-1-presionfrutallegada-3'],
            'visual-presionfruta-1-presionfrutadespacho-4': ['metric-presionfruta-1-presionfrutadespacho-4'],
            'visual-fecha-ring-widget': ['fecha-ring-widget']
        };

        function migrarClavesInputsCriticos(obj) {
            if (!obj || typeof obj !== 'object') return;
            Object.keys(LEGACY_INPUT_IDS).forEach((nuevo) => {
                const cur = obj[nuevo];
                if (cur !== undefined && cur !== null && String(cur).trim() !== '') return;
                const legacyList = LEGACY_INPUT_IDS[nuevo];
                for (let i = 0; i < legacyList.length; i++) {
                    const old = legacyList[i];
                    const v = obj[old];
                    if (v !== undefined && v !== null && String(v).trim() !== '') {
                        obj[nuevo] = v;
                        return;
                    }
                }
            });
        }

        function leerInputsCriticosActuales() {
            const out = {};
            idsInputCriticosCampo_().forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                out[id] = el.value;
            });
            const day = document.getElementById('fecha-ring-day')?.textContent || '';
            const month = document.getElementById('fecha-ring-month')?.textContent || '';
            out['visual-fecha-ring-widget'] = `${day}|${month}`;
            return out;
        }

        function aplicarInputsCriticosGuardados(inputs) {
            if (!inputs || typeof inputs !== 'object') return;
            migrarClavesInputsCriticos(inputs);
            delete inputs['visual-num-muestra'];
            delete inputs.numMuestra;
            const mapaAcopio = {
                'visual-p1': 'acopio-peso-1-termino-cosecha',
                'visual-p2': 'acopio-peso-2-llegada',
                'visual-acopio': 'acopio-peso-3-calibrado',
                'visual-p4': 'acopio-peso-4-clamshell-calibrado',
                'visual-despacho': 'acopio-peso-5-despacho-campo',
                'visual-tiempo-1-iniciocosecha-1': 'acopio-tiempo-1-iniciocosecha',
                'visual-tiempo-1-inicioperdida-2': 'acopio-tiempo-4-acopio-calibrado',
                'visual-tiempo-1-terminocosecha-3': 'acopio-tiempo-2-terminocosecha',
                'visual-tiempo-1-terminocosecha-4': 'acopio-tiempo-3-llegada-acopio',
                'visual-tiempo-1-despachoacopio-5': 'acopio-tiempo-6-despacho-acopio'
            };
            idsInputCriticosCampo_().forEach((id) => {
                let val = inputs[id];
                if (val === undefined && esModoRegistroAcopio_()) {
                    const legacy = Object.keys(mapaAcopio).find((k) => mapaAcopio[k] === id);
                    if (legacy && inputs[legacy] !== undefined) val = inputs[legacy];
                }
                if (val === undefined) return;
                const el = document.getElementById(id);
                if (!el) return;
                el.value = String(val ?? '');
            });
        }

        function modalCampoEstaAbierto_(overlayId) {
            const el = document.getElementById(overlayId);
            if (!el) return false;
            const disp = String(el.style.display || '').toLowerCase();
            return disp === 'flex' || disp === 'block';
        }

        function persistirModalMetricaAbiertaCampo_() {
            if (!metricModalState.itemId || !metricModalState.kind) return;
            const item = data.find((entry) => entry.id === metricModalState.itemId);
            if (!item) return;
            if (metricModalState.kind === 'tiempo' && metricModalState.tiempoEditable === false) return;
            document.querySelectorAll('#metric-modal-body [data-metric]').forEach((input) => {
                if (input.disabled) return;
                if (!item.metric) item.metric = metricaVacia();
                const kind = metricModalState.kind;
                if (!item.metric[kind]) item.metric[kind] = metricaVacia()[kind] || {};
                item.metric[kind][input.getAttribute('data-metric')] = input.value;
            });
            if (metricModalState.kind === 'tiempo') {
                const llegada = String(item.metric?.tiempo?.llegadaAcopio || '').trim();
                const despacho = String(item.metric?.tiempo?.despachoAcopio || '').trim();
                const acopioCalibrado = String(item.metric?.tiempo?.acopioCalibrado || '').trim();
                const terminoCalibrado = String(item.metric?.tiempo?.terminoCalibrado || '').trim();
                if (llegada || despacho || acopioCalibrado || terminoCalibrado) {
                    const clave = String(item.ensayo || 'Ensayo 1');
                    data.forEach((it) => {
                        if (String(it.ensayo || 'Ensayo 1') !== clave) return;
                        it.metric = it.metric || metricaVacia();
                        it.metric.tiempo = it.metric.tiempo || {};
                        if (llegada) it.metric.tiempo.llegadaAcopio = llegada;
                        if (despacho) it.metric.tiempo.despachoAcopio = despacho;
                        if (acopioCalibrado) it.metric.tiempo.acopioCalibrado = acopioCalibrado;
                        if (terminoCalibrado) it.metric.tiempo.terminoCalibrado = terminoCalibrado;
                    });
                }
                sincronizarTiempoPorJarra(item.ensayo || 'Ensayo 1');
            }
            if (metricModalState.kind === 'temperatura' || metricModalState.kind === 'humedad') {
                recalcularPresionesParaTodos();
            }
        }

        function persistirModalTarjetaAbiertaCampo_() {
            if (!modalCampoEstaAbierto_('modal-overlay')) return;
            const jarraLeida = leerJarraSelectModal_();
            if (jarraLeida === null) return;
            let jarraSel = jarraLeida;
            let p1Val = Number(elInputPesoModalCampo_('p1')?.value || 0);
            let p2Val = Number(elInputPesoModalCampo_('p2')?.value || 0);
            let acopioVal = Number(elInputPesoModalCampo_('acopio')?.value || 0);
            const p4Val = Number(elInputPesoModalCampo_('p4')?.value || 0);
            const despachoVal = Number(elInputPesoModalCampo_('despacho')?.value || 0);
            const nroModal = nroClamshellModalActual_(editingCardId != null
                ? data.find((entry) => entry.id === editingCardId)
                : null);
            if (clamshellUsaPeso1DesdePeso2(nroModal) && p2Val > 0) p1Val = p2Val;
            if (editingCardId == null) return;
            const item = data.find((entry) => entry.id === editingCardId);
            if (!item) return;
            if (esModoRegistroAcopio_() && jarraSel === '') {
                p1Val = 0;
                p2Val = 0;
                acopioVal = 0;
            }
            aplicarDatosModalAClamshell_(item, jarraSel, p1Val, p2Val, acopioVal, p4Val, despachoVal);
        }

        function persistirModalesAbiertasCampo_() {
            if (modalCampoEstaAbierto_('control-global-modal-overlay') && controlGlobalState.tipo) {
                aplicarControlGlobalDesdeFormulario(false, { silencioso: true });
            }
            if (modalCampoEstaAbierto_('metric-modal-overlay')) {
                persistirModalMetricaAbiertaCampo_();
            }
            if (modalCampoEstaAbierto_('modal-overlay')) {
                persistirModalTarjetaAbiertaCampo_();
            }
            if (modalCampoEstaAbierto_('observation-modal-overlay') && observationModalState.itemId) {
                const item = data.find((entry) => entry.id === observationModalState.itemId);
                const inp = document.getElementById('visual-observation');
                if (item && inp) item.observacion = inp.value;
            }
        }

        function capturarNumMuestraBorradorPorEnsayo_() {
            const out = { ...numerosMuestraFijadosSesion };
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
            const val = normalizarNumMuestraInput(document.getElementById('visual-num-muestra')?.value || '');
            if (activo && val) out[activo] = val;
            return out;
        }

        function capturarDraftCompleto() {
            return {
                version: 2,
                ts: Date.now(),
                fechaOperativa: hoyIsoLocal(),
                modoRegistro: modoRegistroPostBody_(),
                data: data,
                ensayoMeta: ensayoMeta,
                llenadoJarrasState: llenadoJarrasState,
                siguienteIdFilaJarras: siguienteIdFilaJarras,
                ensayoActivo: ensayoActivo,
                metaActivoEnsayo: metaActivoEnsayo,
                metaPorEnsayo: clonarMetaPorEnsayoSinNumeros(metaPorEnsayo),
                inputsCriticos: leerInputsCriticosActuales(),
                // N° muestra no se guarda en borrador (evita 94 pegado entre Visual/Acopio).
                numMuestraPorEnsayo: {}
            };
        }

        function guardarDraftCompleto() {
            try {
                persistirModalesAbiertasCampo_();
                const ensayo = metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1';
                fusionarParcelaCriticosEnMeta(ensayo, leerMetaFormulario());
                fusionarParcelaCriticosEnMeta(ensayo, leerInputsCriticosActuales());
                snapshotMetaEnsayoActual(ensayo);
                sincronizarTrazabilidadCompuesta();
                const payload = capturarDraftCompleto();
                ultimoPayloadDraftCampo_ = payload;
                localStorage.setItem(draftStorageKeyCampo_(), JSON.stringify(payload));
                if (typeof window.guardarBorradorCampoIdb === 'function') {
                    void window.guardarBorradorCampoIdb(payload);
                }
            } catch (_) { /* ignore */ }
        }

        function guardarDraftCompletoInmediato() {
            clearTimeout(draftSaveTimer);
            draftSaveTimer = null;
            clearTimeout(metaSaveTimer);
            metaSaveTimer = null;
            guardarDraftCompleto();
        }

        /** Solo dispositivo (localStorage). Nunca POST, nunca cola de envío ni planilla. */
        function persistirSoloLocalCampo_() {
            guardarDraftCompletoInmediato();
            try {
                if (metaGuardadoSuspendido > 0) return;
                snapshotMetaEnsayoActual();
                const activo = metaActivoEnsayo || ensayoDesdeFormulario();
                if (activo && ensayoMetaTieneDatosTrabajo(activo)) marcarEnsayoEnUsoSesion(activo);
                localStorage.setItem(metaStorageKeyCampo_(), JSON.stringify({
                    activo: metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1',
                    porEnsayo: clonarMetaPorEnsayoSinNumeros(metaPorEnsayo),
                    fechaOperativa: hoyIsoLocal()
                }));
            } catch (_) { /* ignore */ }
        }

        function debePreservarBorradorCampoEnSync_() {
            if (!hayDatosEnTrabajo()) return false;
            const draft = parseDraftRawCampo_(leerDraftRawCampo_());
            if (draft && borradorCampoTieneDatos_(draft) && borradorCampoEsDeHoy_(draft)) return true;
            if (Array.isArray(data) && data.some(clamshellTieneDatosTrabajo_)) return true;
            try {
                const hoy = hoyIsoLocal();
                if (cargarColaSync().some((reg) => {
                    const st = String(reg?.estado || '');
                    if (st !== 'pendiente' && st !== 'bloqueado') return false;
                    return String(reg?.fecha || hoy) === hoy;
                })) return true;
            } catch (_) { /* ignore */ }
            try {
                const raw = localStorage.getItem(metaStorageKeyCampo_());
                const o = raw ? JSON.parse(raw) : null;
                if (metaAlmacenadaEsDeHoy_(o)) {
                    const activo = String(o?.activo || metaActivoEnsayo || '').trim();
                    if (activo && ensayoMetaTieneDatosTrabajo(activo)) return true;
                }
            } catch (_) { /* ignore */ }
            return false;
        }

        function fusionarParcelaCriticosEnMeta(ensayo, inputs) {
            if (!inputs || typeof inputs !== 'object') return;
            const k = String(ensayo || '').trim();
            if (!k) return;
            if (!metaPorEnsayo[k]) metaPorEnsayo[k] = {};
            const meta = metaPorEnsayo[k];
            const ids = [
                'visual-meta-fundo', 'visual-traz-etapa', 'visual-traz-campo',
                'visual-traz-turno', 'visual-traz-acopio', 'visual-meta-variedad', 'visual-trazabilidad',
                'visual-responsable', 'visual-guia-precosecha', 'visual-hora'
            ];
            ids.forEach((id) => {
                const vCrit = String(inputs[id] ?? '').trim();
                if (vCrit) meta[id] = vCrit;
            });
        }

        function reaplicarMetaFormularioCampo_(ensayo) {
            const e = String(ensayo || metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1').trim() || 'Ensayo 1';
            const meta = { ...(metaPorEnsayo[e] || {}) };
            if (!Object.keys(meta).length) return;
            migrarClavesMetaObjeto(meta);
            metaPorEnsayo[e] = meta;
            pausarValidacionMetaCampo(true);
            suspenderGuardadoMeta_();
            if (typeof window.pausarRefVariedadesCampo === 'function') {
                window.pausarRefVariedadesCampo(true);
            }
            if (typeof window.filtroParcelaSilencioso === 'function') {
                window.filtroParcelaSilencioso(true);
            }
            try {
                if (typeof window.aplicarParcelaCampoDesdeMeta === 'function') {
                    window.aplicarParcelaCampoDesdeMeta(meta);
                }
                escribirMetaFormulario(meta, e);
                const turnoEl = document.getElementById('visual-traz-turno');
                if (turnoEl && meta['visual-traz-turno']) {
                    turnoEl.value = String(meta['visual-traz-turno']);
                }
                asegurarOpcionesSelectAcopio(meta['visual-traz-acopio']);
                actualizarBloqueoTrazabilidadPorFundo();
                sincronizarTrazabilidadCompuesta();
            } finally {
                if (typeof window.filtroParcelaSilencioso === 'function') {
                    window.filtroParcelaSilencioso(false);
                }
                if (typeof window.pausarRefVariedadesCampo === 'function') {
                    window.pausarRefVariedadesCampo(false);
                }
                reanudarGuardadoMeta_();
                pausarValidacionMetaCampo(false);
            }
        }

        function sincronizarUiMetaCampoLigera_(opts) {
            actualizarBloqueoTrazabilidadPorFundo();
            sincronizarTrazabilidadCompuesta();
            sincronizarChipsDesdeAlmacenamiento();
            actualizarVistaCompacta();
            actualizarProgresoMeta(opts);
        }

        function reaplicarParcelaDesdeMetaGuardada_(ensayo) {
            const meta = metaPorEnsayo[ensayo] || {};
            if (typeof window.pausarRefVariedadesCampo === 'function') {
                window.pausarRefVariedadesCampo(true);
            }
            try {
                if (typeof window.aplicarParcelaCampoDesdeMeta === 'function') {
                    window.aplicarParcelaCampoDesdeMeta(meta);
                }
            } finally {
                if (typeof window.pausarRefVariedadesCampo === 'function') {
                    window.pausarRefVariedadesCampo(false);
                }
            }
        }

        function reaplicarCatalogoYMetaGuardada(opts) {
            const ensayo = ensayoActivo || metaActivoEnsayo || obtenerEnsayoActivo() || 'Ensayo 1';
            if (!opts?.omitirSnapshot) snapshotMetaEnsayoActual(ensayo);
            const tieneMeta = metaPorEnsayo[ensayo] && ensayoMetaTieneDatosTrabajo(ensayo);
            if (tieneMeta) {
                if (opts?.catalogoRecienIniciado) {
                    reaplicarParcelaDesdeMetaGuardada_(ensayo);
                    sincronizarUiMetaCampoLigera_();
                } else {
                    cargarMetaDeEnsayo(ensayo);
                }
            } else if (!opts?.catalogoRecienIniciado) {
                actualizarBloqueoTrazabilidadPorFundo();
                if (typeof window.refrescarSelectsCatalogoCampo === 'function') {
                    window.refrescarSelectsCatalogoCampo();
                }
                sincronizarUiMetaCampoLigera_();
            } else {
                sincronizarUiMetaCampoLigera_();
            }
            asegurarOpcionesSelectAcopio(metaPorEnsayo[ensayo]?.['visual-traz-acopio']);
            programarGuardadoMeta();
        }

        /** Un paso por tick (setTimeout) para no bloquear el hilo principal. */
        function ejecutarTrabajoDiferidoCampo(pasos, opts) {
            const lista = (pasos || []).filter(Boolean);
            if (!lista.length) {
                opts?.alFinalizar?.();
                return;
            }
            let i = 0;
            const correr = () => {
                if (i >= lista.length) {
                    opts?.alFinalizar?.();
                    return;
                }
                try {
                    lista[i++]();
                } catch (err) {
                    console.error('[campo-arranque]', err);
                }
                if (i < lista.length) {
                    setTimeout(correr, 0);
                } else {
                    opts?.alFinalizar?.();
                }
            };
            setTimeout(correr, 0);
        }

        function arranqueCatalogoYMetaCampo_(opts) {
            const ensayo = ensayoActivo || metaActivoEnsayo || obtenerEnsayoActivo() || 'Ensayo 1';
            pausarValidacionMetaCampo(true);
            if (typeof window.pausarRefVariedadesCampo === 'function') {
                window.pausarRefVariedadesCampo(true);
            }
            const meta = metaPorEnsayo[ensayo];
            const tieneBorrador = opts?.desdeBorrador || ensayoMetaTieneDatosTrabajo(ensayo) || ensayoMetaTieneBorradorGuardado_(ensayo);
            const pasos = [
                () => {
                    if (typeof window.initCatalogoSelectsCampo === 'function') {
                        window.initCatalogoSelectsCampo({ pausarRef: true, sinAplicarFiltros: true });
                    }
                }
            ];
            if (tieneBorrador && meta) {
                if (typeof window.pasosAplicarParcelaCampoDesdeMeta === 'function') {
                    pasos.push(...window.pasosAplicarParcelaCampoDesdeMeta(meta));
                } else {
                    pasos.push(() => reaplicarParcelaDesdeMetaGuardada_(ensayo));
                }
                pasos.push(() => reaplicarMetaFormularioCampo_(ensayo));
            }
            pasos.push(
                () => sincronizarUiMetaCampoLigera_({ sinValidacion: true }),
                () => asegurarOpcionesSelectAcopio(metaPorEnsayo[ensayo]?.['visual-traz-acopio']),
                () => {
                    if (opts?.desdeBorrador) reaplicarMetaFormularioCampo_(ensayo);
                },
                () => {
                    if (typeof window.actualizarBloqueOtrasVariedadesReferencia === 'function') {
                        window.actualizarBloqueOtrasVariedadesReferencia();
                    }
                },
                () => {
                    if (typeof window.pausarRefVariedadesCampo === 'function') {
                        window.pausarRefVariedadesCampo(false);
                    }
                    pausarValidacionMetaCampo(false);
                }
            );
            ejecutarTrabajoDiferidoCampo(pasos);
        }

        function hayTextoNoVacioEnObjeto(obj) {
            if (!obj || typeof obj !== 'object') return false;
            return Object.keys(obj).some((k) => {
                const v = obj[k];
                if (v && typeof v === 'object') return hayTextoNoVacioEnObjeto(v);
                return String(v ?? '').trim() !== '';
            });
        }

        function clamshellTieneDatosTrabajo_(item) {
            if (!item) return false;
            if (!esClamshellSinDatos_(item)) return true;
            const m = item.metric;
            if (!m || typeof m !== 'object') return false;
            return ['tiempo', 'temperatura', 'humedad'].some((kind) => hayTextoNoVacioEnObjeto(m[kind]));
        }

        function hayDatosEnTrabajo() {
            const hayPendientes = cargarColaSync().some((q) => String(q?.estado || '') === 'pendiente');
            if (hayPendientes) return true;
            if (Array.isArray(data) && data.some(clamshellTieneDatosTrabajo_)) return true;
            if (hayTextoNoVacioEnObjeto(llenadoJarrasState?.porEnsayo)) return true;
            if (hayTextoNoVacioEnObjeto(metaPorEnsayo)) return true;
            const criticos = leerInputsCriticosActuales();
            if (hayTextoNoVacioEnObjeto(criticos)) return true;
            return false;
        }

        function parseDraftRawCampo_(raw) {
            if (!raw) return null;
            try {
                const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return d && typeof d === 'object' ? d : null;
            } catch (_) {
                return null;
            }
        }

        function borradorCampoTieneDatos_(d) {
            if (!d || typeof d !== 'object') return false;
            if (Array.isArray(d.data) && d.data.length > 0) {
                if (d.data.some(clamshellTieneDatosTrabajo_)) return true;
            }
            if (hayTextoNoVacioEnObjeto(d.metaPorEnsayo)) return true;
            if (hayTextoNoVacioEnObjeto(d.llenadoJarrasState?.porEnsayo)) return true;
            if (hayTextoNoVacioEnObjeto(d.inputsCriticos)) return true;
            return false;
        }

        function tsBorradorCampo_(d, fallbackTs) {
            const t = Number(d?.ts);
            if (Number.isFinite(t) && t > 0) return t;
            return Number(fallbackTs) || 0;
        }

        function solicitarAlmacenamientoPersistenteCampo_() {
            try {
                if (navigator.storage && typeof navigator.storage.persist === 'function') {
                    void navigator.storage.persist();
                }
            } catch (_) { /* ignore */ }
        }

        async function leerCandidatosBorradorCampo_() {
            const candidatos = [];
            const rawLs = leerDraftRawCampo_();
            const dLs = parseDraftRawCampo_(rawLs);
            if (dLs && borradorCampoCoincideModoActual_(dLs)) {
                candidatos.push({
                    d: dLs,
                    raw: rawLs,
                    fuente: 'ls',
                    ts: tsBorradorCampo_(dLs, 0)
                });
            }
            if (typeof window.leerBorradorCampoIdbRegistro === 'function') {
                try {
                    const rec = await window.leerBorradorCampoIdbRegistro();
                    const dIdb = parseDraftRawCampo_(rec?.json);
                    if (dIdb && borradorCampoCoincideModoActual_(dIdb)) {
                        candidatos.push({
                            d: dIdb,
                            raw: rec.json,
                            fuente: 'idb',
                            ts: tsBorradorCampo_(dIdb, rec?.ts)
                        });
                    }
                } catch (_) { /* ignore */ }
            }
            return candidatos;
        }

        function purgarBorradoresCampoDeOtroDia_() {
            try {
                todasClavesDraftCampo_().forEach((key) => {
                    try {
                        const raw = localStorage.getItem(key);
                        if (!raw) return;
                        const d = parseDraftRawCampo_(raw);
                        if (d && !borradorCampoEsDeHoy_(d)) localStorage.removeItem(key);
                    } catch (_) { /* ignore */ }
                });
                todasClavesMetaCampo_().forEach((key) => {
                    try {
                        const raw = localStorage.getItem(key);
                        if (!raw) return;
                        const o = JSON.parse(raw);
                        if (!metaAlmacenadaEsDeHoy_(o)) localStorage.removeItem(key);
                    } catch (_) {
                        try { localStorage.removeItem(key); } catch (_2) { /* ignore */ }
                    }
                });
            } catch (_) { /* ignore */ }
            void purgarBorradorCampoIdbSiNoEsDeHoy_();
        }

        async function purgarBorradorCampoIdbSiNoEsDeHoy_() {
            if (typeof window.leerBorradorCampoIdbRegistro !== 'function') return;
            try {
                const rec = await window.leerBorradorCampoIdbRegistro();
                if (!rec?.json) return;
                const d = parseDraftRawCampo_(rec.json);
                if (d && borradorCampoEsDeHoy_(d)) return;
                if (typeof window.borrarBorradorCampoIdb === 'function') {
                    await window.borrarBorradorCampoIdb();
                }
            } catch (_) { /* ignore */ }
        }

        async function elegirMejorBorradorCampo_() {
            const candidatos = await leerCandidatosBorradorCampo_();
            const conDatos = candidatos.filter((c) => borradorCampoTieneDatos_(c.d) && borradorCampoEsDeHoy_(c.d));
            if (!conDatos.length) return null;
            conDatos.sort((a, b) => b.ts - a.ts);
            return conDatos[0];
        }

        async function existeBorradorConDatosEnAlmacenCampo_() {
            const mejor = await elegirMejorBorradorCampo_();
            return !!(mejor && borradorCampoTieneDatos_(mejor.d));
        }

        function repintarUiTrasBorradorCampo_() {
            renderizarTarjetas();
            renderizarPanelLlenadoJarras();
            sincronizarLogisticaAcopioDesdeEnsayo();
            sincronizarChipsDesdeAlmacenamiento();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            arranqueCatalogoYMetaCampo_({ desdeBorrador: true });
        }

        async function cargarMejorBorradorCampoAsync_(opts = {}) {
            const { silencioso = false, repintar = false, soloSiMasNuevo = false } = opts;
            const mejor = await elegirMejorBorradorCampo_();
            if (!mejor || !borradorCampoTieneDatos_(mejor.d)) {
                return { aplicado: false, desdeIdb: false };
            }
            if (soloSiMasNuevo && hayDatosEnTrabajo()) {
                const tsMemoria = tsBorradorCampo_(capturarDraftCompleto(), 0);
                if (tsMemoria >= mejor.ts) {
                    return { aplicado: false, desdeIdb: false };
                }
            }
            try {
                localStorage.setItem(
                    draftStorageKeyCampo_(),
                    mejor.raw || JSON.stringify(mejor.d)
                );
            } catch (_) { /* ignore */ }
            const ok = aplicarDraftDesdeObjeto_(mejor.d);
            if (!ok) return { aplicado: false, desdeIdb: false };
            reconstruirEnsayosEnUsoSesionDesdeEstado();
            ensayoActivo = obtenerEnsayoActivo();
            recalcularPresionesParaTodos();
            asegurarClamshellInicialVacio(obtenerEnsayoActivo());
            if (repintar) repintarUiTrasBorradorCampo_();
            if (!silencioso && mejor.fuente === 'idb') {
                mostrarToast('info', 'Datos recuperados', 'Se restauró el borrador desde respaldo local (IndexedDB).');
            }
            return { aplicado: true, desdeIdb: mejor.fuente === 'idb' };
        }

        let ultimoPayloadDraftCampo_ = null;

        async function flushDraftCampoAIdb_() {
            if (typeof window.guardarBorradorCampoIdb !== 'function') return;
            try {
                let payload = ultimoPayloadDraftCampo_;
                if (!payload) payload = parseDraftRawCampo_(leerDraftRawCampo_());
                if (payload && borradorCampoTieneDatos_(payload)) {
                    await window.guardarBorradorCampoIdb(payload);
                }
            } catch (_) { /* ignore */ }
        }

        function ensayoMetaTieneBorradorGuardado_(ensayo) {
            const meta = metaPorEnsayo[String(ensayo || '').trim()];
            if (!meta || typeof meta !== 'object') return false;
            return META_SAVE_IDS.some((id) => {
                if (id === 'visual-meta-muestra' || id === 'visual-rotulo' || id === 'visual-trazabilidad') return false;
                return String(meta[id] ?? '').trim() !== '';
            });
        }

        function aplicarDraftDesdeObjeto_(d) {
            if (!d || typeof d !== 'object') return false;
            if (!borradorCampoCoincideModoActual_(d)) return false;
            if (!borradorCampoEsDeHoy_(d)) return false;

            if (Array.isArray(d.data)) {
                data.splice(0, data.length, ...d.data);
            }
            if (d.ensayoMeta && typeof d.ensayoMeta === 'object') {
                Object.keys(ensayoMeta).forEach((k) => delete ensayoMeta[k]);
                Object.assign(ensayoMeta, d.ensayoMeta);
            }
            if (d.llenadoJarrasState && typeof d.llenadoJarrasState === 'object') {
                if (!llenadoJarrasState.porEnsayo) llenadoJarrasState.porEnsayo = {};
                llenadoJarrasState.porEnsayo = d.llenadoJarrasState.porEnsayo || {};
                llenadoJarrasState.usuarioVacio = d.llenadoJarrasState.usuarioVacio || {};
            }
            if (Number.isFinite(Number(d.siguienteIdFilaJarras))) {
                siguienteIdFilaJarras = Number(d.siguienteIdFilaJarras);
            }
                if (d.metaPorEnsayo && typeof d.metaPorEnsayo === 'object') {
                    metaPorEnsayo = d.metaPorEnsayo;
                    Object.keys(metaPorEnsayo).forEach((k) => migrarClavesMetaObjeto(metaPorEnsayo[k]));
                    purgarTodosNumerosMuestraEnMeta();
                }
            if (d.ensayoActivo) {
                ensayoActivo = String(d.ensayoActivo);
            }
            if (d.metaActivoEnsayo) {
                metaActivoEnsayo = String(d.metaActivoEnsayo).trim() || metaActivoEnsayo;
            }
            if (d.numMuestraPorEnsayo && typeof d.numMuestraPorEnsayo === 'object') {
                // N° muestra NO se restaura del borrador (quedaba “pegado” p.ej. 94 vs planilla 93).
                // Se recalcula siempre desde el servidor / contexto al sincronizar.
            }
            if (d.inputsCriticos && typeof d.inputsCriticos === 'object') {
                delete d.inputsCriticos['visual-num-muestra'];
                delete d.inputsCriticos.numMuestra;
            }
            const ensayoDraft = String(d.metaActivoEnsayo || d.ensayoActivo || ensayoActivo || metaActivoEnsayo || 'Ensayo 1').trim() || 'Ensayo 1';
            fusionarParcelaCriticosEnMeta(ensayoDraft, d.inputsCriticos);
            aplicarInputsCriticosGuardados(d.inputsCriticos);
            metaActivoEnsayo = ensayoDraft;
            reaplicarMetaFormularioCampo_(ensayoDraft);
            asegurarOpcionesSelectAcopio(
                d.inputsCriticos?.['visual-traz-acopio']
                || metaPorEnsayo[ensayoDraft]?.['visual-traz-acopio']
            );
            sincronizarTrazabilidadCompuesta();
            return true;
        }

        function restaurarDraftCompleto() {
            try {
                const d = parseDraftRawCampo_(leerDraftRawCampo_());
                if (!d) return false;
                return aplicarDraftDesdeObjeto_(d);
            } catch (_) { /* ignore */ }
            return false;
        }

        async function recuperarBorradorCampoDesdeIdbSiFalta_() {
            const res = await cargarMejorBorradorCampoAsync_({ silencioso: false, repintar: true });
            return res.aplicado;
        }

        let draftSaveTimer = null;
        const DRAFT_AUTOSAVE_MS = 3000;
        let draftAutosaveInterval = null;
        function programarGuardadoDraftCompleto() {
            clearTimeout(draftSaveTimer);
            draftSaveTimer = setTimeout(guardarDraftCompleto, 220);
        }

        function iniciarAutosaveDraftCampo_() {
            if (draftAutosaveInterval) return;
            draftAutosaveInterval = setInterval(() => {
                if (document.visibilityState === 'hidden') return;
                if (!hayDatosEnTrabajo()) return;
                persistirSoloLocalCampo_();
            }, DRAFT_AUTOSAVE_MS);
        }

        function uidLocal() {
            return 'uid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        }

        function cargarColaSync() {
            try {
                const raw = localStorage.getItem(SYNC_QUEUE_KEY);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch (_) {
                return [];
            }
        }

        function guardarColaSync(queue) {
            try {
                localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
            } catch (_) { /* ignore */ }
            actualizarBarraHeaderEstado();
        }

        function limpiarColaSyncSoloPendientes(queue) {
            const arr = Array.isArray(queue) ? queue : [];
            return arr.filter((q) => String(q?.estado || '') === 'pendiente');
        }

        function cargarHistorialSync() {
            try {
                const raw = localStorage.getItem(SYNC_HISTORY_KEY);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch (_) {
                return [];
            }
        }

        function guardarHistorialSync(historial) {
            try {
                const out = (Array.isArray(historial) ? historial : []).slice(-SYNC_MAX_HISTORY);
                localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(out));
            } catch (_) { /* ignore */ }
        }

        function ayerIsoLocalCampo_() {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return d.getFullYear() + '-'
                + String(d.getMonth() + 1).padStart(2, '0') + '-'
                + String(d.getDate()).padStart(2, '0');
        }

        function fechaVisibleHistorialLocal_(fecha) {
            const f = String(fecha || '').trim();
            if (!f) return false;
            const hoy = hoyIsoLocal();
            return f === hoy || f === ayerIsoLocalCampo_();
        }

        function claveArchivoEnvioLocal_(reg) {
            return [
                String(reg?.fecha || '').trim(),
                String(reg?.ensayo_numero || '').trim(),
                String(reg?.num_muestra || '').trim().toUpperCase(),
                String(reg?.modo_registro || reg?.modo || '').trim().toLowerCase()
            ].join('||');
        }

        function cargarEnviosLocalesArchivados() {
            try {
                const raw = localStorage.getItem(SYNC_ENVIADOS_KEY);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch (_) {
                return [];
            }
        }

        function guardarEnviosLocalesArchivados(lista) {
            try {
                const arr = Array.isArray(lista) ? lista : [];
                const visibles = arr.filter((r) => fechaVisibleHistorialLocal_(r?.fecha));
                const out = visibles.slice(-SYNC_MAX_ENVIADOS);
                localStorage.setItem(SYNC_ENVIADOS_KEY, JSON.stringify(out));
            } catch (_) { /* ignore */ }
        }

        function archivarEnvioLocalExitoso_(reg) {
            if (!reg) return;
            const entrada = {
                uid: String(reg.uid || uidLocal()),
                fecha: String(reg.fecha || hoyIsoLocal()).trim(),
                ensayo_numero: String(reg.ensayo_numero || '').trim(),
                num_muestra: String(reg.num_muestra || '').trim().toUpperCase(),
                ensayo: String(reg.ensayo || '').trim(),
                modo_registro: String(reg.modo_registro || reg.modo || modoRegistroPostBody_()).trim(),
                estado: 'subido',
                creado_en: Number(reg.creado_en) || Date.now(),
                actualizado_en: Date.now(),
                intentos: Number(reg.intentos) || 0,
                error: ''
            };
            if (!entrada.fecha || !entrada.ensayo_numero) return;
            const clave = claveArchivoEnvioLocal_(entrada);
            const lista = cargarEnviosLocalesArchivados().filter((x) => claveArchivoEnvioLocal_(x) !== clave);
            lista.push(entrada);
            guardarEnviosLocalesArchivados(lista);
        }
        window.archivarEnvioLocalExitoso_ = archivarEnvioLocalExitoso_;

        function limpiarPersistenciaLocalPostSync() {
            try { localStorage.removeItem(SYNC_QUEUE_KEY); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(SYNC_HISTORY_KEY); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(SYNC_ENVIADOS_KEY); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(draftStorageKeyCampo_()); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(metaStorageKeyCampo_()); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(DEMO_META_CAMPO_SEED_KEY); } catch (_) { /* ignore */ }
        }

        async function borrarTodoYCacheRapido() {
            let confirmado = false;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                const resp = await swalFireSafe({
                    icon: 'warning',
                    title: 'Eliminar todo local',
                    text: 'Se borrará todo: inputs, borradores, pendientes, historial y caché local. ¿Continuar?',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, borrar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#D92D20',
                    allowOutsideClick: false
                });
                confirmado = !!resp.isConfirmed;
            } else {
                confirmado = window.confirm('Se borrarán datos en pantalla, cola pendiente e historial local. ¿Continuar?');
            }
            if (!confirmado) return;

            try {
                if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                }
            } catch (_) { /* ignore */ }

            try {
                if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                }
            } catch (_) { /* ignore */ }

            reiniciarNumeracionParaConsultaServidor();
            try {
                if (window.HistPdfStore && typeof window.HistPdfStore.borrarTodo === 'function') {
                    await window.HistPdfStore.borrarTodo();
                }
            } catch (_) { /* ignore */ }
            if (typeof window.borrarBorradorCampoIdb === 'function') {
                try { await window.borrarBorradorCampoIdb(); } catch (_) { /* ignore */ }
            }
            try { localStorage.clear(); } catch (_) { /* ignore */ }
            try { sessionStorage.clear(); } catch (_) { /* ignore */ }
            try {
                sessionStorage.setItem(FORZAR_NUM_DESDE_SERVIDOR_KEY, '1');
            } catch (_) { /* ignore */ }
            resetearPantallaEnCeroPostSync();
            establecerMenuFlotanteAbierto(false);
            mostrarToast('success', 'Limpieza completa', 'Se recargará y el N° muestra se tomará de la planilla.');
            setTimeout(() => {
                try {
                    window.location.reload();
                } catch (_) { /* ignore */ }
            }, 450);
        }
        window.borrarTodoYCacheRapido = borrarTodoYCacheRapido;

        // Limpieza inmediata del estado visual/local tras pulsar Enviar.
        // NO toca la cola pendiente para no perder sincronización.
        function limpiarPersistenciaLocalTrasEnvio() {
            try { localStorage.removeItem(draftStorageKeyCampo_()); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(metaStorageKeyCampo_()); } catch (_) { /* ignore */ }
            try { localStorage.removeItem(DEMO_META_CAMPO_SEED_KEY); } catch (_) { /* ignore */ }
            if (typeof window.borrarBorradorCampoIdb === 'function') {
                void window.borrarBorradorCampoIdb();
            }
        }

        function resetearPantallaEnCeroPostSync() {
            data.splice(0, data.length);
            Object.keys(ensayoMeta).forEach((k) => delete ensayoMeta[k]);
            Object.keys(numerosMuestraFijadosSesion).forEach((k) => delete numerosMuestraFijadosSesion[k]);
            metaPorEnsayo = {};
            metaActivoEnsayo = '';
            ensayoActivo = '';
            llenadoJarrasState.porEnsayo = {};
            llenadoJarrasState.usuarioVacio = {};
            siguienteIdFilaJarras = 1;
            editingCardId = null;
            metricModalState.itemId = null;
            metricModalState.kind = null;
            observationModalState.itemId = null;

            META_SAVE_IDS.forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.value = '';
            });
            const muestra = document.getElementById('visual-meta-muestra');
            if (muestra) muestra.value = '';
            const rotulo = document.getElementById('visual-rotulo');
            if (rotulo) rotulo.value = '';
            const guia = document.getElementById('visual-guia-acopio');
            if (guia) guia.value = '';
            const placa = document.getElementById('visual-placa-vehiculo');
            if (placa) placa.value = '';

            // Barrido adicional para dejar "literal vacío" cualquier input visual dinámico.
            document.querySelectorAll('input[id^="visual-"], textarea[id^="visual-"], select[id^="visual-"]').forEach((el) => {
                if (!el) return;
                if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            });
            document.querySelectorAll('input[id^="resumen-"], textarea[id^="resumen-"], select[id^="resumen-"]').forEach((el) => {
                if (!el) return;
                if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            });
            asegurarClamshellInicialVacio('Ensayo 1');
            metaActivoEnsayo = 'Ensayo 1';
            ensayoActivo = 'Ensayo 1';
            const muestraSel = document.getElementById('visual-meta-muestra');
            const rotuloEl = document.getElementById('visual-rotulo');
            if (muestraSel) muestraSel.value = 'Ensayo 1';
            if (rotuloEl) rotuloEl.value = 'Ensayo 1';

            sincronizarTrazabilidadCompuesta();
            sincronizarChipsDesdeAlmacenamiento();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            renderizarPanelLlenadoJarras();
            renderizarTarjetas();
            actualizarBarraHeaderEstado();
            actualizarBloqueoControlesPorPeso1();
        }

        function ensayoTieneDatosLocalesPendientes_(ensayo) {
            const e = String(ensayo || '').trim();
            if (!e || ensayoEstaRegistradoHoy(e)) return false;
            if (data.some((it) => String(it?.ensayo || 'Ensayo 1') === e)) return true;
            if (metaPorEnsayo[e] && (metaEnsayoCompletaParaOrden(e) || ensayoMetaTieneDatosTrabajo(e))) {
                return true;
            }
            return false;
        }

        function hayOtrosEnsayosPendientesTrasEnvio_(ensayoEnviado) {
            const enviado = String(ensayoEnviado || '').trim();
            return ensayosCandidatosConDatosCampo().some((e) => e !== enviado)
                || Object.keys(metaPorEnsayo || {}).some((k) => k !== enviado && ensayoTieneDatosLocalesPendientes_(k));
        }

        function siguienteEnsayoPendienteTrasEnvio_(ensayoEnviado) {
            const enviado = String(ensayoEnviado || '').trim();
            const completos = obtenerEnsayosCompletosParaEnvio().filter((e) => e !== enviado);
            if (completos.length) return completos[0];
            const candidatos = ensayosCandidatosConDatosCampo().filter((e) => e !== enviado);
            if (candidatos.length) return candidatos[0];
            return '';
        }

        async function limpiarEnsayoEnviadoPreservandoOtros_(ensayoEnviado) {
            const enviado = String(ensayoEnviado || '').trim();
            if (!enviado) return '';

            for (let i = data.length - 1; i >= 0; i--) {
                if (String(data[i]?.ensayo || 'Ensayo 1') === enviado) {
                    data.splice(i, 1);
                }
            }
            delete ensayoMeta[enviado];
            delete metaPorEnsayo[enviado];
            delete numerosMuestraFijadosSesion[enviado];
            if (llenadoJarrasState.porEnsayo) delete llenadoJarrasState.porEnsayo[enviado];
            if (llenadoJarrasState.usuarioVacio) delete llenadoJarrasState.usuarioVacio[enviado];

            if (!navigator.onLine || !API_URL) {
                sincronizarMaxNumMuestraDesdeContextoLocal();
                invalidarNumerosMuestraFijadosObsoletos();
                refrescarEstadoOperativoLocal();
            } else {
                await refrescarMaxNumMuestraDesdeServidor();
            }

            const siguiente = siguienteEnsayoPendienteTrasEnvio_(enviado);
            if (siguiente) {
                aplicarCambioMuestraRapido(siguiente);
            } else {
                const num = Number(numeroDesdeEnsayoTexto(enviado)) || 1;
                const prox = ensayoNombreDesdeNumero(num + 1);
                if (prox && num < MAX_MUESTRAS_CAMPO) {
                    if (!metaPorEnsayo[prox]) {
                        metaPorEnsayo[prox] = metaPlantillaVaciaEnsayo_(prox);
                    }
                    aplicarCambioMuestraRapido(prox);
                }
            }

            sincronizarLogisticaAcopioDesdeEnsayo();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            renderizarPanelLlenadoJarras();
            renderizarTarjetas();
            actualizarBarraHeaderEstado();
            actualizarBloqueoControlesPorPeso1();
            aplicarBloqueoMuestrasCacheLocal();
            return siguiente || metaActivoEnsayo || '';
        }

        async function vaciarDatosIngresoPreservandoMuestraYNumeracion_(ensayoEnviado) {
            const ensayoRef = String(ensayoEnviado || '').trim();
            const muestraEl = document.getElementById('visual-meta-muestra');
            const muestraPreservada = String(muestraEl?.value || ensayoRef || metaActivoEnsayo || 'Ensayo 1').trim() || 'Ensayo 1';

            data.splice(0, data.length);
            Object.keys(ensayoMeta).forEach((k) => delete ensayoMeta[k]);
            llenadoJarrasState.porEnsayo = {};
            llenadoJarrasState.usuarioVacio = {};
            siguienteIdFilaJarras = 1;
            editingCardId = null;
            metricModalState.itemId = null;
            metricModalState.kind = null;
            observationModalState.itemId = null;

            metaPorEnsayo = {
                [muestraPreservada]: {
                    'visual-meta-muestra': muestraPreservada,
                    'visual-rotulo': muestraPreservada
                }
            };
            metaActivoEnsayo = muestraPreservada;
            ensayoActivo = muestraPreservada;

            document.querySelectorAll('input[id^="visual-"], textarea[id^="visual-"], select[id^="visual-"]').forEach((el) => {
                if (!el || el.id === 'visual-meta-muestra' || el.id === 'visual-num-muestra') return;
                if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
                else el.value = '';
            });
            document.querySelectorAll('input[id^="resumen-"], textarea[id^="resumen-"], select[id^="resumen-"]').forEach((el) => {
                if (!el) return;
                if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
                else el.value = '';
            });

            if (muestraEl) muestraEl.value = muestraPreservada;
            const rotulo = document.getElementById('visual-rotulo');
            if (rotulo) rotulo.value = muestraPreservada;

            if (!navigator.onLine || !API_URL) {
                sincronizarMaxNumMuestraDesdeContextoLocal();
                invalidarNumerosMuestraFijadosObsoletos();
                refrescarEstadoOperativoLocal();
            } else {
                await refrescarMaxNumMuestraDesdeServidor();
            }
            cargarMetaDeEnsayo(muestraPreservada);

            sincronizarTrazabilidadCompuesta();
            sincronizarChipsDesdeAlmacenamiento();
            sincronizarLogisticaAcopioDesdeEnsayo();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            asegurarClamshellInicialVacio(muestraPreservada);
            renderizarPanelLlenadoJarras();
            renderizarTarjetas();
            actualizarBarraHeaderEstado();
            actualizarBloqueoControlesPorPeso1();
            document.querySelectorAll('.logistica-acopio-block').forEach((block) => block.removeAttribute('open'));
            document.querySelector('.llenado-jarras-wrapper')?.removeAttribute('open');
            return muestraPreservada;
        }

        async function resetearIngresoCampoTrasEnvioExitoso(ensayoEnviado) {
            const enviado = String(ensayoEnviado || '').trim();
            const quedanOtros = hayOtrosEnsayosPendientesTrasEnvio_(enviado);
            if (quedanOtros) {
                await limpiarEnsayoEnviadoPreservandoOtros_(enviado);
            } else {
                await vaciarDatosIngresoPreservandoMuestraYNumeracion_(enviado);
            limpiarPersistenciaLocalTrasEnvio();
            }
            establecerAcordeonMetaAbierto(false);
            guardarMetaEnAlmacenamiento();
            guardarDraftCompleto();
        }

        async function iniciarRegistroDatosVacios() {
            await vaciarDatosIngresoPreservandoMuestraYNumeracion_(metaActivoEnsayo);
            establecerAcordeonMetaAbierto(true);
            programarGuardadoMeta();
            guardarDraftCompleto();
            mostrarToast('info', 'Registro', 'Datos vaciados: se mantiene la muestra y el N° muestra avanza solo. Completa de nuevo.');
            actualizarIconos();
        }
        window.iniciarRegistroDatosVacios = iniciarRegistroDatosVacios;

        function fabIniciarRegistroDesdeFab() {
            const ensayo = String(obtenerEnsayoActivo() || document.getElementById('visual-meta-muestra')?.value || 'Ensayo 1').trim() || 'Ensayo 1';
            cargarSimulacion8Clamshell(ensayo);
            establecerAcordeonMetaAbierto(true);
            if (esModoRegistroAcopio_()) {
                document.querySelector('.logistica-formato-block')?.setAttribute('open', '');
                document.querySelector('.logistica-despacho-block')?.setAttribute('open', '');
                document.querySelector('.llenado-jarras-wrapper')?.setAttribute('open', '');
            }
            programarActualizarErroresMetaFormulario();
            actualizarIconos();
        }
        window.fabIniciarRegistroDesdeFab = fabIniciarRegistroDesdeFab;

        /**
         * Simulación manual (FAB): rellena inputs y tarjetas visibles para pruebas.
         * No inyecta meta en objetos internos; snapshotMeta lee el formulario después.
         */
        function cargarSimulacion8Clamshell(ensayoObjetivo) {
            const ensayo = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1').trim() || 'Ensayo 1';
            const esAcopio = esModoRegistroAcopio_();
            cambiarEnsayoActivoEnFormulario_(ensayo);

            const ahora = new Date();
            const hh = String(ahora.getHours()).padStart(2, '0');
            const mm = String(ahora.getMinutes()).padStart(2, '0');
            const metaDemo = esAcopio ? {
                'visual-meta-muestra': ensayo,
                'visual-rotulo': ensayo,
                'visual-responsable': 'SIMULACION ACOPIO',
                'visual-guia-precosecha': '5 / 12',
                'visual-hora': `${hh}:${mm}`,
                'visual-meta-fundo': 'LN',
                'visual-traz-acopio': 'Acopio 1',
                'visual-traz-etapa': 'E02',
                'visual-traz-campo': 'C03',
                'visual-traz-turno': '12',
                'visual-meta-variedad': 'Sekoya Pop Orgánica',
                'visual-guia-acopio': '208353',
                'visual-placa-vehiculo': '9967-OK',
                'visual-observacion-formato': 'Simulación Acopio — datos de prueba para envío.',
                'visual-trazabilidad': 'E02-C03-12'
            } : {
                'visual-meta-muestra': ensayo,
                'visual-rotulo': ensayo,
                'visual-responsable': 'SIMULACION CAMPO',
                'visual-guia-precosecha': '5 / 12',
                'visual-hora': `${hh}:${mm}`,
                'visual-meta-fundo': 'LN',
                'visual-traz-etapa': 'E02',
                'visual-traz-campo': 'C03',
                'visual-traz-turno': 'T1',
                'visual-meta-variedad': 'Sekoya Pop Orgánica',
                'visual-guia-acopio': '208353',
                'visual-placa-vehiculo': '9967-OK',
                'visual-traz-acopio': 'Acopio 1',
                'visual-trazabilidad': 'E02-C03-T1'
            };

            aplicarMetaDemoEnFormularioCampo_(metaDemo, ensayo);
            persistirLogisticaAcopioDesdeInputs();
            void (async () => {
                if (navigator.onLine && API_URL) {
                    await refrescarEstadoServidorOperativo(true);
                } else {
                    refrescarEstadoOperativoLocal();
                }
                asegurarNumMuestraAsignadoSiVacio(ensayo);
                actualizarVistaCompacta();
                actualizarProgresoMeta();
                programarGuardadoMeta();
            })();

            for (let i = data.length - 1; i >= 0; i--) {
                if (String(data[i]?.ensayo || 'Ensayo 1') === ensayo) data.splice(i, 1);
            }
            const simTiempos = construirSimulacionJarrasYTiemposCampo_(esAcopio, ensayo, siguienteIdFilaJarras);
            siguienteIdFilaJarras = simTiempos.nextId;
            llenadoJarrasState.porEnsayo[ensayo] = simTiempos.jarrasFilas;
            const tiempoLider = simTiempos.tiempoLider;

            const presionGlobal = {
                presionAmbienteInicio: '101.325', presionAmbienteTermino: '101.280',
                presionAmbienteLlegada: '101.310', presionAmbienteDespacho: '101.295',
                presionFrutaInicio: '98.450', presionFrutaTermino: '98.520',
                presionFrutaLlegada: '98.610', presionFrutaDespacho: '98.580'
            };
            const tempGlobal = {
                inicioAmbiente: '23.1', inicioPulpa: '14.1',
                terminoAmbiente: '23.8', terminoPulpa: '14.7',
                llegadaAmbiente: '24.2', llegadaPulpa: '15.0',
                despachoAmbiente: '24.6', despachoPulpa: '15.2',
                ...presionGlobal
            };
            const humGlobal = { inicio: '66.4', termino: '64.9', llegada: '63.5', despacho: '62.8' };

            let maxId = data.length ? Math.max(...data.map((d) => Number(d.id) || 0)) : 0;
            const guiaDom = String(document.getElementById('visual-guia-acopio')?.value || '').trim();
            const placaDom = String(document.getElementById('visual-placa-vehiculo')?.value || '').trim().toUpperCase();
            for (let n = 1; n <= 8; n++) {
                maxId += 1;
                const metric = metricaVacia();
                metric.temperatura = { ...metric.temperatura, ...tempGlobal };
                metric.humedad = { ...metric.humedad, ...humGlobal };
                if (n === 1) metric.tiempo = { ...metric.tiempo, ...tiempoLider };
                const nJarra = n <= 4 ? 1 : 2;
                const p4Sim = 125 - n;
                const p5Sim = 118 - n;
                data.push({
                    id: maxId,
                    jarra: nJarra,
                    ensayo,
                    p1: 145 + n,
                    p2: 133 + n,
                    acopio: 123 + n,
                    p4: esAcopio ? p4Sim : undefined,
                    despacho: esAcopio ? p5Sim : (121 + n),
                    observacion: esAcopio ? `SIM-ACOPIO-${n}` : `SIM-${n}`,
                    placaVehiculo: placaDom,
                    guiaRemision: guiaDom,
                    metric
                });
            }

            recalcularPresionesParaEnsayo(ensayo);
            marcarEnsayoEnUsoSesion(ensayo);
            renderizarTarjetas();
            renderizarPanelLlenadoJarras();
            sincronizarTiempoPorJarra(ensayo);
            actualizarBarraHeaderEstado();
            actualizarBloqueoControlesPorPeso1();
            programarGuardadoMeta();
            programarGuardadoDraftCompleto();
            programarActualizarErroresMetaFormulario();
            const faltantesSim = recolectarFaltantesEnvio(ensayo);
            const etiquetaModo = esAcopio ? 'Acopio' : 'Visual';
            if (faltantesSim.length) {
                establecerAcordeonMetaAbierto(true);
                void mostrarFaltantesEnvioCampo_(
                    faltantesSim,
                    `Simulación incompleta (${faltantesSim.length})`
                );
                mostrarToast(
                    'warning',
                    'Revisa la simulación',
                    `${ensayo} (${etiquetaModo}): faltan datos para poder enviar.`
                );
                return;
            }
            mostrarToast('success', 'Simulación lista', `${ensayo} (${etiquetaModo}): datos de prueba válidos en formulario y tarjetas.`);
        }
        window.cargarSimulacion8Clamshell = cargarSimulacion8Clamshell;

        /** Opcional: en consola `cargarSimulacionLocalDev_()` para disparar la simulación en localhost. */
        function intentarAutocargaSimulacionLocal_() {
            try {
                const host = String(window.location?.hostname || '').toLowerCase();
                const esLocal = host === '127.0.0.1' || host === 'localhost';
                if (!esLocal) return;
                const ensayo = String(obtenerEnsayoActivo() || 'Ensayo 1');
                const itemsEnsayo = data.filter((it) => String(it?.ensayo || 'Ensayo 1') === ensayo);
                const completos = itemsEnsayo.filter((it) => Number(it?.p1 || 0) > 0 && Number(it?.p2 || 0) > 0);
                const todasEnJarra1 = itemsEnsayo.length > 0
                    && itemsEnsayo.every((it) => Number(it?.jarra || 0) === 1);
                const yaEstaLista = itemsEnsayo.length >= 8 && completos.length >= 8 && todasEnJarra1;
                if (yaEstaLista) return;

                // En entorno local de pruebas, si el borrador viene parcial, se repone la simulación completa.
                setTimeout(() => cargarSimulacion8Clamshell(ensayo), 220);
            } catch (_) { /* ignore */ }
        }
        window.cargarSimulacionLocalDev_ = intentarAutocargaSimulacionLocal_;

        function esEntornoLocalPruebas_() {
            try {
                const host = String(window.location?.hostname || '').toLowerCase();
                return host === '127.0.0.1' || host === 'localhost';
            } catch (_) {
                return false;
            }
        }

        function pushEstadoSync(reg) {
            const historial = cargarHistorialSync();
            historial.push({
                uid: reg.uid,
                fecha: reg.fecha,
                ensayo_numero: reg.ensayo_numero,
                num_muestra: reg.num_muestra || '',
                ensayo: reg.ensayo || '',
                modo: reg.modo_registro || reg.modo || '',
                estado: reg.estado,
                ts: Date.now(),
                intentos: reg.intentos || 0,
                error: reg.error || ''
            });
            guardarHistorialSync(historial);
            if (String(reg?.estado || '') === 'subido') {
                archivarEnvioLocalExitoso_(reg);
            }
        }

        function callbackJsonp(urlBase, params, timeoutMs) {
            const waitMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : 8000;
            return new Promise((resolve, reject) => {
                const cb = '__cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                const noopCb = function () { };
                const qs = new URLSearchParams(params || {});
                qs.set('callback', cb);
                // Evita respuestas cacheadas para validaciones de existencia en tiempo real.
                qs.set('_ts', String(Date.now()));
                const src = urlBase + (urlBase.includes('?') ? '&' : '?') + qs.toString();
                let done = false;
                const timeoutId = setTimeout(() => {
                    if (done) return;
                    done = true;
                    window[cb] = noopCb;
                    if (script && script.parentNode) script.parentNode.removeChild(script);
                    reject(new Error('Timeout JSONP'));
                }, waitMs);

                const script = document.createElement('script');
                window[cb] = (payload) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeoutId);
                    window[cb] = noopCb;
                    if (script && script.parentNode) script.parentNode.removeChild(script);
                    resolve(payload);
                };
                script.onerror = () => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeoutId);
                    window[cb] = noopCb;
                    if (script && script.parentNode) script.parentNode.removeChild(script);
                    reject(new Error('Error JSONP'));
                };
                script.src = src;
                document.body.appendChild(script);
            });
        }

        async function callbackJsonpConReintentos(urlBase, params, intentos, timeoutMs) {
            const max = Math.max(1, Number(intentos) || 1);
            let ultimoError = null;
            for (let i = 0; i < max; i++) {
                try {
                    return await callbackJsonp(urlBase, params, timeoutMs);
                } catch (err) {
                    ultimoError = err;
                    if (i < max - 1) await new Promise((r) => setTimeout(r, 280));
                }
            }
            throw ultimoError || new Error('JSONP falló');
        }

        let servidorOperativoRefrescando = false;
        let servidorOperativoRefreshPromise = null;
        let refrescoVisibleCampoTimer = null;
        let servidorOperativoFallosSeguidos = 0;
        let servidorOperativoRetryTimer = null;

        function programarReintentoEstadoServidor() {
            if (servidorOperativoRetryTimer) return;
            if (!navigator.onLine) return;
            const espera = Math.min(30000, 2000 + servidorOperativoFallosSeguidos * 1500);
            servidorOperativoRetryTimer = setTimeout(() => {
                servidorOperativoRetryTimer = null;
                void refrescarEstadoServidorOperativo(true);
            }, espera);
        }

        function firmaEstadoServidor(r) {
            if (!r || r.ok !== true) return '';
            const ens = Array.isArray(r.ensayos)
                ? [...r.ensayos].map((x) => String(x).trim()).filter(Boolean).sort().join(',')
                : '';
            const mx = Number(r.ultimo_num_muestra_en_hoja ?? r.max_en_hoja) || 0;
            const celda = String(r.ultimo_num_muestra_celda ?? '').trim();
            return `${mx}|${celda}|${ens}`;
        }

        function obtenerPrimeraMuestraLibreNombre() {
            for (let m = 1; m <= MAX_MUESTRAS_CAMPO; m++) {
                if (!ensayoNumeroRegistradoHoy(String(m))) {
                    return ensayoNombreDesdeNumero(m) || `Ensayo ${m}`;
                }
            }
            return 'Ensayo 1';
        }

        /** true si estás en Muestra 3+ pero Muestra 1 (o 2) ya está libre en planilla → volver al inicio. */
        function necesitaReposicionarAPrimeraLibre() {
            const primera = obtenerPrimeraMuestraLibreNombre();
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
            if (!activo) return true;
            if (ensayoEstaRegistradoHoy(activo)) return true;
            const na = Number(numeroDesdeEnsayoTexto(activo)) || 99;
            const np = Number(numeroDesdeEnsayoTexto(primera)) || 1;
            return na > np;
        }

        /** Tras cambio en planilla: siempre la primera muestra NO registrada (M1 si 1 y 2 están libres). */
        function reposicionarPantallaPrimeraMuestraLibre(origen) {
            const primera = obtenerPrimeraMuestraLibreNombre();
            const destino = primera;
            Object.keys(numerosMuestraFijadosSesion).forEach((k) => delete numerosMuestraFijadosSesion[k]);

            metaActivoEnsayo = destino;
            const sel = document.getElementById('visual-meta-muestra');
            const rotulo = document.getElementById('visual-rotulo');
            if (sel) sel.value = destino;
            if (rotulo) rotulo.value = destino;
            cargarMetaDeEnsayo(destino);
            aplicarCambioEnsayoActivo();

            const num = calcularNumMuestraDesdeServidorParaEnsayo(destino);
            if (num) {
                aplicarNumMuestraEnsayo(destino, num, false, origen || 'reposicionarPrimeraLibre');
            } else {
                const inp = document.getElementById('visual-num-muestra');
                if (inp) inp.value = '';
            }
            aplicarBloqueoMuestrasCacheLocal();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            return destino;
        }

        /** Si la planilla cambió (otro usuario, filas movidas/borradas), empuja N° y bloqueos a la pantalla. */
        function propagarCambiosPlanillaServidorALaPantalla(r, opciones) {
            const opts = opciones || {};
            if (!r || r.ok !== true) return false;

            const firma = firmaEstadoServidor(r);
            const cambioFirma = firma !== ultimaFirmaEstadoServidor;
            ultimaFirmaEstadoServidor = firma;

            const mxNuevo = Number(r.ultimo_num_muestra_en_hoja ?? r.max_en_hoja);
            const mxValido = Number.isFinite(mxNuevo) && mxNuevo >= 0 ? Math.floor(mxNuevo) : numMuestraMaxServidorCache;
            const maxCambio = mxValido !== ultimoMaxPlanillaConocido;
            ultimoMaxPlanillaConocido = mxValido;

            if (!cambioFirma && !maxCambio && !opts.forzarUi) return false;

            const preservarBorrador = debePreservarBorradorCampoEnSync_();

            // N° muestra siempre sigue la planilla; el borrador no debe congelarlo (Acopio 93 / Visual 94).
            if (!envioRegistroEnCurso && (opts.invalidarFijados || maxCambio || cambioFirma || opts.forzarUi || opts.alinearNumMuestra !== false)) {
                Object.keys(numerosMuestraFijadosSesion).forEach((k) => {
                    if (!ensayoEstaRegistradoHoy(k)) delete numerosMuestraFijadosSesion[k];
                });
            }

            const alinearInicio = necesitaReposicionarAPrimeraLibre();
            if (!preservarBorrador && opts.reposicionarPrimera !== false && (
                opts.forzarUi || opts.invalidarFijados || cambioFirma || maxCambio || alinearInicio
            )) {
                reposicionarPantallaPrimeraMuestraLibre('propagarPlanilla');
            } else {
                const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
                if (activo && !ensayoEstaRegistradoHoy(activo) && !envioRegistroEnCurso) {
                    aplicarNumMuestraParaEnsayoActivo('syncPlanilla');
                }
                aplicarBloqueoMuestrasCacheLocal();
                actualizarVistaCompacta();
                actualizarProgresoMeta();
            }

            if ((cambioFirma || maxCambio) && opts.avisar !== false && document.visibilityState === 'visible') {
                const ahora = Date.now();
                if (opts.forzarUi || ahora - ultimoToastPlanillaSyncMs > 55000) {
                    ultimoToastPlanillaSyncMs = ahora;
                    const prox = mxValido > 0
                        ? formatearNumMuestraAutoDesdeN(mxValido + 1)
                        : (proximoNumMuestraServidorCache || '');
                    mostrarToast(
                        'info',
                        'Planilla actualizada',
                        mxValido > 0
                            ? `Último N° en planilla: ${mxValido}. Siguiente libre: ${prox || '—'}.`
                            : 'Se sincronizó el estado con la planilla.'
                    );
                }
            }
            return cambioFirma || maxCambio;
        }

        /** Opción 1: sincronizar con planilla (no borra datos locales). Opción 2: borrarTodo = forzar desde cero. */
        async function sincronizarConPlanillaAhora() {
            if (!API_URL) {
                mostrarToast('warning', 'Sin API', 'Configura la URL de Apps Script en api-config.js');
                return false;
            }
            if (!navigator.onLine) {
                refrescarEstadoOperativoLocal();
                actualizarVistaCompacta();
                actualizarProgresoMeta();
                mostrarToast('warning', 'Sin internet', 'Solo se actualizó el estado local.');
                return false;
            }
            setNumMuestraCargando(true);
            try {
                const ok = await refrescarEstadoServidorOperativo(true);
                if (ok && ultimaRespuestaEstadoServidor) {
                    propagarCambiosPlanillaServidorALaPantalla(ultimaRespuestaEstadoServidor, {
                        forzarUi: true,
                        invalidarFijados: true,
                        reposicionarPrimera: true,
                        avisar: true
                    });
                } else if (!ok) {
                    mostrarToast('warning', 'Planilla', 'No se pudo leer el servidor. Revisa la URL o vuelve a desplegar Apps Script.');
                }
                return ok;
            } finally {
                setNumMuestraCargando(false);
            }
        }
        window.sincronizarConPlanillaAhora = sincronizarConPlanillaAhora;

        function aplicarBloqueoMuestrasCacheLocal() {
            aplicarBloqueoSelectMuestra(obtenerEnsayosRegistradosConfirmadosParaUiBloqueo_());
        }

        /** Planilla: último NUM_MUESTRA en celda (GET) + 1 para el campo. */
        function establecerEstadoNumMuestraDesdeServidor(respServidor) {
            const r = (respServidor && typeof respServidor === 'object')
                ? respServidor
                : { max_en_hoja: respServidor };
            const ultimoCelda = String(r.ultimo_num_muestra_celda ?? '').trim();
            const ultimoFila = Number(r.ultimo_num_muestra_fila) || 0;
            const mx = Number(r.ultimo_num_muestra_en_hoja ?? r.max_en_hoja);
            const maxCol = Number(r.max_digitos_columna);
            const proxJson = normalizarNumMuestraInput(r.proximo_num_muestra);
            const prefijoSrv = String(r.num_muestra_prefijo ?? '').trim().toUpperCase();
            if (ultimoCelda) {
                const pCelda = prefijoNumMuestraDesdeTexto(ultimoCelda);
                if (pCelda) numMuestraPrefijoCache = pCelda;
            } else if (prefijoSrv) {
                numMuestraPrefijoCache = prefijoSrv;
            } else if (Number.isFinite(mx) && mx === 0) {
                numMuestraPrefijoCache = prefijoDefaultNumMuestraCampo();
            } else if (proxJson) {
                actualizarPrefijoNumMuestraCacheDesdeTexto(proxJson);
            }

            logNumMuestra('SERVIDOR GET planilla', {
                ultimo_num_muestra_celda: ultimoCelda || '(vacío)',
                fila_excel: ultimoFila || '(sin fila)',
                ultimo_num_muestra_en_hoja: Number.isFinite(mx) ? mx : '(inválido)',
                max_digitos_toda_la_columna: Number.isFinite(maxCol) ? maxCol : '(no enviado)',
                num_muestra_prefijo: numMuestraPrefijoCache || '(vacío)',
                proximo_num_muestra_json: r.proximo_num_muestra ?? '(vacío)'
            });

            if (Number.isFinite(mx) && mx >= 0) {
                numMuestraMaxServidorCache = Math.floor(mx);
                proximoNumMuestraServidorCache = proxJson
                    || formatearNumMuestraAutoDesdeN(numMuestraMaxServidorCache + 1);
                logNumMuestra('APLICAR ultimo planilla + 1', {
                    ultimo_planilla: numMuestraMaxServidorCache,
                    proximo_en_pantalla: proximoNumMuestraServidorCache
                });
            } else {
                const prox = proxJson;
                if (prox) {
                    proximoNumMuestraServidorCache = prox;
                    actualizarPrefijoNumMuestraCacheDesdeTexto(prox);
                    const p = parseNumMuestraSoloDigitos(prox);
                    if (p > 0) numMuestraMaxServidorCache = p - 1;
                    logNumMuestra('FALLBACK sin ultimo en hoja', { proximo_desde_json: prox });
                }
            }
            numMuestraSincronizadoServidor = true;
            ultimoMaxPlanillaConocido = numMuestraMaxServidorCache;
            purgarUsadosLocalTrasSyncPlanilla_();
            sincronizarNumMuestraPantallaDesdeServidor();
        }

        /** Sin red: solo el último estado_operativo de esta sesión (memoria), no localStorage. */
        function prepararProximoNumMuestraOffline() {
            if (proximoNumMuestraServidorCache) return;
            if (navigator.onLine && API_URL) return;
            if (!numMuestraSincronizadoServidor) return;
            proximoNumMuestraServidorCache = formatearNumMuestraAutoDesdeN(
                (Number(numMuestraMaxServidorCache) || 0) + 1
            );
        }

        function listarEnsayosEnCursoOrdenados() {
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || '').trim();
            if (activo) marcarEnsayoEnUsoSesion(activo);
            const keys = [...ensayosActivadosSesion].filter((e) => !ensayoEstaRegistradoHoy(e));
            keys.sort((a, b) => {
                const na = Number(numeroDesdeEnsayoTexto(a)) || 0;
                const nb = Number(numeroDesdeEnsayoTexto(b)) || 0;
                return na - nb || String(a).localeCompare(String(b));
            });
            return keys;
        }

        /** Muestras con meta 8/8 o registradas (solo esas cuentan para huecos y N° muestra). */
        function obtenerNumerosMuestraEnContexto() {
            const nums = [];
            for (let i = 1; i <= MAX_MUESTRAS_CAMPO; i++) {
                if (muestraEstaEnSecuenciaLlenado(i)) nums.push(i);
            }
            return nums;
        }

        function detectarHuecosEnSecuenciaMuestras() {
            const numeros = obtenerNumerosMuestraEnContexto();
            const huecos = [];
            if (numeros.length < 2) return { numeros, huecos };
            for (let i = numeros[0]; i <= numeros[numeros.length - 1]; i++) {
                if (!numeros.includes(i)) huecos.push(i);
            }
            return { numeros, huecos };
        }

        function detectarHuecosEnMuestrasListasParaEnvio(ensayosCompletos) {
            const numeros = ordenarEnsayosPorNumeroMuestra(ensayosCompletos || [])
                .map((e) => Number(numeroDesdeEnsayoTexto(e)) || 0)
                .filter((n) => n >= 1 && n <= MAX_MUESTRAS_CAMPO);
            const huecos = [];
            if (numeros.length < 2) return { numeros, huecos };
            for (let i = numeros[0]; i <= numeros[numeros.length - 1]; i++) {
                if (!numeros.includes(i)) huecos.push(i);
            }
            return { numeros, huecos };
        }

        async function validarSecuenciaMuestrasListasParaEnvio(ensayosCompletos) {
            const { numeros, huecos } = detectarHuecosEnMuestrasListasParaEnvio(ensayosCompletos);
            if (!huecos.length) return true;
            const txtHuecos = huecos.map((n) => `Muestra ${n}`).join(', ');
            const txtHay = numeros.map((n) => `Muestra ${n}`).join(', ');
            const html = `
                <div style="text-align:left;line-height:1.45;font-size:14px;">
                    <p style="margin:0 0 10px;">Hay <b>${txtHay}</b> listas para enviar, pero falta <b>${txtHuecos}</b> en esa secuencia.</p>
                    <p style="margin:0;color:#64748b;">Completa o envía las muestras intermedias antes de enviar las siguientes.</p>
                </div>
            `;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireSafe({
                    icon: 'warning',
                    title: 'Hueco entre muestras listas',
                    html,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#1f4f82',
                    allowOutsideClick: false
                });
            } else {
                alert(`Falta ${txtHuecos} entre las muestras listas (${txtHay}).`);
            }
            return false;
        }

        let ultimoHuecosMuestraAlertadosKey = '';

        async function validarSecuenciaMuestraSinHuecos(opciones) {
            const { numeros, huecos } = detectarHuecosEnSecuenciaMuestras();
            if (!huecos.length) {
                ultimoHuecosMuestraAlertadosKey = '';
                return true;
            }
            const alertKey = `${numeros.join('-')}|${huecos.join('-')}`;
            const soloAvisar = opciones?.soloAvisar === true;
            if (soloAvisar && ultimoHuecosMuestraAlertadosKey === alertKey) return true;
            ultimoHuecosMuestraAlertadosKey = alertKey;
            const txtHuecos = huecos.map((n) => `Muestra ${n}`).join(', ');
            const txtHay = numeros.map((n) => `Muestra ${n}`).join(', ');
            const html = `
                <div style="text-align:left;line-height:1.45;font-size:14px;">
                    <p style="margin:0 0 10px;">Hay <b>${txtHay}</b> pero falta <b>${txtHuecos}</b>.</p>
                    <p style="margin:0;color:#64748b;">Los N° muestra van en orden continuo (1→2→3…). No se puede saltar una muestra del medio: perjudica la numeración en planilla.</p>
                </div>
            `;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireSafe({
                    icon: 'warning',
                    title: 'Hueco en la secuencia de muestras',
                    html,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#1f4f82',
                    allowOutsideClick: false
                });
            } else {
                alert(`Falta ${txtHuecos}. Hay ${txtHay}. Completa la secuencia sin saltar muestras.`);
            }
            return soloAvisar;
        }

        /** N° = último en planilla/cola + muestras anteriores aún no guardadas hoy (sin doble contar). */
        function calcularNumMuestraBaseDesdeContexto(ensayo) {
            const destino = Number(numeroDesdeEnsayoTexto(ensayo)) || 1;
            const previas = contarMuestrasAnterioresEnSecuencia(destino);
            const ultimo = leerMaxNumericoNumMuestraTodoContexto();
            return formatearNumMuestraAutoDesdeN(ultimo + previas + 1);
        }

        /** Lote adicional del mismo ensayo ya registrado hoy: siguiente N° global (nunca vacío). */
        function calcularNumMuestraLoteAdicionalEnsayoRegistrado_(ensayo) {
            if (!numMuestraSincronizadoServidor && navigator.onLine && API_URL) return '';
            if (!numMuestraSincronizadoServidor) prepararProximoNumMuestraOffline();
            const ultimo = leerMaxNumericoNumMuestraTodoContexto();
            return formatearNumMuestraAutoDesdeN(ultimo + 1);
        }

        function calcularNumMuestraDesdeServidorParaEnsayo(ensayo) {
            if (ensayoEstaRegistradoHoy(ensayo)) {
                return calcularNumMuestraLoteAdicionalEnsayoRegistrado_(ensayo);
            }
            if (navigator.onLine && API_URL && !numMuestraSincronizadoServidor) return '';
            const e = String(ensayo || '').trim();
            if (!numMuestraSincronizadoServidor) prepararProximoNumMuestraOffline();
            const calculado = calcularNumMuestraBaseDesdeContexto(ensayo);
            const fijado = numerosMuestraFijadosSesion[e];
            if (fijado) {
                const f = parseNumMuestraSoloDigitos(fijado);
                const c = parseNumMuestraSoloDigitos(calculado);
                if (f && c && f === c) return fijado;
                delete numerosMuestraFijadosSesion[e];
            }
            if (numMuestraSincronizadoServidor || (!navigator.onLine || !API_URL)) {
                return calculado;
            }
            return '';
        }

        function ordenarEnsayosPorNumeroMuestra(ensayos) {
            return [...ensayos].sort((a, b) => {
                const na = Number(numeroDesdeEnsayoTexto(a)) || 0;
                const nb = Number(numeroDesdeEnsayoTexto(b)) || 0;
                return na - nb || String(a).localeCompare(String(b));
            });
        }

        /** Solo la muestra activa: último en planilla + 1. */
        function aplicarNumeracionDesdeServidor(forzarServidor) {
            purgarMetaNumMuestraEnsayosRegistradosHoy();
            const activo = metaActivoEnsayo || ensayoDesdeFormulario();
            if (activo) aplicarNumeroMuestraDesdePlanilla(activo);
        }

        /** Sin red: bloqueo + numeración desde último max persistido. */
        function refrescarEstadoOperativoLocal() {
            sincronizarMaxNumMuestraDesdeContextoLocal();
            invalidarNumerosMuestraFijadosObsoletos();
            purgarMetaNumMuestraEnsayosRegistradosHoy();
            prepararProximoNumMuestraOffline();
            aplicarBloqueoMuestrasCacheLocal();
            aplicarNumeracionDesdeServidor(false);
            return true;
        }

        function numMuestraReservadoEnColaLocal(nmKey, ensayoExcluir) {
            if (!nmKey) return false;
            try {
                return cargarColaSync().some((reg) => {
                    const st = String(reg?.estado || '');
                    if (st !== 'pendiente' && st !== 'bloqueado') return false;
                    if (ensayoExcluir && String(reg?.ensayo || '') === ensayoExcluir) return false;
                    return normalizarNumMuestraClave(reg?.num_muestra || '') === nmKey;
                });
            } catch (_) {
                return false;
            }
        }

        /** estado_operativo (planilla + ensayos hoy); si falla, intenta proximo_num_muestra. */
        async function consultarEstadoNumMuestraServidor_(force) {
            const intentos = force ? 3 : 2;
            const r = await callbackJsonpConReintentos(API_URL, {
                estado_operativo: '1',
                fecha: hoyIsoLocal()
            }, intentos, 8000);
            if (r && r.ok === true) return r;
            logNumMuestra('consultarEstadoNumMuestraServidor_ fallback proximo_num_muestra', { respuesta_estado: r });
            const r2 = await callbackJsonpConReintentos(API_URL, { proximo_num_muestra: '1' }, 2, 8000);
            if (r2 && r2.ok === true) {
                return { ...r2, ensayos: Array.isArray(r2.ensayos) ? r2.ensayos : [] };
            }
            return r2 || r;
        }

        /** Online: planilla + bloqueo. El N° muestra sale solo de proximo_num_muestra (code.gs). */
        async function refrescarEstadoServidorOperativo(force = false, opciones = {}) {
            aplicarBloqueoMuestrasCacheLocal();
            if (!API_URL || !navigator.onLine) {
                refrescarEstadoOperativoLocal();
                return false;
            }
            const ahora = Date.now();
            if (!force && ahora - ultimoRefreshServidorOperativoMs < REFRESH_SERVIDOR_MIN_MS) {
                return numMuestraSincronizadoServidor;
            }
            if (servidorOperativoRefreshPromise) return servidorOperativoRefreshPromise;
            servidorOperativoRefrescando = true;
            servidorOperativoRefreshPromise = (async () => {
                try {
                    const r = await consultarEstadoNumMuestraServidor_(force);
                    if (!r || r.ok !== true) {
                        logNumMuestra('refrescarEstadoServidorOperativo ERROR', { respuesta: r, force });
                        servidorOperativoFallosSeguidos++;
                        numMuestraSincronizadoServidor = false;
                        programarReintentoEstadoServidor();
                        aplicarBloqueoMuestrasCacheLocal();
                        avisarFalloSincronizacionNumMuestra('refrescarEstadoServidorOperativo');
                        return false;
                    }
                    servidorOperativoFallosSeguidos = 0;
                    ultimoRefreshServidorOperativoMs = Date.now();
                    ultimaRespuestaEstadoServidor = r;
                    establecerEstadoNumMuestraDesdeServidor(r);
                    if (Array.isArray(r.ensayos)) {
                        bloqueoMuestraCacheNums = new Set(r.ensayos.map((e) => String(e).trim()).filter(Boolean));
                        bloqueoMuestraUltimoFetchMs = Date.now();
                        guardarCacheRegistradosHoy(bloqueoMuestraCacheNums);
                    } else if (numMuestraSincronizadoServidor) {
                        bloqueoMuestraCacheNums = new Set();
                        guardarCacheRegistradosHoy(bloqueoMuestraCacheNums);
                    }
                    limpiarNumerosMuestraLocalesNoRegistrados();
                    const preservarBorradorSync = debePreservarBorradorCampoEnSync_();
                    const reposicionarPrimera = opciones.reposicionarPrimera !== undefined
                        ? !!opciones.reposicionarPrimera
                        : (!preservarBorradorSync && (force || necesitaReposicionarAPrimeraLibre()));
                    const invalidarFijados = opciones.invalidarFijados !== undefined
                        ? !!opciones.invalidarFijados
                        : (!preservarBorradorSync && force);
                    propagarCambiosPlanillaServidorALaPantalla(r, {
                        avisar: opciones.avisar !== undefined ? opciones.avisar : !force,
                        invalidarFijados,
                        reposicionarPrimera
                    });
                    return true;
                } catch (err) {
                    logNumMuestra('refrescarEstadoServidorOperativo EXCEPCIÓN', { error: String(err) });
                    servidorOperativoFallosSeguidos++;
                    programarReintentoEstadoServidor();
                    numMuestraSincronizadoServidor = false;
                    aplicarBloqueoMuestrasCacheLocal();
                    return false;
                } finally {
                    servidorOperativoRefrescando = false;
                    servidorOperativoRefreshPromise = null;
                }
            })();
            return servidorOperativoRefreshPromise;
        }

        async function existeRegistroServidor(fecha, ensayoNumero) {
            if (!API_URL) return null;
            try {
                const r = await callbackJsonp(API_URL, {
                    fecha: String(fecha || ''),
                    ensayo_numero: String(ensayoNumero || ''),
                    existe_registro: '1'
                });
                if (!r || r.ok !== true) return null;
                return !!r.existe;
            } catch (_) {
                return null;
            }
        }

        async function existeUidServidor(uid) {
            if (!API_URL) return null;
            const id = String(uid || '').trim();
            if (!id) return null;
            try {
                const r = await callbackJsonp(API_URL, {
                    existe_uid: '1',
                    uid: id
                });
                if (!r || r.ok !== true) return null;
                return !!r.existe;
            } catch (_) {
                return null;
            }
        }

        async function existeNumMuestraServidor(numMuestra) {
            if (!API_URL) return null;
            const nm = String(numMuestra || '').trim().split('·')[0].trim().toUpperCase();
            if (!nm) return { existe: false, num_muestra: '', fecha: '', ensayo_numero: '' };
            try {
                const r = await callbackJsonp(API_URL, {
                    existe_num_muestra_global: '1',
                    num_muestra: nm
                });
                if (!r || r.ok !== true) return null;
                return {
                    existe: !!r.existe,
                    num_muestra: String(r.num_muestra || nm),
                    fecha: String(r.fecha || ''),
                    ensayo_numero: String(r.ensayo_numero || '')
                };
            } catch (_) {
                return null;
            }
        }

        /** Secuencia numérica: últimos 4 caracteres (ej. C260001 → 1). */
        function parseNumMuestraSoloDigitos(v) {
            const s = String(v ?? '').trim().toUpperCase();
            if (!s) return 0;
            const tail = s.length <= 4 ? s : s.slice(-4);
            if (!/^\d{1,4}$/.test(tail)) return 0;
            const n = parseInt(tail, 10);
            return Number.isFinite(n) && n >= 0 ? n : 0;
        }

        /** Prefijo antes de los 4 dígitos finales (ej. C260001 → C26). */
        function prefijoNumMuestraDesdeTexto(v) {
            const s = String(v ?? '').trim().toUpperCase();
            if (!s || s.length <= 4) return '';
            return s.slice(0, -4);
        }

        /** Planilla vacía: C + año (2 dígitos), ej. 2026 → C26 → primer N° C260001. */
        function prefijoDefaultNumMuestraCampo() {
            const y = new Date().getFullYear() % 100;
            return `C${String(y).padStart(2, '0')}`;
        }

        function actualizarPrefijoNumMuestraCacheDesdeTexto(v) {
            const p = prefijoNumMuestraDesdeTexto(v);
            if (p) numMuestraPrefijoCache = p;
        }

        function inferirPrefijoNumMuestraDesdeContexto() {
            if (numMuestraPrefijoCache) return numMuestraPrefijoCache;
            const celda = String(ultimaRespuestaEstadoServidor?.ultimo_num_muestra_celda ?? '').trim();
            if (celda) return prefijoNumMuestraDesdeTexto(celda);
            for (const meta of Object.values(metaPorEnsayo || {})) {
                const p = prefijoNumMuestraDesdeTexto(meta?.['visual-num-muestra']);
                if (p) return p;
            }
            for (const fij of Object.values(numerosMuestraFijadosSesion || {})) {
                const p = prefijoNumMuestraDesdeTexto(fij);
                if (p) return p;
            }
            if ((numMuestraMaxServidorCache || 0) === 0 && leerMaxNumericoNumMuestraTodoContexto() === 0) {
                return prefijoDefaultNumMuestraCampo();
            }
            return '';
        }

        function formatearNumMuestraAutoDesdeN(n, prefijoOpt) {
            if (!Number.isFinite(n) || n < 1) return '';
            const prefijo = prefijoOpt != null ? String(prefijoOpt) : inferirPrefijoNumMuestraDesdeContexto();
            const s = String(Math.floor(n));
            const seq = s.length < 4 ? s.padStart(4, '0') : s;
            return prefijo + seq;
        }

        function leerMaxNumericoNumMuestraTodoContexto() {
            let maxN = numMuestraMaxServidorCache;
            const subir = (raw) => {
                if (!raw) return;
                actualizarPrefijoNumMuestraCacheDesdeTexto(raw);
                const k = parseNumMuestraSoloDigitos(raw);
                if (k > maxN) maxN = k;
            };
            Object.entries(metaPorEnsayo).forEach(([ensayoKey, meta]) => {
                if (!metaEnsayoCuentaParaCalculoNumMuestra(ensayoKey, null)) return;
                subir(meta?.['visual-num-muestra']);
            });
            try {
                const queue = cargarColaSync();
                queue.forEach((reg) => {
                    const st = String(reg?.estado || '');
                    if (st !== 'pendiente' && st !== 'bloqueado') return;
                    subir(reg?.num_muestra);
                });
            } catch (_) { /* ignore */ }
            // Con planilla sincronizada NO usar mapa local de “usados”:
            // ahí quedaban N° fantasma y el siguiente saltaba (053 → 058).
            // Offline / sin sync: solo cuentan reservas reales (pendiente/bloqueado).
            const confiarSoloPlanilla = numMuestraSincronizadoServidor && navigator.onLine && !!API_URL;
            if (!confiarSoloPlanilla) {
                try {
                    const mapUsados = cargarNumMuestraUsadosLocal();
                    Object.keys(mapUsados).forEach((clave) => {
                        const det = mapUsados[clave];
                        const st = String(det?.estado || '').toLowerCase();
                        if (st === 'cancelado') return;
                        if (st !== 'pendiente' && st !== 'bloqueado') return;
                        subir(clave);
                    });
                } catch (_) { /* ignore */ }
            }
            return maxN;
        }

        /** Tras leer planilla: limpia N° locales ya “registrados” (evita inflar el siguiente). */
        function purgarUsadosLocalTrasSyncPlanilla_() {
            if (!numMuestraSincronizadoServidor) return;
            try {
                const map = cargarNumMuestraUsadosLocal();
                let changed = false;
                Object.keys(map).forEach((clave) => {
                    const st = String(map[clave]?.estado || '').toLowerCase();
                    if (st === 'registrado' || st === 'subido' || st === 'cancelado') {
                        delete map[clave];
                        changed = true;
                    }
                });
                if (changed) {
                    guardarNumMuestraUsadosLocal(map);
                    logNumMuestra('purgarUsadosLocalTrasSyncPlanilla_', { quedan: Object.keys(map).length });
                }
            } catch (_) { /* ignore */ }
        }

        function numMuestraDuplicadoEnMeta(ensayo, mn) {
            if (!mn) return false;
            return Object.keys(metaPorEnsayo).some((k) => {
                if (k === ensayo) return false;
                if (!metaEnsayoCuentaParaCalculoNumMuestra(k, ensayo)) return false;
                return parseNumMuestraSoloDigitos(metaPorEnsayo[k]?.['visual-num-muestra']) === mn;
            });
        }

        function calcularSiguienteNumMuestraParaEnsayo(ensayoActual) {
            return calcularNumMuestraDesdeServidorParaEnsayo(ensayoActual);
        }

        function calcularSiguienteNumMuestraTexto(ensayoActual) {
            return calcularNumMuestraDesdeServidorParaEnsayo(ensayoActual || null);
        }

        function numMuestraEstaFijado(ensayo) {
            if (ensayoEstaRegistradoHoy(ensayo)) return true;
            const mn = parseNumMuestraSoloDigitos(metaPorEnsayo[ensayo]?.['visual-num-muestra']);
            const esperado = parseNumMuestraSoloDigitos(calcularNumMuestraDesdeServidorParaEnsayo(ensayo));
            return mn > 0 && mn === esperado;
        }

        function necesitaReasignarNumMuestra(ensayo, mn) {
            if (ensayoEstaRegistradoHoy(ensayo)) return false;
            if (envioRegistroEnCurso && numerosMuestraFijadosSesion[String(ensayo || '').trim()]) return false;
            const esperadoSeq = parseNumMuestraSoloDigitos(calcularNumMuestraBaseDesdeContexto(ensayo));
            const actualSeq = parseNumMuestraSoloDigitos(mn);
            if (!actualSeq) return true;
            return actualSeq !== esperadoSeq;
        }

        async function refrescarMaxNumMuestraDesdeServidor() {
            const ok = await refrescarEstadoServidorOperativo(false);
            if (ok) programarGuardadoMeta();
            return ok;
        }

        function aplicarNumMuestraEnsayo(ensayo, texto, fijar, origen) {
            const e = String(ensayo || 'Ensayo 1').trim() || 'Ensayo 1';
            if (!metaPorEnsayo[e]) {
                metaPorEnsayo[e] = {
                    'visual-meta-muestra': e,
                    'visual-rotulo': e
                };
            }
            const t = normalizarNumMuestraInput(texto);
            const inpAntes = document.getElementById('visual-num-muestra')?.value;
            delete metaPorEnsayo[e]['visual-num-muestra'];
            delete metaPorEnsayo[e]._num_muestra_fijo;
            // Solo "congelar" al fijar=true (p. ej. precongelar envío). fijar=false = pantalla desde planilla.
            if (fijar === true && t && !ensayoEstaRegistradoHoy(e)) {
                numerosMuestraFijadosSesion[e] = t;
            } else if (fijar === false) {
                delete numerosMuestraFijadosSesion[e];
            }
            if (fijar !== false && t) {
                metaPorEnsayo[e]['visual-num-muestra'] = t;
                metaPorEnsayo[e]._num_muestra_fijo = true;
            }
            if (String(metaActivoEnsayo || '').trim() === e) {
                const el = document.getElementById('visual-num-muestra');
                if (el) el.value = t;
                actualizarHintNumMuestraPantalla();
            }
            if (String(inpAntes || '') !== String(t || '')) {
                logNumMuestra('aplicarNumMuestraEnsayo', {
                    origen: origen || '(sin origen)',
                    ensayo: e,
                    valor_antes: inpAntes,
                    valor_nuevo: t,
                    fijar: fijar === true
                });
                // Tiempo real: chips, tarjetas y PDF leen el mismo N°.
                try {
                    actualizarVistaCompacta();
                    renderizarTarjetas();
                } catch (_) { /* ignore */ }
            }
        }

        function asegurarNumMuestraAsignadoSiVacio(ensayo) {
            const e = String(ensayo || metaActivoEnsayo || 'Ensayo 1').trim() || 'Ensayo 1';
            if (!metaPorEnsayo[e]) {
                metaPorEnsayo[e] = { 'visual-meta-muestra': e, 'visual-rotulo': e };
            }
            const actual = String(metaPorEnsayo[e]['visual-num-muestra'] || '').trim()
                || String(leerNumMuestraDesdePantalla(e) || '').trim();
            if (actual) return;
            if (navigator.onLine && API_URL) {
                if (!numMuestraSincronizadoServidor) return;
                if (ensayoEstaRegistradoHoy(e)) {
                    const numLote = calcularNumMuestraLoteAdicionalEnsayoRegistrado_(e);
                    if (numLote) aplicarNumMuestraEnsayo(e, numLote, true, 'loteAdicionalRegistrado');
                    return;
                }
                aplicarNumeroMuestraDesdePlanilla(e);
                return;
            }
            const num = ensayoEstaRegistradoHoy(e)
                ? calcularNumMuestraLoteAdicionalEnsayoRegistrado_(e)
                : calcularNumMuestraDesdeServidorParaEnsayo(e);
            if (!num) return;
            aplicarNumMuestraEnsayo(e, num, true);
        }

        function reaplicarNumMuestraARegistroPendiente(reg) {
            const ensayoReb = String(reg?.ensayo || 'Ensayo 1');
            const limpio = normalizarNumMuestraInput(calcularNumMuestraDesdeServidorParaEnsayo(ensayoReb));
            reg.num_muestra = limpio;
            aplicarNumMuestraEnsayo(ensayoReb, limpio, true);
            if (Array.isArray(reg.rows)) {
                reg.rows.forEach((row) => {
                    if (row && row.length > 2) row[2] = limpio;
                });
            }
            reg.uid = uidLocal();
        }

        async function reboteNumMuestraRegistroPendienteSiAplica(reg) {
            const rebotes = Number(reg._num_muestra_rebotes || 0);
            if (rebotes >= 12) return false;
            await refrescarEstadoServidorOperativo(true);
            reg._num_muestra_rebotes = rebotes + 1;
            reaplicarNumMuestraARegistroPendiente(reg);
            reg.estado = 'pendiente';
            reg.error = '';
            reg.actualizado_en = Date.now();
            return true;
        }

        async function avisarNumMuestraDuplicadoConDetalle(detalle, origen) {
            const nm = String(detalle?.num_muestra || '').trim();
            const fecha = String(detalle?.fecha || '').trim();
            const ensayo = String(detalle?.ensayo_numero || '').trim();
            const donde = fecha
                ? `Ya existe en fecha ${fecha}${ensayo ? ` · Ensayo ${ensayo}` : ''}.`
                : 'Ya existe un registro con ese código.';
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireSafe({
                    icon: 'warning',
                    title: 'Código ya registrado',
                    html: `
                        <div style="text-align:left;line-height:1.4;">
                            <div><b>N° muestra:</b> ${nm || '(sin código)'}</div>
                            <div style="margin-top:6px;">${donde}</div>
                            <div style="margin-top:10px;color:#64748b;font-size:12px;">
                                ${origen || 'No se puede registrar duplicado. El N° muestra es automático; reintenta o revisa conexión.'}
                            </div>
                        </div>
                    `,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#1f4f82',
                    allowOutsideClick: false
                });
            } else {
                alert(`Código ya registrado (${nm || '--'}). ${donde}`);
            }
            if (origen) console.warn('[NUM_MUESTRA]', origen);
            establecerAcordeonMetaAbierto(true);
        }

        function cargarNumMuestraUsadosLocal() {
            try {
                const raw = localStorage.getItem(NUM_MUESTRA_USADOS_KEY);
                if (!raw) return {};
                const o = JSON.parse(raw);
                return (o && typeof o === 'object') ? o : {};
            } catch (_) {
                return {};
            }
        }

        function guardarNumMuestraUsadosLocal(map) {
            try {
                localStorage.setItem(NUM_MUESTRA_USADOS_KEY, JSON.stringify(map && typeof map === 'object' ? map : {}));
            } catch (_) { /* ignore */ }
        }

        function registrarNumMuestraUsadoLocal(numMuestra, detalle) {
            const nm = normalizarNumMuestraClave(numMuestra);
            if (!nm) return;
            const map = cargarNumMuestraUsadosLocal();
            map[nm] = {
                num_muestra: nm,
                fecha: String(detalle?.fecha || hoyIsoLocal()),
                ensayo_numero: String(detalle?.ensayo_numero || ''),
                estado: String(detalle?.estado || 'registrado')
            };
            guardarNumMuestraUsadosLocal(map);
        }

        function buscarNumMuestraUsadoLocal(numMuestra) {
            const nm = normalizarNumMuestraClave(numMuestra);
            if (!nm) return null;
            const map = cargarNumMuestraUsadosLocal();
            return map[nm] || null;
        }

        function quitarNumMuestraUsadoLocal(numMuestra) {
            const nm = normalizarNumMuestraClave(numMuestra);
            if (!nm) return;
            const map = cargarNumMuestraUsadosLocal();
            if (!Object.prototype.hasOwnProperty.call(map, nm)) return;
            delete map[nm];
            guardarNumMuestraUsadosLocal(map);
        }

        function sleepMs(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }

        function logSync(msg, data) {
            try {
                const ts = new Date().toISOString();
                if (data === undefined) console.log(`[SYNC ${ts}] ${msg}`);
                else console.log(`[SYNC ${ts}] ${msg}`, data);
            } catch (_) { /* ignore */ }
        }

        function formatearTimestampCampo_(ms) {
            try {
                const d = new Date(Number(ms) || Date.now());
                const dd = String(d.getDate()).padStart(2, '0');
                const MM = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const ss = String(d.getSeconds()).padStart(2, '0');
                return `${dd}/${MM}/${yyyy}, ${hh}:${mm}:${ss}`;
            } catch (_) {
                return '';
            }
        }

        function stampNumMuestraEnFilasRegistro_(rows, numsPorEnsayo) {
            if (!Array.isArray(rows) || !rows.length) {
                return { ok: false, error: 'Sin filas para enviar.' };
            }
            const mapa = numsPorEnsayo && typeof numsPorEnsayo === 'object' ? numsPorEnsayo : null;
            let faltante = '';
            rows.forEach((row) => {
                if (!row || row.length < 3 || faltante) return;
                const ensayoNombre = String(row[1] || '').trim()
                    || ensayoNombreDesdeNumero(String(row[14] || '').trim());
                let num = mapa ? String(mapa[ensayoNombre] || '').trim() : '';
                if (!num && ensayoNombre) num = String(leerNumMuestraDesdePantalla(ensayoNombre) || '').trim();
                if (!num) {
                    faltante = ensayoNombre || ('ensayo ' + String(row[14] || ''));
                    return;
                }
                row[2] = num;
            });
            if (faltante) {
                return {
                    ok: false,
                    error: 'Falta N° muestra para ' + faltante + '. Espera la numeración o reconecta.'
                };
            }
            return { ok: true };
        }

        function validarYStampNumMuestraEnPayload_(payload) {
            if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
                return { ok: false, error: 'Sin filas para enviar.' };
            }
            const ensayos = Array.isArray(payload.ensayos_incluidos) && payload.ensayos_incluidos.length
                ? payload.ensayos_incluidos
                : [String(payload.ensayo || obtenerEnsayoActivo() || 'Ensayo 1')];
            ensayos.forEach((ensayo) => asegurarNumMuestraAsignadoSiVacio(ensayo));
            const nums = payload.nums_por_ensayo && typeof payload.nums_por_ensayo === 'object'
                ? { ...payload.nums_por_ensayo }
                : {};
            ensayos.forEach((ensayo) => {
                const e = String(ensayo || '').trim();
                if (!e) return;
                // Stamp siempre desde cálculo/planilla (o fijado solo si hay envío en curso).
                const num = String(
                    (envioRegistroEnCurso && numerosMuestraFijadosSesion[e])
                    || calcularNumMuestraDesdeServidorParaEnsayo(e)
                    || leerNumMuestraDesdePantalla(e)
                    || ''
                ).trim();
                if (num) nums[e] = num;
            });
            const stamp = stampNumMuestraEnFilasRegistro_(payload.rows, nums);
            if (!stamp.ok) return stamp;
            const primero = ensayos[0];
            payload.nums_por_ensayo = nums;
            payload.num_muestra = String(nums[primero] || payload.num_muestra || '').trim();
            return { ok: true, num_muestra: payload.num_muestra };
        }

        function resumenFilasParaLog_(rows) {
            const arr = Array.isArray(rows) ? rows : [];
            const esAcopio = esModoRegistroAcopio_();
            const idxHum = esAcopio ? 36 : 34;
            return arr.map((r, i) => ({
                i,
                fecha: String(r?.[0] || ''),
                ensayo: String(r?.[14] || ''),
                num_muestra: String(r?.[2] || ''),
                n_clamshell: Number(r?.[15] || 0),
                n_jarra: Number(r?.[16] || 0),
                pesos: esAcopio ? {
                    p1: Number(r?.[17] || 0),
                    p2: Number(r?.[18] || 0),
                    p3: Number(r?.[19] || 0),
                    p4: Number(r?.[20] || 0),
                    p5: Number(r?.[21] || 0)
                } : {
                    p1: Number(r?.[17] || 0),
                    p2: Number(r?.[18] || 0),
                    llegada_acopio: Number(r?.[19] || 0),
                    despacho_acopio: Number(r?.[20] || 0)
                },
                temperatura: {
                    inicio_amb: String(r?.[22] || ''),
                    inicio_pulpa: String(r?.[23] || ''),
                    termino_amb: String(r?.[24] || ''),
                    termino_pulpa: String(r?.[25] || ''),
                    llegada_amb: String(r?.[26] || ''),
                    llegada_pulpa: String(r?.[27] || ''),
                    despacho_amb: String(r?.[28] || ''),
                    despacho_pulpa: String(r?.[29] || '')
                },
                humedad: {
                    inicio: String(r?.[idxHum] || ''),
                    termino: String(r?.[idxHum + 1] || ''),
                    llegada: String(r?.[idxHum + 2] || ''),
                    despacho: String(r?.[idxHum + 3] || '')
                }
            }));
        }

        function numMuestraPdfDesdeRegistro_(payload, ensayo, extras) {
            extras = extras || {};
            const ens = String(ensayo || payload?.ensayo || '').trim();
            const desdeMapa = String(extras.nums_por_ensayo?.[ens] || '').trim();
            if (desdeMapa) return desdeMapa.toUpperCase();
            const desdeExtras = String(extras.num_muestra || '').trim();
            if (desdeExtras) return desdeExtras.toUpperCase();
            const desdePayload = String(payload?.num_muestra || '').trim();
            if (desdePayload) return desdePayload.toUpperCase();
            const rows = Array.isArray(payload?.rows) ? payload.rows : [];
            const ensNum = String(payload?.ensayo_numero || numeroDesdeEnsayoTexto(ens) || '').trim();
            const row = rows.find((r) => {
                const nom = String(r?.[1] || '').trim();
                const numEn = String(r?.[14] || '').trim();
                if (ens && nom === ens) return true;
                if (ensNum && numEn === ensNum) return true;
                return false;
            });
            const desdeFila = row ? String(row[2] || '').trim() : '';
            if (desdeFila) return desdeFila.toUpperCase();
            return String(leerNumMuestraDesdePantalla(ens) || '').trim().toUpperCase();
        }

        async function guardarPdfCampoHistorialTrasEnvio_(ensayosOrdenados, fechaIso, extras) {
            extras = extras || {};
            if (!window.HistPdfEnvio || typeof window.HistPdfEnvio.guardarCampo !== 'function') return false;
            const lista = (Array.isArray(ensayosOrdenados) ? ensayosOrdenados : [ensayosOrdenados])
                .map((e) => String(e || '').trim())
                .filter(Boolean);
            if (!lista.length) return false;
            const numsPorEnsayo = {};
            const rowsPayload = extras.payload?.rows;
            lista.forEach((ensayo) => {
                const desdeFilas = window.HistPdfEnvio?.numMuestraDesdeFilasPost_
                    ? window.HistPdfEnvio.numMuestraDesdeFilasPost_(ensayo, rowsPayload)
                    : '';
                numsPorEnsayo[ensayo] = desdeFilas
                    || numMuestraPdfDesdeRegistro_(extras.payload, ensayo, extras)
                    || String(extras.nums_por_ensayo?.[ensayo] || '').trim().toUpperCase();
            });
            let datosSnapshot = extras.datos || null;
            if (!datosSnapshot?.muestras?.length && typeof window.obtenerDatosPdfCampoParaEnsayos === 'function') {
                snapshotMetaEnsayoActual();
                datosSnapshot = window.obtenerDatosPdfCampoParaEnsayos(lista);
            }
            try {
                const ok = await window.HistPdfEnvio.guardarCampo(lista, fechaIso, {
                    numsPorEnsayo,
                    num_muestra: numMuestraPdfDesdeRegistro_(extras.payload, lista[0], extras),
                    datos: datosSnapshot,
                    payload: extras.payload,
                    payloadRows: rowsPayload,
                    modo_registro: extras.payload?.modo_registro || modoRegistroPostBody_()
                });
                if (!ok) {
                    console.warn('[HistPDF] PDF campo no guardado', { ensayos: lista, fechaIso, numsPorEnsayo });
                }
                return !!ok;
            } catch (err) {
                console.warn('[HistPDF] No se pudo guardar PDF campo:', err);
                return false;
            }
        }

        async function asegurarPdfCampoHistorialTrasEnvio_(ensayosOrdenados, fechaIso, extras) {
            const ok = await guardarPdfCampoHistorialTrasEnvio_(ensayosOrdenados, fechaIso, extras);
            if (ok) return true;
            return guardarPdfCampoHistorialTrasEnvio_(ensayosOrdenados, fechaIso, extras);
        }

        async function enviarRegistroCampoDirecto_(ensayoObjetivo) {
            const payload = construirPayloadRegistroActual(ensayoObjetivo);
            const valNum = validarYStampNumMuestraEnPayload_(payload);
            if (!valNum.ok) {
                mostrarToast('warning', 'N° muestra', valNum.error || 'No se pudo asignar N° muestra.');
                return { ok: false, estado: 'sin_num_muestra' };
            }
            if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
                mostrarAlertaRegla('Sin filas para enviar', 'Agrega al menos un clamshell para generar datos.');
                return { ok: false, estado: 'sin_filas' };
            }
            const body = {
                uid: payload.uid,
                modo_registro: payload.modo_registro || modoRegistroPostBody_(),
                rows: payload.rows
            };

            console.log(`[SYNC] Enviando a la nube: ${body.rows.length} filas. uid: ${body.uid}`);
            console.log('[SYNC] Resumen por fila:', resumenFilasParaLog_(body.rows));

            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            snapshotMetaEnsayoActual();
            const ensayoPdf = String(ensayoObjetivo || payload.ensayo || ('Ensayo ' + payload.ensayo_numero));
            const datosPdfEnvio = typeof window.obtenerDatosPdfCampoParaEnsayos === 'function'
                ? window.obtenerDatosPdfCampoParaEnsayos([ensayoPdf])
                : null;
            const pdfOk = await asegurarPdfCampoHistorialTrasEnvio_(
                [ensayoPdf],
                payload.fecha,
                { num_muestra: payload.num_muestra, datos: datosPdfEnvio, payload }
            );

            const regConfirm = {
                uid: payload.uid,
                num_muestra: payload.num_muestra,
                fecha: payload.fecha,
                ensayo_numero: payload.ensayo_numero
            };
            let confirmacion = await confirmarRegistroServidorConReintentos(regConfirm);
            if (confirmacion?.estado === 'pendiente') {
                await sleepMs(900);
                confirmacion = await confirmarRegistroServidorConReintentos(regConfirm);
            }
            if (confirmacion?.estado === 'pendiente') {
                await sleepMs(1400);
                confirmacion = await confirmarRegistroServidorConReintentos(regConfirm);
            }
            if (confirmacion?.estado === 'confirmado') {
                registrarNumMuestraUsadoLocal(payload.num_muestra, {
                    fecha: payload.fecha,
                    ensayo_numero: payload.ensayo_numero,
                    estado: 'registrado'
                });
                archivarEnvioLocalExitoso_({
                    uid: payload.uid,
                    fecha: payload.fecha,
                    ensayo_numero: payload.ensayo_numero,
                    num_muestra: payload.num_muestra,
                    ensayo: ensayoPdf,
                    modo_registro: payload.modo_registro
                });
                return { ok: true, estado: 'confirmado', payload, confirmacion, pdfOk };
            }
            if (confirmacion?.estado === 'duplicado_codigo') {
                return { ok: false, estado: 'duplicado_codigo', payload, confirmacion, pdfOk };
            }
            return { ok: false, estado: 'pendiente', payload, confirmacion, pdfOk };
        }

        async function confirmarRegistroServidorConReintentos(reg) {
            // Confirmación inmediata (sin bucle largo) para evitar "intentos" cuando el código ya existe.
            // 1) UID confirmado => se guardó este envío.
            if (reg.uid) {
                const uidExiste = await existeUidServidor(reg.uid);
                if (uidExiste === true) return { estado: 'confirmado' };
            }
            // 2) Si el código ya existe en servidor => duplicado, se debe cambiar N° muestra.
            if (reg.num_muestra) {
                const numInfo = await existeNumMuestraServidor(reg.num_muestra);
                if (numInfo && numInfo.existe === true) return { estado: 'duplicado_codigo', detalle: numInfo };
            }
            return { estado: 'pendiente' };
        }

        async function confirmarNumMuestraUnicoAntesDeGuardar(ensayoObjetivo) {
            const ensayo = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1');
            const yaFijado = !!numerosMuestraFijadosSesion[ensayo];
            if (!yaFijado) {
                if (navigator.onLine && API_URL) {
                    await refrescarEstadoServidorOperativo(true);
                } else {
                    refrescarEstadoOperativoLocal();
                }
                asegurarNumMuestraAsignadoSiVacio(ensayo);
                aplicarNumMuestraParaEnsayoActivo('preConfirmarEnvio');
            }
            snapshotMetaEnsayoActual();
            const numMuestra = String(leerNumMuestraDesdePantalla(ensayo) || '').trim();
            if (!numMuestra) {
                mostrarToast('warning', 'N° muestra', 'Espera un momento o reconecta; el número se asigna solo.');
                return false;
            }
            if (yaFijado && navigator.onLine) {
                return true;
            }
            // Sin internet: validar contra reservas locales (cola + historial del día).
            if (!navigator.onLine) {
                const nmKeyOff = normalizarNumMuestraClave(numMuestra);
                const mnOff = parseNumMuestraSoloDigitos(numMuestra);
                if (numMuestraDuplicadoEnMeta(ensayo, mnOff)) {
                    mostrarToast('warning', 'N° muestra', 'Ese código ya está en otra muestra de este formulario.');
                    return false;
                }
                if (numMuestraReservadoEnColaLocal(nmKeyOff, ensayo)) {
                    mostrarToast('warning', 'N° muestra', 'Ese código ya está en cola para otra muestra.');
                    return false;
                }
                const usadoOff = buscarNumMuestraUsadoLocal(nmKeyOff);
                if (usadoOff) {
                    const esNuestro = cargarColaSync().some((reg) => {
                        const st = String(reg?.estado || '');
                        if (st !== 'pendiente' && st !== 'bloqueado') return false;
                        return normalizarNumMuestraClave(reg?.num_muestra || '') === nmKeyOff
                            && String(reg?.ensayo || '') === ensayo;
                    });
                    if (!esNuestro) {
                        mostrarToast('warning', 'N° muestra', 'Ese código ya está reservado localmente.');
                        return false;
                    }
                }
                return true;
            }
            const existeInfo = await existeNumMuestraServidor(numMuestra);
            if (existeInfo === null) {
                // Si falla la consulta previa, no bloquear el envío.
                // La validación definitiva se hace en doPost (servidor).
                return true;
            }
            if (existeInfo.existe !== true) return true;
            await refrescarEstadoServidorOperativo(true);
            fusionarMaxNumMuestraCampo(numMuestra);
            if (metaPorEnsayo[ensayo]) delete metaPorEnsayo[ensayo]._num_muestra_fijo;
            const nuevo = calcularSiguienteNumMuestraParaEnsayo(ensayo);
            aplicarNumMuestraEnsayo(ensayo, nuevo, true);
            snapshotMetaEnsayoActual();
            programarGuardadoMeta();
            actualizarVistaCompacta();
            actualizarProgresoMeta();
            mostrarToast('info', 'N° muestra actualizado', `Se usará ${nuevo} (el anterior ya estaba registrado).`);
            const okSegundo = await existeNumMuestraServidor(nuevo);
            if (okSegundo && okSegundo.existe === true) {
                await avisarNumMuestraDuplicadoConDetalle(okSegundo, 'Sigue habiendo conflicto; espera unos segundos y vuelve a enviar.');
                return false;
            }
            return true;
        }

        async function confirmarEnsayoNoRegistradoAntesDeGuardar() {
            const ensayo = obtenerEnsayoActivo();
            const ensayoNumero = numeroDesdeEnsayoTexto(ensayo);
            const fecha = hoyIsoLocal();
            if (!ensayoNumero) return true;
            if (!navigator.onLine) return true;
            const existe = await existeRegistroServidor(fecha, ensayoNumero);
            if (existe !== true) return true;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFireSafe({
                    icon: 'warning',
                    title: 'Ensayo ya registrado',
                    text: `El ${ensayo} ya tiene registro en fecha ${fecha}. Cambia "Muestra" para continuar.`,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#1f4f82'
                });
            } else {
                alert(`El ${ensayo} ya tiene registro en fecha ${fecha}. Cambia "Muestra" para continuar.`);
            }
            establecerAcordeonMetaAbierto(true);
            const sel = document.getElementById('visual-meta-muestra');
            if (sel) sel.focus();
            return false;
        }

        function pendingsSyncCount() {
            return cargarColaSync().filter((x) => String(x?.estado || 'pendiente') === 'pendiente').length;
        }

        function resumenEstadosSync() {
            const queue = cargarColaSync();
            const out = { pendiente: 0, subido: 0, bloqueado: 0, duplicado: 0, cancelado: 0, otros: 0 };
            queue.forEach((q) => {
                const s = String(q?.estado || '').toLowerCase();
                if (s === 'pendiente') out.pendiente++;
                else if (s === 'subido') out.subido++;
                else if (s === 'bloqueado') out.bloqueado++;
                else if (s === 'duplicado') out.duplicado++;
                else if (s === 'cancelado') out.cancelado++;
                else out.otros++;
            });
            return out;
        }

        function construirPayloadRegistroActual(ensayoObjetivo) {
            const ensayo = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1');
            const ensayoNumero = numeroDesdeEnsayoTexto(ensayo);
            const rows = construirRowsRegistroBasePorEnsayo(ensayo);
            const fecha = rows[0]?.[0] || hoyIsoLocal();
            const numMuestra = String(leerNumMuestraDesdePantalla(ensayo) || '').trim();
            return {
                uid: uidLocal(),
                ensayo,
                ensayo_numero: ensayoNumero,
                fecha,
                num_muestra: numMuestra,
                modo_registro: modoRegistroPostBody_(),
                rows
            };
        }

        /** Un solo POST con todas las muestras completas (8 filas × N muestras). */
        function construirPayloadRegistroVariosEnsayos(ensayosOrdenados) {
            const lista = ordenarEnsayosPorNumeroMuestra(ensayosOrdenados);
            const uid = uidLocal();
            const allRows = [];
            const numsPorEnsayo = {};
            lista.forEach((ensayo) => {
                const rows = construirRowsRegistroBasePorEnsayo(ensayo);
                numsPorEnsayo[ensayo] = String(leerNumMuestraDesdePantalla(ensayo) || '').trim();
                rows.forEach((r) => allRows.push(r));
            });
            const ultimo = lista[lista.length - 1] || 'Ensayo 1';
            const primero = lista[0] || ultimo;
            return {
                uid,
                ensayo: ultimo,
                ensayo_numero: numeroDesdeEnsayoTexto(ultimo),
                fecha: allRows[0]?.[0] || hoyIsoLocal(),
                num_muestra: numsPorEnsayo[primero] || '',
                ensayos_incluidos: lista,
                nums_por_ensayo: numsPorEnsayo,
                modo_registro: modoRegistroPostBody_(),
                rows: allRows
            };
        }

        async function enviarRegistrosCampoConjunto_(ensayosOrdenados) {
            const lista = ordenarEnsayosPorNumeroMuestra(ensayosOrdenados);
            const payload = construirPayloadRegistroVariosEnsayos(lista);
            const valNum = validarYStampNumMuestraEnPayload_(payload);
            if (!valNum.ok) {
                mostrarToast('warning', 'N° muestra', valNum.error || 'No se pudo asignar N° muestra.');
                return { ok: false, estado: 'sin_num_muestra' };
            }
            if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
                mostrarAlertaRegla('Sin filas para enviar', 'Agrega al menos un clamshell para generar datos.');
                return { ok: false, estado: 'sin_filas' };
            }
            const body = {
                uid: payload.uid,
                modo_registro: payload.modo_registro || modoRegistroPostBody_(),
                rows: payload.rows
            };
            const etiquetas = lista.map((e) => `${mostrarMuestra(e)} N°${payload.nums_por_ensayo?.[e] || '?'}`).join(', ');
            console.log(`[SYNC] Lote conjunto: ${body.rows.length} filas, ${lista.length} muestra(s). uid: ${body.uid}`);
            console.log('[SYNC] Muestras:', etiquetas);
            console.log('[SYNC] Resumen por fila:', resumenFilasParaLog_(body.rows));

            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            snapshotMetaEnsayoActual();
            const datosPdfLote = typeof window.obtenerDatosPdfCampoParaEnsayos === 'function'
                ? window.obtenerDatosPdfCampoParaEnsayos(lista)
                : null;
            const pdfOk = await asegurarPdfCampoHistorialTrasEnvio_(lista, payload.fecha, {
                num_muestra: payload.num_muestra,
                nums_por_ensayo: payload.nums_por_ensayo,
                datos: datosPdfLote,
                payload
            });

            const regConfirm = {
                uid: payload.uid,
                num_muestra: payload.num_muestra,
                fecha: payload.fecha,
                ensayo_numero: payload.ensayo_numero
            };
            let confirmacion = await confirmarRegistroServidorConReintentos(regConfirm);
            if (confirmacion?.estado === 'pendiente') {
                await sleepMs(900);
                confirmacion = await confirmarRegistroServidorConReintentos(regConfirm);
            }
            if (confirmacion?.estado === 'pendiente') {
                await sleepMs(1400);
                confirmacion = await confirmarRegistroServidorConReintentos(regConfirm);
            }
            if (confirmacion?.estado === 'confirmado') {
                lista.forEach((ensayo) => {
                    const num = payload.nums_por_ensayo?.[ensayo] || '';
                    if (num) {
                        registrarNumMuestraUsadoLocal(num, {
                            fecha: payload.fecha,
                            ensayo_numero: numeroDesdeEnsayoTexto(ensayo),
                            estado: 'registrado'
                        });
                        fusionarMaxNumMuestraCampo(num);
                    }
                    marcarEnsayoRegistradoHoyLocal(numeroDesdeEnsayoTexto(ensayo));
                    archivarEnvioLocalExitoso_({
                        uid: payload.uid + '::' + ensayo,
                        fecha: payload.fecha,
                        ensayo_numero: numeroDesdeEnsayoTexto(ensayo),
                        num_muestra: num,
                        ensayo,
                        modo_registro: payload.modo_registro
                    });
                });
                return { ok: true, estado: 'confirmado', payload, confirmacion, enviados: lista.length, pdfOk };
            }
            if (confirmacion?.estado === 'duplicado_codigo') {
                return { ok: false, estado: 'duplicado_codigo', payload, confirmacion, pdfOk };
            }
            return { ok: false, estado: 'pendiente', payload, confirmacion, pdfOk };
        }

        async function encolarRegistroPendiente(ensayoObjetivo, opts) {
            opts = opts || {};
            const bumpIdx = Number(opts.bumpReasignaNum || 0);
            if (!API_URL) {
                mostrarAlertaRegla('Falta API', 'En api-config.js asigna APPS_SCRIPT_API_URL con la URL de tu Web App de Apps Script (o define window.API_URL).');
                return null;
            }
            const ensayo = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1');
            marcarEnsayoEnUsoSesion(ensayo);
            snapshotMetaEnsayoActual();
            if (navigator.onLine && API_URL) {
                await refrescarEstadoServidorOperativo(true);
            } else {
                refrescarEstadoOperativoLocal();
            }
            asegurarNumMuestraAsignadoSiVacio(ensayo);
            snapshotMetaEnsayoActual();
            const payload = construirPayloadRegistroActual(ensayoObjetivo);
            const valNum = validarYStampNumMuestraEnPayload_(payload);
            if (!valNum.ok) {
                mostrarToast('warning', 'N° muestra', valNum.error || 'No se pudo asignar N° muestra.');
                return null;
            }
            logSync('Payload construido para encolar', payload);
            if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
                mostrarAlertaRegla('Sin filas para enviar', 'Agrega al menos un clamshell para generar datos.');
                return null;
            }
            // Validación principal se hace en el POST del servidor.
            const queue = cargarColaSync();
            const nmKey = normalizarNumMuestraClave(payload.num_muestra || '');
            if (nmKey) {
                const localUsado = buscarNumMuestraUsadoLocal(nmKey);
                if (localUsado) {
                    if (navigator.onLine) {
                        const numInfoSrv = await existeNumMuestraServidor(nmKey);
                        if (numInfoSrv && numInfoSrv.existe === true) {
                            if (bumpIdx < 8) {
                                await refrescarEstadoServidorOperativo(true);
                                if (metaPorEnsayo[ensayo]) delete metaPorEnsayo[ensayo]._num_muestra_fijo;
                                const nuevo = calcularSiguienteNumMuestraParaEnsayo(ensayo);
                                aplicarNumMuestraEnsayo(ensayo, nuevo, true);
                                snapshotMetaEnsayoActual();
                                programarGuardadoMeta();
                                actualizarVistaCompacta();
                                actualizarProgresoMeta();
                                mostrarToast('info', 'N° muestra actualizado', `Se usará ${nuevo} (el código ya estaba en la planilla).`);
                                return encolarRegistroPendiente(ensayoObjetivo, { bumpReasignaNum: bumpIdx + 1 });
                            }
                            await avisarNumMuestraDuplicadoConDetalle(numInfoSrv, 'Este código ya fue usado y no se pudo reasignar automáticamente.');
                            return { bloqueadoLocal: true };
                        }
                        quitarNumMuestraUsadoLocal(nmKey);
                    } else {
                        if (bumpIdx < 8) {
                            numMuestraMaxServidorCache = Math.max(numMuestraMaxServidorCache, parseNumMuestraSoloDigitos(nmKey));
                            if (metaPorEnsayo[ensayo]) delete metaPorEnsayo[ensayo]._num_muestra_fijo;
                            const nuevo = calcularSiguienteNumMuestraParaEnsayo(ensayo);
                            aplicarNumMuestraEnsayo(ensayo, nuevo, true);
                            snapshotMetaEnsayoActual();
                            programarGuardadoMeta();
                            actualizarVistaCompacta();
                            actualizarProgresoMeta();
                            mostrarToast('info', 'N° muestra actualizado', `Se usará ${nuevo} (conflicto en historial local).`);
                            return encolarRegistroPendiente(ensayoObjetivo, { bumpReasignaNum: bumpIdx + 1 });
                        }
                        await avisarNumMuestraDuplicadoConDetalle(localUsado, 'Este código figura como usado localmente. Conecta a internet para validar.');
                        return { bloqueadoLocal: true };
                    }
                }
                const colaMismoCodigo = queue.find((q) => {
                    const estado = String(q?.estado || '');
                    if (estado !== 'pendiente' && estado !== 'bloqueado') return false;
                    return normalizarNumMuestraClave(q?.num_muestra || '') === nmKey;
                });
                if (colaMismoCodigo) {
                    if (bumpIdx < 8) {
                        await refrescarEstadoServidorOperativo(true);
                        if (metaPorEnsayo[ensayo]) delete metaPorEnsayo[ensayo]._num_muestra_fijo;
                        const nuevo = calcularSiguienteNumMuestraParaEnsayo(ensayo);
                        aplicarNumMuestraEnsayo(ensayo, nuevo, true);
                        snapshotMetaEnsayoActual();
                        programarGuardadoMeta();
                        actualizarVistaCompacta();
                        actualizarProgresoMeta();
                        mostrarToast('info', 'N° muestra actualizado', `Se usará ${nuevo} (evita duplicado en cola local).`);
                        return encolarRegistroPendiente(ensayoObjetivo, { bumpReasignaNum: bumpIdx + 1 });
                    }
                    await avisarNumMuestraDuplicadoConDetalle({
                        num_muestra: nmKey,
                        fecha: colaMismoCodigo?.fecha || '',
                        ensayo_numero: colaMismoCodigo?.ensayo_numero || ''
                    }, 'Ese código ya está en cola o bloqueado localmente.');
                    return { bloqueadoLocal: true };
                }
            }
            const reg = {
                uid: payload.uid,
                fecha: payload.fecha,
                ensayo_numero: payload.ensayo_numero,
                num_muestra: payload.num_muestra || '',
                ensayo: payload.ensayo,
                modo_registro: payload.modo_registro || modoRegistroPostBody_(),
                rows: payload.rows,
                estado: 'pendiente',
                intentos: 0,
                creado_en: Date.now(),
                actualizado_en: Date.now(),
                error: ''
            };
            queue.push(reg);
            guardarColaSync(queue);
            pushEstadoSync(reg);
            registrarNumMuestraUsadoLocal(reg.num_muestra, {
                fecha: reg.fecha,
                ensayo_numero: reg.ensayo_numero,
                estado: 'pendiente'
            });
            fusionarMaxNumMuestraCampo(reg.num_muestra);
            refrescarBloqueoMuestrasEnTiempoReal(false);
            logSync('Encolado registro pendiente', {
                uid: reg.uid,
                num_muestra: reg.num_muestra,
                ensayo_numero: reg.ensayo_numero,
                filas: Array.isArray(reg.rows) ? reg.rows.length : 0
            });
            logSync('Registro completo encolado', reg);
            snapshotMetaEnsayoActual();
            const ensayoPdf = String(reg.ensayo || ('Ensayo ' + reg.ensayo_numero));
            const datosPdfEncolado = typeof window.obtenerDatosPdfCampoParaEnsayos === 'function'
                ? window.obtenerDatosPdfCampoParaEnsayos([ensayoPdf])
                : null;
            if (datosPdfEncolado?.muestras?.length) reg.pdf_datos = datosPdfEncolado;
            reg.pdf_local_ok = await asegurarPdfCampoHistorialTrasEnvio_(
                [ensayoPdf],
                reg.fecha,
                {
                    num_muestra: reg.num_muestra,
                    datos: datosPdfEncolado,
                    payload: {
                        ensayo: reg.ensayo,
                        ensayo_numero: reg.ensayo_numero,
                        num_muestra: reg.num_muestra,
                        rows: reg.rows
                    }
                }
            );
            return reg;
        }

        let syncEnCurso = false;
        async function sincronizarPendientes() {
            if (syncEnCurso) return;
            if (document.visibilityState === 'hidden') {
                actualizarBarraHeaderEstado();
                return resumenEstadosSync();
            }
            if (!navigator.onLine) {
                actualizarBarraHeaderEstado();
                return resumenEstadosSync();
            }
            if (!API_URL) return;
            const queue = cargarColaSync();
            if (!queue.length) {
                actualizarBarraHeaderEstado();
                return resumenEstadosSync();
            }
            syncEnCurso = true;
            let huboCambios = false;
            let huboSubidaExitosa = false;
            try {
                for (let i = 0; i < queue.length; i++) {
                    const reg = queue[i];
                    if (!reg || String(reg.estado || '') !== 'pendiente') continue;

                    const esPackingCola = String(reg.modo || reg.payload?.mode || '') === 'packing';
                    if (esPackingCola) {
                        const bodyPk = reg.payload;
                        if (!bodyPk || !Array.isArray(bodyPk.packingRows) || !bodyPk.packingRows.length) {
                            reg.estado = 'bloqueado';
                            reg.error = 'Payload packing vacío';
                            reg.actualizado_en = Date.now();
                            huboCambios = true;
                            pushEstadoSync(reg);
                            continue;
                        }
                        reg.intentos = Number(reg.intentos || 0) + 1;
                        reg.actualizado_en = Date.now();
                        try {
                            await fetch(API_URL, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(bodyPk)
                            });
                            reg.estado = 'subido';
                            reg.error = '';
                            pushEstadoSync(reg);
                            queue.splice(i, 1);
                            i--;
                            huboCambios = true;
                            mostrarToast('success', 'Cola packing', 'Packing de muestra ' + (reg.num_muestra || '') + ' enviado.');
                        } catch (errPk) {
                            reg.error = String(errPk?.message || errPk || 'Error POST packing');
                            reg.actualizado_en = Date.now();
                            huboCambios = true;
                            pushEstadoSync(reg);
                        }
                        continue;
                    }

                    // Si el código ya existe en la hoja, reasignar N° muestra automático y reintentar (evita duplicados).
                    if (reg.num_muestra) {
                        const numInfoPre = await existeNumMuestraServidor(reg.num_muestra);
                        if (numInfoPre && numInfoPre.existe === true) {
                            const okRebote = await reboteNumMuestraRegistroPendienteSiAplica(reg);
                            if (okRebote) {
                                huboCambios = true;
                                pushEstadoSync(reg);
                                guardarColaSync(queue);
                                mostrarToast('info', 'N° muestra ajustado', `Se reintentará con ${reg.num_muestra}.`);
                                i--;
                                actualizarBarraHeaderEstado();
                                continue;
                            }
                            reg.estado = 'bloqueado';
                            reg.error = `NUM_MUESTRA ${reg.num_muestra} ya existe y no se pudo reasignar automáticamente.`;
                            reg.actualizado_en = Date.now();
                            huboCambios = true;
                            pushEstadoSync(reg);
                            registrarNumMuestraUsadoLocal(reg.num_muestra, {
                                fecha: String(numInfoPre?.fecha || reg.fecha || ''),
                                ensayo_numero: String(numInfoPre?.ensayo_numero || reg.ensayo_numero || ''),
                                estado: 'bloqueado'
                            });
                            await avisarNumMuestraDuplicadoConDetalle(
                                {
                                    num_muestra: String(numInfoPre?.num_muestra || reg.num_muestra || ''),
                                    fecha: String(numInfoPre?.fecha || reg.fecha || ''),
                                    ensayo_numero: String(numInfoPre?.ensayo_numero || reg.ensayo_numero || '')
                                },
                                'Ese N° muestra ya existe. Revisa conexión o contacta soporte si se repite.'
                            );
                            queue.splice(i, 1);
                            i--;
                            guardarColaSync(queue);
                            actualizarBarraHeaderEstado();
                            continue;
                        }
                    }

                    reg.intentos = Number(reg.intentos || 0) + 1;
                    reg.actualizado_en = Date.now();
                    let postResp = null;
                    try {
                        const payloadReplay = {
                            ensayo: reg.ensayo,
                            ensayo_numero: reg.ensayo_numero,
                            ensayos_incluidos: reg.ensayos_incluidos,
                            nums_por_ensayo: reg.nums_por_ensayo,
                            rows: reg.rows,
                            num_muestra: reg.num_muestra
                        };
                        const valNumCola = validarYStampNumMuestraEnPayload_(payloadReplay);
                        if (!valNumCola.ok) {
                            reg.estado = 'bloqueado';
                            reg.error = valNumCola.error || 'NUM_MUESTRA vacío en cola';
                            reg.actualizado_en = Date.now();
                            huboCambios = true;
                            pushEstadoSync(reg);
                            mostrarToast('warning', 'Cola bloqueada', reg.error);
                            continue;
                        }
                        reg.num_muestra = payloadReplay.num_muestra;
                        reg.rows = payloadReplay.rows;
                        reg.nums_por_ensayo = payloadReplay.nums_por_ensayo;
                        guardarColaSync(queue);

                        const body = {
                            uid: reg.uid,
                            modo_registro: reg.modo_registro || 'visual',
                            timestamp: formatearTimestampCampo_(reg.creado_en || reg.actualizado_en || Date.now()),
                            status: String(reg.estado || 'pendiente'),
                            rows: reg.rows
                        };
                        logSync('Enviando POST a servidor (no-cors)', {
                            uid: reg.uid,
                            intento: reg.intentos,
                            num_muestra: reg.num_muestra,
                            ensayo_numero: reg.ensayo_numero,
                            filas: Array.isArray(reg.rows) ? reg.rows.length : 0
                        });
                        logSync('Body POST completo', body);
                        console.log('[POST CAMPO JSON.stringify]', JSON.stringify(body));
                        // Apps Script Web App no expone CORS en muchos despliegues.
                        // Se envía en modo no-cors y luego se confirma por UID/NUM_MUESTRA vía JSONP.
                        await fetch(API_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        const confirmacion = await confirmarRegistroServidorConReintentos(reg);
                        logSync('Confirmación servidor (detalle completo)', confirmacion);
                        if (confirmacion?.estado === 'confirmado') {
                            postResp = { ok: true, confirmacion_uid: true };
                        } else if (confirmacion?.estado === 'duplicado_codigo') {
                            postResp = {
                                ok: false,
                                code: 'DUPLICATE_NUM_MUESTRA',
                                error: 'NUM_MUESTRA ya existe',
                                num_muestra: String(confirmacion?.detalle?.num_muestra || reg.num_muestra || ''),
                                fecha: String(confirmacion?.detalle?.fecha || reg.fecha || ''),
                                ensayo_numero: String(confirmacion?.detalle?.ensayo_numero || reg.ensayo_numero || '')
                            };
                        } else {
                            postResp = {
                                ok: false,
                                error: 'POST enviado (no-cors) pero sin confirmación del servidor todavía.'
                            };
                        }
                        logSync('Resultado post-confirmación (no-cors)', { uid: reg.uid, intento: reg.intentos, postResp });
                        logSync('Respuesta interna completa del flujo POST', { reg, body, confirmacion, postResp });
                    } catch (e) {
                        reg.error = String(e?.message || e || 'Error POST');
                        reg.actualizado_en = Date.now();
                        huboCambios = true;
                        logSync('Error en POST (no-cors)', { uid: reg.uid, error: reg.error });
                        reg.estado = 'pendiente';
                        pushEstadoSync(reg);
                        continue;
                    }

                    const okServidor = !!(postResp && postResp.ok === true);
                    const errorServidor = String(postResp?.error || '').toLowerCase();
                    const esDuplicadoServidor = !!(postResp && (postResp.duplicate === true || postResp.code === 'DUPLICATE_NUM_MUESTRA'))
                        || errorServidor.includes('num_muestra')
                        || errorServidor.includes('no se puede registrar dos veces')
                        || errorServidor.includes('clave duplicada');

                    if (okServidor) {
                        reg.estado = 'subido';
                        reg.error = '';
                        reg.actualizado_en = Date.now();
                        huboCambios = true;
                        pushEstadoSync(reg);
                        const moduloPdf = String(reg.modo_registro || '').toLowerCase() === 'acopio' ? 'acopio' : 'campo';
                        let yaHayPdf = false;
                        if (window.HistPdfStore && typeof window.HistPdfStore.existe === 'function') {
                            yaHayPdf = await window.HistPdfStore.existe(reg.fecha, reg.ensayo_numero, reg.num_muestra, moduloPdf);
                        }
                        if (!yaHayPdf) {
                            const ensayoPdf = String(reg.ensayo || ('Ensayo ' + reg.ensayo_numero));
                            const numPdf = window.HistPdfEnvio?.numMuestraDesdeFilasPost_
                                ? (window.HistPdfEnvio.numMuestraDesdeFilasPost_(ensayoPdf, reg.rows)
                                    || String(reg.num_muestra || '').trim().toUpperCase())
                                : String(reg.num_muestra || '').trim().toUpperCase();
                            await asegurarPdfCampoHistorialTrasEnvio_(
                                [ensayoPdf],
                                reg.fecha,
                                {
                                    num_muestra: numPdf,
                                    nums_por_ensayo: { [ensayoPdf]: numPdf },
                                    datos: reg.pdf_datos || null,
                                    payload: {
                                        ensayo: reg.ensayo,
                                        ensayo_numero: reg.ensayo_numero,
                                        num_muestra: numPdf,
                                        modo_registro: reg.modo_registro,
                                        rows: reg.rows
                                    }
                                }
                            );
                        }
                        logSync('Servidor confirmó registro', {
                            uid: reg.uid,
                            num_muestra: reg.num_muestra,
                            ensayo_numero: reg.ensayo_numero
                        });
                        registrarNumMuestraUsadoLocal(reg.num_muestra, {
                            fecha: reg.fecha,
                            ensayo_numero: reg.ensayo_numero,
                            estado: 'registrado'
                        });
                        mostrarToast('success', 'Servidor confirmó', `Registro ${reg.num_muestra || reg.uid} guardado correctamente.`);
                        queue.splice(i, 1);
                        i--;
                        guardarColaSync(queue);
                        actualizarBarraHeaderEstado();
                        marcarEnsayoRegistradoHoyLocal(reg.ensayo_numero);
                        huboSubidaExitosa = true;
                        continue;
                    }
                    if (esDuplicadoServidor) {
                        const okReboteDup = await reboteNumMuestraRegistroPendienteSiAplica(reg);
                        if (okReboteDup) {
                            huboCambios = true;
                            pushEstadoSync(reg);
                            guardarColaSync(queue);
                            mostrarToast('info', 'N° muestra ajustado', `Se reintentará con ${reg.num_muestra}.`);
                            i--;
                            actualizarBarraHeaderEstado();
                            logSync('Reasignación NUM_MUESTRA tras duplicado en confirmación', { uid: reg.uid, num_muestra: reg.num_muestra });
                            continue;
                        }
                        reg.estado = 'bloqueado';
                        reg.error = postResp?.error
                            ? String(postResp.error)
                            : `Ya existe registro con código ${reg.num_muestra}.`;
                        reg.actualizado_en = Date.now();
                        huboCambios = true;
                        pushEstadoSync(reg);
                        logSync('Bloqueado post-confirmación por NUM_MUESTRA duplicado', {
                            uid: reg.uid,
                            num_muestra: reg.num_muestra
                        });
                        registrarNumMuestraUsadoLocal(reg.num_muestra, {
                            fecha: String(postResp?.fecha || reg.fecha || ''),
                            ensayo_numero: String(postResp?.ensayo_numero || reg.ensayo_numero || ''),
                            estado: 'bloqueado'
                        });
                        await avisarNumMuestraDuplicadoConDetalle(
                            {
                                num_muestra: String(postResp?.num_muestra || reg.num_muestra || ''),
                                fecha: String(postResp?.fecha || reg.fecha || ''),
                                ensayo_numero: String(postResp?.ensayo_numero || reg.ensayo_numero || '')
                            },
                            'Ya existe ese N° muestra. Revisa conexión o contacta soporte si se repite.'
                        );
                        queue.splice(i, 1);
                        i--;
                        guardarColaSync(queue);
                        actualizarBarraHeaderEstado();
                        continue;
                    }

                    // Sin confirmación clara: antes de dejar pendiente, verificar de nuevo duplicado por código.
                    let bloqueoPorCodigo = false;
                    if (reg.num_muestra) {
                        const numInfoPost = await existeNumMuestraServidor(reg.num_muestra);
                        if (numInfoPost && numInfoPost.existe === true) {
                            const okRebotePost = await reboteNumMuestraRegistroPendienteSiAplica(reg);
                            if (okRebotePost) {
                                huboCambios = true;
                                pushEstadoSync(reg);
                                guardarColaSync(queue);
                                mostrarToast('info', 'N° muestra ajustado', `Se reintentará con ${reg.num_muestra}.`);
                                i--;
                                actualizarBarraHeaderEstado();
                                continue;
                            }
                            reg.estado = 'bloqueado';
                            reg.error = `NUM_MUESTRA ${reg.num_muestra} ya existe y no se pudo reasignar automáticamente.`;
                            reg.actualizado_en = Date.now();
                            huboCambios = true;
                            pushEstadoSync(reg);
                            registrarNumMuestraUsadoLocal(reg.num_muestra, {
                                fecha: String(numInfoPost?.fecha || reg.fecha || ''),
                                ensayo_numero: String(numInfoPost?.ensayo_numero || reg.ensayo_numero || ''),
                                estado: 'bloqueado'
                            });
                            await avisarNumMuestraDuplicadoConDetalle(
                                {
                                    num_muestra: String(numInfoPost?.num_muestra || reg.num_muestra || ''),
                                    fecha: String(numInfoPost?.fecha || reg.fecha || ''),
                                    ensayo_numero: String(numInfoPost?.ensayo_numero || reg.ensayo_numero || '')
                                },
                                'Ese N° muestra ya existe. Revisa conexión o contacta soporte si se repite.'
                            );
                            queue.splice(i, 1);
                            i--;
                            guardarColaSync(queue);
                            actualizarBarraHeaderEstado();
                            bloqueoPorCodigo = true;
                        }
                    }
                    if (bloqueoPorCodigo) continue;

                    reg.estado = 'pendiente';
                    reg.error = postResp?.error
                        ? String(postResp.error)
                        : 'POST sin confirmación clara. Reintento automático.';
                    reg.actualizado_en = Date.now();
                    huboCambios = true;
                    pushEstadoSync(reg);
                    logSync('Pendiente: sin confirmación aún', {
                        uid: reg.uid,
                        num_muestra: reg.num_muestra,
                        ensayo_numero: reg.ensayo_numero
                    });
                }
            } finally {
                if (huboCambios) {
                    guardarColaSync(limpiarColaSyncSoloPendientes(queue));
                }
                syncEnCurso = false;
                actualizarBarraHeaderEstado();
                if (huboSubidaExitosa && navigator.onLine && API_URL) {
                    void refrescarEstadoServidorOperativo(true);
                } else if (huboCambios) {
                    aplicarBloqueoMuestrasCacheLocal();
                }
            }
            return resumenEstadosSync();
        }
        window.sincronizarPendientes = sincronizarPendientes;

        function construirOpcionesJarraModal(ensayo, jarraActual = null) {
            const clave = String(ensayo || 'Ensayo 1');
            const setJarras = new Set();
            const sinFilasLlenado = ensayoSinFilasLlenadoJarras_(clave);

            // Sin filas de llenado: no inventar n° 1; el select usa solo " - ".
            if (sinFilasLlenado) return [];

            if (esModoRegistroAcopio_()) {
                data
                    .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                    .map((it) => Number(it.jarra))
                    .filter((n) => Number.isFinite(n) && n >= 1)
                    .forEach((n) => setJarras.add(n));
                obtenerFilasLlenadoJarras(clave).forEach((f) => {
                    const txt = String(f.jarra ?? '').trim();
                    const r = parseRangoJarraLlenado(txt);
                    if (r) {
                        setJarras.add(r.a);
                        setJarras.add(r.b);
                        return;
                    }
                    const n = Number(txt);
                    if (Number.isFinite(n) && n >= 1) setJarras.add(n);
                });
            } else {
                // Visual: habilitar jarras con trasvasado (T) completo.
                const filas = obtenerFilasLlenadoJarras(clave);
                filas.forEach((f) => {
                    if (String(f.tipo || '').trim() !== 'T') return;
                    const ini = String(f.inicio || '').trim();
                    const fin = String(f.termino || '').trim();
                    if (!ini || !fin) return;
                    const txt = String(f.jarra ?? '').trim();
                    const r = parseRangoJarraLlenado(txt);
                    if (r) {
                        setJarras.add(r.a);
                        setJarras.add(r.b);
                        return;
                    }
                    const n = Number(txt);
                    if (Number.isFinite(n) && n >= 1) setJarras.add(n);
                });
                if (!setJarras.size) {
                    data
                        .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                        .map((it) => Number(it.jarra))
                        .filter((n) => Number.isFinite(n) && n >= 1)
                        .forEach((n) => setJarras.add(n));
                }
            }

            const actualNum = Number(jarraActual);
            if (Number.isFinite(actualNum) && actualNum >= 1) setJarras.add(actualNum);
            if (!setJarras.size) {
                // Hay filas de llenado pero aún sin T completo: ofrecer jarras de las filas o 1.
                obtenerFilasLlenadoJarras(clave).forEach((f) => {
                    const txt = String(f.jarra ?? '').trim();
                    const r = parseRangoJarraLlenado(txt);
                    if (r) {
                        setJarras.add(r.a);
                        setJarras.add(r.b);
                        return;
                    }
                    const n = Number(txt);
                    if (Number.isFinite(n) && n >= 1) setJarras.add(n);
                });
            }
            if (!setJarras.size) setJarras.add(1);
            return [...setJarras].sort((a, b) => a - b);
        }

        function poblarSelectJarraModal(ensayo, jarraActual = null) {
            const select = document.getElementById('visual-m-jarra');
            if (!select) return;
            const sinFilasLlenado = ensayoSinFilasLlenadoJarras_(ensayo);
            const opciones = construirOpcionesJarraModal(ensayo, jarraActual);
            const opcionesHtml = opciones.map((n) => `<option value="${n}">n° ${n}</option>`).join('');
            // " - " solo cuando no hay ninguna fila de tiempo de llenado de jarras.
            const dashOpt = sinFilasLlenado ? '<option value=""> - </option>' : '';
            select.innerHTML = `${dashOpt}${opcionesHtml}`;
            if (sinFilasLlenado) {
                select.value = '';
            } else if (jarraVaciaItem_(jarraActual)) {
                select.value = String(opciones[0] ?? '1');
            } else {
                const preferida = Number(jarraActual);
                const valor = Number.isFinite(preferida) && preferida >= 1 ? preferida : opciones[0];
                select.value = String(valor);
            }
        }

        function abrirModal(title, item = null) {
            const ahora = Date.now();
            if (!item && ahora - abrirModalTarjetaTs_ < 450) return;
            abrirModalTarjetaTs_ = ahora;

            establecerMenuFlotanteAbierto(false);
            const overlay = document.getElementById('modal-overlay');
            if (!item && overlay?.style.display === 'flex') return;

            const ensayoAct = obtenerEnsayoActivo();
            let itemTrabajo = item;
            if (!itemTrabajo) {
                const vacio = primerClamshellVacioEnsayo_(ensayoAct);
                if (vacio) itemTrabajo = vacio;
            }
            const rellenandoVacio = !item && !!itemTrabajo;

            const esNuevoReal = !itemTrabajo;
            const titleRow = document.getElementById('modal-title-row');
            if (titleRow) titleRow.classList.toggle('modal-title-row--edit', !esNuevoReal && !rellenandoVacio);
            if (esNuevoReal || rellenandoVacio) {
                document.getElementById('modal-title').innerText = 'Nuevo Registro:';
            } else {
                const n = numeroClamshellPorEnsayo(itemTrabajo);
                document.getElementById('modal-title').innerText = `Editar Clamshell #${n}:`;
            }
            editingCardId = itemTrabajo ? itemTrabajo.id : null;
            poblarSelectJarraModal(ensayoAct, itemTrabajo ? itemTrabajo.jarra : null);
            const nroModal = nroClamshellModalActual_(itemTrabajo);
            const esAutoP1 = clamshellUsaPeso1DesdePeso2(nroModal);
            const inpP2 = elInputPesoModalCampo_('p2');
            const inpP1 = elInputPesoModalCampo_('p1');
            const inpAcopio = elInputPesoModalCampo_('acopio');
            const inpP4 = elInputPesoModalCampo_('p4');
            const inpDespacho = elInputPesoModalCampo_('despacho');
            if (inpP2) inpP2.value = itemTrabajo ? valorPesoInput(itemTrabajo.p2) : '';
            if (inpP1) {
                inpP1.value = itemTrabajo
                    ? (esAutoP1 ? valorPesoInput(itemTrabajo.p2) : valorPesoInput(itemTrabajo.p1))
                    : '';
            }
            if (inpAcopio) inpAcopio.value = itemTrabajo ? valorPesoInput(itemTrabajo.acopio) : '';
            if (inpP4) inpP4.value = itemTrabajo ? valorPesoInput(itemTrabajo.p4) : '';
            if (inpDespacho) inpDespacho.value = itemTrabajo ? valorPesoInput(itemTrabajo.despacho) : '';
            configurarModalPesosClamshell_(nroModal);
            conectarValidacionPesosModalCampo_();
            validarPesosModalCampoEnVivo();
            overlay.style.display = 'flex';
        }

        function guardarModalTarjeta() {
            if (guardandoModalTarjeta_) return;
            guardandoModalTarjeta_ = true;
            const btnGuardar = document.getElementById('btn-save-tarjeta');
            if (btnGuardar) btnGuardar.disabled = true;

            try {
                let itemEdit = editingCardId != null
                    ? data.find((entry) => entry.id === editingCardId)
                    : null;
                if (!itemEdit) {
                    itemEdit = primerClamshellVacioEnsayo_(obtenerEnsayoActivo());
                    if (itemEdit) editingCardId = itemEdit.id;
                }

                const nroModal = nroClamshellModalActual_(itemEdit);
                const esAutoP1 = clamshellUsaPeso1DesdePeso2(nroModal);
                let p1Val = Number(elInputPesoModalCampo_('p1')?.value || 0);
                let p2Val = Number(elInputPesoModalCampo_('p2')?.value || 0);
                let acopioVal = Number(elInputPesoModalCampo_('acopio')?.value || 0);
                const p4Val = Number(elInputPesoModalCampo_('p4')?.value || 0);
                const despachoVal = Number(elInputPesoModalCampo_('despacho')?.value || 0);
                const jarraSel = leerJarraSelectModal_();
                if (jarraSel === null) {
                    mostrarAlertaRegla(
                        'Falta jarra',
                        'Selecciona un N° de jarra válido o " - " si no aplica.'
                    );
                    return;
                }
                if (jarraSel === '' && esModoRegistroAcopio_() && itemTienePesos123Acopio_(
                    { p1: p1Val, p2: p2Val, acopio: acopioVal },
                    nroModal
                )) {
                    mostrarAlertaRegla(
                        'Falta jarra',
                        'Si registras Pesos 1–3, selecciona N° de jarra (no " - ").'
                    );
                    return;
                }

                if (esModoRegistroAcopio_()) {
                    if (jarraSel === '') {
                        p1Val = 0;
                        p2Val = 0;
                        acopioVal = 0;
                    }
                    // Guardar parcial: basta un peso. P4/P5 se exigen solo al enviar.
                    const hayAlgunoAcopio = !pesoVacio(p1Val) || !pesoVacio(p2Val)
                        || !pesoVacio(acopioVal) || !pesoVacio(p4Val) || !pesoVacio(despachoVal);
                    if (!hayAlgunoAcopio) {
                        mostrarAlertaRegla('Falta peso', 'Registra al menos un peso para guardar.');
                        return;
                    }
                    const erroresPesos = erroresPesosAcopioModal_(
                        p1Val, p2Val, acopioVal, p4Val, despachoVal, nroModal
                    );
                    if (erroresPesos.length) {
                        mostrarAlertaRegla('Pesos inválidos', erroresPesos[0]);
                        return;
                    }
                    if (esAutoP1 && !pesoVacio(p2Val)) p1Val = p2Val;
                    else if (pesoVacio(p1Val)) p1Val = 0;
                } else if (esAutoP1) {
                    const hayAlguno = !pesoVacio(p2Val) || !pesoVacio(acopioVal) || !pesoVacio(despachoVal);
                    if (!hayAlguno) {
                        mostrarAlertaRegla('Falta peso', 'Registra al menos un peso para guardar.');
                        return;
                    }
                    p1Val = !pesoVacio(p2Val) ? p2Val : 0;
                } else {
                    const hayAlguno = !pesoVacio(p1Val) || !pesoVacio(p2Val)
                        || !pesoVacio(acopioVal) || !pesoVacio(despachoVal);
                    if (!hayAlguno) {
                        mostrarAlertaRegla('Falta peso', 'Registra al menos un peso para guardar.');
                        return;
                    }
                }
                if (!esModoRegistroAcopio_()) {
                    const erroresPesosVisual = erroresPesosVisualModal_(
                        p1Val, p2Val, acopioVal, despachoVal, nroModal
                    );
                    if (erroresPesosVisual.length) {
                        mostrarAlertaRegla('Pesos inválidos', erroresPesosVisual[0]);
                        return;
                    }
                }

            if (editingCardId === null) {
                const nuevoId = (data.length ? Math.max(...data.map((d) => Number(d.id) || 0)) : 0) + 1;
                data.push({
                    id: nuevoId,
                    jarra: jarraSel,
                    ensayo: obtenerEnsayoActivo(),
                    p1: p1Val,
                    p2: Number.isFinite(p2Val) ? p2Val : 0,
                    acopio: Number.isFinite(acopioVal) ? acopioVal : 0,
                        p4: Number.isFinite(p4Val) ? p4Val : 0,
                    despacho: Number.isFinite(despachoVal) ? despachoVal : 0,
                    observacion: '',
                    placaVehiculo: '',
                    guiaRemision: '',
                    metric: metricaVacia()
                });
                    recalcularPresionesParaEnsayo(obtenerEnsayoActivo());
                cerrarModal();
                renderizarTarjetas();
                programarGuardadoDraftCompleto();
                marcarBotonGuardado('btn-save-tarjeta');
                mostrarToast('success', 'Guardado', 'Registro del clamshell guardado.');
                return;
            }

            const item = data.find((entry) => entry.id === editingCardId);
            if (!item) {
                cerrarModal();
                return;
            }
                const eraVacio = esClamshellSinDatos_(item);
                aplicarDatosModalAClamshell_(item, jarraSel, p1Val, p2Val, acopioVal, p4Val, despachoVal);
            cerrarModal();
            renderizarTarjetas();
            programarGuardadoDraftCompleto();
            window.PdfPreviewLive?.programar?.();
            marcarBotonGuardado('btn-save-tarjeta');
                mostrarToast('success', 'Guardado', eraVacio
                    ? 'Registro del clamshell guardado.'
                    : 'Registro del clamshell actualizado.');
            } finally {
                guardandoModalTarjeta_ = false;
                if (btnGuardar && !btnGuardar.classList.contains('is-loading')) {
                    btnGuardar.disabled = false;
                }
            }
        }

        function abrirModalObservacion(event, itemId) {
            if (event && typeof event.stopPropagation === 'function') {
                event.stopPropagation();
            }
            const item = data.find((entry) => entry.id === itemId);
            if (!item) return;
            observationModalState.itemId = itemId;
            document.getElementById('observation-modal-title').textContent = 'Observación · Clamshell #' + numeroClamshellPorEnsayo(item);
            document.getElementById('visual-observation').value = item.observacion || '';
            document.getElementById('observation-modal-overlay').style.display = 'flex';
        }

        function cerrarModalObservacion() {
            const item = data.find((entry) => entry.id === observationModalState.itemId);
            const inp = document.getElementById('visual-observation');
            if (item && inp) inp.value = item.observacion || '';
            document.getElementById('observation-modal-overlay').style.display = 'none';
        }

        function bindCerrarModalAlClickFueraCampo(overlayEl, onDismiss) {
            if (!overlayEl || overlayEl.dataset.dismissBound === '1') return;
            overlayEl.dataset.dismissBound = '1';
            overlayEl.addEventListener('click', (e) => {
                const panel = overlayEl.querySelector('.modal-content, .time-picker-modal');
                if (panel && panel.contains(e.target)) return;
                onDismiss();
            });
        }

        function initCerrarModalesCampo() {
            const inpP2 = elInputPesoModalCampo_('p2');
            if (inpP2 && !inpP2.dataset.peso1AutoBound) {
                inpP2.dataset.peso1AutoBound = '1';
                inpP2.addEventListener('input', () => {
                    sincronizarPeso1DesdePeso2EnModal_();
                    validarPesosModalCampoEnVivo();
                });
            }
            ['p1', 'p2', 'acopio', 'p4', 'despacho'].forEach((campo) => {
                const inp = elInputPesoModalCampo_(campo);
                if (!inp || inp.dataset.draftPersistBound === '1') return;
                inp.dataset.draftPersistBound = '1';
                const persist = () => {
                    persistirModalTarjetaAbiertaCampo_();
                    programarGuardadoDraftCompleto();
                };
                inp.addEventListener('input', persist);
                inp.addEventListener('change', persist);
            });
            const jarraSel = document.getElementById('visual-m-jarra');
            if (jarraSel && jarraSel.dataset.draftPersistBound !== '1') {
                jarraSel.dataset.draftPersistBound = '1';
                jarraSel.addEventListener('change', () => {
                    persistirModalTarjetaAbiertaCampo_();
                    programarGuardadoDraftCompleto();
                });
            }
            const obsInp = document.getElementById('visual-observation');
            if (obsInp && obsInp.dataset.draftPersistBound !== '1') {
                obsInp.dataset.draftPersistBound = '1';
                obsInp.setAttribute('maxlength', String(OBSERVACION_CLAMSHELL_MAX_CHARS));
                const persistObs = () => {
                    const limpio = limitarObservacionClamshell_(obsInp.value);
                    if (obsInp.value !== limpio) obsInp.value = limpio;
                    const item = data.find((entry) => entry.id === observationModalState.itemId);
                    if (item) item.observacion = limpio;
                    programarGuardadoDraftCompleto();
                };
                obsInp.addEventListener('input', persistObs);
                obsInp.addEventListener('change', persistObs);
            }
            bindCerrarModalAlClickFueraCampo(document.getElementById('modal-overlay'), cerrarModal);
            bindCerrarModalAlClickFueraCampo(document.getElementById('metric-modal-overlay'), cerrarModalMetrica);
            bindCerrarModalAlClickFueraCampo(document.getElementById('observation-modal-overlay'), cerrarModalObservacion);
            bindCerrarModalAlClickFueraCampo(document.getElementById('essential-modal-overlay'), cerrarModalResumen);
            bindCerrarModalAlClickFueraCampo(document.getElementById('control-global-modal-overlay'), cerrarModalControlGlobal);
            bindCerrarModalAlClickFueraCampo(document.getElementById('llenado-horas-modal-overlay'), cerrarModalHorasLlenado);
            bindCerrarModalAlClickFueraCampo(document.getElementById('time-picker-modal-overlay'), cerrarTimePickerPersonalizado);
        }

        function guardarModalObservacion() {
            const item = data.find((entry) => entry.id === observationModalState.itemId);
            if (!item) {
                cerrarModalObservacion();
                return;
            }
            item.observacion = limitarObservacionClamshell_(
                document.getElementById('visual-observation')?.value
            );
            cerrarModalObservacion();
            renderizarTarjetas();
            programarGuardadoDraftCompleto();
            marcarBotonGuardado('btn-save-observacion');
            mostrarToast('success', 'Guardado', 'Observación guardada.');
        }

        function abrirModalResumenGlobal() {
            establecerMenuFlotanteAbierto(false);
            document.getElementById('essential-modal-title').textContent = 'Resumen general para envío';
            const body = document.getElementById('essential-modal-body');
            const ensayos = [...new Set(data.map((item) => String(item.ensayo || '').trim()).filter(Boolean))];
            body.innerHTML = ensayos.map((ensayo) => {
                const meta = obtenerMetaEnsayo(ensayo);
                const rows = data.filter((item) => (item.ensayo || 'Ensayo 1') === ensayo).map((item) => {
                    const nroClamshell = numeroClamshellPorEnsayo(item);
                    const temp = item.metric?.temperatura || {};
                    const horaDesp = item.metric?.tiempo?.despachoAcopio || '--';
                    return `
                        <div class="essential-block">
                            <h4>Clamshell #${nroClamshell} · Jarra ${item.jarra}</h4>
                            <div class="essential-summary-grid">
                                <div class="essential-card"><b>Peso despacho acopio-campo</b><span class="${pesoVacio(item.despacho) ? 'is-empty-peso' : ''}">${textoPesoCampo(item.despacho)}</span></div>
                                <div class="essential-card"><b>Hora despacho acopio-campo</b><span>${horaDesp}</span></div>
                            </div>
                            <div class="essential-summary-grid">
                                <div class="essential-card"><b>Temp. despacho acopio-campo (ambiente)</b><span>${temp.despachoAmbiente ? temp.despachoAmbiente + '°C' : '--'}</span></div>
                                <div class="essential-card"><b>Temp. despacho acopio-campo (pulpa)</b><span>${temp.despachoPulpa ? temp.despachoPulpa + '°C' : '--'}</span></div>
                            </div>
                            <div class="essential-summary-grid">
                                <div class="essential-card essential-card--full"><b>Observación</b><span>${item.observacion || '--'}</span></div>
                            </div>
                        </div>
                    `;
                }).join('');
                return `
                    <details class="ensayo-accordion">
                        <summary>${ensayo} · ${data.filter((it) => (it.ensayo || 'Ensayo 1') === ensayo).length} clamshell(s)</summary>
                        <div class="ensayo-body">
                            <div class="essential-summary-grid">
                                <div class="form-group">
                                    <label>PLACA VEHÍCULO</label>
                                    <input type="text" id="resumen-placa-${slugIdSeguro(ensayo)}" data-ensayo-placa="${ensayo}" value="${meta.placaVehiculo || ''}" placeholder="Ej. 9967-OK">
                                </div>
                                <div class="form-group">
                                    <label>GUÍA REMISIÓN ACOPIO</label>
                                    <input type="text" id="resumen-guia-${slugIdSeguro(ensayo)}" data-ensayo-guia="${ensayo}" value="${meta.guiaRemision || ''}" placeholder="Ej. 208353">
                                </div>
                            </div>
                            ${rows}
                        </div>
                    </details>
                `;
            }).join('');
            document.getElementById('essential-modal-overlay').style.display = 'flex';
            if (typeof window.precalentarPdfAvancePacking === 'function') {
                window.precalentarPdfAvancePacking();
            }
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }

        /** Solo lee placa/guía del modal (sin re-render de tarjetas). */
        function capturarPlacaGuiaResumenModal_() {
            const ensayos = [...new Set(data.map((item) => String(item.ensayo || '').trim()).filter(Boolean))];
            ensayos.forEach((ensayo) => {
                const placaInput = document.querySelector('[data-ensayo-placa="' + ensayo + '"]');
                const guiaInput = document.querySelector('[data-ensayo-guia="' + ensayo + '"]');
                const placa = (placaInput?.value || '').trim().toUpperCase();
                const guia = (guiaInput?.value || '').trim();
                ensayoMeta[ensayo] = { placaVehiculo: placa, guiaRemision: guia };
                data.forEach((item) => {
                    if ((item.ensayo || 'Ensayo 1') === ensayo) {
                        item.placaVehiculo = placa;
                        item.guiaRemision = guia;
                    }
                });
            });
        }

        function persistirInputsResumenModalGlobal_() {
            snapshotMetaEnsayoActual();
            capturarPlacaGuiaResumenModal_();
            renderizarTarjetas();
            sincronizarLogisticaAcopioDesdeEnsayo();
            programarGuardadoDraftCompleto();
        }

        function metaPdfAvanceDesdeEnsayo_(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            const placaInput = document.querySelector('[data-ensayo-placa="' + clave + '"]');
            const guiaInput = document.querySelector('[data-ensayo-guia="' + clave + '"]');
            const placa = String(
                placaInput?.value
                || ensayoMeta[clave]?.placaVehiculo
                || valorCampoMetaEnsayo_(clave, 'visual-placa-vehiculo')
                || ''
            ).trim().toUpperCase();
            const guia = String(
                guiaInput?.value
                || ensayoMeta[clave]?.guiaRemision
                || valorCampoMetaEnsayo_(clave, 'visual-guia-acopio')
                || ''
            ).trim();
            const metaSnap = {
                'visual-traz-etapa': valorCampoMetaEnsayo_(clave, 'visual-traz-etapa'),
                'visual-traz-campo': valorCampoMetaEnsayo_(clave, 'visual-traz-campo'),
                'visual-traz-turno': valorCampoMetaEnsayo_(clave, 'visual-traz-turno'),
                'visual-traz-acopio': valorCampoMetaEnsayo_(clave, 'visual-traz-acopio')
            };
            return {
                ensayo: clave,
                muestraLabel: mostrarMuestra(clave),
                numMuestra: valorCampoMetaEnsayo_(clave, 'visual-num-muestra')
                    || String(calcularNumMuestraDesdeServidorParaEnsayo(clave) || '').trim(),
                trazabilidad: trazabilidadTextoMostrar(metaSnap),
                trazabilidadArchivo: trazabilidadBaseDesdeMeta(metaSnap),
                responsable: valorCampoMetaEnsayo_(clave, 'visual-responsable'),
                fundo: valorCampoMetaEnsayo_(clave, 'visual-meta-fundo'),
                variedad: valorCampoMetaEnsayo_(clave, 'visual-meta-variedad'),
                placa,
                guia
            };
        }

        function obtenerDatosPdfAvancePacking() {
            capturarPlacaGuiaResumenModal_();
            const ensayos = [...new Set(data.map((item) => String(item.ensayo || '').trim()).filter(Boolean))];
            const muestras = ensayos.map((ensayo) => {
                const clamshells = data
                    .filter((item) => (item.ensayo || 'Ensayo 1') === ensayo)
                    .slice()
                    .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0))
                    .map((item) => {
                        const temp = item.metric?.temperatura || {};
                        return {
                            clamshell: numeroClamshellPorEnsayo(item),
                            jarra: item.jarra,
                            pesoDespacho: item.despacho ?? '',
                            horaDespacho: item.metric?.tiempo?.despachoAcopio || '',
                            tempAmb: temp.despachoAmbiente ?? '',
                            tempPulpa: temp.despachoPulpa ?? '',
                            observacion: item.observacion || ''
                        };
                    });
                return {
                    meta: metaPdfAvanceDesdeEnsayo_(ensayo),
                    clamshells
                };
            });
            const ahora = new Date();
            return {
                fecha: hoyIsoLocal(),
                generadoEn: ahora.toLocaleString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                muestras
            };
        }

        window.obtenerDatosPdfAvancePacking = obtenerDatosPdfAvancePacking;

        async function enviarModalResumenGlobalWhatsApp() {
            if (envioRegistroEnCurso) return;
            envioRegistroEnCurso = true;
            const btn = document.getElementById('btn-save-resumen-global');
            const label = btn?.querySelector('.essential-wsp-btn-label');
            if (btn) btn.disabled = true;
            if (label) label.textContent = 'Enviando…';
            try {
                if (typeof window.generarYEnviarPdfAvancePacking !== 'function') {
                    mostrarToast('error', 'PDF no disponible', 'Recarga la página e intenta de nuevo.');
                    return;
                }
                const datos = obtenerDatosPdfAvancePacking();
                cerrarModalResumen();
                await window.generarYEnviarPdfAvancePacking(datos);
                sincronizarLogisticaAcopioDesdeEnsayo();
                programarGuardadoDraftCompleto();
                mostrarToast('success', 'Listo', 'Vista previa abierta. Comparte por WhatsApp o descarga.');
            } catch (e) {
                if (e && e.name === 'AbortError') return;
                const msg = e && e.message ? e.message : 'No se pudo enviar el PDF.';
                mostrarToast('error', 'Error', msg);
            } finally {
                if (btn) btn.disabled = false;
                if (label) label.textContent = 'Enviar WhatsApp';
                envioRegistroEnCurso = false;
            }
        }

        window.enviarModalResumenGlobalWhatsApp = enviarModalResumenGlobalWhatsApp;

        function cerrarModalResumen() {
            document.getElementById('essential-modal-overlay').style.display = 'none';
        }

        async function cambiarEnsayoActivoEnFormulario_(ensayo) {
            const objetivo = String(ensayo || '').trim();
            if (!objetivo) return;
            const actual = String(obtenerEnsayoActivo() || metaActivoEnsayo || '').trim();
            if (actual === objetivo) return;
            const permitido = await bloquearCambioMuestraFueraDeOrden(objetivo, actual);
            if (!permitido) return;
            snapshotMetaEnsayoActual();
            if (!metaPorEnsayo[objetivo]) {
                metaPorEnsayo[objetivo] = { 'visual-meta-muestra': objetivo, 'visual-rotulo': objetivo };
            }
            cargarMetaDeEnsayo(objetivo);
            const muestraEl = document.getElementById('visual-meta-muestra');
            const rotulo = document.getElementById('visual-rotulo');
            if (muestraEl) muestraEl.value = objetivo;
            if (rotulo) rotulo.value = objetivo;
            aplicarCambioEnsayoActivo();
            programarGuardadoMeta();
        }

        async function prepararDeteccionEnvioCampo() {
            const activo = String(metaActivoEnsayo || ensayoDesdeFormulario() || 'Ensayo 1').trim() || 'Ensayo 1';
            persistirLogisticaAcopioDesdeInputs();
            snapshotMetaEnsayoActual(activo);
            reconstruirEnsayosEnUsoSesionDesdeEstado();
            if (navigator.onLine && API_URL) {
                await refrescarEstadoServidorOperativo(false);
            } else {
                refrescarEstadoOperativoLocal();
            }
            await precongelarNumerosMuestraParaEnvio(ensayosCandidatosConDatosCampo());
        }

        async function seleccionarEnsayoCompletoParaEnviar_(preferido) {
            const completos = ordenarEnsayosPorNumeroMuestra(obtenerEnsayosCompletosParaEnvio());
            if (!completos.length) return null;
            const { huecos } = detectarHuecosEnMuestrasListasParaEnvio(completos);
            const secuenciaContinua = huecos.length === 0;
            if (completos.length === 1) return { modo: 'una', ensayo: completos[0] };
            const opts = {};
            completos.forEach((ensayo) => {
                const nm = String(leerNumMuestraDesdePantalla(ensayo) || '').trim() || '--';
                opts[ensayo] = `${mostrarMuestra(ensayo)} · N° ${nm}`;
            });
            const pref = completos.includes(preferido) ? preferido : completos[0];
            const htmlSecuencia = secuenciaContinua
                ? '<p style="margin:0 0 10px;font-size:13px;color:#64748b;">Los N° siguen el orden de muestra (1, 2, 3…). Si envías solo una, las otras conservan su código en esta sesión.</p>'
                : `<p style="margin:0 0 10px;font-size:13px;color:#64748b;">Hay huecos en la secuencia (${huecos.map((n) => `Muestra ${n}`).join(', ')}). Puedes enviar <b>una muestra</b> a la vez; el envío conjunto requiere secuencia continua.</p>`;
            if (window.Swal && typeof window.Swal.fire === 'function') {
                const r = await swalFireSafe({
                    icon: 'question',
                    title: 'Selecciona muestra a enviar',
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
                if (r.isDenied && secuenciaContinua) return { modo: 'todas', ensayos: completos };
                if (!r.isConfirmed) return null;
                return { modo: 'una', ensayo: String(r.value || '').trim() || pref };
            }
            return { modo: 'una', ensayo: pref };
        }

        async function enviarMuestrasEnSecuencia_(ensayos) {
            const ordenados = ordenarEnsayosPorNumeroMuestra(ensayos);
            if (!ordenados.length) return;
            const secuenciaOk = await validarSecuenciaMuestrasListasParaEnvio(ordenados);
            if (!secuenciaOk) return;
            snapshotMetaEnsayoActual();
            await precongelarNumerosMuestraParaEnvio(ordenados);
            programarGuardadoDraftCompleto();

            for (const ensayo of ordenados) {
                const camposCompletos = await validarCamposRequeridosAntesDeEnviar(ensayo);
                if (!camposCompletos) return;
                const puedeGuardar = await confirmarNumMuestraUnicoAntesDeGuardar(ensayo);
                if (!puedeGuardar) return;
            }

            if (!navigator.onLine) {
                let enviados = 0;
                for (const ensayo of ordenados) {
                    await cambiarEnsayoActivoEnFormulario_(ensayo);
                    const encoladoOffline = await encolarRegistroPendiente(ensayo);
                    actualizarBarraHeaderEstado();
                    if (!encoladoOffline || encoladoOffline.bloqueadoLocal) return;
                    marcarEnsayoRegistradoHoyLocal(numeroDesdeEnsayoTexto(ensayo));
                    enviados++;
                }
                if (enviados > 0) {
                    const pdfOk = await asegurarPdfCampoHistorialTrasEnvio_(ordenados, hoyIsoLocal(), {
                        nums_por_ensayo: Object.fromEntries(ordenados.map((e) => [e, leerNumMuestraDesdePantalla(e)]))
                    });
                    mostrarToast(
                        pdfOk ? 'success' : 'warning',
                        'Cola offline',
                        pdfOk
                            ? `${enviados} muestra(s) en cola y PDF guardado en el teléfono.`
                            : `${enviados} muestra(s) en cola (sin internet).`
                    );
                    await resetearIngresoCampoTrasEnvioExitoso(ordenados[ordenados.length - 1]);
                }
                return;
            }

            try {
                const rs = await enviarRegistrosCampoConjunto_(ordenados);
                if (rs.ok && rs.estado === 'confirmado') {
                    if (!rs.pdfOk) {
                        await asegurarPdfCampoHistorialTrasEnvio_(ordenados, rs.payload?.fecha || hoyIsoLocal(), {
                            nums_por_ensayo: rs.payload?.nums_por_ensayo,
                            num_muestra: rs.payload?.num_muestra,
                            payload: rs.payload
                        });
                    }
                    await refrescarEstadoServidorOperativo(true);
                    mostrarToast(
                        rs.pdfOk ? 'success' : 'warning',
                        'Muestras enviadas',
                        rs.pdfOk
                            ? `${rs.enviados || ordenados.length} muestra(s) enviadas y PDF guardado en el teléfono.`
                            : `${rs.enviados || ordenados.length} muestra(s) en un solo envío (${rs.payload?.rows?.length || 0} filas).`
                    );
                    await resetearIngresoCampoTrasEnvioExitoso(ordenados[ordenados.length - 1]);
                    return;
                }
                if (rs.estado === 'duplicado_codigo') {
                    await avisarNumMuestraDuplicadoConDetalle(rs?.confirmacion?.detalle || {
                        num_muestra: String(rs?.payload?.num_muestra || ''),
                        fecha: String(rs?.payload?.fecha || ''),
                        ensayo_numero: String(rs?.payload?.ensayo_numero || '')
                    }, 'Conflicto en el lote; revisa los N° muestra en planilla.');
                    return;
                }
                mostrarToast(
                    rs.pdfOk ? 'success' : 'warning',
                    rs.pdfOk ? 'Enviado' : 'Envío pendiente',
                    rs.pdfOk
                        ? 'Lote enviado y PDF guardado en el teléfono.'
                        : 'El lote se envió pero falta confirmación del servidor. Revisa la planilla o reintenta.'
                );
            } catch (_) {
                mostrarToast('warning', 'Error de red', 'No se pudo enviar el lote conjunto. Revisa conexión e intenta de nuevo.');
            }
        }

        /** Cola de sync + toasts (compartido por modal resumen y botón fijo Campo). */
        async function finalizarEncoladoYSync(ensayoObjetivo) {
            await prepararDeteccionEnvioCampo();
            const ensayoBase = String(ensayoObjetivo || obtenerEnsayoActivo() || 'Ensayo 1');
            const completosPrevios = obtenerEnsayosCompletosParaEnvio();
            const seleccion = await seleccionarEnsayoCompletoParaEnviar_(ensayoBase);
            if (!seleccion) {
                if (!completosPrevios.length) {
                    const camposCompletos = await validarCamposRequeridosAntesDeEnviar(ensayoBase);
                    if (!camposCompletos) return;
                }
                return;
            }
            if (seleccion.modo === 'todas' && Array.isArray(seleccion.ensayos) && seleccion.ensayos.length) {
                await enviarMuestrasEnSecuencia_(seleccion.ensayos);
                return;
            }
            const ensayoFinal = seleccion.ensayo || ensayoBase;
            if (navigator.onLine && API_URL) {
                await refrescarEstadoServidorOperativo(false);
            } else {
                refrescarEstadoOperativoLocal();
            }
            await precongelarNumerosMuestraParaEnvio([ensayoFinal]);
            if (String(metaActivoEnsayo || ensayoDesdeFormulario() || '') === ensayoFinal) {
                aplicarNumMuestraParaEnsayoActivo('preValidarEnvio');
            }
            const camposCompletos = await validarCamposRequeridosAntesDeEnviar(ensayoFinal);
            if (!camposCompletos) return;
            const puedeGuardar = await confirmarNumMuestraUnicoAntesDeGuardar(ensayoFinal);
            if (!puedeGuardar) return;
            await cambiarEnsayoActivoEnFormulario_(ensayoFinal);
            programarGuardadoDraftCompleto();
            if (!navigator.onLine) {
                const encoladoOffline = await encolarRegistroPendiente(ensayoFinal);
                actualizarBarraHeaderEstado();
                if (encoladoOffline && !encoladoOffline.bloqueadoLocal) {
                    const pdfOk = encoladoOffline.pdf_local_ok
                        || await asegurarPdfCampoHistorialTrasEnvio_([ensayoFinal], encoladoOffline.fecha || hoyIsoLocal(), {
                            num_muestra: encoladoOffline.num_muestra,
                            payload: encoladoOffline
                        });
                    mostrarToast(
                        pdfOk ? 'success' : 'warning',
                        pdfOk ? 'Guardado en cola' : 'Sin internet',
                        pdfOk
                            ? 'Registro en cola y PDF guardado en el teléfono.'
                            : 'Sin conexión: quedó en cola. El PDF no se pudo guardar localmente.'
                    );
                    await resetearIngresoCampoTrasEnvioExitoso(ensayoFinal);
                }
                return;
            }
            try {
                const rs = await enviarRegistroCampoDirecto_(ensayoFinal);
                if (rs.ok && rs.estado === 'confirmado') {
                    if (!rs.pdfOk) {
                        await asegurarPdfCampoHistorialTrasEnvio_([ensayoFinal], rs.payload?.fecha || hoyIsoLocal(), {
                            num_muestra: rs.payload?.num_muestra,
                            payload: rs.payload
                        });
                    }
                    marcarEnsayoRegistradoHoyLocal(String(rs.payload?.ensayo_numero || numeroDesdeEnsayoTexto(ensayoFinal)));
                    fusionarMaxNumMuestraCampo(rs.payload?.num_muestra);
                    mostrarToast(
                        rs.pdfOk ? 'success' : 'warning',
                        'Sincronizado',
                        rs.pdfOk
                            ? 'Registro confirmado y PDF guardado en el teléfono.'
                            : 'Registro confirmado. No se pudo guardar el PDF local; intenta de nuevo desde Campo.'
                    );
                    await resetearIngresoCampoTrasEnvioExitoso(ensayoFinal);
                    return;
                }
                if (rs.estado === 'duplicado_codigo') {
                    await avisarNumMuestraDuplicadoConDetalle(rs?.confirmacion?.detalle || {
                        num_muestra: String(rs?.payload?.num_muestra || ''),
                        fecha: String(rs?.payload?.fecha || ''),
                        ensayo_numero: String(rs?.payload?.ensayo_numero || '')
                    }, 'Ese N° muestra ya existe; el sistema intentará reasignarlo al sincronizar.');
                    return;
                }
                mostrarToast(
                    rs.pdfOk ? 'success' : 'info',
                    'Enviado',
                    rs.pdfOk
                        ? 'Registro enviado y PDF guardado en el teléfono.'
                        : 'POST enviado. La confirmación del servidor puede demorar unos segundos.'
                );
                return;
            } catch (_) {
                const encoladoError = await encolarRegistroPendiente(ensayoFinal);
                actualizarBarraHeaderEstado();
                if (encoladoError && !encoladoError.bloqueadoLocal) {
                    const pdfOk = encoladoError.pdf_local_ok;
                    mostrarToast(
                        pdfOk ? 'warning' : 'warning',
                        'Conexión inestable',
                        pdfOk
                            ? 'Falló el envío directo; quedó en cola con PDF local guardado.'
                            : 'Falló el envío directo; quedó en cola y se reenviará con internet.'
                    );
                    await resetearIngresoCampoTrasEnvioExitoso(ensayoFinal);
                }
            }
        }

        /** Desde la pantalla principal: persiste meta + guía/placa, borrador y envío a cola/servidor. */
        async function guardarRegistroYEnviarDesdePantalla() {
            if (envioRegistroEnCurso) return;
            envioRegistroEnCurso = true;
            const btn = document.getElementById('btn-guardar-enviar-campo');
            setButtonLoading(btn, true, 'Enviando...');
            try {
            snapshotMetaEnsayoActual();
            sincronizarTrazabilidadCompuesta();
            persistirLogisticaAcopioDesdeInputs();
            guardarDraftCompleto();
            renderizarTarjetas();
            actualizarErroresMetaFormulario();
            await finalizarEncoladoYSync();
            } finally {
                setButtonLoading(btn, false);
                envioRegistroEnCurso = false;
            }
        }

        window.guardarRegistroYEnviarDesdePantalla = guardarRegistroYEnviarDesdePantalla;

        /** @deprecated Usar enviarModalResumenGlobalWhatsApp — conserva placa/guía local sin envío a planilla. */
        async function guardarModalResumenGlobal() {
            persistirInputsResumenModalGlobal_();
            cerrarModalResumen();
            mostrarToast('success', 'Guardado', 'Placa y guía guardadas localmente.');
        }

        

        function abrirModalMetrica(event, kind, itemId) {
            event.stopPropagation();
            let item = data.find((entry) => entry.id === itemId) || null;
            if (!item) return;
            let esLiderTiempo = true;
            if (kind === 'tiempo') {
                const lider = obtenerLiderTiempoPorJarra(item) || item;
                esLiderTiempo = Number(lider.id) === Number(item.id);
                sincronizarTiempoPorJarra(String(item.ensayo || 'Ensayo 1'));
                item = data.find((entry) => Number(entry.id) === Number(item.id)) || item;
            }
            const nroClamshell = numeroClamshellPorEnsayo(item);
            metricModalState.itemId = itemId;
            metricModalState.kind = kind;
            metricModalState.itemId = item.id;
            metricModalState.tiempoEditable = (kind !== 'tiempo') ? true : esLiderTiempo;
            const body = document.getElementById('metric-modal-body');
            const title = document.getElementById('metric-modal-title');
            const metric = item.metric || metricaVacia();

            if (kind === 'tiempo') {
                title.textContent = 'Tiempos de la muestra (hora) · Clamshell #' + nroClamshell;
                if (esModoRegistroAcopio_()) {
                body.innerHTML = `
                    <div class="metric-grid-2">
                            <div class="form-group"><label>Inicio de cosecha</label><input type="time" id="acopio-tiempo-1-iniciocosecha" data-metric="inicioCosecha" value="${metric.tiempo.inicioCosecha || ''}" disabled title="Primer inicio de cosecha de la muestra (igual en todos los clamshells)"></div>
                            <div class="form-group"><label>Término de cosecha</label><input type="time" id="acopio-tiempo-2-terminocosecha" data-metric="terminoCosecha" value="${metric.tiempo.terminoCosecha || ''}" disabled title="FINAL del último trasvasado del ensayo"></div>
                            <div class="form-group"><label>Llegada acopio-campo</label><input type="time" id="acopio-tiempo-3-llegada-acopio" data-metric="llegadaAcopio" value="${metric.tiempo.llegadaAcopio || ''}"></div>
                            <div class="form-group"><label>Acopio calibrado</label><input type="time" id="acopio-tiempo-4-acopio-calibrado" data-metric="acopioCalibrado" value="${metric.tiempo.acopioCalibrado || ''}"></div>
                            <div class="form-group"><label>Término de calibrado</label><input type="time" id="acopio-tiempo-5-termino-calibrado" data-metric="terminoCalibrado" value="${metric.tiempo.terminoCalibrado || ''}"></div>
                            <div class="form-group"><label>Despacho acopio-campo</label><input type="time" id="acopio-tiempo-6-despacho-acopio" data-metric="despachoAcopio" value="${metric.tiempo.despachoAcopio || ''}"></div>
                        </div>
                        <div id="visual-tiempo-alert" class="metric-inline-alert" style="display:none;"></div>
                    `;
                } else {
                    body.innerHTML = `
                        <div class="metric-grid-2">
                            <div class="form-group"><label>Inicio de cosecha</label><input type="time" id="visual-tiempo-1-iniciocosecha-1" data-metric="inicioCosecha" value="${metric.tiempo.inicioCosecha || ''}" disabled title="Primer inicio de cosecha de la muestra (igual en todos los clamshells)"></div>
                        <div class="form-group"><label>Inicio pérdida de peso</label><input type="time" id="visual-tiempo-1-inicioperdida-2" data-metric="inicioPerdida" value="${metric.tiempo.inicioPerdida || ''}" disabled title="Dato automático por trasvasado"></div>
                        <div class="form-group"><label>Término de cosecha</label><input type="time" id="visual-tiempo-1-terminocosecha-3" data-metric="terminoCosecha" value="${metric.tiempo.terminoCosecha || ''}" disabled title="FINAL del último trasvasado del ensayo (hora más tardía en panel, todas las filas T)"></div>
                        <div class="form-group"><label>Llegada acopio-campo</label><input type="time" id="visual-tiempo-1-terminocosecha-4" data-metric="llegadaAcopio" value="${metric.tiempo.llegadaAcopio || ''}"></div>
                    </div>
                    <div class="form-group"><label>Despacho acopio-campo</label><input type="time" id="visual-tiempo-1-despachoacopio-5" data-metric="despachoAcopio" value="${metric.tiempo.despachoAcopio || ''}"></div>
                    <div id="visual-tiempo-alert" class="metric-inline-alert" style="display:none;"></div>
                `;
                }
                body.querySelectorAll('input[data-metric]').forEach((inp) => {
                    inp.addEventListener('input', validarTiempoModalEnVivo);
                    inp.addEventListener('change', validarTiempoModalEnVivo);
                });
                if (!esLiderTiempo) {
                    body.querySelectorAll('input[data-metric]').forEach((inp) => {
                        inp.disabled = true;
                        inp.title = 'Solo el primer clamshell de la jarra puede editar tiempos';
                    });
                    const alertEl = document.getElementById('visual-tiempo-alert');
                    if (alertEl) {
                        alertEl.style.display = 'block';
                        alertEl.textContent = 'Clamshell #' + nroClamshell + ': bloqueado por seguridad. Solo el primer clamshell de esta jarra puede editar tiempos.';
                    }
                }
                asegurarIdsInputsDinamicos(body, `metric-${kind}-${item.id}`);
                validarTiempoModalEnVivo();
            } else if (kind === 'temperatura') {
                title.textContent = 'Temperatura muestra (°C) · Clamshell #' + nroClamshell;
                body.innerHTML = `
                    <p class="metric-mini-title">Inicio de cosecha</p>
                    <div class="metric-grid-2">
                        <div class="form-group"><label>T° ambiente</label><input type="number" step="0.1" id="visual-temp-amb-inicio" data-metric="inicioAmbiente" value="${metric.temperatura.inicioAmbiente || ''}"></div>
                        <div class="form-group"><label>T° pulpa</label><input type="number" step="0.1" id="visual-temp-pulpa-inicio" data-metric="inicioPulpa" value="${metric.temperatura.inicioPulpa || ''}"></div>
                    </div>
                    <p class="metric-mini-title">Término de cosecha</p>
                    <div class="metric-grid-2">
                        <div class="form-group"><label>T° ambiente</label><input type="number" step="0.1" id="visual-temp-amb-termino" data-metric="terminoAmbiente" value="${metric.temperatura.terminoAmbiente || ''}"></div>
                        <div class="form-group"><label>T° pulpa</label><input type="number" step="0.1" id="visual-temp-pulpa-termino" data-metric="terminoPulpa" value="${metric.temperatura.terminoPulpa || ''}"></div>
                    </div>
                    <p class="metric-mini-title">Llegada acopio-campo</p>
                    <div class="metric-grid-2">
                        <div class="form-group"><label>T° ambiente</label><input type="number" step="0.1" id="visual-temp-amb-llegada" data-metric="llegadaAmbiente" value="${metric.temperatura.llegadaAmbiente || ''}"></div>
                        <div class="form-group"><label>T° pulpa</label><input type="number" step="0.1" id="visual-temp-pulpa-llegada" data-metric="llegadaPulpa" value="${metric.temperatura.llegadaPulpa || ''}"></div>
                    </div>
                    <p class="metric-mini-title">Despacho acopio-campo</p>
                    <div class="metric-grid-2">
                        <div class="form-group"><label>T° ambiente</label><input type="number" step="0.1" id="visual-temp-amb-despacho" data-metric="despachoAmbiente" value="${metric.temperatura.despachoAmbiente || ''}"></div>
                        <div class="form-group"><label>T° pulpa</label><input type="number" step="0.1" id="visual-temp-pulpa-despacho" data-metric="despachoPulpa" value="${metric.temperatura.despachoPulpa || ''}"></div>
                    </div>
                    <details class="pressure-accordion" open>
                        <summary>Presión de vapor ambiente (Kpa)</summary>
                        <div class="pressure-accordion-body">
                            <div class="metric-grid-4">
                                <div class="form-group"><label>Inicio</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambienteinicio-1" data-metric="presionAmbienteInicio" value="${metric.temperatura.presionAmbienteInicio || ''}" disabled readonly tabindex="-1"></div>
                                <div class="form-group"><label>Término</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambientetermino-2" data-metric="presionAmbienteTermino" value="${metric.temperatura.presionAmbienteTermino || ''}" disabled readonly tabindex="-1"></div>
                                <div class="form-group"><label>Llegada</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambientellegada-3" data-metric="presionAmbienteLlegada" value="${metric.temperatura.presionAmbienteLlegada || ''}" disabled readonly tabindex="-1"></div>
                                <div class="form-group"><label>Despacho</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambientedespacho-4" data-metric="presionAmbienteDespacho" value="${metric.temperatura.presionAmbienteDespacho || ''}" disabled readonly tabindex="-1"></div>
                            </div>
                        </div>
                    </details>
                    <details class="pressure-accordion">
                        <summary>Presión de vapor fruta (Kpa)</summary>
                        <div class="pressure-accordion-body">
                            <div class="metric-grid-4">
                                <div class="form-group"><label>Inicio</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutainicio-1" data-metric="presionFrutaInicio" value="${metric.temperatura.presionFrutaInicio || ''}" disabled readonly tabindex="-1"></div>
                                <div class="form-group"><label>Término</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutatermino-2" data-metric="presionFrutaTermino" value="${metric.temperatura.presionFrutaTermino || ''}" disabled readonly tabindex="-1"></div>
                                <div class="form-group"><label>Llegada</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutallegada-3" data-metric="presionFrutaLlegada" value="${metric.temperatura.presionFrutaLlegada || ''}" disabled readonly tabindex="-1"></div>
                                <div class="form-group"><label>Despacho</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutadespacho-4" data-metric="presionFrutaDespacho" value="${metric.temperatura.presionFrutaDespacho || ''}" disabled readonly tabindex="-1"></div>
                            </div>
                        </div>
                    </details>
                `;
            } else if (kind === 'humedad') {
                title.textContent = 'Humedad relativa (%) · Clamshell #' + nroClamshell;
                body.innerHTML = `
                    <div class="metric-grid-2">
                        <div class="form-group"><label>Inicio de cosecha</label><input type="number" step="0.1" id="visual-cg-humedad-inicio" data-metric="inicio" value="${metric.humedad.inicio || ''}"></div>
                        <div class="form-group"><label>Término de cosecha</label><input type="number" step="0.1" id="visual-cg-humedad-termino" data-metric="termino" value="${metric.humedad.termino || ''}"></div>
                        <div class="form-group"><label>Llegada a acopio</label><input type="number" step="0.1" id="visual-cg-humedad-llegada" data-metric="llegada" value="${metric.humedad.llegada || ''}"></div>
                        <div class="form-group"><label>Despacho acopio</label><input type="number" step="0.1" id="visual-cg-humedad-despacho" data-metric="despacho" value="${metric.humedad.despacho || ''}"></div>
                    </div>
                `;
            } else if (kind === 'presionAmbiente') {
                title.textContent = 'Presión de vapor ambiente (Kpa) · Clamshell #' + nroClamshell;
                body.innerHTML = `
                    <div class="metric-grid-4">
                        <div class="form-group"><label>Inicio</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambienteinicio-1" data-metric="presionAmbienteInicio" value="${metric.temperatura.presionAmbienteInicio || ''}" disabled readonly tabindex="-1"></div>
                        <div class="form-group"><label>Término</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambientetermino-2" data-metric="presionAmbienteTermino" value="${metric.temperatura.presionAmbienteTermino || ''}" disabled readonly tabindex="-1"></div>
                        <div class="form-group"><label>Llegada</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambientellegada-3" data-metric="presionAmbienteLlegada" value="${metric.temperatura.presionAmbienteLlegada || ''}" disabled readonly tabindex="-1"></div>
                        <div class="form-group"><label>Despacho</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionambiente-1-presionambientedespacho-4" data-metric="presionAmbienteDespacho" value="${metric.temperatura.presionAmbienteDespacho || ''}" disabled readonly tabindex="-1"></div>
                    </div>
                `;
            } else if (kind === 'presionFruta') {
                title.textContent = 'Presión de vapor fruta (Kpa) · Clamshell #' + nroClamshell;
                body.innerHTML = `
                    <div class="metric-grid-4">
                        <div class="form-group"><label>Inicio</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutainicio-1" data-metric="presionFrutaInicio" value="${metric.temperatura.presionFrutaInicio || ''}" disabled readonly tabindex="-1"></div>
                        <div class="form-group"><label>Término</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutatermino-2" data-metric="presionFrutaTermino" value="${metric.temperatura.presionFrutaTermino || ''}" disabled readonly tabindex="-1"></div>
                        <div class="form-group"><label>Llegada</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutallegada-3" data-metric="presionFrutaLlegada" value="${metric.temperatura.presionFrutaLlegada || ''}" disabled readonly tabindex="-1"></div>
                        <div class="form-group"><label>Despacho</label><input type="text" inputmode="none" class="presion-readonly-inp" id="visual-presionfruta-1-presionfrutadespacho-4" data-metric="presionFrutaDespacho" value="${metric.temperatura.presionFrutaDespacho || ''}" disabled readonly tabindex="-1"></div>
                    </div>
                `;
            }
            asegurarIdsInputsDinamicos(body, `metric-${kind}-${item.id}`);
            body.querySelectorAll('input[data-metric]').forEach((inp) => {
                const persist = () => {
                    persistirModalMetricaAbiertaCampo_();
                    programarGuardadoDraftCompleto();
                };
                inp.addEventListener('input', persist);
                inp.addEventListener('change', persist);
            });

            document.getElementById('metric-modal-overlay').style.display = 'flex';
            inicializarFlatpickrInputs(document.getElementById('metric-modal-overlay'));
            prepararCustomTimePickers(document.getElementById('metric-modal-overlay'));
        }

        function cerrarModalMetrica() {
            document.getElementById('metric-modal-overlay').style.display = 'none';
            const metricBody = document.getElementById('metric-modal-body');
            if (metricBody) metricBody.innerHTML = '';
        }

        function guardarModalMetrica() {
            const item = data.find((entry) => entry.id === metricModalState.itemId);
            if (!item || !metricModalState.kind) return;
            if (metricModalState.kind === 'tiempo' && metricModalState.tiempoEditable === false) {
                mostrarAlertaRegla('Edicion bloqueada', 'Solo el primer clamshell de la jarra puede editar tiempos.');
                return;
            }
            if (metricModalState.kind === 'tiempo') {
                const errores = validarTiempoModalEnVivo();
                if (errores.length) {
                    mostrarAlertaRegla('Horario inválido', errores[0]);
                    return;
                }
            }
            const metricInputs = document.querySelectorAll('#metric-modal-body [data-metric]');
            metricInputs.forEach((input) => {
                if (input.disabled) return;
                item.metric[metricModalState.kind][input.getAttribute('data-metric')] = input.value;
            });
            if (metricModalState.kind === 'tiempo') {
                const llegada = String(item.metric?.tiempo?.llegadaAcopio || '').trim();
                const despacho = String(item.metric?.tiempo?.despachoAcopio || '').trim();
                const acopioCalibrado = String(item.metric?.tiempo?.acopioCalibrado || '').trim();
                const terminoCalibrado = String(item.metric?.tiempo?.terminoCalibrado || '').trim();
                if (llegada || despacho || acopioCalibrado || terminoCalibrado) {
                    const clave = String(item.ensayo || 'Ensayo 1');
                    data.forEach((it) => {
                        if (String(it.ensayo || 'Ensayo 1') !== clave) return;
                        it.metric = it.metric || metricaVacia();
                        it.metric.tiempo = it.metric.tiempo || {};
                        if (llegada) it.metric.tiempo.llegadaAcopio = llegada;
                        if (despacho) it.metric.tiempo.despachoAcopio = despacho;
                        if (acopioCalibrado) it.metric.tiempo.acopioCalibrado = acopioCalibrado;
                        if (terminoCalibrado) it.metric.tiempo.terminoCalibrado = terminoCalibrado;
                    });
                }
                sincronizarTiempoPorJarra(item.ensayo || 'Ensayo 1');
            }
            if (metricModalState.kind === 'temperatura' || metricModalState.kind === 'humedad') {
                recalcularPresionesParaTodos();
            }
            cerrarModalMetrica();
            renderizarTarjetas();
            programarGuardadoDraftCompleto();
            marcarBotonGuardado('btn-save-metrica');
            mostrarToast('success', 'Guardado', 'Métrica guardada correctamente.');
        }

        function cerrarModal() {
            const inpP1 = elInputPesoModalCampo_('p1');
            if (inpP1) {
                inpP1.disabled = false;
                inpP1.removeAttribute('title');
            }
            document.getElementById('modal-overlay').style.display = 'none';
        }

        initCerrarModalesCampo();
        document.getElementById('btn-cancel-tarjeta')?.addEventListener('click', cerrarModal);

        window.onclick = (e) => {
            if (fabMenu && !fabMenu.contains(e.target)) establecerMenuFlotanteAbierto(false);
        };

        window.addEventListener('online', () => {
            offlineAlertShown = false;
            cerrarAlertaModoOfflineSiAbierta();
            actualizarHeaderConexionUI();
            purgarCacheNumMuestraLocalStorage();
            void refrescarEstadoServidorOperativo(true).then((ok) => {
                if (ok && ultimaRespuestaEstadoServidor) {
                    const preservar = debePreservarBorradorCampoEnSync_();
                    propagarCambiosPlanillaServidorALaPantalla(ultimaRespuestaEstadoServidor, {
                        forzarUi: true,
                        invalidarFijados: !preservar,
                        reposicionarPrimera: !preservar,
                        avisar: true
                    });
                }
                actualizarVistaCompacta();
                actualizarProgresoMeta();
            });
            sincronizarPendientes();
        });
        window.addEventListener('offline', () => {
            actualizarHeaderConexionUI();
            refrescarEstadoOperativoLocal();
            asegurarOpcionesSelectAcopio();
            mostrarAlertaModoOffline();
        });

        solicitarAlmacenamientoPersistenteCampo_();
        void (async function arranqueInicialCampo_() {
            let draftRestaurado = false;
            let draftDesdeIdb = false;
            purgarBorradoresCampoDeOtroDia_();
            if (campoInicioLimpioNuevoDia_) {
                resetearPantallaEnCeroPostSync();
            } else {
                try {
                    const mejor = await elegirMejorBorradorCampo_();
                    if (mejor && borradorCampoTieneDatos_(mejor.d)) {
                        try {
                            localStorage.setItem(
                                draftStorageKeyCampo_(),
                                mejor.raw || JSON.stringify(mejor.d)
                            );
                        } catch (_) { /* ignore */ }
                        draftRestaurado = aplicarDraftDesdeObjeto_(mejor.d);
                        draftDesdeIdb = mejor.fuente === 'idb';
                    }
                } catch (_) { /* ignore */ }
            }

            purgarTodosNumerosMuestraEnMeta();
            arranqueCatalogoYMetaCampo_({ desdeBorrador: draftRestaurado });
            reconstruirEnsayosEnUsoSesionDesdeEstado();
            ensayoActivo = obtenerEnsayoActivo();
            recalcularPresionesParaTodos();
            actualizarIconos();
            iniciarAutoActualizacionFechaRing();
            asegurarClamshellInicialVacio(obtenerEnsayoActivo());
            renderizarTarjetas();
            renderizarPanelLlenadoJarras();
            sincronizarLogisticaAcopioDesdeEnsayo();
            inicializarFlatpickrInputs(document);
            prepararCustomTimePickers(document);
            configurarTimePickerEntradaTeclado_();
            document.getElementById('time-picker-hour-up')?.addEventListener('click', () => {
                timePickerState.hour = (timePickerState.hour + 1) % 24;
                timePickerActualizarVista_();
            });
            document.getElementById('time-picker-hour-down')?.addEventListener('click', () => {
                timePickerState.hour = (timePickerState.hour + 23) % 24;
                timePickerActualizarVista_();
            });
            document.getElementById('time-picker-minute-up')?.addEventListener('click', () => {
                timePickerState.minute = (timePickerState.minute + 1) % 60;
                timePickerActualizarVista_();
            });
            document.getElementById('time-picker-minute-down')?.addEventListener('click', () => {
                timePickerState.minute = (timePickerState.minute + 59) % 60;
                timePickerActualizarVista_();
            });
            document.getElementById('time-picker-now')?.addEventListener('click', () => {
                const now = new Date();
                timePickerState.hour = now.getHours();
                timePickerState.minute = now.getMinutes();
                timePickerActualizarVista_();
            });
            document.getElementById('time-picker-cancel')?.addEventListener('click', cerrarTimePickerPersonalizado);
            document.getElementById('time-picker-apply')?.addEventListener('click', aplicarTimePickerPersonalizado);
            const numMuestraInput = document.getElementById('visual-num-muestra');
            if (numMuestraInput) {
                numMuestraInput.setAttribute('maxlength', String(NUM_MUESTRA_MAX_LEN));
                numMuestraInput.addEventListener('input', () => {
                    const limpio = normalizarNumMuestraInput(numMuestraInput.value);
                    if (numMuestraInput.value !== limpio) numMuestraInput.value = limpio;
                });
            }
            INPUT_IDS_CRITICOS.forEach((id) => {
                const elId = esModoRegistroAcopio_()
                    ? ({
                        'visual-p1': 'acopio-peso-1-termino-cosecha',
                        'visual-p2': 'acopio-peso-2-llegada',
                        'visual-acopio': 'acopio-peso-3-calibrado',
                        'visual-despacho': 'acopio-peso-5-despacho-campo'
                    }[id] || id)
                    : id;
                const el = document.getElementById(elId);
                if (!el) return;
                el.addEventListener('input', programarGuardadoDraftCompleto);
                el.addEventListener('change', programarGuardadoDraftCompleto);
            });
            window.addEventListener('beforeunload', (e) => {
                if (omitirConfirmacionSalida) return;
                persistirSoloLocalCampo_();
                if (!hayDatosEnTrabajo()) return;
                const msg = '¿Estas seguro? Puedes perder informacion no enviada.';
                e.preventDefault();
                e.returnValue = msg;
                return msg;
            });
            document.querySelectorAll('#main-bottom-nav a[href]').forEach((a) => {
                a.addEventListener('click', () => {
                    persistirSoloLocalCampo_();
                    void flushDraftCampoAIdb_();
                    omitirConfirmacionSalida = true;
                    setTimeout(() => { omitirConfirmacionSalida = false; }, 1200);
                });
            });
            actualizarBarraHeaderEstado();
            await arranqueServidorCampoTrasBorrador_(draftRestaurado);
            iniciarAutosaveDraftCampo_();
            if (!navigator.onLine) {
                setTimeout(() => {
                    if (!navigator.onLine) mostrarAlertaModoOffline();
                }, 400);
            }
            sincronizarPendientes();
            if (draftRestaurado) {
                setTimeout(() => {
                    const msg = draftDesdeIdb
                        ? 'Tu borrador se recuperó del respaldo del teléfono (IndexedDB). Nada se envió al servidor hasta que pulses Enviar.'
                        : 'Tu borrador local se restauró. Nada se envió al servidor hasta que pulses Enviar.';
                    mostrarToast('info', 'Datos recuperados', msg);
                }, 350);
            }
        })();

        async function arranqueServidorCampoTrasBorrador_(borradorActivoInicial) {
            let borradorActivo = campoInicioLimpioNuevoDia_ ? false : !!borradorActivoInicial;
            if (!borradorActivo && !campoInicioLimpioNuevoDia_) {
                const res = await cargarMejorBorradorCampoAsync_({ silencioso: true, repintar: true });
                borradorActivo = res.aplicado;
            }
            if (!borradorActivo) {
                reiniciarNumeracionParaConsultaServidor();
            }
            if (!navigator.onLine || !API_URL) {
                refrescarEstadoOperativoLocal();
                if (campoInicioLimpioNuevoDia_) {
                    reposicionarPantallaPrimeraMuestraLibre('nuevoDiaOffline');
                } else {
                    asegurarNumMuestraAsignadoSiVacio(metaActivoEnsayo || ensayoDesdeFormulario());
                }
                actualizarVistaCompacta();
                actualizarProgresoMeta();
                return;
            }
            setNumMuestraCargando(true);
            try {
                await refrescarEstadoServidorOperativo(true);
                const preservarBorrador = !campoInicioLimpioNuevoDia_
                    && (borradorActivo || debePreservarBorradorCampoEnSync_());
                if (campoInicioLimpioNuevoDia_) {
                    reposicionarPantallaPrimeraMuestraLibre('nuevoDia');
                } else if (ultimaRespuestaEstadoServidor && necesitaReposicionarAPrimeraLibre() && !preservarBorrador) {
                    reposicionarPantallaPrimeraMuestraLibre('cargaInicial');
                } else {
                    asegurarNumMuestraAsignadoSiVacio(metaActivoEnsayo || ensayoDesdeFormulario());
                }
                const hayBorradorEnAlmacen = campoInicioLimpioNuevoDia_
                    ? false
                    : await existeBorradorConDatosEnAlmacenCampo_();
                if (!borradorActivo && hayBorradorEnAlmacen) {
                    const res = await cargarMejorBorradorCampoAsync_({ silencioso: true, repintar: true });
                    borradorActivo = res.aplicado;
                }
                if (!borradorActivo && !hayBorradorEnAlmacen && !campoInicioLimpioNuevoDia_) {
                    await vaciarDatosIngresoPreservandoMuestraYNumeracion_(metaActivoEnsayo || ensayoDesdeFormulario());
                    establecerAcordeonMetaAbierto(false);
                    guardarMetaEnAlmacenamiento();
                    if (typeof window.borrarBorradorCampoIdb === 'function') {
                        void window.borrarBorradorCampoIdb();
                    }
                    guardarDraftCompleto();
                }
                actualizarVistaCompacta();
                actualizarProgresoMeta();
            } finally {
                setNumMuestraCargando(false);
                actualizarHintNumMuestraPantalla();
                avisarFalloSincronizacionNumMuestra('cargaInicial');
                if (borradorActivo) {
                    reaplicarMetaFormularioCampo_(metaActivoEnsayo || ensayoDesdeFormulario());
                }
            }
        }

        async function reconciliarBorradorCampoAlVolverVisible_() {
            try {
                await cargarMejorBorradorCampoAsync_({
                    silencioso: true,
                    repintar: true,
                    soloSiMasNuevo: true
                });
            } catch (_) { /* ignore */ }
        }

        async function alVolverVisibleCampo_() {
            if (esNuevoDiaCampo_()) {
                limpiarAlmacenamientoCampoNuevoDia_();
                campoInicioLimpioNuevoDia_ = true;
                resetearPantallaEnCeroPostSync();
                reconstruirEnsayosEnUsoSesionDesdeEstado();
                ensayoActivo = obtenerEnsayoActivo();
                if (!navigator.onLine || !API_URL) {
                    refrescarEstadoOperativoLocal();
                    reposicionarPantallaPrimeraMuestraLibre('nuevoDiaVisible');
                    return;
                }
                await refrescarEstadoServidorOperativo(true);
                reposicionarPantallaPrimeraMuestraLibre('nuevoDiaVisible');
                actualizarVistaCompacta();
                actualizarProgresoMeta();
                return;
            }
            await reconciliarBorradorCampoAlVolverVisible_();
            reaplicarMetaFormularioCampo_(metaActivoEnsayo || ensayoDesdeFormulario());
            actualizarBarraHeaderEstado();
            if (!navigator.onLine || !API_URL) {
                refrescarEstadoOperativoLocal();
                return;
            }
            void refrescarEstadoServidorOperativo(false, {
                reposicionarPrimera: false,
                invalidarFijados: false,
                avisar: false
            });
        }

        function programarRefrescoCampoAlVolverVisible_() {
            clearTimeout(refrescoVisibleCampoTimer);
            refrescoVisibleCampoTimer = setTimeout(alVolverVisibleCampo_, 400);
        }

        let servidorOperativoPollTimer = null;
        function iniciarPollServidorOperativo() {
            if (servidorOperativoPollTimer) return;
            servidorOperativoPollTimer = setInterval(() => {
                if (document.visibilityState === 'hidden') return;
                if (!navigator.onLine) return;
                void refrescarEstadoServidorOperativo(false, {
                    reposicionarPrimera: false,
                    invalidarFijados: false,
                    avisar: false
                });
            }, POLL_SERVIDOR_VISIBLE_MS);
        }
        iniciarPollServidorOperativo();
        window.addEventListener('focus', programarRefrescoCampoAlVolverVisible_);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                persistirSoloLocalCampo_();
                void flushDraftCampoAIdb_();
                return;
            }
            programarRefrescoCampoAlVolverVisible_();
        });
        window.addEventListener('pagehide', () => {
            persistirSoloLocalCampo_();
            void flushDraftCampoAIdb_();
        });
        window.addEventListener('freeze', () => {
            persistirSoloLocalCampo_();
            void flushDraftCampoAIdb_();
        });
        window.addEventListener('storage', (e) => {
            if (!e) return;
            if (e.key === SYNC_QUEUE_KEY || e.key === SYNC_HISTORY_KEY) actualizarBarraHeaderEstado();
        });

        function fechaDisplayDdMmYyyy(iso) {
            const p = String(iso || hoyIsoLocal()).split('-');
            if (p.length !== 3) return String(iso || '');
            return `${p[2]}-${p[1]}-${p[0]}`;
        }

        function trazabilidadTextoDesdeMeta(meta) {
            return trazabilidadTextoMostrar(meta);
        }

        /** Hora en PDF como el formato físico (8:32 en lugar de 08:32). */
        function formatoHoraPdf(hora) {
            const s = strOrEmpty(hora);
            if (!s || !s.includes(':')) return s;
            const [h, m] = s.split(':');
            const hh = Number(h);
            if (Number.isNaN(hh)) return s;
            return `${hh}:${String(m || '00').padStart(2, '0')}`;
        }

        function listaJarrasParaPdfLlenado(ensayo, items) {
            const seen = new Set();
            const out = [];
            const agregar = (n) => {
                const num = Number(n);
                if (!Number.isFinite(num) || num <= 0 || seen.has(num)) return;
                seen.add(num);
                out.push(num);
            };
            ordenVisualFilasJarras(obtenerFilasLlenadoJarras(ensayo)).forEach((f) => {
                const r = parseRangoJarraLlenado(f.jarra);
                if (r) {
                    agregar(r.a);
                    agregar(r.b);
                    return;
                }
                agregar(f.jarra);
            });
            items.forEach((it) => agregar(it.jarra));
            return out.sort((a, b) => a - b).slice(0, 6);
        }

        /** Columnas de llenado de jarras: cosecha / traslado alternados (como formato físico). */
        function celdasLlenadoJarraPdf(cRow, tRow, esCosecha, nJarra) {
            if (esCosecha) {
                return {
                    jarraLlenado: String(nJarra),
                    trasladoObs: 'Cosecha',
                    jarraInicio: formatoHoraPdf(cRow?.inicio),
                    jarraTermino: formatoHoraPdf(cRow?.termino),
                    jarraTiempo: cRow ? calcularTiempoEmpleado(cRow.inicio, cRow.termino) : ''
                };
            }
            return {
                jarraLlenado: '-',
                trasladoObs: 'Traslado',
                jarraInicio: formatoHoraPdf(tRow?.inicio),
                jarraTermino: formatoHoraPdf(tRow?.termino),
                jarraTiempo: tRow ? calcularTiempoEmpleado(tRow.inicio, tRow.termino) : ''
            };
        }

        function filaPdfVaciaLlenadoJarras() {
            return {
                nClam: '',
                jarra: '',
                p1: '', p2: '', p3: '', p4: '', p5: '',
                llegada: '', despacho: '',
                tInicioCosecha: '', tPerdida: '', tTermino: '', tLlegada: '', tAcopioCalibrado: '', tTerminoCalibrado: '', tDespacho: '',
                tempInicioAmb: '', tempInicioPul: '', tempTerminoAmb: '', tempTerminoPul: '',
                tempLlegadaAmb: '', tempLlegadaPul: '', tempDespachoAmb: '', tempDespachoPul: '',
                jarraLlenado: '', trasladoObs: '', jarraInicio: '', jarraTermino: '', jarraTiempo: '',
                observacion: ''
            };
        }

        const MAX_CLAMSHELLS_PDF = 8;

        /** Último índice (0-based) con datos; filas posteriores no llevan N° clamshell en PDF. */
        function ultimoIndiceClamshellConDatosPdf_(items) {
            let ultimo = -1;
            (items || []).forEach((item, idx) => {
                if (item && !esClamshellSinDatos_(item)) ultimo = idx;
            });
            return ultimo;
        }

        function acopioSinPesos123EnItem_(item, nClam) {
            if (!item) return true;
            return pesoVacio(peso1EfectivoCampo(item, nClam))
                && pesoVacio(item.p2)
                && pesoVacio(item.acopio);
        }

        /** PDF: " - " / sin jarra → vacío; Acopio además oculta jarra si no hay Pesos 1–3. */
        function jarraNumeroPdfDesdeItem_(item, nClam) {
            if (!item) return '';
            if (jarraVaciaItem_(item.jarra)) return '';
            if (esModoRegistroAcopio_() && acopioSinPesos123EnItem_(item, nClam)) return '';
            return strOrEmpty(item.jarra);
        }

        function filaPdfDesdeItem(item, nClamVisible, incluirTemperatura, nClamIdx) {
            const idx = Number(nClamIdx) || Number(nClamVisible) || 1;
            const m = item?.metric || metricaVacia();
            const t = m.tiempo || {};
            const temp = m.temperatura || {};
            const vacioTemp = {
                tempInicioAmb: '', tempInicioPul: '',
                tempTerminoAmb: '', tempTerminoPul: '',
                tempLlegadaAmb: '', tempLlegadaPul: '',
                tempDespachoAmb: '', tempDespachoPul: ''
            };
            const temps = incluirTemperatura ? {
                tempInicioAmb: strOrEmpty(temp.inicioAmbiente),
                tempInicioPul: strOrEmpty(temp.inicioPulpa),
                tempTerminoAmb: strOrEmpty(temp.terminoAmbiente),
                tempTerminoPul: strOrEmpty(temp.terminoPulpa),
                tempLlegadaAmb: strOrEmpty(temp.llegadaAmbiente),
                tempLlegadaPul: strOrEmpty(temp.llegadaPulpa),
                tempDespachoAmb: strOrEmpty(temp.despachoAmbiente),
                tempDespachoPul: strOrEmpty(temp.despachoPulpa)
            } : vacioTemp;
            return {
                nClam: item && nClamVisible !== '' && nClamVisible != null ? String(nClamVisible) : '',
                jarra: jarraNumeroPdfDesdeItem_(item, idx),
                p1: item ? pesoStrOrEmpty(peso1EfectivoCampo(item, idx)) : '',
                p2: item ? pesoStrOrEmpty(item.p2) : '',
                p3: esModoRegistroAcopio_() && item ? pesoStrOrEmpty(item.acopio) : '',
                p4: esModoRegistroAcopio_() && item ? pesoStrOrEmpty(item.p4) : '',
                p5: esModoRegistroAcopio_() && item ? pesoStrOrEmpty(item.despacho) : '',
                llegada: !esModoRegistroAcopio_() && item ? pesoStrOrEmpty(item.acopio) : '',
                despacho: !esModoRegistroAcopio_() && item ? pesoStrOrEmpty(item.despacho) : '',
                tInicioCosecha: strOrEmpty(t.inicioCosecha),
                tPerdida: esModoRegistroAcopio_() ? '' : strOrEmpty(t.inicioPerdida),
                tTermino: strOrEmpty(t.terminoCosecha),
                tLlegada: strOrEmpty(t.llegadaAcopio),
                tAcopioCalibrado: esModoRegistroAcopio_() ? strOrEmpty(t.acopioCalibrado) : '',
                tTerminoCalibrado: esModoRegistroAcopio_() ? strOrEmpty(t.terminoCalibrado) : '',
                tDespacho: strOrEmpty(t.despachoAcopio),
                ...temps,
                observacion: item ? limitarObservacionClamshell_(item.observacion) : ''
            };
        }

        function guiaAcopioMetaEnsayo_(ensayo) {
            const clave = String(ensayo || '').trim();
            const meta = metaPorEnsayo[clave] || {};
            const em = ensayoMeta[clave] || {};
            const activo = String(obtenerEnsayoActivo() || '').trim();
            if (clave === activo) {
                return strOrEmpty(
                    document.getElementById('visual-guia-acopio')?.value
                    || meta['visual-guia-acopio']
                    || em.guiaRemision
                );
            }
            return strOrEmpty(meta['visual-guia-acopio'] || em.guiaRemision);
        }

        function placaAcopioMetaEnsayo_(ensayo) {
            const clave = String(ensayo || '').trim();
            const meta = metaPorEnsayo[clave] || {};
            const em = ensayoMeta[clave] || {};
            const activo = String(obtenerEnsayoActivo() || '').trim();
            if (clave === activo) {
                return strOrEmpty(
                    document.getElementById('visual-placa-vehiculo')?.value
                    || meta['visual-placa-vehiculo']
                    || em.placaVehiculo
                ).toUpperCase();
            }
            return strOrEmpty(meta['visual-placa-vehiculo'] || em.placaVehiculo).toUpperCase();
        }

        /** PDF Campo: solo muestras con clamshells o control global capturado (no solo meta). */
        function ensayosListosPdfCampo_() {
            return ensayosCandidatosConDatosCampo().filter((e) => ensayoAportaDatosPdfCampo_(e));
        }

        function presionAmbPdfCampo_(temp, hum, presion) {
            if (String(temp || '').trim() === '' || String(hum || '').trim() === '') return '';
            return strOrEmpty(presion);
        }

        function presionFrutaPdfCampo_(pulpa, presion) {
            if (String(pulpa || '').trim() === '') return '';
            return strOrEmpty(presion);
        }

        function limitarObservacionClamshell_(v) {
            return String(v ?? '').trim().slice(0, OBSERVACION_CLAMSHELL_MAX_CHARS);
        }

        function textoObservacionesPiePdfDesdeItems_(items) {
            return (items || []).map((it, idx) => {
                const o = limitarObservacionClamshell_(it?.observacion);
                if (!o) return '';
                return `C${idx + 1}: ${o}`;
            }).filter(Boolean).join(' · ');
        }

        function construirPagina2PdfCampo_(ml, items) {
            const tempL = ml?.temperatura || {};
            const humL = ml?.humedad || {};
            const obsLista = (items || []).map((it) => limitarObservacionClamshell_(it.observacion));
            return {
                humedad: [
                    strOrEmpty(humL.inicio),
                    strOrEmpty(humL.termino),
                    strOrEmpty(humL.llegada),
                    strOrEmpty(humL.despacho)
                ],
                tempAmbiente: [
                    strOrEmpty(tempL.inicioAmbiente),
                    strOrEmpty(tempL.terminoAmbiente),
                    strOrEmpty(tempL.llegadaAmbiente),
                    strOrEmpty(tempL.despachoAmbiente)
                ],
                presionAmb: [
                    presionAmbPdfCampo_(tempL.inicioAmbiente, humL.inicio, tempL.presionAmbienteInicio),
                    presionAmbPdfCampo_(tempL.terminoAmbiente, humL.termino, tempL.presionAmbienteTermino),
                    presionAmbPdfCampo_(tempL.llegadaAmbiente, humL.llegada, tempL.presionAmbienteLlegada),
                    presionAmbPdfCampo_(tempL.despachoAmbiente, humL.despacho, tempL.presionAmbienteDespacho)
                ],
                presionFruta: [
                    presionFrutaPdfCampo_(tempL.inicioPulpa, tempL.presionFrutaInicio),
                    presionFrutaPdfCampo_(tempL.terminoPulpa, tempL.presionFrutaTermino),
                    presionFrutaPdfCampo_(tempL.llegadaPulpa, tempL.presionFrutaLlegada),
                    presionFrutaPdfCampo_(tempL.despachoPulpa, tempL.presionFrutaDespacho)
                ],
                observaciones: textoObservacionesPiePdfDesdeItems_(items),
                observacionesLista: obsLista
            };
        }

        function construirDatosPdfCampoEnsayo_(ensayo) {
            const clave = String(ensayo || 'Ensayo 1');
            sincronizarTiempoPorJarra(clave);
            recalcularPresionesParaEnsayo(clave);
            const meta = { ...(metaPorEnsayo[clave] || {}) };
            const items = data
                .filter((it) => String(it.ensayo || 'Ensayo 1') === clave)
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id));
            const lider = items[0];
            const ml = lider?.metric || metricaVacia();
            const jarrasPdf = listaJarrasParaPdfLlenado(clave, items);
            const ultimoIdxDatos = ultimoIndiceClamshellConDatosPdf_(items);
            const maxRows = 12;
            const filas = [];
            const llenadoVacio = {
                jarraLlenado: '', trasladoObs: '', jarraInicio: '', jarraTermino: '', jarraTiempo: ''
            };
            for (let r = 0; r < maxRows; r++) {
                const item = r < items.length ? items[r] : null;
                const nClamVisible = item && r <= ultimoIdxDatos ? (r + 1) : '';
                const base = r < MAX_CLAMSHELLS_PDF
                    ? filaPdfDesdeItem(item, nClamVisible, r === 0, r + 1)
                    : filaPdfVaciaLlenadoJarras();
                const parIdxJarra = Math.floor(r / 2);
                const esCosechaJarra = r % 2 === 0;
                const nJarra = jarrasPdf[parIdxJarra];
                const llenado = nJarra
                    ? celdasLlenadoJarraPdf(
                        filaCosechaParaJarra(clave, nJarra, -1),
                        filaTrasladoQueAplicaAJarra(clave, nJarra, -1),
                        esCosechaJarra,
                        nJarra
                    )
                    : llenadoVacio;
                filas.push({ ...base, ...llenado });
            }
            return {
                ensayo: clave,
                modoRegistro: esModoRegistroAcopio_() ? 'acopio' : 'visual',
                fecha: fechaDisplayDdMmYyyy(hoyIsoLocal()),
                empresa: 'AGROVISION',
                codigo: codigoPdfCampo_(),
                version: '1',
                tituloHoja1: 'FORMATO MEDICIÓN DE TIEMPOS, TEMPERATURA Y PESOS EN COSECHA ARÁNDANO - C5-C6-A9-LN',
                tituloHoja2: 'FORMATO MEDICIÓN DE TIEMPOS, TEMPERATURA Y PESOS EN COSECHA ARÁNDANO - CS-C6-A9-LN',
                meta: {
                    fecha: fechaDisplayDdMmYyyy(hoyIsoLocal()),
                    fundo: strOrEmpty(meta['visual-meta-fundo'] || meta['meta-fundo']),
                    trazabilidad: trazabilidadTextoDesdeMeta(meta),
                    trazabilidadArchivo: trazabilidadBaseDesdeMeta(meta),
                    responsable: strOrEmpty(meta['visual-responsable']),
                    guiaRemision: guiaAcopioMetaEnsayo_(clave),
                    rotulo: strOrEmpty(meta['visual-rotulo'] || clave),
                    placa: placaAcopioMetaEnsayo_(clave),
                    variedad: strOrEmpty(meta['visual-meta-variedad'] || meta['meta-variedad']),
                    precosecha: strOrEmpty(meta['visual-guia-precosecha']),
                    horaInicio: strOrEmpty(meta['visual-hora']),
                    numMuestra: strOrEmpty(
                        leerNumMuestraDesdePantalla(clave)
                        || calcularNumMuestraDesdeServidorParaEnsayo(clave)
                    )
                },
                filas,
                pagina2: construirPagina2PdfCampo_(ml, items),
                // Pie OBSERVACIONES: por clamshell (no solo observación formato global).
                observacionesFormato: textoObservacionesPiePdfDesdeItems_(items)
                    || limitarObservacionClamshell_(
                        meta['visual-observacion-formato']
                        || document.getElementById('visual-observacion-formato')?.value
                    ),
                horaPesado: ''
            };
        }

        function armarDatosPdfCampoEnsayos_(ensayosLista) {
            const ensayos = (Array.isArray(ensayosLista) ? ensayosLista : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
                .filter((e) => ensayoAportaDatosPdfCampo_(e));
            const muestras = ensayos
                .map((ensayo) => construirDatosPdfCampoEnsayo_(ensayo))
                .filter((m) => muestraPdfCampoTieneContenido_(m));
            return {
                fecha: fechaDisplayDdMmYyyy(hoyIsoLocal()),
                empresa: 'AGROVISION',
                codigo: codigoPdfCampo_(),
                version: '1',
                modoRegistro: esModoRegistroAcopio_() ? 'acopio' : 'visual',
                muestras
            };
        }

        window.obtenerDatosPdfCampo = function obtenerDatosPdfCampo() {
            snapshotMetaEnsayoActual();
            return armarDatosPdfCampoEnsayos_(ensayosListosPdfCampo_());
        };

        window.obtenerDatosPdfCampoParaEnsayos = function obtenerDatosPdfCampoParaEnsayos(ensayosLista) {
            snapshotMetaEnsayoActual();
            return armarDatosPdfCampoEnsayos_(ensayosLista);
        };

