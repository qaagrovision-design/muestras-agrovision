/**
 * PDF Agrovision (Packing) — Formulario físico PE-F-OPH-309.
 */
(function packingPdfModule() {
    const LOGO_URL = '../../assets/images/log.png';

    function profundidadDesdeRaizProyectoPackingPdf_() {
        const path = String(window.location.pathname || '').replace(/\\/g, '/');
        const segments = path.split('/').filter(Boolean);
        if (!segments.length) return 0;
        const last = segments[segments.length - 1];
        return /\.html?$/i.test(last) ? segments.length - 1 : segments.length;
    }

    function baseRaizPackingPdf_() {
        const depth = profundidadDesdeRaizProyectoPackingPdf_();
        if (depth <= 0) return './assets/';
        return '../'.repeat(depth) + 'assets/';
    }

    function urlPackingPdfDesdeRaiz_(rel) {
        const base = baseRaizPackingPdf_();
        try {
            return new URL(base + rel, document.baseURI || window.location.href).href;
        } catch (_) {
            return base + rel;
        }
    }

    const PACKING_PDF_FILAS = 21;
    /** Fila 11 (índice 10): inicio segunda muestra en la misma hoja. */
    const PACKING_PDF_INICIO_SEGUNDA_MUESTRA = 10;
    /** Etiquetas de etapa en una sola línea (Tiempos, Pesos, Humedad, hoja 2). */
    const STAGE_LABELS_PDF = [
        'RECEPCIÓN',
        'INGRESO GASIFICADO',
        'SALIDA GASIFICADO',
        'INGRESO PREFRIO',
        'SALIDA PREFRIO'
    ];
    /** Solo bloque TEMPERATURA MUESTRA (°C): dos líneas por etapa. */
    const STAGE_LABELS_TEMP_PDF = [
        ['RECEPCIÓN'],
        ['INGRESO', 'GASIFICADO'],
        ['SALIDA', 'GASIFICADO'],
        ['INGRESO', 'PREFRIO'],
        ['SALIDA', 'PREFRIO']
    ];
    const PAGE = { w: 297, h: 210, margin: 7 };
    const GRIS_CABECERA = { r: 217, g: 217, b: 217 };
    const ANGULO_EXCEL_HACIA_ARRIBA = 90;
    const FS_CABECERA_TABLA = 6.4;
    const FS_CABECERA_GRUPO = FS_CABECERA_TABLA;
    const FS_CABECERA_VERTICAL = FS_CABECERA_TABLA;
    const FS_CABECERA_VERTICAL_MIN = 3.5;
    const PAD_CELDA_VERTICAL_X = 3.9;
    const PAD_CELDA_VERTICAL_Y = 1.5;
    const ANCLAJE_VERTICAL = {
        angle: ANGULO_EXCEL_HACIA_ARRIBA,
        align: 'left',
        baseline: 'bottom'
    };

    let logoDataUrlCache = null;
    let pdfBlobActual = null;
    let pdfNombreActual = 'medicion-recepcion-arandano.pdf';
    let pdfDatosActual = null;
    let pdfUrlActual = null;
    let pdfjsLibInited = false;
    let pdfPreviewSession = null;
    let ultimoHashPdfVivoPacking_ = '';
    const pdfZoomState = { scale: 1, min: 0.6, max: 4, step: 0.35 };
    const PDF_PREVIEW_DPR = () => Math.min(window.devicePixelRatio || 1, 3);

    function workerSrcPdfJs() {
        return urlPackingPdfDesdeRaiz_('librerias/pdf.worker.min.js');
    }

    function standardFontsUrlPdfJs() {
        return urlPackingPdfDesdeRaiz_('librerias/standard_fonts/');
    }

    function obtenerPdfJs() {
        const lib = window.pdfjsLib;
        if (!lib) return null;
        if (!pdfjsLibInited) {
            lib.GlobalWorkerOptions.workerSrc = workerSrcPdfJs();
            pdfjsLibInited = true;
        }
        return lib;
    }

    function esperarLayoutModal() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
    }

    function estadoVistaPreviaPdf(estado) {
        const stage = document.getElementById('pdf-preview-stage');
        const loading = document.getElementById('pdf-preview-loading');
        const fallback = document.getElementById('pdf-preview-fallback');
        const pages = document.getElementById('pdf-preview-pages');
        if (stage) stage.dataset.state = estado;
        if (loading) loading.style.display = estado === 'loading' ? 'flex' : 'none';
        if (pages) pages.style.display = estado === 'ready' ? 'flex' : 'none';
        if (fallback) {
            fallback.hidden = estado !== 'error';
            fallback.style.display = estado === 'error' ? 'flex' : 'none';
        }
    }

    function esDispositivoMovil() {
        const ua = String(navigator.userAgent || '');
        return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    }

    function prefiereVisorPdfNativo() {
        return !esDispositivoMovil();
    }

    async function cargarPdfParaVista(lib, data, sinWorker) {
        const task = lib.getDocument({
            data,
            disableWorker: !!sinWorker,
            isEvalSupported: false,
            standardFontDataUrl: standardFontsUrlPdfJs(),
            verbosity: 0
        });
        return task.promise;
    }

    function mostrarVisorPdfNativo(url) {
        const embed = document.getElementById('pdf-preview-embed');
        const scaler = document.getElementById('pdf-preview-scaler');
        const zoomBar = document.getElementById('pdf-preview-zoom-bar');
        if (!embed) return false;
        embed.src = `${url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
        embed.hidden = false;
        if (scaler) scaler.hidden = true;
        if (zoomBar) zoomBar.hidden = true;
        estadoVistaPreviaPdf('ready');
        return true;
    }

    function ocultarVisorPdfNativo() {
        const embed = document.getElementById('pdf-preview-embed');
        const scaler = document.getElementById('pdf-preview-scaler');
        const zoomBar = document.getElementById('pdf-preview-zoom-bar');
        if (embed) {
            embed.removeAttribute('src');
            embed.hidden = true;
        }
        if (scaler) scaler.hidden = false;
        if (zoomBar) zoomBar.hidden = false;
    }

    function revocarPdfUrlActual() {
        if (pdfUrlActual) {
            try { URL.revokeObjectURL(pdfUrlActual); } catch (_) { /* ignore */ }
            pdfUrlActual = null;
        }
    }

    function contentWidth() {
        return PAGE.w - PAGE.margin * 2;
    }

    function layoutHojaImpresion() {
        const insetX = 8;
        const insetBottom = 5;
        const Wfull = contentWidth();
        return {
            margin: PAGE.margin + insetX,
            width: Wfull - insetX * 2,
            bottomY: PAGE.h - PAGE.margin - insetBottom
        };
    }

    function txt(v) {
        if (v === null || v === undefined) return '';
        return String(v).trim();
    }

    function valCelda(v) {
        const s = txt(v);
        return s === '' ? '' : s;
    }

    const FS_DATO_TABLA = 6.2;
    const IDX_COL_ROTULO = 1;
    const IDX_COL_VARIEDAD = 5;
    const IDX_COL_PLACA = 6;
    const IDX_COL_GUIA = 7;
    /** Rótulo, variedad, placa y guía: 3 filas unidas, texto vertical 6.2 pt. */
    const COLS_CELDA_DOBLE_PDF = new Set([1, 5, 6, 7]);
    const FILAS_UNION_CELDA_DOBLE = 3;
    const PAD_DATO_VERTICAL_X = 3.5;
    const PAD_DATO_VERTICAL_Y = 3.5;
    /** Rótulo, placa y guía: un poco más a la derecha dentro de la celda. */
    const PAD_DATO_VERTICAL_IZQ_X = 4.65;
    const COLS_PAD_DATO_IZQ_X = new Set([IDX_COL_ROTULO, IDX_COL_PLACA, IDX_COL_GUIA]);
    /** Variedad: 3.2 mm izquierdo, anclado abajo con texto un poco más arriba. */
    const PAD_VARIEDAD_IZQ_X = 3.2;
    const PAD_VARIEDAD_TOP_Y = 2.0;
    const PAD_VARIEDAD_BOTTOM_Y = 6.5;
    const PAD_DATO_VERTICAL_X_DER = 2.0;
    /** Referencia permitida sin recorte: "Sekoya Pop" / "Orgánica". */
    const VARIEDAD_TEXTO_REF = 'Sekoya Pop Orgánica';
    const VARIEDAD_MAX_CHARS = VARIEDAD_TEXTO_REF.length;

    function lineasVariedadParaPdf(texto) {
        const s = valCelda(texto);
        if (!s) return [];
        const org = s.match(/^(.+?)\s+(Orgánica|Organica|Org\.?)$/i);
        if (org) return [org[1].trim(), org[2].trim()];
        const hifen = s.match(/^(.+)-([^-]+)$/);
        if (hifen) return [`${hifen[1].trim()}-`, hifen[2].trim()];
        const parts = s.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const mid = Math.ceil(parts.length / 2);
            return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
        }
        return [s];
    }

    function prepararLineasVariedadParaPdf(doc, texto, colW, cellH) {
        void doc;
        void colW;
        void cellH;
        const s = valCelda(texto);
        if (!s) return [];

        if (s.length <= VARIEDAD_MAX_CHARS) {
            return lineasVariedadParaPdf(s);
        }

        const resto = s.slice(VARIEDAD_MAX_CHARS).trim();
        const sufijo = resto ? ` ${resto[0]}…` : '…';
        return lineasVariedadParaPdf(`${s.slice(0, VARIEDAD_MAX_CHARS).trimEnd()}${sufijo}`);
    }

    function optsCeldaDatoPdf(doc, colIdx, val, colW, cellH) {
        const opts = { fontSize: FS_DATO_TABLA };
        if (COLS_PAD_DATO_IZQ_X.has(colIdx)) {
            opts.padLeft = PAD_DATO_VERTICAL_IZQ_X;
        } else if (colIdx === IDX_COL_VARIEDAD) {
            opts.lineas = prepararLineasVariedadParaPdf(doc, val, colW, cellH);
            opts.padLeft = PAD_VARIEDAD_IZQ_X;
            opts.padRight = PAD_DATO_VERTICAL_X_DER;
            opts.padTop = PAD_VARIEDAD_TOP_Y;
            opts.padBottom = PAD_VARIEDAD_BOTTOM_Y;
            opts.alinearAbajo = true;
            opts.gapLineas = 0;
        }
        return { opts, texto: valCelda(val) };
    }

    function iniciosBloqueMuestraPacking(datos) {
        const starts = [0];
        const seg = datos?.pdfInicioSegundaMuestra;
        if (seg != null && Number.isFinite(Number(seg))) starts.push(Number(seg));
        return starts;
    }

    function esInicioCeldaDoblePacking(colIdx, rowIdx, datos) {
        if (!COLS_CELDA_DOBLE_PDF.has(colIdx)) return false;
        return iniciosBloqueMuestraPacking(datos).some((s) => rowIdx === s);
    }

    function esContinuacionCeldaDoblePacking(colIdx, rowIdx, datos) {
        if (!COLS_CELDA_DOBLE_PDF.has(colIdx)) return false;
        return iniciosBloqueMuestraPacking(datos).some(
            (s) => rowIdx > s && rowIdx < s + FILAS_UNION_CELDA_DOBLE
        );
    }

    function bloquesPresionHoja2Packing(datos) {
        const p2 = datos?.pagina2 || {};
        if (Array.isArray(p2.bloquesPresion) && p2.bloquesPresion.length) return p2.bloquesPresion;
        return [{
            fila: 0,
            presionAmb: p2.presionAmb || [],
            presionFruta: p2.presionFruta || [],
            deficit: p2.deficit || []
        }];
    }

    function valoresPresionFilaHoja2Packing(bloques, filaIdx) {
        const bloque = bloques.find((b) => b.fila === filaIdx);
        if (!bloque) return [];
        const vals = [];
        ['presionAmb', 'presionFruta', 'deficit'].forEach((k) => {
            (bloque[k] || []).forEach((v) => vals.push(v));
        });
        return vals;
    }

    /** Dato girado hacia arriba (90°), centrado con margen en celda de 3 filas. */
    function dibujarCeldaDatoVertical(doc, x, y, w, h, texto, opts) {
        const o = opts || {};
        borde(doc, x, y, w, h);
        const lines = o.lineas && o.lineas.length
            ? o.lineas.map((ln) => valCelda(ln)).filter(Boolean)
            : (valCelda(texto) ? [valCelda(texto)] : []);
        if (!lines.length) return;

        const fs = o.fontSize || FS_DATO_TABLA;
        const padLeft = o.padLeft != null ? o.padLeft : PAD_DATO_VERTICAL_X;
        const padRight = o.padRight != null ? o.padRight : PAD_DATO_VERTICAL_X;
        const padTop = o.padTop != null ? o.padTop : PAD_DATO_VERTICAL_Y;
        const padBottom = o.padBottom != null ? o.padBottom : PAD_DATO_VERTICAL_Y;
        const gap = o.gapLineas != null ? o.gapLineas : fs * 0.24;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fs);

        const dims = lines.map((ln) => medirTextoHorizontal(doc, ln, fs));
        const anchoBloque = dims.reduce((a, d) => a + d.alto, 0) + gap * Math.max(0, lines.length - 1);
        const altoMaxLinea = Math.max(...dims.map((d) => d.ancho), 0);

        let tx = x + padLeft + Math.max(0, (w - padLeft - padRight - anchoBloque) / 2);

        const usableH = Math.max(0, h - padTop - padBottom);
        let ty;
        if (o.alinearAbajo) {
            ty = y + h - padBottom;
            if (ty - altoMaxLinea < y + padTop) {
                ty = y + padTop + altoMaxLinea;
            }
        } else if (usableH > altoMaxLinea) {
            ty = y + padTop + altoMaxLinea + (usableH - altoMaxLinea) / 2;
        } else {
            ty = y + padTop + altoMaxLinea;
        }

        lines.forEach((ln, i) => {
            doc.text(ln, tx, ty, ANCLAJE_VERTICAL);
            tx += dims[i].alto + (i < lines.length - 1 ? gap : 0);
        });
    }

    async function cargarLogoDataUrl() {
        if (logoDataUrlCache) return logoDataUrlCache;
        try {
            const r = await fetch(LOGO_URL, { cache: 'force-cache' });
            if (!r.ok) return null;
            const blob = await r.blob();
            return await new Promise((resolve) => {
                const fr = new FileReader();
                fr.onload = () => {
                    logoDataUrlCache = fr.result;
                    resolve(logoDataUrlCache);
                };
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(blob);
            });
        } catch (_) {
            return null;
        }
    }

    function obtenerJsPDF() {
        const lib = window.jspdf;
        if (!lib || !lib.jsPDF) return null;
        return lib.jsPDF;
    }

    function normalizarListaDatosPdfPacking_(datos) {
        if (Array.isArray(datos?.muestras) && datos.muestras.length) return datos.muestras;
        if (Array.isArray(datos) && datos.length) return datos;
        if (datos && typeof datos === 'object' && datos.filas) return [datos];
        return [];
    }

    function normalizarListaTituloPdfPacking_(datos) {
        if (Array.isArray(datos?.muestrasTitulo) && datos.muestrasTitulo.length) {
            return datos.muestrasTitulo;
        }
        return normalizarListaDatosPdfPacking_(datos);
    }

    function nombreArchivoPdf(datos) {
        const lista = normalizarListaTituloPdfPacking_(datos);
        const modo = String(window.PACKING_PDF_MODO || 'Packing').trim();
        if (typeof window.nombreArchivoPdfDesdeListaMuestras === 'function') {
            return window.nombreArchivoPdfDesdeListaMuestras(lista, { modo, fecha: datos?.fecha });
        }
        return 'muestra.pdf';
    }

    function pesosColumnas(weights, totalW) {
        const sum = weights.reduce((a, b) => a + b, 0);
        return weights.map((w) => (w / sum) * totalW);
    }

    function rellenoGris(doc, x, y, w, h) {
        doc.setFillColor(GRIS_CABECERA.r, GRIS_CABECERA.g, GRIS_CABECERA.b);
        doc.rect(x, y, w, h, 'F');
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.rect(x, y, w, h);
    }

    function borde(doc, x, y, w, h) {
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.rect(x, y, w, h);
    }

    function dibujarCelda(doc, x, y, w, h, texto, opts) {
        const o = opts || {};
        if (o.fillGray) rellenoGris(doc, x, y, w, h);
        else borde(doc, x, y, w, h);
        if (!txt(texto)) return;
        const fs = o.fontSize || 7;
        const align = o.align || 'center';
        doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
        doc.setFontSize(fs);
        const pad = o.pad != null ? o.pad : 1;
        const maxW = Math.max(2, w - pad * 2);
        const lines = doc.splitTextToSize(String(texto), maxW);
        const lineH = fs * 0.4;
        const blockH = lines.length * lineH;
        let ty;
        if (o.valign === 'top') {
            ty = y + pad + lineH * 0.85;
        } else {
            ty = y + (h - blockH) / 2 + lineH * 0.85;
        }
        const yMax = y + h - pad;
        lines.forEach((ln) => {
            if (ty > yMax) return;
            if (align === 'left') doc.text(ln, x + pad, ty, { align: 'left' });
            else doc.text(ln, x + w / 2, ty, { align: 'center' });
            ty += lineH;
        });
    }

    function lineasVertical(texto) {
        return String(texto).split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    }

    function anclajeVerticalCentrado(x, y, w, h, dim, padX) {
        const px = padX != null ? padX : PAD_CELDA_VERTICAL_X;
        return {
            tx: x + px + Math.max(0, (w - px * 2 - dim.alto) / 2),
            ty: y + (h + dim.ancho) / 2
        };
    }

    function fontVerticalInicial(texto, w, h) {
        const lines = lineasVertical(texto);
        const n = Math.max(1, lines.length);
        const maxLen = Math.max(1, ...lines.map((l) => l.length));
        const porAncho = (w - PAD_CELDA_VERTICAL_X * 2) * 2.55;
        const porAlto = (h - PAD_CELDA_VERTICAL_Y * 2) / (maxLen * 0.32 * n + (n - 1) * 0.55);
        return Math.min(7.2, Math.max(4.5, Math.min(porAncho, porAlto)));
    }

    function medirTextoHorizontal(doc, t, fs) {
        doc.setFontSize(fs);
        try {
            if (typeof doc.getTextDimensions === 'function') {
                const d = doc.getTextDimensions(t, { fontSize: fs });
                return { ancho: d.w, alto: d.h };
            }
        } catch (_) { /* ignore */ }
        const scale = doc.internal.scaleFactor || 1;
        return {
            ancho: (doc.getStringUnitWidth(t) * fs) / scale,
            alto: fs / scale
        };
    }

    function dibujarCeldaVertical(doc, x, y, w, h, texto, opts) {
        const o = opts || {};
        if (o.fillGray) rellenoGris(doc, x, y, w, h);
        else borde(doc, x, y, w, h);
        if (!txt(texto)) return;
        const t = String(texto).split('\n')[0].trim() || String(texto).trim();
        if (!t) return;

        doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
        const fsMin = o.fsMin != null ? o.fsMin : FS_CABECERA_VERTICAL_MIN;
        const padX = o.padX != null ? o.padX : PAD_CELDA_VERTICAL_X;
        const padY = o.padY != null ? o.padY : PAD_CELDA_VERTICAL_Y;
        let fs = o.fontSize || fontVerticalInicial(t, w - padX * 2, h - padY * 2);
        if (!o.fsFijo) fs = Math.min(fs, FS_CABECERA_VERTICAL);
        doc.setFontSize(fs);

        let dim = medirTextoHorizontal(doc, t, fs);
        if (!o.fsFijo) {
            while ((dim.alto > w - padX * 2 || dim.ancho > h - padY * 2) && fs > fsMin) {
                fs -= 0.08;
                doc.setFontSize(fs);
                dim = medirTextoHorizontal(doc, t, fs);
            }
        }

        const { tx, ty } = anclajeVerticalCentrado(x, y, w, h, dim, padX);
        doc.text(t, tx, ty, ANCLAJE_VERTICAL);
    }

    function dibujarCeldaVerticalConLineas(doc, x, y, w, h, lineas, opts) {
        const o = opts || {};
        if (o.fillGray) rellenoGris(doc, x, y, w, h);
        else borde(doc, x, y, w, h);
        const lines = (lineas || []).map((l) => String(l).trim()).filter((l) => l.length > 0);
        if (!lines.length) return;

        doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
        const padX = o.padX != null ? o.padX : PAD_CELDA_VERTICAL_X;
        const padY = o.padY != null ? o.padY : PAD_CELDA_VERTICAL_Y;
        const textoRef = lines.join('\n');
        let fs = o.fontSize || fontVerticalInicial(textoRef, w - padX * 2, h - padY * 2);
        if (!o.fsFijo) fs = Math.min(fs, FS_CABECERA_VERTICAL);
        doc.setFontSize(fs);
        let gap = fs * 0.14;

        function medirBloque(dims) {
            const anchoBloque = dims.reduce((a, d) => a + d.alto, 0) + gap * Math.max(0, lines.length - 1);
            const altoBloque = Math.max(...dims.map((d) => d.ancho), 0);
            return { anchoBloque, altoBloque };
        }

        let dims = lines.map((ln) => medirTextoHorizontal(doc, ln, fs));
        let bloque = medirBloque(dims);
        if (!o.fsFijo) {
            while (
                (bloque.anchoBloque > w - padX * 2 || bloque.altoBloque > h - padY * 2)
                && fs > FS_CABECERA_VERTICAL_MIN
            ) {
                fs -= 0.08;
                doc.setFontSize(fs);
                gap = fs * 0.14;
                dims = lines.map((ln) => medirTextoHorizontal(doc, ln, fs));
                bloque = medirBloque(dims);
            }
        }

        let tx = x + padX + Math.max(0, (w - padX * 2 - bloque.anchoBloque) / 2);
        const ty = y + (h + bloque.altoBloque) / 2;
        lines.forEach((ln, i) => {
            doc.text(ln, tx, ty, ANCLAJE_VERTICAL);
            tx += dims[i].alto + (i < lines.length - 1 ? gap : 0);
        });
    }

    function tituloEncabezadoEnDosLineas(titulo) {
        const t = txt(titulo) || 'FORMATO';
        if (/^FORMATO\s+/i.test(t)) {
            return { linea1: 'FORMATO', linea2: t.replace(/^FORMATO\s+/i, '').trim() };
        }
        const sp = t.indexOf(' ');
        if (sp > 0) return { linea1: t.slice(0, sp), linea2: t.slice(sp + 1).trim() };
        return { linea1: t, linea2: '' };
    }

    function encabezadoPagina(doc, datos, titulo, logoUrl, layout) {
        const m = layout?.margin ?? PAGE.margin;
        const W = layout?.width ?? contentWidth();
        const y0 = m;
        const headH = 17;
        const colIzqW = 52;
        const colDerW = 46;
        const colMidW = W - colIzqW - colDerW;
        const xIzq = m;
        const xMid = m + colIzqW;
        const xDer = m + colIzqW + colMidW;

        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.rect(m, y0, W, headH);
        doc.line(xMid, y0, xMid, y0 + headH);
        doc.line(xDer, y0, xDer, y0 + headH);

        const empresa = txt(datos.empresa) || 'AGROVISION';
        const logoW = 13;
        const logoH = 13;
        const logoX = xIzq + (colIzqW - logoW) / 2;
        const logoY = y0 + 0.6;
        if (logoUrl) {
            try {
                doc.addImage(logoUrl, 'PNG', logoX, logoY, logoW, logoH);
            } catch (_) { /* ignore */ }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(empresa, xIzq + colIzqW / 2, y0 + headH - 2.6, { align: 'center' });

        const { linea1, linea2 } = tituloEncabezadoEnDosLineas(titulo || datos.tituloHoja1);
        const midCx = xMid + colMidW / 2;
        const maxTitW = colMidW - 4;
        doc.setFont('helvetica', 'bold');
        let fs1 = 9.5;
        let fs2 = 7.2;
        if (linea2) {
            doc.setFontSize(fs2);
            const scale = doc.internal.scaleFactor || 1;
            while ((doc.getStringUnitWidth(linea2) * fs2) / scale > maxTitW && fs2 > 5.2) {
                fs2 -= 0.1;
                doc.setFontSize(fs2);
            }
        }
        const gapTit = 3;
        const blockH = fs1 * 0.35 + (linea2 ? gapTit + fs2 * 0.35 : 0);
        let ty = y0 + (headH - blockH) / 2 + fs1 * 0.3;
        doc.setFontSize(fs1);
        doc.text(linea1, midCx, ty, { align: 'center' });
        if (linea2) {
            ty += gapTit + fs1 * 0.05;
            doc.setFontSize(fs2);
            doc.text(linea2, midCx, ty, { align: 'center' });
        }

        const padDer = 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.text(`Código: ${datos.codigo || 'PE-F-OPH-309'}`, xDer + padDer, y0 + 6.2, { align: 'left' });
        doc.text(`Versión: ${datos.version || '1'}`, xDer + padDer, y0 + 12.2, { align: 'left' });

        return y0 + headH + 0.75;
    }

    function anchoTexto(doc, texto, fs) {
        const scale = doc.internal.scaleFactor || 1;
        return (doc.getStringUnitWidth(String(texto)) * fs) / scale;
    }

    function dibujarCampoMeta(doc, x, y, w, label, val) {
        const padIzq = 6;
        const padDer = 2;
        const innerW = w - padIzq - padDer;
        const v = valCelda(val);
        const fsVal = 7;
        const gapColon = 0.8;
        const minLinea = 4;
        const factorLinea = 0.5;

        doc.setFont('helvetica', 'bold');
        let fsLabel = 6;
        doc.setFontSize(fsLabel);
        let labelW = anchoTexto(doc, label, fsLabel);
        let valW = v ? anchoTexto(doc, v, fsVal) : 0;
        let lineaW = Math.max(minLinea, (innerW - labelW - gapColon) * factorLinea);
        let totalW = labelW + gapColon + Math.max(valW, lineaW);

        while (totalW > innerW && fsLabel > 4) {
            fsLabel -= 0.12;
            doc.setFontSize(fsLabel);
            labelW = anchoTexto(doc, label, fsLabel);
            lineaW = Math.max(minLinea, (innerW - labelW - gapColon) * factorLinea);
            totalW = labelW + gapColon + Math.max(valW, lineaW);
        }

        const textY = y + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fsLabel);
        doc.text(label, x + padIzq, textY);

        const valX = x + padIzq + labelW + gapColon;
        const lineX1 = valX + lineaW;
        const underY = textY + 0.55;

        doc.setLineWidth(0.15);
        doc.setDrawColor(0);
        doc.line(valX, underY, lineX1, underY);

        if (v) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fsVal);
            doc.text(v, valX + 0.3, textY);
        }
    }

    /** Meta packing: FECHA DE INSPECCIÓN + RESPONSABLE. */
    function bloqueMetaPacking(doc, datos, yStart, layout) {
        const m = layout?.margin ?? PAGE.margin;
        const W = layout?.width ?? contentWidth();
        const meta = datos.meta || {};
        const colW = W / 2;
        const rowH = 6.75;
        const padSup = 1.75;
        const padInf = 2;
        let y = yStart + padSup;
        dibujarCampoMeta(doc, m, y, colW, 'FECHA DE INSPECCIÓN:', meta.fecha || datos.fecha);
        dibujarCampoMeta(doc, m + colW, y, colW, 'RESPONSABLE:', meta.responsable);
        return y + rowH + padInf;
    }

    function disclaimer(doc, layout) {
        const m = layout?.margin ?? PAGE.margin;
        const W = layout?.width ?? contentWidth();
        const yDisc = layout?.bottomY != null ? layout.bottomY - 1.5 : PAGE.h - 5;
        doc.setFontSize(5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(60);
        doc.text(
            'Prohibida la reproducción parcial o total de este documento, sin la autorización de la Gerencia General',
            m + W / 2,
            yDisc,
            { align: 'center', maxWidth: W - 10 }
        );
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
    }

    function valoresFilaPacking(fila) {
        const f = fila || {};
        const temps = [];
        for (let i = 0; i < 5; i++) {
            temps.push(f[`tempAmb${i}`] ?? f.tempAmb?.[i] ?? '');
            temps.push(f[`tempPulpa${i}`] ?? f.tempPulpa?.[i] ?? '');
        }
        return [
            f.horaInicio, f.rotulo, f.etapa, f.campo, f.turno, f.variedad, f.placa, f.guia, f.viaje,
            f.tRecep, f.tIngGas, f.tSalGas, f.tIngPre, f.tSalPre,
            f.pRecep, f.pIngGas, f.pSalGas, f.pIngPre, f.pSalPre,
            ...temps,
            f.hRecep, f.hIngGas, f.hSalGas, f.hIngPre, f.hSalPre
        ];
    }

    function generarHoja1Packing(doc, datos, logoUrl) {
        const layout = layoutHojaImpresion();
        const m = layout.margin;
        const W = layout.width;
        let y = encabezadoPagina(doc, datos, datos.tituloHoja1, logoUrl, layout);
        y = bloqueMetaPacking(doc, datos, y, layout);

        const weights = [
            2.4, 2.2, 1.8, 1.8, 1.8, 2.0, 2.2, 2.2, 1.8,
            2.4, 2.4, 2.4, 2.4, 2.4,
            2.4, 2.4, 2.4, 2.4, 2.4,
            2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0,
            2.2, 2.2, 2.2, 2.2, 2.2
        ];
        const cw = pesosColumnas(weights, W);
        const nCols = 34;
        const idxTemp = 19;
        const nTemp = 10;

        const hGroup = 7;
        const hDetalleUnico = 42;
        const hTempEv = 20;
        const hTempSub = 22;
        const hHeadTotal = hGroup + hDetalleUnico;
        const nFilasCuerpo = PACKING_PDF_FILAS;
        const yTab = y;
        const yBodyStart = yTab + hHeadTotal;
        const yBodyEnd = layout.bottomY - 8;
        const hRow = Math.min(5.9, Math.max(3.5, (yBodyEnd - yBodyStart) / nFilasCuerpo));
        const yDet = yTab + hGroup;

        const infoLabels = [
            'HORA INICIO RECEPCIÓN', 'RÓTULO MUESTRA', 'ETAPA', 'CAMPO', 'TURNO',
            'VARIEDAD', 'N° PLACA CAMIONETA', 'N° GUÍA DESPACHO', 'N° VIAJE'
        ];
        const idxTiempos = 9;
        const idxPesos = 14;
        const tempSubLabels = ['T° AMBIENTE', 'T° PULPA'];

        const labelsGroup = [
            { i: 0, n: 9, t: 'INFORMACIÓN MUESTRA' },
            { i: 9, n: 5, t: 'TIEMPOS DE LA MUESTRA (HORA)' },
            { i: 14, n: 5, t: 'PESO BRUTO MUESTRA (GR)' },
            { i: 19, n: 10, t: 'TEMPERATURA MUESTRA (°C)' },
            { i: 29, n: 5, t: 'HUMEDAD RELATIVA (%)' }
        ];

        const vHdr = { bold: true, fillGray: true, fontSize: FS_CABECERA_TABLA, fsFijo: true };

        let x = m;
        labelsGroup.forEach((g) => {
            const w = cw.slice(g.i, g.i + g.n).reduce((a, b) => a + b, 0);
            dibujarCelda(doc, x, yTab, w, hGroup, g.t, { fontSize: FS_CABECERA_GRUPO, bold: true, fillGray: true });
            x += w;
        });

        for (let i = 0; i < 9; i++) {
            const xi = m + cw.slice(0, i).reduce((a, b) => a + b, 0);
            dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, infoLabels[i], vHdr);
        }

        for (let i = idxTiempos; i < idxPesos; i++) {
            const xi = m + cw.slice(0, i).reduce((a, b) => a + b, 0);
            dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, STAGE_LABELS_PDF[i - idxTiempos], vHdr);
        }

        for (let i = idxPesos; i < idxTemp; i++) {
            const xi = m + cw.slice(0, i).reduce((a, b) => a + b, 0);
            dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, STAGE_LABELS_PDF[i - idxPesos], vHdr);
        }

        const yTempEv = yDet;
        const yTempSub = yDet + hTempEv;
        let xt = m + cw.slice(0, idxTemp).reduce((a, b) => a + b, 0);
        STAGE_LABELS_TEMP_PDF.forEach((lineas, ei) => {
            const w = cw[idxTemp + ei * 2] + cw[idxTemp + ei * 2 + 1];
            dibujarCeldaVerticalConLineas(doc, xt, yTempEv, w, hTempEv, lineas, vHdr);
            xt += w;
        });

        xt = m + cw.slice(0, idxTemp).reduce((a, b) => a + b, 0);
        for (let i = 0; i < nTemp; i++) {
            dibujarCeldaVertical(doc, xt, yTempSub, cw[idxTemp + i], hTempSub, tempSubLabels[i % 2], vHdr);
            xt += cw[idxTemp + i];
        }

        for (let i = 29; i < nCols; i++) {
            const xi = m + cw.slice(0, i).reduce((a, b) => a + b, 0);
            dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, STAGE_LABELS_PDF[i - 29], vHdr);
        }

        y = yTab + hHeadTotal;
        for (let ri = 0; ri < nFilasCuerpo; ri++) {
            const fila = (datos.filas || [])[ri] || {};
            const vals = valoresFilaPacking(fila);
            x = m;
            cw.forEach((w, i) => {
                if (esContinuacionCeldaDoblePacking(i, ri, datos)) {
                    x += w;
                    return;
                }
                const hCelda = esInicioCeldaDoblePacking(i, ri, datos) ? hRow * FILAS_UNION_CELDA_DOBLE : hRow;
                const { opts, texto } = optsCeldaDatoPdf(doc, i, vals[i], w, hCelda);
                if (esInicioCeldaDoblePacking(i, ri, datos)) {
                    dibujarCeldaDatoVertical(doc, x, y, w, hCelda, texto, opts);
                } else {
                    dibujarCelda(doc, x, y, w, hCelda, texto, opts);
                }
                x += w;
            });
            y += hRow;
        }

        disclaimer(doc, layout);
    }

    function generarHoja2Packing(doc, datos, logoUrl) {
        const layout = layoutHojaImpresion();
        const m = layout.margin;
        const W = layout.width;
        let y = encabezadoPagina(doc, datos, datos.tituloHoja2, logoUrl, layout);
        y = bloqueMetaPacking(doc, datos, y, layout);

        const p2 = datos.pagina2 || {};
        const bloquesPresion = bloquesPresionHoja2Packing(datos);
        const refPresion = bloquesPresion[0] || {};
        const grupos = [
            { tit: 'PRESIÓN DE VAPOR AMBIENTE (Kpa)', vals: refPresion.presionAmb || p2.presionAmb || [] },
            { tit: 'PRESIÓN DE VAPOR FRUTA (Kpa)', vals: refPresion.presionFruta || p2.presionFruta || [] },
            { tit: 'DÉFICIT DE PRESIÓN DE VAPOR (Kpa)', vals: refPresion.deficit || p2.deficit || [] }
        ];

        const obsW = W * 0.26;
        const dataW = W - obsW;
        const colW = dataW / 15;
        const hG = 7;
        const hSub = 36;
        const nFilasCuerpo = PACKING_PDF_FILAS;
        const ySigReserva = 18;

        function listaObservacionesP2(pagina2) {
            if (Array.isArray(pagina2?.observacionesLista)) {
                return pagina2.observacionesLista.map((o) => valCelda(o));
            }
            return [];
        }

        const obsLista = listaObservacionesP2(p2);
        const yTab = y;
        const obsX = m + dataW;
        const ySub = yTab + hG;
        const hObsHdr = hG + hSub;

        grupos.forEach((g, gi) => {
            const xg = m + gi * colW * 5;
            dibujarCelda(doc, xg, yTab, colW * 5, hG, g.tit, { fontSize: FS_CABECERA_GRUPO, bold: true, fillGray: true });
        });
        rellenoGris(doc, obsX, yTab, obsW, hObsHdr);

        let x = m;
        for (let i = 0; i < 15; i++) {
            dibujarCeldaVertical(doc, x, ySub, colW, hSub, STAGE_LABELS_PDF[i % 5], {
                fillGray: true,
                bold: true,
                fontSize: FS_CABECERA_TABLA,
                fsFijo: true
            });
            x += colW;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FS_CABECERA_TABLA);
        doc.text('OBSERVACIONES', obsX + obsW / 2, ySub + hSub / 2 + 2, { align: 'center' });

        const yBodyStart = ySub + hSub;
        const yBodyEnd = layout.bottomY - ySigReserva;
        const hRow = Math.min(5.9, Math.max(3.5, (yBodyEnd - yBodyStart) / nFilasCuerpo));

        for (let r = 0; r < nFilasCuerpo; r++) {
            const filaVals = valoresPresionFilaHoja2Packing(bloquesPresion, r);
            const yRow = yBodyStart + r * hRow;
            x = m;
            for (let i = 0; i < 15; i++) {
                const val = filaVals.length ? valCelda(filaVals[i]) : '';
                dibujarCelda(doc, x, yRow, colW, hRow, val, { fontSize: 6.2, pad: 0.4 });
                x += colW;
            }
            dibujarCelda(doc, obsX, yRow, obsW, hRow, valCelda(obsLista[r]), {
                fontSize: 6.2,
                pad: 0.4,
                align: 'center'
            });
        }

        disclaimer(doc, layout);

        const ySigLine = layout.bottomY - 12;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.line(m + 10, ySigLine, m + 75, ySigLine);
        doc.text('NOMBRE Y FIRMA', m + 42, ySigLine + 4, { align: 'center' });
        doc.text('Inspector de Calidad-Campo', m + 42, ySigLine + 8.5, { align: 'center' });
        doc.line(m + W - 75, ySigLine, m + W - 10, ySigLine);
        doc.text('NOMBRE Y FIRMA', m + W - 42, ySigLine + 4, { align: 'center' });
        doc.text('Supervisor de Calidad-Packing', m + W - 42, ySigLine + 8.5, { align: 'center' });
    }

    async function generarPdfPackingBlob(datos) {
        const JsPDF = obtenerJsPDF();
        if (!JsPDF) throw new Error('jsPDF no está cargado');
        const lista = normalizarListaDatosPdfPacking_(datos);
        if (!lista.length) throw new Error('No hay datos para generar el PDF.');
        const logoUrl = await cargarLogoDataUrl();
        const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        lista.forEach((item, idx) => {
            if (idx > 0) doc.addPage('a4', 'landscape');
            generarHoja1Packing(doc, item, logoUrl);
            doc.addPage('a4', 'landscape');
            generarHoja2Packing(doc, item, logoUrl);
        });
        return doc.output('blob');
    }

    function escalaPdfZoomClamped(valor) {
        return Math.min(pdfZoomState.max, Math.max(pdfZoomState.min, valor));
    }

    function actualizarEtiquetaPdfZoom(scale) {
        const label = document.getElementById('pdf-zoom-label');
        if (label) label.textContent = `${Math.round(scale * 100)}%`;
    }

    function aplicarPdfZoomPreview() {
        const scaler = document.getElementById('pdf-preview-scaler');
        const s = escalaPdfZoomClamped(pdfZoomState.scale);
        pdfZoomState.scale = s;
        const base = pdfPreviewSession?.lastRenderedZoom || 1;
        if (scaler && pdfPreviewSession) {
            const ratio = s / base;
            scaler.style.transform = Math.abs(ratio - 1) < 0.02 ? '' : `scale(${ratio})`;
            scaler.style.transformOrigin = 'top center';
        }
        actualizarEtiquetaPdfZoom(s);
    }

    function resetPdfZoom() {
        pdfZoomState.scale = 1;
        if (pdfPreviewSession) {
            void comprometerPdfZoom();
        } else {
            aplicarPdfZoomPreview();
        }
    }

    function bufferCanvasPaginaPdf(item) {
        if (!item.bufferCanvas) {
            item.bufferCanvas = document.createElement('canvas');
            item.bufferCtx = item.bufferCanvas.getContext('2d', { alpha: false });
        }
        return { canvas: item.bufferCanvas, ctx: item.bufferCtx };
    }

    function pintarCanvasBlanco(ctx, ancho, alto) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ancho, alto);
    }

    function aplicarBufferEnCanvasVisible(item, buffer, cssW, cssH, pxW, pxH) {
        item.canvas.style.width = `${cssW}px`;
        item.canvas.style.height = `${cssH}px`;
        item.canvas.width = pxW;
        item.canvas.height = pxH;
        pintarCanvasBlanco(item.ctx, pxW, pxH);
        item.ctx.drawImage(buffer, 0, 0);
    }

    async function renderizarPdfPreviewZoom(zoom) {
        if (!pdfPreviewSession) return;
        const session = pdfPreviewSession;
        const zoomFinal = escalaPdfZoomClamped(zoom);
        const token = ++session.renderGen;
        const dpr = PDF_PREVIEW_DPR();
        const scaler = document.getElementById('pdf-preview-scaler');
        const listo = [];

        for (const item of session.pages) {
            const page = await session.pdf.getPage(item.pageNum);
            const baseVp = page.getViewport({ scale: 1 });
            const displayScale = session.ancho / baseVp.width;
            const cssVp = page.getViewport({ scale: displayScale * zoomFinal });
            const renderVp = page.getViewport({ scale: displayScale * zoomFinal * dpr });
            const pxW = Math.floor(renderVp.width);
            const pxH = Math.floor(renderVp.height);
            const cssW = Math.floor(cssVp.width);
            const cssH = Math.floor(cssVp.height);
            const { canvas: buffer, ctx: bufferCtx } = bufferCanvasPaginaPdf(item);
            buffer.width = pxW;
            buffer.height = pxH;
            pintarCanvasBlanco(bufferCtx, pxW, pxH);
            if (token !== session.renderGen) return;
            await page.render({ canvasContext: bufferCtx, viewport: renderVp }).promise;
            if (token !== session.renderGen) return;
            listo.push({ item, buffer, cssW, cssH, pxW, pxH });
        }

        if (token !== session.renderGen) return;
        for (const frame of listo) {
            aplicarBufferEnCanvasVisible(frame.item, frame.buffer, frame.cssW, frame.cssH, frame.pxW, frame.pxH);
        }
        session.lastRenderedZoom = zoomFinal;
        pdfZoomState.scale = zoomFinal;
        if (scaler) scaler.style.transform = '';
        actualizarEtiquetaPdfZoom(zoomFinal);
    }

    function comprometerPdfZoom() {
        if (!pdfPreviewSession) {
            aplicarPdfZoomPreview();
            return;
        }
        if (pdfPreviewSession.zoomTimer) {
            clearTimeout(pdfPreviewSession.zoomTimer);
            pdfPreviewSession.zoomTimer = null;
        }
        const zoomObjetivo = escalaPdfZoomClamped(pdfZoomState.scale);
        return renderizarPdfPreviewZoom(zoomObjetivo);
    }

    function cambiarPdfZoom(delta) {
        pdfZoomState.scale = escalaPdfZoomClamped(pdfZoomState.scale + delta);
        void comprometerPdfZoom();
    }

    function distanciaToques(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.hypot(dx, dy);
    }

    function enlazarZoomVistaPreviaPdf() {
        const stage = document.getElementById('pdf-preview-stage');
        if (!stage || stage.dataset.zoomBound === '1') return;
        stage.dataset.zoomBound = '1';

        let pinchStartDist = 0;
        let pinchStartZoom = 1;

        stage.addEventListener('touchstart', (ev) => {
            if (ev.touches.length === 2) {
                pinchStartDist = distanciaToques(ev.touches[0], ev.touches[1]);
                pinchStartZoom = pdfZoomState.scale;
            }
        }, { passive: true });

        stage.addEventListener('touchmove', (ev) => {
            if (ev.touches.length !== 2 || pinchStartDist <= 0) return;
            const dist = distanciaToques(ev.touches[0], ev.touches[1]);
            const ratio = dist / pinchStartDist;
            pdfZoomState.scale = escalaPdfZoomClamped(pinchStartZoom * ratio);
            aplicarPdfZoomPreview();
        }, { passive: true });

        stage.addEventListener('touchend', () => {
            if (pinchStartDist > 0) {
                pinchStartDist = 0;
                void comprometerPdfZoom();
            }
        }, { passive: true });
    }

    function limpiarVistaPreviaPdf() {
        ocultarVisorPdfNativo();
        pdfPreviewSession = null;
        const pages = document.getElementById('pdf-preview-pages');
        if (pages) pages.innerHTML = '';
        estadoVistaPreviaPdf('loading');
        resetPdfZoom();
    }

    async function renderizarVistaPreviaPdf(blob, opciones) {
        const enVivo = opciones && opciones.enVivo;
        if (!enVivo) {
            limpiarVistaPreviaPdf();
            estadoVistaPreviaPdf('loading');
        } else {
            ocultarVisorPdfNativo();
            if (pdfPreviewSession?.zoomTimer) {
                clearTimeout(pdfPreviewSession.zoomTimer);
                pdfPreviewSession.zoomTimer = null;
            }
            const pages = document.getElementById('pdf-preview-pages');
            if (pages) pages.innerHTML = '';
            pdfPreviewSession = null;
        }

        if (prefiereVisorPdfNativo() && pdfUrlActual && mostrarVisorPdfNativo(pdfUrlActual)) {
            return;
        }

        const lib = obtenerPdfJs();
        if (!lib) {
            estadoVistaPreviaPdf('error');
            return;
        }

        const pagesEl = document.getElementById('pdf-preview-pages');
        const stage = document.getElementById('pdf-preview-stage');
        if (!pagesEl || !stage) {
            estadoVistaPreviaPdf('error');
            return;
        }

        const buf = await blob.arrayBuffer();
        const data = new Uint8Array(buf);

        let pdf;
        try {
            pdf = await cargarPdfParaVista(lib, data, false);
        } catch (errWorker) {
            console.warn('[PDF preview packing] reintento sin worker', errWorker);
            try {
                pdf = await cargarPdfParaVista(lib, data, true);
            } catch (err) {
                console.warn('[PDF preview packing]', err);
                estadoVistaPreviaPdf('error');
                return;
            }
        }

        const ancho = Math.max(280, Math.min(stage.clientWidth - 8, 920));
        const numPages = pdf.numPages;
        const pages = [];

        for (let i = 1; i <= numPages; i++) {
            const wrap = document.createElement('div');
            wrap.className = 'pdf-preview-page-wrap';
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-preview-page-canvas';
            wrap.appendChild(canvas);
            pagesEl.appendChild(wrap);
            pages.push({ pageNum: i, canvas, ctx: canvas.getContext('2d', { alpha: false }) });
        }

        pdfPreviewSession = {
            pdf,
            pages,
            ancho,
            renderGen: 0,
            lastRenderedZoom: 1,
            zoomTimer: null
        };

        try {
            await renderizarPdfPreviewZoom(1);
            estadoVistaPreviaPdf('ready');
        } catch (err) {
            console.warn('[PDF preview packing]', err);
            estadoVistaPreviaPdf('error');
        }
    }

    function cerrarModalPdf() {
        const ov = document.getElementById('pdf-modal-overlay');
        if (ov) ov.style.display = 'none';
        limpiarVistaPreviaPdf();
        revocarPdfUrlActual();
        pdfDatosActual = null;
        ultimoHashPdfVivoPacking_ = '';
    }

    function abrirPdfEnVisorExterno() {
        if (!pdfBlobActual) return;
        if (!pdfUrlActual) pdfUrlActual = URL.createObjectURL(pdfBlobActual);
        window.open(pdfUrlActual, '_blank', 'noopener,noreferrer');
    }

    function actualizarTituloModalPdf_(nombre, datosPdf) {
        if (typeof window.actualizarTituloModalPdf === 'function') {
            window.actualizarTituloModalPdf(nombre, datosPdf);
            return;
        }
        const titleEl = document.getElementById('pdf-modal-title');
        if (!titleEl) return;
        const nom = String(nombre || 'muestra.pdf').trim();
        titleEl.textContent = nom.replace(/\.pdf$/i, '');
        titleEl.title = titleEl.textContent;
    }

    async function actualizarPdfVivoEnModal(blob, nombre, datosPdf) {
        pdfBlobActual = blob;
        pdfDatosActual = datosPdf || null;
        pdfNombreActual = nombre || pdfNombreActual;
        actualizarTituloModalPdf_(pdfNombreActual, datosPdf);
        revocarPdfUrlActual();
        pdfUrlActual = URL.createObjectURL(blob);
        await renderizarVistaPreviaPdf(blob, { enVivo: true });
    }

    async function regenerarPdfVivoSiAbiertoPacking() {
        if (!window.PdfPreviewLive?.modalAbierto?.()) return;
        if (typeof window.obtenerDatosPdfPacking !== 'function') return;
        try {
            if (!obtenerJsPDF()) return;
            const datos = window.obtenerDatosPdfPacking();
            const hash = JSON.stringify(datos);
            if (hash === ultimoHashPdfVivoPacking_) return;
            ultimoHashPdfVivoPacking_ = hash;
            const blob = await generarPdfPackingBlob(datos);
            await actualizarPdfVivoEnModal(blob, nombreArchivoPdf(datos), datos);
        } catch (_) {
            ultimoHashPdfVivoPacking_ = '';
            cerrarModalPdf();
        }
    }

    async function abrirModalPdf(blob, nombre, datosPdf) {
        pdfBlobActual = blob;
        pdfDatosActual = datosPdf || null;
        pdfNombreActual = nombre || 'medicion-recepcion-arandano.pdf';
        ultimoHashPdfVivoPacking_ = datosPdf ? JSON.stringify(datosPdf) : '';
        actualizarTituloModalPdf_(pdfNombreActual, datosPdf);
        const ov = document.getElementById('pdf-modal-overlay');
        if (!ov) return;
        revocarPdfUrlActual();
        pdfUrlActual = URL.createObjectURL(blob);
        ov.style.display = 'flex';
        await esperarLayoutModal();
        await renderizarVistaPreviaPdf(blob);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function descargarPdfActual() {
        if (!pdfBlobActual) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(pdfBlobActual);
        a.download = pdfNombreActual;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    function tituloCompartirPdfPacking_() {
        const lista = normalizarListaTituloPdfPacking_(pdfDatosActual);
        if (lista.length && typeof window.textoNombresPdfParaCompartir === 'function') {
            return window.textoNombresPdfParaCompartir(lista, {
                modo: String(window.PACKING_PDF_MODO || 'Packing').trim()
            });
        }
        return pdfNombreActual.replace(/\.pdf$/i, '');
    }

    async function compartirWhatsAppPdf() {
        if (!pdfBlobActual) return;
        const file = new File([pdfBlobActual], pdfNombreActual, { type: 'application/pdf' });
        const titulo = tituloCompartirPdfPacking_();
        if (navigator.share) {
            try {
                const payload = { title: titulo, files: [file] };
                if (!navigator.canShare || navigator.canShare(payload)) {
                    await navigator.share(payload);
                    return;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }
        descargarPdfActual();
        const msg = encodeURIComponent(`${titulo}\n(Adjunta el PDF descargado)`);
        window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
    }

    async function generarYMostrarPdfPacking() {
        if (typeof window.obtenerDatosPdfPacking !== 'function') {
            if (window.Swal) {
                window.Swal.fire({ icon: 'error', title: 'PDF no disponible', text: 'Recarga la página e intenta de nuevo.' });
            }
            return;
        }
        const btn = document.getElementById('fab-pdf-btn');
        if (btn) btn.disabled = true;
        try {
            if (!obtenerJsPDF()) {
                throw new Error('Biblioteca PDF no cargada. Conéctate una vez a internet para precargar.');
            }
            const datos = window.obtenerDatosPdfPacking();
            const blob = await generarPdfPackingBlob(datos);
            abrirModalPdf(blob, nombreArchivoPdf(datos), datos);
        } catch (e) {
            const msg = e && e.message ? e.message : 'No se pudo generar el PDF.';
            const sinPeso = /PESO BRUTO|PESO RECEPCIÓN/i.test(msg);
            if (window.Swal) {
                window.Swal.fire({
                    icon: sinPeso ? 'warning' : 'error',
                    title: sinPeso ? 'Sin pesos en la muestra' : 'Error al generar PDF',
                    text: msg
                });
            } else {
                window.alert(msg);
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function initPackingPdf() {
        window.PdfPreviewLive?.registrar?.(regenerarPdfVivoSiAbiertoPacking);
        enlazarZoomVistaPreviaPdf();
        document.getElementById('fab-pdf-btn')?.addEventListener('click', () => {
            void generarYMostrarPdfPacking();
        });
        document.getElementById('pdf-btn-cerrar')?.addEventListener('click', cerrarModalPdf);
        document.getElementById('pdf-btn-descargar')?.addEventListener('click', descargarPdfActual);
        document.getElementById('pdf-btn-abrir')?.addEventListener('click', abrirPdfEnVisorExterno);
        document.getElementById('pdf-zoom-in')?.addEventListener('click', () => cambiarPdfZoom(pdfZoomState.step));
        document.getElementById('pdf-zoom-out')?.addEventListener('click', () => cambiarPdfZoom(-pdfZoomState.step));
        document.getElementById('pdf-zoom-reset')?.addEventListener('click', resetPdfZoom);
        document.getElementById('pdf-btn-wsp')?.addEventListener('click', () => {
            void compartirWhatsAppPdf();
        });
        document.getElementById('pdf-modal-overlay')?.addEventListener('click', (ev) => {
            if (ev.target && ev.target.id === 'pdf-modal-overlay') cerrarModalPdf();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPackingPdf);
    } else {
        initPackingPdf();
    }

    window.generarYMostrarPdfPacking = generarYMostrarPdfPacking;
    window.generarPdfPackingBlob = generarPdfPackingBlob;
    window.nombreArchivoPdfPacking = nombreArchivoPdf;
})();
