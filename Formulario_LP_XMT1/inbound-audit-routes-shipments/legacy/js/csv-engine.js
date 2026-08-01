/**
 * Motor de generación de CSV
 * Genera CSV válido con escape de caracteres especiales, BOM UTF-8 y descarga real
 */

class CSVEngine {
  /**
   * Escapa un valor CSV: si contiene coma, comilla o salto de línea, lo encierra en comillas
   * y duplica las comillas internas
   */
  static escapeCsvValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // Si contiene coma, comilla o salto de línea, escapar
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }

    return stringValue;
  }

  /**
   * Genera un CSV a partir de un array de registros y un config de formulario
   * Retorna string con BOM UTF-8 incluido
   */
  static generateCSV(records, formConfig) {
    if (!formConfig || !formConfig.csvColumns) {
      throw new Error('Configuración de formulario inválida');
    }

    if (!records || records.length === 0) {
      throw new Error('No hay registros para exportar');
    }

    // Línea de encabezados
    const headers = formConfig.csvColumns.map((col) => this.escapeCsvValue(col.header));
    const headerLine = headers.join(',');

    // Líneas de datos
    const dataLines = records.map((record) => {
      return formConfig.csvColumns
        .map((col) => this.escapeCsvValue(record[col.field] || ''))
        .join(',');
    });

    // Combina todo
    const csvContent = [headerLine, ...dataLines].join('\n');

    // BOM UTF-8 (permite que Excel/Calc interprete correctamente acentos)
    const bom = '﻿';
    const csvWithBom = bom + csvContent;

    return csvWithBom;
  }

  /**
   * Parsea texto CSV (soporta comillas, comas y saltos de línea dentro de campos).
   * Ignora el BOM UTF-8 si está presente. Retorna { headers, records }.
   */
  static parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // ignorar, el \n siguiente cierra la fila
      } else {
        field += c;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    const nonEmpty = rows.filter((r) => r.some((cell) => String(cell).trim().length));
    if (!nonEmpty.length) return { headers: [], records: [] };

    const headers = nonEmpty[0].map((h) => String(h).trim());
    const records = nonEmpty.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = String(r[idx] != null ? r[idx] : '').trim();
      });
      return obj;
    });

    return { headers, records };
  }

  /**
   * Descarga un CSV al navegador
   * @param {string} csvContent - Contenido del CSV (incluyendo BOM)
   * @param {string} filename - Nombre del archivo (sin extensión .csv)
   */
  static downloadCSV(csvContent, filename) {
    // Crear blob con encoding UTF-8
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    // Crear URL descargable
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';

    // Agregar al DOM, hacer click, y limpiar
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Liberar la URL
    URL.revokeObjectURL(url);
  }

  /**
   * Genera nombre de archivo con timestamp
   */
  static generateFilename(formId, formTitle) {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitized = formTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${sanitized}_${timestamp}`;
  }

  /**
   * Exporta registros a CSV y descarga
   */
  static exportAndDownload(records, formConfig) {
    try {
      const csvContent = this.generateCSV(records, formConfig);
      const filename = this.generateFilename(formConfig.id, formConfig.title);
      this.downloadCSV(csvContent, filename);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Descarga el contenido encriptado (JSON por dentro) con extensión .csv
   * — Grid no acepta subir archivos .json, así que el archivo debe seguir
   * pareciendo un CSV normal aunque el contenido esté encriptado.
   */
  static downloadEncryptedCSV(jsonContent, filename) {
    const blob = new Blob([jsonContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Exporta registros a CSV, lo encripta con el passphrase de sesión
   * (pide la contraseña una sola vez por pestaña) y descarga el resultado
   * con extensión .csv (contenido interno: JSON encriptado). El dashboard
   * de consolidado detecta que está encriptado leyendo el contenido, no
   * la extensión, y lo desencripta automáticamente al cargarlo.
   */
  static async exportAndDownloadEncrypted(records, formConfig) {
    try {
      const csvContent = this.generateCSV(records, formConfig);
      const passphrase = await CryptoGate.ensurePassphrase();
      const encrypted = await CryptoEngine.encryptText(csvContent, passphrase);
      const filename = this.generateFilename(formConfig.id, formConfig.title);
      this.downloadEncryptedCSV(encrypted, filename);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
