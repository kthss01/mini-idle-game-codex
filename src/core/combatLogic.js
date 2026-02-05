import { combatRules, growthRules, playerBaseStats } from '../design/balance.js';
import { spawnMonster } from './spawnMonster.js';

export const applyDamage = (targetHp, damage) => Math.max(0, targetHp - Math.max(0, Math.floor(damage)));

export const isDead = (hp) => hp <= 0;

export const rewardGold = (gold, monsterGoldReward) => gold + Math.max(0, Math.floor(monsterGoldReward));

export const nextMonsterLevel = (killCount) =>
  1 + Math.floor(Math.max(0, killCount) / growthRules.difficultyStepPerKills);

export const createCombatState = () => {
  const initialMonster = spawnMonster(1);

  return {
    player: {
      hp: playerBaseStats.hp,
      maxHp: playerBaseStats.hp,
      atk: playerBaseStats.atk,
      cooldownMs: playerBaseStats.attackCooldownMs,
      cooldownLeftMs: playerBaseStats.attackCooldownMs,
    },
    monster: {
      ...initialMonster,
      cooldownMs: combatRules.monsterAttackCooldownMs,
      cooldownLeftMs: combatRules.monsterAttackCooldownMs,
    },
    gold: 0,
    progression: {
      killCount: 0,
      difficultyLevel: 1,
    },
    combat: {
      tick: 0,
      elapsedMs: 0,
      pendingMs: 0,
      lastEvent: '전투 시작',
    },
  };
};

const spawnNextMonster = (state) => {
  const monster = spawnMonster(state.progression.difficultyLevel);
  return {
    ...state,
    monster: {
      ...monster,
      cooldownMs: combatRules.monsterAttackCooldownMs,
      cooldownLeftMs: combatRules.monsterAttackCooldownMs,
    },
    combat: {
      ...state.combat,
      lastEvent: `${monster.name} 출현 (Lv.${monster.level})`,
    },
  };
};

const resolveKill = (state) => {
  const updatedKillCount = state.progression.killCount + 1;
  const updatedDifficulty = nextMonsterLevel(updatedKillCount);

  return spawnNextMonster({
    ...state,
    gold: rewardGold(state.gold, state.monster.goldReward),
    progression: {
      killCount: updatedKillCount,
      difficultyLevel: updatedDifficulty,
    },
    player: {
      ...state.player,
      hp: Math.min(state.player.maxHp, state.player.hp + 8),
    },
    combat: {
      ...state.combat,
      lastEvent: `${state.monster.name} 처치 +${state.monster.goldReward}G`,
    },
  });
};

const resolvePlayerDefeat = (state) => ({
  ...state,
  player: {
    ...state.player,
    hp: state.player.maxHp,
    cooldownLeftMs: state.player.cooldownMs,
  },
  combat: {
    ...state.combat,
    lastEvent: '플레이어가 쓰러져 재정비합니다.',
  },
});

const executeCombatTick = (state) => {
  let nextState = {
    ...state,
    combat: {
      ...state.combat,
      tick: state.combat.tick + 1,
    },
    player: {
      ...state.player,
      cooldownLeftMs: Math.max(0, state.player.cooldownLeftMs - combatRules.logicTickMs),
    },
    monster: {
      ...state.monster,
      cooldownLeftMs: Math.max(0, state.monster.cooldownLeftMs - combatRules.logicTickMs),
    },
  };

  if (nextState.player.cooldownLeftMs <= 0) {
    nextState = {
      ...nextState,
      monster: {
        ...nextState.monster,
        hp: applyDamage(nextState.monster.hp, nextState.player.atk),
      },
      player: {
        ...nextState.player,
        cooldownLeftMs: nextState.player.cooldownMs,
      },
      combat: {
        ...nextState.combat,
        lastEvent: `기사의 공격! ${nextState.player.atk} 피해`,
      },
    };
  }

  if (isDead(nextState.monster.hp)) {
    return resolveKill(nextState);
  }

  if (nextState.monster.cooldownLeftMs <= 0) {
    nextState = {
      ...nextState,
      player: {
        ...nextState.player,
        hp: applyDamage(nextState.player.hp, nextState.monster.atk),
      },
      monster: {
        ...nextState.monster,
        cooldownLeftMs: nextState.monster.cooldownMs,
      },
      combat: {
        ...nextState.combat,
        lastEvent: `${nextState.monster.name}의 공격! ${nextState.monster.atk} 피해`,
      },
    };
  }

  if (isDead(nextState.player.hp)) {
    return resolvePlayerDefeat(nextState);
  }

  return nextState;
};

export const tickCombat = (state, deltaMs) => {
  if (!state || deltaMs <= 0) {
    return state;
  }

  let nextState = {
    ...state,
    combat: {
      ...state.combat,
      elapsedMs: state.combat.elapsedMs + deltaMs,
      pendingMs: state.combat.pendingMs + deltaMs,
    },
  };

  while (nextState.combat.pendingMs >= combatRules.logicTickMs) {
    nextState = executeCombatTick({
      ...nextState,
      combat: {
        ...nextState.combat,
        pendingMs: nextState.combat.pendingMs - combatRules.logicTickMs,
      },
    });
  }

  return nextState;
};
