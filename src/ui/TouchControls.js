import Phaser from 'phaser';
import { textStyle } from './styles.js';

const DEADZONE = 0.2;

/**
 * Controles táctiles (solo se muestran en pantallas táctiles):
 * - Joystick virtual (abajo a la izquierda): mover. Empujarlo hacia arriba también salta.
 * - Botón de salto (abajo a la derecha).
 * - Botón de modo: alterna entre MINAR y COLOCAR al tocar bloques.
 * - Botón de inventario y botón de pantalla completa.
 * Escriben en gameScene.touchState, que el juego lee cada frame.
 */
export class TouchControls {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.state = gameScene.touchState;
    this.visible = false;
    this.joyPointer = null;
    this.jumpPointer = null;
    this.joyJump = false;
    this.bx = 0;
    this.by = 0;
    this.radius = 60;

    this.container = scene.add.container(0, 0).setDepth(20);

    // Joystick: la zona táctil es más grande que el dibujo para que sea fácil de agarrar
    this.base = scene.add.image(0, 0, 'ui_joystick_base');
    const bw = this.base.width;
    this.base.setInteractive(new Phaser.Geom.Circle(bw / 2, bw / 2, bw * 0.75), Phaser.Geom.Circle.Contains);
    this.base.on('pointerdown', (pointer) => {
      this.joyPointer = pointer;
    });
    this.thumb = scene.add.image(0, 0, 'ui_joystick_thumb');

    this.jumpBtn = this._circleButton('ui_button_jump', (pointer) => {
      this.jumpPointer = pointer;
    });
    this.modeBtn = this._circleButton('ui_button_mine', () => this.toggleMode());
    this.modeLabel = scene.add.text(0, 0, '', textStyle({ fontSize: '12px' })).setOrigin(0.5, 0);
    this.invBtn = this._circleButton('ui_button_inventory', () => scene.toggleInventory());
    this.fsBtn = scene.add.image(0, 0, 'ui_button_fullscreen').setInteractive();
    this.fsBtn.on('pointerup', () => {
      if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
      else scene.scale.startFullscreen();
    });

    this.container.add([this.base, this.thumb, this.jumpBtn, this.modeBtn, this.modeLabel, this.invBtn, this.fsBtn]);
    this._updateModeVisual();
    this.setVisible(gameScene.isTouch);
  }

  _circleButton(key, onDown) {
    const img = this.scene.add.image(0, 0, key);
    const w = img.width;
    img.setInteractive(new Phaser.Geom.Circle(w / 2, w / 2, w * 0.6), Phaser.Geom.Circle.Contains);
    img.on('pointerdown', (pointer) => {
      img.setAlpha(0.7);
      onDown(pointer);
    });
    img.on('pointerup', () => img.setAlpha(1));
    img.on('pointerout', () => img.setAlpha(1));
    return img;
  }

  toggleMode() {
    this.state.mode = this.state.mode === 'mine' ? 'place' : 'mine';
    this._updateModeVisual();
  }

  _updateModeVisual() {
    const mine = this.state.mode === 'mine';
    const size = this.modeBtn.displayWidth;
    this.modeBtn.setTexture(mine ? 'ui_button_mine' : 'ui_button_place');
    if (size) this.modeBtn.setDisplaySize(size, size);
    this.modeLabel.setText(mine ? 'MINAR' : 'COLOCAR');
  }

  setVisible(visible) {
    this.visible = visible;
    this.container.setVisible(visible);
    if (!visible) this._release();
  }

  _release() {
    this.joyPointer = null;
    this.jumpPointer = null;
    this.joyJump = false;
    this.state.moveX = 0;
    this.state.jump = false;
    this.thumb.setPosition(this.bx, this.by);
  }

  /** fullscreenY: altura del botón de pantalla completa (debajo del reloj o de la barra rápida). */
  layout(width, height, fullscreenY = 62) {
    const s = Phaser.Math.Clamp(Math.min(width, height) / 400, 0.75, 1.25);
    const m = 20;
    this.radius = 60 * s;

    this.bx = m + 80 * s;
    this.by = height - m - 80 * s;
    this.base.setPosition(this.bx, this.by).setDisplaySize(160 * s, 160 * s);
    this.thumb.setPosition(this.bx, this.by).setDisplaySize(72 * s, 72 * s);

    const jx = width - m - 48 * s;
    const jy = height - m - 48 * s;
    this.jumpBtn.setPosition(jx, jy).setDisplaySize(96 * s, 96 * s);
    this.modeBtn.setPosition(jx - 48 * s - 16 - 40 * s, height - m - 40 * s).setDisplaySize(80 * s, 80 * s);
    this.modeLabel.setPosition(this.modeBtn.x, this.modeBtn.y - 40 * s - 18);
    this.invBtn.setPosition(jx, jy - 48 * s - 16 - 32 * s).setDisplaySize(64 * s, 64 * s);
    this.fsBtn.setPosition(width - 30, fullscreenY).setDisplaySize(40, 40);
  }

  update() {
    if (!this.visible) return;
    const st = this.state;

    // Joystick
    const jp = this.joyPointer;
    if (jp) {
      if (!jp.isDown) {
        this.joyPointer = null;
        this.joyJump = false;
        st.moveX = 0;
        this.thumb.setPosition(this.bx, this.by);
      } else {
        let dx = jp.x - this.bx;
        let dy = jp.y - this.by;
        const len = Math.hypot(dx, dy);
        if (len > this.radius) {
          dx *= this.radius / len;
          dy *= this.radius / len;
        }
        this.thumb.setPosition(this.bx + dx, this.by + dy);
        const nx = dx / this.radius;
        const ax = Math.abs(nx);
        st.moveX = ax < DEADZONE ? 0 : Math.sign(nx) * Math.min(1, (ax - DEADZONE) / 0.55);
        this.joyJump = dy / this.radius < -0.65;
      }
    }

    // Botón de salto: activo mientras el dedo siga apoyado
    if (this.jumpPointer && !this.jumpPointer.isDown) this.jumpPointer = null;
    st.jump = !!this.jumpPointer || this.joyJump;
  }
}
