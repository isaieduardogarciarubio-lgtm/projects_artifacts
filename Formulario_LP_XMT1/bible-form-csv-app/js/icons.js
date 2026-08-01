/**
 * Librería de iconos SVG — línea limpia, inspirada en la iconografía de Atlas/Andes
 * Trazo consistente (stroke-based), sin dependencias externas, sin emojis
 */

const Icons = (() => {
  const PATHS = {
    // Biblioteca core (Guía UX/UI Minimalismo Oscuro v2.0)
    arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
    arrowDown: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',

    // Marca / navegación
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    home: '<path d="M3 10v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V10"/><path d="M3 10l9-7 9 7"/><path d="M10 15h4v6h-4z"/>',

    // Formularios / documentos
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" stroke-linejoin="round"/>',

    // Escáner
    scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h3v-3"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
    flash: '<path d="M13 2L4.5 12.5a.6.6 0 0 0 .5 1H11l-1 8.5L18.5 11.5a.6.6 0 0 0-.5-1H12z" stroke-linejoin="round"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.4-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.4 6.4L3 16"/><path d="M3 21v-5h5"/>',

    // Estados / feedback
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.75" fill="currentColor" stroke="none"/>',
    infoCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none"/>',
    inbox: '<path d="M4 12h4l1.5 3h5L16 12h4"/><path d="M6 5h12l2 7v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/>',

    // Acciones
    trash: '<path d="M19 6H5M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><rect x="6" y="6" width="12" height="12" rx="1"/><path d="M10 10v4M14 10v4"/>',
    camera: '<path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h5l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 15l-5-5-9 9"/>',

    // Logística / transporte
    truck: '<path d="M2 7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v9H2z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="6.5" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/><path d="M4.1 18h1M19.6 18H21a1 1 0 0 0 1-1v-2M8.1 18h6.4"/>',
    pallet: '<rect x="3" y="5" width="18" height="4" rx="1"/><rect x="3" y="15" width="18" height="4" rx="1"/><path d="M8 5v14M12 5v14M16 5v14"/>',
    redCross: '<path d="M12 4v16M4 12h16"/>',
  };

  /**
   * Devuelve el marcado SVG de un icono
   * @param {string} name - clave del icono
   * @param {object} opts - { size, strokeWidth, className }
   */
  function svg(name, opts = {}) {
    const path = PATHS[name];
    if (!path) {
      console.warn(`Icon "${name}" no existe`);
      return '';
    }

    const size = opts.size || 20;
    const strokeWidth = opts.strokeWidth || 1.8;
    const className = opts.className ? ` ${opts.className}` : '';

    return `<svg class="icon${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  return { svg };
})();
