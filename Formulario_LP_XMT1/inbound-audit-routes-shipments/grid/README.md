# 📊 Auditoría Grid — Captura + Dashboard

Sistema completo de auditoría integrado con Grid: captura de formularios en el navegador + dashboard de consolidación en tiempo real.

## 📂 Dos aplicaciones en una carpeta

1. **captura_auditoria.html** — Formulario de captura (esta sección)
2. **consolidado_auditoria.html** — Dashboard de análisis (documentado abajo)

---

# 🎤 Captura de Auditoría

Aplicación web de captura de auditorías integrada con Grid, soportando 7 logs con sincronización en tiempo real y almacenamiento offline.

## 🎯 Características (Captura)

- **Motor de captura**: el mismo de Auditorias_SVC (probado en iOS/Android), con los 7 logs de esta app adaptados sobre él
- **7 Logs activos**: Pre-Missort (Destino/Doca), FURY, Contenerizado, Linehaul, Inbound FM, Inbound / Drivers, Barredura
- **Offline-first**: Almacenamiento en IndexedDB, sincronización automática al conectar
- **Modo Handheld / Cámara (toggle)**: el modo **principal es Handheld** (lector integrado HID que "teclea" el código + Enter, con input enfocado y auto-reenfocado); un toggle en cada pantalla de escaneo permite cambiar a **Cámara** (BarcodeDetector nativo o ZXing vendorizado como respaldo en iOS/Safari/Firefox). La preferencia se guarda **por dispositivo** en IndexedDB. Sirve igual para códigos de barras y para el QR del conductor (Inbound/Drivers)
- **Confirmación visual de escaneo**: en modo cámara muestra el código detectado antes de avanzar (evita falsos positivos)
- **Feedback táctil**: vibración al escanear/validar
- **Fotos con cámara in-app**: la foto se toma **dentro de la app** vía `getUserMedia` (preview en vivo + obturador), no lanza la cámara del sistema — así funciona en handhelds donde el MDM bloquea la cámara externa. Comprime a WebP con fallback a JPEG, con opción de flash y retomar
- **Sincronización inteligente**: Manejo de conflictos (409) con reintento exponencial
- **Navbar con identidad**: Logo compartido + avatar con iniciales del email del operador
- **Botón atrás visible + nativo**: botón explícito en cada paso (necesario en iOS, que no tiene gesto de sistema) y también intercepta el atrás de Android/navegador
- **Historial reciente**: Panel en el menú con las últimas capturas de todos los logs (filtrable por ventana de 5/15/30/60 min), independiente de la cola de sincronización
- **Diseño responsivo**: OLED minimalist, mobile-first, una pregunta por pantalla
- **Sin dependencias externas**: HTML/CSS/JS puro, autocontenido (ZXing vendorizado inline)

## 🎯 Pre-Missort — catálogo destino/doca

Este log necesita el catálogo publicado en el State Bucket `catalogo_destino_doca` — si no está publicado, el log avisa y no abre. Se publica desde el **Dashboard** (único botón de carga en el navbar, detecta el tipo de catálogo automáticamente — ver sección de Dashboard abajo), subiendo un CSV con las columnas `DOCA, DESTINO`: **una fila por doca**, con sus destinos válidos en la columna DESTINO separados por `;` (ej. fila `10, DESTINO_A;DESTINO_B;DESTINO_C`).

**Flujo de captura:** pensado para ser rápido en handheld. La **doca es fija por sesión** — se elige una vez (picker de búsqueda con todas las docas del catálogo, **o escribiéndola a mano** con Enter si no aparece listada) y persiste entre aperturas de la app (no se vuelve a preguntar), con un botón **Cambiar** siempre visible para ajustarla cuando haga falta. El **destino cambia por cada HU**: se escanea el HU y de inmediato se pide el destino (filtrado a los que su fila del catálogo asocia con la doca actual); al elegirlo se guarda el registro y se vuelve directo a escanear. El "Resultado" se calcula automáticamente: doca puramente numérica → "Sin incidencia"; si no → "Erroneo".

## 🚚 Inbound / Drivers — catálogo de rutas/shipments

Este log necesita el catálogo publicado en el State Bucket `catalogo_inbound_drivers` — si no está publicado, el log se abre pero avisa que falta el catálogo. Se publica desde el **Dashboard** (único botón de carga en el navbar, ver sección de Dashboard abajo), subiendo un CSV con estas columnas (el resto se ignora):

```
dia_colecta, TIPO_DE_RUTA, CICLOS, FACILITY, ID_ROUTE, SHP_LG_CODE, CARRIER, PLACA,
SHIPMENT_ID, SHP_SENDER_ID, NICKNAME, DOMAIN, COST_USD, RESULTADO
```

**Flujo de auditoría:**
1. El operador escanea el QR de la app del conductor (JSON con `route_id`, `carrier_id`, `license_plate`, etc.) o ingresa la ruta a mano si el QR no trae ruta asignada.
2. La app busca `ID_ROUTE` en el catálogo y fija Carrier/Placa (siempre del catálogo, de solo lectura) para el resto de la sesión.
3. Escanea shipments en loop continuo:
   - **Coincide con un pendiente de la ruta** → pide foto obligatoria → botón rápido **Auditado OK** o **Divergencia** (guarda y sigue).
   - **Ya auditado en esta sesión** → aviso, sigue escaneando.
   - **No pertenece a la ruta** → "No es HV/Frágil", no guarda nada, el escaneo **nunca se detiene**.
4. El panel de faltantes (contador + lista con Domain/Cost/Tipo) permite marcar **Faltante confirmado** a mano, sin foto.
5. **Finalizar ruta** guarda lo escaneado aunque falten paquetes — los nunca escaneados/marcados no generan registro.

Si el QR trae un carrier/placa distinto al del catálogo, no se muestra la comparación en pantalla, pero la divergencia se calcula y se guarda en cada registro de esa ruta (`route_divergencia` / `route_divergencia_detalle`) para trazabilidad en el Dashboard.

## 🧹 Barredura — inventario del día

Este log no usa catálogo — es escaneo libre de shipments en un lugar fijo por sesión.

**Flujo de captura:**
1. Primer paso: **¿Dónde estás escaneando?** (texto libre, ej. "ANDÉN 5"). Se pregunta una sola vez — queda fijo entre escaneos y persiste entre aperturas de la app (no se repregunta cada vez), con un botón **Cambiar** siempre visible para ajustarlo.
2. Después va directo al loop de escaneo: cada shipment escaneado se guarda de inmediato (Shipment ID + lugar), sin preguntar nada más, sin comparar contra ningún inventario.
3. **Repetido en 12h** → aviso, no se vuelve a agregar. Al abrir el log se leen `barredura_master` (+ la cola local) de las últimas 12h — esos IDs quedan bloqueados desde el arranque (dedup **global** entre dispositivos), aunque sean de otra sesión o dispositivo.
4. Para exportar solo se necesita el listado completo de lo escaneado — se hace desde el Dashboard (botón **Exportar capturados**, pestaña Barredura).

## 🚀 Despliegue (Captura)

### Paso 1: Crear documento de datos en Grid

1. Ve a https://grid.melioffice.com
2. Crea un documento nuevo
3. Copia el `DOC_ID` de la URL: `https://grid.melioffice.com/d/{DOC_ID}/...`
4. Guarda este valor como `DATA_DOC_ID`

### Paso 2: Crear catálogo (necesario para Pre-Missort)

El log "Pre-Missort" (destino/doca) necesita el catálogo en el State Bucket `catalogo_destino_doca`. La forma recomendada es subir un CSV con columnas `DESTINO, DOCA` desde el Dashboard (único botón de carga en el navbar — detecta el tipo de catálogo automáticamente). También se puede publicar el JSON a mano en Grid (sección 23 de Biblia, State Buckets):

```json
{
  "index": {
    "10": ["DESTINO_A", "DESTINO_B", "DESTINO_C"],
    "20": ["DESTINO_D", "DESTINO_E"]
  }
}
```

El "Resultado" del registro se calcula automáticamente: si la doca elegida es puramente numérica → "Sin incidencia"; si no → "Erroneo" (mismo criterio que la app original).

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
- **Lee en tiempo real** los 7 State Buckets que alimenta la app de captura ({log}_master) — sin cargar nada a mano, sin CSV, sin ZIP
- Sin cifrado: la captura ya no encripta nada, así que el dashboard tampoco necesita contraseña ni descifrado
- Muestra **KPIs + gráficos Plotly + tabla filtrable** por log en tiempo real
- Permite **refresh manual** con reintento automático en conflictos
- Permite **borrar un registro** individual (tabla → ícono de basura), escribiendo el bucket actualizado
- **Descarga consolidada** en CSV (todo) o **solo lo capturado hoy** (ícono de calendario junto al de descarga, todos los logs combinados)
- **Publica los catálogos de Pre-Missort e Inbound / Drivers** (un solo botón de carga en el navbar): sube un CSV, detecta automáticamente el tipo por sus columnas, lo valida/parsea y lo escribe en `catalogo_destino_doca` / `catalogo_inbound_drivers`
- **Exporta lo capturado en Barredura** como CSV (botón en la pestaña Barredura)

## 📋 Logs Soportados (Dashboard)

| Log | Campos | KPIs | Gráficos |
|-----|--------|------|----------|
| **Destino/Doca** | HU, Destino, Doca, Resultado (auto) | Total, Sin incidencia, Erroneo | Resultado (dona), Top Destinos (barras), Top Docas (barras) |
| **FURY** | Shipment, Foto, Situación, Valor (opt) | Total, por Situación | Situación (barras), Top Shipments (barras) |
| **Contenerizado** | Shipment, Situación, Foto (cond: si "Dañado") | Total, por Situación | Situación (barras), Top Shipments (barras) |
| **Linehaul** | HU, Área, Armado Sitio, Origen (cond), Canalización, Foto (opt), Comentarios (opt) | Total, por Área | Área (dona), Canalización (barras) |
| **Inbound FM** | Patente, Diferencia de Shipments, Hallazgo, Evidencia (opt) | Total, por Hallazgo | Hallazgo (barras) |
| **Inbound / Drivers** | Ruta, Carrier, Placa, Shipment ID, Domain, Cost USD, Tipo (Frágil/HV), Estado, Foto | Total, por Estado, Costo USD auditado, Rutas con divergencia QR | Estado (dona), Costo USD por Ruta (barras) |
| **Barredura** | Shipment ID, Lugar | Total, por Lugar | Escaneos por lugar (barras) |

## 📤 Publicar catálogos (Pre-Missort, Inbound/Drivers)

Hay un solo ícono de carga (⬆) en el navbar del Dashboard para los 2 catálogos — detecta cuál es por las columnas del CSV, no hay que elegir nada. Barredura no usa catálogo (escaneo libre por lugar).

- **Pre-Missort**: columnas `DOCA, DESTINO` (una fila por doca, destinos separados por `;`) → publica en `catalogo_destino_doca`.
- **Inbound/Drivers**: columnas `ID_ROUTE, CARRIER, PLACA, SHIPMENT_ID, DOMAIN, COST_USD, RESULTADO` (entre otras) → publica en `catalogo_inbound_drivers`.

Cada catálogo **sobreescribe** la versión anterior (no hace merge). En la pestaña **Barredura** hay un botón **Exportar capturados** con el listado completo de lo escaneado en el rango de fecha filtrado.

## 📤 Publicar el catálogo de Inbound / Drivers

1. Prepara un CSV con las columnas: `dia_colecta, TIPO_DE_RUTA, CICLOS, FACILITY, ID_ROUTE, SHP_LG_CODE, CARRIER, PLACA, SHIPMENT_ID, SHP_SENDER_ID, NICKNAME, DOMAIN, COST_USD, RESULTADO` (el orden no importa, solo los nombres de encabezado).
2. En el Dashboard, haz clic en el ícono de carga (⬆) en el navbar y selecciona el archivo.
3. El dashboard agrupa las filas por `ID_ROUTE`, arma la lista de shipments por ruta (con Domain/Cost/Resultado) y publica el índice completo en `catalogo_inbound_drivers` — **sobreescribe** la versión anterior.
4. La app de Captura lee este catálogo al iniciar; si se publica una versión nueva, los operadores deben reabrir la app (o el log) para tomar los cambios.

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
3. **Se carga solo** desde los 7 State Buckets, sin intervención manual
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

✅ **Sin localStorage**: 7 State Buckets independientes, uno por log
✅ **Identidad**: `GET /api/v1/me` para obtener email/avatar
✅ **Optimistic concurrency**: `if_updated_at` en PUT → 409 = reintento automático
✅ **Librerías locales**: Plotly desde `/d/_libs/`
✅ **Sin CDNs externos, sin JSZip**: la captura sube fotos directo a Grid como documentos, el dashboard nunca maneja ZIPs

## 💾 Almacenamiento

**7 State Buckets** en el documento de datos, uno por log, escritos por la app de captura, más 3 buckets de catálogo (solo lectura para la captura, escritos por los uploaders del dashboard):

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
  "inbound_fm_master": { "records": [...] },
  "inbound_drivers_master": {
    "records": [
      { "ts": "2026-07-30T10:30:45Z", "route_id": "100897405", "carrier": "135021164", "placa": "RL7492B",
        "shipment_id": "47326091753", "domain": "...", "cost_usd": 12.5, "resultado_auditoria": "Frágil",
        "estado": "Auditado OK", "foto": "01K..." }
    ]
  },
  "barredura_master": {
    "records": [
      { "ts": "2026-07-30T10:31:00Z", "shipment_id": "47326091753", "estado": "En catálogo",
        "fecha_inbound": "2026-07-29", "hub_status": "OK", "situacion": "" },
      { "ts": "2026-07-30T10:32:00Z", "shipment_id": "99999999", "estado": "Fuera de catálogo",
        "situacion": "En Sorteo" }
    ]
  },
  "catalogo_destino_doca": { "index": { "...": ["..."] } },
  "catalogo_inbound_drivers": { "index": { "100897405": { "carrier": "135021164", "placa": "RL7492B", "shipments": [...] } } },
  "catalogo_barredura": { "index": { "47326091753": { "fecha_inbound": "2026-07-29", "hub_status": "OK" } } }
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
| **Inbound / Drivers** | Estado (dona: verde/rojo/amarillo) | Costo USD por Ruta — Top 8 (barras) | — |
| **Barredura** | Cobertura del inventario (dona: encontrados/faltantes/sobrantes) | Estatus de sobrantes (barras) | — |

Todos con tema Nocturne: fondo #1a1a19, texto blanco.

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| "No autenticado" | No en VPN Grid | Conecta a VPN + inicia sesión en Grid UI |
| Tabla vacía | Todavía no llegan registros, o `data_doc_id` no coincide con el de captura | Revisa la consola de debug (ícono en el header): muestra qué documento está leyendo y cuántos registros encontró por bucket |
| Fotos no se ven | La foto no terminó de sincronizar (sigue como data:URL local en el dispositivo del operador) | Espera a que ese dispositivo tenga conexión y sincronice |
| 409 Conflict | Dos usuarios escriben simultáneamente | App reintenta automático en 500-1000ms |
| Gráficos en blanco | Plotly no cargó | Verifica `/d/_libs/plotly.min.js` |
| "Catálogo de destino/doca no publicado" en Pre-Missort | Nadie subió el CSV todavía | Sube el catálogo desde el Dashboard (ícono ⬆ en el navbar, detecta el tipo solo) |
| "Catálogo de rutas no publicado" en Inbound/Drivers | Nadie subió el CSV todavía | Sube el catálogo desde el Dashboard (ícono ⬆ en el navbar) |
| "Ruta no encontrada en el catálogo" | El `route_id` del QR/manual no existe en el CSV publicado | Verifica el `ID_ROUTE` en el catálogo, o vuelve a publicarlo |
| "Ya escaneado en las últimas 12h" en Barredura | El ID ya se escaneó (por cualquier dispositivo) en las últimas 12h | Es esperado — no se repiten IDs en 12h |

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
