import { TILE_SIZE } from '../config.js';
import { ASSETS } from '../assets.js';
import { MATERIALS, VARIANTS, MASK_COUNT, TILESET_CELLS } from './blocks.js';
import { paintPlaceholder } from '../systems/Placeholders.js';
import { EDGE_STYLE, defaultEdgeStyle, frameTile } from '../art/terrain.js';

const T = TILE_SIZE;
const S = T + 2; // cada tile lleva 1 px de borde "extruido" a cada lado

const TOP = 1;

/**
 * Arma la textura 'tileset' con todos los bloques, partes de muebles y paredes.
 * - Las celdas de cada material van seguidas (ver tileIndex en blocks.js), 16 por fila.
 * - Bloques con bordes: una celda por variante y combinación de vecinos.
 * - Donde un bloque toca aire se dibuja un contorno oscuro del color del material, las esquinas se
 *   redondean, el borde de arriba se ilumina y el de abajo se sombrea; el pasto baja por los costados
 *   (ver frameTile en art/terrain.js). Se genera solo, también para imágenes propias:
 *   basta con dibujar UN bloque de 32×32.
 * - Muebles: cada parte es el recorte de 32×32 que le toca de la imagen del objeto entero.
 * - 1 px de borde extruido (margin 1, spacing 2) evita líneas entre bloques con zoom no entero.
 */
export function buildTileset(scene) {
  const rows = Math.ceil(TILESET_CELLS / MASK_COUNT);
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

  // Cada celda se dibuja en un lienzo chico (con su borde extruido) y se copia UNA vez al grande:
  // copiar dentro del lienzo grande (de varios miles de px) es muy lento en algunos navegadores.
  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = S;
  cellCanvas.height = S;
  const cctx = cellCanvas.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  // Píxeles de cada textura (para dibujar los bordes píxel a píxel) y su estilo de borde
  const readCanvas = document.createElement('canvas');
  readCanvas.width = T;
  readCanvas.height = T;
  const rctx = readCanvas.getContext('2d', { willReadFrequently: true });
  rctx.imageSmoothingEnabled = false;
  const pixelCache = new Map();
  const pixels = (key, variant) => {
    const id = `${key}#${variant}`;
    if (pixelCache.has(id)) return pixelCache.get(id);
    const src = source(key, variant);
    let data = null;
    if (src) {
      rctx.clearRect(0, 0, T, T);
      rctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, T, T);
      data = rctx.getImageData(0, 0, T, T).data;
    }
    pixelCache.set(id, data);
    return data;
  };
  const styleOf = (key, data, grassy) => {
    const style = EDGE_STYLE[key] || defaultEdgeStyle(data);
    if (!grassy || style.grass) return style;
    // Pasto de una imagen propia: los tonos salen del color de arriba
    const p = (3 * T + 16) * 4;
    const c = [data[p], data[p + 1], data[p + 2]];
    const hex = (k) => '#' + c.map((v) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0')).join('');
    return { ...style, grass: { deep: hex(0.45), dark: hex(0.7), mid: hex(1), light: hex(1.15), hi: hex(1.3) } };
  };
  const cellData = new ImageData(S, S);

  let cell = 0;
  // Celda con bordes: se calcula en píxeles y se copia con su borde extruido
  const putPixels = (data) => {
    const c = cell++;
    const d = cellData.data;
    for (let y = 0; y < S; y++) {
      const sy = Math.min(T - 1, Math.max(0, y - 1));
      for (let x = 0; x < S; x++) {
        const sx = Math.min(T - 1, Math.max(0, x - 1));
        const p = (y * S + x) * 4;
        const q = (sy * T + sx) * 4;
        d[p] = data[q];
        d[p + 1] = data[q + 1];
        d[p + 2] = data[q + 2];
        d[p + 3] = data[q + 3];
      }
    }
    cctx.putImageData(cellData, 0, 0);
    ctx.drawImage(cellCanvas, (c % MASK_COUNT) * S, Math.floor(c / MASK_COUNT) * S);
  };
  const put = (draw) => {
    const c = cell++;
    cctx.clearRect(0, 0, S, S);
    draw(cctx);
    extrude(cctx, cellCanvas, 1, 1);
    ctx.drawImage(cellCanvas, (c % MASK_COUNT) * S, Math.floor(c / MASK_COUNT) * S);
  };
  for (const mat of MATERIALS) {
    if (mat.crop) {
      // Parte de un mueble
      const src = source(mat.crop.key, 0);
      if (src) put((g) => drawCrop(g, 1, 1, src, mat.crop));
      else cell++;
      continue;
    }
    for (let v = 0; v < VARIANTS; v++) {
      const key = mat.textures[Math.min(v, mat.textures.length - 1)];
      const src = source(key, v);
      if (!mat.framed) {
        if (src) put((g) => g.drawImage(src, 0, 0, src.width, src.height, 1, 1, T, T));
        else cell++;
        continue;
      }
      const data = src && pixels(key, v);
      if (!data) {
        cell += MASK_COUNT;
        continue;
      }
      const style = styleOf(key, data, mat.grassy);
      const cov = mat.covered && pixels(mat.covered, v);
      const covStyle = cov && styleOf(mat.covered, cov, false);
      for (let mask = 0; mask < MASK_COUNT; mask++) {
        // Pasto con un bloque encima → se ve como la tierra de 'covered'
        if (cov && mask & TOP) putPixels(frameTile(cov, mask, covStyle, v));
        else putPixels(frameTile(data, mask, style, v));
      }
    }
  }

  if (scene.textures.exists('tileset')) scene.textures.remove('tileset');
  scene.textures.addCanvas('tileset', canvas);
}

// Recorte de 32×32 de la imagen de un mueble (la imagen puede estar a otra escala, p. ej. ×2)
function drawCrop(ctx, dx, dy, src, crop) {
  const k = src.width / (crop.cols * T);
  ctx.save();
  if (crop.mirrored) {
    ctx.translate(dx + T, dy);
    ctx.scale(-1, 1);
  } else ctx.translate(dx, dy);
  ctx.drawImage(src, crop.col * T * k, crop.row * T * k, T * k, T * k, 0, 0, T, T);
  ctx.restore();
}

// Copia los bordes del tile 1 px hacia afuera (evita costuras al escalar)
function extrude(ctx, canvas, dx, dy) {
  ctx.drawImage(canvas, dx, dy, 1, T, dx - 1, dy, 1, T);
  ctx.drawImage(canvas, dx + T - 1, dy, 1, T, dx + T, dy, 1, T);
  ctx.drawImage(canvas, dx - 1, dy, T + 2, 1, dx - 1, dy - 1, T + 2, 1);
  ctx.drawImage(canvas, dx - 1, dy + T - 1, T + 2, 1, dx - 1, dy + T, T + 2, 1);
}
