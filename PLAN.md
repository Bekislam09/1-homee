# Smash City v4.2 — delivery record

## Completed implementation

- Smooth acceleration/braking and bounded steering; Space preserves the current facing direction.
- Continuous machine poses with one reusable dynamic canvas per machine, improved bodies and sharp garage portraits.
- Redesigned home screen with a city diorama and five fleet shortcuts; desktop, portrait and landscape layouts.
- Road Roller (area shock) and Hydraulic Breaker (three locked-target strikes), alongside the original three machines.
- Prices: free / 1,200 / 3,000 / 6,000 / 10,000 coins. Existing purchases and progress remain valid.
- Twelve sequential contracts, two or three blocks each, minimum clearance objectives, varied building types and increased durability in later contracts.
- English-only Local/CrazyGames behavior, including old Russian preferences. The Yandex v3 archive is frozen.
- Local plus CrazyGames Basic/Full release pipeline, ZIP integrity checks and extracted-archive HTTP smoke checks.

## Verification

- 178 unit checks pass, including all 60 combinations of contract and machine driven through continuous input without position/health/score mutations.
- Regression coverage includes steering, ability timing, target occlusion, remixed collapse properties, unique block IDs, one-time settlement and legacy saves.
- All 21 browser scenarios pass and cover menus, real keyboard/touch input for all five machines, English preference override, desktop/portrait/landscape layout, continuous pose rendering, fixed texture counts, pause/audio/settings, explicit ad fixtures and ten complete consecutive missions.
- Local, CrazyGames Basic and CrazyGames Full production builds pass. Both game ZIPs pass integrity and extracted HTTP checks (real destruction, 25 coins, map counter, keyboard dialog recovery, no page errors, forced English, dev harness absent).
- Production and ZIP checks are recorded in generated `releases/build-manifest.json` and `releases/http-smoke-report.json`. Run the commands in README to reproduce them.

## External checks still pending

Real CrazyGames SDK/iframe and ad inventory, physical Android/iOS devices, hardware FPS/heap profiling, current upload limits and platform moderation. Automated fixtures and SwiftShader emulation do not establish these results. Official documentation previously returned proxy 403. The user requested GitHub delivery; no game-platform submission is part of this release.

Previous v3 implementation and verification history remains in Git; its Yandex archive is intentionally unchanged.

## v4.1 design pass

- Installed the user-requested frontend-design skill with its license and pinned source; recorded the visual direction and review in DESIGN.md.
- Applied sky-blue/white/yellow toy-construction styling to home, garage, mission cards, HUD and secondary dialogs, with local Fredoka and a recolored workshop.
- Removed the duplicate hero machine display, shortened decorative copy and made labels more readable.
- Moved help to the header so it remains usable on phones; added narrow viewport and reduced-motion checks.
- Preserved the campaign, saved progress and English-only CrazyGames configuration. Yandex remains postponed.

## v4.2 usability pass

- Added a fixed-resource isometric block map with real destruction state and vehicle heading.
- Separated primary objectives and clearance requirements; added explicit completion checks and a block counter.
- Buffered deliberate ability taps during the final 150ms of cooldown, with cancellation on pause/reset/block change.
- Fixed a reproduced permanent-pause path caused by keyboard focus escaping Settings. Modal focus is contained, Escape closes appropriate windows, and focus returns to the trigger.
- Preserved native keyboard button activation and platform/ad pause locks.
- Reserved camera headroom below the HUD; checked the actual opaque silhouette of all five vehicles at spawn and the north boundary.
