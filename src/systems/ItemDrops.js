import { TILE_SIZE, DEPTH } from '../config.js';
import { ITEMS } from './items.js';

const T = TILE_SIZE;
const SIZE = 18; // tamaño del ícono en el suelo
const GRAVITY = 1100;
const MAGNET = 6 * T; // a esta distancia (algo más que el alcance para minar) los objetos vuelan hacia el jugador
const PICKUP = 20; // ...y a esta se recogen
const PICK_DELAY = 0.45; // segundos antes de poder recogerlo (para ver cómo salta)
const LIFETIME = 300; // los objetos olvidados desaparecen a los 5 minutos
const MERGE = 26; // objetos iguales tan cerca se juntan en una pila

/**
 * Objetos tirados en el mundo (como en Terraria): al romper un bloque, talar, matar un
 * enemigo o quitar un mueble, lo obtenido salta al suelo y se recoge al pasar cerca.
 * Si el inventario está lleno, el objeto se queda en el suelo esperando.
 */
export class ItemDrops {
  constructor(scene, world, player, inventory) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.list = [];
    this._picked = new Map(); // lo recogido en este frame (un solo texto por ítem)
  }

  /** Tira `count` de `id` en (x, y). pop = salta un poco hacia arriba. */
  spawn(id, count, x, y, pop = true) {
    if (!ITEMS[id] || count <= 0) return null;
    // Se junta con una pila igual que ya está en el suelo al lado
    for (const d of this.list) {
      if (d.id === id && !d.dead && Math.abs(d.x - x) < MERGE && Math.abs(d.y - y) < MERGE) {
        d.count += count;
        return d;
      }
    }
    const sprite = this.scene.add.image(x, y, ITEMS[id].icon).setDisplaySize(SIZE, SIZE).setDepth(DEPTH.ENEMY - 0.5);
    const d = {
      id,
      count,
      x,
      y,
      vx: pop ? (Math.random() - 0.5) * 120 : 0,
      vy: pop ? -180 - Math.random() * 120 : 0,
      age: 0,
      onGround: false,
      sprite,
      dead: false,
    };
    this.list.push(d);
    return d;
  }

  update(dt) {
    const p = this.player;
    const px = p.centerX;
    const py = p.centerY;
    for (const d of this.list) {
      d.age += dt;
      if (d.age > LIFETIME) {
        d.dead = true;
        continue;
      }
      const dx = px - d.x;
      const dy = py - d.y;
      const dist = Math.hypot(dx, dy);
      const canTake = !p.dead && d.age > PICK_DELAY && this.inventory.canAdd(d.id, 1);
      const magnet = MAGNET * (this.scene.progress?.magnetMultiplier ?? 1); // habilidad Imán: el doble
      if (canTake && dist < magnet) {
        // Vuela hacia el jugador (atraviesa los bloques, como en Terraria)
        const speed = 220 + (1 - dist / magnet) * 380;
        d.vx = (dx / (dist || 1)) * speed;
        d.vy = (dy / (dist || 1)) * speed;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.onGround = false;
        if (dist < PICKUP) this._pickUp(d);
      } else {
        this._fall(d, dt);
      }
      // Flota suavemente cuando está quieto en el suelo
      const bob = d.onGround ? Math.sin(d.age * 3 + d.x) * 2 : 0;
      d.sprite.setPosition(d.x, d.y - SIZE / 2 + bob);
    }
    if (this._picked.size) {
      let k = 0;
      for (const [id, n] of this._picked) {
        this.scene.showFloatingText(px + (Math.random() - 0.5) * 12, p.y - 10 - k * 14, `+${n} ${ITEMS[id].name}`, '#ffffff', 13);
        k++;
      }
      this._picked.clear();
    }
    if (this.list.some((d) => d.dead)) {
      for (const d of this.list) if (d.dead) d.sprite.destroy();
      this.list = this.list.filter((d) => !d.dead);
    }
  }

  /** Cae y se apoya sobre los bloques (d.y = base del objeto). */
  _fall(d, dt) {
    d.vy = Math.min(d.vy + GRAVITY * dt, 700);
    const nx = d.x + d.vx * dt;
    if (!this.world.isSolid(Math.floor(nx / T), Math.floor((d.y - 4) / T))) d.x = nx;
    else d.vx = 0;
    const ny = d.y + d.vy * dt;
    const tx = Math.floor(d.x / T);
    const row = Math.floor(ny / T);
    const platform = this.world.isPlatform(tx, row) && d.y <= row * T + 0.01; // cae sobre una plataforma
    if (d.vy >= 0 && (this.world.isSolid(tx, row) || platform)) {
      d.y = Math.floor(ny / T) * T;
      d.vy = 0;
      d.vx *= 0.6;
      d.onGround = true;
    } else {
      d.y = ny;
      d.onGround = false;
    }
    // Quedó adentro de un bloque (se colocó algo encima): sube
    if (this.world.isSolid(tx, Math.floor((d.y - 4) / T))) d.y = Math.floor((d.y - 4) / T) * T;
  }

  _pickUp(d) {
    const left = this.inventory.add(d.id, d.count);
    const got = d.count - left;
    if (got > 0) this._picked.set(d.id, (this._picked.get(d.id) || 0) + got);
    d.count = left;
    if (left <= 0) d.dead = true;
  }

  /** Para el guardado: [id, cantidad, x, y] de cada objeto en el suelo. */
  serialize() {
    return this.list.filter((d) => !d.dead).map((d) => [d.id, d.count, Math.round(d.x), Math.round(d.y)]);
  }

  restore(saved) {
    for (const s of saved || []) {
      if (Array.isArray(s) && ITEMS[s[0]] && s[1] > 0) this.spawn(s[0], s[1], s[2], s[3], false);
    }
  }

  destroy() {
    for (const d of this.list) d.sprite.destroy();
    this.list = [];
  }
}
