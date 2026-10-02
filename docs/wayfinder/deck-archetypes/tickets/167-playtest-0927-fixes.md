# Ticket 167 — The 09-27 Tidewrack playtest: gauntlet teams, four card changes, and five UI fixes

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 167a–167j (`46ac0a7..b86cb5b`). The status line below is kept as history.

**Type:** content + UI. **Status:** OPEN. Written 2026-09-28 from Henry's 09-27 playtest (`playtest-results/2026-27-09/tidalboss-rat_v2/notes.md` and `review.md`) and his rulings the same day:

> *"The boss should vary its first fights. But pull just from the WWF mingmings."*
> *"1. 5 power x 3 and upgrade to x4. 2. Yes [Surge Protection counts the team]. 3. Water has two scaling, Crushing Depths and something else. The other one can we just make that nature? 4. I think draw a card and no weakened. 5. Yes [write this ticket]."*
>
> And on the two questions this ticket first asked: *"[Kraken v1's Slander:] Replace with crushing depths I think."* *"[The enemy hand panel:] Shouldn't there be room? Currently the enemies are already moved over to give the panel space. I just want the enemies to slide as far to the right as they can. If the panel is open then push them towards the middle. If it is closed make sure there isn't a gap of 'white space' between them."*

Ten rows. Each row is **one commit**, with a **failing test first**.

| Row | What | Moves balance numbers? | Can it be built now? |
|---|---|---|---|
| 167a | Gauntlet fights 1–2 follow the boss team's element plan (Tidewrack: Water, Water, Fire) | Yes | Yes |
| 167b | Acorn Toss: 5 power ×3; Acorn Toss+: 5 power ×4 | Yes | Yes |
| 167c | Undertow+: "Draw a card." (no Weakened) | Slightly | Yes |
| 167d | Slander becomes a Nature card; Kraken v1 swaps its Slander for a second Crushing Depths | Yes | Yes |
| 167e | Surge Protection's refund counts the whole team's triggered draws | Yes | Yes |
| 167f | Card hover preview becomes a tooltip beside the mouse | No | Yes |
| 167g | Enemy hand panel: opens and closes on click only, stays open through the enemy turn; the enemies slide right to meet it, and toward the middle when it opens | No | Yes |
| 167h | Floating numbers: last longer, move slower, stop covering each other | No | Yes |
| 167i | Round every shield/Bark Shield number the player sees | No | Yes |
| 167j | The reward screen shows which body already has which patch | No | Yes |

Build in the order written.

---

## How to work this ticket (read this before any row)

1. **Read the whole row before editing anything.** File paths and line numbers were checked against `715d648` (2026-09-28). Line numbers drift; search for the quoted code.
2. **Write the test first and run it on the parent commit.** It must fail for the reason the row names. Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** If a row seems to need a change it does not name, stop and ask Henry.
4. **Card data lives in two places that must agree.** The game reads `src/engine/data/programs.json`. `docs/wayfinder/deck-archetypes/collection-v2/upgrades.json` is the table Henry reviews, and `src/engine/data/plusRegistry.test.ts` fails the gate unless every `+` card's `description` in `programs.json` equals that table's `plus` text **exactly**. So a card row edits both: the `text`/`plus` columns in `upgrades.json`, and the base and `+` entries in `programs.json`. **Do not** edit or regenerate `collection-v2/registry.json`, `browser.html` or `build.py`; Henry refreshes those himself with `npm run decks` and `python build.py`.
5. **Gate:** `npm run gate` must be green before each commit.
6. **Commits:** authored as Henry — `git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`. **No `Co-Authored-By` trailers.** The last line of every message is `HANDOFF: <one sentence>`.
7. **Do not push.** Report `git push origin playtest-polish`.
8. **Line endings:** keep each file's existing endings (`file <path>` before editing). CRLF for `docs/wayfinder`; a new file under `src/` is LF.
9. **Report** in plain English at the end: what changed per row, the numbers the rows ask for, and any decision you hit.

---

## 167a — Gauntlet fights 1 and 2 follow the boss team's element plan

**What Henry ruled.** *"The boss should vary its first fights. But pull just from the WWF mingmings."* At Tidewrack the boss team is Jörmungandr, Kraken and Sköll: Water, Water, Fire. So fights 1 and 2 field **a Water, a Water and a Fire body**, drawn at random from the species of those elements. That varies the fights (which species, which firmware, rolled stats) without bringing in an element the boss does not use.

**What exists today (166c).** `src/engine/run/gauntlet.ts`, `gauntletSlotPool`: slots 0 and 1 are the gym's element, and slot 2 is **any other element the region fields**. At Tidewrack the region is Nature | Water | Water+Fire, so slot 2 can be Nature or Fire. Henry wants it to be Fire, the boss's element.

**The element plan already exists.** `gymCompElementPlan(gym)` in `src/engine/run/gyms.ts` returns the boss team's elements, one per body, gym element first. It was ruled by Henry on 2026-09-11 for the approach biome. Measured today:

| Gym | Plan | Boss team |
|---|---|---|
| Emberfall | Fire, Fire, Nature | Fenrir, Sköll, Huldra |
| Tidewrack | Water, Water, Fire | Jörmungandr, Kraken, Sköll |
| Rootfall | Nature, Nature, Water | Huldra, Ratatoskr, Jörmungandr |

Early Access has two species per element (Fire: Fenrir, Sköll; Water: Kraken, Jörmungandr; Nature: Ratatoskr, Huldra). So at Tidewrack the two Water slots will always be Kraken and Jörmungandr in some order, and the variety is in the Fire slot (Fenrir or Sköll), each body's firmware (v1 or v2) and its rolled stats. Say this in the code comment so nobody reads it as a bug.

**The change**, in `src/engine/run/gauntlet.ts`:

1. Import `gymCompElementPlan` from `./gyms` (the file already imports `GYM_REGISTRY` from there).
2. Replace `gauntletSlotPool` and `GAUNTLET_GYM_ELEMENT_SLOTS` with:

   ```ts
   /**
    * TICKET 167a (Henry, 2026-09-28): *"The boss should vary its first fights. But pull just from
    * the WWF mingmings."* Fights 1 and 2 field one body per element of the BOSS team's plan
    * (`gymCompElementPlan`: Tidewrack Water/Water/Fire), each drawn from every species of that
    * element the region fields. Replaces 166c's "two gym-element bodies and one other", which could
    * put Nature into a Water/Fire gym.
    *
    * EA has two species per element, so two same-element slots are always those two species; the
    * variety is in the odd slot, each body's firmware and its rolled stats.
    *
    * Falls back to the whole region pool if a slot's element has no species in it, so a content gap
    * can never leave a slot with nothing to draw.
    */
   function gauntletSlotPool(run: IRunState, node: IRegionNode, slot: number, plan: ReadonlyArray<string>): string[] {
       const region = regionSpeciesPool(run, node);
       const element = plan[slot];
       if (!element) return region;
       const matching = region.filter((id) => GetMingmingData(id).primaryElement === element);
       return matching.length > 0 ? matching : region;
   }
   ```

3. In `rollGauntletFight`, compute the plan once above the slot loop, `const plan = gym ? gymCompElementPlan(gym) : [];`, and change the call to `gauntletSlotPool(run, node, slot, plan)`. **Nothing else in the loop changes**: one `drawSpecies` call per slot keeps the random-stream positions, so the boss fight is unchanged.
4. Update the `regionSpeciesPool` comment that mentions 166c to say 167a.

**Tests (first)**, in `src/engine/run/gauntlet.test.ts`. Replace the 166c test ("exactly two gym-element bodies…") with:

1. For each gym in `GYM_REGISTRY`, 40 seeds, `fightIndex` 0 and 1: enemy `i`'s `primaryElement` equals `gymCompElementPlan(gym)[i]` for i = 0, 1, 2. At Tidewrack this fails on the parent whenever slot 2 rolls Nature.
2. Tidewrack, fight 0, 40 seeds: at least **two different** lineups of `definitionId:activeOS` appear. This pins the "vary" half.
3. Keep the boss test (fight 3 fields the authored team).

**Commit:** `feat(gauntlet): fights 1-2 follow the boss team's element plan (167a)`.

---

## 167b — Acorn Toss: 5 power ×3, and the upgrade ×4

**Henry:** *"5 power x 3 and upgrade to x4."*

Today: `acorn_toss` is 0 energy, *"6 power, twice."*; `acorn_toss+` is *"6 power, three times."*

1. `programs.json`, `acorn_toss`: `description` → `"5 power, three times."`; `actions` → three `{ "type": "ATTACK", "power": 5, "target": "TARGET" }`.
2. `programs.json`, `acorn_toss+`: `description` → `"5 power, four times."`; `actions` → four of the same with power 5.
3. `upgrades.json`, row `acorn_toss`: `text` → `"5 power, three times."`, `plus` → `"5 power, four times."`. Keep `rule` as `"multi-hit: +1 hit"`.
4. Search for tests that pin Acorn Toss's numbers: `grep -rn "acorn_toss" src --include=*.test.ts --include=*.test.tsx`. Update only assertions about its power or hit count, and list each one in the report.

**Test (first):** a small test (`src/engine/data/acornToss.test.ts`) that reads the registry: `acorn_toss` has 3 ATTACK actions of power 5, `acorn_toss+` has 4. Fails on the parent.

**Note for the report:** both Ratatoskr decks, and every enemy Ratatoskr, carry two Acorn Tosses. This makes Ratatoskr stronger on both sides.

**Commit:** `feat(cards): Acorn Toss 5x3, upgrade 5x4 (167b)`.

---

## 167c — Undertow+: "Draw a card."

**Henry:** *"draw a card and no weakened."* The generator rule "+1 status stack" added a stack to a debuff the card puts on the caster. Undertow is the only one of the 98 upgrades this happened to (checked 2026-09-28).

1. `programs.json`, `undertow+`: `description` → `"Draw a card."`; `actions` → just `[{ "type": "DRAW", "amount": 1, "target": "SELF" }]`.
2. `upgrades.json`, row `undertow`: `plus` → `"Draw a card."`, and `rule` → `"self-debuff removed (Henry, 2026-09-28)"`.
3. Base `undertow` does not change.

**Test (first):** `undertow+` has no STATUS action and exactly one DRAW of 1. Also add a general guard in the same file: **no `+` card applies more of a debuff to its own caster than its base does** (debuffs: Weakened, Dazed, Burn, Poison, Asleep, Stunned). Both fail on the parent.

**Commit:** `fix(cards): Undertow+ draws a card with no Weakened (167c)`.

---

## 167d — Slander becomes a Nature card

**Henry:** *"Water has two scaling, Crushing Depths and something else. The other one can we just make that nature?"* The two Water cards that scale per stack of Dazed are Crushing Depths and **Slander** (15 power per stack of Dazed on the target). Nature has only the "if the target is Dazed" payoffs (Nagging Bite, Pile On), so a Nature Dazed deck had no scaler.

1. `programs.json`: `slander` and `slander+` → `"element": "Nature"`. Change nothing else on them.
2. `upgrades.json` has no element column; nothing to change there.
3. Check `docs/wayfinder/deck-archetypes/collection-v2/collection.json` for a `slander` entry with an element field. If there is one, change it to Nature too, and say so in the report.
4. **Kraken v1 swaps its Slander for a second Crushing Depths** (Henry, 2026-09-28: *"Replace with crushing depths I think"*). `src/engine/data/mingmingRegistry.ts`, `kraken.decks.kraken_v1` (around line 122): replace `"slander"` with `"crushing_depths"`, so the list ends `..., "pressure_point", "crushing_depths", "crushing_depths"`. Add one line to the comment above `decks:` saying why (Slander became Nature in 167d). The start kit does not carry Slander, so it does not change. **This also changes the Tidewrack boss**, whose Kraken runs `kraken_v1` (`bosses.ts`); say so in the commit message. Then `grep -n slander docs/wayfinder/deck-archetypes/collection-v2/collection.json` and list in the report any Kraken kit or build entry that still names it; do not edit `registry.json`.

What moves, for the report: reward picks draw from the party's elements, so Slander now appears in Nature parties' rewards (Ratatoskr, Huldra) and leaves Water parties'. Its same-element bonus moves the same way.

**Test (first):** `ProgramRegistry.slander.element === 'Nature'` and the same for `slander+`; `getDeckForOS('kraken', 'kraken_v1')` holds no `slander` and exactly two `crushing_depths`; and `slander` is in the Nature reward pool (`getPoolForElement('Nature')` or `rewardCardPool` for a Ratatoskr-only party; use whichever the existing reward tests use) and not in the Water pool.

**Commit:** `feat(cards): Slander becomes Nature; Kraken v1 runs two Crushing Depths (167d)`.

---

## 167e — Surge Protection's refund counts the whole team's triggered draws

**Henry:** yes to *"make its refund count the whole team's draws."*

**Context the code will show you.** Since Henry's 2026-08-30 ruling, triggered draws count **per caster**. That ruling was about Ink Stream's damage, which party width was tripling. Surge Protection's refund was changed to per-caster at the same time for consistency (`ConditionValidator.ts`, the `CARDS_DRAWN_TRIGGERED` case, with a long comment). Surge Protection (and its `+`) is the **only** card that uses that check. This row changes the refund only. **Ink Stream and every scaler stay per caster.**

**The change: a new constraint type, not a change to the old one.**

1. `src/engine/types.ts`, `ProgramConstraintType`: add, after `CardsDrawnTriggered`:

   ```ts
   /**
    * TICKET 167e (Henry, 2026-09-28): draws an EFFECT caused this turn for the caster's WHOLE SIDE.
    * `surge_protection`'s refund only. The 2026-08-30 per-caster ruling stands for everything else,
    * scalers included - see `CARDS_DRAWN_TRIGGERED`.
    */
   SideCardsDrawnTriggered: 'SIDE_CARDS_DRAWN_TRIGGERED',
   ```

2. `src/engine/core/ConditionValidator.ts`, `evaluateCardConstraint`: add a case after `CARDS_DRAWN_TRIGGERED`:

   ```ts
   case 'SIDE_CARDS_DRAWN_TRIGGERED': {
       if (!state) return true; // fail safe, same as CARDS_DRAWN_TRIGGERED
       const side = state.playerParty.some((e) => e.id === source.id) ? state.playerParty : state.enemyParty;
       const drawn = side.reduce((total, e) => total + (e.nonNaturalDrawsThisTurn ?? 0), 0);
       if (drawn < (constraint.value as number)) return false;
       break;
   }
   ```

   Count every body on the side, living or not: a draw that happened this turn happened.
3. `src/engine/data/lib/constraints.json`: add, after `card_drawn_check`:

   ```json
   "team_card_drawn_check": {
       "type": "SIDE_CARDS_DRAWN_TRIGGERED",
       "target": "SELF",
       "value": 1
   },
   ```

4. `programs.json`, `surge_protection` and `surge_protection+`: in the ENERGY action, change `"conditionals": [{ "id": "card_drawn_check" }]` to `"conditionals": [{ "id": "team_card_drawn_check" }]`. Descriptions become:
   - `surge_protection`: `"25 power. If an effect drew your team a card this turn, refund 1 Energy."`
   - `surge_protection+`: `"35 power. If an effect drew your team a card this turn, refund 1 Energy."`
5. `upgrades.json`, row `surge_protection`: `text` and `plus` to the same two strings.
6. **Every place that lists constraint types must know the new one.** Run `grep -rn "CARDS_DRAWN_TRIGGERED" src --include=*.ts --include=*.tsx`. For each hit that is about a **constraint** (not a `scaling`), add `SIDE_CARDS_DRAWN_TRIGGERED` beside it. At the time of writing that is:
   - `src/engine/actions/actionConditions.ts`, `COUNTER_CONSTRAINTS`;
   - `src/ui/utils/cardConditionals.ts`, its `COUNTER_CONSTRAINTS` set and the describe function (text: `` `if an effect drew your team ${c.value}+ card${Number(c.value) === 1 ? '' : 's'} this turn` ``);
   - `src/ui/utils/conditionalClauses.ts`, the `case 'CARDS_DRAWN_TRIGGERED':` fall-through (add the new case to the same group).

   Do not change the `scaling` hits (`ActionExecutors.ts`, `powerscale.ts`, `scalingLabels.ts`).
7. **Leave `card_drawn_check` in `constraints.json`.** If nothing else uses it after this row, say so in the report; do not delete it.

**Tests (first)**, in a new `src/engine/surgeProtectionTeam.test.ts`, using a 2v2 or 3v3 state (copy the setup of `triggeredDraw.test.ts`):

1. An ally's triggered draw satisfies the refund when the caster drew nothing itself → `evaluateCardConstraint` returns true. Fails on the parent.
2. With no triggered draws on the side, false.
3. An **enemy's** triggered draw does not count.
4. Ink Stream's per-caster scaling is unchanged: an ally's draw does not raise the caster's `CARDS_DRAWN_TRIGGERED` scaling value.

**Commit:** `feat(cards): Surge Protection refunds on the team's triggered draws (167e)`.

---

## 167f — The card preview becomes a tooltip beside the mouse

**What Henry reported (09-27).** *"Hovering over upgrades in the Workshop spazzes out. It can't move the list high enough."* and *"Hovering over the cards in the sell pile or in your deck tries to show the card details at the bottom of the div element which moves everything. The card should be static so it hovers next to the mouse and it should be outside of any containers. Like a tooltip."*

**Why it happens.** Ticket 165a (and 155h before it, for Edit Loadout) render the preview as an ordinary block **under the list, inside the panel**. The block grows the panel, the list moves under the mouse, the hover lands on a different row or none, the block changes or vanishes, and it repeats.

**This reverses a written rule. Update the comments that state it.** 155h put the Edit Loadout peek inside the panel (Henry, then: *"in the side panel"*) because `position: fixed` was anchored to the viewport centre and missed at every width but 1280. The new version follows the **mouse** and is drawn into the page body, so that failure cannot recur. Quote Henry's 09-27 line in each comment you replace.

**Where the preview is today (all four get the new tooltip):**

| Surface | File | Today |
|---|---|---|
| Upgrade list (market, workshop, gym gate) | `src/ui/screens/UpgradeBench.tsx` | `useCardPeek` + `<CardPeek className="upg-peek">` |
| Sell list | `src/ui/screens/MarketplaceNode.tsx` | `useCardPeek` + `<CardPeek className="sell-peek">` |
| Edit Loadout deck column | `src/ui/screens/LoadoutEditor.tsx` | its own `peek` state + `.led-peek` block |
| Enemy hand panel | `src/ui/components/EnemyHandPanel.tsx` | its own `peek` state + `.ehp-peek` block |

**The change.**

1. **`src/ui/hooks/useCardPeek.ts`**: add the pointer position to the state. Change the state to `{ target: CardPeekTarget; x: number; y: number } | null` and return `peek` (the target), `at` (`{ x, y }` or null) and `peekHandlers`. In `peekHandlers(target)`:
   - `onMouseOver` and a new `onMouseMove`: set the target and `x = e.clientX`, `y = e.clientY`. Coalesce moves to one `setState` per animation frame (`requestAnimationFrame`) so moving the mouse does not re-render 60+ times a second.
   - `onFocus` (keyboard): use the row's `getBoundingClientRect()`: `x = rect.right`, `y = rect.top`.
   - `onMouseOut` / `onBlur`: unchanged (the `relatedTarget` guard stays).
2. **`src/ui/screens/CardPeek.tsx`**: render through a portal, as the status badge tooltips do (`StatusBadges.tsx`, `createPortal(..., document.body)`):
   - `position: fixed`, `pointer-events: none` (**required**: the tooltip must never take the hover away from the row; that loop is the bug), a z-index above the run screens.
   - Placed at `x + 18`, `y - 40`. If that would run past the right edge of the window, place it to the left of the cursor instead (`x - 18 - tileWidth`). Clamp top and bottom to the window with an 8 px margin.
   - Scale it like the rest of the game: `transform: scale(s)` with `s = stageScale(window.innerWidth, window.innerHeight)` from `src/ui/components/stageGeometry.ts`, `transform-origin` on the side it grows from. Do the flip and clamp maths on the scaled size.
   - Props become `{ peek, at, className? }`. Render nothing when either is null.
3. Use it in all four surfaces:
   - **UpgradeBench** and **MarketplaceNode**: pass `at` to `<CardPeek>`. Keep 165a's wrapper around greyed rows (hover still has to work on disabled rows), and add `onMouseMove` from the handlers.
   - **LoadoutEditor** and **EnemyHandPanel**: move them onto `useCardPeek` + `<CardPeek>`, and delete their private `peek` state and `.led-peek` / `.ehp-peek` blocks. Keep their row-level behaviour (the `relatedTarget` guard is already in the hook).
4. CSS: delete `.upg-peek`, `.sell-peek`, `.led-peek`, `.ehp-peek`. Undo any layout rule that only existed to make room for the old block (for example 155h's `.led-rows { flex: 0 1 auto }` note); check each by eye.

**Tests (first)**, jsdom, extending the existing tests for each surface (`UpgradeBench.test.tsx`, `MarketplaceNode.test.tsx`, `LoadoutEditor.test.tsx`, `EnemyHandPanel.test.tsx`):

1. Hovering a row renders the preview **as a child of `document.body`**, not inside the panel. Fails on the parent.
2. Hovering does **not** change the panel's own child count or height. The layout-shift regression: fails on the parent.
3. Hovering a greyed (disabled) upgrade or sell row still shows it (165a's test, kept).
4. Mouse out hides it; keyboard focus shows it.
5. The preview has `pointer-events: none`.

**By eye:** screenshots of each of the four surfaces at 1280×720 and at the widest supported layout, with the cursor on a row near the bottom of the list. The Workshop one is the one Henry reported.

**Commit:** `fix(ui): card preview is a tooltip beside the mouse on every list (167f)`.

---

## 167g — The enemy hand panel stays where you put it

**What Henry reported.** *"The enemy hand disappears on enemy turn. If I open it, it should stay open until I close it. Also if it's closed, the enemies should be tight to the right side. Opening it should push them over."*

**What happens today** (`src/ui/components/EnemyHandPanel.tsx`, CSS in `src/index.css` around line 3885):

- It opens on **hover** (`onMouseEnter`) and on focus, and closes on **mouse leave**. CSS also opens it on `:hover` and `:focus-within`.
- It returns `null` whenever the enemy holds nothing (`total === 0`). As the enemy plays out its hand the panel vanishes, and the open state inside it is lost.
- The panel is 270 px wide on the right edge and slides **over** the enemy plaques (z-index 63 over the plaques' 62). Closed, only its 34 px tab shows.

1. **Move the open state up** to `BattleStage.tsx`: `const [enemyHandOpen, setEnemyHandOpen] = useState(false);`. Pass `open` and `onToggle` props to `EnemyHandPanel`, and remove its internal `open` state.
2. **Click only.** Remove `onMouseEnter` / `onMouseLeave` from the panel root and `onFocus` from the tab. The tab's `onClick` toggles, and Enter/Space on the tab do the same (it is already a `<button>`). In CSS, delete the `.ehp:hover` and `.ehp:focus-within` selectors from the open rule, leaving `.ehp.open`.
3. **Never vanish mid-fight.** Return `null` only when the enemy has no deck at all (`battleState.enemyMode !== 'CARDS'`), not when `total === 0`. With nothing to show, the tab reads `ENEMY HAND 0` and the panel body says `Nothing in hand.`
4. **The enemies slide to meet the panel's edge** (Henry: *"slide as far to the right as they can. If the panel is open then push them towards the middle. If it is closed make sure there isn't a gap of white space between them."*).

   **Why there is usually room, and sometimes not.** The stage is drawn at a scale and centred in the window (`stageGeometry.place`), but the panel is a fixed **270 real pixels** wide (34 when closed) against the window's right edge. On a wide window the centred stage leaves empty space at both sides. At 1920×1080, for example, the stage scale is 1.37, the enemy plaques end at x ≈ 1694, the closed tab starts at 1878 (a **184 px** gap: the white space Henry saw) and the open panel starts at 1642 (52 px of overlap). At exactly 1280×800 there is no side margin: the open panel would need a 186 reference-pixel shift, and only 76 are available before the enemies enter the reveal lane.

   **The rule, computed for the current window size:**

   - `panelEdge = viewportWidth − 8 − (open ? 270 : 34)`, in real pixels (the `.ehp` CSS: `right: 8px`, `width: 270px`, tab `34px`). Read those three numbers from one set of exported constants that the CSS comment points at, so they cannot drift apart.
   - `target = panelEdge − 12`: where the rightmost enemy plaque's right edge should sit.
   - `current` = the right edge of the rightmost enemy plaque with no shift: the largest `x + w` of `place(plaqueRect('enemy', i), W, H)` over the three enemy slots.
   - `shiftRef = (target − current) / stageScale(W, H)`, in reference pixels. Positive moves them right, negative moves them toward the middle.
   - **Clamp** so the front enemy sprite never enters the reveal lane: `shiftRef ≥ REVEAL_RECT.x + REVEAL_RECT.w − spriteRect('enemy', 0).x` (714 − 790 = **−76** today). Name it `ENEMY_MIN_SHIFT` and derive it from those rects; never type −76.

   Put this in a small pure function in `stageGeometry.ts`, `enemyShiftFor(viewportWidth, viewportHeight, panelOpen): number`, and call it from `BattleStage.tsx` with the viewport size the stage already uses. Give `spriteRect` and `plaqueRect` an optional last parameter `enemyShiftX = 0` (reference pixels), added to the **enemy** x only, and pass the shift through `useStageAnchors.ts` (it calls both) so the VFX anchors move with the bodies. Animate the slide with the panel's 200 ms transition, and none when animations are off (`:root[data-animations="off"]`).

   If the enemy has no deck (a MOVES fight, where the panel does not render), use the closed value, so the enemies still sit tight right.

   At a narrow window, where the clamp binds (1280×800), the open panel still covers part of the plaques. That is the reveal-lane rule winning, and it is expected; say so in a comment.

**Tests (first)**, extending `EnemyHandPanel.test.tsx` and `BattleStage.test.tsx`:

1. Hovering the panel does **not** open it; clicking the tab does; clicking again closes it. Fails on the parent.
2. The panel stays open across a state where the enemy's hand is empty (render with `total === 0` in CARDS mode): the tab is still there and `aria-expanded` is still true. Fails on the parent.
3. `plaqueRect('enemy', 1, -1, 50).x` is 50 more than `plaqueRect('enemy', 1)`; ally rects ignore the parameter.
4. `enemyShiftFor`: at 1920×1080 closed, the rightmost plaque's placed right edge lands 12 px left of `1920 − 8 − 34`; open, 12 px left of `1920 − 8 − 270`; at 1280×800 open it returns exactly `ENEMY_MIN_SHIFT`. These fail on the parent (the function does not exist).

**By eye:** screenshots at 1280×800 and 1920×1080, panel open and closed (four shots).

**Commit:** `fix(battle): enemy hand panel opens on click and stays open; enemies slide to its edge (167g)`.

---

## 167h — Floating numbers you can read

**What Henry reported.** *"The damage numbers cover each other and move away too fast. It's hard to read them."* Since 166b every status also adds a float ("Sharp ×4") into the same spots, so this is now worse than what he saw.

**Today** (`src/ui/components/UnitFxLayer.tsx`, `FxFloats`; `src/ui/hooks/useBattleVfx.ts`): each float lives `FLOAT_LIFETIME_MS = 1150`, animates for 1 s, rises 120 px on the stage (86 on the HUD), and six slots fan out **sideways** 24 px apart (15 on the HUD). Up to 8 per unit.

**The change:**

1. `useBattleVfx.ts`: `FLOAT_LIFETIME_MS` → **2000**. Keep `FLOAT_SLOTS = 6` and `MAX_FLOATS_PER_UNIT = 8`.
2. `FxFloats`: the animation `duration` → **1.8** s, with the opacity `times` → `[0, 0.06, 0.8, 1]` (they hold readable for most of the life). The default `rise` → **70** and the stage's → **90** (`BattleStage.tsx` passes `rise={120}` today).
3. **Stack them upward instead of fanning them sideways.** Each float starts `slot * 22` px **below** its default start (a vertical offset, not the `left` offset). All of them sit at `left: 50%`, except **status floats** (`f.kind === 'status'`), which go in their own column at `left: calc(50% - 70px)` so statuses never cover damage. Remove the `slotSpacing` prop, and its use in `BattleStage.tsx`.
4. Crit styling stays as it is.

**Tests (first):** in the existing `FxFloats`/`UnitFxLayer` or `MingmingUnit` test (search for `hud-float`): two floats on one unit render with **different vertical positions** and the same `left`; a `status` float's `left` differs from a `damage` float's. Both fail on the parent.

**By eye:** a screenshot of one burn card from fenrir_v2 (several damage and status floats at once), at 1280×720.

**Commit:** `fix(vfx): floating numbers stack, last longer, and statuses get their own column (167h)`.

---

## 167i — Round every shield number the player sees

**What Henry reported.** *"Barkshield numbers need to be fixed either to an int or 2 decimals. It currently reads as 1.3248929838928 when you hover over the target with barkshield."* Bark Shield is a percentage of max HP, so what it absorbs is almost never a whole number.

Found so far:

1. `src/ui/components/HandCardFace.tsx`, around line 152: the preview chip prints `ABS {preview.absorbed}`. That is the one Henry saw.
2. `src/ui/vfx/statusBurst.ts`, `statusFloatText`: since 166b it prints the raw stacks, so a Bark Shield application floats as "Bark Shield ×1.3248…".
3. `src/ui/hooks/useBattleVfx.ts`: the absorbed float, `` `-${absorbed} 🛡` ``.

**The change:** round to a **whole number** at each place it is displayed (`Math.round`), never in the engine. In `statusFloatText`, round the stacks and drop the `×N` when the rounded value is 1 or less. Then search for any other place a shield or absorbed amount is shown: `grep -rn "absorbed\|BarkShield" src/ui --include=*.tsx --include=*.ts`. Round those too and list them in the report. `StatusBadges.tsx` already rounds to one decimal; leave it.

**Tests (first):** `statusFloatText('BarkShield', 1.3248929838928)` has no decimal point; a `HandCardFace` render with `absorbed: 13.7` shows `ABS 14`. Both fail on the parent.

**Commit:** `fix(ui): shield and Bark Shield numbers display as whole numbers (167i)`.

---

## 167j — The reward screen shows who already has a patch

**What Henry reported.** *"I need to see which Mingmings already have a patch in the rewards screen."* Since 166e the screen only offers the patch to bodies without one, but it still doesn't say who has what.

1. `src/ui/components/BattleReport.tsx`: add a prop `heldPatches?: Readonly<Record<string, ReadonlyArray<string>>>` (default `{}`). Inside the patch block (the `FIRMWARE PATCH — FIT IT TO ONE BODY` box), under its explanation line, add one line per party member who holds a patch: `<name> — <patch name>` (use `getPatch(id)?.name`; the names come from `winners`). If nobody holds one, add no line.
2. `src/ui/components/BattleArena.tsx`: pass `heldPatches={run?.patches ?? {}}` to `<BattleReport>`.

**Test (first):** in a `BattleReport` test (copy `BattleReport.macros.test.tsx`'s setup), a bundle with `patchChoices` for one body and `heldPatches` naming another body with `amplifier` shows that body's name and "Amplifier". Fails on the parent.

**Commit:** `feat(rewards): the patch offer shows who already runs a patch (167j)`.

---

## After the card rows: one measurement

Rows 167a–167e change the balance. After 167e is committed, run the walker's per-node read on the parent of 167a and on 167e, with the same seeds: 60 seeds × 12 starters, fights ≤ 6 (the read 166f reported). Report the wild, elite and rival win rates for biomes 0 and 1, the ratatoskr_v1/v2 starters' own rates (Acorn Toss and Slander both land on them), and the gym clear rate. **Do not tune anything.**

---

## Henry's rulings on this ticket's questions (2026-09-28)

- **D1, Kraken v1's Slander:** replaced with a second Crushing Depths (built in 167d).
- **G1, the enemy hand panel:** the enemies slide as far right as the panel allows, toward the middle when it opens, never into the reveal lane (built in 167g).

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`46ac0a7..b86cb5b`), merged to `main` in PR #13.
