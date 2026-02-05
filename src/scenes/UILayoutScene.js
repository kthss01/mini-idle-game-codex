import {
  applyEquipmentBonus,
  getRewardGold,
  getScaledMonsterStats,
} from '../logic/battleBalance.js';

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

    const sampleMonster = getScaledMonsterStats({
      monsterId: 'goblin',
      killCount: 45,
      growthCurveId: 'linear',
    });
    const rewardGold = getRewardGold({
      monsterId: sampleMonster.id,
      killCount: sampleMonster.killCount,
      growthCurveId: sampleMonster.growthCurveId,
    });
    const equipped = applyEquipmentBonus({
      baseHp: 280,
      baseAtk: 34,
      tierId: 'heroic',
    });

    const infoStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#e2e8f0',
    };

    this.add.text(
      leftWidth + 20,
      60,
      [
        `샘플 몬스터: ${sampleMonster.name}`,
        `HP ${sampleMonster.hp} / ATK ${sampleMonster.atk}`,
        `보상 골드: ${rewardGold}`,
      ],
      infoStyle,
    );

    this.add.text(
      20,
      topHeight + 60,
      [
        `장비 등급: ${equipped.tier.name}`,
        `보너스 HP ${equipped.tier.hpBonus} / ATK ${equipped.tier.atkBonus}`,
        `적용 후: HP ${equipped.hp} / ATK ${equipped.atk}`,
      ],
      infoStyle,
    );

    if (!this.scene.isActive('CombatMVPScene')) {
      this.scene.launch('CombatMVPScene');
    }
  }
}
