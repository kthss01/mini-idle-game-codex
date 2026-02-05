import assert from 'node:assert/strict';
import {
  UPGRADE_TYPE,
  applyUpgrade,
  calcDps,
  calcSurvivability,
  canAfford,
  getUpgradeCost,
} from '../src/core/progression.js';

const attackCosts = Array.from({ length: 20 }, (_, level) => getUpgradeCost(UPGRADE_TYPE.ATTACK, level));
const hpCosts = Array.from({ length: 20 }, (_, level) => getUpgradeCost(UPGRADE_TYPE.HEALTH, level));

for (let i = 1; i < attackCosts.length; i += 1) {
  assert.ok(attackCosts[i] > attackCosts[i - 1], 'attack cost must strictly increase');
  assert.ok(hpCosts[i] > hpCosts[i - 1], 'hp cost must strictly increase');
}

assert.equal(canAfford(10, 10), true);
assert.equal(canAfford(9, 10), false);

const baseState = {
  gold: 100,
  atk: 20,
  hp: 120,
  atkLevel: 0,
  hpLevel: 0,
};

const atkUpgraded = applyUpgrade(baseState, UPGRADE_TYPE.ATTACK);
assert.equal(atkUpgraded.atkLevel, 1);
assert.ok(atkUpgraded.atk > baseState.atk);
assert.equal(atkUpgraded.gold, 100 - getUpgradeCost(UPGRADE_TYPE.ATTACK, 0));

const hpUpgraded = applyUpgrade(baseState, UPGRADE_TYPE.HEALTH);
assert.equal(hpUpgraded.hpLevel, 1);
assert.ok(hpUpgraded.hp > baseState.hp);
assert.equal(hpUpgraded.gold, 100 - getUpgradeCost(UPGRADE_TYPE.HEALTH, 0));

const poorState = {
  gold: 0,
  atk: 20,
  hp: 120,
  atkLevel: 0,
  hpLevel: 0,
};
assert.deepEqual(applyUpgrade(poorState, UPGRADE_TYPE.ATTACK), poorState);

assert.equal(calcDps({ atk: 50, cooldownMs: 1000 }), 50);
assert.equal(calcSurvivability({ hp: 120 }, { atk: 20, cooldownMs: 1000 }), 6);

console.log('verify-progression: PASS');
