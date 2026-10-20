import Phaser from 'phaser';
import manifest from 'virtual:asset-manifest';
import { ASSETS, ASSET_BASE } from '../assets.js';
import { createPlaceholderTexture, applyTextureFilter } from '../systems/Placeholders.js';
import { buildTileset } from '../world/Tileset.js';
import { PIXEL_FONT_NAME } from '../ui/styles.js';

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
      if (!available.has(asset.file)) continue;
      if (asset.frameWidth) {
        this.load.spritesheet(key, base + asset.file, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
      } else {
        this.load.image(key, base + asset.file);
      }
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

    // Esperar la fuente pixel art (máx. 2 s) para que los textos no se dibujen con otra fuente
    const fontReady = document.fonts
      ? Promise.all([document.fonts.load(`16px ${PIXEL_FONT_NAME}`), document.fonts.load(`bold 16px ${PIXEL_FONT_NAME}`)])
      : Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
    Promise.race([fontReady, timeout])
      .catch(() => {})
      .then(() => {
        this.scene.launch('BackgroundScene');
        this.scene.start('MenuScene');
      });
  }
}
