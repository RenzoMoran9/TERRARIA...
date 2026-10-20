// Definición de todos los tipos de bloque del mundo.

export const BLOCK = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COAL_ORE: 4,
  IRON_ORE: 5,
  LOG: 6,
  LEAVES: 7, // ya no se genera (las copas son sprites), se conserva por partidas viejas
  PLANKS: 8,
  WORKBENCH: 9,
  TORCH: 10,
  BEDROCK: 11,
  PLANT: 12, // pasto alto y flores decorativas
});

// hardness: segundos para minarlo a mano (se divide por la velocidad del pico)
// tier: nivel mínimo de pico (0 = a mano, 1 = pico de madera, 2 = pico de piedra)
// drop: ítem que se obtiene al minarlo
// light: luz que emite (0..1)
// color: color de las partículas al romperlo
// framed: dibuja contorno y esquinas redondeadas donde toca aire (autotiling)
// textures: varias texturas = una por variante (p. ej. tipos de flores)
// covered: textura a usar cuando tiene otro bloque encima (el pasto tapado se ve como tierra)
export const BLOCK_DEFS = [
  { id: BLOCK.AIR, name: 'Aire', texture: null, solid: false, hardness: 0, tier: 0, drop: null, light: 0, color: 0x000000 },
  { id: BLOCK.GRASS, name: 'Pasto', texture: 'tile_grass', covered: 'tile_dirt', framed: true, solid: true, hardness: 0.55, tier: 0, drop: 'dirt', light: 0, color: 0x4caf50 },
  { id: BLOCK.DIRT, name: 'Tierra', texture: 'tile_dirt', framed: true, solid: true, hardness: 0.5, tier: 0, drop: 'dirt', light: 0, color: 0x8b5a2b },
  { id: BLOCK.STONE, name: 'Piedra', texture: 'tile_stone', framed: true, solid: true, hardness: 1.8, tier: 1, drop: 'stone', light: 0, color: 0x7a7a7a },
  { id: BLOCK.COAL_ORE, name: 'Mena de carbón', texture: 'tile_coal_ore', framed: true, solid: true, hardness: 2.2, tier: 1, drop: 'coal', light: 0, color: 0x2a2a2a },
  { id: BLOCK.IRON_ORE, name: 'Mena de hierro', texture: 'tile_iron_ore', framed: true, solid: true, hardness: 3.0, tier: 2, drop: 'iron_ore', light: 0, color: 0xc98d5a },
  { id: BLOCK.LOG, name: 'Tronco', texture: 'tile_log', solid: false, hardness: 1.0, tier: 0, drop: 'wood', light: 0, color: 0x6b4423 },
  { id: BLOCK.LEAVES, name: 'Hojas', texture: 'tile_leaves', solid: false, hardness: 0.15, tier: 0, drop: null, light: 0, color: 0x2e7d32 },
  { id: BLOCK.PLANKS, name: 'Tablones', texture: 'tile_planks', framed: true, solid: true, hardness: 0.7, tier: 0, drop: 'planks', light: 0, color: 0xb5823f },
  { id: BLOCK.WORKBENCH, name: 'Mesa de trabajo', texture: 'tile_workbench', solid: false, hardness: 0.7, tier: 0, drop: 'workbench', light: 0, color: 0xa0692f },
  { id: BLOCK.TORCH, name: 'Antorcha', texture: 'tile_torch', solid: false, hardness: 0.05, tier: 0, drop: 'torch', light: 1, color: 0xffc107 },
  { id: BLOCK.BEDROCK, name: 'Roca madre', texture: 'tile_bedrock', framed: true, solid: true, hardness: Infinity, tier: 99, drop: null, light: 0, color: 0x262626 },
  {
    id: BLOCK.PLANT,
    name: 'Planta',
    textures: ['tile_plant_grass', 'tile_plant_flower_red', 'tile_plant_flower_yellow'],
    solid: false,
    hardness: 0.05,
    tier: 0,
    drop: null,
    light: 0,
    color: 0x4caf50,
  },
];

// Tablas de consulta rápida (se usan miles de veces por frame)
export const IS_SOLID = new Uint8Array(256);
export const LIGHT_EMIT = new Float32Array(256);
export const IS_FRAMED = new Uint8Array(256);
for (const def of BLOCK_DEFS) {
  IS_SOLID[def.id] = def.solid ? 1 : 0;
  LIGHT_EMIT[def.id] = def.light;
  IS_FRAMED[def.id] = def.framed ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Tileset: cada "material" (bloque o pared) ocupa VARIANTS filas de 16 columnas.
// Columna = máscara de vecinos sólidos (1 arriba, 2 derecha, 4 abajo, 8 izquierda).
// ---------------------------------------------------------------------------
export const VARIANTS = 3;
export const MASK_COUNT = 16;

export const MATERIALS = [
  ...BLOCK_DEFS.map((def) => ({
    textures: def.textures || [def.texture],
    covered: def.covered || null,
    framed: !!def.framed,
    grassy: def.id === BLOCK.GRASS,
  })),
  { textures: ['wall_dirt'], covered: null, framed: false, grassy: false },
  { textures: ['wall_stone'], covered: null, framed: false, grassy: false },
];

// Paredes de fondo (no se guardan: se calculan con el generador). Su valor es su material.
export const WALL = Object.freeze({ NONE: -1, DIRT: BLOCK_DEFS.length, STONE: BLOCK_DEFS.length + 1 });

/** Índice dentro del tileset para un material, variante y máscara de vecinos. */
export function tileIndex(material, variant, mask) {
  return (material * VARIANTS + variant) * MASK_COUNT + mask;
}

/** Variante (0..VARIANTS-1) fija para cada posición del mundo. */
export function variantAt(x, y) {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h >>> 7) % VARIANTS;
}
