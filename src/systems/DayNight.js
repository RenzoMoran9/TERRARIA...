import { DAY_LENGTH_SECONDS } from '../config.js';

const NIGHT_LIGHT = 0.3; // luz mínima de noche (luna)
const DAY_SKY = [126, 192, 238];
const NIGHT_SKY = [10, 14, 40];
const DUSK_SKY = [235, 135, 85];

const lerp = (a, b, t) => a + (b - a) * t;

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

  /** Luz del sol entre NIGHT_LIGHT y 1, con amanecer (5-7 h) y atardecer (18-20 h) graduales. */
  getDaylight() {
    const h = this.hours;
    if (h >= 7 && h < 18) return 1;
    if (h >= 20 || h < 5) return NIGHT_LIGHT;
    const t = h < 12 ? (h - 5) / 2 : 1 - (h - 18) / 2;
    const s = t * t * (3 - 2 * t);
    return NIGHT_LIGHT + (1 - NIGHT_LIGHT) * s;
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

  /** Color del cielo (entero 0xRRGGBB) según la hora, con tono anaranjado al amanecer/atardecer. */
  getSkyColor() {
    const d = (this.getDaylight() - NIGHT_LIGHT) / (1 - NIGHT_LIGHT);
    const dusk = Math.sin(d * Math.PI) * 0.5;
    const c = [0, 1, 2].map((i) => Math.round(lerp(lerp(NIGHT_SKY[i], DAY_SKY[i], d), DUSK_SKY[i], dusk)));
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }
}
