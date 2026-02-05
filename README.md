# mini-idle-game-codex
codex 를 이용한 idle 게임 만들기

## 실행 방법

이 프로젝트는 정적 파일만으로 구성되어 있습니다. 로컬에서 확인하려면 프로젝트 루트의
`index.html` 을 브라우저로 직접 열거나 간단한 정적 파일 서버를 사용하면 됩니다.

## GitHub Pages 배포

- Pages 소스: `main` 브랜치 루트
- `index.html` 과 `src/` 경로가 모두 상대 경로로 구성되어 있어 별도의 base path 설정이 필요하지 않습니다.

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
