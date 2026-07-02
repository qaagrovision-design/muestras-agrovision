/**
 * Genera y guarda PDF en caché local al confirmar envío (Campo / Acopio / Packing).
 */
(function histPdfEnvioModule() {
    function numeroDesdeEnsayoTexto(ensayo) {
        const m = String(ensayo || '').trim().match(/\d+/);
        return m ? m[0] : '';
    }

    /** N° muestra por ensayo desde filas POST (col. 1 = ensayo, 2 = N°, 13 = nº ensayo). */
    function numMuestraDesdeFilasPost_(ensayo, rows) {
        if (!Array.isArray(rows) || !rows.length) return '';
        const ens = String(ensayo || '').trim();
        const ensNum = numeroDesdeEnsayoTexto(ens);
        const row = rows.find((r) => {
            if (!r || r.length < 3) return false;
            const nom = String(r[1] || '').trim();
            const numEn = String(r[13] || '').trim();
            return (ens && nom === ens) || (ensNum && numEn === ensNum);
        });
        return row ? String(row[2] || '').trim().toUpperCase() : '';
    }

    function resolverNumMuestraPdfEnsayo_(ensayo, datos, numsPorEnsayo, opts) {
        const e = String(ensayo || '').trim();
        const mapa = numsPorEnsayo && typeof numsPorEnsayo === 'object' ? numsPorEnsayo : {};
        const desdeMapa = String(mapa[e] || '').trim();
        if (desdeMapa) return desdeMapa.toUpperCase();
        const rows = opts?.payloadRows || opts?.payload?.rows;
        const desdeFilas = numMuestraDesdeFilasPost_(e, rows);
        if (desdeFilas) return desdeFilas;
        const idx = datos?.muestras?.findIndex((m) => String(m?.ensayo || '') === e);
        if (idx >= 0) {
            const desdeDatos = String(datos.muestras[idx]?.meta?.numMuestra || '').trim();
            if (desdeDatos) return desdeDatos.toUpperCase();
        }
        return '';
    }

    async function guardarCampoDesdeDatos(datos, ensayosLista, fechaIso, opts) {
        opts = opts || {};
        const numsPorEnsayo = opts.numsPorEnsayo && typeof opts.numsPorEnsayo === 'object' ? opts.numsPorEnsayo : {};
        if (!window.HistPdfStore || typeof window.generarPdfCampoBlob !== 'function') return false;
        const ensayos = (Array.isArray(ensayosLista) ? ensayosLista : [ensayosLista])
            .map((e) => String(e || '').trim())
            .filter(Boolean);
        if (!ensayos.length || !datos?.muestras?.length) return false;
        const blob = await window.generarPdfCampoBlob(datos);
        const nombre = typeof window.nombreArchivoPdfCampo === 'function'
            ? window.nombreArchivoPdfCampo(datos)
            : 'campo.pdf';
        const modulo = String(datos.modoRegistro || opts.modo_registro || '').toLowerCase() === 'acopio' ? 'acopio' : 'campo';
        const fecha = window.HistPdfStore.normalizarFecha(fechaIso) || window.HistPdfStore.normalizarFecha(datos.fecha);
        const muestras = ensayos.map((ensayo) => {
            const num = resolverNumMuestraPdfEnsayo_(ensayo, datos, numsPorEnsayo, opts);
            return {
                fecha,
                ensayo_numero: numeroDesdeEnsayoTexto(ensayo),
                num_muestra: num,
                modulo
            };
        }).filter((m) => m.ensayo_numero && m.num_muestra);
        if (!muestras.length) {
            console.warn('[HistPDF] guardarCampo: faltan N° muestra por ensayo', { ensayos, numsPorEnsayo });
            return false;
        }
        await window.HistPdfStore.guardarBlobParaMuestras(blob, nombre, muestras);
        return true;
    }

    async function guardarCampo(ensayosLista, fechaIso, opts) {
        opts = opts || {};
        const ensayos = (Array.isArray(ensayosLista) ? ensayosLista : [ensayosLista])
            .map((e) => String(e || '').trim())
            .filter(Boolean);
        if (!ensayos.length) return false;
        if (opts.datos?.muestras?.length) {
            return guardarCampoDesdeDatos(opts.datos, ensayos, fechaIso, opts);
        }
        if (typeof window.obtenerDatosPdfCampoParaEnsayos !== 'function') return false;
        const datos = window.obtenerDatosPdfCampoParaEnsayos(ensayos);
        return guardarCampoDesdeDatos(datos, ensayos, fechaIso, opts);
    }

    async function guardarPacking(capturas, fechaIso, opts) {
        if (!window.HistPdfStore || typeof window.generarPdfPackingBlob !== 'function') return false;
        if (typeof window.obtenerDatosPdfPackingParaCapturas !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        if (!lista.length) return false;
        const modulo = String(opts?.modulo || window.PACKING_MODULO_ID || 'packing').trim().toLowerCase();
        try {
            const datos = window.obtenerDatosPdfPackingParaCapturas(lista);
            if (!datos?.muestras?.length) return false;
            const blob = await window.generarPdfPackingBlob(datos);
            const nombre = typeof window.nombreArchivoPdfPacking === 'function'
                ? window.nombreArchivoPdfPacking(datos)
                : 'packing.pdf';
            const fecha = window.HistPdfStore.normalizarFecha(fechaIso);
            const muestras = lista.map((c) => ({
                fecha,
                ensayo_numero: String(c.ensayo_numero || '').trim(),
                num_muestra: String(c.num_muestra || '').trim().toUpperCase(),
                modulo
            })).filter((m) => m.ensayo_numero && m.num_muestra);
            if (!muestras.length) return false;
            await window.HistPdfStore.guardarBlobParaMuestras(blob, nombre, muestras);
            return true;
        } catch (err) {
            console.warn('[HistPDF] PDF packing no guardado:', err?.message || err);
            return false;
        }
    }

    async function guardarTk20(capturas, fechaIso) {
        if (!window.HistPdfStore || typeof window.generarPdfTk20Blob !== 'function') return false;
        if (typeof window.obtenerDatosPdfTk20ParaCapturas !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        if (!lista.length) return false;
        try {
            const datos = window.obtenerDatosPdfTk20ParaCapturas(lista);
            if (!datos?.muestras?.length) return false;
            const blob = await window.generarPdfTk20Blob(datos);
            const nombre = typeof window.nombreArchivoPdfTk20 === 'function'
                ? window.nombreArchivoPdfTk20(datos)
                : 'tk20.pdf';
            const fecha = window.HistPdfStore.normalizarFecha(fechaIso);
            const muestras = lista.map((c) => ({
                fecha,
                ensayo_numero: String(c.ensayo_numero || '').trim(),
                num_muestra: String(c.num_muestra || '').trim().toUpperCase(),
                modulo: 'tk-2.0'
            })).filter((m) => m.ensayo_numero && m.num_muestra);
            if (!muestras.length) return false;
            await window.HistPdfStore.guardarBlobParaMuestras(blob, nombre, muestras);
            return true;
        } catch (err) {
            console.warn('[HistPDF] PDF TK-2.0 no guardado:', err?.message || err);
            return false;
        }
    }

    async function guardarMptk(capturas, fechaIso) {
        if (!window.HistPdfStore || typeof window.generarPdfMptkBlob !== 'function') return false;
        if (typeof window.obtenerDatosPdfMptkParaCapturas !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        if (!lista.length) return false;
        try {
            const datos = window.obtenerDatosPdfMptkParaCapturas(lista);
            if (!datos?.muestras?.length) return false;
            const blob = await window.generarPdfMptkBlob(datos);
            const nombre = typeof window.nombreArchivoPdfMptk === 'function'
                ? window.nombreArchivoPdfMptk(datos)
                : 'mp-tk.pdf';
            const fecha = window.HistPdfStore.normalizarFecha(fechaIso);
            const muestras = lista.map((c) => ({
                fecha,
                ensayo_numero: String(c.ensayo_numero || '').trim(),
                num_muestra: String(c.num_muestra || '').trim().toUpperCase(),
                modulo: 'mptk'
            })).filter((m) => m.ensayo_numero && m.num_muestra);
            if (!muestras.length) return false;
            await window.HistPdfStore.guardarBlobParaMuestras(blob, nombre, muestras);
            return true;
        } catch (err) {
            console.warn('[HistPDF] PDF MP-TK no guardado:', err?.message || err);
            return false;
        }
    }

    window.HistPdfEnvio = {
        guardarCampo,
        guardarCampoDesdeDatos,
        guardarPacking,
        guardarTk20,
        guardarMptk,
        numMuestraDesdeFilasPost_,
        resolverNumMuestraPdfEnsayo_
    };
})();
