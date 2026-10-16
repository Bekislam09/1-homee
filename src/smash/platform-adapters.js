/** Platform SDKs live only here. Persistence deliberately remains in platform.js. */
const unavailable = (reason = 'unavailable') => ({ available: false, shown: false, rewarded: false, reason });
const callable = (owner, name) => typeof owner?.[name] === 'function';

function deadline(operation, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    Promise.resolve().then(operation).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** Only the selected platform's script is loaded; failures leave the game playable. */
export function loadSdkScript(src, document = globalThis.document, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!document?.createElement || !document.head) return reject(new Error('document-unavailable'));
    const script = document.createElement('script');
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove?.(); reject(error); } else resolve();
    };
    const timer = setTimeout(() => finish(new Error('script-timeout')), timeoutMs);
    script.async = true;
    script.src = src;
    script.onload = () => finish();
    script.onerror = () => finish(new Error('script-unavailable'));
    try { document.head.appendChild(script); } catch (error) { finish(error); }
  });
}

export class LocalPlatformAdapter {
  constructor(options = {}) {
    this.window = options.window ?? globalThis.window;
    this.document = options.document ?? this.window?.document ?? globalThis.document;
    this.loadScript = options.loadScript ?? (src => loadSdkScript(src, this.document, this.initTimeoutMs));
    this.initTimeoutMs = options.initTimeoutMs ?? 8000;
    this.adTimeoutMs = options.adTimeoutMs ?? 60000;
    this.target = 'local';
    this.ready = false;
    this.canRewarded = false;
    this.canInterstitial = false;
    this._listeners = new Set();
    this._platformPaused = false;
    this._platformMuted = false;
    this._adPaused = false;
    this._gameplay = false;
    this._gameReady = false;
    this._adPending = false;
    this._unsubscribers = [];
  }

  async init() { this.ready = true; return true; }
  gameReady() { this._gameReady = true; return true; }
  gameplayStart() { this._gameplay = true; return true; }
  gameplayStop() { this._gameplay = false; return true; }
  getLanguage() { return this.window?.navigator?.language ?? 'en'; }
  get state() { return { paused: this._platformPaused || this._adPaused, muted: this._platformMuted || this._adPaused }; }
  onStateChange(listener) {
    this._listeners.add(listener);
    try { listener(this.state); } catch { /* A consumer cannot break SDK callbacks. */ }
    return () => this._listeners.delete(listener);
  }
  _emit() { for (const listener of this._listeners) { try { listener(this.state); } catch { /* Isolate consumers. */ } } }
  _setPlatformPause(paused) { this._platformPaused = paused; this._emit(); }
  async showInterstitial() { return unavailable(); }
  async showRewarded() { return unavailable(); }
  destroy() { for (const unsubscribe of this._unsubscribers.splice(0)) { try { unsubscribe(); } catch { /* Best effort. */ } } this._listeners.clear(); }

  _safeCall(owner, name) {
    if (!this.ready || !callable(owner, name)) return false;
    try { owner[name](); return true; } catch { return false; }
  }

  _requestAd(invoke) {
    if (this._adPending) return Promise.resolve(unavailable('busy'));
    this._adPending = true;
    return new Promise(resolve => {
      let settled = false;
      let shown = false;
      let rewarded = false;
      const finish = (success, reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._adPending = false;
        this._adPaused = false;
        this._emit();
        resolve({ available: true, shown, rewarded: success && rewarded, ...(reason ? { reason } : {}) });
      };
      const timer = setTimeout(() => finish(false, 'timeout'), this.adTimeoutMs);
      const callbacks = {
        start: () => { if (!settled) { shown = true; this._adPaused = true; this.gameplayStop(); this._emit(); } },
        reward: () => { if (!settled) rewarded = true; },
        finish: wasShown => { if (!settled) { shown ||= wasShown === true; finish(true); } },
        error: () => finish(false, 'error'),
      };
      try {
        const request = invoke(callbacks);
        // Most SDKs use callbacks; catch a rejected thenable without treating resolution as ad success.
        if (request?.then) Promise.resolve(request).catch(callbacks.error);
      } catch { callbacks.error(); }
    });
  }
}

export class YandexPlatformAdapter extends LocalPlatformAdapter {
  constructor(options = {}) { super(options); this.target = 'yandex'; }
  async init() {
    if (this._initializing) return this._initializing;
    this._initializing = (async () => {
      try {
        const sdk = await deadline(async () => {
          if (!this.window?.YaGames?.init) await this.loadScript('/sdk.js');
          if (!callable(this.window?.YaGames, 'init')) throw new Error('sdk-unavailable');
          return this.window.YaGames.init();
        }, this.initTimeoutMs);
        if (!sdk) return false;
        this.sdk = sdk;
        this.ready = true;
        this.canRewarded = callable(sdk.adv, 'showRewardedVideo');
        this.canInterstitial = callable(sdk.adv, 'showFullscreenAdv');
        if (callable(sdk, 'on')) {
          for (const [name, paused] of [['game_api_pause', true], ['game_api_resume', false]]) {
            const listener = () => { this._platformMuted = paused; this._setPlatformPause(paused); };
            sdk.on(name, listener);
            this._unsubscribers.push(() => sdk.off?.(name, listener));
          }
        }
        return true;
      } catch { this.ready = false; this.canRewarded = this.canInterstitial = false; return false; }
    })();
    return this._initializing;
  }
  gameReady() {
    if (this._gameReady) return true;
    return this._gameReady = this._safeCall(this.sdk?.features?.LoadingAPI, 'ready');
  }
  gameplayStart() {
    if (this._gameplay) return true;
    return this._gameplay = this._safeCall(this.sdk?.features?.GameplayAPI, 'start');
  }
  gameplayStop() {
    if (!this._gameplay) return true;
    const stopped = this._safeCall(this.sdk?.features?.GameplayAPI, 'stop');
    this._gameplay = false;
    return stopped;
  }
  getLanguage() { return this.sdk?.environment?.i18n?.lang ?? super.getLanguage(); }
  showInterstitial() {
    if (!this.ready || !this.canInterstitial) return Promise.resolve(unavailable());
    return this._requestAd(cb => this.sdk.adv.showFullscreenAdv({ callbacks: { onOpen: cb.start, onClose: cb.finish, onError: cb.error, onOffline: cb.error } }));
  }
  showRewarded() {
    if (!this.ready || !this.canRewarded) return Promise.resolve(unavailable());
    return this._requestAd(cb => this.sdk.adv.showRewardedVideo({ callbacks: { onOpen: cb.start, onRewarded: cb.reward, onClose: cb.finish, onError: cb.error } }));
  }
}

export class CrazyGamesPlatformAdapter extends LocalPlatformAdapter {
  constructor(options = {}) { super(options); this.target = 'crazygames'; this.crazyMode = options.crazyMode === 'full' ? 'full' : 'basic'; }
  async init() {
    if (this._initializing) return this._initializing;
    this._initializing = (async () => {
      try {
        const sdk = await deadline(async () => {
          if (!this.window?.CrazyGames?.SDK) await this.loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
          const candidate = this.window?.CrazyGames?.SDK;
          if (!callable(candidate, 'init')) throw new Error('sdk-unavailable');
          await candidate.init();
          return candidate;
        }, this.initTimeoutMs);
        if (!sdk || sdk.environment === 'disabled') return false;
        this.sdk = sdk;
        this.ready = true;
        this.canRewarded = this.canInterstitial = this.crazyMode === 'full' && callable(sdk.ad, 'requestAd');
        this._syncSettings(sdk.game?.settings);
        if (callable(sdk.game, 'addSettingsChangeListener')) {
          const listener = settings => this._syncSettings(settings);
          sdk.game.addSettingsChangeListener(listener);
          this._unsubscribers.push(() => sdk.game.removeSettingsChangeListener?.(listener));
        }
        this._safeCall(sdk.game, 'loadingStart');
        return true;
      } catch { this.ready = false; this.canRewarded = this.canInterstitial = false; return false; }
    })();
    return this._initializing;
  }
  _syncSettings(settings) {
    this._platformMuted = settings?.muteAudio === true;
    this._emit();
  }
  gameReady() {
    if (this._gameReady) return true;
    return this._gameReady = this._safeCall(this.sdk?.game, 'loadingStop');
  }
  gameplayStart() {
    if (this._gameplay) return true;
    return this._gameplay = this._safeCall(this.sdk?.game, 'gameplayStart');
  }
  gameplayStop() {
    if (!this._gameplay) return true;
    const stopped = this._safeCall(this.sdk?.game, 'gameplayStop');
    this._gameplay = false;
    return stopped;
  }
  _showAd(type) {
    if (!this.ready || this.crazyMode !== 'full' || !callable(this.sdk?.ad, 'requestAd')) return Promise.resolve(unavailable());
    return this._requestAd(cb => this.sdk.ad.requestAd(type, {
      adStarted: cb.start,
      adFinished: () => { if (type === 'rewarded') cb.reward(); cb.finish(true); },
      adError: cb.error,
    }));
  }
  showInterstitial() { return this._showAd('midgame'); }
  showRewarded() { return this._showAd('rewarded'); }
}

/** No target is inferred from query parameters or host names. Release configuration chooses it. */
export async function createPlatformAdapter({ target = 'local', ...options } = {}) {
  const Adapter = target === 'yandex' ? YandexPlatformAdapter : target === 'crazygames' ? CrazyGamesPlatformAdapter : LocalPlatformAdapter;
  const adapter = new Adapter(options);
  await adapter.init();
  return adapter;
}
