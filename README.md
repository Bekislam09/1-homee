# Smash City — City Demolition

Version 4: an English-only CrazyGames edition built with Phaser 3 and Vite. Five construction machines, twelve contracts across two isometric districts, multi-block demolition, combos, finite chain collapses and a persistent garage.

## Run and verify

Node.js 22.12+ and npm. Release packaging uses Python 3's standard library. Browser checks use Chromium at `/usr/bin/chromium` (override with `CHROMIUM_PATH`).

```sh
npm ci --cache /tmp/loot-npm-cache --no-audit --no-fund
npm run dev -- --port 5173
```

```sh
npm test
npx playwright test
npm run build:releases
npm run verify:releases
node scripts/smoke-releases.mjs
```

`npm run build` creates `dist`; `npm run preview` serves it. The `/?test` harness is available only in development.

## What's new

- Smooth acceleration, braking and bounded steering; vehicle silhouettes rotate in one-degree increments instead of snapping between eight directions. Articulated tools interpolate their windup, contact and recovery poses.
- A redesigned navy/orange home screen, featured machine, fleet shortcuts, sharper garage portraits and more detailed machine bodies.
- Twelve sequential contracts: two blocks in contracts 1–8 and three in contracts 9–12. Each block contains fourteen buildings; later blocks remix structure types and later contracts increase durability. Objectives require both their score/chain target and a minimum clearance, so one quick combo cannot finish a contract.
- Two new playable machines with distinct abilities, higher garage prices and an English-only interface regardless of browser or legacy language preference.

| Machine | Ability | Coins |
| --- | --- | ---: |
| Bulldozer | Forward ram | Free |
| Excavator | Focused bucket strike | 1,200 |
| Wrecking Ball | Wide area impact | 3,000 |
| Road Roller | Ground shock around the drum | 6,000 |
| Hydraulic Breaker | Three timed strikes against the nearest locked target | 10,000 |

All twelve contracts are tested through continuous control input with each of the five machines. The starter bulldozer can complete the entire campaign. The timer ranges from 270 to 510 seconds; completion time depends on driving and machine choice. There is no forced minimum waiting period. Buildings award coins; combos multiply score only. Repeat completions pay 45% building coins and 25% mission bonus.

WASD/arrows move, Space activates the ability and Esc pauses. Touch uses a joystick plus a separate ability button with simultaneous touches. Focus loss pauses the run. Free demolition has no timer or permanent coin earnings; restore the map to keep playing. Six achievements, daily rewards, sound, effects, shake and quality settings remain available.

## Saves and platform builds

The existing `smash-city-v3` save key remains compatible with v1/v2. Existing coins, owned machines, records and earned achievements are retained. Raising prices does not remove previously purchased machines. Progress is stored locally, with an in-memory fallback if storage fails; cloud saves are not implemented.

The selected build determines its SDK integration. CrazyGames uses the official SDK v3 URL. Basic has no advertising offers. Full enables ad requests only when the adapter is available, grants rewarded coins only after confirmation, and preserves independent pause/mute reasons. Local builds load no SDK. Russian catalogs and the dormant Yandex adapter remain for compatibility; **Yandex development and its old v3 ZIP are postponed and excluded from the v4 release pipeline**.

## Downloads

- [CrazyGames Basic ZIP](https://github.com/Bekislam09/1-homee/raw/refs/heads/main/releases/smash-city-crazygames-basic.zip) — first submission, no monetization.
- [CrazyGames Full ZIP](https://github.com/Bekislam09/1-homee/raw/refs/heads/main/releases/smash-city-crazygames-full.zip) — only after platform monetization approval and live ad checks.
- [Source ZIP](https://github.com/Bekislam09/1-homee/raw/refs/heads/main/releases/smash-city-source.zip) — source, tests and instructions, without dependencies or Git history.

Game ZIPs contain `index.html` at their root and relative assets. `releases/build-manifest.json` records their sizes and hashes; `http-smoke-report.json` records checks against extracted archives. The smoke script also generates actual production screenshots in `releases/promo`. Generated directories/reports are ignored; downloadable ZIPs are tracked in Git.

## Validation limits

172 unit checks and 14 browser scenarios pass. Unit checks cover all 60 mission/machine combinations, collision and ability timing, save migration, economy, ads and lifecycle. Browser checks cover real keyboard/touch input, menus, English-only behavior, layouts, smooth poses and bounded textures, plus ten complete consecutive missions. SDK callback fixtures are explicitly separate from production. Extracted archives are tested over HTTP with SDK loading intentionally denied, to verify playable recovery.

Real CrazyGames preview, advertising inventory, physical phones and hardware FPS still require external testing. Official documentation was unavailable through this environment's proxy (403), so current platform upload limits were not independently verified. No game-platform publication has been performed. The Vite Phaser chunk-size warning does not prevent builds.

See [ARCHITECTURE.md](ARCHITECTURE.md), [PUBLISHING.md](PUBLISHING.md), [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) and [PLAN.md](PLAN.md).
