import Phaser from "phaser";
import "./style.css";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    this.add
      .text(24, 24, "Mini Idle Game", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setShadow(2, 2, "#000", 2, true, true);

    this.add
      .text(24, 80, "Phaser is running 🎮", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        color: "#cbd5f5",
      })
      .setAlpha(0.9);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 540,
  backgroundColor: "#1b1537",
  scene: [BootScene],
};

new Phaser.Game(config);
