/** TK-2.0: modales del card (pesos 4×2, presión 4 campos, observación). */
(function initTk20Modals() {
    const F = window.Tk20Fields;

    const elCardsRoot = document.getElementById('tk20-main');
    const elPesosModal = document.getElementById('tk2_pesos_modal');
    const elPesosTitle = document.getElementById('tk2_pesos_modal_title');
    const elPesosCancel = document.getElementById('tk2_pesos_modal_cancel');
    const elPesosGuardar = document.getElementById('tk2_pesos_modal_guardar');
    const elPresionModal = document.getElementById('tk2_presion_modal');
    const elPresionTitle = document.getElementById('tk2_presion_modal_title');
    const elPresionBody = document.getElementById('tk2_presion_modal_body');
    const elPresionCancel = document.getElementById('tk2_presion_modal_cancel');
    const elPresionGuardar = document.getElementById('tk2_presion_modal_guardar');
    const elObsModal = document.getElementById('tk2_obs_modal');
    const elObsTitle = document.getElementById('tk2_obs_modal_title');
    const elObsInput = document.getElementById('tk2_observacion');
    const elObsCancel = document.getElementById('tk2_obs_modal_cancel');
    const elObsGuardar = document.getElementById('tk2_obs_modal_guardar');

    let tk20ObsEtapa = 'traslado';
    let tk20PresionEtapa = 'traslado';

    const elPesosAlert = document.getElementById('tk2_pesos_alert');

    function setAlertaPesosModal_(msgs) {
        if (!elPesosAlert) return;
        const list = Array.isArray(msgs) ? msgs.filter(Boolean) : [];
        if (!list.length) {
            elPesosAlert.style.display = 'none';
            elPesosAlert.textContent = '';
            return;
        }
        elPesosAlert.style.display = 'block';
        elPesosAlert.textContent = list.join(' ');
    }

    function leerPesosDesdeModal_() {
        const out = Object.create(null);
        const modalBody = document.getElementById('tk2_pesos_modal_body');
        const api = body();
        modalBody?.querySelectorAll('input[data-field]').forEach((inp) => {
            const key = inp.getAttribute('data-field');
            if (!key) return;
            const raw = typeof api?.pesoNumero === 'function'
                ? api.pesoNumero(inp.value)
                : Number(inp.value);
            out[key] = Number.isFinite(raw) ? raw : 0;
        });
        return out;
    }

    function validarPesosModalActual_() {
        const api = body();
        if (!api) return [];
        const etapaKey = api.getActiveEtapa();
        const pesos = leerPesosDesdeModal_();
        const detalle = window.Tk20Header?.getLastDetalle?.() || null;
        const llegadaPesos = api.getEtapaCard?.('llegada')?.pesos || {};
        return window.Tk20Pesos?.validarPesosEtapa?.(etapaKey, pesos, {
            detalle,
            pesosLlegada: llegadaPesos
        }) || [];
    }

    function etapaDesdeEl(el) {
        return String(el?.dataset?.tk20Etapa || 'traslado').trim() || 'traslado';
    }

    function buildPesosModalForm(etapaKey, pesos, focusKey) {
        const bodyEl = document.getElementById('tk2_pesos_modal_body');
        if (!bodyEl) return;
        setAlertaPesosModal_([]);
        const list = window.Tk20Pesos?.pesosVisuales?.(etapaKey) || [];
        const vals = pesos || {};
        bodyEl.innerHTML = list.map((campo) => (
            '<div class="form-group">'
            + '<label for="' + campo.inpId + '">' + campo.modalLabel + '</label>'
            + '<input type="number" id="' + campo.inpId + '" name="' + campo.key + '" data-field="' + campo.key + '"'
            + ' step="0.1" placeholder="00" enterkeyhint="done" inputmode="decimal">'
            + '</div>'
        )).join('');
        list.forEach((campo) => {
            const inp = document.getElementById(campo.inpId);
            if (inp) inp.value = valorPesoInput(vals[campo.key]);
        });
        bodyEl.querySelectorAll('input[data-field]').forEach((inp) => {
            inp.addEventListener('input', () => {
                const err = validarPesosModalActual_();
                setAlertaPesosModal_(err);
            });
        });
        const focusInp = focusKey
            ? bodyEl.querySelector('[data-field="' + focusKey + '"]')
            : bodyEl.querySelector('input');
        if (focusInp) {
            setTimeout(() => {
                focusInp.focus();
                if (typeof focusInp.select === 'function') focusInp.select();
            }, 0);
        }
    }

    function body() {
        return window.Tk20Body;
    }

    function quitarFocoModal(el) {
        if (!el) return;
        const active = document.activeElement;
        if (active && el.contains(active) && typeof active.blur === 'function') {
            active.blur();
        }
    }

    function mostrarModal(el) {
        if (!el) return;
        el.style.display = 'flex';
        el.setAttribute('aria-hidden', 'false');
    }

    function ocultarModal(el) {
        if (!el) return;
        quitarFocoModal(el);
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
    }

    function bindCerrarFuera(overlay, onClose) {
        overlay?.addEventListener('click', (e) => {
            const panel = overlay.querySelector('.modal-content');
            if (panel && panel.contains(e.target)) return;
            onClose();
        });
    }

    function valorPesoInput(v) {
        const n = body()?.pesoNumero?.(v) ?? Number(v);
        return n > 0 ? String(n) : '';
    }

    function abrirModalPesos(etapaKey, pesoKey, pesoNum) {
        const api = body();
        if (!api || !elPesosModal) return;
        const card = api.getEtapaCard(etapaKey);
        if (!card) return;
        const campo = api.pesoCampo(etapaKey, pesoNum)
            || window.Tk20Pesos?.pesoCampo?.(etapaKey, pesoNum);
        const focusKey = pesoKey || campo?.key || '';
        api.setActiveEtapa(etapaKey);
        api.setActiveCardId(card.id);
        api.setActivePesoKey(focusKey);
        buildPesosModalForm(etapaKey, card.pesos, focusKey);
        const cfg = api.cfgEtapa(etapaKey);
        if (elPesosTitle) {
            elPesosTitle.textContent = cfg?.pesosModalPrefix || 'Pesos';
        }
        mostrarModal(elPesosModal);
    }

    function persistirModalPesos() {
        const api = body();
        if (!api) return;
        const etapaKey = api.getActiveEtapa();
        const card = api.getEtapaCard(etapaKey);
        if (!card) return;
        const modalBody = document.getElementById('tk2_pesos_modal_body');
        modalBody?.querySelectorAll('input[data-field]').forEach((inp) => {
            const key = inp.getAttribute('data-field');
            if (key) card.pesos[key] = api.pesoNumero(inp.value);
        });
        api.renderCards();
    }

    function cerrarModalPesos() {
        persistirModalPesos();
        ocultarModal(elPesosModal);
        window.Tk20Draft?.notificarCambio?.();
    }

    function guardarModalPesos() {
        const errores = validarPesosModalActual_();
        if (errores.length) {
            setAlertaPesosModal_(errores);
            window.Tk20Swal?.warn?.('Pesos inválidos', errores[0]);
            return;
        }
        setAlertaPesosModal_([]);
        persistirModalPesos();
        ocultarModal(elPesosModal);
        window.Tk20Draft?.notificarCambio?.();
        window.Tk20Draft?.notificarPdfVivo?.();
        window.Tk20Swal?.success?.('Guardado', 'Pesos actualizados.');
    }

    function htmlPresionGrid(campos, valores) {
        const vals = valores || {};
        return '<div class="presion-metric-grid metric-grid-4">'
            + campos.map((c) => {
                const raw = String(vals[c.key] ?? '').trim();
                const v = raw.replace(/"/g, '&quot;');
                const txt = String(c.shortLabel || c.label || '').replace(/</g, '&lt;');
                const aria = String(c.label || '').replace(/"/g, '&quot;');
                return '<div class="form-group"><label>' + txt + '</label>'
                    + '<input type="text" inputmode="decimal" maxlength="6"'
                    + ' class="presion-readonly-inp" id="' + c.key + '" name="' + c.key + '"'
                    + ' data-field="' + c.key + '" value="' + v + '" aria-label="' + aria + '"'
                    + ' disabled readonly inputmode="none" tabindex="-1"></div>';
            }).join('')
            + '</div>';
    }

    function enlazarInputsPresion(root) {
        root?.querySelectorAll('.presion-readonly-inp').forEach((input) => {
            input.classList.add('presion-readonly-inp');
        });
    }

    function abrirModalPresion(etapa) {
        if (!elPresionModal || !elPresionBody || !F) return;
        const etapaKey = etapa || 'traslado';
        const api = body();
        const card = api?.getEtapaCard?.(etapaKey);
        if (!card) return;
        tk20PresionEtapa = etapaKey;
        api?.setActiveEtapa?.(etapaKey);
        window.Tk20Presion?.recalcularEtapa?.(etapaKey, { render: true });
        const cfg = api?.cfgEtapa?.(etapaKey);
        const etapaTitulo = cfg?.title || etapaKey;
        const campos = F.presionVaporCampos(etapaKey);
        if (!card.presion || typeof card.presion !== 'object') {
            card.presion = F.presionVaciosEtapa(etapaKey);
        }
        if (elPresionTitle) {
            elPresionTitle.textContent = 'Presión de vapor (Kpa) · ' + etapaTitulo;
        }
        elPresionBody.innerHTML = htmlPresionGrid(campos, card.presion);
        enlazarInputsPresion(elPresionBody);
        mostrarModal(elPresionModal);
    }

    function persistirModalPresion() {
        const api = body();
        if (!api) return;
        window.Tk20Presion?.recalcularEtapa?.(tk20PresionEtapa, { render: true });
    }

    function cerrarModalPresion() {
        persistirModalPresion();
        ocultarModal(elPresionModal);
        if (elPresionBody) elPresionBody.innerHTML = '';
        window.Tk20Draft?.notificarCambio?.();
    }

    function guardarModalPresion() {
        persistirModalPresion();
        ocultarModal(elPresionModal);
        if (elPresionBody) elPresionBody.innerHTML = '';
        window.Tk20Draft?.notificarCambio?.();
        window.Tk20Swal?.success?.('Guardado', 'Presión recalculada desde T° y HR.');
    }

    function abrirModalObservacion(cardId, etapa) {
        const api = body();
        if (!api || !elObsModal) return;
        const etapaKey = etapa || api.getActiveEtapa();
        const cfg = api.cfgEtapa(etapaKey);
        const card = api.getEtapaCard(etapaKey);
        if (!card) return;
        tk20ObsEtapa = etapaKey;
        api.setActiveEtapa(etapaKey);
        api.setActiveCardId(card.id);
        if (elObsTitle) elObsTitle.textContent = cfg.obsModalPrefix;
        if (elObsInput) {
            const obsField = F?.observacionEtapa?.(etapaKey) || ('tk2_' + etapaKey + '_observacion');
            elObsInput.name = obsField;
            elObsInput.dataset.field = obsField;
            elObsInput.value = card.observacion || '';
        }
        mostrarModal(elObsModal);
    }

    function persistirModalObservacion() {
        const api = body();
        if (!api) return;
        const card = api.getEtapaCard(tk20ObsEtapa);
        if (!card) return;
        card.observacion = String(elObsInput?.value || '').trim();
        api.renderCards();
    }

    function cerrarModalObservacion() {
        persistirModalObservacion();
        ocultarModal(elObsModal);
        window.Tk20Draft?.notificarCambio?.();
    }

    function guardarModalObservacion() {
        persistirModalObservacion();
        ocultarModal(elObsModal);
        window.Tk20Draft?.notificarCambio?.();
        window.Tk20Swal?.success?.('Guardado', 'Observación actualizada.');
    }

    elCardsRoot?.addEventListener('click', (ev) => {
        const pesoCell = ev.target.closest('.tk20-peso-visual-cell');
        if (pesoCell) {
            ev.stopPropagation();
            const cardEl = pesoCell.closest('.tk20-etapa-card');
            const etapa = etapaDesdeEl(cardEl);
            abrirModalPesos(
                etapa,
                pesoCell.dataset.pesoKey,
                Number(pesoCell.dataset.pesoNum)
            );
            return;
        }
        const obsBtn = ev.target.closest('.packing-observation-btn');
        if (obsBtn) {
            ev.stopPropagation();
            abrirModalObservacion(Number(obsBtn.dataset.cardId), etapaDesdeEl(obsBtn));
            return;
        }
        const presionBtn = ev.target.closest('.packing-metric-presion-fruta-btn, .packing-metric-presion-amb-btn');
        if (presionBtn) {
            ev.stopPropagation();
            abrirModalPresion(etapaDesdeEl(presionBtn));
            return;
        }
        const pesosContadorBtn = ev.target.closest('.tk20-pesos-contador-btn');
        if (pesosContadorBtn) {
            ev.stopPropagation();
            if (pesosContadorBtn.disabled) return;
            abrirModalPesos(etapaDesdeEl(pesosContadorBtn), null, 1);
            return;
        }
        if (ev.target.closest('.metric-actions, .metric-btn, .observation-box, .tk20-card-hora-inp, .tk20-metric-hora-shell')) return;
        const cardEl = ev.target.closest('.tk20-etapa-card');
        if (!cardEl || cardEl.classList.contains('packing-card-preview')) return;
        const pesoPrimero = cardEl.querySelector('.tk20-peso-visual-cell');
        if (pesoPrimero) {
            abrirModalPesos(
                etapaDesdeEl(cardEl),
                pesoPrimero.dataset.pesoKey,
                Number(pesoPrimero.dataset.pesoNum)
            );
        }
    });

    elCardsRoot?.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        if (ev.target.closest('.tk20-card-hora-inp, .tk20-metric-hora-shell')) return;
        const cardEl = ev.target.closest('.tk20-etapa-card');
        if (!cardEl || cardEl.classList.contains('packing-card-preview')) return;
        ev.preventDefault();
        const pesoPrimero = cardEl.querySelector('.tk20-peso-visual-cell');
        if (pesoPrimero) {
            abrirModalPesos(
                etapaDesdeEl(cardEl),
                pesoPrimero.dataset.pesoKey,
                Number(pesoPrimero.dataset.pesoNum)
            );
        }
    });

    function modalTk20Abierto_(el) {
        return !!(el && el.style.display === 'flex');
    }

    function persistirModalesAbiertasTk20_() {
        if (modalTk20Abierto_(elPesosModal)) persistirModalPesos();
        if (modalTk20Abierto_(elObsModal)) persistirModalObservacion();
        if (modalTk20Abierto_(elPresionModal)) persistirModalPresion();
        window.Tk20Control?.persistirAbierto?.();
        window.Tk20Transporte?.persistirInputs?.();
    }

    elPesosCancel?.addEventListener('click', cerrarModalPesos);
    elPesosGuardar?.addEventListener('click', guardarModalPesos);
    bindCerrarFuera(elPesosModal, cerrarModalPesos);

    elPresionCancel?.addEventListener('click', cerrarModalPresion);
    elPresionGuardar?.addEventListener('click', guardarModalPresion);
    bindCerrarFuera(elPresionModal, cerrarModalPresion);

    elObsCancel?.addEventListener('click', cerrarModalObservacion);
    elObsGuardar?.addEventListener('click', guardarModalObservacion);
    bindCerrarFuera(elObsModal, cerrarModalObservacion);

    window.Tk20Modals = {
        persistirAbiertas: persistirModalesAbiertasTk20_
    };
}());
