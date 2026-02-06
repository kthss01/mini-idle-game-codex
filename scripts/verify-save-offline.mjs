import { createCombatState } from '../src/core/combatLogic.js';
import { buildSaveState, restoreState, SAVE_SCHEMA_VERSION } from '../src/core/save.js';
import { applyOfflineReward, calculateOfflineReward } from '../src/core/offlineReward.js';
import { offlineRewardBalance } from '../src/design/offlineBalance.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const state = createCombatState();
state.gold = 321;
state.progression.killCount = 12;
state.progression.difficultyLevel = 5;
state.player.atk = 55;
state.player.cooldownMs = 500;
state.monster.goldReward = 14;

const savedAt = Date.now() - 600_000;
const saveState = buildSaveState(state, savedAt);

assert(saveState.version === SAVE_SCHEMA_VERSION, '저장 버전이 v1이어야 합니다.');
assert(saveState.savedAt === savedAt, 'savedAt이 정확히 저장되어야 합니다.');

const restored = restoreState(JSON.stringify(saveState));
assert(restored.meta.isValid, '유효 저장 데이터는 복원 성공해야 합니다.');
assert(restored.state.gold === 321, '골드가 복원되어야 합니다.');
assert(restored.state.progression.killCount === 12, '누적 처치 수가 복원되어야 합니다.');

const offlineSec = 600;
const reward = calculateOfflineReward(restored.state, offlineSec, offlineRewardBalance);
assert(reward.offlineSecApplied === 600, '오프라인 적용 시간이 기대값과 일치해야 합니다.');
assert(reward.killsGained > 0, '오프라인 보상으로 처치가 증가해야 합니다.');
assert(reward.goldGained > 0, '오프라인 보상으로 골드가 증가해야 합니다.');

const applied = applyOfflineReward(restored.state, reward);
assert(applied.gold > restored.state.gold, '보상 적용 후 골드가 증가해야 합니다.');
assert(applied.progression.killCount > restored.state.progression.killCount, '보상 적용 후 누적 처치가 증가해야 합니다.');

const corrupted = restoreState('{invalid-json');
assert(!corrupted.meta.isValid, '파손 저장 데이터는 안전 초기화해야 합니다.');

console.log('✅ save/offline reward 검증 통과');
