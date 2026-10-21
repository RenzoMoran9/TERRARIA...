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
  tile_stone_brick: { file: 'tiles/stone_brick.png', width: 32, height: 32, placeholder: 'stone_brick' },
  // Zonas (biomas)
  tile_sand: { file: 'tiles/sand.png', width: 32, height: 32, placeholder: 'sand' },
  tile_sandstone: { file: 'tiles/sandstone.png', width: 32, height: 32, placeholder: 'sandstone' },
  tile_snow: { file: 'tiles/snow.png', width: 32, height: 32, placeholder: 'snow' },
  tile_ice: { file: 'tiles/ice.png', width: 32, height: 32, placeholder: 'ice' },
  tile_jungle_grass: { file: 'tiles/jungle_grass.png', width: 32, height: 32, placeholder: 'jungle_grass' },
  tile_mud: { file: 'tiles/mud.png', width: 32, height: 32, placeholder: 'mud' },
  tile_shadow_grass: { file: 'tiles/shadow_grass.png', width: 32, height: 32, placeholder: 'shadow_grass' },
  tile_shadow_stone: { file: 'tiles/shadow_stone.png', width: 32, height: 32, placeholder: 'shadow_stone' },
  tile_crystal_grass: { file: 'tiles/crystal_grass.png', width: 32, height: 32, placeholder: 'crystal_grass' },
  tile_crystal: { file: 'tiles/crystal.png', width: 32, height: 32, placeholder: 'crystal' },
  tile_ash: { file: 'tiles/ash.png', width: 32, height: 32, placeholder: 'ash' },
  tile_basalt: { file: 'tiles/basalt.png', width: 32, height: 32, placeholder: 'basalt' },
  tile_lava: { file: 'tiles/lava.png', width: 32, height: 32, placeholder: 'lava' },
  tile_cactus: { file: 'tiles/cactus.png', width: 32, height: 32, placeholder: 'cactus' },
  tile_plant_desert: { file: 'tiles/plant_desert.png', width: 32, height: 32, placeholder: 'plant_desert' },
  tile_plant_desert2: { file: 'tiles/plant_desert2.png', width: 32, height: 32, placeholder: 'plant_desert2' },
  tile_plant_snow: { file: 'tiles/plant_snow.png', width: 32, height: 32, placeholder: 'plant_snow' },
  tile_plant_snow2: { file: 'tiles/plant_snow2.png', width: 32, height: 32, placeholder: 'plant_snow2' },
  tile_plant_jungle: { file: 'tiles/plant_jungle.png', width: 32, height: 32, placeholder: 'plant_jungle' },
  tile_plant_jungle2: { file: 'tiles/plant_jungle2.png', width: 32, height: 32, placeholder: 'plant_jungle2' },
  tile_plant_shadow: { file: 'tiles/plant_shadow.png', width: 32, height: 32, placeholder: 'plant_shadow' },
  tile_plant_shadow2: { file: 'tiles/plant_shadow2.png', width: 32, height: 32, placeholder: 'plant_shadow2' },
  tile_plant_crystal: { file: 'tiles/plant_crystal.png', width: 32, height: 32, placeholder: 'plant_crystal' },
  tile_plant_crystal2: { file: 'tiles/plant_crystal2.png', width: 32, height: 32, placeholder: 'plant_crystal2' },
  tile_plant_crystal3: { file: 'tiles/plant_crystal3.png', width: 32, height: 32, placeholder: 'plant_crystal3' },
  tile_plant_volcano: { file: 'tiles/plant_volcano.png', width: 32, height: 32, placeholder: 'plant_volcano' },
  tile_plant_volcano2: { file: 'tiles/plant_volcano2.png', width: 32, height: 32, placeholder: 'plant_volcano2' },

  // ---------- Paredes de fondo (32×32) ----------
  wall_dirt: { file: 'walls/dirt_wall.png', width: 32, height: 32, placeholder: 'wall_dirt' },
  wall_stone: { file: 'walls/stone_wall.png', width: 32, height: 32, placeholder: 'wall_stone' },
  wall_wood: { file: 'walls/wood_wall.png', width: 32, height: 32, placeholder: 'wall_wood' },
  wall_sandstone: { file: 'walls/sandstone_wall.png', width: 32, height: 32, placeholder: 'wall_sandstone' },
  wall_ice: { file: 'walls/ice_wall.png', width: 32, height: 32, placeholder: 'wall_ice' },
  wall_mud: { file: 'walls/mud_wall.png', width: 32, height: 32, placeholder: 'wall_mud' },
  wall_shadow: { file: 'walls/shadow_wall.png', width: 32, height: 32, placeholder: 'wall_shadow' },
  wall_ash: { file: 'walls/ash_wall.png', width: 32, height: 32, placeholder: 'wall_ash' },

  // ---------- Muebles (objeto entero; cada bloque = 32×32 de la imagen) ----------
  // La silla y la cama miran a la derecha (al ponerlas mirando a la izquierda se dibujan espejadas)
  obj_door_closed: { file: 'furniture/door_closed.png', width: 32, height: 96, placeholder: 'door_closed' },
  obj_door_open: { file: 'furniture/door_open.png', width: 32, height: 96, placeholder: 'door_open' },
  obj_chair: { file: 'furniture/chair.png', width: 32, height: 64, placeholder: 'chair' },
  obj_table: { file: 'furniture/table.png', width: 96, height: 64, placeholder: 'table' },
  obj_bed: { file: 'furniture/bed.png', width: 128, height: 64, placeholder: 'bed' },
  obj_chest: { file: 'furniture/chest.png', width: 64, height: 64, placeholder: 'chest' },
  obj_furnace: { file: 'furniture/furnace.png', width: 64, height: 64, placeholder: 'furnace' },
  obj_anvil: { file: 'furniture/anvil.png', width: 64, height: 32, placeholder: 'anvil' },

  // ---------- Árboles ----------
  // Copa: 3 variantes de 144×128 una al lado de la otra
  tree_top: { file: 'trees/tree_top.png', width: 432, height: 128, frameWidth: 144, frameHeight: 128, placeholder: 'tree_top' },
  tree_top_pine: { file: 'trees/tree_top_pine.png', width: 432, height: 128, frameWidth: 144, frameHeight: 128, placeholder: 'tree_top_pine' },
  tree_top_jungle: { file: 'trees/tree_top_jungle.png', width: 432, height: 128, frameWidth: 144, frameHeight: 128, placeholder: 'tree_top_jungle' },
  tree_top_shadow: { file: 'trees/tree_top_shadow.png', width: 432, height: 128, frameWidth: 144, frameHeight: 128, placeholder: 'tree_top_shadow' },
  tree_branch: { file: 'trees/tree_branch.png', width: 32, height: 32, placeholder: 'tree_branch' },

  // ---------- Íconos de ítems (32×32) ----------
  // (los ítems que son bloques usan la imagen del bloque como ícono)
  item_wood: { file: 'items/wood.png', width: 32, height: 32, placeholder: 'wood' },
  item_coal: { file: 'items/coal.png', width: 32, height: 32, placeholder: 'coal' },
  item_wood_pickaxe: { file: 'items/wood_pickaxe.png', width: 32, height: 32, placeholder: 'wood_pickaxe' },
  item_stone_pickaxe: { file: 'items/stone_pickaxe.png', width: 32, height: 32, placeholder: 'stone_pickaxe' },
  item_wood_hammer: { file: 'items/wood_hammer.png', width: 32, height: 32, placeholder: 'wood_hammer' },
  item_wood_wall: { file: 'items/wood_wall.png', width: 32, height: 32, placeholder: 'wood_wall_item' },
  item_stone_wall: { file: 'items/stone_wall.png', width: 32, height: 32, placeholder: 'stone_wall_item' },
  item_dirt_wall: { file: 'items/dirt_wall.png', width: 32, height: 32, placeholder: 'dirt_wall_item' },
  item_door: { file: 'items/door.png', width: 32, height: 32, placeholder: 'door_item' },
  item_chair: { file: 'items/chair.png', width: 32, height: 32, placeholder: 'chair_item' },
  item_table: { file: 'items/table.png', width: 32, height: 32, placeholder: 'table_item' },
  item_bed: { file: 'items/bed.png', width: 32, height: 32, placeholder: 'bed_item' },
  item_gel: { file: 'items/gel.png', width: 32, height: 32, placeholder: 'gel' },
  item_wood_sword: { file: 'items/wood_sword.png', width: 32, height: 32, placeholder: 'wood_sword' },
  item_stone_sword: { file: 'items/stone_sword.png', width: 32, height: 32, placeholder: 'stone_sword' },
  item_chest: { file: 'items/chest.png', width: 32, height: 32, placeholder: 'chest_item' },
  item_furnace: { file: 'items/furnace.png', width: 32, height: 32, placeholder: 'furnace_item' },
  item_anvil: { file: 'items/anvil.png', width: 32, height: 32, placeholder: 'anvil_item' },
  item_iron_bar: { file: 'items/iron_bar.png', width: 32, height: 32, placeholder: 'iron_bar' },
  item_iron_pickaxe: { file: 'items/iron_pickaxe.png', width: 32, height: 32, placeholder: 'iron_pickaxe' },
  item_iron_sword: { file: 'items/iron_sword.png', width: 32, height: 32, placeholder: 'iron_sword' },
  item_iron_hammer: { file: 'items/iron_hammer.png', width: 32, height: 32, placeholder: 'iron_hammer' },
  item_cactus: { file: 'items/cactus.png', width: 32, height: 32, placeholder: 'cactus_item' },
  item_cactus_sword: { file: 'items/cactus_sword.png', width: 32, height: 32, placeholder: 'cactus_sword' },
  item_crystal_sword: { file: 'items/crystal_sword.png', width: 32, height: 32, placeholder: 'crystal_sword' },
  item_iron_dagger: { file: 'items/iron_dagger.png', width: 32, height: 32, placeholder: 'iron_dagger' },
  item_stone_mace: { file: 'items/stone_mace.png', width: 32, height: 32, placeholder: 'stone_mace' },
  item_iron_spear: { file: 'items/iron_spear.png', width: 32, height: 32, placeholder: 'iron_spear' },
  item_wood_bow: { file: 'items/wood_bow.png', width: 32, height: 32, placeholder: 'wood_bow' },
  item_iron_bow: { file: 'items/iron_bow.png', width: 32, height: 32, placeholder: 'iron_bow' },
  item_wood_arrow: { file: 'items/wood_arrow.png', width: 32, height: 32, placeholder: 'wood_arrow' },
  item_wood_boomerang: { file: 'items/wood_boomerang.png', width: 32, height: 32, placeholder: 'wood_boomerang' },
  item_throwing_knife: { file: 'items/throwing_knife.png', width: 32, height: 32, placeholder: 'throwing_knife' },

  // ---------- Enemigos (mirando a la derecha; los pies abajo al centro) ----------
  // Slime: 3 cuadros de 32×24 (quieto, aplastado, estirado), en gris claro: el juego lo tiñe de verde o azul
  enemy_slime: { file: 'enemies/slime.png', width: 96, height: 24, frameWidth: 32, frameHeight: 24, placeholder: 'slime' },
  // Zombi: 5 cuadros de 48×64 (caminar ×4 y golpeado)
  enemy_zombie: { file: 'enemies/zombie.png', width: 240, height: 64, frameWidth: 48, frameHeight: 64, placeholder: 'zombie' },

  // Escorpión: 3 cuadros de 40×24 (caminar). Avispa: 2 de 32×28 (aleteo). Ojo: 2 de 32×24. Murciélago de fuego: 3 de 36×24
  enemy_scorpion: { file: 'enemies/scorpion.png', width: 120, height: 24, frameWidth: 40, frameHeight: 24, placeholder: 'scorpion' },
  enemy_wasp: { file: 'enemies/wasp.png', width: 64, height: 28, frameWidth: 32, frameHeight: 28, placeholder: 'wasp' },
  enemy_eye: { file: 'enemies/eye.png', width: 64, height: 24, frameWidth: 32, frameHeight: 24, placeholder: 'eye' },
  enemy_firebat: { file: 'enemies/firebat.png', width: 108, height: 24, frameWidth: 36, frameHeight: 24, placeholder: 'firebat' },

  // ---------- Jugador: 31 poses de 48×64, 8 por fila (ver player/animations.js), mirando a la derecha ----------
  player: { file: 'player/player.png', width: 384, height: 256, frameWidth: 48, frameHeight: 64, placeholder: 'player' },

  // ---------- Fondo y cielo ----------
  bg_mountains: { file: 'backgrounds/mountains.png', width: 960, height: 320, placeholder: 'mountains' },
  bg_hills: { file: 'backgrounds/hills.png', width: 960, height: 240, placeholder: 'hills' },
  bg_forest: { file: 'backgrounds/forest.png', width: 960, height: 240, placeholder: 'forest' },
  bg_mountains_desert: { file: 'backgrounds/mountains_desert.png', width: 960, height: 320, placeholder: 'mountains', theme: 'desert' },
  bg_hills_desert: { file: 'backgrounds/hills_desert.png', width: 960, height: 240, placeholder: 'hills', theme: 'desert' },
  bg_forest_desert: { file: 'backgrounds/forest_desert.png', width: 960, height: 240, placeholder: 'forest', theme: 'desert' },
  bg_mountains_snow: { file: 'backgrounds/mountains_snow.png', width: 960, height: 320, placeholder: 'mountains', theme: 'snow' },
  bg_hills_snow: { file: 'backgrounds/hills_snow.png', width: 960, height: 240, placeholder: 'hills', theme: 'snow' },
  bg_forest_snow: { file: 'backgrounds/forest_snow.png', width: 960, height: 240, placeholder: 'forest', theme: 'snow' },
  bg_mountains_jungle: { file: 'backgrounds/mountains_jungle.png', width: 960, height: 320, placeholder: 'mountains', theme: 'jungle' },
  bg_hills_jungle: { file: 'backgrounds/hills_jungle.png', width: 960, height: 240, placeholder: 'hills', theme: 'jungle' },
  bg_forest_jungle: { file: 'backgrounds/forest_jungle.png', width: 960, height: 240, placeholder: 'forest', theme: 'jungle' },
  bg_mountains_shadow: { file: 'backgrounds/mountains_shadow.png', width: 960, height: 320, placeholder: 'mountains', theme: 'shadow' },
  bg_hills_shadow: { file: 'backgrounds/hills_shadow.png', width: 960, height: 240, placeholder: 'hills', theme: 'shadow' },
  bg_forest_shadow: { file: 'backgrounds/forest_shadow.png', width: 960, height: 240, placeholder: 'forest', theme: 'shadow' },
  bg_mountains_crystal: { file: 'backgrounds/mountains_crystal.png', width: 960, height: 320, placeholder: 'mountains', theme: 'crystal' },
  bg_hills_crystal: { file: 'backgrounds/hills_crystal.png', width: 960, height: 240, placeholder: 'hills', theme: 'crystal' },
  bg_forest_crystal: { file: 'backgrounds/forest_crystal.png', width: 960, height: 240, placeholder: 'forest', theme: 'crystal' },
  bg_mountains_volcano: { file: 'backgrounds/mountains_volcano.png', width: 960, height: 320, placeholder: 'mountains', theme: 'volcano' },
  bg_hills_volcano: { file: 'backgrounds/hills_volcano.png', width: 960, height: 240, placeholder: 'hills', theme: 'volcano' },
  bg_forest_volcano: { file: 'backgrounds/forest_volcano.png', width: 960, height: 240, placeholder: 'forest', theme: 'volcano' },
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
  ui_button_attack: { file: 'ui/button_attack.png', width: 80, height: 80, placeholder: 'button_attack', smooth: true },
  ui_button_swap: { file: 'ui/button_swap.png', width: 64, height: 64, placeholder: 'button_swap', smooth: true },
  ui_button_inventory: { file: 'ui/button_inventory.png', width: 64, height: 64, placeholder: 'button_inventory', smooth: true },
  ui_button_fullscreen: { file: 'ui/button_fullscreen.png', width: 48, height: 48, placeholder: 'button_fullscreen', smooth: true },
};
