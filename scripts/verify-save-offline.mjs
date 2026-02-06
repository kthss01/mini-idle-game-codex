import assert from 'node:assert/strict';
import { createCombatState } from '../src/core/combatLogic.js';
import { buildSaveState, restoreState, SAVE_VERSION } from '../src/core/save.js';
import { applyOfflineReward, calculateOfflineReward } from '../src/core/offlineReward.js';
import { offlineRewardBalance } from '../src/design/offlineBalance.js';

const baseState = createCombatState();
const now = 1_700_000_000_000;

const save = buildSaveState(baseState, now);
assert.equal(save.version, SAVE_VERSION);
assert.equal(save.savedAt, now);
assert.ok(save.progress.totalKills >= 0);

const restored = restoreState(save);
assert.equal(restored.meta.isFallback, false);
assert.equal(restored.meta.savedAt, now);
assert.equal(restored.state.gold, baseState.gold);

const offlineSec = offlineRewardBalance.offlineCapSec + 777;
const reward = calculateOfflineReward(restored.state, offlineSec, offlineRewardBalance);
assert.equal(reward.offlineSecApplied, offlineRewardBalance.offlineCapSec);
assert.ok(reward.killsGained >= 0);
assert.ok(reward.goldGained >= 0);

const rewardedState = applyOfflineReward(restored.state, reward);
assert.ok(rewardedState.gold >= restored.state.gold);
assert.ok(rewardedState.progression.killCount >= restored.state.progression.killCount);

const broken = restoreState(null);
assert.equal(broken.meta.isFallback, true);

console.log('verify-save-offline: PASS');
