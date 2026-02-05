import assert from 'node:assert/strict';
import { createCombatState } from '../src/core/combatLogic.js';
import {
  ProgressionUpgradeType,
  applyUpgrade,
  calcDps,
  calcSurvivability,
  canAfford,
  getUpgradeCost,
} from '../src/core/progression.js';

const attackCosts = Array.from(
  { length: 20 },
  (_, level) => getUpgradeCost(ProgressionUpgradeType.ATTACK, level),
);
const hpCosts = Array.from(
  { length: 20 },
  (_, level) => getUpgradeCost(ProgressionUpgradeType.HEALTH, level),
);

for (let i = 1; i < attackCosts.length; i += 1) {
  assert.ok(attackCosts[i] > attackCosts[i - 1], 'attack cost must strictly increase');
  assert.ok(hpCosts[i] > hpCosts[i - 1], 'hp cost must strictly increase');
}

assert.equal(canAfford(10, 10), true);
assert.equal(canAfford(9, 10), false);

const baseState = { ...createCombatState(), gold: 1000 };

const atkUpgraded = applyUpgrade(baseState, ProgressionUpgradeType.ATTACK);
assert.notEqual(atkUpgraded, baseState);
assert.equal(atkUpgraded.progression.upgrades.attackLevel, 1);
assert.ok(atkUpgraded.player.atk > baseState.player.atk);
assert.equal(atkUpgraded.gold, 1000 - getUpgradeCost(ProgressionUpgradeType.ATTACK, 0));

const hpUpgraded = applyUpgrade(baseState, ProgressionUpgradeType.HEALTH);
assert.notEqual(hpUpgraded, baseState);
assert.equal(hpUpgraded.progression.upgrades.healthLevel, 1);
assert.ok(hpUpgraded.player.maxHp > baseState.player.maxHp);
assert.equal(hpUpgraded.gold, 1000 - getUpgradeCost(ProgressionUpgradeType.HEALTH, 0));

const poorState = { ...createCombatState(), gold: 0 };
assert.equal(applyUpgrade(poorState, ProgressionUpgradeType.ATTACK), poorState);

assert.equal(calcDps({ atk: 50, cooldownMs: 1000 }), 50);
assert.equal(calcSurvivability({ hp: 120 }, { atk: 20, cooldownMs: 1000 }), 6);

console.log('verify-progression: PASS');
