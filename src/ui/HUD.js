import { textStyle } from './styles.js';

const BAR_W = 120;
const BAR_H = 16;
// Espacio horizontal que ocupan la vida (izquierda) y el reloj (derecha); la barra rápida va entre ambos
export const HUD_SIDE_SPACE = 172;

/** Barra de vida (arriba a la izquierda) y reloj del día (arriba a la derecha). */
export class HUD {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.lastHp = -1;
    this.lastClock = '';

    this.heart = scene.add.image(0, 0, 'ui_heart').setOrigin(0, 0.5).setDisplaySize(22, 22).setDepth(10);
    this.barBg = scene.add
      .rectangle(0, 0, BAR_W, BAR_H, 0x000000, 0.6)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.8)
      .setDepth(10);
    this.barFill = scene.add.rectangle(0, 0, BAR_W - 4, BAR_H - 4, 0xe53935).setOrigin(0, 0.5).setDepth(10);
    this.hpText = scene.add.text(0, 0, '', textStyle({ fontSize: '11px', strokeThickness: 2 })).setOrigin(0.5).setDepth(10);

    this.clockText = scene.add.text(0, 0, '', textStyle({ fontSize: '16px' })).setOrigin(1, 0).setDepth(10);
    this.celestial = scene.add.circle(0, 0, 7, 0xffd54f).setDepth(10);
    // Tocar el reloj activa/desactiva el modo debug (útil en celular, que no tiene F3)
    this.clockText.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.debug.toggle());
  }

  layout(width) {
    this.heart.setPosition(10, 22);
    this.barBg.setPosition(38, 22);
    this.barFill.setPosition(40, 22);
    this.hpText.setPosition(38 + BAR_W / 2, 22);
    this.clockText.setPosition(width - 12, 12);
    this.lastClock = '';
  }

  update() {
    const p = this.gs.player;
    const hp = Math.max(0, Math.round(p.health));
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      const ratio = hp / p.maxHealth;
      this.barFill.scaleX = ratio;
      this.barFill.setFillStyle(ratio > 0.5 ? 0x43a047 : ratio > 0.25 ? 0xfdd835 : 0xe53935);
      this.hpText.setText(`${hp}/${p.maxHealth}`);
    }

    const dn = this.gs.dayNight;
    const clock = `Día ${dn.day} · ${dn.getClockText()}`;
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.clockText.setText(clock);
      const night = dn.isNight();
      this.celestial
        .setFillStyle(night ? 0xdfe6f0 : 0xffd54f)
        .setPosition(this.clockText.x - this.clockText.width - 14, this.clockText.y + this.clockText.height / 2);
    }
  }

  destroy() {
    [this.heart, this.barBg, this.barFill, this.hpText, this.clockText, this.celestial].forEach((o) => o.destroy());
  }
}
