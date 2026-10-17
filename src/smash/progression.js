import { MISSIONS, VEHICLES } from './content.js';

const MAX_SETTLED_RUNS = 100;
const MAX_OBSERVED_BUILDINGS = 128;
const vehicleIds = Object.keys(VEHICLES);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
const validId = id => typeof id === 'string' && id.trim().length > 0 && id.length <= 128;
const missionById = id => MISSIONS.find(mission => mission.id === Number(id));
const addSafe = (value, increment) => Math.min(Number.MAX_SAFE_INTEGER, value + increment);

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first-hit', target: 1 }, { id: 'rookie', target: 25 }, { id: 'master', target: 100 },
  { id: 'chain', target: 3 }, { id: 'collector', target: vehicleIds.length }, { id: 'champion', target: MISSIONS.length },
].map(Object.freeze));
export const DAILY_REWARDS = Object.freeze([50, 75, 100, 125, 150, 200, 300]);

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

function calendarDay(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
  if (year < 1970 || year > 9999) return null;
  return {
    date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    // Calendar arithmetic is independent of 23/25-hour daylight-saving days.
    ordinal: Math.floor(Date.UTC(year, month, day) / 86400000),
  };
}

function cleanDaily(value) {
  const daily = isObject(value) ? value : {};
  const match = typeof daily.lastDate === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(daily.lastDate);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    const actual = calendarDay(date);
    if (actual?.date === daily.lastDate && nonnegativeInteger(daily.claimedDays) > 0) {
      return { lastDate: actual.date, lastOrdinal: actual.ordinal, claimedDays: daily.claimedDays };
    }
  }
  return { lastDate: null, lastOrdinal: null, claimedDays: 0 };
}

function cleanObservedRuns(value) {
  const runs = [];
  for (const run of Array.isArray(value) ? value : []) {
    if (!isObject(run) || !validId(run.runId) || runs.some(existing => existing.runId === run.runId)) continue;
    runs.push({ runId: run.runId,
      buildingIds: [...new Set((Array.isArray(run.buildingIds) ? run.buildingIds : []).filter(validId))]
        .slice(0, MAX_OBSERVED_BUILDINGS) });
  }
  return runs.slice(-MAX_SETTLED_RUNS);
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
  const settledRuns = [...new Set((Array.isArray(source.settledRuns) ? source.settledRuns : []).filter(validId))]
    .slice(-MAX_SETTLED_RUNS);
  const rewardedRuns = {};
  for (const id of settledRuns) {
    const reward = isObject(source.rewardedRuns) && hasOwn(source.rewardedRuns, id) ? source.rewardedRuns[id] : null;
    if (isObject(reward) && nonnegativeInteger(reward.amount) > 0) {
      Object.defineProperty(rewardedRuns, id, { value: { amount: reward.amount, claimed: reward.claimed === true },
        enumerable: true, writable: true, configurable: true });
    }
  }
  const claimedAchievements = new Set(Array.isArray(source.achievements) ? source.achievements : []);
  return {
    version: 3,
    balance: nonnegativeInteger(source.balance),
    settings: {
      sound: typeof source.settings?.sound === 'boolean' ? source.settings.sound : true,
      effects: typeof source.settings?.effects === 'boolean' ? source.settings.effects : true,
      shake: typeof source.settings?.shake === 'boolean' ? source.settings.shake : true,
      quality: source.settings?.quality === 'low' ? 'low' : 'high',
      language: ['ru', 'en'].includes(source.settings?.language) ? source.settings.language : null,
    },
    ownedVehicles,
    selectedVehicle: ownedVehicles.includes(source.selectedVehicle) ? source.selectedVehicle : 'dozer',
    completedLevels,
    unlockedDistricts: completedLevels.includes(2) ? ['town', 'industrial'] : ['town'],
    records,
    settledRuns,
    achievements: ACHIEVEMENTS.filter(item => claimedAchievements.has(item.id)).map(item => item.id),
    // Previous save formats have no lifetime event history. Do not invent totals from records.
    stats: { destroyed: nonnegativeInteger(source.stats?.destroyed), bestChain: nonnegativeInteger(source.stats?.bestChain) },
    observedRuns: cleanObservedRuns(source.observedRuns),
    rewardedRuns,
    daily: cleanDaily(source.daily),
  };
}

export class Progression {
  constructor(saved) {
    this.state = cleanProgression(saved);
    this._achievementNotifications = [];
    this._checkAchievements();
  }

  _checkAchievements() {
    const conditions = [this.state.stats.destroyed >= 1, this.state.stats.destroyed >= 25,
      this.state.stats.destroyed >= 100, this.state.stats.bestChain >= 3,
      this.state.ownedVehicles.length === vehicleIds.length, this.state.completedLevels.length === MISSIONS.length];
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach((achievement, index) => {
      if (conditions[index] && !this.state.achievements.includes(achievement.id)) {
        this.state.achievements.push(achievement.id);
        this._achievementNotifications.push(achievement.id);
        newlyUnlocked.push(achievement.id);
      }
    });
    return newlyUnlocked;
  }

  drainAchievementNotifications() {
    return this._achievementNotifications.splice(0);
  }

  /** Consume the same destruction events used by rendering, without awarding currency.
   * IDs are retained for the latest 100 runs, including across reloads. Free play counts
   * real demolitions toward achievements while its simulation awards no permanent coins.
   */
  observeEvents(runId, events, { freeMode = false } = {}) {
    if (!validId(runId) || !Array.isArray(events) || events.length === 0) return [];
    // Free mode deliberately shares achievement progress, never mission/economy settlement.
    void freeMode;
    let run = this.state.observedRuns.find(item => item.runId === runId);
    for (const event of events) {
      if (!isObject(event)) continue;
      if (event.type === 'destroy' && validId(event.buildingId)) {
        if (!run) {
          run = { runId, buildingIds: [] };
          this.state.observedRuns.push(run);
          this.state.observedRuns = this.state.observedRuns.slice(-MAX_SETTLED_RUNS);
        }
        if (run.buildingIds.includes(event.buildingId) || run.buildingIds.length >= MAX_OBSERVED_BUILDINGS) continue;
        run.buildingIds.push(event.buildingId);
        this.state.stats.destroyed = addSafe(this.state.stats.destroyed, 1);
        this.state.stats.bestChain = Math.max(this.state.stats.bestChain, nonnegativeInteger(event.chainCount));
      } else if (event.type === 'chain') {
        this.state.stats.bestChain = Math.max(this.state.stats.bestChain, nonnegativeInteger(event.count));
      }
    }
    return this._checkAchievements();
  }

  purchase(id) {
    if (!hasOwn(VEHICLES, id)) return { ok: false, reason: 'unknown' };
    if (this.state.ownedVehicles.includes(id)) return { ok: false, reason: 'already-owned' };
    const { price } = VEHICLES[id];
    if (this.state.balance < price) return { ok: false, reason: 'insufficient-funds' };
    this.state.balance -= price;
    this.state.ownedVehicles.push(id);
    this._checkAchievements();
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
    if (!isObject(result) || result.won !== true || result.freeMode === true) return rejected;
    const mission = missionById(result.missionId);
    if (!mission || !this.isLevelUnlocked(mission.id)
      || !validId(result.runId) || this.state.settledRuns.includes(result.runId)
      || !Number.isFinite(result.elapsed) || result.elapsed < 0 || result.elapsed > mission.duration
      || !Number.isSafeInteger(result.score) || result.score < 0) return rejected;
    const achieved = mission.objective === 'score' ? result.score
      : mission.objective === 'destroy' ? result.destroyed : result.bestChain;
    if (!Number.isFinite(achieved) || achieved < mission.target || !Number.isSafeInteger(result.destroyed) || result.destroyed < mission.minDestroyed) return rejected;

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
    this.state.balance = addSafe(this.state.balance, bonus);
    if (firstWin) this.state.completedLevels.push(mission.id);
    if (mission.id === 2 && !this.state.unlockedDistricts.includes('industrial')) {
      this.state.unlockedDistricts.push('industrial');
    }
    this.state.records[mission.id] = record;
    this.state.settledRuns.push(result.runId);
    this.state.settledRuns = this.state.settledRuns.slice(-MAX_SETTLED_RUNS);
    // Only a validated, settled result establishes the ordinary amount to double.
    Object.defineProperty(this.state.rewardedRuns, result.runId, {
      value: { amount: addSafe(nonnegativeInteger(result.coins), bonus), claimed: false },
      enumerable: true, writable: true, configurable: true,
    });
    for (const id of Object.keys(this.state.rewardedRuns)) {
      if (!this.state.settledRuns.includes(id)) delete this.state.rewardedRuns[id];
    }
    this._checkAchievements();
    return { applied: true, bonus, stars, record: { ...record } };
  }

  /** Call only after the platform adapter confirms a rewarded view. No caller-supplied amount. */
  grantRewarded(runId) {
    const reward = validId(runId) && hasOwn(this.state.rewardedRuns, runId) ? this.state.rewardedRuns[runId] : null;
    if (!reward || !this.state.settledRuns.includes(runId)) return { ok: false, amount: 0, reason: 'unknown-run' };
    if (reward.claimed) return { ok: false, amount: 0, reason: 'already-claimed' };
    reward.claimed = true;
    this.state.balance = addSafe(this.state.balance, reward.amount);
    return { ok: true, amount: reward.amount, reason: null };
  }

  dailyStatus(now = new Date()) {
    const today = calendarDay(now);
    const day = this.state.daily.claimedDays % DAILY_REWARDS.length + 1;
    const available = Boolean(today && (this.state.daily.lastOrdinal === null || today.ordinal > this.state.daily.lastOrdinal));
    return { available, day, amount: DAILY_REWARDS[day - 1], lastDate: this.state.daily.lastDate };
  }

  /** Device dates provide duplicate protection, not server-verified anti-cheat. Missed days do not reset the cycle. */
  claimDaily(now = new Date()) {
    const status = this.dailyStatus(now);
    if (!status.available) return { ok: false, amount: 0, day: status.day };
    const today = calendarDay(now);
    this.state.balance = addSafe(this.state.balance, status.amount);
    this.state.daily = { lastDate: today.date, lastOrdinal: today.ordinal,
      claimedDays: addSafe(this.state.daily.claimedDays, 1) };
    return { ok: true, amount: status.amount, day: status.day };
  }
}
