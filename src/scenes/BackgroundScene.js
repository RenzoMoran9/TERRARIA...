import Phaser from 'phaser';
import { TILE_SIZE, WORLD_WIDTH } from '../config.js';
import { DayNight } from '../systems/DayNight.js';
import { hash } from '../systems/PixelArt.js';

// Capas con paralaje: más lejos = se mueven menos (fx horizontal, fy vertical)
const LAYERS = [
  { key: 'bg_mountains', fx: 0.06, fy: 0.12, drop: 60, fill: 0x7590b8 },
  { key: 'bg_hills', fx: 0.15, fy: 0.25, drop: 40, fill: 0x4f9149 },
  { key: 'bg_forest', fx: 0.3, fy: 0.4, drop: 30, fill: 0x2b5a2c },
];
const CLOUDS = 7;

/**
 * Cielo y fondo, dibujados DEBAJO del mundo (en su propia escena, sin el zoom de la cámara).
 * Lee la cámara y la hora de GameScene; en el menú se mueve sola como demostración.
 */
export class BackgroundScene extends Phaser.Scene {
  constructor() {
    super('BackgroundScene');
  }

  create() {
    this.demoTime = new DayNight(9 / 24);
    this.demoX = 0;
    this.skyKey = '';
    this.smoothSurface = null; // altura del terreno alrededor de la cámara (suavizada)

    this.sky = this.add.graphics();
    this.stars = this.add.tileSprite(0, 0, 10, 10, 'bg_stars').setOrigin(0);
    this.sun = this.add.image(0, 0, 'bg_sun');
    this.moon = this.add.image(0, 0, 'bg_moon');

    this.layers = LAYERS.map((cfg) => {
      const tex = this.textures.get(cfg.key).getSourceImage();
      return {
        ...cfg,
        texHeight: tex.height,
        sprite: this.add.tileSprite(0, 0, 10, tex.height, cfg.key).setOrigin(0, 1),
        filler: this.add.rectangle(0, 0, 10, 10, cfg.fill).setOrigin(0, 0),
      };
    });
    // Las nubes van entre las montañas y las colinas
    this.clouds = [];
    for (let i = 0; i < CLOUDS; i++) {
      const c = this.add.image(0, 0, 'bg_cloud').setAlpha(0.85 + hash(i, 1, 3) * 0.15);
      c.setScale(0.7 + hash(i, 2, 3) * 0.8);
      c.depthIndex = i;
      c.u = hash(i, 3, 3); // posición horizontal relativa (0..1)
      c.v = 0.08 + hash(i, 4, 3) * 0.3; // altura relativa en el cielo
      c.speed = 4 + hash(i, 5, 3) * 8; // píxeles por segundo
      this.clouds.push(c);
    }
    // Orden de dibujo: cielo, estrellas, sol/luna, montañas, nubes, colinas, bosque
    const [mountains, hills, forest] = this.layers;
    this.children.bringToTop(mountains.filler);
    this.children.bringToTop(mountains.sprite);
    this.clouds.forEach((c) => this.children.bringToTop(c));
    for (const l of [hills, forest]) {
      this.children.bringToTop(l.filler);
      this.children.bringToTop(l.sprite);
    }

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  layout() {
    const { width: W, height: H } = this.scale;
    this.stars.setSize(W, H);
    for (const l of this.layers) {
      l.sprite.setSize(W, l.texHeight);
      l.filler.setSize(W, H);
    }
    this.skyKey = '';
  }

  update(time, delta) {
    const { width: W, height: H } = this.scale;
    const gs = this.scene.get('GameScene');
    const playing = gs && gs.sys.isActive() && gs.cameras && gs.dayNight;

    let camX;
    let horizon; // altura (en pantalla) del terreno alrededor de la cámara
    let dn;
    if (playing) {
      const cam = gs.cameras.main;
      const viewTop = cam.scrollY + (cam.height - cam.height / cam.zoom) / 2;
      camX = cam.scrollX;
      // Superficie más baja en ±24 columnas alrededor de la cámara: así el paisaje
      // del fondo baja en los valles (no queda un hueco plano) y en las colinas se ve cielo
      const surface = gs.world.generator.surface;
      const cx = Math.floor((cam.scrollX + cam.width / 2) / TILE_SIZE);
      let deepest = 0;
      for (let x = cx - 24; x <= cx + 24; x += 3) {
        deepest = Math.max(deepest, surface[Phaser.Math.Clamp(x, 0, WORLD_WIDTH - 1)]);
      }
      const target = deepest * TILE_SIZE;
      this.smoothSurface = this.smoothSurface === null ? target : Phaser.Math.Linear(this.smoothSurface, target, Math.min(1, delta * 0.004));
      horizon = (this.smoothSurface - viewTop) * cam.zoom;
      dn = gs.dayNight;
    } else {
      // Menú: el fondo avanza solo y el día pasa más rápido; el bosque llega hasta el suelo del menú
      this.demoX += delta * 0.04;
      this.demoTime.update((delta / 1000) * 6);
      this.smoothSurface = null;
      camX = this.demoX;
      horizon = H * 0.5 + (H * 0.5 - 70) / LAYERS[2].fy;
      dn = this.demoTime;
    }

    // --- Cielo (degradado) ---
    const sky = dn.getSkyColors();
    const skyKey = `${sky.top}-${sky.bottom}-${W}-${H}`;
    if (skyKey !== this.skyKey) {
      this.skyKey = skyKey;
      this.sky.clear();
      this.sky.fillGradientStyle(sky.top, sky.top, sky.bottom, sky.bottom, 1);
      this.sky.fillRect(0, 0, W, H);
    }

    // --- Estrellas (solo de noche, con un leve titileo) ---
    const night = dn.getNightFactor();
    this.stars.setVisible(night > 0.02);
    this.stars.setAlpha(night * (0.85 + Math.sin(time * 0.002) * 0.15));
    this.stars.tilePositionX = camX * 0.02;

    // --- Sol y luna: arco de este a oeste ---
    const h = dn.hours;
    const arc = (t) => ({ x: W * (0.08 + 0.84 * t), y: H * 0.78 - Math.sin(Math.PI * t) * H * 0.62 });
    const sunT = (h - 6) / 12;
    this.sun.setVisible(sunT > -0.05 && sunT < 1.05);
    if (this.sun.visible) this.sun.setPosition(arc(sunT).x, arc(sunT).y);
    const moonT = ((h - 18 + 24) % 24) / 12;
    this.moon.setVisible(moonT > -0.05 && moonT < 1.05);
    if (this.moon.visible) this.moon.setPosition(arc(moonT).x, arc(moonT).y);

    // --- Capas con paralaje ---
    for (const l of this.layers) {
      // La base de cada capa sigue al horizonte, pero menos cuanto más lejos está
      const bottom = H * 0.5 + (horizon - H * 0.5) * l.fy + l.drop;
      l.sprite.tilePositionX = camX * l.fx;
      l.sprite.y = bottom;
      l.filler.y = bottom - 1;
      const visible = bottom > 0 && bottom - l.texHeight < H;
      l.sprite.setVisible(visible);
      l.filler.setVisible(bottom < H);
    }

    // --- Nubes que avanzan con el viento ---
    const span = W + 400;
    const cloudShift = (horizon - H * 0.5) * 0.08;
    for (const c of this.clouds) {
      c.u += (c.speed * delta) / 1000 / span;
      const x = ((((c.u * span - camX * 0.04) % span) + span) % span) - 200;
      c.setPosition(x, H * 0.06 + c.v * H + cloudShift);
    }
  }
}
