// Arte mejorado: flora. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Plantas (16×16 lógicos, paradas sobre la fila de abajo), troncos, cactus y copas de árboles.
// Luz desde arriba a la izquierda; sombras más frías/saturadas y brillos más cálidos.
import { hash } from '../systems/PixelArt.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- paletas (oscuro → claro)
const BARK = { line: '#21120e', ramp: ['#33201c', '#4a2c1f', '#633b24', '#7d4f2c', '#986535', '#b5834a'] };
const LEAVES = {
  forest: { line: '#0e2a22', ramp: ['#153d2e', '#1d5631', '#2a7035', '#3e8e3a', '#5dac43', '#90cf58'], spark: '#d2ee86' },
  jungle: { line: '#06291c', ramp: ['#0a4228', '#0f5d2b', '#1a7e2e', '#33a334', '#68c63a', '#b0e850'], spark: '#eeff9c' },
  shadow: { line: '#190b2a', ramp: ['#281244', '#3b1b5e', '#53297e', '#6f3ca2', '#9059c4', '#be8fea'], spark: '#ffc8ff' },
  pine: { line: '#0a201e', ramp: ['#0f322c', '#164234', '#1d543b', '#286844', '#377e4e', '#4f965c'] },
};
const SNOW = ['#6f86bf', '#9cb2dd', '#c8d8f0', '#eaf2fc', '#ffffff'];
const CACTUS = { line: '#14361d', ramp: ['#1c5229', '#286c32', '#3a883a', '#55a446', '#78c058', '#a8dc78'] };

// ---------------------------------------------------------------- búfer de tonos
// Cada píxel guarda un grupo (paleta), un tono y un id de capa. Las capas pintadas después tapan a las
// anteriores y les tiran sombra hacia abajo a la derecha (bolsillos de sombra entre racimos).
function toneBuf(pc) {
  const n = pc.w * pc.h;
  return { w: pc.w, h: pc.h, tone: new Int8Array(n).fill(-1), grp: new Int8Array(n), id: new Int16Array(n).fill(-1) };
}

function bput(B, x, y, grp, tone, id) {
  if (x < 0 || y < 0 || x >= B.w || y >= B.h) return;
  const i = y * B.w + x;
  B.tone[i] = tone;
  B.grp[i] = grp;
  B.id[i] = id;
}

/** Sombra proyectada: un píxel queda más oscuro si arriba/izquierda tiene una capa que lo tapa. */
function castShadows(B) {
  const { w, h, id, tone } = B;
  const out = tone.slice();
  const idAt = (x, y) => (x < 0 || y < 0 ? -1 : id[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const b = id[i];
      if (b < 0) continue;
      let d = 0;
      if (idAt(x, y - 1) > b || idAt(x - 1, y - 1) > b) d = 2;
      else if (idAt(x, y - 2) > b || idAt(x - 1, y - 2) > b || idAt(x - 2, y - 1) > b) d = 1;
      if (d) out[i] = Math.max(0, tone[i] - d);
    }
  }
  B.tone = out;
}

function flush(B, pc, groups) {
  for (let y = 0; y < B.h; y++) {
    for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x;
      if (B.tone[i] < 0) continue;
      const g = groups[B.grp[i]];
      pc.set(x, y, g[clamp(B.tone[i], 0, g.length - 1)]);
    }
  }
}

// ---------------------------------------------------------------- copas
/**
 * Textura de manojos de hojas (celdas de Voronoi de ~4 px): devuelve un ajuste de luz para el píxel.
 * Lado de arriba-izquierda de cada manojo más claro; el borde de abajo-derecha hace un pliegue oscuro.
 */
function leafBunch(x, y, seed, sp = 4, wrap = 0) {
  const gx = Math.floor(x / sp);
  const gy = Math.floor(y / sp);
  let d1 = 1e9;
  let d2 = 1e9;
  let bx = 0;
  let by = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      // wrap > 0: la grilla se repite cada 'wrap' celdas (texturas de tile sin costuras)
      const hx = wrap ? (gx + i + wrap) % wrap : gx + i;
      const hy = wrap ? (gy + j + wrap) % wrap : gy + j;
      const px = (gx + i) * sp + hash(hx, hy, seed) * sp;
      const py = (gy + j) * sp + hash(hx, hy, seed + 1) * sp;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        bx = px;
        by = py;
      } else if (d < d2) d2 = d;
    }
  }
  const f = ((x - bx) * 0.6 + (y - by) * 0.8) / sp; // >0 = lado en sombra del manojo
  let s = -f * 0.16;
  if (Math.sqrt(d2) - Math.sqrt(d1) < 1.1 && f > 0) s -= 0.14; // pliegue entre manojos
  return s;
}

/**
 * Racimos de hojas: cada racimo es un círculo de borde irregular con luz desde arriba a la izquierda,
 * la copa entera se oscurece hacia abajo y la textura son "escamas" de hojas de 2×2 (no ruido suelto).
 * Se pintan de abajo hacia arriba: los de arriba tapan a los de abajo. Devuelve el siguiente id libre.
 */
function foliage(B, clumps, seed, { grp = 0, n = 6, id: idStart = 0, bright = 0, jag = 2.6 } = {}) {
  let top = 1e9;
  let bottom = -1e9;
  for (const [, cy, r] of clumps) {
    top = Math.min(top, cy - r);
    bottom = Math.max(bottom, cy + r);
  }
  const order = clumps.map((c, i) => [c[0], c[1], c[2], i]).sort((a, b) => b[1] - a[1] || a[3] - b[3]);
  let id = idStart;
  for (const [cx, cy, r, k] of order) {
    for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++) {
      for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        // borde con "hojas" que asoman (en bloques de 2×2 para que no quede ruido de píxeles sueltos)
        const edge = r + (hash((x + 40) >> 1, (y + 40) >> 1, seed + k * 13) - 0.45) * jag;
        if (d > edge) continue;
        const nx = dx / r;
        const ny = dy / r;
        const facing = nx * 0.6 + ny * 0.8; // >0 = lado en sombra
        let s = 0.6 - 0.5 * facing;
        s -= ((y - top) / (bottom - top)) * 0.36 - 0.1; // la copa se oscurece hacia abajo
        // manojos de hojas: cada uno con su propia luz arriba a la izquierda y un pliegue oscuro abajo
        s += leafBunch(x, y, seed) + (hash(x, y, seed + 3) - 0.5) * 0.06;
        if (d > r - 1.4 && facing > 0.25) s -= 0.12; // contorno interno del lado en sombra
        s += bright;
        bput(B, x, y, grp, clamp(Math.floor(s * n), 0, n - 1), id);
      }
    }
    id++;
  }
  return id;
}

/** Brillos de hojas: pequeñas marcas en las zonas más iluminadas (con moderación). */
function leafGlints(pc, B, x0, x1, seed, hi, spark, rate = 0.05) {
  for (let y = 1; y < B.h - 1; y++) {
    for (let x = x0 + 1; x < x1 - 1; x++) {
      const i = y * B.w + x;
      if (B.tone[i] < 5 || B.tone[i - B.w] < 0) continue;
      if (hash(x, y, seed) < rate) {
        pc.set(x, y, spark);
        if (pc.get(x + 1, y) && B.tone[i + 1] >= 4) pc.set(x + 1, y, hi);
      }
    }
  }
}

/** Rama de corteza (de (x0,y0) a (x1,y1)), grosor que se afina; luz desde arriba a la izquierda. */
function limb(B, x0, y0, x1, y1, w0, w1, grp, id, toneBias = 0) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    const r = Math.max(0.5, (w0 + (w1 - w0) * t) / 2);
    for (let y = Math.round(cy - r); y <= Math.round(cy + r - 0.01); y++) {
      for (let x = Math.round(cx - r); x <= Math.round(cx + r - 0.01); x++) {
        const dx = x + 0.5 - cx - 0.5;
        const dy = y + 0.5 - cy - 0.5;
        if (dx * dx + dy * dy > r * r + 0.6) continue;
        const u = (dx * 0.8 + dy * 0.4) / (r + 0.5); // -1 = lado iluminado
        bput(B, x, y, grp, clamp(Math.round(2.6 - u * 1.8 + toneBias), 0, 5), id);
      }
    }
  }
}

// ---------------------------------------------------------------- corteza
// Columnas del tronco (x 2..13 del tile): tono base de un cilindro con luz desde la izquierda
const TRUNK_TONE = [3, 4, 4, 3, 3, 2, 2, 2, 2, 1, 1, 0];
// Grietas: posición fija arriba y abajo (encajan con cualquier variante), serpentean al medio
const FURROWS = [3, 7, 10];

/** Píxel de corteza (columna c = 0..11, fila y del tile). Devuelve un índice de BARK.ramp. */
function barkTone(c, y, v) {
  let t = TRUNK_TONE[c];
  for (let f = 0; f < FURROWS.length; f++) {
    const mid = y >= 3 && y <= 12;
    const wob = mid ? Math.round((hash(f, (y - 3) >> 2, 140 + v) - 0.5) * 2) : 0;
    const fx = FURROWS[f] + wob;
    if (c === fx) t = Math.max(0, t - 2);
    else if (c === fx + 1) t = Math.min(5, t + 1); // pared de la grieta que mira a la luz
  }
  // escamas cortas de corteza (lejos de los bordes del tile para que encaje)
  if (y > 1 && y < 14 && hash(c >> 1, y, 150 + v) < 0.09) t = Math.max(0, t - 1);
  return t;
}

/** Pinta un tramo de tronco de 16 filas con su contorno, empezando en (ox, oy). */
function drawLog(pc, ox, oy, v) {
  for (let y = 0; y < 16; y++) {
    pc.set(ox + 1, oy + y, BARK.line);
    pc.set(ox + 14, oy + y, BARK.line);
    for (let c = 0; c < 12; c++) pc.set(ox + 2 + c, oy + y, BARK.ramp[barkTone(c, y, v)]);
  }
}

/** Cuello del tronco dentro de la copa (filas 45..60 del cuadro = tile de tronco de arriba). Va detrás de las hojas. */
function trunkNeck(pc, ox) {
  for (let y = 45; y <= 60; y++) {
    if (!pc.get(ox + 29, y)) pc.set(ox + 29, y, BARK.line);
    if (!pc.get(ox + 42, y)) pc.set(ox + 42, y, BARK.line);
    for (let c = 0; c < 12; c++) if (!pc.get(ox + 30 + c, y)) pc.set(ox + 30 + c, y, BARK.ramp[barkTone(c, y - 45, 0)]);
  }
}

/** Contorno de toda la hoja, sin la línea que quedaría debajo del cuello del tronco (fila 61). */
function outlineSheet(pc, line, frames = 3) {
  pc.outline(line);
  for (let f = 0; f < frames; f++) for (let x = 30; x <= 41; x++) if (pc.get(f * 72 + x, 61) === line) pc.set(f * 72 + x, 61, null);
}

// ---------------------------------------------------------------- mapas de píxeles
/** Dibuja un mapa de caracteres ('.' = vacío) con la paleta dada. flip = espejado horizontal. */
function stamp(pc, x0, y0, rows, pal, flip = false) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[flip ? row.length - 1 - i : i];
      if (ch !== '.' && pal[ch]) pc.set(x0 + i, y0 + j, pal[ch]);
    }
  }
}

/** Halo suave alrededor de lo pintado (plantas que brillan). Solo toca píxeles vacíos. */
function halo(pc, color, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r && !pc.get(x, y) && x >= 0 && y >= 0 && x < pc.w && y < pc.h) pc.set(x, y, d < r * 0.6 ? color[0] : color[1]);
    }
  }
}

/** Contorno; la fila de abajo (apoyada en el suelo) queda sin línea. */
function outlineOnGround(pc, line) {
  pc.outline(line);
  for (let x = 0; x < 16; x++) if (pc.get(x, 15) === line) pc.set(x, 15, null);
}

/** Cambia el color del contorno desde la fila y0 hacia abajo (tallos con contorno verde). */
function recolor(pc, from, to, y0) {
  for (let y = y0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (pc.get(x, y) === from) pc.set(x, y, to);
}

// Pasto del bosque (igual que el borde del bloque de pasto de terrain.js)
const G = { o: '#12331f', k: '#1b4e30', d: '#2a7a36', m: '#45a542', l: '#6cc54a', h: '#a6e266' };

// ---------------------------------------------------------------- copas: formas por variante
const OAK = [
  [[24, 45, 9], [48, 45, 9], [36, 40, 10], [14, 35, 8], [58, 35, 8], [26, 30, 12], [46, 30, 12], [36, 23, 12], [20, 18, 9], [52, 18, 9], [36, 11, 10]],
  [[27, 46, 8], [45, 46, 8], [36, 41, 10], [23, 34, 10], [49, 34, 10], [36, 28, 12], [25, 18, 9], [47, 18, 9], [36, 10, 9]],
  [[22, 46, 9], [50, 46, 9], [36, 43, 9], [10, 38, 7], [62, 38, 7], [20, 32, 11], [52, 32, 11], [36, 28, 12], [26, 18, 10], [46, 18, 10], [36, 14, 8]],
];
const JUNGLE = [
  [[12, 38, 8], [26, 42, 9], [46, 42, 9], [60, 38, 8], [8, 29, 5.5], [64, 29, 5.5], [19, 28, 11], [36, 30, 12], [53, 28, 11], [26, 17, 10], [46, 17, 10], [36, 11, 9]],
  [[20, 44, 9], [36, 40, 11], [52, 44, 9], [10, 34, 7], [62, 34, 7], [22, 28, 11], [50, 28, 11], [36, 22, 12], [24, 13, 8], [48, 13, 8], [36, 8, 7]],
  [[16, 40, 9], [31, 44, 9], [44, 44, 8], [57, 40, 9], [9, 30, 6], [63, 30, 6], [24, 30, 12], [48, 30, 12], [36, 20, 12], [21, 18, 8], [53, 18, 8]],
];
const SHADOWY = [
  [[27, 44, 8], [46, 43, 8], [36, 34, 10], [19, 30, 8], [53, 28, 8], [33, 20, 9], [47, 16, 6], [22, 16, 6]],
  [[30, 45, 7], [44, 42, 8], [36, 32, 10], [24, 24, 8], [49, 22, 8], [36, 12, 8]],
  [[22, 44, 7], [38, 44, 8], [52, 42, 7], [28, 33, 9], [46, 31, 9], [16, 28, 6], [58, 26, 6], [36, 21, 9]],
];
// Ramas retorcidas del árbol sombrío: [puntos x,y..., grosor al inicio, grosor en la punta]
const TWISTED = [
  [[[34, 47, 29, 40, 24, 37, 19, 31, 13, 29, 10, 23, 7, 21], 4, 1], [[38, 47, 44, 40, 50, 37, 55, 31, 60, 29, 63, 22, 66, 20], 4, 1], [[36, 44, 37, 32, 34, 24, 36, 15, 33, 6], 3, 1]],
  [[[34, 47, 30, 38, 25, 32, 20, 26, 17, 19, 13, 15, 12, 11], 4, 1], [[38, 47, 43, 38, 48, 32, 53, 25, 58, 22, 61, 15, 64, 13], 4, 1], [[36, 42, 35, 30, 38, 20, 35, 10, 38, 2], 3, 1]],
  [[[34, 47, 27, 41, 20, 38, 15, 33, 11, 32, 7, 25, 4, 23], 4, 1], [[38, 47, 46, 41, 53, 38, 58, 33, 62, 31, 66, 25, 69, 24], 4, 1], [[36, 44, 35, 34, 38, 26, 35, 17, 38, 11], 3, 1]],
];

/** Rama quebrada por varios puntos (grosor que se afina de w0 a w1). */
function gnarl(B, ox, pts, w0, w1, id) {
  const segs = pts.length / 2 - 1;
  for (let i = 0; i < segs; i++) {
    const a = w0 + ((w1 - w0) * i) / segs;
    const b = w0 + ((w1 - w0) * (i + 1)) / segs;
    limb(B, ox + pts[i * 2], pts[i * 2 + 1], ox + pts[i * 2 + 2], pts[i * 2 + 3], a, b, 1, id, -0.6);
  }
}

/** Horquilla del tronco que entra en la copa (se ve por el hueco de abajo). */
function forkLimbs(B, ox, id) {
  limb(B, ox + 33, 47, ox + 27, 36, 4, 3, 1, id);
  limb(B, ox + 38, 47, ox + 45, 35, 4, 3, 1, id, -0.5);
  limb(B, ox + 35, 46, ox + 36, 40, 4, 3, 1, id);
}

/** Copa de racimos de hojas (bosque, selva, sombrío) para los 3 cuadros de la hoja. */
function canopySheet(pc, layouts, L, seed, extra = {}) {
  const B = toneBuf(pc);
  for (let v = 0; v < 3; v++) {
    const ox = v * 72;
    let id = 0;
    if (extra.before) id = extra.before(B, ox, v, id);
    else forkLimbs(B, ox, id++);
    const clumps = layouts[v].map(([x, y, r]) => [ox + x, y, r]);
    foliage(B, clumps, seed + v * 101, { id, jag: extra.jag || 2.6 });
  }
  castShadows(B);
  flush(B, pc, [L.ramp, BARK.ramp]);
  for (let v = 0; v < 3; v++) leafGlints(pc, B, v * 72, v * 72 + 72, seed + 9 + v, L.ramp[5], L.spark, extra.glint != null ? extra.glint : 0.05);
  if (extra.decorate) extra.decorate(B);
  outlineSheet(pc, L.line);
  for (let v = 0; v < 3; v++) trunkNeck(pc, v * 72);
  return B;
}

/** Hoja grande de selva que asoma de la copa y cae hacia el costado (dir = -1 izquierda, 1 derecha). */
function frond(pc, x0, y0, dir, len, L) {
  for (let t = 0; t <= len; t++) {
    const cx = x0 + dir * t;
    const cy = y0 + (t * t) / (len * 1.6);
    const w = Math.sin((Math.PI * (t + 1)) / (len + 2)) * 2.2;
    for (let dy = -Math.round(w); dy <= Math.round(w); dy++) {
      const c = dy === 0 ? L.ramp[2] : dy < 0 ? L.ramp[dy === -Math.round(w) ? 5 : 4] : L.ramp[dy === Math.round(w) ? 1 : 3];
      pc.set(Math.round(cx), Math.round(cy) + dy, c);
    }
  }
}

// ---------------------------------------------------------------- pinos nevados
function pineFrame(B, ox, v) {
  const tiers = 4 + v;
  const H = 51 / (1 + (tiers - 1) * 0.55); // alto de cada capa (se enciman un 45 %)
  let id = 1;
  // de abajo hacia arriba: cada capa de arriba tapa a la de abajo y le tira sombra
  for (let k = tiers - 1; k >= 0; k--) {
    const ya = 2 + k * H * 0.55; // punta de la capa
    const W = 11 + (k / (tiers - 1)) * 21; // medio ancho abajo
    const y0 = Math.floor(ya);
    for (let y = y0; y <= Math.ceil(ya + H) + 4; y++) {
      const f = (y - ya) / H;
      const hw = W * Math.pow(clamp(f, 0, 1), 1.05);
      for (let x = -Math.ceil(W) - 1; x <= Math.ceil(W) + 1; x++) {
        const ax = Math.abs(x) / W;
        // borde de abajo: dientes de agujas y puntas que cuelgan hacia los costados
        const tooth = (Math.abs(x) + k) % 3 === 0 ? 1 : 0;
        const yb = ya + H + ax * ax * ax * 5 + tooth + (hash((x + 40) >> 1, k, 400 + v) < 0.3 ? 1 : 0);
        if (f < 0 || y > yb || Math.abs(x) > hw) continue;
        // distancia (vertical) al borde de arriba de la capa → nieve en la ladera
        const ytop = ya + H * Math.pow(Math.min(1, ax), 1 / 1.05);
        const depth = y - ytop;
        const snowD = 1.6 + (x < 0 ? 0.8 : 0) + (hash(x + 40, k, 410 + v) < 0.25 ? 1 : 0) + (k === 0 ? 0.6 : 0);
        if (depth < snowD && y < yb - 1) {
          let s = 3.6 - (x / W) * 1.4 - depth * 0.7;
          if (depth >= snowD - 1 && x > 0) s -= 0.8;
          bput(B, ox + 36 + x, y, 2, clamp(Math.round(s), 0, 4), id);
          continue;
        }
        const fy = clamp((y - ytop) / Math.max(2, yb - ytop), 0, 1);
        let s = 3.4 - (x / W) * 1.7 - fy * 2.4;
        // agujas: trazos diagonales que bajan hacia afuera
        const n = (y * 2 - Math.abs(x) + k * 3 + 100) % 5;
        if (n === 0) s -= 1;
        else if (n === 2 && x <= 0) s += 0.5;
        if (y >= Math.floor(yb)) s -= 0.7;
        bput(B, ox + 36 + x, y, 0, clamp(Math.round(s), 0, 5), id);
      }
    }
    id++;
  }
}

/** Racimo de cristales facetados (cara izquierda iluminada, derecha en sombra) con brillo. */
function crystalCluster(pc, R, glow, v) {
  // [x de la base, alto, medio ancho, inclinación]
  const shards = [[8, 13, 1, 0], [4, 8, 1, -1], [12, 9, 1, 1], [6, 5, 1, -1], [10, 6, 1, 1]];
  const order = [3, 4, 1, 2, 0]; // de atrás hacia adelante
  for (const s of order) {
    const [bx, h, w, lean] = shards[s];
    const hh = h - (v === 1 && s > 2 ? 1 : 0) + (v === 2 && s === 0 ? -2 : 0);
    for (let j = 0; j < hh; j++) {
      const y = 15 - j;
      const off = Math.round((lean * j) / 4);
      const half = j >= hh - 2 ? 0 : w;
      for (let dx = -half; dx <= half; dx++) {
        const x = bx + off + dx;
        let t = dx < 0 ? 4 : dx === 0 ? 3 : 1;
        if (s >= 3) t -= 1; // los de atrás más oscuros
        if (dx < 0 && j === hh - 3) t = 5;
        pc.set(x, y, R[clamp(t, 0, 5)]);
      }
    }
  }
  outlineOnGround(pc, R[0]);
  halo(pc, [glow + '0.22)', glow + '0.08)'], 8, 9, 8);
}

// Matas de pasto: [x de la base, alto, hacia dónde se curva (-1/1), atrás (1) o adelante (0)]
const GRASS_TUFTS = [
  [[4, 7, -1, 1], [7, 11, 1, 1], [11, 8, 1, 1], [2, 5, -1, 0], [5, 9, -1, 0], [8, 6, 1, 0], [10, 10, 1, 0], [13, 6, 1, 0]],
  [[3, 9, -1, 1], [9, 7, 1, 1], [12, 10, 1, 1], [1, 4, -1, 0], [4, 6, -1, 0], [6, 11, 1, 0], [9, 5, -1, 0], [12, 7, 1, 0], [14, 4, 1, 0]],
];

/** Hojas de pasto curvas. P = [hondo, oscuro, medio, claro, brillo]. */
function grassBlades(pc, blades, v, seed, P) {
  for (let k = 0; k < blades.length; k++) {
    const [bx, bh, lean, back] = blades[k];
    const h = Math.max(3, bh - Math.floor(hash(k, v, seed) * 3) - (v === 2 ? 1 : 0));
    const bend = 1.5 + hash(k, v, seed + 1) * 1.5;
    for (let j = 0; j < h; j++) {
      const f = j / (h - 1);
      const x = bx + Math.round(lean * f * f * bend);
      const tone = back ? (j === h - 1 ? 2 : j < 2 ? 0 : 1) : j === h - 1 ? 4 : f > 0.6 ? 3 : j < 2 ? 1 : 2;
      pc.set(x, 15 - j, P[tone]);
      if (!back && j < 2) pc.set(x + 1, 15 - j, P[1]); // base más gruesa
    }
  }
}

// ---------------------------------------------------------------- pintores
export const PIXEL = {
  // ---------- árboles ----------
  tree_top(pc) {
    canopySheet(pc, OAK, LEAVES.forest, 600);
  },
  tree_top_jungle(pc) {
    const L = LEAVES.jungle;
    canopySheet(pc, JUNGLE, L, 700, {
      glint: 0.07,
      decorate(B) {
        // Lianas con hojas colgando del borde de abajo, y algunas flores rosadas sobre la copa
        for (let v = 0; v < 3; v++) {
          const ox = v * 72;
          for (let i = 0; i < 7; i++) {
            const x = ox + 6 + Math.floor(hash(i, 1, 710 + v) * 60);
            if (x > ox + 26 && x < ox + 46) continue; // no tapar el tronco
            let y = 62;
            while (y > 0 && B.tone[y * B.w + x] < 0) y--;
            if (y < 24) continue;
            const len = 6 + Math.floor(hash(i, 2, 710 + v) * 9);
            for (let j = 0; j <= len && y + j < 62; j++) {
              const sx = x + ((j >> 2) & 1);
              if (B.tone[(y + j) * B.w + sx] >= 0) continue;
              pc.set(sx, y + j, L.ramp[j % 4 === 1 ? 2 : 1]);
              if (j % 4 === 2) {
                const side = j % 8 === 2 ? -1 : 1;
                pc.set(sx + side, y + j, L.ramp[4]);
                pc.set(sx + side, y + j + 1, L.ramp[3]);
              }
            }
          }
          // hojas grandes que asoman por los costados
          const fy = [[30, 36], [26, 38], [30, 30]][v];
          frond(pc, ox + 9, fy[0], -1, 7, L);
          frond(pc, ox + 63, fy[1], 1, 7, L);
          for (let i = 0; i < 5; i++) {
            const x = ox + 10 + Math.floor(hash(i, 3, 720 + v) * 52);
            const y = 8 + Math.floor(hash(i, 4, 720 + v) * 30);
            if (B.tone[y * B.w + x] < 2 || B.tone[(y - 2) * B.w + x] < 0) continue;
            stamp(pc, x - 1, y - 1, ['.h.', 'hlm', '.md'], { h: '#ffd6ea', l: '#ff7ab4', m: '#e8458a', d: '#a8245e' });
          }
        }
      },
    });
  },
  tree_top_shadow(pc) {
    const L = LEAVES.shadow;
    const B = canopySheet(pc, SHADOWY, L, 800, {
      glint: 0.035,
      jag: 3.6,
      before(B, ox, v, id) {
        for (const [pts, w0, w1] of TWISTED[v]) gnarl(B, ox, pts, w0, w1, id);
        return id + 1;
      },
    });
    // Esporas que brillan
    for (let v = 0; v < 3; v++) {
      for (let i = 0; i < 5; i++) {
        const x = v * 72 + 8 + Math.floor(hash(i, 5, 820 + v) * 56);
        const y = 6 + Math.floor(hash(i, 6, 820 + v) * 40);
        if (B.tone[y * B.w + x] < 0) continue;
        pc.set(x, y, '#ffb8f4');
        if (B.tone[(y + 1) * B.w + x] >= 0) pc.set(x, y + 1, '#d070e0');
      }
    }
  },
  tree_top_pine(pc) {
    const L = LEAVES.pine;
    const B = toneBuf(pc);
    for (let v = 0; v < 3; v++) pineFrame(B, v * 72, v);
    castShadows(B);
    flush(B, pc, [L.ramp, BARK.ramp, SNOW]);
    outlineSheet(pc, L.line);
    for (let v = 0; v < 3; v++) trunkNeck(pc, v * 72);
  },
  tree_branch(pc) {
    // Rama que sale del costado del tronco (x = 0 queda pegado al tronco) con un racimo de hojas
    const B = toneBuf(pc);
    limb(B, 0, 10, 4, 9, 3, 2, 1, 0);
    limb(B, 4, 9, 7, 7, 2, 2, 1, 0);
    foliage(B, [[10, 9, 3.6], [7, 6, 3], [12, 5, 3]], 860, { id: 1, bright: 0.1, jag: 1.2 });
    castShadows(B);
    flush(B, pc, [LEAVES.forest.ramp, BARK.ramp]);
    pc.outline(LEAVES.forest.line);
    // la punta pegada al tronco no lleva contorno (se mete en la corteza)
    for (let y = 0; y < 16; y++) if (pc.get(0, y) === LEAVES.forest.line) pc.set(0, y, null);
  },
  // ---------- tronco, hojas y cactus ----------
  log(pc, v) {
    drawLog(pc, 0, 0, v);
    if (v === 2) {
      // nudo chico en la corteza
      stamp(pc, 7, 8, ['.lm.', 'lkdm', '.mn.'], { l: BARK.ramp[4], m: BARK.ramp[2], n: BARK.ramp[1], d: BARK.ramp[0], k: BARK.line });
    }
  },
  leaves(pc, v) {
    const L = LEAVES.forest;
    // Manojos de hojas como en las copas (la grilla se repite cada 16 px: encaja sin costuras)
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const s = 0.58 + leafBunch(x, y, 70 + v * 7, 4, 4) * 1.7 + (hash(x, y, 72 + v) - 0.5) * 0.08;
        pc.set(x, y, L.ramp[clamp(Math.floor(s * 6), 0, 5)]);
      }
    }
    for (let k = 0; k < 3; k++) {
      const x = 1 + Math.floor(hash(k, 1, 75 + v) * 13);
      const y = 1 + Math.floor(hash(k, 2, 75 + v) * 13);
      if (pc.get(x, y) === L.ramp[5]) pc.set(x, y, L.spark);
    }
  },
  cactus(pc) {
    // Tronco de cactus: costillas verticales con surcos, areolas y espinas a los costados
    const tones = [3, 4, 1, 4, 3, 1, 3, 2, 0, 1];
    const R = CACTUS.ramp;
    for (let y = 0; y < 16; y++) {
      pc.set(2, y, CACTUS.line);
      pc.set(13, y, CACTUS.line);
      for (let c = 0; c < 10; c++) pc.set(3 + c, y, R[tones[c]]);
    }
    // areolas sobre las costillas (período de 8 filas para que encaje al apilar)
    for (const [c, y0] of [[1, 1], [4, 5], [7, 3]]) {
      for (let y = y0; y < 16; y += 8) {
        pc.set(3 + c, y, '#e8e4b8');
        pc.set(3 + c, y + 1, R[1]);
      }
    }
    for (let y = 2; y < 16; y += 8) {
      pc.set(1, y, '#f2ecc8');
      pc.set(0, y - 1, '#c8c098');
      pc.set(14, y + 4, '#f2ecc8');
      pc.set(15, y + 3, '#c8c098');
    }
  },

  // ---------- plantas ----------
  plant_grass(pc, v) {
    // Mata de pasto: hojas curvas; las de atrás oscuras, las de adelante claras con la punta brillante
    const blades = v === 1 ? GRASS_TUFTS[1] : GRASS_TUFTS[0];
    grassBlades(pc, blades, v, 120, [G.k, G.d, G.m, G.l, G.h]);
    outlineOnGround(pc, G.o);
  },
  plant_flower_red(pc, v) {
    PIXEL._flower(pc, v, 'red');
  },
  plant_flower_yellow(pc, v) {
    PIXEL._flower(pc, v, 'yellow');
  },
  _flower(pc, v, kind) {
    const red = kind === 'red';
    const P = red
      ? { k: '#6e1030', d: '#a81c38', m: '#dc3a3c', l: '#ff6e52', h: '#ffb48a', Y: '#ffe07a', y: '#d89a2a' }
      : { k: '#9a5212', d: '#d8901c', m: '#f4c02c', l: '#ffe256', h: '#fff4b0', Y: '#9a5a26', y: '#5e3216' };
    const line = red ? '#3c0a1e' : '#4a2a0a';
    const x = 7 + (v === 1 ? 1 : v === 2 ? -1 : 0);
    const top = 3 + (v === 2 ? 2 : v === 1 ? 1 : 0);
    // tallo y hojas
    for (let y = top + 4; y <= 15; y++) pc.set(x, y, y > 12 ? G.d : G.m);
    stamp(pc, x - 4, 10 + (v === 2 ? 1 : 0), ['ll..', '.mdd'], { l: G.l, m: G.m, d: G.d });
    stamp(pc, x + 1, 12 - (v === 1 ? 1 : 0), ['..hl', 'mdd.'], { h: G.h, l: G.l, m: G.m, d: G.d });
    // flor (pétalos con luz arriba a la izquierda y centro)
    const head = red
      ? ['..hl...', '.hllmm.', 'hlmYmdd', 'lmYyYdk', '.mdYdk.', '..dkk..']
      : ['..h.l..', '.hlhlm.', 'hlYYydm', '.lYyydk', 'mlyydkd', '..m.k..'];
    stamp(pc, x - 3, top, head, P);
    pc.outline(line);
    recolor(pc, line, G.o, top + 6);
    outlineOnGround(pc, G.o);
  },
  plant_desert(pc) {
    // Arbusto seco: ramitas que se bifurcan (más claras hacia las puntas)
    const P = ['#5a3a1e', '#7a5230', '#9c7040', '#c09456', '#e6c286'];
    const twig = (x, y, ang, len, depth, k) => {
      const x1 = x + Math.cos(ang) * len;
      const y1 = y + Math.sin(ang) * len;
      pc.line(Math.round(x), Math.round(y), Math.round(x1), Math.round(y1), P[Math.min(3, 3 - depth + (Math.cos(ang) < 0 ? 1 : 0))]);
      if (depth === 0) {
        pc.set(Math.round(x1), Math.round(y1), P[4]);
        return;
      }
      const spread = 0.5 + hash(k, depth, 131) * 0.25;
      twig(x1, y1, ang - spread, len * 0.68, depth - 1, k * 2 + 1);
      twig(x1, y1, ang + spread, len * 0.62, depth - 1, k * 2 + 2);
    };
    twig(7.5, 15, -Math.PI / 2 - 0.55, 5, 2, 1);
    twig(8.5, 15, -Math.PI / 2 + 0.5, 5, 2, 2);
    twig(8, 15, -Math.PI / 2 - 0.05, 6, 2, 3);
    pc.rect(7, 14, 3, 2, P[0]);
    pc.set(7, 14, P[1]);
    outlineOnGround(pc, '#2e1a0c');
  },
  plant_desert2(pc, v) {
    // Cactus chiquito (con flor rosada en una variante)
    const R = CACTUS.ramp;
    const P = { k: R[0], d: R[1], m: R[2], n: R[3], l: R[4], h: R[5], s: '#f2ecc8', f: '#ff7aa8', F: '#ffd0e0', g: '#d04878' };
    const map = [
      '.......FF.......',
      '......fFfg......',
      '.....lhnmd......',
      '.....lhsmd......',
      '.l...lhnmd......',
      'lhn..shnmd......',
      'lhs..lhnmd..ln..',
      'lhnd.lhnmds.hnd.',
      '.lnmmlhnmd..lnd.',
      '..nmmlhsmd.lhmd.',
      '.....lhnmdmmnmd.',
      '.....lhnmdmmd...',
      '.....shnmd......',
      '.....lhnmd......',
      '.....lhnmk......',
      '....klhnmkk.....',
    ];
    if (v !== 2) {
      map[0] = '................';
      map[1] = '......lhd.......';
    }
    stamp(pc, 0, 0, map, P, v === 2);
    outlineOnGround(pc, CACTUS.line);
  },
  plant_snow(pc, v) {
    // Pasto helado: hojas azuladas con escarcha en la punta
    grassBlades(pc, v === 2 ? GRASS_TUFTS[1] : GRASS_TUFTS[0], v, 230, ['#2c5068', '#4a7890', '#79a8c0', '#a8d0e2', '#f0fbff']);
    outlineOnGround(pc, '#1c3448');
  },
  plant_snow2(pc, v) {
    // Abeto chiquito con nieve en cada capa
    const P = { k: '#0f322c', d: '#1d543b', m: '#286844', l: '#3f8452', s: SNOW[1], S: SNOW[2], w: SNOW[3], W: SNOW[4], b: BARK.ramp[2], B: BARK.ramp[0] };
    const map = [
      '.......W........',
      '......Wws.......',
      '.....lmWss......',
      '....WWwwSsk.....',
      '...lmmWWsdkk....',
      '..WWwwwwSSsk....',
      '..lmmmmWWsdkk...',
      '.WWwwwwwwwSSsk..',
      '.llmmmmmddddkk..',
      '..llmmmmdddkk...',
      '......bbB.......',
      '......bbB.......',
    ];
    stamp(pc, v === 2 ? 1 : 0, 4, map, P, v === 1);
    outlineOnGround(pc, '#0a201e');
  },
  plant_jungle(pc) {
    // Flor de selva gigante que brilla
    const P = { k: '#8a1450', d: '#c8286e', m: '#f04a90', l: '#ff86b8', h: '#ffd0e6', Y: '#fff2a0', y: '#ffc23c', g: G.d, G: G.m, L: G.l };
    const map = [
      '................',
      '.....lh..hl.....',
      '....lhhmmllm....',
      '..hl.lmYYmd.dm..',
      '.hllmmYyyYmmmd..',
      '.lmmdmYyyYdmdk..',
      '..dkd.mYYmd.k...',
      '....kdmddmdk....',
      '.....kd..kk.....',
      '.......g........',
      '.....LGg..GL....',
      '....LG.g.GGgg...',
      '...Gg..g..g.....',
      '.......g........',
      '.......g........',
      '.......g........',
    ];
    stamp(pc, 0, 0, map, P);
    pc.outline('#4a0a2c');
    recolor(pc, '#4a0a2c', G.o, 9);
    outlineOnGround(pc, G.o);
    halo(pc, ['rgba(255,110,180,0.22)', 'rgba(255,110,180,0.1)'], 7.5, 4.5, 7);
  },
  plant_jungle2(pc, v) {
    // Bulbos azules luminosos en tallos curvos
    const P = { k: '#1a4a8a', d: '#2e7ad0', m: '#4cb4f4', l: '#90e4ff', h: '#e8fcff', g: G.d, G: G.m, L: G.l };
    const map = [
      '................',
      '................',
      '..........kd....',
      '.........dmlm...',
      '...kd....dlhm...',
      '..dmlm...kmmd...',
      '..dlhm....kd....',
      '..kmmd.....g....',
      '...kd......g....',
      '....g.....G.....',
      '....g.....g.....',
      '....Gg...Lg.....',
      '.....g..LGg.....',
      '..LG.g...g......',
      '...Gg.g.g.......',
      '......g.g.......',
    ];
    stamp(pc, 0, 0, map, P, v === 2);
    pc.outline('#0c2a40');
    recolor(pc, '#0c2a40', G.o, 9);
    outlineOnGround(pc, G.o);
    const glow = ['rgba(110,210,255,0.24)', 'rgba(110,210,255,0.1)'];
    halo(pc, glow, v === 2 ? 11.5 : 3.5, 5.5, 4);
    halo(pc, glow, v === 2 ? 3.5 : 11.5, 3.5, 4);
  },
  plant_shadow(pc) {
    // Hongo sombrío: sombrero morado con manchas, láminas y pie pálido
    const P = { k: '#2a1048', d: '#4a1e7a', m: '#7232ae', l: '#9c5ad6', h: '#d4a4ff', s: '#f0d8ff', g: '#3a1a5a', p: '#b4a0c8', P: '#ddd0ea', q: '#7e6898' };
    const map = [
      '................',
      '................',
      '................',
      '.....hlll.......',
      '...hlsllmmm.....',
      '..hlllmmsmmd....',
      '.hlsllmmmmmdd...',
      '.llmmmmmmmddk...',
      '.kdmmmmmddddk...',
      '..kgggggggggk...',
      '.....PPq........',
      '.....PPq........',
      '.....Ppq........',
      '....PPpq........',
      '....PPpqq.......',
      '...qPppqq.......',
    ];
    stamp(pc, 1, 0, map, P);
    outlineOnGround(pc, '#1a0a2c');
    halo(pc, ['rgba(180,110,255,0.16)', 'rgba(180,110,255,0.07)'], 7.5, 6, 7);
  },
  plant_shadow2(pc) {
    // Planta espinosa con capullos que brillan
    const P = { k: '#22182e', d: '#3a2a4a', m: '#55406a', l: '#7a6290', b: '#c070ff', B: '#f0c8ff', t: '#8a3ac8' };
    pc.line(8, 15, 8, 4, P.m);
    pc.line(7, 15, 4, 6, P.d);
    pc.line(9, 15, 12, 7, P.d);
    pc.line(4, 6, 3, 4, P.m);
    pc.line(12, 7, 13, 5, P.m);
    for (const [x, y, dx] of [[8, 9, 1], [8, 6, -1], [6, 11, -1], [5, 8, -1], [10, 11, 1], [11, 9, 1]]) pc.set(x + dx, y - 1, P.l);
    for (const [x, y] of [[3, 3], [13, 4], [8, 3]]) {
      pc.set(x, y, P.b);
      pc.set(x, y - 1, P.B);
      pc.set(x + 1, y, P.t);
    }
    pc.set(8, 14, P.k);
    pc.set(8, 15, P.k);
    outlineOnGround(pc, '#120a1c');
    for (const [x, y] of [[3.5, 2.5], [13.5, 3.5], [8.5, 2.5]]) halo(pc, ['rgba(200,120,255,0.22)', 'rgba(200,120,255,0.08)'], x, y, 2.6);
  },
  plant_crystal(pc) {
    crystalCluster(pc, ['#5a1a78', '#a03cc0', '#e070e8', '#ff9cf8', '#ffd4ff', '#ffffff'], 'rgba(255,140,250,', 0);
  },
  plant_crystal2(pc) {
    crystalCluster(pc, ['#14406e', '#2482b4', '#40c4e0', '#80ecf4', '#c8fcff', '#ffffff'], 'rgba(110,230,255,', 1);
  },
  plant_crystal3(pc) {
    crystalCluster(pc, ['#6e3a10', '#b47818', '#e8b828', '#fce060', '#fff6b4', '#ffffff'], 'rgba(255,220,100,', 2);
  },
  plant_volcano(pc) {
    // Flor de fuego: pétalos en llamas sobre un tallo carbonizado
    const P = { k: '#7a1408', d: '#c02a0c', m: '#f05a14', l: '#ff9a2c', h: '#ffd860', w: '#fff6c0', s: '#3a2420', S: '#5a3a2c', a: '#8a5236' };
    const map = [
      '.......h........',
      '....l..hl..l....',
      '....hl.lml.h....',
      '...lhlmlmmlm....',
      '..lhmmwhwmmdm...',
      '..mlmhwwwhmdk...',
      '...mdmhwhmddk...',
      '....kdmmmddk....',
      '.....kkddkk.....',
      '.......Ss.......',
      '..aS...Ss..Sa...',
      '...aSS.Ss.Ss....',
      '......SSs.......',
      '.......Ss.......',
      '.......Ss.......',
      '.......Ss.......',
    ];
    stamp(pc, 0, 0, map, P);
    outlineOnGround(pc, '#2a0c06');
    halo(pc, ['rgba(255,150,40,0.24)', 'rgba(255,150,40,0.09)'], 7.5, 5, 7);
  },
  plant_volcano2(pc, v) {
    // Fumarola: roca de basalto con grietas de brasa y humo
    const P = { k: '#120c10', d: '#221a1e', m: '#352a2c', l: '#4c3e3c', h: '#6a5852', r: '#c83a10', o: '#ff8a24', y: '#ffd770', w: '#fff4c0' };
    const map = [
      '.......yo.......',
      '......lhyd......',
      '.....lhoodd.....',
      '....lhlrmmdk....',
      '...lhmmomrmdk...',
      '..lhmmdmyomddk..',
      '..lmmrommmmmdk..',
      '.lhmmdmmdrommdk.',
      '.lmrommdmmmmddk.',
      '.kmmmdmmmddmdkk.',
      'kkdddkdddkkddkkk',
    ];
    stamp(pc, 0, 5, map, P, v === 2);
    pc.outline('#0a0608');
    // humo
    pc.set(8, 3, 'rgba(120,110,110,0.55)');
    pc.set(9, 2, 'rgba(120,110,110,0.4)');
    pc.set(8, 1, 'rgba(120,110,110,0.25)');
    halo(pc, ['rgba(255,140,40,0.2)', 'rgba(255,140,40,0.08)'], 8, 6, 3.5);
  },
  mushroom_plant(pc) {
    // Hongo azul que brilla (también es el ícono del ítem)
    const P = { k: '#163084', d: '#2450c4', m: '#3c86f0', l: '#74b8ff', h: '#bfe6ff', s: '#f2fdff', g: '#0e2468', G: '#2a4a9a', p: '#a8c4ea', P: '#d8ecff', q: '#7898c8' };
    const map = [
      '................',
      '................',
      '.....hhll.......',
      '...hhsslmmm.....',
      '..hsshllmsmd....',
      '.hlhlllmmmmdd...',
      '.lllmmmsmmmddk..',
      '.lmmmmmmmmddddk.',
      '.kddmmmmmdddkkk.',
      '..kgGgGgGgGgk...',
      '......PPq.......',
      '......PPq.......',
      '......Ppq.......',
      '.....PPpq.......',
      '.....PPppq......',
      '....qPpppqq.....',
    ];
    stamp(pc, 0, 0, map, P);
    pc.outline('#0a1640');
    halo(pc, ['rgba(110,180,255,0.24)', 'rgba(110,180,255,0.1)'], 7, 5.5, 7.5);
  },
  mushroom_plant2(pc, v) {
    // Dos hongos chicos que brillan
    const P = { k: '#163084', d: '#2450c4', m: '#3c86f0', l: '#74b8ff', h: '#bfe6ff', s: '#f2fdff', g: '#0e2468', p: '#a8c4ea', P: '#d8ecff', q: '#7898c8' };
    const map = [
      '................',
      '................',
      '................',
      '................',
      '...hhll.........',
      '..hsllmd........',
      '.hlllmmdd.......',
      '.kddmmddk.......',
      '..kgggggk.......',
      '....Pq.....hll..',
      '....Pq....hsmmd.',
      '....Pq....kmmdk.',
      '....Pq.....kgk..',
      '...PPq......Pq..',
      '...Ppq......Pq..',
      '..qPpqq....qPpq.',
    ];
    stamp(pc, 0, 0, map, P, v === 2);
    pc.outline('#0a1640');
    halo(pc, ['rgba(110,180,255,0.22)', 'rgba(110,180,255,0.09)'], v === 2 ? 10.5 : 4.5, 6.5, 5.5);
  },
};
