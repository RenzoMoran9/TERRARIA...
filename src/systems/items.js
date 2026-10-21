import { MAX_STACK } from '../config.js';
import { BLOCK, WALL } from '../world/blocks.js';

// Definición de ítems.
// icon: clave de textura (ver assets.js). Los ítems que son bloques usan la imagen del bloque.
// places: bloque que se coloca con clic derecho (si no tiene, no se puede colocar).
// wall: pared de fondo que se coloca. object: mueble que se coloca (ver FURNITURE en blocks.js).
// tool: pico (tier = qué bloques puede minar, speed = multiplicador de velocidad).
// hammer: martillo (quita paredes de fondo; speed = multiplicador de velocidad).
// weapon: arma (style = combo: dagger / heavy, damage = daño, knockback = empujón, speed = golpes por segundo, reach = alcance en px).
//   kind: 'swing' (espada, daga, maza: golpe en arco), 'thrust' (lanza: estocada larga),
//   'bow' (arco: dispara flechas, las gasta), 'boomerang' (va y vuelve), 'throw' (se lanza y se gasta).
//   projSpeed = velocidad del proyectil. ammo: munición (flechas) con su daño extra.
export const ITEMS = {
  dirt: { name: 'Tierra', icon: 'tile_dirt', places: BLOCK.DIRT },
  stone: { name: 'Piedra', icon: 'tile_stone', places: BLOCK.STONE },
  wood: { name: 'Madera', icon: 'item_wood' },
  planks: { name: 'Tablones', icon: 'tile_planks', places: BLOCK.PLANKS },
  workbench: { name: 'Mesa de trabajo', icon: 'tile_workbench', places: BLOCK.WORKBENCH },
  torch: { name: 'Antorcha', icon: 'tile_torch', places: BLOCK.TORCH },
  coal: { name: 'Carbón', icon: 'item_coal' },
  iron_ore: { name: 'Mineral de hierro', icon: 'tile_iron_ore', places: BLOCK.IRON_ORE },
  wood_pickaxe: { name: 'Pico de madera', icon: 'item_wood_pickaxe', maxStack: 1, tool: { tier: 1, speed: 2 } },
  stone_pickaxe: { name: 'Pico de piedra', icon: 'item_stone_pickaxe', maxStack: 1, tool: { tier: 2, speed: 3.5 } },
  // Bloques de las zonas
  sand: { name: 'Arena', icon: 'tile_sand', places: BLOCK.SAND },
  sandstone: { name: 'Arenisca', icon: 'tile_sandstone', places: BLOCK.SANDSTONE },
  snow: { name: 'Nieve', icon: 'tile_snow', places: BLOCK.SNOW },
  ice: { name: 'Hielo', icon: 'tile_ice', places: BLOCK.ICE },
  mud: { name: 'Lodo', icon: 'tile_mud', places: BLOCK.MUD },
  shadow_stone: { name: 'Piedra sombría', icon: 'tile_shadow_stone', places: BLOCK.SHADOW_STONE },
  crystal: { name: 'Cristal', icon: 'tile_crystal', places: BLOCK.CRYSTAL },
  ash: { name: 'Ceniza', icon: 'tile_ash', places: BLOCK.ASH },
  basalt: { name: 'Basalto', icon: 'tile_basalt', places: BLOCK.BASALT },
  cactus: { name: 'Cactus', icon: 'item_cactus' },
  cactus_sword: { name: 'Espada de cactus', icon: 'item_cactus_sword', maxStack: 1, weapon: { damage: 12, knockback: 240, speed: 2.4, reach: 54 } },
  crystal_sword: { name: 'Espada de cristal', icon: 'item_crystal_sword', maxStack: 1, weapon: { damage: 30, knockback: 320, speed: 3, reach: 64 } },
  // Monedas (no van al inventario: se suman a la bolsa de monedas). value = en monedas de cobre
  coin_copper: { name: 'Moneda de cobre', icon: 'item_coin_copper', coin: 1 },
  coin_silver: { name: 'Moneda de plata', icon: 'item_coin_silver', coin: 100 },
  coin_gold: { name: 'Moneda de oro', icon: 'item_coin_gold', coin: 10000 },
  // Mundo, segunda parte
  gold_ore: { name: 'Mineral de oro', icon: 'tile_gold_ore', places: BLOCK.GOLD_ORE },
  gold_bar: { name: 'Lingote de oro', icon: 'item_gold_bar' },
  hellstone: { name: 'Piedra infernal', icon: 'tile_hellstone', places: BLOCK.HELLSTONE },
  hellstone_bar: { name: 'Lingote infernal', icon: 'item_hellstone_bar' },
  cloud: { name: 'Nube', icon: 'tile_cloud', places: BLOCK.CLOUD },
  glowing_mushroom: { name: 'Hongo brillante', icon: 'item_glowing_mushroom' },
  gold_pickaxe: { name: 'Pico de oro', icon: 'item_gold_pickaxe', maxStack: 1, tool: { tier: 4, speed: 7 } },
  hell_pickaxe: { name: 'Pico infernal', icon: 'item_hell_pickaxe', maxStack: 1, tool: { tier: 5, speed: 9.5 } },
  gold_sword: { name: 'Espada de oro', icon: 'item_gold_sword', maxStack: 1, weapon: { damage: 32, knockback: 360, speed: 2.7, reach: 66 } },
  hell_sword: { name: 'Espada infernal', icon: 'item_hell_sword', maxStack: 1, weapon: { damage: 46, knockback: 420, speed: 2.9, reach: 72 } },
  gold_bow: { name: 'Arco de oro', icon: 'item_gold_bow', maxStack: 1, weapon: { kind: 'bow', damage: 13, knockback: 180, speed: 2.4, projSpeed: 820 } },
  gold_helmet: { name: 'Casco de oro', icon: 'item_gold_helmet', maxStack: 1, armor: { slot: 'head', defense: 4, set: 'gold' } },
  gold_chest: { name: 'Pechera de oro', icon: 'item_gold_chest', maxStack: 1, armor: { slot: 'body', defense: 5, set: 'gold' } },
  gold_legs: { name: 'Grebas de oro', icon: 'item_gold_legs', maxStack: 1, armor: { slot: 'legs', defense: 4, set: 'gold' } },
  hell_helmet: { name: 'Casco infernal', icon: 'item_hell_helmet', maxStack: 1, armor: { slot: 'head', defense: 7, set: 'hell' } },
  hell_chest: { name: 'Pechera infernal', icon: 'item_hell_chest', maxStack: 1, armor: { slot: 'body', defense: 9, set: 'hell' } },
  hell_legs: { name: 'Grebas infernales', icon: 'item_hell_legs', maxStack: 1, armor: { slot: 'legs', defense: 7, set: 'hell' } },
  // Combate: armaduras (slot = head/body/legs; defense = defensa; set = juego completo da un bonus)
  wood_helmet: { name: 'Casco de madera', icon: 'item_wood_helmet', maxStack: 1, armor: { slot: 'head', defense: 1, set: 'wood' } },
  wood_chest: { name: 'Pechera de madera', icon: 'item_wood_chest', maxStack: 1, armor: { slot: 'body', defense: 2, set: 'wood' } },
  wood_legs: { name: 'Grebas de madera', icon: 'item_wood_legs', maxStack: 1, armor: { slot: 'legs', defense: 1, set: 'wood' } },
  cactus_helmet: { name: 'Casco de cactus', icon: 'item_cactus_helmet', maxStack: 1, armor: { slot: 'head', defense: 2, set: 'cactus' } },
  cactus_chest: { name: 'Pechera de cactus', icon: 'item_cactus_chest', maxStack: 1, armor: { slot: 'body', defense: 3, set: 'cactus' } },
  cactus_legs: { name: 'Grebas de cactus', icon: 'item_cactus_legs', maxStack: 1, armor: { slot: 'legs', defense: 2, set: 'cactus' } },
  iron_helmet: { name: 'Casco de hierro', icon: 'item_iron_helmet', maxStack: 1, armor: { slot: 'head', defense: 3, set: 'iron' } },
  iron_chest: { name: 'Pechera de hierro', icon: 'item_iron_chest', maxStack: 1, armor: { slot: 'body', defense: 4, set: 'iron' } },
  iron_legs: { name: 'Grebas de hierro', icon: 'item_iron_legs', maxStack: 1, armor: { slot: 'legs', defense: 3, set: 'iron' } },
  crystal_helmet: { name: 'Casco de cristal', icon: 'item_crystal_helmet', maxStack: 1, armor: { slot: 'head', defense: 5, set: 'crystal' } },
  crystal_chest: { name: 'Pechera de cristal', icon: 'item_crystal_chest', maxStack: 1, armor: { slot: 'body', defense: 7, set: 'crystal' } },
  crystal_legs: { name: 'Grebas de cristal', icon: 'item_crystal_legs', maxStack: 1, armor: { slot: 'legs', defense: 5, set: 'crystal' } },
  // Consumibles: use = qué hace al usarlo (se gasta)
  healing_potion: { name: 'Poción de curación menor', icon: 'item_healing_potion', maxStack: 30, use: { heal: 50 } },
  greater_healing_potion: { name: 'Poción de curación', icon: 'item_greater_healing_potion', maxStack: 30, use: { heal: 100 } },
  life_crystal: { name: 'Cristal de vida', icon: 'item_life_crystal', maxStack: 99, use: { maxHealth: 20 } },
  recall_potion: { name: 'Poción de regreso', icon: 'item_recall_potion', maxStack: 30, use: { recall: true } },
  magic_mirror: { name: 'Espejo mágico', icon: 'item_magic_mirror', maxStack: 1, use: { recall: true, keep: true } },
  compass: { name: 'Brújula', icon: 'item_compass', maxStack: 1, info: 'compass' },
  depth_meter: { name: 'Medidor de profundidad', icon: 'item_depth_meter', maxStack: 1, info: 'depth' },
  flower: { name: 'Flor', icon: 'item_flower' },
  // Casas
  wood_hammer: { name: 'Martillo de madera', icon: 'item_wood_hammer', maxStack: 1, hammer: { speed: 2.5 } },
  wood_wall: { name: 'Pared de fondo de madera', icon: 'item_wood_wall', wall: WALL.WOOD },
  stone_wall: { name: 'Pared de fondo de piedra', icon: 'item_stone_wall', wall: WALL.STONE },
  dirt_wall: { name: 'Pared de fondo de tierra', icon: 'item_dirt_wall', wall: WALL.DIRT },
  glass_wall: { name: 'Ventana de vidrio', icon: 'item_glass_wall', wall: WALL.GLASS },
  wood_platform: { name: 'Plataforma de madera', icon: 'tile_wood_platform', places: BLOCK.WOOD_PLATFORM },
  glass: { name: 'Vidrio', icon: 'tile_glass', places: BLOCK.GLASS },
  red_shingles: { name: 'Tejas rojas', icon: 'tile_red_shingles', places: BLOCK.RED_SHINGLES },
  wood_shingles: { name: 'Tejas de madera', icon: 'tile_wood_shingles', places: BLOCK.WOOD_SHINGLES },
  door: { name: 'Puerta', icon: 'item_door', object: 'door' },
  chair: { name: 'Silla', icon: 'item_chair', object: 'chair' },
  table: { name: 'Mesa', icon: 'item_table', object: 'table' },
  bed: { name: 'Cama', icon: 'item_bed', object: 'bed' },
  // Combate
  gel: { name: 'Gel', icon: 'item_gel' },
  wood_sword: { name: 'Espada de madera', icon: 'item_wood_sword', maxStack: 1, weapon: { damage: 9, knockback: 260, speed: 2.4, reach: 54 } },
  stone_sword: { name: 'Espada de piedra', icon: 'item_stone_sword', maxStack: 1, weapon: { damage: 15, knockback: 300, speed: 2.2, reach: 58 } },
  // Progresión: horno, hierro y yunque
  furnace: { name: 'Horno', icon: 'item_furnace', object: 'furnace' },
  chest: { name: 'Cofre', icon: 'item_chest', object: 'chest' },
  anvil: { name: 'Yunque de hierro', icon: 'item_anvil', object: 'anvil' },
  iron_bar: { name: 'Lingote de hierro', icon: 'item_iron_bar' },
  stone_brick: { name: 'Ladrillo de piedra', icon: 'tile_stone_brick', places: BLOCK.STONE_BRICK },
  iron_pickaxe: { name: 'Pico de hierro', icon: 'item_iron_pickaxe', maxStack: 1, tool: { tier: 3, speed: 5.5 } },
  iron_sword: { name: 'Espada de hierro', icon: 'item_iron_sword', maxStack: 1, weapon: { damage: 24, knockback: 340, speed: 2.6, reach: 62 } },
  iron_hammer: { name: 'Martillo de hierro', icon: 'item_iron_hammer', maxStack: 1, hammer: { speed: 4.5 } },
  // Armas de todo tipo
  iron_dagger: { name: 'Daga de hierro', icon: 'item_iron_dagger', maxStack: 1, weapon: { style: 'dagger', damage: 13, knockback: 150, speed: 4.5, reach: 42 } },
  stone_mace: { name: 'Maza de piedra', icon: 'item_stone_mace', maxStack: 1, weapon: { style: 'heavy', damage: 21, knockback: 560, speed: 1.4, reach: 58 } },
  iron_spear: { name: 'Lanza de hierro', icon: 'item_iron_spear', maxStack: 1, weapon: { kind: 'thrust', damage: 18, knockback: 280, speed: 1.9, reach: 104 } },
  wood_bow: { name: 'Arco de madera', icon: 'item_wood_bow', maxStack: 1, weapon: { kind: 'bow', damage: 6, knockback: 140, speed: 1.8, projSpeed: 640 } },
  iron_bow: { name: 'Arco de hierro', icon: 'item_iron_bow', maxStack: 1, weapon: { kind: 'bow', damage: 13, knockback: 180, speed: 2.3, projSpeed: 780 } },
  wood_arrow: { name: 'Flecha de madera', icon: 'item_wood_arrow', ammo: { damage: 5 } },
  wood_boomerang: { name: 'Bumerán de madera', icon: 'item_wood_boomerang', maxStack: 1, weapon: { kind: 'boomerang', damage: 11, knockback: 220, speed: 2, projSpeed: 540 } },
  throwing_knife: { name: 'Cuchillo arrojadizo', icon: 'item_throwing_knife', weapon: { kind: 'throw', damage: 12, knockback: 120, speed: 3, projSpeed: 720 } },
};

/** ¿Este ítem se coloca en el mundo (bloque, pared o mueble)? */
export function isPlaceable(def) {
  return !!def && (def.places !== undefined || def.wall !== undefined || def.object !== undefined);
}

// Minar sin pico
export const HAND = { name: 'Mano', icon: null, tier: 0, speed: 1 };

export function getMaxStack(id) {
  return ITEMS[id]?.maxStack ?? MAX_STACK;
}

// ---------------------------------------------------------------------------
// Monedas: 100 de cobre = 1 de plata; 100 de plata = 1 de oro (como Terraria)
// ---------------------------------------------------------------------------

/** "2 oro 5 plata 30 cobre" (o "0 cobre") */
export function formatCoins(n) {
  n = Math.max(0, Math.floor(n));
  const gold = Math.floor(n / 10000);
  const silver = Math.floor((n % 10000) / 100);
  const copper = n % 100;
  const parts = [];
  if (gold) parts.push(`${gold} oro`);
  if (silver) parts.push(`${silver} plata`);
  if (copper || parts.length === 0) parts.push(`${copper} cobre`);
  return parts.join(' ');
}

/** Monedas que valen n de cobre, en la menor cantidad de piezas: [[id, cantidad], ...] */
export function coinStacks(n) {
  const out = [];
  const gold = Math.floor(n / 10000);
  const silver = Math.floor((n % 10000) / 100);
  const copper = Math.floor(n % 100);
  if (gold) out.push(['coin_gold', gold]);
  if (silver) out.push(['coin_silver', silver]);
  if (copper) out.push(['coin_copper', copper]);
  return out;
}

// Precio de algunos ítems (en cobre); el resto se calcula según qué es
const VALUES = {
  wood: 2, planks: 1, dirt: 0, stone: 1, sand: 1, coal: 6, iron_ore: 12, iron_bar: 40, gel: 3, torch: 4, cactus: 3,
  recall_potion: 60, magic_mirror: 600, compass: 250, depth_meter: 250,
  crystal: 25, shadow_stone: 8, gold_ore: 30, gold_bar: 120, hellstone: 50, hellstone_bar: 250, glowing_mushroom: 15, cloud: 2, glass: 4, workbench: 10, furnace: 60, anvil: 220, chest: 30, bed: 50, door: 12,
};

/** Cuánto vale un ítem (en cobre); el Comerciante paga 1/5 al comprárselo. */
export function itemValue(id) {
  const d = ITEMS[id];
  if (!d || d.coin) return 0;
  if (VALUES[id] !== undefined) return VALUES[id];
  if (d.weapon) return Math.round(d.weapon.damage * d.weapon.speed * 12);
  if (d.tool) return Math.round(d.tool.tier * d.tool.speed * 40);
  if (d.hammer) return Math.round(d.hammer.speed * 30);
  if (d.ammo) return 1;
  if (d.object !== undefined) return 20;
  if (d.wall !== undefined) return 1;
  return 2;
}

/** Juegos de armadura: bonus de defensa con las 3 piezas puestas, y colores con que se dibuja en el personaje */
export const ARMOR_SETS = {
  wood: { name: 'madera', bonus: 1, head: ['#8a5a2b', '#a3733a'], body: ['#9a6a35', '#7a4f22', '#b5843f'], legs: ['#7a4f22', '#5e3a1c'], boots: ['#5e3a1c', '#4a2d16'] },
  cactus: { name: 'cactus', bonus: 2, head: ['#3e7a2e', '#5fa04a'], body: ['#4f8a3a', '#386629', '#6fae55'], legs: ['#3e6a2c', '#2c4e1f'], boots: ['#2c4e1f', '#1e3815'] },
  iron: { name: 'hierro', bonus: 3, head: ['#8a9098', '#b8c0c8'], body: ['#9aa2aa', '#6a7078', '#c8d0d8'], legs: ['#7a8088', '#5a6068'], boots: ['#4a5058', '#383d44'] },
  gold: { name: 'oro', bonus: 4, head: ['#d8a820', '#ffe070'], body: ['#e0b030', '#a87a10', '#ffe890'], legs: ['#c89820', '#906a10'], boots: ['#7a5a10', '#5a420a'] },
  hell: { name: 'infernal', bonus: 6, head: ['#b8301a', '#ff7a30'], body: ['#c83a1a', '#7a1a0a', '#ff9a40'], legs: ['#9a2a14', '#6a1a0a'], boots: ['#3a1a14', '#2a100a'] },
  crystal: { name: 'cristal', bonus: 5, head: ['#c47ad8', '#f0a8ff'], body: ['#d890f0', '#a060c0', '#f8c8ff'], legs: ['#b070d0', '#8050a0'], boots: ['#7a4a98', '#5a3478'] },
};
