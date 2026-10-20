import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { seedFromString } from '../world/noise.js';
import { createButton } from '../ui/Button.js';
import { textStyle } from '../ui/styles.js';

/** Semilla del mundo nuevo: ?seed=... en la URL, o una al azar. */
function pickSeed() {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) return /^\d+$/.test(param) ? Number(param) >>> 0 : seedFromString(param);
  return (Math.random() * 4294967296) >>> 0;
}

function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

/** Menú principal: continuar partida guardada o crear un mundo nuevo. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1d2b44');
    this.confirmNew = false;
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  build() {
    this.children.removeAll(true);
    const { width: W, height: H } = this.scale;
    const touch = isTouchDevice();

    // Suelo decorativo con las texturas de bloques
    const groundY = H - 64;
    for (let x = 0; x < W + 32; x += 32) {
      this.add.image(x, groundY, 'tile_grass').setOrigin(0);
      this.add.image(x, groundY + 32, 'tile_dirt').setOrigin(0);
    }

    const titleSize = Math.round(Phaser.Math.Clamp(W / 10, 32, 64));
    this.add.text(W / 2, H * 0.16, 'TERRA 2D', textStyle({ fontSize: `${titleSize}px`, strokeThickness: 6 })).setOrigin(0.5);
    this.add
      .text(W / 2, H * 0.16 + titleSize * 0.75, 'Fase 1 · Supervivencia y construcción', textStyle({ fontSize: '15px', color: '#c8d8f0' }))
      .setOrigin(0.5);

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

    const help = touch
      ? 'Joystick: moverse · Botón grande: saltar · Toca un bloque para minar/colocar\nBotón MINAR/COLOCAR: cambia el modo · Botón de cuadritos: inventario'
      : 'A/D o flechas: moverse · Espacio/W: saltar · Clic izq.: minar · Clic der.: colocar\n1-9 o rueda: barra rápida · E: inventario y crafteo · F3: debug';
    this.add
      .text(W / 2, groundY - 12, help, textStyle({ fontSize: W < 640 ? '11px' : '13px', align: 'center', color: '#e0e8f8' }))
      .setOrigin(0.5, 1);
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
