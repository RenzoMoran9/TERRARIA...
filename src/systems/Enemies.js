import { TILE_SIZE, DEPTH } from '../config.js';
import { BLOCK, IS_PLANT } from '../world/blocks.js';
import { BIOME, BIOME_INFO } from '../world/WorldGenerator.js';
import { frameCount } from './Placeholders.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
    blood: 0x6ad16a,
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
    nightOnly: true,
    blood: 0x7fae6a,
    drops: [['gel', 0, 1, 0.3]],
  },
  // Desierto: camina rápido hacia el jugador, de día y de noche
  scorpion: {
    name: 'Escorpión',
    texture: 'enemy_scorpion',
    w: 34,
    h: 20,
    spriteW: 40,
    spriteH: 24,
    hp: 30,
    damage: 12,
    resist: 0.3,
    speed: 105,
    walkFrames: 3,
    blood: 0xcf8a3e,
    drops: [
      ['cactus', 0, 2, 0.6],
      ['gel', 0, 1, 0.4],
    ],
  },
  // Selva: revolotea cerca y cada tanto se lanza en picada
  wasp: {
    name: 'Avispa',
    texture: 'enemy_wasp',
    flyer: 'wasp',
    w: 22,
    h: 18,
    spriteW: 32,
    spriteH: 28,
    hp: 24,
    damage: 12,
    resist: 0.2,
    speed: 150,
    animFps: 22,
    blood: 0xf2c432,
    drops: [
      ['gel', 0, 1, 0.5],
      ['mud', 1, 2, 0.4],
    ],
  },
  // Tierras Sombrías / Cristal: se acelera hacia el jugador, se pasa de largo y vuelve
  eye: {
    name: 'Ojo volador',
    texture: 'enemy_eye',
    flyer: 'eye',
    w: 24,
    h: 20,
    spriteW: 32,
    spriteH: 24,
    hp: 40,
    damage: 16,
    resist: 0.25,
    speed: 210,
    animFps: 6,
    blood: 0xd04060,
    drops: [
      ['shadow_stone', 1, 2, 0.6],
      ['gel', 0, 1, 0.4],
    ],
  },
  // Volcán: vuelo rápido y nervioso
  firebat: {
    name: 'Murciélago de fuego',
    texture: 'enemy_firebat',
    flyer: 'bat',
    w: 24,
    h: 16,
    spriteW: 36,
    spriteH: 24,
    hp: 32,
    damage: 18,
    resist: 0.2,
    speed: 220,
    animFps: 12,
    blood: 0xff8a30,
    drops: [['coal', 1, 2, 0.7]],
  },
};

/** Variantes de slime (el gris del dibujo se tiñe con 'tint'); drops extra según la zona. */
export const SLIME_KINDS = {
  green: { name: 'Slime verde', tint: 0x6ad16a },
  blue: { name: 'Slime azul', tint: 0x5fa8ff },
  sand: { name: 'Slime de arena', tint: 0xe8c070, drops: [['sand', 1, 3, 0.6]] },
  ice: { name: 'Slime de hielo', tint: 0xa8e4ff, drops: [['ice', 1, 2, 0.5]] },
  jungle: { name: 'Slime de la selva', tint: 0x3f9a3a, drops: [['mud', 1, 2, 0.5]] },
  shadow: { name: 'Slime sombrío', tint: 0x9a5ad0, drops: [['shadow_stone', 1, 2, 0.4]] },
  crystal: { name: 'Slime de cristal', tint: 0xff9ef0, drops: [['crystal', 1, 2, 0.6]] },
  lava: { name: 'Slime de lava', tint: 0xff7a30, drops: [['coal', 1, 2, 0.6]] },
};
// Zombis de cada zona (tinte sobre el dibujo)
const ZOMBIE_TINTS = { [BIOME.DESERT]: 0xf0dca8, [BIOME.SNOW]: 0xa8d0ff, [BIOME.SHADOW]: 0xc8a8ff, [BIOME.CRYSTAL]: 0xffc8f4, [BIOME.VOLCANO]: 0xb89088 };

/**
 * Qué aparece en cada zona: [tipo, peso, variante de slime]. 'day' = de día, 'night' = de noche.
 * Las zonas más lejanas tienen enemigos más fuertes (ver levelOf).
 */
const SPAWN_TABLE = {
  [BIOME.FOREST]: { day: [['slime', 1, 'green']], night: [['zombie', 0.7], ['slime', 0.3, 'blue']] },
  [BIOME.DESERT]: { day: [['scorpion', 0.55], ['slime', 0.45, 'sand']], night: [['scorpion', 0.4], ['zombie', 0.4], ['slime', 0.2, 'sand']] },
  [BIOME.SNOW]: { day: [['slime', 1, 'ice']], night: [['zombie', 0.6], ['slime', 0.4, 'ice']] },
  [BIOME.JUNGLE]: { day: [['wasp', 0.5], ['slime', 0.5, 'jungle']], night: [['wasp', 0.4], ['zombie', 0.35], ['slime', 0.25, 'jungle']] },
  [BIOME.SHADOW]: { day: [['eye', 0.5], ['slime', 0.5, 'shadow']], night: [['eye', 0.55], ['zombie', 0.3], ['slime', 0.15, 'shadow']] },
  [BIOME.CRYSTAL]: { day: [['slime', 0.6, 'crystal'], ['eye', 0.4]], night: [['eye', 0.4], ['slime', 0.35, 'crystal'], ['zombie', 0.25]] },
  [BIOME.VOLCANO]: { day: [['firebat', 0.55], ['slime', 0.45, 'lava']], night: [['firebat', 0.55], ['zombie', 0.25], ['slime', 0.2, 'lava']] },
};
const CAVE_SLIME = { [BIOME.FOREST]: 'blue', [BIOME.DESERT]: 'sand', [BIOME.SNOW]: 'ice', [BIOME.JUNGLE]: 'jungle', [BIOME.SHADOW]: 'shadow', [BIOME.CRYSTAL]: 'crystal', [BIOME.VOLCANO]: 'lava' };
const LEGACY_SLIME = ['green', 'blue']; // spawn(type, x, y, 0|1) de versiones anteriores

function pickWeighted(list) {
  let r = Math.random() * list.reduce((a, e) => a + e[1], 0);
  for (const e of list) {
    r -= e[1];
    if (r <= 0) return e;
  }
  return list[list.length - 1];
}

/** Un enemigo: física propia contra los bloques (como el jugador) y una IA simple. */
class Enemy {
  /** opts: { kind (variante de slime), tint, level (1 = normal; más alto = más vida y daño) } */
  constructor(manager, type, x, y, opts = {}) {
    const def = ENEMY_TYPES[type];
    if (typeof opts === 'number') opts = { kind: LEGACY_SLIME[opts] };
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
    const kind = type === 'slime' ? SLIME_KINDS[opts.kind] || SLIME_KINDS.green : null;
    this.kind = kind;
    this.level = Math.max(1, opts.level || 1);
    // Más lejos del inicio = más fuertes
    this.maxHp = Math.round(def.hp * (1 + 0.45 * (this.level - 1)));
    this.damage = Math.round(def.damage * (1 + 0.3 * (this.level - 1)));
    this.hp = this.maxHp;
    this.dead = false;
    this.aiTimer = 0.5 + Math.random();
    this.blockedTime = 0;
    this.hurtTimer = 0;
    this.landTimer = 0;
    this.time = Math.random() * 10;
    this.tint = kind ? kind.tint : opts.tint ?? 0xffffff;
    this.blood = kind ? kind.tint : def.blood;
    this.dashTimer = 1.5 + Math.random() * 2; // avispa: tiempo hasta la próxima picada
    this.dashing = 0;

    this.sprite = this.scene.add.image(0, 0, def.texture, 0).setOrigin(0.5, def.flyer ? 0.5 : 1).setDepth(DEPTH.ENEMY);
    if (type === 'slime') this.sprite.setAlpha(0.9);
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
      // Los que caminan se paran sobre las plataformas (los voladores las atraviesan)
      if (step > 0 && !this.def.flyer) {
        const row = Math.floor((ny + this.h - EPS) / T);
        if (this.y + this.h <= row * T + EPS) {
          let platform = false;
          for (let tx = Math.floor(this.x / T); tx <= Math.floor((this.x + this.w - EPS) / T); tx++) {
            if (this.world.isPlatform(tx, row)) platform = true;
          }
          if (platform) {
            this.y = row * T - this.h;
            this.onGround = true;
            this.vy = 0;
            break;
          }
        }
      }
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
    if (this.def.flyer) {
      this._fly(dt, player, near);
      this.sync();
      return;
    }
    if (this.type === 'slime') this._slime(dt, dx, near);
    else this._zombie(dt, dx, near, night);
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    const blocked = this.moveX(this.vx * dt, this.type !== 'slime');
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
    if (!night && this.def.nightOnly) dir = -Math.sign(dx) || this.facing; // de día se va
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

  /**
   * Voladores: no les afecta la gravedad y rebotan contra los bloques.
   * Ojo: acelera hacia el jugador y se pasa de largo. Avispa: revolotea y se lanza en picada.
   * Murciélago: vuelo nervioso que cambia de rumbo a cada rato.
   */
  _fly(dt, player, near) {
    const def = this.def;
    const tx = player.centerX;
    const ty = player.y + player.h * 0.4;
    let ax = 0;
    let ay = 0;
    let max = def.speed;
    if (!near) {
      // Sin jugador cerca: deambula
      ax = Math.sin(this.time * 0.7) * 120;
      ay = Math.cos(this.time * 1.1) * 80;
    } else if (def.flyer === 'eye') {
      ax = Math.sign(tx - this.centerX) * 260;
      ay = Math.sign(ty - this.centerY) * 160;
    } else if (def.flyer === 'wasp') {
      this.dashTimer -= dt;
      if (this.dashing > 0) {
        this.dashing -= dt;
        max = def.speed * 2.3;
      } else if (this.dashTimer <= 0) {
        // Picada directa hacia el jugador
        const d = Math.hypot(tx - this.centerX, ty - this.centerY) || 1;
        this.vx = ((tx - this.centerX) / d) * def.speed * 2.3;
        this.vy = ((ty - this.centerY) / d) * def.speed * 2.3;
        this.dashing = 0.55;
        this.dashTimer = 2 + Math.random() * 1.5;
      } else {
        // Revolotea a un costado y por encima del jugador
        const hx = tx + (this.centerX < tx ? -1 : 1) * 3.5 * T + Math.sin(this.time * 2.3) * 20;
        const hy = ty - 3 * T + Math.sin(this.time * 3.1) * 16;
        ax = clamp((hx - this.centerX) * 4, -420, 420);
        ay = clamp((hy - this.centerY) * 4, -420, 420);
      }
    } else {
      // Murciélago
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = 0.25 + Math.random() * 0.35;
        this.batJitter = (Math.random() - 0.5) * 2;
      }
      ax = Math.sign(tx - this.centerX) * 300 + (this.batJitter || 0) * 260;
      ay = Math.sign(ty - this.centerY) * 220 - (this.batJitter || 0) * 300;
    }
    if (this.dashing <= 0) {
      this.vx += ax * dt;
      this.vy += ay * dt;
    }
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > max) {
      this.vx *= max / sp;
      this.vy *= max / sp;
    }
    if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
    const bx = this.vx;
    const by = this.vy;
    if (this.moveX(this.vx * dt, false)) this.vx = -bx * 0.6;
    this.moveY(this.vy * dt);
    if (this.vy === 0 && by !== 0) this.vy = -by * 0.6;
    this.onGround = false;
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
    this.dashing = 0;
    this.scene.showFloatingText(this.centerX, this.y - 6, `${damage}`, '#ffb347', 15);
    this.scene.spawnDebris(this.centerX, this.centerY, this.blood, 4);
    audio.play('hit', { x: this.centerX, y: this.centerY });
    if (this.hp <= 0) this.die(true);
  }

  die(byPlayer) {
    this.dead = true;
    if (byPlayer) {
      this.scene.spawnDust(this.centerX, this.y + this.h, 10);
      this.scene.spawnDebris(this.centerX, this.centerY, this.blood, 10);
      audio.play(this.type === 'slime' ? 'slimeDie' : 'enemyDie', { x: this.centerX, y: this.centerY });
      this.manager.giveDrops(this);
      // Experiencia: más por los enemigos fuertes (y los de las zonas lejanas)
      this.scene.gainXp?.(Math.max(3, Math.round(this.maxHp * 0.5 + this.damage * 0.3)), this.centerX, this.y - 8);
    }
    this.destroy();
  }

  sync() {
    const def = this.def;
    const s = this.sprite;
    let frame = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    if (this.type === 'slime') {
      // 0 quieto (respira), 1 aplastado (antes de saltar / al caer), 2 estirado (en el aire)
      if (!this.onGround) frame = 2;
      else if (this.aiTimer < 0.15 || this.landTimer > 0) frame = 1;
      else sy = 1 + Math.sin(this.time * 5) * 0.05;
    } else if (def.flyer) {
      frame = Math.floor(this.time * def.animFps) % this.manager.frames[this.type];
      // El ojo mira hacia donde va
      if (def.flyer === 'eye') rot = Math.atan2(this.vy, Math.abs(this.vx) + 1) * (this.facing < 0 ? -1 : 1) * 0.8;
    } else if (def.walkFrames) {
      frame = this.onGround && Math.abs(this.vx) > 10 ? Math.floor(this.time * 10) % def.walkFrames : 0;
    } else {
      // 0-3 caminar, 4 golpeado
      frame = this.hurtTimer > 0 ? 4 : this.onGround && Math.abs(this.vx) > 10 ? Math.floor(this.time * 7) % 4 : 0;
    }
    if (this.manager.frames[this.type] > frame) s.setFrame(frame, false, false);
    s.setScale((def.spriteW / s.frame.width) * sx, (def.spriteH / s.frame.height) * sy)
      .setPosition(this.centerX, def.flyer ? this.centerY : this.y + this.h)
      .setRotation(rot)
      .setFlipX(this.facing < 0);
    if (this.hurtTimer > 0) s.setTintFill(0xffffff);
    else if (this.tint !== 0xffffff) s.setTint(this.tint);
    else s.clearTint();
    // Barra de vida (solo si está herido)
    const hurt = this.hp < this.maxHp;
    this.barBg.setVisible(hurt);
    this.bar.setVisible(hurt);
    if (hurt) {
      const top = def.flyer ? this.centerY - def.spriteH / 2 - 8 : this.y + this.h - def.spriteH - 8;
      this.barBg.setPosition(this.centerX, top);
      this.bar.setPosition(this.centerX - 14, top).setSize(28 * Math.max(0, this.hp / this.maxHp), 3);
      this.bar.setFillStyle(this.hp / this.maxHp > 0.4 ? 0x6ee06e : 0xe05050);
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

  spawn(type, x, y, opts = {}) {
    const e = new Enemy(this, type, x, y, opts);
    this.list.push(e);
    return e;
  }

  update(dt) {
    const p = this.player;
    const night = this.dayNight.isNight();

    // Aparecer (en las zonas peligrosas aparecen más y más seguido)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !p.dead) {
      const danger = this.levelOf(Math.floor(p.centerX / T));
      this.spawnTimer = (night ? 1.5 + Math.random() * 2.5 : 4 + Math.random() * 5) / (1 + (danger - 1) * 0.25);
      const max = (night ? 6 : 2) + danger - 1;
      if (this.list.length < max) this.trySpawn(night);
    }

    for (const e of this.list) {
      if (e.dead) continue; // murió en este mismo frame (golpe de espada)
      e.update(dt, p, night);
      // Daño por contacto (el jugador queda invulnerable un momento después de cada golpe)
      if (!p.dead && e.overlaps(p)) p.hit(e.damage, e.centerX);
      if (e.dead) continue;
      // Muy lejos (o zombi de día fuera de la pantalla): desaparece
      const dist = Math.abs(e.centerX - p.centerX) / T;
      if (dist > DESPAWN_DIST || (e.def.nightOnly && !night && dist > SPAWN_MIN) || e.y > this.world.height * T) {
        e.die(false);
      }
    }
    if (this.list.some((e) => e.dead)) this.list = this.list.filter((e) => !e.dead);
  }

  /** Nivel de peligro de la zona de una columna (1 = Bosque … 4 = las zonas más lejanas). */
  levelOf(tx) {
    const gen = this.world.generator;
    const b = gen.biome[Math.max(0, Math.min(gen.biome.length - 1, tx))];
    return BIOME_INFO[b].danger;
  }

  /** Busca un lugar libre fuera de la pantalla y elige un enemigo típico de esa zona. */
  trySpawn(night) {
    const p = this.player;
    const gen = this.world.generator;
    const ptx = Math.floor(p.centerX / T);
    const pty = Math.floor(p.centerY / T);
    const underground = pty > gen.surface[Math.max(0, Math.min(gen.surface.length - 1, ptx))] + 12;
    for (let attempt = 0; attempt < 12; attempt++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = ptx + side * (SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN)));
      if (tx < 2 || tx >= this.world.width - 2) continue;
      const biome = gen.biome[tx];
      const level = BIOME_INFO[biome].danger;
      let type = 'slime';
      let kind = CAVE_SLIME[biome];
      if (!underground) {
        const pick = pickWeighted(SPAWN_TABLE[biome][night ? 'night' : 'day']);
        type = pick[0];
        kind = pick[2];
      }
      const def = ENEMY_TYPES[type];
      const hTiles = Math.ceil(def.h / T);
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
      // Los voladores aparecen en el aire, unos bloques arriba del suelo
      if (def.flyer) floor -= 3 + Math.floor(Math.random() * 5);
      if (!this._freeColumn(tx, floor, hTiles)) continue;
      const x = tx * T + (T - def.w) / 2;
      const y = floor * T - def.h;
      const tint = type === 'zombie' ? ZOMBIE_TINTS[biome] : type === 'eye' && biome === BIOME.CRYSTAL ? 0xffb8f8 : undefined;
      return this.spawn(type, x, y, { kind, level, tint });
    }
    return null;
  }

  /** ¿Hay lugar libre sobre el suelo, sin paredes del jugador ni muebles? (dentro de casas no aparecen) */
  _freeColumn(tx, floor, hTiles) {
    for (let k = 1; k <= hTiles; k++) {
      const ty = floor - k;
      const id = this.world.getTile(tx, ty);
      if (id !== BLOCK.AIR && !IS_PLANT[id]) return false; // también descarta muebles
      // Pared puesta por el jugador = dentro de una casa (las naturales de las cuevas no cuentan)
      if (this.world.hasPlayerWall(tx, ty)) return false;
    }
    return true;
  }

  /**
   * Golpe cuerpo a cuerpo: daña a los enemigos delante del jugador. Devuelve cuántos golpeó.
   * Espada/daga/maza: zona delante del jugador. Lanza: a lo largo de la estocada (angle).
   */
  meleeHit(player, weapon, angle = player.facing > 0 ? 0 : Math.PI) {
    const f = player.facing;
    const reach = weapon.reach;
    const box = {
      x: f > 0 ? player.centerX - 6 : player.centerX - reach,
      y: player.y - 12,
      w: reach + 6,
      h: player.h + 16,
    };
    const thrust = weapon.kind === 'thrust';
    const ox = player.centerX;
    const oy = player.y + 22;
    const touched = (e) => {
      if (!thrust) return e.overlaps(box);
      // Puntos a lo largo de la lanza
      for (let d = 10; d <= reach; d += 10) {
        const px = ox + Math.cos(angle) * d;
        const py = oy + Math.sin(angle) * d;
        if (px > e.x - 4 && px < e.x + e.w + 4 && py > e.y - 4 && py < e.y + e.h + 4) return true;
      }
      return false;
    };
    let hits = 0;
    for (const e of this.list) {
      if (e.dead || !touched(e)) continue;
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
      if (n > 0) this.scene.drops.spawn(id, n, e.centerX, e.centerY); // cae al suelo donde murió
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
