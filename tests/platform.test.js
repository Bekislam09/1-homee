import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalPlatform, STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/smash/platform.js';
import { cleanProgression, Progression } from '../src/smash/progression.js';

function memoryStorage(entries = []) {
  const data = new Map(entries);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('wallet, progression and only real settings persist separately from the previous game', () => {
  const storage = memoryStorage([['loot-escape-v1', '{"balance":999}']]);
  const p = new LocalPlatform(storage);
  assert.equal(p.load().balance, 0);
  assert(p.save({ balance: 145, settings: { sound: false, effects: true, quality: 'high' } }));
  assert.deepEqual(new LocalPlatform(storage).load(), cleanProgression({ balance: 145, settings: { sound: false, effects: true } }));
  assert.equal(JSON.parse(storage.data.get('loot-escape-v1')).balance, 999);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).version, 3);
});

test('version one migration preserves exact wallet and settings and leaves the old save untouched', () => {
  const legacy = JSON.stringify({ balance: 123456, settings: { sound: false, effects: false } });
  const storage = memoryStorage([[LEGACY_STORAGE_KEY, legacy]]);
  const p = new LocalPlatform(storage);
  const migrated = p.load();
  assert.equal(migrated.version, 3);
  assert.equal(migrated.balance, 123456);
  assert.deepEqual(migrated.settings, { sound: false, effects: false, shake: true, quality: 'high', language: null });
  assert.deepEqual(migrated.ownedVehicles, ['dozer']);
  assert.deepEqual(migrated.completedLevels, []);
  assert(p.save(migrated));
  assert.equal(storage.data.get(LEGACY_STORAGE_KEY), legacy);
  assert.deepEqual(new LocalPlatform(storage).load(), migrated);
});

test('valid version two migrates, corrupt or unsupported new saves fall back to version one', () => {
  const legacy = JSON.stringify({ balance: 120, settings: { sound: false } });
  const storage = memoryStorage([[LEGACY_STORAGE_KEY, legacy], [PREVIOUS_STORAGE_KEY, JSON.stringify({ version: 2, balance: 77 })]]);
  assert.equal(new LocalPlatform(storage).load().balance, 77);
  for (const broken of ['{broken', 'null', '[]', '{"version":99,"balance":10000}']) {
    storage.data.set(STORAGE_KEY, broken);
    storage.data.set(PREVIOUS_STORAGE_KEY, broken);
    const p = new LocalPlatform(storage);
    assert.equal(p.load().balance, 120);
    assert.equal(p.lastLoadSucceeded, true);
  }
});

test('partial legacy-style saves preserve every new field and individual settings', () => {
  const p = new LocalPlatform(memoryStorage());
  const progression = new Progression({ balance: 1900 });
  assert(progression.purchase('excavator').ok);
  assert(progression.selectVehicle('excavator'));
  progression.completeRun({ runId: 'persisted-win', missionId: 1, won: true, score: 5000, destroyed: 23, elapsed: 135, bestCombo: 3 });
  p.save(progression.state);
  const previous = new LocalPlatform(p.storage).load();
  const fresh = new LocalPlatform(p.storage);
  assert(fresh.save({ balance: 33, settings: { sound: false } }));
  const loaded = new LocalPlatform(p.storage).load();
  assert.deepEqual(loaded, { ...previous, balance: 33, settings: { ...previous.settings, sound: false } });
});

test('corrupt, invalid and blocked storage never break gameplay', () => {
  const corrupt = new LocalPlatform({ getItem: () => '{broken' });
  assert.equal(corrupt.load().balance, 0);
  assert.equal(corrupt.lastLoadSucceeded, false);
  const invalid = new LocalPlatform({ getItem: () => '{"balance":-50,"settings":{"sound":"false"}}' });
  assert.deepEqual(invalid.load(), cleanProgression(null));
  const blocked = new LocalPlatform({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.equal(blocked.load().balance, 0);
  assert.equal(blocked.lastLoadSucceeded, false);
  assert.equal(blocked.save({ balance: 25 }), false);
  assert.equal(blocked.lastSaveSucceeded, false);
});

test('storage write failure keeps the last successful save intact and permits recovery', () => {
  const storage = memoryStorage();
  const p = new LocalPlatform(storage);
  p.save({ balance: 25 });
  const write = storage.setItem;
  storage.setItem = () => { throw Error('quota'); };
  assert.equal(p.save({ balance: 99 }), false);
  assert.equal(new LocalPlatform(storage).load().balance, 25);
  storage.setItem = write;
  assert.equal(p.save({ settings: { effects: false } }), true);
  assert.equal(p.lastSaveSucceeded, true);
  assert.equal(p.load().balance, 25);
});

test('absent advertising cannot grant a reward', async () => {
  assert.deepEqual(await new LocalPlatform().rewardedAd(), { available: false, rewarded: false });
});
