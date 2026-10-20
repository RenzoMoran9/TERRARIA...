import Phaser from 'phaser';
import { HUD, HUD_SIDE_SPACE } from '../ui/HUD.js';
import { Hotbar, HOTBAR_WIDTH, HOTBAR_HEIGHT } from '../ui/Hotbar.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import { TouchControls } from '../ui/TouchControls.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { Toast } from '../ui/Toast.js';
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
    this.hotbar = new Hotbar(this, gs.inventory);
    this.inventoryPanel = new InventoryPanel(this, gs);
    this.touchControls = new TouchControls(this, gs);
    this.toast = new Toast(this);

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
    kb.on('keydown', (event) => {
      const n = Number(event.key);
      if (n >= 1 && n <= 9) gs.inventory.select(n - 1);
    });
    // Rueda del ratón: cambia de casilla en la barra rápida
    this.input.on('wheel', (pointer, over, dx, dy) => {
      if (this.inventoryPanel.isOpen || dy === 0) return;
      gs.inventory.select(gs.inventory.selected + (dy > 0 ? 1 : -1));
    });
    // Detectar si se está usando táctil o ratón (cambia los controles en vivo)
    this.input.on('pointerdown', (pointer) => gs.setTouchMode(pointer.wasTouch));

    // --- Eventos del juego ---
    this._handlers = {
      toast: (msg) => this.toast.show(msg),
      playerDied: () => {
        this.toggleInventory(false);
        this.deathText.setVisible(true);
      },
      playerRespawned: () => this.deathText.setVisible(false),
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

    this.debug.layout(10, Math.max(54, y === 42 ? hotbarBottom + 8 : 54));
    this.toastY = hotbarBottom + 26;
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
  }
}
