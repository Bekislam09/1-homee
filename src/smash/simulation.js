/** Gameplay stays in Cartesian world coordinates; the renderer owns projection. */
export const WORLD_SIZE = 1000;
export const GOAL = 1000;
export const DURATION = 90;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const BUILDING_TYPES = {
  shed: { maxHp: 1, reward: 25, points: 100 },
  kiosk: { maxHp: 2, reward: 60, points: 170 },
  house: { maxHp: 3, reward: 120, points: 260 },
};
const layouts = [
  ['shed', 'kiosk', 'house', null],
  ['kiosk', 'shed', 'kiosk', 'house'],
  ['house', 'kiosk', 'shed', 'kiosk'],
  [null, 'house', 'kiosk', 'shed'],
];
export const BUILDINGS = layouts.flatMap((row, j) => row.flatMap((type, i) => type ? [{
  id: `building-${j}-${i}`, type, x: 180 + i * 220, y: 180 + j * 220,
  w: 96, d: 86, ...BUILDING_TYPES[type], hp: BUILDING_TYPES[type].maxHp,
}] : []));

const RADIUS = 20;
const BASE_SPEED = 180;
const RAM_SPEED = 400;
const RAM_DURATION = 0.3;
const RAM_COOLDOWN = 2.2;
const COMBO_WINDOW = 7;
const HIT_COOLDOWN = 0.75;
const EPSILON = 1e-7;

/** Circle/AABB contact normal points out of the building toward the player. */
function contact(player, building) {
  const left = building.x - building.w / 2, right = building.x + building.w / 2;
  const top = building.y - building.d / 2, bottom = building.y + building.d / 2;
  const x = clamp(player.x, left, right), y = clamp(player.y, top, bottom);
  const dx = player.x - x, dy = player.y - y, length = Math.hypot(dx, dy);
  if (length >= RADIUS) return null;
  if (length > EPSILON) return { nx: dx / length, ny: dy / length, depth: RADIUS - length };
  // This also makes correction safe after a large input step or a restored position.
  const sides = [
    { nx: -1, ny: 0, depth: player.x - left + RADIUS },
    { nx: 1, ny: 0, depth: right - player.x + RADIUS },
    { nx: 0, ny: -1, depth: player.y - top + RADIUS },
    { nx: 0, ny: 1, depth: bottom - player.y + RADIUS },
  ];
  return sides.reduce((best, side) => side.depth < best.depth ? side : best);
}

export class Simulation {
  constructor({ balance = 0 } = {}) {
    this.balance = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
    this.reset();
  }

  reset() {
    this.phase = 'menu';
    this.timeLeft = DURATION;
    this.score = 0;
    this.coins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.destroyed = 0;
    this.events = [];
    this.buildings = BUILDINGS.map(building => ({ ...building, hitCooldown: 0, lastRam: -1 }));
    this.player = {
      x: 80, y: 180, vx: 0, vy: 0, heading: 0, speed: 0,
      ramTime: 0, ramCooldown: 0,
    };
    this._comboTime = 0;
    this._ramSerial = 0;
    this._ramHeading = 0;
    this._ramHeld = false;
    return this;
  }

  start() {
    this.reset();
    this.phase = 'playing';
    return this;
  }

  useRam() {
    const p = this.player;
    if (this.phase !== 'playing' || p.ramCooldown > EPSILON) return false;
    p.ramTime = RAM_DURATION;
    p.ramCooldown = RAM_COOLDOWN;
    this._ramHeading = p.heading;
    this._ramSerial++;
    this.events.push({ type: 'ram', x: p.x, y: p.y });
    return true;
  }

  update(dt, input = {}) {
    this.events = [];
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    let ix = Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0;
    let iy = Number.isFinite(input.y) ? clamp(input.y, -1, 1) : 0;
    const length = Math.hypot(ix, iy);
    if (length > 1) { ix /= length; iy /= length; }
    if (input.ramPressed || (input.ram && !this._ramHeld)) {
      if (length > 0.1 && this.player.ramTime <= 0) this.player.heading = Math.atan2(iy, ix);
      this.useRam();
    }
    this._ramHeld = Boolean(input.ram);
    // Substeps keep collisions and the timer reliable at low frame rates, too.
    let remaining = Math.min(dt, this.timeLeft);
    while (remaining > EPSILON && this.phase === 'playing') {
      const step = Math.min(remaining, 1 / 60);
      this._step(step, ix, iy);
      remaining -= step;
    }
  }

  _step(dt, ix, iy) {
    const p = this.player;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    p.ramCooldown = Math.max(0, p.ramCooldown - dt);
    this._comboTime = Math.max(0, this._comboTime - dt);
    if (this._comboTime === 0) this.combo = 0;
    for (const building of this.buildings) building.hitCooldown = Math.max(0, building.hitCooldown - dt);

    const ramming = p.ramTime > EPSILON;
    if (ramming) {
      p.heading = this._ramHeading;
      p.vx = Math.cos(p.heading) * RAM_SPEED;
      p.vy = Math.sin(p.heading) * RAM_SPEED;
    } else {
      const response = 1 - Math.exp(-dt * (Math.hypot(ix, iy) > 0.01 ? 9 : 12));
      p.vx += (ix * BASE_SPEED - p.vx) * response;
      p.vy += (iy * BASE_SPEED - p.vy) * response;
      if (Math.hypot(p.vx, p.vy) > 1) p.heading = Math.atan2(p.vy, p.vx);
      else if (Math.hypot(ix, iy) > 0.1) p.heading = Math.atan2(iy, ix);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    for (const building of this.buildings) {
      if (building.hp <= 0) continue;
      const c = contact(p, building);
      if (!c) continue;
      const forward = -(Math.cos(p.heading) * c.nx + Math.sin(p.heading) * c.ny);
      const impact = -(p.vx * c.nx + p.vy * c.ny);
      // Sustained forward pressure chips slowly; a ram delivers one full hit.
      const pushing = -(ix * c.nx + iy * c.ny) > 0.5;
      const ready = ramming ? building.lastRam !== this._ramSerial : building.hitCooldown <= EPSILON;
      if (forward > 0.45 && ready && (ramming || impact > 45 || pushing)) {
        const damage = ramming ? 1 : 0.34;
        building.hp = Math.max(0, building.hp - damage);
        if (building.hp < EPSILON) building.hp = 0;
        building.hitCooldown = HIT_COOLDOWN;
        if (ramming) building.lastRam = this._ramSerial;
        this.events.push({ type: 'hit', buildingId: building.id, x: building.x, y: building.y, damage, hp: building.hp, strong: ramming });
        if (building.hp === 0) this._destroy(building);
      }
      if (building.hp > 0) {
        p.x += c.nx * (c.depth + 0.001);
        p.y += c.ny * (c.depth + 0.001);
        const inward = p.vx * c.nx + p.vy * c.ny;
        if (inward < 0) { p.vx -= c.nx * inward; p.vy -= c.ny * inward; }
      }
    }
    const bx = clamp(p.x, RADIUS, WORLD_SIZE - RADIUS);
    const by = clamp(p.y, RADIUS, WORLD_SIZE - RADIUS);
    if (bx !== p.x) p.vx = 0;
    if (by !== p.y) p.vy = 0;
    p.x = bx;
    p.y = by;
    p.speed = Math.hypot(p.vx, p.vy);
    p.ramTime = Math.max(0, p.ramTime - dt);
    if (this.phase === 'playing' && this.timeLeft < EPSILON) {
      this.timeLeft = 0;
      this.phase = 'lost';
      this.events.push({ type: 'lose', x: p.x, y: p.y });
    }
  }

  _destroy(building) {
    this.destroyed++;
    this.combo = Math.min(3, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this._comboTime = COMBO_WINDOW;
    const points = building.points * this.combo;
    this.score += points;
    this.coins += building.reward;
    this.balance += building.reward;
    this.events.push({
      type: 'destroy', buildingId: building.id, x: building.x, y: building.y,
      coins: building.reward, points, combo: this.combo,
    });
    if (this.score >= GOAL && this.phase === 'playing') {
      this.phase = 'won';
      this.events.push({ type: 'win', x: this.player.x, y: this.player.y });
    }
  }
}
