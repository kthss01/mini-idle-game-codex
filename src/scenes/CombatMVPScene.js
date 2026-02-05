import { createCombatState, tickCombat } from '../core/combatLogic.js';

export default class CombatMVPScene extends Phaser.Scene {
  constructor() {
    super('CombatMVPScene');
    this.combatState = createCombatState();
    this.hudText = null;
    this.infoText = null;
    this.playerSprite = null;
    this.monsterSprite = null;
    this.lastMonsterKey = '';
    this.lastLoggedEvent = '';
    this.lastLoggedKillCount = -1;
  }

  create() {
    this.combatState = createCombatState();

    this.playerSprite = this.add.rectangle(220, 220, 120, 150, 0x1d4ed8);
    this.monsterSprite = this.add.rectangle(730, 220, 120, 150, 0xb91c1c);

    this.hudText = this.add.text(16, 16, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.hudText.setDepth(1000);

    this.infoText = this.add.text(16, 126, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f8fafc',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.infoText.setDepth(1000);

    this.lastMonsterKey = this.getMonsterKey(this.combatState.monster);
    this.lastLoggedKillCount = this.combatState.progression.killCount;
    this.updateHud();
    this.logCombatProgress();
  }

  update(time, delta) {
    this.combatState = tickCombat(this.combatState, delta);
    this.syncMonsterVisual();
    this.updateHud();
    this.logCombatProgress();
  }

  logCombatProgress() {
    const { combat, player, monster, gold, progression } = this.combatState;

    if (combat.lastEvent !== this.lastLoggedEvent) {
      this.lastLoggedEvent = combat.lastEvent;
      console.log(
        `[Combat] ${combat.lastEvent} | Hero ${player.hp}/${player.maxHp} | ${monster.name} ${monster.hp}/${monster.maxHp}`,
      );
    }

    if (progression.killCount !== this.lastLoggedKillCount) {
      this.lastLoggedKillCount = progression.killCount;
      console.log(
        `[Progress] kills=${progression.killCount}, gold=${gold}, difficulty=${progression.difficultyLevel}`,
      );
    }
  }

  getMonsterKey(monster) {
    return `${monster.id}-${monster.level}-${this.combatState.progression.killCount}`;
  }

  syncMonsterVisual() {
    const currentKey = this.getMonsterKey(this.combatState.monster);

    if (currentKey === this.lastMonsterKey || !this.monsterSprite) {
      return;
    }

    this.lastMonsterKey = currentKey;
    this.monsterSprite.setScale(1.15);
    this.monsterSprite.setFillStyle(0xef4444);

    this.tweens.add({
      targets: this.monsterSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.monsterSprite) {
          this.monsterSprite.setFillStyle(0xb91c1c);
        }
      },
    });
  }

  updateHud() {
    if (!this.hudText || !this.infoText) {
      return;
    }

    const { player, monster, gold, progression, combat } = this.combatState;

    this.hudText.setText([
      `기사 HP ${player.hp}/${player.maxHp}  ATK ${player.atk}`,
      `${monster.name} HP ${monster.hp}/${monster.maxHp}  ATK ${monster.atk}`,
      `골드 ${gold} | 처치 ${progression.killCount} | 난이도 Lv.${progression.difficultyLevel}`,
    ]);

    this.infoText.setText([
      '자동 전투 진행 중',
      `최근 이벤트: ${combat.lastEvent}`,
      '입력 없이 처치/골드 획득이 반복됩니다.',
    ]);
  }
}
