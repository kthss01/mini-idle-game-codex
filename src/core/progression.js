export const UpgradeType = {
  ATTACK: 'attack',
  HEALTH: 'health',
};

export const progressionRules = {
  attack: {
    baseCost: 10,
    costMultiplier: 1.18,
    statMultiplier: 1.08,
  },
  health: {
    baseCost: 12,
    costMultiplier: 1.16,
    statMultiplier: 1.1,
  },
};

const levelKeyByType = {
  [UpgradeType.ATTACK]: 'atkLevel',
  [UpgradeType.HEALTH]: 'hpLevel',
};

const clampLevel = (level) => Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);

const getRuleByType = (type) => {
  const rule = progressionRules[type];
  if (!rule) {
    throw new Error(`Unknown upgrade type: ${type}`);
  }
  return rule;
};

export const getUpgradeCost = (type, level) => {
  const safeLevel = clampLevel(level);
  const { baseCost, costMultiplier } = getRuleByType(type);
  return Math.floor(baseCost * costMultiplier ** safeLevel);
};

export const canAfford = (gold, cost) => Number.isFinite(gold) && Number.isFinite(cost) && gold >= cost;

export const calcDps = (playerStats) => {
  const attackValue = Math.max(0, Number(playerStats?.atk ?? 0));
  const cooldownMs = Number(playerStats?.cooldownMs ?? 0);
  if (cooldownMs <= 0) {
    return attackValue;
  }
  return attackValue / (cooldownMs / 1000);
};

export const calcSurvivability = (playerStats, monsterStats) => {
  const hp = Math.max(0, Number(playerStats?.hp ?? 0));
  const monsterAtk = Math.max(0, Number(monsterStats?.atk ?? 0));
  const monsterCooldownMs = Number(monsterStats?.cooldownMs ?? 0);
  if (monsterAtk <= 0 || monsterCooldownMs <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const incomingDps = monsterAtk / (monsterCooldownMs / 1000);
  if (incomingDps <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return hp / incomingDps;
};

export const applyUpgrade = (state, type) => {
  const levelKey = levelKeyByType[type];
  if (!levelKey) {
    throw new Error(`Unknown upgrade type: ${type}`);
  }

  const currentLevel = clampLevel(state?.progression?.[levelKey]);
  const cost = getUpgradeCost(type, currentLevel);
  if (!canAfford(state?.gold ?? 0, cost)) {
    return {
      state,
      purchased: false,
      reason: 'insufficient_gold',
      cost,
      nextCost: getUpgradeCost(type, currentLevel),
    };
  }

  const nextLevel = currentLevel + 1;
  const rule = getRuleByType(type);

  if (type === UpgradeType.ATTACK) {
    const nextAtk = Math.max(1, Math.round((state.player?.atk ?? 0) * rule.statMultiplier));
    const upgradedState = {
      ...state,
      gold: state.gold - cost,
      player: {
        ...state.player,
        atk: nextAtk,
      },
      progression: {
        ...state.progression,
        [levelKey]: nextLevel,
      },
    };

    return {
      state: upgradedState,
      purchased: true,
      type,
      cost,
      level: nextLevel,
      nextCost: getUpgradeCost(type, nextLevel),
    };
  }

  const currentMaxHp = Math.max(1, Number(state.player?.maxHp ?? 1));
  const nextMaxHp = Math.max(currentMaxHp + 1, Math.round(currentMaxHp * rule.statMultiplier));
  const hpIncrease = nextMaxHp - currentMaxHp;
  const nextHp = Math.min(nextMaxHp, Math.max(0, Number(state.player?.hp ?? 0)) + hpIncrease);

  const upgradedState = {
    ...state,
    gold: state.gold - cost,
    player: {
      ...state.player,
      maxHp: nextMaxHp,
      hp: nextHp,
    },
    progression: {
      ...state.progression,
      [levelKey]: nextLevel,
    },
  };

  return {
    state: upgradedState,
    purchased: true,
    type,
    cost,
    level: nextLevel,
    nextCost: getUpgradeCost(type, nextLevel),
  };
};
