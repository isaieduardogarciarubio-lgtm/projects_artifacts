/**
 * Worker de Cloudflare: publica el catálogo de estatus en el repo de
 * Auditorias_SVC, sin exponer nunca el token de GitHub en el navegador.
 *
 * Setup en el dashboard de Cloudflare (Workers & Pages → tu Worker):
 *   Settings → Variables → "Add variable"
 *     Nombre: GITHUB_TOKEN
 *     Valor:  tu fine-grained PAT (Contents: read/write, solo este repo)
 *     Activa el toggle "Encrypt" antes de guardar.
 *
 * Ajusta OWNER/REPO/BRANCH abajo si cambian (BRANCH sobre todo, cuando
 * merges este trabajo a main).
 *
 * El uploader llama a este Worker haciendo:
 *   POST https://<tu-worker>.workers.dev/publish
 *   Body: { "csv": "<contenido crudo del CSV>" }
 */

const OWNER = 'isaieduardogarciarubio-lgtm';
const REPO = 'Auditorias_SVC';
// TODO: cambiar a 'main' cuando este branch se mergee.
const BRANCH = 'claude/auditorias-svc-csv-logs-om685f';

// Restringe qué sitios pueden llamar a este Worker. Cambia esto si mueves
// el uploader a otra URL (ej. un dominio propio en vez de github.io).
const ALLOWED_ORIGIN = 'https://isaieduardogarciarubio-lgtm.github.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/publish' || request.method !== 'POST') {
      return json({ error: 'not_found' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid_json' }, 400);
    }

    const csv = typeof body.csv === 'string' ? body.csv : '';
    const validationError = validateCatalogCsv(csv);
    if (validationError) {
      return json({ error: validationError }, 400);
    }

    // Distingue "el secreto no está configurado" de "GitHub rechazó el
    // token" — sin esto, ambos casos llegan al navegador como el mismo
    // "Bad credentials" genérico de GitHub, imposible de diagnosticar.
    if (!env.GITHUB_TOKEN) {
      return json({ error: 'missing_github_token_env_var', detail: 'La variable GITHUB_TOKEN no está configurada (o el nombre no coincide exactamente) en este Worker.' }, 500);
    }

    try {
      const rows = csv.trim().split('\n').length - 1; // menos la fila de encabezado
      const meta = JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2);

      await putFile(env.GITHUB_TOKEN, 'data/estatus_shipments.csv', csv, 'Actualiza catálogo de estatus');
      await putFile(env.GITHUB_TOKEN, 'data/estatus_shipments_meta.json', meta, 'Actualiza metadata del catálogo de estatus');

      return json({ ok: true, rows });
    } catch (e) {
      return json({ error: 'github_error', detail: e.message }, 502);
    }
  },
};

/** Rechaza CSVs sin las columnas esperadas o sin filas de datos. */
function validateCatalogCsv(csv) {
  if (!csv.trim()) return 'csv_vacio';
  const firstLine = csv.split('\n')[0].toLowerCase();
  const hasId = firstLine.includes('id');
  const hasEstatus = firstLine.includes('estatus');
  const hasOptimizada = firstLine.includes('optimizada');
  if (!hasId || !hasEstatus || !hasOptimizada) return 'columnas_invalidas';
  if (csv.trim().split('\n').length < 2) return 'sin_filas_de_datos';
  return null;
}

async function getFileSha(token, path) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'auditorias-svc-catalog-publish-worker',
      },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${res.status} consultando ${path}`);
  }
  const data = await res.json();
  return data.sha;
}

async function putFile(token, path, content, message) {
  const sha = await getFileSha(token, path);

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'auditorias-svc-catalog-publish-worker',
    },
    body: JSON.stringify({
      message,
      content: toBase64Utf8(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${res.status} subiendo ${path}`);
  }
}

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
