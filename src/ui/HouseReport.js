import { textStyle, COLORS } from './styles.js';

/** Resultado de "Revisar casa": qué cumple y qué le falta (como la consulta "?" de Terraria). */
export class HouseReport {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(46).setVisible(false);
    this.bg = scene.add.rectangle(0, 0, 10, 10, COLORS.panel, 0.94).setOrigin(0.5, 0).setStrokeStyle(2, 0x7d8fe0);
    this.title = scene.add.text(0, 12, '', textStyle({ fontSize: '20px' })).setOrigin(0.5, 0);
    this.body = scene.add.text(0, 46, '', textStyle({ fontSize: '14px', lineSpacing: 6, align: 'left' })).setOrigin(0.5, 0);
    this.hint = scene.add.text(0, 0, 'Toca para cerrar', textStyle({ fontSize: '12px', color: '#aab4e8' })).setOrigin(0.5, 0);
    this.container.add([this.bg, this.title, this.body, this.hint]);
    // Tocar el cartel lo cierra
    this.bg.setInteractive().on('pointerdown', () => this.hide());
    this.timer = null;
  }

  layout(x, y, maxWidth) {
    this.container.setPosition(x, y);
    this.maxWidth = maxWidth;
  }

  show(result) {
    this.title.setText(result.ok ? '✔ ¡Esta casa es válida!' : 'Esta casa todavía no es válida').setColor(result.ok ? '#8dff9a' : '#ffb0a0');
    const wrap = Math.min(520, (this.maxWidth || 600) - 40);
    this.body.setWordWrapWidth(wrap);
    this.body.setText(result.checks.map((c) => `${c.ok ? '✔' : '✘'}  ${c.text}`).join('\n'));
    // Colores por línea: verde lo que cumple, rojo lo que falta
    const w = Math.max(this.title.width, this.body.width) + 40;
    this.hint.setY(this.body.y + this.body.height + 8);
    this.bg.setSize(w, this.hint.y + this.hint.height + 10);
    this.container.setVisible(true).setAlpha(1);
    if (this.timer) this.timer.remove();
    this.timer = this.scene.time.delayedCall(9000, () => this.hide());
  }

  hide() {
    this.container.setVisible(false);
  }
}
