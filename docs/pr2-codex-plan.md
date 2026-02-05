# PR2 전투 MVP 자동 전투 루프 - Codex 분업 계획

## 공통 목표
- 몬스터 스폰 → 틱 기반 전투 → 처치 보상(골드) → 다음 몬스터 스폰이 입력 없이 반복되는 MVP를 완성한다.
- 처치 수 기반으로 난이도가 완만하게 상승하도록 밸런스를 정의한다.

## Codex 1: Core Logic (Pure JS)
### 담당 범위
- `src/core/combatLogic.js`
- `src/core/spawnMonster.js`

### 작업 내역
1. 게임 상태 모델 정의
   - player / monster / progression / combat 구조를 순수 객체로 정리.
2. 몬스터 스폰/스케일링 함수
   - `spawnMonster(difficultyLevel)` 구현.
   - 처치 수 기반 `nextMonsterLevel(killCount)` 구현.
3. 틱 기반 전투 루프
   - `tickCombat(state, deltaMs)` 구현.
   - 쿨다운, 피해 적용, 사망 판정, 골드 보상, 다음 몬스터 스폰 반영.
4. 순수 함수 분리
   - `applyDamage`, `isDead`, `rewardGold`, `nextMonsterLevel` 분리.

## Codex 2: Phaser Scene (Rendering)
### 담당 범위
- `src/scenes/CombatMVPScene.js`

### 작업 내역
1. 씬 초기화
   - 플레이어/몬스터 시각 요소 및 HUD 텍스트 생성.
2. 게임 루프 연결
   - `update(time, delta)`에서 `tickCombat` 호출.
   - 반환 상태로 HUD 갱신.
3. 몬스터 교체 연출
   - 새 몬스터 스폰 감지 시 스케일/색상 트윈 연출 적용.

## Codex 3: Game Design (밸런스 설계)
### 담당 범위
- `src/design/balance.js`

### 작업 내역
1. 몬스터 티어 설계
   - 슬라임 → 고블린 → 스켈레톤 → 오크 순서 정의.
2. 난이도 규칙
   - 레벨별 HP/ATK 증가 배율 정의.
   - 처치 수 기반 난이도 상승 간격 정의.
3. 보상 규칙
   - 티어/레벨 기반 골드 증가 규칙 정의.
4. 후속 확장 제안
   - 장비/프레스티지용 성장 파라미터를 별도 노트로 추가.

## 소스 충돌 가능 구간 (사전 공유)
- `src/core/combatLogic.js`는 Codex 1 전용이므로 Scene 로직이 직접 수정하면 충돌 가능.
- `src/design/balance.js`는 Codex 1(읽기) + Codex 3(쓰기) 교차 지점이라 스키마 변경 시 동기화 필요.
- `src/scenes/CombatMVPScene.js`는 Codex 2 전용으로, 전투 계산 코드가 들어오면 역할 충돌 발생.
