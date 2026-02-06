import { nextMonsterLevel } from './combatLogic.js';
import { offlineRewardBalance } from '../design/offlineBalance.js';
import { combatRules } from '../design/balance.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getStageMultiplier = (difficultyLevel, stageBrackets) => {
  const currentStage = Math.max(1, Math.floor(difficultyLevel || 1));
  return stageBrackets.find((bracket) => currentStage <= bracket.maxDifficulty)?.killRateMultiplier ?? 1;
};

const getPlayerDps = (state) => {
  const atk = Math.max(0, state?.player?.atk ?? 0);
  const cooldownMs = Math.max(1, state?.player?.cooldownMs ?? 1000);
  return atk / (cooldownMs / 1000);
};

const getCurrentMonsterHp = (state) => Math.max(1, state?.monster?.maxHp ?? 100);

export const calculateOfflineReward = (state, offlineSec, balanceConfig = offlineRewardBalance) => {
  const safeOfflineSec = Math.max(0, Number(offlineSec) || 0);
  const capSec = Math.max(0, balanceConfig.offlineCapSec ?? offlineRewardBalance.offlineCapSec);
  const offlineSecApplied = Math.floor(clamp(safeOfflineSec, 0, capSec));

  if (offlineSecApplied < (balanceConfig.minimumOfflineSec ?? 0)) {
    return { killsGained: 0, goldGained: 0, offlineSecApplied };
  }

  const baseKillsPerSec = getPlayerDps(state) / getCurrentMonsterHp(state);
  const stageMultiplier = getStageMultiplier(state?.progression?.difficultyLevel, balanceConfig.stageBrackets ?? offlineRewardBalance.stageBrackets);
  const effectiveKillsPerSec = baseKillsPerSec * (balanceConfig.offlineEfficiency ?? offlineRewardBalance.offlineEfficiency) * stageMultiplier;

  const killsGained = Math.max(0, Math.floor(offlineSecApplied * effectiveKillsPerSec));
  const baseGoldPerKill = Math.max(0, state?.monster?.goldReward ?? 1);
  const goldGained = Math.max(0, Math.floor(killsGained * baseGoldPerKill * (balanceConfig.goldEfficiency ?? offlineRewardBalance.goldEfficiency)));

  return { killsGained, goldGained, offlineSecApplied };
};

export const applyOfflineReward = (state, reward) => {
  const killsToAdd = Math.max(0, Math.floor(reward?.killsGained ?? 0));
  const goldToAdd = Math.max(0, Math.floor(reward?.goldGained ?? 0));
  if (killsToAdd === 0 && goldToAdd === 0) {
    return state;
  }

  const nextKillCount = Math.max(0, Math.floor(state?.progression?.killCount ?? 0)) + killsToAdd;
  const nextDifficulty = nextMonsterLevel(nextKillCount);

  return {
    ...state,
    gold: Math.max(0, Math.floor((state?.gold ?? 0) + goldToAdd)),
    player: {
      ...state.player,
      hp: state.player.maxHp,
      cooldownLeftMs: state.player.cooldownMs,
    },
    monster: {
      ...state.monster,
      cooldownMs: combatRules.monsterAttackCooldownMs,
      cooldownLeftMs: combatRules.monsterAttackCooldownMs,
    },
    progression: {
      ...state.progression,
      killCount: nextKillCount,
      difficultyLevel: nextDifficulty,
    },
    combat: {
      ...state.combat,
      lastEvent: `오프라인 보상: 처치 ${killsToAdd} · 골드 +${goldToAdd}`,
    },
  };
};
