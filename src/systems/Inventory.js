import Phaser from 'phaser';
import { INVENTORY_SIZE, HOTBAR_SIZE } from '../config.js';
import { ITEMS, getMaxStack, ARMOR_SETS } from './items.js';

export const ARMOR_SLOTS = ['head', 'body', 'legs'];

// ---- Funciones sobre arrays de casillas (también se usan para simular el crafteo) ----

/** Agrega ítems: primero completa pilas existentes, luego usa casillas vacías. Devuelve lo que sobró. */
export function addToSlots(slots, id, count) {
  const max = getMaxStack(id);
  for (let i = 0; i < slots.length && count > 0; i++) {
    const s = slots[i];
    if (s && s.id === id && s.count < max) {
      const n = Math.min(max - s.count, count);
      s.count += n;
      count -= n;
    }
  }
  for (let i = 0; i < slots.length && count > 0; i++) {
    if (!slots[i]) {
      const n = Math.min(max, count);
      slots[i] = { id, count: n };
      count -= n;
    }
  }
  return count;
}

/** Quita ítems empezando por el final (así se conserva la barra rápida). Devuelve lo que faltó. */
export function removeFromSlots(slots, id, count) {
  for (let i = slots.length - 1; i >= 0 && count > 0; i--) {
    const s = slots[i];
    if (s && s.id === id) {
      const n = Math.min(s.count, count);
      s.count -= n;
      count -= n;
      if (s.count <= 0) slots[i] = null;
    }
  }
  return count;
}

export function countEmpty(slots) {
  let n = 0;
  for (const s of slots) if (!s) n++;
  return n;
}

export function cloneSlots(slots) {
  return slots.map((s) => (s ? { id: s.id, count: s.count } : null));
}

/**
 * Inventario de 36 casillas: las 9 primeras son la barra rápida.
 * 'held' es la pila que el jugador lleva "en el cursor" con el inventario abierto.
 * Eventos: 'change' (contenido) y 'select' (casilla seleccionada).
 */
export class Inventory extends Phaser.Events.EventEmitter {
  constructor(size = INVENTORY_SIZE) {
    super();
    this.slots = new Array(size).fill(null);
    this.selected = 0;
    this.held = null;
    this.trash = null; // última pila tirada a la basura (se puede recuperar hasta tirar otra)
    this.armor = [null, null, null]; // casco, pechera, grebas
  }

  /**
   * Casilla de armadura (0 casco, 1 pechera, 2 grebas): con una pieza que va ahí en el cursor, se la pone
   * (y la que estaba pasa al cursor); sin nada en el cursor, se la saca.
   */
  clickArmor(index) {
    const held = this.held;
    if (held) {
      const a = ITEMS[held.id].armor;
      if (!a || ARMOR_SLOTS[index] !== a.slot) return false;
      this.held = this.armor[index];
      this.armor[index] = { id: held.id, count: 1 };
    } else if (this.armor[index]) {
      this.held = this.armor[index];
      this.armor[index] = null;
    } else return false;
    this.emit('change');
    this.emit('armor');
    return true;
  }

  /** Ponerse una pieza directo desde una casilla (tocar la armadura con nada en el cursor la equipa). */
  equipFromSlot(index) {
    const s = this.slots[index];
    const a = s && ITEMS[s.id].armor;
    if (!a) return false;
    const k = ARMOR_SLOTS.indexOf(a.slot);
    this.slots[index] = this.armor[k];
    this.armor[k] = { id: s.id, count: 1 };
    this.emit('change');
    this.emit('armor');
    return true;
  }

  /** Defensa total de la armadura (+ bonus si las 3 piezas son del mismo juego). */
  get defense() {
    let d = 0;
    const sets = new Set();
    for (const a of this.armor) {
      if (!a) {
        sets.add(null);
        continue;
      }
      const def = ITEMS[a.id].armor;
      d += def.defense;
      sets.add(def.set);
    }
    const full = sets.size === 1 && !sets.has(null) ? [...sets][0] : null;
    return d + (full ? ARMOR_SETS[full].bonus : 0);
  }

  /** Juego completo puesto (o null). */
  get fullSet() {
    const sets = new Set(this.armor.map((a) => (a ? ITEMS[a.id].armor.set : null)));
    return sets.size === 1 && !sets.has(null) ? [...sets][0] : null;
  }

  /** Casilla de basura: con algo en el cursor, lo borra; sin nada, recupera lo último que se tiró. */
  clickTrash() {
    if (this.held) {
      this.trash = this.held;
      this.held = null;
    } else if (this.trash) {
      this.held = this.trash;
      this.trash = null;
    }
    this.emit('change');
  }

  /** Saca y devuelve lo que se lleva en el cursor (para tirarlo al suelo). */
  takeHeld() {
    const h = this.held;
    this.held = null;
    if (h) this.emit('change');
    return h;
  }

  /** Saca y devuelve la pila de una casilla. */
  takeSlot(index) {
    const s = this.slots[index];
    this.slots[index] = null;
    if (s) this.emit('change');
    return s;
  }

  get selectedStack() {
    return this.slots[this.selected];
  }

  select(index) {
    const i = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (i === this.selected) return;
    this.selected = i;
    this.emit('select', i);
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** ¿Caben estos ítems? reserveEmpty = casillas que deben quedar libres. */
  canAdd(id, count, reserveEmpty = 0) {
    const copy = cloneSlots(this.slots);
    return addToSlots(copy, id, count) === 0 && countEmpty(copy) >= reserveEmpty;
  }

  /** Agrega ítems; devuelve la cantidad que no cupo. */
  add(id, count) {
    const left = addToSlots(this.slots, id, count);
    if (left !== count) this.emit('change');
    return left;
  }

  remove(id, count) {
    if (this.count(id) < count) return false;
    removeFromSlots(this.slots, id, count);
    this.emit('change');
    return true;
  }

  removeFromSlot(index, count = 1) {
    const s = this.slots[index];
    if (!s) return;
    s.count -= count;
    if (s.count <= 0) this.slots[index] = null;
    this.emit('change');
  }

  /** Reemplaza todo el contenido (usado al craftear). */
  setSlots(newSlots) {
    for (let i = 0; i < this.slots.length; i++) this.slots[i] = newSlots[i] || null;
    this.emit('change');
  }

  /**
   * Clic sobre una casilla con el inventario abierto.
   * half=true (clic derecho): toma la mitad / deja de a uno.
   */
  clickSlot(index, half = false) {
    const slot = this.slots[index];
    const held = this.held;

    if (!held) {
      if (!slot) return;
      if (half && slot.count > 1) {
        const take = Math.ceil(slot.count / 2);
        slot.count -= take;
        this.held = { id: slot.id, count: take };
      } else {
        this.held = slot;
        this.slots[index] = null;
      }
    } else if (!slot) {
      if (half) {
        this.slots[index] = { id: held.id, count: 1 };
        held.count -= 1;
        if (held.count <= 0) this.held = null;
      } else {
        this.slots[index] = held;
        this.held = null;
      }
    } else if (slot.id === held.id) {
      const space = getMaxStack(slot.id) - slot.count;
      const n = Math.min(space, half ? 1 : held.count);
      slot.count += n;
      held.count -= n;
      if (held.count <= 0) this.held = null;
    } else {
      // Intercambiar
      this.slots[index] = held;
      this.held = slot;
    }
    this.emit('change');
  }

  /** Devuelve al inventario lo que se llevaba en el cursor (al cerrar el inventario). */
  returnHeld() {
    if (!this.held) return;
    const left = addToSlots(this.slots, this.held.id, this.held.count);
    this.held = left > 0 ? { id: this.held.id, count: left } : null;
    this.emit('change');
  }

  serialize() {
    const slots = cloneSlots(this.slots);
    if (this.held) addToSlots(slots, this.held.id, this.held.count);
    return { selected: this.selected, slots: slots.map((s) => (s ? [s.id, s.count] : null)), armor: this.armor.map((a) => (a ? a.id : null)) };
  }

  deserialize(data) {
    if (!data || !Array.isArray(data.slots)) return;
    for (let i = 0; i < this.slots.length; i++) {
      const s = data.slots[i];
      if (Array.isArray(s) && ITEMS[s[0]] && s[1] > 0) {
        this.slots[i] = { id: s[0], count: Math.min(Math.floor(s[1]), getMaxStack(s[0])) };
      } else {
        this.slots[i] = null;
      }
    }
    this.selected = Math.max(0, Math.min(HOTBAR_SIZE - 1, data.selected | 0));
    if (Array.isArray(data.armor)) {
      this.armor = ARMOR_SLOTS.map((slot, i) => {
        const id = data.armor[i];
        return id && ITEMS[id] && ITEMS[id].armor && ITEMS[id].armor.slot === slot ? { id, count: 1 } : null;
      });
    }
    this.emit('change');
    this.emit('armor');
  }
}
