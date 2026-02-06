export const offlineRewardConfig = {
  offlineCapSec: 60 * 60 * 8,
  offlineEfficiency: 0.75,
  levelBrackets: [
    { maxDifficultyLevel: 10, killRateMultiplier: 1 },
    { maxDifficultyLevel: 25, killRateMultiplier: 0.92 },
    { maxDifficultyLevel: Number.POSITIVE_INFINITY, killRateMultiplier: 0.85 },
  ],
  defeatPenaltyMultiplier: 0.7,
};
