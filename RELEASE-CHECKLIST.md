# Smash City v4 — release checks

This release targets English CrazyGames Basic/Full only. Yandex is postponed. Local fixtures do not count as live advertising or physical-device validation.

## Automated checks

- [x] Twelve contracts are winnable with each of five machines through continuous input.
- [x] Acceleration, braking, bounded steering and ability timing/target occlusion are covered.
- [x] Blocks preserve counters, use unique destruction IDs and settle the contract only once.
- [x] Remixed buildings receive the correct collapse behavior for their current type.
- [x] Existing saves, owned machines, coins, achievements and records survive the expansion.
- [x] Purchases, locked levels, stars, rewards, daily gifts and free mode are covered.
- [x] Local/Basic do not offer ads; Full callbacks and independent pause/mute reasons use explicit test fixtures.
- [x] English is forced for Local/CrazyGames even with Russian browser/save preferences.

Run `npm test` and `npx playwright test`. Browser checks include real keyboard/touch input, mobile layout, smooth pose changes without additional textures, forty district switches after warming and ten full missions in one session. Resource-count checks do not establish a complete memory profile.

## Packaged build checks

Run `npm run build:releases`, `npm run verify:releases` and `node scripts/smoke-releases.mjs`.

The pipeline creates Local and CrazyGames Basic/Full builds, verifies deterministic ZIP contents, hashes, root index.html and relative assets, and tests each extracted game archive over HTTP. It verifies actual keyboard destruction/coin collection, English with Russian preferences, no page errors and no production dev harness. SDK loading is intentionally blocked to test unavailable-SDK recovery. Actual production menu/gameplay/garage screenshots are generated under `releases/promo`.

The old Yandex archive must remain unchanged and is excluded from v4 checks. Source ZIP excludes dependencies, release binaries and Git history.

## Before platform submission

- [ ] Validate real CrazyGames SDK initialization, loading/gameplay calls and mute settings in platform preview.
- [ ] Validate actual ads, errors/cancellation, no inventory, one-time rewards and audio/focus behavior before Full.
- [ ] Obtain permission for CrazyGames Full monetization before using the Full ZIP.
- [ ] Test physical Android/iPhone/tablets and weak hardware; measure FPS and heap usage.
- [ ] Perform an extended manual playtest and tune difficulty using player feedback.
- [ ] Confirm current file/ZIP/cover limits and English listing details in the platform dashboard.
- [ ] Upload and submit for moderation when requested by the user.

Progress is local, not cloud-synchronized. Live platform checks remain separate from GitHub delivery.
