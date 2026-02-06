import { createCombatState, tickCombat } from '../src/core/combatLogic.js';
import { loadContentData } from './load-content-data.mjs';

const SIMULATION_SECONDS = 90;
const STEP_MS = 100;
const TOTAL_STEPS = (SIMULATION_SECONDS * 1000) / STEP_MS;

const contentData = await loadContentData();
const initial = createCombatState(contentData);
let state = initial;

for (let i = 0; i < TOTAL_STEPS; i += 1) {
  state = tickCombat(state, STEP_MS, contentData);
}

const checks = [
  {
    name: '자동 전투로 몬스터 처치가 발생해야 함',
    ok: state.progression.killCount > 0,
    detail: `kills=${state.progression.killCount}`,
  },
  {
    name: '처치 보상으로 골드가 증가해야 함',
    ok: state.gold > initial.gold,
    detail: `gold=${state.gold}`,
  },
  {
    name: '난이도가 처치 수에 비례해 증가해야 함',
    ok: state.progression.difficultyLevel > initial.progression.difficultyLevel,
    detail: `difficulty=${state.progression.difficultyLevel}`,
  },
  {
    name: '드랍 재료가 누적되어야 함',
    ok: Object.keys(state.inventory.materials).length > 0,
    detail: `materials=${Object.keys(state.inventory.materials).length}`,
  },
];

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  const icon = check.ok ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${check.name} (${check.detail})`);
}

if (failed.length > 0) {
  console.error(`\n검증 실패: ${failed.map((check) => check.name).join(', ')}`);
  process.exit(1);
}

console.log('\n전투 MVP 자동 루프 검증 통과');
