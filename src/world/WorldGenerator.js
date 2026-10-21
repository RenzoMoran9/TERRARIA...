import { WORLD_WIDTH, WORLD_HEIGHT, CHUNK_SIZE, SURFACE_LEVEL } from '../config.js';
import { BLOCK, WALL, IS_SOLID, OBJECTS } from './blocks.js';
import { createSimplex2D, hash2 } from './noise.js';

const smoothstep = (t) => t * t * (3 - 2 * t);

// Forma de los túneles de las cuevas
const TUNNEL_FREQ_Y = 0.028; // menor = túneles más altos
const TUNNEL_WIDTH = 0.1; // mayor = túneles más anchos (cuevas espaciosas para recorrer)

// ---------------------------------------------------------------------------
// Biomas (zonas). El bosque está en el centro; hacia un lado: desierto → tierras
// sombrías → cristal; hacia el otro: tundra → selva → volcán. Cuanto más lejos, más peligro.
// ---------------------------------------------------------------------------
export const BIOME = Object.freeze({ FOREST: 0, DESERT: 1, SNOW: 2, JUNGLE: 3, SHADOW: 4, CRYSTAL: 5, VOLCANO: 6 });

// top/soil/stone = bloques de la superficie, la capa de tierra y la piedra; walls = paredes naturales
// plant = planta decorativa y su probabilidad; tree = tipo de árbol (o null) y densidad
export const BIOME_INFO = [
  { name: 'Bosque', danger: 1, top: BLOCK.GRASS, soil: BLOCK.DIRT, stone: BLOCK.STONE, wallSoil: WALL.DIRT, wallStone: WALL.STONE, plant: BLOCK.PLANT, plantChance: 0.38, tree: 'forest', treeDensity: 0.25 },
  { name: 'Desierto', danger: 2, top: BLOCK.SAND, soil: BLOCK.SAND, stone: BLOCK.SANDSTONE, wallSoil: WALL.SANDSTONE, wallStone: WALL.SANDSTONE, plant: BLOCK.PLANT_DESERT, plantChance: 0.18, tree: 'cactus', treeDensity: 0.14 },
  { name: 'Tundra nevada', danger: 2, top: BLOCK.SNOW, soil: BLOCK.SNOW, stone: BLOCK.ICE, wallSoil: WALL.ICE, wallStone: WALL.ICE, plant: BLOCK.PLANT_SNOW, plantChance: 0.3, tree: 'pine', treeDensity: 0.22 },
  { name: 'Selva', danger: 3, top: BLOCK.JUNGLE_GRASS, soil: BLOCK.MUD, stone: BLOCK.STONE, wallSoil: WALL.MUD, wallStone: WALL.MUD, plant: BLOCK.PLANT_JUNGLE, plantChance: 0.55, tree: 'jungle', treeDensity: 0.4 },
  { name: 'Tierras Sombrías', danger: 3, top: BLOCK.SHADOW_GRASS, soil: BLOCK.DIRT, stone: BLOCK.SHADOW_STONE, wallSoil: WALL.SHADOW, wallStone: WALL.SHADOW, plant: BLOCK.PLANT_SHADOW, plantChance: 0.35, tree: 'shadow', treeDensity: 0.16 },
  { name: 'Tierras de Cristal', danger: 4, top: BLOCK.CRYSTAL_GRASS, soil: BLOCK.DIRT, stone: BLOCK.STONE, wallSoil: WALL.DIRT, wallStone: WALL.STONE, plant: BLOCK.PLANT_CRYSTAL, plantChance: 0.45, tree: null, treeDensity: 0 },
  { name: 'Volcán', danger: 4, top: BLOCK.ASH, soil: BLOCK.ASH, stone: BLOCK.BASALT, wallSoil: WALL.ASH, wallStone: WALL.ASH, plant: BLOCK.PLANT_VOLCANO, plantChance: 0.14, tree: null, treeDensity: 0 },
];
/** Nombre y peligro de todas las zonas: las 7 de la superficie y las 3 especiales (ver ZONE) */
export const ZONE_INFO = [
  ...BIOME_INFO,
  { name: 'Inframundo', danger: 5 },
  { name: 'Cuevas de hongos', danger: 3 },
  { name: 'Islas flotantes', danger: 3 },
];
export const TREE_TYPES = ['forest', 'pine', 'jungle', 'shadow', 'cactus'];

// Distancia (en bloques) desde el centro a la que empieza cada anillo de zonas
const RING_NEAR = 220;
const RING_MID = 470;
const RING_FAR = 740;
const BLEND = 18; // las alturas de dos zonas vecinas se mezclan en ±18 columnas
const PYRAMID_HALF = 15; // la pirámide del desierto mide 31 bloques de ancho
/** Fila donde empieza el inframundo (cavernas con lava y piedra infernal sobre la roca madre) */
export const UNDERWORLD_TOP = WORLD_HEIGHT - 50;
/** Zonas especiales (además de las 7 de la superficie): se detectan por profundidad o altura */
export const ZONE = Object.freeze({ UNDERWORLD: 7, MUSHROOM: 8, SKY: 9 });

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
    this.nBiome = createSimplex2D(this.seed + 606);

    // Datos por columna, precalculados (son pocos: 1 valor por columna)
    this.surface = new Int16Array(WORLD_WIDTH); // fila del pasto
    this.dirtDepth = new Uint8Array(WORLD_WIDTH); // grosor de la capa de tierra
    this.entrance = new Uint8Array(WORLD_WIDTH); // columnas donde las cuevas pueden salir a la superficie
    this.treeHeight = new Uint8Array(WORLD_WIDTH); // 0 = sin árbol
    this.treeType = new Uint8Array(WORLD_WIDTH); // índice en TREE_TYPES
    this.biome = new Uint8Array(WORLD_WIDTH);
    this.lavaDepth = new Uint8Array(WORLD_WIDTH); // lagos de lava del volcán (bloques de lava desde la superficie)
    this.chasm = new Uint8Array(WORLD_WIDTH); // abismos de las tierras sombrías (profundidad)
    this.spire = new Uint8Array(WORLD_WIDTH); // espiras de cristal (altura)
    this.spawnX = WORLD_WIDTH >> 1;
    // De qué lado queda el desierto (cambia con la semilla)
    this.side = hash2(1, 2, this.seed) < 0.5 ? 1 : -1;

    this._generateBiomes();
    this._generateColumns();
    this._generateFeatures();
    this._generateTrees();
    this._generateIslands();
  }

  // ------------------------------------------------------------------ islas flotantes

  /** 4 islas en el cielo, lejos de la pirámide y el volcán, cada una con un cofre del tesoro. */
  _generateIslands() {
    this.islands = [];
    this.islandTop = new Int16Array(WORLD_WIDTH).fill(WORLD_HEIGHT);
    const offsets = [-640, -300, 280, 600];
    offsets.forEach((off, i) => {
      let cx = this.spawnX + off + Math.round((hash2(i, 5, this.seed) - 0.5) * 60);
      if (Math.abs(cx - this.pyramidX) < 50) cx += 60;
      if (Math.abs(cx - this.volcanoX) < 80) cx += off > 0 ? -90 : 90;
      const half = 13 + Math.floor(hash2(i, 6, this.seed) * 5);
      cx = Math.max(half + 4, Math.min(WORLD_WIDTH - half - 5, cx));
      let ground = WORLD_HEIGHT;
      for (let x = cx - half; x <= cx + half; x++) ground = Math.min(ground, this.surface[x]);
      const top = Math.max(14, ground - 42 - Math.floor(hash2(i, 7, this.seed) * 10));
      const island = { cx, x0: cx - half, x1: cx + half, half, top, thick: 6 + Math.floor(hash2(i, 8, this.seed) * 3) };
      this.islands.push(island);
      for (let x = island.x0 - 1; x <= island.x1 + 1; x++) this.islandTop[x] = Math.min(this.islandTop[x], top - 3);
    });
  }

  /** Isla que cubre la columna x (o null) */
  islandAt(x) {
    for (const is of this.islands) if (x >= is.x0 && x <= is.x1) return is;
    return null;
  }

  /** Bloque de una isla flotante en (x, y), o 0 si es aire. */
  islandTile(x, y) {
    const is = this.islandAt(x);
    if (!is) return 0;
    const dx = (x - is.cx) / (is.half + 0.5);
    const bottom = is.top + Math.round(is.thick * Math.sqrt(Math.max(0, 1 - dx * dx)));
    if (y < is.top || y > bottom + 1) return 0;
    if (y === bottom + 1) return hash2(x, 41, this.seed) < 0.5 ? BLOCK.CLOUD : 0; // borde de nubes irregular
    if (Math.abs(dx) > 0.86) return BLOCK.CLOUD;
    if (y === is.top) return BLOCK.GRASS;
    if (y >= bottom - 1) return BLOCK.CLOUD;
    return BLOCK.DIRT;
  }

  /** Cofres de las islas: esquina superior izquierda */
  get islandChests() {
    return this.islands.map((is) => ({ x0: is.cx - 1, y0: is.top - 2 }));
  }

  // ------------------------------------------------------------------ inframundo y hongos

  /** Bloque del inframundo en (x, y), o -1 si (x, y) no es parte de él. */
  underworldTile(x, y) {
    const u = y - UNDERWORLD_TOP;
    if (u < 0) return -1;
    const ceil = 8 + Math.round(this.nTerrain(x * 0.03, 91.1) * 4);
    const floor = 34 + Math.round(this.nTerrain(x * 0.02, 92.7) * 4);
    const rock = () => (this.nOre(x * 0.15 + 333, y * 0.15) > 0.5 ? BLOCK.HELLSTONE : BLOCK.BASALT);
    if (u < ceil) return rock();
    if (u < floor) {
      if (this.nCavern(x * 0.03 + 700, y * 0.06) > 0.62) return BLOCK.BASALT; // columnas de roca
      if (u > floor - 4 && this.nSoil(x * 0.02 + 900, 3.3) > 0.15) return BLOCK.LAVA; // lagos de lava
      return BLOCK.AIR;
    }
    if (u === floor) return BLOCK.ASH;
    return rock();
  }

  /** ¿(x, y) está en una zona de cuevas de hongos? */
  inMushroom(x, y) {
    const depth = y - this.surface[x];
    if (depth < 45 || y > UNDERWORLD_TOP - 15) return false;
    return this.nCavern(x * 0.006 + 500, y * 0.01 + 500) > 0.5;
  }

  /** Zona en (x, y): las 7 de la superficie o inframundo / cuevas de hongos / islas. */
  zoneAt(x, y) {
    const tx = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(x)));
    if (y >= UNDERWORLD_TOP - 2) return ZONE.UNDERWORLD;
    if (this.inMushroom(tx, y)) return ZONE.MUSHROOM;
    const is = this.islandAt(tx);
    if (is && y < is.top + is.thick + 2 && y < this.surface[tx] - 15) return ZONE.SKY;
    return this.biome[tx];
  }

  // ------------------------------------------------------------------ biomas

  /** Bioma de una columna (por distancia al centro, con bordes irregulares). */
  _biomeOf(x) {
    const d = (x - this.spawnX) * this.side + this.nBiome(x * 0.02, 5.5) * 14;
    const a = Math.abs(d);
    if (a < RING_NEAR) return BIOME.FOREST;
    if (d > 0) return a < RING_MID ? BIOME.DESERT : a < RING_FAR ? BIOME.SHADOW : BIOME.CRYSTAL;
    return a < RING_MID ? BIOME.SNOW : a < RING_FAR ? BIOME.JUNGLE : BIOME.VOLCANO;
  }

  _generateBiomes() {
    for (let x = 0; x < WORLD_WIDTH; x++) this.biome[x] = this._biomeOf(x);
    // Centro de cada zona (pirámide, volcán)
    const center = (b) => {
      let a = -1;
      let z = -1;
      for (let x = 0; x < WORLD_WIDTH; x++) {
        if (this.biome[x] !== b) continue;
        if (a < 0) a = x;
        z = x;
      }
      return a < 0 ? -1 : (a + z) >> 1;
    };
    this.pyramidX = center(BIOME.DESERT);
    this.volcanoX = center(BIOME.VOLCANO);
  }

  biomeAt(x) {
    return this.biome[Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(x)))];
  }

  /** Altura del terreno (en bloques, + = más abajo) que tendría la columna x en el bioma b. */
  _heightIn(b, x) {
    const n = this.nTerrain;
    const base = n(x * 0.004, 0.37) * 22 + n(x * 0.015, 3.1) * 8 + n(x * 0.06, 7.7) * 2;
    switch (b) {
      case BIOME.DESERT: {
        // Dunas suaves y una explanada para la pirámide
        const dp = Math.abs(x - this.pyramidX);
        if (dp < PYRAMID_HALF + 8) return 4;
        return n(x * 0.009, 21.3) * 9 + n(x * 0.035, 22.1) * 3 + 4;
      }
      case BIOME.SNOW:
        // Montañas altas con picos
        return base * 1.3 - 12 - Math.abs(n(x * 0.02, 31.7)) * 20;
      case BIOME.JUNGLE:
        return n(x * 0.01, 41.9) * 7 + n(x * 0.05, 42.3) * 3 + 7;
      case BIOME.SHADOW:
        return base * 0.8 + 2;
      case BIOME.CRYSTAL:
        return base * 0.6 - 4;
      case BIOME.VOLCANO: {
        // Un gran volcán con cráter en el medio de la zona y llanuras de ceniza alrededor
        const dv = Math.abs(x - this.volcanoX);
        const plain = n(x * 0.012, 61.1) * 6 + 6;
        const cone = 6 - Math.max(0, 52 - dv * 1.25);
        const crater = dv < 7 ? 7 : 0;
        return Math.min(plain, cone + crater);
      }
      default:
        return base;
    }
  }

  _generateColumns() {
    // Alturas mezcladas entre zonas vecinas: promedio ponderado por cuántas columnas de
    // cada bioma hay en ±BLEND (así no quedan acantilados en los bordes)
    const raw = new Float32Array(WORLD_WIDTH);
    const counts = Array.from({ length: BIOME_INFO.length }, () => new Int32Array(WORLD_WIDTH + 1));
    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let b = 0; b < BIOME_INFO.length; b++) counts[b][x + 1] = counts[b][x] + (this.biome[x] === b ? 1 : 0);
    }
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const a = Math.max(0, x - BLEND);
      const z = Math.min(WORLD_WIDTH, x + BLEND + 1);
      let sum = 0;
      let wsum = 0;
      for (let b = 0; b < BIOME_INFO.length; b++) {
        const w = counts[b][z] - counts[b][a];
        if (!w) continue;
        sum += w * this._heightIn(b, x);
        wsum += w;
      }
      raw[x] = sum / wsum;
    }
    for (let x = 0; x < WORLD_WIDTH; x++) {
      let h = raw[x];
      // Aplanar la zona de aparición del jugador
      const d = Math.abs(x - this.spawnX);
      if (d < 30) h *= 0.2 + 0.8 * smoothstep(d / 30);
      this.surface[x] = Math.round(SURFACE_LEVEL + h);
      this.dirtDepth[x] = 5 + Math.round((this.nSoil(x * 0.05, 11.3) + 1) * 2.5);
      this.entrance[x] = d > 40 && this.nCaveMask(x * 0.03, 77.7) > 0.55 ? 1 : 0;
    }
  }

  /** Cosas de cada zona: lagos de lava, abismos, espiras de cristal. */
  _generateFeatures() {
    for (let x = 2; x < WORLD_WIDTH - 2; x++) {
      const b = this.biome[x];
      if (b === BIOME.VOLCANO) {
        // Cráter lleno de lava y charcos de lava en las llanuras
        if (Math.abs(x - this.volcanoX) < 6) this.lavaDepth[x] = 5;
        else if (this.nSoil(x * 0.06, 71.7) > 0.45) this.lavaDepth[x] = 2;
      } else if (b === BIOME.SHADOW) {
        // Abismos: pozos de 3 bloques de ancho que bajan 30-60 bloques
        const cell = Math.floor(x / 9);
        if (hash2(cell, 91, this.seed) < 0.35 && x % 9 >= 3 && x % 9 <= 5) this.chasm[x] = 30 + Math.floor(hash2(cell, 92, this.seed) * 30);
      } else if (b === BIOME.CRYSTAL) {
        if (hash2(x, 93, this.seed) < 0.07) this.spire[x] = 5 + Math.floor(hash2(x, 94, this.seed) * 11);
      }
    }
  }

  _generateTrees() {
    const r = new Float32Array(WORLD_WIDTH);
    for (let x = 0; x < WORLD_WIDTH; x++) r[x] = hash2(x, 7, this.seed);

    for (let x = 4; x < WORLD_WIDTH - 4; x++) {
      const info = BIOME_INFO[this.biome[x]];
      if (!info.tree || this.lavaDepth[x] || this.chasm[x] || this.spire[x]) continue;
      // Zonas de bosque y zonas más despejadas
      const forest = this.nSoil(x * 0.01, 123.4);
      const density = info.tree === 'forest' ? (forest > -0.25 ? 0.25 : 0.04) : info.treeDensity;
      if (r[x] > density) continue;
      // Solo el mínimo local en ±5 columnas (menos en la selva, más tupida) → árboles separados
      const gap = info.tree === 'jungle' ? 3 : info.tree === 'cactus' ? 4 : 5;
      let isMin = true;
      for (let d = -gap; d <= gap && isMin; d++) {
        const xx = x + d;
        if (d !== 0 && xx >= 0 && xx < WORLD_WIDTH && r[xx] < r[x]) isMin = false;
      }
      if (!isMin) continue;
      // Terreno más o menos plano, con el suelo de la zona y lejos de la pirámide
      const s = this.surface[x];
      if (Math.abs(this.surface[x - 1] - s) > 1 || Math.abs(this.surface[x + 1] - s) > 1) continue;
      if (this.baseTile(x, s) !== info.top) continue;
      if (this.biome[x] === BIOME.DESERT && Math.abs(x - this.pyramidX) <= PYRAMID_HALF + 3) continue;
      const hr = hash2(x, 13, this.seed);
      this.treeType[x] = TREE_TYPES.indexOf(info.tree);
      if (info.tree === 'cactus') this.treeHeight[x] = 3 + Math.floor(hr * 3); // 3 a 5
      else if (info.tree === 'jungle') this.treeHeight[x] = 12 + Math.floor(hr * 9); // 12 a 20
      else this.treeHeight[x] = 7 + Math.floor(hr * 7); // 7 a 13
    }
  }

  /** ¿Hay cueva (aire) en esta posición subterránea? */
  isCave(x, y) {
    const depth = y - this.surface[x];
    if (depth < 0 || y >= WORLD_HEIGHT - 6) return false;
    // Abismos de las tierras sombrías
    if (this.chasm[x] && depth < this.chasm[x]) return true;
    const distSpawn = Math.abs(x - this.spawnX);
    // Cerca de la superficie solo hay cuevas en las "entradas"
    if (depth < 10 && !this.entrance[x]) return false;
    // Suelo firme bajo el punto de aparición
    if (distSpawn < 14 && depth < 18) return false;
    // Bajo la pirámide, suelo firme
    if (Math.abs(x - this.pyramidX) <= PYRAMID_HALF + 2 && depth < 14) return false;

    // Túneles: banda estrecha alrededor del cero del ruido (forma de gusano)
    // (gruesos y estirados en vertical para que se puedan recorrer sin cavar a cada paso)
    const t = this.nCave(x * 0.03, y * TUNNEL_FREQ_Y);
    const width = TUNNEL_WIDTH + Math.min(depth, 120) * 0.0004;
    if (t > -width && t < width && this.nCaveMask(x * 0.012, y * 0.012) > -0.35) return true;

    // Cavernas grandes en profundidad
    if (depth > 35) {
      const c = this.nCavern(x * 0.022, y * 0.035);
      if (c > 0.58 - Math.min(depth - 35, 100) * 0.0012) return true;
    }
    return false;
  }

  /** Bloque "natural" en (x, y) desde la superficie hacia abajo, sin árboles ni construcciones. */
  baseTile(x, y) {
    if (y >= WORLD_HEIGHT - 3) return BLOCK.BEDROCK;
    if (y >= WORLD_HEIGHT - 6 && hash2(x, y, this.seed) < (y - (WORLD_HEIGHT - 7)) / 4) return BLOCK.BEDROCK;

    const s = this.surface[x];
    if (y < s) return BLOCK.AIR;
    const uw = this.underworldTile(x, y);
    if (uw !== -1) return uw;
    const depth = y - s;
    const b = this.biome[x];
    const info = BIOME_INFO[b];
    // Lava del volcán (cráter y charcos)
    if (depth < this.lavaDepth[x]) return BLOCK.LAVA;
    const mushroom = this.inMushroom(x, y);
    if (this.isCave(x, y) || (mushroom && this.nCavern(x * 0.04 + 800, y * 0.05) > 0.25)) {
      // En el volcán, las cuevas poco profundas tienen bolsones de lava
      if (b === BIOME.VOLCANO && depth > 12 && depth < 60 && this.nCavern(x * 0.05, y * 0.05) > 0.35) return BLOCK.LAVA;
      return BLOCK.AIR;
    }

    if (depth === 0) return info.top;
    // Bajo un charco de lava, piedra volcánica
    if (this.lavaDepth[x] && depth < this.lavaDepth[x] + 3) return BLOCK.BASALT;

    if (depth < this.dirtDepth[x]) {
      // Capa de tierra con alguna roca suelta
      if (depth > 2 && this.nSoil(x * 0.09, y * 0.09) > 0.62) return info.stone;
      return info.soil;
    }

    // Capa de piedra: la de la zona cerca de la superficie, piedra común más abajo
    let stone = info.stone;
    if (depth > 70 + this.nSoil(x * 0.03, y * 0.03) * 10) stone = BLOCK.STONE;
    else if (b === BIOME.SNOW && this.nSoil(x * 0.06 + 50, y * 0.06) < 0) stone = BLOCK.STONE; // hielo en vetas
    else if (b === BIOME.CRYSTAL && this.nOre(x * 0.1 + 77, y * 0.1) > 0.45) return BLOCK.CRYSTAL; // vetas de cristal
    if (depth < 90 && this.nSoil(x * 0.07 + 300, y * 0.07 + 300) > 0.6) {
      return b === BIOME.JUNGLE ? BLOCK.MUD : info.soil === BLOCK.SNOW ? BLOCK.SNOW : BLOCK.DIRT;
    }
    // Cuevas de hongos: barro, con pasto azul brillante donde da a la cueva
    if (mushroom) return this.isCave(x, y - 1) || this.nCavern(x * 0.04 + 800, (y - 1) * 0.05) > 0.25 ? BLOCK.MUSHROOM_GRASS : BLOCK.MUD;
    if (this.nOre(x * 0.12, y * 0.12) > 0.62) return BLOCK.COAL_ORE;
    // Oro: más abajo que el hierro (hace falta pico de hierro)
    if (depth > 75 && this.nOre(x * 0.13 + 1777, y * 0.13 + 1777) > 0.7 - Math.min(depth, 250) * 0.0004) return BLOCK.GOLD_ORE;
    if (depth > 28 && this.nOre(x * 0.14 + 911, y * 0.14 + 911) > 0.66 - Math.min(depth, 200) * 0.0004) {
      return BLOCK.IRON_ORE;
    }
    return stone;
  }

  /** Bloque natural incluyendo la pirámide y las espiras de cristal (sin árboles ni plantas). */
  tileAt(x, y) {
    if (y < this.surface[x]) return this._aboveSurface(x, y);
    return this.baseTile(x, y);
  }

  /** Lo que hay por encima de la superficie en (x, y): pirámide, espira o aire. */
  _aboveSurface(x, y) {
    const island = this.islandTile(x, y);
    if (island) return island;
    const row = this.surface[x] - 1 - y; // 0 = justo sobre el suelo
    // Pirámide del desierto, hueca, con un pasillo de entrada a la derecha y una cámara al centro
    const dp = x - this.pyramidX;
    if (this.pyramidX >= 0 && Math.abs(dp) <= PYRAMID_HALF && row >= 0 && row <= PYRAMID_HALF) {
      if (Math.abs(dp) > PYRAMID_HALF - row) return BLOCK.AIR;
      const chamber = row >= 1 && row <= 4 && Math.abs(dp) <= 6;
      const corridor = row >= 1 && row <= 3 && dp > 0;
      return chamber || corridor ? BLOCK.AIR : BLOCK.SANDSTONE;
    }
    if (this.spire[x] && row >= 0 && row < this.spire[x]) return BLOCK.CRYSTAL;
    return BLOCK.AIR;
  }

  /** Pared de fondo en (x, y) (solo decorativa). */
  wallAt(x, y) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return WALL.NONE;
    const depth = y - this.surface[x];
    // Dentro de la pirámide: pared de arenisca
    if (depth < 0) {
      const row = -depth - 1;
      const dp = Math.abs(x - this.pyramidX);
      return this.pyramidX >= 0 && row >= 1 && row <= 4 && dp <= 6 ? WALL.SANDSTONE : WALL.NONE;
    }
    if (depth < 1) return WALL.NONE;
    if (this.chasm[x] && depth < this.chasm[x]) return WALL.NONE; // los abismos se ven hasta el fondo
    if (y >= UNDERWORLD_TOP) return WALL.ASH;
    if (this.inMushroom(x, y)) return WALL.MUD;
    const info = BIOME_INFO[this.biome[x]];
    if (depth <= this.dirtDepth[x]) return info.wallSoil;
    return depth > 70 ? WALL.STONE : info.wallStone;
  }

  /** Primera fila sólida de una columna (por encima de ella llega la luz del sol). */
  computeSkyTop(x) {
    // (las islas flotantes no cuentan: la luz del cielo pasa alrededor y llega al suelo de abajo)
    let y = Math.max(0, this.surface[x] - PYRAMID_HALF - 2);
    while (y < WORLD_HEIGHT && !IS_SOLID[this.tileAt(x, y)]) y++;
    return y;
  }

  /** Tile (columna, fila) donde aparece el jugador. */
  getSpawnTile() {
    return { tx: this.spawnX, ty: this.surface[this.spawnX] };
  }

  /** Cofre del tesoro de la pirámide: esquina superior izquierda. */
  get pyramidChest() {
    return { x0: this.pyramidX - 1, y0: this.surface[this.pyramidX] - 3 };
  }

  /** Contenido inicial de un cofre generado con el mundo (o null si no es uno de ellos). */
  lootFor(x0, y0) {
    const c = this.pyramidChest;
    if (this.pyramidX >= 0 && x0 === c.x0 && y0 === c.y0) {
      return [
        ['iron_bow', 1],
        ['wood_arrow', 60],
        ['iron_bar', 12],
        ['throwing_knife', 25],
        ['torch', 15],
        ['gel', 5],
      ];
    }
    // Islas flotantes: el tesoro del cielo
    const i = this.islandChests.findIndex((q) => q.x0 === x0 && q.y0 === y0);
    if (i >= 0) {
      const special = [['gold_bow', 1], ['gold_sword', 1], ['life_crystal', 2], ['gold_pickaxe', 1]][i % 4];
      return [special, ['gold_bar', 8], ['greater_healing_potion', 3], ['life_crystal', 1], ['cloud', 30], ['wood_arrow', 50]];
    }
    return null;
  }

  /** Genera los datos de un chunk: Uint8Array de CHUNK_SIZE × CHUNK_SIZE ids de bloque. */
  generateChunk(cx, cy) {
    const CS = CHUNK_SIZE;
    const data = new Uint8Array(CS * CS);
    const x0 = cx * CS;
    const y0 = cy * CS;

    for (let lx = 0; lx < CS; lx++) {
      const x = x0 + lx;
      // Sobre la superficie solo hay aire (salvo pirámide y espiras): empezamos un poco más arriba
      const top = Math.max(0, Math.min(this.islandTop[x], this.surface[x] - PYRAMID_HALF - 2) - y0);
      for (let ly = top; ly < CS; ly++) data[ly * CS + lx] = this.tileAt(x, y0 + ly);
    }

    // Árboles y cactus (solo el tronco: la copa y las ramas son sprites decorativos)
    // y plantas sobre el suelo de cada zona
    for (let lx = 0; lx < CS; lx++) {
      const x = x0 + lx;
      const s = this.surface[x];
      const h = this.treeHeight[x];
      if (s - 1 < y0 || s - Math.max(1, h) >= y0 + CS) continue; // nada de esta columna cae en el chunk
      if (h) {
        const trunk = TREE_TYPES[this.treeType[x]] === 'cactus' ? BLOCK.CACTUS : BLOCK.LOG;
        for (let y = s - 1; y >= s - h; y--) this._put(data, x0, y0, x, y, trunk);
      } else {
        const plant = this.plantAt(x);
        if (plant) this._put(data, x0, y0, x, s - 1, plant);
      }
    }

    // Cristales de vida: raros, en el piso de las cuevas (bien bajo tierra)
    for (let lx = 0; lx < CS; lx++) {
      const x = x0 + lx;
      for (let ly = 0; ly < CS - 1; ly++) {
        const y = y0 + ly;
        if (y < this.surface[x] + 30 || y > WORLD_HEIGHT - 12) continue;
        if (data[ly * CS + lx] !== BLOCK.AIR || !IS_SOLID[data[(ly + 1) * CS + lx]]) continue;
        if (hash2(x * 131 + y, 77, this.seed) < 0.006) data[ly * CS + lx] = BLOCK.LIFE_CRYSTAL;
      }
    }

    // Hongos brillantes sobre el pasto de hongos; flores y cofres en las islas
    for (let lx = 0; lx < CS; lx++) {
      const x = x0 + lx;
      for (let ly = 0; ly < CS - 1; ly++) {
        if (data[ly * CS + lx] !== BLOCK.AIR || data[(ly + 1) * CS + lx] !== BLOCK.MUSHROOM_GRASS) continue;
        if (hash2(x * 17 + y0 + ly, 61, this.seed) < 0.4) data[ly * CS + lx] = BLOCK.MUSHROOM_PLANT;
      }
    }
    for (const is of this.islands) {
      for (let x = is.x0 + 2; x <= is.x1 - 2; x++) {
        if (Math.abs(x - is.cx) > 2 && hash2(x, 43, this.seed) < 0.35) this._put(data, x0, y0, x, is.top - 1, BLOCK.PLANT);
      }
    }
    for (const c of this.islandChests) {
      const chest = OBJECTS.chest;
      for (let dy = 0; dy < chest.h; dy++) for (let dx = 0; dx < chest.w; dx++) this._put(data, x0, y0, c.x0 + dx, c.y0 + dy, chest.ids[dy][dx]);
    }

    // Cofre del tesoro dentro de la pirámide
    if (this.pyramidX >= 0) {
      const c = this.pyramidChest;
      const chest = OBJECTS.chest;
      for (let dy = 0; dy < chest.h; dy++) {
        for (let dx = 0; dx < chest.w; dx++) this._put(data, x0, y0, c.x0 + dx, c.y0 + dy, chest.ids[dy][dx]);
      }
    }
    return data;
  }

  /** Planta decorativa sobre esta columna (o 0). */
  plantAt(x) {
    const info = BIOME_INFO[this.biome[x]];
    if (this.lavaDepth[x] || this.spire[x] || this.chasm[x]) return 0;
    if (this.pyramidX >= 0 && Math.abs(x - this.pyramidX) <= PYRAMID_HALF) return 0;
    if (hash2(x, 31, this.seed) >= info.plantChance) return 0;
    return this.baseTile(x, this.surface[x]) === info.top ? info.plant : 0;
  }

  /** ¿Hay pasto alto o una flor sobre esta columna? */
  hasPlant(x) {
    return this.plantAt(x) !== 0;
  }

  _put(data, x0, y0, x, y, id) {
    const lx = x - x0;
    const ly = y - y0;
    if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
    const i = ly * CHUNK_SIZE + lx;
    if (data[i] === BLOCK.AIR) data[i] = id;
  }
}
