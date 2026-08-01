/**
 * Configuración de formularios
 * Cada formulario define sus campos y las columnas del CSV resultante
 */

const FORMS_CONFIG = {
  destino_doca: {
    id: 'destino_doca',
    title: 'Pre - Missort',
    description: 'Escanea HU, valida destino y doca',
    icon: 'scan',
    // Catálogo Destino → Docas válidas. Edita este archivo con los destinos
    // y docas reales de tu operación (columna Doca: valores separados por ";").
    catalogUrl: 'data/catalogo_destino_doca.csv',
    fields: [
      {
        id: 'hu',
        label: '¿Cuál es el HU?',
        type: 'scanner',
        idType: 'hu',
        required: true,
        placeholder: 'Ej. 2420997802886101',
      },
      {
        id: 'destino',
        label: '¿Cuál es el destino?',
        type: 'destino_picker',
        required: true,
      },
      {
        id: 'doca',
        label: '¿Cuál es la doca?',
        type: 'doca_picker',
        required: true,
      },
    ],
    csvColumns: [
      { field: 'ts', header: 'Fecha/Hora' },
      { field: 'hu', header: 'HU' },
      { field: 'destino', header: 'Destino' },
      { field: 'doca', header: 'Doca' },
      { field: 'resultado', header: 'Resultado' },
    ],
  },

  fury: {
    id: 'fury',
    title: 'FURY',
    description: 'Escanea shipment, foto y situación',
    icon: 'redCross',
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
        id: 'foto',
        label: 'Toma una foto del paquete',
        type: 'photo',
        required: true,
      },
      {
        id: 'situacion',
        label: '¿Cuál es la situación?',
        type: 'choice',
        required: true,
        options: ['Sin Master', 'Dañado', 'Abierto'],
      },
      {
        id: 'valor',
        label: 'Valor en USD (opcional)',
        type: 'number',
        required: false,
        placeholder: 'Ej. 120',
        min: 0,
      },
    ],
    csvColumns: [
      { field: 'ts', header: 'Fecha/Hora' },
      { field: 'shipment', header: 'Shipment ID' },
      { field: 'foto', header: 'Foto', type: 'photo' },
      { field: 'situacion', header: 'Situación' },
      { field: 'valor', header: 'USD Valor' },
    ],
  },

  contenerizado: {
    id: 'contenerizado',
    title: 'Contenerizado',
    description: 'Escanea shipment y situación (foto si hay daño)',
    icon: 'inbox',
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
        id: 'situacion',
        label: '¿Cuál es la situación?',
        type: 'choice',
        required: true,
        options: ['Missort', 'Dañado', 'Correcto'],
        // Si cambian la situación, la foto previa deja de ser válida
        resetOnChange: ['foto'],
      },
      {
        id: 'foto',
        label: 'Toma una foto del daño',
        type: 'photo',
        required: true,
        // Solo se pide foto cuando la situación es "Dañado"
        showIf: (v) => v.situacion === 'Dañado',
      },
    ],
    csvColumns: [
      { field: 'ts', header: 'Fecha/Hora' },
      { field: 'shipment', header: 'Shipment ID' },
      { field: 'situacion', header: 'Situación' },
      { field: 'foto', header: 'Foto', type: 'photo' },
    ],
  },

  linehaul: {
    id: 'linehaul',
    title: 'Posible daño Linehaul / Despacho',
    description: 'Escanea HU, área, origen y canalización',
    icon: 'pallet',
    fields: [
      {
        id: 'hu',
        label: '¿Cuál es el HU?',
        type: 'scanner',
        idType: 'hu',
        required: true,
        placeholder: 'Ej. 2420997802886101',
      },
      {
        id: 'area',
        label: '¿Cuál es el área?',
        type: 'choice',
        required: true,
        options: ['Despacho', 'Inbound LH', 'Sorting Large', 'Otro'],
      },
      {
        id: 'armado_sitio',
        label: '¿Se armó en tu sitio?',
        type: 'choice',
        required: true,
        options: ['Sí', 'No'],
        // Cambiar esta respuesta recalcula el origen derivado
        resetOnChange: ['origen'],
      },
      {
        id: 'origen',
        label: '¿Cuál es el origen?',
        type: 'text',
        required: true,
        placeholder: 'Escribe el origen',
        // Solo se escribe manualmente cuando NO se armó en el sitio;
        // si se armó en el sitio, el origen es "XMT1" automáticamente.
        showIf: (v) => v.armado_sitio === 'No',
        valueWhenHidden: () => 'XMT1',
      },
      {
        id: 'canalizacion',
        label: '¿Cuál es la canalización?',
        type: 'text',
        required: true,
        placeholder: 'Escribe la canalización',
      },
      {
        id: 'foto',
        label: 'Foto (opcional)',
        type: 'photo',
        required: false,
      },
      {
        id: 'comentarios',
        label: 'Comentarios (opcional)',
        type: 'textarea',
        required: false,
        placeholder: 'Notas adicionales',
      },
    ],
    csvColumns: [
      { field: 'ts', header: 'Fecha/Hora' },
      { field: 'hu', header: 'HU' },
      { field: 'area', header: 'Área' },
      { field: 'origen', header: 'Origen' },
      { field: 'canalizacion', header: 'Canalización' },
      { field: 'foto', header: 'Foto', type: 'photo' },
      { field: 'comentarios', header: 'Comentarios' },
    ],
  },

  inbound_fm: {
    id: 'inbound_fm',
    title: 'Inbound FM',
    description: 'Escanea patente, diferencia y hallazgo',
    icon: 'truck',
    fields: [
      {
        id: 'patente',
        label: '¿Cuál es la patente?',
        type: 'scanner',
        idType: 'plate',
        required: true,
        placeholder: 'Ej. ABC-123',
      },
      {
        id: 'diferencia_shipments',
        label: '¿Cuál es la diferencia de shipments?',
        type: 'text',
        required: true,
        placeholder: 'Ingresa la diferencia',
      },
      {
        id: 'hallazgo',
        label: '¿Cuál es el hallazgo?',
        type: 'choice',
        required: true,
        options: ['Correcto', 'Divergencia', 'Falta de probidad'],
      },
      {
        id: 'evidencia',
        label: 'Evidencia (opcional)',
        type: 'photo',
        required: false,
      },
    ],
    csvColumns: [
      { field: 'ts', header: 'Fecha/Hora' },
      { field: 'patente', header: 'Patente' },
      { field: 'diferencia_shipments', header: 'Diferencia de Shipments' },
      { field: 'hallazgo', header: 'Hallazgo' },
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
