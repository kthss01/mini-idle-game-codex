import UILayoutScene from './scenes/UILayoutScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0b1120',
  parent: 'game-root',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 960,
      height: 540,
    },
  },
  scene: [UILayoutScene],
};

new Phaser.Game(config);
