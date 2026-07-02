/**
 * Vista previa PDF en tiempo real: si el modal está abierto, regenera al cambiar datos.
 */
(function pdfPreviewLiveModule() {
    let regenerarFn = null;
    let debounceTimer = null;
    const DEBOUNCE_MS = 500;
    let regenerando = false;

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
    }

    async function ejecutar() {
        if (!modalAbierto() || !regenerarFn || regenerando) return;
        regenerando = true;
        try {
            await regenerarFn();
        } catch (err) {
            console.warn('[PdfPreviewLive]', err);
        } finally {
            regenerando = false;
        }
    }

    function programar() {
        if (regenerando) return;
        if (!modalAbierto() || !regenerarFn) return;
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
