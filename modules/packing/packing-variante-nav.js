/** Navegación Packing ↔ Packing RC5 — independientes (sin localStorage compartido). */
(function initPackingVarianteNav() {
    const sel = document.getElementById('header-packing-variante');
    if (!sel) return;

    const isRc5Page = window.PACKING_RC5_MODULE === true;
    const urlPacking = sel.dataset.urlPacking || '../packing/';
    const urlRc5 = sel.dataset.urlRc5 || '../packing-rc5/';

    sel.value = isRc5Page ? 'packing-rc5' : 'packing';

    sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === 'packing-rc5' && !isRc5Page) {
            window.location.href = urlRc5;
            return;
        }
        if (v === 'packing' && isRc5Page) {
            window.location.href = urlPacking;
            return;
        }
        sel.value = isRc5Page ? 'packing-rc5' : 'packing';
    });
}());
