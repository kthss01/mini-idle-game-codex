# 프로젝트 개요

## 목적
이 프로젝트는 Phaser 기반의 미니 Idle 전투 게임을 구현하고, 자동 전투/성장/밸런스 로직을
점진적으로 확장하는 것을 목표로 합니다.

## 현재 실행 구조 (최신)
- 엔트리 포인트: `src/main.js`
- 기본 실행 씬: `src/scenes/UILayoutScene.js`
- 전투 핵심 로직: `src/core/combatLogic.js`
- 성장/업그레이드 로직: `src/core/progression.js`
- 몬스터 생성: `src/core/spawnMonster.js`
- 밸런스 데이터: `src/design/balance.js`

> 현재 실제 플레이 진입은 `UILayoutScene` 기준이며,
> `GameScene`/`CombatMVPScene`은 비교·실험 목적의 씬으로 보조적으로 유지됩니다.

## 핵심 시스템 요약

### 1) 자동 전투 루프
- `createCombatState()`로 초기 상태를 구성합니다.
- `tickCombat(state, deltaMs)`가 틱 단위로 전투를 진행합니다.
- 처치 시 보상 지급, 난이도 증가, 다음 몬스터 스폰까지 한 사이클로 이어집니다.

### 2) 성장/경제
- 공격력/체력 업그레이드는 순수 함수(`applyUpgrade`, `getUpgradeCost`)로 처리합니다.
- DPS/생존력 지표(`calcDps`, `calcSurvivability`)를 통해 성장 체감을 제공합니다.

### 3) UI 레이아웃
- 상단: 재화(HUD)
- 중단 좌측: 전투 메인 영역
- 중단 우측: 성장/영웅 슬롯 패널
- 하단: 탭형 패널
- 로그 패널: 버튼/F1 토글 및 스크롤 지원

## 검증 스크립트
- 전투 루프 검증: `node scripts/verify-combat-loop.mjs`
- 로그 검증: `node scripts/validate-combat-log.mjs`
- 성장/경제 검증: `node scripts/verify-progression.mjs`

## 문서 운영 원칙
문서 최신화 기준은 `docs/documentation-policy.md`를 따릅니다.
