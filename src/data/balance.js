export const monsters = [
  {
    id: 'slime',
    name: '초록 슬라임',
    baseHp: 120,
    baseAtk: 12,
    rewardGold: 18,
  },
  {
    id: 'goblin',
    name: '동굴 고블린',
    baseHp: 220,
    baseAtk: 22,
    rewardGold: 35,
  },
  {
    id: 'wyrm',
    name: '바위 와이번',
    baseHp: 420,
    baseAtk: 38,
    rewardGold: 72,
  },
  {
    id: 'lich',
    name: '황혼의 리치',
    baseHp: 760,
    baseAtk: 60,
    rewardGold: 140,
  },
];

export const growthCurves = {
  linear: {
    id: 'linear',
    name: '선형 성장',
    hpPerKill: 0.035,
    atkPerKill: 0.025,
  },
  exponential: {
    id: 'exponential',
    name: '지수 성장',
    hpBase: 1.018,
    atkBase: 1.012,
  },
};

export const equipmentTiers = [
  {
    id: 'common',
    name: '일반',
    hpBonus: 30,
    atkBonus: 6,
  },
  {
    id: 'rare',
    name: '희귀',
    hpBonus: 90,
    atkBonus: 16,
  },
  {
    id: 'heroic',
    name: '영웅',
    hpBonus: 180,
    atkBonus: 32,
  },
];
