import { WORLD_WIDTH, WORLD_HEIGHT, CHUNK_SIZE, SURFACE_LEVEL } from '../config.js';
import { BLOCK, WALL, IS_SOLID } from './blocks.js';
import { createSimplex2D, hash2 } from './noise.js';

// Forma de la copa del árbol, relativa al tronco superior (dx, dy)
const CANOPY = [
  [0, -3],
  [-1, -2], [0, -2], [1, -2],
  [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [1, 0], [2, 0],
  [-1, 1], [1, 1],
];

const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Generador procedural del mundo.
 * Todo es una función pura de (semilla, x, y): cualquier chunk se puede
 * generar en cualquier momento y en cualquier orden con el mismo resultado.
 */
export class WorldGenerator {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.nTerrain = createSimplex2D(this.seed);
    this.nCave = createSimplex2D(this.seed + 101);
    this.nCaveMask = createSimplex2D(this.seed + 202);
    this.nCavern = createSimplex2D(this.seed + 303);
    this.nOre = createSimplex2D(this.seed + 404);
    this.nSoil = createSimplex2D(this.seed + 505);

    // Datos por columna, precalculados (son pocos: 1 valor por columna)
    this.surface = new Int16Array(WORLD_WIDTH); // fila del pasto
    this.dirtDepth = new Uint8Array(WORLD_WIDTH); // grosor de la capa de tierra
    this.entrance = new Uint8Array(WORLD_WIDTH); // columnas donde las cuevas pueden salir a la superficie
    this.treeHeight = new Uint8Array(WORLD_WIDTH); // 0 = sin árbol
    this.spawnX = WORLD_WIDTH >> 1;

    this._generateColumns();
    this._generateTrees();
  }

  _generateColumns() {
    const n = this.nTerrain;
    for (let x = 0; x < WORLD_WIDTH; x++) {
      // Colinas grandes + medianas + detalle
      let h = n(x * 0.004, 0.37) * 22 + n(x * 0.015, 3.1) * 8 + n(x * 0.06, 7.7) * 2;
      // Aplanar la zona de aparición del jugador
      const d = Math.abs(x - this.spawnX);
      if (d < 30) h *= 0.2 + 0.8 * smoothstep(d / 30);
      this.surface[x] = Math.round(SURFACE_LEVEL + h);
      this.dirtDepth[x] = 5 + Math.round((this.nSoil(x * 0.05, 11.3) + 1) * 2.5);
      this.entrance[x] = d > 40 && this.nCaveMask(x * 0.03, 77.7) > 0.55 ? 1 : 0;
    }
  }

  _generateTrees() {
    const r = new Float32Array(WORLD_WIDTH);
    for (let x = 0; x < WORLD_WIDTH; x++) r[x] = hash2(x, 7, this.seed);

    for (let x = 4; x < WORLD_WIDTH - 4; x++) {
      // Zonas de bosque y zonas más despejadas
      const forest = this.nSoil(x * 0.01, 123.4);
      const density = forest > -0.25 ? 0.25 : 0.04;
      if (r[x] > density) continue;
      // Solo el mínimo local en ±5 columnas → árboles separados entre sí
      let isMin = true;
      for (let d = -5; d <= 5 && isMin; d++) {
        const xx = x + d;
        if (d !== 0 && xx >= 0 && xx < WORLD_WIDTH && r[xx] < r[x]) isMin = false;
      }
      if (!isMin) continue;
      // Terreno más o menos plano y con pasto
      const s = this.surface[x];
      if (Math.abs(this.surface[x - 1] - s) > 1 || Math.abs(this.surface[x + 1] - s) > 1) continue;
      if (this.baseTile(x, s) !== BLOCK.GRASS) continue;
      this.treeHeight[x] = 5 + Math.floor(hash2(x, 13, this.seed) * 6);
    }
  }

  /** ¿Hay cueva (aire) en esta posición subterránea? */
  isCave(x, y) {
    const depth = y - this.surface[x];
    if (depth < 0 || y >= WORLD_HEIGHT - 6) return false;
    const distSpawn = Math.abs(x - this.spawnX);
    // Cerca de la superficie solo hay cuevas en las "entradas"
    if (depth < 10 && !this.entrance[x]) return false;
    // Suelo firme bajo el punto de aparición
    if (distSpawn < 14 && depth < 18) return false;

    // Túneles: banda estrecha alrededor del cero del ruido (forma de gusano)
    const t = this.nCave(x * 0.03, y * 0.045);
    const width = 0.045 + Math.min(depth, 120) * 0.0004;
    if (t > -width && t < width && this.nCaveMask(x * 0.012, y * 0.012) > -0.35) return true;

    // Cavernas grandes en profundidad
    if (depth > 35) {
      const c = this.nCavern(x * 0.022, y * 0.035);
      if (c > 0.58 - Math.min(depth - 35, 100) * 0.0012) return true;
    }
    return false;
  }

  /** Bloque "natural" en (x, y), sin contar árboles. */
  baseTile(x, y) {
    if (y >= WORLD_HEIGHT - 3) return BLOCK.BEDROCK;
    if (y >= WORLD_HEIGHT - 6 && hash2(x, y, this.seed) < (y - (WORLD_HEIGHT - 7)) / 4) return BLOCK.BEDROCK;

    const s = this.surface[x];
    if (y < s) return BLOCK.AIR;
    if (this.isCave(x, y)) return BLOCK.AIR;

    const depth = y - s;
    if (depth === 0) return BLOCK.GRASS;

    if (depth < this.dirtDepth[x]) {
      // Capa de tierra con alguna roca suelta
      if (depth > 2 && this.nSoil(x * 0.09, y * 0.09) > 0.62) return BLOCK.STONE;
      return BLOCK.DIRT;
    }

    // Capa de piedra: bolsas de tierra y minerales
    if (depth < 90 && this.nSoil(x * 0.07 + 300, y * 0.07 + 300) > 0.6) return BLOCK.DIRT;
    if (this.nOre(x * 0.12, y * 0.12) > 0.62) return BLOCK.COAL_ORE;
    if (depth > 28 && this.nOre(x * 0.14 + 911, y * 0.14 + 911) > 0.66 - Math.min(depth, 200) * 0.0004) {
      return BLOCK.IRON_ORE;
    }
    return BLOCK.STONE;
  }

  /** Pared de fondo en (x, y) (solo decorativa). */
  wallAt(x, y) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return WALL.NONE;
    const depth = y - this.surface[x];
    if (depth < 1) return WALL.NONE;
    return depth <= this.dirtDepth[x] ? WALL.DIRT : WALL.STONE;
  }

  /** Primera fila sólida de una columna (por encima de ella llega la luz del sol). */
  computeSkyTop(x) {
    let y = Math.max(0, this.surface[x]);
    while (y < WORLD_HEIGHT && !IS_SOLID[this.baseTile(x, y)]) y++;
    return y;
  }

  /** Tile (columna, fila) donde aparece el jugador. */
  getSpawnTile() {
    return { tx: this.spawnX, ty: this.surface[this.spawnX] };
  }

  /** Genera los datos de un chunk: Uint8Array de CHUNK_SIZE × CHUNK_SIZE ids de bloque. */
  generateChunk(cx, cy) {
    const CS = CHUNK_SIZE;
    const data = new Uint8Array(CS * CS);
    const x0 = cx * CS;
    const y0 = cy * CS;

    for (let lx = 0; lx < CS; lx++) {
      const x = x0 + lx;
      // Todo lo que está sobre la superficie es aire: empezamos desde ahí
      const startLy = Math.max(0, this.surface[x] - y0);
      for (let ly = startLy; ly < CS; ly++) {
        data[ly * CS + lx] = this.baseTile(x, y0 + ly);
      }
    }

    // Árboles (incluye los de columnas vecinas cuya copa entra en este chunk)
    const minX = Math.max(0, x0 - 3);
    const maxX = Math.min(WORLD_WIDTH - 1, x0 + CS + 2);
    for (let x = minX; x <= maxX; x++) {
      const h = this.treeHeight[x];
      if (h) this._stampTree(data, x0, y0, x, this.surface[x], h);
    }
    return data;
  }

  _stampTree(data, x0, y0, tx, surfaceY, height) {
    const top = surfaceY - height;
    for (let y = surfaceY - 1; y >= top; y--) this._put(data, x0, y0, tx, y, BLOCK.LOG);
    for (const [dx, dy] of CANOPY) this._put(data, x0, y0, tx + dx, top + dy, BLOCK.LEAVES);
  }

  _put(data, x0, y0, x, y, id) {
    const lx = x - x0;
    const ly = y - y0;
    if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
    const i = ly * CHUNK_SIZE + lx;
    if (data[i] === BLOCK.AIR) data[i] = id;
  }
}
