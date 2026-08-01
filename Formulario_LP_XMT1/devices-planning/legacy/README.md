# Legacy — Aplicación SPA Original

Esta carpeta contiene la aplicación original (SPA standalone) sin integración con Grid.

## ⚠️ Deprecado

Esta versión **ya no se mantiene activamente**. Se preserva como referencia histórica.

### ¿Por qué cambiar a Grid?

- ✅ **Sincronización automática**: Los registros se envían a Grid sin exportar manualmente CSVs
- ✅ **Offline-first**: IndexedDB almacena registros localmente, sincroniza al conectar
- ✅ **Dashboard en tiempo real**: Consolidado_auditoria.html lee directo desde State Buckets
- ✅ **Seguridad**: Sin passphrase en el navegador, autenticación via Grid
- ✅ **Sin fricción**: Operador no descarga/sube CSVs, solo abre la app en Grid

### Migración

Si usabas la app anterior (en esta carpeta), sigue estos pasos:

1. **Nueva app**: Ve a `/grid/captura_auditoria.html` (en Grid)
2. **Dashboard**: Ve a `/grid/consolidado_auditoria.html` (en Grid)
3. **Datos históricos**: Puedes importarlos manualmente con el panel de carga en el dashboard

### Archivos

- `index.html` — App SPA (solo formularios)
- `js/` — Motor de formularios, scanner, almacenamiento local
- `css/` — Estilos Nocturne
- `data/` — Catálogos estáticos

No uses estos archivos en GitHub Pages — usa los nuevos en `grid/` en su lugar.

## 📚 Referencias

- **Nueva captura**: `/grid/captura_auditoria.html`
- **Dashboard**: `/grid/consolidado_auditoria.html`
- **Documentación**: `/grid/README.md`
