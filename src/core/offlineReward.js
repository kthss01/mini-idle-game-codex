import { combatRules } from '../design/balance.js';
import { spawnMonster } from './spawnMonster.js';
import { getOfflineKillRateMultiplier } from '../design/offlineBalance.js';

const toSafeSeconds = (value) => Math.max(0, Number.isFinite(value) ? value : 0);

const calcKillRatePerSecond = (state) => {
  const playerAtk = Math.max(1, Math.floor(state.player?.atk ?? 1));
  const monsterHp = Math.max(1, Math.floor(state.monster?.maxHp ?? 1));
  const cooldownMs = Math.max(1, Math.floor(state.player?.cooldownMs ?? 1000));

  const hitsPerSecond = 1000 / cooldownMs;
  const damagePerSecond = playerAtk * hitsPerSecond;
  const killsPerSecond = damagePerSecond / monsterHp;

  return Math.max(0.02, killsPerSecond);
};

export const calculateOfflineReward = (state, offlineSec, balanceConfig) => {
  const safeConfig = balanceConfig ?? {};
  const capSec = Math.max(0, Math.floor(safeConfig.offlineCapSec ?? 0));
  const efficiency = Math.max(0, Math.min(1, Number(safeConfig.offlineEfficiency ?? 0)));

  const normalizedOfflineSec = toSafeSeconds(offlineSec);
  const offlineSecApplied = Math.min(normalizedOfflineSec, capSec);

  if (offlineSecApplied <= 0 || efficiency <= 0) {
    return {
      killsGained: 0,
      goldGained: 0,
      offlineSecApplied: 0,
    };
  }

  const progressionMultiplier = getOfflineKillRateMultiplier(state.progression?.difficultyLevel);
  const expectedKillRate = calcKillRatePerSecond(state) * efficiency * progressionMultiplier;
  const killsGained = Math.max(0, Math.floor(expectedKillRate * offlineSecApplied));

  const goldPerKill = Math.max(0, Math.floor(state.monster?.goldReward ?? 0));

  return {
    killsGained,
    goldGained: killsGained * goldPerKill,
    offlineSecApplied: Math.floor(offlineSecApplied),
  };
};

export const applyOfflineReward = (state, reward) => {
  if (!state || !reward) {
    return state;
  }

  const gainedKills = Math.max(0, Math.floor(reward.killsGained ?? 0));
  const gainedGold = Math.max(0, Math.floor(reward.goldGained ?? 0));

  if (gainedKills <= 0 && gainedGold <= 0) {
    return state;
  }

  const nextKillCount = (state.progression?.killCount ?? 0) + gainedKills;
  const nextDifficultyLevel = 1 + Math.floor(nextKillCount / 3);
  const nextMonster = spawnMonster(nextDifficultyLevel);

  return {
    ...state,
    gold: (state.gold ?? 0) + gainedGold,
    monster: {
      ...nextMonster,
      cooldownMs: state.monster?.cooldownMs ?? combatRules.monsterAttackCooldownMs,
      cooldownLeftMs: state.monster?.cooldownMs ?? combatRules.monsterAttackCooldownMs,
    },
    progression: {
      ...state.progression,
      killCount: nextKillCount,
      difficultyLevel: nextDifficultyLevel,
    },
    combat: {
      ...state.combat,
      lastEvent: `오프라인 보상: ${gainedKills}마리 처치, ${gainedGold}G 획득`,
    },
  };
};
