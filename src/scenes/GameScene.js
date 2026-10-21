import Phaser from 'phaser';
import {
  TILE_SIZE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER,
  STATION_RANGE,
  REACH_TILES,
  AUTOSAVE_SECONDS,
  SAVE_VERSION,
  DEPTH,
} from '../config.js';
import { World } from '../world/World.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { BLOCK, PART, FURNITURE } from '../world/blocks.js';
import { Player } from '../player/Player.js';
import { Inventory } from '../systems/Inventory.js';
import { DayNight } from '../systems/DayNight.js';
import { Lighting } from '../systems/Lighting.js';
import { BlockInteraction } from '../systems/BlockInteraction.js';
import { Furniture } from '../systems/Furniture.js';
import { Enemies } from '../systems/Enemies.js';
import { Projectiles } from '../systems/Projectiles.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { textStyle } from '../ui/styles.js';

const T = TILE_SIZE;
const NIGHT_SKIP_SPEED = 40; // durmiendo en la cama, la noche pasa 40 veces más rápido
const TAP_MS = 350; // toque corto (celular): usa la puerta, silla o cama tocada

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
    if (save) {
      this.world.restore(save.chunks);
      this.world.restoreWalls(save.walls);
    }
    this.dayNight = new DayNight(save ? save.time : 8 / 24, save ? save.day : 1);

    // --- Inventario ---
    this.inventory = new Inventory();
    if (save) this.inventory.deserialize(save.inventory);

    // --- Jugador ---
    // El punto de aparición se calcula siempre (depende del tamaño actual del jugador)
    const spawnTile = this.world.generator.getSpawnTile();
    this.spawn = {
      x: spawnTile.tx * T + (T - PLAYER.WIDTH) / 2,
      y: spawnTile.ty * T - PLAYER.HEIGHT,
    };
    const start = save?.player ?? this.spawn;
    this.player = new Player(this, this.world, start.x, start.y);
    // Partidas viejas (jugador más bajo): si quedó dentro de un bloque, subirlo hasta un lugar libre
    for (let i = 0; i < 12 && this.player.collides(this.player.x, this.player.y); i++) this.player.y -= T;
    this.player.peakY = this.player.y;
    if (save?.player?.health) this.player.health = Phaser.Math.Clamp(save.player.health, 1, PLAYER.MAX_HEALTH);
    this.respawnTimer = 0;
    this.bedSpawn = save?.bed ?? null; // cama donde se reaparece: { tx, ty } (esquina de la cama)

    // --- Sistemas ---
    this.chunkManager = new ChunkManager(this, this.world);
    this.lighting = new Lighting(this, this.world, this.dayNight, this.player);
    this.furniture = new Furniture(this, this.world, this.player);
    this.interaction = new BlockInteraction(this, this.world, this.player, this.inventory, this.furniture);
    this.enemies = new Enemies(this, this.world, this.player, this.dayNight, this.inventory);
    this.projectiles = new Projectiles(this, this.world, this.enemies, this.player);

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
    // Brillos (festejo, reaparecer) y gotas de sudor (poca vida) del personaje
    this.sparkles = this.add
      .particles(0, 0, 'fx_pixel', {
        lifespan: { min: 450, max: 800 },
        speed: { min: 40, max: 150 },
        angle: { min: 0, max: 360 },
        gravityY: 80,
        scale: { start: 1.1, end: 0 },
        tint: [0xfff1a8, 0xffd84a, 0xffffff, 0x9be7ff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.FLOATING_TEXT);
    this.sweat = this.add
      .particles(0, 0, 'fx_pixel', {
        lifespan: 550,
        speedX: { min: -40, max: 40 },
        speedY: { min: -90, max: -50 },
        gravityY: 420,
        scale: { start: 0.9, end: 0.4 },
        tint: 0x8fd3ff,
        emitting: false,
      })
      .setDepth(DEPTH.PARTICLES);
    this._stations = { workbench: false, furnace: false, anvil: false };

    // --- Estado de controles (lo escriben el teclado y los controles táctiles) ---
    // action = botón de acción apretado; aimX/aimY = hacia dónde apunta el joystick
    // action = botón de acción apretado; actionPressed = se apretó (aunque ya se haya soltado);
    // aimX/aimY = hacia dónde apunta el joystick
    this.touchState = { moveX: 0, jump: false, mode: 'mine', action: false, actionPressed: false, aimX: 0, aimY: 0 };
    this.manualTarget = null; // bloque marcado al tocarlo (celular): { tx, ty, acted }
    this.markPointer = null; // dedo apoyado en el mundo: el recuadro lo sigue mientras lo arrastra
    this._holdStop = false; // terminó con el bloque marcado: no seguir hasta soltar el botón
    this._actionWasDown = false;
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches || false;
    this.uiBlocking = false; // true con el inventario abierto
    this._controls = { moveX: 0, jump: false };
    this._pointerAction = { x: 0, y: 0, action: null, smart: false, manual: false };
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
      // Celular: tocar un bloque lo MARCA (recuadro amarillo); el botón de acción lo mina o coloca.
      // Mientras el dedo siga apoyado, el recuadro lo sigue: se puede deslizar hasta el bloque exacto.
      if (pointer.wasTouch) {
        this.markPointer = pointer;
        this.markTarget(pointer);
        this.cameras.main.getWorldPoint(pointer.x, pointer.y, this._tmpVec);
        this._tap = { id: pointer.id, time: this.time.now, tx: Math.floor(this._tmpVec.x / T), ty: Math.floor(this._tmpVec.y / T) };
        return;
      }
      this.worldPointer = pointer;
      this.pressPending = true;
      if (pointer.wasTouch) this.pressAction = this.touchState.mode;
      else this.pressAction = pointer.button === 2 ? 'place' : pointer.button === 0 ? 'mine' : null;
    });
    // Celular: un toque corto sobre una puerta, silla o cama la usa (abrir/cerrar, sentarse, acostarse)
    this.input.on('pointerup', (pointer) => {
      const tap = this._tap;
      this._tap = null;
      if (!tap || tap.id !== pointer.id || this.uiBlocking || this.player.dead) return;
      if (this.time.now - tap.time > TAP_MS) return;
      this.cameras.main.getWorldPoint(pointer.x, pointer.y, this._tmpVec);
      if (Math.floor(this._tmpVec.x / T) !== tap.tx || Math.floor(this._tmpVec.y / T) !== tap.ty) return;
      if (this.furniture.isInteractive(tap.tx, tap.ty) && this.interaction.inReach(tap.tx, tap.ty)) {
        this.furniture.interact(tap.tx, tap.ty);
        this.manualTarget = null; // se tocó para usarlo, no para marcarlo
      }
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

    // Durmiendo en la cama de noche, el tiempo pasa rápido hasta la mañana
    const sleeping = this.player.seat?.kind === 'bed' && this.dayNight.isNight();
    this.dayNight.update(sleeping ? dt * NIGHT_SKIP_SPEED : dt); // el cielo lo dibuja BackgroundScene según esta hora
    if (sleeping && !this.dayNight.isNight()) {
      this.player.standUp();
      this.events.emit('toast', `¡Buen día! Día ${this.dayNight.day}`);
    }

    this.player.update(dt, this.readControls());
    this.furniture.update(dt);
    this.enemies.update(dt);
    this.projectiles.update(dt);
    if (this.player.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
    }
    this.camTarget.x = this.player.centerX;
    this.camTarget.y = this.player.centerY;

    this.chunkManager.update(cam);
    this.chunkManager.animate(time);
    // Dedo arrastrándose por el mundo: el recuadro amarillo lo sigue
    const mp = this.markPointer;
    if (mp) {
      if (mp.isDown && !this.uiBlocking) this.markTarget(mp);
      else this.markPointer = null;
    }
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
    pa.manual = false;
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

  /** Marca el bloque tocado como objetivo del botón de acción (con "imán" al bloque válido más cercano). */
  markTarget(pointer) {
    if (this.player.dead) return;
    this.cameras.main.getWorldPoint(pointer.x, pointer.y, this._tmpVec);
    const t = this.interaction.pickTouchTile(this._tmpVec.x, this._tmpVec.y, this.touchState.mode);
    const mt = this.manualTarget;
    if (mt && mt.tx === t.tx && mt.ty === t.ty) return; // sigue en el mismo bloque
    this.manualTarget = { tx: t.tx, ty: t.ty, acted: false };
    this._holdStop = false;
  }

  /**
   * Botón de acción (celular): actúa sobre el bloque marcado al tocarlo o, si no hay
   * ninguno, sobre el objetivo automático. Sin el botón apretado solo se muestra el recuadro.
   */
  getSmartAction(pa) {
    const ts = this.touchState;
    const pressed = ts.actionPressed;
    ts.actionPressed = false;
    const acting = ts.action || pressed;
    const justPressed = pressed || (ts.action && !this._actionWasDown);
    this._actionWasDown = ts.action;
    if (!acting) this._holdStop = false;

    // Con un arma: el botón ataca, apuntando al enemigo más cercano (las de distancia, más lejos)
    const weapon = this.interaction.selectedWeapon();
    if (weapon) {
      const p = this.player;
      const ranged = weapon.kind === 'bow' || weapon.kind === 'boomerang' || weapon.kind === 'throw';
      const e = this.enemies.nearest((ranged ? 16 : weapon.kind === 'thrust' ? 6 : 5) * T);
      pa.x = e ? e.centerX : p.centerX + p.facing * 4 * T;
      pa.y = e ? e.centerY : p.y + 22;
      pa.action = acting ? 'mine' : null;
      pa.smart = true;
      pa.manual = false;
      return pa;
    }

    // 1) Bloque marcado a mano
    const mt = this.manualTarget;
    if (mt) {
      const p = this.player;
      const dist = Math.hypot((mt.tx + 0.5) * T - p.centerX, (mt.ty + 0.5) * T - p.centerY) / T;
      const id = this.world.getTile(mt.tx, mt.ty);
      const done = mt.acted && this.interaction.isDoneAt(mt.tx, mt.ty, ts.mode);
      if (dist > REACH_TILES + 3) {
        this.manualTarget = null; // se alejó mucho: volver al objetivo automático
      } else if (done) {
        // Terminado: no seguir con otro bloque que no se eligió hasta soltar el botón
        this.manualTarget = null;
        if (acting) this._holdStop = true;
      } else {
        if (justPressed) this._explainManual(mt, id, dist);
        if (acting) mt.acted = true;
        pa.x = (mt.tx + 0.5) * T;
        pa.y = (mt.ty + 0.5) * T;
        pa.action = acting && !this._holdStop ? ts.mode : null;
        pa.smart = true;
        pa.manual = true;
        return pa;
      }
    }

    // 2) Objetivo automático: lo más cercano hacia donde mira o apunta el jugador
    const target = this.interaction.findSmartTarget(ts.mode, ts.aimX, ts.aimY);
    if (!target) {
      if (justPressed) {
        const noBlock = ts.mode === 'place' && !this.interaction.selectedPlacer();
        this.events.emit('toast', noBlock ? 'Elige en la barra algo para colocar' : 'No hay nada al alcance en esa dirección');
      }
      return null;
    }
    pa.x = (target.tx + 0.5) * T;
    pa.y = (target.ty + 0.5) * T;
    pa.action = acting && !this._holdStop ? ts.mode : null;
    pa.smart = true;
    pa.manual = false;
    return pa;
  }

  /** Avisa por qué no se puede actuar sobre el bloque marcado. */
  _explainManual(mt, id, dist) {
    const I = this.interaction;
    let msg = null;
    if (dist > REACH_TILES) msg = 'Está muy lejos: acércate';
    else if (this.touchState.mode === 'mine') {
      if (I.selectedHammer()) {
        if (!I.canHammer(mt.tx, mt.ty)) msg = 'Ahí no hay pared de fondo para quitar';
      } else if (id === BLOCK.AIR) msg = 'Ahí no hay nada que minar';
    } else if (!this.furniture.isInteractive(mt.tx, mt.ty)) {
      const placer = I.selectedPlacer();
      if (!placer) msg = 'Elige en la barra algo para colocar';
      else if (!I.placementAt(mt.tx, mt.ty, placer)) {
        msg = placer.kind === 'object' ? 'No entra ahí: necesita lugar libre y suelo firme' : 'No se puede colocar ahí';
      }
    }
    if (msg) this.events.emit('toast', msg);
  }

  /**
   * Zoom de cámara: en pantallas chicas (celular) se aleja un poco para ver más mundo,
   * sin achicar demasiado los bloques (tienen que poder tocarse con el dedo).
   */
  applyZoom() {
    const { width, height } = this.scale;
    const zoom = height < 640 || width < 800 ? Phaser.Math.Clamp(Math.min(height / 440, width / 760), 0.7, 1) : 1;
    this.cameras.main.setZoom(zoom);
  }

  /** Estaciones de crafteo cerca del jugador. */
  getStations() {
    const p = this.player;
    const ptx = Math.floor(p.centerX / T);
    const pty = Math.floor(p.centerY / T);
    const st = this._stations;
    st.workbench = false;
    st.furnace = false;
    st.anvil = false;
    for (let dy = -STATION_RANGE; dy <= STATION_RANGE; dy++) {
      for (let dx = -STATION_RANGE; dx <= STATION_RANGE; dx++) {
        const id = this.world.getTile(ptx + dx, pty + dy);
        if (id === BLOCK.WORKBENCH) st.workbench = true;
        else if (PART[id] && FURNITURE[PART[id].type].station) st[FURNITURE[PART[id].type].station] = true;
      }
    }
    return st;
  }

  setTouchMode(isTouch) {
    if (isTouch === this.isTouch) return;
    this.isTouch = isTouch;
    this.events.emit('touchModeChanged', isTouch);
  }

  onPlayerDied() {
    this.respawnTimer = PLAYER.RESPAWN_SECONDS;
    this.worldPointer = null;
    this.markPointer = null;
    this.events.emit('playerDied');
  }

  /** Dormir en una cama la vuelve el punto de reaparición. */
  setBedSpawn(tx, ty) {
    const night = this.dayNight.isNight();
    const same = this.bedSpawn && this.bedSpawn.tx === tx && this.bedSpawn.ty === ty;
    this.bedSpawn = { tx, ty };
    if (night) this.events.emit('toast', 'Durmiendo hasta la mañana… (muévete para levantarte)');
    else if (!same) this.events.emit('toast', 'Punto de reaparición: tu cama');
  }

  respawn() {
    // En la cama (si todavía existe) o en el punto de inicio
    let spot = this.spawn;
    if (this.bedSpawn) {
      const bed = this.furniture.bedAt(this.bedSpawn.tx, this.bedSpawn.ty);
      if (bed) {
        const s = this.furniture.bedStandSpot(bed);
        spot = { x: s.standX, y: s.standY };
      } else {
        this.bedSpawn = null;
        this.events.emit('toast', 'Tu cama ya no está: apareces en el inicio');
      }
    }
    this.player.respawn(spot.x, spot.y);
    this.enemies.clearNear(this.player.centerX, this.player.centerY, 30);
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

  spawnSparkles(x, y, count, tint) {
    if (tint !== undefined) this.sparkles.setParticleTint(tint);
    this.sparkles.explode(count, x, y);
    if (tint !== undefined) this.sparkles.setParticleTint([0xfff1a8, 0xffd84a, 0xffffff, 0x9be7ff]);
  }

  spawnSweat(x, y) {
    this.sweat.explode(2, x, y);
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
    // Acostado en la cama se guarda la posición de pie junto a ella
    const pos = p.seat && p.seat.kind === 'bed' ? { x: p.seat.standX, y: p.seat.standY } : p;
    const playerData = p.dead
      ? { x: this.spawn.x, y: this.spawn.y, health: PLAYER.MAX_HEALTH }
      : { x: pos.x, y: pos.y, health: Math.max(1, Math.round(p.health)) };
    return {
      version: SAVE_VERSION,
      seed: this.world.seed,
      savedAt: Date.now(),
      time: this.dayNight.time,
      day: this.dayNight.day,
      spawn: this.spawn,
      bed: this.bedSpawn,
      player: playerData,
      inventory: this.inventory.serialize(),
      chunks: this.world.serialize(),
      walls: this.world.serializeWalls(),
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
    this.enemies.destroy();
    this.projectiles.destroy();
    this.player.anim.destroy();
    this.lighting.destroy();
    this.chunkManager.destroy();
    this.world.removeAllListeners();
    this.inventory.removeAllListeners();
  }
}
