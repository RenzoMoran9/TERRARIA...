import { TILE_SIZE, DEPTH } from '../config.js';
import { BLOCK } from '../world/blocks.js';
import { ITEMS } from './items.js';
import { frameCount } from './Placeholders.js';

const T = TILE_SIZE;
const EPS = 0.001;
const MAX_STEP = 8;
const GRAVITY = 1700;
const MAX_FALL = 900;
const SPAWN_MIN = 24; // distancia (en bloques) a la que aparecen: fuera de la pantalla
const SPAWN_MAX = 40;
const DESPAWN_DIST = 70; // muy lejos: desaparecen
const START_GRACE = 12; // segundos sin enemigos al empezar o reaparecer

/**
 * Tipos de enemigo.
 * w/h = hitbox; spriteW/spriteH = tamaño de dibujo; damage = daño por contacto;
 * resist = cuánto resiste el empujón (0..1); drops = [ítem, mín, máx, probabilidad].
 */
export const ENEMY_TYPES = {
  slime: {
    name: 'Slime',
    texture: 'enemy_slime',
    w: 28,
    h: 20,
    spriteW: 32,
    spriteH: 24,
    hp: 14,
    damage: 7,
    resist: 0,
    drops: [['gel', 1, 2, 1]],
  },
  zombie: {
    name: 'Zombi',
    texture: 'enemy_zombie',
    w: 22,
    h: 56,
    spriteW: 48,
    spriteH: 64,
    hp: 45,
    damage: 14,
    resist: 0.55,
    speed: 72,
    drops: [['gel', 0, 1, 0.3]],
  },
};
const SLIME_COLORS = [0x6ad16a, 0x5fa8ff]; // verde (superficie de día) y azul (noche y cuevas)

/** Un enemigo: física propia contra los bloques (como el jugador) y una IA simple. */
class Enemy {
  constructor(manager, type, x, y, variant = 0) {
    const def = ENEMY_TYPES[type];
    this.manager = manager;
    this.scene = manager.scene;
    this.world = manager.world;
    this.type = type;
    this.def = def;
    this.w = def.w;
    this.h = def.h;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.hp = def.hp;
    this.dead = false;
    this.aiTimer = 0.5 + Math.random();
    this.blockedTime = 0;
    this.hurtTimer = 0;
    this.landTimer = 0;
    this.time = Math.random() * 10;
    this.tint = type === 'slime' ? SLIME_COLORS[variant] : 0xffffff;

    this.sprite = this.scene.add.image(0, 0, def.texture, 0).setOrigin(0.5, 1).setDepth(DEPTH.ENEMY);
    if (type === 'slime') this.sprite.setTint(this.tint).setAlpha(0.9);
    this.barBg = this.scene.add.rectangle(0, 0, 30, 5, 0x000000, 0.6).setDepth(DEPTH.ENEMY + 0.1).setVisible(false);
    this.bar = this.scene.add.rectangle(0, 0, 28, 3, 0x6ee06e).setOrigin(0, 0.5).setDepth(DEPTH.ENEMY + 0.2).setVisible(false);
    this.sync();
  }

  get centerX() {
    return this.x + this.w / 2;
  }

  get centerY() {
    return this.y + this.h / 2;
  }

  collides(x, y) {
    const x0 = Math.floor(x / T);
    const x1 = Math.floor((x + this.w - EPS) / T);
    const y0 = Math.floor(y / T);
    const y1 = Math.floor((y + this.h - EPS) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.world.isSolid(tx, ty)) return true;
    return false;
  }

  /** Mueve en X; puede subir escalones de 1 bloque. Devuelve true si chocó con una pared. */
  moveX(dx, stepUp) {
    while (dx !== 0) {
      const step = dx > 0 ? Math.min(dx, MAX_STEP) : Math.max(dx, -MAX_STEP);
      dx -= step;
      const nx = this.x + step;
      if (!this.collides(nx, this.y)) {
        this.x = nx;
        continue;
      }
      if (stepUp && this.onGround && !this.collides(this.x, this.y - T) && !this.collides(nx, this.y - T)) {
        this.y -= T;
        this.x = nx;
        continue;
      }
      if (step > 0) this.x = Math.floor((nx + this.w) / T) * T - this.w;
      else this.x = (Math.floor(nx / T) + 1) * T;
      this.vx = 0;
      return true;
    }
    return false;
  }

  moveY(dy) {
    this.onGround = false;
    while (dy !== 0) {
      const step = dy > 0 ? Math.min(dy, MAX_STEP) : Math.max(dy, -MAX_STEP);
      dy -= step;
      const ny = this.y + step;
      if (!this.collides(this.x, ny)) {
        this.y = ny;
        continue;
      }
      if (step > 0) {
        this.y = Math.floor((ny + this.h) / T) * T - this.h;
        this.onGround = true;
      } else this.y = (Math.floor(ny / T) + 1) * T;
      this.vy = 0;
      break;
    }
  }

  update(dt, player, night) {
    this.time += dt;
    this.hurtTimer -= dt;
    this.landTimer -= dt;
    const dx = player.centerX - this.centerX;
    const near = !player.dead && Math.abs(dx) < 40 * T && Math.abs(player.centerY - this.centerY) < 20 * T;
    const wasOnGround = this.onGround;
    if (this.type === 'slime') this._slime(dt, dx, near);
    else this._zombie(dt, dx, near, night);
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    const blocked = this.moveX(this.vx * dt, this.type === 'zombie');
    this.moveY(this.vy * dt);
    this.blockedTime = blocked && this.onGround ? this.blockedTime + dt : 0;
    if (this.type === 'slime' && this.onGround && !wasOnGround) {
      this.vx = 0; // el slime aterriza y se queda quieto
      this.landTimer = 0.15;
    }
    this.sync();
  }

  /** Slime: salta cada tanto hacia el jugador. */
  _slime(dt, dx, near) {
    if (!this.onGround) return;
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return;
    this.aiTimer = 0.9 + Math.random() * 1.3;
    const dir = near ? Math.sign(dx) || 1 : Math.random() < 0.5 ? -1 : 1;
    const big = Math.random() < 0.35;
    this.vx = dir * (90 + Math.random() * 70);
    this.vy = big ? -620 : -430;
    this.facing = dir;
  }

  /**
   * Zombi: camina hacia el jugador (de día se aleja), sube escalones de 1 bloque y salta
   * obstáculos de 2. No abre puertas: una casa cerrada con bloques y puerta lo frena.
   */
  _zombie(dt, dx, near, night) {
    let dir = near ? Math.sign(dx) || this.facing : this.facing;
    if (!night) dir = -Math.sign(dx) || this.facing; // de día se va
    if (Math.abs(dx) < 4 && near) dir = 0;
    if (dir !== 0) this.facing = dir;
    const target = dir * this.def.speed;
    const accel = (this.onGround ? 600 : 200) * dt;
    this.vx = this.vx < target ? Math.min(this.vx + accel, target) : Math.max(this.vx - accel, target);
    // Contra una pared: intenta saltarla (salta ~2,5 bloques)
    if (this.blockedTime > 0.25 && this.onGround) {
      this.vy = -560;
      this.blockedTime = 0;
    }
  }

  /** Recibe un golpe del jugador. */
  hit(damage, knockback, fromX) {
    if (this.dead) return;
    this.hp -= damage;
    this.hurtTimer = 0.15;
    const dir = Math.sign(this.centerX - fromX) || 1;
    this.vx = dir * knockback * (1 - this.def.resist);
    this.vy = Math.min(this.vy, -220 * (1 - this.def.resist * 0.6));
    this.onGround = false;
    this.scene.showFloatingText(this.centerX, this.y - 6, `${damage}`, '#ffb347', 15);
    this.scene.spawnDebris(this.centerX, this.centerY, this.type === 'slime' ? this.tint : 0x7fae6a, 4);
    if (this.hp <= 0) this.die(true);
  }

  die(byPlayer) {
    this.dead = true;
    if (byPlayer) {
      this.scene.spawnDust(this.centerX, this.y + this.h, 10);
      this.scene.spawnDebris(this.centerX, this.centerY, this.type === 'slime' ? this.tint : 0x7fae6a, 10);
      this.manager.giveDrops(this);
    }
    this.destroy();
  }

  sync() {
    const def = this.def;
    const s = this.sprite;
    let frame = 0;
    let sx = 1;
    let sy = 1;
    if (this.type === 'slime') {
      // 0 quieto (respira), 1 aplastado (antes de saltar / al caer), 2 estirado (en el aire)
      if (!this.onGround) frame = 2;
      else if (this.aiTimer < 0.15 || this.landTimer > 0) frame = 1;
      else sy = 1 + Math.sin(this.time * 5) * 0.05;
    } else {
      // 0-3 caminar, 4 golpeado
      frame = this.hurtTimer > 0 ? 4 : this.onGround && Math.abs(this.vx) > 10 ? Math.floor(this.time * 7) % 4 : 0;
    }
    if (this.manager.frames[this.type] > frame) s.setFrame(frame, false, false);
    s.setScale((def.spriteW / s.frame.width) * sx, (def.spriteH / s.frame.height) * sy)
      .setPosition(this.centerX, this.y + this.h)
      .setFlipX(this.facing < 0);
    if (this.hurtTimer > 0) s.setTintFill(0xffffff);
    else if (this.type === 'slime') s.setTint(this.tint);
    else s.clearTint();
    // Barra de vida (solo si está herido)
    const hurt = this.hp < def.hp;
    this.barBg.setVisible(hurt);
    this.bar.setVisible(hurt);
    if (hurt) {
      const top = this.y + this.h - def.spriteH - 8;
      this.barBg.setPosition(this.centerX, top);
      this.bar.setPosition(this.centerX - 14, top).setSize(28 * Math.max(0, this.hp / def.hp), 3);
      this.bar.setFillStyle(this.hp / def.hp > 0.4 ? 0x6ee06e : 0xe05050);
    }
  }

  overlaps(o) {
    return this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y;
  }

  destroy() {
    this.sprite.destroy();
    this.bar.destroy();
    this.barBg.destroy();
  }
}

/**
 * Enemigos: aparecen fuera de la pantalla (zombis solo de noche, slimes siempre),
 * persiguen al jugador, hacen daño por contacto y sueltan objetos al morir.
 * No aparecen donde hay paredes puestas por el jugador (dentro de las casas).
 */
export class Enemies {
  constructor(scene, world, player, dayNight, inventory) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.dayNight = dayNight;
    this.inventory = inventory;
    this.list = [];
    this.spawnTimer = START_GRACE;
    this.frames = {};
    for (const [type, def] of Object.entries(ENEMY_TYPES)) this.frames[type] = frameCount(scene, def.texture);
  }

  get count() {
    return this.list.length;
  }

  spawn(type, x, y, variant = 0) {
    const e = new Enemy(this, type, x, y, variant);
    this.list.push(e);
    return e;
  }

  update(dt) {
    const p = this.player;
    const night = this.dayNight.isNight();

    // Aparecer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !p.dead) {
      this.spawnTimer = night ? 1.5 + Math.random() * 2.5 : 4 + Math.random() * 5;
      const max = night ? 6 : 2;
      if (this.list.length < max) this.trySpawn(night);
    }

    for (const e of this.list) {
      if (e.dead) continue; // murió en este mismo frame (golpe de espada)
      e.update(dt, p, night);
      // Daño por contacto (el jugador queda invulnerable un momento después de cada golpe)
      if (!p.dead && e.overlaps(p)) p.hit(e.def.damage, e.centerX);
      if (e.dead) continue;
      // Muy lejos (o zombi de día fuera de la pantalla): desaparece
      const dist = Math.abs(e.centerX - p.centerX) / T;
      if (dist > DESPAWN_DIST || (e.type === 'zombie' && !night && dist > SPAWN_MIN) || e.y > this.world.height * T) {
        e.die(false);
      }
    }
    if (this.list.some((e) => e.dead)) this.list = this.list.filter((e) => !e.dead);
  }

  /** Busca un lugar libre fuera de la pantalla para que aparezca un enemigo. */
  trySpawn(night) {
    const p = this.player;
    const gen = this.world.generator;
    const ptx = Math.floor(p.centerX / T);
    const pty = Math.floor(p.centerY / T);
    const underground = pty > gen.surface[Math.max(0, Math.min(gen.surface.length - 1, ptx))] + 12;
    const type = !underground && night && Math.random() < 0.7 ? 'zombie' : 'slime';
    const def = ENEMY_TYPES[type];
    const hTiles = Math.ceil(def.h / T);
    for (let attempt = 0; attempt < 12; attempt++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = ptx + side * (SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN)));
      if (tx < 2 || tx >= this.world.width - 2) continue;
      // Suelo: en la superficie, el primer bloque sólido desde el cielo; bajo tierra, el piso de una cueva
      let floor;
      if (!underground) floor = this.world.skyTop[tx];
      else {
        floor = -1;
        for (let ty = pty - 14; ty <= pty + 14; ty++) {
          if (this.world.isSolid(tx, ty) && !this.world.isSolid(tx, ty - 1)) {
            floor = ty;
            break;
          }
        }
        if (floor < 0) continue;
      }
      if (!this._freeColumn(tx, floor, hTiles)) continue;
      const x = tx * T + (T - def.w) / 2;
      const y = floor * T - def.h;
      const variant = type === 'slime' && (night || underground) ? 1 : 0;
      return this.spawn(type, x, y, variant);
    }
    return null;
  }

  /** ¿Hay lugar libre sobre el suelo, sin paredes del jugador ni muebles? (dentro de casas no aparecen) */
  _freeColumn(tx, floor, hTiles) {
    for (let k = 1; k <= hTiles; k++) {
      const ty = floor - k;
      const id = this.world.getTile(tx, ty);
      if (id !== BLOCK.AIR && id !== BLOCK.PLANT) return false; // también descarta muebles
      // Pared puesta por el jugador = dentro de una casa (las naturales de las cuevas no cuentan)
      if (this.world.hasPlayerWall(tx, ty)) return false;
    }
    return true;
  }

  /** Golpe de espada: daña a los enemigos delante del jugador. Devuelve cuántos golpeó. */
  meleeHit(player, weapon) {
    const f = player.facing;
    const reach = weapon.reach;
    const box = {
      x: f > 0 ? player.centerX - 6 : player.centerX - reach,
      y: player.y - 12,
      w: reach + 6,
      h: player.h + 16,
    };
    let hits = 0;
    for (const e of this.list) {
      if (e.dead || !e.overlaps(box)) continue;
      e.hit(weapon.damage, weapon.knockback, player.centerX);
      hits++;
    }
    if (hits) this.scene.cameras.main.shake(70, 0.003);
    return hits;
  }

  /** El enemigo más cercano al jugador dentro de cierta distancia (en px), o null. */
  nearest(maxDist) {
    const p = this.player;
    let best = null;
    let bestD = maxDist * maxDist;
    for (const e of this.list) {
      const d = (e.centerX - p.centerX) ** 2 + (e.centerY - p.centerY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  giveDrops(e) {
    for (const [id, min, max, chance] of e.def.drops) {
      if (Math.random() > chance) continue;
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (n <= 0) continue;
      const left = this.inventory.add(id, n);
      if (left < n) this.scene.showFloatingText(this.player.centerX, this.player.y - 10, `+${n - left} ${ITEMS[id].name}`, '#ffffff', 13);
    }
  }

  /** Al reaparecer: se van los enemigos cercanos y hay un respiro antes de que vengan más. */
  clearNear(x, y, radiusTiles) {
    for (const e of this.list) {
      if (Math.hypot(e.centerX - x, e.centerY - y) < radiusTiles * T) e.die(false);
    }
    this.list = this.list.filter((e) => !e.dead);
    this.spawnTimer = START_GRACE;
  }

  destroy() {
    for (const e of this.list) e.destroy();
    this.list = [];
  }
}
