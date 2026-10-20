// Ayudantes para dibujar pixel art por código.
// Se dibuja en una cuadrícula "lógica" (p. ej. 16×16 por bloque) y luego se escala ×2,
// igual que Terraria (arte de 16 px mostrado a 32 px).

/** Hash entero → [0, 1). Determinista: la misma entrada siempre da el mismo valor. */
export function hash(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Elige un color de una paleta (de oscuro a claro) según un valor 0..1. */
export function pick(palette, t) {
  return palette[Math.min(palette.length - 1, Math.max(0, Math.floor(t * palette.length)))];
}

export class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = color;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
  }

  /** Círculo relleno (color puede ser una función (x, y, distanciaNormalizada) → color). */
  disc(cx, cy, r, color) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) this.set(x, y, typeof color === 'function' ? color(x, y, Math.sqrt(d2) / r) : color);
      }
    }
  }

  /** Línea de píxeles (Bresenham). */
  line(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Contorno exterior: los píxeles vacíos que tocan uno pintado toman este color. */
  outline(color) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], color);
  }

  /** Dibuja en un contexto 2D escalado (agrupa píxeles iguales seguidos para ir rápido). */
  draw(ctx, dx = 0, dy = 0, scale = 2) {
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.px[y * this.w + x];
        let run = 1;
        while (x + run < this.w && this.px[y * this.w + x + run] === c) run++;
        if (c) {
          ctx.fillStyle = c;
          ctx.fillRect(dx + x * scale, dy + y * scale, run * scale, scale);
        }
        x += run;
      }
    }
  }
}
