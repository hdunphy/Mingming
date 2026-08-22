# 3v3 game-side completion: six-entity UI, shared hand, caster STAB, energy transfer decision (ticket 22)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Deliverable

The engine and `BattleArena` already run 3v3 (audit: parties, shared deck/hand, per-entity energy, `sourceId`, W/E/R caster hotkeys, drag targeting). Finish the player-facing layer: the hand must read STAB and true damage **by selected caster** (preview-parity rule), per-member energy pips must be legible at six entities on a 1280×800 frame, target validity must be obvious, and the draw formula `sum(cardDraw) − (N−1)` is surfaced in a tooltip. `TRANSFER_ENERGY` exists in the reducer but no UI dispatches it and the 3v3 ruling never mentions it — **Henry decides keep-or-cut** (see Questions); do not build UI for it until ruled.

## Done when

A 3v3 fight is fully playable by mouse and by keyboard with no hidden numbers; a component test covers caster switching.

## Resolution

**Closed 2026-08-22.** A 3v3 fight is playable by mouse and by keyboard, and every number in the hand
is the number that will happen. Suite **1436 → 1480**, `tsc -b` clean, build green.

---

## READ THIS FIRST: "power dies at the surface" is broken at the DATA layer

**142 of the 216 card descriptions print their power figure.** `fire_punch_v2` reads *"30 power."*;
`scorch` reads *"25 power. Apply 3 Burn."* The standing law is broken on the card face, in the data,
and it predates this ticket.

**Worse: ticket 13's identical assertion passed over it, and here is why.** `ProgramCard` renders a
card's description only inside a **hover portal**, which `renderToStaticMarkup` never produces — so
the marketplace test asserting "no `/power/i` in the markup" is true of the markup and false of the
screen a real player is looking at. The battle hand renders descriptions unconditionally, which is
the only reason this surfaced now.

**It was not fixed here, deliberately.** Rewriting 142 cards' copy is a content pass with
balance-communication consequences — for some cards that string is the only place the scaling is
explained, and `drawScaling.test.ts` asserts against two of them — so it is Henry's call how each one
reads, it belongs to the **deck-archetypes** map, and doing it quietly under a UI ticket is how a card
stops matching its tests. `CardHand.test.tsx` holds the law over everything the component itself
writes and documents the exclusion by name.

---

### Caster-aware previews

The hand re-reads on every caster switch: true damage, true **healing**, STAB, and the matchup
against the current target. Reuses ticket 15's cast-and-measure simulation — `simulatePlay` was
lifted out of `computeDamagePreview` so the heal figure is measured by the identical helper rather
than a second one that could drift.

Cost is one reducer run per card, hand capped at 9, memoised on `(state, caster, target, card)` in a
`WeakMap` keyed by **state identity** — `IBattleState` is immutable and replaced wholesale by the
reducer, which makes staleness and cache invalidation the same event. A caster switch costs at most
nine simulations once; every hover after that is a lookup.

Two changes beyond the letter of the ticket, both for the same reason: the preview is **always on**
rather than hover-only (it was blank at the exact moment the player was choosing), and it **names
whose HP the number is measured on**, using the same precedence `BattleStage` uses to pick its
spotlight — a number with an unstated subject is still a hidden number.

**`formatAction` was printing `action.power`.** That is the leak `MacroRack.test.tsx` names by file
and function as the likeliest way to break the law. Gone.

### Six-entity energy: it fits 1280x800, and the sum is in the CSS

Pips, not a proportional bar, with the arithmetic written into `ENERGY_PIP_BUDGET`'s docblock:

- **Horizontal:** 300px card − 80 sidebar − 24 padding = 196 body; − 16 label − 14 gaps − 40 readout
  = **126px of pips**. At 0.6rem a pip is 15.36px and a gap 3.26px, so six come to 108.6px and
  **seven to 127.1px**. Six is the ceiling *by one pixel* — a measured edge, not a round number.
- **Vertical:** 800 − 265 console = 535px of stage; a column spends 100 + 3x115 + 2x30 = **505px**.

Past six it compacts back to a bar rather than wrapping, because wrapping costs ~10px per card and
three of those would spend the entire 30px of vertical slack. Real range is 1–3 (+1 relic), so the
compact path only triggers on deep `Energized` carryover — which now gets **its own cyan pip**, a
state the old bar could not express at all (it clamped 4-of-3 to "full"). Ticket 37 still owns the
general Steam Deck pass; this is just the six-entity case discharged.

### Target validity

One predicate, `ui/utils/targeting.ts`, used by the click path, the drop path, the keyboard path and
the legend — so the legend cannot promise a target the game then refuses. `card-target` printed the
raw `TargetType` enum ("Single"); it is a phrase derived from the predicate now. Refusal reasons
moved off the hover and onto the card frame: they were hover-only, which required a deliberate hover
on a card already written off as greyed out — the one interaction nobody performs.

### The draw tooltip

`sum(cardDraw) − (N−1)` = 3 / 5 / 7 at one, two and three members, shown as the **arithmetic for the
current party** rather than the formula. This is the number ticket 08's entire start-deck ruling was
derived from, so it is worth the player being able to see it.

### Keyboard parity

Added **A/S/D** (enemy target), **Shift+W/E/R** (ally target), **Tab / Shift-Tab** (cycle), **Enter**
(cast, through the same predicate the drop uses), **Z/X/C** (macro slots), plus a text-input guard so
the debug overlay is not swallowed, and an on-screen legend — an undiscoverable keyboard path is not
one.

Worth stating plainly what the state was: **there was no key that picked an enemy and no key that
committed a play.** A keyboard player could arrange the entire fight and never take a swing.

**Still mouse-only:** the literal drag gesture (its function is fully covered by the above), and —
outside this ticket — `BattleReport`'s reward and driver pickers, which are `<div onClick>` with no
focus or key handling. That is the post-fight screen rather than the fight, but it is a real gap in
ticket 12/16 territory and ticket 38 will want it.

**Not testable here:** the keydown wiring itself. `renderToStaticMarkup` runs no effects and a
lockfile change is forbidden in this repo, so no listener can be dispatched to. No dependency was
added; the predicate the keyboard gates on is fully covered instead, and the test file says so.

### `TRANSFER_ENERGY` — left alone, as the ticket instructs

Unwired pending your ruling, with a short note at the two places a reader trips over it. **Cutting it
is small and self-contained:** the `BattleAction` union member, the `switch` case,
`handleTransferEnergy` (~28 lines), the `TRANSFER_COST` / `TRANSFER_GAIN` constants, the slice
reducer and its export, plus 3 test cases. **Roughly 60 lines, no callers to migrate.** No card,
relic, OS, daemon or AI path references it. It is not rotting — the tests exercise it — it simply has
no way in from a fight.


