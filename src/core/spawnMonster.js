import { growthRules, monsterRoster } from '../design/balance.js';

const clampStage = (stage) => Math.max(1, Math.floor(stage));

export const spawnMonster = (stage = 1, preferredId = null) => {
  const normalizedStage = clampStage(stage);
  const roster = monsterRoster;
  const fallbackIndex = (normalizedStage - 1) % roster.length;
  const template = preferredId
    ? roster.find((monster) => monster.id === preferredId) ?? roster[fallbackIndex]
    : roster[fallbackIndex];

  const hpMultiplier = Math.pow(
    growthRules.hpMultiplierPerStage,
    normalizedStage - 1
  );
  const atkMultiplier = Math.pow(
    growthRules.atkMultiplierPerStage,
    normalizedStage - 1
  );
  const goldMultiplier = Math.pow(
    growthRules.goldMultiplierPerStage,
    normalizedStage - 1
  );

  return {
    id: template.id,
    name: template.name,
    stage: normalizedStage,
    hp: Math.round(template.baseHp * hpMultiplier),
    atk: Math.round(template.baseAtk * atkMultiplier),
    goldReward: Math.round(template.baseGold * goldMultiplier),
  };
};
