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

## 8. 162b — the ledger, 2026-09-23

`scratch/t162b_ledger.ts`, output in `results/t162/LEDGER.txt` and `.tsv`. It prints every card against TWO bands: `powerscale.BUDGET_BANDS` (the curve the whole repo is audited against, 1.0 / 3.0 / 6.5 / 10.5) and **Henry's v2.1 slot tax** (1.2 / 3.0 / 7.0 / 12.0). Moving `BUDGET_BANDS` would reprice all 268 registry entries including the 170 v1 cards twenty post-EA species still field, so the ledger reports both and **which curve v2 is audited against is a decision for Henry, not one the script makes.** 149c §4.2's width rule is honoured: a Side card is judged on the worse of its two widths.

### CORRECTED 2026-09-23 — the rung is NOT light; the auditor is blind

**The first reading of this row said "the 2e rung is 36% under the slot tax" and that was wrong.** Henry asked what "under" meant, which is the question that found it. Splitting the cards by whether the auditor can actually READ them — a card that consumes, scales on, or multiplies a pile is priced against an ASSUMED three stacks, which is a guess, not a measurement — the medians are these, in power:

| cost | cards the auditor can read | cards it guesses at | the repo's target | Henry's v2.1 |
| --- | ---: | ---: | ---: | ---: |
| 0e | **10** (n=17) | 7 (n=1) | 10 | 12 |
| 1e | **30** (n=34) | 22 (n=6) | 30 | 30 |
| 2e | **74** (n=10) | 45 (n=13) | 65 | 70 |
| 3e | **120** (n=4) | — | 105 | 120 |

**Every rung the auditor can read lands on Henry's v2.1 number.** 2e reads 74 against a target of 70; 3e reads 120 against 120; 1e reads 30 against 30. The −36% headline was the thirteen pile-readers (median 45) and the twelve daemons (whose hooks it cannot price at all) dragging a median that had no business including them. **Collection v2 is priced on Henry's own curve wherever that claim can honestly be made.**

Three flat 2e cards are genuinely under and are the only pricing rows this ledger supports: `inferno` **40** (2 Burn to the side and nothing else), `crippling_vine` **59**, `verdant_ward` **61**. Everything else flat at 2e is 69–95.

The remaining question is bookkeeping rather than balance: `powerscale.BUDGET_BANDS` still holds **10 / 30 / 65 / 105** and Henry's v2.1 note rules **12 / 30 / 70 / 120**. Moving it changes no verdict that matters (the two disagree on ten of 98 cards, all within a rung's tolerance) but it is what a future audit reads. **Henry's to rule.**

### The bug the question found

Answering *"what is under?"* surfaced a real defect that 160-e1 had introduced hours earlier. Every sign flip in `powerscale` asks one question — **is this effect happening to me or to them** — and it asked it as `action.target === 'SELF'`. That was the same question until 160-e1, because `TARGET` could only ever mean an enemy. It cannot now.

`soothe` is the witness: *"remove 1 stack of a debuff from an ally"* is negative stacks on `TARGET`, so the model read it as APPLYING two debuffs to a friend and priced the card at **−0.8** — a card that helps you, scored as a cost, and routed to MANUAL REVIEW where a human would have to catch it. That is ticket 47's bug re-created from the other direction, and ticket 47's note is still three lines below in the same file, describing the shape.

Fixed: `landsOnOwnSide = actionIsSelfFacing || card.allyTarget`. `soothe` is **+0.9** and all eight ally cards score positive. `scope` is deliberately NOT changed — it asks how WIDE a card reaches, and an ally card reaches one body or three by the same arithmetic an enemy card does. Only the signs were ever about sides. Mutation-tested, including the guard the widening must not lose: a card that attacks AND buffs its target is still penalised when that target is a foe.

The pile-readers are **not** thereby judged weak. `bark_smash` at 7 power and `venom_glut` at 12 are the auditor saying it does not know what pile Huldra v2 and Jörmungandr v2 build, not that the cards are blank. Measuring those needs the deck, which is 162c's instrument, not this one's.

### 20 cards over, and the two extremes are pile-readers

`contagion` and `sun_devourer` both score 20.4 at 2e (**+191%**), and both are priced against an assumed board pile rather than a measured one. `ragnarok_edge` at 7.0 for 1e (+133%) is not: MISSING_HP at +1 per 1% to a 50% cap is a printed +50 power on top of 20, and fenrir_v1 runs two of them — which is the same deck that spends 17.0% of its turns dealing ≥75% of a health pool (§7). `capacitor` +36%, `riptide` +70%, `surge_protection` and `tide_pool` +67% each.

### The eleven MANUAL REVIEW rows, and what each one needs

Nine of the eleven are cards the scorer says ITSELF it cannot price — a low score with an `UNPRICED` tag is **unscored, not underpowered**, and that distinction is what this list is for.

| card | reading | why | what it needs |
| --- | --- | --- | --- |
| `contagion` | 20.4, +191% | MULTIPLY_STATUS against an ASSUMED Poison pile | a measured pile, or Henry's eye |
| `heat_wave` | −63% | MULTIPLY_STATUS, Burn, which caps at 4 | the cap makes it honest; likely fine |
| `toxic_surge` | −90% | TRIGGER_STATUS has no price in the model | Henry |
| `scavenge_data` | 0 | SEARCH has no price in the model | Henry |
| `reactive_plating` | −61% | daemon hook | 149c-6's hook rate |
| `core_overclock` | 0 | `onDamageCalculated` multiplier, no `do` payload to walk | unmeasurable statically |
| `static_ward` | 0 | `onStatusApplied` hook, never census-measured | a proc rate |
| `thermal_overload` | 0 | two hooks + an HP cost | a proc rate |
| `overclock_core` | 0 | **MAX_ENERGY**, worth 40 power per point per REMAINING REFILL | a measured horizon |
| `soothe` | −0.8 | the model reads removing a debuff from an ally as a downside | 149c §4.7 / ticket 138 |
| `unbound_fang` | −1.3 | "then lose half of them" prices as a cost bigger than the payoff | the pile it spends is invisible statically |

`MAX_ENERGY` was added to `powerscale.MANUAL_REVIEW_TYPES` EXPLICITLY in this row. It already scored 0, through the branch whose comment reads *"Unknown/future action type"* — which was the right default for a verb nobody had seen and the wrong LABEL for a shipped one, because it invites the next reader to "fix" the scorer by inventing a number. The number is not available statically: a permanent +1 max Energy is worth `40 × (turns the caster has left)`.

## 9. 162c — measured, 2026-09-23

### The run gate: a v2 run cannot clear a gym

`npm run balance:run-gate`, 18 battles, ticket 61's three ruled bands (`results/t162/RUNGATE.txt`):

| band | target | measured | verdict |
| --- | ---: | ---: | --- |
| WILDS | 95% | **100%** (6/6) | PASS |
| ELITES | 75% | **50%** (3/6) | FAIL by 20pt |
| GAUNTLET | 60% clear | **0%** (0/6 fights) | FAIL by 55pt |

All three are under-sampled at 2 iterations a cell — the 95% intervals are wider than the ±5 window, so these are provisional. The gauntlet is not marginal enough for that to matter: the player loses **every one** of the gym's three fights, and the damage is one-sided rather than close. Player 574 / 502 / 582 damage a turn against enemy **741 / 1,098 / 1,332**; the boss fight lasts 2.5 turns.

**It is not the un-drifted floor.** The gate deliberately models a run before any reward is taken, and 161 §2 deliberately makes that floor lower by keeping the consume out of the opening five — so the obvious suspect was that the two designs are in tension. Measured instead of assumed: re-run with `--deck engine-plus-3` (a 27-card drifted deck, `results/t162/RUNGATE-drifted.txt`) the gauntlet goes 0/6 → **1/6**, with the boss still 0/2 at 443 against 1,106. The floor is not the explanation.

**What is.** Two findings that point the same way. v2.1 raised the big Water numbers — Hydro Blast 105→120, Maelstrom 90+1 Dazed→100+3, Tidal Wave 45→55, Boiling Surge 40→55 — and Tidewrack is the Water gym, so those buffs landed on the ENEMY side of the fight the player has to win. Meanwhile the player's 2e rung sits 36% under Henry's own slot tax (§8). Both halves of the gym fight moved, in opposite directions, at once.

### 160 §5's counts (`results/t162/SHAPE.txt`)

**Duplicate count: the gate is NOT met.** 7 cards / 19 kit slots → **11 cards / 28 kit slots**, read from `archive/ea-kits-v1.json` rather than from §5's prose (which misremembers `tackle ×8`; the blob says `water_slap ×7`). Glue duplication 7→10 slots, everything else 12→18. §3 predicted *"only shared-element cards by design"* and named four; the actual non-glue list is nine, adding `ignite`, `ember_jab`, `flashover` (fenrir_v2 ∩ sköll_v2) and `tend`, `thorn_whip`, `sap_strength` (ratatoskr ∩ huldra). Whether that is drift or the intended Fire/Nature overlap is Henry's call — but §3's census is understated either way.

**Kit shape (158 §2: two enablers, a consume, a scalar, a glue).** All twelve carry glue. Ten of twelve carry a scalar. **Sköll v1 and Kraken v2 carry neither a consume nor a scalar** — and sköll_v1 is the 11.7% deck. Her kit makes Strength (`fury_strike`, `howl`) and holds nothing that reads it; `brute_force` is in her POOL. That is a currency with no payoff in the opening deck, which is the thing 158 §2's consume/scalar pair exists to forbid, and it explains the field number without appeal to any knob.

**Currency census, re-derived from the registry rather than the design doc:** Strength 2 OS, Burn 3, Sharp 3, Bark 1, Dazed 6, Weakened 6, Poison 3, Energy 1. Dazed and Weakened are on half the roster each; Bark and Energy are one deck apiece.

### Not run

The full 140 comp grid (`npm run balance`, twelve `.balance.ts` suites) is a multi-hour job and §5.5 rules **no re-baseline** until the pricing rows land — measuring a pool that 162b says is 36% light at 2e would produce a grid that has to be thrown away. The 1v1 probe in §7 is the standing read until then.

## 10. 162d — the browser regenerates from the registry, 2026-09-23

`npm run decks` now also writes `collection-v2/registry.json` — the 98 cards, the twelve kits with their `startCopies`, the species pools and the run-only list, all read from the live registry (`src/debug/balance/collectionExport.ts`). `build.py` prefers that file over `collection.py` and falls back to the design draft with `--design` or when the export is absent.

The data crosses ONCE, in the direction that has a natural reader. Porting `build.py`'s 20 KB of presentation into TypeScript would be a rewrite of a working page for no gain; making Python read the registry would mean parsing `mingmingRegistry.ts` in a build script. Two design-only fields have no registry home — 158 §2's `shape` and `cur` — and are CARRIED from `collection.json`, never invented: a card the design file has not heard of renders unclassified rather than guessed. A registry-sourced run deliberately does not rewrite `collection.json`, which is the record of what Henry ruled.
