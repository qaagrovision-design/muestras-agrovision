/** Presión de vapor (kPa) — ecuación ASHRAE (misma lógica Campo / Packing / MP-TK / TK-2.0). */
(function initPresionVapor(global) {
    const C8 = -5.8002206e3;
    const C9 = 1.3914993;
    const C10 = -4.8640239e-2;
    const C11 = 4.1764768e-5;
    const C12 = -1.4452093e-8;
    const C13 = 6.5459673;

    function numeroSeguro(valor) {
        const n = Number(String(valor ?? '').replace(',', '.').trim());
        return Number.isFinite(n) ? n : null;
    }

    function presionSaturacionKpa_(tempC) {
        const t = numeroSeguro(tempC);
        if (t === null) return null;
        const T = t + 273.15;
        const lnPs = (C8 / T) + C9 + (C10 * T) + (C11 * (T ** 2)) + (C12 * (T ** 3)) + (C13 * Math.log(T));
        const p = Math.exp(lnPs) / 1000;
        return Number.isFinite(p) ? p : null;
    }

    function ambiente(tempC, humedadRelativa) {
        const t = numeroSeguro(tempC);
        const hr = numeroSeguro(humedadRelativa);
        if (t === null || hr === null || hr < 0 || hr > 100) return '';
        const pSat = presionSaturacionKpa_(t);
        if (pSat === null) return '';
        const pV = pSat * (hr / 100);
        return pV.toFixed(3);
    }

    function pulpa(tempPulpaC) {
        const p = presionSaturacionKpa_(tempPulpaC);
        if (p === null) return '';
        return p.toFixed(3);
    }

    global.PresionVapor = {
        numeroSeguro,
        ambiente,
        pulpa
    };
}(typeof window !== 'undefined' ? window : globalThis));
