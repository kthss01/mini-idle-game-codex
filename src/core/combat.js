/**
 * @typedef {Object} PlayerState
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} atk
 * @property {number} atkSpeed
 * @property {number} nextAttackIn
 */

/**
 * @typedef {Object} MonsterState
 * @property {string} id
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} atk
 * @property {number} atkSpeed
 * @property {number} nextAttackIn
 * @property {number} level
 * @property {number} goldReward
 */

/**
 * @typedef {Object} ProgressionState
 * @property {number} monsterLevel
 * @property {number} kills
 */

/**
 * @typedef {Object} GameState
 * @property {PlayerState} player
 * @property {MonsterState} monster
 * @property {number} gold
 * @property {ProgressionState} progression
 */

const BASE_MONSTER = {
  hp: 20,
  atk: 2,
  atkSpeed: 1.6,
  goldReward: 5,
};

const BASE_PLAYER = {
  hp: 30,
  maxHp: 30,
  atk: 4,
  atkSpeed: 1.2,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const scaleMonsterStats = (level) => {
  const hp = Math.round(BASE_MONSTER.hp * (1 + level * 0.15));
  const atk = Math.round(BASE_MONSTER.atk * (1 + level * 0.12));
  const goldReward = Math.round(BASE_MONSTER.goldReward * (1 + level * 0.1));
  return { hp, atk, goldReward };
};

/**
 * Initialize a fresh state tree.
 * @returns {GameState}
 */
export const createCombatState = () => {
  const level = 1;
  const monsterStats = scaleMonsterStats(level);
  return {
    player: {
      ...BASE_PLAYER,
      nextAttackIn: BASE_PLAYER.atkSpeed,
    },
    monster: {
      id: `monster-${level}`,
      level,
      hp: monsterStats.hp,
      maxHp: monsterStats.hp,
      atk: monsterStats.atk,
      atkSpeed: BASE_MONSTER.atkSpeed,
      nextAttackIn: BASE_MONSTER.atkSpeed,
      goldReward: monsterStats.goldReward,
    },
    gold: 0,
    progression: {
      monsterLevel: level,
      kills: 0,
    },
  };
};

/**
 * Spawn a new monster based on progression state.
 * @param {GameState} state
 * @returns {GameState}
 */
export const spawnMonster = (state) => {
  const nextLevel = state.progression.monsterLevel + 1;
  const monsterStats = scaleMonsterStats(nextLevel);
  return {
    ...state,
    progression: {
      ...state.progression,
      monsterLevel: nextLevel,
    },
    monster: {
      id: `monster-${nextLevel}`,
      level: nextLevel,
      hp: monsterStats.hp,
      maxHp: monsterStats.hp,
      atk: monsterStats.atk,
      atkSpeed: BASE_MONSTER.atkSpeed,
      nextAttackIn: BASE_MONSTER.atkSpeed,
      goldReward: monsterStats.goldReward,
    },
  };
};

/**
 * Apply rewards for a kill and prepare next monster.
 * @param {GameState} state
 * @returns {GameState}
 */
export const applyKillRewards = (state) => {
  const goldAfter = state.gold + state.monster.goldReward;
  const withKill = {
    ...state,
    gold: goldAfter,
    progression: {
      ...state.progression,
      kills: state.progression.kills + 1,
    },
  };
  return spawnMonster(withKill);
};

/**
 * Simulate combat ticks. Pure function; returns new state.
 * @param {GameState} state
 * @param {number} deltaMs Milliseconds elapsed since last tick.
 * @returns {GameState}
 */
export const tickCombat = (state, deltaMs) => {
  if (deltaMs <= 0) {
    return state;
  }

  const dt = deltaMs / 1000;
  const player = { ...state.player };
  const monster = { ...state.monster };

  player.nextAttackIn = clamp(player.nextAttackIn - dt, 0, player.atkSpeed);
  monster.nextAttackIn = clamp(monster.nextAttackIn - dt, 0, monster.atkSpeed);

  if (player.nextAttackIn === 0 && monster.hp > 0) {
    monster.hp = Math.max(0, monster.hp - player.atk);
    player.nextAttackIn = player.atkSpeed;
  }

  if (monster.nextAttackIn === 0 && monster.hp > 0) {
    player.hp = Math.max(0, player.hp - monster.atk);
    monster.nextAttackIn = monster.atkSpeed;
  }

  const nextState = {
    ...state,
    player,
    monster,
  };

  if (monster.hp === 0) {
    return applyKillRewards(nextState);
  }

  return nextState;
};
