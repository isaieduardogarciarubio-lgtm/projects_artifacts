# Worker de publicación del catálogo de estatus

Recibe el CSV validado por el uploader (`POST /publish`) y lo comitea al
repo (`data/estatus_shipments.csv` + `data/estatus_shipments_meta.json`)
usando un token de GitHub que vive como secreto en Cloudflare — nunca en
el navegador ni en este código.

## Desplegar conectando este repo a Cloudflare (sin consola)

1. `dash.cloudflare.com` → **Workers & Pages** → **Create** → pestaña
   **Workers** → **"Import a repository"** (conectar con GitHub).
2. Autoriza el acceso y selecciona el repo `Auditorias_SVC`.
3. En la configuración del proyecto, define el **directorio raíz** como
   `cloudflare-worker` (para que Cloudflare use el `wrangler.toml` de
   aquí, no el repo completo).
4. Deploy. Cloudflare te da una URL tipo `https://algo.workers.dev`.
5. En el proyecto ya creado: **Settings → Variables and Secrets → Add** →
   nombre `GITHUB_TOKEN`, valor tu fine-grained PAT (permiso Contents:
   read/write, acotado solo a este repo) → guardar como secreto cifrado.

Cada vez que se haga push a este branch, Cloudflare redespliega solo.

## Ajustar el branch de destino

`worker.js` tiene `BRANCH` hardcodeado a
`claude/auditorias-svc-csv-logs-om685f`. Cambiarlo a `main` cuando este
trabajo se mergee.
