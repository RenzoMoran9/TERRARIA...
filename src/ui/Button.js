import { COLORS, textStyle } from './styles.js';

/**
 * Botón rectangular simple (rectángulo + texto) dentro de un Container.
 * El origen es el centro del botón.
 */
export function createButton(scene, x, y, width, height, label, onClick, options = {}) {
  const color = options.color ?? COLORS.button;
  const hover = options.hover ?? COLORS.buttonHover;
  const container = scene.add.container(x, y);
  const bg = scene.add
    .rectangle(0, 0, width, height, color, 0.95)
    .setStrokeStyle(2, 0xffffff, 0.55)
    .setInteractive({ useHandCursor: true });
  const text = scene.add.text(0, 0, label, textStyle({ fontSize: options.fontSize ?? '18px' })).setOrigin(0.5);
  container.add([bg, text]);

  bg.on('pointerover', () => bg.setFillStyle(hover, 0.95));
  bg.on('pointerout', () => bg.setFillStyle(color, 0.95));
  // 'pointerup' permite pedir pantalla completa (requiere un gesto del usuario)
  bg.on(options.event ?? 'pointerup', (pointer) => onClick(pointer));

  container.bg = bg;
  container.label = text;
  return container;
}
