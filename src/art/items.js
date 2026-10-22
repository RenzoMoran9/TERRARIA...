// Arte mejorado: items. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Materiales, pociones, monedas, reliquias y otros ítems (16×16 lógicos). Luz desde arriba a la izquierda;
// sombras más frías y saturadas, brillos más cálidos; contorno de 1 px del color local oscurecido.
// Los destellos se pintan después del contorno para que "salten" sobre el borde.
import { hash } from '../systems/PixelArt.js';

// ---------------------------------------------------------------- paletas (oscuro → claro)
// Madera de muebles (igual que building.js): hondo, oscuro, medio, base, claro, brillo
const WD = { k: '#4a2913', d: '#6a401f', m: '#8a572b', b: '#a66f37', l: '#c48c4c', h: '#e2b26e' };
// Metales: [hondo, oscuro, medio, base, claro, brillo, blanco]
const IRON = ['#272b3c', '#3e4558', '#5b6476', '#7a8494', '#a2acb8', '#d4dade', '#ffffff'];
const GOLD = ['#5e2f10', '#9a5a1a', '#cc8a28', '#e8b440', '#f8d870', '#fff6c4', '#ffffff'];
const COPPER = ['#4a1a0c', '#7a3416', '#a85224', '#cc7038', '#ec9a5c', '#ffc896', '#fff0dc'];
const SILVER = ['#2a3044', '#4c5468', '#76808f', '#a2abb8', '#cad1da', '#eef2f6', '#ffffff'];
const HELL = ['#1a0408', '#34090c', '#521210', '#701e14', '#902c16', '#b8441c', '#ffd27a'];
// Fuego: rojo hondo → blanco
const FIRE = ['#7a1a0a', '#c23a0e', '#ee6a18', '#ffa22c', '#ffd65a', '#fff6cc'];
const SPARK = '#fff8dc';

// ---------------------------------------------------------------- ayudantes
const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const inkCache = new Map();

// Tono de contorno: el color local muy oscurecido, algo más saturado y corrido al frío
function ink(c) {
  if (!c || c[0] !== '#') return '#14202e';
  let v = inkCache.get(c);
  if (v) return v;
  const [r, g, b] = rgb(c);
  const f = Math.min(0.42, 60 / Math.max(r, g, b, 1));
  const a = [r * f, g * f, b * f];
  const mean = (a[0] + a[1] + a[2]) / 3;
  v = toHex(mean + (a[0] - mean) * 1.3 - 2, mean + (a[1] - mean) * 1.3, mean + (a[2] - mean) * 1.3 + 7);
  inkCache.set(c, v);
  return v;
}

// Contorno exterior con el tono oscuro del vecino más oscuro (no negro puro)
function rim(pc) {
  const add = [];
  for (let y = 0; y < pc.h; y++) {
    for (let x = 0; x < pc.w; x++) {
      if (pc.get(x, y)) continue;
      let best = null;
      let bl = 1e9;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const c = pc.get(x + dx, y + dy);
        if (!c) continue;
        const k = ink(c);
        const [r, g, b] = rgb(k);
        const l = r * 3 + g * 6 + b;
        if (l < bl) {
          bl = l;
          best = k;
        }
      }
      if (best) add.push(x, y, best);
    }
  }
  for (let i = 0; i < add.length; i += 3) pc.set(add[i], add[i + 1], add[i + 2]);
}

// Dibujo con texto: cada letra es un color de la paleta ('.' o ' ' = vacío)
function paint(pc, rows, pal, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const c = pal[r[x]];
      if (c) pc.set(ox + x, oy + y, c);
    }
  }
}

// Máscara 16×16 a partir de una función (x, y) → bool
function mask(fn) {
  const m = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (fn(x, y)) m[y * 16 + x] = 1;
  return m;
}
const inM = (m, x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && m[y * 16 + x] === 1;

// Máscara por tramos: { y: [x0, x1, x0, x1...] }
function spans(rows) {
  const m = new Uint8Array(256);
  for (const k in rows) {
    const y = +k;
    const s = rows[k];
    for (let i = 0; i < s.length; i += 2) for (let x = s[i]; x <= s[i + 1]; x++) m[y * 16 + x] = 1;
  }
  return m;
}

// Máscara de un polígono (lista de [x, y]); se prueba el centro de cada píxel
function poly(pts) {
  return mask((x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

// Facetas tipo piedra tallada: cada píxel toma el tono de la semilla [x, y, tono] más cercana;
// las aristas que miran a la luz se aclaran y el borde de abajo-derecha se oscurece.
function facets(pc, m, seeds, R) {
  const id = new Int8Array(256).fill(-1);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inM(m, x, y)) continue;
      let best = 1e9;
      for (let k = 0; k < seeds.length; k++) {
        const dd = (x - seeds[k][0]) ** 2 + (y - seeds[k][1]) ** 2;
        if (dd < best) {
          best = dd;
          id[y * 16 + x] = k;
        }
      }
    }
  }
  const at = (x, y) => (inM(m, x, y) ? id[y * 16 + x] : -1);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const k = at(x, y);
      if (k < 0) continue;
      let t = seeds[k][2];
      const up = at(x, y - 1);
      const lf = at(x - 1, y);
      const dn = at(x, y + 1);
      const rt = at(x + 1, y);
      if ((up >= 0 && up !== k) || (lf >= 0 && lf !== k)) t = Math.min(R.length - 2, t + 1);
      else if ((dn >= 0 && dn !== k && seeds[dn][2] > t) || (rt >= 0 && rt !== k && seeds[rt][2] > t)) t = Math.max(0, t - 1);
      if (rt < 0 || dn < 0) t = Math.max(0, t - 1);
      pc.set(x, y, R[t]);
    }
  }
}

// Biselado direccional (luz arriba-izquierda) sobre una máscara. R = [hondo, oscuro, medio, base, claro, brillo]
function bevel(pc, m, R) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inM(m, x, y)) continue;
      const L = !inM(m, x - 1, y);
      const U = !inM(m, x, y - 1);
      const Rr = !inM(m, x + 1, y);
      const D = !inM(m, x, y + 1);
      let c = R[3];
      if (U && L) c = R[5];
      else if (U || L) c = R[4];
      else if (D && Rr) c = R[1];
      else if (D || Rr) c = R[2];
      else if (!inM(m, x + 1, y + 1)) c = R[2];
      pc.set(x, y, c);
    }
  }
}

// Esfera: cuánta luz recibe un punto (arriba-izquierda, algo de frente) ≈ -0.7..1
function sphereLight(x, y, cx, cy, r) {
  const nx = (x - cx) / r;
  const ny = (y - cy) / r;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return nx * -0.48 + ny * -0.56 + nz * 0.68;
}

// Destello de 4 puntas (big) o de un píxel
function glint(pc, x, y, big = true, arm = SPARK) {
  pc.set(x, y, '#ffffff');
  if (!big) return;
  pc.set(x - 1, y, arm);
  pc.set(x + 1, y, arm);
  pc.set(x, y - 1, arm);
  pc.set(x, y + 1, arm);
}

// ---------------------------------------------------------------- formas compartidas
// Lingote en perspectiva: cara de arriba, filo biselado que brilla, frente y costado derecho en sombra.
// Letras → índice de la rampa R de 7 tonos (K hondo … W blanco).
const INGOT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....HLLLLLLLLLM.',
  '...HLLLLLLLLLMD.',
  '..HLLLLLLLLLMDD.',
  '.WHHHHHHHHHHMDD.',
  '.LBBBBBBBBBBMDK.',
  '.LBBBBBBBBBBMK..',
  '.MMMMMMMMMMMK...',
  '................',
];
const RAMP_KEYS = { K: 0, D: 1, M: 2, B: 3, L: 4, H: 5, W: 6 };
function ingot(pc, R, veins) {
  const pal = {};
  for (const k in RAMP_KEYS) pal[k] = R[RAMP_KEYS[k]];
  paint(pc, INGOT, pal);
  // Reflejos del metal pulido: franja clara y franja oscura en diagonal sobre la cara de arriba
  for (const [x, y] of [[6, 7], [7, 6], [8, 5]]) pc.set(x, y, R[5]);
  for (const [x, y] of [[9, 7], [10, 6], [11, 5], [10, 7], [11, 6], [12, 5]]) pc.set(x, y, R[3]);
  for (const [x, y] of [[3, 9], [3, 10]]) pc.set(x, y, R[4]);
  for (const [x, y] of [[9, 9], [9, 10], [10, 10]]) pc.set(x, y, R[2]);
  if (veins) veins();
  rim(pc);
  pc.set(2, 8, R[6]);
  pc.set(4, 5, R[6]);
}

// Moneda redonda vista de frente: canto estriado abajo, borde en relieve, ranura grabada y estrella acuñada.
const COIN_ROWS = { 2: [6, 9], 3: [4, 11], 4: [3, 12], 5: [3, 12], 6: [2, 13], 7: [2, 13], 8: [2, 13], 9: [2, 13], 10: [3, 12], 11: [3, 12], 12: [4, 11], 13: [6, 9] };
const COIN_STAR = ['..6..', '.665.', '66654', '.554.', '.5.4.'];
function coin(pc, R) {
  const inC = (x, y) => !!COIN_ROWS[y] && x >= COIN_ROWS[y][0] && x <= COIN_ROWS[y][1];
  const isEdge = (x, y) => inC(x, y) && (!inC(x - 1, y) || !inC(x + 1, y) || !inC(x, y - 1) || !inC(x, y + 1));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (inC(x, y)) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const lit = (-dx - dy) / (Math.abs(dx) + Math.abs(dy) + 0.001); // 1 = arriba-izquierda
        let c = R[3];
        if (isEdge(x, y)) c = lit > 0.4 ? R[5] : lit > -0.4 ? R[4] : lit > -0.85 ? R[3] : R[2];
        else if (isEdge(x - 1, y) || isEdge(x + 1, y) || isEdge(x, y - 1) || isEdge(x, y + 1)) c = lit > 0.3 ? R[2] : lit < -0.3 ? R[4] : R[3];
        pc.set(x, y, c);
      } else if (inC(x, y - 1)) {
        // Canto (grosor) con estrías
        pc.set(x, y, x % 2 ? R[1] : R[2]);
      }
    }
  }
  // Estrella en relieve con su sombra abajo-derecha
  const star = (i, j) => (COIN_STAR[j] || '')[i] > '.';
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (!star(i, j) && star(i - 1, j - 1)) pc.set(5 + i, 5 + j, R[2]);
  paint(pc, COIN_STAR, { 2: R[2], 3: R[3], 4: R[4], 5: R[5], 6: R[6] }, 5, 5);
  rim(pc);
  glint(pc, 4, 4, false);
  pc.set(6, 2, R[6]);
}

// Frasco de vidrio (dibujo con texto) con el líquido de la paleta Q
const GLASS = { g: '#c4e8f4', G: '#6e9ab8', a: 'rgba(190,232,255,0.32)', W: '#ffffff', c: '#d8a468', C: '#a8703a', o: '#6e4220' };
function flask(pc, rows, Q, oy, sparkles) {
  paint(pc, rows, { ...GLASS, ...Q }, 0, oy);
  rim(pc);
  if (sparkles) sparkles();
}

// ---------------------------------------------------------------- pintores
export const PIXEL = {
  // ---------- materiales ----------
  wood(pc) {
    // Tronco acostado: corteza con surcos a lo largo, corte a la vista con anillos y médula, y una ramita con hoja
    const B = ['#341c0c', '#52301a', '#6e4320', '#8c5a2c', '#a8723a', '#c4904e'];
    const E = ['#7a4a22', '#b07a40', '#d6a466', '#ecc68a', '#fadfae'];
    const cx = 11.5;
    const cy = 8.5;
    for (let y = 5; y <= 12; y++) {
      for (let x = 1; x <= 11; x++) {
        if (x === 1 && (y === 5 || y === 12)) continue;
        pc.set(x, y, B[[5, 4, 3, 3, 3, 2, 1, 0][y - 5]]);
      }
    }
    // Surcos de la corteza: raya oscura con su borde de luz arriba
    for (const [x0, x1, y] of [[2, 5, 7], [6, 9, 6], [3, 7, 9], [8, 10, 8], [2, 4, 11], [6, 9, 10]]) {
      for (let x = x0; x <= x1; x++) {
        pc.set(x, y, B[Math.max(0, [5, 4, 3, 3, 3, 2, 1, 0][y - 5] - 2)]);
        if (y > 5) pc.set(x, y - 1, B[Math.min(5, [5, 4, 3, 3, 3, 2, 1, 0][y - 6] + 1)]);
      }
    }
    // Nudo
    pc.set(5, 9, B[0]);
    pc.set(4, 9, B[1]);
    pc.set(5, 8, B[4]);
    // Corte: elipse con corteza, albura clara, un anillo y la médula
    for (let y = 3; y <= 14; y++) {
      for (let x = 8; x <= 15; x++) {
        const dx = (x - cx) / 3.3;
        const dy = (y - cy) / 4.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        const lit = x - cx + (y - cy) < -1.5;
        let c;
        if (d > 0.82) c = lit ? B[4] : x - cx + (y - cy) > 2 ? B[0] : B[2];
        else if (d > 0.62) c = lit ? E[4] : E[3];
        else if (d > 0.46) c = E[1];
        else if (d > 0.18) c = lit ? E[4] : E[3];
        else c = E[0];
        pc.set(x, y, c);
      }
    }
    // Grieta en el corte
    pc.set(13, 10, E[1]);
    pc.set(14, 11, E[1]);
    // Ramita con hoja
    pc.set(4, 4, B[3]);
    pc.set(4, 3, B[2]);
    pc.set(3, 2, '#78b84e');
    pc.set(2, 2, '#55963e');
    pc.set(3, 3, '#3e7a32');
    pc.set(2, 1, '#a8d870');
    rim(pc);
  },
  coal(pc) {
    // Trozo de carbón anguloso: caras planas, aristas que brillan frías y destellos minerales
    const R = ['#0d0e15', '#191b25', '#262a38', '#363b4e', '#4c5470', '#6e789a', '#b8c4e4'];
    const m = poly([[1.6, 10], [3, 5.5], [6.5, 2.4], [10.5, 2], [13.6, 4.6], [14.6, 9.4], [12, 13.6], [6.5, 14], [2.8, 12.6]]);
    facets(pc, m, [[5, 5, 5], [10, 4, 4], [13, 8, 2], [3, 10, 3], [8, 9, 3], [11, 12, 1], [6, 13, 1], [7, 6, 4]], R);
    rim(pc);
    pc.set(5, 4, R[6]);
    pc.set(4, 5, R[5]);
    pc.set(11, 3, R[5]);
    pc.set(9, 7, R[5]);
    pc.set(3, 10, R[5]);
  },
  gel(pc) {
    // Gota de gel azul, blanda y translúcida: montoncito redondo con puntita, brillo húmedo y luz que la atraviesa
    const R = ['#182a78', '#2244b0', '#2f66dc', '#4a8cf6', '#78b2ff', '#b6dcff'];
    const m = spans({ 3: [8, 8], 4: [6, 9], 5: [4, 11], 6: [3, 12], 7: [2, 13], 8: [2, 13], 9: [2, 13], 10: [2, 13], 11: [2, 13], 12: [3, 12] });
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const t = sphereLight(x, y, 7.2, 8.4, 6.6);
        let c = t > 0.66 ? R[4] : t > 0.36 ? R[3] : t > 0.02 ? R[2] : R[1];
        if (!inM(m, x + 1, y) || (!inM(m, x, y + 1) && x > 9)) c = R[1];
        pc.set(x, y, c);
      }
    }
    // Luz que atraviesa el gel y sale por abajo (como un lente)
    for (let x = 4; x <= 9; x++) pc.set(x, 12, R[3]);
    for (let x = 5; x <= 8; x++) pc.set(x, 11, R[2]);
    pc.set(3, 12, R[2]);
    pc.set(8, 3, R[4]);
    // Burbujas adentro
    for (const [x, y, c] of [[10, 8, R[4]], [11, 9, R[3]], [9, 10, R[4]], [4, 10, R[3]]]) pc.set(x, y, c);
    rim(pc);
    // Brillo húmedo: arco blanco arriba a la izquierda y un punto
    for (const [x, y, c] of [[4, 8, R[5]], [4, 7, '#ffffff'], [5, 6, '#ffffff'], [6, 6, R[5]], [6, 5, R[5]], [8, 5, R[5]], [5, 9, R[4]]]) pc.set(x, y, c);
  },
  iron_bar(pc) {
    ingot(pc, IRON);
  },
  gold_bar(pc) {
    ingot(pc, GOLD);
  },
  hellstone_bar(pc) {
    // Metal infernal casi negro, partido por grietas de magma (centro amarillo, bordes rojos) con su resplandor
    ingot(pc, HELL, () => {
      const V = [
        [10, 5, 1], [9, 6, 2], [8, 6, 3], [7, 7, 4], [6, 7, 3], [5, 8, 4], [4, 9, 3], [4, 10, 2], [3, 11, 1],
        [7, 9, 1], [8, 10, 3], [9, 10, 4], [10, 9, 3], [11, 9, 2], [13, 8, 2], [13, 9, 1],
      ];
      const hot = new Set(V.map(([x, y]) => x + y * 16));
      for (const [x, y] of V) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = x + dx + (y + dy) * 16;
          if (!hot.has(k) && pc.get(x + dx, y + dy)) pc.set(x + dx, y + dy, '#8a2a14');
        }
      }
      for (const [x, y, c] of V) pc.set(x, y, FIRE[c]);
    });
  },
  cactus_item(pc) {
    // Trozo de cactus con brazos, costillas, espinas y una flor
    const R = ['#1a3a1c', '#2c5a26', '#3e7a32', '#55963e', '#78b84e', '#a8d870'];
    const m = spans({
      3: [6, 9], 4: [5, 10, 12, 13], 5: [5, 10, 12, 13], 6: [2, 3, 5, 10, 12, 13], 7: [2, 3, 5, 10, 12, 13], 8: [2, 3, 5, 13],
      9: [2, 3, 5, 13], 10: [2, 10], 11: [2, 10], 12: [5, 10], 13: [5, 10], 14: [5, 10],
    });
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        let c;
        if (x >= 5 && x <= 10) c = [R[4], R[3], R[2], R[4], R[3], R[1]][x - 5];
        else if (x <= 4) c = x === 2 ? R[4] : x === 3 ? R[2] : R[3];
        else c = x === 12 ? R[3] : x === 13 ? R[1] : R[3];
        if (!inM(m, x, y - 1)) c = R[5];
        if (!inM(m, x, y + 1)) c = R[1];
        pc.set(x, y, c);
      }
    }
    pc.set(7, 3, R[5]);
    pc.set(4, 10, R[3]);
    pc.set(11, 8, R[4]);
    pc.set(11, 9, R[2]);
    rim(pc);
    // Espinas claras sobre el contorno y en las costillas
    for (const [x, y] of [[4, 5], [11, 6], [1, 8], [14, 6], [4, 13], [11, 12], [11, 4], [1, 11]]) pc.set(x, y, '#f4e8b8');
    for (const [x, y] of [[6, 6], [9, 9], [6, 12], [9, 5]]) pc.set(x, y, '#e8f4c0');
    // Flor rosada arriba
    pc.set(7, 1, '#ff8ab8');
    pc.set(8, 1, '#e04a88');
    pc.set(7, 2, '#ffd0e4');
    pc.set(8, 2, '#ff8ab8');
    pc.set(6, 2, '#e04a88');
    pc.set(9, 2, '#b02a64');
  },
  bone(pc) {
    // Hueso en diagonal con extremos redondeados
    const R = ['#5a4630', '#9a8464', '#c4b090', '#e2d6bc', '#f4ecdc', '#ffffff'];
    const m = mask((x, y) => {
      const t = Math.max(0, Math.min(1, ((x - 4) - (y - 11)) / 14));
      const px = 4 + t * 7;
      const py = 11 - t * 7;
      if ((x - px) ** 2 + (y - py) ** 2 <= 1.6) return true;
      const k = (cx, cy) => (x - cx) ** 2 + (y - cy) ** 2 <= 2.1;
      return k(2.6, 11.2) || k(4.8, 13.4) || k(10.9, 2.4) || k(13.2, 4.6);
    });
    bevel(pc, m, R);
    pc.set(6, 9, R[4]);
    pc.set(7, 8, R[4]);
    pc.set(9, 6, R[4]);
    rim(pc);
  },
  flower_item(pc) {
    // Flor roja de 5 pétalos (como las del pasto) con centro amarillo, tallo y hoja
    const S = ['#1e4a1e', '#2e6a2a', '#45903a', '#66b04c', '#94d066'];
    for (let y = 9; y <= 14; y++) pc.set(7, y, S[2]);
    for (let y = 9; y <= 14; y++) pc.set(8, y, S[1]);
    for (const [x, y, c] of [[9, 11, 3], [10, 11, 4], [11, 10, 4], [9, 12, 2], [10, 12, 2], [11, 11, 3], [12, 10, 3], [5, 13, 3], [6, 13, 2], [4, 12, 4]]) pc.set(x, y, S[c]);
    const P = ['#6a0a2a', '#a8183e', '#d83254', '#f05a70', '#ff8e9c', '#ffc8d0'];
    const petals = [[7.5, 2.6], [3.4, 5.6], [11.6, 5.6], [5, 9.4], [10, 9.4]];
    for (const [cx, cy] of petals) {
      for (let y = Math.floor(cy - 3); y <= cy + 3; y++) {
        for (let x = Math.floor(cx - 3); x <= cx + 3; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > 4.2) continue;
          const t = sphereLight(x, y, cx, cy, 2.2);
          pc.set(x, y, t > 0.6 ? P[4] : t > 0.2 ? P[3] : t > -0.2 ? P[2] : P[1]);
        }
      }
    }
    // Centro (polen) con brillo
    for (const [x, y, c] of [[7, 5, '#fff2a0'], [8, 5, '#ffd040'], [6, 6, '#ffd040'], [7, 6, '#ffd040'], [8, 6, '#e8a020'], [9, 6, '#c47a10'], [7, 7, '#e8a020'], [8, 7, '#c47a10']]) pc.set(x, y, c);
    rim(pc);
    pc.set(6, 1, P[5]);
    pc.set(2, 4, P[5]);
  },
  life_crystal(pc, v, asset) {
    // Cristal de vida: corazón de rubí tallado en facetas (arista central, mesa clara, reflejos internos).
    // Como bloque del mundo (tile_life_crystal) además descansa en una base de roca.
    const R = ['#4a0618', '#7a0c28', '#a8143a', '#d42a4c', '#ee5068', '#ff8a9c', '#ffd0d8'];
    paint(pc, [
      '................',
      '................',
      '..5665....4554..',
      '.455654..444432.',
      '.45555441444322.',
      '.34444441333321.',
      '.23333341222211.',
      '..233334122211..',
      '...2333412211...',
      '....23341210....',
      '.....234110.....',
      '......2410......',
      '.......30.......',
    ], R, 0, 0);
    // Reflejos internos del cristal (se ve a través de las caras oscuras)
    for (const [x, y, c] of [[10, 7, 4], [11, 6, 3], [10, 8, 3], [4, 7, 4], [12, 5, 4]]) pc.set(x, y, R[c]);
    const tile = asset && asset.file && asset.file.startsWith('tiles/');
    if (tile) {
      // Base de roca donde está engarzado
      const S = ['#24222e', '#34323f', '#4a4756', '#625e70', '#7c788a'];
      const m = spans({ 10: [3, 4, 11, 12], 11: [2, 5, 10, 13], 12: [1, 6, 9, 14], 13: [0, 15], 14: [0, 15], 15: [0, 15] });
      for (let y = 10; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (!inM(m, x, y)) continue;
          let c = !inM(m, x, y - 1) ? S[4] : !inM(m, x - 1, y) ? S[3] : hash(x, y, 5) < 0.3 ? S[1] : S[2];
          if (!inM(m, x + 1, y) && x < 15) c = S[1];
          if (y === 15 || (y === 14 && hash(x, 0, 6) < 0.4)) c = S[0];
          pc.set(x, y, c);
        }
      }
      // Esquirlas rosadas en la roca
      for (const [x, y, c] of [[3, 9, '#ff8a9c'], [3, 10, '#d42a4c'], [12, 9, '#ee5068'], [12, 10, '#a8143a'], [5, 13, '#d42a4c']]) pc.set(x, y, c);
    }
    rim(pc);
    glint(pc, 3, 3);
    pc.set(11, 3, R[6]);
  },
  // ---------- estaciones y muebles ----------
  furnace_item(pc) {
    // Horno de ladrillos de piedra con boca encendida y chimenea
    const S = ['#262833', '#3a3d4c', '#4e5262', '#646a7a', '#7e8494', '#a2a6ae'];
    const m = spans({ 1: [10, 12], 2: [10, 12], 3: [10, 12], 4: [4, 12], 5: [3, 12], 6: [2, 13], 7: [2, 13], 8: [2, 13], 9: [2, 13], 10: [2, 13], 11: [2, 13], 12: [2, 13], 13: [2, 13], 14: [2, 13] });
    bevel(pc, m, S);
    // Juntas de los ladrillos
    for (let y = 4; y <= 14; y++) {
      for (let x = 2; x <= 13; x++) {
        if (!inM(m, x, y) || !inM(m, x - 1, y) || !inM(m, x + 1, y) || !inM(m, x, y - 1)) continue;
        const row = Math.floor((y - 4) / 3);
        const joint = (y - 4) % 3 === 2 || (x + (row % 2) * 3) % 6 === 0;
        if (joint) pc.set(x, y, S[1]);
        else if ((y - 4) % 3 === 0) pc.set(x, y, S[4]);
      }
    }
    pc.rect(10, 1, 3, 1, S[4]);
    pc.set(10, 1, S[5]);
    // Boca en arco con fuego
    paint(pc, [
      '..kkkk..',
      '.kk11kk.',
      '.k1221k.',
      'k123321k',
      'k234432k',
      'k345543k',
    ], { k: '#1c0e0a', 1: FIRE[0], 2: FIRE[1], 3: FIRE[2], 4: FIRE[3], 5: FIRE[4] }, 4, 8);
    pc.set(7, 13, FIRE[5]);
    pc.set(8, 13, FIRE[5]);
    // Ladrillos calentados alrededor de la boca
    for (const [x, y] of [[4, 9], [11, 9], [3, 11], [12, 11], [5, 8], [10, 8]]) if (inM(m, x, y)) pc.set(x, y, '#9a6a5a');
    pc.rect(2, 14, 12, 1, S[1]);
    rim(pc);
  },
  anvil_item(pc) {
    // Yunque de hierro: cuerno a la izquierda, cara plana, cintura y base
    const m = spans({ 4: [4, 13], 5: [2, 13], 6: [1, 13], 7: [3, 12], 8: [5, 10], 9: [6, 9], 10: [5, 10], 11: [4, 11], 12: [3, 12], 13: [3, 12] });
    bevel(pc, m, IRON);
    for (let x = 4; x <= 13; x++) pc.set(x, 4, IRON[5]);
    pc.set(4, 4, IRON[6]);
    for (let x = 3; x <= 12; x++) pc.set(x, 5, IRON[4]);
    pc.set(13, 5, IRON[3]);
    for (let x = 4; x <= 11; x++) pc.set(x, 7, IRON[1]);
    pc.set(3, 7, IRON[2]);
    for (let x = 4; x <= 11; x++) pc.set(x, 11, IRON[4]);
    pc.set(11, 11, IRON[3]);
    pc.set(12, 13, IRON[1]);
    rim(pc);
    glint(pc, 6, 4);
  },
  chest_item(pc) {
    // Cofre de madera con tapa curva, zunchos de hierro y cerradura dorada
    paint(pc, [
      '..hhhhhhhhhhhh..',
      '.hlllllllllllll.',
      '.lbbbbbbbbbbbbm.',
      '.lbbbbbbbbbbbbm.',
      '.dddddddddddddd.',
      '.lbbbbbbbbbbbbm.',
      '.lmmmmmmmmmmmmm.',
      '.lbbbbbbbbbbbbm.',
      '.lbbbbbbbbbbbbm.',
      '.lmmmmmmmmmmmmm.',
      '.kkkkkkkkkkkkkk.',
    ], WD, 0, 3);
    // Zunchos de hierro (verticales) con remaches
    for (const x of [3, 12]) {
      for (let y = 3; y <= 13; y++) pc.set(x, y, y === 3 ? IRON[5] : y === 7 || y === 13 ? IRON[1] : IRON[4]);
      for (let y = 4; y <= 12; y++) pc.set(x + 1, y, y === 7 ? WD.k : WD.m);
      pc.set(x, 5, IRON[6]);
      pc.set(x, 10, IRON[6]);
    }
    // Esquineras de hierro abajo
    for (const [x, y, c] of [[1, 13, 2], [2, 13, 2], [1, 12, 4], [13, 13, 1], [14, 13, 1], [14, 12, 2]]) pc.set(x, y, IRON[c]);
    // Cerradura dorada sobre la juntura de la tapa, con el ojo de la llave
    paint(pc, ['hhhl', 'hkkm', 'lkkd', 'lmdd', '.dd.'], { h: GOLD[5], l: GOLD[4], b: GOLD[3], m: GOLD[2], d: GOLD[1], k: '#2a160b' }, 6, 6);
    pc.set(8, 8, '#5a3214');
    rim(pc);
    glint(pc, 6, 6, false);
  },
  door_item(pc) {
    // Puerta de tablones verticales en su marco, con bisagras de hierro remachadas y tirador dorado
    paint(pc, [
      '....hhhhhhhhh...',
      '....lbmlbmlbd...',
      '....IIIIIIlbd...',
      '....iWiiiWlbd...',
      '....lbmlbmlbd...',
      '....lbmlbmlbd...',
      '....lbmlbmGgd...',
      '....lbmlbmlgd...',
      '....lbmlbmlbd...',
      '....lbmlbmlbd...',
      '....IIIIIIlbd...',
      '....iWiiiWlbd...',
      '....lbmlbmlbd...',
      '....kkkkkkkkk...',
    ], { ...WD, I: IRON[4], i: IRON[2], W: IRON[6], G: GOLD[5], g: GOLD[2] }, 0, 1);
    // Vetas y nudos en los tablones
    for (const [x, y] of [[5, 6], [8, 9], [5, 13], [11, 5]]) pc.set(x, y, WD.m);
    rim(pc);
  },
  chair_item(pc) {
    // Silla de respaldo alto con travesaños y cojín rojo (como la silla colocada)
    paint(pc, [
      '...hll..........',
      '...l.m..........',
      '...lhm..........',
      '...l.m..........',
      '...l.m..........',
      '...lhm.RRRRRR...',
      '...lbmrrrrrrrq..',
      '...lhhhhhhhhhl..',
      '...lbbbbbbbbbm..',
      '...lkdddddddkd..',
      '...lb......lb...',
      '...lbmmmmmmlb...',
      '...lb......lb...',
      '...dk......dk...',
    ], { ...WD, R: '#f06a5a', r: '#c8323a', q: '#8a1e2a' }, 0, 1);
    rim(pc);
  },
  table_item(pc) {
    paint(pc, [
      '.hhhhhhhhhhhhhh.',
      '.lllllllllllllb.',
      '.dmmmmmmmmmmmmk.',
      '..kddddddddddk..',
      '..lb........lb..',
      '..lb........lb..',
      '..lbmmmmmmmmlb..',
      '..lb........lb..',
      '..lb........lb..',
      '..dk........dk..',
    ], WD, 0, 5);
    // Jarra de loza con franja azul y una manzana sobre la mesa (como la mesa colocada)
    paint(pc, ['.wwW.', 'wWWSs', 'BBBbs', 'WWSS.'], { w: '#ffffff', W: '#dfe6ee', S: '#a8b4c4', s: '#8a96a8', B: '#4a7ad0', b: '#2e56a0' }, 9, 1);
    paint(pc, ['.sl', 'Ar.', 'rd.'], { s: '#6a4020', l: '#58b040', A: '#ff7a6a', r: '#d8303a', d: '#9a1828' }, 3, 2);
    rim(pc);
  },
  bed_item(pc) {
    paint(pc, [
      '.hl.............',
      '.lb.............',
      '.lb.............',
      '.lb.............',
      '.lbppP.......hl.',
      '.lbpPPqqqqqqqlb.',
      '.lbssRRyRRyRRlb.',
      '.lbSSYYYYYYYYlb.',
      '.lhlllllllllllb.',
      '.lbmmmmmmmmmmmb.',
      '.lb..........lb.',
      '.dk..........dk.',
    ], { ...WD, p: '#ffffff', P: '#d4d8e8', s: '#f4f0e8', S: '#c8c0b4', q: '#ff6a5a', R: '#d8343e', r: '#9a1c30', y: '#ffd050', Y: '#e8a830' }, 0, 2);
    rim(pc);
  },
  wood_wall_item(pc) {
    // Pared de tablones (más oscura: es de fondo) con bisel
    const R = ['#2e180b', '#432412', '#58321a', '#6e4222', '#86532c', '#a06a3a'];
    for (let y = 2; y <= 13; y++) {
      for (let x = 2; x <= 13; x++) {
        const row = Math.floor((y - 2) / 3);
        const seam = (y - 2) % 3 === 2;
        const joint = (x + row * 5) % 7 === 0;
        let c = seam || joint ? R[1] : (y - 2) % 3 === 0 ? R[4] : R[3];
        if (!seam && !joint && hash(x, row, 31) < 0.12) c = R[2];
        if (y === 2 || x === 2) c = R[5];
        if (y === 13 || x === 13) c = R[1];
        pc.set(x, y, c);
      }
    }
    pc.set(13, 2, R[3]);
    pc.set(2, 13, R[3]);
    rim(pc);
  },
  stone_wall_item(pc) {
    // Pared de bloques de piedra irregulares
    const R = ['#14161f', '#20232e', '#2e323f', '#3c414f', '#4d5262', '#626878'];
    const rows = [[2, 6, 10], [2, 5, 9, 12], [2, 7, 11], [2, 4, 8, 12]];
    for (let y = 2; y <= 13; y++) {
      const r = Math.floor((y - 2) / 3);
      const ry = (y - 2) % 3;
      for (let x = 2; x <= 13; x++) {
        const joint = ry === 2 || rows[r].includes(x);
        let c = joint ? R[1] : ry === 0 || rows[r].includes(x - 1) ? R[4] : R[3];
        if (!joint && hash(x, y, 77) < 0.1) c = R[2];
        if (y === 2 || x === 2) c = R[5];
        if (y === 13 || x === 13) c = R[1];
        pc.set(x, y, c);
      }
    }
    pc.set(13, 2, R[3]);
    pc.set(2, 13, R[3]);
    rim(pc);
  },
  dirt_wall_item(pc) {
    // Pared de tierra con piedritas
    const R = ['#1a0e07', '#28160c', '#361e12', '#442818', '#54321e', '#6a4228'];
    for (let y = 2; y <= 13; y++) {
      for (let x = 2; x <= 13; x++) {
        const n = hash(x >> 1, y >> 1, 91) * 0.6 + hash(x, y, 92) * 0.4;
        let c = n < 0.3 ? R[2] : n < 0.75 ? R[3] : R[4];
        if (y === 2 || x === 2) c = R[5];
        if (y === 13 || x === 13) c = R[1];
        pc.set(x, y, c);
      }
    }
    for (const [x, y] of [[5, 5], [10, 8], [6, 10], [11, 4]]) {
      pc.set(x, y, '#7a6a5a');
      pc.set(x + 1, y, '#564a40');
      pc.set(x, y + 1, '#4a3e34');
      pc.set(x + 1, y + 1, R[1]);
    }
    pc.set(13, 2, R[3]);
    pc.set(2, 13, R[3]);
    rim(pc);
  },
  glass_wall_item(pc) {
    // Ventana de vidrio: marco de plomo en cruz y reflejos en diagonal
    const F = ['#2e3846', '#4a5868', '#6a7a8c', '#8a9aac', '#b4c2d0'];
    for (let y = 2; y <= 13; y++) {
      for (let x = 2; x <= 13; x++) {
        const frame = x === 2 || y === 2 || x === 13 || y === 13 || x === 7 || x === 8 || y === 7 || y === 8;
        let c;
        if (frame) c = x === 2 || y === 2 || ((x === 7 || y === 7) && !(x === 8 || y === 8)) ? F[4] : F[2];
        else {
          const t = x + y;
          c = t < 9 ? '#d4f0fc' : t < 13 ? '#a8dcf2' : t < 19 ? '#84c6e8' : '#64aad8';
        }
        if (x === 13 || y === 13) c = F[1];
        pc.set(x, y, c);
      }
    }
    // Reflejos
    for (const [x, y] of [[3, 5], [4, 4], [5, 3], [4, 5], [10, 4], [9, 5], [3, 11], [10, 11], [11, 10], [12, 9]]) pc.set(x, y, '#f4fcff');
    pc.set(13, 2, F[2]);
    pc.set(2, 13, F[2]);
    rim(pc);
  },

  // ---------- pociones ----------
  potion_small(pc) {
    flask(pc, [
      '......ccCo......',
      '......CCoo......',
      '.....gggggG.....',
      '......gaaG......',
      '.....gWaaaG.....',
      '....gaaaaaaG....',
      '...gWLLLLLLLG...',
      '...gWMMBMMMDG...',
      '...gMMMMMMDDG...',
      '...GMMMMMDDKG...',
      '....GDMMMDKG....',
      '.....GGGGGG.....',
    ], { L: '#ff7a8e', M: '#e0284a', D: '#a8143a', K: '#6a0a2e', B: '#ffb0bc' }, 2);
  },
  potion_big(pc) {
    flask(pc, [
      '......ccCo......',
      '......CCoo......',
      '.....gggggG.....',
      '......gaaG......',
      '.....gWaaaG.....',
      '...ggWaaaaaGG...',
      '..gaaaaaaaaaaG..',
      '..gWLLLLLLLLLG..',
      '.gWMMMMBMMMMMDG.',
      '.gWMMMMMMMMMDDG.',
      '.gMMMBMMMMMMDDG.',
      '.GMMMMMMMMMDDKG.',
      '..GDDMMMMDDDKG..',
      '...GGGGGGGGGG...',
    ], { L: '#ff7a8e', M: '#e0284a', D: '#a8143a', K: '#6a0a2e', B: '#ffb0bc' }, 1, () => glint(pc, 12, 9));
  },
  recall_potion(pc) {
    // Matraz cónico con líquido mágico celeste y chispitas
    flask(pc, [
      '......ccCo......',
      '......CCoo......',
      '.....gggggG.....',
      '......gaaG......',
      '......gWaG......',
      '.....gWaaaG.....',
      '.....gaaaaG.....',
      '....gLLLLLLG....',
      '....gWMMMMDG....',
      '...gWMMSMMDDG...',
      '...gMMMMMMMDG...',
      '..gMMSMMMMMDDG..',
      '..GDDDMMMDDDKG..',
      '..GGGGGGGGGGGG..',
    ], { L: '#8af4ff', M: '#2ea8f0', D: '#1a64c8', K: '#18348a', S: '#ffffff' }, 1, () => {
      pc.set(12, 4, '#bff8ff');
      glint(pc, 13, 6, false);
    });
  },

  // ---------- monedas ----------
  coin_copper(pc) {
    coin(pc, COPPER);
  },
  coin_silver(pc) {
    coin(pc, SILVER);
  },
  coin_gold(pc) {
    coin(pc, GOLD);
  },

  // ---------- reliquias ----------
  relic_crown(pc) {
    // Corona del rey: oro con terciopelo, rubí en la punta y gemas en el aro
    const m = spans({
      1: [2, 3, 12, 13], 2: [2, 3, 12, 13], 3: [2, 3, 7, 8, 12, 13], 4: [2, 4, 7, 8, 11, 13], 5: [2, 4, 6, 9, 11, 13], 6: [2, 5, 6, 9, 10, 13],
      7: [2, 13], 8: [1, 14], 9: [1, 14], 10: [1, 14], 11: [1, 14], 12: [1, 14],
    });
    bevel(pc, m, GOLD);
    // Terciopelo entre las puntas
    for (const [x, y, c] of [[5, 4, 0], [6, 4, 1], [9, 4, 0], [10, 4, 1], [5, 5, 1], [10, 5, 0], [5, 3, 0], [6, 3, 0], [9, 3, 0], [10, 3, 0]]) pc.set(x, y, ['#5a0a2a', '#8a1a3a'][c]);
    // Aro: filo brillante arriba, sombra abajo
    for (let x = 1; x <= 14; x++) {
      pc.set(x, 8, GOLD[5]);
      pc.set(x, 12, GOLD[1]);
      pc.set(x, 11, GOLD[2]);
    }
    pc.set(1, 8, GOLD[6]);
    pc.set(14, 9, GOLD[2]);
    pc.set(14, 10, GOLD[2]);
    // Gemas del aro: rubíes a los lados, zafiro al centro
    const gem = (x, y, [hi, b, d]) => {
      pc.set(x, y, hi);
      pc.set(x + 1, y, b);
      pc.set(x, y + 1, b);
      pc.set(x + 1, y + 1, d);
    };
    gem(3, 9, ['#ffb0bc', '#e02040', '#8a0a28']);
    gem(11, 9, ['#ffb0bc', '#e02040', '#8a0a28']);
    gem(7, 9, ['#c8ecff', '#3a7af0', '#1a3a9a']);
    // Rubí en la punta central
    pc.set(7, 1, '#ffd0d8');
    pc.set(8, 1, '#ff6a80');
    pc.set(7, 2, '#ff9aa8');
    pc.set(8, 2, '#e02040');
    pc.set(7, 3, '#e02040');
    pc.set(8, 3, '#8a0a28');
    rim(pc);
    glint(pc, 12, 1);
    glint(pc, 7, 9, false);
  },
  relic_stinger(pc) {
    // Aguijón dorado del Rey Escorpión: punta de su cola con placas de oro que se curvan, el bulbo violeta
    // de veneno (como el del jefe) y una púa curva que suelta una gota
    const G = ['#4a2408', '#7a4410', '#b06a18', '#dc9a2a', '#f4c64a', '#ffe68a'];
    const V = ['#2a0848', '#4a1070', '#7a24b0', '#a64ae8', '#d08cff', '#f4d4ff'];
    const ball = (cx, cy, r, R) => {
      pc.disc(cx, cy, r + 0.9, R[0]);
      pc.disc(cx, cy, r, (x, y) => {
        const t = sphereLight(x, y, cx, cy, r);
        return R[t > 0.7 ? 5 : t > 0.4 ? 4 : t > 0.05 ? 3 : t > -0.35 ? 2 : 1];
      });
    };
    ball(4.6, 12.8, 1.9, G);
    ball(3.6, 9.2, 2.1, G);
    ball(4.8, 5.6, 2.1, G);
    ball(7.8, 3.4, 1.8, G);
    ball(11.2, 4.8, 2.6, V);
    // Púa curva y afilada (violeta casi negro) que sale del bulbo y apunta hacia abajo
    for (const [x, y, c] of [[12, 7, 2], [13, 7, 1], [13, 8, 2], [14, 8, 1], [14, 9, 3], [14, 10, 4]]) pc.set(x, y, V[c]);
    rim(pc);
    // Brillos
    pc.set(10, 3, '#ffffff');
    pc.set(4, 4, G[5]);
    pc.set(2, 8, G[5]);
    pc.set(7, 2, G[5]);
    // Gota de veneno
    pc.set(14, 12, V[5]);
    pc.set(14, 13, V[3]);
  },
  relic_hive(pc) {
    // Corazón de la colmena: trozo de panal de 7 celdas hexagonales (cera clara, miel ámbar hundida);
    // la celda del centro brilla como una brasa dorada y el panal tiene canto abajo a la derecha
    const cells = [[8, 4], [4, 6], [12, 6], [8, 8], [4, 10], [12, 10], [8, 12]];
    const HEART = 3;
    const cellAt = new Map();
    cells.forEach(([cx, cy], k) => {
      for (let x = cx - 1; x <= cx + 1; x++) cellAt.set(x + (cy - 1) * 16, k).set(x + (cy + 1) * 16, k);
      for (let x = cx - 2; x <= cx + 2; x++) cellAt.set(x + cy * 16, k);
    });
    const isCell = (x, y) => x >= 0 && x < 16 && y >= 0 && cellAt.has(x + y * 16);
    const isWall = (x, y) => {
      if (x < 1 || x > 14 || y < 2 || y > 14 || isCell(x, y)) return false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isCell(x + i, y + j)) return true;
      return false;
    };
    const solid = (x, y) => isCell(x, y) || isWall(x, y);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (isCell(x, y)) {
          const k = cellAt.get(x + y * 16);
          const [cx, cy] = cells[k];
          if (k === HEART) pc.set(x, y, y === cy && Math.abs(x - cx) <= 1 ? '#ffffff' : '#ffe680');
          else pc.set(x, y, y < cy ? '#5e2404' : y > cy ? '#c86a10' : '#94420a');
        } else if (isWall(x, y)) {
          pc.set(x, y, !solid(x - 1, y) || !solid(x, y - 1) ? '#ffe7a0' : !solid(x + 1, y) || !solid(x, y + 1) ? '#c88420' : '#f0c454');
        }
      }
    }
    // Brillo de la miel en cada celda
    cells.forEach(([cx, cy], k) => {
      if (k !== HEART) pc.set(cx + 1, cy + 1, '#f0a030');
    });
    // Canto del panal (grosor), abajo a la derecha
    for (let y = 15; y >= 1; y--) for (let x = 15; x >= 1; x--) if (!pc.get(x, y) && solid(x - 1, y - 1) && x < 15 && y < 15) pc.set(x, y, '#8a4a0c');
    rim(pc);
    glint(pc, 3, 5, false);
  },
  relic_eye(pc) {
    // Ojo de las sombras: globo blanco con venas, iris violeta con pupila de serpiente y tentáculos oscuros
    const S = ['#4a3058', '#7c6890', '#a898ba', '#d4cade', '#eee8f2', '#ffffff'];
    const cx = 9;
    const cy = 7;
    const r = 5.4;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r + 0.4) continue;
        const t = sphereLight(x, y, cx, cy, r);
        pc.set(x, y, S[t > 0.78 ? 5 : t > 0.5 ? 4 : t > 0.15 ? 3 : t > -0.25 ? 2 : 1]);
      }
    }
    // Venas rojas que nacen del borde
    for (const [x0, y0, x1, y1] of [[4, 5, 6, 6], [5, 10, 7, 9], [9, 12, 9, 11], [12, 2, 11, 3], [14, 9, 13, 8]]) pc.line(x0, y0, x1, y1, '#d8485e');
    for (const [x, y] of [[4, 5], [5, 10], [9, 12], [12, 2], [14, 9]]) pc.set(x, y, '#9a1a3a');
    // Iris: anillo oscuro, violeta que se aclara abajo a la derecha (cóncavo) y pupila rasgada
    for (let y = 3; y <= 11; y++) {
      for (let x = 6; x <= 14; x++) {
        const d = Math.hypot(x - 10, y - 7);
        if (d > 3.3) continue;
        const t = (x - 10 + (y - 7)) / 4;
        pc.set(x, y, d > 2.6 ? '#3a1068' : t > 0.35 ? '#c890ff' : t > -0.2 ? '#9048e0' : '#6624b0');
      }
    }
    for (let y = 5; y <= 9; y++) pc.set(10, y, '#12061c');
    pc.set(10, 4, '#3a1068');
    pc.set(10, 10, '#3a1068');
    pc.set(9, 7, '#12061c');
    pc.set(11, 7, '#12061c');
    rim(pc);
    // Tentáculos (nervios) finos que arrastra por detrás, abajo a la izquierda
    for (const [x, y, c] of [
      [3, 10, 0], [2, 11, 1], [1, 11, 0], [1, 12, 1],
      [5, 12, 0], [4, 13, 1], [4, 14, 0], [3, 15, 1],
      [7, 13, 0], [7, 14, 1], [8, 15, 0],
    ]) pc.set(x, y, ['#5a1a88', '#a050e0'][c]);
    // Brillos: reflejo de la luz en el ojo y en el iris
    pc.set(6, 3, '#ffffff');
    pc.set(5, 4, '#ffffff');
    pc.set(9, 5, '#f4e4ff');
  },
  relic_core(pc) {
    // Núcleo de cristal del Gólem: piedra violeta oscura con el rombo celeste que brilla, runas en X
    // y dos cristales rosados que asoman arriba
    const S = ['#16122a', '#241e40', '#342c58', '#463c70', '#5a5088', '#7468a4'];
    const m = spans({ 4: [4, 11], 5: [3, 12], 6: [2, 13], 7: [2, 13], 8: [2, 13], 9: [2, 13], 10: [2, 13], 11: [2, 13], 12: [3, 12], 13: [4, 11] });
    bevel(pc, m, S);
    // Grietas de la piedra
    for (const [x, y] of [[4, 11], [5, 12], [11, 5], [12, 6]]) pc.set(x, y, S[1]);
    // Cristales rosados (dos puntas)
    const K = ['#4a1050', '#8a2a8a', '#c850c0', '#f088e4', '#ffd0f8'];
    paint(pc, [
      '..3.........4...',
      '..32.......43...',
      '.432......432...',
      '.421......321...',
    ], { 1: K[0], 2: K[1], 3: K[2], 4: K[3] }, 0, 1);
    // Runas en X que salen del núcleo
    for (const [x, y] of [[4, 6], [5, 7], [11, 6], [10, 7], [4, 11], [5, 10], [11, 11], [10, 10]]) pc.set(x, y, '#2a8ab8');
    // Núcleo: rombo celeste tallado con resplandor
    paint(pc, [
      '...4...',
      '..453..',
      '.45532.',
      '4556321',
      '.43221.',
      '..321..',
      '...1...',
    ], { 1: '#0a5a84', 2: '#1a90c4', 3: '#3ad0f4', 4: '#9af2ff', 5: '#e0ffff', 6: '#ffffff' }, 5, 5);
    rim(pc);
    glint(pc, 7, 6, false);
    pc.set(2, 1, K[4]);
    pc.set(12, 1, K[4]);
  },
  relic_flame(pc) {
    // Llama eterna: cáliz de oro con rubí y una llama en forma de gota (núcleo blanco, bordes rojos) y chispas
    paint(pc, [
      '.......2........',
      '.......32.......',
      '......2342......',
      '.....234432.....',
      '....23455432....',
      '...2345665432...',
      '...2345666543...',
      '...2345666543...',
    ], { 1: FIRE[0], 2: FIRE[1], 3: FIRE[2], 4: FIRE[3], 5: FIRE[4], 6: FIRE[5] }, 0, 1);
    paint(pc, [
      '..lhhhhhhhhhhb..',
      '...lbbbrrbbbm...',
      '....lbbRrbbm....',
      '.....lbbbbm.....',
      '.......bm.......',
      '.....lhbbbm.....',
    ], { h: GOLD[5], l: GOLD[4], b: GOLD[3], m: GOLD[2], d: GOLD[1], r: '#ff5a70', R: '#ffc0c8' }, 0, 9);
    pc.set(8, 10, '#a01030');
    pc.set(8, 11, '#c02040');
    rim(pc);
    pc.set(2, 9, GOLD[6]);
    // Chispas que suben
    pc.set(11, 2, FIRE[4]);
    pc.set(4, 3, FIRE[3]);
    pc.set(12, 5, FIRE[2]);
    pc.set(3, 1, FIRE[2]);
  },
  // ---------- herramientas de orientación ----------
  magic_mirror(pc) {
    // Espejo de mano: marco dorado con gema, vidrio con reflejos y mango
    const cx = 7.5;
    const cy = 6.5;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 5.7) continue;
        const lit = (-dx - dy) / (Math.abs(dx) + Math.abs(dy) + 0.001);
        if (d > 4.1) pc.set(x, y, lit > 0.5 ? GOLD[5] : lit > -0.2 ? GOLD[4] : lit > -0.7 ? GOLD[3] : GOLD[2]);
        else if (d > 3.3) pc.set(x, y, lit > 0.3 ? GOLD[1] : GOLD[2]);
        else {
          const t = dx + dy;
          pc.set(x, y, t < -3 ? '#dcf6ff' : t < -1 ? '#9ad8f8' : t < 2 ? '#5aa8e8' : '#3a74c8');
        }
      }
    }
    pc.line(5, 6, 7, 4, '#ffffff');
    pc.line(6, 8, 9, 5, '#e8fbff');
    pc.set(10, 8, '#ffffff');
    // Mango
    const mh = spans({ 12: [7, 8], 13: [7, 8], 14: [6, 9] });
    bevel(pc, mh, GOLD);
    pc.set(7, 12, GOLD[2]);
    pc.set(8, 12, GOLD[1]);
    // Gema arriba del marco
    pc.set(7, 1, '#c8f4ff');
    pc.set(8, 1, '#5ad0f0');
    rim(pc);
    glint(pc, 3, 3);
  },
  compass(pc) {
    // Brújula de latón: argolla arriba, aro biselado, esfera de marfil bajo un vidrio con reflejo,
    // marcas cardinales y aguja en rombo (norte rojo, sur de acero) con eje dorado
    const B = ['#4a2a10', '#7a4a1a', '#a8702a', '#c8943a', '#e8c06a', '#fff0b0'];
    const cx = 7.5;
    const cy = 8.5;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 6.1) continue;
        const lit = (-dx - dy) / (Math.abs(dx) + Math.abs(dy) + 0.001);
        if (d > 5) pc.set(x, y, lit > 0.45 ? B[5] : lit > -0.3 ? B[4] : lit > -0.8 ? B[3] : B[2]);
        else if (d > 4.2) pc.set(x, y, lit > 0.2 ? B[1] : B[3]);
        else pc.set(x, y, dx + dy > 2.5 ? '#ddd0b0' : '#f4ecd6');
      }
    }
    // Argolla
    paint(pc, ['.hl.', 'h..m', '.lm.'], { h: B[5], l: B[4], m: B[2] }, 6, 0);
    pc.set(7, 2, B[3]);
    pc.set(8, 2, B[2]);
    // Marcas cardinales
    for (const [x, y] of [[7, 5], [8, 5], [7, 12], [8, 12], [4, 8], [4, 9], [11, 8], [11, 9]]) pc.set(x, y, '#9a8460');
    pc.set(7, 4, '#c02020');
    // Aguja en rombo: norte rojo arriba-derecha, sur de acero abajo-izquierda, eje dorado
    for (const [x, y, c] of [
      [10, 6, '#ff9a8a'], [9, 7, '#ff5a4a'], [10, 7, '#a81818'], [9, 8, '#a81818'],
      [7, 9, '#e4eaf2'], [6, 10, '#e4eaf2'], [5, 11, '#ffffff'], [7, 10, '#6e7a8c'], [6, 11, '#6e7a8c'],
    ]) pc.set(x, y, c);
    pc.set(8, 8, '#ffe070');
    pc.set(8, 9, '#a86a18');
    rim(pc);
    // Reflejo del vidrio
    pc.set(5, 6, '#ffffff');
    pc.set(4, 7, '#ffffff');
    pc.set(6, 5, '#fffaf0');
    glint(pc, 3, 4, false);
  },
  depth_meter(pc) {
    // Medidor de profundidad: aparato de hierro con remaches; la pantalla muestra un corte del mundo
    // (cielo, pasto, tierra, piedra y el infierno) y una flecha amarilla marca la profundidad
    const m = spans({ 1: [4, 11], 2: [3, 12], 3: [3, 12], 4: [3, 12], 5: [3, 12], 6: [3, 12], 7: [3, 12], 8: [3, 12], 9: [3, 12], 10: [3, 12], 11: [3, 12], 12: [3, 12], 13: [3, 12], 14: [4, 11] });
    bevel(pc, m, IRON);
    // Marco hundido de la pantalla
    for (let x = 5; x <= 10; x++) pc.set(x, 2, IRON[1]);
    for (let y = 3; y <= 11; y++) pc.set(4, y, IRON[1]);
    for (let x = 5; x <= 11; x++) pc.set(x, 12, IRON[5]);
    for (let y = 3; y <= 11; y++) pc.set(11, y, IRON[4]);
    // Corte del mundo: una franja por capa
    const L = [['#9ad8ff', '#7ac4f4'], ['#6ac4f0', '#4aa8e0'], ['#58b040', '#3a8a2e'], ['#8a5a32', '#6e4426'], ['#7a5634', '#5e3e22'], ['#6a6e80', '#545868'], ['#5a5e70', '#444858'], ['#3a2a3a', '#2a1e2a'], ['#c8401a', '#8a2410']];
    for (let y = 3; y <= 11; y++) for (let x = 5; x <= 10; x++) pc.set(x, y, L[y - 3][(x + y) % 3 === 0 ? 1 : 0]);
    pc.set(6, 11, '#ffa22c');
    pc.set(9, 11, '#ffd65a');
    // Marcas de la escala
    for (const y of [4, 6, 8, 10]) pc.set(5, y, '#e8f0f6');
    // Marca amarilla de la profundidad actual (línea con punta de flecha)
    for (let x = 6; x <= 10; x++) pc.set(x, 7, '#ffd040');
    for (const [x, y, c] of [[5, 7, '#fff2a0'], [6, 6, '#e0a020'], [6, 8, '#e0a020']]) pc.set(x, y, c);
    // Botones y remaches
    pc.set(5, 13, '#ff6a5a');
    pc.set(6, 13, '#a82020');
    pc.set(9, 13, '#6ae07a');
    pc.set(10, 13, '#20883a');
    for (const [x, y] of [[4, 2], [11, 2]]) pc.set(x, y, IRON[6]);
    rim(pc);
    pc.set(6, 3, '#ffffff');
    pc.set(7, 3, '#e8f8ff');
  },
};

export const CTX = {};
