/** UI tipo Packing: card clamshell + modales MP-TK */
(function initMptkUi(global) {
    let hooks = {
        onChange: null,
        recalcPresiones: null,
        toast: null,
        muestraActiva: () => false,
        getVariedad: () => '—',
        getFilasTkServidor: () => 0,
        getCuotaMax: () => 0,
        getLimitePesoIngresoMp: null,
        onCardsChange: null
    };

    let mptkCards = [];
    let mptkActiveCardId = null;
    let mptkCardSeq = 0;

    const elWrap = document.getElementById('mptk-cards-wrap');
    const elPesosModal = document.getElementById('mptk-pesos-modal-overlay');
    const elPesosTitle = document.getElementById('mptk-pesos-modal-title');
    const elTiemposModal = document.getElementById('mptk-tiempos-modal-overlay');
    const elTiemposTitle = document.getElementById('mptk-tiempos-modal-title');
    const elPresAmbModal = document.getElementById('mptk-presion-amb-modal-overlay');
    const elPresAmbTitle = document.getElementById('mptk-presion-amb-modal-title');
    const elPresFrutaModal = document.getElementById('mptk-presion-fruta-modal-overlay');
    const elPresFrutaTitle = document.getElementById('mptk-presion-fruta-modal-title');
    const elObsModal = document.getElementById('mptk-observation-modal-overlay');
    const elObsInput = document.getElementById('mptk-visual-observation');
    const elCtrlModal = document.getElementById('control_global_modal_overlay_mptk');
    const elCtrlTitle = document.getElementById('control_global_modal_title_mptk');
    const elCtrlBody = document.getElementById('control_global_modal_body_mptk');

    const PESO_MODAL = [
        { cardKey: 'ic', key: 'peso_ic_tk', label: 'Ingreso · cámara materia prima (g)', inpId: 'mptk-inp-peso-ic' },
        { cardKey: 'st', key: 'peso_st_tk', label: 'Salida · cámara materia prima (g)', inpId: 'mptk-inp-peso-st' },
        { cardKey: 'it', key: 'peso_it_tk', label: 'Inicio traslado TK. (g)', inpId: 'mptk-inp-peso-it' },
        { cardKey: 'dp', key: 'peso_dp_tk', label: 'Despacho TK. (g)', inpId: 'mptk-inp-peso-dp' }
    ];

    const TIEMPO_MODAL = [
        { cardKey: 'ic', key: 'tiempo_ic_tk', label: 'Ing. · cám. MP', inpId: 'mptk-inp-tiempo-ic' },
        { cardKey: 'st', key: 'tiempo_st_tk', label: 'Sal. · cám. MP', inpId: 'mptk-inp-tiempo-st' },
        { cardKey: 'it', key: 'tiempo_it_tk', label: 'Inicio traslado TK.', inpId: 'mptk-inp-tiempo-it' },
        { cardKey: 'dp', key: 'tiempo_dp_tk', label: 'Despacho TK.', inpId: 'mptk-inp-tiempo-dp' }
    ];

    const MAX_SALTO_HORA_MEDIANOCHE_MIN = 16 * 60;

    const TEMP_MP_FILAS_MPTK = [
        {
            title: 'Ingreso cámara MP (°C)',
            cols: 2,
            campos: [
                { key: 'temp_ic_cm_tk', label: 'T° cámara', aria: 'Ingreso cámara MP · T° cámara' },
                { key: 'temp_ic_pu_tk', label: 'T° pulpa', aria: 'Ingreso cámara MP · T° pulpa' }
            ]
        },
        {
            title: 'Salida cámara MP (°C)',
            cols: 2,
            campos: [
                { key: 'temp_st_cm_tk', label: 'T° cámara', aria: 'Salida cámara MP · T° cámara' },
                { key: 'temp_st_pu_tk', label: 'T° pulpa', aria: 'Salida cámara MP · T° pulpa' }
            ]
        }
    ];

    const TEMP_TK_FILAS_MPTK = [
        {
            title: 'Inicio traslado TK (°C)',
            cols: 3,
            campos: [
                { key: 'temp_it_amb_tk', label: 'Ambiente', aria: 'Inicio traslado · T° ambiente' },
                { key: 'temp_it_veh_tk', label: 'Int. vehículo', aria: 'Inicio traslado · Interior vehículo' },
                { key: 'temp_it_pu_tk', label: 'Pulpa', aria: 'Inicio traslado · T° pulpa' }
            ]
        },
        {
            title: 'Despacho TK (°C)',
            cols: 3,
            campos: [
                { key: 'temp_dp_amb_tk', label: 'Ambiente', aria: 'Despacho · T° ambiente' },
                { key: 'temp_dp_veh_tk', label: 'Int. vehículo', aria: 'Despacho · Interior vehículo' },
                { key: 'temp_dp_pu_tk', label: 'Pulpa', aria: 'Despacho · T° pulpa' }
            ]
        }
    ];

    const TEMP_MODAL = TEMP_MP_FILAS_MPTK.concat(TEMP_TK_FILAS_MPTK).flatMap((f) => f.campos.map((c) => c.key));

    const HUM_FILAS_MPTK = [
        {
            paired: true,
            cols: 2,
            campos: [
                {
                    key: 'hum_ic_tk',
                    columnTitle: 'Ingreso cámara MP (%)',
                    label: 'Humedad relativa',
                    aria: 'Ingreso cámara MP · Humedad relativa'
                },
                {
                    key: 'hum_st_tk',
                    columnTitle: 'Salida cámara MP (%)',
                    label: 'Humedad relativa',
                    aria: 'Salida cámara MP · Humedad relativa'
                }
            ]
        },
        {
            title: 'Inicio traslado TK (%)',
            cols: 2,
            campos: [
                { key: 'hum_aei_tk', label: 'Ambiente', aria: 'Inicio traslado · Ambiente exterior' },
                { key: 'hum_ivi_tk', label: 'Int. vehículo', aria: 'Inicio traslado · Interior vehículo' }
            ]
        },
        {
            title: 'Despacho TK (%)',
            cols: 2,
            campos: [
                { key: 'hum_aed_tk', label: 'Ambiente', aria: 'Despacho · Ambiente exterior' },
                { key: 'hum_ivd_tk', label: 'Int. vehículo', aria: 'Despacho · Interior vehículo' }
            ]
        }
    ];

    const HUM_MODAL = HUM_FILAS_MPTK.flatMap((f) => f.campos.map((c) => c.key));

    const MPTK_MP_PESO_KEYS = ['ic', 'st'];
    const MPTK_TK_PESO_KEYS = ['it', 'dp'];
    const MPTK_MP_TIEMPO_KEYS = ['ic', 'st'];
    const MPTK_TK_TIEMPO_KEYS = ['it', 'dp'];
    const MPTK_MP_TEMP_KEYS = ['temp_ic_cm_tk', 'temp_ic_pu_tk', 'temp_st_cm_tk', 'temp_st_pu_tk'];
    const MPTK_TK_TEMP_KEYS = [
        'temp_it_amb_tk', 'temp_it_veh_tk', 'temp_it_pu_tk',
        'temp_dp_amb_tk', 'temp_dp_veh_tk', 'temp_dp_pu_tk'
    ];
    const MPTK_MP_HUM_KEYS = ['hum_ic_tk', 'hum_st_tk'];
    const MPTK_TK_HUM_KEYS = ['hum_aei_tk', 'hum_ivi_tk', 'hum_aed_tk', 'hum_ivd_tk'];

    function numeroUiLleno_(v) {
        const s = String(v ?? '').trim().replace(',', '.');
        if (!s || s.endsWith('.')) return false;
        const n = Number(s);
        return Number.isFinite(n);
    }

    /** Ruta MP completa, ruta TK completa, ambas, o ninguna válida. */
    function evaluarRutaMpTkMptk_(leer, mpKeys, tkKeys) {
        const mpOk = mpKeys.every((k) => numeroUiLleno_(leer(k)));
        const tkOk = tkKeys.every((k) => numeroUiLleno_(leer(k)));
        const mpVac = mpKeys.every((k) => !numeroUiLleno_(leer(k)));
        const tkVac = tkKeys.every((k) => !numeroUiLleno_(leer(k)));
        if (mpOk && tkVac) return { ok: true, ruta: 'mp' };
        if (tkOk && mpVac) return { ok: true, ruta: 'tk' };
        if (mpOk && tkOk) return { ok: true, ruta: 'ambas' };
        return { ok: false, mpOk, tkOk, mpVac, tkVac };
    }

    function evaluarRutaPesosMptk_(p) {
        const leer = (k) => p?.[k];
        const mpHay = MPTK_MP_PESO_KEYS.some((k) => pesoNum(leer(k)) > 0);
        const tkHay = MPTK_TK_PESO_KEYS.some((k) => pesoNum(leer(k)) > 0);
        const mpOk = MPTK_MP_PESO_KEYS.every((k) => pesoNum(leer(k)) > 0);
        const tkOk = MPTK_TK_PESO_KEYS.every((k) => pesoNum(leer(k)) > 0);
        const mpVac = MPTK_MP_PESO_KEYS.every((k) => pesoNum(leer(k)) <= 0);
        const tkVac = MPTK_TK_PESO_KEYS.every((k) => pesoNum(leer(k)) <= 0);
        const meta = { mpOk, tkOk, mpVac, tkVac, mpHay, tkHay };
        if (mpOk && tkVac) return { ok: true, ruta: 'mp', ...meta };
        if (tkOk && mpVac) return { ok: true, ruta: 'tk', ...meta };
        if (mpOk && tkOk) return { ok: true, ruta: 'ambas', ...meta };
        return { ok: false, ...meta };
    }

    function evaluarRutaTiemposMptk_(t) {
        const leer = (k) => String(t?.[k] || '').trim();
        const mpOk = MPTK_MP_TIEMPO_KEYS.every((k) => horaValidaUi(leer(k)));
        const tkOk = MPTK_TK_TIEMPO_KEYS.every((k) => horaValidaUi(leer(k)));
        const mpVac = MPTK_MP_TIEMPO_KEYS.every((k) => !leer(k));
        const tkVac = MPTK_TK_TIEMPO_KEYS.every((k) => !leer(k));
        const meta = { mpOk, tkOk, mpVac, tkVac };
        if (mpOk && tkVac) return { ok: true, ruta: 'mp', ...meta };
        if (tkOk && mpVac) return { ok: true, ruta: 'tk', ...meta };
        if (mpOk && tkOk) return { ok: true, ruta: 'ambas', ...meta };
        return { ok: false, ...meta };
    }

    function grupoTieneDataNumericaMptk_(leer, keys) {
        return keys.some((k) => numeroUiLleno_(leer(k)));
    }

    function grupoCompletoNumericoMptk_(leer, keys) {
        return keys.every((k) => numeroUiLleno_(leer(k)));
    }

    /** Coherencia entre pesos, tiempos, T° y HR — solo al enviar registro. */
    function validarCoherenciaRutasEnvioMptk_(estado, cards) {
        const errores = [];
        const campos = estado?.campos || {};
        const leer = (id) => campos[id];
        const lista = Array.isArray(cards) ? cards : [];
        const cardTiemposRef = lista.slice().sort((a, b) => Number(a.clamshellNum) - Number(b.clamshellNum))[0];
        const tiempos = cardTiemposRef?.tiempos || {};

        const mpPesos = lista.some((c) => MPTK_MP_PESO_KEYS.some((k) => pesoNum(c.pesos?.[k]) > 0));
        const tkPesos = lista.some((c) => MPTK_TK_PESO_KEYS.some((k) => pesoNum(c.pesos?.[k]) > 0));
        const mpTemp = grupoTieneDataNumericaMptk_(leer, MPTK_MP_TEMP_KEYS);
        const tkTemp = grupoTieneDataNumericaMptk_(leer, MPTK_TK_TEMP_KEYS);
        const mpHum = grupoTieneDataNumericaMptk_(leer, MPTK_MP_HUM_KEYS);
        const tkHum = grupoTieneDataNumericaMptk_(leer, MPTK_TK_HUM_KEYS);

        const mpActiva = mpPesos || mpTemp || mpHum;
        const tkActiva = tkPesos || tkTemp || tkHum;

        if (mpTemp && !grupoCompletoNumericoMptk_(leer, MPTK_MP_HUM_KEYS)) {
            errores.push('Si registras temperatura cámara MP, completa humedad cámara MP (Ing. y Sal.).');
        }
        if (mpHum && !grupoCompletoNumericoMptk_(leer, MPTK_MP_TEMP_KEYS)) {
            errores.push('Si registras humedad cámara MP, completa temperatura cámara MP (4 campos).');
        }
        if (tkTemp && !grupoCompletoNumericoMptk_(leer, MPTK_TK_HUM_KEYS)) {
            errores.push('Si registras temperatura traslado/despacho TK, completa humedad traslado/despacho TK.');
        }
        if (tkHum && !grupoCompletoNumericoMptk_(leer, MPTK_TK_TEMP_KEYS)) {
            errores.push('Si registras humedad traslado/despacho TK, completa temperatura traslado TK (6 campos).');
        }

        if (mpActiva) {
            if (!grupoCompletoNumericoMptk_(leer, MPTK_MP_TEMP_KEYS)) {
                errores.push('Completa temperatura cámara MP (Ing. y Sal. · cámara y pulpa).');
            }
            if (!grupoCompletoNumericoMptk_(leer, MPTK_MP_HUM_KEYS)) {
                errores.push('Completa humedad cámara MP (Ing. y Sal.).');
            }
            if (!evaluarRutaTiemposMptk_(tiempos).mpOk) {
                errores.push('Completa tiempos cámara MP (Ing. y Sal.) — deben coincidir con la ruta MP.');
            }
            lista.forEach((c) => {
                const n = c.clamshellNum || '';
                if (!evaluarRutaPesosMptk_(c.pesos || {}).mpOk) {
                    errores.push('Thermo-King #' + n + ': completa pesos cámara MP (Ing. y Sal.).');
                }
            });
        }

        if (tkActiva) {
            if (!grupoCompletoNumericoMptk_(leer, MPTK_TK_TEMP_KEYS)) {
                errores.push('Completa temperatura traslado/despacho TK (6 campos).');
            }
            if (!grupoCompletoNumericoMptk_(leer, MPTK_TK_HUM_KEYS)) {
                errores.push('Completa humedad traslado/despacho TK (4 campos).');
            }
            if (!evaluarRutaTiemposMptk_(tiempos).tkOk) {
                errores.push('Completa tiempos traslado/despacho TK (Inicio y Despacho).');
            }
            lista.forEach((c) => {
                const n = c.clamshellNum || '';
                if (!evaluarRutaPesosMptk_(c.pesos || {}).tkOk) {
                    errores.push('Thermo-King #' + n + ': completa pesos traslado/despacho TK (Inicio y Despacho).');
                }
            });
        }

        if (!mpActiva && !tkActiva) {
            errores.push('Registra datos en cámara MP o en traslado/despacho TK.');
        }

        return [...new Set(errores)];
    }

    const PRES_AMB_FILAS_MPTK = [
        {
            paired: true,
            cols: 2,
            campos: [
                {
                    key: 'pres_ic_tk',
                    columnTitle: 'Ingreso cámara MP (Kpa)',
                    aria: 'Ingreso cámara MP · Presión vapor ambiente'
                },
                {
                    key: 'pres_st_tk',
                    columnTitle: 'Salida cámara MP (Kpa)',
                    aria: 'Salida cámara MP · Presión vapor ambiente'
                }
            ]
        },
        {
            title: 'Inicio traslado TK (Kpa)',
            cols: 2,
            campos: [
                { key: 'pres_aei_tk', label: 'Ambiente', aria: 'Inicio traslado · Ambiente exterior' },
                { key: 'pres_ivi_tk', label: 'Int. vehículo', aria: 'Inicio traslado · Interior vehículo' }
            ]
        },
        {
            title: 'Despacho TK (Kpa)',
            cols: 2,
            campos: [
                { key: 'pres_aed_tk', label: 'Ambiente', aria: 'Despacho · Ambiente exterior' },
                { key: 'pres_ivd_tk', label: 'Int. vehículo', aria: 'Despacho · Interior vehículo' }
            ]
        }
    ];

    const PRES_AMB_MODAL = PRES_AMB_FILAS_MPTK.flatMap((f) => f.campos.map((c) => c.key));

    const PRES_FRUTA_TIEMPO_CAMPOS = [
        { key: 'vapor_ic_tk', label: 'Ingreso · cámara materia prima (Kpa)', inpId: 'mptk-inp-vapor-ic' },
        { key: 'vapor_scm_tk', label: 'Salida · cámara materia prima (Kpa)', inpId: 'mptk-inp-vapor-st' },
        { key: 'vapor_it_tk', label: 'Inicio traslado TK. (Kpa)', inpId: 'mptk-inp-vapor-it' },
        { key: 'vapor_st_tk', label: 'Despacho TK. (Kpa)', inpId: 'mptk-inp-vapor-dp' }
    ];

    const PRES_FRUTA_MODAL = PRES_FRUTA_TIEMPO_CAMPOS.map((c) => c.key);

    function val(id) {
        const el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    }

    function setVal(id, v) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = v == null ? '' : String(v);
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function pesoNum(v) {
        const n = Number(String(v || '').replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    }

    function pesoVacio(v) {
        return pesoNum(v) <= 0;
    }

    function textoPeso(v) {
        if (pesoVacio(v)) return '00';
        const n = pesoNum(v);
        return (Math.round(n * 10) / 10) + 'g';
    }

    function clasePeso(v, base) {
        return (base || 'weight-value') + (pesoVacio(v) ? ' is-empty-peso' : '');
    }

    function textoHoraCard(v) {
        const s = String(v || '').trim();
        return s || '—';
    }

    function contarLlenos(keys) {
        return keys.filter((k) => val(k) !== '').length;
    }

    function pesosVaciosMptk_() {
        return { ic: '', st: '', it: '', dp: '' };
    }

    function tiemposVaciosMptk_() {
        return { ic: '', st: '', it: '', dp: '' };
    }

    function crearCardMptk_(num) {
        return {
            id: ++mptkCardSeq,
            clamshellNum: num,
            pesos: pesosVaciosMptk_(),
            tiempos: tiemposVaciosMptk_(),
            observacion: ''
        };
    }

    function getCardMptkById_(id) {
        return mptkCards.find((c) => Number(c.id) === Number(id)) || null;
    }

    function getActiveCardMptk_() {
        return getCardMptkById_(mptkActiveCardId) || mptkCards[0] || null;
    }

    function ultimoCardMptk_() {
        if (!mptkCards.length) return null;
        return mptkCards.reduce((a, b) => (
            Number(a.clamshellNum) >= Number(b.clamshellNum) ? a : b
        ));
    }

    function esUltimoCardMptk_(card) {
        const ultimo = ultimoCardMptk_();
        return !!(ultimo && card && Number(card.id) === Number(ultimo.id));
    }

    function syncCardToFormMptk_(card) {
        if (!card) return;
        PESO_MODAL.forEach((m) => setVal(m.key, card.pesos[m.cardKey] || ''));
        TIEMPO_MODAL.forEach((m) => setVal(m.key, card.tiempos[m.cardKey] || ''));
        setVal('observacion_tk', card.observacion || '');
    }

    function syncFormToCardMptk_(card) {
        if (!card) return;
        PESO_MODAL.forEach((m) => {
            card.pesos[m.cardKey] = val(m.key);
        });
        TIEMPO_MODAL.forEach((m) => {
            card.tiempos[m.cardKey] = val(m.key);
        });
        card.observacion = val('observacion_tk');
    }

    function setActiveCardMptk_(cardId) {
        const prev = getActiveCardMptk_();
        if (prev && Number(prev.id) !== Number(cardId)) syncFormToCardMptk_(prev);
        mptkActiveCardId = cardId;
        syncCardToFormMptk_(getActiveCardMptk_());
    }

    function notifyChange() {
        if (typeof hooks.onChange === 'function') hooks.onChange();
        if (typeof hooks.onCardsChange === 'function') hooks.onCardsChange();
    }

    function notificarPdfVivoMptk_() {
        window.PdfPreviewLive?.programar?.();
    }

    function toastUi(icon, title, text) {
        if (typeof hooks.toast === 'function') hooks.toast(icon, title, text);
    }

    function horaValidaUi(v) {
        return /^\d{1,2}:\d{2}$/.test(String(v || '').trim());
    }

    function minutosDesdeHoraMptk_(hora) {
        if (!hora) return null;
        const [h, m] = String(hora).split(':').map(Number);
        if ([h, m].some((x) => Number.isNaN(x))) return null;
        return (h * 60) + m;
    }

    /** true si la hora posterior es inválida (no avanza). Acepta cruce de medianoche como Packing. */
    function horaMenorQueMptk_(anterior, posterior) {
        const minAnt = minutosDesdeHoraMptk_(anterior);
        const minPost = minutosDesdeHoraMptk_(posterior);
        if (minAnt === null || minPost === null) return false;
        if (minPost >= minAnt) return false;
        const saltoAdelante = (24 * 60 - minAnt) + minPost;
        return saltoAdelante > MAX_SALTO_HORA_MEDIANOCHE_MIN;
    }

    function leerHoraSalidaFrioMptk_() {
        return String(document.getElementById('hora_salida_frio_tk')?.value || '').trim();
    }

    function obtenerTiemposDesdeModalMptk_() {
        const read = (id) => String(document.getElementById(id)?.value || '').trim();
        return {
            horaSalidaFrio: leerHoraSalidaFrioMptk_(),
            ic: read('mptk-inp-tiempo-ic'),
            st: read('mptk-inp-tiempo-st'),
            it: read('mptk-inp-tiempo-it'),
            dp: read('mptk-inp-tiempo-dp')
        };
    }

    function leerPesosModalMptk_() {
        const read = (id) => String(document.getElementById(id)?.value || '').trim();
        return {
            ic: read('mptk-inp-peso-ic'),
            st: read('mptk-inp-peso-st'),
            it: read('mptk-inp-peso-it'),
            dp: read('mptk-inp-peso-dp')
        };
    }

    function pesoSuperaLimiteMptk_(valor, limite) {
        const v = pesoNum(valor);
        const l = pesoNum(limite);
        if (l <= 0) return false;
        return v > l + 0.001;
    }

    function getLimitePesoIngresoMpMptk_(clamshellNum) {
        if (typeof hooks.getLimitePesoIngresoMp === 'function') {
            return hooks.getLimitePesoIngresoMp(clamshellNum);
        }
        return null;
    }

    /** Solo coherencia entre campos ya capturados (guardado progresivo en modales). */
    function validarSecuenciaPesosProgresivoMptk_(p) {
        const ic = pesoNum(p?.ic);
        const st = pesoNum(p?.st);
        const it = pesoNum(p?.it);
        const dp = pesoNum(p?.dp);
        const errores = [];
        const tol = 0.001;
        if (st > 0 && ic > 0 && st > ic + tol) {
            errores.push('Sal. cám. MP: debe ser igual o menor que Ing. cám. MP.');
        }
        if (dp > 0 && it > 0 && dp > it + tol) {
            errores.push('Despacho TK.: debe ser igual o menor que Inicio traslado TK.');
        }
        if (it > 0 && st > 0 && it > st + tol) {
            errores.push('Inicio traslado TK.: debe ser igual o menor que Sal. cám. MP.');
        }
        if (st > 0 && ic <= 0) {
            errores.push('Completa Ing. cám. MP antes de Sal. cám. MP.');
        }
        if (dp > 0 && it <= 0) {
            errores.push('Completa Inicio traslado TK. antes de Despacho TK.');
        }
        return errores;
    }

    /** Ruta MP o TK completa — solo al enviar registro. */
    function validarSecuenciaPesosMptk_(p) {
        const ic = pesoNum(p?.ic);
        const st = pesoNum(p?.st);
        const it = pesoNum(p?.it);
        const dp = pesoNum(p?.dp);
        const errores = [];
        const tol = 0.001;
        const ruta = evaluarRutaPesosMptk_(p);

        if (!ruta.ok) {
            if (!ruta.mpHay && !ruta.tkHay) {
                errores.push('Completa pesos de cámara MP o de traslado/despacho TK.');
            } else {
                if (ruta.mpHay && !ruta.mpOk) {
                    if (ic <= 0) errores.push('Completa Ing. cám. MP.');
                    if (st <= 0) errores.push('Completa Sal. cám. MP.');
                }
                if (ruta.tkHay && !ruta.tkOk) {
                    if (it <= 0) errores.push('Completa Inicio traslado TK.');
                    if (dp <= 0) errores.push('Completa Despacho TK.');
                }
            }
            return errores;
        }

        if (ruta.mpOk && st > ic + tol) {
            errores.push('Sal. cám. MP: debe ser igual o menor que Ing. cám. MP.');
        }
        if (ruta.tkOk && dp > it + tol) {
            errores.push('Despacho TK.: debe ser igual o menor que Inicio traslado TK.');
        }
        if (ruta.ruta === 'ambas' && it > 0 && st > 0 && it > st + tol) {
            errores.push('Inicio traslado TK.: debe ser igual o menor que Sal. cám. MP.');
        }
        return errores;
    }

    function validarLimitePrefrioPackingMptk_(p, clamshellNum, errores) {
        const limite = getLimitePesoIngresoMpMptk_(clamshellNum);
        if (limite == null) return;
        const ic = pesoNum(p?.ic);
        const it = pesoNum(p?.it);
        if (ic > 0 && pesoSuperaLimiteMptk_(ic, limite)) {
            errores.unshift('Ing. cám. MP no puede superar el peso salida prefrío packing (' + limite + 'g).');
            return;
        }
        if (ic <= 0 && it > 0 && pesoSuperaLimiteMptk_(it, limite)) {
            errores.unshift('Inicio traslado TK. no puede superar el peso salida prefrío packing (' + limite + 'g).');
        }
    }

    function validarSecuenciaPesosConCardMptk_(p, clamshellNum, opts) {
        const estricto = opts?.estricto === true;
        const errores = estricto
            ? validarSecuenciaPesosMptk_(p)
            : validarSecuenciaPesosProgresivoMptk_(p);
        validarLimitePrefrioPackingMptk_(p, clamshellNum, errores);
        return errores;
    }

    function validarSecuenciaPesosEstrictoMptk_(p, clamshellNum) {
        return validarSecuenciaPesosConCardMptk_(p, clamshellNum, { estricto: true });
    }

    function validarPesosModalMptkEnVivo() {
        const alertEl = document.getElementById('mptk-pesos-alert');
        const btnGuardar = document.getElementById('mptk-pesos-guardar');
        const card = getActiveCardMptk_();
        const errores = validarSecuenciaPesosConCardMptk_(leerPesosModalMptk_(), card?.clamshellNum);
        if (alertEl) {
            if (errores.length) {
                alertEl.textContent = errores[0];
                alertEl.style.display = 'block';
            } else {
                alertEl.textContent = '';
                alertEl.style.display = 'none';
            }
        }
        if (btnGuardar) btnGuardar.disabled = errores.length > 0;
        return errores;
    }

    function limpiarAlertaPesosMptk_() {
        const alertEl = document.getElementById('mptk-pesos-alert');
        if (alertEl) {
            alertEl.textContent = '';
            alertEl.style.display = 'none';
        }
        const btnGuardar = document.getElementById('mptk-pesos-guardar');
        if (btnGuardar) btnGuardar.disabled = false;
    }

    function validarSecuenciaTiemposProgresivoMptk_(t) {
        const errores = [];
        const horaSalidaFrio = String(t.horaSalidaFrio || '').trim();
        const etapasFrio = [
            ['ic', 'Ing. cám. MP'],
            ['st', 'Sal. cám. MP'],
            ['it', 'Inicio traslado TK.'],
            ['dp', 'Despacho TK.']
        ];
        if (horaSalidaFrio) {
            etapasFrio.forEach(([key, lbl]) => {
                const h = String(t[key] || '').trim();
                if (h && horaMenorQueMptk_(horaSalidaFrio, h)) {
                    errores.push(lbl + ': debe ser igual o posterior a hora salida frío.');
                }
            });
        }
        const pares = [
            ['ic', 'st', 'Sal. cám. MP', 'Ing. cám. MP'],
            ['st', 'it', 'Inicio traslado TK.', 'Sal. cám. MP'],
            ['it', 'dp', 'Despacho TK.', 'Inicio traslado TK.']
        ];
        pares.forEach(([prevKey, key, lbl, prevLbl]) => {
            const ant = t[prevKey];
            const post = t[key];
            if (ant && post && horaMenorQueMptk_(ant, post)) {
                errores.push(lbl + ': debe ser igual o posterior a ' + prevLbl + '.');
            }
        });
        return errores;
    }

    /** Ruta MP o TK completa — solo al enviar registro. */
    function validarSecuenciaTiemposMptk_(t) {
        const errores = [];
        const horaSalidaFrio = String(t.horaSalidaFrio || '').trim();
        const ruta = evaluarRutaTiemposMptk_(t);

        if (!ruta.ok) {
            errores.push('Completa tiempos de cámara MP (2) o de traslado/despacho TK (2).');
            return errores;
        }

        const etapasFrio = [
            ['ic', 'Ing. cám. MP'],
            ['st', 'Sal. cám. MP'],
            ['it', 'Inicio traslado TK.'],
            ['dp', 'Despacho TK.']
        ];
        if (horaSalidaFrio) {
            etapasFrio.forEach(([key, lbl]) => {
                const h = String(t[key] || '').trim();
                if (h && horaMenorQueMptk_(horaSalidaFrio, h)) {
                    errores.push(lbl + ': debe ser igual o posterior a hora salida frío.');
                }
            });
        }
        const pares = [
            ['ic', 'st', 'Sal. cám. MP', 'Ing. cám. MP'],
            ['it', 'dp', 'Despacho TK.', 'Inicio traslado TK.']
        ];
        if (ruta.mpOk || ruta.ruta === 'ambas') {
            const ant = t.ic;
            const post = t.st;
            if (ant && post && horaMenorQueMptk_(ant, post)) {
                errores.push('Sal. cám. MP: debe ser igual o posterior a Ing. cám. MP.');
            }
        }
        if (ruta.tkOk || ruta.ruta === 'ambas') {
            const ant = t.it;
            const post = t.dp;
            if (ant && post && horaMenorQueMptk_(ant, post)) {
                errores.push('Despacho TK.: debe ser igual o posterior a Inicio traslado TK.');
            }
        }
        if (ruta.ruta === 'ambas') {
            const ant = t.st;
            const post = t.it;
            if (ant && post && horaMenorQueMptk_(ant, post)) {
                errores.push('Inicio traslado TK.: debe ser igual o posterior a Sal. cám. MP.');
            }
        }
        return errores;
    }

    function validarTiemposModalMptkEnVivo() {
        const alertEl = document.getElementById('mptk-tiempos-alert');
        const btnGuardar = document.getElementById('mptk-tiempos-guardar');
        const errores = validarSecuenciaTiemposProgresivoMptk_(obtenerTiemposDesdeModalMptk_());
        if (alertEl) {
            if (errores.length) {
                alertEl.textContent = errores[0];
                alertEl.style.display = 'block';
            } else {
                alertEl.textContent = '';
                alertEl.style.display = 'none';
            }
        }
        if (btnGuardar) btnGuardar.disabled = errores.length > 0;
        return errores;
    }

    function limpiarAlertaTiemposMptk_() {
        const alertEl = document.getElementById('mptk-tiempos-alert');
        if (alertEl) {
            alertEl.textContent = '';
            alertEl.style.display = 'none';
        }
        const btnGuardar = document.getElementById('mptk-tiempos-guardar');
        if (btnGuardar) btnGuardar.disabled = false;
    }

    function crearIconos() {
        if (global.lucide?.createIcons) global.lucide.createIcons();
    }

    function mostrarModal(el) {
        if (!el) return;
        el.style.display = 'flex';
        el.setAttribute('aria-hidden', 'false');
    }

    function ocultarModal(el) {
        if (!el) return;
        const focused = el.querySelector(':focus');
        if (focused && typeof focused.blur === 'function') focused.blur();
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
    }

    function bindDismiss(overlay, closeFn) {
        if (!overlay || overlay.dataset.dismissBound === '1') return;
        overlay.dataset.dismissBound = '1';
        overlay.addEventListener('click', (e) => {
            const panel = overlay.querySelector('.modal-content, .time-picker-modal');
            if (panel && panel.contains(e.target)) return;
            closeFn();
        });
    }

    function htmlMetricActions(card, isPrimary) {
        const refT = primerCardMptk_()?.tiempos || card.tiempos || tiemposVaciosMptk_();
        const tN = TIEMPO_MODAL.filter((m) => String(refT[m.cardKey] || '').trim()).length;
        const tiempoTitle = isPrimary ? 'Tiempos de la muestra' : 'Ver tiempos de la muestra';
        const readonlyAttr = isPrimary ? '' : ' data-tiempos-readonly="1"';
        const aN = contarLlenos(PRES_AMB_MODAL);
        const fN = contarLlenos(PRES_FRUTA_MODAL);
        const countIdT = isPrimary ? ' id="mptk-metric-tiempo-count"' : '';
        const countClsT = isPrimary ? '' : ' mptk-metric-tiempo-count-mirror';
        const countIdA = isPrimary ? ' id="mptk-metric-presion-amb-count"' : '';
        const countClsA = isPrimary ? '' : ' mptk-metric-presion-amb-count-mirror';
        const countIdF = isPrimary ? ' id="mptk-metric-presion-fruta-count"' : '';
        const countClsF = isPrimary ? '' : ' mptk-metric-presion-fruta-count-mirror';
        return '<div class="metric-actions">'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn mptk-metric-tiempo-open-btn" type="button" data-card-id="' + card.id + '"' + readonlyAttr
            + ' title="' + tiempoTitle + '" aria-label="' + tiempoTitle + '">'
            + '<i data-lucide="timer"></i></button>'
            + '<span class="metric-count' + countClsT + '"' + countIdT + '>' + tN + '/4</span></div>'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn mptk-metric-presion-amb-btn" type="button" data-card-id="' + card.id + '" title="Presión ambiente calculada (6) — no es humedad" aria-label="Presión ambiente calculada">'
            + '<i data-lucide="cloud"></i></button>'
            + '<span class="metric-count' + countClsA + '"' + countIdA + ' title="Presión ambiente (6 campos calculados)">' + aN + '/6</span></div>'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn mptk-metric-presion-fruta-btn" type="button" data-card-id="' + card.id + '" title="Presión fruta calculada (4) — T° pulpa" aria-label="Presión fruta calculada">'
            + '<i data-lucide="apple"></i></button>'
            + '<span class="metric-count' + countClsF + '"' + countIdF + '>' + fN + '/4</span></div>'
            + '</div>';
    }

    function esCardMptkSinDatos_(card) {
        if (!card) return false;
        const p = card.pesos || pesosVaciosMptk_();
        if (Object.values(p).some((v) => pesoNum(v) > 0)) return false;
        const t = card.tiempos || tiemposVaciosMptk_();
        if (Object.values(t).some((v) => String(v || '').trim())) return false;
        return !String(card.observacion || '').trim();
    }

    function primerCardVacioMptk_() {
        return mptkCards.find((c) => esCardMptkSinDatos_(c)) || null;
    }

    function crearElementoCardMptk_(card, index) {
        const p = card.pesos || pesosVaciosMptk_();
        const obs = String(card.observacion || '').trim();
        const obsHtml = obs ? esc(obs) : '';
        const variedad = hooks.getVariedad();
        const ultimo = ultimoCardMptk_();
        const esUltimo = ultimo && Number(ultimo.id) === Number(card.id);
        const canDelete = mptkCards.length > 1 && esUltimo;
        const tituloDelete = canDelete
            ? 'Eliminar Thermo-King #' + card.clamshellNum
            : (mptkCards.length <= 1
                ? 'Debe quedar al menos uno'
                : 'Elimina primero el #' + (ultimo?.clamshellNum || ''));
        const art = document.createElement('article');
        art.className = 'clamshell-card packing-clamshell-card packing-card-clickable mptk-clamshell-card';
        art.dataset.cardId = String(card.id);
        art.setAttribute('aria-label', 'Thermo-King ' + card.clamshellNum);
        art.tabIndex = 0;
        art.innerHTML = ''
            + '<div class="card-header">'
            + '<div class="id-badge">'
            + '<div class="number-box packing-clamshell-num">' + card.clamshellNum + '</div>'
            + '<div class="packing-card-title-block">'
            + '<p class="packing-card-title">Thermo-King</p>'
            + '<span class="packing-card-sub">Variedad: ' + esc(variedad) + '</span>'
            + '</div></div>'
            + '<div class="clamshell-header-actions">'
            + '<button type="button" class="clamshell-delete-btn mptk-card-delete" data-card-id="' + card.id + '" '
            + (canDelete ? '' : 'disabled ')
            + 'title="' + esc(tituloDelete) + '" aria-label="Eliminar">'
            + '<i data-lucide="trash-2"></i></button></div></div>'
            + '<div class="weights-panel"><div class="weights-grid packing-weights-grid">'
            + '<div class="weight-box"><label>ING. CÁM. MP</label><span class="' + clasePeso(p.ic) + '">' + textoPeso(p.ic) + '</span></div>'
            + '<div class="weight-box"><label>SAL. CÁM. MP</label><span class="' + clasePeso(p.st) + '">' + textoPeso(p.st) + '</span></div>'
            + '<div class="observation-box"><button type="button" class="mptk-observation-btn" data-card-id="' + card.id + '" title="Editar observación">'
            + '<span class="observation-text' + (obs ? '' : ' is-empty') + '">'
            + (obsHtml || 'Sin observación registrada') + '</span></button></div>'
            + '</div>' + htmlMetricActions(card, index === 0) + '</div>'
            + '<div class="logistics-info packing-prefrio-row">'
            + '<div class="logistic-point"><i data-lucide="calendar-check-2"></i><div>'
            + '<p style="color: #94A3B8; font-size: 9px;">PESO INI. TRASLADO TK</p><b class="' + (pesoVacio(p.it) ? 'is-empty-peso' : '') + '">' + textoPeso(p.it) + '</b></div></div>'
            + '<div class="logistic-point"><i data-lucide="truck"></i><div>'
            + '<p style="color: #94A3B8; font-size: 9px;">PESO DESPACHO TK</p><b class="' + (pesoVacio(p.dp) ? 'is-empty-peso' : '') + '">' + textoPeso(p.dp) + '</b></div></div>'
            + '</div>';
        return art;
    }

    function crearCardPreview() {
        const preview = crearCardMptk_(1);
        const art = crearElementoCardMptk_(preview, 0);
        art.classList.add('packing-card-preview');
        art.classList.remove('packing-card-clickable');
        art.removeAttribute('tabindex');
        art.removeAttribute('data-card-id');
        return art;
    }

    function render(opts) {
        if (!elWrap) return;
        const skipFormToCard = opts?.skipFormToCard === true;
        const prevActive = getActiveCardMptk_();
        if (prevActive && !skipFormToCard) syncFormToCardMptk_(prevActive);
        elWrap.innerHTML = '';
        if (!hooks.muestraActiva()) {
            mptkCards = [];
            mptkActiveCardId = null;
            elWrap.appendChild(crearCardPreview());
        } else if (!mptkCards.length) {
            elWrap.appendChild(crearCardPreview());
        } else {
            mptkCards.forEach((card, index) => {
                elWrap.appendChild(crearElementoCardMptk_(card, index));
            });
            if (mptkActiveCardId && getCardMptkById_(mptkActiveCardId)) {
                syncCardToFormMptk_(getActiveCardMptk_());
            }
        }
        const disabled = elWrap.classList.contains('is-disabled');
        elWrap.querySelectorAll('.mptk-metric-tiempo-open-btn, .mptk-metric-presion-amb-btn, .mptk-metric-presion-fruta-btn, .mptk-observation-btn').forEach((btn) => {
            btn.disabled = disabled;
            if (!disabled && btn.classList.contains('mptk-metric-tiempo-open-btn')) {
                btn.title = btn.hasAttribute('data-tiempos-readonly')
                    ? 'Ver tiempos de la muestra'
                    : 'Tiempos de la muestra';
            }
        });
        crearIconos();
    }

    function reiniciarCardsMptk_(startNum) {
        const num = Number(startNum) > 0 ? Number(startNum) : 1;
        const prevActive = getActiveCardMptk_();
        if (prevActive) syncFormToCardMptk_(prevActive);
        const card = crearCardMptk_(num);
        mptkCards = [card];
        mptkActiveCardId = card.id;
        render({ skipFormToCard: true });
        syncCardToFormMptk_(card);
    }

    function resetCardsMptk_() {
        mptkCardSeq = 0;
        mptkCards = [];
        mptkActiveCardId = null;
        render();
    }

    function agregarCardMptk_() {
        if (!hooks.muestraActiva()) return null;
        const filasSrv = Number(hooks.getFilasTkServidor?.() || 0);
        const max = Number(hooks.getCuotaMax?.() || 0);
        if (max > 0 && filasSrv + mptkCards.length >= max) return null;
        const prevActive = getActiveCardMptk_();
        if (prevActive) syncFormToCardMptk_(prevActive);
        const num = filasSrv + mptkCards.length + 1;
        const card = crearCardMptk_(num);
        const refTiempos = primerCardMptk_();
        if (refTiempos && refTiempos.id !== card.id) {
            card.tiempos = { ...tiemposVaciosMptk_(), ...refTiempos.tiempos };
        }
        mptkCards.push(card);
        mptkActiveCardId = card.id;
        render({ skipFormToCard: true });
        syncCardToFormMptk_(card);
        notifyChange();
        return card;
    }

    function agregarCardMptkYAbrirPesos_() {
        let card = primerCardVacioMptk_();
        if (!card) {
            if (!mptkCards.length) {
                reiniciarCardsMptk_(Number(hooks.getFilasTkServidor?.() || 0) + 1);
                card = mptkCards[0] || null;
            } else {
                card = agregarCardMptk_();
            }
        }
        if (!card) return;
        setActiveCardMptk_(card.id);
        abrirModalPesos();
    }

    function eliminarCardMptk_(cardId) {
        if (mptkCards.length <= 1) {
            toastUi('info', 'No se puede eliminar', 'Debe quedar al menos un Thermo-King en la muestra.');
            return;
        }
        const card = getCardMptkById_(cardId);
        if (!card || !esUltimoCardMptk_(card)) return;
        mptkCards = mptkCards.filter((c) => Number(c.id) !== Number(cardId));
        if (!getCardMptkById_(mptkActiveCardId)) {
            mptkActiveCardId = mptkCards[mptkCards.length - 1]?.id ?? null;
        }
        render();
        notifyChange();
        notificarPdfVivoMptk_();
    }

    function abrirModalPesos() {
        if (!hooks.muestraActiva() || !elPesosModal) return;
        const card = getActiveCardMptk_();
        if (!card) return;
        if (elPesosTitle) elPesosTitle.textContent = 'Editar Thermo-King #' + card.clamshellNum;
        PESO_MODAL.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            if (inp) inp.value = card.pesos[c.cardKey] || '';
        });
        mostrarModal(elPesosModal);
        validarPesosModalMptkEnVivo();
    }

    function cerrarModalPesosMptk_() {
        limpiarAlertaPesosMptk_();
        ocultarModal(elPesosModal);
    }

    function guardarModalPesos() {
        const card = getActiveCardMptk_();
        if (!card) return;
        const errores = validarPesosModalMptkEnVivo();
        if (errores.length) {
            toastUi('warning', 'Peso inválido', errores[0]);
            return;
        }
        PESO_MODAL.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            if (inp) card.pesos[c.cardKey] = String(inp.value || '').trim();
        });
        syncCardToFormMptk_(card);
        cerrarModalPesosMptk_();
        render({ skipFormToCard: true });
        notifyChange();
        notificarPdfVivoMptk_();
        toastUi('success', 'Guardado', 'Pesos Thermo-King actualizados.');
    }

    let tiemposModalBackupMptk_ = [];
    let tiemposModalSoloLecturaMptk_ = false;

    function primerCardMptk_() {
        return mptkCards[0] || null;
    }

    function propagarTiemposATodosMptk_(tiempos) {
        const src = tiempos || tiemposVaciosMptk_();
        const copia = {
            ic: String(src.ic || '').trim(),
            st: String(src.st || '').trim(),
            it: String(src.it || '').trim(),
            dp: String(src.dp || '').trim()
        };
        mptkCards.forEach((c) => { c.tiempos = { ...copia }; });
    }

    function setTiemposModalSoloLecturaMptk_(soloLectura) {
        tiemposModalSoloLecturaMptk_ = !!soloLectura;
        if (elTiemposModal) elTiemposModal.classList.toggle('is-readonly-view', soloLectura);
        const btnGuardar = document.getElementById('mptk-tiempos-guardar');
        if (btnGuardar) {
            btnGuardar.hidden = soloLectura;
            btnGuardar.disabled = soloLectura;
        }
        if (soloLectura) limpiarAlertaTiemposMptk_();
    }

    function aplicarTiemposModalVistaLecturaMptk_() {
        TIEMPO_MODAL.forEach((c, i) => {
            const inp = document.getElementById(c.inpId);
            if (!inp) return;
            const raw = String(tiemposModalBackupMptk_[i] ?? inp.value ?? '').trim();
            inp.readOnly = true;
            inp.disabled = true;
            inp.dataset.tiemposNoPicker = '1';
            inp.classList.add('packing-tiempo-inp--view');
            if (!raw) {
                inp.value = '--:--';
                inp.classList.add('is-empty-time-display');
            } else {
                inp.value = raw;
                inp.classList.remove('is-empty-time-display');
            }
        });
    }

    function limpiarTiemposModalVistaLecturaMptk_() {
        TIEMPO_MODAL.forEach((c, i) => {
            const inp = document.getElementById(c.inpId);
            if (!inp) return;
            inp.readOnly = false;
            inp.disabled = false;
            delete inp.dataset.tiemposNoPicker;
            inp.classList.remove('packing-tiempo-inp--view', 'is-empty-time-display');
            inp.value = tiemposModalBackupMptk_[i] || '';
        });
    }

    function abrirModalTiempos(opts) {
        if (!hooks.muestraActiva() || !elTiemposModal) return;
        const refCard = primerCardMptk_();
        if (!refCard) return;
        const soloLectura = !!(opts && opts.soloLectura);
        const displayNum = Number(getActiveCardMptk_()?.clamshellNum) || Number(refCard.clamshellNum) || 1;
        tiemposModalBackupMptk_ = TIEMPO_MODAL.map((c) => String(refCard.tiempos[c.cardKey] || '').trim());
        setTiemposModalSoloLecturaMptk_(soloLectura);
        if (elTiemposTitle) {
            elTiemposTitle.textContent = 'Tiempos · Thermo-King #' + displayNum
                + (soloLectura ? ' · solo lectura' : '');
        }
        TIEMPO_MODAL.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            if (inp) inp.value = refCard.tiempos[c.cardKey] || '';
        });
        if (soloLectura) {
            aplicarTiemposModalVistaLecturaMptk_();
        } else {
            limpiarTiemposModalVistaLecturaMptk_();
            if (window.CustomTimePicker && typeof window.CustomTimePicker.init === 'function') {
                window.CustomTimePicker.init(elTiemposModal);
            }
        }
        mostrarModal(elTiemposModal);
        if (!soloLectura) validarTiemposModalMptkEnVivo();
    }

    function guardarModalTiempos() {
        if (tiemposModalSoloLecturaMptk_) return;
        const refCard = primerCardMptk_();
        if (!refCard) return;
        const errores = validarTiemposModalMptkEnVivo();
        if (errores.length) {
            toastUi('warning', 'Horario inválido', errores[0]);
            return;
        }
        TIEMPO_MODAL.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            if (inp) refCard.tiempos[c.cardKey] = String(inp.value || '').trim();
        });
        propagarTiemposATodosMptk_(refCard.tiempos);
        syncCardToFormMptk_(getActiveCardMptk_());
        cerrarModalTiemposMptk_();
        render({ skipFormToCard: true });
        notifyChange();
        toastUi('success', 'Tiempos guardados', 'Los tiempos aplican a todos los Thermo-King.');
    }

    function abrirModalPresionAmb() {
        if (!hooks.muestraActiva() || !elPresAmbModal) return;
        const card = getActiveCardMptk_();
        if (card) syncCardToFormMptk_(card);
        if (typeof hooks.recalcPresiones === 'function') hooks.recalcPresiones();
        if (elPresAmbTitle) {
            elPresAmbTitle.textContent = 'Presión de vapor ambiente (Kpa) · TK #' + (card?.clamshellNum || 1);
        }
        const body = document.getElementById('mptk_presion_amb_modal_body');
        if (body) body.innerHTML = htmlGridPresionAmbMptk_();
        mostrarModal(elPresAmbModal);
    }

    function guardarModalPresionAmb() {
        ocultarModal(elPresAmbModal);
    }

    function abrirModalPresionFruta() {
        if (!hooks.muestraActiva() || !elPresFrutaModal) return;
        const card = getActiveCardMptk_();
        if (card) syncCardToFormMptk_(card);
        if (typeof hooks.recalcPresiones === 'function') hooks.recalcPresiones();
        if (elPresFrutaTitle) {
            elPresFrutaTitle.textContent = 'Presión de vapor fruta (Kpa) · TK #' + (card?.clamshellNum || 1);
        }
        PRES_FRUTA_TIEMPO_CAMPOS.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            if (inp) inp.value = val(c.key);
        });
        mostrarModal(elPresFrutaModal);
    }

    function guardarModalPresionFruta() {
        ocultarModal(elPresFrutaModal);
    }

    function abrirModalObs() {
        if (!hooks.muestraActiva() || !elObsModal) return;
        const card = getActiveCardMptk_();
        if (!card) return;
        if (elObsInput) elObsInput.value = card.observacion || '';
        mostrarModal(elObsModal);
    }

    function guardarModalObs() {
        const card = getActiveCardMptk_();
        if (!card) return;
        if (elObsInput) card.observacion = String(elObsInput.value || '').trim();
        syncCardToFormMptk_(card);
        ocultarModal(elObsModal);
        render({ skipFormToCard: true });
        notifyChange();
        toastUi('success', 'Guardado', 'Observación actualizada.');
    }

    function celdaPresionReadonlyPairedMptk_(campo) {
        const raw = String(val(campo.key) || '').trim();
        const v = esc(raw);
        const valAttr = raw ? (' value="' + v + '"') : '';
        const aria = campo.aria || campo.columnTitle || '';
        return '<div class="mptk-control-paired-col">'
            + '<p class="mptk-temp-muestra-section-title">' + esc(campo.columnTitle || '') + '</p>'
            + '<div class="form-group mptk-control-paired-inp">'
            + '<input type="text" class="mptk-presion-readonly-inp presion-readonly-inp" data-field="' + campo.key + '"' + valAttr
            + ' disabled readonly inputmode="none" aria-label="' + esc(aria) + '">'
            + '</div></div>';
    }

    function celdaPresionReadonlyMptk_(campo, usarLabelCompleto) {
        const raw = String(val(campo.key) || '').trim();
        const v = esc(raw);
        const valAttr = raw ? (' value="' + v + '"') : '';
        const lbl = usarLabelCompleto ? campo.label : (campo.shortLabel || campo.label);
        const aria = campo.aria || campo.label;
        return '<div class="form-group"><label>' + esc(lbl) + '</label>'
            + '<input type="text" class="mptk-presion-readonly-inp presion-readonly-inp" data-field="' + campo.key + '"' + valAttr
            + ' disabled readonly inputmode="none" aria-label="' + esc(aria) + '">'
            + '</div>';
    }

    function htmlFilaPresionEtapaMptk_(fila) {
        if (fila.paired) {
            const cols = fila.cols || fila.campos.length;
            const celdas = fila.campos.map((c) => celdaPresionReadonlyPairedMptk_(c)).join('');
            return '<section class="mptk-temp-muestra-section mptk-temp-muestra-section--paired">'
                + '<div class="mptk-temp-muestra-grid packing-cg-grid-' + cols + ' mptk-control-paired-row">' + celdas + '</div>'
                + '</section>';
        }
        const cols = fila.cols || fila.campos.length;
        const gridCls = cols === 1 ? 'mptk-control-row-single' : ('packing-cg-grid-' + cols);
        const celdas = fila.campos.map((c) => celdaPresionReadonlyMptk_(c, false)).join('');
        return '<section class="mptk-temp-muestra-section">'
            + '<p class="mptk-temp-muestra-section-title">' + esc(fila.title) + '</p>'
            + '<div class="mptk-temp-muestra-grid ' + gridCls + '">' + celdas + '</div>'
            + '</section>';
    }

    function htmlFilasPresionMptk_(filas) {
        return '<div class="mptk-temp-muestra-wrap">'
            + filas.map((f) => htmlFilaPresionEtapaMptk_(f)).join('')
            + '</div>';
    }

    function celdaCampoMptk_(campo, inputClass, usarLabelCompleto) {
        const v = esc(val(campo.key));
        const lbl = usarLabelCompleto ? campo.label : (campo.shortLabel || campo.label);
        const aria = campo.aria || campo.label;
        return '<div class="form-group"><label>' + esc(lbl) + '</label>'
            + '<input type="text" class="packing-cg-inp control-equitativo-inp ' + esc(inputClass) + '" data-field="' + campo.key + '" value="' + v + '" inputmode="decimal" enterkeyhint="done" maxlength="4" aria-label="' + esc(aria) + '">'
            + '</div>';
    }

    function celdaColumnaPairedMptk_(campo, inputClass) {
        const v = esc(val(campo.key));
        const aria = campo.aria || campo.columnTitle || campo.label || '';
        return '<div class="mptk-control-paired-col">'
            + '<p class="mptk-temp-muestra-section-title">' + esc(campo.columnTitle || '') + '</p>'
            + '<div class="form-group mptk-control-paired-inp">'
            + '<input type="text" class="packing-cg-inp control-equitativo-inp ' + esc(inputClass) + '" data-field="' + campo.key + '" value="' + v + '" inputmode="decimal" enterkeyhint="done" maxlength="4" aria-label="' + esc(aria) + '">'
            + '</div></div>';
    }

    /** Igual que Packing/Campo: solo dígitos y un punto decimal (ej. 11.2). */
    function sanitizarValorControlGlobalMptk_(raw, opts) {
        const isDeleting = Boolean(opts && opts.isDeleting);
        let v = String(raw ?? '').replace(',', '.').replace(/[^\d.]/g, '');
        const firstDot = v.indexOf('.');
        if (firstDot >= 0) {
            v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
            const parts = v.split('.');
            v = parts[0].slice(0, 2) + '.' + (parts[1] || '').slice(0, 1);
        } else {
            v = v.slice(0, 3);
            if (!isDeleting && v.length >= 2) {
                const ent = v.slice(0, 2);
                const dec = v.slice(2, 3);
                v = dec ? ent + '.' + dec : ent + '.';
            }
        }
        return v;
    }

    function normalizarValorControlGlobalMptk_(raw) {
        const live = sanitizarValorControlGlobalMptk_(raw);
        if (!live) return '';
        if (live.includes('.')) return live;
        if (live.length >= 3) return live.slice(0, 2) + '.' + live.slice(2, 3);
        return live;
    }

    function formatearInputControlGlobalMptk_(input, final, opts) {
        if (!input) return;
        const normalizado = final
            ? normalizarValorControlGlobalMptk_(input.value)
            : sanitizarValorControlGlobalMptk_(input.value, opts);
        if (input.value !== normalizado) input.value = normalizado;
    }

    function colorPrimaryControlEquitativo_() {
        try {
            return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || 'rgb(22, 76, 124)';
        } catch (_) {
            return 'rgb(22, 76, 124)';
        }
    }

    function reforzarEstiloControlEquitativoInp_(input) {
        if (!input || !input.classList.contains('control-equitativo-inp')) return;
        const c = colorPrimaryControlEquitativo_();
        input.style.setProperty('color', c, 'important');
        input.style.setProperty('-webkit-text-fill-color', c, 'important');
        input.style.setProperty('font-weight', '700', 'important');
        input.style.setProperty('text-align', 'center', 'important');
    }

    function enlazarInputsControlMptk_(root) {
        const scope = root || elCtrlBody;
        if (!scope) return;
        scope.querySelectorAll('.packing-cg-inp').forEach((input) => {
            input.classList.add('control-equitativo-inp');
            formatearInputControlGlobalMptk_(input, true);
            reforzarEstiloControlEquitativoInp_(input);
            input.addEventListener('input', (ev) => {
                const inputType = String(ev?.inputType || '');
                formatearInputControlGlobalMptk_(input, false, { isDeleting: inputType.includes('delete') });
                reforzarEstiloControlEquitativoInp_(input);
            });
            input.addEventListener('change', () => {
                formatearInputControlGlobalMptk_(input, true);
                reforzarEstiloControlEquitativoInp_(input);
            });
            input.addEventListener('paste', () => {
                setTimeout(() => reforzarEstiloControlEquitativoInp_(input), 0);
            });
            input.addEventListener('focus', () => reforzarEstiloControlEquitativoInp_(input));
            input.addEventListener('blur', () => reforzarEstiloControlEquitativoInp_(input));
            input.addEventListener('animationstart', (ev) => {
                if (ev.animationName === 'controlEquitativoAutofillFix') {
                    reforzarEstiloControlEquitativoInp_(input);
                }
            });
        });
    }

    function htmlFilaControlEtapaMptk_(fila, inputClass) {
        if (fila.paired) {
            const cols = fila.cols || fila.campos.length;
            const celdas = fila.campos.map((c) => celdaColumnaPairedMptk_(c, inputClass)).join('');
            return '<section class="mptk-temp-muestra-section mptk-temp-muestra-section--paired">'
                + '<div class="mptk-temp-muestra-grid packing-cg-grid-' + cols + ' mptk-control-paired-row">' + celdas + '</div>'
                + '</section>';
        }
        const cols = fila.cols || fila.campos.length;
        const gridCls = cols === 1 ? 'mptk-control-row-single' : ('packing-cg-grid-' + cols);
        const celdas = fila.campos.map((c) => celdaCampoMptk_(c, inputClass, false)).join('');
        return '<section class="mptk-temp-muestra-section">'
            + '<p class="mptk-temp-muestra-section-title">' + esc(fila.title) + '</p>'
            + '<div class="mptk-temp-muestra-grid ' + gridCls + '">' + celdas + '</div>'
            + '</section>';
    }

    function htmlFilasControlMptk_(filas, inputClass) {
        return '<div class="mptk-temp-muestra-wrap">'
            + filas.map((f) => htmlFilaControlEtapaMptk_(f, inputClass)).join('')
            + '</div>';
    }

    function htmlGridTempMpMuestra_() {
        return htmlFilasControlMptk_(TEMP_MP_FILAS_MPTK, 'mptk-control-inp');
    }

    function htmlGridTempTkMuestra_() {
        return htmlFilasControlMptk_(TEMP_TK_FILAS_MPTK, 'mptk-control-inp');
    }

    function htmlGridHumMuestra_() {
        return htmlFilasControlMptk_(HUM_FILAS_MPTK, 'mptk-control-inp');
    }

    function htmlGridPresionAmbMptk_() {
        return htmlFilasPresionMptk_(PRES_AMB_FILAS_MPTK);
    }

    function abrirModalControl(tipo) {
        if (!hooks.muestraActiva() || !elCtrlModal || !elCtrlBody) return;
        if (elCtrlTitle) {
            if (tipo === 'temperatura-mp') {
                elCtrlTitle.textContent = 'Control equitativo T. cámara MP';
            } else if (tipo === 'temperatura-tk') {
                elCtrlTitle.textContent = 'Control equitativo T. traslado TK';
            } else {
                elCtrlTitle.textContent = 'Control equitativo · Humedad';
            }
        }
        elCtrlBody.innerHTML = tipo === 'temperatura-mp'
            ? htmlGridTempMpMuestra_()
            : (tipo === 'temperatura-tk'
                ? htmlGridTempTkMuestra_()
                : htmlGridHumMuestra_());
        elCtrlBody.dataset.ctrlTipo = tipo;
        enlazarInputsControlMptk_(elCtrlBody);
        mostrarModal(elCtrlModal);
    }

    function guardarModalControl() {
        if (!elCtrlBody) return;
        const tipo = elCtrlBody.dataset.ctrlTipo;
        elCtrlBody.querySelectorAll('.packing-cg-inp').forEach((inp) => {
            formatearInputControlGlobalMptk_(inp, true);
        });
        const incompleto = [...elCtrlBody.querySelectorAll('input')]
            .some((inp) => String(inp.value || '').trim().endsWith('.'));
        if (incompleto) {
            toastUi('warning', 'Decimal incompleto', 'Ejemplo: 11.2 (no 11.).');
            return;
        }
        elCtrlBody.querySelectorAll('.packing-cg-inp').forEach((inp) => {
            const k = inp.getAttribute('data-field');
            if (k) setVal(k, inp.value);
        });
        ocultarModal(elCtrlModal);
        render();
        notifyChange();
        const msg = tipo === 'temperatura-mp'
            ? 'Temperatura cámara MP actualizada.'
            : (tipo === 'temperatura-tk'
                ? 'Temperatura traslado TK actualizada.'
                : 'Humedad actualizada.');
        toastUi('success', 'Guardado', msg);
    }

    function cerrarModalTiemposMptk_() {
        limpiarAlertaTiemposMptk_();
        setTiemposModalSoloLecturaMptk_(false);
        limpiarTiemposModalVistaLecturaMptk_();
        ocultarModal(elTiemposModal);
    }

    function bindEvents() {
        document.getElementById('mptk-pesos-cancel')?.addEventListener('click', cerrarModalPesosMptk_);
        document.getElementById('mptk-pesos-guardar')?.addEventListener('click', guardarModalPesos);
        document.getElementById('mptk-tiempos-cancel')?.addEventListener('click', cerrarModalTiemposMptk_);
        document.getElementById('mptk-tiempos-guardar')?.addEventListener('click', guardarModalTiempos);
        document.getElementById('mptk-presion-amb-cancel')?.addEventListener('click', () => ocultarModal(elPresAmbModal));
        document.getElementById('mptk-presion-amb-guardar')?.addEventListener('click', guardarModalPresionAmb);
        document.getElementById('mptk-presion-fruta-cancel')?.addEventListener('click', () => ocultarModal(elPresFrutaModal));
        document.getElementById('mptk-presion-fruta-guardar')?.addEventListener('click', guardarModalPresionFruta);
        document.getElementById('mptk-observation-cancel')?.addEventListener('click', () => ocultarModal(elObsModal));
        document.getElementById('mptk-observation-guardar')?.addEventListener('click', guardarModalObs);
        document.getElementById('btn_cancel_control_global_mptk')?.addEventListener('click', () => ocultarModal(elCtrlModal));
        document.getElementById('btn_save_control_global_mptk')?.addEventListener('click', guardarModalControl);

        bindDismiss(elPesosModal, cerrarModalPesosMptk_);
        bindDismiss(elTiemposModal, cerrarModalTiemposMptk_);
        bindDismiss(elPresAmbModal, () => ocultarModal(elPresAmbModal));
        bindDismiss(elPresFrutaModal, () => ocultarModal(elPresFrutaModal));
        bindDismiss(elObsModal, () => ocultarModal(elObsModal));
        bindDismiss(elCtrlModal, () => ocultarModal(elCtrlModal));

        document.getElementById('btn_temp_mp_mptk')?.addEventListener('click', () => abrirModalControl('temperatura-mp'));
        document.getElementById('btn_temp_tk_mptk')?.addEventListener('click', () => abrirModalControl('temperatura-tk'));
        document.getElementById('btn_hum_mptk')?.addEventListener('click', () => abrirModalControl('humedad'));

        elWrap?.addEventListener('click', (ev) => {
            if (elWrap.classList.contains('is-disabled')) return;
            const deleteBtn = ev.target.closest('.mptk-card-delete');
            if (deleteBtn && !deleteBtn.disabled) {
                ev.stopPropagation();
                const cardId = deleteBtn.getAttribute('data-card-id');
                if (cardId) eliminarCardMptk_(cardId);
                return;
            }
            const cardEl = ev.target.closest('.mptk-clamshell-card');
            const cardId = cardEl?.dataset?.cardId;
            if (cardId) setActiveCardMptk_(Number(cardId));
            if (ev.target.closest('.mptk-observation-btn')) {
                ev.stopPropagation();
                abrirModalObs();
                return;
            }
            if (ev.target.closest('.mptk-metric-tiempo-open-btn')) {
                ev.stopPropagation();
                const tiempoBtn = ev.target.closest('.mptk-metric-tiempo-open-btn');
                abrirModalTiempos({ soloLectura: tiempoBtn?.hasAttribute('data-tiempos-readonly') });
                return;
            }
            if (ev.target.closest('.mptk-metric-presion-amb-btn')) {
                ev.stopPropagation();
                abrirModalPresionAmb();
                return;
            }
            if (ev.target.closest('.mptk-metric-presion-fruta-btn')) {
                ev.stopPropagation();
                abrirModalPresionFruta();
                return;
            }
            if (cardEl) abrirModalPesos();
        });

        const onTiempoInputMptk = () => {
            if (elTiemposModal?.style.display === 'flex') validarTiemposModalMptkEnVivo();
        };
        TIEMPO_MODAL.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            inp?.addEventListener('input', onTiempoInputMptk);
            inp?.addEventListener('change', onTiempoInputMptk);
        });
        PESO_MODAL.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            inp?.addEventListener('input', validarPesosModalMptkEnVivo);
            inp?.addEventListener('change', validarPesosModalMptkEnVivo);
        });
    }

    function cardSinDatosMptk_() {
        return primerCardVacioMptk_() != null;
    }

    function getCardsCountMptk_() {
        return mptkCards.length;
    }

    function exportCardsStateMptk_() {
        const active = getActiveCardMptk_();
        if (active) syncFormToCardMptk_(active);
        return mptkCards.map((c) => ({
            id: c.id,
            clamshellNum: c.clamshellNum,
            pesos: { ...c.pesos },
            tiempos: { ...c.tiempos },
            observacion: c.observacion || ''
        }));
    }

    function importCardsStateMptk_(cards, activeId) {
        if (!Array.isArray(cards) || !cards.length) {
            resetCardsMptk_();
            return;
        }
        mptkCards = cards.map((c) => ({
            id: Number(c.id) || ++mptkCardSeq,
            clamshellNum: Number(c.clamshellNum) || 1,
            pesos: { ...pesosVaciosMptk_(), ...(c.pesos || {}) },
            tiempos: { ...tiemposVaciosMptk_(), ...(c.tiempos || {}) },
            observacion: String(c.observacion || '')
        }));
        mptkCardSeq = mptkCards.reduce((m, c) => Math.max(m, Number(c.id) || 0), mptkCardSeq);
        mptkActiveCardId = activeId && getCardMptkById_(activeId)
            ? activeId
            : (mptkCards[0]?.id ?? null);
        propagarTiemposATodosMptk_(primerCardMptk_()?.tiempos);
        const active = getActiveCardMptk_();
        if (active) syncCardToFormMptk_(active);
        render({ skipFormToCard: true });
        notifyChange();
    }

    function buildThermokingArraysMptk_() {
        const active = getActiveCardMptk_();
        if (active) syncFormToCardMptk_(active);
        const sorted = mptkCards.slice().sort((a, b) => Number(a.clamshellNum) - Number(b.clamshellNum));
        return {
            thermoking_tiempos: sorted.map((c) => ({
                ic: c.tiempos.ic || '',
                st: c.tiempos.st || '',
                it: c.tiempos.it || '',
                dp: c.tiempos.dp || ''
            })),
            thermoking_peso: sorted.map((c) => ({
                ic: c.pesos.ic || '',
                st: c.pesos.st || '',
                it: c.pesos.it || '',
                dp: c.pesos.dp || ''
            })),
            thermoking_obs: sorted.map((c) => ({
                observacion: c.observacion || ''
            }))
        };
    }

    function modalMptkAbierto_(el) {
        return !!(el && el.style.display === 'flex');
    }

    function persistirModalesAbiertasMptk_() {
        if (modalMptkAbierto_(elPesosModal)) {
            const card = getActiveCardMptk_();
            if (card) {
                PESO_MODAL.forEach((c) => {
                    const inp = document.getElementById(c.inpId);
                    if (inp) card.pesos[c.cardKey] = String(inp.value || '').trim();
                });
                syncCardToFormMptk_(card);
            }
        }
        if (modalMptkAbierto_(elTiemposModal) && !tiemposModalSoloLecturaMptk_) {
            const refCard = primerCardMptk_();
            if (refCard) {
                TIEMPO_MODAL.forEach((c) => {
                    const inp = document.getElementById(c.inpId);
                    if (inp) refCard.tiempos[c.cardKey] = String(inp.value || '').trim();
                });
                propagarTiemposATodosMptk_(refCard.tiempos);
                syncCardToFormMptk_(getActiveCardMptk_());
            }
        }
        if (modalMptkAbierto_(elCtrlModal) && elCtrlBody) {
            elCtrlBody.querySelectorAll('.packing-cg-inp').forEach((inp) => {
                formatearInputControlGlobalMptk_(inp, true);
            });
            elCtrlBody.querySelectorAll('.packing-cg-inp').forEach((inp) => {
                const k = inp.getAttribute('data-field');
                if (k) setVal(k, inp.value);
            });
        }
        if (modalMptkAbierto_(elObsModal)) {
            const card = getActiveCardMptk_();
            if (card && elObsInput) {
                card.observacion = String(elObsInput.value || '').trim();
                syncCardToFormMptk_(card);
            }
        }
        if (modalMptkAbierto_(document.getElementById('mptk-placa-modal-overlay'))) {
            const inp = document.getElementById('mptk-placa-inp');
            const dest = document.getElementById('placa_thermoking_tk');
            if (inp && dest) dest.value = String(inp.value || '').trim().toUpperCase();
        }
    }

    global.MptkUi = {
        init(opts) {
            hooks = { ...hooks, ...(opts || {}) };
            bindEvents();
            render();
        },
        render,
        abrirModalPesos,
        abrirModalTiempos,
        agregarCardYAbrirPesos: agregarCardMptkYAbrirPesos_,
        reiniciarCards: reiniciarCardsMptk_,
        resetCards: resetCardsMptk_,
        getCardsCount: getCardsCountMptk_,
        cardSinDatos: cardSinDatosMptk_,
        exportCardsState: exportCardsStateMptk_,
        importCardsState: importCardsStateMptk_,
        buildThermokingArrays: buildThermokingArraysMptk_,
        validarSecuenciaTiempos: validarSecuenciaTiemposMptk_,
        validarSecuenciaPesos: validarSecuenciaPesosEstrictoMptk_,
        evaluarRutaMpTk: evaluarRutaMpTkMptk_,
        evaluarRutaPesos: evaluarRutaPesosMptk_,
        evaluarRutaTiempos: evaluarRutaTiemposMptk_,
        validarCoherenciaRutasEnvio: validarCoherenciaRutasEnvioMptk_,
        mpTempKeys: () => MPTK_MP_TEMP_KEYS.slice(),
        tkTempKeys: () => MPTK_TK_TEMP_KEYS.slice(),
        mpHumKeys: () => MPTK_MP_HUM_KEYS.slice(),
        tkHumKeys: () => MPTK_TK_HUM_KEYS.slice(),
        revalidarTiemposModalEnVivo: validarTiemposModalMptkEnVivo,
        persistirModalesAbiertas: persistirModalesAbiertasMptk_,
        resetPreview() {
            render();
        }
    };
})(window);
