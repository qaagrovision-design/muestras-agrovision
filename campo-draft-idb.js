/**
 * Respaldo del borrador Campo/Acopio en IndexedDB (solo dispositivo, sin servidor).
 * Si localStorage se pierde (caché, recarga forzada), se intenta recuperar desde aquí.
 */
(function campoDraftIdbModule() {
    const DB_NAME = 'muestras-campo-draft-v1';
    const DB_VER = 1;
    const STORE = 'borrador';

    function draftIdbKey_() {
        const modo = String(window.CAMPO_REGISTRO_MODO || 'visual').trim();
        return 'campo-draft-latest-' + (modo === 'acopio' ? 'acopio' : 'visual');
    }

    function abrirDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB no disponible'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VER);
            req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB borrador'));
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
        });
    }

    async function guardarBorradorCampoIdb(payload) {
        if (!window.indexedDB || payload == null) return false;
        const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const db = await abrirDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ id: draftIdbKey_(), json, ts: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function leerBorradorCampoIdb() {
        const rec = await leerBorradorCampoIdbRegistro();
        return String(rec?.json || '');
    }

    async function leerBorradorCampoIdbRegistro() {
        if (!window.indexedDB) return null;
        const db = await abrirDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(draftIdbKey_());
            req.onsuccess = () => {
                const row = req.result;
                if (!row || !row.json) {
                    resolve(null);
                    return;
                }
                resolve({
                    json: String(row.json),
                    ts: Number(row.ts) || 0
                });
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function borrarBorradorCampoIdb() {
        if (!window.indexedDB) return;
        const db = await abrirDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            store.delete(draftIdbKey_());
            store.delete('campo-draft-latest');
            store.delete('campo-draft-latest-visual');
            store.delete('campo-draft-latest-acopio');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    window.guardarBorradorCampoIdb = guardarBorradorCampoIdb;
    window.leerBorradorCampoIdb = leerBorradorCampoIdb;
    window.leerBorradorCampoIdbRegistro = leerBorradorCampoIdbRegistro;
    window.borrarBorradorCampoIdb = borrarBorradorCampoIdb;
})();
