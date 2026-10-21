import { TILE_SIZE, DEPTH } from '../config.js';

const T = TILE_SIZE;
const TEX = 'fx_mist';

/**
 * Neblina que cuelga debajo de las islas flotantes: nubes suaves que se mecen despacio
 * y respiran (se aclaran y oscurecen). Quedan detrás del jugador y debajo de la luz,
 * así que de noche también se oscurecen.
 */
export class IslandMist {
  constructor(scene, generator) {
    this.scene = scene;
    this.time = 0;
    this.puffs = [];
    if (!scene.textures.exists(TEX)) this._makeTexture();
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const is of generator.islands || []) {
      const bottom = (is.top + is.thick + 1) * T;
      const width = (is.x1 - is.x0 + 1) * T;
      const n = Math.round(width / 40) + 8;
      for (let i = 0; i < n; i++) {
        // Más espesa pegada a la isla y más rala hacia abajo; más angosta hacia abajo (como la isla)
        const down = Math.pow(rnd(), 1.6);
        const spread = 0.5 * width * (1 - down * 0.55);
        const x = is.cx * T + T / 2 + (rnd() * 2 - 1) * spread;
        const y = bottom - T * 1.2 + down * T * 11;
        const scale = (1.4 + rnd() * 1.3) * (1 - down * 0.35);
        const img = scene.add.image(x, y, TEX).setDepth(DEPTH.BLOCKS + 0.5).setScale(scale * 1.6, scale);
        this.puffs.push({
          img,
          x,
          y,
          base: 0.95 - down * 0.5,
          amp: 10 + rnd() * 18,
          speed: 0.12 + rnd() * 0.18,
          phase: rnd() * Math.PI * 2,
        });
      }
    }
  }

  _makeTexture() {
    const w = 128;
    const h = 64;
    const tex = this.scene.textures.createCanvas(TEX, w, h);
    const ctx = tex.getContext();
    // Varias manchas redondas suaves juntas forman una nube con bordes difusos
    const blobs = [
      [64, 34, 30],
      [40, 36, 22],
      [88, 36, 22],
      [54, 26, 18],
      [76, 28, 18],
    ];
    for (const [x, y, r] of blobs) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(240,246,255,0.8)');
      g.addColorStop(0.6, 'rgba(228,238,252,0.4)');
      g.addColorStop(1, 'rgba(220,230,250,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    tex.refresh();
  }

  update(dt) {
    this.time += dt;
    const view = this.scene.cameras.main.worldView;
    for (const p of this.puffs) {
      const t = this.time * p.speed + p.phase;
      const x = p.x + Math.sin(t) * p.amp;
      const y = p.y + Math.sin(t * 0.7) * 4;
      const on = x > view.x - 260 && x < view.right + 260 && y > view.y - 160 && y < view.bottom + 160;
      p.img.setVisible(on);
      if (!on) continue;
      p.img.setPosition(x, y).setAlpha(p.base * (0.8 + 0.2 * Math.sin(t * 1.9)));
    }
  }
}
