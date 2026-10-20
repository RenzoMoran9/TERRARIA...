// Estilos de texto compartidos por la interfaz

export const FONT = 'Arial, Helvetica, sans-serif';

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

export const COLORS = {
  panel: 0x14141f,
  panelBorder: 0x6b6b9a,
  button: 0x2d3b5c,
  buttonHover: 0x3f5585,
  craftable: 0x2e6b33,
  notCraftable: 0x2a2a3a,
};
