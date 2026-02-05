export const UPGRADE_TYPE = {
  ATTACK: 'attack',
  HEALTH: 'health',
};

export const progressionConfig = {
  attack: {
    baseCost: 10,
    costMultiplier: 1.18,
    growthRate: 0.08,
  },
  health: {
    baseCost: 12,
    costMultiplier: 1.16,
    growthRate: 0.1,
  },
};

const normalizeLevel = (level) => Math.max(0, Math.floor(level ?? 0));

const getConfigByType = (type) => {
  if (type === UPGRADE_TYPE.ATTACK) {
    return progressionConfig.attack;
  }

  if (type === UPGRADE_TYPE.HEALTH) {
    return progressionConfig.health;
  }

  throw new Error(`지원하지 않는 업그레이드 타입: ${type}`);
};

export const getUpgradeCost = (type, level) => {
  const config = getConfigByType(type);
  const normalizedLevel = normalizeLevel(level);
  return Math.floor(config.baseCost * config.costMultiplier ** normalizedLevel);
};

export const canAfford = (gold, cost) => Math.max(0, Math.floor(gold ?? 0)) >= Math.max(0, Math.floor(cost ?? 0));

export const calcDps = (playerStats) => {
  const attack = Math.max(0, playerStats?.atk ?? 0);
  const cooldownMs = Math.max(1, playerStats?.cooldownMs ?? 1000);
  return attack / (cooldownMs / 1000);
};

export const calcSurvivability = (playerStats, monsterStats) => {
  const hp = Math.max(0, playerStats?.hp ?? 0);
  const incomingAttack = Math.max(0, monsterStats?.atk ?? 0);
  const monsterCooldownMs = Math.max(1, monsterStats?.cooldownMs ?? 1000);
  const incomingDps = incomingAttack / (monsterCooldownMs / 1000);

  if (incomingDps <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return hp / incomingDps;
};

export const applyUpgrade = (state, type) => {
  if (!state) {
    return state;
  }

  if (type === UPGRADE_TYPE.ATTACK) {
    const cost = getUpgradeCost(type, state.atkLevel);
    if (!canAfford(state.gold, cost)) {
      return state;
    }

    const nextAtk = Math.floor(state.atk * (1 + progressionConfig.attack.growthRate));
    return {
      ...state,
      gold: state.gold - cost,
      atkLevel: state.atkLevel + 1,
      atk: Math.max(state.atk + 1, nextAtk),
    };
  }

  if (type === UPGRADE_TYPE.HEALTH) {
    const cost = getUpgradeCost(type, state.hpLevel);
    if (!canAfford(state.gold, cost)) {
      return state;
    }

    const nextHp = Math.floor(state.hp * (1 + progressionConfig.health.growthRate));
    return {
      ...state,
      gold: state.gold - cost,
      hpLevel: state.hpLevel + 1,
      hp: Math.max(state.hp + 1, nextHp),
    };
  }

  throw new Error(`지원하지 않는 업그레이드 타입: ${type}`);
};
