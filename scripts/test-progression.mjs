import {
  ProgressionUpgradeType,
  applyUpgrade,
  calcDps,
  calcSurvivability,
  canAfford,
  getUpgradeCost,
} from '../src/core/progression.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const baseState = {
  gold: 1000,
  player: {
    hp: 140,
    maxHp: 140,
    atk: 17,
    cooldownMs: 700,
  },
  progression: {
    upgrades: {
      attackLevel: 0,
      healthLevel: 0,
    },
  },
};

for (const type of [ProgressionUpgradeType.ATTACK, ProgressionUpgradeType.HEALTH]) {
  let prev = getUpgradeCost(type, 0);
  for (let lv = 1; lv <= 20; lv += 1) {
    const curr = getUpgradeCost(type, lv);
    assert(curr > prev, `${type} cost should strictly increase at level ${lv}`);
    prev = curr;
  }
}

const atkUp = applyUpgrade(baseState, ProgressionUpgradeType.ATTACK);
assert(atkUp.gold < baseState.gold, 'gold should decrease on attack upgrade');
assert(atkUp.player.atk > baseState.player.atk, 'atk should increase after attack upgrade');
assert(atkUp.progression.upgrades.attackLevel === 1, 'attack level should increment');

const hpUp = applyUpgrade(baseState, ProgressionUpgradeType.HEALTH);
assert(hpUp.player.maxHp > baseState.player.maxHp, 'maxHp should increase');
assert(hpUp.player.hp > baseState.player.hp, 'hp should heal with hp upgrade');
assert(hpUp.progression.upgrades.healthLevel === 1, 'health level should increment');

const poorState = { ...baseState, gold: 0 };
const unchanged = applyUpgrade(poorState, ProgressionUpgradeType.ATTACK);
assert(unchanged === poorState, 'state should remain unchanged when unaffordable');

assert(canAfford(20, 10) === true, 'canAfford true case');
assert(canAfford(5, 10) === false, 'canAfford false case');

const dps = calcDps(baseState.player);
assert(dps > 0, 'dps should be positive');
const survival = calcSurvivability(baseState.player, { atk: 5, cooldownMs: 1200 });
assert(survival > 0, 'survivability should be positive');

console.log('progression tests passed');
