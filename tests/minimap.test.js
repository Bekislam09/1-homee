import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinimap } from '../src/smash/minimap.js';
import { iso } from '../src/smash/art.js';
import { Simulation } from '../src/smash/simulation.js';

function canvasFixture() {
  const fills = [];
  let points = [];
  const context = {
    clearRect() { fills.length = 0; },
    beginPath() { points = []; },
    moveTo(x, y) { points.push({ x, y }); },
    lineTo(x, y) { points.push({ x, y }); },
    closePath() {},
    fill() { fills.push({ color: this.fillStyle, points }); },
    stroke() {},
  };
  const canvas = { getContext: type => type === '2d' ? context : null };
  return { canvas, fills, map: createMinimap(canvas) };
}

test('minimap shows every current building and updates destruction state without mutating simulation', () => {
  const { canvas, fills, map } = canvasFixture();
  const sim = new Simulation().start();
  const initialHp = sim.buildings.map(building => building.hp);
  map.update(sim);
  assert.equal(canvas.width, 240);
  assert.equal(canvas.height, 160);
  assert.equal(fills.length, 16, 'one block, fourteen buildings, one player');
  assert.ok(fills.slice(1, 15).every(shape => shape.color === '#2878BC'));
  assert.deepEqual(sim.buildings.map(building => building.hp), initialHp);

  sim.buildings[0].hp = 0;
  sim.buildings[1].hp = sim.buildings[1].maxHp / 2;
  map.update(sim);
  assert.equal(fills[1].color, '#A2B6C6');
  assert.equal(fills[2].color, '#FFD34E');
  assert.equal(fills[3].color, '#2878BC');

  sim.start({ missionId: 5 });
  map.update(sim);
  assert.ok(fills.slice(1, 15).every(shape => shape.color === '#2878BC'), 'a fresh block clears old damage');
});

test('player arrow follows the same isometric heading as the main view and stays inside the map', () => {
  const { fills, map } = canvasFixture();
  const sim = new Simulation().start();
  const scale = 212 / (1000 * Math.sqrt(3));
  const top = (160 - 1000 * scale) / 2;
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
    sim.player.heading = heading;
    map.update(sim);
    const arrow = fills.at(-1).points;
    const center = iso(sim.player.x, sim.player.y);
    const direction = iso(Math.cos(heading), Math.sin(heading));
    const tipX = arrow[0].x - (120 + center.x * scale);
    const tipY = arrow[0].y - (top + center.y * scale);
    assert.ok(Math.abs(tipX * direction.y - tipY * direction.x) < 1e-10);
    assert.ok(tipX * direction.x + tipY * direction.y > 0, 'nose points forward');
    assert.ok(Math.abs(Math.hypot(tipX, tipY) - 10) < 1e-10);
  }
  for (const x of [20, 980]) for (const y of [20, 980]) {
    Object.assign(sim.player, { x, y });
    map.update(sim);
    for (const point of fills.at(-1).points) {
      assert.ok(point.x >= 0 && point.x <= 240);
      assert.ok(point.y >= 0 && point.y <= 160);
    }
  }
});
