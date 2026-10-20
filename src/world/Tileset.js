import { TILE_SIZE } from '../config.js';
import { ASSETS } from '../assets.js';
import { MATERIALS, VARIANTS, MASK_COUNT } from './blocks.js';
import { paintPlaceholder } from '../systems/Placeholders.js';

const T = TILE_SIZE;
const S = T + 2; // cada tile lleva 1 px de borde "extruido" a cada lado

const TOP = 1;
const RIGHT = 2;
const BOTTOM = 4;
const LEFT = 8;
const OUTLINE = 'rgba(14,9,6,0.6)';
const SHINE = 'rgba(255,255,255,0.10)';

/**
 * Arma la textura 'tileset' con todos los bloques y paredes.
 * - Una fila por material y variante; 16 columnas = combinaciones de vecinos.
 * - Donde un bloque toca aire se dibuja un contorno oscuro y las esquinas se
 *   redondean (como Terraria). Esto se genera solo, también para imágenes propias:
 *   basta con dibujar UN bloque de 32×32.
 * - 1 px de borde extruido (margin 1, spacing 2) evita líneas entre bloques con zoom no entero.
 */
export function buildTileset(scene) {
  const rows = MATERIALS.length * VARIANTS;
  const canvas = document.createElement('canvas');
  canvas.width = MASK_COUNT * S;
  canvas.height = rows * S;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const cache = new Map();
  const source = (key, variant) => {
    if (!key) return null;
    const id = `${key}#${variant}`;
    if (cache.has(id)) return cache.get(id);
    let src = null;
    const tex = scene.textures.exists(key) ? scene.textures.get(key).getSourceImage() : null;
    // Imagen propia: se usa tal cual para todas las variantes. Placeholder: cada variante es distinta.
    if (tex && !(tex instanceof HTMLCanvasElement)) src = tex;
    else if (ASSETS[key]) src = paintPlaceholder(ASSETS[key], variant);
    else src = tex;
    cache.set(id, src);
    return src;
  };

  MATERIALS.forEach((mat, m) => {
    for (let v = 0; v < VARIANTS; v++) {
      const src = source(mat.textures[Math.min(v, mat.textures.length - 1)], v);
      if (!src) continue;
      const covered = source(mat.covered, v);
      const grassColor = mat.grassy ? samplePixel(src, 16, 3) : null;
      const masks = mat.framed ? MASK_COUNT : 1;
      for (let mask = 0; mask < masks; mask++) {
        const dx = mask * S + 1;
        const dy = (m * VARIANTS + v) * S + 1;
        drawFramedTile(ctx, dx, dy, src, covered, mat.framed ? mask : 15, grassColor);
        extrude(ctx, canvas, dx, dy);
      }
    }
  });

  if (scene.textures.exists('tileset')) scene.textures.remove('tileset');
  scene.textures.addCanvas('tileset', canvas);
}

function drawFramedTile(ctx, dx, dy, src, covered, mask, grassColor) {
  const top = mask & TOP;
  const right = mask & RIGHT;
  const bottom = mask & BOTTOM;
  const left = mask & LEFT;
  // Pasto con un bloque encima → se ve como tierra
  const img = covered && top ? covered : src;
  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, T, T);
  if (mask === 15) return;

  // El pasto "baja" un poco por los costados expuestos
  if (grassColor && !top) {
    ctx.fillStyle = grassColor;
    if (!left) ctx.fillRect(dx, dy, 2, 10);
    if (!right) ctx.fillRect(dx + T - 2, dy, 2, 10);
  }

  // Contorno en los lados que tocan aire
  ctx.fillStyle = OUTLINE;
  if (!top) ctx.fillRect(dx, dy, T, 2);
  if (!bottom) ctx.fillRect(dx, dy + T - 2, T, 2);
  if (!left) ctx.fillRect(dx, dy + (top ? 0 : 2), 2, T - (top ? 0 : 2) - (bottom ? 0 : 2));
  if (!right) ctx.fillRect(dx + T - 2, dy + (top ? 0 : 2), 2, T - (top ? 0 : 2) - (bottom ? 0 : 2));
  // Brillo suave bajo el borde superior/izquierdo
  ctx.fillStyle = SHINE;
  if (!top) ctx.fillRect(dx + 2, dy + 2, T - 4, 2);
  if (!left) ctx.fillRect(dx + 2, dy + 4, 2, T - 8);

  // Esquinas redondeadas donde se juntan dos lados expuestos
  const corner = (cx, cy, sx, sy) => {
    // cx, cy: esquina; sx, sy: dirección hacia adentro
    ctx.clearRect(sx > 0 ? cx : cx - 4, sy > 0 ? cy : cy - 2, 4, 2);
    ctx.clearRect(sx > 0 ? cx : cx - 2, sy > 0 ? cy + 2 : cy - 4, 2, 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(sx > 0 ? cx + 2 : cx - 4, sy > 0 ? cy + 2 : cy - 4, 2, 2);
  };
  if (!top && !left) corner(dx, dy, 1, 1);
  if (!top && !right) corner(dx + T, dy, -1, 1);
  if (!bottom && !left) corner(dx, dy + T, 1, -1);
  if (!bottom && !right) corner(dx + T, dy + T, -1, -1);
}

// Copia los bordes del tile 1 px hacia afuera (evita costuras al escalar)
function extrude(ctx, canvas, dx, dy) {
  ctx.drawImage(canvas, dx, dy, 1, T, dx - 1, dy, 1, T);
  ctx.drawImage(canvas, dx + T - 1, dy, 1, T, dx + T, dy, 1, T);
  ctx.drawImage(canvas, dx - 1, dy, T + 2, 1, dx - 1, dy - 1, T + 2, 1);
  ctx.drawImage(canvas, dx - 1, dy + T - 1, T + 2, 1, dx - 1, dy + T, T + 2, 1);
}

// Color de un píxel de una imagen (para que el pasto de los costados combine con la imagen)
function samplePixel(src, x, y) {
  const c = document.createElement('canvas');
  c.width = T;
  c.height = T;
  const cctx = c.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, T, T);
  const [r, g, b, a] = cctx.getImageData(x, y, 1, 1).data;
  return a > 0 ? `rgb(${r},${g},${b})` : null;
}
