import Phaser from 'phaser';
import { TILE_SIZE, DEPTH, WORLD_WIDTH } from '../config.js';

const T = TILE_SIZE;
const MAX_PARTICLES = 180;
const DEEP_TILES = 18; // más abajo de la superficie no hay partículas del clima

/**
 * Partículas de cada zona (en el mundo, se mueven con la cámara):
 * nieve, polvo de arena, luciérnagas, esporas, destellos de cristal, brasas y ceniza.
 * rate = partículas por segundo con la zona llenando la pantalla.
 * glow = brillan (se dibujan por encima de la oscuridad, como las luciérnagas).
 */
const KINDS = {
  leaf: { rate: 1.2, life: [5, 8], from: 'top', vx: [-20, 20], vy: [30, 45], sway: 30, size: 4, colors: [0x5fae4a, 0x7cc35a, 0xd0a040] },
  snow: { rate: 30, life: [5, 8], from: 'top', vx: [-15, 15], vy: [40, 70], sway: 22, size: 4, colors: [0xffffff, 0xe8f2ff] },
  dust: { rate: 16, life: [2.5, 4], from: 'side', vx: [160, 260], vy: [-8, 8], sway: 10, size: 2, colors: [0xe8c890, 0xd8b070, 0xf4dcae], alpha: 0.7 },
  firefly: { rate: 5, life: [4, 7], from: 'any', vx: [-14, 14], vy: [-14, 14], sway: 18, size: 4, colors: [0xd8ff6a, 0xfff07a], glow: true, blink: true },
  spore: { rate: 10, life: [5, 8], from: 'bottom', vx: [-10, 10], vy: [-30, -16], sway: 14, size: 3, colors: [0xc890ff, 0x9a6ad0], glow: true, alpha: 0.75 },
  sparkle: { rate: 9, life: [0.8, 1.6], from: 'any', vx: [0, 0], vy: [-6, 0], sway: 0, size: 2, colors: [0xff9ee8, 0x8ef0ff, 0xffe68a, 0xffffff], glow: true, star: true },
  ember: { rate: 18, life: [2, 3.5], from: 'bottom', vx: [-25, 25], vy: [-90, -50], sway: 26, size: 3, colors: [0xffb030, 0xff7020, 0xffe070], glow: true, blink: true },
  mspore: { rate: 10, life: [5, 8], from: 'any', vx: [-8, 8], vy: [-14, -4], sway: 10, size: 3, colors: [0x8ad0ff, 0x4a8aff, 0xc8f0ff], glow: true, alpha: 0.8 },
  cloud: { rate: 3, life: [6, 9], from: 'side', vx: [20, 40], vy: [-3, 3], sway: 4, size: 6, colors: [0xffffff, 0xeef4ff], alpha: 0.5 },
  ash: { rate: 14, life: [5, 8], from: 'top', vx: [-30, -5], vy: [25, 45], sway: 16, size: 3, colors: [0x6a6260, 0x8a8280, 0x4a4442], alpha: 0.85 },
};
// Partículas de cada zona (mismo orden que BIOME). 'night' = solo de noche.
const BIOME_KINDS = [
  [{ kind: 'leaf' }, { kind: 'firefly', night: true, mul: 0.6 }],
  [{ kind: 'dust' }],
  [{ kind: 'snow' }],
  [{ kind: 'firefly', mul: 1.4 }, { kind: 'leaf', mul: 1.5 }],
  [{ kind: 'spore' }],
  [{ kind: 'sparkle' }],
  [{ kind: 'ember' }, { kind: 'ash' }],
];

const SPECIAL_KINDS = { 7: ['ember', 'ash'], 8: ['mspore'], 9: ['cloud'] };
const rand = (a, b) => a + Math.random() * (b - a);

export class Ambience {
  constructor(scene, world, zones, dayNight) {
    this.scene = scene;
    this.world = world;
    this.zones = zones;
    this.dayNight = dayNight;
    this.list = [];
    this.acc = {};
    this.time = 0;
    // Las que no brillan quedan debajo de la oscuridad (de noche casi no se ven); las que brillan, encima
    this.gfx = scene.add.graphics().setDepth(DEPTH.PARTICLES - 0.5);
    this.glowGfx = scene.add.graphics().setDepth(DEPTH.LIGHT + 0.6).setBlendMode(Phaser.BlendModes.ADD);
  }

  update(dt) {
    this.time += dt;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    // Bajo tierra no hay clima
    const cx = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(view.centerX / T)));
    const depth = view.centerY / T - this.world.generator.surface[cx];
    const fade = Math.max(0, Math.min(1, 1 - (depth - DEEP_TILES * 0.5) / (DEEP_TILES * 0.5)));
    const night = this.dayNight.isNight();
    const area = (view.width * view.height) / (1280 * 720); // más pantalla = más partículas

    // Zonas especiales: inframundo (brasas y ceniza), cuevas de hongos (esporas) e islas (nubecitas)
    const special = SPECIAL_KINDS[this.zones.current];
    if (special) {
      for (const name of special) {
        const kind = KINDS[name];
        const key = `z:${name}`;
        this.acc[key] = (this.acc[key] || 0) + kind.rate * area * dt;
        while (this.acc[key] >= 1) {
          this.acc[key] -= 1;
          if (this.list.length < MAX_PARTICLES) this._spawn(name, kind, view);
        }
      }
    } else if (fade > 0) {
      const weights = this.zones.weights;
      for (let b = 0; b < BIOME_KINDS.length; b++) {
        const w = weights[b];
        if (w < 0.02) continue;
        for (const entry of BIOME_KINDS[b]) {
          if (entry.night && !night) continue;
          const kind = KINDS[entry.kind];
          const key = `${b}:${entry.kind}`;
          this.acc[key] = (this.acc[key] || 0) + kind.rate * (entry.mul || 1) * w * fade * area * dt;
          while (this.acc[key] >= 1) {
            this.acc[key] -= 1;
            if (this.list.length < MAX_PARTICLES) this._spawn(entry.kind, kind, view);
          }
        }
      }
    }

    const g = this.gfx;
    const gg = this.glowGfx;
    g.clear();
    gg.clear();
    const margin = 80;
    for (const p of this.list) {
      p.life += dt;
      const k = p.def;
      p.x += (p.vx + Math.sin(this.time * 1.7 + p.phase) * k.sway) * dt;
      p.y += p.vy * dt;
      if (k.from === 'any' && k.sway) {
        // Luciérnagas: cambian de rumbo suavemente
        p.vx += Math.sin(this.time * 0.9 + p.phase * 3) * 10 * dt;
        p.vy += Math.cos(this.time * 1.1 + p.phase * 2) * 10 * dt;
      }
      const out = p.x < view.x - margin || p.x > view.right + margin || p.y < view.y - margin || p.y > view.bottom + margin;
      // Lo que cae se detiene al tocar el suelo
      if (p.life >= p.max || out || (p.vy > 0 && this.world.isSolid(Math.floor(p.x / T), Math.floor(p.y / T)))) {
        p.dead = true;
        continue;
      }
      // Aparece y desaparece suave
      const t = p.life / p.max;
      let a = Math.min(1, t * 5, (1 - t) * 4) * (k.alpha ?? 1) * fade;
      if (k.blink) a *= 0.55 + 0.45 * Math.sin(this.time * 6 + p.phase * 5);
      if (a <= 0.01) continue;
      const s = p.size;
      if (k.glow) {
        gg.fillStyle(p.color, a * 0.22);
        gg.fillCircle(p.x, p.y, s * 2.4);
        gg.fillStyle(p.color, a);
        if (k.star) {
          // Destello en cruz
          const r = s * (1 + Math.sin(t * Math.PI) * 1.5);
          gg.fillRect(p.x - r, p.y - 0.75, r * 2, 1.5);
          gg.fillRect(p.x - 0.75, p.y - r, 1.5, r * 2);
        } else gg.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        g.fillStyle(p.color, a);
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    if (this.list.some((p) => p.dead)) this.list = this.list.filter((p) => !p.dead);
  }

  _spawn(name, k, view) {
    let x;
    let y;
    if (k.from === 'top') {
      // Nacen en cualquier altura (aparecen suave), así la pantalla se llena enseguida
      x = rand(view.x - 60, view.right + 60);
      y = rand(view.y - 20, view.bottom - 40);
    } else if (k.from === 'bottom') {
      x = rand(view.x, view.right);
      y = rand(view.y + 40, view.bottom + 10);
    } else if (k.from === 'side') {
      // El viento sopla desde la izquierda
      x = rand(view.x - 40, view.x + view.width * 0.6);
      y = rand(view.y, view.bottom);
    } else {
      x = rand(view.x, view.right);
      y = rand(view.y, view.bottom);
    }
    // No nacen dentro de los bloques
    if (this.world.isSolid(Math.floor(x / T), Math.floor(y / T))) return;
    this.list.push({
      def: k,
      x,
      y,
      vx: rand(k.vx[0], k.vx[1]),
      vy: rand(k.vy[0], k.vy[1]),
      life: 0,
      max: rand(k.life[0], k.life[1]),
      size: k.size * rand(0.7, 1.2),
      color: k.colors[Math.floor(Math.random() * k.colors.length)],
      phase: Math.random() * 10,
      dead: false,
    });
  }

  destroy() {
    this.gfx.destroy();
    this.glowGfx.destroy();
    this.list = [];
  }
}
