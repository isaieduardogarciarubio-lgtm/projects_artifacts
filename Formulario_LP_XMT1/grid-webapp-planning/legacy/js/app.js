/**
 * Lógica central de la aplicación
 * Implementa la Guía de Diseño UX/UI: Minimalismo Oscuro y Flujos Asistidos v2.0
 */

class FormApp {
  constructor() {
    this.currentForm = null;
    this.currentFormEngine = null;
    this.lastDestino = null; // destino de la última captura (se mantiene fijo entre capturas)
    this.recordsByForm = {}; // registros acumulados en la sesión, por formId (persisten hasta descargar/limpiar)
    this.catalogCache = {}; // catálogos ya descargados, por catalogUrl

    // Guard de historial: intercepta el botón/gesto "atrás" del sistema
    // (Android) para navegar dentro de la app en vez de salir del navegador.
    this._screen = 'menu';
    this._inSubScreen = false;
    window.addEventListener('popstate', () => this.handleHardwareBack());
    history.replaceState({ screen: 'menu' }, '', '');

    this.init();
  }

  async init() {
    this.showMenu();
  }

  /**
   * Registros acumulados de un formulario (persisten en memoria hasta que
   * el usuario los descargue o los limpie explícitamente)
   */
  getRecords(formId) {
    if (!this.recordsByForm[formId]) this.recordsByForm[formId] = [];
    return this.recordsByForm[formId];
  }

  /**
   * Asegura que exista una entrada extra en el historial mientras estemos
   * fuera del menú, para que el botón "atrás" del sistema navegue dentro
   * de la app en vez de cerrarla.
   */
  ensureBackGuard() {
    if (!this._inSubScreen) {
      history.pushState({ guard: true }, '', '');
      this._inSubScreen = true;
    }
  }

  /**
   * Se ejecuta cuando el usuario usa el botón/gesto "atrás" del sistema.
   */
  handleHardwareBack() {
    if (this.currentFormEngine) {
      this.currentFormEngine.back();
    } else {
      this.showMenu();
    }

    if (this._screen !== 'menu') {
      history.pushState({ guard: true }, '', '');
      this._inSubScreen = true;
    } else {
      this._inSubScreen = false;
    }
  }

  /**
   * Header vacío (solo título, sin controles) — pantalla de selección
   */
  setHeader({ title, leftIcon, leftAction, rightIcon, rightAction } = {}) {
    const left = document.getElementById('navbar_left');
    const right = document.getElementById('navbar_right');

    left.innerHTML = leftIcon
      ? `<button class="icon-btn-plain" aria-label="Atrás" title="Atrás">${Icons.svg(leftIcon, { size: 22 })}</button>`
      : `<img class="navbar-logo" src="data/ML_es_RGB_ML-Pluma-Izquierda-Relleno-B (1).png" alt="MercadoLibre" />`;

    right.innerHTML = rightIcon
      ? `<button class="icon-btn-plain" aria-label="Cerrar" title="Cerrar">${Icons.svg(rightIcon, { size: 22 })}</button>`
      : `<span class="navbar-title">${title || ''}</span>`;

    if (leftIcon && leftAction) left.querySelector('button').addEventListener('click', leftAction);
    if (rightIcon && rightAction) right.querySelector('button').addEventListener('click', rightAction);
  }

  /**
   * Muestra el menú inicial con selector de formularios
   * (pantalla de una sola acción: elegir un formulario)
   */
  showMenu() {
    this.destroyCurrentFormEngine();
    this.lastDestino = null;
    this._screen = 'menu';
    this._inSubScreen = false;
    this.setHeader({ title: 'Auditoría XMT1' });

    const app = document.getElementById('app');
    app.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = `
      <div>
        <h1 class="step-question" style="margin-bottom: var(--spacing-xs);">¿Qué auditoría deseas capturar?</h1>
        <p style="color: var(--color-text-muted); font-size: var(--font-body);">Selecciona un tipo de registro para comenzar</p>
      </div>
    `;

    const grid = document.createElement('div');
    grid.className = 'forms-grid';

    getAllForms().forEach((form) => {
      const card = document.createElement('div');
      card.className = 'form-card';
      const iconClass = form.id === 'fury' ? 'icon-danger' : '';
      card.innerHTML = `
        <div class="form-card-icon">${Icons.svg(form.icon, { size: 20, className: iconClass })}</div>
        <div class="form-card-body">
          <div class="form-card-title">${form.title}</div>
          <div class="form-card-desc">${form.description}</div>
        </div>
        <div class="form-card-arrow">${Icons.svg('arrowRight', { size: 18 })}</div>
      `;
      card.addEventListener('click', () => this.startCapture(form.id));
      grid.appendChild(card);
    });

    content.appendChild(grid);
    content.appendChild(this.renderSavedLogsSection());
    content.appendChild(this.renderPassphraseSection());
    app.appendChild(content);
  }

  /**
   * La contraseña de encriptación ahora se guarda en este dispositivo
   * (localStorage) para no pedirla en cada sesión — pero si el operador la
   * escribió mal o el admin la rotó, necesita una forma de corregirla sin
   * tener que saber borrar el localStorage del navegador a mano.
   */
  renderPassphraseSection() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'var(--spacing-lg)';
    wrap.style.textAlign = 'center';

    const hasPassphrase = !!CryptoEngine.getSessionPassphrase();
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-sm';
    btn.textContent = hasPassphrase ? 'Cambiar contraseña de encriptación' : 'Configurar contraseña de encriptación';
    btn.addEventListener('click', async () => {
      // No borrar la contraseña antes de abrir el modal: promptPassphrase()
      // necesita leerla todavía guardada para mostrarla en la caja "contraseña
      // guardada actualmente". Si el operador cancela, además, así no se pierde.
      try {
        await CryptoGate.promptPassphrase();
        this.showAlert('Contraseña guardada en este dispositivo', 'success');
      } catch (e) {
        this.showAlert('Operación cancelada', 'info');
      }
      this.showMenu();
    });
    wrap.appendChild(btn);
    return wrap;
  }

  /**
   * Sección "Registros Guardados": acceso rápido para ver cada log sin
   * llenar uno nuevo, y descarga masiva de todos los logs con datos.
   */
  renderSavedLogsSection() {
    const wrap = document.createElement('div');

    const formsWithRecords = getAllForms().filter((f) => this.getRecords(f.id).length > 0);
    if (!formsWithRecords.length) return wrap;

    const section = document.createElement('div');
    section.className = 'card';
    section.style.marginTop = 'var(--spacing-lg)';

    const sectionTitle = document.createElement('h3');
    sectionTitle.style.marginBottom = 'var(--spacing-md)';
    sectionTitle.textContent = 'Registros Guardados';
    section.appendChild(sectionTitle);

    formsWithRecords.forEach((form) => {
      const row = document.createElement('div');
      row.className = 'saved-log-row';
      row.innerHTML = `
        <div class="saved-log-info">
          <div class="saved-log-title">${form.title}</div>
          <div class="saved-log-count">${this.getRecords(form.id).length} registro${this.getRecords(form.id).length === 1 ? '' : 's'}</div>
        </div>
      `;
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn btn-secondary btn-sm';
      viewBtn.textContent = 'Ver';
      viewBtn.addEventListener('click', () => this.viewRecords(form.id));
      row.appendChild(viewBtn);
      section.appendChild(row);
    });

    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'btn btn-primary btn-block';
    downloadAllBtn.style.marginTop = 'var(--spacing-md)';
    downloadAllBtn.innerHTML = `${Icons.svg('arrowDown', { size: 18 })}<span>Descargar Todos los Logs</span>`;
    downloadAllBtn.addEventListener('click', () => this.downloadAllLogs(formsWithRecords));
    section.appendChild(downloadAllBtn);

    wrap.appendChild(section);
    return wrap;
  }

  /**
   * Va directo a ver los registros de un formulario, sin iniciar una captura.
   */
  viewRecords(formId) {
    this.currentForm = getFormConfig(formId);
    this.showRecordsPage();
  }

  /**
   * Descarga un único ZIP maestro con una subcarpeta por log (cada una con su
   * CSV y, si aplica, su carpeta fotos/). Una sola descarga, todo organizado.
   */
  async downloadAllLogs(forms) {
    if (!forms.length) return;

    this.showAlert(`Generando ZIP con ${forms.length} log${forms.length === 1 ? '' : 's'}...`, 'info');

    const entries = forms.map((form) => ({
      records: this.getRecords(form.id),
      formConfig: form,
    }));

    const result = await ExportEngine.exportAllZip(entries);
    if (!result.success) {
      this.showAlert(`Error: ${result.error}`, 'error');
      return;
    }

    try {
      const passphrase = await CryptoGate.ensurePassphrase();
      this.showAlert('Encriptando datos...', 'info');
      const encrypted = await CryptoEngine.encryptBlob(result.blob, passphrase);
      const blob = new Blob([encrypted], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditorias_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      this.showAlert('ZIP encriptado y descargado exitosamente', 'success');
    } catch (error) {
      this.showAlert('Descarga cancelada', 'info');
    }
  }

  /**
   * Inicia el flujo de captura de un formulario (una pregunta por pantalla).
   * Si se repite el mismo formulario destino_doca, el destino de la última
   * captura se mantiene fijo y ese paso se salta automáticamente.
   */
  async startCapture(formId) {
    const formConfig = getFormConfig(formId);
    if (!formConfig) {
      this.showAlert('Formulario no encontrado', 'error');
      return;
    }

    this.destroyCurrentFormEngine();
    this._screen = 'capture';
    this.ensureBackGuard();
    this.currentForm = formConfig;

    const app = document.getElementById('app');
    app.innerHTML = '';

    let catalogIndex = {};
    if (formConfig.catalogUrl) {
      app.innerHTML = `<div class="content"><div class="step-support">Cargando catálogo...</div></div>`;
      catalogIndex = await this.loadCatalog(formConfig.catalogUrl);
      if (!catalogIndex) {
        this.showCatalogError(formConfig);
        return;
      }
    }

    app.innerHTML = '';
    const container = document.createElement('div');
    container.id = 'step_container';
    app.appendChild(container);

    const initialValues = {};
    const autoAdvanceFields = [];
    if (formConfig.id === 'destino_doca' && this.lastDestino) {
      initialValues.destino = this.lastDestino;
      autoAdvanceFields.push('destino');
    }

    this.currentFormEngine = new FormEngine(formConfig, {
      onComplete: (data) => this.handleRecordComplete(data),
      onCancel: () => this.showMenu(),
      initialValues,
      autoAdvanceFields,
      catalogIndex,
    });

    this.setHeader({
      leftIcon: 'arrowLeft',
      leftAction: () => this.currentFormEngine.back(),
      rightIcon: 'close',
      rightAction: () => this.showMenu(),
    });

    this.currentFormEngine.render('step_container');
  }

  /**
   * Descarga y parsea el catálogo Destino → Docas desde un CSV estático.
   * Retorna null si falla (el llamador debe mostrar una pantalla de error/reintento,
   * ya que sin catálogo no hay opciones válidas para elegir).
   */
  async loadCatalog(url) {
    if (this.catalogCache[url]) return this.catalogCache[url];

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const { headers, records } = CSVEngine.parseCSV(text);

      const destinoCol = headers.find((h) => h.trim().toLowerCase() === 'destino');
      const docaCol = headers.find((h) => h.trim().toLowerCase() === 'doca');
      if (!destinoCol || !docaCol) {
        throw new Error('El catálogo no tiene las columnas esperadas (Destino / Doca)');
      }

      const index = {};
      records.forEach((r) => {
        const destino = (r[destinoCol] || '').trim();
        if (!destino) return;
        const docas = String(r[docaCol] || '')
          .split(';')
          .map((d) => d.trim())
          .filter(Boolean);
        index[destino] = docas;
      });

      this.catalogCache[url] = index;
      return index;
    } catch (err) {
      return null;
    }
  }

  /**
   * Pantalla de error cuando el catálogo no pudo descargarse, con reintento.
   */
  showCatalogError(formConfig) {
    this._screen = 'catalog-error';
    this.ensureBackGuard();
    this.setHeader({
      leftIcon: 'arrowLeft',
      leftAction: () => this.showMenu(),
    });

    const app = document.getElementById('app');
    app.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${Icons.svg('alertCircle', { size: 28 })}</div>
        <p>No se pudo cargar el catálogo. Revisa tu conexión e intenta de nuevo.</p>
      </div>
    `;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary btn-block';
    retryBtn.style.marginTop = 'var(--spacing-lg)';
    retryBtn.innerHTML = `${Icons.svg('refresh', { size: 18 })}<span>Reintentar</span>`;
    retryBtn.addEventListener('click', () => this.startCapture(formConfig.id));
    content.appendChild(retryBtn);

    app.appendChild(content);
  }

  /**
   * Libera recursos del paso de captura anterior (viewport y cámara)
   */
  destroyCurrentFormEngine() {
    if (this.currentFormEngine) {
      this.currentFormEngine.destroy();
      this.currentFormEngine = null;
    }
  }

  /**
   * Se ejecuta al completar todas las preguntas de un formulario
   */
  handleRecordComplete(data) {
    // Columnas calculadas que no son parte de las preguntas (ej. Fecha/Hora)
    if (this.currentForm.csvColumns.some((c) => c.field === 'ts') && !data.ts) {
      data.ts = new Date().toLocaleString('es-MX');
    }

    if (this.currentForm.id === 'destino_doca') {
      this.lastDestino = data.destino;
    }

    const records = this.getRecords(this.currentForm.id);
    records.push(data);
    this.showAlert(`Registro agregado (total: ${records.length})`, 'success');
    this.showRecordsPage();
  }

  /**
   * Pantalla de resumen: registros acumulados + acciones (exportar / agregar otro)
   */
  showRecordsPage() {
    this.destroyCurrentFormEngine();
    this._screen = 'records';
    this.ensureBackGuard();
    this.setHeader({
      leftIcon: 'arrowLeft',
      leftAction: () => this.showMenu(),
    });

    const app = document.getElementById('app');
    app.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'content';

    const title = document.createElement('h1');
    title.className = 'step-question';
    title.style.marginBottom = 'var(--spacing-lg)';
    title.textContent = this.currentForm.title;
    content.appendChild(title);

    const records = this.getRecords(this.currentForm.id);

    if (records.length > 0) {
      const recordsSection = document.createElement('div');
      recordsSection.className = 'card';

      const recordsTitle = document.createElement('h3');
      recordsTitle.style.marginBottom = 'var(--spacing-md)';
      recordsTitle.innerHTML = `<span>Registros Acumulados</span> <span class="form-card-meta" style="margin-left:auto">${records.length}</span>`;
      recordsTitle.style.display = 'flex';
      recordsTitle.style.alignItems = 'center';
      recordsSection.appendChild(recordsTitle);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'records-table-wrap';
      tableWrap.appendChild(this.renderRecordsTable());
      recordsSection.appendChild(tableWrap);

      content.appendChild(recordsSection);

      const actionButtonGroup = document.createElement('div');
      actionButtonGroup.className = 'flex-row';
      actionButtonGroup.style.marginTop = 'var(--spacing-lg)';
      actionButtonGroup.style.marginBottom = '100px';

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary btn-block';
      addBtn.innerHTML = `${Icons.svg('plus', { size: 18 })}<span>Agregar Otro Registro</span>`;
      addBtn.addEventListener('click', () => this.startCapture(this.currentForm.id));

      const exportBtn = document.createElement('button');
      exportBtn.className = 'btn btn-secondary btn-block';
      const hasPhotos = ExportEngine.formHasPhotos(this.currentForm);
      exportBtn.innerHTML = hasPhotos
        ? `<span>Descargar ZIP (CSV + fotos)</span>`
        : `<span>Descargar CSV</span>`;
      exportBtn.addEventListener('click', () => this.exportRecords());

      const clearBtn = document.createElement('button');
      clearBtn.className = 'btn btn-secondary btn-block';
      clearBtn.innerHTML = `<span>Limpiar Todo</span>`;
      clearBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro? Se perderán todos los registros.')) {
          this.recordsByForm[this.currentForm.id] = [];
          this.showRecordsPage();
        }
      });

      actionButtonGroup.appendChild(addBtn);
      actionButtonGroup.appendChild(exportBtn);
      actionButtonGroup.appendChild(clearBtn);
      content.appendChild(actionButtonGroup);
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <div class="empty-state-icon">${Icons.svg('inbox', { size: 28 })}</div>
        <p>Aún no hay registros.</p>
      `;
      content.appendChild(emptyState);

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary btn-block';
      addBtn.style.marginTop = 'var(--spacing-lg)';
      addBtn.innerHTML = `<span>Comenzar</span>${Icons.svg('arrowRight', { size: 18 })}`;
      addBtn.addEventListener('click', () => this.startCapture(this.currentForm.id));
      content.appendChild(addBtn);
    }

    app.appendChild(content);
  }

  /**
   * Elimina un registro por índice
   */
  deleteRecord(index) {
    if (confirm('¿Eliminar este registro?')) {
      this.getRecords(this.currentForm.id).splice(index, 1);
      this.showAlert('Registro eliminado', 'success');
      this.showRecordsPage();
    }
  }

  /**
   * Renderiza tabla de registros
   */
  renderRecordsTable() {
    const table = document.createElement('table');
    table.className = 'records-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    this.currentForm.csvColumns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.header;
      headerRow.appendChild(th);
    });

    const thAction = document.createElement('th');
    thAction.textContent = 'Acciones';
    thAction.style.width = '80px';
    headerRow.appendChild(thAction);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.getRecords(this.currentForm.id).forEach((record, index) => {
      const row = document.createElement('tr');

      this.currentForm.csvColumns.forEach((col) => {
        const td = document.createElement('td');
        const value = record[col.field] || '';

        if (col.type === 'photo') {
          if (String(value).startsWith('data:')) {
            const img = document.createElement('img');
            img.className = 'record-thumb';
            img.src = value;
            img.alt = 'Foto';
            td.appendChild(img);
          } else {
            td.textContent = '—';
          }
        } else {
          td.textContent = value.length > 50 ? value.substring(0, 50) + '...' : value;
          td.title = value;
        }
        row.appendChild(td);
      });

      const tdAction = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-secondary btn-sm';
      deleteBtn.innerHTML = Icons.svg('trash', { size: 18 });
      deleteBtn.title = 'Eliminar registro';
      deleteBtn.addEventListener('click', () => this.deleteRecord(index));
      tdAction.appendChild(deleteBtn);
      row.appendChild(tdAction);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    return table;
  }

  /**
   * Exporta los registros del log actual. Si el log captura fotos, genera un
   * ZIP (CSV + carpeta fotos/); si no, un CSV simple.
   */
  async exportRecords() {
    const records = this.getRecords(this.currentForm.id);

    try {
      if (ExportEngine.formHasPhotos(this.currentForm)) {
        this.showAlert('Generando ZIP...', 'info');
        const result = await ExportEngine.exportLogZip(records, this.currentForm);
        if (!result.success) {
          this.showAlert(`Error: ${result.error}`, 'error');
          return;
        }

        const passphrase = await CryptoGate.ensurePassphrase();
        this.showAlert('Encriptando datos...', 'info');
        const encrypted = await CryptoEngine.encryptBlob(result.blob, passphrase);
        const blob = new Blob([encrypted], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        this.showAlert('ZIP encriptado y descargado exitosamente', 'success');
        return;
      }

      const result = await CSVEngine.exportAndDownloadEncrypted(records, this.currentForm);
      if (result.success) {
        this.showAlert('CSV encriptado y descargado exitosamente', 'success');
      } else {
        this.showAlert(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showAlert('Descarga cancelada', 'info');
    }
  }

  /**
   * Muestra una alerta temporal con icono
   */
  showAlert(message, type = 'info') {
    const iconByType = {
      success: 'checkCircle',
      error: 'alertCircle',
      info: 'infoCircle',
    };

    const hasFloatingActions = !!document.querySelector('.step-actions');

    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.style.position = 'fixed';
    alertEl.style.bottom = hasFloatingActions
      ? 'calc(96px + env(safe-area-inset-bottom))'
      : 'calc(var(--spacing-lg) + env(safe-area-inset-bottom))';
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

    setTimeout(() => {
      alertEl.remove();
    }, 3000);
  }
}

// Instancia global
let app;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  app = new FormApp();
});
