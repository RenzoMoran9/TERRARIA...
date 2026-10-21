import Phaser from 'phaser';
import { TILE_SIZE, WORLD_WIDTH } from '../config.js';
import { DayNight } from '../systems/DayNight.js';
import { hash } from '../systems/PixelArt.js';
import { BG_THEMES } from '../systems/Placeholders.js';

// Capas con paralaje: más lejos = se mueven menos (fx horizontal, fy vertical)
const LAYERS = [
  { key: 'bg_mountains', fx: 0.06, fy: 0.12, drop: 60 },
  { key: 'bg_hills', fx: 0.15, fy: 0.25, drop: 40 },
  { key: 'bg_forest', fx: 0.3, fy: 0.4, drop: 30 },
];
// Tema del fondo de cada zona (mismo orden que BIOME en WorldGenerator)
const THEMES = ['forest', 'desert', 'snow', 'jungle', 'shadow', 'crystal', 'volcano'];
const CLOUDS = 7;

const layerKey = (base, theme) => (theme === 'forest' ? base : `${base}_${theme}`);
// Multiplica dos colores 0xRRGGBB canal por canal
const mulColor = (a, b) =>
  (Math.round((((a >> 16) & 255) * ((b >> 16) & 255)) / 255) << 16) |
  (Math.round((((a >> 8) & 255) * ((b >> 8) & 255)) / 255) << 8) |
  Math.round(((a & 255) * (b & 255)) / 255);

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

    // Cada capa tiene una versión por zona; al caminar de una zona a otra se funden
    this.weights = THEMES.map((t, i) => (i === 0 ? 1 : 0));
    this.layers = LAYERS.map((cfg, li) => ({
      ...cfg,
      themes: THEMES.map((theme) => {
        const key = layerKey(cfg.key, theme);
        const tex = this.textures.get(key).getSourceImage();
        return {
          texHeight: tex.height,
          sprite: this.add.tileSprite(0, 0, 10, tex.height, key).setOrigin(0, 1),
          filler: this.add.rectangle(0, 0, 10, 10, BG_THEMES[theme].fills[li]).setOrigin(0, 0),
        };
      }),
    }));
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
    const toTop = (l) =>
      l.themes.forEach((t) => {
        this.children.bringToTop(t.filler);
        this.children.bringToTop(t.sprite);
      });
    toTop(mountains);
    this.clouds.forEach((c) => this.children.bringToTop(c));
    toTop(hills);
    toTop(forest);

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  layout() {
    const { width: W, height: H } = this.scale;
    this.stars.setSize(W, H);
    for (const l of this.layers) {
      for (const t of l.themes) {
        t.sprite.setSize(W, t.texHeight);
        t.filler.setSize(W, H);
      }
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
      if (gs.zones) this.weights = gs.zones.weights;
    } else {
      // Menú: el fondo avanza solo y el día pasa más rápido; el bosque llega hasta el suelo del menú
      this.demoX += delta * 0.04;
      this.demoTime.update((delta / 1000) * 6);
      this.smoothSurface = null;
      camX = this.demoX;
      horizon = H * 0.5 + (H * 0.5 - 70) / LAYERS[2].fy;
      dn = this.demoTime;
      this.weights = THEMES.map((t, i) => (i === 0 ? 1 : 0));
    }
    const weights = this.weights;
    const wMax = Math.max(...weights);

    // Color del cielo según la zona (desierto cálido, volcán rojizo, tierras sombrías violeta…)
    let mr = 0;
    let mg = 0;
    let mb = 0;
    let wSum = 0;
    THEMES.forEach((theme, i) => {
      const w = weights[i];
      if (w <= 0) return;
      const th = BG_THEMES[theme];
      const k = th.skyMix;
      mr += w * (255 + (((th.sky >> 16) & 255) - 255) * k);
      mg += w * (255 + (((th.sky >> 8) & 255) - 255) * k);
      mb += w * (255 + ((th.sky & 255) - 255) * k);
      wSum += w;
    });
    const tint = wSum > 0 ? (Math.round(mr / wSum) << 16) | (Math.round(mg / wSum) << 8) | Math.round(mb / wSum) : 0xffffff;

    // --- Cielo (degradado) ---
    const base = dn.getSkyColors();
    const sky = { top: mulColor(base.top, tint), bottom: mulColor(base.bottom, tint) };
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
      l.themes.forEach((t, i) => {
        // Transparencia relativa a la zona dominante: sin saltos al cruzar de una zona a otra
        const a = wMax > 0 ? weights[i] / wMax : 0;
        const on = a > 0.01;
        t.sprite.tilePositionX = camX * l.fx;
        t.sprite.y = bottom;
        t.filler.y = bottom - 1;
        t.sprite.setVisible(on && bottom > 0 && bottom - t.texHeight < H).setAlpha(a);
        t.filler.setVisible(on && bottom < H).setAlpha(a);
      });
    }

    // --- Nubes que avanzan con el viento ---
    const span = W + 400;
    const cloudShift = (horizon - H * 0.5) * 0.08;
    for (const c of this.clouds) {
      c.u += (c.speed * delta) / 1000 / span;
      const x = ((((c.u * span - camX * 0.04) % span) + span) % span) - 200;
      c.setPosition(x, H * 0.06 + c.v * H + cloudShift).setTint(tint);
    }
  }
}
