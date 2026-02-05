import { equipment, growthCurve, monsters } from '../design/gameData.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.stage = 1;
    this.playerBaseHp = 120;
    this.playerBaseAtk = 18;
    this.equipment = equipment[0];
    this.playerHp = this.getScaledPlayerHp();
    this.monster = this.getMonsterForStage(this.stage);
    this.monsterHp = this.monster.hp;
    this.monsterAtk = this.monster.atk;
    this.gold = 0;
    this.hudText = null;
  }

  create() {
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

  update() {
    this.updateHud();
  }

  updateHud() {
    if (!this.hudText) {
      return;
    }

    this.hudText.setText(
      `스테이지 ${this.stage} / 기사 HP ${this.playerHp} (${this.equipment.name}) / ` +
        `몬스터 ${this.monster.name} HP ${this.monsterHp} / 골드 ${this.gold}`
    );
  }

  getScaledPlayerHp() {
    const growth = this.getGrowthForStage(this.stage);
    const defenseBonus = this.equipment.defenseBonus ?? 0;
    return Math.round(this.playerBaseHp * growth.hpRate + defenseBonus * 5);
  }

  getMonsterForStage(stage) {
    const eligibleMonsters = monsters.filter((monster) =>
      monster.spawnStages.some((entry) => stage >= entry.stage)
    );
    const selectedMonster =
      eligibleMonsters[eligibleMonsters.length - 1] ?? monsters[0];
    const spawnEntry = this.getSpawnEntryForStage(selectedMonster, stage);
    const growth = this.getGrowthForStage(stage);
    return {
      id: selectedMonster.id,
      name: selectedMonster.name,
      hp: Math.round(
        selectedMonster.baseHp * spawnEntry.hpScale * growth.hpRate
      ),
      atk: Math.round(
        selectedMonster.baseAtk * spawnEntry.atkScale * growth.atkRate
      ),
    };
  }

  getSpawnEntryForStage(monster, stage) {
    return (
      [...monster.spawnStages]
        .reverse()
        .find((entry) => stage >= entry.stage) ?? monster.spawnStages[0]
    );
  }

  getGrowthForStage(stage) {
    return (
      [...growthCurve].reverse().find((entry) => stage >= entry.stage) ??
      growthCurve[0]
    );
  }
}
