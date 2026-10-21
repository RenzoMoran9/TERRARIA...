import Phaser from 'phaser';
import { TILE_SIZE, DEPTH, WORLD_WIDTH, WORLD_HEIGHT, CHUNK_SIZE, WORLD_CHUNKS_X } from '../config.js';
import { XP } from './Skills.js';
import { BLOCK, IS_SOLID, IS_PLATFORM, LIGHT_EMIT, PART, WALL_DEFS } from '../world/blocks.js';

const T = TILE_SIZE;
// Reglas de Terraria: el cuarto con su marco mide entre 60 y 750 bloques
const MIN_TILES = 60;
const MAX_TILES = 750;
const MAX_HOLE = 5; // huecos sin pared de fondo de 5 bloques o más (de ancho o de alto) no valen
const EVIL_LIMIT = 50; // bloques de Tierras Sombrías alrededor que hacen que nadie quiera vivir ahí
const FADE_SPEED = 5; // la fachada aparece / desaparece en ~0,2 s
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Set que además anota todo lo que se agrega en otro Set (para no repetir búsquedas fallidas). */
class SetWithTrace extends Set {
  constructor(trace) {
    super();
    this.trace = trace;
  }

  add(v) {
    this.trace?.add(v);
    return super.add(v);
  }
}

const COMFORT = new Set(['chair', 'bed']); // para sentarse
const SURFACE = new Set(['table']); // superficie plana (también la mesa de trabajo)
const EVIL = new Set([BLOCK.SHADOW_GRASS, BLOCK.SHADOW_STONE, BLOCK.PLANT_SHADOW]);

/**
 * Casas como en Terraria.
 * - Un cuarto es el espacio encerrado por un MARCO de bloques sólidos, puertas y plataformas
 *   (los bloques de adentro se conectan también en diagonal, así que las esquinas deben estar cerradas).
 * - Casa válida: 60–750 bloques con el marco, paredes de fondo puestas por el jugador (se permiten
 *   huecos chicos), una luz, algo para sentarse (silla o cama), una superficie (mesa o mesa de
 *   trabajo) y una entrada (puerta o plataforma en el marco). No vale en las Tierras Sombrías.
 * - Fachada: desde afuera, cada cuarto con paredes se ve con su frente (madera, ladrillo, ventanas…);
 *   al entrar por la puerta la fachada se desvanece y se ve el interior.
 */
export class Housing {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.rooms = []; // { tiles:Set, x0,y0,x1,y1, frame:Set, valid, facade, alpha }
    this.dirty = []; // posiciones donde cambió algo (se revisan una vez por frame)
    this.highlight = scene.add.graphics().setDepth(DEPTH.HIGHLIGHT - 0.1);
    this.highlightTimer = 0;
    this.announced = new Set(); // casas válidas ya anunciadas (por su esquina)

    this._onTile = (tx, ty, id, old) => {
      // Abrir o cerrar una puerta no cambia la casa
      if (PART[id]?.type === 'door' && PART[old]?.type === 'door') return;
      this.dirty.push([tx, ty]);
    };
    this._onWall = (tx, ty) => this.dirty.push([tx, ty]);
    world.on('tileChanged', this._onTile);
    world.on('wallChanged', this._onWall);
    // Las casas que ya existían al cargar no se anuncian (ni dan experiencia) otra vez
    this.loading = true;
    this._scanAll();
    this.loading = false;
  }

  key(tx, ty) {
    return ty * WORLD_WIDTH + tx;
  }

  /** ¿Este bloque es parte del marco de una casa? (sólido, puerta o plataforma) */
  isFrame(tx, ty) {
    const id = this.world.getTile(tx, ty);
    if (IS_SOLID[id] || IS_PLATFORM[id]) return true;
    const part = PART[id];
    return !!part && part.type === 'door';
  }

  /**
   * Espacio encerrado que incluye (tx, ty): { tiles, frame, x0..y1 } o null si no está cerrado
   * (o es más grande que una casa).
   */
  floodRoom(tx, ty, visited = null) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT || this.isFrame(tx, ty)) return null;
    const tiles = visited ? new SetWithTrace(visited) : new Set();
    const frame = new Set();
    const stack = [[tx, ty]];
    tiles.add(this.key(tx, ty));
    let x0 = tx;
    let x1 = tx;
    let y0 = ty;
    let y1 = ty;
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of N8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= WORLD_WIDTH - 1 || ny >= WORLD_HEIGHT - 1) return null;
        const k = this.key(nx, ny);
        if (tiles.has(k) || frame.has(k)) continue;
        if (this.isFrame(nx, ny)) {
          // Solo cuentan como marco los vecinos directos (no los de la diagonal)
          if (dx === 0 || dy === 0) frame.add(k);
          continue;
        }
        tiles.add(k);
        if (tiles.size > MAX_TILES) return null; // abierto o enorme
        stack.push([nx, ny]);
        if (nx < x0) x0 = nx;
        if (nx > x1) x1 = nx;
        if (ny < y0) y0 = ny;
        if (ny > y1) y1 = ny;
      }
    }
    return { tiles, frame, x0, y0, x1, y1 };
  }

  /** Huecos sin pared de fondo del jugador: devuelve el tamaño (ancho/alto) del más grande. */
  biggestHole(room) {
    const seen = new Set();
    let worst = 0;
    for (const k of room.tiles) {
      if (seen.has(k)) continue;
      const x = k % WORLD_WIDTH;
      const y = Math.floor(k / WORLD_WIDTH);
      if (this.world.hasPlayerWall(x, y)) continue;
      // Hueco: bloques vecinos (en cruz) sin pared
      let hx0 = x;
      let hx1 = x;
      let hy0 = y;
      let hy1 = y;
      const stack = [k];
      seen.add(k);
      while (stack.length) {
        const c = stack.pop();
        const cx = c % WORLD_WIDTH;
        const cy = Math.floor(c / WORLD_WIDTH);
        hx0 = Math.min(hx0, cx);
        hx1 = Math.max(hx1, cx);
        hy0 = Math.min(hy0, cy);
        hy1 = Math.max(hy1, cy);
        for (const [dx, dy] of N8.slice(0, 4)) {
          const n = this.key(cx + dx, cy + dy);
          if (seen.has(n) || !room.tiles.has(n) || this.world.hasPlayerWall(cx + dx, cy + dy)) continue;
          seen.add(n);
          stack.push(n);
        }
      }
      worst = Math.max(worst, hx1 - hx0 + 1, hy1 - hy0 + 1);
    }
    return worst;
  }

  /** ¿Cuántas paredes del jugador tiene el cuarto? (para distinguir casas de cuevas cerradas) */
  wallCount(room) {
    let n = 0;
    for (const k of room.tiles) if (this.world.hasPlayerWall(k % WORLD_WIDTH, Math.floor(k / WORLD_WIDTH))) n++;
    return n;
  }

  /**
   * Revisa la casa que incluye (tx, ty), como la consulta "?" de Terraria.
   * Devuelve { ok, room, checks: [{ ok, text }] }.
   */
  check(tx, ty) {
    const room = this.floodRoom(tx, ty);
    if (!room) {
      return {
        ok: false,
        room: null,
        checks: [{ ok: false, text: 'No es un lugar cerrado: hace falta un marco de bloques (piso, techo y costados) con una puerta o plataforma' }],
      };
    }
    const size = room.tiles.size + room.frame.size;
    const checks = [];
    checks.push({ ok: true, text: 'Cerrada por todos lados' });
    if (size < MIN_TILES) checks.push({ ok: false, text: `Es muy chica: ${size} bloques con el marco (mínimo ${MIN_TILES}, p. ej. 10 de ancho × 6 de alto)` });
    else checks.push({ ok: true, text: `Tamaño: ${size} bloques` });
    const hole = this.biggestHole(room);
    checks.push(
      hole >= MAX_HOLE
        ? { ok: false, text: 'Faltan paredes de fondo (puestas por ti) adentro' }
        : { ok: true, text: hole > 0 ? 'Paredes de fondo (con huecos chicos)' : 'Paredes de fondo completas' },
    );
    let light = false;
    let comfort = false;
    let surface = false;
    for (const k of room.tiles) {
      const id = this.world.getTile(k % WORLD_WIDTH, Math.floor(k / WORLD_WIDTH));
      if (LIGHT_EMIT[id] > 0) light = true;
      if (id === BLOCK.WORKBENCH) surface = true;
      const part = PART[id];
      if (part && COMFORT.has(part.type)) comfort = true;
      if (part && SURFACE.has(part.type)) surface = true;
    }
    let entrance = false;
    for (const k of room.frame) {
      const id = this.world.getTile(k % WORLD_WIDTH, Math.floor(k / WORLD_WIDTH));
      if (IS_PLATFORM[id] || (PART[id] && PART[id].type === 'door')) entrance = true;
    }
    checks.push({ ok: light, text: light ? 'Tiene luz' : 'Falta una luz (antorcha)' });
    checks.push({ ok: comfort, text: comfort ? 'Tiene dónde sentarse' : 'Falta algo para sentarse (silla o cama)' });
    checks.push({ ok: surface, text: surface ? 'Tiene una mesa' : 'Falta una superficie (mesa o mesa de trabajo)' });
    checks.push({ ok: entrance, text: entrance ? 'Tiene entrada' : 'Falta una entrada (puerta o plataforma)' });
    const evil = this._evilScore(room);
    if (evil >= EVIL_LIMIT) checks.push({ ok: false, text: 'Está en las Tierras Sombrías: nadie quiere vivir aquí' });
    return { ok: checks.every((c) => c.ok), room, checks };
  }

  _evilScore(room) {
    let n = 0;
    for (let y = room.y0 - 20; y <= room.y1 + 20; y += 2) {
      for (let x = room.x0 - 30; x <= room.x1 + 30; x += 2) if (EVIL.has(this.world.getTile(x, y))) n += 4;
    }
    return n;
  }

  /** Muestra el cuarto revisado: verde si es una casa válida, rojo si no. */
  showRoom(result) {
    const g = this.highlight;
    g.clear();
    if (!result.room) return;
    const color = result.ok ? 0x5be37a : 0xff6060;
    g.fillStyle(color, 0.22);
    for (const k of result.room.tiles) g.fillRect((k % WORLD_WIDTH) * T, Math.floor(k / WORLD_WIDTH) * T, T, T);
    g.lineStyle(3, color, 0.9);
    for (const k of result.room.frame) g.strokeRect((k % WORLD_WIDTH) * T + 1.5, Math.floor(k / WORLD_WIDTH) * T + 1.5, T - 3, T - 3);
    g.setAlpha(1);
    this.highlightTimer = 4;
  }

  // ------------------------------------------------------------ cuartos y fachadas

  /** Al cargar: busca los cuartos alrededor de todas las paredes puestas por el jugador. */
  _scanAll() {
    const seen = new Set();
    this.world.wallChunks.forEach((data, key) => {
      if (!data) return;
      const cx = key % WORLD_CHUNKS_X;
      const cy = Math.floor(key / WORLD_CHUNKS_X);
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const tx = cx * CHUNK_SIZE + x;
          const ty = cy * CHUNK_SIZE + y;
          if (!this.world.hasPlayerWall(tx, ty) || seen.has(this.key(tx, ty))) continue;
          seen.add(this.key(tx, ty));
          this._tryRoom(tx, ty, seen);
        }
      }
    });
  }

  /** Si (tx, ty) está en un cuarto cerrado con paredes, lo agrega (con su fachada). */
  _tryRoom(tx, ty, visited = null) {
    const k = this.key(tx, ty);
    if (this.rooms.some((r) => r.tiles.has(k))) return null;
    const room = this.floodRoom(tx, ty, visited);
    // Una cueva cerrada no es una casa: hace falta que la mayor parte tenga paredes del jugador
    if (!room || room.tiles.size < 4 || this.wallCount(room) < room.tiles.size * 0.6) return null;
    room.alpha = this._playerInside(room) ? 0 : 1;
    room.facade = this._buildFacade(room);
    room.facade.setAlpha(room.alpha);
    room.valid = this.check(tx, ty).ok;
    this.rooms.push(room);
    if (room.valid) this._announce(room);
    return room;
  }

  _announce(room) {
    const id = `${room.x0},${room.y1}`;
    if (this.announced.has(id)) return;
    this.announced.add(id);
    if (this.loading) return;
    this.scene.events.emit('toast', '¡Casa válida! Aquí podrá vivir un aldeano');
    this.scene.gainXp?.(XP.house, (room.x0 + room.x1 + 1) * T * 0.5, room.y0 * T);
    this.scene.spawnSparkles?.((room.x0 + room.x1 + 1) * T * 0.5, (room.y0 + room.y1 + 1) * T * 0.5, 14, 0x9cff9c);
  }

  _removeRoom(room) {
    room.facade.destroy();
    this.rooms.splice(this.rooms.indexOf(room), 1);
  }

  /** Frente de la casa visto desde afuera: el material de cada pared (o ventana). */
  _buildFacade(room) {
    const w = (room.x1 - room.x0 + 1) * T;
    const h = (room.y1 - room.y0 + 1) * T;
    const rt = this.scene.add.renderTexture(room.x0 * T, room.y0 * T, w, h).setOrigin(0, 0).setDepth(DEPTH.BLOCKS + 0.5);
    const shade = this.scene.add.graphics();
    for (const k of room.tiles) {
      const x = k % WORLD_WIDTH;
      const y = Math.floor(k / WORLD_WIDTH);
      if (!this.world.hasPlayerWall(x, y)) continue;
      const def = WALL_DEFS[this.world.getWall(x, y)];
      const key = def && def.facade;
      const px = (x - room.x0) * T;
      const py = (y - room.y0) * T;
      if (key && this.scene.textures.exists(key)) rt.draw(key, px, py, def.window ? 0.85 : 1);
      else if (def) {
        shade.fillStyle(def.color, 1);
        shade.fillRect(px, py, T, T);
      }
    }
    // Sombra bajo el techo y junto a los costados: da volumen al frente
    shade.fillStyle(0x000000, 0.28);
    for (const k of room.tiles) {
      const x = k % WORLD_WIDTH;
      const y = Math.floor(k / WORLD_WIDTH);
      if (!this.world.hasPlayerWall(x, y)) continue;
      const px = (x - room.x0) * T;
      const py = (y - room.y0) * T;
      if (room.frame.has(this.key(x, y - 1))) shade.fillRect(px, py, T, 6);
      if (room.frame.has(this.key(x - 1, y))) shade.fillRect(px, py, 4, T);
    }
    rt.draw(shade, 0, 0);
    shade.destroy();
    return rt;
  }

  _playerInside(room) {
    const p = this.player;
    if (p.dead) return false;
    const tx = Math.floor(p.centerX / T);
    return room.tiles.has(this.key(tx, Math.floor(p.centerY / T))) || room.tiles.has(this.key(tx, Math.floor((p.y + p.h - 2) / T)));
  }

  /** El cuarto donde está el jugador (o null). */
  roomOfPlayer() {
    return this.rooms.find((r) => this._playerInside(r)) || null;
  }

  update(dt) {
    // Cambios en bloques o paredes: se rehacen los cuartos afectados
    if (this.dirty.length) {
      const points = this.dirty;
      this.dirty = [];
      const seeds = [];
      for (const [tx, ty] of points) {
        for (const r of [...this.rooms]) {
          if (tx >= r.x0 - 1 && tx <= r.x1 + 1 && ty >= r.y0 - 1 && ty <= r.y1 + 1) {
            for (const k of r.tiles) seeds.push([k % WORLD_WIDTH, Math.floor(k / WORLD_WIDTH)]);
            this._removeRoom(r);
          }
        }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) seeds.push([tx + dx, ty + dy]);
      }
      const visited = new Set();
      for (const [x, y] of seeds) {
        if (visited.has(this.key(x, y)) || !this.world.hasPlayerWall(x, y)) continue;
        visited.add(this.key(x, y));
        this._tryRoom(x, y, visited);
      }
    }

    // Fachadas: se ven desde afuera y se desvanecen con el jugador adentro
    for (const r of this.rooms) {
      const target = this._playerInside(r) ? 0 : 1;
      if (r.alpha !== target) {
        r.alpha = target > r.alpha ? Math.min(target, r.alpha + dt * FADE_SPEED) : Math.max(target, r.alpha - dt * FADE_SPEED);
        r.facade.setAlpha(r.alpha);
      }
    }

    if (this.highlightTimer > 0) {
      this.highlightTimer -= dt;
      this.highlight.setAlpha(Phaser.Math.Clamp(this.highlightTimer, 0, 1));
      if (this.highlightTimer <= 0) this.highlight.clear();
    }
  }

  destroy() {
    this.world.off('tileChanged', this._onTile);
    this.world.off('wallChanged', this._onWall);
    for (const r of this.rooms) r.facade.destroy();
    this.rooms = [];
    this.highlight.destroy();
  }
}
