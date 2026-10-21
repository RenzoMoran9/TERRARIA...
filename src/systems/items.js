import { MAX_STACK } from '../config.js';
import { BLOCK, WALL } from '../world/blocks.js';

// Definición de ítems.
// icon: clave de textura (ver assets.js). Los ítems que son bloques usan la imagen del bloque.
// places: bloque que se coloca con clic derecho (si no tiene, no se puede colocar).
// wall: pared de fondo que se coloca. object: mueble que se coloca (ver FURNITURE en blocks.js).
// tool: pico (tier = qué bloques puede minar, speed = multiplicador de velocidad).
// hammer: martillo (quita paredes de fondo; speed = multiplicador de velocidad).
// weapon: arma (damage = daño, knockback = empujón, speed = golpes por segundo, reach = alcance en px).
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
  iron_dagger: { name: 'Daga de hierro', icon: 'item_iron_dagger', maxStack: 1, weapon: { damage: 13, knockback: 150, speed: 4.5, reach: 42 } },
  stone_mace: { name: 'Maza de piedra', icon: 'item_stone_mace', maxStack: 1, weapon: { damage: 21, knockback: 560, speed: 1.4, reach: 58 } },
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
  crystal: 25, shadow_stone: 8, glass: 4, workbench: 10, furnace: 60, anvil: 220, chest: 30, bed: 50, door: 12,
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
