import { createCombatState, tickCombat } from '../core/combatLogic.js';

const UI_THEME = {
  panelStroke: 0x1f2937,
  topBg: 0x0f172a,
  midLeftBg: 0x1e293b,
  midRightBg: 0x172033,
  bottomBg: 0x111827,
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  tabActive: 0x334155,
  tabInactive: 0x1f2937,
  accent: 0x22d3ee,
  warning: 0xf59e0b,
};

export default class UILayoutScene extends Phaser.Scene {
  constructor() {
    super('UILayoutScene');
    this.combatState = createCombatState();
    this.activeTab = '업그레이드';
    this.showCombatDetails = false;
    this.heroSlotLevel = 0;
    this.heroUpgradeCost = 30;
    this.ui = {};
  }

  create() {
    this.combatState = createCombatState();
    this.buildLayout();
    this.bindResize();
    this.refreshUI();
  }

  update(_time, delta) {
    this.combatState = tickCombat(this.combatState, delta);
    this.refreshUI();
    this.animateCombatUnits();
  }

  bindResize() {
    this.scale.on('resize', () => {
      this.clearLayout();
      this.buildLayout();
      this.refreshUI();
    });
  }

  clearLayout() {
    Object.values(this.ui).forEach((item) => {
      if (Array.isArray(item)) {
        item.forEach((child) => child?.destroy?.());
        return;
      }
      item?.destroy?.();
    });
    this.ui = {};
  }

  getLayout() {
    const width = Math.max(this.scale.width, 960);
    const height = Math.max(this.scale.height, 540);

    const topH = Math.round(height * 0.14);
    const bottomH = Math.round(height * 0.22);
    const middleH = height - topH - bottomH;

    const middleLeftW = Math.round(width * 0.64);
    const middleRightW = width - middleLeftW;

    return {
      width,
      height,
      top: { x: 0, y: 0, w: width, h: topH },
      middleLeft: { x: 0, y: topH, w: middleLeftW, h: middleH },
      middleRight: { x: middleLeftW, y: topH, w: middleRightW, h: middleH },
      bottom: { x: 0, y: topH + middleH, w: width, h: bottomH },
    };
  }

  buildLayout() {
    const layout = this.getLayout();

    this.ui.topPanel = this.drawPanel(layout.top, UI_THEME.topBg);
    this.ui.middleLeftPanel = this.drawPanel(layout.middleLeft, UI_THEME.midLeftBg);
    this.ui.middleRightPanel = this.drawPanel(layout.middleRight, UI_THEME.midRightBg);
    this.ui.bottomPanel = this.drawPanel(layout.bottom, UI_THEME.bottomBg);

    this.createTopHUD(layout.top);
    this.createCombatPanel(layout.middleLeft);
    this.createHeroSlotPanel(layout.middleRight);
    this.createBottomTabs(layout.bottom);
  }

  drawPanel(bounds, fill) {
    return this.add
      .rectangle(bounds.x, bounds.y, bounds.w, bounds.h, fill)
      .setOrigin(0)
      .setStrokeStyle(2, UI_THEME.panelStroke);
  }

  createTopHUD(bounds) {
    const slotWidth = bounds.w / 3;

    this.ui.resourceTexts = [
      this.createHUDItem(bounds.x + 18, bounds.y + 14, slotWidth - 24, '골드', '0'),
      this.createHUDItem(bounds.x + slotWidth + 18, bounds.y + 14, slotWidth - 24, '보석', '0'),
      this.createHUDItem(bounds.x + slotWidth * 2 + 18, bounds.y + 14, slotWidth - 24, '스테이지', '1'),
    ];
  }

  createHUDItem(x, y, width, label, value) {
    this.add.rectangle(x - 8, y - 6, width, 58, 0x0b1220).setOrigin(0).setAlpha(0.85);

    const labelText = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: UI_THEME.textSecondary,
    });

    const valueText = this.add.text(x, y + 20, value, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: UI_THEME.textPrimary,
      fontStyle: 'bold',
    });

    return { labelText, valueText };
  }

  createCombatPanel(bounds) {
    const centerY = bounds.y + bounds.h * 0.52;

    this.ui.panelTitle = this.add.text(bounds.x + 20, bounds.y + 18, '전투 메인 화면', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: UI_THEME.textPrimary,
      fontStyle: 'bold',
    });

    this.ui.playerSprite = this.add.rectangle(bounds.x + bounds.w * 0.26, centerY, 120, 150, 0x2563eb);
    this.ui.monsterSprite = this.add.rectangle(bounds.x + bounds.w * 0.74, centerY, 120, 150, 0xdc2626);

    this.ui.playerLabel = this.add.text(this.ui.playerSprite.x - 52, centerY + 92, '기사', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: UI_THEME.textSecondary,
    });
    this.ui.monsterLabel = this.add.text(this.ui.monsterSprite.x - 60, centerY + 92, '몬스터', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: UI_THEME.textSecondary,
    });

    this.ui.combatMainInfo = this.add.text(bounds.x + 20, bounds.y + bounds.h - 130, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: UI_THEME.textPrimary,
      lineSpacing: 8,
    });

    this.ui.detailsToggle = this.add
      .text(bounds.x + 20, bounds.y + bounds.h - 64, '▶ 전투 세부 수치 보기', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#93c5fd',
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.showCombatDetails = !this.showCombatDetails;
        this.refreshUI();
      });

    this.ui.combatDetails = this.add.text(bounds.x + 230, bounds.y + bounds.h - 64, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: UI_THEME.textSecondary,
    });
  }

  createHeroSlotPanel(bounds) {
    this.ui.heroTitle = this.add.text(bounds.x + 20, bounds.y + 18, '영웅 슬롯', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: UI_THEME.textPrimary,
      fontStyle: 'bold',
    });

    this.ui.slotCard = this.add.rectangle(bounds.x + 20, bounds.y + 56, bounds.w - 40, 180, 0x0f1b2e)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2b3b52);

    this.ui.slotInfo = this.add.text(bounds.x + 34, bounds.y + 74, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: UI_THEME.textPrimary,
      lineSpacing: 8,
    });

    this.ui.upgradeButton = this.add
      .rectangle(bounds.x + 34, bounds.y + 182, bounds.w - 68, 40, UI_THEME.accent)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tryUpgradeHero());

    this.ui.upgradeText = this.add.text(bounds.x + 44, bounds.y + 192, '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#082f49',
      fontStyle: 'bold',
    });

    this.ui.slotHint = this.add.text(bounds.x + 20, bounds.y + 250, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: UI_THEME.warning,
    });
  }

  createBottomTabs(bounds) {
    const tabNames = ['업그레이드', '퀘스트', '상점'];
    const tabWidth = Math.floor((bounds.w - 50) / tabNames.length);

    this.ui.tabButtons = tabNames.map((tab, index) => {
      const x = bounds.x + 16 + index * tabWidth;
      const y = bounds.y + 14;
      const button = this.add.rectangle(x, y, tabWidth - 10, 36, UI_THEME.tabInactive).setOrigin(0);
      button.setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.activeTab = tab;
        this.refreshUI();
      });
      const text = this.add.text(x + 16, y + 9, tab, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: UI_THEME.textPrimary,
      });
      return { tab, button, text };
    });

    this.ui.tabContent = this.add.text(bounds.x + 20, bounds.y + 62, '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: UI_THEME.textSecondary,
      wordWrap: { width: bounds.w - 40, useAdvancedWrap: true },
      lineSpacing: 6,
    });
  }

  tryUpgradeHero() {
    if (this.combatState.gold < this.heroUpgradeCost) {
      this.ui.slotHint.setText(`골드가 부족합니다. (필요: ${this.heroUpgradeCost}G)`);
      return;
    }

    this.combatState = {
      ...this.combatState,
      gold: this.combatState.gold - this.heroUpgradeCost,
      player: {
        ...this.combatState.player,
        atk: this.combatState.player.atk + 4,
        maxHp: this.combatState.player.maxHp + 10,
        hp: this.combatState.player.hp + 10,
      },
    };

    this.heroSlotLevel += 1;
    this.heroUpgradeCost = Math.floor(this.heroUpgradeCost * 1.55);
    this.ui.slotHint.setText('영웅 슬롯 강화 성공!');
    this.refreshUI();
  }

  animateCombatUnits() {
    if (!this.ui.monsterSprite || !this.ui.playerSprite) {
      return;
    }

    const event = this.combatState.combat.lastEvent;
    if (event.includes('기사의 공격')) {
      this.ui.monsterSprite.setScale(1.06);
      this.tweens.add({ targets: this.ui.monsterSprite, scaleX: 1, scaleY: 1, duration: 120 });
    } else if (event.includes('의 공격')) {
      this.ui.playerSprite.setScale(1.06);
      this.tweens.add({ targets: this.ui.playerSprite, scaleX: 1, scaleY: 1, duration: 120 });
    }
  }

  refreshUI() {
    const { player, monster, gold, progression, combat } = this.combatState;
    const currentStage = progression.difficultyLevel;

    const gems = Math.floor(progression.killCount / 15);
    this.ui.resourceTexts?.[0]?.valueText?.setText(`${gold}`);
    this.ui.resourceTexts?.[1]?.valueText?.setText(`${gems}`);
    this.ui.resourceTexts?.[2]?.valueText?.setText(`${currentStage}`);

    this.ui.combatMainInfo?.setText([
      `현재 대상: ${monster.name} (Lv.${monster.level})`,
      `기사 HP ${player.hp}/${player.maxHp}  |  ${monster.name} HP ${monster.hp}/${monster.maxHp}`,
      '자동전투 진행 중 · 핵심 정보만 기본 표시',
    ]);

    this.ui.detailsToggle?.setText(this.showCombatDetails ? '▼ 전투 세부 수치 접기' : '▶ 전투 세부 수치 보기');
    this.ui.combatDetails?.setVisible(this.showCombatDetails);
    this.ui.combatDetails?.setText([
      `공격력: 기사 ${player.atk} / 몬스터 ${monster.atk}`,
      `쿨다운(ms): 기사 ${player.cooldownLeftMs} / 몬스터 ${monster.cooldownLeftMs}`,
      `최근 이벤트: ${combat.lastEvent}`,
    ]);

    this.ui.slotInfo?.setText([
      `슬롯 이름: 기사단 메인 슬롯`,
      `강화 레벨: +${this.heroSlotLevel}`,
      `효과: 공격력 +${this.heroSlotLevel * 4}, 최대HP +${this.heroSlotLevel * 10}`,
    ]);
    this.ui.upgradeText?.setText(`클릭 업그레이드 (${this.heroUpgradeCost}G)`);

    const tabMessage = {
      업그레이드: '업그레이드 탭: 영웅 슬롯/장비 확장 영역. 현재 전투/슬롯 UI는 중단에 고정되어 문맥이 유지됩니다.',
      퀘스트: '퀘스트 탭 플레이스홀더: 일일/주간 퀘스트 목록이 들어올 영역입니다. (미개발 영역 배치 확정)',
      상점: '상점 탭 플레이스홀더: 재화 소비형 패키지/소모품 목록이 들어올 영역입니다. (미개발 영역 배치 확정)',
    };

    this.ui.tabButtons?.forEach(({ tab, button }) => {
      button.setFillStyle(tab === this.activeTab ? UI_THEME.tabActive : UI_THEME.tabInactive);
    });

    this.ui.tabContent?.setText([
      tabMessage[this.activeTab],
      '',
      '반응형 기준',
      '- 최소 해상도: 960x540 유지',
      '- 패널 비율: 상단 14% / 중단 64%(좌64:우36) / 하단 22%',
      '- 오버플로 처리: 하단 탭 본문은 줄바꿈 처리, 핵심 HUD는 고정',
    ]);
  }
}
