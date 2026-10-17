import { WORLD_SIZE } from './simulation.js';

const WIDTH = 240;
const HEIGHT = 160;
const MAX_BUILDINGS = 14;
const ISO_X = Math.sqrt(3) / 2;
const SCALE = (WIDTH - 28) / (WORLD_SIZE * Math.sqrt(3));
const TOP = (HEIGHT - WORLD_SIZE * SCALE) / 2;

// Keep the same ground projection as art.js, without allocating point objects
// in the HUD update. The map always shows the whole current block.
const mapX = (x, y) => WIDTH / 2 + (x - y) * ISO_X * SCALE;
const mapY = (x, y) => TOP + (x + y) * .5 * SCALE;

/** A passive 240×160 map. Its accessible caption belongs to the surrounding UI. */
export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The minimap requires a 2D canvas context.');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  function groundQuad(x, y, width, depth) {
    ctx.beginPath();
    ctx.moveTo(mapX(x, y), mapY(x, y));
    ctx.lineTo(mapX(x + width, y), mapY(x + width, y));
    ctx.lineTo(mapX(x + width, y + depth), mapY(x + width, y + depth));
    ctx.lineTo(mapX(x, y + depth), mapY(x, y + depth));
    ctx.closePath();
  }

  return {
    update(sim) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      groundQuad(0, 0, WORLD_SIZE, WORLD_SIZE);
      ctx.fillStyle = '#E8F4FC';
      ctx.fill();
      ctx.strokeStyle = '#A4C4DD';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Streets sit between the real building rows, rather than suggesting
      // targets or routes that the simulation does not contain.
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      for (let index = 0; index < 5; index++) {
        const street = index === 0 ? 65 : index === 4 ? 950 : 70 + index * 220;
        const start = sim.mission?.district === 'industrial' && index > 0 && index < 4 ? 290 : 0;
        ctx.beginPath();
        ctx.moveTo(mapX(street, start), mapY(street, start));
        ctx.lineTo(mapX(street, WORLD_SIZE), mapY(street, WORLD_SIZE));
        ctx.moveTo(mapX(0, street), mapY(0, street));
        ctx.lineTo(mapX(WORLD_SIZE, street), mapY(WORLD_SIZE, street));
        ctx.stroke();
      }

      const count = Math.min(sim.buildings.length, MAX_BUILDINGS);
      for (let index = 0; index < count; index++) {
        const building = sim.buildings[index];
        const destroyed = building.hp <= 0;
        groundQuad(building.x - building.w / 2, building.y - building.d / 2, building.w, building.d);
        ctx.fillStyle = destroyed ? '#A2B6C6' : building.hp < building.maxHp ? '#FFD34E' : '#2878BC';
        ctx.fill();
        ctx.strokeStyle = destroyed ? '#8FA7BA' : '#183D64';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      const player = sim.player;
      const x = mapX(player.x, player.y), y = mapY(player.x, player.y);
      const cos = Math.cos(player.heading), sin = Math.sin(player.heading);
      const projectedX = (cos - sin) * ISO_X, projectedY = (cos + sin) * .5;
      const length = Math.hypot(projectedX, projectedY);
      const dx = projectedX / length, dy = projectedY / length;
      ctx.beginPath();
      ctx.moveTo(x + dx * 10, y + dy * 10);
      ctx.lineTo(x - dx * 6 - dy * 6, y - dy * 6 + dx * 6);
      ctx.lineTo(x - dx * 2, y - dy * 2);
      ctx.lineTo(x - dx * 6 + dy * 6, y - dy * 6 - dx * 6);
      ctx.closePath();
      ctx.fillStyle = '#FFD34E';
      ctx.fill();
      ctx.strokeStyle = '#183D64';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    },
  };
}
