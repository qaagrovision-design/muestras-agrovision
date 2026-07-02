/** TK-2.0: control equitativo — mismo markup/CSS que Packing (metric-mini-title + packing-cg-grid-*). */
(function initTk20Control() {
    const F = window.Tk20Fields;
    if (!F) return;

    const elModal = document.getElementById('tk2_control_modal');
    const elTitle = document.getElementById('tk2_control_modal_title');
    const elBody = document.getElementById('tk2_control_modal_body');
    const elCancel = document.getElementById('tk2_control_modal_cancel');
    const elGuardar = document.getElementById('tk2_control_modal_guardar');

    const valores = Object.create(null);

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getVal(key) {
        return String(valores[key] || '').trim();
    }

    function setVal(key, v) {
        valores[key] = v == null ? '' : String(v);
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

    function sanitizarValor(raw, opts) {
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

    function normalizarValor(raw) {
        const live = sanitizarValor(raw);
        if (!live) return '';
        if (live.includes('.')) return live;
        if (live.length >= 3) return live.slice(0, 2) + '.' + live.slice(2, 3);
        return live;
    }

    function formatearInput(input, final, opts) {
        if (!input) return;
        const normalizado = final
            ? normalizarValor(input.value)
            : sanitizarValor(input.value, opts);
        if (input.value !== normalizado) input.value = normalizado;
    }

    function colorPrimary() {
        try {
            return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || 'rgb(22, 76, 124)';
        } catch (_) {
            return 'rgb(22, 76, 124)';
        }
    }

    function reforzarEstiloInput(input) {
        if (!input || !input.classList.contains('control-equitativo-inp')) return;
        const c = colorPrimary();
        input.style.setProperty('color', c, 'important');
        input.style.setProperty('-webkit-text-fill-color', c, 'important');
        input.style.setProperty('font-weight', '700', 'important');
        input.style.setProperty('text-align', 'center', 'important');
    }

    function celdaCampo(campo) {
        const v = esc(getVal(campo.key));
        const txt = esc(campo.shortLabel || campo.label);
        const aria = esc(campo.aria || campo.label);
        return '<div class="form-group"><label>' + txt + '</label>'
            + '<input type="text" inputmode="decimal" maxlength="4" class="packing-cg-inp control-equitativo-inp"'
            + ' id="' + esc(campo.key) + '" name="' + esc(campo.key) + '" data-field="' + esc(campo.key) + '"'
            + ' value="' + v + '" aria-label="' + aria + '"></div>';
    }

    function htmlFilaGrid(campos, cols) {
        const n = cols || campos.length;
        const celdas = campos.map((c) => celdaCampo(c)).join('');
        return '<div class="packing-cg-grid-' + n + '">' + celdas + '</div>';
    }

    function htmlSeccionControl(titulo, campos, cols) {
        return '<p class="metric-mini-title">' + esc(titulo) + '</p>' + htmlFilaGrid(campos, cols);
    }

    function enlazarInputs(root) {
        const scope = root || elBody;
        if (!scope) return;
        scope.querySelectorAll('.packing-cg-inp').forEach((input) => {
            input.classList.add('control-equitativo-inp');
            formatearInput(input, true);
            reforzarEstiloInput(input);
            input.addEventListener('input', (ev) => {
                const inputType = String(ev?.inputType || '');
                formatearInput(input, false, { isDeleting: inputType.includes('delete') });
                reforzarEstiloInput(input);
            });
            input.addEventListener('change', () => {
                formatearInput(input, true);
                reforzarEstiloInput(input);
            });
            input.addEventListener('paste', () => {
                setTimeout(() => reforzarEstiloInput(input), 0);
            });
            input.addEventListener('focus', () => reforzarEstiloInput(input));
            input.addEventListener('blur', () => reforzarEstiloInput(input));
        });
    }

    function abrirModalControl(tipo) {
        if (!elModal || !elBody) return;
        let html = '';
        if (tipo === 'tk2_llegada_temp') {
            if (elTitle) elTitle.textContent = 'Control equitativo · Temperatura';
            html = htmlSeccionControl('Temperaturas (°C)', F.tempCampos(F.ETAPAS.llegada), 4);
        } else if (tipo === 'tk2_traslado_temp') {
            if (elTitle) elTitle.textContent = 'Control equitativo · Temperatura';
            html = htmlSeccionControl('Temperaturas (°C)', F.tempCampos(F.ETAPAS.traslado), 4);
        } else if (tipo === 'tk2_llegada_hum') {
            if (elTitle) elTitle.textContent = 'Control equitativo · Humedad';
            html = htmlSeccionControl('Humedad relativa (%)', F.humCampos(F.ETAPAS.llegada), 3);
        } else if (tipo === 'tk2_traslado_hum') {
            if (elTitle) elTitle.textContent = 'Control equitativo · Humedad';
            html = htmlSeccionControl('Humedad relativa (%)', F.humCampos(F.ETAPAS.traslado), 3);
        }
        elBody.innerHTML = html;
        elBody.dataset.ctrlTipo = tipo;
        enlazarInputs(elBody);
        mostrarModal(elModal);
    }

    function persistirModalControlSiValido() {
        if (!elBody) return false;
        elBody.querySelectorAll('.packing-cg-inp').forEach((inp) => formatearInput(inp, true));
        const incompleto = [...elBody.querySelectorAll('input')]
            .some((inp) => String(inp.value || '').trim().endsWith('.'));
        if (incompleto) return false;
        elBody.querySelectorAll('.packing-cg-inp').forEach((inp) => {
            const k = inp.getAttribute('data-field');
            if (k) setVal(k, inp.value);
        });
        window.Tk20Presion?.recalcularTodas?.({ render: true });
        window.Tk20Draft?.notificarCambio?.();
        return true;
    }

    function cerrarModalControl() {
        persistirModalControlSiValido();
        ocultarModal(elModal);
    }

    function guardarModalControl() {
        if (!elBody) return;
        const tipo = elBody.dataset.ctrlTipo;
        elBody.querySelectorAll('.packing-cg-inp').forEach((inp) => formatearInput(inp, true));
        const incompleto = [...elBody.querySelectorAll('input')]
            .some((inp) => String(inp.value || '').trim().endsWith('.'));
        if (incompleto) {
            window.Tk20Swal?.warn?.('Decimal incompleto', 'Ejemplo: 11.2 (no 11.).');
            return;
        }
        elBody.querySelectorAll('.packing-cg-inp').forEach((inp) => {
            const k = inp.getAttribute('data-field');
            if (k) setVal(k, inp.value);
        });
        window.Tk20Presion?.recalcularTodas?.({ render: true });
        ocultarModal(elModal);
        window.Tk20Draft?.notificarCambio?.();
        const msg = tipo === 'tk2_llegada_temp'
            ? 'Temperatura llegada fruta acopio actualizada.'
            : (tipo === 'tk2_traslado_temp'
                ? 'Temperatura inicio de traslado actualizada.'
                : (tipo === 'tk2_llegada_hum'
                    ? 'Humedad llegada fruta acopio actualizada.'
                    : 'Humedad inicio de traslado actualizada.'));
        window.Tk20Swal?.success?.('Guardado', msg);
    }

    function setBarDesbloqueada(bar) {
        if (!bar) return;
        bar.classList.remove('is-disabled');
        bar.querySelectorAll('.control-equitativo-btn').forEach((btn) => {
            btn.disabled = false;
            btn.removeAttribute('disabled');
        });
    }

    function bindCerrarFuera(overlay, onClose) {
        overlay?.addEventListener('click', (e) => {
            const panel = overlay.querySelector('.modal-content');
            if (panel && panel.contains(e.target)) return;
            onClose();
        });
    }

    document.getElementById('tk2_btn_temp_llegada')?.addEventListener('click', () => abrirModalControl('tk2_llegada_temp'));
    document.getElementById('tk2_btn_hum_llegada')?.addEventListener('click', () => abrirModalControl('tk2_llegada_hum'));
    document.getElementById('tk2_btn_temp_traslado')?.addEventListener('click', () => abrirModalControl('tk2_traslado_temp'));
    document.getElementById('tk2_btn_hum_traslado')?.addEventListener('click', () => abrirModalControl('tk2_traslado_hum'));
    elCancel?.addEventListener('click', cerrarModalControl);
    elGuardar?.addEventListener('click', guardarModalControl);
    bindCerrarFuera(elModal, cerrarModalControl);

    function setValores(map) {
        Object.keys(valores).forEach((k) => { delete valores[k]; });
        Object.assign(valores, map || {});
        window.Tk20Presion?.recalcularTodas?.({ render: false, control: valores });
    }

    window.Tk20Control = {
        getValores: () => ({ ...valores }),
        setValores,
        setBarDesbloqueada
    };
}());
