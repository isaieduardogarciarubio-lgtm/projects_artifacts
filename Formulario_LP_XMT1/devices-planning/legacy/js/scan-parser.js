/**
 * Parseo y validación de códigos escaneados (HU / Shipment ID / Patente)
 *
 * El escáner del almacén a veces entrega el identificador limpio como texto
 * plano, y otras veces lo envuelve en un JSON con metadata, por ejemplo:
 *   HU:        {"id":"e281a6b1-...-f2c726243f44","legacy_id":"2420997802886101","t":"hu"}
 *   Shipment:  {"id":"47326091753","t":"lm"}
 * El identificador operativo siempre es una cadena numérica. Si el JSON trae
 * "legacy_id" se trata de un HU (el "id" ahí es un UUID interno, no el
 * identificador de negocio); si el JSON solo trae "id" (sin legacy_id) se
 * trata de un Shipment. Cada campo del formulario declara qué tipo espera
 * (idType: 'hu' | 'shipment' | 'plate') y se rechaza cualquier código que no
 * coincida, incluso si el formato numérico es válido.
 *
 * Las patentes (placas vehiculares) no siguen el formato HU/Shipment: son
 * alfanuméricas y se validan con un patrón distinto.
 */
const ScanParser = (() => {
  const ID_PATTERN = /^[0-9]{6,20}$/;
  const PLATE_PATTERN = /^[A-Za-z0-9-]{5,12}$/;

  /**
   * Extrae el identificador crudo del texto escaneado, sea JSON o texto plano.
   * Devuelve { value, kind } donde kind es 'hu', 'shipment' o null (cuando el
   * texto es plano y no trae metadata que indique el tipo).
   * Devuelve null si el JSON es válido pero no trae ni legacy_id ni id.
   */
  function extract(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    if (text[0] === '{') {
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === 'object') {
          if (obj.legacy_id != null) return { value: String(obj.legacy_id).trim(), kind: 'hu' };
          if (obj.id != null) return { value: String(obj.id).trim(), kind: 'shipment' };
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    return { value: text, kind: null };
  }

  /**
   * Extrae y valida el identificador según el tipo esperado por el campo.
   * @param {string} raw - texto escaneado o escrito manualmente
   * @param {string} [expectedType] - 'hu' | 'shipment' | 'plate'
   * Devuelve el valor limpio o null si el código no tiene el formato
   * esperado, o si el JSON identifica explícitamente un tipo distinto al
   * esperado (p. ej. un Shipment escaneado en un campo de HU).
   */
  function parse(raw, expectedType) {
    const extracted = extract(raw);
    if (extracted == null) return null;
    const { value, kind } = extracted;

    if (expectedType === 'plate') {
      return PLATE_PATTERN.test(value) ? value.toUpperCase() : null;
    }

    if (!ID_PATTERN.test(value)) return null;
    if (expectedType && kind && kind !== expectedType) return null;
    return value;
  }

  return { parse, extract, ID_PATTERN, PLATE_PATTERN };
})();
