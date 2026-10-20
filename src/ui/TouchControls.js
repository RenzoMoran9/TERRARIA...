import Phaser from 'phaser';
import { ITEMS } from '../systems/items.js';
import { textStyle } from './styles.js';

const DEADZONE = 0.2;
const AIM_DEADZONE = 0.35; // inclinación mínima del joystick para apuntar en esa dirección

/**
 * Controles táctiles (solo se muestran en pantallas táctiles):
 * - Joystick virtual (abajo a la izquierda): mover. Empujarlo hacia arriba también salta.
 *   Mientras se mantiene el botón de acción, el joystick además APUNTA (abajo = cavar hacia abajo).
 * - Botón de salto (abajo a la derecha).
 * - Botón de ACCIÓN (junto al salto): mina o coloca automáticamente en el bloque marcado
 *   en amarillo (el más cercano hacia donde mira o apunta el jugador). No hace falta tocar el bloque.
 * - Botón de modo (pequeño, encima): alterna entre MINAR y COLOCAR.
 * - Botón de inventario y botón de pantalla completa.
 * Tocar un bloque directamente también funciona (para mayor precisión).
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
    this.actionPointer = null;
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
    this.actionBtn = this._circleButton('ui_button_mine', (pointer) => {
      this.actionPointer = pointer;
    });
    this.modeBtn = this._circleButton('ui_button_swap', () => this.toggleMode());
    this.modeLabel = scene.add.text(0, 0, '', textStyle({ fontSize: '12px' })).setOrigin(0.5, 0.5);
    this.invBtn = this._circleButton('ui_button_inventory', () => scene.toggleInventory());
    this.fsBtn = scene.add.image(0, 0, 'ui_button_fullscreen').setInteractive();
    this.fsBtn.on('pointerup', () => {
      if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
      else scene.scale.startFullscreen();
    });

    this.container.add([
      this.base,
      this.thumb,
      this.jumpBtn,
      this.actionBtn,
      this.modeBtn,
      this.modeLabel,
      this.invBtn,
      this.fsBtn,
    ]);
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
    this.setMode(this.state.mode === 'mine' ? 'place' : 'mine');
  }

  setMode(mode) {
    this.state.mode = mode;
    this._updateModeVisual();
  }

  /** Al elegir un ítem en la barra: si es un bloque colocable pasa a COLOCAR; si no, a MINAR. */
  setModeForItem(stack) {
    const def = stack && ITEMS[stack.id];
    this.setMode(def && def.places !== undefined ? 'place' : 'mine');
  }

  _updateModeVisual() {
    const mine = this.state.mode === 'mine';
    const size = this.actionBtn.displayWidth;
    this.actionBtn.setTexture(mine ? 'ui_button_mine' : 'ui_button_place');
    if (size) this.actionBtn.setDisplaySize(size, size);
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
    this.actionPointer = null;
    this.joyJump = false;
    this.state.moveX = 0;
    this.state.jump = false;
    this.state.action = false;
    this.state.aimX = 0;
    this.state.aimY = 0;
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

    // Abajo a la derecha: [acción] [salto]; encima del salto, inventario; encima de la acción, cambio de modo
    const jx = width - m - 48 * s;
    const jy = height - m - 48 * s;
    this.jumpBtn.setPosition(jx, jy).setDisplaySize(96 * s, 96 * s);
    const ax = jx - 96 * s - 14;
    this.actionBtn.setPosition(ax, jy).setDisplaySize(96 * s, 96 * s);
    this.modeBtn.setPosition(ax, jy - 48 * s - 14 - 28 * s).setDisplaySize(56 * s, 56 * s);
    this.modeLabel.setPosition(ax - 28 * s - 36, this.modeBtn.y);
    this.invBtn.setPosition(jx, jy - 48 * s - 14 - 32 * s).setDisplaySize(64 * s, 64 * s);
    this.fsBtn.setPosition(width - 30, fullscreenY).setDisplaySize(40, 40);
  }

  update() {
    if (!this.visible) return;
    const st = this.state;

    // Botón de acción: activo mientras el dedo siga apoyado
    if (this.actionPointer && !this.actionPointer.isDown) this.actionPointer = null;
    st.action = !!this.actionPointer;

    // Joystick: mover y (mientras se usa la acción) apuntar
    const jp = this.joyPointer;
    st.aimX = 0;
    st.aimY = 0;
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
        if (Math.hypot(dx, dy) / this.radius > AIM_DEADZONE) {
          st.aimX = dx;
          st.aimY = dy;
        }
        // Con la acción apretada, empujar hacia arriba apunta arriba en vez de saltar
        this.joyJump = !st.action && dy / this.radius < -0.65;
      }
    }

    // Botón de salto: activo mientras el dedo siga apoyado
    if (this.jumpPointer && !this.jumpPointer.isDown) this.jumpPointer = null;
    st.jump = !!this.jumpPointer || this.joyJump;
  }
}
