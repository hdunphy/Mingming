# Apply ticket 60: mini-engine starts, enemy ladder, sim gate, collection + bench (ticket 61)

- Type: wayfinder:task
- Status: closed
- Assignee: session-61 (closed 2026-08-26)
- Blocked by: [60](60-difficulty-and-agency.md), [57](57-apply-56.md)
- Phase: Vertical Slice


> **RENUMBERED 59 → 61 on 2026-08-25**, with its parent 58 → 60 — both numbers were already in use on this map. See [ticket 60](60-difficulty-and-agency.md)'s note.

## Deliverable

Ticket 60's resolution is the authority. Four work packages — split across sessions in this order if one is too big:

1. **Starts:** replace the 5-tag `startKit` sets with the ratified 4-card mini-engine table; arrival = 4 tags + 2 generics for starter AND recruits; delete the old 5+3/3+1 paths; update the tag-validation test (exactly 4, payoff first).
2. **Enemy ladder:** wilds = full tuned kit, no OS, `AI_GREEDY`; elites = kit + OS, `AI_LITE` (port the lite flag from the deck-archetypes pipeline work if not yet in-tree); gauntlet = kit + OS + Driver, full lookahead. Tier field wires: tier 2 = wild OS on; tier 3 = wild AI lite. Remove the kitFraction-by-depth knob.
3. **Win-rate gate:** a sim harness (debug toolkit lane, not shipped) that plays N=30 seeded fights per cell: representative player decks (mini-engine 6 at biome 1, ~12 cards at biome 2, ~18 at biome 3 — build them from the tag table + top-playrate pool cards) vs each biome's wild/elite/gauntlet loadouts, asserting 95/75/60 ±5. Runs under `npm run balance:run-gate`, NOT in CI (report wall-clock; if <60s consider the short-canary slot in ticket 40).
4. **Collection + bench:** picks land in `IRunState.collection`; **a SKIPPED pick lands there too, not in the deck** (Henry, 2026-08-25: *"skipped cards now go to your in-run collection but not the current deck"*) — which retires the skip's current meaning, added 2026-08-24, of taking nothing at all, and means `BattleReport`'s SKIP button needs re-labelling from "decline" to "to collection"; deck editor (revive `DeckTerminal` run-scoped) available at run start, workshop, market, pre-gauntlet; min deck 16 (or all cards if fewer); bench array on the run; party edits at the same nodes; benched member's kit cards auto-leave the deck into the collection; species clause enforced across party+bench swaps.

## Done when

Suite green, `tsc -b`/build clean, the gate reports its three numbers per biome in the resolution, and one scripted full run (seeded) is played through in the dev build to confirm the felt loop: functioning deck from fight 1, a bench swap performed, gate numbers within band.

---

## THE SPEC THIS TICKET WAS ACTUALLY BUILT TO — Henry's amendment, 2026-08-26

Recorded here because it was not: the amendment reached the previous sitting as chat and as an
uncommitted edit, and the commit that landed sections 1/4/5 replaced it with progress notes. Every
line in the Deliverable above that conflicts with this is dead, package 1's own "mini-engine 6"
included. Five sections:

1. **Start decks.** A five-card engine per firmware — a payoff and four enablers, from the ratified
   table. STARTER = 5 engine + 3 generics = 8. RECRUIT = the bare 5, no filler. Base contribution
   **8 / 13 / 18** by party size.
2. **Rewards.** Every taken pick offers, per card, **ADD TO ACTIVE DECK** or **STORE in the run
   collection**.
3. **Edit surfaces.** Exactly **four**: marketplace, workshop, a biome-boundary alert after the
   biome-exit elite (accept or ignore), and pre-gauntlet. Run start keeps its party pick. Nowhere
   else.
4. **Marketplace verbs.** SELL any card, from deck or collection, at **5/10/15/20** by energy cost —
   always under the buy rung (15/25/35/45), so there is no loop. **Paid removal is deleted.**
5. **Deck floor.** Minimum active deck = the party's base contribution (8/13/18).

The reason behind all five, in Henry's words: *"It felt bad to build a deck, it was hard to get the
right cards and deck bloat became a massive problem. I want to be able to swap out mingmings from the
active roster based on the upcoming biome or challenges. I also want to experiment more."*

---

## Resolution — all five sections built. The gate exists and **all three bands fail.**

Sections 1, 4 and 5 landed 2026-08-26 (`212db3e`); 2 and 3 landed this sitting, against the three
UI mockups ticket 62/63/65 ruled. Package 2 of the original plan (the enemy ladder) is **not** in the
amended spec and is not built — see *What is not here* below, and the new ticket it graduated into.

### 1. Start decks — DONE (previous sitting)

The 12 five-card engines were verified against their own deck lists before anything was written:
every tagged id present, multiplicities honoured (`ignite` ×2, `fury_strike` ×2, `pressure_point`
×2, `surge_protection` ×2, `undertow` ×2, `nagging_bite` ×2, `growth` ×2, `thornguard` ×2,
`capacitor` ×2, `corrosive_bolt` ×2, `pollen_cloud` ×2, `forage` ×2), every launch deck covered, no
species left on the untagged fallback.

`START_KIT_SIZE`/`RECRUIT_KIT_SIZE` 4 → 5. `RUN_GENERICS` (2) became `STARTER_GENERICS` (3) —
renamed rather than retuned each time its MEANING moved, which is now three times, and the name is
what stops the next reader multiplying it by party size. Recruits take no generics. Base 8/13/18,
and `runSummary.SOLO_START_DECK` follows the constants to 8. `startKits.test.ts` asserts the SHAPE
rather than the count: `KIT_PAYOFF` transcribes the ratified first column and every kit must lead
with it.

### 2. Rewards — DONE

`BattleReport` asks per taken card, and only once a card is taken: **ADD TO ACTIVE DECK** (the
default) against **STORE IN COLLECTION**. It hands the stored instance ids back as a third argument
to `onContinue`, and `BattleArena` splits the claim into `addRunCards` and the new
`addRunCollection`.

Two dispatches rather than one with a flag, because the deck and the collection are two piles with
different invariants — the deck has a floor and a shuffle behind it, the collection has neither — and
a boolean argument makes the call site the place you find out which. They are deliberately **not** a
transaction: a card in the wrong pile is one free click to fix at any of the four surfaces, which is
exactly the difference between this and a payment.

The default is the deck because the card you chose out of three is usually the one you want to play.
STORE is for the pick you take *because it is free*, which is the behaviour the collection exists to
make safe: *"it doesn't feel bad to grab all the cards even if you don't plan to use them."*

SKIP is untouched and still means *decline* (ruling 4, 2026-08-24). The original package 4 wanted a
skipped pick to land in the collection instead — that would have deleted declining altogether, since
"take it and store it" is now a button of its own. Declining a card you do not want to own is a
different act from owning one you do not want to play, and both are on the screen.

### 3. Edit surfaces — DONE, and there are exactly four

**One editor, four doors.** `LoadoutEditor` is rendered from `RunScreen` and nowhere else, so "which
surfaces may edit" is a question answered by reading the four `setEditorContext` calls in one file.
The editor itself knows only a context string — a component that checked the node kind would have to
be taught every new surface, and this list has already moved twice.

| surface | how it opens |
|---|---|
| marketplace | `EDIT LOADOUT` in the stall's top bar |
| workshop | `EDIT LOADOUT` in the bay's top bar |
| biome boundary | `EDIT LOADOUT` on the alert, after the biome-exit elite |
| pre-gauntlet | the pit stop, **before fight one only** |

The pre-gauntlet door is gated on `gauntlet.fightIndex === 0`. An editor between rounds two and three
would be the same as a heal: it would let a player answer the boss they just saw with a deck they did
not bring, and `exploration-map.md` makes the gym three fights with no healing between them.

**The boundary alert is run state, not a component flag.** `resolveEncounter` writes
`IRunState.boundaryBiome` when the fight that just ended was a biome's exit elite and another biome
follows; `dismissBoundaryAlert` clears it, whichever button was pressed. It has to be state: the
alert's whole value is that it fires *at the moment the player learns what element they are walking
into*, so an app close between the elite dying and the modal being answered must resume with the
offer still open. An effect keyed on "did `fightsResolved` just go up on an elite?" survives neither
a reload nor `StrictMode`.

The five verbs behind the surfaces (`moveCardToCollection`, `moveCardToDeck`, `benchPartyMember`,
`swapBenchMember`, `reflashEngine`) are in `runSlice`, with 29 tests in
`src/ui/store/runSlice.loadout.test.ts`. A swap is **one** action rather than a bench followed by a
call-up, because benching first would drop the deck under its floor for the length of one dispatch —
a state `moveCardToCollection` would be right to refuse and a save written in between would be right
to reject.

### 4. Marketplace verbs — DONE (previous sitting), plus one bug the collection created

**Selling is back**, `SELL_PRICE_BY_ENERGY = [5, 10, 15, 20]`, checked **rung against its own rung**
rather than in aggregate: "sell is under buy on average" is the true-sounding version that would let
one rung mint scrap. **Paid removal is deleted** — `REMOVAL_PRICE`, `WORKSHOP_REMOVAL_PRICE`,
`removeRunCardForScrap`, and both Strip sections.

New this sitting: **`isOfferSold` now looks at the deck AND the collection.** It took the deck alone,
which was exact while the deck was the only place a card could be. It is not: a bought card lands in
the deck (ticket 63, ruled) and the free editor can move it to the collection a second later — after
which the stall called the offer unsold and would **sell the same instance twice**. A card duplicated
out of nothing, and a real cards-for-scrap farm rather than the intended drain. Found by writing the
test, not by playing.

### 5. Deck floor — DONE, and enforced at every door

`minimumActiveDeck(partySize)` → 8/13/18. Enforced in `moveCardToCollection` **and** in
`sellRunCard`, which is the part worth naming: a sale that ignored the floor reaches the same illegal
deck for 5 scrap. A floor enforced at four of five doors is not a floor. Selling out of the
**collection** is never floor-blocked — the collection is not the deck, and blocking it would strand
a player who stored eight cards and cannot afford the next stall.

### The UI layer — built to the mockups, and one shared kit

`market_G_stall.html`, `workshop_I_bay.html` + `workshop_J_reflash.html`, `editor_F_big_paged.html`
and `editor_C_boundary_alert.html` open with the **same ~45 lines of CSS, character for character**.
That is one screen kit the prototypes pasted five times because a standalone HTML file has nowhere
else to put it. It has somewhere else now: `src/ui/screens/runShell.css` and `runShell.ts` carry the
top bar, the buttons, the pill, the panel, the card tile, the 27px deck row and the roster chip, plus
the three answers every screen needs (element colour, banner, duplicate grouping). The card tile is
sized by `--cw/--ch/--ah` — the mockups' own mechanism — so the market's 170×216 and the editor's
196×252 are data rather than two transcriptions.

Where the mockups and the code disagree, and why:

- **The stall and the bay take the WHOLE screen.** They were panels over the map on ticket 13's
  argument that *"a market is not a mode you are trapped in"*, which is why they had no LEAVE. The
  ruled mockups are full frames with their own top bars, and have to be. LEAVE closes back to the
  map; `RunScreen.closedNodeId` is the one bit of state, and the map offers **Back to the stall** so
  the node is not spent. The old shape said "there is nothing to leave" by never opening; this one
  says it by making the door swing both ways.
- **Click, not drag.** The editor's mockup says *"drag a benched mingming onto a party slot"*. This
  ships click-to-select then click-to-swap, and every affordance is a real `<button>` — the standing
  rule, so ticket 38 inherits screens that already work without a mouse. Drag can be added on top;
  it cannot be retrofitted underneath.
- **The boundary alert's party column is headed "who is on the field", not the mockup's "quick
  swap".** The modal has no swap: its only two controls are IGNORE and EDIT LOADOUT. A column headed
  with a verb it cannot perform sends the player hunting for a control one screen away.
- **The workshop's blueprint rack now lists a species spent down to zero**, greyed and dead — mockup
  I's fourth row. `workshopSpecies` stopped filtering `count > 0` so it can: a rack that shows only
  what you can spend cannot tell you what you have *run out of*, and a species the ranch has never
  met still has no entry at all.

### THE STAT ROLL — a reading that needs Henry, and is one line either way

Mockup I puts VIT/PWR/DEF on the assembly stage under *"stats roll at assembly — this is the reveal
moment"*. That reads two ways and only one survives the standing ruling in `workshop.planRecruit`:
**the roll is never previewed — the player sees the stats after paying, exactly as at the ranch**,
and the consequence (walking away and back re-rolls the individual, at the price of re-fighting the
wilds in between) is the mid-run echo of `vision.md`'s *"re-assembly is the re-roll"*.

So the stage is where the reveal *happens*: three stat boxes reading `??` before you assemble, filled
in the moment you do. Layout is the mockup's; the ruling holds. **If a genuine preview was the
intent, say so** — it is one line in `WorkshopNode.tsx` plus a ruling in `planRecruit`, and the thing
to weigh is that a previewed roll makes re-rolling free and turns every workshop into a button the
player is expected to mash.

---

## THE RUN GATE — built, and all three bands FAIL

`npm run balance:run-gate` now exists (`src/debug/balance/runGate.ts` + `runRunGate.ts`, 16 tests in
`runGate.test.ts`). It builds a real `IRunState` per sample off a real region graph and asks
`rollEncounter` / `rollGauntletFight` what is in the node — it decides nothing about enemy loadouts
itself. Battles are played by the existing `runBatch`, so the numbers sit in the same accounting as
`docs/balance/`.

**Default run (`--iterations 2`, 18 battles): 8m 23s.** Per-cell cost is 1v1 ≈0.07s, 2v2 ≈2.5s,
**3v3 30–70s**, and six of nine cells are 3v3. The tool prints a Wilson interval per band and flags
`UNDER-SAMPLED` whenever that interval is wider than the ±5 window, so a fast run announces itself as
provisional rather than reading as a verdict.

### The numbers

| band | target | measured | 95% CI | verdict |
|---|---|---|---|---|
| WILDS | 95% | **52.8%** (19/36) | 37.0–68.0 | **FAIL by 42pt** |
| ELITES | 75% | **41.7%** (15/36) | 27.1–57.8 | **FAIL by 33pt** |
| GAUNTLET | 60% | **50.0%** (18/36) | 34.5–65.5 | **FAIL by 10pt** |

The two cheapest cells were re-run to **1,200 samples**, so their misses are not sampling noise:

| cell | n | win rate | 95% CI |
|---|---|---|---|
| `wild:biome0` | 1200 | **67.1%** | 64.4–69.7 |
| `wild:biome1` | 120 | **26.7%** | 19.6–35.2 |
| `elite:biome0` | 1200 | **36.9%** | 34.2–39.7 |
| `elite:biome1` | 120 | **42.5%** | 34.0–51.4 |
| `gauntlet:fight0` | 12 | 75.0% | wide |
| `gauntlet:fight1` | 12 | 66.7% | wide |
| `gauntlet:fight2` (boss) | 12 | **8.3%** | wide |

Clearing all three gauntlet fights: **4.2%**, and that is an *upper* bound — HP does not carry
between fights in the harness (`ComposedSetup` has no `persistedHp`, the same wall
`gauntlet-boss.balance.ts` hit).

Reproduced independently at the end of the sitting: `--cells wild:biome0 --iterations 200` → **69.0%
(138/200), CI 62.3–75.0, 14 seconds.**

### Three shapes worth a ruling, independent of the magnitudes

1. **The kit fraction is not monotonic.** Biome 1 (26.7%) is *harder* than biome 2 (50.0%) and much
   harder than biome 0 (67.1%). Ticket 08's table produces a spike in the middle, not a ramp. The
   likely mechanism is concentration rather than size: biome 1 fields five pure engine cards per body
   with no filler, biome 2 fields the nine-card tuned list.
2. **The gym boss is not in the same game as the two fights before it** — 8.3% against 75.0% / 66.7%.
   Ticket 18's own smoke run said this in 12 battles; this is the same finding at the run's real
   party and deck, and from full HP.
3. **Enemies out-roll the player by ~5 IV in every stat, everywhere.** `createMingmingInstance` rolls
   the player `nextInt(0, 31)` (mean 15.5); `encounter.ts:416-418` rolls enemies `nextInt(10, 31)`
   (mean 20.5, with a floor the player has no equivalent of). That is upstream of every band, every
   biome and every deck, and it is the single cheapest thing to test a change against.

**Not tuned.** These are measurements, and what to do about them is a design decision — see the new
ticket below.

---

## What is not here

- **Package 2, the enemy ladder** (wilds full kit / no OS / `AI_GREEDY`; elites +OS / `AI_LITE`;
  gauntlet +OS +Driver / full lookahead; kill the `kitFraction`-by-depth knob). It is absent from the
  amended spec and was not built. The gate's numbers are largely a measurement *of* the ladder that
  package 2 was meant to replace, so the two belong together — graduated into a new ticket rather
  than left as a stub here.
- **The scripted seeded run in the dev build**, which the Done-when asks for. It needs Henry at the
  keyboard; the gate replaces the part of it that was measurable.

## Findings raised and fixed on the way

- `isOfferSold` sold the same instance twice once the collection existed (see §4).
- `sellRunCard` had no floor check, so a 5-scrap sale broke ticket 61 §5 (see §5).
- The boundary alert listed suggested cards by instance, against the standing *"one tile per unique
  card, everywhere"*. **Eleven of the twelve ruled engines contain a duplicate**, so one benched
  member's repeats could fill all five suggestion slots and crowd a second member out entirely.
- The editor's party chip invited a bench a party of one cannot perform, and answered the click with
  a beep. A run OPENS solo, so that was the first editor most players would ever see. Disabled with a
  reason, per ticket 20's precedent.
- The editor's empty-book copy told a player holding twelve cards that nothing had landed in their
  collection yet, whenever a filter matched nothing.
- Under `vite-node` every `process.env` read compiles to `undefined` (`vite.config.ts` carries
  `define: { 'process.env': {} }`). Consequence beyond this ticket: **`BALANCE_ONLY` is silently
  disabled for `npm run balance:deck` too.**

## Gates

Suite **1768 green across 128 files** (1674 → 1768; +94, and no assertion weakened — the tests that
pinned superseded rulings were inverted, not deleted). `tsc -b`, `eslint .`, `vite build` and the
debug-absence gate all clean.
