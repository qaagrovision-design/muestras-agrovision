/* network.js - utilidades simples de conectividad/sync */
(function initNetworkUtils() {
    function isOnline() {
        return typeof navigator !== 'undefined' ? !!navigator.onLine : true;
    }

    function onConnectivityChange(callback) {
        if (typeof callback !== 'function') return function noop() {};
        const up = () => callback(true);
        const down = () => callback(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return function unsubscribe() {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }

    function triggerPendingSync() {
        if (typeof window.sincronizarPendientes === 'function') {
            return window.sincronizarPendientes();
        }
        return Promise.resolve();
    }

    window.NetworkSync = {
        isOnline,
        onConnectivityChange,
        triggerPendingSync
    };
}());
