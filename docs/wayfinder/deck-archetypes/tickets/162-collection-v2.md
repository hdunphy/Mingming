# Ticket 162 — Collection v2: archive the card pool, start again under the grammar

**Type:** data (registry) + design review. **Status:** **162a SHIPPED 2026-09-23** (`172bc68`..`993ad09`, gate green); 162b/c/d open. Ruled for playtest 2026-09-23 (v2.1b) — Henry: *"This is good, we should commit it for play testing tonight."* 162a is Legion's next row. **Asked by Henry 2026-09-22:** *"I think we need to revisit
the card pool. My latest playtest showed they were not exciting and it is still hard to build decks.
Can we archive the current card collection and start a new one. Try to build a card collection after
the notes I uploaded yesterday."* **Relates to:** 160 (this is 160's sessions done in one pass as a
draft), 158 §2 (the grammar), 161 (start kits — applied here), `research/os-directions-2026-09-21.md`
(Henry's directions, applied), 149c (prices every number below before it ships), 78 (tags).

## 1. What was delivered

`collection-v2/` — `collection.py` (the source of truth: 99 cards, 12 kits, 36 sample decks),
`collection.json` (the same, for tooling), `build.py` (validator + generator), `browser.html`
(the browsable breakdown: decks by OS · collection with filters · census).

**99 cards: 58 kept, 8 revised, 33 new.** Every kit is 8–9 cards with a 5-card start kit marked ★ that
holds no consume (161 §2); the consume and the second lane are "found in the run". Every kit has at
least two payoffs on two different counters (158 §2.6), except where one currency is Energy (which has
no counter until 160-r2 ships). Twelve run-only cards (hate daemons, the two ramp daemons, Tidal
Battery) are never in a kit.

## 2. The rules the draft applied (from the 09-21 directions)

- Fenrir v1 = Str **consume** + HP fuel (Sun Devourer moves here). Sköll v1 = Str **multi-hit** (Flare
  Burst, Pack Tactics) + deny/battery (Snarl, Snap, Howl). No "build Str + consume" twice.
- Sköll v2 = **EMBER_FUSE** (new OS: attacks on a Burning target add 1 Burn) — the detonation deck;
  its old Str kit is archived.
- Rat: **Poison gone** (Acorn Toss, Pollen Cloud revised). v1 = 0e zoo + keeper (Tend, ally-target).
  v2 = 0e → Dazed with **binary** riders; Slander moves to Kraken (per-stack is Kraken's).
- Jorm v1 = cards-played + **refund ramp** (Riptide Run new); **Ink Stream is Kraken-only**. Jorm v2 =
  Poison riders × multi-hit + double-then-trigger; Venom Glut (new) is the Poison consume, reads the
  target.
- Kraken v1 = draw scalar + Dazed consume. Kraken v2 = Energy ramp + **steam** Burn (kept).
- Huldra v1 = Weakened scalar (Sap Strength, new, reads the target) + **keeper** (Bolster, Tend,
  Verdant Ward — ally-target, 160-e1). Huldra v2 = Bark scalar/consume (Bark Smash new) + Thornguard.
- Glue: **Quick Scan** (None, 0e, draw 1) in every kit that lacked draw; Soothe and Mend are ally-target
  generics. The three Fire prints: Flare Burst, Sharp Edge, Brand.
- Daemons: all exhaust (Henry). Riptide / Short Circuit kept, Static Ward (anti-control) new,
  Overclock Core (160-r1) and Short Fuse (160-r2) new; Battery Pack archived (superseded).

## 3. What the census says about the draft

Poison: 3 owners (Jorm v2 owner, Huldra v2 converter, Huldra v1 consume) — down from 5 decks.
Strength: Fenrir consume vs Sköll multi-hit, distinct. Burn: converter (Fenrir v2), detonation (Sköll
v2), steam (Kraken v2). Dazed: per-stack (Kraken) vs binary (Rat). Cards in more than one kit: only
shared-element cards by design (Undertow ×2 Water, Acorn Toss ×2 Rat, Serpent Flurry/Coil across the
two Jorms, Heartwood/Bolster as Nature staples) plus the generics.

## 4. What it is not, yet

- **Not priced.** Every number is a draft in the current bands (0e ≈ 12, 1e ≈ 25, 2e ≈ 45–60,
  3e ≈ 90–105, 1 Energy ≈ 35, draw 20/15/10). 149c scores each card before it ships; MANUAL REVIEW on
  the new ones.
- **Not measured.** 160 §5's before-numbers on the *current* registry first, then this collection
  through the 140 grid and the 141 gym check with the research doc's two teams per gym.
- **Three engine dependencies:** ally-target cards (160-e1: Tend, Bolster, Shell Share, Mend, Soothe,
  Howl, Verdant Ward); EMBER_FUSE as a hook (attack on Burning target → +1 Burn); detonation numbers.
- **Not decided by Henry:** the 33 new cards' names and text are proposals; the OS rename for Sköll v2;
  whether Battle Rhythm / Crimson Draw / Brute Force survive in the run pool or go to the archive.

## 4b. v2.1 — Henry's review, 2026-09-23 (applied)

Henry's notes, verbatim: *Fenrir needs more self damage · say "Energized" not "gain energy" · too many
cards have a cheap version (0e 8p vs 0e 8p + 1w; 0e 1 Burn vs 0e 1 Burn + 8p) · Hydro Blast 120p · some 2e
cards underpowered — you pay for the cost of playing 1 card: 1e ≈ 30, 2e at least 70 (Pile On 25 → 50,
out-played by Thorn Tithe twice; Crippling Vine barely better than Thorn Tithe) · Surge Protection → 25p
1e · 0e draw should have a drawback: Forage replaces Quick Scan; Undertow = draw + 1 self Weakened (Legion
tested) · Tidal Battery: leave it, fix the description · Venom Glut underpowered for removing Poison ·
Maelstrom too weak → more Dazed.* His two rules: **the slot tax** (a 2e/3e card must beat two 1e cards —
pay for the lost versatility) and **one job per 0e card** (no 0e card is another plus a rider).

Both rules are now written into `collection.py`'s header and applied: bands 0e ≈ 12 / 1e ≈ 30 / 2e ≥ 70 /
3e ≥ 120; every 2e/3e card is side, multi-hit, consume or state-change; the 0e pairs are split by job
(Ember Jab hit / Ignite cantrip; Snarl single / Pollen Cloud side; Acorn Toss multi-hit / Tackle flat).
The browser's first section is the change log. 98 cards.

**v2.1b (same day):** Henry — *Flare Burst underpowered · Ragnarok 1p per stack · Flashover priced so the average at 2 Burn is 80 · all multi-hits underpowered: same scaling as a normal card, 1e = 30/hits · Scald 2 Burn · Pile On 45.* Applied: the MULTI-HIT RULE (band power split across hits — Flare Burst 15×2, Pack Tactics 23×3, Serpent Flurry 10×3, Acorn Toss 6×2), Ragnarok Edge +1/1% (max 50), Flashover 50 + 15/Burn, Scald 2 Burn + 1 self Dazed, Pile On 45 (again if Dazed).

## 5. Rows — 162a is GO (2026-09-23)

**Legion, for tonight's playtest — 160-e1 FIRST (ally-target cards: `Ally` target type in the reducer, the hand's picker offers allies for flagged cards, the AI enumerates ally targets, beam gate re-run), then 162a in this order:**
1. Archive: `programs.json` → `src/engine/data/archive/programs-v1.json`; the old EA kits and start
   kits in `mingmingRegistry.ts` go with it (keep the file readable for the card browser's history).
2. Load `collection-v2/collection.json`: every card in `cards[]` becomes a `programs.json` entry (ids as
   given; `old` is the alias — add an alias table so run logs, tests and the balance report keep
   reading `water_slap`, `whirlpool_v2`, `seed_bomb_v2`, `squirrel_away`, `fire_poke`, `seed_spit`,
   `healing_mist`, `*_daemon`). Each `os[]` entry gives the 8–9-card `kit` (`(id, copies, lane,
   startCopies)`), the 5-card start kit (`startCopies`), and the species' `pool` (reward-pool seeding
   per 161 §2 — for tonight, the pool is the species' shop/reward weighting; if seeding is not wired,
   the pool cards simply exist in the run pool).
3. `hooks.json`: **EMBER_FUSE** (Sköll v2: attack on a Burning target → +1 Burn to it); Ignite's
   "draw if the target was already Burning"; Undertow's self-Weakened (already tested).
4. **Ally-target cards** (Tend, Bolster, Shell Share, Mend, Soothe, Howl, Verdant Ward, Tidal Battery)
   need 160-e1 (step 0). If e1 cannot land before the playtest: ship them with `target: Self` / `AllySide` fallbacks and a
   `TODO(160-e1)` so the kits are castable; do not hold the playtest on the picker.
5. `npm run gate`; the grid is expected to move — do **not** re-baseline tonight, record the deltas
   in the write-back for 162c.
6. Regenerate the browser (`collection-v2/build.py`) from the registry if 162d is quick; otherwise
   leave it.

Then:

- **162a — archive.** `programs.json` → `src/engine/data/archive/programs-v1.json` (kept for the
  card browser's history and the 59 orphan annotations); `mingmingRegistry.ts` decks and start kits
  from `collection.json`; `hooks.json` gets EMBER_FUSE; ids that changed (`water_slap → tackle`,
  `whirlpool_v2 → whirlpool`, …) get an alias table so run logs and tests keep reading.
- **162b — score.** 149c over the 99; ledger to Henry; MANUAL REVIEW rows ruled.
- **162c — measure.** 140 grid + 141 gym check + run gate on v2; the 160 §5 numbers before/after.
- **162d — the browser as a dev tool.** `build.py`'s output wired to `npm run decks` so the HTML
  regenerates from the registry, not from a copy.

## 6. 162a as shipped, 2026-09-23

Four commits, `172bc68`..`993ad09`. Gate green: eslint 0, `tsc -b` 0, **2,635 vitest across 193 files**, `vite build` clean.

**The registry is 268 entries, not 98.** 243 + 38 − 13 renamed. The scope ruling (Henry, 09-21: *"leave the non-EA mingmings for after EA"*) leaves twenty species fielding v1 decks and ~90 scenario fixtures naming v1 cards, so deleting those entries would break the calibration corpus for no gameplay benefit. What keeps a v1 card out of a player's hands is `RewardSystem`'s **`V2_RUN_POOL`** gate — when every party member is a launch species the offerable set is the twelve kits ∪ the twelve species pools ∪ the run-only cards, and nothing else. `archive/README.md` states this where whoever opens the archive will read it.

**The 13 renames are aliased at `GetProgramData`, not find-and-replaced.** `water_slap` is a RECORD in ~90 scenario files and in Henry's run logs; rewriting one to match a rename makes it a lie about what was cast. The table is deliberately NOT folded into `ProgramRegistry` as extra keys — eight call sites walk `Object.keys()` and every one would see each renamed card twice. `GENERIC_HIT` and `MARKET_NEUTRAL_UTILITY` DID move to the new ids: a constant is not a record.

**Three engine seams, authored before the cards** (`162a step 2a`): `scalingPower` on `SHARP_STACKS` (cinder_lance +6 while thorn_whip stays +5); `TARGET_STATUS_STACKS`, an ADDITIVE per-stack bonus read off the defender, for flashover (50 + 15/Burn) and sap_strength (20 + 6/Weakened) — `BURN_STACKS`/`DAZED_STACKS` multiply, so a 50-power base would read 0 on a clean board; a `CARDS_PLAYED` constraint for riptide_run, per-caster per ticket 123. Plus `MAX_ENERGY` as a card action for overclock_core, which the HOOK side has had since ticket 68.

**EMBER_FUSE is data and the hand-written SOLAR_OVERDRIVE is deleted.** The old OS lived in `CustomFirmware.ts` because it needed a scaling cap the data path could not express; EMBER_FUSE needs no cap because Burn has its own. **It fires once per CARD, not per hit** — `onActionStart` is dispatched before the action loop. That is the literal reading of the printed sentence and it matches the kit, but `pack_tactics` in sköll_v2's kit gets one proc rather than three; pinned in `emberFuse.test.ts` so moving it is a ruling.

**Deviations from the collection, and why:**
- `heartwood` ships `target: Single`, not `Self`. Its own text is *"apply 1 Poison to the target"* and a Self program has no enemy to poison, so `Self` would silently delete half the card. Shipped as it already was.
- The eight ally-target cards ship on §5.4's fallback because 160-e1 did not land first: Soothe, Mend, Tend, Bolster, Shell Share are `Self` with a `TODO(160-e1)`; Howl, Verdant Ward, Tidal Battery are `Side`, which `actionTargetIds` already widens to whichever side the card is aimed at. **Huldra v1's and Rat v1's keeper lanes only reach their own caster tonight.**
- The marketplace's guaranteed neutral slot keeps its eleven v1 ids (`hamstring` and friends), which are therefore IN the v2 run pool. Narrowing them broke ticket 69's own guarantee and left the slot with no buff answer at all; **162b should print a v2 replacement for `hamstring`.**

**Two of ticket 61's kit rules retired, because 161 §2 replaces them:** *the kit leads with the payoff* (most decks' payoff IS their consume, and 161 keeps consumes out of the opening five) and *the kit never tags the generic* (v2 puts the glue in the kit). `startKits.test.ts` now asserts what 161/162 promise and can still fail: five cards, sub-multiset of the deck, carries the deck's glue, holds no consume. **Henry's to confirm.**

**`ignite` tripped ticket 152's tripwire** — its new conditional cantrip makes it a 0-energy card that draws. Measured on fenrir_v2, 1,200 games: max 8 casts in a turn, 0.3% of turns at ≥6, worst turn 85.5% of a health pool (undertow was max 18, 12.7%, 145%). **MEASURED_NOT_LOOPING.**

## 7. The deltas for 162c — measured, not re-baselined

§5.5 says record them and do not re-baseline. 1v1 probe, 1,200 games per OS over 30 opponents (`results/t162/GRID.txt`). Field win %: **ratatoskr_v1 80.5, fenrir_v2 79.3, kraken_v2 75.2, fenrir_v1 69.9, sköll_v2 66.9, jormungandr_v2 62.6, huldra_v2 50.0, kraken_v1 45.7, ratatoskr_v2 33.8, huldra_v1 33.6, jormungandr_v1 20.9, sköll_v1 11.7.**

Mean 52.5, **sd 22.5**, spread 68.8, two of twelve in the 47–64 band — against the last ruled grid's sd 8.6 and 31 of 32. That is a fresh pool with draft numbers in it, which is what §4 says it is; the decks are different decks, so a cell is not a regression against the old grid.

Two findings that are structural rather than numeric, for 162b to answer before any knob:
- **sköll_v1 (11.7%)** is the Strength MULTI-HIT deck under v2.1b's multi-hit rule with the Strength CONSUME moved to Fenrir. It builds a pile it has nothing to spend.
- **jormungandr_v1 (20.9%)** lost `ink_stream` to Kraken and is a cards-played deck whose only payoff is `serpents_coil`.
- **fenrir_v1 spends 17.0% of its turns dealing ≥75% of a health pool** (next worst 8.1%, nine of twelve under 2%) on a p50 of 55.2% damage a turn — `war_pact`×2 + `ragnarok_edge`×2 under UNBOUND_KERNEL. That reads like a mechanism, not a number.
