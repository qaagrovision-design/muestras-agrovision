    /**
    * Google Apps Script - MTTP Arándano
    * Recibe datos del formulario y los escribe en la hoja activa.
    * VISUAL (índice 0): … + RC5 col FH (13 cols recepción).
    * ACOPIO (índice 2): … + RC5 col FJ (13 cols recepción).
    * PESO_DESPACHO_TK (límite peso RC5): CW Visual / CY Acopio (bloque MP-TK).
    * TIEMPOS V. / TIEMPOS A. = jarras. TK: mismos nombres legibles en fila 1 de VISUAL y ACOPIO.
    * NUM_MUESTRA: secuencia global única (max VISUAL + ACOPIO + watermark).
    *
    * ANTI-DUPLICADOS: UID + clave de fila normalizada.
    *
    * --- PACKING (cols 51–91) ---
    */
    var PACKING_START_COL_VISUAL = 50;
    var PACKING_START_COL_ACOPIO = 52;
    var PACKING_META_COLS = 4;
    var PACKING_DATA_COLS = 37;
    var PACKING_COLS = PACKING_META_COLS + PACKING_DATA_COLS;
    /** Índice 0-based en fila packing (meta+datos): PESO_SALIDA_PREFRIO. */
    var IDX_PACK_ROW_PESO_SALIDA_PREFRIO = PACKING_META_COLS + 9;
    var THERMOKING_META_COLS = 4;
    /** Datos por fila clamshell TK (incl. OBSERVACION + HORA_REGISTRO). */
    var THERMOKING_DATA_COLS = 36;
    var THERMOKING_COLS = THERMOKING_META_COLS + THERMOKING_DATA_COLS;
    /** Índice 0-based en fila TK plana: HORA_REGISTRO (después de OBSERVACION / col DX). */
    var IDX_HORA_REG_EN_TK_ROW = THERMOKING_COLS - 1;
    var IDX_OBS_EN_TK_ROW = THERMOKING_COLS - 2;

    /** Visual: 49 cols (+ TRAZ_ACOPIO). Acopio: 51 cols. */
    var NUM_COLS_REGISTRO_VISUAL = 49;
    var NUM_COLS_REGISTRO_ACOPIO = 51;
    /** HORA_REGISTRO bloque campo: VISUAL col AW (49), ACOPIO col AY (51). */
    var COL_HORA_REGISTRO_CAMPO_VISUAL = 49;
    var COL_HORA_REGISTRO_CAMPO_ACOPIO = 51;
    /** FUNDO col G (índice 6): flujo TK-2.0 / MP-TK / Packing RC5 solo para A9. */
    var FUNDO_VALOR_FLUJO_TK20 = 'A9';
    var IDX_REGISTRO_FUNDO = 6;

    function normalizarFundoClave_(v) {
      if (v === null || v === undefined) return '';
      return String(v).trim().toUpperCase();
    }

    function fundoHabilitaFlujoTk20_(fundo) {
      return normalizarFundoClave_(fundo) === FUNDO_VALOR_FLUJO_TK20;
    }

    function aplicarGateFundoFlujoTk20EnFlags_(flags, fundo) {
      var habilita = fundoHabilitaFlujoTk20_(fundo);
      flags.fundo_habilita_flujo_tk20 = habilita;
      if (!habilita) {
        flags.puede_continuar_packing_rc5 = false;
        flags.puede_continuar_thermoking = false;
        flags.puede_continuar_tk20 = false;
      }
      return flags;
    }

    function numColsRegistroEsAcopio_(esAcopio) {
      return esAcopio ? NUM_COLS_REGISTRO_ACOPIO : NUM_COLS_REGISTRO_VISUAL;
    }

    function packingStartColDesdeHoja_(ss, sheet) {
      return esHojaRegistroAcopio_(ss, sheet) ? PACKING_START_COL_ACOPIO : PACKING_START_COL_VISUAL;
    }

    function thermokingStartColDesdeHoja_(ss, sheet) {
      return packingStartColDesdeHoja_(ss, sheet) + PACKING_COLS;
    }

    var TK20_META_COLS = 4;
    /** Por fila clamshell: Llegada (14) + Traslado (14) + HORA_REGISTRO = 29. */
    var TK20_DATA_COLS = 29;
    var TK20_COLS = TK20_META_COLS + TK20_DATA_COLS;
    /** Índice 0-based en fila TK-2.0 plana: HORA_REGISTRO (última columna del bloque). */
    var IDX_HORA_REG_EN_TK20_ROW = TK20_COLS - 1;

    /** TK-2.0 justo después de MP-TK: Visual col 130, Acopio col 132. */
    function tk20StartColDesdeHoja_(ss, sheet) {
      return thermokingStartColDesdeHoja_(ss, sheet) + THERMOKING_COLS;
    }

    /** Packing RC5 tras TK-2.0: Visual col FH (164), Acopio col FJ (166). Solo recepción (13 cols). */
    var PACKING_RC5_META_COLS = 4;
    var PACKING_RC5_DATA_COLS = 9;
    var PACKING_RC5_COLS = PACKING_RC5_META_COLS + PACKING_RC5_DATA_COLS;
    var IDX_RC5_HORA_REG_EN_ROW = PACKING_RC5_COLS - 1;
    /** Índices en fila packing plana (37) que se guardan en RC5. */
    var PACKING_RC5_DATA_IDX_FROM_ROW = [0, 5, 10, 11, 20, 25, 30, 35, 36];

    function packingRc5StartColDesdeHoja_(ss, sheet) {
      return tk20StartColDesdeHoja_(ss, sheet) + TK20_COLS;
    }

    /** Índice 0-based PESO_DESPACHO_TK en fila TK plana (col CW Visual / CY Acopio). */
    var IDX_TK_PESO_DESPACHO_TK = THERMOKING_META_COLS + 7;

    function pesoDespachoTkDesdeTkRow_(tkRow) {
      if (!tkRow || tkRow.length <= IDX_TK_PESO_DESPACHO_TK) return null;
      var raw = tkRow[IDX_TK_PESO_DESPACHO_TK];
      if (raw === null || raw === undefined || String(raw).trim() === '') return null;
      var n = parseFloat(String(raw).replace(',', '.'));
      return (!isNaN(n) && n > 0) ? n : null;
    }

    /** Índice 0-based columna DESPACHO en fila registro. Visual U=20 (DESPACHO_ACOPIO), Acopio V=21 (PESO_5_DESPACHO_CAMPO). */
    function idxColPesoDespachoDesdeHoja_(ss, sheet) {
      return esHojaRegistroAcopio_(ss, sheet) ? 21 : 20;
    }

    function parseNClamshellRegistroGs_(v) {
      var n = parseInt(String(v == null ? '' : v).trim(), 10);
      return (!isNaN(n) && n >= 1) ? n : 0;
    }

    /**
    * Reordena valores capturados en orden de hoja → índice 0 = clamshell #1, #2, …
    * Así Packing/RC5 limitan peso recepción con la fila correcta aunque el sheet tenga huecos de orden.
    */
    function reordenarValoresPorNClamshellGs_(nClamsList, valores) {
      var listN = Array.isArray(nClamsList) ? nClamsList : [];
      var vals = Array.isArray(valores) ? valores : [];
      var maxN = 0;
      var i;
      for (i = 0; i < listN.length; i++) {
        if (listN[i] > maxN) maxN = listN[i];
      }
      if (maxN < vals.length) maxN = vals.length;
      if (maxN <= 0) return [];
      var out = [];
      for (i = 0; i < maxN; i++) out.push(null);
      for (i = 0; i < vals.length; i++) {
        var nc = listN[i] || 0;
        var idx = nc >= 1 ? nc - 1 : i;
        if (idx >= 0 && idx < maxN) out[idx] = vals[i];
      }
      return out;
    }

    function numColsRegistroDesdeHoja_(ss, sheet) {
      return esHojaRegistroAcopio_(ss, sheet) ? NUM_COLS_REGISTRO_ACOPIO : NUM_COLS_REGISTRO_VISUAL;
    }

    /** Columna 1-based HORA_REGISTRO del registro campo (AV Visual / AX Acopio). */
    function colHoraRegistroCampoDesdeHoja_(ss, sheet) {
      return esHojaRegistroAcopio_(ss, sheet) ? COL_HORA_REGISTRO_CAMPO_ACOPIO : COL_HORA_REGISTRO_CAMPO_VISUAL;
    }

    function registroPostExpandedLenEsAcopio_(esAcopio) {
      return numColsRegistroEsAcopio_(esAcopio) + 6;
    }
    /** Columnas 1-based VISUAL/ACOPIO: texto literal (ceros a la izquierda, 14/3 no debe ser fecha). */
    var COL_REGISTRO_NUM_MUESTRA = 3;
    var COL_REGISTRO_DIAS_PRECOSECHA = 5;
    var COL_REGISTRO_GUIA_REMISION = 12;
    /** Índices 0-based en fila registro (misma posición Visual y Acopio). */
    var IDX_REGISTRO_NUM_MUESTRA = 2;
    var IDX_REGISTRO_DIAS_PRECOSECHA = 4;
    var IDX_REGISTRO_GUIA_REMISION = 11;
    var IDX_REGISTRO_PLACA = 12;
    var IDX_REGISTRO_TRAZ_ACOPIO = 13;
    var IDX_REGISTRO_ENSAYO_NUMERO = 14;
    var IDX_REGISTRO_N_CLAMSHELL = 15;
    var IDX_REGISTRO_N_JARRA = 16;
    /**
    * POST expandido: índice donde van las 6 celdas de TIEMPOS (C/T) antes del resto del registro.
    * Visual: 21 (tras DESPACHO_ACOPIO, antes de temps). Acopio: 22 (tras PESO_5, antes de temps).
    */
    var REGISTRO_PRE_JARRA_COLS_VISUAL = 21;
    var REGISTRO_PRE_JARRA_COLS_ACOPIO = 22;
    /** @deprecated Preferir registroPreJarraColsEsAcopio_ — default Acopio por compat. */
    var REGISTRO_PRE_JARRA_COLS = REGISTRO_PRE_JARRA_COLS_ACOPIO;
    var REGISTRO_POST_EXPANDED_LEN = 57;

    function registroPreJarraColsEsAcopio_(esAcopio) {
      return esAcopio ? REGISTRO_PRE_JARRA_COLS_ACOPIO : REGISTRO_PRE_JARRA_COLS_VISUAL;
    }

    /** Máximo NUM_MUESTRA “consumido” en el tiempo; solo sube (borrar filas en hoja no retrocede la secuencia). */
    var NUM_MUESTRA_WATERMARK_KEY = 'mtpp_num_muestra_watermark_v1';

    /** Visual: VISUAL (0) + TIEMPOS V. (1). Acopio: ACOPIO (2) + TIEMPOS A. (3). */
    var SHEET_IDX_VISUAL_REGISTRO = 0;
    var SHEET_IDX_VISUAL_JARRAS = 1;
    var SHEET_IDX_ACOPIO_REGISTRO = 2;
    var SHEET_IDX_ACOPIO_JARRAS = 3;

    /** Nombres de pestañas en la planilla (orden = índice de hoja). */
    var SHEET_NOMBRES = ['VISUAL', 'TIEMPOS V.', 'ACOPIO', 'TIEMPOS A.'];

    function nombreHojaPorIndice_(idx) {
      if (idx >= 0 && idx < SHEET_NOMBRES.length) return SHEET_NOMBRES[idx];
      return 'Hoja ' + (idx + 1);
    }

    function getRegistroHeadersHoja1_() {
      return [
        "FECHA", "ENSAYO_NOMBRE", "NUM_MUESTRA", "RESPONSABLE", "DIAS_PRECOSECHA", "HORA_INICIO_GENERAL", "FUNDO",
        "TRAZ_ETAPA", "TRAZ_CAMPO", "TRAZ_TURNO", "VARIEDAD", "GUIA_REMISION", "PLACA_VEHICULO", "TRAZ_ACOPIO",
        "ENSAYO_NUMERO", "N_CLAMSHELL", "N_JARRA",
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

    /**
    * Hoja ACOPIO: 51 columnas — TRAZ_ACOPIO + 5 pesos + 6 tiempos (modal Acopio / PDF PE-F-QPH-305).
    */
    function getRegistroHeadersHoja3Acopio_() {
      return [
        "FECHA", "ENSAYO_NOMBRE", "NUM_MUESTRA", "RESPONSABLE", "DIAS_PRECOSECHA", "HORA_INICIO_GENERAL", "FUNDO",
        "TRAZ_ETAPA", "TRAZ_CAMPO", "TRAZ_TURNO", "VARIEDAD", "GUIA_REMISION_ACOPIO_CAMPO", "PLACA_VEHICULO", "TRAZ_ACOPIO",
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

    /** TIEMPOS V. (Visual) y TIEMPOS A. (Acopio): tiempos de llenado de jarras — mismos encabezados. */
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

    /** True si la hoja es ACOPIO (índice 2), no VISUAL. */
    function esHojaRegistroAcopio_(ss, sheet) {
      if (!ss || !sheet) return false;
      var sAc = obtenerHojaPorIndice_(ss, SHEET_IDX_ACOPIO_REGISTRO);
      return sheet.getSheetId() === sAc.getSheetId();
    }

    /** 'visual' | 'acopio' según la hoja donde está el registro. */
    function modoRegistroDesdeHoja_(ss, sheet) {
      return esHojaRegistroAcopio_(ss, sheet) ? 'acopio' : 'visual';
    }

    function metaHojaRegistro_(ss, sheet) {
      var esAc = esHojaRegistroAcopio_(ss, sheet);
      return {
        modo_registro: esAc ? 'acopio' : 'visual',
        hoja_registro: esAc ? SHEET_NOMBRES[SHEET_IDX_ACOPIO_REGISTRO] : SHEET_NOMBRES[SHEET_IDX_VISUAL_REGISTRO]
      };
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
        ss.insertSheet(nombreHojaPorIndice_(sheets.length));
        sheets = ss.getSheets();
      }
      var sh = sheets[idx];
      var nombreEsperado = nombreHojaPorIndice_(idx);
      if (nombreEsperado && sh.getName() !== nombreEsperado) {
        try {
          sh.setName(nombreEsperado);
        } catch (eName) { /* nombre ya usado u otro conflicto */ }
      }
      return sh;
    }

    /** Renombra las 4 pestañas principales si aún tienen nombres genéricos (Hoja 1…4). */
    function asegurarNombresHojasPlanilla_(ss) {
      for (var i = 0; i < SHEET_NOMBRES.length; i++) {
        obtenerHojaPorIndice_(ss, i);
      }
    }

    /** Hojas con columna NUM_MUESTRA (VISUAL + ACOPIO). */
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
    * Próximo NUM_MUESTRA global (VISUAL + ACOPIO + watermark al guardar).
    * @param {boolean} soloDesdeHoja Si true: solo datos en hojas (consultas app). Si false: incluye watermark.
    */
    function resolverProximoNumMuestraJsonGlobal_(ss, soloDesdeHoja) {
      var ultimoCelda = ultimoNumMuestraCeldaGlobal_(ss);
      var sheetMax = maxNumMuestraGlobalEnRegistro_(ss);
      // Usar el mayor entre última celda y max de columna (evita huecos/duplicados).
      var baseUltimo = Math.max(ultimoCelda.digitos || 0, sheetMax || 0);
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
        var dataOp = sh.getRange(2, 1, lastRow, Math.max(15, IDX_REGISTRO_ENSAYO_NUMERO + 1)).getValues();
        for (var oi = 0; oi < dataOp.length; oi++) {
          var fOp = formatFechaPacking(dataOp[oi][0]);
          if (fOp !== fechaNorm) continue;
          var enOp = dataOp[oi][IDX_REGISTRO_ENSAYO_NUMERO];
          var enOpStr = (enOp !== null && enOp !== undefined && enOp !== '')
            ? (Number(enOp) === Math.floor(Number(enOp)) ? String(Number(enOp)) : String(enOp).trim())
            : '';
          if (enOpStr) ensSet[enOpStr] = true;
        }
      }
      return Object.keys(ensSet).sort();
    }

    /**
     * Ensayos registrados hoy por modo (Visual vs Acopio no se mezclan para bloqueo de cupo 1–10).
     * soloAcopio=true → solo hoja Acopio; false → solo hoja Visual.
     */
    function ensayosRegistradosEnFechaPorModo_(ss, fechaNorm, soloAcopio) {
      var ensSet = {};
      var hojas = hojasRegistroNumMuestra_(ss);
      for (var hi = 0; hi < hojas.length; hi++) {
        var sh = hojas[hi];
        var esAc = esHojaRegistroAcopio_(ss, sh);
        if (soloAcopio && !esAc) continue;
        if (!soloAcopio && esAc) continue;
        var lastRow = sh.getLastRow();
        if (lastRow < 2) continue;
        var dataOp = sh.getRange(2, 1, lastRow, Math.max(15, IDX_REGISTRO_ENSAYO_NUMERO + 1)).getValues();
        for (var oi = 0; oi < dataOp.length; oi++) {
          var fOp = formatFechaPacking(dataOp[oi][0]);
          if (fOp !== fechaNorm) continue;
          var enOp = dataOp[oi][IDX_REGISTRO_ENSAYO_NUMERO];
          var enOpStr = (enOp !== null && enOp !== undefined && enOp !== '')
            ? (Number(enOp) === Math.floor(Number(enOp)) ? String(Number(enOp)) : String(enOp).trim())
            : '';
          if (enOpStr) ensSet[enOpStr] = true;
        }
      }
      return Object.keys(ensSet).sort();
    }

    /** Visual: quita columnas fantasma PESO_RESERVA y TIEMPO_RESERVA (esquema 50→48). Solo hoja VISUAL. */
    function migrarRegistroVisualQuitarReservas_(sheet, ss) {
      if (!sheet || sheet.getLastRow() === 0) return;
      if (ss && esHojaRegistroAcopio_(ss, sheet)) return;
      var col20 = String(sheet.getRange(1, 20).getValue() || '').trim().toUpperCase();
      if (col20 === 'PESO_RESERVA') {
        sheet.deleteColumn(20);
      }
      var col35 = String(sheet.getRange(1, 35).getValue() || '').trim().toUpperCase();
      if (col35 === 'TIEMPO_RESERVA') {
        sheet.deleteColumn(35);
      }
    }

    /** Inserta columna PESO_4 (col 20) y 6.º tiempo (col 35) si la hoja ACOPIO aún tiene esquema de 48 cols. */
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

    /** Renombra encabezado legacy TRAZ_LIBRE → TRAZ_TURNO (col 10). */
    function migrarTrazLibreATrazTurno_(sheet) {
      if (!sheet || sheet.getLastRow() === 0) return;
      var h = String(sheet.getRange(1, 10).getValue() || '').trim().toUpperCase();
      if (h === 'TRAZ_LIBRE') sheet.getRange(1, 10).setValue('TRAZ_TURNO');
    }

    /**
    * Columna TRAZ_ACOPIO (select Acopio 1–35 + Acopio Central 1/2) justo después de PLACA_VEHICULO.
    * Si quedó MODO_REGISTRO por error, lo renombra (no es Visual/Acopio de modo).
    */
    function migrarInsertarTrazAcopioTrasPlaca_(sheet, ss) {
      if (!sheet || sheet.getLastRow() === 0) return;
      var h13 = String(sheet.getRange(1, 13).getValue() || '').trim().toUpperCase();
      var h14 = String(sheet.getRange(1, 14).getValue() || '').trim().toUpperCase();
      if (h13 !== 'PLACA_VEHICULO') return;
      if (h14 === 'TRAZ_ACOPIO') return;
      if (h14 === 'MODO_REGISTRO') {
        sheet.getRange(1, 14).setValue('TRAZ_ACOPIO');
        var lastModo = sheet.getLastRow();
        if (lastModo >= 2) {
          var nModo = lastModo - 1;
          var valsModo = sheet.getRange(2, 14, nModo, 1).getValues();
          for (var mi = 0; mi < valsModo.length; mi++) {
            var s = String(valsModo[mi][0] == null ? '' : valsModo[mi][0]).trim();
            // Limpiar valores de modo erróneo ("Visual" / "Acopio"); dejar "Acopio N".
            if (s === 'Visual' || s === 'Acopio') valsModo[mi][0] = '';
          }
          sheet.getRange(2, 14, nModo, 1).setValues(valsModo);
        }
        return;
      }
      if (h14 !== 'ENSAYO_NUMERO') return;
      sheet.insertColumnsAfter(13, 1);
      sheet.getRange(1, 14).setValue('TRAZ_ACOPIO');
      var last = sheet.getLastRow();
      if (last >= 2) {
        var n = last - 1;
        var vals = [];
        for (var i = 0; i < n; i++) vals.push(['']);
        sheet.getRange(2, 14, n, 1).setValues(vals);
      }
    }

    /** Elimina columna TK2_ACOPIO del bloque TK-2.0 si aún existe. */
    function migrarQuitarTk2Acopio_(sheet) {
      if (!sheet || sheet.getLastRow() === 0) return;
      var lastCol = sheet.getLastColumn();
      if (lastCol < 2) return;
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      for (var c = 0; c < headers.length; c++) {
        if (String(headers[c] || '').trim().toUpperCase() === 'TK2_ACOPIO') {
          sheet.deleteColumn(c + 1);
          return;
        }
      }
    }

    function asegurarEncabezadoHoja3Acopio_(sheet) {
      var ss = sheet.getParent();
      migrarRegistro48a50Cols_(sheet);
      migrarInsertarTrazAcopioTrasPlaca_(sheet, ss);
      var h = getRegistroHeadersHoja3Acopio_();
      if (h.length !== NUM_COLS_REGISTRO_ACOPIO) {
        throw new Error('getRegistroHeadersHoja3Acopio_: longitud distinta a NUM_COLS_REGISTRO_ACOPIO');
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
      var modoH = String(sheet.getRange(1, 14).getValue() || "").trim().toUpperCase();
      var p4 = String(sheet.getRange(1, 21).getValue() || "").trim().toUpperCase();
      var tCal = String(sheet.getRange(1, 35).getValue() || "").trim().toUpperCase();
      if (modoH === "TRAZ_ACOPIO" && p4 === "PESO_4_CLAMSHELL_CALIBRADO" && tCal === "TIEMPO_TERMINO_CALIBRADO") {
        migrarTrazLibreATrazTurno_(sheet);
        // Formato texto ya se aplica a filas nuevas al insertar; Packing/TK en sus doPost.
        return;
      }
      sheet.getRange(1, 1, 1, h.length).setValues([h]);
      asegurarEncabezadosPackingEnHoja_(sheet);
      asegurarFormatoTextoColumnasRegistroHoja_(sheet);
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
      var ss = sheet.getParent();
      var colObs = numColsRegistroDesdeHoja_(ss, sheet) - 2;
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
      var ss = sheet.getParent();
      migrarRegistroVisualQuitarReservas_(sheet, ss);
      migrarInsertarTrazAcopioTrasPlaca_(sheet, ss);
      var h = getRegistroHeadersHoja1_();
      if (h.length !== NUM_COLS_REGISTRO_VISUAL) {
        throw new Error('getRegistroHeadersHoja1_: longitud distinta a NUM_COLS_REGISTRO_VISUAL');
      }
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, h.length).setValues([h]);
        asegurarEncabezadosPackingEnHoja_(sheet);
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
      var modoH = String(sheet.getRange(1, 14).getValue() || "").trim().toUpperCase();
      var colObs = NUM_COLS_REGISTRO_VISUAL - 2;
      var hObs = String(sheet.getRange(1, colObs).getValue() || "").trim().toUpperCase();
      var hFmt = String(sheet.getRange(1, colObs + 1).getValue() || "").trim().toUpperCase();
      var hHora = String(sheet.getRange(1, colObs + 2).getValue() || "").trim().toUpperCase();
      var pDespacho = String(sheet.getRange(1, 21).getValue() || "").trim().toUpperCase();
      if (b1 === "ENSAYO_NOMBRE" && l1 === "GUIA_REMISION" && modoH === "TRAZ_ACOPIO"
          && hObs === "OBSERVACION" && hFmt === "OBSERVACION_FORMATO" && hHora === "HORA_REGISTRO"
          && pDespacho === "DESPACHO_ACOPIO") {
        migrarTrazLibreATrazTurno_(sheet);
        // Encabezados Packing/TK/TK20/RC5: solo en sus doPost (no en cada POST de Campo).
        return;
      }
      var viejoB = b1 === "RESPONSABLE" || b1 === "GUIA_REMISION";
      var viejoL = l1 === "OBSERVACION_FORMATO";
      if (viejoB || viejoL || b1 === "" || hFmt !== "OBSERVACION_FORMATO" || modoH !== "TRAZ_ACOPIO") {
        sheet.getRange(1, 1, 1, h.length).setValues([h]);
      }
      asegurarEncabezadosPackingEnHoja_(sheet);
      asegurarFormatoTextoColumnasRegistroHoja_(sheet);
    }

    /** Thermo King (cols 92–131 en VISUAL y ACOPIO): meta + datos por fila clamshell. */
    function getThermokingHeaderNamesPerRow() {
      return [
        'INGRESO_CAMARA_MP',
        'SALIDA_CAMARA_MP',
        'INICIO_TRASLADO_TK',
        'DESPACHO_TK',
        'PESO_INGRESO_CAMARA_MP',
        'PESO_SALIDA_CAMARA_MP',
        'PESO_INICIO_TRASLADO_TK',
        'PESO_DESPACHO_TK',
        'T_CM_ING_CAM_MP',
        'T_PULP_ING_CAM_MP',
        'T_CM_SAL_CAM_MP',
        'T_PULP_SAL_CAM_MP',
        'T_AMB_INI_TRASLADO',
        'T_VEH_INI_TRASLADO',
        'T_PULP_INI_TRASLADO',
        'T_AMB_DESPACHO_TK',
        'T_VEH_DESPACHO_TK',
        'T_PULP_DESPACHO_TK',
        'HUMEDAD_ING_CAM_MP',
        'HUMEDAD_SAL_CAM_MP',
        'HUMEDAD_AMB_EXT_INI_TRASLADO',
        'HUMEDAD_VEH_INI_TRASLADO',
        'HUMEDAD_AMB_EXT_DESPACHO',
        'HUMEDAD_VEH_DESPACHO',
        'PRESION_AMB_ING_CAM_MP',
        'PRESION_AMB_SAL_CAM_MP',
        'PRESION_AMB_EXT_INI_TRASLADO',
        'PRESION_VEH_INI_TRASLADO',
        'PRESION_AMB_EXT_DESPACHO',
        'PRESION_VEH_DESPACHO',
        'PRESION_FRUTA_ING_CAM_MP',
        'PRESION_FRUTA_SAL_CAM_MP',
        'PRESION_FRUTA_INI_TRASLADO',
        'PRESION_FRUTA_DESPACHO_TK',
        'OBSERVACION',
        'HORA_REGISTRO'
      ];
    }

    function getThermokingFlatHeaders() {
      return [
        'FECHA_INSPECCION_TK',
        'RESPONSABLE_TK',
        'HORA_SALIDA_FRIO',
        'PLACA_TK'
      ].concat(getThermokingHeaderNamesPerRow());
    }

    /** True si la fila 1 aún tiene encabezados viejos THERMOKING_* o no coincide con los nombres legibles. */
    function necesitaActualizarHeadersThermoking_(sheet) {
      if (!sheet || sheet.getLastRow() === 0) return true;
      var esperado = getThermokingFlatHeaders();
      var ss = sheet.getParent();
      var tkCol = thermokingStartColDesdeHoja_(ss, sheet);
      var actual = sheet.getRange(1, tkCol, 1, esperado.length).getValues()[0];
      for (var i = 0; i < esperado.length; i++) {
        var a = String(actual[i] || '').trim().toUpperCase();
        var e = String(esperado[i] || '').trim().toUpperCase();
        if (!a || a.indexOf('THERMOKING_') === 0 || a !== e) return true;
      }
      return false;
    }

    /** Fila 1 bloque TK: nombres legibles (migración desde THERMOKING_* + HORA_REGISTRO tras OBSERVACION). */
    function asegurarEncabezadosThermokingEnHoja_(sheet) {
      if (!sheet) return;
      migrarInsertarHoraRegistroThermoking_(sheet);
      var tkHeaders = getThermokingFlatHeaders();
      if (necesitaActualizarHeadersThermoking_(sheet)) {
        var ss = sheet.getParent();
        var tkCol = thermokingStartColDesdeHoja_(ss, sheet);
        sheet.getRange(1, tkCol, 1, tkHeaders.length).setValues([tkHeaders]);
      }
    }

    /** Columna OBSERVACION del bloque TK (fila plana, sin sufijo). */
    function colObservacionThermoking_(sheet) {
      var ss = sheet.getParent();
      return thermokingStartColDesdeHoja_(ss, sheet) + IDX_OBS_EN_TK_ROW;
    }

    /** Columna HORA_REGISTRO del bloque TK (después de OBSERVACION / DX). */
    function colHoraRegistroThermoking_(sheet) {
      var ss = sheet.getParent();
      return thermokingStartColDesdeHoja_(ss, sheet) + IDX_HORA_REG_EN_TK_ROW;
    }

    /** Inserta columna HORA_REGISTRO tras OBSERVACION TK si la hoja aún tiene esquema de 39 cols. */
    function migrarInsertarHoraRegistroThermoking_(sheet) {
      if (!sheet || sheet.getLastRow() === 0) return;
      var colObs = colObservacionThermoking_(sheet);
      var colHora = colHoraRegistroThermoking_(sheet);
      var hObs = String(sheet.getRange(1, colObs).getValue() || '').trim().toUpperCase();
      var hHora = String(sheet.getRange(1, colHora).getValue() || '').trim().toUpperCase();
      if (hObs === 'OBSERVACION' && hHora === 'HORA_REGISTRO') return;
      if (hObs === 'OBSERVACION' && hHora !== 'HORA_REGISTRO') {
        sheet.insertColumnAfter(colObs);
        sheet.getRange(1, colHora).setValue('HORA_REGISTRO');
      }
    }

    /** VISUAL y ACOPIO comparten bloque TK; ambas hojas deben mostrar los mismos encabezados. */
    function asegurarEncabezadosThermokingEnHojasRegistro_(ss) {
      var hojas = hojasRegistroNumMuestra_(ss);
      for (var i = 0; i < hojas.length; i++) {
        asegurarEncabezadosThermokingEnHoja_(hojas[i]);
      }
    }

    /** Sufijos de control/pesos por etapa TK-2.0 (alineados a tk20-fields.js). */
    function getTk20EtapaDataSuffixes_() {
      return [
        'HORA',
        'T_AMB_EXT', 'T_AMB_ACOPIO', 'T_AMB_VEH', 'T_PULPA',
        'HR_EXT', 'HR_ACOPIO', 'HR_VEH',
        'PV_AMB_EXT', 'PV_AMB_ACOPIO', 'PV_AMB_VEH', 'PV_PULPA',
        'PESO',
        'OBSERVACION'
      ];
    }

    /** Columnas de datos por fila clamshell (Llegada + Inicio traslado + HORA_REGISTRO). */
    function getTk20HeaderNamesPerRow() {
      var suf = getTk20EtapaDataSuffixes_();
      var out = [];
      var etapas = ['LLEGADA', 'TRASLADO'];
      for (var e = 0; e < etapas.length; e++) {
        for (var i = 0; i < suf.length; i++) {
          out.push('TK2_' + etapas[e] + '_' + suf[i]);
        }
      }
      out.push('TK2_HORA_REGISTRO');
      return out;
    }

    /** TK-2.0 (cols tras MP-TK): meta transporte + datos por fila. Sin TK2_ACOPIO. */
    function getTk20FlatHeaders() {
      return [
        'TK2_FECHA_INSPECCION',
        'TK2_RESPONSABLE',
        'TK2_PLACA',
        'TK2_GUIA_REMISION'
      ].concat(getTk20HeaderNamesPerRow());
    }

    function necesitaActualizarHeadersTk20_(sheet) {
      if (!sheet || sheet.getLastRow() === 0) return true;
      var esperado = getTk20FlatHeaders();
      var ss = sheet.getParent();
      var tk20Col = tk20StartColDesdeHoja_(ss, sheet);
      var actual = sheet.getRange(1, tk20Col, 1, esperado.length).getValues()[0];
      for (var i = 0; i < esperado.length; i++) {
        var a = String(actual[i] || '').trim().toUpperCase();
        var e = String(esperado[i] || '').trim().toUpperCase();
        if (!a || a !== e) return true;
      }
      return false;
    }

    /** Fila 1 bloque TK-2.0 en VISUAL y ACOPIO. forzar=true escribe siempre (p. ej. tras POST). */
    function asegurarEncabezadosTk20EnHoja_(sheet, forzar) {
      if (!sheet) return;
      migrarQuitarTk2Acopio_(sheet);
      var tk20Headers = getTk20FlatHeaders();
      if (!forzar && !necesitaActualizarHeadersTk20_(sheet)) return;
      var ss = sheet.getParent();
      var tk20Col = tk20StartColDesdeHoja_(ss, sheet);
      sheet.getRange(1, tk20Col, 1, tk20Headers.length).setValues([tk20Headers]);
    }

    /** VISUAL y ACOPIO: Packing + MP-TK + TK-2.0 + RC5 en fila 1. */
    function asegurarEncabezadosTk20EnHojasRegistro_(ss) {
      if (!ss) return;
      var hojas = hojasRegistroNumMuestra_(ss);
      for (var i = 0; i < hojas.length; i++) {
        asegurarEncabezadosPackingEnHoja_(hojas[i]);
      }
      asegurarEncabezadosPackingRc5EnHojasRegistro_(ss);
    }

    function colHoraRegistroTk20_(sheet) {
      var ss = sheet.getParent();
      return tk20StartColDesdeHoja_(ss, sheet) + IDX_HORA_REG_EN_TK20_ROW;
    }

    function tk20RowTieneHoraRegistro_(tk20Row) {
      if (!tk20Row || tk20Row.length <= IDX_HORA_REG_EN_TK20_ROW) return false;
      return String(tk20Row[IDX_HORA_REG_EN_TK20_ROW] || '').trim() !== '';
    }

    function rowTieneTk20Registrado_(tk20Row) {
      return tk20RowTieneHoraRegistro_(tk20Row);
    }

    function strCell_(v) {
      if (v === null || v === undefined) return '';
      return String(v);
    }

    /** Celda como texto literal: evita que Sheets interprete 14/3 como fecha o 0001 como número. */
    function celdaTextoLiteralRegistro_(v) {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) {
        return Utilities.formatDate(v, Session.getScriptTimeZone() || 'America/Santiago', 'd/M/yyyy');
      }
      return String(v).trim();
    }

    /** Fuerza NUM_MUESTRA, DIAS_PRECOSECHA y GUIA_REMISION como string antes de setValues. */
    function forzarTextoLiteralEnFilaRegistro_(fila) {
      if (!fila || !fila.length) return fila;
      if (fila.length > IDX_REGISTRO_NUM_MUESTRA) {
        fila[IDX_REGISTRO_NUM_MUESTRA] = celdaTextoLiteralRegistro_(fila[IDX_REGISTRO_NUM_MUESTRA]);
      }
      if (fila.length > IDX_REGISTRO_DIAS_PRECOSECHA) {
        fila[IDX_REGISTRO_DIAS_PRECOSECHA] = celdaTextoLiteralRegistro_(fila[IDX_REGISTRO_DIAS_PRECOSECHA]);
      }
      if (fila.length > IDX_REGISTRO_GUIA_REMISION) {
        fila[IDX_REGISTRO_GUIA_REMISION] = celdaTextoLiteralRegistro_(fila[IDX_REGISTRO_GUIA_REMISION]);
      }
      return fila;
    }

    /** Formato @ en columnas que deben ser texto (aplicar antes de setValues). */
    function aplicarFormatoTextoColumnasRegistro_(sheet, startRow, numRows) {
      if (!sheet || numRows <= 0 || startRow < 1) return;
      sheet.getRange(startRow, COL_REGISTRO_NUM_MUESTRA, numRows, 1).setNumberFormat('@');
      sheet.getRange(startRow, COL_REGISTRO_DIAS_PRECOSECHA, numRows, 1).setNumberFormat('@');
      sheet.getRange(startRow, COL_REGISTRO_GUIA_REMISION, numRows, 1).setNumberFormat('@');
    }

    function asegurarFormatoTextoColumnasRegistroHoja_(sheet) {
      if (!sheet || sheet.getLastRow() < 2) return;
      aplicarFormatoTextoColumnasRegistro_(sheet, 2, sheet.getLastRow() - 1);
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
    * Anti-duplicado por contenido de medición (sin NUM_MUESTRA ni HORA_REGISTRO).
    * Evita reinsertar el mismo clamshell si cambió solo la hora o el código quedó vacío.
    */
    function buildKeyContenidoCampoRegistro_(row, esAcopio) {
      if (!row || !row.length) return '';
      var c = function (v) {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) {
          return Utilities.formatDate(v, 'America/Santiago', 'yyyy-MM-dd');
        }
        return String(v).trim();
      };
      var pesoEnd = esAcopio ? 21 : 20;
      var parts = [
        c(row[0]),
        c(row[IDX_REGISTRO_ENSAYO_NUMERO]),
        c(row[IDX_REGISTRO_N_CLAMSHELL]),
        c(row[IDX_REGISTRO_N_JARRA])
      ];
      for (var pi = 17; pi <= pesoEnd; pi++) {
        parts.push(c(row[pi]));
      }
      return parts.join('||');
    }

    /** True si la fila registro tiene datos mínimos para insertar (misma regla que doPost). */
    function filaCampoInsertableGs_(fila, esAcopio) {
      function esCero(v) {
        if (v === null || v === undefined) return true;
        var s = String(v).trim();
        if (s === '') return true;
        var n = parseFloat(s.replace(',', '.'));
        return isNaN(n) || n === 0;
      }
      // Solo-TIEMPOS (sin N_CLAMSHELL) no entra a VISUAL/ACOPIO.
      if (esCero(fila[IDX_REGISTRO_N_CLAMSHELL])) return false;
      // Acopio: Peso 4 + Peso 5.
      if (esAcopio) return !esCero(fila[20]) && !esCero(fila[21]);
      // Visual: todo clamshell numerado se inserta.
      // Antes exigía PESO_1 (fila[17]) y se perdían clamshells 5–8 sin P1 → solo 4/8 en planilla.
      return true;
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
      var w = Math.min(lastCol, NUM_COLS_REGISTRO_ACOPIO);
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
      var ssDup = sheet.getParent();
      var numCols = Math.max(15, IDX_REGISTRO_ENSAYO_NUMERO + 1, idx + 1, numColsRegistroDesdeHoja_(ssDup, sheet));
      var vals = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
      for (var i = 0; i < vals.length; i++) {
        var rowNm = normalizarNumMuestraClave(vals[i].length > idx ? vals[i][idx] : '');
        if (!rowNm || rowNm !== nm) continue;
        return {
          num_muestra: nm,
          fecha: formatFechaPacking(vals[i][0]) || '',
          ensayo_numero: (vals[i][IDX_REGISTRO_ENSAYO_NUMERO] != null && vals[i][IDX_REGISTRO_ENSAYO_NUMERO] !== '')
            ? String(vals[i][IDX_REGISTRO_ENSAYO_NUMERO]).trim()
            : ''
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

    /** Índice en fila plana packing (meta+datos) de HORA_REGISTRO — col 91 (CM) cuando packing inicia en 51. */
    var IDX_HORA_REG_EN_PACK_ROW = PACKING_META_COLS + PACKING_DATA_COLS - 1;

    function packRowValorHoraRegistro_(packRow) {
      if (!packRow || packRow.length <= IDX_HORA_REG_EN_PACK_ROW) return '';
      var v = packRow[IDX_HORA_REG_EN_PACK_ROW];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) {
        return Utilities.formatDate(v, Session.getScriptTimeZone() || 'America/Lima', 'HH:mm');
      }
      return String(v).trim();
    }

    function packRowTieneHoraRegistro_(packRow) {
      return packRowValorHoraRegistro_(packRow) !== '';
    }

    /** Índice 0-based HORA_REGISTRO en bloque Visual/Acopio (última col del registro). */
    function idxHoraRegCampoEnRow_(ss, sheet) {
      return numColsRegistroDesdeHoja_(ss, sheet) - 1;
    }

    function campoRowValorHoraRegistro_(row, idxHora) {
      if (!row || idxHora < 0 || row.length <= idxHora) return '';
      return formatHoraRegistro_(row[idxHora]);
    }

    function campoRowTieneHoraRegistro_(row, idxHora) {
      return campoRowValorHoraRegistro_(row, idxHora) !== '';
    }

    /** TK (MP-TK) listo en servidor: todas las filas clamshell con HORA_REGISTRO (DY/EA). */
    function evaluarThermokingCompletoEnServidor_(maxClamshell, filasTkConHoraRegistro) {
      if (maxClamshell <= 0) return false;
      return filasTkConHoraRegistro >= maxClamshell;
    }

    /** TK-2.0 listo en servidor: todas las filas clamshell con TK2_HORA_REGISTRO (FG/FI). */
    function evaluarTk20CompletoEnServidor_(maxClamshell, numFilas, filasTk20ConHoraRegistro) {
      var maxEff = maxClamshellEfectivo_(maxClamshell, numFilas);
      if (maxEff <= 0) return false;
      return filasTk20ConHoraRegistro >= maxEff;
    }

    /** Packing RC5: desbloqueo cuando Campo + Packing + TK tienen HORA_REGISTRO en todas las filas. */
    function evaluarPuedeContinuarPackingRc5_(campoCompleto, packingCompleto, tkCompleto) {
      return campoCompleto === true && packingCompleto === true && tkCompleto === true;
    }

    /** Packing listo en servidor: todas las filas clamshell con HORA_REGISTRO (col 91); legacy si aún no hay esa columna. */
    function evaluarPackingCompletoEnServidor_(maxClamshell, filasPackingConDatos, filasPackingConHoraRegistro) {
      if (maxClamshell <= 0) return false;
      if (filasPackingConHoraRegistro >= maxClamshell) return true;
      if (filasPackingConHoraRegistro === 0 && filasPackingConDatos >= maxClamshell) return true;
      return false;
    }

    /** Máximo clamshell efectivo: no exigir más filas que las registradas en hoja. */
    function maxClamshellEfectivo_(maxClamshell, numFilas) {
      var max = Number(maxClamshell) || 0;
      var n = Number(numFilas) || 0;
      if (n <= 0) return max > 0 ? max : 0;
      if (max <= 0 || max < n) return n;
      if (max > n) return n;
      return max;
    }

    /** Campo listo en servidor: todas las filas efectivas con HORA_REGISTRO (AV/AX). */
    function evaluarCampoCompletoEnServidor_(maxClamshell, numFilas, filasCampoConHoraRegistro) {
      var maxEff = maxClamshellEfectivo_(maxClamshell, numFilas);
      if (maxEff <= 0) return false;
      return filasCampoConHoraRegistro >= maxEff;
    }

    /** TK-2.0 pendiente: campo completo por HORA_REGISTRO y aún sin bloque TK-2.0 en planilla. */
    function evaluarPuedeContinuarTk20_(campoCompleto, tieneTk20) {
      return campoCompleto === true && tieneTk20 !== true;
    }

    /** True si la fila TK (meta o datos) tiene datos sin contar HORA_REGISTRO (planilla legacy). */
    function rowTieneThermokingDatosLegacy_(tkRow) {
      if (!tkRow || !tkRow.length) return false;
      var i;
      for (i = 1; i <= 3; i++) {
        if (tkRow[i] != null && String(tkRow[i]).trim() !== '') return true;
      }
      var end = Math.min(tkRow.length, IDX_OBS_EN_TK_ROW + 1);
      for (i = 4; i < end; i++) {
        if (cellHasPackingValue_(tkRow[i])) return true;
      }
      return false;
    }

    function tkRowValorHoraRegistro_(tkRow) {
      if (!tkRow || tkRow.length <= IDX_HORA_REG_EN_TK_ROW) return '';
      var v = tkRow[IDX_HORA_REG_EN_TK_ROW];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) {
        return Utilities.formatDate(v, Session.getScriptTimeZone() || 'America/Lima', 'HH:mm');
      }
      return String(v).trim();
    }

    function tkRowTieneHoraRegistro_(tkRow) {
      return tkRowValorHoraRegistro_(tkRow) !== '';
    }

    /** MP-TK registrado: HORA_REGISTRO en bloque TK (como packing); legacy si hay datos TK sin esa columna. */
    function rowTieneThermokingRegistrado_(tkRow) {
      if (tkRowTieneHoraRegistro_(tkRow)) return true;
      return rowTieneThermokingDatosLegacy_(tkRow);
    }

    /** @deprecated usar rowTieneThermokingRegistrado_ */
    function rowTieneThermokingDatos_(tkRow) {
      return rowTieneThermokingRegistrado_(tkRow);
    }

    function horaMptkDesdeFilaTk_(tkRow) {
      if (tkRowTieneHoraRegistro_(tkRow)) return tkRowValorHoraRegistro_(tkRow);
      if (!tkRow || tkRow.length < 3) return '';
      return formatHoraRegistro_(tkRow[2]);
    }

    /**
    * MP-TK fila plana: pesos/temp/humedad (1 dec) + presión (3 dec) como Number.
    * Evita que locale es_* convierta "1.9"→fecha o "0.626"→626.
    * Índices 0-based: 8–11 pesos, 12–21 temp, 22–27 humedad, 28–37 presión.
    */
    function aplicarDecimalesMedicionEnFilaThermoking_(fila) {
      if (!fila || !fila.length) return fila;
      var i;
      for (i = 8; i <= 11; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      for (i = 12; i <= 21; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      for (i = 22; i <= 27; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      for (i = 28; i <= 37; i++) {
        if (i < fila.length) fila[i] = normalizarPresionVaporCelda_(fila[i]);
      }
      return fila;
    }

    /** Formato numérico MP-TK en hoja (pesos/temp/humedad 0.0, presión 0.000). */
    function aplicarFormatoDecimalesThermokingEnFila_(sheet, filaHoja, tkCol) {
      if (!sheet || filaHoja < 2 || !tkCol) return;
      // pesos 8–11
      sheet.getRange(filaHoja, tkCol + 8, 1, 4).setNumberFormat('0.0');
      // temp 12–21
      sheet.getRange(filaHoja, tkCol + 12, 1, 10).setNumberFormat('0.0');
      // humedad 22–27
      sheet.getRange(filaHoja, tkCol + 22, 1, 6).setNumberFormat('0.0');
      // presión amb+fruta 28–37
      sheet.getRange(filaHoja, tkCol + 28, 1, 10).setNumberFormat('0.000');
    }

    function termoRowConHoraRegistroAlGuardar_(termoRow) {
      var out = termoRow ? termoRow.slice() : [];
      while (out.length < THERMOKING_COLS) out.push('');
      if (!tkRowTieneHoraRegistro_(out) && rowTieneThermokingDatosLegacy_(out)) {
        out[IDX_HORA_REG_EN_TK_ROW] = formatHoraRegistro_(new Date());
      }
      aplicarDecimalesMedicionEnFilaThermoking_(out);
      return out;
    }

    /** Escribe fila MP-TK con Number + formato decimal (no texto que Sheets convierte a fecha). */
    function escribirThermokingFilaEnHoja_(sheet, filaHoja, tkCol, termoRow) {
      var vals = termoRowConHoraRegistroAlGuardar_(termoRow);
      sheet.getRange(filaHoja, tkCol, 1, vals.length).setValues([vals]);
      aplicarFormatoDecimalesThermokingEnFila_(sheet, filaHoja, tkCol);
      return vals;
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
      var horaRegs = data.thermoking_hora_registro || data.thermoking_hora_reg || [];
      var horaReg = pickField_(horaRegs, i, 'hora') || pickField_(horaRegs, i, 'hora_registro');
      if (!horaReg && data.hora_registro_mptk != null) horaReg = String(data.hora_registro_mptk).trim();
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
        pickField_(obs, i, 'observacion'),
        horaReg
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

        asegurarNombresHojasPlanilla_(ss);

        var sheetVisual = obtenerHojaPorIndice_(ss, SHEET_IDX_VISUAL_REGISTRO);
        if (data.mode === 'packing' || data.mode === 'packing-rc5') {
          var sheetPack = resolverHojaRegistroPacking_(ss, data);
          var packingResult = (data.mode === 'packing-rc5')
            ? doPostPackingRc5(sheetPack, data)
            : doPostPacking(sheetPack, data);
          return out(packingResult);
        }
        if (data.mode === 'tk20' || data.mode === 'tk-2.0' || data.mode === 'tk_20') {
          var sheetTk20 = resolverHojaRegistroPacking_(ss, data);
          var tk20Result = doPostTk20(sheetTk20, data);
          return out(tk20Result);
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

        // NUM_MUESTRA es una reserva global e inmutable. La comprobación debe
        // ocurrir dentro del mismo lock que la inserción para evitar carreras
        // entre teléfonos. Un conflicto nunca se renumera silenciosamente.
        var numsMuestraPost = {};
        for (var nmpi = 0; nmpi < rows.length; nmpi++) {
          var nmPost = normalizarNumMuestraClave(rows[nmpi] && rows[nmpi].length > 2 ? rows[nmpi][2] : '');
          if (nmPost) numsMuestraPost[nmPost] = true;
        }
        var numsMuestraPostKeys = Object.keys(numsMuestraPost);
        for (var nmk = 0; nmk < numsMuestraPostKeys.length; nmk++) {
          var dupNumPost = buscarDuplicadoNumMuestraGlobal_(ss, numsMuestraPostKeys[nmk]);
          if (dupNumPost) {
            return out({
              ok: false,
              code: "DUPLICATE_NUM_MUESTRA",
              error: "NUM_MUESTRA ya existe",
              num_muestra: dupNumPost.num_muestra,
              fecha: dupNumPost.fecha,
              ensayo_numero: dupNumPost.ensayo_numero,
              detail: dupNumPost
            });
          }
        }

        const NUM_COLS = numColsRegistroEsAcopio_(esAcopio);
        const minExpanded = registroPostExpandedLenEsAcopio_(esAcopio);
        const PRE_JARRA = registroPreJarraColsEsAcopio_(esAcopio);

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
        var existingContentKeys = {};
        if (lastRow >= 2) {
          var existingValues = sheet.getRange(2, 1, lastRow, NUM_COLS).getValues();
          existingValues.forEach(function(r) {
            var key = buildKey(r);
            if (key) existingKeys[key] = true;
            var ck = buildKeyContenidoCampoRegistro_(r, esAcopio);
            if (ck) existingContentKeys[ck] = true;
          });
        }

        function celdaAString(cell) {
          if (cell === null || cell === undefined) return "";
          return String(cell);
        }

        /** POST expandido: PRE_JARRA + 6 Hoja2 + cierre → NUM_COLS registro. */
        function toRowRegistro(row) {
          var minLen = minExpanded;
          while (row.length < minLen) row.push("");
          var a = row.slice(0, PRE_JARRA).concat(row.slice(PRE_JARRA + 6, minLen));
          return a.slice(0, NUM_COLS).map(celdaAString);
        }

        function rowHoja2(fila, rowOriginal) {
          var c = celdaAString;
          var out = [c(fila[0]), c(fila[IDX_REGISTRO_ENSAYO_NUMERO]), c(fila[IDX_REGISTRO_N_JARRA]), '', '', '', '', '', ''];
          /** Hueco PRE_JARRA: Cosecha + Traslado desde el panel de jarras (POST expandido). */
          if (rowOriginal && rowOriginal.length >= PRE_JARRA + 6) {
            out[3] = c(rowOriginal[PRE_JARRA]);
            out[4] = c(rowOriginal[PRE_JARRA + 1]);
            out[5] = c(rowOriginal[PRE_JARRA + 2]);
            out[6] = c(rowOriginal[PRE_JARRA + 3]);
            out[7] = c(rowOriginal[PRE_JARRA + 4]);
            out[8] = c(rowOriginal[PRE_JARRA + 5]);
          }
          return out;
        }

        function claveJarraHoja2_(fila) {
          return normalizarParaClave(fila[0]) + '||'
            + normalizarParaClave(fila[IDX_REGISTRO_ENSAYO_NUMERO]) + '||'
            + normalizarParaClave(fila[IDX_REGISTRO_N_JARRA]);
        }

        /** Evitar reinsertar la misma jarra en TIEMPOS V./A.; permitir actualizar si C/T estaban vacíos. */
        var existingKeysHoja2 = {};
        var existingRowHoja2 = {};
        var sheet2Check = obtenerHojaPorIndice_(ss, indiceHojaRegistroJarras_(esAcopio));
        asegurarEncabezadoHojaJarras_(sheet2Check);
        var lastRow2 = sheet2Check.getLastRow();
        if (lastRow2 >= 2) {
          var vals2 = sheet2Check.getRange(2, 1, lastRow2, 9).getValues();
          for (var rj = 0; rj < vals2.length; rj++) {
            var r = vals2[rj];
            var k2 = normalizarParaClave(r[0]) + '||' + normalizarParaClave(r[1]) + '||' + normalizarParaClave(r[2]);
            if (!k2 || k2 === '||') continue;
            existingKeysHoja2[k2] = true;
            existingRowHoja2[k2] = { sheetRow: rj + 2, values: r };
          }
        }

        function hoja2TieneTiempos_(vals) {
          if (!vals || !vals.length) return false;
          for (var ti = 3; ti <= 8; ti++) {
            if (String(vals[ti] || '').trim()) return true;
          }
          return false;
        }

        function esCero(v) {
          if (v === null || v === undefined) return true;
          var s = String(v).trim();
          if (s === '') return true;
          var n = parseFloat(s.replace(',', '.'));
          return isNaN(n) || n === 0;
        }

        /** TIEMPOS V. / TIEMPOS A.: solo filas con N° jarra válido (Acopio " - " = vacío, no se guarda). */
        function jarraRegistroTieneValorGs_(v) {
          if (v === null || v === undefined) return false;
          var s = String(v).trim();
          if (s === '') return false;
          var n = parseInt(s, 10);
          return !isNaN(n) && n >= 1;
        }

        /** Orden canónico TIEMPOS V./A.: FECHA → ENSAYO → N_JARRA (1, 2, 3…). */
        function ordenarFilasHojaJarrasGs_(filas) {
          if (!filas || !filas.length) return filas || [];
          filas.sort(function(a, b) {
            var fa = normalizarParaClave(a[0]);
            var fb = normalizarParaClave(b[0]);
            if (fa !== fb) return fa < fb ? -1 : 1;
            var ea = parseInt(String(a[1] || ''), 10);
            var eb = parseInt(String(b[1] || ''), 10);
            if (!isNaN(ea) && !isNaN(eb) && ea !== eb) return ea - eb;
            var ja = parseInt(String(a[2] || ''), 10);
            var jb = parseInt(String(b[2] || ''), 10);
            if (isNaN(ja)) ja = 999999;
            if (isNaN(jb)) jb = 999999;
            return ja - jb;
          });
          return filas;
        }

        var nuevasFilas = [];
        var filasHoja2 = [];
        var errorNumMuestraVacio = '';
        /** Una fila en TIEMPOS V. / TIEMPOS A. por FECHA + ENSAYO + N° jarra (no por clamshell). */
        var clavesHojaJarrasVistas = {};
        for (var ri = 0; ri < rows.length; ri++) {
          var row = rows[ri];
          var fila = row.length >= minExpanded ? toRowRegistro(row) : (function() { while (row.length < NUM_COLS) row.push(""); return row.slice(0, NUM_COLS).map(celdaAString); })();
          aplicarDecimalesMedicionEnFilaRegistro_(fila, esAcopio);
          forzarTextoLiteralEnFilaRegistro_(fila);

          // TIEMPOS: escribir aunque el registro VISUAL/ACOPIO sea duplicado (panel jarras puede llegar después).
          if (jarraRegistroTieneValorGs_(fila[IDX_REGISTRO_N_JARRA]) && row.length >= minExpanded) {
            var claveJarraHoja = claveJarraHoja2_(fila);
            if (!clavesHojaJarrasVistas[claveJarraHoja]) {
              clavesHojaJarrasVistas[claveJarraHoja] = true;
              var nuevaH2 = rowHoja2(fila, row);
              var prevH2 = existingRowHoja2[claveJarraHoja];
              if (prevH2 && !hoja2TieneTiempos_(prevH2.values) && hoja2TieneTiempos_(nuevaH2)) {
                sheet2Check.getRange(prevH2.sheetRow, 1, 1, 9).setValues([nuevaH2]);
                existingRowHoja2[claveJarraHoja].values = nuevaH2;
              } else if (!existingKeysHoja2[claveJarraHoja]) {
                existingKeysHoja2[claveJarraHoja] = true;
                filasHoja2.push(nuevaH2);
              }
            }
          }

          var key = buildKey(fila);
          if (existingKeys[key]) continue;
          var contentKey = buildKeyContenidoCampoRegistro_(fila, esAcopio);
          if (contentKey && existingContentKeys[contentKey]) continue;
          existingKeys[key] = true;
          if (contentKey) existingContentKeys[contentKey] = true;
          // Visual: clamshell + algún peso. Acopio: PESO_4 + PESO_5 + clamshell.
          var filaInsertable = filaCampoInsertableGs_(fila, esAcopio);
          if (!filaInsertable) continue;
          if (!normalizarNumMuestraClave(fila[2])) {
            errorNumMuestraVacio = 'NUM_MUESTRA vacío (ensayo ' + String(fila[IDX_REGISTRO_ENSAYO_NUMERO] || '').trim()
              + ', clamshell ' + String(fila[IDX_REGISTRO_N_CLAMSHELL] || '').trim() + ')';
            break;
          }
          nuevasFilas.push(fila);
        }
        if (errorNumMuestraVacio) {
          return out({ ok: false, error: errorNumMuestraVacio });
        }

        // LockService + primer barrido ya llenaron existingKeys/contentKeys.
        // No releer toda la hoja (mismo anti-dupe, menos espera).

        if (nuevasFilas.length > 0) {
          var startRow = sheet.getLastRow() + 1;
          var numRows = nuevasFilas.length;
          // NUM_MUESTRA, DIAS_PRECOSECHA y GUIA_REMISION: texto literal (14/3 no fecha; guía con ceros).
          aplicarFormatoTextoColumnasRegistro_(sheet, startRow, numRows);
          sheet.getRange(startRow, 1, numRows, NUM_COLS).setValues(nuevasFilas);
          var pesoCount = esAcopio ? 5 : 4;
          var tempCol = esAcopio ? 23 : 22;
          var humCol = esAcopio ? 37 : 35;
          var presCol = esAcopio ? 41 : 39;
          sheet.getRange(startRow, 18, numRows, pesoCount).setNumberFormat('0.0');
          sheet.getRange(startRow, tempCol, numRows, 8).setNumberFormat('0.0');
          sheet.getRange(startRow, humCol, numRows, 4).setNumberFormat('0.0');
          sheet.getRange(startRow, presCol, numRows, 8).setNumberFormat('0.000');
          for (var wmi = 0; wmi < nuevasFilas.length; wmi++) {
            fusionarWatermarkNumMuestra_(parseNumMuestraDigitosGs_(nuevasFilas[wmi][2]));
          }
        }
        if (filasHoja2.length > 0) {
          var sheet2 = obtenerHojaPorIndice_(ss, indiceHojaRegistroJarras_(esAcopio));
          asegurarEncabezadoHojaJarras_(sheet2);
          var filasHoja2Orden = ordenarFilasHojaJarrasGs_(filasHoja2);
          var startRow2 = sheet2.getLastRow() + 1;
          sheet2.getRange(startRow2, 1, filasHoja2Orden.length, 9).setValues(filasHoja2Orden);
        }

        if (nuevasFilas.length === 0 && rows.length > 0) {
          if (uid) {
            PropertiesService.getScriptProperties().setProperty("mtpp_uid_" + uid, "1");
            limpiarUidsAntiguos();
          }
          return out({
            ok: true,
            received: rows.length,
            inserted: 0,
            duplicate: true,
            message: "Registro ya existente (contenido duplicado; no se reinsertó)"
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
    * Decimal medición (temp, humedad, peso): valor numérico real.
    * Un string "21.8" en locale es_* puede interpretarse como fecha (21-ago); Number evita eso.
    */
    function normalizarDecimalMedicionCelda_(v, casasDecimales) {
      if (v === null || v === undefined) return "";
      var s = String(v).trim().replace(',', '.');
      if (s === '') return '';
      if (s.charAt(0) === '.') s = '0' + s;
      var n = parseFloat(s);
      if (isNaN(n)) return '';
      var f = casasDecimales === 3 ? 1000 : 10;
      return Math.round(n * f) / f;
    }

    /**
    * Presión vapor (Kpa): valor numérico real (ej. 3.453), no texto "3.453".
    * En locale es_* un string con punto se interpreta como miles (3453); por eso se guarda como Number.
    */
    function normalizarPresionVaporCelda_(v) {
      return normalizarDecimalMedicionCelda_(v, 3);
    }

    /** Pesos, temp, humedad y presión del registro Campo/Acopio (49 Visual / 51 Acopio, índices 0-based). */
    function aplicarDecimalesMedicionEnFilaRegistro_(fila, esAcopio) {
      var esAc = esAcopio === true || (esAcopio !== false && fila.length >= 51);
      var i;
      // Visual: si PESO_1 vacío y PESO_2 tiene valor → duplicar P2→P1 en planilla.
      if (!esAc && fila.length > 18) {
        function esPesoVacioGs_(v) {
          if (v === null || v === undefined) return true;
          var s = String(v).trim();
          if (s === '') return true;
          var n = parseFloat(s.replace(',', '.'));
          return isNaN(n) || n === 0;
        }
        if (esPesoVacioGs_(fila[17]) && !esPesoVacioGs_(fila[18])) {
          fila[17] = fila[18];
        }
      }
      var pesoEnd = esAc ? 21 : 20;
      for (i = 17; i <= pesoEnd; i++) {
        if (i < fila.length) {
          var pesoNorm = normalizarDecimalMedicionCelda_(fila[i], 1);
          // Peso 0 / vacío → celda en blanco (no mostrar 0.0 en planilla Visual/Acopio).
          fila[i] = (pesoNorm === '' || pesoNorm === 0) ? '' : pesoNorm;
        }
      }
      var tempStart = esAc ? 22 : 21;
      var tempEnd = esAc ? 29 : 28;
      for (i = tempStart; i <= tempEnd; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      var humStart = esAc ? 36 : 34;
      var humEnd = esAc ? 39 : 37;
      for (i = humStart; i <= humEnd; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      var presStart = esAc ? 40 : 38;
      var presEnd = esAc ? 47 : 45;
      for (i = presStart; i <= presEnd; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 3);
      }
      return fila;
    }

    /** @deprecated usar aplicarDecimalesMedicionEnFilaRegistro_ */
    function aplicarPresionVaporDecimalEnFilaRegistro_(fila) {
      return aplicarDecimalesMedicionEnFilaRegistro_(fila);
    }

    /** Pesos (1 dec) + temp/humedad (1 dec) + presión (3 dec) packing (fila plana 37). */
    function aplicarDecimalesMedicionEnFilaPacking_(fila) {
      var i;
      for (i = 5; i <= 9; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      for (i = 10; i <= 24; i++) {
        if (i < fila.length) fila[i] = normalizarDecimalMedicionCelda_(fila[i], 1);
      }
      for (i = 25; i <= 34; i++) {
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
      if (idxData >= 5 && idxData <= 9) return normalizarDecimalMedicionCelda_(v, 1);
      if (idxData >= 10 && idxData <= 24) return normalizarDecimalMedicionCelda_(v, 1);
      if (idxData >= 25 && idxData <= 34) return normalizarPresionVaporCelda_(v);
      return (v != null && v !== '') ? v : '';
    }

    function pesoSalidaPrefrioDesdePackRow_(packRow) {
      if (!packRow || !packRow.length) return null;
      var v = packRow[IDX_PACK_ROW_PESO_SALIDA_PREFRIO];
      if (v === null || v === undefined || String(v).trim() === '') return null;
      var n = parseFloat(String(v).replace(',', '.'));
      return (!isNaN(n) && n > 0) ? n : null;
    }

    /** Formato packing: pesos/temp/humedad 0.0, presión 0.000 (evita fecha/miles en locale es_*). */
    function aplicarFormatoDecimalesPackingEnFila_(sheet, filaHoja, startCol) {
      var colPeso = startCol + PACKING_META_COLS + 5;
      sheet.getRange(filaHoja, colPeso, 1, 5).setNumberFormat('0.0');
      var colTempHum = startCol + PACKING_META_COLS + 10;
      sheet.getRange(filaHoja, colTempHum, 1, 15).setNumberFormat('0.0');
      var colPres = startCol + PACKING_META_COLS + 25;
      sheet.getRange(filaHoja, colPres, 1, 10).setNumberFormat('0.000');
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
      var ss = sheet.getParent();
      return packingStartColDesdeHoja_(ss, sheet) + PACKING_META_COLS + 35;
    }

    /** Columna HORA_REGISTRO del bloque packing. */
    function colHoraRegistroPacking_(sheet) {
      var ss = sheet.getParent();
      return packingStartColDesdeHoja_(ss, sheet) + PACKING_META_COLS + 36;
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

    function getPackingRc5FlatHeaders() {
      return [
        'FECHA_INSPECCION_RC5',
        'RESPONSABLE_RC5',
        'HORA_RECEPCION_RC5',
        'N_VIAJE_RC5',
        'RECEPCION_RC5',
        'PESO_RECEPCION_RC5',
        'T_AMB_RECEP_RC5',
        'T_PULP_RECEP_RC5',
        'HUMEDAD_RECEPCION_RC5',
        'PRESION_AMB_RECEPCION_RC5',
        'PRESION_FRUTA_RECEPCION_RC5',
        'OBSERVACION_RC5',
        'HORA_REGISTRO_RC5'
      ];
    }

    function necesitaActualizarHeadersPackingRc5_(sheet, rc5Col, esperado) {
      if (!sheet || sheet.getLastRow() === 0) return true;
      var actual = sheet.getRange(1, rc5Col, 1, esperado.length).getValues()[0];
      for (var i = 0; i < esperado.length; i++) {
        var a = String(actual[i] || '').trim().toUpperCase();
        var e = String(esperado[i] || '').trim().toUpperCase();
        if (!a || a !== e) return true;
      }
      return false;
    }

    function asegurarEncabezadosPackingRc5EnHoja_(sheet) {
      if (!sheet) return;
      var ss = sheet.getParent();
      var rc5Col = packingRc5StartColDesdeHoja_(ss, sheet);
      var headers = getPackingRc5FlatHeaders();
      if (necesitaActualizarHeadersPackingRc5_(sheet, rc5Col, headers)) {
        sheet.getRange(1, rc5Col, 1, headers.length).setValues([headers]);
      }
    }

    function asegurarEncabezadosPackingRc5EnHojasRegistro_(ss) {
      if (!ss) return;
      var hojas = hojasRegistroNumMuestra_(ss);
      for (var i = 0; i < hojas.length; i++) {
        asegurarEncabezadosPackingRc5EnHoja_(hojas[i]);
      }
    }

    function filaPackingPlanaAFilaRc5_(rowPacking) {
      var row = normalizarFilaPackingDatosParaHoja_(rowPacking);
      var out = [];
      var map = PACKING_RC5_DATA_IDX_FROM_ROW;
      for (var i = 0; i < map.length; i++) {
        var src = map[i];
        var raw = (row[src] != null && row[src] !== '') ? row[src] : '';
        if (src === 36 && !raw) raw = formatHoraRegistro_(new Date());
        out.push(valorCeldaPackingAlEscribir_(src, raw));
      }
      return out;
    }

    function rc5RowTieneHoraRegistro_(rc5Row) {
      if (!rc5Row || rc5Row.length <= IDX_RC5_HORA_REG_EN_ROW) return false;
      return String(rc5Row[IDX_RC5_HORA_REG_EN_ROW] || '').trim() !== '';
    }

    function rowHasPackingRc5Data_(rc5Row) {
      if (!rc5Row || !rc5Row.length) return false;
      for (var i = PACKING_RC5_META_COLS; i < rc5Row.length; i++) {
        if (cellHasPackingValue_(rc5Row[i])) return true;
      }
      return false;
    }

    function aplicarFormatoDecimalesPackingRc5EnFila_(sheet, filaHoja, startCol) {
      // META+1 = peso, +2/+3 = temp, +4 = humedad, +5/+6 = presión
      sheet.getRange(filaHoja, startCol + PACKING_RC5_META_COLS + 1, 1, 1).setNumberFormat('0.0');
      sheet.getRange(filaHoja, startCol + PACKING_RC5_META_COLS + 2, 1, 3).setNumberFormat('0.0');
      sheet.getRange(filaHoja, startCol + PACKING_RC5_META_COLS + 5, 1, 2).setNumberFormat('0.000');
    }

    function escribirPackingRc5RowsEnBloque_(sheet, rowIndices, cfg) {
      var packingRows = cfg.packingRows || [];
      if (!packingRows.length) return 0;
      var startCol = cfg.startCol;
      var packingStartIndex = Number(cfg.packingStartIndex) || 0;
      var escritas = 0;
      for (var i = 0; i < packingRows.length; i++) {
        var filaIdx = packingStartIndex + i;
        if (filaIdx >= rowIndices.length) break;
        var filaHoja = rowIndices[filaIdx];
        var valores = [
          cfg.fechaInspeccion || '',
          cfg.responsable || '',
          cfg.horaRecepcion || '',
          cfg.nViaje || ''
        ].concat(filaPackingPlanaAFilaRc5_(packingRows[i]));
        sheet.getRange(filaHoja, startCol, 1, PACKING_RC5_COLS).setValues([valores]);
        aplicarFormatoDecimalesPackingRc5EnFila_(sheet, filaHoja, startCol);
        escritas++;
      }
      sheet.getRange(1, startCol, 1, cfg.baseHeaders.length).setValues([cfg.baseHeaders]);
      return escritas;
    }

    function doPostPackingRc5(sheet, data) {
      try {
        var ssRc5 = sheet.getParent();
        asegurarEncabezadosPackingRc5EnHojasRegistro_(ssRc5);
        asegurarEncabezadosPackingRc5EnHoja_(sheet);
        var rc5Col = packingRc5StartColDesdeHoja_(ssRc5, sheet);
        var guardarRc5 = (data.guardar_packing === false || data.guardar_packing === 'false') ? false : true;

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

        var dataRows = sheet.getRange(2, 1, lastRow, 15).getValues();
        var rowIndices = [];
        for (var k = 0; k < dataRows.length; k++) {
          var r = dataRows[k];
          var rowFechaStr = formatFechaPacking(r[0]);
          var rowEn = (r[IDX_REGISTRO_ENSAYO_NUMERO] != null && r[IDX_REGISTRO_ENSAYO_NUMERO] !== '') ? String(r[IDX_REGISTRO_ENSAYO_NUMERO]).trim() : '';
          if (rowFechaStr === fecha && rowEn === ensayoNumero) {
            rowIndices.push(2 + k);
          }
        }
        if (rowIndices.length === 0) {
          return { ok: false, error: 'No se encontró ninguna fila para esa fecha y ensayo' };
        }

        if (!guardarRc5 || !packingRows.length) {
          return { ok: false, error: 'Nada que escribir (sin filas RC5)' };
        }

        var baseHeadersRc5 = getPackingRc5FlatHeaders();
        var nEsc = escribirPackingRc5RowsEnBloque_(sheet, rowIndices, {
          startCol: rc5Col,
          baseHeaders: baseHeadersRc5,
          packingRows: packingRows,
          packingStartIndex: packingStartIndex,
          fechaInspeccion: fechaInspeccion,
          responsable: responsable,
          horaRecepcion: horaRecepcion,
          nViaje: nViaje
        });

        return {
          ok: true,
          message: 'Packing RC5 guardado en ' + nEsc + ' fila(s)',
          filasEscritas: nEsc,
          packingRc5Muestras: packingRows.length
        };
      } catch (err) {
        return { ok: false, error: err.toString() };
      }
    }

    function doPostPacking(sheet, data) {
      try {
        migrarInsertarHoraRegistroPacking_(sheet);
        var ssPack = sheet.getParent();
        var packCol = packingStartColDesdeHoja_(ssPack, sheet);
        var tkCol = thermokingStartColDesdeHoja_(ssPack, sheet);
        var guardarPacking = (data.guardar_packing === false || data.guardar_packing === 'false') ? false : true;

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

        var flujoTk20 = data.flujo_tk20 === true || data.flujo_tk20 === 'true';

        var lastRow = sheet.getLastRow();
        if (lastRow < 2) {
          return { ok: false, error: 'No hay datos en la hoja' };
        }

        var dataRows = sheet.getRange(2, 1, lastRow, 15).getValues();
        var rowIndices = [];
        for (var k = 0; k < dataRows.length; k++) {
          var r = dataRows[k];
          var rowFechaStr = formatFechaPacking(r[0]);
          var rowEn = (r[IDX_REGISTRO_ENSAYO_NUMERO] != null && r[IDX_REGISTRO_ENSAYO_NUMERO] !== '') ? String(r[IDX_REGISTRO_ENSAYO_NUMERO]).trim() : '';
          if (rowFechaStr === fecha && rowEn === ensayoNumero) {
            rowIndices.push(2 + k);
          }
        }
        if (rowIndices.length === 0) {
          return { ok: false, error: 'No se encontró ninguna fila para esa fecha y ensayo' };
        }

        if (flujoTk20 && guardarPacking) {
          var tk20ColPost = tk20StartColDesdeHoja_(ssPack, sheet);
          var idxHoraRegCampoPost = idxHoraRegCampoEnRow_(ssPack, sheet);
          var numFilasPost = rowIndices.length;
          var filasCampoPost = 0;
          var filasTk20Post = 0;
          var maxClPost = 0;
          for (var rpi = 0; rpi < rowIndices.length; rpi++) {
            var filaPost = rowIndices[rpi];
            var rowCampoPost = sheet.getRange(filaPost, 1, 1, Math.max(15, idxHoraRegCampoPost + 1)).getValues()[0];
            if (campoRowTieneHoraRegistro_(rowCampoPost, idxHoraRegCampoPost)) filasCampoPost++;
            var nClPost = rowCampoPost[14];
            if (nClPost !== null && nClPost !== undefined && String(nClPost).trim() !== '') {
              var nClInt = parseInt(String(nClPost).trim(), 10);
              if (!isNaN(nClInt) && nClInt > 0) maxClPost = Math.max(maxClPost, nClInt);
            }
            var tk20RowPost = sheet.getRange(filaPost, tk20ColPost, 1, TK20_COLS).getValues()[0];
            if (tk20RowTieneHoraRegistro_(tk20RowPost)) filasTk20Post++;
          }
          if (maxClPost <= 0 || maxClPost < numFilasPost) maxClPost = numFilasPost;
          maxClPost = maxClamshellEfectivo_(maxClPost, numFilasPost);
          if (!evaluarCampoCompletoEnServidor_(maxClPost, numFilasPost, filasCampoPost)) {
            return {
              ok: false,
              error: 'Flujo TK-2.0: completa HORA_REGISTRO de Campo (AV Visual / AX Acopio) en todas las filas.'
            };
          }
          if (!evaluarTk20CompletoEnServidor_(maxClPost, numFilasPost, filasTk20Post)) {
            return {
              ok: false,
              error: 'Flujo TK-2.0: completa TK2_HORA_REGISTRO (FG Visual / FI Acopio) en todas las filas.'
            };
          }
        }

        var primeraFila = rowIndices[0];
        var packingYaExiste = rangeRowHasPackingData_(sheet, primeraFila, packCol, PACKING_COLS);
        var guardarThermoking;
        if (data.guardar_thermoking === false || data.guardar_thermoking === 'false') guardarThermoking = false;
        else if (data.guardar_thermoking === true || data.guardar_thermoking === 'true') guardarThermoking = true;
        else guardarThermoking = packingYaExiste ? false : true;

        if (packingYaExiste) {
          if (guardarPacking && packingRows.length) {
            var startColMerge = packCol;
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
          if (guardarThermoking) {
            asegurarEncabezadosThermokingEnHojasRegistro_(sheet.getParent());
            for (var tix = 0; tix < rowIndices.length; tix++) {
              escribirThermokingFilaEnHoja_(
                sheet,
                rowIndices[tix],
                tkCol,
                buildThermokingFlatRow(data, tix)
              );
            }
          }
          if (!guardarThermoking && !(guardarPacking && packingRows.length)) {
            return { ok: false, error: 'Nada que actualizar (packing ya en hoja; sin Thermo King)' };
          }
          return {
            ok: true,
            message: 'Actualización en ' + rowIndices.length + ' fila(s) (packing existente; Thermo según flags)',
            filasEscritas: rowIndices.length,
            packingActualizado: !!(guardarPacking && packingRows.length)
          };
        }

        var startCol = packCol;
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
          asegurarEncabezadosThermokingEnHojasRegistro_(sheet.getParent());
          for (var ti = 0; ti < rowIndices.length; ti++) {
            escribirThermokingFilaEnHoja_(
              sheet,
              rowIndices[ti],
              tkCol,
              buildThermokingFlatRow(data, ti)
            );
          }
        }

        if (!guardarPacking && !guardarThermoking) {
          return { ok: false, error: 'Nada que escribir (guardar_packing y guardar_thermoking en false)' };
        }

        return {
          ok: true,
          message: 'Guardado en ' + rowIndices.length + ' fila(s) (Packing/Thermo según flags)',
          filasEscritas: rowIndices.length,
          packingMuestras: packingRows.length
        };
      } catch (err) {
        return { ok: false, error: err.toString() };
      }
    }

    function tk20PickCtrl_(ctrl, etapaKey, uiSuffix) {
      if (!ctrl || typeof ctrl !== 'object') return '';
      return strCell_(ctrl['tk2_' + etapaKey + '_' + uiSuffix]);
    }

    function tk20PickPres_(pres, etapaKey, uiSuffix) {
      if (!pres || typeof pres !== 'object') return '';
      var k = 'tk2_' + etapaKey + '_' + uiSuffix;
      return strCell_(pres[k]);
    }

    function buildTk20EtapaValues_(data, etapaKey, rowIdx) {
      var et = (data.etapas && data.etapas[etapaKey]) || {};
      var ctrl = data.control || {};
      var pres = et.presion || {};
      var pesos = et.pesos || {};
      var pre = 'tk2_' + etapaKey + '_';
      var out = [];
      out.push(strCell_(et.horaRegistro || ctrl[pre + 'hora'] || ''));
      ['t_amb_ext', 't_amb_acopio', 't_amb_veh', 't_pulpa'].forEach(function (s) {
        out.push(normalizarDecimalMedicionCelda_(tk20PickCtrl_(ctrl, etapaKey, s), 1));
      });
      ['hr_ext', 'hr_acopio', 'hr_veh'].forEach(function (s) {
        out.push(normalizarDecimalMedicionCelda_(tk20PickCtrl_(ctrl, etapaKey, s), 1));
      });
      ['pv_amb_ext', 'pv_amb_acopio', 'pv_amb_veh', 'pv_pulpa'].forEach(function (s) {
        var raw = tk20PickPres_(pres, etapaKey, s) || tk20PickCtrl_(ctrl, etapaKey, s);
        out.push(normalizarPresionVaporCelda_(raw));
      });
      var numPeso = (Number(rowIdx) || 0) + 1;
      var pk = pre + 'peso_' + numPeso;
      var pv = (pesos[pk] != null && pesos[pk] !== '') ? pesos[pk] : '';
      out.push(pv !== '' ? normalizarDecimalMedicionCelda_(pv, 1) : '');
      out.push(strCell_(et.observacion || ''));
      return out;
    }

    function buildTk20FlatRow(data, rowIdx) {
      var fi = strCell_(data.fecha_inspeccion || data.fecha || '');
      var resp = strCell_(data.responsable || '');
      var placa = strCell_(data.placa || '');
      var guia = strCell_(data.guia_remision || '');
      var llegada = buildTk20EtapaValues_(data, 'llegada', rowIdx);
      var traslado = buildTk20EtapaValues_(data, 'traslado', rowIdx);
      var horaReg = strCell_(data.hora_registro || '');
      if (!horaReg) horaReg = formatHoraRegistro_(new Date());
      return [fi, resp, placa, guia].concat(llegada).concat(traslado).concat([horaReg]);
    }

    /** Formato numérico TK-2.0: temp/HR/peso 0.0, presión 0.000 (por etapa Llegada/Traslado). */
    function aplicarFormatoDecimalesTk20EnFila_(sheet, filaHoja, tk20Col) {
      if (!sheet || filaHoja < 2 || !tk20Col) return;
      // Meta = 5 cols. Cada etapa = 14 cols: [hora][T×4][HR×3][PV×4][peso][obs]
      var etapas = [0, 1];
      for (var e = 0; e < etapas.length; e++) {
        var base = tk20Col + TK20_META_COLS + (e * 14);
        sheet.getRange(filaHoja, base + 1, 1, 4).setNumberFormat('0.0');   // T
        sheet.getRange(filaHoja, base + 5, 1, 3).setNumberFormat('0.0');   // HR
        sheet.getRange(filaHoja, base + 8, 1, 4).setNumberFormat('0.000'); // PV
        sheet.getRange(filaHoja, base + 12, 1, 1).setNumberFormat('0.0');  // peso
      }
    }

    function doPostTk20(sheet, data) {
      try {
        if (!sheet) return { ok: false, error: 'Hoja no encontrada' };
        var ss = sheet.getParent();
        asegurarEncabezadosPackingEnHoja_(sheet);
        asegurarEncabezadosTk20EnHoja_(sheet, true);
        var tk20Col = tk20StartColDesdeHoja_(ss, sheet);
        var fecha = (data.fecha != null && data.fecha !== '') ? String(data.fecha).trim() : '';
        var fechaNorm = formatFechaPacking(fecha) || fecha;
        var ensayoNumero = normalizarEnsayoNumeroGs_(data.ensayo_numero);
        if (!fechaNorm || !ensayoNumero) {
          return { ok: false, error: 'Faltan fecha o ensayo_numero' };
        }
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return { ok: false, error: 'No hay datos en la hoja' };
        var dataRows = sheet.getRange(2, 1, lastRow, 15).getValues();
        var rowIndices = [];
        for (var k = 0; k < dataRows.length; k++) {
          var r = dataRows[k];
          var rowFechaStr = formatFechaPacking(r[0]);
          var rowEn = normalizarEnsayoNumeroGs_(r[IDX_REGISTRO_ENSAYO_NUMERO]);
          if (rowFechaStr === fechaNorm && rowEn === ensayoNumero) rowIndices.push(2 + k);
        }
        if (rowIndices.length === 0) {
          return { ok: false, error: 'No se encontró ninguna fila para esa fecha y ensayo' };
        }
        var existente = sheet.getRange(rowIndices[0], tk20Col, 1, TK20_COLS).getValues()[0];
        if (rowTieneTk20Registrado_(existente)) {
          return { ok: false, error: 'TK-2.0 ya registrado para esta muestra' };
        }
        for (var i = 0; i < rowIndices.length; i++) {
          var rowVals = buildTk20FlatRow(data, i);
          if (!rowVals || rowVals.length !== TK20_COLS) {
            return { ok: false, error: 'Datos TK-2.0 incompletos (fila ' + (i + 1) + ')' };
          }
          sheet.getRange(rowIndices[i], tk20Col, 1, rowVals.length).setValues([rowVals]);
          aplicarFormatoDecimalesTk20EnFila_(sheet, rowIndices[i], tk20Col);
        }
        return {
          ok: true,
          message: 'TK-2.0 guardado en ' + rowIndices.length + ' fila(s)',
          filasEscritas: rowIndices.length,
          tk20_col: tk20Col
        };
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
      var dataRows = sheet.getRange(2, 1, lastRow, Math.max(15, IDX_REGISTRO_ENSAYO_NUMERO + 1)).getValues();
      var n = 0;
      for (var k = 0; k < dataRows.length; k++) {
        var rowFechaStr = formatFechaPacking(dataRows[k][0]);
        var rowEnStr = normalizarEnsayoNumeroGs_(dataRows[k][IDX_REGISTRO_ENSAYO_NUMERO]);
        if (rowFechaStr === fechaNorm && rowEnStr === enNorm) n++;
      }
      return n;
    }

    /** Fila 1: columnas Packing + Thermo King + TK-2.0 (col inicio según hoja: Visual 49, Acopio 51). */
    function asegurarEncabezadosPackingEnHoja_(sheet) {
      if (!sheet) return;
      var ss = sheet.getParent();
      if (esHojaRegistroAcopio_(ss, sheet)) {
        migrarRegistro48a50Cols_(sheet);
      } else {
        migrarRegistroVisualQuitarReservas_(sheet, ss);
      }
      migrarInsertarHoraRegistroPacking_(sheet);
      var startCol = packingStartColDesdeHoja_(ss, sheet);
      var packHeaders = ['FECHA_INSPECCION', 'RESPONSABLE', 'HORA_RECEPCION', 'N_VIAJE'].concat(getPackingHeaderNamesPerRow());
      var hPack = String(sheet.getRange(1, startCol).getValue() || '').trim().toUpperCase();
      if (hPack !== 'FECHA_INSPECCION') {
        sheet.getRange(1, startCol, 1, packHeaders.length).setValues([packHeaders]);
      }
      asegurarEncabezadosThermokingEnHoja_(sheet);
      asegurarEncabezadosTk20EnHoja_(sheet, false);
      asegurarEncabezadosPackingRc5EnHoja_(sheet);
    }

    function prepararHojaRegistroCampo_(sheet, esAcopio) {
      if (!sheet) return;
      if (esAcopio) {
        asegurarEncabezadoHoja3Acopio_(sheet);
      } else {
        asegurarEncabezadoHoja1Registro_(sheet);
      }
    }

    /** Packing y detalle: ACOPIO o VISUAL; auto-detecta por fecha+ensayo. */
    function resolverHojaRegistroPacking_(ss, params) {
      var fecha = String((params && params.fecha) || '').trim();
      var ensayo = String((params && params.ensayo_numero) || '').trim();
      var s1 = obtenerHojaPorIndice_(ss, SHEET_IDX_VISUAL_REGISTRO);
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

    /** Clave resumen/listado: modo + num_muestra + ensayo (Visual y Acopio nunca se mezclan). */
    function claveResumenMuestraEnsayo_(modoRegistro, numMuestra, ensayoNumero) {
      var modo = String(modoRegistro || '').trim().toLowerCase();
      if (modo !== 'acopio') modo = 'visual';
      var num = String(numMuestra || '').trim();
      var en = normalizarEnsayoNumeroGs_(ensayoNumero);
      return modo + '|' + num + '|' + en;
    }

    function resumenEnsayosFechaPlanilla_(ss, fechaLm) {
      var out = {};
      var hojas = hojasRegistroNumMuestra_(ss);
      for (var hi = 0; hi < hojas.length; hi++) {
        var sh = hojas[hi];
        var modoHoja = modoRegistroDesdeHoja_(ss, sh);
        migrarInsertarHoraRegistroPacking_(sh);
        migrarInsertarHoraRegistroThermoking_(sh);
        var lr = sh.getLastRow();
        if (lr < 2) continue;
        var numFilas = lr - 1;
        var idxNum = indiceColumnaNumMuestraHoja1_(sh);
        var numColsReg = numColsRegistroDesdeHoja_(ss, sh);
        var idxHoraRegCampo = idxHoraRegCampoEnRow_(ss, sh);
        var packCol = packingStartColDesdeHoja_(ss, sh);
        var tkCol = thermokingStartColDesdeHoja_(ss, sh);
        var tk20Col = tk20StartColDesdeHoja_(ss, sh);
        var data = sh.getRange(2, 1, numFilas, Math.max(15, numColsReg, idxNum + 1)).getValues();
        var packBlock = sh.getRange(2, packCol, numFilas, PACKING_COLS).getValues();
        var tkBlock = sh.getRange(2, tkCol, numFilas, THERMOKING_COLS).getValues();
        var tk20Block = sh.getRange(2, tk20Col, numFilas, TK20_COLS).getValues();
        for (var i = 0; i < data.length; i++) {
          var r = data[i];
          var fl = formatFechaPacking(r[0]);
          if (fl !== fechaLm) continue;
          var enStr = normalizarEnsayoNumeroGs_(r[IDX_REGISTRO_ENSAYO_NUMERO]);
          if (!enStr) continue;
          var numStr = (r.length > idxNum && r[idxNum] != null && r[idxNum] !== undefined)
            ? String(r[idxNum]).trim()
            : '';
          if (!numStr) continue;
          var keyRs = claveResumenMuestraEnsayo_(modoHoja, numStr, enStr);
          if (!out[keyRs]) {
            out[keyRs] = {
              numFilas: 0,
              maxClamshell: 0,
              filasCampoConHoraRegistro: 0,
              filasPackingConDatos: 0,
              filasPackingConHoraRegistro: 0,
              filasTkConHoraRegistro: 0,
              filasTk20ConHoraRegistro: 0,
              fundo: '',
              tieneThermoKing: false,
              tieneTk20: false
            };
          }
          var g = out[keyRs];
          g.numFilas++;
          if (!g.fundo && r.length > IDX_REGISTRO_FUNDO) {
            var fndRs = strCell_(r[IDX_REGISTRO_FUNDO]);
            if (fndRs) g.fundo = fndRs;
          }
          var nClRaw = r[IDX_REGISTRO_N_CLAMSHELL];
          if (nClRaw !== null && nClRaw !== undefined && String(nClRaw).trim() !== '') {
            var nCl = parseInt(String(nClRaw).trim(), 10);
            if (!isNaN(nCl) && nCl > 0) g.maxClamshell = Math.max(g.maxClamshell, nCl);
          }
          if (campoRowTieneHoraRegistro_(r, idxHoraRegCampo)) g.filasCampoConHoraRegistro++;
          var packRow = packBlock[i] || [];
          if (rowHasPackingData_(packRow)) g.filasPackingConDatos++;
          if (packRowTieneHoraRegistro_(packRow)) g.filasPackingConHoraRegistro++;
          if (tkBlock[i] && tkRowTieneHoraRegistro_(tkBlock[i])) g.filasTkConHoraRegistro++;
          if (tkBlock[i] && rowTieneThermokingRegistrado_(tkBlock[i])) g.tieneThermoKing = true;
          if (tk20Block[i] && tk20RowTieneHoraRegistro_(tk20Block[i])) g.filasTk20ConHoraRegistro++;
          if (tk20Block[i] && rowTieneTk20Registrado_(tk20Block[i])) g.tieneTk20 = true;
        }
      }
      Object.keys(out).forEach(function (en) {
        var g = out[en];
        g.maxClamshell = maxClamshellEfectivo_(g.maxClamshell, g.numFilas);
        g.campo_completo_hora_registro = evaluarCampoCompletoEnServidor_(
          g.maxClamshell, g.numFilas, g.filasCampoConHoraRegistro
        );
        g.tiene_campo_hora_registro = g.filasCampoConHoraRegistro > 0;
        g.packing_completo_en_servidor = evaluarPackingCompletoEnServidor_(
          g.maxClamshell, g.filasPackingConDatos, g.filasPackingConHoraRegistro
        );
        g.thermoking_completo_hora_registro = evaluarThermokingCompletoEnServidor_(
          g.maxClamshell, g.filasTkConHoraRegistro
        );
        g.tk20_completo_hora_registro = evaluarTk20CompletoEnServidor_(
          g.maxClamshell, g.numFilas, g.filasTk20ConHoraRegistro
        );
        g.puede_continuar_packing_rc5 = evaluarPuedeContinuarPackingRc5_(
          g.campo_completo_hora_registro,
          g.packing_completo_en_servidor,
          g.thermoking_completo_hora_registro
        );
        g.puede_continuar_thermoking = g.packing_completo_en_servidor && !g.tieneThermoKing;
        g.puede_continuar_tk20 = evaluarPuedeContinuarTk20_(g.campo_completo_hora_registro, g.tieneTk20);
        aplicarGateFundoFlujoTk20EnFlags_(g, g.fundo);
      });
      return out;
    }

    /** Packing / TK-2.0: muestras del día — VISUAL + ACOPIO (misma lógica que Packing/MP-TK: una entrada por num|ensayo). */
    function listadoMuestrasPorFechaGlobal_(ss, fechaRaw, opts) {
      opts = opts || {};
      var fechaLm = formatFechaPacking(fechaRaw) || String(fechaRaw || '').trim();
      if (!fechaLm) {
        return { ok: false, error: 'Falta parámetro: fecha', fecha: '', muestras: [] };
      }
      var muestrasLm = [];
      var seenLm = {};
      var hojasLm = hojasRegistroNumMuestra_(ss);
      for (var hli = 0; hli < hojasLm.length; hli++) {
        var shLm = hojasLm[hli];
        var modoLm = modoRegistroDesdeHoja_(ss, shLm);
        var lrLm = shLm.getLastRow();
        if (lrLm < 2) continue;
        var idxLm = indiceColumnaNumMuestraHoja1_(shLm);
        var dataLm = shLm.getRange(2, 1, lrLm - 1, Math.max(15, IDX_REGISTRO_ENSAYO_NUMERO + 1, idxLm + 1)).getValues();
        for (var lmi = 0; lmi < dataLm.length; lmi++) {
          var rl = dataLm[lmi];
          var fl = formatFechaPacking(rl[0]);
          if (fl !== fechaLm) continue;
          var enStrLm = normalizarEnsayoNumeroGs_(rl[IDX_REGISTRO_ENSAYO_NUMERO]);
          var numLm = (rl.length > idxLm && rl[idxLm] != null && rl[idxLm] !== undefined)
            ? String(rl[idxLm]).trim()
            : '';
          if (!enStrLm || !numLm) continue;
          var keyLm = claveResumenMuestraEnsayo_(modoLm, numLm, enStrLm);
          if (seenLm[keyLm]) continue;
          seenLm[keyLm] = true;
          var metaHojaLm = {
            modo_registro: modoLm,
            hoja_registro: modoLm === 'acopio'
              ? SHEET_NOMBRES[SHEET_IDX_ACOPIO_REGISTRO]
              : SHEET_NOMBRES[SHEET_IDX_VISUAL_REGISTRO]
          };
          muestrasLm.push({
            num_muestra: numLm,
            ensayo_numero: enStrLm,
            etiqueta: numLm + ' - ' + enStrLm + ' muestra',
            modo_registro: metaHojaLm.modo_registro,
            hoja_registro: metaHojaLm.hoja_registro
          });
        }
      }
      muestrasLm.sort(function (a, b) {
        var na = Number(a.ensayo_numero) || 0;
        var nb = Number(b.ensayo_numero) || 0;
        if (na !== nb) return na - nb;
        return String(a.num_muestra).localeCompare(String(b.num_muestra));
      });
      var resumenTk = resumenEnsayosFechaPlanilla_(ss, fechaLm);
      for (var mxi = 0; mxi < muestrasLm.length; mxi++) {
        var mx = muestrasLm[mxi];
        var rs = resumenTk[claveResumenMuestraEnsayo_(mx.modo_registro, mx.num_muestra, mx.ensayo_numero)] || {};
        mx.filasCampoConHoraRegistro = Number(rs.filasCampoConHoraRegistro) || 0;
        mx.numFilas = Number(rs.numFilas) || 0;
        mx.maxClamshell = Number(rs.maxClamshell) || 0;
        mx.campo_completo_hora_registro = rs.campo_completo_hora_registro === true;
        mx.tiene_campo_hora_registro = rs.tiene_campo_hora_registro === true;
        mx.packing_completo_en_servidor = rs.packing_completo_en_servidor === true;
        mx.thermoking_completo_hora_registro = rs.thermoking_completo_hora_registro === true;
        mx.puede_continuar_packing_rc5 = rs.puede_continuar_packing_rc5 === true;
        mx.puede_continuar_thermoking = rs.puede_continuar_thermoking === true;
        mx.tieneThermoKing = rs.tieneThermoKing === true;
        mx.tieneTk20 = rs.tieneTk20 === true;
        mx.puede_continuar_tk20 = rs.puede_continuar_tk20 === true;
        mx.FUNDO = String(rs.fundo || '').trim();
        mx.fundo_habilita_flujo_tk20 = rs.fundo_habilita_flujo_tk20 === true;
      }
      if (opts.soloTk20 === true) {
        muestrasLm = muestrasLm.filter(function (mx) {
          return mx.puede_continuar_tk20 === true;
        });
      }
      return { ok: true, fecha: fechaLm, muestras: muestrasLm };
    }

    /** Solo lectura: VISUAL o ACOPIO donde exista fecha+ensayo (primera hoja con datos, igual que MP-TK). */
    function encontrarHojaRegistroFechaEnsayo_(ss, fechaNorm, ensayoNorm) {
      var hojas = hojasRegistroNumMuestra_(ss);
      for (var i = 0; i < hojas.length; i++) {
        if (contarFilasFechaEnsayoEnHoja_(hojas[i], fechaNorm, ensayoNorm) > 0) return hojas[i];
      }
      return null;
    }

    /** GET rápido: detalle por fecha + ensayo. Usa modo_registro para ACOPIO (no mezclar con VISUAL). */
    function obtenerDetalleRegistroCampoPacking_(ss, fechaRaw, ensayoRaw, params) {
      var fecha = formatFechaPacking(fechaRaw) || String(fechaRaw || '').trim();
      var enNorm = normalizarEnsayoNumeroGs_(ensayoRaw);
      if (!fecha || !enNorm) {
        return { ok: false, error: 'Faltan parámetros: fecha y ensayo_numero', data: null };
      }
      var resolverParams = {
        fecha: fecha,
        ensayo_numero: enNorm,
        modo_registro: (params && (params.modo_registro || params.modoRegistro)) || ''
      };
      var sheet = resolverHojaRegistroPacking_(ss, resolverParams);
      if (!sheet) {
        return { ok: false, error: 'No hay registro para esa fecha y ensayo', data: null };
      }
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return { ok: false, error: 'No hay registro para esa fecha y ensayo', data: null };
      }
      var numFilasData = lastRow;
      var idxNumRow = indiceColumnaNumMuestraHoja1_(sheet);
      var idxDespacho = idxColPesoDespachoDesdeHoja_(ss, sheet);
      var numColsReg = numColsRegistroDesdeHoja_(ss, sheet);
      var idxHoraRegCampo = idxHoraRegCampoEnRow_(ss, sheet);
      var baseCols = Math.max(15, idxNumRow + 1, idxDespacho + 1, numColsReg, IDX_REGISTRO_N_CLAMSHELL + 1);
      var data = sheet.getRange(2, 1, numFilasData, baseCols).getValues();
      var packCol = packingStartColDesdeHoja_(ss, sheet);
      var tkCol = thermokingStartColDesdeHoja_(ss, sheet);
      var tk20Col = tk20StartColDesdeHoja_(ss, sheet);
      var rc5Col = packingRc5StartColDesdeHoja_(ss, sheet);
      var packBlock = sheet.getRange(2, packCol, numFilasData, PACKING_COLS).getValues();
      var tkBlock = sheet.getRange(2, tkCol, numFilasData, THERMOKING_COLS).getValues();
      var tk20Block = sheet.getRange(2, tk20Col, numFilasData, TK20_COLS).getValues();
      var rc5Block = sheet.getRange(2, rc5Col, numFilasData, PACKING_RC5_COLS).getValues();

      var row = null;
      var filaEnSheet = null;
      var numFilas = 0;
      var filasPackingConDatos = 0;
      var filasPackingRegistradas = 0;
      var filasPackingConHoraRegistro = 0;
      var filasPackingRc5ConDatos = 0;
      var filasPackingRc5ConHoraRegistro = 0;
      var filasCampoConHoraRegistro = 0;
      var filasTkConHoraRegistro = 0;
      var filasTk20ConHoraRegistro = 0;
      var horasRegistroPacking = [];
      var horasRegistroCampo = [];
      var despachoPorFila = [];
      var pesoDespachoTkPorFila = [];
      var pesoSalidaPrefrioPorFila = [];
      var nClamshellPorFilaMatch = [];
      var tienePacking = false;
      var tieneThermoKing = false;
      var tieneTk20 = false;
      var tk20MetaPrimera = null;
      var packMetaPrimera = null;
      var tkMetaPrimera = null;

      for (var k = 0; k < data.length; k++) {
        var r = data[k];
        var rowFechaStr = formatFechaPacking(r[0]);
        var rowEnStr = normalizarEnsayoNumeroGs_(r[IDX_REGISTRO_ENSAYO_NUMERO]);
        if (rowFechaStr !== fecha || rowEnStr !== enNorm) continue;
        var packRow = packBlock[k] || [];
        if (row == null) {
          row = r;
          filaEnSheet = 2 + k;
          packMetaPrimera = packRow;
        }
        if (tkBlock[k] && tkMetaPrimera == null) {
          tkMetaPrimera = tkBlock[k];
        }
        numFilas++;
        var tkRowK = tkBlock[k] || [];
        pesoDespachoTkPorFila.push(pesoDespachoTkDesdeTkRow_(tkRowK));
        var desp = r[idxDespacho];
        var numDesp = (desp !== null && desp !== undefined && String(desp).trim() !== '')
          ? parseFloat(String(desp).replace(',', '.'))
          : NaN;
        despachoPorFila.push(!isNaN(numDesp) ? numDesp : null);
        pesoSalidaPrefrioPorFila.push(pesoSalidaPrefrioDesdePackRow_(packRow));
        nClamshellPorFilaMatch.push(parseNClamshellRegistroGs_(r[IDX_REGISTRO_N_CLAMSHELL]) || numFilas);
        var rc5Row = rc5Block[k] || [];
        if (rowHasPackingRc5Data_(rc5Row)) filasPackingRc5ConDatos++;
        if (rc5RowTieneHoraRegistro_(rc5Row)) filasPackingRc5ConHoraRegistro++;
        if (rowHasPackingData_(packRow)) {
          tienePacking = true;
          filasPackingConDatos++;
        }
        if (packRowTieneHoraRegistro_(packRow)) {
          filasPackingRegistradas++;
          filasPackingConHoraRegistro++;
          horasRegistroPacking.push(packRowValorHoraRegistro_(packRow));
        }
        if (campoRowTieneHoraRegistro_(r, idxHoraRegCampo)) {
          filasCampoConHoraRegistro++;
          horasRegistroCampo.push(campoRowValorHoraRegistro_(r, idxHoraRegCampo));
        }
        if (tkBlock[k] && tkRowTieneHoraRegistro_(tkBlock[k])) filasTkConHoraRegistro++;
        if (tk20Block[k] && tk20RowTieneHoraRegistro_(tk20Block[k])) filasTk20ConHoraRegistro++;
        if (tkBlock[k] && rowTieneThermokingRegistrado_(tkBlock[k])) tieneThermoKing = true;
        if (tk20Block[k] && rowTieneTk20Registrado_(tk20Block[k])) {
          tieneTk20 = true;
          if (!tk20MetaPrimera) tk20MetaPrimera = tk20Block[k];
        }
      }

      // Precisión Packing: índice 0 = clamshell #1 … aunque el orden físico en hoja no sea 1→8.
      despachoPorFila = reordenarValoresPorNClamshellGs_(nClamshellPorFilaMatch, despachoPorFila);
      pesoDespachoTkPorFila = reordenarValoresPorNClamshellGs_(nClamshellPorFilaMatch, pesoDespachoTkPorFila);
      pesoSalidaPrefrioPorFila = reordenarValoresPorNClamshellGs_(nClamshellPorFilaMatch, pesoSalidaPrefrioPorFila);

      if (!row) {
        return { ok: false, error: 'No hay registro para esa fecha y ensayo', data: null };
      }

      var nClamshellRaw = row[IDX_REGISTRO_N_CLAMSHELL];
      var maxClamshell = 0;
      if (nClamshellRaw !== null && nClamshellRaw !== undefined && String(nClamshellRaw).trim() !== '') {
        var nCl = parseInt(String(nClamshellRaw).trim(), 10);
        if (!isNaN(nCl) && nCl > 0) maxClamshell = nCl;
      }
      if (numFilas > 0 && (maxClamshell <= 0 || maxClamshell < numFilas)) {
        maxClamshell = numFilas;
      }
      maxClamshell = maxClamshellEfectivo_(maxClamshell, numFilas);
      var despachoRaw = row[idxDespacho];
      var despachoGramos = null;
      if (despachoRaw !== null && despachoRaw !== undefined && String(despachoRaw).trim() !== '') {
        var numDesp2 = parseFloat(String(despachoRaw).replace(',', '.'));
        if (!isNaN(numDesp2)) despachoGramos = numDesp2;
      }

      var packingCompletoEnServidor = evaluarPackingCompletoEnServidor_(
        maxClamshell, filasPackingConDatos, filasPackingConHoraRegistro
      );
      var puedeContinuarThermoking = packingCompletoEnServidor && !tieneThermoKing;
      var puedeRegistrarMasPacking = maxClamshell > 0
        ? (filasPackingConHoraRegistro > 0
          ? (filasPackingConHoraRegistro < maxClamshell)
          : (filasPackingConDatos < maxClamshell))
        : true;
      var horaRegistroPackingUltima = horasRegistroPacking.length
        ? horasRegistroPacking[horasRegistroPacking.length - 1]
        : '';
      var horaRegistroCampoUltima = horasRegistroCampo.length
        ? horasRegistroCampo[horasRegistroCampo.length - 1]
        : '';
      var campoCompletoHoraRegistro = evaluarCampoCompletoEnServidor_(
        maxClamshell, numFilas, filasCampoConHoraRegistro
      );
      var thermokingCompletoHoraRegistro = evaluarThermokingCompletoEnServidor_(
        maxClamshell, filasTkConHoraRegistro
      );
      var tk20CompletoHoraRegistro = evaluarTk20CompletoEnServidor_(
        maxClamshell, numFilas, filasTk20ConHoraRegistro
      );
      var puedeContinuarPackingRc5 = evaluarPuedeContinuarPackingRc5_(
        campoCompletoHoraRegistro, packingCompletoEnServidor, thermokingCompletoHoraRegistro
      );
      var puedeContinuarTk20 = evaluarPuedeContinuarTk20_(campoCompletoHoraRegistro, tieneTk20);
      var fundoRegistro = strCell_(row[IDX_REGISTRO_FUNDO]);
      var flagsFundoTk20 = aplicarGateFundoFlujoTk20EnFlags_({
        puede_continuar_packing_rc5: puedeContinuarPackingRc5,
        puede_continuar_thermoking: puedeContinuarThermoking,
        puede_continuar_tk20: puedeContinuarTk20
      }, fundoRegistro);
      puedeContinuarPackingRc5 = flagsFundoTk20.puede_continuar_packing_rc5;
      puedeContinuarThermoking = flagsFundoTk20.puede_continuar_thermoking;
      puedeContinuarTk20 = flagsFundoTk20.puede_continuar_tk20;
      var fundoHabilitaFlujoTk20 = flagsFundoTk20.fundo_habilita_flujo_tk20 === true;
      var respTk20 = tk20MetaPrimera ? strCell_(tk20MetaPrimera[1]) : '';
      var placaTk20 = tk20MetaPrimera ? strCell_(tk20MetaPrimera[2]) : '';
      var placaTkMp = tkMetaPrimera ? strCell_(tkMetaPrimera[3]) : '';
      var guiaTk20 = tk20MetaPrimera ? strCell_(tk20MetaPrimera[3]) : '';
      var trazAcopioCelda = strCell_(row[IDX_REGISTRO_TRAZ_ACOPIO]);
      var metaHojaDet = metaHojaRegistro_(ss, sheet);

      return {
        ok: true,
        data: {
          fila: filaEnSheet,
          modo_registro: metaHojaDet.modo_registro,
          hoja_registro: metaHojaDet.hoja_registro,
          numFilas: numFilas,
          FILAS_REGISTRADAS: numFilas,
          FILAS_TOTAL_CAMPO: numFilas,
          FILAS_PACKING_REGISTRADAS: filasPackingRegistradas,
          FILAS_PACKING_CON_HORA_REGISTRO: filasPackingConHoraRegistro,
          FILAS_PACKING_CON_DATOS: filasPackingConDatos,
          FILAS_PACKING_RC5_REGISTRADAS: filasPackingRc5ConHoraRegistro,
          FILAS_PACKING_RC5_CON_HORA_REGISTRO: filasPackingRc5ConHoraRegistro,
          FILAS_PACKING_RC5_CON_DATOS: filasPackingRc5ConDatos,
          FILAS_CAMPO_CON_HORA_REGISTRO: filasCampoConHoraRegistro,
          FILAS_TK_CON_HORA_REGISTRO: filasTkConHoraRegistro,
          FILAS_TK20_CON_HORA_REGISTRO: filasTk20ConHoraRegistro,
          HORAS_REGISTRO_PACKING: horasRegistroPacking,
          HORAS_REGISTRO_CAMPO: horasRegistroCampo,
          HORA_REGISTRO_PACKING: horaRegistroPackingUltima,
          HORA_REGISTRO_CAMPO: horaRegistroCampoUltima,
          campo_completo_hora_registro: campoCompletoHoraRegistro,
          tiene_campo_hora_registro: filasCampoConHoraRegistro > 0,
          packing_completo_en_servidor: packingCompletoEnServidor,
          thermoking_completo_hora_registro: thermokingCompletoHoraRegistro,
          tk20_completo_hora_registro: tk20CompletoHoraRegistro,
          puede_continuar_packing_rc5: puedeContinuarPackingRc5,
          puede_continuar_thermoking: puedeContinuarThermoking,
          tieneTk20: tieneTk20,
          puede_continuar_tk20: puedeContinuarTk20,
          fundo_habilita_flujo_tk20: fundoHabilitaFlujoTk20,
          MAX_CLAMSHELL: maxClamshell,
          N_CLAMSHELL: (nClamshellRaw !== null && nClamshellRaw !== undefined) ? String(nClamshellRaw).trim() : '',
          puede_registrar_mas: puedeRegistrarMasPacking,
          tienePacking: tienePacking,
          tieneThermoKing: tieneThermoKing,
          despachoPorFila: despachoPorFila,
          pesoDespachoTkPorFila: pesoDespachoTkPorFila,
          pesoSalidaPrefrioPorFila: pesoSalidaPrefrioPorFila,
          DESPACHO_ACOPIO: despachoGramos,
          despacho_acopio_gramos: despachoGramos,
          ENSAYO_NOMBRE: row[1],
          NUM_MUESTRA: (row.length > idxNumRow && row[idxNumRow] != null && row[idxNumRow] !== undefined)
            ? String(row[idxNumRow]).trim()
            : '',
          RESPONSABLE: row[3],
          RESPONSABLE_TK: respTk20 || row[3],
          ENSAYO_NUMERO: row[IDX_REGISTRO_ENSAYO_NUMERO],
          TRAZ_ETAPA: row[7],
          TRAZ_CAMPO: row[8],
          TRAZ_TURNO: row[9],
          TRAZ_ACOPIO: trazAcopioCelda,
          VARIEDAD: row[10],
          PLACA_VEHICULO: placaTk20 || row[IDX_REGISTRO_PLACA],
          PLACA_TK: placaTkMp,
          FUNDO: fundoRegistro,
          GUIA_REMISION: guiaTk20 || row[11],
          N_VIAJE: (packMetaPrimera && packMetaPrimera[3] != null && packMetaPrimera[3] !== '')
            ? String(packMetaPrimera[3]).trim()
            : '',
          n_viaje: (packMetaPrimera && packMetaPrimera[3] != null && packMetaPrimera[3] !== '')
            ? String(packMetaPrimera[3]).trim()
            : '',
          HORA_RECEPCION: (packMetaPrimera && packMetaPrimera[2] != null && packMetaPrimera[2] !== '')
            ? String(packMetaPrimera[2]).trim()
            : ''
        }
      };
    }

    /** GET listado_registrados — solo lectura, hoy/ayer, sin migraciones. */
    function formatFechaHistorialGet_(val) {
      if (val === null || val === undefined || val === '') return '';
      if (val instanceof Date) return Utilities.formatDate(val, 'GMT', 'yyyy-MM-dd');
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
      if (d && !isNaN(d.getTime())) return Utilities.formatDate(d, 'GMT', 'yyyy-MM-dd');
      return s;
    }

    function fechasHistorialRangoDefecto_() {
      var tz = Session.getScriptTimeZone() || 'America/Lima';
      var now = new Date();
      var hoy = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
      var ayer = Utilities.formatDate(new Date(now.getTime() - 86400000), tz, 'yyyy-MM-dd');
      return { desde: ayer, hasta: hoy };
    }

    function normalizarFechaParamHistorialGet_(val) {
      var s = (val != null && val !== '') ? String(val).trim() : '';
      if (!s) return '';
      return formatFechaHistorialGet_(s) || s;
    }

    function fechaEnRangoHistorialGet_(f, desde, hasta) {
      if (!f) return false;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    }

    function tipoDatoHistorialDesdeFlags_(tieneCampo, tienePacking) {
      if (tieneCampo && tienePacking) return 'ambos';
      if (tienePacking) return 'packing';
      return 'campo';
    }

    function listadoRegistradosHistorial_(ss, params) {
      params = params || {};
      var rangoHist = fechasHistorialRangoDefecto_();
      var fechaDesdeHist = normalizarFechaParamHistorialGet_(params.fecha_desde) || rangoHist.desde;
      var fechaHastaHist = normalizarFechaParamHistorialGet_(params.fecha_hasta) || rangoHist.hasta;
      if (fechaDesdeHist && fechaHastaHist && fechaDesdeHist > fechaHastaHist) {
        var tmpHist = fechaDesdeHist;
        fechaDesdeHist = fechaHastaHist;
        fechaHastaHist = tmpHist;
      }
      var registrados = [];
      var hojasHist = hojasRegistroConDatos_(ss);
      for (var hhi = 0; hhi < hojasHist.length; hhi++) {
        var shHist = hojasHist[hhi];
        var lrHist = shHist.getLastRow();
        if (lrHist < 2) continue;
        var numFilasHist = lrHist - 1;
        var fechasCol = shHist.getRange(2, 1, numFilasHist, 1).getValues();
        var tieneFilasEnRango = false;
        for (var fi = 0; fi < fechasCol.length; fi++) {
          if (fechaEnRangoHistorialGet_(formatFechaHistorialGet_(fechasCol[fi][0]), fechaDesdeHist, fechaHastaHist)) {
            tieneFilasEnRango = true;
            break;
          }
        }
        if (!tieneFilasEnRango) continue;

        var idxNumHist = indiceColumnaNumMuestraHoja1_(shHist);
        var numColsHist = numColsRegistroDesdeHoja_(ss, shHist);
        var packColHist = packingStartColDesdeHoja_(ss, shHist);
        var tkColHist = thermokingStartColDesdeHoja_(ss, shHist);
        var tk20ColHist = tk20StartColDesdeHoja_(ss, shHist);
        var rc5ColHist = packingRc5StartColDesdeHoja_(ss, shHist);
        var idxHoraReg = numColsHist - 1;
        var baseW = Math.max(15, idxNumHist + 1, idxHoraReg + 1, IDX_REGISTRO_FUNDO + 1);
        var dataHist = shHist.getRange(2, 1, numFilasHist, baseW).getValues();
        var needTk20Rc5 = false;
        for (var si = 0; si < dataHist.length; si++) {
          var fScan = formatFechaHistorialGet_(dataHist[si][0]);
          if (!fechaEnRangoHistorialGet_(fScan, fechaDesdeHist, fechaHastaHist)) continue;
          var fundoScan = (dataHist[si].length > IDX_REGISTRO_FUNDO && dataHist[si][IDX_REGISTRO_FUNDO] != null)
            ? String(dataHist[si][IDX_REGISTRO_FUNDO]).trim() : '';
          if (fundoHabilitaFlujoTk20_(fundoScan)) {
            needTk20Rc5 = true;
            break;
          }
        }
        var packBlock = shHist.getRange(2, packColHist, numFilasHist, PACKING_COLS).getValues();
        var tkBlock = shHist.getRange(2, tkColHist, numFilasHist, THERMOKING_COLS).getValues();
        var tk20Block = needTk20Rc5
          ? shHist.getRange(2, tk20ColHist, numFilasHist, TK20_COLS).getValues()
          : null;
        var rc5Block = needTk20Rc5
          ? shHist.getRange(2, rc5ColHist, numFilasHist, PACKING_RC5_COLS).getValues()
          : null;
        var esHojaAcopio = esHojaRegistroAcopio_(ss, shHist);
        for (var i = 0; i < dataHist.length; i++) {
          var r = dataHist[i];
          var f = formatFechaHistorialGet_(r[0]);
          if (!fechaEnRangoHistorialGet_(f, fechaDesdeHist, fechaHastaHist)) continue;
          var en = r[IDX_REGISTRO_ENSAYO_NUMERO];
          var enStr = (en !== null && en !== undefined && en !== '') ? (Number(en) === Math.floor(Number(en)) ? String(Number(en)) : String(en).trim()) : '';
          var nom = (r[1] != null && r[1] !== undefined && String(r[1]).trim() !== '') ? String(r[1]).trim() : ('Ensayo ' + enStr);
          var numMuestra = (r.length > idxNumHist && r[idxNumHist] != null && r[idxNumHist] !== undefined) ? String(r[idxNumHist]).trim() : '';
          var nClamshell = (r[IDX_REGISTRO_N_CLAMSHELL] != null && r[IDX_REGISTRO_N_CLAMSHELL] !== undefined) ? String(r[IDX_REGISTRO_N_CLAMSHELL]).trim() : '';
          if (!f || enStr === '') continue;
          var horaRegistro = (r.length > idxHoraReg) ? formatHoraRegistro_(r[idxHoraReg]) : '';
          var packingSlice = packBlock[i] || [];
          var tkSlice = tkBlock[i] || [];
          var tk20Slice = tk20Block ? (tk20Block[i] || []) : [];
          var rc5Slice = rc5Block ? (rc5Block[i] || []) : [];
          var tienePacking = rowHasPackingData_(packingSlice);
          var tieneThermoKing = rowTieneThermokingRegistrado_(tkSlice);
          var tieneTk20 = tk20Block ? tk20RowTieneHoraRegistro_(tk20Slice) : false;
          var tienePackingRc5 = rc5Block ? rc5RowTieneHoraRegistro_(rc5Slice) : false;
          var horaPacking = packRowTieneHoraRegistro_(packingSlice) ? packRowValorHoraRegistro_(packingSlice) : '';
          var horaMptk = tieneThermoKing ? horaMptkDesdeFilaTk_(tkSlice) : '';
          var horaTk20 = tieneTk20 ? formatHoraRegistro_(tk20Slice[IDX_HORA_REG_EN_TK20_ROW]) : '';
          var horaPackingRc5 = tienePackingRc5 ? formatHoraRegistro_(rc5Slice[IDX_RC5_HORA_REG_EN_ROW]) : '';
          var fundoReg = (r.length > IDX_REGISTRO_FUNDO && r[IDX_REGISTRO_FUNDO] != null)
            ? String(r[IDX_REGISTRO_FUNDO]).trim() : '';
          var fundoHabilitaFlujoTk20 = fundoHabilitaFlujoTk20_(fundoReg);
          var tieneCampo = !!(numMuestra || nClamshell || rowHasAnyNonEmpty_(r.slice(2, Math.min(r.length, idxHoraReg))));
          registrados.push({
            fecha: f,
            ensayo_numero: enStr,
            ensayo_nombre: nom,
            num_muestra: numMuestra,
            n_clamshell: nClamshell,
            hora_registro: horaRegistro,
            hora_packing: horaPacking,
            hora_mptk: horaMptk,
            hora_tk20: horaTk20,
            hora_packing_rc5: horaPackingRc5,
            tiene_campo: tieneCampo,
            tiene_packing: tienePacking,
            tiene_mptk: tieneThermoKing,
            tiene_thermoking: tieneThermoKing,
            tiene_tk20: tieneTk20,
            tiene_packing_rc5: tienePackingRc5,
            fundo: fundoReg,
            fundo_habilita_flujo_tk20: fundoHabilitaFlujoTk20,
            modo_registro: esHojaAcopio ? 'acopio' : 'visual',
            tipo_dato: tipoDatoHistorialDesdeFlags_(tieneCampo, tienePacking)
          });
        }
      }
      return {
        ok: true,
        registrados: registrados,
        fecha_desde: fechaDesdeHist,
        fecha_hasta: fechaHastaHist
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
          result.ensayos_visual = [];
          result.ensayos_acopio = [];
          var fechaOp = (params.fecha || '').toString().trim();
          if (fechaOp) {
            var fechaOpNorm = formatFechaPacking(fechaOp) || fechaOp;
            result.ensayos_visual = ensayosRegistradosEnFechaPorModo_(ssOp, fechaOpNorm, false);
            result.ensayos_acopio = ensayosRegistradosEnFechaPorModo_(ssOp, fechaOpNorm, true);
            // Legacy: unión (otros módulos). Campo/Acopio usan ensayos_visual / ensayos_acopio.
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

        // Packing / TK-2.0 — dropdown MUESTRA: todas las del día (Visual H1 + Acopio H3).
        var listadoMuestrasFechaEarly = (params.listado_muestras_fecha || '').toString().trim() === '1';
        if (listadoMuestrasFechaEarly) {
          if (!fechaParam) {
            result.error = 'Falta parámetro: fecha';
            return returnOutput(result);
          }
          var soloTk20 = (params.filtro_tk20 || params.solo_tk20 || '').toString().trim() === '1';
          var ssLm = SpreadsheetApp.getActiveSpreadsheet();
          var lmOut = listadoMuestrasPorFechaGlobal_(ssLm, fechaParam, { soloTk20: soloTk20 });
          result.ok = lmOut.ok;
          result.fecha = lmOut.fecha;
          result.muestras = lmOut.muestras;
          if (lmOut.error) result.error = lmOut.error;
          return returnOutput(result);
        }

        // Historial (hoy/ayer) — ruta rápida sin migrar ni leer hoja entera de más.
        var listadoRegEarly = (params.listado_registrados || '').toString().trim() === '1';
        if (listadoRegEarly) {
          var ssHistEarly = SpreadsheetApp.getActiveSpreadsheet();
          var histEarly = listadoRegistradosHistorial_(ssHistEarly, params);
          result.ok = histEarly.ok;
          result.registrados = histEarly.registrados;
          result.fecha_desde = histEarly.fecha_desde;
          result.fecha_hasta = histEarly.fecha_hasta;
          return returnOutput(result);
        }

        // Detalle campo/Packing por fecha + ensayo (ruta rápida; sin migrar ni leer toda la hoja).
        var pedidoDetalleCampo = fechaParam && ensayoNumero
          && (params.listado_registrados || '').toString().trim() !== '1'
          && (params.existe_registro || '').toString().trim() !== '1';
        if (pedidoDetalleCampo) {
          var ssDet = SpreadsheetApp.getActiveSpreadsheet();
          var detOut = obtenerDetalleRegistroCampoPacking_(ssDet, fechaParam, ensayoNumero, params);
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
        var packColGet = packingStartColDesdeHoja_(ssGet, sheet);
        var numColsGet = numColsRegistroDesdeHoja_(ssGet, sheet);
        var dataColW = Math.max(20, idxNumRow + 1, numColsGet, packColGet + PACKING_COLS - 1);
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

        if (soloFechas) {
          var fechasSet = {};
          var hojasF = hojasRegistroConDatos_(ssGet);
          for (var hfi = 0; hfi < hojasF.length; hfi++) {
            var shF = hojasF[hfi];
            var lrF = shF.getLastRow();
            if (lrF < 2) continue;
            var dataF = shF.getRange(2, 1, lrF, 15).getValues();
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
          var ensayosInfo = {};
          var hojasEns = hojasRegistroConDatos_(ssGet);
          for (var hei = 0; hei < hojasEns.length; hei++) {
            var shEns = hojasEns[hei];
            migrarInsertarHoraRegistroPacking_(shEns);
            migrarInsertarHoraRegistroThermoking_(shEns);
            var lrEns = shEns.getLastRow();
            if (lrEns < 2) continue;
            var packColEns = packingStartColDesdeHoja_(ssGet, shEns);
            var tkColEns = thermokingStartColDesdeHoja_(ssGet, shEns);
            var dataEns = shEns.getRange(2, 1, lrEns, Math.max(15, IDX_REGISTRO_ENSAYO_NUMERO + 1)).getValues();
            var packingBlock = shEns.getRange(2, packColEns, lrEns, PACKING_COLS).getValues();
            var tkBlock = shEns.getRange(2, tkColEns, lrEns, THERMOKING_COLS).getValues();
            for (var j = 0; j < dataEns.length; j++) {
              var rowFechaStr = formatFecha(dataEns[j][0]);
              if (rowFechaStr === fecha) {
                var en = String(dataEns[j][IDX_REGISTRO_ENSAYO_NUMERO] || '').trim();
                if (en) {
                  if (!ensayosInfo[en]) ensayosInfo[en] = { tieneVisual: false, tienePacking: false, tieneThermoKing: false };
                  ensayosInfo[en].tieneVisual = true;
                  if (packingBlock[j] && rowHasAnyNonEmpty_(packingBlock[j])) ensayosInfo[en].tienePacking = true;
                  if (tkBlock[j] && rowTieneThermokingRegistrado_(tkBlock[j])) ensayosInfo[en].tieneThermoKing = true;
                }
              }
            }
          }
          var ensayosList = Object.keys(ensayosInfo).sort();
          result.ok = true;
          result.ensayos = ensayosList;
          result.ensayosConVisual = {};
          result.ensayosConPacking = {};
          result.ensayosConThermoKing = {};
          ensayosList.forEach(function (e) { result.ensayosConVisual[e] = ensayosInfo[e].tieneVisual; });
          ensayosList.forEach(function (e) { result.ensayosConPacking[e] = ensayosInfo[e].tienePacking; });
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
            var rowEn = r[IDX_REGISTRO_ENSAYO_NUMERO];
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
        var nClamshellPorFilaMatchLeg = [];
        var tienePacking = false;
        var tieneThermoKing = false;
        var idxDespachoGet = idxColPesoDespachoDesdeHoja_(ssGet, sheet);
        var packColDet = packingStartColDesdeHoja_(ssGet, sheet);
        var tkColDet = thermokingStartColDesdeHoja_(ssGet, sheet);
        var rc5ColDet = packingRc5StartColDesdeHoja_(ssGet, sheet);
        var filasPackingRc5ConHoraRegistro = 0;
        var pesoDespachoTkPorFila = [];
        for (var k = 0; k < data.length; k++) {
          var r = data[k];
          var rowFechaStr = formatFecha(r[0]);
          var rowEn = r[IDX_REGISTRO_ENSAYO_NUMERO];
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
            var filaSheetK = 2 + k;
            var tkValsDet = sheet.getRange(filaSheetK, tkColDet, 1, THERMOKING_COLS).getValues()[0];
            pesoDespachoTkPorFila.push(pesoDespachoTkDesdeTkRow_(tkValsDet));
            var desp = r[idxDespachoGet];
            var numDesp = (desp !== null && desp !== undefined && String(desp).trim() !== '') ? parseFloat(String(desp).replace(',', '.')) : NaN;
            despachoPorFila.push(!isNaN(numDesp) ? numDesp : null);
            nClamshellPorFilaMatchLeg.push(parseNClamshellRegistroGs_(r[IDX_REGISTRO_N_CLAMSHELL]) || numFilas);
            var rc5ValsDet = sheet.getRange(filaSheetK, rc5ColDet, 1, PACKING_RC5_COLS).getValues()[0];
            if (rc5RowTieneHoraRegistro_(rc5ValsDet)) filasPackingRc5ConHoraRegistro++;
            var filaTienePacking = rangeRowHasPackingData_(sheet, filaSheetK, packColDet, PACKING_COLS);
            if (filaTienePacking) {
              tienePacking = true;
              filasPackingRegistradas++;
            }
            if (rowTieneThermokingRegistrado_(tkValsDet)) tieneThermoKing = true;
          }
        }
        despachoPorFila = reordenarValoresPorNClamshellGs_(nClamshellPorFilaMatchLeg, despachoPorFila);
        pesoDespachoTkPorFila = reordenarValoresPorNClamshellGs_(nClamshellPorFilaMatchLeg, pesoDespachoTkPorFila);

        if (!row) {
          result.error = 'No hay registro para esa fecha y ensayo';
          return returnOutput(result);
        }

        var nClamshellRaw = row[IDX_REGISTRO_N_CLAMSHELL];
        var maxClamshell = 0;
        if (nClamshellRaw !== null && nClamshellRaw !== undefined && String(nClamshellRaw).trim() !== '') {
          var nCl = parseInt(String(nClamshellRaw).trim(), 10);
          if (!isNaN(nCl) && nCl > 0) maxClamshell = nCl;
        }
        if (numFilas > 0 && (maxClamshell <= 0 || maxClamshell < numFilas)) {
          maxClamshell = numFilas;
        }
        var despachoRaw = row[idxDespachoGet];
        var despachoGramos = null;
        if (despachoRaw !== null && despachoRaw !== undefined && String(despachoRaw).trim() !== '') {
          var numDesp = parseFloat(String(despachoRaw).replace(',', '.'));
          if (!isNaN(numDesp)) despachoGramos = numDesp;
        }

        var metaHojaLegacy = metaHojaRegistro_(ssGet, sheet);

        result.ok = true;
        result.data = {
          fila: filaEnSheet,
          modo_registro: metaHojaLegacy.modo_registro,
          hoja_registro: metaHojaLegacy.hoja_registro,
          numFilas: numFilas,
          FILAS_REGISTRADAS: numFilas,
          FILAS_TOTAL_CAMPO: numFilas,
          FILAS_PACKING_REGISTRADAS: filasPackingRegistradas,
          FILAS_PACKING_RC5_REGISTRADAS: filasPackingRc5ConHoraRegistro,
          FILAS_PACKING_RC5_CON_HORA_REGISTRO: filasPackingRc5ConHoraRegistro,
          MAX_CLAMSHELL: maxClamshell,
          N_CLAMSHELL: (nClamshellRaw !== null && nClamshellRaw !== undefined) ? String(nClamshellRaw).trim() : '',
          puede_registrar_mas: maxClamshell > 0 ? (filasPackingRegistradas < maxClamshell) : true,
          tienePacking: tienePacking,
          tieneThermoKing: tieneThermoKing,
          despachoPorFila: despachoPorFila,
          pesoDespachoTkPorFila: pesoDespachoTkPorFila,
          DESPACHO_ACOPIO: despachoGramos,
          despacho_acopio_gramos: despachoGramos,
          ENSAYO_NOMBRE: row[1],
          NUM_MUESTRA: (row.length > idxNumRow && row[idxNumRow] != null && row[idxNumRow] !== undefined) ? String(row[idxNumRow]).trim() : '',
          RESPONSABLE: row[3],
          ENSAYO_NUMERO: row[IDX_REGISTRO_ENSAYO_NUMERO],
          TRAZ_ETAPA: row[7],
          TRAZ_CAMPO: row[8],
          TRAZ_TURNO: row[9],
          VARIEDAD: row[10],
          PLACA_VEHICULO: row[IDX_REGISTRO_PLACA],
          FUNDO: strCell_(row[IDX_REGISTRO_FUNDO]),
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