import Phaser from 'phaser';
import { PLAYER as P, DEPTH, TILE_SIZE } from '../config.js';
import { FRAME, WALK_FRAMES, ART_W, ART_H, frontHand } from './animations.js';
import { frameCount } from '../systems/Placeholders.js';

// Tiempos del personaje quieto (segundos sin tocar nada)
const LOOK_AT = 6; // mira hacia atrás y se da vuelta
const YAWN_AT = 13; // bosteza
const SLEEP_AT = 25; // se sienta y se duerme
const LOW_HEALTH = 0.3; // con menos de 30% de vida se lo ve cansado

const WALK_FPS = 14; // cuadros por segundo del ciclo de caminar a velocidad máxima
const HELD_TORCH_LIGHT = 0.85; // luz de la antorcha en la mano (una colocada da 1)

// Herramienta en la mano: punto de agarre del mango dentro del ícono y ángulo en cada parte del golpe
const TOOL_ORIGIN = [0.22, 0.84];
const TOOL_SIZE = 24;
const SWING_ANGLE = { swing1: -1.45, swing2: 0.35, swing3: 1.65 };

const ease = (t) => 1 - (1 - t) * (1 - t);

/**
 * Animaciones del jugador: elige el cuadro de la hoja según lo que esté pasando
 * (caminar, saltar, caer, minar, colocar, daño, festejo, aburrimiento, sueño…),
 * aplica "estirar y aplastar" al saltar y aterrizar, muestra lo que lleva en la mano
 * (pico al minar, bloque al colocar, antorcha encendida) y lanza efectos (polvo, chispas, zzz).
 */
export class PlayerAnimator {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.frames = frameCount(scene, 'player');

    this.sprite = scene.add.image(0, 0, 'player', 0).setOrigin(0.5, 1).setDepth(DEPTH.PLAYER);
    // Objeto en la mano (pico, bloque, antorcha) y brillo de la antorcha
    this.held = scene.add.image(0, 0, 'tile_torch').setDepth(DEPTH.TOOL).setVisible(false);
    this.glow = scene.add
      .image(0, 0, 'fx_glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.LIGHT + 0.5)
      .setVisible(false);

    this.time = 0;
    this.frame = FRAME.idle;
    this.sx = 1; // estirar/aplastar (1 = normal)
    this.sy = 1;
    this.hop = 0; // saltito visual (px hacia arriba)
    this.action = null; // animación de un momento: { name, t, duration }
    this.idleTime = 0;
    this.blinkTimer = 2;
    this.fxTimer = 0;
    this.walkPhase = 0;
    this.lastWalkFrame = -1;
    this.mining = null; // datos del golpe mientras se mina (ver swing)
    this._swingReq = null;
    this.swingPhase = 0;
    this.toolAngle = SWING_ANGLE.swing1;
    this.useIcon = null;
    this.deathTime = -1;
    this.spawnTime = -1;

    this.play('wave', 1.6); // saludo al empezar
    this.update(0);
  }

  // ------------------------------------------------------------ eventos

  /** Animación de un momento (festejo, saludo, daño, aterrizaje, usar un bloque). */
  play(name, duration) {
    this.action = { name, t: 0, duration };
  }

  _is(name) {
    return this.action !== null && this.action.name === name;
  }

  /** Cualquier acción del jugador lo despierta. */
  wake() {
    if (this.idleTime >= SLEEP_AT) {
      this.scene.showFloatingText(this.player.centerX, this.player.y - 6, '!', '#ffe066', 18);
      this.sy = 1.12;
      this.sx = 0.9;
    }
    this.idleTime = 0;
  }

  jump() {
    this.sx = 0.8;
    this.sy = 1.2;
    if (this._is('cheer') || this._is('wave') || this._is('land')) this.action = null;
    this.scene.spawnDust(this.player.centerX, this.player.y + this.player.h, 5);
  }

  land(fallTiles) {
    const s = Math.min(0.32, 0.1 + fallTiles * 0.025);
    this.sx = 1 + s;
    this.sy = 1 - s;
    if (fallTiles > 1.2) this.play('land', Math.min(0.3, 0.08 + fallTiles * 0.02));
  }

  /** Se dio vuelta: se "aplana" un instante y, si iba rápido, derrapa levantando polvo. */
  turn(speed) {
    this.sx = 0.78;
    if (speed > 140 && this.player.onGround) {
      this.scene.spawnDust(this.player.centerX, this.player.y + this.player.h, 4);
    }
  }

  /** Se golpeó la cabeza contra el techo. */
  bump() {
    this.sy = 0.86;
    this.sx = 1.1;
    this.scene.spawnDust(this.player.centerX, this.player.y + 4, 3);
  }

  hurt() {
    this.play('hurt', 0.35);
    this.sx = 1.15;
    this.sy = 0.88;
    this.sprite.setTint(0xff7070);
    this.scene.time.delayedCall(180, () => this.sprite.clearTint());
  }

  cheer(duration = 1) {
    if (!this._is('cheer')) this.play('cheer', duration);
    else this.action.t = 0;
    const p = this.player;
    this.scene.spawnSparkles(p.centerX, p.y + 6, 10);
  }

  /** Se levantó de la silla o de la cama (de la cama, bostezando). */
  standUp(seat) {
    this.sx = 0.9;
    this.sy = 1.1;
    this.sprite.setAngle(0);
    if (seat.kind === 'bed') this.play('yawn', 1.4);
  }

  /** Coloca un bloque: estira el brazo y se ve el bloque en la mano un instante. */
  use(icon) {
    this.player.standUp(); // para usar algo hay que estar de pie
    this.useIcon = icon;
    this.play('use', 0.2);
    this.wake();
  }

  /**
   * Mientras mina (cada frame): icon = imagen del pico (null = a mano),
   * (x, y) = centro del bloque, color = color de las chispas, speed = rapidez del pico.
   */
  swing(icon, x, y, color, speed, opts = null) {
    this.player.standUp();
    this._swingReq = { icon, x, y, color, speed, rate: opts?.rate, onHit: opts?.onHit };
    this.wake();
  }

  die() {
    this.deathTime = 0;
    this.action = null;
    this._swingReq = null;
    this.sprite.clearTint();
  }

  respawn() {
    this.deathTime = -1;
    this.spawnTime = 0;
    this.idleTime = 0;
    this.sx = 1;
    this.sy = 1;
    this.sprite.setAngle(0).setAlpha(0);
    this.play('wave', 1.8);
    const p = this.player;
    this.scene.spawnSparkles(p.centerX, p.y + p.h / 2, 18);
  }

  // ------------------------------------------------------------ cada frame

  update(dt) {
    const p = this.player;
    this.time += dt;
    // BlockInteraction avisa con swing() en cada frame que se sigue minando
    const wasMining = this.mining !== null;
    this.mining = this._swingReq;
    this._swingReq = null;
    if (this.mining && !wasMining) this.swingPhase = 0.1; // empieza con el pico levantado

    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= this.action.duration) this.action = null;
    }
    // Volver de a poco a la forma normal (estirar/aplastar)
    const k = Math.min(1, dt * 12);
    this.sx += (1 - this.sx) * k;
    this.sy += (1 - this.sy) * k;
    this.hop = 0;

    if (p.dead) this._updateDeath(dt);
    else this.frame = this._pickFrame(dt);

    // Aparecer después de morir (fundido); después de un golpe, parpadea mientras es invulnerable
    if (this.spawnTime >= 0) {
      this.spawnTime += dt;
      this.sprite.setAlpha(Math.min(1, this.spawnTime / 0.5));
      if (this.spawnTime >= 0.5) this.spawnTime = -1;
    } else if (!p.dead) {
      this.sprite.setAlpha(p.invuln > 0 && Math.floor(this.time * 16) % 2 ? 0.35 : 1);
    }

    // Acostado en la cama: el personaje se dibuja girado 90°
    if (!p.dead) this.sprite.setAngle(p.seat && p.seat.kind === 'bed' ? p.seat.angle : 0);

    const f = this.frames > this.frame ? this.frame : 0; // hoja propia con menos cuadros: se usa el primero
    this.sprite.setFrame(f, false, false);
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    this.sprite
      .setScale((P.SPRITE_WIDTH / fw) * this.sx, (P.SPRITE_HEIGHT / fh) * this.sy)
      .setPosition(p.centerX, p.y + p.h + p.stepOffset - this.hop)
      .setFlipX(p.facing < 0);

    this._updateHeld(dt);
  }

  _pickFrame(dt) {
    const p = this.player;
    const a = this.action;
    const speed = Math.abs(p.vx);

    // Festejo y saludo se cortan al empezar a correr
    if (a && (a.name === 'cheer' || a.name === 'wave') && speed > 60) this.action = null;

    // Sentado en la silla, o durmiendo en la cama con "zzz"
    if (p.seat) {
      this.idleTime = 0;
      if (p.seat.kind === 'chair') return FRAME.seat;
      this.fxTimer -= dt;
      if (this.fxTimer <= 0) {
        this.fxTimer = 1.1;
        const big = Math.floor(this.time / 1.1) % 2 === 0;
        this.scene.showFloatingText(p.seat.head[0], p.seat.head[1] - 10, big ? 'Z' : 'z', '#cfe3ff', big ? 16 : 12);
      }
      return FRAME.blink;
    }
    if (this._is('hurt')) return FRAME.hurt;
    if (this.mining) return this._swingFrame(dt);
    if (this._is('use')) return FRAME.use;
    if (this._is('cheer')) {
      const t = this.action.t;
      this.hop = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 12 : 0;
      if (this.fxTimer <= 0) {
        this.fxTimer = 0.25;
        this.scene.spawnSparkles(p.centerX, p.y + 4, 3);
      }
      this.fxTimer -= dt;
      return FRAME.cheer;
    }
    if (this._is('wave')) return Math.floor(this.action.t / 0.2) % 2 ? FRAME.wave2 : FRAME.wave1;
    if (this._is('yawn')) return FRAME.yawn;

    // En el aire: subiendo, bajando o cayendo de muy alto (agita los brazos)
    if (!p.onGround) {
      this.idleTime = 0;
      if (p.vy < -60) return FRAME.jump;
      if (p.y - p.peakY > 4 * TILE_SIZE) return Math.floor(this.time * 9) % 2 ? FRAME.flail : FRAME.fall;
      return FRAME.fall;
    }
    if (this._is('land')) return FRAME.land;

    // Empujando una pared
    if (p.pushing) {
      this.idleTime = 0;
      this.fxTimer -= dt;
      if (this.fxTimer <= 0) {
        this.fxTimer = 0.45;
        this.scene.spawnDust(p.centerX - p.facing * 8, p.y + p.h, 1);
      }
      this.hop = Math.floor(this.time * 6) % 2;
      return FRAME.push;
    }

    // Caminando: el ciclo va más rápido cuanto más rápido se mueve
    if (speed > 20) {
      this.idleTime = 0;
      this.walkPhase += dt * WALK_FPS * Math.max(0.45, speed / P.SPEED);
      const i = Math.floor(this.walkPhase) % WALK_FRAMES;
      // Polvo cuando un pie toca el suelo (cuadros 0 y 4 del ciclo)
      if (i !== this.lastWalkFrame && (i === 0 || i === 4) && speed > 150) {
        this.scene.spawnDust(p.centerX - p.facing * 6, p.y + p.h, 2);
      }
      this.lastWalkFrame = i;
      return FRAME.walk0 + i;
    }
    this.walkPhase = 1;
    this.lastWalkFrame = -1;
    return this._idleFrame(dt);
  }

  _idleFrame(dt) {
    const p = this.player;
    this.idleTime += dt;
    const t = this.idleTime;
    this.fxTimer -= dt;

    // Poca vida: respira agitado y suda
    if (p.health / p.maxHealth < LOW_HEALTH) {
      if (this.fxTimer <= 0) {
        this.fxTimer = 1.3;
        this.scene.spawnSweat(p.centerX + p.facing * 8, p.y + 8);
      }
      return Math.floor(this.time * 2.5) % 2 ? FRAME.tired2 : FRAME.tired;
    }
    // Dormido: sentado, cabeceando, con "z" flotando
    if (t >= SLEEP_AT) {
      if (this.fxTimer <= 0) {
        this.fxTimer = 1.2;
        const big = Math.floor(t / 1.2) % 2 === 0;
        this.scene.showFloatingText(p.centerX + p.facing * 14, p.y + 22, big ? 'Z' : 'z', '#cfe3ff', big ? 15 : 12);
      }
      return Math.floor(t / 0.9) % 2 ? FRAME.sit2 : FRAME.sit;
    }
    if (t >= YAWN_AT && t < YAWN_AT + 1.5) return FRAME.yawn;
    // Aburrido: mira para atrás un par de veces
    if ((t >= LOOK_AT && t < LOOK_AT + 1.1) || (t >= LOOK_AT + 2.6 && t < LOOK_AT + 3.4)) return FRAME.look;
    // Normal: respira y parpadea de vez en cuando
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (this.blinkTimer < -0.13) this.blinkTimer = 2 + Math.random() * 3;
      return FRAME.blink;
    }
    return Math.floor(this.time / 0.8) % 2 ? FRAME.breath : FRAME.idle;
  }

  /** Golpe con el pico: levantar (swing1), bajar (swing2) e impactar (swing3), en bucle. */
  _swingFrame(dt) {
    const m = this.mining;
    this.idleTime = 0;
    const before = this.swingPhase;
    this.swingPhase += dt * (m.rate ?? 2 + m.speed * 0.4);
    const u = this.swingPhase % 1;
    // Al pasar por el impacto: chispas del bloque (o golpe de la espada) y un pequeño sacudón
    if (Math.floor(before - 0.6) !== Math.floor(this.swingPhase - 0.6)) {
      if (m.color != null) this.scene.spawnDebris(m.x, m.y, m.color, 3);
      if (m.onHit) m.onHit();
      this.sx = 1.06;
      this.sy = 0.95;
    }
    if (u < 0.45) return FRAME.swing1;
    if (u < 0.6) return FRAME.swing2;
    if (u < 0.85) return FRAME.swing3;
    return FRAME.swing2;
  }

  _updateDeath(dt) {
    const p = this.player;
    const t = (this.deathTime += dt);
    this.frame = FRAME.hurt;
    // Salta un poco, cae de espaldas y se desvanece en una nube de polvo
    this.hop = t < 0.3 ? Math.sin((t / 0.3) * Math.PI) * 14 : 0;
    this.sprite.setAngle(-p.facing * 90 * ease(Math.min(1, Math.max(0, t - 0.15) / 0.45)));
    const fade = Math.max(0, 1 - (t - 1) / 0.5);
    this.sprite.setAlpha(t < 1 ? 1 : fade);
    if (t - dt < 1 && t >= 1) {
      this.scene.spawnDust(p.centerX - p.facing * 30, p.y + p.h - 6, 14);
      this.scene.spawnSparkles(p.centerX - p.facing * 30, p.y + p.h - 12, 8, 0xdde6f3);
    }
  }

  // ------------------------------------------------------------ objeto en la mano

  /** Mano delantera en coordenadas del mundo. */
  _handPos() {
    const p = this.player;
    const [ax, ay] = frontHand(this.frame);
    const pxW = (P.SPRITE_WIDTH / ART_W) * this.sx;
    const pxH = (P.SPRITE_HEIGHT / ART_H) * this.sy;
    return [this.sprite.x + p.facing * (ax + 0.5 - ART_W / 2) * pxW, this.sprite.y - (ART_H - ay - 1) * pxH];
  }

  _updateHeld(dt) {
    const p = this.player;
    const held = this.held;
    const f = p.facing;
    let icon = null;
    let torch = false;
    if (!p.dead && !(p.seat && p.seat.kind === 'bed')) {
      if (this.mining) icon = this.mining.icon;
      else if (this._is('use')) icon = this.useIcon;
      else if (this.scene.inventory?.selectedStack?.id === 'torch') {
        icon = 'tile_torch';
        torch = true;
      }
    }
    const light = torch ? HELD_TORCH_LIGHT : 0;
    if (p.heldLight !== light) p.heldLight = light;
    if (!icon || !this.scene.textures.exists(icon)) {
      held.setVisible(false);
      this.glow.setVisible(false);
      return;
    }
    if (held.texture.key !== icon) held.setTexture(icon);
    const [hx, hy] = this._handPos();
    held.setVisible(true).setAlpha(this.sprite.alpha);

    if (this.mining) {
      // Pico: gira desde el mango siguiendo la pose del brazo
      const target = SWING_ANGLE[this.frameName] ?? SWING_ANGLE.swing1;
      this.toolAngle += (target - this.toolAngle) * Math.min(1, dt * 30);
      const s = TOOL_SIZE / held.width;
      held
        .setOrigin(TOOL_ORIGIN[0], TOOL_ORIGIN[1])
        .setPosition(hx, hy)
        .setScale(s * f, s)
        .setRotation(f * this.toolAngle);
      this.glow.setVisible(false);
      return;
    }
    this.toolAngle = SWING_ANGLE.swing1;
    if (torch) {
      // Antorcha: un poco inclinada hacia adelante, con la llama que parpadea
      const s = 22 / held.height;
      const angle = f * (0.2 + Math.sin(this.time * 3) * 0.04);
      held.setOrigin(0.5, 0.85).setPosition(hx, hy).setScale(s).setRotation(angle);
      const up = held.height * s * 0.65; // del mango a la llama
      const flicker = Math.sin(this.time * 9) * 0.5 + Math.sin(this.time * 23) * 0.3;
      this.glow
        .setVisible(true)
        .setPosition(hx + Math.sin(angle) * up, hy - Math.cos(angle) * up)
        .setScale(1.25 * (1 + flicker * 0.04))
        .setAlpha((0.5 + flicker * 0.08) * this.sprite.alpha);
      return;
    }
    // Bloque recién colocado: se ve chiquito en la mano
    const s = 16 / held.width;
    held.setOrigin(0.5, 0.6).setPosition(hx + f * 4, hy).setScale(s).setRotation(f * 0.25);
    this.glow.setVisible(false);
  }

  get frameName() {
    return FRAME_NAMES[this.frame];
  }

  destroy() {
    this.sprite.destroy();
    this.held.destroy();
    this.glow.destroy();
  }
}

const FRAME_NAMES = Object.fromEntries(Object.entries(FRAME).map(([name, i]) => [i, name]));
