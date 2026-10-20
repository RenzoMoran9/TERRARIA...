import { TILE_SIZE } from '../config.js';
import { TILESET_FRAMES } from './blocks.js';

/**
 * Une las imágenes de todos los bloques (o sus placeholders) en una sola
 * textura 'tileset' para que los tilemaps se dibujen en un único lote (rápido).
 * Cada tile lleva 1 px de borde "extruido" (margin 1, spacing 2) para evitar
 * líneas entre bloques cuando la cámara usa zoom no entero (celulares).
 */
export function buildTileset(scene) {
  const T = TILE_SIZE;
  const S = T + 2;
  const canvas = document.createElement('canvas');
  canvas.width = TILESET_FRAMES.length * S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  TILESET_FRAMES.forEach((key, i) => {
    if (!key || !scene.textures.exists(key)) return;
    const src = scene.textures.get(key).getSourceImage();
    const dx = i * S + 1;
    const dy = 1;
    ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, T, T);
    // Extrusión: copiar los bordes 1 px hacia afuera
    ctx.drawImage(canvas, dx, dy, 1, T, dx - 1, dy, 1, T);
    ctx.drawImage(canvas, dx + T - 1, dy, 1, T, dx + T, dy, 1, T);
    ctx.drawImage(canvas, dx - 1, dy, T + 2, 1, dx - 1, dy - 1, T + 2, 1);
    ctx.drawImage(canvas, dx - 1, dy + T - 1, T + 2, 1, dx - 1, dy + T, T + 2, 1);
  });

  if (scene.textures.exists('tileset')) scene.textures.remove('tileset');
  scene.textures.addCanvas('tileset', canvas);
}
