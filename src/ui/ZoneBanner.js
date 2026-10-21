import { textStyle } from './styles.js';
import { ZONE_INFO as BIOME_INFO } from '../world/WorldGenerator.js';
import { ZONE_DESC, dangerStars } from '../systems/Zones.js';

/** Cartel grande al entrar por primera vez a una zona: nombre, peligro y cuántas van descubiertas. */
export class ZoneBanner {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(45).setAlpha(0).setVisible(false);
    this.bg = scene.add.rectangle(0, 0, 10, 10, 0x0c1030, 0.72).setStrokeStyle(2, 0xffd84a, 0.9);
    this.head = scene.add.text(0, 0, '¡Zona descubierta!', textStyle({ fontSize: '17px', color: '#ffe28a' })).setOrigin(0.5, 0);
    this.name = scene.add.text(0, 0, '', textStyle({ fontSize: '34px', strokeThickness: 5 })).setOrigin(0.5, 0);
    this.info = scene.add.text(0, 0, '', textStyle({ fontSize: '15px', color: '#ffb0a0' })).setOrigin(0.5, 0);
    this.desc = scene.add.text(0, 0, '', textStyle({ fontSize: '14px', color: '#d8e4ff', align: 'center' })).setOrigin(0.5, 0);
    this.container.add([this.bg, this.head, this.name, this.info, this.desc]);
    this.tween = null;
  }

  layout(x, y) {
    this.container.setPosition(x, y);
  }

  show(biome, discovered, total) {
    const info = BIOME_INFO[biome];
    this.showCustom('¡Zona descubierta!', info.name, `Peligro ${dangerStars(info.danger)}   ·   Zonas ${discovered}/${total}`, ZONE_DESC[biome]);
  }

  /** Cartel con cualquier texto (también para "¡Subiste de nivel!"). */
  showCustom(head, name, info, desc) {
    this.head.setText(head);
    this.name.setText(name);
    this.info.setText(info);
    this.desc.setText(desc);
    this.head.setY(10);
    this.name.setY(32);
    this.info.setY(74);
    this.desc.setY(96);
    const w = Math.max(this.name.width, this.info.width, this.desc.width, this.head.width) + 44;
    const h = 124;
    this.bg.setSize(w, h).setPosition(0, h / 2);
    if (this.tween) this.tween.stop();
    this.container.setVisible(true).setAlpha(0).setScale(0.85);
    this.tween = this.scene.tweens.chain({
      targets: this.container,
      tweens: [
        { alpha: 1, scale: 1, duration: 380, ease: 'Back.Out' },
        { alpha: 0, duration: 700, delay: 3200 },
      ],
      onComplete: () => this.container.setVisible(false),
    });
  }
}
