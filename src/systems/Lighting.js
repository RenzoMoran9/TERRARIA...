import Phaser from 'phaser';
import { TILE_SIZE, WORLD_WIDTH, DEPTH } from '../config.js';
import { IS_SOLID, LIGHT_EMIT } from '../world/blocks.js';
import { getViewRect } from './view.js';

const MARGIN = 12; // tiles extra fuera de pantalla (para que la luz de antorchas cercanas entre bien)
const AIR_DECAY = 0.085; // cuánta luz se pierde por cada tile de aire
const SOLID_DECAY = 0.2; // ...y por cada bloque sólido
const PLAYER_LIGHT = 0.42; // luz tenue alrededor del jugador para no quedar a ciegas
const TORCH_COLOR = [1.0, 0.8, 0.55]; // luz cálida de las antorchas
const REFRESH_SECONDS = 0.2; // recálculo periódico (para el cambio gradual del día)

/**
 * Iluminación de color por tiles, barata para celulares:
 * - Dos canales de luz: cielo (según la hora) y bloques (antorchas + jugador).
 * - Se calcula 1 valor por tile solo en la zona visible (+ margen) y se propaga con
 *   barridos en ambas direcciones (pocas operaciones por tile).
 * - El resultado (color de luz) se dibuja en un canvas diminuto, 1 px por tile, que se
 *   estira ×32 con filtrado lineal y se MULTIPLICA sobre la escena:
 *   blanco = sin cambio, negro = oscuridad total, naranja = luz de antorcha.
 */
export class Lighting {
  constructor(scene, world, dayNight, player) {
    this.scene = scene;
    this.world = world;
    this.dayNight = dayNight;
    this.player = player;
    this.key = 'lightmap';
    this.w = 0;
    this.h = 0;
    this.tx0 = NaN;
    this.ty0 = NaN;
    this.lastPtx = NaN;
    this.lastPty = NaN;
    this.lastHeld = 0;
    this.timer = 0;
    this.dirty = true;
    this.lastMs = 0;
    this.texture = null;
    this.image = null;
    this._view = { x: 0, y: 0, width: 0, height: 0 };
    this._onTileChanged = () => {
      this.dirty = true;
    };
    world.on('tileChanged', this._onTileChanged);
  }

  _ensureSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sky = new Float32Array(w * h);
    this.block = new Float32Array(w * h);
    this.decay = new Float32Array(w * h);
    if (!this.texture) {
      if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
      this.texture = this.scene.textures.createCanvas(this.key, w, h);
      this.image = this.scene.add
        .image(0, 0, this.key)
        .setOrigin(0)
        .setDepth(DEPTH.LIGHT)
        .setScale(TILE_SIZE)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    } else {
      this.texture.setSize(w, h);
      this.image.setTexture(this.key).setScale(TILE_SIZE);
    }
    this.imageData = this.texture.context.createImageData(w, h);
    // Alfa siempre opaco: el color de cada píxel multiplica la escena
    const px = this.imageData.data;
    for (let i = 3; i < px.length; i += 4) px[i] = 255;
    this.dirty = true;
  }

  update(dt, camera) {
    const T = TILE_SIZE;
    const v = getViewRect(camera, this._view);
    const tx0 = Math.floor(v.x / T) - MARGIN;
    const ty0 = Math.floor(v.y / T) - MARGIN;
    this._ensureSize(Math.ceil(v.width / T) + MARGIN * 2 + 2, Math.ceil(v.height / T) + MARGIN * 2 + 2);

    const p = this.player;
    const ptx = Math.floor(p.centerX / T);
    const pty = Math.floor(p.centerY / T);
    // Agarró o soltó una antorcha: recalcular ya
    if (p.heldLight !== this.lastHeld) {
      this.lastHeld = p.heldLight;
      this.dirty = true;
    }
    this.timer -= dt;
    // Solo se recalcula si algo cambió (cámara, bloques, jugador) o cada REFRESH_SECONDS
    if (!this.dirty && this.timer > 0 && tx0 === this.tx0 && ty0 === this.ty0 && ptx === this.lastPtx && pty === this.lastPty) {
      return;
    }
    this.tx0 = tx0;
    this.ty0 = ty0;
    this.lastPtx = ptx;
    this.lastPty = pty;
    this.dirty = false;
    this.timer = REFRESH_SECONDS;

    const start = performance.now();
    this._compute(tx0, ty0, ptx, pty);
    this.image.setPosition(tx0 * T, ty0 * T);
    this.lastMs = performance.now() - start;
  }

  _compute(tx0, ty0, ptx, pty) {
    const { w, h, sky: S, block: B, decay: D, world } = this;
    const skyTop = world.skyTop;

    // 1) Fuentes de luz y atenuación de cada tile
    for (let j = 0; j < h; j++) {
      const ty = ty0 + j;
      let idx = j * w;
      for (let i = 0; i < w; i++, idx++) {
        const tx = tx0 + i;
        const id = world.getTile(tx, ty);
        S[idx] = tx >= 0 && tx < WORLD_WIDTH && ty < skyTop[tx] ? 1 : 0;
        B[idx] = LIGHT_EMIT[id];
        D[idx] = IS_SOLID[id] ? SOLID_DECAY : AIR_DECAY;
      }
    }

    // 2) Luz del jugador (cabeza y cuerpo); más fuerte si lleva una antorcha en la mano
    if (this.player.visible) {
      const light = Math.max(PLAYER_LIGHT, this.player.heldLight || 0);
      this._addSource(ptx - tx0, pty - ty0, light);
      this._addSource(ptx - tx0, pty - 1 - ty0, light);
    }

    // 3) Propagación de los dos canales
    this._propagate(S);
    this._propagate(B);

    // 4) Color final = cielo × color del sol/luna + bloques × color de antorcha
    const day = this.dayNight.getDaylight();
    const [lr, lg, lb] = this.dayNight.getLightColor();
    const sr = lr * day * 255;
    const sg = lg * day * 255;
    const sb = lb * day * 255;
    const br = TORCH_COLOR[0] * 255;
    const bg = TORCH_COLOR[1] * 255;
    const bb = TORCH_COLOR[2] * 255;
    const px = this.imageData.data;
    for (let k = 0, p = 0; k < S.length; k++, p += 4) {
      const s = S[k] > 0 ? S[k] : 0;
      const b = B[k] > 0 ? B[k] : 0;
      px[p] = s * sr + b * br; // Uint8ClampedArray recorta a 255
      px[p + 1] = s * sg + b * bg;
      px[p + 2] = s * sb + b * bb;
    }
    this.texture.context.putImageData(this.imageData, 0, 0);
    this.texture.refresh();
    // refresh() vuelve a subir la textura con filtro NEAREST (por pixelArt): restaurar el suavizado
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  /** Barrido ↘ y ↖, dos veces (cubre cuevas con curvas). */
  _propagate(L) {
    const { w, h, decay: D } = this;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < h; j++) {
        let idx = j * w;
        for (let i = 0; i < w; i++, idx++) {
          let l = L[idx];
          const d = D[idx];
          if (i > 0) {
            const v = L[idx - 1] - d;
            if (v > l) l = v;
          }
          if (j > 0) {
            const v = L[idx - w] - d;
            if (v > l) l = v;
          }
          L[idx] = l;
        }
      }
      for (let j = h - 1; j >= 0; j--) {
        let idx = j * w + w - 1;
        for (let i = w - 1; i >= 0; i--, idx--) {
          let l = L[idx];
          const d = D[idx];
          if (i < w - 1) {
            const v = L[idx + 1] - d;
            if (v > l) l = v;
          }
          if (j < h - 1) {
            const v = L[idx + w] - d;
            if (v > l) l = v;
          }
          L[idx] = l;
        }
      }
    }
  }

  _addSource(i, j, value) {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    const idx = j * this.w + i;
    if (this.block[idx] < value) this.block[idx] = value;
  }

  destroy() {
    this.world.off('tileChanged', this._onTileChanged);
    if (this.image) this.image.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
    this.texture = null;
    this.image = null;
  }
}
