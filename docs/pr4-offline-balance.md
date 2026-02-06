# PR4 오프라인 보상 밸런스 설계

## 목표
- 온라인 대비 과도한 이득을 막으면서도 재접속 동기를 보장합니다.
- 계산은 루프 없이 `offlineSec` 1회 압축 계산으로 처리합니다.

## 핵심 공식
- `offlineSec = now - savedAt`
- `offlineSecApplied = min(offlineSec, offlineCapSec)`
- `killsGained = floor(offlineSecApplied * (playerDps / currentMonsterHp) * offlineEfficiency * stageMultiplier)`
- `goldGained = floor(killsGained * currentMonsterGoldReward * goldEfficiency)`

## 밸런스 파라미터(v1)
- `offlineCapSec`: `28800` (8시간)
- `offlineEfficiency`: `0.75`
- `goldEfficiency`: `0.9`
- `minimumOfflineSec`: `10` (너무 짧은 접속 이탈은 무시)

### 구간별 처치율 보정
| 구간(난이도) | 계수 |
| --- | --- |
| 1~10 | 1.00 |
| 11~25 | 0.90 |
| 26+ | 0.80 |

## 경제 가이드
- 온라인 대비 오프라인 골드 기대 효율은 대략 `67.5%` (`0.75 * 0.9`)를 기준으로 설계합니다.
- 후반 구간 계수 하향으로 고레벨 방치 수익 폭주를 억제합니다.
