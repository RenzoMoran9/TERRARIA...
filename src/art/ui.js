// Arte mejorado: ui. Reemplaza pintores de Placeholders.js con el mismo nombre (ver src/art/README.md).
// Interfaz estilo Terraria: casillas azules con bisel, marco dorado para la elegida, corazón con brillo,
// botones táctiles redondos con aro biselado e íconos en pixel art. Todo en una cuadrícula ×2 (como el resto
// del juego). Luz desde arriba a la izquierda: brillos más cálidos, sombras más frías y saturadas.
import { PixelCanvas } from '../systems/PixelArt.js';
import { PIXEL_PAINTERS, drawPotion } from '../systems/Placeholders.js';

// ---------------------------------------------------------------- paletas
// Azul de la interfaz (oscuro → claro)
const BLUE = { ink: 'rgba(8,10,34,0.92)', deep: '#1c2470', dark: '#2c3894', mid: '#4456c0', light: '#7286e4', hi: '#b4c4ff', shine: '#eef2ff' };
const BLUE_RAMP = [BLUE.deep, BLUE.dark, BLUE.mid, BLUE.light, BLUE.hi];
// Oro del marco elegido
const GOLD = { ink: '#3a2006', deep: '#8a4e0c', dark: '#c07e18', mid: '#eab030', light: '#ffd75a', hi: '#fff2b0' };
// Ícono blanco azulado (flechas, cuadrícula…)
const ICON = { ink: '#0c1236', shade: '#7c8ed6', mid: '#c4d0f6', light: '#eef3ff', hi: '#ffffff', drop: 'rgba(4,6,26,0.55)' };

// ---------------------------------------------------------------- ayudantes
/** Estampa un dibujo hecho con letras (cada letra → color de pal; '.' = vacío). */
function stamp(pc, x0, y0, rows, pal) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) pc.set(x0 + x, y0 + y, c);
    }
  });
}

/** Copia un ícono (PixelCanvas) sobre otro, con una sombra suave abajo a la derecha. */
function blit(dst, src, ox, oy, shadow = ICON.drop) {
  if (shadow) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.get(x, y)) dst.set(ox + x + 1, oy + y + 1, shadow);
  }
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) dst.set(ox + x, oy + y, c);
    }
  }
}

/** Ícono de un pintor de ítems (16×16 lógicos). */
function itemIcon(name, fallback) {
  const pc = new PixelCanvas(16, 16);
  const paint = PIXEL_PAINTERS[name];
  if (paint) paint(pc, 0, { width: 32, height: 32 });
  else fallback?.(pc);
  return pc;
}

/**
 * Placa redonda: contorno oscuro, aro biselado (luz arriba a la izquierda), fondo hundido translúcido con
 * un brillo en media luna. n = lado en píxeles lógicos; fill = alfa del fondo; rim = grosor del aro.
 */
function roundPlate(n, { fill = 0.5, rim = 2 } = {}) {
  const pc = new PixelCanvas(n, n);
  const c = n / 2;
  const R = c - 0.5;
  const inner = R - 1.15 - rim;
  const s = n * 0.14; // corrimiento del círculo que recorta la media luna
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) continue;
      const lit = (-dx - dy) / (Math.max(d, 0.001) * Math.SQRT2); // 1 arriba-izq, -1 abajo-der
      if (d > R - 1.15) {
        pc.set(x, y, BLUE.ink);
      } else if (d > inner) {
        // Aro: la fila de afuera más clara que la de adentro (se lee como un tubo redondeado)
        const outer = d > R - 1.15 - rim / 2;
        const i = Math.round(((lit + 1) / 2) * 3.2) + (outer ? 1 : 0);
        pc.set(x, y, outer && lit > 0.965 ? BLUE.shine : BLUE_RAMP[Math.max(0, Math.min(4, i))]); // destello arriba a la izq.
      } else if (d > inner - 1.2 && lit > 0.15) {
        pc.set(x, y, `rgba(6,8,30,${Math.min(0.9, fill + 0.25).toFixed(2)})`); // sombra interior bajo el aro
      } else {
        const gx = dx - s;
        const gy = dy - s;
        const gloss = d < inner - 1.5 && gx * gx + gy * gy > (inner - 1.5) * (inner - 1.5) && lit > 0.2;
        pc.set(x, y, gloss ? `rgba(150,172,255,${(fill * 0.42).toFixed(2)})` : `rgba(22,30,84,${fill})`);
      }
    }
  }
  return pc;
}

function drawRound(ctx, w, opts, decorate) {
  const n = w / 2;
  const pc = roundPlate(n, opts);
  decorate?.(pc, n);
  pc.draw(ctx, 0, 0, 2);
}

/** Ícono de ítem más grande (×3) en el centro del botón, con sombra (botón de acción principal). */
function bigIcon(ctx, w, icon) {
  const sh = new PixelCanvas(icon.w, icon.h);
  for (let y = 0; y < icon.h; y++) for (let x = 0; x < icon.w; x++) if (icon.get(x, y)) sh.set(x, y, ICON.drop);
  const o = Math.round(w / 2 - (icon.w * 3) / 2);
  sh.draw(ctx, o + 3, o + 3, 3);
  icon.draw(ctx, o, o, 3);
}

/** Centra un ícono en la placa (con sombra). */
function center(pc, n, icon, dy = 0) {
  blit(pc, icon, Math.round((n - icon.w) / 2), Math.round((n - icon.h) / 2) + dy);
}

// Flecha gruesa hacia arriba (salto): mitad izquierda iluminada, derecha en sombra
function arrowUp(w, headH, stemW, stemH) {
  const W = w + 2;
  const pc = new PixelCanvas(W, headH + stemH + 2);
  const cx = (W - 1) / 2;
  const col = (x, k, bottom) => {
    if (bottom) return ICON.shade;
    if (x < cx - 0.6) return k < 2 ? ICON.hi : ICON.light;
    if (x <= cx + 0.6) return ICON.mid;
    return ICON.shade;
  };
  for (let k = 0; k < headH; k++) {
    const half = Math.min((w - 1) / 2, k + 0.5);
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) pc.set(x, 1 + k, col(x, k, false));
  }
  for (let k = 0; k < stemH; k++) {
    for (let x = Math.ceil(cx - stemW / 2 + 0.5); x <= Math.floor(cx + stemW / 2 - 0.5); x++) pc.set(x, 1 + headH + k, col(x, headH + k, k === stemH - 1));
  }
  pc.outline(ICON.ink);
  return pc;
}

// Grieta: tramos [x0,y0,x1,y1] por etapa (se acumulan), que salen del golpe en el centro
const CRACK = [
  [[7, 7, 9, 5], [7, 7, 5, 8], [7, 7, 8, 10]],
  [[9, 5, 10, 2], [5, 8, 2, 7], [8, 10, 10, 12], [9, 5, 12, 6]],
  [[10, 2, 13, 1], [2, 7, 1, 4], [10, 12, 9, 14], [12, 6, 14, 8], [5, 8, 4, 12], [7, 7, 5, 4]],
  [[4, 12, 2, 14], [14, 8, 14, 11], [1, 4, 3, 1], [10, 12, 13, 13], [5, 4, 6, 1], [12, 6, 13, 3]],
];
// ---------------------------------------------------------------- pintores pixel art
export const PIXEL = {
  heart(pc) {
    // Corazón con contorno vino; brillo blanco arriba a la izquierda, sombra fría abajo a la derecha
    const pal = { o: '#3c0a1c', S: '#6c0a2e', D: '#ac1430', M: '#e6303e', L: '#ff6450', H: '#ffa688', W: '#fff6e8' };
    stamp(pc, 0, 1, [
      '.oooo..oooo.',
      'oLHHLooLLMMo',
      'oHWHLMLMMMDo',
      'oHHLMMMMMMDo',
      'oLLMMMMMMMDo',
      'oMMMMMMMMDDo',
      '.oMMMMMMDDo.',
      '..oMMMMDDo..',
      '...oMMDSo...',
      '....oDSo....',
      '.....oo.....',
    ], pal);
  },
  crack(pc) {
    // Grietas que crecen en 4 etapas desde el golpe: surco oscuro con el borde de abajo iluminado,
    // los tramos viejos más hondos y, al final, astillas que saltaron alrededor del centro
    const fresh = 'rgba(20,10,6,0.78)';
    const deep = 'rgba(0,0,0,0.88)';
    const lip = 'rgba(255,236,210,0.26)';
    const chip = 'rgba(0,0,0,0.2)';
    for (let f = 0; f < 4; f++) {
      const L = new PixelCanvas(16, 16);
      for (let s = 0; s <= f; s++) for (const [x0, y0, x1, y1] of CRACK[s]) L.line(x0, y0, x1, y1, s < f ? deep : fresh);
      if (f >= 1) L.rect(7, 7, 2, 2, deep); // el golpe se hunde
      if (f === 3) for (const [x, y] of [[6, 6], [9, 6], [6, 9]]) L.set(x, y, deep);
      const ox = f * 16;
      // Polvo/astillado alrededor de las grietas viejas (etapas 3 y 4)
      if (f >= 2) {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            if (L.get(x, y) || Math.abs(x - 7.5) + Math.abs(y - 7.5) > (f === 2 ? 4 : 7)) continue;
            if (L.get(x - 1, y) || L.get(x + 1, y) || L.get(x, y - 1) || L.get(x, y + 1)) pc.set(ox + x, y, chip);
          }
        }
      }
      // Borde iluminado: abajo de cada píxel de grieta (la pared que mira hacia la luz)
      for (let y = 0; y < 15; y++) for (let x = 0; x < 16; x++) if (L.get(x, y) && !L.get(x, y + 1)) pc.set(ox + x, y + 1, lip);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (L.get(x, y)) pc.set(ox + x, y, L.get(x, y));
    }
  },
  trash(pc) {
    // Tacho de metal con tapa, perilla y estrías (acero azulado)
    const ramp = ['#e4e8f0', '#b4bccc', '#b4bccc', '#868ea2', '#868ea2', '#868ea2', '#5c6478', '#5c6478', '#3a4256', '#3a4256'];
    // Cuerpo (se angosta un poco hacia abajo)
    for (let y = 7; y <= 14; y++) {
      const inset = y >= 13 ? 1 : 0;
      for (let x = 3 + inset; x <= 12 - inset; x++) {
        let c = ramp[x - 3];
        if (x === 5 || x === 8 || x === 11) c = x < 8 ? '#5c6478' : '#2c3244'; // estrías
        if (x === 6 || x === 9) c = x < 8 ? '#d0d6e2' : '#9aa2b4'; // borde claro de la estría
        if (y === 14) c = '#3a4256';
        pc.set(x, y, c);
      }
    }
    // Aro de arriba del cuerpo
    for (let x = 3; x <= 12; x++) pc.set(x, 7, x < 9 ? '#c8d0dc' : '#868ea2');
    // Tapa
    for (let x = 2; x <= 13; x++) pc.set(x, 4, x < 6 ? '#ffffff' : x < 10 ? '#d4dae4' : '#a0a8b8');
    for (let x = 2; x <= 13; x++) pc.set(x, 5, x < 9 ? '#868ea2' : '#5c6478');
    // Perilla
    pc.rect(6, 2, 4, 2, '#b4bccc');
    pc.set(6, 2, '#ffffff');
    pc.set(9, 3, '#5c6478');
    pc.outline('#141826');
    // Ranura oscura entre la tapa y el cuerpo
    for (let x = 3; x <= 12; x++) pc.set(x, 6, '#141826');
  },
  map_home(pc) {
    // Casita: techo de tejas rojas, paredes claras, ventana con luz y puerta de madera
    const pal = {
      R: '#7a1a14', r: '#b42a1e', m: '#e04a2c', h: '#ff8a5a', c: '#6a6a78', C: '#9a9aa8',
      W: '#a08060', w: '#d8c098', l: '#f4e4c0', k: '#4a2410', d: '#8a4a20', D: '#6a3416', Y: '#fff4b0', y: '#ffc848', g: '#ffd860',
    };
    stamp(pc, 0, 0, [
      '................',
      '..........Cc....',
      '.......hm.Cc....',
      '......hmmrCc....',
      '.....hmRrRr.....',
      '....hmmmrrrr....',
      '...hmRmRrRrRr...',
      '..hmmmmrrrrrrr..',
      '.RRRRRRRRRRRRRR.',
      '..lllllwwwwwwW..',
      '..lkkkkwwkkkkW..',
      '..lkYykwwkdDkW..',
      '..lkyykwwkdgkW..',
      '..lkkkkwwkdDkW..',
      '..WWWWWWWkdDkW..',
      '................',
    ], pal);
    pc.outline('#2a1008');
  },
  map_pin(pc) {
    // Marcador: cabeza roja redonda con brillo y aguja de metal
    const ramp = ['#ffb8a0', '#ff6a58', '#ec3a3a', '#c01e26', '#8a0e1a'];
    pc.disc(7.5, 6, 4.7, (x, y) => {
      const lx = x + 0.5 - 5.6;
      const ly = y + 0.5 - 4.2;
      return ramp[Math.min(4, Math.floor(Math.sqrt(lx * lx + ly * ly) / 1.9))];
    });
    pc.set(6, 3, '#ffffff');
    pc.set(5, 4, '#ffffff');
    pc.set(6, 4, '#ffe0d4');
    for (let y = 11; y <= 13; y++) {
      pc.set(7, y, '#e0e4ee');
      pc.set(8, y, '#8a92a6');
    }
    pc.set(7, 14, '#8a92a6');
    pc.outline('#2a0608');
  },
  map_boss(pc) {
    // Calavera con cuernos y ojos rojos que brillan (guarida de un jefe)
    const pal = { h: '#fffaf0', l: '#ece4d0', m: '#c8bca4', s: '#8a7c6c', e: '#2a0606', E: '#ff3a1a', g: '#ff9a40', n: '#3a2016', k: '#5a4c40', H: '#c85a2a', B: '#7a2414' };
    stamp(pc, 0, 0, [
      '................',
      '..H.........B...',
      '..HH.hllll.BB...',
      '...Hhhllllmm....',
      '...hhlllllllm...',
      '...hlllllllms...',
      '...leeelleees...',
      '...leEelleEes...',
      '...legelleges...',
      '...lmmmnnmmms...',
      '....mmmmmmms....',
      '.....lklkls.....',
      '.....smmmss.....',
      '................',
      '................',
      '................',
    ], pal);
    pc.outline('#1c1010');
  },
};

// ---------------------------------------------------------------- pintores directos (canvas)
/** Casilla (48×48 → 24×24 lógicos): contorno, bisel y fondo hundido. gold = casilla elegida. */
function slotArt(ctx, w, h, gold) {
  const n = w / 2;
  const m = h / 2;
  const pc = new PixelCanvas(n, m);
  const ink = gold ? 'rgba(46,24,4,0.96)' : 'rgba(8,11,36,0.92)';
  const fill = gold ? 'rgba(74,94,206,0.88)' : 'rgba(50,64,158,0.80)';
  const well = gold ? 'rgba(40,50,150,0.9)' : 'rgba(30,38,112,0.86)';
  const bounce = gold ? 'rgba(112,132,236,0.9)' : 'rgba(70,86,186,0.84)';
  const rimHi = gold ? [GOLD.hi, GOLD.light] : ['rgba(132,152,236,0.95)'];
  const rimLo = gold ? [GOLD.dark, GOLD.deep] : ['rgba(30,38,110,0.95)'];
  const rw = rimHi.length;
  for (let y = 0; y < m; y++) {
    for (let x = 0; x < n; x++) {
      if ((x === 0 || x === n - 1) && (y === 0 || y === m - 1)) continue; // esquinas recortadas
      const e = Math.min(x, y, n - 1 - x, m - 1 - y); // distancia al borde
      if (e === 0) pc.set(x, y, ink);
      else if (e <= rw) {
        // Bisel: arriba/izquierda claro, abajo/derecha oscuro
        const lit = (y === e && x < n - 1 - e) || (x === e && y < m - 1 - e);
        pc.set(x, y, (lit ? rimHi : rimLo)[e - 1]);
      } else if (e === rw + 1 && (y === e || x === e)) pc.set(x, y, well); // sombra interior arriba e izquierda
      else if (e === rw + 1) pc.set(x, y, bounce); // luz reflejada abajo y a la derecha
      else pc.set(x, y, fill);
    }
  }
  // Esquinas redondeadas por dentro del contorno
  for (const [x, y] of [[1, 1], [n - 2, 1], [1, m - 2], [n - 2, m - 2]]) pc.set(x, y, ink);
  // Destello en la esquina de arriba a la izquierda
  const k = rw + 1;
  pc.set(k, k, gold ? '#ffffff' : 'rgba(210,222,255,0.9)');
  pc.set(k + 1, k, gold ? GOLD.hi : 'rgba(170,186,255,0.55)');
  pc.set(k, k + 1, gold ? GOLD.hi : 'rgba(170,186,255,0.55)');
  if (gold) {
    // Brillo interior cálido a lo largo del marco
    for (let x = k + 2; x < n - k - 1; x++) pc.set(x, k, 'rgba(255,226,140,0.32)');
    for (let y = k + 2; y < m - k - 1; y++) pc.set(k, y, 'rgba(255,226,140,0.32)');
  }
  pc.draw(ctx, 0, 0, 2);
}

export const CTX = {
  slot(ctx, w, h) {
    slotArt(ctx, w, h, false);
  },
  slot_selected(ctx, w, h) {
    slotArt(ctx, w, h, true);
  },
  joystick_base(ctx, w) {
    drawRound(ctx, w, { fill: 0.34, rim: 3 }, (pc, n) => {
      const c = n / 2;
      // Pista interior (círculo tenue)
      for (let a = 0; a < 120; a++) {
        const t = (a / 120) * Math.PI * 2;
        pc.set(Math.floor(c + Math.cos(t) * n * 0.26), Math.floor(c + Math.sin(t) * n * 0.26), 'rgba(160,180,255,0.24)');
      }
      // Cuatro muescas de dirección (triángulos que apuntan hacia afuera)
      for (const [ux, uy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        for (let k = 0; k < 4; k++) {
          const along = n * 0.4 - 3 - k;
          for (let s = -k; s <= k; s++) {
            const x = Math.floor(c + ux * along - uy * s);
            const y = Math.floor(c + uy * along + ux * s);
            pc.set(x, y, k === 0 ? 'rgba(230,238,255,0.8)' : 'rgba(190,205,255,0.55)');
          }
        }
      }
    });
  },
  joystick_thumb(ctx, w) {
    // Perilla: domo biselado con un hueco cóncavo en el centro (donde apoya el pulgar)
    const n = w / 2;
    const pc = new PixelCanvas(n, n);
    const c = n / 2;
    const R = c - 0.5;
    const Rd = R * 0.56; // radio del hueco
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) continue;
        const lit = (-dx - dy) / (Math.max(d, 0.001) * Math.SQRT2);
        let col;
        if (d > R - 1.15) col = BLUE.ink;
        else if (d > Rd + 0.6) {
          // Domo: más claro arriba a la izquierda; el borde de abajo en sombra
          const lx = dx + R * 0.4;
          const ly = dy + R * 0.4;
          let i = 4 - Math.floor((Math.sqrt(lx * lx + ly * ly) / (R * 1.4)) * 4.4);
          if (d > R - 2.2 && lit < -0.2) i = Math.min(i, 1);
          col = BLUE_RAMP[Math.max(0, Math.min(4, i))];
        } else if (d > Rd - 0.6) col = lit > 0.2 ? BLUE.deep : lit < -0.2 ? BLUE.hi : BLUE.dark; // borde del hueco
        else col = lit > 0.35 && d > Rd - 2.2 ? BLUE.dark : BLUE.mid; // hueco: sombra arriba a la izquierda
        pc.set(x, y, col);
      }
    }
    // Brillo especular sobre el domo
    const sx = Math.floor(c - R * 0.62);
    const sy = Math.floor(c - R * 0.5);
    pc.set(sx, sy, '#ffffff');
    pc.set(sx + 1, sy - 1, '#ffffff');
    pc.set(sx + 2, sy - 2, BLUE.shine);
    pc.set(sx, sy + 1, BLUE.shine);
    ctx.globalAlpha = 0.92;
    pc.draw(ctx, 0, 0, 2);
    ctx.globalAlpha = 1;
  },
  button_jump(ctx, w) {
    drawRound(ctx, w, {}, (pc, n) => center(pc, n, arrowUp(21, 11, 9, 10), -1));
  },
  button_mine(ctx, w) {
    drawRound(ctx, w, {});
    bigIcon(ctx, w, itemIcon('stone_pickaxe'));
  },
  button_attack(ctx, w) {
    drawRound(ctx, w, {});
    bigIcon(ctx, w, itemIcon('wood_sword'));
  },
  button_place(ctx, w) {
    drawRound(ctx, w, {}, (pc, n) => {
      const o = new PixelCanvas(18, 18);
      blit(o, itemIcon('grass'), 1, 1, null);
      o.outline('#1a0e08');
      center(pc, n, o);
    });
  },
  button_dash(ctx, w) {
    // Embestida: dos cheurones celestes con estelas de velocidad
    drawRound(ctx, w, {}, (pc, n) => {
      const pal = { h: '#f0fcff', l: '#a8ecff', m: '#5ac8f4', s: '#2a86c8' };
      const icon = new PixelCanvas(22, 14);
      stamp(icon, 6, 1, [
        'hll...hll.....',
        '.hll...hll....',
        '..hll...hll...',
        '...hll...hll..',
        '....lmm...lmm.',
        '.....lmm...lmm',
        '.....smm...smm',
        '....ssm...ssm.',
        '...ssm...ssm..',
        '..ssm...ssm...',
        '.ssm...ssm....',
        'ssm...ssm.....',
      ], pal);
      icon.outline('#06223e');
      // Estelas (sin contorno)
      for (const [y, x0, l] of [[3, 2, 3], [6, 0, 4], [9, 1, 3]]) for (let k = 0; k < l; k++) icon.set(x0 + k, y + 1, k === l - 1 ? '#a8ecff' : 'rgba(150,225,255,0.55)');
      center(pc, n, icon);
    });
  },
  button_fire(ctx, w) {
    // Bola de fuego: llama en gota con núcleo blanco y chispas
    drawRound(ctx, w, {}, (pc, n) => {
      const ramp = ['#7a1408', '#c0300e', '#ec5a14', '#ff9a24', '#ffd650', '#fff6c8'];
      const f = new PixelCanvas(18, 22);
      const cx = 8.5;
      const cy = 14;
      const r = 6.6;
      for (let y = 0; y < 22; y++) {
        for (let x = 0; x < 18; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          let inside = dx * dx + dy * dy <= r * r;
          if (!inside && dy < 0) {
            // Punta de la llama (se curva un poco hacia la derecha)
            const k = -dy / 12;
            inside = k < 1 && Math.abs(dx - k * k * 3) <= r * (1 - k) ** 1.15;
          }
          if (!inside) continue;
          // Más caliente un poco abajo a la izquierda del centro
          const hx = dx + 1.2;
          const hy = dy - 1.0;
          const heat = 1 - Math.sqrt(hx * hx + hy * hy * 0.7) / (r * 1.25);
          f.set(x, y, ramp[Math.max(0, Math.min(5, Math.floor(heat * 6 + 0.6)))]);
        }
      }
      f.outline('#3a0804');
      center(pc, n, f, -1);
      const c = Math.round(n / 2);
      for (const [x, y, col] of [[-9, -3, '#ffd650'], [9, -6, '#ff9a24'], [8, 5, '#ffd650'], [-8, 6, '#ff9a24']]) pc.set(c + x, c + y, col);
    });
  },
  button_potion(ctx, w) {
    // Poción de curación (el mismo ícono que el ítem)
    drawRound(ctx, w, {}, (pc, n) => center(pc, n, itemIcon('potion_small', (p) => drawPotion(p, false))));
  },
  button_swap(ctx, w) {
    // Dos flechas opuestas (cambiar entre minar y colocar)
    drawRound(ctx, w, {}, (pc, n) => {
      const pal = { h: ICON.hi, l: ICON.light, m: ICON.mid, s: ICON.shade };
      const icon = new PixelCanvas(18, 16);
      stamp(icon, 0, 0, [
        '..................',
        '...........h......',
        '...........lh.....',
        '.hllllllllllmh....',
        '.mmmmmmmmmmmmms...',
        '.sssssssssssss....',
        '...........ss.....',
        '...........s......',
        '......h...........',
        '.....hl...........',
        '....hlllllllllllh.',
        '...hmmmmmmmmmmmmm.',
        '....ssssssssssss..',
        '.....ss...........',
        '......s...........',
        '..................',
      ], pal);
      icon.outline(ICON.ink);
      center(pc, n, icon);
    });
  },
  button_inventory(ctx, w) {
    // Cuadrícula de 3×3 casillas (la primera, dorada: la elegida)
    drawRound(ctx, w, {}, (pc, n) => {
      const o = new PixelCanvas(19, 19);
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const x = 1 + i * 6;
          const y = 1 + j * 6;
          const P = i === 0 && j === 0 ? { m: GOLD.mid, h: GOLD.hi, l: GOLD.light, s: GOLD.dark } : { m: ICON.mid, h: ICON.hi, l: ICON.light, s: ICON.shade };
          o.rect(x, y, 5, 5, P.m);
          o.rect(x, y, 5, 1, P.h);
          o.rect(x, y + 1, 1, 4, P.l);
          o.rect(x + 1, y + 4, 4, 1, P.s);
          o.rect(x + 4, y + 1, 1, 3, P.s);
        }
      }
      o.outline(ICON.ink);
      center(pc, n, o);
    });
  },
  button_fullscreen(ctx, w, h) {
    // Placa cuadrada biselada con cuatro esquinas que apuntan hacia afuera
    const n = w / 2;
    const m = h / 2;
    const pc = new PixelCanvas(n, m);
    for (let y = 0; y < m; y++) {
      for (let x = 0; x < n; x++) {
        if ((x === 0 || x === n - 1) && (y === 0 || y === m - 1)) continue;
        const e = Math.min(x, y, n - 1 - x, m - 1 - y);
        if (e === 0) pc.set(x, y, BLUE.ink);
        else if (e === 1) pc.set(x, y, (y === 1 && x < n - 2) || (x === 1 && y < m - 2) ? BLUE.light : BLUE.deep);
        else pc.set(x, y, 'rgba(22,30,84,0.5)');
      }
    }
    for (const [x, y] of [[1, 1], [n - 2, 1], [1, m - 2], [n - 2, m - 2]]) pc.set(x, y, BLUE.ink);
    const icon = new PixelCanvas(16, 16);
    const pal = { h: ICON.hi, l: ICON.light, s: ICON.shade };
    const corner = ['hhhll', 'hll..', 'hl...', 'l....', 'l....'];
    const flip = (rows, fx, fy) => (fy ? [...rows].reverse() : rows).map((r) => (fx ? [...r].reverse().join('') : r));
    stamp(icon, 1, 1, corner, pal);
    stamp(icon, 10, 1, flip(corner, true, false), pal);
    stamp(icon, 1, 10, flip(corner, false, true).map((r) => r.replace(/h/g, 'l')), pal);
    stamp(icon, 10, 10, flip(corner, true, true).map((r) => r.replace(/[hl]/g, 's')), pal);
    icon.outline(ICON.ink);
    center(pc, n, icon);
    pc.draw(ctx, 0, 0, 2);
  },
};
