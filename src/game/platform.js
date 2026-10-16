export class PlatformAdapter {async init(){} load(){throw new Error('Not implemented');} save(){throw new Error('Not implemented');} async rewardedAd(){return {available:false,rewarded:false};}}
export class LocalPlatform extends PlatformAdapter{load(){try{return JSON.parse(localStorage.getItem('loot-escape-v1'))||{};}catch{return {};}}save(data){try{localStorage.setItem('loot-escape-v1',JSON.stringify(data));return true;}catch{return false;}}}
// Future platform adapters must implement real SDK lifecycle, saves and ads.
export class YandexPlatform extends PlatformAdapter{}
export class CrazyGamesPlatform extends PlatformAdapter{}
