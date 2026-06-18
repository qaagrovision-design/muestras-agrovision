(function initPackingApp() {
    const API_URL = String(window.APPS_SCRIPT_API_URL || '').trim();
    const SYNC_QUEUE_KEY = 'tiempos-sync-queue-v1';
    const SYNC_HISTORY_KEY = 'tiempos-sync-history-v1';
    const SYNC_MAX_HISTORY = 200;
    const PACKING_ROW_COLS = 37;
    const PACKING_ROW_IDX_OBS = 35;
    const PACKING_ROW_IDX_HORA_REG = 36;
    const PACKING_CHIPS_COLLAPSED_KEY = 'packing-chips-collapsed-v1';
    const PACKING_DRAFT_STORAGE_KEY = 'tiempos-packing-draft-v1';
    const PACKING_PDF_FILAS = 21;
    /** Filas 1–10 = muestra A; fila 11+ = muestra B en la misma hoja PDF. */
    const PACKING_PDF_FILAS_POR_MUESTRA = 10;
    const PACKING_PDF_INICIO_SEGUNDA_MUESTRA = 10;
    const PACKING_PDF_FILAS_SEGUNDA_BLOQUE = 11;
    const MIN_LOADER_MS = 350;

    /** Plantilla demo: solo rellena inputs visibles de la muestra activa (no atajos internos). */
    const PACKING_DEMO_PLANTILLA = {
        responsable: 'Demo packing',
        nViaje: '20',
        temperaturaAmb: ['12.5', '11.8', '11.2', '10.5', '10.0'],
        temperaturaPulpa: ['11.0', '10.5', '10.0', '9.5', '9.0'],
        humedad: ['85.0', '84.0', '83.0', '82.0', '81.0'],
        offsetsTiemposMin: [0, 60, 120, 180, 240],
        observacionPrefijo: 'SIM-'
    };

    const elFecha = document.getElementById('packing-fecha');
    const elMuestra = document.getElementById('packing-muestra');
    const elHoraInicio = document.getElementById('packing-hora-inicio');
    const elResponsable = document.getElementById('packing-responsable');
    const elHoraRow = document.getElementById('packing-hora-row');
    const elResumen = document.getElementById('packing-resumen');
    const elChipsPanel = document.getElementById('packing-chips-panel');
    const elResumenToggle = document.getElementById('packing-resumen-toggle');
    const elPreview = document.getElementById('packing-preview');
    const elPreviewLoader = document.getElementById('packing-preview-loader');
    const elPreviewLoaderMsg = document.getElementById('packing-preview-loader-msg');
    const elSelectBlock = document.getElementById('packing-select-block');
    const elMetaShell = document.getElementById('packing-meta-shell');
    const elSelectLoader = document.getElementById('packing-select-loader');
    const elSelectLoaderMsg = document.getElementById('packing-select-loader-msg');
    const elStatus = document.getElementById('packing-status');
    const elHeaderCard = document.getElementById('header-status-card');
    const elHeaderConn = document.getElementById('header-conn-label');
    const elHeaderPend = document.getElementById('header-pendientes-count');

    const previewIds = {
        traz: 'pk-traz',
        variedad: 'pk-variedad',
        placa: 'pk-placa'
    };

    function horaLocalAhora() {
        const d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':'
            + String(d.getMinutes()).padStart(2, '0');
    }

    function getHoraPersonal() {
        return String(elHoraInicio?.value || '').trim();
    }

    function getResponsablePacking() {
        return String(elResponsable?.value || '').trim();
    }

    function initHoraInicio(refrescar) {
        if (!elHoraInicio) return;
        if (refrescar) elHoraInicio.value = horaLocalAhora();
    }

    function asegurarHoraInicioAlEnfocarPacking_() {
        if (!elHoraInicio || elHoraInicio.dataset.pkHoraFocusBound === '1') return;
        elHoraInicio.dataset.pkHoraFocusBound = '1';
        elHoraInicio.addEventListener('focus', () => {
            if (!String(elHoraInicio.value || '').trim()) {
                elHoraInicio.value = horaLocalAhora();
                programarGuardadoBorradorPacking();
            }
        });
    }

    function ensayoSeleccionado() {
        const raw = elMuestra?.value || '';
        const parts = String(raw).split('|');
        return {
            num_muestra: parts[0] || '',
            ensayo_numero: parts.length >= 2 ? parts[1] : ''
        };
    }

    const TIEMPOS_MUESTRA_TOTAL = 5;
    const TIEMPOS_MUESTRA_IDS = [
        'pk-tiempo-recepcion',
        'pk-tiempo-ingreso-gas',
        'pk-tiempo-salida-gas',
        'pk-tiempo-ingreso-pre',
        'pk-tiempo-salida-pre'
    ];

    const elCardsWrap = document.getElementById('packing-cards-wrap');
    const elTiemposModal = document.getElementById('packing-tiempos-modal-overlay');
    const elTiemposModalTitle = document.getElementById('packing-tiempos-modal-title');
    const elTiemposCancel = document.getElementById('packing-tiempos-cancel');
    const elTiemposGuardar = document.getElementById('packing-tiempos-guardar');
    const elPresionModal = document.getElementById('packing-presion-modal-overlay');
    const elPresionModalTitle = document.getElementById('packing-presion-modal-title');
    const elPresionModalBody = document.getElementById('packing-presion-modal-body');
    const elPresionCancel = document.getElementById('packing-presion-cancel');
    const elObsModal = document.getElementById('packing-observation-modal-overlay');
    const elObsModalTitle = document.getElementById('packing-observation-modal-title');
    const elObsInput = document.getElementById('packing-visual-observation');
    const elObsCancel = document.getElementById('packing-observation-cancel');
    const elObsGuardar = document.getElementById('packing-observation-guardar');
    const elViajeModalPacking = document.getElementById('packing-viaje-modal-overlay');
    const elViajeInputPacking = document.getElementById('packing-n-viaje-inp');
    const elViajeCancelPacking = document.getElementById('btn_cancel_viaje_packing');
    const elViajeGuardarPacking = document.getElementById('btn_save_viaje_packing');
    const elFabAgregar = document.getElementById('fab-packing-agregar');
    const elFabRestanteBadge = document.getElementById('fab-packing-restante-badge');
    let elMetricTiempoBtn = null;
    let elMetricTiempoCount = null;
    let elMetricPresionAmbCount = null;
    let elMetricPresionFrutaCount = null;
    const elPesosModal = document.getElementById('packing-pesos-modal-overlay');
    const elPesosModalTitle = document.getElementById('packing-pesos-modal-title');
    const elPesosGuardar = document.getElementById('packing-pesos-guardar');
    const elBtnEnviarPacking = document.getElementById('btn-guardar-enviar-packing');
    const elEnvioBarPacking = document.getElementById('packing-envio-bar');
    let envioPackingEnCurso = false;

    const PACKING_PESO_CAMPOS = [
        { key: 'recepcion', inpId: 'pk-inp-peso-recep', cardId: null, rowIdx: 5 },
        { key: 'ingresoGas', inpId: 'pk-inp-peso-ing-gas', cardId: 'pk-peso-ing-gas', rowIdx: 6 },
        { key: 'salidaGas', inpId: 'pk-inp-peso-sal-gas', cardId: 'pk-peso-sal-gas', rowIdx: 7 },
        { key: 'ingresoPre', inpId: 'pk-inp-peso-ing-pre', cardId: 'pk-peso-ing-pre', rowIdx: 8 },
        { key: 'salidaPre', inpId: 'pk-inp-peso-sal-pre', cardId: 'pk-peso-sal-pre', rowIdx: 9 }
    ];

    const packingQuota = {
        filasTotalCampo: 0,
        filasPackingRegistradas: 0,
        maxClamshell: 0,
        tipoMuestra: 'T',
        variedadMuestra: ''
    };
    let packingCards = [];
    let packingCardSeq = 0;
    let fabAgregarPackingTs_ = 0;
    let fabAgregarPackingEnCurso_ = false;
    let guardandoModalPesosPacking_ = false;
    let abrirModalPesosPackingTs_ = 0;
    let packingActiveCardId = null;
    let packingObservationCardId = null;
    let packingMuestraAnterior = '';
    let packingFechaAnterior = '';
    let packingRestaurandoBorrador = false;
    let packingOmitirAutoguardado = false;
    let packingDraftSaveTimer = null;
    let packingBadgeWasComplete = false;
    /** Cuota en servidor por muestra (fecha::num|ensayo), actualizada al cargar detalle. */
    const packingQuotaServidorCache_ = Object.create(null);
    /** Meta Campo (guía, placa, traz…) por muestra para PDF multi-hoja. */
    const packingDetalleMetaCache_ = Object.create(null);

    function pesosVaciosPacking() {
        return { recepcion: 0, ingresoGas: 0, salidaGas: 0, ingresoPre: 0, salidaPre: 0 };
    }

    const PESOS_BRUTO_PDF_PACKING_KEYS = ['recepcion', 'ingresoGas', 'salidaGas', 'ingresoPre', 'salidaPre'];

    function hayPesoBrutoMuestraPacking(estado) {
        if (!estado || typeof estado !== 'object') return false;
        const cards = Array.isArray(estado.packingCards) ? estado.packingCards : [];
        return cards.some((c) => {
            const p = c?.pesos || {};
            return PESOS_BRUTO_PDF_PACKING_KEYS.some((k) => pesoNumero(p[k]) > 0);
        });
    }

    function mensajeSinPesoBrutoPdfPacking_(etiquetaMuestra) {
        const pref = etiquetaMuestra ? `${etiquetaMuestra}: ` : '';
        return pref + 'Captura al menos un peso en PESO BRUTO MUESTRA (GR) — Recepción, Gasificado o Prefrío — antes de generar el PDF.';
    }

    function pesoNumero(val) {
        const n = Number(val);
        return Number.isFinite(n) ? n : 0;
    }

    /** Máx. salto hacia adelante al cruzar medianoche (misma cadena de tiempos). */
    const MAX_SALTO_HORA_MEDIANOCHE_MIN = 16 * 60;

    function minutosDesdeHoraPacking(hora) {
        if (!hora) return null;
        const [h, m] = String(hora).split(':').map(Number);
        if ([h, m].some((x) => Number.isNaN(x))) return null;
        return (h * 60) + m;
    }

    /**
     * true si la hora posterior es inválida respecto a la anterior.
     * Acepta cruce de medianoche (ej. 23:23 → 00:23).
     */
    function horaMenorQue(anterior, posterior) {
        const minAnt = minutosDesdeHoraPacking(anterior);
        const minPost = minutosDesdeHoraPacking(posterior);
        if (minAnt === null || minPost === null) return false;
        if (minPost >= minAnt) return false;
        const saltoAdelante = (24 * 60 - minAnt) + minPost;
        return saltoAdelante > MAX_SALTO_HORA_MEDIANOCHE_MIN;
    }

    function pesoSuperaLimite(valor, limite) {
        const v = pesoNumero(valor);
        const l = pesoNumero(limite);
        if (l <= 0) return false;
        return v > l + 0.001;
    }

    function limitePesoDesdeDespachoCtx_(clamshellNum, ctx) {
        if (!ctx || typeof ctx !== 'object') return null;
        const porFila = Array.isArray(ctx.despachoPorFila) ? ctx.despachoPorFila : [];
        const idx = Math.max(0, Number(clamshellNum) - 1);
        let v = porFila[idx];
        if (v == null || v === '') {
            v = ctx.despachoAcopio ?? ctx.DESPACHO_ACOPIO ?? ctx.despacho_acopio_gramos;
        }
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function getLimitePesoRecepcionPacking(clamshellNum, quotaSnap) {
        const snap = quotaSnap && typeof quotaSnap === 'object' ? quotaSnap : null;
        const tieneSnapDespacho = snap && (
            (Array.isArray(snap.despachoPorFila) && snap.despachoPorFila.length)
            || snap.despachoAcopio != null
        );
        if (tieneSnapDespacho) {
            return limitePesoDesdeDespachoCtx_(clamshellNum, snap);
        }
        const d = lastDetallePacking;
        if (!d) return null;
        return limitePesoDesdeDespachoCtx_(clamshellNum, {
            despachoPorFila: d.despachoPorFila,
            despachoAcopio: d.DESPACHO_ACOPIO ?? d.despacho_acopio_gramos
        });
    }

    function capturarQuotaSnapshotPacking_() {
        const snap = { ...packingQuota };
        const d = lastDetallePacking;
        if (d) {
            snap.despachoPorFila = Array.isArray(d.despachoPorFila) ? d.despachoPorFila.slice() : [];
            snap.despachoAcopio = d.DESPACHO_ACOPIO ?? d.despacho_acopio_gramos ?? null;
        }
        return snap;
    }

    function tiemposObjetoDesdeEstadoPacking_(estado) {
        const arr = Array.isArray(estado?.tiempos) ? estado.tiempos : [];
        return {
            horaInicio: String(estado?.horaInicio || '').trim(),
            recepcion: String(arr[0] || '').trim(),
            ingresoGas: String(arr[1] || '').trim(),
            salidaGas: String(arr[2] || '').trim(),
            ingresoPre: String(arr[3] || '').trim(),
            salidaPre: String(arr[4] || '').trim()
        };
    }

    function recogerCandidatosMuestrasPackingDelDia_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        const candidatos = new Set();
        if (!fecha) return candidatos;
        const store = leerStoreBorradorPacking();
        const prefix = fecha + '::';
        Object.keys(store.porClave || {}).forEach((key) => {
            if (key.startsWith(prefix)) candidatos.add(key.slice(prefix.length));
        });
        const rawActivo = String(elMuestra?.value || '').trim();
        if (rawActivo) candidatos.add(rawActivo);
        if (elMuestra) {
            Array.from(elMuestra.options).forEach((opt) => {
                const v = String(opt.value || '').trim();
                if (v) candidatos.add(v);
            });
        }
        return candidatos;
    }

    function leerPesosModalPacking() {
        const read = (id) => document.getElementById(id)?.value;
        return {
            recepcion: read('pk-inp-peso-recep'),
            ingresoGas: read('pk-inp-peso-ing-gas'),
            salidaGas: read('pk-inp-peso-sal-gas'),
            ingresoPre: read('pk-inp-peso-ing-pre'),
            salidaPre: read('pk-inp-peso-sal-pre')
        };
    }

    function validarSecuenciaPesosPacking(p, limiteRecepcion) {
        const recep = pesoNumero(p.recepcion);
        const ingGas = pesoNumero(p.ingresoGas);
        const salGas = pesoNumero(p.salidaGas);
        const ingPre = pesoNumero(p.ingresoPre);
        const salPre = pesoNumero(p.salidaPre);
        const errores = [];
        if (limiteRecepcion != null && pesoSuperaLimite(recep, limiteRecepcion)) {
            errores.push('Peso recepción no puede superar el despacho acopio-campo (' + limiteRecepcion + 'g).');
        }
        if (ingGas > recep + 0.001) {
            errores.push('Peso I-GASIF.: debe ser igual o menor que peso recepción.');
        }
        if (salGas > recep + 0.001) {
            errores.push('Peso S-GASIF.: debe ser igual o menor que peso recepción.');
        }
        if (ingPre > salGas + 0.001) {
            errores.push('Peso ingreso prefrío: debe ser igual o menor que peso S-GASIF.');
        }
        if (salPre > ingPre + 0.001) {
            errores.push('Peso salida prefrío: debe ser igual o menor que peso ingreso prefrío.');
        }
        return errores;
    }

    function validarPesosModalEnVivo() {
        const alertEl = document.getElementById('packing-pesos-alert');
        const card = getCardPackingById(packingActiveCardId) || packingCards[0];
        const limite = card ? getLimitePesoRecepcionPacking(card.clamshellNum) : null;
        const errores = validarSecuenciaPesosPacking(leerPesosModalPacking(), limite);
        if (alertEl) {
            if (errores.length) {
                alertEl.textContent = errores[0];
                alertEl.style.display = 'block';
            } else {
                alertEl.textContent = '';
                alertEl.style.display = 'none';
            }
        }
        if (elPesosGuardar) elPesosGuardar.disabled = errores.length > 0;
        return errores;
    }

    function obtenerTiemposDesdeModalPacking() {
        const read = (id) => String(document.getElementById(id)?.value || '').trim();
        return {
            horaInicio: getHoraPersonal(),
            recepcion: read('pk-tiempo-recepcion'),
            ingresoGas: read('pk-tiempo-ingreso-gas'),
            salidaGas: read('pk-tiempo-salida-gas'),
            ingresoPre: read('pk-tiempo-ingreso-pre'),
            salidaPre: read('pk-tiempo-salida-pre')
        };
    }

    function validarSecuenciaTiemposPacking(t) {
        const horaInicio = String(t.horaInicio || '').trim();
        const recepcion = String(t.recepcion || '').trim();
        const ingresoGas = String(t.ingresoGas || '').trim();
        const salidaGas = String(t.salidaGas || '').trim();
        const ingresoPre = String(t.ingresoPre || '').trim();
        const salidaPre = String(t.salidaPre || '').trim();
        const errores = [];
        if (horaInicio && recepcion && horaMenorQue(horaInicio, recepcion)) {
            errores.push('Hora recepción: debe ser igual o posterior a hora inicio recepción.');
        }
        if (recepcion && ingresoGas && horaMenorQue(recepcion, ingresoGas)) {
            errores.push('Hora ingreso gasif.: debe ser igual o posterior a hora recepción.');
        }
        if (ingresoGas && salidaGas && horaMenorQue(ingresoGas, salidaGas)) {
            errores.push('Hora salida gasif.: debe ser igual o posterior a hora ingreso gasif.');
        }
        if (salidaGas && ingresoPre && horaMenorQue(salidaGas, ingresoPre)) {
            errores.push('Hora ingreso prefrío: debe ser igual o posterior a hora salida gasif.');
        }
        if (ingresoPre && salidaPre && horaMenorQue(ingresoPre, salidaPre)) {
            errores.push('Hora salida prefrío: debe ser igual o posterior a hora ingreso prefrío.');
        }
        return errores;
    }

    function validarTiemposModalEnVivo() {
        const alertEl = document.getElementById('packing-tiempos-alert');
        if (tiemposModalSoloLectura) {
            if (alertEl) {
                alertEl.textContent = '';
                alertEl.style.display = 'none';
            }
            return [];
        }
        const errores = validarSecuenciaTiemposPacking(obtenerTiemposDesdeModalPacking());
        if (alertEl) {
            if (errores.length) {
                alertEl.textContent = errores[0];
                alertEl.style.display = 'block';
            } else {
                alertEl.textContent = '';
                alertEl.style.display = 'none';
            }
        }
        if (elTiemposGuardar && !tiemposModalSoloLectura) {
            elTiemposGuardar.disabled = errores.length > 0;
        }
        return errores;
    }

    function limpiarAlertaPesosModal() {
        const alertEl = document.getElementById('packing-pesos-alert');
        if (alertEl) {
            alertEl.textContent = '';
            alertEl.style.display = 'none';
        }
        if (elPesosGuardar) elPesosGuardar.disabled = false;
    }

    function limpiarAlertaTiemposModal() {
        const alertEl = document.getElementById('packing-tiempos-alert');
        if (alertEl) {
            alertEl.textContent = '';
            alertEl.style.display = 'none';
        }
    }

    async function swalFirePacking(options) {
        if (!(window.Swal && typeof window.Swal.fire === 'function')) return null;
        const incoming = options || {};
        const isToast = !!incoming.toast;
        const opts = Object.assign({}, incoming);
        if (!isToast) {
            const active = document.activeElement;
            if (active && typeof active.blur === 'function') active.blur();
            opts.returnFocus = false;
        } else {
            delete opts.returnFocus;
        }
        return window.Swal.fire(opts);
    }

    async function confirmarSwalPacking_(options) {
        const resp = await swalFirePacking(options);
        return !!(resp && resp.isConfirmed);
    }

    async function mostrarErroresCompletitudPacking_(errores, titulo) {
        const lista = (Array.isArray(errores) ? errores : []).map((e) => String(e || '').trim()).filter(Boolean);
        if (!lista.length) return;
        const top = lista.slice(0, 12);
        const extra = Math.max(0, lista.length - top.length);
        const listHtml = top.map((txt) => `
            <li class="swal-campos-item">
                <span class="swal-campos-dot"></span>
                <span class="swal-campos-item-text">${txt}</span>
            </li>
        `).join('');
        const extraHtml = extra > 0
            ? `<div style="margin-top:8px;font-size:12px;color:#64748b;">... y ${extra} punto(s) más</div>`
            : '';
        const tituloFinal = titulo || `Datos incompletos (${lista.length})`;
        if (window.Swal && typeof window.Swal.fire === 'function') {
            await swalFirePacking({
                icon: 'warning',
                title: tituloFinal,
                html: `
                    <div class="swal-campos-wrap">
                        <div class="swal-campos-head">
                            Completa estos puntos antes de enviar
                        </div>
                        <ul class="swal-campos-list">
                            ${listHtml}
                        </ul>
                        <div class="swal-campos-foot">
                            ${extraHtml || '<span>Revisa los modales de pesos, tiempos y control equitativo.</span>'}
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#1f4f82',
                width: 480,
                customClass: {
                    popup: 'swal-campos-popup',
                    title: 'swal-campos-title',
                    confirmButton: 'swal-campos-confirm-btn'
                },
                allowOutsideClick: false
            });
            return;
        }
        alert(`${tituloFinal}\n- ${top.join('\n- ')}${extra > 0 ? `\n... y ${extra} más` : ''}`);
    }

    function mostrarToastPacking(icono, titulo, texto) {
        if (window.Swal && typeof window.Swal.fire === 'function') {
            void swalFirePacking({
                toast: true,
                position: 'top-end',
                icon: icono || 'info',
                title: titulo || '',
                text: texto || '',
                showConfirmButton: false,
                timer: 3200,
                timerProgressBar: true
            });
            return;
        }
        if (texto || titulo) setStatus((titulo ? titulo + ': ' : '') + (texto || ''), icono === 'error' ? 'error' : '');
    }

    function setButtonLoadingPacking(btn, loading, textoCargando) {
        if (!btn) return;
        if (loading) {
            if (!btn.dataset.pkLabelOriginal) btn.dataset.pkLabelOriginal = btn.textContent || '';
            btn.disabled = true;
            btn.textContent = textoCargando || 'Enviando...';
            btn.classList.add('is-loading');
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.pkLabelOriginal || 'Enviar registro';
            btn.classList.remove('is-loading');
            actualizarBtnEnviarPacking();
        }
    }

    function actualizarBtnEnviarPacking() {
        if (!elBtnEnviarPacking) return;
        const yaEnServidor = muestraPackingYaCompletaEnServidor_(packingQuota);
        const completa = muestraPackingCompletaEnPantalla_();
        const baseOk = muestraSeleccionada()
            && completa
            && !yaEnServidor
            && !elCardsWrap?.classList.contains('is-disabled')
            && !envioPackingEnCurso;
        elBtnEnviarPacking.disabled = !baseOk;
        if (elEnvioBarPacking) {
            elEnvioBarPacking.classList.toggle('is-disabled', !muestraSeleccionada());
        }
        if (elStatus?.dataset.pkCompletitudHint === '1' && baseOk && !envioPackingEnCurso) {
            const v = validarCompletitudPackingParaEnvio();
            if (v.ok) {
                elStatus.hidden = true;
                elStatus.textContent = '';
                delete elStatus.dataset.pkCompletitudHint;
                syncPackingFoldBtnAnchor();
            }
        }
    }

    function pesoDisplayVacio(g) {
        return pesoNumero(g) <= 0;
    }

    function textoPesoCard(g) {
        if (pesoDisplayVacio(g)) return '00';
        const n = pesoNumero(g);
        return (Math.round(n * 10) / 10) + 'g';
    }

    function clasePesoCard(g, base) {
        return (base || 'weight-value') + (pesoDisplayVacio(g) ? ' is-empty-peso' : '');
    }

    function valorPesoInputPacking(v) {
        const n = pesoNumero(v);
        return n > 0 ? String(n) : '';
    }

    function aplicarCuotaDesdeDetalle(d) {
        const totalCampo = Number(d.FILAS_TOTAL_CAMPO ?? d.numFilas ?? 0);
        packingQuota.filasTotalCampo = Number.isFinite(totalCampo) && totalCampo >= 0 ? totalCampo : 0;
        const packingHechas = Number(d.FILAS_PACKING_REGISTRADAS ?? 0);
        packingQuota.filasPackingRegistradas = Number.isFinite(packingHechas) && packingHechas >= 0 ? packingHechas : 0;
        let max = Number(d.MAX_CLAMSHELL ?? 0);
        if (!max && d.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        if (packingQuota.filasTotalCampo > 0 && (max <= 0 || max < packingQuota.filasTotalCampo)) {
            max = packingQuota.filasTotalCampo;
        }
        packingQuota.maxClamshell = max > 0 ? max : 0;
        packingQuota.tipoMuestra = String(d.TIPO_MUESTRA ?? d.tipo ?? 'T').trim() || 'T';
        packingQuota.variedadMuestra = String(d.VARIEDAD ?? '').trim();
    }

    function escHtmlPacking(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function textoVariedadCardPacking() {
        const v = String(packingQuota.variedadMuestra || '').trim();
        return v ? ('Variedad: ' + escHtmlPacking(v)) : 'Variedad: —';
    }

    function cuotaMaximaEfectivaPacking() {
        if (packingQuota.maxClamshell > 0) return packingQuota.maxClamshell;
        if (packingQuota.filasTotalCampo > 0) return packingQuota.filasTotalCampo;
        return 8;
    }

    function conteoClamshellsRegistroPacking() {
        const max = cuotaMaximaEfectivaPacking();
        const enServidor = packingQuota.filasPackingRegistradas;
        const enPantalla = packingCards.length;
        const total = enServidor + enPantalla;
        const faltan = Math.max(0, max - total);
        return { max, enServidor, enPantalla, total, faltan };
    }

    function validarCuotaClamshellsRegistroPacking() {
        const c = conteoClamshellsRegistroPacking();
        if (c.max <= 0) return { ok: true };
        if (c.total >= c.max) return { ok: true };
        return {
            ok: false,
            error: 'Debes completar los ' + c.max + ' clamshells del registro. Faltan '
                + c.faltan + ' (' + c.total + '/' + c.max + ').'
        };
    }

    function restantesPorAgregarPacking() {
        const max = cuotaMaximaEfectivaPacking();
        return Math.max(0, max - packingQuota.filasPackingRegistradas - packingCards.length);
    }

    function cuotaMaximaDesdeSnapshotPacking(snap) {
        const s = snap && typeof snap === 'object' ? snap : {};
        if (s.maxClamshell > 0) return s.maxClamshell;
        if (s.filasTotalCampo > 0) return s.filasTotalCampo;
        return 8;
    }

    function snapshotQuotaDesdeDetallePacking_(d) {
        if (!d || typeof d !== 'object') return null;
        const totalCampo = Number(d.FILAS_TOTAL_CAMPO ?? d.numFilas ?? 0);
        const packingHechas = Number(d.FILAS_PACKING_REGISTRADAS ?? 0);
        let max = Number(d.MAX_CLAMSHELL ?? 0);
        if (!max && d.N_CLAMSHELL != null && String(d.N_CLAMSHELL).trim() !== '') {
            const parsed = parseInt(String(d.N_CLAMSHELL).trim(), 10);
            if (!isNaN(parsed) && parsed > 0) max = parsed;
        }
        const filasTotalCampo = Number.isFinite(totalCampo) && totalCampo >= 0 ? totalCampo : 0;
        if (filasTotalCampo > 0 && (max <= 0 || max < filasTotalCampo)) max = filasTotalCampo;
        return {
            filasTotalCampo,
            filasPackingRegistradas: Number.isFinite(packingHechas) && packingHechas >= 0 ? packingHechas : 0,
            maxClamshell: max
        };
    }

    function limpiarCacheQuotaServidorPacking_() {
        Object.keys(packingQuotaServidorCache_).forEach((k) => {
            delete packingQuotaServidorCache_[k];
        });
        Object.keys(packingDetalleMetaCache_).forEach((k) => {
            delete packingDetalleMetaCache_[k];
        });
    }

    /** Guía/placa: en planilla a veces viene 0 si Campo no la llenó. */
    function textoMetaCampoPdfPacking_(v) {
        const s = String(v ?? '').trim();
        if (!s || s === '0') return '';
        return s;
    }

    /** Prioriza el primer valor no vacío (|| evita que '' del servidor tape el UI). */
    function viajePdfDesdeFuentesPacking_(nViajeEstado, previewMeta, detalle) {
        const d = detalle && typeof detalle === 'object' ? detalle : {};
        const meta = previewMeta && typeof previewMeta === 'object' ? previewMeta : {};
        return textoMetaCampoPdfPacking_(
            nViajeEstado || meta.viaje || d.N_VIAJE || d.n_viaje
        );
    }

    function registrarDetalleMetaPacking_(fechaIso, rawMuestra, detalle) {
        const key = claveBorradorMuestraPacking(fechaIso, rawMuestra);
        if (!key || !detalle || typeof detalle !== 'object') return;
        packingDetalleMetaCache_[key] = {
            TRAZ_ETAPA: detalle.TRAZ_ETAPA,
            TRAZ_CAMPO: detalle.TRAZ_CAMPO,
            TRAZ_TURNO: detalle.TRAZ_TURNO ?? detalle.TRAZ_LIBRE,
            VARIEDAD: detalle.VARIEDAD,
            PLACA_VEHICULO: detalle.PLACA_VEHICULO,
            GUIA_REMISION: detalle.GUIA_REMISION,
            ENSAYO_NOMBRE: detalle.ENSAYO_NOMBRE,
            N_VIAJE: detalle.N_VIAJE ?? detalle.n_viaje,
            RESPONSABLE: detalle.RESPONSABLE
        };
    }

    function leerDetalleMetaPacking_(rawMuestra) {
        const raw = String(rawMuestra || '').trim();
        const key = claveBorradorMuestraPacking(elFecha?.value, raw);
        if (key && packingDetalleMetaCache_[key]) return packingDetalleMetaCache_[key];
        if (raw && raw === String(elMuestra?.value || '').trim() && lastDetallePacking) {
            return lastDetallePacking;
        }
        return null;
    }

    function registrarQuotaServidorMuestraPacking_(fechaIso, rawMuestra, detalle) {
        const key = claveBorradorMuestraPacking(fechaIso, rawMuestra);
        const snap = snapshotQuotaDesdeDetallePacking_(detalle);
        if (!key || !snap) return;
        packingQuotaServidorCache_[key] = snap;
        registrarDetalleMetaPacking_(fechaIso, rawMuestra, detalle);
    }

    function quotaServidorMuestraPacking_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (raw === String(elMuestra?.value || '').trim()) {
            return { ...packingQuota };
        }
        const key = claveBorradorMuestraPacking(fecha, raw);
        if (key && packingQuotaServidorCache_[key]) return packingQuotaServidorCache_[key];
        const borrador = leerBorradorMuestraPacking_(fecha, raw);
        if (borrador?.packingQuotaSnapshot) return borrador.packingQuotaSnapshot;
        return null;
    }

    function muestraPackingYaCompletaEnServidor_(quotaSnapOrRaw) {
        const snap = typeof quotaSnapOrRaw === 'string'
            ? quotaServidorMuestraPacking_(quotaSnapOrRaw)
            : (quotaSnapOrRaw && typeof quotaSnapOrRaw === 'object' ? quotaSnapOrRaw : packingQuota);
        if (!snap) return false;
        const max = cuotaMaximaDesdeSnapshotPacking(snap);
        const enSrv = Number(snap.filasPackingRegistradas) || 0;
        return max > 0 && enSrv >= max;
    }

    function muestraPackingPendienteDeEnvio_(estado, quotaSnap, rawMuestra) {
        if (muestraPackingYaCompletaEnServidor_(quotaSnap) || muestraPackingYaCompletaEnServidor_(rawMuestra)) {
            return false;
        }
        return muestraPackingEstadoCompleto_(estado, quotaSnap);
    }

    function muestrasEnUsoPackingDelDia_() {
        return obtenerOpcionesMuestraPackingSelect_().filter((raw) => muestraPackingEnUso_(raw));
    }

    /** PDF manual (FAB): solo muestras con captura local pendiente; las ya enviadas van al Historial. */
    function muestrasPendientesPdfPackingDelDia_() {
        return muestrasEnUsoPackingDelDia_().filter((raw) => !muestraPackingYaCompletaEnServidor_(raw));
    }

    function necesitaRefrescarQuotaServidorPacking_(enUso) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const rawActivo = String(elMuestra?.value || '').trim();
        if (!fecha || !navigator.onLine || !API_URL) return false;
        return (enUso || []).some((raw) => {
            const r = String(raw || '').trim();
            if (!r || r === rawActivo) return false;
            const key = claveBorradorMuestraPacking(fecha, r);
            return !key || !packingQuotaServidorCache_[key];
        });
    }

    async function refrescarQuotaServidorMuestrasPacking_(candidatos, opts) {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha || !navigator.onLine || !API_URL) return;
        const rawActivo = String(elMuestra?.value || '').trim();
        const soloSinCache = !opts || opts.soloSinCache !== false;
        const pendientes = [];
        (candidatos || []).forEach((raw) => {
            const r = String(raw || '').trim();
            if (!r || r === rawActivo) return;
            if (soloSinCache) {
                const key = claveBorradorMuestraPacking(fecha, r);
                if (key && packingQuotaServidorCache_[key]) return;
            }
            const ensayo = String(r.split('|')[1] || '').trim();
            if (!ensayo) return;
            pendientes.push({ raw: r, ensayo });
        });
        if (!pendientes.length) return;
        await Promise.all(pendientes.map(async ({ raw, ensayo }) => {
            try {
                const resp = await callbackJsonp({ fecha, ensayo_numero: ensayo }, 6000);
                if (resp?.ok === true && resp.data) {
                    registrarQuotaServidorMuestraPacking_(fecha, raw, resp.data);
                }
            } catch (_) { /* sin bloquear envío */ }
        }));
    }

    function restantesDesdeEstadoMuestraPacking(estado, quotaSnap) {
        const snap = quotaSnap && typeof quotaSnap === 'object' ? quotaSnap : {};
        const max = cuotaMaximaDesdeSnapshotPacking(snap);
        const enSrv = Number(snap.filasPackingRegistradas) || 0;
        const cards = Array.isArray(estado?.packingCards) ? estado.packingCards.length : 0;
        return Math.max(0, max - enSrv - cards);
    }

    function numeroEnsayoPackingDesdeRaw(raw) {
        const parts = String(raw || '').split('|');
        return Number(parts[1]) || 0;
    }

    function numeroEnsayoItemPacking_(item) {
        if (item == null) return 0;
        if (typeof item === 'string') return numeroEnsayoPackingDesdeRaw(item);
        const en = Number(item.ensayo_numero || item.ensayo || 0);
        if (Number.isFinite(en) && en > 0) return en;
        return numeroEnsayoPackingDesdeRaw(item.raw);
    }

    function ordenarMuestrasPackingPorEnsayo_(lista) {
        return (lista || []).slice().sort((a, b) => {
            const na = numeroEnsayoItemPacking_(a);
            const nb = numeroEnsayoItemPacking_(b);
            return na - nb;
        });
    }

    function deduplicarItemsMuestraPacking_(lista) {
        const seen = new Set();
        const out = [];
        ordenarMuestrasPackingPorEnsayo_(lista).forEach((item) => {
            const key = String(
                (typeof item === 'string' ? item : (item?.raw || ''))
                || ((item?.num_muestra && item?.ensayo_numero)
                    ? (item.num_muestra + '|' + item.ensayo_numero)
                    : '')
            ).trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(item);
        });
        return out;
    }

    function detectarHuecosSecuenciaPacking_(completas) {
        const numeros = ordenarMuestrasPackingPorEnsayo_(completas)
            .map((c) => numeroEnsayoPackingDesdeRaw(c.raw))
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

    function horaLocalActualPacking() {
        const d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function buildPackingRowDesdeCardEstado(card, tiempos, control, horaRegistro) {
        const row = new Array(PACKING_ROW_COLS).fill('');
        const tArr = Array.isArray(tiempos) ? tiempos : [];
        for (let i = 0; i < tArr.length && i < 5; i++) row[i] = String(tArr[i] || '').trim();
        aplicarPesosPackingARow(row, card?.pesos || pesosVaciosPacking());
        const cg = clonarControlStatePacking(control);
        const t = cg.temperatura;
        const h = cg.humedad;
        const pAmb = cg.presionAmb;
        const pFruta = cg.presionFruta;
        for (let i = 0; i < 5; i++) {
            row[10 + (i * 2)] = decimalNumParaEnvioPacking(t.amb[i]);
            row[11 + (i * 2)] = decimalNumParaEnvioPacking(t.pulpa[i]);
            row[20 + i] = decimalNumParaEnvioPacking(h[i]);
            row[25 + i] = decimalNumParaEnvioPacking(pAmb[i]);
            row[30 + i] = decimalNumParaEnvioPacking(pFruta[i]);
        }
        row[PACKING_ROW_IDX_OBS] = String(card?.observacion || '').trim();
        row[PACKING_ROW_IDX_HORA_REG] = String(horaRegistro || horaLocalActualPacking()).trim();
        return row;
    }

    function getMetaEnvioPackingDesdeEstado_(estado, rawMuestra, fechaIso) {
        const parts = String(rawMuestra || '').split('|');
        const snap = estado?.packingQuotaSnapshot || packingQuota;
        const cards = Array.isArray(estado?.packingCards) ? estado.packingCards : [];
        const hora = String(estado?.horaInicio || '').trim();
        const responsable = String(estado?.responsable || '').trim();
        return {
            mode: 'packing',
            guardar_packing: true,
            actualizar_c5: false,
            guardar_thermoking: false,
            fecha: fechaIso || elFecha?.value || '',
            ensayo_numero: parts[1] || '',
            num_muestra: parts[0] || '',
            fecha_inspeccion: getFechaInspeccionPacking(),
            responsable,
            hora_recepcion: hora,
            hora_inicio_recepcion_c5: hora,
            n_viaje: String(estado?.nViaje || '').trim(),
            packing_start_index: Number(snap.filasPackingRegistradas) || 0,
            packingRows: (() => {
                const horaReg = horaLocalActualPacking();
                return cards.map((c) => buildPackingRowDesdeCardEstado(
                    c,
                    estado?.tiempos,
                    estado?.control,
                    horaReg
                ));
            })()
        };
    }

    function validarCuotaClamshellsDesdeEstado_(estado, quotaSnap) {
        const snap = quotaSnap && typeof quotaSnap === 'object' ? quotaSnap : {};
        const max = cuotaMaximaDesdeSnapshotPacking(snap);
        const enSrv = Number(snap.filasPackingRegistradas) || 0;
        const cards = Array.isArray(estado?.packingCards) ? estado.packingCards.length : 0;
        const total = enSrv + cards;
        if (max <= 0) return { ok: true };
        if (total >= max) return { ok: true };
        return {
            ok: false,
            error: 'Debes completar los ' + max + ' clamshells del registro. Faltan '
                + (max - total) + ' (' + total + '/' + max + ').'
        };
    }

    function validarCompletitudPackingParaEnvioDesdeEstado_(estado, quotaSnap) {
        const errores = [];
        const cuota = validarCuotaClamshellsDesdeEstado_(estado, quotaSnap);
        if (!cuota.ok) errores.push(cuota.error);

        if (!String(estado?.horaInicio || '').trim()) {
            errores.push(msgErrorGlobalPacking('Cabecera', 'Completa Hora inicio recepción.'));
        }
        if (!String(estado?.responsable || '').trim()) {
            errores.push(msgErrorGlobalPacking('Cabecera', 'Completa Responsable.'));
        }

        const tiempos = Array.isArray(estado?.tiempos) ? estado.tiempos : [];
        const ctDone = tiempos.filter((v) => String(v || '').trim()).length;
        if (ctDone < TIEMPOS_MUESTRA_TOTAL) {
            errores.push(
                msgErrorTiemposPacking(
                    'Completa las ' + TIEMPOS_MUESTRA_TOTAL + ' etapas (' + ctDone + '/' + TIEMPOS_MUESTRA_TOTAL + ').'
                )
            );
        }
        validarSecuenciaTiemposPacking(tiemposObjetoDesdeEstadoPacking_(estado)).forEach((e) => {
            errores.push(msgErrorTiemposPacking(e));
        });

        const cg = recalcularPresionesDesdeControlPacking_(estado?.control);
        const t = cg.temperatura;
        const h = cg.humedad;
        let faltanControl = false;
        for (let i = 0; i < 5; i++) {
            if (!controlGlobalPackingTieneDato(t.amb[i])
                || !controlGlobalPackingTieneDato(t.pulpa[i])
                || !controlGlobalPackingTieneDato(h[i])) {
                faltanControl = true;
                break;
            }
        }
        if (faltanControl) {
            errores.push(
                msgErrorGlobalPacking(
                    'Control',
                    'Abre Temperatura y Humedad global y completa las 5 etapas.'
                )
            );
        }

        const cAmb = conteoPresionPacking(cg.presionAmb);
        const cFruta = conteoPresionPacking(cg.presionFruta);
        if (!faltanControl && cAmb.done < cAmb.total) {
            errores.push(
                msgErrorGlobalPacking(
                    '☁️',
                    'Revisa temperatura ambiente y humedad (' + cAmb.done + '/5).'
                )
            );
        }
        if (!faltanControl && cFruta.done < cFruta.total) {
            errores.push(
                msgErrorGlobalPacking(
                    '🍎',
                    'Revisa temperatura pulpa (' + cFruta.done + '/5).'
                )
            );
        }

        const pesoLabels = {
            recepcion: 'Peso recepción',
            ingresoGas: 'Peso I-GASIF.',
            salidaGas: 'Peso S-GASIF.',
            ingresoPre: 'Peso ingreso prefrío',
            salidaPre: 'Peso salida prefrío'
        };
        const snapPesos = quotaSnap && typeof quotaSnap === 'object' ? quotaSnap : {};
        const tieneDespachoSnap = (Array.isArray(snapPesos.despachoPorFila) && snapPesos.despachoPorFila.length)
            || snapPesos.despachoAcopio != null;
        const cards = Array.isArray(estado?.packingCards) ? estado.packingCards : [];
        cards.forEach((card) => {
            const p = card.pesos || pesosVaciosPacking();
            const faltantes = Object.keys(pesoLabels).filter((k) => pesoNumero(p[k]) <= 0);
            if (faltantes.length) {
                errores.push(
                    msgErrorPesosPacking(
                        card.clamshellNum,
                        'Completa ' + faltantes.map((k) => pesoLabels[k]).join(', ') + '.'
                    )
                );
                return;
            }
            const limite = tieneDespachoSnap
                ? getLimitePesoRecepcionPacking(card.clamshellNum, snapPesos)
                : null;
            const pesoErr = validarSecuenciaPesosPacking(p, limite);
            if (pesoErr.length) {
                errores.push(msgErrorPesosPacking(card.clamshellNum, pesoErr[0]));
            }
        });

        return { ok: errores.length === 0, errores };
    }

    function muestraPackingEstadoCompleto_(estado, quotaSnap) {
        if (!estado || !hayDatosTrabajoMuestraPacking(estado)) return false;
        if (restantesDesdeEstadoMuestraPacking(estado, quotaSnap) > 0) return false;
        return validarCompletitudPackingParaEnvioDesdeEstado_(estado, quotaSnap).ok;
    }

    function muestraPackingCompletaEnPantalla_() {
        if (!muestraSeleccionada()) return false;
        return muestraPackingEstadoCompleto_(capturarEstadoMuestraPacking(), { ...packingQuota });
    }

    function capturaEstadoMuestraParaValidacion_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        const parts = raw.split('|');
        const key = claveBorradorMuestraPacking(fecha, raw);
        const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
        if (raw === String(elMuestra?.value || '').trim()) {
            const estadoLive = capturarEstadoMuestraPacking();
            const quotaLive = { ...packingQuota };
            const snapBorrador = borrador?.packingQuotaSnapshot || quotaLive;
            const liveCompleto = muestraPackingEstadoCompleto_(estadoLive, quotaLive);
            const borradorCompleto = borrador
                && muestraPackingEstadoCompleto_(borrador, snapBorrador);
            const usarBorrador = borradorCompleto && (!liveCompleto || !packingCards.length);
            const estado = usarBorrador ? borrador : estadoLive;
            const quotaSnap = usarBorrador ? snapBorrador : quotaLive;
            return {
                raw,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || '',
                estado,
                quotaSnap
            };
        }
        if (!borrador) return null;
        return {
            raw,
            num_muestra: parts[0] || '',
            ensayo_numero: parts[1] || '',
            estado: borrador,
            quotaSnap: borrador.packingQuotaSnapshot || {}
        };
    }

    function leerBorradorMuestraPacking_(fechaIso, rawMuestra) {
        const key = claveBorradorMuestraPacking(fechaIso, rawMuestra);
        if (!key) return null;
        return leerStoreBorradorPacking().porClave[key] || null;
    }

    function capturaEstadoMuestraParaEnvio_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (muestraPackingYaCompletaEnServidor_(raw)) return null;
        const parts = raw.split('|');

        if (raw === String(elMuestra?.value || '').trim()) {
            const estado = capturarEstadoMuestraPacking();
            if (hayDatosTrabajoMuestraPacking(estado)) {
                return {
                    raw,
                    num_muestra: parts[0] || '',
                    ensayo_numero: parts[1] || '',
                    estado,
                    quotaSnap: capturarQuotaSnapshotPacking_()
                };
            }
        }

        const borrador = leerBorradorMuestraPacking_(fecha, raw);
        if (borrador && hayDatosTrabajoMuestraPacking(borrador)) {
            return {
                raw,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || '',
                estado: borrador,
                quotaSnap: borrador.packingQuotaSnapshot || {}
            };
        }

        return capturaEstadoMuestraParaValidacion_(raw);
    }

    async function asegurarCapturaEnvioPacking_(rawMuestra) {
        let cap = capturaEstadoMuestraParaEnvio_(rawMuestra);
        if (cap && hayDatosTrabajoMuestraPacking(cap.estado)) return cap;
        const raw = String(rawMuestra || '').trim();
        if (!raw || raw === String(elMuestra?.value || '').trim()) return cap;
        await cargarMuestraPackingParaEnvio_(raw);
        cap = capturaEstadoMuestraParaEnvio_(raw);
        if (cap && hayDatosTrabajoMuestraPacking(cap.estado)) return cap;
        return null;
    }

    function asegurarBorradoresAntesEnvioPacking_(lista) {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return;
        guardarBorradorMuestraActivaInmediato_();
        const store = leerStoreBorradorPacking();
        const raws = new Set((lista || []).map((item) => String(item?.raw || '').trim()).filter(Boolean));
        obtenerOpcionesMuestraPackingSelect_().forEach((raw) => raws.add(raw));
        raws.forEach((raw) => {
            const cap = capturaEstadoMuestraParaEnvio_(raw);
            if (!cap || !hayDatosTrabajoMuestraPacking(cap.estado)) return;
            const key = claveBorradorMuestraPacking(fecha, raw);
            if (key) store.porClave[key] = cap.estado;
        });
        const rawActivo = String(elMuestra?.value || '').trim();
        if (rawActivo) {
            const keyActiva = claveBorradorMuestraPacking(fecha, rawActivo);
            if (keyActiva) store.activa = keyActiva;
        }
        escribirStoreBorradorPacking(store);
    }

    function itemMuestraPackingParaLista_(raw, numMuestra, ensayoNumero) {
        return {
            raw,
            num_muestra: numMuestra,
            ensayo_numero: ensayoNumero,
            etiqueta: textoSelectMuestra(numMuestra, ensayoNumero)
        };
    }

    function obtenerOpcionesMuestraPackingSelect_() {
        if (!elMuestra) return [];
        return Array.from(elMuestra.options)
            .map((opt) => String(opt.value || '').trim())
            .filter((v) => v && v.includes('|'));
    }

    function muestraPackingCuotaLlena_(estado, quotaSnap) {
        const snap = quotaSnap && typeof quotaSnap === 'object' ? quotaSnap : {};
        const max = cuotaMaximaDesdeSnapshotPacking(snap);
        const enSrv = Number(snap.filasPackingRegistradas) || 0;
        const cards = Array.isArray(estado?.packingCards) ? estado.packingCards.length : 0;
        if (max <= 0) return cards > 0;
        return enSrv + cards >= max;
    }

    function muestraPackingListaParaModal_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (muestraPackingYaCompletaEnServidor_(raw)) return null;
        const parts = raw.split('|');
        const numMuestra = parts[0] || '';
        const ensayoNumero = parts[1] || '';
        if (!ensayoNumero) return null;

        if (raw === String(elMuestra?.value || '').trim()) {
            const estado = capturarEstadoMuestraPacking();
            const snap = capturarQuotaSnapshotPacking_();
            if (!hayDatosTrabajoMuestraPacking(estado)) return null;
            if (restantesPorAgregarPacking() !== 0 && !muestraPackingCuotaLlena_(estado, snap)) return null;
            return itemMuestraPackingParaLista_(raw, numMuestra, ensayoNumero);
        }

        const key = claveBorradorMuestraPacking(fecha, raw);
        const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
        if (!borrador || !hayDatosTrabajoMuestraPacking(borrador)) return null;
        const snap = borrador.packingQuotaSnapshot || {};
        const rest = restantesDesdeEstadoMuestraPacking(borrador, snap);
        if (rest !== 0 && !muestraPackingCuotaLlena_(borrador, snap)) return null;
        return itemMuestraPackingParaLista_(raw, numMuestra, ensayoNumero);
    }

    function obtenerMuestrasListasModalEnvioPacking_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        const vistos = new Set();
        const out = [];
        recogerCandidatosMuestrasPackingDelDia_(fecha).forEach((raw) => {
            if (!raw || vistos.has(raw)) return;
            vistos.add(raw);
            const item = muestraPackingListaParaModal_(raw);
            if (item) out.push(item);
        });
        return ordenarMuestrasPackingPorEnsayo_(out);
    }

    function persistirBorradoresContadorCeroPacking_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso || elFecha?.value);
        if (!fecha) return;
        const store = leerStoreBorradorPacking();
        const rawActivo = String(elMuestra?.value || '').trim();

        if (rawActivo) {
            const estadoActivo = capturarEstadoMuestraPacking();
            if (hayDatosTrabajoMuestraPacking(estadoActivo)) {
                const keyActiva = claveBorradorMuestraPacking(fecha, rawActivo);
                if (keyActiva) store.porClave[keyActiva] = estadoActivo;
            }
        }

        recogerCandidatosMuestrasPackingDelDia_(fecha).forEach((raw) => {
            if (!raw || raw === rawActivo) return;
            const borrador = leerBorradorMuestraPacking_(fecha, raw);
            if (borrador && hayDatosTrabajoMuestraPacking(borrador)) {
                const key = claveBorradorMuestraPacking(fecha, raw);
                if (key) store.porClave[key] = borrador;
                return;
            }
            const cap = capturaEstadoMuestraParaEnvio_(raw);
            if (!cap || !hayDatosTrabajoMuestraPacking(cap.estado)) return;
            const key = claveBorradorMuestraPacking(fecha, raw);
            if (key) store.porClave[key] = cap.estado;
        });

        if (rawActivo) {
            const keyActiva = claveBorradorMuestraPacking(fecha, rawActivo);
            if (keyActiva) store.activa = keyActiva;
        }
        escribirStoreBorradorPacking(store);
    }

    /** Muestra con la que el usuario trabajó: borrador local, pantalla activa o ya en planilla. */
    function muestraPackingEnUso_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return false;
        if (muestraPackingYaCompletaEnServidor_(raw)) return true;
        const borrador = leerBorradorMuestraPacking_(fecha, raw);
        if (borrador && hayDatosTrabajoMuestraPacking(borrador)) return true;
        if (raw === String(elMuestra?.value || '').trim()) {
            return hayDatosTrabajoMuestraPacking(capturarEstadoMuestraPacking());
        }
        return false;
    }

    function resumenMuestraPackingDelDia_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        if (!fecha || !raw) return null;
        if (!muestraPackingEnUso_(raw)) return null;
        const parts = raw.split('|');
        const numMuestra = parts[0] || '';
        const ensayoNumero = parts[1] || '';
        const etiqueta = textoSelectMuestra(numMuestra, ensayoNumero);
        const base = { raw, num_muestra: numMuestra, ensayo_numero: ensayoNumero, etiqueta };

        if (muestraPackingYaCompletaEnServidor_(raw)) {
            return Object.assign(base, { estado: 'enviada', restantes: 0 });
        }

        if (muestraPackingListaParaModal_(raw)) {
            return Object.assign(base, { estado: 'lista', restantes: 0 });
        }

        if (raw === String(elMuestra?.value || '').trim()) {
            const estado = capturarEstadoMuestraPacking();
            if (!hayDatosTrabajoMuestraPacking(estado)) {
                return Object.assign(base, { estado: 'sin_datos', restantes: null });
            }
            const rest = restantesPorAgregarPacking();
            return Object.assign(base, {
                estado: rest === 0 ? 'lista' : 'incompleta',
                restantes: rest
            });
        }

        const borrador = leerBorradorMuestraPacking_(fecha, raw);
        if (!borrador || !hayDatosTrabajoMuestraPacking(borrador)) {
            return Object.assign(base, { estado: 'sin_datos', restantes: null });
        }
        const snap = borrador.packingQuotaSnapshot || {};
        const rest = restantesDesdeEstadoMuestraPacking(borrador, snap);
        const lista = rest === 0 || muestraPackingCuotaLlena_(borrador, snap);
        return Object.assign(base, {
            estado: lista ? 'lista' : 'incompleta',
            restantes: rest
        });
    }

    function analizarMuestrasPackingDelDia_() {
        const opciones = obtenerOpcionesMuestraPackingSelect_();
        const resumenes = opciones.map((raw) => resumenMuestraPackingDelDia_(raw)).filter(Boolean);
        const listas = resumenes
            .filter((r) => r.estado === 'lista')
            .map((r) => itemMuestraPackingParaLista_(r.raw, r.num_muestra, r.ensayo_numero));
        const incompletas = resumenes.filter((r) => r.estado === 'incompleta');
        const sinDatos = resumenes.filter((r) => r.estado === 'sin_datos');
        const pendientes = incompletas.concat(sinDatos);
        const enUso = resumenes.map((r) => r.raw);
        const numerosDia = enUso
            .map((raw) => numeroEnsayoPackingDesdeRaw(raw))
            .filter((n) => n > 0)
            .sort((a, b) => a - b);
        const numerosListas = listas
            .map((item) => numeroEnsayoPackingDesdeRaw(item.raw))
            .filter((n) => n > 0);
        const numerosEnviadas = resumenes
            .filter((r) => r.estado === 'enviada')
            .map((r) => numeroEnsayoPackingDesdeRaw(r.raw))
            .filter((n) => n > 0);
        const huecosEntreListas = detectarHuecosSecuenciaPacking_(listas).huecos;
        const huecosEnDia = [];
        if (numerosDia.length) {
            const min = numerosDia[0];
            const max = numerosDia[numerosDia.length - 1];
            for (let n = min; n <= max; n++) {
                const enDia = numerosDia.includes(n);
                const satisfecha = numerosListas.includes(n) || numerosEnviadas.includes(n);
                if (enDia && !satisfecha) huecosEnDia.push(n);
            }
        }
        return {
            opciones,
            enUso,
            resumenes,
            listas: ordenarMuestrasPackingPorEnsayo_(listas),
            incompletas,
            sinDatos,
            pendientes,
            huecosEntreListas,
            huecosEnDia
        };
    }

    function textoPendienteMuestraPacking_(r) {
        const etiqueta = r.etiqueta || textoSelectMuestra(r.num_muestra, r.ensayo_numero);
        if (r.estado === 'sin_datos') {
            return '<li><b>' + etiqueta + '</b> — sin datos de packing</li>';
        }
        const rest = Number(r.restantes);
        const det = Number.isFinite(rest) && rest > 0
            ? ('faltan <b>' + rest + '</b> clamshell(s) · contador debe estar en <b>0</b>')
            : 'contador debe estar en <b>0</b>';
        return '<li><b>' + etiqueta + '</b> — ' + det + '</li>';
    }

    async function confirmarContinuarEnvioConPendientesPacking_(analisis) {
        const pendientes = analisis?.pendientes || [];
        if (!pendientes.length) return true;

        const listas = analisis.listas || [];
        const htmlPend = '<ul style="margin:8px 0 0;padding-left:18px;text-align:left;font-size:13px;color:#475569;">'
            + pendientes.map((r) => textoPendienteMuestraPacking_(r)).join('')
            + '</ul>';
        const htmlListas = listas.length
            ? '<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Listas para enviar (contador en 0): <b>'
                + listas.map((x) => x.etiqueta || x.ensayo_numero).join(', ')
                + '</b></p>'
            : '';
        const html = '<p style="margin:0;font-size:13px;color:#475569;">Hay muestras del día que <b>no están completas</b> '
            + '(el badge del + debe estar en <b>0 verde</b>, no en número como 7):</p>'
            + htmlPend
            + htmlListas
            + '<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Completa esos datos o continúa solo con las muestras listas.</p>';

        if (window.Swal && typeof window.Swal.fire === 'function') {
            const r = await swalFirePacking({
                icon: 'warning',
                title: 'Muestras incompletas',
                html: html,
                showCancelButton: true,
                cancelButtonText: 'Completar datos',
                confirmButtonText: listas.length ? 'Continuar a enviar' : 'Entendido',
                allowOutsideClick: false
            });
            if (!listas.length) return false;
            return !!(r && r.isConfirmed);
        }
        if (!listas.length) {
            mostrarToastPacking(
                'warning',
                'Muestras incompletas',
                'Completa todas las muestras (contador en 0) antes de enviar.'
            );
            return false;
        }
        return true;
    }

    function resolverCandidatasModalEnvioPacking_(completas) {
        const analisis = analizarMuestrasPackingDelDia_();
        const listasModal = analisis.listas.length
            ? analisis.listas
            : obtenerMuestrasListasModalEnvioPacking_();
        return unirMuestrasPackingParaEnvio_([completas, listasModal]);
    }

    function unirMuestrasPackingParaEnvio_(listas) {
        const map = new Map();
        (listas || []).forEach((lista) => {
            (lista || []).forEach((item) => {
                if (item?.raw) map.set(item.raw, item);
            });
        });
        return ordenarMuestrasPackingPorEnsayo_(Array.from(map.values()));
    }

    function obtenerMuestrasCompletasPackingParaEnvio_() {
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!fecha) return [];
        const candidatos = recogerCandidatosMuestrasPackingDelDia_(fecha);

        const vistos = new Set();
        const out = [];
        candidatos.forEach((raw) => {
            if (!raw || vistos.has(raw)) return;
            vistos.add(raw);
            const cap = capturaEstadoMuestraParaValidacion_(raw);
            if (!cap || !muestraPackingPendienteDeEnvio_(cap.estado, cap.quotaSnap, raw)) return;
            out.push(itemMuestraPackingParaLista_(cap.raw, cap.num_muestra, cap.ensayo_numero));
        });
        return ordenarMuestrasPackingPorEnsayo_(out);
    }

    function persistirBorradoresCompletasPacking_(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return;
        const store = leerStoreBorradorPacking();
        const rawActivo = String(elMuestra?.value || '').trim();
        const candidatos = recogerCandidatosMuestrasPackingDelDia_(fecha);
        const paraPersistir = [];
        candidatos.forEach((raw) => {
            const cap = capturaEstadoMuestraParaValidacion_(raw);
            if (!cap || !muestraPackingPendienteDeEnvio_(cap.estado, cap.quotaSnap, raw)) return;
            paraPersistir.push(cap);
        });
        ordenarMuestrasPackingPorEnsayo_(paraPersistir.map((cap) => ({
            raw: cap.raw,
            num_muestra: cap.num_muestra,
            ensayo_numero: cap.ensayo_numero
        }))).reverse().forEach((item) => {
            const cap = capturaEstadoMuestraParaValidacion_(item.raw);
            if (!cap || !hayDatosTrabajoMuestraPacking(cap.estado)) return;
            const key = claveBorradorMuestraPacking(fecha, item.raw);
            if (key) store.porClave[key] = cap.estado;
        });
        if (rawActivo) {
            const keyActiva = claveBorradorMuestraPacking(fecha, rawActivo);
            if (keyActiva) store.activa = keyActiva;
        }
        escribirStoreBorradorPacking(store);
    }

    function prepararDeteccionEnvioPackingLocal_() {
        guardarBorradorMuestraActivaInmediato_();
        persistirBorradoresContadorCeroPacking_(elFecha?.value);
        persistirBorradoresCompletasPacking_(elFecha?.value);
        const fecha = normalizarFechaIso(elFecha?.value);
        const rawActivo = String(elMuestra?.value || '').trim();
        if (rawActivo && lastDetallePacking) {
            registrarQuotaServidorMuestraPacking_(fecha, rawActivo, lastDetallePacking);
        }
        return obtenerMuestrasCompletasPackingParaEnvio_();
    }

    async function prepararDeteccionEnvioPacking_() {
        const completas = prepararDeteccionEnvioPackingLocal_();
        const enUso = muestrasEnUsoPackingDelDia_();
        if (necesitaRefrescarQuotaServidorPacking_(enUso)) {
            await refrescarQuotaServidorMuestrasPacking_(enUso, { soloSinCache: true });
            return obtenerMuestrasCompletasPackingParaEnvio_();
        }
        return completas;
    }

    function puedeRefrescarFechaPacking_() {
        if (envioPackingEnCurso) return false;
        if (document.querySelector('.swal2-container')) return false;
        return true;
    }

    function restaurarEstadoCompletoDesdeBorradorActivo_() {
        if (!muestraSeleccionada() || packingCards.length) return false;
        const key = claveBorradorMuestraPacking(elFecha?.value, elMuestra?.value);
        const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
        const snap = borrador?.packingQuotaSnapshot || { ...packingQuota };
        if (!borrador || !muestraPackingEstadoCompleto_(borrador, snap)) return false;
        aplicarEstadoMuestraPacking(borrador, { skipPreview: true });
        return packingCards.length > 0;
    }

    async function cargarMuestraPackingParaEnvio_(rawMuestra) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawMuestra || '').trim();
        const parts = raw.split('|');
        const ensayoNumero = parts[1] || '';
        if (!fecha || !raw || !ensayoNumero) return false;
        const prev = String(elMuestra?.value || '').trim();
        cancelarGuardadoBorradorProgramadoPacking_();
        if (prev && prev !== raw) {
            const estadoUi = capturarEstadoMuestraPacking();
            snapshotMuestraPackingSiHayTrabajo(fecha, prev, estadoUi);
        }
        packingRestaurandoBorrador = true;
        if (elMuestra) elMuestra.value = raw;
        packingMuestraAnterior = raw;
        packingRestaurandoBorrador = false;
        const key = claveBorradorMuestraPacking(fecha, raw);
        const store = leerStoreBorradorPacking();
        store.activa = key;
        escribirStoreBorradorPacking(store);
        const borrador = key ? store.porClave[key] : null;
        if (borrador && hayDatosTrabajoMuestraPacking(borrador)) {
            aplicarEstadoMuestraPacking(borrador, { skipPreview: true });
        }
        await cargarDetalle(fecha, ensayoNumero);
        actualizarFabRestanteBadge();
        return true;
    }

    async function seleccionarMuestraPackingParaEnviar_(preferida, completas, analisis) {
        const lista = ordenarMuestrasPackingPorEnsayo_(completas || []);
        if (!lista.length) return null;
        const info = analisis || analizarMuestrasPackingDelDia_();
        const { huecos } = detectarHuecosSecuenciaPacking_(lista);
        const huecosDia = info.huecosEnDia || [];
        const secuenciaContinua = huecos.length === 0 && huecosDia.length === 0;
        if (lista.length === 1) return { modo: 'una', raw: lista[0].raw };

        const opts = {};
        lista.forEach((item) => {
            opts[item.raw] = (item.etiqueta || textoSelectMuestra(item.num_muestra, item.ensayo_numero))
                + ' · contador 0';
        });
        const pref = lista.find((x) => x.raw === preferida)?.raw || lista[lista.length - 1].raw;

        let htmlSecuencia = '<p style="margin:0 0 10px;font-size:13px;color:#64748b;">'
            + 'Solo aparecen muestras con contador en <b>0</b> (badge verde en el botón +).</p>';
        if (secuenciaContinua) {
            htmlSecuencia += '<p style="margin:0 0 10px;font-size:13px;color:#64748b;">'
                + 'Puedes enviar una o todas juntas en orden.</p>';
        } else {
            const faltan = huecosDia.length ? huecosDia : huecos;
            htmlSecuencia += '<p style="margin:0 0 10px;font-size:13px;color:#b45309;">'
                + '<b>Hay hueco en la secuencia</b> (muestra ' + faltan.join(', ')
                + ' sin contador en 0). Completa esos datos o envía <b>una muestra</b> a la vez.</p>';
        }
        if (info.pendientes?.length) {
            htmlSecuencia += '<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">No listadas (incompletas): '
                + info.pendientes.map((r) => r.etiqueta || r.ensayo_numero).join(', ')
                + '</p>';
        }

        if (window.Swal && typeof window.Swal.fire === 'function') {
            const r = await swalFirePacking({
                icon: 'question',
                title: 'Packing listo para enviar',
                html: htmlSecuencia,
                input: 'select',
                inputOptions: opts,
                inputValue: pref,
                confirmButtonText: 'Enviar muestra',
                showDenyButton: secuenciaContinua,
                denyButtonText: 'Enviar muestras juntas',
                showCancelButton: true,
                cancelButtonText: 'Cancelar',
                denyButtonColor: '#1f4f82',
                allowOutsideClick: false
            });
            if (r.isDenied && secuenciaContinua) return { modo: 'todas', lista };
            if (!r.isConfirmed) return null;
            return { modo: 'una', raw: String(r.value || '').trim() || pref };
        }
        return { modo: 'una', raw: pref };
    }

    function slotsDisponiblesEnServidorPacking() {
        const max = cuotaMaximaEfectivaPacking();
        return Math.max(0, max - packingQuota.filasPackingRegistradas);
    }

    function crearCardPacking(num) {
        return {
            id: ++packingCardSeq,
            clamshellNum: num,
            pesos: pesosVaciosPacking(),
            observacion: ''
        };
    }

    function esCardPackingSinDatos_(card) {
        if (!card) return false;
        const p = card.pesos || pesosVaciosPacking();
        if (Object.keys(p).some((k) => pesoNumero(p[k]) > 0)) return false;
        return !String(card.observacion || '').trim();
    }

    function primerCardVacioPacking_() {
        return packingCards.find((c) => esCardPackingSinDatos_(c)) || null;
    }

    function crearElementoCardPreviewPacking(motivo) {
        const previewCard = { clamshellNum: 1, pesos: pesosVaciosPacking(), observacion: '' };
        const art = crearElementoCardPacking(previewCard, 0);
        art.classList.add('packing-card-preview');
        art.classList.remove('packing-card-clickable');
        art.removeAttribute('tabindex');
        art.removeAttribute('data-card-id');
        if (motivo === 'completo') {
            art.dataset.previewMotivo = 'completo';
        }
        return art;
    }

    function ensureCardPorDefectoPacking() {
        if (!muestraSeleccionada() || packingCards.length > 0) return null;
        const disponibles = slotsDisponiblesEnServidorPacking();
        if (disponibles <= 0) {
            packingCards = [];
            packingActiveCardId = null;
            setStatus(
                'Packing completo en servidor ('
                + packingQuota.filasPackingRegistradas + '/' + cuotaMaximaEfectivaPacking() + ').',
                'warn'
            );
            renderizarCardsPacking();
            actualizarFabRestanteBadge();
            actualizarBtnEnviarPacking();
            return null;
        }
        const num = packingQuota.filasPackingRegistradas + 1;
        const card = crearCardPacking(num);
        packingCards = [card];
        packingActiveCardId = card.id;
        renderizarCardsPacking();
        setStatus('');
        if (elStatus) elStatus.hidden = true;
        return card;
    }

    function getCardPackingById(id) {
        return packingCards.find((c) => c.id === id) || null;
    }

    function ultimoCardPacking_() {
        if (!packingCards.length) return null;
        return packingCards.reduce((a, b) => (
            Number(a.clamshellNum) >= Number(b.clamshellNum) ? a : b
        ));
    }

    function esUltimoCardPacking_(card) {
        const ultimo = ultimoCardPacking_();
        return !!(ultimo && card && Number(card.id) === Number(ultimo.id));
    }

    function actualizarFabRestanteBadge() {
        const rest = restantesPorAgregarPacking();
        const max = cuotaMaximaEfectivaPacking();
        const hayMuestra = muestraSeleccionada();
        const hayTrabajo = hayMuestra && hayDatosTrabajoMuestraPacking(capturarEstadoMuestraPacking());
        const yaEnServidor = hayMuestra && muestraPackingYaCompletaEnServidor_(packingQuota);
        const listaParaEnviar = hayTrabajo && rest === 0 && muestraPackingCompletaEnPantalla_() && !yaEnServidor;
        const contadorCero = rest === 0;
        if (listaParaEnviar && !packingBadgeWasComplete) {
            guardarBorradorMuestraActivaInmediato_();
        }
        packingBadgeWasComplete = listaParaEnviar;

        if (elFabRestanteBadge) {
            if (!hayMuestra) {
                elFabRestanteBadge.setAttribute('aria-hidden', 'true');
                elFabRestanteBadge.classList.remove('is-complete', 'is-pending');
            } else {
                elFabRestanteBadge.removeAttribute('aria-hidden');
                elFabRestanteBadge.textContent = String(rest);
                elFabRestanteBadge.classList.toggle('is-complete', contadorCero);
                elFabRestanteBadge.classList.toggle('is-pending', rest > 0);
            }
        }
        if (elFabAgregar) {
            elFabAgregar.disabled = false;
            elFabAgregar.title = !hayMuestra
                ? 'Seleccionar muestra para continuar por favor'
                : (yaEnServidor
                    ? ('Ya en planilla · ' + packingQuota.filasPackingRegistradas + '/' + max + ' clamshells')
                    : (listaParaEnviar
                        ? ('Lista para enviar · ' + packingQuota.filasPackingRegistradas + '/' + max + ' clamshells')
                        : (rest > 0
                            ? ('Agregar clamshell · faltan ' + rest + ' de ' + max)
                            : ('Límite packing · ' + packingQuota.filasPackingRegistradas + '/' + max))));
        }
    }

    function onFabAgregarPackingClick() {
        const ahora = Date.now();
        if (fabAgregarPackingEnCurso_ || ahora - fabAgregarPackingTs_ < 450) return;
        fabAgregarPackingTs_ = ahora;
        fabAgregarPackingEnCurso_ = true;
        try {
            if (!muestraSeleccionada()) {
                mostrarToastPacking('info', 'Seleccionar muestra', 'Seleccionar muestra para continuar por favor.');
                return;
            }
            if (restantesPorAgregarPacking() <= 0 && !primerCardVacioPacking_()) {
                const max = cuotaMaximaEfectivaPacking();
                mostrarToastPacking(
                    'info',
                    'Límite alcanzado',
                    'Ya no puedes agregar clamshells (' + packingQuota.filasPackingRegistradas + '/' + max + ').'
                );
                return;
            }
            agregarCardPackingYAbrirPesos();
        } finally {
            fabAgregarPackingEnCurso_ = false;
        }
    }

    function htmlMetricActionsPacking(isPrimary) {
        const tiempoTitle = isPrimary ? 'Tiempos de la muestra' : 'Ver tiempos de la muestra';
        const readonlyAttr = isPrimary ? '' : ' data-tiempos-readonly="1"';
        const countId = isPrimary ? ' id="packing-metric-tiempo-count"' : '';
        const countCls = isPrimary ? '' : ' packing-metric-tiempo-count-mirror';
        const presionAmbCountId = isPrimary ? ' id="packing-metric-presion-amb-count"' : '';
        const presionAmbCountCls = isPrimary ? '' : ' packing-metric-presion-amb-count-mirror';
        const presionFrutaCountId = isPrimary ? ' id="packing-metric-presion-fruta-count"' : '';
        const presionFrutaCountCls = isPrimary ? '' : ' packing-metric-presion-fruta-count-mirror';
        return '<div class="metric-actions">'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn packing-metric-tiempo-open-btn" type="button"' + readonlyAttr
            + ' title="' + tiempoTitle + '" aria-label="' + tiempoTitle + '">'
            + '<i data-lucide="timer"></i></button>'
            + '<span class="metric-count' + countCls + '"' + countId + '>0/5</span></div>'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn packing-metric-presion-amb-btn" type="button"'
            + ' title="Presión vapor ambiente (Kpa)" aria-label="Presión ambiente">'
            + '<i data-lucide="cloud"></i></button>'
            + '<span class="metric-count' + presionAmbCountCls + '"' + presionAmbCountId + '>0/5</span></div>'
            + '<div class="metric-btn-wrap">'
            + '<button class="metric-btn packing-metric-presion-fruta-btn" type="button"'
            + ' title="Presión vapor fruta (Kpa)" aria-label="Presión fruta">'
            + '<i data-lucide="apple"></i></button>'
            + '<span class="metric-count' + presionFrutaCountCls + '"' + presionFrutaCountId + '>0/5</span></div>'
            + '</div>';
    }

    function crearElementoCardPacking(card, index) {
        const p = card.pesos;
        const num = card.clamshellNum;
        const obs = String(card.observacion || '').trim();
        const obsHtml = obs ? escHtmlPacking(obs) : '';
        const ultimoCard = ultimoCardPacking_();
        const esUltimo = esUltimoCardPacking_(card);
        const canDelete = packingCards.length > 1 && esUltimo;
        const tituloDelete = canDelete
            ? 'Eliminar último clamshell'
            : (packingCards.length <= 1
                ? 'Debe quedar al menos uno'
                : 'Elimina primero el Clamshell #' + (ultimoCard?.clamshellNum || ''));
        const art = document.createElement('article');
        art.className = 'clamshell-card packing-clamshell-card packing-card-clickable';
        art.dataset.cardId = String(card.id);
        art.setAttribute('aria-label', 'Clamshell ' + num);
        art.tabIndex = 0;
        art.innerHTML = ''
            + '<div class="card-header">'
            + '<div class="id-badge">'
            + '<div class="number-box packing-clamshell-num">' + num + '</div>'
            + '<div class="packing-card-title-block">'
            + '<p class="packing-card-title">Clamshell</p>'
            + '<span class="packing-card-sub">' + textoVariedadCardPacking() + '</span>'
            + '</div></div>'
            + '<div class="clamshell-header-actions">'
            + '<button type="button" class="jarra-tag packing-peso-recep-btn" data-card-id="' + card.id + '" title="Peso recepción packing">'
            + '<span class="packing-peso-recep-text"><span class="packing-peso-recep-label">PESO RECEP.</span>'
            + '<span class="' + clasePesoCard(p.recepcion, 'packing-peso-recep-val') + '">' + textoPesoCard(p.recepcion) + '</span></span></button>'
            + '<button type="button" class="clamshell-delete-btn packing-card-delete" data-card-id="' + card.id + '" '
            + (canDelete ? '' : 'disabled ')
            + 'title="' + tituloDelete + '" aria-label="Eliminar">'
            + '<i data-lucide="trash-2"></i></button></div></div>'
            + '<div class="weights-panel"><div class="weights-grid packing-weights-grid">'
            + '<div class="weight-box"><label>PESO I-GASIF.</label><span class="' + clasePesoCard(p.ingresoGas) + '">' + textoPesoCard(p.ingresoGas) + '</span></div>'
            + '<div class="weight-box"><label>PESO S-GASIF.</label><span class="' + clasePesoCard(p.salidaGas) + '">' + textoPesoCard(p.salidaGas) + '</span></div>'
            + '<div class="observation-box"><button type="button" class="packing-observation-btn" data-card-id="' + card.id + '" title="Editar observación">'
            + '<span class="observation-text' + (obs ? '' : ' is-empty') + '">'
            + (obsHtml || 'Sin observación registrada') + '</span></button></div>'
            + '</div>' + htmlMetricActionsPacking(index === 0) + '</div>'
            + '<div class="logistics-info packing-prefrio-row">'
            + '<div class="logistic-point"><i data-lucide="calendar-check-2"></i><div>'
            + '<p style="color: #94A3B8; font-size: 9px;">PESO INGRESO PREFRIO</p><b class="' + (pesoDisplayVacio(p.ingresoPre) ? 'is-empty-peso' : '') + '">' + textoPesoCard(p.ingresoPre) + '</b></div></div>'
            + '<div class="logistic-point"><i data-lucide="truck"></i><div>'
            + '<p style="color: #94A3B8; font-size: 9px;">PESO SALIDA PREFRIO</p><b class="' + (pesoDisplayVacio(p.salidaPre) ? 'is-empty-peso' : '') + '">' + textoPesoCard(p.salidaPre) + '</b></div></div>'
            + '</div>';
        return art;
    }

    function renderizarCardsPacking() {
        if (!elCardsWrap) return;
        elCardsWrap.innerHTML = '';
        if (!packingCards.length) {
            const motivo = (muestraSeleccionada() && slotsDisponiblesEnServidorPacking() <= 0) ? 'completo' : '';
            elCardsWrap.appendChild(crearElementoCardPreviewPacking(motivo));
        } else {
            packingCards.forEach((card, index) => {
                elCardsWrap.appendChild(crearElementoCardPacking(card, index));
            });
        }
        elMetricTiempoBtn = document.querySelector('#packing-cards-wrap .packing-metric-tiempo-open-btn:not([data-tiempos-readonly])');
        elMetricTiempoCount = document.getElementById('packing-metric-tiempo-count');
        elMetricPresionAmbCount = document.getElementById('packing-metric-presion-amb-count');
        elMetricPresionFrutaCount = document.getElementById('packing-metric-presion-fruta-count');
        const cardsDisabled = elCardsWrap.classList.contains('is-disabled');
        document.querySelectorAll('.packing-metric-tiempo-open-btn').forEach((btn) => {
            btn.disabled = cardsDisabled;
        });
        document.querySelectorAll('.packing-metric-presion-amb-btn, .packing-metric-presion-fruta-btn').forEach((btn) => {
            btn.disabled = cardsDisabled;
        });
        document.querySelectorAll('.packing-observation-btn').forEach((btn) => {
            btn.disabled = cardsDisabled;
        });
        actualizarContadoresTiempo();
        actualizarContadoresPresionPacking();
        crearIconosPacking();
        actualizarFabRestanteBadge();
        actualizarBtnEnviarPacking();
    }

    function reiniciarCardsPacking() {
        packingCardSeq = 0;
        packingCards = [];
        packingActiveCardId = null;
        const disponibles = slotsDisponiblesEnServidorPacking();
        if (disponibles <= 0) {
            packingCards = [];
            packingActiveCardId = null;
            setStatus(
                'Packing completo en servidor ('
                + packingQuota.filasPackingRegistradas + '/' + cuotaMaximaEfectivaPacking() + ').',
                'warn'
            );
            renderizarCardsPacking();
            return;
        }
        setStatus('');
        if (elStatus) elStatus.hidden = true;
        const card = crearCardPacking(packingQuota.filasPackingRegistradas + 1);
        packingCards = [card];
        packingActiveCardId = card.id;
        renderizarCardsPacking();
    }

    function resetCardsPacking() {
        packingQuota.filasTotalCampo = 0;
        packingQuota.filasPackingRegistradas = 0;
        packingQuota.maxClamshell = 0;
        packingQuota.tipoMuestra = 'T';
        packingQuota.variedadMuestra = '';
        packingCards = [];
        packingActiveCardId = null;
        renderizarCardsPacking();
    }

    function agregarCardPacking() {
        if (!muestraSeleccionada() || restantesPorAgregarPacking() <= 0) return null;
        const num = packingQuota.filasPackingRegistradas + packingCards.length + 1;
        const card = crearCardPacking(num);
        packingCards.push(card);
        packingActiveCardId = card.id;
        renderizarCardsPacking();
        establecerMenuFlotantePacking(false);
        programarGuardadoBorradorPacking();
        return card;
    }

    function agregarCardPackingYAbrirPesos() {
        let card = primerCardVacioPacking_();
        if (!card) {
            if (!packingCards.length) {
                card = ensureCardPorDefectoPacking();
            } else if (restantesPorAgregarPacking() > 0) {
                card = agregarCardPacking();
            }
        }
        if (!card) return;
        abrirModalPesosPacking(card.id);
    }

    async function eliminarCardPacking(cardId) {
        if (packingCards.length <= 1) {
            mostrarToastPacking('info', 'No se puede eliminar', 'Debe quedar al menos un clamshell en la muestra.');
            return;
        }
        const card = getCardPackingById(cardId);
        if (!card) return;
        if (!esUltimoCardPacking_(card)) return;
        const mensaje = 'Se eliminará Clamshell #' + card.clamshellNum + ' de esta muestra. ¿Deseas continuar?';
        const confirmado = await confirmarSwalPacking_({
            icon: 'warning',
            title: 'Confirmar eliminación',
            text: mensaje,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'No',
            confirmButtonColor: '#D92D20',
            reverseButtons: true,
            allowOutsideClick: false
        });
        if (!confirmado) return;
        packingCards = packingCards.filter((c) => c.id !== cardId);
        packingCards.forEach((c, i) => {
            c.clamshellNum = packingQuota.filasPackingRegistradas + i + 1;
        });
        if (!getCardPackingById(packingActiveCardId)) {
            packingActiveCardId = packingCards[0]?.id ?? null;
        }
        renderizarCardsPacking();
        setStatus('');
        if (elStatus) elStatus.hidden = true;
        programarGuardadoBorradorPacking();
    }

    function quitarFocoModalPacking(overlayEl) {
        if (!overlayEl) return;
        const active = document.activeElement;
        if (active && overlayEl.contains(active) && typeof active.blur === 'function') {
            active.blur();
        }
    }

    function ocultarModalPacking(overlayEl) {
        if (!overlayEl) return;
        quitarFocoModalPacking(overlayEl);
        overlayEl.style.display = 'none';
        overlayEl.setAttribute('aria-hidden', 'true');
    }

    /** Clic en el fondo oscuro (fuera del panel) cierra sin guardar. */
    function bindCerrarModalAlClickFueraPacking(overlayEl, onDismiss) {
        if (!overlayEl || overlayEl.dataset.dismissBound === '1') return;
        overlayEl.dataset.dismissBound = '1';
        overlayEl.addEventListener('click', (e) => {
            const panel = overlayEl.querySelector('.modal-content, .time-picker-modal');
            if (panel && panel.contains(e.target)) return;
            onDismiss();
        });
    }

    function abrirModalPesosPacking(cardId) {
        if (!muestraSeleccionada() || !elPesosModal) return;
        const ahora = Date.now();
        if (elPesosModal.style.display === 'flex' && ahora - abrirModalPesosPackingTs_ < 450) return;
        abrirModalPesosPackingTs_ = ahora;
        const card = getCardPackingById(cardId) || getCardPackingById(packingActiveCardId) || packingCards[0];
        if (!card) return;
        packingActiveCardId = card.id;
        if (elPesosModalTitle) elPesosModalTitle.textContent = 'Editar Clamshell #' + card.clamshellNum;
        PACKING_PESO_CAMPOS.forEach((c) => {
            const inp = document.getElementById(c.inpId);
            if (inp) inp.value = valorPesoInputPacking(card.pesos[c.key]);
        });
        elPesosModal.style.display = 'flex';
        elPesosModal.setAttribute('aria-hidden', 'false');
        validarPesosModalEnVivo();
    }

    function cerrarModalPesosPacking() {
        if (!elPesosModal) return;
        ocultarModalPacking(elPesosModal);
        limpiarAlertaPesosModal();
    }

    function guardarModalPesosPacking() {
        if (guardandoModalPesosPacking_) return;
        guardandoModalPesosPacking_ = true;
        if (elPesosGuardar) elPesosGuardar.disabled = true;
        try {
            if (!muestraSeleccionada()) {
                setStatus('Selecciona una muestra antes de guardar.', 'warn');
                return;
            }
            const errores = validarPesosModalEnVivo();
            if (errores.length) {
                mostrarToastPacking('warning', 'Peso inválido', errores[0]);
                return;
            }
            if (!packingCards.length) ensureCardPorDefectoPacking();
            const card = getCardPackingById(packingActiveCardId) || packingCards[0];
            if (!card) {
                setStatus('No hay clamshell para guardar. Selecciona una muestra.', 'warn');
                return;
            }
            packingActiveCardId = card.id;
            PACKING_PESO_CAMPOS.forEach((c) => {
                const inp = document.getElementById(c.inpId);
                card.pesos[c.key] = pesoNumero(inp?.value);
            });
            renderizarCardsPacking();
            cerrarModalPesosPacking();
            setStatus('');
            if (elStatus) elStatus.hidden = true;
            mostrarToastPacking('success', 'Guardado', 'Clamshell #' + card.clamshellNum + ' actualizado.');
            programarGuardadoBorradorPacking();
        } finally {
            guardandoModalPesosPacking_ = false;
            validarPesosModalEnVivo();
        }
    }

    function aplicarPesosPackingARow(row, pesos) {
        const p = pesos || pesosVaciosPacking();
        PACKING_PESO_CAMPOS.forEach((c) => {
            if (c.rowIdx == null || c.rowIdx < 0) return;
            const n = pesoNumero(p[c.key]);
            row[c.rowIdx] = n > 0 ? String(n) : '';
        });
    }
    /** Solo consola: filas en servidor y despacho acopio (GET detalle), arriba → abajo. */
    function logMetaServidorPackingConsola(d) {
        if (!d) return;
        const total = Number(d.FILAS_REGISTRADAS ?? d.numFilas ?? 0);
        const totalOk = Number.isFinite(total) && total >= 0 ? total : 0;
        console.log('[Packing] Total de registro Clamshells en servidor:', totalOk);

        const porFila = Array.isArray(d.despachoPorFila) ? d.despachoPorFila : [];
        const fallback = d.DESPACHO_ACOPIO ?? d.despacho_acopio_gramos;
        for (let i = 0; i < totalOk; i++) {
            const v = porFila[i] != null && porFila[i] !== '' ? porFila[i] : fallback;
            console.log('[Packing] DESPACHO_ACOPIO (campo):', v != null && v !== '' ? v : '—', '· #' + (i + 1));
        }
    }

    function getTiemposMuestra() {
        return TIEMPOS_MUESTRA_IDS.map((id) => String(document.getElementById(id)?.value || '').trim());
    }

    function conteoTiemposMuestra() {
        const vals = getTiemposMuestra();
        const done = vals.filter(Boolean).length;
        return { done, total: TIEMPOS_MUESTRA_TOTAL };
    }

    function textoConteoTiempo(c) {
        return String(c.done) + '/' + String(c.total);
    }

    function actualizarContadoresTiempo() {
        const c = conteoTiemposMuestra();
        const txt = textoConteoTiempo(c);
        const filled = c.done > 0;
        if (elMetricTiempoCount) {
            elMetricTiempoCount.textContent = txt;
            elMetricTiempoCount.classList.toggle('is-filled', filled);
        }
        document.querySelectorAll('.packing-metric-tiempo-count-mirror').forEach((el) => {
            el.textContent = txt;
            el.classList.toggle('is-filled', filled);
        });
        actualizarBtnEnviarPacking();
    }

    function muestraSeleccionada() {
        return !!String(elMuestra?.value || '').trim();
    }

    let tiemposModalBackup = [];
    let tiemposModalSoloLectura = false;

    function tituloModalTiempos(clamshellNum, soloLectura) {
        const n = clamshellNum || (getCardPackingById(packingActiveCardId) || packingCards[0])?.clamshellNum || 1;
        let t = 'Tiempos de la muestra (hora) · Clamshell #' + n;
        if (soloLectura) t += ' · solo lectura';
        return t;
    }

    function limpiarTiemposModalVistaLectura() {
        TIEMPOS_MUESTRA_IDS.forEach((id, i) => {
            const inp = document.getElementById(id);
            if (!inp) return;
            if (inp.dataset.tiemposWasEmpty === '1') {
                inp.value = tiemposModalBackup[i] || '';
            }
            inp.classList.remove('packing-tiempo-inp--view', 'is-empty-time-display');
            delete inp.dataset.tiemposNoPicker;
            delete inp.dataset.tiemposWasEmpty;
            inp.readOnly = false;
            inp.disabled = false;
            if (!inp.placeholder) inp.placeholder = 'HH:MM';
        });
    }

    function aplicarTiemposModalVistaLectura() {
        TIEMPOS_MUESTRA_IDS.forEach((id, i) => {
            const inp = document.getElementById(id);
            if (!inp) return;
            const raw = String(tiemposModalBackup[i] ?? inp.value ?? '').trim();
            inp.classList.add('packing-tiempo-inp--view');
            inp.dataset.tiemposNoPicker = '1';
            inp.readOnly = true;
            inp.disabled = true;
            if (!raw) {
                inp.dataset.tiemposWasEmpty = '1';
                inp.value = '--:--';
                inp.placeholder = '';
                inp.classList.add('is-empty-time-display');
            } else {
                inp.value = raw;
                inp.placeholder = '';
                inp.classList.remove('is-empty-time-display');
            }
        });
    }

    function setTiemposModalSoloLectura(soloLectura) {
        tiemposModalSoloLectura = !!soloLectura;
        if (elTiemposModal) elTiemposModal.classList.toggle('is-readonly-view', soloLectura);
        if (!soloLectura) limpiarTiemposModalVistaLectura();
        if (elTiemposGuardar) {
            elTiemposGuardar.hidden = soloLectura;
            elTiemposGuardar.disabled = soloLectura;
        }
        if (soloLectura) limpiarAlertaTiemposModal();
    }

    function restaurarTiemposDesdeBackup() {
        TIEMPOS_MUESTRA_IDS.forEach((id, i) => {
            const inp = document.getElementById(id);
            if (inp) inp.value = tiemposModalBackup[i] || '';
        });
        actualizarContadoresTiempo();
    }

    function abrirTiemposMuestra(ev, opts) {
        if (!muestraSeleccionada()) return;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        if (!elTiemposModal) return;
        const soloLectura = !!(opts && opts.soloLectura);
        const clamshellNum = opts && opts.clamshellNum ? opts.clamshellNum : null;
        tiemposModalBackup = getTiemposMuestra();
        setTiemposModalSoloLectura(soloLectura);
        if (soloLectura) {
            aplicarTiemposModalVistaLectura();
        } else {
            TIEMPOS_MUESTRA_IDS.forEach((id) => {
                const inp = document.getElementById(id);
                if (inp) inp.disabled = false;
            });
            if (window.CustomTimePicker && typeof window.CustomTimePicker.init === 'function') {
                window.CustomTimePicker.init(elTiemposModal);
            }
        }
        if (elTiemposModalTitle) {
            elTiemposModalTitle.textContent = tituloModalTiempos(clamshellNum, soloLectura);
        }
        elTiemposModal.style.display = 'flex';
        elTiemposModal.setAttribute('aria-hidden', 'false');
        if (!soloLectura) validarTiemposModalEnVivo();
    }

    function cerrarTiemposMuestra(revertir) {
        if (!elTiemposModal) return;
        if (revertir && !tiemposModalSoloLectura) restaurarTiemposDesdeBackup();
        limpiarTiemposModalVistaLectura();
        setTiemposModalSoloLectura(false);
        limpiarAlertaTiemposModal();
        ocultarModalPacking(elTiemposModal);
    }

    function guardarTiemposMuestra() {
        if (tiemposModalSoloLectura) return;
        const errores = validarTiemposModalEnVivo();
        if (errores.length) {
            mostrarToastPacking('warning', 'Horario inválido', errores[0]);
            return;
        }
        actualizarContadoresTiempo();
        tiemposModalBackup = getTiemposMuestra();
        cerrarTiemposMuestra(false);
        mostrarToastPacking('success', 'Tiempos guardados', 'Los tiempos quedaron listos para enviar.');
        programarGuardadoBorradorPacking();
    }

    function setPackingCardHabilitada(on) {
        const habilitada = !!on;
        if (elHoraRow) {
            elHoraRow.classList.toggle('is-disabled', !habilitada);
            elHoraRow.setAttribute('aria-disabled', (!habilitada).toString());
        }
        if (elHoraInicio) elHoraInicio.disabled = !habilitada;
        if (elResponsable) elResponsable.disabled = !habilitada;
        if (elCardsWrap) {
            elCardsWrap.classList.toggle('is-disabled', !habilitada);
            elCardsWrap.setAttribute('aria-disabled', (!habilitada).toString());
        }
        const tituloTiempo = habilitada ? 'Tiempos de la muestra (hora)' : 'Selecciona una muestra';
        document.querySelectorAll('.packing-metric-tiempo-open-btn').forEach((btn) => {
            btn.disabled = !habilitada;
            if (habilitada) {
                btn.title = btn.hasAttribute('data-tiempos-readonly')
                    ? 'Ver tiempos de la muestra'
                    : 'Tiempos de la muestra';
            } else {
                btn.title = tituloTiempo;
            }
        });
        document.querySelectorAll('.packing-metric-presion-amb-btn, .packing-metric-presion-fruta-btn').forEach((btn) => {
            btn.disabled = !habilitada;
            if (habilitada) {
                btn.title = btn.classList.contains('packing-metric-presion-amb-btn')
                    ? 'Presión vapor ambiente (Kpa)'
                    : 'Presión vapor fruta (Kpa)';
            } else {
                btn.title = 'Selecciona una muestra';
            }
        });
        document.querySelectorAll('.packing-observation-btn').forEach((btn) => {
            btn.disabled = !habilitada;
            btn.title = habilitada ? 'Editar observación' : 'Selecciona una muestra';
        });
        if (elControlBarPacking) elControlBarPacking.classList.toggle('is-disabled', !habilitada);
        const tituloCg = habilitada ? 'Temperatura global' : 'Selecciona una muestra';
        const tituloCgHum = habilitada ? 'Humedad global' : 'Selecciona una muestra';
        if (elBtnTempPacking) {
            elBtnTempPacking.disabled = !habilitada;
            elBtnTempPacking.title = tituloCg;
        }
        if (elBtnHumPacking) {
            elBtnHumPacking.disabled = !habilitada;
            elBtnHumPacking.title = tituloCgHum;
        }
        if (elBtnViajePacking) elBtnViajePacking.disabled = !habilitada;
        actualizarBtnViajePackingTitulo_();
        if (!habilitada) cerrarModalControlGlobalPacking();
        actualizarBtnEnviarPacking();
        TIEMPOS_MUESTRA_IDS.forEach((id) => {
            const inp = document.getElementById(id);
            if (inp) inp.disabled = !habilitada;
        });
        if (!habilitada) {
            cerrarTiemposMuestra(true);
            cerrarModalPesosPacking();
            cerrarModalPresionPacking();
            cerrarModalObservacionPacking();
            cerrarModalViajePacking();
        } else {
            ensureCardPorDefectoPacking();
        }
        if (habilitada) crearIconosPacking();
        actualizarFabRestanteBadge();
    }

    const CONTROL_ETAPAS_PACKING = [
        { idx: 0, label: 'Recepción', shortLabel: 'Recep.', idPart: 'recepcion' },
        { idx: 1, label: 'Ingreso gasificado', shortLabel: 'Ing.gas', idPart: 'ingreso_gas' },
        { idx: 2, label: 'Salida gasificado', shortLabel: 'Sal.gas', idPart: 'salida_gas' },
        { idx: 3, label: 'Ingreso prefrío', shortLabel: 'Ing.pre', idPart: 'ingreso_pre' },
        { idx: 4, label: 'Salida prefrío', shortLabel: 'Sal.pre', idPart: 'salida_pre' }
    ];

    function idControlPacking(prefijo, idPart) {
        return prefijo + '-' + idPart + '_packing';
    }

    const packingControlState = {
        tipo: null,
        temperatura: { amb: ['', '', '', '', ''], pulpa: ['', '', '', '', ''] },
        humedad: ['', '', '', '', ''],
        presionAmb: ['', '', '', '', ''],
        presionFruta: ['', '', '', '', '']
    };
    let packingNViaje = '';

    const elControlBarPacking = document.getElementById('control_equitativo_bar_packing');
    const elBtnViajePacking = document.getElementById('btn_viaje_packing');
    const elBtnTempPacking = document.getElementById('btn_temp_packing');
    const elBtnHumPacking = document.getElementById('btn_hum_packing');
    const elControlModalPacking = document.getElementById('control_global_modal_overlay_packing');
    const elControlModalTitlePacking = document.getElementById('control_global_modal_title_packing');
    const elControlModalBodyPacking = document.getElementById('control_global_modal_body_packing');
    const elControlCancelPacking = document.getElementById('btn_cancel_control_global_packing');
    const elControlGuardarPacking = document.getElementById('btn_save_control_global_packing');

    function resetControlGlobalPacking() {
        packingControlState.tipo = null;
        packingControlState.temperatura.amb = ['', '', '', '', ''];
        packingControlState.temperatura.pulpa = ['', '', '', '', ''];
        packingControlState.humedad = ['', '', '', '', ''];
        packingControlState.presionAmb = ['', '', '', '', ''];
        packingControlState.presionFruta = ['', '', '', '', ''];
    }

    function getNViajePacking() {
        return String(packingNViaje || '').trim();
    }

    function actualizarBtnViajePackingTitulo_() {
        if (!elBtnViajePacking) return;
        const v = getNViajePacking();
        elBtnViajePacking.title = elBtnViajePacking.disabled
            ? 'Selecciona una muestra'
            : (v ? 'N° viaje: ' + v : 'N° viaje');
    }

    function abrirModalViajePacking() {
        if (!muestraSeleccionada() || !elViajeModalPacking) return;
        if (elViajeInputPacking) elViajeInputPacking.value = getNViajePacking();
        elViajeModalPacking.style.display = 'flex';
        elViajeModalPacking.setAttribute('aria-hidden', 'false');
        elViajeInputPacking?.focus();
    }

    function cerrarModalViajePacking() {
        if (!elViajeModalPacking) return;
        ocultarModalPacking(elViajeModalPacking);
    }

    function normalizarNViajePackingInput_(raw) {
        return String(raw || '').trim().slice(0, 2);
    }

    function guardarModalViajePacking() {
        packingNViaje = normalizarNViajePackingInput_(elViajeInputPacking?.value);
        if (elViajeInputPacking) elViajeInputPacking.value = packingNViaje;
        if (lastDetallePacking && typeof lastDetallePacking === 'object') {
            lastDetallePacking.N_VIAJE = packingNViaje;
            lastDetallePacking.n_viaje = packingNViaje;
            registrarDetalleMetaPacking_(elFecha?.value, elMuestra?.value, lastDetallePacking);
        }
        actualizarBtnViajePackingTitulo_();
        cerrarModalViajePacking();
        mostrarToastPacking('success', 'Guardado', 'N° viaje guardado.');
        programarGuardadoBorradorPacking();
    }

    /** Limpia tiempos/control/hora/responsable al cambiar de muestra sin borrador. */
    function limpiarUiCapturaMuestraPacking_() {
        packingBadgeWasComplete = false;
        packingNViaje = '';
        actualizarBtnViajePackingTitulo_();
        resetControlGlobalPacking();
        TIEMPOS_MUESTRA_IDS.forEach((id) => {
            const inp = document.getElementById(id);
            if (inp) inp.value = '';
        });
        if (elHoraInicio) elHoraInicio.value = '';
        if (elResponsable) elResponsable.value = '';
        actualizarContadoresTiempo();
        actualizarContadoresPresionPacking();
    }

    /** Vacía captura visible al cambiar de muestra (antes de cargar detalle del servidor). */
    function prepararUiNuevaMuestraPacking_() {
        limpiarUiCapturaMuestraPacking_();
        packingCards = [];
        packingActiveCardId = null;
        renderizarCardsPacking();
        limpiarPreviewChips();
        setResumenVisible(true);
        setChipsPanelCollapsed(false, false);
        setPreviewLoading(true, 'Cargando datos…');
    }

    function purgarBorradoresFantasmaPacking_() {
        const store = leerStoreBorradorPacking();
        const porClave = store?.porClave;
        if (!porClave || typeof porClave !== 'object') return;
        let changed = false;
        Object.keys(porClave).forEach((key) => {
            if (!hayDatosTrabajoMuestraPacking(porClave[key])) {
                delete porClave[key];
                changed = true;
            }
        });
        if (changed) escribirStoreBorradorPacking(store);
    }

    function leerStoreBorradorPacking() {
        try {
            const raw = localStorage.getItem(PACKING_DRAFT_STORAGE_KEY);
            if (!raw) return { version: 1, porClave: {}, activa: '' };
            const o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return { version: 1, porClave: {}, activa: '' };
            if (!o.porClave || typeof o.porClave !== 'object') o.porClave = {};
            return o;
        } catch (err) {
            console.error('[Packing] Error leyendo borrador local:', err);
            return { version: 1, porClave: {}, activa: '' };
        }
    }

    function escribirStoreBorradorPacking(store) {
        try {
            const porClave = store?.porClave && typeof store.porClave === 'object' ? store.porClave : {};
            const keys = Object.keys(porClave);
            if (!keys.length && !store?.activa) {
                localStorage.removeItem(PACKING_DRAFT_STORAGE_KEY);
                return;
            }
            localStorage.setItem(PACKING_DRAFT_STORAGE_KEY, JSON.stringify({
                version: 1,
                ts: Date.now(),
                activa: String(store?.activa || ''),
                porClave
            }));
        } catch (err) {
            console.error('[Packing] Error guardando borrador local:', err);
        }
    }

    function claveBorradorMuestraPacking(fecha, rawMuestra) {
        const f = normalizarFechaIso(fecha);
        const m = String(rawMuestra || '').trim();
        if (!f || !m) return '';
        return f + '::' + m;
    }

    function clonarControlStatePacking(src) {
        const s = src || packingControlState;
        return {
            tipo: s.tipo || null,
            temperatura: {
                amb: Array.isArray(s.temperatura?.amb) ? s.temperatura.amb.slice() : ['', '', '', '', ''],
                pulpa: Array.isArray(s.temperatura?.pulpa) ? s.temperatura.pulpa.slice() : ['', '', '', '', '']
            },
            humedad: Array.isArray(s.humedad) ? s.humedad.slice() : ['', '', '', '', ''],
            presionAmb: Array.isArray(s.presionAmb) ? s.presionAmb.slice() : ['', '', '', '', ''],
            presionFruta: Array.isArray(s.presionFruta) ? s.presionFruta.slice() : ['', '', '', '', '']
        };
    }

    function capturarPreviewMetaPacking() {
        const trazEl = document.getElementById(previewIds.traz);
        const varEl = document.getElementById(previewIds.variedad);
        const placaEl = document.getElementById(previewIds.placa);
        const det = leerDetalleMetaPacking_(elMuestra?.value) || {};
        return {
            traz: String(trazEl?.textContent || '').trim(),
            variedad: String(varEl?.textContent || '').trim(),
            placa: String(placaEl?.textContent || '').trim(),
            responsable: getResponsablePacking(),
            guia: textoMetaCampoPdfPacking_(det.GUIA_REMISION),
            viaje: viajePdfDesdeFuentesPacking_(getNViajePacking(), null, det),
            rotulo: String(det.ENSAYO_NOMBRE ?? '').trim()
        };
    }

    function capturarEstadoMuestraPacking() {
        return {
            packingCards: packingCards.map((c) => ({
                id: c.id,
                clamshellNum: c.clamshellNum,
                pesos: { ...c.pesos },
                observacion: String(c.observacion || '')
            })),
            packingCardSeq,
            packingActiveCardId,
            control: clonarControlStatePacking(packingControlState),
            tiempos: getTiemposMuestra(),
            horaInicio: getHoraPersonal(),
            responsable: getResponsablePacking(),
            nViaje: getNViajePacking(),
            packingQuotaSnapshot: capturarQuotaSnapshotPacking_(),
            previewMeta: capturarPreviewMetaPacking()
        };
    }

    function hayTextoEnArregloPacking(arr) {
        return Array.isArray(arr) && arr.some((v) => String(v ?? '').trim() !== '');
    }

    function hayDatosTrabajoMuestraPacking(estado) {
        if (!estado || typeof estado !== 'object') return false;
        const cards = Array.isArray(estado.packingCards) ? estado.packingCards : [];
        if (cards.length > 1) return true;
        if (cards.some((c) => {
            const p = c?.pesos || {};
            return Object.keys(p).some((k) => pesoNumero(p[k]) > 0)
                || String(c?.observacion || '').trim() !== '';
        })) return true;
        if (hayTextoEnArregloPacking(estado.tiempos)) return true;
        const cg = estado.control;
        if (cg) {
            if (hayTextoEnArregloPacking(cg.temperatura?.amb)) return true;
            if (hayTextoEnArregloPacking(cg.temperatura?.pulpa)) return true;
            if (hayTextoEnArregloPacking(cg.humedad)) return true;
        }
        if (hayTextoEnArregloPacking(cg?.presionAmb)) return true;
        if (hayTextoEnArregloPacking(cg?.presionFruta)) return true;
        return false;
    }

    function aplicarPreviewMetaDesdeBorrador(meta) {
        if (!meta) return;
        const traz = String(meta.traz || '').trim();
        const variedad = String(meta.variedad || '').trim();
        const placa = String(meta.placa || '').trim();
        if (traz || variedad || placa) {
            setResumenVisible(true);
            if (elPreview) {
                elPreview.classList.remove('is-loading-preview');
                elPreview.classList.add('is-loaded');
            }
        }
        if (traz) setChip(previewIds.traz, traz, false, 'packing-chip-value--traz');
        if (variedad) setChip(previewIds.variedad, variedad, false);
        if (placa) setChip(previewIds.placa, placa, false);
        if (elResponsable && String(meta.responsable || '').trim()) {
            elResponsable.value = String(meta.responsable).trim();
        }
    }

    function normalizarCardsRestauradasPacking(cards, opts) {
        if (!Array.isArray(cards) || !cards.length) return null;
        const minSlots = Number(opts?.minSlots) || 0;
        const desdeBorrador = !!opts?.desdeBorrador;
        let disponibles = slotsDisponiblesEnServidorPacking();
        if (desdeBorrador || minSlots > 0) {
            disponibles = Math.max(disponibles, minSlots || cards.length, cards.length);
        }
        if (disponibles <= 0) return null;
        const maxCards = Math.min(cards.length, disponibles);
        let seq = packingCardSeq;
        return cards.slice(0, maxCards).map((c, i) => {
            const id = Number.isFinite(Number(c.id)) ? Number(c.id) : ++seq;
            if (id > seq) seq = id;
            const numGuardado = Number(c.clamshellNum);
            return {
                id,
                clamshellNum: (desdeBorrador && Number.isFinite(numGuardado) && numGuardado > 0)
                    ? numGuardado
                    : packingQuota.filasPackingRegistradas + i + 1,
                pesos: { ...(c.pesos || pesosVaciosPacking()) },
                observacion: String(c.observacion || '')
            };
        });
    }

    function aplicarEstadoMuestraPacking(estado, opts) {
        if (!estado || !hayDatosTrabajoMuestraPacking(estado)) {
            limpiarUiCapturaMuestraPacking_();
            reiniciarCardsPacking();
            return;
        }
        if (!opts?.skipPreview) {
            aplicarPreviewMetaDesdeBorrador(estado.previewMeta);
        }
        const cg = clonarControlStatePacking(estado.control);
        packingControlState.tipo = cg.tipo;
        packingControlState.temperatura = cg.temperatura;
        packingControlState.humedad = cg.humedad;
        packingControlState.presionAmb = cg.presionAmb;
        packingControlState.presionFruta = cg.presionFruta;
        recalcularPresionesPacking();
        if (Array.isArray(estado.tiempos)) {
            TIEMPOS_MUESTRA_IDS.forEach((id, i) => {
                const inp = document.getElementById(id);
                if (inp) inp.value = String(estado.tiempos[i] || '');
            });
        }
        if (elHoraInicio && String(estado.horaInicio || '').trim()) {
            elHoraInicio.value = String(estado.horaInicio).trim();
        }
        if (elResponsable && String(estado.responsable || '').trim()) {
            elResponsable.value = String(estado.responsable).trim();
        }
        packingNViaje = normalizarNViajePackingInput_(estado.nViaje);
        if (!packingNViaje) {
            const det = leerDetalleMetaPacking_(elMuestra?.value);
            packingNViaje = textoMetaCampoPdfPacking_(det?.N_VIAJE ?? det?.n_viaje) || '';
        }
        actualizarBtnViajePackingTitulo_();
        packingCardSeq = Number(estado.packingCardSeq) || 0;
        const snap = estado.packingQuotaSnapshot || {};
        const cardsNeeded = Array.isArray(estado.packingCards) ? estado.packingCards.length : 0;
        const restSnap = restantesDesdeEstadoMuestraPacking(estado, snap);
        const cards = normalizarCardsRestauradasPacking(estado.packingCards, {
            minSlots: cardsNeeded,
            desdeBorrador: true
        });
        if (cards && cards.length) {
            packingCards = cards;
            packingCardSeq = Math.max(packingCardSeq, ...cards.map((c) => c.id));
            packingActiveCardId = estado.packingActiveCardId;
            if (!getCardPackingById(packingActiveCardId)) {
                packingActiveCardId = packingCards[0]?.id ?? null;
            }
            renderizarCardsPacking();
        } else {
            reiniciarCardsPacking();
        }
        actualizarContadoresTiempo();
        actualizarContadoresPresionPacking();
        actualizarFabRestanteBadge();
    }

    function borrarBorradorMuestraPacking(key) {
        if (!key) return;
        const store = leerStoreBorradorPacking();
        delete store.porClave[key];
        if (store.activa === key) store.activa = '';
        escribirStoreBorradorPacking(store);
    }

    function snapshotMuestraPackingSiHayTrabajo(fecha, rawMuestra, estadoUi) {
        if (packingOmitirAutoguardado) return;
        const key = claveBorradorMuestraPacking(fecha, rawMuestra);
        if (!key || !rawMuestra) return;
        const estado = estadoUi || capturarEstadoMuestraPacking();
        const store = leerStoreBorradorPacking();
        if (hayDatosTrabajoMuestraPacking(estado)) {
            store.porClave[key] = estado;
        } else {
            const existing = store.porClave[key];
            if (!existing || !hayDatosTrabajoMuestraPacking(existing)) {
                delete store.porClave[key];
            }
        }
        escribirStoreBorradorPacking(store);
    }

    function escribirBorradorMuestraPacking_(key, estado, opts) {
        if (!key) return;
        const store = leerStoreBorradorPacking();
        const forzar = !!(opts && opts.forzar);
        if (hayDatosTrabajoMuestraPacking(estado)) {
            store.porClave[key] = estado;
        } else if (forzar) {
            delete store.porClave[key];
        } else {
            const existing = store.porClave[key];
            if (!existing || !hayDatosTrabajoMuestraPacking(existing)) {
                delete store.porClave[key];
            }
        }
        if (opts?.activa !== false) store.activa = key;
        escribirStoreBorradorPacking(store);
    }

    function guardarBorradorMuestraActiva() {
        if (packingOmitirAutoguardado || packingRestaurandoBorrador || !muestraSeleccionada()) return;
        const key = claveBorradorMuestraPacking(elFecha?.value, elMuestra?.value);
        if (!key) return;
        escribirBorradorMuestraPacking_(key, capturarEstadoMuestraPacking());
    }

    function cancelarGuardadoBorradorProgramadoPacking_() {
        clearTimeout(packingDraftSaveTimer);
        packingDraftSaveTimer = null;
    }

    function programarGuardadoBorradorPacking() {
        if (packingOmitirAutoguardado || packingRestaurandoBorrador) return;
        cancelarGuardadoBorradorProgramadoPacking_();
        packingDraftSaveTimer = setTimeout(guardarBorradorMuestraActiva, 220);
    }

    function limpiarBorradorTrasEnvioExitosoPacking(fecha, rawMuestra) {
        const key = claveBorradorMuestraPacking(fecha, rawMuestra);
        borrarBorradorMuestraPacking(key);
        resetControlGlobalPacking();
        TIEMPOS_MUESTRA_IDS.forEach((id) => {
            const inp = document.getElementById(id);
            if (inp) inp.value = '';
        });
        actualizarContadoresTiempo();
        actualizarContadoresPresionPacking();
    }

    async function avanzarASiguienteMuestraPackingTrasEnvio_(rawEnviado) {
        if (!elMuestra) return;
        const fecha = normalizarFechaIso(elFecha?.value);
        const raw = String(rawEnviado || '').trim();
        const opts = [...elMuestra.options].filter((o) => String(o.value || '').trim());
        const idx = opts.findIndex((o) => o.value === raw);
        const next = idx >= 0 ? opts[idx + 1] : null;
        if (next && next.value) {
            packingMuestraAnterior = raw;
            elMuestra.value = next.value;
            elMuestra.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        if (fecha && raw) {
            const ensayoNumero = String(raw.split('|')[1] || '').trim();
            if (ensayoNumero) {
                await cargarDetalle(fecha, ensayoNumero, { sinOverlay: true });
            }
        }
    }

    function restaurarMuestraActivaDesdeBorrador() {
        const store = leerStoreBorradorPacking();
        const activa = String(store?.activa || '').trim();
        const fecha = normalizarFechaIso(elFecha?.value);
        if (!activa || !fecha || !elMuestra) return false;
        if (!activa.startsWith(fecha + '::')) return false;
        const rawMuestra = activa.slice(fecha.length + 2);
        if (!rawMuestra) return false;
        const opt = [...elMuestra.options].find((o) => o.value === rawMuestra);
        if (!opt) return false;
        packingRestaurandoBorrador = true;
        elMuestra.value = rawMuestra;
        packingMuestraAnterior = rawMuestra;
        packingRestaurandoBorrador = false;
        const ensayoNumero = rawMuestra.split('|')[1] || '';
        if (ensayoNumero) void cargarDetalle(fecha, ensayoNumero);
        return true;
    }

    /** Temp / humedad / presión: Number con 3 decimales (evita "1.148" como texto → miles en Sheets). */
    function decimalNumParaEnvioPacking(v) {
        if (v === null || v === undefined || String(v).trim() === '') return '';
        const n = Number(String(v).trim().replace(',', '.'));
        if (!Number.isFinite(n)) return '';
        return Math.round(n * 1000) / 1000;
    }

    function presionStrParaEnvioPacking(v) {
        return decimalNumParaEnvioPacking(v);
    }

    function normalizarFilaPackingParaEnvio_(row) {
        if (!Array.isArray(row)) return row;
        const out = row.slice();
        for (let i = 10; i <= 34; i++) {
            if (out[i] !== '' && out[i] != null) {
                const n = decimalNumParaEnvioPacking(out[i]);
                out[i] = n === '' ? '' : n;
            }
        }
        return out;
    }

    function normalizarPackingBodyParaEnvio_(body) {
        if (!body || !Array.isArray(body.packingRows)) return body;
        return {
            ...body,
            packingRows: body.packingRows.map(normalizarFilaPackingParaEnvio_)
        };
    }

    function numeroSeguroPacking(valor) {
        const s = String(valor ?? '').trim();
        if (s === '' || s.endsWith('.')) return null;
        const n = Number(s.replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }

    function controlGlobalPackingTieneDato(raw) {
        const s = String(raw ?? '').trim();
        return s !== '' && !s.endsWith('.');
    }

    function calcularPresionVaporAmbienteAshrae(tempC, humedadRelativa) {
        const t = numeroSeguroPacking(tempC);
        const hr = numeroSeguroPacking(humedadRelativa);
        if (t === null || hr === null || hr < 0 || hr > 100) return '';

        const T = t + 273.15;
        const c8 = -5.8002206e+03;
        const c9 = 1.3914993e+00;
        const c10 = -4.8640239e-02;
        const c11 = 4.1764768e-05;
        const c12 = -1.4452093e-08;
        const c13 = 6.5459673e+00;

        const lnPs = (c8 / T) + c9 + (c10 * T) + (c11 * (T ** 2)) + (c12 * (T ** 3)) + (c13 * Math.log(T));
        const pSatKpa = Math.exp(lnPs) / 1000;
        const pV = pSatKpa * (hr / 100);
        if (!Number.isFinite(pV)) return '';
        return pV.toFixed(3);
    }

    function calcularPresionVaporPulpaAshrae(tempPulpaC) {
        const t = numeroSeguroPacking(tempPulpaC);
        if (t === null) return '';

        const T = t + 273.15;
        const c8 = -5.8002206e+03;
        const c9 = 1.3914993e+00;
        const c10 = -4.8640239e-02;
        const c11 = 4.1764768e-05;
        const c12 = -1.4452093e-08;
        const c13 = 6.5459673e+00;

        const lnPs = (c8 / T) + c9 + (c10 * T) + (c11 * (T ** 2)) + (c12 * (T ** 3)) + (c13 * Math.log(T));
        const pPulpa = Math.exp(lnPs) / 1000;
        if (!Number.isFinite(pPulpa)) return '';
        return pPulpa.toFixed(3);
    }

    function recalcularPresionesDesdeControlPacking_(control) {
        const cg = clonarControlStatePacking(control);
        const t = cg.temperatura;
        const h = cg.humedad;
        const pa = cg.presionAmb;
        const pf = cg.presionFruta;
        for (let i = 0; i < 5; i++) {
            const puedeAmb = controlGlobalPackingTieneDato(t.amb[i]) && controlGlobalPackingTieneDato(h[i]);
            const puedePulpa = controlGlobalPackingTieneDato(t.pulpa[i]);
            pa[i] = puedeAmb ? calcularPresionVaporAmbienteAshrae(t.amb[i], h[i]) : '';
            pf[i] = puedePulpa ? calcularPresionVaporPulpaAshrae(t.pulpa[i]) : '';
        }
        return cg;
    }

    function recalcularPresionesPacking() {
        const cg = recalcularPresionesDesdeControlPacking_(packingControlState);
        packingControlState.presionAmb = cg.presionAmb;
        packingControlState.presionFruta = cg.presionFruta;
    }

    function conteoPresionPacking(valores) {
        const done = valores.filter((v) => String(v || '').trim() !== '').length;
        return { done, total: 5 };
    }

    function actualizarContadoresPresionPacking() {
        recalcularPresionesPacking();
        const cAmb = conteoPresionPacking(packingControlState.presionAmb);
        const cFruta = conteoPresionPacking(packingControlState.presionFruta);
        const txtAmb = String(cAmb.done) + '/' + String(cAmb.total);
        const txtFruta = String(cFruta.done) + '/' + String(cFruta.total);
        if (elMetricPresionAmbCount) {
            elMetricPresionAmbCount.textContent = txtAmb;
            elMetricPresionAmbCount.classList.toggle('is-filled', cAmb.done > 0);
        }
        if (elMetricPresionFrutaCount) {
            elMetricPresionFrutaCount.textContent = txtFruta;
            elMetricPresionFrutaCount.classList.toggle('is-filled', cFruta.done > 0);
        }
        document.querySelectorAll('.packing-metric-presion-amb-count-mirror').forEach((el) => {
            el.textContent = txtAmb;
            el.classList.toggle('is-filled', cAmb.done > 0);
        });
        document.querySelectorAll('.packing-metric-presion-fruta-count-mirror').forEach((el) => {
            el.textContent = txtFruta;
            el.classList.toggle('is-filled', cFruta.done > 0);
        });
        actualizarBtnEnviarPacking();
    }

    function etiquetaCardErrorPacking(clamshellNum) {
        const n = Number(clamshellNum);
        return Number.isFinite(n) && n > 0 ? ('#' + n + ' · ') : '';
    }

    function cardReferenciaTiemposPacking() {
        const card = getCardPackingById(packingActiveCardId) || packingCards[0];
        return card?.clamshellNum || 1;
    }

    function msgErrorPesosPacking(clamshellNum, texto) {
        return etiquetaCardErrorPacking(clamshellNum) + '⚖ ' + texto;
    }

    function msgErrorTiemposPacking(texto) {
        return etiquetaCardErrorPacking(cardReferenciaTiemposPacking()) + '⏱ ' + texto;
    }

    function msgErrorGlobalPacking(etiqueta, texto) {
        return String(etiqueta || 'Global') + ' · ' + texto;
    }

    function validarCompletitudPackingParaEnvio() {
        recalcularPresionesPacking();
        const errores = [];

        const cuota = validarCuotaClamshellsRegistroPacking();
        if (!cuota.ok) {
            errores.push(cuota.error);
        }

        if (!String(getHoraPersonal() || '').trim()) {
            errores.push(msgErrorGlobalPacking('Cabecera', 'Completa Hora inicio recepción.'));
        }
        if (!String(getResponsablePacking() || '').trim()) {
            errores.push(msgErrorGlobalPacking('Cabecera', 'Completa Responsable.'));
        }

        const ct = conteoTiemposMuestra();
        if (ct.done < ct.total) {
            errores.push(
                msgErrorTiemposPacking(
                    'Completa las ' + ct.total + ' etapas (' + ct.done + '/' + ct.total + ').'
                )
            );
        }
        validarSecuenciaTiemposPacking(obtenerTiemposDesdeModalPacking()).forEach((e) => {
            errores.push(msgErrorTiemposPacking(e));
        });

        const t = packingControlState.temperatura;
        const h = packingControlState.humedad;
        let faltanControl = false;
        for (let i = 0; i < 5; i++) {
            if (!controlGlobalPackingTieneDato(t.amb[i])
                || !controlGlobalPackingTieneDato(t.pulpa[i])
                || !controlGlobalPackingTieneDato(h[i])) {
                faltanControl = true;
                break;
            }
        }
        if (faltanControl) {
            errores.push(
                msgErrorGlobalPacking(
                    'Control',
                    'Abre Temperatura y Humedad global y completa las 5 etapas.'
                )
            );
        }

        const cAmb = conteoPresionPacking(packingControlState.presionAmb);
        const cFruta = conteoPresionPacking(packingControlState.presionFruta);
        if (!faltanControl && cAmb.done < cAmb.total) {
            errores.push(
                msgErrorGlobalPacking(
                    '☁️',
                    'Revisa temperatura ambiente y humedad (' + cAmb.done + '/5).'
                )
            );
        }
        if (!faltanControl && cFruta.done < cFruta.total) {
            errores.push(
                msgErrorGlobalPacking(
                    '🍎',
                    'Revisa temperatura pulpa (' + cFruta.done + '/5).'
                )
            );
        }

        const pesoLabels = {
            recepcion: 'Peso recepción',
            ingresoGas: 'Peso I-GASIF.',
            salidaGas: 'Peso S-GASIF.',
            ingresoPre: 'Peso ingreso prefrío',
            salidaPre: 'Peso salida prefrío'
        };

        packingCards.forEach((card) => {
            const p = card.pesos || pesosVaciosPacking();
            const faltantes = Object.keys(pesoLabels).filter((k) => pesoNumero(p[k]) <= 0);
            if (faltantes.length) {
                errores.push(
                    msgErrorPesosPacking(
                        card.clamshellNum,
                        'Completa ' + faltantes.map((k) => pesoLabels[k]).join(', ') + '.'
                    )
                );
                return;
            }
            const limite = getLimitePesoRecepcionPacking(card.clamshellNum);
            const pesoErr = validarSecuenciaPesosPacking(p, limite);
            if (pesoErr.length) {
                errores.push(msgErrorPesosPacking(card.clamshellNum, pesoErr[0]));
            }
        });

        return { ok: errores.length === 0, errores };
    }

    function packingListoParaEnviar() {
        return validarCompletitudPackingParaEnvio().ok;
    }

    function sanitizarValorControlGlobalPacking(raw, opts) {
        const isDeleting = Boolean(opts && opts.isDeleting);
        let v = String(raw ?? '').replace(',', '.').replace(/[^\d.]/g, '');
        const firstDot = v.indexOf('.');
        if (firstDot >= 0) {
            v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
            const parts = v.split('.');
            v = parts[0].slice(0, 2) + '.' + (parts[1] || '').slice(0, 1);
        } else {
            v = v.slice(0, 3);
            if (!isDeleting && v.length >= 2) {
                const ent = v.slice(0, 2);
                const dec = v.slice(2, 3);
                v = dec ? ent + '.' + dec : ent + '.';
            }
        }
        return v;
    }

    function normalizarValorControlGlobalPacking(raw) {
        const live = sanitizarValorControlGlobalPacking(raw);
        if (!live) return '';
        if (live.includes('.')) return live;
        if (live.length >= 3) return live.slice(0, 2) + '.' + live.slice(2, 3);
        return live;
    }

    function formatearInputControlGlobalPacking(input, final, opts) {
        if (!input) return;
        const normalizado = final
            ? normalizarValorControlGlobalPacking(input.value)
            : sanitizarValorControlGlobalPacking(input.value, opts);
        if (input.value !== normalizado) input.value = normalizado;
    }

    function leerControlGlobalPackingDesdeModal() {
        CONTROL_ETAPAS_PACKING.forEach((etapa) => {
            const i = etapa.idx;
            if (packingControlState.tipo === 'temperatura') {
                packingControlState.temperatura.amb[i] = String(document.getElementById(idControlPacking('visual-temp-amb', etapa.idPart))?.value || '').trim();
                packingControlState.temperatura.pulpa[i] = String(document.getElementById(idControlPacking('visual-temp-pulpa', etapa.idPart))?.value || '').trim();
            } else if (packingControlState.tipo === 'humedad') {
                packingControlState.humedad[i] = String(document.getElementById(idControlPacking('visual-cg-humedad', etapa.idPart))?.value || '').trim();
            }
        });
    }

    function aplicarControlGlobalPackingARow(row) {
        recalcularPresionesPacking();
        const t = packingControlState.temperatura;
        const h = packingControlState.humedad;
        const pAmb = packingControlState.presionAmb;
        const pFruta = packingControlState.presionFruta;
        for (let i = 0; i < 5; i++) {
            row[10 + (i * 2)] = decimalNumParaEnvioPacking(t.amb[i]);
            row[11 + (i * 2)] = decimalNumParaEnvioPacking(t.pulpa[i]);
            row[20 + i] = decimalNumParaEnvioPacking(h[i]);
            row[25 + i] = decimalNumParaEnvioPacking(pAmb[i]);
            row[30 + i] = decimalNumParaEnvioPacking(pFruta[i]);
        }
    }

    function celdaControlPacking(etapa, prefijo, valores, usarLabelCompleto) {
        const v = String(valores[etapa.idx] ?? '').replace(/"/g, '&quot;');
        const id = idControlPacking(prefijo, etapa.idPart);
        const txt = usarLabelCompleto ? etapa.label : (etapa.shortLabel || etapa.label);
        return '<div class="form-group"><label>' + txt + '</label>'
            + '<input type="text" inputmode="decimal" maxlength="4" class="packing-cg-inp" id="' + id + '" value="' + v + '" aria-label="' + etapa.label + '"></div>';
    }

    /** Misma cuadrícula que el modal Tiempos de la muestra: 2×2 + fila ancha. */
    function filaComoTiemposPacking(prefijo, valores) {
        const cuatro = CONTROL_ETAPAS_PACKING.filter((e) => e.idx < 4)
            .map((e) => celdaControlPacking(e, prefijo, valores, true)).join('');
        const quinto = CONTROL_ETAPAS_PACKING.find((e) => e.idx === 4);
        const v5 = String(valores[4] ?? '').replace(/"/g, '&quot;');
        const id5 = idControlPacking(prefijo, quinto.idPart);
        return '<div class="packing-tiempos-grid packing-cg-grid-tiempos">' + cuatro + '</div>'
            + '<div class="form-group packing-tiempo-row-full">'
            + '<label>' + quinto.label + '</label>'
            + '<input type="text" inputmode="decimal" maxlength="4" class="packing-cg-inp" id="' + id5 + '" value="' + v5 + '" aria-label="' + quinto.label + '">'
            + '</div>';
    }

    function filaCincoPacking(prefijo, valores) {
        const celdas = CONTROL_ETAPAS_PACKING.map((e) => celdaControlPacking(e, prefijo, valores, false)).join('');
        return '<div class="packing-cg-grid-5">' + celdas + '</div>';
    }

    function htmlGridControlPacking(tipo) {
        const t = packingControlState.temperatura;
        const h = packingControlState.humedad;
        if (tipo === 'temperatura') {
            return ''
                + '<p class="metric-mini-title">Temperatura ambiente (°C)</p>'
                + filaCincoPacking('visual-temp-amb', t.amb)
                + '<p class="metric-mini-title">Temperatura pulpa (°C)</p>'
                + filaCincoPacking('visual-temp-pulpa', t.pulpa);
        }
        return filaComoTiemposPacking('visual-cg-humedad', h);
    }

    function enlazarInputsControlGlobalPacking() {
        if (!elControlModalBodyPacking) return;
        elControlModalBodyPacking.querySelectorAll('input').forEach((input) => {
            formatearInputControlGlobalPacking(input, true);
            input.addEventListener('input', (ev) => {
                const inputType = String(ev?.inputType || '');
                formatearInputControlGlobalPacking(input, false, { isDeleting: inputType.includes('delete') });
                leerControlGlobalPackingDesdeModal();
            });
            input.addEventListener('change', () => {
                formatearInputControlGlobalPacking(input, true);
                leerControlGlobalPackingDesdeModal();
            });
        });
    }

    function abrirModalControlGlobalPacking(tipo) {
        if (!muestraSeleccionada() || !elControlModalPacking || !elControlModalBodyPacking) return;
        packingControlState.tipo = tipo;
        if (elControlModalTitlePacking) {
            elControlModalTitlePacking.textContent = tipo === 'temperatura'
                ? 'Control equitativo · Temperatura ambiente y pulpa (todos)'
                : 'Control equitativo · Humedad (todos)';
        }
        elControlModalBodyPacking.innerHTML = htmlGridControlPacking(tipo);
        enlazarInputsControlGlobalPacking();
        elControlModalPacking.style.display = 'flex';
        elControlModalPacking.setAttribute('aria-hidden', 'false');
    }

    function cerrarModalControlGlobalPacking() {
        if (!elControlModalPacking) return;
        ocultarModalPacking(elControlModalPacking);
        if (elControlModalBodyPacking) elControlModalBodyPacking.innerHTML = '';
        packingControlState.tipo = null;
    }

    function guardarModalControlGlobalPacking() {
        if (!elControlModalBodyPacking) return;
        const incompleto = [...elControlModalBodyPacking.querySelectorAll('input')]
            .some((inp) => String(inp.value || '').trim().endsWith('.'));
        if (incompleto) {
            setStatus('Completa el decimal. Ejemplo: 11.2 (no 11.).', 'warn');
            return;
        }
        leerControlGlobalPackingDesdeModal();
        recalcularPresionesPacking();
        actualizarContadoresPresionPacking();
        cerrarModalControlGlobalPacking();
        setStatus('');
        if (elStatus) elStatus.hidden = true;
        programarGuardadoBorradorPacking();
    }

    function celdaPresionModalPacking(etapa, valores, usarLabelCompleto) {
        const raw = String(valores[etapa.idx] ?? '').trim();
        const v = raw.replace(/"/g, '&quot;');
        const id = 'pk-presion-' + etapa.idPart;
        const txt = usarLabelCompleto ? etapa.label : (etapa.shortLabel || etapa.label);
        const valAttr = raw ? (' value="' + v + '"') : ' value="" placeholder="—"';
        return '<div class="form-group"><label>' + txt + '</label>'
            + '<input type="text" class="packing-presion-inp" id="' + id + '"' + valAttr + ' disabled'
            + ' title="Dato calculado automáticamente" aria-label="' + etapa.label + '"></div>';
    }

    function htmlGridPresionModalPacking(valores) {
        const cuatro = CONTROL_ETAPAS_PACKING.filter((e) => e.idx < 4)
            .map((e) => celdaPresionModalPacking(e, valores, true)).join('');
        const quinto = CONTROL_ETAPAS_PACKING.find((e) => e.idx === 4);
        const raw5 = String(valores[4] ?? '').trim();
        const v5 = raw5.replace(/"/g, '&quot;');
        const id5 = 'pk-presion-' + quinto.idPart;
        const val5Attr = raw5 ? (' value="' + v5 + '"') : ' value="" placeholder="—"';
        return '<div class="packing-tiempos-grid packing-cg-grid-tiempos">' + cuatro + '</div>'
            + '<div class="form-group packing-tiempo-row-full">'
            + '<label>' + quinto.label + '</label>'
            + '<input type="text" class="packing-presion-inp" id="' + id5 + '"' + val5Attr + ' disabled'
            + ' title="Dato calculado automáticamente" aria-label="' + quinto.label + '">'
            + '</div>';
    }

    function abrirModalPresionPacking(ev, tipo, clamshellNum) {
        if (!muestraSeleccionada() || !elPresionModal || !elPresionModalBody) return;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        recalcularPresionesPacking();
        const esAmb = tipo === 'ambiente';
        const valores = esAmb ? packingControlState.presionAmb : packingControlState.presionFruta;
        const n = clamshellNum || (getCardPackingById(packingActiveCardId) || packingCards[0])?.clamshellNum || 1;
        if (elPresionModalTitle) {
            elPresionModalTitle.textContent = (esAmb
                ? 'Presión vapor ambiente (Kpa)'
                : 'Presión vapor fruta (Kpa)') + ' · Clamshell #' + n;
        }
        elPresionModalBody.innerHTML = htmlGridPresionModalPacking(valores);
        elPresionModal.style.display = 'flex';
        elPresionModal.setAttribute('aria-hidden', 'false');
    }

    function cerrarModalPresionPacking() {
        if (!elPresionModal) return;
        ocultarModalPacking(elPresionModal);
        if (elPresionModalBody) elPresionModalBody.innerHTML = '';
    }

    function abrirModalObservacionPacking(ev, cardId) {
        if (!muestraSeleccionada() || !elObsModal) return;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        const card = getCardPackingById(cardId);
        if (!card) return;
        packingObservationCardId = card.id;
        packingActiveCardId = card.id;
        if (elObsModalTitle) {
            elObsModalTitle.textContent = 'Observación · Clamshell #' + card.clamshellNum;
        }
        if (elObsInput) elObsInput.value = card.observacion || '';
        elObsModal.style.display = 'flex';
        elObsModal.setAttribute('aria-hidden', 'false');
    }

    function cerrarModalObservacionPacking() {
        if (!elObsModal) return;
        ocultarModalPacking(elObsModal);
        packingObservationCardId = null;
    }

    function guardarModalObservacionPacking() {
        const card = getCardPackingById(packingObservationCardId);
        if (!card) {
            cerrarModalObservacionPacking();
            return;
        }
        card.observacion = String(elObsInput?.value || '').trim();
        cerrarModalObservacionPacking();
        renderizarCardsPacking();
        mostrarToastPacking('success', 'Guardado', 'Observación guardada.');
        programarGuardadoBorradorPacking();
    }

    function getFechaInspeccionPacking() {
        return hoyIsoLocal();
    }

    function buildPackingRowDesdeCard(card, horaRegistro) {
        const tiempos = getTiemposMuestra();
        const row = new Array(PACKING_ROW_COLS).fill('');
        for (let i = 0; i < tiempos.length && i < 5; i++) row[i] = tiempos[i];
        aplicarPesosPackingARow(row, card.pesos);
        aplicarControlGlobalPackingARow(row);
        row[PACKING_ROW_IDX_OBS] = String(card.observacion || '').trim();
        row[PACKING_ROW_IDX_HORA_REG] = String(horaRegistro || horaLocalActualPacking()).trim();
        return row;
    }

    function getMetaEnvioPacking() {
        const sel = ensayoSeleccionado();
        const hora = getHoraPersonal();
        const responsable = getResponsablePacking();
        const horaRegistro = horaLocalActualPacking();
        // fecha (selector): ubica filas campo (col A + ensayo). fecha_inspeccion: col 47 (anillo = hoy).
        return {
            mode: 'packing',
            guardar_packing: true,
            actualizar_c5: false,
            guardar_thermoking: false,
            fecha: elFecha?.value || '',
            ensayo_numero: sel.ensayo_numero,
            num_muestra: sel.num_muestra,
            fecha_inspeccion: getFechaInspeccionPacking(),
            responsable: responsable,
            hora_recepcion: hora,
            hora_inicio_recepcion_c5: hora,
            n_viaje: getNViajePacking(),
            packing_start_index: packingQuota.filasPackingRegistradas,
            packingRows: packingCards.map((c) => buildPackingRowDesdeCard(c, horaRegistro))
        };
    }

    function resumenPackingParaLog_(meta, cards) {
        const start = Number(meta.packing_start_index) || 0;
        return cards.map((card, i) => {
            const r = Array.isArray(meta.packingRows?.[i]) ? meta.packingRows[i] : [];
            return {
                i,
                fila_planilla: start + i + 1,
                n_clamshell: card.clamshellNum,
                fecha: meta.fecha,
                ensayo: meta.ensayo_numero,
                num_muestra: meta.num_muestra,
                fecha_inspeccion: meta.fecha_inspeccion,
                responsable: meta.responsable,
                hora_recepcion: meta.hora_recepcion,
                pesos: {
                    recepcion: card.pesos.recepcion,
                    ingreso_gas: card.pesos.ingresoGas,
                    salida_gas: card.pesos.salidaGas,
                    ingreso_pre: card.pesos.ingresoPre,
                    salida_pre: card.pesos.salidaPre
                },
                tiempos: r.slice(0, 5),
                observacion: String(card.observacion || '').trim()
            };
        });
    }

    function uidLocalPacking() {
        return 'pk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function cargarColaSyncPacking() {
        try {
            const raw = localStorage.getItem(SYNC_QUEUE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            return [];
        }
    }

    function guardarColaSyncPacking(queue) {
        try {
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
        } catch (_) { /* ignore */ }
    }

    function pushEstadoSyncPacking(reg) {
        try {
            const raw = localStorage.getItem(SYNC_HISTORY_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            const hist = Array.isArray(arr) ? arr : [];
            hist.push({
                uid: reg.uid,
                estado: reg.estado,
                ts: Date.now(),
                ensayo: String(reg.ensayo_numero || reg.ensayo || ''),
                num_muestra: reg.num_muestra || '',
                fecha: reg.fecha || '',
                error: reg.error || '',
                modo: 'packing'
            });
            localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(hist.slice(-SYNC_MAX_HISTORY)));
        } catch (_) { /* ignore */ }
    }

    function esRegistroColaPacking(reg) {
        return String(reg?.modo || reg?.payload?.mode || '') === 'packing';
    }

    function hayPackingPendienteEnCola(fecha, ensayoNumero, numMuestra) {
        const f = String(fecha || '').trim();
        const en = String(ensayoNumero || '').trim();
        const nm = String(numMuestra || '').trim();
        return cargarColaSyncPacking().some((r) => {
            if (String(r?.estado || '') !== 'pendiente' || !esRegistroColaPacking(r)) return false;
            return String(r.fecha || '') === f
                && String(r.ensayo_numero || '') === en
                && String(r.num_muestra || '') === nm;
        });
    }

    function encolarPackingPendiente(payload) {
        const body = payload || getMetaEnvioPacking();
        const f = String(body.fecha || '').trim();
        const en = String(body.ensayo_numero || '').trim();
        const nm = String(body.num_muestra || '').trim();
        if (hayPackingPendienteEnCola(f, en, nm)) {
            return { duplicado: true };
        }
        const reg = {
            uid: uidLocalPacking(),
            modo: 'packing',
            payload: body,
            fecha: f,
            ensayo_numero: en,
            num_muestra: nm,
            ensayo: en,
            estado: 'pendiente',
            intentos: 0,
            creado_en: Date.now(),
            actualizado_en: Date.now(),
            error: ''
        };
        const queue = cargarColaSyncPacking();
        queue.push(reg);
        guardarColaSyncPacking(queue);
        pushEstadoSyncPacking(reg);
        actualizarHeaderPendientes();
        return reg;
    }

    let syncPackingEnCurso = false;

    async function confirmarPackingEnServidorTrasPost_(reg) {
        const p = reg?.payload || {};
        const fecha = String(p.fecha || '').trim();
        const ensayo = String(p.ensayo_numero || '').trim();
        if (!fecha || !ensayo || !API_URL) return false;
        try {
            const r = await callbackJsonp({ fecha: fecha, ensayo_numero: ensayo });
            if (!r || r.ok !== true || !r.data) return false;
            const hechas = Number(r.data.FILAS_PACKING_REGISTRADAS ?? 0);
            const start = Number(p.packing_start_index ?? 0);
            const filas = Array.isArray(p.packingRows) ? p.packingRows.length : 0;
            return hechas >= start + filas;
        } catch (_) {
            return false;
        }
    }

    async function sincronizarPendientesPacking() {
        if (syncPackingEnCurso) return;
        if (!navigator.onLine || !API_URL) {
            actualizarHeaderPendientes();
            return;
        }
        const queue = cargarColaSyncPacking();
        if (!queue.some((r) => String(r?.estado || '') === 'pendiente' && esRegistroColaPacking(r))) {
            actualizarHeaderPendientes();
            return;
        }
        syncPackingEnCurso = true;
        let huboCambios = false;
        try {
            for (let i = 0; i < queue.length; i++) {
                const reg = queue[i];
                if (!reg || String(reg.estado || '') !== 'pendiente' || !esRegistroColaPacking(reg)) continue;
                const body = normalizarPackingBodyParaEnvio_(reg.payload);
                if (!body || !Array.isArray(body.packingRows) || !body.packingRows.length) {
                    reg.estado = 'bloqueado';
                    reg.error = 'Payload packing vacío';
                    reg.actualizado_en = Date.now();
                    huboCambios = true;
                    pushEstadoSyncPacking(reg);
                    continue;
                }
                reg.intentos = Number(reg.intentos || 0) + 1;
                reg.actualizado_en = Date.now();
                try {
                    await fetch(API_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const ok = await confirmarPackingEnServidorTrasPost_(reg);
                    if (ok) {
                        reg.estado = 'subido';
                        reg.error = '';
                        pushEstadoSyncPacking(reg);
                        queue.splice(i, 1);
                        i--;
                        huboCambios = true;
                        const selAct = ensayoSeleccionado();
                        const mismaMuestra = selAct.ensayo_numero
                            && String(reg.fecha) === String(elFecha?.value || '')
                            && String(reg.ensayo_numero) === String(selAct.ensayo_numero);
                        if (mismaMuestra) {
                            const rawMuestra = (reg.num_muestra && reg.ensayo_numero)
                                ? (reg.num_muestra + '|' + reg.ensayo_numero)
                                : '';
                            limpiarBorradorTrasEnvioExitosoPacking(reg.fecha, rawMuestra);
                            packingCards = [];
                            renderizarCardsPacking();
                            await cargarDetalle(reg.fecha, reg.ensayo_numero);
                        }
                        mostrarToastPacking('success', 'Cola enviada', 'Packing de muestra ' + (reg.num_muestra || '') + ' subido a la planilla.');
                    } else {
                        reg.error = 'POST enviado; esperando confirmación en planilla.';
                        huboCambios = true;
                        pushEstadoSyncPacking(reg);
                    }
                } catch (err) {
                    reg.error = String(err?.message || err || 'Error POST');
                    reg.actualizado_en = Date.now();
                    huboCambios = true;
                    pushEstadoSyncPacking(reg);
                }
            }
        } finally {
            if (huboCambios) guardarColaSyncPacking(queue);
            syncPackingEnCurso = false;
            actualizarHeaderPendientes();
        }
    }

    async function guardarPdfPackingHistorialTrasEnvio_(capturas, fechaIso) {
        if (!window.HistPdfEnvio || typeof window.HistPdfEnvio.guardarPacking !== 'function') return;
        try {
            await window.HistPdfEnvio.guardarPacking(capturas, fechaIso);
        } catch (err) {
            console.warn('[HistPDF] No se pudo guardar PDF packing:', err);
        }
    }

    function armarCapturaPdfPacking_(fecha, rawMuestra, sel, cards) {
        const key = claveBorradorMuestraPacking(fecha, rawMuestra);
        const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
        const estado = borrador && hayDatosTrabajoMuestraPacking(borrador)
            ? borrador
            : {
                packingCards: Array.isArray(cards) ? cards : [],
                tiempos: getTiemposMuestra(),
                control: packingControlState,
                responsable: getHoraPersonal(),
                horaInicio: getHoraPersonal(),
                previewMeta: lastDetallePacking || null,
                nViaje: packingNViaje || ''
            };
        return {
            num_muestra: String(sel?.num_muestra || '').trim(),
            ensayo_numero: String(sel?.ensayo_numero || '').trim(),
            raw: String(rawMuestra || '').trim(),
            estado
        };
    }

    async function aplicarExitoEnvioPacking_(sel) {
        const fecha = elFecha?.value || '';
        const rawMuestra = (sel.num_muestra && sel.ensayo_numero)
            ? (sel.num_muestra + '|' + sel.ensayo_numero)
            : (elMuestra?.value || '');
        await guardarPdfPackingHistorialTrasEnvio_(
            [armarCapturaPdfPacking_(fecha, rawMuestra, sel, packingCards)],
            normalizarFechaIso(fecha)
        );
        mostrarToastPacking('success', 'Enviado', 'Registro packing enviado a la planilla.');
        setStatus('');
        if (elStatus) elStatus.hidden = true;
        limpiarBorradorTrasEnvioExitosoPacking(fecha, rawMuestra);
        limpiarUiCapturaMuestraPacking_();
        packingCards = [];
        packingActiveCardId = null;
        renderizarCardsPacking();
        await avanzarASiguienteMuestraPackingTrasEnvio_(rawMuestra);
    }

    function logEnvioPackingConsola(body, cards) {
        const n = Array.isArray(body.packingRows) ? body.packingRows.length : 0;
        console.log(
            '[SYNC] Packing → nube: ' + n + ' fila(s). ensayo: ' + (body.ensayo_numero || '—')
            + ' · muestra: ' + (body.num_muestra || '—')
        );
        console.log('[SYNC] Meta global (cols 47–50):', {
            fecha_ubicacion: body.fecha,
            fecha_inspeccion: body.fecha_inspeccion,
            responsable: body.responsable,
            hora_recepcion: body.hora_recepcion,
            packing_start_index: body.packing_start_index
        });
        console.log('[SYNC] Resumen por fila:', resumenPackingParaLog_(body, cards));
    }

    async function ejecutarEnvioPackingBody_(body, sel, cards, opts) {
        opts = opts || {};
        body = normalizarPackingBodyParaEnvio_(body);
        const rawMuestra = (sel.num_muestra && sel.ensayo_numero)
            ? (sel.num_muestra + '|' + sel.ensayo_numero)
            : (elMuestra?.value || '');

        function limpiarTrasEnvioLocal_() {
            const fecha = elFecha?.value || '';
            limpiarBorradorTrasEnvioExitosoPacking(fecha, rawMuestra);
            if (!opts.sinUi && String(elMuestra?.value || '').trim() === rawMuestra) {
                limpiarUiCapturaMuestraPacking_();
                packingCards = [];
                packingActiveCardId = null;
                renderizarCardsPacking();
                actualizarFabRestanteBadge();
            }
        }

        if (!navigator.onLine) {
            const encolado = encolarPackingPendiente(body);
            if (encolado?.duplicado) {
                if (!opts.sinToast) {
                    mostrarToastPacking('info', 'Ya en cola', 'Este packing ya está pendiente de envío cuando vuelva internet.');
                }
                return false;
            }
            if (encolado) {
                await guardarPdfPackingHistorialTrasEnvio_(
                    [armarCapturaPdfPacking_(elFecha?.value || '', rawMuestra, sel, cards)],
                    normalizarFechaIso(elFecha?.value)
                );
                limpiarTrasEnvioLocal_();
                if (!opts.sinUi) {
                    setStatus('');
                    if (elStatus) elStatus.hidden = true;
                }
                if (!opts.sinToast) {
                    mostrarToastPacking(
                        'warning',
                        'Sin internet',
                        'Quedó en cola y se enviará a la planilla al volver la conexión.'
                    );
                }
                return true;
            }
            return false;
        }

        if (!opts.sinLoading) {
            envioPackingEnCurso = true;
            setButtonLoadingPacking(elBtnEnviarPacking, true, 'Enviando...');
        }
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const regTmp = { payload: body };
            const confirmado = await confirmarPackingEnServidorTrasPost_(regTmp);
            if (confirmado) {
                if (opts.sinUi) {
                    limpiarTrasEnvioLocal_();
                    return true;
                }
                if (!opts.sinLoading) {
                    envioPackingEnCurso = false;
                    setButtonLoadingPacking(elBtnEnviarPacking, false);
                }
                await aplicarExitoEnvioPacking_(sel);
                actualizarFabRestanteBadge();
                return true;
            }
            const encolado = encolarPackingPendiente(body);
            if (encolado && !encolado.duplicado) {
                await guardarPdfPackingHistorialTrasEnvio_(
                    [armarCapturaPdfPacking_(elFecha?.value || '', rawMuestra, sel, cards)],
                    normalizarFechaIso(elFecha?.value)
                );
                limpiarTrasEnvioLocal_();
            }
            if (!opts.sinToast) {
                mostrarToastPacking(
                    'info',
                    'En cola',
                    'POST enviado; si la planilla tarda en confirmar, se reintentará con internet.'
                );
            }
            if (!opts.sinUi) {
                setStatus('');
                if (elStatus) elStatus.hidden = true;
            }
            return true;
        } catch (err) {
            const encolado = encolarPackingPendiente(body);
            if (encolado && !encolado.duplicado) {
                await guardarPdfPackingHistorialTrasEnvio_(
                    [armarCapturaPdfPacking_(elFecha?.value || '', rawMuestra, sel, cards)],
                    normalizarFechaIso(elFecha?.value)
                );
                limpiarTrasEnvioLocal_();
                if (!opts.sinToast) {
                    mostrarToastPacking(
                        'warning',
                        'Conexión inestable',
                        'Falló el envío directo; quedó en cola para reenviar con internet.'
                    );
                }
                if (!opts.sinUi) {
                    setStatus('');
                    if (elStatus) elStatus.hidden = true;
                }
                return true;
            }
            if (!opts.sinToast) {
                setStatus(String(err.message || err), 'error');
                mostrarToastPacking('error', 'Error', String(err.message || err));
            }
            return false;
        } finally {
            if (!opts.sinLoading) {
                envioPackingEnCurso = false;
                setButtonLoadingPacking(elBtnEnviarPacking, false);
            }
        }
    }

    async function enviarPackingDesdeCaptura_(cap, opts) {
        if ((!opts?.sinLoading && envioPackingEnCurso) || !cap?.estado) return false;
        const val = validarCompletitudPackingParaEnvioDesdeEstado_(cap.estado, cap.quotaSnap);
        if (!val.ok) {
            const msg = val.errores[0] || 'Completa todos los datos de packing antes de enviar.';
            if (!opts?.sinToast) await mostrarErroresCompletitudPacking_(val.errores);
            else mostrarToastPacking('warning', 'Datos incompletos', msg);
            return false;
        }
        const cuota = validarCuotaClamshellsDesdeEstado_(cap.estado, cap.quotaSnap);
        if (!cuota.ok) {
            if (!opts?.sinToast) mostrarToastPacking('warning', 'Clamshells incompletos', cuota.error);
            return false;
        }
        const fecha = normalizarFechaIso(elFecha?.value);
        const body = getMetaEnvioPackingDesdeEstado_(cap.estado, cap.raw, fecha);
        const cards = Array.isArray(cap.estado.packingCards) ? cap.estado.packingCards : [];
        const sel = { num_muestra: cap.num_muestra, ensayo_numero: cap.ensayo_numero };
        logEnvioPackingConsola(body, cards);
        return ejecutarEnvioPackingBody_(body, sel, cards, opts);
    }

    async function refrescarMuestraPackingActivaTrasLote_(rawActivo, listaReferencia) {
        const fecha = normalizarFechaIso(elFecha?.value);
        const ordenRef = ordenarMuestrasPackingPorEnsayo_(listaReferencia || []);
        const rawUltimoEnsayo = ordenRef.length ? ordenRef[ordenRef.length - 1].raw : '';
        const raw = String(rawActivo || rawUltimoEnsayo || elMuestra?.value || '').trim();
        if (!fecha || !raw) return;
        const parts = raw.split('|');
        const ensayoNumero = parts[1] || '';
        if (!ensayoNumero) return;
        if (String(elMuestra?.value || '').trim() !== raw) {
            packingRestaurandoBorrador = true;
            if (elMuestra) elMuestra.value = raw;
            packingMuestraAnterior = raw;
            packingRestaurandoBorrador = false;
        }
        const key = claveBorradorMuestraPacking(fecha, raw);
        const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
        if (borrador && hayDatosTrabajoMuestraPacking(borrador)) {
            aplicarEstadoMuestraPacking(borrador, { skipPreview: true });
        } else {
            limpiarUiCapturaMuestraPacking_();
            reiniciarCardsPacking();
        }
        await cargarDetalle(fecha, ensayoNumero);
        actualizarFabRestanteBadge();
    }

    async function enviarPackingMuestraActual_() {
        if (envioPackingEnCurso) return false;
        if (!muestraSeleccionada()) {
            setStatus('Selecciona una muestra antes de enviar.', 'warn');
            return false;
        }
        if (!packingCards.length) {
            restaurarEstadoCompletoDesdeBorradorActivo_();
        }
        if (!packingCards.length) {
            setStatus('Agrega al menos un clamshell.', 'warn');
            return false;
        }
        const cuotaReg = validarCuotaClamshellsRegistroPacking();
        if (!cuotaReg.ok) {
            setStatus(cuotaReg.error, 'warn');
            if (elStatus) elStatus.dataset.pkCompletitudHint = '1';
            await mostrarErroresCompletitudPacking_([cuotaReg.error], 'Clamshells incompletos');
            return false;
        }
        const totalCampo = packingQuota.filasTotalCampo || totalFilasCampoPacking();
        const inicio = packingQuota.filasPackingRegistradas;
        if (totalCampo > 0 && inicio + packingCards.length > totalCampo) {
            mostrarToastPacking(
                'warning',
                'Demasiados clamshells',
                'Solo hay ' + totalCampo + ' fila(s) en campo; ya hay ' + inicio + ' con packing.'
            );
            return false;
        }
        const validacion = validarCompletitudPackingParaEnvio();
        if (!validacion.ok) {
            const msg = validacion.errores[0] || 'Completa todos los datos de packing antes de enviar.';
            setStatus(msg, 'warn');
            if (elStatus) elStatus.dataset.pkCompletitudHint = '1';
            await mostrarErroresCompletitudPacking_(validacion.errores);
            return false;
        }
        if (elStatus?.dataset.pkCompletitudHint) {
            delete elStatus.dataset.pkCompletitudHint;
        }
        const sel = ensayoSeleccionado();
        const body = getMetaEnvioPacking();
        logEnvioPackingConsola(body, packingCards);
        guardarBorradorMuestraActivaInmediato_();
        return ejecutarEnvioPackingBody_(body, sel, packingCards);
    }

    async function enviarPackingMuestrasEnSecuencia_(lista) {
        const ordenadasAsc = ordenarMuestrasPackingPorEnsayo_(lista || []);
        const { huecos } = detectarHuecosSecuenciaPacking_(ordenadasAsc);
        const analisisLote = analizarMuestrasPackingDelDia_();
        const huecosDia = analisisLote.huecosEnDia || [];
        const faltanSecuencia = huecosDia.length ? huecosDia : huecos;
        if (faltanSecuencia.length) {
            const pend = analisisLote.pendientes.find(
                (r) => Number(r.ensayo_numero) === faltanSecuencia[0]
            );
            const etiqueta = pend?.etiqueta || ('muestra ' + faltanSecuencia[0]);
            if (window.Swal && typeof window.Swal.fire === 'function') {
                await swalFirePacking({
                    icon: 'warning',
                    title: 'No se puede enviar todas juntas',
                    html: '<p style="margin:0;font-size:13px;color:#475569;">'
                        + '<b>' + etiqueta + '</b> no tiene contador en <b>0</b> '
                        + '(badge verde en el botón +). Completa sus datos antes de enviar la secuencia.</p>',
                    confirmButtonText: 'Entendido',
                    allowOutsideClick: false
                });
            } else {
                mostrarToastPacking(
                    'warning',
                    'Secuencia incompleta',
                    'Completa ' + etiqueta + ' (contador en 0) antes de enviar todas juntas.'
                );
            }
            return false;
        }
        const rawActivo = String(elMuestra?.value || '').trim();
        asegurarBorradoresAntesEnvioPacking_(lista);
        persistirBorradoresContadorCeroPacking_(elFecha?.value);
        persistirBorradoresCompletasPacking_(elFecha?.value);
        const ordenadas = ordenadasAsc.slice().reverse();
        const capturas = [];
        for (const item of ordenadas) {
            const cap = await asegurarCapturaEnvioPacking_(item.raw);
            if (!cap || !hayDatosTrabajoMuestraPacking(cap.estado)) {
                const etiqueta = item.etiqueta || textoSelectMuestra(item.num_muestra, item.ensayo_numero);
                mostrarToastPacking(
                    'warning',
                    'Datos no disponibles',
                    'No hay datos guardados para ' + (etiqueta || 'la muestra') + '. Ábrela, verifica el 0 verde y reintenta.'
                );
                await refrescarMuestraPackingActivaTrasLote_(rawActivo, ordenadasAsc);
                return false;
            }
            capturas.push({ item, cap });
        }

        const optsLote = { sinUi: true, sinLoading: true, sinToast: true };
        envioPackingEnCurso = true;
        setButtonLoadingPacking(elBtnEnviarPacking, true, 'Enviando muestras...');
        let enviados = 0;
        try {
            for (const { cap } of capturas) {
                const ok = await enviarPackingDesdeCaptura_(cap, optsLote);
                if (!ok) {
                    if (enviados > 0) {
                        mostrarToastPacking(
                            'info',
                            'Envío parcial',
                            enviados + ' muestra(s) enviada(s); revisa la siguiente.'
                        );
                    }
                    await refrescarMuestraPackingActivaTrasLote_(rawActivo, ordenadasAsc);
                    return false;
                }
                enviados++;
            }
        } finally {
            envioPackingEnCurso = false;
            setButtonLoadingPacking(elBtnEnviarPacking, false);
        }

        if (enviados > 0) {
            const fechaLote = normalizarFechaIso(elFecha?.value);
            await guardarPdfPackingHistorialTrasEnvio_(
                capturas.map(({ item, cap }) => ({
                    num_muestra: cap.num_muestra,
                    ensayo_numero: cap.ensayo_numero,
                    raw: item.raw,
                    estado: cap.estado
                })),
                fechaLote
            );
            await refrescarMuestraPackingActivaTrasLote_(rawActivo, ordenadasAsc);
            const totalFilas = capturas.reduce(
                (n, c) => n + (Array.isArray(c.cap.estado?.packingCards) ? c.cap.estado.packingCards.length : 0),
                0
            );
            mostrarToastPacking(
                'success',
                'Muestras enviadas',
                enviados + ' muestra(s) enviadas (' + totalFilas + ' filas). Te quedaste en la muestra activa.'
            );
        }
        return enviados > 0;
    }

    async function guardarRegistroYEnviarDesdePantallaPacking() {
        if (envioPackingEnCurso) return;

        let validandoUi = true;
        setButtonLoadingPacking(elBtnEnviarPacking, true, 'Validando…');
        const liberarValidacionUi = () => {
            if (!validandoUi) return;
            validandoUi = false;
            if (!envioPackingEnCurso) setButtonLoadingPacking(elBtnEnviarPacking, false);
        };

        try {
            const enUso = muestrasEnUsoPackingDelDia_();
            const completas = necesitaRefrescarQuotaServidorPacking_(enUso)
                ? await prepararDeteccionEnvioPacking_()
                : prepararDeteccionEnvioPackingLocal_();
            const analisis = analizarMuestrasPackingDelDia_();
            const candidatas = resolverCandidatasModalEnvioPacking_(completas);
            asegurarBorradoresAntesEnvioPacking_(candidatas);
            const rawActivo = String(elMuestra?.value || '').trim();

            if (analisis.pendientes.length) {
                liberarValidacionUi();
                const ok = await confirmarContinuarEnvioConPendientesPacking_(analisis);
                if (!ok) return;
                setButtonLoadingPacking(elBtnEnviarPacking, true, 'Validando…');
                validandoUi = true;
            }

            if (!candidatas.length) {
                if (!muestraSeleccionada()) {
                    setStatus('Selecciona una muestra antes de enviar.', 'warn');
                    return;
                }
                if (muestraPackingYaCompletaEnServidor_(packingQuota)) {
                    mostrarToastPacking(
                        'info',
                        'Ya en planilla',
                        'Este packing ya está completo en el servidor. Selecciona otra muestra pendiente.'
                    );
                    return;
                }
                validandoUi = false;
                await enviarPackingMuestraActual_();
                return;
            }

            let plan = null;
            if (candidatas.length >= 2) {
                liberarValidacionUi();
                plan = await seleccionarMuestraPackingParaEnviar_(rawActivo, candidatas, analisis);
                if (!plan) return;
                setButtonLoadingPacking(elBtnEnviarPacking, true, 'Enviando…');
                validandoUi = false;
            } else {
                validandoUi = false;
                plan = { modo: 'una', raw: candidatas[0].raw };
            }

            if (plan.modo === 'todas') {
                await enviarPackingMuestrasEnSecuencia_(plan.lista);
                return;
            }

            const raw = String(plan.raw || rawActivo).trim();
            const cap = capturaEstadoMuestraParaValidacion_(raw);
            if (cap && muestraPackingPendienteDeEnvio_(cap.estado, cap.quotaSnap, raw)) {
                if (raw !== rawActivo) {
                    const ok = await enviarPackingDesdeCaptura_(cap);
                    if (ok) await refrescarMuestraPackingActivaTrasLote_(rawActivo, candidatas);
                    return;
                }
                await enviarPackingMuestraActual_();
                return;
            }
            if (raw && raw !== rawActivo) {
                await cargarMuestraPackingParaEnvio_(raw);
            }
            await enviarPackingMuestraActual_();
        } finally {
            liberarValidacionUi();
        }
    }

    let cargandoMuestrasSeq = 0;
    let lastDetallePacking = null;

    const elFabMenu = document.getElementById('fab-menu-packing');
    const elFabOptionsBtn = document.getElementById('fab-options-btn-packing');

    function crearIconosPacking() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function establecerMenuFlotantePacking(open) {
        if (!elFabMenu || !elFabOptionsBtn) return;
        elFabMenu.classList.toggle('is-open', open);
        elFabOptionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    const elFechaRingWidget = document.getElementById('packing-fecha-ring-widget');
    const elFechaRingCircle = document.getElementById('packing-fecha-ring-circle');
    const elFechaRingPopover = document.getElementById('packing-fecha-ring-popover');

    function mensajeFechaRingPacking(d) {
        const mesLargo = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d);
        const dia = d.getDate();
        const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        if (dia <= 7) {
            return mesLargo + ' recién comenzó — día ' + dia + ' de ' + diasMes;
        }
        return 'Estamos en ' + mesLargo + ' — día ' + dia + ' de ' + diasMes;
    }

    function actualizarArcoFechaRingPacking(d) {
        if (!elFechaRingCircle) return;
        const dia = d.getDate();
        const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const progreso = Math.min(1, Math.max(0, dia / diasMes));
        const arcoDeg = Math.round(70 * progreso);
        const corte = 280 - arcoDeg;
        elFechaRingCircle.style.background = 'conic-gradient(from 210deg, rgba(22, 76, 124, 0.18) 0deg '
            + corte + 'deg, rgba(29, 78, 137, 0.92) ' + corte + 'deg 360deg)';
    }

    function actualizarFechaRingPacking() {
        const dayEl = document.getElementById('fecha-ring-day-packing');
        const monthEl = document.getElementById('fecha-ring-month-packing');
        if (!dayEl || !monthEl) return;
        const d = new Date();
        dayEl.textContent = String(d.getDate()).padStart(2, '0');
        const mes = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '');
        monthEl.textContent = (mes + ' ' + d.getFullYear()).toUpperCase();
        const msg = mensajeFechaRingPacking(d);
        if (elFechaRingPopover && !elFechaRingWidget?.classList.contains('is-popover-open')) {
            elFechaRingPopover.textContent = msg;
        }
        if (elFechaRingWidget) elFechaRingWidget.title = msg;
        actualizarArcoFechaRingPacking(d);
    }

    function togglePopoverFechaRingPacking(forceOpen) {
        if (!elFechaRingWidget || !elFechaRingPopover) return;
        const abrir = forceOpen === true
            ? true
            : (forceOpen === false ? false : !elFechaRingWidget.classList.contains('is-popover-open'));
        const d = new Date();
        elFechaRingPopover.textContent = mensajeFechaRingPacking(d);
        elFechaRingWidget.classList.toggle('is-popover-open', abrir);
        elFechaRingPopover.hidden = !abrir;
    }

    async function sincronizarConPlanillaPacking() {
        establecerMenuFlotantePacking(false);
        if (!navigator.onLine) {
            setStatus('Sin internet para sincronizar con la planilla.', 'warn');
            return;
        }
        setSelectLoading(true, 'Sincronizando planilla…');
        try {
            await sincronizarPendientesPacking();
            await acotarFechaDesdePlanilla();
            const fecha = elFecha?.value || '';
            if (fecha) await cargarMuestrasPorFecha(fecha);
            const sel = ensayoSeleccionado();
            if (fecha && sel.ensayo_numero) await cargarDetalle(fecha, sel.ensayo_numero);
            setStatus('Planilla actualizada.', '');
            if (elStatus) elStatus.hidden = true;
        } catch (err) {
            setStatus(String(err.message || err), 'error');
        } finally {
            setSelectLoading(false);
        }
    }

    async function borrarTodoYCachePacking() {
        establecerMenuFlotantePacking(false);
        const confirmado = await confirmarSwalPacking_({
            icon: 'warning',
            title: 'Eliminar todo local',
            html: '<p style="margin:0 0 8px;font-size:14px;line-height:1.45;">'
                + 'Se borrará todo lo guardado en packing: borradores, clamshells, tiempos, control, cola pendiente e historial local.'
                + '</p>'
                + '<p style="margin:0;font-size:13px;color:#64748b;line-height:1.4;">'
                + 'La app se recargará. Los chips de trazabilidad pueden volver desde la planilla; responsable y hora de packing quedan vacíos para capturar de nuevo.'
                + '</p>',
            showCancelButton: true,
            confirmButtonText: 'Sí, borrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#D92D20',
            allowOutsideClick: false
        });
        if (!confirmado) return;

        packingOmitirAutoguardado = true;
        clearTimeout(packingDraftSaveTimer);

        try { localStorage.removeItem(PACKING_DRAFT_STORAGE_KEY); } catch (_) { /* ignore */ }
        try { localStorage.removeItem(SYNC_QUEUE_KEY); } catch (_) { /* ignore */ }
        try { localStorage.removeItem(SYNC_HISTORY_KEY); } catch (_) { /* ignore */ }
        try { localStorage.removeItem(PACKING_CHIPS_COLLAPSED_KEY); } catch (_) { /* ignore */ }
        try {
            if (window.HistPdfStore && typeof window.HistPdfStore.borrarTodo === 'function') {
                await window.HistPdfStore.borrarTodo();
            }
        } catch (_) { /* ignore */ }

        packingCards = [];
        packingActiveCardId = null;
        lastDetallePacking = null;
        limpiarUiCapturaMuestraPacking_();
        if (elResponsable) elResponsable.value = '';
        resetMuestraSelect('Seleccionar muestra', false);
        setResumenVisible(false);
        limpiarPreviewChips();
        renderizarCardsPacking();
        actualizarFabRestanteBadge();
        actualizarBtnEnviarPacking();
        actualizarHeaderPendientes();

        try {
            if (typeof caches !== 'undefined' && caches?.keys) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
            if (navigator.serviceWorker?.getRegistrations) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
            }
        } catch (_) { /* ignore */ }

        mostrarToastPacking('success', 'Limpieza completa', 'Recargando packing…');
        setTimeout(() => {
            try {
                window.location.reload();
            } catch (_) { /* ignore */ }
        }, 450);
    }

    function sumarMinutosHoraPacking(hora, minutosAgregar) {
        const m = minutosDesdeHoraPacking(hora);
        if (m === null) return '';
        const total = ((m + minutosAgregar) % (24 * 60) + (24 * 60)) % (24 * 60);
        return String(Math.floor(total / 60)).padStart(2, '0') + ':'
            + String(total % 60).padStart(2, '0');
    }

    function totalFilasCampoPacking() {
        const d = lastDetallePacking;
        const total = Number(
            d?.FILAS_REGISTRADAS ?? d?.numFilas ?? d?.FILAS_TOTAL_CAMPO ?? packingQuota.filasTotalCampo ?? 0
        );
        return Number.isFinite(total) && total > 0 ? total : 0;
    }

    function pesosDemoParaClamshellPacking(clamshellNum) {
        const limite = getLimitePesoRecepcionPacking(clamshellNum);
        let recep;
        if (limite != null && limite > 0) {
            recep = limite;
        } else {
            recep = Math.max(80, 125 - (clamshellNum - 1) * 4);
        }
        recep = Math.round(recep * 10) / 10;
        const r1 = (n) => Math.round(Math.max(0.1, n) * 10) / 10;

        let salPre = r1(Math.max(1, recep * 0.70));
        let ingPre = r1(Math.max(salPre, recep * 0.78));
        let salGas = r1(Math.max(ingPre, recep * 0.85));
        let ingGas = r1(Math.min(recep, Math.max(salGas, recep * 0.92)));

        ingGas = Math.min(recep, ingGas);
        salGas = Math.min(recep, Math.max(ingPre, salGas));
        ingPre = Math.max(salPre, Math.min(salGas, ingPre));
        salPre = Math.min(ingPre, Math.max(1, salPre));

        const pesos = {
            recepcion: recep,
            ingresoGas: ingGas,
            salidaGas: salGas,
            ingresoPre: ingPre,
            salidaPre: salPre
        };
        const err = validarSecuenciaPesosPacking(pesos, limite);
        if (!err.length) return pesos;

        salPre = r1(Math.max(1, recep * 0.75));
        ingPre = r1(salPre + Math.max(0.5, recep * 0.03));
        salGas = r1(ingPre + Math.max(0.5, recep * 0.03));
        ingGas = r1(Math.min(recep, salGas + Math.max(0.5, recep * 0.02)));
        return {
            recepcion: recep,
            ingresoGas: Math.min(recep, ingGas),
            salidaGas: Math.min(recep, Math.max(ingPre, salGas)),
            ingresoPre: Math.max(salPre, Math.min(salGas, ingPre)),
            salidaPre: Math.min(ingPre, Math.max(1, salPre))
        };
    }

    function llenarTiemposDemoPacking(plantilla) {
        const p = plantilla || PACKING_DEMO_PLANTILLA;
        initHoraInicio(true);
        const baseHora = getHoraPersonal() || '08:00';
        const offsetsMin = Array.isArray(p.offsetsTiemposMin) ? p.offsetsTiemposMin : [];
        TIEMPOS_MUESTRA_IDS.forEach((id, i) => {
            const inp = document.getElementById(id);
            if (inp) inp.value = sumarMinutosHoraPacking(baseHora, offsetsMin[i] || 0);
        });
    }

    function llenarControlEquitativoDemoPacking(plantilla) {
        const p = plantilla || PACKING_DEMO_PLANTILLA;
        packingControlState.tipo = null;
        packingControlState.temperatura.amb = (p.temperaturaAmb || []).slice(0, 5);
        packingControlState.temperatura.pulpa = (p.temperaturaPulpa || []).slice(0, 5);
        packingControlState.humedad = (p.humedad || []).slice(0, 5);
        while (packingControlState.temperatura.amb.length < 5) packingControlState.temperatura.amb.push('');
        while (packingControlState.temperatura.pulpa.length < 5) packingControlState.temperatura.pulpa.push('');
        while (packingControlState.humedad.length < 5) packingControlState.humedad.push('');
        recalcularPresionesPacking();
        actualizarContadoresPresionPacking();
    }

    function guardarBorradorMuestraActivaInmediato_() {
        if (packingOmitirAutoguardado || packingRestaurandoBorrador || !muestraSeleccionada()) return '';
        const key = claveBorradorMuestraPacking(elFecha?.value, elMuestra?.value);
        if (!key) return '';
        escribirBorradorMuestraPacking_(key, capturarEstadoMuestraPacking());
        return key;
    }

    /** Demo packing: escribe en inputs/campos visibles; el borrador captura el mismo estado que edición manual. */
    function aplicarDemoPackingEnMuestraActiva_(objetivoLocal, sel, plantilla) {
        const p = plantilla || PACKING_DEMO_PLANTILLA;
        const prefObs = String(p.observacionPrefijo || 'SIM-');

        limpiarUiCapturaMuestraPacking_();
        packingCards = [];
        packingActiveCardId = null;
        for (let i = 0; i < objetivoLocal; i++) {
            const num = packingQuota.filasPackingRegistradas + i + 1;
            const card = crearCardPacking(num);
            card.pesos = pesosDemoParaClamshellPacking(num);
            card.observacion = prefObs + num;
            packingCards.push(card);
        }
        packingActiveCardId = packingCards[0]?.id ?? null;

        if (elResponsable) {
            elResponsable.value = String(p.responsable || 'Demo packing');
        }
        packingNViaje = normalizarNViajePackingInput_(p.nViaje);
        actualizarBtnViajePackingTitulo_();

        llenarTiemposDemoPacking(p);
        llenarControlEquitativoDemoPacking(p);

        renderizarCardsPacking();
        actualizarContadoresTiempo();
        actualizarContadoresPresionPacking();
        actualizarFabRestanteBadge();
        guardarBorradorMuestraActivaInmediato_();

        return {
            etiqueta: textoSelectMuestra(sel.num_muestra, sel.ensayo_numero),
            ensayo: sel.ensayo_numero
        };
    }

    async function fabIniciarRegistroPacking() {
        establecerMenuFlotantePacking(false);
        const rawMuestra = String(elMuestra?.value || '').trim();
        if (!rawMuestra) {
            mostrarToastPacking('info', 'Seleccionar muestra', 'Selecciona una muestra antes de cargar datos de prueba.');
            return;
        }
        const sel = ensayoSeleccionado();
        if (!sel.ensayo_numero) {
            mostrarToastPacking('info', 'Seleccionar muestra', 'Espera a que cargue la muestra en el selector.');
            return;
        }
        if (!lastDetallePacking) {
            mostrarToastPacking('info', 'Espera el detalle', 'Carga el detalle de la muestra (planilla) antes de simular.');
            return;
        }
        const totalServidor = totalFilasCampoPacking();
        if (totalServidor <= 0) {
            mostrarToastPacking('warn', 'Sin filas', 'No hay filas de campo en el servidor para simular.');
            return;
        }
        const maxEfectivo = cuotaMaximaEfectivaPacking();
        const enServidor = packingQuota.filasPackingRegistradas;
        const objetivoLocal = Math.min(
            maxEfectivo - enServidor,
            totalServidor - enServidor,
            slotsDisponiblesEnServidorPacking()
        );
        if (objetivoLocal <= 0) {
            mostrarToastPacking(
                'info',
                'Packing completo',
                'Esta muestra ya tiene todos sus clamshells (' + totalServidor + ').'
            );
            return;
        }

        const info = aplicarDemoPackingEnMuestraActiva_(objetivoLocal, sel, PACKING_DEMO_PLANTILLA);
        const validacionDemo = validarCompletitudPackingParaEnvio();
        if (!validacionDemo.ok) {
            setStatus(
                'La simulación no pasó validación: ' + (validacionDemo.errores[0] || 'revisa los datos.'),
                'warn'
            );
            if (elStatus) elStatus.hidden = false;
            await mostrarErroresCompletitudPacking_(
                validacionDemo.errores,
                'Simulación packing incompleta'
            );
        } else {
            setStatus('');
            if (elStatus) elStatus.hidden = true;
            mostrarToastPacking(
                'success',
                'Datos de prueba',
                info.etiqueta + ' (muestra ' + (info.ensayo || '—') + '): '
                    + objetivoLocal + ' clamshell(s) válidos para enviar.'
            );
        }

        actualizarBtnEnviarPacking();
        crearIconosPacking();
    }

    function hoyIsoLocal() {
        const d = new Date();
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function sleepMs(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    async function withMinLoader(fn) {
        const t0 = Date.now();
        const out = await fn();
        const wait = MIN_LOADER_MS - (Date.now() - t0);
        if (wait > 0) await sleepMs(wait);
        return out;
    }

    function actualizarHeaderConexion() {
        const on = navigator.onLine;
        if (elHeaderCard) {
            elHeaderCard.classList.toggle('is-online', on);
            elHeaderCard.classList.toggle('is-offline', !on);
        }
        if (elHeaderConn) elHeaderConn.textContent = on ? 'En línea' : 'Sin internet';
    }

    function actualizarHeaderPendientes() {
        if (!elHeaderPend) return;
        let n = 0;
        try {
            const raw = localStorage.getItem(SYNC_QUEUE_KEY);
            const q = raw ? JSON.parse(raw) : [];
            if (Array.isArray(q)) {
                n = q.filter((r) => String(r?.estado || '') === 'pendiente').length;
            }
        } catch (_) { /* ignore */ }
        elHeaderPend.textContent = String(n).padStart(2, '0');
        elHeaderPend.classList.toggle('header-status-pend-num--alert', n > 0);
    }

    /** Solo bloquea fecha mientras carga; el select de muestra lo controla cargarMuestrasPorFecha. */
    function setSelectLoading(on, mensaje) {
        if (elSelectBlock) elSelectBlock.classList.toggle('is-busy', on);
        if (elSelectLoader) elSelectLoader.hidden = !on;
        if (elSelectLoaderMsg && mensaje) elSelectLoaderMsg.textContent = mensaje;
        if (elFecha) elFecha.disabled = on;
    }

    function setResumenVisible(visible) {
        if (!elResumen) return;
        elResumen.classList.toggle('is-empty', !visible);
        if (elResumenToggle) elResumenToggle.hidden = !visible;
        syncPackingFoldBtnAnchor();
    }

    let foldBtnSyncRaf = 0;
    function syncPackingFoldBtnAnchor() {
        if (foldBtnSyncRaf) cancelAnimationFrame(foldBtnSyncRaf);
        foldBtnSyncRaf = requestAnimationFrame(() => {
            foldBtnSyncRaf = 0;
            const shell = elMetaShell;
            const select = elSelectBlock;
            if (!shell || !select || elResumenToggle?.hidden) return;

            shell.style.setProperty('--pk-select-end', select.offsetHeight + 'px');

            const vacio = elResumen?.classList.contains('is-empty');
            const compact = !vacio && elResumen?.classList.contains('is-collapsed');
            shell.classList.toggle('is-fold-btn-compact', compact);
            shell.classList.toggle('is-fold-btn-expanded', !vacio && !compact);
        });
    }

    function setChipsPanelCollapsed(collapsed, persist) {
        if (!elChipsPanel || !elResumenToggle) return;
        elChipsPanel.classList.toggle('is-collapsed', collapsed);
        if (elResumen) elResumen.classList.toggle('is-collapsed', collapsed);
        elResumenToggle.classList.toggle('is-active', collapsed);
        elResumenToggle.setAttribute('aria-expanded', (!collapsed).toString());
        const titulo = collapsed ? 'Mostrar datos del registro' : 'Ocultar datos del registro';
        elResumenToggle.title = titulo;
        elResumenToggle.setAttribute('aria-label', titulo);
        if (persist) {
            try {
                localStorage.setItem(PACKING_CHIPS_COLLAPSED_KEY, collapsed ? '1' : '0');
            } catch (_) { /* ignore */ }
        }
        crearIconosPacking();
        syncPackingFoldBtnAnchor();
    }

    function toggleChipsPanelCollapsed() {
        if (elResumen?.classList.contains('is-loading-resumen')) return;
        setChipsPanelCollapsed(!elChipsPanel?.classList.contains('is-collapsed'), true);
    }

    function setPreviewLoading(on, mensaje) {
        if (on) setChipsPanelCollapsed(false, false);
        if (elResumen) elResumen.classList.toggle('is-loading-resumen', !!on);
        if (elPreview) {
            elPreview.classList.toggle('is-loading-preview', on);
            if (!on) elPreview.classList.remove('is-loaded');
        }
        if (elPreviewLoader) elPreviewLoader.hidden = !on;
        if (elPreviewLoaderMsg && mensaje) elPreviewLoaderMsg.textContent = mensaje;
        if (elResumenToggle) {
            elResumenToggle.disabled = !!on;
            elResumenToggle.setAttribute('aria-disabled', on ? 'true' : 'false');
            elResumenToggle.classList.toggle('is-loading-blocked', !!on);
            if (on) {
                elResumenToggle.title = 'Espera mientras cargan los datos';
            } else {
                const collapsed = elChipsPanel?.classList.contains('is-collapsed');
                const titulo = collapsed ? 'Mostrar datos del registro' : 'Ocultar datos del registro';
                elResumenToggle.title = titulo;
            }
        }
        syncPackingFoldBtnAnchor();
    }

    function setStatus(msg, tipo) {
        if (!elStatus) return;
        elStatus.textContent = msg || '';
        elStatus.className = 'packing-status-msg' + (tipo ? ' packing-status-msg--' + tipo : '');
        elStatus.hidden = !msg;
        syncPackingFoldBtnAnchor();
    }

    function callbackJsonp(params, timeoutMs) {
        const limiteMs = Number(timeoutMs);
        const espera = Number.isFinite(limiteMs) && limiteMs > 0 ? limiteMs : 14000;
        return new Promise((resolve, reject) => {
            const cb = '__pk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            const noop = function () {};
            const qs = new URLSearchParams(params || {});
            qs.set('callback', cb);
            qs.set('_ts', String(Date.now()));
            const src = API_URL + (API_URL.includes('?') ? '&' : '?') + qs.toString();
            const script = document.createElement('script');
            let done = false;
            const timeoutId = setTimeout(() => {
                if (done) return;
                done = true;
                window[cb] = noop;
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('La planilla tardó demasiado. Reintenta.'));
            }, espera);
            window[cb] = (payload) => {
                if (done) return;
                done = true;
                clearTimeout(timeoutId);
                window[cb] = noop;
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(payload);
            };
            script.onerror = () => {
                if (done) return;
                done = true;
                clearTimeout(timeoutId);
                window[cb] = noop;
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Error de conexión con el servidor'));
            };
            script.src = src;
            document.body.appendChild(script);
        });
    }

    function normalizarFechaIso(f) {
        const s = String(f || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return s;
    }

    function armarListaMuestrasDesdeRegistrados(registrados, fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        const seen = {};
        const lista = [];
        (registrados || []).forEach((item) => {
            const f = normalizarFechaIso(item?.fecha);
            if (f !== fecha) return;
            const num = String(item?.num_muestra || '').trim();
            const en = String(item?.ensayo_numero || '').trim();
            if (!num || !en) return;
            const key = num + '|' + en;
            if (seen[key]) return;
            seen[key] = true;
            lista.push({
                num_muestra: num,
                ensayo_numero: en,
                etiqueta: num + ' - ' + en + ' muestra'
            });
        });
        lista.sort((a, b) => {
            const na = Number(a.ensayo_numero) || 0;
            const nb = Number(b.ensayo_numero) || 0;
            return na - nb || String(a.num_muestra).localeCompare(String(b.num_muestra));
        });
        return lista;
    }

    function muestrasOfflineDesdeBorradorPacking(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) return [];
        const store = leerStoreBorradorPacking();
        const lista = [];
        const visto = new Set();
        Object.keys(store.porClave || {}).forEach((key) => {
            if (!key.startsWith(fecha + '::')) return;
            const raw = key.slice(fecha.length + 2);
            if (!raw || visto.has(raw)) return;
            visto.add(raw);
            const partes = raw.split('|');
            const num = String(partes[0] || '').trim();
            const en = String(partes[1] || '').trim();
            const borrador = store.porClave[key];
            lista.push({
                num_muestra: num || String(borrador?.meta?.num_muestra || '').trim(),
                ensayo_numero: en || String(borrador?.meta?.ensayo_numero || '').trim()
            });
        });
        return lista.filter((m) => m.num_muestra || m.ensayo_numero).sort((a, b) => {
            const na = Number(a.ensayo_numero) || 0;
            const nb = Number(b.ensayo_numero) || 0;
            return na - nb || String(a.num_muestra).localeCompare(String(b.num_muestra));
        });
    }

    async function fetchMuestrasPorFecha(fechaIso) {
        const r = await callbackJsonp({
            listado_muestras_fecha: '1',
            fecha: fechaIso
        });
        if (r && r.ok === true && Array.isArray(r.muestras)) {
            return r.muestras;
        }
        const r2 = await callbackJsonp({
            listado_registrados: '1',
            fecha_desde: fechaIso,
            fecha_hasta: fechaIso
        });
        if (r2 && r2.ok === true && Array.isArray(r2.registrados)) {
            return armarListaMuestrasDesdeRegistrados(r2.registrados, fechaIso);
        }
        const err = String(r?.error || r2?.error || 'No se pudo leer el listado');
        if (err === 'accion_no_soportada') {
            throw new Error('Redespliega code.gs en Apps Script (falta listado_muestras_fecha)');
        }
        throw new Error(err);
    }

    function textoSelectMuestra(num, en) {
        const n = String(num || '').trim();
        const e = String(en || '').trim();
        if (n && e) return n + ' - ' + e + ' muestra';
        return n || e;
    }

    function poblarSelectMuestra(lista) {
        if (!elMuestra) return;
        elMuestra.innerHTML = '';
        const opt0 = document.createElement('option');
        opt0.value = '';
        const n = lista.length;
        opt0.textContent = n ? ('Seleccionar muestra (' + n + ')') : 'Sin muestras';
        elMuestra.appendChild(opt0);
        lista.forEach((item) => {
            const opt = document.createElement('option');
            const num = String(item.num_muestra || '').trim();
            const en = String(item.ensayo_numero || '').trim();
            opt.value = num + '|' + en;
            opt.textContent = textoSelectMuestra(num, en);
            elMuestra.appendChild(opt);
        });
        elMuestra.disabled = n === 0;
        elMuestra.removeAttribute('disabled');
        if (n === 0) elMuestra.setAttribute('disabled', 'disabled');
    }

    function setChip(id, texto, vacio, extraClass) {
        const el = document.getElementById(id);
        if (!el) return;
        const val = String(texto ?? '').trim();
        el.textContent = val || '--';
        el.className = 'packing-chip-value' + (extraClass ? ' ' + extraClass : '');
        el.classList.toggle('packing-chip-value--empty', vacio || !val);
    }

    function limpiarPreviewChips() {
        if (elPreview) {
            elPreview.classList.remove('is-loaded', 'is-loading-preview');
        }
        setChip(previewIds.traz, '', true, 'packing-chip-value--traz');
        setChip(previewIds.variedad, '', true);
        setChip(previewIds.placa, '', true);
    }

    function limpiarPreview() {
        if (muestraSeleccionada() && !packingRestaurandoBorrador) {
            snapshotMuestraPackingSiHayTrabajo(elFecha?.value, elMuestra?.value);
        }
        setResumenVisible(false);
        lastDetallePacking = null;
        setPackingCardHabilitada(false);
        limpiarUiCapturaMuestraPacking_();
        resetCardsPacking();
        limpiarPreviewChips();
        if (elResponsable) elResponsable.value = '';
    }

    function pintarPreview(d) {
        if (!d) {
            limpiarPreview();
            return;
        }
        const etapa = String(d.TRAZ_ETAPA ?? '').trim();
        const campo = String(d.TRAZ_CAMPO ?? '').trim();
        const turno = String(d.TRAZ_TURNO ?? d.TRAZ_LIBRE ?? '').trim();
        const traz = [etapa, campo, turno].filter(Boolean).join('-');

        setChip(previewIds.traz, traz, !traz, 'packing-chip-value--traz');
        setChip(previewIds.variedad, d.VARIEDAD, !String(d.VARIEDAD ?? '').trim());
        setChip(previewIds.placa, d.PLACA_VEHICULO, !String(d.PLACA_VEHICULO ?? '').trim());

        aplicarCuotaDesdeDetalle(d);
        registrarQuotaServidorMuestraPacking_(elFecha?.value, elMuestra?.value, d);
        logMetaServidorPackingConsola(d);

        if (elPreview) {
            elPreview.classList.remove('is-loading-preview');
            elPreview.classList.add('is-loaded');
        }

        const yaEnServidor = muestraPackingYaCompletaEnServidor_(packingQuota);
        const key = claveBorradorMuestraPacking(elFecha?.value, elMuestra?.value);
        const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
        if (!yaEnServidor && borrador && hayDatosTrabajoMuestraPacking(borrador)) {
            aplicarEstadoMuestraPacking(borrador, { skipPreview: true });
        } else {
            limpiarUiCapturaMuestraPacking_();
            packingNViaje = normalizarNViajePackingInput_(
                textoMetaCampoPdfPacking_(d.N_VIAJE ?? d.n_viaje)
            );
            actualizarBtnViajePackingTitulo_();
            reiniciarCardsPacking();
        }
        setPackingCardHabilitada(muestraSeleccionada());
        actualizarFabRestanteBadge();
        syncPackingFoldBtnAnchor();
    }

    function resetMuestraSelect(mensaje, deshabilitar) {
        poblarSelectMuestra([]);
        if (elMuestra && mensaje) {
            elMuestra.options[0].textContent = mensaje;
        }
        if (elMuestra) elMuestra.disabled = deshabilitar !== false;
        limpiarPreview();
    }

    /** Siempre hoy: tope máximo = fecha actual; valor por defecto = hoy. */
    function aplicarFechaHoyPacking_(opts) {
        if (!elFecha) return false;
        const hoy = hoyIsoLocal();
        const prev = elFecha.value;
        elFecha.max = hoy;
        if (elFecha.min && elFecha.min > hoy) {
            elFecha.removeAttribute('min');
        }
        const forzar = opts?.forzar !== false;
        if (forzar || !prev || prev > hoy) {
            elFecha.value = hoy;
        } else if (prev < (elFecha.min || '')) {
            elFecha.value = hoy;
        }
        return prev !== elFecha.value;
    }

    function initFechaInput() {
        aplicarFechaHoyPacking_({ forzar: true });
    }

    async function acotarFechaDesdePlanilla() {
        if (!elFecha || !navigator.onLine) return;
        setSelectLoading(true, 'Conectando con planilla…');
        try {
            await withMinLoader(async () => {
                const r = await callbackJsonp({});
                if (!r || r.ok !== true || !Array.isArray(r.fechas) || !r.fechas.length) {
                    aplicarFechaHoyPacking_({ forzar: true });
                    return;
                }
                const fechas = r.fechas.filter(Boolean).sort();
                const hoy = hoyIsoLocal();
                if (fechas[0] && fechas[0] <= hoy) {
                    elFecha.min = fechas[0];
                } else {
                    elFecha.removeAttribute('min');
                }
                aplicarFechaHoyPacking_({ forzar: true });
            });
        } catch (_) {
            aplicarFechaHoyPacking_({ forzar: true });
        } finally {
            setSelectLoading(false);
        }
    }

    async function cargarMuestrasPorFecha(fechaIso) {
        const fecha = normalizarFechaIso(fechaIso);
        if (!fecha) {
            resetMuestraSelect('Seleccionar fecha', true);
            return;
        }

        const seq = ++cargandoMuestrasSeq;
        if (elMuestra) {
            elMuestra.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Cargando…';
            elMuestra.appendChild(opt);
            elMuestra.disabled = true;
        }
        limpiarPreview();

        if (!navigator.onLine) {
            const listaLocal = muestrasOfflineDesdeBorradorPacking(fecha);
            if (listaLocal.length) {
                poblarSelectMuestra(listaLocal);
                restaurarMuestraActivaDesdeBorrador();
                setStatus('Sin internet: muestras recuperadas del borrador local.', 'warn');
                if (elStatus) elStatus.hidden = false;
            } else {
                setStatus('Sin internet. No hay borradores guardados para esta fecha.', 'warn');
                resetMuestraSelect('Sin conexión', true);
            }
            return;
        }

        setSelectLoading(true, 'Cargando muestras…');
        setStatus('');
        if (elStatus) elStatus.hidden = true;

        try {
            const lista = await withMinLoader(() => fetchMuestrasPorFecha(fecha));
            if (seq !== cargandoMuestrasSeq) return;
            poblarSelectMuestra(lista);
            restaurarMuestraActivaDesdeBorrador();
            if (!lista.length) {
                setStatus('No hay registros de campo para esa fecha.', 'warn');
            }
        } catch (err) {
            if (seq !== cargandoMuestrasSeq) return;
            const msg = String(err.message || err);
            setStatus(msg, 'error');
            if (elMuestra) {
                elMuestra.innerHTML = '';
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Error — cambia la fecha';
                elMuestra.appendChild(opt);
                elMuestra.disabled = false;
            }
        } finally {
            if (seq === cargandoMuestrasSeq) setSelectLoading(false);
        }
    }

    async function fetchDetallePackingJsonp_(fechaIso, ensayoNumero) {
        const params = { fecha: fechaIso, ensayo_numero: ensayoNumero };
        const intentos = [22000, 28000];
        let ultimoErr = null;
        for (let i = 0; i < intentos.length; i++) {
            try {
                return await callbackJsonp(params, intentos[i]);
            } catch (err) {
                ultimoErr = err;
                if (i >= intentos.length - 1) break;
            }
        }
        throw ultimoErr || new Error('La planilla tardó demasiado. Reintenta.');
    }

    async function cargarDetalle(fechaIso, ensayoNumero, opts) {
        if (!fechaIso || !ensayoNumero) return;
        const sinOverlay = !!(opts && opts.sinOverlay);
        cancelarGuardadoBorradorProgramadoPacking_();
        packingOmitirAutoguardado = true;
        const rawMuestra = String(elMuestra?.value || '').trim();
        const key = claveBorradorMuestraPacking(fechaIso, rawMuestra);
        try {
        if (!navigator.onLine) {
            const borrador = key ? leerStoreBorradorPacking().porClave[key] : null;
            if (borrador && hayDatosTrabajoMuestraPacking(borrador)) {
                setResumenVisible(true);
                setChipsPanelCollapsed(false, false);
                setPreviewLoading(false);
                aplicarEstadoMuestraPacking(borrador);
                setPackingCardHabilitada(true);
                setStatus('Sin internet: datos recuperados del borrador local.', 'warn');
                return;
            }
            setStatus('Sin internet para cargar el detalle.', 'warn');
            return;
        }
        if (!sinOverlay) {
            limpiarPreviewChips();
            setResumenVisible(true);
            setChipsPanelCollapsed(false, false);
            setPreviewLoading(true, 'Cargando datos…');
            setStatus('');
            if (elStatus) elStatus.hidden = true;
        }
            const r = await (sinOverlay
                ? fetchDetallePackingJsonp_(fechaIso, ensayoNumero)
                : withMinLoader(() => fetchDetallePackingJsonp_(fechaIso, ensayoNumero)));
            if (!r || r.ok !== true || !r.data) {
                throw new Error(r?.error || 'Registro no encontrado');
            }
            lastDetallePacking = r.data;
            pintarPreview(r.data);
        } catch (err) {
            if (!sinOverlay) {
                setStatus(String(err.message || err), 'error');
                limpiarPreview();
            }
        } finally {
            packingOmitirAutoguardado = false;
            if (!sinOverlay) setPreviewLoading(false);
        }
    }

    function onFechaCambiada() {
        const fechaPrev = packingFechaAnterior || elFecha?.value || '';
        const muestraPrev = packingMuestraAnterior || elMuestra?.value || '';
        if (muestraPrev && fechaPrev) {
            snapshotMuestraPackingSiHayTrabajo(fechaPrev, muestraPrev);
        }
        packingMuestraAnterior = '';
        packingFechaAnterior = elFecha?.value || '';
        limpiarCacheQuotaServidorPacking_();
        const fecha = elFecha?.value || '';
        if (fecha) void cargarMuestrasPorFecha(fecha);
        else resetMuestraSelect('Seleccionar fecha', true);
    }

    elFecha?.addEventListener('focus', () => {
        packingFechaAnterior = elFecha?.value || '';
    });
    elFecha?.addEventListener('change', onFechaCambiada);

    elFechaRingWidget?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePopoverFechaRingPacking();
    });
    elFechaRingWidget?.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        togglePopoverFechaRingPacking();
    });
    document.addEventListener('click', () => togglePopoverFechaRingPacking(false));

    elResumenToggle?.addEventListener('click', toggleChipsPanelCollapsed);

    elFabOptionsBtn?.addEventListener('click', () => {
        establecerMenuFlotantePacking(!elFabMenu?.classList.contains('is-open'));
    });
    document.getElementById('fab-packing-sync')?.addEventListener('click', () => {
        if (typeof window.actualizarAppCompletoDesdeFab === 'function') {
            void window.actualizarAppCompletoDesdeFab();
        } else {
            void sincronizarConPlanillaPacking();
        }
    });
    document.getElementById('fab-packing-borrar')?.addEventListener('click', () => void borrarTodoYCachePacking());
    elFabAgregar?.addEventListener('click', onFabAgregarPackingClick);
    elBtnEnviarPacking?.addEventListener('click', () => void guardarRegistroYEnviarDesdePantallaPacking());
    document.getElementById('fab-packing-demo')?.addEventListener('click', () => { void fabIniciarRegistroPacking(); });
    document.addEventListener('click', (e) => {
        if (elFabMenu && !elFabMenu.contains(e.target)) establecerMenuFlotantePacking(false);
    });

    elCardsWrap?.addEventListener('click', (ev) => {
        if (elCardsWrap.classList.contains('is-disabled')) return;
        const delBtn = ev.target.closest('.packing-card-delete');
        if (delBtn && !delBtn.disabled) {
            ev.stopPropagation();
            const id = Number(delBtn.dataset.cardId);
            if (Number.isFinite(id)) void eliminarCardPacking(id);
            return;
        }
        const recepBtn = ev.target.closest('.packing-peso-recep-btn');
        if (recepBtn) {
            ev.stopPropagation();
            const id = Number(recepBtn.dataset.cardId);
            abrirModalPesosPacking(id);
            return;
        }
        const obsBtn = ev.target.closest('.packing-observation-btn');
        if (obsBtn && !obsBtn.disabled) {
            ev.stopPropagation();
            abrirModalObservacionPacking(ev, Number(obsBtn.dataset.cardId));
            return;
        }
        if (ev.target.closest('.metric-actions, .metric-btn, .observation-box')) return;
        const cardEl = ev.target.closest('.packing-clamshell-card');
        if (!cardEl) return;
        const id = Number(cardEl.dataset.cardId);
        abrirModalPesosPacking(id);
    });

    elCardsWrap?.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        const cardEl = ev.target.closest('.packing-clamshell-card');
        if (!cardEl || elCardsWrap?.classList.contains('is-disabled')) return;
        ev.preventDefault();
        abrirModalPesosPacking(Number(cardEl.dataset.cardId));
    });

    const elPesosCancel = document.getElementById('packing-pesos-cancel');
    elPesosCancel?.addEventListener('click', cerrarModalPesosPacking);
    elPesosGuardar?.addEventListener('click', guardarModalPesosPacking);
    bindCerrarModalAlClickFueraPacking(elPesosModal, cerrarModalPesosPacking);

    elCardsWrap?.addEventListener('click', (ev) => {
        const tiempoBtn = ev.target.closest('.packing-metric-tiempo-open-btn');
        if (tiempoBtn) {
            const cardEl = tiempoBtn.closest('.packing-clamshell-card');
            const cardId = cardEl ? Number(cardEl.dataset.cardId) : NaN;
            const card = Number.isFinite(cardId) ? getCardPackingById(cardId) : packingCards[0];
            abrirTiemposMuestra(ev, {
                soloLectura: tiempoBtn.hasAttribute('data-tiempos-readonly'),
                clamshellNum: card?.clamshellNum
            });
            return;
        }
        const presionAmbBtn = ev.target.closest('.packing-metric-presion-amb-btn');
        if (presionAmbBtn) {
            const cardEl = presionAmbBtn.closest('.packing-clamshell-card');
            const cardId = cardEl ? Number(cardEl.dataset.cardId) : NaN;
            const card = Number.isFinite(cardId) ? getCardPackingById(cardId) : packingCards[0];
            abrirModalPresionPacking(ev, 'ambiente', card?.clamshellNum);
            return;
        }
        const presionFrutaBtn = ev.target.closest('.packing-metric-presion-fruta-btn');
        if (presionFrutaBtn) {
            const cardEl = presionFrutaBtn.closest('.packing-clamshell-card');
            const cardId = cardEl ? Number(cardEl.dataset.cardId) : NaN;
            const card = Number.isFinite(cardId) ? getCardPackingById(cardId) : packingCards[0];
            abrirModalPresionPacking(ev, 'fruta', card?.clamshellNum);
        }
    });
    elTiemposCancel?.addEventListener('click', () => cerrarTiemposMuestra(true));
    elTiemposGuardar?.addEventListener('click', guardarTiemposMuestra);
    bindCerrarModalAlClickFueraPacking(elTiemposModal, () => cerrarTiemposMuestra(true));

    elPresionCancel?.addEventListener('click', cerrarModalPresionPacking);
    bindCerrarModalAlClickFueraPacking(elPresionModal, cerrarModalPresionPacking);

    elObsCancel?.addEventListener('click', cerrarModalObservacionPacking);
    elObsGuardar?.addEventListener('click', guardarModalObservacionPacking);
    bindCerrarModalAlClickFueraPacking(elObsModal, cerrarModalObservacionPacking);

    elBtnViajePacking?.addEventListener('click', abrirModalViajePacking);
    elViajeCancelPacking?.addEventListener('click', cerrarModalViajePacking);
    elViajeGuardarPacking?.addEventListener('click', guardarModalViajePacking);
    bindCerrarModalAlClickFueraPacking(elViajeModalPacking, cerrarModalViajePacking);
    elViajeInputPacking?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            guardarModalViajePacking();
        }
    });

    elBtnTempPacking?.addEventListener('click', () => abrirModalControlGlobalPacking('temperatura'));
    elBtnHumPacking?.addEventListener('click', () => abrirModalControlGlobalPacking('humedad'));
    elControlCancelPacking?.addEventListener('click', cerrarModalControlGlobalPacking);
    elControlGuardarPacking?.addEventListener('click', guardarModalControlGlobalPacking);
    bindCerrarModalAlClickFueraPacking(elControlModalPacking, cerrarModalControlGlobalPacking);

    PACKING_PESO_CAMPOS.forEach((c) => {
        const inp = document.getElementById(c.inpId);
        inp?.addEventListener('input', validarPesosModalEnVivo);
        inp?.addEventListener('change', validarPesosModalEnVivo);
    });

    TIEMPOS_MUESTRA_IDS.forEach((id) => {
        const inp = document.getElementById(id);
        const onTiempoInput = () => {
            actualizarContadoresTiempo();
            validarTiemposModalEnVivo();
        };
        inp?.addEventListener('change', onTiempoInput);
        inp?.addEventListener('input', onTiempoInput);
    });

    elHoraInicio?.addEventListener('change', () => {
        if (elTiemposModal?.style.display === 'flex' && !tiemposModalSoloLectura) {
            validarTiemposModalEnVivo();
        }
        programarGuardadoBorradorPacking();
    });
    elHoraInicio?.addEventListener('input', programarGuardadoBorradorPacking);
    elResponsable?.addEventListener('change', programarGuardadoBorradorPacking);
    elResponsable?.addEventListener('input', programarGuardadoBorradorPacking);

    elViajeInputPacking?.addEventListener('input', () => {
        if (!elViajeInputPacking) return;
        const v = normalizarNViajePackingInput_(elViajeInputPacking.value);
        if (elViajeInputPacking.value !== v) elViajeInputPacking.value = v;
    });

    elMuestra?.addEventListener('focus', () => {
        packingMuestraAnterior = elMuestra?.value || '';
    });

    elMuestra?.addEventListener('change', () => {
        if (window.Swal && typeof window.Swal.close === 'function') {
            window.Swal.close();
        }
        packingBadgeWasComplete = false;
        const fecha = elFecha?.value || '';
        const raw = elMuestra?.value || '';
        const prev = packingMuestraAnterior;
        const estadoPrev = (!packingRestaurandoBorrador && prev && prev !== raw)
            ? capturarEstadoMuestraPacking()
            : null;

        cancelarGuardadoBorradorProgramadoPacking_();

        if (estadoPrev) {
            snapshotMuestraPackingSiHayTrabajo(fecha, prev, estadoPrev);
        }
        packingMuestraAnterior = raw;
        if (!raw) {
            limpiarPreview();
            return;
        }
        const parts = String(raw).split('|');
        const ensayoNumero = parts.length >= 2 ? parts[1] : '';
        if (!ensayoNumero) {
            limpiarPreview();
            return;
        }
        prepararUiNuevaMuestraPacking_();
        const store = leerStoreBorradorPacking();
        store.activa = claveBorradorMuestraPacking(fecha, raw);
        escribirStoreBorradorPacking(store);
        void cargarDetalle(fecha, ensayoNumero);
    });

    window.addEventListener('beforeunload', () => {
        guardarBorradorMuestraActiva();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            guardarBorradorMuestraActiva();
            return;
        }
        if (!puedeRefrescarFechaPacking_()) return;
        if (aplicarFechaHoyPacking_({ forzar: true }) && elFecha?.value) {
            void cargarMuestrasPorFecha(elFecha.value);
        }
    });

    function fechaDisplayDdMmYyyyPacking(iso) {
        const p = String(iso || hoyIsoLocal()).split('-');
        if (p.length !== 3) return String(iso || '');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }

    function formatoHoraPdfPacking(hora) {
        const s = String(hora || '').trim();
        if (!s || !s.includes(':')) return s;
        const [h, m] = s.split(':');
        const hh = Number(h);
        if (Number.isNaN(hh)) return s;
        return `${hh}:${String(m || '00').padStart(2, '0')}`;
    }

    function valorPesoPdfPacking(v) {
        const n = pesoNumero(v);
        return n > 0 ? String(n) : '';
    }

    function calcDeficitPresionPdfPacking(amb, fruta) {
        const a = parseFloat(String(amb || '').replace(',', '.'));
        const f = parseFloat(String(fruta || '').replace(',', '.'));
        if (!Number.isFinite(a) || !Number.isFinite(f)) return '';
        return (f - a).toFixed(3);
    }

    function filaPdfVaciaPacking() {
        return {
            horaInicio: '', rotulo: '', etapa: '', campo: '', turno: '',
            variedad: '', placa: '', guia: '', viaje: '',
            tRecep: '', tIngGas: '', tSalGas: '', tIngPre: '', tSalPre: '',
            pRecep: '', pIngGas: '', pSalGas: '', pIngPre: '', pSalPre: '',
            tempAmb0: '', tempPulpa0: '', tempAmb1: '', tempPulpa1: '',
            tempAmb2: '', tempPulpa2: '', tempAmb3: '', tempPulpa3: '',
            tempAmb4: '', tempPulpa4: '',
            hRecep: '', hIngGas: '', hSalGas: '', hIngPre: '', hSalPre: ''
        };
    }

    function filaPdfDesdeCardPacking(card, metaBase, tiemposFmt, controlGlobal, incluirGlobal) {
        if (!incluirGlobal) {
            const p = card?.pesos || pesosVaciosPacking();
            return {
                ...filaPdfVaciaPacking(),
                pRecep: valorPesoPdfPacking(p.recepcion),
                pIngGas: valorPesoPdfPacking(p.ingresoGas),
                pSalGas: valorPesoPdfPacking(p.salidaGas),
                pIngPre: valorPesoPdfPacking(p.ingresoPre),
                pSalPre: valorPesoPdfPacking(p.salidaPre)
            };
        }
        const p = card?.pesos || pesosVaciosPacking();
        const t = controlGlobal?.temperatura || packingControlState.temperatura;
        const h = controlGlobal?.humedad || packingControlState.humedad;
        const fila = {
            ...metaBase,
            tRecep: tiemposFmt[0] || '',
            tIngGas: tiemposFmt[1] || '',
            tSalGas: tiemposFmt[2] || '',
            tIngPre: tiemposFmt[3] || '',
            tSalPre: tiemposFmt[4] || '',
            pRecep: valorPesoPdfPacking(p.recepcion),
            pIngGas: valorPesoPdfPacking(p.ingresoGas),
            pSalGas: valorPesoPdfPacking(p.salidaGas),
            pIngPre: valorPesoPdfPacking(p.ingresoPre),
            pSalPre: valorPesoPdfPacking(p.salidaPre),
            hRecep: String(h[0] || '').trim(),
            hIngGas: String(h[1] || '').trim(),
            hSalGas: String(h[2] || '').trim(),
            hIngPre: String(h[3] || '').trim(),
            hSalPre: String(h[4] || '').trim()
        };
        for (let i = 0; i < 5; i++) {
            fila[`tempAmb${i}`] = String(t.amb[i] || '').trim();
            fila[`tempPulpa${i}`] = String(t.pulpa[i] || '').trim();
        }
        return fila;
    }

    function rotuloMuestraPdfPacking_(ensayoNumero, ensayoNombre) {
        const numEnsayo = Number(String(ensayoNumero ?? '').trim());
        if (Number.isFinite(numEnsayo) && numEnsayo > 0) {
            return 'Ensayo ' + numEnsayo;
        }
        const nombre = String(ensayoNombre || '').trim();
        if (nombre && !/^\d+$/.test(nombre)) return nombre;
        const n = String(ensayoNumero || nombre || '').trim();
        if (!n) return '';
        if (/^(Ensayo|Muestra)\s/i.test(n)) return n;
        const num = Number(n);
        if (Number.isFinite(num) && num === Math.floor(num) && num > 0) {
            return 'Ensayo ' + num;
        }
        return 'Ensayo ' + n;
    }

    function ordenarMuestrasPdfPackingPorEnsayo_(muestras) {
        return (muestras || []).slice().sort((a, b) => {
            const na = Number(a?.ensayo) || 0;
            const nb = Number(b?.ensayo) || 0;
            return na - nb;
        });
    }

    function deduplicarMuestrasPdfPackingPorEnsayo_(muestras) {
        const seen = new Set();
        const out = [];
        ordenarMuestrasPdfPackingPorEnsayo_(muestras).forEach((m) => {
            const key = String(m?.ensayo || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(m);
        });
        return out;
    }

    function metaTrazDesdeDetallePdfPacking_(detalle, previewMeta, nViajeEstado) {
        const d = detalle && typeof detalle === 'object' ? detalle : {};
        const meta = previewMeta && typeof previewMeta === 'object' ? previewMeta : {};
        const viaje = viajePdfDesdeFuentesPacking_(nViajeEstado, meta, d);
        if (d.TRAZ_ETAPA != null || d.TRAZ_CAMPO != null || d.TRAZ_TURNO != null || d.TRAZ_LIBRE != null) {
            const etapa = String(d.TRAZ_ETAPA ?? '').trim();
            const campo = String(d.TRAZ_CAMPO ?? '').trim();
            const turno = String(d.TRAZ_TURNO ?? d.TRAZ_LIBRE ?? '').trim();
            return {
                etapa,
                campo,
                turno,
                traz: [etapa, campo, turno].filter(Boolean).join('-'),
                variedad: String(d.VARIEDAD ?? meta.variedad ?? '').trim(),
                placa: String(d.PLACA_VEHICULO ?? meta.placa ?? '').trim().toUpperCase(),
                guia: textoMetaCampoPdfPacking_(d.GUIA_REMISION || meta.guia),
                viaje,
                rotulo: String(d.ENSAYO_NOMBRE ?? meta.rotulo ?? '').trim()
            };
        }
        const traz = String(meta.traz || '').trim();
        const partes = traz.split('-').filter(Boolean);
        return {
            etapa: partes[0] || '',
            campo: partes[1] || '',
            turno: partes.slice(2).join('-') || '',
            traz,
            variedad: String(meta.variedad || '').trim(),
            placa: String(meta.placa || '').trim().toUpperCase(),
            guia: textoMetaCampoPdfPacking_(meta.guia || d.GUIA_REMISION),
            viaje,
            rotulo: String(meta.rotulo || '').trim()
        };
    }

    function construirDatosPdfPackingDesdeEstado_(numMuestra, ensayoNumero, estado, detalle) {
        const trazMeta = metaTrazDesdeDetallePdfPacking_(detalle, estado?.previewMeta, estado?.nViaje);
        const tiempos = Array.isArray(estado?.tiempos) ? estado.tiempos : [];
        const tiemposFmt = tiempos.map(formatoHoraPdfPacking);
        const cards = (Array.isArray(estado?.packingCards) ? estado.packingCards : [])
            .slice()
            .sort((a, b) => Number(a.clamshellNum) - Number(b.clamshellNum));
        const controlSnap = recalcularPresionesDesdeControlPacking_(estado?.control || {});
        const metaBase = {
            horaInicio: formatoHoraPdfPacking(estado?.horaInicio || ''),
            rotulo: rotuloMuestraPdfPacking_(ensayoNumero, trazMeta.rotulo),
            etapa: trazMeta.etapa,
            campo: trazMeta.campo,
            turno: trazMeta.turno,
            variedad: trazMeta.variedad,
            placa: trazMeta.placa,
            guia: trazMeta.guia,
            viaje: trazMeta.viaje
        };
        const filas = [];
        for (let r = 0; r < PACKING_PDF_FILAS_POR_MUESTRA; r++) {
            filas.push(filaPdfDesdeCardPacking(cards[r] || null, metaBase, tiemposFmt, controlSnap, r === 0));
        }
        const pa = controlSnap.presionAmb.slice();
        const pf = controlSnap.presionFruta.slice();
        const deficit = pa.map((a, i) => calcDeficitPresionPdfPacking(a, pf[i]));
        const obsPartes = cards.map((c) => String(c?.observacion || '').trim()).filter(Boolean);
        const observacionesLista = Array.from({ length: PACKING_PDF_FILAS_POR_MUESTRA }, (_, i) => (
            String(cards[i]?.observacion || '').trim()
        ));
        const fechaPdf = fechaDisplayDdMmYyyyPacking(getFechaInspeccionPacking());
        const responsable = String(
            estado?.responsable
            || estado?.previewMeta?.responsable
            || ''
        ).trim();
        return {
            ensayo: ensayoNumero,
            fecha: fechaPdf,
            empresa: 'AGROVISION',
            codigo: 'PE-F-OPH-309',
            version: '1',
            tituloHoja1: 'FORMATO MEDICIÓN DE TIEMPOS, TEMPERATURA Y PESOS EN RECEPCIÓN - ARÁNDANO - C5-C6-A9-LN',
            tituloHoja2: 'FORMATO MEDICIÓN DE TIEMPOS, TEMPERATURA Y PESOS EN RECEPCIÓN - ARÁNDANO - CS-C6-A9-LN',
            meta: {
                fecha: fechaPdf,
                trazabilidad: trazMeta.traz,
                trazabilidadArchivo: trazMeta.traz,
                rotulo: metaBase.rotulo,
                responsable,
                numMuestra: String(numMuestra || '').trim()
            },
            filas,
            pagina2: {
                presionAmb: pa.map((v) => String(v || '').trim()),
                presionFruta: pf.map((v) => String(v || '').trim()),
                deficit,
                observaciones: obsPartes.join(' · '),
                observacionesLista
            }
        };
    }

    function asegurarFilasMuestraPdfPacking_(filas, n) {
        const out = (Array.isArray(filas) ? filas : []).slice(0, n);
        while (out.length < n) out.push(filaPdfVaciaPacking());
        return out;
    }

    function prepararHojaPdfSolaMuestraPacking_(item) {
        const filasA = asegurarFilasMuestraPdfPacking_(item.filas, PACKING_PDF_FILAS_POR_MUESTRA);
        const filas = [...filasA];
        while (filas.length < PACKING_PDF_FILAS) filas.push(filaPdfVaciaPacking());
        const obsLista = Array.from({ length: PACKING_PDF_FILAS }, (_, i) => (
            String(item.pagina2?.observacionesLista?.[i] || '').trim()
        ));
        return {
            ...item,
            filas: filas.slice(0, PACKING_PDF_FILAS),
            pdfInicioSegundaMuestra: null,
            pagina2: {
                ...item.pagina2,
                bloquesPresion: [{
                    fila: 0,
                    presionAmb: item.pagina2?.presionAmb || [],
                    presionFruta: item.pagina2?.presionFruta || [],
                    deficit: item.pagina2?.deficit || []
                }],
                observacionesLista: obsLista
            }
        };
    }

    function combinarDosMuestrasEnHojaPdfPacking_(a, b) {
        const filasA = asegurarFilasMuestraPdfPacking_(a.filas, PACKING_PDF_FILAS_POR_MUESTRA);
        const filasB = asegurarFilasMuestraPdfPacking_(b.filas, PACKING_PDF_FILAS_SEGUNDA_BLOQUE);
        const filas = [...filasA, ...filasB].slice(0, PACKING_PDF_FILAS);
        while (filas.length < PACKING_PDF_FILAS) filas.push(filaPdfVaciaPacking());
        const obsLista = [
            ...filasA.map((_, i) => String(a.pagina2?.observacionesLista?.[i] || '').trim()),
            ...filasB.map((_, i) => String(b.pagina2?.observacionesLista?.[i] || '').trim())
        ].slice(0, PACKING_PDF_FILAS);
        while (obsLista.length < PACKING_PDF_FILAS) obsLista.push('');
        const nums = [a.meta?.numMuestra, b.meta?.numMuestra].map((s) => String(s || '').trim()).filter(Boolean);
        return {
            ...a,
            meta: {
                ...a.meta,
                numMuestra: nums.join(' · '),
                trazabilidad: [a.meta?.trazabilidad, b.meta?.trazabilidad].filter(Boolean).join(' · ')
                    || a.meta?.trazabilidad,
                trazabilidadArchivo: [a.meta?.trazabilidadArchivo, b.meta?.trazabilidadArchivo]
                    .filter(Boolean).join(' · ') || a.meta?.trazabilidadArchivo
            },
            filas,
            pdfInicioSegundaMuestra: PACKING_PDF_INICIO_SEGUNDA_MUESTRA,
            pagina2: {
                bloquesPresion: [
                    {
                        fila: 0,
                        presionAmb: a.pagina2?.presionAmb || [],
                        presionFruta: a.pagina2?.presionFruta || [],
                        deficit: a.pagina2?.deficit || []
                    },
                    {
                        fila: PACKING_PDF_INICIO_SEGUNDA_MUESTRA,
                        presionAmb: b.pagina2?.presionAmb || [],
                        presionFruta: b.pagina2?.presionFruta || [],
                        deficit: b.pagina2?.deficit || []
                    }
                ],
                observacionesLista: obsLista,
                observaciones: obsLista.filter(Boolean).join(' · ')
            }
        };
    }

    function agruparMuestrasEnHojasPdfPacking_(muestras) {
        const hojas = [];
        for (let i = 0; i < muestras.length; i += 2) {
            const a = muestras[i];
            const b = muestras[i + 1] || null;
            hojas.push(b ? combinarDosMuestrasEnHojaPdfPacking_(a, b) : prepararHojaPdfSolaMuestraPacking_(a));
        }
        return hojas;
    }

    /** Sin red: asegura meta Campo en caché local (muestra activa + borradores). */
    function asegurarDetalleMetaLocalParaPdf_() {
        const rawActivo = String(elMuestra?.value || '').trim();
        if (rawActivo && !muestraPackingYaCompletaEnServidor_(rawActivo)) {
            guardarBorradorMuestraActivaInmediato_();
        }
        const fecha = normalizarFechaIso(elFecha?.value);
        if (rawActivo && lastDetallePacking) {
            registrarDetalleMetaPacking_(fecha, rawActivo, lastDetallePacking);
        }
    }

    window.obtenerDatosPdfPackingParaCapturas = function obtenerDatosPdfPackingParaCapturas(capturas) {
        const lista = (Array.isArray(capturas) ? capturas : []).filter((c) => c && c.estado);
        const muestras = [];
        lista.forEach((c) => {
            if (!hayPesoBrutoMuestraPacking(c.estado)) {
                throw new Error(mensajeSinPesoBrutoPdfPacking_(
                    textoSelectMuestra(c.num_muestra, c.ensayo_numero)
                ));
            }
            const detalle = leerDetalleMetaPacking_(c.raw || ((c.num_muestra && c.ensayo_numero)
                ? (c.num_muestra + '|' + c.ensayo_numero)
                : ''));
            muestras.push(construirDatosPdfPackingDesdeEstado_(
                c.num_muestra,
                c.ensayo_numero,
                c.estado,
                detalle
            ));
        });
        if (!muestras.length) {
            throw new Error(mensajeSinPesoBrutoPdfPacking_());
        }
        const muestrasUnicas = deduplicarMuestrasPdfPackingPorEnsayo_(muestras);
        return {
            muestras: agruparMuestrasEnHojasPdfPacking_(muestrasUnicas),
            muestrasTitulo: muestrasUnicas.slice()
        };
    };

    window.obtenerDatosPdfPacking = function obtenerDatosPdfPacking() {
        asegurarDetalleMetaLocalParaPdf_();
        const rawActivo = String(elMuestra?.value || '').trim();
        const activoYaEnPlanilla = rawActivo && muestraPackingYaCompletaEnServidor_(rawActivo);
        const items = deduplicarItemsMuestraPacking_(
            ordenarMuestrasPackingPorEnsayo_(
                muestrasPendientesPdfPackingDelDia_().map((raw) => {
                    const parts = String(raw || '').split('|');
                    return {
                        raw,
                        num_muestra: parts[0] || '',
                        ensayo_numero: parts[1] || ''
                    };
                }).filter((item) => item.num_muestra && item.ensayo_numero)
            )
        );
        if (rawActivo && !activoYaEnPlanilla && !items.some((item) => item.raw === rawActivo)) {
            const parts = rawActivo.split('|');
            items.push({
                raw: rawActivo,
                num_muestra: parts[0] || '',
                ensayo_numero: parts[1] || ''
            });
        }
        if (!items.length) {
            if (activoYaEnPlanilla) {
                throw new Error(
                    'La muestra seleccionada ya está en la planilla. '
                    + 'Su PDF se guardó al enviar; ábrelo desde Historial. '
                    + 'Selecciona la siguiente muestra y captura datos para un PDF nuevo.'
                );
            }
            throw new Error('Selecciona una muestra y captura datos antes de generar el PDF.');
        }
        const muestras = [];
        let activoSinPeso = false;
        let activoSinDatos = false;
        items.forEach((item) => {
            const esActivo = item.raw === rawActivo;
            const cap = capturaEstadoMuestraParaEnvio_(item.raw);
            if (!cap || !hayDatosTrabajoMuestraPacking(cap.estado)) {
                if (esActivo) activoSinDatos = true;
                return;
            }
            if (!hayPesoBrutoMuestraPacking(cap.estado)) {
                if (esActivo) activoSinPeso = true;
                return;
            }
            const detalle = leerDetalleMetaPacking_(item.raw);
            muestras.push(construirDatosPdfPackingDesdeEstado_(
                item.num_muestra,
                item.ensayo_numero,
                cap.estado,
                detalle
            ));
        });
        if (!muestras.length) {
            if (activoSinPeso && rawActivo) {
                const parts = rawActivo.split('|');
                throw new Error(mensajeSinPesoBrutoPdfPacking_(
                    textoSelectMuestra(parts[0] || '', parts[1] || '')
                ));
            }
            if (activoSinDatos && rawActivo) {
                const parts = rawActivo.split('|');
                throw new Error(
                    'Sin datos de packing en '
                    + textoSelectMuestra(parts[0] || '', parts[1] || '')
                    + '.'
                );
            }
            throw new Error(mensajeSinPesoBrutoPdfPacking_());
        }
        const muestrasUnicas = deduplicarMuestrasPdfPackingPorEnsayo_(muestras);
        return {
            muestras: agruparMuestrasEnHojasPdfPacking_(muestrasUnicas),
            muestrasTitulo: muestrasUnicas.slice()
        };
    };

    window.PackingContext = {
        getHoraPersonal,
        getResponsable: getHoraPersonal,
        getTiemposMuestra,
        getControlGlobalPacking: () => ({
            temperatura: {
                amb: packingControlState.temperatura.amb.slice(),
                pulpa: packingControlState.temperatura.pulpa.slice()
            },
            humedad: packingControlState.humedad.slice(),
            presionAmb: packingControlState.presionAmb.slice(),
            presionFruta: packingControlState.presionFruta.slice()
        }),
        getMetaEnvio: getMetaEnvioPacking,
        getPesosPacking: () => packingCards.map((c) => ({ clamshellNum: c.clamshellNum, ...c.pesos })),
        getRestantesAgregar: restantesPorAgregarPacking
    };

    window.addEventListener('online', () => {
        actualizarHeaderConexion();
        void sincronizarPendientesPacking().then(() => acotarFechaDesdePlanilla().then(onFechaCambiada));
    });
    window.addEventListener('offline', actualizarHeaderConexion);
    window.addEventListener('resize', syncPackingFoldBtnAnchor, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
        const foldBtnResizeObs = new ResizeObserver(() => syncPackingFoldBtnAnchor());
        if (elSelectBlock) foldBtnResizeObs.observe(elSelectBlock);
        const clip = elMetaShell?.querySelector('.packing-meta-clip');
        if (clip) foldBtnResizeObs.observe(clip);
    }

    window.sincronizarConPlanillaPacking = sincronizarConPlanillaPacking;
    window.sincronizarPendientesPacking = sincronizarPendientesPacking;
    window.borrarTodoYCachePacking = borrarTodoYCachePacking;
    window.fabIniciarRegistroPacking = fabIniciarRegistroPacking;
    window.agregarCardPacking = agregarCardPacking;
    window.agregarCardPackingYAbrirPesos = agregarCardPackingYAbrirPesos;
    window.guardarRegistroYEnviarDesdePantallaPacking = guardarRegistroYEnviarDesdePantallaPacking;

    crearIconosPacking();
    actualizarBtnEnviarPacking();
    actualizarContadoresTiempo();
    actualizarContadoresPresionPacking();
    actualizarFechaRingPacking();
    setInterval(actualizarFechaRingPacking, 60000);
    setPackingCardHabilitada(false);

    if (window.CustomTimePicker) {
        window.CustomTimePicker.init(document.getElementById('packing-main') || document);
    }

    asegurarHoraInicioAlEnfocarPacking_();
    purgarBorradoresFantasmaPacking_();
    actualizarHeaderConexion();
    actualizarHeaderPendientes();
    initFechaInput();
    setChipsPanelCollapsed(false, false);
    limpiarPreview();
    syncPackingFoldBtnAnchor();

    void acotarFechaDesdePlanilla().then(() => {
        if (elFecha?.value) void cargarMuestrasPorFecha(elFecha.value);
    });

    window.addEventListener('pageshow', () => {
        if (!puedeRefrescarFechaPacking_()) return;
        if (aplicarFechaHoyPacking_({ forzar: true }) && elFecha?.value) {
            void cargarMuestrasPorFecha(elFecha.value);
        }
    });

    if (!navigator.onLine) {
        const fechaOff = normalizarFechaIso(elFecha?.value);
        const listaOff = fechaOff ? muestrasOfflineDesdeBorradorPacking(fechaOff) : [];
        if (listaOff.length) {
            poblarSelectMuestra(listaOff);
            restaurarMuestraActivaDesdeBorrador();
            setStatus('Sin internet: trabajando con borrador local.', 'warn');
        } else {
            setStatus('Sin internet. Puedes seguir si ya guardaste un borrador de muestra.', 'warn');
        }
    } else {
        void sincronizarPendientesPacking();
    }
}());
