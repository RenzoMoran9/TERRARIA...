import Phaser from 'phaser';

/**
 * Habilidades que se desbloquean con puntos (1 por nivel).
 * level = nivel mínimo; cost = puntos; needs = habilidad previa; ranks = veces que se puede mejorar.
 * active = se usa con un botón o tecla (gasta energía). keys = cómo se usa en PC / celular.
 */
export const SKILLS = {
  // --- Movimiento ---
  sprint: {
    name: 'Correr',
    branch: 'move',
    level: 2,
    cost: 1,
    desc: 'Corres 60% más rápido mientras te alcance la energía',
    keys: 'PC: mantener Shift · Celular: joystick a fondo',
    active: true,
  },
  doubleJump: {
    name: 'Doble salto',
    branch: 'move',
    level: 3,
    cost: 1,
    needs: 'sprint',
    desc: 'Vuelve a saltar en el aire (una vez por salto)',
    keys: 'Saltar otra vez en el aire',
    active: true,
  },
  dash: {
    name: 'Embestida',
    branch: 'move',
    level: 5,
    cost: 2,
    needs: 'doubleJump',
    desc: 'Te lanzas hacia adelante: atraviesas a los enemigos haciéndoles daño y no te pegan mientras dura',
    keys: 'PC: Q · Celular: botón de embestida',
    active: true,
  },
  // --- Combate ---
  toughSkin: {
    name: 'Piel dura',
    branch: 'combat',
    level: 2,
    cost: 1,
    ranks: 3,
    desc: 'Cada golpe que recibes te quita 2 menos por nivel (defensa)',
  },
  fireball: {
    name: 'Bola de fuego',
    branch: 'combat',
    level: 4,
    cost: 2,
    desc: 'Lanzas una bola de fuego que explota y quema a los enemigos cercanos',
    keys: 'PC: F (apunta con el ratón) · Celular: botón de fuego (apunta sola)',
    active: true,
  },
  groundPound: {
    name: 'Golpe sísmico',
    branch: 'combat',
    level: 6,
    cost: 2,
    needs: 'doubleJump',
    desc: 'En el aire, caes en picada y al tocar el suelo una onda golpea y empuja a todos alrededor',
    keys: 'En el aire: abajo (S, flecha o joystick)',
    active: true,
  },
  // --- Supervivencia ---
  extraLife: {
    name: 'Vida extra',
    branch: 'survive',
    level: 2,
    cost: 1,
    ranks: 3,
    desc: '+20 de vida máxima por nivel',
  },
  regen: {
    name: 'Regeneración',
    branch: 'survive',
    level: 3,
    cost: 1,
    ranks: 2,
    desc: 'Recuperas vida el doble de rápido (y empiezas antes) por nivel',
  },
  magnet: {
    name: 'Imán',
    branch: 'survive',
    level: 2,
    cost: 1,
    desc: 'Los objetos vuelan hacia ti desde el doble de lejos',
  },
  fastMiner: {
    name: 'Minero veloz',
    branch: 'survive',
    level: 3,
    cost: 1,
    ranks: 2,
    desc: 'Minas y talas 30% más rápido por nivel',
  },
};

export const BRANCHES = [
  { id: 'move', name: 'Movimiento', color: 0x6fc3ff },
  { id: 'combat', name: 'Combate', color: 0xff8a6a },
  { id: 'survive', name: 'Supervivencia', color: 0x8ee07a },
];

/** Experiencia que da cada cosa */
export const XP = {
  zone: 50, // descubrir una zona
  house: 60, // primera vez que una casa queda válida
  craftNew: 5, // fabricar algo por primera vez
  tree: 2,
  ore: { coal: 2, iron_ore: 4, crystal: 6, shadow_stone: 3 }, // según lo que suelta el bloque
};

export const MAX_LEVEL = 30;
/** Experiencia para pasar del nivel L al L+1 */
export const xpForLevel = (L) => 40 + 30 * (L - 1) + 10 * (L - 1) * (L - 1);

export const ENERGY_MAX = 100;
export const MAX_LIFE_CRYSTALS = 15; // como Terraria: hasta +300 de vida

/**
 * Experiencia, nivel y habilidades del jugador (se guardan con la partida).
 * Eventos: 'xp' (cantidad), 'levelUp' (nivel), 'skills' (cambió algo).
 */
/**
 * Reliquias de los jefes: usarlas (una vez cada una) da experiencia, puntos de habilidad y una
 * mejora para siempre. Las repetidas se pueden vender al Comerciante.
 */
export const RELICS = {
  relic_crown: { boss: 'slime_king', xp: 400, points: 1, hp: 20, text: '+20 de vida máxima' },
  relic_stinger: { boss: 'scorpion_king', xp: 700, points: 1, defense: 2, text: '+2 de defensa' },
  relic_hive: { boss: 'queen_wasp', xp: 1000, points: 2, regen: 1, text: 'Recuperas vida más rápido' },
  relic_eye: { boss: 'shadow_eye', xp: 1500, points: 2, damage: 0.1, text: '+10% de daño' },
  relic_core: { boss: 'crystal_golem', xp: 2200, points: 2, hp: 40, text: '+40 de vida máxima' },
  relic_flame: { boss: 'flame_lord', xp: 3500, points: 3, defense: 4, damage: 0.15, text: '+4 de defensa y +15% de daño' },
};
const relicSum = (set, key) => [...set].reduce((a, id) => a + (RELICS[id]?.[key] || 0), 0);

export class Progression extends Phaser.Events.EventEmitter {
  constructor(saved) {
    super();
    this.level = 1;
    this.xp = 0; // experiencia dentro del nivel actual
    this.points = 0;
    this.ranks = {}; // habilidad → nivel aprendido
    this.crafted = new Set(); // ítems ya fabricados alguna vez (dan experiencia la primera vez)
    this.lifeCrystals = 0; // cristales de vida usados (+20 de vida máxima cada uno)
    this.relics = new Set(); // reliquias ya usadas
    if (saved && typeof saved === 'object') {
      this.level = Phaser.Math.Clamp(saved.level | 0 || 1, 1, MAX_LEVEL);
      this.xp = Math.max(0, saved.xp | 0);
      this.points = Math.max(0, saved.points | 0);
      for (const [id, r] of Object.entries(saved.ranks || {})) if (SKILLS[id]) this.ranks[id] = Math.min(r | 0, SKILLS[id].ranks || 1);
      for (const id of saved.crafted || []) this.crafted.add(id);
      this.lifeCrystals = Math.max(0, Math.min(MAX_LIFE_CRYSTALS, saved.lifeCrystals | 0));
      for (const id of saved.relics || []) if (RELICS[id]) this.relics.add(id);
    }
  }

  get xpNeeded() {
    return xpForLevel(this.level);
  }

  rank(id) {
    return this.ranks[id] || 0;
  }

  has(id) {
    return this.rank(id) > 0;
  }

  /** ¿Se puede aprender (o mejorar) ahora? Devuelve { ok, reason }. */
  canLearn(id) {
    const s = SKILLS[id];
    const r = this.rank(id);
    const max = s.ranks || 1;
    if (r >= max) return { ok: false, reason: r > 1 || max > 1 ? 'Nivel máximo' : 'Ya la tienes' };
    const needLevel = s.level + r * 2; // cada mejora pide 2 niveles más
    if (this.level < needLevel) return { ok: false, reason: `Requiere nivel ${needLevel}` };
    if (s.needs && !this.has(s.needs)) return { ok: false, reason: `Primero: ${SKILLS[s.needs].name}` };
    if (this.points < s.cost) return { ok: false, reason: `Cuesta ${s.cost} punto${s.cost > 1 ? 's' : ''}` };
    return { ok: true, reason: '' };
  }

  learn(id) {
    if (!this.canLearn(id).ok) return false;
    this.points -= SKILLS[id].cost;
    this.ranks[id] = this.rank(id) + 1;
    this.emit('skills', id);
    return true;
  }

  addXp(amount) {
    if (amount <= 0 || this.level >= MAX_LEVEL) return;
    this.xp += Math.round(amount);
    this.emit('xp', amount);
    while (this.level < MAX_LEVEL && this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.points++;
      this.emit('levelUp', this.level);
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
  }

  /** Usa una reliquia (una vez por tipo): puntos de habilidad y su mejora. La experiencia la da la escena. */
  useRelic(id) {
    if (!RELICS[id] || this.relics.has(id)) return false;
    this.relics.add(id);
    this.points += RELICS[id].points;
    this.emit('skills', id);
    return true;
  }

  /** Bonos de las pasivas (y de las reliquias usadas) */
  get maxHealthBonus() {
    return this.rank('extraLife') * 20 + this.lifeCrystals * 20 + relicSum(this.relics, 'hp');
  }

  get defense() {
    return this.rank('toughSkin') * 2 + relicSum(this.relics, 'defense');
  }

  get regenMultiplier() {
    return 1 + this.rank('regen') + relicSum(this.relics, 'regen');
  }

  /** Multiplicador del daño de las armas */
  get damageMultiplier() {
    return 1 + relicSum(this.relics, 'damage');
  }

  get mineMultiplier() {
    return 1 + 0.3 * this.rank('fastMiner');
  }

  get magnetMultiplier() {
    return this.has('magnet') ? 2 : 1;
  }

  serialize() {
    return { level: this.level, xp: this.xp, points: this.points, ranks: { ...this.ranks }, crafted: [...this.crafted], lifeCrystals: this.lifeCrystals, relics: [...this.relics] };
  }
}
