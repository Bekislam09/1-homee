import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformAdapter, LocalPlatformAdapter, YandexPlatformAdapter, CrazyGamesPlatformAdapter, loadSdkScript } from '../src/smash/platform-adapters.js';

function yandex(options = {}) {
  const calls = [];
  const events = new Map();
  const sdk = {
    environment: { i18n: { lang: 'ru' } },
    features: { LoadingAPI: { ready: () => calls.push('ready') }, GameplayAPI: { start: () => calls.push('start'), stop: () => calls.push('stop') } },
    on: (name, listener) => events.set(name, listener), off: name => events.delete(name),
    adv: {
      showFullscreenAdv: ({ callbacks }) => { calls.push('interstitial'); options.fullscreen?.(callbacks); },
      showRewardedVideo: ({ callbacks }) => { calls.push('rewarded'); options.rewarded?.(callbacks); },
    },
  };
  const window = { YaGames: { init: async () => sdk } };
  return { adapter: new YandexPlatformAdapter({ window, adTimeoutMs: 25, ...options }), sdk, calls, events, window };
}

function crazy(options = {}) {
  const calls = [];
  let settingsListener;
  const sdk = {
    environment: options.environment ?? 'crazygames', init: async () => calls.push('init'),
    game: {
      settings: { muteAudio: options.muteAudio ?? false },
      loadingStart: () => calls.push('loadingStart'), loadingStop: () => calls.push('loadingStop'),
      gameplayStart: () => calls.push('gameplayStart'), gameplayStop: () => calls.push('gameplayStop'),
      addSettingsChangeListener: fn => { settingsListener = fn; }, removeSettingsChangeListener: () => calls.push('unsubscribe'),
    },
    ad: { requestAd: (type, callbacks) => { calls.push(type); options.ad?.(callbacks); } },
  };
  return { sdk, calls, changeSettings: settings => settingsListener(settings), adapter: new CrazyGamesPlatformAdapter({ window: { CrazyGames: { SDK: sdk } }, adTimeoutMs: 25, ...options }) };
}

test('local adapter never loads scripts or manufactures ad success', async () => {
  let loads = 0;
  const adapter = await createPlatformAdapter({ loadScript: () => { loads++; } });
  assert(adapter instanceof LocalPlatformAdapter);
  assert.equal(adapter.ready, true);
  assert.equal(adapter.canRewarded, false);
  assert.equal(adapter.canInterstitial, false);
  assert.equal((await adapter.showRewarded()).rewarded, false);
  assert.equal((await adapter.showInterstitial()).available, false);
  assert.equal(loads, 0);
});

test('only selected SDK script is requested with platform-owned URL', async () => {
  const sources = [];
  const window = {};
  const adapter = await createPlatformAdapter({ target: 'yandex', window, loadScript: async src => { sources.push(src); window.YaGames = { init: async () => ({}) }; } });
  assert.equal(adapter.ready, true);
  assert.deepEqual(sources, ['/sdk.js']);
  sources.length = 0;
  const otherWindow = {};
  await createPlatformAdapter({ target: 'crazygames', window: otherWindow, loadScript: async src => { sources.push(src); otherWindow.CrazyGames = { SDK: { init: async () => {}, environment: 'local' } }; } });
  assert.deepEqual(sources, ['https://sdk.crazygames.com/crazygames-sdk-v3.js']);
});

test('SDK rejection, absent global and timed-out init leave playable unavailable adapters', async () => {
  for (const window of [{}, { YaGames: { init: async () => { throw Error('offline'); } } }, { YaGames: { init: () => new Promise(() => {}) } }]) {
    const adapter = new YandexPlatformAdapter({ window, loadScript: async () => {}, initTimeoutMs: 5 });
    assert.equal(await adapter.init(), false);
    assert.equal(adapter.ready, false);
    assert.equal(adapter.gameReady(), false);
    assert.equal(adapter.gameplayStart(), false);
    assert.equal((await adapter.showRewarded()).rewarded, false);
  }
});

test('late init cannot activate SDK after deadline', async () => {
  let complete;
  const adapter = new YandexPlatformAdapter({ window: { YaGames: { init: () => new Promise(resolve => { complete = resolve; }) } }, initTimeoutMs: 5 });
  assert.equal(await adapter.init(), false);
  complete({ adv: { showRewardedVideo() {} } });
  await Promise.resolve();
  assert.equal(adapter.ready, false);
  assert.equal(adapter.canRewarded, false);
});

test('Yandex ready and gameplay transitions are sent once and language comes from SDK', async () => {
  const { adapter, calls } = yandex();
  await adapter.init();
  assert.equal(adapter.getLanguage(), 'ru');
  adapter.gameReady(); adapter.gameReady();
  adapter.gameplayStart(); adapter.gameplayStart();
  adapter.gameplayStop(); adapter.gameplayStop();
  assert.deepEqual(calls, ['ready', 'start', 'stop']);
});

test('Yandex pause and resume are independent from ad lifetime and unsubscribe on destroy', async () => {
  let callbacks;
  const { adapter, events } = yandex({ rewarded: cb => { callbacks = cb; } });
  await adapter.init();
  const states = [];
  adapter.onStateChange(state => states.push(state));
  const ad = adapter.showRewarded();
  callbacks.onOpen();
  events.get('game_api_pause')();
  callbacks.onClose();
  await ad;
  assert.deepEqual(adapter.state, { paused: true, muted: true });
  events.get('game_api_resume')();
  assert.deepEqual(adapter.state, { paused: false, muted: false });
  assert(states.some(state => state.paused && state.muted));
  adapter.destroy();
  assert.equal(events.size, 0);
});

test('Yandex closing without onRewarded cannot grant a reward', async () => {
  const { adapter } = yandex({ rewarded: cb => { cb.onOpen(); cb.onClose(); cb.onRewarded(); } });
  await adapter.init();
  const result = await adapter.showRewarded();
  assert.equal(result.rewarded, false);
  assert.equal(result.shown, true);
});

test('Yandex duplicate callbacks settle a confirmed reward only once', async () => {
  const { adapter } = yandex({ rewarded: cb => { cb.onOpen(); cb.onRewarded(); cb.onRewarded(); cb.onClose(); cb.onError(Error()); cb.onOpen(); } });
  await adapter.init();
  let resolutions = 0;
  assert.equal((await adapter.showRewarded().then(result => { resolutions++; return result; })).rewarded, true);
  assert.equal(resolutions, 1);
  assert.deepEqual(adapter.state, { paused: false, muted: false });
});

test('Yandex fullscreen errors and SDK throws cannot strand pause or grant rewards', async () => {
  for (const fullscreen of [cb => { cb.onOpen(); cb.onError(Error()); }, () => { throw Error('unavailable'); }]) {
    const { adapter } = yandex({ fullscreen });
    await adapter.init();
    const result = await adapter.showInterstitial();
    assert.equal(result.rewarded, false);
    assert.equal(result.reason, 'error');
    assert.deepEqual(adapter.state, { paused: false, muted: false });
  }
});

test('Yandex request timeout ignores all late callbacks and prevents parallel ads', async () => {
  let callbacks;
  const { adapter } = yandex({ rewarded: cb => { callbacks = cb; cb.onOpen(); } });
  await adapter.init();
  const first = adapter.showRewarded();
  assert.equal((await adapter.showInterstitial()).reason, 'busy');
  const result = await first;
  assert.equal(result.reason, 'timeout');
  assert.equal(result.rewarded, false);
  callbacks.onRewarded(); callbacks.onOpen(); callbacks.onClose();
  assert.deepEqual(adapter.state, { paused: false, muted: false });
});

test('CrazyGames disabled environment calls no game or advertising API', async () => {
  const { adapter, calls } = crazy({ environment: 'disabled', crazyMode: 'full' });
  assert.equal(await adapter.init(), false);
  adapter.gameReady(); adapter.gameplayStart(); adapter.gameplayStop();
  assert.equal((await adapter.showRewarded()).available, false);
  assert.deepEqual(calls, ['init']);
});

test('CrazyGames defaults to Basic Launch with no advertising calls', async () => {
  const { adapter, calls } = crazy();
  await adapter.init();
  assert.equal(adapter.canRewarded, false);
  assert.equal(adapter.canInterstitial, false);
  await adapter.showRewarded(); await adapter.showInterstitial();
  assert.deepEqual(calls, ['init', 'loadingStart']);
});

test('CrazyGames loading and gameplay APIs follow real transitions', async () => {
  const { adapter, calls } = crazy();
  await adapter.init();
  adapter.gameReady(); adapter.gameReady();
  adapter.gameplayStart(); adapter.gameplayStart();
  adapter.gameplayStop(); adapter.gameplayStop();
  assert.deepEqual(calls, ['init', 'loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop']);
});

test('CrazyGames platform mute persists across an ad and settings updates', async () => {
  let callbacks;
  const { adapter, changeSettings } = crazy({ crazyMode: 'full', muteAudio: true, ad: cb => { callbacks = cb; } });
  await adapter.init();
  assert.deepEqual(adapter.state, { paused: false, muted: true });
  const ad = adapter.showRewarded(); callbacks.adStarted(); callbacks.adFinished(); await ad;
  assert.deepEqual(adapter.state, { paused: false, muted: true });
  changeSettings({ muteAudio: false });
  assert.deepEqual(adapter.state, { paused: false, muted: false });
});

test('CrazyGames Full rewarded success requires adFinished and errors cannot grant', async () => {
  for (const [success, expected] of [[true, true], [false, false]]) {
    const { adapter } = crazy({ crazyMode: 'full', ad: cb => { cb.adStarted(); if (success) { cb.adFinished(); cb.adFinished(); cb.adError(); } else { cb.adError(); cb.adFinished(); } } });
    await adapter.init();
    assert.equal((await adapter.showRewarded()).rewarded, expected);
    assert.deepEqual(adapter.state, { paused: false, muted: false });
  }
});

test('script loader removes failed scripts and never leaves a pending load', async () => {
  let removed = 0;
  const document = { createElement: () => ({ remove: () => removed++ }), head: { appendChild: script => script.onerror() } };
  await assert.rejects(loadSdkScript('/sdk.js', document, 10));
  assert.equal(removed, 1);
  await assert.rejects(loadSdkScript('/sdk.js', { ...document, head: { appendChild() {} } }, 5), /timeout/);
  assert.equal(removed, 2);
});
