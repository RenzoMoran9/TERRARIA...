import { HOTBAR_SIZE } from '../config.js';
import { ITEMS } from '../systems/items.js';
import { textStyle } from './styles.js';

const SLOT = 44;
const GAP = 4;
const ICON = 30;
export const HOTBAR_WIDTH = HOTBAR_SIZE * (SLOT + GAP) - GAP;
export const HOTBAR_HEIGHT = SLOT;

/** Barra rápida de 9 casillas (teclas 1-9, rueda del ratón o tocar la casilla). */
export class Hotbar {
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    this.container = scene.add.container(0, 0).setDepth(10);
    this.slots = [];

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = i * (SLOT + GAP);
      const bg = scene.add.image(x, 0, 'ui_slot').setOrigin(0).setDisplaySize(SLOT, SLOT).setInteractive();
      bg.on('pointerdown', () => inventory.select(i));
      const icon = scene.add.image(x + SLOT / 2, SLOT / 2, 'ui_slot').setVisible(false);
      const count = scene.add.text(x + SLOT - 3, SLOT - 1, '', textStyle({ fontSize: '13px' })).setOrigin(1, 1);
      const num = scene.add.text(x + 4, 2, String(i + 1), textStyle({ fontSize: '10px', strokeThickness: 2, color: '#d0d0e0' }));
      this.container.add([bg, icon, count, num]);
      this.slots.push({ bg, icon, count });
    }

    // Nombre del ítem seleccionado (aparece un momento al cambiar de casilla)
    this.nameText = scene.add.text(0, 0, '', textStyle({ fontSize: '14px' })).setOrigin(0.5, 0).setDepth(10).setAlpha(0);
    this.nameTween = null;

    inventory.on('change', this.refresh, this);
    inventory.on('select', this.onSelect, this);
    this.refresh();
  }

  layout(x, y, scale) {
    this.container.setPosition(x, y).setScale(scale);
    this.nameText.setPosition(x + (HOTBAR_WIDTH * scale) / 2, y + SLOT * scale + 4);
    this.bottom = y + SLOT * scale;
  }

  setVisible(visible) {
    this.container.setVisible(visible);
    this.nameText.setVisible(visible);
  }

  onSelect() {
    this.refresh();
    const stack = this.inventory.selectedStack;
    this.nameText.setText(stack ? ITEMS[stack.id].name : '').setAlpha(1);
    if (this.nameTween) this.nameTween.stop();
    this.nameTween = this.scene.tweens.add({ targets: this.nameText, alpha: 0, delay: 1200, duration: 400 });
  }

  refresh() {
    const inv = this.inventory;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const view = this.slots[i];
      const stack = inv.slots[i];
      view.bg.setTexture(i === inv.selected ? 'ui_slot_selected' : 'ui_slot').setDisplaySize(SLOT, SLOT);
      if (stack) {
        view.icon.setTexture(ITEMS[stack.id].icon).setDisplaySize(ICON, ICON).setVisible(true);
        view.count.setText(stack.count > 1 ? String(stack.count) : '');
      } else {
        view.icon.setVisible(false);
        view.count.setText('');
      }
    }
  }

  destroy() {
    this.inventory.off('change', this.refresh, this);
    this.inventory.off('select', this.onSelect, this);
  }
}
