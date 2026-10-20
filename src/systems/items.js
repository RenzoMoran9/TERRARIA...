import { MAX_STACK } from '../config.js';
import { BLOCK } from '../world/blocks.js';

// Definición de ítems.
// icon: clave de textura (ver assets.js). Los ítems que son bloques usan la imagen del bloque.
// places: bloque que se coloca con clic derecho (si no tiene, no se puede colocar).
// tool: datos de herramienta (tier = qué bloques puede minar, speed = multiplicador de velocidad).
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
};

// Minar sin pico
export const HAND = { name: 'Mano', icon: null, tier: 0, speed: 1 };

export function getMaxStack(id) {
  return ITEMS[id]?.maxStack ?? MAX_STACK;
}
