import { TILE_SIZE } from '../config.js';
import { BLOCK, OBJECTS, FURNITURE, PART, IS_PLANT } from '../world/blocks.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const DOOR_CLOSE_DELAY = 0.35; // segundos lejos de una puerta abierta al pasar antes de que se cierre sola
const CHAIR_LIFT = 3; // px que se eleva el jugador sentado (para quedar sobre el asiento)

/**
 * Muebles: puertas, sillas, mesas y camas (objetos de varios bloques).
 * - Colocar: busca la posición que incluye el bloque apuntado y apoya en suelo firme.
 * - Quitar: desde cualquier parte se quita el mueble entero.
 * - Puertas: se abren solas al caminar contra ellas y se cierran al alejarse;
 *   también se abren/cierran con clic derecho (PC) o tocándolas (celular).
 * - Silla: sentarse. Cama: punto de reaparición y dormir (de noche la noche pasa rápido).
 */
export class Furniture {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.autoDoors = new Map(); // puertas abiertas al pasar: clave → { x0, y0, away }
  }

  /** Mueble que ocupa (tx, ty): { obj, type, x0, y0 } o null. */
  at(tx, ty) {
    const part = PART[this.world.getTile(tx, ty)];
    if (!part) return null;
    return { obj: part.object, type: part.type, x0: tx - part.dx, y0: ty - part.dy };
  }

  /** ¿Se puede usar (puerta, silla, cama)? */
  isInteractive(tx, ty) {
    const part = PART[this.world.getTile(tx, ty)];
    return !!part && !!FURNITURE[part.type].interactive;
  }

  /** Variante que se coloca: la silla y la cama miran hacia donde mira el jugador. */
  variantFor(type, facing) {
    if (type === 'door') return OBJECTS.door_closed;
    if (type === 'chair') return facing < 0 ? OBJECTS.chair_left : OBJECTS.chair;
    if (type === 'bed') return facing < 0 ? OBJECTS.bed_left : OBJECTS.bed;
    return OBJECTS[type];
  }

  /** ¿Entra el mueble con su esquina superior izquierda en (x0, y0)? */
  fits(obj, x0, y0) {
    for (let dy = 0; dy < obj.h; dy++) {
      for (let dx = 0; dx < obj.w; dx++) {
        const id = this.world.getTile(x0 + dx, y0 + dy);
        if (id !== BLOCK.AIR && !IS_PLANT[id]) return false;
        // Nunca encima del jugador (así la silla y la cama miran hacia él)
        if (this.player.overlapsTile(x0 + dx, y0 + dy)) return false;
      }
    }
    return this.supported(obj, x0, y0);
  }

  /** Toda la base apoyada sobre bloques sólidos o plataformas. */
  supported(obj, x0, y0) {
    for (let dx = 0; dx < obj.w; dx++) if (!this.world.isFloor(x0 + dx, y0 + obj.h)) return false;
    return true;
  }

  /**
   * Dónde quedaría un mueble apuntando al bloque (tx, ty): prueba las posiciones que
   * incluyen ese bloque (primero con la base en él y centrado) y devuelve la primera que entra.
   * Así basta con apuntar más o menos al lugar. → { obj, x0, y0, w, h } o null
   */
  resolve(type, tx, ty, facing) {
    const obj = this.variantFor(type, facing);
    if (!obj) return null;
    const center = Math.floor((obj.w - 1) / 2);
    const offsets = [...Array(obj.w).keys()].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (let k = 0; k < obj.h; k++) {
      const y0 = ty - (obj.h - 1) + k;
      for (const off of offsets) {
        const x0 = tx - off;
        if (this.fits(obj, x0, y0)) return { obj, x0, y0, w: obj.w, h: obj.h };
      }
    }
    return null;
  }

  place(obj, x0, y0) {
    for (let dy = 0; dy < obj.h; dy++) {
      for (let dx = 0; dx < obj.w; dx++) this.world.setTile(x0 + dx, y0 + dy, obj.ids[dy][dx]);
    }
  }

  /** Quita el mueble que ocupa (tx, ty). Devuelve { obj, type, x0, y0 } o null. */
  remove(tx, ty) {
    const f = this.at(tx, ty);
    if (!f) return null;
    if (f.type === 'chest') this.scene.closeChestAt?.(f.x0, f.y0);
    const seat = this.player.seat;
    if (seat && seat.x0 === f.x0 && seat.y0 === f.y0) this.player.standUp();
    this.autoDoors.delete(this._key(f.x0, f.y0));
    for (let dy = 0; dy < f.obj.h; dy++) {
      for (let dx = 0; dx < f.obj.w; dx++) this.world.setTile(f.x0 + dx, f.y0 + dy, BLOCK.AIR);
    }
    return f;
  }

  /**
   * Se quitó el bloque (tx, ty): si sostenía un mueble, el mueble se cae.
   * Devuelve el ítem del mueble caído (o null).
   */
  checkSupport(tx, ty) {
    const f = this.at(tx, ty - 1);
    if (!f || f.y0 + f.obj.h - 1 !== ty - 1 || this.supported(f.obj, f.x0, f.y0)) return null;
    this.remove(f.x0, f.y0);
    const item = FURNITURE[f.type].item;
    const x = (f.x0 + f.obj.w / 2) * T;
    const y = (f.y0 + f.obj.h - 0.5) * T;
    this.scene.drops.spawn(item, 1, x, y);
    if (f.type === 'chest') this.scene.spillChest(f.x0, f.y0, x, y); // lo que tenía adentro cae al suelo
    return item;
  }

  // -------------------------------------------------------------- puertas

  _key(x0, y0) {
    return y0 * 100000 + x0;
  }

  _setDoor(f, open) {
    audio.play('door', { x: (f.x0 + 0.5) * T, y: (f.y0 + 1.5) * T });
    const obj = open ? OBJECTS.door_open : OBJECTS.door_closed;
    for (let dy = 0; dy < obj.h; dy++) this.world.setTile(f.x0, f.y0 + dy, obj.ids[dy][0]);
  }

  _playerInDoorway(f) {
    const p = this.player;
    return p.x < (f.x0 + 1) * T && p.x + p.w > f.x0 * T && p.y < (f.y0 + f.obj.h) * T && p.y + p.h > f.y0 * T;
  }

  /** El jugador camina contra una puerta cerrada en la zona (x, y, w, h): se abre sola. */
  openDoorsAt(x, y, w, h) {
    let opened = false;
    const x0 = Math.floor(x / T);
    const x1 = Math.floor((x + w - 0.001) / T);
    const y0 = Math.floor(y / T);
    const y1 = Math.floor((y + h - 0.001) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const part = PART[this.world.getTile(tx, ty)];
        if (!part || part.object !== OBJECTS.door_closed) continue;
        const f = this.at(tx, ty);
        this._setDoor(f, true);
        this.autoDoors.set(this._key(f.x0, f.y0), { x0: f.x0, y0: f.y0, away: 0 });
        opened = true;
      }
    }
    return opened;
  }

  toggleDoor(f) {
    this.autoDoors.delete(this._key(f.x0, f.y0)); // abierta a mano: queda abierta
    if (f.obj === OBJECTS.door_closed) {
      this._setDoor(f, true);
      return true;
    }
    if (this._playerInDoorway(f)) {
      this.scene.events.emit('toast', 'Sal de la puerta para cerrarla');
      return false;
    }
    this._setDoor(f, false);
    return true;
  }

  /** Cierra las puertas que se abrieron al pasar, cuando el jugador ya se alejó. */
  update(dt) {
    if (this.autoDoors.size === 0) return;
    const p = this.player;
    for (const [key, d] of this.autoDoors) {
      const f = this.at(d.x0, d.y0);
      if (!f || f.obj !== OBJECTS.door_open || f.x0 !== d.x0 || f.y0 !== d.y0) {
        this.autoDoors.delete(key);
        continue;
      }
      // Lejos = fuera de la columna de la puerta con un margen (para no cerrarla en la cara)
      const near =
        p.x < (d.x0 + 1) * T + 10 && p.x + p.w > d.x0 * T - 10 && p.y < (d.y0 + f.obj.h) * T && p.y + p.h > d.y0 * T;
      d.away = near || p.dead ? 0 : d.away + dt;
      if (d.away >= DOOR_CLOSE_DELAY) {
        this._setDoor(f, false);
        this.autoDoors.delete(key);
      }
    }
  }

  // --------------------------------------------------------------- usar

  /** Usar el mueble de (tx, ty): abrir/cerrar la puerta, sentarse o acostarse. */
  interact(tx, ty) {
    const f = this.at(tx, ty);
    const p = this.player;
    if (!f || p.dead) return false;
    if (f.type === 'door') return this.toggleDoor(f);
    if (f.type === 'chair') {
      p.sit(this.chairSeat(f));
      return true;
    }
    if (f.type === 'bed') {
      p.sit(this.bedSeat(f));
      this.scene.setBedSpawn(f.x0, f.y0);
      return true;
    }
    if (f.type === 'chest') {
      this.scene.openChest(f.x0, f.y0);
      audio.play('chest');
      return true;
    }
    return false;
  }

  /** Sentado en la silla: sobre el asiento, mirando hacia donde mira la silla. */
  chairSeat(f) {
    const p = this.player;
    const facing = f.obj.mirrored ? -1 : 1;
    const centerX = f.x0 * T + (facing > 0 ? 14 : T - 14);
    return {
      kind: 'chair',
      x0: f.x0,
      y0: f.y0,
      facing,
      x: centerX - p.w / 2,
      y: (f.y0 + f.obj.h) * T - p.h - CHAIR_LIFT,
      angle: 0,
    };
  }

  /** Acostado en la cama: cabeza sobre la almohada, cuerpo sobre el colchón. */
  bedSeat(f) {
    const p = this.player;
    const left = !f.obj.mirrored; // cabecera a la izquierda
    const floor = (f.y0 + f.obj.h) * T;
    const feetX = f.x0 * T + (left ? 76 : f.obj.w * T - 76);
    const lying = floor - 40; // altura de la línea del cuerpo (colchón a 32 px del piso)
    return {
      kind: 'bed',
      x0: f.x0,
      y0: f.y0,
      facing: left ? 1 : -1,
      angle: left ? -90 : 90,
      x: feetX - p.w / 2,
      y: lying - p.h,
      head: [feetX + (left ? -52 : 52), lying - 8],
      ...this.bedStandSpot(f),
    };
  }

  /** Dónde queda parado el jugador al levantarse de la cama (o al reaparecer en ella). */
  bedStandSpot(f) {
    const p = this.player;
    return { standX: (f.x0 + f.obj.w / 2) * T - p.w / 2, standY: (f.y0 + f.obj.h) * T - p.h };
  }

  /** ¿Sigue habiendo una cama con su esquina en (x0, y0)? */
  bedAt(x0, y0) {
    const f = this.at(x0, y0);
    return f && f.type === 'bed' && f.x0 === x0 && f.y0 === y0 ? f : null;
  }
}
