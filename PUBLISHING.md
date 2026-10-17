# Smash City v4 — CrazyGames delivery

The current release is English only. Yandex is postponed; its tracked ZIP is the previous v3 artifact and is not rebuilt or part of the current verification.

## Choose the archive

Start with `releases/smash-city-crazygames-basic.zip`: SDK v3, no ads or reward offers. Use `smash-city-crazygames-full.zip` only after CrazyGames permits monetization and real callbacks have been verified in its preview. `smash-city-source.zip` is the editable project, not the upload build.

Build and validate with the commands in README. Both game archives place `index.html` at the root. The generated manifest contains exact sizes/hashes. HTTP smoke tests use extracted ZIPs and actual keyboard input, deliberately block the SDK, assert English even with Russian preferences, and verify that the dev harness is absent. These checks do not establish live SDK/ad compatibility.

## English listing

**Title:** Smash City: City Demolition

**Short description:** Drive five construction machines, demolish a toy city and set off satisfying chain reactions.

**Description:** Small machines. Big demolition. Master a bulldozer, excavator, wrecking ball, road roller and hydraulic breaker across two isometric districts. Take on twelve contracts spanning two or three city blocks, build combos and topple industrial towers into neighbouring structures. Earn coins, expand your fleet, collect six achievements and improve your records. Prefer a quiet break? Try free demolition without a timer. Progress is saved locally in your browser.

**How to play:** Choose a machine and an unlocked contract. Face a structure and use your special ability. Clear the required number of buildings and reach the contract's score or chain target before time runs out. When a block is cleared, the next block opens automatically. Coins are not earned in free play.

**Controls:** WASD/arrows to move, Space for the selected ability, Esc to pause. Touch: virtual joystick and ability button.

**Features:** Five machines with distinct abilities; twelve multi-block contracts; two districts; combos and finite chain collapses; upgrades to your fleet through purchases; records and stars; achievements; English interface.

**Genre:** Casual arcade / demolition. **Devices:** Desktop and touch controls; portrait/landscape tested in Chromium emulation. Physical iOS/Android/tablet testing remains pending.

## Platform checks before submission

Use the Basic ZIP in CrazyGames preview. Confirm SDK environment, loading/gameplay events, mute settings, focus/visibility pause, local persistence and touch controls. Verify current file/ZIP/image limits and listing requirements in the current dashboard. For Full, additionally verify real ad success, cancellation, missing inventory, errors, audio mute and one-time rewards after reload. Callback fixtures in this repository are not real advertising.

`scripts/smoke-releases.mjs` generates actual production screenshots: `cover-1920x1080.png`, `cover-1080x1080.png`, `cover-800x1200.png`, `gameplay-1920x1080.png`, `garage-1920x1080.png` in `releases/promo`. Menu captures are covers; gameplay captures show the actual game. Check the dashboard's accepted dimensions before uploading.

Reference documentation: https://docs.crazygames.com/sdk/intro/, https://docs.crazygames.com/sdk/video-ads/, https://docs.crazygames.com/sdk/game/, https://docs.crazygames.com/requirements/intro/. These pages were denied by the environment proxy (403); current requirements have not been independently confirmed. No platform upload or moderation submission has been performed.
