/**
 * Caché local de PDFs enviados — solo hoy y ayer (IndexedDB).
 */
(function histPdfStoreModule() {
    const DB_NAME = 'muestras-hist-pdf-v1';
    const DB_VER = 1;
    const STORE = 'pdfs';

    function hoyIsoLocal() {
        const d = new Date();
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function ayerIsoLocal() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function normalizarFecha(val) {
        const s = String(val || '').trim();
        if (!s) return '';
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return iso[0];
        const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slash) {
            return slash[3] + '-' + String(slash[2]).padStart(2, '0') + '-' + String(slash[1]).padStart(2, '0');
        }
        const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dash) {
            return dash[3] + '-' + String(dash[2]).padStart(2, '0') + '-' + String(dash[1]).padStart(2, '0');
        }
        return s;
    }

    function claveRegistro(fecha, ensayoNumero, numMuestra, modulo) {
        return [
            normalizarFecha(fecha),
            String(ensayoNumero || '').trim(),
            String(numMuestra || '').trim().toUpperCase(),
            String(modulo || 'campo').trim().toLowerCase()
        ].join('||');
    }

    function abrirDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB no disponible'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VER);
            req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB'));
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
        });
    }

    function txDone(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Error IndexedDB'));
            tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
        });
    }

    async function listarTodos() {
        const db = await abrirDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
            req.onerror = () => reject(req.error);
        });
    }

    function inicioDiaLocalMs(fecha) {
        const d = fecha instanceof Date ? new Date(fecha.getTime()) : new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    async function purgarAntiguos() {
        const limiteMs = inicioDiaLocalMs(new Date()) - (24 * 60 * 60 * 1000);
        const todos = await listarTodos();
        const viejos = todos.filter((r) => {
            const ts = Number(r?.ts) || 0;
            if (ts > 0) return ts < limiteMs;
            const f = normalizarFecha(r?.fecha);
            if (!f) return false;
            const ayer = ayerIsoLocal();
            return f < ayer;
        });
        if (!viejos.length) return 0;
        const db = await abrirDb();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        viejos.forEach((r) => { if (r?.id) store.delete(r.id); });
        await txDone(tx);
        return viejos.length;
    }

    async function guardarBlobParaMuestras(blob, nombreArchivo, muestras) {
        if (!blob || !Array.isArray(muestras) || !muestras.length) return;
        const buf = await blob.arrayBuffer();
        await purgarAntiguos();
        const db = await abrirDb();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const ts = Date.now();
        const nombre = String(nombreArchivo || 'muestra.pdf');
        muestras.forEach((m) => {
            const fecha = normalizarFecha(m.fecha);
            const ensayo = String(m.ensayo_numero || '').trim();
            const num = String(m.num_muestra || '').trim().toUpperCase();
            const modulo = String(m.modulo || 'campo').trim().toLowerCase();
            if (!fecha || !ensayo || !num) return;
            const id = claveRegistro(fecha, ensayo, num, modulo);
            store.put({
                id,
                fecha,
                ensayo_numero: ensayo,
                num_muestra: num,
                modulo,
                nombre,
                ts,
                blob: buf
            });
        });
        await txDone(tx);
    }

    async function obtener(fecha, ensayoNumero, numMuestra, modulo) {
        const id = claveRegistro(fecha, ensayoNumero, numMuestra, modulo);
        const db = await abrirDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(id);
            req.onsuccess = () => {
                const row = req.result;
                if (!row || !row.blob) {
                    resolve(null);
                    return;
                }
                resolve({
                    blob: new Blob([row.blob], { type: 'application/pdf' }),
                    nombre: row.nombre || 'muestra.pdf',
                    modulo: row.modulo,
                    fecha: row.fecha,
                    ensayo_numero: row.ensayo_numero,
                    num_muestra: row.num_muestra
                });
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function listarRegistrosActivos() {
        await purgarAntiguos();
        const todos = await listarTodos();
        const limiteMs = inicioDiaLocalMs(new Date()) - (24 * 60 * 60 * 1000);
        return todos.filter((r) => {
            const ts = Number(r?.ts) || 0;
            if (ts > 0) return ts >= limiteMs;
            const f = normalizarFecha(r?.fecha);
            if (!f) return false;
            const permitidas = new Set([hoyIsoLocal(), ayerIsoLocal()]);
            return permitidas.has(f);
        });
    }

    async function clavesActivasSet() {
        const activos = await listarRegistrosActivos();
        const set = new Set();
        activos.forEach((r) => {
            set.add(String(r.id || claveRegistro(r.fecha, r.ensayo_numero, r.num_muestra, r.modulo)));
        });
        return set;
    }

    async function borrarTodo() {
        if (!window.indexedDB) return;
        const db = await abrirDb();
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        await txDone(tx);
    }

    async function existe(fecha, ensayoNumero, numMuestra, modulo) {
        const rec = await obtener(fecha, ensayoNumero, numMuestra, modulo);
        return !!(rec && rec.blob);
    }

    async function modulosDisponibles(fecha, ensayoNumero, numMuestra) {
        const f = normalizarFecha(fecha);
        const en = String(ensayoNumero || '').trim();
        const nm = String(numMuestra || '').trim().toUpperCase();
        const activos = await listarRegistrosActivos();
        const mods = new Set();
        activos.forEach((r) => {
            if (normalizarFecha(r.fecha) !== f) return;
            if (en && String(r.ensayo_numero || '').trim() !== en) return;
            const rnm = String(r.num_muestra || '').trim().toUpperCase();
            if (nm && nm !== '--' && rnm && rnm !== nm) return;
            mods.add(String(r.modulo || 'campo').toLowerCase());
        });
        if (mods.size) return [...mods];
        for (const m of ['campo', 'acopio', 'packing']) {
            const rec = await obtener(fecha, ensayoNumero, numMuestra, m);
            if (rec) mods.add(m);
        }
        return [...mods];
    }

    window.HistPdfStore = {
        claveRegistro,
        normalizarFecha,
        purgarAntiguos,
        guardarBlobParaMuestras,
        obtener,
        listarRegistrosActivos,
        clavesActivasSet,
        borrarTodo,
        existe,
        modulosDisponibles
    };
})();
