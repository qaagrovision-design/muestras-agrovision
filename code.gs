/**
 * Google Apps Script - MTTP Arándano
 * Recibe datos del formulario y los escribe en la hoja activa.
 * Hoja 1: 48 cols — orden = formulario (… OBSERVACION, OBSERVACION_FORMATO, HORA_REGISTRO); packing desde col 49.
 *
 * ANTI-DUPLICADOS: UID + clave de fila normalizada.
 *
 * --- PACKING (cols 49–89) ---
 */
var PACKING_START_COL = 49;
var PACKING_META_COLS = 4;
var PACKING_DATA_COLS = 37;
var PACKING_COLS = PACKING_META_COLS + PACKING_DATA_COLS;
var THERMOKING_START_COL = PACKING_START_COL + PACKING_COLS; // 90
var THERMOKING_COLS = 39;
var C5_START_COL = THERMOKING_START_COL + THERMOKING_COLS; // 128

/** 48 columnas Hoja 1 (registro): un solo orden; debe coincidir con app.js construirFilaBaseRegistro. */
var NUM_COLS_REGISTRO = 48;

/** Máximo NUM_MUESTRA “consumido” en el tiempo; solo sube (borrar filas en hoja no retrocede la secuencia). */
var NUM_MUESTRA_WATERMARK_KEY = 'mtpp_num_muestra_watermark_v1';

function getRegistroHeadersHoja1_() {
  return [
    "FECHA", "ENSAYO_NOMBRE", "NUM_MUESTRA", "RESPONSABLE", "DIAS_PRECOSECHA", "HORA_INICIO_GENERAL", "FUNDO",
    "TRAZ_ETAPA", "TRAZ_CAMPO", "TRAZ_LIBRE", "VARIEDAD", "GUIA_REMISION", "PLACA_VEHICULO", "ENSAYO_NUMERO", "N_CLAMSHELL", "N_JARRA",
    "PESO_1", "PESO_2", "LLEGADA_ACOPIO", "DESPACHO_ACOPIO",
    "TEMP_MUE_INICIO_AMB", "TEMP_MUE_INICIO_PUL", "TEMP_MUE_TERMINO_AMB", "TEMP_MUE_TERMINO_PUL",
    "TEMP_MUE_LLEGADA_AMB", "TEMP_MUE_LLEGADA_PUL", "TEMP_MUE_DESPACHO_AMB", "TEMP_MUE_DESPACHO_PUL",
    "TIEMPO_INICIO_COSECHA", "TIEMPO_PERDIDA_PESO", "TIEMPO_TERMINO_COSECHA", "TIEMPO_LLEGADA_ACOPIO", "TIEMPO_DESPACHO_ACOPIO",
    "HUMEDAD_INICIO", "HUMEDAD_TERMINO", "HUMEDAD_LLEGADA", "HUMEDAD_DESPACHO",
    "PRESION_AMB_INICIO", "PRESION_AMB_TERMINO", "PRESION_AMB_LLEGADA", "PRESION_AMB_DESPACHO",
    "PRESION_FRUTA_INICIO", "PRESION_FRUTA_TERMINO", "PRESION_FRUTA_LLEGADA", "PRESION_FRUTA_DESPACHO",
    "OBSERVACION", "OBSERVACION_FORMATO", "HORA_REGISTRO"
  ];
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
  // Esquema actual: ENSAYO_NOMBRE + GUIA_REMISION + OBSERVACION_FORMATO / HORA_REGISTRO tras OBSERVACION.
  if (b1 === "ENSAYO_NOMBRE" && l1 === "GUIA_REMISION" && h46 === "OBSERVACION" && h47 === "OBSERVACION_FORMATO" && h48 === "HORA_REGISTRO") {
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

/** Solo dígitos en NUM_MUESTRA; 0 si no aplica. Acepta número de celda (hoja). */
function parseNumMuestraDigitosGs_(v) {
  if (typeof v === 'number' && !isNaN(v) && isFinite(v) && v >= 0) {
    var fl = Math.floor(v);
    if (Math.abs(v - fl) < 1e-6) return fl;
  }
  var s = (v != null && v !== undefined) ? String(v).trim() : '';
  if (!/^\d+$/.test(s)) return 0;
  var n = parseInt(s, 10);
  return (isNaN(n) || n < 0) ? 0 : n;
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
  if (soloDesdeHoja) {
    var nextSolo = baseUltimo + 1;
    var nextStrSolo = String(nextSolo);
    if (nextStrSolo.length < 4) nextStrSolo = String(nextSolo).padStart(4, '0');
    return {
      max_en_hoja: baseUltimo,
      ultimo_num_muestra_celda: ultimoCelda.valorTexto,
      ultimo_num_muestra_fila: ultimoCelda.fila,
      ultimo_num_muestra_en_hoja: baseUltimo,
      max_digitos_columna: sheetMax,
      proximo_num_muestra: nextStrSolo
    };
  }
  var wm = leerWatermarkNumMuestra_();
  var M = Math.max(sheetMax, wm);
  fusionarWatermarkNumMuestra_(M);
  var nextN = M + 1;
  var nextStr = String(nextN);
  if (nextStr.length < 4) nextStr = String(nextN).padStart(4, '0');
  return { max_en_hoja: M, proximo_num_muestra: nextStr };
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
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
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

    if (data.mode === 'packing') {
      var packingResult = doPostPacking(sheet, data);
      return out(packingResult);
    }
    if (data.mode === 'recepcion-c5' || data.mode === 'recepcion_c5') {
      var c5Result = doPostRecepcionC5(sheet, data);
      return out(c5Result);
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

    asegurarEncabezadoHoja1Registro_(sheet);

    const NUM_COLS = NUM_COLS_REGISTRO;
    /** Fila expandida 54: pos. 0–19 + 20–25 (Hoja2) + 26–53 → 48 col Hoja1. */

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

    /** 54 celdas: 20 inicio Hoja1 + 6 (Hoja2) + 28 cierre → 48 col Hoja1. */
    function toRowRegistro(row) {
      var minLen = 54;
      while (row.length < minLen) row.push("");
      var a = row.slice(0, 20).concat(row.slice(26, 54));
      return a.slice(0, NUM_COLS).map(celdaAString);
    }

    function rowHoja2(fila, rowOriginal) {
      var c = celdaAString;
      var out = [c(fila[0]), c(fila[13]), c(fila[15]), '', '', '', '', '', ''];
      /** Hueco 20-25: Cosecha + Trasvasado desde el panel de jarras (POST 54 celdas). */
      if (rowOriginal && rowOriginal.length >= 26) {
        out[3] = c(rowOriginal[20]);
        out[4] = c(rowOriginal[21]);
        out[5] = c(rowOriginal[22]);
        out[6] = c(rowOriginal[23]);
        out[7] = c(rowOriginal[24]);
        out[8] = c(rowOriginal[25]);
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

    var minExpanded = 54;
    var nuevasFilas = [];
    var filasHoja2 = [];
    rows.forEach(function(row) {
      var fila = row.length >= minExpanded ? toRowRegistro(row) : (function() { while (row.length < NUM_COLS) row.push(""); return row.slice(0, NUM_COLS).map(celdaAString); })();
      var key = buildKey(fila);
      if (existingKeys[key]) return;
      existingKeys[key] = true;
      filasHoja2.push(rowHoja2(fila, row.length >= minExpanded ? row : null));
      // Mantener criterio alineado al front:
      // UI solo exige PESO_1 para guardar clamshell; PESO_2 y llegada/despacho pueden ir vacíos al inicio.
      // Índices: 14=N_CLAMSHELL, 16=PESO_1.
      if (!esCero(fila[14]) && !esCero(fila[16])) nuevasFilas.push(fila);
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
      // NUM_MUESTRA (col 3) debe mantenerse como texto para conservar ceros a la izquierda (ej: 0001).
      sheet.getRange(startRow, 3, numRows, 1).setNumberFormat('@');
      sheet.getRange(startRow, 1, numRows, NUM_COLS).setValues(nuevasFilas);
      for (var wmi = 0; wmi < nuevasFilas.length; wmi++) {
        fusionarWatermarkNumMuestra_(parseNumMuestraDigitosGs_(nuevasFilas[wmi][2]));
      }
    }
    if (filasHoja2.length > 0) {
      var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheets()[1];
      if (sheet2) {
        if (sheet2.getLastRow() === 0) {
          sheet2.appendRow(["FECHA", "ENSAYO_NUMERO", "N_JARRA", "INICIO_C", "TERMINO_C", "MIN_C", "INICIO_T", "TERMINO_T", "MIN_T"]);
        }
        var startRow2 = sheet2.getLastRow() + 1;
        sheet2.getRange(startRow2, 1, filasHoja2.length, 9).setValues(filasHoja2);
      }
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

    var dataRows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
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
          var rowMerge = packingRows[pm];
          var filaHojaMerge = rowIndices[filaIdxMerge];
          var valoresMerge = [fechaInspeccion, responsable, horaRecepcion, nViaje];
          if (Array.isArray(rowMerge)) {
            for (var jm = 0; jm < PACKING_DATA_COLS; jm++) {
              var vMerge = (jm < rowMerge.length && rowMerge[jm] != null && rowMerge[jm] !== '') ? rowMerge[jm] : '';
              if (jm === PACKING_DATA_COLS - 1 && !vMerge) vMerge = formatHoraRegistro_(new Date());
              valoresMerge.push(vMerge);
            }
          } else {
            for (var jm2 = 0; jm2 < PACKING_DATA_COLS; jm2++) valoresMerge.push('');
          }
          sheet.getRange(filaHojaMerge, startColMerge, 1, colsPorFilaMerge).setValues([valoresMerge]);
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
        var row = packingRows[i];
        var filaHoja = rowIndices[filaIdx];
        var valores = [fechaInspeccion, responsable, horaRecepcion, nViaje];
        if (Array.isArray(row)) {
          for (var j = 0; j < PACKING_DATA_COLS; j++) {
            var vPack = (j < row.length && row[j] != null && row[j] !== '') ? row[j] : '';
            if (j === PACKING_DATA_COLS - 1 && !vPack) vPack = formatHoraRegistro_(new Date());
            valores.push(vPack);
          }
        } else {
          for (var j = 0; j < PACKING_DATA_COLS; j++) valores.push('');
        }
        sheet.getRange(filaHoja, startCol, 1, COLS_POR_FILA).setValues([valores]);
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

    var dataRows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
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

    // Siguiente NUM_MUESTRA: max(hoja, watermark monotónico) + 1 (borrar filas no retrocede).
    var proximoNumMuestra = (params.proximo_num_muestra || '').toString().trim() === '1';
    if (proximoNumMuestra) {
      var sheetPm = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var pm = resolverProximoNumMuestraJson_(sheetPm, true);
      result.ok = true;
      result.max_en_hoja = pm.max_en_hoja;
      result.ultimo_num_muestra_celda = pm.ultimo_num_muestra_celda;
      result.ultimo_num_muestra_fila = pm.ultimo_num_muestra_fila;
      result.ultimo_num_muestra_en_hoja = pm.ultimo_num_muestra_en_hoja;
      result.max_digitos_columna = pm.max_digitos_columna;
      result.proximo_num_muestra = pm.proximo_num_muestra;
      return returnOutput(result);
    }

    // Una sola lectura: próximo N° muestra + ensayos ya registrados en una fecha (bloqueo rápido).
    var estadoOperativo = (params.estado_operativo || '').toString().trim() === '1';
    if (estadoOperativo) {
      var sheetOp = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var pmOp = resolverProximoNumMuestraJson_(sheetOp, true);
      result.ok = true;
      result.max_en_hoja = pmOp.max_en_hoja;
      result.ultimo_num_muestra_celda = pmOp.ultimo_num_muestra_celda;
      result.ultimo_num_muestra_fila = pmOp.ultimo_num_muestra_fila;
      result.ultimo_num_muestra_en_hoja = pmOp.ultimo_num_muestra_en_hoja;
      result.max_digitos_columna = pmOp.max_digitos_columna;
      result.proximo_num_muestra = pmOp.proximo_num_muestra;
      result.ensayos = [];
      var fechaOp = (params.fecha || '').toString().trim();
      if (fechaOp) {
        var fechaOpNorm = formatFechaPacking(fechaOp) || fechaOp;
        var lastRowOp = sheetOp.getLastRow();
        if (lastRowOp >= 2) {
          var dataOp = sheetOp.getRange(2, 1, lastRowOp, 14).getValues();
          var ensSetOp = {};
          for (var oi = 0; oi < dataOp.length; oi++) {
            var fOp = formatFechaPacking(dataOp[oi][0]);
            if (fOp !== fechaOpNorm) continue;
            var enOp = dataOp[oi][13];
            var enOpStr = (enOp !== null && enOp !== undefined && enOp !== '')
              ? (Number(enOp) === Math.floor(Number(enOp)) ? String(Number(enOp)) : String(enOp).trim())
              : '';
            if (enOpStr) ensSetOp[enOpStr] = true;
          }
          result.ensayos = Object.keys(ensSetOp).sort();
        }
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
      var sheetNm = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var lastRowNm = sheetNm.getLastRow();
      var numMuestraBaseParam = normalizarNumMuestraClave(numMuestraParam);
      if (lastRowNm < 2) {
        result.ok = true;
        result.existe = false;
        result.num_muestra = numMuestraBaseParam;
        return returnOutput(result);
      }
      var idxNm = indiceColumnaNumMuestraHoja1_(sheetNm);
      var numColsNm = Math.max(14, idxNm + 1, NUM_COLS_REGISTRO);
      var dataNm = sheetNm.getRange(2, 1, lastRowNm - 1, numColsNm).getValues();
      for (var ni = 0; ni < dataNm.length; ni++) {
        var nmBase = normalizarNumMuestraClave(dataNm[ni].length > idxNm ? dataNm[ni][idxNm] : '');
        if (nmBase && nmBase === numMuestraBaseParam) {
          var fNm = formatFechaPacking(dataNm[ni][0]);
          var enNm = dataNm[ni][13];
          var enNmStr = (enNm !== null && enNm !== undefined && enNm !== '') ? (Number(enNm) === Math.floor(Number(enNm)) ? String(Number(enNm)) : String(enNm).trim()) : '';
          result.ok = true;
          result.existe = true;
          result.num_muestra = numMuestraBaseParam;
          result.fecha = fNm || '';
          result.ensayo_numero = enNmStr;
          return returnOutput(result);
        }
      }
      result.ok = true;
      result.existe = false;
      result.num_muestra = numMuestraBaseParam;
      return returnOutput(result);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    migrarInsertarHoraRegistroPacking_(sheet);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      result.error = 'No hay datos en la hoja';
      return returnOutput(result);
    }

    var idxNumRow = indiceColumnaNumMuestraHoja1_(sheet);
    var dataColW = Math.max(20, idxNumRow + 1, NUM_COLS_REGISTRO, PACKING_START_COL + PACKING_COLS - 1);
    var data = sheet.getRange(2, 1, lastRow, dataColW).getValues();

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

    var listadoReg = (params.listado_registrados || '').toString().trim() === '1';
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
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        var f = formatFecha(r[0]);
        if (!fechaEnRangoHistorial_(f, fechaDesdeHist, fechaHastaHist)) continue;
        var en = r[13];
        var enStr = (en !== null && en !== undefined && en !== '') ? (Number(en) === Math.floor(Number(en)) ? String(Number(en)) : String(en).trim()) : '';
        var nom = (r[1] != null && r[1] !== undefined && String(r[1]).trim() !== '') ? String(r[1]).trim() : ('Ensayo ' + enStr);
        var numMuestra = (r.length > idxNumRow && r[idxNumRow] != null && r[idxNumRow] !== undefined) ? String(r[idxNumRow]).trim() : '';
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
      result.ok = true;
      result.registrados = registrados;
      result.fecha_desde = fechaDesdeHist;
      result.fecha_hasta = fechaHastaHist;
      return returnOutput(result);
    }

    var listadoMuestrasFecha = (params.listado_muestras_fecha || '').toString().trim() === '1';
    if (listadoMuestrasFecha) {
      if (!fechaParam) {
        result.error = 'Falta parámetro: fecha';
        return returnOutput(result);
      }
      var fechaLm = (fechaParam && formatFecha(fechaParam)) ? formatFecha(fechaParam) : fechaParam;
      var muestrasLm = [];
      var seenLm = {};
      for (var lmi = 0; lmi < data.length; lmi++) {
        var rl = data[lmi];
        var fl = formatFecha(rl[0]);
        if (fl !== fechaLm) continue;
        var enl = rl[13];
        var enStrLm = (enl !== null && enl !== undefined && enl !== '')
          ? (Number(enl) === Math.floor(Number(enl)) ? String(Number(enl)) : String(enl).trim())
          : '';
        var numLm = (rl.length > idxNumRow && rl[idxNumRow] != null && rl[idxNumRow] !== undefined)
          ? String(rl[idxNumRow]).trim()
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
      muestrasLm.sort(function (a, b) {
        var na = Number(a.ensayo_numero) || 0;
        var nb = Number(b.ensayo_numero) || 0;
        if (na !== nb) return na - nb;
        return String(a.num_muestra).localeCompare(String(b.num_muestra));
      });
      result.ok = true;
      result.fecha = fechaLm;
      result.muestras = muestrasLm;
      return returnOutput(result);
    }

    if (!fecha && !ensayoNumero) {
      var fechasSet = {};
      for (var i = 0; i < data.length; i++) {
        var f = formatFecha(data[i][0]);
        if (f) fechasSet[f] = true;
      }
      var fechasList = Object.keys(fechasSet).sort().reverse();
      result.ok = true;
      result.fechas = fechasList;
      return returnOutput(result);
    }

    if (fecha && !ensayoNumero) {
      var c5NumColsLista = getC5FlatHeaders().length;
      var packingBlock = (lastRow >= 2) ? sheet.getRange(2, PACKING_START_COL, lastRow, PACKING_COLS).getValues() : [];
      var tkBlock = (lastRow >= 2) ? sheet.getRange(2, THERMOKING_START_COL, lastRow, THERMOKING_COLS).getValues() : [];
      var c5Block = (lastRow >= 2) ? sheet.getRange(2, C5_START_COL, lastRow, c5NumColsLista).getValues() : [];
      var ensayosInfo = {};
      for (var j = 0; j < data.length; j++) {
        var rowFechaStr = formatFecha(data[j][0]);
        if (rowFechaStr === fecha) {
          var en = String(data[j][13] || '').trim();
          if (en) {
            if (!ensayosInfo[en]) ensayosInfo[en] = { tieneVisual: false, tienePacking: false, tieneRecepcionC5: false, tieneThermoKing: false };
            ensayosInfo[en].tieneVisual = true;
            if (packingBlock[j] && rowHasAnyNonEmpty_(packingBlock[j])) ensayosInfo[en].tienePacking = true;
            if (c5Block[j] && rowHasAnyNonEmpty_(c5Block[j])) ensayosInfo[en].tieneRecepcionC5 = true;
            if (tkBlock[j] && rowHasAnyNonEmpty_(tkBlock[j])) ensayosInfo[en].tieneThermoKing = true;
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
        var desp = r[19];
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
    var despachoRaw = row[19];
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
