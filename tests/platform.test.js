import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalPlatform } from '../src/smash/platform.js';

test('wallet and only real settings persist under the separate Smash City key', () => {
  const data = new Map([['loot-escape-v1', '{"balance":999}']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const p = new LocalPlatform(storage);
  assert.equal(p.load().balance, 0);
  assert(p.save({ balance: 145, settings: { sound: false, effects: true } }));
  assert.deepEqual(new LocalPlatform(storage).load(), { balance: 145, settings: { sound: false, effects: true } });
  assert.equal(JSON.parse(data.get('loot-escape-v1')).balance, 999);
});

test('corrupt, invalid and blocked storage never break gameplay', () => {
  const corrupt = new LocalPlatform({ getItem: () => '{broken' });
  assert.equal(corrupt.load().balance, 0);
  assert.equal(corrupt.lastLoadSucceeded, false);
  const invalid = new LocalPlatform({ getItem: () => '{"balance":-50,"settings":{"sound":"false"}}' });
  assert.deepEqual(invalid.load(), { balance: 0, settings: { sound: true, effects: true } });
  const blocked = new LocalPlatform({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.equal(blocked.load().balance, 0);
  assert.equal(blocked.save({ balance: 25 }), false);
});

test('absent advertising cannot grant a reward', async () => {
  assert.deepEqual(await new LocalPlatform().rewardedAd(), { available: false, rewarded: false });
});
