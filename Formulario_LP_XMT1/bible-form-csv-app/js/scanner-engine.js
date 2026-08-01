/**
 * Motor de escaneo QR / código de barras
 * Prefiere la API nativa BarcodeDetector (Android/Chrome, sin dependencias);
 * cae a ZXing (vendorizado) para navegadores sin soporte (iOS Safari).
 *
 * Uso:
 *   const scanner = new ScannerEngine();
 *   await scanner.start(videoEl, (text, format) => { ... });
 *   scanner.stop();
 */

class ScannerEngine {
  constructor(opts = {}) {
    // Formatos soportados: QR + principales 1D
    this.formats = opts.formats || [
      'qr_code',
      'ean_13',
      'ean_8',
      'upc_a',
      'upc_e',
      'code_128',
      'code_39',
      'code_93',
      'codabar',
      'itf',
      'data_matrix',
      'pdf417',
      'aztec',
    ];
    this.stream = null;
    this.videoEl = null;
    this.rafId = null;
    this.running = false;
    this.engine = null; // 'native' | 'zxing'
    this.detector = null;
    this.zxingReader = null;
    this.track = null;
  }

  static isSupported() {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia
    );
  }

  /**
   * Arranca la cámara y el bucle de detección.
   * @param {HTMLVideoElement} videoEl
   * @param {(text: string, format: string) => void} onDetect
   */
  async start(videoEl, onDetect) {
    this.videoEl = videoEl;
    this.onDetect = onDetect;

    // Cámara trasera preferida
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });

    this.track = this.stream.getVideoTracks()[0];

    videoEl.srcObject = this.stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;
    await videoEl.play().catch(() => {});

    this.running = true;

    if ('BarcodeDetector' in window) {
      await this.startNative();
    } else if (window.ZXing) {
      await this.startZxing();
    } else {
      throw new Error('No hay motor de escaneo disponible');
    }
  }

  async startNative() {
    this.engine = 'native';
    let supported = [];
    try {
      supported = await window.BarcodeDetector.getSupportedFormats();
    } catch (e) {
      supported = [];
    }
    const formats = this.formats.filter((f) => supported.includes(f));
    this.detector = new window.BarcodeDetector(
      formats.length ? { formats } : undefined
    );

    const scan = async () => {
      if (!this.running) return;
      try {
        const codes = await this.detector.detect(this.videoEl);
        if (codes && codes.length) {
          this.handleResult(codes[0].rawValue, codes[0].format);
          return; // el consumidor decide si seguir (llamará resume())
        }
      } catch (e) {
        /* frames intermitentes pueden fallar; se ignora */
      }
      this.rafId = requestAnimationFrame(scan);
    };
    this.rafId = requestAnimationFrame(scan);
  }

  async startZxing() {
    this.engine = 'zxing';
    this.zxingReader = new window.ZXing.BrowserMultiFormatReader();
    // decodeContinuously usa el <video> ya alimentado por nuestro stream
    this.zxingReader.decodeFromStream(this.stream, this.videoEl, (result, err) => {
      if (!this.running) return;
      if (result) {
        this.handleResult(result.getText(), this.mapZxingFormat(result.getBarcodeFormat()));
      }
    });
  }

  mapZxingFormat(fmt) {
    const F = window.ZXing.BarcodeFormat;
    const names = {
      [F.QR_CODE]: 'qr_code',
      [F.EAN_13]: 'ean_13',
      [F.EAN_8]: 'ean_8',
      [F.UPC_A]: 'upc_a',
      [F.UPC_E]: 'upc_e',
      [F.CODE_128]: 'code_128',
      [F.CODE_39]: 'code_39',
      [F.CODE_93]: 'code_93',
      [F.CODABAR]: 'codabar',
      [F.ITF]: 'itf',
      [F.DATA_MATRIX]: 'data_matrix',
      [F.PDF_417]: 'pdf417',
      [F.AZTEC]: 'aztec',
    };
    return names[fmt] || 'unknown';
  }

  handleResult(text, format) {
    if (!text) return;
    if (this.onDetect) this.onDetect(text, format);
  }

  /**
   * Pausa el bucle nativo (para el patrón "detectar → confirmar").
   * En ZXing el callback sigue activo pero podemos ignorarlo con this.paused.
   */
  pause() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
  }

  /**
   * Reanuda el escaneo tras una pausa (motor nativo).
   */
  resume() {
    if (this.running) return;
    this.running = true;
    if (this.engine === 'native') {
      this.startNative();
    }
  }

  /**
   * ¿La cámara soporta linterna?
   */
  hasTorch() {
    if (!this.track || !this.track.getCapabilities) return false;
    const caps = this.track.getCapabilities();
    return !!caps.torch;
  }

  async setTorch(on) {
    if (!this.hasTorch()) return false;
    try {
      await this.track.applyConstraints({ advanced: [{ torch: !!on }] });
      return true;
    } catch (e) {
      return false;
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.zxingReader) {
      try {
        this.zxingReader.reset();
      } catch (e) {}
      this.zxingReader = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.track = null;
  }
}
