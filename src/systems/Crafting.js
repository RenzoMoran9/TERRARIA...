import { ITEMS } from './items.js';
import { addToSlots, removeFromSlots, cloneSlots, countEmpty } from './Inventory.js';

// Recetas. station: estación necesaria cerca (null = se puede craftear en cualquier lugar)
export const RECIPES = [
  { result: 'planks', count: 4, ingredients: [['wood', 1]], station: null },
  { result: 'workbench', count: 1, ingredients: [['planks', 8]], station: null },
  { result: 'torch', count: 4, ingredients: [['wood', 1], ['coal', 1]], station: null },
  { result: 'wood_pickaxe', count: 1, ingredients: [['planks', 10]], station: 'workbench' },
  { result: 'stone_pickaxe', count: 1, ingredients: [['planks', 4], ['stone', 12]], station: 'workbench' },
  { result: 'torch', count: 3, ingredients: [['wood', 1], ['gel', 1]], station: null },
  // Combate
  { result: 'wood_sword', count: 1, ingredients: [['planks', 7]], station: 'workbench' },
  { result: 'stone_sword', count: 1, ingredients: [['planks', 3], ['stone', 10]], station: 'workbench' },
  // Progresión: horno → lingotes de hierro → yunque → herramientas de hierro
  { result: 'furnace', count: 1, ingredients: [['stone', 20], ['wood', 4], ['torch', 3]], station: 'workbench' },
  { result: 'iron_bar', count: 1, ingredients: [['iron_ore', 3]], station: 'furnace' },
  { result: 'stone_brick', count: 1, ingredients: [['stone', 2]], station: 'furnace' },
  { result: 'anvil', count: 1, ingredients: [['iron_bar', 5]], station: 'workbench' },
  { result: 'iron_pickaxe', count: 1, ingredients: [['iron_bar', 12], ['wood', 3]], station: 'anvil' },
  { result: 'iron_sword', count: 1, ingredients: [['iron_bar', 8]], station: 'anvil' },
  { result: 'iron_hammer', count: 1, ingredients: [['iron_bar', 10], ['wood', 3]], station: 'anvil' },
  // Armas de todo tipo
  { result: 'cactus_sword', count: 1, ingredients: [['cactus', 10]], station: 'workbench' },
  { result: 'crystal_sword', count: 1, ingredients: [['crystal', 20], ['iron_bar', 5]], station: 'anvil' },
  { result: 'wood_bow', count: 1, ingredients: [['wood', 10]], station: 'workbench' },
  { result: 'wood_arrow', count: 10, ingredients: [['wood', 1], ['stone', 1]], station: 'workbench' },
  { result: 'wood_boomerang', count: 1, ingredients: [['planks', 8]], station: 'workbench' },
  { result: 'stone_mace', count: 1, ingredients: [['planks', 3], ['stone', 14]], station: 'workbench' },
  { result: 'iron_dagger', count: 1, ingredients: [['iron_bar', 4]], station: 'anvil' },
  { result: 'iron_spear', count: 1, ingredients: [['iron_bar', 6], ['wood', 4]], station: 'anvil' },
  { result: 'iron_bow', count: 1, ingredients: [['iron_bar', 8], ['wood', 2]], station: 'anvil' },
  { result: 'throwing_knife', count: 15, ingredients: [['iron_bar', 1]], station: 'anvil' },
  // Oro e infierno
  { result: 'gold_bar', count: 1, ingredients: [['gold_ore', 4]], station: 'furnace' },
  { result: 'hellstone_bar', count: 1, ingredients: [['hellstone', 3], ['basalt', 1]], station: 'furnace' },
  { result: 'gold_pickaxe', count: 1, ingredients: [['gold_bar', 12], ['wood', 3]], station: 'anvil' },
  { result: 'gold_sword', count: 1, ingredients: [['gold_bar', 9]], station: 'anvil' },
  { result: 'gold_bow', count: 1, ingredients: [['gold_bar', 8], ['wood', 2]], station: 'anvil' },
  { result: 'hell_pickaxe', count: 1, ingredients: [['hellstone_bar', 15]], station: 'anvil' },
  { result: 'hell_sword', count: 1, ingredients: [['hellstone_bar', 18]], station: 'anvil' },
  { result: 'gold_helmet', count: 1, ingredients: [['gold_bar', 15]], station: 'anvil' },
  { result: 'gold_chest', count: 1, ingredients: [['gold_bar', 25]], station: 'anvil' },
  { result: 'gold_legs', count: 1, ingredients: [['gold_bar', 20]], station: 'anvil' },
  { result: 'hell_helmet', count: 1, ingredients: [['hellstone_bar', 15]], station: 'anvil' },
  { result: 'hell_chest', count: 1, ingredients: [['hellstone_bar', 25]], station: 'anvil' },
  { result: 'hell_legs', count: 1, ingredients: [['hellstone_bar', 20]], station: 'anvil' },
  // Armaduras
  { result: 'wood_helmet', count: 1, ingredients: [['planks', 20]], station: 'workbench' },
  { result: 'wood_chest', count: 1, ingredients: [['planks', 30]], station: 'workbench' },
  { result: 'wood_legs', count: 1, ingredients: [['planks', 25]], station: 'workbench' },
  { result: 'cactus_helmet', count: 1, ingredients: [['cactus', 20]], station: 'workbench' },
  { result: 'cactus_chest', count: 1, ingredients: [['cactus', 30]], station: 'workbench' },
  { result: 'cactus_legs', count: 1, ingredients: [['cactus', 25]], station: 'workbench' },
  { result: 'iron_helmet', count: 1, ingredients: [['iron_bar', 15]], station: 'anvil' },
  { result: 'iron_chest', count: 1, ingredients: [['iron_bar', 25]], station: 'anvil' },
  { result: 'iron_legs', count: 1, ingredients: [['iron_bar', 20]], station: 'anvil' },
  { result: 'crystal_helmet', count: 1, ingredients: [['crystal', 20], ['iron_bar', 5]], station: 'anvil' },
  { result: 'crystal_chest', count: 1, ingredients: [['crystal', 30], ['iron_bar', 8]], station: 'anvil' },
  { result: 'crystal_legs', count: 1, ingredients: [['crystal', 25], ['iron_bar', 6]], station: 'anvil' },
  // Pociones
  { result: 'healing_potion', count: 2, ingredients: [['gel', 2], ['flower', 1], ['glass', 1]], station: 'workbench' },
  { result: 'greater_healing_potion', count: 1, ingredients: [['healing_potion', 2], ['crystal', 1]], station: 'workbench' },
  { result: 'greater_healing_potion', count: 2, ingredients: [['healing_potion', 2], ['glowing_mushroom', 1]], station: 'workbench' },
  // Para orientarse
  { result: 'recall_potion', count: 2, ingredients: [['glowing_mushroom', 1], ['flower', 1], ['glass', 1]], station: 'workbench' },
  { result: 'magic_mirror', count: 1, ingredients: [['glass', 10], ['iron_bar', 6], ['crystal', 3]], station: 'anvil' },
  { result: 'compass', count: 1, ingredients: [['iron_bar', 4], ['glass', 1]], station: 'anvil' },
  { result: 'depth_meter', count: 1, ingredients: [['iron_bar', 4], ['coal', 3]], station: 'anvil' },
  // Casas
  { result: 'chest', count: 1, ingredients: [['planks', 8], ['wood', 2]], station: 'workbench' },
  { result: 'wood_hammer', count: 1, ingredients: [['planks', 8]], station: 'workbench' },
  { result: 'wood_wall', count: 4, ingredients: [['planks', 1]], station: 'workbench' },
  { result: 'stone_wall', count: 4, ingredients: [['stone', 1]], station: 'workbench' },
  { result: 'dirt_wall', count: 4, ingredients: [['dirt', 1]], station: 'workbench' },
  { result: 'wood_platform', count: 2, ingredients: [['wood', 1]], station: null },
  { result: 'glass', count: 1, ingredients: [['sand', 1]], station: 'furnace' },
  { result: 'glass_wall', count: 4, ingredients: [['glass', 1]], station: 'workbench' },
  { result: 'wood_shingles', count: 2, ingredients: [['planks', 1]], station: 'workbench' },
  { result: 'red_shingles', count: 2, ingredients: [['dirt', 2], ['stone', 1]], station: 'furnace' },
  { result: 'door', count: 1, ingredients: [['planks', 6]], station: 'workbench' },
  { result: 'chair', count: 1, ingredients: [['planks', 4]], station: 'workbench' },
  { result: 'table', count: 1, ingredients: [['planks', 8]], station: 'workbench' },
  { result: 'bed', count: 1, ingredients: [['planks', 15], ['wood', 5]], station: 'workbench' },
];

// Estaciones: nombre con artículo (para los avisos) y nombre corto (para la lista)
export const STATION_NAMES = { workbench: 'una Mesa de trabajo', furnace: 'un Horno', anvil: 'un Yunque de hierro' };
export const STATION_SHORT = { workbench: 'Mesa', furnace: 'Horno', anvil: 'Yunque' };

export function hasIngredients(inventory, recipe) {
  return recipe.ingredients.every(([id, n]) => inventory.count(id) >= n);
}

export function canCraft(inventory, recipe, stations) {
  return (!recipe.station || stations[recipe.station]) && hasIngredients(inventory, recipe);
}

/** Texto de ingredientes, p. ej. "4 Tablones + 12 Piedra" */
export function describeIngredients(recipe) {
  return recipe.ingredients.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(' + ');
}

/** Intenta craftear. Devuelve { ok, message }. */
export function craft(inventory, recipe, stations) {
  if (recipe.station && !stations[recipe.station]) {
    return { ok: false, message: `Necesitas estar cerca de ${STATION_NAMES[recipe.station]}` };
  }
  if (!hasIngredients(inventory, recipe)) return { ok: false, message: 'Te faltan materiales' };

  // Simular sobre una copia para no perder nada si no hay espacio
  const slots = cloneSlots(inventory.slots);
  for (const [id, n] of recipe.ingredients) removeFromSlots(slots, id, n);
  const left = addToSlots(slots, recipe.result, recipe.count);
  // Si se lleva algo en el cursor, debe quedar una casilla libre para devolverlo
  if (left > 0 || countEmpty(slots) < (inventory.held ? 1 : 0)) {
    return { ok: false, message: 'Inventario lleno' };
  }
  inventory.setSlots(slots);
  return { ok: true, message: `Creado: ${ITEMS[recipe.result].name} ×${recipe.count}` };
}
