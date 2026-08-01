# 📊 Auditoría Grid — Captura + Dashboard

Sistema completo de auditoría integrado con Grid: captura de formularios en el navegador + dashboard de consolidación en tiempo real.

## 📂 Dos aplicaciones en una carpeta

1. **captura_auditoria.html** — Formulario de captura (esta sección)
2. **consolidado_auditoria.html** — Dashboard de análisis (documentado abajo)

---

# 🎤 Captura de Auditoría

Aplicación web de captura de auditorías integrada con Grid, soportando 5 logs con sincronización en tiempo real y almacenamiento offline.

## 🎯 Características (Captura)

- **Motor de captura**: el mismo de Auditorias_SVC (probado en iOS/Android), con los 5 logs de esta app adaptados sobre él
- **5 Logs**: FURY, Contenerizado, Linehaul, Inbound FM activos — **Pre-Missort (Destino/Doca) deshabilitado temporalmente** hasta republicar el catálogo en el formato correcto (ver sección abajo)
- **Offline-first**: Almacenamiento en IndexedDB, sincronización automática al conectar
- **Escaneo robusto**: cámara (BarcodeDetector nativo o ZXing vendorizado inline como respaldo en iOS/Safari/Firefox), entrada manual con reenfoque automático (lector físico HID), y escaneo desde imagen cargada si la cámara no está disponible
- **Confirmación visual de escaneo**: muestra el código detectado y pide confirmar antes de avanzar (evita falsos positivos)
- **Feedback táctil**: vibración al escanear/validar
- **Compresión de fotos**: WebP con fallback a JPEG (25% reducción de datos), con retomar/reintentar
- **Sincronización inteligente**: Manejo de conflictos (409) con reintento exponencial
- **Navbar con identidad**: Logo compartido + avatar con iniciales del email del operador
- **Botón atrás visible + nativo**: botón explícito en cada paso (necesario en iOS, que no tiene gesto de sistema) y también intercepta el atrás de Android/navegador
- **Historial reciente**: Panel en el menú con las últimas capturas de todos los logs (filtrable por ventana de 5/15/30/60 min), independiente de la cola de sincronización
- **Diseño responsivo**: OLED minimalist, mobile-first, una pregunta por pantalla
- **Sin dependencias externas**: HTML/CSS/JS puro, autocontenido (ZXing vendorizado inline)

## ⏸️ Pre-Missort deshabilitado temporalmente

El log "Pre - Missort" (Destino/Doca) aparece atenuado en el menú y no se puede abrir hasta que se publique el catálogo `catalogo_destino_doca` en el State Bucket con el formato:

```json
{ "index": { "DESTINO_A": ["DOCA1", "DOCA2"], "DESTINO_B": ["DOCA3"] } }
```

Para reactivarlo: en `captura_auditoria.html`, busca `FORMS_CONFIG.destino_doca` y elimina la línea `disabled: true`.

## 🚀 Despliegue (Captura)

### Paso 1: Crear documento de datos en Grid

1. Ve a https://grid.melioffice.com
2. Crea un documento nuevo
3. Copia el `DOC_ID` de la URL: `https://grid.melioffice.com/d/{DOC_ID}/...`
4. Guarda este valor como `DATA_DOC_ID`

### Paso 2: Crear catálogo (opcional, pero recomendado)

Si usas el log "Pre-Missort" (destino/doca), necesitas un catálogo en el State Bucket `catalogo_destino_doca`:

```json
{
  "index": {
    "DESTINO_A": ["DOCA1", "DOCA2", "DOCA3"],
    "DESTINO_B": ["DOCA4", "DOCA5"]
  }
}
```

Publica este JSON en Grid (sección 23 de Biblia, State Buckets). El "Resultado" del registro se calcula automáticamente: si la doca elegida es puramente numérica → "Sin incidencia"; si no → "Erroneo" (mismo criterio que la app original).

### Paso 3: Subir captura_auditoria.html a Grid

1. Descarga `captura_auditoria.html` desde este repositorio
2. En Grid, crea un documento nuevo y sube el HTML
3. Copia el `HTML_DOC_ID` de la URL

### Paso 4: Abrir la aplicación

El documento de datos ya viene por defecto (`01KY8F1NQ0CGK80JNEN1DPNFVF`), así que basta con abrir el HTML directo:

```
https://grid.melioffice.com/d/{HTML_DOC_ID}/
```

Si alguna vez necesitas apuntar a otro documento de datos, agrega `?data_doc_id={DATA_DOC_ID}`:

```
https://grid.melioffice.com/d/{HTML_DOC_ID}/?data_doc_id={OTRO_DATA_DOC_ID}
```

El navbar ya trae por defecto el logo compartido de MercadoLibre (mismo doc_id que usa Auditorias_SVC). Si quieres usar otro logo, agrega `&logo_doc_id={LOGO_DOC_ID}` a la URL.

## 📋 Flujo de Uso (Captura)

1. **Operador abre la app** en Grid con `?data_doc_id=...`
2. **Elige un log** del menú (Destino/Doca, FURY, Contenerizado, etc.)
3. **Completa el formulario** — una pregunta por pantalla
4. **Escanea** HU/shipment/patente o ingresa manualmente
5. **Captura fotos** si es requerido (comprimidas automáticamente)
6. **Envía** → se guarda localmente en IndexedDB
7. **Sincronización automática**: Los registros se sincronizan a State Buckets si hay conexión
8. **Offline**: Los registros se almacenan en IndexedDB y se sincronizan al reconectar
9. **Revisa pendientes** en el badge "Sincronizar" en navbar

## 🏗️ Arquitectura (Captura)

### State Buckets (Grid)

Cada log tiene su propio bucket: `{formId}_master`

```javascript
{
  records: [
    {
      uid: "formId_timestamp_random",
      ts: "2026-07-23T10:30:00Z",
      formId: "destino_doca",
      hu: "2420997802886101",
      destino: "DESTINO_A",
      doca: "DOCA1",
      auditoria: "user@mercadolibre.com.mx - 2026-07-23"
    }
  ]
}
```

### Fotos

Las fotos se comprimen a WebP (o JPEG como fallback) y se suben como documentos públicos en Grid:

```javascript
{
  ...,
  foto: "01KXHHVWD581MQ567XEBW8HM5B",  // Grid doc_id
  ...
}
```

---

# 📊 Dashboard — Consolidado de Auditoría

Un **dashboard de solo lectura en Grid** que:
- **Lee en tiempo real** los 5 State Buckets que alimenta la app de captura ({log}_master) — sin cargar nada a mano, sin CSV, sin ZIP
- Sin cifrado: la captura ya no encripta nada, así que el dashboard tampoco necesita contraseña ni descifrado
- Muestra **KPIs + gráficos Plotly + tabla filtrable** por log en tiempo real
- Permite **refresh manual** con reintento automático en conflictos
- Permite **borrar un registro** individual (tabla → ícono de basura), escribiendo el bucket actualizado
- **Descarga consolidada** en CSV

## 📋 Logs Soportados (Dashboard)

| Log | Campos | KPIs | Gráficos |
|-----|--------|------|----------|
| **Destino/Doca** (deshabilitado en captura por ahora) | HU, Destino, Doca, Resultado (auto) | Total, Sin incidencia, Erroneo | Resultado (dona), Top Destinos (barras), Top Docas (barras) |
| **FURY** | Shipment, Foto, Situación, Valor (opt) | Total, por Situación | Situación (barras), Top Shipments (barras) |
| **Contenerizado** | Shipment, Situación, Foto (cond: si "Dañado") | Total, por Situación | Situación (barras), Top Shipments (barras) |
| **Linehaul** | HU, Área, Armado Sitio, Origen (cond), Canalización, Foto (opt), Comentarios (opt) | Total, por Área | Área (dona), Canalización (barras) |
| **Inbound FM** | Patente, Diferencia de Shipments, Hallazgo, Evidencia (opt) | Total, por Hallazgo | Hallazgo (barras) |

## 🚀 Despliegue (Dashboard)

Comparte el mismo documento de datos que la app de captura — por defecto ya apunta a `01KY8F1NQ0CGK80JNEN1DPNFVF`, no hace falta configurar nada.

### Subir el HTML a Grid

1. Descarga `grid/consolidado_auditoria.html`
2. Ve a https://grid.melioffice.com
3. Sube el archivo HTML como documento nuevo
4. Ábrelo directo — ya lee los mismos buckets que escribe la captura

Si alguna vez necesitas apuntar a otro documento de datos, agrega `?data_doc_id={OTRO_DATA_DOC_ID}` a la URL.

## 📋 Flujo de Uso (Dashboard)

1. **Operador llena formularios** en captura_auditoria.html (escanea, captura foto, sincroniza automáticamente)
2. **Cualquiera abre el dashboard** — no necesita ningún parámetro ni archivo
3. **Se carga solo** desde los 5 State Buckets, sin intervención manual
4. **Tabs de cada log** → KPIs, gráficos, tabla de registros
5. **Busca/filtra** en cada tabla
6. **Haz click en miniatura** de foto para ver en modal
7. **Refresh manual** con botón "Actualizar" si quieres forzar una recarga
8. **Descarga consolidado** como CSV con todos los logs

## 🎨 Paleta de Colores (dataviz)

| Elemento | Color | Hex | Job |
|---|---|---|---|
| Success (Verde) | — | `#008300` | Sin incidencia, Normal |
| Critical (Rojo) | — | `#d03b3b` | Erroneo, Dañado, Perdido |
| Series (Azul) | — | `#3987e5` | Barras, líneas |
| Accent (Amarillo) | — | `#ffd100` | Botones, tabs activos |
| Surface Dark | — | `#1a1a19` | Fondo charts |

**Validación:** Paleta Nocturne + dataviz (CVD ΔE ≥8.4, normal-vision ΔE ≥15).

## 🔒 Seguridad & Restricciones (Biblia)

✅ **Sin localStorage**: 5 State Buckets independientes, uno por log
✅ **Identidad**: `GET /api/v1/me` para obtener email/avatar
✅ **Optimistic concurrency**: `if_updated_at` en PUT → 409 = reintento automático
✅ **Librerías locales**: Plotly desde `/d/_libs/`
✅ **Sin CDNs externos, sin JSZip**: la captura sube fotos directo a Grid como documentos, el dashboard nunca maneja ZIPs

## 💾 Almacenamiento

**5 State Buckets** en el documento de datos, uno por log, escritos por la app de captura:

```json
{
  "destino_doca_master": {
    "records": [
      { "ts": "2026-07-24T10:30:45Z", "hu": "HU123", "destino": "MXAMT1", "doca": "134", "resultado": "Sin incidencia" }
    ]
  },
  "fury_master": { "records": [...] },
  "contenerizado_master": { "records": [...] },
  "linehaul_master": { "records": [...] },
  "inbound_fm_master": { "records": [...] }
}
```

Cada bucket tiene límite ~1 MB; las fotos viven como documentos aparte en Grid (el registro solo guarda el doc_id).

## 📊 Gráficos Por Log

| Log | Gráfico 1 | Gráfico 2 | Gráfico 3 |
|-----|-----------|-----------|-----------|
| **Destino/Doca** | Resultado (dona: verde/rojo) | Top 8 Destinos (barras) | Top 8 Docas (barras) |
| **FURY** | Situación (barras) | Top 10 Shipments (barras) | — |
| **Contenerizado** | Situación (barras) | Top 10 Shipments (barras) | — |
| **Linehaul** | Área (dona) | Canalización (barras) | — |
| **Inbound FM** | Hallazgo (barras) | — | — |

Todos con tema Nocturne: fondo #1a1a19, texto blanco.

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| "No autenticado" | No en VPN Grid | Conecta a VPN + inicia sesión en Grid UI |
| Tabla vacía | Todavía no llegan registros, o `data_doc_id` no coincide con el de captura | Revisa la consola de debug (ícono en el header): muestra qué documento está leyendo y cuántos registros encontró por bucket |
| Fotos no se ven | La foto no terminó de sincronizar (sigue como data:URL local en el dispositivo del operador) | Espera a que ese dispositivo tenga conexión y sincronice |
| 409 Conflict | Dos usuarios escriben simultáneamente | App reintenta automático en 500-1000ms |
| Gráficos en blanco | Plotly no cargó | Verifica `/d/_libs/plotly.min.js` |

## 🔄 Auto-Polling

- **Manual:** Botón "Actualizar" en navbar → recarga desde State Buckets
- Reintento automático en conflictos (409): 500-1000ms + backoff exponencial

## 📤 Descarga

- **CSV consolidado**: Botón "Descargar" en navbar
- Contiene todos los logs con columna "Tipo de Log"
- Timestamp: `consolidado_AAAA-MM-DD.csv`

## 📝 Licencia

Uso interno MercadoLibre.

## 🔗 Links

- **Biblia Grid V11.4**: Sección 23 (State Buckets), Sección 19 (Concurrency), Sección 24 (Folders API)
- **dataviz skill**: Asignación de colores por job (categorical, sequential, status)
