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
const HELL = ['#2a0608', '#4a0c0c', '#721810', '#9c2614', '#c84018', '#f07428', '#ffd27a'];
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
// Lingote en perspectiva (cara de arriba, frente y costado derecho). R = rampa de 7 tonos.
function ingot(pc, R, veins) {
  // Cara de arriba: 3 hileras corridas a la derecha hacia el fondo
  for (let k = 0; k < 3; k++) {
    const y = 6 + k;
    const x0 = 4 - k;
    for (let x = x0; x <= x0 + 9; x++) pc.set(x, y, k === 2 ? R[5] : R[4]);
  }
  pc.set(4, 6, R[5]);
  pc.set(6, 7, R[5]);
  pc.set(7, 7, R[5]);
  pc.set(12, 7, R[3]);
  pc.set(13, 6, R[4]);
  // Frente
  for (let y = 9; y <= 12; y++) for (let x = 2; x <= 11; x++) pc.set(x, y, y === 12 ? R[2] : R[3]);
  for (let y = 9; y <= 12; y++) pc.set(2, y, R[4]);
  for (let x = 3; x <= 10; x++) pc.set(x, 9, R[4]);
  pc.set(2, 9, R[5]);
  for (let x = 3; x <= 11; x++) pc.set(x, 12, R[2]);
  pc.set(11, 11, R[2]);
  // Costado derecho (más oscuro, en sombra)
  for (let y = 7; y <= 11; y++) pc.set(12, y, y === 7 ? R[4] : y === 11 ? R[1] : R[2]);
  for (let y = 6; y <= 10; y++) pc.set(13, y, y === 6 ? R[4] : y === 10 ? R[0] : R[1]);
  if (veins) veins();
  rim(pc);
  glint(pc, 3, 8);
}

// Moneda redonda con canto, borde biselado, estrella en relieve y destello. R = rampa de 7 tonos.
function coin(pc, R) {
  const cx = 7.5;
  const cy = 7;
  const r = 5.6;
  const inC = (x, y, oy = 0) => (x - cx) ** 2 + (y - cy - oy) ** 2 <= r * r + 0.6;
  // Canto (grosor de la moneda) abajo
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inC(x, y, 1) && !inC(x, y)) pc.set(x, y, R[1]);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inC(x, y)) continue;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / r;
      const lit = (-dx - dy) / (Math.abs(dx) + Math.abs(dy) + 0.001); // 1 = arriba-izquierda
      let c;
      if (d > 0.8) c = lit > 0.5 ? R[5] : lit > -0.2 ? R[4] : lit > -0.7 ? R[3] : R[2];
      else if (d > 0.62) c = lit > 0.3 ? R[2] : lit < -0.3 ? R[5] : R[3];
      else c = dx + dy > 2 ? R[3] : R[4];
      pc.set(x, y, c);
    }
  }
  // Estrella en relieve (con sombra abajo-derecha)
  const star = ['..XX..', 'XXXXXX', '.XXXX.', '.X..X.'];
  const isS = (i, j) => star[j] !== undefined && star[j][i] === 'X';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if (isS(i, j) && !isS(i + 1, j + 1)) pc.set(6 + i, 6 + j, R[2]);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if (isS(i, j)) pc.set(5 + i, 5 + j, j === 0 || i === 0 || !isS(i - 1, j) ? R[6] : R[5]);
  rim(pc);
  glint(pc, 11, 3);
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
    // Tronco acostado con el corte a la vista (anillos) y una hojita
    const B = ['#3c2210', '#5a3418', '#76461f', '#93602e', '#b07a3e', '#c8955a'];
    const E = ['#9a6432', '#c08a4e', '#dcac6c', '#efc98e', '#fbe2b2'];
    for (let y = 5; y <= 12; y++) {
      for (let x = 1; x <= 11; x++) {
        if (x === 1 && (y === 5 || y === 12)) continue;
        pc.set(x, y, y === 5 ? B[4] : y <= 9 ? B[3] : y === 10 ? B[2] : y === 11 ? B[1] : B[0]);
      }
    }
    // Vetas de la corteza (largas y horizontales) y un nudo
    for (const [x0, x1, y, c] of [[3, 7, 7, 2], [6, 9, 9, 2], [2, 4, 10, 1], [8, 10, 11, 0], [4, 6, 6, 4], [8, 10, 6, 4], [2, 3, 8, 4]]) for (let x = x0; x <= x1; x++) pc.set(x, y, B[c]);
    pc.set(1, 6, B[4]);
    pc.set(1, 7, B[4]);
    pc.set(5, 8, B[1]);
    pc.set(6, 8, B[0]);
    pc.set(5, 9, B[2]);
    pc.set(6, 7, B[4]);
    // Corte: elipse con corteza, albura clara y anillos
    const cx = 11.5;
    const cy = 8.5;
    for (let y = 4; y <= 13; y++) {
      for (let x = 8; x <= 15; x++) {
        const dx = (x - cx) / 3.1;
        const dy = (y - cy) / 4.2;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        const s = x - cx + (y - cy);
        const lit = s < -1.5 ? 1 : s > 2 ? -1 : 0;
        let c;
        if (d > 0.78) c = lit > 0 ? B[3] : lit < 0 ? B[0] : B[1];
        else if (d > 0.6) c = E[3 + lit];
        else if (d > 0.4) c = E[1 + (lit > 0 ? 1 : 0)];
        else if (d > 0.18) c = E[3 - (lit < 0 ? 1 : 0)];
        else c = E[0];
        pc.set(x, y, c);
      }
    }
    pc.set(13, 10, E[1]);
    pc.set(13, 11, E[0]);
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
    // Trozo de carbón con caras planas (facetas) y destellos fríos
    const R = ['#121219', '#1c1d27', '#282a36', '#363948', '#4a4e62', '#6a7088', '#a8b0c8'];
    const m = mask((x, y) => {
      const d = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      return d(6, 9.5, 3.6) || d(10, 8.5, 3.7) || d(8.5, 11.5, 2.8) || d(8.5, 6, 2.6) || d(4.5, 7.5, 2);
    });
    const seeds = [[5, 6, 4], [9, 5, 5], [12, 8, 3], [4, 10, 3], [8, 9, 4], [11, 12, 1], [7, 13, 1], [3, 8, 4]];
    const id = new Int8Array(256);
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
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const k = id[y * 16 + x];
        let t = seeds[k][2];
        // Arista iluminada donde empieza otra faceta (arriba o a la izquierda)
        const up = inM(m, x, y - 1) ? id[(y - 1) * 16 + x] : -1;
        const lf = inM(m, x - 1, y) ? id[y * 16 + x - 1] : -1;
        if ((up >= 0 && up !== k) || (lf >= 0 && lf !== k)) t = Math.min(5, t + 1);
        if (!inM(m, x + 1, y) || !inM(m, x, y + 1)) t = Math.max(0, t - 2);
        pc.set(x, y, R[t]);
      }
    }
    rim(pc);
    pc.set(8, 4, R[6]);
    pc.set(5, 6, R[5]);
    glint(pc, 9, 5, false);
  },
  gel(pc) {
    // Gota de gel azul, translúcida: brillo grande arriba y luz que la atraviesa abajo
    const R = ['#1c3478', '#2650b0', '#3474e0', '#4f98fa', '#80bcff', '#bfe0ff'];
    const m = spans({ 3: [7, 8], 4: [6, 9], 5: [5, 10], 6: [4, 11], 7: [3, 12], 8: [2, 13], 9: [2, 13], 10: [2, 13], 11: [2, 13], 12: [2, 13], 13: [3, 12] });
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const t = sphereLight(x, y, 7.5, 9.5, 6.5);
        let c = t > 0.55 ? R[4] : t > 0.25 ? R[3] : t > -0.1 ? R[2] : R[1];
        if (!inM(m, x + 1, y) || (!inM(m, x, y + 1) && x > 9)) c = R[1];
        if (!inM(m, x, y + 1) && x >= 4 && x <= 9) c = R[3]; // luz que atraviesa
        if (y === 12 && x >= 5 && x <= 8) c = R[2];
        pc.set(x, y, c);
      }
    }
    // Burbujitas adentro
    pc.set(10, 10, R[4]);
    pc.set(9, 11, R[3]);
    pc.set(6, 11, R[3]);
    rim(pc);
    // Brillo especular
    pc.set(5, 6, '#ffffff');
    pc.set(4, 7, R[5]);
    pc.set(5, 7, '#ffffff');
    pc.set(6, 6, R[5]);
    pc.set(4, 8, R[5]);
    pc.set(7, 4, R[5]);
  },
  iron_bar(pc) {
    ingot(pc, IRON);
  },
  gold_bar(pc) {
    ingot(pc, GOLD);
  },
  hellstone_bar(pc) {
    // Metal infernal oscuro con grietas de lava encendida
    ingot(pc, HELL, () => {
      for (const [x, y, c] of [[4, 10, 3], [5, 11, 4], [6, 11, 3], [8, 10, 4], [9, 10, 5], [9, 11, 3], [7, 8, 4], [8, 7, 3], [10, 8, 5], [12, 9, 4], [13, 8, 3]]) pc.set(x, y, FIRE[c]);
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
    // Flor rosada de 5 pétalos con centro amarillo, tallo y hoja
    const S = ['#1e4a1e', '#2e6a2a', '#45903a', '#66b04c', '#94d066'];
    for (let y = 9; y <= 14; y++) pc.set(7, y, S[2]);
    for (let y = 9; y <= 14; y++) pc.set(8, y, S[1]);
    for (const [x, y, c] of [[9, 11, 3], [10, 11, 4], [11, 10, 4], [9, 12, 2], [10, 12, 2], [11, 11, 3], [12, 10, 3], [5, 13, 3], [6, 13, 2], [4, 12, 4]]) pc.set(x, y, S[c]);
    const P = ['#7a1a44', '#b82a62', '#e04a84', '#f474a4', '#ffa6c8', '#ffd8e8'];
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
  life_crystal(pc) {
    // Cristal de vida: corazón de rubí tallado en facetas, con brillo
    const R = ['#4a0618', '#8a0e2e', '#c01c40', '#e83a5a', '#ff6e86', '#ffa8b8', '#ffe4ea'];
    const m = spans({ 2: [2, 5, 10, 13], 3: [1, 6, 9, 14], 4: [1, 14], 5: [1, 14], 6: [1, 14], 7: [1, 14], 8: [2, 13], 9: [3, 12], 10: [4, 11], 11: [5, 10], 12: [6, 9], 13: [7, 8] });
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const left = x <= 7;
        const top = y <= 5;
        let c = top ? (left ? R[4] : R[3]) : left ? R[3] : R[2];
        // Faceta de la mesa (centro) y aristas
        if (Math.abs(x - 7.5) + Math.abs(y - 6.5) < 3.2) c = left ? R[4] : R[3];
        if (x === 8 && y >= 4) c = R[4];
        if (x === 7 && y >= 4) c = R[2];
        if (!inM(m, x + 1, y) || !inM(m, x, y + 1)) c = left ? R[2] : R[1];
        if (!inM(m, x + 1, y + 1) && !inM(m, x, y + 1) && !left) c = R[0];
        if ((!inM(m, x - 1, y) || !inM(m, x, y - 1)) && top) c = R[5];
        pc.set(x, y, c);
      }
    }
    pc.set(3, 3, R[6]);
    pc.set(4, 3, R[5]);
    pc.set(3, 4, R[5]);
    pc.set(10, 3, R[5]);
    pc.set(5, 8, R[4]);
    rim(pc);
    glint(pc, 3, 3);
    pc.set(12, 2, '#ffffff');
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
    // Cerradura
    paint(pc, ['lhhl', 'hbbm', 'bkkm', 'mkmd'], { h: GOLD[5], l: GOLD[4], b: GOLD[3], m: GOLD[2], d: GOLD[1], k: '#2a160b' }, 6, 6);
    rim(pc);
    glint(pc, 6, 6, false);
  },
  door_item(pc) {
    // Puerta de madera con dos paneles hundidos, bisagras y manija
    paint(pc, [
      '....lllllllh....',
      '...lbbbbbbbbm...',
      '...Ibddddddbm...',
      '...Ibdmmmmlbm...',
      '...lbdmmmmlbm...',
      '...lbdmmmmlbm...',
      '...lblllllhbm...',
      '...lbbbbbbGbm...',
      '...lbbbbbbgbm...',
      '...lbddddddbm...',
      '...lbdmmmmlbm...',
      '...Ibdmmmmlbm...',
      '...Iblllllhbm...',
      '...dkkkkkkkkk...',
    ], { ...WD, I: IRON[5], G: GOLD[5], g: GOLD[2] }, 0, 1);
    for (const y of [3, 4, 12, 13]) pc.set(4, y, IRON[2]);
    rim(pc);
  },
  chair_item(pc) {
    paint(pc, [
      '..hll...........',
      '...lb...........',
      '...lbm..........',
      '...lb...........',
      '...lbm..........',
      '...lb...........',
      '...lb...........',
      '...lhhhhhhhhhl..',
      '...lbbbbbbbbbm..',
      '...lkdddddddkd..',
      '...lb......lb...',
      '...lbmmmmmmlb...',
      '...lb......lb...',
      '...dk......dk...',
    ], WD, 0, 1);
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
    // Jarra sobre la mesa
    paint(pc, ['lhh.', 'lbbm', 'lbbd', 'mddk'], { l: '#9aa8b8', h: '#e8f0f6', b: '#c4d0dc', m: '#7a8898', d: '#5a6878', k: '#3e4a5a' }, 9, 1);
    pc.set(13, 2, '#7a8898');
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
      '.lbssRRRRRRRRlb.',
      '.lbSSrRRRRRRrlb.',
      '.lhlllllllllllb.',
      '.lbmmmmmmmmmmmb.',
      '.lb..........lb.',
      '.dk..........dk.',
    ], { ...WD, p: '#ffffff', P: '#d4d8e8', s: '#f4f0e8', S: '#c8c0b4', q: '#ff6a5a', R: '#d8343e', r: '#9a1c30' }, 0, 2);
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
    // Aguijón de la reina: cono curvo ámbar con franjas y veneno violeta en la punta
    const R = ['#4a1e06', '#7a3a0c', '#b8661a', '#e09a28', '#f6c84a', '#fff0a0'];
    const ax = 3;
    const ay = 13;
    const bx = 13;
    const by = 3;
    const L = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / L;
    const uy = (by - ay) / L;
    const at = (x, y) => ((x - ax) * ux + (y - ay) * uy) / L;
    const side = (x, y) => (x - ax) * -uy + (y - ay) * ux - Math.sin(at(x, y) * Math.PI) * 1.1; // < 0: arriba-izquierda
    const m = mask((x, y) => {
      const t = at(x, y);
      if (t < -0.08 || t > 1) return false;
      return Math.abs(side(x, y)) <= 2.7 * (1 - t) + 0.35;
    });
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const t = at(x, y);
        const s = side(x, y);
        let k = s < -0.9 ? 4 : s < 0.3 ? 3 : s < 1.2 ? 2 : 1;
        if (t > 0.7) k = Math.max(0, k - 2); // punta oscura
        else if (t > 0.5) k = Math.max(0, k - 1);
        if (t < 0.3 && Math.floor(t * 14) % 2 === 1) k = Math.max(0, k - 2); // franjas de abeja
        pc.set(x, y, R[k]);
      }
    }
    for (const [x, y] of [[4, 9], [5, 8], [7, 6], [8, 5]]) if (inM(m, x, y)) pc.set(x, y, R[5]);
    rim(pc);
    // Gota de veneno
    pc.set(14, 2, '#d070ff');
    pc.set(14, 1, '#f4c8ff');
    pc.set(15, 2, '#8a2ac0');
    pc.set(14, 3, '#8a2ac0');
    glint(pc, 3, 9, false);
  },
  relic_hive(pc) {
    // Panal de la colmena: hexágono de celdas con miel brillante y una gota colgando
    const W = ['#5a2e06', '#8a4a0a', '#c47a14', '#e8a828', '#f8d050', '#fff0a0'];
    const H = ['#a85a08', '#d88a10', '#ffb020', '#ffd060'];
    const m = spans({ 2: [5, 10], 3: [4, 11], 4: [3, 12], 5: [2, 13], 6: [2, 13], 7: [2, 13], 8: [2, 13], 9: [2, 13], 10: [2, 13], 11: [3, 12], 12: [4, 11], 13: [5, 10] });
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const row = Math.floor((y - 1) / 3);
        const off = row % 2 ? 2 : 0;
        const cy = (y - 1) % 3;
        const cx = (x + off) % 4;
        const wall = cy === 0 || cx === 0;
        const shade = x + y > 18 ? -1 : x + y < 11 ? 1 : 0;
        let c;
        if (wall) c = W[3 + shade];
        else c = cx === 1 && cy === 1 ? H[shade > 0 ? 1 : 0] : cx === 3 && cy === 2 ? H[3] : H[2 + (shade < 0 ? -1 : 0)];
        if (!inM(m, x + 1, y) || !inM(m, x, y + 1)) c = W[1];
        if (!inM(m, x - 1, y) || !inM(m, x, y - 1)) c = W[4];
        pc.set(x, y, c);
      }
    }
    // Gota de miel colgando
    for (const [x, y, c] of [[8, 14, H[2]], [9, 14, H[1]], [8, 15, H[1]], [7, 14, H[3]]]) pc.set(x, y, c);
    rim(pc);
    glint(pc, 5, 4);
    pc.set(7, 14, '#fff0a0');
  },
  relic_eye(pc) {
    // Ojo del cielo: globo con venas, iris violeta brillante y pupila
    const S = ['#4a2a4e', '#7a5a80', '#a690ae', '#d0c4d6', '#ece6ee', '#ffffff'];
    const cx = 7.5;
    const cy = 7.5;
    const r = 6.4;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r + 0.3) continue;
        const t = sphereLight(x, y, cx, cy, r);
        pc.set(x, y, S[t > 0.75 ? 5 : t > 0.45 ? 4 : t > 0.1 ? 3 : t > -0.3 ? 2 : 1]);
      }
    }
    // Venas
    for (const [x0, y0, x1, y1] of [[2, 5, 4, 6], [2, 10, 4, 9], [13, 11, 11, 10], [10, 2, 9, 4], [5, 13, 6, 11]]) pc.line(x0, y0, x1, y1, '#c83a50');
    for (const [x, y] of [[2, 5], [2, 10], [13, 11], [10, 2], [5, 13]]) pc.set(x, y, '#8a1a34');
    // Iris (cóncavo: más claro abajo a la derecha) y pupila
    for (let y = 4; y <= 12; y++) {
      for (let x = 5; x <= 13; x++) {
        const d = Math.hypot(x - 8.6, y - 8);
        if (d > 3.3) continue;
        const t = (x - 8.6 + (y - 8)) / 4;
        pc.set(x, y, d > 2.6 ? '#3a1068' : t > 0.3 ? '#c080ff' : t > -0.3 ? '#8a40d8' : '#6020a8');
      }
    }
    pc.disc(8.6, 8, 1.4, '#12061c');
    rim(pc);
    pc.set(6, 6, '#ffffff');
    pc.set(7, 6, '#ffffff');
    pc.set(6, 7, '#f0e0ff');
    pc.set(10, 10, '#e8c8ff');
  },
  relic_core(pc) {
    // Núcleo de cristal: gema tallada violeta con corazón celeste que brilla
    const R = ['#2a1046', '#4a1a7a', '#7434b4', '#a45cdc', '#cc90f4', '#f0d4ff'];
    const hw = (y) => (y <= 7 ? 0.5 + (y - 1) * 0.9 : 0.5 + (14 - y) * 0.9);
    const m = mask((x, y) => y >= 1 && y <= 14 && Math.abs(x - 7.5) <= hw(y) + 0.01);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inM(m, x, y)) continue;
        const left = x <= 7;
        const top = y <= 7;
        const inner = Math.abs(x - 7.5) + Math.abs(y - 7.5) * 0.9 < 3.6;
        let c = top ? (left ? R[4] : R[3]) : left ? R[2] : R[1];
        if (inner) c = top ? (left ? R[5] : R[4]) : left ? R[3] : R[2];
        if (!inM(m, x + 1, y) || !inM(m, x, y + 1)) c = top ? R[2] : R[0];
        if ((!inM(m, x - 1, y) || !inM(m, x, y - 1)) && top) c = R[5];
        pc.set(x, y, c);
      }
    }
    // Corazón que brilla
    for (const [x, y, c] of [[7, 6, '#8ef0ff'], [8, 6, '#2ad0f0'], [6, 7, '#8ef0ff'], [7, 7, '#ffffff'], [8, 7, '#8ef0ff'], [9, 7, '#2ad0f0'], [6, 8, '#2ad0f0'], [7, 8, '#8ef0ff'], [8, 8, '#2ad0f0'], [9, 8, '#1a90c8'], [7, 9, '#1a90c8'], [8, 9, '#1a90c8']]) pc.set(x, y, c);
    rim(pc);
    glint(pc, 4, 4);
    pc.set(12, 11, '#ffffff');
  },
  relic_flame(pc) {
    // Llama eterna en un brasero de oro con rubí
    paint(pc, [
      '........1.......',
      '.......12.......',
      '...1...121...1..',
      '...1..12221..1..',
      '..121.12321.12..',
      '..1221233321121.',
      '..1223444432211.',
      '..1234555543211.',
      '...12345554321..',
    ], { 1: FIRE[1], 2: FIRE[2], 3: FIRE[3], 4: FIRE[4], 5: FIRE[5] }, 0, 1);
    const m = spans({ 10: [2, 13], 11: [3, 12], 12: [4, 11], 13: [6, 9], 14: [4, 11] });
    bevel(pc, m, GOLD);
    for (let x = 2; x <= 13; x++) pc.set(x, 10, GOLD[5]);
    pc.set(2, 10, GOLD[6]);
    pc.set(7, 11, '#ff9aa8');
    pc.set(8, 11, '#e02040');
    pc.set(7, 12, '#e02040');
    pc.set(8, 12, '#8a0a28');
    rim(pc);
    pc.set(5, 1, FIRE[3]);
    pc.set(11, 1, FIRE[2]);
    pc.set(1, 3, FIRE[2]);
    glint(pc, 3, 10, false);
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
    // Brújula de bronce: argolla, esfera de marfil, aguja roja y de acero
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
        if (d > 4.7) pc.set(x, y, lit > 0.5 ? B[5] : lit > -0.2 ? B[4] : lit > -0.7 ? B[3] : B[2]);
        else if (d > 4) pc.set(x, y, lit > 0.2 ? B[1] : B[2]);
        else pc.set(x, y, dx + dy < -3.5 ? '#d8ccb0' : dx + dy > 3 ? '#e4dac4' : '#f6eedc');
      }
    }
    // Argolla
    paint(pc, ['.lb.', 'l..m', '.bm.'], { l: B[5], b: B[3], m: B[2] }, 6, 0);
    // Marcas cardinales
    for (const [x, y] of [[7, 5], [8, 5], [7, 12], [8, 12], [4, 8], [4, 9], [11, 8], [11, 9]]) pc.set(x, y, '#8a7a5a');
    // Aguja en diagonal (norte rojo arriba-derecha)
    for (const [x, y, c] of [[10, 5, '#ff6a5a'], [9, 6, '#ff6a5a'], [10, 6, '#c02020'], [8, 7, '#ff6a5a'], [9, 7, '#c02020'], [6, 9, '#c8d0dc'], [7, 9, '#7a8494'], [6, 10, '#c8d0dc'], [5, 10, '#c8d0dc'], [5, 11, '#7a8494']]) pc.set(x, y, c);
    pc.set(7, 8, '#ffe070');
    pc.set(8, 8, '#c88a20');
    rim(pc);
    pc.set(5, 6, '#ffffff');
    pc.set(4, 7, '#ffffff');
  },
  depth_meter(pc) {
    // Medidor de profundidad: caja de acero con remaches, pantalla con escala y flecha
    const m = spans({ 1: [4, 11], 2: [3, 12], 3: [3, 12], 4: [3, 12], 5: [3, 12], 6: [3, 12], 7: [3, 12], 8: [3, 12], 9: [3, 12], 10: [3, 12], 11: [3, 12], 12: [3, 12], 13: [3, 12], 14: [4, 11] });
    bevel(pc, m, IRON);
    // Pantalla: más clara arriba (superficie) y más honda abajo
    const scr = ['#3a8aa8', '#2a7090', '#205a78', '#184862', '#12384e', '#0e2a3c', '#0a2030', '#081828'];
    for (let y = 3; y <= 10; y++) {
      for (let x = 5; x <= 10; x++) pc.set(x, y, scr[y - 3]);
      pc.set(5, y, y % 2 ? '#8ef0ff' : scr[y - 3]);
    }
    pc.set(6, 5, '#8ef0ff');
    pc.set(6, 9, '#8ef0ff');
    for (let x = 5; x <= 10; x++) pc.set(x, 2, IRON[1]);
    for (let y = 3; y <= 10; y++) pc.set(4, y, IRON[1]);
    for (let x = 5; x <= 11; x++) pc.set(x, 11, IRON[5]);
    for (let y = 3; y <= 10; y++) pc.set(11, y, IRON[4]);
    // Flecha amarilla
    for (const [x, y] of [[7, 7], [8, 6], [8, 7], [8, 8], [9, 7], [10, 7]]) pc.set(x, y, '#ffd84a');
    pc.set(8, 6, '#fff2a0');
    // Botones y remaches
    pc.set(5, 13, '#ff5a4a');
    pc.set(6, 13, '#a82020');
    pc.set(9, 13, '#5ad86a');
    pc.set(10, 13, '#20883a');
    for (const [x, y] of [[4, 2], [11, 2]]) pc.set(x, y, IRON[6]);
    rim(pc);
    pc.set(10, 3, '#ffffff');
  },
};

export const CTX = {};
