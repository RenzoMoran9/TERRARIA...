// Constantes globales del juego

export const TILE_SIZE = 32; // tamaño de cada tile en píxeles
export const CHUNK_SIZE = 32; // tiles por lado de cada chunk
export const CHUNK_SHIFT = 5; // log2(CHUNK_SIZE): permite dividir con >> (más rápido)
export const CHUNK_MASK = CHUNK_SIZE - 1;

export const WORLD_CHUNKS_X = 64; // ancho del mundo en chunks
export const WORLD_CHUNKS_Y = 12; // alto del mundo en chunks
export const WORLD_WIDTH = WORLD_CHUNKS_X * CHUNK_SIZE; // 2048 tiles
export const WORLD_HEIGHT = WORLD_CHUNKS_Y * CHUNK_SIZE; // 384 tiles
export const SURFACE_LEVEL = 110; // altura media de la superficie (en tiles, desde arriba)

// Chunks extra que se mantienen cargados alrededor de lo que ve la cámara
export const CHUNK_LOAD_MARGIN = 1;
// Máximo de chunks que se construyen por frame (evita tirones)
export const CHUNKS_PER_FRAME = 1;

export const PLAYER = {
  WIDTH: 20, // hitbox en píxeles
  HEIGHT: 42,
  SPRITE_WIDTH: 32, // tamaño de cada cuadro del sprite (los pies van abajo al centro)
  SPRITE_HEIGHT: 48,
  SPEED: 210, // píxeles/segundo
  GROUND_ACCEL: 2000,
  AIR_ACCEL: 1300,
  GROUND_FRICTION: 2400,
  AIR_FRICTION: 500,
  GRAVITY: 1900,
  MAX_FALL: 950,
  JUMP_VELOCITY: -680, // ~3,8 bloques de altura
  COYOTE_TIME: 0.1, // margen para saltar justo después de salir de un borde
  JUMP_BUFFER: 0.12, // margen para saltar si se pulsó un poco antes de tocar suelo
  MAX_HEALTH: 100,
  SAFE_FALL_TILES: 12, // caída sin daño (en bloques)
  FALL_DAMAGE_PER_TILE: 8, // daño por cada bloque extra de caída
  REGEN_DELAY: 5, // segundos sin recibir daño antes de regenerar
  REGEN_PER_SECOND: 2,
  RESPAWN_SECONDS: 3,
};

export const REACH_TILES = 5.5; // alcance para minar/colocar (≈5 bloques)
export const STATION_RANGE = 4; // distancia (en bloques) a la mesa de trabajo para craftear
export const DAY_LENGTH_SECONDS = 600; // ciclo día/noche completo: 10 minutos
export const AUTOSAVE_SECONDS = 60;
export const MAX_STACK = 99;
export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36; // 9 de la barra rápida + 27 de mochila

export const SAVE_KEY = 'terra2d-save-v1';
export const SAVE_VERSION = 1;

// Orden de dibujado dentro de la escena del juego
export const DEPTH = {
  WALLS: 0,
  BLOCKS: 1,
  PLAYER: 5,
  TOOL: 6,
  PARTICLES: 7,
  CRACK: 8,
  HIGHLIGHT: 9,
  LIGHT: 10,
  FLOATING_TEXT: 11,
};
