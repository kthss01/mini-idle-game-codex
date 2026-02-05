import UILayoutScene from './scenes/UILayoutScene.js';

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  backgroundColor: '#0f172a',
  parent: 'game-root',
  scene: [UILayoutScene],
};

new Phaser.Game(config);
