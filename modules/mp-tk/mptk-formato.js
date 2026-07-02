/** Selector MP-TK / TK-2.0 (misma lógica que Visual · Acopio). */
(function initMptkFormatoSelect() {
    const MPTK_FORMATO_KEY = 'tiempos-mptk-formato-v1';
    const sel = document.getElementById('mptk-formato');
    if (!sel) return;

    const paginaActual = String(document.body.dataset.mptkFormato || '1.0').trim();
    const urlMpTk = sel.dataset.urlMpTk || '../mp-tk/';
    const urlTk20 = sel.dataset.urlTk20 || '../tk-2.0/';
    const valid = [...sel.options].map((o) => o.value);

    try {
        const guardado = localStorage.getItem(MPTK_FORMATO_KEY);
        if (paginaActual === '1.0' && guardado === '2.0') {
            window.location.replace(urlTk20);
            return;
        }
        if (paginaActual === '2.0' && guardado === '1.0') {
            window.location.replace(urlMpTk);
            return;
        }
        if (guardado && valid.includes(guardado)) sel.value = guardado;
        else sel.value = paginaActual;
    } catch (_) {
        sel.value = paginaActual;
    }

    sel.disabled = false;
    sel.removeAttribute('disabled');

    sel.addEventListener('change', () => {
        const v = sel.value;
        try {
            localStorage.setItem(MPTK_FORMATO_KEY, v);
        } catch (_) { /* ignore */ }
        if (v === '2.0' && paginaActual !== '2.0') {
            window.location.href = urlTk20;
        } else if (v === '1.0' && paginaActual !== '1.0') {
            window.location.href = urlMpTk;
        }
    });
}());
