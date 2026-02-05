import { createCombatState, tickCombat } from '../core/combat.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.combatState = null;
    this.hudText = null;
  }

  create() {
    this.combatState = createCombatState();

    const hudStyle = {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    };

    this.hudText = this.add.text(16, 16, '', hudStyle);
    this.hudText.setScrollFactor(0);
    this.hudText.setDepth(1000);

    this.updateHud();
  }

  update(time, delta) {
    this.combatState = tickCombat(this.combatState, delta);
    this.updateHud();
  }

  updateHud() {
    if (!this.hudText) {
      return;
    }

    const { player, monster, gold, progression } = this.combatState;
    const playerHp = player?.hp ?? 0;
    const playerMaxHp = player?.maxHp ?? 0;
    const playerEquipment = player?.equipmentTier?.name ?? '기본 장비';
    const monsterName = monster?.name ?? '알 수 없는 몬스터';
    const monsterHp = monster?.hp ?? 0;
    const monsterMaxHp = monster?.maxHp ?? 0;
    const stage = progression?.monsterLevel ?? 1;
    const killCount = progression?.kills ?? 0;

    this.hudText.setText(
      `스테이지 ${stage} | 기사 HP ${playerHp} / ${playerMaxHp} (${playerEquipment}) | ` +
        `몬스터 ${monsterName} HP ${monsterHp} / ${monsterMaxHp} | ` +
        `골드 ${gold} | 처치 ${killCount}`
    );
  }
}
