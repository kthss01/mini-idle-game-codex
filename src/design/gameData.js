export const monsters = [
  {
    id: 'slime',
    name: '슬라임',
    baseHp: 60,
    baseAtk: 6,
    spawnStages: [
      { stage: 1, hpScale: 1, atkScale: 1 },
      { stage: 3, hpScale: 1.15, atkScale: 1.1 },
      { stage: 6, hpScale: 1.3, atkScale: 1.25 },
    ],
  },
  {
    id: 'goblin',
    name: '고블린',
    baseHp: 90,
    baseAtk: 10,
    spawnStages: [
      { stage: 4, hpScale: 1, atkScale: 1 },
      { stage: 8, hpScale: 1.2, atkScale: 1.15 },
      { stage: 12, hpScale: 1.4, atkScale: 1.3 },
    ],
  },
  {
    id: 'ogre',
    name: '오우거',
    baseHp: 150,
    baseAtk: 16,
    spawnStages: [
      { stage: 9, hpScale: 1, atkScale: 1 },
      { stage: 14, hpScale: 1.25, atkScale: 1.2 },
      { stage: 18, hpScale: 1.5, atkScale: 1.35 },
    ],
  },
];

export const equipment = [
  {
    id: 'rusty-sword',
    name: '녹슨 검',
    attackBonus: 2,
    defenseBonus: 0,
    price: 30,
  },
  {
    id: 'knight-sword',
    name: '기사의 검',
    attackBonus: 6,
    defenseBonus: 2,
    price: 120,
  },
  {
    id: 'guardian-armor',
    name: '수호자 갑옷',
    attackBonus: 0,
    defenseBonus: 6,
    price: 160,
  },
];

export const growthCurve = [
  { stage: 1, hpRate: 1, atkRate: 1 },
  { stage: 5, hpRate: 1.15, atkRate: 1.08 },
  { stage: 10, hpRate: 1.32, atkRate: 1.2 },
  { stage: 15, hpRate: 1.5, atkRate: 1.35 },
  { stage: 20, hpRate: 1.75, atkRate: 1.5 },
];
