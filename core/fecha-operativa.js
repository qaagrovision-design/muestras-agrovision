/** Fecha operativa local y detección de cambio de día por módulo. */
(function initFechaOperativa() {
    const PREFIX = 'muestras-ultimo-dia-operativo-v1:';

    function hoyIsoLocal() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function ayerIsoLocal() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function rangoFechasOperativas() {
        const hoy = hoyIsoLocal();
        const ayer = ayerIsoLocal();
        return { hoy, ayer, min: ayer, max: hoy };
    }

    /** Solo hoy y ayer (misma regla que Historial y caché PDF). */
    function esFechaOperativaPermitida(iso) {
        const f = String(iso || '').trim();
        if (!f) return false;
        const { hoy, ayer } = rangoFechasOperativas();
        return f === hoy || f === ayer;
    }

    /** input[type=date] o flatpickr enlazado: min=ayer, max=hoy; valor por defecto hoy. */
    function aplicarRangoInputFecha(el, opts) {
        if (!el) return false;
        const { hoy, ayer } = rangoFechasOperativas();
        el.max = hoy;
        el.min = ayer;
        const prev = String(el.value || '').trim();
        const forzar = opts?.forzar !== false;
        if (forzar || !prev || prev > hoy || prev < ayer) {
            el.value = hoy;
        }
        const fp = el._flatpickr;
        if (fp && typeof fp.set === 'function') {
            fp.set('minDate', ayer);
            fp.set('maxDate', hoy);
        }
        return prev !== el.value;
    }

    function sincronizarFlatpickrRango(fp) {
        if (!fp || typeof fp.set !== 'function') return;
        const { ayer, hoy } = rangoFechasOperativas();
        fp.set('minDate', ayer);
        fp.set('maxDate', hoy);
    }

    function opcionesFlatpickrFechaOperativa(localeEs) {
        const { ayer, hoy } = rangoFechasOperativas();
        return {
            enableTime: false,
            dateFormat: 'Y-m-d',
            allowInput: false,
            clickOpens: true,
            disableMobile: true,
            locale: localeEs,
            minDate: ayer,
            maxDate: hoy,
            static: false,
            appendTo: document.body
        };
    }

    function marcarDia(modulo, fecha) {
        if (!modulo) return;
        try {
            localStorage.setItem(PREFIX + modulo, fecha || hoyIsoLocal());
        } catch (_) { /* ignore */ }
    }

    /** true si el calendario cambió desde la última sesión de este módulo. */
    function esNuevoDia(modulo) {
        if (!modulo) return false;
        const hoy = hoyIsoLocal();
        let ult = '';
        try {
            ult = String(localStorage.getItem(PREFIX + modulo) || '').trim();
        } catch (_) { /* ignore */ }
        if (!ult) {
            marcarDia(modulo, hoy);
            return false;
        }
        if (ult === hoy) return false;
        marcarDia(modulo, hoy);
        return true;
    }

    /** Elimina entradas porClave cuya fecha (antes de ::) no sea hoy; limpia clave activa si aplica. */
    function purgarStorePorFecha(store, opts) {
        const hoy = opts?.hoy || hoyIsoLocal();
        const activoKey = opts?.activoKey || 'activa';
        const out = store && typeof store === 'object' ? store : {};
        const porClave = out.porClave && typeof out.porClave === 'object' ? out.porClave : {};
        let changed = false;
        Object.keys(porClave).forEach((key) => {
            const fecha = String(key.split('::')[0] || '').trim();
            if (fecha && fecha !== hoy) {
                delete porClave[key];
                changed = true;
            }
        });
        const activo = String(out[activoKey] || '').trim();
        if (activo && !activo.startsWith(hoy + '::')) {
            out[activoKey] = '';
            changed = true;
        }
        out.porClave = porClave;
        return changed;
    }

    window.FechaOperativa = {
        hoyIsoLocal,
        ayerIsoLocal,
        rangoFechasOperativas,
        esFechaOperativaPermitida,
        aplicarRangoInputFecha,
        sincronizarFlatpickrRango,
        opcionesFlatpickrFechaOperativa,
        marcarDia,
        esNuevoDia,
        purgarStorePorFecha
    };
})();
