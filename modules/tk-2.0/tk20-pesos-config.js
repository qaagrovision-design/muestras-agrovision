/** Pesos 1–N por etapa (grilla 4×2, N según filas de campo) en TK-2.0. */
(function initTk20PesosConfig(global) {
    const F = global.Tk20Fields;

    function pesosVisuales(etapa) {
        if (!F) return [];
        const n = F.getNumPesosEfectivos?.() || F.NUM_CLAMSHELLS || 8;
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

    global.Tk20Pesos = { pesosVisuales, pesoCampo, pesosVacios };
}(typeof window !== 'undefined' ? window : globalThis));
