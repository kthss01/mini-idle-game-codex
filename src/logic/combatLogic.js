const ROUND_DURATION_MS = 1000;

const createMonster = (level) => {
  const maxHp = 60 + level * 20;
  const attack = 6 + level * 3;
  const rewardGold = 12 + level * 4;

  return {
    level,
    maxHp,
    hp: maxHp,
    attack,
    rewardGold,
  };
};

export const createCombatState = () => {
  return {
    player: {
      maxHp: 120,
      hp: 120,
      attack: 18,
      defense: 4,
    },
    monster: createMonster(1),
    gold: 0,
    kills: 0,
    elapsedMs: 0,
  };
};

const resolvePlayerAttack = (state) => {
  const damage = Math.max(1, state.player.attack - Math.floor(state.monster.level / 2));
  return {
    ...state,
    monster: {
      ...state.monster,
      hp: Math.max(0, state.monster.hp - damage),
    },
  };
};

const resolveMonsterAttack = (state) => {
  const mitigated = Math.max(0, state.monster.attack - state.player.defense);
  const damage = Math.max(1, mitigated);
  return {
    ...state,
    player: {
      ...state.player,
      hp: Math.max(0, state.player.hp - damage),
    },
  };
};

const handleMonsterDefeat = (state) => {
  const nextKills = state.kills + 1;
  const nextGold = state.gold + state.monster.rewardGold;
  const nextMonster = createMonster(nextKills + 1);

  return {
    ...state,
    gold: nextGold,
    kills: nextKills,
    monster: nextMonster,
  };
};

const handlePlayerDefeat = (state) => {
  return {
    ...state,
    player: {
      ...state.player,
      hp: state.player.maxHp,
    },
    gold: Math.max(0, state.gold - 10),
  };
};

export const tickCombat = (state, deltaMs) => {
  let nextState = {
    ...state,
    elapsedMs: state.elapsedMs + deltaMs,
  };
  let monsterReplaced = false;

  while (nextState.elapsedMs >= ROUND_DURATION_MS) {
    nextState = {
      ...nextState,
      elapsedMs: nextState.elapsedMs - ROUND_DURATION_MS,
    };

    nextState = resolvePlayerAttack(nextState);

    if (nextState.monster.hp <= 0) {
      nextState = handleMonsterDefeat(nextState);
      monsterReplaced = true;
      continue;
    }

    nextState = resolveMonsterAttack(nextState);

    if (nextState.player.hp <= 0) {
      nextState = handlePlayerDefeat(nextState);
    }
  }

  return {
    state: nextState,
    monsterReplaced,
  };
};
