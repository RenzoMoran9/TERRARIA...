import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { seedFromString } from '../world/noise.js';
import { createButton } from '../ui/Button.js';
import { textStyle } from '../ui/styles.js';
import { audio } from '../systems/Audio.js';

/** Semilla del mundo nuevo: ?seed=... en la URL, o una al azar. */
function pickSeed() {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) return /^\d+$/.test(param) ? Number(param) >>> 0 : seedFromString(param);
  return (Math.random() * 4294967296) >>> 0;
}

function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

// ¿Ya se está jugando como app instalada?
function isInstalledApp() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Menú principal: continuar partida guardada o crear un mundo nuevo. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // Sin color de fondo: se ve BackgroundScene (cielo y paisaje en movimiento) detrás
    this.confirmNew = false;
    audio.listener = null;
    audio.setMood('menu');
    this.build();
    this.scale.on('resize', this.build, this);
    // Si el navegador avisa que el juego se puede instalar, aparece el botón "Instalar"
    this.game.events.on('installAvailable', this.build, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.build, this);
      this.game.events.off('installAvailable', this.build, this);
    });
  }

  build() {
    this.children.removeAll(true);
    const { width: W, height: H } = this.scale;
    const touch = isTouchDevice();

    // Suelo decorativo con las texturas de bloques y algunas plantas
    const groundY = H - 64;
    const plants = ['tile_plant_grass', 'tile_plant_flower_red', 'tile_plant_grass', 'tile_plant_flower_yellow'];
    for (let x = 0, i = 0; x < W + 32; x += 32, i++) {
      this.add.image(x, groundY, 'tile_grass').setOrigin(0);
      this.add.image(x, groundY + 32, 'tile_dirt').setOrigin(0);
      if (i % 3 !== 1) this.add.image(x, groundY - 32, plants[i % plants.length]).setOrigin(0);
    }

    const titleSize = Math.round(Phaser.Math.Clamp(W / 9, 36, 76));
    this.add
      .text(W / 2, H * 0.16, 'TERRA 2D', textStyle({ fontSize: `${titleSize}px`, fontStyle: 'bold', color: '#ffe28a', strokeThickness: 8 }))
      .setOrigin(0.5)
      .setShadow(0, 5, '#3a2410', 0, true, false);
    this.add
      .text(W / 2, H * 0.16 + titleSize * 0.72, 'Supervivencia y construcción', textStyle({ fontSize: '16px', color: '#ffffff' }))
      .setOrigin(0.5);
    // Versión instalada (para comprobar que llegó la actualización)
    this.add
      .text(8, H - 6, `Versión ${window.__buildId || 'desarrollo'}`, textStyle({ fontSize: '11px', color: '#d8e0f0', strokeThickness: 3 }))
      .setOrigin(0, 1)
      .setAlpha(0.85);

    const save = SaveSystem.load();
    const bw = Math.min(300, W - 40);
    let y = H * 0.42;

    if (save) {
      createButton(this, W / 2, y, bw, 48, 'Continuar', () => this.startGame({ continue: true }));
      const when = save.savedAt ? new Date(save.savedAt).toLocaleString() : '';
      this.add
        .text(W / 2, y + 30, `Día ${save.day} · semilla ${save.seed}${when ? ' · ' + when : ''}`, textStyle({ fontSize: '11px', color: '#b0bcd0', strokeThickness: 2 }))
        .setOrigin(0.5, 0);
      y += 74;
    }

    const newBtn = createButton(this, W / 2, y, bw, 48, 'Nuevo mundo', () => {
      if (save && !this.confirmNew) {
        this.confirmNew = true;
        newBtn.label.setText('¿Borrar el mundo guardado? Toca otra vez').setFontSize(14);
        return;
      }
      SaveSystem.clear();
      this.startGame({ continue: false, seed: pickSeed() });
    });
    if (this.confirmNew) newBtn.label.setText('¿Borrar el mundo guardado? Toca otra vez').setFontSize(14);

    // Instalar como app en el celular (solo fuera de otras páginas y si aún no está instalado)
    const topPage = window.self === window.top;
    if (topPage && !isInstalledApp()) {
      if (window.__installPrompt) {
        createButton(this, W / 2, y + 62, bw, 40, 'Instalar en el celular', () => this.install(), { fontSize: '16px', color: 0x2f7a40, hover: 0x3c9450 });
        this.add
          .text(W / 2, y + 88, 'Si falla: menú ⋮ del navegador → "Agregar a la pantalla principal"', textStyle({ fontSize: '11px', color: '#ffe28a', strokeThickness: 2, align: 'center', wordWrap: { width: W - 32, useAdvancedWrap: true } }))
          .setOrigin(0.5, 0);
      } else if (isIOS()) {
        this.add
          .text(W / 2, y + 44, 'Para instalarlo: botón Compartir → "Agregar a inicio"', textStyle({ fontSize: '13px', color: '#ffe28a' }))
          .setOrigin(0.5, 0);
      }
    }

    const help = touch
      ? 'Joystick: moverse · Flecha: saltar · Toca un bloque para marcarlo\nBotón del pico: minar/colocar lo marcado · Flechas: cambiar modo · Cuadritos: inventario'
      : 'A/D o flechas: moverse · Espacio/W: saltar · Clic izq.: minar · Clic der.: colocar\n1-9 o rueda: barra rápida · E: inventario · K: habilidades · H: revisar casa · F3: debug';
    const helpText = this.add
      .text(
        W / 2,
        groundY - 44,
        help,
        // En pantallas angostas (celular en vertical) el texto se parte en varias líneas
        textStyle({ fontSize: W < 640 ? '11px' : '13px', align: 'center', color: '#ffffff', wordWrap: { width: W - 40, useAdvancedWrap: true } }),
      )
      .setOrigin(0.5, 1)
      .setDepth(1);
    this.add
      .rectangle(W / 2, helpText.y - helpText.height / 2, Math.min(W - 16, helpText.width + 24), helpText.height + 12, 0x10163a, 0.6)
      .setStrokeStyle(1, 0x7d8fe0, 0.6);

    // Sonido: todo → sin música → apagado (arriba a la derecha)
    const sound = createButton(this, W - 92, 28, 168, 34, audio.settingLabel(), () => sound.label.setText(audio.cycleSetting()), { fontSize: '14px' });
  }

  /** Muestra el aviso del navegador para instalar el juego como app. */
  install() {
    const prompt = window.__installPrompt;
    if (!prompt) return;
    window.__installPrompt = null;
    prompt.prompt();
    prompt.userChoice.finally(() => this.build());
  }

  startGame(data) {
    // En celulares, intentar pantalla completa (requiere este toque del usuario)
    if (isTouchDevice() && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch (e) {
        // algunos navegadores (iPhone) no lo permiten; no pasa nada
      }
    }
    this.scene.start('GameScene', data);
  }
}
