// Arte mejorado: cielo, sol, luna, nubes, estrellas y paisajes de fondo (ver src/art/README.md).
// Los paisajes se pintan en celdas de 2 px sobre un búfer propio que da la vuelta en x:
// así cada capa se repite sin costuras. Luz de arriba a la izquierda; lo lejano se pierde en la bruma.
import { hash } from '../systems/PixelArt.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- colores
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Color empaquetado para Uint32Array (ABGR, little-endian)
const pack = (c, a = 255) => ((a << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
const toInt = (c) => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
// Rampa con cambio de matiz: k<0 va hacia la sombra fría del tema, k>0 hacia la luz cálida
const tone = (base, k, T) => (k < 0 ? mix(base, T.dark, -k) : mix(base, T.light, k));
const RAMP = [-0.58, -0.3, 0, 0.26, 0.52];
// Rampa de 5 tonos (oscuro → claro) empaquetada, opcionalmente perdida en la bruma
const ramp5 = (hex, T, haze = 0) => RAMP.map((k) => pack(mix(tone(rgb(hex), k, T), T.haze, haze)));
const lineOf = (hex, T, haze = 0) => pack(mix(tone(rgb(hex), -0.78, T), T.haze, haze));
const WHITE = [255, 255, 255];

// Trama ordenada 4×4 (fundidos en bandas, sin degradados lisos)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// Ruido de valores periódico: u en [0,1), cells celdas por vuelta
function pnoise(u, cells, seed) {
  const x = (((u % 1) + 1) % 1) * cells;
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = hash(i % cells, 0, seed);
  const b = hash((i + 1) % cells, 0, seed);
  return a + (b - a) * s;
}
// Crestas afiladas (Λ) a partir del ruido
const ridged = (u, cells, seed) => 1 - Math.abs(pnoise(u, cells, seed) * 2 - 1);

// Búfer de píxeles a media resolución que da la vuelta en x
class Buf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }

  set(x, y, c) {
    if (y < 0 || y >= this.h) return;
    x %= this.w;
    if (x < 0) x += this.w;
    this.d[y * this.w + x] = c;
  }

  get(x, y) {
    if (y < 0 || y >= this.h) return 0;
    x %= this.w;
    if (x < 0) x += this.w;
    return this.d[y * this.w + x];
  }

  vline(x, y0, y1, c) {
    for (let y = y0; y <= y1; y++) this.set(x, y, c);
  }

  blit(ctx) {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.d.buffer), this.w, this.h), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, this.w * 2, this.h * 2);
  }
}

/**
 * Forma redonda hecha de varios óvalos [cx, cy, rx, ry], sombreada bulto por bulto con luz de arriba a la
 * izquierda. pal = 5 tonos (oscuro → claro); line = contorno; leaf = textura de hojas en grupitos.
 */
function blob(b, ovals, pal, line, seed = 0, leaf = true) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [cx, cy, rx, ry = rx] of ovals) {
    x0 = Math.min(x0, Math.floor(cx - rx) - 1);
    x1 = Math.max(x1, Math.ceil(cx + rx) + 1);
    y0 = Math.min(y0, Math.floor(cy - ry) - 1);
    y1 = Math.max(y1, Math.ceil(cy + ry) + 1);
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const mask = new Uint8Array(bw * bh);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let best = 0;
      let nx = 0;
      let ny = 0;
      for (const [cx, cy, rx, ry = rx] of ovals) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const q = 1 - dx * dx - dy * dy;
        if (q > best) {
          best = q;
          nx = dx;
          ny = dy;
        }
      }
      if (best <= 0) continue;
      mask[(y - y0) * bw + (x - x0)] = 1;
      let l = -(nx * 0.62 + ny * 0.78);
      if (leaf) {
        // Grupitos de hojas (bloques de 2×2), no ruido suelto
        const hb = hash(x >> 1, y >> 1, seed);
        if (hb < 0.18) l -= 0.3;
        else if (hb > 0.86) l += 0.22;
      }
      const t = l > 0.62 ? 4 : l > 0.25 ? 3 : l > -0.12 ? 2 : l > -0.5 ? 1 : 0;
      b.set(x, y, pal[t]);
    }
  }
  if (!line) return;
  const m = (i, j) => i >= 0 && j >= 0 && i < bw && j < bh && mask[j * bw + i];
  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      if (mask[j * bw + i]) continue;
      if (m(i - 1, j) || m(i + 1, j) || m(i, j - 1) || m(i, j + 1)) b.set(x0 + i, y0 + j, line);
    }
  }
}

// ---------------------------------------------------------------- temas
/**
 * Paleta y formas de cada zona. dark/light = hacia dónde van sombras (frías) y luces (cálidas);
 * haze = color de la bruma lejana. m = montañas, h = colinas, f = capa cercana.
 * Los rellenos (fill / ground) son el color exacto de la última fila de cada capa.
 */
const THEME = {
  forest: {
    dark: '#1e2c6a', light: '#fff3d4', haze: '#bcd6ee',
    m: { rock: '#6d86b8', snow: '#f4f8ff', snowLine: 0.6, fill: '#9fb8dc', shape: 'alpine', seed: 11 },
    h: { base: '#4f9c4c', top: '#97da6e', fill: '#4a8c4a', prop: 'tree', leaf: '#3a8a40', trunk: '#5a3d26', props: 30, seed: 200 },
    f: { kind: 'trees', ground: '#21482a', lip: '#4d9a3c', leaf: '#2c6c36', trunk: '#4a3322' },
  },
  desert: {
    dark: '#5a2858', light: '#fff6cc', haze: '#f4dcb4',
    m: { rock: '#c98c5c', fill: '#e2bc8c', shape: 'mesa', seed: 21, strata: true },
    h: { base: '#e2b46c', top: '#fbe6a8', fill: '#d6a462', prop: 'cactus', leaf: '#5f8c3e', props: 16, seed: 207 },
    f: { kind: 'dunes', ground: '#b9824a', lip: '#e4b86c', leaf: '#4c7a34' },
  },
  snow: {
    dark: '#2a3a7c', light: '#ffffff', haze: '#dde8f6',
    m: { rock: '#8aa0c6', snow: '#f6f9ff', snowLine: 0.36, fill: '#c6d6ec', shape: 'alpine', seed: 31 },
    h: { base: '#d4e2f2', top: '#ffffff', fill: '#bfd0e6', prop: 'pine', leaf: '#2e6658', trunk: '#4a3522', props: 34, seed: 214 },
    f: { kind: 'pines', ground: '#d3e0f0', lip: '#f6faff', leaf: '#235244', trunk: '#3b2a1a' },
  },
  jungle: {
    dark: '#0c3440', light: '#f6ffd2', haze: '#bfe6cf',
    m: { rock: '#4b8f7c', fill: '#86c0a8', shape: 'karst', seed: 41 },
    h: { base: '#2e9440', top: '#82e062', fill: '#25793a', prop: 'jtree', leaf: '#2a8c38', trunk: '#4a3420', props: 26, seed: 221 },
    f: { kind: 'jungle', ground: '#143c1e', lip: '#3f8c2e', leaf: '#237a30', trunk: '#4a3420', vine: '#4fae3e' },
  },
  shadow: {
    dark: '#12082c', light: '#f2dcff', haze: '#9e8ac4',
    m: { rock: '#5d4a88', snow: '#bfa6ee', snowLine: 0.66, fill: '#75629c', shape: 'jagged', seed: 51 },
    h: { base: '#4a3872', top: '#b07ce8', fill: '#3a2a5a', prop: 'deadtree', leaf: '#8a50cc', trunk: '#2a1e3c', props: 18, seed: 228, glow: '#e0a8ff' },
    f: { kind: 'twisted', ground: '#20143a', lip: '#5a3a8a', leaf: '#6a3fa0', trunk: '#241834', glow: '#f0b8ff' },
  },
  crystal: {
    dark: '#36288a', light: '#fffaff', haze: '#f2d6f6',
    m: { rock: '#c294dc', snow: '#ffffff', snowLine: 0.58, fill: '#dcbcea', shape: 'spiky', seed: 61, glints: true },
    h: { base: '#74bed2', top: '#c8fff6', fill: '#62a6c0', prop: 'shard', props: 22, seed: 235, colors: ['#f0a8ff', '#9cecff', '#ffe68a'] },
    f: { kind: 'spires', ground: '#2f4166', lip: '#6a86c0', crystals: ['#ff9ee8', '#8ef0ff', '#ffe68a', '#c49aff'] },
  },
  volcano: {
    dark: '#180818', light: '#ffc89a', haze: '#c4806a',
    m: { rock: '#5e4646', fill: '#7a5450', shape: 'volcano', seed: 71, lava: true },
    h: { base: '#463636', top: '#8a6e66', fill: '#2e2222', prop: 'deadtree', leaf: '#1e1616', trunk: '#1e1616', props: 12, seed: 242, glow: '#ff9a30' },
    f: { kind: 'ashland', ground: '#1a1212', lip: '#3a2a26', trunk: '#140e0e', lava: ['#fff0a0', '#ffc040', '#ff7a20', '#c83a10'] },
  },
};
const themeOf = (asset) => {
  const T = THEME[asset?.theme || 'forest'] || THEME.forest;
  if (!T.ready) {
    // Colores numéricos una sola vez
    T.dark = rgb(T.dark);
    T.light = rgb(T.light);
    T.haze = rgb(T.haze);
    T.ready = true;
  }
  return T;
};

// ---------------------------------------------------------------- formas (u en [0,1) → 0..1 del alto)
const SHAPES = {
  alpine: (s) => (u) => 0.3 + 0.36 * ridged(u, 5, s) + 0.16 * ridged(u, 13, s + 1) + 0.05 * pnoise(u, 41, s + 2),
  mesa: (s) => (u) => {
    // Mesetas: cerros de cima plana con escalones
    const m = 0.24 + 0.4 * pnoise(u, 6, s) + 0.08 * pnoise(u, 19, s + 1);
    const cap = 0.44 + (0.12 * Math.round(pnoise(u, 4, s + 2) * 2)) / 2;
    return Math.min(m, cap) + 0.012 * pnoise(u, 60, s + 3);
  },
  karst: (s) => (u) => {
    // Cerros altos y redondeados (torres de piedra caliza)
    const p = pnoise(u, 14, s);
    return 0.26 + 0.42 * p * p * (3 - 2 * p) + 0.12 * pnoise(u, 5, s + 1) + 0.03 * pnoise(u, 47, s + 2);
  },
  jagged: (s) => (u) => 0.28 + 0.34 * ridged(u, 6, s) + 0.18 * Math.pow(ridged(u, 15, s + 1), 3) + 0.02 * ridged(u, 43, s + 2),
  spiky: (s) => (u) => 0.2 + 0.5 * Math.pow(Math.abs(Math.sin(TAU * 3 * u + 0.4)), 4) + 0.16 * Math.pow(ridged(u, 17, s), 2) + 0.05 * ridged(u, 53, s + 1),
  volcano: (s) => (u) => {
    // Conos con el cráter hundido
    const c = Math.max(0, 1 - Math.abs(((u * 3) % 1) - 0.5) * 2.3);
    return 0.16 + 0.6 * c - (c > 0.9 ? (c - 0.9) * 1.8 : 0) + 0.05 * pnoise(u, 37, s) + 0.04 * ridged(u, 11, s + 1);
  },
};
const BACK_SHAPE = {
  alpine: (s) => (u) => 0.42 + 0.34 * ridged(u, 4, s + 50) + 0.1 * ridged(u, 11, s + 51),
  mesa: (s) => (u) => Math.min(0.36 + 0.3 * pnoise(u, 5, s + 50), 0.55),
  karst: (s) => (u) => 0.4 + 0.3 * pnoise(u, 10, s + 50) + 0.08 * pnoise(u, 31, s + 51),
  jagged: (s) => (u) => 0.4 + 0.32 * ridged(u, 5, s + 50) + 0.08 * ridged(u, 23, s + 51),
  spiky: (s) => (u) => 0.36 + 0.36 * Math.pow(ridged(u, 7, s + 50), 3),
  volcano: (s) => (u) => 0.3 + 0.18 * pnoise(u, 6, s + 50) + 0.05 * ridged(u, 19, s + 51),
};

const heights = (cols, rows, hf) => {
  const top = new Int16Array(cols);
  for (let x = 0; x < cols; x++) top[x] = Math.round(rows - hf(x / cols) * rows);
  return top;
};

/**
 * Una cordillera: caras al sol (pendiente que sube hacia la derecha) claras, caras opuestas en sombra.
 * La línea entre ambas baja en diagonal desde cada pico; cárcavas, nieve en las cumbres y bruma abajo.
 */
function paintRange(b, T, top, o) {
  const { w: cols, h: rows } = b;
  const rock = rgb(o.rock);
  const tones = RAMP.map((k) => tone(rock, k, T));
  if (o.snow) {
    const sn = rgb(o.snow);
    tones.push(tone(sn, -0.46, T), tone(sn, -0.2, T), sn);
  }
  const fill = rgb(o.fill);
  const LV = 9; // niveles de bruma; el último es exactamente el relleno
  const pal = tones.map((c) => {
    const hz = mix(c, T.haze, o.haze);
    return Array.from({ length: LV }, (_, l) => pack(mix(hz, fill, Math.pow(l / (LV - 1), 1.3))));
  });
  const H = (x) => rows - top[((x % cols) + cols) % cols];
  // Ondulación de la línea de sombra por fila; cárcavas y línea de nieve por columna
  const wob = new Int8Array(rows);
  for (let y = 0; y < rows; y++) wob[y] = Math.round((pnoise(y / rows, 10, o.seed + 3) - 0.5) * 4);
  const gully = new Uint8Array(cols);
  const snowRow = new Float32Array(cols);
  for (let x = 0; x < cols; x++) {
    gully[x] = pnoise(x / cols, o.gullies || 70, o.seed + 7) > 0.72 ? 1 : 0;
    snowRow[x] = rows * (1 - (o.snowLine || 0)) + (pnoise(x / cols, 52, o.seed + 9) - 0.5) * 10;
  }
  const fadeFrom = rows * o.fadeFrom;
  for (let x = 0; x < cols; x++) {
    for (let y = Math.max(0, top[x]); y < rows; y++) {
      const d = y - top[x];
      let xs = x - Math.round(d * o.slant) + wob[y];
      xs = ((xs % cols) + cols) % cols;
      const slope = H(xs + 2) - H(xs - 2);
      let t = slope >= 5 ? 4 : slope >= 1 ? 3 : slope > -1 ? 2 : slope > -5 ? 1 : 0;
      if (t === 4 && d > 22) t = 3;
      if (d === 0 && slope > 0) t = 4; // borde de la cresta iluminado
      if (d > 2 && d < 40 && gully[xs] && t > 0) t--; // cárcavas que bajan siguiendo la pendiente
      if (d > 26 + bayer(x, y) * 24 && t !== 2) t += t < 2 ? 1 : -1; // abajo, menos contraste
      if (o.strata && t >= 2 && (y + Math.round(pnoise(x / cols, 9, o.seed + 5) * 3)) % 7 === 0) t--;
      let idx = t;
      if (o.snow && y < snowRow[x] + (gully[xs] ? 6 : 0)) idx = 5 + (t >= 3 ? 2 : t === 2 ? 1 : 0);
      const f = (y - fadeFrom) / (rows - 4 - fadeFrom);
      const lv = f <= 0 ? 0 : Math.min(LV - 1, Math.floor(f * (LV - 1) + bayer(x, y)));
      b.d[y * cols + x] = pal[idx][lv];
    }
  }
}

// Volcanes: lava en el cráter, ríos que bajan y columnas de humo
function volcanoExtras(b, T, top, o) {
  const { w: cols } = b;
  const lava = ['#fff0a0', '#ffc040', '#ff7a20', '#c83a10'].map((c) => pack(rgb(c)));
  const smoke = [pack(mix(rgb('#5a4644'), T.haze, 0.3), 170), pack(mix(rgb('#7c6662'), T.haze, 0.35), 140), pack(mix(rgb('#a08a86'), T.haze, 0.4), 110)];
  const topAt = (x) => top[((x % cols) + cols) % cols];
  for (let k = 0; k < 3; k++) {
    const px = Math.round(((k + 0.5) / 3) * cols);
    let best = px;
    for (let x = px - 10; x <= px + 10; x++) if (topAt(x) < topAt(best)) best = x;
    const ty = topAt(best);
    // Cráter: lava que brilla en el hueco
    for (let x = best - 7; x <= best + 7; x++) {
      const yt = topAt(x);
      for (let y = yt; y < yt + 3; y++) b.set(x, y, lava[Math.min(3, y - yt + (Math.abs(x - best) > 4 ? 1 : 0))]);
    }
    // Ríos de lava que bajan serpenteando
    for (let r = 0; r < 3; r++) {
      let x = best - 5 + r * 5;
      const len = 18 + Math.floor(hash(k, r, o.seed + 20) * 26);
      for (let y = ty + 2; y < ty + len; y++) {
        if (hash(k * 7 + r, y, o.seed + 21) < 0.3) x += r === 0 ? -1 : r === 2 ? 1 : hash(k, y, o.seed) < 0.5 ? -1 : 1;
        if (y < topAt(x)) continue;
        const fade = (y - ty) / len;
        b.set(x, y, lava[fade < 0.3 ? 1 : fade < 0.7 ? 2 : 3]);
        if (fade < 0.5) b.set(x + 1, y, lava[3]);
      }
    }
    // Humo que se inclina con el viento
    for (let s = 0; s < 9; s++) {
      const cy = ty - 4 - s * 5;
      if (cy < 3) break;
      const cx = best + s * s * 0.35 + s;
      const r = 3 + s * 0.7;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x++) {
          const dx = (x - cx) / (r * 1.3);
          const dy = (y - cy) / r;
          if (dx * dx + dy * dy > 1 || b.get(x, y)) continue;
          const lit = -(dx * 0.6 + dy * 0.8);
          b.set(x, y, smoke[lit > 0.3 ? 2 : lit > -0.3 ? 1 : 0]);
        }
      }
    }
  }
}

// Cristales: destellos sobre las caras
function glints(b, top, seed) {
  const white = pack(WHITE);
  const soft = pack([255, 236, 255]);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, seed) * b.w);
    const y = top[x] + 3 + Math.floor(hash(i, 2, seed) * 30);
    if (!b.get(x, y)) continue;
    b.set(x, y, white);
    if (i % 3 === 0) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.set(x + dx, y + dy, soft);
  }
}

// ---------------------------------------------------------------- adornos de las colinas (en píxeles lógicos)
const PROPS = {
  tree(b, x, g, s, P, i) {
    // Bosquecitos de 2 a 4 árboles
    const n = 2 + (i % 3);
    for (let k = 0; k < n; k++) {
      const tx = x + k * (3 + s) - n * 2;
      const r = s + (hash(i, k, 301) < 0.5 ? 0 : 1);
      const th = 2 + Math.floor(hash(i, k, 302) * 3);
      b.vline(tx, g - th, g, P.trunk);
      blob(b, [[tx + 0.5, g - th - r + 1, r + 0.4, r]], P.leaf, P.line, i * 9 + k, false);
    }
  },
  jtree(b, x, g, s, P, i) {
    const th = 4 + Math.floor(hash(i, 1, 303) * 5);
    b.vline(x, g - th, g, P.trunk);
    blob(b, [[x + 0.5, g - th - 1, s + 2.5, s * 0.7 + 0.6], [x - 2, g - th + 0.5, s, s * 0.6]], P.leaf, P.line, i, false);
  },
  pine(b, x, g, s, P) {
    const hgt = s * 3 + 3;
    b.vline(x, g - 2, g, P.trunk);
    for (let dy = 0; dy < hgt; dy++) {
      const half = Math.floor(((dy + 1) / hgt) * (s + 0.6));
      for (let dx = -half; dx <= half; dx++) {
        const edge = dx === -half || dx === half || dy === hgt - 1;
        const c = edge ? P.line : dy % 3 === 0 && dx < 0 ? P.snow : dx <= 0 ? P.leaf[3] : P.leaf[1];
        b.set(x + dx, g - 2 - hgt + dy, c);
      }
    }
    b.set(x, g - 3 - hgt, P.line);
    b.set(x, g - 2 - hgt, P.snow);
  },
  cactus(b, x, g, s, P, i) {
    const hgt = s + 4;
    const body = (bx, y0, y1) => {
      for (let y = y0; y <= y1; y++) {
        b.set(bx - 1, y, P.line);
        b.set(bx, y, P.leaf[3]);
        b.set(bx + 1, y, P.leaf[1]);
        b.set(bx + 2, y, P.line);
      }
      b.set(bx, y0 - 1, P.line);
      b.set(bx + 1, y0 - 1, P.line);
    };
    body(x, g - hgt, g);
    if (i % 2 === 0) {
      body(x - 3, g - hgt + 2, g - hgt + 4);
      b.set(x - 2, g - hgt + 5, P.leaf[1]);
      b.set(x - 1, g - hgt + 5, P.leaf[1]);
    } else {
      body(x + 3, g - hgt + 1, g - hgt + 3);
      b.set(x + 2, g - hgt + 4, P.leaf[1]);
    }
  },
  deadtree(b, x, g, s, P) {
    const hgt = s * 2 + 2;
    b.vline(x, g - hgt, g, P.trunk);
    for (let k = 1; k <= s; k++) {
      b.set(x - k, g - hgt + 3 - k, P.trunk);
      b.set(x + k, g - hgt + 5 - k, P.trunk);
    }
    if (P.glow) {
      b.set(x - s - 1, g - hgt + 2 - s, P.glow);
      b.set(x + s + 1, g - hgt + 4 - s, P.glow);
    }
  },
  shard(b, x, g, s, P, i) {
    const hgt = s * 2 + 3;
    const pal = P.shards[i % P.shards.length];
    for (let dy = 0; dy < hgt; dy++) {
      const half = Math.min(1 + (s > 3 ? 1 : 0), Math.floor(dy / 2));
      for (let dx = -half - 1; dx <= half + 1; dx++) {
        const edge = dx === -half - 1 || dx === half + 1;
        b.set(x + dx, g - hgt + dy, edge ? pal.line : dx < 0 ? pal.c[4] : dx === 0 ? pal.c[3] : pal.c[1]);
      }
    }
    b.set(x, g - hgt - 1, pal.line);
    b.set(x - 1, g - hgt + 3, pack(WHITE));
  },
};

/** Colinas redondeadas con el borde de pasto iluminado; abajo se funden con el relleno. */
function paintHills(b, T, top, o) {
  const { w: cols, h: rows } = b;
  const base = rgb(o.base);
  const tones = RAMP.map((k) => tone(base, k, T));
  const lip = rgb(o.top);
  tones.push(lip, tone(lip, -0.3, T));
  const fill = rgb(o.fill);
  const LV = 9; // pasos chicos: la trama del fundido casi no se nota
  const pal = tones.map((c) => {
    const hz = mix(c, T.haze, o.haze);
    return Array.from({ length: LV }, (_, l) => pack(mix(hz, fill, Math.pow(l / (LV - 1), 1.2))));
  });
  const H = (x) => rows - top[((x % cols) + cols) % cols];
  const fadeFrom = rows * o.fadeFrom;
  for (let x = 0; x < cols; x++) {
    const lipD = 1 + (hash(x, 0, o.seed + 1) < 0.3 ? 1 : 0);
    const lipC = H(x + 1) - H(x - 1) >= -1 ? 5 : 6;
    // Pendiente de la superficie: la ladera que mira a la luz tiene una franja clara bajo el pasto
    const slope = Math.max(-1, Math.min(1, (H(x + 3) - H(x - 3)) / 3));
    for (let y = Math.max(0, top[x]); y < rows; y++) {
      const d = y - top[x];
      const val = 0.56 + 0.4 * slope * Math.max(0, 1 - d / 16) - d * 0.008;
      let t = Math.max(0, Math.min(4, Math.floor(val * 4 + (bayer(x, y) - 0.5) * 0.25 + 0.5)));
      // Matas sueltas: grupitos de 2×2 un tono más oscuro
      if (d > 3 && d < 30 && hash(x >> 1, y >> 1, o.seed) < 0.018) t = Math.max(0, t - 1);
      const idx = d <= lipD ? lipC : t;
      const f = (y - fadeFrom) / (rows - 3 - fadeFrom);
      const lv = f <= 0 ? 0 : Math.min(LV - 1, Math.floor(f * (LV - 1) + bayer(x, y)));
      b.d[y * cols + x] = pal[idx][lv];
    }
  }
}

// ---------------------------------------------------------------- capa cercana (por zona)
const leafPal = (hex, T, haze) => ({ leaf: ramp5(hex, T, haze), line: lineOf(hex, T, haze) });
const trunkPal = (hex, T, haze) => {
  const r = ramp5(hex, T, haze);
  return { dark: r[0], mid: r[2], light: r[3], line: lineOf(hex, T, haze) };
};
// Tronco con borde iluminado a la izquierda, contorno y raíces
function trunk(b, x, y0, g, P, wide = false) {
  const right = wide ? 2 : 1;
  for (let y = y0; y <= g; y++) {
    const root = y >= g - 1 ? 1 : 0;
    b.set(x - 2 - root, y, P.line);
    b.set(x - 1 - root, y, P.light);
    for (let k = -root; k < right + root; k++) b.set(x + k, y, k > 0 ? P.dark : P.mid);
    b.set(x + right + root, y, P.dark);
    b.set(x + right + 1 + root, y, P.line);
  }
}

const FRONTS = {
  trees(b, T, g, f, haze, row) {
    const n = row ? 30 : 22;
    const L = leafPal(f.leaf, T, haze);
    const W = trunkPal(f.trunk, T, haze);
    const s = 300 + row * 50;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + hash(i, 1, s) * 0.7) / n) * b.w);
      const hgt = (row ? 14 : 22) + Math.floor(hash(i, 2, s) * (row ? 18 : 28));
      const r = (row ? 5 : 7) + Math.floor(hash(i, 3, s) * 4);
      const cy = g - hgt;
      trunk(b, x, cy, g, W);
      // Rama con un manojo de hojas
      if (!row && hash(i, 4, s) < 0.6) {
        const dir = hash(i, 5, s) < 0.5 ? -1 : 1;
        const by = cy + r + 3 + Math.floor(hash(i, 6, s) * 6);
        for (let k = 1; k <= 4; k++) b.set(x + dir * (k + 1), by - (k >> 1), W.mid);
        blob(b, [[x + dir * 6.5, by - 3, 2.6, 2.2]], L.leaf, L.line, i * 3 + 1);
      }
      const ov = [[x + 0.5, cy, r, r * 0.9]];
      const parts = 3 + (i % 3);
      for (let k = 0; k < parts; k++) {
        const a = (k / parts) * TAU + hash(i, 10 + k, s);
        ov.push([x + 0.5 + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.55 + 1, r * (0.5 + hash(i, 20 + k, s) * 0.2), r * 0.5]);
      }
      blob(b, ov, L.leaf, L.line, i + row * 100);
    }
    if (row) return;
    // Arbustos al pie de los árboles
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(hash(i, 1, 305) * b.w);
      const r = 2.5 + hash(i, 2, 305) * 2.5;
      blob(b, [[x, g - r * 0.5, r * 1.3, r * 0.8], [x + r, g - r * 0.3, r * 0.8, r * 0.6]], L.leaf, L.line, i + 700);
    }
  },
  dunes(b, T, g, f, haze, row) {
    const sand = rgb(f.lip);
    const P = RAMP.map((k) => pack(mix(tone(sand, k, T), T.haze, haze)));
    const cols = b.w;
    if (row) {
      // Pirámide lejana con sus hiladas de bloques
      const px = Math.floor(cols * 0.62);
      const ph = 34;
      for (let k = 0; k < ph; k++) {
        const y = g - 8 - k;
        const half = ph - k;
        for (let dx = -half; dx <= half; dx++) {
          let t = dx < 0 ? 3 : 1;
          if (k % 3 === 0) t--;
          if (dx === -half || k === ph - 1) t = 4;
          b.set(px + dx, y, P[t]);
        }
      }
    }
    // Dunas con cresta marcada: ladera al sol clara, ladera opuesta en sombra
    const seed = 400 + row * 9;
    const dh = (u) => (row ? 12 : 7) + (row ? 7 : 5) * pnoise(u, row ? 5 : 7, seed) + 3 * ridged(u, row ? 11 : 13, seed + 1);
    for (let x = 0; x < cols; x++) {
      const top = Math.round(g - dh(x / cols));
      const slope = dh((x + 1) / cols) - dh((x - 1) / cols);
      for (let y = top; y <= g + 2; y++) {
        const d = y - top;
        const xs = (x - Math.round(d * 1.4)) / cols;
        const sl = dh(xs + 1 / cols) - dh(xs - 1 / cols);
        let t = sl > 0.3 ? 3 : sl > -0.3 ? 2 : 1;
        if (d === 0) t = slope > 0 ? 4 : 2;
        // Ondas del viento en la arena
        if (d > 2 && (y + Math.round(x * 0.35 + pnoise(x / cols, 30, seed + 2) * 4)) % 5 === 0) t = Math.max(0, t - 1);
        b.set(x, y, P[t]);
      }
    }
    if (row) return;
    // Saguaros
    const L = leafPal(f.leaf, T, haze);
    const line = L.line;
    const body = (bx, y0, y1) => {
      for (let y = y0; y <= y1; y++) {
        b.set(bx - 1, y, line);
        b.set(bx, y, L.leaf[4]);
        b.set(bx + 1, y, (y + bx) % 3 === 0 ? L.leaf[2] : L.leaf[3]);
        b.set(bx + 2, y, L.leaf[1]);
        b.set(bx + 3, y, line);
      }
      for (let k = 0; k < 3; k++) b.set(bx + k, y0 - 1, line);
    };
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(((i + hash(i, 1, 411)) / 9) * cols);
      const hgt = 12 + Math.floor(hash(i, 2, 411) * 12);
      const base = Math.round(g - dh(x / cols)) + 2;
      body(x, base - hgt, base);
      const ay = base - hgt + 4 + Math.floor(hash(i, 3, 411) * 4);
      body(x - 4, ay - 6, ay);
      for (let k = -4; k <= -1; k++) {
        b.set(x + k, ay + 1, L.leaf[2]);
        b.set(x + k, ay + 2, line);
      }
      if (i % 2) {
        body(x + 5, ay - 3, ay + 3);
        for (let k = 3; k <= 5; k++) {
          b.set(x + k, ay + 4, L.leaf[2]);
          b.set(x + k, ay + 5, line);
        }
      }
    }
  },
  pines(b, T, g, f, haze, row) {
    const n = row ? 34 : 24;
    const L = leafPal(f.leaf, T, haze);
    const snow = [pack(mix(tone(rgb('#f6faff'), -0.3, T), T.haze, haze)), pack(mix(WHITE, T.haze, haze))];
    const W = trunkPal(f.trunk, T, haze);
    const s = 420 + row * 9;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + hash(i, 1, s) * 0.8) / n) * b.w);
      const hgt = (row ? 22 : 30) + Math.floor(hash(i, 2, s) * (row ? 16 : 26));
      const r = (row ? 5 : 7) + Math.floor(hash(i, 3, s) * 3);
      trunk(b, x, g - 6, g, W);
      // Pisos de ramas, cada uno con nieve encima
      const tiers = Math.max(3, Math.round(hgt / 7));
      for (let k = 0; k < tiers; k++) {
        const ty = g - 5 - Math.round(((k + 1) / tiers) * (hgt - 4));
        const tb = g - 4 - Math.round((k / tiers) * (hgt - 4));
        const wB = Math.round(r * (1 - (k / tiers) * 0.7));
        for (let y = ty; y <= tb; y++) {
          const p = (y - ty) / Math.max(1, tb - ty);
          const half = Math.max(1, Math.round(wB * (0.25 + 0.75 * p)));
          for (let dx = -half; dx <= half; dx++) {
            let c = dx < -half / 3 ? L.leaf[3] : dx < half / 3 ? L.leaf[2] : L.leaf[1];
            if (y === tb && hash(x + dx, y, s) < 0.5) c = L.leaf[0];
            if (dx === -half || dx === half || y === tb) c = L.line;
            if (y - ty <= 1 + (dx < 0 ? 1 : 0) && (dx < half - 1 || y === ty)) c = dx < 1 ? snow[1] : snow[0];
            b.set(x + dx, y, c);
          }
        }
      }
      b.set(x, g - 3 - hgt, L.line);
      b.set(x, g - 2 - hgt, snow[1]);
    }
  },
  jungle(b, T, g, f, haze, row) {
    const n = row ? 22 : 16;
    const L = leafPal(f.leaf, T, haze);
    const W = trunkPal(f.trunk, T, haze);
    const vine = ramp5(f.vine, T, haze);
    const s = 430 + row * 9;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + hash(i, 1, s) * 0.7) / n) * b.w);
      const hgt = (row ? 34 : 44) + Math.floor(hash(i, 2, s) * (row ? 24 : 34));
      const r = (row ? 8 : 10) + Math.floor(hash(i, 3, s) * 5);
      const cy = g - hgt;
      trunk(b, x, cy, g, W, true);
      // Copa ancha y aplanada en varios pisos
      blob(b, [[x + 1, cy, r * 1.25, r * 0.5], [x - r * 0.6, cy + 2, r * 0.7, r * 0.42], [x + r * 0.8, cy + 1.5, r * 0.7, r * 0.42], [x + 1, cy - r * 0.35, r * 0.75, r * 0.4]], L.leaf, L.line, i + row * 50);
      // Lianas con hojitas
      for (let k = 0; k < 3; k++) {
        let xx = x - r + 2 + Math.floor(hash(i, 10 + k, s) * (r * 2 - 2));
        const len = 8 + Math.floor(hash(i, 20 + k, s) * 22);
        for (let y = cy + 3; y < cy + 3 + len && y < g; y++) {
          if ((y + k) % 6 === 0) xx += hash(i, y, s) < 0.5 ? -1 : 1;
          b.set(xx, y, vine[1]);
          if ((y + i) % 4 === 0) b.set(xx - 1, y, vine[3]);
        }
      }
    }
    if (row) return;
    // Helechos al pie
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(((i + hash(i, 1, 431)) / 46) * b.w);
      const hh = 3 + Math.floor(hash(i, 2, 431) * 4);
      for (let k = -hh; k <= hh; k++) {
        const y = g - hh + Math.round((k * k) / hh);
        b.set(x + k, y, k < 0 ? L.leaf[3] : L.leaf[1]);
        b.set(x + k, y - 1, k < 0 ? L.leaf[4] : L.leaf[2]);
      }
      b.vline(x, g - hh, g, L.leaf[1]);
    }
  },
  twisted(b, T, g, f, haze, row) {
    const n = row ? 22 : 16;
    const W = trunkPal(f.trunk, T, haze);
    const L = leafPal(f.leaf, T, haze);
    const s = 440 + row * 9;
    for (let i = 0; i < n; i++) {
      const x0 = Math.floor(((i + hash(i, 1, s) * 0.8) / n) * b.w);
      const hgt = (row ? 18 : 26) + Math.floor(hash(i, 2, s) * (row ? 16 : 24));
      // Tronco torcido que se afina
      let x = x0;
      for (let dy = 0; dy < hgt; dy++) {
        if (dy % 5 === 4) x += hash(i, dy, s + 1) < 0.5 ? -1 : 1;
        const wdt = dy < hgt * 0.4 ? 2 : dy < hgt * 0.8 ? 1 : 0;
        const y = g - dy;
        b.set(x - wdt - 1, y, W.line);
        for (let k = -wdt; k <= wdt; k++) b.set(x + k, y, k < 0 ? W.light : k === 0 ? W.mid : W.dark);
        b.set(x + wdt + 1, y, W.line);
      }
      // Ramas en zigzag con una copa violeta
      const top = g - hgt;
      for (let k = 0; k < 3; k++) {
        const dir = k % 2 ? 1 : -1;
        let bx = x;
        let by = top + 3 + k * 4;
        const len = 4 + Math.floor(hash(i, 30 + k, s) * 5);
        for (let j = 0; j < len; j++) {
          bx += dir;
          if (j % 2 === 0) by--;
          b.set(bx, by, W.mid);
          b.set(bx, by + 1, W.line);
        }
        if (!row || k === 0) blob(b, [[bx + 0.5, by - 1, 2.6 + (i % 2), 2.1]], L.leaf, L.line, i * 5 + k);
      }
    }
    if (row) return;
    // Hongos que brillan
    const glow = rgb(f.glow);
    const cap = [pack(glow), pack(mix(glow, WHITE, 0.6)), pack(tone(glow, -0.45, T))];
    const stem = pack(rgb('#b8a0d0'));
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(hash(i, 1, 442) * b.w);
      const sz = 1 + (i % 3 === 0 ? 1 : 0);
      b.vline(x, g - 2 - sz, g, stem);
      for (let k = -sz - 1; k <= sz + 1; k++) b.set(x + k, g - 3 - sz, k === -sz - 1 || k === sz + 1 ? cap[2] : cap[0]);
      for (let k = -sz; k <= sz; k++) b.set(x + k, g - 4 - sz, k < 0 ? cap[1] : cap[0]);
    }
  },
  spires(b, T, g, f, haze, row) {
    const n = row ? 26 : 20;
    const pals = f.crystals.map((c) => ({ c: ramp5(c, T, haze), line: lineOf(c, T, haze) }));
    const white = pack(mix(WHITE, T.haze, haze));
    const s = 450 + row * 9;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + hash(i, 1, s) * 0.8) / n) * b.w);
      const P = pals[(i + row) % pals.length];
      // Racimo: un cristal alto y uno o dos más chicos, inclinados
      const cnt = 1 + Math.floor(hash(i, 4, s) * 3);
      for (let k = cnt - 1; k >= 0; k--) {
        const hgt = Math.round(((row ? 16 : 22) + hash(i, 2 + k, s) * (row ? 22 : 34)) * (k ? 0.55 : 1));
        const half = (k ? 2 : 3) + Math.floor(hash(i, 6 + k, s) * 2);
        const cx = x + (k === 1 ? -half - 3 : k === 2 ? half + 3 : 0);
        const lean = k === 1 ? -0.2 : k === 2 ? 0.2 : 0;
        for (let dy = 0; dy < hgt; dy++) {
          const tip = hgt - dy;
          const hw = tip <= half * 2 ? Math.floor(tip / 2) : half;
          const ox = Math.round(cx + dy * lean);
          const y = g - dy;
          for (let dx = -hw - 1; dx <= hw + 1; dx++) {
            let c = dx < -hw / 3 ? P.c[4] : dx <= hw / 3 ? P.c[2] : P.c[0];
            if (dx === Math.round(-hw / 3) && hw > 1) c = P.c[3];
            if (dx === -hw - 1 || dx === hw + 1) c = P.line;
            b.set(ox + dx, y, c);
          }
          if (hw === 0) b.set(ox, y - 1, P.line);
        }
        b.set(Math.round(cx - half / 2), g - Math.round(hgt * 0.6), white);
      }
    }
    if (row) return;
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(hash(i, 1, 452) * b.w);
      const P = pals[i % pals.length];
      b.set(x, g - 1, P.c[3]);
      b.set(x + 1, g - 1, P.c[1]);
      b.set(x, g - 2, P.line);
    }
  },
  ashland(b, T, g, f, haze, row) {
    const rock = leafPal('#3a2e2e', T, haze);
    const W = trunkPal(f.trunk, T, haze);
    const ember = pack(rgb(f.lava[1]));
    if (row) {
      // Peñascos de basalto
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(((i + hash(i, 1, 460)) / 14) * b.w);
        const r = 4 + Math.floor(hash(i, 2, 460) * 7);
        const hgt = r * (1.4 + hash(i, 3, 460) * 1.6);
        blob(b, [[x, g - hgt / 2, r, hgt / 2 + 1], [x + r * 0.7, g - hgt / 4, r * 0.7, hgt / 4 + 1]], rock.leaf, rock.line, i, false);
      }
      return;
    }
    // Árboles calcinados con brasas
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(((i + hash(i, 1, 461) * 0.8) / 18) * b.w);
      const hgt = 12 + Math.floor(hash(i, 2, 461) * 22);
      trunk(b, x, g - hgt, g, W);
      for (let k = 1; k <= 5; k++) {
        b.set(x - 1 - k, g - hgt + 5 - k, W.mid);
        b.set(x + 1 + k, g - hgt + 9 - k, W.mid);
      }
      b.set(x - 6, g - hgt - 1, ember);
      if (i % 2) b.set(x + 6, g - hgt + 3, ember);
    }
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(hash(i, 3, 462) * b.w);
      const r = 2 + (i % 3);
      blob(b, [[x, g - r * 0.4, r + 1, r * 0.8]], rock.leaf, rock.line, i + 50, false);
    }
  },
};

// Suelo de la capa cercana: borde con matas encima y debajo el relleno exacto
function paintGround(b, T, g, f) {
  const fill = pack(rgb(f.ground));
  const lip = rgb(f.lip);
  const lipC = [pack(tone(lip, 0.3, T)), pack(lip), pack(tone(lip, -0.35, T))];
  const mid = pack(mix(rgb(f.ground), tone(lip, -0.5, T), 0.45));
  for (let x = 0; x < b.w; x++) {
    for (let y = g + 1; y < b.h; y++) b.d[y * b.w + x] = fill;
    b.set(x, g, lipC[1]);
    b.set(x, g - 1, lipC[0]);
    if (hash(x, 1, 470) < 0.45) b.set(x, g + 1, lipC[2]);
    if (hash(x, 2, 470) < 0.25) b.set(x, g + 2, mid);
    const tuft = hash(x >> 1, 3, 470);
    if (tuft < 0.3) b.set(x, g - 2, tuft < 0.12 ? lipC[0] : lipC[1]);
    // Vetas de tierra bajo el borde, cada vez más escasas (las últimas filas quedan lisas)
    for (let y = g + 3; y < g + 10; y++) if (hash(x >> 2, y, 471) < 0.2 - (y - g) * 0.02) b.set(x, y, mid);
  }
  if (!f.lava) return;
  // Charcos de lava
  const lava = f.lava.map((c) => pack(rgb(c)));
  for (let i = 0; i < 7; i++) {
    const x0 = Math.floor(((i + hash(i, 1, 463)) / 7) * b.w);
    const len = 12 + Math.floor(hash(i, 2, 463) * 18);
    for (let k = 0; k < len; k++) {
      const edge = k === 0 || k === len - 1;
      b.set(x0 + k, g - 1, edge ? lava[3] : lava[2]);
      b.set(x0 + k, g, edge ? lava[3] : (k + i) % 5 === 0 ? lava[0] : lava[1]);
      b.set(x0 + k, g + 1, edge ? fill : lava[2]);
    }
  }
}

// ---------------------------------------------------------------- pintores
export const PIXEL = {
  // Sol: disco luminoso con borde anaranjado, corona translúcida y rayos cortos
  sun(pc) {
    const R = 9.6;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x + 0.5 - 16;
        const dy = y + 0.5 - 16;
        const d = Math.hypot(dx, dy);
        if (d <= R) {
          const l = -(dx * 0.6 + dy * 0.8) / R;
          const v = l * 0.45 + (1 - d / R) * 0.9;
          let col = v > 0.95 ? '#fffdf0' : v > 0.6 ? '#fff3b0' : v > 0.3 ? '#ffe170' : '#ffc848';
          if (d > R - 1.1) col = l > 0.2 ? '#ffd860' : '#ffa832';
          pc.set(x, y, col);
        } else if (d <= R + 1.6) {
          pc.set(x, y, (x + y) % 2 ? 'rgba(255,214,110,0.75)' : 'rgba(255,190,80,0.55)');
        } else if (d <= R + 3) {
          pc.set(x, y, 'rgba(255,214,120,0.3)');
        } else if (d <= 15.5) {
          // Rayos: largos en cruz, cortos en diagonal
          const a = Math.atan2(dy, dx);
          const long = Math.abs(Math.cos(a * 4)) > 0.92;
          if (Math.cos(a * 8) > 0.9 && (long || d < 13.5)) pc.set(x, y, d < 13 ? 'rgba(255,224,130,0.55)' : 'rgba(255,224,130,0.3)');
        }
      }
    }
  },
  // Luna llena: mares oscuros, cráteres con la pared iluminada abajo a la derecha, limbo en sombra
  moon(pc) {
    const R = 9.6;
    const c = 12;
    const TONES = ['#7e89ae', '#a3aeca', '#c8d1e4', '#e4e9f4', '#fafbff'];
    const maria = [[9.5, 9, 3.4], [14.5, 13.5, 2.8], [8.5, 14.5, 2.1], [13, 8, 1.6]];
    const craters = [[15.5, 7.5, 1.7], [6.5, 11, 1.3], [12, 17.5, 1.5], [17.5, 14.5, 1.1], [10.5, 5, 1]];
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d = Math.hypot(px - c, py - c);
        if (d > R) {
          if (d <= R + 1.3) pc.set(x, y, 'rgba(206,220,255,0.35)');
          else if (d <= R + 2.4) pc.set(x, y, 'rgba(190,206,255,0.14)');
          continue;
        }
        const l = -((px - c) * 0.6 + (py - c) * 0.8) / R;
        let t = l > 0.5 ? 4 : l > 0 ? 3 : l > -0.5 ? 2 : 1;
        if (d > R - 1 && l < 0.2) t = Math.max(0, t - 1);
        for (const [mx, my, mr] of maria) {
          if (Math.hypot(px - mx, py - my) < mr + (hash(x, y, 91) - 0.5) * 0.9) {
            t = Math.max(1, t - 1);
            break;
          }
        }
        for (const [kx, ky, kr] of craters) {
          const ddx = px - kx;
          const ddy = py - ky;
          const dd = Math.hypot(ddx, ddy);
          const side = (ddx * 0.6 + ddy * 0.8) / kr;
          if (dd < kr) t = side < -0.25 ? Math.max(0, t - 2) : side > 0.35 ? Math.min(4, t + 1) : Math.max(1, t - 1);
          else if (dd < kr + 0.9 && side > 0.4) t = Math.min(4, t + 1);
        }
        pc.set(x, y, TONES[t]);
      }
    }
  },
  // Nube cúmulo (3 formas según v): bultos iluminados arriba a la izquierda, base plana y fría
  cloud(pc, v = 0) {
    const SETS = [
      [[13, 16, 6], [22, 11.5, 7.5], [33, 8.5, 9], [44, 11, 7.5], [53, 15, 5.5], [28, 16, 6]],
      [[9, 17, 4.5], [17, 13.5, 6], [27, 11.5, 7], [37, 12.5, 6.5], [46, 14, 6], [55, 17, 4.5]],
      [[15, 16, 5.5], [24, 11, 8], [32, 6, 7], [40, 10, 8], [49, 15, 6], [33, 15, 7]],
    ];
    const puffs = SETS[v % 3];
    const BASE = 19.5;
    const TONES = ['#a2b3d4', '#bccbe4', '#d8e2f2', '#eef3fb', '#ffffff'];
    let top = 99;
    for (const [, cy, r] of puffs) top = Math.min(top, cy - r);
    const bx0 = puffs[0][0] - 2;
    const bx1 = puffs[4][0] + 3;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 64; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        if (py > BASE + 0.8) continue;
        let best = 0;
        let nx = 0;
        let ny = 0;
        for (const [cx, cy, r] of puffs) {
          const dx = (px - cx) / r;
          const dy = (py - cy) / r;
          const q = 1 - dx * dx - dy * dy;
          if (q > best) {
            best = q;
            nx = dx;
            ny = dy;
          }
        }
        // La base se alarga en una franja plana
        const inBase = py > BASE - 3.5 && px > bx0 && px < bx1;
        if (best <= 0 && !inBase) continue;
        const l = best > 0 ? -(nx * 0.55 + ny * 0.85) : -0.6;
        const low = (py - top) / (BASE - top);
        const val = l * 0.65 - low * 0.75 + 0.42;
        let t = val > 0.55 ? 4 : val > 0.22 ? 3 : val > -0.12 ? 2 : val > -0.42 ? 1 : 0;
        if (py > BASE - 0.5) t = Math.min(t, 1);
        pc.set(x, y, TONES[t]);
      }
    }
    // Jirones translúcidos a los costados de la base
    const y = Math.floor(BASE) - 1;
    const x0 = Math.floor(puffs[0][0] - puffs[0][2]);
    const x1 = Math.ceil(puffs[4][0] + puffs[4][2]);
    for (let k = 1; k <= 6; k++) {
      if (!pc.get(x0 - k, y)) pc.set(x0 - k, y, `rgba(214,226,244,${(0.6 - k * 0.09).toFixed(2)})`);
      if (!pc.get(x1 + k, y + 1)) pc.set(x1 + k, y + 1, `rgba(200,214,238,${(0.55 - k * 0.08).toFixed(2)})`);
    }
  },
};

export const CTX = {
  // Brillo suave (antorchas, luciérnagas, jefes): caída gaussiana sin anillos, centro cálido casi blanco
  glow(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (let i = 0; i <= 16; i++) {
      const r = i / 16;
      const a = 0.66 * Math.exp(-r * r * 5.2) * (1 - r);
      const c = mix([255, 228, 168], [255, 146, 48], Math.min(1, r * 1.6));
      g.addColorStop(r, `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  // Estrellas repetibles: muchas tenues de colores, algunas medianas y pocas con destello en cruz
  stars(ctx, w, h) {
    const COLORS = [[255, 255, 255], [200, 220, 255], [255, 240, 200], [255, 208, 200], [214, 206, 255]];
    const dot = (x, y, c, a) => {
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(2)})`;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) ctx.fillRect(x + ox, y + oy, 2, 2);
    };
    const cell = (i, k, seed) => Math.floor(hash(i, k, seed) * (w / 2)) * 2;
    for (let i = 0; i < 150; i++) dot(cell(i, 1, 8), cell(i, 2, 8), COLORS[Math.floor(hash(i, 3, 8) * COLORS.length)], 0.3 + hash(i, 4, 8) * 0.5);
    for (let i = 0; i < 22; i++) {
      const x = cell(i, 1, 9);
      const y = cell(i, 2, 9);
      const c = COLORS[i % COLORS.length];
      dot(x, y, c, 1);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(x + dx, y + dy, c, 0.28);
    }
    for (let i = 0; i < 6; i++) {
      const x = cell(i, 1, 10);
      const y = cell(i, 2, 10);
      dot(x, y, WHITE, 1);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        dot(x + dx, y + dy, [220, 232, 255], 0.75);
        dot(x + dx * 2, y + dy * 2, [200, 220, 255], 0.35);
        if (i % 2 === 0) dot(x + dx * 3, y + dy * 3, [200, 220, 255], 0.14);
      }
      for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) dot(x + dx, y + dy, [210, 225, 255], 0.18);
    }
  },
  mountains(ctx, w, h, v, asset) {
    // Dos cordilleras: la de atrás casi perdida en la bruma, la de adelante con todo el detalle
    const T = themeOf(asset);
    const m = T.m;
    const b = new Buf(w / 2, h / 2);
    paintRange(b, T, heights(b.w, b.h, BACK_SHAPE[m.shape](m.seed)), { ...m, haze: 0.55, slant: 0.5, fadeFrom: 0.45, seed: m.seed + 100, gullies: 50 });
    const top = heights(b.w, b.h, SHAPES[m.shape](m.seed));
    paintRange(b, T, top, { ...m, haze: 0.26, slant: m.shape === 'spiky' ? 0.2 : 0.55, fadeFrom: 0.5 });
    if (m.lava) volcanoExtras(b, T, top, m);
    if (m.glints) glints(b, top, m.seed);
    b.blit(ctx);
  },
  hills(ctx, w, h, v, asset) {
    const T = themeOf(asset);
    const o = T.h;
    const b = new Buf(w / 2, h / 2);
    const seed = o.seed;
    // Fila de atrás, más alta y brumosa
    const backHf = (u) => 0.6 + 0.14 * pnoise(u, 4, seed + 1) + 0.08 * pnoise(u, 11, seed + 2);
    paintHills(b, T, heights(b.w, b.h, backHf), { ...o, haze: 0.32, fadeFrom: 0.5, seed: seed + 3 });
    const hf = (u) => 0.4 + 0.2 * pnoise(u, 3, seed) + 0.1 * pnoise(u, 8, seed + 4) + 0.03 * pnoise(u, 29, seed + 5);
    const top = heights(b.w, b.h, hf);
    paintHills(b, T, top, { ...o, haze: 0.08, fadeFrom: 0.62, seed });
    // Adornos sobre la fila de adelante (arbolitos, cactus, pinos, cristales…)
    const P = {
      trunk: pack(tone(rgb(o.trunk || '#4a3522'), -0.2, T)),
      leaf: ramp5(o.leaf || o.base, T, 0.08),
      line: lineOf(o.leaf || o.base, T, 0.08),
      snow: pack(WHITE),
      glow: o.glow ? pack(rgb(o.glow)) : 0,
      shards: (o.colors || []).map((c) => ({ c: ramp5(c, T, 0.05), line: lineOf(c, T, 0.05) })),
    };
    for (let i = 0; i < o.props; i++) {
      const x = Math.floor(hash(i, 1, seed + 9) * b.w);
      const s = 2 + Math.floor(hash(i, 2, seed + 9) * 3);
      PROPS[o.prop](b, x, top[x] + 1, s, P, i);
    }
    b.blit(ctx);
  },
  forest(ctx, w, h, v, asset) {
    // Capa más cercana: una fila brumosa detrás y otra con todo el detalle delante
    const T = themeOf(asset);
    const f = T.f;
    const b = new Buf(w / 2, h / 2);
    const g = Math.round(b.h * 0.8);
    FRONTS[f.kind](b, T, g - 2, f, 0.26, 1);
    FRONTS[f.kind](b, T, g, f, 0, 0);
    paintGround(b, T, g, f);
    b.blit(ctx);
  },
};

/** Los rellenos debajo de cada capa son el color exacto de su última fila. */
export function patch(api) {
  for (const [name, T] of Object.entries(THEME)) {
    const th = api.BG_THEMES[name];
    if (th) th.fills = [toInt(rgb(T.m.fill)), toInt(rgb(T.h.fill)), toInt(rgb(T.f.ground))];
  }
}
