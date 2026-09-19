# Ticket 155 — Battle-screen defect pass: what Henry's 2026-09-19 build showed, and why

**Type:** UI + one hook fix. **Status:** OPEN — Henry's playtest report 2026-09-19 (*"the hand takes
up too much space … any time I drag a card all the text gets highlighted … draw pile shows +4 …
energy pips don't appear … discard count is on the End Turn button … tooltips are not very helpful
… I don't see any VFX … Edit Loadout hover shows in the middle of the screen"*), verified against
HEAD by a code review (all 201 UI tests green — every defect below ships past the suite).
**Branch:** current, one commit per lettered row, authored as Henry. **Relates to:** 145 (the spec
these rows restore), 146 (dead on arrival — row 155a), 147 (its wiring waits on 155a).

---

## 1. The two that matter most

### 155a — 146 is dead on arrival: the cast/impact hooks unsubscribe every render — CRITICAL

Settings default on, the `ParticleLayer` is mounted at z 61, the bus is live. What kills it is hook
lifetime: `useCastSequence` (`src/ui/vfx/useCastSequence.ts:107–263`) and `useImpactFeedback`
(`useImpactFeedback.ts:44–102`) both list `[battleState]` as their effect dependency. Every play
produces a new `battleState`; the reducer emits `PROGRAM_PLAYED` synchronously inside the dispatch,
the handler arms a `setTimeout(…, 0)`, and React's re-render runs the effect **cleanup first** —
which nulls `open`, empties the queue and clears every timer. The 0 ms closure then sees a closed
window and drops the cast. Trails, impacts and queued status tells never fire; `resetHitStop()` in
`useImpactFeedback`'s cleanup (`:100`) undoes `requestHitStop` (`:82`) in the same tick, so the
shake plays with no stop and reads like the old one. `useBattleVfx` (floats, lunges, reveal) still
works because it is mount-scoped with a `stateRef` — that is the pattern to copy.

Fix: both hooks `useEffect(…, [])` (or `[stageControls]`), state read through
`const stateRef = useRef(battleState); stateRef.current = battleState;`. Test: mount, emit
`PROGRAM_PLAYED`, re-render with a new state object before the 180 ms trail, assert the particle
sink was called. (`useImpactFeedback.test.tsx:34` mounts once with a constant state and never
re-renders, which is why the suite is green.)

### 155b — The console is 390 px tall and the third row is under it — CRITICAL

Four compounding causes. **(i)** The hand card is 180×255, not the spec's 140×176:
`fanGeometry.ts:39–40` and `index.css:3386–3387`; a 2026-09-10 note overrode the spec to the old
`.program-card` size and `fanGeometry.test.ts:33` now pins it. **(ii)** The console band is
content-sized: `.console-area { flex: 0 0 265px }` (`index.css:63–74`) with `min-height: auto`
grows to ≈390 px (15 + `.hand-row` 208 + `.hand-footer` ≈140 + 15). **(iii)** The stage geometry
assumes a 210 band: `stageScale()`/`place()` (`stageGeometry.ts:167–193`) compute
`bandHeight = H − 44 − 210` while the real stage is `H − 390`; at 1920×1006 row 2's sprite bottom
lands at 702 in a 616 px band, at 1280×800 rows 2 are fully hidden and the 831 px screen clips
END TURN. **The third ally and third enemy are never visible at any viewport.** **(iv)**
`.console-area` z 20 > `.stage-area` z 10, so the fan paints over sprites.

Fix, as one layout pass: card back to 140×176 (`--cw/--ch/--ah 44`, overlaps −18 / −30), with an
optional uniform scale from `useStageAnchors().scale` capped at 1.2 (168×211 at 1920 — still
smaller than today); `.console-area { flex: 0 0 var(--console-h); min-height: 0 }` with
`--console-h = CONSOLE_H × scale` set by `BattleArena`; piles **inside** the hand row per 145 §2c
(draw | fan | discard + End Turn — delete `.hand-footer`'s second row; caster banner + hotkeys as
one 14 px line under the fan); `.hand-row { height: auto }`; `stageGeometry.ts:168,185` subtract
`CONSOLE_H × scale` consistently. Hand-width guard: `HAND_SIZE_LIMIT` is 15 but the fan stops
tightening at 8 (`FAN_WIDE_HAND`), so an 11-card hand is 1,590 px wide and clips both ends at 1280
— compute overlap from the row width past 8. Test: all six slots inside the stage box at 1280×800
and 1920×1080; the console band equals `CONSOLE_H × scale`.

## 2. The rest of Henry's list

- **155c — text selection on drag (HIGH).** `.rs-card`/`.hand-card` have no `user-select: none`
  (the old `.program-card` did, `index.css:667`) and `onPointerDown` (`CardHand.tsx:237`) never
  `preventDefault()`s. Fix: `.battle-screen { user-select: none }`; `e.preventDefault()` first
  line of `onPointerDown`. Do **not** `setPointerCapture` — the drop is `onPointerUp` on the
  `StageSlot` (`BattleStage.tsx:265`).
- **155d — draw pile "+4/turn" (HIGH).** `describeDraw` (`drawFormula.ts:78–80`) clamps
  `HAND_SIZE_LIMIT − hand.length` against the **current** hand; during your turn with 11 in hand
  that is 4. The engine discards your hand at END_TURN *before* the refill (`battleReducer.ts:1196`
  → `:1330–1334`), so the real number is `sum(cardDraw) − (N−1)` = Fenrir 4 + Ratatoskr 5 + third
  body − 2 ≈ 11–12, Henry's "~12". Fix: `handRoom = activeSide === side ? HAND_SIZE_LIMIT :
  HAND_SIZE_LIMIT − hand.length`; print `formulaTotal` with a cap marker only when capped. Test
  the player-turn case (only the enemy-turn case is tested today, `drawFormula.test.ts:135–158`).
- **155e — cards: no pips, not the shop card (HIGH).** `--el` is never set on hand cards
  (`CardHand.tsx:251–265` sets only `--stab-*`; every shop/editor caller sets `--el`). With it
  undefined the pips are transparent (`runShell.css:193–199`), the art gradient is invalid (blank
  band), the element foot bar is gone. One line fixes the look: `'--el': getElementAccent(element)`.
  Then make it *the* shop card: `HandCardFace` diverges from `CardTileFace` in box-sizing
  (border-box → 18 px less interior), left-aligned text, art band 44 vs 56, a `div` instead of a
  `<button>` (no focus), three extra rows (target chip, keyword chips, the readout) that starve the
  description (it clips mid-sentence in the screenshot), the element word replaced by the readout,
  a duplicated status row (`statusSummary` under the keyword chips — screenshot 2 shows both), the
  `×1.5` STAB text (ticket 66 ruled no STAB text), and 7.5–8 px type in the readout. Fix: one
  `CardFace` for shop, editor, hand and lane (the lane card, `PlayedCardReveal.tsx:178`, is a
  *third* chassis — the old `ProgramCard`); readout on one line in `.rs-tags` beside the element
  word (`FIRE · 96 DMG vs SKOLL`); keyword chips carry the stacks; target chip as a small tag on
  the name row; no STAB text (the `--el` glow is the STAB cue).
- **155f — discard count on End Turn (MEDIUM).** `.pile-count { position:absolute; right:-8px;
  bottom:-6px }` (`index.css:1413–1430`) anchors to `.pile-indicator` — the whole column, which
  contains the button (`CardHand.tsx:387–403`). Same bug puts the draw count over "+4/turn". Fix:
  wrap card + count in a `position: relative` span. (Falls out of 155b's pile move.)
- **155g — tooltips (MEDIUM).** `formatAction` (`CardHand.tsx:42–68`) switches on action types
  that don't exist (`APPLY_STATUS`, `REMOVE_STATUS`, `ADD_ENERGY`); the real union is `STATUS |
  CLEANSE | ENERGY | TAUNT | MULTIPLY_STATUS | TRIGGER_STATUS | BUFF_NEXT_PROGRAM | …`
  (`types.ts:325`), so everything falls to `default: return action.type` — the literal
  "STATUS STATUS STATUS". The empty "⚠ REQUIREMENTS" header is `formatConstraint` returning `''`
  for `BASE` while the section still opens. Fix: rewrite against the real union — `STATUS` → "2×
  Weakened → target" + the glossary line; `ATTACK` → the caster-scoped preview ("96 dmg vs Sköll,
  ×1.5 STAB") with power in parentheses; `BASE` → "Needs 2 EP (have 1)"; a KEYWORDS section from
  `KEYWORD_INFO`; drop the native `title` (double tooltip); phrase "any living unit" on an attack
  as "One enemy (can also target an ally)". Remove the `as string` cast at `CardHand.tsx:46` that
  hid this from the compiler.
- **155h — Edit Loadout peek (MEDIUM).** `.led-peek { position: fixed; right: calc(50% + 360px) }`
  (`LoadoutEditor.css:87–95`) is anchored to the viewport centre, tuned for 1280; at any wider
  window it lands on the grid. Henry: *in the side panel*. Fix: render the peek inside `.led-deck`
  under the rows (`position: static; margin: 10px auto 0`; `.led-rows { flex: 0 1 auto }`).

## 3. Found in the deep dive (by severity)

1. **Fan paints over the footer** (`.hand-footer` z auto vs cards z-indexed; "DISCARD" reads "RD"
   in the screenshot) and the ticket-24 `Callout` floats where row 2's sprites are. Fix with 155b.
2. **Reveal-lane flight goes to the wrong point**: the lane is at `top:38%; left:50%`
   (`PlayedCardReveal.tsx:116`) but its entry/exit deltas use `place(REVEAL_RECT)`, and
   `HAND_ANCHOR`/`DISCARD_ANCHOR` (`stageGeometry.ts:124–152`) are ref-frame guesses 100–250 px
   from the real fan/piles. Position the lane at `anchors.reveal`; publish the pile/fan rects from
   the console.
3. **Top bar**: log line renders `''` on turn 1 leaving a lone chevron; the gear is a `<span>` with
   no handler (`BattleTopBar.tsx:113`). Placeholder "COMBAT LOG ▾"; gear → a button that opens
   Settings.
4. **Hotkey strip at 8 px** (`.hand-hotkeys { font-size: .5rem }`) and the caster banner sit
   between the piles and collide with the fan — one 11 px line, or a `?` popover; "READING FOR"
   belongs on the active plaque.
5. **Enemy plaques** are placed from the *slot* width (`stageGeometry.ts:111`) while the sprite
   is capped at 190 — Sköll's plaque floats 50 px off her sprite vs Fenrir's 8. Derive from the
   drawn rect.
6. **The biome backdrop never renders**: `BattleStage.tsx:396` reads `biomeName`/`biomeElement`
   off the battle state and nothing sets them — always the `None` fallback.
7. **Dead code**: `SHOW_LEGACY_HUD_COLUMNS`/`renderParty`/`MingmingUnit` wrappers
   (`BattleArena.tsx:1092–1142`), `.hand-row .program-card*` rules, `vfx.shakeKey` unread,
   `onTargetingEnd` passed but never destructured (`CardHand.tsx:89` — `hoveredEntityId` is never
   cleared on drop), `payoff` class in `LoadoutEditor.tsx:330`.
8. **Accessibility**: hand cards are `div`s with no `role`/`tabIndex`; the fan's framer `animate`
   ignores both `prefers-reduced-motion` and the new `animations` switch (`resolveVfxGates` is
   never consulted in `CardHand`); 7.5–8 px text.
9. **Ruled and untested**: `BattleStage.test.tsx:103,134` say "146 plays the death FX at the
   slot" but no death branch exists in `useCastSequence` and no death recipe in `emitters.ts`.
10. **Tests to add** so this class of bug cannot ship green: console band = `CONSOLE_H × scale`;
    all six slots inside the stage box at two viewports; `--el` present on `.hand-card`;
    `formatAction` exhaustive over `ActionType` (a `never` check); the cast/impact hooks survive
    a re-render; `fanGeometry.test.ts:33` back to −18/140.

## 4. Order

155a → 155e's `--el` line (two one-liners that restore 146 and the card look on day one) → 155b
with deep-dive 1 as one layout pass → 155c, 155d, 155f, 155g, 155h independently → deep-dive 2–8 →
the tests in 10. Write-back: screenshots at 1280×800 and 1920×1080 with three bodies a side and
an 11-card hand, and a 10-second capture of one cast with the switches on.
