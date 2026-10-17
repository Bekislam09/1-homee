import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, BUILDINGS, INDUSTRIAL_BUILDINGS } from '../src/smash/simulation.js';
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

const fixture = (id, x, y, w = 20, d = 40) => ({
  ...BUILDINGS[0], id, x, y, w, d, type: 'kiosk', hp: 4, maxHp: 4,
  hitCooldown: 0, lastRam: -1,
});

test('excavator strikes only the closest physical object even when both overlap the nominal bucket', () => {
  const sim = new Simulation().start({ vehicleId: 'excavator' });
  sim.buildings = [fixture('far', 205, 180), fixture('near', 180, 180)];
  sim.useRam();
  const events = advance(sim, .8);
  assert.equal(sim.buildings[0].hp, 4);
  assert.equal(sim.buildings[1].hp, 1.5);
  assert.deepEqual(events.filter(e => e.type === 'hit').map(e => e.buildingId), ['near']);
});

test('a narrow nearer building blocks an excavator strike and clamps its visible target', () => {
  const sim = new Simulation().start({ vehicleId: 'excavator' });
  sim.buildings = [fixture('behind', 195, 180), fixture('blocker', 120, 180)];
  sim.useRam();
  assert.ok(sim.player.attackTarget.x >= 86 && sim.player.attackTarget.x <= 130);
  assert.equal(sim.player.attackTarget.y, 180);
  const target = { ...sim.player.attackTarget };
  const events = advance(sim, .4);
  assert.equal(sim.buildings[0].hp, 4);
  assert.equal(sim.buildings[1].hp, 1.5);
  assert.ok(events.some(e => e.type === 'ability-impact' && e.targetX === target.x && e.targetY === target.y));
  assert.deepEqual(sim.player.attackTarget, target);
});

test('swept bucket handles rounded corners without treating an expanded-box corner as solid', () => {
  const sim = new Simulation().start({ vehicleId: 'excavator' });
  // The nominal center is (195, 180). Its expanded bounding box reaches the
  // target, but the actual circle misses this corner by more than 24 units.
  sim.buildings = [fixture('missed-corner', 226, 212, 20, 20)];
  sim.useRam();
  const events = advance(sim, .8);
  assert.equal(sim.buildings[0].hp, 4);
  assert.equal(events.filter(e => e.type === 'hit').length, 0);
});

test('a locked excavator attack cannot jump behind a target removed during its windup', () => {
  const sim = new Simulation().start({ vehicleId: 'excavator' });
  sim.buildings = [fixture('front', 150, 180), fixture('behind', 195, 180)];
  sim.useRam();
  // Unit fixture represents a separate pending collapse removing the target.
  sim.buildings[0].hp = 0;
  const events = advance(sim, .8);
  assert.equal(sim.buildings[1].hp, 4);
  assert.equal(events.filter(e => e.type === 'hit').length, 0);
});

for (const district of ['town', 'industrial']) for (const vehicleId of Object.keys(VEHICLES)) {
  test(`free destruction: ${district}/${vehicleId} keeps real destruction and never earns permanent coins`, () => {
    const sim = new Simulation({ balance: 987 }).start({ mode: 'free', district, vehicleId });
    assert.equal(sim.freeMode, true);
    assert.equal(sim.timeLeft, Infinity);
    assert.equal(sim.mission.district, district);
    assert.deepEqual(sim.buildings.map(b => b.id), (district === 'town' ? BUILDINGS : INDUSTRIAL_BUILDINGS).map(b => b.id));
    const events = [];
    for (let frame = 0; frame < 60 * 60 && sim.destroyed < 3; frame++) {
      sim.update(STEP, { x: 1, ram: sim.player.ramCooldown < 1e-7 });
      events.push(...sim.events);
    }
    assert.ok(sim.score > 0);
    assert.ok(sim.destroyed >= 3);
    assert.ok(events.some(e => e.type === 'destroy'));
    assert.ok(events.filter(e => e.type === 'destroy').every(e => e.coins === 0 && e.points > 0));
    assert.equal(events.some(e => e.type === 'win' || e.type === 'lose'), false);
    assert.equal(sim.coins, 0);
    assert.equal(sim.balance, 987);
    assert.equal(sim.result().won, false);
    advance(sim, 181);
    assert.equal(sim.timeLeft, Infinity);
    assert.equal(sim.phase, 'playing');
    assert.equal(sim.balance, 987);
    const oldRun = sim.runId;
    sim.start({ mode: 'free', district, vehicleId });
    assert.notEqual(sim.runId, oldRun);
    assert.equal(sim.balance, 987);
    assert.equal(sim.score, 0);
    assert.equal(sim.destroyed, 0);
    assert.ok(sim.buildings.every(b => b.hp === b.maxHp));
  });
}

test('free mode cannot mutate shared mission content and ordinary mode restores timed rewards', () => {
  const before = structuredClone(MISSIONS);
  const sim = new Simulation({ balance: 10 }).start({ mode: 'free', district: 'industrial' });
  assert.equal(sim.mission.district, 'industrial');
  assert.deepEqual(MISSIONS, before);
  sim.start({ mode: 'unknown', district: 'industrial' });
  assert.equal(sim.freeMode, false);
  assert.equal(sim.mission.district, 'town');
  assert.equal(sim.timeLeft, MISSIONS[0].duration);
  sim.useRam();
  advance(sim, .35);
  assert.equal(sim.balance, 35);
  assert.equal(sim.coins, 25);
});

test('ten repeated map restores clear all delayed collapse and attack state', () => {
  const sim = new Simulation({ balance: 123 });
  const runIds = new Set();
  for (let repeat = 0; repeat < 10; repeat++) {
    sim.start({ mode: 'free', district: 'industrial' });
    runIds.add(sim.runId);
    const tower = sim.buildings[0];
    while (tower.hp > 0) {
      if (sim.player.ramCooldown > 0) advance(sim, sim.player.ramCooldown + STEP);
      Object.assign(sim.player, { x: tower.x - tower.w / 2 - 22, y: tower.y, vx: 0, vy: 0, heading: 0 });
      sim.useRam();
      while (tower.hp > 0 && sim.player.ramTime > 0) sim.update(STEP);
    }
    assert.ok(sim._collapses.length > 0);
    sim.start({ mode: 'free', district: 'industrial', vehicleId: 'excavator' });
    assert.equal(sim._collapses.length, 0);
    assert.equal(sim.attackTarget, null);
    assert.equal(sim.player.attackTarget, null);
    assert.equal(sim.player.ramTime, 0);
    assert.equal(sim._pointTargetId, null);
    assert.equal(sim.balance, 123);
    advance(sim, 1);
    assert.equal(sim.destroyed, 0);
    assert.ok(sim.buildings.every(b => b.hp === b.maxHp));
  }
  assert.equal(runIds.size, 10);
});

for(const vehicleId of ['excavator','wrecker','roller','drill'])for(const mission of MISSIONS){
  test(`mission ${mission.id} remains continuously winnable with ${vehicleId}`,async()=>{
    const {driveDistrict}=await import('./helpers/drive.js');
    const sim=new Simulation().start({missionId:mission.id,vehicleId});driveDistrict(sim);
    assert.equal(sim.phase,'won');assert.ok(sim.timeLeft>0);
    assert.ok(sim.progress>=mission.target);assert.ok(sim.destroyed>=mission.minDestroyed);
  });
}
