/** Bienvenida breve al entrar a cada módulo — una vez por sesión. */
(function initFlujoBienvenida() {
    const STORAGE_PREFIX = 'flujo-bienvenida-v6:';

    function buildBriefHtml_(lineas, nota) {
        const steps = (lineas || []).map((linea, i) => (
            '<li class="fb-step">'
            + '<span class="fb-step-n">' + (i + 1) + '</span>'
            + '<span class="fb-step-t">' + linea + '</span>'
            + '</li>'
        )).join('');
        const noteHtml = nota
            ? '<p class="fb-note">' + nota + '</p>'
            : '';
        return '<div class="fb-wrap"><ul class="fb-steps">' + steps + '</ul>' + noteHtml + '</div>';
    }

    const FLUJOS = {
        campo: {
            titulo: 'Campo',
            lineas: [
                'Elige fecha y muestra, y registra <b>todos</b> los clamshells.',
                'Al enviar, la muestra queda lista para Packing.'
            ],
            nota: 'Fundo <b>A9</b>: es el primer paso de ambos flujos (con MP-TK o con TK-2.0).'
        },
        acopio: {
            titulo: 'Acopio',
            lineas: [
                'Completa cada clamshell de la muestra.',
                'Al enviar, la muestra queda lista para el siguiente módulo.'
            ],
            nota: 'Fundo <b>A9</b>: después puedes ir a Packing (flujo MP-TK) o a TK-2.0.'
        },
        packing: {
            titulo: 'Packing',
            lineas: [
                'Busca una muestra ya registrada en Campo o Acopio.',
                'Completa hora, responsable y cada clamshell; envía cuando termines.'
            ],
            nota: 'Fundo <b>A9</b> — flujo TK-2.0: si ya enviaste TK-2.0, activa el switch para traer esa muestra (no busca Packing previo).'
        },
        'packing-rc5': {
            titulo: 'Packing RC5',
            lineas: [
                'Solo fundo <b>A9</b>. Busca una muestra con MP-TK ya enviado.',
                'Completa RC5 y envía.'
            ],
            nota: 'Orden: Visual/Acopio → Packing → MP-TK → RC5.'
        },
        'mp-tk': {
            titulo: 'MP-TK',
            lineas: [
                'Solo fundo <b>A9</b>. Busca una muestra con Packing ya enviado.',
                'Registra transporte, tiempos y control; luego envía.'
            ],
            nota: 'Después sigue RC5. Si Packing no está listo, la muestra no aparece.'
        },
        'tk-2.0': {
            titulo: 'TK-2.0',
            lineas: [
                'Solo fundo <b>A9</b>. Busca una muestra de Visual/Acopio.',
                'No necesita Packing antes — registra el viaje y envía.'
            ],
            nota: 'Luego continúa en Packing con el switch TK-2.0 activado. Flujo: Visual/Acopio → TK-2.0 → Packing.'
        }
    };

    function detectarModuloId_() {
        if (window.PACKING_MODULO_ID) return String(window.PACKING_MODULO_ID).trim();
        if (window.PACKING_RC5_MODULE === true) return 'packing-rc5';
        const path = String(window.location.pathname || '').toLowerCase();
        if (path.includes('/packing-rc5/')) return 'packing-rc5';
        if (path.includes('/packing/')) return 'packing';
        if (path.includes('/mp-tk/')) return 'mp-tk';
        if (path.includes('/tk-2.0/')) return 'tk-2.0';
        if (path.includes('/acopio/')) return 'acopio';
        if (path.includes('/campo/')) return 'campo';
        return '';
    }

    function yaMostradaEnSesion_(id) {
        try {
            return sessionStorage.getItem(STORAGE_PREFIX + id) === '1';
        } catch (_) {
            return false;
        }
    }

    function marcarMostradaEnSesion_(id) {
        try {
            sessionStorage.setItem(STORAGE_PREFIX + id, '1');
        } catch (_) { /* ignore */ }
    }

    async function mostrarBienvenidaFlujo(moduloId, opts) {
        const id = String(moduloId || detectarModuloId_() || '').trim();
        if (!id) return false;
        const cfg = FLUJOS[id];
        if (!cfg) return false;
        if (!opts?.forzar && yaMostradaEnSesion_(id)) return false;
        if (!(window.Swal && typeof window.Swal.fire === 'function')) return false;

        const active = document.activeElement;
        if (active && typeof active.blur === 'function') active.blur();

        await window.Swal.fire({
            icon: 'info',
            title: cfg.titulo,
            html: buildBriefHtml_(cfg.lineas, cfg.nota),
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#164C7C',
            width: 'min(400px, 92vw)',
            customClass: {
                popup: 'flujo-bienvenida-popup',
                title: 'flujo-bienvenida-title',
                htmlContainer: 'flujo-bienvenida-swal',
                confirmButton: 'flujo-bienvenida-btn'
            },
            returnFocus: false
        });

        marcarMostradaEnSesion_(id);
        return true;
    }

    function programarBienvenidaFlujo_(opts) {
        const run = () => {
            void mostrarBienvenidaFlujo(opts?.moduloId || detectarModuloId_(), opts);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(run, 380), { once: true });
        } else {
            setTimeout(run, 380);
        }
    }

    window.FlujoBienvenida = {
        mostrar: mostrarBienvenidaFlujo,
        programar: programarBienvenidaFlujo_,
        detectarModuloId: detectarModuloId_,
        FLUJOS
    };

    programarBienvenidaFlujo_();
}());
