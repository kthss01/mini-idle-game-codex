export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.playerHp = 100;
    this.monsterHp = 80;
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
      `기사 HP ${this.playerHp} / 몬스터 HP ${this.monsterHp} / 골드 ${this.gold}`
    );
  }
}
