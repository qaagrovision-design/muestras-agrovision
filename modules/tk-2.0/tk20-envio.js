/** TK-2.0: barra responsable/transporte, habilitar formulario y envío (incl. modal masivo). */
(function initTk20Envio() {
    const elFecha = document.getElementById('mptk-fecha');
    const elMuestra = document.getElementById('mptk-muestra');
    const elHoraRow = document.getElementById('tk2_hora_row');
    const elResponsable = document.getElementById('tk2_responsable');
    const elEnvioBar = document.getElementById('tk2_envio_bar');
    const elBtnEnviar = document.getElementById('tk2_btn_enviar');
    const elBarLlegada = document.getElementById('tk2_control_bar_llegada');
    const elBarTraslado = document.getElementById('tk2_control_bar_traslado');
    const elCardsLlegada = document.getElementById('tk20-cards-llegada');
    const elCardsTraslado = document.getElementById('packing-cards-wrap');

    let lastDetalle = null;
    let envioEnCurso = false;

    function transporte() {
        return window.Tk20Transporte;
    }

    function normalizarFechaIso(f) {
        const s = String(f || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s;
    }

    function textoSelectMuestra(num, en) {
        const n = String(num || '').trim();
        const e = String(en || '').trim();
        return n && e ? (n + ' - ' + e + ' muestra') : (n || e);
    }

    function obtenerOpcionesMuestraTk20Select_() {
        if (!elMuestra) return [];
        return Array.from(elMuestra.options)
            .map((o) => String(o.value || '').trim())
            .filter(Boolean);
    }

    function numeroEnsayoTk20DesdeRaw_(raw) {
        const parts = String(raw || '').split('|');
        const en = Number(parts[1] || 0);
        return Number.isFinite(en) && en > 0 ? en : 0;
    }

    function numeroEnsayoItemTk20_(item) {
        if (item == null) return 0;
        if (typeof item === 'string') return numeroEnsayoTk20DesdeRaw_(item);
        const en = Number(item.ensayo_numero || item.ensayo || 0);
        if (Number.isFinite(en) && en > 0) return en;
        return numeroEnsayoTk20DesdeRaw_(item.raw);
    }

    function ordenarMuestrasTk20PorEnsayo_(lista) {
        return (lista || []).slice().sort((a, b) => {
            return numeroEnsayoItemTk20_(a) - numeroEnsayoItemTk20_(b);
        });
    }

    function recogerCandidatosMuestrasTk20DelDia_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return [];
        const vistos = new Set(obtenerOpcionesMuestraTk20Select_());
        (window.Tk20Draft?.muestrasConBorradorEnFecha?.(fecha) || []).forEach((raw) => {
            if (raw) vistos.add(raw);
        });
        return Array.from(vistos);
    }

    function metaListaMuestraTk20_(raw) {
        const rawStr = String(raw || '').trim();
        if (!rawStr || !elMuestra) return null;
        const opt = Array.from(elMuestra.options).find((o) => o.value === rawStr);
        if (!opt) return null;
        return {
            tieneTk20: opt.dataset.tieneTk20 === '1',
            campoListo: opt.dataset.campoListo !== '0',
            fundoHabilitaTk20: opt.dataset.fundoHabilitaTk20 === '1'
        };
    }

    function detalleSnapMuestraTk20_(raw) {
        const rawStr = String(raw || '').trim();
        if (!rawStr) return null;
        const fecha = normalizarFechaIso(elFecha?.value);
        if (rawStr === String(elMuestra?.value || '').trim()) {
            const live = lastDetalle || window.Tk20Header?.getLastDetalle?.();
            if (live) return live;
        }
        const borrador = fecha ? window.Tk20Draft?.leerBorrador?.(fecha, rawStr) : null;
        if (borrador?.detalleSnap) return borrador.detalleSnap;
        const meta = window.Tk20Header?.getMetaListaMuestraTk20?.(fecha, rawStr);
        if (meta) {
            return {
                FUNDO: meta.FUNDO,
                fundo_habilita_flujo_tk20: meta.fundo_habilita_flujo_tk20,
                tieneTk20: meta.tieneTk20,
                campo_completo_hora_registro: meta.campo_completo_hora_registro,
                puede_continuar_tk20: meta.puede_continuar_tk20,
                MAX_CLAMSHELL: meta.maxClamshell,
                N_CLAMSHELL: meta.maxClamshell,
                FILAS_TOTAL_CAMPO: meta.numFilas,
                FILAS_CAMPO_CON_HORA_REGISTRO: meta.filasCampoConHoraRegistro
            };
        }
        const optMeta = metaListaMuestraTk20_(rawStr);
        if (optMeta?.fundoHabilitaTk20 === true) return { fundo_habilita_flujo_tk20: true };
        if (optMeta?.fundoHabilitaTk20 === false) return { fundo_habilita_flujo_tk20: false };
        return null;
    }

    function muestraTk20AplicaFlujo_(raw) {
        const d = detalleSnapMuestraTk20_(raw);
        if (d) return window.FundoFlujoTk20?.habilitaDesdeDetalle?.(d) === true;
        const optMeta = metaListaMuestraTk20_(raw);
        if (optMeta && typeof optMeta.fundoHabilitaTk20 === 'boolean') return optMeta.fundoHabilitaTk20;
        return false;
    }

    function ensayosExentosSecuenciaTk20_() {
        const ex = new Set();
        obtenerOpcionesMuestraTk20Select_().forEach((raw) => {
            if (!muestraTk20AplicaFlujo_(raw)) {
                const n = numeroEnsayoTk20DesdeRaw_(raw);
                if (n > 0) ex.add(n);
            }
        });
        return ex;
    }

    function huecosSinExentosTk20_(huecos, exentos) {
        return (huecos || []).filter((n) => !exentos.has(n));
    }

    function selDesdeRaw_(raw) {
        const parts = String(raw || '').split('|');
        const opt = Array.from(elMuestra?.options || []).find((o) => o.value === raw);
        const modo = String(opt?.dataset?.modoRegistro || '').trim().toLowerCase();
        return {
            num_muestra: parts[0] || '',
            ensayo_numero: parts[1] || '',
            modo_registro: (modo === 'acopio' || modo === 'visual') ? modo : '',
            raw: String(raw || '').trim()
        };
    }

    function itemMuestraTk20ParaLista_(raw, numMuestra, ensayoNumero) {
        return {
            raw,
            num_muestra: numMuestra,
            ensayo_numero: ensayoNumero,
            etiqueta: textoSelectMuestra(numMuestra, ensayoNumero)
        };
    }

    function pesoDisplayVacioTk20_(g) {
        const n = Number(g);
        return !Number.isFinite(n) || n <= 0;
    }

    function restantesPesosEtapaDesdeEstado_(etapaKey, estado) {
        const F = window.Tk20Fields;
        const total = F?.getNumPesosEfectivos?.() || F?.NUM_CLAMSHELLS || 8;
        const etapa = estado?.etapas?.[etapaKey];
        const pesos = etapa?.pesos || {};
        let done = 0;
        for (let i = 1; i <= total; i++) {
            const key = F?.peso?.(etapaKey, i);
            if (key && !pesoDisplayVacioTk20_(pesos[key])) done++;
        }
        return Math.max(0, total - done);
    }

    function restantesDesdeEstadoTk20_(estado) {
        return restantesPesosEtapaDesdeEstado_('llegada', estado)
            + restantesPesosEtapaDesdeEstado_('traslado', estado);
    }

    function campoListoDesdeDetalleSnap(d) {
        if (!d || d.tieneTk20 === true) return false;
        if (d.campo_completo_hora_registro === true) return true;
        if (d.puede_continuar_tk20 === true) return true;
        let max = Number(d.MAX_CLAMSHELL ?? 0);
        if (!max && d.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        const totalCampo = Number(d.FILAS_TOTAL_CAMPO ?? d.numFilas ?? 0);
        if (totalCampo > 0 && (max <= 0 || max < totalCampo)) max = totalCampo;
        const hechas = Number(d.FILAS_CAMPO_CON_HORA_REGISTRO ?? 0);
        return max > 0 && hechas >= max;
    }

    function detalleSnapIndicaTk20Completo_(d) {
        return !!(d && d.tieneTk20 === true);
    }

    function muestraSeleccionada() {
        return Boolean(String(elMuestra?.value || '').trim());
    }

    function tk20CompletoEnServidor(d) {
        const det = d || lastDetalle;
        if (!det) return false;
        return det.tieneTk20 === true;
    }

    function campoListoParaTk20(d) {
        const det = d || lastDetalle;
        if (!det) return false;
        return campoListoDesdeDetalleSnap(det);
    }

    function registroCompletoEnServidor(d) {
        return tk20CompletoEnServidor(d);
    }

    function muestraTk20YaCompletaEnServidor_(raw) {
        const rawStr = String(raw || '').trim();
        if (!rawStr) return false;
        if (rawStr === String(elMuestra?.value || '').trim() && registroCompletoEnServidor()) return true;
        if (metaListaMuestraTk20_(rawStr)?.tieneTk20) return true;
        const fecha = normalizarFechaIso(elFecha?.value);
        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, rawStr);
        return detalleSnapIndicaTk20Completo_(borrador?.detalleSnap);
    }

    function validarCompletitudTk20ParaEnvioDesdeEstado_(estado, detalleSnap) {
        const errores = [];
        const resp = String(estado?.responsable || '').trim();
        const placa = String(estado?.transporte?.placa || '').trim();
        if (!resp) errores.push('Falta responsable.');
        if (!placa) errores.push('Falta placa del vehículo.');
        // Enviar progresivo: solo coherencia entre lo capturado (sin exigir 6+6 pesos).
        const pesoErr = window.Tk20Pesos?.validarPesosEstado?.(estado, detalleSnap) || [];
        if (pesoErr.length) errores.push(...pesoErr);
        return { ok: errores.length === 0, errores };
    }

    function muestraTk20EstadoCompleto_(estado, detalleSnap) {
        if (!campoListoDesdeDetalleSnap(detalleSnap)) return false;
        if (restantesDesdeEstadoTk20_(estado) > 0) return false;
        return validarCompletitudTk20ParaEnvioDesdeEstado_(estado, detalleSnap).ok;
    }

    function muestraTk20PendienteDeEnvio_(estado, detalleSnap, rawMuestra) {
        if (muestraTk20YaCompletaEnServidor_(rawMuestra)) return false;
        return muestraTk20EstadoCompleto_(estado, detalleSnap);
    }

    function capturaEstadoMuestraParaValidacionTk20_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        const parts = raw.split('|');
        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, raw);
        if (raw === String(elMuestra?.value || '').trim()) {
            const estadoLive = window.Tk20Draft?.capturarEstadoUi?.() || {};
            const detalleLive = lastDetalle || borrador?.detalleSnap || null;
            return {
                raw,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || '',
                estado: estadoLive,
                detalleSnap: detalleLive
            };
        }
        if (!borrador?.estado) return null;
        return {
            raw,
            num_muestra: parts[0] || '',
            ensayo_numero: parts[1] || '',
            estado: borrador.estado,
            detalleSnap: borrador.detalleSnap || null
        };
    }

    function capturaEstadoMuestraParaEnvioTk20_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (muestraTk20YaCompletaEnServidor_(raw)) return null;
        const parts = raw.split('|');

        if (raw === String(elMuestra?.value || '').trim()) {
            const estado = window.Tk20Draft?.capturarEstadoUi?.() || {};
            if (window.Tk20Draft?.hayDatosCaptura?.(estado)) {
                return {
                    raw,
                    num_muestra: parts[0] || '',
                    ensayo_numero: parts[1] || '',
                    estado,
                    detalleSnap: lastDetalle
                };
            }
        }

        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, raw);
        if (borrador?.estado && window.Tk20Draft?.hayDatosCaptura?.(borrador.estado)) {
            return {
                raw,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || '',
                estado: borrador.estado,
                detalleSnap: borrador.detalleSnap || null
            };
        }

        return capturaEstadoMuestraParaValidacionTk20_(raw);
    }

    function detectarHuecosSecuenciaTk20_(completas) {
        const numeros = ordenarMuestrasTk20PorEnsayo_(completas)
            .map((c) => numeroEnsayoTk20DesdeRaw_(c.raw))
            .filter((n) => n > 0);
        const huecos = [];
        if (!numeros.length) return { numeros, huecos };
        const min = numeros[0];
        const max = numeros[numeros.length - 1];
        for (let n = min; n <= max; n++) {
            if (!numeros.includes(n)) huecos.push(n);
        }
        return { numeros, huecos };
    }

    function muestraTk20EnUso_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return false;
        if (!muestraTk20AplicaFlujo_(raw)) return muestraTk20YaCompletaEnServidor_(raw);
        if (muestraTk20YaCompletaEnServidor_(raw)) return true;
        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, raw);
        if (borrador?.estado && window.Tk20Draft?.hayDatosCaptura?.(borrador.estado)) return true;
        if (raw === String(elMuestra?.value || '').trim()) {
            return window.Tk20Draft?.hayDatosCaptura?.(window.Tk20Draft?.capturarEstadoUi?.());
        }
        return false;
    }

    function resumenMuestraTk20DelDia_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (!muestraTk20EnUso_(raw)) return null;
        const parts = raw.split('|');
        const numMuestra = parts[0] || '';
        const ensayoNumero = parts[1] || '';
        const etiqueta = textoSelectMuestra(numMuestra, ensayoNumero);
        const base = { raw, num_muestra: numMuestra, ensayo_numero: ensayoNumero, etiqueta };

        if (muestraTk20YaCompletaEnServidor_(raw)) {
            return Object.assign(base, { estado: 'enviada', restantes: 0 });
        }

        const cap = capturaEstadoMuestraParaValidacionTk20_(raw);
        if (!cap || !window.Tk20Draft?.hayDatosCaptura?.(cap.estado)) {
            return Object.assign(base, { estado: 'sin_datos', restantes: null });
        }

        const rest = restantesDesdeEstadoTk20_(cap.estado);
        const lista = muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, raw);
        return Object.assign(base, {
            estado: lista ? 'lista' : 'incompleta',
            restantes: rest
        });
    }

    function analizarMuestrasTk20DelDia_() {
        const opciones = obtenerOpcionesMuestraTk20Select_();
        const resumenes = opciones.map((raw) => resumenMuestraTk20DelDia_(raw)).filter(Boolean);
        const listas = resumenes
            .filter((r) => r.estado === 'lista')
            .map((r) => itemMuestraTk20ParaLista_(r.raw, r.num_muestra, r.ensayo_numero));
        const incompletas = resumenes.filter((r) => r.estado === 'incompleta');
        const sinDatos = resumenes.filter((r) => r.estado === 'sin_datos');
        const pendientes = incompletas.concat(sinDatos);
        const enUso = resumenes.map((r) => r.raw);
        const numerosDia = enUso
            .map((raw) => numeroEnsayoTk20DesdeRaw_(raw))
            .filter((n) => n > 0)
            .sort((a, b) => a - b);
        const numerosListas = listas
            .map((item) => numeroEnsayoTk20DesdeRaw_(item.raw))
            .filter((n) => n > 0);
        const numerosEnviadas = resumenes
            .filter((r) => r.estado === 'enviada')
            .map((r) => numeroEnsayoTk20DesdeRaw_(r.raw))
            .filter((n) => n > 0);
        const huecosEntreListas = detectarHuecosSecuenciaTk20_(listas).huecos;
        const exentos = ensayosExentosSecuenciaTk20_();
        const huecosEnDia = [];
        if (numerosDia.length) {
            const min = numerosDia[0];
            const max = numerosDia[numerosDia.length - 1];
            for (let n = min; n <= max; n++) {
                const enDia = numerosDia.includes(n);
                const satisfecha = numerosListas.includes(n) || numerosEnviadas.includes(n) || exentos.has(n);
                if (enDia && !satisfecha) huecosEnDia.push(n);
            }
        }
        return {
            opciones,
            enUso,
            resumenes,
            listas: ordenarMuestrasTk20PorEnsayo_(listas),
            incompletas,
            sinDatos,
            pendientes,
            huecosEntreListas,
            huecosEnDia,
            ensayosExentos: exentos
        };
    }

    function textoPendienteMuestraTk20_(r) {
        const etiqueta = r.etiqueta || textoSelectMuestra(r.num_muestra, r.ensayo_numero);
        if (r.estado === 'sin_datos') {
            return '<li><b>' + etiqueta + '</b> — sin datos de TK-2.0</li>';
        }
        const rest = Number(r.restantes);
        const det = Number.isFinite(rest) && rest > 0
            ? ('faltan <b>' + rest + '</b> peso(s) · contador debe estar en <b>0</b>')
            : 'contador debe estar en <b>0</b>';
        return '<li><b>' + etiqueta + '</b> — ' + det + '</li>';
    }

    async function confirmarContinuarEnvioConPendientesTk20_(analisis) {
        const pendientes = analisis?.pendientes || [];
        if (!pendientes.length) return true;

        const listas = analisis.listas || [];
        const htmlPend = '<ul style="margin:8px 0 0;padding-left:18px;text-align:left;font-size:13px;color:#475569;">'
            + pendientes.map((r) => textoPendienteMuestraTk20_(r)).join('')
            + '</ul>';
        const htmlListas = listas.length
            ? '<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Listas para enviar (contador en 0): <b>'
                + listas.map((x) => x.etiqueta || x.ensayo_numero).join(', ')
                + '</b></p>'
            : '';
        const html = '<p style="margin:0;font-size:13px;color:#475569;">Hay muestras del día que <b>no están completas</b> '
            + '(el badge del + debe estar en <b>0 verde</b>):</p>'
            + htmlPend
            + htmlListas
            + '<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Completa esos datos o continúa solo con las muestras listas.</p>';

        const r = await window.Tk20Swal?.fire?.({
            icon: 'warning',
            title: 'Muestras incompletas',
            html,
            showCancelButton: true,
            cancelButtonText: 'Completar datos',
            confirmButtonText: listas.length ? 'Continuar a enviar' : 'Entendido',
            allowOutsideClick: false
        });
        if (!listas.length) return false;
        return !!(r && r.isConfirmed);
    }

    function unirMuestrasTk20ParaEnvio_(listas) {
        const map = new Map();
        (listas || []).forEach((lista) => {
            (lista || []).forEach((item) => {
                if (item?.raw) map.set(item.raw, item);
            });
        });
        return ordenarMuestrasTk20PorEnsayo_(Array.from(map.values()));
    }

    function obtenerMuestrasCompletasTk20ParaEnvio_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        const candidatos = recogerCandidatosMuestrasTk20DelDia_(fecha);
        const vistos = new Set();
        const out = [];
        candidatos.forEach((raw) => {
            if (!raw || vistos.has(raw)) return;
            if (!muestraTk20AplicaFlujo_(raw)) return;
            vistos.add(raw);
            const cap = capturaEstadoMuestraParaValidacionTk20_(raw);
            if (!cap || !muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, raw)) return;
            out.push(itemMuestraTk20ParaLista_(cap.raw, cap.num_muestra, cap.ensayo_numero));
        });
        return ordenarMuestrasTk20PorEnsayo_(out);
    }

    function resolverCandidatasModalEnvioTk20_(completas) {
        const analisis = analizarMuestrasTk20DelDia_();
        const listasModal = analisis.listas.length
            ? analisis.listas
            : obtenerMuestrasListasModalEnvioTk20_();
        return unirMuestrasTk20ParaEnvio_([completas, listasModal]);
    }

    function muestraTk20ListaParaModal_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (!muestraTk20AplicaFlujo_(raw)) return null;
        if (muestraTk20YaCompletaEnServidor_(raw)) return null;
        const parts = raw.split('|');
        const numMuestra = parts[0] || '';
        const ensayoNumero = parts[1] || '';
        if (!ensayoNumero) return null;

        if (raw === String(elMuestra?.value || '').trim()) {
            if (!campoListoParaTk20()) return null;
            const estado = window.Tk20Draft?.capturarEstadoUi?.() || {};
            if (!window.Tk20Draft?.hayDatosCaptura?.(estado)) return null;
            if (!pesosCompletosParaEnvio()) return null;
            if (!validarCompletitudTk20ParaEnvio().ok) return null;
            return itemMuestraTk20ParaLista_(raw, numMuestra, ensayoNumero);
        }

        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, raw);
        if (!borrador?.estado || !window.Tk20Draft?.hayDatosCaptura?.(borrador.estado)) return null;
        if (!campoListoDesdeDetalleSnap(borrador.detalleSnap)) return null;
        if (restantesDesdeEstadoTk20_(borrador.estado) !== 0) return null;
        if (!validarCompletitudTk20ParaEnvioDesdeEstado_(borrador.estado, borrador.detalleSnap).ok) return null;
        return itemMuestraTk20ParaLista_(raw, numMuestra, ensayoNumero);
    }

    function obtenerMuestrasListasModalEnvioTk20_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        const vistos = new Set();
        const out = [];
        recogerCandidatosMuestrasTk20DelDia_(fecha).forEach((raw) => {
            if (!raw || vistos.has(raw)) return;
            vistos.add(raw);
            const item = muestraTk20ListaParaModal_(raw);
            if (item) out.push(item);
        });
        return ordenarMuestrasTk20PorEnsayo_(out);
    }

    function persistirBorradoresCompletasTk20_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return;
        const rawActivo = String(elMuestra?.value || '').trim();
        window.Tk20Draft?.guardarMuestraActivaInmediato?.();
        recogerCandidatosMuestrasTk20DelDia_(fecha).forEach((raw) => {
            const cap = capturaEstadoMuestraParaValidacionTk20_(raw);
            if (!cap || !muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, raw)) return;
            if (!window.Tk20Draft?.hayDatosCaptura?.(cap.estado)) return;
            window.Tk20Draft?.snapshotBorrador?.(fecha, raw, {
                estado: cap.estado,
                detalleSnap: cap.detalleSnap
            });
        });
        if (rawActivo) window.Tk20Draft?.setMuestraActivaClave?.(fecha, rawActivo);
    }

    function prepararDeteccionEnvioTk20Local_() {
        window.Tk20Draft?.guardarMuestraActivaInmediato?.();
        persistirBorradoresCompletasTk20_(elFecha?.value);
        return obtenerMuestrasCompletasTk20ParaEnvio_();
    }

    function asegurarBorradoresAntesEnvioTk20_(lista) {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return;
        window.Tk20Draft?.guardarMuestraActivaInmediato?.();
        const raws = new Set((lista || []).map((item) => String(item?.raw || '').trim()).filter(Boolean));
        obtenerOpcionesMuestraTk20Select_().forEach((raw) => raws.add(raw));
        raws.forEach((raw) => {
            const cap = capturaEstadoMuestraParaEnvioTk20_(raw);
            if (!cap || !window.Tk20Draft?.hayDatosCaptura?.(cap.estado)) return;
            window.Tk20Draft?.snapshotBorrador?.(fecha, raw, {
                estado: cap.estado,
                detalleSnap: cap.detalleSnap
            });
        });
        const rawActivo = String(elMuestra?.value || '').trim();
        if (rawActivo) window.Tk20Draft?.setMuestraActivaClave?.(fecha, rawActivo);
    }

    async function seleccionarMuestraTk20ParaEnviar_(preferida, completas, analisis) {
        const lista = ordenarMuestrasTk20PorEnsayo_(completas || []);
        if (!lista.length) return null;
        const info = analisis || analizarMuestrasTk20DelDia_();
        const exentos = info.ensayosExentos || ensayosExentosSecuenciaTk20_();
        const { huecos: huecosRaw } = detectarHuecosSecuenciaTk20_(lista);
        const huecos = huecosSinExentosTk20_(huecosRaw, exentos);
        const huecosDia = huecosSinExentosTk20_(info.huecosEnDia || [], exentos);
        const secuenciaContinua = huecos.length === 0 && huecosDia.length === 0;

        const opts = {};
        lista.forEach((item) => {
            opts[item.raw] = (item.etiqueta || textoSelectMuestra(item.num_muestra, item.ensayo_numero))
                + ' · contador 0';
        });
        const pref = lista.find((x) => x.raw === preferida)?.raw || lista[lista.length - 1].raw;

        let htmlSecuencia = '<p style="margin:0 0 10px;font-size:13px;color:#64748b;">'
            + 'Elige una muestra o envía <b>todas las listas</b> (contador en <b>0</b>).</p>';
        if (lista.length >= 2 && !secuenciaContinua) {
            const faltan = huecosDia.length ? huecosDia : huecos;
            htmlSecuencia += '<p style="margin:0 0 10px;font-size:13px;color:#b45309;">'
                + 'Hay ensayos sin listos (' + faltan.join(', ')
                + '). Aun así puedes enviar las muestras ya completas.</p>';
        }
        if (info.pendientes?.length) {
            htmlSecuencia += '<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">No listadas (incompletas): '
                + info.pendientes.map((r) => r.etiqueta || r.ensayo_numero).join(', ')
                + '</p>';
        }

        const r = await window.Tk20Swal?.fire?.({
            icon: 'question',
            title: 'TK-2.0 — enviar muestras',
            html: htmlSecuencia,
            input: 'select',
            inputOptions: opts,
            inputValue: pref,
            confirmButtonText: 'Enviar una',
            showDenyButton: lista.length >= 2,
            denyButtonText: 'Enviar todas las listas',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            denyButtonColor: '#1f4f82',
            allowOutsideClick: false
        });
        if (!r) return null;
        if (r.isDenied && lista.length >= 2) return { modo: 'todas', lista };
        if (!r.isConfirmed) return null;
        return { modo: 'una', raw: String(r.value || '').trim() || pref };
    }

    function setBarHabilitada(bar, on) {
        if (!bar) return;
        bar.classList.toggle('is-disabled', !on);
        bar.setAttribute('aria-disabled', on ? 'false' : 'true');
        bar.querySelectorAll('.control-equitativo-btn').forEach((btn) => {
            if (on) {
                btn.disabled = false;
                btn.removeAttribute('disabled');
            } else {
                btn.disabled = true;
                btn.setAttribute('disabled', 'disabled');
            }
        });
    }

    function setCardsWrapHabilitado(wrap, on) {
        if (!wrap) return;
        wrap.classList.toggle('is-disabled', !on);
        wrap.setAttribute('aria-disabled', on ? 'false' : 'true');
    }

    function limpiarCamposCapturaTk20_() {
        if (elResponsable) elResponsable.value = '';
        transporte()?.limpiar?.();
        window.Tk20Control?.setValores?.({});
    }

    function limpiarUiCapturaMuestraTk20_() {
        limpiarCamposCapturaTk20_();
        window.Tk20Body?.limpiarEstadoLocal?.();
        window.Tk20Body?.renderVacio?.();
    }

    function limpiarMetaCampos() {
        limpiarUiCapturaMuestraTk20_();
    }

    function prepararUiNuevaMuestraTk20_() {
        limpiarUiCapturaMuestraTk20_();
        setRegistroHabilitado(false);
    }

    function pintarMetaDesdeDetalle(d) {
        if (!d) {
            limpiarMetaCampos();
            return;
        }
        const resp = String(d.RESPONSABLE_TK || d.RESPONSABLE || '').trim();
        if (elResponsable && resp) elResponsable.value = resp;
        transporte()?.setDesdeDetalle?.(d);
    }

    let registroHabilitadoFlag = false;

    function setRegistroHabilitado(on) {
        registroHabilitadoFlag = !!on;
        const habilitada = registroHabilitadoFlag;
        if (elHoraRow) {
            elHoraRow.classList.toggle('is-disabled', !habilitada);
            elHoraRow.setAttribute('aria-disabled', habilitada ? 'false' : 'true');
        }
        if (elResponsable) {
            if (habilitada) elResponsable.removeAttribute('disabled');
            else elResponsable.setAttribute('disabled', 'disabled');
        }
        transporte()?.setHabilitado?.(habilitada);
        setBarHabilitada(elBarLlegada, habilitada);
        setBarHabilitada(elBarTraslado, habilitada);
        setCardsWrapHabilitado(elCardsLlegada, habilitada);
        setCardsWrapHabilitado(elCardsTraslado, habilitada);
        window.Tk20Body?.renderCards?.();
        actualizarBtnEnviar();
    }

    function restantesPesosEtapa(etapaKey) {
        const card = window.Tk20Body?.getEtapaCard?.(etapaKey);
        if (!card || !window.Tk20Body?.conteoPesosCard) {
            return window.Tk20Fields?.getNumPesosEfectivos?.() || 8;
        }
        return window.Tk20Body.conteoPesosCard(card, etapaKey).rest;
    }

    function pesosCompletosParaEnvio() {
        return restantesPesosEtapa('llegada') === 0 && restantesPesosEtapa('traslado') === 0;
    }

    function actualizarBtnEnviar() {
        if (!elBtnEnviar) return;
        const sel = muestraSeleccionada();
        const tkCompleto = registroCompletoEnServidor();
        const campoListo = campoListoParaTk20();
        const respOk = Boolean(String(elResponsable?.value || '').trim());
        const placaOk = Boolean(String(transporte()?.getPlaca?.() || '').trim());
        const pesosOk = pesosCompletosParaEnvio();
        const activaLista = sel && campoListo && respOk && placaOk && pesosOk && !tkCompleto && !envioEnCurso;
        let hayOtrasListas = false;
        if (!activaLista && sel && !envioEnCurso) {
            try {
                const completas = obtenerMuestrasCompletasTk20ParaEnvio_();
                const listas = obtenerMuestrasListasModalEnvioTk20_();
                hayOtrasListas = unirMuestrasTk20ParaEnvio_([completas, listas]).length > 0;
            } catch (_) { /* ignore */ }
        }
        const puede = activaLista || hayOtrasListas;
        elBtnEnviar.disabled = !puede;
        if (elEnvioBar) elEnvioBar.classList.toggle('is-disabled', !sel || (!campoListo && !hayOtrasListas) || (tkCompleto && !hayOtrasListas));
    }

    function setButtonLoading(loading, texto) {
        if (!elBtnEnviar) return;
        if (loading) {
            if (!elBtnEnviar.dataset.tk2LabelOriginal) {
                elBtnEnviar.dataset.tk2LabelOriginal = elBtnEnviar.textContent || '';
            }
            elBtnEnviar.disabled = true;
            elBtnEnviar.textContent = texto || 'Enviando...';
            elBtnEnviar.classList.add('is-loading');
        } else {
            elBtnEnviar.textContent = elBtnEnviar.dataset.tk2LabelOriginal || 'Enviar registro';
            elBtnEnviar.classList.remove('is-loading');
            envioEnCurso = false;
            actualizarBtnEnviar();
        }
    }

    function buildPayloadEnvioTk20(estadoOverride, selOverride, detalleOverride) {
        window.Tk20Presion?.recalcularTodas?.({ render: false });
        const estado = estadoOverride || window.Tk20Draft?.capturarEstadoUi?.() || {
            responsable: String(elResponsable?.value || '').trim(),
            transporte: transporte()?.getValores?.() || {},
            control: window.Tk20Control?.getValores?.() || {},
            etapas: {
                llegada: window.Tk20Body?.exportEstado?.()?.llegada || null,
                traslado: window.Tk20Body?.exportEstado?.()?.traslado || null
            }
        };
        const fecha = normalizarFechaIso(elFecha?.value || window.Tk20Header?.getFecha?.() || '');
        const sel = selOverride || window.Tk20Header?.ensayoSeleccionado?.()
            || selDesdeRaw_(String(elMuestra?.value || '').trim());
        const raw = sel.raw || String(elMuestra?.value || '').trim();
        const parts = raw.split('|');
        const det = detalleOverride || lastDetalle || window.Tk20Header?.getLastDetalle?.() || null;
        const modoRaw = String(sel.modo_registro || det?.modo_registro || '').trim().toLowerCase();
        const t = estado.transporte || {};
        const payload = {
            mode: 'tk20',
            fecha,
            ensayo_numero: sel.ensayo_numero || parts[1] || '',
            num_muestra: sel.num_muestra || parts[0] || '',
            fecha_inspeccion: fecha,
            responsable: String(estado.responsable || '').trim(),
            placa: String(t.placa || '').trim(),
            guia_remision: String(t.guia || '').trim(),
            control: estado.control || {},
            etapas: estado.etapas || {}
        };
        if (modoRaw === 'acopio' || modoRaw === 'visual') payload.modo_registro = modoRaw;
        return payload;
    }

    async function confirmarTk20EnServidor_(fecha, ensayoNumero, modoRegistro) {
        const fetchDet = window.Tk20Header?.fetchDetalleServidor;
        if (!fecha || !ensayoNumero || typeof fetchDet !== 'function') return false;
        const modo = String(modoRegistro || '').trim().toLowerCase();
        const fetchOpts = (modo === 'acopio' || modo === 'visual') ? { modo_registro: modo } : undefined;
        const esperas = [0, 600, 1400];
        for (let i = 0; i < esperas.length; i++) {
            if (esperas[i] > 0) await new Promise((r) => setTimeout(r, esperas[i]));
            try {
                const r = await fetchDet(fecha, ensayoNumero, fetchOpts);
                if (r?.ok && r.data?.tieneTk20 === true) return true;
            } catch (_) { /* retry */ }
        }
        return false;
    }

    async function ejecutarEnvioTk20Body_(payload, raw, opts) {
        opts = opts || {};
        const apiUrl = String(window.APPS_SCRIPT_API_URL || '').trim();
        if (!apiUrl) {
            window.Tk20Swal?.error?.('Sin servidor', 'Falta APPS_SCRIPT_API_URL en la configuración.');
            return false;
        }

        const fecha = normalizarFechaIso(payload.fecha);
        const rawMuestra = String(raw || '').trim();

        function limpiarTrasEnvioLocal_() {
            window.Tk20Draft?.limpiarTrasEnvioLocal?.(fecha, rawMuestra);
            limpiarUiCapturaMuestraTk20_();
        }

        async function guardarPdfTrasEnvio_() {
            const cap = capturaEstadoMuestraParaEnvioTk20_(rawMuestra)
                || capturaEstadoMuestraParaValidacionTk20_(rawMuestra);
            if (cap && capturaTk20ElegibleHistorialPdf_(cap)) {
                await guardarPdfTk20HistorialTrasEnvio_([cap], fecha);
            }
        }

        persistirBorradoresCompletasTk20_(fecha);

        if (!navigator.onLine || !apiUrl) {
            const encolado = window.Tk20Sync?.encolarTk20Pendiente?.(payload);
            if (encolado?.duplicado) {
                if (!opts.sinToast) {
                    window.Tk20Swal?.info?.('Ya en cola', 'Este TK-2.0 ya está pendiente de envío.');
                }
                return false;
            }
            if (encolado) {
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
                if (!opts.sinLoading) {
                    setButtonLoading(false);
                }
                if (!opts.sinToast) {
                    window.Tk20Swal?.warn?.(
                        'Sin internet',
                        'Quedó en cola y se enviará al volver la conexión.'
                    );
                }
                if (!opts.sinRefresh && navigator.onLine) {
                    await window.Tk20Header?.aplicarExitoEnvioTk20_?.(fecha, rawMuestra);
                }
                return true;
            }
            return false;
        }

        if (!opts.sinLoading) {
            envioEnCurso = true;
            setButtonLoading(true, 'Enviando...');
        }
        try {
            await (window.NetworkSync?.fetchApiPost
                ? window.NetworkSync.fetchApiPost(apiUrl, payload)
                : fetch(apiUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }));
            const confirmado = await confirmarTk20EnServidor_(
                payload.fecha,
                payload.ensayo_numero,
                payload.modo_registro
            );
            if (confirmado) {
                window.Tk20Sync?.marcarColaTk20Enviada_?.(
                    fecha,
                    payload.ensayo_numero,
                    payload.num_muestra
                );
                window.Tk20Header?.actualizarHeaderPendientes?.();
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
                if (!opts.sinLoading) {
                    setButtonLoading(false);
                }
                if (!opts.sinToast) {
                    window.Tk20Swal?.success?.('Enviado', 'TK-2.0 guardado en la planilla.');
                }
                if (!opts.sinRefresh) {
                    await window.Tk20Header?.aplicarExitoEnvioTk20_?.(payload.fecha, rawMuestra);
                }
                return true;
            }
            const encolado = window.Tk20Sync?.encolarTk20Pendiente?.(payload);
            if (encolado && !encolado.duplicado) {
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
            }
            if (!opts.sinToast) {
                window.Tk20Swal?.info?.(
                    'En cola',
                    'POST enviado; se confirmará con la planilla en breve.'
                );
            }
            if (!opts.sinRefresh) {
                await window.Tk20Header?.aplicarExitoEnvioTk20_?.(payload.fecha, rawMuestra);
            }
            return true;
        } catch (err) {
            const encolado = window.Tk20Sync?.encolarTk20Pendiente?.(payload);
            if (encolado && !encolado.duplicado) {
                await guardarPdfTrasEnvio_();
                limpiarTrasEnvioLocal_();
                if (!opts.sinToast) {
                    window.Tk20Swal?.warn?.(
                        'Conexión inestable',
                        'Quedó en cola para reenviar.'
                    );
                }
                return true;
            }
            if (!opts.sinToast) {
                window.Tk20Swal?.error?.('Error', String(err?.message || err || 'No se pudo enviar el registro.'));
            }
            return false;
        } finally {
            if (!opts.sinLoading) {
                setButtonLoading(false);
            }
        }
    }

    async function enviarTk20DesdeCaptura_(cap, opts) {
        if ((!opts?.sinLoading && envioEnCurso) || !cap?.estado) return false;
        const val = validarCompletitudTk20ParaEnvioDesdeEstado_(cap.estado, cap.detalleSnap);
        if (!val.ok) {
            const msg = val.errores[0] || 'Completa todos los datos de TK-2.0 antes de enviar.';
            const etiqueta = textoSelectMuestra(cap.num_muestra, cap.ensayo_numero);
            window.Tk20Header?.setStatus?.(msg, 'warn');
            await window.Tk20Swal?.fire?.({
                icon: 'warning',
                title: etiqueta + ' · datos incompletos',
                text: msg,
                confirmButtonText: 'Entendido'
            });
            return false;
        }
        const fecha = normalizarFechaIso(elFecha?.value);
        const sel = selDesdeRaw_(cap.raw);
        const payload = buildPayloadEnvioTk20(cap.estado, sel, cap.detalleSnap);
        return ejecutarEnvioTk20Body_(payload, cap.raw, opts);
    }

    async function cargarMuestraTk20ParaEnvio_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        const parts = raw.split('|');
        const ensayoNumero = parts[1] || '';
        if (!fecha || !raw || !ensayoNumero) return false;
        const prev = String(elMuestra?.value || '').trim();
        if (prev && prev !== raw) {
            window.Tk20Draft?.snapshotMuestraExplicita?.(fecha, prev);
        }
        if (elMuestra) elMuestra.value = raw;
        window.Tk20Draft?.setMuestraActivaClave?.(fecha, raw);
        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, raw);
        if (borrador?.estado && window.Tk20Draft?.hayDatosCaptura?.(borrador.estado)) {
            if (borrador.detalleSnap) {
                lastDetalle = borrador.detalleSnap;
                pintarMetaDesdeDetalle(borrador.detalleSnap);
            }
            window.Tk20Draft?.aplicarEstado?.(borrador.estado);
            const tkCompleto = registroCompletoEnServidor(borrador.detalleSnap);
            const fundoOk = window.FundoFlujoTk20?.habilitaDesdeDetalle?.(borrador.detalleSnap) === true;
            setRegistroHabilitado(fundoOk && campoListoDesdeDetalleSnap(borrador.detalleSnap) && !tkCompleto);
            return true;
        }
        await window.Tk20Header?.cargarDetalle?.(fecha, ensayoNumero);
        return true;
    }

    async function asegurarCapturaEnvioTk20_(rawMuestra) {
        let cap = capturaEstadoMuestraParaEnvioTk20_(rawMuestra);
        if (cap && muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, rawMuestra)) return cap;
        await cargarMuestraTk20ParaEnvio_(rawMuestra);
        cap = capturaEstadoMuestraParaEnvioTk20_(rawMuestra);
        if (cap && muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, rawMuestra)) return cap;
        return null;
    }

    async function refrescarMuestraTk20ActivaTrasLote_(rawActivo, listaReferencia) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const ordenRef = ordenarMuestrasTk20PorEnsayo_(listaReferencia || []);
        const rawUltimoEnsayo = ordenRef.length ? ordenRef[ordenRef.length - 1].raw : '';
        const raw = String(rawActivo || rawUltimoEnsayo || elMuestra?.value || '').trim();
        if (!fecha || !raw) return;
        const parts = raw.split('|');
        const ensayoNumero = parts[1] || '';
        if (!ensayoNumero) return;
        if (String(elMuestra?.value || '').trim() !== raw && elMuestra) elMuestra.value = raw;
        const borrador = window.Tk20Draft?.leerBorrador?.(fecha, raw);
        if (borrador?.estado && window.Tk20Draft?.hayDatosCaptura?.(borrador.estado)) {
            if (borrador.detalleSnap) {
                lastDetalle = borrador.detalleSnap;
                pintarMetaDesdeDetalle(borrador.detalleSnap);
            }
            window.Tk20Draft?.aplicarEstado?.(borrador.estado);
        } else {
            limpiarUiCapturaMuestraTk20_();
        }
        await window.Tk20Header?.cargarDetalle?.(fecha, ensayoNumero);
    }

    async function enviarTk20MuestraActual_(opts) {
        if (envioEnCurso && !opts?.sinLoading) return false;
        if (!muestraSeleccionada()) {
            window.Tk20Header?.setStatus?.('Selecciona una muestra antes de enviar.', 'warn');
            return false;
        }
        if (registroCompletoEnServidor()) {
            window.Tk20Swal?.info?.('Ya enviado', 'TK-2.0 ya está registrado en la planilla para esta muestra.');
            return false;
        }
        const validacion = validarCompletitudTk20ParaEnvio();
        if (!validacion.ok) {
            const msg = validacion.errores[0] || 'Revisa los datos antes de enviar.';
            window.Tk20Header?.setStatus?.(msg, 'warn');
            await window.Tk20Swal?.fire?.({
                icon: 'warning',
                title: 'Datos incompletos',
                text: msg,
                confirmButtonText: 'Entendido'
            });
            return false;
        }
        const raw = String(elMuestra?.value || '').trim();
        const payload = buildPayloadEnvioTk20();
        return ejecutarEnvioTk20Body_(payload, raw, opts);
    }

    async function enviarTk20MuestrasEnSecuencia_(lista) {
        const ordenadasAsc = ordenarMuestrasTk20PorEnsayo_(lista || []);
        if (!ordenadasAsc.length) return false;
        // Envía solo las listas (candidatas). No bloquea por huecos de ensayos incompletos.
        const rawActivo = String(elMuestra?.value || '').trim();
        asegurarBorradoresAntesEnvioTk20_(lista);
        persistirBorradoresCompletasTk20_(elFecha?.value);
        const ordenadas = ordenadasAsc.slice().reverse();
        const capturas = [];
        for (const item of ordenadas) {
            const cap = await asegurarCapturaEnvioTk20_(item.raw);
            if (!cap || !muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, item.raw)) {
                const etiqueta = item.etiqueta || textoSelectMuestra(item.num_muestra, item.ensayo_numero);
                window.Tk20Swal?.warn?.(
                    'Datos no disponibles',
                    'No hay datos guardados para ' + (etiqueta || 'la muestra') + '. Ábrela, verifica el 0 verde y reintenta.'
                );
                await refrescarMuestraTk20ActivaTrasLote_(rawActivo, ordenadasAsc);
                return false;
            }
            capturas.push({ item, cap });
        }

        const optsLote = { sinLoading: true, sinToast: true, sinRefresh: true };
        envioEnCurso = true;
        setButtonLoading(true, 'Enviando muestras...');
        let enviados = 0;
        try {
            for (const { cap } of capturas) {
                const ok = await enviarTk20DesdeCaptura_(cap, optsLote);
                if (!ok) {
                    if (enviados > 0) {
                        window.Tk20Swal?.info?.(
                            'Envío parcial',
                            enviados + ' muestra(s) enviada(s); revisa la siguiente.'
                        );
                    }
                    await refrescarMuestraTk20ActivaTrasLote_(rawActivo, ordenadasAsc);
                    return false;
                }
                enviados++;
            }
        } finally {
            envioEnCurso = false;
            setButtonLoading(false);
        }

        if (enviados > 0) {
            const fechaLote = normalizarFechaIso(elFecha?.value);
            capturas.forEach(({ cap }) => {
                window.Tk20Sync?.marcarColaTk20Enviada_?.(fechaLote, cap.ensayo_numero, cap.num_muestra);
            });
            window.Tk20Header?.actualizarHeaderPendientes?.();
            await guardarPdfTk20HistorialTrasEnvio_(
                capturas.map(({ item, cap }) => ({
                    fecha: fechaLote,
                    num_muestra: cap.num_muestra,
                    ensayo_numero: cap.ensayo_numero,
                    raw: item.raw,
                    estado: cap.estado,
                    detalle: cap.detalleSnap || null
                })),
                fechaLote
            );
            if (navigator.onLine) {
                await window.Tk20Header?.cargarMuestrasPorFecha?.(fechaLote);
            }
            const enColaLote = !navigator.onLine;
            window.Tk20Swal?.[enColaLote ? 'warn' : 'success']?.(
                enColaLote ? 'En cola' : 'Enviado',
                enviados + ' muestra(s) TK-2.0 '
                    + (enColaLote ? 'quedaron en cola para enviar.' : 'guardadas en la planilla.')
            );
            await refrescarMuestraTk20ActivaTrasLote_(rawActivo, ordenadasAsc);
        }
        return enviados > 0;
    }

    async function guardarRegistroYEnviarDesdePantallaTk20_() {
        if (envioEnCurso) return;

        let validandoUi = true;
        setButtonLoading(true, 'Validando…');
        const liberarValidacionUi = () => {
            if (!validandoUi) return;
            validandoUi = false;
            if (!envioEnCurso) setButtonLoading(false);
        };

        try {
            window.Tk20Draft?.persistirSoloLocal?.();
            const completas = prepararDeteccionEnvioTk20Local_();
            const analisis = analizarMuestrasTk20DelDia_();
            const candidatas = resolverCandidatasModalEnvioTk20_(completas);
            asegurarBorradoresAntesEnvioTk20_(candidatas);
            const rawActivo = String(elMuestra?.value || '').trim();

            if (analisis.pendientes.length && candidatas.length) {
                liberarValidacionUi();
                const ok = await confirmarContinuarEnvioConPendientesTk20_(analisis);
                if (!ok) return;
                setButtonLoading(true, 'Validando…');
                validandoUi = true;
            }

            if (!candidatas.length) {
                if (!muestraSeleccionada()) {
                    window.Tk20Header?.setStatus?.('Selecciona una muestra antes de enviar.', 'warn');
                    return;
                }
                if (registroCompletoEnServidor()) {
                    window.Tk20Swal?.info?.(
                        'Ya en planilla',
                        'TK-2.0 ya está completo en el servidor. Selecciona otra muestra pendiente.'
                    );
                    return;
                }
                validandoUi = false;
                await enviarTk20MuestraActual_();
                return;
            }

            // Siempre abrir modal: elegir una o (si hay 2+) enviar todas las listas.
            liberarValidacionUi();
            const plan = await seleccionarMuestraTk20ParaEnviar_(rawActivo, candidatas, analisis);
            if (!plan) return;
            validandoUi = false;

            if (plan.modo === 'todas') {
                await enviarTk20MuestrasEnSecuencia_(plan.lista);
                return;
            }

            const raw = String(plan.raw || rawActivo).trim();
            const cap = capturaEstadoMuestraParaValidacionTk20_(raw);
            if (cap && muestraTk20PendienteDeEnvio_(cap.estado, cap.detalleSnap, raw)) {
                if (raw !== rawActivo) {
                    const ok = await enviarTk20DesdeCaptura_(cap);
                    if (ok) await refrescarMuestraTk20ActivaTrasLote_(rawActivo, candidatas);
                    return;
                }
                await enviarTk20MuestraActual_();
                return;
            }
            if (raw && raw !== rawActivo) {
                await cargarMuestraTk20ParaEnvio_(raw);
            }
            await enviarTk20MuestraActual_();
        } finally {
            liberarValidacionUi();
            setButtonLoading(false);
        }
    }

    function validarCompletitudTk20ParaEnvio() {
        const errores = [];
        const resp = String(elResponsable?.value || '').trim();
        const placa = String(transporte()?.getPlaca?.() || '').trim();
        if (!resp) errores.push('Falta responsable.');
        if (!placa) errores.push('Falta placa del vehículo.');
        // Enviar progresivo: no exige completar los 6 pesos de cada etapa.
        const pesoErr = window.Tk20Pesos?.validarPesosEstado?.(
            window.Tk20Draft?.capturarEstadoUi?.() || {},
            lastDetalle
        ) || [];
        if (pesoErr.length) errores.push(...pesoErr);
        return { ok: errores.length === 0, errores };
    }

    function capturaTk20ElegibleHistorialPdf_(cap) {
        if (!cap?.estado) return false;
        return validarCompletitudTk20ParaEnvioDesdeEstado_(cap.estado, cap.detalleSnap).ok;
    }

    async function guardarPdfTk20HistorialTrasEnvio_(capturas, fechaIso) {
        if (!window.HistPdfEnvio || typeof window.HistPdfEnvio.guardarTk20 !== 'function') return false;
        const lista = (Array.isArray(capturas) ? capturas : []).filter(capturaTk20ElegibleHistorialPdf_);
        if (!lista.length) return false;
        try {
            const ok = await window.HistPdfEnvio.guardarTk20(lista, fechaIso);
            if (!ok) {
                console.warn('[HistPDF] PDF TK-2.0 no verificado; reintento…');
                return !!(await window.HistPdfEnvio.guardarTk20(lista, fechaIso));
            }
            return true;
        } catch (err) {
            console.warn('[HistPDF] No se pudo guardar PDF TK-2.0:', err);
            try {
                return !!(await window.HistPdfEnvio.guardarTk20(lista, fechaIso));
            } catch (err2) {
                console.warn('[HistPDF] Reintento PDF TK-2.0 falló:', err2);
                return false;
            }
        }
    }

    function muestraTk20TieneDatosPdfManual_(raw) {
        if (muestraTk20YaCompletaEnServidor_(raw)) return false;
        const cap = capturaEstadoMuestraParaValidacionTk20_(raw);
        return !!(cap && window.Tk20Draft?.hayDatosCaptura?.(cap.estado));
    }

    function muestraTk20ElegiblePdfManual_(raw) {
        if (!muestraTk20TieneDatosPdfManual_(raw)) return false;
        const cap = capturaEstadoMuestraParaValidacionTk20_(raw);
        if (!cap) return false;
        const rest = restantesDesdeEstadoTk20_(cap.estado);
        return rest === 0 && validarCompletitudTk20ParaEnvioDesdeEstado_(cap.estado, cap.detalleSnap).ok;
    }

    function muestrasPendientesPdfTk20DelDia_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        return recogerCandidatosMuestrasTk20DelDia_(fecha).filter(muestraTk20ElegiblePdfManual_);
    }

    function muestrasConDatosPdfManualTk20DelDia_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        return recogerCandidatosMuestrasTk20DelDia_(fecha).filter(muestraTk20TieneDatosPdfManual_);
    }

    function prepararCapturasPdfTk20DelDia_() {
        window.Tk20Draft?.persistirSoloLocal?.();
        persistirBorradoresCompletasTk20_(elFecha?.value);
    }

    function onDetalle(ev) {
        lastDetalle = ev?.detail?.data || null;
        if (!lastDetalle) {
            limpiarMetaCampos();
            setRegistroHabilitado(false);
            return;
        }
        const tkCompleto = registroCompletoEnServidor(lastDetalle);
        if (tkCompleto) {
            limpiarCamposCapturaTk20_();
            setRegistroHabilitado(false);
            actualizarBtnEnviar();
            return;
        }
        limpiarCamposCapturaTk20_();
        const campoListo = campoListoParaTk20(lastDetalle);
        const fundoOk = window.FundoFlujoTk20?.habilitaDesdeDetalle?.(lastDetalle) === true;
        setRegistroHabilitado(fundoOk && campoListo);
    }

    elResponsable?.addEventListener('input', actualizarBtnEnviar);
    elResponsable?.addEventListener('change', actualizarBtnEnviar);
    elBtnEnviar?.addEventListener('click', () => void guardarRegistroYEnviarDesdePantallaTk20_());

    window.addEventListener('tk20:detalle', onDetalle);
    window.addEventListener('tk20:estado-cambiado', actualizarBtnEnviar);

    setRegistroHabilitado(false);
    actualizarBtnEnviar();

    window.Tk20Envio = {
        getResponsable: () => String(elResponsable?.value || '').trim(),
        getTransporte: () => transporte()?.getValores?.() || {},
        actualizarBtnEnviar,
        setRegistroHabilitado,
        isRegistroHabilitado: () => registroHabilitadoFlag,
        limpiarUiCapturaMuestraTk20_,
        limpiarCamposCapturaTk20_,
        prepararUiNuevaMuestraTk20_,
        pintarMetaDesdeDetalle,
        validarCompletitudTk20ParaEnvio,
        campoListoParaTk20,
        registroCompletoEnServidor,
        muestraTk20YaCompletaEnServidor_,
        capturaEstadoMuestraParaValidacionTk20_,
        capturaTk20ElegibleHistorialPdf_,
        guardarPdfTk20HistorialTrasEnvio_,
        muestrasPendientesPdfTk20DelDia_,
        muestrasConDatosPdfManualTk20DelDia_,
        prepararCapturasPdfTk20DelDia_
    };
}());
