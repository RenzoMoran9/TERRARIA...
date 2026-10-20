import {
  TILE_SIZE,
  CHUNK_SIZE,
  CHUNK_SHIFT,
  CHUNK_MASK,
  WORLD_CHUNKS_X,
  WORLD_CHUNKS_Y,
  CHUNK_LOAD_MARGIN,
  CHUNKS_PER_FRAME,
  DEPTH,
} from '../config.js';
import { IS_SOLID, WALL } from './blocks.js';
import { getViewRect } from '../systems/view.js';

const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;

/**
 * Carga y descarga la parte visual del mundo según la posición de la cámara.
 * Cada chunk visible es un Tilemap de Phaser con 2 capas: paredes de fondo y bloques.
 * Los chunks lejanos se destruyen (y sus datos se liberan si no fueron modificados).
 */
export class ChunkManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.loaded = new Map(); // clave → { cx, cy, map, walls, blocks, empty }
    this._pending = [];
    this._view = { x: 0, y: 0, width: 0, height: 0 };
    world.on('tileChanged', this.onTileChanged, this);
  }

  /** Revisa qué chunks deberían estar cargados. Con loadAll=true carga todos de una vez. */
  update(camera, loadAll = false) {
    const v = getViewRect(camera, this._view);
    const minCX = Math.max(0, Math.floor(v.x / CHUNK_PX) - CHUNK_LOAD_MARGIN);
    const maxCX = Math.min(WORLD_CHUNKS_X - 1, Math.floor((v.x + v.width) / CHUNK_PX) + CHUNK_LOAD_MARGIN);
    const minCY = Math.max(0, Math.floor(v.y / CHUNK_PX) - CHUNK_LOAD_MARGIN);
    const maxCY = Math.min(WORLD_CHUNKS_Y - 1, Math.floor((v.y + v.height) / CHUNK_PX) + CHUNK_LOAD_MARGIN);

    // Descargar los que quedaron lejos (1 chunk de tolerancia para no cargar/descargar en bucle)
    for (const [key, entry] of this.loaded) {
      if (entry.cx < minCX - 1 || entry.cx > maxCX + 1 || entry.cy < minCY - 1 || entry.cy > maxCY + 1) {
        this.unload(key);
        this.world.releaseChunk(entry.cx, entry.cy);
      }
    }

    // Cargar los que faltan, primero los más cercanos al centro de la pantalla
    const pending = this._pending;
    pending.length = 0;
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = cy * WORLD_CHUNKS_X + cx;
        if (!this.loaded.has(key)) pending.push(key);
      }
    }
    if (pending.length === 0) return;

    const ccx = (v.x + v.width / 2) / CHUNK_PX - 0.5;
    const ccy = (v.y + v.height / 2) / CHUNK_PX - 0.5;
    const dist = (key) => {
      const dx = (key % WORLD_CHUNKS_X) - ccx;
      const dy = Math.floor(key / WORLD_CHUNKS_X) - ccy;
      return dx * dx + dy * dy;
    };
    if (!loadAll) pending.sort((a, b) => dist(a) - dist(b));
    const n = loadAll ? pending.length : Math.min(pending.length, CHUNKS_PER_FRAME);
    for (let i = 0; i < n; i++) {
      const key = pending[i];
      this.load(key % WORLD_CHUNKS_X, Math.floor(key / WORLD_CHUNKS_X));
    }
  }

  load(cx, cy) {
    const key = cy * WORLD_CHUNKS_X + cx;
    const data = this.world.getChunk(cx, cy);
    const gen = this.world.generator;
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;

    // Chunks de puro cielo: no se crea ningún tilemap (ahorra memoria y tiempo)
    if (this._isEmpty(data, x0, y0)) {
      this.loaded.set(key, { cx, cy, empty: true });
      return;
    }

    const map = this.scene.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
    });
    const tileset = map.addTilesetImage('tileset', 'tileset', TILE_SIZE, TILE_SIZE, 1, 2);
    const px = x0 * TILE_SIZE;
    const py = y0 * TILE_SIZE;
    const walls = map.createBlankLayer('walls', tileset, px, py).setDepth(DEPTH.WALLS);
    const blocks = map.createBlankLayer('blocks', tileset, px, py).setDepth(DEPTH.BLOCKS);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = data[ly * CHUNK_SIZE + lx];
        if (id !== 0) blocks.putTileAt(id, lx, ly, false);
        // La pared solo se dibuja donde no la tapa un bloque sólido
        if (!IS_SOLID[id]) {
          const w = gen.wallAt(x0 + lx, y0 + ly);
          if (w !== WALL.NONE) walls.putTileAt(w, lx, ly, false);
        }
      }
    }
    this.loaded.set(key, { cx, cy, map, walls, blocks, empty: false });
  }

  _isEmpty(data, x0, y0) {
    for (let i = 0; i < data.length; i++) if (data[i] !== 0) return false;
    // Sin bloques; ¿tiene alguna pared? (las paredes empiezan debajo de la superficie)
    const surface = this.world.generator.surface;
    const bottom = y0 + CHUNK_SIZE - 1;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) if (bottom >= surface[x0 + lx] + 1) return false;
    return true;
  }

  unload(key) {
    const entry = this.loaded.get(key);
    if (!entry) return;
    if (entry.map) entry.map.destroy();
    this.loaded.delete(key);
  }

  /** Actualiza solo el tile modificado del chunk visible correspondiente. */
  onTileChanged(tx, ty, id) {
    const cx = tx >> CHUNK_SHIFT;
    const cy = ty >> CHUNK_SHIFT;
    const key = cy * WORLD_CHUNKS_X + cx;
    const entry = this.loaded.get(key);
    if (!entry) return;
    if (entry.empty) {
      // Se colocó algo en un chunk de cielo: ahora sí necesita tilemap
      this.loaded.delete(key);
      this.load(cx, cy);
      return;
    }
    const lx = tx & CHUNK_MASK;
    const ly = ty & CHUNK_MASK;
    entry.blocks.putTileAt(id === 0 ? -1 : id, lx, ly, false);
    entry.walls.putTileAt(IS_SOLID[id] ? WALL.NONE : this.world.getWall(tx, ty), lx, ly, false);
  }

  destroy() {
    this.world.off('tileChanged', this.onTileChanged, this);
    for (const key of [...this.loaded.keys()]) this.unload(key);
  }
}
