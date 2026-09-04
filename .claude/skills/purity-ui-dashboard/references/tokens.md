# Purity UI Dashboard — Design tokens

Extraídos de `creativetimofficial/purity-ui-dashboard` (`src/theme/**`, `src/variables/charts.js`, `src/components/**`). Los valores de la paleta gris/teal son los defaults de Chakra UI (usados por el tema sin sobreescribir, salvo donde se indica).

## Colores

| Uso | Token Chakra | Hex |
|---|---|---|
| Acento / marca (íconos activos, links, gráfica de barras) | `teal.300` | `#4FD1C5` |
| Texto primario (light mode) | `gray.700` (override del tema) | `#1f2733` |
| Texto primario (dark mode) | `white` | `#FFFFFF` |
| Texto secundario / breadcrumb | `gray.400` | `#A0AEC0` |
| Fondo de página (light) | `gray.50` | `#F7FAFC` |
| Fondo de página (dark) | `gray.800` | `#1A202C` |
| Fondo de tarjeta / sidebar (light) | `white` | `#FFFFFF` |
| Fondo de tarjeta / sidebar (dark) | `gray.700` | `#2D3748` |
| Gradiente de línea en charts | `#4FD1C5` → `#2D3748` | vertical, `opacityFrom: .8`, `opacityTo: 0` |
| Borde de navbar (light) | — | `#FFFFFF` |
| Borde de navbar (dark) | — | `rgba(255,255,255,0.31)` |

Nota: `teal.300` es el único acento de marca real en el código (no hay un color "brand" custom); todo lo demás usa la escala `gray` default de Chakra.

## Tipografía

- Familia: `'Roboto', sans-serif` (aplicada a `html` y `body` en `globalStyles`).
- Texto de menú/labels: `fontSize: sm`, `fontWeight: bold` en categorías de sidebar.
- Breadcrumb / texto secundario: tamaño pequeño, color `gray.400`.
- No hay una escala tipográfica custom declarada — se usa la escala default de Chakra (`xs…6xl`) con pesos `normal`/`bold` según jerarquía.

## Radios (border-radius)

| Elemento | Valor |
|---|---|
| Card (`variant="panel"`) | `15px` |
| Botón (`baseStyle`) | `15px` |
| Enlace activo del sidebar | `15px` |
| Contenedor del sidebar (variante opaque) | `16px` |
| Navbar | `16px` |

## Sombras

| Elemento | Valor |
|---|---|
| Card | `0px 3.5px 5.5px rgba(0, 0, 0, 0.02)` |
| Navbar (fijo, con scroll, light) | `0px 7px 23px rgba(0, 0, 0, 0.05)` |
| Navbar (dark) | `none` (usa `filter: drop-shadow(0px 7px 23px rgba(0,0,0,0.05))`) |
| Variante `with-shadow` (botón/drawer) | `0 0 2px 2px #efdfde` |

## Espaciado / layout

- Padding interno de card: `22px`.
- Ancho de sidebar: `260px` (`maxW` igual).
- Margen del sidebar flotante: `16px 0px 16px 16px`.
- Altura del sidebar: `calc(100vh - 32px)`.
- Alto mínimo de navbar: `75px`.
- Ancho del main panel: `calc(100vw - 75px - 275px)` en desktop (`xl`).

## Transiciones

- Main panel: `all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)`.
- Enlaces de sidebar / hover: `0.2s linear`.
- Navbar (scroll): `box-shadow, background-color, filter, border` en `0.25s linear`.
- Sin `box-shadow` en `:focus` en botones y links (`_focus: { boxShadow: "none" }`).

## Breakpoints

| Nombre | Valor |
|---|---|
| `sm` | `320px` |
| `md` | `768px` |
| `lg` | `960px` |
| `xl` | `1200px` |

## Equivalente en CSS variables (para stacks no-Chakra)

```css
:root {
  --purity-accent: #4FD1C5;
  --purity-text-primary: #1f2733;
  --purity-text-secondary: #A0AEC0;
  --purity-bg-page: #F7FAFC;
  --purity-bg-card: #FFFFFF;
  --purity-radius-card: 15px;
  --purity-radius-shell: 16px;
  --purity-shadow-card: 0px 3.5px 5.5px rgba(0, 0, 0, 0.02);
  --purity-shadow-navbar: 0px 7px 23px rgba(0, 0, 0, 0.05);
  --purity-font: 'Roboto', sans-serif;
}

[data-theme="dark"] {
  --purity-text-primary: #FFFFFF;
  --purity-bg-page: #1A202C;
  --purity-bg-card: #2D3748;
}
```
