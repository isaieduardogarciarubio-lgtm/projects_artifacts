/**
 * Uploader de Catálogo de Estatus
 *
 * Toma el CSV físico (columnas ID, ESTATUS, OPTIMIZADA) que produce el
 * sistema de origen, lo valida, y al confirmar lo publica como archivos
 * estáticos en el repo (data/estatus_shipments.csv + metadata) vía la API
 * de GitHub. GitHub Pages redespliega solo tras el commit (~1 min) y desde
 * ese momento CUALQUIER persona que abra la app de auditoría, en cualquier
 * dispositivo, ve el mismo catálogo — no es algo que viva en el navegador
 * de quien lo subió.
 *
 * A propósito NO usa form-engine.js: no es un asistente de una pregunta por
 * pantalla, es un validador/publicador de un archivo existente
 * (potencialmente cientos de filas).
 */

const STATUS_CATALOG_CSV_URL = '../data/estatus_shipments.csv';
const STATUS_CATALOG_META_URL = '../data/estatus_shipments_meta.json';
const STALE_MAX_AGE_MS = 60 * 60 * 1000;

// Worker de Cloudflare que guarda el token de GitHub del lado del servidor
// y hace el commit por nosotros — el navegador nunca ve ni maneja ningún
// secreto. Ver cloudflare-worker/ en la raíz del repo para su código.
const PUBLISH_WORKER_URL = 'https://svc-audito.isaig-rubio.workers.dev/publish';

class UploaderApp {
  constructor() {
    this.parsedPreview = null; // { headers, records, rawText } del archivo recién elegido, sin publicar aún
    this.validationError = null;
    this.publicCatalog = null; // { count, generatedAt } publicado actualmente en el repo
    this.publishing = false;
    this.init();
  }

  async init() {
    this.setHeader();
    await this.loadPublicCatalogStatus();
    this.render();
  }

  setHeader() {
    const left = document.getElementById('navbar_left');
    const right = document.getElementById('navbar_right');
    left.innerHTML = `<img class="navbar-logo" src="../data/ML_es_RGB_ML-Pluma-Izquierda-Relleno-B (1).png" alt="MercadoLibre" />`;
    right.innerHTML = `<span class="navbar-title">Catálogo de Estatus</span>`;
  }

  /** Mismo mecanismo de lectura pública que usa la app de auditoría. */
  async loadPublicCatalogStatus() {
    try {
      const [csvRes, metaRes] = await Promise.all([
        fetch(STATUS_CATALOG_CSV_URL, { cache: 'no-store' }),
        fetch(STATUS_CATALOG_META_URL, { cache: 'no-store' }),
      ]);
      if (!csvRes.ok || !metaRes.ok) {
        this.publicCatalog = null;
        return;
      }
      const csvText = await csvRes.text();
      const meta = await metaRes.json();
      const { records } = CSVEngine.parseCSV(csvText);
      this.publicCatalog = {
        count: records.length,
        generatedAt: meta.generatedAt ? new Date(meta.generatedAt).getTime() : null,
      };
    } catch (e) {
      this.publicCatalog = null;
    }
  }

  isStale(generatedAt) {
    return !generatedAt || Date.now() - generatedAt > STALE_MAX_AGE_MS;
  }

  formatAge(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `hace ${hours} h ${minutes % 60} min`;
  }

  render() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'content';

    if (this.isStale(this.publicCatalog && this.publicCatalog.generatedAt)) {
      const banner = document.createElement('div');
      banner.className = 'stale-banner';
      const message = !this.publicCatalog
        ? 'Todavía no hay ningún catálogo publicado.'
        : `El catálogo publicado lleva ${this.formatAge(Date.now() - this.publicCatalog.generatedAt)} sin actualizarse. La información debe ser siempre la más reciente — verifica el estatus de los shipments antes de publicar uno nuevo.`;
      banner.innerHTML = `
        <div class="stale-banner-icon">${Icons.svg('alertCircle', { size: 26 })}</div>
        <div class="stale-banner-text">${message}</div>
      `;
      content.appendChild(banner);
    }

    const intro = document.createElement('div');
    intro.innerHTML = `
      <h1 class="step-question" style="margin-bottom: var(--spacing-xs);">Catálogo de estatus</h1>
      <p style="color: var(--color-text-muted); font-size: var(--font-body);">Sube el CSV físico con columnas ID, ESTATUS, OPTIMIZADA. Al publicarlo queda disponible para cualquiera que abra la app de auditoría, en cualquier dispositivo.</p>
    `;
    content.appendChild(intro);

    content.appendChild(this.renderUploadCard());
    content.appendChild(this.renderNavSection());

    app.appendChild(content);
  }

  renderUploadCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = 'var(--spacing-lg)';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.txt';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) this.handleFile(file);
    });
    card.appendChild(fileInput);

    if (this.validationError) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-state-icon">${Icons.svg('alertCircle', { size: 28 })}</div>
        <p>${this.validationError}</p>
      `;
      card.appendChild(empty);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-secondary btn-block';
      retryBtn.style.marginTop = 'var(--spacing-md)';
      retryBtn.innerHTML = `${Icons.svg('refresh', { size: 18 })}<span>Elegir otro archivo</span>`;
      retryBtn.addEventListener('click', () => {
        this.validationError = null;
        this.render();
      });
      card.appendChild(retryBtn);
      return card;
    }

    if (this.parsedPreview) {
      const summary = document.createElement('p');
      summary.innerHTML = `<strong>${this.parsedPreview.records.length} shipments</strong> encontrados. Revisa el preview y publica para que quede disponible para todos.`;
      card.appendChild(summary);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'records-table-wrap';
      tableWrap.appendChild(this.renderPreviewTable(this.parsedPreview));
      card.appendChild(tableWrap);
      if (this.parsedPreview.records.length > 5) {
        const note = document.createElement('p');
        note.style.color = 'var(--color-text-muted)';
        note.style.fontSize = '0.85rem';
        note.textContent = `Mostrando 5 de ${this.parsedPreview.records.length} filas.`;
        card.appendChild(note);
      }

      const actions = document.createElement('div');
      actions.className = 'flex-row';
      actions.style.marginTop = 'var(--spacing-md)';

      const changeBtn = document.createElement('button');
      changeBtn.className = 'btn btn-secondary btn-block';
      changeBtn.innerHTML = `<span>Elegir otro archivo</span>`;
      changeBtn.addEventListener('click', () => {
        this.parsedPreview = null;
        this.render();
      });

      const publishBtn = document.createElement('button');
      publishBtn.className = 'btn btn-primary btn-block';
      publishBtn.disabled = this.publishing;
      publishBtn.innerHTML = this.publishing
        ? `<span>Publicando...</span>`
        : `${Icons.svg('checkCircle', { size: 18 })}<span>Publicar catálogo</span>`;
      publishBtn.addEventListener('click', () => this.publishCatalog());

      actions.appendChild(changeBtn);
      actions.appendChild(publishBtn);
      card.appendChild(actions);
      return card;
    }

    if (this.publicCatalog) {
      const summary = document.createElement('p');
      summary.innerHTML = `Catálogo publicado actualmente: <strong>${this.publicCatalog.count} shipments</strong> · ${this.publicCatalog.generatedAt ? this.formatAge(Date.now() - this.publicCatalog.generatedAt) : 'fecha desconocida'}.`;
      card.appendChild(summary);
    }

    card.appendChild(this.renderDropzone(fileInput));
    return card;
  }

  /**
   * Zona de arrastrar y soltar (además de click para abrir el explorador).
   */
  renderDropzone(fileInput) {
    const dropzone = document.createElement('button');
    dropzone.type = 'button';
    dropzone.className = 'photo-dropzone';
    dropzone.innerHTML = `
      <span class="photo-dropzone-icon">${Icons.svg('clipboard', { size: 30 })}</span>
      <span class="photo-dropzone-label">Elegir o arrastrar CSV de estatus</span>
    `;
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('is-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    return dropzone;
  }

  renderPreviewTable(preview) {
    const table = document.createElement('table');
    table.className = 'records-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    preview.headers.forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    preview.records.slice(0, 5).forEach((record) => {
      const row = document.createElement('tr');
      preview.headers.forEach((h) => {
        const td = document.createElement('td');
        td.textContent = record[h] || '';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    return table;
  }

  async handleFile(file) {
    const text = await file.text();
    const { headers, records } = CSVEngine.parseCSV(text);

    const idCol = headers.find((h) => h.trim().toLowerCase() === 'id');
    const estatusCol = headers.find((h) => h.trim().toLowerCase() === 'estatus');
    const optimizadaCol = headers.find((h) => h.trim().toLowerCase() === 'optimizada');

    if (!idCol || !estatusCol || !optimizadaCol) {
      this.validationError = 'El archivo no tiene las columnas esperadas (ID, ESTATUS, OPTIMIZADA). Verifica los encabezados y vuelve a intentarlo.';
      this.parsedPreview = null;
      this.render();
      return;
    }

    if (!records.length) {
      this.validationError = 'El archivo no tiene filas de datos.';
      this.parsedPreview = null;
      this.render();
      return;
    }

    this.validationError = null;
    this.parsedPreview = { headers, records, rawText: text };
    this.render();
  }

  async publishCatalog() {
    this.publishing = true;
    this.render();

    try {
      const res = await fetch(PUBLISH_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: this.parsedPreview.rawText }),
      });
      const rawBody = await res.text();

      let data = {};
      try {
        data = JSON.parse(rawBody);
      } catch (e) {
        /* respuesta no-JSON; data queda vacío */
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }

      this.publishing = false;
      this.parsedPreview = null;
      await this.loadPublicCatalogStatus();
      this.render();
      this.showAlert('Catálogo publicado. GitHub Pages tarda ~1 min en desplegarlo.', 'success');
    } catch (e) {
      this.publishing = false;
      this.render();
      this.showAlert(`No se pudo publicar: ${e.message}`, 'error');
    }
  }

  showAlert(message, type = 'info') {
    const iconByType = { success: 'checkCircle', error: 'alertCircle', info: 'infoCircle' };
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.style.position = 'fixed';
    alertEl.style.bottom = 'calc(var(--spacing-lg) + env(safe-area-inset-bottom))';
    alertEl.style.left = 'var(--spacing-md)';
    alertEl.style.right = 'var(--spacing-md)';
    alertEl.style.maxWidth = '380px';
    alertEl.style.marginLeft = 'auto';
    alertEl.style.marginRight = 'auto';
    alertEl.style.zIndex = '9999';
    alertEl.innerHTML = `
      <span class="alert-icon">${Icons.svg(iconByType[type] || 'infoCircle', { size: 16 })}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), 4000);
  }

  /**
   * Botón para ir a la app de auditoría — ambas apps viven en el mismo
   * repo/sitio de GitHub Pages, así que es un link relativo normal.
   */
  renderNavSection() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'var(--spacing-lg)';
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'center';

    const link = document.createElement('a');
    link.href = '../';
    link.className = 'icon-nav-btn';
    link.title = 'Ir a la app de Auditoría';
    link.setAttribute('aria-label', 'Ir a la app de Auditoría');
    link.innerHTML = Icons.svg('scan', { size: 20 });
    wrap.appendChild(link);
    return wrap;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new UploaderApp();
});
