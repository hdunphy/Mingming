# Ticket 184: Draw pile viewer, Burn overflow text, OS counters, per-OS patch text

**Type:** UI fixes, plus one written table. **Status:** DONE (2026-10-01). 184a–184e all built. Henry ruled the patch findings (second set of rulings at the bottom), and the per-OS patch text is in the game.

**Henry (2026-10-01), in his words:**

> *"You need to be able to see the draw cards like discard cards."*
>
> *"When burn overflows it says -2 burn or -3 burn which is confusing. We need to make it say something like overflow +2 or overflow|+2 burn, for the situation when you have 2 burn and add 4 burn."*
>
> *"jorm draw on 5th water card needs a counter next to his OS. Any other OS that have a counter or something should have visual feedback"*
>
> *"the patches are lazily done, each patch should probably have a defined effect per OS. For now we hand write them per OS. They can be a modular thing in the backend, but its mostly the description that is too unclear."*

One commit per row, test first, authored by Henry, no push. CRLF in `docs/wayfinder`. Small single-purpose pieces, composed. No monolith component.

| Row | What |
|---|---|
| 184a | Click the draw pile to see what is in it, the way the discard already works |
| 184b | A Burn overflow says "overflow", never a negative Burn number |
| 184c | Firmware with a counter shows it next to the OS chip (Jörmungandr v1 first) |
| 184d | Patch text written per OS. Step 1 hid the no-ops and drafted the text; step 2 put it on every patch screen |
| 184e | Henry's per-firmware patch rulings (Jörmungandr v1, Ratatoskr v1, Fenrir v1 RELAY) and SPLITTER no longer pays the host twice |

---

## 184a: Click the draw pile to see what is in it

**Today.** The discard pile has been clickable since 2026-09-25 (`ui/components/DiscardPileViewer.tsx` wraps the pile face in `CardHand.tsx`, and `discardPile.ts` builds the rows, newest first). The draw pile is a count, plus a tooltip with the draw formula (`+N/turn`).

**Build.**

- Pull the open/close shell out of `DiscardPileViewer` into a generic `PileViewer` (title, rows, empty text, list id). `DiscardPileViewer` and a new `DrawPileViewer` become thin wrappers around it. Keep both fixes the shell already carries: the capture-phase Escape that is consumed (so closing the list does not open Settings), and the blur after a mouse click (so Enter, the cast key, does not reopen it).
- New `drawPile.ts` beside `discardPile.ts` builds the draw pile's rows.
- **Order: not the real draw order.** Showing the real order tells the player their next draw. Sort by cost, then name, and stack duplicates as `×2` (decision 1, ruled).
- Header `DRAW · 14`. Empty text: "Empty. Your discard shuffles back in on the next draw."
- Only one list is open at a time. Opening the draw list closes the discard list, and the reverse.
- The `+N/turn` formula stays on the pile as its tooltip. The list does not carry that information.

**Tests.** `drawPile.test.ts`: the rows are sorted and stacked, and shuffling the pile gives identical rows (proof the list does not leak the order). A render test in the style of `discardPile.test.tsx`, including the one-list-at-a-time rule.

---

## 184b: A Burn overflow says "overflow"

**How Burn works (unchanged).** Burn caps at 4. Going past the cap **detonates**: the target takes 14% of its max HP, and the cap is subtracted, so the pile restarts from whatever went past it (`BurnBehavior.onApply`, `engine/StatusBehaviors.ts`). Henry's example: 2 Burn + 4 Burn = 6, one detonation, 2 Burn left.

**Where the minus comes from.** When you hover a card over a target, the preview chips (`UnitPreview` in `UnitReadouts.tsx`) show `stacks after - stacks before`, from `statusDiff` in `ui/utils/damagePreview.ts`. That subtraction knows nothing about the detonation:

| Before | Card adds | After | Chip today |
|---|---|---|---|
| 4 | 2 | 2 | **-2 BURN** |
| 4 | 1 | 1 | **-3 BURN** |
| 2 | 4 | 2 | *no chip at all* (the difference is 0, so it is dropped) |

So the card that adds the most Burn can show the biggest loss, or nothing.

**Build.**

- **The engine records the detonation once.** When Burn detonates, the apply step reports it: either a `detonations` count and the stacks that went in on `STATUS_APPLIED`, or a new `STATUS_OVERFLOW` event. The preview, the battle float and the combat log all read that one record. None of them repeats the cap arithmetic.
- **Preview chip.** When the cast detonates, show `OVERFLOW · 2 BURN` instead of the difference: the word says the pile popped, and the number is what is left (decision 2, ruled). A card that adds Burn never shows a negative Burn chip.
- **Battle float.** Use the same wording on the target when the detonation happens, so the float and the badge (which drops from 4 to 2) tell the same story.
- **Damage number.** Check that the preview's damage number includes the detonation. The preview sums `hits[].raw`, and the detonation goes into the damage ledger as its own record (`effectHandlers.ts`, about line 590). If it is not counted, count it.
- **Report, do not change:** the other places a status can drop while one is being added (opposite statuses cancelling, `effectHandlers.ts` about line 545). Those minus chips are probably right, because a cancel is a real loss. List them in the report.

**Tests.** The three rows of the table above, as preview tests: each shows the overflow chip, none shows a negative Burn chip, and the damage number includes the detonation. One float test.

---

## 184c: Firmware counters next to the OS chip

**Today.** The OS chip (in `UnitReadouts.tsx`: firmware icon, V1/V2, patch letter) flashes when the OS fires (ticket 146g). Nothing shows progress toward a trigger, so Jörmungandr v1's "the 5th Water card draws" is invisible until it happens. The engine already keeps these numbers in `state.counters`.

**Build.**

- **Declare it in the firmware data, not in UI code.** For example, on `jormungandr_v1`: `counterDisplay: { key: 'jorm_water', max: 5, resets: 'turn', spentKey: 'jorm_ouroboros_used', label: 'Water cards this turn' }`.
- A small `osCounter.ts` reads the declaration, `state.counters` and the body's patch, and returns `{ value, max, state: 'counting' | 'ready' | 'spent' }`. A small `OSCounterPip` draws it beside the chip. The chip itself never knows which OS it is showing.
- **It reads the patched rule.** With REPEATER, Jörmungandr v1 can draw twice a turn, so after the first draw the counter starts again instead of showing "spent".
- The OS tooltip gets a line: "Water cards this turn: 3 of 5".
- An enemy whose OS declares a counter gets the pip automatically.

**Which launch firmware have something to show** (from reading the hook data, to confirm while building):

| Firmware | What it tracks | Proposed readout |
|---|---|---|
| jormungandr_v1, OUROBOROS_LOOP | Water cards your side played this turn. Fires on the 5th, once a turn | `3/5`. Lit when the next Water card will trigger it. Greyed after the draw, until the turn ends |
| huldra_v2, BARK_SHIELD_OS | Fires once, at the end of Huldra's first turn | An "armed" pip until it fires, then gone |
| fenrir_v1, UNBOUND_KERNEL | Not a counter: the Fire bonus grows with missing HP, up to +50% | A live `+23%` (decision 3, ruled in) |
| the other nine | Fire on an event and hold no state | Nothing. The existing flash covers them |

The other nine are fenrir_v2, skoll_v1, skoll_v2, kraken_v1, kraken_v2, jormungandr_v2 (its bonus depends on the target and already shows in the hover preview), huldra_v1, ratatoskr_v1 and ratatoskr_v2.

**Outside the twelve, the same kind of counter exists on:**

- Drivers: Tidal Surge (every 10 cards), Tenth Strike (every 10th attack), First Blood (first attack each turn), Deep Cache (first bonus draw each turn).
- Daemons: Reactive Plating (3 Sharp a turn, 5 for the + version) and Feedback Loop's charges.
- Post-launch firmware: hel_v2 (25% HP a turn), hraesvelgr_v2 (2 shuffles), audhumbla_v1 (once a turn), fafnir_v1 (the hoard).

**All of them are in this ticket** (decision 3, ruled). The same declaration and pip serve every one. Drivers sit on the party rather than on one body, so their pips go wherever the Driver is shown in battle. Daemons' pips go on the daemon tag. Build the launch firmware first, then Drivers, then daemons, then the post-launch firmware.

**Tests.** `osCounter.test.ts`: 0 to 5 Water cards, the turn reset, the spent state, and the REPEATER case. A test that every counter listed above has a declaration, so a new one cannot be missed. One render test for the pip.

---

## 184d: Patch text written per OS

**Today.** There are six patches: AMPLIFIER, REPEATER, RELAY, SPLITTER, OVERCLOCK and FAILSAFE (ticket 163c, `engine/data/patchRegistry.ts`). Each one is a transform over the firmware's hook data, with one generic sentence. AMPLIFIER's reads: *"Your firmware's number goes up: one more stack, or half again as much."* That sentence is what the reward offer (`BattleReport.tsx`), the patch bench (`PatchBench.tsx`), the event pick (`EventPatchPick.tsx`) and the OS tooltip show. A comment in `UnitReadouts.tsx` says per-OS text was avoided on purpose ("seventy-two sentences"). **Henry is reversing that.** The backend stays modular, and the description is written per OS.

**Why the generic text is not enough: one worked example.** This comes from reading the code and has not been run yet, so prove it with a test first. AMPLIFIER adds 1 to every number in the hook. On OUROBOROS_LOOP that includes how much each Water card adds to the counter, so the count goes 2, 4, 6. The trigger checks for "exactly 5", which never happens. If that is right, AMPLIFIER switches Jörmungandr v1's firmware off while its text says it makes it stronger. A per-OS line would have had to say what it actually does, and the mismatch would have shown.

Also known: huldra_v2 is hand-written code with no hook data (`CustomFirmware.ts`), so no patch changes it. All six of her cells read "does nothing".

**Step 1: a draft for Henry (no game change).**

- A table of 12 launch firmware × 6 patches = 72 cells, at `docs/balance/patch-text-184.md`.
- Each cell has what the transform actually changes (from running it: `patchTouchCount` plus a short sim check) and a one-line sentence for the player, e.g. *OUROBOROS_LOOP + REPEATER: "The 10th Water card each turn draws too."*
- Cells where the patch does nothing say **does nothing**. Cells where the result is broken or silly are **flagged**, with what goes wrong.
- Stop there for review.
- Starter harness: `scratch/t184_patch_matrix.ts` prints which patch touches which firmware. It was written but not run, because this machine's `node_modules` are Windows builds. Run it on Windows.

**Step 2: after Henry rules.**

- A `PATCH_TEXT` table keyed by firmware, then by patch. One lookup, `describePatchOn(osId, patchId)`, that every screen uses: the offer, the bench, the event pick, the holders line and the OS tooltip.
- The generic sentence stays only as the fallback for firmware outside the table (post-launch firmware and enemies).
- A test fails if any launch-firmware × patch cell is missing.
- A patch whose cell says "does nothing" is **never offered for that body** (decision 4, ruled). That covers the reward offer, the bench and the event pick. Check `gatePatchChoices` (`patchRanking.ts`) first, because it may already skip some of those.
- **Broken cells are reported, not fixed.** Henry rules each one, as he does for every card change.

---

## Henry's rulings (2026-10-01)

1. **Draw pile order:** *"Yes."* Sorted by cost then name, duplicates stacked. Not the real order.
2. **Burn overflow wording:** *"Your recommended is good."* `OVERFLOW · 2 BURN`.
3. **Counter scope:** *"Yes we need them all in this ticket."* Jörmungandr v1, Huldra v2's armed pip, Fenrir v1's live bonus, the Drivers, the daemons and the post-launch firmware.
4. **Patches that do nothing on a body:** *"Hide them I think."* Never offered for that body.

**Next step:** the agent builds 184a and 184b, then 184c, and in parallel drafts the 184d table for Henry's review.

## Henry's rulings on the 184d findings (2026-10-01, second set)

> *"1. amplifier -> draw 2 cards, repeater -> draw cards on the 3rd and 5th water cards, splitter -> any element not just water*
> *2. Fenrir_V1 Relay should be ignored. Splitter doesn't double up on Fenrir_V1, he stays the same allies just gain the stacks too. same for Fenrir_v2 splitter and skoll_v1 splitter. Rat_v1 go to 12 power.*
> *3. Yes"*

1. **OUROBOROS_LOOP (Jörmungandr v1):**
   - AMPLIFIER: the 5th Water card draws 2.
   - REPEATER: the 3rd and the 5th Water card both draw.
   - SPLITTER: any card counts, not just Water.
   - Built in 184e as hand-written per-firmware effects (`src/engine/data/patchOverrides.ts`).
2. **Fenrir v1 RELAY** is never offered. **SPLITTER** now gives the rest of the side the stacks and leaves the host unchanged (new hook target `OTHER_ALLIES`). **Ratatoskr v1 AMPLIFIER** heals at 12 power (3%).
3. The four things without a counter pip stay as they are.

The patch sentences shipped as drafted, with these rulings applied (`src/engine/data/patchText.ts`, recorded in `docs/balance/patch-text-184.md`).
