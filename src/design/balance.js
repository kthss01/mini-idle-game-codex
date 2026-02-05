export const monsterTiers = [
  {
    id: 'slime',
    name: '초원 슬라임',
    startLevel: 1,
    baseHp: 48,
    baseAtk: 5,
    baseGold: 7,
    hpTierMultiplier: 1,
    atkTierMultiplier: 1,
    goldTierMultiplier: 1,
  },
  {
    id: 'goblin',
    name: '동굴 고블린',
    startLevel: 6,
    baseHp: 80,
    baseAtk: 8,
    baseGold: 11,
    hpTierMultiplier: 1.2,
    atkTierMultiplier: 1.12,
    goldTierMultiplier: 1.15,
  },
  {
    id: 'skeleton',
    name: '묘지 스켈레톤',
    startLevel: 12,
    baseHp: 128,
    baseAtk: 12,
    baseGold: 16,
    hpTierMultiplier: 1.42,
    atkTierMultiplier: 1.26,
    goldTierMultiplier: 1.35,
  },
  {
    id: 'orc',
    name: '전초기지 오크',
    startLevel: 20,
    baseHp: 198,
    baseAtk: 18,
    baseGold: 24,
    hpTierMultiplier: 1.72,
    atkTierMultiplier: 1.48,
    goldTierMultiplier: 1.6,
  },
];

export const growthRules = {
  hpPerLevelMultiplier: 1.08,
  atkPerLevelMultiplier: 1.05,
  goldPerLevelMultiplier: 1.06,
  difficultyStepPerKills: 3,
};

export const playerBaseStats = {
  hp: 140,
  atk: 17,
  attackCooldownMs: 700,
};

export const combatRules = {
  logicTickMs: 100,
  monsterAttackCooldownMs: 1200,
};

export const futureGrowthNotes = {
  gearUpgradeAtkPerTier: 0.14,
  gearUpgradeHpPerTier: 0.18,
  prestigeDifficultyReduction: 0.12,
};
