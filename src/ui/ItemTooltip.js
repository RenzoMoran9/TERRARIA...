import { ITEMS, ARMOR_SETS, getMaxStack } from '../systems/items.js';
import { BLOCK, BLOCK_DEFS, IS_SOLID, LIGHT_EMIT } from '../world/blocks.js';
import { TILE_SIZE } from '../config.js';
import { textStyle, COLORS } from './styles.js';

const HOLD_MS = 380; // mantener apretado este tiempo (celular) muestra la info
const HOVER_MS = 300; // con el ratón, basta con pasar por encima

// Para qué sirve cada material o mueble
const USES = {
  wood: 'Material básico: tablones, antorchas, arcos, flechas…',
  planks: 'Bloque sólido de construcción. Material de casi todo lo de madera',
  dirt: 'Bloque. También se hace pared de tierra',
  stone: 'Bloque. Material de herramientas, armas, horno y ladrillos',
  coal: 'Para hacer antorchas',
  gel: 'Lo sueltan los slimes. Sirve para hacer antorchas',
  iron_ore: 'Se funde en el horno: 3 minerales → 1 lingote',
  iron_bar: 'Para el yunque y las herramientas y armas de hierro',
  torch: 'Ilumina alrededor. Se puede llevar en la mano',
  workbench: 'Estación de crafteo: hay que estar cerca para muchas recetas',
  stone_brick: 'Bloque sólido y resistente para construir',
  door: 'Se abre sola al pasar. Los zombis no pueden abrirla',
  chair: 'Para sentarse: toda casa necesita una silla o una cama',
  table: 'Superficie: toda casa necesita una (mesa o mesa de trabajo)',
  bed: 'Punto de reaparición. De noche, dormir hace pasar la noche rápido',
  furnace: 'Estación: funde hierro y hace ladrillos. Ilumina',
  anvil: 'Estación: herramientas y armas de hierro',
  chest: 'Guarda hasta 30 pilas de objetos',
  wood_platform: 'Se pisa desde arriba y se atraviesa saltando desde abajo; para bajar, aprieta abajo. Sirve de escalera y de entrada a una casa',
  glass: 'Bloque sólido transparente: deja pasar la luz',
  glass_wall: 'Pared de fondo con forma de ventana: desde adentro se ve el paisaje; desde afuera, una ventana',
  red_shingles: 'Bloque sólido para techos',
  wood_shingles: 'Bloque sólido para techos',
  sand: 'Bloque. En el Horno se funde en vidrio',
  gold_ore: 'Se funde en el horno: 4 minerales → 1 lingote. Hace falta pico de hierro',
  gold_bar: 'Para el pico, la espada, el arco y la armadura de oro (en el yunque)',
  hellstone: 'Del inframundo. Hace falta pico de oro. Con 1 basalto se funde en lingote infernal',
  hellstone_bar: 'Lo mejor: pico, espada y armadura infernales',
  glowing_mushroom: 'De las cuevas de hongos. Con 2 pociones menores hace 2 pociones de curación',
  cloud: 'Bloque de las islas flotantes',
  flower: 'Sale de las flores. Sirve para pociones de curación (con gel y vidrio)',
};

const TIERS = { 1: 'piedra y carbón', 2: 'hierro, cristal y piedra sombría', 3: 'oro', 4: 'piedra infernal', 5: 'todo' };
const WEAPON_KIND = {
  swing: 'Arma cuerpo a cuerpo',
  thrust: 'Lanza: estocada larga',
  bow: 'Arco: dispara flechas',
  boomerang: 'Bumerán: va, golpea y vuelve',
  throw: 'Arma arrojadiza: se gasta al lanzarla',
};

const knock = (k) => (k >= 450 ? 'muy fuerte' : k >= 260 ? 'fuerte' : k >= 160 ? 'medio' : 'débil');
const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Título y líneas de información de un ítem. */
export function describeItem(id) {
  const d = ITEMS[id];
  const lines = [];
  if (d.weapon) {
    const w = d.weapon;
    const kind = w.kind || 'swing';
    const ranged = kind === 'bow' || kind === 'boomerang' || kind === 'throw';
    const arrow = kind === 'bow' ? ITEMS.wood_arrow.ammo.damage : 0;
    lines.push(WEAPON_KIND[kind]);
    lines.push(`Daño: ${w.damage}${arrow ? ` (+${arrow} de la flecha)` : ''}`);
    lines.push(`Velocidad: ${fmt(w.speed)} ${ranged ? 'disparos' : 'golpes'} por segundo`);
    lines.push(`Daño por segundo: ${Math.round((w.damage + arrow) * w.speed)} aprox.`);
    if (w.reach) lines.push(`Alcance: ${fmt(w.reach / TILE_SIZE)} bloques`);
    else lines.push('Alcance: a distancia');
    lines.push(`Empuje: ${knock(w.knockback)}`);
    if (kind === 'bow') lines.push('Gasta 1 flecha por disparo');
  } else if (d.armor) {
    const a = d.armor;
    const set = ARMOR_SETS[a.set];
    lines.push(`Armadura (${a.slot === 'head' ? 'casco' : a.slot === 'body' ? 'pechera' : 'grebas'})`);
    lines.push(`Defensa: ${a.defense}`);
    lines.push(`Juego completo de ${set.name}: +${set.bonus} de defensa`);
    lines.push('Cada golpe te quita la mitad de tu defensa menos');
    lines.push('Para ponértela: arrástrala a su casilla (o clic derecho)');
  } else if (d.use) {
    if (d.use.heal) {
      lines.push(`Cura ${d.use.heal} de vida`);
      lines.push('Después hay que esperar 45 s para tomar otra');
      lines.push('Úsala eligiéndola y con la acción, o con R / el botón de poción');
    } else if (d.use.maxHealth) {
      lines.push(`+${d.use.maxHealth} de vida máxima, para siempre (hasta 15)`);
      lines.push('Se encuentran en el piso de las cuevas, bien abajo');
    } else if (d.use.recall) {
      lines.push('Te lleva de vuelta a tu cama (o al inicio del mundo)');
      lines.push(d.use.keep ? 'No se gasta: úsalo cuantas veces quieras' : 'Se gasta al usarla');
      lines.push('Úsalo eligiéndolo y con la acción');
    }
  } else if (d.info) {
    lines.push(d.info === 'compass' ? 'Con ella en el inventario ves cuántos bloques estás al Este u Oeste del inicio' : 'Con él en el inventario ves a qué profundidad estás');
    lines.push('Se lee arriba a la derecha, bajo el nombre de la zona');
  } else if (d.tool) {
    lines.push('Pico');
    lines.push(`Puede minar: ${TIERS[d.tool.tier] || 'tierra y madera'}${d.tool.tier > 1 && d.tool.tier < 5 ? ' (y todo lo anterior)' : ''}`);
    lines.push(`Velocidad de minado: ×${fmt(d.tool.speed)}`);
    lines.push('Se usa solo: siempre minas con tu mejor pico');
  } else if (d.hammer) {
    lines.push('Martillo: quita paredes de fondo');
    lines.push(`Velocidad: ×${fmt(d.hammer.speed)}`);
  } else if (d.ammo) {
    lines.push('Munición para arcos');
    lines.push(`Daño extra: +${d.ammo.damage}`);
  } else if (d.wall !== undefined) {
    lines.push('Pared de fondo: va DETRÁS del personaje (se pasa por delante)');
    lines.push('Rellena el interior de las casas: desde afuera se ve como el frente de la casa');
    lines.push('Evita que aparezcan enemigos adentro');
  } else if (d.object !== undefined) {
    lines.push('Mueble');
  } else if (d.places !== undefined) {
    const b = d.places;
    lines.push(IS_SOLID[b] ? 'Bloque sólido (frena a los enemigos)' : 'Se coloca (no es sólido)');
    if (LIGHT_EMIT[b] > 0) lines.push('Da luz');
    if (b !== BLOCK.TORCH && BLOCK_DEFS[b].tier > 0) lines.push(`Para minarlo hace falta pico nivel ${BLOCK_DEFS[b].tier}`);
  } else {
    lines.push('Material');
  }
  if (USES[id]) lines.push(USES[id]);
  const max = getMaxStack(id);
  lines.push(max > 1 ? `Se apila hasta ${max}` : 'No se apila');
  return { title: d.name, lines };
}

/**
 * Cartel con la información de un ítem: aparece al MANTENER APRETADA una casilla (celular)
 * o al pasar el ratón por encima (PC). attach() se encarga de los toques: un toque corto
 * hace la acción normal de la casilla; mantener apretado solo muestra la información.
 */
export class ItemTooltip {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(60).setVisible(false);
    this.bg = scene.add.rectangle(0, 0, 10, 10, COLORS.panel, 0.97).setOrigin(0).setStrokeStyle(2, 0xffd84a);
    this.title = scene.add.text(10, 8, '', textStyle({ fontSize: '16px', color: '#ffe28a' }));
    this.body = scene.add.text(10, 30, '', textStyle({ fontSize: '13px', strokeThickness: 2, lineSpacing: 3 }));
    this.container.add([this.bg, this.title, this.body]);
    this.timer = null;
    this.hideTimer = null;
    this.shownBy = null; // objeto que lo está mostrando
  }

  show(id, x, y) {
    if (!id || !ITEMS[id]) return;
    const { title, lines } = describeItem(id);
    this.title.setText(title);
    this.body.setText(lines.join('\n'));
    const w = Math.max(this.title.width, this.body.width) + 20;
    const h = this.body.y + this.body.height + 10;
    this.bg.setSize(w, h);
    // Al lado del dedo/ratón, sin salirse de la pantalla
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    let px = x + 18;
    let py = y - h - 12;
    if (px + w > W - 6) px = x - w - 18;
    if (px < 6) px = Math.max(6, Math.min(W - w - 6, x - w / 2));
    if (py < 6) py = Math.min(H - h - 6, y + 24);
    this.container.setPosition(Math.round(px), Math.round(py)).setVisible(true);
    if (this.hideTimer) this.hideTimer.remove();
    this.hideTimer = null;
  }

  hide() {
    this.container.setVisible(false);
    this.shownBy = null;
  }

  cancel() {
    if (this.timer) this.timer.remove();
    this.timer = null;
  }

  /**
   * obj: casilla interactiva. getId(): ítem que muestra. onTap(pointer): acción normal.
   * Ratón: la acción va al apretar (como siempre) y la info al pasar por encima.
   * Táctil: la acción va al soltar si fue un toque corto; mantener apretado muestra la info.
   */
  attach(obj, getId, onTap) {
    obj.on('pointerdown', (pointer) => {
      this.cancel();
      if (!pointer.wasTouch) {
        if (onTap) onTap(pointer);
        return;
      }
      obj._longPress = false;
      this.timer = this.scene.time.delayedCall(HOLD_MS, () => {
        obj._longPress = true;
        this.shownBy = obj;
        this.show(getId(), pointer.x, pointer.y);
      });
    });
    obj.on('pointerup', (pointer) => {
      if (!pointer.wasTouch) return;
      this.cancel();
      if (obj._longPress) {
        // Queda un momento a la vista después de soltar, para leerlo
        this.hideTimer = this.scene.time.delayedCall(1800, () => this.hide());
      } else if (onTap) onTap(pointer);
      obj._longPress = false;
    });
    obj.on('pointerover', (pointer) => {
      if (pointer.wasTouch) return;
      this.cancel();
      this.timer = this.scene.time.delayedCall(HOVER_MS, () => {
        this.shownBy = obj;
        this.show(getId(), pointer.x, pointer.y);
      });
    });
    obj.on('pointerout', (pointer) => {
      this.cancel();
      if (!pointer.wasTouch && this.shownBy === obj) this.hide();
    });
  }
}
