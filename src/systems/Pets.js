import { TILE_SIZE, DEPTH, WORLD_WIDTH } from '../config.js';
import { BIOME } from '../world/WorldGenerator.js';
import { Enemy, ENEMY_TYPES } from './Enemies.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const GRAVITY = 1500;
const MAX_PETS = 3;
const TELEPORT_DIST = 28 * T; // si quedó muy lejos (o atrapado), aparece al lado del jugador
const KO_TIME = 30; // segundos desmayada antes de volver

/**
 * Mascotas que se pueden domesticar. bones = huesos que hay que darle.
 * hp/damage crecen con el nivel (1-10). frames de la hoja: 0 sentado, 1-2 corriendo, 3 saltando, 4 mordiendo.
 */
export const PET_TYPES = {
  dog: { name: 'Perro', texture: 'pet_dog', w: 26, h: 20, spriteW: 36, spriteH: 28, hp: 60, damage: 8, speed: 210, bones: 1, names: ['Firulais', 'Rocky', 'Toby', 'Canela', 'Max', 'Luna'], bark: 'bark', blood: 0xb07a4a },
  wolf: { name: 'Lobo', texture: 'pet_wolf', w: 30, h: 22, spriteW: 44, spriteH: 32, hp: 90, damage: 14, speed: 240, bones: 3, names: ['Colmillo', 'Sombra', 'Nieve', 'Aullido', 'Lobo Gris'], bark: 'growl', blood: 0x8a8a90 },
};
// Se registran como tipos de enemigo solo para usar la misma física (no aparecen como enemigos)
for (const [id, d] of Object.entries(PET_TYPES)) ENEMY_TYPES[`pet_${id}`] = { ...d, resist: 0.3, drops: [], pet: true };

// Órdenes: lo que hace cuando se lo mandas
export const PET_MODES = {
  follow: { label: 'Sígueme', desc: 'Te sigue y te defiende si te atacan cerca' },
  stay: { label: 'Quieto', desc: 'Se queda donde está y cuida ese lugar' },
  attack: { label: '¡Ataca!', desc: 'Va a buscar a los enemigos cercanos' },
  home: { label: 'A casa', desc: 'Vuelve a tu casa y te espera ahí' },
};

const rand = (a, b) => a + Math.random() * (b - a);
const xpForPetLevel = (lvl) => 30 + lvl * 25;

/** Un perro o lobo: salvaje (hasta que lo domesticas) o tu compañero. */
class Pet extends Enemy {
  constructor(manager, kind, x, y, data = {}) {
    super(manager, `pet_${kind}`, x, y, {});
    this.kind = kind;
    this.pdef = PET_TYPES[kind];
    this.tame = !!data.tame;
    this.name = data.name || this.pdef.name;
    this.level = Math.max(1, Math.min(10, data.level | 0 || 1));
    this.xp = data.xp | 0;
    this.mode = PET_MODES[data.mode] ? data.mode : 'follow';
    this.stayAt = data.stayAt || null; // { x, y } donde se quedó
    this.ko = 0; // segundos desmayada
    this.maxHp = this.statHp;
    this.hp = Math.min(this.maxHp, data.hp ?? this.maxHp);
    this.target = null;
    this.biteTimer = 0;
    this.biting = 0;
    this.hurtCd = 0;
    this.jumpCd = 0;
    this.idleTimer = rand(1, 3);
    this.wanderDir = 0;
    this.heartTimer = 0;
    this.sprite.setDepth(DEPTH.PLAYER - 0.2);
    this.barBg.setVisible(false);
    this.bar.setVisible(false);
    // Nombre arriba (solo las domesticadas)
    this.label = this.scene.add
      .text(0, 0, '', { fontFamily: 'Pixelify Sans, monospace', fontSize: '11px', color: '#ffe8a8', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.FLOATING_TEXT - 0.5);
  }

  get statHp() {
    return Math.round(this.pdef.hp * (1 + 0.15 * (this.level - 1)));
  }

  get statDamage() {
    return Math.round(this.pdef.damage * (1 + 0.15 * (this.level - 1)));
  }

  hit(damage, knockback, fromX) {
    this.hurt(damage, fromX ?? this.centerX);
  }

  hurt(damage, fromX) {
    if (this.ko > 0 || this.hurtCd > 0) return;
    this.hurtCd = 0.7;
    this.hp -= damage;
    this.hurtTimer = 0.15;
    this.vx = (Math.sign(this.centerX - fromX) || 1) * 220;
    this.vy = -260;
    this.onGround = false;
    this.scene.showFloatingText(this.centerX, this.y - 6, `-${damage}`, '#ff9a9a', 13);
    audio.play('whine', { x: this.centerX, y: this.centerY });
    if (this.hp <= 0) {
      this.hp = 0;
      this.ko = KO_TIME;
      this.target = null;
      this.scene.events.emit('toast', `${this.name} se desmayó: vuelve en ${KO_TIME} s`);
    }
  }

  gainXp(n) {
    if (!this.tame || this.level >= 10) return;
    this.xp += n;
    while (this.level < 10 && this.xp >= xpForPetLevel(this.level)) {
      this.xp -= xpForPetLevel(this.level);
      this.level++;
      this.maxHp = this.statHp;
      this.hp = this.maxHp;
      this.scene.showFloatingText(this.centerX, this.y - 14, `¡${this.name} subió a nivel ${this.level}!`, '#ffe28a', 14);
      this.scene.spawnSparkles(this.centerX, this.centerY, 12);
    }
  }

  // ---------------------------------------------------------------- IA

  update(dt, player, enemies) {
    this.dt = dt;
    this.time += dt;
    this.hurtTimer -= dt;
    this.hurtCd -= dt;
    this.biteTimer -= dt;
    this.biting -= dt;
    this.jumpCd -= dt;
    if (this.ko > 0) {
      // Desmayada: tirada, no se mueve; al terminar vuelve con media vida al lado del jugador
      this.ko -= dt;
      this.vx = 0;
      this._physics(dt);
      if (this.ko <= 0) {
        this.hp = Math.round(this.maxHp / 2);
        if (this.tame) this.warpTo(player);
      }
      this.sync();
      return;
    }
    // Se cura de a poco
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.015 * dt);
    if (this.tame) this._tameAI(dt, player, enemies);
    else this._wildAI(dt, player);
    this._physics(dt);
    this.sync();
  }

  _physics(dt) {
    this.vy = Math.min(this.vy + GRAVITY * dt, 1100);
    const blocked = this.moveX(this.vx * dt, true);
    this.moveY(this.vy * dt);
    // Contra una pared: salta
    if (blocked && this.onGround && this.jumpCd <= 0 && Math.abs(this.wantVx || 0) > 20) {
      this.vy = -620;
      this.jumpCd = 0.4;
    }
  }

  _run(targetX, speed, stopDist = 24) {
    const dx = targetX - this.centerX;
    const want = Math.abs(dx) < stopDist ? 0 : Math.sign(dx) * speed;
    this.wantVx = want;
    if (want !== 0) this.facing = Math.sign(want);
    const accel = this.onGround ? 14 : 4;
    this.vx += (want - this.vx) * Math.min(1, accel * this.dt);
    // Un hueco de un bloque o algo bajo adelante: salta
    if (want !== 0 && this.onGround && this.jumpCd <= 0) {
      const tx = Math.floor((this.centerX + this.facing * (this.w / 2 + 6)) / T);
      const feet = Math.floor((this.y + this.h + 2) / T);
      if (!this.world.isSolid(tx, feet) && !this.world.isSolid(tx, feet + 1) && Math.abs(dx) > 3 * T) {
        this.vy = -520;
        this.jumpCd = 0.5;
      }
    }
  }

  /** Salvaje: pasea; el perro se acerca curioso, el lobo guarda distancia. */
  _wildAI(dt, player) {
    const dx = player.centerX - this.centerX;
    const dist = Math.abs(dx);
    this.idleTimer -= dt;
    if (this.kind === 'wolf' && dist < 5 * T) this._run(this.centerX - Math.sign(dx) * 6 * T, 160);
    else if (this.kind === 'dog' && dist < 12 * T && dist > 3 * T) this._run(player.centerX, 90);
    else {
      if (this.idleTimer <= 0) {
        this.idleTimer = rand(1.5, 4);
        this.wanderDir = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? -1 : 1;
      }
      this._run(this.centerX + this.wanderDir * 3 * T, 60);
    }
    this.heartTimer -= dt;
    if (this.heartTimer <= 0 && dist < 18 * T) {
      this.heartTimer = rand(4, 9);
      // De noche el lobo aúlla
      const night = this.kind === 'wolf' && this.scene.dayNight.isNight();
      audio.play(night ? 'howl' : this.pdef.bark, { x: this.centerX, y: this.centerY });
    }
  }

  /** Domesticada: obedece la orden y muerde a los enemigos cercanos. */
  _tameAI(dt, player, enemies) {
    const scene = this.scene;
    // Dónde tiene que estar según la orden
    let anchorX = player.centerX - player.facing * 1.5 * T;
    let anchorY = player.centerY;
    let guardRange = 6 * T; // a qué distancia de su lugar sale a morder
    if (this.mode === 'stay' && this.stayAt) {
      anchorX = this.stayAt.x;
      anchorY = this.stayAt.y;
      guardRange = 7 * T;
    } else if (this.mode === 'home') {
      const h = scene.homeSpot();
      anchorX = h.x + T;
      anchorY = h.y;
      guardRange = 7 * T;
    } else if (this.mode === 'attack') guardRange = 15 * T;
    // Perdida o muy lejos: aparece al lado (o en casa)
    if (Math.hypot(anchorX - this.centerX, anchorY - this.centerY) > TELEPORT_DIST && this.mode !== 'stay') {
      if (this.mode === 'home') this.warpTo({ centerX: anchorX, y: anchorY - this.h, h: this.h });
      else this.warpTo(player);
      return;
    }
    // Elegir a quién morder: el más cercano a su lugar (en "Sígueme", solo si está cerca de ti;
    // en "¡Ataca!", cualquiera cerca de la mascota)
    const sx = this.mode === 'attack' ? this.centerX : anchorX;
    const sy = this.mode === 'attack' ? this.centerY : anchorY;
    if (!this.target || this.target.dead || Math.abs(this.target.centerX - sx) > guardRange * 1.5) {
      this.target = null;
      let best = guardRange;
      for (const e of enemies) {
        if (e.dead || e.def.pet) continue;
        const d = Math.hypot(e.centerX - sx, e.centerY - sy);
        if (d < best) {
          best = d;
          this.target = e;
        }
      }
    }
    const t = this.target;
    if (t) {
      this._run(t.centerX, this.pdef.speed * 1.15, 6);
      // Si el enemigo está arriba, salta
      if (this.onGround && this.jumpCd <= 0 && t.centerY < this.y - T && Math.abs(t.centerX - this.centerX) < 3 * T) {
        this.vy = -640;
        this.jumpCd = 0.6;
      }
      if (this.biteTimer <= 0 && this.overlaps({ x: t.x - 8, y: t.y - 6, w: t.w + 16, h: t.h + 12 })) {
        this.biteTimer = 0.8;
        this.biting = 0.25;
        const dmg = Math.round(this.statDamage * rand(0.85, 1.15));
        const wasDead = t.dead;
        t.hit(dmg, 160, this.centerX);
        audio.play(this.pdef.bark === 'growl' ? 'growl' : 'bark', { x: this.centerX, y: this.centerY });
        if (!wasDead && t.dead) this.gainXp(Math.max(5, Math.round(t.maxHp * 0.6)));
        else this.gainXp(1);
      }
      return;
    }
    // Sin enemigos: va a su lugar (sentado si ya llegó)
    const far = Math.abs(anchorX - this.centerX);
    const speed = this.mode === 'follow' ? Math.min(this.pdef.speed * (far > 8 * T ? 1.6 : 1), 400) : this.pdef.speed * 0.8;
    this._run(anchorX, speed, this.mode === 'follow' ? 1.2 * T : 10);
    // Si el jugador está más arriba y quieto, salta para alcanzarlo
    if (this.mode === 'follow' && this.onGround && this.jumpCd <= 0 && anchorY < this.y - 1.5 * T && far < 4 * T) {
      this.vy = -700;
      this.jumpCd = 0.8;
    }
    // Contenta: de vez en cuando ladra o mueve la cola
    this.heartTimer -= dt;
    if (this.heartTimer <= 0) {
      this.heartTimer = rand(10, 20);
      if (Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY) < 10 * T) audio.play(this.pdef.bark, { x: this.centerX, y: this.centerY, vol: 0.6 });
    }
  }

  warpTo(o) {
    this.x = o.centerX - this.w / 2;
    this.y = o.y + o.h - this.h;
    this.vx = 0;
    this.vy = 0;
    this.target = null;
    this.scene.spawnSparkles(this.centerX, this.centerY, 8, 0xfff2a0);
  }

  // ---------------------------------------------------------------- dibujo

  sync() {
    if (!this.label) return; // (lo llama el constructor de Enemy antes de terminar de armarla)
    const def = this.def;
    const s = this.sprite;
    let frame = 0;
    if (this.ko > 0) frame = 0;
    else if (this.biting > 0) frame = 4;
    else if (!this.onGround) frame = 3;
    else if (Math.abs(this.vx) > 25) frame = 1 + (Math.floor(this.time * (6 + Math.abs(this.vx) / 30)) % 2);
    if (this.manager.frames[this.type] > frame) s.setFrame(frame, false, false);
    s.setScale(def.spriteW / s.frame.width, def.spriteH / s.frame.height)
      .setPosition(this.centerX, this.y + this.h)
      .setFlipX(this.facing < 0)
      .setAngle(this.ko > 0 ? this.facing * 90 : 0)
      .setAlpha(this.ko > 0 ? 0.6 : 1);
    if (this.hurtTimer > 0) s.setTintFill(0xffffff);
    else s.clearTint();
    this.label.setVisible(this.tame).setText(this.tame ? `${this.name}${this.mode !== 'follow' ? ` · ${PET_MODES[this.mode].label}` : ''}` : '');
    this.label.setPosition(this.centerX, this.y - 4);
  }

  serialize() {
    return { kind: this.kind, tame: true, name: this.name, level: this.level, xp: this.xp, hp: Math.round(this.hp), mode: this.mode, stayAt: this.stayAt, x: Math.round(this.x), y: Math.round(this.y) };
  }

  destroy() {
    super.destroy();
    this.label.destroy();
  }
}

/**
 * Mascotas: perros (en el Bosque) y lobos (en la Tundra) salvajes aparecen de vez en cuando;
 * dándoles huesos se vuelven tus compañeros (hasta 3). Te siguen, muerden a los enemigos, suben
 * de nivel y obedecen órdenes: Sígueme, Quieto, ¡Ataca! y A casa.
 */
export class Pets {
  constructor(scene, world, player, enemies, dayNight, saved = []) {
    this.scene = scene;
    this.world = world;
    this.gen = world.generator;
    this.player = player;
    this.enemies = enemies;
    this.dayNight = dayNight;
    this.frames = {};
    for (const id of Object.keys(PET_TYPES)) this.frames[`pet_${id}`] = enemies.frames[`pet_${id}`] || 1;
    this.list = []; // domesticadas
    this.wild = null; // la salvaje que anda cerca (una a la vez)
    this.spawnTimer = 8;
    for (const d of Array.isArray(saved) ? saved.slice(0, MAX_PETS) : []) {
      if (!PET_TYPES[d.kind]) continue;
      const x = Number.isFinite(d.x) ? d.x : player.x;
      const y = Number.isFinite(d.y) ? d.y : player.y;
      this.list.push(new Pet(this, d.kind, x, y, d));
    }
  }

  get count() {
    return this.list.length;
  }

  update(dt) {
    const p = this.player;
    const enemies = this.enemies.list;
    for (const pet of this.list) {
      pet.update(dt, p, enemies);
      // Los enemigos también la lastiman si la tocan
      if (pet.ko <= 0) for (const e of enemies) if (!e.dead && e.overlaps(pet)) pet.hurt(Math.max(1, Math.round(e.damage * 0.5)), e.centerX);
    }
    // Salvaje: aparece, pasea y se va si te alejas mucho
    if (this.wild) {
      this.wild.update(dt, p, enemies);
      if (Math.abs(this.wild.centerX - p.centerX) > 60 * T) this._removeWild();
    } else if (this.list.length < MAX_PETS) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = rand(25, 45);
        this._trySpawnWild();
      }
    }
  }

  /** Perros en el Bosque (de día), lobos en la Tundra (y a veces de noche en el Bosque). */
  _trySpawnWild() {
    const p = this.player;
    const ptx = Math.floor(p.centerX / T);
    if (ptx < 0 || ptx >= WORLD_WIDTH || p.centerY / T > this.gen.surface[ptx] + 6) return; // solo en la superficie
    const biome = this.gen.biome[ptx];
    const night = this.dayNight.isNight();
    let kind = null;
    if (biome === BIOME.FOREST) kind = night ? (Math.random() < 0.5 ? 'wolf' : null) : 'dog';
    else if (biome === BIOME.SNOW) kind = 'wolf';
    else if (biome === BIOME.JUNGLE && !night) kind = Math.random() < 0.3 ? 'dog' : null;
    if (!kind) return;
    for (let tries = 0; tries < 6; tries++) {
      const tx = ptx + (Math.random() < 0.5 ? -1 : 1) * Math.floor(rand(14, 24));
      if (tx < 2 || tx >= WORLD_WIDTH - 2) continue;
      const ty = this.world.skyTop[tx];
      if (this.world.isSolid(tx, ty - 1)) continue;
      this.wild = new Pet(this, kind, tx * T + 2, ty * T - PET_TYPES[kind].h);
      return;
    }
  }

  _removeWild() {
    this.wild?.destroy();
    this.wild = null;
  }

  /** Mascota (domesticada o salvaje) en el punto (x, y) del mundo, o null. */
  at(x, y) {
    const all = this.wild ? [...this.list, this.wild] : this.list;
    return all.find((q) => x > q.x - 10 && x < q.x + q.w + 10 && y > q.y - 14 && y < q.y + q.h + 6) || null;
  }

  /** Intentar domesticar a la salvaje (con huesos). Devuelve un texto para mostrar. */
  tame(pet) {
    const inv = this.scene.inventory;
    const need = pet.pdef.bones;
    if (this.list.length >= MAX_PETS) return `Ya tienes ${MAX_PETS} mascotas`;
    if (inv.count('bone') < need) {
      return `${pet.pdef.name} quiere ${need > 1 ? `${need} huesos` : 'un hueso'} (los sueltan los zombis y los vende el Comerciante)`;
    }
    inv.remove('bone', need);
    pet.tame = true;
    pet.name = pet.pdef.names[Math.floor(Math.random() * pet.pdef.names.length)];
    pet.mode = 'follow';
    pet.hp = pet.maxHp;
    this.list.push(pet);
    this.wild = null;
    this.spawnTimer = rand(40, 70);
    this.scene.spawnSparkles(pet.centerX, pet.centerY, 20, 0xff8aa8);
    audio.play(pet.pdef.bark, { x: pet.centerX, y: pet.centerY });
    this.scene.events.emit('petTamed', pet);
    return null;
  }

  /** Da una orden a una mascota. */
  command(pet, mode) {
    if (!PET_MODES[mode]) return;
    pet.mode = mode;
    pet.target = null;
    pet.stayAt = mode === 'stay' ? { x: pet.centerX, y: pet.centerY } : null;
    if (mode === 'home') this.scene.events.emit('toast', `${pet.name} se va a tu casa`);
    audio.play(pet.pdef.bark, { x: pet.centerX, y: pet.centerY, vol: 0.7 });
  }

  /** Orden para todas a la vez (tecla o botón). */
  commandAll(mode) {
    for (const pet of this.list) this.command(pet, mode);
  }

  /** Acariciarla: corazones y un poco de vida. */
  pat(pet) {
    pet.hp = Math.min(pet.maxHp, pet.hp + pet.maxHp * 0.2);
    this.scene.showFloatingText(pet.centerX, pet.y - 10, '❤', '#ff7a9a', 18);
    this.scene.spawnSparkles(pet.centerX, pet.y, 6, 0xff8aa8);
  }

  /** Dejarla libre. */
  release(pet) {
    this.list = this.list.filter((q) => q !== pet);
    pet.destroy();
  }

  serialize() {
    return this.list.map((p) => p.serialize());
  }

  destroy() {
    for (const p of this.list) p.destroy();
    this._removeWild();
    this.list = [];
  }
}
