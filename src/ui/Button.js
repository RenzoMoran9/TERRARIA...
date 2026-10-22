import { COLORS, textStyle } from './styles.js';

/**
 * Botón rectangular (rectángulo + bisel + texto) dentro de un Container.
 * El origen es el centro del botón. container.bg es el rectángulo de color (se puede recolorear con
 * setFillStyle); el bisel es translúcido, así que sirve para cualquier color.
 */
export function createButton(scene, x, y, width, height, label, onClick, options = {}) {
  const color = options.color ?? COLORS.button;
  const hover = options.hover ?? COLORS.buttonHover;
  const container = scene.add.container(x, y);
  const bg = scene.add
    .rectangle(0, 0, width, height, color, 0.95)
    .setStrokeStyle(2, COLORS.buttonEdge, 0.95)
    .setInteractive({ useHandCursor: true });
  // Bisel de un píxel: luz arriba y a la izquierda, sombra abajo y a la derecha (más gruesa abajo)
  const l = -width / 2 + 1;
  const t = -height / 2 + 1;
  const iw = width - 2;
  const ih = height - 2;
  const bevel = [
    scene.add.rectangle(l, t + ih - 2, iw, 2, COLORS.buttonShade, 0.45),
    scene.add.rectangle(l + iw - 1, t, 1, ih, COLORS.buttonShade, 0.4),
    scene.add.rectangle(l, t, iw, 1, COLORS.buttonLight, 0.6),
    scene.add.rectangle(l, t + 1, 1, ih - 3, COLORS.buttonLight, 0.35),
    // Brillo suave en la mitad de arriba
    scene.add.rectangle(l + 1, t + 1, iw - 2, Math.max(1, Math.floor(ih * 0.4)), 0xffffff, 0.07),
  ].map((r) => r.setOrigin(0));
  const text = scene.add.text(0, 0, label, textStyle({ fontSize: options.fontSize ?? '18px' })).setOrigin(0.5);
  container.add([bg, ...bevel, text]);

  // Al pasar el ratón: fondo más claro y texto dorado. Si otro código cambió el color del fondo
  // (p. ej. verde = se puede fabricar), se respeta ese color.
  const out = () => {
    if (bg.fillColor === hover) bg.setFillStyle(color, 0.95);
    text.setColor('#ffffff');
    text.y = 0;
  };
  bg.on('pointerover', () => {
    if (bg.fillColor === color) bg.setFillStyle(hover, 0.95);
    text.setColor(COLORS.textHover);
  });
  bg.on('pointerout', out);
  // Al apretar, el texto se hunde un píxel
  bg.on('pointerdown', () => (text.y = 1));
  bg.on('pointerup', () => (text.y = 0));
  // 'pointerup' permite pedir pantalla completa (requiere un gesto del usuario)
  bg.on(options.event ?? 'pointerup', (pointer) => onClick(pointer));

  container.bg = bg;
  container.label = text;
  return container;
}
