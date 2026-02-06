export const offlineRewardBalance = Object.freeze({
  offlineCapSec: 8 * 60 * 60,
  offlineEfficiency: 0.75,
  goldEfficiency: 0.9,
  minimumOfflineSec: 10,
  stageBrackets: [
    { maxDifficulty: 10, killRateMultiplier: 1 },
    { maxDifficulty: 25, killRateMultiplier: 0.9 },
    { maxDifficulty: Infinity, killRateMultiplier: 0.8 },
  ],
});

// 하위 호환용 별칭: 기존 코드에서 offlineRewardConfig 이름을 참조하는 경우를 지원합니다.
export const offlineRewardConfig = offlineRewardBalance;
