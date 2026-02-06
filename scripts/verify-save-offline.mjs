import assert from 'node:assert/strict';
import { createCombatState } from '../src/core/combatLogic.js';
import { applyOfflineReward, calculateOfflineReward } from '../src/core/offlineReward.js';
import { offlineRewardConfig } from '../src/design/offlineBalance.js';
import { buildSaveState, restoreState } from '../src/core/save.js';

const baseState = createCombatState();
const save = buildSaveState(baseState, 1_700_000_000_000);
assert.equal(save.version, 1);
assert.equal(save.savedAt, 1_700_000_000_000);

const restored = restoreState(JSON.stringify(save));
assert.equal(restored.isValid, true);
assert.equal(restored.gold, baseState.gold);
assert.equal(restored.progress.killCount, baseState.progression.killCount);

const invalid = restoreState('{broken');
assert.equal(invalid.isValid, false);

const reward = calculateOfflineReward(baseState, 60 * 30, offlineRewardConfig);
assert.ok(reward.offlineSecApplied > 0);
assert.ok(reward.killsGained >= 0);
assert.ok(reward.goldGained >= 0);

const rewardedState = applyOfflineReward(baseState, reward);
assert.ok(rewardedState.gold >= baseState.gold);
assert.ok(rewardedState.progression.killCount >= baseState.progression.killCount);

const cappedReward = calculateOfflineReward(baseState, offlineRewardConfig.offlineCapSec + 9999, offlineRewardConfig);
assert.ok(cappedReward.offlineSecApplied <= offlineRewardConfig.offlineCapSec);

console.log('verify-save-offline: PASS');
