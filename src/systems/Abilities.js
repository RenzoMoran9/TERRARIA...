import { TILE_SIZE } from '../config.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const FIRE_COST = 20;
const FIRE_COOLDOWN = 0.45;
const FIRE_SPEED = 520;

/**
 * Efectos de los poderes del jugador (los movimientos están en Player):
 * embestida (golpea a quien atraviesa), golpe sísmico (onda al caer) y bola de fuego.
 * El daño crece con el nivel del jugador.
 */
export class Abilities {
  constructor(scene, player, enemies, projectiles, progress) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.projectiles = projectiles;
    this.progress = progress;
    this.fireCooldown = 0;
  }

  get level() {
    return this.progress.level;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
  }

  /** Embestida: cada enemigo que atraviesa recibe un golpe (una vez por embestida). */
  dashContact(p) {
    const box = { x: p.x - 6, y: p.y, w: p.w + 12, h: p.h };
    for (const e of this.enemies.list) {
      if (e.dead || p.dashHits.has(e) || !e.overlaps(box)) continue;
      p.dashHits.add(e);
      e.hit(10 + this.level * 2, 380, p.centerX - p.facing * 30);
    }
  }

  /** Golpe sísmico: al tocar el suelo, una onda daña y lanza por el aire a los enemigos cercanos. */
  poundImpact(p, fallTiles) {
    const radius = 4 * T;
    const damage = 14 + this.level * 2 + Math.min(10, Math.round(fallTiles * 1.5));
    const x = p.centerX;
    const y = p.y + p.h;
    for (const e of this.enemies.list) {
      if (e.dead) continue;
      const d = Math.hypot(e.centerX - x, e.centerY - y);
      if (d > radius) continue;
      e.hit(damage, 520, x);
      e.vy = -520;
    }
    this.scene.cameras.main.shake(220, 0.012);
    audio.play('pound');
    this.scene.spawnDust(x - 40, y, 10);
    this.scene.spawnDust(x + 40, y, 10);
    this.scene.spawnSparkles(x, y - 6, 16, 0xffe08a);
    this.scene.showShockwave?.(x, y, radius);
  }

  /** Bola de fuego hacia 'angle' (radianes). Devuelve true si salió. */
  fireball(angle) {
    const p = this.player;
    if (p.dead || !p.hasSkill('fireball') || this.fireCooldown > 0) return false;
    if (!p.useEnergy(FIRE_COST)) {
      this.scene.events.emit('toast', 'Sin energía: espera a que se recargue');
      this.fireCooldown = 0.6;
      return false;
    }
    this.fireCooldown = FIRE_COOLDOWN;
    p.facing = Math.cos(angle) >= 0 ? 1 : -1;
    const x = p.centerX + Math.cos(angle) * 18;
    const y = p.y + 22 + Math.sin(angle) * 18;
    this.projectiles.fire('fireball', 'fx_fireball', x, y, angle, FIRE_SPEED, 16 + this.level * 2, 260);
    p.anim.cheer?.(0.15);
    return true;
  }
}
