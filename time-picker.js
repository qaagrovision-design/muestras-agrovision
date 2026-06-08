/** Selector de hora personalizado (mismo UX que Campo). */
(function initCustomTimePicker(global) {
    const state = {
        targetInput: null,
        hour: 0,
        minute: 0,
        bound: false
    };

    function pad2(n) {
        return String(Number(n) || 0).padStart(2, '0');
    }

    function parseHHMM(v) {
        const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        const h = Number(m[1]);
        const mi = Number(m[2]);
        if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
        return { h, mi };
    }

    function actualizarVista() {
        const hEl = document.getElementById('time-picker-hour');
        const mEl = document.getElementById('time-picker-minute');
        const cEl = document.getElementById('time-picker-current');
        if (hEl) hEl.textContent = pad2(state.hour);
        if (mEl) mEl.textContent = pad2(state.minute);
        if (cEl) cEl.textContent = pad2(state.hour) + ':' + pad2(state.minute);
    }

    function cerrar() {
        const overlay = document.getElementById('time-picker-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function abrir(input) {
        if (!input) return;
        const parsed = parseHHMM(input.value);
        if (parsed) {
            state.hour = parsed.h;
            state.minute = parsed.mi;
        } else {
            const now = new Date();
            state.hour = now.getHours();
            state.minute = now.getMinutes();
        }
        state.targetInput = input;
        actualizarVista();
        const overlay = document.getElementById('time-picker-modal-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    function aplicar() {
        const input = state.targetInput;
        if (!input) {
            cerrar();
            return;
        }
        const val = pad2(state.hour) + ':' + pad2(state.minute);
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        cerrar();
    }

    function prepare(root) {
        const scope = root || document;
        scope.querySelectorAll('input[type="time"], input.fp-input-time').forEach((input) => {
            if (input.dataset.tpReady === '1') return;
            if (input.dataset.tiemposNoPicker === '1') return;
            if (input.type !== 'time') input.classList.add('fp-input-time');
            input.type = 'text';
            input.readOnly = true;
            input.inputMode = 'none';
            if (!input.placeholder) input.placeholder = 'HH:MM';
            input.addEventListener('click', () => abrir(input));
            input.addEventListener('focus', () => {
                if (document.activeElement === input) input.blur();
            });
            input.dataset.tpReady = '1';
        });
    }

    function bindControls() {
        if (state.bound) return;
        state.bound = true;

        document.getElementById('time-picker-hour-up')?.addEventListener('click', () => {
            state.hour = (state.hour + 1) % 24;
            actualizarVista();
        });
        document.getElementById('time-picker-hour-down')?.addEventListener('click', () => {
            state.hour = (state.hour + 23) % 24;
            actualizarVista();
        });
        document.getElementById('time-picker-minute-up')?.addEventListener('click', () => {
            state.minute = (state.minute + 1) % 60;
            actualizarVista();
        });
        document.getElementById('time-picker-minute-down')?.addEventListener('click', () => {
            state.minute = (state.minute + 59) % 60;
            actualizarVista();
        });
        document.getElementById('time-picker-now')?.addEventListener('click', () => {
            const now = new Date();
            state.hour = now.getHours();
            state.minute = now.getMinutes();
            actualizarVista();
        });
        document.getElementById('time-picker-cancel')?.addEventListener('click', cerrar);
        document.getElementById('time-picker-apply')?.addEventListener('click', aplicar);

        document.getElementById('time-picker-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) cerrar();
        });
    }

    function init(root) {
        bindControls();
        prepare(root || document);
    }

    global.CustomTimePicker = {
        init,
        prepare,
        abrir,
        cerrar,
        aplicar
    };
}(typeof window !== 'undefined' ? window : globalThis));
