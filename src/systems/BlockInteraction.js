import Phaser from 'phaser';
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, REACH_TILES, DEPTH } from '../config.js';
import { BLOCK, BLOCK_DEFS, IS_SOLID, WALL } from '../world/blocks.js';
import { ITEMS, HAND } from './items.js';

const T = TILE_SIZE;
const REACH_PX2 = (REACH_TILES * T) ** 2;
const PLACE_REPEAT = 0.18; // segundos entre colocaciones al mantener pulsado
const TIER_MESSAGES = { 1: 'Necesitas un pico de madera', 2: 'Necesitas un pico de piedra' };

/**
 * Minar y colocar bloques.
 * Recibe cada frame una "acción de puntero": { x, y, action: 'mine' | 'place' | null }
 * en coordenadas del mundo (sirve igual para ratón y para pantalla táctil).
 */
export class BlockInteraction {
  constructor(scene, world, player, inventory) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;

    this.mineTx = -1;
    this.mineTy = -1;
    this.progress = 0;
    this.warned = false;
    this.lastPlaceKey = -1;
    this.placeTimer = 0;
    this.placeWarned = false;
    this.swing = 0;
    this._bestTool = null;

    // Recuadro sobre el bloque apuntado
    this.highlight = scene.add
      .rectangle(0, 0, T, T)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(DEPTH.HIGHLIGHT)
      .setVisible(false);
    // Grietas que aparecen mientras se mina
    this.crack = scene.add.image(0, 0, 'ui_crack').setOrigin(0).setDisplaySize(T, T).setDepth(DEPTH.CRACK).setVisible(false);
    // Herramienta que se balancea en la mano mientras se mina
    this.tool = scene.add.image(0, 0, 'item_wood_pickaxe').setOrigin(0.15, 0.85).setDepth(DEPTH.TOOL).setVisible(false);

    inventory.on('change', this._invalidateTool, this);
  }

  _invalidateTool() {
    this._bestTool = null;
  }

  /** Mejor pico del inventario (se usa automáticamente al minar). */
  getBestTool() {
    if (this._bestTool) return this._bestTool;
    let best = HAND;
    for (const s of this.inventory.slots) {
      const def = s && ITEMS[s.id];
      if (def && def.tool && (def.tool.tier > best.tier || (def.tool.tier === best.tier && def.tool.speed > best.speed))) {
        best = { name: def.name, icon: def.icon, tier: def.tool.tier, speed: def.tool.speed };
      }
    }
    this._bestTool = best;
    return best;
  }

  inReach(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return false;
    const dx = (tx + 0.5) * T - this.player.centerX;
    const dy = (ty + 0.5) * T - this.player.centerY;
    return dx * dx + dy * dy <= REACH_PX2;
  }

  update(dt, pa) {
    if (!pa || this.player.dead) {
      this.highlight.setVisible(false);
      this._resetMining();
      this._resetPlacing();
      this.tool.setVisible(false);
      return;
    }
    const tx = Math.floor(pa.x / T);
    const ty = Math.floor(pa.y / T);
    const inReach = this.inReach(tx, ty);

    this.highlight
      .setPosition(tx * T, ty * T)
      .setStrokeStyle(2, inReach ? 0xffffff : 0xff5555, inReach ? 0.9 : 0.6)
      .setVisible(true);

    if (pa.action && inReach) this.player.facing = (tx + 0.5) * T >= this.player.centerX ? 1 : -1;

    if (pa.action === 'mine') this._updateMining(dt, tx, ty, inReach);
    else this._resetMining();

    if (pa.action === 'place') this._updatePlacing(dt, tx, ty, inReach);
    else this._resetPlacing();

    this._updateToolSprite(dt);
  }

  // ------------------------------------------------------------------ minar

  _resetMining() {
    this.mineTx = -1;
    this.mineTy = -1;
    this.progress = 0;
    this.warned = false;
    this.crack.setVisible(false);
  }

  _updateMining(dt, tx, ty, inReach) {
    const id = this.world.getTile(tx, ty);
    if (!inReach || id === BLOCK.AIR) {
      this._resetMining();
      return;
    }
    if (tx !== this.mineTx || ty !== this.mineTy) {
      this._resetMining();
      this.mineTx = tx;
      this.mineTy = ty;
    }

    const def = BLOCK_DEFS[id];
    const tool = this.getBestTool();
    if (def.tier > tool.tier) {
      this._warnOnce(TIER_MESSAGES[def.tier] || 'Este bloque es indestructible');
      return;
    }
    // No se puede minar el suelo que sostiene un árbol
    if (id !== BLOCK.LOG && this.world.getTile(tx, ty - 1) === BLOCK.LOG) {
      this._warnOnce('Primero tala el árbol');
      return;
    }

    const time = def.hardness / tool.speed;
    this.progress += dt;
    this.crack
      .setPosition(tx * T, ty * T)
      .setAlpha(Math.min(1, 0.25 + (this.progress / time) * 0.75))
      .setVisible(true);
    if (this.progress >= time) {
      this.breakBlock(tx, ty);
      this._resetMining();
    }
  }

  _warnOnce(message) {
    if (this.warned) return;
    this.warned = true;
    this.scene.events.emit('toast', message);
  }

  /** Rompe el bloque y manda lo obtenido al inventario. */
  breakBlock(tx, ty) {
    const id = this.world.getTile(tx, ty);
    if (id === BLOCK.LOG) return this._fellTree(tx, ty);

    const drop = BLOCK_DEFS[id].drop;
    if (drop && !this.inventory.canAdd(drop, 1)) {
      this.scene.events.emit('toast', 'Inventario lleno');
      return false;
    }
    this.world.setTile(tx, ty, BLOCK.AIR);
    if (drop) this.inventory.add(drop, 1);
    this._spawnParticles(tx, ty, BLOCK_DEFS[id].color);
    this._checkSupportAround(tx, ty);
    return true;
  }

  /** Talar: se cae todo el tronco hacia arriba y la copa; da 1 madera por tronco. */
  _fellTree(tx, ty) {
    let top = ty;
    while (this.world.getTile(tx, top - 1) === BLOCK.LOG) top--;
    const logs = ty - top + 1;
    if (!this.inventory.canAdd('wood', logs)) {
      this.scene.events.emit('toast', 'Inventario lleno');
      return false;
    }
    for (let y = ty; y >= top; y--) {
      this.world.setTile(tx, y, BLOCK.AIR);
      this._spawnParticles(tx, y, BLOCK_DEFS[BLOCK.LOG].color);
    }
    // Hojas alrededor de la punta (los árboles están separados ≥6 columnas)
    for (let dy = -4; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (this.world.getTile(tx + dx, top + dy) === BLOCK.LEAVES) this.world.setTile(tx + dx, top + dy, BLOCK.AIR);
      }
    }
    this.inventory.add('wood', logs);
    this.scene.events.emit('toast', `+${logs} Madera`);
    return true;
  }

  /** Si se quitó un bloque que sostenía una antorcha o una mesa, estas se caen al inventario. */
  _checkSupportAround(tx, ty) {
    const around = [
      [tx, ty - 1],
      [tx - 1, ty],
      [tx + 1, ty],
    ];
    for (const [x, y] of around) {
      const id = this.world.getTile(x, y);
      if ((id === BLOCK.TORCH || id === BLOCK.WORKBENCH) && !this.hasSupport(x, y, id)) {
        this.world.setTile(x, y, BLOCK.AIR);
        const drop = BLOCK_DEFS[id].drop;
        if (this.inventory.add(drop, 1) > 0) this.scene.events.emit('toast', 'Inventario lleno');
      }
    }
  }

  /** ¿Puede este bloque estar en (x, y)? */
  hasSupport(x, y, id) {
    const w = this.world;
    if (id === BLOCK.TORCH) {
      return w.isSolid(x, y + 1) || w.isSolid(x - 1, y) || w.isSolid(x + 1, y) || w.getWall(x, y) !== WALL.NONE;
    }
    if (id === BLOCK.WORKBENCH) return w.isSolid(x, y + 1);
    // Bloques normales: necesitan algo al lado o una pared detrás
    return (
      w.getTile(x, y + 1) !== BLOCK.AIR ||
      w.getTile(x, y - 1) !== BLOCK.AIR ||
      w.getTile(x - 1, y) !== BLOCK.AIR ||
      w.getTile(x + 1, y) !== BLOCK.AIR ||
      w.getWall(x, y) !== WALL.NONE
    );
  }

  // --------------------------------------------------------------- colocar

  _resetPlacing() {
    this.lastPlaceKey = -1;
    this.placeTimer = 0;
    this.placeWarned = false;
  }

  _updatePlacing(dt, tx, ty, inReach) {
    const key = ty * WORLD_WIDTH + tx;
    this.placeTimer -= dt;
    if (key === this.lastPlaceKey && this.placeTimer > 0) return;
    this.lastPlaceKey = key;
    this.placeTimer = PLACE_REPEAT;
    this.tryPlace(tx, ty, inReach);
  }

  /** Coloca el bloque seleccionado en la barra rápida. */
  tryPlace(tx, ty, inReach) {
    const stack = this.inventory.selectedStack;
    const def = stack && ITEMS[stack.id];
    if (!def || def.places === undefined) {
      if (!this.placeWarned) {
        this.placeWarned = true;
        this.scene.events.emit('toast', def ? `${def.name}: no se puede colocar` : 'Selecciona un bloque en la barra');
      }
      return false;
    }
    if (!inReach || this.world.getTile(tx, ty) !== BLOCK.AIR) return false;
    const block = def.places;
    if (IS_SOLID[block] && this.player.overlapsTile(tx, ty)) return false;
    if (!this.hasSupport(tx, ty, block)) return false;

    this.world.setTile(tx, ty, block);
    this.inventory.removeFromSlot(this.inventory.selected, 1);
    return true;
  }

  // ---------------------------------------------------------------- efectos

  _updateToolSprite(dt) {
    const mining = this.mineTx >= 0 && this.crack.visible;
    const tool = mining ? this.getBestTool() : null;
    if (!tool || !tool.icon) {
      this.tool.setVisible(false);
      this.swing = 0;
      return;
    }
    if (this.tool.texture.key !== tool.icon) this.tool.setTexture(tool.icon);
    this.swing += dt * 14;
    const f = this.player.facing;
    const s = 22 / this.tool.width;
    this.tool
      .setVisible(true)
      .setPosition(this.player.centerX + f * 6, this.player.centerY + 4)
      .setScale(s * f, s) // escala negativa = espejo alrededor del mango
      .setRotation(f * (Math.sin(this.swing) * 0.8 - 0.2));
  }

  _spawnParticles(tx, ty, color) {
    const cx = (tx + 0.5) * T;
    const cy = (ty + 0.5) * T;
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.rectangle(cx, cy, 5, 5, color).setDepth(DEPTH.PARTICLES);
      this.scene.tweens.add({
        targets: p,
        x: cx + Phaser.Math.Between(-18, 18),
        y: cy + Phaser.Math.Between(-20, 12),
        alpha: 0,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }
  }

  destroy() {
    this.inventory.off('change', this._invalidateTool, this);
  }
}
