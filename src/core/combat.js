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

import {
  applyEquipmentBonus,
  getRewardGold,
  getScaledMonsterStats,
  getMonsterById,
} from '../logic/battleBalance.js';

const BASE_MONSTER = {
  atkSpeed: 1.6,
};

const BASE_PLAYER = {
  hp: 120,
  atk: 18,
  atkSpeed: 1.2,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const DEFAULT_MONSTER_ID = getMonsterById().id;
const DEFAULT_GROWTH_CURVE_ID = 'linear';
const DEFAULT_EQUIPMENT_TIER_ID = 'common';

const createPlayerStats = ({ tierId }) => {
  const equipped = applyEquipmentBonus({
    baseHp: BASE_PLAYER.hp,
    baseAtk: BASE_PLAYER.atk,
    tierId,
  });

  return {
    hp: equipped.hp,
    maxHp: equipped.hp,
    atk: equipped.atk,
    atkSpeed: BASE_PLAYER.atkSpeed,
    nextAttackIn: BASE_PLAYER.atkSpeed,
    equipmentTier: equipped.tier,
  };
};

const createMonsterStats = ({ monsterId, killCount, growthCurveId }) => {
  const scaled = getScaledMonsterStats({ monsterId, killCount, growthCurveId });
  const rewardGold = getRewardGold({
    monsterId,
    killCount,
    growthCurveId,
  });

  return {
    id: scaled.id,
    name: scaled.name,
    level: killCount + 1,
    hp: scaled.hp,
    maxHp: scaled.hp,
    atk: scaled.atk,
    atkSpeed: BASE_MONSTER.atkSpeed,
    nextAttackIn: BASE_MONSTER.atkSpeed,
    goldReward: rewardGold,
  };
};

/**
 * Initialize a fresh state tree.
 * @returns {GameState}
 */
export const createCombatState = () => {
  const monsterId = DEFAULT_MONSTER_ID;
  const growthCurveId = DEFAULT_GROWTH_CURVE_ID;
  const equipmentTierId = DEFAULT_EQUIPMENT_TIER_ID;
  const killCount = 0;

  return {
    player: createPlayerStats({ tierId: equipmentTierId }),
    monster: createMonsterStats({ monsterId, killCount, growthCurveId }),
    gold: 0,
    progression: {
      monsterLevel: 1,
      kills: killCount,
      monsterId,
      growthCurveId,
      equipmentTierId,
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
  const killCount = state.progression.kills;
  const { monsterId, growthCurveId } = state.progression;
  return {
    ...state,
    progression: {
      ...state.progression,
      monsterLevel: nextLevel,
    },
    monster: createMonsterStats({ monsterId, killCount, growthCurveId }),
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
