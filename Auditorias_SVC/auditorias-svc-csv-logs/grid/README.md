# 📊 Consolidado de Auditoría — Grid

Dashboard de consolidación en vivo para el log "Validación de Contenedor" (Auditorias SVC), alimentado desde la herramienta de GitHub Pages.

## 🎯 Qué es

Un **dashboard interactivo en Grid** que:
- Ingiere **CSVs o ZIPs** cargados manualmente (drag & drop), incluyendo los exports cifrados que descarga la app de captura (auditorías, no el catálogo de estatus — ese viaja siempre en plano y nunca llega a este dashboard)
- **Auto-detecta** el CSV del log por sus headers
- Descomprime ZIPs con fotos integradas (JSZip)
- Deduplica automático por timestamp + shipment
- Consolida en un **State Bucket** (`contenedor_master`)
- Muestra **KPIs + gráfico Plotly + tabla filtrable** en tiempo real
- Permite **refresh manual** con reintento automático en conflictos
- **Descarga consolidada** en JSON

## 📋 Log Soportado

| Log | Campos | KPIs | Gráficos |
|-----|--------|------|----------|
| **Validación de Contenedor** | Shipment ID, Estatus (catálogo), Optimizada, Resultado (auto: En contenedor / No en contenedor), Evidencia (foto, si no está en contenedor) | Total, En contenedor, No en contenedor | Resultado (dona verde/rojo), Estatus del catálogo (barras) |

## 🚀 Despliegue

### Paso 1: Crear documentos de datos en Grid

Este app requiere **un documento de datos dedicado** para los State Buckets.

```
UI de Grid:
1. Sube un archivo CSV vacío (o cualquier archivo pequeño)
2. Copia su doc_id de la URL: https://grid.melioffice.com/d/{DOC_ID}/...
```

Guarda ese `{DOC_ID}`.

### Paso 2: Subir el HTML a Grid

1. Descarga `grid/consolidado_auditoria.html`
2. Ve a https://grid.melioffice.com
3. Sube el archivo HTML como documento nuevo

Copia el `{HTML_DOC_ID}` de la URL.

### Paso 3: Abrir Dashboard

Abre con el data_doc_id en la URL:

```
https://grid.melioffice.com/d/{HTML_DOC_ID}/?data_doc_id={DATA_DOC_ID}
```

O hardcodeado en el HTML (buscar `this.docId = params.get('data_doc_id') ||`):
```javascript
this.docId = params.get('data_doc_id') || '{TU_DATA_DOC_ID}';
```

## 📋 Flujo de Uso

1. **Operador en GitHub Pages**: Escanea shipment, se compara contra el catálogo de estatus → exporta CSV o ZIP (si hay evidencia fotográfica)
2. **Operador abre dashboard** con `?data_doc_id=...`
3. **Drag & drop del archivo CSV o ZIP** → auto-detecta, descomprime, valida
4. **Dashboard actualiza** → KPIs, gráficos, tabla
5. **Busca/filtra** en la tabla
6. **Haz click en miniatura** de foto de evidencia para ver en modal
7. **Descarga consolidado** como JSON

## 🎨 Paleta de Colores (dataviz)

| Elemento | Color | Hex | Job |
|---|---|---|---|
| Success (Verde) | — | `#008300` | En contenedor |
| Critical (Rojo) | — | `#d03b3b` | No en contenedor |
| Series (Azul) | — | `#3987e5` | Barras, líneas |
| Accent (Amarillo) | — | `#ffd100` | Botones, tabs activos |
| Surface Dark | — | `#1a1a19` | Fondo charts |

**Validación:** Paleta Nocturne + dataviz (CVD ΔE ≥8.4, normal-vision ΔE ≥15).

## 🔒 Seguridad & Restricciones (Biblia)

✅ **Sin localStorage**: State Bucket propio del documento de datos
✅ **Identidad**: `GET /api/v1/me` para obtener email/avatar (y verificar admins)
✅ **Optimistic concurrency**: `if_updated_at` en PUT → 409 = reintento automático
✅ **Modales propios**: No usa `alert/confirm/prompt`
✅ **Librerías locales**: Plotly + JSZip desde `/d/_libs/`
✅ **Sin CDNs externos**: CSS + JS autocontenidos en HTML

## 💾 Almacenamiento

**1 State Bucket** en el documento de datos:

```json
{
  "contenedor_master": {
    "version": 1,
    "records": [
      {
        "ts": "2026-07-22T18:00:00Z",
        "shipment": "47326091753",
        "estatus": "in_container",
        "optimizada": "Si",
        "resultado": "En contenedor",
        "evidencia": ""
      }
    ]
  }
}
```

**El bucket:**
- Límite ~1 MB → ~16k registros @ 60 bytes c/u (las fotos viven como documentos aparte, ver abajo)
- Deduplicación por: ts + shipment
- Reintento automático en conflictos (409)

## 📥 Formatos de Entrada

### CSV
```
Fecha/Hora,Shipment ID,Estatus,Optimizada,Resultado,Evidencia
2026-07-22 18:00:00,47326091753,in_container,Si,En contenedor,
```

Auto-detecta el log por headers (case-insensitive): `shipment + estatus + resultado`.

### CSV cifrado

El CSV que exporta la app de captura viaja cifrado (mismo esquema AES-256-GCM que el resto de Auditorias SVC). El dashboard detecta que está cifrado leyendo el contenido (JSON con `{v, kind, salt, iv, data}`), no la extensión, y lo desencripta con la contraseña compartida guardada en el State Bucket `crypto_config` (ver botón de administrador en el navbar).

### ZIP
```
contenedor_2026-07-22/
├── data.csv
└── fotos/
    ├── 001_47326091753.jpg
    └── 002_99999999999.jpg
```

El ZIP contiene el CSV + subcarpeta `fotos/` con las imágenes de evidencia. El app:
1. Descomprime ZIP
2. Lee el CSV → detecta el log
3. Extrae fotos → las sube como documentos de Grid
4. Inserta datos + referencias de foto en el State Bucket

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| "No autenticado" | No en VPN Grid | Conecta a VPN + inicia sesión en Grid UI |
| Tabla vacía | No se cargó el bucket | Verifica `data_doc_id` en URL |
| "JSZip undefined" | `/d/_libs/jszip.min.js` falta | Contacta admin Grid |
| CSV rechazado | Headers no coinciden | Verifica que traiga Shipment ID, Estatus, Resultado |
| Fotos no se ven | Nombres de archivo no coinciden | Chequea que el CSV referencie `fotos/001_{shipment}.jpg` |
| 409 Conflict | Dos usuarios escriben simultáneamente | App reintenta automático en 500-1000ms |
| "No se pudo desencriptar" | Contraseña incorrecta o rotada | Verifica la contraseña vigente en el panel de admin |

## 🔄 Auto-Polling

- **Manual:** Botón "Actualizar" en navbar → recarga desde el State Bucket
- Reintento automático en conflictos (409): 500-1000ms + backoff exponencial

## 📤 Descarga

- **JSON consolidado**: Botón "Descargar" en navbar
- Contiene: `{ logs: { contenedor: [...] } }`
- Timestamp: `consolidado_AAAA-MM-DD.json`

## 📝 Licencia

Uso interno MercadoLibre.

## 🔗 Links

- **App de captura + uploader (GitHub Pages)**: https://isaieduardogarciarubio-lgtm.github.io/Auditorias_SVC/
- **Biblia Grid V11.4**: Sección 23 (State Buckets), Sección 19 (Concurrency), Sección 24 (Folders API)
- **dataviz skill**: Asignación de colores por job (categorical, sequential, status)
