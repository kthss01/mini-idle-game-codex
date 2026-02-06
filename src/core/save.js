import { createCombatState, nextMonsterLevel } from './combatLogic.js';
import { combatRules, playerBaseStats } from '../design/balance.js';
import { getDefaultZone } from '../data/contentData.js';

export const SAVE_VERSION = 2;
export const SAVE_STORAGE_KEY = 'mini-idle-game-save-v2';

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeInt = (value, fallback = 0) => Math.max(0, Math.floor(toSafeNumber(value, fallback)));
const clampStat = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(min, toSafeNumber(value, min)));

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
    totalKills: toSafeInt(gameState?.progression?.killCount, 0),
    currentZoneId: gameState?.progression?.currentZoneId ?? null,
    unlockedZoneIds: Array.isArray(gameState?.progression?.unlockedZoneIds)
      ? gameState.progression.unlockedZoneIds
      : [],
  },
  equipment: {
    upgrades: {
      attackLevel: toSafeInt(gameState?.progression?.upgrades?.attackLevel, 0),
      healthLevel: toSafeInt(gameState?.progression?.upgrades?.healthLevel, 0),
    },
  },
  inventory: {
    materials: gameState?.inventory?.materials ?? {},
  },
});

const hydrateCombatState = (saveData, contentData) => {
  const base = createCombatState(contentData);
  const stage = Math.max(1, toSafeInt(saveData.progress?.stage, 1));
  const killCount = toSafeInt(saveData.progress?.totalKills, 0);
  const difficulty = Math.max(stage, nextMonsterLevel(killCount));
  const maxHp = clampStat(saveData.playerStats?.maxHp, 1);

  const nextProgression = {
    ...base.progression,
    killCount,
    difficultyLevel: difficulty,
    currentZoneId: saveData.progress?.currentZoneId ?? base.progression.currentZoneId ?? getDefaultZone(contentData)?.id,
    unlockedZoneIds: Array.isArray(saveData.progress?.unlockedZoneIds) && saveData.progress.unlockedZoneIds.length > 0
      ? saveData.progress.unlockedZoneIds
      : base.progression.unlockedZoneIds,
    upgrades: {
      attackLevel: toSafeInt(saveData.equipment?.upgrades?.attackLevel, 0),
      healthLevel: toSafeInt(saveData.equipment?.upgrades?.healthLevel, 0),
    },
  };

  return {
    ...base,
    gold: toSafeInt(saveData.gold, 0),
    player: {
      ...base.player,
      atk: clampStat(saveData.playerStats?.atk, playerBaseStats.atk),
      maxHp,
      hp: clampStat(saveData.playerStats?.hp, 1, maxHp),
      cooldownMs: clampStat(saveData.playerStats?.cooldownMs, playerBaseStats.attackCooldownMs),
      cooldownLeftMs: clampStat(saveData.playerStats?.cooldownMs, playerBaseStats.attackCooldownMs),
    },
    monster: {
      ...base.monster,
      cooldownMs: combatRules.monsterAttackCooldownMs,
      cooldownLeftMs: combatRules.monsterAttackCooldownMs,
    },
    progression: nextProgression,
    inventory: {
      materials: saveData.inventory?.materials ?? {},
      lastDrops: [],
    },
  };
};

export const restoreState = (rawSave, contentData) => {
  if (!rawSave || typeof rawSave !== 'object') {
    return { state: createCombatState(contentData), meta: { isFallback: true, reason: 'invalid-save-object', savedAt: Date.now() } };
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
      totalKills: toSafeInt(rawSave.progress?.totalKills, rawSave.progress?.wave ?? 0),
      currentZoneId: rawSave.progress?.currentZoneId ?? null,
      unlockedZoneIds: Array.isArray(rawSave.progress?.unlockedZoneIds) ? rawSave.progress.unlockedZoneIds : [],
    },
    equipment: {
      upgrades: {
        attackLevel: toSafeInt(rawSave.equipment?.upgrades?.attackLevel, 0),
        healthLevel: toSafeInt(rawSave.equipment?.upgrades?.healthLevel, 0),
      },
    },
    inventory: {
      materials: rawSave.inventory?.materials ?? {},
    },
  };

  return {
    state: hydrateCombatState(normalizedSave, contentData),
    meta: {
      isFallback: false,
      reason: null,
      savedAt: normalizedSave.savedAt,
      version: normalizedSave.version,
    },
  };
};
