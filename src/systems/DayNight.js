import { DAY_LENGTH_SECONDS } from '../config.js';

const NIGHT_LIGHT = 0.3; // luz mínima de noche (luna)

// Colores por hora del día: [hora, valor]. Entre dos horas se interpola.
// Cielo: color arriba y en el horizonte.
const SKY_KEYS = [
  [0, [0x05, 0x08, 0x1a], [0x14, 0x20, 0x46]],
  [4.5, [0x05, 0x08, 0x1a], [0x14, 0x20, 0x46]],
  [6, [0x2a, 0x3d, 0x78], [0xf0, 0x9a, 0x6a]],
  [8, [0x3d, 0x84, 0xd8], [0xa9, 0xd6, 0xf5]],
  [16.5, [0x3d, 0x84, 0xd8], [0xa9, 0xd6, 0xf5]],
  [18.5, [0x2a, 0x34, 0x70], [0xf0, 0x80, 0x5c]],
  [20.5, [0x05, 0x08, 0x1a], [0x14, 0x20, 0x46]],
  [24, [0x05, 0x08, 0x1a], [0x14, 0x20, 0x46]],
];
// Color de la luz del sol/luna (multiplica la escena): blanca de día, cálida al atardecer, azul de noche
const LIGHT_KEYS = [
  [0, [0.3, 0.36, 0.58]],
  [4.5, [0.3, 0.36, 0.58]],
  [6, [0.85, 0.7, 0.62]],
  [8, [1, 1, 1]],
  [16.5, [1, 1, 1]],
  [18.5, [0.95, 0.68, 0.52]],
  [20.5, [0.3, 0.36, 0.58]],
  [24, [0.3, 0.36, 0.58]],
];

const lerp = (a, b, t) => a + (b - a) * t;

function sample(keys, hours, index) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0] = keys[i];
    const [h1] = keys[i + 1];
    if (hours >= h0 && hours <= h1) {
      const t = h1 === h0 ? 0 : (hours - h0) / (h1 - h0);
      const a = keys[i][index];
      const b = keys[i + 1][index];
      return a.map((v, k) => lerp(v, b[k], t));
    }
  }
  return keys[0][index];
}

const toInt = ([r, g, b]) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

/**
 * Ciclo día/noche. time va de 0 a 1 (0 = medianoche, 0.5 = mediodía).
 * Un ciclo completo dura DAY_LENGTH_SECONDS (10 minutos): 1 hora del juego = 25 s.
 */
export class DayNight {
  constructor(time = 8 / 24, day = 1) {
    this.time = time;
    this.day = day;
  }

  update(dt) {
    this.time += dt / DAY_LENGTH_SECONDS;
    while (this.time >= 1) {
      this.time -= 1;
      this.day++;
    }
  }

  get hours() {
    return this.time * 24;
  }

  /** Intensidad del sol entre NIGHT_LIGHT y 1, con amanecer (5-7 h) y atardecer (18-20 h) graduales. */
  getDaylight() {
    const h = this.hours;
    if (h >= 7 && h < 18) return 1;
    if (h >= 20 || h < 5) return NIGHT_LIGHT;
    const t = h < 12 ? (h - 5) / 2 : 1 - (h - 18) / 2;
    const s = t * t * (3 - 2 * t);
    return NIGHT_LIGHT + (1 - NIGHT_LIGHT) * s;
  }

  /** 0 de día, 1 en plena noche (para las estrellas). */
  getNightFactor() {
    return 1 - (this.getDaylight() - NIGHT_LIGHT) / (1 - NIGHT_LIGHT);
  }

  isNight() {
    const h = this.hours;
    return h >= 19 || h < 6;
  }

  getClockText() {
    const total = Math.floor(this.time * 24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  /** Colores del cielo { top, bottom } (enteros 0xRRGGBB). */
  getSkyColors() {
    const h = this.hours;
    return { top: toInt(sample(SKY_KEYS, h, 1)), bottom: toInt(sample(SKY_KEYS, h, 2)) };
  }

  /** Color de la luz ambiente [r, g, b] en 0..1. */
  getLightColor() {
    return sample(LIGHT_KEYS, this.hours, 1);
  }
}
