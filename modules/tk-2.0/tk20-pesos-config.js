/** Pesos 1–8 por etapa + tope vs Campo/Acopio (llegada) y vs llegada (traslado). */
(function initTk20PesosConfig(global) {
    const F = global.Tk20Fields;

    function pesosVisuales(etapa) {
        if (!F) return [];
        const n = F.NUM_CLAMSHELLS || 8;
        const list = [];
        for (let i = 1; i <= n; i++) {
            const c = F.pesoCampo(etapa, i);
            if (c) {
                list.push({
                    key: c.key,
                    label: 'PESO ' + i,
                    modalLabel: 'PESO ' + i + ' (g)',
                    inpId: c.key,
                    num: i
                });
            }
        }
        return list;
    }

    function pesoCampo(etapa, n) {
        const list = pesosVisuales(etapa);
        return list.find((p) => p.num === n) || F?.pesoCampo?.(etapa, n) || null;
    }

    function pesosVacios(etapa) {
        const o = Object.create(null);
        pesosVisuales(etapa).forEach((p) => { o[p.key] = 0; });
        return o;
    }

    function pesoNumero(val) {
        const n = Number(val);
        return Number.isFinite(n) ? n : 0;
    }

    function pesoSuperaLimite(valor, limite) {
        const v = pesoNumero(valor);
        const l = pesoNumero(limite);
        if (l <= 0) return false;
        return v > l + 0.001;
    }

    /** Tope Campo: VISUAL=DESPACHO_ACOPIO · ACOPIO=PESO_5_DESPACHO_CAMPO (despachoPorFila). */
    function limiteDespachoCampo(clamshellNum, detalle) {
        if (!detalle || typeof detalle !== 'object') return null;
        const idx = Math.max(0, Number(clamshellNum) - 1);
        const porFila = Array.isArray(detalle.despachoPorFila) ? detalle.despachoPorFila : [];
        let v = porFila[idx];
        if (v == null || v === '') {
            v = detalle.DESPACHO_ACOPIO ?? detalle.despacho_acopio_gramos;
        }
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function etiquetaLimiteCampo(detalle) {
        const modo = String(detalle?.modo_registro || '').toLowerCase();
        return modo === 'acopio' ? 'PESO_5_DESPACHO_CAMPO' : 'DESPACHO_ACOPIO';
    }

    /**
     * llegada: cada PESO N ≤ despacho Campo/Acopio N
     * traslado: cada PESO N ≤ llegada fruta acopio N
     */
    function validarPesosEtapa(etapaKey, pesos, opts) {
        const errores = [];
        if (!F) return errores;
        const etapa = String(etapaKey || '').trim();
        const map = pesos && typeof pesos === 'object' ? pesos : {};
        const detalle = opts?.detalle || null;
        const llegada = opts?.pesosLlegada && typeof opts.pesosLlegada === 'object'
            ? opts.pesosLlegada
            : {};
        const n = F.NUM_CLAMSHELLS || 8;
        const etiquetaCampo = etiquetaLimiteCampo(detalle);

        for (let i = 1; i <= n; i++) {
            const key = F.peso(etapa, i);
            const val = pesoNumero(map[key]);
            if (val <= 0) continue;

            if (etapa === 'llegada') {
                const lim = limiteDespachoCampo(i, detalle);
                if (lim != null && pesoSuperaLimite(val, lim)) {
                    errores.push('PESO ' + i + ': no puede superar ' + etiquetaCampo + ' (' + lim + 'g).');
                }
            } else if (etapa === 'traslado') {
                const limLleg = pesoNumero(llegada[F.peso('llegada', i)]);
                if (limLleg > 0 && pesoSuperaLimite(val, limLleg)) {
                    errores.push('PESO ' + i + ': no puede superar llegada fruta acopio (' + limLleg + 'g).');
                }
            }
        }
        return errores;
    }

    function validarPesosEstado(estado, detalle) {
        const errores = [];
        const etapas = estado?.etapas || {};
        const llegadaPesos = etapas.llegada?.pesos || {};
        errores.push(...validarPesosEtapa('llegada', llegadaPesos, { detalle }));
        errores.push(...validarPesosEtapa('traslado', etapas.traslado?.pesos || {}, {
            detalle,
            pesosLlegada: llegadaPesos
        }));
        return errores;
    }

    global.Tk20Pesos = {
        pesosVisuales,
        pesoCampo,
        pesosVacios,
        pesoNumero,
        pesoSuperaLimite,
        limiteDespachoCampo,
        validarPesosEtapa,
        validarPesosEstado
    };
}(typeof window !== 'undefined' ? window : globalThis));
