import Phaser from 'phaser';
import { TILE_SIZE, WORLD_WIDTH } from '../config.js';
import { DayNight } from '../systems/DayNight.js';
import { hash } from '../systems/PixelArt.js';
import { BG_THEMES, paintPlaceholder } from '../systems/Placeholders.js';

// Capas con paralaje: más lejos = se mueven menos (fx horizontal, fy vertical)
const LAYERS = [
  { key: 'bg_mountains', fx: 0.06, fy: 0.12, drop: 60 },
  { key: 'bg_hills', fx: 0.15, fy: 0.25, drop: 40 },
  { key: 'bg_forest', fx: 0.3, fy: 0.4, drop: 30 },
];
// Tema del fondo de cada zona (mismo orden que BIOME en WorldGenerator)
const THEMES = ['forest', 'desert', 'snow', 'jungle', 'shadow', 'crystal', 'volcano'];
const FAR_CLOUDS = 5; // pequeñas, detrás de las montañas
const CLOUDS = 8; // entre las montañas y las colinas

// Cielo por hora: [hora, arriba, medio, horizonte] (colores finales, ya con la luz del juego)
const SKY = [
  [0, 0x03051a, 0x080e2e, 0x141d44],
  [4.6, 0x03051a, 0x080e2e, 0x141d44],
  [5.4, 0x0b1238, 0x262860, 0x6a4470],
  [6.2, 0x27377a, 0x8a5e98, 0xffa266],
  [7.2, 0x3a70c6, 0x7eaae2, 0xffd8a8],
  [8.4, 0x2c6cd6, 0x5c9eea, 0xbce4fa],
  [16.6, 0x2c6cd6, 0x5c9eea, 0xbce4fa],
  [17.6, 0x3466c0, 0x7c9ede, 0xffd2a0],
  [18.5, 0x2a3378, 0xa05888, 0xff8a52],
  [19.3, 0x141a48, 0x3e2e66, 0xa04e6a],
  [20.4, 0x03051a, 0x080e2e, 0x141d44],
  [24, 0x03051a, 0x080e2e, 0x141d44],
];
// Tinte del paisaje por hora: [hora, lejos, medio, cerca] (rosado al amanecer, dorado al atardecer)
const LAND = [
  [0, 0xb0bce0, 0x98a6d0, 0x7c88b4],
  [4.6, 0xb0bce0, 0x98a6d0, 0x7c88b4],
  [6.2, 0xffc4c0, 0xf4c8c0, 0xd8b4b4],
  [7.4, 0xfff0e4, 0xfff4ec, 0xf8f0ec],
  [8.4, 0xffffff, 0xffffff, 0xffffff],
  [16.6, 0xffffff, 0xffffff, 0xffffff],
  [17.6, 0xffe8cc, 0xfff0dc, 0xf8ecdc],
  [18.5, 0xffb49c, 0xf0b4a4, 0xd4a0a0],
  [19.4, 0xc8b0d8, 0xb0a0cc, 0x9488b4],
  [20.4, 0xb0bce0, 0x98a6d0, 0x7c88b4],
  [24, 0xb0bce0, 0x98a6d0, 0x7c88b4],
];
// Nubes por hora: blancas de día, rosadas/anaranjadas al salir y ponerse el sol, azuladas de noche
const CLOUD_TINT = [
  [0, 0x8894c4],
  [4.8, 0x8894c4],
  [6, 0xffaea8],
  [7.4, 0xfff0e0],
  [8.4, 0xffffff],
  [16.6, 0xffffff],
  [17.7, 0xffe0c0],
  [18.6, 0xff9c8c],
  [19.5, 0x9c8cc0],
  [20.4, 0x8894c4],
  [24, 0x8894c4],
];

const layerKey = (base, theme) => (theme === 'forest' ? base : `${base}_${theme}`);
const ch = (c, s) => (c >> s) & 255;
// Multiplica dos colores 0xRRGGBB canal por canal
const mulColor = (a, b) =>
  (Math.round((ch(a, 16) * ch(b, 16)) / 255) << 16) | (Math.round((ch(a, 8) * ch(b, 8)) / 255) << 8) | Math.round((ch(a, 0) * ch(b, 0)) / 255);
const lerpColor = (a, b, t) =>
  (Math.round(ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t) << 16) |
  (Math.round(ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t) << 8) |
  Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t);
// Color por hora interpolado de una tabla [hora, c1, c2, ...]
function sampleKeys(keys, h, i) {
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k];
    const b = keys[k + 1];
    if (h >= a[0] && h <= b[0]) return lerpColor(a[i], b[i], b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]));
  }
  return keys[0][i];
}
// Divide un color por la luz del juego (0..1 por canal) para que tras multiplicarla quede como se pensó
const unlight = (c, L) =>
  (Math.min(255, Math.round(ch(c, 16) / Math.max(0.05, L[0]))) << 16) |
  (Math.min(255, Math.round(ch(c, 8) / Math.max(0.05, L[1]))) << 8) |
  Math.min(255, Math.round(ch(c, 0) / Math.max(0.05, L[2])));
const lightTint = (L) => (Math.round(L[0] * 255) << 16) | (Math.round(L[1] * 255) << 8) | Math.round(L[2] * 255);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * Cielo y fondo, dibujados DEBAJO del mundo (en su propia escena, sin el zoom de la cámara).
 * Lee la cámara y la hora de GameScene; en el menú se mueve sola como demostración.
 * Orden: cielo, estrellas, luna, sol, bruma del horizonte, halos, nubes lejanas, montañas, nubes, colinas, bosque.
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
    this.makeTextures();

    this.sky = this.add.graphics();
    // Dos capas de las mismas estrellas, corridas, que titilan a destiempo
    this.stars = this.add.tileSprite(0, 0, 10, 10, 'bg_stars').setOrigin(0);
    this.stars2 = this.add.tileSprite(0, 0, 10, 10, 'bg_stars').setOrigin(0).setFlipX(true);
    this.shooting = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.moonHalo = this.add.image(0, 0, 'bg_halo').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2);
    this.moon = this.add.image(0, 0, 'bg_moon');
    this.sun = this.add.image(0, 0, 'bg_sun');
    this.haze = this.add.graphics();
    this.sunGlow = this.add.image(0, 0, 'bg_halo').setBlendMode(Phaser.BlendModes.ADD);
    this.sunHalo = this.add.image(0, 0, 'bg_halo').setBlendMode(Phaser.BlendModes.ADD);

    // Nubes: unas chicas y brumosas detrás de las montañas, otras más grandes delante
    const cloudKeys = ['bg_cloud', 'bg_cloud_1', 'bg_cloud_2'].filter((k) => this.textures.exists(k));
    const makeCloud = (i, far) => {
      const s = far ? 50 : 3;
      const c = this.add.image(0, 0, cloudKeys[Math.floor(hash(i, 6, s) * cloudKeys.length)]);
      c.setFlipX(hash(i, 7, s) < 0.5);
      c.setScale(far ? 0.45 + hash(i, 2, s) * 0.3 : 0.75 + hash(i, 2, s) * 0.85);
      c.baseAlpha = far ? 0.55 + hash(i, 1, s) * 0.2 : 0.88 + hash(i, 1, s) * 0.12;
      c.u = hash(i, 3, s); // posición horizontal relativa (0..1)
      c.v = far ? 0.14 + hash(i, 4, s) * 0.2 : 0.06 + hash(i, 4, s) * 0.3; // altura relativa en el cielo
      c.speed = far ? 2 + hash(i, 5, s) * 3 : 5 + hash(i, 5, s) * 9; // píxeles por segundo
      c.parallax = far ? 0.02 : 0.04;
      return c;
    };
    this.farClouds = Array.from({ length: FAR_CLOUDS }, (_, i) => makeCloud(i, true));
    this.clouds = Array.from({ length: CLOUDS }, (_, i) => makeCloud(i, false));
    this.allClouds = [...this.farClouds, ...this.clouds];

    // Cada capa tiene una versión por zona; al caminar de una zona a otra se funden
    this.weights = THEMES.map((t, i) => (i === 0 ? 1 : 0));
    this.layers = LAYERS.map((cfg, li) => ({
      ...cfg,
      themes: THEMES.map((theme) => {
        const key = layerKey(cfg.key, theme);
        const tex = this.textures.get(key).getSourceImage();
        return {
          texHeight: tex.height,
          fill: BG_THEMES[theme].fills[li],
          sprite: this.add.tileSprite(0, 0, 10, tex.height, key).setOrigin(0, 1),
          filler: this.add.rectangle(0, 0, 10, 10, BG_THEMES[theme].fills[li]).setOrigin(0, 0),
        };
      }),
    }));
    const [mountains, hills, forest] = this.layers;
    const toTop = (l) =>
      l.themes.forEach((t) => {
        this.children.bringToTop(t.filler);
        this.children.bringToTop(t.sprite);
      });
    this.farClouds.forEach((c) => this.children.bringToTop(c));
    toTop(mountains);
    this.clouds.forEach((c) => this.children.bringToTop(c));
    toTop(hills);
    toTop(forest);

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  /** Halo suave (para el sol, la luna y el resplandor del horizonte) y otras dos formas de nube. */
  makeTextures() {
    if (!this.textures.exists('bg_halo')) {
      const S = 128;
      const tex = this.textures.createCanvas('bg_halo', S, S);
      const g = tex.context.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      for (let i = 0; i <= 12; i++) {
        const r = i / 12;
        g.addColorStop(r, `rgba(255,255,255,${(Math.exp(-r * r * 4.5) * (1 - r)).toFixed(3)})`);
      }
      tex.context.fillStyle = g;
      tex.context.fillRect(0, 0, S, S);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    // Las variantes solo si la nube es dibujada por código (no una imagen propia)
    const base = this.textures.get('bg_cloud').getSourceImage();
    if (!(base instanceof HTMLCanvasElement)) return;
    for (const v of [1, 2]) {
      const key = `bg_cloud_${v}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, paintPlaceholder({ width: base.width, height: base.height, placeholder: 'cloud' }, v));
    }
  }

  layout() {
    const { width: W, height: H } = this.scale;
    this.stars.setSize(W, H);
    this.stars2.setSize(W, H);
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
    const h = dn.hours;
    // Luz del sol/luna que GameScene multiplica sobre todo (también sobre este fondo)
    const day = dn.getDaylight();
    const L = dn.getLightColor().map((c) => c * day);
    const night = dn.getNightFactor();

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

    // --- Cielo (degradado de 3 tonos) y bruma del horizonte ---
    // En el juego la luz oscurece el fondo: el cielo se compensa para que se vea con sus colores pensados
    const sk = (i) => {
      const c = mulColor(sampleKeys(SKY, h, i), tint);
      return playing ? unlight(c, L) : c;
    };
    const top = sk(1);
    const mid = sk(2);
    const hor = sk(3);
    // El horizonte del cielo queda detrás de las montañas (sigue al paisaje, no al borde de la pantalla)
    const mBottom = H * 0.5 + (horizon - H * 0.5) * LAYERS[0].fy + LAYERS[0].drop;
    const yHor = Math.round(Phaser.Math.Clamp(mBottom - 120, H * 0.3, H * 0.95) / 4) * 4;
    const yMid = Math.round(Phaser.Math.Clamp(mBottom - 340, H * 0.06, yHor - 60));
    const skyKey = `${top}-${mid}-${hor}-${W}-${H}-${yHor}`;
    if (skyKey !== this.skyKey) {
      this.skyKey = skyKey;
      this.sky.clear();
      this.sky.fillGradientStyle(top, top, mid, mid, 1);
      this.sky.fillRect(0, 0, W, yMid);
      this.sky.fillGradientStyle(mid, mid, hor, hor, 1);
      this.sky.fillRect(0, yMid, W, yHor - yMid);
      this.sky.fillStyle(hor, 1);
      this.sky.fillRect(0, yHor, W, H - yHor);
      // Bruma: tapa de a poco las estrellas, el sol y la luna cerca del horizonte
      const hy = Math.max(0, yHor - 200);
      this.haze.clear();
      this.haze.fillGradientStyle(hor, hor, hor, hor, 0, 0, 0.8, 0.8);
      this.haze.fillRect(0, hy, W, yHor - hy);
      this.haze.fillStyle(hor, 0.8);
      this.haze.fillRect(0, yHor, W, H - yHor);
    }

    // --- Estrellas: titilan a destiempo y giran muy despacio ---
    const starsOn = night > 0.02;
    const drift = time * 0.0015;
    this.stars.setVisible(starsOn).setAlpha(night * (0.78 + Math.sin(time * 0.0021) * 0.22));
    this.stars2.setVisible(starsOn).setAlpha(night * (0.45 + Math.sin(time * 0.0033 + 2) * 0.3));
    this.stars.tilePositionX = camX * 0.02 + drift;
    this.stars2.setTilePosition(camX * 0.02 + drift + 97, 141);
    this.updateShootingStar(time, W, H, night);

    // --- Sol y luna: arco de este a oeste ---
    const arc = (t) => ({ x: W * (0.08 + 0.84 * t), y: H * 0.78 - Math.sin(Math.PI * t) * H * 0.62 });
    const sunT = (h - 6) / 12;
    const sunOn = sunT > -0.08 && sunT < 1.08;
    const low = 1 - smooth(Math.sin(Math.PI * Phaser.Math.Clamp(sunT, 0, 1)) * 2.4); // 1 cerca del horizonte
    this.sun.setVisible(sunOn);
    this.sunHalo.setVisible(sunOn);
    this.sunGlow.setVisible(sunOn && low > 0.01);
    if (sunOn) {
      const p = arc(sunT);
      // Cerca del horizonte se ve más grande y rojizo, con un resplandor ancho
      this.sun.setPosition(p.x, p.y).setScale(1 + low * 0.15).setTint(lerpColor(0xffffff, 0xff9a5a, low));
      this.sunHalo
        .setPosition(p.x, p.y)
        .setScale(2.6 + low * 1.6)
        .setTint(mulColor(lerpColor(0xfff2c8, 0xff8a40, low), tint))
        .setAlpha(0.42 + low * 0.3);
      this.sunGlow
        .setPosition(p.x, Math.max(p.y, yHor - 30))
        .setScale(9, 2.4)
        .setTint(mulColor(0xff7a48, tint))
        .setAlpha(low * 0.55);
    }
    const moonT = ((h - 18 + 24) % 24) / 12;
    const moonOn = moonT > -0.08 && moonT < 1.08;
    this.moon.setVisible(moonOn);
    this.moonHalo.setVisible(moonOn);
    if (moonOn) {
      const p = arc(moonT);
      this.moon.setPosition(p.x, p.y);
      this.moonHalo.setPosition(p.x, p.y).setTint(0x8ea6ff).setAlpha(0.18 + night * 0.22);
    }

    // --- Capas con paralaje ---
    // En el menú no hay luz del juego: se imita (un poco más clara, como de luna) para que la noche oscurezca el paisaje
    const menuLight = playing ? 0xffffff : lightTint(L.map((c) => Math.pow(c, 0.6)));
    this.layers.forEach((l, li) => {
      // La base de cada capa sigue al horizonte, pero menos cuanto más lejos está
      const bottom = H * 0.5 + (horizon - H * 0.5) * l.fy + l.drop;
      const landTint = mulColor(sampleKeys(LAND, h, li + 1), menuLight);
      l.themes.forEach((t, i) => {
        // Transparencia relativa a la zona dominante: sin saltos al cruzar de una zona a otra
        const a = wMax > 0 ? weights[i] / wMax : 0;
        const on = a > 0.01;
        t.sprite.tilePositionX = camX * l.fx;
        t.sprite.y = bottom;
        t.filler.y = bottom - 1;
        t.sprite.setVisible(on && bottom > 0 && bottom - t.texHeight < H).setAlpha(a);
        t.filler.setVisible(on && bottom < H).setAlpha(a);
        if (on) {
          t.sprite.setTint(landTint);
          t.filler.fillColor = mulColor(t.fill, landTint);
        }
      });
    });

    // --- Nubes que avanzan con el viento ---
    const span = W + 400;
    const cloudShift = (horizon - H * 0.5) * 0.08;
    const cloudTint = mulColor(mulColor(sampleKeys(CLOUD_TINT, h, 1), tint), menuLight);
    for (const c of this.allClouds) {
      c.u += (c.speed * delta) / 1000 / span;
      const x = ((((c.u * span - camX * c.parallax) % span) + span) % span) - 200;
      c.setPosition(x, H * 0.06 + c.v * H + cloudShift).setTint(cloudTint).setAlpha(c.baseAlpha);
    }
  }

  /** Estrella fugaz de vez en cuando (determinista según el tiempo). */
  updateShootingStar(time, W, H, night) {
    const g = this.shooting;
    g.clear();
    if (night < 0.6) return;
    const PERIOD = 9000;
    const n = Math.floor(time / PERIOD);
    if (hash(n, 1, 77) > 0.55) return;
    const t = (time % PERIOD) / 900;
    if (t >= 1) return;
    const dir = hash(n, 2, 77) < 0.5 ? -1 : 1;
    const x0 = W * (0.15 + hash(n, 3, 77) * 0.7);
    const y0 = H * (0.05 + hash(n, 4, 77) * 0.25);
    const len = 160 + hash(n, 5, 77) * 120;
    const hx = x0 + dir * len * t;
    const hy = y0 + len * 0.45 * t;
    const fade = Math.sin(Math.PI * t) * night;
    // Cola en tramos que se desvanecen
    for (let k = 0; k < 8; k++) {
      const a = (1 - k / 8) * fade;
      const s0 = k * 9;
      const s1 = s0 + 9;
      g.lineStyle(k < 2 ? 2 : 1, 0xdfe8ff, a);
      g.lineBetween(hx - dir * s0, hy - s0 * 0.45, hx - dir * s1, hy - s1 * 0.45);
    }
    g.fillStyle(0xffffff, fade);
    g.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
  }
}
