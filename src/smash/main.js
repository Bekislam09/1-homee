import Phaser from 'phaser';
import { CityScene } from './scene.js';
import { Simulation } from './simulation.js';
import { LocalPlatform } from './platform.js';
import { AudioSystem } from './audio.js';
import './style.css';
import {t} from './i18n.js';
import {VEHICLES,MISSIONS,DISTRICTS,getMission} from './content.js';
import {Progression} from './progression.js';

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
let activeMissionId=Math.min(4,(progress.state.completedLevels.at(-1)||0)+1);
let garageVehicle=progress.state.selectedVehicle;
let districtFilter='town';
let lastSettlement=null;
const audio = new AudioSystem();
audio.enabled = settings.sound;
let scene;
let toastTimeout = 0;
let lastHud = 0;
let ramPointer = null;
let joystickPointer = null;
const keys = new Set();
const joystick = { x: 0, y: 0 };
const controls = { screen: 'menu', paused: false, effects: settings.effects, input: { x: 0, y: 0, ram: false } };

$('#app').innerHTML = `
<div id="game" aria-label="Изометрический город и бульдозер"></div>
<header class="site-header">
  <a class="brand" href="#" id="brand" aria-label="Smash City — главное меню"><span class="brand-symbol">${svg('bolt')}</span><span>SMASH<span class="brand-light">CITY</span><small>МАЛЕНЬКИЙ ГОРОД. БОЛЬШОЙ СНОС.</small></span></a>
  <div class="header-actions"><span class="wallet">${svg('coin')}<b id="balance">${sim.balance}</b><span>монет</span></span><button id="sound" class="icon-button" aria-label="Переключить звук">${svg('sound')}</button><button id="settings" class="icon-button" aria-label="Настройки">${svg('gear')}</button><button id="pause" class="icon-button hidden" aria-label="Пауза">${svg('pause')}</button></div>
</header>
<main id="menu" class="menu">
  <div class="hero">
    <div class="eyebrow"><span class="status-dot"></span> ТВОЯ НОВАЯ ЛЮБИМАЯ АРКАДА</div>
    <h1>SMASH<br><span>CITY<span class="title-spark">✳</span></span></h1>
    <div class="subtitle">Разрушитель города</div>
    <p class="hero-description">Маленький бульдозер.<br>Большие планы на этот город.</p>
    <div class="mission-label"><span class="level-number">01</span><div><small>ПЕРВАЯ СМЕНА</small><strong>Начало разрушений</strong></div><span class="mission-arrow">${svg('arrow')}</span></div>
    <button id="play" class="play-button" disabled><span>${svg('play')} <span id="play-label">Загружаем город…</span></span>${svg('arrow')}</button>
    <div class="hero-meta"><span>${svg('clock')}90 секунд</span><i></i><span>${svg('target')}1 000 очков</span><i></i><span>Один большой бум.</span></div><nav class="menu-nav"><button id="garage">${svg('garage')} Гараж</button><button id="levels">${svg('levels')} Уровни <span>4</span></button></nav>
  </div>
  <div class="scene-caption"><span class="tiny-rule"></span> РАЙОН № 01<span class="caption-dot"></span>СОЛНЕЧНЫЙ КВАРТАЛ</div>
  <div class="scene-sticker"><span>${svg('bolt')}</span><div>ГОРОД ГОТОВ.<br><b>А ТЫ?</b></div></div>
</main>
<section id="building-guide" class="building-guide" aria-label="Разрушаемые здания">
  <div class="guide-intro"><small>СНЕСИ ЭТО КРАСИВО</small><strong>От сарая<br>до целого дома.</strong></div>
  <div class="guide-item"><div class="building-mini shed-mini"><svg viewBox="0 0 80 70" aria-hidden="true"><path d="m10 36 32-17 29 17-31 18Z" fill="#b9bda4"/><path d="M14 32v25l27 10V39Z" fill="#dfb374"/><path d="m41 39 25-12v27L41 67Z" fill="#bb8550"/><path d="m8 31 16-20 28 8 21 11-32 15Z" fill="#6e9682"/><path d="m30 39 11 6v19l-11-4Z" fill="#795d40"/></svg></div><div><strong>Сарай</strong><span>1 таран <i>·</i> <b>25</b> ${svg('coin')}</span></div></div>
  <div class="guide-item"><div class="building-mini kiosk-mini"><svg viewBox="0 0 80 70" aria-hidden="true"><path d="m13 29 29-14 27 14v26L41 68 13 55Z" fill="#e7b9a2"/><path d="m41 42 28-13v26L41 68Z" fill="#ca927e"/><path d="m8 27 32-16 34 15-33 17Z" fill="#f1d4b6"/><path d="M16 36v18l23 10V46Z" fill="#577e7a"/><path d="m12 34 29 13 1 8-30-13Z" fill="#e87b55"/><path d="m21 38 5 2v8l-5-2Zm11 5 5 2v8l-5-2Z" fill="#fff1c8"/></svg></div><div><strong>Киоск</strong><span>2 тарана <i>·</i> <b>60</b> ${svg('coin')}</span></div></div>
  <div class="guide-item"><div class="building-mini house-mini"><svg viewBox="0 0 80 76" aria-hidden="true"><path d="M13 29v33l27 12 28-16V25L41 13Z" fill="#b8d4c8"/><path d="M40 40v34l28-16V25Z" fill="#7eaaa0"/><path d="m7 29 20-25 28 8 20 13-35 19Z" fill="#d88b6e"/><path d="m25 30 7 3v8l-7-3Zm0 16 7 3v8l-7-3Zm25-6 7-4v8l-7 4Zm0 16 7-4v8l-7 4Z" fill="#456b70"/></svg></div><div><strong>Дом</strong><span>3 тарана <i>·</i> <b>120</b> ${svg('coin')}</span></div></div>
  <button id="help" class="help-button">Как играть <span>?</span></button>
</section>
<footer id="footer"><span>СОЗДАНО ДЛЯ МАЛЕНЬКИХ ПЕРЕРЫВОВ</span><span><span class="status-dot"></span> БОЛЬШИЕ РАЗРУШЕНИЯ — БЕЗ ЛИШНИХ СЛОЖНОСТЕЙ</span></footer>
<section id="garage-screen" class="subscreen hidden" aria-label="Гараж"></section>
<section id="levels-screen" class="subscreen hidden" aria-label="Выбор уровней"></section>
<section id="hud" class="hud hidden" aria-label="Игровые показатели">
  <div class="timer-panel"><span class="timer-icon">${svg('clock')}</span><div><small>ОСТАЛОСЬ ВРЕМЕНИ</small><b id="timer">1:30</b></div></div>
  <div class="goal-panel"><div><span id="hud-mission">НАЧАЛО РАЗРУШЕНИЙ</span><b><span id="mission-progress">0</span><i id="mission-target"> / 1 000</i></b></div><div class="progress-track"><span id="score-progress"></span></div></div>
  <div class="run-coins"><small>ЗА ЭТУ СМЕНУ</small><b>${svg('coin')} <span id="run-coins">0</span></b></div>
  <div id="combo" class="combo hidden"><span>КОМБО</span><b>×<span id="combo-value">1</span></b><small>ОЧКИ УМНОЖАЮТСЯ</small></div>
  <div class="desktop-hint"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span><span>движение</span><span class="hint-divider"></span><span class="key wide-key">ПРОБЕЛ</span><span>мощный таран</span></div>
  <button id="ram" class="ram-button" aria-label="Мощный таран"><span class="ram-symbol">${svg('bolt')}</span><span><strong>ТАРАН</strong><small id="ram-status">ГОТОВ К УДАРУ</small></span><div class="ram-track"><span id="ram-progress"></span></div></button>
  <div id="joystick" class="joystick" aria-label="Виртуальный джойстик"><span class="joystick-arrows">＋</span><span id="joystick-stick"></span></div>
  <div class="level-pill"><span id="hud-location">УРОВЕНЬ 01 · СОЛНЕЧНЫЙ КВАРТАЛ</span><span id="hud-score">ОЧКИ 0</span></div>
</section>
<div id="toast" class="toast hidden" role="status"></div>
<div id="pause-overlay" class="overlay hidden"><section class="modal pause-modal"><div class="modal-icon">${svg('pause')}</div><div class="eyebrow">ПЕРЕРЫВ НА ОБЕД</div><h2>Город подождёт.</h2><p>Продолжим, когда будешь готов.</p><button id="resume" class="play-button">Продолжить ${svg('play')}</button><button id="pause-menu" class="text-button">Главное меню</button></section></div>
<div id="dialog" class="overlay hidden"></div>`;

function save() {
  progress.state.balance=sim.balance;
  progress.state.settings=settings;
  $('#balance').textContent=sim.balance.toLocaleString('ru');
  if (!platform.save(progress.state) && !save.warned) {
    save.warned = true;
    toast('Хранилище недоступно. Монеты сохранятся только до закрытия страницы.');
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
  $('#garage-screen').classList.add('hidden');$('#levels-screen').classList.add('hidden');document.body.classList.remove('in-hub');
  for (const name of ['menu', 'building-guide', 'footer']) $(`#${name}`).classList.toggle('hidden', !value);
  $('#hud').classList.toggle('hidden', value);
  $('#pause').classList.toggle('hidden', value);
  document.body.classList.toggle('in-game', !value);
}
function start(missionId=activeMissionId) {
  if(!Number.isInteger(missionId))missionId=activeMissionId;
  if(!progress.isLevelUnlocked(missionId)){toast('Сначала пройди предыдущее задание.');return;}
  activeMissionId=missionId;lastSettlement=null;
  audio.init();
  sim.start({missionId,vehicleId:progress.state.selectedVehicle,coinScale:progress.coinScale(missionId)});
  controls.screen = 'playing'; controls.paused = false;
  clearInput();
  $('#dialog').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  setMenuVisible(false);
  scene.resetViews();
  toast(sim.vehicleId==='dozer'?t(touchMode?'touchHelp':'desktopHelp'):(touchMode?`Джойстик — движение. Способность: ${sim.vehicle.abilityName.toLowerCase()}!`:`Движение — WASD. Пробел — ${sim.vehicle.abilityName.toLowerCase()}!`));
  $('.desktop-hint>span:last-child').textContent=sim.vehicle.abilityName.toLowerCase();
  $('#play').blur();
  updateHud(true);
}
function menu() {
  sim.reset();
  controls.screen = 'menu'; controls.paused = false;
  clearInput();
  $('#dialog').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  $('#toast').classList.add('hidden');
  setMenuVisible(true);
  scene.resetViews();
  updateMenuMission();
}
function pause(value = true) {
  if (controls.screen !== 'playing') return;
  controls.paused = value;
  clearInput();
  $('#pause-overlay').classList.toggle('hidden', !value);
  if (value) $('#resume').focus();
}
function openSettings() {
  const previous = controls.screen === 'result' ? [...$('#dialog').childNodes] : null;
  const wasPaused = controls.paused;
  if (controls.screen === 'playing') { controls.paused = true; clearInput(); }
  $('#dialog').innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="modal-top"><span class="eyebrow">СДЕЛАЙ ПО-СВОЕМУ</span><button class="icon-button" id="close-settings" aria-label="Закрыть">${svg('close')}</button></div><h2 id="settings-title">Настройки</h2><label class="setting-row"><span><strong>Звуковые эффекты</strong><small>Двигатель, удары и звон монет</small></span><input id="sound-check" type="checkbox" ${settings.sound ? 'checked' : ''}><i class="switch"></i></label><label class="setting-row"><span><strong>Дополнительные эффекты</strong><small>Больше пыли, частиц и лёгкая тряска камеры</small></span><input id="effects-check" type="checkbox" ${settings.effects ? 'checked' : ''}><i class="switch"></i></label><p class="settings-note">Отключи дополнительные эффекты, если игра замедляется. Настройки сохраняются автоматически.</p><button class="play-button" id="settings-done">Всё готово ${svg('check')}</button></section>`;
  $('#dialog').classList.remove('hidden');
  $('#sound-check').onchange = event => { settings.sound = event.target.checked; audio.enabled = settings.sound; audio.init(); soundButton(); save(); };
  $('#effects-check').onchange = event => { settings.effects = event.target.checked; controls.effects = settings.effects; save(); };
  const close = () => {
    if (previous) $('#dialog').replaceChildren(...previous);
    else $('#dialog').classList.add('hidden');
    controls.paused = wasPaused;
  };
  $('#close-settings').onclick = close; $('#settings-done').onclick = close;
  $('#close-settings').focus();
}
function help() {
  $('#dialog').innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="eyebrow">КОРОТКИЙ ИНСТРУКТАЖ</div><h2 id="help-title">Всё просто.<br>Просто снеси.</h2><div class="help-step"><b>01</b><p>Управляй бульдозером с помощью <strong>WASD / стрелок</strong> или экранного джойстика.</p></div><div class="help-step"><b>02</b><p>Направь ковш в здание и нажми <strong>пробел / кнопку способности</strong>. Обычное движение тоже постепенно повреждает здания.</p></div><div class="help-step"><b>03</b><p>Выбирай задания на очки, скорость или цепь. Сноси здания с интервалом до 7 секунд для комбо ×3. Монеты не умножаются. Новая техника и районы открываются в гараже и на экране уровней.</p></div><button id="help-done" class="play-button">Понятно. За работу! ${svg('arrow')}</button></section>`;
  $('#dialog').classList.remove('hidden');
  $('#help-done').onclick = () => $('#dialog').classList.add('hidden');
  $('#help-done').focus();
}
function finish() {
  if (controls.screen === 'result') return;
  controls.screen = 'result'; controls.paused = false;
  progress.state.balance=sim.balance;
  lastSettlement=progress.completeRun(sim.result());
  sim.balance=progress.state.balance;
  clearInput(); save();
  $('#toast').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  const won = sim.phase === 'won';
  audio.play(won ? 'win' : 'lose');
  $('#dialog').innerHTML = `<section class="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="result-emblem ${won ? '' : 'lost'}">${svg(won ? 'trophy' : 'clock')}</div><div class="eyebrow">УРОВЕНЬ ${sim.mission.id} / ${won ? 'ЧИСТАЯ РАБОТА' : 'СМЕНА ЗАКОНЧЕНА'}</div><h2 id="result-title">${t(won ? 'victory' : 'defeat')}</h2>${won?`<div class="result-stars" aria-label="${lastSettlement.stars} звезды">${[1,2,3].map(n=>`<span class="${n<=lastSettlement.stars?'earned':''}">${svg('star')}</span>`).join('')}</div>`:''}<p>${won ? 'Кажется, у тебя талант к большим разрушениям.' : `Ещё немного! До цели не хватило ${Math.max(0, sim.mission.target - sim.progress)} ${sim.mission.objective==='score'?'очков':sim.mission.objective==='destroy'?'зданий':'звеньев цепи'}.`}</p><div class="result-stats"><div><small>Очки</small><b id="result-score">${sim.score.toLocaleString('ru')}</b></div><div><small>Снесено зданий</small><b>${sim.destroyed}<em> / ${sim.buildings.length}</em></b></div><div><small>Лучшее комбо</small><b>×${sim.bestCombo}</b></div><div><small>Заработано монет</small><b class="coin-value">${svg('coin')}${sim.coins+(lastSettlement?.bonus||0)}</b></div></div>${won?`<p class="result-bonus">Бонус задания: +${lastSettlement.bonus} монет · ${lastSettlement.stars} / 3 звёзд<br>${sim.mission.id<4?'Следующее задание открыто.':'Все районы доступны. Время ставить рекорды!'}</p>`:''}<button id="replay" class="play-button">${t(won ? 'replay' : 'retry')} ${svg('reset')}</button><div class="result-links"><button id="result-garage" class="text-button">Гараж ${svg('garage')}</button><button id="result-levels" class="text-button">Уровни ${svg('levels')}</button><button id="back-menu" class="text-button">Меню ${svg('arrow')}</button></div></section>`;
  $('#dialog').classList.remove('hidden');
  $('#replay').onclick = ()=>start(activeMissionId); $('#back-menu').onclick = menu;
  $('#result-garage').onclick=openGarage;$('#result-levels').onclick=openLevels;
  $('#replay').focus();
}
function updateHud(force = false) {
  const now = performance.now();
  if (!force && now - lastHud < 60) return;
  lastHud = now;
  const seconds = Math.ceil(sim.timeLeft);
  $('#timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('.timer-panel').classList.toggle('urgent', seconds <= 15);
  $('#mission-progress').textContent = sim.progress.toLocaleString('ru');
  $('#mission-target').textContent=` / ${sim.mission.target.toLocaleString('ru')}`;
  $('#hud-mission').textContent=sim.mission.title.toUpperCase();
  $('#hud-location').textContent=`УРОВЕНЬ ${sim.mission.id} · ${DISTRICTS[sim.mission.district].name.toUpperCase()}`;
  $('#hud-score').textContent=`ОЧКИ ${sim.score}`;
  $('#score-progress').style.width = `${Math.min(100, sim.progress / sim.mission.target * 100)}%`;
  $('#balance').textContent = sim.balance.toLocaleString('ru');
  $('#run-coins').textContent = sim.coins;
  $('#combo').classList.toggle('hidden', sim.combo < 2);
  $('#combo-value').textContent = sim.combo;
  const cooldown = sim.player.ramCooldown;
  $('#ram-status').textContent = cooldown > .05 ? t('ramCooldown',{time:cooldown.toFixed(1)}) : t('ramReady');
  $('#ram').classList.toggle('cooldown', cooldown > .05);
  $('#ram-progress').style.width = `${Math.max(0, 1 - cooldown / sim.vehicle.cooldown) * 100}%`;
  $('#ram strong').textContent=sim.vehicle.abilityName;
  $('#ram').setAttribute('aria-label',sim.vehicle.abilityName);
  $('#ram').setAttribute('aria-disabled', String(cooldown > .05));
}

controls.onReady = ready => { scene = ready; $('#play').disabled = false; $('#play-label').textContent = t('play');updateMenuMission(); };
controls.onEvents = events => {
  for (const event of events) {
    if (['ram', 'hit', 'destroy'].includes(event.type)) audio.play(event.type);
    if(event.type==='ability-start'&&event.vehicleId!=='dozer')audio.play('ram');
    if(event.type==='ability-impact')audio.play('hit');
    if(event.type==='chain'&&event.count>=2){toast(`ЦЕПНАЯ РЕАКЦИЯ ×${event.count}!`);audio.play('destroy');}
    if (event.type === 'destroy') { audio.play('coin'); save(); if (event.combo >= 2) toast(t('combo', {combo:event.combo})); }
  }
};
controls.onFinish = finish;
controls.onFrame = () => {
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
$('#sound').onclick = () => { audio.init(); settings.sound = !settings.sound; audio.enabled = settings.sound; soundButton(); save(); };
soundButton();

const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'];
window.addEventListener('keydown', event => {
  if (event.target.matches('input,select')) return;
  if (event.code === 'Escape' && $('#dialog').classList.contains('hidden')) { event.preventDefault(); if (!event.repeat) pause(!controls.paused); }
  if (!movementKeys.includes(event.code) || controls.screen !== 'playing' || controls.paused) return;
  event.preventDefault(); if (event.code === 'Space' && !event.repeat) controls.ramQueued = true; keys.add(event.code); updateInput();
});
window.addEventListener('keyup', event => { if (movementKeys.includes(event.code)) { event.preventDefault(); keys.delete(event.code); updateInput(); } });
window.addEventListener('blur', () => { clearInput(); pause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pause(true); } });

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
window.addEventListener('resize', () => { game.scale.resize(innerWidth, innerHeight); });
window.addEventListener('pagehide', () => { audio.update(0, false); });
// State helpers are opt-in and excluded from production builds by Vite.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  window.__smash = { sim, controls, game, settings, progress, start, menu, finish, openGarage,openLevels, get scene() { return scene; } };
}

const textureUrls=new Map();
function artUrl(key){
  if(!scene?.textures.exists(key))return '';
  if(!textureUrls.has(key)){const source=scene.textures.get(key).getSourceImage();textureUrls.set(key,source.toDataURL('image/png'));}
  return textureUrls.get(key);
}
function updateMenuMission(){
  const mission=getMission(activeMissionId);
  $('.scene-caption').innerHTML=`<span class="tiny-rule"></span> РАЙОН № ${mission.district==='town'?'01':'02'}<span class="caption-dot"></span>${DISTRICTS[mission.district].name.toUpperCase()}`;
  $('.mission-label .level-number').textContent=String(mission.id).padStart(2,'0');
  $('.mission-label strong').textContent=mission.title;
  $('.mission-label small').textContent=DISTRICTS[mission.district].name.toUpperCase();
  $('.hero-meta').innerHTML=`<span>${svg('clock')}${mission.duration} секунд</span><i></i><span>${svg('target')}${mission.target.toLocaleString('ru')} ${mission.objective==='score'?'очков':mission.objective==='destroy'?'зданий':'в цепи'}</span><i></i><span>Твоя следующая смена.</span>`;
}
function enterHub(name){
  if(!scene)return false;
  clearInput();controls.screen=name;controls.paused=false;
  $('#dialog').classList.add('hidden');$('#pause-overlay').classList.add('hidden');$('#toast').classList.add('hidden');
  setMenuVisible(false);$('#hud').classList.add('hidden');$('#pause').classList.add('hidden');
  document.body.classList.add('in-hub');
  $('#balance').textContent=sim.balance.toLocaleString('ru');
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
  $('#garage-screen').innerHTML=`<div class="hub-heading"><div><div class="eyebrow">ТВОЯ МАЛЕНЬКАЯ КОМАНДА</div><h2>Большие планы.<br><span>Подходящая техника.</span></h2></div><button id="garage-back" class="secondary-button">${svg('arrow','back-arrow')} В меню</button></div><div class="garage-layout"><div id="garage-list" class="vehicle-list">${Object.values(VEHICLES).map((v,i)=>`<button data-vehicle="${v.id}" class="vehicle-card ${garageVehicle===v.id?'viewing':''}" aria-pressed="${garageVehicle===v.id}"><span class="vehicle-number">0${i+1}</span><img src="${artUrl(`garage-${v.id}`)}" alt=""><span><strong>${v.name}</strong><small>${progress.state.selectedVehicle===v.id?'ВЫБРАНА':progress.state.ownedVehicles.includes(v.id)?'В ГАРАЖЕ':`${v.price} МОНЕТ`}</small></span>${svg(progress.state.ownedVehicles.includes(v.id)?'check':'lock')}</button>`).join('')}<div class="garage-tip">${svg('bolt')}<p>Новая техника меняет способ разрушения. Выбери свой стиль, а не просто больше силы.</p></div></div><div class="workshop-stage"><div class="workshop-tag">SMASH CITY <span>МОТОРНЫЙ ОТСЕК / 0${Object.keys(VEHICLES).indexOf(garageVehicle)+1}</span></div><img class="workshop-room" src="${artUrl('garage-room')}" alt="Уютная мастерская с инструментами"><img id="vehicle-preview" class="workshop-vehicle ${garageVehicle}" src="${artUrl(`garage-${garageVehicle}`)}" alt="${selected.name}"><div class="workshop-plate">${svg('garage')} ${selected.name.toUpperCase()}</div></div><div class="vehicle-details"><div class="eyebrow">${owned?'ГОТОВА К ВЫЕЗДУ':'НОВЫЙ СПОСОБ РАЗРУШЕНИЯ'}</div><h3>${selected.name}</h3><div class="vehicle-subtitle">${selected.subtitle}</div><p>${selected.description}</p><div class="ability-spec"><span>${svg('bolt')} ${selected.abilityName}</span><small>Перезарядка ${selected.cooldown.toFixed(1)} с</small></div><div class="vehicle-traits"><span>Темп движения</span><div>${[1,2,3].map(n=>`<i class="${n<=(selected.id==='dozer'?3:selected.id==='excavator'?2:1)?'filled':''}"></i>`).join('')}</div></div><div class="vehicle-price"><small>${owned?'В ТВОЁМ ГАРАЖЕ':'СТОИМОСТЬ'}</small><strong>${owned?'Куплена':`${selected.price} ◇`}</strong></div><button id="vehicle-action" class="play-button" ${active?'disabled':''}>${active?'Выбрана':owned?'Выбрать технику':`Купить за ${selected.price}`} ${svg(active?'check':owned?'arrow':'coin')}</button>${!owned&&sim.balance<selected.price?`<div class="funds-note">Не хватает ${selected.price-sim.balance} монет. Заработай их в заданиях.</div>`:''}<button id="garage-missions" class="text-button">К заданиям ${svg('levels')}</button></div></div>`;
  $('#garage-back').onclick=menu;$('#garage-missions').onclick=openLevels;
  document.querySelectorAll('[data-vehicle]').forEach(button=>button.onclick=()=>{garageVehicle=button.dataset.vehicle;renderGarage();});
  $('#vehicle-action').onclick=()=>{
    if(!progress.state.ownedVehicles.includes(garageVehicle)){
      progress.state.balance=sim.balance;
      const result=progress.purchase(garageVehicle);
      if(!result.ok){toast(result.reason==='insufficient-funds'?'Недостаточно монет. Попробуй ещё одно задание.':'Эта техника уже в гараже.');return;}
      sim.balance=progress.state.balance;
      audio.init();audio.play('coin');
      toast(`${VEHICLES[garageVehicle].name} теперь в твоём гараже!`);
    }
    progress.selectVehicle(garageVehicle);save();renderGarage();
  };
}
function openLevels(){
  if(!enterHub('levels'))return;
  districtFilter=getMission(activeMissionId).district;
  $('#levels-screen').classList.remove('hidden');renderLevels();
}
function renderLevels(){
  const district=DISTRICTS[districtFilter],districtOpen=progress.state.unlockedDistricts.includes(districtFilter);
  $('#levels-screen').innerHTML=`<div class="hub-heading"><div><div class="eyebrow">НОВАЯ СМЕНА — НОВЫЙ РЕКОРД</div><h2>Маленький город.<br><span>Большая работа.</span></h2></div><button id="levels-back" class="secondary-button">${svg('arrow','back-arrow')} В меню</button></div><div class="level-toolbar"><div class="district-tabs">${Object.values(DISTRICTS).map(d=>`<button data-district="${d.id}" class="${d.id===districtFilter?'active':''}" aria-pressed="${d.id===districtFilter}">${svg(progress.state.unlockedDistricts.includes(d.id)?'levels':'lock')}${d.name}</button>`).join('')}</div><button id="levels-garage" class="selected-machine">${svg('garage')} ${VEHICLES[progress.state.selectedVehicle].name} ${svg('arrow')}</button></div><div class="district-description"><p>${district.description}</p><small>${districtOpen?'Звёзды: за выполнение, быстрый и отличный результат.':'Откроется после задания «Срочный снос».'}</small></div><div class="mission-grid">${MISSIONS.filter(m=>m.district===districtFilter).map(m=>{
    const unlocked=progress.isLevelUnlocked(m.id),record=progress.state.records[m.id];
    return `<article data-mission="${m.id}" class="mission-tile ${unlocked?'':'locked'}"><div class="mission-illustration ${m.district}"><span class="mission-tile-number">0${m.id}</span><img src="${artUrl(`${m.district==='town'?(m.id===1?'shed':'house'):(m.id===3?'tower':'warehouse')}-0`)}" alt=""><div class="tile-stars">${[1,2,3].map(n=>`<span class="${n<=(record?.stars||0)?'earned':''}">${svg('star')}</span>`).join('')}</div>${!unlocked?`<span class="tile-lock">${svg('lock')}</span>`:''}</div><div class="mission-tile-body"><small>ЗАДАНИЕ 0${m.id} / ${m.objective==='chain'?'ЦЕПНАЯ РЕАКЦИЯ':m.objective==='destroy'?'СКОРОСТНОЙ СНОС':'ПОГОНЯ ЗА ОЧКАМИ'}</small><h3>${m.title}</h3><p>${m.description}</p><div class="mission-numbers"><span>${svg('clock')}${m.duration} с</span><span>${svg('coin')}Бонус ${record?Math.floor(m.reward*.25):m.reward}</span></div><div class="mission-record">${record?`<span>Рекорд <b>${record.bestScore.toLocaleString('ru')}</b></span><span>Комбо <b>×${record.bestCombo}</b></span><span>Время <b>${record.bestTime.toFixed(1)} с</b></span><span>Побед <b>${record.wins}</b></span>`:'<span>Твой первый рекорд ещё впереди.</span>'}</div><div class="star-rules">${svg('star')} 2 звезды ≤ ${m.starTimes[0]} с · 3 звезды ≤ ${m.starTimes[1]} с</div><button data-start-mission="${m.id}" class="play-button" ${unlocked?'':'disabled'}>${unlocked?(record?'Побить рекорд':'Начать смену'):`Пройди задание ${m.id-1}`} ${svg(unlocked?'play':'lock')}</button></div></article>`;
  }).join('')}</div><div class="levels-footer">${svg('coin')} Первое прохождение даёт полный бонус. При повторе: 45% монет за здания и 25% бонуса. Рекорды и звёзды сохраняются.</div>`;
  $('#levels-back').onclick=menu;$('#levels-garage').onclick=openGarage;
  document.querySelectorAll('[data-district]').forEach(button=>button.onclick=()=>{districtFilter=button.dataset.district;renderLevels();});
  document.querySelectorAll('[data-start-mission]').forEach(button=>button.onclick=()=>start(Number(button.dataset.startMission)));
}
