import { equipmentTiers, growthCurves, monsters } from '../data/balance.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const applyLinearGrowth = (baseValue, kills, perKill) =>
  Math.round(baseValue * (1 + perKill * kills));

const applyExponentialGrowth = (baseValue, kills, base) =>
  Math.round(baseValue * Math.pow(base, kills));

const resolveGrowthCurve = (curveId) =>
  growthCurves[curveId] ?? growthCurves.linear;

export const getMonsterById = (monsterId) =>
  monsters.find((monster) => monster.id === monsterId) ?? monsters[0];

export const getEquipmentTier = (tierId) =>
  equipmentTiers.find((tier) => tier.id === tierId) ?? equipmentTiers[0];

export const getScaledMonsterStats = ({
  monsterId,
  killCount,
  growthCurveId,
}) => {
  const monster = getMonsterById(monsterId);
  const curve = resolveGrowthCurve(growthCurveId);
  const kills = clamp(killCount, 0, 9999);

  let hp = monster.baseHp;
  let atk = monster.baseAtk;

  if (curve.id === 'exponential') {
    hp = applyExponentialGrowth(hp, kills, curve.hpBase);
    atk = applyExponentialGrowth(atk, kills, curve.atkBase);
  } else {
    hp = applyLinearGrowth(hp, kills, curve.hpPerKill);
    atk = applyLinearGrowth(atk, kills, curve.atkPerKill);
  }

  return {
    ...monster,
    hp,
    atk,
    killCount: kills,
    growthCurveId: curve.id,
  };
};

export const getRewardGold = ({ monsterId, killCount, growthCurveId }) => {
  const stats = getScaledMonsterStats({ monsterId, killCount, growthCurveId });
  const bonusMultiplier = 1 + stats.killCount * 0.002;

  return Math.round(stats.rewardGold * bonusMultiplier);
};

export const applyEquipmentBonus = ({ baseHp, baseAtk, tierId }) => {
  const tier = getEquipmentTier(tierId);

  return {
    tier,
    hp: baseHp + tier.hpBonus,
    atk: baseAtk + tier.atkBonus,
  };
};
