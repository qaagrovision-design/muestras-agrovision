/**
 * PDF Agrovision (Campo) — Hoja 1 igual al formulario físico PE-F-QPH-306.
 */
(function campoPdfModule() {
    /** Raíz del proyecto: Visual en /, Acopio en /acopio/. */
    function baseRaizCampoPdf_() {
        if (String(window.CAMPO_REGISTRO_MODO || '').trim() === 'acopio') return '../';
        const path = String(window.location.pathname || '').replace(/\\/g, '/');
        if (/\/acopio(\/|$)/i.test(path)) return '../';
        if (/\/historial(\/|$)/i.test(path)) return '../';
        if (/\/packing(\/|$)/i.test(path)) return '../';
        return './';
    }

    function urlCampoPdfDesdeRaiz_(rel) {
        const base = baseRaizCampoPdf_();
        try {
            return new URL(base + rel, document.baseURI || window.location.href).href;
        } catch (_) {
            return base + rel;
        }
    }

    function logoUrlCampoPdf_() {
        return urlCampoPdfDesdeRaiz_('log.png');
    }

    const PAGE = { w: 297, h: 210, margin: 7 };
    const GRIS_CABECERA = { r: 217, g: 217, b: 217 };
    /** Igual que Excel «Girar texto hacia arriba»: 90° CCW, centrado en la celda. */
    const ANGULO_EXCEL_HACIA_ARRIBA = 90;
    /** Tamaño unificado de cabeceras (referencia: INICIO DE COSECHA). */
    const FS_CABECERA_TABLA = 6.4;
    const FS_CABECERA_GRUPO = FS_CABECERA_TABLA;
    const FS_CABECERA_VERTICAL = FS_CABECERA_TABLA;
    const FS_CABECERA_VERTICAL_MIN = 3.5;
    const PAD_CELDA_VERTICAL_X = 3.9;
    const PAD_CELDA_VERTICAL_Y = 1.5;
    /** jsPDF 2.x no rota bien con center/middle; centrado geométrico vía left/bottom. */
    const ANCLAJE_VERTICAL = {
        angle: ANGULO_EXCEL_HACIA_ARRIBA,
        align: 'left',
        baseline: 'bottom'
    };

    let logoDataUrlCache = null;
    let pdfBlobActual = null;
    let pdfNombreActual = 'medicion-arandano.pdf';
    let pdfMensajeWhatsAppActual = '';
    let pdfUrlActual = null;
    let pdfjsLibInited = false;
    let pdfPreviewSession = null;
    let pdfVisorModalInited = false;
    const pdfZoomState = { scale: 1, min: 0.6, max: 4, step: 0.35 };
    const PDF_PREVIEW_DPR = () => Math.min(window.devicePixelRatio || 1, 3);

    function workerSrcPdfJs() {
        return urlCampoPdfDesdeRaiz_('librerias/pdf.worker.min.js');
    }

    function standardFontsUrlPdfJs() {
        return urlCampoPdfDesdeRaiz_('librerias/standard_fonts/');
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

    /** Margen extra para que el contenido no se corte al imprimir (ambas hojas). */
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

    async function cargarLogoDataUrl() {
        if (logoDataUrlCache) return logoDataUrlCache;
        try {
            const r = await fetch(logoUrlCampoPdf_(), { cache: 'force-cache' });
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

    function normalizarListaDatosPdfCampo_(datos) {
        if (Array.isArray(datos?.muestras) && datos.muestras.length) return datos.muestras;
        if (datos && datos.filas) return [datos];
        return [];
    }

    function nombreArchivoPdf(datos) {
        const lista = normalizarListaDatosPdfCampo_(datos);
        if (typeof window.nombreArchivoPdfDesdeListaMuestras === 'function') {
            return window.nombreArchivoPdfDesdeListaMuestras(lista);
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
        const fsInicial = o.fontSize || 7;
        const align = o.align || 'center';
        const pad = o.pad != null ? o.pad : 1;
        const maxW = Math.max(2, w - pad * 2);
        doc.setFont('helvetica', o.bold ? 'bold' : 'normal');

        if (o.nowrap) {
            let fs = fsInicial;
            const linea = String(texto).replace(/\s+/g, ' ').trim();
            doc.setFontSize(fs);
            let dim = medirTextoHorizontal(doc, linea, fs);
            const fsMin = o.fsMin != null ? o.fsMin : 4.2;
            while (dim.ancho > maxW && fs > fsMin) {
                fs -= 0.15;
                doc.setFontSize(fs);
                dim = medirTextoHorizontal(doc, linea, fs);
            }
            const ty = y + h / 2 + fs * 0.15;
            if (align === 'left') doc.text(linea, x + pad, ty, { align: 'left' });
            else doc.text(linea, x + w / 2, ty, { align: 'center' });
            return;
        }

        doc.setFontSize(fsInicial);
        const lines = doc.splitTextToSize(String(texto), maxW);
        const lineH = fsInicial * 0.4;
        const blockH = lines.length * lineH;
        let ty = y + (h - blockH) / 2 + lineH * 0.85;
        lines.forEach((ln) => {
            if (align === 'left') doc.text(ln, x + pad, ty, { align: 'left' });
            else doc.text(ln, x + w / 2, ty, { align: 'center' });
            ty += lineH;
        });
    }

    function lineasVertical(texto) {
        return String(texto).split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    }

    /** Anclaje left/bottom + angle 90: centro geométrico del texto rotado en la celda. */
    function anclajeVerticalCentrado(x, y, w, h, dim, padX) {
        const px = padX != null ? padX : PAD_CELDA_VERTICAL_X;
        return {
            tx: x + px + Math.max(0, (w - px * 2 - dim.alto) / 2),
            ty: y + (h + dim.ancho) / 2
        };
    }

    /** Tamaño inicial para texto vertical (soporta varias líneas con \\n). */
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

    /** Texto vertical (90° CCW), una línea por celda — centrado geométrico (como PESO 1). */
    function dibujarCeldaVertical(doc, x, y, w, h, texto, opts) {
        const o = opts || {};
        if (o.fillGray) rellenoGris(doc, x, y, w, h);
        else borde(doc, x, y, w, h);
        if (!txt(texto)) return;
        const t = String(texto).replace(/\s+/g, ' ').trim();
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
            while (
                (dim.alto > w - padX * 2 || dim.ancho > h - padY * 2)
                && fs > fsMin
            ) {
                fs -= 0.08;
                doc.setFontSize(fs);
                dim = medirTextoHorizontal(doc, t, fs);
            }
        }

        const { tx, ty } = anclajeVerticalCentrado(x, y, w, h, dim, padX);
        doc.text(t, tx, ty, ANCLAJE_VERTICAL);
    }

    /** Cabeceras con varias líneas (temperatura, traslado). */
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
            while (
                (doc.getStringUnitWidth(linea2) * fs2) / scale > maxTitW
                && fs2 > 5.2
            ) {
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
        doc.text(`Código: ${datos.codigo || (esPdfCampoModoAcopio_(datos) ? 'PE-F-QPH-305' : 'PE-F-QPH-306')}`, xDer + padDer, y0 + 6.2, { align: 'left' });
        doc.text(`Versión: ${datos.version || '1'}`, xDer + padDer, y0 + 12.2, { align: 'left' });

        return y0 + headH + 0.75;
    }

    function anchoTexto(doc, texto, fs) {
        const scale = doc.internal.scaleFactor || 1;
        return (doc.getStringUnitWidth(String(texto)) * fs) / scale;
    }

    /** Etiqueta y valor en la misma línea, justo después del «:». */
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

    /** Meta: 3 filas × 3 columnas, sin cuadro exterior (igual al formulario PE-F-QPH-306). */
    function bloqueMeta(doc, datos, yStart, layout) {
        const m = layout?.margin ?? PAGE.margin;
        const W = layout?.width ?? contentWidth();
        const meta = datos.meta || {};
        const desplazDer = 5;
        const metaW = W - desplazDer;
        const colW = metaW / 3;
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
                { label: 'GUIA DE REMISIÓN ACOPIO CAMPO:', val: meta.guiaRemision },
                { label: 'RÓTULO DE MUESTRA:', val: meta.rotulo || datos.ensayo },
                { label: 'HORA DE INICIO GENERAL:', val: meta.horaInicio }
            ],
            [
                { label: 'VARIEDAD:', val: meta.variedad },
                { label: 'PLACA DEL VEHÍCULO:', val: meta.placa },
                { label: 'DIAS DE PRECOSECHA/Nº DE COSECHA:', val: meta.precosecha }
            ]
        ];

        let y = yStart + padSup;
        filas.forEach((fila) => {
            fila.forEach((cell, c) => {
                dibujarCampoMeta(doc, m + desplazDer + c * colW, y, colW, cell.label, cell.val);
            });
            y += rowH;
        });
        return y + padInf;
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

    function esPdfCampoModoAcopio_(datos) {
        const m = String(datos?.modoRegistro || datos?.muestras?.[0]?.modoRegistro || '').trim();
        if (m === 'acopio') return true;
        if (m === 'visual') return false;
        return String(window.CAMPO_REGISTRO_MODO || '').trim() === 'acopio';
    }

    /** PESO 5 Acopio: única cabecera con 2 líneas (corte antes de CAMPO). */
    const PESO_ACOPIO_HDR_P5_LINEAS = [
        'PESO 5 DESPACHO ACOPIO',
        '- CAMPO (PESO CLAMSHELL)'
    ];

    /** Cabeceras PESO BRUTO modo Acopio — una sola línea vertical (sin salto). */
    const PESO_ACOPIO_HDR = [
        'PESO 1 - TÉRMINO DE COSECHA',
        'PESO 2 - LLEGADA ACOPIO',
        'PESO 3 - ACOPIO CALIBRADO',
        'PESO 4 CLAMSHELL CALIBRADO'
    ];

    /** Cabeceras TIEMPOS modo Acopio — una sola línea vertical (sin salto). */
    const TIEMPO_ACOPIO_HDR = [
        'INICIO DE COSECHA',
        'TÉRMINO DE COSECHA',
        'LLEGADA ACOPIO - CAMPO',
        'ACOPIO CALIBRADO',
        'TÉRMINO DE CALIBRADO',
        'DESPACHO ACOPIO - CAMPO'
    ];

    function generarHoja1(doc, datos, logoUrl) {
        const layout = layoutHojaImpresion();
        const m = layout.margin;
        const W = layout.width;
        let y = encabezadoPagina(doc, datos, datos.tituloHoja1, logoUrl, layout);
        y = bloqueMeta(doc, datos, y, layout);

        const modoAcopio = esPdfCampoModoAcopio_(datos);
        const weightsVisual = [
            1.85, 1.95,
            2.5, 2.5, 2.5, 2.5, 2.5, 2.6, 2.6,
            2.8, 3.0, 2.8, 2.6, 2.6,
            3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3,
            2.6, 3.2, 2.4, 2.4, 2.6
        ];
        /** Acopio: 2 + 5 peso + 6 tiempos + 8 temp + 5 jarras = 26 (sin cols llegada/despacho peso). */
        const weightsAcopio = [
            1.85, 1.95,
            2.5, 2.5, 2.5, 2.5, 2.5,
            2.8, 3.0, 2.8, 2.6, 2.6, 2.8,
            3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3,
            2.6, 3.2, 2.4, 2.4, 2.6
        ];
        const weights = modoAcopio ? weightsAcopio : weightsVisual;
        const cw = pesosColumnas(weights, W);
        const nCols = modoAcopio ? 26 : 27;
        const idxTemp = modoAcopio ? 13 : 14;
        const idxJarraLlenado = modoAcopio ? 21 : 22;
        const nTemp = 8;

        const hGroup = 7;
        const hDetalleUnico = 42;
        const hTempEv = 20;
        const hTempSub = 22;
        const hHeadTotal = hGroup + hDetalleUnico;
        /** Formato físico: 8 filas con datos + 4 vacías; altura fija (no estirar al pie). */
        const nFilasDatos = 8;
        const nFilasVacias = 4;
        const nFilasCuerpo = nFilasDatos + nFilasVacias;
        const hRow = 5.9;
        const hFoot = 11;
        const yTab = y;
        const yDet = yTab + hGroup;

        const subLabels = [
            'Nº CLAMSHELL', 'Nº JARRA',
            'PESO 1', 'PESO 2', 'PESO 3', 'PESO 4', 'PESO 5',
            'LLEGADA ACOPIO - CAMPO', 'DESPACHO ACOPIO - CAMPO',
            'INICIO DE COSECHA', 'INICIO DE PERDIDA DE PESO', 'TÉRMINO DE COSECHA',
            'LLEGADA ACOPIO - CAMPO', 'DESPACHO ACOPIO - CAMPO',
            '', '', '', '', '', '', '', '',
            'Nº DE JARRA - LLENADO', 'TRASLADO U OTRA OBSERVACION', 'INICIO', 'TERMINO', 'TIEMPO EMPLEADO'
        ];

        const tempEventsLineas = [
            ['INICIO DE', 'COSECHA'],
            ['TÉRMINO DE', 'COSECHA'],
            ['LLEGADA', 'ACOPIO', 'CAMPO'],
            ['DESPACHO', 'ACOPIO -', 'CAMPO']
        ];
        const tempSubLabels = ['T° AMBIENTE', 'T° PULPA'];

        const labelsGroup = modoAcopio
            ? [
                { i: 2, n: 5, t: 'PESO BRUTO (G)' },
                { i: 7, n: 6, t: 'TIEMPOS DE LA MUESTRA (HORA)' },
                { i: 13, n: 8, t: 'TEMPERATURA MUESTRA(°C)' },
                { i: 21, n: 5, t: 'TIEMPO DE LLENADO DE JARRAS (HORA)' }
            ]
            : [
                { i: 2, n: 7, t: 'PESO BRUTO (G)' },
                { i: 9, n: 5, t: 'TIEMPOS DE LA MUESTRA (HORA)' },
                { i: 14, n: 8, t: 'TEMPERATURA MUESTRA(°C)' },
                { i: 22, n: 5, t: 'TIEMPO DE LLENADO DE JARRAS (HORA)' }
            ];

        const vHdr = { bold: true, fillGray: true, fontSize: FS_CABECERA_TABLA, fsFijo: true };
        const PADX_TIEMPOS_MUESTRA = 4.2;
        const idxPadTiemposMuestra = modoAcopio
            ? new Set([7, 8, 9, 10, 11, 12])
            : new Set([9, 10, 11, 12, 13]);
        const wClamJarra = cw[0] + cw[1];
        /** N° CLAMSHELL + N° JARRA: hueco blanco arriba (sin borde arriba/izquierda, como formato físico). */
        doc.setFillColor(255, 255, 255);
        doc.rect(m, yTab, wClamJarra, hGroup, 'F');
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.line(m + wClamJarra, yTab, m + wClamJarra, yDet);
        rellenoGris(doc, m, yDet, wClamJarra, hDetalleUnico);
        doc.line(m + cw[0], yDet, m + cw[0], yDet + hDetalleUnico);
        dibujarCeldaVertical(doc, m, yDet, cw[0], hDetalleUnico, subLabels[0], { ...vHdr, fillGray: false });
        dibujarCeldaVertical(doc, m + cw[0], yDet, cw[1], hDetalleUnico, subLabels[1], { ...vHdr, fillGray: false });

        /** Grupos (PESO BRUTO, etc.) solo desde columna 3. */
        let x = m + wClamJarra;
        labelsGroup.forEach((g) => {
            const w = cw.slice(g.i, g.i + g.n).reduce((a, b) => a + b, 0);
            dibujarCelda(doc, x, yTab, w, hGroup, g.t, { fontSize: FS_CABECERA_GRUPO, bold: true, fillGray: true, nowrap: true });
            x += w;
        });

        const yTempEv = yDet;
        const yTempSub = yDet + hTempEv;

        for (let i = 2; i < idxTemp; i++) {
            const xi = m + cw.slice(0, i).reduce((a, b) => a + b, 0);
            const hdrCol = idxPadTiemposMuestra.has(i) ? { ...vHdr, padX: PADX_TIEMPOS_MUESTRA } : vHdr;
            if (modoAcopio && i === 6) {
                dibujarCeldaVerticalConLineas(
                    doc, xi, yDet, cw[i], hDetalleUnico, PESO_ACOPIO_HDR_P5_LINEAS, hdrCol
                );
            } else if (modoAcopio && i >= 2 && i <= 5) {
                dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, PESO_ACOPIO_HDR[i - 2], hdrCol);
            } else if (modoAcopio && i >= 7 && i <= 12) {
                dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, TIEMPO_ACOPIO_HDR[i - 7], hdrCol);
            } else {
                dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, subLabels[i], hdrCol);
            }
        }

        let xt = m + cw.slice(0, idxTemp).reduce((a, b) => a + b, 0);
        tempEventsLineas.forEach((lineas, ei) => {
            const w = cw[idxTemp + ei * 2] + cw[idxTemp + ei * 2 + 1];
            dibujarCeldaVerticalConLineas(doc, xt, yTempEv, w, hTempEv, lineas, vHdr);
            xt += w;
        });

        xt = m + cw.slice(0, idxTemp).reduce((a, b) => a + b, 0);
        for (let i = 0; i < nTemp; i++) {
            dibujarCeldaVertical(
                doc,
                xt,
                yTempSub,
                cw[idxTemp + i],
                hTempSub,
                tempSubLabels[i % 2],
                vHdr
            );
            xt += cw[idxTemp + i];
        }

        const trasladoLineas = ['TRASLADO U OTRA', 'OBSERVACION'];
        const subLabelsJarraLlenado = [
            'Nº DE JARRA - LLENADO', 'TRASLADO U OTRA OBSERVACION', 'INICIO', 'TERMINO', 'TIEMPO EMPLEADO'
        ];
        for (let j = 0; j < subLabelsJarraLlenado.length; j++) {
            const i = idxJarraLlenado + j;
            const xi = m + cw.slice(0, i).reduce((a, b) => a + b, 0);
            if (j === 1) {
                dibujarCeldaVerticalConLineas(doc, xi, yDet, cw[i], hDetalleUnico, trasladoLineas, vHdr);
            } else {
                dibujarCeldaVertical(doc, xi, yDet, cw[i], hDetalleUnico, subLabelsJarraLlenado[j], vHdr);
            }
        }

        y = yTab + hHeadTotal;

        for (let ri = 0; ri < nFilasCuerpo; ri++) {
            const fila = (datos.filas || [])[ri] || {};
            x = m;
            const tiemposFila = modoAcopio
                ? [
                    fila.tInicioCosecha, fila.tTermino, fila.tLlegada,
                    fila.tAcopioCalibrado, fila.tTerminoCalibrado, fila.tDespacho
                ]
                : [
                    fila.tInicioCosecha, fila.tPerdida, fila.tTermino, fila.tLlegada, fila.tDespacho
                ];
            const pesosFila = modoAcopio
                ? [fila.p1, fila.p2, fila.p3, fila.p4, fila.p5]
                : [fila.p1, fila.p2, fila.p3, fila.p4, fila.p5, fila.llegada, fila.despacho];
            const vals = [
                fila.nClam,
                fila.jarra,
                ...pesosFila,
                ...tiemposFila,
                fila.tempInicioAmb, fila.tempInicioPul, fila.tempTerminoAmb, fila.tempTerminoPul,
                fila.tempLlegadaAmb, fila.tempLlegadaPul, fila.tempDespachoAmb, fila.tempDespachoPul,
                fila.jarraLlenado, fila.trasladoObs, fila.jarraInicio, fila.jarraTermino, fila.jarraTiempo
            ];
            cw.forEach((w, i) => {
                dibujarCelda(doc, x, y, w, hRow, valCelda(vals[i]), { fontSize: 6.2, pad: 0.4 });
                x += w;
            });
            y += hRow;
        }

        const yFootTop = y;
        const idxObsFoot = 7;
        const xPesado = m;
        const pesadoW = cw[0] + cw[1];
        const xObs = m + cw.slice(0, idxObsFoot).reduce((a, b) => a + b, 0);
        const obsW = W - cw.slice(0, idxObsFoot).reduce((a, b) => a + b, 0);

        rellenoGris(doc, xPesado, yFootTop, pesadoW, hFoot);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        const lhPesado = 2.45;
        const etiquetaPesado = ['HORA', 'DE', 'PESADO'];
        const bloquePesadoH = lhPesado * etiquetaPesado.length;
        let yPesadoLbl = yFootTop + (hFoot - bloquePesadoH) / 2 + lhPesado * 0.85;
        etiquetaPesado.forEach((ln) => {
            doc.text(ln, xPesado + pesadoW / 2, yPesadoLbl, { align: 'center' });
            yPesadoLbl += lhPesado;
        });

        let xPieMid = xPesado + pesadoW;
        for (let ci = 2; ci < idxObsFoot; ci++) {
            borde(doc, xPieMid, yFootTop, cw[ci], hFoot);
            xPieMid += cw[ci];
        }

        borde(doc, xObs, yFootTop, obsW, hFoot);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.text('OBSERVACIONES:', xObs + 2, yFootTop + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        const obsFormato = txt(datos.observacionesFormato);
        if (obsFormato) {
            const lineas = doc.splitTextToSize(obsFormato, obsW - 4);
            let yObs = yFootTop + 7;
            const lh = 2.8;
            const yMax = yFootTop + hFoot - 1;
            lineas.forEach((linea) => {
                if (yObs > yMax) return;
                doc.text(linea, xObs + 2, yObs);
                yObs += lh;
            });
        }
        if (txt(datos.horaPesado)) {
            doc.setFontSize(6);
            doc.text(datos.horaPesado, xPesado + pesadoW / 2, yFootTop + hFoot - 1.2, { align: 'center' });
        }

        disclaimer(doc, layout);
    }

    function generarHoja2(doc, datos, logoUrl) {
        const layout = layoutHojaImpresion();
        const m = layout.margin;
        const W = layout.width;
        let y = encabezadoPagina(doc, datos, datos.tituloHoja2, logoUrl, layout);
        y = bloqueMeta(doc, datos, y, layout);

        const p2 = datos.pagina2 || {};
        const eventos = ['INICIO DE COSECHA', 'TÉRMINO DE COSECHA', 'LLEGADA ACOPIO', 'DESPACHO - ACOPIO'];
        const vHdrH2 = { fillGray: true, bold: true, fontSize: FS_CABECERA_TABLA, fsFijo: true };
        const grupos = [
            { tit: 'HUMEDAD RELATIVA(%)', vals: p2.humedad || [] },
            { tit: 'TEMPERATURA AMBIENTE (°C)', vals: p2.tempAmbiente || [] },
            { tit: 'PRESIÓN DE VAPOR AMBIENTE (Kpa)', vals: p2.presionAmb || [] },
            { tit: 'PRESIÓN DE VAPOR FRUTA (Kpa)', vals: p2.presionFruta || [] }
        ];

        const obsW = W * 0.26;
        const dataW = W - obsW;
        const colW = dataW / 16;
        const hG = 7;
        const hSub = 36;
        const hData = 7.5;
        const hFilaVacia = 5.8;
        const ySig = layout.bottomY - 18;
        const filasVacias = Math.max(11, Math.floor((ySig - y - hG - hSub - hData - 8) / hFilaVacia));

        function listaObservacionesP2(pagina2) {
            if (Array.isArray(pagina2?.observacionesLista)) {
                return pagina2.observacionesLista.map((o) => valCelda(o));
            }
            const raw = txt(pagina2?.observaciones);
            if (!raw) return [];
            return raw.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
        }

        const obsLista = listaObservacionesP2(p2);
        const yTab = y;
        const obsX = m + dataW;

        const ySub = yTab + hG;
        const hObsHdr = hG + hSub;

        grupos.forEach((g, gi) => {
            const xg = m + gi * colW * 4;
            dibujarCelda(doc, xg, yTab, colW * 4, hG, g.tit, { fontSize: FS_CABECERA_GRUPO, bold: true, fillGray: true, nowrap: true });
        });
        rellenoGris(doc, obsX, yTab, obsW, hObsHdr);

        let x = m;
        for (let i = 0; i < 16; i++) {
            dibujarCeldaVertical(doc, x, ySub, colW, hSub, eventos[i % 4], vHdrH2);
            x += colW;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FS_CABECERA_TABLA);
        doc.text('OBSERVACIONES', obsX + obsW / 2, ySub + hSub / 2 + 2, { align: 'center' });

        const yData = ySub + hSub;
        x = m;
        const filaVals = [];
        grupos.forEach((g) => (g.vals || []).forEach((v) => filaVals.push(v)));
        for (let i = 0; i < 16; i++) {
            dibujarCelda(doc, x, yData, colW, hData, valCelda(filaVals[i]), { fontSize: 6.2, pad: 0.4 });
            x += colW;
        }
        dibujarCelda(doc, obsX, yData, obsW, hData, valCelda(obsLista[0]), {
            fontSize: 6.2,
            pad: 0.4,
            align: 'center'
        });

        y = yData + hData;
        for (let r = 0; r < filasVacias; r++) {
            x = m;
            for (let i = 0; i < 16; i++) {
                dibujarCelda(doc, x, y, colW, hFilaVacia, '', { fontSize: 6.2, pad: 0.4 });
                x += colW;
            }
            dibujarCelda(doc, obsX, y, obsW, hFilaVacia, valCelda(obsLista[r + 1]), {
                fontSize: 6.2,
                pad: 0.4,
                align: 'center'
            });
            y += hFilaVacia;
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

    function mensajePdfCampoSinDatos_() {
        const acopio = String(window.CAMPO_REGISTRO_MODO || '').trim() === 'acopio'
            || /\/acopio(\/|$)/i.test(String(window.location.pathname || ''));
        if (acopio) {
            return 'Para generar el PDF, agrega al menos un peso en un clamshell (Peso 4 y Peso 5) '
                + 'o completa datos importantes como temperatura y humedad en la muestra activa.';
        }
        return 'Para generar el PDF, agrega al menos un peso en un clamshell (Peso 1 u otro) '
            + 'o completa datos importantes como temperatura y humedad en la muestra activa.';
    }

    async function generarPdfCampoBlob(datos) {
        const JsPDF = obtenerJsPDF();
        if (!JsPDF) throw new Error('jsPDF no está cargado');
        const lista = normalizarListaDatosPdfCampo_(datos);
        if (!lista.length) {
            throw new Error(mensajePdfCampoSinDatos_());
        }
        const logoUrl = await cargarLogoDataUrl();
        const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        lista.forEach((item, idx) => {
            if (idx > 0) doc.addPage('a4', 'landscape');
            generarHoja1(doc, item, logoUrl);
            doc.addPage('a4', 'landscape');
            generarHoja2(doc, item, logoUrl);
        });
        return doc.output('blob');
    }

    const PAGE_AVANCE = { w: 210, h: 297, margin: 14 };
    const AZUL_AVANCE = { r: 15, g: 74, b: 125 };
    const GRIS_AVANCE = { r: 241, g: 245, b: 249 };

    function nombreArchivoPdfAvance(datos) {
        const lista = Array.isArray(datos?.muestras) ? datos.muestras : [];
        if (typeof window.nombreArchivoPdfDesdeListaMuestras === 'function' && lista.length) {
            return window.nombreArchivoPdfDesdeListaMuestras(lista.map((bloque) => ({
                ensayo: bloque.ensayo,
                muestraLabel: bloque.meta?.muestraLabel,
                fecha: datos?.fecha,
                meta: {
                    ...(bloque.meta || {}),
                    rotulo: bloque.meta?.muestraLabel || bloque.meta?.rotulo,
                    trazabilidadArchivo: bloque.meta?.trazabilidadArchivo || bloque.meta?.trazabilidad,
                    fecha: datos?.fecha || bloque.meta?.fecha
                }
            })));
        }
        return 'muestra.pdf';
    }

    function textoResumenWhatsAppAvance(datos) {
        const lineas = ['*Avance para Packing*', `Fecha: ${txt(datos?.fecha) || '—'}`];
        (datos?.muestras || []).forEach((bloque) => {
            const m = bloque.meta || {};
            lineas.push('');
            lineas.push(`*${txt(m.muestraLabel) || txt(m.ensayo)}* · N° ${txt(m.numMuestra) || '—'}`);
            if (txt(m.trazabilidad)) lineas.push(`Traz: ${txt(m.trazabilidad)}`);
            if (txt(m.variedad)) lineas.push(`Variedad: ${txt(m.variedad)}`);
            if (txt(m.placa)) lineas.push(`Placa: ${txt(m.placa)}`);
            if (txt(m.guia)) lineas.push(`Guía acopio: ${txt(m.guia)}`);
            (bloque.clamshells || []).forEach((c) => {
                const peso = txt(c.pesoDespacho);
                const hora = txt(c.horaDespacho);
                const det = [
                    peso ? `${peso}g` : '',
                    hora ? `hora ${hora}` : ''
                ].filter(Boolean).join(' · ');
                lineas.push(`Clamshell #${c.clamshell}: ${det || 'sin despacho aún'}`);
            });
        });
        lineas.push('', '_PDF adjunto con detalle._');
        return lineas.join('\n');
    }

    function dibujarBloqueMetaAvance(doc, x, y, w, titulo, filas) {
        const pad = 2;
        const labelW = 40;
        const titleH = 5;
        const rowH = 5;
        const h = pad + titleH + filas.length * rowH + pad;
        doc.setFillColor(GRIS_AVANCE.r, GRIS_AVANCE.g, GRIS_AVANCE.b);
        doc.setDrawColor(AZUL_AVANCE.r, AZUL_AVANCE.g, AZUL_AVANCE.b);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(AZUL_AVANCE.r, AZUL_AVANCE.g, AZUL_AVANCE.b);
        doc.text(titulo, x + pad, y + pad + 3.2);
        doc.setTextColor(30, 41, 59);
        let cy = y + pad + titleH;
        filas.forEach(([label, value]) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(String(label), x + pad, cy + 3);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            const val = txt(value) || '—';
            const valLines = doc.splitTextToSize(val, w - labelW - pad * 2);
            doc.text(valLines[0] || '—', x + pad + labelW, cy + 3);
            cy += rowH;
        });
        return y + h + 5;
    }

    /** Encabezado en 3 columnas — mismas medidas que PDF Campo/Packing. */
    function dibujarEncabezadoAvancePacking(doc, datos, logoUrl, m, W) {
        const y0 = m;
        const headH = 17;
        const colIzqW = 52;
        const colDerW = 46;
        const colMidW = W - colIzqW - colDerW;
        const xIzq = m;
        const xMid = m + colIzqW;
        const xDer = m + colIzqW + colMidW;

        doc.setDrawColor(AZUL_AVANCE.r, AZUL_AVANCE.g, AZUL_AVANCE.b);
        doc.setLineWidth(0.35);
        doc.setTextColor(0, 0, 0);
        doc.rect(m, y0, W, headH);
        doc.line(xMid, y0, xMid, y0 + headH);
        doc.line(xDer, y0, xDer, y0 + headH);

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
        doc.text('AGROVISION', xIzq + colIzqW / 2, y0 + headH - 2.6, { align: 'center' });

        const midCx = xMid + colMidW / 2;
        const maxTitW = colMidW - 4;
        const linea1 = 'AVANCE PARA PACKING';
        const linea2 = 'Campo - referencia operativa (no reemplaza registro completo)';
        doc.setFont('helvetica', 'bold');
        let fs1 = 9.5;
        let fs2 = 7.2;
        doc.setFontSize(fs2);
        const scale = doc.internal.scaleFactor || 1;
        while (
            (doc.getStringUnitWidth(linea2) * fs2) / scale > maxTitW
            && fs2 > 5.2
        ) {
            fs2 -= 0.1;
            doc.setFontSize(fs2);
        }
        const gapTit = 3;
        const blockH = fs1 * 0.35 + gapTit + fs2 * 0.35;
        let ty = y0 + (headH - blockH) / 2 + fs1 * 0.3;
        doc.setFontSize(fs1);
        doc.text(linea1, midCx, ty, { align: 'center' });
        ty += gapTit + fs1 * 0.05;
        doc.setFontSize(fs2);
        doc.setFont('helvetica', 'normal');
        doc.text(linea2, midCx, ty, { align: 'center' });

        const padDer = 2;
        const generado = txt(datos?.generadoEn) || '—';
        const fecha = txt(datos?.fecha) ? `Fecha: ${txt(datos.fecha)}` : 'Fecha: —';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.text(generado, xDer + padDer, y0 + 6.2, { align: 'left' });
        doc.text(fecha, xDer + padDer, y0 + 12.2, { align: 'left' });

        return y0 + headH + 4;
    }

    function generarHojaAvancePacking(doc, datos, logoUrl) {
        const m = PAGE_AVANCE.margin;
        const W = PAGE_AVANCE.w - m * 2;
        let y = dibujarEncabezadoAvancePacking(doc, datos, logoUrl, m, W);

        (datos?.muestras || []).forEach((bloque, idx) => {
            if (y > PAGE_AVANCE.h - 55) {
                doc.addPage('a4', 'portrait');
                y = m;
            }
            const meta = bloque.meta || {};
            if (idx > 0) y += 4;
            y += 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(AZUL_AVANCE.r, AZUL_AVANCE.g, AZUL_AVANCE.b);
            doc.text(`${txt(meta.muestraLabel) || txt(meta.ensayo)} · N° ${txt(meta.numMuestra) || '—'}`, m, y + 3.5);
            y += 8;

            y = dibujarBloqueMetaAvance(doc, m, y, W, 'Identificación', [
                ['Trazabilidad', meta.trazabilidad],
                ['Fundo', meta.fundo],
                ['Variedad', meta.variedad],
                ['Responsable', meta.responsable]
            ]);

            y = dibujarBloqueMetaAvance(doc, m, y, W, 'Logística acopio-campo', [
                ['Placa vehículo', meta.placa],
                ['Guía remisión acopio', meta.guia]
            ]);

            const cols = [16, 14, 26, 22, 22, 22, W - 122];
            const headers = ['Clamshell', 'Jarra', 'Peso despacho', 'Hora desp.', 'Temp. amb.', 'Temp. pulpa', 'Observación'];
            const headH = 8;
            const rowH = 9;
            const filas = bloque.clamshells || [];
            const tableH = headH + Math.max(1, filas.length) * rowH;

            if (y + tableH > PAGE_AVANCE.h - m) {
                doc.addPage('a4', 'portrait');
                y = m;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(AZUL_AVANCE.r, AZUL_AVANCE.g, AZUL_AVANCE.b);
            y += 3;
            doc.text('Despacho acopio-campo por clamshell', m, y + 3);
            y += 7;

            let cx = m;
            doc.setFillColor(AZUL_AVANCE.r, AZUL_AVANCE.g, AZUL_AVANCE.b);
            doc.rect(m, y, W, headH, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            headers.forEach((h, i) => {
                if (i > 0) {
                    doc.setDrawColor(255, 255, 255);
                    doc.line(cx, y, cx, y + headH);
                }
                doc.text(h, cx + cols[i] / 2, y + headH / 2 + 2, { align: 'center' });
                cx += cols[i];
            });
            doc.setDrawColor(200, 210, 220);
            borde(doc, m, y, W, headH);
            y += headH;

            const cuerpo = filas.length ? filas : [{ clamshell: '—', jarra: '—', pesoDespacho: '', horaDespacho: '', tempAmb: '', tempPulpa: '', observacion: '' }];
            cuerpo.forEach((fila, ri) => {
                if (y + rowH > PAGE_AVANCE.h - m) {
                    doc.addPage('a4', 'portrait');
                    y = m;
                }
                cx = m;
                const vals = [
                    `#${txt(fila.clamshell) || ri + 1}`,
                    txt(fila.jarra),
                    txt(fila.pesoDespacho) ? `${txt(fila.pesoDespacho)} g` : '—',
                    txt(fila.horaDespacho),
                    txt(fila.tempAmb) ? `${txt(fila.tempAmb)}°C` : '—',
                    txt(fila.tempPulpa) ? `${txt(fila.tempPulpa)}°C` : '—',
                    txt(fila.observacion)
                ];
                vals.forEach((v, i) => {
                    const fill = ri % 2 === 0;
                    if (fill) {
                        doc.setFillColor(248, 250, 252);
                        doc.rect(cx, y, cols[i], rowH, 'F');
                    }
                    borde(doc, cx, y, cols[i], rowH);
                    doc.setTextColor(30, 41, 59);
                    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
                    doc.setFontSize(7);
                    dibujarCelda(doc, cx, y, cols[i], rowH, v, { fontSize: 7, align: i >= 2 ? 'center' : 'center', pad: 1 });
                    cx += cols[i];
                });
                y += rowH;
            });
            y += 6;
        });

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Documento informativo para Packing. El registro completo de Campo se envía al finalizar la muestra.', m, PAGE_AVANCE.h - m);
    }

    async function generarPdfAvancePackingBlob(datos) {
        const JsPDF = obtenerJsPDF();
        if (!JsPDF) throw new Error('jsPDF no está cargado');
        const logoUrl = await cargarLogoDataUrl();
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        generarHojaAvancePacking(doc, datos, logoUrl);
        return doc.output('blob');
    }

    async function compartirPdfPorWhatsApp(blob, nombre, mensajeTexto) {
        if (!blob) return;
        const file = new File([blob], nombre || 'avance-packing.pdf', { type: 'application/pdf' });
        const titulo = (nombre || 'avance-packing.pdf').replace('.pdf', '');
        const texto = txt(mensajeTexto);
        if (navigator.share) {
            try {
                const payload = texto
                    ? { title: titulo, text: texto, files: [file] }
                    : { title: titulo, files: [file] };
                if (!navigator.canShare || navigator.canShare(payload)) {
                    await navigator.share(payload);
                    return true;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return false;
            }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre || 'avance-packing.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        const msg = encodeURIComponent(texto || `${titulo}\n(Adjunta el PDF descargado)`);
        window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
        return true;
    }

    async function generarYEnviarPdfAvancePacking(datos) {
        if (!obtenerJsPDF()) {
            throw new Error('Biblioteca PDF no cargada. Conéctate una vez a internet para precargar.');
        }
        const blob = await generarPdfAvancePackingBlob(datos);
        const nombre = nombreArchivoPdfAvance(datos);
        const mensaje = textoResumenWhatsAppAvance(datos);
        pdfMensajeWhatsAppActual = mensaje;
        const modalPromise = abrirModalPdf(blob, nombre, datos);
        const wspPromise = compartirPdfPorWhatsApp(blob, nombre, mensaje);
        await Promise.all([modalPromise, wspPromise]);
        return true;
    }

    function precalentarPdfAvancePacking() {
        void cargarLogoDataUrl();
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

        let pinchInicio = 0;
        let escalaInicio = 1;
        let ultimoTap = 0;

        stage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                pinchInicio = distanciaToques(e.touches[0], e.touches[1]);
                escalaInicio = pdfZoomState.scale;
            }
        }, { passive: true });

        stage.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 2 || !pinchInicio) return;
            const ratio = distanciaToques(e.touches[0], e.touches[1]) / pinchInicio;
            pdfZoomState.scale = escalaPdfZoomClamped(escalaInicio * ratio);
            aplicarPdfZoomPreview();
        }, { passive: true });

        stage.addEventListener('touchend', (e) => {
            const habiaPinch = !!pinchInicio;
            if (e.touches.length < 2) pinchInicio = 0;
            if (habiaPinch) {
                void comprometerPdfZoom();
                return;
            }
            const ahora = Date.now();
            if (e.changedTouches.length === 1 && ahora - ultimoTap < 320) {
                pdfZoomState.scale = pdfZoomState.scale < 1.45 ? 2 : 1;
                void comprometerPdfZoom();
                ultimoTap = 0;
            } else {
                ultimoTap = ahora;
            }
        }, { passive: true });
    }

    function limpiarVistaPreviaPdf() {
        const pages = document.getElementById('pdf-preview-pages');
        if (pdfPreviewSession?.zoomTimer) {
            clearTimeout(pdfPreviewSession.zoomTimer);
        }
        pdfPreviewSession = null;
        if (pages) pages.innerHTML = '';
        ocultarVisorPdfNativo();
        pdfZoomState.scale = 1;
        actualizarEtiquetaPdfZoom(1);
        const scaler = document.getElementById('pdf-preview-scaler');
        if (scaler) scaler.style.transform = '';
        estadoVistaPreviaPdf('loading');
    }

    async function renderizarVistaPreviaPdfCanvas(blob) {
        const stage = document.getElementById('pdf-preview-stage');
        const pagesEl = document.getElementById('pdf-preview-pages');
        if (!stage || !pagesEl) return false;

        ocultarVisorPdfNativo();
        const lib = obtenerPdfJs();
        if (!lib) return false;

        const data = await blob.arrayBuffer();
        let pdf;
        try {
            pdf = await cargarPdfParaVista(lib, data, false);
        } catch (errWorker) {
            console.warn('[PDF preview] reintento sin worker', errWorker);
            pdf = await cargarPdfParaVista(lib, data, true);
        }

        const ancho = Math.max(260, (stage.clientWidth || window.innerWidth || 320) - 24);
        pagesEl.innerHTML = '';
        pdfPreviewSession = {
            pdf,
            ancho,
            pages: [],
            renderGen: 0,
            lastRenderedZoom: 1,
            zoomTimer: null
        };

        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            await page.getTextContent();
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-preview-page';
            const ctx = canvas.getContext('2d', { alpha: false });

            const wrap = document.createElement('div');
            wrap.className = 'pdf-preview-page-wrap';
            if (pdf.numPages > 1) {
                const lbl = document.createElement('span');
                lbl.className = 'pdf-preview-page-label';
                lbl.textContent = `Hoja ${p} / ${pdf.numPages}`;
                wrap.appendChild(lbl);
            }
            wrap.appendChild(canvas);
            pagesEl.appendChild(wrap);
            pdfPreviewSession.pages.push({ pageNum: p, canvas, ctx, wrap });
        }

        estadoVistaPreviaPdf('ready');
        pdfZoomState.scale = 1;
        await renderizarPdfPreviewZoom(1);
        return true;
    }

    async function renderizarVistaPreviaPdf(blob) {
        const stage = document.getElementById('pdf-preview-stage');
        if (!stage) return false;

        limpiarVistaPreviaPdf();
        await esperarLayoutModal();

        if (prefiereVisorPdfNativo() && pdfUrlActual && mostrarVisorPdfNativo(pdfUrlActual)) {
            return true;
        }

        try {
            const ok = await renderizarVistaPreviaPdfCanvas(blob);
            if (!ok) estadoVistaPreviaPdf('error');
            return ok;
        } catch (err) {
            console.warn('[PDF preview]', err);
            if (pdfUrlActual && prefiereVisorPdfNativo() && mostrarVisorPdfNativo(pdfUrlActual)) {
                return true;
            }
            estadoVistaPreviaPdf('error');
            return false;
        }
    }

    function cerrarModalPdf() {
        const ov = document.getElementById('pdf-modal-overlay');
        if (ov) ov.style.display = 'none';
        limpiarVistaPreviaPdf();
        revocarPdfUrlActual();
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

    async function abrirModalPdf(blob, nombre, datosPdf) {
        pdfBlobActual = blob;
        pdfNombreActual = nombre || 'medicion-arandano.pdf';
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

    async function compartirWhatsAppPdf() {
        if (!pdfBlobActual) return;
        const titulo = pdfNombreActual.replace('.pdf', '');
        const msg = pdfMensajeWhatsAppActual || `${titulo}\n(Adjunta el PDF descargado)`;
        await compartirPdfPorWhatsApp(pdfBlobActual, pdfNombreActual, msg);
    }

    async function generarYMostrarPdfCampo() {
        if (typeof window.obtenerDatosPdfCampo !== 'function') {
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
            pdfMensajeWhatsAppActual = '';
            const datos = window.obtenerDatosPdfCampo();
            const blob = await generarPdfCampoBlob(datos);
            abrirModalPdf(blob, nombreArchivoPdf(datos), datos);
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

    function initPdfVisorModalCampo_() {
        if (pdfVisorModalInited) return;
        pdfVisorModalInited = true;
        enlazarZoomVistaPreviaPdf();
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

    function initCampoPdf() {
        precalentarPdfAvancePacking();
        initPdfVisorModalCampo_();
        document.getElementById('fab-pdf-btn')?.addEventListener('click', () => {
            void generarYMostrarPdfCampo();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCampoPdf);
    } else {
        initCampoPdf();
    }

    window.generarYMostrarPdfCampo = generarYMostrarPdfCampo;
    window.generarYEnviarPdfAvancePacking = generarYEnviarPdfAvancePacking;
    window.generarPdfAvancePackingBlob = generarPdfAvancePackingBlob;
    window.precalentarPdfAvancePacking = precalentarPdfAvancePacking;
    window.generarPdfCampoBlob = generarPdfCampoBlob;
    window.nombreArchivoPdfCampo = nombreArchivoPdf;
    window.abrirModalPdfCampo = abrirModalPdf;
    window.cerrarModalPdfCampo = cerrarModalPdf;
    window.initPdfVisorModalCampo = initPdfVisorModalCampo_;
})();
