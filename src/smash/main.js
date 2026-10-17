import Phaser from 'phaser';
import { CityScene } from './scene.js';
import { Simulation } from './simulation.js';
import { LocalPlatform } from './platform.js';
import { AudioSystem } from './audio.js';
import './style.css';
import './final-copy.js';
import {GameLifecycle} from './lifecycle.js';
import {createPlatformAdapter,LocalPlatformAdapter} from './platform-adapters.js';
import {AdController} from './ad-controller.js';
import {ENGLISH_ONLY,t, setLocale, resolveLocale, achievementName,achievementText, getLocale, onLocaleChange, translateDOM, formatNumber, vehicleName, vehicleText, missionName, missionText, districtName, districtText} from './i18n.js';
import {VEHICLES,MISSIONS,DISTRICTS,getMission} from './content.js';
import {Progression,ACHIEVEMENTS,DAILY_REWARDS} from './progression.js';

const icons = {
  garage: '<path d="m3 10 9-7 9 7v11H3V10ZM7 21V11h10v10M7 15h10M7 18h10"/>',
  levels: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 5-4 5-4-5 4-5Z"/>',
  gear: '<path d="m10 3 1-1h2l1 3 3 1 3-1 2 3-2 2v4l2 2-2 3-3-1-3 1-1 3h-3l-1-3-3-1-3 1-2-3 2-2v-4L1 8l2-3 3 1 3-1 1-2Z"/><circle cx="12" cy="12" r="3"/>',
  sound: '<path d="m4 9 4 0 5-5v16l-5-5H4V9Z"/><path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m4 9 4 0 5-5v16l-5-5H4V9Zm13 0 6 6m0-6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-5 0h10"/>',
  house: '<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h4v7M7 10h2m6 0h2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 7M3 3v7h7"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};
const svg = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.bolt}</svg>`;
const $ = selector => document.querySelector(selector);
const platform = new LocalPlatform();
const saved = platform.load();
const progress = new Progression(saved);
const settings = progress.state.settings;
const sim = new Simulation({ balance: progress.state.balance });
let activeMissionId=Math.min(MISSIONS.length,(progress.state.completedLevels.at(-1)||0)+1);
let garageVehicle=progress.state.selectedVehicle;
let districtFilter='town';
let lastSettlement=null;
const audio = new AudioSystem();
audio.enabled=settings.sound;
let scene;
let toastTimeout = 0;
let lastHud = 0;
let ramPointer = null;
let joystickPointer = null;
const keys = new Set();
const joystick = { x: 0, y: 0 };
const controls = { screen: 'menu', paused: false, effects: settings.effects,shake:settings.shake,quality:settings.quality, input: { x: 0, y: 0, ram: false } };

let sdkAdapter=new LocalPlatformAdapter();
let sdkInitialized=false;
let adTransition=false;
const life=new GameLifecycle({controls,audio,settings,clearInput});
let ads=new AdController(sdkAdapter,{acquire:()=>life.acquireAd(),canShowInterstitial:()=>controls.screen==='result'});
$('#app').innerHTML = `
<div id="game" data-i18n-aria-label="gameAria" aria-label="${t('gameAria')}"></div>
<header class="site-header">
  <a class="brand" href="#" id="brand" data-i18n-aria-label="homeAria" aria-label="${t('homeAria')}"><span class="brand-symbol">${svg('bolt')}</span><span>SMASH<span class="brand-light">CITY</span><small data-i18n="brandTagline">${t('brandTagline')}</small></span></a>
  <div class="header-actions"><span class="wallet">${svg('coin')}<b id="balance">${sim.balance}</b><span data-i18n="coins">${t('coins')}</span></span><button id="sound" class="icon-button" data-i18n-aria-label="soundToggle" aria-label="${t('soundToggle')}">${svg('sound')}</button><button id="settings" class="icon-button" data-i18n-aria-label="settings" aria-label="${t('settings')}">${svg('gear')}</button><button id="pause" class="icon-button hidden" data-i18n-aria-label="pause" aria-label="${t('pause')}">${svg('pause')}</button></div>
</header>
<main id="menu" class="menu">
  <div class="hero">
    <div class="eyebrow"><span class="status-dot"></span> <span data-i18n="heroEyebrow">${t('heroEyebrow')}</span></div>
    <h1>SMASH<br><span>CITY<span class="title-spark">✳</span></span></h1>
    <div class="campaign-badge"><b>12</b> CONTRACTS <span>•</span> <b>5</b> MACHINES</div><div class="subtitle" data-i18n="subtitle">${t('subtitle')}</div>
    <p class="hero-description" data-i18n-html="heroDescription">${t('heroDescription')}</p>
    <div class="mission-label"><span class="level-number">01</span><div><small data-i18n="firstShift">${t('firstShift')}</small><strong>${missionName(1)}</strong></div><span class="mission-arrow">${svg('arrow')}</span></div>
    <button id="play" class="play-button" disabled><span>${svg('play')} <span id="play-label" data-i18n="loading">${t('loading')}</span></span>${svg('arrow')}</button>
    <div class="hero-meta"><span>${svg('clock')}${t('seconds',{count:90})}</span><i></i><span>${svg('target')}${t('objectiveScore',{count:formatNumber(1000)})}</span><i></i><span>${t('nextShift')}</span></div><nav class="menu-nav"><button id="garage">${svg('garage')} <span data-i18n="garage">${t('garage')}</span></button><button id="levels">${svg('levels')} <span data-i18n="levels">${t('levels')}</span> <span>${MISSIONS.length}</span></button></nav><nav class="final-nav"><button id="achievements" data-i18n="achievementsShort">${t('achievementsShort')}</button><button id="free-play" data-i18n="freePlay">${t('freePlay')}</button><button id="daily" data-i18n="daily">${t('daily')}</button></nav>
  </div>
  <div class="scene-caption"><span class="tiny-rule"></span> ${t('districtNumber',{number:'01'})}<span class="caption-dot"></span>${districtName('town').toUpperCase()}</div>
  <div class="hero-machine-stage"><span class="machine-kicker">YOUR NEXT BIG MOVE</span><img id="hero-machine" alt=""><div class="machine-nameplate"><span id="hero-vehicle-name"></span><small>BUILT FOR DESTRUCTION</small></div></div><div class="scene-sticker"><span>${svg('bolt')}</span><div data-i18n-html="sceneSticker">${t('sceneSticker')}</div></div>
</main>
<section id="building-guide" class="building-guide" data-i18n-aria-label="buildingsAria" aria-label="${t('buildingsAria')}">
  <div class="guide-intro"><small>MEET YOUR DEMOLITION CREW</small><strong>Pick your power.</strong></div>
  <div id="home-fleet" class="home-fleet"></div>
  <button id="help" class="help-button"><span data-i18n="howToPlay">${t('howToPlay')}</span> <span>?</span></button>
</section>
<footer id="footer"><span data-i18n="footerLeft">${t('footerLeft')}</span><span><span class="status-dot"></span> <span data-i18n="footerRight">${t('footerRight')}</span></span></footer>
<section id="garage-screen" class="subscreen hidden" data-i18n-aria-label="garage" aria-label="${t('garage')}"></section>
<section id="levels-screen" class="subscreen hidden" data-i18n-aria-label="levelsAria" aria-label="${t('levelsAria')}"></section>
<section id="hud" class="hud hidden" data-i18n-aria-label="hudAria" aria-label="${t('hudAria')}">
  <div class="timer-panel"><span class="timer-icon">${svg('clock')}</span><div><small data-i18n="timeLeft">${t('timeLeft')}</small><b id="timer">1:30</b></div></div>
  <div class="goal-panel"><div><span id="hud-mission">${missionName(1).toUpperCase()}</span><b><span id="mission-progress">0</span><i id="mission-target"> / 1 000</i></b></div><div class="progress-track"><span id="score-progress"></span></div><small id="clearance-progress"></small></div>
  <div class="run-coins"><small data-i18n="shiftCoins">${t('shiftCoins')}</small><b>${svg('coin')} <span id="run-coins">0</span></b></div>
  <div id="combo" class="combo hidden"><span data-i18n="comboLabel">${t('comboLabel')}</span><b>×<span id="combo-value">1</span></b><small data-i18n="comboMultiplier">${t('comboMultiplier')}</small></div>
  <div class="desktop-hint"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span><span data-i18n="moveHint">${t('moveHint')}</span><span class="hint-divider"></span><span class="key wide-key" data-i18n="spaceKey">${t('spaceKey')}</span><span data-i18n="ramHint">${t('ramHint')}</span></div>
  <button id="ram" class="ram-button" data-i18n-aria-label="vehicle.dozer.abilityName" aria-label="${t('vehicle.dozer.abilityName')}"><span class="ram-symbol">${svg('bolt')}</span><span><strong data-i18n="vehicle.dozer.abilityName">${t('vehicle.dozer.abilityName')}</strong><small id="ram-status" data-i18n="ramReady">${t('ramReady')}</small></span><div class="ram-track"><span id="ram-progress"></span></div></button>
  <div id="joystick" class="joystick" data-i18n-aria-label="joystickAria" aria-label="${t('joystickAria')}"><span class="joystick-arrows">＋</span><span id="joystick-stick"></span></div>
  <div class="level-pill"><span id="hud-location">${t('hudLocation',{number:'01',district:districtName('town').toUpperCase()})}</span><span id="hud-score">${t('hudScore',{score:0})}</span></div>
</section>
<button id="restore-map" class="secondary-button hidden" data-i18n="restoreMap">${t('restoreMap')}</button>
<div id="toast" class="toast hidden" role="status"></div>
<div id="pause-overlay" class="overlay hidden"><section class="modal pause-modal"><div class="modal-icon">${svg('pause')}</div><div class="eyebrow" data-i18n="pauseEyebrow">${t('pauseEyebrow')}</div><h2 data-i18n="pauseTitle">${t('pauseTitle')}</h2><p data-i18n="pauseDescription">${t('pauseDescription')}</p><button id="resume" class="play-button"><span data-i18n="resume">${t('resume')}</span> ${svg('play')}</button><button id="pause-menu" class="text-button" data-i18n="mainMenu">${t('mainMenu')}</button></section></div>
<div id="dialog" class="overlay hidden"></div>`;

function save() {
  progress.state.balance=sim.balance;
  progress.state.settings=settings;
  $('#balance').textContent=formatNumber(sim.balance);
  if (!platform.save(progress.state) && !save.warned) {
    save.warned = true;
    toast(t('storageError'));
  }
}
function soundButton() {
  $('#sound').innerHTML = svg(settings.sound ? 'sound' : 'mute');
  $('#sound').setAttribute('aria-pressed', String(settings.sound));
}
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.add('hidden'), 3400);
}
function clearInput() {
  keys.clear(); joystick.x = joystick.y = 0;
  ramPointer = joystickPointer = null;
  controls.input.x = controls.input.y = 0;
  controls.input.ram = false;
  controls.ramQueued = false;
  $('#joystick-stick').style.transform = 'translate(0px, 0px)';
  $('#ram').classList.remove('pressed');
}
function updateInput() {
  let sx = joystick.x, sy = joystick.y;
  if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
  let x = sx / 1.732 + sy, y = -sx / 1.732 + sy;
  const length = Math.hypot(x, y);
  if (length > 0) { const magnitude=Math.min(1,Math.hypot(sx,sy)); x=x/length*magnitude; y=y/length*magnitude; }
  controls.input.x = x; controls.input.y = y;
  controls.input.ram = keys.has('Space') || ramPointer !== null;
}
function setMenuVisible(value) {
  if(value)$('#restore-map').classList.add('hidden');
  $('#garage-screen').classList.add('hidden');$('#levels-screen').classList.add('hidden');document.body.classList.remove('in-hub');
  for (const name of ['menu', 'building-guide', 'footer']) $(`#${name}`).classList.toggle('hidden', !value);
  $('#hud').classList.toggle('hidden', value);
  $('#pause').classList.toggle('hidden', value);
  document.body.classList.toggle('in-game', !value);
}
function start(missionId=activeMissionId) {
  if(ads.busy||adTransition)return;
  if(controls.screen==='result'&&sdkAdapter.canInterstitial&&!progress.state.rewardedRuns[sim.runId]?.claimed){adTransition=true;ads.requestInterstitial().finally(()=>{adTransition=false;menu();start(missionId);});return;}
  if(!Number.isInteger(missionId))missionId=activeMissionId;
  if(!progress.isLevelUnlocked(missionId)){toast(t('levelLocked'));return;}
  activeMissionId=missionId;lastSettlement=null;
  audio.init();
  sim.start({missionId,vehicleId:progress.state.selectedVehicle,coinScale:progress.coinScale(missionId)});
  controls.screen = 'playing';life.resetUserPause();
  clearInput();
  $('#dialog').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  setMenuVisible(false);
  scene.resetViews();
  toast(sim.vehicleId==='dozer'?t(touchMode?'touchHelp':'desktopHelp'):t(touchMode?'vehicleTouchHelp':'vehicleDesktopHelp',{ability:vehicleText(sim.vehicleId,'abilityName').toLowerCase()}));
  $('.desktop-hint>span:last-child').textContent=vehicleText(sim.vehicleId,'abilityName').toLowerCase();
  $('#play').blur();
  updateHud(true);
}
function menu() {
  sim.reset();
  controls.screen = 'menu';life.resetUserPause();
  clearInput();
  $('#dialog').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  $('#toast').classList.add('hidden');
  setMenuVisible(true);
  scene.resetViews();
  updateMenuMission();
}
function pause(value = true) {
  if (controls.screen !== 'playing') return;
  life.userPause(value);
  clearInput();
  $('#pause-overlay').classList.toggle('hidden', !value);
  if (value) $('#resume').focus();
}
function openSettings() {
  const previous = controls.screen === 'result' ? [...$('#dialog').childNodes] : null;
  const wasPaused = controls.paused;
  if (controls.screen === 'playing') {life.reason('settings',true);clearInput();}
  $('#dialog').innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="modal-top"><span class="eyebrow" data-i18n="settingsEyebrow">${t('settingsEyebrow')}</span><button class="icon-button" id="close-settings" data-i18n-aria-label="close" aria-label="${t('close')}">${svg('close')}</button></div>
    <h2 id="settings-title" data-i18n="settings">${t('settings')}</h2>
    <label class="setting-row"><span><strong data-i18n="soundEffects">${t('soundEffects')}</strong><small data-i18n="soundDescription">${t('soundDescription')}</small></span><input id="sound-check" type="checkbox" ${settings.sound ? 'checked' : ''}><i class="switch"></i></label>
    <label class="setting-row"><span><strong data-i18n="extraEffects">${t('extraEffects')}</strong><small data-i18n="effectsDescription">${t('effectsDescription')}</small></span><input id="effects-check" type="checkbox" ${settings.effects ? 'checked' : ''}><i class="switch"></i></label>
    <label class="setting-row"><span><strong data-i18n="language">${t('language')}</strong></span><select id="language" ${ENGLISH_ONLY?'disabled':''}>${ENGLISH_ONLY?'<option value="en">English</option>':`<option value="auto">${t('languageAutomatic')}</option><option value="ru">Русский</option><option value="en">English</option>`}</select></label>
    <label class="setting-row"><span><strong data-i18n="screenShake">${t('screenShake')}</strong><small data-i18n="screenShakeHint">${t('screenShakeHint')}</small></span><input id="shake-check" type="checkbox" ${settings.shake?'checked':''}><i class="switch"></i></label>
    <label class="setting-row"><span><strong data-i18n="quality">${t('quality')}</strong><small data-i18n="qualityHint">${t('qualityHint')}</small></span><select id="quality"><option value="high">${t('qualityHigh')}</option><option value="low">${t('qualityLow')}</option></select></label>
    <p class="settings-note" data-i18n="settingsNote">${t('settingsNote')}</p><button class="play-button" id="settings-done"><span data-i18n="settingsDone">${t('settingsDone')}</span> ${svg('check')}</button>
  </section>`;
  $('#dialog').classList.remove('hidden');
  $('#language').value=ENGLISH_ONLY?'en':settings.language||'auto';$('#quality').value=settings.quality;
  $('#language').onchange=e=>{settings.language=e.target.value==='auto'?null:e.target.value;setLocale(resolveLocale(settings.language,sdkAdapter.getLanguage(),navigator.language));save();$('#language option[value=auto]').textContent=t('languageAutomatic');};
  $('#quality').onchange=e=>{settings.quality=e.target.value;controls.quality=e.target.value;save();};
  $('#shake-check').onchange=e=>{settings.shake=e.target.checked;controls.shake=e.target.checked;save();};
  $('#sound-check').onchange = event => { settings.sound = event.target.checked; life.sync(); audio.init(); soundButton(); save(); };
  $('#effects-check').onchange = event => { settings.effects = event.target.checked; controls.effects = settings.effects; save(); };
  const close = () => {
    if (previous) renderResult();
    else $('#dialog').classList.add('hidden');
    life.reason('settings',false);
  };
  $('#close-settings').onclick = close; $('#settings-done').onclick = close;
  $('#close-settings').focus();
}
function help() {
  $('#dialog').innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="eyebrow" data-i18n="helpEyebrow">${t('helpEyebrow')}</div><h2 id="help-title" data-i18n-html="helpTitle">${t('helpTitle')}</h2><div class="help-step"><b>01</b><p data-i18n-html="helpStep1">${t('helpStep1')}</p></div><div class="help-step"><b>02</b><p data-i18n-html="helpStep2">${t('helpStep2')}</p></div><div class="help-step"><b>03</b><p data-i18n-html="helpStep3">${t('helpStep3')}</p></div><button id="help-done" class="play-button"><span data-i18n="helpDone">${t('helpDone')}</span> ${svg('arrow')}</button></section>`;
  $('#dialog').classList.remove('hidden');
  $('#help-done').onclick = () => $('#dialog').classList.add('hidden');
  $('#help-done').focus();
}
function finish() {
  if (controls.screen === 'result') return;
  controls.screen = 'result';life.sync();
  progress.state.balance=sim.balance;
  lastSettlement=progress.completeRun(sim.result());
  sim.balance=progress.state.balance;
  clearInput(); save();
  $('#toast').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  audio.play(sim.phase === 'won' ? 'win' : 'lose');
  notifyAchievements();renderResult();
  $('#replay').focus();
}
// Rendering the translated result must never settle the same run again.
function renderResult() {
  const won = sim.phase === 'won';
  const defeatKey=sim.mission.objective==='score'?'defeatScore':sim.mission.objective==='destroy'?'defeatDestroy':'defeatChain';
  $('#dialog').innerHTML = `<section class="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div class="result-emblem ${won ? '' : 'lost'}">${svg(won ? 'trophy' : 'clock')}</div>
    <div class="eyebrow">${t('resultEyebrow',{number:sim.mission.id,status:t(won?'resultWon':'resultLost')})}</div>
    <h2 id="result-title">${t(won ? 'victory' : 'defeat')}</h2>
    ${won?`<div class="result-stars" aria-label="${t('starsAria',{count:lastSettlement.stars})}">${[1,2,3].map(n=>`<span class="${n<=lastSettlement.stars?'earned':''}">${svg('star')}</span>`).join('')}</div>`:''}
    <p>${won ? t('victoryDescription') : (sim.progress>=sim.mission.target?`Clear ${Math.max(0,sim.mission.minDestroyed-sim.destroyed)} more buildings to finish the contract.`:t(defeatKey,{count:formatNumber(Math.max(0,sim.mission.target-sim.progress))}))}</p>
    <div class="result-stats"><div><small>${t('score')}</small><b id="result-score">${formatNumber(sim.score)}</b></div><div><small>${t('destroyed')}</small><b>${sim.destroyed}<em> / ${sim.buildings.length*(sim.freeMode?1:sim.mission.sectors)}</em></b></div><div><small>${t('bestCombo')}</small><b>×${sim.bestCombo}</b></div><div><small>${t('coinsEarned')}</small><b class="coin-value">${svg('coin')}${sim.coins+(lastSettlement?.bonus||0)}</b></div></div>
    ${won?`<p class="result-bonus">${t('resultBonus',{coins:lastSettlement.bonus,stars:lastSettlement.stars})}<br>${t(sim.mission.id<MISSIONS.length?'nextMissionUnlocked':'allUnlocked')}</p>`:''}
    ${sdkAdapter.canRewarded&&won&&!progress.state.rewardedRuns[sim.runId]?.claimed?`<button id="double-reward" class="play-button reward-button">${t('doubleCoins')} ${svg('coin')}</button><p class="ad-note">${t('doubleRewardDescription',{coins:sim.coins+(lastSettlement?.bonus||0)})}</p><button id="continue-without-ad" class="text-button">${t('continueWithoutAd')}</button>`:''}
    ${won&&sim.mission.id<MISSIONS.length?`<button id="next-contract" class="play-button next-contract">Next contract ${svg('arrow')}</button>`:''}
    <button id="replay" class="play-button">${t(won ? 'replay' : 'retry')} ${svg('reset')}</button>
    <div class="result-links"><button id="result-garage" class="text-button">${t('garage')} ${svg('garage')}</button><button id="result-levels" class="text-button">${t('levels')} ${svg('levels')}</button><button id="back-menu" class="text-button">${t('menu')} ${svg('arrow')}</button></div>
  </section>`;
  $('#dialog').classList.remove('hidden');
  if($('#double-reward'))$('#double-reward').onclick=claimAdReward;
  if($('#continue-without-ad'))$('#continue-without-ad').onclick=openLevels;
  if($('#next-contract'))$('#next-contract').onclick=()=>start(sim.mission.id+1);
  $('#replay').onclick = ()=>start(activeMissionId); $('#back-menu').onclick = menu;
  $('#result-garage').onclick=openGarage;$('#result-levels').onclick=openLevels;
}
function updateHud(force = false) {
  const now = performance.now();
  if (!force && now - lastHud < 60) return;
  lastHud = now;
  const seconds = Math.ceil(sim.timeLeft);
  $('#timer').textContent=sim.freeMode?'∞':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('#restore-map').classList.toggle('hidden',!sim.freeMode||controls.screen!=='playing');
  $('.timer-panel').classList.toggle('urgent', seconds <= 15);
  $('#mission-progress').textContent = formatNumber(sim.freeMode?sim.destroyed:sim.progress);
  $('#mission-target').textContent=` / ${formatNumber(sim.freeMode?sim.buildings.length:sim.mission.target)}`;
  $('#hud-mission').textContent=(sim.freeMode?t('freePlay'):missionName(sim.mission.id)).toUpperCase();
  $('#hud-location').textContent=sim.freeMode?t('freeLocation',{district:districtName(sim.mission.district).toUpperCase()}):t('hudLocation',{number:sim.mission.id,district:districtName(sim.mission.district).toUpperCase()});
  $('#hud-score').textContent=t('hudScore',{score:formatNumber(sim.score)});
  $('#clearance-progress').textContent=sim.freeMode?'Clear the map at your own pace':`BLOCK ${sim.sector+1}/${sim.mission.sectors} · CLEARANCE ${sim.destroyed}/${sim.mission.minDestroyed}`;
  $('#clearance-progress').classList.toggle('complete',sim.destroyed>=sim.mission.minDestroyed);
  $('#score-progress').style.width = `${Math.min(100, (sim.freeMode?sim.destroyed/sim.buildings.length:sim.progress/sim.mission.target) * 100)}%`;
  $('#balance').textContent = formatNumber(sim.balance);
  $('#run-coins').textContent = sim.coins;
  $('#combo').classList.toggle('hidden', sim.combo < 2);
  $('#combo-value').textContent = sim.combo;
  const cooldown = sim.player.ramCooldown;
  $('#ram-status').textContent = cooldown > .05 ? t('ramCooldown',{time:cooldown.toFixed(1)}) : t('ramReady');
  $('#ram').classList.toggle('cooldown', cooldown > .05);
  $('#ram-progress').style.width = `${Math.max(0, 1 - cooldown / sim.vehicle.cooldown) * 100}%`;
  $('#ram strong').textContent=vehicleText(sim.vehicleId,'abilityName');
  $('#ram').setAttribute('aria-label',vehicleText(sim.vehicleId,'abilityName'));
  $('#ram').setAttribute('aria-disabled', String(cooldown > .05));
}

controls.onReady=ready=>{scene=ready;enablePlayWhenReady();updateMenuMission();};
controls.onEvents = events => {
  progress.observeEvents(sim.runId,events,{freeMode:sim.freeMode});
  for (const event of events) {
    if(event.type==='sector'){clearInput();toast(`BLOCK ${event.sector} / ${event.total} — next demolition site`);}
    if (['ram', 'hit', 'destroy'].includes(event.type)) audio.play(event.type);
    if(event.type==='ability-start'&&event.vehicleId!=='dozer')audio.play('ram');
    if(event.type==='ability-impact')audio.play('hit');
    if(event.type==='chain'&&event.count>=2){toast(t('chain',{count:event.count}));audio.play('destroy');}
    if (event.type === 'destroy') { audio.play('coin'); save(); if (event.combo >= 2) toast(t('combo', {combo:event.combo})); }
  }
  notifyAchievements();
};
controls.onFinish = finish;
controls.onFrame = () => {
  life.sync();
  const active = controls.screen === 'playing' && !controls.paused;
  audio.update(sim.player.speed, active);
  if (controls.screen === 'playing'||controls.screen==='result') updateHud();
};

$('#play').onclick = ()=>start();
$('#garage').onclick=openGarage;$('#levels').onclick=openLevels;
$('#brand').onclick = event => { event.preventDefault(); if (scene) menu(); };
$('#settings').onclick = openSettings;
$('#help').onclick = help;
$('#pause').onclick = () => pause(!controls.paused);
$('#resume').onclick = () => pause(false);
$('#pause-menu').onclick = menu;
$('#sound').onclick = () => { audio.init(); settings.sound = !settings.sound; life.sync(); soundButton(); save(); };
soundButton();

const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'];
window.addEventListener('keydown', event => {
  if (event.target.matches('input,select')) return;
  if (event.code === 'Escape' && $('#dialog').classList.contains('hidden')) { event.preventDefault(); if (!event.repeat) pause(!controls.paused); }
  if (!movementKeys.includes(event.code) || controls.screen !== 'playing' || controls.paused) return;
  event.preventDefault(); if (event.code === 'Space' && !event.repeat) controls.ramQueued = true; keys.add(event.code); updateInput();
});
window.addEventListener('keyup', event => { if (movementKeys.includes(event.code)) { event.preventDefault(); keys.delete(event.code); updateInput(); } });
window.addEventListener('blur',()=>{clearInput();if(controls.screen==='playing'){life.reason('focus',true);$('#pause-overlay').classList.remove('hidden');}});
document.addEventListener('visibilitychange',()=>{life.reason('visibility',document.hidden);if(document.hidden&&controls.screen==='playing'){$('#pause-overlay').classList.remove('hidden');}});

const touchMode = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle('touch-mode', touchMode);
const joystickElement = $('#joystick');
function joystickMove(event) {
  if (event.pointerId !== joystickPointer) return;
  const bounds = joystickElement.getBoundingClientRect(), radius = bounds.width * .32;
  let x = event.clientX - bounds.left - bounds.width / 2, y = event.clientY - bounds.top - bounds.height / 2;
  const length = Math.hypot(x, y);
  if (length > radius) { x *= radius / length; y *= radius / length; }
  joystick.x = x / radius; joystick.y = y / radius;
  $('#joystick-stick').style.transform = `translate(${x}px, ${y}px)`;
  updateInput();
}
joystickElement.onpointerdown = event => {
  if (controls.paused || controls.screen !== 'playing' || joystickPointer !== null) return;
  event.preventDefault(); audio.init(); joystickPointer = event.pointerId;
  joystickElement.setPointerCapture(event.pointerId); joystickMove(event);
};
joystickElement.onpointermove = joystickMove;
function joystickRelease(event) {
  if (event.pointerId !== joystickPointer) return;
  joystickPointer = null; joystick.x = joystick.y = 0;
  $('#joystick-stick').style.transform = 'translate(0px, 0px)'; updateInput();
}
joystickElement.onpointerup = joystickRelease; joystickElement.onpointercancel = joystickRelease; joystickElement.onlostpointercapture = joystickRelease;
$('#ram').onpointerdown = event => {
  if (controls.paused || controls.screen !== 'playing') return;
  event.preventDefault(); audio.init(); ramPointer = event.pointerId; controls.ramQueued = true;
  $('#ram').setPointerCapture(event.pointerId); $('#ram').classList.add('pressed'); updateInput();
};
function ramRelease(event) {
  if (event.pointerId !== ramPointer) return;
  ramPointer = null; $('#ram').classList.remove('pressed'); updateInput();
}
$('#ram').onpointerup = ramRelease; $('#ram').onpointercancel = ramRelease; $('#ram').onlostpointercapture = ramRelease;

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: innerWidth, height: innerHeight,
  transparent: true, antialias: true, roundPixels: false,
  scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight },
  render: { pixelArt: false, antialias: true, powerPreference: 'default' },
  scene: [new CityScene(sim, controls)],
  input: { keyboard: false, mouse: false, touch: false },
  audio: { noAudio: true },
  banner: false, fps: { target: 60, forceSetTimeOut: false }
});
const resizeGame=()=>game.scale.resize(document.documentElement.clientWidth,document.documentElement.clientHeight);
window.addEventListener('resize',resizeGame);
const viewportObserver=new ResizeObserver(resizeGame);viewportObserver.observe(document.documentElement);
window.addEventListener('pagehide', () => { audio.update(0, false); });
// State helpers are opt-in and excluded from production builds by Vite.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  window.__smash = { setTestPlatform(adapter){sdkAdapter=adapter;life.attach(adapter);ads=new AdController(adapter,{acquire:()=>life.acquireAd(),canShowInterstitial:()=>controls.screen==='result'});},renderResult, life, get adapter(){return sdkAdapter;},get ads(){return ads;},startFree,openAchievements,openDaily,sim, controls, game, settings, progress, start, menu, finish, openGarage,openLevels, get scene() { return scene; } };
}

const textureUrls=new Map();
function artUrl(key){
  if(!scene?.textures.exists(key))return '';
  if(!textureUrls.has(key)){const source=scene.textures.get(key).getSourceImage();textureUrls.set(key,source.toDataURL('image/png'));}
  return textureUrls.get(key);
}
function updateMenuMission(){
  const nextId=MISSIONS.find(m=>!progress.state.completedLevels.includes(m.id))?.id;
  if(controls.screen==='menu'&&nextId)activeMissionId=nextId;
  const mission=getMission(activeMissionId);
  if(scene){
    const selected=progress.state.selectedVehicle;
    $('#hero-machine').src=artUrl(`garage-${selected}`);
    $('#hero-machine').alt=vehicleName(selected);
    $('#hero-vehicle-name').textContent=vehicleName(selected);
    $('#home-fleet').innerHTML=Object.values(VEHICLES).map(v=>`<button class="fleet-preview ${v.id===selected?'active':''}" data-home-vehicle="${v.id}" aria-label="View ${vehicleName(v.id)} in garage"><img src="${artUrl(`garage-${v.id}`)}" alt=""><span>${vehicleName(v.id)}</span><small>${progress.state.ownedVehicles.includes(v.id)?'OWNED':formatNumber(v.price)+' ◇'}</small></button>`).join('');
    document.querySelectorAll('[data-home-vehicle]').forEach(b=>b.onclick=()=>{openGarage();garageVehicle=b.dataset.homeVehicle;renderGarage();});
  }
  $('.scene-caption').innerHTML=`<span class="tiny-rule"></span> ${t('districtNumber',{number:mission.district==='town'?'01':'02'})}<span class="caption-dot"></span>${districtName(mission.district).toUpperCase()}`;
  $('.mission-label .level-number').textContent=String(mission.id).padStart(2,'0');
  $('.mission-label strong').textContent=missionName(mission.id);
  $('.mission-label small').textContent=districtName(mission.district).toUpperCase();
  $('.hero-meta').innerHTML=`<span>${svg('clock')}${t('seconds',{count:mission.duration})}</span><i></i><span>${svg('target')}${t(mission.objective==='score'?'objectiveScore':mission.objective==='destroy'?'objectiveDestroy':'objectiveChain',{count:formatNumber(mission.target)})}</span><i></i><span>${t('nextShift')}</span>`;
}
function enterHub(name){
  if(!scene)return false;
  if(ads.busy)return false;clearInput();controls.screen=name;life.resetUserPause();
  $('#dialog').classList.add('hidden');$('#pause-overlay').classList.add('hidden');$('#toast').classList.add('hidden');
  setMenuVisible(false);$('#hud').classList.add('hidden');$('#pause').classList.add('hidden');
  document.body.classList.add('in-hub');
  $('#balance').textContent=formatNumber(sim.balance);
  return true;
}
function openGarage(){
  if(!enterHub('garage'))return;
  garageVehicle=progress.state.selectedVehicle;
  $('#garage-screen').classList.remove('hidden');
  renderGarage();
}
function renderGarage(){
  const selected=VEHICLES[garageVehicle],owned=progress.state.ownedVehicles.includes(garageVehicle),active=progress.state.selectedVehicle===garageVehicle;
  $('#garage-screen').innerHTML=`<div class="hub-heading"><div><div class="eyebrow">${t('garageEyebrow')}</div><h2>${t('garageTitle')}</h2></div><button id="garage-back" class="secondary-button">${svg('arrow','back-arrow')} ${t('backMenu')}</button></div><div class="garage-layout"><div id="garage-list" class="vehicle-list">${Object.values(VEHICLES).map((v,i)=>`<button data-vehicle="${v.id}" class="vehicle-card ${garageVehicle===v.id?'viewing':''}" aria-pressed="${garageVehicle===v.id}"><span class="vehicle-number">0${i+1}</span><img src="${artUrl(`garage-${v.id}`)}" alt=""><span><strong>${vehicleName(v.id)}</strong><small>${progress.state.selectedVehicle===v.id?t('vehicleSelectedUpper'):progress.state.ownedVehicles.includes(v.id)?t('vehicleOwnedUpper'):t('vehiclePriceUpper',{price:v.price})}</small></span>${svg(progress.state.ownedVehicles.includes(v.id)?'check':'lock')}</button>`).join('')}<div class="garage-tip">${svg('bolt')}<p>${t('garageTip')}</p></div></div><div class="workshop-stage"><div class="workshop-tag">SMASH CITY <span>${t('workshopTag',{number:'0'+(Object.keys(VEHICLES).indexOf(garageVehicle)+1)})}</span></div><img class="workshop-room" src="${artUrl('garage-room')}" alt="${t('workshopAria')}"><img id="vehicle-preview" class="workshop-vehicle ${garageVehicle}" src="${artUrl(`garage-${garageVehicle}`)}" alt="${vehicleName(selected.id)}"><div class="workshop-plate">${svg('garage')} ${vehicleName(selected.id).toUpperCase()}</div></div><div class="vehicle-details"><div class="eyebrow">${owned?t('vehicleReady'):t('vehicleNew')}</div><h3>${vehicleName(selected.id)}</h3><div class="vehicle-subtitle">${vehicleText(selected.id,'subtitle')}</div><p>${vehicleText(selected.id,'description')}</p><div class="ability-spec"><span>${svg('bolt')} ${vehicleText(selected.id,'abilityName')}</span><small>${t('cooldown',{seconds:selected.cooldown.toFixed(1)})}</small></div><div class="vehicle-traits"><span>${t('movementSpeed')}</span><div>${[1,2,3].map(n=>`<i class="${n<=(selected.speed>=155?3:selected.speed>=135?2:1)?'filled':''}"></i>`).join('')}</div></div><div class="vehicle-price"><small>${owned?t('inGarage'):t('price')}</small><strong>${owned?t('purchased'):`${selected.price} ◇`}</strong></div><button id="vehicle-action" class="play-button" ${active?'disabled':''}>${active?t('selected'):owned?t('selectVehicle'):t('purchaseFor',{price:selected.price})} ${svg(active?'check':owned?'arrow':'coin')}</button>${!owned&&sim.balance<selected.price?`<div class="funds-note">${t('needCoins',{count:selected.price-sim.balance})}</div>`:''}<button id="garage-missions" class="text-button">${t('toMissions')} ${svg('levels')}</button></div></div>`;
  $('#garage-back').onclick=menu;$('#garage-missions').onclick=openLevels;
  document.querySelectorAll('[data-vehicle]').forEach(button=>button.onclick=()=>{garageVehicle=button.dataset.vehicle;renderGarage();});
  $('#vehicle-action').onclick=()=>{
    if(!progress.state.ownedVehicles.includes(garageVehicle)){
      progress.state.balance=sim.balance;
      const result=progress.purchase(garageVehicle);
      if(!result.ok){toast(result.reason==='insufficient-funds'?t('insufficientCoins'):t('alreadyOwned'));return;}
      sim.balance=progress.state.balance;
      audio.init();audio.play('coin');
      toast(t('vehiclePurchased',{vehicle:vehicleName(garageVehicle)}));
    }
    progress.selectVehicle(garageVehicle);notifyAchievements();save();renderGarage();
  };
}
function openLevels(){
  if(!enterHub('levels'))return;
  districtFilter=getMission(activeMissionId).district;
  $('#levels-screen').classList.remove('hidden');renderLevels();
}
function renderLevels(){
  const district=DISTRICTS[districtFilter],districtOpen=progress.state.unlockedDistricts.includes(districtFilter);
  $('#levels-screen').innerHTML=`<div class="hub-heading"><div><div class="eyebrow">${t('levelsEyebrow')}</div><h2>${t('levelsTitle')}</h2></div><button id="levels-back" class="secondary-button">${svg('arrow','back-arrow')} ${t('backMenu')}</button></div><div class="level-toolbar"><div class="district-tabs">${Object.values(DISTRICTS).map(d=>`<button data-district="${d.id}" class="${d.id===districtFilter?'active':''}" aria-pressed="${d.id===districtFilter}">${svg(progress.state.unlockedDistricts.includes(d.id)?'levels':'lock')}${districtName(d.id)}</button>`).join('')}</div><button id="levels-garage" class="selected-machine">${svg('garage')} ${vehicleName(progress.state.selectedVehicle)} ${svg('arrow')}</button></div><div class="district-description"><p>${districtText(district.id,'description')}</p><small>${districtOpen?t('starsDescription'):t('districtLocked')}</small></div><div class="mission-grid">${MISSIONS.filter(m=>m.district===districtFilter).map(m=>{
    const unlocked=progress.isLevelUnlocked(m.id),record=progress.state.records[m.id];
    return `<article data-mission="${m.id}" class="mission-tile ${unlocked?'':'locked'}"><div class="mission-illustration ${m.district}"><span class="mission-tile-number">${String(m.id).padStart(2,'0')}</span><img src="${artUrl(`${m.district==='town'?(m.id===1?'shed':'house'):(m.id===3?'tower':'warehouse')}-0`)}" alt=""><div class="tile-stars">${[1,2,3].map(n=>`<span class="${n<=(record?.stars||0)?'earned':''}">${svg('star')}</span>`).join('')}</div>${!unlocked?`<span class="tile-lock">${svg('lock')}</span>`:''}</div><div class="mission-tile-body"><small>${t('missionEyebrow',{number:String(m.id).padStart(2,'0'),objective:t(m.objective==='chain'?'missionChain':m.objective==='destroy'?'missionDestroy':'missionScore')})}</small><h3>${missionName(m.id)}</h3><p>${missionText(m.id,'description')}</p><div class="mission-numbers"><span>${svg('clock')}${t('shortSeconds',{count:m.duration})}</span><span>${svg('coin')}${t('missionBonus',{count:record?Math.floor(m.reward*.25):m.reward})}</span></div><div class="mission-record">${record?`<span>${t('record')} <b>${formatNumber(record.bestScore)}</b></span><span>${t('recordCombo')} <b>×${record.bestCombo}</b></span><span>${t('recordTime')} <b>${t('shortSeconds',{count:record.bestTime.toFixed(1)})}</b></span><span>${t('recordWins')} <b>${record.wins}</b></span>`:`<span>${t('firstRecord')}</span>`}</div><div class="star-rules">${svg('star')} ${t('starRules',{two:m.starTimes[0],three:m.starTimes[1]})}</div><button data-start-mission="${m.id}" class="play-button" ${unlocked?'':'disabled'}>${unlocked?(record?t('beatRecord'):t('startShift')):t('completeMission',{number:m.id-1})} ${svg(unlocked?'play':'lock')}</button></div></article>`;
  }).join('')}</div><div class="levels-footer">${svg('coin')} ${t('replayEconomy')}</div>`;
  $('#levels-back').onclick=menu;$('#levels-garage').onclick=openGarage;
  document.querySelectorAll('[data-district]').forEach(button=>button.onclick=()=>{districtFilter=button.dataset.district;renderLevels();});
  document.querySelectorAll('[data-start-mission]').forEach(button=>button.onclick=()=>start(Number(button.dataset.startMission)));
}

function enablePlayWhenReady(){
  const ready=Boolean(scene)&&sdkInitialized;
  $('#play').disabled=!ready;
  $('#play-label').dataset.i18n=ready?'play':scene?'sdkPending':'loading';
  $('#play-label').textContent=t($('#play-label').dataset.i18n);
  if(ready)sdkAdapter.gameReady();
}
function notifyAchievements(){
  const ids=progress.drainAchievementNotifications();
  if(ids.length){toast(t('achievementUnlocked',{name:ids.map(achievementName).join(' · ')}));save();}
}
function showFinalModal(markup){
  if(ads.busy)return false;
  if(controls.screen==='playing'){life.reason('dialog',true);clearInput();}
  $('#pause-overlay').classList.add('hidden');
  $('#dialog').innerHTML=markup;$('#dialog').classList.remove('hidden');return true;
}
function closeFinalModal(){ $('#dialog').classList.add('hidden');life.reason('dialog',false);if(life.reasons.has('manual'))$('#pause-overlay').classList.remove('hidden'); }
function openAchievements(){
  const state=progress.state;
  const values={'first-hit':state.stats.destroyed,rookie:state.stats.destroyed,master:state.stats.destroyed,chain:state.stats.bestChain,collector:state.ownedVehicles.length,champion:state.completedLevels.length};
  showFinalModal(`<section class="modal collection-modal" role="dialog" aria-modal="true" aria-labelledby="achievements-title"><div class="modal-top"><span class="eyebrow">${t('achievementTotal',{count:state.achievements.length})}</span><button id="close-final" class="icon-button" aria-label="${t('close')}">${svg('close')}</button></div><h2 id="achievements-title">${t('achievements')}</h2><p>${t('achievementsProgress')}</p><div class="achievement-list">${ACHIEVEMENTS.map(a=>{const earned=state.achievements.includes(a.id);return `<article class="achievement ${earned?'earned':''}"><span>${svg(earned?'trophy':'lock')}</span><div><strong>${achievementName(a.id)}</strong><p>${achievementText(a.id,'description')}</p><small>${earned?t('achievementEarned'):t('achievementProgress',{current:Math.min(values[a.id],a.target),target:a.target})}</small></div></article>`;}).join('')}</div></section>`);
  $('#close-final').onclick=closeFinalModal;
}
function openDaily(){
  const status=progress.dailyStatus();
  showFinalModal(`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="daily-title"><div class="modal-top"><span class="eyebrow">SMASH CITY</span><button id="close-final" class="icon-button" aria-label="${t('close')}">${svg('close')}</button></div><h2 id="daily-title">${t('dailyReward')}</h2><p>${t('dailyHint')}</p><div class="daily-grid">${DAILY_REWARDS.map((coins,i)=>`<div class="${status.day===i+1?'today':''}"><small>${t('dailyDay',{day:i+1})}</small>${svg('coin')}<b>${coins}</b></div>`).join('')}</div><button id="claim-daily" class="play-button" ${status.available?'':'disabled'}>${status.available?t('claimDaily',{coins:status.amount}):t('dailyClaimed')}</button><p class="fine-print">${t('dailyLocal')}</p></section>`);
  $('#close-final').onclick=closeFinalModal;
  $('#claim-daily').onclick=()=>{const result=progress.claimDaily();if(result.ok){sim.balance=progress.state.balance;save();toast(t('dailyReceived',{coins:result.amount}));openDaily();}};
}
function openFreeChoice(){
  showFinalModal(`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="free-title"><div class="modal-top"><span class="eyebrow">${t('freeHint')}</span><button id="close-final" class="icon-button" aria-label="${t('close')}">${svg('close')}</button></div><h2 id="free-title">${t('freePlay')}</h2><p>${t('freeDistrict')}</p><div class="free-choices">${Object.values(DISTRICTS).map(d=>`<button data-free-district="${d.id}" class="play-button" ${progress.state.unlockedDistricts.includes(d.id)?'':'disabled'}>${districtName(d.id)} ${svg(progress.state.unlockedDistricts.includes(d.id)?'play':'lock')}</button>`).join('')}</div></section>`);
  $('#close-final').onclick=closeFinalModal;document.querySelectorAll('[data-free-district]').forEach(b=>b.onclick=()=>startFree(b.dataset.freeDistrict));
}
function startFree(district='town'){
  if(ads.busy||!scene||!progress.state.unlockedDistricts.includes(district))return;
  closeFinalModal();audio.init();
  sim.start({mode:'free',district,vehicleId:progress.state.selectedVehicle});
  controls.screen='playing';life.resetUserPause();clearInput();$('#dialog').classList.add('hidden');$('#pause-overlay').classList.add('hidden');
  setMenuVisible(false);scene.resetViews();updateHud(true);toast(t('freeHint'));
}
async function claimAdReward(){
  if(ads.busy)return;
  const runId=sim.runId,button=$('#double-reward');if(button){button.disabled=true;button.textContent=t('adLoading');}
  const result=await ads.requestRewarded(runId,()=>{const claim=progress.grantRewarded(runId);if(claim.ok){sim.balance=progress.state.balance;save();toast(t('adBonusReceived',{coins:claim.amount}));}return claim;});
  if(!result.granted)toast(t(result.reason==='unavailable'?'adUnavailable':'adDeclined'));
  if(controls.screen==='result')renderResult();
}
function refreshLocale(){
  document.documentElement.lang=getLocale();document.title=t('pageTitle');translateDOM();
  updateMenuMission();
  if(controls.screen==='garage')renderGarage();
  if(controls.screen==='levels')renderLevels();
  if(controls.screen==='playing'||controls.screen==='result')updateHud(true);
  if(controls.screen==='result'&&!$('#settings-title'))renderResult();
  if($('#achievements-title'))openAchievements();else if($('#daily-title'))openDaily();else if($('#free-title'))openFreeChoice();
  if($('#quality')){ $('#quality option[value=high]').textContent=t('qualityHigh');$('#quality option[value=low]').textContent=t('qualityLow'); }
  if($('#language option[value=auto]'))$('#language option[value=auto]').textContent=t('languageAutomatic');
}
onLocaleChange(refreshLocale);
$('#achievements').onclick=openAchievements;$('#daily').onclick=openDaily;$('#free-play').onclick=openFreeChoice;
$('#restore-map').onclick=()=>startFree(sim.mission.district);
async function initializePlatform(){
  sdkAdapter=await createPlatformAdapter({target:import.meta.env.VITE_PLATFORM||'local',crazyMode:import.meta.env.VITE_CRAZY_MODE||'basic'});
  life.attach(sdkAdapter);
  ads=new AdController(sdkAdapter,{acquire:()=>{save();return life.acquireAd();},canShowInterstitial:()=>controls.screen==='result'});
  setLocale(resolveLocale(settings.language,sdkAdapter.getLanguage(),navigator.language));refreshLocale();
  sdkInitialized=true;enablePlayWhenReady();
}
initializePlatform().catch(()=>{sdkInitialized=true;life.attach(sdkAdapter);setLocale(resolveLocale(settings.language,null,navigator.language));refreshLocale();enablePlayWhenReady();});
