const SAVE_VERSION = 1;

const asFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const asObject = (value, fallback = {}) => (value && typeof value === 'object' ? value : fallback);

export const SAVE_KEY = 'mini-idle-game-codex-save-v1';

export const buildSaveState = (gameState, now = Date.now()) => {
  const state = asObject(gameState);
  const player = asObject(state.player);
  const progression = asObject(state.progression);
  const combat = asObject(state.combat);

  return {
    version: SAVE_VERSION,
    savedAt: asFiniteNumber(now, Date.now()),
    gold: asFiniteNumber(state.gold),
    playerStats: {
      atk: asFiniteNumber(player.atk),
      maxHp: asFiniteNumber(player.maxHp),
      hp: asFiniteNumber(player.hp),
      cooldownMs: asFiniteNumber(player.cooldownMs),
      cooldownLeftMs: asFiniteNumber(player.cooldownLeftMs),
    },
    progress: {
      killCount: asFiniteNumber(progression.killCount),
      difficultyLevel: asFiniteNumber(progression.difficultyLevel, 1),
      upgrades: {
        attackLevel: asFiniteNumber(progression.upgrades?.attackLevel),
        healthLevel: asFiniteNumber(progression.upgrades?.healthLevel),
      },
      combat: {
        elapsedMs: asFiniteNumber(combat.elapsedMs),
        tick: asFiniteNumber(combat.tick),
      },
    },
    equipment: {
      owned: ['attackUpgrade', 'healthUpgrade'],
      equipped: {
        attackLevel: asFiniteNumber(progression.upgrades?.attackLevel),
        healthLevel: asFiniteNumber(progression.upgrades?.healthLevel),
      },
    },
  };
};

export const serializeSaveState = (gameState, now = Date.now()) => JSON.stringify(buildSaveState(gameState, now));

export const parseRawSave = (rawSave) => {
  if (typeof rawSave === 'string') {
    try {
      return JSON.parse(rawSave);
    } catch (_error) {
      return null;
    }
  }

  return asObject(rawSave, null);
};

export const restoreState = (rawSave) => {
  const parsed = parseRawSave(rawSave);
  if (!parsed || parsed.version !== SAVE_VERSION) {
    return {
      version: SAVE_VERSION,
      savedAt: 0,
      gold: 0,
      playerStats: {},
      progress: {
        upgrades: {
          attackLevel: 0,
          healthLevel: 0,
        },
      },
      equipment: {
        owned: [],
        equipped: {
          attackLevel: 0,
          healthLevel: 0,
        },
      },
      isValid: false,
    };
  }

  const playerStats = asObject(parsed.playerStats);
  const progress = asObject(parsed.progress);
  const upgrades = asObject(progress.upgrades);

  return {
    version: SAVE_VERSION,
    savedAt: asFiniteNumber(parsed.savedAt),
    gold: Math.max(0, Math.floor(asFiniteNumber(parsed.gold))),
    playerStats: {
      atk: Math.max(1, Math.floor(asFiniteNumber(playerStats.atk, 1))),
      maxHp: Math.max(1, Math.floor(asFiniteNumber(playerStats.maxHp, 1))),
      hp: Math.max(0, Math.floor(asFiniteNumber(playerStats.hp, 1))),
      cooldownMs: Math.max(1, Math.floor(asFiniteNumber(playerStats.cooldownMs, 700))),
      cooldownLeftMs: Math.max(0, Math.floor(asFiniteNumber(playerStats.cooldownLeftMs, 700))),
    },
    progress: {
      killCount: Math.max(0, Math.floor(asFiniteNumber(progress.killCount))),
      difficultyLevel: Math.max(1, Math.floor(asFiniteNumber(progress.difficultyLevel, 1))),
      upgrades: {
        attackLevel: Math.max(0, Math.floor(asFiniteNumber(upgrades.attackLevel))),
        healthLevel: Math.max(0, Math.floor(asFiniteNumber(upgrades.healthLevel))),
      },
      combat: {
        elapsedMs: Math.max(0, Math.floor(asFiniteNumber(progress.combat?.elapsedMs))),
        tick: Math.max(0, Math.floor(asFiniteNumber(progress.combat?.tick))),
      },
    },
    equipment: asObject(parsed.equipment, {
      owned: [],
      equipped: {
        attackLevel: 0,
        healthLevel: 0,
      },
    }),
    isValid: true,
  };
};
