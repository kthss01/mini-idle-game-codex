import { nextMonsterLevel } from './combatLogic.js';
import { spawnMonster } from './spawnMonster.js';
import { offlineRewardBalance } from '../design/offlineBalance.js';
import { combatRules } from '../design/balance.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getStageMultiplier = (difficultyLevel, stageBrackets) => {
  const currentStage = Math.max(1, Math.floor(difficultyLevel || 1));
  return (
    stageBrackets.find((bracket) => currentStage <= bracket.maxDifficulty)?.killRateMultiplier ?? 1
  );
};

const getPlayerDps = (state) => {
  const atk = Math.max(0, state?.player?.atk ?? 0);
  const cooldownMs = Math.max(1, state?.player?.cooldownMs ?? 1000);
  return atk / (cooldownMs / 1000);
};

const getCurrentMonsterHp = (state) => {
  if (state?.monster?.maxHp) {
    return Math.max(1, state.monster.maxHp);
  }

  const stage = Math.max(1, Math.floor(state?.progression?.difficultyLevel ?? 1));
  return Math.max(1, spawnMonster(stage).maxHp);
};

export const calculateOfflineReward = (state, offlineSec, balanceConfig = offlineRewardBalance) => {
  const safeOfflineSec = Math.max(0, Number(offlineSec) || 0);
  const capSec = Math.max(0, balanceConfig.offlineCapSec ?? offlineRewardBalance.offlineCapSec);
  const offlineSecApplied = Math.floor(clamp(safeOfflineSec, 0, capSec));

  if (offlineSecApplied < (balanceConfig.minimumOfflineSec ?? 0)) {
    return {
      killsGained: 0,
      goldGained: 0,
      offlineSecApplied,
    };
  }

  const playerDps = getPlayerDps(state);
  const monsterHp = getCurrentMonsterHp(state);
  const baseKillsPerSec = playerDps / monsterHp;
  const stageMultiplier = getStageMultiplier(
    state?.progression?.difficultyLevel,
    balanceConfig.stageBrackets ?? offlineRewardBalance.stageBrackets
  );

  const effectiveKillsPerSec =
    baseKillsPerSec *
    (balanceConfig.offlineEfficiency ?? offlineRewardBalance.offlineEfficiency) *
    stageMultiplier;

  const killsGained = Math.max(0, Math.floor(offlineSecApplied * effectiveKillsPerSec));
  const baseGoldPerKill = Math.max(0, state?.monster?.goldReward ?? spawnMonster(1).goldReward);
  const goldMultiplier = balanceConfig.goldEfficiency ?? offlineRewardBalance.goldEfficiency;
  const goldGained = Math.max(0, Math.floor(killsGained * baseGoldPerKill * goldMultiplier));

  return {
    killsGained,
    goldGained,
    offlineSecApplied,
  };
};

export const applyOfflineReward = (state, reward) => {
  const killsToAdd = Math.max(0, Math.floor(reward?.killsGained ?? 0));
  const goldToAdd = Math.max(0, Math.floor(reward?.goldGained ?? 0));

  if (killsToAdd === 0 && goldToAdd === 0) {
    return state;
  }

  const currentKills = Math.max(0, Math.floor(state?.progression?.killCount ?? 0));
  const nextKillCount = currentKills + killsToAdd;
  const nextDifficulty = nextMonsterLevel(nextKillCount);
  const nextMonster = spawnMonster(nextDifficulty);

  return {
    ...state,
    gold: Math.max(0, Math.floor((state?.gold ?? 0) + goldToAdd)),
    player: {
      ...state.player,
      hp: state.player.maxHp,
      cooldownLeftMs: state.player.cooldownMs,
    },
    monster: {
      ...nextMonster,
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
