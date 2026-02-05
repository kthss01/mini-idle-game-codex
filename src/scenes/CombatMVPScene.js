import { createCombatState, tickCombat } from '../logic/combatLogic.js';

export default class CombatMVPScene extends Phaser.Scene {
  constructor() {
    super('CombatMVPScene');
    this.combatState = createCombatState();
    this.playerHpText = null;
    this.monsterHpText = null;
    this.goldText = null;
    this.killText = null;
  }

  create() {
    const hudStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#f8fafc',
      stroke: '#0f172a',
      strokeThickness: 4,
    };

    this.playerHpText = this.add.text(24, 24, '', hudStyle);
    this.monsterHpText = this.add.text(24, 60, '', hudStyle);
    this.goldText = this.add.text(24, 96, '', hudStyle);
    this.killText = this.add.text(24, 132, '', hudStyle);

    this.updateAllTexts();
  }

  update(_, delta) {
    const { state } = tickCombat(this.combatState, delta);
    this.combatState = state;

    this.updatePlayerText();
    this.updateGoldText();
    this.updateKillText();
    this.updateMonsterText();
  }

  updatePlayerText() {
    const { player } = this.combatState;
    this.playerHpText.setText(`플레이어 HP ${player.hp} / ${player.maxHp}`);
  }

  updateMonsterText() {
    const { monster } = this.combatState;
    this.monsterHpText.setText(
      `몬스터(Lv.${monster.level}) HP ${monster.hp} / ${monster.maxHp}`
    );
  }

  updateGoldText() {
    this.goldText.setText(`골드 ${this.combatState.gold}`);
  }

  updateKillText() {
    this.killText.setText(`처치 ${this.combatState.kills}`);
  }

  updateAllTexts() {
    this.updatePlayerText();
    this.updateMonsterText();
    this.updateGoldText();
    this.updateKillText();
  }
}
