import {
  UpgradeType,
  applyUpgrade,
  calcDps,
  calcSurvivability,
  getUpgradeCost,
} from '../src/core/progression.js';
import { createCombatState } from '../src/core/combatLogic.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const baseState = createCombatState();

const atkCosts = Array.from({ length: 10 }, (_, i) => getUpgradeCost(UpgradeType.ATK, i));
const hpCosts = Array.from({ length: 10 }, (_, i) => getUpgradeCost(UpgradeType.HP, i));

assert(atkCosts.every((cost, idx) => idx === 0 || cost > atkCosts[idx - 1]), 'ATK cost should strictly increase');
assert(hpCosts.every((cost, idx) => idx === 0 || cost > hpCosts[idx - 1]), 'HP cost should strictly increase');

const richState = { ...baseState, gold: 1000 };
const atkResult = applyUpgrade(richState, UpgradeType.ATK);
assert(atkResult.success, 'ATK upgrade should succeed');
assert(atkResult.state.player.atk > richState.player.atk, 'ATK should increase');
assert(atkResult.state.progression.upgrades.atkLevel === 1, 'ATK level should increase');

const hpResult = applyUpgrade(richState, UpgradeType.HP);
assert(hpResult.success, 'HP upgrade should succeed');
assert(hpResult.state.player.maxHp > richState.player.maxHp, 'Max HP should increase');
assert(hpResult.state.progression.upgrades.hpLevel === 1, 'HP level should increase');

const poorState = { ...baseState, gold: 0 };
const failResult = applyUpgrade(poorState, UpgradeType.ATK);
assert(!failResult.success, 'Upgrade should fail when gold is insufficient');

const dps = calcDps(baseState.player);
const surv = calcSurvivability(baseState.player, baseState.monster);
assert(dps > 0, 'DPS should be positive');
assert(surv > 0, 'Survivability should be positive');

console.log('verify-progression: ok');
