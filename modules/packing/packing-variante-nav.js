/** Navegación Packing ↔ Packing RC5 — independientes (borrador local separado por módulo). */
(function initPackingVarianteNav() {
    const sel = document.getElementById('header-packing-variante');
    if (!sel) return;

    const isRc5Page = window.PACKING_RC5_MODULE === true;
    const urlPacking = sel.dataset.urlPacking || '../packing/';
    const urlRc5 = sel.dataset.urlRc5 || '../packing-rc5/';

    sel.value = isRc5Page ? 'packing-rc5' : 'packing';

    sel.addEventListener('change', () => {
        const v = sel.value;
        const irARc5 = v === 'packing-rc5' && !isRc5Page;
        const irAPacking = v === 'packing' && isRc5Page;
        if (!irARc5 && !irAPacking) {
            sel.value = isRc5Page ? 'packing-rc5' : 'packing';
            return;
        }
        try {
            if (typeof window.persistirSoloLocalPacking === 'function') {
                window.persistirSoloLocalPacking();
            }
        } catch (_) { /* ignore */ }
        window.location.href = irARc5 ? urlRc5 : urlPacking;
    });
}());
