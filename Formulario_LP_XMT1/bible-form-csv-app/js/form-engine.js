/**
 * Motor de flujo de captura — una pregunta por pantalla (Single-Task Focus)
 * Basado en la Guía de Diseño UX/UI: Minimalismo Oscuro (Sección 1.1)
 * Soporta campos de texto/select/textarea, 'scanner' (QR/barras),
 * 'destino_picker' y 'doca_picker' (buscador + lista fija; el texto solo
 * filtra, solo se avanza eligiendo una opción), usados por el log
 * Auditoría - Destino / Doca.
 */

class FormEngine {
  constructor(formConfig, { onComplete, onCancel, initialValues, autoAdvanceFields, catalogIndex } = {}) {
    this.formConfig = formConfig;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.initialValues = initialValues || {};
    this.autoAdvanceFields = autoAdvanceFields || [];
    this.catalogIndex = catalogIndex || {};
    this.stepIndex = 0;
    this.values = {};
    this.container = null;
    this.currentInput = null;
    this.actionsEl = null;
    this.errorTargetEl = null;
    this.scanner = null;
    this.handleViewportChange = this.repositionActions.bind(this);
  }

  get currentField() {
    return this.formConfig.fields[this.stepIndex];
  }

  /**
   * Un campo está oculto cuando su condición showIf(values) es falsa.
   * Los campos ocultos se saltan (hacia adelante y hacia atrás) y reciben
   * su valueWhenHidden (ej. origen → "XMT1") al normalizar.
   */
  isFieldHidden(field) {
    return !!(field && field.showIf && !field.showIf(this.values));
  }

  /**
   * Último paso *visible*: no quedan campos visibles después del actual.
   * (Los campos condicionales ocultos al final no cuentan.)
   */
  get isLastStep() {
    for (let i = this.stepIndex + 1; i < this.formConfig.fields.length; i++) {
      if (!this.isFieldHidden(this.formConfig.fields[i])) return false;
    }
    return true;
  }

  render(containerId) {
    this.container = document.getElementById(containerId);
    this.stepIndex = 0;
    this.values = { ...this.initialValues };
    // Campos precargados que se saltan una sola vez al avanzar hacia adelante
    this._autoAdvancePending = { ...this.initialValues };
    this.bindViewportTracking();
    this.renderStep();
  }

  /**
   * El teclado nativo no siempre reduce el layout viewport (position: fixed
   * queda anclado bajo el teclado). Usamos Visual Viewport API para
   * desplazar la barra de acciones y mantenerla siempre visible sobre él.
   */
  bindViewportTracking() {
    if (!window.visualViewport || this.viewportBound) return;
    this.viewportBound = true;
    window.visualViewport.addEventListener('resize', this.handleViewportChange);
    window.visualViewport.addEventListener('scroll', this.handleViewportChange);
  }

  repositionActions() {
    if (!this.actionsEl || !window.visualViewport) return;
    const vv = window.visualViewport;
    const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    this.actionsEl.style.transform = keyboardInset > 0 ? `translateY(-${keyboardInset}px)` : '';
  }

  stopScanner() {
    if (this.scanner) {
      this.scanner.stop();
      this.scanner = null;
    }
  }

  destroy() {
    this.stopScanner();
    if (!window.visualViewport || !this.viewportBound) return;
    window.visualViewport.removeEventListener('resize', this.handleViewportChange);
    window.visualViewport.removeEventListener('scroll', this.handleViewportChange);
    this.viewportBound = false;
  }

  renderStep() {
    this.stopScanner();
    const field = this.currentField;

    // Si este campo ya viene precargado (ej. destino fijo entre capturas),
    // lo saltamos una sola vez y avanzamos directo al siguiente paso.
    if (this.autoAdvanceFields.includes(field.id) && this._autoAdvancePending[field.id] !== undefined) {
      delete this._autoAdvancePending[field.id];
      this.advance({ silent: true });
      return;
    }

    // Campo condicional oculto: guarda su valor derivado y salta.
    if (this.isFieldHidden(field)) {
      this.values[field.id] = field.valueWhenHidden ? field.valueWhenHidden(this.values) : '';
      this.advance({ silent: true });
      return;
    }

    if (field.type === 'scanner') {
      this.renderScannerStep(field);
      return;
    }
    if (field.type === 'destino_picker') {
      this.renderDestinoStep(field);
      return;
    }
    if (field.type === 'doca_picker') {
      this.renderDocaStep(field);
      return;
    }
    if (field.type === 'choice') {
      this.renderChoiceStep(field);
      return;
    }
    if (field.type === 'photo') {
      this.renderPhotoStep(field);
      return;
    }

    this.container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'step-screen';

    screen.appendChild(this.buildProgress());

    const h1 = document.createElement('h1');
    h1.className = 'step-question';
    h1.textContent = field.label;
    screen.appendChild(h1);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'step-input-wrap';

    const input = this.buildInput(field);
    input.value = this.values[field.id] || '';
    inputWrap.appendChild(input);
    screen.appendChild(inputWrap);

    const support = document.createElement('div');
    support.className = 'step-support';
    screen.appendChild(support);

    this.container.appendChild(screen);

    this.currentInput = input;
    this.inputWrapEl = inputWrap;
    this.errorTargetEl = inputWrap;
    this.supportEl = support;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && field.type !== 'textarea') {
        e.preventDefault();
        this.next();
      }
    });

    input.addEventListener('input', () => this.clearError());

    this.renderActions(field);

    setTimeout(() => input.focus(), 60);
  }

  buildProgress() {
    // Cuenta solo pasos visibles según las condiciones actuales, para que la
    // numeración no salte al ocultarse campos condicionales.
    const fields = this.formConfig.fields;
    const visible = fields.map((_, i) => i).filter((i) => !this.isFieldHidden(fields[i]));
    const total = visible.length;
    const pos = visible.indexOf(this.stepIndex) + 1;

    const progress = document.createElement('div');
    progress.className = 'step-progress';
    progress.textContent = `${pos} / ${total}`;
    return progress;
  }

  buildInput(field) {
    let input;

    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'step-input';
      field.options.forEach((option) => {
        const optEl = document.createElement('option');
        optEl.value = option.value;
        optEl.textContent = option.label;
        input.appendChild(optEl);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'step-input';
      input.placeholder = field.placeholder || '';
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = field.type;
      input.className = 'step-input';
      input.placeholder = field.placeholder || '';
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
    }

    input.id = field.id;
    input.name = field.id;
    return input;
  }

  renderActions(field) {
    const actions = document.createElement('div');
    actions.className = 'step-actions';

    if (!field.required) {
      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'btn btn-secondary';
      skipBtn.textContent = 'Omitir';
      skipBtn.addEventListener('click', () => this.skip());
      actions.appendChild(skipBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-primary';
    nextBtn.innerHTML = this.isLastStep
      ? `<span>Agregar Registro</span>${Icons.svg('check', { size: 16 })}`
      : `<span>Continuar</span>${Icons.svg('arrowRight', { size: 16 })}`;
    nextBtn.addEventListener('click', () => this.next());

    actions.appendChild(nextBtn);
    this.container.appendChild(actions);
    this.actionsEl = actions;
    this.repositionActions();
  }

  /**
   * Reemplaza la barra de acciones flotante con botones a medida.
   * @param {HTMLElement[]} children
   */
  setActions(children) {
    const existing = this.container.querySelector('.step-actions');
    if (existing) existing.remove();

    const actions = document.createElement('div');
    actions.className = 'step-actions';
    children.forEach((c) => c && actions.appendChild(c));
    this.container.appendChild(actions);
    this.actionsEl = actions;
    this.repositionActions();
  }

  makeButton(label, { primary, icon, iconAfter, onClick } = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${primary ? 'btn-primary' : 'btn-secondary'}`;
    const iconSvg = icon ? Icons.svg(icon, { size: 16 }) : '';
    btn.innerHTML = iconAfter ? `<span>${label}</span>${iconSvg}` : `${iconSvg}<span>${label}</span>`;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  /* ======================================================================
     Campo escáner (QR / código de barras)
     ====================================================================== */

  renderScannerStep(field) {
    this.container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'step-screen scanner-screen';

    screen.appendChild(this.buildProgress());

    const h1 = document.createElement('h1');
    h1.className = 'step-question';
    h1.textContent = field.label;
    screen.appendChild(h1);

    const body = document.createElement('div');
    body.className = 'scanner-body';
    screen.appendChild(body);

    const support = document.createElement('div');
    support.className = 'step-support';
    screen.appendChild(support);

    this.container.appendChild(screen);

    this.scannerBody = body;
    this.supportEl = support;

    this.enterScanningState(field);
  }

  async enterScanningState(field) {
    this.stopScanner();
    this.supportEl.textContent = 'Apunta la cámara al código QR o de barras.';
    this.supportEl.classList.remove('error');

    this.scannerBody.innerHTML = `
      <div class="scanner-viewport">
        <video class="scanner-video" playsinline muted></video>
        <div class="scanner-frame"><span class="scanner-line"></span></div>
      </div>
    `;

    const manualBtn = this.makeButton('Escribir manualmente', {
      icon: 'keyboard',
      onClick: () => this.enterManualState(field),
    });
    this.setActions([manualBtn]);

    if (!ScannerEngine.isSupported()) {
      this.enterManualState(field, 'Tu navegador no permite usar la cámara. Escribe el código manualmente.');
      return;
    }

    const video = this.scannerBody.querySelector('.scanner-video');
    this.scanner = new ScannerEngine();

    try {
      await this.scanner.start(video, (text, format) => {
        this.onScanDetected(field, text, format);
      });
      this.maybeAddTorchButton();
    } catch (err) {
      const msg =
        err && err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Escribe el código manualmente.'
          : 'No se pudo abrir la cámara. Escribe el código manualmente.';
      this.enterManualState(field, msg);
    }
  }

  maybeAddTorchButton() {
    if (!this.scanner || !this.scanner.hasTorch()) return;
    const viewport = this.scannerBody.querySelector('.scanner-viewport');
    if (!viewport) return;
    const torchBtn = document.createElement('button');
    torchBtn.type = 'button';
    torchBtn.className = 'scanner-torch';
    torchBtn.setAttribute('aria-label', 'Linterna');
    torchBtn.innerHTML = Icons.svg('flash', { size: 20 });
    let on = false;
    torchBtn.addEventListener('click', async () => {
      on = !on;
      const ok = await this.scanner.setTorch(on);
      torchBtn.classList.toggle('active', ok && on);
    });
    viewport.appendChild(torchBtn);
  }

  onScanDetected(field, text, format) {
    if (this.scanner) this.scanner.pause();

    const parsed = ScanParser.parse(text, field.idType);
    if (!parsed) {
      this.vibrate(40);
      this.enterScanRejected(field);
      return;
    }

    this.vibrate(60);
    this.enterDetectedState(field, parsed, format);
  }

  /**
   * Devuelve la etiqueta legible del tipo de identificador esperado, para
   * mostrar mensajes de error específicos (HU, Shipment ID o Patente).
   */
  idTypeLabel(field) {
    const labels = { hu: 'HU', shipment: 'Shipment ID', plate: 'Patente' };
    return labels[field.idType] || 'código';
  }

  /**
   * El código escaneado no tiene el formato esperado para este campo (o
   * corresponde a otro tipo, p. ej. un Shipment en un campo de HU). Se
   * muestra un aviso breve y se reanuda el escaneo automáticamente.
   */
  enterScanRejected(field) {
    this.supportEl.textContent = `Código no reconocido. Verifica que sea el ${this.idTypeLabel(field)} correcto.`;
    this.supportEl.classList.add('error');
    setTimeout(() => {
      if (!this.scanner) return; // se salió del paso mientras esperaba
      this.supportEl.classList.remove('error');
      this.supportEl.textContent = 'Apunta la cámara al código QR o de barras.';
      this.scanner.resume();
    }, 1000);
  }

  enterDetectedState(field, text, format) {
    this.supportEl.textContent = '';
    this.supportEl.classList.remove('error');

    this.scannerBody.innerHTML = `
      <div class="scanner-result">
        <div class="scanner-result-badge">${Icons.svg('checkCircle', { size: 22 })}</div>
        <div class="scanner-result-label">Código detectado</div>
        <div class="scanner-result-value"></div>
        ${format ? `<div class="scanner-result-format">${this.formatLabel(format)}</div>` : ''}
      </div>
    `;
    this.scannerBody.querySelector('.scanner-result-value').textContent = text;

    const retryBtn = this.makeButton('Reintentar', {
      icon: 'refresh',
      onClick: () => this.enterScanningState(field),
    });
    const confirmBtn = this.makeButton(this.isLastStep ? 'Agregar Registro' : 'Confirmar', {
      primary: true,
      icon: this.isLastStep ? 'check' : 'arrowRight',
      iconAfter: true,
      onClick: () => {
        this.values[field.id] = text;
        this.stopScanner();
        this.advance();
      },
    });
    this.setActions([retryBtn, confirmBtn]);
  }

  enterManualState(field, note) {
    this.stopScanner();
    this.supportEl.textContent = note || '';
    this.supportEl.classList.toggle('error', !!note);

    this.scannerBody.innerHTML = '';
    const inputWrap = document.createElement('div');
    inputWrap.className = 'step-input-wrap';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step-input';
    input.placeholder = field.placeholder || 'Escribe el código';
    input.value = this.values[field.id] || '';
    inputWrap.appendChild(input);
    this.scannerBody.appendChild(inputWrap);

    this.currentInput = input;
    this.inputWrapEl = inputWrap;
    this.errorTargetEl = inputWrap;

    input.addEventListener('input', () => this.clearError());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmManual(field);
      }
    });

    const cameraBtn = this.makeButton('Usar cámara', {
      icon: 'scan',
      onClick: () => this.enterScanningState(field),
    });
    const nextBtn = this.makeButton(this.isLastStep ? 'Agregar Registro' : 'Continuar', {
      primary: true,
      icon: this.isLastStep ? 'check' : 'arrowRight',
      iconAfter: true,
      onClick: () => this.confirmManual(field),
    });
    this.setActions([cameraBtn, nextBtn]);

    setTimeout(() => input.focus(), 60);
  }

  confirmManual(field) {
    const raw = this.currentInput.value.trim();

    if (field.required && !raw) {
      this.showError('Este campo es obligatorio.');
      return;
    }

    if (!raw) {
      this.values[field.id] = '';
      this.stopScanner();
      this.advance();
      return;
    }

    const parsed = ScanParser.parse(raw, field.idType);
    if (!parsed) {
      const messages = {
        hu: 'Formato inválido. Debe ser el HU (solo dígitos).',
        shipment: 'Formato inválido. Debe ser el Shipment ID (solo dígitos).',
        plate: 'Formato inválido. Debe ser una patente válida.',
      };
      this.showError(messages[field.idType] || 'Formato inválido.');
      return;
    }

    this.values[field.id] = parsed;
    this.stopScanner();
    this.advance();
  }

  formatLabel(format) {
    const labels = {
      qr_code: 'QR',
      ean_13: 'EAN-13',
      ean_8: 'EAN-8',
      upc_a: 'UPC-A',
      upc_e: 'UPC-E',
      code_128: 'Code 128',
      code_39: 'Code 39',
      code_93: 'Code 93',
      codabar: 'Codabar',
      itf: 'ITF',
      data_matrix: 'Data Matrix',
      pdf417: 'PDF417',
      aztec: 'Aztec',
    };
    return labels[format] || format;
  }

  /* ======================================================================
     Selector de lista (destino_picker / doca_picker): el texto solo filtra,
     únicamente se puede avanzar eligiendo una fila de la lista (Sección 3.4).
     ====================================================================== */

  isNum(s) {
    return /^[0-9]+$/.test(String(s).trim());
  }

  getDestinoIndex() {
    return this.catalogIndex || {};
  }

  /**
   * Pantalla genérica de selección: buscador + lista fija de opciones.
   * Tocar una opción la elige y avanza inmediatamente.
   * @param {{options:string[], renderMeta?:(opt:string)=>string, placeholder:string, onPick:(opt:string)=>void}} cfg
   */
  renderPickerStep(field, { options, renderMeta, placeholder, onPick }) {
    this.container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'step-screen';

    screen.appendChild(this.buildProgress());

    const h1 = document.createElement('h1');
    h1.className = 'step-question';
    h1.textContent = field.label;
    screen.appendChild(h1);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'step-input-wrap picker-search';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step-input';
    input.placeholder = placeholder;
    searchWrap.appendChild(input);
    screen.appendChild(searchWrap);

    const list = document.createElement('div');
    list.className = 'picker-list';
    screen.appendChild(list);

    const support = document.createElement('div');
    support.className = 'step-support';
    screen.appendChild(support);

    this.container.appendChild(screen);

    this.currentInput = input;
    this.errorTargetEl = searchWrap;
    this.supportEl = support;

    const renderList = () => {
      const query = input.value.trim().toLowerCase();
      const matches = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;
      list.innerHTML = '';

      if (!options.length) {
        const empty = document.createElement('div');
        empty.className = 'picker-empty';
        empty.textContent = 'No hay opciones disponibles en el catálogo.';
        list.appendChild(empty);
        return;
      }

      if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'picker-empty';
        empty.textContent = 'Sin coincidencias.';
        list.appendChild(empty);
        return;
      }

      matches.slice(0, 200).forEach((opt) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'picker-opt';
        const meta = renderMeta ? `<span class="picker-opt-meta">${renderMeta(opt)}</span>` : '';
        row.innerHTML = `<span>${opt}</span>${meta}`;
        row.addEventListener('click', () => onPick(opt));
        list.appendChild(row);
      });
    };

    input.addEventListener('input', () => {
      this.clearError();
      renderList();
    });
    renderList();

    this.actionsEl = null; // los pasos de selección no usan la barra flotante estándar
    setTimeout(() => input.focus(), 60);
  }

  renderDestinoStep(field) {
    const destinos = Object.keys(this.getDestinoIndex()).sort((a, b) => a.localeCompare(b, 'es'));

    this.renderPickerStep(field, {
      options: destinos,
      placeholder: 'Buscar destino...',
      renderMeta: (destino) => {
        const count = (this.getDestinoIndex()[destino] || []).length;
        return `${count} doca${count === 1 ? '' : 's'}`;
      },
      onPick: (destino) => {
        // Si cambian el destino ya elegido, la doca previa deja de ser válida
        if (this.values.destino && this.values.destino !== destino) {
          delete this.values.doca;
          delete this.values.resultado;
        }
        this.values.destino = destino;
        this.advance();
      },
    });
  }

  renderDocaStep(field) {
    const docas = (this.getDestinoIndex()[this.values.destino] || []).slice().sort((a, b) => {
      const an = this.isNum(a);
      const bn = this.isNum(b);
      if (an && bn) return Number(a) - Number(b);
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return a.localeCompare(b, 'es');
    });

    this.renderPickerStep(field, {
      options: docas,
      placeholder: 'Buscar doca...',
      onPick: (doca) => {
        this.values.doca = doca;
        this.values.resultado = this.isNum(doca) ? 'Sin incidencia' : 'Erroneo';
        this.advance();
      },
    });
  }

  /* ======================================================================
     Campo de opción (choice): lista de botones grandes; un toque elige y
     avanza. Usado para enums (Situación, Área) y preguntas Sí/No.
     ====================================================================== */

  renderChoiceStep(field) {
    this.container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'step-screen';

    screen.appendChild(this.buildProgress());

    const h1 = document.createElement('h1');
    h1.className = 'step-question';
    h1.textContent = field.label;
    screen.appendChild(h1);

    const list = document.createElement('div');
    list.className = 'picker-list choice-list';
    screen.appendChild(list);

    const support = document.createElement('div');
    support.className = 'step-support';
    screen.appendChild(support);

    this.container.appendChild(screen);

    this.currentInput = null;
    this.errorTargetEl = list;
    this.supportEl = support;

    (field.options || []).forEach((option) => {
      const value = typeof option === 'string' ? option : option.value;
      const label = typeof option === 'string' ? option : option.label;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'picker-opt choice-opt';
      if (this.values[field.id] === value) row.classList.add('selected');
      row.innerHTML = `<span>${label}</span>`;
      row.addEventListener('click', () => {
        this.values[field.id] = value;
        // Cambiar una respuesta que controla campos condicionales invalida
        // los valores derivados posteriores para que se recalculen.
        if (field.resetOnChange) field.resetOnChange.forEach((id) => delete this.values[id]);
        this.advance();
      });
      list.appendChild(row);
    });

    // Los pasos de opción no usan la barra flotante estándar (se avanza al tocar).
    this.actionsEl = null;
    if (!field.required) {
      const skipBtn = this.makeButton('Omitir', { onClick: () => this.skip() });
      this.setActions([skipBtn]);
    }
  }

  /* ======================================================================
     Campo de foto: captura con la cámara del dispositivo (o galería), con
     previsualización y opción de retomar. La imagen se comprime en canvas
     (máx 1280px, JPEG 0.6) para minimizar memoria y tamaño del ZIP.
     ====================================================================== */

  renderPhotoStep(field) {
    this.container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'step-screen photo-screen';

    screen.appendChild(this.buildProgress());

    const h1 = document.createElement('h1');
    h1.className = 'step-question';
    h1.textContent = field.label;
    screen.appendChild(h1);

    const body = document.createElement('div');
    body.className = 'photo-body';
    screen.appendChild(body);

    const support = document.createElement('div');
    support.className = 'step-support';
    screen.appendChild(support);

    this.container.appendChild(screen);

    this.photoBody = body;
    this.supportEl = support;
    this.errorTargetEl = body;

    if (this.values[field.id]) {
      this.enterPhotoPreview(field);
    } else {
      this.enterPhotoCapture(field);
    }
  }

  enterPhotoCapture(field, note) {
    this.supportEl.textContent = note || 'Toma una foto con la cámara del dispositivo.';
    this.supportEl.classList.toggle('error', !!note);

    this.photoBody.innerHTML = `
      <button type="button" class="photo-dropzone">
        <span class="photo-dropzone-icon">${Icons.svg('camera', { size: 30 })}</span>
        <span class="photo-dropzone-label">Tomar foto</span>
      </button>
      <input type="file" accept="image/*" capture="environment" class="photo-input" hidden />
      <input type="file" accept="image/*" class="photo-input-gallery" hidden />
    `;

    const dropzone = this.photoBody.querySelector('.photo-dropzone');
    const cameraInput = this.photoBody.querySelector('.photo-input');
    const galleryInput = this.photoBody.querySelector('.photo-input-gallery');

    dropzone.addEventListener('click', () => cameraInput.click());

    const onFile = async (input) => {
      const file = input.files && input.files[0];
      if (!file) return;
      this.supportEl.textContent = 'Procesando imagen...';
      this.supportEl.classList.remove('error');
      try {
        this.values[field.id] = await this.compressImage(file, { maxDim: 1280, quality: 0.6 });
        this.vibrate(30);
        this.enterPhotoPreview(field);
      } catch (e) {
        this.enterPhotoCapture(field, 'No se pudo procesar la imagen. Intenta de nuevo.');
      }
    };
    cameraInput.addEventListener('change', () => onFile(cameraInput));
    galleryInput.addEventListener('change', () => onFile(galleryInput));

    const galleryBtn = this.makeButton('Elegir de galería', {
      icon: 'image',
      onClick: () => galleryInput.click(),
    });
    const buttons = [galleryBtn];
    if (!field.required) {
      buttons.unshift(this.makeButton('Omitir', { onClick: () => this.skip() }));
    }
    this.setActions(buttons);
  }

  enterPhotoPreview(field) {
    this.supportEl.textContent = '';
    this.supportEl.classList.remove('error');

    this.photoBody.innerHTML = `
      <div class="photo-preview">
        <img alt="Foto capturada" />
        <div class="photo-preview-badge">${Icons.svg('checkCircle', { size: 20 })}</div>
      </div>
    `;
    this.photoBody.querySelector('img').src = this.values[field.id];

    const retakeBtn = this.makeButton('Retomar', {
      icon: 'refresh',
      onClick: () => {
        delete this.values[field.id];
        this.enterPhotoCapture(field);
      },
    });
    const nextBtn = this.makeButton(this.isLastStep ? 'Agregar Registro' : 'Continuar', {
      primary: true,
      icon: this.isLastStep ? 'check' : 'arrowRight',
      iconAfter: true,
      onClick: () => this.advance(),
    });
    this.setActions([retakeBtn, nextBtn]);
  }

  /**
   * Comprime/redimensiona una imagen usando canvas y la devuelve como
   * data URL JPEG. Reescala para que el lado largo no exceda maxDim.
   */
  compressImage(file, { maxDim = 1280, quality = 0.6 } = {}) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo cargar la imagen'));
      };
      img.src = url;
    });
  }

  /* ====================================================================== */

  readCurrentValue() {
    return this.currentInput ? this.currentInput.value.trim() : '';
  }

  /**
   * Vibración táctil breve (Vibration API). Silenciosamente ignorada en
   * navegadores sin soporte (ej. iOS Safari) o si el usuario la bloqueó.
   */
  vibrate(pattern) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        /* no-op */
      }
    }
  }

  showError(message) {
    this.vibrate(20);

    if (!this.errorTargetEl) return;
    this.errorTargetEl.classList.add('error');
    this.supportEl.textContent = message;
    this.supportEl.classList.add('error');

    this.errorTargetEl.classList.remove('shake');
    void this.errorTargetEl.offsetWidth; // reinicia la animación
    this.errorTargetEl.classList.add('shake');
  }

  clearError() {
    if (this.errorTargetEl) this.errorTargetEl.classList.remove('error');
    if (this.supportEl) {
      this.supportEl.textContent = '';
      this.supportEl.classList.remove('error');
    }
  }

  next() {
    const field = this.currentField;
    const value = this.readCurrentValue();

    if (field.required && !value) {
      this.showError('Este campo es obligatorio.');
      return;
    }

    // Si cambian el destino ya elegido, la doca previa deja de ser válida
    if (field.id === 'destino' && this.values.destino && this.values.destino !== value) {
      delete this.values.doca;
      delete this.values.resultado;
    }

    this.values[field.id] = value;

    if (field.id === 'doca') {
      this.values.resultado = this.isNum(value) ? 'Sin incidencia' : 'Erroneo';
    }

    this.advance();
  }

  skip() {
    this.values[this.currentField.id] = '';
    this.advance();
  }

  advance({ silent } = {}) {
    if (!silent) this.vibrate(10);
    if (this.isLastStep) {
      this.finish();
    } else {
      this.stepIndex++;
      this.renderStep();
    }
  }

  back() {
    this.stopScanner();
    // Retrocede al paso visible anterior, saltando campos condicionales ocultos.
    let idx = this.stepIndex - 1;
    while (idx >= 0 && this.isFieldHidden(this.formConfig.fields[idx])) idx--;
    if (idx < 0) {
      if (this.onCancel) this.onCancel();
      return;
    }
    this.stepIndex = idx;
    this.renderStep();
  }

  finish() {
    this.stopScanner();
    // Normaliza: cualquier campo no visitado (condicional oculto al final)
    // recibe su valor derivado o cadena vacía.
    this.formConfig.fields.forEach((f) => {
      if (this.values[f.id] === undefined) {
        this.values[f.id] = this.isFieldHidden(f) && f.valueWhenHidden ? f.valueWhenHidden(this.values) : '';
      }
    });
    if (this.onComplete) this.onComplete({ ...this.values });
  }
}
