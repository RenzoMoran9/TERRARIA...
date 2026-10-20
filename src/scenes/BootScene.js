import Phaser from 'phaser';
import manifest from 'virtual:asset-manifest';
import { ASSETS, ASSET_BASE } from '../assets.js';
import { createPlaceholderTexture, applyTextureFilter } from '../systems/Placeholders.js';
import { buildTileset } from '../world/Tileset.js';

/**
 * Carga las imágenes que existan en /public/assets (según assets.js)
 * y genera placeholders para las que falten. Después arma el tileset.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 304, 16).setStrokeStyle(2, 0xffffff);
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 12, 0xffffff).setOrigin(0, 0.5);
    this.load.on('progress', (p) => {
      bar.width = 300 * p;
    });
    this.load.on('loaderror', (file) => {
      console.warn(`[assets] No se pudo cargar "${file.src}". Se usará el placeholder.`);
    });

    // manifest = lista de imágenes que realmente existen (la genera vite.config.js)
    const available = new Set(manifest);
    const base = import.meta.env.BASE_URL + ASSET_BASE;
    for (const [key, asset] of Object.entries(ASSETS)) {
      if (available.has(asset.file)) this.load.image(key, base + asset.file);
    }
  }

  create() {
    const total = Object.keys(ASSETS).length;
    let images = 0;
    for (const [key, asset] of Object.entries(ASSETS)) {
      if (this.textures.exists(key)) images++;
      else createPlaceholderTexture(this, key, asset);
      applyTextureFilter(this, key, asset);
    }
    buildTileset(this);
    console.info(`[assets] ${images} imágenes cargadas, ${total - images} placeholders generados.`);
    this.scene.start('MenuScene');
  }
}
