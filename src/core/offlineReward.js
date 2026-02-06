import { growthRules } from '../design/balance.js';
import { offlineRewardConfig } from '../design/offlineBalance.js';
import { spawnMonster } from './spawnMonster.js';

const safeFloor = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
};

const getKillRateMultiplier = (difficultyLevel, config) => {
  const brackets = config.levelBrackets ?? [];
  return (
    brackets.find((entry) => difficultyLevel <= entry.maxDifficultyLevel)?.killRateMultiplier ?? 1
  );
};

const getNextDifficultyLevel = (killCount) =>
  1 + Math.floor(Math.max(0, killCount) / growthRules.difficultyStepPerKills);

export const calculateOfflineReward = (state, offlineSec, balanceConfig = offlineRewardConfig) => {
  if (!state || offlineSec <= 0) {
    return {
      killsGained: 0,
      goldGained: 0,
      offlineSecApplied: 0,
    };
  }

  const cappedSec = Math.min(Math.max(0, offlineSec), balanceConfig.offlineCapSec ?? 0);
  if (cappedSec <= 0) {
    return {
      killsGained: 0,
      goldGained: 0,
      offlineSecApplied: 0,
    };
  }

  const playerAtk = Math.max(1, safeFloor(state.player?.atk, 1));
  const playerMaxHp = Math.max(1, safeFloor(state.player?.maxHp, 1));
  const playerCooldownMs = Math.max(1, safeFloor(state.player?.cooldownMs, 700));
  const playerDps = playerAtk / (playerCooldownMs / 1000);

  const efficiency = Math.max(0, Math.min(1, Number(balanceConfig.offlineEfficiency ?? 1)));
  const defeatPenaltyMultiplier = Math.max(0, Math.min(1, Number(balanceConfig.defeatPenaltyMultiplier ?? 1)));

  let remainingSec = cappedSec;
  let currentKillCount = Math.max(0, safeFloor(state.progression?.killCount));
  let currentDifficulty = Math.max(1, safeFloor(state.progression?.difficultyLevel, 1));
  let killsGained = 0;
  let goldGained = 0;

  while (remainingSec > 0) {
    const monster = spawnMonster(currentDifficulty);
    const killRateMultiplier = getKillRateMultiplier(currentDifficulty, balanceConfig);
    const effectiveDps = Math.max(0.001, playerDps * efficiency * killRateMultiplier);

    const expectedKillTimeSec = monster.maxHp / effectiveDps;
    if (!Number.isFinite(expectedKillTimeSec) || expectedKillTimeSec <= 0 || expectedKillTimeSec > remainingSec) {
      break;
    }

    const incomingDamage = (monster.atk / 1.2) * expectedKillTimeSec;
    const survivabilityMultiplier = incomingDamage > playerMaxHp ? defeatPenaltyMultiplier : 1;

    remainingSec -= expectedKillTimeSec;
    killsGained += 1;
    goldGained += Math.floor(monster.goldReward * survivabilityMultiplier);

    currentKillCount += 1;
    currentDifficulty = getNextDifficultyLevel(currentKillCount);
  }

  return {
    killsGained,
    goldGained,
    offlineSecApplied: Math.floor(cappedSec - remainingSec),
  };
};

export const applyOfflineReward = (state, reward) => {
  if (!state) {
    return state;
  }

  const killsGained = Math.max(0, safeFloor(reward?.killsGained));
  const goldGained = Math.max(0, safeFloor(reward?.goldGained));

  if (killsGained === 0 && goldGained === 0) {
    return state;
  }

  const nextKillCount = Math.max(0, safeFloor(state.progression?.killCount) + killsGained);
  const nextDifficultyLevel = getNextDifficultyLevel(nextKillCount);
  const nextMonster = spawnMonster(nextDifficultyLevel);

  return {
    ...state,
    gold: Math.max(0, safeFloor(state.gold) + goldGained),
    progression: {
      ...state.progression,
      killCount: nextKillCount,
      difficultyLevel: nextDifficultyLevel,
    },
    monster: {
      ...nextMonster,
      cooldownMs: state.monster.cooldownMs,
      cooldownLeftMs: state.monster.cooldownMs,
    },
    combat: {
      ...state.combat,
      lastEvent: `오프라인 보상: ${killsGained}마리 처치, ${goldGained}G 획득`,
    },
  };
};
