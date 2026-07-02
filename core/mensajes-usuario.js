/** Textos para pantalla — sin columnas ni códigos de planilla. */
(function initMensajesUsuario() {
    function etiquetaOrigen_(d) {
        const modo = String(d?.modo_registro || d?.hoja_registro || '').trim().toLowerCase();
        if (modo === 'acopio') return 'Acopio';
        if (modo === 'visual') return 'Campo';
        return 'Campo o Acopio';
    }

    function prefijoOrigen_(d) {
        const o = etiquetaOrigen_(d);
        return o === 'Campo o Acopio' ? '' : (o + ' · ');
    }

    function fundoNoUsaTk20(d) {
        const fundo = String(d?.FUNDO ?? d?.fundo ?? '').trim();
        if (!fundo) {
            return 'TK-2.0, MP-TK y RC5 solo están disponibles para fundo A9.';
        }
        return 'Esta muestra es fundo ' + fundo + '. TK-2.0, MP-TK y RC5 solo aplican a fundo A9.';
    }

    function campoIncompletoTk20(d, hechas, max) {
        const origen = etiquetaOrigen_(d);
        const h = Math.max(0, Number(hechas) || 0);
        const m = Math.max(0, Number(max) || 0);
        if (m > 0) {
            return 'Termina y envía ' + origen + ' primero: van ' + h + ' de ' + m + ' clamshells listos.';
        }
        return 'Termina y envía el registro en ' + origen + ' antes de usar TK-2.0.';
    }

    function campoListoTk20(d, hechas, max) {
        const origen = etiquetaOrigen_(d);
        return origen + ' listo (' + hechas + '/' + max + '). Ya puedes registrar TK-2.0.';
    }

    function tk20YaEnviado(d) {
        return prefijoOrigen_(d) + 'TK-2.0 ya fue enviado para esta muestra.';
    }

    function campoIncompletoCorto(d) {
        return campoIncompletoTk20(d);
    }

    function packingFaltaFlujoTk20(d) {
        const faltan = [];
        if (!d?.campo_completo_hora_registro) faltan.push('Campo o Acopio');
        if (!d?.tk20_completo_hora_registro) faltan.push('TK-2.0');
        if (!faltan.length) return '';
        return 'Flujo TK-2.0: primero termina y envía ' + faltan.join(' y ') + '.';
    }

    function packingFlujoTk20Hint() {
        return 'Activa cuando Campo/Acopio y TK-2.0 de la muestra ya están enviados.';
    }

    function mpTkFaltaPacking() {
        return 'Termina y envía Packing en esta muestra antes de usar MP-TK.';
    }

    function mpTkFaltaFundo(d) {
        return fundoNoUsaTk20(d);
    }

    function traducirErrorTecnico(msg) {
        const s = String(msg || '').trim();
        if (!s) return s;
        if (/HORA_REGISTRO|AV\/AX|AV Visual|AX Acopio|FG\/FI|TK2_HORA/i.test(s)) {
            return 'Termina y envía Campo o Acopio en esta muestra antes de continuar.';
        }
        if (/fundo|A9/i.test(s) && /solo|flujo/i.test(s)) {
            return fundoNoUsaTk20({});
        }
        return s;
    }

    window.MensajesFlujo = {
        etiquetaOrigen: etiquetaOrigen_,
        fundoNoUsaTk20,
        campoIncompletoTk20,
        campoListoTk20,
        tk20YaEnviado,
        campoIncompletoCorto,
        packingFaltaFlujoTk20,
        packingFlujoTk20Hint,
        mpTkFaltaPacking,
        mpTkFaltaFundo,
        traducirErrorTecnico
    };
})();
