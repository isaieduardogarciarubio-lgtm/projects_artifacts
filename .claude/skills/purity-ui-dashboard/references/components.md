# Purity UI Dashboard — Patrones de componentes

Patrones tal como existen en `creativetimofficial/purity-ui-dashboard`. Usa los snippets de Chakra UI como referencia 1:1 si el proyecto usa React + Chakra; si no, replica el mismo comportamiento visual con el stack disponible (ver `tokens.md`).

## Card (unidad base)

Todo bloque de contenido (stat, gráfica, tabla, formulario) es una `Card` con variante `panel`:

```js
// theme
const Card = {
  baseStyle: {
    p: "22px",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    position: "relative",
    minWidth: "0px",
    wordWrap: "break-word",
    backgroundClip: "border-box",
  },
  variants: {
    panel: (props) => ({
      bg: props.colorMode === "dark" ? "gray.700" : "white",
      width: "100%",
      boxShadow: "0px 3.5px 5.5px rgba(0, 0, 0, 0.02)",
      borderRadius: "15px",
    }),
  },
  defaultProps: { variant: "panel" },
};
```

`CardHeader` y `CardBody` son simples `Flex` de ancho completo (`display: flex; width: 100%`) sin estilos adicionales — el espaciado interno lo da el padding de `Card`.

## IconBox

Caja cuadrada/redondeada usada para íconos con fondo de color, tanto en el sidebar (enlace activo) como en las stat cards:

- Tamaño típico: `h="30px" w="30px"` (sidebar) o mayor en stat cards.
- Fondo `teal.300` con ícono blanco cuando está "activo" / destacado; fondo blanco con ícono `teal.300` cuando es secundario.

## Sidebar

- Contenedor: ancho `260px`, fondo blanco (`gray.700` dark), radio `16px`, margen `16px 0 16px 16px`, altura `calc(100vh - 32px)`, posición fija, visible solo en `xl` (`display: { sm: "none", xl: "block" }`).
- Logo + nombre del proyecto arriba, seguido de un separador.
- Cada enlace es un `Button` de ancho completo, `justifyContent="flex-start"`, `borderRadius="15px"`, sin hover/focus ring:
  - **Activo**: `bg` blanco/gray.700, `IconBox` con `bg="teal.300"` y texto `color="gray.700"`/`white`.
  - **Inactivo**: `bg="transparent"`, `IconBox` con `bg` blanco y `color="teal.300"`, texto en `gray.400`.
- Categorías (agrupadores de enlaces) se renderizan como `Text` en bold, sin fondo.

## Navbar

- `Flex` flotante, `borderRadius="16px"`, `minH="75px"`, ancho `calc(100vw - 75px - 275px)` en `xl`.
- Estado inicial: transparente, sin sombra, `backdropFilter: blur(21px)`.
- Al hacer scroll (`fixed` + `scrolled`): fondo `linear-gradient(112.83deg, rgba(255,255,255,.82) 0%, rgba(255,255,255,.8) 110.84%)`, sombra `0px 7px 23px rgba(0,0,0,0.05)`, borde `#FFFFFF`.
- Contenido: `Breadcrumb` ("Pages / <Vista actual>") a la izquierda, título de la página debajo en bold; acciones/links (búsqueda, notificaciones, perfil) a la derecha vía `AdminNavbarLinks`.
- Variante `secondary` (usada en portadas/landing dentro del dashboard): texto blanco, sin backdrop, más padding lateral.

## Botones

```js
baseStyle: {
  borderRadius: "15px",
  _focus: { boxShadow: "none" },
}
```

- Variante `no-hover`: quita el `boxShadow` en hover.
- Variante `transparent-with-icon`: fondo transparente, `fontWeight: bold`, sin bordes ni sombra en ningún estado — usado para botones tipo ícono dentro de otros componentes.

## Charts (ApexCharts)

- **Bar chart** (ej. "Sales"): barras con `borderRadius: 8`, `columnWidth: "12px"`, sin ejes/grid visibles, tooltip oscuro.
- **Line chart** (ej. "Active Users"): `stroke.curve: "smooth"`, relleno tipo `gradient` vertical de `#4FD1C5` a `#2D3748` (`opacityFrom: 0.8`, `opacityTo: 0`), ejes con labels en `#c8cfca`, `grid.strokeDashArray: 5`, sin leyenda.
- En general: sin toolbar (`chart.toolbar.show: false`), sin `dataLabels`, tooltip con `theme: "dark"`.

## Tablas

- Filas dentro de una `Card` (`variant="panel"`), sin bordes duros entre filas — separación por espaciado y un borde inferior muy sutil.
- Encabezados de columna en `gray.400`, mayúsculas pequeñas.
- Celdas con avatar + texto (nombre/subtítulo) para filas tipo "proyecto" o "usuario"; badges de estado con `textTransform: "capitalize"` y tamaño fijo (`width: 65px, height: 25px` para `md`).

## Reglas generales al construir un componente nuevo

1. Envuélvelo en una `Card`/panel con radio `15px` y la sombra suave definida en `tokens.md` — nunca bordes duros ni sombras marcadas.
2. Usa `teal.300` como único acento de color; el resto de la UI vive en la escala de grises.
3. Sin anillos de foco (`outline`/`box-shadow` en `:focus`) — las interacciones se indican con cambios de fondo/color, no con bordes.
4. Todo texto secundario (labels, breadcrumbs, subtítulos) en `gray.400`; texto principal en `gray.700` (light) / blanco (dark).
5. Transiciones suaves y lineales (200–350ms), nunca instantáneas ni con easing agresivo.
