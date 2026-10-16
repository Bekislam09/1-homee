import test from 'node:test';
import assert from 'node:assert/strict';
import { AdController } from '../src/smash/ad-controller.js';

function fixture(options = {}) {
  const reasons = new Set(options.reasons ?? []);
  const counts = { ads: 0, acquired: 0, released: 0, grants: 0 };
  const adapter = {
    canRewarded: true, canInterstitial: true,
    showRewarded: async () => { counts.ads++; return { available: true, rewarded: true }; },
    showInterstitial: async () => { counts.ads++; return { available: true, shown: true, rewarded: false }; },
    ...options.adapter,
  };
  const controller = new AdController(adapter, {
    requestTimeoutMs: 30,
    acquire: () => { counts.acquired++; reasons.add('ad'); return () => { counts.released++; reasons.delete('ad'); }; },
    canShowInterstitial: () => true,
    ...options,
  });
  const grant = async () => { counts.grants++; return { ok: true }; };
  return { controller, adapter, counts, reasons, grant };
}

test('rewarded grants once per unique result and rejects quick repeated clicks', async () => {
  let finish;
  const { controller, counts, grant } = fixture({ adapter: { showRewarded: () => { counts.ads++; return new Promise(resolve => { finish = resolve; }); } } });
  const first = controller.requestRewarded('win-1', grant);
  assert.equal((await controller.requestRewarded('win-1', grant)).reason, 'busy');
  await Promise.resolve(); finish({ available: true, rewarded: true });
  assert.equal((await first).granted, true);
  assert.equal((await controller.requestRewarded('win-1', grant)).reason, 'already-rewarded');
  assert.equal(counts.ads, 1);
  assert.equal(counts.grants, 1);
});

test('ad lock includes asynchronous reward settlement and prevents re-entrant grants', async () => {
  let finishGrant;
  const { controller, counts } = fixture();
  const first = controller.requestRewarded('win-1', () => new Promise(resolve => { finishGrant = resolve; }));
  while (!finishGrant) await Promise.resolve();
  assert.equal(controller.busy, true);
  assert.equal((await controller.requestRewarded('win-2', () => true)).reason, 'busy');
  finishGrant(true);
  assert.equal((await first).granted, true);
  assert.equal(controller.busy, false);
  assert.equal(counts.ads, 1);
});

test('cancelled, unavailable, failed, and timed-out ads cannot grant', async () => {
  for (const showRewarded of [async () => ({ rewarded: false }), async () => ({ available: false }), async () => { throw Error('sdk'); }, () => new Promise(() => {})]) {
    const { controller, counts, grant, reasons } = fixture({ adapter: { showRewarded }, requestTimeoutMs: 5 });
    const result = await controller.requestRewarded('win-1', grant);
    assert.notEqual(result.granted, true);
    assert.equal(counts.grants, 0);
    assert.equal(controller.busy, false);
    assert.equal(reasons.has('ad'), false);
    assert.equal(counts.acquired, counts.released);
  }
});

test('a reward arriving after request timeout is never granted or retried automatically', async () => {
  let finish;
  const { controller, counts, grant } = fixture({ requestTimeoutMs: 5, adapter: { showRewarded: () => new Promise(resolve => { finish = resolve; }) } });
  assert.equal((await controller.requestRewarded('win-1', grant)).reason, 'timeout');
  finish({ rewarded: true });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(counts.grants, 0);
});

test('manual pause and hidden-tab pause survive ad close and errors', async () => {
  for (const showRewarded of [async () => ({ rewarded: true }), async () => { throw Error('sdk'); }]) {
    const { controller, reasons, grant } = fixture({ reasons: ['manual', 'hidden'], adapter: { showRewarded } });
    await controller.requestRewarded('win-1', grant);
    assert.deepEqual([...reasons], ['manual', 'hidden']);
  }
});

test('switching tabs during an ad adds a pause reason that ad release cannot clear', async () => {
  let finish;
  const { controller, reasons, grant } = fixture({ adapter: { showRewarded: () => new Promise(resolve => { finish = resolve; }) } });
  const pending = controller.requestRewarded('win-1', grant);
  await Promise.resolve();
  assert(reasons.has('ad'));
  reasons.add('hidden');
  finish({ rewarded: true }); await pending;
  assert.deepEqual([...reasons], ['hidden']);
});

test('Basic Launch and local adapters do not acquire ad state or show a reward ad', async () => {
  const { controller, counts, grant } = fixture({ adapter: { canRewarded: false, canInterstitial: false } });
  assert.equal((await controller.requestRewarded('win-1', grant)).reason, 'unavailable');
  assert.equal((await controller.requestInterstitial()).reason, 'unavailable');
  assert.equal(counts.acquired, 0);
  assert.equal(counts.ads, 0);
});

test('midgame ads require a logical break, are spaced and share the rewarded lock', async () => {
  let now = 1000;
  let inBreak = false;
  const { controller, counts } = fixture({ now: () => now, canShowInterstitial: () => inBreak });
  assert.equal((await controller.requestInterstitial()).reason, 'active-gameplay');
  inBreak = true;
  assert.equal((await controller.requestInterstitial()).shown, true);
  now += 119999;
  assert.equal((await controller.requestInterstitial()).reason, 'cooldown');
  now += 1;
  assert.equal((await controller.requestInterstitial()).shown, true);
  assert.equal(counts.ads, 2);
});

test('unsuccessful inventory is spaced and does not trigger automatic retries', async () => {
  const { controller, counts } = fixture({ adapter: { showInterstitial: async () => { counts.ads++; return { available: false, rewarded: false }; } } });
  await controller.requestInterstitial();
  assert.equal((await controller.requestInterstitial()).reason, 'cooldown');
  assert.equal(counts.ads, 1);
});

test('economy failure cannot grant twice and release hook errors cannot strand lock', async () => {
  const { controller, counts } = fixture({ acquire: () => () => { throw Error('consumer'); } });
  const result = await controller.requestRewarded('win-1', () => { counts.grants++; throw Error('save'); });
  assert.equal(result.reason, 'grant-error');
  assert.equal(controller.busy, false);
  assert.equal((await controller.requestRewarded('win-1', () => true)).reason, 'already-rewarded');
  assert.equal(counts.grants, 1);
});
