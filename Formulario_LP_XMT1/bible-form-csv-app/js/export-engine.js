/**
 * Motor de exportación con fotos (ZIP)
 *
 * Los logs que capturan fotos no caben en un CSV plano: se empaquetan en un
 * ZIP que contiene el CSV + una carpeta `fotos/`. En el CSV, la columna de
 * foto referencia el nombre del archivo dentro de `fotos/`. Las imágenes ya
 * vienen comprimidas como JPEG desde la captura (el motor de formularios las
 * reescala), así que el ZIP usa DEFLATE nivel 9 (ayuda sobre todo al CSV).
 *
 * Depende de JSZip (window.JSZip, vendorizado) y de CSVEngine.
 */

class ExportEngine {
  /** ¿El formulario captura fotos? (tiene alguna columna de tipo 'photo') */
  static formHasPhotos(formConfig) {
    return (formConfig.csvColumns || []).some((c) => c.type === 'photo');
  }

  /** Sanea un texto para usarlo como nombre de archivo/carpeta */
  static sanitize(value) {
    return String(value || '')
      .trim()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'sin_id';
  }

  /**
   * Nombre de archivo de una foto: índice + un identificador legible del
   * registro (shipment / HU) para poder ubicarla fácilmente.
   */
  static photoFilename(record, index, formConfig, col, multiplePhotoCols) {
    // La segunda columna suele ser el id escaneado (shipment / HU)
    const idCol = (formConfig.csvColumns || [])[1];
    const idVal = idCol ? record[idCol.field] : '';
    const seq = String(index + 1).padStart(3, '0');
    const suffix = multiplePhotoCols ? `_${this.sanitize(col.field)}` : '';
    return `${seq}_${this.sanitize(idVal)}${suffix}.jpg`;
  }

  /** Extrae la parte base64 de un data URL (`data:image/jpeg;base64,...`) */
  static dataUrlToBase64(dataUrl) {
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }

  /**
   * Agrega el CSV y las fotos de un log a un ZIP (opcionalmente dentro de una
   * subcarpeta). Devuelve el número de fotos agregadas.
   */
  static addLogToZip(zip, records, formConfig, folder = '') {
    const photoCols = (formConfig.csvColumns || []).filter((c) => c.type === 'photo');
    const multiple = photoCols.length > 1;
    let photoCount = 0;

    // Copia de los registros donde las columnas de foto muestran la ruta del
    // archivo (o vacío si no hay foto), en vez del data URL completo.
    const csvRecords = records.map((record, index) => {
      const copy = { ...record };
      photoCols.forEach((col) => {
        const dataUrl = record[col.field];
        if (dataUrl && String(dataUrl).startsWith('data:')) {
          const filename = this.photoFilename(record, index, formConfig, col, multiple);
          zip.file(`${folder}fotos/${filename}`, this.dataUrlToBase64(dataUrl), { base64: true });
          copy[col.field] = `fotos/${filename}`;
          photoCount++;
        } else {
          copy[col.field] = '';
        }
      });
      return copy;
    });

    const csv = CSVEngine.generateCSV(csvRecords, formConfig);
    const csvName = `${CSVEngine.generateFilename(formConfig.id, formConfig.title)}.csv`;
    zip.file(`${folder}${csvName}`, csv);

    return photoCount;
  }

  static async generateBlob(zip) {
    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
  }

  static downloadBlob(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /** Exporta y descarga un solo log como ZIP (CSV + fotos/). */
  static async exportLogZip(records, formConfig) {
    if (typeof JSZip === 'undefined') {
      return { success: false, error: 'No se pudo cargar el compresor (JSZip).' };
    }
    if (!records || !records.length) {
      return { success: false, error: 'No hay registros para exportar' };
    }
    try {
      const zip = new JSZip();
      this.addLogToZip(zip, records, formConfig, '');
      const blob = await this.generateBlob(zip);
      this.downloadBlob(blob, `${CSVEngine.generateFilename(formConfig.id, formConfig.title)}.zip`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Exporta y descarga un ZIP maestro con una subcarpeta por log. Cada log con
   * fotos incluye su carpeta `fotos/`; los logs sin fotos solo llevan su CSV.
   * @param {{records:object[], formConfig:object}[]} entries
   */
  static async exportAllZip(entries) {
    if (typeof JSZip === 'undefined') {
      return { success: false, error: 'No se pudo cargar el compresor (JSZip).' };
    }
    if (!entries || !entries.length) {
      return { success: false, error: 'No hay registros para exportar' };
    }
    try {
      const zip = new JSZip();
      entries.forEach(({ records, formConfig }) => {
        if (!records || !records.length) return;
        const folder = `${this.sanitize(formConfig.title)}/`;
        this.addLogToZip(zip, records, formConfig, folder);
      });
      const blob = await this.generateBlob(zip);
      return { success: true, blob };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
