# Plan — App de Validación de Dispositivos (`validacion_dispositivos.html`)

> Estado: **BORRADOR PARA APROBACIÓN**. No se ha construido nada todavía.
> Al recibir tu visto bueno, se implementa exactamente lo aprobado.

---

## 1. Objetivo

App **separada**, mobile-first, para que un guardia valide un dispositivo en la
entrada de forma **ágil**:

1. Escanea el **QR sticker** de un dispositivo "Otro", **o**
2. Escanea el **QR del driver** (externo, JSON con `driver_id`), **o**
3. **Busca por driver_id** escribiéndolo.

Resultado inmediato en la estética de `validacion.html`:

- **Acceso válido** (verde): muestra los dispositivos autorizados de esa persona
  con **IMEI**, **Descripción** y botón **Ver foto**.
- **Acceso denegado** (rojo): distinguiendo el **motivo** (No registrado / Inactivo-vencido).

Y volver a escanear otro QR en 1 toque.

---

## 2. Decisiones confirmadas (tus respuestas)

| Tema | Decisión |
|---|---|
| Ubicación | **Archivo separado** `validacion_dispositivos.html` |
| Criterio válido/denegado | Existe **y** activo (modelo de 90 días) |
| Modelo de actividad | **Escribir** `ultimo_escaneo` + **auto-desactivar** en `devices_master` |
| Log de escaneos | **Solo válidos** → `scan_master` |
| Multi-dispositivo | Una persona (driver_id o usuario/email) puede tener **varios** dispositivos; el guardia ve **todos** |
| Alcance | **Validación + cambio en la app de registro** (agregar dispositivo a persona existente) |
| Motivo denegado | **Sí distinguir**: "No registrado" vs "Inactivo / vencido" |

---

## 3. Modelo de datos — cambios

### 3.1 Situación actual
`devices_master.records[]` es una lista plana de dispositivos independientes.
Cada registro: `id`, `timestamp`, `puesto`, `tipo_dispositivo`, `descripcion`,
`foto_doc_id`, `usuario`, `email`, y según tipo: `driver_id` | `correo` + `imei` + `qr_doc_id`.

### 3.2 Recomendación de estructura (a aprobar)

**Opción recomendada — lista plana + clave de propietario** (retrocompatible, menos
conflictos de concurrencia):

Cada dispositivo agrega estos campos:

```
owner_key       // driver:<driver_id>  ó  user:<email-normalizado>
owner_tipo      // "driver" | "otro"
status          // "activo" | "inactivo"   (default "activo")
ultimo_escaneo  // ISO; inicia = timestamp de registro
```

- "Agregar dispositivo a una persona" = **nuevo registro con el mismo `owner_key`**.
- El guardia ve todos los dispositivos de la persona **agrupando por `owner_key`**.
- Ventaja: no rompe registros existentes y evita reescribir objetos grandes anidados
  (menos choques 409 al escribir en paralelo).

> Alternativa (anidada): `records[]` = personas, cada una con `dispositivos[]`.
> Más "limpia" conceptualmente pero obliga a reescribir todo el objeto de la persona
> en cada cambio y complica la concurrencia. **Se recomienda la plana.**
> _Dime si prefieres la anidada y ajusto el plan._

### 3.3 Migración de datos existentes
Al primer arranque (o script único), a cada registro sin los campos nuevos se le calcula:
- `owner_key`: `driver:<driver_id>` o `user:<email|correo>` normalizado.
- `owner_tipo`, `status = "activo"`, `ultimo_escaneo = timestamp` del registro.
Se hace de forma idempotente (si ya existe, no se toca).

---

## 4. Modelo de actividad — 90 días (reglas exactas)

En cada **escaneo/búsqueda** de un dispositivo:

1. Se calcula `dias = hoy - ultimo_escaneo`.
2. **Si `status == "inactivo"`** → **Denegado**, motivo *Inactivo*.
3. **Si `dias > 90`** → se marca `status = "inactivo"` (auto-desactivación, se
   **escribe** en `devices_master`) → **Denegado**, motivo *Vencido (>90 días)*.
4. **Si válido** (`activo` y `dias ≤ 90`) → se actualiza `ultimo_escaneo = ahora`
   (reinicia los 90 días), se registra el escaneo en `scan_master`, y se muestra **Válido**.

> ⚠️ Caso a confirmar: un dispositivo **registrado hace >90 días pero nunca escaneado**
> se considera vencido en su primer escaneo (baseline = fecha de registro). Es coherente
> con "no puede pasar más de 90 días inactivo". Si prefieres una gracia inicial, lo ajusto.

> Nota: la "auto-desactivación sola" (sin que nadie escanee) no puede correr sin un
> proceso de fondo. Se implementa como **auto-desactivación perezosa**: se evalúa y
> persiste en el momento del escaneo. Si quieres además un barrido masivo, se puede
> agregar un botón "Revisar vencidos" (admin) que recorra y desactive. _A confirmar._

---

## 5. App de validación — flujo y pantallas

### 5.1 Arranque (rápido)
- Autentica usuario (`/api/v1/me`) para el campo "Validado por".
- Carga **una vez** `devices_master` en memoria → cada validación es **instantánea**
  (lookup local, sin ida a red).
- Escáner (cámara trasera) listo de inmediato.

### 5.2 Pantalla ESCÁNER (principal)
- Video de cámara a pantalla, con reticula.
- Campo/acción secundaria: **buscar por driver_id** (input + botón).
- Motor de escaneo: `BarcodeDetector` (con fallback), reutilizado de la app actual.
- Al detectar un QR:
  - **JSON con `driver_id`** → flujo driver (todos sus dispositivos).
  - **Texto `dev_...`** (id de sticker) → flujo dispositivo único.

### 5.3 Lookup
- **Sticker `dev_...`**: busca el dispositivo por `id`. Muestra **ese** dispositivo.
- **Driver QR / búsqueda `driver_id`**: filtra por `owner_key = driver:<id>`.
  Muestra **todos** los dispositivos de ese driver.

### 5.4 Pantalla RESULTADO (formato `validacion.html`)
Reutiliza tokens Nocturne + anillo/disco animado + título con degradado.

**Válido (verde):**
- Anillo verde con check animado, título "Acceso válido".
- Meta: **Validado por** (usuario), **Fecha/hora**, y por cada dispositivo una tarjeta:
  - **IMEI** (si smartphone), **Descripción**, **Tipo**, estado (Activo), **[Ver foto]**.
- **Ver foto** → overlay con la imagen (`getDownloadUrl(foto_doc_id)`).
- Semántica multi-dispositivo del anillo: **Válido** si la persona tiene **≥1 dispositivo
  activo**. Los inactivos igual se listan, marcados en gris/rojo.

**Denegado (rojo):**
- Anillo rojo con X animada, título "Acceso denegado".
- Subtítulo con **motivo**:
  - *No registrado* — el id/driver_id no existe.
  - *Inactivo / vencido* — existe pero `status=inactivo` o `>90 días`.

### 5.5 Volver a escanear (ágil)
- Botón grande **"Escanear otro"** siempre visible en el resultado.
- **Guardado optimista**: la pantalla de resultado aparece **al instante** (lookup en
  memoria); las escrituras (`scan_master` + `ultimo_escaneo`) se hacen **en segundo
  plano**, sin bloquear al guardia. Errores de escritura → consola de depuración.
- Opcional (a confirmar): tras N segundos, volver solo al escáner.

### 5.6 Guardado en `scan_master` (solo válidos)
Cada escaneo válido agrega un registro:
```
{ scan_id, timestamp, device_id, owner_key, driver_id?, validado_por, email_validador, resultado: "valido" }
```
Reutiliza `getStateBucket`/`setStateBucket` con manejo de 409.

---

## 6. Cambios en la app de registro (`autorizacion_dispositivos.html`)

Para soportar "agregar dispositivo a persona existente":

1. Al elegir **driver** y escanear su QR (o **otro** + email), tras identificar a la
   persona se consulta si ya tiene dispositivos (`owner_key`).
   - Si **ya existe**: se muestra "Esta persona ya tiene N dispositivos" con la lista,
     y el botón cambia a **"Agregar otro dispositivo"** (mismos datos de persona, se
     captura solo el nuevo dispositivo).
   - Si **no existe**: alta normal (primer dispositivo).
2. Todos los registros nuevos escriben `owner_key`, `owner_tipo`, `status="activo"`,
   `ultimo_escaneo = ahora`.
3. Sin cambios visuales mayores; se respeta Nocturne + Skeleton + SVG Atlas.

> Este cambio es **aditivo**: no rompe el flujo actual, solo evita duplicar la persona.

---

## 7. Componentes reutilizados (sin reinventar)
- `GridClient` (state buckets, upload, `/me`, download, manejo 409, timeout).
- `DebugConsole` (consola de depuración con badge y copiar log).
- `ScannerEngine` (BarcodeDetector + fallback).
- `dataUrlToBlob` con decode base64 manual (evita el `fetch()` que rompe en el iframe de Grid).
- Compresión de imagen igual a `captura_auditoria.html` (solo si hiciera falta; validación no sube fotos).
- Tokens Nocturne + estética verde/rojo de `validacion.html`.
- Mismo `data_doc_id` por querystring, fallback `01KYBPWY7AYSXC0MGZVH1JT2TV`.

---

## 8. Rendimiento / concurrencia
- Lookup en memoria → feedback inmediato.
- Escrituras en segundo plano con reintento ante 409 (varios guardias a la vez).
- Refresco del bucket en memoria tras cada escritura propia y/o cada N minutos.

---

## 9. Supuestos a confirmar antes de construir
1. **Estructura plana + `owner_key`** (recomendada) vs anidada.
2. Dispositivo **registrado hace >90 días y nunca escaneado** = vencido en su 1er escaneo.
3. **Sticker** = valida 1 dispositivo; **driver** = muestra todos.
4. Anillo verde si la persona tiene **≥1 dispositivo activo**.
5. ¿Agregar botón admin "Revisar/desactivar vencidos" (barrido masivo)? (opcional)
6. ¿"Otro" (no-driver) también puede tener multi-dispositivo agrupado por email? (asumo que sí)

---

## 10. Entregables al aprobar
1. `grid/validacion_dispositivos.html` — app de validación completa.
2. Ajustes en `grid/autorizacion_dispositivos.html` — alta multi-dispositivo + campos nuevos.
3. Migración perezosa idempotente de registros existentes.
4. Commit(s) + push a `claude/devices-planning-8h2iof`.
