const STORAGE_KEY = 'smash-city-v1';

function cleanSave(data) {
  const balance = Number.isSafeInteger(data?.balance) && data.balance >= 0 ? data.balance : 0;
  return {
    balance,
    settings: {
      sound: typeof data?.settings?.sound === 'boolean' ? data.settings.sound : true,
      effects: typeof data?.settings?.effects === 'boolean' ? data.settings.effects : true,
    },
  };
}

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
      const raw = storage.getItem(STORAGE_KEY);
      const saved = raw === null ? null : JSON.parse(raw);
      this.lastLoadSucceeded = true;
      return cleanSave(saved);
    } catch {
      this.lastLoadSucceeded = false;
      return cleanSave(null);
    }
  }

  save(data) {
    try {
      const storage = this.getStorage();
      if (!storage) throw new Error('Local storage is unavailable');
      storage.setItem(STORAGE_KEY, JSON.stringify(cleanSave(data)));
      this.lastSaveSucceeded = true;
      return true;
    } catch {
      this.lastSaveSucceeded = false;
      return false;
    }
  }
}
