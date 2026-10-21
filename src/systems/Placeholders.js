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

function drawCanopy(pc, ox, v) {
  const layouts = [
    [[36, 30, 20], [22, 36, 13], [50, 36, 13], [30, 20, 12], [44, 20, 12], [36, 44, 12]],
    [[36, 26, 16], [36, 40, 15], [25, 33, 12], [47, 33, 12], [36, 13, 11]],
    [[36, 32, 18], [18, 38, 12], [54, 38, 12], [26, 23, 12], [46, 23, 12]],
  ];
  const discs = layouts[v % layouts.length];
  for (const [x, y, r] of discs) pc.disc(ox + x, y, r, LEAF.dark);
  for (const [x, y, r] of discs) pc.disc(ox + x - 2, y - 2, r - 2.5, LEAF.mid);
  for (const [x, y, r] of discs) pc.disc(ox + x - 4, y - 5, r - 6.5, LEAF.light);
  // Textura de hojas: algunos píxeles un tono más oscuro y brillos
  const darker = { [LEAF.mid]: LEAF.dark, [LEAF.light]: LEAF.mid, [LEAF.dark]: LEAF.line };
  for (let y = 0; y < pc.h; y++) {
    for (let x = ox; x < ox + 72; x++) {
      const c = pc.get(x, y);
      if (!c) continue;
      const t = hash(x, y, 900 + v);
      if (t < 0.13) pc.set(x, y, darker[c] || c);
      else if (t > 0.985 && c === LEAF.light) pc.set(x, y, LEAF.hi);
    }
  }
  pc.outline(LEAF.line);
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
    for (let y = Math.max(0, top); y < rows; y++) {
      ctx.fillStyle = colorFn(y - top, slope, x, y);
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

const TAU = Math.PI * 2;

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

  // ---------- jugador (hoja de 8 cuadros) ----------
  player(pc) {
    // Todas las poses de player/animations.js, 8 por fila
    POSES.forEach((pose, i) => drawPose(pc, (i % SHEET_COLS) * ART_W, Math.floor(i / SHEET_COLS) * ART_H, pose));
    pc.outline('#1a120c');
  },

  // ---------- árboles ----------
  tree_top(pc) {
    for (let v = 0; v < 3; v++) drawCanopy(pc, v * 72, v);
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
  mountains(ctx, w, h) {
    // Cordillera lejana repetible, con nieve en los picos más altos
    const hf = (u) =>
      0.25 + 0.42 * (0.5 + 0.5 * Math.sin(TAU * 2 * u + 0.3)) * (1 - Math.abs(Math.sin(Math.PI * 5 * u + 1))) + 0.12 * (0.5 + 0.5 * Math.sin(TAU * 9 * u));
    const cols = w / 2;
    ridge(ctx, w, h, hf, (d, slope, x) => {
      const peak = hf(x / cols);
      if (peak > 0.55 && d < 2 + Math.round((peak - 0.55) * 30)) return '#e6eef8';
      return slope > 0.004 ? '#93add2' : slope < -0.004 ? '#7590b8' : '#8399c0';
    });
  },
  hills(ctx, w, h) {
    const hf = (u) => 0.42 + 0.16 * Math.sin(TAU * 3 * u + 1) + 0.09 * Math.sin(TAU * 7 * u + 2);
    ridge(ctx, w, h, hf, (d, slope) => (d < 2 ? '#86c47a' : slope > 0.004 ? '#5ea657' : slope < -0.004 ? '#4f9149' : '#57a050'));
    // Arbolitos sobre las colinas
    const cols = w / 2;
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(hash(i, 1, 300) * cols);
      const top = Math.round(h / 2 - hf(x / cols) * (h / 2));
      const r = 3 + Math.floor(hash(i, 2, 300) * 3);
      ctx.fillStyle = '#4a3522';
      for (const ox of [0, -cols, cols]) ctx.fillRect((x + ox) * 2, (top - 3) * 2, 2, 8);
      ctx.fillStyle = '#3f7d3c';
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        for (const ox of [0, -cols, cols]) ctx.fillRect((x - half + ox) * 2, (top - r - 2 + dy) * 2, (half * 2 + 1) * 2, 2);
      }
    }
  },
  forest(ctx, w, h) {
    const cols = w / 2;
    const rows = h / 2;
    const ground = Math.round(rows * 0.8);
    ctx.fillStyle = '#2b5a2c';
    ctx.fillRect(0, ground * 2, w, h - ground * 2);
    for (let i = 0; i < 60; i++) {
      const x = Math.floor((i / 60) * cols + hash(i, 1, 400) * 6);
      const th = 14 + Math.floor(hash(i, 2, 400) * 22);
      const r = 5 + Math.floor(hash(i, 3, 400) * 4);
      const cy = ground - th;
      for (const ox of [0, -cols, cols]) {
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect((x + ox) * 2, cy * 2, 4, (th + 2) * 2);
        for (let dy = -r; dy <= r; dy++) {
          const half = Math.floor(Math.sqrt(r * r - dy * dy));
          ctx.fillStyle = dy < -r / 3 ? '#3c7340' : '#2f6332';
          ctx.fillRect((x - half + ox) * 2, (cy + dy) * 2, (half * 2 + 1) * 2, 2);
        }
      }
    }
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
    (CTX[name] || CTX.missing)(ctx, asset.width, asset.height, variant);
  }
  return canvas;
}

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
