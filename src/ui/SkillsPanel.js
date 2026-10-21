import { textStyle, COLORS } from './styles.js';
import { createButton } from './Button.js';
import { SKILLS, BRANCHES, xpForLevel, MAX_LEVEL } from '../systems/Skills.js';

const PANEL_W = 640;
const PANEL_H = 428;
const PAD = 14;
const COL_W = (PANEL_W - PAD * 4) / 3;
const CARD_H = 52;
const CARD_GAP = 6;
const CARDS_Y = 82;
const DETAIL_Y = CARDS_Y + 4 * (CARD_H + CARD_GAP) + 2;

/**
 * Habilidades (tecla K, el botón del inventario o tocar el nivel en el HUD):
 * tres ramas (Movimiento, Combate, Supervivencia). Cada nivel da 1 punto para aprender o mejorar una.
 */
export class SkillsPanel {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gs = gameScene;
    this.progress = gameScene.progress;
    this.isOpen = false;
    this.selected = 'sprint';

    this.blocker = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.4).setOrigin(0).setDepth(31).setVisible(false);
    this.blocker.setInteractive().on('pointerdown', () => scene.toggleSkills(false));
    this.container = scene.add.container(0, 0).setDepth(32).setVisible(false);
    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, COLORS.panel, 0.96).setOrigin(0).setStrokeStyle(2, COLORS.panelBorder).setInteractive();
    this.title = scene.add.text(PAD, PAD - 2, '', textStyle({ fontSize: '20px' }));
    this.sub = scene.add.text(PAD, PAD + 24, '', textStyle({ fontSize: '13px', color: '#c8d2ff' }));
    const close = createButton(scene, PANEL_W - 22, 22, 28, 28, 'X', () => scene.toggleSkills(false), { fontSize: '16px' });
    this.container.add([bg, this.title, this.sub, close]);

    // Columnas con las tarjetas de cada rama
    this.cards = {};
    BRANCHES.forEach((b, col) => {
      const x = PAD + col * (COL_W + PAD);
      this.container.add(scene.add.text(x, CARDS_Y - 22, b.name, textStyle({ fontSize: '15px', color: '#ffffff' })));
      const ids = Object.keys(SKILLS).filter((id) => SKILLS[id].branch === b.id);
      ids.forEach((id, row) => {
        const y = CARDS_Y + row * (CARD_H + CARD_GAP);
        const card = scene.add.container(x, y);
        const box = scene.add.rectangle(0, 0, COL_W, CARD_H, 0x262c5a, 0.95).setOrigin(0).setStrokeStyle(2, 0x3a4380).setInteractive({ useHandCursor: true });
        const strip = scene.add.rectangle(0, 0, 6, CARD_H, b.color).setOrigin(0);
        const name = scene.add.text(14, 6, SKILLS[id].name, textStyle({ fontSize: '15px' }));
        const state = scene.add.text(14, 28, '', textStyle({ fontSize: '12px', strokeThickness: 2 }));
        const pips = scene.add.text(COL_W - 8, 8, '', textStyle({ fontSize: '13px', color: '#ffe28a' })).setOrigin(1, 0);
        card.add([box, strip, name, state, pips]);
        box.on('pointerdown', () => {
          this.selected = id;
          this.refresh();
        });
        this.container.add(card);
        this.cards[id] = { box, name, state, pips, color: b.color };
      });
    });

    // Detalle de la habilidad elegida + botón Aprender
    this.detailName = scene.add.text(PAD, DETAIL_Y, '', textStyle({ fontSize: '16px', color: '#ffe28a' }));
    this.detailDesc = scene.add.text(PAD, DETAIL_Y + 22, '', textStyle({ fontSize: '13px', wordWrap: { width: PANEL_W - 200 - PAD * 2 }, lineSpacing: 2 }));
    this.learnBtn = createButton(scene, PANEL_W - PAD - 90, DETAIL_Y + 30, 180, 40, 'Aprender', () => this.learn(), { fontSize: '16px' });
    this.container.add([this.detailName, this.detailDesc, this.learnBtn]);
    this.container.add(
      scene.add
        .text(PAD, PANEL_H - PAD, 'Cada nivel da 1 punto. Ganas experiencia venciendo enemigos, minando minerales, talando, descubriendo zonas, construyendo casas y fabricando cosas nuevas.', textStyle({ fontSize: '12px', color: '#aab4e8', wordWrap: { width: PANEL_W - PAD * 2 } }))
        .setOrigin(0, 1),
    );

    this.progress.on('skills', this.refresh, this);
    this.progress.on('levelUp', this.refresh, this);
  }

  layout(width, height) {
    this.blocker.setSize(width, height);
    if (this.blocker.input) this.blocker.input.hitArea.setSize(width, height);
    const s = Math.min(1, (width - 16) / PANEL_W, (height - 16) / PANEL_H);
    this.container.setScale(s).setPosition(Math.round((width - PANEL_W * s) / 2), Math.round((height - PANEL_H * s) / 2));
  }

  open() {
    this.isOpen = true;
    this.blocker.setVisible(true);
    this.container.setVisible(true);
    // Elige la primera que se pueda aprender (si hay)
    const ready = Object.keys(SKILLS).find((id) => this.progress.canLearn(id).ok);
    if (ready) this.selected = ready;
    this.refresh();
  }

  close() {
    this.isOpen = false;
    this.blocker.setVisible(false);
    this.container.setVisible(false);
  }

  learn() {
    const s = SKILLS[this.selected];
    if (!this.progress.learn(this.selected)) {
      this.scene.toast.show(this.progress.canLearn(this.selected).reason);
      return;
    }
    const p = this.gs.player;
    this.gs.spawnSparkles(p.centerX, p.centerY, 16, 0x9be7ff);
    this.scene.toast.show(`¡Aprendiste ${s.name}!${s.keys ? ` ${s.keys}` : ''}`);
  }

  refresh() {
    if (!this.isOpen) return;
    const pr = this.progress;
    this.title.setText(`Habilidades · Nivel ${pr.level}`);
    const next = pr.level >= MAX_LEVEL ? 'nivel máximo' : `${pr.xp}/${xpForLevel(pr.level)} XP para el nivel ${pr.level + 1}`;
    this.sub.setText(`Puntos para gastar: ${pr.points}   ·   ${next}`);
    for (const [id, c] of Object.entries(this.cards)) {
      const s = SKILLS[id];
      const r = pr.rank(id);
      const max = s.ranks || 1;
      const can = pr.canLearn(id);
      c.pips.setText(max > 1 ? '●'.repeat(r) + '○'.repeat(max - r) : r ? '✔' : '');
      if (r >= max) c.state.setText('Aprendida').setColor('#8dff9a');
      else if (can.ok) c.state.setText(r ? '¡Puedes mejorarla!' : '¡Puedes aprenderla!').setColor('#ffe28a');
      else c.state.setText(r ? `Mejora: ${can.reason.toLowerCase()}` : can.reason).setColor('#aab4e8');
      const sel = id === this.selected;
      c.box.setFillStyle(r ? 0x2f5a3a : can.ok ? 0x4a4520 : 0x262c5a, 0.95);
      c.box.setStrokeStyle(sel ? 3 : 2, sel ? 0xffd84a : can.ok ? 0xffd84a : 0x3a4380, sel || can.ok ? 1 : 0.8);
    }
    const s = SKILLS[this.selected];
    const r = pr.rank(this.selected);
    const max = s.ranks || 1;
    const can = pr.canLearn(this.selected);
    this.detailName.setText(`${s.name}${max > 1 ? ` (${r}/${max})` : ''}`);
    this.detailDesc.setText(`${s.desc}.${s.keys ? `\nCómo se usa: ${s.keys}.` : ' (Pasiva: funciona sola.)'}`);
    const label = r >= max ? 'Aprendida' : can.ok ? `${r ? 'Mejorar' : 'Aprender'} (${s.cost} pto${s.cost > 1 ? 's' : ''})` : can.reason;
    this.learnBtn.label.setText(label);
    this.learnBtn.bg.setFillStyle(can.ok ? COLORS.craftable : COLORS.notCraftable, 0.95);
  }

  destroy() {
    this.progress.off('skills', this.refresh, this);
    this.progress.off('levelUp', this.refresh, this);
  }
}
