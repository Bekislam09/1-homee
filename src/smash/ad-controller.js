/** Owns ad transitions; acquire() returns a release function for one independent pause/mute reason. */
export class AdController {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.acquire = options.acquire ?? (() => () => {});
    this.canShowInterstitial = options.canShowInterstitial ?? (() => false);
    this.now = options.now ?? Date.now;
    this.minInterstitialIntervalMs = options.minInterstitialIntervalMs ?? 120000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 62000;
    this.busy = false;
    this._lastInterstitial = null;
    this._rewardedRuns = new Set();
  }

  async _request(method, settle = result => result) {
    if (this.busy) return { available: false, rewarded: false, reason: 'busy' };
    this.busy = true;
    let release = () => {};
    let timer;
    try {
      release = this.acquire() ?? release;
      const result = await Promise.race([
        Promise.resolve().then(() => this.adapter[method]()),
        new Promise(resolve => { timer = setTimeout(() => resolve({ available: false, rewarded: false, reason: 'timeout' }), this.requestTimeoutMs); }),
      ]);
      return await settle(result ?? { available: false, rewarded: false, reason: 'unavailable' });
    } catch {
      return { available: false, rewarded: false, granted: false, reason: 'error' };
    } finally {
      clearTimeout(timer);
      try { release(); } catch { /* The SDK result remains usable. */ } finally { this.busy = false; }
    }
  }

  async requestRewarded(runId, grantCallback) {
    if (typeof runId !== 'string' || !runId || typeof grantCallback !== 'function') return { rewarded: false, granted: false, reason: 'invalid-run' };
    if (this._rewardedRuns.has(runId)) return { rewarded: false, granted: false, reason: 'already-rewarded' };
    if (this.busy) return { rewarded: false, granted: false, reason: 'busy' };
    if (!this.adapter.canRewarded) return { rewarded: false, granted: false, reason: 'unavailable' };
    return this._request('showRewarded', async result => {
      if (result.rewarded !== true) return { ...result, granted: false };
      // Mark before calling the economy, so exceptions or re-entrant clicks cannot repeat a grant.
      // The economy must also persist an idempotent claim keyed by this run ID across page reloads.
      if (this._rewardedRuns.has(runId)) return { ...result, granted: false, reason: 'already-rewarded' };
      this._rewardedRuns.add(runId);
      try {
        const grant = await grantCallback(runId);
        return { ...result, granted: grant === true || grant?.ok === true };
      } catch { return { ...result, granted: false, reason: 'grant-error' }; }
    });
  }

  async requestInterstitial() {
    if (this.busy) return { available: false, rewarded: false, reason: 'busy' };
    if (!this.adapter.canInterstitial) return { available: false, rewarded: false, reason: 'unavailable' };
    if (!this.canShowInterstitial()) return { available: false, rewarded: false, reason: 'active-gameplay' };
    const currentTime = this.now();
    if (this._lastInterstitial !== null && currentTime - this._lastInterstitial < this.minInterstitialIntervalMs) return { available: false, rewarded: false, reason: 'cooldown' };
    // Space requests even when no inventory is returned; never retry automatically.
    this._lastInterstitial = currentTime;
    return this._request('showInterstitial');
  }
}
