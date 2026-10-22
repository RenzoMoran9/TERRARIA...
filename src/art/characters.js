// Arte mejorado: characters. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Jugador, aldeanos y sus cabezas del mapa. Cada pose se arma por partes (brazo y pierna de atrás, piernas,
// torso, cabeza, brazo de adelante); cada parte lleva su propio contorno de color, así las partes que se
// superponen quedan separadas por una línea fina. Luz desde arriba a la izquierda; sombras más frías y
// saturadas, brillos más cálidos. Respeta las poses (y las manos) de player/animations.js.
import { PixelCanvas } from '../systems/PixelArt.js';
import { POSES, SHEET_COLS, ART_W, ART_H } from '../player/animations.js';

// ---------------------------------------------------------------- color
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const HSL = new Map();
function toHsl(c) {
  let v = HSL.get(c);
  if (v) return v;
  const n = parseInt(c.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 225; // los grises se tiñen de azul frío al oscurecerlos
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = 60 * (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
  }
  v = [h, s, l];
  HSL.set(c, v);
  return v;
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
const MEMO = new Map();
const memo = (key, fn) => {
  let v = MEMO.get(key);
  if (v === undefined) MEMO.set(key, (v = fn()));
  return v;
};
/** Sombra: más oscura, más saturada y con el matiz hacia el azul violeta. */
function darker(c, k = 0.1) {
  return memo(`d${c}${k}`, () => {
    const [h, s, l] = toHsl(c);
    return fromHsl(towards(h, 245, k * 110), s + k * (s > 0.06 ? 0.6 : 0.25), l - k);
  });
}
/** Brillo: más claro y con el matiz hacia el amarillo. */
function lighter(c, k = 0.1) {
  return memo(`l${c}${k}`, () => {
    const [h, s, l] = toHsl(c);
    return fromHsl(towards(h, 52, k * 90), s - k * 0.1, l + k);
  });
}
/** Contorno: el color muy oscuro, algo saturado y frío (nunca negro puro). */
function ink(c) {
  return memo(`i${c}`, () => {
    const [h, s, l] = toHsl(c);
    return fromHsl(towards(h, 250, 22), Math.min(0.85, s * 0.7 + 0.22), Math.min(0.15, l * 0.3 + 0.045));
  });
}
function mix(a, b, t) {
  return memo(`m${a}${b}${t}`, () => {
    const x = parseInt(a.slice(1), 16);
    const y = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  });
}
// Rampa de 5 tonos [hondo, sombra, medio, luz, brillo] a partir de los colores dados
const ramp = (mid, shade = darker(mid, 0.12), light = lighter(mid, 0.1)) =>
  memo(`r${mid}${shade}${light}`, () => ({ deep: darker(shade, 0.1), shade, mid, light, hi: lighter(light, 0.1) }));
// La misma rampa un paso más oscura (para lo que queda atrás)
const back = (R) => memo(`b${R.mid}${R.shade}`, () => ({ deep: darker(R.deep, 0.06), shade: R.deep, mid: R.shade, light: mix(R.shade, R.mid, 0.5), hi: R.mid }));

// ---------------------------------------------------------------- capas
// Cada parte se pinta en su propia capa del tamaño del cuadro y se "estampa" con contorno.
const LAYER = new PixelCanvas(ART_W, ART_H);
const clear = () => LAYER.px.fill(null);
// Estampa la capa en el cuadro: copia los píxeles y agrega el contorno de color. Donde el contorno cae
// sobre otra parte ya pintada queda una línea interior más suave (mezcla con lo de abajo).
function stamp(F, inner = 0.62) {
  const L = LAYER;
  const { w, h, px } = L;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = px[i];
      if (c) {
        F.px[i] = c;
        continue;
      }
      const n = (y > 0 && px[i - w]) || (x > 0 && px[i - 1]) || (x < w - 1 && px[i + 1]) || (y < h - 1 && px[i + w]);
      if (!n) continue;
      const under = F.px[i];
      F.px[i] = under ? mix(under, ink(n), inner) : ink(n);
    }
  }
  clear();
}
const put = (x, y, c) => LAYER.set(x, y, c);
// Dibuja una plantilla de texto (un carácter por píxel, '.' = vacío) con un mapa carácter → color
function blit(x0, y0, rows, map) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = map[row[c]];
      if (col) put(x0 + c, y0 + r, col);
    }
  }
}
// Cápsula (miembro) de (x0,y0) a (x1,y1) con radio r. paint(t, luz) → color; t = 0..1 a lo largo,
// luz = -1..1 según de qué lado del miembro cae el píxel (luz arriba a la izquierda).
function capsule(x0, y0, x1, y1, r, paint) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const r2 = r * r;
  for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      const ex = x - (x0 + dx * t);
      const ey = y - (y0 + dy * t);
      if (ex * ex + ey * ey > r2) continue;
      put(x, y, paint(t, (-(ex + ey) * 0.7071) / r, x, y));
    }
  }
}
const lit = (R, s) => (s > 0.35 ? R.light : s < -0.35 ? R.shade : R.mid);

// ---------------------------------------------------------------- materiales de la armadura
// Se reconoce el set por su color (ver ARMOR_SETS en systems/items.js) para darle su textura.
const MATERIAL = {
  '#8a5a2b': 'wood', '#9a6a35': 'wood', '#7a4f22': 'wood',
  '#3e7a2e': 'cactus', '#4f8a3a': 'cactus', '#3e6a2c': 'cactus',
  '#8a9098': 'metal', '#9aa2aa': 'metal', '#7a8088': 'metal',
  '#d8a820': 'metal', '#e0b030': 'metal', '#c89820': 'metal',
  '#b8301a': 'hell', '#c83a1a': 'hell', '#9a2a14': 'hell',
  '#c47ad8': 'crystal', '#d890f0': 'crystal', '#b070d0': 'crystal',
};
const material = (c) => MATERIAL[c] || 'metal';

// ---------------------------------------------------------------- colores
const PLAYER = {
  skin: '#f2c18d',
  skinShade: '#d49b62',
  mouth: '#b9754e',
  hair: '#5a3412',
  hairLight: '#7d4b1e',
  eyeWhite: '#ffffff',
  eye: '#2a3a8a',
  shirt: '#3d7fd9',
  shirtShade: '#2b5ea8',
  shirtLight: '#6aa0ea',
  belt: '#4a3420',
  buckle: '#e0c060',
  pants: '#41416a',
  pantsShade: '#2d2d4d',
  boots: '#6b4423',
  bootsShade: '#4a2d16',
};

// Paleta completa de un personaje a partir de sus colores base
function palette(C) {
  const skin = { deep: mix(C.skinShade, '#6a3040', 0.35), shade: C.skinShade, mid: C.skin, light: lighter(C.skin, 0.05), hi: lighter(C.skin, 0.1) };
  const hair = { deep: darker(C.hair, 0.09), shade: mix(C.hair, darker(C.hair, 0.09), 0.45), mid: C.hair, light: C.hairLight, hi: lighter(C.hairLight, 0.1) };
  const shirt = ramp(C.shirt, C.shirtShade, C.shirtLight);
  const pants = ramp(C.pants, C.pantsShade, lighter(C.pants, 0.08));
  const boots = ramp(C.boots, C.bootsShade, lighter(C.boots, 0.1));
  const belt = ramp(C.belt, darker(C.belt, 0.07), lighter(C.belt, 0.1));
  return { skin, hair, shirt, pants, boots, belt, buckle: C.buckle, buckleShade: darker(C.buckle, 0.16), eye: C.eye, eyeWhite: C.eyeWhite, mouth: C.mouth, lash: darker(C.hair, 0.12) };
}

// ---------------------------------------------------------------- cabeza
// Plantillas de 13 columnas desde x = cabeza + 6 (la cara mira a la derecha), fila 0 = arriba del pelo.
// d/H/L/W = pelo hondo/medio/luz/brillo, h = pelo sombra; S/s/x/k = piel media/sombra/honda/luz; e = oreja
const HAIR = {
  // Héroe: pelo revuelto con flequillo que cae sobre la frente
  hero: [
    '...dhHHHhd...',
    '..dHLLWLHhd..',
    '.dHLWWLHLLHd.',
    'dHLLHHhHLHhd.',
    '.dHhdHdShHhd.',
    'dHhHdsSSSsS..',
    '.dHdeSSSSSS..',
    '..dheSSSSSs..',
    '..ddsSSSSSs..',
    '...dsSSSSSs..',
    '....xsssss...',
  ],
  // Guía: pelo prolijo con raya al costado
  guide: [
    '...dhHHHd....',
    '..dHLLWLHd...',
    '.dHLWLLHHHd..',
    '.dHLLHHHHHHd.',
    '.dHHhdsssHd..',
    '.dHHdSSSSSS..',
    '.ddHeSSSSSS..',
    '..dheSSSSSs..',
    '..ddsSSSSSs..',
    '...dsSSSSSs..',
    '....xsssss...',
  ],
  // Enfermera: pelo largo que cae por la espalda (más filas)
  long: [
    '...dhHHHd....',
    '..dHLLWLHd...',
    '.dHLWWLHHHd..',
    '.dHLLHHHHHHd.',
    'dHHHHdHsHHd..',
    'dHLHdSsSSsS..',
    'dHLHeSSSSSS..',
    'dHLhekSSSSs..',
    'dHHhsSSSSSs..',
    'dHHdsSSSSSs..',
    '.dHhxsssss...',
    '.dhd.........',
  ],
  // Comerciante: canoso y corto (el sombrero tapa el resto)
  short: [
    '.............',
    '...dHHHHd....',
    '..dHLWLHHd...',
    '.dHLLHHHHd...',
    '.dHHdSSSSSs..',
    '.dHHdSSSSSS..',
    '.ddHeSSSSSS..',
    '..dheSSSSSs..',
    '..ddsSSSSSs..',
    '...dsSSSSSs..',
    '....xsssss...',
  ],
  // Casco (pieza de armadura): o/n/m/l/w = metal hondo/sombra/medio/luz/brillo, r = remache, v = nasal
  helmet: [
    '...onmmmo....',
    '..omlwwlmno..',
    '.omlwwllmmno.',
    '.mlllllllllvo',
    'ommrmmmrmmmmo',
    '.oonnoSSSSvo.',
    '.ommnoSSSSv..',
    '.omlnosSSSs..',
    '.omnnosSSSs..',
    '..oonoxSSSs..',
    '.....xssss...',
  ],
};

function drawHead(x0, y0, pal, P, style) {
  const H = pal.hair;
  const S = pal.skin;
  const helmet = style.helmet;
  const rows = HAIR[helmet ? 'helmet' : style.hair || 'hero'];
  const map = { d: H.deep, h: H.shade, H: H.mid, L: H.light, W: H.hi, S: S.mid, s: S.shade, x: S.deep, k: S.light, e: S.shade };
  if (helmet) Object.assign(map, helmetMap(pal, style.helmet));
  blit(x0 + 6, y0, rows, map);
  if (helmet) helmetDetail(x0, y0, pal, style.helmet);
  face(x0, y0, pal, P, !!helmet);
  style.headExtra?.(x0, y0, pal, P);
}

// Ojos y boca (las mismas expresiones que player/animations.js)
function face(hx, hy, pal, P, noBrow) {
  const lash = pal.lash;
  const S = pal.skin;
  const p = (x, y, c) => put(hx + x, hy + y, c);
  const iris = pal.eye;
  const irisDark = darker(pal.eye, 0.1);
  switch (P.eyes || 'open') {
    case 'closed':
      p(13, 6, lash);
      p(14, 6, lash);
      p(13, 5, S.shade);
      p(14, 5, S.shade);
      break;
    case 'happy':
      p(13, 6, lash);
      p(14, 5, lash);
      p(15, 6, lash);
      p(15, 7, '#f0967a'); // mejilla
      break;
    case 'wide':
      for (const y of [4, 5, 6]) p(13, y, pal.eyeWhite);
      p(14, 4, pal.eyeWhite);
      p(14, 5, iris);
      p(14, 6, pal.eyeWhite);
      p(15, 5, lash);
      break;
    case 'back':
      p(14, 5, pal.eyeWhite);
      p(14, 6, pal.eyeWhite);
      p(13, 5, iris);
      p(13, 6, irisDark);
      p(13, 4, lash);
      break;
    case 'hurt':
      p(13, 4, lash);
      p(14, 5, lash);
      p(13, 6, lash);
      break;
    case 'sleepy':
      p(13, 5, lash);
      p(14, 5, lash);
      p(13, 6, pal.eyeWhite);
      p(14, 6, irisDark);
      break;
    default:
      p(13, 5, pal.eyeWhite);
      p(13, 6, pal.eyeWhite);
      p(14, 5, iris);
      p(14, 6, irisDark);
      if (!noBrow) {
        p(13, 4, lash); // ceja
        p(14, 4, lash);
      }
  }
  const inside = '#6a2028';
  const m = pal.mouth;
  switch (P.mouth || 'line') {
    case 'smile':
      p(13, 8, m);
      p(14, 9, m);
      p(15, 9, m);
      p(16, 8, m);
      break;
    case 'open':
      p(14, 8, inside);
      p(15, 8, inside);
      p(14, 9, '#c0505a');
      p(15, 9, inside);
      break;
    case 'frown':
      p(14, 8, m);
      p(15, 8, m);
      p(13, 9, m);
      break;
    case 'o':
      p(15, 8, inside);
      p(15, 9, inside);
      break;
    case 'yawn':
      p(14, 7, inside);
      p(15, 7, inside);
      p(14, 8, inside);
      p(15, 8, '#c0505a');
      p(14, 9, inside);
      p(15, 9, inside);
      break;
    default:
      p(14, 8, m);
      p(15, 8, m);
  }
}

// Rampa del metal del casco (más contraste que la del pelo)
const helmetRamp = (pal) => ramp(pal.hair.mid, darker(pal.hair.mid, 0.12), pal.hair.light);
function helmetMap(pal, mat) {
  const M = helmetRamp(pal);
  const wood = mat === 'wood';
  return { o: M.deep, n: M.shade, m: M.mid, l: M.light, w: wood ? M.light : M.hi, r: wood ? M.deep : M.hi, v: M.shade };
}
// Detalles del casco según el material: vetas, espinas, cuernos, facetas
function helmetDetail(hx, hy, pal, mat) {
  const M = helmetRamp(pal);
  const p = (x, y, c) => put(hx + x, hy + y, c);
  if (mat === 'metal') {
    p(9, -1, M.mid); // cresta
    p(10, -1, M.light);
    p(11, -1, M.mid);
  } else if (mat === 'wood') {
    p(11, 1, M.shade); // vetas
    p(12, 1, M.shade);
    p(9, 2, M.shade);
    p(10, 2, M.shade);
    p(14, 2, M.shade);
    p(15, 3, M.deep);
  } else if (mat === 'cactus') {
    p(10, -1, M.hi); // espinas que asoman
    p(14, 0, M.hi);
    p(6, 2, M.hi);
    p(12, 1, M.hi);
    p(16, 2, M.hi);
    p(9, 2, M.shade);
  } else if (mat === 'hell') {
    // cuernos hacia atrás y vetas de brasa
    p(7, 1, '#3a1410');
    p(6, 0, '#3a1410');
    p(5, 0, '#ffb040');
    p(9, 0, '#3a1410');
    p(9, -1, '#ffb040');
    p(12, 2, '#ffd060');
    p(13, 2, '#ff8a30');
    p(8, 6, '#ff8a30');
  } else if (mat === 'crystal') {
    p(10, -1, M.light); // facetas y destellos
    p(11, -1, '#ffffff');
    p(11, 1, '#ffffff');
    p(13, 2, M.shade);
    p(14, 1, M.shade);
    p(12, 3, '#ffffff');
  }
}

// ---------------------------------------------------------------- torso
// Pechera (x 8..15 del cuadro, filas desde el hombro)
const CHEST = [
  '.lloolm.',
  'lwwlmmnn',
  'lwlmmmno',
  'llmmmnno',
  'mooooooo',
  'llllllmn',
  'mmmmnnno',
  'nnnnnnoo',
];
// Detalles por material: [x, y, tono de la rampa o color]
const CHEST_DETAIL = {
  metal: [[9, 5, 'hi'], [14, 5, 'hi'], [13, 2, 'light']],
  hell: [[12, 2, '#ffd060'], [13, 3, '#ff8a30'], [9, 5, 'light']],
  wood: [[10, 2, 'shade'], [11, 2, 'shade'], [12, 3, 'shade'], [10, 6, 'deep'], [13, 5, 'shade']],
  cactus: [[11, 1, 'hi'], [13, 2, 'hi'], [10, 3, 'hi'], [12, 6, 'hi'], [9, 7, 'hi']],
  crystal: [[10, 1, '#ffffff'], [11, 2, 'hi'], [13, 1, 'shade'], [12, 3, 'light'], [10, 6, '#ffffff']],
};
function drawTorso(ux, top, pal, style) {
  const R = pal.shirt;
  const armor = style.chest;
  const p = (x, y, c) => put(ux + x, top + y, c);
  // Volumen: hombros con luz, borde de atrás iluminado, frente y bajo el pecho en sombra
  for (let r = 0; r < 8; r++) {
    const x0 = r === 0 ? 9 : 8;
    const x1 = r === 0 ? 14 : 15;
    for (let x = x0; x <= x1; x++) {
      let c = R.mid;
      if (r === 0 || (r === 1 && x < 12)) c = R.light;
      else if (x === x0) c = r < 6 ? R.light : R.mid;
      else if (x === x1) c = r < 2 ? R.mid : R.shade;
      else if (r >= 6) c = x >= 12 ? R.shade : R.mid;
      p(x, r, c);
    }
  }
  if (armor) {
    // Pechera: placa del pecho con reflejo, borde inferior hondo y una lama debajo
    const wood = armor === 'wood';
    blit(ux + 8, top, CHEST, { o: R.deep, n: R.shade, m: R.mid, l: R.light, w: wood ? R.light : R.hi });
    const d = CHEST_DETAIL[armor];
    for (const [x, y, k] of d) p(x, y, k[0] === '#' ? k : R[k]);
  } else {
    // Camisa: escote en V con ribete, costura del hombro y un pliegue suave bajo el brazo
    p(11, 0, pal.skin.mid);
    p(12, 0, pal.skin.shade);
    p(11, 1, pal.skin.shade);
    p(10, 0, R.hi);
    p(13, 0, R.hi);
    p(12, 1, R.hi);
    p(10, 1, R.hi);
    p(9, 5, R.shade); // pliegue hacia el cinturón
    p(10, 6, R.shade);
    p(9, 6, R.light);
  }
  // Cinturón con hebilla
  const B = pal.belt;
  for (let x = 8; x <= 15; x++) p(x, 8, x === 8 ? B.light : x >= 14 ? B.shade : B.mid);
  p(9, 8, B.light);
  p(12, 8, pal.buckleShade);
  p(13, 8, pal.buckle);
  // Faldón de la camisa (o de la pechera) con pliegues
  for (let x = 8; x <= 15; x++) p(x, 9, x === 8 ? R.mid : x === 11 || x === 14 ? R.deep : R.shade);
  style.torsoExtra?.(ux, top, pal);
}

// ---------------------------------------------------------------- piernas y brazos
function drawLeg(hipX, hipY, fx, foot, knee, pants, boots, style) {
  const ax = fx + 1;
  const ay = foot - 4;
  const paint = (t, s) => lit(pants, s);
  let kx;
  let ky;
  if (knee) [kx, ky] = knee;
  else if (foot < 31) {
    // pie levantado: la rodilla se dobla hacia adelante
    kx = Math.round((hipX + ax) / 2 + (31 - foot) * 0.9);
    ky = Math.round((hipY + ay) / 2);
  }
  if (kx !== undefined) {
    capsule(hipX, hipY, kx, ky, 1.15, paint);
    capsule(kx, ky, ax, ay, 1.1, paint);
  } else capsule(hipX, hipY, ax, ay, 1.15, paint);
  if (style.greaves) {
    // rodillera
    const gx = kx !== undefined ? kx : Math.round((hipX + ax) / 2);
    const gy = ky !== undefined ? ky : Math.round((hipY + ay) / 2) + 1;
    put(gx - 1, gy, pants.light);
    put(gx, gy, pants.hi);
    put(gx, gy + 1, pants.mid);
  }
  // Bota: caña con doblez, empeine con punta y suela
  const B = boots;
  put(fx, foot - 3, B.light);
  put(fx + 1, foot - 3, B.light);
  put(fx + 2, foot - 3, B.mid);
  put(fx, foot - 2, B.shade);
  put(fx + 1, foot - 2, B.mid);
  put(fx + 2, foot - 2, B.mid);
  put(fx, foot - 1, B.shade);
  put(fx + 1, foot - 1, B.mid);
  put(fx + 2, foot - 1, B.light);
  put(fx + 3, foot - 1, B.mid);
  for (let x = 0; x < 4; x++) put(fx + x, foot, B.deep);
  if (style.greaves) put(fx + 3, foot - 1, B.hi);
}

function drawArm(sx, sy, hx, hy, shirt, skin, style, front) {
  // Manga larga hasta la muñeca, con puño claro; la piel apenas asoma antes de la mano.
  // Con pechera: manga de malla (más oscura y tramada) con brazal claro y hombrera de placa.
  const armor = style.chest;
  const sleeve = armor ? back(shirt) : shirt;
  const mail = armor === 'metal' || armor === 'hell';
  const len = Math.max(1, Math.hypot(hx + 1 - sx, hy - sy));
  const cut = 1 - 1.6 / len;
  const cuff = cut - (armor ? 1.6 : 1) / len;
  capsule(sx, sy, hx + 1, hy, 1.1, (t, s, x, y) => {
    if (t < cuff) return mail && (x + y) % 2 && s > -0.35 ? sleeve.light : lit(sleeve, s);
    if (t < cut) return armor ? (s > -0.35 ? shirt.light : shirt.shade) : s > -0.35 ? shirt.light : shirt.mid;
    return s < -0.35 ? skin.shade : skin.mid;
  });
  if (armor && front) {
    // Hombrera: placa redonda sobre el hombro, con brillo arriba a la izquierda y borde hondo abajo
    const H = shirt;
    const rows = [
      [-1, [H.light, H.hi, H.light]],
      [-2, [H.light, H.hi, H.light, H.mid, H.shade]],
      [-2, [H.mid, H.light, H.mid, H.shade, H.deep]],
      [-1, [H.deep, H.deep, H.deep]],
    ];
    rows.forEach(([x0, cs], k) => cs.forEach((c, i) => put(sx + x0 + i, sy - 1 + k, c)));
    if (mail) put(sx + 1, sy, H.hi); // remache
  }
  // Puño (3×2) con nudillo iluminado
  put(hx, hy, skin.light);
  put(hx + 1, hy, skin.mid);
  put(hx + 2, hy, skin.mid);
  put(hx, hy + 1, skin.mid);
  put(hx + 1, hy + 1, skin.mid);
  put(hx + 2, hy + 1, skin.shade);
}

// ---------------------------------------------------------------- pose completa
// Arma la pose P (ver player/animations.js) en un cuadro F de 24×32
function drawFigure(F, P, pal, style) {
  const bob = P.bob || 0;
  const lean = P.lean || 0;
  const lift = P.lift || 0;
  const Y = (y) => y - lift;
  const hip = 22 + bob;
  const shoulder = 14 + bob;
  const ux = lean;
  const hipShift = P.sit ? lean : Math.round(lean / 2);
  const fl = { dx: 0, foot: 31, ...(P.frontLeg || {}) };
  const bl = { dx: 0, foot: 31, ...(P.backLeg || {}) };
  const front = P.front || [12, 22];
  const backH = P.back || [9, 22];
  const raised = front[1] < 11;
  const hand = (h) => [h[0] + lean, Y(h[1] + bob)];
  const kneeOf = (L) => L.knee && [L.knee[0], Y(L.knee[1] + bob) + 1];
  const shirt = pal.shirt;
  const pants = pal.pants;
  const boots = pal.boots;
  const leg = (hipX, L, R, B) => drawLeg(hipX + hipShift + 1, Y(hip), hipX + L.dx, Y(L.foot), kneeOf(L), R, B, style);

  // Brazo y pierna de atrás (un tono más oscuros)
  const [bx, by] = hand(backH);
  drawArm(ux + 10, Y(shoulder), bx, by, back(shirt), back(pal.skin), style, false);
  stamp(F);
  leg(9, bl, back(pants), back(boots));
  stamp(F);
  leg(12, fl, pants, boots);
  stamp(F);
  // Torso (con cuello)
  const hx = ux + (P.headDx || 0);
  const hy = Y(1 + bob + (P.headDy || 0));
  put(hx + 10, hy + 11, pal.skin.shade);
  put(hx + 11, hy + 11, pal.skin.shade);
  put(hx + 12, hy + 11, pal.skin.shade);
  drawTorso(ux, Y(13 + bob), pal, style);
  stamp(F);
  const [fx, fy] = hand(front);
  if (raised) {
    drawArm(ux + 13, Y(shoulder), fx, fy, shirt, pal.skin, style, true);
    stamp(F);
  }
  drawHead(hx, hy, pal, P, style);
  stamp(F);
  if (!raised) {
    drawArm(ux + 13, Y(shoulder), fx, fy, shirt, pal.skin, style, true);
    stamp(F, 0.72); // línea más marcada donde el brazo tapa el cuerpo
  }
}

// Pinta una lista de poses en fila (o en hoja de cols columnas)
function drawSheet(pc, poses, C, style, cols = poses.length) {
  const pal = palette(C);
  const F = new PixelCanvas(ART_W, ART_H);
  poses.forEach((pose, i) => {
    F.px.fill(null);
    drawFigure(F, pose, pal, style);
    const ox = (i % cols) * ART_W;
    const oy = Math.floor(i / cols) * ART_H;
    for (let y = 0; y < ART_H; y++) {
      for (let x = 0; x < ART_W; x++) {
        const c = F.px[y * ART_W + x];
        if (c) pc.set(ox + x, oy + y, c);
      }
    }
  });
}

// Aldeanos: quieto, caminar ×4 y hablando (ver systems/Npcs.js)
const npcPoses = () => [POSES[0], POSES[3], POSES[5], POSES[7], POSES[9], { name: 'talk', front: [17, 12], eyes: 'happy', mouth: 'open' }];

// ---------------------------------------------------------------- cabezas del mapa (16×16, de frente)
// Mismos códigos que las cabezas de perfil; E/I = ojo blanco/iris, b = ceja, M = boca, + adornos (sombrero, cofia…)
const MAP_HEAD = {
  hero: [
    '................',
    '.....dhHHhd.....',
    '...ddHLWWLHdd...',
    '..dHHLWLLHHHHd..',
    '.dHHLLHHHHHhHd..',
    '.dHLHHHhHHhHHHd.',
    '.dHHhSHSShSShHd.',
    '.dHhSbbSSSbbShd.',
    '.dHSSEISSSEIShd.',
    '.dhSSEISSSEISsd.',
    '..dkSSSSSSSSSd..',
    '..dsSSSMMMSSsd..',
    '...dsSSSSSSsd...',
    '....xsssssx.....',
    '................',
    '................',
  ],
  guide: [
    '................',
    '.....dhHHhd.....',
    '...dHHLWWLHd....',
    '..dHLWLLHHHHd...',
    '.dHLLHHHHHHHhd..',
    '.dHHHHdhHHHHHHd.',
    '.dHHhSSSSSSShHd.',
    '.dHhSbbSSSbbShd.',
    '.dHSSEISSSEIShd.',
    '.dhSSEISSSEISsd.',
    '..dkSSSSSSSSSd..',
    '..dsSSSSMMSSsd..',
    '...dsSSSSSSsd...',
    '....xsssssx.....',
    '................',
    '................',
  ],
  merchant: [
    '.....oFFFFo.....',
    '....oFfffFFo....',
    '....oFfFFFFo....',
    '....pppppppp....',
    '.ooFFFFFFFFFFoo.',
    '..dHHSSSSSSHHd..',
    '..dHSbbSSSbbHd..',
    '..dHSEISSSEIHd..',
    '..dhSEISSSEISd..',
    '..dHkSSSSSSsHd..',
    '..dwwwWWWwwwwd..',
    '..dwWWwWWWwWwd..',
    '...dwWWWWWWwd...',
    '....dwWWWWwd....',
    '.....dwwwwd.....',
    '................',
  ],
  nurse: [
    '.....cccccc.....',
    '....cCCrCCCc....',
    '....cCrRrCCc....',
    '...dcCCrCCCcd...',
    '..dHLWLLHHHHHd..',
    '.dHLLHHHHHHHHHd.',
    '.dHHhSHSShSShHd.',
    '.dHhSbbSSSbbShd.',
    'dHHSSEISSSEIShHd',
    'dHhSSEISSSEISsHd',
    'dHHdkSSSSSSSSdHd',
    'dHHdsSSSMMSSsdHd',
    '.dHHdsSSSSSsdHHd',
    '.dhHd.xsssx.dHd.',
    '..dd........dd..',
    '................',
  ],
};
function mapHead(pc, C, rows, extra = {}) {
  const pal = palette({ ...PLAYER, ...C });
  const H = pal.hair;
  const S = pal.skin;
  const map = { d: H.deep, h: H.shade, H: H.mid, L: H.light, W: H.hi, S: S.mid, s: S.shade, x: S.deep, k: S.light, E: '#ffffff', I: pal.eye, b: pal.lash, M: pal.mouth, ...extra };
  clear();
  blit(0, 0, rows, map);
  // la capa es de 24×32: se estampa en un cuadro de ese tamaño y se copia la parte de 16×16
  const big = new PixelCanvas(ART_W, ART_H);
  stamp(big);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, big.get(x, y));
}

// ---------------------------------------------------------------- adornos de los aldeanos
// Comerciante: sombrero de fieltro de ala ancha y barba blanca
function merchantHat(hx, hy) {
  const F = { deep: '#3a2414', shade: '#5a3a1e', mid: '#7a5228', light: '#9a6c38', hi: '#b88a50' };
  const p = (x, y, c) => put(hx + x, hy + y, c);
  for (let x = 8; x <= 15; x++) for (let y = -1; y <= 1; y++) p(x, y, x <= 9 ? F.light : x >= 14 ? F.shade : F.mid);
  p(8, -1, null);
  p(15, -1, null);
  p(10, -1, F.hi);
  p(11, -1, F.hi);
  for (let x = 8; x <= 15; x++) p(x, 1, x === 15 ? '#3a1e4e' : '#5a2b74'); // cinta
  p(9, 1, '#9a5ec0');
  for (let x = 5; x <= 18; x++) p(x, 2, x < 8 ? F.light : x > 15 ? F.mid : F.shade); // ala
  p(5, 2, F.mid);
  p(18, 2, F.shade);
}
function merchantBeard(hx, hy, P) {
  const W = { deep: '#8a90a8', shade: '#b8bccc', mid: '#e4e6ee', light: '#ffffff' };
  const p = (x, y, c) => put(hx + x, hy + y, c);
  // patillas y barba que cubre la mandíbula
  for (let y = 7; y <= 11; y++) for (let x = 11; x <= 16; x++) {
    if (y === 11 && (x < 12 || x > 15)) continue;
    if (y === 7 && x < 13) continue;
    p(x, y, x === 11 || y === 11 ? W.shade : y === 10 && x > 13 ? W.shade : W.mid);
  }
  p(13, 7, W.light); // bigote
  p(14, 7, W.light);
  p(15, 7, W.mid);
  p(16, 7, W.mid);
  p(12, 9, W.light);
  p(12, 8, W.light);
  p(14, 11, W.deep);
  p(13, 12, W.shade); // punta
  p(14, 12, W.shade);
  if (P.mouth === 'open') {
    p(14, 8, '#6a2028');
    p(15, 8, '#6a2028');
  } else p(15, 8, W.shade);
}
// Enfermera: cofia blanca con cruz roja, pestañas y labios
function nurseCap(hx, hy, pal, P) {
  const p = (x, y, c) => put(hx + x, hy + y, c);
  const W = { shade: '#c8cce0', mid: '#f4f4fa', light: '#ffffff' };
  for (let x = 8; x <= 14; x++) for (let y = -1; y <= 1; y++) p(x, y, y === 1 ? W.shade : x === 8 ? W.light : W.mid);
  p(8, -1, null);
  p(14, -1, null);
  p(11, -1, '#e03838');
  p(10, 0, '#e03838');
  p(11, 0, '#ff5a50');
  p(12, 0, '#e03838');
  p(11, 1, '#b02030');
  if (!P.eyes || P.eyes === 'open' || P.eyes === 'back') p(15, 4, pal.lash); // pestaña
  if (!P.mouth || P.mouth === 'line') {
    p(14, 8, '#d0506a');
    p(15, 8, '#b03a58');
  }
}
// Guía: correa de cuero cruzada con hebilla (de un bolso que lleva a la espalda)
function guideStrap(ux, top) {
  const p = (x, y, c) => put(ux + x, top + y, c);
  const L = ['#5a3418', '#7a4a22', '#9a6430'];
  for (let k = 0; k < 7; k++) {
    p(9 + k, k + 1, L[1]);
    p(9 + k, k, k === 0 ? L[2] : L[2]);
  }
  p(9, 0, null);
  p(12, 3, '#e0c060'); // hebilla
  p(9, 1, L[2]);
  p(8, 7, L[0]); // bolso atrás
  p(8, 6, L[1]);
}
// Enfermera: falda del uniforme sobre las piernas
function nurseSkirt(ux, top) {
  const p = (x, y, c) => put(ux + x, top + y, c);
  for (let y = 9; y <= 12; y++) {
    const x0 = 8 - (y > 10 ? 1 : 0);
    const x1 = 15 + (y > 9 ? 1 : 0);
    for (let x = x0; x <= x1; x++) p(x, y, x <= x0 + 1 ? '#ffffff' : x >= x1 - 1 ? '#c8cce0' : y === 12 && (x === 10 || x === 13) ? '#c8cce0' : '#f0f0f6');
  }
  for (let x = 7; x <= 16; x++) p(x, 12, x % 3 === 0 ? '#c8cce0' : '#e03838'); // ribete rojo
  p(7, 12, '#e03838');
}

// ---------------------------------------------------------------- pintores
const GUIDE = { hair: '#6b3d1a', hairLight: '#8a5228', shirt: '#4f8a3a', shirtShade: '#386629', shirtLight: '#6fae55', pants: '#6b5638', pantsShade: '#4d3e28' };
const MERCHANT = { hair: '#c8c8c8', hairLight: '#e8e8e8', shirt: '#7a3e9a', shirtShade: '#5a2b74', shirtLight: '#9a5ec0', pants: '#3e3a5a', pantsShade: '#2a2740', skin: '#e8b88a' };
const NURSE = { hair: '#d86a8a', hairLight: '#f08aa8', shirt: '#f2f2f2', shirtShade: '#c8c8d0', shirtLight: '#ffffff', pants: '#f4ece6', pantsShade: '#d0c4c8', boots: '#e8e8f2', bootsShade: '#b4b8d0', belt: '#e04848', buckle: '#ffffff', eye: '#3a7a5a' };

export const PIXEL = {
  player(pc, v, asset) {
    // Con armadura (asset.colors): el casco cambia el pelo, la pechera la camisa y las grebas el pantalón y las botas
    const A = asset?.colors || {};
    const C = { ...PLAYER, ...A };
    const style = {
      hair: 'hero',
      helmet: A.hair ? material(A.hair) : null,
      chest: A.shirt ? material(A.shirt) : null,
      greaves: A.pants ? material(A.pants) : null,
    };
    drawSheet(pc, POSES, C, style, SHEET_COLS);
  },
  npc_guide(pc) {
    drawSheet(pc, npcPoses(), { ...PLAYER, ...GUIDE }, { hair: 'guide', torsoExtra: guideStrap });
  },
  npc_merchant(pc) {
    drawSheet(pc, npcPoses(), { ...PLAYER, ...MERCHANT }, { hair: 'short', headExtra: (hx, hy, pal, P) => (merchantBeard(hx, hy, P), merchantHat(hx, hy)) });
  },
  npc_nurse(pc) {
    drawSheet(pc, npcPoses(), { ...PLAYER, ...NURSE }, { hair: 'long', headExtra: nurseCap, torsoExtra: nurseSkirt });
  },
  map_player(pc) {
    mapHead(pc, {}, MAP_HEAD.hero);
  },
  map_guide(pc) {
    mapHead(pc, GUIDE, MAP_HEAD.guide);
  },
  map_merchant(pc) {
    const hat = { o: '#3a2414', F: '#7a5228', f: '#9a6c38', p: '#5a2b74' };
    const beard = { w: '#b8bccc', W: '#eceef4' };
    mapHead(pc, MERCHANT, MAP_HEAD.merchant, { ...hat, ...beard });
  },
  map_nurse(pc) {
    mapHead(pc, NURSE, MAP_HEAD.nurse, { c: '#c8cce0', C: '#f6f6fc', r: '#e03838', R: '#ff6a5a' });
  },
};
export const CTX = {};
