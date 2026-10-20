import Phaser from 'phaser';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_CHUNKS_X,
  WORLD_CHUNKS_Y,
  CHUNK_SIZE,
  CHUNK_SHIFT,
  CHUNK_MASK,
} from '../config.js';
import { BLOCK, IS_SOLID } from './blocks.js';
import { WorldGenerator } from './WorldGenerator.js';

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

// Compresión RLE (pares valor/repeticiones) + base64 para guardar chunks modificados
function encodeChunk(data) {
  let out = '';
  let i = 0;
  while (i < data.length) {
    const v = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === v && run < 255) run++;
    out += String.fromCharCode(v, run);
    i += run;
  }
  return btoa(out);
}

function decodeChunk(text) {
  const bin = atob(text);
  const data = new Uint8Array(CHUNK_AREA);
  let p = 0;
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const v = bin.charCodeAt(i);
    const run = bin.charCodeAt(i + 1);
    if (p + run > CHUNK_AREA) return null;
    data.fill(v, p, p + run);
    p += run;
  }
  return p === CHUNK_AREA ? data : null;
}

/**
 * Datos del mundo, divididos en chunks de CHUNK_SIZE × CHUNK_SIZE.
 * - Los chunks se generan bajo demanda (solo cuando alguien los consulta).
 * - Los chunks sin modificar se pueden liberar y volver a generar igual.
 * - Solo los chunks modificados por el jugador se guardan.
 * Emite 'tileChanged' (tx, ty, nuevoId, idAnterior) al cambiar un bloque.
 */
export class World extends Phaser.Events.EventEmitter {
  constructor(seed) {
    super();
    this.seed = seed >>> 0;
    this.generator = new WorldGenerator(this.seed);
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.chunks = new Array(WORLD_CHUNKS_X * WORLD_CHUNKS_Y).fill(null);
    this.modified = new Set();

    // Por columna: primera fila sólida desde arriba (sobre ella hay luz de cielo)
    this.skyTop = new Int16Array(WORLD_WIDTH);
    for (let x = 0; x < WORLD_WIDTH; x++) this.skyTop[x] = this.generator.computeSkyTop(x);
  }

  /** Datos de un chunk (lo genera si todavía no existe en memoria). */
  getChunk(cx, cy) {
    const key = cy * WORLD_CHUNKS_X + cx;
    let chunk = this.chunks[key];
    if (chunk === null) {
      chunk = this.generator.generateChunk(cx, cy);
      this.chunks[key] = chunk;
    }
    return chunk;
  }

  /** Id del bloque en una posición (en tiles). Fuera del mundo: roca madre (o aire arriba). */
  getTile(tx, ty) {
    if (ty < 0) return BLOCK.AIR;
    if (tx < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return BLOCK.BEDROCK;
    const cx = tx >> CHUNK_SHIFT;
    const cy = ty >> CHUNK_SHIFT;
    let chunk = this.chunks[cy * WORLD_CHUNKS_X + cx];
    if (chunk === null) chunk = this.getChunk(cx, cy);
    return chunk[((ty & CHUNK_MASK) << CHUNK_SHIFT) | (tx & CHUNK_MASK)];
  }

  isSolid(tx, ty) {
    return IS_SOLID[this.getTile(tx, ty)] === 1;
  }

  getWall(tx, ty) {
    return this.generator.wallAt(tx, ty);
  }

  /** Cambia un bloque. Devuelve true si cambió algo. */
  setTile(tx, ty, id) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return false;
    const cx = tx >> CHUNK_SHIFT;
    const cy = ty >> CHUNK_SHIFT;
    const chunk = this.getChunk(cx, cy);
    const i = ((ty & CHUNK_MASK) << CHUNK_SHIFT) | (tx & CHUNK_MASK);
    const old = chunk[i];
    if (old === id) return false;
    chunk[i] = id;
    this.modified.add(cy * WORLD_CHUNKS_X + cx);
    this._updateSkyTop(tx, ty, id);
    this.emit('tileChanged', tx, ty, id, old);
    return true;
  }

  _updateSkyTop(tx, ty, id) {
    const top = this.skyTop[tx];
    if (IS_SOLID[id]) {
      if (ty < top) this.skyTop[tx] = ty;
    } else if (ty === top) {
      let y = ty + 1;
      while (y < WORLD_HEIGHT && !this.isSolid(tx, y)) y++;
      this.skyTop[tx] = y;
    }
  }

  _scanSkyTop(x) {
    let y = 0;
    while (y < WORLD_HEIGHT && !this.isSolid(x, y)) y++;
    return y;
  }

  /** Libera de memoria un chunk que no fue modificado (se regenerará si hace falta). */
  releaseChunk(cx, cy) {
    const key = cy * WORLD_CHUNKS_X + cx;
    if (!this.modified.has(key)) this.chunks[key] = null;
  }

  /** Cantidad de chunks con datos en memoria (para el modo debug). */
  countChunksInMemory() {
    let n = 0;
    for (const c of this.chunks) if (c !== null) n++;
    return n;
  }

  /** Chunks modificados, comprimidos, para el guardado. */
  serialize() {
    const out = {};
    for (const key of this.modified) {
      const chunk = this.chunks[key];
      if (chunk) out[key] = encodeChunk(chunk);
    }
    return out;
  }

  /** Restaura los chunks modificados de una partida guardada. */
  restore(saved) {
    const columns = new Set();
    for (const [k, text] of Object.entries(saved || {})) {
      const key = Number(k);
      if (!Number.isInteger(key) || key < 0 || key >= this.chunks.length) continue;
      let data = null;
      try {
        data = decodeChunk(text);
      } catch (e) {
        data = null;
      }
      if (!data) continue;
      this.chunks[key] = data;
      this.modified.add(key);
      const cx = key % WORLD_CHUNKS_X;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) columns.add(cx * CHUNK_SIZE + lx);
    }
    for (const x of columns) this.skyTop[x] = this._scanSkyTop(x);
  }
}
