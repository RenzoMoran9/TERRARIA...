import { textStyle, COLORS } from './styles.js';
import { createButton } from './Button.js';
import { ITEMS, formatCoins, itemValue } from '../systems/items.js';
import { NPC_TYPES, GUIDE_TIPS } from '../systems/Npcs.js';
import { audio } from '../systems/Audio.js';

const W = 560;
const H = 360;
const PAD = 14;
const SLOT = 44;
const GAP = 5;

/** Lo que vende el Comerciante: [ítem, cantidad por compra, precio en cobre] */
export const SHOP = [
  ['healing_potion', 1, 200],
  ['torch', 5, 25],
  ['wood_arrow', 20, 30],
  ['wood_platform', 20, 15],
  ['glass', 10, 40],
  ['coal', 5, 35],
  ['iron_bar', 1, 60],
  ['chest', 1, 150],
  ['bed', 1, 250],
  ['iron_pickaxe', 1, 1200],
  ['wood_bow', 1, 200],
  ['throwing_knife', 15, 120],
  ['wood_boomerang', 1, 180],
];

/**
 * Ventana para hablar con un aldeano: lo que dice y sus servicios
 * (Guía: consejos · Comerciante: comprar y vender · Enfermera: curar).
 */
export class NpcDialog {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.isOpen = false;
    this.npc = null;
    this.mode = 'talk'; // talk | buy | sell
    this.tipIndex = Math.floor(Math.random() * GUIDE_TIPS.length);

    this.blocker = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.3).setOrigin(0).setDepth(33).setVisible(false);
    this.blocker.setInteractive().on('pointerdown', () => scene.closeNpcDialog());
    this.container = scene.add.container(0, 0).setDepth(34).setVisible(false);
    this.bg = scene.add.rectangle(0, 0, W, H, COLORS.panel, 0.96).setOrigin(0).setStrokeStyle(2, COLORS.panelBorder).setInteractive();
    this.portrait = scene.add.image(PAD + 30, PAD + 34, 'npc_guide', 5).setDisplaySize(60, 80);
    this.name = scene.add.text(PAD + 72, PAD, '', textStyle({ fontSize: '20px', color: '#ffe28a' }));
    this.text = scene.add.text(PAD + 72, PAD + 28, '', textStyle({ fontSize: '14px', wordWrap: { width: W - PAD * 2 - 72 }, lineSpacing: 3 }));
    this.coinsText = scene.add.text(W - PAD, H - PAD - 46, '', textStyle({ fontSize: '13px', color: '#ffd84a' })).setOrigin(1, 1);
    const close = createButton(scene, W - 22, 22, 28, 28, 'X', () => scene.closeNpcDialog(), { fontSize: '16px' });
    this.container.add([this.bg, this.portrait, this.name, this.text, this.coinsText, close]);

    // Botones de abajo (cambian según el aldeano)
    this.buttons = [];
    // Tienda: casillas con ítems
    this.slots = [];
    for (let i = 0; i < 36; i++) {
      const col = i % 9;
      const row = Math.floor(i / 9);
      const x = PAD + col * (SLOT + GAP);
      const y = 110 + row * (SLOT + GAP);
      const box = scene.add.rectangle(x, y, SLOT, SLOT, 0x262c5a, 0.95).setOrigin(0).setStrokeStyle(2, 0x3a4380).setInteractive({ useHandCursor: true });
      const icon = scene.add.image(x + SLOT / 2, y + SLOT / 2 - 4, 'ui_slot').setVisible(false);
      const count = scene.add.text(x + SLOT - 3, y + 2, '', textStyle({ fontSize: '11px', strokeThickness: 2 })).setOrigin(1, 0);
      const price = scene.add.text(x + SLOT / 2, y + SLOT - 1, '', textStyle({ fontSize: '10px', color: '#ffd84a', strokeThickness: 2 })).setOrigin(0.5, 1);
      this.container.add([box, icon, count, price]);
      const slot = { box, icon, count, price, entry: null };
      scene.tooltip.attach(box, () => slot.entry?.id, () => this._slotTap(slot));
      this.slots.push(slot);
    }
  }

  layout(width, height) {
    this.blocker.setSize(width, height);
    if (this.blocker.input) this.blocker.input.hitArea.setSize(width, height);
    const s = Math.min(1, (width - 16) / W, (height - 16) / H);
    this.scale = s;
    this.container.setScale(s).setPosition(Math.round((width - W * s) / 2), Math.round((height - H * s) / 2));
  }

  open(npc) {
    this.npc = npc;
    this.isOpen = true;
    this.mode = 'talk';
    npc.faceTalk(this.gs.player.centerX);
    audio.play('open');
    this.blocker.setVisible(true);
    this.container.setVisible(true);
    const def = NPC_TYPES[npc.type];
    this.portrait.setTexture(def.texture, 5).setDisplaySize(60, 80);
    this.name.setText(def.name);
    const lines = def.greet;
    this.say(npc.type === 'guide' ? `${lines[Math.floor(Math.random() * lines.length)]}\n\nConsejo: ${this.nextTip()}` : lines[Math.floor(Math.random() * lines.length)]);
    this.refresh();
  }

  close() {
    this.isOpen = false;
    this.npc = null;
    this.blocker.setVisible(false);
    this.container.setVisible(false);
    this.scene.tooltip.hide();
  }

  say(text) {
    this.text.setText(text);
  }

  nextTip() {
    const tip = GUIDE_TIPS[this.tipIndex % GUIDE_TIPS.length];
    this.tipIndex++;
    return tip;
  }

  _setButtons(defs) {
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    const bw = 150;
    defs.forEach(([label, fn], i) => {
      const b = createButton(this.scene, PAD + bw / 2 + i * (bw + 10), H - PAD - 18, bw, 36, label, fn, { fontSize: '15px' });
      this.container.add(b);
      this.buttons.push(b);
    });
  }

  refresh() {
    if (!this.isOpen) return;
    const gs = this.gs;
    this.coinsText.setText(`Tus monedas: ${formatCoins(gs.coins)}`);
    const type = this.npc.type;
    const shop = this.mode === 'buy' || this.mode === 'sell';
    this.portrait.setVisible(!shop);
    this.text.setPosition(shop ? PAD : PAD + 72, shop ? PAD + 30 : PAD + 28);
    this.text.setWordWrapWidth(shop ? W - PAD * 2 : W - PAD * 2 - 72);
    if (type === 'guide') {
      this._setButtons([
        ['Otro consejo', () => this.say(`Consejo: ${this.nextTip()}`)],
        ['¿Quién vendrá?', () => this.say(this._whoComes())],
      ]);
    } else if (type === 'merchant') {
      this._setButtons([
        ['Comprar', () => this._setMode('buy')],
        ['Vender', () => this._setMode('sell')],
        ['Hablar', () => this._setMode('talk')],
      ]);
    } else if (type === 'nurse') {
      const p = gs.player;
      const missing = Math.ceil(p.maxHealth - p.health);
      const cost = this.healCost();
      this._setButtons([[missing > 0 ? `Curar (${formatCoins(cost)})` : 'Curar', () => this._heal()]]);
    }
    // Casillas de la tienda
    let entries = [];
    if (this.mode === 'buy') entries = SHOP.map(([id, n, price]) => ({ id, n, price }));
    if (this.mode === 'sell') {
      entries = gs.inventory.slots
        .map((s, i) => (s ? { id: s.id, n: s.count, price: Math.max(1, Math.floor(itemValue(s.id) / 5)), slot: i } : null))
        .filter(Boolean);
    }
    this.slots.forEach((sl, i) => {
      const e = entries[i] || null;
      sl.entry = e;
      const show = shop && i < (this.mode === 'buy' ? SHOP.length : 36);
      sl.box.setVisible(show);
      sl.icon.setVisible(show && !!e);
      sl.count.setVisible(show && !!e);
      sl.price.setVisible(show && !!e);
      if (!show || !e) return;
      sl.icon.setTexture(ITEMS[e.id].icon).setDisplaySize(26, 26);
      sl.count.setText(e.n > 1 ? `${e.n}` : '');
      sl.price.setText(formatCoins(e.price).replace(' cobre', 'c').replace(' plata', 'p').replace(' oro', 'o'));
      const affordable = this.mode === 'sell' || gs.coins >= e.price;
      sl.box.setFillStyle(affordable ? 0x2f4a7a : 0x262c5a, 0.95);
    });
  }

  _setMode(mode) {
    this.mode = mode;
    if (mode === 'buy') this.say('Toca algo para comprarlo (el precio está abajo de cada cosa).');
    else if (mode === 'sell') this.say('Toca algo de tu inventario para venderlo (de a uno). Te pago una quinta parte de lo que vale.');
    else this.say(NPC_TYPES.merchant.greet[Math.floor(Math.random() * NPC_TYPES.merchant.greet.length)]);
    this.refresh();
  }

  _slotTap(slot) {
    const e = slot.entry;
    if (!e) return;
    const gs = this.gs;
    if (this.mode === 'buy') {
      if (gs.coins < e.price) {
        this.say(`Te faltan ${formatCoins(e.price - gs.coins)} para comprar ${ITEMS[e.id].name}.`);
        audio.play('click');
        return;
      }
      if (!gs.inventory.canAdd(e.id, e.n)) {
        this.say('No te entra en el inventario.');
        return;
      }
      gs.coins -= e.price;
      gs.inventory.add(e.id, e.n);
      audio.play('pickup');
      this.say(`Compraste ${ITEMS[e.id].name}${e.n > 1 ? ` ×${e.n}` : ''}. ¡Gracias!`);
    } else if (this.mode === 'sell') {
      const s = gs.inventory.slots[e.slot];
      if (!s) return;
      gs.inventory.removeFromSlot(e.slot, 1);
      gs.coins += e.price;
      audio.play('pickup');
      this.say(`Vendiste 1 ${ITEMS[e.id].name} por ${formatCoins(e.price)}.`);
    }
    this.refresh();
  }

  healCost() {
    const p = this.gs.player;
    return Math.ceil(Math.max(0, p.maxHealth - p.health)) * 2;
  }

  _heal() {
    const gs = this.gs;
    const p = gs.player;
    const missing = p.maxHealth - p.health;
    if (missing < 1) {
      this.say('Estás perfecto. No hace falta curarte.');
      return;
    }
    const cost = this.healCost();
    if (gs.coins < cost) {
      this.say(`Curarte cuesta ${formatCoins(cost)} y tienes ${formatCoins(gs.coins)}.`);
      return;
    }
    gs.coins -= cost;
    p.health = p.maxHealth;
    gs.spawnSparkles(p.centerX, p.centerY, 18, 0x9cff9c);
    audio.play('learn');
    this.say('¡Listo! Como nuevo. Trata de no volver tan seguido.');
    this.refresh();
  }

  _whoComes() {
    const n = this.gs.npcs;
    const out = [];
    if (!n.has('merchant')) out.push(`Comerciante: ${NPC_TYPES.merchant.arriveText}.`);
    if (!n.has('nurse')) out.push(`Enfermera: ${NPC_TYPES.nurse.arriveText}.`);
    if (!out.length) return 'Ya llegaron todos los aldeanos que conozco. ¡Buen trabajo!';
    const free = n.freeRooms().length;
    return `${out.join('\n')}\n\nCasas válidas libres ahora: ${free}.`;
  }
}
