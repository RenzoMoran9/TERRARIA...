import Phaser from 'phaser';
import { HUD, HUD_SIDE_SPACE } from '../ui/HUD.js';
import { ItemTooltip } from '../ui/ItemTooltip.js';
import { Hotbar, HOTBAR_WIDTH, HOTBAR_HEIGHT } from '../ui/Hotbar.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import { TouchControls } from '../ui/TouchControls.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { Toast } from '../ui/Toast.js';
import { ZoneBanner } from '../ui/ZoneBanner.js';
import { HouseReport } from '../ui/HouseReport.js';
import { textStyle } from '../ui/styles.js';

/**
 * Interfaz que se dibuja encima del juego (sin zoom de cámara):
 * vida, barra rápida, hora, inventario/crafteo, controles táctiles, debug y avisos.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create(data) {
    const gs = data.gameScene;
    this.gs = gs;

    this.debug = new DebugOverlay(this, gs);
    this.hud = new HUD(this, gs);
    // Información de los ítems al mantener apretada una casilla (o al pasar el ratón)
    this.tooltip = new ItemTooltip(this);
    this.hotbar = new Hotbar(this, gs.inventory);
    this.inventoryPanel = new InventoryPanel(this, gs);
    this.touchControls = new TouchControls(this, gs);
    this.toast = new Toast(this);
    this.zoneBanner = new ZoneBanner(this);
    this.houseReport = new HouseReport(this);

    this.deathText = this.add
      .text(0, 0, '', textStyle({ fontSize: '30px', strokeThickness: 5, color: '#ff6b6b', align: 'center' }))
      .setOrigin(0.5)
      .setDepth(35)
      .setVisible(false);

    // --- Teclado (PC) ---
    const kb = this.input.keyboard;
    kb.addCapture(['F3']);
    kb.on('keydown-E', () => this.toggleInventory());
    kb.on('keydown-ESC', () => this.toggleInventory(false));
    kb.on('keydown-F3', () => this.debug.toggle());
    kb.on('keydown-H', () => this.checkHouse());
    kb.on('keydown', (event) => {
      const n = Number(event.key);
      if (n >= 1 && n <= 9) gs.inventory.select(n - 1);
    });
    // Rueda del ratón: cambia de casilla en la barra rápida
    this.input.on('wheel', (pointer, over, dx, dy) => {
      if (dy === 0) return;
      // Con el inventario abierto, la rueda desplaza la lista de recetas
      if (this.inventoryPanel.isOpen) {
        this.inventoryPanel.scrollBy(dy > 0 ? 1 : -1);
        return;
      }
      gs.inventory.select(gs.inventory.selected + (dy > 0 ? 1 : -1));
    });
    // Detectar si se está usando táctil o ratón (cambia los controles en vivo)
    this.input.on('pointerdown', (pointer) => gs.setTouchMode(pointer.wasTouch));

    // --- Eventos del juego ---
    this._handlers = {
      toast: (msg) => this.toast.show(msg),
      houseReport: (result) => this.houseReport.show(result),
      zoneDiscovered: (biome) => this.zoneBanner.show(biome, gs.zones.discovered.size, gs.zones.total),
      playerDied: () => {
        this.toggleInventory(false);
        this.deathText.setVisible(true);
      },
      playerRespawned: () => this.deathText.setVisible(false),
      // Cofres: se abren con el inventario al lado
      openChest: (slots) => {
        this.toggleInventory(true);
        this.inventoryPanel.openChest(slots);
      },
      closeChest: () => this.toggleInventory(false),
      touchModeChanged: (isTouch) => {
        this.touchControls.setVisible(isTouch);
        this.layout();
      },
    };
    for (const [name, fn] of Object.entries(this._handlers)) gs.events.on(name, fn);

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', this.onShutdown, this);
    this.layout();

    if (gs.isTouch && this.scale.height > this.scale.width) {
      this.toast.show('Gira el teléfono (horizontal) para jugar mejor');
    }
  }

  /** Revisar la casa donde está el jugador (botón del inventario o tecla H). */
  checkHouse() {
    if (this.gs.player.dead) return;
    this.toggleInventory(false);
    this.gs.checkHouse();
  }

  /** Tocar una casilla de la barra: la selecciona y, en el celular, ajusta el modo (colocar/minar). */
  onHotbarTap(index) {
    this.gs.inventory.select(index);
    if (this.gs.isTouch) this.touchControls.setModeForItem(this.gs.inventory.slots[index]);
  }

  toggleInventory(force) {
    const open = force ?? !this.inventoryPanel.isOpen;
    if (open === this.inventoryPanel.isOpen) return;
    if (open && this.gs.player.dead) return;
    if (open) this.inventoryPanel.open();
    else this.inventoryPanel.close();
    this.gs.uiBlocking = open;
    this.hotbar.setVisible(!open);
    this.layoutToast();
  }

  /** Ubica todo según el tamaño de pantalla (PC, celular horizontal o vertical). */
  layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.hud.layout(W, H);

    // Barra rápida arriba al centro; si no entra entre la vida y el reloj, baja a una segunda fila
    let scale = Math.min(1, (W - HUD_SIDE_SPACE * 2) / HOTBAR_WIDTH);
    let y = 8;
    if (scale < 0.75) {
      scale = Math.min(1, (W - 100) / HOTBAR_WIDTH);
      y = 42;
    }
    this.hotbar.layout(Math.round((W - HOTBAR_WIDTH * scale) / 2), y, scale);
    const hotbarBottom = y + HOTBAR_HEIGHT * scale;

    // En pantallas angostas la barra va en una segunda fila: la zona actual baja debajo de ella
    this.hud.zoneText.setPosition(W - 12, y === 42 ? hotbarBottom + 4 : 34);
    this.debug.layout(10, Math.max(54, y === 42 ? hotbarBottom + 8 : 54));
    this.toastY = hotbarBottom + 26;
    this.zoneBanner.layout(W / 2, Math.max(hotbarBottom + 60, H * 0.2));
    this.houseReport.layout(W / 2, hotbarBottom + 12, W);
    this.layoutToast();
    this.inventoryPanel.layout(W, H);
    this.touchControls.layout(W, H, y === 42 ? hotbarBottom + 28 : 62);
    this.deathText.setPosition(W / 2, H / 2);
  }

  /** Avisos: bajo la barra rápida, o arriba del todo si el inventario está abierto (para no taparlo). */
  layoutToast() {
    this.toast.layout(this.scale.width / 2, this.inventoryPanel.isOpen ? 2 : this.toastY);
  }

  update(time, delta) {
    this.hud.update();
    this.touchControls.update();
    this.inventoryPanel.update(delta);
    this.debug.update(delta);
    if (this.gs.player.dead) {
      const seconds = Math.max(1, Math.ceil(this.gs.respawnTimer));
      if (seconds !== this.lastDeathSeconds) {
        this.lastDeathSeconds = seconds;
        this.deathText.setText(`¡Has muerto!\nReapareces en ${seconds}...`);
      }
    } else {
      this.lastDeathSeconds = 0;
    }
  }

  onShutdown() {
    this.scale.off('resize', this.layout, this);
    for (const [name, fn] of Object.entries(this._handlers)) this.gs.events.off(name, fn);
    this.hotbar.destroy();
    this.inventoryPanel.destroy();
    this.touchControls.destroy();
  }
}
