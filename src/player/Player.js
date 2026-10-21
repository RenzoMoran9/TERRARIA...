import { TILE_SIZE, PLAYER as P } from '../config.js';
import { PlayerAnimator } from './PlayerAnimator.js';

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

    // Sprite, animaciones y efectos
    this.anim = new PlayerAnimator(scene, this);
  }

  get sprite() {
    return this.anim.sprite;
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

  /** controls: { moveX: -1..1, jump: boolean } */
  update(dt, controls) {
    this.invuln = Math.max(0, this.invuln - dt);
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

    // --- Movimiento horizontal con aceleración ---
    if (controls.moveX !== 0) {
      const accel = this.onGround ? P.GROUND_ACCEL : P.AIR_ACCEL;
      this.vx = approach(this.vx, controls.moveX * P.SPEED, accel * dt);
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
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = P.JUMP_VELOCITY;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumping = true;
      this.anim.jump();
    }
    // Soltar el botón antes corta el salto (saltos cortos)
    if (this.jumping && !controls.jump && this.vy < 0) {
      this.vy *= 0.45;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    // --- Gravedad ---
    this.vy = Math.min(this.vy + P.GRAVITY * dt, P.MAX_FALL);

    // --- Mover y resolver colisiones (primero X, luego Y) ---
    const wasOnGround = this.onGround;
    this.pushing = false;
    this.moveX(this.vx * dt, controls.moveX !== 0);
    this.moveY(this.vy * dt);

    // --- Daño por caída ---
    if (!this.onGround) {
      if (wasOnGround || this.y < this.peakY) this.peakY = this.y;
    } else if (!wasOnGround) {
      const fallTiles = (this.y - this.peakY) / TILE_SIZE;
      this.anim.land(fallTiles);
      if (fallTiles > 1.5) this.scene.spawnDust(this.centerX, this.y + this.h, Math.min(12, 4 + Math.round(fallTiles)));
      if (fallTiles > P.SAFE_FALL_TILES) {
        this.damage(Math.round((fallTiles - P.SAFE_FALL_TILES) * P.FALL_DAMAGE_PER_TILE));
      }
      this.peakY = this.y;
    }

    this.regen(dt);

    // --- Animación ---
    this.stepOffset = Math.max(0, this.stepOffset - dt * 320);
    this.anim.update(dt);
  }

  /** Regeneración lenta de vida (después de un rato sin recibir daño). */
  regen(dt) {
    this.timeSinceDamage += dt;
    if (!this.dead && this.timeSinceDamage > P.REGEN_DELAY && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + P.REGEN_PER_SECOND * dt);
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

  moveY(dy) {
    const T = TILE_SIZE;
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
    this.damage(amount);
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
    if (this.health <= 0) this.die();
  }

  die() {
    this.health = 0;
    this.dead = true;
    this.seat = null;
    this.vx = 0;
    this.vy = 0;
    this.anim.die(); // cae de espaldas y se desvanece
    this.scene.onPlayerDied();
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.onGround = false;
    this.peakY = y;
    this.timeSinceDamage = 99;
    this.stepOffset = 0;
    this.anim.respawn(); // aparece con brillos y saluda
    this.anim.update(0);
  }
}
