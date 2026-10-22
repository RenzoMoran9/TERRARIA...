// Arte mejorado: monsters. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Enemigos, jefes y sus proyectiles. Cada parte se pinta en una capa y se "estampa" con su propio contorno
// (oscuro y saturado del color de la parte, nunca negro). Luz desde arriba a la izquierda; sombras más
// frías y saturadas, brillos más cálidos. Los cuadros y su significado son los de Enemies.js y Bosses.js.
import { PixelCanvas, hash } from '../systems/PixelArt.js';

// ---------------------------------------------------------------- color
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const MEMO = new Map();
const memo = (key, fn) => {
  let v = MEMO.get(key);
  if (v === undefined) MEMO.set(key, (v = fn()));
  return v;
};
function toHsl(c) {
  return memo(`h${c}`, () => {
    const n = parseInt(c.slice(1), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 225; // los grises se enfrían al oscurecerlos
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = 60 * (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
    }
    return [h, s, l];
  });
}
function fromHsl(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  s = clamp01(s);
  l = clamp01(l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + f(h + 1 / 3) + f(h) + f(h - 1 / 3);
}
// Gira el matiz h hacia target como mucho deg grados
const towards = (h, target, deg) => {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), deg);
};
/** Sombra: más oscura, más saturada y con el matiz hacia el azul violeta. */
const darker = (c, k = 0.1) =>
  memo(`d${c}${k}`, () => {
    const [h, s, l] = toHsl(c);
    return fromHsl(towards(h, 248, k * 120), s + k * (s > 0.06 ? 0.55 : 0.2), l - k);
  });
/** Brillo: más claro y con el matiz hacia el amarillo. */
const lighter = (c, k = 0.1) =>
  memo(`l${c}${k}`, () => {
    const [h, s, l] = toHsl(c);
    return fromHsl(towards(h, 55, k * 90), s - k * 0.08, l + k);
  });
/** Contorno: el color muy oscuro, algo saturado y frío. */
const ink = (c) =>
  memo(`i${c}`, () => {
    const [h, s, l] = toHsl(c);
    return fromHsl(towards(h, 250, 24), Math.min(0.8, s * 0.7 + 0.2), Math.min(0.14, l * 0.28 + 0.04));
  });
function mix(a, b, t) {
  return memo(`m${a}${b}${t}`, () => {
    const x = parseInt(a.slice(1), 16);
    const y = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  });
}
/** Rampa de 5 tonos [hondo, sombra, medio, luz, brillo] alrededor de un color medio. */
const ramp = (mid, k = 0.12) =>
  memo(`r${mid}${k}`, () => ({ deep: darker(mid, k * 1.9), shade: darker(mid, k), mid, light: lighter(mid, k * 0.85), hi: lighter(mid, k * 1.75) }));
// Rampa dada a mano (de oscuro a claro)
const R5 = (deep, shade, mid, light, hi) => ({ deep, shade, mid, light, hi });

// ---------------------------------------------------------------- luz
// Dirección de la luz (arriba a la izquierda y un poco hacia el frente)
const LX = -0.52;
const LY = -0.6;
const LZ = 0.6;
/** Luz de una esfera en el punto (nx, ny) de su disco unidad: -1..1 */
function sphereLight(nx, ny) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return LX * nx + LY * ny + LZ * nz;
}
/** Tono de la rampa según la luz (umbrales: brillo, luz, medio, sombra) */
function tone(R, l, t0 = 0.86, t1 = 0.58, t2 = 0.2, t3 = -0.18) {
  return l > t0 ? R.hi : l > t1 ? R.light : l > t2 ? R.mid : l > t3 ? R.shade : R.deep;
}

// ---------------------------------------------------------------- capas
// Cada parte se pinta en una capa del tamaño de la hoja y se estampa con contorno. Donde el contorno cae
// sobre otra parte ya pintada queda una línea interior más suave (mezcla con lo de abajo).
let LAYER = null;
function layer(pc) {
  if (!LAYER || LAYER.w !== pc.w || LAYER.h !== pc.h) {
    LAYER = new PixelCanvas(pc.w, pc.h);
    // Coordenadas redondeadas (las formas usan decimales)
    const { set, get } = LAYER;
    LAYER.set = (x, y, c) => set.call(LAYER, Math.round(x), Math.round(y), c);
    LAYER.get = (x, y) => get.call(LAYER, Math.round(x), Math.round(y));
  }
  LAYER.px.fill(null);
  return LAYER;
}
/** Estampa la capa en pc. inner: fuerza de la línea sobre lo ya pintado (0 = sin línea); line: false = sin contorno. */
function stamp(pc, L, inner = 0.6, line = true, inkOf = ink) {
  const { w, h, px } = L;
  const out = pc.px;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = px[i];
      if (c) {
        out[i] = c;
        continue;
      }
      if (!line) continue;
      const n = (y > 0 && px[i - w]) || (x > 0 && px[i - 1]) || (x < w - 1 && px[i + 1]) || (y < h - 1 && px[i + w]);
      if (!n) continue;
      const under = out[i];
      if (under) {
        if (inner > 0) out[i] = mix(under, inkOf(n), inner);
      } else out[i] = inkOf(n);
    }
  }
  px.fill(null);
}
/** Elipse rellena; paint(nx, ny, x, y) → color (nx, ny = posición en el disco unidad). */
function ell(L, cx, cy, rx, ry, paint) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) {
        const c = typeof paint === 'function' ? paint(nx, ny, x, y) : paint;
        if (c) L.set(x, y, c);
      }
    }
  }
}
/** Esfera sombreada con una rampa. */
const ball = (L, cx, cy, rx, ry, R, shift = 0) => ell(L, cx, cy, rx, ry, (nx, ny) => tone(R, sphereLight(nx, ny) + shift));
/** Polígono relleno (centros de píxel); paint(x, y) → color. */
function poly(L, pts, paint) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) {
        const c = typeof paint === 'function' ? paint(x, y) : paint;
        if (c) L.set(x, y, c);
      }
    }
  }
}
/** Cápsula de (x0,y0) a (x1,y1) con radio r; paint(t, luz, x, y): t = 0..1 a lo largo, luz = -1..1 de lado. */
function capsule(L, x0, y0, x1, y1, r, paint) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const r2 = r * r;
  for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
      const ex = px - (x0 + dx * t);
      const ey = py - (y0 + dy * t);
      if (ex * ex + ey * ey > r2) continue;
      const c = typeof paint === 'function' ? paint(t, -(ex * 0.65 + ey * 0.76) / r, x, y) : paint;
      if (c) L.set(x, y, c);
    }
  }
}
// Tono de un miembro según el lado (luz arriba a la izquierda)
const side = (R, s) => (s > 0.5 ? R.light : s < -0.4 ? R.shade : R.mid);
/** Plantilla de texto (un carácter por píxel, '.' = vacío). flip: espejo horizontal. */
function blit(L, x0, y0, rows, map, flip = false) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = map[row[c]];
      if (col) L.set(flip ? x0 + row.length - 1 - c : x0 + c, y0 + r, col);
    }
  }
}
// Pinta solo sobre píxeles ya ocupados de la capa (detalles dentro de una forma)
const over = (L, x, y, c) => {
  x = Math.round(x);
  y = Math.round(y);
  if (L.get(x, y)) L.set(x, y, c);
};

// ---------------------------------------------------------------- paletas compartidas
const GOLD = R5('#6e3a0c', '#b06a14', '#e4a226', '#ffd257', '#fff3b0');
const RUBY = R5('#5a0820', '#a01430', '#e0283c', '#ff6a6a', '#ffd0c8');
const VENOM = R5('#3a0a4a', '#7a1a9a', '#b83ae0', '#e48aff', '#fbe0ff');

// ---------------------------------------------------------------- slimes
// Gris claro casi neutro (el juego lo tiñe): sombras algo frías y brillos blancos
const GEL = R5('#8a93a8', '#b3bac8', '#d6dbe4', '#eef1f5', '#ffffff');
/**
 * Cuerpo de slime: cúpula con base plana en la fila 'base', ancho 2*rx y alto h.
 * taper > 0 lo afina arriba (gota). R = rampa del gel. Devuelve la fila de arriba.
 */
function slimeBody(L, cx, base, rx, h, R, taper = 0) {
  const top = base - h + 1;
  const rim = Math.max(1, Math.round(rx * 0.13)); // ancho del borde en sombra
  // Mancha de luz arriba a la izquierda (sigue la forma, sin bandas diagonales)
  const lx = cx - rx * 0.32;
  const ly = top + h * 0.34;
  const lrx = rx * 0.5;
  const lry = h * 0.26;
  for (let y = top; y <= base; y++) {
    const t = (y + 0.5 - top) / h; // 0 arriba .. 1 abajo
    // Perfil: arco arriba y caída casi vertical abajo
    const k = Math.min(1, t / 0.62);
    let half = rx * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
    half *= 1 - taper * (1 - t) * 0.5;
    if (y === base) half -= 1; // base redondeada
    const xa = Math.floor(cx - half);
    const xb = Math.ceil(cx + half) - 1;
    for (let x = xa; x <= xb; x++) {
      const dR = xb - x; // distancia al borde derecho
      const dL = x - xa;
      const dB = base - y;
      const top2 = y - top < 1 || (y - top < 2 && (dL < 2 || dR < 2));
      let c = R.mid;
      const qx = (x + 0.5 - lx) / lrx;
      const qy = (y + 0.5 - ly) / lry;
      if (qx * qx + qy * qy < 1) c = R.light;
      if (dB < rim + 1 || (dR < rim + 1 && t > 0.25) || (dL < rim && t > 0.55)) c = R.shade;
      if (dB === 0 || (dR === 0 && t > 0.4) || (dB < rim && dR < rim + 1)) c = R.deep;
      if (top2 && dR > rim) c = R.light; // luz que rasa el borde de arriba
      // El gel deja pasar luz: una línea clara sobre la base
      if (dB === rim + 1 && dL > rim && dR > rx * 0.5) c = mix(R.mid, R.light, 0.5);
      L.set(x, y, c);
    }
  }
  return top;
}
// Brillo especular del gel: arco blanco arriba a la izquierda
function gelShine(L, cx, top, rx, h, R) {
  const x0 = Math.round(cx - rx * 0.55);
  const y0 = top + Math.max(1, Math.round(h * 0.18));
  over(L, x0, y0 + 1, R.hi);
  over(L, x0, y0 + 2, R.hi);
  over(L, x0 + 1, y0, R.hi);
  if (rx > 6) over(L, x0 + 2, y0, R.light);
}

// ---------------------------------------------------------------- zombi
const ZSKIN = R5('#2f4a3a', '#4f7050', '#76a064', '#9cc07e', '#c4daa0');
const ZHAIR = R5('#1a1c14', '#2a2c1e', '#3a3c28', '#525236', '#6a6a48');
const ZSHIRT = R5('#232e4a', '#34466a', '#4c6488', '#6e86a6', '#94a8c0');
const ZPANTS = R5('#1e1820', '#2e2630', '#433844', '#5a4c58', '#74646e');
const ZSHOE = R5('#1c120c', '#2e1e14', '#46301e', '#5e4228', '#7a5a36');
// Cabeza del zombi (13 columnas desde x = cabeza + 6, mira a la derecha): pelo ralo, frente pelada,
// ojo hundido con pupila roja, mandíbula caída. d/h/H/L pelo, x/s/S/k piel, o ojera, w ojo, r pupila,
// m boca, t diente
const ZHEAD = {
  open: [
    '....dHHd.....',
    '..dHHLHdHd...',
    '.dHLHdkkkkd..',
    'dHHdkkkkSSS..',
    'dHdskSSSooS..',
    '.dHesSSSwwS..',
    '.dhesSSSwrSs.',
    '..dssSSSSSSs.',
    '..dxsSSSmmmt.',
    '...xsSSSmmm..',
    '....xsssmt...',
    '.....xxs.....',
  ],
  hurt: [
    '....dHHd.....',
    '..dHHLHdHd...',
    '.dHLHdkkkkd..',
    'dHHdkkkkSSS..',
    'dHdskSSSSoS..',
    '.dHesSSSorS..',
    '.dhesSSSSoSs.',
    '..dssSSSSmms.',
    '..dxsSSSmmmt.',
    '...xsSSSmmm..',
    '....xsssmm...',
    '.....xxs.....',
  ],
};
/**
 * Un cuadro del zombi. P: lean (inclinación), bob, front/back (paso de cada pie), hand/backHand
 * (manos [x, y] relativas al cuadro), eyes ('open' | 'hurt'), headDx.
 */
function zombiePose(pc, L, ox, P) {
  const bob = P.bob || 0;
  const lean = P.lean || 0;
  const ux = ox + lean;
  const hipY = 22 + bob;
  const shY = 14 + bob;
  const SK = ZSKIN;
  // Brazo: manga rota hasta el codo y antebrazo de piel; la mano cae con los dedos
  const arm = (sx, hand, dark) => {
    const hx = ox + hand[0] + lean;
    const hy = hand[1] + bob;
    const x0 = ux + sx;
    const S = dark ? R5(ZSHIRT.deep, ZSHIRT.deep, ZSHIRT.shade, ZSHIRT.mid, ZSHIRT.light) : ZSHIRT;
    const K = dark ? R5(SK.deep, SK.deep, SK.shade, SK.mid, SK.light) : SK;
    capsule(L, x0 + 0.5, shY + 1, hx, hy, 1.5, (t, s) => (t < 0.38 ? side(S, s) : side(K, s)));
    L.set(Math.round(x0 + (hx - x0) * 0.4), Math.round(shY + 1 + (hy - shY - 1) * 0.4) + 1, S.shade); // jirón
    L.rect(Math.round(hx), Math.round(hy), 2, 2, K.mid);
    L.set(Math.round(hx) + 1, Math.round(hy) + 2, K.shade); // dedos caídos
    L.set(Math.round(hx), Math.round(hy) + 2, K.deep);
  };
  // Pierna: pantalón roto (la de adelante muestra la canilla) y zapato o pie descalzo
  const leg = (hx, dx, dark, torn) => {
    const fx = ox + hx + dx;
    const x0 = ux + hx - Math.round(lean / 2);
    const Pn = dark ? R5(ZPANTS.deep, ZPANTS.deep, ZPANTS.shade, ZPANTS.mid, ZPANTS.light) : ZPANTS;
    capsule(L, x0 + 1.5, hipY, fx + 1.5, 28.5, 1.6, (t, s) => (torn && t > 0.62 ? side(SK, s) : side(Pn, s)));
    if (torn) {
      L.set(fx + 1, 26, Pn.shade); // borde deshilachado
      L.set(fx + 3, 25, Pn.mid);
    }
    L.rect(fx, 29, 4, 2, dark ? ZSHOE.shade : ZSHOE.mid);
    L.set(fx + 4, 30, dark ? ZSHOE.shade : ZSHOE.mid);
    L.rect(fx, 31, 5, 1, ZSHOE.deep);
    L.set(fx + 1, 29, dark ? ZSHOE.mid : ZSHOE.light);
  };
  arm(9, P.backHand, true);
  stamp(pc, L, 0.5);
  leg(9, P.back, true, false);
  stamp(pc, L, 0.5);
  leg(11, P.front, false, true);
  stamp(pc, L, 0.55);
  // Torso: camisa rota con un agujero (costillas) y el borde de abajo deshilachado
  const ty = 13 + bob;
  for (let y = ty; y < hipY + 1; y++) {
    for (let x = 0; x < 8; x++) {
      const c = x < 2 ? ZSHIRT.shade : x > 5 ? ZSHIRT.light : ZSHIRT.mid;
      L.set(ux + 8 + x, y, y === hipY ? ZPANTS.deep : c);
    }
  }
  L.set(ux + 9, hipY, null);
  L.set(ux + 12, hipY, null);
  L.set(ux + 14, hipY - 1, ZSHIRT.shade);
  L.rect(ux + 11, ty + 3, 3, 3, SK.shade); // agujero con costillas
  L.set(ux + 12, ty + 3, SK.light);
  L.set(ux + 12, ty + 5, SK.light);
  L.set(ux + 11, ty + 4, SK.deep);
  L.set(ux + 13, ty + 4, SK.deep);
  L.rect(ux + 11, ty, 3, 1, SK.shade); // cuello
  L.set(ux + 15, ty + 2, ZSHIRT.hi);
  stamp(pc, L, 0.55);
  // Cabeza
  const hx = ux + (P.headDx || 0) + 6;
  const hy = 1 + bob;
  blit(L, hx, hy, ZHEAD[P.eyes] || ZHEAD.open, {
    d: ZHAIR.deep, h: ZHAIR.shade, H: ZHAIR.mid, L: ZHAIR.light,
    x: SK.deep, s: SK.shade, S: SK.mid, k: SK.light, e: SK.shade,
    o: mix(SK.shade, '#5a3a5a', 0.4), w: '#e8e2a8', r: '#e8301e', m: '#2a1018', t: '#e8e0c0',
  });
  over(L, hx + 6, hy + 7, mix(SK.mid, '#6a5a8a', 0.25)); // moretón
  over(L, hx + 5, hy + 3, SK.hi);
  stamp(pc, L, 0.55);
  arm(12, P.hand, false);
  stamp(pc, L, 0.6);
}

/**
 * Estampa la capa como algo translúcido (alas): sobre lo ya pintado mezcla los colores; sobre lo vacío
 * deja el color con transparencia. Va al final del cuadro (después no se mezcla nada encima).
 */
function glass(pc, L, alpha, line) {
  const { w, h, px } = L;
  const out = pc.px;
  const rgba = (c, a) => {
    const n = parseInt(c.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = px[i];
      const n = !c && ((y > 0 && px[i - w]) || (x > 0 && px[i - 1]) || (x < w - 1 && px[i + 1]) || (y < h - 1 && px[i + w]));
      const col = c || (n && line);
      if (!col) continue;
      const a = c ? alpha : Math.min(1, alpha + 0.2);
      const under = out[i];
      out[i] = under && under[0] === '#' ? mix(under, col, a) : rgba(col, a);
    }
  }
  px.fill(null);
}

/**
 * Lengua de fuego: base de ancho w en (x, y), punta en (x + lean, y - h). Colores por altura y por
 * distancia al centro (núcleo claro, borde rojo). F = [hondo, rojo, naranja, amarillo, blanco].
 */
function flame(L, x, y, w, h, lean, F, seed = 0) {
  for (let yy = Math.floor(y - h); yy <= Math.ceil(y); yy++) {
    const t = (y - (yy + 0.5)) / h; // 0 base .. 1 punta
    if (t < 0 || t > 1) continue;
    const half = (w / 2) * Math.pow(1 - t, 0.75) * (t < 0.15 ? 0.75 + t * 1.6 : 1);
    const cx = x + lean * t * t + Math.sin(t * 5 + seed) * 0.6 * t;
    for (let xx = Math.floor(cx - half); xx <= Math.ceil(cx + half); xx++) {
      const d = Math.abs(xx + 0.5 - cx) / Math.max(0.5, half);
      if (d > 1) continue;
      const heat = (1 - d) * (1 - t * 0.85);
      L.set(xx, yy, heat > 0.62 ? F[4] : heat > 0.42 ? F[3] : heat > 0.22 ? F[2] : heat > 0.08 ? F[1] : F[0]);
    }
  }
}
const FIRE = ['#8a1408', '#d8320e', '#ff7a18', '#ffc63a', '#fff4b4'];
// Línea quebrada (grieta) determinista desde (x, y) en dirección (dx, dy)
function crack(L, x, y, dx, dy, n, c, seed, onlyOver = true) {
  for (let k = 0; k < n; k++) {
    const j = hash(k, seed, 77) < 0.5 ? 0 : hash(k, seed, 78) < 0.5 ? -1 : 1;
    x += dx + (dy !== 0 ? j : 0);
    y += dy + (dx !== 0 ? j : 0) * 0.5;
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (!onlyOver || L.get(rx, ry)) L.set(rx, ry, typeof c === 'function' ? c(k / n) : c);
  }
}

// Corona del Rey Slime (17×10): p perla, w/l/m/s/o oro, R/r/d rubí, B/b zafiro
const CROWN = [
  'p.......p.......p',
  'l.......w.......s',
  'lm.....lwm.....ms',
  'lmm...lmmms...mms',
  'lmml.lmmmmms.mmms',
  'lmmmlmmRrmmmsmmms',
  'wwlllllrrdlllmmms',
  'lBmmmmmmdmmmmmBms',
  'mbmmmmmmmmmmmmbss',
  'osssssssssssssss.',
];

export const PIXEL = {
  // Slime: 3 cuadros de 16×12 (quieto, aplastado, estirado), gris claro para que el tinte lo coloree
  slime(pc) {
    const L = layer(pc);
    const frames = [
      [7, 9, 0],
      [8, 7, 0],
      [5.5, 12, 0.35],
    ]; // rx, alto, afinado
    frames.forEach(([rx, h, taper], f) => {
      const ox = f * 16;
      const cx = ox + 8;
      const top = slimeBody(L, cx, 11, rx, h, GEL, taper);
      gelShine(L, cx, top, rx, h, GEL);
      // Burbujas dentro del gel
      over(L, cx - 2, 11 - Math.round(h * 0.3), GEL.light);
      over(L, cx + Math.round(rx * 0.55), 11 - Math.round(h * 0.45), GEL.light);
      // Ojos (miran a la derecha)
      const ey = top + Math.round(h * (f === 2 ? 0.3 : 0.38));
      const eye = '#232838';
      for (const ex of [cx, cx + 3]) {
        over(L, ex, ey, eye);
        over(L, ex, ey + 1, eye);
      }
      if (f === 1) over(L, cx + 1, ey + 2, eye); // boquita al aplastarse
      stamp(pc, L);
    });
  },

  // Rey Slime: 3 cuadros de 48×36 (quieto, aplastado, estirado), apoyado abajo, con corona
  boss_slime_king(pc) {
    const L = layer(pc);
    const BLUE = R5('#1a2f8c', '#2457c4', '#3f86ec', '#74b4ff', '#d2ecff');
    const frames = [
      [21, 27, 0],
      [23, 21, 0],
      [17, 28, 0.25],
    ];
    frames.forEach(([rx, h, taper], f) => {
      const ox = f * 48;
      const cx = ox + 24;
      const base = 35;
      const top = slimeBody(L, cx, base, rx, h, BLUE, taper);
      // Núcleo más denso dentro del gel (da profundidad) y burbujas
      const core = mix(BLUE.mid, BLUE.shade, 0.45);
      ell(L, cx + rx * 0.1, base - h * 0.32, rx * 0.5, h * 0.24, (nx, ny, x, y) => (L.get(x, y) === BLUE.mid || L.get(x, y) === BLUE.light ? (ny < -0.6 || nx < -0.85 ? mix(BLUE.mid, BLUE.light, 0.4) : core) : null));
      for (const [bx, by, r] of [[0.35, 0.72, 1], [0.6, 0.55, 0], [-0.15, 0.8, 0], [0.75, 0.82, 1]]) {
        const x = Math.round(cx + rx * bx);
        const y = Math.round(base - h * (1 - by));
        over(L, x, y, BLUE.light);
        if (r) {
          over(L, x + 1, y + 1, BLUE.shade);
          over(L, x - 1, y, BLUE.light);
        }
      }
      // Brillo grande del gel
      const hx = Math.round(cx - rx * 0.62);
      const hy = top + Math.round(h * 0.2);
      for (let k = 0; k < 5; k++) over(L, hx + Math.round(k * 0.9), hy - Math.round(Math.sqrt(k) * 1.3) + 1, k < 3 ? BLUE.hi : BLUE.light);
      over(L, hx - 1, hy + 2, BLUE.hi);
      over(L, hx - 1, hy + 3, BLUE.light);
      // Cara enojada (mira a la derecha)
      const fx = cx + 3;
      const ey = top + Math.round(h * 0.42);
      const EYE = '#0c1238';
      for (const [ex, dir] of [[fx - 7, 1], [fx + 4, -1]]) {
        L.rect(ex, ey, 3, 4, EYE);
        L.set(ex + (dir > 0 ? 0 : 2), ey, null);
        over(L, ex + 1, ey + 1, '#ffffff');
        L.set(ex + (dir > 0 ? -1 : 3), ey - 2, EYE); // ceja
        L.set(ex + (dir > 0 ? 0 : 2), ey - 1, EYE);
        L.set(ex + 1, ey - 1, EYE);
      }
      const my = ey + 6 + (f === 1 ? -1 : 0);
      L.rect(fx - 3, my, 6, 1, EYE);
      L.set(fx - 4, my + 1, EYE);
      L.set(fx + 3, my + 1, EYE);
      stamp(pc, L);
      // Corona: tres puntas con perlas, rubí al centro y zafiros en la banda, hundida un poco en el gel
      const C = GOLD;
      blit(L, cx - 8, top - 8, CROWN, { p: '#fff6e0', w: C.hi, l: C.light, m: C.mid, s: C.shade, o: C.deep, R: RUBY.hi, r: RUBY.mid, d: RUBY.shade, b: '#2a5ad8', B: '#8ac8ff' });
      stamp(pc, L, 0.7);
    });
  },
  // Zombi: 5 cuadros de 24×32 (como el jugador): caminar ×4 con los brazos hacia adelante y golpeado
  zombie(pc) {
    const L = layer(pc);
    const feet = [4, 1, -4, -1];
    feet.forEach((f, i) =>
      zombiePose(pc, L, i * 24, { lean: 1, bob: i % 2, front: f, back: -f, hand: [21, 15], backHand: [20, 17], eyes: 'open' }),
    );
    zombiePose(pc, L, 96, { lean: -2, bob: 0, front: 2, back: -2, hand: [20, 8], backHand: [3, 9], eyes: 'hurt', headDx: -1 });
  },

  // Escorpión: 3 cuadros de 20×12 caminando: pinzas adelante y la cola con el aguijón sobre la espalda
  scorpion(pc) {
    const L = layer(pc);
    const B = R5('#4a1e0c', '#843c14', '#bc6a26', '#e49a46', '#ffd68a');
    const STING = R5('#24080c', '#4e1418', '#7e2420', '#b44a32', '#f0a080');
    for (let f = 0; f < 3; f++) {
      const ox = f * 20;
      // Patas (alternan al caminar)
      for (let k = 0; k < 4; k++) {
        const lx = ox + 6 + k * 2;
        const step = f === 1 ? 0 : (k + f) % 2 ? 1 : -1;
        L.set(lx, 10, B.shade);
        L.set(lx + step - (k < 2 ? 1 : 0), 11, B.deep);
      }
      stamp(pc, L, 0);
      // Cola: tramos que se curvan sobre la espalda, con juntas oscuras
      const T = [[5, 7.5], [3.4, 5.8], [3, 3.8], [3.9, 2], [5.8, 1.2], [7.8, 1.6]];
      for (let i = 0; i < T.length - 1; i++) {
        const r = 1.2 - i * 0.06;
        capsule(L, ox + T[i][0], T[i][1], ox + T[i + 1][0], T[i + 1][1], r, (t, s) => (t > 0.86 && i < 4 ? B.shade : s > 0.3 ? B.light : s < -0.45 ? B.shade : B.mid));
      }
      stamp(pc, L, 0.5);
      // Aguijón: bulbo oscuro con brillo y púa clara hacia adelante
      ball(L, ox + 9, 2.7, 1.4, 1.3, STING);
      L.set(ox + 10, 4, '#e8c898');
      L.set(ox + 11, 5, '#fff0c8');
      stamp(pc, L, 0.55);
      // Cuerpo segmentado (placas con borde de luz), más alto adelante
      ell(L, ox + 9.5, 8.3, 5.2, 2.3, (nx, ny, x) => {
        let c = tone(B, sphereLight(nx, ny * 1.3), 0.97, 0.45, 0.0, -0.45);
        if ((x - ox) % 2 === 0 && ny > -0.75 && nx < 0.6) c = c === B.light ? B.mid : c === B.mid ? B.shade : c;
        return c;
      });
      stamp(pc, L, 0.5);
      // Pinza de atrás (más oscura), cabeza con ojos y pinza de adelante levantada
      const open = f === 1 ? 0 : 1;
      const claw = (dx, dy, R) => {
        capsule(L, ox + 14.5 + dx, 8.4 + dy, ox + 16.6 + dx, 6.6 + dy, 0.8, (t, s) => side(R, s));
        ball(L, ox + 17.3 + dx, 6 + dy, 1.5, 1.35, R);
        L.set(ox + 19 + dx, 4 + dy - open, R.mid); // dedo de arriba
        L.set(ox + 19 + dx, 5 + dy - open, R.shade);
        L.set(ox + 19 + dx, 7 + dy, R.shade); // dedo de abajo
      };
      claw(-1.5, 0.6, R5(B.deep, B.deep, B.shade, B.mid, B.light));
      stamp(pc, L, 0.5);
      ball(L, ox + 14.5, 8.2, 2, 1.8, B);
      L.set(ox + 15, 7, '#ff6040');
      L.set(ox + 14, 7, '#1a0606');
      stamp(pc, L, 0.55);
      claw(0, 0, B);
      stamp(pc, L, 0.55);
    }
  },

  // Avispa: 2 cuadros de 16×14: alas arriba / abajo, abdomen a rayas y aguijón atrás
  wasp(pc) {
    const L = layer(pc);
    const Y = R5('#8a4a0a', '#c87a10', '#f0b41e', '#ffd84a', '#fff4a8');
    const K = R5('#120a08', '#1e1410', '#2e2218', '#4a3a2a', '#6a5a44');
    const FUZZ = R5('#3a1806', '#6a300c', '#9a5016', '#c8802c', '#f0b860');
    const WING = R5('#6a90b8', '#9cc0e0', '#cce6f8', '#eaf6ff', '#ffffff');
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      // Patas colgando
      for (const [x0, x1, y1] of [[9, 8, 12], [11, 11, 13], [12, 13, 12]]) L.line(ox + x0, 9, ox + x1, y1, K.light);
      stamp(pc, L, 0);
      // Abdomen a rayas con aguijón
      ell(L, ox + 5.5, 8.5, 4.4, 3, (nx, ny, x) => tone(Math.floor((x - ox + 1) / 2) % 2 ? Y : K, sphereLight(nx, ny), 0.8, 0.45, 0.02, -0.4));
      L.set(ox + 1, 10, K.mid);
      L.set(ox, 11, K.light);
      stamp(pc, L);
      // Tórax peludo y cabeza con ojo compuesto y mandíbula
      ball(L, ox + 10.5, 7, 2.4, 2.4, FUZZ);
      stamp(pc, L, 0.55);
      ball(L, ox + 13.5, 7.5, 2.2, 2.2, Y);
      L.rect(ox + 13, 6, 2, 2, K.deep);
      L.set(ox + 13, 6, '#7a5a8a');
      L.set(ox + 15, 9, K.mid);
      L.set(ox + 14, 9, K.light);
      L.set(ox + 14, 4, K.mid); // antena
      L.set(ox + 15, 3, K.mid);
      stamp(pc, L, 0.55);
      // Alas translúcidas (con una vena clara)
      if (f === 0) {
        poly(L, [[ox + 9.5, 6], [ox + 4.5, 0.5], [ox + 6.5, 0], [ox + 10.5, 5]], WING.shade);
        poly(L, [[ox + 10, 6], [ox + 7, 0], [ox + 9.5, -0.5], [ox + 12, 5]], (x) => (x - ox === 9 ? WING.light : WING.mid));
        L.set(ox + 8, 1, WING.hi);
      } else {
        poly(L, [[ox + 9, 6.5], [ox + 1.5, 6], [ox + 2, 4.2], [ox + 9, 5]], WING.shade);
        poly(L, [[ox + 9.5, 6.5], [ox + 3, 7.2], [ox + 3, 5.4], [ox + 9.5, 5.2]], (x, y) => (y === 6 ? WING.light : WING.mid));
        L.set(ox + 4, 6, WING.hi);
      }
      glass(pc, L, 0.7, '#4a6a90');
    }
  },

  // Ojo volador: 2 cuadros de 16×12: ojo con venas, pupila hacia adelante y nervios que se mueven atrás
  eye(pc) {
    const L = layer(pc);
    const W = R5('#9a7a88', '#c8aab4', '#ead8dc', '#fbf2f0', '#ffffff');
    const RED = R5('#4a0a1a', '#7a1428', '#b02a40', '#d84a5a', '#f08a8a');
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      // Nervios que cuelgan atrás (ondulan entre cuadros)
      const wav = f ? 1 : -1;
      const nerves = [[4, 3.6, 0.9], [6, 2.2, 1], [8, 4.2, 0.8]];
      for (const [y, len, r] of nerves) {
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          const x = ox + 6 - t * (len + 2);
          const yy = y + Math.sin(t * 3.2 + (y > 5 ? 1 : 0)) * wav * 1.2;
          if (t < 0.85 || r > 0.85) L.set(Math.round(x), Math.round(yy), t < 0.4 ? RED.mid : t < 0.75 ? RED.shade : RED.deep);
        }
      }
      stamp(pc, L, 0);
      // Globo del ojo
      ball(L, ox + 10, 6, 4.8, 4.8, W);
      // Venas
      for (const [x0, y0, x1, y1] of [[6, 4, 8, 5], [6, 8, 8, 7], [8, 2, 9, 3], [8, 10, 9, 9]]) {
        over(L, ox + x0, y0, RED.mid);
        over(L, ox + x1, y1, RED.light);
      }
      // Iris (tono que se tiñe bien) y pupila con brillo
      ell(L, ox + 12, 6, 2.6, 2.7, (nx, ny) => tone(R5('#2a1048', '#4a1e80', '#7032b8', '#9a5ad8', '#c890f0'), sphereLight(nx, ny) * 0.9));
      ell(L, ox + 12.5, 6, 1.2, 1.5, '#12061c');
      L.set(ox + 11, 5, '#ffffff');
      stamp(pc, L, 0.6);
    }
  },

  // Murciélago de fuego: 3 cuadros de 18×12: alas arriba, al medio y abajo, con bordes encendidos
  firebat(pc) {
    const L = layer(pc);
    const BODY = R5('#240a0c', '#421412', '#6a2016', '#9a341a', '#d85a28');
    const MEM = R5('#2a0808', '#4a0e0e', '#701812', '#a02a14', '#e85a1a');
    const EMBER = '#ff9a30';
    const tips = [-4, 0, 3];
    for (let f = 0; f < 3; f++) {
      const ox = f * 18;
      const ty = 5 + tips[f];
      const cx = ox + 9;
      for (const s of [-1, 1]) {
        // Membrana con borde de atrás festoneado; más clara (encendida) hacia la punta
        const pts = [[cx + s * 1.5, 4], [cx + s * 5, ty - 1 + (f === 0 ? 1 : 0)], [cx + s * 8.6, ty - 0.5], [cx + s * 7.4, ty + 2.6], [cx + s * 6, ty + 1.6], [cx + s * 4.6, ty + 3.2], [cx + s * 3.2, ty + 2.2], [cx + s * 1.5, 8.5]];
        poly(L, pts, (x, y) => {
          const d = Math.abs(x + 0.5 - cx) / 8.6;
          return d > 0.62 ? MEM.light : d > 0.36 ? MEM.mid : MEM.shade;
        });
        // Huesos de los dedos (oscuros) y borde de ataque encendido
        L.line(Math.round(cx + s * 2), 5, Math.round(cx + s * 8), ty, BODY.shade);
        L.line(Math.round(cx + s * 5), Math.round((5 + ty) / 2), Math.round(cx + s * 6), ty + 1, BODY.shade);
        L.set(Math.round(cx + s * 8.6) - (s > 0 ? 1 : 0), ty - 1, '#ffd060'); // garra
        L.set(Math.round(cx + s * 7) - (s > 0 ? 1 : 0), ty, EMBER);
      }
      stamp(pc, L, 0.5, true, () => '#1a0608');
      // Cuerpo con orejas, ojos brillantes, colmillos y brasa en el pecho
      ball(L, cx, 6.5, 2.6, 3, BODY);
      L.set(cx - 2, 3, BODY.mid);
      L.set(cx - 2, 2, BODY.light);
      L.set(cx + 1, 3, BODY.mid);
      L.set(cx + 1, 2, BODY.shade);
      L.set(cx - 1, 8, EMBER);
      L.set(cx, 8, '#ffcf50');
      L.set(cx, 9, EMBER);
      L.set(cx - 1, 5, '#fff070');
      L.set(cx + 1, 5, '#fff070');
      L.set(cx, 7, '#f4e8d0');
      stamp(pc, L, 0.6, true, () => '#1a0608');
    }
  },
  // Escorpión Rey: 2 cuadros de 60×28 (cola arriba / cola atacando; también alternan al caminar)
  boss_scorpion_king(pc) {
    const L = layer(pc);
    const B = R5('#3a1606', '#7a3a0e', '#b8701c', '#e8aa38', '#fff0a0');
    const BD = R5('#200c06', '#3a1606', '#6a320c', '#8a4c12', '#a8661a'); // lo de atrás
    const HEAD = R5('#1a0804', '#3a1608', '#5e2a0e', '#8a4614', '#b86c22');
    for (let f = 0; f < 2; f++) {
      const ox = f * 60;
      // Patas: las de atrás asoman bajo el cuerpo; las de adelante bajan desde el borde del caparazón
      const legs = (R, dx, shift, kneeY) => {
        for (let k = 0; k < 4; k++) {
          const hx = ox + 19 + k * 5.5 + dx;
          const st = (k + f + shift) % 2 ? 1.5 : -1.5;
          const kx = hx + 2.5 + st * 0.5;
          capsule(L, hx, kneeY + 2, kx, kneeY, 0.95, (t, s) => side(R, s));
          capsule(L, kx, kneeY, kx - 1.5 + st - (k < 2 ? 1.5 : 0), 26.6, 0.85, (t, s) => (t > 0.85 ? R.deep : side(R, s)));
        }
      };
      legs(BD, 2.5, 1, 18);
      stamp(pc, L, 0.4);
      // Cola: tramos gruesos con juntas, curvada sobre la espalda (o lanzada al frente)
      const T = f
        ? [[18, 18], [12.5, 13.5], [12.5, 8], [17, 4], [23.5, 2.6], [30, 3.6]]
        : [[18, 18], [12, 15], [8, 10.5], [7.5, 5.5], [10.5, 2.5], [16, 2.2]];
      for (let i = 0; i < T.length - 1; i++) {
        const r = 2.9 - i * 0.22;
        capsule(L, ox + T[i][0], T[i][1], ox + T[i + 1][0], T[i + 1][1], r, (t, s) => {
          if (t > 0.88 && i < 4) return B.deep;
          return s > 0.55 ? B.hi : s > 0.15 ? B.light : s < -0.5 ? B.shade : B.mid;
        });
        stamp(pc, L, 0.55);
      }
      // Aguijón: bulbo de veneno que brilla y púa curva hacia adelante
      const [sx, sy] = T[T.length - 1];
      ball(L, ox + sx + 3, sy + 2.2, 3, 2.6, VENOM);
      over(L, ox + sx + 2, sy + 1, '#ffffff');
      stamp(pc, L, 0.6);
      const nx0 = ox + sx + 5;
      const ny0 = sy + 4;
      for (const [k, dy] of [[0, 0], [1, 1], [2, 1], [3, 2], [4, 3], [4, 4]]) L.set(nx0 + k, ny0 + dy, k < 2 ? '#d8c4a8' : '#fff8e8');
      stamp(pc, L, 0.6);
      over(pc, nx0 + 4, ny0 + 5, VENOM.light); // gota de veneno
      if (!pc.get(nx0 + 4, ny0 + 5)) pc.set(nx0 + 4, ny0 + 6, VENOM.light);
      // Cuerpo: un caparazón alargado con placas (junturas curvas) y púas en el lomo
      const P = R5('#2a0e06', '#552608', '#8a4a12', '#c48224', '#f6c858');
      ell(L, ox + 28, 18.6, 14, 5.2, (nx2, ny2, x) => {
        const u = Math.round(x - ox - 14 + ny2 * ny2 * 1.6);
        let c = tone(P, sphereLight(nx2 * 0.45, ny2), 0.92, 0.5, 0.06, -0.3);
        if (u > 0 && u < 26 && u % 5 === 0) c = P.deep; // juntura
        else if (u % 5 === 1 && c !== P.deep) c = c === P.shade ? P.mid : c === P.mid ? P.light : P.hi; // borde de la placa
        return c;
      });
      for (let k = 0; k < 5; k++) {
        const x = ox + 17 + k * 5;
        const top = 13 + (k === 0 || k === 4 ? 1 : 0);
        L.set(x, top, B.light);
        L.set(x, top - 1, B.hi);
      }
      stamp(pc, L, 0.55);
      legs(R5(P.deep, P.shade, P.mid, P.light, P.hi), 0, 0, 22);
      stamp(pc, L, 0.55);
      // Pinza: brazo, palma grande y dos dedos (el de arriba curvo); se abren al atacar
      const claw = (R, dx, dy, open) => {
        capsule(L, ox + 47 + dx, 21 + dy, ox + 51 + dx, 14 + dy, 1.7, (t, s) => side(R, s));
        stamp(pc, L, 0.5);
        const X = (v) => ox + v + dx;
        // Palma grande y dos dedos: el de arriba curvo hacia abajo, el de abajo recto (se abren al atacar)
        const PX = X(52.5);
        const PY = 10 + dy;
        poly(L, [[PX + 1, PY - 3.2], [PX + 4.5, PY - 3.6 - open * 0.7], [PX + 7.2, PY - 2 - open * 0.7], [PX + 7.2, PY - 0.9 - open * 0.5], [PX + 3, PY - 0.6]], (x, y) => (x >= PX + 6 ? R.hi : y < PY - 2.4 - open * 0.7 ? R.light : R.mid));
        poly(L, [[PX + 1.5, PY + 0.8], [PX + 6.8, PY + 0.6 + open * 0.4], [PX + 6.4, PY + 1.8 + open * 0.4], [PX + 2, PY + 3.3]], (x, y) => (x >= PX + 6 ? R.light : y > PY + 1.6 ? R.shade : R.mid));
        ell(L, PX, PY, 4.4, 3.7, (nx2, ny2) => tone(R, sphereLight(nx2, ny2), 0.8, 0.45, 0.0, -0.4));
        stamp(pc, L, 0.55);
      };
      claw(BD, -4, 2.5, f ? 2 : 0);
      // Cabeza oscura con ojos encendidos y corona
      ell(L, ox + 43.5, 17.5, 5.8, 5.2, (nx2, ny2) => tone(HEAD, sphereLight(nx2, ny2), 0.86, 0.48, 0.08, -0.3));
      L.set(ox + 48, 21, HEAD.deep); // quelíceros
      L.set(ox + 49, 21, HEAD.shade);
      L.set(ox + 49, 20, HEAD.mid);
      stamp(pc, L, 0.6);
      blit(L, ox + 39, 9, ['w.w.w', 'lwlwl', 'mlRlm', 'smrms'], { w: GOLD.hi, l: GOLD.light, m: GOLD.mid, s: GOLD.shade, R: RUBY.light, r: RUBY.mid });
      stamp(pc, L, 0.6);
      claw(B, 0, 0, f ? 3 : 1);
      // Ojos encendidos (encima de todo)
      for (const [ex, ey] of [[41, 15], [44, 15]]) {
        pc.rect(ox + ex, ey, 2, 1, '#ff4a1a');
        pc.set(ox + ex + 1, ey - 1, '#ffe080');
        pc.set(ox + ex, ey - 1, '#ff9a3a');
      }
      pc.set(ox + 39, 16, '#ff4a1a');
      pc.set(ox + 46, 17, '#ff4a1a');
    }
  },
  // Reina Avispa: 2 cuadros de 48×40 (alas arriba y abajo)
  boss_queen_wasp(pc) {
    const L = layer(pc);
    const Y = R5('#7a3a06', '#c06a0c', '#eeac1c', '#ffd84a', '#fff6b0');
    const K = R5('#0e0806', '#1a100c', '#2a1c14', '#46321e', '#62482c');
    const FUZZ = R5('#3a1606', '#6a2c0a', '#9a4c14', '#c87a2a', '#f0b05a');
    const WING = R5('#5a80b0', '#94bce0', '#c8e4f8', '#eaf6ff', '#ffffff');
    for (let f = 0; f < 2; f++) {
      const ox = f * 48;
      // Ala de atrás
      if (f === 0) poly(L, [[ox + 27, 15], [ox + 14, 4], [ox + 13, 1], [ox + 19, 0.6], [ox + 30, 12]], WING.shade);
      else poly(L, [[ox + 27, 17], [ox + 10, 19], [ox + 6, 16], [ox + 10, 13.5], [ox + 27, 14]], WING.shade);
      glass(pc, L, 0.55, '#3a5a88');
      // Patas colgando (dos tramos)
      for (let k = 0; k < 3; k++) {
        const hx = ox + 26 + k * 3.5;
        capsule(L, hx, 25, hx - 2 + k, 30, 0.9, (t, s) => side(K, s));
        capsule(L, hx - 2 + k, 30, hx - 1 + k * 1.5, 36, 0.75, (t, s) => (t > 0.8 ? Y.mid : side(K, s)));
      }
      stamp(pc, L, 0.4);
      // Abdomen: bandas curvas negras y doradas, aguijón con veneno
      const ab = { cx: 14, cy: 26, rx: 12, ry: 8.5 };
      ell(L, ox + ab.cx, ab.cy, ab.rx, ab.ry, (nx2, ny2, x) => {
        const band = Math.floor((x - ox + 2 + ny2 * ny2 * 2.5) / 4) % 2;
        const l = sphereLight(nx2, ny2);
        return tone(band ? K : Y, l, 0.86, 0.45, 0.0, -0.4);
      });
      stamp(pc, L, 0.6);
      capsule(L, ox + 3, 29, ox - 0.5, 33, 1, (t) => (t > 0.6 ? VENOM.light : K.light));
      L.set(ox, 33, '#ffffff');
      stamp(pc, L, 0.6);
      // Tórax peludo
      ell(L, ox + 29, 21, 6.8, 6.5, (nx2, ny2, x, y) => {
        const c = tone(FUZZ, sphereLight(nx2, ny2), 0.85, 0.45, 0.0, -0.4);
        return hash(x, y, 31) < 0.18 && c !== FUZZ.deep ? (c === FUZZ.light ? FUZZ.hi : FUZZ.light) : c;
      });
      stamp(pc, L, 0.55);
      // Cabeza: ojo compuesto, mandíbulas y antenas; corona encima
      ball(L, ox + 38.5, 19, 5.6, 5.4, Y);
      ell(L, ox + 39.5, 17.5, 2.8, 3.4, (nx2, ny2, x, y) => (nx2 < -0.2 && ny2 < -0.2 ? '#6a3a5a' : (x + y) % 3 === 0 ? '#3a1a2a' : '#200c18'));
      L.set(ox + 38, 16, '#e0b0d0');
      capsule(L, ox + 41, 23, ox + 45, 24.5, 1, (t, s) => (t > 0.7 ? K.light : side(K, s))); // mandíbula
      stamp(pc, L, 0.6);
      L.line(ox + 41, 13, ox + 43, 9, K.mid); // antenas
      L.line(ox + 43, 9, ox + 46, 8, K.light);
      L.line(ox + 39, 13, ox + 40, 8, K.mid);
      L.line(ox + 40, 8, ox + 42, 6, K.light);
      stamp(pc, L, 0);
      blit(L, ox + 33, 9, ['w..w..w', 'lmlRlml', 'msmrmsm'], { w: GOLD.hi, l: GOLD.light, m: GOLD.mid, s: GOLD.shade, R: RUBY.light, r: RUBY.mid });
      stamp(pc, L, 0.6);
      // Ala de adelante
      if (f === 0) {
        poly(L, [[ox + 29, 16], [ox + 20, 3], [ox + 22, 0.6], [ox + 28, 0.6], [ox + 33, 13]], (x, y) => (y < 3 ? WING.light : (x - ox) % 4 === 0 ? WING.light : WING.mid));
        L.set(ox + 22, 1, WING.hi);
      } else {
        poly(L, [[ox + 29, 18], [ox + 13, 22], [ox + 9, 20], [ox + 12, 16.5], [ox + 29, 15.5]], (x, y) => (y === 17 || x - ox === 12 ? WING.light : WING.mid));
        L.set(ox + 12, 18, WING.hi);
      }
      glass(pc, L, 0.6, '#3a5a88');
    }
  },
  // Ojo Sombrío: 2 cuadros de 48×48 (ojo / boca con dientes en la segunda fase)
  boss_shadow_eye(pc) {
    const L = layer(pc);
    const SCL = R5('#6a5478', '#9a88aa', '#c8bcd4', '#e8e2ee', '#fbf8ff'); // blanco del ojo, frío
    const TEN = R5('#140818', '#2a1036', '#46185a', '#6a2a88', '#9a50c0'); // tentáculos sombríos
    const VEIN = ['#5a0a2a', '#8a1438', '#c02a4a'];
    const IRIS = R5('#2a0a4a', '#4a1480', '#7a2ac0', '#b05aee', '#e8b0ff');
    for (let f = 0; f < 2; f++) {
      const ox = f * 48;
      // Tentáculos de sombra que ondulan atrás, con puntas que brillan
      for (let k = 0; k < 6; k++) {
        const y0 = 13 + k * 4.4;
        const len = 9 + (k % 3) * 2.5 + (f ? 1.5 : 0);
        const ph = k * 1.7 + f * 1.4;
        let px = ox + 14;
        let py = y0;
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const nx = ox + 14 - t * len;
          const ny = y0 + (y0 - 24) * 0.25 * t + Math.sin(t * 4 + ph) * 1.6 * t;
          capsule(L, px, py, nx, ny, 1.9 * (1 - t * 0.7), (tt, s) => (t > 0.85 ? TEN.hi : s > 0.4 ? TEN.light : s < -0.3 ? TEN.shade : TEN.mid));
          px = nx;
          py = ny;
        }
      }
      stamp(pc, L, 0.5);
      // Globo del ojo: más oscuro atrás (a la izquierda), con borde de sombra violeta
      ell(L, ox + 27, 24, 17, 17, (nx, ny) => {
        const l = sphereLight(nx, ny) + 0.1;
        return nx < -0.82 ? SCL.deep : tone(SCL, l, 0.92, 0.6, 0.25, -0.12);
      });
      // Venas que nacen atrás y se ramifican hacia el centro
      const veins = [[12, 18, 1, 0.25, 9], [12, 30, 1, -0.25, 9], [17, 11, 0.7, 0.7, 7], [17, 37, 0.7, -0.7, 7], [11, 24, 1, 0, 6], [21, 8, 0.4, 1, 5], [21, 40, 0.4, -1, 5]];
      veins.forEach(([x, y, dx, dy, n], i) => {
        crack(L, ox + x, y, dx, dy, n, (t) => VEIN[t < 0.35 ? 0 : t < 0.7 ? 1 : 2], i + f * 11);
        crack(L, ox + x + dx * n * 0.5, y + dy * n * 0.5, dx * 0.7, dy * 0.7 + (i % 2 ? 0.6 : -0.6), 3, VEIN[2], i + 40);
      });
      stamp(pc, L, 0.6);
      if (f === 0) {
        // Iris con estrías, anillo oscuro, pupila rasgada y brillo
        ell(L, ox + 33, 24, 9.5, 10, (nx, ny, x, y) => {
          const d = Math.sqrt(nx * nx + ny * ny);
          if (d > 0.9) return IRIS.deep;
          const a = Math.atan2(ny, nx);
          const st = hash(Math.floor((a + Math.PI) * 5), 3, 9) < 0.45;
          let l = 1 - d + (d > 0.55 ? -0.1 : 0.25) + (st ? 0.18 : 0) - (ny < 0 ? 0.08 : -0.04);
          return l > 0.85 ? IRIS.hi : l > 0.6 ? IRIS.light : l > 0.32 ? IRIS.mid : IRIS.shade;
        });
        poly(L, [[ox + 34, 15.5], [ox + 36, 24], [ox + 34, 32.5], [ox + 32, 24]], '#0a0410');
        L.set(ox + 33, 23, '#3a0a50');
        L.set(ox + 33, 25, '#3a0a50');
        L.rect(ox + 28, 18, 2, 2, '#ffffff'); // brillo
        L.set(ox + 30, 20, '#f0d8ff');
        stamp(pc, L, 0.7);
      } else {
        // Boca: cavidad con garganta encendida, encías y dos filas de colmillos
        ell(L, ox + 33, 24, 10.5, 11, (nx, ny) => {
          const d = Math.sqrt(nx * nx + ny * ny);
          return d > 0.86 ? '#6a0a24' : d > 0.7 ? '#3a0418' : d < 0.28 ? '#ff6a3a' : d < 0.45 ? '#b01a2a' : '#1a020a';
        });
        stamp(pc, L, 0.7);
        const tooth = (x, y, h, dir) => {
          for (let k = 0; k < h; k++) {
            const w = Math.max(1, Math.round((h - k) * 0.55));
            for (let i = 0; i < w; i++) L.set(x + i - Math.floor(w / 2), y + k * dir, k === h - 1 ? '#c8b89a' : i === 0 ? '#fffaf0' : '#e8dcc4');
          }
        };
        for (let k = 0; k < 6; k++) {
          const tx = ox + 26 + k * 3;
          const arc = Math.round(Math.abs(k - 2.5) * 0.9);
          tooth(tx, 15 + arc, 5 - (k === 0 || k === 5 ? 1 : 0), 1);
          tooth(tx + 1, 33 - arc, 4 - (k === 0 || k === 5 ? 1 : 0), -1);
        }
        stamp(pc, L, 0.6);
        // Grietas en el ojo partido
        crack(pc, ox + 22, 12, 0.6, 0.8, 5, '#5a3a6a', 5);
        crack(pc, ox + 23, 36, 0.6, -0.8, 5, '#5a3a6a', 6);
      }
    }
  },
  // Golem de Cristal: 2 cuadros de 56×64 (de pie, brazos arriba para golpear)
  boss_crystal_golem(pc) {
    const L = layer(pc);
    const ST = R5('#160f24', '#2a2040', '#41375c', '#5e5480', '#867ca8'); // roca violeta oscura
    const STB = R5('#0e0a18', '#160f24', '#2a2040', '#41375c', '#5e5480'); // roca de atrás
    const CR = R5('#4a1060', '#8a2aa8', '#d060e8', '#f4a4ff', '#fff0ff'); // cristal rosa
    const CORE = ['#1a6a8a', '#3ab8e0', '#8ef0ff', '#e8ffff'];
    // Bloque de roca con biseles de luz y grietas
    const rock = (x0, y0, x1, y1, R, seed, cut = 1) => {
      poly(L, [[x0 + cut, y0], [x1 - cut, y0], [x1, y0 + cut], [x1, y1 - cut], [x1 - cut, y1], [x0 + cut, y1], [x0, y1 - cut], [x0, y0 + cut]], (x, y) => {
        const top = y - y0 < 1.5;
        const left = x - x0 < 1.5;
        const right = x1 - x < 1.5;
        const bot = y1 - y < 1.5;
        if (top && !right) return R.light;
        if (left && !bot) return R.mid;
        if (right || bot) return R.shade;
        return hash(x >> 1, y >> 1, seed) < 0.12 ? R.shade : R.mid;
      });
    };
    // Racimo de cristales (puntas hacia arriba, con cara clara a la izquierda)
    const shard = (x, y, w, h, lean) => {
      poly(L, [[x - w / 2, y], [x + lean - 0.6, y - h], [x + lean + 0.6, y - h], [x + w / 2, y]], (px, py) => {
        const mid = x + (lean * (y - py)) / h;
        return px + 0.5 < mid - 0.3 ? CR.light : px + 0.5 > mid + 0.9 ? CR.shade : CR.mid;
      });
      L.set(Math.round(x + lean - 1), Math.round(y - h + 2), CR.hi);
    };
    for (let f = 0; f < 2; f++) {
      const ox = f * 56;
      const up = f === 1;
      // Brazo de atrás (izquierda) y piernas
      const arm = (sx, R, flip) => {
        const X = (v) => ox + (flip ? 56 - v : v);
        if (!up) {
          rock(Math.min(X(4), X(13)), 20, Math.max(X(4), X(13)), 40, R, 3 + sx);
          rock(Math.min(X(2), X(15)), 39, Math.max(X(2), X(15)), 51, R, 5 + sx, 2); // puño
        } else {
          rock(Math.min(X(5), X(14)), 6, Math.max(X(5), X(14)), 24, R, 3 + sx);
          rock(Math.min(X(3), X(16)), 0, Math.max(X(3), X(16)), 10, R, 5 + sx, 2);
        }
      };
      arm(0, STB, true);
      stamp(pc, L, 0.5);
      rock(ox + 15, 45, ox + 25, 63, ST, 11);
      rock(ox + 31, 45, ox + 41, 63, STB, 12);
      L.rect(ox + 14, 61, 12, 2, ST.shade); // pies
      L.rect(ox + 30, 61, 12, 2, STB.shade);
      stamp(pc, L, 0.6);
      // Torso ancho (más ancho en los hombros) y cintura
      poly(L, [[ox + 10, 19], [ox + 46, 19], [ox + 42, 40], [ox + 38, 47], [ox + 18, 47], [ox + 14, 40]], (x, y) => {
        const u = (x - ox - 28) / 18;
        if (y < 21) return u < 0.3 ? ST.light : ST.mid;
        if (y > 44) return ST.shade;
        const l = -u * 0.8 - (y - 30) / 30;
        return l > 0.45 ? ST.light : l > -0.25 ? ST.mid : l > -0.7 ? ST.shade : ST.deep;
      });
      // Placas del pecho: líneas de juntura
      for (let y = 22; y < 44; y++) {
        over(L, ox + 28, y, ST.deep);
        if (y > 34) over(L, ox + 27, y, ST.shade);
      }
      for (let x = 14; x < 43; x++) over(L, ox + x, 40 + (x > 28 ? 0 : 0), ST.deep);
      crack(L, ox + 15, 24, 1, 0.6, 6, ST.deep, 21);
      crack(L, ox + 42, 30, -1, 0.5, 5, ST.deep, 22);
      stamp(pc, L, 0.6);
      // Núcleo de cristal en el pecho: rombo que brilla con grietas de luz
      poly(L, [[ox + 28, 24], [ox + 34, 31], [ox + 28, 38], [ox + 22, 31]], (x, y) => {
        const d = Math.abs(x + 0.5 - ox - 28) / 6 + Math.abs(y + 0.5 - 31) / 7;
        return d < 0.3 ? CORE[3] : d < 0.55 ? CORE[2] : d < 0.8 ? CORE[1] : CORE[0];
      });
      stamp(pc, L, 0.7, true, () => '#0a2a3a');
      for (const [dx, dy] of [[1, -1], [-1, 1], [1, 1], [-1, -1]]) {
        for (let k = 4; k < 8; k++) over(pc, ox + 28 + dx * (k + 1), 31 + dy * k, k < 6 ? CORE[1] : CORE[0]);
      }
      // Cabeza hundida entre los hombros, con visera y ojos encendidos
      rock(ox + 21, 7, ox + 35, 20, ST, 31, 2);
      stamp(pc, L, 0.6);
      L.rect(ox + 22, 12, 12, 3, ST.deep); // visera
      L.rect(ox + 24, 13, 3, 1, CORE[2]);
      L.rect(ox + 30, 13, 3, 1, CORE[2]);
      L.set(ox + 25, 13, CORE[3]);
      L.set(ox + 31, 13, CORE[3]);
      stamp(pc, L, 0, false);
      // Corona de cristales sobre la cabeza y racimos en los hombros
      shard(ox + 25, 8, 3, 6, -1);
      shard(ox + 28.5, 8, 4, 8, 0);
      shard(ox + 32, 8, 3, 5, 1);
      stamp(pc, L, 0.6);
      // Brazo de adelante (derecha)
      arm(1, ST, false);
      stamp(pc, L, 0.6);
      shard(ox + 9, 20, 4, 9, -2);
      shard(ox + 13, 20, 4, 6, 1);
      shard(ox + 46, 20, 4, 8, 2);
      shard(ox + 43, 20, 3, 5, -1);
      // Cristales en los puños
      if (!up) {
        shard(ox + 8, 41, 3, 5, -1);
        shard(ox + 48, 41, 3, 5, 1);
      } else {
        shard(ox + 9, 1, 3, 4, 0);
        shard(ox + 47, 1, 3, 4, 0);
      }
      shard(ox + 20, 47, 3, 4, -1); // rodilla
      stamp(pc, L, 0.6);
    }
  },
  // Señor de las Llamas: 2 cuadros de 60×60 (las llamas cambian entre los dos)
  boss_flame_lord(pc) {
    const L = layer(pc);
    const RK = R5('#140608', '#2a0e0e', '#45180f', '#6a2a14', '#9a4a24'); // roca volcánica
    const HORN = R5('#3a2418', '#7a5a40', '#b89a74', '#e0ccaa', '#fff4dc');
    const LAVA = ['#c02a0a', '#ff7a1a', '#ffc040', '#fff0a0'];
    const F = FIRE;
    for (let f = 0; f < 2; f++) {
      const ox = f * 60;
      // Aura de fuego detrás: lenguas que suben alrededor del cuerpo
      const tongues = [[12, 44, 10, 26, -4], [48, 44, 10, 26, 4], [18, 30, 9, 26, -3], [42, 30, 9, 26, 3], [30, 26, 12, 26, 0], [24, 22, 7, 20, -2], [36, 22, 7, 20, 2]];
      tongues.forEach(([x, y, w, h, lean], i) => {
        const fl = f ? (i % 2 ? 2 : -2) : 0;
        flame(L, ox + x, y, w, h + fl, lean + (f ? (i % 2 ? -1 : 1) : 0), F, i * 1.3 + f * 2);
      });
      // Cola de fuego abajo (el cuerpo no tiene piernas)
      poly(L, [[ox + 19, 42], [ox + 41, 42], [ox + 34, 52], [ox + 31 + (f ? 2 : -2), 59], [ox + 26, 52]], (x, y) => {
        const d = Math.abs(x + 0.5 - ox - 30) / 10;
        const t = (y - 42) / 17;
        const heat = (1 - d) * (1 - t * 0.6);
        return heat > 0.75 ? F[4] : heat > 0.5 ? F[3] : heat > 0.3 ? F[2] : F[1];
      });
      stamp(pc, L, 0, true, () => '#3a0604');
      // Brazos de roca con garras que sostienen bolas de fuego
      for (const s of [-1, 1]) {
        const sx = ox + 30 + s * 13;
        const hx = ox + 30 + s * 21;
        capsule(L, sx, 28, hx, 34, 3.2, (t, sd) => side(RK, s < 0 ? sd : sd - 0.3));
        capsule(L, hx, 34, hx + s * 1, 41, 2.8, (t, sd) => side(RK, sd));
      }
      stamp(pc, L, 0.6);
      // Torso de roca: pecho ancho, grietas de lava y un corazón encendido
      ell(L, ox + 30, 34, 13, 10, (nx, ny, x, y) => {
        let c = tone(RK, sphereLight(nx, ny), 0.9, 0.55, 0.12, -0.3);
        if (ny > 0.6) c = RK.deep;
        return c;
      });
      stamp(pc, L, 0.6);
      for (const [x, y, dx, dy, n, sd] of [[24, 30, -0.8, 0.6, 7, 1], [36, 30, 0.8, 0.6, 7, 2], [30, 37, 0, 1, 5, 3], [27, 34, -0.7, 1, 5, 4], [33, 34, 0.7, 1, 5, 5]]) {
        crack(L, ox + x, y, dx, dy, n, (t) => LAVA[t < 0.3 ? 2 : t < 0.7 ? 1 : 0], sd + f * 7);
      }
      ell(L, ox + 30, 33, 3.2, 3.2, (nx, ny) => {
        const d = Math.sqrt(nx * nx + ny * ny);
        return d < 0.35 ? LAVA[3] : d < 0.7 ? LAVA[2] : LAVA[1];
      });
      stamp(pc, L, 0.7, true, () => '#5a0e04');
      // Hombreras de roca con púas
      for (const s of [-1, 1]) {
        ell(L, ox + 30 + s * 13, 27, 5.5, 4.5, (nx, ny) => tone(RK, sphereLight(nx, ny), 0.8, 0.45, 0.05, -0.35));
        poly(L, [[ox + 30 + s * 11, 24], [ox + 30 + s * 16.5, 17], [ox + 30 + s * 16, 24]], (x) => (s < 0 ? HORN.light : HORN.mid));
      }
      stamp(pc, L, 0.6);
      // Garras y bolas de fuego en las manos
      for (const s of [-1, 1]) {
        const hx = ox + 30 + s * 22;
        ell(L, hx, 41, 3.6, 3.4, (nx, ny) => {
          const d = Math.sqrt(nx * nx + ny * ny);
          return d < 0.4 ? F[4] : d < 0.7 ? F[3] : F[2];
        });
        flame(L, hx, 39, 5, 8 + (f ? 2 : 0), s * -1, F, s + f);
        stamp(pc, L, 0, true, () => '#5a0e04');
        for (let k = -1; k <= 1; k++) {
          L.set(hx + k * 2, 44, HORN.mid); // garras
          L.set(hx + k * 2, 45, HORN.shade);
        }
        stamp(pc, L, 0.6);
      }
      // Cabeza: cráneo de roca con cuernos curvos, ojos y boca encendidos
      for (const s of [-1, 1]) {
        const pts = [[30 + s * 5, 14], [30 + s * 10, 11], [30 + s * 14, 6], [30 + s * 15.5, 1.5], [30 + s * 17, 0.5]];
        for (let i = 0; i < pts.length - 1; i++) {
          capsule(L, ox + pts[i][0], pts[i][1], ox + pts[i + 1][0], pts[i + 1][1], 2.6 - i * 0.55, (t, sd) => (i >= 3 ? HORN.hi : side(HORN, s < 0 ? sd : sd - 0.2)));
        }
        L.set(ox + 30 + s * 10, 12, HORN.shade); // anillos del cuerno
        L.set(ox + 30 + s * 13, 8, HORN.shade);
      }
      stamp(pc, L, 0.6);
      ell(L, ox + 30, 15, 8, 9, (nx, ny) => tone(RK, sphereLight(nx, ny), 0.82, 0.5, 0.1, -0.35));
      poly(L, [[ox + 24, 19], [ox + 36, 19], [ox + 34, 25], [ox + 26, 25]], (x, y) => (y > 23 ? RK.shade : RK.mid)); // mandíbula
      stamp(pc, L, 0.6);
      // Ceño, ojos rasgados y boca con colmillos
      L.rect(ox + 24, 12, 5, 1, RK.deep);
      L.rect(ox + 32, 12, 5, 1, RK.deep);
      blit(L, ox + 24, 13, ['wyyo.', '.ooo.'], { w: '#fff8c0', y: '#ffd040', o: '#ff8a1a' });
      blit(L, ox + 32, 13, ['.oyyw', '.ooo.'], { w: '#fff8c0', y: '#ffd040', o: '#ff8a1a' });
      L.rect(ox + 26, 20, 9, 3 + f, '#2a0402');
      L.rect(ox + 27, 21, 7, 1 + f, LAVA[1]);
      L.set(ox + 30, 21, LAVA[2]);
      for (const x of [26, 28, 32, 34]) L.set(ox + x, 20, '#f4e8d0');
      L.set(ox + 27, 22 + f, '#e8dcc0');
      L.set(ox + 33, 22 + f, '#e8dcc0');
      // Grietas de lava en la frente y corona de fuego entre los cuernos
      crack(L, ox + 30, 8, 0, 1, 3, LAVA[1], 9 + f);
      stamp(pc, L, 0, false);
      flame(L, ox + 30, 8, 7, 9 + (f ? 2 : 0), f ? 1 : -1, F, 3 + f);
      flame(L, ox + 26, 8, 4, 5 + (f ? 0 : 2), -1, F, 5);
      flame(L, ox + 34, 8, 4, 5 + (f ? 2 : 0), 1, F, 6);
      stamp(pc, L, 0, true, () => '#5a0e04');
    }
  },
  // Proyectiles de los jefes: 4 cuadros de 8×8 que apuntan a la derecha (el juego los gira hacia donde van):
  // aguijón, orbe sombrío, astilla de cristal, bola de fuego
  proj_boss(pc) {
    const L = layer(pc);
    // Aguijón: púa de quitina con punta de veneno
    poly(L, [[0, 3], [5, 3], [8, 4], [5, 5], [0, 5]], (x, y) => (x >= 5 ? (x === 7 ? '#fbe0ff' : VENOM.light) : y === 3 ? '#8a5a2a' : '#4a2a14'));
    L.set(1, 2, '#4a2a14'); // aletas
    L.set(1, 5, '#2a160a');
    L.set(6, 4, '#ffffff');
    stamp(pc, L, 0.6);
    // Orbe sombrío: núcleo oscuro con anillo violeta brillante y estela a la izquierda
    ell(L, 12, 4, 3.4, 3.4, (nx, ny) => {
      const d = Math.sqrt(nx * nx + ny * ny);
      return d > 0.75 ? '#b070ff' : d > 0.5 ? '#6a2ab0' : nx < -0.1 && ny < -0.1 ? '#3a1060' : '#140620';
    });
    L.set(9, 2, '#e0b0ff');
    L.set(8, 5, '#6a2ab0');
    stamp(pc, L, 0.6, true, () => '#1a0628');
    pc.set(11, 3, '#f0d8ff');
    // Astilla de cristal: rombo alargado con cara clara arriba
    poly(L, [[16.2, 4], [19, 2], [24, 4], [19, 6]], (x, y) => (y < 4 ? (x > 21 ? '#ffffff' : '#f4a4ff') : x > 21 ? '#d060e8' : '#8a2aa8'));
    stamp(pc, L, 0.6, true, () => '#3a0a50');
    // Bola de fuego: cabeza clara a la derecha y estela roja
    poly(L, [[24.5, 4], [28, 1.8], [31, 2.5], [31, 5.5], [28, 6.2]], (x, y) => {
      const d = Math.abs(x + 0.5 - 29) / 3 + Math.abs(y + 0.5 - 4) / 3.5;
      return x < 27 ? FIRE[1] : d < 0.45 ? FIRE[4] : d < 0.75 ? FIRE[3] : FIRE[2];
    });
    stamp(pc, L, 0.6, true, () => '#5a0e04');
  },
};

export const CTX = {
  // Bola de fuego del poder (se dibuja con mezcla aditiva y gira): halo suave y un remolino de llamas en pixel art
  fireball(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,200,90,0.55)');
    g.addColorStop(0.6, 'rgba(240,90,20,0.25)');
    g.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const pc = new PixelCanvas(w / 2, h / 2);
    const c = w / 4;
    for (let y = 0; y < pc.h; y++) {
      for (let x = 0; x < pc.w; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const r = Math.sqrt(dx * dx + dy * dy);
        const a = Math.atan2(dy, dx) + r * 0.32; // remolino
        const R = c * 0.55 + c * 0.32 * Math.max(0, Math.sin(a * 3));
        if (r > R) continue;
        const t = r / R;
        pc.set(x, y, r < c * 0.22 ? FIRE[4] : t < 0.5 ? FIRE[3] : t < 0.78 ? FIRE[2] : FIRE[1]);
      }
    }
    pc.draw(ctx, 0, 0, 2);
  },
};
