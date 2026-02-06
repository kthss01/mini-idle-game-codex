import { CombatEventType, createCombatState, tickCombat } from '../core/combatLogic.js';
import { applyOfflineReward, calculateOfflineReward } from '../core/offlineReward.js';
import { SAVE_KEY, buildSaveState, restoreState } from '../core/save.js';
import { spawnMonster } from '../core/spawnMonster.js';
import { offlineRewardConfig } from '../design/offlineBalance.js';
import {
  ProgressionUpgradeType,
  applyUpgrade,
  calcDps,
  calcSurvivability,
  getUpgradeCost,
} from '../core/progression.js';

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

const LOG_STYLE_BY_TYPE = {
  [CombatEventType.AUTO_BATTLE_START]: { icon: '▶', color: '#22d3ee' },
  [CombatEventType.AUTO_BATTLE_STOP]: { icon: '■', color: '#f97316' },
  [CombatEventType.DAMAGE]: { icon: '⚔', color: '#fca5a5' },
  [CombatEventType.MONSTER_DEFEATED]: { icon: '☠', color: '#facc15' },
  [CombatEventType.GOLD_GAINED]: { icon: '💰', color: '#fde68a' },
  [CombatEventType.SKILL_TRIGGERED]: { icon: '✨', color: '#c4b5fd' },
  [CombatEventType.STAGE_CLEAR]: { icon: '🏁', color: '#86efac' },
};

const LOG_LINE_HEIGHT = 24;
const COMBAT_INFO_BOTTOM_MARGIN = 84;

export default class UILayoutScene extends Phaser.Scene {
  constructor() {
    super('UILayoutScene');
    this.combatState = createCombatState();
    this.activeTab = '업그레이드';
    this.upgradeFeedback = '';
    this.ui = {};
    this.isLogPanelVisible = false;
    this.logScrollOffset = 0;
    this.logVisibleCount = 8;
    this.autoSaveTimer = null;
    this.lifecycleHandlers = null;
    this.offlineRewardNotice = null;
  }

  create() {
    this.combatState = this.loadOrCreateState();
    this.buildLayout();
    this.bindResize();
    this.bindInputs();
    this.bindPersistenceLifecycle();
    this.startAutoSave();
    this.refreshUI();
  }

  update(_time, delta) {
    this.combatState = tickCombat(this.combatState, delta);
    this.refreshUI();
    this.animateCombatUnits();
  }


  shutdown() {
    this.stopAutoSave();
    this.unbindPersistenceLifecycle();
    this.persistState();
  }

  startAutoSave() {
    this.stopAutoSave();
    this.autoSaveTimer = window.setInterval(() => this.persistState(), 5000);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      window.clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  bindPersistenceLifecycle() {
    const persist = () => this.persistState();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persist();
      }
    };

    window.addEventListener('beforeunload', persist);
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onVisibilityChange);

    this.lifecycleHandlers = {
      persist,
      onVisibilityChange,
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.shutdown());
  }

  unbindPersistenceLifecycle() {
    if (!this.lifecycleHandlers) {
      return;
    }

    window.removeEventListener('beforeunload', this.lifecycleHandlers.persist);
    window.removeEventListener('pagehide', this.lifecycleHandlers.persist);
    document.removeEventListener('visibilitychange', this.lifecycleHandlers.onVisibilityChange);
    this.lifecycleHandlers = null;
  }

  persistState(now = Date.now()) {
    try {
      const payload = buildSaveState(this.combatState, now);
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (_error) {
      return false;
    }
  }

  loadOrCreateState(now = Date.now()) {
    const fallback = createCombatState();

    try {
      const rawSave = localStorage.getItem(SAVE_KEY);
      const restored = restoreState(rawSave);
      if (!restored.isValid) {
        return fallback;
      }

      const appliedState = this.applyRestoredState(fallback, restored);
      const offlineSec = Math.max(0, Math.floor((now - restored.savedAt) / 1000));
      const reward = calculateOfflineReward(appliedState, offlineSec, offlineRewardConfig);
      this.offlineRewardNotice = reward.killsGained > 0 || reward.goldGained > 0
        ? `오프라인 보상: ${reward.killsGained}마리 처치, ${reward.goldGained}G 획득 (${reward.offlineSecApplied}초 적용)`
        : '';

      return applyOfflineReward(appliedState, reward);
    } catch (_error) {
      return fallback;
    }
  }

  applyRestoredState(fallback, restored) {
    const monster = spawnMonster(restored.progress.difficultyLevel);

    return {
      ...fallback,
      gold: restored.gold,
      player: {
        ...fallback.player,
        atk: restored.playerStats.atk,
        maxHp: restored.playerStats.maxHp,
        hp: Math.min(restored.playerStats.maxHp, restored.playerStats.hp),
        cooldownMs: restored.playerStats.cooldownMs,
        cooldownLeftMs: restored.playerStats.cooldownLeftMs,
      },
      progression: {
        ...fallback.progression,
        killCount: restored.progress.killCount,
        difficultyLevel: restored.progress.difficultyLevel,
        upgrades: {
          attackLevel: restored.progress.upgrades.attackLevel,
          healthLevel: restored.progress.upgrades.healthLevel,
        },
      },
      combat: {
        ...fallback.combat,
        elapsedMs: restored.progress.combat.elapsedMs,
        tick: restored.progress.combat.tick,
        lastEvent: '저장 데이터를 불러왔습니다.',
      },
      monster: {
        ...monster,
        cooldownMs: fallback.monster.cooldownMs,
        cooldownLeftMs: fallback.monster.cooldownMs,
      },
    };
  }

  bindResize() {
    this.scale.on('resize', () => {
      this.clearLayout();
      this.buildLayout();
      this.refreshUI();
    });
  }

  bindInputs() {
    if (this.ui.f1HandlerBound) {
      return;
    }

    this.input.keyboard?.on('keydown-F1', (event) => {
      event?.preventDefault?.();
      this.toggleLogPanel();
    });

    this.ui.f1HandlerBound = true;
  }

  clearLayout() {
    Object.values(this.ui).forEach((item) => {
      if (Array.isArray(item)) {
        item.forEach((child) => child?.destroy?.());
        return;
      }
      item?.destroy?.();
    });
    this.ui = { f1HandlerBound: true };
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
    this.createProgressionPanel(layout.middleRight);
    this.createBottomTabs(layout.bottom);
    this.createLogPanel(layout);
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
    const centerY = bounds.y + bounds.h * 0.42;
    const combatInfoY = bounds.y + bounds.h - 132;

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

    this.ui.combatInfoBg = this.add
      .rectangle(bounds.x + 16, combatInfoY - 10, bounds.w - 32, 108, 0x0b1220)
      .setOrigin(0)
      .setStrokeStyle(1, 0x334155)
      .setAlpha(0.92);

    this.ui.combatMainInfo = this.add.text(bounds.x + 28, combatInfoY, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: UI_THEME.textPrimary,
      lineSpacing: 6,
      wordWrap: { width: bounds.w - 56, useAdvancedWrap: true },
    });

    this.ui.playHint = this.add.text(bounds.x + 28, combatInfoY + COMBAT_INFO_BOTTOM_MARGIN, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#bfdbfe',
      wordWrap: { width: bounds.w - 56, useAdvancedWrap: true },
    });

    this.ui.offlineRewardText = this.add.text(bounds.x + 28, combatInfoY + COMBAT_INFO_BOTTOM_MARGIN + 24, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#86efac',
      wordWrap: { width: bounds.w - 56, useAdvancedWrap: true },
    });
  }

  createProgressionPanel(bounds) {
    this.ui.heroTitle = this.add.text(bounds.x + 20, bounds.y + 18, '성장 관리', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: UI_THEME.textPrimary,
      fontStyle: 'bold',
    });

    this.ui.slotCard = this.add.rectangle(bounds.x + 20, bounds.y + 56, bounds.w - 40, 260, 0x0f1b2e)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2b3b52);

    this.ui.slotInfo = this.add.text(bounds.x + 34, bounds.y + 74, '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: UI_THEME.textPrimary,
      lineSpacing: 7,
    });

    this.ui.attackUpgradeButton = this.add
      .rectangle(bounds.x + 34, bounds.y + 170, bounds.w - 68, 38, UI_THEME.accent)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tryApplyUpgrade(ProgressionUpgradeType.ATTACK));

    this.ui.attackUpgradeText = this.add.text(bounds.x + 44, bounds.y + 179, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#082f49',
      fontStyle: 'bold',
    });

    this.ui.healthUpgradeButton = this.add
      .rectangle(bounds.x + 34, bounds.y + 220, bounds.w - 68, 38, UI_THEME.accent)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tryApplyUpgrade(ProgressionUpgradeType.HEALTH));

    this.ui.healthUpgradeText = this.add.text(bounds.x + 44, bounds.y + 229, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#082f49',
      fontStyle: 'bold',
    });

    this.ui.slotHint = this.add.text(bounds.x + 20, bounds.y + 328, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#fef08a',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: bounds.w - 40, useAdvancedWrap: true },
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

  createLogPanel(layout) {
    const panelW = Math.max(340, Math.floor(layout.width * 0.34));
    const panelH = Math.max(220, Math.floor(layout.height * 0.42));
    const panelX = layout.width - panelW - 18;
    const panelY = layout.height - panelH - 18;

    this.ui.logToggleButton = this.add
      .rectangle(layout.width - 132, 12, 120, 38, 0x0b1220)
      .setOrigin(0)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true })
      .setDepth(20)
      .on('pointerup', () => this.toggleLogPanel());

    this.ui.logToggleText = this.add
      .text(layout.width - 122, 22, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#e2e8f0',
      })
      .setDepth(21);

    this.ui.logPanelBg = this.add
      .rectangle(panelX, panelY, panelW, panelH, 0x020617)
      .setOrigin(0)
      .setAlpha(0.96)
      .setStrokeStyle(1, 0x334155)
      .setDepth(40);

    this.ui.logPanelTitle = this.add
      .text(panelX + 12, panelY + 8, '개발 로그 패널 (F1 토글)', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#bfdbfe',
      })
      .setDepth(41);

    this.ui.logPanelHint = this.add
      .text(panelX + 12, panelY + 28, '마우스 휠 또는 ▲▼ 버튼으로 스크롤', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setDepth(41);

    this.ui.logScrollUp = this.add
      .text(panelX + panelW - 52, panelY + 8, '▲', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#e2e8f0',
      })
      .setDepth(41)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scrollLog(-1));

    this.ui.logScrollDown = this.add
      .text(panelX + panelW - 28, panelY + 8, '▼', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#e2e8f0',
      })
      .setDepth(41)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scrollLog(1));

    const viewportY = panelY + 50;
    const viewportH = panelH - 64;
    this.logVisibleCount = Math.max(3, Math.floor(viewportH / LOG_LINE_HEIGHT));

    this.ui.logViewport = this.add
      .zone(panelX + 10, viewportY, panelW - 20, viewportH)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    this.ui.logViewport.on('wheel', (_pointer, _gameObject, _dx, dy) => {
      this.scrollLog(dy > 0 ? 1 : -1);
    });

    this.ui.logLines = Array.from({ length: this.logVisibleCount }, (_, idx) => this.add
      .text(panelX + 12, viewportY + idx * LOG_LINE_HEIGHT, '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#e2e8f0',
        wordWrap: { width: panelW - 24, useAdvancedWrap: true },
      })
      .setDepth(41));

    const logItems = [
      this.ui.logPanelBg,
      this.ui.logPanelTitle,
      this.ui.logPanelHint,
      this.ui.logScrollUp,
      this.ui.logScrollDown,
      this.ui.logViewport,
      ...this.ui.logLines,
    ];

    logItems.forEach((item) => item.setVisible(this.isLogPanelVisible));
    this.ui.logPanelItems = logItems;
  }

  toggleLogPanel() {
    this.isLogPanelVisible = !this.isLogPanelVisible;
    this.ui.logPanelItems?.forEach((item) => item.setVisible(this.isLogPanelVisible));
    this.refreshUI();
  }

  scrollLog(direction) {
    const eventCount = this.combatState.combatLog?.events?.length ?? 0;
    const maxOffset = Math.max(0, eventCount - this.logVisibleCount);
    this.logScrollOffset = Phaser.Math.Clamp(this.logScrollOffset + direction, 0, maxOffset);
    this.renderLogList();
  }

  formatTimestamp(milliseconds) {
    const totalSeconds = Math.floor((milliseconds ?? 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  renderLogList() {
    if (!this.ui.logLines) {
      return;
    }

    const events = [...(this.combatState.combatLog?.events ?? [])].reverse();
    const maxOffset = Math.max(0, events.length - this.logVisibleCount);
    this.logScrollOffset = Phaser.Math.Clamp(this.logScrollOffset, 0, maxOffset);

    const visibleEvents = events.slice(this.logScrollOffset, this.logScrollOffset + this.logVisibleCount);

    this.ui.logLines.forEach((line, idx) => {
      const event = visibleEvents[idx];
      if (!event) {
        line.setText('');
        return;
      }

      const style = LOG_STYLE_BY_TYPE[event.type] ?? { icon: '•', color: '#e2e8f0' };
      line.setColor(style.color);
      line.setText(`[${this.formatTimestamp(event.timestamp)}] ${style.icon} ${event.message}`);
    });
  }

  tryApplyUpgrade(type) {
    const upgradeLevels = this.combatState.progression.upgrades;
    const currentLevel = type === ProgressionUpgradeType.ATTACK
      ? upgradeLevels.attackLevel
      : upgradeLevels.healthLevel;
    const nextCost = getUpgradeCost(type, currentLevel);

    if (this.combatState.gold < nextCost) {
      this.upgradeFeedback = `골드가 부족합니다. (필요: ${nextCost}G)`;
      this.ui.slotHint.setColor('#f87171');
      this.refreshUI();
      return;
    }

    const nextState = applyUpgrade(this.combatState, type);
    const isSuccess = nextState !== this.combatState;

    if (!isSuccess) {
      this.upgradeFeedback = '강화 실패: 상태를 확인해 주세요.';
      this.ui.slotHint.setColor('#f87171');
      this.refreshUI();
      return;
    }

    this.combatState = nextState;
    this.upgradeFeedback = type === ProgressionUpgradeType.ATTACK
      ? '공격력 강화 성공!'
      : '체력 강화 성공!';
    this.ui.slotHint.setColor('#86efac');
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

    const dps = calcDps(player);
    const survivability = calcSurvivability(player, monster);

    this.ui.combatMainInfo?.setText([
      `현재 대상: ${monster.name} (Lv.${monster.level})`,
      `기사 HP ${player.hp}/${player.maxHp}  |  ${monster.name} HP ${monster.hp}/${monster.maxHp}`,
      `예상 DPS: ${dps} | 예상 생존 시간: ${survivability}초`,
    ]);

    this.ui.playHint?.setText(`최근 전투 요약: ${combat.lastEvent}`);
    this.ui.offlineRewardText?.setText(this.offlineRewardNotice || '');

    const attackLevel = progression.upgrades.attackLevel;
    const healthLevel = progression.upgrades.healthLevel;
    const attackCost = getUpgradeCost(ProgressionUpgradeType.ATTACK, attackLevel);
    const healthCost = getUpgradeCost(ProgressionUpgradeType.HEALTH, healthLevel);

    this.ui.slotInfo?.setText([
      '슬롯 이름: 기사단 성장 제단',
      `공격력 강화 Lv.${attackLevel} | 체력 강화 Lv.${healthLevel}`,
      `현재 공격력 ${player.atk} | 현재 최대HP ${player.maxHp}`,
      `DPS ${dps} | 생존 ${survivability}초`,
    ]);
    this.ui.attackUpgradeText?.setText(`공격력 강화 (비용 ${attackCost}G)`);
    this.ui.healthUpgradeText?.setText(`체력 강화 (비용 ${healthCost}G)`);
    if (!this.upgradeFeedback) {
      this.ui.slotHint?.setColor('#fef08a');
    }
    this.ui.slotHint?.setText(this.upgradeFeedback || '강화 버튼으로 전투 체감을 올려보세요.');

    const tabMessage = {
      업그레이드: '업그레이드 탭: 영웅 슬롯/장비 확장 영역. 플레이 화면은 핵심 진행 정보만 유지됩니다.',
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
      '- 개발자 이벤트 로그: 우측 하단 도킹 패널(F1/버튼 토글)',
    ]);


    this.ui.logToggleText?.setText(this.isLogPanelVisible ? '로그 숨기기 (F1)' : '로그 보기 (F1)');
    this.renderLogList();
  }
}
