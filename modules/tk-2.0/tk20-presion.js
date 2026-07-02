/** TK-2.0: presión de vapor calculada desde T° y HR (ASHRAE). */
(function initTk20Presion() {
    const F = window.Tk20Fields;
    const PV = window.PresionVapor;
    if (!F || !PV) return;

    function controlVals_() {
        return window.Tk20Control?.getValores?.() || {};
    }

    function calcularEtapa(etapaKey, control) {
        const vals = control || controlVals_();
        const temps = F.tempCampos(etapaKey);
        const hums = F.humCampos(etapaKey);
        const pres = F.presionVaporCampos(etapaKey);
        const out = F.presionVaciosEtapa(etapaKey);

        const ambPairs = [
            [pres[0]?.key, temps[0]?.key, hums[0]?.key],
            [pres[1]?.key, temps[1]?.key, hums[1]?.key],
            [pres[2]?.key, temps[2]?.key, hums[2]?.key]
        ];
        ambPairs.forEach(([presKey, tempKey, humKey]) => {
            if (!presKey) return;
            const t = PV.numeroSeguro(vals[tempKey]);
            const h = PV.numeroSeguro(vals[humKey]);
            out[presKey] = (t !== null && h !== null) ? PV.ambiente(t, h) : '';
        });

        const pulpaKey = pres[3]?.key;
        const pulpaTempKey = temps[3]?.key;
        if (pulpaKey && pulpaTempKey) {
            const tPulpa = PV.numeroSeguro(vals[pulpaTempKey]);
            out[pulpaKey] = tPulpa !== null ? PV.pulpa(tPulpa) : '';
        }
        return out;
    }

    function aplicarEnCard_(etapaKey, presion, opts) {
        const card = window.Tk20Body?.getEtapaCard?.(etapaKey);
        if (card) card.presion = presion;
        if (opts?.render !== false) window.Tk20Body?.renderCards?.();
        return presion;
    }

    function recalcularEtapa(etapaKey, opts) {
        return aplicarEnCard_(etapaKey, calcularEtapa(etapaKey, opts?.control), opts);
    }

    function recalcularTodas(opts) {
        const control = opts?.control || controlVals_();
        [F.ETAPAS.llegada, F.ETAPAS.traslado].forEach((etapaKey) => {
            aplicarEnCard_(etapaKey, calcularEtapa(etapaKey, control), { render: false });
        });
        if (opts?.render !== false) window.Tk20Body?.renderCards?.();
    }

    window.Tk20Presion = {
        calcularEtapa,
        recalcularEtapa,
        recalcularTodas
    };
}());
