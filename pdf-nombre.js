/**
 * Nombre de archivo PDF: "Ensayo 4 - E4C9 - 16-06-2026.pdf"
 * Modal: solo nombres de ensayo (sin trazabilidad).
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

    function normalizarFechaNombrePdf_(raw) {
        const s = txt(raw);
        if (!s) return '';
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
        return s.replace(/\//g, '-').replace(/\./g, '-');
    }

    function codigoMuestraNombrePdf_(meta, fila0, ensayo) {
        const trazRaw = txt(meta?.trazabilidadArchivo || meta?.trazabilidad).split(' / ')[0];
        if (trazRaw) {
            return sanitizarSegmentoNombrePdf_(trazRaw.replace(/-/g, ''));
        }
        const etapa = txt(fila0?.etapa);
        const campo = txt(fila0?.campo);
        const turno = txt(fila0?.turno);
        if (etapa || campo || turno) {
            return sanitizarSegmentoNombrePdf_([etapa, campo, turno].filter(Boolean).join(''));
        }
        const num = txt(meta?.numMuestra);
        if (num) return sanitizarSegmentoNombrePdf_(num);
        return sanitizarSegmentoNombrePdf_(ensayo || 'muestra');
    }

    function rotuloMuestraNombrePdf_(meta, fila0, ensayo, muestraLabel) {
        return sanitizarSegmentoNombrePdf_(
            meta?.rotulo || fila0?.rotulo || muestraLabel || ensayo || 'Muestra'
        );
    }

    function extraerNumeroEnsayoDesdeTexto_(texto) {
        const s = txt(texto);
        if (!s) return 0;
        const soloNum = Number(s);
        if (Number.isFinite(soloNum) && soloNum > 0 && String(soloNum) === s) return soloNum;
        const m = s.match(/\d+/);
        return m ? Number(m[0]) : 0;
    }

    function rotuloSoloMuestraPdf_(item) {
        const ensayoNum = numeroEnsayoDesdeItemPdf_(item);
        if (ensayoNum > 0) return 'Ensayo ' + ensayoNum;
        const meta = item?.meta || {};
        const f0 = (Array.isArray(item?.filas) && item.filas[0]) ? item.filas[0] : {};
        return rotuloMuestraNombrePdf_(meta, f0, item?.ensayo, item?.muestraLabel);
    }

    function lineaResumenMuestraPdf_(item) {
        return `${rotuloSoloMuestraPdf_(item)} - ${codigoMuestraNombrePdf_(
            item?.meta || {},
            (Array.isArray(item?.filas) && item.filas[0]) ? item.filas[0] : {},
            item?.ensayo
        )}`;
    }

    function partesLineaResumen_(linea) {
        const s = txt(linea);
        const idx = s.lastIndexOf(' - ');
        if (idx < 0) return { rotulo: s, codigo: '' };
        return { rotulo: s.slice(0, idx), codigo: s.slice(idx + 3) };
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

    function nombreArchivoPdfDesdeItem_(item) {
        const linea = lineaResumenMuestraPdf_(item);
        const fecha = normalizarFechaNombrePdf_(item?.meta?.fecha || item?.fecha);
        return `${linea} - ${fecha || 'sin-fecha'}.pdf`;
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

    function nombreArchivoPdfDesdeListaMuestras_(lista) {
        const unicos = muestrasUnicasOrdenadasPdf_(lista);
        if (!unicos.length) return 'muestra.pdf';
        if (unicos.length === 1) return nombreArchivoPdfDesdeItem_(unicos[0]);

        const fecha = normalizarFechaNombrePdf_(
            unicos[0]?.meta?.fecha || unicos[0]?.fecha
        );
        const lineas = unicos.map((item) => lineaResumenMuestraPdf_(item));
        return `${lineas.join(' · ')} - ${fecha || 'sin-fecha'}.pdf`;
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

        const fechaMatch = nom.match(/ - (\d{2}-\d{2}-\d{4})$/);
        if (fechaMatch && nom.includes(' · ')) {
            const cuerpo = nom.slice(0, nom.length - fechaMatch[0].length);
            const rotulos = cuerpo.split(' · ')
                .map((l) => partesLineaResumen_(txt(l)).rotulo)
                .filter(Boolean);
            if (rotulos.length > 1) {
                return { text: 'Resumen: ' + rotulos.join(' - '), resumen: true };
            }
        }

        if (fechaMatch) {
            const sinFecha = nom.slice(0, nom.length - fechaMatch[0].length);
            const rotulo = partesLineaResumen_(sinFecha).rotulo || sinFecha;
            return { text: rotulo, resumen: false };
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
    window.actualizarTituloModalPdf = actualizarTituloModalPdf_;
})();
