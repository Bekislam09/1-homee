import ru from './locales/ru.js';
import en from './locales/en.js';
import {MISSIONS,VEHICLES} from './content.js';
export const ENGLISH_ONLY=import.meta.env?.VITE_ENGLISH_ONLY===true;
for(const mission of MISSIONS){
  en[`mission.${mission.id}.name`]=mission.title;
  const goal=mission.objective==='score'?`Score ${mission.target.toLocaleString('en')} points and clear ${mission.minDestroyed} buildings`:mission.objective==='chain'?`Trigger a ${mission.target}-building chain and clear ${mission.minDestroyed} buildings`:`Demolish ${mission.target} buildings`;
  en[`mission.${mission.id}.description`]=`${goal} across ${mission.sectors} blocks. ${mission.strength? 'Reinforced structures. ':''}${mission.duration} seconds on the clock.`;
}
for(const id of ['roller','drill'])for(const field of ['name','subtitle','description','abilityName'])en[`vehicle.${id}.${field}`]=VEHICLES[id][field];

// Stable keys keep display text independent from simulation/content identifiers.
export const messages = {ru: {...en,...ru}, en: {...en}};
let locale = ENGLISH_ONLY?'en':'ru';
const listeners = new Set();

function supportedLocale(value) {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return language === 'ru' || language === 'en' ? language : null;
}

export function resolveLocale(manual, platformLanguage, browserLanguage) {
  if(ENGLISH_ONLY)return 'en';
  const manualLocale = supportedLocale(manual);
  if (manualLocale) return manualLocale;
  // A platform that specifies an unsupported language intentionally falls back
  // to English. A missing platform hint permits the browser fallback.
  if (typeof platformLanguage === 'string' && platformLanguage.trim()) return supportedLocale(platformLanguage) || 'en';
  return supportedLocale(browserLanguage) || 'en';
}

export function getLocale() { return locale; }
export function setLocale(value) {
  const next = ENGLISH_ONLY?'en':supportedLocale(value) || 'en';
  if (next === locale) return locale;
  locale = next;
  for (const listener of listeners) listener(locale);
  return locale;
}
export function onLocaleChange(listener) {
  if (typeof listener !== 'function') throw new TypeError('Locale listener must be a function');
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function addMessages(catalogs) {
  for (const language of ['ru', 'en']) {
    for (const [key, value] of Object.entries(catalogs?.[language] || {})) {
      if (typeof value === 'string') messages[language][key] = value;
    }
  }
}
export const registerMessages = addMessages;
export function t(key, values = {}) {
  return (messages[locale][key] ?? messages.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
export function formatNumber(value, options) { return Number(value).toLocaleString(locale, options); }
export const vehicleText = (id, field) => t(`vehicle.${id}.${field}`);
export const vehicleName = id => vehicleText(id, 'name');
export const missionText = (id, field) => t(`mission.${id}.${field}`);
export const missionName = id => missionText(id, 'name');
export const districtText = (id, field) => t(`district.${id}.${field}`);
export const districtName = id => districtText(id, 'name');
export const achievementText = (id, field) => t(`achievement.${id}.${field}`);
export const achievementName = id => achievementText(id, 'name');

// HTML catalog entries contain only trusted application markup, never user text.
export function translateDOM(root = globalThis.document) {
  if (!root) return;
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of root.querySelectorAll('[data-i18n-html]')) element.innerHTML = t(element.dataset.i18nHtml);
  for (const attribute of ['aria-label', 'title', 'placeholder']) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
  }
}
