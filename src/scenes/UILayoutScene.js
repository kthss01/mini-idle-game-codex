import {
  claimAllRewards,
  CombatEventType,
  changeZone,
  createCombatState,
  equipItemFromInventory,
  purchaseShopOffer,
  tickCombat,
  unequipSlot,
} from '../core/combatLogic.js';
import { applyOfflineReward, calculateOfflineReward } from '../core/offlineReward.js';
import { buildContentData } from '../data/contentData.js';
import { buildSaveState, restoreState, SAVE_STORAGE_KEY } from '../core/save.js';
import {
  ProgressionUpgradeType,
  applyUpgrade,
  calcDps,
  calcSurvivability,
  getUpgradeCost,
} from '../core/progression.js';
import { compareEquipmentDelta, EquipmentRarity, EquipmentSlot, rarityVisual } from '../core/equipment.js';
import { offlineRewardBalance } from '../design/offlineBalance.js';

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
const HP_BAR_WIDTH = 188;
const HP_BAR_HEIGHT = 16;
const HP_LOW_THRESHOLD = 0.3;
const HP_TRANSITION_MS = 200;
const TOGGLE_BUTTON_WIDTH = 132;
const TOGGLE_BUTTON_HEIGHT = 38;
const TOGGLE_BUTTON_GAP = 12;
const TOP_UI_MARGIN = 12;
const TOP_ACTION_BUTTON_WIDTH = 84;
const TOP_ACTION_BUTTON_HEIGHT = 34;
const TOP_ACTION_BUTTON_GAP = 8;

export default class UILayoutScene extends Phaser.Scene {
  constructor() {
    super('UILayoutScene');
    this.combatState = createCombatState();
    this.activeTab = '업그레이드';
    this.upgradeFeedback = '';
    this.selectedEquipmentId = null;
    this.ui = {};
    this.isLogPanelVisible = false;
    this.isStatusPanelVisible = false;
    this.logScrollOffset = 0;
    this.logVisibleCount = 8;
    this.playerHpDisplayRatio = 1;
    this.monsterHpDisplayRatio = 1;
    this.autoSaveTimer = null;
    this.beforeUnloadHandler = null;
    this.offlineRewardSummary = null;
    this.contentData = null;
    this.lastSkillEventTimestamp = -1;
    this.skillToast = null;
    this.actionToast = null;
  }

  preload() {
    this.load.json('content-zones', 'src/data/content/zones.json');
    this.load.json('content-monsters', 'src/data/content/monsters.json');
    this.load.json('content-items', 'src/data/content/items.json');
  }

  create() {
    this.contentData = buildContentData({
      zones: this.cache.json.get('content-zones') ?? [],
      monsters: this.cache.json.get('content-monsters') ?? [],
      items: this.cache.json.get('content-items') ?? [],
    });
    this.combatState = this.loadGameState();
    this.buildLayout();
    this.bindResize();
    this.bindInputs();
    this.refreshUI();
    this.showOfflineRewardNotice();
    this.setupPersistence();
  }

  update(_time, delta) {
    this.combatState = tickCombat(this.combatState, delta, this.contentData);
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

  bindInputs() {
    if (this.ui.f1HandlerBound) {
      return;
    }

    this.input.keyboard?.on('keydown-F1', (event) => {
      event?.preventDefault?.();
      this.toggleLogPanel();
    });

    this.input.keyboard?.on('keydown-E', () => {
      const first = this.combatState.inventory?.equipment?.[0];
      if (first?.id) {
        this.tryEquipItem(first.id);
      }
    });
    this.input.keyboard?.on('keydown-F2', (event) => {
      event?.preventDefault?.();
      this.handleManualSave();
    });
    this.input.keyboard?.on('keydown-F3', (event) => {
      event?.preventDefault?.();
      this.handleManualLoad();
    });
    this.input.keyboard?.on('keydown-F4', (event) => {
      event?.preventDefault?.();
      this.scene.start('TitleScene');
    });
    this.input.keyboard?.on('keydown-ONE', () => this.tryUnequipSlot(EquipmentSlot.WEAPON));
    this.input.keyboard?.on('keydown-TWO', () => this.tryUnequipSlot(EquipmentSlot.ARMOR));
    this.input.keyboard?.on('keydown-THREE', () => this.tryUnequipSlot(EquipmentSlot.RING));

    this.ui.f1HandlerBound = true;
  }

  setupPersistence() {
    this.autoSaveTimer?.remove?.(false);
    this.autoSaveTimer = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => this.saveGameState(),
    });

    this.beforeUnloadHandler = () => this.saveGameState();
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownPersistence());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownPersistence());
  }

  teardownPersistence() {
    this.saveGameState();
    this.autoSaveTimer?.remove?.(false);
    this.autoSaveTimer = null;

    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }

  loadGameState(options = {}) {
    const { applyOfflineRewardOnLoad = true, showOfflineRewardNotice = true } = options;
    const fallbackState = createCombatState(this.contentData);

    if (!showOfflineRewardNotice) {
      this.offlineRewardSummary = null;
    }

    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return fallbackState;
    }

    let parsedSave;
    try {
      parsedSave = JSON.parse(raw);
    } catch (_error) {
      window.localStorage.removeItem(SAVE_STORAGE_KEY);
      if (showOfflineRewardNotice) {
        this.offlineRewardSummary = {
          message: '저장 데이터가 손상되어 새 게임으로 시작합니다.',
        };
      }
      return fallbackState;
    }

    const restored = restoreState(parsedSave, this.contentData);
    const now = Date.now();
    const offlineSec = Math.max(0, (now - (restored.meta.savedAt ?? now)) / 1000);
    const reward = calculateOfflineReward(restored.state, offlineSec, offlineRewardBalance);
    const appliedState = applyOfflineReward(restored.state, reward);

    if (restored.meta.isFallback) {
      if (showOfflineRewardNotice) {
        this.offlineRewardSummary = {
          message: '저장 데이터를 복구하지 못해 기본 상태로 시작합니다.',
        };
      }
      return fallbackState;
    }

    if (showOfflineRewardNotice && (reward.killsGained > 0 || reward.goldGained > 0)) {
      this.offlineRewardSummary = {
        message: `오프라인 ${reward.offlineSecApplied}초 동안 ${reward.killsGained}마리 처치, ${reward.goldGained}G 획득!`,
      };
    }

    if (!applyOfflineRewardOnLoad) {
      return restored.state;
    }

    return appliedState;
  }

  saveGameState() {
    const saveState = buildSaveState(this.combatState, Date.now());
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveState));
  }

  showOfflineRewardNotice() {
    if (!this.offlineRewardSummary?.message) {
      return;
    }

    const width = Math.max(this.scale.width, 960);
    const panel = this.add
      .rectangle(width / 2, 88, 640, 52, 0x0b1220)
      .setStrokeStyle(2, 0x22d3ee)
      .setDepth(3000)
      .setAlpha(0.95);

    const text = this.add
      .text(width / 2, 88, this.offlineRewardSummary.message, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
      .setDepth(3001);

    this.tweens.add({
      targets: [panel, text],
      alpha: 0,
      duration: 450,
      delay: 3800,
      onComplete: () => {
        panel.destroy();
        text.destroy();
      },
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
    this.createStatusPanel(layout);
  }

  drawPanel(bounds, fill) {
    return this.add
      .rectangle(bounds.x, bounds.y, bounds.w, bounds.h, fill)
      .setOrigin(0)
      .setStrokeStyle(2, UI_THEME.panelStroke);
  }

  createTopHUD(bounds) {
    const toggleReservedWidth = (TOGGLE_BUTTON_WIDTH * 2) + TOGGLE_BUTTON_GAP + (TOP_UI_MARGIN * 2);
    const actionReservedWidth = (TOP_ACTION_BUTTON_WIDTH * 3) + (TOP_ACTION_BUTTON_GAP * 2) + 24;
    const slotAreaWidth = Math.max(360, bounds.w - toggleReservedWidth - actionReservedWidth);
    const slotWidth = slotAreaWidth / 3;
    const slotStartX = bounds.x + 18;

    this.ui.resourceTexts = [
      this.createHUDItem(slotStartX, bounds.y + 14, slotWidth - 24, '골드', '0'),
      this.createHUDItem(slotStartX + slotWidth, bounds.y + 14, slotWidth - 24, '보석', '0'),
      this.createHUDItem(slotStartX + slotWidth * 2, bounds.y + 14, slotWidth - 24, '스테이지', '1'),
    ];

    this.createTopActionButtons(bounds);
  }

  createTopActionButtons(bounds) {
    const rightOffset = (TOGGLE_BUTTON_WIDTH * 2) + TOGGLE_BUTTON_GAP + (TOP_UI_MARGIN * 3);
    const totalWidth = (TOP_ACTION_BUTTON_WIDTH * 3) + (TOP_ACTION_BUTTON_GAP * 2);
    const startX = bounds.x + bounds.w - rightOffset - totalWidth;
    const y = bounds.y + TOP_UI_MARGIN + 2;

    this.ui.topActionButtons = [
      this.createTopActionButton(startX, y, '저장', 0x0f766e, () => this.handleManualSave()),
      this.createTopActionButton(startX + TOP_ACTION_BUTTON_WIDTH + TOP_ACTION_BUTTON_GAP, y, '불러오기', 0x1d4ed8, () => this.handleManualLoad()),
      this.createTopActionButton(startX + (TOP_ACTION_BUTTON_WIDTH + TOP_ACTION_BUTTON_GAP) * 2, y, '타이틀로', 0x7c2d12, () => this.scene.start('TitleScene')),
    ];
  }

  createTopActionButton(x, y, label, color, onClick) {
    const button = this.add
      .rectangle(x, y, TOP_ACTION_BUTTON_WIDTH, TOP_ACTION_BUTTON_HEIGHT, color)
      .setOrigin(0)
      .setStrokeStyle(1, 0x94a3b8)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', onClick);

    const text = this.add.text(x + TOP_ACTION_BUTTON_WIDTH / 2, y + TOP_ACTION_BUTTON_HEIGHT / 2, label, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    return { button, text };
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

    this.ui.playerHpBarBg = this.add
      .rectangle(this.ui.playerSprite.x - HP_BAR_WIDTH / 2, centerY + 116, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x0f172a)
      .setOrigin(0)
      .setStrokeStyle(1, 0x475569);
    this.ui.playerHpBarFill = this.add
      .rectangle(this.ui.playerSprite.x - HP_BAR_WIDTH / 2, centerY + 116, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x22c55e)
      .setOrigin(0);
    this.ui.playerHpPercentText = this.add.text(this.ui.playerSprite.x - 22, centerY + 114, '100%', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#e2e8f0',
      fontStyle: 'bold',
    });

    this.ui.monsterHpBarBg = this.add
      .rectangle(this.ui.monsterSprite.x - HP_BAR_WIDTH / 2, centerY + 116, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x0f172a)
      .setOrigin(0)
      .setStrokeStyle(1, 0x475569);
    this.ui.monsterHpBarFill = this.add
      .rectangle(this.ui.monsterSprite.x - HP_BAR_WIDTH / 2, centerY + 116, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x22c55e)
      .setOrigin(0);
    this.ui.monsterHpPercentText = this.add.text(this.ui.monsterSprite.x - 22, centerY + 114, '100%', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#e2e8f0',
      fontStyle: 'bold',
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

    this.ui.equipmentInfo = this.add.text(bounds.x + 34, bounds.y + 358, '', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#e2e8f0',
      lineSpacing: 4,
      wordWrap: { width: bounds.w - 70, useAdvancedWrap: true },
    });

    this.ui.shopBuyButton = this.add
      .rectangle(bounds.x + 34, bounds.y + 448, bounds.w - 68, 34, 0x2563eb)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tryPurchaseShopOffer());

    this.ui.shopBuyText = this.add.text(bounds.x + 44, bounds.y + 456, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#dbeafe',
      fontStyle: 'bold',
    });

    this.ui.zoneTitle = this.add.text(bounds.x + 20, bounds.y + 490, '지역 이동', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#93c5fd',
      fontStyle: 'bold',
    });

    const unlocked = this.combatState?.progression?.unlockedZoneIds ?? [];
    this.ui.zoneButtons = unlocked.map((zoneId, index) => {
      const zone = this.contentData.zonesById[zoneId];
      const button = this.add
        .rectangle(bounds.x + 34, bounds.y + 520 + index * 32, bounds.w - 68, 28, 0x1d4ed8)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.tryChangeZone(zoneId));
      const text = this.add.text(bounds.x + 44, bounds.y + 525 + index * 32, zone?.name ?? zoneId, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#dbeafe',
      });
      return { zoneId, button, text };
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

    this.ui.claimRewardsButton = this.add
      .rectangle(bounds.x + bounds.w - 220, bounds.y + 14, 200, 36, 0x065f46)
      .setOrigin(0)
      .setStrokeStyle(1, 0x10b981)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tryClaimRewards());

    this.ui.claimRewardsText = this.add.text(bounds.x + bounds.w - 206, bounds.y + 23, '보상 수령', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#d1fae5',
      fontStyle: 'bold',
    });
  }


  getTopRightToggleLayout() {
    const layout = this.getLayout();
    const y = layout.top.y + TOP_UI_MARGIN;
    const logX = layout.width - TOGGLE_BUTTON_WIDTH - TOP_UI_MARGIN;
    const statusX = logX - TOGGLE_BUTTON_GAP - TOGGLE_BUTTON_WIDTH;
    return { statusX, logX, y };
  }

  createLogPanel(layout) {
    const panelW = Math.max(340, Math.floor(layout.width * 0.34));
    const panelH = Math.max(220, Math.floor(layout.height * 0.42));
    const panelX = layout.width - panelW - 18;
    const panelY = layout.height - panelH - 18;

    const toggleLayout = this.getTopRightToggleLayout();

    this.ui.logToggleButton = this.add
      .rectangle(toggleLayout.logX, toggleLayout.y, TOGGLE_BUTTON_WIDTH, TOGGLE_BUTTON_HEIGHT, 0x0b1220)
      .setOrigin(0)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true })
      .setDepth(20)
      .on('pointerup', () => this.toggleLogPanel());

    this.ui.logToggleText = this.add
      .text(toggleLayout.logX + (TOGGLE_BUTTON_WIDTH / 2), toggleLayout.y + (TOGGLE_BUTTON_HEIGHT / 2), '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
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

  createStatusPanel(layout) {
    const panelW = Math.max(320, Math.floor(layout.width * 0.28));
    const panelH = Math.max(230, Math.floor(layout.height * 0.34));
    const panelX = layout.width - panelW - 18;
    const panelY = layout.height - panelH - 18;

    const toggleLayout = this.getTopRightToggleLayout();

    this.ui.statusToggleButton = this.add
      .rectangle(toggleLayout.statusX, toggleLayout.y, TOGGLE_BUTTON_WIDTH, TOGGLE_BUTTON_HEIGHT, 0x0b1220)
      .setOrigin(0)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true })
      .setDepth(20)
      .on('pointerup', () => this.toggleStatusPanel());

    this.ui.statusToggleText = this.add
      .text(toggleLayout.statusX + (TOGGLE_BUTTON_WIDTH / 2), toggleLayout.y + (TOGGLE_BUTTON_HEIGHT / 2), '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.ui.statusPanelBg = this.add
      .rectangle(panelX, panelY, panelW, panelH, 0x020617)
      .setOrigin(0)
      .setAlpha(0.96)
      .setStrokeStyle(1, 0x1e40af)
      .setDepth(40);

    this.ui.statusPanelTitle = this.add
      .text(panelX + 12, panelY + 8, '상태 패널', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#93c5fd',
        fontStyle: 'bold',
      })
      .setDepth(41);

    this.ui.statusPanelBody = this.add
      .text(panelX + 12, panelY + 32, '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#e2e8f0',
        lineSpacing: 5,
        wordWrap: { width: panelW - 24, useAdvancedWrap: true },
      })
      .setDepth(41);

    this.ui.statusPanelItems = [
      this.ui.statusPanelBg,
      this.ui.statusPanelTitle,
      this.ui.statusPanelBody,
    ];
    this.ui.statusPanelItems.forEach((item) => item.setVisible(this.isStatusPanelVisible));
  }

  toggleLogPanel() {
    this.isLogPanelVisible = !this.isLogPanelVisible;
    this.ui.logPanelItems?.forEach((item) => item.setVisible(this.isLogPanelVisible));
    this.syncDockedPanelsLayout();
    this.refreshUI();
  }

  toggleStatusPanel() {
    this.isStatusPanelVisible = !this.isStatusPanelVisible;
    this.ui.statusPanelItems?.forEach((item) => item.setVisible(this.isStatusPanelVisible));
    this.syncDockedPanelsLayout();
    this.refreshUI();
  }

  syncDockedPanelsLayout() {
    const layout = this.getLayout();
    let rightX = layout.width - 18;

    if (this.isLogPanelVisible && this.ui.logPanelBg) {
      const logW = this.ui.logPanelBg.width;
      const logX = rightX - logW;
      const logY = layout.height - this.ui.logPanelBg.height - 18;
      this.positionLogPanel(logX, logY);
      rightX = logX - 14;
    }

    if (this.isStatusPanelVisible && this.ui.statusPanelBg) {
      const statusW = this.ui.statusPanelBg.width;
      const statusX = rightX - statusW;
      const statusY = layout.height - this.ui.statusPanelBg.height - 18;
      this.positionStatusPanel(statusX, statusY);
    }
  }

  positionLogPanel(panelX, panelY) {
    const panelW = this.ui.logPanelBg.width;
    this.ui.logPanelBg.setPosition(panelX, panelY);
    this.ui.logPanelTitle.setPosition(panelX + 12, panelY + 8);
    this.ui.logPanelHint.setPosition(panelX + 12, panelY + 28);
    this.ui.logScrollUp.setPosition(panelX + panelW - 52, panelY + 8);
    this.ui.logScrollDown.setPosition(panelX + panelW - 28, panelY + 8);

    const viewportY = panelY + 50;
    this.ui.logViewport.setPosition(panelX + 10, viewportY);
    this.ui.logLines.forEach((line, idx) => line.setPosition(panelX + 12, viewportY + idx * LOG_LINE_HEIGHT));
  }

  positionStatusPanel(panelX, panelY) {
    this.ui.statusPanelBg.setPosition(panelX, panelY);
    this.ui.statusPanelTitle.setPosition(panelX + 12, panelY + 8);
    this.ui.statusPanelBody.setPosition(panelX + 12, panelY + 32);
  }

  getCombatSnapshot() {
    const { player, monster, progression } = this.combatState;
    const playerHpRatio = Phaser.Math.Clamp((player.hp || 0) / Math.max(1, player.maxHp || 1), 0, 1);
    const monsterHpRatio = Phaser.Math.Clamp((monster.hp || 0) / Math.max(1, monster.maxHp || 1), 0, 1);

    return {
      player,
      monster,
      progression,
      playerHpRatio,
      monsterHpRatio,
      playerHpPercent: Math.round(playerHpRatio * 100),
      monsterHpPercent: Math.round(monsterHpRatio * 100),
      playerAttackSpeed: (1000 / Math.max(1, player.cooldownMs || 1)).toFixed(2),
      monsterAttackSpeed: (1000 / Math.max(1, monster.cooldownMs || 1)).toFixed(2),
    };
  }

  animateHpRatio(kind, targetRatio) {
    const key = kind === 'player' ? 'playerHpDisplayRatio' : 'monsterHpDisplayRatio';
    const tweenKey = kind === 'player' ? 'playerHpTween' : 'monsterHpTween';

    this[tweenKey]?.stop?.();
    this[tweenKey] = this.tweens.addCounter({
      from: this[key],
      to: targetRatio,
      duration: HP_TRANSITION_MS,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        this[key] = tween.getValue();
      },
      onComplete: () => {
        this[key] = targetRatio;
      },
    });
  }

  updateHpBar(kind, hpRatio, hpPercent) {
    const fill = kind === 'player' ? this.ui.playerHpBarFill : this.ui.monsterHpBarFill;
    const text = kind === 'player' ? this.ui.playerHpPercentText : this.ui.monsterHpPercentText;
    const displayRatio = kind === 'player' ? this.playerHpDisplayRatio : this.monsterHpDisplayRatio;
    const ratio = Phaser.Math.Clamp(displayRatio, 0, 1);

    fill?.setDisplaySize(HP_BAR_WIDTH * ratio, HP_BAR_HEIGHT);
    fill?.setFillStyle(hpRatio <= HP_LOW_THRESHOLD ? 0xef4444 : 0x22c55e);
    text?.setText(`${hpPercent}%`);
    text?.setColor(hpRatio <= HP_LOW_THRESHOLD ? '#fecaca' : '#e2e8f0');
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


  getSlotLabel(slot) {
    if (slot === EquipmentSlot.WEAPON) return '무기';
    if (slot === EquipmentSlot.ARMOR) return '갑옷';
    if (slot === EquipmentSlot.RING) return '반지';
    return slot;
  }

  getRarityVisual(rarity) {
    return rarityVisual[rarity] ?? rarityVisual[EquipmentRarity.COMMON];
  }

  formatDelta(value, suffix = '') {
    if (value === 0) {
      return `→ 0${suffix}`;
    }
    const arrow = value > 0 ? '↑' : '↓';
    const sign = value > 0 ? '+' : '';
    return `${arrow} ${sign}${value}${suffix}`;
  }

  tryPurchaseShopOffer() {
    const nextState = purchaseShopOffer(this.combatState);
    if (nextState === this.combatState) {
      this.upgradeFeedback = '상점 구매 실패: 골드 또는 상품 상태를 확인하세요.';
      this.ui.slotHint.setColor('#f87171');
      this.refreshUI();
      return;
    }

    this.combatState = nextState;
    this.upgradeFeedback = '상점에서 장비를 구매했습니다.';
    this.ui.slotHint.setColor('#86efac');
    this.refreshUI();
  }

  tryEquipItem(itemId) {
    const nextState = equipItemFromInventory(this.combatState, itemId);
    if (nextState === this.combatState) {
      this.upgradeFeedback = '장착 실패: 인벤토리에서 아이템을 찾을 수 없습니다.';
      this.ui.slotHint.setColor('#f87171');
      this.refreshUI();
      return;
    }

    this.combatState = nextState;
    this.selectedEquipmentId = itemId;
    this.upgradeFeedback = '장비를 장착했습니다.';
    this.ui.slotHint.setColor('#86efac');
    this.refreshUI();
  }

  tryUnequipSlot(slot) {
    const nextState = unequipSlot(this.combatState, slot);
    if (nextState === this.combatState) {
      this.upgradeFeedback = '해제할 장비가 없습니다.';
      this.ui.slotHint.setColor('#f87171');
      this.refreshUI();
      return;
    }

    this.combatState = nextState;
    this.upgradeFeedback = `${this.getSlotLabel(slot)} 장비를 해제했습니다.`;
    this.ui.slotHint.setColor('#86efac');
    this.refreshUI();
  }


  tryChangeZone(zoneId) {
    this.combatState = changeZone(this.combatState, zoneId, this.contentData);
    this.refreshUI();
  }

  tryClaimRewards() {
    const nextState = claimAllRewards(this.combatState);
    if (nextState === this.combatState) {
      this.upgradeFeedback = '수령 가능한 퀘스트/업적 보상이 없습니다.';
      this.ui.slotHint.setColor('#fef08a');
      this.refreshUI();
      return;
    }

    this.combatState = nextState;
    this.upgradeFeedback = `보상 수령 완료 (+${nextState.rewardSummary.gold}G, 상자 ${nextState.rewardSummary.boxes}개)`;
    this.ui.slotHint.setColor('#86efac');
    this.refreshUI();
  }


  showSkillToast(message) {
    if (!message) {
      return;
    }

    this.skillToast?.destroy?.();
    const layout = this.getLayout();
    this.skillToast = this.add
      .text(layout.middleLeft.x + 24, layout.middleLeft.y + 18, `✨ ${message}`, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#e9d5ff',
        stroke: '#111827',
        strokeThickness: 4,
      })
      .setDepth(2600)
      .setAlpha(0.98);

    this.tweens.add({
      targets: this.skillToast,
      y: this.skillToast.y - 14,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        this.skillToast?.destroy?.();
        this.skillToast = null;
      },
    });
  }

  showActionToast(message) {
    if (!message) {
      return;
    }

    this.actionToast?.destroy?.();
    const layout = this.getLayout();
    this.actionToast = this.add
      .text(layout.top.x + (layout.top.w / 2), layout.top.y + layout.top.h - 8, message, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#fef3c7',
        stroke: '#111827',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(2600)
      .setAlpha(0.95);

    this.tweens.add({
      targets: this.actionToast,
      alpha: 0,
      y: this.actionToast.y - 8,
      duration: 700,
      onComplete: () => {
        this.actionToast?.destroy?.();
        this.actionToast = null;
      },
    });
  }

  handleManualSave() {
    this.saveGameState();
    this.showActionToast('저장 완료');
  }

  handleManualLoad() {
    const nextState = this.loadGameState({ applyOfflineRewardOnLoad: false, showOfflineRewardNotice: false });
    this.combatState = nextState;
    this.refreshUI();
    this.showActionToast('불러오기 완료');
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
    const combatSnapshot = this.getCombatSnapshot();
    const currentStage = progression.difficultyLevel;

    const gems = Math.floor(progression.killCount / 15);
    this.ui.resourceTexts?.[0]?.valueText?.setText(`${gold}`);
    this.ui.resourceTexts?.[1]?.valueText?.setText(`${gems}`);
    this.ui.resourceTexts?.[2]?.valueText?.setText(`${currentStage}`);

    const dps = calcDps(player);
    const survivability = calcSurvivability(player, monster);

    const zoneName = this.contentData?.zonesById?.[progression.currentZoneId]?.name ?? '미지 지역';
    const drops = Object.entries(this.combatState.inventory?.materials ?? {})
      .slice(0, 3)
      .map(([itemId, qty]) => `${this.contentData.itemsById?.[itemId]?.name ?? itemId} x${qty}`)
      .join(', ');

    this.ui.combatMainInfo?.setText([
      `현재 지역: ${zoneName} | 대상: ${monster.name} (Lv.${monster.level})`,
      `기사 HP ${combatSnapshot.playerHpPercent}%  |  ${monster.name} HP ${combatSnapshot.monsterHpPercent}%`,
      `예상 DPS: ${dps} | 예상 생존 시간: ${survivability}초`,
      `재료 보유: ${drops || '없음'}`,
    ]);

    if (Math.abs(combatSnapshot.playerHpRatio - this.playerHpDisplayRatio) > 0.001) {
      this.animateHpRatio('player', combatSnapshot.playerHpRatio);
    }
    if (Math.abs(combatSnapshot.monsterHpRatio - this.monsterHpDisplayRatio) > 0.001) {
      this.animateHpRatio('monster', combatSnapshot.monsterHpRatio);
    }
    this.updateHpBar('player', combatSnapshot.playerHpRatio, combatSnapshot.playerHpPercent);
    this.updateHpBar('monster', combatSnapshot.monsterHpRatio, combatSnapshot.monsterHpPercent);

    this.ui.playHint?.setText(`최근 전투 요약: ${combat.lastEvent} | 단축키 E: 인벤 첫 장비 장착, 1/2/3: 슬롯 해제`);

    const latestSkillEvent = [...(this.combatState.combatLog?.events ?? [])]
      .reverse()
      .find((event) => event.type === CombatEventType.SKILL_TRIGGERED);

    if (latestSkillEvent && latestSkillEvent.timestamp !== this.lastSkillEventTimestamp) {
      this.lastSkillEventTimestamp = latestSkillEvent.timestamp;
      this.showSkillToast(latestSkillEvent.message);
    }
    this.ui.offlineRewardText?.setText(this.offlineRewardSummary?.message || '');

    const attackLevel = progression.upgrades.attackLevel;
    const healthLevel = progression.upgrades.healthLevel;
    const attackCost = getUpgradeCost(ProgressionUpgradeType.ATTACK, attackLevel);
    const healthCost = getUpgradeCost(ProgressionUpgradeType.HEALTH, healthLevel);

    this.ui.slotInfo?.setText([
      '슬롯 이름: 기사단 성장 제단',
      `공격력 강화 Lv.${attackLevel} | 체력 강화 Lv.${healthLevel}`,
      `현재 공격력 ${player.atk} (장비 +${player.equipmentBonus?.atk ?? 0})`,
      `현재 최대HP ${player.maxHp} (장비 +${player.equipmentBonus?.maxHp ?? 0})`,
      `DPS ${dps} | 생존 ${survivability}초`,
    ]);

    const slotItems = this.combatState.player?.equipmentSlots ?? {};
    const inventoryEquip = this.combatState.inventory?.equipment ?? [];
    const shopOffer = this.combatState.inventory?.shopOffer;
    const slotLines = Object.values(EquipmentSlot).map((slot) => {
      const item = slotItems[slot];
      if (!item) {
        return `- ${this.getSlotLabel(slot)}: (비어 있음) [해제: ${this.getSlotLabel(slot)}]`;
      }
      const visual = this.getRarityVisual(item.rarity);
      return `- ${this.getSlotLabel(slot)}: ${visual.icon} ${item.name} (${item.baseStats.atk}/${item.baseStats.hp}) [해제:${slot}]`;
    });

    const candidate = inventoryEquip[0] ?? null;
    const compareTarget = candidate ? (slotItems[candidate.slot] ?? null) : null;
    const delta = candidate ? compareEquipmentDelta(compareTarget, candidate) : { atk: 0, maxHp: 0 };
    const shopText = shopOffer
      ? `${this.getRarityVisual(shopOffer.rarity).icon} ${shopOffer.name} | 가격 ${shopOffer.value}G | 기본 ATK ${shopOffer.baseStats.atk}, HP ${shopOffer.baseStats.hp}`
      : '상점 상품 없음';

    this.ui.equipmentInfo?.setText([
      '[장비 슬롯]',
      ...slotLines,
      '',
      `[인벤토리 장비 ${inventoryEquip.length}개]`,
      candidate
        ? `장착 후보: ${candidate.name} → 예상 변화 ATK ${this.formatDelta(delta.atk)}, HP ${this.formatDelta(delta.maxHp)}`
        : '장착 후보 없음 (상점에서 먼저 구매)',
      '※ 장착: 인벤토리 첫 아이템 자동 장착',
      `※ 상점: ${shopText}`,
    ]);
    this.ui.attackUpgradeText?.setText(`공격력 강화 (비용 ${attackCost}G)`);
    this.ui.healthUpgradeText?.setText(`체력 강화 (비용 ${healthCost}G)`);
    this.ui.shopBuyText?.setText(this.combatState.inventory?.shopOffer ? `상점 구매: ${this.combatState.inventory.shopOffer.name} (${this.combatState.inventory.shopOffer.value}G)` : '상점 상품 없음');
    this.ui.shopBuyButton?.setFillStyle(this.combatState.inventory?.shopOffer && gold >= (this.combatState.inventory.shopOffer.value ?? 0) ? 0x2563eb : 0x334155);
    if (!this.upgradeFeedback) {
      this.ui.slotHint?.setColor('#fef08a');
    }
    this.ui.slotHint?.setText(this.upgradeFeedback || '강화 버튼으로 전투 체감을 올려보세요.');

    const objectives = this.combatState.objectives;
    const getStatusLabel = (entry) => {
      if (entry.status === 'claimed') return '수령 완료';
      if (entry.status === 'claimable') return '수령 가능';
      return '진행 중';
    };

    const questLines = (objectives?.quests?.entries ?? []).map((entry) => (
      `- [${getStatusLabel(entry)}] ${entry.name} ${entry.progress}/${entry.target}`
    ));
    const achievementLines = (objectives?.achievements?.entries ?? []).map((entry) => (
      `- [${getStatusLabel(entry)}] ${entry.name} ${entry.progress}/${entry.target}`
    ));

    const tabMessage = {
      업그레이드: [
        '업그레이드 탭: 장비/강화/상점 연동 완료. 장착/해제/비교가 가능합니다.',
      ],
      퀘스트: [
        `일일 퀘스트 리셋 정책: ${objectives?.resetPolicy?.description ?? '로컬 자정 기준 리셋'}`,
        '',
        '[일일 퀘스트]',
        ...questLines,
        '',
        '[업적(누적/영구)]',
        ...achievementLines,
      ],
      상점: [
        '상점 탭: 골드를 소모해 장비를 구매할 수 있습니다.',
        '퀘스트/업적 보상 상자도 동일한 장비 등급 테이블을 재사용합니다.',
      ],
    };

    this.ui.tabButtons?.forEach(({ tab, button }) => {
      button.setFillStyle(tab === this.activeTab ? UI_THEME.tabActive : UI_THEME.tabInactive);
    });

    this.ui.zoneButtons?.forEach(({ zoneId, button, text }) => {
      const isCurrent = zoneId === progression.currentZoneId;
      button.setFillStyle(isCurrent ? 0x16a34a : 0x1d4ed8);
      text.setColor(isCurrent ? '#dcfce7' : '#dbeafe');
    });

    const claimableExists = [...(objectives?.quests?.entries ?? []), ...(objectives?.achievements?.entries ?? [])]
      .some((entry) => entry.status === 'claimable');
    this.ui.claimRewardsButton?.setFillStyle(claimableExists ? 0x047857 : 0x334155);
    this.ui.claimRewardsText?.setColor(claimableExists ? '#d1fae5' : '#94a3b8');

    this.ui.tabContent?.setText([
      ...(tabMessage[this.activeTab] ?? []),
      '',
      '반응형 기준',
      '- 최소 해상도: 960x540 유지',
      '- 패널 비율: 상단 14% / 중단 64%(좌64:우36) / 하단 22%',
      '- 개발자 이벤트 로그: 우측 하단 도킹 패널(F1/버튼 토글)',
    ]);


    this.ui.statusPanelBody?.setText([
      '[기사 상세]',
      `HP: ${player.hp}/${player.maxHp} (${combatSnapshot.playerHpPercent}%)`,
      `공격력: ${player.atk}`,
      '방어력: 미구현',
      `공격속도: ${combatSnapshot.playerAttackSpeed}/s`,
      '치명타: 미구현',
      '',
      `[${monster.name} 상세]`,
      `HP: ${monster.hp}/${monster.maxHp} (${combatSnapshot.monsterHpPercent}%)`,
      `공격력: ${monster.atk}`,
      '방어력: 미구현',
      `공격속도: ${combatSnapshot.monsterAttackSpeed}/s`,
      '치명타: 미구현',
    ]);

    this.ui.statusToggleText?.setText(this.isStatusPanelVisible ? '상태 숨기기' : '상태 보기');
    this.ui.logToggleText?.setText(this.isLogPanelVisible ? '로그 숨기기 (F1)' : '로그 보기 (F1)');
    this.syncDockedPanelsLayout();
    this.renderLogList();
  }
}
