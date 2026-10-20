import Phaser from 'phaser';

// Texturas de reemplazo generadas por código (rectángulos de colores).
// Se usan cuando la imagen correspondiente no existe en /public/assets.

// Pequeño generador pseudoaleatorio para que los "puntitos" sean siempre iguales
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Puntos de colores repartidos al azar (textura)
function speckle(ctx, w, h, colors, count, seed, size = 2) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    rect(ctx, colors[i % colors.length], Math.floor(r() * (w - size + 1)), Math.floor(r() * (h - size + 1)), size, size);
  }
}

// Borde claro arriba/izquierda y oscuro abajo/derecha (relieve suave)
function bevel(ctx, w, h) {
  rect(ctx, 'rgba(255,255,255,0.10)', 0, 0, w, 2);
  rect(ctx, 'rgba(255,255,255,0.06)', 0, 0, 2, h);
  rect(ctx, 'rgba(0,0,0,0.18)', 0, h - 2, w, 2);
  rect(ctx, 'rgba(0,0,0,0.12)', w - 2, 0, 2, h);
}

function circle(ctx, cx, cy, r, fill, stroke, lineWidth = 3) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

// Botón circular semitransparente (base para los controles táctiles)
function roundButton(ctx, w, h) {
  circle(ctx, w / 2, h / 2, w / 2 - 3, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.55)', 3);
}

// Pico: mango diagonal + cabeza curvada
function pickaxe(ctx, head, headLight) {
  for (let i = 0; i < 9; i++) rect(ctx, '#8a5a2b', 5 + i * 2, 25 - i * 2, 3, 3);
  const cells = [
    [9, 6], [12, 4], [15, 3], [18, 3], [21, 4], [23, 6], [25, 9], [26, 12], [27, 15],
  ];
  for (const [x, y] of cells) rect(ctx, head, x, y, 4, 4);
  rect(ctx, headLight, 14, 3, 6, 2);
  rect(ctx, headLight, 24, 8, 2, 4);
}

const PAINTERS = {
  // ---------- Bloques ----------
  dirt(ctx, w, h) {
    rect(ctx, '#8b5a2b', 0, 0, w, h);
    speckle(ctx, w, h, ['#6f4520', '#a06a36', '#7a4c24'], 18, 11, 3);
    bevel(ctx, w, h);
  },
  grass(ctx, w, h) {
    PAINTERS.dirt(ctx, w, h);
    rect(ctx, '#4caf50', 0, 0, w, 7);
    const r = rng(5);
    for (let x = 0; x < w; x += 4) rect(ctx, '#4caf50', x, 7, 4, Math.floor(r() * 5));
    rect(ctx, '#7ed957', 0, 0, w, 2);
  },
  stone(ctx, w, h) {
    rect(ctx, '#7a7a7a', 0, 0, w, h);
    speckle(ctx, w, h, ['#666666', '#8c8c8c', '#707070'], 16, 21, 3);
    rect(ctx, '#5e5e5e', 6, 9, 7, 1);
    rect(ctx, '#5e5e5e', 18, 22, 8, 1);
    bevel(ctx, w, h);
  },
  coal_ore(ctx, w, h) {
    PAINTERS.stone(ctx, w, h);
    for (const [x, y] of [[5, 5], [18, 8], [9, 18], [21, 21]]) {
      rect(ctx, '#1c1c1c', x, y, 6, 5);
      rect(ctx, '#3d3d3d', x + 1, y + 1, 2, 2);
    }
  },
  iron_ore(ctx, w, h) {
    PAINTERS.stone(ctx, w, h);
    for (const [x, y] of [[6, 6], [19, 7], [8, 19], [20, 20]]) {
      rect(ctx, '#c98d5a', x, y, 6, 5);
      rect(ctx, '#ecc096', x + 1, y + 1, 2, 2);
    }
  },
  log(ctx, w, h) {
    rect(ctx, '#6b4423', 0, 0, w, h);
    for (const x of [4, 12, 20, 27]) {
      rect(ctx, '#55351a', x, 0, 2, h);
      rect(ctx, '#835631', x + 2, 0, 1, h);
    }
  },
  leaves(ctx, w, h) {
    rect(ctx, '#2e7d32', 0, 0, w, h);
    speckle(ctx, w, h, ['#1b5e20', '#43a047', '#388e3c'], 24, 31, 4);
  },
  planks(ctx, w, h) {
    rect(ctx, '#b5823f', 0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      rect(ctx, '#8a5e2a', 0, y + 7, w, 1);
      rect(ctx, '#c99552', 0, y, w, 1);
      const seam = (y / 8) % 2 === 0 ? 10 : 22;
      rect(ctx, '#8a5e2a', seam, y, 1, 8);
    }
  },
  workbench(ctx, w, h) {
    rect(ctx, '#a0692f', 0, 10, w, 6);
    rect(ctx, '#c48a4a', 0, 10, w, 2);
    rect(ctx, '#7a4f22', 3, 16, 5, 16);
    rect(ctx, '#7a4f22', w - 8, 16, 5, 16);
    rect(ctx, '#8a5a28', 3, 24, w - 6, 3);
  },
  torch(ctx) {
    rect(ctx, '#7a4f26', 14, 13, 4, 17);
    rect(ctx, '#ff9800', 12, 5, 8, 9);
    rect(ctx, '#ffeb3b', 14, 7, 4, 6);
  },
  bedrock(ctx, w, h) {
    rect(ctx, '#262626', 0, 0, w, h);
    speckle(ctx, w, h, ['#3b3b3b', '#141414'], 20, 41, 4);
  },
  wall_dirt(ctx, w, h) {
    rect(ctx, '#4a3020', 0, 0, w, h);
    speckle(ctx, w, h, ['#3d271a', '#553826'], 14, 51, 4);
  },
  wall_stone(ctx, w, h) {
    rect(ctx, '#3e3e46', 0, 0, w, h);
    speckle(ctx, w, h, ['#34343b', '#48484f'], 14, 61, 4);
  },

  // ---------- Ítems ----------
  wood(ctx) {
    rect(ctx, '#7a4f26', 4, 11, 22, 10);
    rect(ctx, '#5e3a1a', 4, 15, 22, 2);
    rect(ctx, '#c99a5e', 24, 11, 5, 10);
    rect(ctx, '#a87a44', 25, 14, 3, 4);
  },
  coal(ctx) {
    rect(ctx, '#1e1e1e', 6, 13, 11, 9);
    rect(ctx, '#1e1e1e', 15, 9, 11, 11);
    rect(ctx, '#1e1e1e', 10, 18, 13, 8);
    rect(ctx, '#474747', 17, 11, 3, 3);
    rect(ctx, '#474747', 8, 15, 2, 2);
  },
  wood_pickaxe(ctx) {
    pickaxe(ctx, '#b5823f', '#d6a35f');
  },
  stone_pickaxe(ctx) {
    pickaxe(ctx, '#8c8c8c', '#b8b8b8');
  },

  // ---------- Jugador (mira a la derecha) ----------
  player(ctx, w, h) {
    const sx = w / 24;
    const sy = h / 44;
    ctx.save();
    ctx.scale(sx, sy);
    rect(ctx, '#f1c27d', 6, 2, 12, 12); // cabeza
    rect(ctx, '#4a2c12', 5, 0, 14, 4); // pelo
    rect(ctx, '#4a2c12', 5, 0, 3, 8);
    rect(ctx, '#222222', 14, 7, 2, 2); // ojo
    rect(ctx, '#3a7bd5', 4, 14, 16, 16); // camisa
    rect(ctx, '#2f63ad', 4, 14, 3, 13); // manga
    rect(ctx, '#f1c27d', 4, 27, 3, 3); // mano
    rect(ctx, '#3b3b5c', 5, 30, 14, 10); // pantalón
    rect(ctx, '#2b1d0e', 4, 40, 7, 4); // zapatos
    rect(ctx, '#2b1d0e', 13, 40, 7, 4);
    ctx.restore();
  },

  // ---------- Interfaz ----------
  slot(ctx, w, h) {
    rect(ctx, 'rgba(20,20,35,0.78)', 0, 0, w, h);
    ctx.strokeStyle = '#8a8ab8';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  },
  slot_selected(ctx, w, h) {
    rect(ctx, 'rgba(80,68,20,0.88)', 0, 0, w, h);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  },
  heart(ctx, w, h) {
    const s = w / 12;
    const rows = ['.XX..XX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'X') rect(ctx, '#e53935', (x + 2) * s, (y + 3) * s, s, s);
      }
    });
    rect(ctx, '#ff8a80', 3 * s, 4 * s, s, s);
  },
  crack(ctx) {
    const c = 'rgba(0,0,0,0.75)';
    const path = [[15, 2], [14, 7], [17, 11], [13, 16], [16, 21], [12, 26], [14, 30]];
    for (const [x, y] of path) rect(ctx, c, x, y, 3, 5);
    for (const [x, y] of [[5, 9], [9, 12], [20, 14], [24, 17], [6, 24], [22, 25]]) rect(ctx, c, x, y, 4, 2);
  },
  joystick_base(ctx, w, h) {
    circle(ctx, w / 2, h / 2, w / 2 - 3, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.45)', 4);
    circle(ctx, w / 2, h / 2, w / 4, null, 'rgba(255,255,255,0.15)', 2);
  },
  joystick_thumb(ctx, w, h) {
    circle(ctx, w / 2, h / 2, w / 2 - 2, 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.85)', 3);
  },
  button_jump(ctx, w, h) {
    roundButton(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.28);
    ctx.lineTo(w * 0.72, h * 0.56);
    ctx.lineTo(w * 0.28, h * 0.56);
    ctx.closePath();
    ctx.fill();
    rect(ctx, 'rgba(255,255,255,0.9)', w * 0.42, h * 0.55, w * 0.16, h * 0.18);
  },
  button_mine(ctx, w, h) {
    roundButton(ctx, w, h);
    ctx.save();
    ctx.translate(w / 2 - 16, h / 2 - 16);
    pickaxe(ctx, '#d0d0d0', '#ffffff');
    ctx.restore();
  },
  button_place(ctx, w, h) {
    roundButton(ctx, w, h);
    const s = w * 0.36;
    rect(ctx, '#8b5a2b', w / 2 - s / 2, h / 2 - s / 2, s, s);
    rect(ctx, '#4caf50', w / 2 - s / 2, h / 2 - s / 2, s, s * 0.25);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - s / 2, h / 2 - s / 2, s, s);
  },
  button_inventory(ctx, w, h) {
    roundButton(ctx, w, h);
    const c = w * 0.11;
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) rect(ctx, 'rgba(255,255,255,0.9)', w * 0.3 + x * c * 1.3, h * 0.3 + y * c * 1.3, c, c);
    }
  },
  button_fullscreen(ctx, w, h) {
    rect(ctx, 'rgba(0,0,0,0.35)', 0, 0, w, h);
    const a = w * 0.22;
    const t = 3;
    const m = w * 0.2;
    const col = 'rgba(255,255,255,0.9)';
    rect(ctx, col, m, m, a, t);
    rect(ctx, col, m, m, t, a);
    rect(ctx, col, w - m - a, m, a, t);
    rect(ctx, col, w - m - t, m, t, a);
    rect(ctx, col, m, h - m - t, a, t);
    rect(ctx, col, m, h - m - a, t, a);
    rect(ctx, col, w - m - a, h - m - t, a, t);
    rect(ctx, col, w - m - t, h - m - a, t, a);
  },

  // Por si falta un dibujo: cuadro magenta bien visible
  missing(ctx, w, h) {
    rect(ctx, '#ff00ff', 0, 0, w, h);
    rect(ctx, '#000000', 0, 0, w / 2, h / 2);
    rect(ctx, '#000000', w / 2, h / 2, w / 2, h / 2);
  },
};

/** Crea en el TextureManager una textura placeholder con la clave indicada. */
export function createPlaceholderTexture(scene, key, asset) {
  const texture = scene.textures.createCanvas(key, asset.width, asset.height);
  const painter = PAINTERS[asset.placeholder] || PAINTERS.missing;
  painter(texture.context, asset.width, asset.height);
  texture.refresh();
  return texture;
}

/** Los botones/círculos de la interfaz se ven mejor con filtrado suave. */
export function applyTextureFilter(scene, key, asset) {
  if (asset.smooth && scene.textures.exists(key)) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
