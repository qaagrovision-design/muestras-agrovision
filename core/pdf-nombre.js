/**
 * Nombre PDF Campo:
 * "120726 - Ensayo (1 y 2) - E02C03T1 - Sekoya Pop Orgánica - LN - Campo Visual.pdf"
 * Acopio: "… - Campo Acopio.pdf" | Un ensayo: "… - Ensayo 1 - …"
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

    function fechaCompactaNombrePdf_(val) {
        const s = txt(val);
        if (!s) return '';
        if (/^\d{6}$/.test(s)) return s;
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
            return iso[3] + iso[2] + iso[1].slice(-2);
        }
        const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
        if (dmy) {
            const dd = String(dmy[1]).padStart(2, '0');
            const mm = String(dmy[2]).padStart(2, '0');
            const yy = String(dmy[3]).length === 4 ? String(dmy[3]).slice(-2) : String(dmy[3]).padStart(2, '0');
            return dd + mm + yy;
        }
        const solo = s.replace(/[^\d]/g, '');
        if (solo.length === 6) return solo;
        if (solo.length === 8) return solo.slice(0, 2) + solo.slice(2, 4) + solo.slice(6, 8);
        return sanitizarSegmentoNombrePdf_(s);
    }

    function fechaNombrePdf_(item, opts) {
        const meta = item?.meta || {};
        const raw = txt(opts?.fecha) || txt(meta?.fecha) || txt(item?.fecha) || '';
        const compact = fechaCompactaNombrePdf_(raw);
        if (compact) return compact;
        const d = new Date();
        return String(d.getDate()).padStart(2, '0')
            + String(d.getMonth() + 1).padStart(2, '0')
            + String(d.getFullYear()).slice(-2);
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

    function formatearListaNumerosEspanol_(nums) {
        const lista = (Array.isArray(nums) ? nums : []).filter((n) => n > 0);
        if (!lista.length) return '';
        if (lista.length === 1) return String(lista[0]);
        if (lista.length === 2) return lista[0] + ' y ' + lista[1];
        return lista.slice(0, -1).join(', ') + ' y ' + lista[lista.length - 1];
    }

    function rotuloEnsayosAgrupadosPdf_(items) {
        const nums = [];
        const vistos = new Set();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const n = numeroEnsayoDesdeItemPdf_(item);
            if (n > 0 && !vistos.has(n)) {
                vistos.add(n);
                nums.push(n);
            }
        });
        nums.sort((a, b) => a - b);
        if (!nums.length) return 'Ensayo';
        if (nums.length === 1) return 'Ensayo ' + nums[0];
        return 'Ensayo (' + formatearListaNumerosEspanol_(nums) + ')';
    }

    function sufijoModoNombrePdf_(item, opts) {
        const fromOpts = txt(opts?.modo);
        if (fromOpts) {
            const low = fromOpts.toLowerCase();
            if (low === 'acopio' || low === 'campo acopio') return 'Campo Acopio';
            if (low === 'visual' || low === 'campo' || low === 'campo visual') return 'Campo Visual';
            if (low === 'packing' || low === 'packing-rc5') return 'Packing';
            if (low === 'mptk' || low === 'mp-tk') return 'MP-TK';
            if (low === 'tk20' || low === 'tk-2.0' || low === 'tk-2') return 'TK-2.0';
            return fromOpts;
        }
        const mr = txt(item?.modoRegistro || item?.modo_registro).toLowerCase();
        if (mr === 'acopio') return 'Campo Acopio';
        if (mr === 'visual' || mr === 'campo') return 'Campo Visual';
        if (mr === 'packing' || mr === 'packing-rc5') return 'Packing';
        if (mr === 'mptk' || mr === 'mp-tk') return 'MP-TK';
        if (mr === 'tk20' || mr === 'tk-2.0' || mr === 'tk-2') return 'TK-2.0';
        return 'Campo Visual';
    }

    function partesNombrePdfMuestra_(item, opts, ensayoOverride) {
        const meta = item?.meta || {};
        const f0 = (Array.isArray(item?.filas) && item.filas[0]) ? item.filas[0] : {};
        const ensayo = ensayoOverride || rotuloSoloMuestraPdf_(item);
        return [
            fechaNombrePdf_(item, opts),
            ensayo,
            trazabilidadNombrePdf_(meta, f0),
            variedadNombrePdf_(meta, f0),
            fundoNombrePdf_(meta, f0),
            sufijoModoNombrePdf_(item, opts)
        ].filter(Boolean);
    }

    function lineaNombrePdfMuestra_(item, opts) {
        return partesNombrePdfMuestra_(item, opts).join(' - ');
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
        const ensayo = unicos.length === 1
            ? rotuloSoloMuestraPdf_(unicos[0])
            : rotuloEnsayosAgrupadosPdf_(unicos);
        const partes = partesNombrePdfMuestra_(unicos[0], opts, ensayo);
        return `${partes.join(' - ') || 'muestra'}.pdf`;
    }

    function textoNombresPdfParaCompartir_(lista, opts) {
        const unicos = muestrasUnicasOrdenadasPdf_(lista);
        if (!unicos.length) return 'muestra';
        if (unicos.length === 1) {
            return lineaNombrePdfMuestra_(unicos[0], opts) || 'muestra';
        }
        return '-' + (partesNombrePdfMuestra_(unicos[0], opts, rotuloEnsayosAgrupadosPdf_(unicos)).join(' - ') || 'muestra');
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
        const partes = nom.split(' - ').map((p) => txt(p)).filter(Boolean);
        const ensayoParte = partes.find((p) => /^Ensayo\b/i.test(p));
        if (ensayoParte) {
            return { text: ensayoParte, resumen: /Ensayo\s*\(/i.test(ensayoParte) };
        }
        if (partes.length > 1) {
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
