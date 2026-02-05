const BASE_MONSTER = {
  hp: 20,
  atk: 4,
};

const DEFAULT_TICK_MS = 1000;

export function createCombatState() {
  const state = {
    player: {
      hp: 100,
      maxHp: 100,
      atk: 12,
    },
    gold: 0,
    killCount: 0,
    combat: {
      elapsedMs: 0,
      tickMs: DEFAULT_TICK_MS,
    },
  };

  spawnMonster(state);

  return state;
}

export function scaleDifficulty(state) {
  const kills = state.killCount ?? 0;
  const level = 1 + Math.floor(kills / 5);
  const hpScale = 1 + level * 0.2;
  const atkScale = 1 + level * 0.15;

  state.difficulty = {
    level,
    hpScale,
    atkScale,
  };

  return state.difficulty;
}

export function spawnMonster(state) {
  const difficulty = scaleDifficulty(state);
  const maxHp = Math.round(BASE_MONSTER.hp * difficulty.hpScale);
  const atk = Math.round(BASE_MONSTER.atk * difficulty.atkScale);

  state.monster = {
    level: difficulty.level,
    maxHp,
    hp: maxHp,
    atk,
  };

  return state.monster;
}

export function applyKillRewards(state) {
  const monsterLevel = state.monster?.level ?? 1;
  const reward = 5 + monsterLevel * 2;

  state.killCount = (state.killCount ?? 0) + 1;
  state.gold = (state.gold ?? 0) + reward;

  return reward;
}

export function tickCombat(state, deltaMs) {
  if (!state.player || !state.monster) {
    return state;
  }

  if (!state.combat) {
    state.combat = { elapsedMs: 0, tickMs: DEFAULT_TICK_MS };
  }

  const tickMs = state.combat.tickMs ?? DEFAULT_TICK_MS;
  state.combat.elapsedMs += deltaMs;

  while (state.combat.elapsedMs >= tickMs) {
    state.combat.elapsedMs -= tickMs;

    if (state.player.hp <= 0) {
      state.player.hp = 0;
      break;
    }

    const monsterAlive = state.monster.hp > 0;
    if (!monsterAlive) {
      applyKillRewards(state);
      spawnMonster(state);
      continue;
    }

    state.monster.hp -= state.player.atk;
    if (state.monster.hp <= 0) {
      state.monster.hp = 0;
      applyKillRewards(state);
      spawnMonster(state);
      continue;
    }

    state.player.hp -= state.monster.atk;
  }

  return state;
}
