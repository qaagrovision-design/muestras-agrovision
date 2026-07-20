(function tk20PdfModule() {
    const LOGO_URL = '../../assets/images/log.png';
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

    const CODIGO_DEFAULT = 'PE-F-CPS-312';
    const VERSION_DEFAULT = '01';
    const TITULO_DEFAULT = 'FORMATO MEDICIÓN DE TIEMPOS, TEMPERATURAS, HUMEDAD RELATIVA Y PESOS EN UNIDADES - ARÁNDANO';
    const TK20_PDF_FILAS = 14;

    /** Rótulos verticales — saltos como formulario físico / MP-TK. */
    const TK20_ETAPA_COL_LABELS = [
        'Hora',
        ['Temperatura', 'Exterior Ambiente °C'],
        ['Temperatura', 'Ambiente del Acopio °C'],
        ['Temperatura', 'Ambiente Interior del vehículo °C'],
        ['Temperatura', 'Pulpa °C'],
        ['Humedad', 'Relativa Exterior %'],
        ['Humedad', 'Relativa del Acopio %'],
        ['Humedad Relativa', 'del Interior del Vehículo %'],
        'Peso (gr)'
    ];

    const TK20_PRESION_COL_LABELS = [
        ['Presión', 'Exterior del Ambiente'],
        ['Presión', 'Ambiente del Acopio'],
        ['Presión', 'Ambiente en el Interior del vehículo'],
        ['Presión de Fruta-', 'Pulpa']
    ];

    let logoDataUrlCache = null;
    let pdfBlobActual = null;
    let pdfNombreActual = 'medicion-tk20.pdf';
    let pdfDatosActual = null;
    let pdfUrlActual = null;
    let pdfjsLibInited = false;
    let pdfPreviewSession = null;
    let ultimoHashPdfVivoTk20_ = '';
    const pdfZoomState = { scale: 1, min: 0.6, max: 2.5, step: 0.35 };
    // Cap bajo: en emulación móvil DPR alto + canvas doble explotaba la RAM (varios GB).
    const PDF_PREVIEW_DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);

    function baseRaizTk20Pdf_() {
        try {
            const manifestSrc = document.querySelector('link[rel="manifest"]')?.href;
            if (manifestSrc) return new URL('./', manifestSrc).href;
            return new URL('../../assets/', document.baseURI || window.location.href).href;
        } catch (_) {
            return '../../assets/';
        }
    }

    function urlTk20PdfDesdeRaiz_(rel) {
        const base = baseRaizTk20Pdf_();
        try {
            return new URL(base + rel, document.baseURI || window.location.href).href;
        } catch (_) {
            return base + rel;
        }
    }

    function workerSrcPdfJs() {
        return urlTk20PdfDesdeRaiz_('librerias/pdf.worker.min.js');
    }

    function standardFontsUrlPdfJs() {
        return urlTk20PdfDesdeRaiz_('librerias/standard_fonts/');
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
        let ty = o.valign === 'top'
            ? y + pad + lineH * 0.85
            : y + (h - blockH) / 2 + lineH * 0.85;
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

    function tyVerticalCentrado_(y, h, altoBloque, padY) {
        const py = padY != null ? padY : PAD_CELDA_VERTICAL_Y;
        const usableH = Math.max(0, h - py * 2);
        if (usableH > altoBloque) {
            return y + py + altoBloque + (usableH - altoBloque) / 2;
        }
        return y + py + altoBloque;
    }

    function txVerticalCentrado_(x, w, anchoBloque, padX) {
        const px = padX != null ? padX : PAD_CELDA_VERTICAL_X;
        return x + Math.max(px, (w - anchoBloque) / 2);
    }

    function fontVerticalInicial(texto, w, h) {
        const lines = lineasVertical(texto);
        const n = Math.max(1, lines.length);
        const maxLen = Math.max(1, ...lines.map((l) => l.length));
        const porAncho = (w - PAD_CELDA_VERTICAL_X * 2) * 2.55;
        const porAlto = (h - PAD_CELDA_VERTICAL_Y * 2) / (maxLen * 0.32 * n + (n - 1) * 0.55);
        return Math.min(7.2, Math.max(4.5, Math.min(porAncho, porAlto)));
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
        const tx = txVerticalCentrado_(x, w, dim.alto, padX);
        const ty = tyVerticalCentrado_(y, h, dim.ancho, padY);
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

        let tx = txVerticalCentrado_(x, w, bloque.anchoBloque, padX);
        const tyBase = tyVerticalCentrado_(y, h, bloque.altoBloque, padY);
        const altoRef = bloque.altoBloque;
        lines.forEach((ln, i) => {
            const tyLine = tyBase + (dims[i].ancho - altoRef) / 2;
            doc.text(ln, tx, tyLine, ANCLAJE_VERTICAL);
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
        const colDerW = 48;
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
        const { linea1, linea2 } = tituloEncabezadoEnDosLineas(titulo || datos.tituloHoja || TITULO_DEFAULT);
        const midCx = xMid + colMidW / 2;
        const maxTitW = colMidW - 4;
        doc.setFont('helvetica', 'bold');
        let fs1 = 9;
        let fs2 = 6.8;
        if (linea2) {
            doc.setFontSize(fs2);
            const scale = doc.internal.scaleFactor || 1;
            while ((doc.getStringUnitWidth(linea2) * fs2) / scale > maxTitW && fs2 > 4.8) {
                fs2 -= 0.1;
                doc.setFontSize(fs2);
            }
        }
        const gapTit = 2.6;
        const blockH = fs1 * 0.35 + (linea2 ? gapTit + fs2 * 0.35 : 0);
        let ty = y0 + (headH - blockH) / 2 + fs1 * 0.3;
        doc.setFontSize(fs1);
        doc.text(linea1, midCx, ty, { align: 'center' });
        if (linea2) {
            ty += gapTit + fs1 * 0.05;
            doc.setFontSize(fs2);
            doc.text(linea2, midCx, ty, { align: 'center' });
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.6);
        doc.text(`Código: ${datos.codigo || CODIGO_DEFAULT}`, xDer + 2, y0 + 6.2, { align: 'left' });
        doc.text(`Versión: ${datos.version || VERSION_DEFAULT}`, xDer + 2, y0 + 12.2, { align: 'left' });
        return y0 + headH + 0.75;
    }

    function anchoTexto(doc, texto, fs) {
        const scale = doc.internal.scaleFactor || 1;
        return (doc.getStringUnitWidth(String(texto)) * fs) / scale;
    }

    function dibujarCampoMeta(doc, x, y, w, label, val, opts) {
        opts = opts || {};
        const padIzq = 6;
        const padDer = 2;
        const innerW = w - padIzq - padDer;
        const v = valCelda(val);
        const fsVal = 7;
        const gapColon = 0.8;
        const minLinea = 4;
        const factorLinea = opts.factorLinea != null ? opts.factorLinea : 0.5;
        const lineaCompleta = opts.lineaCompleta === true;
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
        const lineX1 = lineaCompleta ? (x + w - padDer) : (valX + lineaW);
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

    function dibujarHeaderColumnaVertical(doc, x, y, w, h, label, opts) {
        if (Array.isArray(label)) {
            dibujarCeldaVerticalConLineas(doc, x, y, w, h, label, opts);
        } else {
            dibujarCeldaVertical(doc, x, y, w, h, label, opts);
        }
    }

    function disclaimer(doc, layout) {
        const m = layout?.margin ?? PAGE.margin;
        const W = layout?.width ?? contentWidth();
        const yDisc = layout?.bottomY != null ? layout.bottomY - 1.2 : PAGE.h - 5;
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

    function normalizarListaDatosPdfTk20_(datos) {
        if (Array.isArray(datos?.muestras) && datos.muestras.length) return datos.muestras;
        if (Array.isArray(datos) && datos.length) return datos;
        if (datos && typeof datos === 'object') return [datos];
        return [];
    }

    function normalizarListaTituloPdfTk20_(datos) {
        if (Array.isArray(datos?.muestrasTitulo) && datos.muestrasTitulo.length) return datos.muestrasTitulo;
        return normalizarListaDatosPdfTk20_(datos);
    }

    function nombreArchivoPdf(datos) {
        const lista = normalizarListaTituloPdfTk20_(datos);
        if (typeof window.nombreArchivoPdfDesdeListaMuestras === 'function') {
            return window.nombreArchivoPdfDesdeListaMuestras(lista, { modo: 'TK-2.0', fecha: datos?.fecha });
        }
        return 'muestra-tk20.pdf';
    }

    /** Meta 2×3 sin cuadros — igual Campo / formulario físico. */
    function bloqueMetaTk20(doc, datos, yStart, layout) {
        const m = layout?.margin ?? PAGE.margin;
        const W = layout?.width ?? contentWidth();
        const meta = datos.meta || {};
        const colW = W / 3;
        const rowH = 6.75;
        const padSup = 1.75;
        const padInf = 2;
        const filas = [
            [
                { label: 'FECHA:', val: meta.fecha || datos.fecha },
                { label: 'TRAZABILIDAD:', val: meta.trazabilidad },
                { label: 'RESPONSABLE:', val: meta.responsable }
            ],
            [
                { label: 'GUÍA DE REMISIÓN:', val: meta.guia },
                { label: 'RÓTULO DE MUESTRA:', val: meta.rotulo },
                { label: 'PLACA DEL VEHÍCULO:', val: meta.placa }
            ]
        ];
        let y = yStart + padSup;
        filas.forEach((fila) => {
            fila.forEach((cell, c) => {
                dibujarCampoMeta(doc, m + c * colW, y, colW, cell.label, cell.val);
            });
            y += rowH;
        });
        return y + padInf;
    }

    function valoresFilaTk20(datos, fila, rowIdx) {
        const llegada = datos.llegada || {};
        const traslado = datos.traslado || {};
        const presionLlegada = datos.presionLlegada || {};
        const presionTraslado = datos.presionTraslado || {};
        const isControl = rowIdx === 0;
        return [
            valCelda(fila?.num || rowIdx + 1),
            isControl ? llegada.hora : '',
            isControl ? llegada.tExt : '',
            isControl ? llegada.tAcopio : '',
            isControl ? llegada.tVeh : '',
            isControl ? llegada.tPulpa : '',
            isControl ? llegada.hrExt : '',
            isControl ? llegada.hrAcopio : '',
            isControl ? llegada.hrVeh : '',
            valCelda(fila?.pesoLlegada),
            isControl ? traslado.hora : '',
            isControl ? traslado.tExt : '',
            isControl ? traslado.tAcopio : '',
            isControl ? traslado.tVeh : '',
            isControl ? traslado.tPulpa : '',
            isControl ? traslado.hrExt : '',
            isControl ? traslado.hrAcopio : '',
            isControl ? traslado.hrVeh : '',
            valCelda(fila?.pesoTraslado),
            isControl ? presionLlegada.ext : '',
            isControl ? presionLlegada.acopio : '',
            isControl ? presionLlegada.veh : '',
            isControl ? presionLlegada.pulpa : '',
            isControl ? presionTraslado.ext : '',
            isControl ? presionTraslado.acopio : '',
            isControl ? presionTraslado.veh : '',
            isControl ? presionTraslado.pulpa : ''
        ];
    }

    function generarHojaTk20(doc, datos, logoUrl) {
        const layout = layoutHojaImpresion();
        const m = layout.margin;
        const W = layout.width;
        let y = encabezadoPagina(doc, datos, datos.tituloHoja || TITULO_DEFAULT, logoUrl, layout);
        y = bloqueMetaTk20(doc, datos, y, layout);

        const weights = [1.25, 1.15, 1, 1, 1, 1, 1, 1, 1, 1.2, 1.15, 1, 1, 1, 1, 1, 1, 1, 1.2, 1, 1, 1, 1, 1, 1, 1, 1];
        const cw = pesosColumnas(weights, W);
        const idxLlegada = 1;
        const idxTraslado = 10;
        const idxPresion = 19;
        const hGroup1 = 7;
        const hGroup2 = 7;
        const hDetalleVert = 44;
        const yTab = y;
        const hHeadTotal = hGroup1 + hGroup2 + hDetalleVert;
        const yBodyStart = yTab + hHeadTotal;
        const yBodyEnd = layout.bottomY - 26;
        const nRows = TK20_PDF_FILAS;
        const hRow = Math.min(5.8, Math.max(4, (yBodyEnd - yBodyStart) / nRows));
        const yRowsBottom = yBodyStart + nRows * hRow;
        const vhOpts = { bold: true, fillGray: true, fontSize: FS_CABECERA_TABLA, fsFijo: true };

        const wClam = cw[0];
        const wLlegada = cw.slice(idxLlegada, idxLlegada + 9).reduce((a, b) => a + b, 0);
        const wTraslado = cw.slice(idxTraslado, idxTraslado + 9).reduce((a, b) => a + b, 0);
        const wPresion = cw.slice(idxPresion).reduce((a, b) => a + b, 0);
        const xClam = m;
        const xLlegada = xClam + wClam;
        const xTraslado = xLlegada + wLlegada;
        const xPresion = xTraslado + wTraslado;

        /** N° CLAMSHELL: hueco blanco arriba (corte sin borde superior/izquierdo), como PE-F-CPS-312 / Campo. */
        doc.setFillColor(255, 255, 255);
        doc.rect(xClam, yTab, wClam, hGroup1, 'F');
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.line(xClam + wClam, yTab, xClam + wClam, yBodyStart);
        rellenoGris(doc, xClam, yTab + hGroup1, wClam, hGroup2 + hDetalleVert);
        dibujarCeldaVerticalConLineas(
            doc, xClam, yTab + hGroup1, wClam, hGroup2 + hDetalleVert,
            ['N°', 'CLAMSHELL'], { ...vhOpts, fillGray: false }
        );

        dibujarCelda(doc, xLlegada, yTab, wLlegada, hGroup1, 'LLEGADA FRUTA ACOPIO', { bold: true, fillGray: true, fontSize: FS_CABECERA_GRUPO });
        dibujarCelda(doc, xTraslado, yTab, wTraslado, hGroup1, 'INICIO DE TRASLADO', { bold: true, fillGray: true, fontSize: FS_CABECERA_GRUPO });
        dibujarCelda(doc, xPresion, yTab, wPresion, hGroup1, 'PRESIÓN DE VAPOR (Kpa)', { bold: true, fillGray: true, fontSize: FS_CABECERA_GRUPO });

        let x = xLlegada;
        for (let i = 0; i < 9; i++) {
            dibujarHeaderColumnaVertical(
                doc, x, yTab + hGroup1, cw[idxLlegada + i], hGroup2 + hDetalleVert, TK20_ETAPA_COL_LABELS[i], vhOpts
            );
            x += cw[idxLlegada + i];
        }

        x = xTraslado;
        for (let i = 0; i < 9; i++) {
            dibujarHeaderColumnaVertical(
                doc, x, yTab + hGroup1, cw[idxTraslado + i], hGroup2 + hDetalleVert, TK20_ETAPA_COL_LABELS[i], vhOpts
            );
            x += cw[idxTraslado + i];
        }

        const wPresLleg = cw.slice(idxPresion, idxPresion + 4).reduce((a, b) => a + b, 0);
        const wPresTras = cw.slice(idxPresion + 4, idxPresion + 8).reduce((a, b) => a + b, 0);
        dibujarCelda(doc, xPresion, yTab + hGroup1, wPresLleg, hGroup2, 'LLEGADA FRUTA ACOPIO', { bold: true, fillGray: true, fontSize: FS_CABECERA_GRUPO });
        dibujarCelda(doc, xPresion + wPresLleg, yTab + hGroup1, wPresTras, hGroup2, 'INICIO DE TRASLADO', { bold: true, fillGray: true, fontSize: FS_CABECERA_GRUPO });

        x = xPresion;
        for (let i = 0; i < 4; i++) {
            dibujarHeaderColumnaVertical(
                doc, x, yTab + hGroup1 + hGroup2, cw[idxPresion + i], hDetalleVert, TK20_PRESION_COL_LABELS[i], vhOpts
            );
            x += cw[idxPresion + i];
        }
        for (let i = 0; i < 4; i++) {
            dibujarHeaderColumnaVertical(
                doc, x, yTab + hGroup1 + hGroup2, cw[idxPresion + 4 + i], hDetalleVert, TK20_PRESION_COL_LABELS[i], vhOpts
            );
            x += cw[idxPresion + 4 + i];
        }

        const filas = Array.isArray(datos.filas) ? datos.filas : [];
        for (let r = 0; r < nRows; r++) {
            const yRow = yBodyStart + r * hRow;
            const fila = filas[r] || {};
            const vals = valoresFilaTk20(datos, fila, r);
            let cx = m;
            for (let c = 0; c < cw.length; c++) {
                dibujarCelda(doc, cx, yRow, cw[c], hRow, vals[c], { fontSize: 6.2, pad: 0.45 });
                cx += cw[c];
            }
        }

        const yObs = yRowsBottom + 1.4;
        dibujarCampoMeta(doc, m, yObs, W, 'OBSERVACIONES:', datos.observaciones, { lineaCompleta: true });

        const ySigLine = yObs + 13;
        doc.setLineWidth(0.2);
        doc.line(m + 12, ySigLine, m + 82, ySigLine);
        doc.line(m + W - 82, ySigLine, m + W - 12, ySigLine);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Inspector de Calidad-Campo', m + 47, ySigLine + 4.4, { align: 'center' });
        doc.text('Supervisor o Coordinador de Calidad-Packing', m + W - 47, ySigLine + 4.4, { align: 'center' });

        disclaimer(doc, layout);
    }

    async function generarPdfTk20Blob(datos) {
        const JsPDF = obtenerJsPDF();
        if (!JsPDF) throw new Error('jsPDF no está cargado');
        const lista = normalizarListaDatosPdfTk20_(datos);
        if (!lista.length) throw new Error('No hay datos para generar el PDF.');
        const logoUrl = await cargarLogoDataUrl();
        const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        lista.forEach((item, idx) => {
            if (idx > 0) doc.addPage('a4', 'landscape');
            const normalizado = {
                codigo: item.codigo || CODIGO_DEFAULT,
                version: item.version || VERSION_DEFAULT,
                tituloHoja: item.tituloHoja || TITULO_DEFAULT,
                ...item
            };
            generarHojaTk20(doc, normalizado, logoUrl);
        });
        return doc.output('blob');
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

    function liberarCanvasesPaginaPdf_(item) {
        if (!item) return;
        try {
            if (item.canvas) {
                item.canvas.width = 0;
                item.canvas.height = 0;
            }
            if (item.bufferCanvas) {
                item.bufferCanvas.width = 0;
                item.bufferCanvas.height = 0;
            }
        } catch (_) { /* ignore */ }
        item.bufferCanvas = null;
        item.bufferCtx = null;
        item.ctx = null;
        item.canvas = null;
    }

    function destruirSesionPdfPreview_() {
        const session = pdfPreviewSession;
        pdfPreviewSession = null;
        if (!session) return;
        if (session.zoomTimer) {
            clearTimeout(session.zoomTimer);
            session.zoomTimer = null;
        }
        session.renderGen = (session.renderGen || 0) + 1;
        (session.pages || []).forEach(liberarCanvasesPaginaPdf_);
        session.pages = [];
        if (session.pdf) {
            try { session.pdf.cleanup?.(); } catch (_) { /* ignore */ }
            try { session.pdf.destroy?.(); } catch (_) { /* ignore */ }
            session.pdf = null;
        }
    }

    function limpiarVistaPreviaPdf() {
        ocultarVisorPdfNativo();
        destruirSesionPdfPreview_();
        const pages = document.getElementById('pdf-preview-pages');
        if (pages) pages.innerHTML = '';
        estadoVistaPreviaPdf('loading');
        resetPdfZoom();
    }

    async function renderizarVistaPreviaPdf(blob) {
        limpiarVistaPreviaPdf();
        estadoVistaPreviaPdf('loading');
        if (prefiereVisorPdfNativo() && pdfUrlActual && mostrarVisorPdfNativo(pdfUrlActual)) return;
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
            console.warn('[PDF preview tk20] reintento sin worker', errWorker);
            try {
                pdf = await cargarPdfParaVista(lib, data, true);
            } catch (err) {
                console.warn('[PDF preview tk20]', err);
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
        pdfPreviewSession = { pdf, pages, ancho, renderGen: 0, lastRenderedZoom: 1, zoomTimer: null };
        try {
            await renderizarPdfPreviewZoom(1);
            estadoVistaPreviaPdf('ready');
        } catch (err) {
            console.warn('[PDF preview tk20]', err);
            estadoVistaPreviaPdf('error');
        }
    }

    function cerrarModalPdf() {
        const ov = document.getElementById('pdf-modal-overlay');
        if (ov) ov.style.display = 'none';
        limpiarVistaPreviaPdf();
        revocarPdfUrlActual();
        pdfBlobActual = null;
        pdfDatosActual = null;
        pdfNombreActual = 'medicion-tk20.pdf';
        ultimoHashPdfVivoTk20_ = '';
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
        await renderizarVistaPreviaPdf(blob);
    }

    async function regenerarPdfVivoSiAbiertoTk20() {
        if (!window.PdfPreviewLive?.modalAbierto?.()) return;
        if (typeof window.obtenerDatosPdfTk20 !== 'function') return;
        try {
            if (!obtenerJsPDF()) return;
            const datos = window.obtenerDatosPdfTk20();
            const hash = JSON.stringify(datos);
            if (hash === ultimoHashPdfVivoTk20_) return;
            ultimoHashPdfVivoTk20_ = hash;
            const blob = await generarPdfTk20Blob(datos);
            await actualizarPdfVivoEnModal(blob, nombreArchivoPdf(datos), datos);
        } catch (_) {
            ultimoHashPdfVivoTk20_ = '';
            cerrarModalPdf();
        }
    }

    async function abrirModalPdf(blob, nombre, datosPdf) {
        pdfBlobActual = blob;
        pdfDatosActual = datosPdf || null;
        pdfNombreActual = nombre || 'medicion-tk20.pdf';
        ultimoHashPdfVivoTk20_ = datosPdf ? JSON.stringify(datosPdf) : '';
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

    function tituloCompartirPdfTk20_() {
        const lista = normalizarListaTituloPdfTk20_(pdfDatosActual);
        if (lista.length && typeof window.textoNombresPdfParaCompartir === 'function') {
            return window.textoNombresPdfParaCompartir(lista, { modo: 'TK-2.0' });
        }
        return pdfNombreActual.replace(/\.pdf$/i, '');
    }

    async function compartirWhatsAppPdf() {
        if (!pdfBlobActual) return;
        const file = new File([pdfBlobActual], pdfNombreActual, { type: 'application/pdf' });
        const titulo = tituloCompartirPdfTk20_();
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

    async function generarYMostrarPdfTk20() {
        if (typeof window.obtenerDatosPdfTk20 !== 'function') {
            if (window.Swal) {
                window.Swal.fire({ icon: 'error', title: 'PDF no disponible', text: 'Recarga la página e intenta de nuevo.' });
            }
            return;
        }
        const btn = document.getElementById('fab-tk20-pdf');
        if (btn) btn.disabled = true;
        try {
            if (!obtenerJsPDF()) {
                throw new Error('Biblioteca PDF no cargada. Conéctate una vez a internet para precargar.');
            }
            const datos = window.obtenerDatosPdfTk20();
            const blob = await generarPdfTk20Blob(datos);
            await abrirModalPdf(blob, nombreArchivoPdf(datos), datos);
        } catch (e) {
            const msg = e && e.message ? e.message : 'No se pudo generar el PDF.';
            if (window.Swal) {
                window.Swal.fire({ icon: 'error', title: 'Error al generar PDF', text: msg });
            } else {
                window.alert(msg);
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function initTk20Pdf() {
        window.PdfPreviewLive?.registrar?.(regenerarPdfVivoSiAbiertoTk20);
        enlazarZoomVistaPreviaPdf();
        document.getElementById('fab-tk20-pdf')?.addEventListener('click', () => {
            if (typeof window.establecerMenuFlotanteTk20 === 'function') {
                window.establecerMenuFlotanteTk20(false);
            }
            void generarYMostrarPdfTk20();
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
        document.addEventListener('DOMContentLoaded', initTk20Pdf);
    } else {
        initTk20Pdf();
    }

    window.generarPdfTk20Blob = generarPdfTk20Blob;
    window.generarYMostrarPdfTk20 = generarYMostrarPdfTk20;
    window.nombreArchivoPdfTk20 = nombreArchivoPdf;
})();
