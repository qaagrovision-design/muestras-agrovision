/** Icono único de la app: QA2026-2.0.png (pestaña, PWA, inicio en teléfono). */
(function aplicarIconoAppMuestras() {
    const ICON_FILE = 'QA2026-2.0.png';

    function rutaIconoDesdeScript_() {
        try {
            const scripts = document.getElementsByTagName('script');
            for (let i = scripts.length - 1; i >= 0; i--) {
                const src = String(scripts[i].src || '').trim();
                if (!src || !src.includes('icono-app.js')) continue;
                return new URL('../assets/images/' + ICON_FILE, src).href;
            }
        } catch (_) { /* ignore */ }
        return '';
    }

    function aplicar_(href) {
        if (!href) return;
        document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((el) => {
            try { el.parentNode?.removeChild(el); } catch (_) { /* ignore */ }
        });
        const bust = '?v=' + encodeURIComponent(String(window.APP_VERSION || '1').replace(/^v/i, ''));
        const url = href + bust;
        const icon = document.createElement('link');
        icon.rel = 'icon';
        icon.type = 'image/png';
        icon.href = url;
        document.head.appendChild(icon);
        const apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        apple.href = url;
        document.head.appendChild(apple);
    }

    aplicar_(rutaIconoDesdeScript_());
})();
