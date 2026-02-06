import { createCombatState } from './combatLogic.js';
import { spawnMonster } from './spawnMonster.js';
import { combatRules } from '../design/balance.js';

export const SAVE_SCHEMA_VERSION = 1;

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeInteger = (value, fallback = 0, min = 0) => {
  const normalized = Math.floor(normalizeNumber(value, fallback));
  return Math.max(min, normalized);
};

const parseRawSave = (rawSave) => {
  if (!rawSave) {
    return null;
  }

  if (typeof rawSave === 'string') {
    try {
      return JSON.parse(rawSave);
    } catch (_error) {
      return null;
    }
  }

  if (typeof rawSave === 'object') {
    return rawSave;
  }

  return null;
};

export const buildSaveState = (gameState, now = Date.now()) => {
  const safeState = gameState ?? createCombatState();

  return {
    version: SAVE_SCHEMA_VERSION,
    savedAt: normalizeInteger(now, Date.now()),
    gold: normalizeInteger(safeState.gold, 0),
    playerStats: {
      hp: normalizeInteger(safeState.player?.hp, 1, 1),
      maxHp: normalizeInteger(safeState.player?.maxHp, 1, 1),
      atk: normalizeInteger(safeState.player?.atk, 1, 1),
      cooldownMs: normalizeInteger(safeState.player?.cooldownMs, 700, 1),
      cooldownLeftMs: normalizeInteger(
        safeState.player?.cooldownLeftMs,
        safeState.player?.cooldownMs ?? 700,
        0
      ),
    },
    progress: {
      stage: normalizeInteger(safeState.progression?.difficultyLevel, 1, 1),
      wave: normalizeInteger(safeState.progression?.killCount, 0, 0),
      totalKills: normalizeInteger(safeState.progression?.killCount, 0, 0),
      upgrades: {
        attackLevel: normalizeInteger(safeState.progression?.upgrades?.attackLevel, 0, 0),
        healthLevel: normalizeInteger(safeState.progression?.upgrades?.healthLevel, 0, 0),
      },
    },
    equipment: {
      equippedTier: 'starter',
      ownedTiers: ['starter'],
    },
  };
};

export const restoreState = (rawSave) => {
  const parsed = parseRawSave(rawSave);
  const baseState = createCombatState();

  if (!parsed || normalizeInteger(parsed.version, 0) !== SAVE_SCHEMA_VERSION) {
    return {
      state: baseState,
      meta: {
        version: SAVE_SCHEMA_VERSION,
        savedAt: Date.now(),
        isValid: false,
      },
    };
  }

  const playerStats = parsed.playerStats ?? {};
  const progress = parsed.progress ?? {};
  const upgrades = progress.upgrades ?? {};

  const restored = createCombatState();
  restored.gold = normalizeInteger(parsed.gold, baseState.gold, 0);
  restored.player = {
    ...restored.player,
    hp: normalizeInteger(playerStats.hp, baseState.player.hp, 1),
    maxHp: normalizeInteger(playerStats.maxHp, baseState.player.maxHp, 1),
    atk: normalizeInteger(playerStats.atk, baseState.player.atk, 1),
    cooldownMs: normalizeInteger(playerStats.cooldownMs, baseState.player.cooldownMs, 1),
    cooldownLeftMs: normalizeInteger(
      playerStats.cooldownLeftMs,
      baseState.player.cooldownLeftMs,
      0
    ),
  };

  restored.progression = {
    ...restored.progression,
    killCount: normalizeInteger(progress.totalKills, baseState.progression.killCount, 0),
    difficultyLevel: normalizeInteger(progress.stage, baseState.progression.difficultyLevel, 1),
    upgrades: {
      attackLevel: normalizeInteger(upgrades.attackLevel, 0, 0),
      healthLevel: normalizeInteger(upgrades.healthLevel, 0, 0),
    },
  };

  const restoredMonster = spawnMonster(restored.progression.difficultyLevel);
  restored.monster = {
    ...restoredMonster,
    cooldownMs: combatRules.monsterAttackCooldownMs,
    cooldownLeftMs: combatRules.monsterAttackCooldownMs,
  };

  const safeSavedAt = normalizeInteger(parsed.savedAt, Date.now(), 0);

  return {
    state: restored,
    meta: {
      version: SAVE_SCHEMA_VERSION,
      savedAt: safeSavedAt,
      isValid: true,
    },
  };
};
