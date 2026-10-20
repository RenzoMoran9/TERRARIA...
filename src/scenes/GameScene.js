import Phaser from 'phaser';
import {
  TILE_SIZE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER,
  STATION_RANGE,
  AUTOSAVE_SECONDS,
  SAVE_VERSION,
  DEPTH,
} from '../config.js';
import { World } from '../world/World.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { BLOCK } from '../world/blocks.js';
import { Player } from '../player/Player.js';
import { Inventory } from '../systems/Inventory.js';
import { DayNight } from '../systems/DayNight.js';
import { Lighting } from '../systems/Lighting.js';
import { BlockInteraction } from '../systems/BlockInteraction.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { textStyle } from '../ui/styles.js';

const T = TILE_SIZE;

/**
 * Escena principal: mundo, jugador, cámara, luz, ciclo día/noche y guardado.
 * La interfaz (HUD, inventario, controles táctiles) vive en UIScene, encima de esta.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.startData = data || {};
  }

  create() {
    const save = this.startData.continue ? SaveSystem.load() : null;
    const seed = save ? save.seed : this.startData.seed >>> 0;

    // --- Mundo ---
    this.world = new World(seed);
    if (save) this.world.restore(save.chunks);
    this.dayNight = new DayNight(save ? save.time : 8 / 24, save ? save.day : 1);

    // --- Inventario ---
    this.inventory = new Inventory();
    if (save) this.inventory.deserialize(save.inventory);

    // --- Jugador ---
    const spawnTile = this.world.generator.getSpawnTile();
    this.spawn = save?.spawn ?? {
      x: spawnTile.tx * T + (T - PLAYER.WIDTH) / 2,
      y: spawnTile.ty * T - PLAYER.HEIGHT,
    };
    const start = save?.player ?? this.spawn;
    this.player = new Player(this, this.world, start.x, start.y);
    if (save?.player?.health) this.player.health = Phaser.Math.Clamp(save.player.health, 1, PLAYER.MAX_HEALTH);
    this.respawnTimer = 0;

    // --- Sistemas ---
    this.chunkManager = new ChunkManager(this, this.world);
    this.lighting = new Lighting(this, this.world, this.dayNight, this.player);
    this.interaction = new BlockInteraction(this, this.world, this.player, this.inventory);

    // --- Partículas: polvo al correr/aterrizar y fragmentos al romper bloques ---
    this.makePixelTexture();
    this.dust = this.add
      .particles(0, 0, 'fx_pixel', {
        lifespan: { min: 250, max: 450 },
        speedX: { min: -50, max: 50 },
        speedY: { min: -70, max: -15 },
        gravityY: 220,
        scale: { start: 1.2, end: 0 },
        tint: 0xd8c8a8,
        emitting: false,
      })
      .setDepth(DEPTH.PARTICLES);
    this.debris = this.add
      .particles(0, 0, 'fx_pixel', {
        lifespan: { min: 350, max: 650 },
        speedX: { min: -90, max: 90 },
        speedY: { min: -170, max: -40 },
        gravityY: 700,
        scale: { start: 1.3, end: 0.4 },
        rotate: { min: 0, max: 90 },
        emitting: false,
      })
      .setDepth(DEPTH.PARTICLES);
    this._stations = { workbench: false };

    // --- Estado de controles (lo escriben el teclado y los controles táctiles) ---
    // action = botón de acción apretado; aimX/aimY = hacia dónde apunta el joystick
    this.touchState = { moveX: 0, jump: false, mode: 'mine', action: false, aimX: 0, aimY: 0 };
    this._actionWasDown = false;
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches || false;
    this.uiBlocking = false; // true con el inventario abierto
    this._controls = { moveX: 0, jump: false };
    this._pointerAction = { x: 0, y: 0, action: null, smart: false };
    this._tmpVec = new Phaser.Math.Vector2();

    // --- Cámara ---
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH * T, WORLD_HEIGHT * T);
    cam.setRoundPixels(true);
    this.applyZoom();
    this.camTarget = { x: this.player.centerX, y: this.player.centerY };
    cam.startFollow(this.camTarget, true, 0.15, 0.15);
    cam.centerOn(this.camTarget.x, this.camTarget.y);

    // Cargar de una vez todo lo visible para no ver el mundo vacío al empezar
    this.chunkManager.update(cam, true);
    this.lighting.update(0, cam);

    // --- Entrada ---
    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      up: 'UP',
      a: 'A',
      d: 'D',
      w: 'W',
      space: 'SPACE',
    });
    this.worldPointer = null; // puntero que empezó a pulsar sobre el mundo
    this.pressPending = false; // la pulsación aún no se procesó (por si se suelta antes del siguiente frame)
    this.pressAction = null;
    this.mouseInside = true;
    this.input.on('pointerdown', (pointer) => {
      if (this.uiBlocking) return;
      this.worldPointer = pointer;
      this.pressPending = true;
      if (pointer.wasTouch) this.pressAction = this.touchState.mode;
      else this.pressAction = pointer.button === 2 ? 'place' : pointer.button === 0 ? 'mine' : null;
    });
    this.input.on('pointermove', (pointer) => {
      if (!pointer.wasTouch) this.mouseInside = true;
    });
    this.input.on('gameout', () => {
      this.mouseInside = false;
    });
    this.scale.on('resize', this.applyZoom, this);

    // --- Guardado: automático cada 60 s y al ocultar/cerrar la página ---
    this.autosaveTimer = 0;
    this._onVisibility = () => {
      if (document.visibilityState === 'hidden') this.saveGame(false);
    };
    this._onPageHide = () => this.saveGame(false);
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('pagehide', this._onPageHide);
    this.events.once('shutdown', this.onShutdown, this);

    // --- Interfaz ---
    this.scene.launch('UIScene', { gameScene: this });
    if (!save) this.saveGame(false);
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000; // limitar el paso si el navegador se trabó
    const cam = this.cameras.main;

    this.dayNight.update(dt); // el cielo lo dibuja BackgroundScene según esta hora

    this.player.update(dt, this.readControls());
    if (this.player.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
    }
    this.camTarget.x = this.player.centerX;
    this.camTarget.y = this.player.centerY;

    this.chunkManager.update(cam);
    this.chunkManager.animate(time);
    this.interaction.update(dt, this.getPointerAction());
    this.lighting.update(dt, cam);

    this.autosaveTimer += dt;
    if (this.autosaveTimer >= AUTOSAVE_SECONDS) {
      this.autosaveTimer = 0;
      this.saveGame(true);
    }
  }

  /** Une teclado y controles táctiles en un solo objeto { moveX, jump }. */
  readControls() {
    const k = this.keys;
    const c = this._controls;
    let mx = 0;
    if (k.left.isDown || k.a.isDown) mx -= 1;
    if (k.right.isDown || k.d.isDown) mx += 1;
    c.moveX = mx !== 0 ? mx : this.touchState.moveX;
    c.jump = k.space.isDown || k.w.isDown || k.up.isDown || this.touchState.jump;
    return c;
  }

  /**
   * Qué quiere hacer el puntero sobre el mundo este frame:
   * - Ratón: clic izquierdo = minar, clic derecho = colocar, sin clic = solo resaltar.
   * - Táctil: tocar un bloque = minar o colocar según el modo elegido con el botón.
   * - Táctil sin tocar el bloque: el botón de acción usa el objetivo automático
   *   (marcado en amarillo), el bloque más cercano hacia donde mira o apunta el jugador.
   */
  getPointerAction() {
    if (this.uiBlocking || this.player.dead) {
      this.worldPointer = null;
      this.pressPending = false;
      this._actionWasDown = false;
      return null;
    }
    const cam = this.cameras.main;
    const pa = this._pointerAction;
    pa.smart = false;
    const wp = this.worldPointer;
    if (wp) {
      if (wp.isDown || this.pressPending) {
        cam.getWorldPoint(wp.x, wp.y, this._tmpVec);
        pa.x = this._tmpVec.x;
        pa.y = this._tmpVec.y;
        if (!wp.isDown) pa.action = this.pressAction; // clic/toque muy corto: se procesa una vez
        else if (wp.wasTouch) pa.action = this.touchState.mode;
        else pa.action = wp.rightButtonDown() ? 'place' : wp.leftButtonDown() ? 'mine' : null;
        this.pressPending = false;
        return pa;
      }
      this.worldPointer = null;
    }
    if (this.isTouch) return this.getSmartAction(pa);
    if (this.mouseInside) {
      const mp = this.input.mousePointer;
      if (mp) {
        cam.getWorldPoint(mp.x, mp.y, this._tmpVec);
        pa.x = this._tmpVec.x;
        pa.y = this._tmpVec.y;
        pa.action = null;
        return pa;
      }
    }
    return null;
  }

  /** Objetivo automático para el botón de acción (celular). Sin acción, solo se marca en amarillo. */
  getSmartAction(pa) {
    const ts = this.touchState;
    const justPressed = ts.action && !this._actionWasDown;
    this._actionWasDown = ts.action;
    const target = this.interaction.findSmartTarget(ts.mode, ts.aimX, ts.aimY);
    if (!target) {
      if (justPressed) {
        const noBlock = ts.mode === 'place' && this.interaction.selectedBlock() === undefined;
        this.events.emit('toast', noBlock ? 'Elige un bloque en la barra para colocar' : 'No hay nada al alcance en esa dirección');
      }
      return null;
    }
    pa.x = (target.tx + 0.5) * TILE_SIZE;
    pa.y = (target.ty + 0.5) * TILE_SIZE;
    pa.action = ts.action ? ts.mode : null;
    pa.smart = true;
    return pa;
  }

  /** Zoom de cámara: en pantallas chicas (celular) se aleja un poco para ver más mundo. */
  applyZoom() {
    const { width, height } = this.scale;
    const zoom = height < 640 || width < 800 ? Phaser.Math.Clamp(Math.min(height / 520, width / 800), 0.6, 1) : 1;
    this.cameras.main.setZoom(zoom);
  }

  /** Estaciones de crafteo cerca del jugador. */
  getStations() {
    const p = this.player;
    const ptx = Math.floor(p.centerX / T);
    const pty = Math.floor(p.centerY / T);
    let workbench = false;
    for (let dy = -STATION_RANGE; dy <= STATION_RANGE && !workbench; dy++) {
      for (let dx = -STATION_RANGE; dx <= STATION_RANGE; dx++) {
        if (this.world.getTile(ptx + dx, pty + dy) === BLOCK.WORKBENCH) {
          workbench = true;
          break;
        }
      }
    }
    this._stations.workbench = workbench;
    return this._stations;
  }

  setTouchMode(isTouch) {
    if (isTouch === this.isTouch) return;
    this.isTouch = isTouch;
    this.events.emit('touchModeChanged', isTouch);
  }

  onPlayerDied() {
    this.respawnTimer = PLAYER.RESPAWN_SECONDS;
    this.worldPointer = null;
    this.events.emit('playerDied');
  }

  respawn() {
    this.player.respawn(this.spawn.x, this.spawn.y);
    this.events.emit('playerRespawned');
  }

  /** Textura de 4×4 px blanca para las partículas (se tiñe de cada color). */
  makePixelTexture() {
    if (this.textures.exists('fx_pixel')) return;
    const t = this.textures.createCanvas('fx_pixel', 4, 4);
    t.context.fillStyle = '#ffffff';
    t.context.fillRect(0, 0, 4, 4);
    t.refresh();
  }

  spawnDust(x, y, count) {
    this.dust.explode(count, x, y - 2);
  }

  spawnDebris(x, y, color, count = 8) {
    this.debris.setParticleTint(color);
    this.debris.explode(count, x, y);
  }

  showFloatingText(x, y, text, color = '#ffffff', size = 16) {
    const t = this.add
      .text(x, y, text, textStyle({ fontSize: `${size}px`, color, fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(DEPTH.FLOATING_TEXT);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  buildSaveData() {
    const p = this.player;
    const playerData = p.dead
      ? { x: this.spawn.x, y: this.spawn.y, health: PLAYER.MAX_HEALTH }
      : { x: p.x, y: p.y, health: Math.max(1, Math.round(p.health)) };
    return {
      version: SAVE_VERSION,
      seed: this.world.seed,
      savedAt: Date.now(),
      time: this.dayNight.time,
      day: this.dayNight.day,
      spawn: this.spawn,
      player: playerData,
      inventory: this.inventory.serialize(),
      chunks: this.world.serialize(),
    };
  }

  saveGame(showToast) {
    const ok = SaveSystem.save(this.buildSaveData());
    if (showToast) this.events.emit('toast', ok ? 'Partida guardada' : 'No se pudo guardar');
    return ok;
  }

  backToMenu() {
    this.saveGame(false);
    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }

  onShutdown() {
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('pagehide', this._onPageHide);
    this.scale.off('resize', this.applyZoom, this);
    this.interaction.destroy();
    this.lighting.destroy();
    this.chunkManager.destroy();
    this.world.removeAllListeners();
    this.inventory.removeAllListeners();
  }
}
