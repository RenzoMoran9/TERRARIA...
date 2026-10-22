// Estilos de texto compartidos por la interfaz

export const PIXEL_FONT_NAME = '"Pixelify Sans"';
export const FONT = `${PIXEL_FONT_NAME}, "Trebuchet MS", Arial, sans-serif`;

// Texto blanco con contorno azul muy oscuro (como el resto del arte: contornos oscuros pero no negros)
export const TEXT = {
  fontFamily: FONT,
  fontSize: '16px',
  color: '#ffffff',
  stroke: '#0a0c24',
  strokeThickness: 3,
};

export function textStyle(overrides = {}) {
  return { ...TEXT, ...overrides };
}

// Paleta de la interfaz (azules translúcidos, como los paneles de Terraria)
export const COLORS = {
  panel: 0x1f2a72,
  panelBorder: 0x93a6f4,
  button: 0x3a4aa6,
  buttonHover: 0x5064cc,
  buttonEdge: 0x0a0e2e, // contorno de los botones
  buttonLight: 0xc4d0ff, // bisel iluminado (arriba a la izquierda)
  buttonShade: 0x0a1040, // bisel en sombra (abajo a la derecha)
  textHover: '#ffe28a', // texto de un botón con el ratón encima (dorado, como en Terraria)
  craftable: 0x2e7f46,
  notCraftable: 0x29306a,
};
