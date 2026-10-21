import { TILE_SIZE, WORLD_WIDTH } from '../config.js';
import { BIOME_INFO, ZONE_INFO } from '../world/WorldGenerator.js';

const T = TILE_SIZE;
const BLEND_COLUMNS = 30; // columnas a cada lado de la cámara que cuentan para mezclar el fondo
const ENTER_SECONDS = 0.4; // tiempo dentro de una zona para contarla como "entrada"

/** Frase corta de cada zona para el cartel de "¡Zona descubierta!" */
export const ZONE_DESC = [
  'Donde empezó todo',
  'Dunas, cactus, escorpiones… y una pirámide con tesoro',
  'Pinos, nieve y slimes de hielo',
  'Árboles gigantes, flores que brillan y avispas',
  'Pasto violeta, abismos y ojos que vuelan',
  'Torres de cristal que brillan en la noche',
  'Lava, ceniza y murciélagos de fuego. ¡Cuidado!',
  'Lagos de lava y piedra infernal. Lo más peligroso del mundo',
  'Hongos azules que brillan en la oscuridad',
  'Tierra en el cielo… y un cofre con tesoro',
];

export const dangerStars = (d) => '★'.repeat(d) + '☆'.repeat(Math.max(0, 5 - d));

/**
 * Zonas del mundo: cuál está pisando el jugador, cuáles ya descubrió y cuánto de cada una
 * se ve alrededor de la cámara (para fundir el fondo y las partículas al pasar de una a otra).
 * Eventos en la escena: 'zoneChanged' (biome) y 'zoneDiscovered' (biome).
 */
export class Zones {
  constructor(scene, generator, discovered = []) {
    this.scene = scene;
    this.gen = generator;
    this.weights = BIOME_INFO.map(() => 0);
    this.current = -1;
    this.pending = -1;
    this.pendingTime = 0;
    this.discovered = new Set(discovered);
    this.first = true;
  }

  get total() {
    return ZONE_INFO.length;
  }

  biomeAt(tx) {
    return this.gen.biome[Math.max(0, Math.min(WORLD_WIDTH - 1, tx))];
  }

  /** Cuánto de cada zona hay alrededor de la columna cx (0..1, suman 1). */
  targetWeights(cx) {
    const w = BIOME_INFO.map(() => 0);
    let n = 0;
    for (let x = cx - BLEND_COLUMNS; x <= cx + BLEND_COLUMNS; x += 2) {
      w[this.biomeAt(x)]++;
      n++;
    }
    return w.map((v) => v / n);
  }

  update(dt, cam, player) {
    const cx = Math.floor((cam.scrollX + cam.width / 2) / T);
    const target = this.targetWeights(cx);
    // Al reaparecer lejos (salto de cámara) el fondo cambia de golpe; caminando, se funde
    const jump = this.lastCx !== undefined && Math.abs(cx - this.lastCx) > 20;
    this.lastCx = cx;
    const k = this.first || jump ? 1 : Math.min(1, dt * 2.5);
    for (let i = 0; i < target.length; i++) this.weights[i] += (target[i] - this.weights[i]) * k;

    if (player.dead) return;
    const b = this.gen.zoneAt(Math.floor(player.centerX / T), Math.floor(player.centerY / T));
    if (b === this.current) {
      this.pending = -1;
      return;
    }
    if (b !== this.pending) {
      this.pending = b;
      this.pendingTime = 0;
    }
    this.pendingTime += dt;
    if (this.first || this.pendingTime >= ENTER_SECONDS) {
      this.current = b;
      this.pending = -1;
      this.scene.events.emit('zoneChanged', b);
      if (!this.discovered.has(b)) {
        this.discovered.add(b);
        // La zona donde se empieza se marca sin cartel
        if (!this.first) this.scene.events.emit('zoneDiscovered', b);
      }
    }
    this.first = false;
  }

  serialize() {
    return [...this.discovered];
  }
}
