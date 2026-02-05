# mini-idle-game-codex
codex 를 이용한 idle 게임 만들기

## 실행 방법

```bash
node server.js
```

브라우저에서 `http://localhost:3000` 으로 접속합니다.

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
