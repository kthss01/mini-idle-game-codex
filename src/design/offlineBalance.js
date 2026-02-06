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
