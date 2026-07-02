/** FUNDO col G: flujo TK-2.0, MP-TK y Packing RC5 solo cuando FUNDO === A9. */
(function initFundoFlujoTk20() {
    const FUNDO_FLUJO_TK20 = 'A9';

    function normalizarFundo(v) {
        return String(v ?? '').trim().toUpperCase();
    }

    function habilita(fundo) {
        return normalizarFundo(fundo) === FUNDO_FLUJO_TK20;
    }

    function habilitaDesdeDetalle(d) {
        if (!d || typeof d !== 'object') return false;
        if (d.fundo_habilita_flujo_tk20 === true) return true;
        if (d.fundo_habilita_flujo_tk20 === false) return false;
        return habilita(d.FUNDO ?? d.fundo);
    }

    function mensajeFundoNoHabilitado(d) {
        if (window.MensajesFlujo?.fundoNoUsaTk20) {
            return window.MensajesFlujo.fundoNoUsaTk20(d);
        }
        const fundo = String(d?.FUNDO ?? d?.fundo ?? '').trim() || '—';
        return 'Esta muestra es fundo ' + fundo + '. TK-2.0 solo aplica a fundo A9.';
    }

    window.FundoFlujoTk20 = {
        VALOR: FUNDO_FLUJO_TK20,
        habilita,
        habilitaDesdeDetalle,
        mensajeFundoNoHabilitado
    };
}());
