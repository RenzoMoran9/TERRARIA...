// Arte mejorado: gear. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Herramientas, armas y armaduras: íconos de 16×16 lógicos que también se ven en la mano del jugador.
// Las armas y herramientas van en diagonal: mango abajo a la izquierda (agarre ≈ píxel (3, 13), ver
// TOOL_ORIGIN en player/PlayerAnimator.js) y hoja o cabeza arriba a la derecha (los proyectiles giran el
// ícono suponiendo esa diagonal). Luz desde arriba a la izquierda; sombras frías y saturadas, brillos
// cálidos; contorno de 1 px del color local oscurecido. Los destellos se pintan después del contorno.
import { hash } from '../systems/PixelArt.js';

// ---------------------------------------------------------------- paletas (hondo → brillo)
const WOOD = ['#3c2110', '#5c3519', '#7d4c25', '#9e6631', '#bd8443', '#dba65e', '#f2cb88'];
const DARKWOOD = ['#2a160c', '#432414', '#5e361d', '#7a4a28', '#966035', '#b47c48', '#d09a62'];
const ROPE = ['#4e3a1c', '#7a6034', '#a68a58', '#ccb27e', '#ead6a4'];
const LEATHER = ['#24120e', '#3e2016', '#5c3222', '#7c482e', '#9e6440'];
const STONE = ['#24252b', '#393b43', '#53565e', '#6d7178', '#8b8f94', '#adafae', '#d0cec6'];
const IRON = ['#222738', '#384054', '#545e72', '#748093', '#9da9b8', '#cdd7e0', '#ffffff'];
const GOLD = ['#5a2a0e', '#93531a', '#c78426', '#e6af3c', '#f8d468', '#fff2b8', '#ffffff'];
const HELL = ['#140306', '#2a080c', '#44100f', '#621a14', '#86281a', '#b0401e', '#e0682c']; // piedra infernal (el brillo lo da FIRE)
const FIRE = ['#a8280c', '#e0501a', '#ff8424', '#ffbc3c', '#ffe57c', '#fffadc'];
const CACTUS = ['#11301a', '#1c4c24', '#28692c', '#3c8a36', '#5cab46', '#8ccd66', '#c4ea94'];
const CRYSTAL = ['#2a1048', '#4b1e72', '#7832a4', '#ab56ce', '#d688ea', '#f5bff9', '#ffffff'];
const ICE = ['#2c5a96', '#4896c4', '#74d0e4', '#b0f0f6']; // reflejos del cristal (como los de la tierra de cristal)
const RUBY = ['#4a0a18', '#8e1428', '#d8303e', '#ff8478', '#ffd8cc'];
const SAPPHIRE = ['#0e2258', '#1e48ac', '#3e86e8', '#9cd0ff', '#e4f4ff'];
const STRING = ['#8a8270', '#d8d0b8', '#f4eedc'];
const SPINE = '#f4eec0'; // espinas de cactus
const BONE = ['#6a5a48', '#b8a888', '#e8dcc0']; // cuernos de hueso
const SPARK = '#fffbe6';

// ---------------------------------------------------------------- color
const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const inkCache = new Map();

// Tono de contorno: el color local muy oscurecido, algo más saturado y corrido al frío
function ink(c) {
  let v = inkCache.get(c);
  if (v) return v;
  const [r, g, b] = rgb(c);
  const f = Math.min(0.4, 58 / Math.max(r, g, b, 1));
  const a = [r * f, g * f, b * f];
  const mean = (a[0] + a[1] + a[2]) / 3;
  v = toHex(mean + (a[0] - mean) * 1.3 - 2, mean + (a[1] - mean) * 1.3, mean + (a[2] - mean) * 1.3 + 8);
  inkCache.set(c, v);
  return v;
}
const lum = (c) => {
  const [r, g, b] = rgb(c);
  return r * 3 + g * 6 + b;
};

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
        const l = lum(k);
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

// Destello en cruz (se pinta encima del contorno)
function sparkle(pc, x, y, core = SPARK, arm = null) {
  pc.set(x, y, core);
  if (!arm) return;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pc.set(x + dx, y + dy, arm);
}

// ---------------------------------------------------------------- diagonal
// Coordenadas diagonales de un píxel: a = a lo largo (crece hacia arriba a la derecha),
// c = a lo ancho (negativo = lado de arriba a la izquierda, el iluminado). El eje (c = 0) pasa por el agarre.
const AX = (x, y) => x - y;
const AC = (x, y) => x + y - 16;

/** Recorre los píxeles: fn(a, c, x, y) → color o null. */
function diag(pc, fn) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const col = fn(AX(x, y), AC(x, y), x, y);
      if (col) pc.set(x, y, col);
    }
  }
}

/** Empuñadura de 2 px (c = -1 y 0) entre a0 y a1, con vendas alternadas. R = [hondo, oscuro, medio, claro]. */
function grip(pc, a0, a1, R, band = 1) {
  diag(pc, (a, c, x, y) => {
    if (a < a0 || a > a1 || (c !== -1 && c !== 0)) return null;
    const stripe = (y + band) % 2 === 0;
    if (c === -1) return stripe ? R[3] : R[2];
    return stripe ? R[2] : R[1];
  });
}

/** Guarda cruzada: dos filas (a y a - 1) de ancho |c| ≤ half, sombreada de arriba a la izquierda. */
function guard(pc, a0, half, R, tips = null) {
  diag(pc, (a, c) => {
    if ((a !== a0 && a !== a0 - 1) || Math.abs(c) > half) return null;
    if (tips && Math.abs(c) >= half - 1) return c < 0 ? tips[1] : tips[0];
    const t = c + (a === a0 ? -1 : 1);
    return t <= -3 ? R[5] : t <= -1 ? R[4] : t <= 1 ? R[3] : t <= 3 ? R[2] : R[1];
  });
}

/**
 * Hoja recta: entre a0 y la punta, ancho de cL a cR (c), con punta que se afina.
 * shade(c, a, borde) → color; borde = -1 filo iluminado, 1 filo en sombra, 0 centro.
 */
function blade(pc, a0, tip, cL, cR, shade, taper = 2) {
  diag(pc, (a, c) => {
    if (a < a0 || a > tip) return null;
    const cut = Math.max(0, a - (tip - taper)); // la punta se afina
    const l = cL + Math.ceil(cut / 2);
    const r = cR - Math.floor(cut / 2);
    if (c < l || c > r) return null;
    return shade(c, a, c === l ? -1 : c === r ? 1 : 0);
  });
}

/** Mango de madera en diagonal (c = -1 y 0) entre a0 y a1. */
function haft(pc, a0, a1, R = WOOD) {
  diag(pc, (a, c, x, y) => {
    if (a < a0 || a > a1 || (c !== -1 && c !== 0)) return null;
    if (c === -1) return hash(x, y, 7) < 0.2 ? R[5] : R[4];
    return hash(x, y, 9) < 0.25 ? R[2] : R[3];
  });
}

// ---------------------------------------------------------------- espadas
// Hoja: a de -3 a la punta; guarda en a = -4 y -5; empuñadura de -6 a -11; pomo abajo a la izquierda.
function pommel(pc, R) {
  pc.set(1, 13, R[4]);
  pc.set(1, 14, R[3]);
  pc.set(2, 14, R[2]);
}

const SWORDS = {
  // Madera: espada de práctica tallada, punta redonda, vetas a lo largo y empuñadura atada con cordel
  wood(pc) {
    blade(pc, -3, 12, -1, 1, (c, a, e) => {
      if (e < 0) return a > 7 ? WOOD[6] : WOOD[5];
      if (e > 0) return a % 5 === 2 ? WOOD[2] : WOOD[3];
      return a % 6 === 0 || a % 6 === 2 ? WOOD[3] : WOOD[4];
    }, 1);
    guard(pc, -4, 3, DARKWOOD);
    grip(pc, -11, -6, ROPE);
    pommel(pc, DARKWOOD);
    rim(pc);
  },
  // Piedra: hoja tallada a golpes (lascas que sobresalen y motas), cruz de madera atada con cuero
  stone(pc) {
    blade(pc, -3, 12, -1, 1, (c, a, e) => {
      if (e < 0) return a % 4 === 3 ? STONE[4] : STONE[6];
      if (e > 0) return a === 1 || a === 7 ? null : a % 4 === 0 ? STONE[2] : STONE[3];
      return a % 5 === 2 ? STONE[3] : STONE[5];
    }, 3);
    guard(pc, -4, 3, DARKWOOD);
    diag(pc, (a, c) => ((a === -4 || a === -5) && Math.abs(c) <= 1 ? (c < 0 ? LEATHER[4] : LEATHER[3]) : null)); // atadura
    grip(pc, -11, -6, LEATHER);
    pommel(pc, STONE);
    rim(pc);
  },
  // Hierro: hoja limpia con acanaladura, filo brillante, guarda de acero y empuñadura de cuero
  iron(pc) {
    blade(pc, -3, 13, -1, 1, (c, a, e) => {
      if (e < 0) return a >= 10 || a === 3 ? IRON[6] : IRON[5];
      if (e > 0) return IRON[3];
      return a < 7 ? IRON[2] : IRON[4];
    }, 2);
    guard(pc, -4, 4, IRON, [IRON[2], IRON[5]]);
    grip(pc, -11, -6, LEATHER);
    pommel(pc, IRON);
    rim(pc);
    pc.set(14, 1, IRON[6]);
  },
  // Cactus: hoja verde con costillas y espinas claras; la guarda son dos brazos de cactus; flor en el pomo
  cactus(pc) {
    blade(pc, -3, 12, -1, 1, (c, a, e) => {
      if (e < 0) return a % 4 === 2 ? SPINE : CACTUS[5];
      if (e > 0) return a % 4 === 0 ? CACTUS[4] : CACTUS[2];
      return a % 4 === 0 ? SPINE : CACTUS[4];
    }, 1);
    // Brazos de cactus que suben a los costados de la hoja
    diag(pc, (a, c) => {
      if (a === -4 && Math.abs(c) <= 2) return c < 0 ? CACTUS[5] : CACTUS[3];
      if (a === -5 && Math.abs(c) <= 3) return c < 0 ? CACTUS[4] : CACTUS[2];
      if (Math.abs(c) === 3 && (a === -3 || a === -1)) return c < 0 ? (a === -1 ? CACTUS[6] : CACTUS[5]) : CACTUS[3];
      return null;
    });
    grip(pc, -11, -6, ['#3a2a14', '#6a5a2c', '#8f7c40', '#b4a05a']);
    paint(pc, ['.b', 'ab', '.a'], { a: '#d0488a', b: '#ff9ac8' }, 0, 12);
    rim(pc);
    pc.set(0, 12, '#ffd2e6');
  },
  // Cristal: hoja ancha facetada y translúcida, reflejos celestes, guarda de plata con gema
  crystal(pc) {
    blade(pc, -3, 13, -2, 2, (c, a, e) => {
      if (e < 0) return a > 9 ? CRYSTAL[6] : CRYSTAL[5];
      if (e > 0) return CRYSTAL[2];
      if (c === -1) return (a + 3) % 5 === 0 ? ICE[3] : CRYSTAL[4];
      if (c === 0) return a % 4 === 0 ? CRYSTAL[6] : CRYSTAL[4];
      return (a + 1) % 6 === 0 ? ICE[2] : CRYSTAL[3];
    }, 3);
    guard(pc, -4, 4, IRON, [IRON[3], IRON[5]]);
    diag(pc, (a, c) => (c === 0 && a === -4 ? ICE[3] : c === 0 && a === -5 ? ICE[1] : null));
    grip(pc, -11, -6, [CRYSTAL[0], CRYSTAL[1], CRYSTAL[2], CRYSTAL[3]]);
    pommel(pc, CRYSTAL);
    rim(pc);
    sparkle(pc, 12, 4, '#ffffff');
    sparkle(pc, 14, 1, '#ffffff');
  },
  // Oro: hoja dorada con acanaladura y brillo, guarda ancha con puntas curvas, rubí y empuñadura azul
  gold(pc) {
    blade(pc, -3, 13, -1, 1, (c, a, e) => {
      if (e < 0) return a >= 9 || a === 1 ? GOLD[6] : GOLD[5];
      if (e > 0) return GOLD[2];
      return a < 7 ? GOLD[3] : GOLD[4];
    }, 2);
    guard(pc, -4, 5, GOLD);
    diag(pc, (a, c) => (Math.abs(c) === 5 && a === -3 ? (c < 0 ? GOLD[5] : GOLD[2]) : null)); // puntas curvas
    diag(pc, (a, c) => (c === 0 && a === -4 ? RUBY[3] : c === 0 && a === -5 ? RUBY[2] : null));
    grip(pc, -11, -6, SAPPHIRE);
    pommel(pc, GOLD);
    rim(pc);
    sparkle(pc, 13, 2, '#ffffff', GOLD[5]);
  },
  // Infernal: hoja de piedra infernal con núcleo fundido, filo dentado como llamas y guarda con cuernos
  hell(pc) {
    blade(pc, -3, 13, -2, 1, (c, a, e) => {
      if (e < 0) return a % 4 === 0 ? null : a % 4 === 1 ? HELL[6] : HELL[5];
      if (e > 0) return HELL[2];
      if (c === -1) return a > 9 ? FIRE[3] : HELL[3];
      return a > 9 ? FIRE[5] : a > 4 ? FIRE[4] : FIRE[3];
    }, 2);
    guard(pc, -4, 4, HELL);
    diag(pc, (a, c) => (Math.abs(c) === 4 && (a === -3 || a === -2) ? (c < 0 ? BONE[2] : BONE[1]) : Math.abs(c) === 5 && a === -1 ? BONE[2] : null)); // cuernos
    grip(pc, -11, -6, [HELL[0], HELL[1], HELL[2], HELL[3]]);
    pommel(pc, FIRE);
    rim(pc);
    pc.set(14, 1, FIRE[5]);
    pc.set(10, 2, FIRE[3]); // brasa
  },
};

// ---------------------------------------------------------------- picos
/**
 * Cabeza en media luna: arco alrededor de (cx, cy) que abraza la esquina de arriba a la derecha.
 * u = -1 punta de abajo, 1 punta de arriba; s = -1 borde interior, 1 borde exterior.
 * fx(u, s, x, y) puede devolver un color propio (filo, grietas…) o undefined.
 */
function pickHead(pc, R, o = {}) {
  const { cx = 5, cy = 11, r = 8, th = 2.1, span = 1.02, tip = 0.5, p = 1.5, fx = null } = o;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx;
      const dy = cy - (y + 0.5);
      const u = (Math.atan2(dy, dx) - Math.PI / 4) / span;
      if (Math.abs(u) > 1) continue;
      const half = tip + (th - tip) * Math.pow(1 - u * u, p);
      const s = (Math.hypot(dx, dy) - r) / half;
      if (Math.abs(s) > 1) continue;
      const f = fx && fx(u, s, x, y);
      if (f !== undefined && f !== null) {
        if (f) pc.set(x, y, f);
        continue;
      }
      const L = 0.6 * s + 0.35 * u;
      pc.set(x, y, L > 0.7 ? R[5] : L > 0.25 ? R[4] : L > -0.2 ? R[3] : L > -0.6 ? R[2] : R[1]);
    }
  }
}

/** Atadura o casquillo donde el mango entra en la cabeza. */
function collar(pc, R, a0 = 4, a1 = 5) {
  diag(pc, (a, c) => (a >= a0 && a <= a1 && c >= -2 && c <= 1 ? (c <= -2 ? R[3] : c === -1 ? R[2] : R[1]) : null));
}

const PICKS = {
  // Madera: cabeza gruesa y roma tallada en madera, atada con cordel
  wood(pc) {
    haft(pc, -12, 6, DARKWOOD);
    pickHead(pc, WOOD.slice(1).concat(WOOD[6]), { th: 2.1, tip: 0.9, span: 0.9, p: 1, fx: (u, s) => (Math.abs(s) < 0.2 && Math.abs(u) > 0.25 && Math.abs(u) < 0.7 ? WOOD[3] : undefined) });
    collar(pc, ROPE);
    rim(pc);
  },
  // Piedra: cabeza de piedra tallada, despareja, con motas y atadura de cuero
  stone(pc) {
    haft(pc, -12, 6, WOOD);
    pickHead(pc, STONE, {
      th: 2.4,
      tip: 0.8,
      span: 0.97,
      fx: (u, s, x, y) => {
        if (s > 0.55 && hash(x, y, 41) < 0.3) return null; // mellas
        if (s < 0.5 && s > -0.6 && hash(x, y, 43) < 0.18) return STONE[2];
        return undefined;
      },
    });
    collar(pc, LEATHER);
    rim(pc);
  },
  // Hierro: media luna afilada, filo brillante y casquillo de acero
  iron(pc) {
    haft(pc, -12, 6, WOOD);
    pickHead(pc, IRON, { fx: (u, s) => (s > 0.55 && u > -0.35 ? IRON[5] : Math.abs(u) > 0.86 ? IRON[5] : undefined) });
    collar(pc, IRON);
    rim(pc);
    pc.set(3, 3, IRON[6]);
  },
  // Oro: media luna pulida con grabado, gema en el casquillo y destello
  gold(pc) {
    haft(pc, -12, 6, DARKWOOD);
    pickHead(pc, GOLD, {
      th: 2.2,
      fx: (u, s) => (s > 0.55 && u > -0.4 ? GOLD[5] : Math.abs(s) < 0.25 && Math.abs(u) > 0.3 && Math.abs(u) < 0.7 ? GOLD[2] : Math.abs(u) > 0.86 ? GOLD[6] : undefined),
    });
    collar(pc, GOLD);
    diag(pc, (a, c) => (a === 7 && c === -1 ? RUBY[3] : a === 6 && c === 0 ? RUBY[2] : null));
    rim(pc);
    sparkle(pc, 4, 1, '#ffffff', GOLD[5]);
  },
  // Infernal: cabeza de piedra infernal con borde dentado al rojo y grietas de lava
  hell(pc) {
    haft(pc, -12, 6, [HELL[0], HELL[1], HELL[2], HELL[3], HELL[4], HELL[5]]);
    pickHead(pc, HELL, {
      th: 2.3,
      fx: (u, s) => {
        if (Math.abs(u) > 0.84) return FIRE[4];
        if (s > 0.5) return u > -0.2 ? HELL[6] : HELL[5];
        if (Math.abs(s + 0.05) < 0.28 && Math.abs(u) < 0.75) return Math.abs(u) < 0.25 ? FIRE[4] : FIRE[2];
        return undefined;
      },
    });
    collar(pc, [HELL[0], HELL[1], FIRE[1], FIRE[3]]);
    rim(pc);
    pc.set(2, 2, FIRE[3]);
    pc.set(14, 13, FIRE[2]);
  },
};

// ---------------------------------------------------------------- martillos
// Cabeza atravesada arriba a la derecha: a de a0 a a1 (grosor), |c| ≤ half (largo); caras en los extremos.
function hammerHead(pc, a0, a1, half, R, fx = null) {
  diag(pc, (a, c, x, y) => {
    const face = Math.abs(c) >= half - 1;
    if (a < a0 || a > a1 || Math.abs(c) > half) return null;
    const f = fx && fx(a, c, face, x, y);
    if (f) return f;
    const L = -c * 0.11 + (a - (a0 + a1) / 2) * 0.22;
    if (face) return c < 0 ? (a >= a1 ? R[6] : R[5]) : a >= a1 ? R[3] : R[2];
    return L > 0.5 ? R[5] : L > 0.1 ? R[4] : L > -0.35 ? R[3] : R[2];
  });
}

// ---------------------------------------------------------------- arcos
// Arco apuntando a la derecha: cuerda vertical a la izquierda, palas curvas hacia la derecha que
// se curvan hacia afuera en las puntas, y empuñadura en el medio.
function bowShape(pc, R, gripR, tipR, string = STRING) {
  for (let y = 1; y <= 14; y++) {
    const t = (y - 7.5) / 6.5;
    const cx = 4.9 + (1 - t * t) * 6.0;
    const w = Math.abs(t) < 0.3 ? 2.6 : Math.abs(t) < 0.75 ? 2.1 : 1.5;
    const x0 = Math.round(cx - w / 2);
    const x1 = Math.round(cx + w / 2) - 1;
    for (let x = x0; x <= x1; x++) {
      const up = y < 8;
      pc.set(x, y, x === x0 ? (up ? R[6] : R[5]) : x === x1 ? (up ? R[3] : R[2]) : up ? R[4] : R[3]);
    }
  }
  // Empuñadura con vendas
  for (let y = 6; y <= 9; y++) {
    pc.set(10, y, y % 2 ? gripR[3] : gripR[2]);
    pc.set(11, y, y % 2 ? gripR[2] : gripR[1]);
  }
  // Puntas curvas hacia afuera
  pc.set(6, 1, tipR[3]);
  pc.set(6, 14, tipR[2]);
  // Cuerda
  for (let y = 2; y <= 13; y++) pc.set(4, y, y === 7 || y === 8 ? string[2] : string[1]);
}

// ---------------------------------------------------------------- armaduras
// Paleta por set: R = rampa del material (hondo → brillo), acc = adorno (gema, brasa, cordel), alt = segundo material
const SETS = {
  wood: { R: WOOD, acc: ROPE, alt: DARKWOOD },
  cactus: { R: CACTUS, acc: ['#8a2a5a', '#d0488a', '#ff9ac8', '#ffd2e6'], alt: [SPINE] },
  iron: { R: IRON, acc: LEATHER, alt: IRON },
  crystal: { R: CRYSTAL, acc: ICE, alt: IRON },
  gold: { R: GOLD, acc: RUBY, alt: SAPPHIRE },
  hell: { R: HELL, acc: FIRE, alt: BONE },
};
const setKey = (asset) => (asset && SETS[asset.set] ? asset.set : 'iron');

// Letras: 0-6 = rampa del material; a-d = adorno (oscuro → claro); x-z = segundo material; i = interior oscuro
function armorPal(S) {
  const p = {};
  S.R.forEach((c, i) => (p[i] = c));
  'abcd'.split('').forEach((k, i) => (p[k] = S.acc[Math.min(i, S.acc.length - 1)]));
  'xyz'.split('').forEach((k, i) => (p[k] = S.alt[Math.min(i, S.alt.length - 1)]));
  p.i = ink(S.R[1]);
  return p;
}

// Cascos de frente: cúpula con luz arriba a la izquierda, aro en la fila 7 y la cara (abierta o con visera) abajo.
const HELMETS = {
  // Madera: gorro de tablas con vetas, aro de cordel y carrilleras; cara abierta
  wood: [
    '................',
    '................',
    '......3443......',
    '....34254232....',
    '...3452542332...',
    '..345525424332..',
    '..344424423321..',
    '..bcbcbdcbcbca..',
    '..343iiiiii321..',
    '..343iiiiii321..',
    '..332iiiiii221..',
    '..221......111..',
    '................',
    '................',
    '................',
    '................',
  ],
  // Cactus: cúpula verde con costillas y espinas, y una flor rosada arriba; cara abierta
  cactus: [
    '................',
    '.......cd.......',
    '......bccd......',
    '....345ba343....',
    '...3x5434x433...',
    '..3454354353x2..',
    '..34x43543x321..',
    '..232323232321..',
    '..3x3iiiiii3x1..',
    '..343iiiiii321..',
    '..332iiiiii221..',
    '..221......111..',
    '................',
    '................',
    '................',
    '................',
  ],
  // Hierro: yelmo cerrado con visera en T y remaches
  iron: [
    '................',
    '................',
    '......4543......',
    '....44566543....',
    '...4566665433...',
    '..456666554332..',
    '..455555544332..',
    '..363363363362..',
    '..34iiiiiiii21..',
    '..34543ii43321..',
    '..34543ii43321..',
    '...3443344332...',
    '....23333221....',
    '................',
    '................',
    '................',
  ],
  // Cristal: casco abierto con corona de cristales y una gema celeste en la frente
  crystal: [
    '.......65.......',
    '...6...65...5...',
    '...54.4654.43...',
    '....45666543....',
    '...4566665433...',
    '..456566554332..',
    '..455565544332..',
    '..3634dz436362..',
    '..343iiiiii321..',
    '..343iiiiii321..',
    '..332iiiiii221..',
    '..221......111..',
    '................',
    '................',
    '................',
    '................',
  ],
  // Oro: yelmo cerrado pulido con cresta roja, zafiros en el aro y visera ribeteada
  gold: [
    '.......dc.......',
    '.......cb.......',
    '......4cb3......',
    '....4456b543....',
    '...4566b65433...',
    '..456666554332..',
    '..455555544332..',
    '..3z33z33z33z2..',
    '..36iiiiiiii51..',
    '..34563ii53321..',
    '..34563ii53321..',
    '...3443344332...',
    '....23333221....',
    '................',
    '................',
    '................',
  ],
  // Infernal: yelmo oscuro con cuernos de hueso, ojos rasgados que brillan y grietas al rojo
  hell: [
    '.z............z.',
    '.yz..........zy.',
    '..yz..4543..zy..',
    '...yx4566543xy..',
    '...4566b65433...',
    '..4566665b4332..',
    '..4555b5544332..',
    '..363363363362..',
    '..34dc4334cd21..',
    '..345cd33dc321..',
    '..3454333b4321..',
    '...3443344332...',
    '....23333221....',
    '................',
    '................',
    '................',
  ],
};

// Pechera de frente: hombreras redondas, cuello, pecho con nervio central, cinturón y faldar
const CHEST = [
  '................',
  '................',
  '..45.4iiii3.32..',
  '.45652544314332.',
  '.46542554313321.',
  '.35432544313221.',
  '.23324544322211.',
  '....34544332....',
  '....34544322....',
  '....33443322....',
  '....abbdcbba....',
  '....34243231....',
  '....23132121....',
  '................',
  '................',
  '................',
];
// Detalles de cada set sobre la pechera ('.' = no cambia)
const CHEST_FX = {
  wood: [
    '................',
    '................',
    '................',
    '.....b......c...',
    '......c..b......',
    '.......cb.......',
    '.......bc.......',
    '......b..c......',
    '................',
    '................',
    '....abbcdbba....',
  ],
  cactus: [
    '................',
    '................',
    '..x.........x...',
    '..............x.',
    '.x....x..x......',
    '.....x....x...x.',
    '................',
    '......x..x......',
    '.....x....x.....',
    '................',
    '....2223322.....',
  ],
  iron: [
    '................',
    '................',
    '................',
    '..6..........6..',
    '................',
    '................',
    '................',
    '.....6....5.....',
    '....22222221....',
    '................',
  ],
  crystal: [
    '.6..........4...',
    '.55........43...',
    '................',
    '................',
    '.....6..........',
    '......6.........',
    '......dc........',
    '......ba........',
    '.........3......',
  ],
  gold: [
    '................',
    '................',
    '................',
    '..6..........5..',
    '......6666......',
    '......5..5......',
    '.......dc.......',
    '.......ba.......',
    '................',
    '................',
    '....xyyzxyyx....',
  ],
  hell: [
    'y............y..',
    'zy..........yz..',
    '.z...........z..',
    '................',
    '.......c........',
    '......cd........',
    '.......c........',
    '......c..c......',
    '.....c....c.....',
    '................',
    '....abcddcba....',
  ],
};

// Grebas de frente: cintura, dos piernas con rodilleras y botas
const LEGS = [
  '................',
  '................',
  '...abbcdcbbaa...',
  '...3455443321...',
  '...3454323321...',
  '...3454..3321...',
  '...4565..4431...',
  '...3454..3321...',
  '...3453..3321...',
  '...3443..3221...',
  '...3443..3221...',
  '..34443..43321..',
  '..12222..22211..',
  '................',
  '................',
  '................',
];
const LEGS_FX = {
  wood: [
    '................',
    '................',
    '...abbcdcbbaa...',
    '................',
    '.....2....2.....',
    '.....2....2.....',
    '...bcbc..bcbc...',
    '.....2....2.....',
    '.....2....2.....',
    '.....2....2.....',
    '...bcbc..bcbc...',
  ],
  cactus: [
    '................',
    '................',
    '...2223322221...',
    '....x......x....',
    '...x.....x......',
    '.....x......x...',
    '................',
    '...x......x.....',
    '.....x......x...',
    '................',
    '....x......x....',
  ],
  iron: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '...566...554....',
    '...6665..5442...',
    '...222...2221...',
    '................',
    '................',
    '................',
    '...6......5.....',
  ],
  crystal: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....6......5....',
    '...dc6....dc....',
    '...ba.....ba....',
    '................',
    '................',
    '................',
  ],
  gold: [
    '................',
    '................',
    '...xyyzzyyxx....',
    '................',
    '................',
    '................',
    '...dc.....dc....',
    '...ba.....ba....',
    '................',
    '................',
    '................',
    '...666....55....',
  ],
  hell: [
    '................',
    '................',
    '...abcddcbaa....',
    '................',
    '.....c....c.....',
    '....c......c....',
    '...yzy...yzy....',
    '....c......c....',
    '.....c....c.....',
    '................',
    '................',
  ],
};

// ---------------------------------------------------------------- pintores
export const PIXEL = {
  wood_sword: (pc) => SWORDS.wood(pc),
  stone_sword: (pc) => SWORDS.stone(pc),
  iron_sword: (pc) => SWORDS.iron(pc),
  cactus_sword: (pc) => SWORDS.cactus(pc),
  crystal_sword: (pc) => SWORDS.crystal(pc),
  gold_sword: (pc) => SWORDS.gold(pc),
  hell_sword: (pc) => SWORDS.hell(pc),

  wood_pickaxe: (pc) => PICKS.wood(pc),
  stone_pickaxe: (pc) => PICKS.stone(pc),
  iron_pickaxe: (pc) => PICKS.iron(pc),
  gold_pickaxe: (pc) => PICKS.gold(pc),
  hell_pickaxe: (pc) => PICKS.hell(pc),

  // Mazo de madera: cabeza de tronco con anillos en la punta y dos zunchos oscuros
  wood_hammer(pc) {
    haft(pc, -12, 5, WOOD);
    hammerHead(pc, 6, 10, 5, WOOD, (a, c, face) => (face ? null : Math.abs(c) === 2 ? (c < 0 ? DARKWOOD[3] : DARKWOOD[2]) : null));
    rim(pc);
  },
  // Martillo de hierro: maza de acero con caras anchas y cuña en el ojo del mango
  iron_hammer(pc) {
    haft(pc, -12, 5, WOOD);
    hammerHead(pc, 6, 10, 5, IRON, (a, c, face) => (!face && c === 0 && a === 8 ? IRON[1] : !face && c === -1 && a === 9 ? IRON[2] : null));
    rim(pc);
    pc.set(9, 2, IRON[6]);
  },

  // Daga de hierro: hoja corta en forma de hoja de laurel, guarda de bronce
  iron_dagger(pc) {
    blade(pc, -3, 9, -1, 1, (c, a, e) => (e < 0 ? (a > 5 ? IRON[6] : IRON[5]) : e > 0 ? IRON[3] : a < 4 ? IRON[3] : IRON[4]), 3);
    diag(pc, (a, c) => (Math.abs(c) === 2 && a >= -1 && a <= 3 ? (c < 0 ? IRON[5] : IRON[2]) : null));
    guard(pc, -4, 3, GOLD);
    grip(pc, -11, -6, LEATHER);
    pommel(pc, GOLD);
    rim(pc);
  },
  // Maza de piedra: bola de piedra con púas, anillo de cuero y mango largo
  stone_mace(pc) {
    haft(pc, -12, 4, WOOD);
    for (const [dx, dy] of [[0, -1], [0.71, -0.71], [1, 0], [0.71, 0.71], [0, 1], [-1, 0], [-0.71, -0.71]]) {
      const lit = dx + dy < -0.2;
      for (const r of [3.6, 4.4]) pc.set(Math.floor(10.5 + dx * r), Math.floor(5.5 + dy * r), r > 4 ? (lit ? STONE[5] : STONE[3]) : lit ? STONE[4] : STONE[2]);
    }
    pc.disc(10, 5, 3.1, (x, y) => {
      const L = ((9.5 - x) + (4.5 - y)) * 0.3;
      return L > 0.9 ? STONE[6] : L > 0.3 ? STONE[5] : L > -0.3 ? STONE[4] : L > -0.8 ? STONE[3] : STONE[2];
    });
    collar(pc, LEATHER, 3, 4);
    rim(pc);
  },
  // Lanza de hierro: asta larga, punta en hoja con nervio central y atadura roja
  iron_spear(pc) {
    haft(pc, -13, 5, WOOD);
    diag(pc, (a, c) => {
      if (a < 5 || a > 13) return null;
      const w = a <= 9 ? 1 + (a - 5) * 0.5 : 3 - (a - 9) * 0.75;
      if (c < -0.5 - w || c > -0.5 + w) return null;
      return c <= -2 ? IRON[5] : c === -1 ? IRON[6] : c === 0 ? IRON[4] : IRON[2];
    });
    collar(pc, IRON, 3, 4);
    diag(pc, (a, c) => (a === 2 && c >= -2 && c <= 1 ? RUBY[c < 0 ? 3 : 2] : null));
    rim(pc);
  },

  wood_bow(pc) {
    bowShape(pc, WOOD, LEATHER, DARKWOOD);
    rim(pc);
  },
  iron_bow(pc) {
    bowShape(pc, IRON, LEATHER, IRON);
    rim(pc);
  },
  gold_bow(pc) {
    bowShape(pc, GOLD, SAPPHIRE, GOLD);
    rim(pc);
    sparkle(pc, 7, 1, '#ffffff');
  },

  // Flecha: punta de hierro arriba a la derecha, plumas blancas con banda roja abajo a la izquierda
  wood_arrow(pc) {
    diag(pc, (a, c) => (c === 0 && a >= -11 && a <= 8 ? (a % 4 === 0 ? WOOD[3] : WOOD[4]) : null));
    diag(pc, (a, c) => {
      if (a < 8 || a > 12) return null;
      const w = (12 - a) * 0.6;
      if (Math.abs(c) > w) return null;
      return c < 0 ? IRON[6] : c === 0 ? IRON[4] : IRON[2];
    });
    diag(pc, (a, c) => {
      const k = Math.abs(c);
      if (k < 1 || k > 2 || a < -11 + k || a > -6 + k) return null;
      if (a <= -9 + k) return c < 0 ? RUBY[3] : RUBY[2];
      return c < 0 ? '#f6f2ea' : '#c8c2b8';
    });
    rim(pc);
  },
  // Bumerán: madera curva con el codo arriba a la izquierda y franjas rojas pintadas de través
  wood_boomerang(pc) {
    paint(pc, [
      '................',
      '................',
      '....4555........',
      '...45666554.....',
      '..4566544rR33...',
      '..4553...rR33221',
      '..454.......221.',
      '..453...........',
      '..443...........',
      '..rRr...........',
      '..RR3...........',
      '...332..........',
      '...332..........',
      '....21..........',
      '................',
      '................',
    ], { ...Object.fromEntries(WOOD.map((c, i) => [i, c])), r: RUBY[3], R: RUBY[2] });
    rim(pc);
  },
  // Cuchillo arrojadizo (kunai): hoja en punta, mango vendado y anilla
  throwing_knife(pc) {
    diag(pc, (a, c) => {
      if (a < -2 || a > 12) return null;
      const w = a <= 1 ? 1 + (a + 2) * 0.34 : 2 - (a - 1) * 0.19;
      if (Math.abs(c) > w) return null;
      return c < 0 ? (a > 6 ? IRON[6] : IRON[5]) : c === 0 ? IRON[4] : IRON[2];
    });
    grip(pc, -9, -3, ['#14141c', '#262632', '#3a3a4a', '#545468']);
    paint(pc, ['.4.', '5.3', '.2.'], { 2: IRON[2], 3: IRON[3], 4: IRON[4], 5: IRON[5] }, 1, 12); // anilla
    rim(pc);
  },

  armor_helmet(pc, v, asset) {
    const k = setKey(asset);
    paint(pc, HELMETS[k], armorPal(SETS[k]));
    rim(pc);
  },
  armor_chest(pc, v, asset) {
    const k = setKey(asset);
    const p = armorPal(SETS[k]);
    paint(pc, CHEST, p);
    paint(pc, CHEST_FX[k], p);
    rim(pc);
  },
  armor_legs(pc, v, asset) {
    const k = setKey(asset);
    const p = armorPal(SETS[k]);
    paint(pc, LEGS, p);
    paint(pc, LEGS_FX[k], p);
    rim(pc);
  },
};

export const CTX = {};
