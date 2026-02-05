export default class UILayoutScene extends Phaser.Scene {
  constructor() {
    super('UILayoutScene');
  }

  create() {
    const { width, height } = this.scale;

    const topHeight = Math.round(height * 0.6);
    const bottomHeight = height - topHeight;
    const leftWidth = Math.round(width * 0.5);
    const rightWidth = width - leftWidth;

    const panelStroke = 0x1f2937;

    this.add
      .rectangle(0, 0, leftWidth, topHeight, 0x334155)
      .setOrigin(0)
      .setStrokeStyle(2, panelStroke);
    this.add
      .rectangle(leftWidth, 0, rightWidth, topHeight, 0x475569)
      .setOrigin(0)
      .setStrokeStyle(2, panelStroke);
    this.add
      .rectangle(0, topHeight, width, bottomHeight, 0x1e293b)
      .setOrigin(0)
      .setStrokeStyle(2, panelStroke);

    const labelStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#f8fafc',
    };

    this.add.text(20, 20, '기사 패널 (좌측)', labelStyle);
    this.add.text(leftWidth + 20, 20, '몬스터 패널 (우측)', labelStyle);
    this.add.text(20, topHeight + 20, '버튼 영역 (하단)', labelStyle);
  }
}
