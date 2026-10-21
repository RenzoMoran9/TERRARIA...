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
  // Casas
  wood_hammer: { name: 'Martillo de madera', icon: 'item_wood_hammer', maxStack: 1, hammer: { speed: 2.5 } },
  wood_wall: { name: 'Pared de madera', icon: 'item_wood_wall', wall: WALL.WOOD },
  stone_wall: { name: 'Pared de piedra', icon: 'item_stone_wall', wall: WALL.STONE },
  dirt_wall: { name: 'Pared de tierra', icon: 'item_dirt_wall', wall: WALL.DIRT },
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
