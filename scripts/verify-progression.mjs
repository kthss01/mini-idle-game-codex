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

const state = createCombatState();

for (let level = 0; level < 20; level += 1) {
  const atkCost = getUpgradeCost(UpgradeType.ATTACK, level);
  const atkNext = getUpgradeCost(UpgradeType.ATTACK, level + 1);
  assert(atkNext > atkCost, `공격 비용이 증가하지 않음: L${level}`);

  const hpCost = getUpgradeCost(UpgradeType.HEALTH, level);
  const hpNext = getUpgradeCost(UpgradeType.HEALTH, level + 1);
  assert(hpNext > hpCost, `체력 비용이 증가하지 않음: L${level}`);
}

const noGoldResult = applyUpgrade(state, UpgradeType.ATTACK);
assert(noGoldResult.purchased === false, '골드 부족인데 업그레이드 성공함');

const fundedState = {
  ...state,
  gold: 500,
};

const attackUpgradeResult = applyUpgrade(fundedState, UpgradeType.ATTACK);
assert(attackUpgradeResult.purchased === true, '공격력 업그레이드 실패');
assert(attackUpgradeResult.state.player.atk > fundedState.player.atk, '공격력이 증가하지 않음');
assert(attackUpgradeResult.state.progression.atkLevel === 1, '공격 레벨이 증가하지 않음');

const hpUpgradeResult = applyUpgrade(fundedState, UpgradeType.HEALTH);
assert(hpUpgradeResult.purchased === true, '체력 업그레이드 실패');
assert(hpUpgradeResult.state.player.maxHp > fundedState.player.maxHp, '최대 HP가 증가하지 않음');
assert(hpUpgradeResult.state.progression.hpLevel === 1, '체력 레벨이 증가하지 않음');

const dps = calcDps(fundedState.player);
assert(dps > 0, 'DPS가 0 이하');

const survivability = calcSurvivability(fundedState.player, fundedState.monster);
assert(survivability > 0, '생존 시간 계산이 0 이하');

console.log('verify-progression: ok');
