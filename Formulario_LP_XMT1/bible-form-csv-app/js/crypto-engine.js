/**
 * Crypto Engine — Encripción AES-256-GCM derivada del email del usuario
 * Derivación de clave: PBKDF2(email, salt=email, 100k iteraciones, SHA-256)
 */

class CryptoEngine {
  constructor() {
    this.algorithm = {
      name: 'AES-GCM',
      length: 256,
    };
    this.pbkdfAlgorithm = {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: null, // se establece con el email
      iterations: 100000,
    };
  }

  /**
   * Derivar clave PBKDF2 del email
   */
  async deriveKeyFromEmail(email) {
    const encoder = new TextEncoder();
    const emailBytes = encoder.encode(email);

    // Usar email como salt
    const salt = emailBytes;

    // Importar email como key material
    const material = await crypto.subtle.importKey(
      'raw',
      emailBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derivar clave AES-256
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Encriptar un blob (ZIP) con la clave derivada del email
   * Retorna { encryptedData, iv } como arraybuffer + iv
   */
  async encryptBlob(blob, email) {
    const key = await this.deriveKeyFromEmail(email);
    const data = await blob.arrayBuffer();

    // Generar IV aleatorio (12 bytes para GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encriptar
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return { encryptedData, iv };
  }

  /**
   * Crear un blob encriptado con metadata
   * Formato: JSON { version, email, iv (base64), data (base64) }
   */
  async createEncryptedBlob(sourceBlob, email) {
    const { encryptedData, iv } = await this.encryptBlob(sourceBlob, email);

    // Codificar a base64 para almacenar en JSON
    const ivBase64 = this.arrayBufferToBase64(iv);
    const dataBase64 = this.arrayBufferToBase64(encryptedData);

    const metadata = {
      version: 1,
      email, // Para validar en desencriptación
      iv: ivBase64,
      data: dataBase64,
      timestamp: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(metadata);
    return new Blob([jsonStr], { type: 'application/json' });
  }

  /**
   * Desencriptar blob con metadata
   */
  async decryptBlob(encryptedBlob, email) {
    const jsonStr = await encryptedBlob.text();
    const metadata = JSON.parse(jsonStr);

    if (metadata.version !== 1) {
      throw new Error('Versión de encriptación no soportada');
    }

    if (metadata.email !== email) {
      throw new Error('Archivo encriptado con otro usuario');
    }

    const key = await this.deriveKeyFromEmail(email);
    const iv = this.base64ToArrayBuffer(metadata.iv);
    const encryptedData = this.base64ToArrayBuffer(metadata.data);

    try {
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );

      return new Blob([decryptedData], { type: 'application/zip' });
    } catch (e) {
      throw new Error('No se pudo desencriptar: clave o datos inválidos');
    }
  }

  /**
   * Helpers: conversión base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

const CryptoEngine_instance = new CryptoEngine();
