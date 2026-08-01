/**
 * Configuración de formularios (logs)
 * Cada formulario define sus campos y las columnas del CSV resultante.
 */

const FORMS_CONFIG = {
  contenedor: {
    id: 'contenedor',
    title: 'Validación de Contenedor',
    description: 'Escanea shipment y compara contra el catálogo de estatus',
    icon: 'inbox',
    // Requiere que el operador haya cargado el catálogo de estatus (ID,
    // ESTATUS, OPTIMIZADA) desde el menú antes de poder auditar. A
    // diferencia de catalogUrl (fetch a un CSV estático del repo), este
    // catálogo se carga a mano desde un archivo cifrado — ver
    // FormApp.statusCatalogIndex en app.js.
    requiresStatusCatalog: true,
    fields: [
      {
        id: 'shipment',
        label: '¿Cuál es el Shipment ID?',
        type: 'scanner',
        idType: 'shipment',
        required: true,
        placeholder: 'Ej. 47326091753',
      },
      {
        id: 'resultado_lookup',
        label: 'Resultado de la comparación',
        type: 'estatus_lookup',
        sourceField: 'shipment',
        required: true,
      },
      {
        id: 'evidencia',
        label: 'Toma una foto de evidencia',
        type: 'photo',
        required: true,
        // Solo se pide evidencia cuando el shipment NO está en contenedor
        showIf: (v) => v.resultado === 'No en contenedor',
      },
    ],
    csvColumns: [
      { field: 'ts', header: 'Fecha/Hora' },
      { field: 'shipment', header: 'Shipment ID' },
      { field: 'estatus', header: 'Estatus' },
      { field: 'optimizada', header: 'Optimizada' },
      { field: 'resultado', header: 'Resultado' },
      { field: 'evidencia', header: 'Evidencia', type: 'photo' },
    ],
  },
};

/**
 * Obtener todas las formas disponibles
 */
function getAllForms() {
  return Object.values(FORMS_CONFIG);
}

/**
 * Obtener una forma por su ID
 */
function getFormConfig(formId) {
  return FORMS_CONFIG[formId];
}
