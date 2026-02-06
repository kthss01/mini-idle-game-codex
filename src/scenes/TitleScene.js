import { SAVE_STORAGE_KEY } from '../core/save.js';

const BUTTON_WIDTH = 260;
const BUTTON_HEIGHT = 64;
const BUTTON_GAP = 22;

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const hasSaveData = Boolean(window.localStorage.getItem(SAVE_STORAGE_KEY));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    this.add
      .text(width / 2, height * 0.28, 'Mini Idle Game', {
        fontFamily: 'Arial',
        fontSize: '56px',
        color: '#e2e8f0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.36, '게임 시작 전 대기 화면', {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    const buttonStartY = height * 0.54;
    this.createMenuButton(width / 2, buttonStartY, '게임 시작', true, () => {
      window.localStorage.removeItem(SAVE_STORAGE_KEY);
      this.scene.start('UILayoutScene', { mode: 'new' });
    });

    this.createMenuButton(width / 2, buttonStartY + BUTTON_HEIGHT + BUTTON_GAP, '이어하기', hasSaveData, () => {
      this.scene.start('UILayoutScene', { mode: 'continue' });
    });
  }

  createMenuButton(x, y, label, enabled, onClick) {
    const fillColor = enabled ? 0x1d4ed8 : 0x334155;
    const hoverColor = enabled ? 0x2563eb : 0x334155;
    const button = this.add
      .rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, fillColor)
      .setStrokeStyle(2, enabled ? 0x93c5fd : 0x64748b)
      .setOrigin(0.5);

    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: enabled ? '#eff6ff' : '#94a3b8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    if (!enabled) {
      return;
    }

    button.setInteractive({ useHandCursor: true });
    button
      .on('pointerover', () => button.setFillStyle(hoverColor))
      .on('pointerout', () => button.setFillStyle(fillColor))
      .on('pointerdown', () => button.setFillStyle(0x1e40af))
      .on('pointerup', () => {
        button.setFillStyle(hoverColor);
        onClick();
      });

    text.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
  }
}
