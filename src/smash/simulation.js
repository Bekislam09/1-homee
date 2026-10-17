import { VEHICLES, getMission } from './content.js';

/** Gameplay stays in Cartesian world coordinates; the renderer owns projection. */
export const WORLD_SIZE = 1000;
export const GOAL = getMission(1).target;
export const DURATION = getMission(1).duration;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const BUILDING_TYPES = {
  shed: { maxHp: 1, reward: 25, points: 100 },
  kiosk: { maxHp: 2, reward: 60, points: 170 },
  house: { maxHp: 3, reward: 120, points: 260 },
  warehouse: { maxHp: 4, reward: 160, points: 420, collapseRadius: 190 },
  tower: { maxHp: 3, reward: 130, points: 320, fallHeading: 0 },
  containers: { maxHp: 2, reward: 75, points: 190, collapseRadius: 190 },
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

// The opening tower falls east into a warehouse, which collapses into the
// containers. These distances are shared by the visible map and real damage.
export const INDUSTRIAL_BUILDINGS = [
  ['tower', 180, 180], ['warehouse', 340, 180], ['containers', 500, 180], ['shed', 760, 180],
  ['house', 180, 400], ['warehouse', 400, 400], ['tower', 620, 400], ['containers', 840, 400],
  ['containers', 180, 620], ['kiosk', 400, 620], ['warehouse', 620, 620], ['shed', 840, 620],
  ['tower', 400, 840], ['containers', 620, 840],
].map(([type, x, y], i) => ({
  id: `industrial-${i}`, type, x, y, w: type === 'warehouse' ? 100 : 96, d: 86,
  ...BUILDING_TYPES[type], hp: BUILDING_TYPES[type].maxHp,
}));

const RADIUS = 20;
const RAM_SPEED = 400;
const COMBO_WINDOW = 7;
const HIT_COOLDOWN = 0.75;
const EPSILON = 1e-7;
const CHAIN_LIMIT = 6;
let runSequence = 0;

function inCircle(x, y, radius, building) {
  const bx = clamp(x, building.x - building.w / 2, building.x + building.w / 2);
  const by = clamp(y, building.y - building.d / 2, building.y + building.d / 2);
  return Math.hypot(x - bx, y - by) <= radius + EPSILON;
}

function rayBox(x, y, dx, dy, reach, left, top, right, bottom) {
  let entry = 0, exit = reach;
  for (let axis = 0; axis < 2; axis++) {
    const origin = axis ? y : x, direction = axis ? dy : dx;
    const min = axis ? top : left, max = axis ? bottom : right;
    if (Math.abs(direction) < EPSILON) {
      if (origin < min || origin > max) return Infinity;
    } else {
      const first = (min - origin) / direction, last = (max - origin) / direction;
      entry = Math.max(entry, Math.min(first, last));
      exit = Math.min(exit, Math.max(first, last));
      if (entry > exit + EPSILON) return Infinity;
    }
  }
  return entry;
}

/** Exact swept circle/AABB entry: two edge strips and four rounded corners. */
function bucketEntry(x, y, dx, dy, reach, radius, building) {
  const left = building.x - building.w / 2, right = building.x + building.w / 2;
  const top = building.y - building.d / 2, bottom = building.y + building.d / 2;
  if (inCircle(x, y, radius, building)) return 0;
  let entry = Math.min(
    rayBox(x, y, dx, dy, reach, left - radius, top, right + radius, bottom),
    rayBox(x, y, dx, dy, reach, left, top - radius, right, bottom + radius),
  );
  for (let corner = 0; corner < 4; corner++) {
    const cx = corner & 1 ? right : left, cy = corner & 2 ? bottom : top;
    const ox = x - cx, oy = y - cy;
    const along = ox * dx + oy * dy;
    const discriminant = along * along - (ox * ox + oy * oy - radius * radius);
    if (discriminant < 0) continue;
    const distance = -along - Math.sqrt(discriminant);
    if (distance >= 0 && distance <= reach + EPSILON) entry = Math.min(entry, distance);
  }
  return entry;
}

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

  reset({ missionId = 1, vehicleId = 'dozer', coinScale = 1, mode = 'mission', district } = {}) {
    this.mode = mode === 'free' ? 'free' : 'mission';
    const mission = getMission(missionId);
    this.mission = this.freeMode ? { ...mission, district: district === 'industrial' ? 'industrial' : 'town' } : mission;
    this.vehicleId = Object.hasOwn(VEHICLES, vehicleId) ? vehicleId : 'dozer';
    this.vehicle = VEHICLES[this.vehicleId];
    this.coinScale = this.freeMode ? 0 : Number.isFinite(coinScale) ? clamp(coinScale, 0, 1) : 1;
    this.phase = 'menu';
    this.timeLeft = this.freeMode ? Infinity : this.mission.duration;
    this.elapsed = 0;
    this.runId = null;
    this.score = 0;
    this.coins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.bestChain = 0;
    this.destroyed = 0;
    this.events = [];
    this.sector=0;this._sectorWait=null;
    this._loadBuildings();
    this.player = {
      x: 80, y: 180, vx: 0, vy: 0, heading: 0, speed: 0,
      ramTime: 0, ramCooldown: 0, abilityDuration: this.vehicle.duration,
      abilityElapsed: 0, attackTarget: null,
    };
    this._comboTime = 0;
    this._ramSerial = 0;
    this._ramHeading = 0;
    this._ramHeld = false;
    this._abilityImpacted = false;
    this._impactCount = 0;
    this.attackTarget = null;
    this._pointTargetId = null;
    this._collapses = [];
    this._chainSerial = 0;
    return this;
  }

  _loadBuildings(){
    const layout = this.mission.district === 'industrial' ? INDUSTRIAL_BUILDINGS : BUILDINGS;
    this.buildings = layout.map((building, index) => {
      let type=building.type;
      const variant=this.freeMode?0:((this.mission.variant||0)+this.sector);
      // Keep the opening industrial domino chain readable in every contract.
      if(variant && index>2){
        const choices=this.mission.district==='town'?['kiosk','house','warehouse','shed']:['warehouse','containers','tower','house'];
        type=choices[(index+variant)%choices.length];
      }
      const stats=BUILDING_TYPES[type];
      const strength=this.freeMode||index<3?1:(this.mission.strength||1);
      return {...building,...stats,collapseRadius:stats.collapseRadius,fallHeading:stats.fallHeading,id:this.sector?`sector-${this.sector+1}-${building.id}`:building.id,type,maxHp:stats.maxHp*strength,hp:stats.maxHp*strength,hitCooldown:0,lastRam:-1};
    });
  }

  start(options = {}) {
    this.reset(options);
    this.runId = `smash-${Date.now().toString(36)}-${++runSequence}`;
    this.phase = 'playing';
    return this;
  }

  get goal() { return this.mission.target; }

  get freeMode() { return this.mode === 'free'; }

  get progress() {
    if (this.mission.objective === 'destroy') return this.destroyed;
    if (this.mission.objective === 'chain') return this.bestChain;
    return this.score;
  }

  result() {
    return {
      runId: this.runId, missionId: this.mission.id, won: !this.freeMode && this.phase === 'won',
      score: this.score, bestCombo: this.bestCombo, bestChain: this.bestChain,
      destroyed: this.destroyed, elapsed: this.elapsed, coins: this.coins,
    };
  }

  useRam() {
    const p = this.player;
    if (this.phase !== 'playing' || p.ramCooldown > EPSILON || p.ramTime > EPSILON) return false;
    p.ramTime = this.vehicle.duration;
    p.ramCooldown = this.vehicle.cooldown;
    p.abilityDuration = this.vehicle.duration;
    p.abilityElapsed = 0;
    this._ramHeading = p.heading;
    this._ramSerial++;
    this._abilityImpacted = this.vehicle.attack === 'ram';
    this._impactCount=0;
    this.attackTarget = p.attackTarget = {
      x: p.x + Math.cos(p.heading) * this.vehicle.reach,
      y: p.y + Math.sin(p.heading) * this.vehicle.reach,
      radius: this.vehicle.radius, heading: p.heading,
    };
    if (this.vehicle.attack === 'point') {
      const nearest = this._nearestBucketTarget();
      this._pointTargetId = nearest?.building.id ?? null;
      if (nearest && !inCircle(this.attackTarget.x, this.attackTarget.y, this.vehicle.radius, nearest.building)) {
        // Keep an already valid contact pose. A closer obstacle stops the
        // bucket before its nominal endpoint, including narrow buildings.
        let reach = Math.min(this.vehicle.reach, nearest.distance + this.vehicle.radius);
        if (!inCircle(p.x + Math.cos(p.heading) * reach, p.y + Math.sin(p.heading) * reach, this.vehicle.radius, nearest.building)) {
          reach = nearest.distance;
        }
        this.attackTarget.x = p.x + Math.cos(p.heading) * reach;
        this.attackTarget.y = p.y + Math.sin(p.heading) * reach;
      }
    }
    if (this.vehicleId === 'dozer') this.events.push({ type: 'ram', x: p.x, y: p.y });
    this.events.push(this._abilityEvent('ability-start'));
    return true;
  }

  _abilityEvent(type) {
    const target = this.attackTarget;
    return { type, vehicleId: this.vehicleId, targetX: target.x, targetY: target.y,
      radius: target.radius, heading: target.heading };
  }

  _nearestBucketTarget() {
    const p = this.player, dx = Math.cos(this._ramHeading), dy = Math.sin(this._ramHeading);
    let nearest = null;
    for (const building of this.buildings) {
      if (building.hp <= 0) continue;
      const distance = bucketEntry(p.x, p.y, dx, dy, this.vehicle.reach, this.vehicle.radius, building);
      if (Number.isFinite(distance) && (!nearest || distance < nearest.distance)) nearest = { building, distance };
    }
    return nearest;
  }

  update(dt, input = {}) {
    this.events = [];
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    let ix = Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0;
    let iy = Number.isFinite(input.y) ? clamp(input.y, -1, 1) : 0;
    const length = Math.hypot(ix, iy);
    if (length > 1) { ix /= length; iy /= length; }
    if (input.ramPressed || (input.ram && !this._ramHeld)) {
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
    this.elapsed += dt;
    if(this._sectorWait!==null){
      this._sectorWait-=dt;
      if(this._sectorWait<=0){
        this.sector++;this._loadBuildings();this._sectorWait=null;this._collapses=[];
        Object.assign(p,{x:80,y:180,vx:0,vy:0,heading:0,speed:0,ramTime:0,ramCooldown:0,attackTarget:null});
        this.attackTarget=null;this._pointTargetId=null;this._ramHeld=false;
        this.events.push({type:'sector',sector:this.sector+1,total:this.mission.sectors});
      }
      if(this.timeLeft<=EPSILON){this.timeLeft=0;this.phase='lost';this.events.push({type:'lose',x:p.x,y:p.y});}
      return;
    }
    p.ramCooldown = Math.max(0, p.ramCooldown - dt);
    this._comboTime = Math.max(0, this._comboTime - dt);
    if (this._comboTime === 0) this.combo = 0;
    for (const building of this.buildings) building.hitCooldown = Math.max(0, building.hitCooldown - dt);

    const ramming = p.ramTime > EPSILON;
    if (ramming) {
      p.heading = this._ramHeading;
      p.abilityElapsed = Math.min(p.abilityDuration, p.abilityElapsed + dt);
      if (this.vehicleId === 'dozer') {
        p.vx = Math.cos(p.heading) * RAM_SPEED;
        p.vy = Math.sin(p.heading) * RAM_SPEED;
      } else {
        p.vx = p.vy = 0;
        const impacts=this.vehicle.impacts||[this.vehicle.impactAt];
        if (this._impactCount < impacts.length && p.abilityElapsed + EPSILON >= impacts[this._impactCount]) {
          this._impactCount++;
          this._abilityImpacted = this._impactCount===impacts.length;
          this.events.push(this._abilityEvent('ability-impact'));
          if (this.vehicle.attack === 'point') {
            const nearest = this._nearestBucketTarget();
            // The locked point attack cannot jump to a second building if a
            // pending collapse removed its original target during the windup.
            if (nearest?.building.id === this._pointTargetId) this._damage(nearest.building, this.vehicle.damage, true);
          } else {
            for (const building of this.buildings) {
              if (building.hp > 0 && inCircle(this.attackTarget.x, this.attackTarget.y, this.attackTarget.radius, building)) {
                this._damage(building, this.vehicle.damage, true);
              }
            }
          }
        }
      }
    } else {
      const response = 1 - Math.exp(-dt * (Math.hypot(ix, iy) > 0.01 ? 5 : 10));
      p.vx += (ix * this.vehicle.speed - p.vx) * response;
      p.vy += (iy * this.vehicle.speed - p.vy) * response;
      const wantsMove=Math.hypot(ix,iy)>.1;
      if(wantsMove){
        const desired=Math.atan2(iy,ix);
        const difference=Math.atan2(Math.sin(desired-p.heading),Math.cos(desired-p.heading));
        p.heading+=clamp(difference,-this.vehicle.turnRate*dt,this.vehicle.turnRate*dt);
      }
      if(!wantsMove&&Math.hypot(p.vx,p.vy)<.1)p.vx=p.vy=0;
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
      if ((!ramming || this.vehicleId === 'dozer') && forward > 0.45 && ready && (ramming || impact > 45 || pushing)) {
        const damage = ramming ? 1 : 0.34;
        if (ramming) building.lastRam = this._ramSerial;
        this._damage(building, damage, ramming);
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
    if (p.ramTime < EPSILON) {
      p.ramTime = 0;
      this.attackTarget = p.attackTarget = null;
    }
    this._processCollapses(dt);
    if(!this.freeMode&&this.phase==='playing'&&this.sector+1<this.mission.sectors&&this.buildings.every(b=>b.hp<=0))this._sectorWait=.9;
    if (this.phase === 'playing' && this.timeLeft < EPSILON) {
      this.timeLeft = 0;
      this.phase = 'lost';
      this.events.push({ type: 'lose', x: p.x, y: p.y });
    }
  }

  _damage(building, damage, strong = false, chain = null) {
    if (building.hp <= 0 || building._destroyed) return;
    building.hp = Math.max(0, building.hp - damage);
    if (building.hp < EPSILON) building.hp = 0;
    building.hitCooldown = HIT_COOLDOWN;
    this.events.push({ type: 'hit', buildingId: building.id, x: building.x, y: building.y,
      damage, hp: building.hp, strong, chain: Boolean(chain) });
    if (building.hp === 0) this._destroy(building, chain);
  }

  _destroy(building, chain = null) {
    if (building._destroyed) return;
    building._destroyed = true;
    if (!chain) chain = { id: ++this._chainSerial, count: 0, visited: new Set([building.id]) };
    chain.count++;
    this.bestChain = Math.max(this.bestChain, chain.count);
    this.destroyed++;
    this.combo = Math.min(3, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this._comboTime = COMBO_WINDOW;
    const points = building.points * this.combo + (chain.count > 1 ? chain.count * 50 : 0);
    const coins = Math.floor(building.reward * this.coinScale);
    this.score += points;
    this.coins += coins;
    this.balance += coins;
    this.events.push({
      type: 'destroy', buildingId: building.id, x: building.x, y: building.y,
      coins, points, combo: this.combo, fallHeading: building.fallHeading,
      chainId: chain.id, chainCount: chain.count,
    });
    if (chain.count > 1) this.events.push({ type: 'chain', count: chain.count, x: building.x, y: building.y });
    if ((building.type === 'tower' || building.collapseRadius) && chain.count < CHAIN_LIMIT) {
      this._collapses.push({ building, chain, at: this.elapsed + (building.type === 'tower' ? 0.45 : 0.2) });
    }
    if (!this.freeMode && this.progress >= this.goal && this.destroyed >= (this.mission.minDestroyed||0) && this.phase === 'playing') {
      this.phase = 'won';
      this.events.push({ type: 'win', x: this.player.x, y: this.player.y });
    }
  }

  _processCollapses(dt) {
    // Newly queued collapses get their own full delay, including in long frames.
    const due = [];
    const pending = [];
    for (const job of this._collapses) (job.at <= this.elapsed + EPSILON ? due : pending).push(job);
    this._collapses = pending;
    for (const { building: source, chain } of due) {
      for (const target of this.buildings) {
        if (chain.count >= CHAIN_LIMIT) break;
        if (target.hp <= 0 || chain.visited.has(target.id)) continue;
        // Tower footprints all fall east. Segment/AABB overlap also includes
        // buildings whose edges meet the end of the visible falling tower.
        const affected = source.type === 'tower'
          ? target.x + target.w / 2 >= source.x && target.x - target.w / 2 <= source.x + 200
            && Math.abs(target.y - source.y) <= 40 + target.d / 2
          : inCircle(source.x, source.y, source.collapseRadius, target);
        if (!affected) continue;
        chain.visited.add(target.id);
        this._damage(target, source.type === 'tower' ? 4 : 3, true, chain);
      }
    }
  }
}
