import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, DURATION, GOAL, WORLD_SIZE, Simulation, distance } from '../src/smash/simulation.js';

const STEP = 1 / 60;
const advance = (sim, seconds, input = {}) => {
  const events = [];
  for (let left = seconds; left > 1e-8; left -= STEP) {
    sim.update(Math.min(STEP, left), input);
    events.push(...sim.events);
  }
  return events;
};

// Unit tests place the player beside a subject; the complete mission tests below
// deliberately use only continuous movement and the same input API as the game.
function parkBeside(sim, building, heading = 0) {
  Object.assign(sim.player, { x: building.x - building.w / 2 - 22, y: building.y, vx: 0, vy: 0, speed: 0, heading });
}

function ramAt(sim, building) {
  if (sim.player.ramCooldown > 0) advance(sim, sim.player.ramCooldown + STEP);
  parkBeside(sim, building);
  assert.equal(sim.useRam(), true);
  return advance(sim, 0.35);
}

test('compact map contains 14 varied buildings and enough unmultiplied points', () => {
  assert.equal(BUILDINGS.length, 14);
  assert.equal(new Set(BUILDINGS.map(b => b.id)).size, 14);
  assert.deepEqual(new Set(BUILDINGS.map(b => b.type)), new Set(['shed', 'kiosk', 'house']));
  assert.ok(BUILDINGS.reduce((sum, b) => sum + b.points, 0) > GOAL * 2);
  assert.ok(!BUILDINGS.some(b => b.x === 840 && b.y === 180));
  assert.ok(!BUILDINGS.some(b => b.x === 180 && b.y === 840));
  for (const b of BUILDINGS) {
    assert.ok(b.x > b.w && b.x < WORLD_SIZE - b.w);
    assert.equal(b.hp, b.maxHp);
  }
});

test('menu is idle and start gives a fresh ninety-second mission', () => {
  const sim = new Simulation({ balance: 17 });
  sim.update(10, { x: 1, ram: true });
  assert.equal(sim.phase, 'menu');
  assert.equal(sim.player.x, 80);
  assert.equal(sim.timeLeft, DURATION);
  assert.equal(sim.useRam(), false);
  sim.start();
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.balance, 17);
  advance(sim, 1);
  assert.ok(Math.abs(sim.timeLeft - 89) < 1e-7);
});

test('diagonal movement is normalized and analog movement preserves magnitude', () => {
  const cardinal = new Simulation().start(), diagonal = new Simulation().start(), analog = new Simulation().start();
  for (const sim of [cardinal, diagonal, analog]) Object.assign(sim.player, { x: 500, y: 50 });
  const origin = { x: 500, y: 50 };
  advance(cardinal, 0.3, { x: 1 });
  advance(diagonal, 0.3, { x: 1, y: 1 });
  advance(analog, 0.3, { x: 0.5 });
  assert.ok(Math.abs(distance(cardinal.player, origin) - distance(diagonal.player, origin)) < 1e-6);
  assert.ok(Math.abs(distance(analog.player, origin) * 2 - distance(cardinal.player, origin)) < 1e-6);
  assert.ok(Math.abs(diagonal.player.heading - Math.PI / 4) < 1e-7);
  advance(cardinal, 1);
  assert.ok(cardinal.player.speed < 0.01);
});

test('world bounds contain the entire player body, including while ramming', () => {
  const sim = new Simulation().start();
  advance(sim, 6, { x: -1, y: -1, ram: true });
  assert.ok(sim.player.x >= 20 && sim.player.y >= 20);
  advance(sim, 8, { x: 0, y: 1 });
  assert.ok(sim.player.y <= WORLD_SIZE - 20);
  assert.ok(Number.isFinite(sim.player.speed));
});

test('ram from rest moves forward, damages once, and enforces its cooldown', () => {
  const sim = new Simulation().start();
  const shed = sim.buildings.find(b => b.type === 'shed');
  assert.equal(sim.useRam(), true);
  assert.equal(sim.useRam(), false);
  const events = advance(sim, 0.35);
  assert.equal(shed.hp, 0);
  assert.equal(events.filter(e => e.type === 'hit').length, 1);
  assert.equal(sim.coins, 25);
  assert.equal(sim.useRam(), false);
  advance(sim, 1.9);
  assert.equal(sim.useRam(), true);
});

test('holding ram does not trigger extra activations without a new press', () => {
  const sim = new Simulation().start();
  const events = advance(sim, 5, { ram: true });
  assert.equal(events.filter(e => e.type === 'ram').length, 1);
  sim.update(STEP, { ram: false });
  sim.update(STEP, { ram: true });
  assert.equal(sim.events[0].type, 'ram');
});

test('normal collisions chip buildings and are weaker than a ram', () => {
  const normal = new Simulation().start(), strong = new Simulation().start();
  const events = advance(normal, 0.55, { x: 1 });
  advance(strong, 0.55, { x: 1, ram: true });
  assert.ok(Math.abs(normal.buildings[0].hp - 0.66) < 1e-7);
  assert.equal(strong.buildings[0].hp, 0);
  assert.equal(events.filter(e => e.type === 'hit').length, 1);
  assert.equal(events.find(e => e.type === 'hit').strong, false);
});

test('intact building blocks a fast ram without tunneling or duplicate damage', () => {
  const sim = new Simulation().start();
  const kiosk = sim.buildings.find(b => b.type === 'kiosk');
  parkBeside(sim, kiosk);
  sim.useRam();
  // A single long outer frame still uses collision-safe substeps.
  sim.update(0.3);
  assert.equal(kiosk.hp, 1);
  assert.equal(sim.events.filter(e => e.type === 'hit').length, 1);
  assert.ok(sim.player.x <= kiosk.x - kiosk.w / 2 - 20);
  assert.equal(sim.coins, 0);
});

test('a side contact cannot damage a building with a sideways-facing bucket', () => {
  const sim = new Simulation().start();
  const kiosk = sim.buildings.find(b => b.type === 'kiosk');
  parkBeside(sim, kiosk, Math.PI / 2);
  sim.player.x += 3;
  sim.useRam();
  advance(sim, 0.2);
  assert.equal(kiosk.hp, kiosk.maxHp);
  assert.equal(sim.coins, 0);
});

for (const [type, hits, reward] of [['shed', 1, 25], ['kiosk', 2, 60], ['house', 3, 120]]) {
  test(`${type} requires ${hits} strong hit(s), then awards exactly ${reward} coins`, () => {
    const sim = new Simulation({ balance: 13 }).start();
    const b = sim.buildings.find(b => b.type === type);
    for (let hit = 1; hit <= hits; hit++) {
      ramAt(sim, b);
      assert.equal(b.hp, hits - hit);
      assert.equal(sim.coins, hit < hits ? 0 : reward);
    }
    assert.equal(sim.destroyed, 1);
    assert.equal(sim.balance, 13 + reward);
    ramAt(sim, b);
    assert.equal(sim.balance, 13 + reward);
    assert.equal(sim.destroyed, 1);
  });
}

test('combo caps at three, multiplies score only, and expires after seven seconds', () => {
  const sim = new Simulation().start();
  const sheds = sim.buildings.filter(b => b.type === 'shed');
  const combos = [];
  for (const b of sheds) {
    const events = ramAt(sim, b);
    combos.push(events.find(e => e.type === 'destroy').combo);
  }
  assert.deepEqual(combos, [1, 2, 3, 3]);
  assert.equal(sim.score, 900);
  assert.equal(sim.coins, 100);
  assert.equal(sim.bestCombo, 3);
  advance(sim, 7.1);
  assert.equal(sim.combo, 0);
  assert.equal(sim.bestCombo, 3);
});

test('time expiry loses once and freezes gameplay until a replay', () => {
  const sim = new Simulation().start();
  sim.update(DURATION);
  assert.equal(sim.phase, 'lost');
  assert.equal(sim.timeLeft, 0);
  assert.equal(sim.events.filter(e => e.type === 'lose').length, 1);
  const before = { x: sim.player.x, y: sim.player.y };
  sim.update(1, { x: 1, ram: true });
  assert.deepEqual({ x: sim.player.x, y: sim.player.y }, before);
  assert.deepEqual(sim.events, []);
});

test('replay restores every building, timer, score and combo while retaining earned currency', () => {
  const sim = new Simulation({ balance: 20 }).start();
  ramAt(sim, sim.buildings[0]);
  assert.equal(sim.balance, 45);
  sim.start();
  assert.equal(sim.balance, 45);
  assert.equal(sim.coins, 0);
  assert.equal(sim.score, 0);
  assert.equal(sim.destroyed, 0);
  assert.equal(sim.combo, 0);
  assert.equal(sim.timeLeft, DURATION);
  assert.ok(sim.buildings.every(b => b.hp === b.maxHp));
  assert.ok(BUILDINGS.every(b => b.hp === b.maxHp));
  assert.equal(sim.player.ramCooldown, 0);
  sim.reset();
  assert.equal(sim.phase, 'menu');
  assert.equal(sim.balance, 45);
});

test('a complete continuous run wins using movement and real ram presses', () => {
  const sim = new Simulation().start();
  const seen = [];
  for (let frame = 0; frame < 25 * 60 && sim.phase === 'playing'; frame++) {
    sim.update(STEP, { x: 1, y: 0, ram: sim.player.ramCooldown < 1e-7 });
    seen.push(...sim.events);
  }
  assert.equal(sim.phase, 'won');
  assert.ok(sim.score >= GOAL);
  assert.equal(sim.destroyed, 3);
  assert.deepEqual(sim.buildings.filter(b => b.hp === 0).map(b => b.type), ['shed', 'kiosk', 'house']);
  assert.equal(sim.coins, 205);
  assert.equal(seen.filter(e => e.type === 'win').length, 1);
  assert.ok(sim.timeLeft > 70);
});

test('mission is winnable without any combo, teleports, or direct damage', () => {
  const sim = new Simulation().start();
  const moveTo = (x, y) => {
    for (let frame = 0; frame < 1000 && sim.phase === 'playing'; frame++) {
      const dx = x - sim.player.x, dy = y - sim.player.y, d = Math.hypot(dx, dy);
      if (d < 3 && sim.player.speed < 5) return;
      const magnitude = Math.min(1, d / 30);
      sim.update(STEP, { x: dx / (d || 1) * magnitude, y: dy / (d || 1) * magnitude });
    }
    assert.fail('navigation did not reach the waypoint');
  };
  const attack = (x, y) => {
    const b = sim.buildings.find(b => b.x === x && b.y === y);
    for (let frame = 0; frame < 1200 && b.hp > 0 && sim.phase === 'playing'; frame++) {
      const dx = x - sim.player.x, dy = y - sim.player.y, d = Math.hypot(dx, dy);
      sim.update(STEP, { x: dx / d, y: dy / d, ram: sim.player.ramCooldown < 1e-7 });
    }
    assert.equal(b.hp, 0, 'all damage must come from actual collisions');
    assert.equal(sim.combo, 1, 'each previous combo must have expired');
    if (sim.phase === 'playing') advance(sim, 7.1);
  };
  attack(180, 180);
  attack(400, 180);
  attack(620, 180);
  moveTo(730, 180);
  moveTo(840, 290);
  attack(840, 400);
  moveTo(840, 400);
  attack(620, 400);
  attack(400, 400);
  assert.equal(sim.phase, 'won');
  assert.equal(sim.bestCombo, 1);
  assert.equal(sim.score, 1060);
  assert.equal(sim.destroyed, 6);
  assert.equal(sim.coins, 410);
  assert.ok(sim.timeLeft > 30);
});

test('buffered short ram presses are consumed even after the input was released', () => {
  const sim = new Simulation().start();
  sim.update(1 / 60, { ram: false, ramPressed: true });
  assert.ok(sim.player.ramTime > 0);
  assert.equal(sim.events[0].type, 'ram');
});
