import Phaser from 'phaser';
import { TILE_SIZE, DEPTH } from '../config.js';
import { Enemy, ENEMY_TYPES } from './Enemies.js';
import { audio } from './Audio.js';
import { ITEMS } from './items.js';

const T = TILE_SIZE;
const GRAVITY = 1500;
const WAKE_DIST = 13 * T; // a esta distancia del altar despierta el guardián
const LEASH_DIST = 75 * T; // si te alejas tanto, vuelve a dormir
const MAX_MINIONS = 4;

/**
 * Jefes: cada uno vive en su guarida (ver WorldGenerator.lairs) y protege una reliquia.
 * w/h = caja de choque; spriteW/spriteH = tamaño del dibujo. coins en cobre.
 */
export const BOSSES = {
  slime_king: { name: 'Rey Slime', zone: 'bajo el Bosque', relic: 'relic_crown', texture: 'boss_slime_king', w: 84, h: 60, spriteW: 96, spriteH: 72, hp: 700, damage: 18, xp: 600, coins: 30000, blood: 0x4a90f0 },
  scorpion_king: { name: 'Escorpión Rey', zone: 'bajo la pirámide del Desierto', relic: 'relic_stinger', texture: 'boss_scorpion_king', w: 100, h: 46, spriteW: 120, spriteH: 56, hp: 1100, damage: 24, xp: 900, coins: 50000, blood: 0xf0c040 },
  queen_wasp: { name: 'Reina Avispa', zone: 'bajo la Selva', relic: 'relic_hive', texture: 'boss_queen_wasp', w: 76, h: 60, spriteW: 96, spriteH: 80, hp: 1500, damage: 28, xp: 1300, coins: 80000, flyer: true, blood: 0xf2c432 },
  shadow_eye: { name: 'Ojo Sombrío', zone: 'bajo las Tierras Sombrías', relic: 'relic_eye', texture: 'boss_shadow_eye', w: 72, h: 72, spriteW: 96, spriteH: 96, hp: 2000, damage: 32, xp: 1800, coins: 120000, flyer: true, blood: 0xc03050 },
  crystal_golem: { name: 'Golem de Cristal', zone: 'bajo las Tierras de Cristal', relic: 'relic_core', texture: 'boss_crystal_golem', w: 84, h: 116, spriteW: 112, spriteH: 128, hp: 2800, damage: 40, xp: 2500, coins: 180000, blood: 0xd890f0 },
  flame_lord: { name: 'Señor de las Llamas', zone: 'en el Inframundo, bajo el Volcán', relic: 'relic_flame', texture: 'boss_flame_lord', w: 84, h: 84, spriteW: 120, spriteH: 120, hp: 3800, damage: 48, xp: 4000, coins: 300000, flyer: true, blood: 0xff7020 },
};
// Se registran como enemigos (así los golpean las armas, los poderes y los proyectiles)
for (const [id, b] of Object.entries(BOSSES)) ENEMY_TYPES[id] = { ...b, boss: true, resist: 0.95, drops: [] };

// Proyectiles: cuadro de proj_boss, gravedad y daño (fracción del daño del jefe)
const SHOTS = {
  stinger: { frame: 0, gravity: 260, dmg: 0.6, glow: null },
  shadow: { frame: 1, gravity: 0, dmg: 0.6, glow: 0xb070ff },
  crystal: { frame: 2, gravity: 0, dmg: 0.55, glow: 0xff9ee8 },
  fire: { frame: 3, gravity: 0, dmg: 0.65, glow: 0xff8a30 },
  rain: { frame: 3, gravity: 200, dmg: 0.6, glow: 0xff8a30 },
};

const rand = (a, b) => a + Math.random() * (b - a);

/** Un jefe: un Enemy con su propia IA, sin empujones y que no se va lejos de su guarida. */
class Boss extends Enemy {
  constructor(manager, type, x, y, lair, bosses) {
    super(manager, type, x, y, {});
    this.lair = lair;
    this.bosses = bosses;
    this.state = 'intro';
    this.timer = 1.2;
    this.count = 0; // cuenta de acciones (para alternar ataques)
    this.shotTimer = 1.5;
    this.minions = [];
    this.alpha = 1;
    this.sprite.setDepth(DEPTH.ENEMY + 0.3);
    this.barBg.setVisible(false);
    this.bar.setVisible(false);
    // Sala en px (para no salirse)
    this.room = { x0: lair.x0 * T, x1: (lair.x1 + 1) * T, top: (lair.top + 1) * T, bottom: lair.bottom * T };
  }

  get phase2() {
    return this.hp < this.maxHp / 2;
  }

  /** Recibe un golpe: sin empujón (es muy pesado), parpadea y muestra el daño. */
  hit(damage) {
    if (this.dead || this.state === 'intro') return;
    const was2 = this.phase2;
    this.hp -= damage;
    this.hurtTimer = 0.1;
    this.scene.showFloatingText(this.centerX + rand(-20, 20), this.y - 6, `${damage}`, '#ffb347', 16);
    this.scene.spawnDebris(this.centerX, this.centerY, this.def.blood, 4);
    audio.play('hit', { x: this.centerX, y: this.centerY });
    if (this.hp <= 0) this.die(true);
    else if (!was2 && this.phase2) this.bosses.onPhase2(this);
  }

  die(byPlayer) {
    if (this.dead) return;
    this.dead = true;
    for (const m of this.minions) if (!m.dead) m.die(false);
    if (byPlayer) this.bosses.onDefeated(this);
    this.destroy();
  }

  // ---------------------------------------------------------------- ayudas

  _toward(px, py, speed, k, dt) {
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    const d = Math.hypot(dx, dy) || 1;
    const tvx = (dx / d) * Math.min(speed, d * 3);
    const tvy = (dy / d) * Math.min(speed, d * 3);
    this.vx += (tvx - this.vx) * Math.min(1, k * dt);
    this.vy += (tvy - this.vy) * Math.min(1, k * dt);
  }

  _flyMove(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const r = this.room;
    this.x = Phaser.Math.Clamp(this.x, r.x0, r.x1 - this.w);
    this.y = Phaser.Math.Clamp(this.y, r.top, r.bottom - this.h);
  }

  _walkMove(dt) {
    this.vy = Math.min(this.vy + GRAVITY * dt, 1100);
    if (this.moveX(this.vx * dt, true)) this.blocked = true;
    else this.blocked = false;
    const wasGround = this.onGround;
    this.moveY(this.vy * dt);
    const r = this.room;
    this.x = Phaser.Math.Clamp(this.x, r.x0, r.x1 - this.w);
    return !wasGround && this.onGround; // aterrizó
  }

  _shoot(kind, angle, speed) {
    this.bosses.shoot(kind, this.centerX + Math.cos(angle) * this.w * 0.4, this.centerY + Math.sin(angle) * this.h * 0.3, angle, speed, Math.round(this.damage * SHOTS[kind].dmg));
  }

  _aim(p) {
    return Math.atan2(p.centerY - this.centerY, p.centerX - this.centerX);
  }

  _summon(type, opts = {}) {
    this.minions = this.minions.filter((m) => !m.dead);
    if (this.minions.length >= MAX_MINIONS) return;
    const m = this.manager.spawn(type, this.centerX - 12, this.centerY - 12, { level: 2, ...opts });
    this.minions.push(m);
  }

  _slam(radius) {
    const s = this.scene;
    const p = this.manager.player;
    s.spawnDust(this.centerX, this.y + this.h - 4, 20);
    s.showShockwave(this.centerX, this.y + this.h - 6, radius, 0xffffff);
    s.cameras.main.shake(220, 0.01);
    audio.play('pound', { x: this.centerX, y: this.y + this.h });
    // La onda golpea si estás en el suelo cerca
    if (p.onGround && Math.abs(p.centerX - this.centerX) < radius && Math.abs(p.y + p.h - (this.y + this.h)) < T * 1.5) p.hit(Math.round(this.damage * 0.8), this.centerX);
  }

  // ---------------------------------------------------------------- IA

  update(dt, player) {
    this.time += dt;
    this.hurtTimer -= dt;
    this.timer -= dt;
    this.shotTimer -= dt;
    if (this.state === 'intro') {
      // Aparece temblando antes de atacar
      if (!this.def.flyer) this._walkMove(dt);
      if (this.timer <= 0) {
        this.state = 'go';
        this.timer = 0.5;
      }
      this.sync();
      return;
    }
    this[`_${this.type}`](dt, player);
    this.sync();
  }

  // Rey Slime: saltos hacia ti, un salto gigante que aplasta, slimes de ayuda; en la 2.ª fase se teletransporta
  _slime_king(dt, p) {
    const landed = this._walkMove(dt);
    if (this.state === 'tele') {
      this.alpha = Math.max(0, this.alpha - dt * 2.5);
      if (this.timer <= 0) {
        this.x = Phaser.Math.Clamp(p.centerX - this.w / 2, this.room.x0, this.room.x1 - this.w);
        this.y = this.room.top + T;
        this.vx = 0;
        this.vy = 0;
        this.alpha = 1;
        this.state = 'air';
        this.big = true;
        this.scene.spawnSparkles(this.centerX, this.centerY, 16, 0x9ad0ff);
      }
      return;
    }
    if (landed) {
      this.vx = 0;
      if (this.big) this._slam(5 * T);
      if (this.big && this.phase2) this._summon('slime', { kind: 'blue' });
      this.big = false;
      this.state = 'go';
      this.timer = this.phase2 ? rand(0.35, 0.6) : rand(0.6, 1);
    }
    if (this.onGround && this.state === 'go' && this.timer <= 0) {
      this.count++;
      if (this.phase2 && this.count % 4 === 0) {
        this.state = 'tele';
        this.timer = 0.6;
        return;
      }
      const dir = Math.sign(p.centerX - this.centerX) || 1;
      this.facing = dir;
      this.big = this.count % 3 === 0;
      this.vy = this.big ? -980 : -680;
      this.vx = dir * (this.big ? 240 : rand(170, 250));
      this.state = 'air';
      if (this.count % 5 === 0) this._summon('slime', { kind: 'blue' });
    }
  }

  // Escorpión Rey: te persigue, se para a disparar aguijones; en la 2.ª fase embiste
  _scorpion_king(dt, p) {
    const dir = Math.sign(p.centerX - this.centerX) || 1;
    if (this.state === 'go') {
      this.facing = dir;
      const speed = this.phase2 ? 190 : 130;
      this.vx += (dir * speed - this.vx) * Math.min(1, dt * 4);
      if (this.blocked && this.onGround) this.vy = -620;
      if (this.timer <= 0) {
        this.count++;
        this.state = this.phase2 && this.count % 3 === 0 ? 'charge' : 'aim';
        this.timer = this.state === 'charge' ? 0.5 : 0.6;
        this.vx = 0;
      }
    } else if (this.state === 'aim') {
      this.vx *= 0.8;
      if (this.timer <= 0) {
        const a = this._aim(p) - 0.25;
        const n = this.phase2 ? 5 : 3;
        for (let i = 0; i < n; i++) this._shoot('stinger', a - 0.2 + (i * 0.4) / (n - 1) - 0.1, 470);
        this.state = 'go';
        this.timer = rand(2, 3);
      }
    } else if (this.state === 'charge') {
      // Se agacha y sale disparado
      if (this.timer <= 0 && !this.charging) {
        this.charging = 1.1;
        this.facing = dir;
        this.scene.spawnDust(this.centerX, this.y + this.h, 10);
        audio.play('dash', { x: this.centerX, y: this.centerY });
      }
      if (this.charging) {
        this.vx = this.facing * 560;
        this.charging -= dt;
        if (this.charging <= 0 || this.blocked) {
          this.charging = 0;
          this.state = 'go';
          this.timer = rand(1.5, 2.5);
        }
      }
    }
    this._walkMove(dt);
  }

  // Reina Avispa: revolotea sobre ti tirando aguijones y embiste de lado a lado
  _queen_wasp(dt, p) {
    if (this.state === 'go') {
      this._toward(p.centerX + Math.sin(this.time * 1.3) * 4 * T, p.centerY - 5 * T, 300, 3, dt);
      this.facing = Math.sign(p.centerX - this.centerX) || 1;
      if (this.shotTimer <= 0) {
        this.shotTimer = this.phase2 ? 0.8 : 1.2;
        for (const off of [-0.35, 0, 0.35]) this._shoot('stinger', this._aim(p) + off, 420);
      }
      if (this.timer <= 0) {
        this.count++;
        if (this.phase2 && this.count % 2 === 0) {
          this._summon('wasp');
          this._summon('wasp');
        }
        this.state = 'line';
        this.dashes = this.phase2 ? 4 : 3;
        this.timer = 0.7;
        this.side = p.centerX < (this.room.x0 + this.room.x1) / 2 ? 1 : -1;
      }
    } else if (this.state === 'line') {
      // Se pone a tu altura, a un costado
      this._toward(p.centerX + this.side * 10 * T, p.centerY, 700, 6, dt);
      this.facing = -this.side;
      if (this.timer <= 0) {
        this.state = 'dash';
        this.timer = this.phase2 ? 0.9 : 1.1;
        this.vx = -this.side * (this.phase2 ? 820 : 680);
        this.vy = 0;
        audio.play('dash', { x: this.centerX, y: this.centerY });
      }
    } else if (this.state === 'dash') {
      this.vy *= 0.9;
      if (this.timer <= 0) {
        this.dashes--;
        this.side = -this.side;
        if (this.dashes > 0) {
          this.state = 'line';
          this.timer = 0.5;
        } else {
          this.state = 'go';
          this.timer = rand(3, 4);
        }
      }
    }
    this._flyMove(dt);
  }

  // Ojo Sombrío: da vueltas tirando orbes, llama ojitos y embiste; en la 2.ª fase abre la boca y es más rápido
  _shadow_eye(dt, p) {
    if (this.state === 'go') {
      const a = this.time * (this.phase2 ? 1.2 : 0.8);
      this._toward(p.centerX + Math.cos(a) * 7 * T, p.centerY - 2 * T + Math.sin(a) * 4 * T, 380, 2.5, dt);
      if (this.shotTimer <= 0) {
        this.shotTimer = this.phase2 ? 1 : 1.4;
        const n = this.phase2 ? 3 : 1;
        for (let i = 0; i < n; i++) this._shoot('shadow', this._aim(p) + (i - (n - 1) / 2) * 0.22, 380);
      }
      if (this.timer <= 0) {
        this.count++;
        if (this.count % 2 === 1) this._summon('eye', { tint: 0xb070ff });
        this.state = 'wind';
        this.dashes = this.phase2 ? 5 : 3;
        this.timer = 0.45;
      }
    } else if (this.state === 'wind') {
      // Se frena y apunta antes de embestir
      this.vx *= 0.85;
      this.vy *= 0.85;
      if (this.timer <= 0) {
        const a = this._aim(p);
        const sp = this.phase2 ? 820 : 640;
        this.vx = Math.cos(a) * sp;
        this.vy = Math.sin(a) * sp;
        this.state = 'dash';
        this.timer = 0.65;
        audio.play('dash', { x: this.centerX, y: this.centerY });
      }
    } else if (this.state === 'dash' && this.timer <= 0) {
      this.dashes--;
      this.state = this.dashes > 0 ? 'wind' : 'go';
      this.timer = this.dashes > 0 ? (this.phase2 ? 0.3 : 0.45) : rand(4, 6);
    }
    this.facing = this.vx >= 0 ? 1 : -1;
    this._flyMove(dt);
  }

  // Golem de Cristal: camina lento, tira astillas en todas direcciones y salta para aplastarte
  _crystal_golem(dt, p) {
    const dir = Math.sign(p.centerX - this.centerX) || 1;
    if (this.state === 'go') {
      this.facing = dir;
      this.vx += (dir * (this.phase2 ? 105 : 70) - this.vx) * Math.min(1, dt * 3);
      if (this.blocked && this.onGround) this.vy = -700;
      if (this.timer <= 0) {
        this.count++;
        this.state = this.count % 2 ? 'arms' : 'leap';
        this.timer = this.state === 'arms' ? 0.7 : 0.4;
        this.vx = 0;
      }
    } else if (this.state === 'arms') {
      this.vx = 0;
      if (this.timer <= 0) {
        const n = this.phase2 ? 14 : 9;
        const base = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) this._shoot('crystal', base + (i / n) * Math.PI * 2, 360);
        this.scene.spawnSparkles(this.centerX, this.centerY, 16, 0xff9ee8);
        this.state = 'go';
        this.timer = rand(2, 3);
      }
    } else if (this.state === 'leap') {
      if (this.onGround && this.timer <= 0 && !this.leaping) {
        this.leaping = true;
        this.vy = -1000;
        this.vx = dir * Math.min(330, Math.abs(p.centerX - this.centerX) * 1.2);
        this.facing = dir;
      }
    }
    const landed = this._walkMove(dt);
    if (landed && this.leaping) {
      this.leaping = false;
      this.vx = 0;
      this._slam(6 * T);
      // Astillas que corren por el piso hacia los dos lados
      for (const s of [-1, 1]) this.bosses.shoot('crystal', this.centerX, this.y + this.h - 12, s > 0 ? 0 : Math.PI, 420, Math.round(this.damage * 0.55));
      this.state = 'go';
      this.timer = rand(1.5, 2.5);
    }
  }

  // Señor de las Llamas: flota disparando ráfagas, hace llover fuego y aparece de golpe a tu lado
  _flame_lord(dt, p) {
    if (this.state === 'go') {
      this._toward(p.centerX + Math.sin(this.time * 0.9) * 5 * T, p.centerY - 6 * T, 260, 2, dt);
      if (this.shotTimer <= 0) {
        this.shotTimer = this.phase2 ? 1.1 : 1.5;
        for (const off of [-0.18, 0, 0.18]) this._shoot('fire', this._aim(p) + off, 420);
        audio.play('fireball', { x: this.centerX, y: this.centerY });
      }
      if (this.timer <= 0) {
        this.count++;
        this.state = this.count % 2 ? 'rain' : 'flash';
        this.timer = this.state === 'rain' ? 3.2 : 0.8;
        this.rainTimer = 0;
        if (this.phase2 && this.count % 2 === 0) {
          this._summon('firebat');
          this._summon('firebat');
        }
      }
    } else if (this.state === 'rain') {
      // Sube al techo y llueve fuego
      this._toward((this.room.x0 + this.room.x1) / 2, this.room.top + 3 * T, 400, 3, dt);
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.rainTimer = this.phase2 ? 0.14 : 0.22;
        this.bosses.shoot('rain', rand(this.room.x0 + T, this.room.x1 - T), this.room.top + T, Math.PI / 2, 260, Math.round(this.damage * 0.6));
      }
      if (this.timer <= 0) {
        this.state = 'go';
        this.timer = rand(3, 4);
      }
    } else if (this.state === 'flash') {
      this.alpha = Math.max(0.1, this.timer / 0.8);
      this.vx *= 0.9;
      this.vy *= 0.9;
      if (this.timer <= 0) {
        // Reaparece a tu lado y estalla en todas direcciones
        const side = Math.random() < 0.5 ? -1 : 1;
        this.x = Phaser.Math.Clamp(p.centerX + side * 6 * T - this.w / 2, this.room.x0, this.room.x1 - this.w);
        this.y = Phaser.Math.Clamp(p.centerY - 2 * T - this.h / 2, this.room.top, this.room.bottom - this.h);
        this.alpha = 1;
        this.scene.spawnSparkles(this.centerX, this.centerY, 20, 0xff8a30);
        const n = this.phase2 ? 14 : 10;
        for (let i = 0; i < n; i++) this._shoot('fire', (i / n) * Math.PI * 2, 330);
        audio.play('explode', { x: this.centerX, y: this.centerY });
        this.state = 'go';
        this.timer = rand(3, 4);
      }
    }
    this.facing = p.centerX >= this.centerX ? 1 : -1;
    this._flyMove(dt);
  }

  // ---------------------------------------------------------------- dibujo

  sync() {
    const def = this.def;
    const s = this.sprite;
    let frame = 0;
    let sx = 1;
    let sy = 1;
    switch (this.type) {
      case 'slime_king':
        frame = !this.onGround ? 2 : this.timer < 0.2 && this.state === 'go' ? 1 : 0;
        if (frame === 0) sy = 1 + Math.sin(this.time * 4) * 0.04;
        break;
      case 'scorpion_king':
        frame = this.state === 'aim' || this.charging ? 1 : Math.floor(this.time * 3) % 2;
        break;
      case 'queen_wasp':
      case 'flame_lord':
        frame = Math.floor(this.time * (this.type === 'queen_wasp' ? 16 : 6)) % 2;
        break;
      case 'shadow_eye':
        frame = this.phase2 ? 1 : 0;
        break;
      case 'crystal_golem':
        frame = this.state === 'arms' || this.leaping ? 1 : 0;
        break;
      default:
        break;
    }
    if (this.state === 'intro') sx = 1 + Math.sin(this.time * 40) * 0.03;
    if (this.manager.frames[this.type] > frame) s.setFrame(frame, false, false);
    s.setScale((def.spriteW / s.frame.width) * sx, (def.spriteH / s.frame.height) * sy)
      .setPosition(this.centerX, def.flyer ? this.centerY : this.y + this.h)
      .setOrigin(0.5, def.flyer ? 0.5 : 1)
      .setFlipX(this.facing < 0)
      .setAlpha(this.alpha);
    if (this.hurtTimer > 0) s.setTintFill(0xffffff);
    else if (this.phase2 && this.type !== 'shadow_eye') s.setTint(0xffc8c8);
    else s.clearTint();
  }
}

/**
 * Guaridas, jefes y reliquias: el guardián despierta cuando te acercas al altar con la reliquia,
 * pelea dentro de su sala (con sus proyectiles) y al morir suelta la reliquia, monedas y experiencia.
 * Al día siguiente la reliquia vuelve a aparecer y el guardián se puede volver a pelear.
 * Eventos de la escena: 'bossStart' (jefe), 'bossEnd' (jefe, ganaste).
 */
export class Bosses {
  constructor(scene, world, enemies, player, dayNight, saved = {}) {
    this.scene = scene;
    this.world = world;
    this.enemies = enemies;
    this.player = player;
    this.dayNight = dayNight;
    this.lairs = world.generator.lairs || [];
    this.state = {};
    for (const [id, st] of Object.entries(saved || {})) if (BOSSES[id] && st) this.state[id] = { defeats: st.defeats | 0, day: st.day | 0 };
    this.active = null;
    this.shots = [];
    this.time = 0;
    // Reliquia flotando sobre cada altar (con brillo)
    this.altars = this.lairs.map((L) => ({
      lair: L,
      icon: scene.add.image(0, 0, ITEMS[BOSSES[L.boss].relic].icon).setDepth(DEPTH.ENEMY - 0.2).setDisplaySize(28, 28).setVisible(false),
      glow: scene.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.LIGHT + 0.5).setTint(0xffe08a).setScale(0.8).setVisible(false),
    }));
  }

  defeated(id) {
    return (this.state[id]?.defeats || 0) > 0;
  }

  /** ¿Está la reliquia en el altar? (vuelve a aparecer al día siguiente de vencer al guardián) */
  relicAvailable(L) {
    const st = this.state[L.boss];
    return !st || this.dayNight.day > st.day;
  }

  update(dt) {
    this.time += dt;
    const p = this.player;
    const cam = this.scene.cameras.main.worldView;
    for (const a of this.altars) {
      const L = a.lair;
      const x = (L.altar.x + 0.5) * T;
      const y = (L.altar.y - 0.7) * T + Math.sin(this.time * 2) * 4;
      const near = x > cam.x - 64 && x < cam.right + 64 && y > cam.y - 64 && y < cam.bottom + 64;
      const show = near && this.relicAvailable(L) && this.active?.lair !== L;
      a.icon.setVisible(show).setPosition(x, y);
      a.glow.setVisible(show).setPosition(x, y).setAlpha(0.45 + Math.sin(this.time * 3) * 0.15);
      // Despierta el guardián
      if (show && !this.active && !p.dead && Math.hypot(p.centerX - x, p.centerY - y) < WAKE_DIST) this.awaken(L);
    }
    const b = this.active;
    if (b) {
      const L = b.lair;
      const cx = ((L.x0 + L.x1) / 2) * T;
      const cy = ((L.top + L.bottom) / 2) * T;
      if (b.dead) {
        // Se fue sin que lo vencieras (p. ej. al reaparecer se limpian los enemigos cercanos)
        this.active = null;
        this.clearShots();
        this.scene.events.emit('bossEnd', b, false);
      } else if (p.dead || Math.hypot(p.centerX - cx, p.centerY - cy) > LEASH_DIST) this.sleep();
    }
    this._updateShots(dt);
  }

  awaken(L) {
    const def = BOSSES[L.boss];
    const p = this.player;
    const left = p.centerX < ((L.x0 + L.x1) / 2) * T;
    // Aparece del otro lado de la sala
    const x = (left ? L.x1 - 8 : L.x0 + 8) * T - def.w / 2;
    const y = def.flyer ? (L.top + 3) * T : L.bottom * T - def.h;
    const boss = new Boss(this.enemies, L.boss, x, y, L, this);
    boss.facing = left ? -1 : 1;
    this.enemies.list.push(boss);
    this.active = boss;
    this.scene.cameras.main.shake(500, 0.008);
    audio.play('roar');
    this.scene.events.emit('bossStart', boss);
  }

  /** Te alejaste o moriste: el guardián vuelve a dormir (y se cura). */
  sleep() {
    const b = this.active;
    this.active = null;
    if (!b) return;
    b.dead = true;
    for (const m of b.minions) if (!m.dead) m.die(false);
    b.destroy();
    this.enemies.list = this.enemies.list.filter((e) => e !== b);
    this.clearShots();
    this.scene.events.emit('toast', `${b.def.name} volvió a dormir`);
    this.scene.events.emit('bossEnd', b, false);
  }

  onPhase2(boss) {
    audio.play('roar');
    this.scene.cameras.main.shake(300, 0.008);
    this.scene.events.emit('toast', `¡${boss.def.name} se enfurece!`);
  }

  onDefeated(boss) {
    const s = this.scene;
    const def = boss.def;
    const id = boss.type;
    const st = (this.state[id] ||= { defeats: 0, day: 0 });
    st.defeats++;
    st.day = this.dayNight.day;
    this.active = null;
    this.clearShots();
    // Gran final: polvo, brillos, sacudón y botín
    s.spawnDust(boss.centerX, boss.y + boss.h, 30);
    s.spawnSparkles(boss.centerX, boss.centerY, 40);
    s.spawnDebris(boss.centerX, boss.centerY, def.blood, 24);
    s.showShockwave(boss.centerX, boss.centerY, 160, 0xffe08a);
    s.cameras.main.shake(600, 0.012);
    audio.play('bossDie', { x: boss.centerX, y: boss.centerY });
    s.drops.spawn(def.relic, 1, boss.centerX, boss.centerY);
    s.drops.spawn('greater_healing_potion', 3, boss.centerX, boss.centerY);
    s.dropCoins(Math.round(def.coins * (st.defeats > 1 ? 0.5 : 1)), boss.centerX, boss.centerY);
    s.gainXp(Math.round(def.xp * (st.defeats > 1 ? 0.5 : 1)), boss.centerX, boss.y - 10);
    s.events.emit('bossEnd', boss, true);
  }

  // ---------------------------------------------------------------- proyectiles

  shoot(kind, x, y, angle, speed, damage) {
    const k = SHOTS[kind];
    const img = this.scene.add.image(x, y, 'proj_boss', k.frame).setDepth(DEPTH.PARTICLES).setDisplaySize(18, 18);
    const glow = k.glow ? this.scene.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.LIGHT + 0.5).setTint(k.glow).setScale(0.3) : null;
    this.shots.push({ kind, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: k.gravity, damage, life: 5, img, glow });
    if (kind === 'stinger' || kind === 'crystal') audio.play('throw', { x, y });
  }

  _updateShots(dt) {
    if (!this.shots.length) return;
    const p = this.player;
    const w = this.world;
    this.shots = this.shots.filter((s) => {
      s.life -= dt;
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let gone = s.life <= 0 || w.isSolid(Math.floor(s.x / T), Math.floor(s.y / T));
      if (!gone && !p.dead && s.x > p.x - 4 && s.x < p.x + p.w + 4 && s.y > p.y - 4 && s.y < p.y + p.h + 4) {
        p.hit(s.damage, s.x);
        gone = true;
      }
      if (gone) {
        if (s.kind === 'fire' || s.kind === 'rain') this.scene.spawnDebris(s.x, s.y, 0xff8a30, 4);
        s.img.destroy();
        s.glow?.destroy();
        return false;
      }
      s.img.setPosition(s.x, s.y).setRotation(Math.atan2(s.vy, s.vx));
      s.glow?.setPosition(s.x, s.y);
      return true;
    });
  }

  clearShots() {
    for (const s of this.shots) {
      s.img.destroy();
      s.glow?.destroy();
    }
    this.shots = [];
  }

  serialize() {
    return this.state;
  }

  destroy() {
    this.clearShots();
    for (const a of this.altars) {
      a.icon.destroy();
      a.glow.destroy();
    }
  }
}
