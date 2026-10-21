import { textStyle, COLORS } from './styles.js';
import { createButton } from './Button.js';
import { PET_MODES, PET_TYPES } from '../systems/Pets.js';

const W = 600;
const ROW_H = 74;
const PAD = 14;
const MODES = ['follow', 'stay', 'attack', 'home'];

/**
 * Panel de mascotas (tecla G, botón de la huella o tocando a tu mascota): vida, nivel y órdenes
 * (Sígueme, Quieto, ¡Ataca!, A casa), acariciar y dejar libre.
 */
export class PetPanel {
  constructor(scene, gs) {
    this.scene = scene;
    this.gs = gs;
    this.isOpen = false;
    this.blocker = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.3).setOrigin(0).setDepth(33).setVisible(false);
    this.blocker.setInteractive().on('pointerdown', () => scene.togglePets(false));
    this.container = scene.add.container(0, 0).setDepth(34).setVisible(false);
    this.bg = scene.add.rectangle(0, 0, W, 100, COLORS.panel, 0.96).setOrigin(0).setStrokeStyle(2, COLORS.panelBorder).setInteractive();
    this.title = scene.add.text(PAD, PAD - 2, 'Mascotas', textStyle({ fontSize: '20px', color: '#ffe28a' }));
    this.hint = scene.add.text(PAD + 120, PAD + 4, '', textStyle({ fontSize: '12px', color: '#c8d2ff' }));
    const close = createButton(scene, W - 22, 22, 28, 28, 'X', () => scene.togglePets(false), { fontSize: '16px' });
    this.container.add([this.bg, this.title, this.hint, close]);
    this.rows = [];
    this.empty = scene.add
      .text(PAD, 52, '', textStyle({ fontSize: '14px', wordWrap: { width: W - PAD * 2 }, lineSpacing: 4 }))
      .setVisible(false);
    this.container.add(this.empty);
  }

  layout(width, height) {
    this.width = width;
    this.height = height;
    this.blocker.setSize(width, height);
    if (this.blocker.input) this.blocker.input.hitArea.setSize(width, height);
    this._place();
  }

  _place() {
    const h = this.bg.height;
    const s = Math.min(1, (this.width - 16) / W, (this.height - 16) / h);
    this.container.setScale(s).setPosition(Math.round((this.width - W * s) / 2), Math.round((this.height - h * s) / 2));
  }

  open() {
    this.isOpen = true;
    this.blocker.setVisible(true);
    this.container.setVisible(true);
    this.hint.setText(this.gs.isTouch ? 'Toca una orden para cada mascota' : 'G abre o cierra este panel');
    this._build();
  }

  close() {
    this.isOpen = false;
    this.blocker.setVisible(false);
    this.container.setVisible(false);
  }

  _build() {
    for (const r of this.rows) for (const o of r.objects) o.destroy();
    this.rows = [];
    const pets = this.gs.pets.list;
    const scene = this.scene;
    this.empty.setVisible(!pets.length);
    if (!pets.length) {
      this.empty.setText(
        `Todavía no tienes mascotas.\n• Perros: aparecen en el Bosque de día. Dale ${PET_TYPES.dog.bones} hueso.\n• Lobos: en la Tundra (y de noche en el Bosque). Dale ${PET_TYPES.wolf.bones} huesos.\nLos huesos los sueltan los zombis y los vende el Comerciante. Para dárselo: tócalo (celular) o clic derecho (PC).`,
      );
    }
    pets.forEach((pet, i) => {
      const y = 48 + i * ROW_H;
      const icon = scene.add.image(PAD + 26, y + 30, pet.def.texture, 0).setDisplaySize(pet.def.spriteW * 1.3, pet.def.spriteH * 1.3);
      const name = scene.add.text(PAD + 60, y + 2, '', textStyle({ fontSize: '15px', color: '#ffe8a8' }));
      const hpBg = scene.add.rectangle(PAD + 60, y + 26, 120, 8, 0x0b1030).setOrigin(0, 0.5).setStrokeStyle(1, 0x000000);
      const hp = scene.add.rectangle(PAD + 60, y + 26, 120, 8, 0x6ee06e).setOrigin(0, 0.5);
      const info = scene.add.text(PAD + 60, y + 34, '', textStyle({ fontSize: '11px', color: '#c8d2ff' }));
      const objects = [icon, name, hpBg, hp, info];
      const buttons = {};
      MODES.forEach((m, k) => {
        const b = createButton(scene, PAD + 248 + k * 74, y + 18, 70, 30, PET_MODES[m].label, () => {
          this.gs.pets.command(pet, m);
          this.refresh();
        }, { fontSize: '13px' });
        buttons[m] = b;
        objects.push(b);
      });
      objects.push(
        createButton(scene, PAD + 285, y + 52, 144, 24, '❤ Acariciar', () => {
          this.gs.pets.pat(pet);
          this.refresh();
        }, { fontSize: '12px' }),
        createButton(scene, PAD + 471, y + 52, 144, 24, 'Dejar libre', () => {
          this.gs.pets.release(pet);
          this._build();
        }, { fontSize: '12px', color: 0x6a2a2a }),
      );
      this.container.add(objects);
      this.rows.push({ pet, name, hp, info, buttons, objects });
    });
    this.bg.height = pets.length ? 54 + pets.length * ROW_H : 160;
    this.bg.setSize(W, this.bg.height);
    if (this.bg.input) this.bg.input.hitArea.setSize(W, this.bg.height);
    this._place();
    this.refresh();
  }

  refresh() {
    if (!this.isOpen) return;
    for (const r of this.rows) {
      const p = r.pet;
      r.name.setText(`${p.name} · ${p.pdef.name} · Nivel ${p.level}`);
      r.hp.setSize(120 * Math.max(0, p.hp / p.maxHp), 8).setFillStyle(p.ko > 0 ? 0x777777 : p.hp / p.maxHp > 0.4 ? 0x6ee06e : 0xe05050);
      r.info.setText(p.ko > 0 ? `Desmayada (${Math.ceil(p.ko)} s)` : `Vida ${Math.ceil(p.hp)}/${p.maxHp} · Mordida ${p.statDamage}`);
      for (const [m, b] of Object.entries(r.buttons)) b.bg.setFillStyle(m === p.mode ? 0x2f7a40 : COLORS.button, 0.95);
    }
  }
}
