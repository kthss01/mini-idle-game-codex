import { createCombatState, tickCombat } from '../core/combatLogic.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.combatState = createCombatState();
    this.hudText = null;
  }

  create() {
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

    const { playerHp, monsterHp, gold } = this.combatState;

    this.hudText.setText(
      `기사 HP ${playerHp} / 몬스터 HP ${monsterHp} / 골드 ${gold}`
    );
  }
}
