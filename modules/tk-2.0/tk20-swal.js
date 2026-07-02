/** TK-2.0: SweetAlert2 — toasts arriba a la derecha (como Packing / Campo). */
(function initTk20Swal() {
    async function swalFireTk20(options) {
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

    function mostrarToastTk20(icono, titulo, texto) {
        const icon = icono === 'warn' ? 'warning' : (icono || 'info');
        if (window.Swal && typeof window.Swal.fire === 'function') {
            void swalFireTk20({
                toast: true,
                position: 'top-end',
                icon,
                title: titulo || '',
                text: texto || '',
                showConfirmButton: false,
                timer: icon === 'success' ? 2200 : 3200,
                timerProgressBar: true
            });
            return;
        }
        if (window.Tk20Header?.setStatus) {
            window.Tk20Header.setStatus(
                (titulo ? titulo + ': ' : '') + (texto || ''),
                icon === 'error' ? 'error' : 'warn'
            );
        }
    }

    window.Tk20Swal = {
        fire: swalFireTk20,
        toast: mostrarToastTk20,
        success: (titulo, texto) => mostrarToastTk20('success', titulo, texto),
        warn: (titulo, texto) => mostrarToastTk20('warning', titulo, texto),
        error: (titulo, texto) => mostrarToastTk20('error', titulo, texto),
        info: (titulo, texto) => mostrarToastTk20('info', titulo, texto)
    };
}());
