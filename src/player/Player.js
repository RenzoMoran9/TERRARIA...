import { TILE_SIZE, PLAYER as P } from '../config.js';
import { PlayerAnimator } from './PlayerAnimator.js';
import { HURTS, BLOCK } from '../world/blocks.js';
import { ENERGY_MAX } from '../systems/Skills.js';
import { audio } from '../systems/Audio.js';

const SPRINT_MULT = 1.6; // correr: 60% más rápido
const SPRINT_COST = 22; // energía por segundo corriendo
const DASH_SPEED = 760;
const DASH_TIME = 0.2;
const DASH_COST = 30;
const POUND_SPEED = 1250;
const POUND_COST = 25;
const ENERGY_REGEN = 28; // por segundo
const ENERGY_DELAY = 0.7; // segundos sin gastar antes de recargar

const EPS = 0.001;
const MAX_STEP = 8; // el movimiento se divide en pasos de ≤8 px para no atravesar bloques

function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

/**
 * Jugador con física propia contra la cuadrícula de tiles (AABB vs tiles):
 * más simple y estable que usar el motor de físicas con chunks que se cargan y descargan.
 * (x, y) es la esquina superior izquierda de la hitbox.
 */
export class Player {
  constructor(scene, world, x, y) {
    this.scene = scene;
    this.world = world;
    this.w = P.WIDTH;
    this.h = P.HEIGHT;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;

    this.maxHealth = P.MAX_HEALTH;
    this.health = P.MAX_HEALTH;
    this.dead = false;
    this.timeSinceDamage = 99;

    this.peakY = y; // punto más alto de la caída actual (para el daño por caída)
    this.prevJump = false;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.jumping = false;

    this.stepOffset = 0; // suaviza visualmente la subida automática de escalones
    this.pushing = false; // caminando contra una pared
    this.heldLight = 0; // luz de lo que lleva en la mano (antorcha), la usa Lighting
    this.seat = null; // sentado en una silla o acostado en una cama (ver Furniture)
    this.invuln = 0; // segundos de invulnerabilidad después de un golpe de un enemigo
    this.dropTimer = 0; // bajando por una plataforma (mientras tanto las plataformas no frenan)

    // Habilidades (ver systems/Skills.js): la escena asigna this.progress
    this.progress = null;
    this.energy = ENERGY_MAX;
    this.energyIdle = 0; // segundos sin gastar energía
    this.running = false;
    this.usedDoubleJump = false;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashHits = new Set();
    this.pounding = false;
    this.prevDown = false;
    this.prevDash = false;

    // Sprite, animaciones y efectos
    this.anim = new PlayerAnimator(scene, this);
  }

  get sprite() {
    return this.anim.sprite;
  }

  /** ¿Aprendió esta habilidad? */
  hasSkill(id) {
    return !!this.progress && this.progress.has(id);
  }

  /** Gasta energía si alcanza. */
  useEnergy(amount) {
    if (this.energy < amount) return false;
    this.energy -= amount;
    this.energyIdle = 0;
    return true;
  }

  /** Vida máxima con los bonos de las habilidades (se llama al aprender una). */
  refreshStats() {
    const max = P.MAX_HEALTH + (this.progress ? this.progress.maxHealthBonus : 0);
    if (max > this.maxHealth) this.health += max - this.maxHealth;
    this.maxHealth = max;
    this.health = Math.min(this.health, this.maxHealth);
  }

  /** ¿Se lo ve? (vivo, o todavía desvaneciéndose al morir): mientras tanto lleva su luz tenue */
  get visible() {
    return !this.dead || this.anim.deathTime < 1.5;
  }

  get centerX() {
    return this.x + this.w / 2;
  }

  get centerY() {
    return this.y + this.h / 2;
  }

  /** controls: { moveX: -1..1, jump: boolean, down: boolean } */
  update(dt, controls) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    // La energía se recarga sola después de un momento sin gastarla
    this.energyIdle += dt;
    if (this.energyIdle > ENERGY_DELAY) this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_REGEN * dt);
    const downPressed = !!controls.down && !this.prevDown;
    this.prevDown = !!controls.down;
    const dashPressed = !!controls.dash && !this.prevDash;
    this.prevDash = !!controls.dash;
    if (this.dead) {
      this.anim.update(dt);
      return;
    }
    if (controls.moveX !== 0 || controls.jump) this.anim.wake();

    // --- Sentado o acostado: moverse o saltar lo levanta ---
    if (this.seat) {
      const jumpPressed = controls.jump && !this.prevJump;
      this.prevJump = controls.jump;
      if (controls.moveX !== 0 || jumpPressed) {
        this.standUp();
      } else {
        this.vx = 0;
        this.vy = 0;
        this.regen(dt);
        this.anim.update(dt);
        return;
      }
    }

    // --- Embestida: se lanza hacia adelante sin gravedad ---
    if (dashPressed && this.hasSkill('dash') && this.dashCooldown <= 0 && this.dashTime <= 0 && this.useEnergy(DASH_COST)) {
      if (controls.moveX !== 0) this.facing = controls.moveX > 0 ? 1 : -1;
      this.dashTime = DASH_TIME;
      this.dashCooldown = 0.55;
      this.dashHits.clear();
      this.pounding = false;
      this.invuln = Math.max(this.invuln, DASH_TIME + 0.1);
      this.scene.spawnDust(this.centerX, this.y + this.h, 8);
      this.anim.jump();
      audio.play('dash');
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.facing * DASH_SPEED;
      this.vy = 0;
      this.moveX(this.vx * dt, true);
      this.scene.abilities?.dashContact(this);
      if (Math.random() < 0.6) this.scene.spawnSparkles(this.centerX - this.facing * 10, this.centerY, 1, 0x9be7ff);
      if (this.dashTime <= 0) this.vx = this.facing * P.SPEED;
      this.regen(dt);
      this.anim.update(dt);
      return;
    }

    // --- Correr (mantener Shift / joystick a fondo): más rápido mientras alcance la energía ---
    this.running = !!controls.run && controls.moveX !== 0 && this.hasSkill('sprint') && this.energy > 1;
    if (this.running) {
      this.energy = Math.max(0, this.energy - SPRINT_COST * dt);
      this.energyIdle = 0;
      if (this.onGround && Math.random() < dt * 10) this.scene.spawnDust(this.centerX - this.facing * 8, this.y + this.h, 1);
    }
    const speed = P.SPEED * (this.running ? SPRINT_MULT : 1);

    // --- Movimiento horizontal con aceleración ---
    if (controls.moveX !== 0) {
      const accel = (this.onGround ? P.GROUND_ACCEL : P.AIR_ACCEL) * (this.running ? 1.3 : 1);
      this.vx = approach(this.vx, controls.moveX * speed, accel * dt);
      const facing = controls.moveX > 0 ? 1 : -1;
      if (facing !== this.facing) this.anim.turn(Math.abs(this.vx));
      this.facing = facing;
    } else {
      const friction = this.onGround ? P.GROUND_FRICTION : P.AIR_FRICTION;
      this.vx = approach(this.vx, 0, friction * dt);
    }

    // --- Salto (con "coyote time", buffer y altura variable) ---
    const jumpPressed = controls.jump && !this.prevJump;
    this.prevJump = controls.jump;
    this.jumpBuffer = jumpPressed ? P.JUMP_BUFFER : this.jumpBuffer - dt;
    this.coyote = this.onGround ? P.COYOTE_TIME : this.coyote - dt;
    if (this.onGround) this.usedDoubleJump = false;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = P.JUMP_VELOCITY;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumping = true;
      this.anim.jump();
      audio.play('jump');
    } else if (jumpPressed && !this.onGround && this.coyote <= 0 && !this.usedDoubleJump && this.hasSkill('doubleJump')) {
      // Doble salto: un segundo impulso en el aire, con una nubecita
      this.usedDoubleJump = true;
      this.vy = P.JUMP_VELOCITY * 0.92;
      this.jumpBuffer = 0;
      this.jumping = true;
      this.pounding = false;
      this.peakY = this.y;
      this.anim.jump();
      this.scene.spawnDust(this.centerX, this.y + this.h, 10);
      audio.play('doubleJump');
    }
    // Soltar el botón antes corta el salto (saltos cortos)
    if (this.jumping && !controls.jump && this.vy < 0) {
      this.vy *= 0.45;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    // --- Bajar por una plataforma (abajo, como en Terraria) ---
    if (controls.down && this.onGround && this.onPlatform()) {
      this.dropTimer = 0.22;
      this.onGround = false;
      this.y += 2;
    } else if (downPressed && !this.onGround && !this.pounding && this.hasSkill('groundPound') && this.useEnergy(POUND_COST)) {
      // Golpe sísmico: cae en picada; al tocar el suelo, una onda golpea alrededor
      this.pounding = true;
      this.jumping = false;
      audio.play('dash', { vol: 0.6 });
      this.vx = 0;
      this.vy = POUND_SPEED;
    }

    // --- Gravedad ---
    this.vy = this.pounding ? POUND_SPEED : Math.min(this.vy + P.GRAVITY * dt, P.MAX_FALL);

    // --- Mover y resolver colisiones (primero X, luego Y) ---
    const wasOnGround = this.onGround;
    this.pushing = false;
    this.moveX(this.vx * dt, controls.moveX !== 0);
    this.moveY(this.vy * dt);

    // --- Daño por caída ---
    if (!this.onGround) {
      if (wasOnGround || this.y < this.peakY) this.peakY = this.y;
    } else if (!wasOnGround) {
      let fallTiles = (this.y - this.peakY) / TILE_SIZE;
      if (this.pounding) {
        // El golpe sísmico no hace daño por caída: la onda golpea alrededor
        this.pounding = false;
        this.scene.abilities?.poundImpact(this, fallTiles);
        fallTiles = 3;
      }
      this.anim.land(fallTiles);
      if (fallTiles > 0.6) audio.play('land', { fall: fallTiles });
      if (fallTiles > 1.5) this.scene.spawnDust(this.centerX, this.y + this.h, Math.min(12, 4 + Math.round(fallTiles)));
      if (fallTiles > P.SAFE_FALL_TILES) {
        this.damage(Math.round((fallTiles - P.SAFE_FALL_TILES) * P.FALL_DAMAGE_PER_TILE));
      }
      this.peakY = this.y;
    }

    // Pasos al caminar (más seguidos corriendo)
    this.stepTimer = (this.stepTimer || 0) - dt * (Math.abs(this.vx) / P.SPEED);
    if (this.onGround && Math.abs(this.vx) > 60 && this.stepTimer <= 0) {
      this.stepTimer = 0.32;
      audio.play('step');
    }

    this.regen(dt);
    this._checkHazards();

    // --- Animación ---
    this.stepOffset = Math.max(0, this.stepOffset - dt * 320);
    this.anim.update(dt);
  }

  /** Tocar lava o un cactus hace daño (la lava además quema y hace saltar para salir). */
  _checkHazards() {
    const T = TILE_SIZE;
    let worst = 0;
    let lava = false;
    for (let ty = Math.floor(this.y / T); ty <= Math.floor((this.y + this.h - EPS) / T); ty++) {
      for (let tx = Math.floor((this.x - 1) / T); tx <= Math.floor((this.x + this.w + 1) / T); tx++) {
        const id = this.world.getTile(tx, ty);
        if (HURTS[id] > worst) worst = HURTS[id];
        if (id === BLOCK.LAVA) lava = true;
      }
    }
    if (!worst || !this.hit(worst, this.centerX + (lava ? 0 : this.facing * 10))) return;
    if (lava) {
      this.vx *= 0.3;
      this.vy = -520; // salta de la lava
      this.scene.spawnSparkles(this.centerX, this.y + this.h, 10, 0xff8a30);
      audio.play('lava');
      if (!this._lavaWarned) {
        this._lavaWarned = true;
        this.scene.events.emit('toast', '¡La lava quema! Sal rápido');
      }
    }
  }

  /** Regeneración lenta de vida (después de un rato sin recibir daño). */
  regen(dt) {
    this.timeSinceDamage += dt;
    const mult = this.progress ? this.progress.regenMultiplier : 1;
    if (!this.dead && this.timeSinceDamage > P.REGEN_DELAY / mult && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + P.REGEN_PER_SECOND * mult * dt);
    }
  }

  /** Sentarse en una silla o acostarse en una cama (seat lo arma Furniture). */
  sit(seat) {
    this.seat = seat;
    this.x = seat.x;
    this.y = seat.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = seat.facing;
    this.stepOffset = 0;
    this.anim.wake();
  }

  standUp() {
    const seat = this.seat;
    if (!seat) return;
    this.seat = null;
    if (seat.kind === 'bed') {
      this.x = seat.standX;
      this.y = seat.standY;
    } else {
      this.y += 3; // de vuelta al piso
    }
    for (let i = 0; i < 4 && this.collides(this.x, this.y); i++) this.y -= TILE_SIZE;
    this.peakY = this.y;
    this.anim.standUp(seat);
  }

  /** ¿La hitbox en (x, y) toca algún bloque sólido? */
  collides(x, y) {
    const T = TILE_SIZE;
    const x0 = Math.floor(x / T);
    const x1 = Math.floor((x + this.w - EPS) / T);
    const y0 = Math.floor(y / T);
    const y1 = Math.floor((y + this.h - EPS) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.world.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  moveX(dx, wantsStepUp) {
    const T = TILE_SIZE;
    while (dx !== 0) {
      const step = dx > 0 ? Math.min(dx, MAX_STEP) : Math.max(dx, -MAX_STEP);
      dx -= step;
      const nx = this.x + step;
      if (!this.collides(nx, this.y)) {
        this.x = nx;
        continue;
      }
      // Puerta cerrada en el camino: se abre sola al caminar contra ella
      if (wantsStepUp && this.scene.furniture?.openDoorsAt(nx, this.y, this.w, this.h) && !this.collides(nx, this.y)) {
        this.x = nx;
        continue;
      }
      // Subir automáticamente escalones de 1 bloque (como en Terraria)
      if (this.onGround && wantsStepUp) {
        const upY = this.y - T;
        if (!this.collides(this.x, upY) && !this.collides(nx, upY)) {
          this.y = upY;
          this.x = nx;
          this.stepOffset += T;
          continue;
        }
      }
      // Pegarse al borde del bloque (si está en el suelo y quiere avanzar, empuja la pared)
      if (this.onGround && wantsStepUp) this.pushing = true;
      if (step > 0) this.x = Math.floor((nx + this.w) / T) * T - this.w;
      else this.x = (Math.floor(nx / T) + 1) * T;
      this.vx = 0;
      break;
    }
  }

  /** ¿Está parado sobre una plataforma (y no sobre un bloque sólido)? */
  onPlatform() {
    const T = TILE_SIZE;
    const ty = Math.floor((this.y + this.h + 1) / T);
    let platform = false;
    for (let tx = Math.floor(this.x / T); tx <= Math.floor((this.x + this.w - EPS) / T); tx++) {
      if (this.world.isSolid(tx, ty)) return false;
      if (this.world.isPlatform(tx, ty)) platform = true;
    }
    return platform;
  }

  /** Al bajar, ¿los pies cruzan el borde de arriba de una plataforma? Devuelve la fila o -1. */
  platformBelow(y, ny) {
    if (this.dropTimer > 0) return -1;
    const T = TILE_SIZE;
    const row = Math.floor((ny + this.h - EPS) / T);
    if (y + this.h > row * T + EPS) return -1; // ya estaba más abajo del borde
    for (let tx = Math.floor(this.x / T); tx <= Math.floor((this.x + this.w - EPS) / T); tx++) {
      if (this.world.isPlatform(tx, row)) return row;
    }
    return -1;
  }

  moveY(dy) {
    const T = TILE_SIZE;
    this.onGround = false;
    while (dy !== 0) {
      const step = dy > 0 ? Math.min(dy, MAX_STEP) : Math.max(dy, -MAX_STEP);
      dy -= step;
      const ny = this.y + step;
      const row = step > 0 ? this.platformBelow(this.y, ny) : -1;
      if (row >= 0) {
        this.y = row * T - this.h;
        this.onGround = true;
        this.vy = 0;
        break;
      }
      if (!this.collides(this.x, ny)) {
        this.y = ny;
        continue;
      }
      if (step > 0) {
        this.y = Math.floor((ny + this.h) / T) * T - this.h;
        this.onGround = true;
      } else {
        this.y = (Math.floor(ny / T) + 1) * T;
        if (this.vy < -200) this.anim.bump(); // cabezazo contra el techo
      }
      this.vy = 0;
      break;
    }
  }

  /** ¿La hitbox ocupa el tile (tx, ty)? (para no colocar bloques encima del jugador) */
  overlapsTile(tx, ty) {
    const T = TILE_SIZE;
    return this.x < (tx + 1) * T && this.x + this.w > tx * T && this.y < (ty + 1) * T && this.y + this.h > ty * T;
  }

  /** Golpe de un enemigo en fromX: daño, empujón hacia atrás y un momento de invulnerabilidad. */
  hit(amount, fromX) {
    if (this.dead || this.invuln > 0) return false;
    this.invuln = P.HIT_INVULN;
    // Defensa (Piel dura): cada golpe quita menos, como mínimo 1
    this.damage(Math.max(1, amount - (this.progress ? this.progress.defense : 0)));
    if (this.dead) return true;
    this.vx = (Math.sign(this.centerX - fromX) || -this.facing) * P.KNOCKBACK;
    this.vy = Math.min(this.vy, -320);
    this.onGround = false;
    return true;
  }

  damage(amount) {
    if (this.dead || amount <= 0) return;
    this.standUp();
    this.health -= amount;
    this.timeSinceDamage = 0;
    this.scene.showFloatingText(this.centerX, this.y - 4, `-${amount}`, '#ff5252');
    this.scene.cameras.main.shake(150, 0.006);
    this.anim.hurt();
    audio.play('hurt');
    if (this.health <= 0) this.die();
  }

  die() {
    this.health = 0;
    this.dead = true;
    this.seat = null;
    this.vx = 0;
    this.vy = 0;
    this.anim.die(); // cae de espaldas y se desvanece
    audio.play('die');
    this.scene.onPlayerDied();
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.energy = ENERGY_MAX;
    this.pounding = false;
    this.dashTime = 0;
    this.onGround = false;
    this.peakY = y;
    this.timeSinceDamage = 99;
    this.stepOffset = 0;
    this.anim.respawn(); // aparece con brillos y saluda
    this.anim.update(0);
  }
}
