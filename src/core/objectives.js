import { createShopEquipment, EquipmentRarity } from './equipment.js';

export const DAILY_RESET_POLICY = Object.freeze({
  type: 'local-midnight',
  description: '일일 퀘스트는 로컬 날짜(자정) 기준으로 초기화됩니다.',
});

const ObjectiveStatus = Object.freeze({
  IN_PROGRESS: 'in_progress',
  CLAIMABLE: 'claimable',
  CLAIMED: 'claimed',
});

const QUEST_DEFINITIONS = Object.freeze([
  {
    id: 'daily-equip-swap',
    name: '장비 교체 숙련',
    target: 5,
    metric: 'dailyEquipSwaps',
    rewards: { gold: 120, boxes: 1 },
  },
  {
    id: 'daily-battle-win',
    name: '전투 승리 루틴',
    target: 10,
    metric: 'dailyBattleWins',
    rewards: { gold: 160, boxes: 1 },
  },
  {
    id: 'daily-skill-trigger',
    name: '스킬 연계 훈련',
    target: 8,
    metric: 'dailySkillTriggers',
    rewards: { gold: 140, boxes: 1 },
  },
]);

const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  {
    id: 'achv-first-rare-or-better',
    name: '희귀 장비 첫 획득',
    target: 1,
    metric: 'rareOrBetterAcquired',
    rewards: { gold: 200, boxes: 1 },
  },
  {
    id: 'achv-total-kills',
    name: '누적 처치',
    target: 100,
    metric: 'totalKills',
    rewards: { gold: 300, boxes: 2 },
  },
  {
    id: 'achv-total-skill-triggers',
    name: '스킬 마스터리',
    target: 80,
    metric: 'totalSkillTriggers',
    rewards: { gold: 280, boxes: 2 },
  },
]);

const toDateKey = (timestamp) => {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const createObjective = (definition) => ({
  ...definition,
  progress: 0,
  status: ObjectiveStatus.IN_PROGRESS,
});

const applyMetricDelta = (stats, metric, amount = 1) => ({
  ...stats,
  [metric]: Math.max(0, Math.floor((stats?.[metric] ?? 0) + amount)),
});

const deriveStatus = (objective) => {
  if (objective.status === ObjectiveStatus.CLAIMED) {
    return ObjectiveStatus.CLAIMED;
  }

  return objective.progress >= objective.target ? ObjectiveStatus.CLAIMABLE : ObjectiveStatus.IN_PROGRESS;
};

const syncProgress = (objective, stats) => {
  const progress = Math.min(objective.target, Math.max(0, Math.floor(stats?.[objective.metric] ?? 0)));
  const nextObjective = {
    ...objective,
    progress,
  };
  return {
    ...nextObjective,
    status: deriveStatus(nextObjective),
  };
};

const isRareOrBetter = (rarity) => [EquipmentRarity.RARE, EquipmentRarity.EPIC, EquipmentRarity.LEGENDARY].includes(rarity);

const createRewardEquipments = (count, stage) => {
  const safeCount = Math.max(0, Math.floor(count ?? 0));
  return Array.from({ length: safeCount }, () => createShopEquipment(stage));
};

export const createObjectiveState = (now = Date.now()) => ({
  resetPolicy: DAILY_RESET_POLICY,
  quests: {
    lastResetKey: toDateKey(now),
    stats: {
      dailyEquipSwaps: 0,
      dailyBattleWins: 0,
      dailySkillTriggers: 0,
    },
    entries: QUEST_DEFINITIONS.map(createObjective),
  },
  achievements: {
    stats: {
      rareOrBetterAcquired: 0,
      totalKills: 0,
      totalSkillTriggers: 0,
    },
    entries: ACHIEVEMENT_DEFINITIONS.map(createObjective),
  },
});

export const ensureObjectiveState = (objectiveState, now = Date.now()) => objectiveState ?? createObjectiveState(now);

export const applyDailyQuestReset = (objectiveState, now = Date.now()) => {
  const safeState = ensureObjectiveState(objectiveState, now);
  const currentDateKey = toDateKey(now);
  if (safeState.quests.lastResetKey === currentDateKey) {
    return safeState;
  }

  return {
    ...safeState,
    quests: {
      ...safeState.quests,
      lastResetKey: currentDateKey,
      stats: {
        dailyEquipSwaps: 0,
        dailyBattleWins: 0,
        dailySkillTriggers: 0,
      },
      entries: QUEST_DEFINITIONS.map(createObjective),
    },
  };
};

const updateQuestMetric = (objectiveState, metric, amount = 1) => {
  const safeState = ensureObjectiveState(objectiveState);
  const nextStats = applyMetricDelta(safeState.quests.stats, metric, amount);
  return {
    ...safeState,
    quests: {
      ...safeState.quests,
      stats: nextStats,
      entries: safeState.quests.entries.map((entry) => syncProgress(entry, nextStats)),
    },
  };
};

const updateAchievementMetric = (objectiveState, metric, amount = 1) => {
  const safeState = ensureObjectiveState(objectiveState);
  const nextStats = applyMetricDelta(safeState.achievements.stats, metric, amount);
  return {
    ...safeState,
    achievements: {
      ...safeState.achievements,
      stats: nextStats,
      entries: safeState.achievements.entries.map((entry) => syncProgress(entry, nextStats)),
    },
  };
};

export const trackEquipSwap = (objectiveState) => updateQuestMetric(objectiveState, 'dailyEquipSwaps', 1);

export const trackBattleWin = (objectiveState) => {
  let next = updateQuestMetric(objectiveState, 'dailyBattleWins', 1);
  next = updateAchievementMetric(next, 'totalKills', 1);
  return next;
};

export const trackSkillTrigger = (objectiveState, count = 1) => {
  let next = updateQuestMetric(objectiveState, 'dailySkillTriggers', count);
  next = updateAchievementMetric(next, 'totalSkillTriggers', count);
  return next;
};

export const trackEquipmentAcquired = (objectiveState, equipmentItem) => {
  const safeState = ensureObjectiveState(objectiveState);
  if (!isRareOrBetter(equipmentItem?.rarity)) {
    return safeState;
  }

  const firstTime = (safeState.achievements.stats.rareOrBetterAcquired ?? 0) === 0;
  if (!firstTime) {
    return safeState;
  }

  return updateAchievementMetric(safeState, 'rareOrBetterAcquired', 1);
};

const claimEntries = ({ entries, inventory, gold, stage }) => {
  const rewards = { gold: 0, equipment: [] };
  const nextEntries = entries.map((entry) => {
    if (entry.status !== ObjectiveStatus.CLAIMABLE) {
      return entry;
    }

    rewards.gold += Math.max(0, Math.floor(entry.rewards?.gold ?? 0));
    rewards.equipment.push(...createRewardEquipments(entry.rewards?.boxes ?? 0, stage));

    return {
      ...entry,
      status: ObjectiveStatus.CLAIMED,
    };
  });

  return {
    entries: nextEntries,
    gold: gold + rewards.gold,
    inventory: {
      ...inventory,
      equipment: [...(inventory?.equipment ?? []), ...rewards.equipment],
    },
    rewards,
  };
};

export const claimObjectiveRewards = (state) => {
  const safeObjectives = ensureObjectiveState(state.objectives);
  const stage = state?.progression?.difficultyLevel ?? 1;

  const questClaim = claimEntries({
    entries: safeObjectives.quests.entries,
    inventory: state.inventory,
    gold: state.gold,
    stage,
  });

  const achievementClaim = claimEntries({
    entries: safeObjectives.achievements.entries,
    inventory: questClaim.inventory,
    gold: questClaim.gold,
    stage,
  });

  let nextObjectiveState = {
    ...safeObjectives,
    quests: {
      ...safeObjectives.quests,
      entries: questClaim.entries,
    },
    achievements: {
      ...safeObjectives.achievements,
      entries: achievementClaim.entries,
    },
  };

  achievementClaim.rewards.equipment.forEach((item) => {
    nextObjectiveState = trackEquipmentAcquired(nextObjectiveState, item);
  });

  return {
    ...state,
    gold: achievementClaim.gold,
    inventory: achievementClaim.inventory,
    objectives: nextObjectiveState,
    rewardSummary: {
      gold: questClaim.rewards.gold + achievementClaim.rewards.gold,
      boxes: questClaim.rewards.equipment.length + achievementClaim.rewards.equipment.length,
    },
  };
};
