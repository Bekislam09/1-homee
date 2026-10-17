import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,VEHICLES} from '../src/smash/content.js';
import { cleanProgression, Progression } from '../src/smash/progression.js';
import { LocalPlatform } from '../src/smash/platform.js';

const win = (missionId = 1, overrides = {}) => ({
  runId: `mission-${missionId}`, missionId, won: true, score: 20000,
  bestCombo: 4, bestChain: 3, destroyed: 42, elapsed: 30, coins: 205, ...overrides,
});

test('new or malformed saves start safely with the free dozer and first district', () => {
  const expected = { version: 3, balance: 0,
    settings: { sound: true, effects: true, shake: true, quality: 'high', language: null },
    ownedVehicles: ['dozer'], selectedVehicle: 'dozer', completedLevels: [],
    unlockedDistricts: ['town'], records: {}, settledRuns: [], achievements: [],
    stats: { destroyed: 0, bestChain: 0 }, observedRuns: [], rewardedRuns: {},
    daily: { lastDate: null, lastOrdinal: null, claimedDays: 0 } };
  for (const value of [null, undefined, [], 'invalid', { balance: -9 }, { balance: Infinity }]) {
    assert.deepEqual(cleanProgression(value), expected);
  }
});

test('sanitization rejects unowned selection and impossible progression while retaining valid fields', () => {
  const state = cleanProgression({ balance: 987, settings: { sound: false, effects: false },
    ownedVehicles: ['excavator', 'excavator', 'unknown'], selectedVehicle: 'wrecker',
    completedLevels: [4, 1, 3, 1], unlockedDistricts: ['industrial'],
    records: { 1: { bestScore: -5, bestCombo: 4, bestTime: NaN, wins: -1, stars: 5 }, 4: { wins: 500 } },
    settledRuns: ['a', 'a', '', null] });
  assert.equal(state.balance, 987);
  assert.deepEqual(state.settings, { sound: false, effects: false, shake: true, quality: 'high', language: null });
  assert.deepEqual(state.ownedVehicles, ['dozer', 'excavator']);
  assert.equal(state.selectedVehicle, 'dozer');
  assert.deepEqual(state.completedLevels, [1]);
  assert.deepEqual(state.unlockedDistricts, ['town']);
  assert.deepEqual(state.records, { 1: { bestScore: 0, bestCombo: 4, bestChain: 0, bestTime: MISSIONS[0].duration, wins: 1, stars: 1 } });
  assert.deepEqual(state.settledRuns, ['a']);
});

test('purchases cannot overspend or charge twice, and owned selection survives reload', () => {
  const p = new Progression({ balance: 299 });
  assert.deepEqual(p.purchase('excavator'), { ok: false, reason: 'insufficient-funds' });
  assert.equal(p.selectVehicle('excavator'), false);
  assert.equal(p.state.balance, 299);
  p.state.balance = 4200;
  assert(p.purchase('excavator').ok);
  assert.equal(p.state.balance, 3000);
  assert.equal(p.purchase('excavator').reason, 'already-owned');
  assert.equal(p.state.balance, 3000);
  assert(p.purchase('wrecker').ok);
  assert.equal(p.state.balance, 0);
  assert(p.selectVehicle('wrecker'));
  assert.equal(p.purchase('dozer').reason, 'already-owned');
  assert.equal(p.purchase('__proto__').reason, 'unknown');
  assert.deepEqual(new Progression(p.state).state, p.state);
});

test('all twelve contracts and the industrial district unlock in sequence only', () => {
  const p = new Progression();
  assert.equal(p.isLevelUnlocked(1), true);
  for (const id of [0, 2, 3, 4, 5]) assert.equal(p.isLevelUnlocked(id), false);
  assert.equal(p.completeRun(win(4)).applied, false);
  p.completeRun(win(1));
  assert(p.isLevelUnlocked(2));
  assert(!p.isLevelUnlocked(3));
  assert.deepEqual(p.state.unlockedDistricts, ['town']);
  p.completeRun(win(2));
  assert(p.isLevelUnlocked(3));
  assert(!p.isLevelUnlocked(4));
  assert.deepEqual(p.state.unlockedDistricts, ['town', 'industrial']);
  p.completeRun(win(3));
  assert(p.isLevelUnlocked(4));
  p.completeRun(win(4));
  assert.deepEqual(p.state.completedLevels, [1, 2, 3, 4]);
  for(let id=5;id<=MISSIONS.length;id++)assert(p.completeRun(win(id)).applied);
  assert.equal(p.state.completedLevels.length,12);
  assert.equal(p.state.balance,MISSIONS.reduce((sum,m)=>sum+m.reward,0));
});

test('failed, malformed and impossible claimed wins do not award currency or unlock content', () => {
  const p = new Progression({ balance: 25 });
  const invalid = [null, {}, win(1, { won: false }), win(1, { runId: '' }), win(1, { missionId: 99 }),
    win(1, { score: 999 }), win(1, { elapsed: MISSIONS[0].duration+1 }), win(1, { elapsed: -1 }),
    win(1, { elapsed: NaN }), win(1, { score: Infinity })];
  for (const result of invalid) assert.equal(p.completeRun(result).applied, false);
  assert.equal(p.state.balance, 25);
  assert.deepEqual(p.state.completedLevels, []);
  assert.deepEqual(p.state.settledRuns, []);
  p.completeRun(win(1));
  assert.equal(p.completeRun(win(2, { destroyed: 7 })).applied, false);
  p.completeRun(win(2));
  assert.equal(p.completeRun(win(3, { bestChain: 2 })).applied, false);
});

test('mission bonus is idempotent across result repetition, saving and browser reload', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const platform = new LocalPlatform(storage);
  const p = new Progression(platform.load());
  p.state.balance = 205;
  const first = p.completeRun(win(1));
  assert.equal(first.applied, true);
  assert.equal(first.bonus, 250);
  assert.equal(p.state.balance, 455);
  assert.equal(p.completeRun(win(1)).applied, false);
  platform.save(p.state);
  const reloaded = new Progression(new LocalPlatform(storage).load());
  assert.equal(reloaded.completeRun(win(1)).applied, false);
  assert.equal(reloaded.state.balance, 455);
  assert.equal(reloaded.state.records[1].wins, 1);
  assert.equal(reloaded.purchase('excavator').ok,false,'a small partial award cannot buy a more expensive machine');
});

test('replays retain best records and stars with smaller bonuses and scaled building coins', () => {
  const p = new Progression();
  assert.equal(p.coinScale(1), 1);
  const first = p.completeRun(win(1, { score: 4000, bestCombo: 5, bestChain: 1, elapsed: MISSIONS[0].starTimes[0] }));
  assert.equal(first.stars, 2);
  assert.equal(p.coinScale(1), 0.45);
  const replay = p.completeRun(win(1, { runId: 'replay', score: 3600, bestCombo: 2, bestChain: 3, elapsed: MISSIONS[0].starTimes[1] }));
  assert.equal(replay.bonus, 62);
  assert.equal(replay.stars, 3);
  assert.deepEqual(replay.record, { bestScore: 4000, bestCombo: 5, bestChain: 3, bestTime: MISSIONS[0].starTimes[1], wins: 2, stars: 3 });
  const slow = p.completeRun(win(1, { runId: 'slow', elapsed: MISSIONS[0].duration-1 }));
  assert.equal(slow.stars, 1);
  assert.equal(slow.record.stars, 3);
  assert.equal(slow.record.bestTime, MISSIONS[0].starTimes[1]);
  assert.equal(slow.record.wins, 3);
  assert.equal(p.state.balance, 374);
});

test('stars use inclusive deterministic thresholds for every mission', () => {
  const thresholds=MISSIONS.map(m=>[m.id,...m.starTimes]);
  for (const [id, two, three] of thresholds) {
    const p = new Progression();
    for (let prior = 1; prior < id; prior++) p.completeRun(win(prior));
    assert.equal(p.completeRun(win(id, { runId: 'two', elapsed: two })).stars, 2);
    assert.equal(p.completeRun(win(id, { runId: 'three', elapsed: three })).stars, 3);
    assert.equal(p.completeRun(win(id, { runId: 'one', elapsed: two + 0.1 })).stars, 1);
  }
});

test('settled run history is bounded and the most recent run stays idempotent', () => {
  const p = new Progression();
  for (let index = 0; index < 120; index++) p.completeRun(win(1, { runId: `run-${index}` }));
  assert.equal(p.state.settledRuns.length, 100);
  assert.equal(p.state.settledRuns[0], 'run-20');
  assert.equal(p.completeRun(win(1, { runId: 'run-119' })).applied, false);
  assert.equal(p.state.records[1].wins, 120);
});
