import { INVENTORY_SIZE, HOTBAR_SIZE } from '../config.js';
import { ITEMS } from '../systems/items.js';
import { RECIPES, canCraft, craft, describeIngredients, hasIngredients, STATION_NAMES, STATION_SHORT } from '../systems/Crafting.js';
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
const ROW_H = 30;
const ROW_GAP = 3;
const ROWS_Y = 56;
const VISIBLE_ROWS = 6; // recetas visibles a la vez (la lista se desplaza)
const LIST_W = CRAFT_W - 22; // a la derecha va la barra para desplazar
const PANEL_W = CRAFT_X + CRAFT_W + PAD;
const PANEL_H = 350;
const BUTTON_H = 36;
const FOOT_Y = PANEL_H - PAD - BUTTON_H / 2; // centro de la fila de botones de abajo
const REPEAT_DELAY = 450; // ms antes de repetir al mantener "Craftear"
const REPEAT_EVERY = 130;

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
    this.selectedRecipe = 0; // receta elegida (se fabrica con el botón "Craftear")
    this.holdPointer = null; // dedo/ratón que mantiene apretado "Craftear"
    this.holdTimer = 0;
    this.feedback = null; // resultado del último crafteo, se muestra un momento en el panel
    this.feedbackUntil = 0;

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
    this.container.add(
      createButton(scene, PAD + 55, FOOT_Y, 110, BUTTON_H, 'Guardar', () => this.gs.saveGame(true), { fontSize: '15px' }),
    );
    this.container.add(
      createButton(scene, PAD + 125 + 75, FOOT_Y, 150, BUTTON_H, 'Menú principal', () => this.gs.backToMenu(), { fontSize: '15px' }),
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

    // Lista de recetas (se desplaza): tocar una la SELECCIONA (no la fabrica).
    // Hay VISIBLE_ROWS filas fijas que muestran las recetas desde this.scroll.
    this.scroll = 0;
    this.drag = null; // arrastre del dedo/ratón sobre la lista
    this.rows = [];
    for (let k = 0; k < VISIBLE_ROWS; k++) {
      const y = ROWS_Y + k * (ROW_H + ROW_GAP);
      const bg = scene.add
        .rectangle(CRAFT_X, y, LIST_W, ROW_H, COLORS.notCraftable, 0.9)
        .setOrigin(0)
        .setStrokeStyle(1, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', (pointer) => {
        this.drag = { pointer, startY: pointer.y, startScroll: this.scroll, moved: false };
      });
      bg.on('pointerup', (pointer) => {
        const d = this.drag;
        this.drag = null;
        if (d && d.pointer === pointer && !d.moved) this.selectRecipe(this.scroll + k);
      });
      const icon = scene.add.image(CRAFT_X + 16, y + ROW_H / 2, 'ui_slot').setDisplaySize(24, 24);
      const name = scene.add.text(CRAFT_X + 32, y + 1, '', textStyle({ fontSize: '13px' }));
      const ingredients = scene.add.text(CRAFT_X + 32, y + 16, '', textStyle({ fontSize: '10px', strokeThickness: 2, color: '#d8d8d8' }));
      const tag = scene.add.text(CRAFT_X + LIST_W - 5, y + 2, '', textStyle({ fontSize: '10px', strokeThickness: 2, color: '#ffd54f' })).setOrigin(1, 0);
      this.container.add([bg, icon, name, ingredients, tag]);
      this.rows.push({ bg, icon, name, ingredients, tag, index: -1, craftable: null });
    }
    // Barra para desplazar: ▲, ▼ y la posición actual
    const listH = VISIBLE_ROWS * (ROW_H + ROW_GAP) - ROW_GAP;
    const sx = CRAFT_X + CRAFT_W - 9;
    this.container.add(scene.add.rectangle(sx, ROWS_Y + listH / 2, 8, listH - 52, 0x000000, 0.35));
    this.scrollThumb = scene.add.rectangle(sx, ROWS_Y, 8, 20, 0xffd84a, 0.9);
    this.container.add(this.scrollThumb);
    this.container.add(createButton(scene, sx, ROWS_Y + 11, 18, 22, '▲', () => this.scrollBy(-1), { fontSize: '11px' }));
    this.container.add(createButton(scene, sx, ROWS_Y + listH - 11, 18, 22, '▼', () => this.scrollBy(1), { fontSize: '11px' }));
    this.listTop = ROWS_Y;
    this.listH = listH;

    // Detalle de la receta elegida: qué se necesita y cuánto tienes
    const detailY = ROWS_Y + listH + 4;
    this.detailText = scene.add.text(CRAFT_X, detailY, '', textStyle({ fontSize: '12px', strokeThickness: 2, wordWrap: { width: CRAFT_W } }));
    this.container.add(this.detailText);

    // Botón "Craftear" (mantener apretado = fabricar varias veces)
    const bx = CRAFT_X + CRAFT_W / 2;
    this.craftBtn = scene.add.container(bx, FOOT_Y);
    this.craftBtnBg = scene.add
      .rectangle(0, 0, CRAFT_W, BUTTON_H, COLORS.craftable, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true });
    this.craftBtnText = scene.add.text(0, 0, 'Craftear', textStyle({ fontSize: '18px', fontStyle: 'bold' })).setOrigin(0.5);
    this.craftBtn.add([this.craftBtnBg, this.craftBtnText]);
    this.container.add(this.craftBtn);
    this.craftBtnBg.on('pointerdown', (pointer) => {
      this.holdPointer = pointer;
      this.holdTimer = REPEAT_DELAY;
      this.craftBtn.setScale(0.97);
      this.craftSelected(true);
    });
    const release = () => {
      this.holdPointer = null;
      this.craftBtn.setScale(1);
    };
    this.craftBtnBg.on('pointerup', release);
    this.craftBtnBg.on('pointerout', release);
  }

  /** Desplaza la lista de recetas (positivo = hacia abajo). */
  scrollBy(rows) {
    this.scrollTo(this.scroll + rows);
  }

  scrollTo(first) {
    const max = Math.max(0, RECIPES.length - VISIBLE_ROWS);
    const s = Math.max(0, Math.min(max, Math.round(first)));
    if (s === this.scroll) return;
    this.scroll = s;
    this.refreshCrafting(true);
  }

  /** Elige una receta de la lista (se marca y se muestra su detalle). */
  selectRecipe(index) {
    if (index < 0 || index >= RECIPES.length) return;
    this.selectedRecipe = index;
    this.feedback = null; // al elegir otra receta se muestra lo que necesita
    this.refreshCrafting(true);
  }

  /** Fabrica la receta elegida. showErrors=false al repetir (para no mostrar errores en bucle). */
  craftSelected(showErrors) {
    const recipe = RECIPES[this.selectedRecipe];
    const result = craft(this.inv, recipe, this.gs.getStations());
    // El resultado se muestra dentro del panel (un aviso flotante taparía la lista)
    if (result.ok || showErrors) {
      this.feedback = result;
      this.feedbackUntil = this.scene.time.now + 1500; // hora real (no depende de los FPS)
    }
    if (!result.ok) this.holdPointer = null;
    else this.gs.player.anim.cheer(); // el personaje festeja lo que fabricó
    this.refreshCrafting(true);
    return result.ok;
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
    this.holdPointer = null;
    this.feedback = null;
    this.inv.returnHeld();
    this.blocker.setVisible(false);
    this.container.setVisible(false);
    this.heldIcon.setVisible(false);
    this.heldCount.setText('');
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

  /** Colorea las recetas según si se pueden craftear y actualiza el detalle y el botón. */
  refreshCrafting(force = false) {
    const stations = this.gs.getStations();
    // Qué estaciones hay cerca, p. ej. "Cerca: Mesa sí · Horno no · Yunque no"
    const stationState = Object.keys(STATION_SHORT).map((k) => `${STATION_SHORT[k]} ${stations[k] ? 'sí' : 'no'}`).join(' · ');
    const stationChanged = stationState !== this.lastStationState;
    if (force || stationChanged) {
      this.lastStationState = stationState;
      this.stationText.setText(`Cerca: ${stationState}`);
    }
    let changed = force || stationChanged;
    this.rows.forEach((row, k) => {
      const i = this.scroll + k;
      const recipe = RECIPES[i];
      if (row.index !== i) {
        // Esta fila ahora muestra otra receta
        row.index = i;
        row.craftable = null;
        const visible = !!recipe;
        for (const o of [row.bg, row.icon, row.name, row.ingredients, row.tag]) o.setVisible(visible);
        if (visible) {
          const item = ITEMS[recipe.result];
          row.icon.setTexture(item.icon).setDisplaySize(24, 24);
          row.name.setText(`${item.name} ×${recipe.count}`);
          row.ingredients.setText(describeIngredients(recipe));
          row.tag.setText(recipe.station ? STATION_SHORT[recipe.station] : '');
        }
      }
      if (!recipe) return;
      const ok = canCraft(this.inv, recipe, stations);
      if (force || ok !== row.craftable) {
        changed = true;
        row.craftable = ok;
        row.bg.setFillStyle(ok ? COLORS.craftable : COLORS.notCraftable, 0.9);
        row.icon.setAlpha(ok ? 1 : 0.5);
        row.name.setAlpha(ok ? 1 : 0.6);
      }
      const selected = i === this.selectedRecipe;
      row.bg.setStrokeStyle(selected ? 3 : 1, selected ? 0xffd84a : 0xffffff, selected ? 1 : 0.25);
    });
    // Posición en la barra de desplazamiento
    const max = Math.max(1, RECIPES.length - VISIBLE_ROWS);
    const track = this.listH - 52 - 20;
    this.scrollThumb.setY(this.listTop + 26 + 10 + (track * this.scroll) / max);
    if (changed) this._refreshDetail(stations);
  }

  _refreshDetail(stations) {
    const recipe = RECIPES[this.selectedRecipe];
    const ok = canCraft(this.inv, recipe, stations);
    const needs = recipe.ingredients.map(([id, n]) => `${n} ${ITEMS[id].name} (tienes ${this.inv.count(id)})`).join(' + ');
    let text = `Necesitas: ${needs}`;
    let color = '#b9f6a8';
    if (recipe.station && !stations[recipe.station]) {
      text = `Acércate a ${STATION_NAMES[recipe.station]}. ${text}`;
      color = '#ffb4a8';
    } else if (!hasIngredients(this.inv, recipe)) {
      color = '#ffb4a8';
    }
    if (this.feedback) {
      text = this.feedback.message;
      color = this.feedback.ok ? '#ffe28a' : '#ffb4a8';
    }
    this.detailText.setText(text).setColor(color);
    this.craftBtnBg.setFillStyle(ok ? COLORS.craftable : COLORS.notCraftable, 0.95);
    this.craftBtnText.setAlpha(ok ? 1 : 0.55);
  }

  update(delta) {
    if (!this.isOpen) return;
    // El ítem del cursor sigue al puntero (ratón o dedo)
    if (this.inv.held) {
      const p = this.scene.input.activePointer;
      this.heldIcon.setPosition(p.x, p.y);
      this.heldCount.setPosition(p.x + this.heldIconSize / 2 + 2, p.y + this.heldIconSize / 2 + 2);
    }
    // Arrastrar la lista de recetas con el dedo (o el ratón) la desplaza
    const d = this.drag;
    if (d) {
      if (!d.pointer.isDown) this.drag = null;
      else {
        const dy = (d.pointer.y - d.startY) / this.scale;
        if (Math.abs(dy) > 8) d.moved = true;
        if (d.moved) this.scrollTo(d.startScroll - dy / (ROW_H + ROW_GAP));
      }
    }
    // Mantener apretado "Craftear" fabrica varias veces seguidas
    if (this.holdPointer) {
      if (!this.holdPointer.isDown) {
        this.holdPointer = null;
        this.craftBtn.setScale(1);
      } else {
        this.holdTimer -= delta;
        if (this.holdTimer <= 0) {
          this.holdTimer = REPEAT_EVERY;
          this.craftSelected(false);
        }
      }
    }
    if (this.feedback && this.scene.time.now >= this.feedbackUntil) {
      this.feedback = null;
      this.refreshCrafting(true);
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
