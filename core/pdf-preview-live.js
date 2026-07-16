/**
 * Vista previa PDF en tiempo real: si el modal está abierto, regenera al cambiar datos.
 * Evita colas pesadas: un regen a la vez + 1 pendiente, debounce largo.
 */
(function pdfPreviewLiveModule() {
    let regenerarFn = null;
    let debounceTimer = null;
    const DEBOUNCE_MS = 1400;
    let regenerando = false;
    let pendienteTrasRegen = false;

    function modalAbierto() {
        const ov = document.getElementById('pdf-modal-overlay');
        if (!ov || ov.hidden) return false;
        const style = window.getComputedStyle(ov);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function registrar(regenerar) {
        if (typeof regenerar === 'function') regenerarFn = regenerar;
    }

    function limpiar() {
        regenerarFn = null;
        clearTimeout(debounceTimer);
        debounceTimer = null;
        regenerando = false;
        pendienteTrasRegen = false;
    }

    async function ejecutar() {
        if (!modalAbierto() || !regenerarFn) return;
        if (regenerando) {
            pendienteTrasRegen = true;
            return;
        }
        regenerando = true;
        pendienteTrasRegen = false;
        try {
            await regenerarFn();
        } catch (err) {
            console.warn('[PdfPreviewLive]', err);
        } finally {
            regenerando = false;
            if (pendienteTrasRegen && modalAbierto() && regenerarFn) {
                pendienteTrasRegen = false;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => void ejecutar(), DEBOUNCE_MS);
            }
        }
    }

    function programar() {
        if (!modalAbierto() || !regenerarFn) return;
        if (regenerando) {
            pendienteTrasRegen = true;
            return;
        }
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void ejecutar(), DEBOUNCE_MS);
    }

    window.PdfPreviewLive = {
        registrar,
        limpiar,
        programar,
        modalAbierto,
        estaRegenerando: () => regenerando,
        ejecutarAhora: ejecutar
    };
}());
