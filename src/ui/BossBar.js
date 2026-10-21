import { textStyle } from './styles.js';

const W = 380;

/** Barra de vida del jefe (arriba al centro, mientras dura la pelea). */
export class BossBar {
  constructor(scene) {
    this.scene = scene;
    this.boss = null;
    this.container = scene.add.container(0, 0).setDepth(12).setVisible(false);
    this.bg = scene.add.rectangle(0, 0, W + 8, 18, 0x120814, 0.85).setStrokeStyle(2, 0xe8c860, 0.9);
    this.fill = scene.add.rectangle(-W / 2, 0, W, 10, 0xd83a3a).setOrigin(0, 0.5);
    this.name = scene.add.text(0, -18, '', textStyle({ fontSize: '15px', color: '#ffe28a' })).setOrigin(0.5);
    this.hpText = scene.add.text(0, 0, '', textStyle({ fontSize: '10px', strokeThickness: 2 })).setOrigin(0.5);
    this.container.add([this.bg, this.fill, this.name, this.hpText]);
  }

  layout(x, y, width) {
    const s = Math.min(1, (width - 24) / (W + 8));
    this.container.setPosition(x, y + 20 * s).setScale(s);
  }

  show(boss) {
    this.boss = boss;
    this.name.setText(boss.def.name);
    this.container.setVisible(true);
  }

  hide() {
    this.boss = null;
    this.container.setVisible(false);
  }

  update() {
    const b = this.boss;
    if (!b) return;
    const k = Math.max(0, b.hp / b.maxHp);
    this.fill.setSize(W * k, 10).setFillStyle(b.phase2 ? 0xff5a2a : 0xd83a3a);
    this.hpText.setText(`${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`);
  }
}
