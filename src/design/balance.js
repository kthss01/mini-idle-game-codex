export const monsterRoster = [
  {
    id: 'goblin',
    name: '고블린',
    baseHp: 60,
    baseAtk: 8,
    baseGold: 12,
  },
  {
    id: 'wolf',
    name: '늑대',
    baseHp: 75,
    baseAtk: 10,
    baseGold: 15,
  },
  {
    id: 'skeleton',
    name: '스켈레톤',
    baseHp: 90,
    baseAtk: 12,
    baseGold: 20,
  },
  {
    id: 'ogre',
    name: '오우거',
    baseHp: 140,
    baseAtk: 18,
    baseGold: 32,
  },
];

export const growthRules = {
  hpMultiplierPerStage: 1.1,
  atkMultiplierPerStage: 1.05,
  goldMultiplierPerStage: 1.08,
};

export const equipmentTemplates = {
  weapon: {
    id: 'sword',
    name: '검',
    atkBonus: 4,
  },
  armor: {
    id: 'armor',
    name: '갑옷',
    hpBonus: 25,
  },
  shield: {
    id: 'shield',
    name: '방패',
    defBonus: 3,
  },
};
