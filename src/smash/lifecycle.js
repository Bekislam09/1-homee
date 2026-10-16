/** Independent pause reasons prevent an ad close from undoing a user's pause. */
export class GameLifecycle {
  constructor({controls,audio,settings,clearInput=()=>{},onChange=()=>{}}) {
    this.controls=controls;this.audio=audio;this.settings=settings;this.clearInput=clearInput;this.onChange=onChange;
    this.reasons=new Set();this.muteReasons=new Set();this.adapter=null;this.unsubscribe=null;
  }
  attach(adapter){
    this.unsubscribe?.();this.adapter=adapter;
    this.unsubscribe=adapter.onStateChange?.(state=>{this.reason('platform',Boolean(state.paused),false);this.mute('platform',Boolean(state.muted));});
    this.sync();
  }
  reason(name,enabled,sync=true){
    if(enabled){this.reasons.add(name);this.clearInput();}else this.reasons.delete(name);
    if(sync)this.sync();
  }
  mute(name,enabled){if(enabled)this.muteReasons.add(name);else this.muteReasons.delete(name);this.sync();}
  acquireAd(){this.reason('ad',true,false);this.muteReasons.add('ad');this.sync();let released=false;return ()=>{if(released)return;released=true;this.reasons.delete('ad');this.muteReasons.delete('ad');this.sync();};}
  userPause(value){this.reason('manual',value,false);if(!value){this.reasons.delete('focus');if(!globalThis.document?.hidden)this.reasons.delete('visibility');}this.sync();}
  resetUserPause(){for(const name of ['manual','focus'])this.reasons.delete(name);if(!globalThis.document?.hidden)this.reasons.delete('visibility');this.sync();}
  sync(){
    const paused=this.reasons.size>0;this.controls.paused=paused;
    this.audio.enabled=Boolean(this.settings.sound)&&this.muteReasons.size===0&&!this.reasons.has('visibility')&&!this.reasons.has('focus');
    if(this.controls.screen==='playing'&&!paused)this.adapter?.gameplayStart();else this.adapter?.gameplayStop();
    this.onChange({paused,muted:!this.audio.enabled,reasons:[...this.reasons]});
  }
  destroy(){this.unsubscribe?.();this.adapter?.gameplayStop();this.reasons.clear();this.muteReasons.clear();}
}
