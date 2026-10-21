import { TILE_SIZE, DEPTH, WORLD_WIDTH } from '../config.js';
import { textStyle } from '../ui/styles.js';
import { frameCount } from './Placeholders.js';
import { audio } from './Audio.js';

const T = TILE_SIZE;
const EPS = 0.001;
const MAX_STEP = 8;
const GRAVITY = 1700;
const ARRIVAL_CHECK = 3; // segundos entre revisiones de llegada y de casas
const TALK_RANGE = 6 * T;

/**
 * Aldeanos (como los NPC de Terraria): viven en casas válidas (ver Housing).
 * arrive = condición para que llegue (además de que haya una casa libre, salvo el Guía).
 */
export const NPC_TYPES = {
  guide: {
    name: 'Guía',
    texture: 'npc_guide',
    speed: 60,
    greet: ['¡Hola! Soy el Guía. Si necesitas ayuda, háblame.', 'Construye casas válidas: así vendrán más aldeanos.'],
  },
  merchant: {
    name: 'Comerciante',
    texture: 'npc_merchant',
    speed: 55,
    arriveText: 'Llega cuando juntas 50 monedas de cobre y hay una casa libre',
    greet: ['¿Comprar? ¿Vender? Tengo de todo… bueno, casi todo.', 'Las monedas no crecen en los árboles. Las sueltan los enemigos.', 'Te compro lo que encuentres, a buen precio. Más o menos.'],
  },
  nurse: {
    name: 'Enfermera',
    texture: 'npc_nurse',
    speed: 58,
    arriveText: 'Llega cuando tienes más de 100 de vida máxima y vive el Comerciante',
    greet: ['¿Estás herido? Puedo curarte… por un precio.', 'Deja de pelear con todo lo que se mueve, ¿sí?', 'Una manzana al día… no, mejor una poción.'],
  },
};

/** Consejos del Guía */
export const GUIDE_TIPS = [
  'Tala árboles para conseguir madera. Con madera haces tablones y una mesa de trabajo.',
  'Cerca de la mesa de trabajo puedes fabricar picos, espadas, puertas, sillas, mesas y camas.',
  'Una casa necesita un marco de bloques, paredes de fondo, una puerta, una luz, una silla y una mesa. Usa "Revisar casa".',
  'Los zombis no abren puertas. Una casa cerrada te protege de noche.',
  'Duerme en una cama para pasar la noche rápido; además será tu punto de reaparición.',
  'Con el Horno fundes el mineral de hierro en lingotes. Con 5 lingotes haces un Yunque.',
  'El vidrio sale de la arena en el Horno. Con vidrio haces ventanas para tus casas.',
  'Las plataformas de madera sirven de escaleras: se atraviesan saltando y bajas apretando abajo.',
  'Cada nivel te da un punto de habilidad. Abre Habilidades con la K (o tocando tu nivel).',
  'Lejos del inicio hay zonas nuevas: desierto, tundra, selva, tierras sombrías, cristal y un volcán.',
  'En el desierto hay una pirámide con un cofre del tesoro adentro.',
  'La lava quema: no te quedes encima. El volcán es la zona más peligrosa.',
  'Los enemigos sueltan monedas. Con 50 de cobre vendrá el Comerciante, si tiene una casa libre.',
  'Cuando tengas más de 100 de vida máxima, la Enfermera vendrá a curarte (cobra, claro).',
  'Para minar piedra sombría o cristal necesitas un pico de hierro.',
  'La espada de cristal es la más fuerte: necesitas cristal y lingotes de hierro.',
  'Si te quedas sin espacio, guarda cosas en un cofre.',
];

class Npc {
  constructor(manager, type, x, y, home = null) {
    this.manager = manager;
    this.scene = manager.scene;
    this.world = manager.world;
    this.type = type;
    this.def = NPC_TYPES[type];
    this.w = 22;
    this.h = 56;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.home = home; // clave del cuarto donde vive ("x0,y1") o null
    this.wanderTimer = 1 + Math.random() * 2;
    this.dir = 0;
    this.blocked = 0;
    this.time = Math.random() * 10;
    this.talkTime = 0;
    this.sprite = this.scene.add.image(0, 0, this.def.texture, 0).setOrigin(0.5, 1).setDepth(DEPTH.ENEMY - 0.2);
    this.tag = this.scene.add
      .text(0, 0, this.def.name, textStyle({ fontSize: '12px', strokeThickness: 3, color: '#ffe28a' }))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.FLOATING_TEXT - 0.5)
      .setVisible(false);
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

  moveX(dx) {
    while (dx !== 0) {
      const step = dx > 0 ? Math.min(dx, MAX_STEP) : Math.max(dx, -MAX_STEP);
      dx -= step;
      const nx = this.x + step;
      if (!this.collides(nx, this.y)) {
        this.x = nx;
        continue;
      }
      // Los aldeanos sí abren puertas (y se cierran solas cuando se alejan)
      if (this.scene.furniture.openDoorsAt(nx, this.y, this.w, this.h) && !this.collides(nx, this.y)) {
        this.x = nx;
        continue;
      }
      if (this.onGround && !this.collides(this.x, this.y - T) && !this.collides(nx, this.y - T)) {
        this.y -= T;
        this.x = nx;
        continue;
      }
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
      if (step > 0) {
        const row = Math.floor((ny + this.h - EPS) / T);
        if (this.y + this.h <= row * T + EPS) {
          for (let tx = Math.floor(this.x / T); tx <= Math.floor((this.x + this.w - EPS) / T); tx++) {
            if (this.world.isPlatform(tx, row)) {
              this.y = row * T - this.h;
              this.onGround = true;
              this.vy = 0;
              return;
            }
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

  /** Pasea: de día por su casa y alrededores; de noche se queda adentro. */
  update(dt, night) {
    this.time += dt;
    this.talkTime = Math.max(0, this.talkTime - dt);
    const room = this.manager.roomOf(this);
    let minX = this.manager.spawnX - 10 * T;
    let maxX = this.manager.spawnX + 10 * T;
    if (room) {
      const margin = night ? 0 : 6;
      minX = (room.x0 - margin) * T;
      maxX = (room.x1 + 1 + margin) * T - this.w;
    }
    if (this.talkTime > 0) this.dir = 0;
    else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1.5 + Math.random() * 3;
        this.dir = Math.random() < 0.45 ? 0 : Math.random() < 0.5 ? -1 : 1;
      }
      if (this.x < minX) this.dir = 1;
      else if (this.x > maxX) this.dir = -1;
    }
    if (this.dir !== 0) this.facing = this.dir;
    const target = this.dir * this.def.speed;
    this.vx += Math.max(-600 * dt, Math.min(600 * dt, target - this.vx));
    this.vy = Math.min(this.vy + GRAVITY * dt, 900);
    const blocked = this.moveX(this.vx * dt);
    this.moveY(this.vy * dt);
    this.blocked = blocked && this.onGround ? this.blocked + dt : 0;
    if (this.blocked > 0.6) {
      this.dir = -this.dir; // contra una pared: se da vuelta
      this.blocked = 0;
    }
    this.sync();
  }

  sync() {
    const s = this.sprite;
    const frames = this.manager.frames[this.type];
    let frame = 0;
    if (this.talkTime > 0) frame = 5;
    else if (this.onGround && Math.abs(this.vx) > 10) frame = 1 + (Math.floor(this.time * 7) % 4);
    if (frames > frame) s.setFrame(frame, false, false);
    s.setScale(48 / s.frame.width, 64 / s.frame.height).setPosition(this.centerX, this.y + this.h).setFlipX(this.facing < 0);
    // Dentro de una casa vista desde afuera, la fachada lo tapa
    const hidden = this.manager.hiddenByFacade(this);
    s.setAlpha(1 - hidden);
    const p = this.scene.player;
    const near = Math.hypot(p.centerX - this.centerX, p.centerY - this.centerY) < TALK_RANGE && hidden < 0.5;
    this.tag.setVisible(near).setPosition(this.centerX, this.y - 4);
  }

  /** Se gira hacia el jugador y "habla" un momento. */
  faceTalk(px) {
    this.facing = px >= this.centerX ? 1 : -1;
    this.talkTime = 3;
    this.vx = 0;
  }

  contains(x, y) {
    return x > this.x - 6 && x < this.x + this.w + 6 && y > this.y - 6 && y < this.y + this.h + 4;
  }

  destroy() {
    this.sprite.destroy();
    this.tag.destroy();
  }
}

/**
 * Aldeanos: el Guía está desde el principio; los demás llegan cuando se cumple su condición
 * y hay una casa válida libre. Cada uno se queda en su casa (si la casa deja de ser válida, se queda sin casa).
 */
export class Npcs {
  constructor(scene, world, housing, saved = []) {
    this.scene = scene;
    this.world = world;
    this.housing = housing;
    this.list = [];
    this.timer = 0.5;
    this.frames = {};
    for (const [type, def] of Object.entries(NPC_TYPES)) this.frames[type] = frameCount(scene, def.texture);
    this.spawnX = scene.spawn.x;
    this.spawnY = scene.spawn.y;
    for (const n of Array.isArray(saved) ? saved : []) {
      if (!NPC_TYPES[n.type] || this.has(n.type)) continue;
      this.list.push(new Npc(this, n.type, n.x, n.y, n.home || null));
    }
    // El Guía está desde el principio (como en Terraria)
    if (!this.has('guide')) this.list.push(new Npc(this, 'guide', this.spawnX + 3 * T, this.spawnY));
    // Las casas que ya existían están ocupadas por sus aldeanos guardados
    this._unstuckAll();
  }

  has(type) {
    return this.list.some((n) => n.type === type);
  }

  get(type) {
    return this.list.find((n) => n.type === type) || null;
  }

  /** Cuarto (de Housing) donde vive el aldeano, si sigue siendo una casa válida. */
  roomOf(npc) {
    if (!npc.home) return null;
    return this.housing.rooms.find((r) => r.valid && roomKey(r) === npc.home) || null;
  }

  /** ¿Cuánto lo tapa la fachada de la casa donde está? (0..1) */
  hiddenByFacade(npc) {
    const tx = Math.floor(npc.centerX / T);
    const ty = Math.floor(npc.centerY / T);
    const k = ty * WORLD_WIDTH + tx;
    for (const r of this.housing.rooms) if (r.tiles.has(k)) return r.alpha;
    return 0;
  }

  /** Casas válidas sin dueño */
  freeRooms() {
    const taken = new Set(this.list.map((n) => n.home).filter(Boolean));
    return this.housing.rooms.filter((r) => r.valid && !taken.has(roomKey(r)));
  }

  /** Quién vive en el cuarto (o null) */
  ownerOf(room) {
    const k = roomKey(room);
    return this.list.find((n) => n.home === k) || null;
  }

  /** Lugar en el piso de un cuarto donde puede pararse un aldeano */
  floorSpot(room) {
    const xs = [];
    for (const k of room.tiles) {
      const x = k % WORLD_WIDTH;
      const y = Math.floor(k / WORLD_WIDTH);
      if (y === room.y1 && this.world.isFloor(x, y + 1) && room.tiles.has(k - WORLD_WIDTH)) xs.push(x);
    }
    if (!xs.length) return null;
    xs.sort((a, b) => a - b);
    const x = xs[Math.floor(xs.length / 2)];
    return { x: x * T + (T - 22) / 2, y: (room.y1 + 1) * T - 56 };
  }

  update(dt) {
    const night = this.scene.dayNight.isNight();
    for (const n of this.list) n.update(dt, night);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = ARRIVAL_CHECK;
    this._checkHomes(night);
    this._checkArrivals();
  }

  _checkHomes(night) {
    for (const n of this.list) {
      if (n.home && !this.roomOf(n)) {
        n.home = null;
        this.scene.events.emit('toast', `${n.def.name} se quedó sin casa`);
      }
      // Sin casa: toma una libre
      if (!n.home) {
        const room = this.freeRooms()[0];
        if (room) {
          n.home = roomKey(room);
          this.scene.events.emit('toast', `${n.def.name} se mudó a tu casa`);
          audio.play('house');
        }
      }
      // De noche (o si quedó lejos o trabado) vuelve a su casa
      const room = this.roomOf(n);
      if (room) {
        const far = Math.abs(n.centerX - (room.x0 + room.x1 + 1) * T * 0.5) > 30 * T;
        const outsideAtNight = night && this.hiddenByFacade(n) === 0 && !room.tiles.has(Math.floor(n.centerY / T) * WORLD_WIDTH + Math.floor(n.centerX / T));
        if (far || (outsideAtNight && !this._playerNear(n)) || n.collides(n.x, n.y)) this._teleportHome(n, room);
      } else if (Math.abs(n.centerX - this.spawnX) > 40 * T || n.collides(n.x, n.y)) {
        n.x = this.spawnX;
        n.y = this.spawnY;
        n.vy = 0;
      }
    }
  }

  _playerNear(n) {
    const p = this.scene.player;
    return Math.abs(p.centerX - n.centerX) < 25 * T;
  }

  _teleportHome(n, room) {
    const spot = this.floorSpot(room);
    if (!spot) return;
    n.x = spot.x;
    n.y = spot.y;
    n.vx = 0;
    n.vy = 0;
  }

  /** Condiciones de llegada de cada aldeano (como en Terraria) */
  _checkArrivals() {
    const gs = this.scene;
    const want = [];
    if (!this.has('merchant') && gs.coins >= 50) want.push('merchant');
    if (!this.has('nurse') && this.has('merchant') && gs.player.maxHealth > 100) want.push('nurse');
    for (const type of want) {
      const room = this.freeRooms()[0];
      if (!room) return;
      const spot = this.floorSpot(room);
      if (!spot) continue;
      const npc = new Npc(this, type, spot.x, spot.y, roomKey(room));
      this.list.push(npc);
      gs.events.emit('npcArrived', type);
      audio.play('zone');
    }
  }

  /** El aldeano en la posición del mundo (x, y), si hay uno cerca del jugador. */
  at(x, y) {
    const p = this.scene.player;
    for (const n of this.list) {
      if (!n.contains(x, y)) continue;
      if (Math.hypot(p.centerX - n.centerX, p.centerY - n.centerY) > TALK_RANGE) continue;
      return n;
    }
    return null;
  }

  /** Que los aldeanos traben las puertas igual que el jugador (no se cierran en su cara) */
  bodies() {
    return this.list;
  }

  _unstuckAll() {
    for (const n of this.list) for (let i = 0; i < 6 && n.collides(n.x, n.y); i++) n.y -= T;
  }

  serialize() {
    return this.list.map((n) => ({ type: n.type, x: Math.round(n.x), y: Math.round(n.y), home: n.home }));
  }

  destroy() {
    for (const n of this.list) n.destroy();
    this.list = [];
  }
}

export const roomKey = (r) => `${r.x0},${r.y1}`;
