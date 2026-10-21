import Phaser from 'phaser';
import { TILE_SIZE, DEPTH, WORLD_WIDTH, WORLD_HEIGHT } from '../config.js';
import { BIOME, ZONE } from '../world/WorldGenerator.js';
import { BLOCK } from '../world/blocks.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const GRAVITY = 1400;
const MAX_CRITTERS = 9;
const SPAWN_EVERY = 1.6; // segundos entre intentos de aparición
const FLEE_DIST = 5 * T; // se asustan si te acercas a menos de esto
const DESPAWN_DIST = 55 * T;

/**
 * Tipos de bichos. move: bird (camina, picotea y vuela), hopper (salta), walker (camina),
 * flutter (revolotea), soar (planea en círculos alto). size = tamaño en pantalla (px).
 * frames: cuadros de cada estado. glow: brilla en la oscuridad. sound: lo que se oye de vez en cuando.
 */
const KINDS = {
  bird: { tex: 'critter_bird', move: 'bird', size: [24, 20], sound: 'chirp' },
  parrot: { tex: 'critter_parrot', move: 'bird', size: [24, 20], sound: 'chirp' },
  crow: { tex: 'critter_crow', move: 'bird', size: [24, 20], sound: 'crow' },
  snowbird: { tex: 'critter_snowbird', move: 'bird', size: [24, 20], sound: 'chirp' },
  gull: { tex: 'critter_gull', move: 'bird', size: [24, 20], sound: 'gull' },
  bunny: { tex: 'critter_bunny', move: 'hopper', size: [28, 24], hop: [-330, 110] },
  frog: { tex: 'critter_frog', move: 'hopper', size: [24, 20], hop: [-420, 130], sound: 'croak' },
  penguin: { tex: 'critter_penguin', move: 'walker', size: [20, 24], speed: 35 },
  lizard: { tex: 'critter_lizard', move: 'walker', size: [32, 16], speed: 70, dart: true },
  mouse: { tex: 'critter_mouse', move: 'walker', size: [24, 16], speed: 60, dart: true },
  snail: { tex: 'critter_snail', move: 'walker', size: [24, 18], speed: 8, glow: 0x6ab8ff, calm: true },
  butterfly: { tex: 'critter_butterfly', move: 'flutter', size: [16, 16] },
  crystalfly: { tex: 'critter_crystalfly', move: 'flutter', size: [16, 16], glow: 0xff9ee8 },
  emberfly: { tex: 'critter_emberfly', move: 'flutter', size: [16, 16], glow: 0xff8a30 },
  vulture: { tex: 'critter_vulture', move: 'soar', size: [44, 20], calm: true },
};

// Qué bichos hay en cada zona de la superficie (de día / de noche), en cuevas y en las zonas especiales
const SURFACE = {
  [BIOME.FOREST]: { day: ['bird', 'bird', 'bunny', 'butterfly', 'butterfly'], night: ['bunny'] },
  [BIOME.DESERT]: { day: ['lizard', 'lizard', 'vulture'], night: ['lizard'] },
  [BIOME.SNOW]: { day: ['penguin', 'snowbird', 'snowbird', 'bunny'], night: ['penguin'] },
  [BIOME.JUNGLE]: { day: ['parrot', 'parrot', 'frog', 'butterfly'], night: ['frog', 'frog'] },
  [BIOME.SHADOW]: { day: ['crow', 'crow'], night: ['crow'] },
  [BIOME.CRYSTAL]: { day: ['crystalfly', 'crystalfly', 'bunny'], night: ['crystalfly', 'crystalfly'] },
  [BIOME.VOLCANO]: { day: ['emberfly', 'lizard'], night: ['emberfly', 'emberfly'] },
};
const SPECIAL = { [ZONE.SKY]: ['gull', 'gull', 'butterfly'], [ZONE.MUSHROOM]: ['snail', 'snail'], [ZONE.UNDERWORLD]: ['emberfly'] };
const CAVE = ['mouse', 'mouse', 'snail'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

class Critter {
  constructor(manager, kind, x, y) {
    this.m = manager;
    this.kind = kind;
    this.def = KINDS[kind];
    const [w, h] = this.def.size;
    this.w = w;
    this.h = h;
    this.x = x; // centro
    this.y = y; // pies
    this.vx = 0;
    this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.onGround = false;
    this.state = this.def.move === 'flutter' || this.def.move === 'soar' ? 'fly' : 'ground';
    this.timer = rand(0.5, 2);
    this.time = Math.random() * 10;
    this.home = { x, y }; // para revolotear o planear alrededor
    this.fleeing = false;
    this.soundTimer = rand(2, 8);
    const scene = manager.scene;
    this.sprite = scene.add.image(x, y, this.def.tex, 0).setOrigin(0.5, 1).setDepth(DEPTH.ENEMY - 0.5);
    this.sprite.setDisplaySize(w, h);
    if (this.def.glow) {
      this.glow = scene.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.LIGHT + 0.5).setTint(this.def.glow).setScale(0.35).setAlpha(0.5);
    }
  }

  // --------------------------------------------------------- física simple

  _solid(px, py) {
    return this.m.world.isSolid(Math.floor(px / T), Math.floor(py / T));
  }

  /** Cae y choca con el suelo; si choca de costado, se da vuelta (o salta). */
  _physics(dt, gravity = true) {
    if (gravity) this.vy = Math.min(this.vy + GRAVITY * dt, 900);
    const nx = this.x + this.vx * dt;
    const side = nx + Math.sign(this.vx) * (this.w / 2 - 2);
    if (this.vx !== 0 && (this._solid(side, this.y - 4) || this._solid(side, this.y - this.h + 4))) {
      this.vx = -this.vx * 0.5;
      this.dir = -this.dir;
    } else this.x = nx;
    const ny = this.y + this.vy * dt;
    this.onGround = false;
    if (this.vy >= 0 && (this._solid(this.x - 4, ny) || this._solid(this.x + 4, ny))) {
      this.y = Math.floor(ny / T) * T;
      this.vy = 0;
      this.onGround = true;
    } else if (this.vy < 0 && this._solid(this.x, ny - this.h)) {
      this.vy = 0;
    } else this.y = ny;
  }

  // --------------------------------------------------------- comportamiento

  update(dt, player) {
    this.time += dt;
    this.timer -= dt;
    const dx = this.x - player.centerX;
    const dy = this.y - (player.y + player.h);
    const dist = Math.hypot(dx, dy);
    const scared = !this.def.calm && dist < FLEE_DIST && !player.dead;
    const away = Math.sign(dx) || 1;
    let frame = 0;
    switch (this.def.move) {
      case 'bird':
        frame = this._bird(dt, scared, away);
        break;
      case 'hopper':
        frame = this._hopper(dt, scared, away);
        break;
      case 'walker':
        frame = this._walker(dt, scared, away);
        break;
      case 'flutter':
        frame = this._flutter(dt, scared, away);
        break;
      default:
        frame = this._soar(dt);
    }
    // De vez en cuando se lo oye (si estás cerca)
    this.soundTimer -= dt;
    if (this.soundTimer <= 0) {
      this.soundTimer = rand(4, 10);
      if (this.def.sound && dist < 18 * T) audio.play(this.def.sound, { x: this.x, y: this.y - this.h / 2 });
    }
    this.sprite.setFrame(frame).setPosition(Math.round(this.x), Math.round(this.y)).setFlipX(this.dir < 0);
    this.glow?.setPosition(this.x, this.y - this.h / 2).setAlpha(0.4 + Math.sin(this.time * 3) * 0.12);
    return dist < DESPAWN_DIST && this.y < WORLD_HEIGHT * T;
  }

  _bird(dt, scared, away) {
    if (this.state === 'ground') {
      if (scared || this.timer <= 0 && Math.random() < 0.25) {
        // Levanta vuelo (lejos del jugador si se asustó)
        this.state = 'fly';
        this.fleeing = scared;
        this.dir = scared ? away : Math.random() < 0.5 ? -1 : 1;
        this.vy = -260;
        this.timer = scared ? rand(3, 5) : rand(1.5, 3);
        audio.play('flap', { x: this.x, y: this.y });
        return 2;
      }
      this._physics(dt);
      if (this.timer <= 0) {
        this.timer = rand(0.6, 1.8);
        // Picotea o da un saltito
        if (Math.random() < 0.5 && this.onGround) {
          this.vy = -150;
          this.vx = this.dir * 50;
        } else this.dir = Math.random() < 0.5 ? -1 : 1;
      }
      if (this.onGround) this.vx *= 0.8;
      return this.onGround ? (Math.sin(this.time * 5) > 0.6 ? 1 : 0) : 2;
    }
    // Volando: aleteo, sube un poco y después busca dónde posarse
    this.vx = this.dir * (this.fleeing ? 170 : 120);
    const climb = this.timer > 0 ? -60 + Math.sin(this.time * 4) * 40 : 90;
    this.vy += (climb - this.vy) * Math.min(1, dt * 3);
    this._physics(dt, false);
    if (this.timer <= 0 && this.onGround) {
      this.state = 'ground';
      this.fleeing = false;
      this.timer = rand(1, 3);
    }
    return Math.floor(this.time * 12) % 2 ? 2 : 3;
  }

  _hopper(dt, scared, away) {
    const [jump, speed] = this.def.hop;
    if (this.onGround && (this.timer <= 0 || scared)) {
      this.timer = scared ? rand(0.15, 0.35) : rand(1, 3.5);
      if (scared) this.dir = away;
      else if (Math.random() < 0.35) this.dir = -this.dir;
      if (scared || Math.random() < 0.7) {
        this.vy = jump * (scared ? 1.1 : rand(0.7, 1));
        this.vx = this.dir * speed * (scared ? 1.6 : 1);
        if (this.def.sound && Math.random() < 0.3) audio.play(this.def.sound, { x: this.x, y: this.y });
      }
    }
    this._physics(dt);
    if (this.onGround) this.vx *= 0.7;
    if (!this.onGround) return this.kind === 'frog' ? 1 : 2;
    return this.timer < 0.25 ? (this.kind === 'frog' ? 0 : 1) : 0;
  }

  _walker(dt, scared, away) {
    if (this.timer <= 0) {
      this.timer = rand(1, 3);
      this.walking = Math.random() < 0.6;
      if (Math.random() < 0.4) this.dir = -this.dir;
    }
    if (scared) {
      this.dir = away;
      this.walking = true;
    }
    const speed = this.def.speed * (scared && this.def.dart ? 2.5 : 1);
    this.vx = this.walking && this.onGround ? this.dir * speed : this.onGround ? 0 : this.vx;
    this._physics(dt);
    // Borde de un precipicio: se da vuelta en vez de caerse
    if (this.onGround && !this._solid(this.x + this.dir * (this.w / 2 + 2), this.y + 4) && !scared) this.dir = -this.dir;
    return this.walking ? Math.floor(this.time * (speed / 8 + 2)) % 2 : 0;
  }

  _flutter(dt, scared, away) {
    // Revolotea alrededor de su lugar; si te acercas se aleja
    if (scared) {
      this.home.x += away * 60 * dt;
      this.home.y -= 30 * dt;
    }
    const tx = this.home.x + Math.sin(this.time * 0.7) * 40 + Math.sin(this.time * 2.3) * 12;
    const ty = this.home.y - 30 + Math.sin(this.time * 1.1) * 18 + Math.sin(this.time * 3.1) * 6;
    this.dir = tx > this.x ? 1 : -1;
    this.x += (tx - this.x) * Math.min(1, dt * 2);
    this.y += (ty - this.y) * Math.min(1, dt * 2);
    return Math.floor(this.time * 10) % 2;
  }

  _soar(dt) {
    // Planea en círculos amplios, alto en el cielo
    const a = this.time * 0.35;
    this.x = this.home.x + Math.cos(a) * 160;
    this.y = this.home.y - 6 * T + Math.sin(a * 2) * 24;
    this.dir = -Math.sin(a) >= 0 ? 1 : -1;
    return Math.sin(this.time * 2) > 0.85 ? 1 : 0;
  }

  destroy() {
    this.sprite.destroy();
    this.glow?.destroy();
  }
}

/**
 * Fauna: pájaros, conejos, ranas, mariposas y otros bichos inofensivos que aparecen cerca
 * del jugador según la zona y la hora (y huyen si te acercas). No se guardan: van y vienen.
 */
export class Critters {
  constructor(scene, world, player, dayNight, zones) {
    this.scene = scene;
    this.world = world;
    this.gen = world.generator;
    this.player = player;
    this.dayNight = dayNight;
    this.zones = zones;
    this.list = [];
    this.timer = 1;
  }

  /** Qué bichos pueden aparecer donde está el jugador. */
  _choices() {
    const p = this.player;
    const tx = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(p.centerX / T)));
    const ty = Math.floor(p.centerY / T);
    const zone = this.gen.zoneAt(tx, ty);
    if (SPECIAL[zone]) return { list: SPECIAL[zone], under: zone === ZONE.MUSHROOM || zone === ZONE.UNDERWORLD };
    const depth = ty - this.gen.surface[tx];
    if (depth > 12) return { list: CAVE, under: true };
    const table = SURFACE[zone] || SURFACE[BIOME.FOREST];
    return { list: this.dayNight.isNight() ? table.night : table.day, under: false };
  }

  /** Busca dónde poner un bicho: en la superficie (sobre un bloque) o en el piso de una cueva. */
  _spot(kind, under) {
    const p = this.player;
    const def = KINDS[kind];
    for (let tries = 0; tries < 8; tries++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = Math.floor(p.centerX / T + side * rand(10, 26));
      if (tx < 2 || tx > WORLD_WIDTH - 3) continue;
      let ty;
      if (under) {
        // Piso de cueva cerca de la altura del jugador
        const py = Math.floor(p.centerY / T);
        ty = -1;
        for (let y = py - 8; y < py + 10; y++) {
          if (!this.world.isSolid(tx, y) && !this.world.isSolid(tx, y - 1) && this.world.isSolid(tx, y + 1)) {
            ty = y + 1;
            break;
          }
        }
        if (ty < 0) continue;
      } else {
        // El primer bloque sólido bajando desde arriba de la superficie (sirve sobre las islas también)
        const from = Math.max(1, Math.floor(p.centerY / T) - 14);
        ty = -1;
        for (let y = from; y < Math.min(WORLD_HEIGHT - 1, from + 40); y++) {
          if (this.world.isSolid(tx, y) && !this.world.isSolid(tx, y - 1)) {
            ty = y;
            break;
          }
        }
        if (ty < 0) continue;
        if (this.world.getTile(tx, ty - 1) === BLOCK.LAVA) continue; // nada de bichos en la lava
      }
      const x = (tx + 0.5) * T;
      const y = ty * T;
      if (def.move === 'flutter') return [x, y - rand(1, 3) * T];
      return [x, y];
    }
    return null;
  }

  update(dt) {
    const p = this.player;
    this.list = this.list.filter((c) => {
      const keep = c.update(dt, p);
      if (!keep) c.destroy();
      return keep;
    });
    this.timer -= dt;
    if (this.timer > 0 || p.dead) return;
    this.timer = SPAWN_EVERY;
    const { list, under } = this._choices();
    if (!list.length || this.list.length >= (under ? 4 : MAX_CRITTERS)) return;
    const kind = pick(list);
    // Pocos buitres y no amontonados
    if (KINDS[kind].move === 'soar' && this.list.some((c) => c.def.move === 'soar')) return;
    const spot = this._spot(kind, under);
    if (spot) this.spawn(kind, spot[0], spot[1]);
  }

  spawn(kind, x, y) {
    const c = new Critter(this, kind, x, y);
    this.list.push(c);
    return c;
  }

  clear() {
    for (const c of this.list) c.destroy();
    this.list = [];
  }

  destroy() {
    this.clear();
  }
}
