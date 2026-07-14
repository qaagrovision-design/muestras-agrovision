/**
 * Genera y guarda PDF en caché local al confirmar envío (Campo / Acopio / Packing / TK / MP-TK).
 * Reintentos + verificación: el PDF debe quedar legible en Historial.
 */
(function histPdfEnvioModule() {
    const ENVIO_INTENTOS = 3;

    function sleepMs_(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function numeroDesdeEnsayoTexto(ensayo) {
        const m = String(ensayo || '').trim().match(/\d+/);
        return m ? m[0] : '';
    }

    /** N° muestra por ensayo desde filas POST (col. 1 = ensayo, 2 = N°, 14 = nº ensayo; 13 = TRAZ_ACOPIO). */
    function numMuestraDesdeFilasPost_(ensayo, rows) {
        if (!Array.isArray(rows) || !rows.length) return '';
        const ens = String(ensayo || '').trim();
        const ensNum = numeroDesdeEnsayoTexto(ens);
        const row = rows.find((r) => {
            if (!r || r.length < 3) return false;
            const nom = String(r[1] || '').trim();
            const numEn = String(r[14] || '').trim();
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

    async function verificarGuardado_(meta) {
        if (!window.HistPdfStore || typeof window.HistPdfStore.existe !== 'function') return false;
        return window.HistPdfStore.existe(
            meta.fecha,
            meta.ensayo_numero,
            meta.num_muestra,
            meta.modulo
        );
    }

    async function guardarBlobVerificado_(blob, nombre, meta) {
        if (!window.HistPdfStore || typeof window.HistPdfStore.guardarBlobParaMuestras !== 'function') {
            return false;
        }
        const okPut = await window.HistPdfStore.guardarBlobParaMuestras(blob, nombre, [meta]);
        if (okPut === false) return false;
        return verificarGuardado_(meta);
    }

    async function conReintentosEnvio_(etiqueta, fn) {
        let lastErr = null;
        for (let i = 1; i <= ENVIO_INTENTOS; i++) {
            try {
                const ok = await fn();
                if (ok) return true;
                lastErr = new Error(etiqueta + ': guardado no verificado');
            } catch (err) {
                lastErr = err;
            }
            console.warn('[HistPDF] ' + etiqueta + ' intento ' + i + '/' + ENVIO_INTENTOS, lastErr?.message || lastErr);
            if (i < ENVIO_INTENTOS) await sleepMs_(220 * i);
        }
        return false;
    }

    async function guardarCampoDesdeDatos(datos, ensayosLista, fechaIso, opts) {
        opts = opts || {};
        const numsPorEnsayo = opts.numsPorEnsayo && typeof opts.numsPorEnsayo === 'object' ? opts.numsPorEnsayo : {};
        if (!window.HistPdfStore || typeof window.generarPdfCampoBlob !== 'function') return false;
        const ensayos = (Array.isArray(ensayosLista) ? ensayosLista : [ensayosLista])
            .map((e) => String(e || '').trim())
            .filter(Boolean);
        if (!ensayos.length || !datos?.muestras?.length) return false;
        const modulo = String(datos.modoRegistro || opts.modo_registro || '').toLowerCase() === 'acopio' ? 'acopio' : 'campo';
        const fecha = window.HistPdfStore.normalizarFecha(fechaIso) || window.HistPdfStore.normalizarFecha(datos.fecha);
        let guardados = 0;
        for (let i = 0; i < ensayos.length; i++) {
            const ensayo = ensayos[i];
            const muestrasFilt = (datos.muestras || []).filter((m) => String(m?.ensayo || '').trim() === ensayo);
            if (!muestrasFilt.length) continue;
            const datosUno = Object.assign({}, datos, { muestras: muestrasFilt });
            const ensayoNum = numeroDesdeEnsayoTexto(ensayo);
            const num = resolverNumMuestraPdfEnsayo_(ensayo, datosUno, numsPorEnsayo, opts);
            if (!ensayoNum || !num) {
                console.warn('[HistPDF] guardarCampo: falta N° muestra', { ensayo, numsPorEnsayo });
                continue;
            }
            const meta = {
                fecha,
                ensayo_numero: ensayoNum,
                num_muestra: num,
                modulo
            };
            const ok = await conReintentosEnvio_('campo ' + ensayo, async () => {
                const blob = await window.generarPdfCampoBlob(datosUno);
                const nombre = typeof window.nombreArchivoPdfCampo === 'function'
                    ? window.nombreArchivoPdfCampo(datosUno)
                    : 'campo.pdf';
                return guardarBlobVerificado_(blob, nombre, meta);
            });
            if (ok) guardados++;
        }
        return guardados > 0;
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
        const fecha = window.HistPdfStore.normalizarFecha(fechaIso);
        let guardados = 0;
        for (let i = 0; i < lista.length; i++) {
            const c = lista[i];
            const ensayo_numero = String(c.ensayo_numero || '').trim();
            const num_muestra = String(c.num_muestra || '').trim().toUpperCase();
            if (!ensayo_numero || !num_muestra) continue;
            const meta = { fecha, ensayo_numero, num_muestra, modulo };
            const ok = await conReintentosEnvio_('packing ' + num_muestra, async () => {
                const datos = window.obtenerDatosPdfPackingParaCapturas([c]);
                if (!datos?.muestras?.length) return false;
                const blob = await window.generarPdfPackingBlob(datos);
                const nombre = typeof window.nombreArchivoPdfPacking === 'function'
                    ? window.nombreArchivoPdfPacking(datos)
                    : 'packing.pdf';
                return guardarBlobVerificado_(blob, nombre, meta);
            });
            if (ok) guardados++;
        }
        return guardados > 0;
    }

    async function guardarTk20(capturas, fechaIso) {
        if (!window.HistPdfStore || typeof window.generarPdfTk20Blob !== 'function') return false;
        if (typeof window.obtenerDatosPdfTk20ParaCapturas !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        if (!lista.length) return false;
        const fecha = window.HistPdfStore.normalizarFecha(fechaIso);
        let guardados = 0;
        for (let i = 0; i < lista.length; i++) {
            const c = lista[i];
            const ensayo_numero = String(c.ensayo_numero || '').trim();
            const num_muestra = String(c.num_muestra || '').trim().toUpperCase();
            if (!ensayo_numero || !num_muestra) continue;
            const meta = { fecha, ensayo_numero, num_muestra, modulo: 'tk-2.0' };
            const ok = await conReintentosEnvio_('tk20 ' + num_muestra, async () => {
                const datos = window.obtenerDatosPdfTk20ParaCapturas([c]);
                if (!datos?.muestras?.length) return false;
                const blob = await window.generarPdfTk20Blob(datos);
                const nombre = typeof window.nombreArchivoPdfTk20 === 'function'
                    ? window.nombreArchivoPdfTk20(datos)
                    : 'tk20.pdf';
                return guardarBlobVerificado_(blob, nombre, meta);
            });
            if (ok) guardados++;
        }
        return guardados > 0;
    }

    async function guardarMptk(capturas, fechaIso) {
        if (!window.HistPdfStore || typeof window.generarPdfMptkBlob !== 'function') return false;
        if (typeof window.obtenerDatosPdfMptkParaCapturas !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        if (!lista.length) return false;
        const fecha = window.HistPdfStore.normalizarFecha(fechaIso);
        let guardados = 0;
        for (let i = 0; i < lista.length; i++) {
            const c = lista[i];
            const ensayo_numero = String(c.ensayo_numero || '').trim();
            const num_muestra = String(c.num_muestra || '').trim().toUpperCase();
            if (!ensayo_numero || !num_muestra) continue;
            const meta = { fecha, ensayo_numero, num_muestra, modulo: 'mptk' };
            const ok = await conReintentosEnvio_('mptk ' + num_muestra, async () => {
                const datos = window.obtenerDatosPdfMptkParaCapturas([c]);
                if (!datos?.muestras?.length) return false;
                const blob = await window.generarPdfMptkBlob(datos);
                const nombre = typeof window.nombreArchivoPdfMptk === 'function'
                    ? window.nombreArchivoPdfMptk(datos)
                    : 'mp-tk.pdf';
                return guardarBlobVerificado_(blob, nombre, meta);
            });
            if (ok) guardados++;
        }
        return guardados > 0;
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
