export const UpgradeType = {
  ATK: 'atk',
  HP: 'hp',
};

export const progressionConfig = {
  [UpgradeType.ATK]: {
    baseCost: 10,
    costMultiplier: 1.18,
    statMultiplier: 1.08,
  },
  [UpgradeType.HP]: {
    baseCost: 12,
    costMultiplier: 1.16,
    statMultiplier: 1.1,
  },
};

const getLevelKey = (type) => `${type}Level`;

const getCostConfig = (type) => progressionConfig[type] ?? progressionConfig[UpgradeType.ATK];

const readUpgradeLevel = (state, type) => {
  const levelKey = getLevelKey(type);
  return Math.max(0, Math.floor(state?.progression?.upgrades?.[levelKey] ?? 0));
};

const writeUpgradeLevel = (state, type, level) => {
  const levelKey = getLevelKey(type);
  return {
    ...state,
    progression: {
      ...state.progression,
      upgrades: {
        ...state.progression.upgrades,
        [levelKey]: level,
      },
    },
  };
};

export const getUpgradeCost = (type, level) => {
  const safeLevel = Math.max(0, Math.floor(level));
  const { baseCost, costMultiplier } = getCostConfig(type);
  return Math.max(1, Math.floor(baseCost * costMultiplier ** safeLevel));
};

export const canAfford = (gold, cost) => Math.floor(gold) >= Math.floor(cost);

export const calcDps = (playerStats) => {
  const atk = Math.max(0, playerStats?.atk ?? 0);
  const cooldownSeconds = (playerStats?.cooldownMs ?? 1000) / 1000;
  if (cooldownSeconds <= 0) {
    return 0;
  }
  return Number((atk / cooldownSeconds).toFixed(2));
};

export const calcSurvivability = (playerStats, monsterStats) => {
  const hp = Math.max(0, playerStats?.maxHp ?? playerStats?.hp ?? 0);
  const monsterAtk = Math.max(0, monsterStats?.atk ?? 0);
  const monsterCooldownSeconds = (monsterStats?.cooldownMs ?? 1000) / 1000;
  if (monsterAtk <= 0 || monsterCooldownSeconds <= 0) {
    return Infinity;
  }
  const monsterDps = monsterAtk / monsterCooldownSeconds;
  return Number((hp / monsterDps).toFixed(2));
};

export const applyUpgrade = (state, type) => {
  const currentLevel = readUpgradeLevel(state, type);
  const cost = getUpgradeCost(type, currentLevel);

  if (!canAfford(state.gold, cost)) {
    return {
      state,
      success: false,
      cost,
    };
  }

  const config = getCostConfig(type);
  const nextLevel = currentLevel + 1;

  let nextState = {
    ...state,
    gold: state.gold - cost,
  };

  if (type === UpgradeType.ATK) {
    nextState = {
      ...nextState,
      player: {
        ...nextState.player,
        atk: Math.max(1, Math.floor(nextState.player.atk * config.statMultiplier)),
      },
    };
  }

  if (type === UpgradeType.HP) {
    const nextMaxHp = Math.max(1, Math.floor(nextState.player.maxHp * config.statMultiplier));
    const bonusHp = nextMaxHp - nextState.player.maxHp;
    nextState = {
      ...nextState,
      player: {
        ...nextState.player,
        maxHp: nextMaxHp,
        hp: Math.min(nextMaxHp, nextState.player.hp + bonusHp),
      },
    };
  }

  nextState = writeUpgradeLevel(nextState, type, nextLevel);

  return {
    state: nextState,
    success: true,
    cost,
  };
};
