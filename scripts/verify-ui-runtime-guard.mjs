#!/usr/bin/env node
import fs from 'node:fs';

const scenePath = new URL('../src/scenes/UILayoutScene.js', import.meta.url);
const source = fs.readFileSync(scenePath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
  console.log(`[PASS] ${message}`);
}

const saveImportCount = (source.match(/from '\.\.\/core\/save\.js';/g) ?? []).length;
const offlineImportCount = (source.match(/from '\.\.\/core\/offlineReward\.js';/g) ?? []).length;

assert(saveImportCount === 1, 'save 모듈 import가 1회만 선언되어야 함');
assert(offlineImportCount === 1, 'offlineReward 모듈 import가 1회만 선언되어야 함');

const createBlockMatch = source.match(/\bcreate\(\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*loadCombatState\(/);
assert(Boolean(createBlockMatch), 'create() 블록을 찾을 수 있어야 함');

const createBlock = createBlockMatch?.[1] ?? '';
assert(!createBlock.includes('this.bindSaveHooks();'), 'create()에서 bindSaveHooks()를 호출하지 않아야 함');
assert(!createBlock.includes('this.startAutoSave();'), 'create()에서 startAutoSave()를 호출하지 않아야 함');
assert(createBlock.includes('this.setupPersistence();'), 'create()에서 setupPersistence()를 호출해야 함');

console.log('\nverify-ui-runtime-guard: PASS');
