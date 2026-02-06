const ensureArray = (value) => (Array.isArray(value) ? value : []);

const createIndex = (rows) => rows.reduce((acc, row) => {
  if (row?.id) {
    acc[row.id] = row;
  }
  return acc;
}, {});

export const buildContentData = ({ zones, monsters, items }) => {
  const safeZones = ensureArray(zones).filter((zone) => zone?.id && ensureArray(zone.monsterPool).length > 0);
  const safeMonsters = ensureArray(monsters).filter((monster) => monster?.id);
  const safeItems = ensureArray(items).filter((item) => item?.id);

  return {
    zones: safeZones,
    monsters: safeMonsters,
    items: safeItems,
    zonesById: createIndex(safeZones),
    monstersById: createIndex(safeMonsters),
    itemsById: createIndex(safeItems),
  };
};

export const getUnlockedZones = (contentData, stage = 1) => {
  const safeStage = Math.max(1, Math.floor(stage));
  return ensureArray(contentData?.zones)
    .filter((zone) => Math.max(1, Math.floor(zone.unlockStage ?? 1)) <= safeStage)
    .sort((a, b) => (a.unlockStage ?? 1) - (b.unlockStage ?? 1));
};

export const getDefaultZone = (contentData) => getUnlockedZones(contentData, 1)[0] ?? contentData?.zones?.[0] ?? null;

export const resolveZone = (contentData, zoneId) => contentData?.zonesById?.[zoneId] ?? getDefaultZone(contentData);

export const rollDropTable = (dropTable, randomValue = Math.random) => {
  const results = [];

  ensureArray(dropTable).forEach((entry) => {
    const chance = Math.max(0, Math.min(1, Number(entry?.chance) || 0));
    if (randomValue() > chance) {
      return;
    }

    const min = Math.max(1, Math.floor(entry?.min ?? 1));
    const max = Math.max(min, Math.floor(entry?.max ?? min));
    const qty = Math.floor(min + randomValue() * (max - min + 1));
    results.push({ itemId: entry.itemId, quantity: qty });
  });

  return results;
};

export const selectMonsterForZone = (contentData, zoneId, killCount = 0) => {
  const zone = resolveZone(contentData, zoneId);
  const pool = ensureArray(zone?.monsterPool);

  if (pool.length === 0) {
    return null;
  }

  const index = Math.max(0, Math.floor(killCount)) % pool.length;
  const monsterId = pool[index];
  return contentData?.monstersById?.[monsterId] ?? contentData?.monsters?.[0] ?? null;
};

export const loadContentDataFromFiles = async ({ zonesPath, monstersPath, itemsPath }) => {
  const [zones, monsters, items] = await Promise.all([
    fetch(zonesPath).then((res) => res.json()),
    fetch(monstersPath).then((res) => res.json()),
    fetch(itemsPath).then((res) => res.json()),
  ]);

  return buildContentData({ zones, monsters, items });
};
