/** Nombres lógicos de campos TK-2.0 (prefijo tk2_) — alineados a planilla Llegada / Traslado. */
(function initTk20Fields(global) {
    const ETAPAS = {
        llegada: 'llegada',
        traslado: 'traslado'
    };

    function prefijoEtapa(etapa) {
        return etapa === ETAPAS.llegada ? 'tk2_llegada' : 'tk2_traslado';
    }

    function horaEtapa(etapa) {
        return prefijoEtapa(etapa) + '_hora';
    }

    function observacionEtapa(etapa) {
        return prefijoEtapa(etapa) + '_observacion';
    }

    /** @deprecated usar horaEtapa */
    function hora(etapa, n) {
        return n != null ? (prefijoEtapa(etapa) + '_hora_' + n) : horaEtapa(etapa);
    }

    function responsable() {
        return 'tk2_responsable';
    }

    function placa() {
        return 'tk2_placa';
    }

    function guiaRemision() {
        return 'tk2_guia_remision';
    }

    function acopio() {
        return 'tk2_acopio';
    }

    function observacion(etapa, n) {
        return n != null ? (prefijoEtapa(etapa) + '_observacion_' + n) : observacionEtapa(etapa);
    }

    function peso(etapa, n) {
        return prefijoEtapa(etapa) + '_peso_' + n;
    }

    const NUM_CLAMSHELLS = 8;
    let numPesosEfectivos = NUM_CLAMSHELLS;

    function cuotaPesosDesdeDetalle(d) {
        if (!d || typeof d !== 'object') return 0;
        let max = Number(d.MAX_CLAMSHELL ?? d.maxClamshell ?? 0);
        if (!max && d.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        const totalCampo = Number(d.FILAS_TOTAL_CAMPO ?? d.numFilas ?? 0);
        if (totalCampo > 0 && (max <= 0 || max < totalCampo)) max = totalCampo;
        return max > 0 ? max : 0;
    }

    function getNumPesosEfectivos() {
        return numPesosEfectivos > 0 ? numPesosEfectivos : NUM_CLAMSHELLS;
    }

    function setCuotaPesosDesdeDetalle(d) {
        const max = cuotaPesosDesdeDetalle(d);
        numPesosEfectivos = max > 0 ? Math.min(max, NUM_CLAMSHELLS) : NUM_CLAMSHELLS;
    }

    function resetCuotaPesos() {
        numPesosEfectivos = NUM_CLAMSHELLS;
    }

    function pesoCampo(etapa, n) {
        const key = peso(etapa, n);
        return {
            key,
            label: 'PESO ' + n,
            modalLabel: 'PESO ' + n + ' (g)',
            inpId: key,
            num: n
        };
    }

    function pesosVaciosEtapa(etapa) {
        const o = Object.create(null);
        for (let i = 1; i <= NUM_CLAMSHELLS; i++) {
            o[peso(etapa, i)] = 0;
        }
        return o;
    }

    const TEMP_CAMPOS = [
        { suffix: 't_amb_ext', label: 'Temperatura exterior ambiente', shortLabel: 'T° ext.', aria: 'Temperatura exterior ambiente' },
        { suffix: 't_amb_acopio', label: 'Temperatura ambiente del acopio', shortLabel: 'T° acop.', aria: 'Temperatura ambiente del acopio' },
        { suffix: 't_amb_veh', label: 'Temperatura ambiente interior del vehículo', shortLabel: 'T° veh.', aria: 'Temperatura ambiente interior del vehículo' },
        { suffix: 't_pulpa', label: 'Temperatura pulpa', shortLabel: 'T° pulpa', aria: 'Temperatura pulpa' }
    ];

    const HUM_CAMPOS = [
        { suffix: 'hr_ext', label: 'Humedad relativa exterior', shortLabel: 'HR ext.', aria: 'Humedad relativa exterior' },
        { suffix: 'hr_acopio', label: 'Humedad relativa del acopio', shortLabel: 'HR acop.', aria: 'Humedad relativa del acopio' },
        { suffix: 'hr_veh', label: 'Humedad relativa interior del vehículo', shortLabel: 'HR veh.', aria: 'Humedad relativa interior del vehículo' }
    ];

    const PRESION_AMB_CAMPOS = [
        { suffix: 'pv_amb_ext', label: 'Presión exterior del ambiente', shortLabel: 'P. ext.' },
        { suffix: 'pv_amb_acopio', label: 'Presión ambiente del acopio', shortLabel: 'P. acop.' },
        { suffix: 'pv_amb_veh', label: 'Presión ambiente interior vehículo', shortLabel: 'P. veh.' }
    ];

    const PRESION_FRUTA_CAMPOS = [
        { suffix: 'pv_pulpa', label: 'Presión de fruta - pulpa', shortLabel: 'P. pulpa' }
    ];

    function campoEtapa(etapa, suffix) {
        return prefijoEtapa(etapa) + '_' + suffix;
    }

    function tempCampos(etapa) {
        return TEMP_CAMPOS.map((c) => ({
            key: campoEtapa(etapa, c.suffix),
            label: c.label,
            shortLabel: c.shortLabel || c.label,
            aria: c.aria
        }));
    }

    function humCampos(etapa) {
        return HUM_CAMPOS.map((c) => ({
            key: campoEtapa(etapa, c.suffix),
            label: c.label,
            shortLabel: c.shortLabel || c.label,
            aria: c.aria
        }));
    }

    function presionAmbCampos(etapa) {
        return PRESION_AMB_CAMPOS.map((c) => ({
            key: campoEtapa(etapa, c.suffix),
            label: c.label,
            shortLabel: c.shortLabel || c.label
        }));
    }

    function presionFrutaCampos(etapa) {
        return PRESION_FRUTA_CAMPOS.map((c) => ({
            key: campoEtapa(etapa, c.suffix),
            label: c.label,
            shortLabel: c.shortLabel || c.label
        }));
    }

    /** 4 columnas PRESIÓN DE VAPOR (Kpa) por etapa — planilla Llegada / Traslado. */
    function presionVaporCampos(etapa) {
        return presionAmbCampos(etapa).concat(presionFrutaCampos(etapa));
    }

    function presionVaciosEtapa(etapa) {
        const o = Object.create(null);
        presionVaporCampos(etapa).forEach((c) => { o[c.key] = ''; });
        return o;
    }

    global.Tk20Fields = {
        ETAPAS,
        prefijoEtapa,
        horaEtapa,
        observacionEtapa,
        hora,
        responsable,
        placa,
        guiaRemision,
        acopio,
        observacion,
        peso,
        pesoCampo,
        NUM_CLAMSHELLS,
        cuotaPesosDesdeDetalle,
        getNumPesosEfectivos,
        setCuotaPesosDesdeDetalle,
        resetCuotaPesos,
        pesosVaciosEtapa,
        tempCampos,
        humCampos,
        presionAmbCampos,
        presionFrutaCampos,
        presionVaporCampos,
        presionVaciosEtapa
    };
}(typeof window !== 'undefined' ? window : globalThis));
