// Arte mejorado: terrain. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Bloques de 16×16 lógicos (×2). Reglas para que encajen en cualquier combinación de variantes:
// los detalles grandes (piedras, vetas, cristales) quedan DENTRO del bloque y los bordes son la base del material.
// Luz desde arriba a la izquierda; sombras más frías/saturadas y brillos más cálidos.
import { hash } from '../systems/PixelArt.js';

// ---------------------------------------------------------------- paletas (oscuro → claro)
// [hondo, oscuro, medio-oscuro, medio, claro, brillo]
const P = {
  dirt: ['#3a1f18', '#53301f', '#6a4127', '#7f5230', '#99683b', '#b88a54'],
  stone: ['#262935', '#373b48', '#4b505d', '#616673', '#7b808b', '#a3a5a6'],
  sand: ['#9a6a3a', '#b98a4c', '#cfa25e', '#ddb56e', '#eac987', '#f8e4ae'],
  sandstone: ['#74462a', '#98663a', '#b5824a', '#c99a5a', '#dcb472', '#efd298'],
  snow: ['#6a7fb4', '#8fa4d0', '#b2c4e4', '#d0def1', '#eaf2fb', '#ffffff'],
  ice: ['#2a5f9e', '#3f7fbf', '#5c9fd6', '#7cbce6', '#a8daf3', '#e8faff'],
  mud: ['#21161a', '#2f2020', '#3d2b28', '#4c3630', '#5e463b', '#7a6050'],
  shadowStone: ['#120d1c', '#1d1629', '#291f39', '#382b4c', '#4c3c65', '#6d5a8e'],
  ash: ['#1f1b1e', '#2b2628', '#383132', '#463e3d', '#574d4a', '#716561'],
  basalt: ['#0c0a10', '#161219', '#201b23', '#2b242e', '#3a313c', '#544855'],
  bedrock: ['#07060c', '#0f0e18', '#181627', '#24213a', '#363152', '#55507c'],
  cloud: ['#7f8fbf', '#a2b2da', '#c3d0ec', '#dde6f7', '#f1f5fd', '#ffffff'],
  lava: ['#6a1408', '#a82a0c', '#d24812', '#ef6c1a', '#ff9c2c', '#ffd35c', '#fff4c0'],
};

// Pasto: hondo, oscuro, medio, claro, brillo (+ acento opcional para las puntas)
const GRASS = {
  forest: { deep: '#1b4e30', dark: '#2a7a36', mid: '#45a542', light: '#6cc54a', hi: '#a6e266' },
  jungle: { deep: '#0f5530', dark: '#1f8a3a', mid: '#46c03a', light: '#86e046', hi: '#cdf76c' },
  shadow: { deep: '#2c1858', dark: '#52308c', mid: '#7e4cc0', light: '#a874e4', hi: '#dcb4ff' },
  crystal: { deep: '#2c5a96', dark: '#4896c4', mid: '#74d0e4', light: '#b0f0f6', hi: '#ffffff', tip: '#f2a6ea', tipDark: '#b86ac8' },
  mushroom: { deep: '#162c78', dark: '#2550bc', mid: '#4282f0', light: '#78b4ff', hi: '#d2f0ff' },
};

// Estilo de los bordes para el tileset (world/Tileset.js): contorno y pasto que baja por los costados.
// line = color del contorno (oscuro y algo saturado, no negro); rim/shade = fuerza del brillo/sombra del borde.
export const EDGE_STYLE = {
  tile_dirt: { line: '#2a160f' },
  tile_grass: { line: '#2a160f', grass: GRASS.forest },
  tile_stone: { line: '#1a1c26' },
  tile_sand: { line: '#6e4724' },
  tile_sandstone: { line: '#4a2a18' },
  tile_snow: { line: '#4c5f94', rim: 0.35 },
  tile_ice: { line: '#1c467c', rim: 0.35 },
  tile_mud: { line: '#170e10' },
  tile_jungle_grass: { line: '#170e10', grass: GRASS.jungle },
  tile_shadow_grass: { line: '#2a160f', grass: GRASS.shadow },
  tile_shadow_stone: { line: '#0b0712' },
  tile_crystal_grass: { line: '#2a160f', grass: GRASS.crystal },
  tile_crystal: { line: '#3a1458', rim: 0.3 },
  tile_ash: { line: '#141113' },
  tile_basalt: { line: '#060508' },
  tile_bedrock: { line: '#030207' },
  tile_coal_ore: { line: '#1a1c26' },
  tile_iron_ore: { line: '#1a1c26' },
  tile_gold_ore: { line: '#1a1c26' },
  tile_hellstone: { line: '#140405' },
  tile_cloud: { line: '#7484b4', rim: 0.25, shade: 0.12 },
  tile_mushroom_grass: { line: '#170e10', grass: GRASS.mushroom },
};

// ---------------------------------------------------------------- bordes del tileset
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Estilo de borde por defecto (texturas sin entrada en EDGE_STYLE): contorno = color medio muy oscurecido. */
export function defaultEdgeStyle(data) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (!n) return { line: [20, 14, 10] };
  // más oscuro y algo más saturado (no negro puro)
  const m = (r + g + b) / (3 * n);
  const sat = (c) => clamp(Math.round((c / n + (c / n - m) * 0.5) * 0.3), 0, 255);
  return { line: [sat(r), sat(g), sat(b)] };
}

/**
 * Dibuja los bordes de un bloque según sus vecinos (mask: 1 arriba, 2 derecha, 4 abajo, 8 izquierda = sólido).
 * data: RGBA de 32×32 (se trabaja en píxeles lógicos de 2×2). Devuelve una copia con:
 * contorno de 1 px lógico donde toca aire, esquinas redondeadas, brillo en el borde de arriba,
 * sombra en el de abajo y, en los pastos, hojas que bajan por los costados.
 */
export function frameTile(data, mask, style, variant) {
  const out = new Uint8ClampedArray(data);
  if (mask === 15) return out;
  const top = !(mask & 1);
  const right = !(mask & 2);
  const bottom = !(mask & 4);
  const left = !(mask & 8);
  const line = typeof style.line === 'string' ? rgb(style.line) : style.line;
  const g = top && style.grass ? style.grass : null;
  const rim = style.rim ?? (g ? 0.1 : 0.2);
  const shade = style.shade ?? 0.22;
  // Mapa lógico de 16×16: null = sin cambio; [r,g,b] = color fijo; 'cut' = transparente
  const over = new Array(256).fill(null);
  const at = (x, y) => y * 16 + x;

  // Esquinas redondeadas donde se juntan dos lados al aire. La punta no queda transparente: detrás de un
  // bloque sólido no se dibuja pared, así que en las cuevas se vería el fondo del cielo por el hueco.
  const corners = [
    [top && left, 0, 0, 1, 1],
    [top && right, 15, 0, -1, 1],
    [bottom && left, 0, 15, 1, -1],
    [bottom && right, 15, 15, -1, -1],
  ];
  const gline = g ? rgb(g.deep) : line;
  const tipColor = [gline, line];
  for (const [on, cx, cy, sx, sy] of corners) {
    if (!on) continue;
    const c = cy === 0 ? gline : line;
    over[at(cx, cy)] = 'tip';
    over[at(cx + sx, cy)] = c;
    over[at(cx, cy + sy)] = c;
    over[at(cx + sx, cy + sy)] = c;
  }

  // Pasto que baja por los costados al aire (solo si el pasto se ve: arriba hay aire)
  if (g) {
    const sides = [];
    if (left) sides.push([0, 1, true]);
    if (right) sides.push([15, -1, false]);
    for (const [x0, dir, lit] of sides) {
      const L = 4 + Math.floor(hash(variant, x0, 77) * 4); // 4..7 filas
      const L2 = L - 2 - Math.floor(hash(variant, x0, 78) * 2);
      for (let y = 0; y <= L + 1; y++) if (!over[at(x0, y)]) over[at(x0, y)] = rgb(g.deep);
      for (let y = 1; y <= L; y++) {
        let c = y === L ? g.dark : lit ? (y === 1 ? g.hi : (y & 1) === 0 ? g.light : g.mid) : y === 1 ? g.light : (y & 1) === 0 ? g.mid : g.dark;
        if (!over[at(x0 + dir, y)]) over[at(x0 + dir, y)] = rgb(c);
      }
      for (let y = 2; y <= L2; y++) over[at(x0 + dir * 2, y)] = rgb(y === L2 ? g.dark : lit ? g.mid : g.dark);
    }
  }

  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      let o = over[at(lx, ly)];
      let mode = 0; // 0 nada, 1 contorno, 2 brillo, 3 sombra
      let k = 0;
      if (!o) {
        if ((top && ly === 0) || (bottom && ly === 15) || (left && lx === 0) || (right && lx === 15)) {
          o = top && ly === 0 ? gline : line;
          mode = 1;
        } else if (top && ly === 1) {
          mode = 2;
          k = rim;
        } else if (left && lx === 1) {
          mode = 2;
          k = rim * 0.5;
        } else if (bottom && ly === 14) {
          mode = 3;
          k = shade;
        } else if (right && lx === 14) {
          mode = 3;
          k = shade * 0.6;
        } else continue;
      }
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const p = ((ly * 2 + j) * 32 + lx * 2 + i) * 4;
          if (o === 'tip') {
            // punta de la esquina: el contorno más oscuro y algo transparente (se ve redondeada)
            const c = tipColor[ly === 0 ? 0 : 1];
            out[p] = c[0] * 0.7;
            out[p + 1] = c[1] * 0.7;
            out[p + 2] = c[2] * 0.7;
            out[p + 3] = 190;
          } else if (o) {
            out[p] = o[0];
            out[p + 1] = o[1];
            out[p + 2] = o[2];
            out[p + 3] = Math.max(out[p + 3], mode === 1 ? 170 : 255);
          } else if (mode === 2) {
            // brillo cálido
            out[p] += (255 - out[p]) * k;
            out[p + 1] += (246 - out[p + 1]) * k;
            out[p + 2] += (222 - out[p + 2]) * k * 0.8;
          } else if (mode === 3) {
            // sombra fría
            out[p] *= 1 - k * 1.1;
            out[p + 1] *= 1 - k;
            out[p + 2] *= 1 - k * 0.75;
          }
        }
      }
    }
  }
  return out;
}


// ---------------------------------------------------------------- ayudantes
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Campo de alturas continuo ENTRE bloques: los puntos de la grilla que caen en el borde del bloque
// son iguales en todas las variantes (y se repiten cada 16 px), los de adentro cambian con la variante.
// Así el relieve, las grietas y las vetas siguen de un bloque al otro sin cortes, en cualquier combinación.
function lat(i, j, n, seed, v, bamp) {
  const bi = ((i % n) + n) % n;
  const bj = ((j % n) + n) % n;
  // en el borde: valor compartido y más cerca de 0.5 (si no, el mismo dibujo se repetiría en cada borde)
  if (bi === 0 || bj === 0) return bamp < 0 ? hash(i, j, seed + 101 * (v + 1)) : 0.5 + (hash(bi, bj, seed) - 0.5) * bamp;
  return hash(i, j, seed + 101 * (v + 1));
}
function field(x, y, seed, v, s = 4, bamp = 0.6) {
  const n = 16 / s;
  const gx = x / s;
  const gy = y / s;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = lat(x0, y0, n, seed, v, bamp);
  const b = lat(x0 + 1, y0, n, seed, v, bamp);
  const c = lat(x0, y0 + 1, n, seed, v, bamp);
  const d = lat(x0 + 1, y0 + 1, n, seed, v, bamp);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Alturas (16×16): octava grande continua entre bloques + octava fina libre (bamp2 < 0) + grano. */
function heights(seed, v, s1 = 4, s2 = 2, w2 = 0.4, grain = 0.04, bamp = 0.6, bamp2 = -1) {
  const H = new Float32Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      H[y * 16 + x] = (1 - w2) * field(x + 0.5, y + 0.5, seed, v, s1, bamp) + w2 * field(x + 0.5, y + 0.5, seed + 7, v, s2, bamp2) + (hash(x, y, seed + v * 13) - 0.5) * grain;
    }
  }
  return H;
}
const hAt = (H, x, y) => H[clamp(y, 0, 15) * 16 + clamp(x, 0, 15)];
/** Pendiente hacia la luz (arriba-izquierda): > 0 = cara iluminada, < 0 = cara en sombra. */
const slope = (H, x, y) => hAt(H, x + 1, y + 1) - hAt(H, x - 1, y - 1);

/**
 * Relieve: el tono sale de la altura (bandas) y se aclara/oscurece según mire o no a la luz.
 * idx = índices de la rampa para [bajo, medio, alto]; lit = umbral de pendiente.
 */
function relief(pc, ramp, H, bands = [0.38, 0.64], idx = [2, 3, 4], lit = 0.07) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const h = H[y * 16 + x];
      let i = h < bands[0] ? idx[0] : h > bands[1] ? idx[2] : idx[1];
      const e = slope(H, x, y);
      if (e > lit) i++;
      else if (e < -lit) i--;
      if (e > lit * 2.6) i++;
      pc.set(x, y, ramp[clamp(i, 0, ramp.length - 1)]);
    }
  }
}

/**
 * Curva de nivel de 1 px siempre conectada: píxeles del lado alto que tocan uno del lado bajo.
 * Como el campo sigue entre bloques, las grietas y vetas también. Devuelve una máscara de 16×16.
 */
function contour(H, level) {
  const m = new Uint8Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (H[y * 16 + x] < level) continue;
      if (hAt(H, x - 1, y) < level || hAt(H, x + 1, y) < level || hAt(H, x, y - 1) < level || hAt(H, x, y + 1) < level) m[y * 16 + x] = 1;
    }
  }
  return m;
}
/** Píxeles vecinos (8 direcciones) de una máscara, sin incluirla. */
function halo(m) {
  const h = new Uint8Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (m[y * 16 + x]) continue;
      let near = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) near |= m[clamp(y + j, 0, 15) * 16 + clamp(x + i, 0, 15)];
      h[y * 16 + x] = near;
    }
  }
  return h;
}

/** Motas sueltas de 1 px, solo sobre los colores de 'on' si se indica. */
function specks(pc, seed, count, color, on, margin = 0) {
  for (let k = 0; k < count; k++) {
    const x = margin + Math.floor(hash(k, 1, seed) * (16 - margin * 2));
    const y = margin + Math.floor(hash(k, 2, seed) * (16 - margin * 2));
    if (!on || on.includes(pc.get(x, y))) pc.set(x, y, color);
  }
}

/**
 * Bulto redondeado con luz de arriba a la izquierda (pepitas, costras).
 * c = { hi, light, mid, shade, drop }: brillo, borde iluminado, cuerpo, borde en sombra, sombra proyectada.
 */
function lump(pc, cx, cy, rx, ry, c) {
  const inside = (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    return nx * nx + ny * ny <= 1;
  };
  const x0 = Math.floor(cx - rx - 1);
  const x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1);
  const y1 = Math.ceil(cy + ry + 1);
  if (c.drop) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!inside(x, y) && inside(x - 1, y - 1)) pc.set(x, y, c.drop);
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const up = !inside(x, y - 1);
      const left = !inside(x - 1, y);
      const down = !inside(x, y + 1);
      const right = !inside(x + 1, y);
      let col = c.mid;
      if (down || right) col = c.shade;
      if (up || left) col = down || right ? (nx + ny < 0 ? c.light : c.shade) : c.light;
      if (c.hi && !up && !left && nx < 0 && ny < 0 && nx + ny > -1.2 && nx + ny < -0.45) col = c.hi;
      pc.set(x, y, col);
    }
  }
}

/** Reparte bultos sin que se pisen, todos dentro del bloque (margen ≥ 1). */
function scatter(seed, count, rmin, rmax, gap = 1, tries = 40) {
  const out = [];
  for (let k = 0; k < tries && out.length < count; k++) {
    const rx = rmin + hash(k, 3, seed) * (rmax - rmin);
    const ry = Math.max(1, rx * (0.65 + hash(k, 4, seed) * 0.35));
    const cx = 1 + rx + hash(k, 1, seed) * (14 - rx * 2 - 1);
    const cy = 1 + ry + hash(k, 2, seed) * (14 - ry * 2 - 1);
    if (out.some((o) => Math.abs(o.cx - cx) < o.rx + rx + gap && Math.abs(o.cy - cy) < o.ry + ry + gap)) continue;
    out.push({ cx, cy, rx, ry });
  }
  return out;
}

/** Grietas sobre una curva de nivel: tajo oscuro con el labio de abajo iluminado. */
function levelCracks(pc, H, level, dark, lit) {
  const m = contour(H, level);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!m[y * 16 + x]) continue;
      pc.set(x, y, dark);
      if (lit && y < 15 && !m[(y + 1) * 16 + x]) pc.set(x, y + 1, lit);
    }
  }
  return m;
}

/**
 * Labio de pasto: franja de arriba con hojas que cuelgan en puntas y sombra sobre la tierra de debajo.
 * g = { deep, dark, mid, light, hi, tip?, tipDark? }
 */
function grassLip(pc, v, seed, g, soilShadow) {
  // Largo de cada columna: base 4-5 + "dientes" (hojas que cuelgan) de 3 columnas
  const len = new Array(16).fill(0);
  for (let x = 0; x < 16; x++) len[x] = 4 + (hash(x, 1, seed + v) < 0.35 ? 1 : 0);
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(hash(k, 2, seed + v * 7) * 16);
    const h = 2 + Math.floor(hash(k, 3, seed + v * 7) * 3);
    for (let i = -1; i <= 1; i++) {
      const xi = x + i;
      if (xi < 0 || xi > 15) continue;
      len[xi] = Math.max(len[xi], 4 + h - (i === 0 ? 0 : 2));
    }
  }
  for (let x = 0; x < 16; x++) {
    const L = len[x];
    if (soilShadow) pc.set(x, L, soilShadow);
    for (let y = 0; y < L; y++) {
      let c;
      if (y === 0) c = g.light;
      else if (y === 1) c = hash(x, 5, seed + v) < 0.55 ? g.hi : g.light;
      else if (y === L - 1) c = g.tip && L > 4 ? g.tipDark || g.dark : g.dark;
      else if (y === L - 2 && L > 4) c = g.tip ? g.tip : g.mid;
      else c = hash(x, y, seed + 3 + v) < 0.3 ? g.light : g.mid;
      pc.set(x, y, c);
    }
  }
  // Algunas hojas oscuras sueltas (textura en la franja)
  for (let k = 0; k < 3; k++) pc.set(1 + Math.floor(hash(k, 6, seed + v * 3) * 14), 2, g.dark);
}

// Piedrita de 2×2 con brillo y sombra (c = [sombra, medio, brillo, sombra proyectada])
function pebble(pc, x, y, c) {
  pc.set(x, y, c[2]);
  pc.set(x + 1, y, c[1]);
  pc.set(x, y + 1, c[1]);
  pc.set(x + 1, y + 1, c[0]);
  pc.set(x + 2, y + 1, c[3]);
  pc.set(x + 1, y + 2, c[3]);
}

// ---------------------------------------------------------------- cuerpos de los materiales
function dirtBody(pc, v) {
  const [deep, dark, md, mid, light, hi] = P.dirt;
  // Manchas grandes y suaves (continuas entre bloques) + grano
  const H = heights(300, v, 4, 2, 0.35, 0.22, 0.5);
  relief(pc, P.dirt, H, [0.4, 0.78], [2, 3, 4], 9);
  specks(pc, 301 + v, 12, md, [mid], 0);
  specks(pc, 302 + v, 6, light, [mid], 1);
  // Terrones (bultos de varios tamaños con luz arriba a la izquierda) y hoyitos
  for (const o of scatter(303 + v * 11, 4, 1, 2.6, 1.5)) lump(pc, o.cx, o.cy, o.rx, o.ry, { hi, light, mid: light, shade: mid, drop: dark });
  for (let k = 0; k < 5; k++) {
    const x = 1 + Math.floor(hash(k, 1, 305 + v) * 13);
    const y = 2 + Math.floor(hash(k, 2, 305 + v) * 12);
    if (pc.get(x, y) !== mid && pc.get(x, y) !== md) continue;
    pc.set(x, y, dark);
    pc.set(x + 1, y, k ? dark : deep);
    pc.set(x + 1, y + 1, light);
  }
  return H;
}

function stoneBody(pc, v, pal = P.stone, seed = 400, rocks = 4) {
  const [deep, dark, md, mid, light, hi] = pal;
  const H = heights(seed, v, 4, 2, 0.3, 0.12, 0.5);
  relief(pc, pal, H, [0.42, 2], [2, 3, 3], 9);
  specks(pc, seed + 1 + v, 7, dark, [md, mid], 1);
  // Piedras redondeadas de varios tamaños (algunas se tocan)
  for (const o of scatter(seed + 2 + v * 5, rocks, 1.4, 3.2, -0.5)) lump(pc, o.cx, o.cy, o.rx, o.ry, { hi, light, mid, shade: md, drop: dark });
  // Grietas sobre una curva de nivel (siguen de un bloque al otro), solo en parte (máscara libre por variante)
  const K = heights(seed + 60, v, 4, 2, 0, 0, -1);
  const m = contour(H, 0.64);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!m[y * 16 + x] || K[y * 16 + x] < 0.45) continue;
      pc.set(x, y, deep);
      if (y < 15 && !m[(y + 1) * 16 + x]) pc.set(x, y + 1, light);
    }
  }
  return H;
}

// Mineral incrustado: grupo de pepitas con contorno oscuro (o = [contorno, oscuro, medio, claro, brillo])
function oreVein(pc, cx, cy, seed, o, n = 4) {
  const cells = [];
  for (let k = 0; k < n; k++) {
    const w = 2 + (hash(k, 3, seed) < 0.4 ? 1 : 0);
    const h = 2 + (hash(k, 4, seed) < 0.3 ? 1 : 0);
    const x = Math.round(cx + (hash(k, 1, seed) - 0.5) * 4);
    const y = Math.round(cy + (hash(k, 2, seed) - 0.5) * 4);
    cells.push([clamp(x, 2, 14 - w), clamp(y, 2, 14 - h), w, h]);
  }
  // contorno (sin las esquinas: pepitas redondeadas)
  for (const [x, y, w, h] of cells) {
    for (let j = -1; j <= h; j++) {
      for (let i = -1; i <= w; i++) {
        const cornerOut = (i === -1 || i === w) && (j === -1 || j === h);
        if (!cornerOut) pc.set(x + i, y + j, o[0]);
      }
    }
  }
  for (const [x, y, w, h] of cells) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let c = o[2];
        if (i === 0 || j === 0) c = o[3];
        if (i === w - 1 || j === h - 1) c = i === 0 || j === 0 ? o[2] : o[1];
        pc.set(x + i, y + j, c);
      }
    }
    pc.set(x, y, o[4]);
  }
  return cells;
}

// ---------------------------------------------------------------- pintores
export const PIXEL = {
  dirt(pc, v) {
    dirtBody(pc, v);
    if (v === 0) pebble(pc, 9, 10, ['#5e4c40', '#7a6858', '#9c8a74', P.dirt[1]]);
    if (v === 2) {
      // raicita
      pc.line(4, 5, 6, 7, P.dirt[1]);
      pc.line(6, 7, 7, 10, P.dirt[1]);
      pc.set(5, 5, P.dirt[4]);
    }
  },

  grass(pc, v) {
    PIXEL.dirt(pc, v);
    grassLip(pc, v, 320, GRASS.forest, P.dirt[1]);
  },

  stone(pc, v) {
    stoneBody(pc, v);
  },

  sand(pc, v) {
    const S = P.sand;
    const H = heights(500, v, 4, 2, 0.3, 0.16, 0.5);
    relief(pc, S, H, [0.38, 0.72], [2, 3, 4], 9);
    // Ondas del viento: línea clara con sombra debajo
    for (let k = 0; k < 3; k++) {
      const x = 1 + Math.floor(hash(k, 1, 501 + v) * 9);
      const y = 2 + k * 4 + Math.floor(hash(k, 2, 501 + v) * 2);
      const w = 3 + Math.floor(hash(k, 3, 501 + v) * 3);
      for (let i = 0; i < w; i++) {
        const yy = y + (i === 0 || i === w - 1 ? 1 : 0);
        pc.set(x + i, yy, i === 1 ? S[5] : S[4]);
        pc.set(x + i, yy + 1, S[2]);
      }
    }
    specks(pc, 502 + v, 7, S[1], [S[3], S[2]], 1);
    specks(pc, 503 + v, 4, S[5], [S[3]], 1);
    if (v === 2) {
      // conchita
      pc.set(11, 11, '#f4ece0');
      pc.set(12, 11, '#e0c8b0');
      pc.set(11, 12, '#c8a080');
      pc.set(12, 12, S[0]);
    }
  },

  sandstone(pc, v) {
    const S = P.sandstone;
    // Estratos de 8 px ondeados (la onda sale del campo continuo: siguen de un bloque al otro)
    const W = heights(600, v, 8, 4, 0.3, 0, 0.8, 0.6);
    const T = heights(605, v, 2, 4, 0.3, 0.1, -1, -1);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const yy = y + (W[y * 16 + x] - 0.5) * 9 + 32;
        const band = Math.floor(yy / 8) % 2;
        const row = yy % 8;
        const t = T[y * 16 + x];
        let c = band ? (t < 0.4 ? S[1] : S[2]) : t < 0.38 ? S[2] : t > 0.68 ? S[4] : S[3];
        if (row < 1 && hash(x >> 1, Math.floor(yy / 8), 601 + v) < 0.8) c = band ? S[3] : S[5]; // borde de arriba (iluminado)
        else if (row >= 7.1 && hash(x >> 1, Math.floor(yy / 8), 602 + v) < 0.85) c = S[0]; // junta entre estratos
        pc.set(x, y, c);
      }
    }
    // Grietas verticales cortas y hoyitos
    for (let k = 0; k < 2; k++) {
      const x = 2 + Math.floor(hash(k, 1, 603 + v) * 12);
      const y = 2 + Math.floor(hash(k, 2, 603 + v) * 10);
      pc.set(x, y, S[0]);
      pc.set(x, y + 1, S[0]);
      pc.set(x + 1, y + 1, S[4]);
      pc.set(x - 1, y, S[1]);
    }
    specks(pc, 604 + v, 5, S[5], [S[3]], 1);
  },

  snow(pc, v) {
    const S = P.snow;
    // Nieve limpia: manchas muy suaves y montoncitos con sombra azul solo abajo
    const H = heights(700, v, 4, 2, 0.25, 0.08, 0.5);
    relief(pc, S, H, [0.34, 0.7], [3, 4, 4], 9);
    for (const o of scatter(701 + v * 9, 2, 2.2, 3.4, 1.5)) lump(pc, o.cx, o.cy, o.rx, o.ry, { hi: S[5], light: S[5], mid: S[4], shade: S[4], drop: S[3] });
    specks(pc, 702 + v, 3, S[2], [S[3]], 2);
    // Destellos
    const x = 3 + Math.floor(hash(v, 1, 703) * 10);
    const y = 3 + Math.floor(hash(v, 2, 703) * 10);
    pc.set(x, y, S[5]);
    if (v === 0) {
      pc.set(x - 1, y, '#dbe9ff');
      pc.set(x + 1, y, '#dbe9ff');
      pc.set(x, y - 1, '#dbe9ff');
      pc.set(x, y + 1, '#dbe9ff');
    }
    specks(pc, 704 + v, 3, S[5], [S[4]], 1);
  },

  ice(pc, v) {
    const I = P.ice;
    const H = heights(800, v, 4, 2, 0.25, 0.03, 0.5);
    // Degradado (más claro arriba a la izquierda) + manchas de profundidad
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const t = H[y * 16 + x];
        pc.set(x, y, t < 0.38 ? I[2] : t < 0.64 ? I[3] : I[4]);
      }
    }
    // Reflejos: franjas diagonales largas (claro + brillo)
    const s = 1 + Math.floor(hash(v, 1, 801) * 4);
    for (let i = 0; i < (v === 1 ? 0 : 9); i++) {
      const x = s + i;
      const y = 13 - i;
      if (x > 14 || y < 1) break;
      pc.set(x, y, I[5]);
      if (x + 1 < 15) pc.set(x + 1, y, I[4]);
    }
    const s2 = s + 6 + Math.floor(hash(v, 2, 801) * 3);
    for (let i = 0; i < 4; i++) if (s2 + i < 15) pc.set(s2 + i, 14 - i, I[4]);
    // Fisura con borde claro
    if (v !== 0) {
      const fx = 10 + v;
      pc.line(fx, 3, fx - 2, 6, I[1]);
      pc.set(fx + 1, 3, I[5]);
      pc.set(fx - 1, 6, I[5]);
    }
    // Burbujas atrapadas
    for (let k = 0; k < 2; k++) {
      const x = 2 + Math.floor(hash(k, 4, 803 + v) * 12);
      const y = 2 + Math.floor(hash(k, 5, 803 + v) * 12);
      pc.set(x, y, I[5]);
      pc.set(x + 1, y + 1, I[2]);
    }
  },

  mud(pc, v) {
    const M = P.mud;
    const H = heights(900, v, 4, 2, 0.5, 0.08);
    relief(pc, M, H, [0.36, 2], [2, 3, 3], 0.08);
    // Charquitos que brillan (lodo húmedo) en lo más bajo
    for (let y = 1; y < 15; y++) {
      for (let x = 1; x < 15; x++) {
        const h = H[y * 16 + x];
        if (h < 0.24) pc.set(x, y, M[1]);
        if (h < 0.24 && hAt(H, x, y + 1) >= 0.24 && hash(x, y, 905 + v) < 0.6) pc.set(x, y + 1, '#7a6a66');
      }
    }
    specks(pc, 901 + v, 5, M[5], [M[4]], 1);
  },

  jungle_grass(pc, v) {
    PIXEL.mud(pc, v);
    grassLip(pc, v, 920, GRASS.jungle, P.mud[0]);
    // musgo que sigue un poco hacia abajo
    for (let k = 0; k < 2; k++) {
      const x = 1 + Math.floor(hash(k, 1, 921 + v) * 13);
      const y = 7 + Math.floor(hash(k, 2, 921 + v) * 6);
      pc.set(x, y, GRASS.jungle.dark);
      pc.set(x + 1, y, GRASS.jungle.mid);
      pc.set(x + 1, y + 1, GRASS.jungle.deep);
    }
  },

  shadow_grass(pc, v) {
    PIXEL.dirt(pc, v);
    grassLip(pc, v, 940, GRASS.shadow, P.dirt[0]);
  },

  shadow_stone(pc, v) {
    const S = P.shadowStone;
    stoneBody(pc, v, S, 1000);
    // Vetas que brillan (violeta), sobre una curva de nivel de un campo amplio: siguen de un bloque al otro
    const G = heights(1050, v, 4, 2, 0, 0, 1);
    const K = heights(1060, v, 4, 2, 0, 0, -1);
    const m = contour(G, 0.55).map((a, i) => a & (K[i] > 0.6));
    const g = halo(m);
    for (let i = 0; i < 256; i++) {
      if (m[i]) pc.px[i] = hash(i, 1, 1051 + v) < 0.25 ? '#f0d4ff' : '#b47af0';
      else if (g[i] && hash(i, 2, 1051) < 0.55) pc.px[i] = '#5a3496';
    }
  },

  crystal_grass(pc, v) {
    PIXEL.dirt(pc, v);
    grassLip(pc, v, 960, GRASS.crystal, P.dirt[0]);
    pc.set(2 + Math.floor(hash(v, 1, 961) * 12), 1, '#ffffff');
  },

  crystal(pc, v) {
    // Facetas (Voronoi): cada cara con su tono según hacia dónde mira, aristas claras arriba a la izquierda
    const C = ['#3a1258', '#5a2086', '#8236b4', '#a854d4', '#cf84ee', '#f2c4ff', '#ffffff'];
    const pts = [];
    for (let k = 0; k < 6; k++) pts.push([hash(k, 1, 1100 + v) * 18 - 1, hash(k, 2, 1100 + v) * 18 - 1, Math.floor(hash(k, 3, 1100 + v) * 4) + 1]);
    const cell = new Int8Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let best = 0;
        let bd = 1e9;
        pts.forEach(([px, py], i) => {
          const d = (x - px) ** 2 + (y - py) ** 2 * 0.7;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        cell[y * 16 + x] = best;
      }
    }
    const at = (x, y) => cell[clamp(y, 0, 15) * 16 + clamp(x, 0, 15)];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const k = at(x, y);
        let c = C[pts[k][2]];
        // degradado dentro de la cara: más claro hacia arriba a la izquierda
        if (hash(x >> 1, y >> 1, 1101 + v) < 0.18) c = C[pts[k][2] + 1];
        if (at(x - 1, y) !== k || at(x, y - 1) !== k) c = C[Math.min(6, pts[k][2] + 2)]; // arista iluminada
        else if (at(x + 1, y) !== k || at(x, y + 1) !== k) c = C[0]; // arista en sombra
        pc.set(x, y, c);
      }
    }
    // Destellos
    const x = 3 + Math.floor(hash(v, 4, 1102) * 9);
    const y = 3 + Math.floor(hash(v, 5, 1102) * 9);
    pc.set(x, y, C[6]);
    pc.set(x + 1, y, C[5]);
    pc.set(x, y + 1, C[5]);
    pc.set(x - 1, y, C[5]);
    pc.set(x, y - 1, C[5]);
  },

  ash(pc, v) {
    const A = P.ash;
    const H = heights(1200, v, 4, 2, 0.45, 0.1);
    relief(pc, A, H, [0.36, 0.66], [2, 3, 4], 0.085);
    specks(pc, 1202 + v, 6, A[0], [A[3], A[2]], 1);
    if (v === 1) {
      // brasa que queda
      pc.set(6, 9, '#ff8a2a');
      pc.set(7, 9, '#a83414');
      pc.set(6, 10, '#6a2414');
    }
  },

  basalt(pc, v) {
    const B = P.basalt;
    // Columnas de basalto de ancho variable (la junta del borde coincide entre bloques);
    // cada tramo tiene su tono y su cara de arriba iluminada, con quiebres a distintas alturas
    const seams = [[3, 8, 11], [4, 9, 12], [2, 6, 10]][v];
    const edges = [-1, ...seams, 15];
    for (let c = 0; c < edges.length - 1; c++) {
      const a = edges[c] + 1;
      const b = edges[c + 1];
      const j1 = 1 + Math.floor(hash(c, 1, 1300 + v) * 7);
      const j2 = j1 + 5 + Math.floor(hash(c, 2, 1300 + v) * 5);
      for (let y = 0; y < 16; y++) {
        const seg = y <= j1 ? 0 : y <= j2 ? 1 : 2;
        const tone = Math.floor(hash(c, seg + 3, 1300 + v) * 3) - 1; // -1, 0, +1
        const joint = y === j1 || y === j2;
        const below = y === j1 + 1 || y === j2 + 1;
        for (let x = a; x <= b; x++) {
          const i = x - a;
          let k = i === 0 ? 4 : x === b ? 0 : x === b - 1 ? 2 : 3;
          if (x !== b) {
            k = clamp(k + tone, 1, 5);
            if (joint) k = 1;
            else if (below) k = Math.min(5, k + 1);
            else if (hash(x, y, 1301 + v) < 0.14) k--;
          }
          pc.set(x, y, B[k]);
        }
      }
    }
    // Fisuras con brasas: pocas, sobre una curva de nivel (siguen entre bloques) y solo en algunas zonas
    const G = heights(1350, v, 4, 2, 0, 0, 1);
    const K = heights(1360, v, 4, 2, 0, 0, -1);
    const m = contour(G, 0.5);
    for (let i = 0; i < 256; i++) {
      if (!m[i] || K[i] < 0.6) continue;
      pc.px[i] = K[i] > 0.72 && hash(i, 1, 1361 + v) < 0.5 ? '#ff7a1e' : K[i] > 0.66 ? '#a8300e' : '#5a1a10';
    }
  },

  lava(pc, v) {
    const L = P.lava;
    // Lava fundida: tonos por altura y vetas brillantes (cada bloque es libre: lo caótico disimula las uniones)
    const H = heights(1400, v, 4, 2, 0.25, 0.05, -1, -1);
    for (let i = 0; i < 256; i++) {
      const h = H[i];
      pc.px[i] = h < 0.3 ? L[2] : h < 0.47 ? L[3] : h < 0.64 ? L[4] : L[5];
    }
    const hot = contour(H, 0.68);
    const warm = contour(H, 0.3);
    for (let i = 0; i < 256; i++) {
      if (warm[i]) pc.px[i] = L[4];
      if (hot[i]) pc.px[i] = hash(i, 1, 1401 + v) < 0.3 ? L[6] : L[5];
    }
    // Costras que flotan: placas oscuras con borde encendido
    for (const o of scatter(1401 + v * 13, 2, 1.2, 1.9, 3)) lump(pc, o.cx, o.cy, o.rx, o.ry, { light: L[2], mid: L[1], shade: L[0], drop: L[5] });
    // Burbuja con chispa blanca
    const x = 3 + Math.floor(hash(v, 1, 1402) * 10);
    const y = 3 + Math.floor(hash(v, 2, 1402) * 10);
    pc.set(x, y, L[6]);
    pc.set(x + 1, y, L[5]);
    pc.set(x, y + 1, L[5]);
  },

  bedrock(pc, v) {
    const B = P.bedrock;
    // Roca dura: facetas planas (bandas marcadas, sin grano) con aristas filosas
    const H = heights(1500, v, 4, 2, 0.3, 0, 0.6, 0.5);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const h = H[y * 16 + x];
        let i = h < 0.35 ? 1 : h < 0.5 ? 2 : h < 0.66 ? 3 : 2;
        const e = slope(H, x, y);
        if (e > 0.1) i++;
        else if (e < -0.08) i = 1;
        pc.set(x, y, B[clamp(i, 0, 5)]);
      }
    }
    levelCracks(pc, H, 0.5, B[0], B[4]);
    levelCracks(pc, H, 0.68, B[0], B[5]);
    specks(pc, 1502 + v, 4, B[0], null, 1);
  },

  coal_ore(pc, v) {
    stoneBody(pc, v, P.stone, 400, 3);
    const o = ['#0a0a10', '#14141c', '#22222c', '#363644', '#8e96b4'];
    oreVein(pc, 5 + hash(v, 1, 1600) * 2, 5 + hash(v, 2, 1600) * 2, 1601 + v, o, 4);
    oreVein(pc, 10 + hash(v, 3, 1600) * 2, 10 + hash(v, 4, 1600) * 2, 1602 + v, o, 3);
  },

  iron_ore(pc, v) {
    stoneBody(pc, v, P.stone, 400, 3);
    const o = ['#3a1a10', '#7a3a1e', '#b0603a', '#dc9466', '#ffd2aa'];
    oreVein(pc, 5 + hash(v, 1, 1700) * 3, 4 + hash(v, 2, 1700) * 3, 1701 + v, o, 3);
    oreVein(pc, 10 + hash(v, 3, 1700) * 2, 10 + hash(v, 4, 1700) * 2, 1702 + v, o, 3);
  },

  gold_ore(pc, v) {
    stoneBody(pc, v, P.stone, 400, 3);
    const o = ['#4a2a06', '#a86c0c', '#e8b420', '#ffe050', '#fffbe0'];
    oreVein(pc, 5 + hash(v, 1, 1800) * 2, 5 + hash(v, 2, 1800) * 3, 1801 + v, o, 3);
    const cells = oreVein(pc, 10 + hash(v, 3, 1800) * 2, 10 + hash(v, 4, 1800) * 2, 1802 + v, o, 3);
    // destello en cruz
    const [x, y] = cells[0];
    pc.set(x, y, '#ffffff');
    pc.set(x - 1, y, '#fff6c0');
    pc.set(x, y - 1, '#fff6c0');
  },

  hellstone(pc, v) {
    const R = ['#140505', '#220909', '#320f0d', '#441713', '#5a2219', '#7a3626'];
    stoneBody(pc, v, R, 1900, 3);
    // Grietas incandescentes sobre una curva de nivel de un campo amplio: pocas, largas y continuas
    const G = heights(1950, v, 4, 2, 0, 0, 1);
    const K = heights(1960, v, 4, 2, 0, 0, 1);
    const m = contour(G, 0.5).map((a, i) => a & (K[i] > 0.48));
    const g = halo(m);
    const g2 = halo(g.map((a, i) => a | m[i]));
    for (let i = 0; i < 256; i++) {
      if (m[i]) pc.px[i] = hash(i, 1, 1901 + v) < 0.3 ? '#fff0a0' : '#ffb63a';
      else if (g[i]) pc.px[i] = hash(i, 2, 1901) < 0.75 ? '#ff5a14' : '#c8300e';
      else if (g2[i] && hash(i, 3, 1901) < 0.5) pc.px[i] = '#7a1a0c';
    }
  },

  cloud_block(pc, v) {
    const C = P.cloud;
    const H = heights(2000, v, 4, 2, 0.35, 0.02);
    relief(pc, C, H, [0.36, 0.58], [2, 3, 4], 0.06);
    // pliegues entre bolitas
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (H[y * 16 + x] < 0.24) pc.set(x, y, C[1]);
  },

  mushroom_grass(pc, v) {
    PIXEL.mud(pc, v);
    grassLip(pc, v, 2100, GRASS.mushroom, P.mud[0]);
    // esporas que brillan en el lodo
    for (let k = 0; k < 3; k++) {
      const x = 1 + Math.floor(hash(k, 1, 2101 + v) * 14);
      const y = 6 + Math.floor(hash(k, 2, 2101 + v) * 9);
      pc.set(x, y, k === 0 ? '#bfeaff' : '#5aa0ff');
    }
  },
};

export const CTX = {};
