import { createCombatState, nextMonsterLevel } from './combatLogic.js';
import { spawnMonster } from './spawnMonster.js';
import { combatRules, playerBaseStats } from '../design/balance.js';

export const SAVE_VERSION = 1;
export const SAVE_STORAGE_KEY = 'mini-idle-game-save-v1';

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeInt = (value, fallback = 0) => Math.max(0, Math.floor(toSafeNumber(value, fallback)));

const clampStat = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const numeric = toSafeNumber(value, min);
  return Math.min(max, Math.max(min, numeric));
};

export const buildSaveState = (gameState, now = Date.now()) => ({
  version: SAVE_VERSION,
  savedAt: Math.max(0, Math.floor(now)),
  gold: toSafeInt(gameState?.gold, 0),
  playerStats: {
    atk: clampStat(gameState?.player?.atk, playerBaseStats.atk),
    maxHp: clampStat(gameState?.player?.maxHp, playerBaseStats.hp),
    hp: clampStat(gameState?.player?.hp, playerBaseStats.hp),
    cooldownMs: clampStat(gameState?.player?.cooldownMs, playerBaseStats.attackCooldownMs),
  },
  progress: {
    stage: toSafeInt(gameState?.progression?.difficultyLevel, 1) || 1,
    wave: toSafeInt(gameState?.progression?.killCount, 0),
    totalKills: toSafeInt(gameState?.progression?.killCount, 0),
  },
  equipment: {
    owned: ['기사단 성장 제단'],
    equipped: '기사단 성장 제단',
    upgrades: {
      attackLevel: toSafeInt(gameState?.progression?.upgrades?.attackLevel, 0),
      healthLevel: toSafeInt(gameState?.progression?.upgrades?.healthLevel, 0),
    },
  },
});

const hydrateCombatState = (saveData) => {
  const base = createCombatState();
  const stage = Math.max(1, toSafeInt(saveData.progress?.stage, 1));
  const killCount = toSafeInt(saveData.progress?.totalKills, 0);
  const attackLevel = toSafeInt(saveData.equipment?.upgrades?.attackLevel, 0);
  const healthLevel = toSafeInt(saveData.equipment?.upgrades?.healthLevel, 0);

  const nextMonster = spawnMonster(stage);
  const normalizedDifficulty = nextMonsterLevel(killCount);

  const maxHp = clampStat(saveData.playerStats?.maxHp, 1);
  const hp = clampStat(saveData.playerStats?.hp, 1, maxHp);

  return {
    ...base,
    gold: toSafeInt(saveData.gold, 0),
    player: {
      ...base.player,
      atk: clampStat(saveData.playerStats?.atk, playerBaseStats.atk),
      maxHp,
      hp,
      cooldownMs: clampStat(saveData.playerStats?.cooldownMs, playerBaseStats.attackCooldownMs),
      cooldownLeftMs: clampStat(saveData.playerStats?.cooldownMs, playerBaseStats.attackCooldownMs),
    },
    monster: {
      ...nextMonster,
      cooldownMs: combatRules.monsterAttackCooldownMs,
      cooldownLeftMs: combatRules.monsterAttackCooldownMs,
    },
    progression: {
      ...base.progression,
      killCount,
      difficultyLevel: Math.max(stage, normalizedDifficulty),
      upgrades: {
        attackLevel,
        healthLevel,
      },
    },
  };
};

export const restoreState = (rawSave) => {
  if (!rawSave || typeof rawSave !== 'object') {
    return {
      state: createCombatState(),
      meta: { isFallback: true, reason: 'invalid-save-object', savedAt: Date.now() },
    };
  }

  const normalizedSave = {
    version: toSafeInt(rawSave.version, SAVE_VERSION),
    savedAt: Math.max(0, toSafeInt(rawSave.savedAt, Date.now())),
    gold: toSafeInt(rawSave.gold, 0),
    playerStats: {
      atk: clampStat(rawSave.playerStats?.atk, playerBaseStats.atk),
      maxHp: clampStat(rawSave.playerStats?.maxHp, playerBaseStats.hp),
      hp: clampStat(rawSave.playerStats?.hp, playerBaseStats.hp),
      cooldownMs: clampStat(rawSave.playerStats?.cooldownMs, playerBaseStats.attackCooldownMs),
    },
    progress: {
      stage: Math.max(1, toSafeInt(rawSave.progress?.stage, 1)),
      wave: toSafeInt(rawSave.progress?.wave, 0),
      totalKills: toSafeInt(rawSave.progress?.totalKills, rawSave.progress?.wave ?? 0),
    },
    equipment: {
      owned: Array.isArray(rawSave.equipment?.owned) ? rawSave.equipment.owned : ['기사단 성장 제단'],
      equipped: rawSave.equipment?.equipped ?? '기사단 성장 제단',
      upgrades: {
        attackLevel: toSafeInt(rawSave.equipment?.upgrades?.attackLevel, 0),
        healthLevel: toSafeInt(rawSave.equipment?.upgrades?.healthLevel, 0),
      },
    },
  };

  return {
    state: hydrateCombatState(normalizedSave),
    meta: {
      isFallback: false,
      reason: null,
      savedAt: normalizedSave.savedAt,
      version: normalizedSave.version,
    },
  };
};
