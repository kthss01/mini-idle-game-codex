import { growthRules, monsterTiers } from '../design/balance.js';

const clampDifficulty = (difficultyLevel) => Math.max(1, Math.floor(difficultyLevel));

export const getMonsterTierForLevel = (difficultyLevel) => {
  const normalized = clampDifficulty(difficultyLevel);
  const sortedTiers = [...monsterTiers].sort((a, b) => a.startLevel - b.startLevel);

  return (
    sortedTiers
      .filter((tier) => tier.startLevel <= normalized)
      .at(-1) ?? sortedTiers[0]
  );
};

export const spawnMonster = (difficultyLevel = 1) => {
  const level = clampDifficulty(difficultyLevel);
  const tier = getMonsterTierForLevel(level);
  const levelOffset = Math.max(0, level - tier.startLevel);

  const hpMultiplier = tier.hpTierMultiplier * Math.pow(growthRules.hpPerLevelMultiplier, levelOffset);
  const atkMultiplier = tier.atkTierMultiplier * Math.pow(growthRules.atkPerLevelMultiplier, levelOffset);
  const goldMultiplier = tier.goldTierMultiplier * Math.pow(growthRules.goldPerLevelMultiplier, levelOffset);

  const hp = Math.round(tier.baseHp * hpMultiplier);

  return {
    id: tier.id,
    name: tier.name,
    level,
    tier: tier.id,
    hp,
    maxHp: hp,
    atk: Math.round(tier.baseAtk * atkMultiplier),
    goldReward: Math.round(tier.baseGold * goldMultiplier),
  };
};
