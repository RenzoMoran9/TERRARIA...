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
  // Casas
  { result: 'wood_hammer', count: 1, ingredients: [['planks', 8]], station: 'workbench' },
  { result: 'wood_wall', count: 4, ingredients: [['planks', 1]], station: 'workbench' },
  { result: 'stone_wall', count: 4, ingredients: [['stone', 1]], station: 'workbench' },
  { result: 'dirt_wall', count: 4, ingredients: [['dirt', 1]], station: 'workbench' },
  { result: 'door', count: 1, ingredients: [['planks', 6]], station: 'workbench' },
  { result: 'chair', count: 1, ingredients: [['planks', 4]], station: 'workbench' },
  { result: 'table', count: 1, ingredients: [['planks', 8]], station: 'workbench' },
  { result: 'bed', count: 1, ingredients: [['planks', 15], ['wood', 5]], station: 'workbench' },
];

export const STATION_NAMES = { workbench: 'Mesa de trabajo' };

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
    return { ok: false, message: `Necesitas estar cerca de una ${STATION_NAMES[recipe.station]}` };
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
