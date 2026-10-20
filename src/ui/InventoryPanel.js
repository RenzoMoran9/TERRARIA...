import { INVENTORY_SIZE, HOTBAR_SIZE } from '../config.js';
import { ITEMS } from '../systems/items.js';
import { RECIPES, canCraft, craft, describeIngredients, STATION_NAMES } from '../systems/Crafting.js';
import { createButton } from './Button.js';
import { COLORS, textStyle } from './styles.js';

// Medidas del panel sin escalar (luego se escala para que quepa en pantallas pequeñas)
const SLOT = 44;
const GAP = 4;
const PAD = 14;
const ICON = 30;
const GRID_Y = 42;
const GRID_W = HOTBAR_SIZE * (SLOT + GAP) - GAP;
const CRAFT_X = PAD + GRID_W + PAD;
const CRAFT_W = 270;
const ROW_H = 40;
const ROW_GAP = 6;
const PANEL_W = CRAFT_X + CRAFT_W + PAD;
const PANEL_H = 300;

/** Inventario completo (tecla E) con la lista de crafteo al costado. */
export class InventoryPanel {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.inv = gameScene.inventory;
    this.isOpen = false;
    this.scale = 1;
    this.craftTimer = 0;
    this.lastStationState = null;

    // Fondo oscuro de pantalla completa: tocar fuera del panel lo cierra
    this.blocker = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.35).setOrigin(0).setDepth(29).setVisible(false);
    this.blocker.setInteractive().on('pointerdown', () => scene.toggleInventory(false));

    this.container = scene.add.container(0, 0).setDepth(30).setVisible(false);
    const bg = scene.add
      .rectangle(0, 0, PANEL_W, PANEL_H, COLORS.panel, 0.95)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setInteractive(); // absorbe los clics dentro del panel
    this.container.add(bg);
    this.container.add(scene.add.text(PAD, PAD - 2, 'Inventario', textStyle({ fontSize: '18px' })));
    this.container.add(scene.add.text(CRAFT_X, PAD - 2, 'Crafteo', textStyle({ fontSize: '18px' })));

    // Botón cerrar
    const close = createButton(scene, PANEL_W - 22, 20, 28, 28, 'X', () => scene.toggleInventory(false), { fontSize: '16px' });
    this.container.add(close);

    this._buildSlots();
    this._buildRecipes();

    // Botones inferiores
    const footY = PANEL_H - PAD - 16;
    this.container.add(
      createButton(scene, PAD + 55, footY, 110, 32, 'Guardar', () => this.gs.saveGame(true), { fontSize: '15px' }),
    );
    this.container.add(
      createButton(scene, PAD + 125 + 75, footY, 150, 32, 'Menú principal', () => this.gs.backToMenu(), { fontSize: '15px' }),
    );

    // Ítem que se lleva en el cursor
    this.heldIcon = scene.add.image(0, 0, 'ui_slot').setDepth(50).setVisible(false);
    this.heldCount = scene.add.text(0, 0, '', textStyle({ fontSize: '13px' })).setOrigin(1, 1).setDepth(50);

    this.inv.on('change', this.refresh, this);
    this.inv.on('select', this.refresh, this);
  }

  _buildSlots() {
    const scene = this.scene;
    this.slotViews = [];
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const col = i % HOTBAR_SIZE;
      const row = Math.floor(i / HOTBAR_SIZE);
      const x = PAD + col * (SLOT + GAP);
      // La primera fila (barra rápida) va separada del resto
      const y = GRID_Y + row * (SLOT + GAP) + (row > 0 ? 8 : 0);
      const bg = scene.add.image(x, y, 'ui_slot').setOrigin(0).setDisplaySize(SLOT, SLOT).setInteractive();
      bg.on('pointerdown', (pointer) => this.inv.clickSlot(i, pointer.rightButtonDown()));
      const icon = scene.add.image(x + SLOT / 2, y + SLOT / 2, 'ui_slot').setVisible(false);
      const count = scene.add.text(x + SLOT - 3, y + SLOT - 1, '', textStyle({ fontSize: '13px' })).setOrigin(1, 1);
      this.container.add([bg, icon, count]);
      this.slotViews.push({ bg, icon, count });
    }
  }

  _buildRecipes() {
    const scene = this.scene;
    this.stationText = scene.add.text(CRAFT_X, 34, '', textStyle({ fontSize: '12px', color: '#c8c8d8' }));
    this.container.add(this.stationText);
    this.rows = RECIPES.map((recipe, i) => {
      const y = 56 + i * (ROW_H + ROW_GAP);
      const bg = scene.add
        .rectangle(CRAFT_X, y, CRAFT_W, ROW_H, COLORS.notCraftable, 0.9)
        .setOrigin(0)
        .setStrokeStyle(1, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.craft(recipe));
      const item = ITEMS[recipe.result];
      const icon = scene.add.image(CRAFT_X + 20, y + ROW_H / 2, item.icon).setDisplaySize(28, 28);
      const name = scene.add.text(CRAFT_X + 40, y + 3, `${item.name} ×${recipe.count}`, textStyle({ fontSize: '14px' }));
      const ingredients = scene.add.text(CRAFT_X + 40, y + 21, describeIngredients(recipe), textStyle({ fontSize: '11px', strokeThickness: 2, color: '#d8d8d8' }));
      const tag = scene.add
        .text(CRAFT_X + CRAFT_W - 6, y + 4, recipe.station ? 'Mesa' : '', textStyle({ fontSize: '10px', strokeThickness: 2, color: '#ffd54f' }))
        .setOrigin(1, 0);
      this.container.add([bg, icon, name, ingredients, tag]);
      return { recipe, bg, icon, name, ingredients, craftable: null };
    });
  }

  layout(width, height) {
    this.blocker.setSize(width, height);
    if (this.blocker.input) this.blocker.input.hitArea.setSize(width, height);
    this.scale = Math.min(1, (width - 16) / PANEL_W, (height - 16) / PANEL_H);
    this.container
      .setScale(this.scale)
      .setPosition(Math.round((width - PANEL_W * this.scale) / 2), Math.round((height - PANEL_H * this.scale) / 2));
    const iconSize = ICON * this.scale * 1.1;
    this.heldIconSize = iconSize;
  }

  open() {
    this.isOpen = true;
    this.blocker.setVisible(true);
    this.container.setVisible(true);
    this.refresh();
    this.refreshCrafting(true);
  }

  close() {
    this.isOpen = false;
    this.inv.returnHeld();
    this.blocker.setVisible(false);
    this.container.setVisible(false);
    this.heldIcon.setVisible(false);
    this.heldCount.setText('');
  }

  craft(recipe) {
    const result = craft(this.inv, recipe, this.gs.getStations());
    this.gs.events.emit('toast', result.message);
    this.refreshCrafting(true);
  }

  refresh() {
    if (!this.isOpen) return;
    const inv = this.inv;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const view = this.slotViews[i];
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
    const held = inv.held;
    if (held) {
      this.heldIcon.setTexture(ITEMS[held.id].icon).setDisplaySize(this.heldIconSize, this.heldIconSize).setVisible(true);
      this.heldCount.setText(held.count > 1 ? String(held.count) : '');
    } else {
      this.heldIcon.setVisible(false);
      this.heldCount.setText('');
    }
    this.refreshCrafting(true);
  }

  /** Colorea las recetas según si se pueden craftear ahora. */
  refreshCrafting(force = false) {
    const stations = this.gs.getStations();
    const stationState = stations.workbench;
    if (force || stationState !== this.lastStationState) {
      this.lastStationState = stationState;
      this.stationText.setText(
        stationState ? `${STATION_NAMES.workbench} cerca: Sí` : `${STATION_NAMES.workbench} cerca: No`,
      );
    }
    for (const row of this.rows) {
      const ok = canCraft(this.inv, row.recipe, stations);
      if (force || ok !== row.craftable) {
        row.craftable = ok;
        row.bg.setFillStyle(ok ? COLORS.craftable : COLORS.notCraftable, 0.9);
        row.icon.setAlpha(ok ? 1 : 0.5);
        row.name.setAlpha(ok ? 1 : 0.6);
      }
    }
  }

  update(delta) {
    if (!this.isOpen) return;
    // El ítem del cursor sigue al puntero (ratón o dedo)
    if (this.inv.held) {
      const p = this.scene.input.activePointer;
      this.heldIcon.setPosition(p.x, p.y);
      this.heldCount.setPosition(p.x + this.heldIconSize / 2 + 2, p.y + this.heldIconSize / 2 + 2);
    }
    // Revisar cada tanto si el jugador se acercó/alejó de la mesa
    this.craftTimer -= delta;
    if (this.craftTimer <= 0) {
      this.craftTimer = 300;
      this.refreshCrafting(false);
    }
  }

  destroy() {
    this.inv.off('change', this.refresh, this);
    this.inv.off('select', this.refresh, this);
  }
}
