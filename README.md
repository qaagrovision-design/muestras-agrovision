# Muestras Web · AGROVISION

**Registro digital de tiempos, mediciones y packing** para seguimiento de cosecha de arándano.  
PWA **offline-first** orientada a **celular y tablet**, sincronizada con Google Sheets.

| | |
|---|---|
| **Empresa** | AGROVISION |
| **Producto** | Muestras Web (PWA) |
| **Backend** | Google Apps Script + Google Sheets |
| **Uso principal** | Campo de cosecha y planta de packing |

---

## Módulos

| Módulo | Ruta | Función |
|--------|------|---------|
| **Campo** | `/` | Registro visual/acopio: meta, jarras, clamshells, control equitativo, tiempos, pesos, PDF y envío a planilla |
| **Packing** | `/packing/` | Recepción en planta: muestras por ensayo, pesos por etapa, control global, envío simple o múltiple |
| **Historial** | `/historial/` | Consulta de registros enviados |
| **Recomendaciones** | `/recomendaciones/` | Módulo auxiliar de recomendaciones |

---

## Características clave

| Área | Detalle |
|------|---------|
| **Offline** | Borradores locales, cola de sincronización y service worker |
| **Planilla** | Escritura en Hoja 1 (48 cols registro + bloques packing / thermoking / C5) |
| **PDF Campo** | Formato alineado a **PE-F-QPH-306** |
| **PDF Packing** | Formato alineado a **PE-F-OPH-309** |
| **Avance packing** | PDF resumen desde Campo (WhatsApp) sin duplicar en planilla |
| **Packing multi-muestra** | Borrador por muestra, modal de envío y reglas de secuencia (contador en **0**) |
| **Dispositivos** | Móvil y tablet a ancho completo; en desktop, vista centrada tipo app |

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| PWA | `manifest.json`, `service-worker.js` |
| UI | Lucide Icons, SweetAlert2, Flatpickr |
| PDF | jsPDF, PDF.js |
| API | Google Apps Script (Web App, JSONP + POST) |
| Datos | Google Sheets |

---

## Estructura del repositorio

| Archivo / carpeta | Rol |
|-------------------|-----|
| `index.html` · `app.js` | Módulo Campo |
| `campo-pdf.js` | Generación PDF Campo |
| `packing/` | Módulo Packing |
| `packing-pdf.js` | Generación PDF Packing |
| `historial/` | Historial |
| `code.gs` | Backend Apps Script (publicar en Google) |
| `styles.css` | Estilos globales |
| `service-worker.js` | Caché y actualizaciones PWA |
| `data/catalogo-app.json` | Catálogo de datos de apoyo |

---

## Puesta en marcha

### 1. Frontend (local o hosting estático)

```bash
# Ejemplo con Live Server o cualquier servidor estático en la raíz del proyecto
npx serve .
```

Abrir en **celular o tablet**. En pantallas grandes la interfaz se muestra en columna centrada.

### 2. Google Apps Script

| Paso | Acción |
|------|--------|
| 1 | Copiar `code.gs` al proyecto de Apps Script vinculado a la planilla |
| 2 | Implementar como **Aplicación web** (acceso según política de la empresa) |
| 3 | Copiar la URL de despliegue |
| 4 | Configurarla en `app.js` / `packing/packing.js` (`APPS_SCRIPT_API_URL`) |

### 3. Instalación en dispositivo

| Plataforma | Pasos |
|------------|--------|
| **Android / Chrome** | Menú → *Instalar aplicación* o *Añadir a pantalla de inicio* |
| **iOS / Safari** | Compartir → *Añadir a inicio* |

Tras un despliegue nuevo, forzar recarga (**Ctrl+Shift+R**) para actualizar el service worker.

---

## Flujo de datos (resumen)

```
[Celular / Tablet]  →  borrador local  →  cola si no hay red
        ↓
[Apps Script Web App]  →  Google Sheets (Hoja 1)
        ↓
[Historial / PDF]  ←  consulta y reportes
```

---

## Mantenimiento

| Tarea | Dónde |
|-------|--------|
| Cambios de formulario Campo | `app.js`, `index.html`, `code.gs` |
| Cambios de Packing | `packing/packing.js`, `code.gs` |
| Estilos / responsive | `styles.css` |
| Versión PWA | `service-worker.js` (`SW_VERSION`) |

---

## Soporte

Uso interno **AGROVISION**. Para incidencias, indicar módulo (Campo / Packing), fecha, muestra/ensayo y captura de pantalla o consola del navegador.

---

*AGROVISION · Muestras Web · Registro de tiempos y mediciones en campo y packing*
