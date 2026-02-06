import { combatRules, growthRules, playerBaseStats } from '../design/balance.js';
import { compareEquipmentDelta, createEmptyEquipmentSlots, createShopEquipment, EquipmentSlot, normalizeEquipmentItem } from './equipment.js';
import { applyPlayerStatSnapshot } from './progression.js';
import { getDefaultZone, getUnlockedZones, resolveZone, rollDropTable, selectMonsterForZone } from '../data/contentData.js';

export const MAX_COMBAT_LOGS = 200;

export const CombatEventType = {
  AUTO_BATTLE_START: '전투시작',
  AUTO_BATTLE_STOP: '전투종료',
  DAMAGE: '데미지',
  MONSTER_DEFEATED: '처치',
  GOLD_GAINED: '골드획득',
  LOOT_GAINED: '재료획득',
  SKILL_TRIGGERED: '스킬발동',
  ZONE_UNLOCKED: '지역해금',
  STAGE_CLEAR: '스테이지클리어',
};

export const SkillTriggerType = {
  ON_ATTACK: 'onAttack',
  ON_HIT: 'onHit',
};

const KNIGHT_SKILLS = [
  {
    id: 'shield-block',
    name: 'Shield Block',
    trigger: SkillTriggerType.ON_HIT,
    cooldown: 3500,
    procChance: 0.35,
    effect: {
      type: 'damageReduction',
      value: 0.5,
    },
    lastActivatedAt: -Infinity,
  },
  {
    id: 'power-strike',
    name: 'Power Strike',
    trigger: SkillTriggerType.ON_ATTACK,
    cooldown: 3000,
    procChance: 0.3,
    effect: {
      type: 'bonusDamage',
      value: 1.25,
    },
    lastActivatedAt: -Infinity,
  },
  {
    id: 'battle-cry',
    name: 'Battle Cry',
    trigger: SkillTriggerType.ON_ATTACK,
    cooldown: 8000,
    procChance: 1,
    effect: {
      type: 'attackBuff',
      value: 0.4,
      durationMs: 2500,
    },
    lastActivatedAt: -Infinity,
  },
];

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

const isSkillReady = (skill, elapsedMs) => elapsedMs - (skill.lastActivatedAt ?? -Infinity) >= skill.cooldown;

const resolveSkillTriggers = ({ state, trigger, baseDamage, attackerName, defenderName }) => {
  const elapsedMs = state.combat.elapsedMs;
  const skills = state.player.skills ?? [];
  const triggeredEvents = [];
  const nextSkills = [...skills];
  let nextDamage = baseDamage;
  let nextBuffState = { ...(state.player.activeBuff ?? { atkMultiplier: 1, expiresAt: 0 }) };

  nextSkills.forEach((skill, index) => {
    if (skill.trigger !== trigger || !isSkillReady(skill, elapsedMs)) {
      return;
    }

    // 규칙: 쿨타임이 준비된 경우에만 확률 판정을 수행한다.
    if (Math.random() > skill.procChance) {
      return;
    }

    const nextSkill = {
      ...skill,
      lastActivatedAt: elapsedMs,
    };
    nextSkills[index] = nextSkill;

    if (skill.effect.type === 'bonusDamage') {
      const bonusDamage = Math.round(baseDamage * skill.effect.value);
      nextDamage += bonusDamage;
      triggeredEvents.push(createCombatEvent({
        elapsedMs,
        type: CombatEventType.SKILL_TRIGGERED,
        message: `${skill.name} 발동! ${attackerName} 추가 피해 +${bonusDamage}`,
        payload: { skillId: skill.id, trigger },
      }));
      return;
    }

    if (skill.effect.type === 'damageReduction') {
      const blocked = Math.round(baseDamage * skill.effect.value);
      nextDamage = Math.max(0, baseDamage - blocked);
      triggeredEvents.push(createCombatEvent({
        elapsedMs,
        type: CombatEventType.SKILL_TRIGGERED,
        message: `${skill.name} 발동! ${defenderName} 피해 ${blocked} 감소`,
        payload: { skillId: skill.id, trigger },
      }));
      return;
    }

    if (skill.effect.type === 'attackBuff') {
      nextBuffState = {
        atkMultiplier: 1 + skill.effect.value,
        expiresAt: elapsedMs + skill.effect.durationMs,
      };
      triggeredEvents.push(createCombatEvent({
        elapsedMs,
        type: CombatEventType.SKILL_TRIGGERED,
        message: `${skill.name} 발동! ${Math.round(skill.effect.durationMs / 1000)}초간 공격력 증가`,
        payload: { skillId: skill.id, trigger },
      }));
    }
  });

  return {
    damage: nextDamage,
    skills: nextSkills,
    activeBuff: nextBuffState,
    events: triggeredEvents,
  };
};

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
      baseStats: {
        atk: playerBaseStats.atk,
        maxHp: playerBaseStats.hp,
        cooldownMs: playerBaseStats.attackCooldownMs,
      },
      equipmentSlots: createEmptyEquipmentSlots(),
      equipmentBonus: { atk: 0, maxHp: 0 },
      skills: KNIGHT_SKILLS.map((skill) => ({ ...skill })),
      activeBuff: {
        atkMultiplier: 1,
        expiresAt: 0,
      },
    },
    monster: initialMonster,
    gold: 0,
    progression: initialProgression,
    inventory: {
      materials: {},
      equipment: [],
      shopOffer: createShopEquipment(1),
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

  return pushCombatEvents(applyPlayerStatSnapshot(initialState), [
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
      equipment: state.inventory?.equipment ?? [],
      shopOffer: createShopEquipment(updatedDifficulty),
      lastDrops: drops,
    },
    combat: {
      ...state.combat,
      lastEvent: `${state.monster.name} 처치 +${state.monster.goldReward}G`,
    },
  };

  const healedState = applyPlayerStatSnapshot({
    ...baseState,
    player: {
      ...baseState.player,
      hp: Math.min(baseState.player.maxHp, baseState.player.hp + 8),
    },
  });

  const events = [
    createCombatEvent({
      elapsedMs: healedState.combat.elapsedMs,
      type: CombatEventType.MONSTER_DEFEATED,
      message: `${state.monster.name} 처치`,
    }),
    createCombatEvent({
      elapsedMs: healedState.combat.elapsedMs,
      type: CombatEventType.GOLD_GAINED,
      message: `보상 획득 +${state.monster.goldReward}G`,
    }),
    createCombatEvent({
      elapsedMs: healedState.combat.elapsedMs,
      type: CombatEventType.LOOT_GAINED,
      message: `재료 획득: ${dropMessage}`,
      payload: { drops },
    }),
  ];

  newlyUnlocked.forEach((zoneId) => {
    const zone = resolveZone(contentData, zoneId);
    events.push(createCombatEvent({
      elapsedMs: healedState.combat.elapsedMs,
      type: CombatEventType.ZONE_UNLOCKED,
      message: `${zone?.name ?? zoneId} 지역 해금`,
      payload: { zoneId },
    }));
  });

  return spawnNextMonster(pushCombatEvents(healedState, events), contentData);
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
  const nowElapsed = state.combat.elapsedMs;
  const buff = state.player.activeBuff ?? { atkMultiplier: 1, expiresAt: 0 };
  const isBuffActive = nowElapsed < (buff.expiresAt ?? 0);
  const atkMultiplier = isBuffActive ? buff.atkMultiplier : 1;

  let nextState = {
    ...state,
    combat: {
      ...state.combat,
      tick: state.combat.tick + 1,
    },
    player: {
      ...state.player,
      cooldownLeftMs: Math.max(0, state.player.cooldownLeftMs - combatRules.logicTickMs),
      activeBuff: {
        atkMultiplier,
        expiresAt: isBuffActive ? buff.expiresAt : 0,
      },
    },
    monster: {
      ...state.monster,
      cooldownLeftMs: Math.max(0, state.monster.cooldownLeftMs - combatRules.logicTickMs),
    },
  };

  if (nextState.player.cooldownLeftMs <= 0) {
    // 전투 순서 고정: 장비/버프 보정 → 스킬 판정 → 최종 피해 계산
    const adjustedDamage = Math.round(nextState.player.atk * (nextState.player.activeBuff?.atkMultiplier ?? 1));
    const skillResolution = resolveSkillTriggers({
      state: nextState,
      trigger: SkillTriggerType.ON_ATTACK,
      baseDamage: adjustedDamage,
      attackerName: '기사',
      defenderName: nextState.monster.name,
    });
    const finalDamage = skillResolution.damage;

    nextState = pushCombatEvents({
      ...nextState,
      monster: {
        ...nextState.monster,
        hp: applyDamage(nextState.monster.hp, finalDamage),
      },
      player: {
        ...nextState.player,
        skills: skillResolution.skills,
        activeBuff: skillResolution.activeBuff,
        cooldownLeftMs: nextState.player.cooldownMs,
      },
      combat: {
        ...nextState.combat,
        lastEvent: `기사의 공격! ${finalDamage} 피해`,
      },
    }, [
      ...skillResolution.events,
      createCombatEvent({ elapsedMs: nextState.combat.elapsedMs, type: CombatEventType.DAMAGE, message: `기사 → ${nextState.monster.name} ${finalDamage} 피해` }),
    ]);
  }

  if (isDead(nextState.monster.hp)) {
    return resolveKill(nextState, contentData);
  }

  if (nextState.monster.cooldownLeftMs <= 0) {
    const skillResolution = resolveSkillTriggers({
      state: nextState,
      trigger: SkillTriggerType.ON_HIT,
      baseDamage: nextState.monster.atk,
      attackerName: nextState.monster.name,
      defenderName: '기사',
    });
    const finalDamage = skillResolution.damage;

    nextState = pushCombatEvents({
      ...nextState,
      player: {
        ...nextState.player,
        hp: applyDamage(nextState.player.hp, finalDamage),
        skills: skillResolution.skills,
        activeBuff: skillResolution.activeBuff,
      },
      monster: {
        ...nextState.monster,
        cooldownLeftMs: nextState.monster.cooldownMs,
      },
      combat: {
        ...nextState.combat,
        lastEvent: `${nextState.monster.name}의 공격! ${finalDamage} 피해`,
      },
    }, [
      ...skillResolution.events,
      createCombatEvent({ elapsedMs: nextState.combat.elapsedMs, type: CombatEventType.DAMAGE, message: `${nextState.monster.name} → 기사 ${finalDamage} 피해` }),
    ]);
  }

  if (isDead(nextState.player.hp)) {
    return resolvePlayerDefeat(nextState);
  }

  return nextState;
};


export const equipItemFromInventory = (state, itemId) => {
  const items = state?.inventory?.equipment ?? [];
  const index = items.findIndex((item) => item?.id === itemId);
  if (index < 0) {
    return state;
  }

  const candidate = normalizeEquipmentItem(items[index]);
  if (!candidate) {
    return state;
  }

  const current = normalizeEquipmentItem(state.player?.equipmentSlots?.[candidate.slot]);
  const nextItems = [...items];
  nextItems.splice(index, 1);
  if (current) {
    nextItems.push(current);
  }

  const nextState = applyPlayerStatSnapshot({
    ...state,
    player: {
      ...state.player,
      equipmentSlots: {
        ...(state.player?.equipmentSlots ?? createEmptyEquipmentSlots()),
        [candidate.slot]: candidate,
      },
    },
    inventory: {
      ...state.inventory,
      equipment: nextItems,
    },
  });

  const delta = compareEquipmentDelta(current, candidate);
  return pushCombatEvents(nextState, [createCombatEvent({
    elapsedMs: state.combat.elapsedMs,
    type: CombatEventType.LOOT_GAINED,
    message: `${candidate.name} 장착 (ATK ${delta.atk >= 0 ? '+' : ''}${delta.atk}, HP ${delta.maxHp >= 0 ? '+' : ''}${delta.maxHp})`,
  })]);
};

export const unequipSlot = (state, slot) => {
  if (!Object.values(EquipmentSlot).includes(slot)) {
    return state;
  }

  const current = normalizeEquipmentItem(state.player?.equipmentSlots?.[slot]);
  if (!current) {
    return state;
  }

  const nextState = applyPlayerStatSnapshot({
    ...state,
    player: {
      ...state.player,
      equipmentSlots: {
        ...(state.player?.equipmentSlots ?? createEmptyEquipmentSlots()),
        [slot]: null,
      },
    },
    inventory: {
      ...state.inventory,
      equipment: [...(state.inventory?.equipment ?? []), current],
    },
  });

  return pushCombatEvents(nextState, [createCombatEvent({
    elapsedMs: state.combat.elapsedMs,
    type: CombatEventType.LOOT_GAINED,
    message: `${current.name} 장착 해제`,
  })]);
};

export const purchaseShopOffer = (state) => {
  const offer = normalizeEquipmentItem(state?.inventory?.shopOffer);
  if (!offer || state.gold < offer.value) {
    return state;
  }

  return pushCombatEvents({
    ...state,
    gold: state.gold - offer.value,
    inventory: {
      ...state.inventory,
      equipment: [...(state.inventory?.equipment ?? []), offer],
      shopOffer: createShopEquipment(state.progression?.difficultyLevel ?? 1),
    },
  }, [createCombatEvent({
    elapsedMs: state.combat.elapsedMs,
    type: CombatEventType.GOLD_GAINED,
    message: `상점 구매: ${offer.name} (${offer.value}G)`,
  })]);
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
