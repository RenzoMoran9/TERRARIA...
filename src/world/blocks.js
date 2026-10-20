// Definición de todos los tipos de bloque del mundo.

export const BLOCK = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COAL_ORE: 4,
  IRON_ORE: 5,
  LOG: 6,
  LEAVES: 7,
  PLANKS: 8,
  WORKBENCH: 9,
  TORCH: 10,
  BEDROCK: 11,
});

// Paredes de fondo (no se guardan: se calculan con el generador).
// Su valor es el índice de su imagen dentro del tileset.
export const WALL = Object.freeze({ NONE: -1, DIRT: 12, STONE: 13 });

// hardness: segundos para minarlo a mano (se divide por la velocidad del pico)
// tier: nivel mínimo de pico (0 = a mano, 1 = pico de madera, 2 = pico de piedra)
// drop: ítem que se obtiene al minarlo
// light: luz que emite (0..1)
// color: color de las partículas al romperlo
export const BLOCK_DEFS = [
  { id: BLOCK.AIR, name: 'Aire', texture: null, solid: false, hardness: 0, tier: 0, drop: null, light: 0, color: 0x000000 },
  { id: BLOCK.GRASS, name: 'Pasto', texture: 'tile_grass', solid: true, hardness: 0.55, tier: 0, drop: 'dirt', light: 0, color: 0x4caf50 },
  { id: BLOCK.DIRT, name: 'Tierra', texture: 'tile_dirt', solid: true, hardness: 0.5, tier: 0, drop: 'dirt', light: 0, color: 0x8b5a2b },
  { id: BLOCK.STONE, name: 'Piedra', texture: 'tile_stone', solid: true, hardness: 1.8, tier: 1, drop: 'stone', light: 0, color: 0x7a7a7a },
  { id: BLOCK.COAL_ORE, name: 'Mena de carbón', texture: 'tile_coal_ore', solid: true, hardness: 2.2, tier: 1, drop: 'coal', light: 0, color: 0x2a2a2a },
  { id: BLOCK.IRON_ORE, name: 'Mena de hierro', texture: 'tile_iron_ore', solid: true, hardness: 3.0, tier: 2, drop: 'iron_ore', light: 0, color: 0xc98d5a },
  { id: BLOCK.LOG, name: 'Tronco', texture: 'tile_log', solid: false, hardness: 1.0, tier: 0, drop: 'wood', light: 0, color: 0x6b4423 },
  { id: BLOCK.LEAVES, name: 'Hojas', texture: 'tile_leaves', solid: false, hardness: 0.15, tier: 0, drop: null, light: 0, color: 0x2e7d32 },
  { id: BLOCK.PLANKS, name: 'Tablones', texture: 'tile_planks', solid: true, hardness: 0.7, tier: 0, drop: 'planks', light: 0, color: 0xb5823f },
  { id: BLOCK.WORKBENCH, name: 'Mesa de trabajo', texture: 'tile_workbench', solid: false, hardness: 0.7, tier: 0, drop: 'workbench', light: 0, color: 0xa0692f },
  { id: BLOCK.TORCH, name: 'Antorcha', texture: 'tile_torch', solid: false, hardness: 0.05, tier: 0, drop: 'torch', light: 1, color: 0xffc107 },
  { id: BLOCK.BEDROCK, name: 'Roca madre', texture: 'tile_bedrock', solid: true, hardness: Infinity, tier: 99, drop: null, light: 0, color: 0x262626 },
];

// Tablas de consulta rápida (se usan miles de veces por frame)
export const IS_SOLID = new Uint8Array(256);
export const LIGHT_EMIT = new Float32Array(256);
for (const def of BLOCK_DEFS) {
  IS_SOLID[def.id] = def.solid ? 1 : 0;
  LIGHT_EMIT[def.id] = def.light;
}

// Clave de textura para cada índice del tileset (índice 0 = aire, vacío)
export const TILESET_FRAMES = [
  ...BLOCK_DEFS.map((def) => def.texture),
  'wall_dirt', // WALL.DIRT = 12
  'wall_stone', // WALL.STONE = 13
];
