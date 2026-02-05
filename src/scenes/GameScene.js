import { createCombatState, tickCombat } from '../core/combat.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.combatState = createCombatState();
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

    const { player, monster, gold, killCount } = this.combatState;
    const playerHp = player?.hp ?? 0;
    const playerMaxHp = player?.maxHp ?? 0;
    const monsterHp = monster?.hp ?? 0;
    const monsterMaxHp = monster?.maxHp ?? 0;

    this.hudText.setText(
      `기사 HP ${playerHp} / ${playerMaxHp} | 몬스터 HP ${monsterHp} / ${monsterMaxHp} | 골드 ${gold} | 처치 ${killCount ?? 0}`
    );
  }
}
