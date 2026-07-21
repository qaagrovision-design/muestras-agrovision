/** TK-2.0: modal placa, guía remisión y acopio (como Campo). */
(function initTk20Transporte() {
    const F = window.Tk20Fields;
    const NUM_ACOPIOS = 35;
    const ACOPIOS_EXTRA = [
        { value: 'Acopio Central 1', label: 'Acopio C1' },
        { value: 'Acopio Central 2', label: 'Acopio C2' }
    ];

    const elBtn = document.getElementById('tk2_btn_transporte');
    const elModal = document.getElementById('tk2_transporte_modal');
    const elCancel = document.getElementById('tk2_transporte_modal_cancel');
    const elGuardar = document.getElementById('tk2_transporte_modal_guardar');
    const elPlaca = document.getElementById('tk2_placa');
    const elGuia = document.getElementById('tk2_guia_remision');
    const elAcopio = document.getElementById('tk2_acopio');

    const valores = {
        placa: '',
        guia: '',
        acopio: ''
    };
    let trazBase = '';

    function trazBaseDesdeDetalle(d) {
        if (!d) return '';
        const etapa = String(d.TRAZ_ETAPA || '').trim();
        const campo = String(d.TRAZ_CAMPO || '').trim();
        const turno = String(d.TRAZ_TURNO || d.TRAZ_LIBRE || '').trim();
        return [etapa, campo, turno].filter(Boolean).join('-');
    }

    function etiquetaAcopioOpcion(i) {
        return 'Acopio ' + i;
    }

    function asegurarOpcionPlaceholderAcopio() {
        if (!elAcopio) return;
        let ph = elAcopio.querySelector('option[value=""]');
        if (!ph) {
            ph = document.createElement('option');
            ph.value = '';
            elAcopio.insertBefore(ph, elAcopio.firstChild);
        }
        ph.textContent = 'Seleccionar acopio';
    }

    function normalizarAcopioSelect(raw) {
        const v = String(raw || '').trim();
        if (!v) return '';
        const compact = v.replace(/\s+/g, ' ');
        if (/^acopio\s+central\s*1$/i.test(compact) || /^acopio\s*c\s*1$/i.test(compact)) {
            return 'Acopio Central 1';
        }
        if (/^acopio\s+central\s*2$/i.test(compact) || /^acopio\s*c\s*2$/i.test(compact)) {
            return 'Acopio Central 2';
        }
        const slash = compact.lastIndexOf('/');
        if (slash >= 0) {
            const tail = compact.slice(slash + 1).trim();
            const mCentral = /^acopio\s+central\s*([12])$/i.exec(tail)
                || /^acopio\s*c\s*([12])$/i.exec(tail);
            if (mCentral) return 'Acopio Central ' + mCentral[1];
            const m = /^acopio\s+(\d+)$/i.exec(tail);
            if (m) return 'Acopio ' + m[1];
        }
        if (/^Acopio\s+\d+$/i.test(compact)) {
            return compact.replace(/^acopio/i, 'Acopio');
        }
        return '';
    }

    function acopioExisteEnSelect(valor) {
        if (!elAcopio || !valor) return false;
        return Array.from(elAcopio.options).some((opt) => opt.value === valor);
    }

    function poblarSelectAcopio() {
        if (!elAcopio) return;
        asegurarOpcionPlaceholderAcopio();
        const trazKey = trazBase || '';
        if (elAcopio.dataset.tk2AcopioBuilt === '1' && elAcopio.dataset.tk2TrazBase === trazKey) return;
        const prev = String(elAcopio.value || valores.acopio || '').trim();
        const ph = elAcopio.querySelector('option[value=""]');
        elAcopio.innerHTML = '';
        if (ph) elAcopio.appendChild(ph);
        else asegurarOpcionPlaceholderAcopio();
        for (let i = 1; i <= NUM_ACOPIOS; i++) {
            const opt = document.createElement('option');
            const corto = 'Acopio ' + i;
            opt.value = corto;
            opt.textContent = etiquetaAcopioOpcion(i);
            elAcopio.appendChild(opt);
        }
        ACOPIOS_EXTRA.forEach((x) => {
            const opt = document.createElement('option');
            opt.value = x.value;
            opt.textContent = x.label;
            elAcopio.appendChild(opt);
        });
        const acopioPrev = normalizarAcopioSelect(prev);
        if (acopioPrev && acopioExisteEnSelect(acopioPrev)) elAcopio.value = acopioPrev;
        elAcopio.dataset.tk2AcopioBuilt = '1';
        elAcopio.dataset.tk2TrazBase = trazKey;
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

    function persistirInputsTransporte() {
        leerInputs();
        actualizarBotonTransporte();
    }

    function aplicarValores(t) {
        if (!t) return;
        valores.placa = String(t.placa || '').trim();
        valores.guia = String(t.guia || '').trim();
        valores.acopio = normalizarAcopioSelect(t.acopio);
        pintarInputs();
        actualizarBotonTransporte();
    }

    function leerInputs() {
        valores.placa = String(elPlaca?.value || '').trim();
        valores.guia = String(elGuia?.value || '').trim();
        valores.acopio = String(elAcopio?.value || '').trim();
    }

    function pintarInputs() {
        poblarSelectAcopio();
        if (elPlaca) elPlaca.value = valores.placa;
        if (elGuia) elGuia.value = valores.guia;
        if (elAcopio) {
            const acopio = normalizarAcopioSelect(valores.acopio);
            valores.acopio = acopioExisteEnSelect(acopio) ? acopio : '';
            elAcopio.value = valores.acopio;
        }
    }

    function actualizarBotonTransporte() {
        if (!elBtn) return;
        const ok = Boolean(valores.placa);
        elBtn.classList.toggle('is-filled', ok);
        elBtn.title = ok
            ? ('Placa: ' + valores.placa + (valores.guia ? ' · Guía: ' + valores.guia : ''))
            : 'Placa, guía y acopio';
    }

    function limpiar() {
        valores.placa = '';
        valores.guia = '';
        valores.acopio = '';
        trazBase = '';
        if (elAcopio) {
            elAcopio.dataset.tk2AcopioBuilt = '0';
            elAcopio.dataset.tk2TrazBase = '';
        }
        pintarInputs();
        actualizarBotonTransporte();
    }

    function setDesdeDetalle(d) {
        if (!d) {
            limpiar();
            return;
        }
        trazBase = trazBaseDesdeDetalle(d);
        if (elAcopio) {
            elAcopio.dataset.tk2AcopioBuilt = '0';
            elAcopio.dataset.tk2TrazBase = '';
        }
        valores.placa = String(d.PLACA_VEHICULO || d.PLACA_TK || '').trim();
        valores.guia = String(d.GUIA_REMISION || d.GUIA_REMISION_ACOPIO || '').trim();
        const acopioDet = String(d.TRAZ_ACOPIO || '').trim();
        valores.acopio = normalizarAcopioSelect(acopioDet);
        pintarInputs();
        actualizarBotonTransporte();
    }

    function setHabilitado(on) {
        if (!elBtn) return;
        if (on) {
            elBtn.disabled = false;
            elBtn.removeAttribute('disabled');
        } else {
            elBtn.disabled = true;
            elBtn.setAttribute('disabled', 'disabled');
        }
    }

    function abrirModal() {
        if (!elModal) return;
        poblarSelectAcopio();
        pintarInputs();
        mostrarModal(elModal);
        if (window.lucide?.createIcons) window.lucide.createIcons();
        elPlaca?.focus();
    }

    function cerrarModal() {
        persistirInputsTransporte();
        ocultarModal(elModal);
        window.Tk20Draft?.notificarCambio?.();
    }

    function guardarModal() {
        persistirInputsTransporte();
        if (!valores.placa) {
            window.Tk20Swal?.warn?.('Placa requerida', 'Ingresa la placa del vehículo.');
            elPlaca?.focus();
            return;
        }
        ocultarModal(elModal);
        window.Tk20Draft?.notificarCambio?.();
        window.Tk20Envio?.actualizarBtnEnviar?.();
        window.Tk20Swal?.success?.('Guardado', 'Datos de transporte actualizados.');
    }

    elBtn?.addEventListener('click', abrirModal);
    elCancel?.addEventListener('click', cerrarModal);
    elGuardar?.addEventListener('click', guardarModal);
    bindCerrarFuera(elModal, cerrarModal);
    [elPlaca, elGuia, elAcopio].forEach((el) => {
        el?.addEventListener('input', () => {
            leerInputs();
            window.Tk20Draft?.programarGuardado?.();
        });
        el?.addEventListener('change', () => {
            leerInputs();
            window.Tk20Draft?.programarGuardado?.();
        });
    });

    poblarSelectAcopio();
    actualizarBotonTransporte();

    window.Tk20Transporte = {
        getValores: () => {
            if (elModal && elModal.style.display === 'flex') leerInputs();
            return { ...valores };
        },
        getPlaca: () => {
            if (elModal && elModal.style.display === 'flex') leerInputs();
            return valores.placa;
        },
        persistirInputs: persistirInputsTransporte,
        getGuia: () => valores.guia,
        getAcopio: () => valores.acopio,
        aplicarValores,
        setDesdeDetalle,
        setHabilitado,
        limpiar,
        actualizarBotonTransporte
    };
}());
