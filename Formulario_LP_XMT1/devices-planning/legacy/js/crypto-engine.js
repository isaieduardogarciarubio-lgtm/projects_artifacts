/**
 * Motor de encriptación — AES-256-GCM con passphrase compartido.
 * Protege el CSV mientras viaja fuera de Grid (correo/Slack/USB) antes de
 * subirse al dashboard de consolidado. El passphrase se pide una sola vez
 * por dispositivo/navegador (localStorage, no sessionStorage) — pedirla en
 * cada pestaña resultaba muy confuso para el operador en el uso diario.
 * Sigue siendo un secreto real (nunca vive en el código, a diferencia de
 * una clave fija), solo que ahora persiste entre sesiones en el mismo
 * dispositivo en vez de pedirse cada vez.
 */
class CryptoEngine {
  static SESSION_KEY = 'audit_passphrase';

  static async deriveKey(passphrase, saltBytes) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 100000 },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static toBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  static fromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /**
   * Encripta texto plano y retorna un JSON string con la estructura
   * { v, salt, iv, data, ts }. El salt y el iv son aleatorios por archivo
   * y no son secretos — solo el passphrase lo es.
   */
  static async encryptText(text, passphrase, kind = 'csv') {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(passphrase, salt);
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));

    return JSON.stringify({
      v: 1,
      kind, // 'csv' (texto plano) o 'zip' (base64 de un blob binario)
      salt: this.toBase64(salt),
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(ciphertext)),
      ts: new Date().toISOString(),
    });
  }

  /**
   * Desencripta un JSON string generado por encryptText(). Lanza error si
   * el passphrase es incorrecto (AES-GCM falla la verificación de la
   * etiqueta de autenticación) o si el archivo está corrupto.
   */
  static async decryptText(jsonText, passphrase) {
    const payload = JSON.parse(jsonText);
    if (payload.v !== 1) throw new Error('Versión de encriptación no soportada');

    const salt = this.fromBase64(payload.salt);
    const iv = this.fromBase64(payload.iv);
    const data = this.fromBase64(payload.data);
    const key = await this.deriveKey(passphrase, salt);

    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plainBuffer);
  }

  /**
   * Encripta un Blob binario (ej. un ZIP) codificándolo a base64 y
   * reutilizando encryptText(). Retorna el mismo JSON string de siempre.
   */
  static async encryptBlob(blob, passphrase) {
    const buffer = await blob.arrayBuffer();
    const base64Content = this.toBase64(new Uint8Array(buffer));
    return this.encryptText(base64Content, passphrase, 'zip');
  }

  static getSessionPassphrase() {
    return localStorage.getItem(this.SESSION_KEY) || null;
  }

  static setSessionPassphrase(passphrase) {
    localStorage.setItem(this.SESSION_KEY, passphrase);
  }

  static clearSessionPassphrase() {
    localStorage.removeItem(this.SESSION_KEY);
  }
}

/**
 * Gate de UI: pide el passphrase una sola vez por dispositivo y lo cachea
 * en localStorage. Se usa antes de cada exportación encriptada.
 */
class CryptoGate {
  static ensurePassphrase() {
    const existing = CryptoEngine.getSessionPassphrase();
    if (existing) return Promise.resolve(existing);
    return this.promptPassphrase();
  }

  static promptPassphrase() {
    return new Promise((resolve, reject) => {
      const currentPassphrase = CryptoEngine.getSessionPassphrase();
      const overlay = document.createElement('div');
      overlay.className = 'passphrase-modal-overlay';

      // Ícono de ojo (SVG) reutilizado tanto para el campo de contraseña
      // guardada como para el campo de contraseña nueva.
      const eyeIconsSvg = `
        <svg class="icon-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg class="icon-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;

      const currentSection = currentPassphrase ? `
        <div class="passphrase-current-label">Contraseña guardada actualmente:</div>
        <div class="passphrase-field-wrap">
          <input type="password" id="current-passphrase" readonly />
          <button type="button" class="passphrase-eye-btn" id="current-toggle" title="Mostrar contraseña">
            ${eyeIconsSvg}
          </button>
        </div>
      ` : '';

      overlay.innerHTML = `
        <div class="passphrase-modal-card">
          <h3>Contraseña de encriptación</h3>
          <p>Ingresa la contraseña compartida para proteger tus archivos mientras viajan fuera de Grid. Solo se pide una vez en este dispositivo. Pregúntale a un administrador si no la tienes.</p>
          <p style="font-size: 0.82rem; color: var(--color-error); margin-top: -8px;">
            Verifica que sea la contraseña vigente. Si escribes una distinta a la configurada por tu admin, el archivo se generará sin error, pero <strong>no podrá desencriptarse</strong> después en el dashboard.
          </p>
          ${currentSection}
          <div class="passphrase-field-wrap">
            <input type="password" id="passphrase-input" placeholder="Ingresa la contraseña ${currentPassphrase ? 'nueva' : ''}" autocomplete="off" />
            <button type="button" class="passphrase-eye-btn" id="passphrase-toggle" title="Mostrar contraseña">
              ${eyeIconsSvg}
            </button>
          </div>
          <div class="passphrase-modal-actions">
            <button type="button" class="btn btn-secondary" id="passphrase-cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" id="passphrase-confirm">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const wireToggle = (inputEl, btnEl) => {
        btnEl.addEventListener('click', (e) => {
          e.preventDefault();
          const isPassword = inputEl.type === 'password';
          inputEl.type = isPassword ? 'text' : 'password';
          btnEl.classList.toggle('is-visible', isPassword);
          btnEl.title = isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
        });
      };

      if (currentPassphrase) {
        const currentInput = overlay.querySelector('#current-passphrase');
        const currentToggleBtn = overlay.querySelector('#current-toggle');
        currentInput.value = currentPassphrase;
        wireToggle(currentInput, currentToggleBtn);
      }

      const input = overlay.querySelector('#passphrase-input');
      const toggleBtn = overlay.querySelector('#passphrase-toggle');
      wireToggle(input, toggleBtn);
      input.focus();

      const cleanup = () => overlay.remove();

      overlay.querySelector('#passphrase-confirm').addEventListener('click', () => {
        const value = input.value.trim();
        if (!value) return;
        CryptoEngine.setSessionPassphrase(value);
        cleanup();
        resolve(value);
      });

      overlay.querySelector('#passphrase-cancel').addEventListener('click', () => {
        cleanup();
        reject(new Error('Operación cancelada'));
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#passphrase-confirm').click();
      });
    });
  }
}
