# Auditorías SVC - MercadoLibre

Una aplicación web minimalista para recopilar datos en formularios dinámicos y exportarlos a CSV compatible con Grid.

## 📌 Estado actual

Este repo se clonó desde el branch `claude/grid-webapp-planning-aat9tw` de `Formulario_LP_XMT1` como
punto de partida, reemplazando los 5 logs originales de Auditorías XMT1 por uno nuevo:

- **Log "Validación de Contenedor"** (`js/forms-config.js`): escanea Shipment ID, lo compara contra
  el catálogo de estatus cargado en el menú (columnas `ID, ESTATUS, OPTIMIZADA`). Si `ESTATUS ==
  in_container` guarda automático "En contenedor"; si es distinto, guarda "No en contenedor" y pide
  foto de evidencia. `OPTIMIZADA` es informativa (se muestra y se guarda). Un Shipment ausente del
  catálogo bloquea el registro con opción de reintentar.
- **Catálogo de estatus**: la app de captura lo trae con un `fetch` estático a
  `data/estatus_shipments.csv` + `data/estatus_shipments_meta.json` (sin cifrar — es información
  operativa de consulta, no auditoría sensible), con `cache: 'no-store'` y un botón "Actualizar
  catálogo" manual. Es el mismo archivo para todos — no vive en el localStorage de nadie. Aviso
  grande y persistente si lleva más de 1 hora sin actualizarse (o nunca se publicó).
- **App "uploader"** (`uploader/`): toma el CSV físico de estatus (con drag & drop), lo valida, y al
  confirmar lo manda a un **Worker de Cloudflare** (`cloudflare-worker/`, desplegado en
  `https://svc-audito.isaig-rubio.workers.dev/publish`), que hace el commit real a
  `data/estatus_shipments.csv` + `data/estatus_shipments_meta.json` usando un token de GitHub que
  vive como secreto del lado del Worker — nunca en el navegador ni en este repo. GitHub Pages
  redespliega solo (~1 min) y desde ahí **cualquier persona que abra la app de auditoría, en
  cualquier dispositivo**, lee el mismo catálogo. Cero fricción para quien publica: nada que pegar,
  nada que configurar en el navegador.
- **Navegación entre apps**: cada app enlaza a la otra desde el pie del menú, junto al botón de
  cambiar contraseña de encriptación (esa contraseña es solo para las auditorías exportadas hacia
  el dashboard — el catálogo de estatus no la usa).
- **Persistencia anti-pérdida**: los registros capturados se respaldan en IndexedDB apenas se
  agregan (`js/storage-engine.js`) y se recuperan automáticamente si se cierra la pestaña o falla el
  navegador antes de descargarlos. Solo se borran al eliminarlos a mano o con "Limpiar Todo".
- **`grid/consolidado_auditoria.html`**: adaptado al log nuevo (KPIs, gráficas, detección de headers,
  tabla) y verificado ingiriendo el ZIP cifrado real que exporta la app de captura (múltiples
  auditorías + fotos en un solo archivo).

## 🚀 Características

- **Diseño Mobile First**: Totalmente responsivo con Nocturne Design System (tema oscuro MercadoLibre)
- **Formularios Dinámicos**: Define campos una sola vez en la configuración; la app se auto-renderiza
- **Motor CSV Real**: Escapa correctamente comillas, comas y saltos de línea. Incluye BOM UTF-8 para Excel
- **Multi-form**: Soporta múltiples formularios. Agregar uno nuevo = editar un archivo de configuración
- **Acumulación de Registros**: Completa varios registros en una sesión y exporta un lote completo
- **Sin Dependencias**: HTML/CSS/JS puro. Cero npm, cero bundler. Publicable directo en GitHub Pages

## 📁 Estructura

```
Auditorias_SVC/
├── index.html                 # Punto de entrada único
├── css/
│   └── nocturne.css          # Sistema visual Nocturne (dark + amarillo Meli)
├── js/
│   ├── forms-config.js       # Definición de formularios (campos + columnas CSV)
│   ├── form-engine.js        # Renderizado dinámico de formularios HTML
│   ├── csv-engine.js         # Motor real: validación, escape, descarga de CSV
│   └── app.js                # Lógica central: navegación, estado, flujo
└── README.md                 # Este archivo
```

## 🛠️ Cómo Agregar un Nuevo Formulario

### Paso 1: Editar `js/forms-config.js`

Agrega un nuevo objeto a `FORMS_CONFIG`:

```javascript
const FORMS_CONFIG = {
  contact_form: { /* ... */ },

  // Nuevo formulario aquí:
  invoice_form: {
    id: 'invoice_form',
    title: 'Facturación',
    description: 'Datos para generar facturas',
    icon: '🧾',
    fields: [
      {
        id: 'invoice_number',
        label: 'Número de Factura',
        type: 'text',
        required: true,
        placeholder: 'INV-2024-001',
      },
      {
        id: 'amount',
        label: 'Monto',
        type: 'number',
        required: true,
        placeholder: '1000.00',
      },
      {
        id: 'currency',
        label: 'Moneda',
        type: 'select',
        required: true,
        options: [
          { value: 'MXN', label: 'Pesos Mexicanos' },
          { value: 'USD', label: 'Dólares USD' },
          { value: 'COP', label: 'Pesos Colombianos' },
        ],
      },
    ],
    csvColumns: [
      { field: 'invoice_number', header: 'Número de Factura' },
      { field: 'amount', header: 'Monto' },
      { field: 'currency', header: 'Moneda' },
    ],
  },
};
```

### Paso 2: Desplegar

Commit + Push a la rama. GitHub Pages se actualiza automáticamente.

## 📋 Tipos de Campo Soportados

| Tipo | HTML | Uso |
| --- | --- | --- |
| `text` | `<input type="text">` | Texto libre |
| `email` | `<input type="email">` | Validación de email |
| `tel` | `<input type="tel">` | Números telefónicos |
| `number` | `<input type="number">` | Números con min/max |
| `date` | `<input type="date">` | Selector de fecha |
| `select` | `<select>` | Dropdown con opciones |
| `textarea` | `<textarea>` | Texto multilínea |

## 📊 Flujo de Uso

1. **Menú inicial**: Usuario elige un formulario
2. **Rellenar**: Completa los campos requeridos
3. **Agregar**: Click en "Agregar Registro" → se acumula
4. **Repetir**: Puede llenar varios registros en una sesión
5. **Exportar**: Click en "Descargar CSV" → descarga el lote completo
6. **Subir a Grid**: Sube el CSV manualmente a la otra aplicación

## 🎨 Personalización de Estilos

Los estilos usan CSS variables en `:root` (ver `css/nocturne.css`):

```css
:root {
  --color-primary: #FFD100;        /* Amarillo Meli */
  --color-bg: #1a1a1a;            /* Fondo oscuro */
  --color-text: #f0f0f0;          /* Texto claro */
  /* ... más variables */
}
```

Modifica estos valores para cambiar el tema completo.

## ✅ Motor CSV — Garantías

- **Escape correcto**: Comillas internas se duplican. Valores con coma/salto de línea se encierran en comillas.
- **BOM UTF-8**: Detecta Excel automáticamente como UTF-8 y renderiza acentos/ñ correctamente
- **Nombre automático**: `formulario_titulo_YYYY-MM-DD.csv`
- **Descarga segura**: Usa `Blob` + `URL.createObjectURL` (compatible con navegadores modernos)

### Ejemplo de escape:

```
Input:  Juan "El Maestro" García, con coma
Output: "Juan ""El Maestro"" García, con coma"
```

## 🚀 Desplegar en GitHub Pages

1. Asegúrate de que el repo esté public o el Pages esté habilitado en Settings
2. Ve a **Settings → Pages → Source**: selecciona rama `claude/bible-form-csv-app-sesqk4` (o `main` después de merge)
3. La app estará en `https://isaieduardogarciarubio-lgtm.github.io/Auditorias_SVC/`

## 🔗 Integración con Grid (Futuro)

Hoy se descarga el CSV manualmente. En el futuro, si quieres integrar con la API de Grid:

```javascript
// En app.js, podrías agregar algo como:
async exportToGrid(csvContent, formConfig) {
  const result = await fetch('https://grid.adminml.com/api/v1/engine/run', {
    method: 'POST',
    credentials: 'include',
    body: formData, // Incluir CSV como attachment
  });
  // Manejo de respuesta...
}
```

Ver la Biblia de Grid (`Biblia_Grid_V11_4_1.md`) para detalles del endpoint.

## 📝 Licencia

Uso interno MercadoLibre.
