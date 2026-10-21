import Phaser from 'phaser';
import { PixelCanvas, hash, pick } from './PixelArt.js';
import { POSES, SHEET_COLS, ART_W, ART_H } from '../player/animations.js';

// =====================================================================
//  Arte de reemplazo generado por código.
//  Se usa cuando la imagen correspondiente no existe en /public/assets.
//  - PIXEL: se pintan en una cuadrícula lógica (mitad del tamaño final) y se
//    escalan ×2 → estilo pixel art como Terraria.
//  - CTX: se dibujan directamente con canvas (círculos suaves, degradados, fondos).
//  'v' es la variante (0, 1, 2): cambia los detalles para que el suelo no se vea repetido.
// =====================================================================

// ---------------------------------------------------------------- paletas
const DIRT = ['#5a3519', '#6e4321', '#82522b', '#946035', '#a76f3f'];
const STONE = ['#3e434c', '#50565f', '#646a74', '#7a808a', '#90969f'];
const GRASS_TOP = { light: '#8fdc5e', mid: '#4caf50', alt: '#5cbf55', dark: '#2e7d32' };
const BARK = ['#4a2d16', '#5e3a1c', '#6f4523', '#82552c'];
const LEAF = { dark: '#1e5a26', mid: '#2f7d34', light: '#46a047', hi: '#8fd16a', line: '#143d18' };

// Ruido "en bloques" de 2×2 + detalle de 1×1 (textura más natural que el ruido puro)
const blocky = (x, y, s) => 0.6 * hash(x >> 1, y >> 1, s) + 0.4 * hash(x, y, s + 77);

function fillNoise(pc, palette, v, seed, weights = [0.1, 0.42, 0.8, 0.95]) {
  for (let y = 0; y < pc.h; y++) {
    for (let x = 0; x < pc.w; x++) {
      const t = blocky(x, y, seed + v * 31);
      let i = 0;
      while (i < weights.length && t > weights[i]) i++;
      pc.set(x, y, palette[i]);
    }
  }
}

function pebbles(pc, v, seed, light, dark, count = 2) {
  for (let k = 0; k < count; k++) {
    const x = 1 + Math.floor(hash(k, 1, seed + v) * 12);
    const y = 4 + Math.floor(hash(k, 2, seed + v) * 10);
    pc.rect(x, y, 2, 1, light);
    pc.set(x, y + 1, dark);
    pc.set(x + 1, y + 1, dark);
  }
}

function oreClumps(pc, v, seed, colors) {
  for (let k = 0; k < 3; k++) {
    const cx = 2 + Math.floor(hash(k, 3, seed + v) * 11);
    const cy = 2 + Math.floor(hash(k, 4, seed + v) * 11);
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]];
    cells.forEach(([dx, dy], i) => pc.set(cx + dx, cy + dy, i === 0 ? colors[2] : i > 4 ? colors[0] : colors[1]));
  }
}

function pickaxe(pc, head, light, dark) {
  for (let i = 0; i < 8; i++) {
    pc.set(3 + i, 13 - i, '#8a5a2b');
    pc.set(4 + i, 13 - i, '#6b4420');
  }
  const rows = [
    [1, 7, 10],
    [2, 5, 12],
    [3, 4, 5],
    [3, 11, 13],
    [4, 3, 4],
    [4, 12, 13],
    [5, 3, 3],
    [5, 13, 14],
    [6, 13, 14],
    [7, 14, 14],
  ];
  for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) pc.set(x, y, y <= 2 ? light : y >= 5 ? dark : head);
  pc.outline('#20160e');
}

// Martillo: mango en diagonal y cabeza atravesada arriba a la derecha
function hammer(pc, light, mid, dark) {
  for (let i = 0; i < 8; i++) {
    pc.set(3 + i, 13 - i, '#8a5a2b');
    pc.set(4 + i, 13 - i, '#6b4420');
  }
  pc.line(7, 3, 12, 8, dark);
  pc.line(8, 2, 13, 7, mid);
  pc.line(9, 1, 14, 6, light);
  pc.line(8, 3, 13, 8, dark);
  pc.line(9, 2, 14, 7, mid);
  pc.outline('#20160e');
}

// Arco apuntando a la derecha: madera curva y cuerda vertical a la izquierda
function bow(pc, wood, dark) {
  for (let y = 1; y <= 14; y++) {
    const t = (y - 7.5) / 6.5;
    const x = Math.round(5 + (1 - t * t) * 6);
    pc.set(x, y, wood);
    pc.set(x + 1, y, dark);
  }
  pc.line(5, 1, 5, 14, '#e8e0c8');
  pc.rect(10, 6, 2, 4, '#5a3a1a'); // empuñadura
  pc.outline('#1a120c');
}

// Pasto de colores sobre la primera fila (pasto de selva, sombrío, de cristal)
function grassTop(pc, v, c) {
  for (let x = 0; x < 16; x++) {
    const len = 2 + (hash(x, 1, 50 + v) < 0.55 ? 1 : 0) + (hash(x, 2, 50 + v) < 0.2 ? 1 : 0);
    for (let y = 0; y < len; y++) pc.set(x, y, y === 0 ? c.light : y === len - 1 ? c.dark : hash(x, y, v) < 0.35 ? c.alt : c.mid);
  }
}

// Brote de cristal (plantas de las tierras de cristal)
function crystalShard(pc, color, light) {
  pc.line(8, 15, 8, 2, color);
  pc.line(7, 15, 7, 5, color);
  pc.line(9, 15, 9, 5, color);
  pc.line(5, 15, 4, 9, color);
  pc.line(11, 15, 12, 8, color);
  pc.line(8, 4, 8, 12, light);
  pc.outline('#3a1a4a');
}

const JUNGLE_LEAF = { dark: '#0f4a1a', mid: '#1f6e24', light: '#33963a', hi: '#7fe05a', line: '#08300f' };
const SHADOW_LEAF = { dark: '#3a1f5a', mid: '#5a2f88', light: '#7a48b0', hi: '#c090ff', line: '#1f0f33' };

// Espada: hoja en diagonal hacia arriba a la derecha, mango y guarda abajo a la izquierda
function sword(pc, blade, mid, dark) {
  for (let i = 0; i < 9; i++) {
    pc.set(5 + i, 10 - i, blade);
    pc.set(6 + i, 10 - i, mid);
    pc.set(5 + i, 11 - i, dark);
  }
  pc.set(14, 1, '#ffffff');
  pc.line(2, 9, 6, 13, '#8a6a2a'); // guarda
  pc.line(3, 9, 7, 13, '#c9a64a');
  pc.line(1, 14, 3, 12, '#5a3a1a'); // mango
  pc.line(2, 14, 4, 12, '#7a4f22');
  pc.set(1, 15, '#c9a64a');
  pc.outline('#1a120c');
}

// Madera de los muebles y de la pared de madera
const WOOD = { light: '#c99a58', mid: '#a3733a', dark: '#6e4a22', seam: '#8a5f2b', line: '#2b1a0c' };

// Pared de tablones (más oscura que el bloque de tablones: queda al fondo)
function drawWoodWall(pc, x0, y0, w, h, v) {
  const boards = ['#4f361b', '#5a3e20', '#4a3219'];
  for (let y = 0; y < h; y++) {
    const b = (y + 1) >> 2;
    const row = (y + 1) & 3;
    const base = boards[Math.floor(hash(b, 3, 90 + v) * 3)];
    const seam = 2 + Math.floor(hash(b, 8, 90 + v) * (w - 4));
    for (let x = 0; x < w; x++) {
      let c = base;
      if (row === 0) c = '#674826';
      else if (row === 3) c = '#33220f';
      else if (hash(x, y, 91 + v) < 0.1) c = '#3f2a14';
      if (x === seam && row !== 0) c = '#2b1c0d';
      pc.set(x0 + x, y0 + y, c);
    }
  }
}

// Personaje (mirando a la derecha). Cuadros de 24×32 (arte) = 48×64 en pantalla, uno por
// pose de player/animations.js (8 por fila). Los pies tocan la última fila del cuadro.
const PLAYER_COLORS = {
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
// Dibuja una pose (ver player/animations.js) en el cuadro que empieza en (ox, oy)
function drawPose(pc, ox, oy, P, C = PLAYER_COLORS) {
  const bob = P.bob || 0;
  const lean = P.lean || 0;
  const lift = P.lift || 0;
  const Y = (y) => oy + y - lift;
  const hip = 22 + bob;
  const shoulder = 14 + bob;
  const ux = ox + lean; // torso y cabeza se inclinan con lean
  const hipShift = P.sit ? lean : Math.round(lean / 2);
  const frontLeg = { dx: 0, foot: 31, ...(P.frontLeg || {}) };
  const backLeg = { dx: 0, foot: 31, ...(P.backLeg || {}) };

  // Pierna de 3 px desde la cadera hasta el pie (con bota y punta hacia adelante).
  // Con knee [x, y], la pierna se dobla: muslo hasta la rodilla y canilla hasta el pie (sentado en una silla)
  const leg = (hipX, L, pants) => {
    const fx = ox + hipX + L.dx;
    if (L.knee) {
      const kx = ox + L.knee[0];
      const ky = Y(L.knee[1] + bob);
      for (let k = 0; k < 3; k++) {
        pc.line(ox + hipX + hipShift, Y(hip) + k, kx, ky + k, k === 2 ? C.pantsShade : pants);
        pc.line(kx - 2 + k, ky, fx + k, Y(L.foot - 3), k === 0 ? C.pantsShade : pants);
      }
    } else {
      for (let k = 0; k < 3; k++) {
        pc.line(ox + hipX + hipShift + k, Y(hip), fx + k, Y(L.foot - 3), k === 0 ? C.pantsShade : pants);
      }
    }
    pc.rect(fx, Y(L.foot - 2), 3, 3, C.boots);
    pc.rect(fx, Y(L.foot - 2), 1, 3, C.bootsShade);
    pc.set(fx + 3, Y(L.foot), C.boots);
    pc.set(fx + 3, Y(L.foot - 1), C.boots);
  };
  // Brazo de 3 px desde el hombro hasta la mano
  const arm = (sx, hand, color) => {
    const hx = ox + hand[0] + lean;
    const hy = Y(hand[1] + bob);
    for (let k = 0; k < 3; k++) pc.line(ux + sx + k, Y(shoulder), hx + k, hy - 1, color);
    pc.rect(hx, hy, 3, 2, C.skin);
    pc.set(hx, hy, C.skinShade);
  };

  // Brazo y pierna de atrás (más oscuros)
  arm(9, P.back || [9, 22], C.shirtShade);
  leg(9, backLeg, C.pantsShade);

  // Torso con sombra atrás, luz adelante, cuello y cinturón
  pc.rect(ux + 8, Y(13 + bob), 8, 9, C.shirt);
  pc.rect(ux + 8, Y(13 + bob), 2, 9, C.shirtShade);
  pc.rect(ux + 14, Y(15 + bob), 1, 5, C.shirtLight);
  pc.rect(ux + 11, Y(13 + bob), 3, 1, C.skinShade);
  pc.rect(ux + 8, Y(hip - 1), 8, 1, C.belt);
  pc.set(ux + 13, Y(hip - 1), C.buckle);

  // Brazo de adelante levantado (mano por encima del hombro): va detrás de la cabeza
  const front = P.front || [12, 22];
  const raised = front[1] < 11;
  if (raised) arm(12, front, C.shirt);

  // Cabeza
  const hx = ux + (P.headDx || 0);
  const hy = Y(1 + bob + (P.headDy || 0));
  pc.rect(hx + 8, hy + 2, 9, 9, C.skin);
  pc.rect(hx + 8, hy + 2, 1, 9, C.skinShade);
  pc.rect(hx + 9, hy + 10, 7, 1, C.skinShade);
  pc.rect(hx + 10, hy + 11, 4, 1, C.skinShade); // cuello
  pc.set(hx + 10, hy + 6, C.skinShade); // oreja
  // Ojos
  const dark = '#3a2418';
  const eye = (x, y, c) => pc.set(hx + x, hy + y, c);
  switch (P.eyes || 'open') {
    case 'closed':
      eye(13, 6, dark);
      eye(14, 6, dark);
      break;
    case 'happy':
      eye(13, 6, dark);
      eye(14, 5, dark);
      eye(15, 6, dark);
      break;
    case 'wide':
      for (const y of [4, 5, 6]) eye(13, y, C.eyeWhite);
      eye(14, 4, C.eyeWhite);
      eye(14, 6, C.eyeWhite);
      eye(14, 5, C.eye);
      break;
    case 'back':
      eye(14, 5, C.eyeWhite);
      eye(14, 6, C.eyeWhite);
      eye(13, 5, C.eye);
      eye(13, 6, C.eye);
      break;
    case 'hurt':
      eye(13, 5, dark);
      eye(14, 6, dark);
      eye(13, 6, dark);
      break;
    case 'sleepy':
      eye(13, 5, C.skinShade);
      eye(14, 5, C.skinShade);
      eye(13, 6, C.eyeWhite);
      eye(14, 6, C.eye);
      break;
    default:
      eye(13, 5, C.eyeWhite);
      eye(13, 6, C.eyeWhite);
      eye(14, 5, C.eye);
      eye(14, 6, C.eye);
  }
  // Boca
  const inside = '#5a1a1a';
  switch (P.mouth || 'line') {
    case 'smile':
      eye(13, 8, C.mouth);
      eye(16, 8, C.mouth);
      eye(14, 9, C.mouth);
      eye(15, 9, C.mouth);
      break;
    case 'open':
      pc.rect(hx + 14, hy + 8, 2, 2, inside);
      break;
    case 'frown':
      eye(14, 8, C.mouth);
      eye(15, 8, C.mouth);
      eye(13, 9, C.mouth);
      eye(16, 9, C.mouth);
      break;
    case 'o':
      pc.rect(hx + 15, hy + 8, 1, 2, inside);
      break;
    case 'yawn':
      pc.rect(hx + 14, hy + 7, 2, 3, inside);
      break;
    default:
      pc.rect(hx + 14, hy + 8, 2, 1, C.mouth);
  }
  // Pelo
  pc.rect(hx + 7, hy, 10, 3, C.hair);
  pc.rect(hx + 9, hy, 5, 1, C.hairLight);
  pc.rect(hx + 7, hy + 3, 3, 6, C.hair);
  pc.rect(hx + 10, hy + 3, 1, 2, C.hair);
  pc.rect(hx + 15, hy + 3, 2, 1, C.hair);
  pc.set(hx + 16, hy + 4, C.hair);

  // Pierna y brazo de adelante
  leg(12, frontLeg, C.pants);
  if (!raised) arm(12, front, C.shirt);
}

function drawCanopy(pc, ox, v, L = LEAF, scale = 1) {
  const layouts = [
    [[36, 30, 20], [22, 36, 13], [50, 36, 13], [30, 20, 12], [44, 20, 12], [36, 44, 12]],
    [[36, 26, 16], [36, 40, 15], [25, 33, 12], [47, 33, 12], [36, 13, 11]],
    [[36, 32, 18], [18, 38, 12], [54, 38, 12], [26, 23, 12], [46, 23, 12]],
  ];
  // scale agranda o achica la copa alrededor de su centro (selva más tupida, árbol sombrío ralo)
  const discs = layouts[v % layouts.length].map(([x, y, r]) => [36 + (x - 36) * scale, 34 + (y - 34) * scale, r * scale]);
  for (const [x, y, r] of discs) pc.disc(ox + x, y, r, L.dark);
  for (const [x, y, r] of discs) pc.disc(ox + x - 2, y - 2, r - 2.5, L.mid);
  for (const [x, y, r] of discs) pc.disc(ox + x - 4, y - 5, r - 6.5, L.light);
  // Textura de hojas: algunos píxeles un tono más oscuro y brillos
  const darker = { [L.mid]: L.dark, [L.light]: L.mid, [L.dark]: L.line };
  for (let y = 0; y < pc.h; y++) {
    for (let x = ox; x < ox + 72; x++) {
      const c = pc.get(x, y);
      if (!c) continue;
      const t = hash(x, y, 900 + v);
      if (t < 0.13) pc.set(x, y, darker[c] || c);
      else if (t > 0.985 && c === L.light) pc.set(x, y, L.hi);
    }
  }
  pc.outline(L.line);
}

function circleBtn(ctx, w, h) {
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,28,70,0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,215,255,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

// Rectángulo con esquinas recortadas (estilo pixel)
function slotShape(ctx, w, h, fill, border, borderW, highlight) {
  ctx.fillStyle = border;
  ctx.fillRect(2, 0, w - 4, h);
  ctx.fillRect(0, 2, w, h - 4);
  ctx.clearRect(0, 0, 2, 2);
  ctx.fillStyle = fill;
  ctx.clearRect(borderW, borderW, w - borderW * 2, h - borderW * 2);
  ctx.fillRect(borderW, borderW, w - borderW * 2, h - borderW * 2);
  ctx.fillStyle = highlight;
  ctx.fillRect(borderW, borderW, w - borderW * 2, 2);
}

// Silueta horizontal repetible (fondos con paralaje). hFn(u) da la altura (0..1 del alto) para u en [0,1).
function ridge(ctx, w, h, hFn, colorFn, scale = 2) {
  const cols = w / scale;
  const rows = h / scale;
  for (let x = 0; x < cols; x++) {
    const u = x / cols;
    const top = Math.round(rows - hFn(u) * rows);
    const slope = hFn(((x + 1) % cols) / cols) - hFn(u);
    // Se pintan tramos verticales del mismo color de una vez (mucho más rápido que píxel a píxel)
    let runStart = Math.max(0, top);
    let runColor = null;
    for (let y = runStart; y <= rows; y++) {
      const c = y < rows ? colorFn(y - top, slope, x, y) : null;
      if (c === runColor) continue;
      if (runColor) {
        ctx.fillStyle = runColor;
        ctx.fillRect(x * scale, runStart * scale, scale, (y - runStart) * scale);
      }
      runColor = c;
      runStart = y;
    }
  }
}

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- fondos por zona
const MOUNTAIN_SHAPE = (u) =>
  0.25 + 0.42 * (0.5 + 0.5 * Math.sin(TAU * 2 * u + 0.3)) * (1 - Math.abs(Math.sin(Math.PI * 5 * u + 1))) + 0.12 * (0.5 + 0.5 * Math.sin(TAU * 9 * u));
const HILL_SHAPE = (u) => 0.42 + 0.16 * Math.sin(TAU * 3 * u + 1) + 0.09 * Math.sin(TAU * 7 * u + 2);

/**
 * Colores y formas del fondo de cada zona. mountain = [iluminado, sombra, plano];
 * hill = [borde, iluminado, sombra, plano]; ground = suelo de la capa cercana.
 * fills = color de relleno debajo de cada capa (montañas, colinas, cercana).
 * sky = color por el que se multiplica el cielo; skyMix = cuánto.
 */
export const BG_THEMES = {
  forest: {
    mountain: ['#93add2', '#7590b8', '#8399c0'], cap: '#e6eef8', capFrom: 0.55,
    hill: ['#86c47a', '#5ea657', '#4f9149', '#57a050'], hillProp: 'tree', hillProps: 26, propColors: ['#4a3522', '#3f7d3c'],
    front: 'trees', ground: '#2b5a2c', trunk: '#3b2a1a', leaf: ['#3c7340', '#2f6332'],
    fills: [0x7590b8, 0x4f9149, 0x2b5a2c], sky: 0xffffff, skyMix: 0,
  },
  desert: {
    mountain: ['#e0b27a', '#b98452', '#cc9a64'], cap: null,
    mountainShape: (u) => {
      // Mesetas: cerros de cima plana
      const m = MOUNTAIN_SHAPE(u);
      return Math.min(m, 0.42 + 0.1 * Math.sin(TAU * 3 * u));
    },
    hill: ['#f6dfa2', '#e6c47e', '#cfa660', '#dcb46e'], hillProp: 'cactus', hillProps: 14, propColors: ['#5f8a3e', '#4a7030'],
    hillShape: (u) => 0.36 + 0.14 * Math.abs(Math.sin(TAU * 2.5 * u + 1)) + 0.05 * Math.sin(TAU * 7 * u),
    front: 'dunes', ground: '#c08f52', dune: ['#d8a862', '#c69552'], leaf: ['#4f7a34', '#3e6428'],
    fills: [0xb98452, 0xcfa660, 0xc08f52], sky: 0xffe2b0, skyMix: 0.55,
  },
  snow: {
    mountain: ['#eef4fb', '#b7c9de', '#cfdcec'], cap: '#ffffff', capFrom: 0.35,
    hill: ['#ffffff', '#e4edf7', '#c9d8e8', '#d7e3f0'], hillProp: 'pine', hillProps: 30, propColors: ['#4a3522', '#2c5a4a'],
    front: 'pines', ground: '#dbe6f2', trunk: '#3b2a1a', leaf: ['#2a5848', '#1f4a3c'],
    fills: [0xb7c9de, 0xc9d8e8, 0xdbe6f2], sky: 0xdfe8ff, skyMix: 0.45,
  },
  jungle: {
    mountain: ['#6aa898', '#4a8070', '#5a9282'], cap: null,
    hill: ['#6fd055', '#33933c', '#25722f', '#2c8236'], hillProp: 'tree', hillProps: 40, propColors: ['#3a2a18', '#24702c'],
    front: 'jungle', ground: '#1b4520', trunk: '#4a3420', leaf: ['#2e8a34', '#1f6a28'], vine: '#3fa040',
    fills: [0x4a8070, 0x25722f, 0x1b4520], sky: 0xc4f0d2, skyMix: 0.5,
  },
  shadow: {
    mountain: ['#6a5888', '#433660', '#554670'], cap: '#9b86c8', capFrom: 0.6,
    hill: ['#a874e0', '#523e74', '#3c2c58', '#463468'], hillProp: 'deadtree', hillProps: 18, propColors: ['#2a1e3c', '#7a48b8'],
    front: 'twisted', ground: '#22163a', trunk: '#1a1028', leaf: ['#6a3fa0', '#55308a'], glow: '#c890ff',
    fills: [0x433660, 0x3c2c58, 0x22163a], sky: 0xb898d8, skyMix: 0.8,
  },
  crystal: {
    mountain: ['#efc6f2', '#bb8fd0', '#d4a8e0'], cap: '#ffffff', capFrom: 0.5,
    mountainShape: (u) => 0.2 + 0.55 * Math.pow(Math.abs(Math.sin(TAU * 3 * u + 0.4)), 4) + 0.12 * Math.abs(Math.sin(TAU * 11 * u)),
    hill: ['#b4fff6', '#86d0dc', '#68aec4', '#76bed0'], hillProp: 'shard', hillProps: 22, propColors: ['#f0a8ff', '#a8f0ff'],
    front: 'spires', ground: '#34486a', crystals: ['#ff9ee8', '#8ef0ff', '#ffe68a', '#c49aff'],
    fills: [0xbb8fd0, 0x68aec4, 0x34486a], sky: 0xf2c8f4, skyMix: 0.6,
  },
  volcano: {
    mountain: ['#5c4c4a', '#3a2e2e', '#4a3c3a'], cap: '#ff7a3a', capFrom: 0.5,
    mountainShape: (u) => {
      // Volcanes: conos con el cráter hundido
      const c = Math.max(0, 1 - Math.abs(((u * 3) % 1) - 0.5) * 2.4);
      return 0.18 + 0.55 * c - (c > 0.88 ? (c - 0.88) * 1.6 : 0) + 0.04 * Math.sin(TAU * 13 * u);
    },
    hill: ['#7a6660', '#3c3030', '#2c2222', '#342a2a'], hillProp: 'deadtree', hillProps: 12, propColors: ['#1e1616', '#1e1616'],
    front: 'ashland', ground: '#1a1212', trunk: '#140e0e', lava: ['#ff9a30', '#e04a10'],
    fills: [0x3a2e2e, 0x2c2222, 0x1a1212], sky: 0xd88068, skyMix: 0.85,
  },
};

// Adornos sobre las colinas (en celdas de 2 px)
const HILL_PROPS = {
  tree(ctx, x, top, r, th) {
    ctx.fillStyle = th.propColors[0];
    ctx.fillRect(x * 2, (top - 3) * 2, 2, 8);
    ctx.fillStyle = th.propColors[1];
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillRect((x - half) * 2, (top - r - 2 + dy) * 2, (half * 2 + 1) * 2, 2);
    }
  },
  pine(ctx, x, top, r, th) {
    ctx.fillStyle = th.propColors[0];
    ctx.fillRect(x * 2, (top - 2) * 2, 2, 6);
    ctx.fillStyle = th.propColors[1];
    const hgt = r * 3;
    for (let dy = 0; dy < hgt; dy++) {
      const half = Math.floor((dy / hgt) * r);
      ctx.fillRect((x - half) * 2, (top - 2 - hgt + dy) * 2, (half * 2 + 1) * 2, 2);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x * 2, (top - 2 - hgt) * 2, 2, 2);
  },
  cactus(ctx, x, top, r, th) {
    ctx.fillStyle = th.propColors[0];
    ctx.fillRect(x * 2, (top - r - 3) * 2, 4, (r + 4) * 2);
    ctx.fillRect((x - 2) * 2, (top - r) * 2, 2, 6);
    ctx.fillRect((x - 2) * 2, (top - r + 2) * 2, 4, 2);
    ctx.fillRect((x + 3) * 2, (top - r - 2) * 2, 2, 6);
  },
  deadtree(ctx, x, top, r, th) {
    ctx.fillStyle = th.propColors[0];
    ctx.fillRect(x * 2, (top - r * 2) * 2, 2, r * 4 + 2);
    for (let k = 0; k < r; k++) {
      ctx.fillRect((x - k) * 2, (top - r * 2 + 2 - k) * 2, 2, 2);
      ctx.fillRect((x + 1 + k) * 2, (top - r * 2 + 4 - k) * 2, 2, 2);
    }
    if (th.propColors[1] !== th.propColors[0]) {
      ctx.fillStyle = th.propColors[1];
      ctx.fillRect((x - r) * 2, (top - r * 3 + 1) * 2, 4, 4);
      ctx.fillRect((x + r) * 2, (top - r * 3 + 3) * 2, 4, 4);
    }
  },
  shard(ctx, x, top, r, th, i) {
    ctx.fillStyle = th.propColors[i % 2];
    const hgt = r * 3;
    for (let dy = 0; dy < hgt; dy++) {
      const half = Math.max(0, Math.floor(((dy + 1) / hgt) * (r / 2 + 1)));
      ctx.fillRect((x - half) * 2, (top - hgt + dy) * 2, (half * 2 + 1) * 2, 2);
    }
  },
};

// Siluetas de la capa cercana. cols/rows en celdas de 2 px; ground = fila del suelo.
const disc2 = (ctx, cx, cy, r) => {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect((cx - half) * 2, (cy + dy) * 2, (half * 2 + 1) * 2, 2);
  }
};
const wrap = (cols, fn) => {
  for (const ox of [0, -cols, cols]) fn(ox);
};
const FRONT = {
  trees(ctx, cols, rows, ground, th) {
    for (let i = 0; i < 60; i++) {
      const x = Math.floor((i / 60) * cols + hash(i, 1, 400) * 6);
      const tH = 14 + Math.floor(hash(i, 2, 400) * 22);
      const r = 5 + Math.floor(hash(i, 3, 400) * 4);
      const cy = ground - tH;
      wrap(cols, (ox) => {
        ctx.fillStyle = th.trunk;
        ctx.fillRect((x + ox) * 2, cy * 2, 4, (tH + 2) * 2);
        for (let dy = -r; dy <= r; dy++) {
          const half = Math.floor(Math.sqrt(r * r - dy * dy));
          ctx.fillStyle = dy < -r / 3 ? th.leaf[0] : th.leaf[1];
          ctx.fillRect((x - half + ox) * 2, (cy + dy) * 2, (half * 2 + 1) * 2, 2);
        }
      });
    }
  },
  dunes(ctx, cols, rows, ground, th) {
    // Dunas, una pirámide lejana y cactus
    const dh = (u) => 7 + 5 * Math.sin(TAU * 2 * u + 0.5) + 3 * Math.sin(TAU * 5 * u);
    for (let x = 0; x < cols; x++) {
      const top = Math.round(ground - dh(x / cols));
      const slope = dh((x + 1) / cols) - dh(x / cols);
      ctx.fillStyle = slope > 0 ? th.dune[0] : th.dune[1];
      ctx.fillRect(x * 2, top * 2, 2, (ground - top) * 2);
    }
    const px = Math.floor(cols * 0.62);
    wrap(cols, (ox) => {
      for (let k = 0; k < 26; k++) {
        ctx.fillStyle = k % 4 === 0 ? '#b38450' : '#c99a5e';
        ctx.fillRect((px - 26 + k + ox) * 2, (ground - 12 - k) * 2, (52 - k * 2) * 2, 2);
      }
    });
    for (let i = 0; i < 16; i++) {
      const x = Math.floor((i / 16) * cols + hash(i, 1, 410) * 10);
      const tH = 8 + Math.floor(hash(i, 2, 410) * 10);
      const top = Math.round(ground - dh(x / cols)) - tH;
      wrap(cols, (ox) => {
        ctx.fillStyle = th.leaf[1];
        ctx.fillRect((x + ox) * 2, top * 2, 6, (tH + 2) * 2);
        ctx.fillRect((x - 3 + ox) * 2, (top + 4) * 2, 2, 8);
        ctx.fillRect((x - 3 + ox) * 2, (top + 7) * 2, 8, 2);
        ctx.fillRect((x + 4 + ox) * 2, (top + 2) * 2, 2, 8);
        ctx.fillRect((x + 2 + ox) * 2, (top + 5) * 2, 6, 2);
        ctx.fillStyle = th.leaf[0];
        ctx.fillRect((x + ox) * 2, top * 2, 2, (tH + 2) * 2);
      });
    }
  },
  pines(ctx, cols, rows, ground, th) {
    for (let i = 0; i < 46; i++) {
      const x = Math.floor((i / 46) * cols + hash(i, 1, 420) * 6);
      const tH = 26 + Math.floor(hash(i, 2, 420) * 26);
      const r = 6 + Math.floor(hash(i, 3, 420) * 4);
      wrap(cols, (ox) => {
        ctx.fillStyle = th.trunk;
        ctx.fillRect((x + ox) * 2, (ground - 6) * 2, 4, 14);
        for (let dy = 0; dy < tH; dy++) {
          const tier = dy % 8;
          const half = Math.floor(((dy + 2) / tH) * r) + (tier > 5 ? 1 : 0);
          ctx.fillStyle = tier === 0 ? '#f4f8ff' : dy / tH < 0.5 ? th.leaf[0] : th.leaf[1];
          ctx.fillRect((x + 1 - half + ox) * 2, (ground - 4 - tH + dy) * 2, (half * 2) * 2, 2);
        }
      });
    }
    // Nieve en el suelo
    ctx.fillStyle = '#f4f8ff';
    ctx.fillRect(0, (ground - 1) * 2, cols * 2, 4);
  },
  jungle(ctx, cols, rows, ground, th) {
    for (let i = 0; i < 34; i++) {
      const x = Math.floor((i / 34) * cols + hash(i, 1, 430) * 8);
      const tH = 34 + Math.floor(hash(i, 2, 430) * 30);
      const r = 8 + Math.floor(hash(i, 3, 430) * 5);
      const cy = ground - tH;
      wrap(cols, (ox) => {
        ctx.fillStyle = th.trunk;
        ctx.fillRect((x + ox) * 2, cy * 2, 6, (tH + 2) * 2);
        ctx.fillStyle = th.leaf[1];
        disc2(ctx, x + 1 + ox, cy + 1, r);
        ctx.fillStyle = th.leaf[0];
        disc2(ctx, x - 2 + ox, cy - 2, Math.floor(r * 0.6));
        disc2(ctx, x + 5 + ox, cy, Math.floor(r * 0.5));
        // Lianas colgando
        ctx.fillStyle = th.vine;
        for (let k = 0; k < 3; k++) {
          const vx = x - r + 3 + Math.floor(hash(i, 10 + k, 430) * (r * 2 - 4));
          ctx.fillRect((vx + ox) * 2, (cy + 2) * 2, 2, (6 + Math.floor(hash(i, 20 + k, 430) * 16)) * 2);
        }
      });
    }
    // Helechos
    ctx.fillStyle = th.leaf[1];
    for (let x = 0; x < cols; x += 2) {
      const hh = 2 + Math.floor(hash(x, 5, 431) * 5);
      ctx.fillRect(x * 2, (ground - hh) * 2, 2, hh * 2);
    }
  },
  twisted(ctx, cols, rows, ground, th) {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor((i / 26) * cols + hash(i, 1, 440) * 10);
      const tH = 20 + Math.floor(hash(i, 2, 440) * 24);
      wrap(cols, (ox) => {
        ctx.fillStyle = th.trunk;
        let tx = x;
        for (let dy = 0; dy < tH; dy++) {
          if (dy % 6 === 5) tx += hash(i, dy, 441) < 0.5 ? -1 : 1;
          ctx.fillRect((tx + ox) * 2, (ground - dy) * 2, 6 - Math.floor((dy / tH) * 3) * 2, 2);
        }
        // Ramas torcidas con una copa violeta
        for (let k = 0; k < 4; k++) {
          ctx.fillRect((tx - k + ox) * 2, (ground - tH + 4 - k) * 2, 2, 2);
          ctx.fillRect((tx + 2 + k + ox) * 2, (ground - tH + 6 - k) * 2, 2, 2);
        }
        ctx.fillStyle = th.leaf[i % 2];
        disc2(ctx, tx - 4 + ox, ground - tH - 1, 3 + (i % 3));
        disc2(ctx, tx + 6 + ox, ground - tH + 1, 2 + (i % 2));
      });
    }
    // Hongos que brillan
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(hash(i, 1, 442) * cols);
      ctx.fillStyle = '#3a2a50';
      ctx.fillRect(x * 2, (ground - 3) * 2, 2, 6);
      ctx.fillStyle = th.glow;
      ctx.fillRect((x - 1) * 2, (ground - 4) * 2, 6, 2);
    }
  },
  spires(ctx, cols, rows, ground, th) {
    for (let i = 0; i < 30; i++) {
      const x = Math.floor((i / 30) * cols + hash(i, 1, 450) * 8);
      const tH = 14 + Math.floor(hash(i, 2, 450) * 40);
      const half = 2 + Math.floor(hash(i, 3, 450) * 3);
      const color = th.crystals[i % th.crystals.length];
      wrap(cols, (ox) => {
        for (let dy = 0; dy < tH; dy++) {
          const hw = dy > tH - half * 2 ? Math.max(0, Math.floor((tH - dy) / 2)) : half;
          ctx.fillStyle = color;
          ctx.fillRect((x - hw + ox) * 2, (ground - dy) * 2, (hw * 2 + 1) * 2, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          if (hw > 0) ctx.fillRect((x - hw + ox) * 2, (ground - dy) * 2, 2, 2);
        }
      });
    }
  },
  ashland(ctx, cols, rows, ground, th) {
    // Ríos de lava que bajan y árboles muertos
    for (let i = 0; i < 6; i++) {
      const x = Math.floor((i / 6) * cols + hash(i, 1, 460) * 30);
      wrap(cols, (ox) => {
        ctx.fillStyle = th.lava[1];
        ctx.fillRect((x + ox) * 2, (ground - 3) * 2, 40, 6);
        ctx.fillStyle = th.lava[0];
        ctx.fillRect((x + 3 + ox) * 2, (ground - 2) * 2, 26, 2);
      });
    }
    for (let i = 0; i < 24; i++) {
      const x = Math.floor((i / 24) * cols + hash(i, 1, 461) * 10);
      const tH = 10 + Math.floor(hash(i, 2, 461) * 22);
      wrap(cols, (ox) => {
        ctx.fillStyle = th.trunk;
        ctx.fillRect((x + ox) * 2, (ground - tH) * 2, 4, (tH + 1) * 2);
        for (let k = 0; k < 5; k++) {
          ctx.fillRect((x - k + ox) * 2, (ground - tH + 5 - k) * 2, 2, 2);
          ctx.fillRect((x + 2 + k + ox) * 2, (ground - tH + 9 - k) * 2, 2, 2);
        }
      });
    }
    // Rocas
    ctx.fillStyle = '#2a2020';
    for (let i = 0; i < 20; i++) disc2(ctx, Math.floor(hash(i, 3, 462) * cols), ground, 2 + (i % 3));
  },
};

// Tejas: hileras de escamas redondeadas, cada hilera corrida media teja
function drawShingles(pc, v, [dark, mid, base, light]) {
  for (let y = 0; y < 16; y++) {
    const row = y >> 2;
    const off = row % 2 ? 2 : 0;
    const r = y & 3;
    for (let x = 0; x < 16; x++) {
      const u = (x + off) % 4;
      let c = base;
      if (r === 3 && (u === 0 || u === 3)) c = dark; // borde redondeado de abajo
      else if (r === 3) c = mid;
      else if (u === 0) c = mid;
      else if (r === 0) c = light;
      if (c === base && hash(x, y, 330 + v) < 0.1) c = mid;
      pc.set(x, y, c);
    }
  }
}

// Aldeano: las poses del jugador con otros colores (y un adorno opcional en la cabeza)
function drawNpc(pc, colors, extra) {
  const C = { ...PLAYER_COLORS, ...colors };
  const frames = [POSES[0], POSES[3], POSES[5], POSES[7], POSES[9], { name: 'talk', front: [17, 12], eyes: 'happy', mouth: 'open' }];
  frames.forEach((pose, i) => {
    drawPose(pc, i * ART_W, 0, pose, C);
    if (extra) extra(i * ART_W, i * ART_W + (pose.lean || 0), 1 + (pose.bob || 0));
  });
}

// Moneda redonda con brillo (en el centro del ícono)
function drawCoin(pc, [dark, mid, light]) {
  pc.disc(7.5, 8.5, 5.2, (x, y, d) => (d > 0.82 ? dark : y < 7 ? light : mid));
  pc.rect(6, 6, 3, 5, dark);
  pc.rect(7, 6, 1, 5, light);
  pc.outline('#1a120c');
}

// Colores de los íconos de armadura: [oscuro, medio, claro]
const ARMOR_ICON = {
  gold: ['#8a6a10', '#e0b030', '#fff0a0'],
  hell: ['#6a1a0a', '#d0401a', '#ffa050'],
  wood: ['#5e3a1c', '#9a6a35', '#c99a58'],
  cactus: ['#2c4e1f', '#4f8a3a', '#7fc060'],
  iron: ['#4a5058', '#9aa2aa', '#dce2e8'],
  crystal: ['#7a4a98', '#d890f0', '#fbd8ff'],
};

// Frasco de poción: chico (menor) o grande; liquid = [claro, oscuro]
function drawPotion(pc, big, liquid = ['#ff4a6a', '#c0203e']) {
  const top = big ? 3 : 5;
  pc.rect(6, top - 2, 4, 2, '#a3733a'); // corcho
  pc.rect(6, top, 4, 2, '#d8eef8'); // cuello
  const r = big ? 5.5 : 4.5;
  pc.disc(8, top + 2 + r, r, (x, y) => (y < top + 2 + r * 0.7 ? '#d8eef8' : y < top + 2 + r * 1.1 ? liquid[0] : liquid[1]));
  pc.set(6, top + 3, '#ffffff');
  pc.set(6, top + 4, '#ffffff');
  pc.outline('#1a120c');
}

// Cabeza chiquita para el mapa: piel, pelo y (opcional) gorro
function drawMapHead(pc, hair, hat = null, beard = null) {
  pc.disc(8, 9, 5.5, '#f0c090');
  pc.rect(3, 3, 11, 4, hair);
  pc.rect(3, 6, 2, 4, hair);
  pc.rect(12, 6, 2, 3, hair);
  if (hat) pc.rect(4, 1, 9, 3, hat);
  if (beard) pc.rect(5, 11, 7, 3, beard);
  pc.rect(6, 8, 1, 2, '#1a120c');
  pc.rect(10, 8, 1, 2, '#1a120c');
  pc.outline('#1a120c');
}

// Lingote en perspectiva: [claro, medio, oscuro]
function drawBar(pc, [light, mid, dark]) {
  pc.rect(2, 7, 12, 5, mid);
  pc.rect(4, 5, 10, 2, light);
  pc.rect(2, 7, 12, 1, light);
  pc.rect(2, 11, 12, 1, dark);
  pc.rect(12, 6, 2, 6, dark);
  pc.outline('#1a120c');
}

// ---------------------------------------------------------------- pintores en pixel art
const PIXEL = {
  dirt(pc, v) {
    fillNoise(pc, DIRT, v, 10);
    pebbles(pc, v, 11, '#b49a7c', '#4a2c14');
  },
  grass(pc, v) {
    PIXEL.dirt(pc, v);
    for (let x = 0; x < 16; x++) {
      const len = 2 + (hash(x, 1, 50 + v) < 0.55 ? 1 : 0) + (hash(x, 2, 50 + v) < 0.2 ? 1 : 0);
      for (let y = 0; y < len; y++) {
        const c = y === 0 ? GRASS_TOP.light : y === len - 1 ? GRASS_TOP.dark : hash(x, y, v) < 0.35 ? GRASS_TOP.alt : GRASS_TOP.mid;
        pc.set(x, y, c);
      }
    }
  },
  stone(pc, v) {
    fillNoise(pc, STONE, v, 20);
    for (let k = 0; k < 2; k++) {
      const x = 2 + Math.floor(hash(k, 5, 21 + v) * 10);
      const y = 2 + Math.floor(hash(k, 6, 21 + v) * 10);
      pc.line(x, y, x + 2, y + 2, '#2f333a');
      pc.set(x + 1, y, STONE[4]);
    }
  },
  // ---------- bloques de las zonas ----------
  sand(pc, v) {
    fillNoise(pc, ['#c9a85f', '#d6b770', '#e0c482', '#e9d094', '#f1dca8'], v, 140);
    pebbles(pc, v, 141, '#f7e8c0', '#a8884a');
  },
  sandstone(pc, v) {
    // Capas horizontales
    const bands = ['#b8894f', '#c99a5c', '#d6a96a', '#a87a44'];
    for (let y = 0; y < 16; y++) {
      const base = bands[Math.floor(y / 4 + hash(0, y >> 2, 142 + v) * 2) % 4];
      for (let x = 0; x < 16; x++) pc.set(x, y, hash(x, y, 143 + v) < 0.12 ? '#9a6e3c' : (y & 3) === 0 ? '#e0b87a' : base);
    }
  },
  snow(pc, v) {
    fillNoise(pc, ['#c3d2e2', '#d3dfec', '#e2ebf4', '#eef4fa', '#ffffff'], v, 150, [0.08, 0.3, 0.6, 0.85]);
    for (let x = 0; x < 16; x++) pc.set(x, 0, '#ffffff');
  },
  ice(pc, v) {
    fillNoise(pc, ['#5fa6d0', '#74b8de', '#8ac8e8', '#a2d7f0', '#c3e9f8'], v, 160);
    for (let i = 0; i < 2; i++) {
      const x = 2 + Math.floor(hash(i, 1, 161 + v) * 9);
      pc.line(x, 3 + i * 5, x + 4, 7 + i * 5, '#e8f8ff');
    }
  },
  jungle_grass(pc, v) {
    PIXEL.mud(pc, v);
    grassTop(pc, v, { light: '#9ef06a', mid: '#3fb03a', alt: '#52c447', dark: '#1f7a28' });
  },
  mud(pc, v) {
    fillNoise(pc, ['#3a281c', '#463022', '#523a2a', '#5e4332', '#6a4c3a'], v, 170);
    pebbles(pc, v, 171, '#7a5a44', '#2a1c12');
  },
  shadow_grass(pc, v) {
    PIXEL.dirt(pc, v);
    grassTop(pc, v, { light: '#d0a0ff', mid: '#8e5cc8', alt: '#a070d8', dark: '#5a3a8a' });
  },
  shadow_stone(pc, v) {
    fillNoise(pc, ['#241d32', '#2f2640', '#3a2f4e', '#46395e', '#554670'], v, 180);
    const x = 3 + Math.floor(hash(1, 1, 181 + v) * 8);
    pc.line(x, 2, x + 3, 9, '#7a4fb0');
    pc.line(x + 3, 9, x + 1, 13, '#7a4fb0');
  },
  crystal_grass(pc, v) {
    PIXEL.dirt(pc, v);
    grassTop(pc, v, { light: '#ffffff', mid: '#7fe0e8', alt: '#f0a8f0', dark: '#4fa0c0' });
  },
  crystal(pc, v) {
    // Facetas de cristal rosado con brillos
    fillNoise(pc, ['#7a3aa0', '#9a4ec0', '#b868d8', '#d690ee', '#f0c0ff'], v, 190, [0.15, 0.4, 0.7, 0.9]);
    pc.line(2, 13, 9, 2, '#f8e0ff');
    pc.line(8, 15, 14, 5, '#f8e0ff');
    pc.set(4 + Math.floor(hash(1, 2, 191 + v) * 8), 4, '#ffffff');
  },
  ash(pc, v) {
    fillNoise(pc, ['#363232', '#423d3c', '#4e4846', '#5a5452', '#68625f'], v, 200);
  },
  basalt(pc, v) {
    fillNoise(pc, ['#1c181a', '#262022', '#30282c', '#3a3034', '#463a40'], v, 210);
    // Grietas con brasas
    const x = 2 + Math.floor(hash(2, 1, 211 + v) * 10);
    pc.line(x, 4, x + 2, 9, '#ff7a1a');
    pc.set(x + 1, 6, '#ffd770');
  },
  lava(pc, v) {
    fillNoise(pc, ['#b8300a', '#d8460e', '#ee6416', '#ff8a24', '#ffb347'], v, 220, [0.12, 0.35, 0.65, 0.88]);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(i, 1, 221 + v) * 13);
      const y = Math.floor(hash(i, 2, 221 + v) * 14);
      pc.rect(x, y, 3, 1, '#ffe08a');
    }
  },
  cactus(pc) {
    pc.rect(4, 0, 8, 16, '#4f9a3c');
    for (const x of [5, 8, 10]) pc.rect(x, 0, 1, 16, '#3a7a2c');
    pc.rect(6, 0, 1, 16, '#6fbf52');
    for (let y = 1; y < 16; y += 4) {
      pc.set(3, y, '#f0f0d8');
      pc.set(12, y + 2, '#f0f0d8');
    }
  },
  plant_desert(pc) {
    // Arbusto seco
    for (const [x0, x1, y1] of [[8, 3, 7], [8, 12, 6], [8, 6, 4], [8, 11, 9], [8, 4, 10]]) pc.line(x0, 15, x1, y1, '#8a6a3a');
    pc.set(3, 7, '#a88a50');
    pc.set(12, 6, '#a88a50');
  },
  plant_desert2(pc) {
    // Cactus chiquito
    pc.rect(6, 7, 4, 9, '#4f9a3c');
    pc.rect(7, 7, 1, 9, '#6fbf52');
    pc.rect(3, 9, 3, 2, '#4f9a3c');
    pc.rect(3, 6, 2, 4, '#4f9a3c');
    pc.set(7, 6, '#ff7aa0');
    pc.outline('#244a1c');
  },
  plant_snow(pc, v) {
    for (let k = 0; k < 5; k++) {
      const x = 1 + k * 3;
      const h = 3 + Math.floor(hash(k, 1, 230 + v) * 5);
      pc.line(x, 15, x, 16 - h, k % 2 ? '#cfe8f0' : '#a8d0e0');
      pc.set(x, 16 - h, '#ffffff');
    }
  },
  plant_snow2(pc) {
    pc.disc(8, 12, 4, '#2f6a4a');
    pc.disc(8, 10, 3, '#ffffff');
    pc.rect(5, 12, 7, 1, '#e8f4fa');
  },
  plant_jungle(pc) {
    // Flor gigante rosada que brilla
    pc.line(8, 15, 8, 7, '#2f8a2c');
    pc.line(8, 12, 11, 10, '#3fb03a');
    for (const [x, y] of [[6, 5], [10, 5], [8, 3], [8, 7], [6, 7], [10, 7]]) pc.disc(x, y, 1.6, '#ff5fa0');
    pc.disc(8, 5, 1.2, '#ffe060');
  },
  plant_jungle2(pc) {
    // Bulbos azules luminosos
    pc.line(5, 15, 6, 8, '#2f8a2c');
    pc.line(11, 15, 10, 6, '#2f8a2c');
    pc.disc(6, 7, 2, '#5fd0ff');
    pc.disc(10, 5, 2, '#5fd0ff');
    pc.set(6, 6, '#ffffff');
    pc.set(10, 4, '#ffffff');
  },
  plant_shadow(pc) {
    // Hongo morado
    pc.rect(7, 9, 2, 7, '#c8b8d8');
    pc.disc(8, 8, 4.5, '#7a3ab8');
    pc.rect(3, 8, 11, 2, '#5a2a8a');
    pc.set(6, 6, '#e0b0ff');
    pc.set(10, 7, '#e0b0ff');
  },
  plant_shadow2(pc) {
    // Planta espinosa
    pc.line(8, 15, 5, 5, '#3a2a4a');
    pc.line(8, 15, 11, 6, '#3a2a4a');
    pc.line(8, 15, 8, 3, '#4a3a5a');
    for (const [x, y] of [[5, 5], [11, 6], [8, 3]]) pc.set(x, y, '#c070ff');
  },
  plant_crystal(pc) {
    crystalShard(pc, '#f090f0', '#ffd0ff');
  },
  plant_crystal2(pc) {
    crystalShard(pc, '#60e0f0', '#d0ffff');
  },
  plant_crystal3(pc) {
    crystalShard(pc, '#f0e060', '#fff8c0');
  },
  plant_volcano(pc) {
    // Flor de fuego
    pc.line(8, 15, 8, 8, '#4a3020');
    for (const [x, y] of [[6, 6], [10, 6], [8, 4]]) pc.disc(x, y, 1.7, '#ff7a1a');
    pc.disc(8, 6, 1.3, '#ffe060');
  },
  plant_volcano2(pc) {
    // Fumarola: roca con brasas
    pc.disc(8, 13, 4, '#2a2224');
    pc.rect(7, 9, 2, 2, '#ff8a24');
    pc.set(8, 8, '#ffd770');
    pc.set(5, 12, '#ff7a1a');
  },
  wall_sandstone(pc, v) {
    fillNoise(pc, ['#5a4228', '#664c2e', '#715534', '#7c5e3a', '#876840'], v, 240);
  },
  wall_ice(pc, v) {
    fillNoise(pc, ['#2e4f66', '#365b74', '#3f6782', '#487390', '#527f9c'], v, 250);
  },
  wall_mud(pc, v) {
    fillNoise(pc, ['#22170f', '#2a1d13', '#322317', '#3a291b', '#42301f'], v, 260);
  },
  wall_shadow(pc, v) {
    fillNoise(pc, ['#17121f', '#1d1727', '#231c2f', '#2a2238', '#312842'], v, 270);
  },
  wall_ash(pc, v) {
    fillNoise(pc, ['#1c1a1a', '#221f1f', '#282525', '#2e2a2a', '#353030'], v, 280);
  },
  cactus_item(pc) {
    pc.rect(5, 3, 6, 11, '#4f9a3c');
    pc.rect(6, 3, 1, 11, '#6fbf52');
    pc.rect(9, 3, 1, 11, '#3a7a2c');
    pc.outline('#244a1c');
  },
  cactus_sword(pc) {
    sword(pc, '#8fdc5e', '#4f9a3c', '#2e6a24');
  },
  crystal_sword(pc) {
    sword(pc, '#ffd0ff', '#e080f0', '#9a4ec0');
  },
  coal_ore(pc, v) {
    PIXEL.stone(pc, v);
    oreClumps(pc, v, 30, ['#111111', '#262626', '#555555']);
  },
  iron_ore(pc, v) {
    PIXEL.stone(pc, v);
    oreClumps(pc, v, 40, ['#7a4b2e', '#b07a52', '#ecbb92']);
  },
  log(pc, v) {
    for (let x = 0; x < 16; x++) {
      const base = x === 0 || x === 15 ? BARK[0] : x === 2 || x === 3 ? BARK[3] : pick(BARK.slice(1), hash(x, 0, 60 + v));
      for (let y = 0; y < 16; y++) pc.set(x, y, hash(x, y, 61 + v) < 0.12 && x > 0 && x < 15 ? BARK[1] : base);
    }
    if (v === 2) {
      pc.rect(6, 6, 4, 3, BARK[0]);
      pc.rect(7, 7, 2, 1, BARK[3]);
    }
  },
  leaves(pc, v) {
    fillNoise(pc, [LEAF.line, LEAF.dark, LEAF.mid, LEAF.light, LEAF.hi], v, 70, [0.08, 0.4, 0.78, 0.97]);
  },
  planks(pc, v) {
    const boards = ['#a3733a', '#b5843f', '#9a6a35'];
    for (let y = 0; y < 16; y++) {
      const b = y >> 2;
      const row = y & 3;
      const base = boards[Math.floor(hash(b, 0, 80 + v) * 3)];
      const seam = 3 + Math.floor(hash(b, 9, 80 + v) * 10);
      for (let x = 0; x < 16; x++) {
        let c = base;
        if (row === 0) c = '#c99a58';
        else if (row === 3) c = '#6e4a22';
        else if (hash(x, y, 81 + v) < 0.12) c = '#8f6230';
        if (x === seam && row !== 0) c = '#5e3e1c';
        pc.set(x, y, c);
      }
    }
  },
  workbench(pc) {
    pc.rect(0, 4, 16, 1, '#d6a061');
    pc.rect(0, 5, 16, 1, '#b07a3e');
    pc.rect(0, 6, 16, 1, '#7a4f22');
    pc.rect(1, 7, 2, 9, '#8a5a28');
    pc.rect(2, 7, 1, 9, '#6b4420');
    pc.rect(13, 7, 2, 9, '#8a5a28');
    pc.rect(14, 7, 1, 9, '#6b4420');
    pc.rect(3, 11, 10, 1, '#9a6a34');
    pc.rect(3, 12, 10, 1, '#6b4420');
    pc.rect(10, 2, 4, 2, '#8c8c8c'); // herramienta sobre la mesa
    pc.rect(10, 2, 4, 1, '#b8b8b8');
    pc.outline('#2e1c0c');
  },
  torch(pc) {
    pc.rect(7, 7, 1, 9, '#8a5a2b');
    pc.rect(8, 7, 1, 9, '#6b4420');
    const flame = [[1, 8, 8], [2, 7, 8], [3, 6, 9], [4, 6, 9], [5, 6, 9], [6, 7, 8]];
    for (const [y, x0, x1] of flame) for (let x = x0; x <= x1; x++) pc.set(x, y, '#ff8f00');
    pc.rect(7, 3, 2, 3, '#ffc107');
    pc.rect(7, 4, 1, 1, '#fff3b0');
    pc.set(8, 1, '#ffd54f');
  },
  bedrock(pc, v) {
    fillNoise(pc, ['#14141c', '#1f1f2b', '#2b2b3d', '#383852', '#46466a'], v, 90);
  },
  wall_dirt(pc, v) {
    fillNoise(pc, ['#24150a', '#2e1b0e', '#382212', '#422916', '#4c301a'], v, 100);
  },
  wall_stone(pc, v) {
    fillNoise(pc, ['#1a1d22', '#22262c', '#2b3037', '#353a42', '#3f454e'], v, 110);
  },
  wall_wood(pc, v) {
    drawWoodWall(pc, 0, 0, 16, 16, v);
  },

  wood_platform(pc, v) {
    // Tabla arriba (lo que se pisa) con dos ménsulas; abajo transparente
    for (let x = 0; x < 16; x++) {
      const seam = x === 4 + v * 3 || x === 11;
      pc.set(x, 0, '#d6a868');
      pc.set(x, 1, seam ? '#6e4a22' : '#b5843f');
      pc.set(x, 2, seam ? '#6e4a22' : hash(x, 2, 300 + v) < 0.2 ? '#9a6a35' : '#a3733a');
      pc.set(x, 3, '#6e4a22');
    }
    for (const bx of [2, 13]) {
      pc.rect(bx, 4, 1, 3, '#7a5228');
      pc.set(bx + (bx < 8 ? 1 : -1), 4, '#7a5228');
    }
  },
  glass(pc, v) {
    // Vidrio claro con reflejos en diagonal (deja ver lo de atrás)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, 'rgba(196,232,248,0.42)');
    for (let k = 0; k < 6; k++) {
      pc.set(3 + k + v, 10 - k, 'rgba(255,255,255,0.85)');
      pc.set(4 + k + v, 10 - k, 'rgba(255,255,255,0.5)');
    }
    pc.set(11, 12, 'rgba(255,255,255,0.7)');
    pc.set(12, 11, 'rgba(255,255,255,0.7)');
  },
  red_shingles(pc, v) {
    drawShingles(pc, v, ['#7a2a24', '#a33c33', '#c04a3e', '#dc705c']);
  },
  wood_shingles(pc, v) {
    drawShingles(pc, v, ['#4a3018', '#6b4a26', '#82592e', '#a37440']);
  },
  wall_glass(pc) {
    // Ventana vista desde adentro: marco de madera y vidrio por donde se ve el paisaje
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, 'rgba(170,215,240,0.25)');
    pc.rect(0, 0, 16, 1, '#6e4a22');
    pc.rect(0, 15, 16, 1, '#6e4a22');
    pc.rect(0, 0, 1, 16, '#6e4a22');
    pc.rect(15, 0, 1, 16, '#6e4a22');
    pc.rect(7, 0, 2, 16, '#7a5228');
    pc.rect(0, 7, 16, 2, '#7a5228');
    pc.set(3, 4, 'rgba(255,255,255,0.7)');
    pc.set(4, 3, 'rgba(255,255,255,0.7)');
    pc.set(11, 12, 'rgba(255,255,255,0.6)');
  },
  facade_window(pc) {
    // Ventana vista desde afuera: marco, cruz y vidrio oscuro con reflejo
    pc.rect(0, 0, 16, 16, '#5e3e1c');
    pc.rect(1, 1, 14, 14, '#24405a');
    for (let k = 0; k < 5; k++) {
      pc.set(2 + k, 6 - k, '#7fb6d8');
      pc.set(9 + k, 13 - k, '#5f96b8');
    }
    pc.rect(7, 1, 2, 14, '#7a5228');
    pc.rect(1, 7, 14, 2, '#7a5228');
    pc.rect(0, 15, 16, 1, '#3e2810');
    pc.rect(0, 14, 16, 1, '#a3733a'); // alféizar
  },
  glass_wall_item(pc) {
    PIXEL.wall_glass(pc);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if (x !== 7 && x !== 8 && y !== 7 && y !== 8) pc.set(x, y, '#9fd0e8');
    pc.set(3, 4, '#ffffff');
    pc.set(4, 3, '#ffffff');
  },

  // ---------- muebles (objetos de varios bloques: 16 px de arte por bloque) ----------
  door_closed(pc) {
    // Puerta de tablones con marco arriba, dos travesaños y manija
    pc.rect(0, 0, 16, 2, WOOD.dark);
    pc.rect(3, 2, 10, 46, WOOD.mid);
    for (const x of [5, 8, 11]) pc.rect(x, 2, 1, 46, WOOD.seam);
    pc.rect(3, 2, 1, 46, WOOD.light);
    for (const y of [9, 36]) {
      pc.rect(3, y, 10, 2, WOOD.light);
      pc.rect(3, y + 2, 10, 1, WOOD.dark);
    }
    pc.line(4, 34, 11, 13, WOOD.dark); // diagonal
    pc.rect(10, 23, 2, 3, '#e0c060');
    pc.set(10, 23, '#fff1a8');
    pc.outline(WOOD.line);
  },
  door_open(pc) {
    // Puerta abierta: el marco arriba y la hoja de canto junto a las bisagras (izquierda)
    pc.rect(0, 0, 16, 2, WOOD.dark);
    pc.rect(1, 2, 4, 46, WOOD.mid);
    pc.rect(1, 2, 1, 46, WOOD.light);
    pc.rect(4, 2, 1, 46, WOOD.dark);
    for (const y of [9, 36]) pc.rect(1, y, 4, 2, WOOD.light);
    pc.rect(5, 23, 1, 3, '#e0c060');
    pc.outline(WOOD.line);
  },
  chair(pc) {
    // Silla mirando a la derecha: respaldo a la izquierda, asiento a la altura de la cadera
    pc.rect(2, 6, 3, 26, WOOD.mid); // poste del respaldo (y pata de atrás)
    pc.rect(2, 6, 1, 26, WOOD.light);
    pc.rect(2, 6, 4, 2, WOOD.light);
    for (const y of [10, 14]) pc.rect(4, y, 2, 2, WOOD.mid);
    pc.rect(2, 21, 12, 2, WOOD.light); // asiento
    pc.rect(2, 23, 12, 1, WOOD.dark);
    pc.rect(11, 24, 3, 8, WOOD.mid); // pata de adelante
    pc.rect(13, 24, 1, 8, WOOD.dark);
    pc.rect(5, 27, 6, 1, WOOD.dark); // travesaño
    pc.outline(WOOD.line);
  },
  table(pc) {
    // Mesa de 3×2 bloques con un jarro encima
    pc.rect(1, 14, 46, 2, WOOD.light);
    pc.rect(1, 16, 46, 1, WOOD.mid);
    pc.rect(2, 17, 44, 2, WOOD.dark);
    for (const x of [4, 41]) {
      pc.rect(x, 19, 3, 13, WOOD.mid);
      pc.rect(x + 2, 19, 1, 13, WOOD.dark);
    }
    pc.rect(7, 25, 34, 1, WOOD.dark);
    // Jarro
    pc.rect(30, 8, 5, 6, '#c9d6e3');
    pc.rect(30, 8, 1, 6, '#ffffff');
    pc.rect(35, 9, 1, 3, '#9aa8b8');
    pc.rect(31, 9, 3, 1, '#7a4f22');
    pc.outline(WOOD.line);
  },
  bed(pc) {
    // Cama de 4×2 bloques: cabecera a la izquierda, almohada, sábana y frazada roja
    pc.rect(1, 6, 5, 26, WOOD.mid);
    pc.rect(1, 4, 5, 2, WOOD.light);
    pc.rect(1, 6, 1, 26, WOOD.light);
    pc.rect(58, 13, 5, 19, WOOD.mid);
    pc.rect(58, 12, 5, 1, WOOD.light);
    pc.rect(62, 13, 1, 19, WOOD.dark);
    pc.rect(6, 22, 52, 3, WOOD.mid); // larguero
    pc.rect(6, 25, 52, 1, WOOD.dark);
    pc.rect(6, 16, 52, 6, '#efe6d8'); // colchón
    pc.rect(6, 21, 52, 1, '#cfc3b0');
    pc.rect(7, 13, 11, 4, '#ffffff'); // almohada
    pc.rect(7, 16, 11, 1, '#d8d0c4');
    pc.rect(22, 15, 36, 6, '#c0392b'); // frazada
    pc.rect(22, 15, 36, 1, '#e05a4a');
    pc.rect(22, 20, 36, 1, '#8e2a1f');
    pc.rect(22, 15, 2, 6, '#f2efe8'); // doblez de la sábana
    for (let x = 28; x < 58; x += 6) pc.rect(x, 17, 2, 2, '#e05a4a');
    pc.outline(WOOD.line);
  },
  plant_grass(pc, v) {
    for (let k = 0; k < 5; k++) {
      const x = 1 + k * 3 + Math.floor(hash(k, 0, 120 + v) * 2);
      const h = 3 + Math.floor(hash(k, 1, 120 + v) * 6);
      const lean = hash(k, 2, 120 + v) < 0.5 ? -1 : 1;
      pc.line(x, 15, x + (h > 5 ? lean : 0), 16 - h, k % 2 ? '#43a047' : '#4caf50');
      pc.set(x + (h > 5 ? lean : 0), 16 - h, '#8fdc5e');
    }
  },
  plant_flower_red(pc, v) {
    PIXEL._flower(pc, v, '#e53935', '#ff8a80', '#ffd54f');
  },
  plant_flower_yellow(pc, v) {
    PIXEL._flower(pc, v, '#fbc02d', '#fff176', '#8d5524');
  },
  _flower(pc, v, petal, petalLight, center) {
    const x = 7 + (v % 2);
    const top = 6 + (v === 2 ? 2 : 0);
    pc.line(x, 15, x, top + 2, '#3e8e41');
    pc.set(x - 1, 12, '#4caf50');
    pc.set(x - 2, 11, '#4caf50');
    pc.set(x + 1, 13, '#4caf50');
    pc.set(x + 2, 12, '#4caf50');
    pc.disc(x, top, 2.3, petal);
    pc.set(x - 1, top - 1, petalLight);
    pc.set(x, top, center);
  },

  // ---------- ítems ----------
  wood(pc) {
    pc.rect(2, 5, 11, 6, '#6f4523');
    pc.rect(2, 6, 11, 1, '#82552c');
    pc.rect(2, 9, 11, 1, '#5a371b');
    pc.rect(5, 7, 4, 1, '#5a371b');
    pc.rect(12, 5, 3, 6, '#c99a5e');
    pc.rect(13, 7, 1, 2, '#a87a44');
    pc.outline('#2e1c0c');
  },
  coal(pc) {
    pc.disc(6, 9, 3, '#1e1e1e');
    pc.disc(10, 8, 3.2, '#2a2a2a');
    pc.disc(8, 11, 2.5, '#222222');
    pc.set(9, 6, '#5a5a5a');
    pc.set(5, 8, '#4a4a4a');
    pc.set(10, 7, '#3a3a3a');
    pc.outline('#000000');
  },
  wood_pickaxe(pc) {
    pickaxe(pc, '#b5843f', '#d9a865', '#8a5f2b');
  },
  wood_sword(pc) {
    sword(pc, '#c99a58', '#a3733a', '#6e4a22');
  },
  stone_sword(pc) {
    sword(pc, '#c2c8cf', '#8c939c', '#5d636b');
  },
  gel(pc) {
    pc.disc(8, 10, 5, '#4f9be8');
    pc.disc(8, 9, 4, '#6fb6ff');
    pc.rect(6, 6, 2, 2, '#d8ecff');
    pc.set(10, 8, '#a8d4ff');
    pc.outline('#1d3f6e');
  },
  wood_hammer(pc) {
    hammer(pc, '#d9a865', '#b5843f', '#8a5f2b');
  },
  iron_hammer(pc) {
    hammer(pc, '#e6eaef', '#b4bcc6', '#7c8590');
  },
  iron_pickaxe(pc) {
    pickaxe(pc, '#b4bcc6', '#e6eaef', '#7c8590');
  },
  iron_sword(pc) {
    sword(pc, '#eef2f6', '#b4bcc6', '#7c8590');
  },
  iron_dagger(pc) {
    // Hoja corta en diagonal con guarda y mango
    for (let i = 0; i < 6; i++) {
      pc.set(8 + i, 7 - i, '#eef2f6');
      pc.set(9 + i, 7 - i, '#b4bcc6');
      pc.set(8 + i, 8 - i, '#7c8590');
    }
    pc.line(5, 6, 9, 10, '#8a6a2a');
    pc.line(6, 6, 10, 10, '#c9a64a');
    pc.line(3, 13, 7, 9, '#5a3a1a');
    pc.line(4, 13, 7, 10, '#7a4f22');
    pc.outline('#1a120c');
  },
  stone_mace(pc) {
    // Mango largo y cabeza de piedra con púas
    for (let i = 0; i < 9; i++) {
      pc.set(2 + i, 14 - i, '#8a5a2b');
      pc.set(3 + i, 14 - i, '#6b4420');
    }
    pc.disc(11.5, 4.5, 3.6, '#8c939c');
    pc.disc(11, 4, 2.2, '#b4bcc6');
    for (const [x, y] of [[11, 0], [15, 4], [11, 8], [7, 4], [14, 1], [14, 7], [8, 1]]) pc.set(x, y, '#5d636b');
    pc.outline('#1a120c');
  },
  iron_spear(pc) {
    // Asta larga en diagonal y punta de hierro arriba a la derecha
    for (let i = 0; i < 12; i++) {
      pc.set(1 + i, 14 - i, '#8a5a2b');
      pc.set(2 + i, 14 - i, '#6b4420');
    }
    pc.rect(12, 1, 3, 3, '#b4bcc6');
    pc.set(15, 0, '#eef2f6');
    pc.set(14, 0, '#eef2f6');
    pc.set(15, 1, '#eef2f6');
    pc.set(12, 3, '#7c8590');
    pc.line(10, 5, 12, 3, '#7c8590');
    pc.outline('#1a120c');
  },
  wood_bow(pc) {
    bow(pc, '#a3733a', '#6e4a22');
  },
  iron_bow(pc) {
    bow(pc, '#b4bcc6', '#6c7480');
  },
  wood_arrow(pc) {
    // Flecha en diagonal: punta arriba a la derecha, plumas abajo a la izquierda
    for (let i = 0; i < 10; i++) pc.set(3 + i, 12 - i, '#a3733a');
    pc.rect(12, 2, 2, 2, '#b4bcc6');
    pc.set(14, 1, '#e6eaef');
    pc.set(2, 11, '#e8e8e8');
    pc.set(3, 13, '#e8e8e8');
    pc.set(1, 12, '#c0392b');
    pc.set(2, 14, '#c0392b');
    pc.outline('#1a120c');
  },
  wood_boomerang(pc) {
    // Bumerán en forma de V
    pc.line(2, 4, 8, 11, '#b5843f');
    pc.line(3, 3, 9, 10, '#d9a865');
    pc.line(8, 11, 14, 4, '#b5843f');
    pc.line(8, 10, 13, 4, '#8a5f2b');
    pc.line(2, 5, 8, 12, '#8a5f2b');
    pc.outline('#20160e');
  },
  throwing_knife(pc) {
    for (let i = 0; i < 7; i++) {
      pc.set(6 + i, 9 - i, '#eef2f6');
      pc.set(7 + i, 9 - i, '#9aa3ad');
    }
    pc.line(3, 12, 6, 9, '#3a3a3a');
    pc.line(4, 12, 6, 10, '#555555');
    pc.set(2, 13, '#c0392b');
    pc.outline('#1a120c');
  },
  iron_bar(pc) {
    // Lingote en perspectiva
    pc.rect(2, 7, 12, 5, '#9aa3ad');
    pc.rect(4, 5, 10, 2, '#d4dae0');
    pc.rect(2, 7, 12, 1, '#c2c9d1');
    pc.rect(2, 11, 12, 1, '#6c7480');
    pc.rect(12, 6, 2, 6, '#7c8590');
    pc.set(5, 8, '#ffffff');
    pc.outline('#2a2e34');
  },
  furnace_item(pc) {
    pc.rect(2, 4, 12, 11, '#7d7d84');
    pc.rect(3, 3, 10, 1, '#9a9aa2');
    pc.rect(5, 9, 6, 6, '#2a1a12');
    pc.rect(6, 11, 4, 4, '#ff8f00');
    pc.rect(7, 12, 2, 3, '#ffd54f');
    pc.rect(10, 1, 2, 3, '#5c5c63');
    pc.outline('#1e1e22');
  },
  anvil_item(pc) {
    pc.rect(2, 6, 12, 3, '#7c8590');
    pc.rect(1, 6, 2, 2, '#7c8590');
    pc.rect(3, 6, 10, 1, '#b4bcc6');
    pc.rect(6, 9, 4, 3, '#5d636b');
    pc.rect(4, 12, 8, 2, '#6c7480');
    pc.outline('#1e2024');
  },
  stone_brick(pc, v) {
    // Ladrillos grises con junta clara, en hileras alternadas
    for (let y = 0; y < 16; y++) {
      const row = y >> 2;
      const off = row % 2 ? 4 : 0;
      for (let x = 0; x < 16; x++) {
        const mortar = (y & 3) === 3 || (x + off) % 8 === 7;
        const brick = Math.floor((x + off) / 8) + row * 3;
        const base = ['#8a8a92', '#7e7e86', '#95959c'][Math.floor(hash(brick, 4, 130 + v) * 3)];
        let c = mortar ? '#5a5a62' : base;
        if (!mortar && (y & 3) === 0) c = '#a8a8ae';
        if (!mortar && hash(x, y, 131 + v) < 0.08) c = '#707078';
        pc.set(x, y, c);
      }
    }
  },
  chest(pc) {
    // Cofre de madera (2×2 bloques) con zunchos de hierro y cerradura
    pc.rect(2, 10, 28, 22, WOOD.mid);
    pc.rect(2, 6, 28, 6, WOOD.light);
    pc.rect(3, 4, 26, 2, WOOD.light);
    pc.rect(2, 12, 28, 2, WOOD.dark); // borde de la tapa
    for (let y = 16; y < 32; y += 4) pc.rect(3, y, 26, 1, WOOD.seam);
    for (const x of [4, 26]) {
      pc.rect(x, 4, 2, 28, '#8a929c');
      pc.rect(x, 4, 1, 28, '#c8ced6');
    }
    pc.rect(13, 11, 6, 6, '#c9a64a');
    pc.rect(14, 12, 4, 4, '#e0c060');
    pc.rect(15, 14, 2, 2, '#3a2a10');
    pc.outline(WOOD.line);
  },
  chest_item(pc) {
    pc.rect(1, 5, 14, 9, WOOD.mid);
    pc.rect(1, 3, 14, 3, WOOD.light);
    pc.rect(1, 6, 14, 1, WOOD.dark);
    pc.rect(2, 3, 1, 11, '#8a929c');
    pc.rect(13, 3, 1, 11, '#8a929c');
    pc.rect(7, 6, 2, 3, '#e0c060');
    pc.outline(WOOD.line);
  },
  furnace(pc) {
    // Horno de piedra (2×2 bloques): boca con fuego abajo y chimenea
    pc.disc(16, 16, 14, '#7d7d84');
    pc.rect(2, 16, 28, 16, '#7d7d84');
    // Juntas de los ladrillos (solo sobre la piedra)
    const mortar = (x, y) => {
      if (pc.get(x, y)) pc.set(x, y, '#66666d');
    };
    for (let y = 4; y < 32; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < 30; x += 8) for (let k = 0; k < 3; k++) mortar(x, y + k);
    for (let y = 7; y < 32; y += 4) for (let x = 2; x < 30; x++) mortar(x, y);
    pc.rect(25, 0, 4, 6, '#5c5c63');
    pc.rect(25, 0, 4, 1, '#8a8a92');
    pc.disc(16, 22, 6, '#2a1a12');
    pc.rect(10, 22, 13, 8, '#2a1a12');
    pc.rect(11, 25, 11, 5, '#ff8f00');
    pc.rect(12, 26, 9, 4, '#ffb300');
    pc.rect(14, 27, 5, 3, '#ffe082');
    pc.rect(9, 30, 15, 2, '#4a4a50');
    pc.outline('#1e1e22');
  },
  anvil(pc) {
    // Yunque de hierro (2×1 bloques) sobre un tronco
    pc.rect(5, 2, 22, 4, '#8a929c');
    pc.rect(2, 2, 4, 3, '#8a929c');
    pc.rect(5, 2, 22, 1, '#c8ced6');
    pc.rect(27, 3, 2, 2, '#6c7480');
    pc.rect(11, 6, 10, 3, '#6c7480');
    pc.rect(9, 9, 14, 2, '#7c8590');
    pc.rect(8, 11, 16, 5, '#7a4f22');
    pc.rect(8, 11, 16, 1, '#a3733a');
    pc.rect(10, 13, 1, 3, '#5a3a1a');
    pc.outline('#1e2024');
  },
  wood_wall_item(pc) {
    drawWoodWall(pc, 2, 2, 12, 12, 0);
    pc.outline('#20160e');
  },
  stone_wall_item(pc) {
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) pc.set(x, y, pick(['#22262c', '#2b3037', '#353a42', '#3f454e'], hash(x >> 1, y >> 1, 7)));
    pc.outline('#0e1014');
  },
  dirt_wall_item(pc) {
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) pc.set(x, y, pick(['#2e1b0e', '#382212', '#422916', '#4c301a'], hash(x >> 1, y >> 1, 9)));
    pc.outline('#140a04');
  },
  door_item(pc) {
    pc.rect(4, 1, 8, 14, WOOD.mid);
    for (const x of [6, 9]) pc.rect(x, 1, 1, 14, WOOD.seam);
    pc.rect(4, 1, 1, 14, WOOD.light);
    for (const y of [3, 11]) pc.rect(4, y, 8, 1, WOOD.light);
    pc.rect(10, 7, 1, 2, '#e0c060');
    pc.outline(WOOD.line);
  },
  chair_item(pc) {
    pc.rect(4, 2, 2, 13, WOOD.mid);
    pc.rect(4, 2, 1, 13, WOOD.light);
    pc.rect(4, 9, 8, 1, WOOD.light);
    pc.rect(4, 10, 8, 1, WOOD.dark);
    pc.rect(10, 11, 2, 4, WOOD.mid);
    pc.outline(WOOD.line);
  },
  table_item(pc) {
    pc.rect(1, 6, 14, 1, WOOD.light);
    pc.rect(1, 7, 14, 1, WOOD.dark);
    pc.rect(2, 8, 2, 7, WOOD.mid);
    pc.rect(12, 8, 2, 7, WOOD.mid);
    pc.rect(9, 3, 2, 3, '#c9d6e3');
    pc.outline(WOOD.line);
  },
  bed_item(pc) {
    pc.rect(1, 4, 2, 11, WOOD.mid);
    pc.rect(13, 7, 2, 8, WOOD.mid);
    pc.rect(3, 9, 10, 2, '#efe6d8');
    pc.rect(3, 8, 3, 1, '#ffffff');
    pc.rect(6, 8, 7, 3, '#c0392b');
    pc.rect(3, 11, 10, 1, WOOD.dark);
    pc.outline(WOOD.line);
  },
  stone_pickaxe(pc) {
    pickaxe(pc, '#8c939c', '#c2c8cf', '#5d636b');
  },

  // ---------- enemigos ----------
  slime(pc) {
    // 3 cuadros de 16×12: quieto, aplastado, estirado (gris claro: el juego lo tiñe de verde o azul)
    const body = (ox, w, h) => {
      const cx = ox + 8;
      for (let y = 12 - h; y < 12; y++) {
        const t = (y - (12 - h)) / h;
        const half = Math.round((w / 2) * Math.min(1, 0.55 + t * 1.2));
        for (let x = cx - half; x < cx + half; x++) pc.set(x, y, t < 0.35 ? '#ffffff' : t > 0.85 ? '#b8b8b8' : '#e2e2e2');
      }
      pc.rect(cx - 3, 12 - h + 2, 2, 1, '#ffffff');
      const ey = 12 - Math.ceil(h * 0.55);
      pc.rect(cx - 3, ey, 1, 2, '#1a1a1a');
      pc.rect(cx + 2, ey, 1, 2, '#1a1a1a');
    };
    body(0, 14, 9);
    body(16, 16, 6);
    body(32, 11, 12);
    pc.outline('#202020');
  },
  zombie(pc) {
    // 5 cuadros de 24×32 (como el jugador): caminar ×4 con los brazos hacia adelante y golpeado
    const C = {
      ...PLAYER_COLORS,
      skin: '#86b06e',
      skinShade: '#618a4e',
      mouth: '#3d5a2c',
      hair: '#2f3a22',
      hairLight: '#44532f',
      eyeWhite: '#e8e6a0',
      eye: '#a01818',
      shirt: '#5b6f86',
      shirtShade: '#435468',
      shirtLight: '#7489a2',
      pants: '#4a3b2c',
      pantsShade: '#33281d',
      belt: '#2a2016',
      buckle: '#6b5a3a',
    };
    const feet = [4, 1, -4, -1];
    feet.forEach((f, i) =>
      drawPose(pc, i * 24, 0, { name: 'z', lean: 1, bob: i % 2, frontLeg: { dx: f }, backLeg: { dx: -f }, front: [21, 15], back: [20, 17], eyes: 'wide', mouth: 'open' }, C),
    );
    drawPose(pc, 96, 0, { name: 'zh', lean: -2, headDx: -1, front: [18, 10], back: [5, 12], eyes: 'hurt', mouth: 'open' }, C);
    // Ropa rota: algunos agujeros en la camisa
    for (let i = 0; i < 5; i++) {
      pc.set(i * 24 + 11, 18, C.skinShade);
      pc.set(i * 24 + 13, 20, C.skinShade);
    }
    pc.outline('#141a10');
  },

  scorpion(pc) {
    // 3 cuadros de 20×12 caminando: pinzas adelante y la cola con el aguijón curvada sobre la espalda
    const B = ['#7a4318', '#a8642a', '#cf8a3e', '#eab070'];
    for (let f = 0; f < 3; f++) {
      const ox = f * 20;
      for (let k = 0; k < 4; k++) {
        const lx = ox + 6 + k * 2 + (f === 1 ? 0 : (k + f) % 2 ? 1 : -1);
        pc.set(lx, 10, B[0]);
        pc.set(lx + (k % 2 ? 1 : -1), 11, B[0]);
      }
      for (let x = 4; x < 15; x++) {
        const h = x < 6 || x > 13 ? 2 : 3;
        for (let y = 10 - h; y < 10; y++) pc.set(ox + x, y, y === 10 - h ? B[3] : x % 3 === 0 ? B[1] : B[2]);
      }
      const tail = [[3, 8], [2, 7], [1, 6], [1, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 1], [6, 2]];
      tail.forEach(([x, y], i) => {
        pc.set(ox + x, y, i % 2 ? B[1] : B[2]);
        pc.set(ox + x + 1, y, B[1]);
      });
      pc.set(ox + 7, 3, '#f4e0b0');
      pc.set(ox + 7, 4, '#3a1a08');
      const claw = f === 1 ? 1 : 0;
      pc.rect(ox + 15, 7, 2, 2, B[2]);
      pc.rect(ox + 17, 6 - claw, 2, 2, B[3]);
      pc.set(ox + 17, 8, B[1]);
      pc.set(ox + 18, 8 + claw, B[2]);
      pc.set(ox + 13, 7, '#1a0a00');
    }
    pc.outline('#2a1608');
  },
  wasp(pc) {
    // 2 cuadros de 16×14: alas arriba / abajo, abdomen a rayas y aguijón atrás
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      if (f === 0) {
        pc.rect(ox + 5, 1, 3, 5, '#e4f6ff');
        pc.rect(ox + 8, 2, 2, 4, '#c4e4f8');
      } else {
        pc.rect(ox + 3, 4, 7, 2, '#e4f6ff');
        pc.rect(ox + 4, 3, 4, 1, '#c4e4f8');
      }
      for (let x = 2; x < 10; x++) {
        for (let y = 6; y < 11; y++) {
          if ((x === 2 || x === 9) && (y === 6 || y === 10)) continue;
          pc.set(ox + x, y, (x >> 1) % 2 ? '#2a2216' : '#f2c432');
        }
      }
      pc.set(ox + 1, 9, '#2a2216');
      pc.set(ox, 10, '#2a2216');
      pc.rect(ox + 10, 6, 3, 4, '#f2c432');
      pc.set(ox + 12, 7, '#c02020');
      pc.set(ox + 11, 9, '#2a2216');
      pc.set(ox + 6, 11, '#2a2216');
      pc.set(ox + 8, 11, '#2a2216');
    }
    pc.outline('#1a140a');
  },
  eye(pc) {
    // 2 cuadros de 16×12: ojo con venas, pupila hacia adelante y tentáculos que se mueven atrás
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      for (let k = 0; k < 5; k++) {
        const y = 4 + k;
        pc.set(ox + 5 - (k % 2), y + (f ? k % 2 : 0), '#b03050');
        pc.set(ox + 3 - (k % 3), y + (f ? 0 : 1), '#902040');
      }
      pc.disc(ox + 10, 6, 4.4, (x, y, d) => (d > 0.8 ? '#d8c4c4' : '#f6f0f0'));
      pc.set(ox + 7, 4, '#d04040');
      pc.set(ox + 8, 3, '#d04040');
      pc.set(ox + 7, 8, '#d04040');
      pc.set(ox + 8, 9, '#d04040');
      pc.disc(ox + 12, 6, 2.2, '#7a3ab8');
      pc.disc(ox + 12.4, 6, 1.1, '#140818');
      pc.set(ox + 11, 5, '#ffffff');
    }
    pc.outline('#2a0a14');
  },
  firebat(pc) {
    // 3 cuadros de 18×12: alas arriba, al medio y abajo, con puntas encendidas
    const lift = [-3, 0, 3];
    for (let f = 0; f < 3; f++) {
      const ox = f * 18;
      for (const side of [-1, 1]) {
        for (let k = 1; k <= 6; k++) {
          const x = ox + 9 + side * (k + 1);
          const y = 5 + Math.round((lift[f] * k) / 6);
          pc.set(x, y, '#5a1a10');
          pc.set(x, y + 1, k % 2 ? '#8a2a14' : '#5a1a10');
          if (k < 5) pc.set(x, y + 2, '#3a0e08');
          if (k === 6) pc.set(x, y - 1, '#ffb030');
        }
      }
      pc.rect(ox + 8, 4, 3, 5, '#b8401a');
      pc.rect(ox + 8, 4, 3, 1, '#ff8a30');
      pc.set(ox + 8, 3, '#b8401a');
      pc.set(ox + 10, 3, '#b8401a');
      pc.set(ox + 8, 5, '#ffe060');
      pc.set(ox + 10, 5, '#ffe060');
    }
    pc.outline('#1a0806');
  },

  // ---------- fauna (bichos inofensivos de cada zona) ----------
  // Pájaros: 4 cuadros de 12×10 (posado, picoteando, alas arriba, alas abajo)
  critter_bird(pc, v, asset) {
    const [body, belly, wing, beak] = asset.colors;
    for (let f = 0; f < 4; f++) {
      const ox = f * 12;
      const peck = f === 1;
      const fly = f >= 2;
      pc.disc(ox + 5.5, 6, 3.2, (x, y) => (y > 6 ? belly : body));
      pc.rect(ox + 1, 4, 2, 2, wing); // cola
      pc.set(ox + 0, 3, wing);
      const hx = ox + 8;
      const hy = peck ? 7 : 3;
      pc.disc(hx, hy, 2, body);
      pc.set(hx + 2, hy, beak);
      pc.set(hx + 3, hy, beak);
      pc.set(hx + 1, hy - 1, '#1a120c');
      if (!fly) {
        pc.set(ox + 5, 9, '#4a3020');
        pc.set(ox + 7, 9, '#4a3020');
        pc.rect(ox + 4, 5, 3, 2, wing);
      } else if (f === 2) {
        for (let k = 0; k < 4; k++) pc.rect(ox + 3 + k, 1 + k, 1, 4 - k, wing);
      } else {
        for (let k = 0; k < 4; k++) pc.rect(ox + 3 + k, 7, 1, 3 - Math.floor(k / 2), wing);
      }
    }
    pc.outline('#1a120c');
  },
  // Conejo: 3 cuadros de 14×12 (sentado, agachado, saltando)
  critter_bunny(pc, v, asset) {
    const [fur, light] = asset.colors;
    for (let f = 0; f < 3; f++) {
      const ox = f * 14;
      const hop = f === 2;
      const low = f === 1 ? 1 : 0;
      pc.disc(ox + 6, 8 + low - (hop ? 2 : 0), hop ? 3 : 3.5, fur);
      if (hop) pc.rect(ox + 3, 8, 6, 2, fur);
      pc.disc(ox + 10, 6 + low - (hop ? 2 : 0), 2.4, fur);
      pc.rect(ox + 9, 1 + low - (hop ? 2 : 0), 1, 4, fur); // orejas
      pc.rect(ox + 11, 1 + low - (hop ? 2 : 0), 1, 4, fur);
      pc.set(ox + 9, 2 + low - (hop ? 2 : 0), '#f0a0b0');
      pc.set(ox + 11, 6 + low - (hop ? 2 : 0), '#1a120c');
      pc.set(ox + 12, 7 + low - (hop ? 2 : 0), '#f0a0b0');
      pc.disc(ox + 2.5, 7 + low - (hop ? 2 : 0), 1.2, light); // colita
      pc.rect(ox + 4, 10 + low - (hop ? 1 : 0), 2, 1, light);
      pc.rect(ox + 8, 10 + low - (hop ? 1 : 0), 2, 1, light);
    }
    pc.outline('#1a120c');
  },
  // Rana: 2 cuadros de 12×10 (sentada, saltando)
  critter_frog(pc, v, asset) {
    const [skin, belly] = asset.colors;
    for (let f = 0; f < 2; f++) {
      const ox = f * 12;
      const up = f ? 2 : 0;
      pc.disc(ox + 6, 7 - up, 3.4, (x, y) => (y > 7 - up ? belly : skin));
      pc.disc(ox + 4, 4 - up, 1.3, skin);
      pc.disc(ox + 8, 4 - up, 1.3, skin);
      pc.set(ox + 4, 4 - up, '#1a120c');
      pc.set(ox + 8, 4 - up, '#1a120c');
      if (f) {
        pc.rect(ox + 1, 8, 2, 1, skin);
        pc.rect(ox + 9, 8, 2, 1, skin);
      } else {
        pc.rect(ox + 2, 9, 3, 1, skin);
        pc.rect(ox + 7, 9, 3, 1, skin);
      }
    }
    pc.outline('#14200c');
  },
  // Caminadores (pingüino, lagartija, ratón, caracol): 2 cuadros
  critter_penguin(pc) {
    for (let f = 0; f < 2; f++) {
      const ox = f * 10;
      pc.disc(ox + 5, 7, 3.4, (x) => (x > ox + 5 ? '#f4f4f4' : '#22262e'));
      pc.disc(ox + 5.5, 3, 2.3, '#22262e');
      pc.set(ox + 6, 2, '#ffffff');
      pc.set(ox + 7, 3, '#f0a020');
      pc.set(ox + 8, 3, '#f0a020');
      pc.set(ox + (f ? 3 : 4), 11, '#f0a020');
      pc.set(ox + (f ? 6 : 7), 11, '#f0a020');
    }
    pc.outline('#0c0e12');
  },
  critter_lizard(pc, v, asset) {
    const [skin, dark] = asset.colors;
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      pc.rect(ox + 1, 5, 4, 1, dark); // cola
      pc.rect(ox + 4, 4, 8, 2, skin);
      pc.rect(ox + 11, 3, 3, 2, skin);
      pc.set(ox + 13, 3, '#1a120c');
      pc.set(ox + (f ? 5 : 6), 6, dark);
      pc.set(ox + (f ? 10 : 9), 6, dark);
      pc.set(ox + 7, 4, dark);
    }
    pc.outline('#1a120c');
  },
  critter_mouse(pc) {
    for (let f = 0; f < 2; f++) {
      const ox = f * 12;
      pc.disc(ox + 5, 5, 2.6, '#8a8078');
      pc.disc(ox + 8, 4.5, 1.6, '#8a8078');
      pc.set(ox + 7, 2, '#c8a0a0');
      pc.set(ox + 9, 4, '#1a120c');
      pc.set(ox + 10, 5, '#f0a0b0');
      pc.rect(ox + 0, 5 + f, 3, 1, '#c8a0a0');
      pc.set(ox + (f ? 4 : 5), 7, '#5a5048');
    }
    pc.outline('#1a120c');
  },
  critter_snail(pc) {
    for (let f = 0; f < 2; f++) {
      const ox = f * 12;
      pc.rect(ox + 1, 6, 9, 2, '#b8d8e8');
      pc.set(ox + 9, 4 + f, '#b8d8e8');
      pc.set(ox + 10, 3 + f, '#b8d8e8');
      pc.disc(ox + 5, 4, 2.8, (x, y, d) => (d < 0.4 ? '#c8f0ff' : d < 0.75 ? '#4a8aff' : '#2a5ad0'));
    }
    pc.outline('#0c1a30');
  },
  // Mariposa / polilla: 2 cuadros de 8×8 (alas abiertas, cerradas)
  critter_butterfly(pc, v, asset) {
    const [wing, spot] = asset.colors;
    for (let f = 0; f < 2; f++) {
      const ox = f * 8;
      pc.rect(ox + 3, 2, 1, 5, '#2a2216');
      if (f === 0) {
        pc.disc(ox + 1.5, 3, 1.6, wing);
        pc.disc(ox + 5.5, 3, 1.6, wing);
        pc.disc(ox + 1.8, 5.5, 1.1, wing);
        pc.disc(ox + 5.2, 5.5, 1.1, wing);
        pc.set(ox + 1, 3, spot);
        pc.set(ox + 6, 3, spot);
      } else {
        pc.rect(ox + 2, 1, 1, 4, wing);
        pc.rect(ox + 4, 1, 1, 4, wing);
      }
    }
  },
  // Buitre: 2 cuadros de 22×10 (alas extendidas, alas bajas)
  critter_vulture(pc) {
    for (let f = 0; f < 2; f++) {
      const ox = f * 22;
      const d = f ? 2 : 0;
      for (let k = 0; k < 8; k++) {
        pc.set(ox + 10 - k, 4 + Math.round(k * 0.2) + d * (k > 4 ? 1 : 0), '#3a2a20');
        pc.set(ox + 12 + k, 4 + Math.round(k * 0.2) + d * (k > 4 ? 1 : 0), '#3a2a20');
        pc.set(ox + 10 - k, 5 + Math.round(k * 0.2) + d * (k > 4 ? 1 : 0), '#5a4434');
        pc.set(ox + 12 + k, 5 + Math.round(k * 0.2) + d * (k > 4 ? 1 : 0), '#5a4434');
      }
      pc.rect(ox + 9, 4, 5, 3, '#4a3828');
      pc.rect(ox + 14, 3, 2, 2, '#d8a0a0');
      pc.set(ox + 16, 4, '#e0c060');
    }
    pc.outline('#1a120c');
  },

  // ---------- armaduras (el color sale de ARMOR_COLORS según asset.set) ----------
  armor_helmet(pc, v, asset) {
    const [dark, mid, light] = ARMOR_ICON[asset.set];
    pc.disc(8, 8, 5.5, (x, y) => (y < 6 ? light : mid));
    pc.rect(2, 9, 12, 5, mid);
    pc.rect(3, 9, 10, 1, light);
    pc.rect(5, 10, 6, 2, '#1a120c'); // visor
    pc.rect(2, 13, 12, 1, dark);
    pc.outline('#1a120c');
  },
  armor_chest(pc, v, asset) {
    const [dark, mid, light] = ARMOR_ICON[asset.set];
    pc.rect(2, 3, 12, 4, mid); // hombros
    pc.rect(4, 3, 8, 11, mid);
    pc.rect(5, 4, 2, 9, light);
    pc.rect(4, 13, 8, 1, dark);
    pc.rect(7, 3, 2, 2, dark); // cuello
    pc.outline('#1a120c');
  },
  armor_legs(pc, v, asset) {
    const [dark, mid, light] = ARMOR_ICON[asset.set];
    pc.rect(3, 2, 10, 3, mid);
    pc.rect(3, 5, 4, 8, mid);
    pc.rect(9, 5, 4, 8, mid);
    pc.rect(3, 5, 1, 8, light);
    pc.rect(9, 5, 1, 8, light);
    pc.rect(2, 12, 5, 2, dark);
    pc.rect(9, 12, 5, 2, dark);
    pc.outline('#1a120c');
  },
  potion_small(pc) {
    drawPotion(pc, false);
  },
  potion_big(pc) {
    drawPotion(pc, true);
  },
  life_crystal(pc) {
    // Cristal rojo con forma de corazón y brillo
    const heart = (x, y) => {
      const u = (x - 7.5) / 6;
      const w = (8 - y) / 6;
      return (u * u + w * w - 1) ** 3 - u * u * w * w * w < 0;
    };
    for (let y = 2; y < 15; y++) for (let x = 1; x < 15; x++) if (heart(x, y)) pc.set(x, y, y < 6 ? '#ff8aa0' : x < 7 ? '#ff4a6a' : '#d02848');
    pc.rect(4, 4, 2, 2, '#ffd0d8');
    pc.set(7, 7, '#ffd0d8');
    pc.outline('#4a0814');
  },
  recall_potion(pc) {
    drawPotion(pc, false, ['#5ab8ff', '#2a6ad0']);
  },
  magic_mirror(pc) {
    // Espejo de mano: marco dorado, vidrio celeste con reflejo y mango
    pc.rect(7, 11, 2, 4, '#a3733a');
    pc.disc(8, 6.5, 5.5, '#e8b830');
    pc.disc(8, 6.5, 4.2, (x, y) => (x + y < 13 ? '#c8f0ff' : '#7ac0e8'));
    pc.line(6, 5, 8, 3, '#ffffff');
    pc.set(10, 8, '#ffffff');
    pc.outline('#1a120c');
  },
  compass(pc) {
    pc.disc(8, 8, 6.5, '#b8862a');
    pc.disc(8, 8, 5.2, '#f4ecd8');
    pc.line(8, 3, 8, 8, '#d83030');
    pc.line(8, 8, 8, 13, '#4a5058');
    pc.rect(7, 7, 3, 2, '#1a120c');
    pc.set(8, 2, '#ffe070');
    pc.outline('#1a120c');
  },
  depth_meter(pc) {
    // Medidor: caja de metal con una escala y una aguja
    pc.rect(3, 2, 10, 12, '#6a7280');
    pc.rect(4, 3, 8, 10, '#1e2a3a');
    for (let y = 4; y < 13; y += 2) pc.rect(4, y, y % 4 ? 2 : 3, 1, '#9be7ff');
    pc.rect(7, 7, 5, 1, '#ffd84a');
    pc.rect(11, 6, 1, 3, '#ffd84a');
    pc.outline('#1a120c');
  },
  map_home(pc) {
    // Casita (tu cama / tu casa en el mapa)
    for (let y = 0; y < 6; y++) pc.rect(7 - y, 2 + y, 2 + y * 2, 1, '#d83a2a');
    pc.rect(3, 8, 10, 6, '#f0e2c0');
    pc.rect(7, 10, 3, 4, '#8a5a2a');
    pc.rect(4, 9, 2, 2, '#7ac0e8');
    pc.outline('#1a120c');
  },
  map_pin(pc) {
    pc.disc(8, 6, 4.5, '#ff4a4a');
    pc.disc(7, 5, 1.5, '#ffd0d0');
    for (let y = 10; y < 15; y++) pc.rect(8 - Math.max(0, 14 - y) / 3, y, 1 + Math.max(0, (14 - y) / 2), 1, '#c02020');
    pc.outline('#1a120c');
  },
  map_player(pc) {
    drawMapHead(pc, '#5a3418');
  },
  map_guide(pc) {
    drawMapHead(pc, '#7a4a1e', null, null);
  },
  map_merchant(pc) {
    drawMapHead(pc, '#d8d8d8', '#5a3a8a', '#e8e8e8');
  },
  map_nurse(pc) {
    drawMapHead(pc, '#d84a2a', '#ffffff');
  },
  flower_item(pc) {
    pc.rect(7, 8, 2, 7, '#3e8a34');
    pc.rect(9, 11, 3, 1, '#4caf50');
    for (const [x, y] of [[8, 3], [5, 5], [11, 5], [6, 8], [10, 8]]) pc.disc(x, y, 2, '#e85a8a');
    pc.disc(8, 6, 1.6, '#ffe070');
    pc.outline('#1a120c');
  },

  gold_ore(pc, v) {
    PIXEL.stone(pc, v);
    oreClumps(pc, v, 45, ['#8a6a10', '#e0b030', '#fff0a0']);
  },
  hellstone(pc, v) {
    fillNoise(pc, ['#2a1010', '#3a1414', '#4a1a16', '#5a2018', '#6a281a'], v, 230);
    // Vetas encendidas
    for (let k = 0; k < 3; k++) {
      const x = 2 + Math.floor(hash(k, 1, 231 + v) * 11);
      const y = 2 + Math.floor(hash(k, 2, 231 + v) * 11);
      pc.line(x, y, x + 3, y + 2, '#ff6a20');
      pc.set(x + 1, y + 1, '#ffd060');
    }
  },
  cloud_block(pc, v) {
    fillNoise(pc, ['#c8d8ec', '#dce8f6', '#eaf2fc', '#f6faff', '#ffffff'], v, 240, [0.12, 0.35, 0.65, 0.88]);
  },
  mushroom_grass(pc, v) {
    PIXEL.mud(pc, v);
    grassTop(pc, v, { light: '#b8e8ff', mid: '#4a8aff', alt: '#6aa8ff', dark: '#2a5ac8' });
  },
  mushroom_plant(pc) {
    // Hongo azul que brilla
    pc.rect(7, 8, 2, 8, '#c8e0ff');
    pc.disc(8, 7, 5, (x, y) => (y < 5 ? '#9ad0ff' : '#4a8aff'));
    pc.rect(3, 7, 11, 2, '#2a5ac8');
    pc.set(6, 4, '#ffffff');
    pc.set(10, 5, '#e0f4ff');
    pc.outline('#102040');
  },
  mushroom_plant2(pc) {
    // Dos hongos chicos
    for (const [x, h] of [[5, 6], [11, 4]]) {
      pc.rect(x, 16 - h, 1, h, '#c8e0ff');
      pc.disc(x, 16 - h, 3, (xx, y) => (y < 16 - h ? '#9ad0ff' : '#4a8aff'));
    }
    pc.outline('#102040');
  },
  gold_bar(pc) {
    drawBar(pc, ['#fff0a0', '#e0b030', '#a87a10']);
  },
  hellstone_bar(pc) {
    drawBar(pc, ['#ffa050', '#d0401a', '#7a1a0a']);
  },
  gold_pickaxe(pc) {
    pickaxe(pc, '#e0b030', '#fff0a0', '#a87a10');
  },
  hell_pickaxe(pc) {
    pickaxe(pc, '#d0401a', '#ffa050', '#6a1a0a');
  },
  gold_sword(pc) {
    sword(pc, '#fff6c0', '#e0b030', '#a87a10');
  },
  hell_sword(pc) {
    sword(pc, '#ffd070', '#ff6a20', '#a02a10');
  },
  gold_bow(pc) {
    bow(pc, '#e0b030', '#8a6a10');
  },

  trash(pc) {
    // Tacho de basura con tapa
    pc.rect(3, 3, 10, 2, '#c8ccd4');
    pc.rect(6, 1, 4, 2, '#c8ccd4');
    pc.rect(4, 5, 8, 10, '#9aa0aa');
    for (const x of [6, 8, 10]) pc.rect(x, 7, 1, 7, '#6a707a');
    pc.rect(4, 5, 1, 10, '#c8ccd4');
    pc.outline('#1e2024');
  },
  coin_copper(pc) {
    drawCoin(pc, ['#8a4a1e', '#c8743a', '#f0a868']);
  },
  coin_silver(pc) {
    drawCoin(pc, ['#6a7078', '#b8c0c8', '#f0f4f8']);
  },
  coin_gold(pc) {
    drawCoin(pc, ['#9a6a10', '#e0b030', '#fff0a0']);
  },
  // ---------- aldeanos (6 cuadros: quieto, caminar ×4, hablando) ----------
  npc_guide(pc) {
    drawNpc(pc, { hair: '#6b3d1a', hairLight: '#8a5228', shirt: '#4f8a3a', shirtShade: '#386629', shirtLight: '#6fae55', pants: '#6b5638', pantsShade: '#4d3e28' });
    pc.outline('#1a120c');
  },
  npc_merchant(pc) {
    drawNpc(
      pc,
      { hair: '#c8c8c8', hairLight: '#e8e8e8', shirt: '#7a3e9a', shirtShade: '#5a2b74', shirtLight: '#9a5ec0', pants: '#3e3a5a', pantsShade: '#2a2740', skin: '#e8b88a' },
      (ox, hx, hy) => {
        // Sombrero de ala ancha y barba blanca
        pc.rect(hx + 6, hy + 2, 13, 1, '#5a3a1e');
        pc.rect(hx + 8, hy - 1, 9, 3, '#7a5228');
        pc.rect(hx + 8, hy + 1, 9, 1, '#3e2810');
        pc.rect(hx + 11, hy + 8, 6, 3, '#f0f0f0');
        pc.rect(hx + 12, hy + 11, 4, 1, '#d8d8d8');
      },
    );
    pc.outline('#1a120c');
  },
  npc_nurse(pc) {
    drawNpc(
      pc,
      { hair: '#d86a8a', hairLight: '#f08aa8', shirt: '#f2f2f2', shirtShade: '#c8c8d0', shirtLight: '#ffffff', pants: '#f2f2f2', pantsShade: '#c8c8d0', belt: '#e04848', buckle: '#ffffff' },
      (ox, hx, hy) => {
        // Cofia blanca con cruz roja y pelo largo
        pc.rect(hx + 8, hy - 1, 8, 3, '#ffffff');
        pc.rect(hx + 11, hy - 1, 2, 3, '#e03030');
        pc.rect(hx + 10, hy, 4, 1, '#e03030');
        pc.rect(hx + 7, hy + 3, 3, 9, '#d86a8a');
      },
    );
    pc.outline('#1a120c');
  },

  // ---------- jugador (hoja de 8 cuadros) ----------
  player(pc, v, asset) {
    // Todas las poses de player/animations.js, 8 por fila (con la armadura puesta, si hay: asset.colors)
    const C = asset?.colors ? { ...PLAYER_COLORS, ...asset.colors } : PLAYER_COLORS;
    POSES.forEach((pose, i) => drawPose(pc, (i % SHEET_COLS) * ART_W, Math.floor(i / SHEET_COLS) * ART_H, pose, C));
    pc.outline('#1a120c');
  },

  // ---------- árboles ----------
  tree_top(pc) {
    for (let v = 0; v < 3; v++) drawCanopy(pc, v * 72, v);
  },
  tree_top_pine(pc) {
    // Pinos nevados: capas en forma de triángulo con nieve en los bordes
    for (let v = 0; v < 3; v++) {
      const cx = v * 72 + 36;
      const layers = 4 + v;
      for (let k = 0; k < layers; k++) {
        const top = 6 + k * (52 / layers);
        const half = 8 + k * (22 / layers) + 4;
        for (let y = 0; y < 52 / layers + 4; y++) {
          const w = Math.round((half * (y + 2)) / (52 / layers + 6));
          for (let x = -w; x <= w; x++) pc.set(cx + x, Math.round(top + y), y < 2 ? '#ffffff' : x < -w / 3 ? '#1f4a34' : '#2b6346');
        }
      }
    }
    pc.outline('#102a1c');
  },
  tree_top_jungle(pc) {
    for (let v = 0; v < 3; v++) drawCanopy(pc, v * 72, v, JUNGLE_LEAF, 1.08);
    // Lianas colgando
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * 72 + 14 + Math.floor(hash(i, 1, 300) * 44);
      const len = 6 + Math.floor(hash(i, 2, 300) * 10);
      pc.line(x, 50, x, 50 + len, '#2f7a28');
    }
  },
  tree_top_shadow(pc) {
    for (let v = 0; v < 3; v++) drawCanopy(pc, v * 72, v, SHADOW_LEAF, 0.85);
  },
  tree_branch(pc) {
    pc.line(0, 9, 5, 8, '#6b4423');
    pc.line(0, 10, 5, 9, '#4e2f17');
    pc.disc(10, 7, 4.5, LEAF.dark);
    pc.disc(9, 6, 3.2, LEAF.mid);
    pc.disc(8, 5, 1.6, LEAF.light);
    pc.outline(LEAF.line);
  },

  // ---------- cielo ----------
  sun(pc) {
    pc.disc(16, 16, 14, 'rgba(255,214,110,0.25)');
    pc.disc(16, 16, 11.5, 'rgba(255,224,130,0.45)');
    pc.disc(16, 16, 9, '#ffd54f');
    pc.disc(15, 15, 7, '#ffe57f');
    pc.disc(13, 13, 2.5, '#fff8d6');
  },
  moon(pc) {
    pc.disc(12, 12, 11, 'rgba(220,230,255,0.18)');
    pc.disc(12, 12, 8.5, '#dfe6f2');
    pc.disc(10, 10, 4.5, '#eef2f9');
    pc.disc(14, 15, 1.6, '#c3cddd');
    pc.disc(9, 13, 1.2, '#c3cddd');
    pc.disc(15, 9, 1, '#c3cddd');
  },
  cloud(pc) {
    const parts = [[16, 15, 7], [27, 11, 9], [41, 12, 8.5], [52, 15, 6.5]];
    for (const [x, y, r] of parts) pc.disc(x, y, r, '#ffffff');
    pc.rect(12, 15, 44, 6, '#ffffff');
    for (let y = 17; y < 24; y++) for (let x = 0; x < 64; x++) if (pc.get(x, y)) pc.set(x, y, '#dde6f3');
  },

  // ---------- interfaz ----------
  heart(pc) {
    const rows = ['.XX..XX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'];
    rows.forEach((row, y) => {
      for (let x = 0; x < 8; x++) {
        if (row[x] !== 'X') continue;
        pc.set(x + 2, y + 3, x >= 5 || y >= 4 ? '#b01e28' : '#e5303a');
      }
    });
    pc.set(3, 4, '#ff9aa0');
    pc.set(4, 4, '#ff9aa0');
    pc.outline('#3a0a0e');
  },
  crack(pc) {
    const c = 'rgba(0,0,0,0.78)';
    const stages = [
      [[8, 1, 7, 5], [7, 5, 9, 8]],
      [[9, 8, 6, 12], [7, 5, 3, 4]],
      [[6, 12, 7, 15], [9, 8, 13, 10], [3, 4, 1, 6]],
      [[13, 10, 15, 13], [8, 1, 12, 2], [6, 12, 2, 13], [12, 2, 14, 5]],
    ];
    for (let f = 0; f < 4; f++) {
      for (let s = 0; s <= f; s++) for (const [x0, y0, x1, y1] of stages[s]) pc.line(f * 16 + x0, y0, f * 16 + x1, y1, c);
    }
  },
};

// ---------------------------------------------------------------- pintores directos (canvas)
const CTX = {
  slot(ctx, w, h) {
    slotShape(ctx, w, h, 'rgba(48,62,150,0.74)', 'rgba(16,20,56,0.95)', 2, 'rgba(150,170,255,0.30)');
  },
  slot_selected(ctx, w, h) {
    slotShape(ctx, w, h, 'rgba(78,96,200,0.88)', '#ffd84a', 3, 'rgba(255,255,255,0.25)');
  },
  joystick_base(ctx, w, h) {
    circleBtn(ctx, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,215,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  },
  joystick_thumb(ctx, w, h) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,145,235,0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,238,255,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
  },
  button_jump(ctx, w, h) {
    circleBtn(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.27);
    ctx.lineTo(w * 0.72, h * 0.55);
    ctx.lineTo(w * 0.28, h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(w * 0.42, h * 0.54, w * 0.16, h * 0.2);
  },
  button_mine(ctx, w, h) {
    circleBtn(ctx, w, h);
    const pc = new PixelCanvas(16, 16);
    PIXEL.stone_pickaxe(pc);
    pc.draw(ctx, w / 2 - 16, h / 2 - 16, 2);
  },
  button_attack(ctx, w, h) {
    circleBtn(ctx, w, h);
    const pc = new PixelCanvas(16, 16);
    PIXEL.wood_sword(pc);
    pc.draw(ctx, w / 2 - 16, h / 2 - 16, 2);
  },
  button_place(ctx, w, h) {
    circleBtn(ctx, w, h);
    const pc = new PixelCanvas(16, 16);
    PIXEL.grass(pc, 0);
    pc.draw(ctx, w / 2 - 16, h / 2 - 16, 2);
  },
  button_dash(ctx, w, h) {
    // Embestida: tres flechas de velocidad hacia la derecha
    circleBtn(ctx, w, h);
    ctx.fillStyle = 'rgba(160,230,255,0.95)';
    for (let k = 0; k < 2; k++) {
      const x = w * (0.3 + k * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, h * 0.3);
      ctx.lineTo(x + w * 0.2, h * 0.5);
      ctx.lineTo(x, h * 0.7);
      ctx.lineTo(x + w * 0.08, h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  },
  button_fire(ctx, w, h) {
    // Bola de fuego
    circleBtn(ctx, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 2, w * 0.5, h * 0.55, w * 0.24);
    g.addColorStop(0, '#fff6c0');
    g.addColorStop(0.45, '#ffb030');
    g.addColorStop(1, '#e0400f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.56, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.52);
    ctx.quadraticCurveTo(w * 0.36, h * 0.24, w * 0.5, h * 0.2);
    ctx.quadraticCurveTo(w * 0.62, h * 0.3, w * 0.68, h * 0.5);
    ctx.fill();
  },
  fireball(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,250,210,1)');
    g.addColorStop(0.3, 'rgba(255,190,60,1)');
    g.addColorStop(0.65, 'rgba(240,80,20,0.85)');
    g.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  button_potion(ctx, w, h) {
    // Poción roja (curación rápida)
    circleBtn(ctx, w, h);
    const pc = new PixelCanvas(16, 16);
    drawPotion(pc, false);
    pc.draw(ctx, w / 2 - 16, h / 2 - 16, 2);
  },
  button_swap(ctx, w, h) {
    // Dos flechas opuestas (cambiar entre minar y colocar)
    circleBtn(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const arrow = (y, dir) => {
      const x0 = w * 0.28;
      const x1 = w * 0.72;
      ctx.fillRect(x0, y - 2, x1 - x0, 4);
      ctx.beginPath();
      const tip = dir > 0 ? x1 + 2 : x0 - 2;
      ctx.moveTo(tip, y);
      ctx.lineTo(tip - dir * w * 0.14, y - h * 0.1);
      ctx.lineTo(tip - dir * w * 0.14, y + h * 0.1);
      ctx.closePath();
      ctx.fill();
    };
    arrow(h * 0.4, 1);
    arrow(h * 0.62, -1);
  },
  button_inventory(ctx, w, h) {
    circleBtn(ctx, w, h);
    const c = w * 0.11;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.fillRect(w * 0.3 + x * c * 1.3, h * 0.3 + y * c * 1.3, c, c);
  },
  button_fullscreen(ctx, w, h) {
    ctx.fillStyle = 'rgba(20,28,70,0.5)';
    ctx.fillRect(0, 0, w, h);
    const a = w * 0.22;
    const m = w * 0.2;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
      ctx.fillRect(sx > 0 ? x : x - a, sy > 0 ? y : y - 3, a, 3);
      ctx.fillRect(sx > 0 ? x : x - 3, sy > 0 ? y : y - a, 3, a);
    }
  },
  glow(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,200,110,0.65)');
    g.addColorStop(0.35, 'rgba(255,160,60,0.22)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  stars(ctx, w, h) {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(hash(i, 1, 7) * w);
      const y = Math.floor(hash(i, 2, 7) * h);
      const big = hash(i, 3, 7) < 0.15;
      ctx.fillStyle = hash(i, 4, 7) < 0.3 ? 'rgba(190,210,255,0.9)' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(x, y, big ? 4 : 2, big ? 4 : 2);
    }
  },
  mountains(ctx, w, h, v, asset) {
    // Cordillera lejana repetible, con nieve (o lava, o cristal) en los picos más altos
    const th = BG_THEMES[asset?.theme || 'forest'];
    const [lit, shade, flat] = th.mountain;
    const hf = th.mountainShape || MOUNTAIN_SHAPE;
    const cols = w / 2;
    ridge(ctx, w, h, hf, (d, slope, x) => {
      const peak = hf(x / cols);
      if (th.cap && peak > th.capFrom && d < 2 + Math.round((peak - th.capFrom) * 30)) return th.cap;
      return slope > 0.004 ? lit : slope < -0.004 ? shade : flat;
    });
  },
  hills(ctx, w, h, v, asset) {
    const th = BG_THEMES[asset?.theme || 'forest'];
    const [top, lit, shade, flat] = th.hill;
    const hf = th.hillShape || HILL_SHAPE;
    ridge(ctx, w, h, hf, (d, slope) => (d < 2 ? top : slope > 0.004 ? lit : slope < -0.004 ? shade : flat));
    // Cosas sobre las colinas (arbolitos, cactus, pinos, cristales…)
    const cols = w / 2;
    for (let i = 0; i < th.hillProps; i++) {
      const x = Math.floor(hash(i, 1, 300) * cols);
      const base = Math.round(h / 2 - hf(x / cols) * (h / 2));
      const r = 3 + Math.floor(hash(i, 2, 300) * 3);
      for (const ox of [0, -cols, cols]) HILL_PROPS[th.hillProp](ctx, x + ox, base, r, th, i);
    }
  },
  forest(ctx, w, h, v, asset) {
    // Capa más cercana del paisaje: suelo + siluetas típicas de cada zona
    const th = BG_THEMES[asset?.theme || 'forest'];
    const cols = w / 2;
    const rows = h / 2;
    const ground = Math.round(rows * 0.8);
    FRONT[th.front](ctx, cols, rows, ground, th);
    ctx.fillStyle = th.ground;
    ctx.fillRect(0, ground * 2, w, h - ground * 2);
  },
  missing(ctx, w, h) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w / 2, h / 2);
    ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
  },
};

/** Dibuja la variante 'variant' de un asset y devuelve un canvas del tamaño del asset. */
export function paintPlaceholder(asset, variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = asset.width;
  canvas.height = asset.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const name = asset.placeholder;
  if (PIXEL[name]) {
    const pc = new PixelCanvas(asset.width / 2, asset.height / 2);
    PIXEL[name](pc, variant, asset);
    pc.draw(ctx, 0, 0, 2);
  } else {
    (CTX[name] || CTX.missing)(ctx, asset.width, asset.height, variant, asset);
  }
  return canvas;
}

/**
 * Hoja del jugador con la armadura puesta: el casco cambia el pelo, la pechera la camisa y las grebas
 * el pantalón y las botas. armor = [idCasco, idPechera, idGrebas] (o null). Devuelve la clave de la textura.
 * Si el jugador tiene una imagen propia (player.png), se usa esa sin cambios.
 */
export function playerOutfitTexture(scene, armor, items, sets) {
  const base = scene.textures.get('player').getSourceImage();
  if (!(base instanceof HTMLCanvasElement) || armor.every((a) => !a)) return 'player';
  const key = `player_${armor.map((a) => a || '-').join('_')}`;
  if (scene.textures.exists(key)) return key;
  const colors = {};
  const set = (i) => armor[i] && sets[items[armor[i]].armor.set];
  if (set(0)) Object.assign(colors, { hair: set(0).head[0], hairLight: set(0).head[1] });
  if (set(1)) Object.assign(colors, { shirt: set(1).body[0], shirtShade: set(1).body[1], shirtLight: set(1).body[2] });
  if (set(2)) Object.assign(colors, { pants: set(2).legs[0], pantsShade: set(2).legs[1], boots: set(2).boots[0], bootsShade: set(2).boots[1] });
  const asset = { ...ASSET_PLAYER, colors };
  createPlaceholderTexture(scene, key, asset);
  return key;
}
const ASSET_PLAYER = { width: 384, height: 256, frameWidth: 48, frameHeight: 64, placeholder: 'player' };

/** Crea en el TextureManager la textura placeholder (y sus cuadros si es una hoja de sprites). */
export function createPlaceholderTexture(scene, key, asset) {
  const texture = scene.textures.addCanvas(key, paintPlaceholder(asset, 0));
  if (asset.frameWidth) {
    const cols = Math.floor(asset.width / asset.frameWidth);
    const rows = Math.floor(asset.height / asset.frameHeight);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        texture.add(r * cols + c, 0, c * asset.frameWidth, r * asset.frameHeight, asset.frameWidth, asset.frameHeight);
      }
    }
  }
  return texture;
}

/** Los botones/círculos/brillos de la interfaz se ven mejor con filtrado suave. */
export function applyTextureFilter(scene, key, asset) {
  if (asset.smooth && scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** Cantidad de cuadros reales de una textura (sin contar el cuadro base de Phaser). */
export function frameCount(scene, key) {
  const t = scene.textures.get(key);
  return Math.max(1, t.frameTotal - 1);
}
