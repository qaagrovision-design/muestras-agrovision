/**
 * Módulo Acopio: modal de bienvenida cada vez que se entra a esta pestaña.
 */
(function initAcopioBienvenida() {
    function mostrarBienvenidaAcopio() {
        const run = () => {
            if (window.Swal && typeof window.Swal.fire === 'function') {
                window.Swal.fire({
                    icon: 'info',
                    title: 'Bienvenido · Registro Acopio',
                    html: '<p style="margin:0;font-size:14px;line-height:1.45;color:#334155;">'
                        + 'Mismo flujo que <b>Visual</b>: meta, jarras, clamshells, control equitativo y envío a planilla.'
                        + ' Completa los datos antes de salir del turno.</p>',
                    confirmButtonText: 'Comenzar',
                    confirmButtonColor: '#164C7C',
                    allowOutsideClick: true,
                    allowEscapeKey: true
                });
                return;
            }
            try {
                window.alert(
                    'Bienvenido · Registro Acopio\n\n'
                    + 'Mismo flujo que Visual. Completa meta, clamshells y logística antes de enviar.'
                );
            } catch (_) { /* ignore */ }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(run, 280));
        } else {
            setTimeout(run, 280);
        }
    }

    mostrarBienvenidaAcopio();
}());
