import { textStyle } from './styles.js';
import { ZONE_INFO as BIOME_INFO } from '../world/WorldGenerator.js';
import { dangerStars } from '../systems/Zones.js';
import { ENERGY_MAX } from '../systems/Skills.js';

const BAR_W = 112;
const ENERGY_SKILLS = ['sprint', 'dash', 'fireball', 'groundPound'];

const HEARTS = 10; // hasta 10 corazones (5 por fila); con más vida máxima cada uno vale más
const PER_ROW = 5;
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
    // Nivel y experiencia (debajo de los corazones), energía y puntos de habilidad para gastar
    this.levelText = scene.add.text(0, 0, '', textStyle({ fontSize: '13px', color: '#9be7ff' })).setDepth(10);
    this.xpBg = scene.add.rectangle(0, 0, BAR_W, 6, 0x0b1030, 0.85).setOrigin(0, 0.5).setStrokeStyle(1, 0x000000, 0.8).setDepth(10);
    this.xpBar = scene.add.rectangle(0, 0, BAR_W, 6, 0x58b8ff).setOrigin(0, 0.5).setDepth(10);
    this.enBg = scene.add.rectangle(0, 0, BAR_W, 5, 0x0b1030, 0.85).setOrigin(0, 0.5).setStrokeStyle(1, 0x000000, 0.8).setDepth(10);
    this.enBar = scene.add.rectangle(0, 0, BAR_W, 5, 0xffd84a).setOrigin(0, 0.5).setDepth(10);
    this.pointsText = scene.add
      .text(0, 0, '', textStyle({ fontSize: '13px', color: '#ffe28a', backgroundColor: 'rgba(60,40,0,0.75)' }))
      .setPadding(5, 2, 5, 2)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    this.pointsText.on('pointerdown', () => scene.toggleSkills(true));
    this.levelText.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.toggleSkills(true));
    this.lastLevel = '';
    this.levelY = 54;

    // Zona actual (debajo del reloj)
    this.zoneText = scene.add.text(0, 0, '', textStyle({ fontSize: '13px', color: '#d8e4ff' })).setOrigin(1, 0).setDepth(10);
    this.lastZone = '';
    // Tocar el reloj activa/desactiva el modo debug (útil en celular, que no tiene F3)
    this.clockText.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.debug.toggle());
  }

  layout(width) {
    this.hpText.setPosition(10, 4);
    this.hearts.forEach((h, i) => {
      const x = 10 + HEART_SIZE / 2 + (i % PER_ROW) * (HEART_SIZE + HEART_GAP);
      const y = 32 + Math.floor(i / PER_ROW) * (HEART_SIZE + 2);
      h.empty.setPosition(x, y);
      h.full.setPosition(x, y);
    });
    this.clockText.setPosition(width - 12, 12);
    this.layoutLevel(this.levelY);
    this.zoneText.setPosition(width - 12, 34);
    this.lastClock = '';
  }

  /** Fila de nivel / experiencia / energía (baja si la barra rápida ocupa una segunda fila). */
  layoutLevel(y = this.baseLevelY ?? 54) {
    this.baseLevelY = y;
    // Con la segunda fila de corazones, el nivel baja un poco
    if ((this.heartCount || 5) > PER_ROW) y += HEART_SIZE + 2;
    this.levelY = y;
    this.levelText.setPosition(10, y - 8);
    this.xpBg.setPosition(56, y);
    this.xpBar.setPosition(56, y);
    this.enBg.setPosition(56, y + 9);
    this.enBar.setPosition(56, y + 9);
    this.pointsText.setPosition(10, y + 16);
  }

  updateLevel() {
    const pr = this.gs.progress;
    const p = this.gs.player;
    if (!pr) return;
    const key = `${pr.level}-${pr.xp}-${pr.points}`;
    if (key !== this.lastLevel) {
      this.lastLevel = key;
      this.levelText.setText(`Nv ${pr.level}`);
      this.xpBar.setSize(Math.max(1, BAR_W * Math.min(1, pr.xp / pr.xpNeeded)), 6);
      this.pointsText.setText(pr.points > 0 ? `★ ${pr.points} punto${pr.points > 1 ? 's' : ''} de habilidad` : '');
      this.pointsText.setVisible(pr.points > 0);
    }
    // La barra de energía aparece al aprender un poder que la usa
    const showEnergy = ENERGY_SKILLS.some((id) => pr.has(id));
    this.enBg.setVisible(showEnergy);
    this.enBar.setVisible(showEnergy);
    if (showEnergy) {
      const w = Math.max(1, Math.round(BAR_W * (p.energy / ENERGY_MAX)));
      if (w !== this.enW) {
        this.enW = w;
        this.enBar.setSize(w, 5);
      }
      this.enBar.setFillStyle(p.energy < 20 ? 0xff8a4a : 0xffd84a);
    }
    if (pr.points > 0) this.pointsText.setAlpha(0.75 + Math.sin(this.scene.time.now * 0.006) * 0.25);
  }

  update() {
    this.updateLevel();
    const p = this.gs.player;
    const hp = Math.max(0, Math.round(p.health));
    const sick = Math.ceil(this.gs.potionSickness || 0);
    if (hp !== this.lastHp || sick !== this.lastSick || p.maxHealth !== this.lastMax) {
      this.lastHp = hp;
      this.lastSick = sick;
      this.lastMax = p.maxHealth;
      this.hpText.setText(`Vida ${hp}/${p.maxHealth}${sick > 0 ? `  ·  poción en ${sick}s` : ''}`);
      // 1 corazón cada 20 de vida (entre 5 y 10)
      const count = Math.max(5, Math.min(HEARTS, Math.round(p.maxHealth / 20)));
      if (count !== this.heartCount) {
        this.heartCount = count;
        this.hearts.forEach((h, i) => {
          h.empty.setVisible(i < count);
          h.full.setVisible(i < count);
        });
        this.layoutLevel();
      }
      const perHeart = p.maxHealth / count;
      this.hearts.forEach((h, i) => {
        if (i >= count) return;
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

    const zones = this.gs.zones;
    if (zones && zones.current >= 0) {
      const info = BIOME_INFO[zones.current];
      const zone = `${info.name} ${dangerStars(info.danger)} · ${zones.discovered.size}/${zones.total}`;
      if (zone !== this.lastZone) {
        this.lastZone = zone;
        this.zoneText.setText(zone);
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
