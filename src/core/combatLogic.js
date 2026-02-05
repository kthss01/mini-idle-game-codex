const MAX_PLAYER_HP = 100;
const MAX_MONSTER_HP = 80;
const TICK_INTERVAL_MS = 1000;

export function createCombatState() {
  return {
    playerHp: MAX_PLAYER_HP,
    monsterHp: MAX_MONSTER_HP,
    gold: 0,
    elapsedMs: 0,
  };
}

export function tickCombat(state, deltaMs) {
  const nextState = { ...state };
  nextState.elapsedMs += deltaMs;

  if (nextState.elapsedMs < TICK_INTERVAL_MS) {
    return nextState;
  }

  const ticks = Math.floor(nextState.elapsedMs / TICK_INTERVAL_MS);
  nextState.elapsedMs -= ticks * TICK_INTERVAL_MS;

  for (let i = 0; i < ticks; i += 1) {
    if (nextState.playerHp > 0 && nextState.monsterHp > 0) {
      nextState.playerHp = Math.max(0, nextState.playerHp - 2);
      nextState.monsterHp = Math.max(0, nextState.monsterHp - 3);
    }

    if (nextState.monsterHp === 0) {
      nextState.gold += 5;
      nextState.monsterHp = MAX_MONSTER_HP;
    }

    if (nextState.playerHp === 0) {
      nextState.playerHp = MAX_PLAYER_HP;
    }
  }

  return nextState;
}
