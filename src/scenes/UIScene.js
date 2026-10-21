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
import { SkillsPanel } from '../ui/SkillsPanel.js';
import { NpcDialog } from '../ui/NpcDialog.js';
import { Minimap, FullMap, HomeArrows } from '../ui/MapPanel.js';
import { BossBar } from '../ui/BossBar.js';
import { PetPanel } from '../ui/PetPanel.js';
import { RELICS } from '../systems/Skills.js';
import { ITEMS } from '../systems/items.js';
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
    this.skillsPanel = new SkillsPanel(this, gs);
    this.npcDialog = new NpcDialog(this, gs);
    // Mapa: minimapa, mapa completo y flechas hacia tu casa y tus marcadores
    this.homeArrows = new HomeArrows(this, gs);
    this.minimap = new Minimap(this, gs);
    this.fullMap = new FullMap(this, gs);
    this.bossBar = new BossBar(this);
    this.petPanel = new PetPanel(this, gs);

    this.deathText = this.add
      .text(0, 0, '', textStyle({ fontSize: '30px', strokeThickness: 5, color: '#ff6b6b', align: 'center' }))
      .setOrigin(0.5)
      .setDepth(35)
      .setVisible(false);

    // --- Teclado (PC) ---
    const kb = this.input.keyboard;
    kb.addCapture(['F3']);
    kb.on('keydown-E', () => this.toggleInventory());
    kb.on('keydown-ESC', () => {
      this.togglePets(false);
      this.toggleMap(false);
      this.closeNpcDialog();
      this.toggleInventory(false);
      this.toggleSkills(false);
    });
    kb.on('keydown-F3', () => this.debug.toggle());
    kb.on('keydown-H', () => this.checkHouse());
    kb.on('keydown-K', () => this.toggleSkills());
    kb.on('keydown-M', () => this.toggleMap());
    kb.on('keydown-G', () => this.togglePets());
    // N: mostrar u ocultar el minimapa
    kb.on('keydown-N', () => this.minimap.setVisible(!this.minimap.visible));
    // R: curación rápida (toma una poción)
    kb.on('keydown-R', () => {
      if (!gs.uiBlocking) gs.quickHeal();
    });
    // T: tira al suelo lo que tienes en la mano (la pila entera, como en Terraria)
    kb.on('keydown-T', () => {
      if (gs.uiBlocking || gs.player.dead) return;
      gs.throwStack(gs.inventory.takeSlot(gs.inventory.selected));
    });
    kb.on('keydown', (event) => {
      const n = Number(event.key);
      if (n >= 1 && n <= 9) gs.inventory.select(n - 1);
    });
    // Rueda del ratón: cambia de casilla en la barra rápida
    this.input.on('wheel', (pointer, over, dx, dy) => {
      if (dy === 0 || this.fullMap.isOpen) return;
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
      talkNpc: (npc) => {
        this.toggleInventory(false);
        this.toggleSkills(false);
        this.npcDialog.open(npc);
        this.gs.uiBlocking = true;
      },
      levelUp: (level) =>
        this.zoneBanner.showCustom(
          '¡Subiste de nivel!',
          `Nivel ${level}`,
          `+1 punto de habilidad · Tienes ${gs.progress.points}`,
          this.gs.isTouch ? 'Toca tu nivel (arriba a la izquierda) para elegir una habilidad' : 'Aprieta K para elegir una habilidad',
        ),
      bossStart: (boss) => {
        this.bossBar.show(boss);
        this.zoneBanner.showCustom('¡Despertó un guardián!', boss.def.name, 'Protege una reliquia antigua', 'Véncelo para llevártela');
      },
      bossEnd: (boss, won) => {
        this.bossBar.hide();
        if (won) this.zoneBanner.showCustom('¡Jefe derrotado!', boss.def.name, `Soltó: ${ITEMS[boss.def.relic].name}`, 'Úsala para hacerte más fuerte o véndela al Comerciante');
      },
      openPets: () => this.togglePets(true),
      petTamed: (pet) => this.zoneBanner.showCustom('¡Nueva mascota!', pet.name, `Tu ${pet.pdef.name.toLowerCase()} te seguirá y te defenderá`, this.gs.isTouch ? 'Tócala para darle órdenes' : 'G o clic derecho sobre ella: órdenes'),
      relicUsed: (id) =>
        this.zoneBanner.showCustom('¡Reliquia usada!', ITEMS[id].name, `${RELICS[id].text} · +${RELICS[id].points} punto${RELICS[id].points > 1 ? 's' : ''} de habilidad`, `+${RELICS[id].xp} XP`),
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

  closeNpcDialog() {
    if (!this.npcDialog.isOpen) return;
    this.npcDialog.close();
    this.gs.uiBlocking = this.inventoryPanel.isOpen || this.skillsPanel.isOpen;
  }

  /** Abre o cierra el panel de mascotas. */
  togglePets(force) {
    const open = force ?? !this.petPanel.isOpen;
    if (open === this.petPanel.isOpen) return;
    if (open) {
      if (this.gs.player.dead) return;
      this.toggleInventory(false);
      this.toggleSkills(false);
      this.toggleMap(false);
      this.closeNpcDialog();
      this.petPanel.open();
    } else this.petPanel.close();
    this.gs.uiBlocking = open;
  }

  /** Abre o cierra el mapa completo. */
  toggleMap(force) {
    const open = force ?? !this.fullMap.isOpen;
    if (open === this.fullMap.isOpen) return;
    if (open) {
      if (this.gs.player.dead) return;
      this.toggleInventory(false);
      this.toggleSkills(false);
      this.closeNpcDialog();
      this.fullMap.open();
    } else this.fullMap.close();
    this.gs.uiBlocking = open;
  }

  /** Abre o cierra el panel de habilidades. */
  toggleSkills(force) {
    const open = force ?? !this.skillsPanel.isOpen;
    if (open === this.skillsPanel.isOpen) return;
    if (open && this.gs.player.dead) return;
    if (open) {
      this.toggleInventory(false);
      this.zoneBanner.container.setVisible(false); // el cartel de "¡Subiste de nivel!" taparía el panel
      this.skillsPanel.open();
    } else this.skillsPanel.close();
    this.gs.uiBlocking = open || this.inventoryPanel.isOpen;
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
    if (open) this.skillsPanel.close();
    if (open) this.toggleMap(false);
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
    this.bossBar.layout(W / 2, hotbarBottom + 4, W);
    this.layoutToast();
    this.inventoryPanel.layout(W, H);
    this.skillsPanel.layout(W, H);
    this.npcDialog.layout(W, H);
    this.fullMap.layout(W, H);
    this.petPanel.layout(W, H);
    // Minimapa: en la PC arriba a la derecha (bajo la zona); en el celular a la izquierda, bajo el nivel
    if (this.gs.isTouch) {
      const levelY = y === 42 ? hotbarBottom + 14 : 54;
      this.minimap.layout(10, levelY + 40, Math.min(160, W * 0.2), Math.min(84, H * 0.22), 1.5, false);
    } else {
      const top = this.hud.zoneText.y + 22;
      this.minimap.layout(W - 12 - 210, top, 210, 126, 2, true);
    }
    this.hud.layoutLevel(y === 42 ? hotbarBottom + 14 : 54); // (baja solo si hay 2 filas de corazones)
    this.touchControls.layout(W, H, y === 42 ? hotbarBottom + 28 : 62);
    this.deathText.setPosition(W / 2, H / 2);
  }

  /** Avisos: bajo la barra rápida, o arriba del todo si el inventario está abierto (para no taparlo). */
  layoutToast() {
    this.toast.layout(this.scale.width / 2, this.inventoryPanel.isOpen ? 2 : this.toastY);
  }

  update(time, delta) {
    this.hud.update();
    // El diálogo se cierra si el jugador se aleja del aldeano
    const d = this.npcDialog;
    if (d.isOpen && (this.gs.player.dead || Math.hypot(d.npc.centerX - this.gs.player.centerX, d.npc.centerY - this.gs.player.centerY) > 8 * 32)) this.closeNpcDialog();
    if (d.isOpen && d.npc.talkTime < 1) d.npc.talkTime = 1;
    this.touchControls.update();
    this.minimap.update(delta / 1000);
    this.fullMap.update();
    this.homeArrows.update();
    this.bossBar.update();
    if (this.petPanel.isOpen) this.petPanel.refresh();
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
    this.skillsPanel.destroy();
    this.touchControls.destroy();
  }
}
