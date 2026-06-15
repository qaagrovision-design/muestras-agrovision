/**
 * Google Apps Script - MTTP Arándano
 * Recibe datos del formulario y los escribe en la hoja activa.
 * Hoja 1 (Visual): 50 cols registro (5 pesos + 6 tiempos) + packing desde col 51.
 * Hoja 3 (Acopio): misma estructura; encabezados de peso/tiempo acopio. Hoja 2 / Hoja 4 = jarras.
 * NUM_MUESTRA: secuencia global única (max Hoja 1 + Hoja 3 + watermark).
 *
 * ANTI-DUPLICADOS: UID + clave de fila normalizada.
 *
 * --- PACKING (cols 51–91) ---
 */
var PACKING_START_COL = 51;
var PACKING_META_COLS = 4;
var PACKING_DATA_COLS = 37;
var PACKING_COLS = PACKING_META_COLS + PACKING_DATA_COLS;
var THERMOKING_START_COL = PACKING_START_COL + PACKING_COLS; // 92
var THERMOKING_COLS = 39;
var C5_START_COL = THERMOKING_START_COL + THERMOKING_COLS; // 131

/** 50 columnas registro: 5 pesos + 6 tiempos; debe coincidir con app.js construirFilaBaseRegistro. */
var NUM_COLS_REGISTRO = 50;
/** POST expandido: 21 cols Hoja1 + 6 Hoja2 + 29 cierre = 56 celdas. */
var REGISTRO_PRE_JARRA_COLS = 21;
var REGISTRO_POST_EXPANDED_LEN = 56;
/** Índice 0-based: PESO_5 / DESPACHO_ACOPIO (esquema 50 columnas). */
var IDX_COL_PESO_DESPACHO = 20;

/** Máximo NUM_MUESTRA “consumido” en el tiempo; solo sube (borrar filas en hoja no retrocede la secuencia). */
var NUM_MUESTRA_WATERMARK_KEY = 'mtpp_num_muestra_watermark_v1';

/** Visual: Hoja 1 (índice 0) + Hoja 2 (1). Acopio: Hoja 3 (2) + Hoja 4 (3). */
var SHEET_IDX_VISUAL_REGISTRO = 0;
var SHEET_IDX_VISUAL_JARRAS = 1;
var SHEET_IDX_ACOPIO_REGISTRO = 2;
var SHEET_IDX_ACOPIO_JARRAS = 3;

function getRegistroHeadersHoja1_() {
  return [
    "FECHA", "ENSAYO_NOMBRE", "NUM_MUESTRA", "RESPONSABLE", "DIAS_PRECOSECHA", "HORA_INICIO_GENERAL", "FUNDO",
    "TRAZ_ETAPA", "TRAZ_CAMPO", "TRAZ_LIBRE", "VARIEDAD", "GUIA_REMISION", "PLACA_VEHICULO",     "ENSAYO_NUMERO", "N_CLAMSHELL", "N_JARRA",
    "PESO_1", "PESO_2", "LLEGADA_ACOPIO", "PESO_RESERVA", "DESPACHO_ACOPIO",
    "TEMP_MUE_INICIO_AMB", "TEMP_MUE_INICIO_PUL", "TEMP_MUE_TERMINO_AMB", "TEMP_MUE_TERMINO_PUL",
    "TEMP_MUE_LLEGADA_AMB", "TEMP_MUE_LLEGADA_PUL", "TEMP_MUE_DESPACHO_AMB", "TEMP_MUE_DESPACHO_PUL",
    "TIEMPO_INICIO_COSECHA", "TIEMPO_PERDIDA_PESO", "TIEMPO_TERMINO_COSECHA", "TIEMPO_LLEGADA_ACOPIO", "TIEMPO_DESPACHO_ACOPIO", "TIEMPO_RESERVA",
    "HUMEDAD_INICIO", "HUMEDAD_TERMINO", "HUMEDAD_LLEGADA", "HUMEDAD_DESPACHO",
    "PRESION_AMB_INICIO", "PRESION_AMB_TERMINO", "PRESION_AMB_LLEGADA", "PRESION_AMB_DESPACHO",
    "PRESION_FRUTA_INICIO", "PRESION_FRUTA_TERMINO", "PRESION_FRUTA_LLEGADA", "PRESION_FRUTA_DESPACHO",
    "OBSERVACION", "OBSERVACION_FORMATO", "HORA_REGISTRO"
  ];
}

/**
 * Hoja 3 (Acopio): 50 columnas — 5 pesos + 6 tiempos (modal Acopio / PDF PE-F-QPH-305).
 */
function getRegistroHeadersHoja3Acopio_() {
  return [
    "FECHA", "ENSAYO_NOMBRE", "NUM_MUESTRA", "RESPONSABLE", "DIAS_PRECOSECHA", "HORA_INICIO_GENERAL", "FUNDO",
    "TRAZ_ETAPA", "TRAZ_CAMPO", "TRAZ_LIBRE", "VARIEDAD", "GUIA_REMISION_ACOPIO_CAMPO", "PLACA_VEHICULO",
    "ENSAYO_NUMERO", "N_CLAMSHELL", "N_JARRA",
    "PESO_1_TERMINO_COSECHA", "PESO_2_LLEGADA_ACOPIO", "PESO_3_ACOPIO_CALIBRADO", "PESO_4_CLAMSHELL_CALIBRADO", "PESO_5_DESPACHO_CAMPO",
    "TEMP_MUE_INICIO_AMB", "TEMP_MUE_INICIO_PUL", "TEMP_MUE_TERMINO_AMB", "TEMP_MUE_TERMINO_PUL",
    "TEMP_MUE_LLEGADA_AMB", "TEMP_MUE_LLEGADA_PUL", "TEMP_MUE_DESPACHO_AMB", "TEMP_MUE_DESPACHO_PUL",
    "TIEMPO_INICIO_COSECHA", "TIEMPO_TERMINO_COSECHA", "TIEMPO_LLEGADA_ACOPIO_CAMPO",
    "TIEMPO_ACOPIO_CALIBRADO", "TIEMPO_TERMINO_CALIBRADO", "TIEMPO_DESPACHO_ACOPIO_CAMPO",
    "HUMEDAD_INICIO", "HUMEDAD_TERMINO", "HUMEDAD_LLEGADA", "HUMEDAD_DESPACHO",
    "PRESION_AMB_INICIO", "PRESION_AMB_TERMINO", "PRESION_AMB_LLEGADA", "PRESION_AMB_DESPACHO",
    "PRESION_FRUTA_INICIO", "PRESION_FRUTA_TERMINO", "PRESION_FRUTA_LLEGADA", "PRESION_FRUTA_DESPACHO",
    "OBSERVACION", "OBSERVACION_FORMATO", "HORA_REGISTRO"
  ];
}

/** Hoja 2 (Visual) y Hoja 4 (Acopio): tiempos de llenado de jarras — mismos encabezados. */
function getRegistroHeadersHojaJarras_() {
  return [
    "FECHA", "ENSAYO_NUMERO", "N_JARRA",
    "INICIO_C", "TERMINO_C", "MIN_C",
    "INICIO_T", "TERMINO_T", "MIN_T"
  ];
}

function esModoRegistroAcopioPost_(data) {
  if (!data) return false;
  var m = String(data.modo_registro || data.modoRegistro || '').trim().toLowerCase();
  return m === 'acopio';
}

function indiceHojaRegistroPrincipal_(esAcopio) {
  return esAcopio ? SHEET_IDX_ACOPIO_REGISTRO : SHEET_IDX_VISUAL_REGISTRO;
}

function indiceHojaRegistroJarras_(esAcopio) {
  return esAcopio ? SHEET_IDX_ACOPIO_JARRAS : SHEET_IDX_VISUAL_JARRAS;
}

function obtenerHojaPorIndice_(ss, idx) {
  var sheets = ss.getSheets();
  while (sheets.length <= idx) {
    ss.insertSheet('Hoja ' + (sheets.length + 1));
    sheets = ss.getSheets();
  }
  var sh = sheets[idx];
  var nombreEsperado = '';
  if (idx === SHEET_IDX_ACOPIO_REGISTRO) nombreEsperado = 'Hoja 3';
  else if (idx === SHEET_IDX_ACOPIO_JARRAS) nombreEsperado = 'Hoja 4';
  if (nombreEsperado && sh.getName() !== nombreEsperado) {
    try {
      sh.setName(nombreEsperado);
    } catch (eName) { /* nombre ya usado u otro conflicto */ }
  }
  return sh;
}

/** Hojas con columna NUM_MUESTRA (Visual H1 + Acopio H3). */
function hojasRegistroNumMuestra_(ss) {
  var sheets = ss.getSheets();
  var out = [];
  if (sheets.length > SHEET_IDX_VISUAL_REGISTRO) out.push(sheets[SHEET_IDX_VISUAL_REGISTRO]);
  if (sheets.length > SHEET_IDX_ACOPIO_REGISTRO) out.push(sheets[SHEET_IDX_ACOPIO_REGISTRO]);
  return out;
}

function maxNumMuestraGlobalEnRegistro_(ss) {
  var hojas = hojasRegistroNumMuestra_(ss);
  var maxN = 0;
  for (var i = 0; i < hojas.length; i++) {
    var n = maxNumMuestraEnHoja_(hojas[i]);
    if (n > maxN) maxN = n;
  }
  return maxN;
}

function ultimoNumMuestraCeldaGlobal_(ss) {
  var hojas = hojasRegistroNumMuestra_(ss);
  var best = { valorTexto: '', fila: 0, digitos: 0 };
  for (var i = 0; i < hojas.length; i++) {
    var u = ultimoNumMuestraCeldaHoja_(hojas[i]);
    if (u.digitos > best.digitos) best = u;
  }
  return best;
}

/**
 * Próximo NUM_MUESTRA global (Hoja 1 + Hoja 3 + watermark al guardar).
 * @param {boolean} soloDesdeHoja Si true: solo datos en hojas (consultas app). Si false: incluye watermark.
 */
function resolverProximoNumMuestraJsonGlobal_(ss, soloDesdeHoja) {
  var ultimoCelda = ultimoNumMuestraCeldaGlobal_(ss);
  var sheetMax = maxNumMuestraGlobalEnRegistro_(ss);
  var baseUltimo = ultimoCelda.digitos > 0 ? ultimoCelda.digitos : sheetMax;
  var prefijo = resolverPrefijoNumMuestraGs_(ultimoCelda, sheetMax, baseUltimo);
  if (soloDesdeHoja) {
    var nextSolo = baseUltimo + 1;
    return {
      max_en_hoja: baseUltimo,
      ultimo_num_muestra_celda: ultimoCelda.valorTexto,
      ultimo_num_muestra_fila: ultimoCelda.fila,
      ultimo_num_muestra_en_hoja: baseUltimo,
      max_digitos_columna: sheetMax,
      num_muestra_prefijo: prefijo,
      proximo_num_muestra: formatearNumMuestraDesdeSecuenciaGs_(nextSolo, prefijo)
    };
  }
  var wm = leerWatermarkNumMuestra_();
  var M = Math.max(sheetMax, wm);
  fusionarWatermarkNumMuestra_(M);
  var nextN = M + 1;
  return {
    max_en_hoja: M,
    num_muestra_prefijo: prefijo,
    proximo_num_muestra: formatearNumMuestraDesdeSecuenciaGs_(nextN, prefijo)
  };
}

function buscarDuplicadoNumMuestraGlobal_(ss, numMuestraNorm) {
  var hojas = hojasRegistroNumMuestra_(ss);
  for (var i = 0; i < hojas.length; i++) {
    var dup = buscarDuplicadoNumMuestraEnHoja_(hojas[i], numMuestraNorm);
    if (dup) return dup;
  }
  return null;
}

function ensayosRegistradosEnFechaGlobal_(ss, fechaNorm) {
  var ensSet = {};
  var hojas = hojasRegistroNumMuestra_(ss);
  for (var hi = 0; hi < hojas.length; hi++) {
    var sh = hojas[hi];
    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    var dataOp = sh.getRange(2, 1, lastRow, 14).getValues();
    for (var oi = 0; oi < dataOp.length; oi++) {
      var fOp = formatFechaPacking(dataOp[oi][0]);
      if (fOp !== fechaNorm) continue;
      var enOp = dataOp[oi][13];
      var enOpStr = (enOp !== null && enOp !== undefined && enOp !== '')
        ? (Number(enOp) === Math.floor(Number(enOp)) ? String(Number(enOp)) : String(enOp).trim())
        : '';
      if (enOpStr) ensSet[enOpStr] = true;
    }
  }
  return Object.keys(ensSet).sort();
}

/** Inserta columna PESO_4 (col 20) y 6.º tiempo (col 35) si la hoja aún tiene esquema de 48 cols. */
function migrarRegistro48a50Cols_(sheet) {
  if (sheet.getLastRow() === 0) return;
  var col20 = String(sheet.getRange(1, 20).getValue() || "").trim().toUpperCase();
  if (col20 === "DESPACHO_ACOPIO" || col20 === "PESO_5_DESPACHO_CAMPO") {
    sheet.insertColumnsAfter(19, 1);
  }
  var col35 = String(sheet.getRange(1, 35).getValue() || "").trim().toUpperCase();
  if (col35 === "HUMEDAD_INICIO") {
    sheet.insertColumnsAfter(34, 1);
  }
}

function asegurarEncabezadoHoja3Acopio_(sheet) {
  migrarRegistro48a50Cols_(sheet);
  var h = getRegistroHeadersHoja3Acopio_();
  if (h.length !== NUM_COLS_REGISTRO) {
    throw new Error("getRegistroHeadersHoja3Acopio_: longitud distinta a NUM_COLS_REGISTRO");
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, h.length).setValues([h]);
    asegurarEncabezadosPackingEnHoja_(sheet);
    return;
  }
  var a1 = String(sheet.getRange(1, 1).getValue() || "").trim().toUpperCase();
  if (a1 !== "FECHA") {
    sheet.getRange(1, 1, 1, h.length).setValues([h]);
    asegurarEncabezadosPackingEnHoja_(sheet);
    return;
  }
  var p4 = String(sheet.getRange(1, 20).getValue() || "").trim().toUpperCase();
  var tCal = String(sheet.getRange(1, 34).getValue() || "").trim().toUpperCase();
  if (p4 === "PESO_4_CLAMSHELL_CALIBRADO" && tCal === "TIEMPO_TERMINO_CALIBRADO") {
    asegurarEncabezadosPackingEnHoja_(sheet);
    return;
  }
  sheet.getRange(1, 1, 1, h.length).setValues([h]);
  asegurarEncabezadosPackingEnHoja_(sheet);
}

function asegurarEncabezadoHojaJarras_(sheet2) {
  if (!sheet2) return;
  var h = getRegistroHeadersHojaJarras_();
  if (sheet2.getLastRow() === 0) {
    sheet2.getRange(1, 1, 1, h.length).setValues([h]);
    return;
  }
  var a1 = String(sheet2.getRange(1, 1).getValue() || "").trim().toUpperCase();
  var d4 = String(sheet2.getRange(1, 4).getValue() || "").trim().toUpperCase();
  if (a1 === "FECHA" && d4 === "INICIO_C") return;
  sheet2.getRange(1, 1, 1, h.length).setValues([h]);
}

/** Inserta AU–AV (OBSERVACION_FORMATO, HORA_REGISTRO) si la hoja aún tiene FECHA_INSPECCION en col 47. */
function migrarInsertarColsFormato_(sheet) {
  if (sheet.getLastRow() === 0) return;
  var colObs = NUM_COLS_REGISTRO - 2;
  var h47 = String(sheet.getRange(1, colObs + 1).getValue() || "").trim().toUpperCase();
  var h46 = String(sheet.getRange(1, colObs).getValue() || "").trim().toUpperCase();
  if (h46 === "OBSERVACION" && h47 === "FECHA_INSPECCION") {
    sheet.insertColumnsAfter(colObs, 2);
    sheet.getRange(1, colObs + 1).setValue("OBSERVACION_FORMATO");
    sheet.getRange(1, colObs + 2).setValue("HORA_REGISTRO");
  }
}

/**
 * Escribe o corrige la fila 1 de títulos. Si el libro aún tenía encabezados viejos (B=RESPONSABLE, L=OBSERVACION_FORMATO, etc.),
 * reemplaza la fila 1 para alinear con los datos que envía el front.
 */
function asegurarEncabezadoHoja1Registro_(sheet) {
  migrarRegistro48a50Cols_(sheet);
  var h = getRegistroHeadersHoja1_();
  if (h.length !== NUM_COLS_REGISTRO) {
    throw new Error("getRegistroHeadersHoja1_: longitud distinta a NUM_COLS_REGISTRO");
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, h.length).setValues([h]);
    return;
  }
  var a1 = String(sheet.getRange(1, 1).getValue() || "")
    .trim()
    .toUpperCase();
  if (a1 !== "FECHA") {
    return;
  }
  migrarInsertarColsFormato_(sheet);
  var b1 = String(sheet.getRange(1, 2).getValue() || "").trim();
  var l1 = String(sheet.getRange(1, 12).getValue() || "").trim();
  var colObs = NUM_COLS_REGISTRO - 2;
  var h46 = String(sheet.getRange(1, colObs).getValue() || "").trim().toUpperCase();
  var h47 = String(sheet.getRange(1, colObs + 1).getValue() || "").trim().toUpperCase();
  var h48 = String(sheet.getRange(1, colObs + 2).getValue() || "").trim().toUpperCase();
  var pReserva = String(sheet.getRange(1, 20).getValue() || "").trim().toUpperCase();
  // Esquema 50 cols: ENSAYO_NOMBRE + GUIA_REMISION + OBSERVACION_FORMATO / HORA_REGISTRO.
  if (b1 === "ENSAYO_NOMBRE" && l1 === "GUIA_REMISION" && h46 === "OBSERVACION" && h47 === "OBSERVACION_FORMATO" && h48 === "HORA_REGISTRO"
      && (pReserva === "PESO_RESERVA" || pReserva === "")) {
    return;
  }
  var viejoB = b1 === "RESPONSABLE" || b1 === "GUIA_REMISION";
  var viejoL = l1 === "OBSERVACION_FORMATO";
  if (viejoB || viejoL || b1 === "" || h47 !== "OBSERVACION_FORMATO") {
    sheet.getRange(1, 1, 1, h.length).setValues([h]);
  }
}

/** Thermo King: solo estas 2 columnas meta al inicio (no hay N_VIAJE en bloque TK; el viaje sigue en packing col N_VIAJE). Luego hora/placa y resto. */
function getThermokingFlatHeaders() {
  return [
    'FECHA_INSPECCION_THERMOKING',
    'RESPONSABLE_THERMOKING',
    'HORA_SALIDA_THERMOKING',
    'PLACA_THERMOKING',
    'THERMOKING_TIEMPO_INGRESO_CAMARA',
    'THERMOKING_TIEMPO_SALIDA_CAMARA',
    'THERMOKING_TIEMPO_INICIO_TRASLADO',
    'THERMOKING_TIEMPO_DESPACHO',
    'THERMOKING_PESO_INGRESO_CAMARA',
    'THERMOKING_PESO_SALIDA_TRASLADO',
    'THERMOKING_PESO_INICIO_TRASLADO',
    'THERMOKING_PESO_DESPACHO',
    'THERMOKING_TEMP_IC_CM',
    'THERMOKING_TEMP_IC_PULPA',
    'THERMOKING_TEMP_ST_CM',
    'THERMOKING_TEMP_ST_PULPA',
    'THERMOKING_TEMP_TRASLADO_AMB',
    'THERMOKING_TEMP_TRASLADO_VEHICULO',
    'THERMOKING_TEMP_TRASLADO_PULPA',
    'THERMOKING_TEMP_DESPACHO_AMB',
    'THERMOKING_TEMP_DESPACHO_VEHICULO',
    'THERMOKING_TEMP_DESPACHO_PULPA',
    'THERMOKING_HUM_INGRESO_CAMARA',
    'THERMOKING_HUM_SALIDA_TRASLADO',
    'THERMOKING_HUM_AMB_EXT_INICIO',
    'THERMOKING_HUM_INT_VEH_INICIO',
    'THERMOKING_HUM_AMB_EXT_DESPACHO',
    'THERMOKING_HUM_INT_VEH_DESPACHO',
    'THERMOKING_PRESION_INGRESO_CAMARA',
    'THERMOKING_PRESION_SALIDA_TRASLADO',
    'THERMOKING_PRESION_AMB_EXT_INICIO',
    'THERMOKING_PRESION_INT_VEH_INICIO',
    'THERMOKING_PRESION_AMB_EXT_DESPACHO',
    'THERMOKING_PRESION_INT_VEH_DESPACHO',
    'THERMOKING_VAPOR_INGRESO_CAMARA',
    'THERMOKING_VAPOR_SALIDA_CAMARA',
    'THERMOKING_VAPOR_INICIO_TRASLADO',
    'THERMOKING_VAPOR_SALIDA_TRASLADO',
    'THERMOKING_OBSERVACION'
  ];
}

/** Recepción C5: 2 meta + mismos 36 campos de datos que una fila packing (sin JSON). */
function getC5FlatHeaders() {
  return [
    'HORA_INICIO_RECEPCION_C5',
    'RESPONSABLE_C5',
    'C5_RECEPCION',
    'C5_INGRESO_GASIFICADO',
    'C5_SALIDA_GASIFICADO',
    'C5_INGRESO_PREFRIO',
    'C5_SALIDA_PREFRIO',
    'C5_PESO_RECEPCION',
    'C5_PESO_INGRESO_GASIFICADO',
    'C5_PESO_SALIDA_GASIFICADO',
    'C5_PESO_INGRESO_PREFRIO',
    'C5_PESO_SALIDA_PREFRIO',
    'C5_T_AMB_RECEP',
    'C5_T_PULP_RECEP',
    'C5_T_AMB_ING',
    'C5_T_PULP_ING',
    'C5_T_AMB_SAL',
    'C5_T_PULP_SAL',
    'C5_T_AMB_PRE_IN',
    'C5_T_PULP_PRE_IN',
    'C5_T_AMB_PRE_OUT',
    'C5_T_PULP_PRE_OUT',
    'C5_HUMEDAD_RECEPCION',
    'C5_HUMEDAD_INGRESO_GASIFICADO',
    'C5_HUMEDAD_SALIDA_GASIFICADO',
    'C5_HUMEDAD_INGRESO_PREFRIO',
    'C5_HUMEDAD_SALIDA_PREFRIO',
    'C5_PRESION_AMB_RECEPCION',
    'C5_PRESION_AMB_INGRESO_GASIFICADO',
    'C5_PRESION_AMB_SALIDA_GASIFICADO',
    'C5_PRESION_AMB_INGRESO_PREFRIO',
    'C5_PRESION_AMB_SALIDA_PREFRIO',
    'C5_PRESION_FRUTA_RECEPCION',
    'C5_PRESION_FRUTA_INGRESO_GASIFICADO',
    'C5_PRESION_FRUTA_SALIDA_GASIFICADO',
    'C5_PRESION_FRUTA_INGRESO_PREFRIO',
    'C5_PRESION_FRUTA_SALIDA_PREFRIO',
    'C5_OBSERVACION'
  ];
}

function strCell_(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Normaliza NUM_MUESTRA para comparaciones globales (trim + mayúsculas). */
function normalizarNumMuestraClave(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().split('·')[0].trim().toUpperCase();
}

/** Extrae NUM_MUESTRA desde una fila POST (expandida o normal). */
function extraerNumMuestraDesdeRowPost_(row) {
  if (!Array.isArray(row) || row.length < 3) return '';
  return normalizarNumMuestraClave(row[2]);
}

/**
 * Secuencia numérica de NUM_MUESTRA: últimos 4 caracteres (ej. C260001 → 1, 0001 → 1).
 * Acepta número de celda (hoja) si es entero.
 */
function parseNumMuestraDigitosGs_(v) {
  if (typeof v === 'number' && !isNaN(v) && isFinite(v) && v >= 0) {
    var fl = Math.floor(v);
    if (Math.abs(v - fl) < 1e-6) return fl;
  }
  var s = (v != null && v !== undefined) ? String(v).trim().toUpperCase() : '';
  if (!s) return 0;
  var tail = s.length <= 4 ? s : s.slice(-4);
  if (!/^\d{1,4}$/.test(tail)) return 0;
  var n = parseInt(tail, 10);
  return (isNaN(n) || n < 0) ? 0 : n;
}

/** Prefijo antes de los 4 dígitos finales (ej. C260001 → C26). */
function prefijoNumMuestraGs_(v) {
  var s = (v != null && v !== undefined) ? String(v).trim().toUpperCase() : '';
  if (!s || s.length <= 4) return '';
  return s.slice(0, -4);
}

/** Planilla vacía: C + año (2 dígitos), ej. 2026 → C26 → primer N° C260001. */
function prefijoDefaultNumMuestraCampoGs_() {
  var y = new Date().getFullYear() % 100;
  return 'C' + (y < 10 ? '0' + y : String(y));
}

/** Prefijo desde última celda; si la hoja está vacía, el default C26… */
function resolverPrefijoNumMuestraGs_(ultimoCelda, sheetMax, baseUltimo) {
  if (ultimoCelda && ultimoCelda.valorTexto) {
    return prefijoNumMuestraGs_(ultimoCelda.valorTexto);
  }
  if (baseUltimo === 0 && sheetMax === 0) {
    return prefijoDefaultNumMuestraCampoGs_();
  }
  return '';
}

/** Arma NUM_MUESTRA completo: prefijo + secuencia de 4 dígitos (mínimo). */
function formatearNumMuestraDesdeSecuenciaGs_(seq, prefijo) {
  if (!seq || seq < 1) return '';
  var p = prefijo != null ? String(prefijo) : '';
  var s = String(Math.floor(seq));
  if (s.length < 4) s = s.padStart(4, '0');
  return p + s;
}

/** Índice 0-based de la columna NUM_MUESTRA según fila 1 (por si hubo columnas extra a la izquierda). */
function indiceColumnaNumMuestraHoja1_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 2;
  var w = Math.min(lastCol, NUM_COLS_REGISTRO);
  var headers = sheet.getRange(1, 1, 1, w).getValues()[0];
  var target = 'NUMMUESTRA';
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] != null ? headers[c] : '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (key === target) return c;
  }
  return 2;
}

/** Máximo numérico solo en columna NUM_MUESTRA (fila 2..última con dato en esa columna). */
function maxNumMuestraEnHoja_(sheet) {
  var idx = indiceColumnaNumMuestraHoja1_(sheet);
  var lastRow = sheet.getLastRow();
  var maxNum = 0;
  if (lastRow < 2) return 0;
  var col1 = idx + 1;
  var values = sheet.getRange(2, col1, lastRow, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var n = parseNumMuestraDigitosGs_(values[i][0]);
    if (n > maxNum) maxNum = n;
  }
  return maxNum;
}

/** Última celda con dato en NUM_MUESTRA (de abajo hacia arriba). Ej. fila 17 = "8205". */
function ultimoNumMuestraCeldaHoja_(sheet) {
  var idx = indiceColumnaNumMuestraHoja1_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { valorTexto: '', fila: 0, digitos: 0 };
  }
  var col1 = idx + 1;
  var values = sheet.getRange(2, col1, lastRow, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var raw = values[i][0];
    if (raw === null || raw === undefined) continue;
    var s = String(raw).trim();
    if (s === '') continue;
    return {
      valorTexto: s,
      fila: i + 2,
      digitos: parseNumMuestraDigitosGs_(raw)
    };
  }
  return { valorTexto: '', fila: 0, digitos: 0 };
}

function leerWatermarkNumMuestra_() {
  var raw = PropertiesService.getScriptProperties().getProperty(NUM_MUESTRA_WATERMARK_KEY);
  if (!raw) return 0;
  var n = parseInt(String(raw).trim(), 10);
  return (isNaN(n) || n < 0) ? 0 : n;
}

/** Sube el watermark a al menos n; nunca lo baja. */
function fusionarWatermarkNumMuestra_(n) {
  var nInt = typeof n === 'number' ? Math.floor(n) : parseNumMuestraDigitosGs_(n);
  if (isNaN(nInt) || nInt < 0) return;
  var props = PropertiesService.getScriptProperties();
  var cur = leerWatermarkNumMuestra_();
  var next = Math.max(cur, nInt);
  if (next > cur) props.setProperty(NUM_MUESTRA_WATERMARK_KEY, String(next));
}

/**
 * Próximo NUM_MUESTRA.
 * @param {boolean} soloDesdeHoja Si true (consultas app): solo columna NUM_MUESTRA de la planilla.
 *        Si false (reservas al guardar): max(hoja, watermark) para no reutilizar códigos borrados.
 */
function resolverProximoNumMuestraJson_(sheet, soloDesdeHoja) {
  var ultimoCelda = ultimoNumMuestraCeldaHoja_(sheet);
  var sheetMax = maxNumMuestraEnHoja_(sheet);
  var baseUltimo = ultimoCelda.digitos > 0 ? ultimoCelda.digitos : sheetMax;
  var prefijo = resolverPrefijoNumMuestraGs_(ultimoCelda, sheetMax, baseUltimo);
  if (soloDesdeHoja) {
    var nextSolo = baseUltimo + 1;
    var nextStrSolo = formatearNumMuestraDesdeSecuenciaGs_(nextSolo, prefijo);
    return {
      max_en_hoja: baseUltimo,
      ultimo_num_muestra_celda: ultimoCelda.valorTexto,
      ultimo_num_muestra_fila: ultimoCelda.fila,
      ultimo_num_muestra_en_hoja: baseUltimo,
      max_digitos_columna: sheetMax,
      num_muestra_prefijo: prefijo,
      proximo_num_muestra: nextStrSolo
    };
  }
  var wm = leerWatermarkNumMuestra_();
  var M = Math.max(sheetMax, wm);
  fusionarWatermarkNumMuestra_(M);
  var nextN = M + 1;
  var nextStr = formatearNumMuestraDesdeSecuenciaGs_(nextN, prefijo);
  return { max_en_hoja: M, num_muestra_prefijo: prefijo, proximo_num_muestra: nextStr };
}

/**
 * Busca si existe NUM_MUESTRA en la hoja y devuelve detalle.
 * Retorna null si no existe.
 */
function buscarDuplicadoNumMuestraEnHoja_(sheet, numMuestraNorm) {
  var nm = normalizarNumMuestraClave(numMuestraNorm);
  if (!nm) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var idx = indiceColumnaNumMuestraHoja1_(sheet);
  var numCols = Math.max(14, idx + 1, NUM_COLS_REGISTRO);
  var vals = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  for (var i = 0; i < vals.length; i++) {
    var rowNm = normalizarNumMuestraClave(vals[i].length > idx ? vals[i][idx] : '');
    if (!rowNm || rowNm !== nm) continue;
    return {
      num_muestra: nm,
      fecha: formatFechaPacking(vals[i][0]) || '',
      ensayo_numero: (vals[i][13] != null && vals[i][13] !== '') ? String(vals[i][13]).trim() : ''
    };
  }
  return null;
}

/** True si alguna celda tiene dato de packing real (no vacío ni solo cero). */
function cellHasPackingValue_(v) {
  if (v === null || v === undefined) return false;
  var s = String(v).trim();
  if (!s) return false;
  if (s === '0' || s === '0.0' || s === '0,0') return false;
  return true;
}

function rowHasPackingData_(arr) {
  if (!arr || !arr.length) return false;
  var start = (arr.length >= PACKING_COLS) ? PACKING_META_COLS : 0;
  for (var i = start; i < arr.length; i++) {
    if (cellHasPackingValue_(arr[i])) return true;
  }
  return false;
}

/** True si alguna celda del array (una fila de getValues) tiene texto no vacío. */
function rowHasAnyNonEmpty_(arr) {
  if (!arr || !arr.length) return false;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] != null && String(arr[i]).trim() !== '') return true;
  }
  return false;
}

/** True si en esa fila hay al menos un dato de packing real (ignora ceros sueltos). */
function rangeRowHasPackingData_(sheet, row, startCol, numCols) {
  if (numCols <= 0 || row < 2) return false;
  try {
    var vals = sheet.getRange(row, startCol, 1, numCols).getValues()[0];
    return rowHasPackingData_(vals);
  } catch (e) {
    return false;
  }
}

/** True si en esa fila de hoja hay al menos un valor en el rango [startCol .. startCol+numCols-1]. */
function rangeRowHasAnyValue_(sheet, row, startCol, numCols) {
  if (numCols <= 0 || row < 2) return false;
  try {
    var vals = sheet.getRange(row, startCol, 1, numCols).getValues()[0];
    return rowHasAnyNonEmpty_(vals);
  } catch (e) {
    return false;
  }
}

function pickField_(arr, i, key) {
  if (!Array.isArray(arr) || i < 0 || i >= arr.length) return '';
  var o = arr[i];
  if (!o || typeof o !== 'object') return '';
  return strCell_(o[key]);
}

/** Fila Thermo King índice i (alineada a la fila de hoja i del mismo ensayo). */
function buildThermokingFlatRow(data, i) {
  var fiTk = (data.fecha_inspeccion_thermoking != null && String(data.fecha_inspeccion_thermoking).trim() !== '') ? String(data.fecha_inspeccion_thermoking).trim() : '';
  if (!fiTk && data.fecha_inspeccion != null) fiTk = String(data.fecha_inspeccion).trim();
  var respTk = (data.responsable_thermoking != null && String(data.responsable_thermoking).trim() !== '') ? String(data.responsable_thermoking).trim() : '';
  if (!respTk && data.responsable != null) respTk = String(data.responsable).trim();
  var hora = (data.hora_salida_thermoking != null) ? String(data.hora_salida_thermoking).trim() : '';
  var placa = (data.placa_thermoking != null) ? String(data.placa_thermoking).trim() : '';
  var t = data.thermoking_tiempos || [];
  var p = data.thermoking_peso || [];
  var tem = data.thermoking_temp || [];
  var h = data.thermoking_humedad_tk || data.thermoking_humedad || [];
  var pr = data.thermoking_presion_tk || data.thermoking_presion || [];
  var v = data.thermoking_vapor || [];
  var obs = data.thermoking_obs || [];
  return [
    fiTk,
    respTk,
    hora,
    placa,
    pickField_(t, i, 'ic'),
    pickField_(t, i, 'st'),
    pickField_(t, i, 'it'),
    pickField_(t, i, 'dp'),
    pickField_(p, i, 'ic'),
    pickField_(p, i, 'st'),
    pickField_(p, i, 'it'),
    pickField_(p, i, 'dp'),
    pickField_(tem, i, 'ic_cm'),
    pickField_(tem, i, 'ic_pu'),
    pickField_(tem, i, 'st_cm'),
    pickField_(tem, i, 'st_pu'),
    pickField_(tem, i, 'it_amb'),
    pickField_(tem, i, 'it_veh'),
    pickField_(tem, i, 'it_pu'),
    pickField_(tem, i, 'd_amb'),
    pickField_(tem, i, 'd_veh'),
    pickField_(tem, i, 'd_pu'),
    pickField_(h, i, 'ic'),
    pickField_(h, i, 'st'),
    pickField_(h, i, 'aei'),
    pickField_(h, i, 'ivi'),
    pickField_(h, i, 'aed'),
    pickField_(h, i, 'ivd'),
    pickField_(pr, i, 'ic'),
    pickField_(pr, i, 'st'),
    pickField_(pr, i, 'aei'),
    pickField_(pr, i, 'ivi'),
    pickField_(pr, i, 'aed'),
    pickField_(pr, i, 'ivd'),
    pickField_(v, i, 'ic'),
    pickField_(v, i, 'scm'),
    pickField_(v, i, 'it'),
    pickField_(v, i, 'st'),
    pickField_(obs, i, 'observacion')
  ];
}

/** Fila Recepción C5 índice i (packing1_c5 … packing8_c5). */
function buildC5FlatRow(data, i) {
  var hora = (data.hora_inicio_recepcion_c5 != null) ? String(data.hora_inicio_recepcion_c5).trim() : '';
  var responsableC5 = '';
  if (data.responsable_c5 != null && String(data.responsable_c5).trim() !== '') {
    responsableC5 = String(data.responsable_c5).trim();
  } else if (data.placa_c5 != null) {
    responsableC5 = String(data.placa_c5).trim();
  }
  var p1 = data.packing1_c5 || data.c5_tiempos || [];
  var p2 = data.packing2_c5 || data.c5_peso || [];
  var p3 = data.packing3_c5 || data.c5_temp || [];
  var p4 = data.packing4_c5 || data.c5_humedad || [];
  var p5 = data.packing5_c5 || data.c5_presion || [];
  var p6 = data.packing6_c5 || data.c5_presion_fruta || [];
  var p8 = data.packing8_c5 || data.c5_obs || [];
  return [
    hora,
    responsableC5,
    pickField_(p1, i, 'recepcion'),
    pickField_(p1, i, 'ingreso_gasificado'),
    pickField_(p1, i, 'salida_gasificado'),
    pickField_(p1, i, 'ingreso_prefrio'),
    pickField_(p1, i, 'salida_prefrio'),
    pickField_(p2, i, 'peso_recepcion'),
    pickField_(p2, i, 'peso_ingreso_gasificado'),
    pickField_(p2, i, 'peso_salida_gasificado'),
    pickField_(p2, i, 'peso_ingreso_prefrio'),
    pickField_(p2, i, 'peso_salida_prefrio'),
    pickField_(p3, i, 't_amb_recep'),
    pickField_(p3, i, 't_pulp_recep'),
    pickField_(p3, i, 't_amb_ing'),
    pickField_(p3, i, 't_pulp_ing'),
    pickField_(p3, i, 't_amb_sal'),
    pickField_(p3, i, 't_pulp_sal'),
    pickField_(p3, i, 't_amb_pre_in'),
    pickField_(p3, i, 't_pulp_pre_in'),
    pickField_(p3, i, 't_amb_pre_out'),
    pickField_(p3, i, 't_pulp_pre_out'),
    pickField_(p4, i, 'recepcion'),
    pickField_(p4, i, 'ingreso_gasificado'),
    pickField_(p4, i, 'salida_gasificado'),
    pickField_(p4, i, 'ingreso_prefrio'),
    pickField_(p4, i, 'salida_prefrio'),
    pickField_(p5, i, 'recepcion'),
    pickField_(p5, i, 'ingreso_gasificado'),
    pickField_(p5, i, 'salida_gasificado'),
    pickField_(p5, i, 'ingreso_prefrio'),
    pickField_(p5, i, 'salida_prefrio'),
    pickField_(p6, i, 'recepcion'),
    pickField_(p6, i, 'ingreso_gasificado'),
    pickField_(p6, i, 'salida_gasificado'),
    pickField_(p6, i, 'ingreso_prefrio'),
    pickField_(p6, i, 'salida_prefrio'),
    pickField_(p8, i, 'observacion')
  ];
}

function doPost(e) {
  function out(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (!e || !e.postData || !e.postData.contents) {
    return out({ ok: false, error: "Sin datos POST" });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return out({ ok: false, error: "Servidor ocupado, reintenta" });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rawBody = String(e.postData.contents || '');
    var data;
    try {
      data = JSON.parse(rawBody);
    } catch (jsonErr) {
      return out({
        ok: false,
        error: "JSON inválido en POST",
        detail: String(jsonErr)
      });
    }

    var sheetVisual = ss.getSheets()[SHEET_IDX_VISUAL_REGISTRO];
    if (data.mode === 'packing') {
      var sheetPack = resolverHojaRegistroPacking_(ss, data);
      var packingResult = doPostPacking(sheetPack, data);
      return out(packingResult);
    }
    if (data.mode === 'recepcion-c5' || data.mode === 'recepcion_c5') {
      var sheetC5 = resolverHojaRegistroPacking_(ss, data);
      var c5Result = doPostRecepcionC5(sheetC5, data);
      return out(c5Result);
    }

    var esAcopio = esModoRegistroAcopioPost_(data);
    var sheet = obtenerHojaPorIndice_(ss, indiceHojaRegistroPrincipal_(esAcopio));
    if (esAcopio) {
      asegurarEncabezadoHoja3Acopio_(sheet);
    } else {
      asegurarEncabezadoHoja1Registro_(sheet);
    }

    const rows = data.rows || [];
    const uid = data.uid || null;

    if (rows.length === 0) {
      return out({ ok: false, error: "Sin filas" });
    }

    if (uid) {
      var props = PropertiesService.getScriptProperties();
      var keyUid = "mtpp_uid_" + uid;
      if (props.getProperty(keyUid) === "1") {
        return out({
          ok: true,
          received: rows.length,
          inserted: 0,
          duplicate: true,
          message: "Registro ya procesado anteriormente (evitado duplicado)"
        });
      }
    }

    const NUM_COLS = NUM_COLS_REGISTRO;
    /** Fila expandida 56: pos. 0–20 + 21–26 (Hoja2) + 27–55 → 50 col registro. */

    function normalizarParaClave(v) {
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return Utilities.formatDate(v, "America/Santiago", "yyyy-MM-dd");
      var s = String(v).trim();
      return s;
    }
    /** Misma lógica que "antes": anti-duplicado por los 48 valores de la fila (normalizados), sin clave abreviada. */
    function buildKey(row) {
      return row.slice(0, NUM_COLS).map(normalizarParaClave).join("||");
    }

    var lastRow = sheet.getLastRow();
    var existingKeys = {};
    if (lastRow >= 2) {
      var existingValues = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
      existingValues.forEach(function(r) {
        var key = buildKey(r);
        if (key) existingKeys[key] = true;
      });
    }

    function celdaAString(cell) {
      if (cell === null || cell === undefined) return "";
      return String(cell);
    }

    /** 56 celdas: 21 inicio registro + 6 (Hoja2) + 29 cierre → 50 col registro. */
    function toRowRegistro(row) {
      var minLen = REGISTRO_POST_EXPANDED_LEN;
      while (row.length < minLen) row.push("");
      var a = row.slice(0, REGISTRO_PRE_JARRA_COLS).concat(row.slice(REGISTRO_PRE_JARRA_COLS + 6, REGISTRO_POST_EXPANDED_LEN));
      return a.slice(0, NUM_COLS).map(celdaAString);
    }

    function rowHoja2(fila, rowOriginal) {
      var c = celdaAString;
      var out = [c(fila[0]), c(fila[13]), c(fila[15]), '', '', '', '', '', ''];
      /** Hueco 21-26: Cosecha + Trasvasado desde el panel de jarras (POST expandido). */
      if (rowOriginal && rowOriginal.length >= REGISTRO_PRE_JARRA_COLS + 6) {
        out[3] = c(rowOriginal[REGISTRO_PRE_JARRA_COLS]);
        out[4] = c(rowOriginal[REGISTRO_PRE_JARRA_COLS + 1]);
        out[5] = c(rowOriginal[REGISTRO_PRE_JARRA_COLS + 2]);
        out[6] = c(rowOriginal[REGISTRO_PRE_JARRA_COLS + 3]);
        out[7] = c(rowOriginal[REGISTRO_PRE_JARRA_COLS + 4]);
        out[8] = c(rowOriginal[REGISTRO_PRE_JARRA_COLS + 5]);
      }
      return out;
    }

    function esCero(v) {
      if (v === null || v === undefined) return true;
      var s = String(v).trim();
      if (s === '') return true;
      var n = parseFloat(s.replace(',', '.'));
      return isNaN(n) || n === 0;
    }

    var minExpanded = REGISTRO_POST_EXPANDED_LEN;
    var nuevasFilas = [];
    var filasHoja2 = [];
    rows.forEach(function(row) {
      var fila = row.length >= minExpanded ? toRowRegistro(row) : (function() { while (row.length < NUM_COLS) row.push(""); return row.slice(0, NUM_COLS).map(celdaAString); })();
      aplicarPresionVaporDecimalEnFilaRegistro_(fila);
      var key = buildKey(fila);
      if (existingKeys[key]) return;
      existingKeys[key] = true;
      filasHoja2.push(rowHoja2(fila, row.length >= minExpanded ? row : null));
      // Visual: PESO_1 + clamshell. Acopio: PESO_4 + PESO_5 + clamshell (P1–P3 opcionales).
      var filaInsertable = false;
      if (!esCero(fila[14])) {
        if (esAcopio) {
          filaInsertable = !esCero(fila[19]) && !esCero(fila[20]);
        } else {
          filaInsertable = !esCero(fila[16]);
        }
      }
      if (filaInsertable) nuevasFilas.push(fila);
    });

    lastRow = sheet.getLastRow();
    existingKeys = {};
    if (lastRow >= 2) {
      existingValues = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
      existingValues.forEach(function(r) {
        var key = buildKey(r);
        if (key) existingKeys[key] = true;
      });
      var filtradas = [];
      nuevasFilas.forEach(function(fila) {
        var key = buildKey(fila);
        if (existingKeys[key]) return;
        filtradas.push(fila);
        existingKeys[key] = true;
      });
      nuevasFilas = filtradas;
    }

    if (nuevasFilas.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      var numRows = nuevasFilas.length;
      // NUM_MUESTRA (col 3) debe mantenerse como texto para conservar ceros a la izquierda (ej: 0001, C260001).
      sheet.getRange(startRow, 3, numRows, 1).setNumberFormat('@');
      sheet.getRange(startRow, 1, numRows, NUM_COLS).setValues(nuevasFilas);
      sheet.getRange(startRow, 40, numRows, 8).setNumberFormat('0.000');
      for (var wmi = 0; wmi < nuevasFilas.length; wmi++) {
        fusionarWatermarkNumMuestra_(parseNumMuestraDigitosGs_(nuevasFilas[wmi][2]));
      }
    }
    if (filasHoja2.length > 0) {
      var sheet2 = obtenerHojaPorIndice_(ss, indiceHojaRegistroJarras_(esAcopio));
      asegurarEncabezadoHojaJarras_(sheet2);
      var startRow2 = sheet2.getLastRow() + 1;
      sheet2.getRange(startRow2, 1, filasHoja2.length, 9).setValues(filasHoja2);
    }

    if (nuevasFilas.length === 0 && rows.length > 0) {
      return out({
        ok: false,
        error: "No se insertó ninguna fila: todas coinciden con registros ya existentes (clave duplicada).",
        duplicate: true
      });
    }

    if (uid) {
      PropertiesService.getScriptProperties().setProperty("mtpp_uid_" + uid, "1");
      limpiarUidsAntiguos();
    }

    return out({
      ok: true,
      received: rows.length,
      inserted: nuevasFilas.length,
      message: "Registro exitoso"
    });

  } catch (error) {
    return out({ ok: false, error: error.toString() });
  } finally {
    try {
      lock.releaseLock();
    } catch (e2) {}
  }
}

function safeJson(val) {
  try {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  } catch (_) {
    return '';
  }
}

function limpiarUidsAntiguos() {
  try {
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var keys = [];
    for (var k in all) {
      if (k.indexOf("mtpp_uid_") === 0) keys.push(k);
    }
    if (keys.length <= 500) return;
    keys.sort();
    var eliminar = keys.length - 500;
    for (var i = 0; i < eliminar; i++) {
      props.deleteProperty(keys[i]);
    }
  } catch (e) {}
}

function formatFechaPacking(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) return Utilities.formatDate(val, "GMT", "yyyy-MM-dd");
  var s = String(val).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    var parts = s.split('/');
    var day = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var year = parseInt(parts[2], 10);
    if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) d = new Date(year, month, day);
  } else if (s.indexOf('GMT') >= 0 || /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.test(s)) d = new Date(s);
  if (d && !isNaN(d.getTime())) return Utilities.formatDate(d, "GMT", "yyyy-MM-dd");
  return s;
}

function formatHoraRegistro_(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'America/Lima', 'HH:mm');
  }
  var s = String(val).trim();
  if (!s) return '';
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    return (m[1].length < 2 ? '0' + m[1] : m[1]) + ':' + m[2];
  }
  return s;
}

/**
 * Presión vapor (Kpa): valor numérico real (ej. 3.453), no texto "3.453".
 * En locale es_* un string con punto se interpreta como miles (3453); por eso se guarda como Number.
 */
function normalizarPresionVaporCelda_(v) {
  if (v === null || v === undefined) return "";
  var s = String(v).trim().replace(',', '.');
  if (s === '') return '';
  if (s.charAt(0) === '.') s = '0' + s;
  var n = parseFloat(s);
  if (isNaN(n)) return '';
  return Math.round(n * 1000) / 1000;
}

/** Cols presión registro Campo: índices 39–46 (0-based). */
function aplicarPresionVaporDecimalEnFilaRegistro_(fila) {
  var i;
  for (i = 39; i <= 46; i++) {
    if (i < fila.length) fila[i] = normalizarPresionVaporCelda_(fila[i]);
  }
  return fila;
}

/** Temp, humedad y presión packing (fila plana 37): índices 10–34. */
function aplicarDecimalesMedicionEnFilaPacking_(fila) {
  var i;
  for (i = 10; i <= 34; i++) {
    if (i < fila.length) fila[i] = normalizarPresionVaporCelda_(fila[i]);
  }
  return fila;
}

function normalizarFilaPackingDatosParaHoja_(row) {
  if (!Array.isArray(row)) return [];
  var out = row.slice();
  aplicarDecimalesMedicionEnFilaPacking_(out);
  return out;
}

function valorCeldaPackingAlEscribir_(idxData, v) {
  if (idxData >= 10 && idxData <= 34) return normalizarPresionVaporCelda_(v);
  return (v != null && v !== '') ? v : '';
}

/** Formato 0.000 en temp/humedad/presión para que la barra muestre el decimal correcto. */
function aplicarFormatoDecimalesPackingEnFila_(sheet, filaHoja, startCol) {
  var colBase = startCol + PACKING_META_COLS + 10;
  sheet.getRange(filaHoja, colBase, 1, 25).setNumberFormat('0.000');
}

function getPackingHeaderNamesPerRow() {
  return [
    'RECEPCION', 'INGRESO_GASIFICADO', 'SALIDA_GASIFICADO', 'INGRESO_PREFRIO', 'SALIDA_PREFRIO',
    'PESO_RECEPCION', 'PESO_INGRESO_GASIFICADO', 'PESO_SALIDA_GASIFICADO', 'PESO_INGRESO_PREFRIO', 'PESO_SALIDA_PREFRIO',
    'T_AMB_RECEP', 'T_PULP_RECEP', 'T_AMB_ING', 'T_PULP_ING', 'T_AMB_SAL', 'T_PULP_SAL', 'T_AMB_PRE_IN', 'T_PULP_PRE_IN', 'T_AMB_PRE_OUT', 'T_PULP_PRE_OUT',
    'HUMEDAD_RECEPCION', 'HUMEDAD_INGRESO_GASIFICADO', 'HUMEDAD_SALIDA_GASIFICADO', 'HUMEDAD_INGRESO_PREFRIO', 'HUMEDAD_SALIDA_PREFRIO',
    'PRESION_AMB_RECEPCION', 'PRESION_AMB_INGRESO_GASIFICADO', 'PRESION_AMB_SALIDA_GASIFICADO', 'PRESION_AMB_INGRESO_PREFRIO', 'PRESION_AMB_SALIDA_PREFRIO',
    'PRESION_FRUTA_RECEPCION', 'PRESION_FRUTA_INGRESO_GASIFICADO', 'PRESION_FRUTA_SALIDA_GASIFICADO', 'PRESION_FRUTA_INGRESO_PREFRIO', 'PRESION_FRUTA_SALIDA_PREFRIO',
    'OBSERVACION',
    'HORA_REGISTRO'
  ];
}

/** Columna OBSERVACION del bloque packing (fila plana, sin sufijo _N). */
function colObservacionPacking_(sheet) {
  return PACKING_START_COL + PACKING_META_COLS + 35;
}

/** Columna HORA_REGISTRO del bloque packing (CK cuando packing inicia en 49). */
function colHoraRegistroPacking_(sheet) {
  return PACKING_START_COL + PACKING_META_COLS + 36;
}

/** Inserta columna HORA_REGISTRO tras OBSERVACION si la hoja aún tiene esquema packing de 40 cols. */
function migrarInsertarHoraRegistroPacking_(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return;
  var colObs = colObservacionPacking_(sheet);
  var colHora = colHoraRegistroPacking_(sheet);
  var hObs = String(sheet.getRange(1, colObs).getValue() || '').trim().toUpperCase();
  var hHora = String(sheet.getRange(1, colHora).getValue() || '').trim().toUpperCase();
  if (hObs === 'OBSERVACION' && hHora === 'HORA_REGISTRO') return;
  if (hObs === 'OBSERVACION' && hHora !== 'HORA_REGISTRO') {
    sheet.insertColumnAfter(colObs);
    sheet.getRange(1, colHora).setValue('HORA_REGISTRO');
  }
}

function getPackingHeaderNames(numFilas) {
  var out = ['HORA_RECEPCION', 'N_VIAJE'];
  var base = getPackingHeaderNamesPerRow();
  for (var f = 1; f <= numFilas; f++) {
    var suffix = '_' + f;
    for (var i = 0; i < base.length; i++) out.push(base[i] + suffix);
  }
  return out;
}

function doPostPacking(sheet, data) {
  try {
    migrarInsertarHoraRegistroPacking_(sheet);
    var guardarPacking = (data.guardar_packing === false || data.guardar_packing === 'false') ? false : true;
    var actualizarC5 = (data.actualizar_c5 === false || data.actualizar_c5 === 'false') ? false : true;

    var fecha = (data.fecha != null && data.fecha !== '') ? String(data.fecha).trim() : '';
    var ensayoNumero = (data.ensayo_numero != null && data.ensayo_numero !== '') ? String(data.ensayo_numero).trim() : '';
    var fechaInspeccion = (data.fecha_inspeccion != null && data.fecha_inspeccion !== '') ? String(data.fecha_inspeccion).trim() : '';
    var responsable = (data.responsable != null && data.responsable !== '') ? String(data.responsable).trim() : '';
    var horaRecepcion = (data.hora_recepcion != null && data.hora_recepcion !== '') ? String(data.hora_recepcion).trim() : '';
    var nViaje = (data.n_viaje != null && data.n_viaje !== '') ? String(data.n_viaje).trim() : '';
    var packingRows = data.packingRows || [];
    var packingStartIndex = Number(data.packing_start_index);
    if (!Number.isFinite(packingStartIndex) || packingStartIndex < 0) packingStartIndex = 0;

    if (!fecha || !ensayoNumero) {
      return { ok: false, error: 'Faltan fecha o ensayo_numero' };
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { ok: false, error: 'No hay datos en la hoja' };
    }

    var dataRows = sheet.getRange(2, 1, lastRow, 14).getValues();
    var rowIndices = [];
    for (var k = 0; k < dataRows.length; k++) {
      var r = dataRows[k];
      var rowFechaStr = formatFechaPacking(r[0]);
      var rowEn = (r[13] != null && r[13] !== '') ? String(r[13]).trim() : '';
      if (rowFechaStr === fecha && rowEn === ensayoNumero) {
        rowIndices.push(2 + k);
      }
    }
    if (rowIndices.length === 0) {
      return { ok: false, error: 'No se encontró ninguna fila para esa fecha y ensayo' };
    }

    var primeraFila = rowIndices[0];
    var packingYaExiste = rangeRowHasPackingData_(sheet, primeraFila, PACKING_START_COL, PACKING_COLS);
    var guardarThermoking;
    if (data.guardar_thermoking === false || data.guardar_thermoking === 'false') guardarThermoking = false;
    else if (data.guardar_thermoking === true || data.guardar_thermoking === 'true') guardarThermoking = true;
    else guardarThermoking = packingYaExiste ? false : true;

    if (packingYaExiste) {
      if (guardarPacking && packingRows.length) {
        var startColMerge = PACKING_START_COL;
        var colsPorFilaMerge = PACKING_META_COLS + PACKING_DATA_COLS;
        var baseHeadersMerge = ['FECHA_INSPECCION', 'RESPONSABLE', 'HORA_RECEPCION', 'N_VIAJE'].concat(getPackingHeaderNamesPerRow());
        for (var pm = 0; pm < packingRows.length; pm++) {
          var filaIdxMerge = packingStartIndex + pm;
          if (filaIdxMerge >= rowIndices.length) break;
          var rowMerge = normalizarFilaPackingDatosParaHoja_(packingRows[pm]);
          var filaHojaMerge = rowIndices[filaIdxMerge];
          var valoresMerge = [fechaInspeccion, responsable, horaRecepcion, nViaje];
          if (Array.isArray(rowMerge)) {
            for (var jm = 0; jm < PACKING_DATA_COLS; jm++) {
              var rawMerge = (jm < rowMerge.length && rowMerge[jm] != null && rowMerge[jm] !== '') ? rowMerge[jm] : '';
              var vMerge = valorCeldaPackingAlEscribir_(jm, rawMerge);
              if (jm === PACKING_DATA_COLS - 1 && !vMerge) vMerge = formatHoraRegistro_(new Date());
              valoresMerge.push(vMerge);
            }
          } else {
            for (var jm2 = 0; jm2 < PACKING_DATA_COLS; jm2++) valoresMerge.push('');
          }
          sheet.getRange(filaHojaMerge, startColMerge, 1, colsPorFilaMerge).setValues([valoresMerge]);
          aplicarFormatoDecimalesPackingEnFila_(sheet, filaHojaMerge, startColMerge);
        }
        sheet.getRange(1, startColMerge, 1, baseHeadersMerge.length).setValues([baseHeadersMerge]);
      }
      if (actualizarC5) {
        var c5HeadersMerge = getC5FlatHeaders();
        sheet.getRange(1, C5_START_COL, 1, c5HeadersMerge.length).setValues([c5HeadersMerge]);
        for (var cm = 0; cm < rowIndices.length; cm++) {
          var c5Merge = buildC5FlatRow(data, cm);
          sheet.getRange(rowIndices[cm], C5_START_COL, 1, c5Merge.length).setValues([c5Merge]);
        }
      }
      if (guardarThermoking) {
        var tkHeadersMerge = getThermokingFlatHeaders();
        sheet.getRange(1, THERMOKING_START_COL, 1, tkHeadersMerge.length).setValues([tkHeadersMerge]);
        for (var tix = 0; tix < rowIndices.length; tix++) {
          var termoMerge = buildThermokingFlatRow(data, tix);
          sheet.getRange(rowIndices[tix], THERMOKING_START_COL, 1, termoMerge.length).setValues([termoMerge]);
        }
      }
      if (!actualizarC5 && !guardarThermoking && !(guardarPacking && packingRows.length)) {
        return { ok: false, error: 'Nada que actualizar (packing ya en hoja; sin C5 ni Thermo King)' };
      }
      return {
        ok: true,
        message: 'Actualización en ' + rowIndices.length + ' fila(s) (packing existente; C5/Thermo según flags)',
        filasEscritas: rowIndices.length,
        mergeSoloC5: actualizarC5,
        packingActualizado: !!(guardarPacking && packingRows.length)
      };
    }

    var startCol = PACKING_START_COL;
    var COLS_POR_FILA = PACKING_META_COLS + PACKING_DATA_COLS;
    var baseHeaders = ['FECHA_INSPECCION', 'RESPONSABLE', 'HORA_RECEPCION', 'N_VIAJE'].concat(getPackingHeaderNamesPerRow());

    if (guardarPacking) {
      for (var i = 0; i < packingRows.length; i++) {
        var filaIdx = packingStartIndex + i;
        if (filaIdx >= rowIndices.length) break;
        var row = normalizarFilaPackingDatosParaHoja_(packingRows[i]);
        var filaHoja = rowIndices[filaIdx];
        var valores = [fechaInspeccion, responsable, horaRecepcion, nViaje];
        if (Array.isArray(row)) {
          for (var j = 0; j < PACKING_DATA_COLS; j++) {
            var rawPack = (j < row.length && row[j] != null && row[j] !== '') ? row[j] : '';
            var vPack = valorCeldaPackingAlEscribir_(j, rawPack);
            if (j === PACKING_DATA_COLS - 1 && !vPack) vPack = formatHoraRegistro_(new Date());
            valores.push(vPack);
          }
        } else {
          for (var j = 0; j < PACKING_DATA_COLS; j++) valores.push('');
        }
        sheet.getRange(filaHoja, startCol, 1, COLS_POR_FILA).setValues([valores]);
        aplicarFormatoDecimalesPackingEnFila_(sheet, filaHoja, startCol);
      }
      sheet.getRange(1, startCol, 1, baseHeaders.length).setValues([baseHeaders]);
    }

    if (guardarThermoking) {
      var tkHeaders = getThermokingFlatHeaders();
      sheet.getRange(1, THERMOKING_START_COL, 1, tkHeaders.length).setValues([tkHeaders]);
      for (var ti = 0; ti < rowIndices.length; ti++) {
        var termoVals = buildThermokingFlatRow(data, ti);
        sheet.getRange(rowIndices[ti], THERMOKING_START_COL, 1, termoVals.length).setValues([termoVals]);
      }
    }

    if (actualizarC5) {
      var c5Headers = getC5FlatHeaders();
      sheet.getRange(1, C5_START_COL, 1, c5Headers.length).setValues([c5Headers]);
      for (var ci = 0; ci < rowIndices.length; ci++) {
        var c5ValsPacking = buildC5FlatRow(data, ci);
        sheet.getRange(rowIndices[ci], C5_START_COL, 1, c5ValsPacking.length).setValues([c5ValsPacking]);
      }
    }

    if (!guardarPacking && !guardarThermoking && !actualizarC5) {
      return { ok: false, error: 'Nada que escribir (guardar_packing, guardar_thermoking y actualizar_c5 en false)' };
    }

    return {
      ok: true,
      message: 'Guardado en ' + rowIndices.length + ' fila(s) (Packing/Thermo/C5 según flags)',
      filasEscritas: rowIndices.length,
      packingMuestras: packingRows.length
    };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function doPostRecepcionC5(sheet, data) {
  try {
    var fecha = (data.fecha != null && data.fecha !== '') ? String(data.fecha).trim() : '';
    var ensayoNumero = (data.ensayo_numero != null && data.ensayo_numero !== '') ? String(data.ensayo_numero).trim() : '';
    if (!fecha || !ensayoNumero) return { ok: false, error: 'Faltan fecha o ensayo_numero' };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, error: 'No hay datos en la hoja' };

    var dataRows = sheet.getRange(2, 1, lastRow, 14).getValues();
    var rowIndices = [];
    for (var k = 0; k < dataRows.length; k++) {
      var r = dataRows[k];
      var rowFechaStr = formatFechaPacking(r[0]);
      var rowEn = (r[13] != null && r[13] !== '') ? String(r[13]).trim() : '';
      if (rowFechaStr === fecha && rowEn === ensayoNumero) rowIndices.push(2 + k);
    }
    if (rowIndices.length === 0) return { ok: false, error: 'No se encontró ninguna fila para esa fecha y ensayo' };

    var c5Headers = getC5FlatHeaders();
    sheet.getRange(1, C5_START_COL, 1, c5Headers.length).setValues([c5Headers]);

    for (var ci = 0; ci < rowIndices.length; ci++) {
      var c5Vals = buildC5FlatRow(data, ci);
      sheet.getRange(rowIndices[ci], C5_START_COL, 1, c5Vals.length).setValues([c5Vals]);
    }
    return { ok: true, message: 'Recepción C5 guardada', fila: rowIndices[0], filasEscritas: rowIndices.length };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function normalizarEnsayoNumeroGs_(en) {
  if (en === null || en === undefined || String(en).trim() === '') return '';
  var n = Number(en);
  return (!isNaN(n) && n === Math.floor(n)) ? String(n) : String(en).trim();
}

function contarFilasFechaEnsayoEnHoja_(sheet, fecha, ensayoNumero) {
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var fechaNorm = formatFechaPacking(fecha) || fecha;
  var enNorm = normalizarEnsayoNumeroGs_(ensayoNumero);
  var dataRows = sheet.getRange(2, 1, lastRow, 14).getValues();
  var n = 0;
  for (var k = 0; k < dataRows.length; k++) {
    var rowFechaStr = formatFechaPacking(dataRows[k][0]);
    var rowEnStr = normalizarEnsayoNumeroGs_(dataRows[k][13]);
    if (rowFechaStr === fechaNorm && rowEnStr === enNorm) n++;
  }
  return n;
}

/** Fila 1: columnas Packing + Thermo King + C5 (mismas que Hoja 1). */
function asegurarEncabezadosPackingEnHoja_(sheet) {
  if (!sheet) return;
  migrarRegistro48a50Cols_(sheet);
  migrarInsertarHoraRegistroPacking_(sheet);
  var startCol = PACKING_START_COL;
  var packHeaders = ['FECHA_INSPECCION', 'RESPONSABLE', 'HORA_RECEPCION', 'N_VIAJE'].concat(getPackingHeaderNamesPerRow());
  var hPack = String(sheet.getRange(1, startCol).getValue() || '').trim().toUpperCase();
  if (hPack !== 'FECHA_INSPECCION') {
    sheet.getRange(1, startCol, 1, packHeaders.length).setValues([packHeaders]);
  }
  var tkHeaders = getThermokingFlatHeaders();
  var hTk = String(sheet.getRange(1, THERMOKING_START_COL).getValue() || '').trim().toUpperCase();
  if (hTk !== 'FECHA_INSPECCION_THERMOKING') {
    sheet.getRange(1, THERMOKING_START_COL, 1, tkHeaders.length).setValues([tkHeaders]);
  }
  var c5Headers = getC5FlatHeaders();
  var hC5 = String(sheet.getRange(1, C5_START_COL).getValue() || '').trim().toUpperCase();
  if (hC5 !== 'HORA_INICIO_RECEPCION_C5') {
    sheet.getRange(1, C5_START_COL, 1, c5Headers.length).setValues([c5Headers]);
  }
}

function prepararHojaRegistroCampo_(sheet, esAcopio) {
  if (!sheet) return;
  if (esAcopio) {
    asegurarEncabezadoHoja3Acopio_(sheet);
  } else {
    asegurarEncabezadoHoja1Registro_(sheet);
  }
}

/** Packing y detalle: Hoja 3 (Acopio) o Hoja 1 (Visual); auto-detecta por fecha+ensayo. */
function resolverHojaRegistroPacking_(ss, params) {
  var fecha = String((params && params.fecha) || '').trim();
  var ensayo = String((params && params.ensayo_numero) || '').trim();
  var s1 = ss.getSheets()[SHEET_IDX_VISUAL_REGISTRO];
  if (esModoRegistroAcopioPost_(params)) {
    var sAc = obtenerHojaPorIndice_(ss, SHEET_IDX_ACOPIO_REGISTRO);
    prepararHojaRegistroCampo_(sAc, true);
    return sAc;
  }
  prepararHojaRegistroCampo_(s1, false);
  if (fecha && ensayo) {
    var fechaNorm = formatFechaPacking(fecha) || fecha;
    if (contarFilasFechaEnsayoEnHoja_(s1, fechaNorm, ensayo) > 0) return s1;
    var s3 = obtenerHojaPorIndice_(ss, SHEET_IDX_ACOPIO_REGISTRO);
    if (contarFilasFechaEnsayoEnHoja_(s3, fechaNorm, ensayo) > 0) {
      prepararHojaRegistroCampo_(s3, true);
      return s3;
    }
  }
  return s1;
}

function hojasRegistroConDatos_(ss) {
  return hojasRegistroNumMuestra_(ss);
}

/** Packing: muestras del día — Hoja 1 (Visual) + Hoja 3 (Acopio), sin duplicar num|ensayo. */
function listadoMuestrasPorFechaGlobal_(ss, fechaRaw) {
  var fechaLm = formatFechaPacking(fechaRaw) || String(fechaRaw || '').trim();
  if (!fechaLm) {
    return { ok: false, error: 'Falta parámetro: fecha', fecha: '', muestras: [] };
  }
  var muestrasLm = [];
  var seenLm = {};
  var hojasLm = hojasRegistroNumMuestra_(ss);
  for (var hli = 0; hli < hojasLm.length; hli++) {
    var shLm = hojasLm[hli];
    var lrLm = shLm.getLastRow();
    if (lrLm < 2) continue;
    var idxLm = indiceColumnaNumMuestraHoja1_(shLm);
    var dataLm = shLm.getRange(2, 1, lrLm, Math.max(14, idxLm + 1)).getValues();
    for (var lmi = 0; lmi < dataLm.length; lmi++) {
      var rl = dataLm[lmi];
      var fl = formatFechaPacking(rl[0]);
      if (fl !== fechaLm) continue;
      var enStrLm = normalizarEnsayoNumeroGs_(rl[13]);
      var numLm = (rl.length > idxLm && rl[idxLm] != null && rl[idxLm] !== undefined)
        ? String(rl[idxLm]).trim()
        : '';
      if (!enStrLm || !numLm) continue;
      var keyLm = numLm + '|' + enStrLm;
      if (seenLm[keyLm]) continue;
      seenLm[keyLm] = true;
      muestrasLm.push({
        num_muestra: numLm,
        ensayo_numero: enStrLm,
        etiqueta: numLm + ' - ' + enStrLm + ' muestra'
      });
    }
  }
  muestrasLm.sort(function (a, b) {
    var na = Number(a.ensayo_numero) || 0;
    var nb = Number(b.ensayo_numero) || 0;
    if (na !== nb) return na - nb;
    return String(a.num_muestra).localeCompare(String(b.num_muestra));
  });
  return { ok: true, fecha: fechaLm, muestras: muestrasLm };
}

/** Solo lectura: Hoja 1 o Hoja 3 donde exista fecha+ensayo (sin migrar ni escribir encabezados). */
function encontrarHojaRegistroFechaEnsayo_(ss, fechaNorm, ensayoNorm) {
  var hojas = hojasRegistroNumMuestra_(ss);
  for (var i = 0; i < hojas.length; i++) {
    if (contarFilasFechaEnsayoEnHoja_(hojas[i], fechaNorm, ensayoNorm) > 0) return hojas[i];
  }
  return null;
}

/** GET rápido Packing/campo: detalle por fecha + ensayo (batch read, H1 o H3). */
function obtenerDetalleRegistroCampoPacking_(ss, fechaRaw, ensayoRaw) {
  var fecha = formatFechaPacking(fechaRaw) || String(fechaRaw || '').trim();
  var enNorm = normalizarEnsayoNumeroGs_(ensayoRaw);
  if (!fecha || !enNorm) {
    return { ok: false, error: 'Faltan parámetros: fecha y ensayo_numero', data: null };
  }
  var sheet = encontrarHojaRegistroFechaEnsayo_(ss, fecha, enNorm);
  if (!sheet) {
    return { ok: false, error: 'No hay registro para esa fecha y ensayo', data: null };
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { ok: false, error: 'No hay registro para esa fecha y ensayo', data: null };
  }
  var numFilasData = lastRow - 1;
  var idxNumRow = indiceColumnaNumMuestraHoja1_(sheet);
  var baseCols = Math.max(15, idxNumRow + 1, IDX_COL_PESO_DESPACHO + 1);
  var data = sheet.getRange(2, 1, numFilasData, baseCols).getValues();
  var c5NumCols = getC5FlatHeaders().length;
  var packBlock = sheet.getRange(2, PACKING_START_COL, numFilasData, PACKING_COLS).getValues();
  var tkBlock = sheet.getRange(2, THERMOKING_START_COL, numFilasData, THERMOKING_COLS).getValues();
  var c5Block = sheet.getRange(2, C5_START_COL, numFilasData, c5NumCols).getValues();

  var row = null;
  var filaEnSheet = null;
  var numFilas = 0;
  var filasPackingRegistradas = 0;
  var despachoPorFila = [];
  var tienePacking = false;
  var tieneRecepcionC5 = false;
  var tieneThermoKing = false;

  for (var k = 0; k < data.length; k++) {
    var r = data[k];
    var rowFechaStr = formatFechaPacking(r[0]);
    var rowEnStr = normalizarEnsayoNumeroGs_(r[13]);
    if (rowFechaStr !== fecha || rowEnStr !== enNorm) continue;
    if (row == null) {
      row = r;
      filaEnSheet = 2 + k;
    }
    numFilas++;
    var desp = r[IDX_COL_PESO_DESPACHO];
    var numDesp = (desp !== null && desp !== undefined && String(desp).trim() !== '')
      ? parseFloat(String(desp).replace(',', '.'))
      : NaN;
    despachoPorFila.push(!isNaN(numDesp) ? numDesp : null);
    var packRow = packBlock[k] || [];
    if (rowHasPackingData_(packRow)) {
      tienePacking = true;
      filasPackingRegistradas++;
    }
    if (c5Block[k] && rowHasAnyNonEmpty_(c5Block[k])) tieneRecepcionC5 = true;
    if (tkBlock[k] && rowHasAnyNonEmpty_(tkBlock[k])) tieneThermoKing = true;
  }

  if (!row) {
    return { ok: false, error: 'No hay registro para esa fecha y ensayo', data: null };
  }

  var nClamshellRaw = row[14];
  var maxClamshell = 0;
  if (nClamshellRaw !== null && nClamshellRaw !== undefined && String(nClamshellRaw).trim() !== '') {
    var nCl = parseInt(String(nClamshellRaw).trim(), 10);
    if (!isNaN(nCl) && nCl > 0) maxClamshell = nCl;
  }
  if (numFilas > 0 && (maxClamshell <= 0 || maxClamshell < numFilas)) {
    maxClamshell = numFilas;
  }
  var despachoRaw = row[IDX_COL_PESO_DESPACHO];
  var despachoGramos = null;
  if (despachoRaw !== null && despachoRaw !== undefined && String(despachoRaw).trim() !== '') {
    var numDesp2 = parseFloat(String(despachoRaw).replace(',', '.'));
    if (!isNaN(numDesp2)) despachoGramos = numDesp2;
  }

  return {
    ok: true,
    data: {
      fila: filaEnSheet,
      numFilas: numFilas,
      FILAS_REGISTRADAS: numFilas,
      FILAS_TOTAL_CAMPO: numFilas,
      FILAS_PACKING_REGISTRADAS: filasPackingRegistradas,
      MAX_CLAMSHELL: maxClamshell,
      N_CLAMSHELL: (nClamshellRaw !== null && nClamshellRaw !== undefined) ? String(nClamshellRaw).trim() : '',
      puede_registrar_mas: maxClamshell > 0 ? (filasPackingRegistradas < maxClamshell) : true,
      tienePacking: tienePacking,
      tieneRecepcionC5: tieneRecepcionC5,
      tieneThermoKing: tieneThermoKing,
      despachoPorFila: despachoPorFila,
      DESPACHO_ACOPIO: despachoGramos,
      despacho_acopio_gramos: despachoGramos,
      ENSAYO_NOMBRE: row[1],
      NUM_MUESTRA: (row.length > idxNumRow && row[idxNumRow] != null && row[idxNumRow] !== undefined)
        ? String(row[idxNumRow]).trim()
        : '',
      RESPONSABLE: row[3],
      ENSAYO_NUMERO: row[13],
      TRAZ_ETAPA: row[7],
      TRAZ_CAMPO: row[8],
      TRAZ_LIBRE: row[9],
      VARIEDAD: row[10],
      PLACA_VEHICULO: row[12],
      FUNDO: row[6],
      GUIA_REMISION: row[11]
    }
  };
}

function doGet(e) {
  var result = { ok: false, data: null, error: null, fechas: null, ensayos: null };
  try {
    var params = e && e.parameter ? e.parameter : {};
    var fechaParam = (params.fecha || '').toString().trim();
    var ensayoNumero = (params.ensayo_numero || '').toString().trim();
    var callback = (params.callback || '').toString().trim();
    if (!/^[a-zA-Z0-9_]+$/.test(callback)) callback = '';

    function returnOutput(obj) {
      if (callback) return outputJsonp(obj, callback);
      return outputJson(obj);
    }

    // Confirmación ultra-rápida por UID (usa ScriptProperties, sin escanear hoja).
    var existeUid = (params.existe_uid || '').toString().trim() === '1';
    var uidParam = (params.uid || '').toString().trim();
    var existeNumMuestraGlobal = (params.existe_num_muestra_global || '').toString().trim() === '1';
    var numMuestraParam = (params.num_muestra || '').toString().trim();
    if (existeUid) {
      if (!uidParam) {
        result.error = 'Falta parámetro: uid';
        return returnOutput(result);
      }
      var props = PropertiesService.getScriptProperties();
      var keyUid = "mtpp_uid_" + uidParam;
      result.ok = true;
      result.existe = (props.getProperty(keyUid) === "1");
      result.uid = uidParam;
      return returnOutput(result);
    }

    // Siguiente NUM_MUESTRA: max(Hoja1+Hoja3, watermark monotónico) + 1 (borrar filas no retrocede).
    var proximoNumMuestra = (params.proximo_num_muestra || '').toString().trim() === '1';
    if (proximoNumMuestra) {
      var ssPm = SpreadsheetApp.getActiveSpreadsheet();
      var pm = resolverProximoNumMuestraJsonGlobal_(ssPm, true);
      result.ok = true;
      result.max_en_hoja = pm.max_en_hoja;
      result.ultimo_num_muestra_celda = pm.ultimo_num_muestra_celda;
      result.ultimo_num_muestra_fila = pm.ultimo_num_muestra_fila;
      result.ultimo_num_muestra_en_hoja = pm.ultimo_num_muestra_en_hoja;
      result.max_digitos_columna = pm.max_digitos_columna;
      result.num_muestra_prefijo = pm.num_muestra_prefijo;
      result.proximo_num_muestra = pm.proximo_num_muestra;
      return returnOutput(result);
    }

    // Una sola lectura: próximo N° muestra + ensayos ya registrados en una fecha (bloqueo rápido).
    var estadoOperativo = (params.estado_operativo || '').toString().trim() === '1';
    if (estadoOperativo) {
      var ssOp = SpreadsheetApp.getActiveSpreadsheet();
      var pmOp = resolverProximoNumMuestraJsonGlobal_(ssOp, true);
      result.ok = true;
      result.max_en_hoja = pmOp.max_en_hoja;
      result.ultimo_num_muestra_celda = pmOp.ultimo_num_muestra_celda;
      result.ultimo_num_muestra_fila = pmOp.ultimo_num_muestra_fila;
      result.ultimo_num_muestra_en_hoja = pmOp.ultimo_num_muestra_en_hoja;
      result.max_digitos_columna = pmOp.max_digitos_columna;
      result.num_muestra_prefijo = pmOp.num_muestra_prefijo;
      result.proximo_num_muestra = pmOp.proximo_num_muestra;
      result.ensayos = [];
      var fechaOp = (params.fecha || '').toString().trim();
      if (fechaOp) {
        var fechaOpNorm = formatFechaPacking(fechaOp) || fechaOp;
        result.ensayos = ensayosRegistradosEnFechaGlobal_(ssOp, fechaOpNorm);
      }
      return returnOutput(result);
    }

    // Validación rápida para NUM_MUESTRA global (columna según encabezado NUM_MUESTRA).
    // Se atiende antes de otras lecturas para responder más rápido.
    if (existeNumMuestraGlobal) {
      if (!numMuestraParam) {
        result.error = 'Falta parámetro: num_muestra';
        return returnOutput(result);
      }
      var ssNm = SpreadsheetApp.getActiveSpreadsheet();
      var numMuestraBaseParam = normalizarNumMuestraClave(numMuestraParam);
      var dupNm = buscarDuplicadoNumMuestraGlobal_(ssNm, numMuestraBaseParam);
      result.ok = true;
      result.num_muestra = numMuestraBaseParam;
      if (dupNm) {
        result.existe = true;
        result.fecha = dupNm.fecha || '';
        result.ensayo_numero = dupNm.ensayo_numero || '';
      } else {
        result.existe = false;
      }
      return returnOutput(result);
    }

    // Packing — dropdown MUESTRA: todas las del día (Visual H1 + Acopio H3).
    var listadoMuestrasFechaEarly = (params.listado_muestras_fecha || '').toString().trim() === '1';
    if (listadoMuestrasFechaEarly) {
      if (!fechaParam) {
        result.error = 'Falta parámetro: fecha';
        return returnOutput(result);
      }
      var ssLm = SpreadsheetApp.getActiveSpreadsheet();
      var lmOut = listadoMuestrasPorFechaGlobal_(ssLm, fechaParam);
      result.ok = lmOut.ok;
      result.fecha = lmOut.fecha;
      result.muestras = lmOut.muestras;
      if (lmOut.error) result.error = lmOut.error;
      return returnOutput(result);
    }

    // Detalle campo/Packing por fecha + ensayo (ruta rápida; sin migrar ni leer toda la hoja).
    var pedidoDetalleCampo = fechaParam && ensayoNumero
      && (params.listado_registrados || '').toString().trim() !== '1'
      && (params.existe_registro || '').toString().trim() !== '1';
    if (pedidoDetalleCampo) {
      var ssDet = SpreadsheetApp.getActiveSpreadsheet();
      var detOut = obtenerDetalleRegistroCampoPacking_(ssDet, fechaParam, ensayoNumero);
      result.ok = detOut.ok;
      result.data = detOut.data;
      if (detOut.error) result.error = detOut.error;
      return returnOutput(result);
    }

    var ssGet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = resolverHojaRegistroPacking_(ssGet, params);
    migrarInsertarHoraRegistroPacking_(sheet);
    var lastRow = sheet.getLastRow();
    var listadoReg = (params.listado_registrados || '').toString().trim() === '1';
    var soloFechas = !fechaParam && !ensayoNumero;
    var soloEnsayosPorFecha = !!(fechaParam && !ensayoNumero);
    if (lastRow < 2 && !listadoReg && !soloFechas && !soloEnsayosPorFecha) {
      result.error = 'No hay datos en la hoja';
      return returnOutput(result);
    }

    var idxNumRow = indiceColumnaNumMuestraHoja1_(sheet);
    var dataColW = Math.max(20, idxNumRow + 1, NUM_COLS_REGISTRO, PACKING_START_COL + PACKING_COLS - 1);
    var data = (lastRow >= 2) ? sheet.getRange(2, 1, lastRow, dataColW).getValues() : [];

    function formatFecha(val) {
      if (val === null || val === undefined || val === '') return '';
      if (val instanceof Date) return Utilities.formatDate(val, "GMT", "yyyy-MM-dd");
      var s = String(val).trim();
      if (!s) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      var d = null;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        var parts = s.split('/');
        var day = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1;
        var year = parseInt(parts[2], 10);
        if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          d = new Date(year, month, day);
        }
      } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
        var parts2 = s.split('-');
        day = parseInt(parts2[0], 10);
        month = parseInt(parts2[1], 10) - 1;
        year = parseInt(parts2[2], 10);
        if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          d = new Date(year, month, day);
        }
      } else if (s.indexOf('GMT') >= 0 || /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.test(s)) {
        d = new Date(s);
      }
      if (d && !isNaN(d.getTime())) return Utilities.formatDate(d, "GMT", "yyyy-MM-dd");
      return s;
    }
    function tipoDatoDesdeFlags_(tieneCampo, tienePacking) {
      if (tieneCampo && tienePacking) return 'ambos';
      if (tienePacking) return 'packing';
      return 'campo';
    }
    var fecha = (fechaParam && formatFecha(fechaParam)) ? formatFecha(fechaParam) : fechaParam;

    function fechasHistorialDefecto_() {
      var tz = Session.getScriptTimeZone() || 'America/Lima';
      var now = new Date();
      var hoy = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
      var ayer = Utilities.formatDate(new Date(now.getTime() - 86400000), tz, 'yyyy-MM-dd');
      return { desde: ayer, hasta: hoy };
    }
    function normalizarFechaParamHistorial_(val) {
      var s = (val != null && val !== '') ? String(val).trim() : '';
      if (!s) return '';
      return formatFecha(s) || s;
    }
    function fechaEnRangoHistorial_(f, desde, hasta) {
      if (!f) return false;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    }

    if (listadoReg) {
      var rangoHist = fechasHistorialDefecto_();
      var fechaDesdeHist = normalizarFechaParamHistorial_(params.fecha_desde) || rangoHist.desde;
      var fechaHastaHist = normalizarFechaParamHistorial_(params.fecha_hasta) || rangoHist.hasta;
      if (fechaDesdeHist && fechaHastaHist && fechaDesdeHist > fechaHastaHist) {
        var tmpHist = fechaDesdeHist;
        fechaDesdeHist = fechaHastaHist;
        fechaHastaHist = tmpHist;
      }
      var registrados = [];
      var idxHoraReg = NUM_COLS_REGISTRO - 1;
      var idxPackStart = PACKING_START_COL - 1;
      var hojasHist = hojasRegistroConDatos_(ssGet);
      for (var hhi = 0; hhi < hojasHist.length; hhi++) {
        var shHist = hojasHist[hhi];
        migrarInsertarHoraRegistroPacking_(shHist);
        var lrHist = shHist.getLastRow();
        if (lrHist < 2) continue;
        var idxNumHist = indiceColumnaNumMuestraHoja1_(shHist);
        var wHist = Math.max(20, idxNumHist + 1, NUM_COLS_REGISTRO, PACKING_START_COL + PACKING_COLS - 1);
        var dataHist = shHist.getRange(2, 1, lrHist, wHist).getValues();
        for (var i = 0; i < dataHist.length; i++) {
        var r = dataHist[i];
        var f = formatFecha(r[0]);
        if (!fechaEnRangoHistorial_(f, fechaDesdeHist, fechaHastaHist)) continue;
        var en = r[13];
        var enStr = (en !== null && en !== undefined && en !== '') ? (Number(en) === Math.floor(Number(en)) ? String(Number(en)) : String(en).trim()) : '';
        var nom = (r[1] != null && r[1] !== undefined && String(r[1]).trim() !== '') ? String(r[1]).trim() : ('Ensayo ' + enStr);
        var numMuestra = (r.length > idxNumHist && r[idxNumHist] != null && r[idxNumHist] !== undefined) ? String(r[idxNumHist]).trim() : '';
        var nClamshell = (r[14] != null && r[14] !== undefined) ? String(r[14]).trim() : '';
        if (!f || enStr === '') continue;
        var horaRegistro = (r.length > idxHoraReg) ? formatHoraRegistro_(r[idxHoraReg]) : '';
        var packingSlice = [];
        if (r.length > idxPackStart) {
          var packEnd = Math.min(r.length, idxPackStart + PACKING_COLS);
          packingSlice = r.slice(idxPackStart, packEnd);
        }
        var tienePacking = rowHasPackingData_(packingSlice);
        var tieneCampo = !!(numMuestra || nClamshell || rowHasAnyNonEmpty_(r.slice(2, Math.min(r.length, idxHoraReg))));
        registrados.push({
          fecha: f,
          ensayo_numero: enStr,
          ensayo_nombre: nom,
          num_muestra: numMuestra,
          n_clamshell: nClamshell,
          hora_registro: horaRegistro,
          tiene_campo: tieneCampo,
          tiene_packing: tienePacking,
          tipo_dato: tipoDatoDesdeFlags_(tieneCampo, tienePacking)
        });
        }
      }
      result.ok = true;
      result.registrados = registrados;
      result.fecha_desde = fechaDesdeHist;
      result.fecha_hasta = fechaHastaHist;
      return returnOutput(result);
    }

    if (soloFechas) {
      var fechasSet = {};
      var hojasF = hojasRegistroConDatos_(ssGet);
      for (var hfi = 0; hfi < hojasF.length; hfi++) {
        var shF = hojasF[hfi];
        var lrF = shF.getLastRow();
        if (lrF < 2) continue;
        var dataF = shF.getRange(2, 1, lrF, 14).getValues();
        for (var i = 0; i < dataF.length; i++) {
          var f = formatFecha(dataF[i][0]);
          if (f) fechasSet[f] = true;
        }
      }
      var fechasList = Object.keys(fechasSet).sort().reverse();
      result.ok = true;
      result.fechas = fechasList;
      return returnOutput(result);
    }

    if (fecha && !ensayoNumero) {
      var c5NumColsLista = getC5FlatHeaders().length;
      var ensayosInfo = {};
      var hojasEns = hojasRegistroConDatos_(ssGet);
      for (var hei = 0; hei < hojasEns.length; hei++) {
        var shEns = hojasEns[hei];
        migrarInsertarHoraRegistroPacking_(shEns);
        var lrEns = shEns.getLastRow();
        if (lrEns < 2) continue;
        var dataEns = shEns.getRange(2, 1, lrEns, 14).getValues();
        var packingBlock = shEns.getRange(2, PACKING_START_COL, lrEns, PACKING_COLS).getValues();
        var tkBlock = shEns.getRange(2, THERMOKING_START_COL, lrEns, THERMOKING_COLS).getValues();
        var c5Block = shEns.getRange(2, C5_START_COL, lrEns, c5NumColsLista).getValues();
        for (var j = 0; j < dataEns.length; j++) {
          var rowFechaStr = formatFecha(dataEns[j][0]);
          if (rowFechaStr === fecha) {
            var en = String(dataEns[j][13] || '').trim();
            if (en) {
              if (!ensayosInfo[en]) ensayosInfo[en] = { tieneVisual: false, tienePacking: false, tieneRecepcionC5: false, tieneThermoKing: false };
              ensayosInfo[en].tieneVisual = true;
              if (packingBlock[j] && rowHasAnyNonEmpty_(packingBlock[j])) ensayosInfo[en].tienePacking = true;
              if (c5Block[j] && rowHasAnyNonEmpty_(c5Block[j])) ensayosInfo[en].tieneRecepcionC5 = true;
              if (tkBlock[j] && rowHasAnyNonEmpty_(tkBlock[j])) ensayosInfo[en].tieneThermoKing = true;
            }
          }
        }
      }
      var ensayosList = Object.keys(ensayosInfo).sort();
      result.ok = true;
      result.ensayos = ensayosList;
      result.ensayosConVisual = {};
      result.ensayosConPacking = {};
      result.ensayosConC5 = {};
      result.ensayosConThermoKing = {};
      ensayosList.forEach(function (e) { result.ensayosConVisual[e] = ensayosInfo[e].tieneVisual; });
      ensayosList.forEach(function (e) { result.ensayosConPacking[e] = ensayosInfo[e].tienePacking; });
      ensayosList.forEach(function (e) { result.ensayosConC5[e] = ensayosInfo[e].tieneRecepcionC5; });
      ensayosList.forEach(function (e) { result.ensayosConThermoKing[e] = ensayosInfo[e].tieneThermoKing; });
      return returnOutput(result);
    }

    var existeRegistro = (params.existe_registro || '').toString().trim() === '1';
    if (existeRegistro && fecha && ensayoNumero) {
      var enNorm = ensayoNumero;
      var numEn = Number(ensayoNumero);
      if (!isNaN(numEn) && numEn === Math.floor(numEn)) enNorm = String(numEn);
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        var rowFechaStr = formatFecha(r[0]);
        var rowEn = r[13];
        var rowEnStr = (rowEn !== null && rowEn !== undefined) ? (Number(rowEn) === Math.floor(Number(rowEn)) ? String(Number(rowEn)) : String(rowEn).trim()) : '';
        if (rowFechaStr === fecha && rowEnStr === enNorm) {
          result.ok = true;
          result.existe = true;
          result.ensayo_numero = enNorm;
          return returnOutput(result);
        }
      }
      result.ok = true;
      result.existe = false;
      return returnOutput(result);
    }

    if (!fecha || !ensayoNumero) {
      result.error = 'Faltan parámetros: fecha y ensayo_numero';
      return returnOutput(result);
    }

    var enNorm = (ensayoNumero !== null && ensayoNumero !== undefined && String(ensayoNumero).trim() !== '') ? (function () {
      var n = Number(ensayoNumero);
      return (!isNaN(n) && n === Math.floor(n)) ? String(n) : String(ensayoNumero).trim();
    })() : '';

    var row = null;
    var filaEnSheet = null;
    var numFilas = 0;
    var filasPackingRegistradas = 0;
    var despachoPorFila = [];
    var tienePacking = false;
    var tieneRecepcionC5 = false;
    var tieneThermoKing = false;
    var c5NumColsDetalle = getC5FlatHeaders().length;
    for (var k = 0; k < data.length; k++) {
      var r = data[k];
      var rowFechaStr = formatFecha(r[0]);
      var rowEn = r[13];
      var rowEnStr = (rowEn !== null && rowEn !== undefined && rowEn !== '') ? (function () {
        var n = Number(rowEn);
        return (!isNaN(n) && n === Math.floor(n)) ? String(n) : String(rowEn).trim();
      })() : '';
      if (rowFechaStr === fecha && rowEnStr === enNorm) {
        if (row == null) {
          row = r;
          filaEnSheet = 2 + k;
        }
        numFilas++;
        var desp = r[IDX_COL_PESO_DESPACHO];
        var numDesp = (desp !== null && desp !== undefined && String(desp).trim() !== '') ? parseFloat(String(desp).replace(',', '.')) : NaN;
        despachoPorFila.push(!isNaN(numDesp) ? numDesp : null);
        var filaSheetK = 2 + k;
        var filaTienePacking = rangeRowHasPackingData_(sheet, filaSheetK, PACKING_START_COL, PACKING_COLS);
        if (filaTienePacking) {
          tienePacking = true;
          filasPackingRegistradas++;
        }
        if (rangeRowHasAnyValue_(sheet, filaSheetK, C5_START_COL, c5NumColsDetalle)) tieneRecepcionC5 = true;
        if (rangeRowHasAnyValue_(sheet, filaSheetK, THERMOKING_START_COL, THERMOKING_COLS)) tieneThermoKing = true;
      }
    }

    if (!row) {
      result.error = 'No hay registro para esa fecha y ensayo';
      return returnOutput(result);
    }

    var nClamshellRaw = row[14];
    var maxClamshell = 0;
    if (nClamshellRaw !== null && nClamshellRaw !== undefined && String(nClamshellRaw).trim() !== '') {
      var nCl = parseInt(String(nClamshellRaw).trim(), 10);
      if (!isNaN(nCl) && nCl > 0) maxClamshell = nCl;
    }
    if (numFilas > 0 && (maxClamshell <= 0 || maxClamshell < numFilas)) {
      maxClamshell = numFilas;
    }
    var despachoRaw = row[IDX_COL_PESO_DESPACHO];
    var despachoGramos = null;
    if (despachoRaw !== null && despachoRaw !== undefined && String(despachoRaw).trim() !== '') {
      var numDesp = parseFloat(String(despachoRaw).replace(',', '.'));
      if (!isNaN(numDesp)) despachoGramos = numDesp;
    }

    result.ok = true;
    result.data = {
      fila: filaEnSheet,
      numFilas: numFilas,
      FILAS_REGISTRADAS: numFilas,
      FILAS_TOTAL_CAMPO: numFilas,
      FILAS_PACKING_REGISTRADAS: filasPackingRegistradas,
      MAX_CLAMSHELL: maxClamshell,
      N_CLAMSHELL: (nClamshellRaw !== null && nClamshellRaw !== undefined) ? String(nClamshellRaw).trim() : '',
      puede_registrar_mas: maxClamshell > 0 ? (filasPackingRegistradas < maxClamshell) : true,
      tienePacking: tienePacking,
      tieneRecepcionC5: tieneRecepcionC5,
      tieneThermoKing: tieneThermoKing,
      despachoPorFila: despachoPorFila,
      DESPACHO_ACOPIO: despachoGramos,
      despacho_acopio_gramos: despachoGramos,
      ENSAYO_NOMBRE: row[1],
      NUM_MUESTRA: (row.length > idxNumRow && row[idxNumRow] != null && row[idxNumRow] !== undefined) ? String(row[idxNumRow]).trim() : '',
      RESPONSABLE: row[3],
      ENSAYO_NUMERO: row[13],
      TRAZ_ETAPA: row[7],
      TRAZ_CAMPO: row[8],
      TRAZ_LIBRE: row[9],
      VARIEDAD: row[10],
      PLACA_VEHICULO: row[12],
      FUNDO: row[6],
      GUIA_REMISION: row[11]
    };
    return returnOutput(result);
  } catch (err) {
    result.error = err.toString();
    return returnOutput(result);
  }
}

function outputJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function outputJsonp(obj, callbackName) {
  var body = callbackName + '(' + JSON.stringify(obj) + ')';
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
