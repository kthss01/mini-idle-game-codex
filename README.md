# mini-idle-game-codex
codex 를 이용한 idle 게임 만들기

## 실행 방법

이 프로젝트는 정적 파일만으로 구성되어 있습니다. 로컬에서 확인하려면 프로젝트 루트의
`index.html` 을 브라우저로 직접 열거나 간단한 정적 파일 서버를 사용하면 됩니다.

## GitHub Pages 배포

- Pages 소스: `main` 브랜치 루트
- `index.html` 과 `src/` 경로가 모두 상대 경로로 구성되어 있어 별도의 base path 설정이 필요하지 않습니다.



## PR5 콘텐츠 데이터(JSON)

- 콘텐츠 데이터는 `src/data/content/zones.json`, `src/data/content/monsters.json`, `src/data/content/items.json` 에서 관리됩니다.
- 몬스터 추가는 `monsters.json` 에 몬스터를 추가하고, `zones.json` 의 `monsterPool` 에 해당 id를 넣으면 코드 수정 없이 반영됩니다.
- 지역 해금은 `zones.json` 의 `unlockStage` 기준으로 동작합니다.

## 전투 MVP 동작 검증

PR2 요구사항(자동 처치/골드 획득 반복, 난이도 증가)을 빠르게 확인하려면 아래 명령을 실행하세요.

```bash
node scripts/verify-combat-loop.mjs
```


## 로그 검증 스크립트

전투 로그 순차성/상태 전환/로그 상한/스트레스 성능을 점검하려면 아래 명령을 실행하세요.

```bash
node scripts/validate-combat-log.mjs
```

## 성장/경제 로직 검증

PR3 업그레이드(공격력/체력) 순수 함수와 비용 증가를 확인하려면 아래 명령을 실행하세요.

```bash
node scripts/verify-progression.mjs
```

## 저장/오프라인 보상 검증

PR4 저장/복구/오프라인 보상 순수 함수 검증은 아래 명령으로 실행할 수 있습니다.

```bash
node scripts/verify-save-offline.mjs
```

## 퀘스트/업적 시스템

- 퀘스트(일일/반복)와 업적(영구/누적)은 별도 데이터 모델로 분리되어 관리됩니다.
- 일일 퀘스트는 **로컬 자정 기준(local-midnight policy)** 으로 리셋됩니다.
- 보상은 골드 + 장비 상자 조합이며, 상자는 상점 장비 생성과 동일한 등급 테이블을 재사용합니다.


## 화면 실행 회귀 가드(노드 기반)

화면 초기화 관련 회귀(중복 import, 레거시 자동저장 호출 재도입)를 빠르게 확인하려면 아래 명령을 실행하세요.

```bash
node scripts/verify-ui-runtime-guard.mjs
```

## GitHub Pages에서 변경이 안 보일 때

- 저장소 **Settings → Pages → Build and deployment** 에서 Source가 `Deploy from a branch` + Branch `main` / Folder `/ (root)` 인지 확인합니다.
- 브랜치/폴더가 `docs` 로 설정되어 있으면 현재 게임 엔트리(`index.html`, `src/`)가 배포되지 않아 최신 전투 화면이 보이지 않습니다.
- 배포 후 브라우저 강력 새로고침(Windows/Linux `Ctrl+Shift+R`, macOS `Cmd+Shift+R`)으로 캐시 영향을 제거합니다.

## 충돌 점검

```bash
./scripts/check-conflicts.sh
```

원격 저장소가 설정되지 않았다면 `git remote add origin <REMOTE_URL>` 로 추가한 뒤 다시 실행합니다.

## PR 충돌 검사

```bash
./scripts/check-merge-conflicts.sh origin/main
```

원격 브랜치가 없다면 먼저 `git remote add origin <REMOTE_URL>` 후 `git fetch origin` 을 실행하거나,
로컬에 존재하는 브랜치 이름을 인자로 전달합니다.

충돌이 감지되면 `CONFLICT` 상세 로그와 충돌 가능 파일 목록을 함께 출력합니다.

## 문서 운영 원칙

- 개발 작업 시 관련 문서 업데이트를 함께 진행합니다.
- 문서는 가능한 한 한국어로 작성합니다.
- 커밋/PR/머지 메시지도 가능한 한 한국어로 작성합니다.
- 상세 정책은 `docs/documentation-policy.md` 를 참고하세요.
