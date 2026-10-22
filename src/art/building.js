// Arte mejorado: building. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Construcción, paredes de fondo y muebles. Luz desde arriba a la izquierda; sombras más frías y
// saturadas, brillos más cálidos; contorno de 1 px del color local oscurecido (nunca negro puro).
// Bloques y paredes: lo que toca el borde del bloque es igual en las 3 variantes → encajan entre sí.
import { hash } from '../systems/PixelArt.js';

// ---------------------------------------------------------------- paletas (oscuro → claro)
// Madera de muebles: contorno, hondo, oscuro, medio, base, claro, brillo
const WD = { line: '#2a160b', deep: '#4a2913', dark: '#6a401f', mid: '#8a572b', base: '#a66f37', light: '#c48c4c', hi: '#e2b26e' };
// Hierro (azulado en la sombra, cálido en el brillo)
const IR = { line: '#171a26', deep: '#272b3c', dark: '#3e4558', mid: '#5b6476', base: '#7a8494', light: '#a2acb8', hi: '#e2e4e0' };
// Oro
const GD = { deep: '#5e2f10', dark: '#9a5a1a', mid: '#cc8a28', base: '#e8b440', light: '#f8d870', hi: '#fff6c4' };
// Ladrillo gris: junta, sombra, oscuro, medio, claro, brillo
const BRICK = ['#262833', '#454959', '#5c6170', '#737886', '#8e929c', '#b0b1b0'];
// Fuego: rojo hondo → blanco
const FIRE = ['#7a1a0a', '#c23a0e', '#ee6a18', '#ffa22c', '#ffd65a', '#fff6cc'];

// Paredes naturales: hendija, sombra, oscuro, medio, claro, brillo (bastante más oscuras que los bloques)
const WALL = {
  dirt: ['#120a07', '#1d110b', '#28170f', '#321d13', '#3d2417', '#4a2c1c'],
  stone: ['#0e1017', '#171a23', '#1f232e', '#272c38', '#313643', '#3c4251'],
  sandstone: ['#22130b', '#311e10', '#3d2815', '#49311a', '#563b20', '#644628'],
  ice: ['#0e2134', '#152d46', '#1b3954', '#224562', '#2a5170', '#355f82'],
  mud: ['#0d0809', '#150f10', '#1d1516', '#251b1b', '#2e2221', '#392a28'],
  shadow: ['#0a0711', '#110c1b', '#171125', '#1e172f', '#261e3b', '#302647'],
  ash: ['#0c0a0b', '#131011', '#1a1617', '#211c1d', '#292324', '#332b2c'],
};

const wrap = (i) => (i + 16) & 15;

// Ruido suave de valores (grilla de 4 px) → 0..1
function vnoise(x, y, seed) {
  const gx = x / 4;
  const gy = y / 4;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  let fx = gx - x0;
  let fy = gy - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---------------------------------------------------------------- paredes naturales
// "Piedras" con hendijas oscuras (Voronoi sobre un toro de 16×16). Los 3 puntos del borde son iguales en
// todas las variantes y a los de adentro les cuesta llegar al borde: así los píxeles del borde son siempre
// los mismos y las paredes encajan con cualquier vecina.
function wallCells(v, seed, inner = 3, sy = 1, warp = 4) {
  const pts = [
    [hash(1, 0, seed) * 3 - 1, hash(2, 0, seed) * 3 - 1], // esquina
    [6 + hash(3, 0, seed) * 4, hash(4, 0, seed) * 2 - 1], // borde de arriba/abajo
    [hash(5, 0, seed) * 2 - 1, 6 + hash(6, 0, seed) * 4], // borde izquierdo/derecho
  ];
  const nb = pts.length;
  for (let k = 0; k < inner; k++) pts.push([3.5 + hash(k, 1, seed + v * 17) * 9, 3.5 + hash(k, 2, seed + v * 17) * 9]);
  const id = new Int8Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const de = Math.min(x, 15 - x, y, 15 - y);
      // Deformación suave (cero en el borde): bordes de piedra orgánicos, no rectos
      const f = Math.min(1, de / 3) * warp;
      const wx = x + (vnoise(x, y, seed + 40 + v * 9) - 0.5) * f;
      const wy = y + (vnoise(x, y, seed + 50 + v * 9) - 0.5) * f;
      let best = 1e9;
      for (let k = 0; k < pts.length; k++) {
        let dx = Math.abs(wx - pts[k][0]);
        let dy = Math.abs(wy - pts[k][1]);
        dx = Math.min(dx, 16 - dx);
        dy = Math.min(dy, 16 - dy);
        let d = Math.sqrt(dx * dx + dy * dy * sy);
        if (k >= nb) d += Math.max(0, 3 - de) * 2.6;
        if (d < best) {
          best = d;
          id[y * 16 + x] = k;
        }
      }
    }
  }
  // Tono de cada piedra (los del borde, fijos)
  const tone = pts.map((_, k) => 2 + Math.floor(hash(k, 9, k < nb ? seed : seed + v * 17) * 2.4));
  return { id, nb, tone, pts };
}

// Pinta las piedras: brillo arriba/izquierda, hendija abajo/derecha, sombra en la diagonal
function drawWallCells(pc, pal, C, v, seed) {
  const at = (x, y) => C.id[wrap(y) * 16 + wrap(x)];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = at(x, y);
      const t = C.tone[c];
      let i = t;
      if (at(x + 1, y) !== c || at(x, y + 1) !== c) i = 0;
      else if (at(x - 1, y) !== c || at(x, y - 1) !== c) i = Math.min(5, t + 1);
      else if (at(x + 1, y + 1) !== c || at(x + 2, y) !== c || at(x, y + 2) !== c) i = t - 1;
      else {
        const edge = x === 0 || y === 0 || x === 15 || y === 15;
        const n = hash(x >> 1, y >> 1, seed + (edge ? 0 : v * 7)) * 0.6 + hash(x, y, seed + 3 + (edge ? 0 : v * 7)) * 0.4;
        if (n < 0.1) i = t - 1;
        else if (n > 0.93) i = Math.min(5, t + 1);
      }
      pc.set(x, y, pal[i]);
    }
  }
}

// Centro de una piedra de adentro (para poner detalles lejos del borde)
const innerCenter = (C, k) => [Math.round(C.pts[C.nb + k][0]), Math.round(C.pts[C.nb + k][1])];

function naturalWall(pc, v, pal, seed, opts = {}) {
  const C = wallCells(v, seed, opts.inner ?? 3, opts.sy ?? 1, opts.warp ?? 4);
  drawWallCells(pc, pal, C, v, seed);
  return C;
}

// ---------------------------------------------------------------- tablones
// Tablas de 4 px: arriba el canto iluminado, abajo la junta. Las uniones van adentro del bloque y el
// tramo que cruza el borde tiene un tono fijo por fila (sigue igual en el bloque vecino).
function boards(pc, v, pal, seed, opts = {}) {
  // pal: [junta, oscuro, medio-oscuro, base, claro, brillo]
  const tones = [3, 2, 3, 4];
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4;
    const two = hash(row, 1, seed + v) < 0.65;
    const j1 = 2 + Math.floor(hash(row, 2, seed + v) * 5);
    const j2 = two ? 9 + Math.floor(hash(row, 3, seed + v) * 5) : -1;
    const wrapT = tones[(row + Math.floor(hash(row, 4, seed) * 2)) % 4];
    const midT = 2 + Math.floor(hash(row, 5, seed + v) * 3);
    for (let x = 0; x < 16; x++) {
      const inMid = two && x > j1 && x < j2;
      const t = inMid ? midT : wrapT;
      for (let r = 0; r < 4; r++) {
        const y = y0 + r;
        let c = pal[t];
        if (r === 3) c = pal[0];
        else if (r === 0) c = pal[Math.min(5, t + 1)];
        // Veta: trazos cortos más oscuros (lejos de los bordes)
        if (r === 2 && x > 0 && x < 15 && hash(x >> 2, row, seed + 11 + v) < 0.3 && hash(x, row, seed + 12 + v) < 0.8) c = pal[Math.max(1, t - 1)];
        if ((x === j1 || x === j2) && r < 3) c = pal[1];
        else if ((x === j1 + 1 || x === j2 + 1) && r === 1) c = pal[Math.min(5, t + 1)];
        pc.set(x, y, c);
      }
    }
    // Clavos junto a la unión
    if (opts.nails && hash(row, 6, seed + v) < 0.3) {
      const nx = j1 + 2;
      pc.set(nx, y0 + 1, opts.nails[0]);
      pc.set(nx, y0 + 2, opts.nails[1]);
    }
    // Nudo de la madera en el tramo del medio
    if (two && j2 - j1 > 5 && hash(row, 7, seed + v) < 0.4) {
      const kx = j1 + 2 + Math.floor(hash(row, 8, seed + v) * (j2 - j1 - 4));
      pc.set(kx, y0 + 1, pal[1]);
      pc.set(kx + 1, y0 + 1, pal[0]);
      pc.set(kx + 1, y0 + 2, pal[1]);
      pc.set(kx, y0 + 2, pal[Math.min(5, midT + 1)]);
    }
  }
}

// Tejas: escamas de 4×4 en hileras corridas (cada una tapa la de abajo), con bisel y algún tono distinto
function shingles(pc, v, pal, seed, wood = false) {
  // pal: [hondo, oscuro, medio-oscuro, base, claro, brillo]
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 2 : 0;
    for (let r = 0; r < 4; r++) {
      const y = row * 4 + r;
      for (let x = 0; x < 16; x++) {
        const u = (x + off) & 3;
        const si = (x + off) >> 2; // 0..3 (4 = la misma que 0)
        const wrapS = off && (si === 0 || si === 4);
        const t = wrapS ? 3 : 2 + Math.floor(hash(si, row, seed + v) * 2.6);
        let c = pal[t];
        if (u === 0) c = r === 3 ? pal[0] : pal[1]; // separación entre tejas
        else if (r === 3) c = u === 3 || wood ? pal[0] : pal[1]; // borde de abajo (redondeado en las de arcilla)
        else if (wood && u === 2 && r === 1 + (si & 1)) c = pal[t - 1]; // veta de la tablilla
        else if (r === 0) c = u === 1 ? pal[Math.min(5, t + 2)] : pal[Math.min(5, t + 1)];
        else if (u === 3) c = pal[t - 1];
        else if (r === 2 && u === 2) c = pal[t - 1];
        else if (u === 1) c = pal[Math.min(5, t + 1)];
        pc.set(x, y, c);
      }
    }
  }
}

// ---------------------------------------------------------------- ayudantes de muebles
// Veta en una pieza de madera (trazos oscuros sueltos)
function grainV(pc, x0, y0, w, h, seed, c) {
  for (let x = x0; x < x0 + w; x++) {
    for (let y = y0; y < y0 + h; y++) if (hash(x, y >> 2, seed) < 0.18 && hash(x, y, seed + 1) < 0.75) pc.set(x, y, c);
  }
}
function grainH(pc, x0, y0, w, h, seed, c) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) if (hash(x >> 2, y, seed) < 0.18 && hash(x, y, seed + 1) < 0.75) pc.set(x, y, c);
  }
}

// Remache de hierro (2 px)
function rivet(pc, x, y) {
  pc.set(x, y, IR.hi);
  pc.set(x + 1, y, IR.mid);
  pc.set(x, y + 1, IR.mid);
  pc.set(x + 1, y + 1, IR.deep);
}

// Llama: forma de gota con capas (borde rojo, naranja, amarillo, núcleo blanco)
function flame(pc, cx, base, h, lean = 0) {
  for (let j = 0; j < h; j++) {
    const t = j / (h - 1); // 0 abajo, 1 arriba
    const half = Math.max(0, Math.round((1 - t) * (h * 0.36) + (t < 0.25 ? -1 + t * 4 : 0)));
    const y = base - j;
    const sx = Math.round(cx + lean * t * t * 2);
    for (let dx = -half; dx <= half; dx++) {
      const e = half === 0 ? 0 : Math.abs(dx) / (half + 0.5);
      let c = FIRE[3];
      if (e > 0.7 || t > 0.8) c = FIRE[2];
      if (e > 0.9 && half > 1) c = FIRE[1];
      if (e < 0.45 && t < 0.6) c = FIRE[4];
      if (e < 0.2 && t < 0.4 && j > 0) c = FIRE[5];
      pc.set(sx + dx, y, c);
    }
  }
}

// ---------------------------------------------------------------- pintores
export const PIXEL = {
  // ---------- bloques de construcción ----------
  planks(pc, v) {
    boards(pc, v, ['#4a2814', '#73461f', '#8c5a2a', '#a66f36', '#bd8644', '#d8a764'], 80, { nails: ['#e0c08a', '#5e3a1c'] });
  },

  stone_brick(pc, v) {
    // Ladrillos de 8×4 en hileras corridas: biselados, con tonos distintos, alguno rajado o desportillado
    const B = BRICK;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let y = row * 4; y < row * 4 + 4; y++) {
        const r = y & 3;
        for (let x = 0; x < 16; x++) {
          const u = (x + off) & 7;
          const bi = (x + off) >> 3; // 0, 1 (o 2 = el mismo que 0 en las hileras corridas)
          const wrapBrick = off && bi !== 1;
          const t = wrapBrick ? 3 - ((row >> 1) % 2) : 2 + Math.floor(hash(bi, row, 130 + v) * 3);
          let c = B[t];
          if (r === 3 || u === 7) c = B[0];
          else if (r === 0) c = B[Math.min(5, t + 1)];
          else if (u === 0) c = B[Math.min(5, t + 1)];
          else if (r === 2) c = B[t - 1];
          else if (u === 6) c = B[t - 1];
          else if (hash(x, y, wrapBrick ? 132 : 132 + v) < 0.06) c = B[t - 1];
          if (r === 0 && u === 0) c = B[5];
          pc.set(x, y, c);
        }
      }
    }
    // Grieta en un ladrillo de adentro (fila par: ladrillos de x 0..6 y 8..14)
    const k = Math.floor(hash(1, 1, 131 + v) * 4);
    const ry = (k % 2) * 8;
    const bx = k < 2 ? 1 : 9;
    pc.set(bx + 2, ry + 1, B[0]);
    pc.set(bx + 3, ry + 1, B[0]);
    pc.set(bx + 3, ry + 2, B[0]);
    pc.set(bx + 4, ry + 2, B[1]);
    // Desportillado: esquina gastada de un ladrillo
    if (v !== 1) {
      const cy = v === 0 ? 4 : 12;
      const cx = v === 0 ? 5 : 13;
      pc.set(cx, cy, B[1]);
      pc.set(cx, cy + 1, B[2]);
    }
  },

  glass(pc, v) {
    // Vidrio claro: tinte celeste, borde interior apenas más claro y reflejos en diagonal
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, 'rgba(178,226,246,0.32)');
    const s = 3 + v * 2;
    for (let k = 0; k < 7; k++) {
      pc.set(s + k, 12 - k, 'rgba(236,250,255,0.9)');
      if (k > 0 && k < 6) pc.set(s + k + 1, 12 - k, 'rgba(200,238,252,0.6)');
    }
    for (let k = 0; k < 3; k++) pc.set(s + 4 + k, 13 - k, 'rgba(220,246,255,0.7)');
    pc.set(12 - v, 3, 'rgba(255,255,255,0.95)');
  },

  red_shingles(pc, v) {
    shingles(pc, v, ['#3e0f16', '#6e1e20', '#93302a', '#b44434', '#d0623f', '#ec9460'], 330);
  },
  wood_shingles(pc, v) {
    shingles(pc, v, ['#2a160a', '#4c2c14', '#6a421f', '#84572a', '#a06e36', '#c4924e'], 340, true);
  },

  wood_platform(pc, v) {
    // Tabla gruesa arriba (lo que se pisa) con ménsulas en escuadra; abajo transparente
    const P = ['#3e2210', '#6a421f', '#8a5a2a', '#a8723a', '#c48c4c', '#e0b06c'];
    const joint = v === 1 ? 7 : v === 2 ? 10 : 4;
    for (let x = 0; x < 16; x++) {
      pc.set(x, 0, P[5]);
      pc.set(x, 1, P[4]);
      pc.set(x, 2, hash(x >> 1, 2, 300) < 0.3 && x > 0 && x < 15 ? P[2] : P[3]);
      pc.set(x, 3, P[2]);
      pc.set(x, 4, P[0]);
    }
    pc.rect(joint, 1, 1, 3, P[0]);
    pc.set(joint, 0, P[3]);
    pc.set(joint - 1, 2, P[2]);
    pc.set(joint + 1, 1, P[5]);
    pc.set(joint + 2, 2, '#c8c4b8'); // clavo
    // Ménsulas: poste corto y riostra en diagonal
    for (const [bx, dir] of [[2, 1], [13, -1]]) {
      pc.rect(bx, 5, 1, 4, P[2]);
      pc.set(bx, 9, P[1]);
      pc.set(bx + dir, 5, P[3]);
      pc.set(bx + dir * 2, 5, P[2]);
      pc.set(bx + dir, 6, P[2]);
      pc.set(bx + dir, 7, P[1]);
      pc.set(bx - dir, 5, P[1]);
      pc.set(bx - dir, 6, P[0]);
      pc.set(bx - dir, 7, P[0]);
      pc.set(bx - dir, 8, P[0]);
      pc.set(bx + dir, 8, P[0]);
      pc.set(bx, 10, P[0]);
      pc.set(bx + dir * 2, 6, P[0]);
      pc.set(bx + dir * 3, 5, P[0]);
    }
  },

  // ---------- paredes de fondo ----------
  wall_dirt(pc, v) {
    const W = WALL.dirt;
    const C = naturalWall(pc, v, W, 100);
    // Piedrita incrustada
    const [x, y] = innerCenter(C, v % 3);
    pc.set(x, y, '#3a302c');
    pc.set(x + 1, y, '#2c2420');
    pc.set(x, y + 1, W[0]);
    pc.set(x + 1, y + 1, W[0]);
  },
  wall_stone(pc, v) {
    const W = WALL.stone;
    const C = naturalWall(pc, v, W, 110, { sy: 1.4 });
    // Grieta fina en una piedra de adentro
    const [x, y] = innerCenter(C, (v + 1) % 3);
    pc.set(x - 1, y - 1, W[0]);
    pc.set(x, y, W[0]);
    pc.set(x, y + 1, W[1]);
    pc.set(x + 1, y - 1, W[5]);
  },
  wall_sandstone(pc, v) {
    naturalWall(pc, v, WALL.sandstone, 240, { sy: 3.2 });
  },
  wall_ice(pc, v) {
    const W = WALL.ice;
    const C = naturalWall(pc, v, W, 250, { sy: 0.6 });
    // Destellos en diagonal
    for (let k = 0; k < 2; k++) {
      const [x, y] = innerCenter(C, k);
      pc.set(x, y, W[5]);
      pc.set(x + 1, y - 1, '#5a8cb0');
      pc.set(x - 1, y + 1, W[4]);
    }
  },
  wall_mud(pc, v) {
    const C = naturalWall(pc, v, WALL.mud, 260, { sy: 1.2 });
    // Raicita
    const [x, y] = innerCenter(C, v % 3);
    pc.set(x - 1, y, '#2a2418');
    pc.set(x, y + 1, '#2a2418');
    pc.set(x + 1, y + 1, '#211c13');
  },
  wall_shadow(pc, v) {
    const C = naturalWall(pc, v, WALL.shadow, 270);
    // Vetas violetas apagadas
    const [x, y] = innerCenter(C, (v + 2) % 3);
    pc.set(x, y, '#3e2a5e');
    pc.set(x + 1, y + 1, '#33244e');
    pc.set(x - 1, y - 1, '#2c2044');
  },
  wall_ash(pc, v) {
    const C = naturalWall(pc, v, WALL.ash, 280, { sy: 1.3 });
    // Brasita apagada
    const [x, y] = innerCenter(C, v % 3);
    pc.set(x, y, '#4a1e12');
    pc.set(x + 1, y, '#30140e');
  },
  wall_wood(pc, v) {
    boards(pc, v, ['#1a0f07', '#2a190c', '#342011', '#3e2714', '#4a2f18', '#583a1e'], 90);
  },
  wall_glass(pc) {
    // Ventana vista desde adentro: marco de madera, cruz de travesaños y vidrio que deja ver el paisaje
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, 'rgba(168,214,240,0.22)');
    const F = ['#2e1a0c', '#4a2e16', '#5e3c1e', '#734a25'];
    pc.rect(0, 0, 16, 1, F[2]);
    pc.rect(0, 15, 16, 1, F[0]);
    pc.rect(0, 0, 1, 16, F[2]);
    pc.rect(15, 0, 1, 16, F[1]);
    pc.rect(7, 1, 2, 14, F[2]);
    pc.rect(1, 7, 14, 2, F[2]);
    pc.rect(8, 1, 1, 14, F[1]);
    pc.rect(1, 8, 14, 1, F[1]);
    pc.set(7, 7, F[3]);
    pc.rect(1, 14, 14, 1, 'rgba(40,24,12,0.35)');
    // Reflejos
    for (const [ox, oy] of [[1, 1], [9, 9]]) {
      pc.set(ox + 1, oy + 3, 'rgba(255,255,255,0.55)');
      pc.set(ox + 2, oy + 2, 'rgba(255,255,255,0.65)');
      pc.set(ox + 3, oy + 1, 'rgba(255,255,255,0.55)');
      pc.set(ox + 3, oy + 3, 'rgba(255,255,255,0.3)');
    }
  },
  facade_window(pc) {
    // Ventana vista desde afuera: marco con contorno, cuatro vidrios con el cielo reflejado arriba,
    // cortinas rojas adentro y alféizar con sombra
    const F = { line: '#2a160b', dark: '#5a3618', mid: '#7a4c24', light: '#9c6834', hi: '#bf8a4a' };
    pc.rect(0, 0, 16, 16, F.line);
    pc.rect(1, 1, 14, 13, F.mid);
    pc.rect(1, 1, 14, 1, F.light);
    pc.rect(1, 1, 1, 13, F.light);
    // Vidrios (2×2) con degradé: reflejo claro arriba, interior oscuro abajo
    const glass = ['#4d7fa2', '#38668a', '#2a5274', '#20425f', '#1c3a52', '#1a3349'];
    for (const [gx, gy] of [[2, 2], [9, 2], [2, 8], [9, 8]]) {
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) pc.set(gx + i, gy + j, glass[Math.min(5, j + (gy > 2 ? 2 : 0))]);
      pc.rect(gx, gy, 5, 1, gy > 2 ? glass[4] : glass[2]); // sombra del marco
      if (gy === 2) {
        // Cortina (adentro, del lado del marco)
        const cx = gx === 2 ? gx : gx + 4;
        const ix = gx === 2 ? 1 : -1;
        for (let j = 0; j < 5; j++) pc.set(cx, gy + j, j < 4 ? '#9a2e28' : '#6a1e1c');
        pc.set(cx + ix, gy, '#c04434');
        pc.set(cx + ix, gy + 1, '#7a2420');
        pc.set(cx, gy, '#c04434');
      } else {
        pc.set(gx === 2 ? gx : gx + 4, gy, '#6a1e1c');
        pc.set(gx === 2 ? gx : gx + 4, gy + 1, '#4e161a');
      }
    }
    // Reflejos en diagonal
    for (const [x, y] of [[4, 6], [5, 5], [6, 4], [11, 6], [12, 5], [3, 12], [4, 11], [10, 12]]) pc.set(x, y, '#8cbcd8');
    pc.set(5, 4, '#d8f0fa');
    pc.set(12, 4, '#d8f0fa');
    // Cruz del marco
    pc.rect(7, 2, 2, 11, F.mid);
    pc.rect(2, 7, 12, 1, F.mid);
    pc.rect(7, 2, 1, 11, F.light);
    pc.rect(2, 7, 12, 1, F.light);
    pc.set(8, 7, F.hi);
    pc.rect(14, 2, 1, 11, F.dark);
    pc.rect(2, 13, 12, 1, F.dark);
    // Alféizar
    pc.rect(0, 13, 16, 1, F.line);
    pc.rect(0, 14, 16, 1, F.hi);
    pc.rect(0, 15, 16, 1, F.dark);
    pc.set(0, 14, F.light);
    pc.set(15, 14, F.mid);
  },

  // ---------- muebles (objetos de varios bloques: 16 px de arte por bloque) ----------
  door_closed(pc) {
    // Puerta de tres tablas con dintel, bisagras de hierro a la izquierda y argolla a la derecha
    pc.rect(0, 0, 16, 1, WD.light);
    pc.rect(0, 1, 16, 1, WD.dark);
    pc.set(0, 0, WD.hi);
    // Tablas
    for (const [x, t] of [[2, 0], [6, 1], [10, 0]]) {
      pc.rect(x, 2, 4, 46, t ? WD.mid : WD.base);
      pc.rect(x, 2, 1, 46, t ? WD.base : WD.light);
      pc.rect(x + 3, 2, 1, 46, WD.dark);
      grainV(pc, x + 1, 3, 2, 44, 401 + x, t ? WD.dark : WD.mid);
    }
    pc.rect(2, 2, 12, 1, WD.deep); // sombra bajo el dintel
    pc.rect(2, 47, 12, 1, WD.deep);
    // Travesaños con riostra en diagonal
    for (const y of [8, 37]) {
      pc.rect(2, y, 12, 3, WD.base);
      pc.rect(2, y, 12, 1, WD.light);
      pc.rect(2, y + 2, 12, 1, WD.dark);
      pc.rect(2, y + 3, 12, 1, WD.deep);
    }
    for (let k = 0; k < 26; k++) {
      const y = 36 - k;
      const x = 3 + Math.round((k * 8) / 25);
      pc.set(x, y, WD.light);
      pc.set(x + 1, y, WD.base);
      pc.set(x + 2, y, WD.dark);
      pc.set(x + 3, y + 1, WD.deep);
    }
    // Bisagras: flejes de hierro con punta y remaches
    for (const y of [9, 38]) {
      pc.rect(1, y - 1, 8, 3, IR.base);
      pc.rect(1, y - 1, 8, 1, IR.light);
      pc.rect(1, y + 1, 8, 1, IR.dark);
      pc.set(9, y, IR.mid);
      pc.set(9, y - 1, IR.dark);
      pc.set(9, y + 1, IR.deep);
      pc.set(10, y, IR.dark);
      pc.set(3, y, IR.hi);
      pc.set(7, y, IR.hi);
      pc.set(1, y - 1, IR.hi);
    }
    // Argolla y chapa de la cerradura
    pc.rect(10, 21, 3, 5, IR.dark);
    pc.rect(10, 21, 3, 1, IR.light);
    pc.set(11, 23, IR.deep);
    pc.set(11, 24, IR.deep);
    pc.set(10, 26, GD.light);
    pc.set(12, 26, GD.dark);
    pc.set(10, 27, GD.base);
    pc.set(12, 27, GD.mid);
    pc.set(11, 28, GD.dark);
    pc.outline(WD.line);
  },
  door_open(pc) {
    // Puerta abierta: el dintel y la hoja de canto (en escorzo) junto a las bisagras, a la izquierda
    pc.rect(0, 0, 16, 1, WD.light);
    pc.rect(0, 1, 16, 1, WD.dark);
    pc.set(0, 0, WD.hi);
    pc.rect(1, 2, 4, 46, WD.base);
    pc.rect(1, 2, 1, 46, WD.light);
    pc.rect(3, 2, 1, 46, WD.mid);
    pc.rect(4, 2, 1, 46, WD.dark);
    pc.rect(5, 2, 1, 46, WD.deep); // canto
    grainV(pc, 2, 3, 1, 44, 411, WD.mid);
    pc.rect(1, 2, 5, 1, WD.deep);
    for (const y of [8, 37]) {
      pc.rect(1, y, 4, 3, WD.base);
      pc.rect(1, y, 4, 1, WD.light);
      pc.rect(1, y + 2, 4, 1, WD.dark);
      pc.rect(1, y + 3, 4, 1, WD.deep);
      // Fleje de la bisagra
      pc.rect(1, y + 1, 4, 1, IR.base);
      pc.set(1, y + 1, IR.hi);
      pc.set(0, y + 1, IR.dark);
    }
    pc.rect(5, 22, 2, 4, IR.dark); // argolla asomando
    pc.set(6, 22, IR.light);
    pc.set(6, 25, GD.mid);
    pc.outline(WD.line);
  },
  chair(pc) {
    // Silla mirando a la derecha: respaldo con remate a la izquierda, asiento con almohadón rojo
    pc.rect(2, 5, 3, 27, WD.base); // poste del respaldo (y pata de atrás)
    pc.rect(2, 5, 1, 27, WD.light);
    pc.rect(4, 5, 1, 27, WD.dark);
    // Remate redondeado
    pc.rect(2, 3, 3, 2, WD.light);
    pc.set(3, 2, WD.hi);
    pc.set(2, 3, WD.hi);
    pc.set(4, 4, WD.mid);
    // Travesaños del respaldo
    for (const y of [7, 12, 16]) {
      pc.rect(5, y, 2, 2, WD.base);
      pc.set(5, y, WD.light);
      pc.set(6, y + 1, WD.dark);
    }
    pc.rect(7, 6, 1, 13, WD.mid); // canto del respaldo
    pc.set(7, 6, WD.light);
    // Asiento
    pc.rect(2, 21, 13, 2, WD.base);
    pc.rect(2, 21, 13, 1, WD.light);
    pc.rect(2, 23, 13, 1, WD.dark);
    pc.set(14, 22, WD.mid);
    // Almohadón
    pc.rect(5, 18, 9, 3, '#a8322a');
    pc.rect(6, 18, 7, 1, '#d4563e');
    pc.set(5, 18, '#7a1e1e');
    pc.set(13, 18, '#7a1e1e');
    pc.rect(5, 20, 9, 1, '#6e1a1c');
    pc.set(9, 19, '#7a1e1e');
    // Pata de adelante (torneada)
    pc.rect(11, 24, 3, 8, WD.base);
    pc.rect(11, 24, 1, 8, WD.light);
    pc.rect(13, 24, 1, 8, WD.dark);
    pc.rect(11, 27, 3, 1, WD.mid);
    // Travesaño de abajo
    pc.rect(5, 27, 6, 1, WD.mid);
    pc.rect(5, 28, 6, 1, WD.deep);
    pc.rect(5, 24, 6, 1, WD.deep); // sombra bajo el asiento
    pc.outline(WD.line);
  },
  table(pc) {
    // Mesa de 3×2 bloques: tapa gruesa con canto, faldón, patas torneadas; un jarro y un tazón con frutas
    pc.rect(0, 14, 48, 3, WD.base);
    pc.rect(0, 14, 48, 1, WD.hi);
    pc.rect(0, 15, 48, 1, WD.light);
    pc.rect(0, 16, 48, 1, WD.mid);
    grainH(pc, 2, 15, 44, 2, 421, WD.base);
    pc.set(47, 15, WD.mid);
    pc.set(47, 16, WD.dark);
    // Faldón
    pc.rect(2, 17, 44, 3, WD.mid);
    pc.rect(2, 17, 44, 1, WD.deep);
    pc.rect(2, 19, 44, 1, WD.dark);
    for (let x = 10; x < 40; x += 6) pc.set(x, 18, WD.dark);
    // Patas torneadas
    for (const x of [3, 41]) {
      pc.rect(x, 20, 4, 12, WD.base);
      pc.rect(x, 20, 1, 12, WD.light);
      pc.rect(x + 3, 20, 1, 12, WD.dark);
      pc.rect(x, 20, 4, 1, WD.deep);
      for (const y of [23, 29]) {
        pc.rect(x - 1, y, 6, 1, WD.light);
        pc.rect(x - 1, y + 1, 6, 1, WD.dark);
        pc.set(x + 4, y, WD.base);
      }
      pc.set(x, 26, WD.mid);
      pc.set(x + 3, 26, WD.deep);
    }
    // Travesaño
    pc.rect(7, 26, 34, 1, WD.mid);
    pc.rect(7, 27, 34, 1, WD.deep);
    // Jarro de cerámica
    pc.rect(30, 7, 5, 7, '#c8d2dc');
    pc.rect(30, 7, 1, 7, '#f2f4f2');
    pc.rect(34, 7, 1, 7, '#8a98ac');
    pc.rect(31, 7, 3, 1, '#5a3a20'); // bebida
    pc.rect(30, 9, 5, 1, '#3e7cb8'); // franja
    pc.set(30, 9, '#6aa4d8');
    pc.rect(35, 9, 2, 1, '#9aa8b8');
    pc.rect(36, 10, 1, 2, '#7a889c');
    pc.set(35, 12, '#7a889c');
    pc.rect(30, 13, 5, 1, '#6a7890');
    // Tazón con frutas
    pc.rect(10, 11, 9, 3, '#8a5a2c');
    pc.rect(10, 11, 9, 1, '#b07a40');
    pc.rect(11, 13, 7, 1, '#5a3618');
    pc.disc(12, 9.5, 1.6, '#d8402e');
    pc.set(11, 9, '#ff8a6a');
    pc.disc(16, 9, 1.6, '#e8b830');
    pc.set(15, 8, '#fff0a0');
    pc.rect(13, 8, 2, 3, '#7a3a8e');
    pc.set(13, 8, '#a868c0');
    pc.set(15, 6, '#4a8a2a');
    pc.outline(WD.line);
  },
  bed(pc) {
    // Cama de 4×2 bloques: cabecera tallada a la izquierda, almohada, sábana y frazada roja con guarda dorada
    pc.rect(1, 6, 6, 26, WD.base);
    pc.rect(1, 6, 1, 26, WD.light);
    pc.rect(6, 6, 1, 26, WD.dark);
    pc.rect(2, 3, 4, 3, WD.base); // arco
    pc.rect(2, 3, 4, 1, WD.light);
    pc.set(3, 2, WD.hi);
    pc.set(4, 2, WD.light);
    pc.set(1, 5, WD.light);
    pc.set(6, 5, WD.mid);
    pc.rect(3, 8, 2, 7, WD.mid); // panel tallado
    pc.set(3, 8, WD.dark);
    pc.rect(4, 9, 1, 6, WD.light);
    pc.rect(3, 15, 2, 1, WD.dark);
    // Pie de la cama
    pc.rect(57, 12, 6, 20, WD.base);
    pc.rect(57, 12, 6, 1, WD.light);
    pc.set(57, 12, WD.hi);
    pc.rect(57, 12, 1, 20, WD.light);
    pc.rect(62, 12, 1, 20, WD.dark);
    pc.rect(59, 14, 2, 6, WD.mid);
    pc.rect(60, 15, 1, 5, WD.light);
    // Larguero
    pc.rect(7, 22, 50, 3, WD.base);
    pc.rect(7, 22, 50, 1, WD.light);
    pc.rect(7, 24, 50, 1, WD.dark);
    pc.rect(7, 25, 50, 1, WD.deep);
    // Patas
    for (const x of [1, 57]) {
      pc.rect(x, 28, 6, 1, WD.mid);
      pc.rect(x, 29, 6, 3, WD.dark);
      pc.rect(x, 29, 1, 3, WD.base);
    }
    // Colchón y sábana
    pc.rect(7, 16, 50, 6, '#e8e0d0');
    pc.rect(7, 16, 50, 1, '#fffaf0');
    pc.rect(7, 20, 50, 1, '#c4b8a4');
    pc.rect(7, 21, 50, 1, '#a89a86');
    // Almohada
    pc.rect(8, 12, 11, 5, '#f4f0e6');
    pc.rect(9, 11, 9, 1, '#f4f0e6');
    pc.rect(9, 11, 6, 1, '#ffffff');
    pc.rect(8, 12, 1, 4, '#ffffff');
    pc.rect(8, 16, 11, 1, '#c8bca8');
    pc.rect(18, 12, 1, 4, '#d4cab8');
    pc.set(13, 14, '#ddd4c2');
    pc.set(14, 13, '#ddd4c2');
    // Frazada
    pc.rect(22, 15, 35, 9, '#b8342a');
    pc.rect(22, 15, 35, 1, '#e0604a');
    pc.rect(22, 16, 35, 1, '#cc4634');
    pc.rect(22, 22, 35, 1, '#8a2224');
    pc.rect(22, 23, 35, 1, '#5e1622');
    // Guarda dorada y rombos
    pc.rect(22, 20, 35, 1, GD.mid);
    pc.rect(22, 21, 35, 1, '#8a2224');
    for (let x = 26; x < 56; x += 6) {
      pc.set(x, 17, GD.light);
      pc.set(x - 1, 18, GD.mid);
      pc.set(x + 1, 18, GD.mid);
      pc.set(x, 19, GD.dark);
      pc.set(x, 18, '#8a2224');
    }
    for (let x = 23; x < 57; x += 2) pc.set(x, 20, GD.base);
    // Doblez de la sábana
    pc.rect(20, 15, 3, 7, '#f8f4ec');
    pc.rect(22, 15, 1, 7, '#c8bca8');
    pc.set(20, 15, '#ffffff');
    // Flecos
    for (let x = 23; x < 57; x += 3) pc.set(x, 24, '#7a1e22');
    pc.outline(WD.line);
  },
  chest(pc) {
    // Cofre de 2×2 bloques: tapa abombada de tablas, esquineros y flejes de hierro, cerradura dorada
    pc.rect(2, 14, 28, 17, WD.base);
    for (const y of [19, 25]) {
      pc.rect(2, y, 28, 1, WD.dark);
      pc.rect(2, y + 1, 28, 1, WD.light);
    }
    grainH(pc, 3, 15, 26, 15, 431, WD.mid);
    pc.rect(2, 14, 1, 17, WD.light);
    pc.rect(29, 14, 1, 17, WD.dark);
    pc.rect(2, 30, 28, 1, WD.deep);
    // Tapa abombada
    pc.rect(3, 4, 26, 1, WD.light);
    pc.rect(2, 5, 28, 8, WD.base);
    pc.rect(2, 5, 28, 1, WD.hi);
    pc.rect(2, 6, 28, 1, WD.light);
    pc.rect(2, 9, 28, 1, WD.mid);
    pc.rect(2, 10, 28, 1, WD.light);
    grainH(pc, 3, 7, 26, 2, 432, WD.mid);
    pc.rect(2, 12, 28, 1, WD.dark);
    pc.rect(1, 13, 30, 1, WD.deep); // canto de la tapa
    pc.rect(29, 5, 1, 8, WD.dark);
    pc.rect(2, 5, 1, 7, WD.light);
    // Flejes de hierro con remaches
    for (const x of [5, 25]) {
      pc.rect(x, 4, 2, 27, IR.base);
      pc.rect(x, 4, 1, 27, IR.light);
      pc.rect(x + 1, 13, 1, 18, IR.dark);
      pc.set(x, 4, IR.hi);
      pc.rect(x, 13, 2, 1, IR.deep);
      rivet(pc, x, 16);
      rivet(pc, x, 27);
    }
    // Esquineros
    for (const x of [2, 27]) {
      pc.rect(x, 27, 3, 4, IR.base);
      pc.rect(x, 27, 3, 1, IR.light);
      pc.rect(x, 30, 3, 1, IR.dark);
      pc.rect(x, 5, 3, 3, IR.base);
      pc.rect(x, 5, 3, 1, IR.hi);
      pc.rect(x, 7, 3, 1, IR.dark);
    }
    // Cerradura
    pc.rect(13, 10, 6, 8, GD.base);
    pc.rect(13, 10, 6, 1, GD.hi);
    pc.rect(13, 10, 1, 8, GD.light);
    pc.rect(18, 10, 1, 8, GD.dark);
    pc.rect(13, 17, 6, 1, GD.deep);
    pc.rect(15, 13, 2, 2, '#2a1606');
    pc.set(15, 15, '#2a1606');
    pc.set(16, 15, '#4a2a10');
    pc.set(14, 11, GD.hi);
    pc.outline(WD.line);
  },
  furnace(pc) {
    // Horno de piedra (2×2 bloques): cúpula de ladrillos, chimenea, boca con fuego que ilumina la piedra
    const S = ['#24252e', '#3e404b', '#555865', '#6c707b', '#858893', '#a5a7aa'];
    const inShape = (x, y) => {
      if (y >= 16) return x >= 2 && x <= 29;
      const dx = x - 15.5;
      const dy = y - 16;
      return dx * dx + dy * dy <= 14 * 14;
    };
    for (let y = 2; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (!inShape(x, y)) continue;
        // Ladrillos de 6×4
        const row = Math.floor((y - 2) / 4);
        const r = (y - 2) & 3;
        const u = (x + (row % 2) * 3) % 6;
        const bi = Math.floor((x + (row % 2) * 3) / 6);
        let t = 2 + Math.floor(hash(bi, row, 520) * 3);
        if (x > 24) t = Math.max(2, t - 1); // volumen: más oscura a la derecha
        let c = S[t];
        if (r === 3 || u === 5) c = S[0];
        else if (r === 0 || u === 0) c = S[Math.min(5, t + 1)];
        else if (r === 2) c = S[t - 1];
        pc.set(x, y, c);
      }
    }
    // Brillo de la cúpula arriba a la izquierda
    for (const [x, y] of [[8, 5], [9, 4], [10, 4], [6, 7], [7, 6]]) if (pc.get(x, y) && pc.get(x, y) !== S[0]) pc.set(x, y, S[5]);
    // Chimenea
    pc.rect(23, 0, 5, 6, S[3]);
    pc.rect(23, 0, 1, 6, S[4]);
    pc.rect(27, 0, 1, 6, S[1]);
    pc.rect(22, 0, 7, 2, S[4]);
    pc.rect(22, 0, 7, 1, S[5]);
    pc.rect(23, 1, 5, 1, S[0]);
    pc.rect(24, 3, 3, 1, S[0]);
    // Boca: arco oscuro con el resplandor en el borde
    const mouth = (x, y) => {
      if (y >= 22) return x >= 9 && x <= 22;
      const dx = x - 15.5;
      const dy = y - 22;
      return dx * dx + dy * dy <= 6.6 * 6.6 && y >= 15;
    };
    // Resplandor sobre la piedra alrededor de la boca
    for (let y = 12; y < 32; y++) {
      for (let x = 5; x < 27; x++) {
        if (mouth(x, y) || !pc.get(x, y)) continue;
        let near = 0;
        for (let k = 1; k <= 2 && !near; k++) if (mouth(x - k, y) || mouth(x + k, y) || mouth(x, y + k) || mouth(x, y - k)) near = k;
        if (!near) continue;
        const c = pc.get(x, y);
        pc.set(x, y, c === S[0] ? '#4a2416' : near === 1 ? '#e08a3a' : '#a0623a');
      }
    }
    for (let y = 15; y < 30; y++) for (let x = 8; x < 24; x++) if (mouth(x, y)) pc.set(x, y, y < 20 ? '#1a0e0c' : '#2a120a');
    // Fuego y brasas
    flame(pc, 13, 27, 8, -0.5);
    flame(pc, 18, 27, 7, 0.5);
    flame(pc, 15.5, 27, 10, 0);
    pc.rect(10, 27, 12, 2, FIRE[2]);
    pc.rect(9, 28, 14, 1, FIRE[1]);
    for (const x of [10, 13, 17, 20]) {
      pc.set(x, 28, '#3a1a10');
      pc.set(x + 1, 28, FIRE[4]);
    }
    // Repisa de la boca
    pc.rect(8, 29, 16, 2, S[3]);
    pc.rect(8, 29, 16, 1, '#e0a050');
    pc.rect(8, 30, 16, 1, S[1]);
    pc.rect(2, 31, 28, 1, S[0]);
    pc.outline('#17161c');
  },
  anvil(pc) {
    // Yunque de hierro (2×1 bloques): cara plana, cuerno a la izquierda, talón a la derecha, pie ancho
    const R = IR;
    // Cara
    pc.rect(7, 2, 21, 4, R.base);
    pc.rect(7, 2, 21, 1, R.hi);
    pc.rect(7, 3, 21, 1, R.light);
    pc.rect(7, 5, 21, 1, R.mid);
    // Cuerno
    pc.rect(3, 2, 4, 3, R.base);
    pc.rect(3, 2, 4, 1, R.light);
    pc.rect(1, 2, 2, 2, R.base);
    pc.set(1, 2, R.light);
    pc.set(0, 2, R.mid);
    pc.rect(3, 4, 4, 1, R.dark);
    pc.set(2, 3, R.dark);
    pc.set(6, 5, R.dark);
    // Talón y agujero
    pc.rect(28, 2, 2, 3, R.base);
    pc.rect(28, 2, 2, 1, R.light);
    pc.set(29, 4, R.dark);
    pc.set(24, 2, R.deep);
    pc.set(25, 2, R.dark);
    // Cintura
    pc.rect(11, 6, 11, 4, R.mid);
    pc.rect(11, 6, 11, 1, R.deep);
    pc.rect(12, 7, 1, 3, R.base);
    pc.rect(20, 7, 2, 3, R.dark);
    pc.set(10, 6, R.dark);
    pc.set(22, 6, R.dark);
    // Pie ancho
    pc.rect(7, 10, 19, 4, R.mid);
    pc.rect(9, 10, 15, 1, R.base);
    pc.rect(7, 11, 19, 1, R.base);
    pc.set(7, 11, R.light);
    pc.rect(7, 13, 19, 1, R.dark);
    pc.rect(23, 11, 3, 2, R.dark);
    pc.rect(6, 14, 21, 2, R.deep);
    pc.rect(6, 14, 21, 1, R.dark);
    pc.rect(13, 14, 7, 2, '#1d2130'); // hueco entre las patas
    // Brillos y marcas de golpes
    pc.set(9, 2, '#ffffff');
    pc.set(10, 2, '#ffffff');
    pc.set(16, 3, R.base);
    pc.set(19, 3, R.base);
    pc.outline(R.line);
  },
  workbench(pc) {
    // Mesa de trabajo: tapa gruesa, patas con estante y herramientas encima (serrucho y martillo)
    pc.rect(0, 5, 16, 3, WD.base);
    pc.rect(0, 5, 16, 1, WD.hi);
    pc.rect(0, 6, 16, 1, WD.light);
    pc.rect(0, 7, 16, 1, WD.dark);
    pc.set(15, 6, WD.mid);
    for (const x of [1, 12]) {
      pc.rect(x, 8, 3, 8, WD.base);
      pc.rect(x, 8, 1, 8, WD.light);
      pc.rect(x + 2, 8, 1, 8, WD.dark);
      pc.rect(x, 8, 3, 1, WD.deep);
    }
    // Estante
    pc.rect(4, 12, 8, 2, WD.mid);
    pc.rect(4, 12, 8, 1, WD.light);
    pc.rect(4, 14, 8, 1, WD.deep);
    pc.set(6, 11, '#c8c4b8');
    pc.rect(8, 11, 2, 1, '#8a5a2a');
    // Serrucho
    pc.rect(2, 3, 6, 2, IR.light);
    pc.rect(2, 3, 6, 1, IR.hi);
    for (let x = 2; x < 8; x += 2) pc.set(x, 4, IR.mid);
    pc.rect(8, 2, 2, 3, WD.dark);
    pc.set(8, 2, WD.light);
    // Martillo
    pc.rect(11, 4, 4, 1, '#8a5a2a');
    pc.rect(12, 1, 2, 3, IR.base);
    pc.set(12, 1, IR.hi);
    pc.set(13, 3, IR.dark);
    pc.outline(WD.line);
  },
  torch(pc) {
    // Antorcha: palo con atadura y una llama viva de capas (con halo y chispas)
    for (const [x, y] of [[5, 3], [10, 3], [4, 5], [11, 5], [5, 7], [10, 7], [7, 0], [9, 0]]) pc.set(x, y, 'rgba(255,170,60,0.28)');
    // Palo
    pc.rect(7, 9, 2, 7, WD.base);
    pc.rect(7, 9, 1, 7, WD.light);
    pc.set(8, 15, WD.dark);
    pc.set(8, 12, WD.mid);
    // Atadura
    pc.rect(6, 8, 4, 2, '#5a3a24');
    pc.rect(6, 8, 4, 1, '#8a6040');
    pc.set(9, 9, '#3a2416');
    // Llama
    pc.rect(6, 7, 4, 1, FIRE[1]);
    for (const [y, x0, x1] of [[6, 6, 9], [5, 6, 9], [4, 6, 9], [3, 7, 9], [2, 7, 8], [1, 8, 8]]) for (let x = x0; x <= x1; x++) pc.set(x, y, FIRE[3]);
    pc.set(6, 3, FIRE[2]);
    pc.set(6, 4, FIRE[2]);
    pc.set(9, 6, FIRE[2]);
    pc.set(9, 3, FIRE[2]);
    pc.set(8, 0, FIRE[2]);
    pc.set(7, 2, FIRE[2]);
    pc.rect(7, 4, 2, 3, FIRE[4]);
    pc.set(8, 3, FIRE[4]);
    pc.set(7, 5, FIRE[5]);
    pc.set(7, 6, FIRE[5]);
    pc.set(8, 6, FIRE[4]);
    // Chispas
    pc.set(10, 1, FIRE[4]);
    pc.set(5, 1, FIRE[3]);
  },
  relic_altar(pc) {
    // Pedestal de mármol con molduras doradas, columna acanalada y una gema engastada
    const M = { line: '#2a2018', deep: '#6e6258', dark: '#9a8e80', mid: '#bcb2a2', base: '#d6cebe', light: '#ece6d8', hi: '#fffaf0' };
    // Tapa con moldura dorada
    pc.rect(1, 2, 14, 3, M.base);
    pc.rect(1, 2, 14, 1, GD.light);
    pc.set(1, 2, GD.hi);
    pc.rect(1, 3, 14, 1, M.light);
    pc.rect(1, 4, 14, 1, M.dark);
    pc.set(14, 3, M.mid);
    pc.rect(3, 5, 10, 1, GD.dark);
    pc.set(3, 5, GD.mid);
    // Columna acanalada
    pc.rect(4, 6, 8, 6, M.mid);
    pc.rect(4, 6, 1, 6, M.light);
    pc.rect(11, 6, 1, 6, M.dark);
    for (const x of [6, 9]) pc.rect(x, 6, 1, 6, M.dark);
    pc.rect(7, 6, 1, 6, M.light);
    pc.rect(10, 6, 1, 6, M.base);
    // Gema engastada
    pc.rect(7, 7, 2, 3, '#c0283c');
    pc.set(7, 7, '#ff8090');
    pc.set(8, 9, '#701428');
    pc.set(6, 8, GD.base);
    pc.set(9, 8, GD.dark);
    pc.set(7, 10, GD.mid);
    pc.set(8, 6, GD.mid);
    // Base escalonada
    pc.rect(3, 12, 10, 1, GD.base);
    pc.set(3, 12, GD.hi);
    pc.rect(1, 13, 14, 3, M.base);
    pc.rect(1, 13, 14, 1, M.light);
    pc.set(1, 13, M.hi);
    pc.rect(1, 15, 14, 1, M.dark);
    pc.rect(14, 13, 1, 3, M.mid);
    pc.rect(4, 14, 8, 1, GD.mid);
    pc.set(4, 14, GD.light);
    pc.outline(M.line);
  },
};

export const CTX = {};
