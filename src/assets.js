// =====================================================================
//  MAPA CENTRAL DE ASSETS
//  Cada clave de textura apunta a un archivo dentro de /public/assets/.
//  - Si el archivo existe, el juego usa esa imagen.
//  - Si no existe, se genera un placeholder (ver systems/Placeholders.js).
//  Para reemplazar el arte solo hay que colocar la imagen con ese nombre:
//  no hace falta tocar código.
//
//  width/height = tamaño de la imagen. Los bloques siempre se dibujan a 32×32.
//  frameWidth/frameHeight = la imagen es una hoja con varios cuadros del mismo
//    tamaño, uno al lado del otro (animaciones o variantes).
//  smooth = se dibuja con suavizado (círculos y brillos de la interfaz).
//  placeholder = nombre del dibujo de reemplazo.
// =====================================================================

// Carpeta (relativa a /public) donde viven las imágenes
export const ASSET_BASE = 'assets/';

export const ASSETS = {
  // ---------- Bloques (32×32). Los bordes redondeados se generan solos ----------
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
  tile_plant_grass: { file: 'tiles/plant_grass.png', width: 32, height: 32, placeholder: 'plant_grass' },
  tile_plant_flower_red: { file: 'tiles/plant_flower_red.png', width: 32, height: 32, placeholder: 'plant_flower_red' },
  tile_plant_flower_yellow: { file: 'tiles/plant_flower_yellow.png', width: 32, height: 32, placeholder: 'plant_flower_yellow' },

  // ---------- Paredes de fondo (32×32) ----------
  wall_dirt: { file: 'walls/dirt_wall.png', width: 32, height: 32, placeholder: 'wall_dirt' },
  wall_stone: { file: 'walls/stone_wall.png', width: 32, height: 32, placeholder: 'wall_stone' },

  // ---------- Árboles ----------
  // Copa: 3 variantes de 144×128 una al lado de la otra
  tree_top: { file: 'trees/tree_top.png', width: 432, height: 128, frameWidth: 144, frameHeight: 128, placeholder: 'tree_top' },
  tree_branch: { file: 'trees/tree_branch.png', width: 32, height: 32, placeholder: 'tree_branch' },

  // ---------- Íconos de ítems (32×32) ----------
  // (los ítems que son bloques usan la imagen del bloque como ícono)
  item_wood: { file: 'items/wood.png', width: 32, height: 32, placeholder: 'wood' },
  item_coal: { file: 'items/coal.png', width: 32, height: 32, placeholder: 'coal' },
  item_wood_pickaxe: { file: 'items/wood_pickaxe.png', width: 32, height: 32, placeholder: 'wood_pickaxe' },
  item_stone_pickaxe: { file: 'items/stone_pickaxe.png', width: 32, height: 32, placeholder: 'stone_pickaxe' },

  // ---------- Jugador: 30 poses de 48×64, 8 por fila (ver player/animations.js), mirando a la derecha ----------
  player: { file: 'player/player.png', width: 384, height: 256, frameWidth: 48, frameHeight: 64, placeholder: 'player' },

  // ---------- Fondo y cielo ----------
  bg_mountains: { file: 'backgrounds/mountains.png', width: 960, height: 320, placeholder: 'mountains' },
  bg_hills: { file: 'backgrounds/hills.png', width: 960, height: 240, placeholder: 'hills' },
  bg_forest: { file: 'backgrounds/forest.png', width: 960, height: 240, placeholder: 'forest' },
  bg_cloud: { file: 'backgrounds/cloud.png', width: 128, height: 48, placeholder: 'cloud' },
  bg_sun: { file: 'backgrounds/sun.png', width: 64, height: 64, placeholder: 'sun' },
  bg_moon: { file: 'backgrounds/moon.png', width: 48, height: 48, placeholder: 'moon' },
  bg_stars: { file: 'backgrounds/stars.png', width: 256, height: 256, placeholder: 'stars' },

  // ---------- Efectos ----------
  fx_glow: { file: 'fx/glow.png', width: 128, height: 128, placeholder: 'glow', smooth: true },

  // ---------- Interfaz ----------
  ui_slot: { file: 'ui/slot.png', width: 48, height: 48, placeholder: 'slot' },
  ui_slot_selected: { file: 'ui/slot_selected.png', width: 48, height: 48, placeholder: 'slot_selected' },
  ui_heart: { file: 'ui/heart.png', width: 24, height: 24, placeholder: 'heart' },
  // Grietas al minar: 4 etapas de 32×32
  ui_crack: { file: 'ui/crack.png', width: 128, height: 32, frameWidth: 32, frameHeight: 32, placeholder: 'crack' },
  ui_joystick_base: { file: 'ui/joystick_base.png', width: 160, height: 160, placeholder: 'joystick_base', smooth: true },
  ui_joystick_thumb: { file: 'ui/joystick_thumb.png', width: 72, height: 72, placeholder: 'joystick_thumb', smooth: true },
  ui_button_jump: { file: 'ui/button_jump.png', width: 96, height: 96, placeholder: 'button_jump', smooth: true },
  ui_button_mine: { file: 'ui/button_mine.png', width: 80, height: 80, placeholder: 'button_mine', smooth: true },
  ui_button_place: { file: 'ui/button_place.png', width: 80, height: 80, placeholder: 'button_place', smooth: true },
  ui_button_swap: { file: 'ui/button_swap.png', width: 64, height: 64, placeholder: 'button_swap', smooth: true },
  ui_button_inventory: { file: 'ui/button_inventory.png', width: 64, height: 64, placeholder: 'button_inventory', smooth: true },
  ui_button_fullscreen: { file: 'ui/button_fullscreen.png', width: 48, height: 48, placeholder: 'button_fullscreen', smooth: true },
};
