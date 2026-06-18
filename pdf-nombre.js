/**
 * Nombre PDF: "C6 - Ensayo 1 - E4C8T1 - Sekoya Pop - Campo.pdf"
 * Varios (WhatsApp): líneas con guion inicial.
 */
(function pdfNombreModule() {
    function txt(v) {
        return String(v ?? '').trim();
    }

    function sanitizarSegmentoNombrePdf_(s) {
        return txt(s)
            .replace(/[\\/:*?"<>|]+/g, '-')
            .replace(/\s+/g, ' ')
            .replace(/^-+|-+$/g, '');
    }

    function fundoNombrePdf_(meta, fila0) {
        return sanitizarSegmentoNombrePdf_(
            meta?.fundo
            || meta?.['visual-meta-fundo']
            || meta?.['meta-fundo']
            || fila0?.fundo
            || ''
        );
    }

    function variedadNombrePdf_(meta, fila0) {
        return sanitizarSegmentoNombrePdf_(
            meta?.variedad
            || meta?.['visual-meta-variedad']
            || meta?.['meta-variedad']
            || fila0?.variedad
            || ''
        );
    }

    function trazabilidadNombrePdf_(meta, fila0) {
        const trazRaw = txt(meta?.trazabilidadArchivo || meta?.trazabilidad).split(' / ')[0];
        if (trazRaw) {
            return sanitizarSegmentoNombrePdf_(trazRaw.replace(/-/g, ''));
        }
        const etapa = txt(fila0?.etapa || meta?.etapa);
        const campo = txt(fila0?.campo || meta?.campo);
        const turno = txt(fila0?.turno || meta?.turno);
        if (etapa || campo || turno) {
            return sanitizarSegmentoNombrePdf_([etapa, campo, turno].filter(Boolean).join(''));
        }
        const num = txt(meta?.numMuestra);
        if (num) return sanitizarSegmentoNombrePdf_(num);
        return '';
    }

    function extraerNumeroEnsayoDesdeTexto_(texto) {
        const s = txt(texto);
        if (!s) return 0;
        const soloNum = Number(s);
        if (Number.isFinite(soloNum) && soloNum > 0 && String(soloNum) === s) return soloNum;
        const m = s.match(/\d+/);
        return m ? Number(m[0]) : 0;
    }

    function rotuloMuestraNombrePdf_(meta, fila0, ensayo, muestraLabel) {
        return sanitizarSegmentoNombrePdf_(
            meta?.rotulo || fila0?.rotulo || muestraLabel || ensayo || 'Muestra'
        );
    }

    function rotuloSoloMuestraPdf_(item) {
        const ensayoNum = numeroEnsayoDesdeItemPdf_(item);
        if (ensayoNum > 0) return 'Ensayo ' + ensayoNum;
        const meta = item?.meta || {};
        const f0 = (Array.isArray(item?.filas) && item.filas[0]) ? item.filas[0] : {};
        return rotuloMuestraNombrePdf_(meta, f0, item?.ensayo, item?.muestraLabel);
    }

    function numeroEnsayoDesdeItemPdf_(item) {
        const fromEnsayo = extraerNumeroEnsayoDesdeTexto_(item?.ensayo);
        if (fromEnsayo > 0) return fromEnsayo;
        const fromNumero = extraerNumeroEnsayoDesdeTexto_(item?.ensayo_numero);
        if (fromNumero > 0) return fromNumero;
        const meta = item?.meta || {};
        const f0 = (Array.isArray(item?.filas) && item.filas[0]) ? item.filas[0] : {};
        const rotulo = rotuloMuestraNombrePdf_(meta, f0, item?.ensayo, item?.muestraLabel);
        return extraerNumeroEnsayoDesdeTexto_(rotulo);
    }

    function sufijoModoNombrePdf_(item, opts) {
        const fromOpts = txt(opts?.modo);
        if (fromOpts) return fromOpts;
        const mr = txt(item?.modoRegistro).toLowerCase();
        if (mr === 'acopio') return 'Acopio';
        if (mr === 'packing') return 'Packing';
        return 'Campo';
    }

    function lineaNombrePdfMuestra_(item, opts) {
        const meta = item?.meta || {};
        const f0 = (Array.isArray(item?.filas) && item.filas[0]) ? item.filas[0] : {};
        const partes = [
            fundoNombrePdf_(meta, f0),
            rotuloSoloMuestraPdf_(item),
            trazabilidadNombrePdf_(meta, f0),
            variedadNombrePdf_(meta, f0),
            sufijoModoNombrePdf_(item, opts)
        ].filter(Boolean);
        return partes.join(' - ');
    }

    function ensayosUnicosOrdenadosParaTituloPdf_(items) {
        const map = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const rotulo = rotuloSoloMuestraPdf_(item);
            if (!rotulo) return;
            const num = numeroEnsayoDesdeItemPdf_(item);
            const key = num > 0 ? 'n:' + num : 'r:' + rotulo;
            if (!map.has(key)) map.set(key, { num, rotulo });
        });
        return [...map.values()]
            .sort((a, b) => (a.num || 0) - (b.num || 0) || a.rotulo.localeCompare(b.rotulo))
            .map((x) => x.rotulo);
    }

    function tituloModalSoloEnsayos_(items) {
        const lista = ensayosUnicosOrdenadosParaTituloPdf_(items);
        if (!lista.length) return 'Resumen: muestra';
        if (lista.length === 1) return lista[0];
        return 'Resumen: ' + lista.join(' - ');
    }

    function muestrasUnicasOrdenadasPdf_(lista) {
        const ordenados = (Array.isArray(lista) ? lista : []).slice().sort((a, b) => {
            return numeroEnsayoDesdeItemPdf_(a) - numeroEnsayoDesdeItemPdf_(b);
        });
        const vistos = new Set();
        const unicos = [];
        ordenados.forEach((item) => {
            const num = numeroEnsayoDesdeItemPdf_(item);
            const key = num > 0 ? 'n:' + num : 'r:' + rotuloSoloMuestraPdf_(item);
            if (vistos.has(key)) return;
            vistos.add(key);
            unicos.push(item);
        });
        return unicos;
    }

    function nombreArchivoPdfDesdeItem_(item, opts) {
        const linea = lineaNombrePdfMuestra_(item, opts);
        return `${linea || 'muestra'}.pdf`;
    }

    function nombreArchivoPdfDesdeListaMuestras_(lista, opts) {
        const unicos = muestrasUnicasOrdenadasPdf_(lista);
        if (!unicos.length) return 'muestra.pdf';
        if (unicos.length === 1) return nombreArchivoPdfDesdeItem_(unicos[0], opts);
        const lineas = unicos.map((item) => lineaNombrePdfMuestra_(item, opts)).filter(Boolean);
        return `${lineas.join(' · ') || 'muestra'}.pdf`;
    }

    function textoNombresPdfParaCompartir_(lista, opts) {
        const unicos = muestrasUnicasOrdenadasPdf_(lista);
        if (!unicos.length) return 'muestra';
        if (unicos.length === 1) {
            return lineaNombrePdfMuestra_(unicos[0], opts) || 'muestra';
        }
        return unicos
            .map((item) => {
                const linea = lineaNombrePdfMuestra_(item, opts);
                return linea ? '-' + linea : '';
            })
            .filter(Boolean)
            .join('\n');
    }

    function tituloModalPdfDesdeListaMuestras_(lista) {
        const items = (Array.isArray(lista) ? lista : []).filter(Boolean);
        const unicos = ensayosUnicosOrdenadosParaTituloPdf_(items);
        const text = tituloModalSoloEnsayos_(items);
        return { text, resumen: unicos.length > 1 };
    }

    function tituloModalPdfDesdeNombreArchivo_(nombre) {
        const nom = String(nombre || 'muestra.pdf').replace(/\.pdf$/i, '').trim();
        if (!nom) return { text: 'Resumen: muestra', resumen: false };
        if (nom.includes(' · ')) {
            const rotulos = nom.split(' · ')
                .map((l) => {
                    const partes = txt(l).split(' - ');
                    return partes.length > 1 ? partes[1] : partes[0];
                })
                .filter(Boolean);
            if (rotulos.length > 1) {
                return { text: 'Resumen: ' + rotulos.join(' - '), resumen: true };
            }
        }
        const partes = nom.split(' - ');
        if (partes.length > 1 && /^Ensayo\s+\d+$/i.test(partes[1])) {
            return { text: partes[1], resumen: false };
        }
        return { text: nom, resumen: nom.startsWith('Resumen:') };
    }

    function actualizarTituloModalPdf_(nombre, datosPdf) {
        const titleEl = document.getElementById('pdf-modal-title');
        if (!titleEl) return;
        let info;
        const muestrasTitulo = datosPdf?.muestrasTitulo;
        const muestras = (Array.isArray(muestrasTitulo) && muestrasTitulo.length)
            ? muestrasTitulo
            : datosPdf?.muestras;
        if (Array.isArray(muestras) && muestras.length) {
            info = tituloModalPdfDesdeListaMuestras_(muestras);
        } else {
            info = tituloModalPdfDesdeNombreArchivo_(nombre);
        }
        titleEl.textContent = info.text;
        titleEl.title = info.text;
        titleEl.classList.remove('pdf-modal-title--multiline', 'pdf-modal-title--card');
        titleEl.classList.toggle('pdf-modal-title--resumen', !!info.resumen);
    }

    window.nombreArchivoPdfDesdeListaMuestras = nombreArchivoPdfDesdeListaMuestras_;
    window.textoNombresPdfParaCompartir = textoNombresPdfParaCompartir_;
    window.actualizarTituloModalPdf = actualizarTituloModalPdf_;
})();
