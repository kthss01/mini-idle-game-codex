import { getEquipmentBonuses } from './equipment.js';

const UPGRADE_TYPES = {
  ATTACK: 'attack',
  HEALTH: 'health',
};

export const ProgressionUpgradeType = Object.freeze(UPGRADE_TYPES);

export const progressionBalance = Object.freeze({
  [UPGRADE_TYPES.ATTACK]: {
    label: '공격력 강화',
    baseCost: 10,
    costMultiplier: 1.18,
    statMultiplier: 1.08,
  },
  [UPGRADE_TYPES.HEALTH]: {
    label: '체력 강화',
    baseCost: 12,
    costMultiplier: 1.16,
    statMultiplier: 1.1,
  },
});

const clampLevel = (level) => Math.max(0, Math.floor(level));

const getUpgradeConfig = (type) => progressionBalance[type] ?? null;

const getSecondsPerAttack = (playerStats) => {
  if (playerStats?.cooldownMs && playerStats.cooldownMs > 0) {
    return playerStats.cooldownMs / 1000;
  }

  if (playerStats?.atkSpeed && playerStats.atkSpeed > 0) {
    return playerStats.atkSpeed;
  }

  return 1;
};

const getMonsterAttackSeconds = (monsterStats) => {
  if (monsterStats?.cooldownMs && monsterStats.cooldownMs > 0) {
    return monsterStats.cooldownMs / 1000;
  }

  if (monsterStats?.atkSpeed && monsterStats.atkSpeed > 0) {
    return monsterStats.atkSpeed;
  }

  return 1;
};

export const getUpgradeCost = (type, level) => {
  const config = getUpgradeConfig(type);
  if (!config) {
    return Infinity;
  }

  const normalizedLevel = clampLevel(level);
  return Math.max(1, Math.floor(config.baseCost * config.costMultiplier ** normalizedLevel));
};

export const canAfford = (gold, cost) => Math.max(0, gold) >= Math.max(0, cost);

export const calcDps = (playerStats) => {
  const atk = Math.max(0, playerStats?.atk ?? 0);
  const secondsPerAttack = getSecondsPerAttack(playerStats);

  if (secondsPerAttack <= 0) {
    return 0;
  }

  return Number((atk / secondsPerAttack).toFixed(2));
};

export const calcSurvivability = (playerStats, monsterStats) => {
  const hp = Math.max(0, playerStats?.hp ?? playerStats?.maxHp ?? 0);
  const monsterAtk = Math.max(0, monsterStats?.atk ?? 0);
  const secondsPerHit = getMonsterAttackSeconds(monsterStats);

  if (monsterAtk <= 0) {
    return Infinity;
  }

  const monsterDps = monsterAtk / Math.max(0.01, secondsPerHit);
  return Number((hp / monsterDps).toFixed(2));
};

const getUpgradeLevels = (state) => {
  const upgrades = state.progression?.upgrades ?? {};
  return {
    attackLevel: clampLevel(upgrades.attackLevel),
    healthLevel: clampLevel(upgrades.healthLevel),
  };
};

export const applyUpgrade = (state, type) => {
  const config = getUpgradeConfig(type);
  if (!state || !config) {
    return state;
  }

  const { attackLevel, healthLevel } = getUpgradeLevels(state);
  const currentLevel = type === UPGRADE_TYPES.ATTACK ? attackLevel : healthLevel;
  const cost = getUpgradeCost(type, currentLevel);

  if (!canAfford(state.gold, cost)) {
    return state;
  }

  const nextProgression = {
    ...state.progression,
    upgrades: {
      attackLevel,
      healthLevel,
    },
  };

  if (type === UPGRADE_TYPES.ATTACK) {
    nextProgression.upgrades.attackLevel += 1;
  }

  if (type === UPGRADE_TYPES.HEALTH) {
    nextProgression.upgrades.healthLevel += 1;
  }

  return applyPlayerStatSnapshot({
    ...state,
    gold: state.gold - cost,
    progression: nextProgression,
  });
};

const getGrowthMultiplier = (type, level) => {
  const config = getUpgradeConfig(type);
  return config ? config.statMultiplier ** clampLevel(level) : 1;
};

export const calculatePlayerStats = (state) => {
  const baseStats = state?.player?.baseStats ?? {
    atk: state?.player?.atk ?? 0,
    maxHp: state?.player?.maxHp ?? 0,
    cooldownMs: state?.player?.cooldownMs ?? 1000,
  };
  const upgrades = state?.progression?.upgrades ?? {};

  const growthAtk = Math.max(1, Math.floor(baseStats.atk * getGrowthMultiplier(UPGRADE_TYPES.ATTACK, upgrades.attackLevel ?? 0)));
  const growthHp = Math.max(1, Math.floor(baseStats.maxHp * getGrowthMultiplier(UPGRADE_TYPES.HEALTH, upgrades.healthLevel ?? 0)));
  const equipBonus = getEquipmentBonuses(state?.player?.equipmentSlots);

  return {
    atk: growthAtk + equipBonus.atk,
    maxHp: growthHp + equipBonus.maxHp,
    cooldownMs: Math.max(1, Math.floor(baseStats.cooldownMs ?? 1000)),
    baseStats,
    equipBonus,
  };
};

export const applyPlayerStatSnapshot = (state) => {
  if (!state?.player) {
    return state;
  }

  const calculated = calculatePlayerStats(state);
  const previousMaxHp = Math.max(1, state.player.maxHp ?? calculated.maxHp);
  const hpRatio = Math.min(1, Math.max(0, (state.player.hp ?? previousMaxHp) / previousMaxHp));

  return {
    ...state,
    player: {
      ...state.player,
      atk: calculated.atk,
      maxHp: calculated.maxHp,
      hp: Math.max(1, Math.floor(calculated.maxHp * hpRatio)),
      cooldownMs: calculated.cooldownMs,
      baseStats: calculated.baseStats,
      equipmentBonus: calculated.equipBonus,
    },
  };
};
