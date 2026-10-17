# Smash City visual direction

Applied skill: `.agents/skills/frontend-design/SKILL.md` (Anthropic frontend-design).

## Plan

Subject: a playful miniature demolition game for desktop and touch. The first job is to make playing and choosing a machine immediately obvious.

Palette: sky #D9F0FF, paper #FFFFFF, ink #183D64, machine yellow #FFD34E, workshop blue #2878BC, reward green #277B57. Blue shadows give panels depth; yellow identifies primary actions and selected equipment.

Type: locally bundled Fredoka variable, 400–700. Rounded heavy display letters suit chunky toy vehicles; medium text stays readable. Sentence case for UI text. Small data labels are at least 11–12px except narrow phone fleet labels. Font source: Google Fonts ofl/fredoka, SIL Open Font License bundled in src/smash/fonts/OFL.txt; converted losslessly from TTF to WOFF using fontTools.

Layout: title and contract controls on the left, actual city on the right, a vehicle selection tray underneath. On phones the title/controls sit above the city and compact fleet tray. Align control text left; center vehicle previews.

```
brand                         coins / sound / settings
Smash City             actual playable city diorama
contract + Play
Garage / Levels
secondary modes
Your fleet     [dozer] [bucket] [ball] [roller] [breaker]
```

Garage: machine selector, workshop preview, readable specifications and purchase action. Contracts: illustrated job cards with legible objectives, stars and lock state. HUD: white instrument panels, clear numbers, yellow ability control. Secondary dialogs share these materials.

## Review before implementation

The earlier proposal repeated the selected machine in a large floating card and every fleet item, surrounded by marketing labels. Remove that redundant hero card and idle animation; let the actual city be the main illustration. Replace the old cream palette, thin borders and tiny uppercase labels with blue/white construction-toy panels and direct wording. Keep numbered contracts because they form a real sequence; remove decorative machine numbering. Use one short title entrance and feedback on deliberate interactions, respecting reduced motion.

## Verification

Review desktop, portrait and landscape screenshots of menu, garage, contracts, HUD and dialogs. Check keyboard focus, touch targets, overflow, purchases, pauses and real play. Keep fonts local for platform ZIPs and preserve saves/gameplay.

## Screenshot critique and refinements

Desktop review confirmed the city remains the primary illustration and garage purchase details are legible. On short phones, moved the city viewport below the secondary controls to avoid overlap. Added a header help control, improved locked-action text contrast and checked 320×640, 360×640, 390×844, 800×1200, 844×390 and desktop layouts. Removed the redundant selected-machine hero card. Reduced motion disables the title entrance and workshop idle motion; the workshop is static. No gameplay timing, prices or save migration changed.

Tablet portrait uses two columns of controls above a full-width city viewport. The mobile help dialog now constrains its grid column to the viewport; a regression check verifies both bounds and internal overflow at 320px. Local Fredoka loading and reduced-motion behavior are covered in the browser suite. The font license is included in website and CrazyGames artifacts.

Validation: 172 unit tests and all 15 browser scenarios passed. After the last help-number wrapping adjustment, all three layout/font/texture scenarios passed again. Help, settings, daily rewards, achievements and free-play dialogs were inspected at 320×640 with no horizontal overflow.

## Usability pass (4.2)

Keep the construction-toy palette and Fredoka; make information useful during actual play. The goal panel separates the score/chain requirement from building clearance, with a green completed state for each. A compact isometric site map uses blue for standing buildings, muted gray for cleared sites and a yellow directional player marker. Place it below the coin instrument on desktop and above the ability control on phones. Keep the center of the playfield open; do not add decorative motion or more marketing panels.

```
time       contract / block                 coins
           score target + progress          site map
           required clearance + progress
                     playfield
joystick                                    ability
```

Review: two equal large bars would dominate a phone. Use the primary objective as the larger number and make clearance a compact second line; destroy missions use one shared requirement. The map must reflect the current simulation, including sector changes and free play, with fixed canvas resources. Modal behavior needs keyboard containment, Escape and restoration of focus so the menu behind a dialog cannot interrupt a run.


Usability screenshots: reviewed 1366×768 home, desktop play, 320×640 touch play and 844×390 landscape. Controls and map fit without horizontal overflow. The camera now reserves space above the actual vehicle silhouette so the north edge cannot hide it behind the objective panel. This is verified across all five machines; no camera DOM reads occur in the frame loop.

Final review shortened the ability-ready text and cooldown countdown so landscape buttons do not clip their status. Help now explains the real contract requirement: meet the target and clear buildings across all blocks. Validation: 178 unit checks and 21 browser scenarios passed; the five layout/navigation scenarios were repeated after the final copy edit. Production archive smoke also checks the map counter and keyboard recovery from Settings.
