/* Catálogo JSON compartido (variedades y futuras opciones) */
(function catalogoJsonModule() {
    const CATALOGO_STORAGE_KEY = 'tiempos-catalogo-app-json-v1';
    const CATALOGO_EVENT = 'tiempos-catalogo-actualizado';

    const CATALOGO_APP_DEFAULT = {
        variedades: {
            'FALL CREEK': {
                '01': 'Ventura', '02': 'Emerald', '03': 'Biloxi', '05': 'Snowchaser',
                '12': 'Jupiter Blue', '13': 'Bianca Blue', '14': 'Atlas Blue',
                '15': 'Biloxi Orgánico', '16': 'Sekoya Beauty', '18': 'Sekoya Pop',
                '27': 'Atlas Blue Orgánico', '36': 'FCM17-132', '37': 'FCM15-005',
                '38': 'FCM15-003', '40': 'FCM14-057', '41': 'Azra',
                '49': 'Sekoya Pop Orgánica', '58': 'Ventura Orgánico',
                'C0': 'FCE15-087', 'C1': 'FCE18-012', 'C2': 'FCE18-015'
            },
            "DRISCOLL'S": {
                '17': 'Kirra', '19': 'Arana', '20': 'Stella Blue', '21': 'Terrapin',
                '26': 'Rosita', '28': 'Arana Orgánico', '29': 'Stella Blue Orgánico',
                '30': 'Kirra Orgánico', '31': 'Regina', '34': 'Raymi Orgánico',
                '45': 'Raymi', '50': 'Rosita Orgánica'
            },
            'OZBLU': {
                '06': 'Mágica', '07': 'Bella', '08': 'Bonita', '09': 'Julieta',
                '10': 'Zila', '11': 'Magnifica'
            },
            'PLANASA': {
                '22': 'PLA Blue-Malibu', '23': 'PLA Blue-Madeira',
                '24': 'PLA Blue-Masirah', '35': 'Manila'
            },
            'IQ BERRIES': {
                '51': 'Megaone', '53': 'Megacrisp', '54': 'Megaearly',
                '55': 'Megagem', '56': 'Megagrand', '57': 'Megastar'
            },
            'UNIV. FLORIDA': {
                '04': 'Springhigh', '33': 'Magnus', '39': 'Colosus', '42': 'Raven',
                '43': 'Avanti', '46': 'Patrecia', '47': 'Wayne', '48': 'Bobolink',
                '52': 'Keecrisp', '67': 'Albus (FL 11-051)', '68': 'Falco (FL 17-141)',
                '69': 'FL-11-158', '70': 'FL-10-179', 'B9': 'FL 19-006',
                'C3': 'FL09-279', 'C4': 'FL12-236'
            },
            'OTROS / EXPERIMENTALES': {
                '25': 'Mixto', '32': 'I+D', '44': 'Merliah',
                '62': 'FCM15-000', '63': 'FCM15-010', '64': 'FCM-17010', '65': 'Valentina'
            }
        },
        fundos: [
            { value: 'C5', label: 'C5' },
            { value: 'C6', label: 'C6' },
            { value: 'A9', label: 'A9' },
            { value: 'LN', label: 'LN' }
        ]
    };

    if (window.MAPEO_PARCELAS_DEFAULT) {
        CATALOGO_APP_DEFAULT.mapeoParcelas = JSON.parse(JSON.stringify(window.MAPEO_PARCELAS_DEFAULT));
    }

    const VARIEDAD_ALIASES = {
        'SEKOYA POP': 'Sekoya Pop',
        'SEKOYA BEAUTY': 'Sekoya Beauty',
        'SEKOYA POP ORGANICA': 'Sekoya Pop Orgánica',
        'SEKOYA POP ORGÁNICA': 'Sekoya Pop Orgánica',
        'BIANCA': 'Bianca Blue',
        'JUPITER': 'Jupiter Blue',
        'JÚPITER': 'Jupiter Blue',
        'ATLAS': 'Atlas Blue',
        'ATLAS ORGANICA': 'Atlas Blue Orgánico',
        'ATLAS ORGÁNICA': 'Atlas Blue Orgánico',
        'VENTURA': 'Ventura',
        'EMERALD': 'Emerald',
        'MAGICA': 'Mágica',
        'MÁGICA': 'Mágica',
        'BELLA': 'Bella',
        'ARANA': 'Arana',
        'KIRRA': 'Kirra',
        'ROSITA': 'Rosita',
        'RAYMI': 'Raymi',
        'TERRAPIN': 'Terrapin',
        'COLOSSUS': 'Colosus',
        'COLOSUS': 'Colosus',
        'MEGAONE': 'Megaone',
        'MEGACRISP': 'Megacrisp',
        'MEGAEARLY': 'Megaearly',
        'MEGAGEM': 'Megagem',
        'MEGAGRAND': 'Megagrand',
        'MEGASTAR': 'Megastar',
        'REGINA': 'Regina',
        'MAGNUS': 'Magnus',
        'ALBUS(FL 11-051)': 'Albus (FL 11-051)',
        'ALBUS (FL 11-051)': 'Albus (FL 11-051)',
        'FALCO(FL17-141)': 'Falco (FL 17-141)',
        'FLD9-279': 'FL09-279'
    };

    function clonarCatalogo(obj) {
        return JSON.parse(JSON.stringify(obj || CATALOGO_APP_DEFAULT));
    }

    function normalizarListaFundos(lista) {
        if (!Array.isArray(lista)) return clonarCatalogo(CATALOGO_APP_DEFAULT).fundos;
        const out = [];
        lista.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const value = String(item.value != null ? item.value : '').trim();
            if (!value) return;
            const label = String(item.label != null ? item.label : value).trim() || value;
            if (out.some((o) => o.value === value)) return;
            out.push({ value, label });
        });
        return out.length ? out : clonarCatalogo(CATALOGO_APP_DEFAULT).fundos;
    }

    function normalizarCatalogoApp(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const out = clonarCatalogo(CATALOGO_APP_DEFAULT);
        if (raw.variedades && typeof raw.variedades === 'object') {
            out.variedades = raw.variedades;
        }
        if (raw.fundos !== undefined) {
            out.fundos = normalizarListaFundos(raw.fundos);
        }
        if (raw.mapeoParcelas && typeof raw.mapeoParcelas === 'object') {
            out.mapeoParcelas = raw.mapeoParcelas;
        } else if (window.MAPEO_PARCELAS_DEFAULT) {
            out.mapeoParcelas = JSON.parse(JSON.stringify(window.MAPEO_PARCELAS_DEFAULT));
        }
        if (out.mapeoParcelas?.C4) {
            const c6 = out.mapeoParcelas.C6 && typeof out.mapeoParcelas.C6 === 'object'
                ? out.mapeoParcelas.C6
                : {};
            out.mapeoParcelas.C6 = { ...c6, ...out.mapeoParcelas.C4 };
            delete out.mapeoParcelas.C4;
        }
        if (Array.isArray(out.fundos)) {
            out.fundos = out.fundos.filter((f) => String(f?.value || '') !== 'C4');
        }
        out.mapeoParcelas = fusionarMapeoParcelasConDefecto(out.mapeoParcelas);
        return out;
    }

    function leerAreaEntradaVariedad(item) {
        if (!item || typeof item !== 'object') return null;
        const raw = item.area ?? item.AREA ?? item.Area ?? item.hectareas ?? item.Hectareas ?? null;
        if (raw == null || raw === '') return null;
        const n = Number(String(raw).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }

    function parsearEntradasVariedadesCampo(entrada) {
        if (!entrada) return [];
        if (!Array.isArray(entrada)) {
            const n = String(entrada?.nombre || entrada?.variedad || entrada || '').trim();
            const area = leerAreaEntradaVariedad(entrada);
            return n ? [{ nombre: n, area }] : [];
        }
        return entrada.map((item) => {
            if (typeof item === 'string') {
                return { nombre: item.trim(), area: null };
            }
            if (item && typeof item === 'object') {
                const nombre = String(item.nombre || item.variedad || item.name || '').trim();
                return { nombre, area: leerAreaEntradaVariedad(item) };
            }
            return { nombre: '', area: null };
        }).filter((e) => e.nombre);
    }

    function extraerNombresVariedadesCampo(entrada) {
        return parsearEntradasVariedadesCampo(entrada).map((e) => e.nombre);
    }

    function obtenerContextoParcelaActual() {
        return {
            fundo: String(document.getElementById('visual-meta-fundo')?.value || '').trim(),
            etapa: String(document.getElementById('visual-traz-etapa')?.value || '').trim(),
            campo: String(document.getElementById('visual-traz-campo')?.value || '').trim()
        };
    }

    function obtenerAreaVariedadEnParcela(fundo, etapa, campo, nombreVariedad, catalogo) {
        const cat = catalogo || obtenerCatalogoApp();
        const canon = resolverNombreVariedadCanonico(nombreVariedad, cat);
        if (!canon || !fundo || !etapa || !campo) return null;
        const m = obtenerMapeoParcelas(cat)[String(fundo).trim()];
        if (!m) return null;
        const ek = resolverClaveEnMapa(m, etapa, 'etapa');
        if (!ek || !m[ek]) return null;
        const ck = resolverClaveEnMapa(m[ek], campo, 'campo');
        if (!ck || !m[ek][ck]) return null;
        const entradas = parsearEntradasVariedadesCampo(m[ek][ck]);
        const hit = entradas.find((e) => resolverNombreVariedadCanonico(e.nombre, cat) === canon);
        return hit && hit.area != null ? hit.area : null;
    }

    function etiquetaVariedadEnSelect(opcion, catalogo, ctxParcela) {
        const codigo = String(opcion?.codigo || '').trim();
        const nombre = String(opcion?.nombre || '').trim();
        let label = codigo ? `${codigo} · ${nombre}` : nombre;
        if (ctxParcela && ctxParcela.fundo && ctxParcela.etapa && ctxParcela.campo) {
            const areaVal = obtenerAreaVariedadEnParcela(
                ctxParcela.fundo, ctxParcela.etapa, ctxParcela.campo, nombre, catalogo
            );
            if (areaVal != null) label += ` - Hectareas : ${areaVal}`;
        }
        return label;
    }

    function fusionarListaVariedadesCampo(actual, defecto) {
        const act = extraerNombresVariedadesCampo(actual);
        const def = Array.isArray(defecto) ? defecto : [];
        if (!act.length) return JSON.parse(JSON.stringify(def));
        const out = JSON.parse(JSON.stringify(actual));
        const arr = Array.isArray(out) ? out : [];
        const tiene = new Set(extraerNombresVariedadesCampo(arr).map((n) => n.toLowerCase()));
        def.forEach((item) => {
            const nom = typeof item === 'string' ? item : String(item?.nombre || '').trim();
            if (nom && !tiene.has(nom.toLowerCase())) {
                arr.push(typeof item === 'object' ? JSON.parse(JSON.stringify(item)) : item);
                tiene.add(nom.toLowerCase());
            }
        });
        return arr.length ? arr : JSON.parse(JSON.stringify(def));
    }

    function fusionarFundoMapeo(actual, defecto) {
        const a = actual && typeof actual === 'object' ? JSON.parse(JSON.stringify(actual)) : {};
        const d = defecto && typeof defecto === 'object' ? defecto : {};
        Object.keys(d).forEach((etapa) => {
            if (!a[etapa] || typeof a[etapa] !== 'object') {
                a[etapa] = JSON.parse(JSON.stringify(d[etapa]));
                return;
            }
            Object.keys(d[etapa]).forEach((campo) => {
                a[etapa][campo] = fusionarListaVariedadesCampo(a[etapa][campo], d[etapa][campo]);
            });
            Object.keys(d[etapa]).forEach((campo) => {
                if (!a[etapa][campo]) a[etapa][campo] = JSON.parse(JSON.stringify(d[etapa][campo]));
            });
        });
        Object.keys(d).forEach((etapa) => {
            if (!a[etapa]) a[etapa] = JSON.parse(JSON.stringify(d[etapa]));
        });
        return a;
    }

    function fusionarMapeoParcelasConDefecto(mapeo) {
        const def = window.MAPEO_PARCELAS_DEFAULT || {};
        const out = mapeo && typeof mapeo === 'object' ? JSON.parse(JSON.stringify(mapeo)) : {};
        Object.keys(def).forEach((fundo) => {
            out[fundo] = fusionarFundoMapeo(out[fundo], def[fundo]);
        });
        return out;
    }

    function obtenerMapeoParcelas(catalogo) {
        const cat = catalogo || obtenerCatalogoApp();
        return cat.mapeoParcelas && typeof cat.mapeoParcelas === 'object'
            ? cat.mapeoParcelas
            : (window.MAPEO_PARCELAS_DEFAULT || {});
    }

    function fundoTieneMapeo(fundo, catalogo) {
        const f = String(fundo || '').trim();
        if (!f) return false;
        const m = obtenerMapeoParcelas(catalogo)[f];
        return !!(m && typeof m === 'object' && Object.keys(m).length > 0);
    }

    function normalizarEtapaId(etapa) {
        const s = String(etapa || '').trim().toUpperCase().replace(/\s/g, '');
        const m = s.match(/^E(\d{1,2})$/i);
        if (!m) return '';
        return 'E' + String(parseInt(m[1], 10)).padStart(2, '0');
    }

    function normalizarCampoId(campo) {
        const s = String(campo || '').trim().toUpperCase().replace(/\s/g, '');
        const m = s.match(/^C(\d{1,2})$/i);
        if (!m) return '';
        return 'C' + String(parseInt(m[1], 10)).padStart(2, '0');
    }

    function clavesEquivalentes(a, b, tipo) {
        const na = tipo === 'etapa' ? normalizarEtapaId(a) : normalizarCampoId(a);
        const nb = tipo === 'etapa' ? normalizarEtapaId(b) : normalizarCampoId(b);
        return na && nb && na === nb;
    }

    function resolverClaveEnMapa(mapa, clave, tipo) {
        if (!mapa || !clave) return '';
        const keys = Object.keys(mapa);
        const hit = keys.find((k) => clavesEquivalentes(k, clave, tipo));
        return hit || '';
    }

    function resolverNombreVariedadCanonico(nombre, catalogo) {
        let raw = nombre;
        if (raw && typeof raw === 'object') {
            raw = raw.nombre || raw.variedad || raw.name || '';
        }
        raw = String(raw || '').trim();
        if (!raw) return '';
        const key = raw.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
        const alias = VARIEDAD_ALIASES[raw.toUpperCase()] || VARIEDAD_ALIASES[key];
        if (alias) return alias;
        const todas = listarOpcionesVariedad(catalogo || obtenerCatalogoApp());
        const norm = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
        const hit = todas.find((o) => norm(o.nombre) === norm(raw));
        return hit ? hit.nombre : raw;
    }

    function etapasFallbackLibres() {
        return Array.from({ length: 9 }, (_, i) => 'E' + String(i + 1).padStart(2, '0'));
    }

    function camposFallbackLibres() {
        return Array.from({ length: 9 }, (_, i) => 'C' + String(i + 1).padStart(2, '0'));
    }

    function listarEtapasMapeo(fundo, catalogo) {
        const m = obtenerMapeoParcelas(catalogo)[String(fundo || '').trim()];
        if (!m) return [];
        return Object.keys(m).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    }

    function listarEtapasParaFundo(fundo, catalogo) {
        const f = String(fundo || '').trim();
        if (!f) return [];
        return fundoTieneMapeo(f, catalogo) ? listarEtapasMapeo(f, catalogo) : etapasFallbackLibres();
    }

    function listarCamposParaFundo(fundo, etapa, catalogo) {
        const f = String(fundo || '').trim();
        const e = String(etapa || '').trim();
        if (!f || !e) return [];
        return fundoTieneMapeo(f, catalogo) ? listarCamposMapeo(f, e, catalogo) : camposFallbackLibres();
    }

    function listarCamposMapeo(fundo, etapa, catalogo) {
        const m = obtenerMapeoParcelas(catalogo)[String(fundo || '').trim()];
        if (!m) return [];
        const ek = resolverClaveEnMapa(m, etapa, 'etapa');
        if (!ek || !m[ek]) return [];
        return Object.keys(m[ek]).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    }

    function listarVariedadesMapeo(fundo, etapa, campo, catalogo) {
        const cat = catalogo || obtenerCatalogoApp();
        const m = obtenerMapeoParcelas(cat)[String(fundo || '').trim()];
        if (!m) return [];
        const ek = resolverClaveEnMapa(m, etapa, 'etapa');
        if (!ek || !m[ek]) return [];
        const bloque = m[ek];
        const out = new Set();
        if (campo) {
            const ck = resolverClaveEnMapa(bloque, campo, 'campo');
            const lista = ck ? extraerNombresVariedadesCampo(bloque[ck]) : [];
            lista.forEach((v) => {
                const c = resolverNombreVariedadCanonico(v, cat);
                if (c) out.add(c);
            });
            return [...out];
        }
        Object.keys(bloque).forEach((ck) => {
            extraerNombresVariedadesCampo(bloque[ck]).forEach((v) => {
                const c = resolverNombreVariedadCanonico(v, cat);
                if (c) out.add(c);
            });
        });
        return [...out];
    }

    function listarVariedadesFundoMapeo(fundo, catalogo) {
        const etapas = listarEtapasMapeo(fundo, catalogo);
        const out = new Set();
        etapas.forEach((e) => {
            listarVariedadesMapeo(fundo, e, '', catalogo).forEach((v) => out.add(v));
        });
        return [...out];
    }

    function listarVariedadesParaSeleccion(fundo, etapa, campo, catalogo) {
        if (!fundoTieneMapeo(fundo, catalogo)) return null;
        if (campo && etapa) return listarVariedadesMapeo(fundo, etapa, campo, catalogo);
        if (etapa) return listarVariedadesMapeo(fundo, etapa, '', catalogo);
        return listarVariedadesFundoMapeo(fundo, catalogo);
    }

    function resolverValorEnLista(valor, opciones, tipo) {
        const v = String(valor || '').trim();
        if (!v) return '';
        if (opciones.includes(v)) return v;
        const hit = opciones.find((o) => clavesEquivalentes(o, v, tipo));
        return hit || '';
    }

    function poblarSelectEtapa(selectEl, fundo, valorActual, catalogo) {
        if (!selectEl) return;
        const actual = String(valorActual != null ? valorActual : selectEl.value || '').trim();
        const opciones = listarEtapasParaFundo(fundo, catalogo);
        let html = '<option value="">Etapa</option>';
        opciones.forEach((e) => {
            html += `<option value="${escapeHtmlAttr(e)}">${escapeHtmlText(e)}</option>`;
        });
        if (actual && !opciones.some((o) => clavesEquivalentes(o, actual, 'etapa'))) {
            html += `<option value="${escapeHtmlAttr(actual)}">${escapeHtmlText(actual + ' (legacy)')}</option>`;
        }
        selectEl.innerHTML = html;
        selectEl.value = resolverValorEnLista(actual, [...opciones, actual].filter(Boolean), 'etapa') || '';
    }

    function poblarSelectCampo(selectEl, fundo, etapa, valorActual, catalogo) {
        if (!selectEl) return;
        const actual = String(valorActual != null ? valorActual : selectEl.value || '').trim();
        const opciones = (fundo && etapa) ? listarCamposParaFundo(fundo, etapa, catalogo) : [];
        let html = '<option value="">Campo</option>';
        opciones.forEach((c) => {
            html += `<option value="${escapeHtmlAttr(c)}">${escapeHtmlText(c)}</option>`;
        });
        if (actual && !opciones.some((o) => clavesEquivalentes(o, actual, 'campo'))) {
            html += `<option value="${escapeHtmlAttr(actual)}">${escapeHtmlText(actual + ' (legacy)')}</option>`;
        }
        selectEl.innerHTML = html;
        selectEl.value = resolverValorEnLista(actual, [...opciones, actual].filter(Boolean), 'campo') || '';
    }

    let filtroParcelaSilencioso = false;
    let refVariedadesPausado = false;
    let catalogoAppCache = null;
    let cacheOtrasVariedadesCat = null;
    let cacheOtrasVariedadesLista = null;

    function invalidarCacheCatalogoApp() {
        catalogoAppCache = null;
        cacheOtrasVariedadesCat = null;
        cacheOtrasVariedadesLista = null;
    }

    function actualizarHabilitacionOtrasVariedades(habilitar) {
        const det = document.getElementById('visual-variedades-referencia');
        if (!det) return;
        det.classList.toggle('is-disabled', !habilitar);
        det.querySelectorAll('.meta-variedades-ref-pick').forEach((btn) => {
            btn.disabled = !habilitar;
        });
        if (!habilitar) det.open = false;
    }

    function aplicarFiltrosParcelaCampo() {
        if (filtroParcelaSilencioso) return;
        const fundoEl = document.getElementById('visual-meta-fundo');
        const etapaEl = document.getElementById('visual-traz-etapa');
        const campoEl = document.getElementById('visual-traz-campo');
        const turnoEl = document.getElementById('visual-traz-turno');
        const varEl = document.getElementById('visual-meta-variedad');
        if (!fundoEl || !etapaEl || !campoEl) return;

        const catalogo = obtenerCatalogoApp();
        const fundo = String(fundoEl.value || '').trim();
        const etapaPrev = String(etapaEl.value || '').trim();
        const campoPrev = String(campoEl.value || '').trim();
        const varPrev = varEl ? String(varEl.value || '').trim() : '';
        const conMapeo = fundoTieneMapeo(fundo, catalogo);

        poblarSelectEtapa(etapaEl, fundo, etapaPrev, catalogo);
        const etapa = String(etapaEl.value || '').trim();
        poblarSelectCampo(campoEl, fundo, etapa, campoPrev, catalogo);
        const campo = String(campoEl.value || '').trim();

        etapaEl.disabled = !fundo;
        campoEl.disabled = !fundo || !etapa;
        if (turnoEl) turnoEl.disabled = !fundo || !etapa;

        const variedadHabilitada = !!(fundo && etapa && campo);
        if (varEl) {
            const permitidas = listarVariedadesParaSeleccion(fundo, etapa, campo, catalogo);
            const usarFiltro = conMapeo && variedadHabilitada;
            poblarSelectVariedad(varEl, varPrev, usarFiltro ? permitidas : null);
            varEl.disabled = !variedadHabilitada;
        }
        actualizarHabilitacionOtrasVariedades(variedadHabilitada);

        if (typeof window.sincronizarTrazabilidadCompuesta === 'function') {
            window.sincronizarTrazabilidadCompuesta();
        }
        if (typeof window.programarActualizarErroresMetaFormulario === 'function') {
            window.programarActualizarErroresMetaFormulario();
        } else if (typeof window.actualizarErroresMetaFormulario === 'function') {
            window.actualizarErroresMetaFormulario();
        }
    }

    function obtenerCatalogoDefectoNormalizado() {
        const base = clonarCatalogo(CATALOGO_APP_DEFAULT);
        return normalizarCatalogoApp(base) || base;
    }

    function asegurarMapeoEnCatalogo(cat) {
        if (!cat || typeof cat !== 'object') return cat;
        const def = obtenerCatalogoDefectoNormalizado();
        if (!cat.mapeoParcelas || !Object.keys(cat.mapeoParcelas).length) {
            cat.mapeoParcelas = JSON.parse(JSON.stringify(def.mapeoParcelas || {}));
        }
        cat.mapeoParcelas = fusionarMapeoParcelasConDefecto(cat.mapeoParcelas);
        return cat;
    }

    /** Catálogo siempre desde localStorage o embebido en JS (sin red). */
    function obtenerCatalogoApp() {
        if (catalogoAppCache) return catalogoAppCache;
        try {
            const raw = localStorage.getItem(CATALOGO_STORAGE_KEY);
            if (raw) {
                const parsed = normalizarCatalogoApp(JSON.parse(raw));
                if (parsed) {
                    catalogoAppCache = asegurarMapeoEnCatalogo(parsed);
                    return catalogoAppCache;
                }
            }
        } catch (_) {
            try {
                localStorage.removeItem(CATALOGO_STORAGE_KEY);
            } catch (e2) { /* ignore */ }
        }
        catalogoAppCache = asegurarMapeoEnCatalogo(obtenerCatalogoDefectoNormalizado());
        return catalogoAppCache;
    }

    function sembrarCatalogoLocalSiVacio() {
        try {
            if (!localStorage.getItem(CATALOGO_STORAGE_KEY)) {
                const def = obtenerCatalogoDefectoNormalizado();
                localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(def));
            }
        } catch (_) { /* ignore */ }
    }

    function guardarCatalogoApp(catalogo) {
        const norm = normalizarCatalogoApp(catalogo);
        if (!norm) throw new Error('JSON inválido: objeto raíz con "variedades" y/o "fundos".');
        localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(norm));
        invalidarCacheCatalogoApp();
        catalogoAppCache = asegurarMapeoEnCatalogo(norm);
        window.dispatchEvent(new CustomEvent(CATALOGO_EVENT, { detail: norm }));
        return norm;
    }

    function restaurarCatalogoPorDefecto() {
        try {
            localStorage.removeItem(CATALOGO_STORAGE_KEY);
        } catch (_) { /* ignore */ }
        invalidarCacheCatalogoApp();
        const def = clonarCatalogo(CATALOGO_APP_DEFAULT);
        window.dispatchEvent(new CustomEvent(CATALOGO_EVENT, { detail: def }));
        return def;
    }

    function catalogoAppAString(catalogo) {
        return JSON.stringify(catalogo || obtenerCatalogoApp(), null, 2);
    }

    function parsearCatalogoDesdeTexto(texto) {
        const parsed = JSON.parse(String(texto || '').trim());
        const norm = normalizarCatalogoApp(parsed);
        if (!norm) throw new Error('El JSON debe ser un objeto (p. ej. "variedades", "fundos").');
        return norm;
    }

    function listarNombresVariedadesUsadasEnMapeo(catalogo) {
        const cat = catalogo || obtenerCatalogoApp();
        const m = obtenerMapeoParcelas(cat);
        const out = new Set();
        Object.keys(m).forEach((fundo) => {
            const porEtapa = m[fundo];
            if (!porEtapa || typeof porEtapa !== 'object') return;
            Object.keys(porEtapa).forEach((etapa) => {
                const porCampo = porEtapa[etapa];
                if (!porCampo || typeof porCampo !== 'object') return;
                Object.keys(porCampo).forEach((campo) => {
                    extraerNombresVariedadesCampo(porCampo[campo]).forEach((n) => {
                        const c = resolverNombreVariedadCanonico(n, cat);
                        if (c) out.add(c);
                    });
                });
            });
        });
        return out;
    }

    /** Variedades del catálogo que no aparecen en ninguna parcela del mapeo. */
    function listarOtrasVariedadesReferencia(catalogo) {
        const cat = catalogo || obtenerCatalogoApp();
        if (cacheOtrasVariedadesCat === cat && cacheOtrasVariedadesLista) {
            return cacheOtrasVariedadesLista;
        }
        const usadas = listarNombresVariedadesUsadasEnMapeo(cat);
        const lista = listarOpcionesVariedad(cat).filter((o) => !usadas.has(o.nombre));
        cacheOtrasVariedadesCat = cat;
        cacheOtrasVariedadesLista = lista;
        return lista;
    }

    function listarPermitidasVariedadActual(catalogo) {
        const fundoEl = document.getElementById('visual-meta-fundo');
        const etapaEl = document.getElementById('visual-traz-etapa');
        const campoEl = document.getElementById('visual-traz-campo');
        const cat = catalogo || obtenerCatalogoApp();
        const fundo = String(fundoEl?.value || '').trim();
        const etapa = String(etapaEl?.value || '').trim();
        const campo = String(campoEl?.value || '').trim();
        const conMapeo = fundoTieneMapeo(fundo, cat);
        const usarFiltro = conMapeo && fundo && etapa && campo;
        return usarFiltro ? listarVariedadesParaSeleccion(fundo, etapa, campo, cat) : null;
    }

    function aplicarVariedadElegida(nombreRaw) {
        const sel = document.getElementById('visual-meta-variedad');
        if (!sel) return;
        const catalogo = obtenerCatalogoApp();
        const canon = resolverNombreVariedadCanonico(nombreRaw, catalogo);
        if (!canon) return;

        let permitidas = listarPermitidasVariedadActual(catalogo);
        if (Array.isArray(permitidas)) {
            const set = new Set(permitidas.map((n) => resolverNombreVariedadCanonico(n, catalogo)));
            if (!set.has(canon)) permitidas = permitidas.concat([canon]);
        }

        poblarSelectVariedad(sel, canon, permitidas);
        sel.value = canon;

        const det = document.getElementById('visual-variedades-referencia');
        if (det) det.open = false;

        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        actualizarBloqueOtrasVariedadesReferencia(catalogo);
        if (typeof window.programarActualizarErroresMetaFormulario === 'function') {
            window.programarActualizarErroresMetaFormulario();
        } else if (typeof window.actualizarErroresMetaFormulario === 'function') {
            window.actualizarErroresMetaFormulario();
        }
    }

    function actualizarBloqueOtrasVariedadesReferencia(catalogo) {
        if (refVariedadesPausado) return;
        const det = document.getElementById('visual-variedades-referencia');
        const lista = document.getElementById('visual-variedades-referencia-list');
        const badge = document.getElementById('visual-variedades-ref-count');
        if (!det || !lista) return;
        const cat = catalogo || obtenerCatalogoApp();
        const otras = listarOtrasVariedadesReferencia(cat);
        const selVal = String(document.getElementById('visual-meta-variedad')?.value || '').trim();
        if (badge) badge.textContent = '(' + otras.length + ')';
        const frag = document.createDocumentFragment();
        otras.forEach((o) => {
            const li = document.createElement('li');
            const activa = selVal && (o.nombre === selVal || resolverNombreVariedadCanonico(o.nombre, cat) === selVal);
            if (activa) li.className = 'is-selected';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'meta-variedades-ref-pick';
            btn.setAttribute('data-variedad', o.nombre);
            const cod = document.createElement('span');
            cod.className = 'meta-variedades-ref-cod';
            cod.textContent = o.codigo + ' · ' + o.nombre;
            const grp = document.createElement('span');
            grp.className = 'meta-variedades-ref-grp';
            grp.textContent = o.grupo;
            btn.appendChild(cod);
            btn.appendChild(grp);
            li.appendChild(btn);
            frag.appendChild(li);
        });
        lista.replaceChildren(frag);
    }

    function enlazarListaOtrasVariedades() {
        const lista = document.getElementById('visual-variedades-referencia-list');
        if (!lista || lista.dataset.variedadPickBound === '1') return;
        lista.dataset.variedadPickBound = '1';
        lista.addEventListener('click', (e) => {
            const btn = e.target.closest('.meta-variedades-ref-pick');
            if (!btn) return;
            e.preventDefault();
            aplicarVariedadElegida(btn.getAttribute('data-variedad') || '');
        });
    }

    function listarOpcionesVariedad(catalogo) {
        const variedades = catalogo?.variedades || {};
        const grupos = Object.keys(variedades).sort((a, b) => a.localeCompare(b, 'es'));
        const lista = [];
        grupos.forEach((grupo) => {
            const mapa = variedades[grupo];
            if (!mapa || typeof mapa !== 'object') return;
            Object.keys(mapa).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).forEach((codigo) => {
                const nombre = String(mapa[codigo] || '').trim();
                if (!nombre) return;
                lista.push({ grupo, codigo, nombre });
            });
        });
        return lista;
    }

    function poblarSelectVariedad(selectEl, valorActual, nombresPermitidos) {
        if (!selectEl) return;
        const catalogo = obtenerCatalogoApp();
        let opciones = listarOpcionesVariedad(catalogo);
        const actual = String(valorActual != null ? valorActual : selectEl.value || '').trim();
        if (Array.isArray(nombresPermitidos)) {
            const permitidos = new Set(
                nombresPermitidos.map((n) => resolverNombreVariedadCanonico(n, catalogo))
            );
            opciones = opciones.filter((o) => permitidos.has(o.nombre));
        }
        const nombres = new Set(opciones.map((o) => o.nombre));
        const ctxParcela = obtenerContextoParcelaActual();

        let html = '<option value="">Seleccionar</option>';
        const porGrupo = {};
        opciones.forEach((o) => {
            if (!porGrupo[o.grupo]) porGrupo[o.grupo] = [];
            porGrupo[o.grupo].push(o);
        });
        Object.keys(porGrupo).sort((a, b) => a.localeCompare(b, 'es')).forEach((grupo) => {
            html += `<optgroup label="${escapeHtmlAttr(grupo)}">`;
            porGrupo[grupo].forEach((o) => {
                const label = etiquetaVariedadEnSelect(o, catalogo, ctxParcela);
                html += `<option value="${escapeHtmlAttr(o.nombre)}">${escapeHtmlText(label)}</option>`;
            });
            html += '</optgroup>';
        });

        if (actual && !nombres.has(actual)) {
            html += `<option value="${escapeHtmlAttr(actual)}">${escapeHtmlText(actual + ' (legacy)')}</option>`;
        }

        selectEl.innerHTML = html;
        if (actual) selectEl.value = actual;
        if (!refVariedadesPausado) actualizarBloqueOtrasVariedadesReferencia(catalogo);
    }

    function escapeHtmlAttr(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function escapeHtmlText(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;');
    }

    function listarOpcionesFundo(catalogo) {
        return normalizarListaFundos(catalogo?.fundos);
    }

    function poblarSelectFundo(selectEl, valorActual) {
        if (!selectEl) return;
        const catalogo = obtenerCatalogoApp();
        const opciones = listarOpcionesFundo(catalogo);
        const actual = String(valorActual != null ? valorActual : selectEl.value || '').trim();
        const values = new Set(opciones.map((o) => o.value));

        let html = '<option value="">Seleccionar</option>';
        opciones.forEach((o) => {
            html += `<option value="${escapeHtmlAttr(o.value)}">${escapeHtmlText(o.label)}</option>`;
        });
        if (actual && !values.has(actual)) {
            html += `<option value="${escapeHtmlAttr(actual)}">${escapeHtmlText(actual + ' (legacy)')}</option>`;
        }

        selectEl.innerHTML = html;
        if (actual) selectEl.value = actual;
    }

    function poblarSelectVariedadCampo(valorActual) {
        const sel = document.getElementById('visual-meta-variedad');
        poblarSelectVariedad(sel, valorActual);
    }

    function poblarSelectFundoCampo(valorActual) {
        const sel = document.getElementById('visual-meta-fundo');
        poblarSelectFundo(sel, valorActual);
    }

    function enlazarFiltrosParcelaCampo() {
        const ids = ['visual-meta-fundo', 'visual-traz-etapa', 'visual-traz-campo'];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el || el.dataset.parcelaFiltro === '1') return;
            el.dataset.parcelaFiltro = '1';
            el.addEventListener('change', () => {
                if (id === 'visual-meta-fundo') {
                    const et = document.getElementById('visual-traz-etapa');
                    const ca = document.getElementById('visual-traz-campo');
                    const tu = document.getElementById('visual-traz-turno');
                    const va = document.getElementById('visual-meta-variedad');
                    if (et) et.value = '';
                    if (ca) ca.value = '';
                    if (tu) tu.value = '';
                    if (va) va.value = '';
                } else if (id === 'visual-traz-etapa') {
                    const ca = document.getElementById('visual-traz-campo');
                    const tu = document.getElementById('visual-traz-turno');
                    const va = document.getElementById('visual-meta-variedad');
                    if (ca) ca.value = '';
                    if (tu) tu.value = '';
                    if (va) va.value = '';
                } else if (id === 'visual-traz-campo') {
                    const va = document.getElementById('visual-meta-variedad');
                    if (va) va.value = '';
                }
                aplicarFiltrosParcelaCampo();
            });
        });
    }

    function refrescarSelectsCatalogoCampo() {
        const selFun = document.getElementById('visual-meta-fundo');
        const selVar = document.getElementById('visual-meta-variedad');
        if (!selFun && !selVar) return;
        sembrarCatalogoLocalSiVacio();
        obtenerCatalogoApp();
        aplicarFiltrosParcelaCampo();
        actualizarBloqueOtrasVariedadesReferencia();
    }

    function prepararContextoParcelaDesdeMeta(meta) {
        if (!meta || typeof meta !== 'object') return null;
        sembrarCatalogoLocalSiVacio();
        const catalogo = obtenerCatalogoApp();
        return {
            catalogo,
            fundo: String(meta['visual-meta-fundo'] || meta['meta-fundo'] || '').trim(),
            etapa: String(meta['visual-traz-etapa'] || meta['meta-traz-etapa'] || '').trim(),
            campo: String(meta['visual-traz-campo'] || meta['meta-traz-campo'] || '').trim(),
            variedad: String(meta['visual-meta-variedad'] || meta['meta-variedad'] || '').trim(),
            turno: String(meta['visual-traz-turno'] || meta['meta-traz-turno'] || '').trim(),
            fundoEl: document.getElementById('visual-meta-fundo'),
            etapaEl: document.getElementById('visual-traz-etapa'),
            campoEl: document.getElementById('visual-traz-campo'),
            varEl: document.getElementById('visual-meta-variedad'),
            turnoEl: document.getElementById('visual-traz-turno')
        };
    }

    /** Pasos ligeros para arranque diferido (un select por tick). */
    function pasosAplicarParcelaCampoDesdeMeta(meta) {
        const ctx = prepararContextoParcelaDesdeMeta(meta);
        if (!ctx) return [];
        const state = {
            fundoOk: ctx.fundo,
            etapaOk: ctx.etapa,
            campoOk: ctx.campo
        };
        const pasos = [];
        if (ctx.fundoEl) {
            pasos.push(() => {
                poblarSelectFundo(ctx.fundoEl, ctx.fundo);
                state.fundoOk = String(ctx.fundoEl.value || '').trim() || ctx.fundo;
            });
        }
        if (ctx.etapaEl) {
            pasos.push(() => {
                poblarSelectEtapa(ctx.etapaEl, state.fundoOk, ctx.etapa, ctx.catalogo);
                state.etapaOk = String(ctx.etapaEl.value || '').trim() || ctx.etapa;
            });
        }
        if (ctx.campoEl) {
            pasos.push(() => {
                poblarSelectCampo(ctx.campoEl, state.fundoOk, state.etapaOk, ctx.campo, ctx.catalogo);
                state.campoOk = String(ctx.campoEl.value || '').trim() || ctx.campo;
            });
        }
        if (ctx.varEl) {
            pasos.push(() => {
                const permitidas = listarVariedadesParaSeleccion(
                    state.fundoOk, state.etapaOk, state.campoOk, ctx.catalogo
                );
                const usarFiltro = fundoTieneMapeo(state.fundoOk, ctx.catalogo)
                    && state.fundoOk && state.etapaOk && state.campoOk;
                poblarSelectVariedad(ctx.varEl, ctx.variedad, usarFiltro ? permitidas : null);
            });
        }
        pasos.push(() => {
            if (ctx.turnoEl && ctx.turno) ctx.turnoEl.value = ctx.turno;
            if (typeof window.sincronizarTrazabilidadCompuesta === 'function') {
                window.sincronizarTrazabilidadCompuesta();
            }
        });
        return pasos;
    }

    /** Repuebla fundo/etapa/campo/variedad con opciones y valores guardados (p. ej. tras borrador). */
    function aplicarParcelaCampoDesdeMeta(meta) {
        pasosAplicarParcelaCampoDesdeMeta(meta).forEach((fn) => fn());
    }

    function enlazarCatalogoOfflineOnline() {
        if (window.__tiemposCatalogoRedBound === '1') return;
        window.__tiemposCatalogoRedBound = '1';
        const refrescar = () => {
            refrescarSelectsCatalogoCampo();
            if (typeof window.asegurarOpcionesSelectAcopio === 'function') {
                window.asegurarOpcionesSelectAcopio();
            }
        };
        window.addEventListener('offline', refrescar);
        window.addEventListener('online', refrescar);
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) refrescar();
        });
    }

    function initCatalogoSelectsCampo(opts) {
        if (window.__tiemposCatalogoCampoInited === '1' && !opts?.forzar) {
            aplicarFiltrosParcelaCampo();
            return;
        }
        const pausarRef = opts?.pausarRef !== false;
        if (pausarRef) refVariedadesPausado = true;
        try {
            sembrarCatalogoLocalSiVacio();
            obtenerCatalogoApp();
            const selFun = document.getElementById('visual-meta-fundo');
            if (selFun) poblarSelectFundo(selFun);
            enlazarFiltrosParcelaCampo();
            enlazarListaOtrasVariedades();
            enlazarCatalogoOfflineOnline();
            const selVarChange = document.getElementById('visual-meta-variedad');
            if (selVarChange && selVarChange.dataset.variedadRefSync !== '1') {
                selVarChange.dataset.variedadRefSync = '1';
                selVarChange.addEventListener('change', () => actualizarBloqueOtrasVariedadesReferencia());
            }
            if (!opts?.sinAplicarFiltros) aplicarFiltrosParcelaCampo();
            window.__tiemposCatalogoCampoInited = '1';
        } finally {
            if (pausarRef) refVariedadesPausado = false;
        }

        if (window.__tiemposCatalogoEventBound === '1') return;
        window.__tiemposCatalogoEventBound = '1';
        window.addEventListener(CATALOGO_EVENT, () => {
            invalidarCacheCatalogoApp();
            refrescarSelectsCatalogoCampo();
            if (typeof window.actualizarBloqueoTrazabilidadPorFundo === 'function') {
                window.actualizarBloqueoTrazabilidadPorFundo();
            }
        });
    }

    window.CATALOGO_APP_DEFAULT = CATALOGO_APP_DEFAULT;
    window.CATALOGO_STORAGE_KEY = CATALOGO_STORAGE_KEY;
    window.CATALOGO_EVENT = CATALOGO_EVENT;
    window.obtenerCatalogoApp = obtenerCatalogoApp;
    window.guardarCatalogoApp = guardarCatalogoApp;
    window.restaurarCatalogoPorDefecto = restaurarCatalogoPorDefecto;
    window.catalogoAppAString = catalogoAppAString;
    window.parsearCatalogoDesdeTexto = parsearCatalogoDesdeTexto;
    window.poblarSelectVariedad = poblarSelectVariedad;
    window.poblarSelectFundo = poblarSelectFundo;
    window.poblarSelectVariedadCampo = poblarSelectVariedadCampo;
    window.poblarSelectFundoCampo = poblarSelectFundoCampo;
    window.aplicarFiltrosParcelaCampo = aplicarFiltrosParcelaCampo;
    window.refrescarSelectsCatalogoCampo = refrescarSelectsCatalogoCampo;
    window.aplicarParcelaCampoDesdeMeta = aplicarParcelaCampoDesdeMeta;
    window.pasosAplicarParcelaCampoDesdeMeta = pasosAplicarParcelaCampoDesdeMeta;
    window.aplicarVariedadElegida = aplicarVariedadElegida;
    window.filtroParcelaSilencioso = (on) => { filtroParcelaSilencioso = !!on; };
    window.pausarRefVariedadesCampo = (on) => { refVariedadesPausado = !!on; };
    window.actualizarBloqueOtrasVariedadesReferencia = actualizarBloqueOtrasVariedadesReferencia;
    window.invalidarCacheCatalogoApp = invalidarCacheCatalogoApp;
    window.initSelectVariedadCampo = initCatalogoSelectsCampo;
    window.initCatalogoSelectsCampo = initCatalogoSelectsCampo;
}());
