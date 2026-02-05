const DEFAULTS = {
  hero: {
    hp: 100,
    maxHp: 100,
    atk: 10,
    atkSpeed: 1,
    attackTimer: 0,
  },
  monster: {
    hp: 0,
    atk: 0,
    attackTimer: 0,
  },
  gold: 0,
  stage: 0,
  time: 0,
};

const clampNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const ensureState = (state) => {
  const nextState = state ?? {};
  nextState.hero = { ...DEFAULTS.hero, ...nextState.hero };
  nextState.monster = { ...DEFAULTS.monster, ...nextState.monster };
  nextState.gold = clampNumber(nextState.gold, DEFAULTS.gold);
  nextState.stage = clampNumber(nextState.stage, DEFAULTS.stage);
  nextState.time = clampNumber(nextState.time, DEFAULTS.time);
  return nextState;
};

const computeMonsterStats = (stage) => {
  const baseHp = 40;
  const baseAtk = 4;
  const hp = Math.max(1, Math.floor(baseHp * Math.pow(1.15, stage - 1)));
  const atk = Math.max(1, Math.floor(baseAtk * Math.pow(1.1, stage - 1)));
  return { hp, atk };
};

export const spawnMonster = (state) => {
  const nextState = ensureState(state);
  nextState.stage += 1;

  const { hp, atk } = computeMonsterStats(nextState.stage);

  nextState.monster = {
    hp,
    maxHp: hp,
    atk,
    attackTimer: 0,
  };

  return nextState.monster;
};

export const applyRewards = (state) => {
  const nextState = ensureState(state);
  const baseGold = 5;
  const reward = Math.max(1, Math.floor(baseGold * Math.pow(1.12, nextState.stage - 1)));

  nextState.gold += reward;

  const growthFactor = 1 + Math.min(0.3, nextState.stage * 0.005);
  nextState.hero.atk = Math.max(1, Math.floor(nextState.hero.atk * growthFactor));
  nextState.hero.maxHp = Math.max(1, Math.floor(nextState.hero.maxHp * (1 + growthFactor * 0.3)));
  nextState.hero.hp = Math.min(nextState.hero.hp, nextState.hero.maxHp);

  return reward;
};

export const tickCombat = (state, deltaMs) => {
  const nextState = ensureState(state);
  const delta = clampNumber(deltaMs, 0);
  nextState.time += delta;

  if (!nextState.monster.hp || nextState.monster.hp <= 0) {
    spawnMonster(nextState);
  }

  const heroAttackInterval = 1000 / Math.max(0.1, nextState.hero.atkSpeed);
  const monsterAttackInterval = 1500;

  nextState.hero.attackTimer += delta;
  nextState.monster.attackTimer += delta;

  let safety = 0;
  while (
    nextState.hero.attackTimer >= heroAttackInterval &&
    nextState.monster.hp > 0 &&
    safety < 100
  ) {
    nextState.hero.attackTimer -= heroAttackInterval;
    nextState.monster.hp = Math.max(0, nextState.monster.hp - nextState.hero.atk);

    if (nextState.monster.hp <= 0) {
      applyRewards(nextState);
      spawnMonster(nextState);
    }

    safety += 1;
  }

  safety = 0;
  while (
    nextState.monster.attackTimer >= monsterAttackInterval &&
    nextState.monster.hp > 0 &&
    safety < 100
  ) {
    nextState.monster.attackTimer -= monsterAttackInterval;
    nextState.hero.hp = Math.max(0, nextState.hero.hp - nextState.monster.atk);

    if (nextState.hero.hp <= 0) {
      nextState.hero.hp = nextState.hero.maxHp;
      spawnMonster(nextState);
      nextState.monster.attackTimer = 0;
    }

    safety += 1;
  }

  return nextState;
};

export const createInitialState = (overrides = {}) => {
  const nextState = ensureState({ ...DEFAULTS, ...overrides });
  if (!nextState.monster.hp || nextState.monster.hp <= 0) {
    spawnMonster(nextState);
  }
  return nextState;
};
