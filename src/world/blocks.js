// Definición de todos los tipos de bloque del mundo.

// (los bloques agregados más adelante, como STONE_BRICK, toman el id que les toca más abajo)
export const BLOCK = {
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
};

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

// ---------------------------------------------------------------------------
// Muebles: objetos de varios bloques (puerta, silla, mesa, cama).
// Cada parte (columna dx, fila dy, desde arriba a la izquierda) es un id de bloque propio:
// así, desde cualquier parte se sabe dónde empieza el objeto y se lo puede quitar entero.
// Los ids se generan en este orden: para no romper partidas guardadas, agregar siempre al final.
// ---------------------------------------------------------------------------
// station = estación de crafteo; light = luz que da
export const FURNITURE = {
  door: { name: 'Puerta', item: 'door', hardness: 0.8, color: 0x9a6a35, interactive: true },
  furnace: { name: 'Horno', item: 'furnace', hardness: 1.4, color: 0x7a7a7a, station: 'furnace', light: 0.8 },
  anvil: { name: 'Yunque de hierro', item: 'anvil', hardness: 1.6, color: 0x6b6b75, station: 'anvil' },
  chair: { name: 'Silla', item: 'chair', hardness: 0.6, color: 0xa3733a, interactive: true },
  table: { name: 'Mesa', item: 'table', hardness: 0.7, color: 0xa3733a },
  bed: { name: 'Cama', item: 'bed', hardness: 0.8, color: 0xc0392b, interactive: true },
};

// Variantes de cada mueble. texture = imagen con el objeto entero (w × h bloques).
// mirrored = la misma imagen espejada (mirando a la izquierda).
export const OBJECTS = {
  door_closed: { type: 'door', texture: 'obj_door_closed', w: 1, h: 3, solid: true },
  door_open: { type: 'door', texture: 'obj_door_open', w: 1, h: 3 },
  chair: { type: 'chair', texture: 'obj_chair', w: 1, h: 2 },
  chair_left: { type: 'chair', texture: 'obj_chair', w: 1, h: 2, mirrored: true },
  table: { type: 'table', texture: 'obj_table', w: 3, h: 2 },
  bed: { type: 'bed', texture: 'obj_bed', w: 4, h: 2 },
  bed_left: { type: 'bed', texture: 'obj_bed', w: 4, h: 2, mirrored: true },
};

/** Parte de mueble de cada id de bloque (o null): { object, type, dx, dy } */
export const PART = new Array(256).fill(null);

/** Crea un id de bloque por cada parte de cada objeto. */
function addObjectParts(objects) {
  for (const [key, obj] of Object.entries(objects)) {
    const f = FURNITURE[obj.type];
    obj.key = key;
    obj.ids = []; // ids[dy][dx]
    for (let dy = 0; dy < obj.h; dy++) {
      const row = [];
      for (let dx = 0; dx < obj.w; dx++) {
        const id = BLOCK_DEFS.length;
        row.push(id);
        PART[id] = { object: obj, type: obj.type, dx, dy };
        BLOCK_DEFS.push({
          id,
          name: f.name,
          texture: null,
          // Recorte de la imagen del objeto que le toca a esta parte
          crop: { key: obj.texture, col: obj.mirrored ? obj.w - 1 - dx : dx, row: dy, cols: obj.w, mirrored: !!obj.mirrored },
          solid: !!obj.solid,
          hardness: f.hardness,
          tier: 0,
          drop: f.item,
          light: f.light || 0,
          color: f.color,
        });
      }
      obj.ids.push(row);
    }
  }
}
addObjectParts(OBJECTS);

// Bloques agregados después de los primeros muebles (su id va a continuación)
BLOCK.STONE_BRICK = BLOCK_DEFS.length;
BLOCK_DEFS.push({ id: BLOCK.STONE_BRICK, name: 'Ladrillo de piedra', texture: 'tile_stone_brick', framed: true, solid: true, hardness: 2.0, tier: 1, drop: 'stone_brick', light: 0, color: 0x8a8a90 });

// Estaciones de crafteo de la progresión (2×2 y 2×1)
const STATIONS = {
  furnace: { type: 'furnace', texture: 'obj_furnace', w: 2, h: 2 },
  anvil: { type: 'anvil', texture: 'obj_anvil', w: 2, h: 1 },
};
addObjectParts(STATIONS);
Object.assign(OBJECTS, STATIONS);

// ---------------------------------------------------------------------------
// Paredes de fondo. Las naturales las calcula el generador; las que pone o quita el
// jugador se guardan aparte (ver World). Ids fijos: se guardan en las partidas.
// ---------------------------------------------------------------------------
export const WALL = Object.freeze({ NONE: 0, DIRT: 1, STONE: 2, WOOD: 3 });
export const WALL_DEFS = [
  null,
  { name: 'Pared de tierra', texture: 'wall_dirt', item: 'dirt_wall', color: 0x4c301a },
  { name: 'Pared de piedra', texture: 'wall_stone', item: 'stone_wall', color: 0x3f454e },
  { name: 'Pared de madera', texture: 'wall_wood', item: 'wood_wall', color: 0x6b4a26 },
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
// Tileset: cada "material" (bloque, parte de mueble o pared) ocupa varias celdas seguidas:
// - con bordes (framed): VARIANTS × 16 celdas (16 = máscara de vecinos sólidos:
//   1 arriba, 2 derecha, 4 abajo, 8 izquierda)
// - sin bordes: una celda por variante (las partes de muebles, una sola)
// ---------------------------------------------------------------------------
export const VARIANTS = 3;
export const MASK_COUNT = 16;

export const MATERIALS = [
  ...BLOCK_DEFS.map((def) => ({
    textures: def.textures || [def.texture],
    covered: def.covered || null,
    framed: !!def.framed,
    grassy: def.id === BLOCK.GRASS,
    crop: def.crop || null,
  })),
  ...WALL_DEFS.slice(1).map((w) => ({ textures: [w.texture], covered: null, framed: false, grassy: false, crop: null })),
];

/** Material (fila del tileset) de cada pared */
export const WALL_MATERIAL = WALL_DEFS.map((w, i) => (i === 0 ? -1 : BLOCK_DEFS.length + i - 1));

const MATERIAL_FIRST = new Int32Array(MATERIALS.length); // primera celda de cada material
const MATERIAL_KIND = new Uint8Array(MATERIALS.length); // 0 = una celda, 1 = por variante, 2 = variante y bordes
let cellCount = 0;
MATERIALS.forEach((m, i) => {
  MATERIAL_FIRST[i] = cellCount;
  MATERIAL_KIND[i] = m.framed ? 2 : m.crop ? 0 : 1;
  m.cells = m.framed ? VARIANTS * MASK_COUNT : m.crop ? 1 : VARIANTS;
  cellCount += m.cells;
});
export const TILESET_CELLS = cellCount;

/** Índice dentro del tileset para un material, variante y máscara de vecinos. */
export function tileIndex(material, variant, mask) {
  const kind = MATERIAL_KIND[material];
  const first = MATERIAL_FIRST[material];
  if (kind === 2) return first + variant * MASK_COUNT + mask;
  return kind === 1 ? first + variant : first;
}

/** Variante (0..VARIANTS-1) fija para cada posición del mundo. */
export function variantAt(x, y) {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h >>> 7) % VARIANTS;
}
