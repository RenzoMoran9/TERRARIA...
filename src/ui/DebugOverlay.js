import Phaser from 'phaser';
import { TILE_SIZE } from '../config.js';
import { textStyle } from './styles.js';

/** Información de depuración (F3 o tocar el reloj): FPS, posición, chunks, etc. */
export class DebugOverlay {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.timer = 0;
    this.text = scene.add
      .text(10, 44, '', textStyle({ fontSize: '13px', fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.45)' }))
      .setDepth(40)
      .setPadding(4, 2)
      .setVisible(false);
  }

  get visible() {
    return this.text.visible;
  }

  toggle() {
    this.text.setVisible(!this.text.visible);
    this.timer = 0;
  }

  layout(x, y) {
    this.text.setPosition(x, y);
  }

  update(delta) {
    if (!this.text.visible) return;
    this.timer -= delta;
    if (this.timer > 0) return;
    this.timer = 250;

    const gs = this.gs;
    const p = gs.player;
    const renderer = this.scene.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
    this.text.setText(
      [
        `FPS: ${Math.round(this.scene.game.loop.actualFps)}`,
        `Posición: ${Math.floor(p.centerX / TILE_SIZE)}, ${Math.floor(p.centerY / TILE_SIZE)}`,
        `Chunks visibles: ${gs.chunkManager.loaded.size} | en memoria: ${gs.world.countChunksInMemory()}`,
        `Luz: ${gs.lighting.lastMs.toFixed(2)} ms`,
        `Semilla: ${gs.world.seed}`,
        `Render: ${renderer} | Zoom: ${gs.cameras.main.zoom.toFixed(2)}`,
      ].join('\n'),
    );
  }
}
