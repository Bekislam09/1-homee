import test from 'node:test';
import assert from 'node:assert/strict';
import { Progression, ACHIEVEMENTS, DAILY_REWARDS, cleanProgression } from '../src/smash/progression.js';
import { LocalPlatform, STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/smash/platform.js';

const win = (id = 1, overrides = {}) => ({ runId: `win-${id}`, missionId: id, won: true,
  score: 2600, bestCombo: 4, bestChain: 3, destroyed: 8, elapsed: 30, coins: 205, ...overrides });
const storage = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const demolition = (id, chainCount = 1) => ({ type: 'destroy', buildingId: `building-${id}`, chainCount });

test('six achievements use actual events, exact lifetime thresholds and one notification per unlock', () => {
  assert.equal(ACHIEVEMENTS.length, 6);
  const p = new Progression();
  assert.deepEqual(p.observeEvents('first', [{ type: 'hit', buildingId: 'x' }, { type: 'win' }]), []);
  assert.equal(p.state.stats.destroyed, 0);
  assert.deepEqual(p.observeEvents('first', [demolition(1)]), ['first-hit']);
  assert.deepEqual(p.drainAchievementNotifications(), ['first-hit']);
  assert.deepEqual(p.drainAchievementNotifications(), []);
  p.observeEvents('first', Array.from({ length: 23 }, (_, i) => demolition(i + 2)));
  assert.equal(p.state.stats.destroyed, 24);
  assert(!p.state.achievements.includes('rookie'));
  assert.deepEqual(p.observeEvents('first', [demolition(25)]), ['rookie']);
  assert.deepEqual(p.observeEvents('second', Array.from({ length: 74 }, (_, i) => demolition(i))), []);
  assert.equal(p.state.stats.destroyed, 99);
  assert.deepEqual(p.observeEvents('second', [demolition(74)]), ['master']);
  assert.deepEqual(p.state.achievements, ['first-hit', 'rookie', 'master']);
  assert.equal(p.state.balance, 0, 'achievement notices do not add currency');
});

test('repeated event batches and reload never recount the same run/building or notify twice', () => {
  const memory = storage();
  const adapter = new LocalPlatform(memory);
  let p = new Progression(adapter.load());
  const batch = [demolition(1), demolition(1), demolition(2, 3), { type: 'chain', count: 3 }];
  assert.deepEqual(p.observeEvents('same-run', batch), ['first-hit', 'chain']);
  assert.deepEqual(p.observeEvents('same-run', batch), []);
  assert.equal(p.state.stats.destroyed, 2);
  assert(adapter.save(p.state));
  p = new Progression(new LocalPlatform(memory).load());
  assert.deepEqual(p.observeEvents('same-run', batch), []);
  assert.deepEqual(p.drainAchievementNotifications(), []);
  assert.equal(p.state.stats.destroyed, 2);
  assert.equal(p.state.stats.bestChain, 3);
  p.observeEvents('different-run', batch);
  assert.equal(p.state.stats.destroyed, 4, 'new runs contain fresh buildings with reused content IDs');
});

test('real free play demolitions count achievements without affecting mission or money state', () => {
  const p = new Progression({ balance: 20 });
  p.observeEvents('free', [demolition(1), demolition(2, 3)], { freeMode: true });
  assert.deepEqual(p.state.achievements, ['first-hit', 'chain']);
  assert.equal(p.state.balance, 20);
  assert.equal(p.completeRun(win(1, { runId: 'free', freeMode: true })).applied, false);
  assert.deepEqual(p.state.completedLevels, []);
  assert.equal(p.grantRewarded('free').ok, false);
});

test('collector and champion unlock only when their real purchases and wins finish', () => {
  const p = new Progression({ balance: 950 });
  p.purchase('excavator');
  assert.deepEqual(p.drainAchievementNotifications(), []);
  p.purchase('wrecker');
  assert.deepEqual(p.drainAchievementNotifications(), ['collector']);
  assert.equal(p.purchase('wrecker').ok, false);
  assert.deepEqual(p.drainAchievementNotifications(), []);
  for (let id = 1; id < 4; id++) p.completeRun(win(id));
  assert.deepEqual(p.drainAchievementNotifications(), []);
  p.completeRun(win(4));
  assert.deepEqual(p.drainAchievementNotifications(), ['champion']);
  assert.deepEqual(new Progression(p.state).drainAchievementNotifications(), []);
});

test('old complete progression derives ownership achievements without inventing destruction history', () => {
  const p = new Progression({ version: 2, ownedVehicles: ['dozer', 'excavator', 'wrecker'], completedLevels: [1, 2, 3, 4] });
  assert.deepEqual(p.state.achievements, ['collector', 'champion']);
  assert.deepEqual(p.state.stats, { destroyed: 0, bestChain: 0 });
  assert.deepEqual(p.drainAchievementNotifications(), ['collector', 'champion']);
});

test('malformed event and history data stay safe and event histories remain bounded', () => {
  const p = new Progression({ stats: { destroyed: NaN, bestChain: -1 }, achievements: ['unknown', 'unknown'],
    observedRuns: [{ runId: '', buildingIds: ['x'] }, { runId: 'existing', buildingIds: ['one', 'one', 1] }] });
  assert.deepEqual(p.observeEvents(null, [demolition(1)]), []);
  assert.deepEqual(p.observeEvents('run', [null, [], {}, { type: 'destroy', buildingId: '' }, { type: 'destroy' }]), []);
  assert.equal(p.state.stats.destroyed, 0);
  assert.deepEqual(p.observeEvents('run', [demolition(1)]), ['first-hit']);
  assert.equal(p.state.stats.destroyed, 1);
  assert.deepEqual(p.state.observedRuns[0], { runId: 'existing', buildingIds: ['one'] });
  for (let i = 0; i < 150; i++) p.observeEvents(`run-${i}`, [demolition(1)]);
  assert.equal(p.state.observedRuns.length, 100);
  assert.equal(p.state.observedRuns[0].runId, 'run-50');
  const count = p.state.stats.destroyed;
  p.observeEvents('run-149', [demolition(1)]);
  assert.equal(p.state.stats.destroyed, count);
});

test('only confirmed-ad call site can grant the stored ordinary award, never a caller amount', () => {
  const p = new Progression({ balance: 205 });
  assert.equal(p.grantRewarded('missing').ok, false);
  p.completeRun(win());
  assert.equal(p.state.balance, 355, 'ordinary award does not depend on advertising');
  assert.deepEqual(p.state.rewardedRuns['win-1'], { amount: 355, claimed: false });
  assert.deepEqual(p.grantRewarded('win-1', 999999), { ok: true, amount: 355, reason: null });
  assert.equal(p.state.balance, 710);
  assert.deepEqual(p.grantRewarded('win-1'), { ok: false, amount: 0, reason: 'already-claimed' });
  assert.equal(p.state.balance, 710);
});

test('reward settlement survives reload and repeated completeRun cannot reopen it', () => {
  const memory = storage(), adapter = new LocalPlatform(memory);
  let p = new Progression({ balance: 205 });
  p.completeRun(win());
  adapter.save(p.state);
  p = new Progression(new LocalPlatform(memory).load());
  assert.equal(p.grantRewarded('win-1').amount, 355);
  adapter.save(p.state);
  p = new Progression(new LocalPlatform(memory).load());
  assert.equal(p.grantRewarded('win-1').ok, false);
  assert.equal(p.completeRun(win()).applied, false);
  assert.equal(p.state.balance, 710);
  assert.equal(p.grantRewarded('__proto__').ok, false);
});

test('failed, unknown and migrated historical runs have no reward-ad eligibility', () => {
  const p = new Progression({ version: 2, settledRuns: ['old-run'], balance: 70 });
  assert.equal(p.grantRewarded('old-run').ok, false);
  assert.equal(p.completeRun(win(1, { won: false })).applied, false);
  assert.equal(p.grantRewarded('win-1').ok, false);
  assert.equal(p.state.balance, 70);
});

test('daily claims are calendar-based, idempotent after reload and reject backward dates', () => {
  let p = new Progression();
  assert.deepEqual(p.claimDaily(new Date(2026, 0, 1, 23, 59)), { ok: true, amount: 50, day: 1 });
  assert.equal(p.claimDaily(new Date(2026, 0, 1, 23, 59, 59)).ok, false);
  p = new Progression(p.state);
  assert.equal(p.dailyStatus(new Date(2026, 0, 1)).available, false);
  assert.equal(p.claimDaily(new Date(2025, 11, 31)).ok, false);
  assert.equal(p.claimDaily(new Date(NaN)).ok, false);
  assert.deepEqual(p.claimDaily(new Date(2026, 0, 2, 0, 0)), { ok: true, amount: 75, day: 2 });
  assert.equal(p.state.balance, 125);
});

test('daily cycle preserves progress after missed days and repeats after day seven', () => {
  const p = new Progression();
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(p.claimDaily(new Date(2026, 0, 1 + i * 3)), { ok: true, amount: DAILY_REWARDS[i], day: i + 1 });
  }
  assert.deepEqual(p.claimDaily(new Date(2026, 1, 1)), { ok: true, amount: 50, day: 1 });
  assert.equal(p.state.balance, 1050);
  assert.equal(p.state.daily.claimedDays, 8);
  assert.deepEqual(cleanProgression({ daily: { lastDate: '2026-02-30', claimedDays: 3 } }).daily,
    { lastDate: null, lastOrdinal: null, claimedDays: 0 });
});

test('v3 migration retains all v2 progress and settings and never modifies either previous save', () => {
  const memory = storage();
  const v1 = JSON.stringify({ balance: 999 });
  const v2State = { version: 2, balance: 4321, settings: { sound: false, effects: false },
    ownedVehicles: ['dozer', 'excavator'], selectedVehicle: 'excavator', completedLevels: [1, 2],
    records: { 1: { bestScore: 1700, bestTime: 30, wins: 3, stars: 3 }, 2: { bestScore: 2200, wins: 2, stars: 2 } },
    settledRuns: ['mission-one', 'mission-two'] };
  const v2 = JSON.stringify(v2State);
  memory.data.set(LEGACY_STORAGE_KEY, v1);
  memory.data.set(PREVIOUS_STORAGE_KEY, v2);
  const adapter = new LocalPlatform(memory), migrated = adapter.load();
  assert.equal(migrated.version, 3);
  assert.equal(migrated.balance, 4321);
  assert.equal(migrated.selectedVehicle, 'excavator');
  assert.deepEqual(migrated.completedLevels, [1, 2]);
  assert.deepEqual(migrated.unlockedDistricts, ['town', 'industrial']);
  assert.equal(migrated.records[1].wins, 3);
  assert.equal(migrated.records[2].stars, 2);
  assert.deepEqual(migrated.stats, { destroyed: 0, bestChain: 0 });
  assert(adapter.save(migrated));
  assert.equal(memory.data.get(LEGACY_STORAGE_KEY), v1);
  assert.equal(memory.data.get(PREVIOUS_STORAGE_KEY), v2);
  assert.equal(JSON.parse(memory.data.get(STORAGE_KEY)).version, 3);
  assert.deepEqual(new LocalPlatform(memory).load(), migrated);
});

test('partial writes retain achievements, daily claims, ad settlement and manual preferences', () => {
  const memory = storage(), adapter = new LocalPlatform(memory);
  const p = new Progression({ balance: 205 });
  p.observeEvents('win-1', [demolition(1, 3)]);
  p.completeRun(win());
  p.claimDaily(new Date(2026, 9, 16));
  p.state.settings = { ...p.state.settings, language: 'ru', shake: false, quality: 'low' };
  adapter.save(p.state);
  const fresh = new LocalPlatform(memory);
  assert(fresh.save({ settings: { sound: false }, stats: { bestChain: 4 } }));
  const loaded = new LocalPlatform(memory).load();
  assert.equal(loaded.settings.language, 'ru');
  assert.equal(loaded.settings.shake, false);
  assert.equal(loaded.settings.quality, 'low');
  assert.equal(loaded.settings.sound, false);
  assert.equal(loaded.stats.destroyed, 1);
  assert.equal(loaded.stats.bestChain, 4);
  assert.deepEqual(loaded.achievements, ['first-hit', 'chain']);
  assert.deepEqual(loaded.daily, p.state.daily);
  assert.deepEqual(loaded.rewardedRuns, p.state.rewardedRuns);
});
