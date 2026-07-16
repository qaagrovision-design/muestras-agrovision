/** TK-2.0: 2 cards (Llegada + Traslado), grilla fija de 8 pesos. */
(function initTk20Body() {
    const F = window.Tk20Fields;
    const elMain = document.getElementById('tk20-main');

    const ETAPAS = [
        {
            key: 'llegada',
            wrapId: 'tk20-cards-llegada',
            title: 'Llegada Fruta Acopio',
            pesosModalPrefix: 'Pesos · Llegada Fruta Acopio',
            obsModalPrefix: 'Observación · Llegada Fruta Acopio',
            metricPrimary: false
        },
        {
            key: 'traslado',
            wrapId: 'packing-cards-wrap',
            title: 'Inicio de traslado',
            pesosModalPrefix: 'Pesos · Inicio de traslado',
            obsModalPrefix: 'Observación · Inicio de traslado',
            metricPrimary: true
        }
    ];

    let tk20VariedadHtml = 'Variedad: —';
    let tk20ActiveEtapa = 'traslado';
    let tk20ActiveCardId = 1;
    let tk20ActivePesoKey = '';
    let tk20RegistroCompleto = false;

    const stateByEtapa = Object.fromEntries(ETAPAS.map((cfg) => [cfg.key, {
        cardSeq: 0,
        card: null
    }]));

    function cfgEtapa(key) {
        return ETAPAS.find((e) => e.key === key) || ETAPAS[1];
    }

    function elWrapEtapa(key) {
        return document.getElementById(cfgEtapa(key).wrapId);
    }

    function pesosVisuales(etapaKey) {
        return window.Tk20Pesos?.pesosVisuales?.(etapaKey) || [];
    }

    function pesoNumero(val) {
        const n = Number(val);
        return Number.isFinite(n) ? n : 0;
    }

    function horaLocalAhora() {
        const d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':'
            + String(d.getMinutes()).padStart(2, '0');
    }

    function crearCardEtapa(etapaKey) {
        const st = stateByEtapa[etapaKey];
        return {
            etapa: etapaKey,
            id: ++st.cardSeq,
            pesos: window.Tk20Pesos?.pesosVacios?.(etapaKey) || {},
            presion: F?.presionVaciosEtapa?.(etapaKey) || {},
            observacion: '',
            horaRegistro: horaLocalAhora()
        };
    }

    function getEtapaCard(etapaKey) {
        return stateByEtapa[etapaKey]?.card || null;
    }

    function pesoDisplayVacio(g) {
        return pesoNumero(g) <= 0;
    }

    function textoPesoCard(g) {
        if (pesoDisplayVacio(g)) return '00';
        const n = pesoNumero(g);
        return (Math.round(n * 10) / 10) + 'g';
    }

    function clasePesoCard(g, base) {
        return (base || 'weight-value') + (pesoDisplayVacio(g) ? ' is-empty-peso' : '');
    }

    function escHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function textoVariedadDesdeDetalle(d) {
        const v = String(d?.VARIEDAD || '').trim();
        let html = v ? ('Variedad: ' + escHtml(v)) : 'Variedad: —';
        if (tk20RegistroCompleto) html += ' · <span class="tk20-completo-tag">completo</span>';
        return html;
    }

    function registroCompletoEnServidor(d) {
        if (!d) return false;
        if (d.tieneTk20 === true) return true;
        return false;
    }

    function formatoHora12Partes(hhmm) {
        const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return { h: '--:', minFirst: '-', minLast: '-', ampm: '' };
        let h = Number(m[1]);
        const ampm = h >= 12 ? 'pm' : 'am';
        h = h % 12 || 12;
        const min = m[2];
        return { h: h + ':', minFirst: min[0], minLast: min[1], ampm };
    }

    function htmlCaraHora(hhmm) {
        const p = formatoHora12Partes(hhmm);
        return '<span class="tk20-metric-hora-face" aria-hidden="true">'
            + '<span class="tk20-metric-hora-h">' + escHtml(p.h) + '</span>'
            + '<span class="tk20-metric-hora-min-first">' + escHtml(p.minFirst) + '</span>'
            + '<span class="tk20-metric-hora-min-last">' + escHtml(p.minLast)
            + '<span class="tk20-metric-hora-ampm">' + escHtml(p.ampm) + '</span></span>'
            + '</span>';
    }

    function actualizarCaraHora(inp) {
        const shell = inp?.closest('.tk20-metric-hora-shell');
        if (!shell) return;
        const cara = shell.querySelector('.tk20-metric-hora-face');
        if (!cara) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlCaraHora(inp.value);
        const nueva = tmp.firstElementChild;
        if (nueva) cara.replaceWith(nueva);
    }

    function conteoPresionCard(card, etapaKey) {
        const campos = F?.presionVaporCampos?.(etapaKey) || [];
        const total = campos.length || 4;
        let n = 0;
        campos.forEach((c) => {
            if (String(card?.presion?.[c.key] || '').trim()) n++;
        });
        return { n, total };
    }

    function conteoPesosCard(card, etapaKey) {
        const total = F?.getNumPesosEfectivos?.() || F?.NUM_CLAMSHELLS || 8;
        let done = 0;
        for (let i = 1; i <= total; i++) {
            const key = F?.peso?.(etapaKey, i);
            if (key && !pesoDisplayVacio(card?.pesos?.[key])) done++;
        }
        return { done, total, rest: Math.max(0, total - done) };
    }

    function htmlBotonContadorPesos(card, etapaKey, cardId, opts) {
        const preview = opts?.preview === true;
        const registroOn = !preview && window.Tk20Envio?.isRegistroHabilitado?.() === true;
        const { rest, total } = conteoPesosCard(card, etapaKey);
        const btnId = etapaKey === 'llegada'
            ? 'tk20-llegada-pesos-contador'
            : 'tk20-traslado-pesos-contador';
        const cls = 'tk20-pesos-contador-btn' + (rest === 0 ? ' is-complete' : ' is-pending');
        const disabledAttr = !registroOn ? ' disabled' : '';
        const title = rest === 0
            ? (total + ' pesos completos — tocar para editar')
            : ('Faltan ' + rest + ' de ' + total + ' pesos — tocar para capturar');
        return '<button type="button" class="' + cls + '" id="' + btnId + '"'
            + ' data-tk20-etapa="' + etapaKey + '" data-card-id="' + cardId + '"'
            + disabledAttr
            + ' title="' + escHtml(title) + '"'
            + ' aria-label="' + escHtml(title) + '">'
            + String(rest) + '</button>';
    }

    function textoConteoPresion(card, etapaKey) {
        const c = conteoPresionCard(card, etapaKey);
        return c.n + '/' + c.total;
    }

    function htmlMetricActions(card, etapaCfg, opts) {
        const horaVal = String(card.horaRegistro || '').trim() || horaLocalAhora();
        const horaName = F?.horaEtapa?.(etapaCfg.key) || ('tk2_' + etapaCfg.key + '_hora');
        const horaId = horaName;
        const presionCountId = etapaCfg.key === 'llegada'
            ? ' id="tk2_llegada_presion_count"'
            : ' id="tk2_traslado_presion_count"';
        const presionCount = textoConteoPresion(card, etapaCfg.key);
        const presionFilled = conteoPresionCard(card, etapaCfg.key).n > 0 ? ' is-filled' : '';
        return '<div class="metric-actions">'
            + '<div class="metric-btn-wrap tk20-metric-hora-wrap">'
            + '<div class="tk20-metric-hora-shell">'
            + '<input class="tk20-card-hora-inp packing-hora-inicio-inp"'
            + ' type="time" id="' + escHtml(horaId) + '" name="' + escHtml(horaName) + '"'
            + ' data-field="' + escHtml(horaName) + '" data-card-id="' + card.id + '"'
            + ' data-tk20-etapa="' + etapaCfg.key + '"'
            + ' value="' + escHtml(horaVal) + '"'
            + ' enterkeyhint="done" aria-label="Hora" title="Toca para cambiar hora">'
            + htmlCaraHora(horaVal)
            + '</div></div>'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn packing-metric-presion-fruta-btn" type="button" tabindex="0"'
            + ' data-tk20-etapa="' + etapaCfg.key + '"'
            + ' title="Presión de vapor (Kpa) — 4 valores" aria-label="Presión de vapor">'
            + '<i data-lucide="apple"></i></button>'
            + '<span class="metric-count' + presionFilled + '"' + presionCountId + '>' + presionCount + '</span></div>'
            + '<div class="metric-btn-wrap tk20-metric-pesos-wrap">'
            + htmlBotonContadorPesos(card, etapaCfg.key, card.id, opts)
            + '</div>'
            + '</div>';
    }

    function htmlPesosGrid(pesos, etapaKey) {
        const celdas = pesosVisuales(etapaKey).map((def) => (
            '<div class="weight-box tk20-peso-visual-cell" data-peso-key="' + def.key + '"'
            + ' data-peso-num="' + def.num + '" data-field="' + def.key + '">'
            + '<label>' + escHtml(def.label) + '</label>'
            + '<span class="' + clasePesoCard(pesos[def.key]) + '">' + textoPesoCard(pesos[def.key]) + '</span>'
            + '</div>'
        )).join('');
        return '<div class="weights-grid packing-weights-grid tk20-pesos-visual-grid">' + celdas + '</div>';
    }

    function crearCardElement(card, etapaCfg, opts) {
        const p = card.pesos || {};
        const obsTxt = String(card.observacion || '').trim();
        const obsHtml = obsTxt ? escHtml(obsTxt) : '';
        const preview = opts?.preview === true;
        const art = document.createElement('article');
        art.className = 'clamshell-card packing-clamshell-card tk20-clamshell-card tk20-etapa-card'
            + (preview ? ' packing-card-preview' : ' packing-card-clickable');
        art.dataset.cardId = String(card.id);
        art.dataset.tk20Etapa = etapaCfg.key;
        art.setAttribute('aria-label', etapaCfg.title);
        if (!preview) art.tabIndex = 0;
        if (preview && opts?.motivo) art.dataset.previewMotivo = opts.motivo;

        const horaVal = String(card.horaRegistro || '').trim() || horaLocalAhora();
        if (!preview) card.horaRegistro = horaVal;

        art.innerHTML = ''
            + '<div class="card-header tk20-card-header">'
            + '<div class="id-badge">'
            + '<div class="packing-card-title-block">'
            + '<p class="packing-card-title">' + escHtml(etapaCfg.title) + '</p>'
            + '<span class="packing-card-sub">' + tk20VariedadHtml + '</span>'
            + '</div></div></div>'
            + '<div class="weights-panel tk20-weights-panel">'
            + '<div class="tk20-weights-main">'
            + htmlPesosGrid(p, etapaCfg.key)
            + '<div class="observation-box tk20-observation-box">'
            + '<button type="button" class="packing-observation-btn" data-card-id="' + card.id + '"'
            + ' data-tk20-etapa="' + etapaCfg.key + '" tabindex="0" title="Editar observación">'
            + '<span class="observation-text' + (obsTxt ? '' : ' is-empty') + '">'
            + (obsHtml || 'Sin observación registrada') + '</span></button></div>'
            + '</div>'
            + htmlMetricActions(card, etapaCfg, opts)
            + '</div>';

        return art;
    }

    function crearIconos() {
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    function aplicarEstadoCardsWrap(wrap) {
        if (!wrap) return;
        const on = window.Tk20Envio?.isRegistroHabilitado?.() === true;
        wrap.classList.toggle('is-disabled', !on);
        wrap.setAttribute('aria-disabled', on ? 'false' : 'true');
    }

    function resetEtapaLocal(etapaKey) {
        const st = stateByEtapa[etapaKey];
        st.cardSeq = 0;
        st.card = crearCardEtapa(etapaKey);
        if (etapaKey === 'traslado') tk20ActiveCardId = st.card.id;
    }

    function resetCardsLocal() {
        F?.resetCuotaPesos?.();
        ETAPAS.forEach((cfg) => resetEtapaLocal(cfg.key));
        tk20ActiveEtapa = 'traslado';
        tk20RegistroCompleto = false;
    }

    function sincronizarEtapaDesdeDetalle(etapaKey, d) {
        const st = stateByEtapa[etapaKey];
        const horas = Array.isArray(d?.HORAS_REGISTRO_CAMPO) ? d.HORAS_REGISTRO_CAMPO : [];
        st.cardSeq = 0;
        const card = crearCardEtapa(etapaKey);
        const h = String(horas[0] || d?.HORA_REGISTRO_CAMPO || '').trim();
        if (h) card.horaRegistro = h;
        st.card = card;
        if (etapaKey === 'traslado') tk20ActiveCardId = card.id;
    }

    function sincronizarCardsDesdeDetalle(d) {
        if (!d) {
            F?.resetCuotaPesos?.();
            resetCardsLocal();
            tk20VariedadHtml = 'Variedad: —';
            return;
        }
        F?.setCuotaPesosDesdeDetalle?.(d);
        tk20RegistroCompleto = registroCompletoEnServidor(d);
        tk20VariedadHtml = textoVariedadDesdeDetalle(d);
        ETAPAS.forEach((cfg) => sincronizarEtapaDesdeDetalle(cfg.key, d));
    }

    function initTimePickersTk20() {
        const root = elMain || document;
        if (window.CustomTimePicker?.prepare) {
            window.CustomTimePicker.prepare(root);
        } else if (window.CustomTimePicker?.init) {
            window.CustomTimePicker.init(root);
        }
    }

    function bindHoraCardInputs() {
        const root = elMain || document;
        root.querySelectorAll('.tk20-card-hora-inp').forEach((inp) => {
            if (inp.dataset.tk20HoraBound === '1') return;
            inp.dataset.tk20HoraBound = '1';
            const syncHora = () => {
                const etapa = inp.dataset.tk20Etapa || 'traslado';
                const card = getEtapaCard(etapa);
                if (!card) return;
                const val = String(inp.value || '').trim();
                card.horaRegistro = val || horaLocalAhora();
                if (!val) inp.value = card.horaRegistro;
                actualizarCaraHora(inp);
                notificarCambioEstado();
            };
            inp.addEventListener('input', syncHora);
            inp.addEventListener('change', syncHora);
            inp.addEventListener('click', (ev) => ev.stopPropagation());
        });
        root.querySelectorAll('.tk20-card-hora-inp').forEach((inp) => {
            actualizarCaraHora(inp);
        });
    }

    function renderEtapa(etapaKey, opts) {
        const cfg = cfgEtapa(etapaKey);
        const wrap = elWrapEtapa(etapaKey);
        if (!wrap) return;
        const card = getEtapaCard(etapaKey);
        aplicarEstadoCardsWrap(wrap);
        wrap.innerHTML = '';
        if (!card) {
            wrap.appendChild(crearCardElement(
                {
                    id: 0,
                    pesos: window.Tk20Pesos?.pesosVacios?.(etapaKey) || {},
                    presion: F?.presionVaciosEtapa?.(etapaKey) || {},
                    observacion: ''
                },
                cfg,
                { preview: true, motivo: opts?.previewMotivo }
            ));
        } else {
            wrap.appendChild(crearCardElement(card, cfg, opts));
        }
    }

    function renderCards() {
        const previewOpts = tk20RegistroCompleto ? { preview: true, motivo: 'completo' } : undefined;
        ETAPAS.forEach((cfg) => renderEtapa(cfg.key, previewOpts));
        crearIconos();
        initTimePickersTk20();
        bindHoraCardInputs();
        window.Tk20Envio?.actualizarBtnEnviar?.();
    }

    function renderVacio() {
        resetCardsLocal();
        renderCards();
    }

    function pintarDesdeDetalle(d) {
        if (!d) {
            renderVacio();
            return;
        }
        sincronizarCardsDesdeDetalle(d);
        renderCards();
    }

    /**
     * Solo cuota/variedad/flag completo desde Campo.
     * NO reinicia pesos/obs: eso lo hace prepararUiNuevaMuestra;
     * reiniciar aquí vaciaba la UI justo antes de restaurar el borrador.
     */
    function aplicarContextoCampoDesdeDetalle(d) {
        if (!d) {
            tk20VariedadHtml = 'Variedad: —';
            tk20RegistroCompleto = false;
            F?.resetCuotaPesos?.();
            renderCards();
            return;
        }
        F?.setCuotaPesosDesdeDetalle?.(d);
        tk20RegistroCompleto = registroCompletoEnServidor(d);
        tk20VariedadHtml = textoVariedadDesdeDetalle(d);
        ETAPAS.forEach((cfg) => {
            const st = stateByEtapa[cfg.key];
            if (!st.card) {
                st.cardSeq = 0;
                st.card = crearCardEtapa(cfg.key);
                if (cfg.key === 'traslado') tk20ActiveCardId = st.card.id;
            }
        });
        renderCards();
    }

    function importEstado(etapas) {
        if (!etapas || typeof etapas !== 'object') return;
        ETAPAS.forEach((cfg) => {
            const src = etapas[cfg.key];
            if (!src) return;
            const st = stateByEtapa[cfg.key];
            st.cardSeq = 1;
            st.card = {
                etapa: cfg.key,
                id: 1,
                pesos: Object.assign({}, src.pesos || window.Tk20Pesos?.pesosVacios?.(cfg.key) || {}),
                presion: Object.assign({}, src.presion || F?.presionVaciosEtapa?.(cfg.key) || {}),
                observacion: String(src.observacion || ''),
                horaRegistro: String(src.horaRegistro || '').trim() || horaLocalAhora()
            };
            if (cfg.key === 'traslado') tk20ActiveCardId = st.card.id;
        });
        renderCards();
    }

    function exportEstado() {
        const out = {};
        ETAPAS.forEach((cfg) => {
            const c = getEtapaCard(cfg.key);
            out[cfg.key] = c ? {
                pesos: Object.assign({}, c.pesos || {}),
                presion: Object.assign({}, c.presion || {}),
                observacion: String(c.observacion || ''),
                horaRegistro: String(c.horaRegistro || '')
            } : null;
        });
        return out;
    }

    function notificarCambioEstado() {
        window.Tk20Draft?.notificarCambio?.();
    }

    function getCards(etapa) {
        const c = getEtapaCard(etapa || tk20ActiveEtapa);
        return c ? [c] : [];
    }

    function getCardById(id, etapa) {
        const c = getEtapaCard(etapa || tk20ActiveEtapa);
        return c && Number(c.id) === Number(id) ? c : c;
    }

    window.Tk20Body = {
        ETAPAS,
        getCards,
        getCardById,
        getEtapaCard,
        getActiveCardId: () => tk20ActiveCardId,
        setActiveCardId: (id) => { tk20ActiveCardId = id; },
        getActiveEtapa: () => tk20ActiveEtapa,
        setActiveEtapa: (etapa) => { tk20ActiveEtapa = etapa; },
        getActivePesoKey: () => tk20ActivePesoKey,
        setActivePesoKey: (k) => { tk20ActivePesoKey = k; },
        cfgEtapa,
        getVariedadHtml: () => tk20VariedadHtml,
        horaLocalAhora,
        renderCards,
        renderVacio,
        limpiarEstadoLocal: resetCardsLocal,
        aplicarContextoCampoDesdeDetalle,
        pintarDesdeDetalle,
        pesoNumero,
        pesosVisuales,
        textoPesoCard,
        clasePesoCard,
        pesoCampo: (etapa, n) => window.Tk20Pesos?.pesoCampo?.(etapa, n),
        conteoPesosCard,
        exportEstado,
        importEstado,
        notificarCambioEstado
    };

    window.addEventListener('tk20:detalle', (ev) => {
        aplicarContextoCampoDesdeDetalle(ev?.detail?.data || null);
    });

    renderVacio();
    if (window.CustomTimePicker?.init) {
        window.CustomTimePicker.init(elMain || document);
    }
}());
