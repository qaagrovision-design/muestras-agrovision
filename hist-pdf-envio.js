/**
 * Genera y guarda PDF en caché local al confirmar envío (Campo / Acopio / Packing).
 */
(function histPdfEnvioModule() {
    function numeroDesdeEnsayoTexto(ensayo) {
        const m = String(ensayo || '').trim().match(/\d+/);
        return m ? m[0] : '';
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
        const modulo = String(datos.modoRegistro || '').toLowerCase() === 'acopio' ? 'acopio' : 'campo';
        const fecha = window.HistPdfStore.normalizarFecha(fechaIso) || window.HistPdfStore.normalizarFecha(datos.fecha);
        const muestras = ensayos.map((ensayo) => {
            const idx = datos.muestras.findIndex((m) => String(m?.ensayo || '') === ensayo);
            const d = idx >= 0 ? datos.muestras[idx] : null;
            const num = String(
                numsPorEnsayo[ensayo]
                || d?.meta?.numMuestra
                || opts.num_muestra
                || ''
            ).trim().toUpperCase();
            return {
                fecha,
                ensayo_numero: numeroDesdeEnsayoTexto(ensayo),
                num_muestra: num,
                modulo
            };
        }).filter((m) => m.ensayo_numero && m.num_muestra);
        if (!muestras.length) {
            console.warn('[HistPDF] guardarCampo: faltan N° muestra', { ensayos, numsPorEnsayo });
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

    async function guardarPacking(capturas, fechaIso) {
        if (!window.HistPdfStore || typeof window.generarPdfPackingBlob !== 'function') return false;
        if (typeof window.obtenerDatosPdfPackingParaCapturas !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        if (!lista.length) return false;
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
                modulo: 'packing'
            })).filter((m) => m.ensayo_numero && m.num_muestra);
            if (!muestras.length) return false;
            await window.HistPdfStore.guardarBlobParaMuestras(blob, nombre, muestras);
            return true;
        } catch (err) {
            console.warn('[HistPDF] PDF packing no guardado:', err?.message || err);
            return false;
        }
    }

    window.HistPdfEnvio = {
        guardarCampo,
        guardarCampoDesdeDatos,
        guardarPacking
    };
})();
