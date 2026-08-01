# Configuración de Encriptación End-to-End

## Resumen
Los datos del formulario se encriptan automáticamente con **AES-256-GCM** derivando la clave del **email del usuario**. El consolidado los desencripta automáticamente sin pasos adicionales.

## Componentes

### 1. Formulario (formulario_lp_xmt1)
- **crypto-engine.js**: Módulo de encriptación con PBKDF2 + AES-256-GCM
- **app.js**: Obtiene email del usuario y encripta ZIP antes de descargar
- **export-engine.js**: Retorna blob para que app.js lo encripte

**Flujo:**
1. Usuario captura datos
2. Al descargar: se obtiene email de `/api/v1/me`
3. Se encripta ZIP con clave derivada del email
4. Se descarga como `auditorias_encriptadas_[fecha].json`

### 2. Consolidado (consolidado_auditoria_2.html)
- Detecta archivos encriptados
- Obtiene email del usuario actual
- Desencripta automáticamente usando la misma clave
- Procesa datos como si fueran un ZIP normal

**Flujo:**
1. Usuario sube archivo encriptado
2. Se detecta que es JSON encriptado
3. Se obtiene email de `/api/v1/me`
4. Se desencripta con la misma clave derivada
5. Se procesa como ZIP normal

## Instalación en el Consolidado

En el archivo `consolidado_auditoria_2.html`, realizar estos cambios:

### Paso 1: Agregar el módulo de crypto (antes de `</head>`)

Copiar y pegar este bloque después de `<script src="/d/_libs/jszip.min.js"></script>`:

```html
<script>
/**
 * Crypto para Consolidado — Desencriptación automática
 */
class ConsolidadoCrypto {
  constructor() {
    this.algorithm = {
      name: 'AES-GCM',
      length: 256,
    };
  }

  async deriveKeyFromEmail(email) {
    const encoder = new TextEncoder();
    const emailBytes = encoder.encode(email);
    const salt = emailBytes;

    const material = await crypto.subtle.importKey(
      'raw',
      emailBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

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
      throw new Error('No se pudo desencriptar: ' + e.message);
    }
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

const ConsolidadoCrypto_instance = new ConsolidadoCrypto();
</script>
```

### Paso 2: Modificar handleFile() en AuditDashboard

Buscar el método `async handleFile(file)` y reemplazarlo con:

```javascript
async handleFile(file) {
  // Detectar si es archivo encriptado
  if (file.name.endsWith('.json') && file.type === 'application/json') {
    try {
      this.showAlert('uploadAlert', 'info', 'Detectado archivo encriptado. Desencriptando...');
      
      const me = await this.gridClient.getMe();
      if (!me || !me.email) {
        this.showAlert('uploadAlert', 'error', 'No se pudo obtener el email del usuario');
        return;
      }

      const decryptedBlob = await ConsolidadoCrypto_instance.decryptBlob(file, me.email);
      // Procesar como ZIP normal
      await this.handleZipFile(decryptedBlob);
    } catch (e) {
      console.error('Error al desencriptar:', e);
      this.showAlert('uploadAlert', 'error', `Error al desencriptar: ${e.message}`);
    }
  } else if (file.name.endsWith('.zip')) {
    await this.handleZipFile(file);
  } else if (file.name.endsWith('.csv')) {
    await this.handleCsvFile(file);
  } else {
    this.showAlert('uploadAlert', 'error', 'Formato no soportado. Usa CSV, ZIP o JSON encriptado.');
  }
}
```

## Seguridad

- **Clave derivada del email**: Cada usuario tiene su propia clave
- **PBKDF2**: 100,000 iteraciones, SHA-256
- **AES-256-GCM**: Encriptación simétrica con autenticación
- **IV aleatorio**: Diferente para cada encriptación
- **Validación**: Se verifica que email en metadata coincida con usuario actual

## Prueba

1. **En el formulario:**
   - Capturar datos
   - Descargar → descarga `auditorias_encriptadas_[fecha].json`

2. **En el consolidado:**
   - Subirarchivo encriptado
   - Automáticamente se desencripta y procesa

## Notas

- Solo funciona con usuarios autenticados en ambos lados
- La clave se deriva del email cada vez (sin almacenamiento)
- Compatible con navegadores modernos (Chrome, Firefox, Safari, Edge)
- Los datos desencriptados nunca se guardan en disco sin encriptar
