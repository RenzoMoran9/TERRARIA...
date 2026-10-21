import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, REACH_TILES, DEPTH } from '../config.js';
import { BLOCK, BLOCK_DEFS, IS_SOLID, WALL, WALL_DEFS, PART } from '../world/blocks.js';
import { ITEMS, HAND } from './items.js';
import { frameCount } from './Placeholders.js';
import { PROJECTILE_GRAVITY } from './Projectiles.js';

const T = TILE_SIZE;
const REACH_PX2 = (REACH_TILES * T) ** 2;
const PLACE_FIRST_REPEAT = 0.4; // al mantener pulsado: espera antes de empezar a repetir
const PLACE_REPEAT = 0.18; // ...y después, segundos entre colocaciones
// Objetos (antorcha, mesa): se pone o se quita UNO por pulsación aunque se mantenga apretado
// (si no, en el celular el recuadro salta al siguiente lugar y se ponen/quitan varios seguidos)
const ONE_PER_PRESS = new Set([BLOCK.TORCH, BLOCK.WORKBENCH]);
const TIER_MESSAGES = { 1: 'Necesitas un pico de madera', 2: 'Necesitas un pico de piedra' };
const WALL_HARDNESS = 0.6; // segundos para quitar una pared con un martillo de velocidad 1
const NEIGHBORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Minar y colocar: bloques, paredes de fondo (martillo para quitarlas) y muebles.
 * Recibe cada frame una "acción de puntero": { x, y, action: 'mine' | 'place' | null }
 * en coordenadas del mundo (sirve igual para ratón y para pantalla táctil).
 * "Colocar" sobre una puerta, silla o cama la usa (abrir/cerrar, sentarse, acostarse).
 */
export class BlockInteraction {
  constructor(scene, world, player, inventory, furniture) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.furniture = furniture;

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
    // Vista previa del mueble que se va a colocar (semitransparente)
    this.ghost = scene.add.image(0, 0, 'obj_chair').setOrigin(0).setAlpha(0.55).setDepth(DEPTH.HIGHLIGHT - 0.5).setVisible(false);
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
      this.ghost.setVisible(false);
      this._resetMining();
      this.mineLock = false;
      this._resetPlacing();
      return;
    }
    // Con una espada elegida no se mina ni se coloca: se ataca
    const weapon = this.selectedWeapon();
    if (weapon) {
      this.highlight.setVisible(false);
      this.ghost.setVisible(false);
      this._resetMining();
      this._resetPlacing();
      if (pa.action === 'mine') this._updateAttack(pa, weapon);
      return;
    }
    const tx = Math.floor(pa.x / T);
    const ty = Math.floor(pa.y / T);
    const inReach = this.inReach(tx, ty);

    // Blanco = ratón; amarillo = celular (grueso si lo marcaste tocándolo); rojo = fuera de alcance
    const color = !inReach ? 0xff5555 : pa.smart ? 0xffd84a : 0xffffff;
    const width = pa.manual ? 3 : 2;
    const alpha = !inReach ? 0.7 : pa.smart && !pa.manual ? 0.75 : 1;
    // Con un mueble elegido, el recuadro muestra dónde quedaría (y se ve una vista previa)
    const spot = pa.action !== 'mine' && inReach ? this._furnitureSpot(tx, ty) : null;
    if (spot) {
      this.highlight.setPosition(spot.x0 * T, spot.y0 * T).setSize(spot.w * T, spot.h * T);
      this.ghost
        .setTexture(spot.obj.texture)
        .setFlipX(!!spot.obj.mirrored)
        .setPosition(spot.x0 * T, spot.y0 * T)
        .setDisplaySize(spot.w * T, spot.h * T)
        .setVisible(true);
    } else {
      this.highlight.setPosition(tx * T, ty * T).setSize(T, T);
      this.ghost.setVisible(false);
    }
    this.highlight.setStrokeStyle(width, color, alpha).setVisible(true);

    if (pa.action && inReach && !this.player.seat) this.player.facing = (tx + 0.5) * T >= this.player.centerX ? 1 : -1;

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
    const hammer = this.selectedHammer();
    if (hammer) {
      this._updateHammer(dt, tx, ty, inReach, hammer);
      return;
    }
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
    if (this._advanceCrack(dt, tx, ty, time)) {
      // Antorchas, mesas y muebles: de a uno por pulsación
      if (this.breakBlock(tx, ty) && (ONE_PER_PRESS.has(id) || PART[id])) this.mineLock = true;
      this._resetMining();
    }
  }

  /** Avanza el minado y dibuja las grietas. Devuelve true al terminar. */
  _advanceCrack(dt, tx, ty, time) {
    this.progress += dt;
    const ratio = Math.min(1, this.progress / time);
    // Grietas por etapas (o, si la imagen tiene un solo cuadro, cada vez más opacas)
    if (this.crackFrames > 1) {
      this.crack.setFrame(Math.min(this.crackFrames - 1, Math.floor(ratio * this.crackFrames)), false, false).setAlpha(1);
    } else {
      this.crack.setAlpha(0.25 + ratio * 0.75);
    }
    this.crack.setPosition(tx * T, ty * T).setVisible(true);
    return this.progress >= time;
  }

  /** Espada elegida en la barra: { icon, damage, knockback, speed, reach }, o null. */
  selectedWeapon() {
    const stack = this.inventory.selectedStack;
    const def = stack && ITEMS[stack.id];
    return def && def.weapon ? { icon: def.icon, ...def.weapon } : null;
  }

  /**
   * Mantener el clic (o el botón de acción) con un arma: ataca hacia donde apunta.
   * Espadas, daga y maza golpean en arco; la lanza da estocadas; arcos, bumerán y
   * cuchillos lanzan proyectiles en la dirección apuntada.
   */
  _updateAttack(pa, weapon) {
    const p = this.player;
    const kind = weapon.kind || 'swing';
    const oy = p.y + 22;
    const ranged = kind === 'bow' || kind === 'boomerang' || kind === 'throw';
    // Flechas y cuchillos caen un poco: se apunta un poco más arriba para compensar
    let ty = pa.y;
    const g = kind === 'bow' ? PROJECTILE_GRAVITY.arrow : kind === 'throw' ? PROJECTILE_GRAVITY.knife : 0;
    if (g) {
      const t = Math.hypot(pa.x - p.centerX, pa.y - oy) / weapon.projSpeed;
      ty -= 0.5 * g * t * t;
    }
    const aim = Math.atan2(ty - oy, pa.x - p.centerX);
    if (!p.seat) p.facing = Math.cos(aim) >= 0 ? 1 : -1;
    p.anim.swing(weapon.icon, 0, 0, null, 0, {
      rate: weapon.speed,
      pose: kind === 'bow' ? 'aim' : kind === 'thrust' ? 'thrust' : 'swing',
      aim,
      onHit: () => (ranged ? this._shoot(weapon, kind, aim) : this.scene.enemies.meleeHit(p, weapon, aim)),
    });
  }

  /** Dispara o lanza un proyectil (gasta flechas o cuchillos). */
  _shoot(weapon, kind, aim) {
    const p = this.player;
    const proj = this.scene.projectiles;
    const x = p.centerX + Math.cos(aim) * 18;
    const y = p.y + 22 + Math.sin(aim) * 18;
    if (kind === 'bow') {
      if (this.inventory.count('wood_arrow') <= 0) {
        this._warnOnce('Necesitas flechas (se hacen en la mesa: 1 madera + 1 piedra)');
        return;
      }
      this.inventory.remove('wood_arrow', 1);
      proj.fire('arrow', 'item_wood_arrow', x, y, aim, weapon.projSpeed, weapon.damage + ITEMS.wood_arrow.ammo.damage, weapon.knockback);
    } else if (kind === 'boomerang') {
      if (proj.count('boomerang') > 0) return; // uno a la vez: hay que esperar que vuelva
      proj.fire('boomerang', weapon.icon, x, y, aim, weapon.projSpeed, weapon.damage, weapon.knockback);
    } else {
      this.inventory.removeFromSlot(this.inventory.selected, 1);
      proj.fire('knife', weapon.icon, x, y, aim, weapon.projSpeed, weapon.damage, weapon.knockback);
    }
  }

  /** Martillo elegido en la barra (quita paredes de fondo en vez de minar bloques), o null. */
  selectedHammer() {
    const stack = this.inventory.selectedStack;
    const def = stack && ITEMS[stack.id];
    return def && def.hammer ? { icon: def.icon, speed: def.hammer.speed } : null;
  }

  /** ¿Se puede quitar con el martillo la pared de (tx, ty)? (no debe tener un bloque sólido adelante) */
  canHammer(tx, ty) {
    return this.world.getWall(tx, ty) !== WALL.NONE && !this.world.isSolid(tx, ty);
  }

  _updateHammer(dt, tx, ty, inReach, hammer) {
    if (this.mineLock || !inReach || !this.canHammer(tx, ty)) {
      if (inReach && this.world.isSolid(tx, ty)) this._warnOnce('El martillo quita paredes de fondo: para minar, elige otra casilla');
      this._resetMining();
      return;
    }
    if (tx !== this.mineTx || ty !== this.mineTy) {
      this._resetMining();
      this.mineTx = tx;
      this.mineTy = ty;
    }
    const wall = this.world.getWall(tx, ty);
    const def = WALL_DEFS[wall];
    this.player.anim.swing(hammer.icon, (tx + 0.5) * T, (ty + 0.5) * T, def.color, hammer.speed);
    if (!this._advanceCrack(dt, tx, ty, WALL_HARDNESS / hammer.speed)) return;
    this._resetMining();
    this.world.setWall(tx, ty, WALL.NONE);
    this.scene.drops.spawn(def.item, 1, (tx + 0.5) * T, (ty + 0.5) * T);
    this.scene.spawnDebris((tx + 0.5) * T, (ty + 0.5) * T, def.color);
    // Una antorcha colgada de esa pared se cae
    const id = this.world.getTile(tx, ty);
    if (id === BLOCK.TORCH && !this.hasSupport(tx, ty, id)) this._dropBlock(tx, ty, id);
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
    if (PART[id]) return this._breakFurniture(tx, ty, id);

    const drop = BLOCK_DEFS[id].drop;
    this.world.setTile(tx, ty, BLOCK.AIR);
    // Lo obtenido salta al suelo y se recoge al pasar cerca
    if (drop) this.scene.drops.spawn(drop, 1, (tx + 0.5) * T, (ty + 0.5) * T);
    this.scene.spawnDebris((tx + 0.5) * T, (ty + 0.5) * T, BLOCK_DEFS[id].color);
    this._checkSupportAround(tx, ty);
    return true;
  }

  /** Talar: se cae todo el tronco hacia arriba y la copa; da 1 madera por tronco. */
  _fellTree(tx, ty) {
    let top = ty;
    while (this.world.getTile(tx, top - 1) === BLOCK.LOG) top--;
    for (let y = ty; y >= top; y--) {
      this.world.setTile(tx, y, BLOCK.AIR);
      this.scene.spawnDebris((tx + 0.5) * T, (y + 0.5) * T, y < top + 3 ? BLOCK_DEFS[BLOCK.LEAVES].color : BLOCK_DEFS[BLOCK.LOG].color, 5);
      this.scene.drops.spawn('wood', 1, (tx + 0.5) * T, (y + 0.5) * T); // la madera cae por todo el tronco
    }
    // Hojas alrededor de la punta (los árboles están separados ≥6 columnas)
    for (let dy = -4; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (this.world.getTile(tx + dx, top + dy) === BLOCK.LEAVES) this.world.setTile(tx + dx, top + dy, BLOCK.AIR);
      }
    }
    this.player.anim.cheer(0.8); // ¡árbol talado!
    return true;
  }

  /** Quita un mueble entero (desde cualquiera de sus partes) y lo devuelve al inventario. */
  _breakFurniture(tx, ty, id) {
    const def = BLOCK_DEFS[id];
    // Un cofre con cosas adentro no se puede romper (como en Terraria)
    const at = this.furniture.at(tx, ty);
    if (at && at.type === 'chest' && !this.scene.isChestEmpty(at.x0, at.y0)) {
      this._warnOnce('Vacía el cofre antes de romperlo');
      return false;
    }
    const f = this.furniture.remove(tx, ty);
    if (!f) return false;
    this.scene.drops.spawn(def.drop, 1, (f.x0 + f.obj.w / 2) * T, (f.y0 + f.obj.h - 0.5) * T);
    for (let dy = 0; dy < f.obj.h; dy++) {
      for (let dx = 0; dx < f.obj.w; dx++) this.scene.spawnDebris((f.x0 + dx + 0.5) * T, (f.y0 + dy + 0.5) * T, def.color, 4);
    }
    return true;
  }

  /** Si se quitó un bloque que sostenía una antorcha, una mesa, una planta o un mueble, estos se caen. */
  _checkSupportAround(tx, ty) {
    const around = [
      [tx, ty - 1],
      [tx - 1, ty],
      [tx + 1, ty],
    ];
    for (const [x, y] of around) {
      const id = this.world.getTile(x, y);
      if ((id === BLOCK.TORCH || id === BLOCK.WORKBENCH || id === BLOCK.PLANT) && !this.hasSupport(x, y, id)) {
        this._dropBlock(x, y, id);
      }
    }
    this.furniture.checkSupport(tx, ty); // un mueble sin suelo se cae (suelta su ítem)
  }

  /** Quita un bloque que se quedó sin apoyo: cae al suelo como objeto. */
  _dropBlock(x, y, id) {
    this.world.setTile(x, y, BLOCK.AIR);
    const drop = BLOCK_DEFS[id].drop;
    if (drop) this.scene.drops.spawn(drop, 1, (x + 0.5) * T, (y + 0.5) * T);
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
    // Puerta, silla o cama: se usa (una vez por pulsación)
    if (this.placeCount === 0 && this.furniture.isInteractive(tx, ty)) {
      this.placeLock = true;
      if (inReach) this.furniture.interact(tx, ty);
      return;
    }
    const placed = this.tryPlace(tx, ty, inReach);
    if (!placed) return;
    // El primero sale enseguida; manteniendo pulsado se repite (antorchas, mesas y muebles: solo uno)
    if (placed.kind === 'object' || ONE_PER_PRESS.has(placed.block)) this.placeLock = true;
    this.placeTimer = this.placeCount++ === 0 ? PLACE_FIRST_REPEAT : PLACE_REPEAT;
  }

  /**
   * Qué se colocaría con el ítem elegido en la barra:
   * { kind: 'block', block } | { kind: 'wall', wall } | { kind: 'object', type }, o null.
   */
  selectedPlacer() {
    const stack = this.inventory.selectedStack;
    const def = stack && ITEMS[stack.id];
    if (!def) return null;
    if (def.places !== undefined) return { kind: 'block', block: def.places, def };
    if (def.wall !== undefined) return { kind: 'wall', wall: def.wall, def };
    if (def.object !== undefined) return { kind: 'object', type: def.object, def };
    return null;
  }

  /**
   * Dónde quedaría lo elegido apuntando a (tx, ty): { x0, y0, w, h, obj? } o null si no se puede.
   * Los muebles miran hacia el lado del jugador donde se colocan.
   */
  placementAt(tx, ty, placer = this.selectedPlacer()) {
    if (!placer) return null;
    if (placer.kind === 'block') return this.canPlaceAt(tx, ty, placer.block) ? { x0: tx, y0: ty, w: 1, h: 1 } : null;
    if (placer.kind === 'wall') return this.canPlaceWall(tx, ty) ? { x0: tx, y0: ty, w: 1, h: 1 } : null;
    const facing = (tx + 0.5) * T >= this.player.centerX ? 1 : -1;
    return this.furniture.resolve(placer.type, tx, ty, facing);
  }

  /** Mueble elegido que entraría apuntando a (tx, ty) (para la vista previa), o null. */
  _furnitureSpot(tx, ty) {
    const placer = this.selectedPlacer();
    if (!placer || placer.kind !== 'object' || this.furniture.isInteractive(tx, ty)) return null;
    return this.placementAt(tx, ty, placer);
  }

  /** ¿Se puede poner una pared de fondo en (tx, ty)? Junto a otra pared o a un bloque, sin bloque sólido adelante. */
  canPlaceWall(tx, ty) {
    const w = this.world;
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return false;
    if (w.getWall(tx, ty) !== WALL.NONE || w.isSolid(tx, ty)) return false;
    for (const [dx, dy] of NEIGHBORS) {
      if (w.getWall(tx + dx, ty + dy) !== WALL.NONE || w.isSolid(tx + dx, ty + dy)) return true;
    }
    return false;
  }

  /** ¿Se puede colocar ese bloque en (tx, ty)? (sin hacer cambios) */
  canPlaceAt(tx, ty, block) {
    const current = this.world.getTile(tx, ty);
    // Se puede construir encima del pasto alto y las flores (se reemplazan)
    if (current !== BLOCK.AIR && current !== BLOCK.PLANT) return false;
    if (IS_SOLID[block] && this.player.overlapsTile(tx, ty)) return false;
    return this.hasSupport(tx, ty, block);
  }

  /** Coloca lo elegido en la barra rápida (bloque, pared o mueble). Devuelve lo colocado o null. */
  tryPlace(tx, ty, inReach) {
    const placer = this.selectedPlacer();
    if (!placer) {
      if (!this.placeWarned) {
        this.placeWarned = true;
        const stack = this.inventory.selectedStack;
        this.scene.events.emit('toast', stack ? `${ITEMS[stack.id].name}: no se puede colocar` : 'Selecciona un bloque en la barra');
      }
      return null;
    }
    if (!inReach) return null;
    const spot = this.placementAt(tx, ty, placer);
    if (!spot) return null;

    if (placer.kind === 'block') this.world.setTile(tx, ty, placer.block);
    else if (placer.kind === 'wall') {
      this.world.setWall(tx, ty, placer.wall);
      // La primera vez se explica para qué sirven (no frenan: se pasa por delante)
      if (!BlockInteraction.wallHintShown) {
        BlockInteraction.wallHintShown = true;
        this.scene.events.emit('toast', 'Las paredes de fondo decoran. Para que frenen enemigos, usa bloques (tablones, piedra)');
      }
    }
    else this.furniture.place(spot.obj, spot.x0, spot.y0);
    this.inventory.removeFromSlot(this.inventory.selected, 1);
    this.player.anim.use(placer.def.icon);
    return placer;
  }

  /** ¿Lo que se colocó o quitó en (tx, ty) ya quedó hecho? (para el bloque marcado en el celular) */
  isDoneAt(tx, ty, mode) {
    const id = this.world.getTile(tx, ty);
    if (mode === 'mine') return this.selectedHammer() ? this.world.getWall(tx, ty) === WALL.NONE : id === BLOCK.AIR;
    const placer = this.selectedPlacer();
    if (placer && placer.kind === 'wall') return this.world.getWall(tx, ty) !== WALL.NONE;
    return id !== BLOCK.AIR && id !== BLOCK.PLANT;
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
    const placer = mode === 'place' ? this.selectedPlacer() : null;
    const hammer = mode === 'mine' && this.selectedHammer();
    const valid = (tx, ty) => {
      if (!this.inReach(tx, ty)) return false;
      if (this.furniture.isInteractive(tx, ty)) return true; // puertas, sillas y camas se pueden tocar
      if (mode === 'place') return this.placementAt(tx, ty, placer) !== null;
      if (hammer) return this.canHammer(tx, ty);
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
   *   Con el martillo: la primera pared de fondo. Los muebles no se eligen solos (hay que marcarlos).
   * - COLOCAR: el primer hueco donde se puede colocar lo elegido (bloque, pared o mueble).
   * aimX/aimY: dirección del joystick (0, 0 = hacia donde mira el jugador).
   */
  findSmartTarget(mode, aimX, aimY) {
    const p = this.player;
    if (p.dead) return null;
    let angle = aimX === 0 && aimY === 0 ? (p.facing > 0 ? 0 : Math.PI) : Math.atan2(aimY, aimX);
    angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4); // 8 direcciones
    const dx = Math.round(Math.cos(angle) * 1000) / 1000;
    const dy = Math.round(Math.sin(angle) * 1000) / 1000;
    const placer = mode === 'place' ? this.selectedPlacer() : null;
    if (mode === 'place' && !placer) return null;
    const hammer = mode === 'mine' && this.selectedHammer();

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
        if (hammer) {
          if (IS_SOLID[id]) break;
          if (this.canHammer(tx, ty)) {
            best = { tx, ty };
            bestT = t;
            break;
          }
        } else if (mode === 'mine') {
          if (PART[id]) continue; // un mueble no se rompe sin querer: hay que marcarlo
          if (id === BLOCK.PLANT) {
            if (!plant) plant = { tx, ty };
          } else if (id !== BLOCK.AIR) {
            best = { tx, ty };
            bestT = t;
            break;
          }
        } else {
          if (IS_SOLID[id]) break; // no se coloca a través de paredes
          if (PART[id]) continue; // sobre un mueble, "colocar" lo usaría: el recuadro automático lo saltea
          if (this.placementAt(tx, ty, placer)) {
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
