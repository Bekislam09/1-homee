// Stable message keys allow a platform adapter to select a locale later.
// Russian is the only shipped language; an unknown locale safely falls back.
export const messages = {
  ru: {
    play: 'Играть',
    mission: 'Начало разрушений',
    victory: 'Уровень пройден!',
    defeat: 'Время вышло',
    replay: 'Играть снова',
    retry: 'Повторить',
    ramReady: 'ГОТОВ К УДАРУ',
    ramCooldown: 'ЗАРЯДКА · {time} С',
    combo: 'КОМБО ×{combo}! Продолжай в том же духе.',
    desktopHelp: 'Двигайся к зданиям. Пробел — мощный таран!',
    touchHelp: 'Джойстик — движение. Кнопка «Таран» — мощный удар!',
  },
};
let locale = 'ru';
export function setLocale(value) { locale = messages[value] ? value : 'ru'; }
export function t(key, values = {}) {
  return (messages[locale][key] ?? messages.ru[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
