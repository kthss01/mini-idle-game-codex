export const EquipmentSlot = Object.freeze({
  WEAPON: 'weapon',
  ARMOR: 'armor',
  RING: 'ring',
});

export const EquipmentRarity = Object.freeze({
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
});

export const rarityStatMultiplier = Object.freeze({
  [EquipmentRarity.COMMON]: 1,
  [EquipmentRarity.RARE]: 1.25,
  [EquipmentRarity.EPIC]: 1.6,
  [EquipmentRarity.LEGENDARY]: 2,
});

export const rarityVisual = Object.freeze({
  [EquipmentRarity.COMMON]: { color: '#cbd5e1', icon: '⬜' },
  [EquipmentRarity.RARE]: { color: '#60a5fa', icon: '🟦' },
  [EquipmentRarity.EPIC]: { color: '#c084fc', icon: '🟪' },
  [EquipmentRarity.LEGENDARY]: { color: '#f59e0b', icon: '🟨' },
});

const slotBaseNames = Object.freeze({
  [EquipmentSlot.WEAPON]: ['검', '도끼', '창'],
  [EquipmentSlot.ARMOR]: ['갑옷', '흉갑', '로브'],
  [EquipmentSlot.RING]: ['반지', '인장', '마도반지'],
});

const slotName = Object.freeze({
  [EquipmentSlot.WEAPON]: '무기',
  [EquipmentSlot.ARMOR]: '갑옷',
  [EquipmentSlot.RING]: '반지',
});

const rarityOrder = [EquipmentRarity.COMMON, EquipmentRarity.RARE, EquipmentRarity.EPIC, EquipmentRarity.LEGENDARY];

const safeInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
};

export const createEmptyEquipmentSlots = () => ({
  [EquipmentSlot.WEAPON]: null,
  [EquipmentSlot.ARMOR]: null,
  [EquipmentSlot.RING]: null,
});

export const normalizeEquipmentItem = (item) => {
  if (!item || item.type !== 'equipment') {
    return null;
  }

  if (!Object.values(EquipmentSlot).includes(item.slot)) {
    return null;
  }

  const rarity = rarityOrder.includes(item.rarity) ? item.rarity : EquipmentRarity.COMMON;
  const baseStats = {
    atk: safeInt(item.baseStats?.atk, 0),
    hp: safeInt(item.baseStats?.hp, 0),
  };

  return {
    id: String(item.id ?? ''),
    type: 'equipment',
    name: item.name ?? `${slotName[item.slot]} 장비`,
    slot: item.slot,
    rarity,
    baseStats,
    value: safeInt(item.value, 1),
  };
};

export const getEquipmentBonuses = (equipmentSlots) => {
  const slots = equipmentSlots ?? {};
  return Object.values(EquipmentSlot).reduce((acc, slot) => {
    const item = normalizeEquipmentItem(slots[slot]);
    if (!item) {
      return acc;
    }

    const multiplier = rarityStatMultiplier[item.rarity] ?? 1;
    acc.atk += Math.floor(item.baseStats.atk * multiplier);
    acc.maxHp += Math.floor(item.baseStats.hp * multiplier);
    return acc;
  }, { atk: 0, maxHp: 0 });
};

const rollRarity = (stage, randomValue = Math.random) => {
  const n = randomValue();
  const luck = Math.min(0.2, Math.max(0, stage - 1) * 0.003);
  if (n < 0.03 + luck * 0.4) return EquipmentRarity.LEGENDARY;
  if (n < 0.12 + luck * 0.7) return EquipmentRarity.EPIC;
  if (n < 0.35 + luck) return EquipmentRarity.RARE;
  return EquipmentRarity.COMMON;
};

export const createShopEquipment = (stage = 1, randomValue = Math.random) => {
  const slots = Object.values(EquipmentSlot);
  const slot = slots[safeInt(randomValue() * slots.length) % slots.length];
  const rarity = rollRarity(stage, randomValue);
  const mult = rarityStatMultiplier[rarity] ?? 1;

  const baseAtk = slot === EquipmentSlot.WEAPON ? 3 + Math.floor(stage * 0.45) : slot === EquipmentSlot.RING ? 1 + Math.floor(stage * 0.2) : 0;
  const baseHp = slot === EquipmentSlot.ARMOR ? 12 + Math.floor(stage * 1.7) : slot === EquipmentSlot.RING ? 5 + Math.floor(stage * 0.7) : 0;
  const value = Math.max(8, Math.floor((baseAtk * 3 + baseHp) * mult));

  const names = slotBaseNames[slot] ?? ['장비'];
  const baseName = names[safeInt(randomValue() * names.length) % names.length];
  const id = `shop-${Date.now()}-${Math.floor(randomValue() * 100000)}`;

  return {
    id,
    type: 'equipment',
    name: `${rarity} ${baseName}`,
    slot,
    rarity,
    baseStats: { atk: baseAtk, hp: baseHp },
    value,
  };
};

export const compareEquipmentDelta = (currentItem, candidateItem) => {
  const wrap = (item) => getEquipmentBonuses({ [item?.slot ?? EquipmentSlot.WEAPON]: item });
  const current = currentItem ? wrap(currentItem) : { atk: 0, maxHp: 0 };
  const next = candidateItem ? wrap(candidateItem) : { atk: 0, maxHp: 0 };
  return {
    atk: next.atk - current.atk,
    maxHp: next.maxHp - current.maxHp,
  };
};
