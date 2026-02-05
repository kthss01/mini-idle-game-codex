import { createCombatState, tickCombat } from "../core/combat.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.combatState = null;
    this.hudText = null;
  }

  create() {
    this.combatState = createCombatState();

    const hudStyle = {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    };

    this.hudText = this.add.text(16, 16, "", hudStyle);
    this.hudText.setScrollFactor(0);
    this.hudText.setDepth(1000);

    this.updateHud();
  }

  update(time, delta) {
    if (!this.combatState) {
      return;
    }

    tickCombat(this.combatState, delta);
    this.updateHud();
  }

  updateHud() {
    if (!this.hudText) {
      return;
    }

    const { playerHp, playerMaxHp, monsterHp, monsterMaxHp, gold, kills } =
      this.combatState;

    this.hudText.setText(
      [
        `기사 HP ${playerHp} / ${playerMaxHp}`,
        `몬스터 HP ${monsterHp} / ${monsterMaxHp}`,
        `처치 ${kills}`,
        `골드 ${gold}`,
      ].join("\n")
    );
  }
}
