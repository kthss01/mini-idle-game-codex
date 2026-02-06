export const offlineRewardBalance = Object.freeze({
  offlineCapSec: 8 * 60 * 60,
  offlineEfficiency: 0.75,
  progressionBands: [
    { maxDifficulty: 5, killRateMultiplier: 1 },
    { maxDifficulty: 15, killRateMultiplier: 0.92 },
    { maxDifficulty: 9999, killRateMultiplier: 0.84 },
  ],
});

export const getOfflineKillRateMultiplier = (difficultyLevel) => {
  const normalizedDifficulty = Math.max(1, Math.floor(difficultyLevel ?? 1));
  return (
    offlineRewardBalance.progressionBands
      .find((band) => normalizedDifficulty <= band.maxDifficulty)
      ?.killRateMultiplier ?? 1
  );
};
