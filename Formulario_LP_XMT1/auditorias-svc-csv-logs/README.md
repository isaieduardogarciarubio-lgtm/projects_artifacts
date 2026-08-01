# Auditoría Grid — Captura + Dashboard

Sistema completo de auditoría integrado con Grid: captura de formularios + dashboard de consolidación en tiempo real.

## 🎯 Migración Completada

✅ **De**: SPA standalone con exportación manual de CSV  
✅ **A**: Grid nativa con sincronización automática e IndexedDB offline-first

## 📱 Dos Aplicaciones

### 1. 🎤 Captura de Auditoría
**Ubicación**: `grid/captura_auditoria.html` (en Grid)

Formulario dinámico para 5 logs:
- **Destino/Doca**: Escanea HU, valida destino y doca
- **FURY**: Escanea shipment, captura foto y situación
- **Contenerizado**: Escanea shipment y situación (foto si hay daño)
- **Linehaul**: Escanea HU, área, origen y canalización
- **Inbound FM**: Escanea patente, diferencia y hallazgo

**Características**:
- ✅ Escaneo nativo (BarcodeDetector para HU/shipment/patente)
- ✅ Compresión de fotos (WebP → JPEG, 25% menos datos)
- ✅ Offline-first (IndexedDB + sincronización automática)
- ✅ Una pregunta por pantalla (mobile-first)
- ✅ Sin dependencias externas (HTML/CSS/JS puro)

### 2. 📊 Dashboard — Consolidado
**Ubicación**: `grid/consolidado_auditoria.html` (en Grid)

Visualización de datos en tiempo real:
- Carga automática desde los 5 State Buckets
- Tabs por tipo de log (Destino/Doca, FURY, Contenerizado, Linehaul, Inbound FM)
- KPIs + gráficos interactivos (Plotly)
- Tabla filtrable con búsqueda
- Modal para ver fotos en resolución completa
- Descarga consolidada en JSON
- Refresh manual o automático en conflictos (409)

## 🚀 Despliegue (5 minutos)

### Paso 1: Crear documento de datos en Grid

```
1. Ve a https://grid.melioffice.com
2. Crea un documento nuevo
3. Copia su DOC_ID de la URL
```

Guarda este `DATA_DOC_ID`.

### Paso 2: Subir las 2 apps a Grid

```
1. Descarga grid/captura_auditoria.html
2. Descarga grid/consolidado_auditoria.html
3. Sube ambos a Grid (como documentos nuevos)
4. Copia los HTML_DOC_IDs
```

### Paso 3: Abrir las apps

**Captura** (llenando formularios):
```
https://grid.melioffice.com/d/{CAPTURA_HTML_DOC_ID}/?data_doc_id={DATA_DOC_ID}
```

**Dashboard** (viendo datos):
```
https://grid.melioffice.com/d/{CONSOLIDADO_HTML_DOC_ID}/?data_doc_id={DATA_DOC_ID}
```

Guarda ambas URLs como favoritos en tu navegador.

## 📋 Flujo de Uso

1. **Operador abre Captura** en Grid
2. **Elige un log** del menú
3. **Completa el formulario** (una pregunta por pantalla)
4. **Escanea** o ingresa manualmente
5. **Captura foto** si es requerido
6. **Envía** → Se guarda localmente y se sincroniza automáticamente
7. **Sin conexión** → Los registros se almacenan en IndexedDB y se sincronizan al reconectar
8. **Abre Dashboard** para ver datos consolidados en tiempo real

## 🏗️ Arquitectura

### State Buckets (Grid)

Cada log se almacena en un bucket independiente:

```
destino_doca_master   → Registros del log Destino/Doca
fury_master           → Registros del log FURY
contenerizado_master  → Registros del log Contenerizado
linehaul_master       → Registros del log Linehaul
inbound_fm_master     → Registros del log Inbound FM
catalogo_destino_doca → Catálogo de destinos/docas (opcional)
```

### Fotos

Se comprimen a WebP/JPEG y se suben como documentos públicos en Grid, almacenando solo el `doc_id` en el registro.

### Sincronización

- **Automática**: Registros se sincronizan inmediatamente si hay conexión
- **Offline**: IndexedDB almacena registros localmente
- **Conflictos**: Manejo automático de 409 con reintento exponencial (500ms, 1s, 2s, 4s, 8s)
- **Badge**: Navbar muestra cantidad de registros pendientes

## 📚 Documentación Completa

Ver `/grid/README.md` para:
- Configuración detallada
- Agregar nuevos campos/logs
- Troubleshooting
- Referencias de API

## 📁 Estructura

```
formulario_lp_xmt1/
├── grid/
│   ├── captura_auditoria.html       # App de captura (~2400 líneas)
│   ├── consolidado_auditoria.html   # Dashboard (~2247 líneas)
│   └── README.md                    # Documentación completa
├── legacy/
│   ├── index.html                   # App SPA antigua (referencia)
│   ├── js/                          # Motor de formularios anterior
│   ├── css/                         # Estilos
│   ├── data/                        # Catálogos estáticos
│   └── README.md                    # Por qué cambiar a Grid
├── .github/                         # GitHub Actions (CI/CD)
└── README.md                        # Este archivo
```

## 🎨 Diseño

- **Tema**: Nocturne (OLED minimalist, tema oscuro MercadoLibre)
- **Mobile-first**: Totalmente responsivo
- **Una pregunta por pantalla**: Flujo enfocado y sin distracciones
- **Colores**: Verde (#008300) para éxito, Rojo (#ff453a) para error

## ✅ Migración de Datos

Si tienes datos históricos de la app anterior (`legacy/`), puedes importarlos:

1. Abre el **Dashboard** (consolidado_auditoria.html)
2. Usa el **panel de carga** (Upload tab)
3. Arrastra tus CSVs o ZIPs
4. Los datos se detectan automáticamente y se importan a los State Buckets

## 📝 Licencia

Uso interno MercadoLibre.

## 🔗 Links Útiles

- **Grid API**: https://grid.melioffice.com/
- **Biblia Grid V11.4**: Secciones 19 (Concurrency), 23 (State Buckets)
- **Nocturne Design System**: Tema oscuro MercadoLibre
- **BarcodeDetector API**: https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
