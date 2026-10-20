// =====================================================================
//  MAPA CENTRAL DE ASSETS
//  Cada clave de textura apunta a un archivo dentro de /public/assets/.
//  - Si el archivo existe, el juego usa esa imagen.
//  - Si no existe, se genera un placeholder (rectángulos de colores).
//  Para reemplazar el arte solo hay que colocar la imagen con ese nombre:
//  no hace falta tocar código.
//
//  width/height = tamaño recomendado. Si la imagen tiene otro tamaño se
//  escala al tamaño de dibujo (los bloques siempre se dibujan a 32×32).
//  placeholder = nombre del dibujo de reemplazo en systems/Placeholders.js
// =====================================================================

// Carpeta (relativa a /public) donde viven las imágenes
export const ASSET_BASE = 'assets/';

export const ASSETS = {
  // ---------- Bloques (tiles de 32×32) ----------
  tile_grass: { file: 'tiles/grass.png', width: 32, height: 32, placeholder: 'grass' },
  tile_dirt: { file: 'tiles/dirt.png', width: 32, height: 32, placeholder: 'dirt' },
  tile_stone: { file: 'tiles/stone.png', width: 32, height: 32, placeholder: 'stone' },
  tile_coal_ore: { file: 'tiles/coal_ore.png', width: 32, height: 32, placeholder: 'coal_ore' },
  tile_iron_ore: { file: 'tiles/iron_ore.png', width: 32, height: 32, placeholder: 'iron_ore' },
  tile_log: { file: 'tiles/log.png', width: 32, height: 32, placeholder: 'log' },
  tile_leaves: { file: 'tiles/leaves.png', width: 32, height: 32, placeholder: 'leaves' },
  tile_planks: { file: 'tiles/planks.png', width: 32, height: 32, placeholder: 'planks' },
  tile_workbench: { file: 'tiles/workbench.png', width: 32, height: 32, placeholder: 'workbench' },
  tile_torch: { file: 'tiles/torch.png', width: 32, height: 32, placeholder: 'torch' },
  tile_bedrock: { file: 'tiles/bedrock.png', width: 32, height: 32, placeholder: 'bedrock' },

  // ---------- Paredes de fondo (32×32) ----------
  wall_dirt: { file: 'walls/dirt_wall.png', width: 32, height: 32, placeholder: 'wall_dirt' },
  wall_stone: { file: 'walls/stone_wall.png', width: 32, height: 32, placeholder: 'wall_stone' },

  // ---------- Íconos de ítems (32×32) ----------
  // (los ítems que son bloques usan la imagen del bloque como ícono)
  item_wood: { file: 'items/wood.png', width: 32, height: 32, placeholder: 'wood' },
  item_coal: { file: 'items/coal.png', width: 32, height: 32, placeholder: 'coal' },
  item_wood_pickaxe: { file: 'items/wood_pickaxe.png', width: 32, height: 32, placeholder: 'wood_pickaxe' },
  item_stone_pickaxe: { file: 'items/stone_pickaxe.png', width: 32, height: 32, placeholder: 'stone_pickaxe' },

  // ---------- Jugador ----------
  player: { file: 'player/player.png', width: 24, height: 44, placeholder: 'player' },

  // ---------- Interfaz ----------
  ui_slot: { file: 'ui/slot.png', width: 48, height: 48, placeholder: 'slot' },
  ui_slot_selected: { file: 'ui/slot_selected.png', width: 48, height: 48, placeholder: 'slot_selected' },
  ui_heart: { file: 'ui/heart.png', width: 24, height: 24, placeholder: 'heart' },
  ui_crack: { file: 'ui/crack.png', width: 32, height: 32, placeholder: 'crack' },
  ui_joystick_base: { file: 'ui/joystick_base.png', width: 160, height: 160, placeholder: 'joystick_base', smooth: true },
  ui_joystick_thumb: { file: 'ui/joystick_thumb.png', width: 72, height: 72, placeholder: 'joystick_thumb', smooth: true },
  ui_button_jump: { file: 'ui/button_jump.png', width: 96, height: 96, placeholder: 'button_jump', smooth: true },
  ui_button_mine: { file: 'ui/button_mine.png', width: 80, height: 80, placeholder: 'button_mine', smooth: true },
  ui_button_place: { file: 'ui/button_place.png', width: 80, height: 80, placeholder: 'button_place', smooth: true },
  ui_button_inventory: { file: 'ui/button_inventory.png', width: 64, height: 64, placeholder: 'button_inventory', smooth: true },
  ui_button_fullscreen: { file: 'ui/button_fullscreen.png', width: 48, height: 48, placeholder: 'button_fullscreen', smooth: true },
};
