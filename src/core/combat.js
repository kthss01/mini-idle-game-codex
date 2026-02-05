const BASE_MONSTER = {
  hp: 20,
  atk: 4,
};

const DEFAULT_TICK_MS = 1000;

const DEFAULTS = {
  player: {
    hp: 100,
    maxHp: 100,
    atk: 12,
  },
  monster: {
    level: 1,
    hp: 0,
    maxHp: 0,
    atk: 0,
  },
  gold: 0,
  killCount: 0,
  combat: {
    elapsedMs: 0,
    tickMs: DEFAULT_TICK_MS,
  },
};

const clampNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const ensureState = (state) => {
  const nextState = state ?? {};
  nextState.player = { ...DEFAULTS.player, ...nextState.player };
  nextState.monster = { ...DEFAULTS.monster, ...nextState.monster };
  nextState.gold = clampNumber(nextState.gold, DEFAULTS.gold);
  nextState.killCount = clampNumber(nextState.killCount, DEFAULTS.killCount);
  nextState.combat = { ...DEFAULTS.combat, ...nextState.combat };
  return nextState;
};

export function createCombatState() {
  const state = ensureState({});

  spawnMonster(state);

  return state;
}

export function scaleDifficulty(state) {
  const nextState = ensureState(state);
  const kills = nextState.killCount ?? 0;
  const level = 1 + Math.floor(kills / 5);
  const hpScale = 1 + level * 0.2;
  const atkScale = 1 + level * 0.15;

  nextState.difficulty = {
    level,
    hpScale,
    atkScale,
  };

  return nextState.difficulty;
}

export function spawnMonster(state) {
  const nextState = ensureState(state);
  const difficulty = scaleDifficulty(nextState);
  const maxHp = Math.round(BASE_MONSTER.hp * difficulty.hpScale);
  const atk = Math.round(BASE_MONSTER.atk * difficulty.atkScale);

  nextState.monster = {
    level: difficulty.level,
    maxHp,
    hp: maxHp,
    atk,
  };

  return nextState.monster;
}

export function applyKillRewards(state) {
  const nextState = ensureState(state);
  const monsterLevel = nextState.monster?.level ?? 1;
  const reward = 5 + monsterLevel * 2;

  nextState.killCount = (nextState.killCount ?? 0) + 1;
  nextState.gold = (nextState.gold ?? 0) + reward;

  return reward;
}

export function tickCombat(state, deltaMs) {
  const nextState = ensureState(state);

  const tickMs = nextState.combat.tickMs ?? DEFAULT_TICK_MS;
  nextState.combat.elapsedMs += clampNumber(deltaMs, 0);

  while (nextState.combat.elapsedMs >= tickMs) {
    nextState.combat.elapsedMs -= tickMs;

    if (nextState.player.hp <= 0) {
      nextState.player.hp = 0;
      break;
    }

    const monsterAlive = nextState.monster.hp > 0;
    if (!monsterAlive) {
      applyKillRewards(nextState);
      spawnMonster(nextState);
      continue;
    }

    nextState.monster.hp -= nextState.player.atk;
    if (nextState.monster.hp <= 0) {
      nextState.monster.hp = 0;
      applyKillRewards(nextState);
      spawnMonster(nextState);
      continue;
    }

    nextState.player.hp -= nextState.monster.atk;
  }

  return nextState;
}
