import { cleanProgression } from './progression.js';

export const STORAGE_KEY = 'smash-city-v2';
export const LEGACY_STORAGE_KEY = 'smash-city-v1';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Integration boundary: real SDK adapters can implement this contract later. */
export class PlatformAdapter {
  async init() { return true; }
  load() { throw new Error('PlatformAdapter.load must be implemented'); }
  save() { throw new Error('PlatformAdapter.save must be implemented'); }
  async rewardedAd() { return { available: false, rewarded: false }; }
}

export class LocalPlatform extends PlatformAdapter {
  constructor(storage) {
    super();
    this.storage = storage;
    this.lastLoadSucceeded = true;
    this.lastSaveSucceeded = true;
  }

  getStorage() {
    // Access itself can throw when storage is blocked by browser policy.
    return this.storage ?? globalThis.localStorage;
  }

  load() {
    try {
      const storage = this.getStorage();
      if (!storage) throw new Error('Local storage is unavailable');
      let corrupt = false;
      for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
        const raw = storage.getItem(key);
        if (raw === null) continue;
        try {
          const saved = JSON.parse(raw);
          if (!isObject(saved) || (key === STORAGE_KEY && saved.version !== 2)) {
            corrupt = true;
            continue;
          }
          this.lastLoadSucceeded = true;
          this.state = cleanProgression(saved);
          return this.state;
        } catch {
          corrupt = true;
        }
      }
      this.lastLoadSucceeded = !corrupt;
      this.state = cleanProgression(null);
      return this.state;
    } catch {
      this.lastLoadSucceeded = false;
      this.state = cleanProgression(null);
      return this.state;
    }
  }

  save(data) {
    try {
      const storage = this.getStorage();
      if (!storage) throw new Error('Local storage is unavailable');
      const previous = this.state ?? this.load();
      const patch = isObject(data) ? data : {};
      const next = cleanProgression({ ...previous, ...patch,
        settings: { ...previous.settings, ...(isObject(patch.settings) ? patch.settings : {}) },
      });
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.state = next;
      this.lastSaveSucceeded = true;
      return true;
    } catch {
      this.lastSaveSucceeded = false;
      return false;
    }
  }
}
