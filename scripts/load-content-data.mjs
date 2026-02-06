import { readFile } from 'node:fs/promises';
import { buildContentData } from '../src/data/contentData.js';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

export const loadContentData = async () => {
  const [zones, monsters, items] = await Promise.all([
    readJson(new URL('../src/data/content/zones.json', import.meta.url)),
    readJson(new URL('../src/data/content/monsters.json', import.meta.url)),
    readJson(new URL('../src/data/content/items.json', import.meta.url)),
  ]);

  return buildContentData({ zones, monsters, items });
};
