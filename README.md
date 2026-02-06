# mini-idle-game-codex
codex 를 이용한 idle 게임 만들기

## 실행 방법

이 프로젝트는 정적 파일만으로 구성되어 있습니다. 로컬에서 확인하려면 프로젝트 루트의
`index.html` 을 브라우저로 직접 열거나 간단한 정적 파일 서버를 사용하면 됩니다.

## GitHub Pages 배포

- Pages 소스: `main` 브랜치 루트
- `index.html` 과 `src/` 경로가 모두 상대 경로로 구성되어 있어 별도의 base path 설정이 필요하지 않습니다.


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

PR4 저장/복원 및 오프라인 보상 압축 계산을 확인하려면 아래 명령을 실행하세요.

```bash
node scripts/verify-save-offline.mjs
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

## 문서 운영 원칙

- 개발 작업 시 관련 문서 업데이트를 함께 진행합니다.
- 문서는 가능한 한 한국어로 작성합니다.
- 커밋/PR/머지 메시지도 가능한 한 한국어로 작성합니다.
- 상세 정책은 `docs/documentation-policy.md` 를 참고하세요.

