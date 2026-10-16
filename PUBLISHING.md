# Smash City — публикация и статус проверки

## Статус

Игра и адаптеры реализованы; локальные callback-тесты не доказывают работу настоящей рекламы. Реальные platform-preview, монетизация, устройство и модерация остаются обязательными внешними проверками. Официальные документационные URL из ТЗ в этой машине отвечали proxy 403; актуальные квоты ZIP, изображений и кабинетов не подтверждены. Код следует указанным в ТЗ API и безопасно работает при недоступном SDK. Не отправляйте релиз как полностью проверенный на площадках до этих шагов.

## Какие файлы загружать

- Яндекс Игры: `releases/smash-city-yandex.zip` (папка `releases/yandex`). SDK загружается относительно `/sdk.js`; локально этот путь отсутствует, и игра продолжает работать без рекламы.
- CrazyGames, первая отправка Basic Launch: `releases/smash-city-crazygames-basic.zip` (`releases/crazygames-basic`). SDK v3 подключается, реклама и её кнопки отключены конфигурацией.
- CrazyGames Full: `releases/smash-city-crazygames-full.zip` (`releases/crazygames-full`). Использовать только после разрешения монетизации площадкой и проверки реального SDK/рекламы.
- Локальная версия: `dist`. Исходники: корень проекта и `src/smash`.

Сборка: `npm ci --cache /tmp/loot-npm-cache`, `npm test`, `npx playwright test`, `npm run build:releases`, `npm run verify:releases`, `node scripts/smoke-releases.mjs`.

`releases/build-manifest.json` содержит размеры, количество файлов и SHA-256. ZIP имеют `index.html` в корне, относительные пути, игровые assets, без исходников/тестов/node_modules. `http-smoke-report.json` описывает фактически выполненные проверки извлечённых ZIP. Размеры и количество файлов нужно сопоставить с актуальной формой платформы после восстановления доступа.

## Яндекс Игры — данные карточки

**RU:** Smash City: Разрушитель города. **EN:** Smash City: City Demolition.

**Кратко RU:** Управляй строительной техникой, сноси игрушечный город и запускай цепные обрушения!

**Полное RU:** Маленькие машины, большие разрушения! Освой бульдозер, экскаватор и разрушительный шар. Сноси сараи, магазины, склады и башни в двух изометрических районах. Пройди четыре задания, создавай комбо, запускай цепные реакции и ставь рекорды. Открывай технику за игровые монеты, собирай достижения или отдыхай в свободном режиме без таймера. Прогресс сохраняется локально в браузере.

**Жанр:** аркада, симулятор разрушений, казуальная игра. **Особенности:** три способности, два района, четыре задания, шесть достижений, ежедневная необязательная награда, русский/английский.

**Управление:** WASD/стрелки — движение; Space — способность; Esc — пауза. На сенсорном экране — джойстик и кнопка способности. Основная ориентация горизонтальная, портретная адаптирована.

**Устройства:** браузеры с Canvas/WebGL, ПК и сенсорный ввод; реальные Android/iPhone/планшеты и слабое оборудование ещё требуют проверки. **Языки:** русский и английский, ручной выбор выше SDK/браузера; неизвестный язык — English.

**SDK в коде:** `YaGames.init`, `LoadingAPI.ready`, `GameplayAPI.start/stop`, platform pause/resume, fullscreen и rewarded callbacks; rewarded начисляется только по подтверждению `onRewarded` и однократной обработке результата. Облачное сохранение не реализовано. Локальный кошелёк не выдаётся за облачный.

**Шаги:** создайте приложение в консоли → проверьте актуальные требования → загрузите Yandex ZIP в черновик → откройте тестовый iframe → убедитесь в Game Ready и событиях gameplay → проверьте паузу, звук, закрытие/ошибку/успех рекламы → проверьте отсутствие двойной награды после reload → заполните карточку и реальные устройства → отправьте на модерацию самостоятельно. Мы ничего не загружали и не публиковали.

## CrazyGames — English listing

**Game title:** Smash City: City Demolition.

**Short description:** Drive tiny construction machines, demolish a toy city and set off satisfying chain reactions.

**Full description:** Small machines. Big demolition. Master a bulldozer, an excavator and a wrecking ball across two charming isometric districts. Complete four missions, build combos and topple industrial towers into neighbouring structures. Unlock vehicles with in-game coins, earn six achievements and beat your own records. Prefer a quiet break? Try free demolition without a timer. Progress is saved locally in your browser.

**How to play:** Choose a machine and an unlocked mission. Face a structure and use your special ability. Collect points, link demolitions for combos and finish before the timer runs out. Coins are not earned in free play.

**Controls:** WASD/arrows to move, Space for the selected ability, Esc to pause. Touch: virtual joystick and ability button.

**Main features:** three different machines; four missions; two districts; area attacks and finite chain collapses; garage; records and stars; achievements; English/Russian interface.

**Genre:** casual arcade / demolition. **Mobile compatibility:** responsive portrait/landscape controls and simultaneous touch are tested in desktop Chromium emulation; physical iOS/Android/tablet validation is pending.

**SDK:** HTML5 SDK v3 URL `https://sdk.crazygames.com/crazygames-sdk-v3.js`; init, loading/gameplay events, settings muteAudio, feature-detected settings listener; Full-only midgame/rewarded requestAd. Basic has no ad offers. Real runtime compatibility is not established by mocks.

**Upload:** begin with Basic ZIP → use the platform preview → verify SDK environment and loading/gameplay calls, local persistence and touch → inspect current upload limits/cover requirements → submit Basic. Enable Full only after the platform permits monetization, then test actual ad callbacks and forced audio mute before uploading the Full ZIP. Do not assume a live release stage from a hostname or query parameter.

## Изображения

`releases/promo/cover-1920x1080.png` — 16:9, `cover-1080x1080.png` — 1:1, `cover-800x1200.png` — 2:3. Это настоящие снимки меню локальной production-версии, а не нарисованный концепт. `gameplay-1920x1080.png` и `garage-1920x1080.png` сняты из работающей игры. Файлы создаёт HTTP smoke-скрипт. Проверяйте наличие файлов перед загрузкой.

1920×1080 следует размеру горизонтальной обложки из пользовательского ТЗ. Окончательные обязательные размеры, типы и лимиты изображений нужно сверить в текущей форме каждой площадки; они не были независимо подтверждены здесь.

## Источники для обязательной сверки

- https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events
- https://yandex.ru/dev/games/doc/ru/concepts/requirements
- https://docs.crazygames.com/sdk/intro/
- https://docs.crazygames.com/sdk/video-ads/
- https://docs.crazygames.com/sdk/game/
- https://docs.crazygames.com/requirements/ads/
- https://docs.crazygames.com/requirements/intro/

Нужно разрешить в настройках среды `yandex.ru`, `yandex.com`, `docs.crazygames.com`, `sdk.crazygames.com`, затем повторить чтение документации. Изменения доменов сохранены в черновике, но их применение и публикация среды — отдельное действие пользователя.
