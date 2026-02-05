export const createCombatState = () => ({
  playerHp: 100,
  playerMaxHp: 100,
  monsterHp: 80,
  monsterMaxHp: 80,
  gold: 0,
  kills: 0,
  attackTimerMs: 0,
});

export const tickCombat = (state, deltaMs) => {
  if (!state || state.playerHp <= 0) {
    return state;
  }

  const playerDamage = 12;
  const monsterDamage = 6;
  const attackIntervalMs = 1000;

  state.attackTimerMs += deltaMs;

  while (state.attackTimerMs >= attackIntervalMs && state.playerHp > 0) {
    state.attackTimerMs -= attackIntervalMs;

    state.monsterHp = Math.max(0, state.monsterHp - playerDamage);

    if (state.monsterHp === 0) {
      state.kills += 1;
      state.gold += 5;
      state.monsterMaxHp = 80 + state.kills * 6;
      state.monsterHp = state.monsterMaxHp;
      continue;
    }

    state.playerHp = Math.max(0, state.playerHp - monsterDamage);
  }

  return state;
};
