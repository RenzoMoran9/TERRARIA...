import Phaser from 'phaser';
import { textStyle, COLORS } from './styles.js';
import { createButton } from './Button.js';
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from '../config.js';
import { MAP_TEXTURE } from '../systems/WorldMap.js';
import { ZONE_INFO, ZONE, UNDERWORLD_TOP } from '../world/WorldGenerator.js';

const T = TILE_SIZE;
const NPC_ICON = { guide: 'ui_map_guide', merchant: 'ui_map_merchant', nurse: 'ui_map_nurse' };
const ZOOMS = [1, 2, 4, 8]; // píxeles por bloque del mapa completo (además de "todo el mundo")
const ARROW_FAR = 36; // bloques: más lejos que esto aparece la flecha hacia tu casa

/** "120 al Este", "35 de profundidad"…: como la brújula y el medidor de profundidad de Terraria. */
export function locationText(gs, tx, ty, { compass = true, depth = true } = {}) {
  const out = [];
  if (compass) {
    const dx = Math.round(tx - gs.spawn.x / T);
    out.push(Math.abs(dx) < 2 ? 'en el centro' : `${Math.abs(dx)} al ${dx > 0 ? 'Este' : 'Oeste'}`);
  }
  if (depth) {
    const g = gs.world.generator;
    const d = Math.round(ty - g.surface[Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(tx)))]);
    if (ty >= UNDERWORLD_TOP - 2) out.push(`Inframundo (${d} de profundidad)`);
    else if (d < -12) out.push(`${-d} en el cielo`);
    else if (Math.abs(d) <= 2) out.push('en la superficie');
    else if (d < 0) out.push(`${-d} sobre la superficie`);
    else out.push(`${d} de profundidad`);
  }
  return out.join(' · ');
}

/** Dirección hacia un punto en palabras ("300 bloques al Oeste y 40 hacia abajo"). */
function directionText(fromX, fromY, toX, toY) {
  const dx = Math.round(toX - fromX);
  const dy = Math.round(toY - fromY);
  const parts = [];
  if (Math.abs(dx) >= 2) parts.push(`${Math.abs(dx)} bloques al ${dx > 0 ? 'Este' : 'Oeste'}`);
  if (Math.abs(dy) >= 3) parts.push(`${Math.abs(dy)} hacia ${dy > 0 ? 'abajo' : 'arriba'}`);
  return parts.length ? parts.join(' y ') : 'aquí mismo';
}

/** Íconos del mapa: jugador, tu casa, aldeanos y marcadores (en coordenadas de bloque). */
function mapMarkers(gs) {
  const p = gs.player;
  const home = gs.homeSpot();
  const list = [{ key: 'pin', icons: gs.worldMap.pins.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5, tex: 'ui_map_pin' })) }];
  list.push({ key: 'npc', icons: gs.npcs.list.map((n) => ({ x: n.centerX / T, y: n.centerY / T, tex: NPC_ICON[n.type] || 'ui_map_guide' })) });
  list.push({ key: 'home', icons: [{ x: (home.x + p.w / 2) / T, y: (home.y + p.h / 2) / T, tex: 'ui_map_home' }] });
  list.push({ key: 'player', icons: [{ x: p.centerX / T, y: p.centerY / T, tex: 'ui_map_player' }] });
  return list.flatMap((g) => g.icons);
}

/** Pool de imágenes para los íconos (se reusan cada frame). */
class IconPool {
  constructor(scene, container, size) {
    this.scene = scene;
    this.container = container;
    this.size = size;
    this.list = [];
  }

  draw(icons, toScreen, rect) {
    let n = 0;
    for (const ic of icons) {
      const [x, y] = toScreen(ic.x, ic.y);
      if (x < rect.x - 2 || y < rect.y - 2 || x > rect.x + rect.w + 2 || y > rect.y + rect.h + 2) continue;
      let img = this.list[n];
      if (!img) {
        img = this.scene.add.image(0, 0, ic.tex);
        if (this.container) this.container.add(img);
        this.list.push(img);
      }
      img.setTexture(ic.tex).setDisplaySize(this.size, this.size).setPosition(Math.round(x), Math.round(y)).setVisible(true);
      n++;
    }
    for (let i = n; i < this.list.length; i++) this.list[i].setVisible(false);
  }
}

/** Ventana de mapa: muestra un rectángulo de la textura del mapa con zoom (recortando la imagen). */
class MapView {
  constructor(scene, container) {
    this.scene = scene;
    this.bg = scene.add.rectangle(0, 0, 10, 10, 0x0b1020, 0.92).setOrigin(0);
    this.img = scene.add.image(0, 0, MAP_TEXTURE).setOrigin(0);
    this.frame = scene.add.rectangle(0, 0, 10, 10).setOrigin(0).setStrokeStyle(2, COLORS.panelBorder, 0.9);
    container.add([this.bg, this.img, this.frame]);
    this.rect = { x: 0, y: 0, w: 10, h: 10 };
    this.zoom = 2;
    this.cx = 0; // centro de la vista (en bloques)
    this.cy = 0;
  }

  setRect(x, y, w, h) {
    this.rect = { x, y, w, h };
    this.bg.setPosition(x, y).setSize(w, h);
    this.frame.setPosition(x, y).setSize(w, h);
  }

  /** Bloque → pantalla (dentro del contenedor). */
  toScreen = (tx, ty) => [this.rect.x + this.rect.w / 2 + (tx - this.cx) * this.zoom, this.rect.y + this.rect.h / 2 + (ty - this.cy) * this.zoom];

  /** Pantalla → bloque. */
  toTile(sx, sy) {
    return [this.cx + (sx - this.rect.x - this.rect.w / 2) / this.zoom, this.cy + (sy - this.rect.y - this.rect.h / 2) / this.zoom];
  }

  render() {
    const r = this.rect;
    const z = this.zoom;
    // Parte del mundo que entra en la ventana
    const tx0 = this.cx - r.w / 2 / z;
    const ty0 = this.cy - r.h / 2 / z;
    const cx0 = Math.max(0, Math.floor(tx0));
    const cy0 = Math.max(0, Math.floor(ty0));
    const cx1 = Math.min(WORLD_WIDTH, Math.ceil(tx0 + r.w / z));
    const cy1 = Math.min(WORLD_HEIGHT, Math.ceil(ty0 + r.h / z));
    if (cx1 <= cx0 || cy1 <= cy0) {
      this.img.setVisible(false);
      return;
    }
    // Recorte en bloques enteros; la imagen se corre para que el bloque caiga en su lugar
    const fx0 = Math.max(cx0, Math.ceil(tx0));
    const fy0 = Math.max(cy0, Math.ceil(ty0));
    const fx1 = Math.min(cx1, Math.floor(tx0 + r.w / z));
    const fy1 = Math.min(cy1, Math.floor(ty0 + r.h / z));
    if (fx1 <= fx0 || fy1 <= fy0) {
      this.img.setVisible(false);
      return;
    }
    this.img.setVisible(true).setScale(z).setCrop(fx0, fy0, fx1 - fx0, fy1 - fy0);
    const [ox, oy] = this.toScreen(0, 0);
    this.img.setPosition(ox, oy);
  }
}

/** Minimapa: arriba a la derecha (PC) o bajo el nivel (celular); tocarlo abre el mapa completo. */
export class Minimap {
  constructor(scene, gs) {
    this.scene = scene;
    this.gs = gs;
    this.visible = true;
    this.container = scene.add.container(0, 0).setDepth(9);
    this.view = new MapView(scene, this.container);
    this.icons = new IconPool(scene, this.container, 14);
    this.info = scene.add.text(0, 0, '', textStyle({ fontSize: '12px', color: '#d8e4ff' })).setDepth(10);
    this.hit = scene.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive({ useHandCursor: true });
    this.hit.on('pointerdown', (pointer, lx, ly, event) => {
      event?.stopPropagation?.();
      scene.toggleMap(true);
    });
    this.container.add(this.hit);
    this.infoTimer = 0;
  }

  layout(x, y, w, h, zoom, alignRight) {
    this.view.setRect(0, 0, w, h);
    this.view.zoom = zoom;
    this.container.setPosition(x, y);
    this.hit.setSize(w, h);
    if (this.hit.input) this.hit.input.hitArea.setTo(0, 0, w, h);
    this.info.setOrigin(alignRight ? 1 : 0, 0).setPosition(alignRight ? x + w : x, y + h + 3);
    this.box = { x, y, w, h };
  }

  setVisible(v) {
    this.visible = v;
    this.container.setVisible(v);
    this.info.setVisible(v || this.info.text !== '');
  }

  update(dt) {
    const gs = this.gs;
    const p = gs.player;
    // Brújula y medidor de profundidad: se leen si los llevas en el inventario
    this.infoTimer -= dt;
    if (this.infoTimer <= 0) {
      this.infoTimer = 0.25;
      const compass = gs.inventory.count('compass') > 0;
      const depth = gs.inventory.count('depth_meter') > 0;
      this.info.setText(compass || depth ? locationText(gs, p.centerX / T, p.centerY / T, { compass, depth }) : '');
    }
    if (!this.visible) return;
    this.view.cx = p.centerX / T;
    this.view.cy = p.centerY / T;
    this.view.render();
    this.icons.draw(mapMarkers(gs), this.view.toScreen, this.view.rect);
  }
}

/**
 * Mapa completo (tecla M, el botón Mapa del inventario o tocando el minimapa): todo lo
 * descubierto, con zoom y arrastrable; tocar el mapa pone o quita un marcador.
 */
export class FullMap {
  constructor(scene, gs) {
    this.scene = scene;
    this.gs = gs;
    this.isOpen = false;
    this.zoomIndex = -1; // -1 = todo el mundo
    this.container = scene.add.container(0, 0).setDepth(40).setVisible(false);
    this.blocker = scene.add.rectangle(0, 0, 10, 10, 0x05070f, 0.9).setOrigin(0).setInteractive();
    this.container.add(this.blocker);
    this.view = new MapView(scene, this.container);
    this.labels = scene.add.container(0, 0);
    this.container.add(this.labels);
    this.icons = new IconPool(scene, this.container, 20);
    this.title = scene.add.text(0, 0, 'Mapa del mundo', textStyle({ fontSize: '20px', color: '#ffe28a' }));
    this.hint = scene.add.text(0, 0, '', textStyle({ fontSize: '12px', color: '#c8d2ff' }));
    this.coords = scene.add.text(0, 0, '', textStyle({ fontSize: '13px', lineSpacing: 3 }));
    this.container.add([this.title, this.hint, this.coords]);
    this.buttons = [
      ['−', () => this.zoomBy(-1)],
      ['+', () => this.zoomBy(1)],
      ['Yo', () => this.centerOn('player')],
      ['Casa', () => this.centerOn('home')],
      ['X', () => scene.toggleMap(false)],
    ].map(([label, fn]) => {
      const b = createButton(scene, 0, 0, label.length > 1 && label !== 'Yo' ? 70 : 40, 32, label, fn, { fontSize: '16px' });
      this.container.add(b);
      return b;
    });
    this.zoneLabels = null;

    // Arrastrar mueve el mapa; un toque (sin arrastrar) pone o quita un marcador
    this.drag = null;
    this.blocker.on('pointerdown', (pointer) => {
      if (!this._inView(pointer)) return;
      this.drag = { id: pointer.id, x: pointer.x, y: pointer.y, cx: this.view.cx, cy: this.view.cy, moved: false };
    });
    scene.input.on('pointermove', (pointer) => {
      const d = this.drag;
      if (!this.isOpen || !d || d.id !== pointer.id || !pointer.isDown) return;
      const dx = pointer.x - d.x;
      const dy = pointer.y - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true;
      if (!d.moved) return;
      const s = this.container.scale;
      this.view.cx = d.cx - dx / s / this.view.zoom;
      this.view.cy = d.cy - dy / s / this.view.zoom;
      this._clamp();
    });
    scene.input.on('pointerup', (pointer) => {
      const d = this.drag;
      if (!this.isOpen || !d || d.id !== pointer.id) return;
      this.drag = null;
      if (!d.moved && this._inView(pointer)) this._tapPin(pointer);
    });
    scene.input.on('wheel', (pointer, over, dx, dy) => {
      if (this.isOpen && dy) this.zoomBy(dy > 0 ? -1 : 1);
    });
  }

  _local(pointer) {
    const s = this.container.scale;
    return [(pointer.x - this.container.x) / s, (pointer.y - this.container.y) / s];
  }

  _inView(pointer) {
    const [x, y] = this._local(pointer);
    const r = this.view.rect;
    return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
  }

  _tapPin(pointer) {
    const [lx, ly] = this._local(pointer);
    const [tx, ty] = this.view.toTile(lx, ly);
    const near = Math.max(2, Math.round(10 / this.view.zoom));
    const r = this.gs.worldMap.togglePin(Math.floor(tx), Math.floor(ty), near);
    if (r === 'full') this.scene.toast.show('Ya tienes 8 marcadores: toca uno para quitarlo');
    else this.scene.toast.show(r === 'added' ? 'Marcador puesto: una flecha roja te guía hasta él' : 'Marcador quitado');
  }

  layout(width, height) {
    this.width = width;
    this.height = height;
    this.blocker.setSize(width, height);
    if (this.blocker.input) this.blocker.input.hitArea.setTo(0, 0, width, height);
    const m = 12;
    const top = 40;
    const bottom = 48;
    this.title.setPosition(m, 8);
    this.hint.setPosition(m + 170, 14);
    this.view.setRect(m, top, width - m * 2, height - top - bottom);
    this.coords.setPosition(m, height - bottom + 6);
    let bx = width - m;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      const w = b.bg.width;
      b.setPosition(bx - w / 2, 22);
      bx -= w + 6;
    }
    this.hint.setVisible(width > 640);
    this._fitZoom = Math.min((width - m * 2) / WORLD_WIDTH, (height - top - bottom) / WORLD_HEIGHT);
    if (this.isOpen) this._applyZoom();
  }

  open() {
    this.isOpen = true;
    this.container.setVisible(true);
    this.hint.setText(this.gs.isTouch ? 'Arrastra para moverte · toca para poner un marcador' : 'Arrastra o usa la rueda · clic para poner o quitar un marcador');
    if (this.zoomIndex === -1 && this.view.zoom === 2) this.zoomIndex = 1;
    this._applyZoom();
    this.centerOn('player');
  }

  close() {
    this.isOpen = false;
    this.drag = null;
    this.container.setVisible(false);
  }

  zoomBy(d) {
    this.zoomIndex = Phaser.Math.Clamp(this.zoomIndex + d, -1, ZOOMS.length - 1);
    this._applyZoom();
  }

  _applyZoom() {
    this.view.zoom = this.zoomIndex < 0 ? this._fitZoom : ZOOMS[this.zoomIndex];
    this._clamp();
  }

  centerOn(what) {
    const gs = this.gs;
    if (what === 'home') {
      const h = gs.homeSpot();
      this.view.cx = (h.x + gs.player.w / 2) / T;
      this.view.cy = (h.y + gs.player.h / 2) / T;
    } else {
      this.view.cx = gs.player.centerX / T;
      this.view.cy = gs.player.centerY / T;
    }
    this._clamp();
  }

  _clamp() {
    const v = this.view;
    const hw = v.rect.w / 2 / v.zoom;
    const hh = v.rect.h / 2 / v.zoom;
    v.cx = hw * 2 >= WORLD_WIDTH ? WORLD_WIDTH / 2 : Phaser.Math.Clamp(v.cx, hw, WORLD_WIDTH - hw);
    v.cy = hh * 2 >= WORLD_HEIGHT ? WORLD_HEIGHT / 2 : Phaser.Math.Clamp(v.cy, hh, WORLD_HEIGHT - hh);
  }

  /** Nombres de las zonas descubiertas, sobre la superficie (y las especiales donde están). */
  _zoneLabelSpots() {
    if (this.zoneLabels) return this.zoneLabels;
    const g = this.gs.world.generator;
    const spots = [];
    let start = 0;
    for (let x = 1; x <= WORLD_WIDTH; x++) {
      if (x < WORLD_WIDTH && g.biome[x] === g.biome[start]) continue;
      const mid = Math.floor((start + x - 1) / 2);
      if (x - start > 40) spots.push({ zone: g.biome[start], x: mid, y: g.surface[mid] - 14 });
      start = x;
    }
    for (const is of g.islands || []) spots.push({ zone: ZONE.SKY, x: is.cx, y: is.top - 6 });
    spots.push({ zone: ZONE.UNDERWORLD, x: Math.floor(g.spawnX), y: UNDERWORLD_TOP + 10 });
    this.zoneLabels = spots;
    return spots;
  }

  _drawLabels() {
    const gs = this.gs;
    const spots = this._zoneLabelSpots();
    const show = this.view.zoom >= 0.4;
    let n = 0;
    for (const s of spots) {
      if (!show || !gs.zones.discovered.has(s.zone) || !gs.worldMap.isExplored(s.x, Math.min(WORLD_HEIGHT - 1, s.y + 14))) continue;
      const [x, y] = this.view.toScreen(s.x, s.y);
      const r = this.view.rect;
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      let t = this.labels.list[n];
      if (!t) {
        t = this.scene.add.text(0, 0, '', textStyle({ fontSize: '12px', color: '#ffe8a8' })).setOrigin(0.5);
        this.labels.add(t);
      }
      t.setText(ZONE_INFO[s.zone].name).setPosition(Math.round(x), Math.round(y)).setVisible(true);
      n++;
    }
    for (let i = n; i < this.labels.list.length; i++) this.labels.list[i].setVisible(false);
  }

  update() {
    if (!this.isOpen) return;
    const gs = this.gs;
    const p = gs.player;
    this.view.render();
    this._drawLabels();
    this.icons.draw(mapMarkers(gs), this.view.toScreen, this.view.rect);
    const home = gs.homeSpot();
    const ptx = p.centerX / T;
    const pty = p.centerY / T;
    const homeTxt = directionText(ptx, pty, (home.x + p.w / 2) / T, (home.y + p.h / 2) / T);
    const pct = Math.round((gs.worldMap.exploredCount / (WORLD_WIDTH * WORLD_HEIGHT)) * 1000) / 10;
    this.coords.setText(`Tú: ${locationText(gs, ptx, pty)}   ·   ${home.bed ? 'Tu cama' : 'El inicio'}: ${homeTxt}\nExplorado: ${pct}% del mundo`);
  }
}

/** Flechas en el borde de la pantalla que apuntan a tu casa y a tus marcadores cuando están lejos. */
export class HomeArrows {
  constructor(scene, gs) {
    this.scene = scene;
    this.gs = gs;
    this.items = [];
  }

  _item(i) {
    let it = this.items[i];
    if (!it) {
      const arrow = this.scene.add.triangle(0, 0, 0, -9, 16, 0, 0, 9, 0xffffff).setOrigin(0.5).setDepth(8).setStrokeStyle(2, 0x1a120c);
      const icon = this.scene.add.image(0, 0, 'ui_map_home').setDepth(8);
      const text = this.scene.add.text(0, 0, '', textStyle({ fontSize: '11px', strokeThickness: 3 })).setOrigin(0.5, 0).setDepth(8);
      it = { arrow, icon, text };
      this.items.push(it);
    }
    return it;
  }

  update() {
    const gs = this.gs;
    const p = gs.player;
    const cam = gs.cameras.main;
    const v = cam.worldView;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const targets = [];
    if (!p.dead && !gs.uiBlocking) {
      const h = gs.homeSpot();
      targets.push({ x: h.x + p.w / 2, y: h.y + p.h / 2, tex: 'ui_map_home', color: 0xffe28a });
      for (const q of gs.worldMap.pins) targets.push({ x: (q.x + 0.5) * T, y: (q.y + 0.5) * T, tex: 'ui_map_pin', color: 0xff6a6a });
    }
    let n = 0;
    for (const t of targets) {
      const dist = Math.hypot(t.x - p.centerX, t.y - p.centerY) / T;
      const sx = (t.x - v.x) * cam.zoom;
      const sy = (t.y - v.y) * cam.zoom;
      if (dist < ARROW_FAR || (sx > 0 && sy > 0 && sx < W && sy < H)) continue;
      // Desde el centro de la pantalla hacia el objetivo, hasta el borde (con margen)
      const cx = W / 2;
      const cy = H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const mx = W / 2 - 46;
      const my = H / 2 - 70;
      const k = Math.min(mx / Math.max(1e-6, Math.abs(Math.cos(ang))), my / Math.max(1e-6, Math.abs(Math.sin(ang))));
      const ax = cx + Math.cos(ang) * k;
      const ay = cy + Math.sin(ang) * k;
      const it = this._item(n++);
      it.arrow.setPosition(ax + Math.cos(ang) * 16, ay + Math.sin(ang) * 16).setRotation(ang).setFillStyle(t.color).setVisible(true);
      it.icon.setTexture(t.tex).setDisplaySize(20, 20).setPosition(ax, ay).setVisible(true);
      it.text.setText(`${Math.round(dist)}`).setPosition(ax, ay + 11).setVisible(true);
    }
    for (let i = n; i < this.items.length; i++) {
      const it = this.items[i];
      it.arrow.setVisible(false);
      it.icon.setVisible(false);
      it.text.setVisible(false);
    }
  }
}
