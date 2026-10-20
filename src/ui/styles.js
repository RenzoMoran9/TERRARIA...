// Estilos de texto compartidos por la interfaz

export const PIXEL_FONT_NAME = '"Pixelify Sans"';
export const FONT = `${PIXEL_FONT_NAME}, "Trebuchet MS", Arial, sans-serif`;

export const TEXT = {
  fontFamily: FONT,
  fontSize: '16px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 3,
};

export function textStyle(overrides = {}) {
  return { ...TEXT, ...overrides };
}

// Paleta de la interfaz (azules translúcidos, como los paneles de Terraria)
export const COLORS = {
  panel: 0x1a2258,
  panelBorder: 0x7d8fe0,
  button: 0x34408a,
  buttonHover: 0x4a5bc0,
  craftable: 0x2f7a40,
  notCraftable: 0x262c5a,
};
