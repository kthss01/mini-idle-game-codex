import { combatRules, growthRules, playerBaseStats } from '../design/balance.js';
import { spawnMonster } from './spawnMonster.js';

export const MAX_COMBAT_LOGS = 200;

export const CombatEventType = {
  AUTO_BATTLE_START: '전투시작',
  AUTO_BATTLE_STOP: '전투종료',
  DAMAGE: '데미지',
  MONSTER_DEFEATED: '처치',
  GOLD_GAINED: '골드획득',
  SKILL_TRIGGERED: '스킬발동',
  STAGE_CLEAR: '스테이지클리어',
};

export const applyDamage = (targetHp, damage) => Math.max(0, targetHp - Math.max(0, Math.floor(damage)));

export const isDead = (hp) => hp <= 0;

export const rewardGold = (gold, monsterGoldReward) => gold + Math.max(0, Math.floor(monsterGoldReward));

export const nextMonsterLevel = (killCount) =>
  1 + Math.floor(Math.max(0, killCount) / growthRules.difficultyStepPerKills);

const createCombatEvent = ({ elapsedMs, type, message, payload }) => ({
  timestamp: elapsedMs,
  type,
  message,
  ...(payload ? { payload } : {}),
});

const pushCombatEvents = (state, newEvents) => {
  if (!newEvents.length) {
    return state;
  }

  const events = [...state.combatLog.events, ...newEvents].slice(-MAX_COMBAT_LOGS);
  return {
    ...state,
    combatLog: {
      ...state.combatLog,
      events,
    },
  };
};

export const createCombatState = () => {
  const initialMonster = spawnMonster(1);

  const initialState = {
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
      upgrades: {
        attackLevel: 0,
        healthLevel: 0,
      },
    },
    combat: {
      tick: 0,
      elapsedMs: 0,
      pendingMs: 0,
      lastEvent: '자동전투 시작',
    },
    combatLog: {
      events: [],
    },
  };

  return pushCombatEvents(initialState, [
    createCombatEvent({
      elapsedMs: initialState.combat.elapsedMs,
      type: CombatEventType.AUTO_BATTLE_START,
      message: `자동전투 시작 · ${initialMonster.name} 출현 (Lv.${initialMonster.level})`,
      payload: {
        monster: initialMonster.name,
        level: initialMonster.level,
      },
    }),
  ]);
};

const spawnNextMonster = (state) => {
  const monster = spawnMonster(state.progression.difficultyLevel);
  const nextState = {
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

  return pushCombatEvents(nextState, [
    createCombatEvent({
      elapsedMs: nextState.combat.elapsedMs,
      type: CombatEventType.STAGE_CLEAR,
      message: `${monster.name} 출현 (Lv.${monster.level})`,
      payload: {
        level: monster.level,
      },
    }),
  ]);
};

const resolveKill = (state) => {
  const updatedKillCount = state.progression.killCount + 1;
  const updatedDifficulty = nextMonsterLevel(updatedKillCount);

  const baseState = {
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
  };

  const loggedState = pushCombatEvents(baseState, [
    createCombatEvent({
      elapsedMs: baseState.combat.elapsedMs,
      type: CombatEventType.MONSTER_DEFEATED,
      message: `${state.monster.name} 처치`,
      payload: {
        monster: state.monster.name,
        level: state.monster.level,
      },
    }),
    createCombatEvent({
      elapsedMs: baseState.combat.elapsedMs,
      type: CombatEventType.GOLD_GAINED,
      message: `보상 획득 +${state.monster.goldReward}G`,
      payload: {
        gold: state.monster.goldReward,
        exp: state.monster.expReward ?? 0,
        item: null,
      },
    }),
  ]);

  return spawnNextMonster(loggedState);
};

const resolvePlayerDefeat = (state) => {
  const nextState = {
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
  };

  return pushCombatEvents(nextState, [
    createCombatEvent({
      elapsedMs: nextState.combat.elapsedMs,
      type: CombatEventType.AUTO_BATTLE_STOP,
      message: '플레이어 다운 - 자동전투 재정비',
    }),
    createCombatEvent({
      elapsedMs: nextState.combat.elapsedMs,
      type: CombatEventType.AUTO_BATTLE_START,
      message: '자동전투 재시작',
    }),
  ]);
};

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
    const damage = nextState.player.atk;
    nextState = {
      ...nextState,
      monster: {
        ...nextState.monster,
        hp: applyDamage(nextState.monster.hp, damage),
      },
      player: {
        ...nextState.player,
        cooldownLeftMs: nextState.player.cooldownMs,
      },
      combat: {
        ...nextState.combat,
        lastEvent: `기사의 공격! ${damage} 피해`,
      },
    };

    nextState = pushCombatEvents(nextState, [
      createCombatEvent({
        elapsedMs: nextState.combat.elapsedMs,
        type: CombatEventType.DAMAGE,
        message: `기사 → ${nextState.monster.name} ${damage} 피해`,
        payload: {
          source: 'player',
          target: nextState.monster.name,
          damage,
        },
      }),
    ]);
  }

  if (isDead(nextState.monster.hp)) {
    return resolveKill(nextState);
  }

  if (nextState.monster.cooldownLeftMs <= 0) {
    const damage = nextState.monster.atk;
    nextState = {
      ...nextState,
      player: {
        ...nextState.player,
        hp: applyDamage(nextState.player.hp, damage),
      },
      monster: {
        ...nextState.monster,
        cooldownLeftMs: nextState.monster.cooldownMs,
      },
      combat: {
        ...nextState.combat,
        lastEvent: `${nextState.monster.name}의 공격! ${damage} 피해`,
      },
    };

    nextState = pushCombatEvents(nextState, [
      createCombatEvent({
        elapsedMs: nextState.combat.elapsedMs,
        type: CombatEventType.DAMAGE,
        message: `${nextState.monster.name} → 기사 ${damage} 피해`,
        payload: {
          source: nextState.monster.name,
          target: 'player',
          damage,
        },
      }),
    ]);
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
