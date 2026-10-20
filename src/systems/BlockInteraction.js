import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, REACH_TILES, DEPTH } from '../config.js';
import { BLOCK, BLOCK_DEFS, IS_SOLID, WALL } from '../world/blocks.js';
import { ITEMS, HAND } from './items.js';
import { frameCount } from './Placeholders.js';

const T = TILE_SIZE;
const REACH_PX2 = (REACH_TILES * T) ** 2;
const PLACE_FIRST_REPEAT = 0.4; // al mantener pulsado: espera antes de empezar a repetir
const PLACE_REPEAT = 0.18; // ...y después, segundos entre colocaciones
// Objetos (antorcha, mesa): se pone o se quita UNO por pulsación aunque se mantenga apretado
// (si no, en el celular el recuadro salta al siguiente lugar y se ponen/quitan varios seguidos)
const ONE_PER_PRESS = new Set([BLOCK.TORCH, BLOCK.WORKBENCH]);
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
    this.mineLock = false; // ya se quitó un objeto: no seguir hasta soltar
    this.placeTimer = 0;
    this.placeCount = 0; // bloques puestos en esta pulsación
    this.placeLock = false; // ya se puso un objeto: no seguir hasta soltar
    this.placeWarned = false;
    this._bestTool = null;

    // Recuadro sobre el bloque apuntado
    this.highlight = scene.add
      .rectangle(0, 0, T, T)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(DEPTH.HIGHLIGHT)
      .setVisible(false);
    // Grietas que aparecen mientras se mina
    this.crack = scene.add.image(0, 0, 'ui_crack', 0).setOrigin(0).setDisplaySize(T, T).setDepth(DEPTH.CRACK).setVisible(false);
    this.crackFrames = frameCount(scene, 'ui_crack');
    // (el pico en la mano y el golpe los anima el jugador: ver PlayerAnimator)

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
      this.mineLock = false;
      this._resetPlacing();
      return;
    }
    const tx = Math.floor(pa.x / T);
    const ty = Math.floor(pa.y / T);
    const inReach = this.inReach(tx, ty);

    // Blanco = ratón; amarillo = celular (grueso si lo marcaste tocándolo); rojo = fuera de alcance
    const color = !inReach ? 0xff5555 : pa.smart ? 0xffd84a : 0xffffff;
    const width = pa.manual ? 3 : 2;
    const alpha = !inReach ? 0.7 : pa.smart && !pa.manual ? 0.75 : 1;
    this.highlight.setPosition(tx * T, ty * T).setStrokeStyle(width, color, alpha).setVisible(true);

    if (pa.action && inReach) this.player.facing = (tx + 0.5) * T >= this.player.centerX ? 1 : -1;

    if (pa.action === 'mine') this._updateMining(dt, tx, ty, inReach);
    else {
      this._resetMining();
      this.mineLock = false; // se soltó el botón
    }

    if (pa.action === 'place') this._updatePlacing(dt, tx, ty, inReach);
    else this._resetPlacing();
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
    if (this.mineLock || !inReach || id === BLOCK.AIR) {
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
    // El personaje golpea aunque el bloque sea muy duro (solo saltan chispas)
    const tooHard = def.tier > tool.tier;
    this.player.anim.swing(tool.icon, (tx + 0.5) * T, (ty + 0.5) * T, tooHard ? 0xfff3b0 : def.color, tool.speed);
    if (tooHard) {
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
    const ratio = Math.min(1, this.progress / time);
    // Grietas por etapas (o, si la imagen tiene un solo cuadro, cada vez más opacas)
    if (this.crackFrames > 1) {
      this.crack.setFrame(Math.min(this.crackFrames - 1, Math.floor(ratio * this.crackFrames)), false, false).setAlpha(1);
    } else {
      this.crack.setAlpha(0.25 + ratio * 0.75);
    }
    this.crack.setPosition(tx * T, ty * T).setVisible(true);
    if (this.progress >= time) {
      if (this.breakBlock(tx, ty) && ONE_PER_PRESS.has(id)) this.mineLock = true;
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
    if (drop) {
      this.inventory.add(drop, 1);
      this._pickupText(`+1 ${ITEMS[drop].name}`);
    }
    this.scene.spawnDebris((tx + 0.5) * T, (ty + 0.5) * T, BLOCK_DEFS[id].color);
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
      this.scene.spawnDebris((tx + 0.5) * T, (y + 0.5) * T, y < top + 3 ? BLOCK_DEFS[BLOCK.LEAVES].color : BLOCK_DEFS[BLOCK.LOG].color, 5);
    }
    // Hojas alrededor de la punta (los árboles están separados ≥6 columnas)
    for (let dy = -4; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (this.world.getTile(tx + dx, top + dy) === BLOCK.LEAVES) this.world.setTile(tx + dx, top + dy, BLOCK.AIR);
      }
    }
    this.inventory.add('wood', logs);
    this._pickupText(`+${logs} ${ITEMS.wood.name}`);
    this.player.anim.cheer(0.8); // ¡árbol talado!
    return true;
  }

  /** Texto flotante sobre el jugador al recoger algo (como en Terraria). */
  _pickupText(text) {
    const p = this.player;
    this.scene.showFloatingText(p.centerX + (Math.random() - 0.5) * 16, p.y - 10, text, '#ffffff', 13);
  }

  /** Si se quitó un bloque que sostenía una antorcha, una mesa o una planta, estas se caen. */
  _checkSupportAround(tx, ty) {
    const around = [
      [tx, ty - 1],
      [tx - 1, ty],
      [tx + 1, ty],
    ];
    for (const [x, y] of around) {
      const id = this.world.getTile(x, y);
      if ((id === BLOCK.TORCH || id === BLOCK.WORKBENCH || id === BLOCK.PLANT) && !this.hasSupport(x, y, id)) {
        this.world.setTile(x, y, BLOCK.AIR);
        const drop = BLOCK_DEFS[id].drop;
        if (drop && this.inventory.add(drop, 1) > 0) this.scene.events.emit('toast', 'Inventario lleno');
      }
    }
  }

  /** ¿Puede este bloque estar en (x, y)? */
  hasSupport(x, y, id) {
    const w = this.world;
    if (id === BLOCK.TORCH) {
      return w.isSolid(x, y + 1) || w.isSolid(x - 1, y) || w.isSolid(x + 1, y) || w.getWall(x, y) !== WALL.NONE;
    }
    if (id === BLOCK.WORKBENCH || id === BLOCK.PLANT) return w.isSolid(x, y + 1);
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
    this.placeTimer = 0;
    this.placeCount = 0;
    this.placeLock = false;
    this.placeWarned = false;
  }

  _updatePlacing(dt, tx, ty, inReach) {
    this.placeTimer -= dt;
    // La espera vale aunque el objetivo cambie (el recuadro automático salta al siguiente hueco)
    if (this.placeLock || this.placeTimer > 0) return;
    const block = this.selectedBlock();
    if (!this.tryPlace(tx, ty, inReach)) return;
    // El primero sale enseguida; manteniendo pulsado se repite (los objetos, solo uno)
    if (ONE_PER_PRESS.has(block)) this.placeLock = true;
    this.placeTimer = this.placeCount++ === 0 ? PLACE_FIRST_REPEAT : PLACE_REPEAT;
  }

  /** Bloque que se colocaría con el ítem seleccionado (o undefined si no es colocable). */
  selectedBlock() {
    const stack = this.inventory.selectedStack;
    const def = stack && ITEMS[stack.id];
    return def ? def.places : undefined;
  }

  /** ¿Se puede colocar ese bloque en (tx, ty)? (sin hacer cambios) */
  canPlaceAt(tx, ty, block) {
    const current = this.world.getTile(tx, ty);
    // Se puede construir encima del pasto alto y las flores (se reemplazan)
    if (current !== BLOCK.AIR && current !== BLOCK.PLANT) return false;
    if (IS_SOLID[block] && this.player.overlapsTile(tx, ty)) return false;
    return this.hasSupport(tx, ty, block);
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
    const block = def.places;
    if (!inReach || !this.canPlaceAt(tx, ty, block)) return false;

    this.world.setTile(tx, ty, block);
    this.inventory.removeFromSlot(this.inventory.selected, 1);
    this.player.anim.use(def.icon);
    return true;
  }

  // ------------------------------------------------- objetivo automático (celular)

  /**
   * Bloque que marca un toque del dedo en (wx, wy) (coordenadas del mundo).
   * El dedo es más grande que un bloque: si el toque cae sobre algo que no sirve
   * (aire al MINAR, un lugar ocupado al COLOCAR), se elige el bloque válido más cercano
   * al dedo entre los vecinos ("imán"). Si no hay ninguno, el bloque justo debajo del dedo.
   */
  pickTouchTile(wx, wy, mode) {
    const tx0 = Math.floor(wx / T);
    const ty0 = Math.floor(wy / T);
    const block = mode === 'place' ? this.selectedBlock() : undefined;
    const valid = (tx, ty) => {
      if (!this.inReach(tx, ty)) return false;
      if (mode === 'place') return block !== undefined && this.canPlaceAt(tx, ty, block);
      return this.world.getTile(tx, ty) !== BLOCK.AIR;
    };
    if (valid(tx0, ty0)) return { tx: tx0, ty: ty0 };
    let best = null;
    let bestD = (0.95 * T) ** 2; // hasta ~1 bloque de distancia del dedo
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = tx0 + dx;
        const ty = ty0 + dy;
        if ((dx === 0 && dy === 0) || !valid(tx, ty)) continue;
        const d = ((tx + 0.5) * T - wx) ** 2 + ((ty + 0.5) * T - wy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { tx, ty };
        }
      }
    }
    return best || { tx: tx0, ty: ty0 };
  }

  /**
   * Busca el bloque sobre el que actuaría el botón de acción, sin tocar la pantalla.
   * Lanza "rayos" desde el jugador hacia donde apunta el joystick (o hacia donde mira)
   * y devuelve el tile más cercano:
   * - MINAR: el primer bloque que no sea aire (tronco, tierra, piedra, planta…).
   * - COLOCAR: el primer hueco donde se puede colocar el bloque seleccionado.
   * aimX/aimY: dirección del joystick (0, 0 = hacia donde mira el jugador).
   */
  findSmartTarget(mode, aimX, aimY) {
    const p = this.player;
    if (p.dead) return null;
    let angle = aimX === 0 && aimY === 0 ? (p.facing > 0 ? 0 : Math.PI) : Math.atan2(aimY, aimX);
    angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4); // 8 direcciones
    const dx = Math.round(Math.cos(angle) * 1000) / 1000;
    const dy = Math.round(Math.sin(angle) * 1000) / 1000;
    const block = mode === 'place' ? this.selectedBlock() : undefined;
    if (mode === 'place' && block === undefined) return null;

    // En horizontal se prueba a la altura de la cabeza, del cuerpo y de los pies; en las demás, desde el centro
    const origins = dy === 0 ? [p.y + 8, p.centerY, p.y + p.h - 6] : [p.centerY];
    const maxT = REACH_TILES * T;
    let best = null;
    let bestT = Infinity;
    let plant = null; // el pasto alto y las flores solo se cortan si no hay otra cosa
    for (const oy of origins) {
      for (let t = 12; t <= maxT && t < bestT; t += 6) {
        const tx = Math.floor((p.centerX + dx * t) / T);
        const ty = Math.floor((oy + dy * t) / T);
        if (!this.inReach(tx, ty)) break;
        const id = this.world.getTile(tx, ty);
        if (mode === 'mine') {
          if (id === BLOCK.PLANT) {
            if (!plant) plant = { tx, ty };
          } else if (id !== BLOCK.AIR) {
            best = { tx, ty };
            bestT = t;
            break;
          }
        } else {
          if (IS_SOLID[id]) break; // no se coloca a través de paredes
          if (this.canPlaceAt(tx, ty, block)) {
            best = { tx, ty };
            bestT = t;
            break;
          }
        }
      }
    }
    // Un tronco se tala desde la base para que caiga el árbol entero (sin dejar tocón)
    if (best && this.world.getTile(best.tx, best.ty) === BLOCK.LOG) {
      while (this.world.getTile(best.tx, best.ty + 1) === BLOCK.LOG && this.inReach(best.tx, best.ty + 1)) best.ty++;
    }
    return best || plant;
  }

  destroy() {
    this.inventory.off('change', this._invalidateTool, this);
  }
}
