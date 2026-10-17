import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, INDUSTRIAL_BUILDINGS } from '../src/smash/simulation.js';
import { MISSIONS, VEHICLES } from '../src/smash/content.js';

const STEP = 1 / 60;
const advance = (sim, seconds, input = {}) => {
  const events = [];
  for (let left = seconds; left > 1e-8; left -= STEP) {
    sim.update(Math.min(STEP, left), input);
    events.push(...sim.events);
  }
  return events;
};

const beside = (sim, b) => Object.assign(sim.player, {
  x: b.x - b.w / 2 - 22, y: b.y, vx: 0, vy: 0, heading: 0,
});

function destroyWithRam(sim, b) {
  const events = [];
  while (b.hp > 0 && sim.phase === 'playing') {
    if (sim.player.ramCooldown > 0) events.push(...advance(sim, sim.player.ramCooldown + STEP));
    beside(sim, b);
    assert.equal(sim.useRam(), true);
    events.push(...advance(sim, 0.35));
  }
  return events;
}

test('all vehicle, mission and industrial layouts start independently, with safe defaults', () => {
  const sim = new Simulation({ balance: 500 });
  for (const mission of MISSIONS) for (const vehicle of Object.values(VEHICLES)) {
    sim.start({ missionId: mission.id, vehicleId: vehicle.id });
    assert.equal(sim.mission.id, mission.id);
    assert.equal(sim.vehicleId, vehicle.id);
    assert.equal(sim.timeLeft, mission.duration);
    assert.equal(sim.goal, mission.target);
    assert.equal(sim.progress, 0);
    assert.equal(sim.balance, 500);
    assert.equal(sim.buildings.length, 14);
  }
  assert.equal(INDUSTRIAL_BUILDINGS.length, 14);
  assert.ok(['tower', 'warehouse', 'containers'].every(type => INDUSTRIAL_BUILDINGS.some(b => b.type === type)));
  sim.start({ missionId: 'missing', vehicleId: '__proto__' });
  assert.equal(sim.mission.id, 1);
  assert.equal(sim.vehicleId, 'dozer');
});

test('excavator locks its heading and body, and damages its forward AABB only at impact', () => {
  const sim = new Simulation().start({ missionId: 4, vehicleId: 'excavator' });
  const tower = sim.buildings[0], warehouse = sim.buildings[1];
  assert.equal(sim.useRam(), true);
  assert.deepEqual(sim.events[0], {
    type: 'ability-start', vehicleId: 'excavator', targetX: 195, targetY: 180, radius: 24, heading: 0,
  });
  assert.deepEqual(sim.player.attackTarget, { x: 195, y: 180, radius: 24, heading: 0 });
  advance(sim, 0.4 - STEP, { x: -1, y: 1 });
  assert.equal(tower.hp, 3);
  const impact = advance(sim, STEP, { x: -1, y: 1 });
  assert.equal(tower.hp, 0.5);
  assert.equal(warehouse.hp, 4);
  assert.equal(impact.filter(e => e.type === 'ability-impact').length, 1);
  assert.equal(sim.player.heading, 0);
  assert.equal(sim.player.x, 80);
  assert.equal(sim.player.y, 180);
  assert.equal(sim.useRam(), false);
  const after = advance(sim, 0.4, { x: -1, y: 1 });
  assert.equal(after.filter(e => e.type === 'hit').length, 0);
  assert.equal(sim.player.attackTarget, null);
  assert.equal(sim.player.abilityElapsed, 0.8);
});

test('excavator aiming away cannot hit buildings behind its bucket', () => {
  const sim = new Simulation().start({ missionId: 4, vehicleId: 'excavator' });
  sim.player.heading = Math.PI;
  sim.useRam();
  advance(sim, 0.8);
  assert.ok(sim.buildings.every(b => b.hp === b.maxHp));
});

test('wrecking ball damages every intersecting footprint once at the visible half-swing', () => {
  const sim = new Simulation().start({ missionId: 4, vehicleId: 'wrecker' });
  Object.assign(sim.player, { x: 250, y: 180, heading: 0 });
  sim.useRam();
  const before = advance(sim, 0.55 - STEP, { y: 1 });
  assert.equal(before.filter(e => e.type === 'hit').length, 0);
  const events = advance(sim, STEP, { y: 1 });
  assert.equal(events.filter(e => e.type === 'ability-impact').length, 1);
  assert.deepEqual(events.filter(e => e.type === 'hit').map(e => e.buildingId), ['industrial-1', 'industrial-2']);
  assert.ok(Math.abs(sim.buildings[1].hp - 2.6) < 1e-8);
  assert.ok(Math.abs(sim.buildings[2].hp - 0.6) < 1e-8);
  assert.equal(sim.buildings[0].hp, 3);
  assert.equal(sim.player.x, 250);
  assert.equal(sim.player.y, 180);
  const after = advance(sim, 0.55);
  assert.equal(after.filter(e => e.type === 'hit').length, 0);
  assert.equal(sim.player.ramTime, 0);
});

test('starter dozer passes through several nearby weak objects in one real ram', () => {
  const sim = new Simulation().start({ missionId: 2 });
  const shed = sim.buildings[0];
  sim.buildings = [180, 235].map((x, i) => ({ ...shed, id: `weak-${i}`, x, w: 40 }));
  sim.useRam();
  const events = advance(sim, 0.35);
  assert.ok(sim.buildings.every(b => b.hp === 0));
  assert.equal(events.filter(e => e.type === 'destroy').length, 2);
  assert.equal(sim.coins, 50);
});

test('tower fall and warehouse collapse damage real neighbours, with delayed finite rewards', () => {
  const sim = new Simulation().start({ missionId: 4 });
  const tower = sim.buildings[0], warehouse = sim.buildings[1], containers = sim.buildings[2];
  // Deliver two ordinary activations, then inspect the third at its contact frame.
  for (let n = 0; n < 2; n++) {
    if (sim.player.ramCooldown > 0) advance(sim, sim.player.ramCooldown + STEP);
    beside(sim, tower); sim.useRam(); advance(sim, 0.35);
  }
  advance(sim, sim.player.ramCooldown + STEP);
  beside(sim, tower); sim.useRam();
  while (tower.hp > 0) sim.update(STEP);
  const fallStart = sim.elapsed;
  assert.equal(warehouse.hp, 4);
  advance(sim, 0.45 - STEP);
  assert.equal(warehouse.hp, 4);
  const fallen = advance(sim, STEP);
  assert.equal(warehouse.hp, 0);
  assert.equal(containers.hp, 2);
  assert.ok(sim.elapsed - fallStart >= 0.45 - 1e-7);
  assert.ok(fallen.some(e => e.type === 'chain' && e.count === 2));
  const collapse = advance(sim, 0.2);
  assert.equal(containers.hp, 0);
  assert.ok(collapse.some(e => e.type === 'chain' && e.count === 3));
  assert.equal(sim.bestChain, 3);
  assert.equal(sim.destroyed, 3);
  assert.equal(sim.coins, 130 + 160 + 75);
  assert.equal(sim.score, 320 + 420 * 2 + 190 * 3 + 100 + 150);
  const coins = sim.coins;
  advance(sim, 2);
  assert.equal(sim.coins, coins);
  assert.equal(sim.destroyed, 3);
});

test('dense cascades visit each target once and cap a chain at six buildings', () => {
  const sim = new Simulation().start({ missionId: 2 });
  const tower = INDUSTRIAL_BUILDINGS[0], containers = INDUSTRIAL_BUILDINGS[2];
  sim.buildings = [{ ...tower, hitCooldown: 0, lastRam: -1 }, ...Array.from({ length: 10 }, (_, i) => ({
    ...containers, id: `dense-${i}`, x: 300 + i * 4, y: 180, hitCooldown: 0, lastRam: -1,
  }))];
  destroyWithRam(sim, sim.buildings[0]);
  const events = advance(sim, 2);
  assert.equal(sim.bestChain, 6);
  assert.equal(sim.destroyed, 6);
  assert.equal(sim.coins, 130 + 5 * 75);
  assert.equal(new Set(events.filter(e => e.type === 'destroy').map(e => e.buildingId)).size, 5);
  assert.equal(sim.buildings.filter(b => b.hp > 0).length, 5);
  advance(sim, 2);
  assert.equal(sim.destroyed, 6);
});

test('restart clears pending chain jobs, attack state and map damage, preserving wallet only', () => {
  const sim = new Simulation({ balance: 23 }).start({ missionId: 4 });
  destroyWithRam(sim, sim.buildings[0]);
  assert.ok(sim._collapses.length > 0);
  const balance = sim.balance, runId = sim.runId;
  sim.start({ missionId: 4, vehicleId: 'wrecker' });
  assert.notEqual(sim.runId, runId);
  advance(sim, 1);
  assert.equal(sim.balance, balance);
  assert.equal(sim.coins, 0);
  assert.equal(sim.bestChain, 0);
  assert.ok(sim.buildings.every(b => b.hp === b.maxHp));
  assert.equal(sim._collapses.length, 0);
  assert.equal(sim.attackTarget, null);
});

test('reduced replay currency and result snapshots never award a second time', () => {
  const sim = new Simulation({ balance: 10 }).start({ coinScale: 0.25 });
  sim.useRam(); advance(sim, 0.35);
  assert.equal(sim.coins, 6);
  assert.equal(sim.balance, 16);
  const a = sim.result(), b = sim.result();
  assert.deepEqual(a, b);
  a.coins = 999;
  assert.equal(sim.result().coins, 6);
  assert.equal(sim.balance, 16);
});

test('every mission expires at its own deadline, and a lost run stays frozen', () => {
  for (const mission of MISSIONS) {
    const sim = new Simulation().start({ missionId: mission.id, vehicleId: 'wrecker' });
    sim.update(mission.duration + 10);
    assert.equal(sim.phase, 'lost');
    assert.equal(sim.timeLeft, 0);
    assert.ok(Math.abs(sim.elapsed - mission.duration) < 1e-7);
    assert.equal(sim.events.filter(e => e.type === 'lose').length, 1);
    const result = sim.result();
    sim.update(1, { x: 1, ramPressed: true });
    assert.deepEqual(sim.result(), result);
    assert.equal(sim.useRam(), false);
  }
});

for (const mission of MISSIONS) {
  test(`mission ${mission.id} is continuously winnable with starter dozer and honest input`, async () => {
    const {driveDistrict}=await import('./helpers/drive.js');
    const sim=new Simulation().start({missionId:mission.id});const events=[];
    driveDistrict(sim,{tick:input=>{sim.update(STEP,input);events.push(...sim.events);}});
    assert.equal(sim.phase,'won');assert.ok(sim.progress>=mission.target);
    assert.ok(sim.destroyed>=mission.minDestroyed);assert.equal(sim.sector,mission.sectors-1);
    assert.ok(sim.elapsed>=45,'a contract requires meaningful clearance, not one opening combo');
    assert.ok(sim.timeLeft>0);assert.equal(events.filter(e=>e.type==='win').length,1);
    assert.equal(events.filter(e=>e.type==='sector').length,mission.sectors-1);
  });
}
