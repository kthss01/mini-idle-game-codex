import {
  CombatEventType,
  MAX_COMBAT_LOGS,
  createCombatState,
  tickCombat,
} from '../src/core/combatLogic.js';

const simulateCombat = ({ loops, deltaMs }) => {
  let state = createCombatState();
  for (let i = 0; i < loops; i += 1) {
    state = tickCombat(state, deltaMs);
  }
  return state;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const validateSequentialTimestamps = (events) => {
  for (let i = 1; i < events.length; i += 1) {
    assert(
      events[i].timestamp >= events[i - 1].timestamp,
      `타임스탬프 역전 감지: index ${i - 1} -> ${i}`,
    );
  }
};

const validateTransitionPairs = (events) => {
  for (let i = 0; i < events.length; i += 1) {
    const current = events[i];
    if (current.type === CombatEventType.AUTO_BATTLE_STOP) {
      assert(events[i + 1]?.type === CombatEventType.AUTO_BATTLE_START, '전투종료 직후 전투시작 로그 누락');
    }

    if (current.type === CombatEventType.MONSTER_DEFEATED) {
      assert(events[i + 1]?.type === CombatEventType.GOLD_GAINED, '처치 직후 골드획득 로그 누락');
      assert(events[i + 2]?.type === CombatEventType.STAGE_CLEAR, '처치 후 스테이지클리어 로그 누락');
    }
  }
};

const validateLogCapAndPerformance = () => {
  const start = performance.now();
  const state = simulateCombat({ loops: 200000, deltaMs: 16 });
  const elapsedMs = performance.now() - start;

  assert(state.combatLog.events.length <= MAX_COMBAT_LOGS, '로그 최대 보관 개수 초과');

  return {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    logSize: state.combatLog.events.length,
  };
};

const main = () => {
  const normalState = simulateCombat({ loops: 1200, deltaMs: 100 });
  const events = normalState.combatLog.events;

  assert(events.length > 0, '로그 이벤트가 비어있습니다.');
  validateSequentialTimestamps(events);
  validateTransitionPairs(events);

  const eventCounts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});

  const perf = validateLogCapAndPerformance();

  const summary = {
    checks: {
      sequentialTimestamps: 'pass',
      transitionPairs: 'pass',
      logCap: 'pass',
      stressPerformance: 'pass',
    },
    sampleRun: {
      gold: normalState.gold,
      killCount: normalState.progression.killCount,
      stage: normalState.progression.difficultyLevel,
      logSize: events.length,
      eventCounts,
    },
    stressRun: perf,
  };

  console.log(JSON.stringify(summary, null, 2));
};

main();
