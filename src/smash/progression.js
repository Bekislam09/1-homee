import { MISSIONS, VEHICLES } from './content.js';

const MAX_SETTLED_RUNS = 100;
const vehicleIds = Object.keys(VEHICLES);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
const missionById = id => MISSIONS.find(mission => mission.id === Number(id));

function cleanRecord(value, mission) {
  const record = isObject(value) ? value : {};
  return {
    bestScore: nonnegativeInteger(record.bestScore),
    bestCombo: nonnegativeInteger(record.bestCombo),
    bestChain: nonnegativeInteger(record.bestChain),
    bestTime: Number.isFinite(record.bestTime) && record.bestTime >= 0 && record.bestTime <= mission.duration
      ? record.bestTime : mission.duration,
    wins: Math.max(1, nonnegativeInteger(record.wins, 1)),
    stars: Number.isInteger(record.stars) && record.stars >= 1 && record.stars <= 3 ? record.stars : 1,
  };
}

/** Shared by persistence and gameplay: untrusted saves never unlock out-of-order content. */
export function cleanProgression(data) {
  const source = isObject(data) ? data : {};
  const owned = new Set(Array.isArray(source.ownedVehicles) ? source.ownedVehicles : []);
  const ownedVehicles = vehicleIds.filter(id => id === 'dozer' || owned.has(id));
  const rawCompleted = new Set(Array.isArray(source.completedLevels)
    ? source.completedLevels.filter(id => Number.isSafeInteger(id)) : []);
  const completedLevels = [];
  for (const mission of MISSIONS) {
    if (!rawCompleted.has(mission.id)) break;
    completedLevels.push(mission.id);
  }
  const records = {};
  for (const id of completedLevels) {
    records[id] = cleanRecord(isObject(source.records) ? source.records[id] : null, missionById(id));
  }
  const settledRuns = [...new Set((Array.isArray(source.settledRuns) ? source.settledRuns : [])
    .filter(id => typeof id === 'string' && id.trim().length > 0 && id.length <= 128))]
    .slice(-MAX_SETTLED_RUNS);
  return {
    version: 2,
    balance: nonnegativeInteger(source.balance),
    settings: {
      sound: typeof source.settings?.sound === 'boolean' ? source.settings.sound : true,
      effects: typeof source.settings?.effects === 'boolean' ? source.settings.effects : true,
    },
    ownedVehicles,
    selectedVehicle: ownedVehicles.includes(source.selectedVehicle) ? source.selectedVehicle : 'dozer',
    completedLevels,
    unlockedDistricts: completedLevels.includes(2) ? ['town', 'industrial'] : ['town'],
    records,
    settledRuns,
  };
}

export class Progression {
  constructor(saved) {
    this.state = cleanProgression(saved);
  }

  purchase(id) {
    if (!hasOwn(VEHICLES, id)) return { ok: false, reason: 'unknown' };
    if (this.state.ownedVehicles.includes(id)) return { ok: false, reason: 'already-owned' };
    const { price } = VEHICLES[id];
    if (this.state.balance < price) return { ok: false, reason: 'insufficient-funds' };
    this.state.balance -= price;
    this.state.ownedVehicles.push(id);
    return { ok: true, reason: null };
  }

  selectVehicle(id) {
    if (!this.state.ownedVehicles.includes(id)) return false;
    this.state.selectedVehicle = id;
    return true;
  }

  isLevelUnlocked(id) {
    const mission = missionById(id);
    return Boolean(mission && (mission.id === 1 || this.state.completedLevels.includes(mission.id - 1)));
  }

  coinScale(id) {
    return this.state.completedLevels.includes(Number(id)) ? 0.45 : 1;
  }

  /** Building coins already belong to the simulation; this awards the mission bonus only. */
  completeRun(result) {
    const rejected = { applied: false, bonus: 0, stars: 0, record: null };
    if (!isObject(result) || result.won !== true) return rejected;
    const mission = missionById(result.missionId);
    if (!mission || !this.isLevelUnlocked(mission.id)
      || typeof result.runId !== 'string' || !result.runId.trim() || result.runId.length > 128
      || this.state.settledRuns.includes(result.runId)
      || !Number.isFinite(result.elapsed) || result.elapsed < 0 || result.elapsed > mission.duration
      || !Number.isSafeInteger(result.score) || result.score < 0) return rejected;
    const achieved = mission.objective === 'score' ? result.score
      : mission.objective === 'destroy' ? result.destroyed : result.bestChain;
    if (!Number.isFinite(achieved) || achieved < mission.target) return rejected;

    const firstWin = !this.state.completedLevels.includes(mission.id);
    const bonus = firstWin ? mission.reward : Math.floor(mission.reward * 0.25);
    const stars = result.elapsed <= mission.starTimes[1] ? 3 : result.elapsed <= mission.starTimes[0] ? 2 : 1;
    const previous = this.state.records[mission.id];
    const record = {
      bestScore: Math.max(previous?.bestScore ?? 0, result.score),
      bestCombo: Math.max(previous?.bestCombo ?? 0, nonnegativeInteger(result.bestCombo)),
      bestChain: Math.max(previous?.bestChain ?? 0, nonnegativeInteger(result.bestChain)),
      bestTime: Math.min(previous?.bestTime ?? Infinity, result.elapsed),
      wins: Math.min(Number.MAX_SAFE_INTEGER, (previous?.wins ?? 0) + 1),
      stars: Math.max(previous?.stars ?? 0, stars),
    };
    this.state.balance = Math.min(Number.MAX_SAFE_INTEGER, this.state.balance + bonus);
    if (firstWin) this.state.completedLevels.push(mission.id);
    if (mission.id === 2 && !this.state.unlockedDistricts.includes('industrial')) {
      this.state.unlockedDistricts.push('industrial');
    }
    this.state.records[mission.id] = record;
    this.state.settledRuns.push(result.runId);
    this.state.settledRuns = this.state.settledRuns.slice(-MAX_SETTLED_RUNS);
    return { applied: true, bonus, stars, record: { ...record } };
  }
}
