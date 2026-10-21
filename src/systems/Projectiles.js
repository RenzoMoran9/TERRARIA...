import Phaser from 'phaser';
import { TILE_SIZE, DEPTH } from '../config.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const ICON_ANGLE = -Math.PI / 4; // los íconos de armas apuntan arriba a la derecha
const BOOMERANG_OUT = 0.42; // segundos de ida del bumerán antes de volver
/** Gravedad de cada proyectil (las flechas y los cuchillos caen un poco) */
export const PROJECTILE_GRAVITY = { arrow: 180, knife: 220, boomerang: 0, fireball: 0 };
const FIREBALL_RADIUS = 2.2 * T; // la explosión quema a los que estén cerca

/**
 * Proyectiles del jugador: flechas (caen un poco y se clavan en los bloques),
 * cuchillos arrojadizos y el bumerán (va, golpea y vuelve a la mano).
 */
export class Projectiles {
  constructor(scene, world, enemies, player) {
    this.scene = scene;
    this.world = world;
    this.enemies = enemies;
    this.player = player;
    this.list = [];
  }

  /** kind: 'arrow' | 'knife' | 'boomerang'. angle en radianes (0 = derecha). */
  fire(kind, icon, x, y, angle, speed, damage, knockback) {
    const sprite = this.scene.add.image(x, y, icon).setDepth(kind === 'fireball' ? DEPTH.LIGHT + 0.5 : DEPTH.PLAYER + 0.5);
    sprite.setDisplaySize(kind === 'boomerang' ? 22 : 24, kind === 'boomerang' ? 22 : 24);
    if (kind === 'fireball') sprite.setDisplaySize(30, 30).setBlendMode(Phaser.BlendModes.ADD);
    const p = {
      kind,
      sprite,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      damage,
      knockback,
      gravity: PROJECTILE_GRAVITY[kind],
      life: 0,
      stuck: 0, // segundos clavada en un bloque (la flecha desaparece después)
      returning: false,
      hit: new Set(), // enemigos ya golpeados (el bumerán golpea una vez a cada uno)
      dead: false,
    };
    this.list.push(p);
    audio.play(kind === 'arrow' ? 'bow' : kind === 'fireball' ? 'fireball' : 'throw', { x, y });
    return p;
  }

  count(kind) {
    return this.list.filter((p) => p.kind === kind && !p.dead).length;
  }

  update(dt) {
    for (const p of this.list) {
      p.life += dt;
      if (p.stuck > 0) {
        p.stuck += dt;
        p.sprite.setAlpha(Math.max(0, 1 - (p.stuck - 1.2) / 0.5));
        if (p.stuck > 1.7) p.dead = true;
        continue;
      }
      if (p.kind === 'boomerang') this._boomerang(p, dt);
      else if (p.kind === 'fireball') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.sprite.rotation += dt * 12;
        if (Math.random() < 0.5) this.scene.spawnSparkles(p.x, p.y, 1, 0xff9a30);
        if (this.world.isSolid(Math.floor(p.x / T), Math.floor(p.y / T)) || p.life > 2.2) this._explode(p);
      } else {
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.sprite.setRotation(Math.atan2(p.vy, p.vx) - ICON_ANGLE);
        // Choca con un bloque: la flecha se clava, el cuchillo cae
        if (this.world.isSolid(Math.floor(p.x / T), Math.floor(p.y / T))) {
          p.stuck = 0.001;
          this.scene.spawnDebris(p.x, p.y, 0xc8b08a, 2);
        }
        if (p.life > 3) p.dead = true;
      }
      p.sprite.setPosition(p.x, p.y);
      if (!p.dead && p.stuck === 0) this._hitEnemies(p);
    }
    if (this.list.some((p) => p.dead)) {
      for (const p of this.list) if (p.dead) p.sprite.destroy();
      this.list = this.list.filter((p) => !p.dead);
    }
  }

  _boomerang(p, dt) {
    p.sprite.rotation += dt * 22;
    if (!p.returning && p.life > BOOMERANG_OUT) p.returning = true;
    if (p.returning) {
      // Vuelve hacia el jugador (atraviesa los bloques al volver, como en Terraria)
      const pl = this.player;
      const dx = pl.centerX - p.x;
      const dy = pl.y + 20 - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * p.speed * 1.15;
      p.vy = (dy / d) * p.speed * 1.15;
      if (d < 22 || pl.dead) p.dead = true; // de vuelta en la mano
    } else if (this.world.isSolid(Math.floor((p.x + p.vx * dt) / T), Math.floor((p.y + p.vy * dt) / T))) {
      p.returning = true;
      this.scene.spawnDebris(p.x, p.y, 0xa3733a, 2);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life > 4) p.dead = true;
  }

  _hitEnemies(p) {
    const box = { x: p.x - 7, y: p.y - 7, w: 14, h: 14 };
    for (const e of this.enemies.list) {
      if (e.dead || p.hit.has(e) || !e.overlaps(box)) continue;
      p.hit.add(e);
      e.hit(p.damage, p.knockback, p.x - Math.sign(p.vx || 1) * 20);
      if (p.kind === 'boomerang') p.returning = true;
      else if (p.kind === 'fireball') {
        this._explode(p);
        return;
      } else {
        p.dead = true;
        return;
      }
    }
  }

  /** La bola de fuego explota: quema a todos los enemigos cerca. */
  _explode(p) {
    if (p.dead) return;
    p.dead = true;
    for (const e of this.enemies.list) {
      if (e.dead || p.hit.has(e)) continue;
      if (Math.hypot(e.centerX - p.x, e.centerY - p.y) > FIREBALL_RADIUS) continue;
      p.hit.add(e);
      e.hit(p.damage, p.knockback, p.x);
    }
    this.scene.spawnSparkles(p.x, p.y, 18, 0xff8a30);
    audio.play('explode', { x: p.x, y: p.y });
    this.scene.spawnDebris(p.x, p.y, 0xffc040, 8);
    this.scene.showShockwave?.(p.x, p.y, FIREBALL_RADIUS, 0xff8a30);
  }

  destroy() {
    for (const p of this.list) p.sprite.destroy();
    this.list = [];
  }
}
