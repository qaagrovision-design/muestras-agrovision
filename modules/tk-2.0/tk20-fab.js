/** TK-2.0: menú flotante (FAB), fecha ring y datos para PDF. */
(function initTk20Fab() {
    const F = window.Tk20Fields;
    const elFabMenu = document.getElementById('fab-menu-tk20');
    const elFabOptionsBtn = document.getElementById('fab-options-btn-tk20');
    const elFabPdf = document.getElementById('fab-tk20-pdf');
    const elFechaRingWidget = document.getElementById('tk20-fecha-ring-widget');
    const elFechaRingCircle = document.getElementById('tk20-fecha-ring-circle');
    const elFechaRingPopover = document.getElementById('tk20-fecha-ring-popover');
    const elMuestra = document.getElementById('mptk-muestra');

    function establecerMenuFlotanteTk20(open) {
        if (!elFabMenu || !elFabOptionsBtn) return;
        elFabMenu.classList.toggle('is-open', open);
        elFabOptionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function mensajeFechaRingTk20(d) {
        const mesLargo = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d);
        const dia = d.getDate();
        const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        if (dia <= 7) {
            return mesLargo + ' recién comenzó — día ' + dia + ' de ' + diasMes;
        }
        return 'Estamos en ' + mesLargo + ' — día ' + dia + ' de ' + diasMes;
    }

    function actualizarArcoFechaRingTk20(d) {
        if (!elFechaRingCircle) return;
        const dia = d.getDate();
        const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const progreso = Math.min(1, Math.max(0, dia / diasMes));
        const arcoDeg = Math.round(70 * progreso);
        const corte = 280 - arcoDeg;
        elFechaRingCircle.style.background = 'conic-gradient(from 210deg, rgba(22, 76, 124, 0.18) 0deg '
            + corte + 'deg, rgba(29, 78, 137, 0.92) ' + corte + 'deg 360deg)';
    }

    function actualizarFechaRingTk20() {
        const dayEl = document.getElementById('fecha-ring-day-tk20');
        const monthEl = document.getElementById('fecha-ring-month-tk20');
        if (!dayEl || !monthEl) return;
        const d = new Date();
        dayEl.textContent = String(d.getDate()).padStart(2, '0');
        const mes = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '');
        monthEl.textContent = (mes + ' ' + d.getFullYear()).toUpperCase();
        const msg = mensajeFechaRingTk20(d);
        if (elFechaRingPopover && !elFechaRingWidget?.classList.contains('is-popover-open')) {
            elFechaRingPopover.textContent = msg;
        }
        if (elFechaRingWidget) elFechaRingWidget.title = msg;
        actualizarArcoFechaRingTk20(d);
    }

    function togglePopoverFechaRingTk20(forceOpen) {
        if (!elFechaRingWidget || !elFechaRingPopover) return;
        const abrir = forceOpen === true
            ? true
            : (forceOpen === false ? false : !elFechaRingWidget.classList.contains('is-popover-open'));
        const d = new Date();
        elFechaRingPopover.textContent = mensajeFechaRingTk20(d);
        elFechaRingWidget.classList.toggle('is-popover-open', abrir);
        elFechaRingPopover.hidden = !abrir;
    }

    function formatoFechaPdf(iso) {
        const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return String(iso || '').trim();
        return m[3] + '-' + m[2] + '-' + m[1];
    }

    function textoRotuloMuestra(raw, detalle) {
        const parts = String(raw || '').split('|');
        const ensayo = String(parts[1] || detalle?.ENSAYO_NUMERO || '').trim();
        if (ensayo) return 'Ensayo ' + ensayo;
        return String(detalle?.ROTULO || '').trim();
    }

    function trazabilidadDesdeDetalle(d) {
        return trazabilidadParaPdf(d, null);
    }

    function acopioEtiquetaPdf_(raw) {
        const s = String(raw || '').trim();
        if (!s) return '';
        const tail = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1).trim() : s;
        const m = /^acopio\s+(\d+)$/i.exec(tail);
        if (m) return 'Acopio ' + m[1];
        if (/^Acopio\s+\d+$/i.test(tail)) return tail.replace(/^acopio/i, 'Acopio');
        return tail;
    }

    function acopioTextoPdf(detalle, transporte) {
        const acSel = String(transporte?.acopio || '').trim();
        if (acSel) return acopioEtiquetaPdf_(acSel);
        return acopioEtiquetaPdf_(detalle?.TRAZ_ACOPIO || '');
    }

    function trazabilidadParaPdf(detalle, transporte) {
        if (!detalle && !transporte) return '';
        const etapa = String(detalle?.TRAZ_ETAPA || '').trim();
        const campo = String(detalle?.TRAZ_CAMPO || '').trim();
        const turno = String(detalle?.TRAZ_TURNO || detalle?.TRAZ_LIBRE || '').trim();
        const traz = [etapa, campo, turno].filter(Boolean).join('-');
        const acopio = acopioTextoPdf(detalle, transporte);
        if (traz && acopio) return traz + ' / ' + acopio;
        return traz || acopio;
    }

    function mapEtapaPdf(etapa, controlVals, card) {
        const F = window.Tk20Fields;
        if (!F) return {};
        const t = F.tempCampos(etapa);
        const h = F.humCampos(etapa);
        const p = F.presionVaporCampos(etapa);
        const pres = card?.presion || {};
        return {
            hora: String(card?.horaRegistro || '').trim(),
            tExt: String(controlVals?.[t[0]?.key] || '').trim(),
            tAcopio: String(controlVals?.[t[1]?.key] || '').trim(),
            tVeh: String(controlVals?.[t[2]?.key] || '').trim(),
            tPulpa: String(controlVals?.[t[3]?.key] || '').trim(),
            hrExt: String(controlVals?.[h[0]?.key] || '').trim(),
            hrAcopio: String(controlVals?.[h[1]?.key] || '').trim(),
            hrVeh: String(controlVals?.[h[2]?.key] || '').trim(),
            presion: {
                ext: String(pres[p[0]?.key] || '').trim(),
                acopio: String(pres[p[1]?.key] || '').trim(),
                veh: String(pres[p[2]?.key] || '').trim(),
                pulpa: String(pres[p[3]?.key] || '').trim()
            }
        };
    }

    function pesoDisplay(v) {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return '';
        return String(Math.round(n * 10) / 10);
    }

    function hayDatosMinimosPdf(datos) {
        const filas = datos?.filas || [];
        const tienePeso = filas.some((f) => pesoDisplay(f.pesoLlegada) || pesoDisplay(f.pesoTraslado));
        const lleg = datos?.llegada || {};
        const tras = datos?.traslado || {};
        const presL = datos?.presionLlegada || {};
        const presT = datos?.presionTraslado || {};
        const tieneControl = Boolean(
            lleg.hora || tras.hora
            || lleg.tExt || lleg.tAcopio || lleg.tVeh || lleg.tPulpa
            || tras.tExt || tras.tAcopio || tras.tVeh || tras.tPulpa
            || lleg.hrExt || lleg.hrAcopio || lleg.hrVeh
            || tras.hrExt || tras.hrAcopio || tras.hrVeh
            || presL.ext || presL.acopio || presL.veh || presL.pulpa
            || presT.ext || presT.acopio || presT.veh || presT.pulpa
        );
        return tienePeso || tieneControl;
    }

    function leerEtapaParaPdf(etapaKey, etapaEstado) {
        const card = window.Tk20Body?.getEtapaCard?.(etapaKey);
        const base = etapaEstado && typeof etapaEstado === 'object' ? etapaEstado : {};
        if (!card && !base.pesos && !base.presion) return base;
        return {
            pesos: Object.assign({}, card?.pesos || {}, base.pesos || {}),
            presion: Object.assign({}, card?.presion || {}, base.presion || {}),
            observacion: String(base.observacion || card?.observacion || '').trim(),
            horaRegistro: String(base.horaRegistro || card?.horaRegistro || '').trim()
        };
    }

    function leerEstadoCompletoParaPdf() {
        const base = window.Tk20Draft?.capturarEstadoUi?.() || {
            responsable: window.Tk20Envio?.getResponsable?.() || '',
            transporte: window.Tk20Transporte?.getValores?.() || {},
            control: window.Tk20Control?.getValores?.() || {},
            etapas: { llegada: null, traslado: null }
        };
        return {
            responsable: base.responsable,
            transporte: base.transporte,
            control: base.control,
            etapas: {
                llegada: leerEtapaParaPdf('llegada', base.etapas?.llegada),
                traslado: leerEtapaParaPdf('traslado', base.etapas?.traslado)
            }
        };
    }

    function mapEtapaPdfFromEstado(etapa, controlVals, etapaState) {
        return mapEtapaPdf(etapa, controlVals, {
            horaRegistro: etapaState?.horaRegistro,
            presion: etapaState?.presion || {}
        });
    }

    function construirDatosPdfTk20DesdeEstado(fechaIso, raw, detalle, estado) {
        const F = window.Tk20Fields;
        if (!F || !raw) return null;
        window.Tk20Presion?.recalcularTodas?.({ render: false, control: estado?.control || {} });
        const etapas = estado?.etapas || {};
        const transporte = estado?.transporte || {};
        const controlVals = estado?.control || {};
        const cardLlegada = leerEtapaParaPdf('llegada', etapas.llegada);
        const cardTraslado = leerEtapaParaPdf('traslado', etapas.traslado);
        const llegada = mapEtapaPdfFromEstado('llegada', controlVals, cardLlegada);
        const traslado = mapEtapaPdfFromEstado('traslado', controlVals, cardTraslado);
        const filas = [];
        for (let i = 1; i <= (F.getNumPesosEfectivos?.() || F.NUM_CLAMSHELLS || 8); i++) {
            filas.push({
                num: i,
                pesoLlegada: pesoDisplay(cardLlegada?.pesos?.[F.peso('llegada', i)]),
                pesoTraslado: pesoDisplay(cardTraslado?.pesos?.[F.peso('traslado', i)])
            });
        }
        const obs = [cardLlegada?.observacion, cardTraslado?.observacion]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(' / ');
        const parts = String(raw).split('|');
        const datos = {
            codigo: 'PE-F-CPS-312',
            version: '01',
            tituloHoja: 'FORMATO MEDICIÓN DE TIEMPOS, TEMPERATURAS, HUMEDAD RELATIVA Y PESOS EN UNIDADES - ARÁNDANO',
            fecha: formatoFechaPdf(fechaIso),
            ensayo: parts[1] || '',
            ensayo_numero: parts[1] || '',
            num_muestra: parts[0] || '',
            meta: {
                fecha: formatoFechaPdf(fechaIso),
                trazabilidad: trazabilidadParaPdf(detalle, transporte),
                responsable: String(estado?.responsable || detalle?.RESPONSABLE_TK || detalle?.RESPONSABLE || '').trim(),
                guia: String(transporte.guia || detalle?.GUIA_REMISION || '').trim(),
                rotulo: textoRotuloMuestra(raw, detalle),
                placa: String(transporte.placa || detalle?.PLACA_VEHICULO || '').trim(),
                variedad: String(detalle?.VARIEDAD || '').trim(),
                fundo: String(detalle?.FUNDO || '').trim()
            },
            llegada,
            traslado,
            presionLlegada: llegada.presion || {},
            presionTraslado: traslado.presion || {},
            filas,
            observaciones: obs
        };
        return hayDatosMinimosPdf(datos) ? datos : null;
    }

    function construirDatosPdfTk20DesdeUi() {
        const raw = window.Tk20Header?.getMuestraRaw?.() || String(elMuestra?.value || '').trim();
        if (!raw) throw new Error('Selecciona una muestra antes de generar el PDF.');
        const detalle = window.Tk20Header?.getLastDetalle?.() || null;
        const fechaIso = window.Tk20Header?.getFecha?.() || '';
        const estado = leerEstadoCompletoParaPdf();
        const datos = construirDatosPdfTk20DesdeEstado(fechaIso, raw, detalle, estado);
        if (!datos) {
            throw new Error('Captura al menos un peso o control (T°, HR, presión) antes de generar el PDF.');
        }
        return datos;
    }

    async function sincronizarTk20DesdeFab() {
        establecerMenuFlotanteTk20(false);
        if (typeof window.actualizarAppCompletoDesdeFab === 'function') {
            await window.actualizarAppCompletoDesdeFab();
        }
        await window.Tk20Sync?.sincronizarPendientesTk20?.();
        const fecha = window.Tk20Header?.getFecha?.();
        if (fecha && window.Tk20Header?.cargarMuestrasPorFecha) {
            await window.Tk20Header.cargarMuestrasPorFecha(fecha);
        }
    }

    async function borrarCacheTk20() {
        establecerMenuFlotanteTk20(false);
        if (window.Swal) {
            const r = await Swal.fire({
                icon: 'warning',
                title: '¿Borrar datos locales TK-2.0?',
                text: 'Recarga la app. No borra la planilla en Google.',
                showCancelButton: true,
                confirmButtonText: 'Borrar y recargar',
                cancelButtonText: 'Cancelar'
            });
            if (!r.isConfirmed) return;
        }
        try {
            localStorage.removeItem('mptk_formato_registro_v1');
            window.Tk20Draft?.limpiarTodo?.();
        } catch (_) { /* ignore */ }
        location.reload();
    }

    function keyEtapa(etapa, suffix) {
        if (!F) return '';
        return F.prefijoEtapa(etapa) + '_' + suffix;
    }

    /** Valores demo por etapa: T°, HR, presión y hora (simula captura proceso a proceso). */
    const DEMO_POR_ETAPA = {
        llegada: {
            hora: '08:30',
            tempHum: {
                t_amb_ext: '32.4',
                t_amb_acopio: '30.9',
                t_amb_veh: '22.0',
                t_pulpa: '32.2',
                hr_ext: '47.4',
                hr_acopio: '49.5',
                hr_veh: '68.0'
            },
            pesoInicio: 60
        },
        traslado: {
            hora: '09:15',
            tempHum: {
                t_amb_ext: '33.3',
                t_amb_acopio: '31.9',
                t_amb_veh: '21.6',
                t_pulpa: '30.0',
                hr_ext: '46.0',
                hr_acopio: '49.0',
                hr_veh: '69.0'
            },
            pesoInicio: 59
        }
    };

    function controlesDesdeDemoEtapa(etapa, tempHum) {
        const ctrl = {};
        if (!F || !tempHum) return ctrl;
        Object.keys(tempHum).forEach((suffix) => {
            ctrl[keyEtapa(etapa, suffix)] = tempHum[suffix];
        });
        return ctrl;
    }

    function llenarPresionEtapa(card, etapa, presionVals) {
        if (!card || !F || !presionVals) return;
        card.presion = card.presion || F.presionVaciosEtapa(etapa);
        Object.keys(presionVals).forEach((suffix) => {
            card.presion[keyEtapa(etapa, suffix)] = presionVals[suffix];
        });
    }

    /** 8 pesos en gramos, desde `inicio` hacia abajo (≤ 60 g). */
    function llenarPesosEtapa(card, etapa, inicio) {
        if (!card || !F) return;
        const max = Math.min(60, Number(inicio) || 60);
        for (let i = 1; i <= (F.getNumPesosEfectivos?.() || F.NUM_CLAMSHELLS || 8); i++) {
            card.pesos[F.peso(etapa, i)] = max - (i - 1);
        }
    }

    function llenarDemoEtapa(etapaKey, cfg) {
        const card = window.Tk20Body?.getEtapaCard?.(etapaKey);
        if (!card || !cfg) return {};
        card.horaRegistro = cfg.hora || '';
        llenarPesosEtapa(card, etapaKey, cfg.pesoInicio);
        return controlesDesdeDemoEtapa(etapaKey, cfg.tempHum);
    }

    function aplicarDemoTk20EnMuestraActiva_(sel) {
        window.Tk20Envio?.limpiarUiCapturaMuestraTk20_?.();
        window.Tk20Envio?.setRegistroHabilitado?.(true);
        const elResp = document.getElementById('tk2_responsable');
        if (elResp) elResp.value = 'Antony Siasquén';
        window.Tk20Transporte?.setDesdeDetalle?.({
            ...(window.Tk20Header?.getLastDetalle?.() || {}),
            PLACA_VEHICULO: 'BMH-843',
            GUIA_REMISION: '208353',
            TRAZ_ACOPIO: 'Acopio 10'
        });
        const ctrlLlegada = llenarDemoEtapa('llegada', DEMO_POR_ETAPA.llegada);
        const ctrlTraslado = llenarDemoEtapa('traslado', DEMO_POR_ETAPA.traslado);
        window.Tk20Control?.setValores?.({ ...ctrlLlegada, ...ctrlTraslado });
        window.Tk20Presion?.recalcularTodas?.({ render: true });
        window.Tk20Control?.setBarDesbloqueada?.(document.getElementById('tk2_control_bar_llegada'));
        window.Tk20Control?.setBarDesbloqueada?.(document.getElementById('tk2_control_bar_traslado'));
        const cardL = window.Tk20Body?.getEtapaCard?.('llegada');
        if (cardL && F) {
            cardL.observacion = 'Demo llegada acopio — muestra OK';
        }
        window.Tk20Body?.renderCards?.();
        window.Tk20Envio?.actualizarBtnEnviar?.();
        window.Tk20Draft?.guardarMuestraActivaInmediato?.();
        return {
            etiqueta: textoSelectMuestra(sel.num_muestra, sel.ensayo_numero),
            ensayo: sel.ensayo_numero
        };
    }

    function llenarDemoTk20() {
        establecerMenuFlotanteTk20(false);
        const raw = window.Tk20Header?.getMuestraRaw?.() || String(elMuestra?.value || '').trim();
        if (!raw) {
            window.Tk20Swal?.info?.('Seleccionar muestra', 'Elige una muestra en el selector antes de cargar demo.');
            return;
        }
        const sel = window.Tk20Header?.ensayoSeleccionado?.() || { num_muestra: '', ensayo_numero: '' };
        if (!sel.ensayo_numero) {
            window.Tk20Swal?.info?.('Seleccionar muestra', 'Espera a que cargue la muestra en el selector.');
            return;
        }
        const detalle = window.Tk20Header?.getLastDetalle?.() || null;
        if (!detalle) {
            window.Tk20Swal?.info?.('Espera el detalle', 'Carga el detalle de la muestra (planilla) antes de simular.');
            return;
        }
        if (!window.FundoFlujoTk20?.habilitaDesdeDetalle?.(detalle)) {
            window.Tk20Swal?.warn?.(
                'Fundo no habilitado',
                window.FundoFlujoTk20?.mensajeFundoNoHabilitado?.(detalle) || 'TK-2.0 solo para fundo A9.'
            );
            return;
        }
        if (detalle.tieneTk20 === true) {
            window.Tk20Swal?.info?.('TK-2.0 completo', 'Esta muestra ya tiene TK-2.0 en la planilla.');
            return;
        }
        if (window.Tk20Envio?.campoListoParaTk20?.(detalle) === false) {
            window.Tk20Swal?.warn?.('Campo incompleto', window.MensajesFlujo?.campoIncompletoCorto?.(detalle)
                || 'Termina y envía Campo o Acopio en esta muestra antes de simular.');
            return;
        }
        const info = aplicarDemoTk20EnMuestraActiva_(sel);
        const validacion = window.Tk20Envio?.validarCompletitudTk20ParaEnvio?.() || { ok: false, errores: [] };
        if (!validacion.ok) {
            window.Tk20Header?.setStatus?.(
                'La simulación no pasó validación: ' + (validacion.errores[0] || 'revisa los datos.'),
                'warn'
            );
            window.Tk20Swal?.warn?.('Simulación incompleta', validacion.errores[0] || 'Revisa los datos.');
            return;
        }
        window.Tk20Header?.setStatus?.('', '');
        window.Tk20Swal?.success?.(
            'Datos de prueba',
            info.etiqueta + ' (muestra ' + (info.ensayo || '—') + '): demo listo solo en esta muestra.'
        );
    }

    elFabOptionsBtn?.addEventListener('click', () => {
        establecerMenuFlotanteTk20(!elFabMenu?.classList.contains('is-open'));
    });

    document.addEventListener('click', (e) => {
        if (elFabMenu && !elFabMenu.contains(e.target)) establecerMenuFlotanteTk20(false);
    });

    document.getElementById('fab-tk20-sync')?.addEventListener('click', () => { void sincronizarTk20DesdeFab(); });
    document.getElementById('fab-tk20-borrar')?.addEventListener('click', () => { void borrarCacheTk20(); });
    document.getElementById('fab-tk20-demo')?.addEventListener('click', llenarDemoTk20);

    elFechaRingWidget?.addEventListener('click', () => togglePopoverFechaRingTk20());
    elFechaRingWidget?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            togglePopoverFechaRingTk20();
        }
    });
    document.addEventListener('click', (ev) => {
        if (!elFechaRingWidget?.contains(ev.target)) togglePopoverFechaRingTk20(false);
    });

    function textoSelectMuestra(num, en) {
        const n = String(num || '').trim();
        const e = String(en || '').trim();
        if (n && e) return n + ' - ' + e + ' muestra';
        return n || e;
    }

    window.obtenerDatosPdfTk20 = function obtenerDatosPdfTk20() {
        window.Tk20Envio?.prepararCapturasPdfTk20DelDia?.();
        const fechaIso = window.Tk20Header?.getFecha?.() || '';
        const rawActivo = window.Tk20Header?.getMuestraRaw?.() || String(elMuestra?.value || '').trim();
        const activoYaEnPlanilla = rawActivo && window.Tk20Envio?.muestraTk20YaCompletaEnServidor_?.(rawActivo);

        let raws = window.Tk20Envio?.muestrasPendientesPdfTk20DelDia_?.() || [];
        if (!raws.length) {
            raws = window.Tk20Envio?.muestrasConDatosPdfManualTk20DelDia_?.() || [];
        }
        const seen = new Set();
        const items = [];
        raws.forEach((raw) => {
            const r = String(raw || '').trim();
            if (!r || seen.has(r)) return;
            seen.add(r);
            const parts = r.split('|');
            items.push({
                raw: r,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || ''
            });
        });
        if (rawActivo && !activoYaEnPlanilla && !seen.has(rawActivo)) {
            const capFn = window.Tk20Envio?.capturaEstadoMuestraParaValidacionTk20_;
            const cap = typeof capFn === 'function' ? capFn(rawActivo) : null;
            if (cap && window.Tk20Draft?.hayDatosCaptura?.(cap.estado)) {
                const parts = rawActivo.split('|');
                items.push({
                    raw: rawActivo,
                    num_muestra: parts[0] || '',
                    ensayo_numero: parts[1] || ''
                });
            }
        }
        if (!items.length) {
            if (activoYaEnPlanilla) {
                throw new Error(
                    'La muestra seleccionada ya está en la planilla. '
                    + 'Selecciona otra muestra y captura datos para un PDF nuevo.'
                );
            }
            throw new Error('Selecciona una muestra y captura datos antes de generar el PDF.');
        }

        const muestras = [];
        items.forEach((item) => {
            const cap = window.Tk20Envio?.capturaEstadoMuestraParaValidacionTk20_?.(item.raw);
            if (!cap || !window.Tk20Draft?.hayDatosCaptura?.(cap.estado)) return;
            const datos = construirDatosPdfTk20DesdeEstado(
                fechaIso,
                item.raw,
                cap.detalleSnap || window.Tk20Header?.getLastDetalle?.(),
                cap.estado
            );
            if (datos) muestras.push(datos);
        });
        if (!muestras.length) {
            throw new Error('Captura al menos un peso o control (T°, HR, presión) antes de generar el PDF.');
        }
        return { muestras, muestrasTitulo: muestras.slice() };
    };

    window.obtenerDatosPdfTk20ParaCapturas = function obtenerDatosPdfTk20ParaCapturas(capturas) {
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        const muestras = [];
        lista.forEach((c) => {
            const raw = String(c.raw || '').trim()
                || (c.num_muestra && c.ensayo_numero ? (c.num_muestra + '|' + c.ensayo_numero) : '');
            const fechaRaw = String(c.fecha || '').trim();
            const fechaIso = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)
                ? fechaRaw
                : (window.Tk20Header?.getFecha?.() || '');
            const datos = construirDatosPdfTk20DesdeEstado(
                fechaIso,
                raw,
                c.detalle || c.detalleSnap || null,
                c.estado
            );
            if (datos) muestras.push(datos);
        });
        if (!muestras.length) {
            throw new Error('Captura al menos un peso o control (T°, HR, presión) antes de generar el PDF.');
        }
        return { muestras, muestrasTitulo: muestras.slice() };
    };

    window.establecerMenuFlotanteTk20 = establecerMenuFlotanteTk20;
    window.fabIniciarRegistroTk20 = llenarDemoTk20;

    actualizarFechaRingTk20();
    if (window.lucide?.createIcons) window.lucide.createIcons();
}());
