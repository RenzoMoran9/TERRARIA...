import { WORLD_WIDTH, WORLD_HEIGHT, SAVE_KEY } from '../config.js';
import { BLOCK_DEFS, WALL_DEFS, IS_PLANT, BLOCK } from '../world/blocks.js';
import { UNDERWORLD_TOP } from '../world/WorldGenerator.js';

export const MAP_TEXTURE = 'worldmap';
const MAP_KEY = `${SAVE_KEY}_map`;
const REVEAL_RADIUS = 20; // bloques que se descubren alrededor del jugador
const SURFACE_REVEAL = 34; // en la superficie se ve más lejos: columnas a cada lado, del cielo hasta un poco bajo el suelo
const REVEAL_EVERY = 0.25; // segundos
const MAX_PINS = 8;

// Fondo del mapa donde no hay bloque ni pared: cielo, cueva o inframundo
const SKY = 0x84c8ee;
const CAVE = 0x3a2a20;
const HELL = 0x4a1612;

/** Color de 0xRRGGBB a un píxel de ImageData (little-endian: 0xAABBGGRR), opaco. */
const px = (c, k = 1) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
};

/**
 * Mapa del mundo (como en Terraria): empieza tapado y se va descubriendo alrededor del
 * jugador. Se dibuja en una textura de 1 píxel por bloque que usan el minimapa y el mapa
 * completo. Lo descubierto se guarda como imagen (aparte de la partida) y se mantiene al
 * día cuando cambia un bloque ya visto. También guarda los marcadores del jugador.
 */
export class WorldMap {
  constructor(scene, world, pins = []) {
    this.scene = scene;
    this.world = world;
    this.gen = world.generator;
    this.explored = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    this.exploredCount = 0;
    this.pins = Array.isArray(pins) ? pins.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).slice(0, MAX_PINS) : [];
    this.timer = 0;
    this.dirty = null; // rectángulo a subir a la textura: { x0, y0, x1, y1 }

    if (scene.textures.exists(MAP_TEXTURE)) scene.textures.remove(MAP_TEXTURE);
    this.tex = scene.textures.createCanvas(MAP_TEXTURE, WORLD_WIDTH, WORLD_HEIGHT);
    this.ctx = this.tex.getContext();
    this.image = this.ctx.createImageData(WORLD_WIDTH, WORLD_HEIGHT);
    this.pixels = new Uint32Array(this.image.data.buffer);

    // Colores de cada bloque y pared (un poco más vivos que las partículas, para que se lean)
    this.blockColor = new Uint32Array(256);
    for (const d of BLOCK_DEFS) if (d) this.blockColor[d.id] = px(d.color ?? 0x808080, 1.1);
    this.blockColor[BLOCK.GRASS] = px(0x5cc85a);
    this.blockColor[BLOCK.TORCH] = px(0xffd24a);
    this.wallColor = WALL_DEFS.map((w) => (w ? px(w.color, 0.85) : 0));
    this.skyPx = px(SKY);
    this.cavePx = px(CAVE);
    this.hellPx = px(HELL);

    this._onTile = (tx, ty) => {
      const i = ty * WORLD_WIDTH + tx;
      if (!this.explored[i]) return;
      this.pixels[i] = this._color(tx, ty);
      this._markDirty(tx, ty, tx, ty);
    };
    world.on('tileChanged', this._onTile);
    world.on('wallChanged', this._onTile);
  }

  _color(tx, ty) {
    const w = this.world;
    const id = w.getTile(tx, ty);
    if (id !== BLOCK.AIR && !IS_PLANT[id]) return this.blockColor[id];
    const wall = w.getWall(tx, ty);
    if (wall) return this.wallColor[wall] || this.cavePx;
    if (ty >= UNDERWORLD_TOP) return this.hellPx;
    return ty < this.gen.surface[tx] + 2 ? this.skyPx : this.cavePx;
  }

  _markDirty(x0, y0, x1, y1) {
    const d = this.dirty;
    if (!d) this.dirty = { x0, y0, x1, y1 };
    else {
      d.x0 = Math.min(d.x0, x0);
      d.y0 = Math.min(d.y0, y0);
      d.x1 = Math.max(d.x1, x1);
      d.y1 = Math.max(d.y1, y1);
    }
  }

  /** Descubre (y actualiza) los bloques en un círculo alrededor de (cx, cy). */
  reveal(cx, cy, r = REVEAL_RADIUS) {
    const x0 = Math.max(0, cx - r);
    const x1 = Math.min(WORLD_WIDTH - 1, cx + r);
    const y0 = Math.max(0, cy - r);
    const y1 = Math.min(WORLD_HEIGHT - 1, cy + r);
    const r2 = r * r;
    let found = false;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * WORLD_WIDTH + x;
        if (this.explored[i] || (x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        this.explored[i] = 1;
        this.exploredCount++;
        this.pixels[i] = this._color(x, y);
        found = true;
      }
    }
    if (found) this._markDirty(x0, y0, x1, y1);
  }

  /** Descubre columnas enteras desde el cielo hasta unos bloques bajo la superficie. */
  revealSurface(cx, half = SURFACE_REVEAL) {
    const x0 = Math.max(0, cx - half);
    const x1 = Math.min(WORLD_WIDTH - 1, cx + half);
    let yMax = -1;
    for (let x = x0; x <= x1; x++) {
      const bottom = Math.min(WORLD_HEIGHT - 1, this.gen.surface[x] + 6);
      if (this.explored[bottom * WORLD_WIDTH + x]) continue; // esta columna ya se vio
      for (let y = 0; y <= bottom; y++) {
        const i = y * WORLD_WIDTH + x;
        if (this.explored[i]) continue;
        this.explored[i] = 1;
        this.exploredCount++;
        this.pixels[i] = this._color(x, y);
        yMax = Math.max(yMax, y);
      }
    }
    if (yMax >= 0) this._markDirty(x0, 0, x1, yMax);
  }

  isExplored(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return false;
    return this.explored[ty * WORLD_WIDTH + tx] === 1;
  }

  update(dt, player) {
    this.timer -= dt;
    if (this.timer <= 0 && !player.dead) {
      this.timer = REVEAL_EVERY;
      const tx = Math.floor(player.centerX / 32);
      const ty = Math.floor(player.centerY / 32);
      this.reveal(tx, ty);
      if (ty < this.gen.surface[Math.max(0, Math.min(WORLD_WIDTH - 1, tx))] + 8) this.revealSurface(tx);
    }
    this.flush();
  }

  /** Sube a la textura lo que cambió (como mucho unas 4 veces por segundo). */
  flush(force = false) {
    const d = this.dirty;
    if (!d) return;
    this.flushTimer = (this.flushTimer ?? 0) - 1;
    if (!force && this.flushTimer > 0) return;
    this.flushTimer = 15;
    this.dirty = null;
    this.ctx.putImageData(this.image, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1);
    this.tex.refresh();
  }

  // ------------------------------------------------------------ marcadores

  /** Pone un marcador en (tx, ty), o lo quita si ya hay uno cerca. Devuelve 'added' | 'removed' | 'full'. */
  togglePin(tx, ty, near = 4) {
    const i = this.pins.findIndex((p) => Math.abs(p.x - tx) <= near && Math.abs(p.y - ty) <= near);
    if (i >= 0) {
      this.pins.splice(i, 1);
      return 'removed';
    }
    if (this.pins.length >= MAX_PINS) return 'full';
    this.pins.push({ x: tx, y: ty });
    return 'added';
  }

  // ------------------------------------------------------------ guardado

  /** Guarda lo descubierto como imagen PNG (en otra clave, para no agrandar la partida). */
  save() {
    if (!this.exploredCount) return;
    try {
      localStorage.setItem(MAP_KEY, JSON.stringify({ seed: this.world.seed, png: this.tex.getCanvas().toDataURL('image/png') }));
    } catch (e) {
      console.warn('[mapa] No se pudo guardar el mapa:', e);
    }
  }

  /** Recupera lo descubierto (lo que tiene color en la imagen guardada). */
  load() {
    let url = null;
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_KEY) || 'null');
      if (saved && saved.seed === this.world.seed) url = saved.png; // el mapa de otro mundo no sirve
    } catch (e) {
      return;
    }
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      if (!this.tex || !this.tex.source) return; // la escena ya terminó
      const c = document.createElement('canvas');
      c.width = WORLD_WIDTH;
      c.height = WORLD_HEIGHT;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const saved = new Uint32Array(cx.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT).data.buffer);
      for (let i = 0; i < saved.length; i++) {
        if (saved[i] >>> 24 === 0 || this.explored[i]) continue;
        this.explored[i] = 1;
        this.exploredCount++;
        this.pixels[i] = saved[i];
      }
      this._markDirty(0, 0, WORLD_WIDTH - 1, WORLD_HEIGHT - 1);
      this.flush(true);
    };
    img.src = url;
  }

  static clearSaved() {
    try {
      localStorage.removeItem(MAP_KEY);
    } catch (e) {
      // localStorage no disponible
    }
  }

  destroy() {
    this.world.off('tileChanged', this._onTile);
    this.world.off('wallChanged', this._onTile);
  }
}
