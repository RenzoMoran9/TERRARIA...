import Phaser from 'phaser';
import {
  TILE_SIZE,
  CHUNK_SIZE,
  CHUNK_SHIFT,
  WORLD_WIDTH,
  WORLD_CHUNKS_X,
  WORLD_CHUNKS_Y,
  CHUNK_LOAD_MARGIN,
  CHUNKS_PER_FRAME,
  DEPTH,
} from '../config.js';
import { BLOCK, IS_SOLID, IS_FRAMED, WALL, WALL_MATERIAL, tileIndex, variantAt } from './blocks.js';
import { getViewRect } from '../systems/view.js';
import { frameCount } from '../systems/Placeholders.js';
import { hash2 } from './noise.js';

const T = TILE_SIZE;
const CHUNK_PX = CHUNK_SIZE * T;
const NEIGHBORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Carga y descarga la parte visual del mundo según la posición de la cámara.
 * Cada chunk visible es un Tilemap de Phaser con 2 capas (paredes y bloques)
 * más sus decoraciones: copas y ramas de árboles y el brillo de las antorchas.
 * Los chunks lejanos se destruyen (y sus datos se liberan si no fueron modificados).
 */
export class ChunkManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.loaded = new Map(); // clave → { cx, cy, map, walls, blocks, decor, empty }
    this.glows = new Set(); // brillos de antorchas visibles (para el parpadeo)
    this._pending = [];
    this._view = { x: 0, y: 0, width: 0, height: 0 };
    this.canopyFrames = frameCount(scene, 'tree_top');
    world.on('tileChanged', this.onTileChanged, this);
    world.on('wallChanged', this.onWallChanged, this);
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

  /** Parpadeo de las antorchas (se llama cada frame). */
  animate(time) {
    for (const g of this.glows) {
      const f = Math.sin(time * 0.009 + g.phase) * 0.5 + Math.sin(time * 0.023 + g.phase * 2) * 0.3;
      g.setAlpha(0.55 + f * 0.08);
      g.setScale(g.baseScale * (1 + f * 0.035));
    }
  }

  // ------------------------------------------------------------- índices de tiles

  /** Índice del tileset para el bloque en (tx, ty): variante + bordes según los vecinos. */
  blockIndex(tx, ty, id) {
    if (id === BLOCK.AIR) return -1;
    let mask = 0;
    if (IS_FRAMED[id]) {
      const w = this.world;
      if (IS_SOLID[w.getTile(tx, ty - 1)]) mask |= 1;
      if (IS_SOLID[w.getTile(tx + 1, ty)]) mask |= 2;
      if (IS_SOLID[w.getTile(tx, ty + 1)]) mask |= 4;
      if (IS_SOLID[w.getTile(tx - 1, ty)]) mask |= 8;
    }
    return tileIndex(id, variantAt(tx, ty), mask);
  }

  wallIndex(tx, ty, id) {
    if (IS_SOLID[id]) return -1; // tapada por un bloque sólido
    const wall = this.world.getWall(tx, ty);
    return wall === WALL.NONE ? -1 : tileIndex(WALL_MATERIAL[wall], variantAt(tx, ty), 0);
  }

  // ------------------------------------------------------------------ carga

  load(cx, cy) {
    const key = cy * WORLD_CHUNKS_X + cx;
    const data = this.world.getChunk(cx, cy);
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;

    // Chunks de puro cielo: no se crea ningún tilemap (ahorra memoria y tiempo)
    if (this._isEmpty(data, x0, y0)) {
      this.loaded.set(key, { cx, cy, empty: true });
      return;
    }

    const map = this.scene.make.tilemap({ tileWidth: T, tileHeight: T, width: CHUNK_SIZE, height: CHUNK_SIZE });
    const tileset = map.addTilesetImage('tileset', 'tileset', T, T, 1, 2);
    const walls = map.createBlankLayer('walls', tileset, x0 * T, y0 * T).setDepth(DEPTH.WALLS);
    const blocks = map.createBlankLayer('blocks', tileset, x0 * T, y0 * T).setDepth(DEPTH.BLOCKS);
    const entry = { cx, cy, map, walls, blocks, decor: new Map(), empty: false };

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = x0 + lx;
        const ty = y0 + ly;
        const id = data[ly * CHUNK_SIZE + lx];
        if (id !== BLOCK.AIR) blocks.putTileAt(this.blockIndex(tx, ty, id), lx, ly, false);
        const w = this.wallIndex(tx, ty, id);
        if (w !== -1) walls.putTileAt(w, lx, ly, false);
        if (id === BLOCK.TORCH) this._addGlow(entry, tx, ty);
        else if (id === BLOCK.LOG) this._addTreeDecor(entry, tx, ty);
      }
    }
    this.loaded.set(key, entry);
  }

  _isEmpty(data, x0, y0) {
    for (let i = 0; i < data.length; i++) if (data[i] !== 0) return false;
    if (this.world.hasWallChanges(x0 / CHUNK_SIZE, y0 / CHUNK_SIZE)) return false; // paredes puestas en el aire
    // Sin bloques; ¿tiene alguna pared? (las paredes empiezan debajo de la superficie)
    const surface = this.world.generator.surface;
    const bottom = y0 + CHUNK_SIZE - 1;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) if (bottom >= surface[x0 + lx] + 1) return false;
    return true;
  }

  unload(key) {
    const entry = this.loaded.get(key);
    if (!entry) return;
    if (entry.decor) for (const k of [...entry.decor.keys()]) this._removeDecor(entry, k);
    if (entry.map) entry.map.destroy();
    this.loaded.delete(key);
  }

  // ------------------------------------------------------------ decoraciones

  _addDecor(entry, tx, ty, obj) {
    const k = ty * WORLD_WIDTH + tx;
    const list = entry.decor.get(k);
    if (list) list.push(obj);
    else entry.decor.set(k, [obj]);
  }

  _removeDecor(entry, k) {
    const list = entry.decor.get(k);
    if (!list) return;
    for (const obj of list) {
      this.glows.delete(obj);
      obj.destroy();
    }
    entry.decor.delete(k);
  }

  _addGlow(entry, tx, ty) {
    const g = this.scene.add
      .image((tx + 0.5) * T, (ty + 0.3) * T, 'fx_glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.LIGHT + 0.5);
    g.baseScale = 1.6;
    g.phase = hash2(tx, ty, 5) * 100;
    g.setScale(g.baseScale);
    this.glows.add(g);
    this._addDecor(entry, tx, ty, g);
  }

  /** Copa (en el tronco más alto) y ramitas al costado de algunos troncos. */
  _addTreeDecor(entry, tx, ty) {
    const gen = this.world.generator;
    const h = gen.treeHeight[tx];
    if (!h) return; // tronco sin árbol generado (no debería pasar)
    const surface = gen.surface[tx];
    const top = surface - h;
    if (ty === top) {
      const frame = Math.floor(hash2(tx, 3, gen.seed) * this.canopyFrames);
      const canopy = this.scene.add
        .image((tx + 0.5) * T, (top + 1) * T + 6, 'tree_top', frame)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.BLOCKS + 0.5);
      this._addDecor(entry, tx, ty, canopy);
    } else if (ty > top + 1 && ty < surface - 2 && hash2(tx, ty, gen.seed + 7) < 0.22) {
      const left = hash2(tx, ty, gen.seed + 8) < 0.5;
      const branch = this.scene.add
        .image(left ? tx * T + 4 : (tx + 1) * T - 4, (ty + 0.5) * T, 'tree_branch')
        .setOrigin(left ? 1 : 0, 0.5)
        .setFlipX(left)
        .setDepth(DEPTH.BLOCKS + 0.4);
      this._addDecor(entry, tx, ty, branch);
    }
  }

  // ---------------------------------------------------------------- cambios

  /** Actualiza el tile modificado, los bordes de sus vecinos y las decoraciones. */
  onTileChanged(tx, ty, id, old) {
    const cx = tx >> CHUNK_SHIFT;
    const cy = ty >> CHUNK_SHIFT;
    const key = cy * WORLD_CHUNKS_X + cx;
    const entry = this.loaded.get(key);
    if (entry && entry.empty) {
      // Se colocó algo en un chunk de cielo: ahora sí necesita tilemap
      this.loaded.delete(key);
      this.load(cx, cy);
    } else if (entry) {
      this._refreshCell(entry, tx, ty, id);
      entry.walls.putTileAt(this.wallIndex(tx, ty, id), tx - cx * CHUNK_SIZE, ty - cy * CHUNK_SIZE, false);
      const k = ty * WORLD_WIDTH + tx;
      if (old === BLOCK.TORCH || old === BLOCK.LOG) this._removeDecor(entry, k);
      if (id === BLOCK.TORCH) this._addGlow(entry, tx, ty);
    }
    // Los bordes de los 4 vecinos pueden cambiar
    for (const [dx, dy] of NEIGHBORS) {
      const nx = tx + dx;
      const ny = ty + dy;
      const nEntry = this.loaded.get((ny >> CHUNK_SHIFT) * WORLD_CHUNKS_X + (nx >> CHUNK_SHIFT));
      if (!nEntry || nEntry.empty || nx < 0 || ny < 0) continue;
      const nid = this.world.getTile(nx, ny);
      if (IS_FRAMED[nid]) this._refreshCell(nEntry, nx, ny, nid);
    }
  }

  /** Se puso o quitó una pared: redibujar esa celda de la capa de paredes. */
  onWallChanged(tx, ty) {
    const cx = tx >> CHUNK_SHIFT;
    const cy = ty >> CHUNK_SHIFT;
    const key = cy * WORLD_CHUNKS_X + cx;
    const entry = this.loaded.get(key);
    if (!entry) return;
    if (entry.empty) {
      this.loaded.delete(key);
      this.load(cx, cy);
      return;
    }
    const id = this.world.getTile(tx, ty);
    entry.walls.putTileAt(this.wallIndex(tx, ty, id), tx - cx * CHUNK_SIZE, ty - cy * CHUNK_SIZE, false);
  }

  _refreshCell(entry, tx, ty, id) {
    entry.blocks.putTileAt(this.blockIndex(tx, ty, id), tx - entry.cx * CHUNK_SIZE, ty - entry.cy * CHUNK_SIZE, false);
  }

  destroy() {
    this.world.off('tileChanged', this.onTileChanged, this);
    this.world.off('wallChanged', this.onWallChanged, this);
    for (const key of [...this.loaded.keys()]) this.unload(key);
  }
}
