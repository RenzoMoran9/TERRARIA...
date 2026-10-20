import { textStyle } from './styles.js';

const HEARTS = 5; // 20 de vida por corazón (como Terraria)
const HEART_SIZE = 24;
const HEART_GAP = 3;
const LOW_HEALTH = 0.3; // con poca vida los corazones laten
// Espacio horizontal que ocupan la vida (izquierda) y el reloj (derecha); la barra rápida va entre ambos
export const HUD_SIDE_SPACE = 172;

/** Corazones de vida (arriba a la izquierda) y reloj del día (arriba a la derecha). */
export class HUD {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.lastHp = -1;
    this.lastClock = '';

    this.hpText = scene.add.text(0, 0, '', textStyle({ fontSize: '13px' })).setDepth(10);
    this.hearts = [];
    for (let i = 0; i < HEARTS; i++) {
      // Corazón vacío (oscuro) detrás y corazón lleno recortado según la vida
      const empty = scene.add.image(0, 0, 'ui_heart').setOrigin(0.5).setTint(0x2a1418).setAlpha(0.85).setDepth(10);
      const full = scene.add.image(0, 0, 'ui_heart').setOrigin(0.5).setDepth(10);
      empty.setDisplaySize(HEART_SIZE, HEART_SIZE);
      full.setDisplaySize(HEART_SIZE, HEART_SIZE);
      this.hearts.push({ empty, full, scale: full.scaleX });
    }
    this.pulsing = false;

    this.clockText = scene.add.text(0, 0, '', textStyle({ fontSize: '16px' })).setOrigin(1, 0).setDepth(10);
    this.celestial = scene.add.image(0, 0, 'bg_sun').setDisplaySize(22, 22).setDepth(10);
    // Tocar el reloj activa/desactiva el modo debug (útil en celular, que no tiene F3)
    this.clockText.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.debug.toggle());
  }

  layout(width) {
    this.hpText.setPosition(10, 4);
    this.hearts.forEach((h, i) => {
      const x = 10 + HEART_SIZE / 2 + i * (HEART_SIZE + HEART_GAP);
      h.empty.setPosition(x, 32);
      h.full.setPosition(x, 32);
    });
    this.clockText.setPosition(width - 12, 12);
    this.lastClock = '';
  }

  update() {
    const p = this.gs.player;
    const hp = Math.max(0, Math.round(p.health));
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      this.hpText.setText(`Vida ${hp}/${p.maxHealth}`);
      const perHeart = p.maxHealth / HEARTS;
      this.hearts.forEach((h, i) => {
        const frac = Math.max(0, Math.min(1, (hp - i * perHeart) / perHeart));
        const w = h.full.frame.width;
        h.full.setVisible(frac > 0).setCrop(0, 0, w * frac, h.full.frame.height);
      });
    }

    // Latido de los corazones con poca vida (dos golpes seguidos, como un corazón)
    const low = hp > 0 && hp / p.maxHealth < LOW_HEALTH;
    if (low || this.pulsing) {
      this.pulsing = low;
      const t = (this.scene.time.now % 1000) / 1000;
      const beat = low ? Math.max(Math.exp(-((t - 0.08) ** 2) / 0.002), 0.6 * Math.exp(-((t - 0.28) ** 2) / 0.002)) : 0;
      for (const h of this.hearts) {
        h.full.setScale(h.scale * (1 + beat * 0.18));
        h.empty.setScale(h.scale * (1 + beat * 0.18));
      }
    }

    const dn = this.gs.dayNight;
    const clock = `Día ${dn.day} · ${dn.getClockText()}`;
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.clockText.setText(clock);
      this.celestial
        .setTexture(dn.isNight() ? 'bg_moon' : 'bg_sun')
        .setDisplaySize(22, 22)
        .setPosition(this.clockText.x - this.clockText.width - 16, this.clockText.y + this.clockText.height / 2);
    }
  }
}
