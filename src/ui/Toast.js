import { textStyle } from './styles.js';

/** Mensajes cortos que aparecen y se desvanecen ("Partida guardada", "Inventario lleno"...). */
export class Toast {
  constructor(scene) {
    this.scene = scene;
    this.tween = null;
    this.text = scene.add
      .text(0, 0, '', textStyle({ fontSize: '16px', align: 'center', backgroundColor: 'rgba(12,16,44,0.78)' }))
      .setPadding(10, 4, 10, 4)
      .setOrigin(0.5, 0)
      .setDepth(40)
      .setAlpha(0);
  }

  layout(x, y) {
    this.text.setPosition(x, y);
  }

  show(message) {
    if (this.tween) this.tween.stop();
    this.text.setText(message).setAlpha(1);
    this.tween = this.scene.tweens.add({ targets: this.text, alpha: 0, delay: 1600, duration: 400 });
  }
}
