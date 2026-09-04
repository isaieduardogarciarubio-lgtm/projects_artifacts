---
name: purity-ui-dashboard
description: Sistema de diseño base "Purity UI Dashboard" (Creative Tim, Chakra UI) para los dashboards de este repo. Úsalo siempre que el usuario pida construir, diseñar o actualizar un dashboard, panel de administración, o cualquier pantalla de este proyecto, o mencione "Purity UI", "diseño base del dashboard", "estilo Purity" o pida que algo "se vea como el dashboard". Define paleta, tipografía, layout (sidebar flotante + navbar frosted-glass), tarjetas, botones, charts y breakpoints. Complementa cualquier skill de lógica de negocio aportando la capa visual.
---

# Purity UI Dashboard — Sistema de diseño base

Fuente: [Purity UI Dashboard](https://www.figma.com/design/AO6cECEpoM8f3CFwcjXa5c/Purity-UI-Dashboard---Chakra-UI-Dashboard--Community-) (Creative Tim). El archivo de Figma community solo trae la portada/promo — el diseño real vive en el código open-source (`creativetimofficial/purity-ui-dashboard`, React + Chakra UI), de ahí se extrajeron los tokens de este skill. Úsalos como fuente de verdad en lugar de adivinar valores.

## Cuándo usar este skill

- Cualquier pantalla, componente o layout de un dashboard en este repo.
- Al pedir "que se vea como Purity UI" o "con el diseño base del dashboard".
- Al crear nuevas vistas (tablas, gráficas, formularios, perfiles) que deben mantener consistencia visual con el resto del dashboard.

## Principios de diseño

- **Look**: tarjetas blancas flotantes, esquinas muy redondeadas, sombras suaves y difusas (nunca duras), acentos en teal/turquesa.
- **Sidebar flotante**: no pegada al borde, con margen y radio propio, como si "levitara" sobre el fondo.
- **Navbar frosted-glass**: translúcida con blur, se vuelve visible (sombra + fondo) solo al hacer scroll.
- **Tipografía**: Roboto en todo — títulos en bold, texto secundario en gris claro.
- **Micro-interacciones**: sin anillos de foco (`_focus: boxShadow none`), transiciones lineales suaves (~0.2–0.35s).

## Tokens de diseño

Ver `references/tokens.md` para la tabla completa (colores, tipografía, radios, sombras, breakpoints) con valores hex y equivalentes CSS.

Resumen rápido:

| Token | Valor |
|---|---|
| Color de acento | `teal.300` `#4FD1C5` |
| Texto primario (light) | `gray.700` `#1A202C` (override del tema: `#1f2733`) |
| Texto secundario | `gray.400` `#A0AEC0` |
| Fondo body (light) | `gray.50` `#F7FAFC` |
| Fondo body (dark) | `gray.800` `#1A202C` |
| Fuente | `'Roboto', sans-serif` |
| Radio de tarjetas/botones | `15px` |
| Radio de navbar/sidebar (contenedor) | `16px` |
| Sombra de tarjeta | `0px 3.5px 5.5px rgba(0,0,0,0.02)` |
| Sombra navbar (al hacer scroll) | `0px 7px 23px rgba(0,0,0,0.05)` |
| Breakpoints | sm 320px · md 768px · lg 960px · xl 1200px |

## Layout

- **Sidebar**: 260px de ancho, fija, con margen `16px 0 16px 16px`, fondo blanco (`white` / `gray.700` en dark), radio `16px`, altura `calc(100vh - 32px)`. Logo arriba + separador. Enlace activo = botón con fondo blanco, radio `15px`, ícono en caja de color (`teal.300`, texto blanco); enlace inactivo = fondo transparente, ícono en `teal.300` sobre fondo blanco.
- **Navbar**: posición `absolute` (pasa a `fixed` + sombra al hacer scroll), `backdrop-filter: blur(21px)`, fondo `linear-gradient(112.83deg, rgba(255,255,255,.82) 0%, rgba(255,255,255,.8) 110.84%)` en light. Contiene breadcrumb (`Pages / <Vista actual>`) a la izquierda y acciones/perfil a la derecha. Radio `16px`, `minH: 75px`.
- **Main panel**: flota a la derecha del sidebar (`float: right`), transición `all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)`.
- **Cards**: variante `panel` — fondo blanco (`gray.700` en dark), `padding: 22px`, `borderRadius: 15px`, sombra suave. Es la unidad base para stats, gráficas, tablas y formularios.

## Componentes clave

Ver `references/components.md` para el detalle de: IconBox, Card/CardHeader/CardBody, tarjetas de estadística (stat cards), botones, charts (ApexCharts con gradiente teal→gris oscuro), tablas y breadcrumb de navbar.

## Implementación

- **Si el proyecto usa React + Chakra UI** (como el original): reutiliza los nombres de variante/tema tal cual (`variant="panel"` en `Card`, `IconBox`, `sidebarVariant="opaque"`) para máxima fidelidad — ver snippets en `references/components.md`.
- **Si el proyecto usa otro stack** (Tailwind, CSS plano, Vue, etc.): traduce los tokens de `references/tokens.md` a variables CSS o config del framework (p. ej. `tailwind.config` `colors`/`borderRadius`/`boxShadow`) y reproduce los patrones de layout y componentes descritos arriba — no copies JSX de Chakra literalmente.
- Antes de crear un componente nuevo, revisa si ya existe algo equivalente en el proyecto (otra tarjeta, otro botón) y reutilízalo en vez de duplicar estilos.
- Sigue la skill `dataviz` para las gráficas si hay que generar visualizaciones de datos nuevas, pero respeta la paleta teal/gris de `references/tokens.md` en vez de la paleta neutra por defecto de esa skill.
