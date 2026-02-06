import { combatRules, growthRules, playerBaseStats } from '../design/balance.js';
import { getDefaultZone, getUnlockedZones, resolveZone, rollDropTable, selectMonsterForZone } from '../data/contentData.js';

export const MAX_COMBAT_LOGS = 200;

export const CombatEventType = {
  AUTO_BATTLE_START: '전투시작',
  AUTO_BATTLE_STOP: '전투종료',
  DAMAGE: '데미지',
  MONSTER_DEFEATED: '처치',
  GOLD_GAINED: '골드획득',
  LOOT_GAINED: '재료획득',
  ZONE_UNLOCKED: '지역해금',
  STAGE_CLEAR: '스테이지클리어',
};

export const applyDamage = (targetHp, damage) => Math.max(0, targetHp - Math.max(0, Math.floor(damage)));
export const isDead = (hp) => hp <= 0;
export const rewardGold = (gold, monsterGoldReward) => gold + Math.max(0, Math.floor(monsterGoldReward));
export const nextMonsterLevel = (killCount) => 1 + Math.floor(Math.max(0, killCount) / growthRules.difficultyStepPerKills);

const clampStage = (stage) => Math.max(1, Math.floor(stage || 1));
const scaleValue = (base, level, growth) => Math.max(1, Math.round(base * Math.pow(growth, Math.max(0, level - 1))));

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

  return {
    ...state,
    combatLog: {
      ...state.combatLog,
      events: [...state.combatLog.events, ...newEvents].slice(-MAX_COMBAT_LOGS),
    },
  };
};

const mergeDropsToInventory = (materials, drops) => {
  const next = { ...(materials ?? {}) };
  drops.forEach(({ itemId, quantity }) => {
    if (!itemId || quantity <= 0) {
      return;
    }
    next[itemId] = (next[itemId] ?? 0) + quantity;
  });
  return next;
};

const createMonsterFromContent = (contentData, progression) => {
  const zone = resolveZone(contentData, progression.currentZoneId);
  const selected = selectMonsterForZone(contentData, zone?.id, progression.killCount);
  const level = clampStage(progression.difficultyLevel);

  const hp = scaleValue(selected?.baseHp ?? 40, level, growthRules.hpPerLevelMultiplier);
  const atk = scaleValue(selected?.baseAtk ?? 4, level, growthRules.atkPerLevelMultiplier);
  const goldReward = scaleValue(selected?.goldReward ?? 5, level, growthRules.goldPerLevelMultiplier);

  return {
    id: selected?.id ?? 'unknown',
    name: selected?.name ?? '훈련용 허수아비',
    level,
    zoneId: zone?.id ?? 'unknown-zone',
    hp,
    maxHp: hp,
    atk,
    dropTable: selected?.dropTable ?? [],
    goldReward,
    cooldownMs: combatRules.monsterAttackCooldownMs,
    cooldownLeftMs: combatRules.monsterAttackCooldownMs,
  };
};

export const createCombatState = (contentData) => {
  const defaultZone = getDefaultZone(contentData);
  const initialProgression = {
    killCount: 0,
    difficultyLevel: 1,
    upgrades: {
      attackLevel: 0,
      healthLevel: 0,
    },
    currentZoneId: defaultZone?.id ?? null,
    unlockedZoneIds: getUnlockedZones(contentData, 1).map((zone) => zone.id),
  };

  const initialMonster = createMonsterFromContent(contentData, initialProgression);

  const initialState = {
    player: {
      hp: playerBaseStats.hp,
      maxHp: playerBaseStats.hp,
      atk: playerBaseStats.atk,
      cooldownMs: playerBaseStats.attackCooldownMs,
      cooldownLeftMs: playerBaseStats.attackCooldownMs,
    },
    monster: initialMonster,
    gold: 0,
    progression: initialProgression,
    inventory: {
      materials: {},
      lastDrops: [],
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
      elapsedMs: 0,
      type: CombatEventType.AUTO_BATTLE_START,
      message: `자동전투 시작 · ${initialMonster.name} 출현 (Lv.${initialMonster.level})`,
    }),
  ]);
};

export const changeZone = (state, zoneId, contentData) => {
  const unlocked = getUnlockedZones(contentData, state?.progression?.difficultyLevel ?? 1);
  if (!unlocked.some((zone) => zone.id === zoneId)) {
    return state;
  }

  const progression = {
    ...state.progression,
    currentZoneId: zoneId,
    unlockedZoneIds: unlocked.map((zone) => zone.id),
  };

  const monster = createMonsterFromContent(contentData, progression);
  return pushCombatEvents({
    ...state,
    progression,
    monster,
    combat: {
      ...state.combat,
      lastEvent: `${resolveZone(contentData, zoneId)?.name ?? zoneId} 지역으로 이동`,
    },
  }, [
    createCombatEvent({
      elapsedMs: state.combat.elapsedMs,
      type: CombatEventType.STAGE_CLEAR,
      message: `${resolveZone(contentData, zoneId)?.name ?? zoneId} 지역 이동`,
    }),
  ]);
};

const spawnNextMonster = (state, contentData) => {
  const monster = createMonsterFromContent(contentData, state.progression);
  const nextState = {
    ...state,
    monster,
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
    }),
  ]);
};

const resolveKill = (state, contentData) => {
  const updatedKillCount = state.progression.killCount + 1;
  const updatedDifficulty = nextMonsterLevel(updatedKillCount);
  const unlockedZoneIds = getUnlockedZones(contentData, updatedDifficulty).map((zone) => zone.id);
  const newlyUnlocked = unlockedZoneIds.filter((id) => !(state.progression.unlockedZoneIds ?? []).includes(id));

  const drops = rollDropTable(state.monster.dropTable);
  const dropMessage = drops.length > 0
    ? drops.map((drop) => `${drop.itemId} x${drop.quantity}`).join(', ')
    : '드랍 없음';

  const baseState = {
    ...state,
    gold: rewardGold(state.gold, state.monster.goldReward),
    progression: {
      ...state.progression,
      killCount: updatedKillCount,
      difficultyLevel: updatedDifficulty,
      unlockedZoneIds,
    },
    inventory: {
      materials: mergeDropsToInventory(state.inventory?.materials, drops),
      lastDrops: drops,
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

  const events = [
    createCombatEvent({
      elapsedMs: baseState.combat.elapsedMs,
      type: CombatEventType.MONSTER_DEFEATED,
      message: `${state.monster.name} 처치`,
    }),
    createCombatEvent({
      elapsedMs: baseState.combat.elapsedMs,
      type: CombatEventType.GOLD_GAINED,
      message: `보상 획득 +${state.monster.goldReward}G`,
    }),
    createCombatEvent({
      elapsedMs: baseState.combat.elapsedMs,
      type: CombatEventType.LOOT_GAINED,
      message: `재료 획득: ${dropMessage}`,
      payload: { drops },
    }),
  ];

  newlyUnlocked.forEach((zoneId) => {
    const zone = resolveZone(contentData, zoneId);
    events.push(createCombatEvent({
      elapsedMs: baseState.combat.elapsedMs,
      type: CombatEventType.ZONE_UNLOCKED,
      message: `${zone?.name ?? zoneId} 지역 해금`,
      payload: { zoneId },
    }));
  });

  return spawnNextMonster(pushCombatEvents(baseState, events), contentData);
};

const resolvePlayerDefeat = (state) => pushCombatEvents({
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
}, [
  createCombatEvent({ elapsedMs: state.combat.elapsedMs, type: CombatEventType.AUTO_BATTLE_STOP, message: '플레이어 다운 - 자동전투 재정비' }),
  createCombatEvent({ elapsedMs: state.combat.elapsedMs, type: CombatEventType.AUTO_BATTLE_START, message: '자동전투 재시작' }),
]);

const executeCombatTick = (state, contentData) => {
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
    nextState = pushCombatEvents({
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
    }, [createCombatEvent({ elapsedMs: nextState.combat.elapsedMs, type: CombatEventType.DAMAGE, message: `기사 → ${nextState.monster.name} ${damage} 피해` })]);
  }

  if (isDead(nextState.monster.hp)) {
    return resolveKill(nextState, contentData);
  }

  if (nextState.monster.cooldownLeftMs <= 0) {
    const damage = nextState.monster.atk;
    nextState = pushCombatEvents({
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
    }, [createCombatEvent({ elapsedMs: nextState.combat.elapsedMs, type: CombatEventType.DAMAGE, message: `${nextState.monster.name} → 기사 ${damage} 피해` })]);
  }

  if (isDead(nextState.player.hp)) {
    return resolvePlayerDefeat(nextState);
  }

  return nextState;
};

export const tickCombat = (state, deltaMs, contentData) => {
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
    }, contentData);
  }

  return nextState;
};
