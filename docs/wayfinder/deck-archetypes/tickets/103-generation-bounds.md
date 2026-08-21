# Generation bounds (ticket 103): bound the mint, not the effect

- Type: wayfinder:task - runs IMMEDIATELY after ticket 102 (Henry sequenced them apart
  knowingly; sleipnir_v1 at ~85% is a KNOWN TRANSIENT, not accept-and-watch). Branch
  archetype-web.
- Status: **CLOSED 2026-08-20** - shipped, measured, reported. 851 tests green, `tsc` clean.

Grid finding 2: uncapped POWER makes stack ENGINES runaway - the fix is capping
GENERATION per turn, never the effect (capping the effect is what made statuses invisible
for a year). Audit every OS/daemon/card that MINTS combat-status stacks (sleipnir
MOMENTUM_DRIVE first - 2 Str per 0-cost on an all-0-cost deck; TREACHERY; SOLAR_OVERDRIVE
feeds; KINETIC_RAM; strength_burst-class cards exempt - a card paying energy is already
bounded). Per-turn grant caps sized by sim to bring sleipnir_v1 into band without
flattening the engines (knobs = the cap values, max 2 rounds each). Gates: band standard,
FTK 0, the fun thesis holds (close-call texture stays - do not cap engines into
choicelessness). ONE commit.

---

# Resolution

Report: [research/generation-bounds.md](../research/generation-bounds.md). ONE commit.

**Henry amended the ticket at the top: NO CAPS OF ANY KIND, per-turn included.** *"Try reducing his
number per card, then try a consume str for damage, and also try adding a debuff if those don't
work."* So the per-turn grant caps this ticket originally specified were NOT built. Nothing shipped
here is a cap; two existing caps were removed.

## The mint audit, and what shipped

`sleipnir_v1` MOMENTUM_DRIVE was the whole runaway: 2 Strengthened per 0-cost card on an
all-0-cost deck, measured at mean 4.85 / peak 24 stacks. Eleven arms measured
(`scratch/sleipnir.ts`), all cap-free:

| arm | field | verdict |
|---|---|---|
| live | 83.3% | the runaway |
| **A1 — 1 stack per card** | **54.4%** | the rate cut; dead cards 18.9 -> 16.1, turns 3.98 -> 4.45, blowouts 5 -> 2 |
| **RAMP at 4 — 1 per card, 2 once he holds 4+** | **55.7%** | **SHIPPED**, off Henry's round-3 feel note. Blowouts **0**. A condition, not a cap |
| A2 — 2, only on 0-cost ATTACKS (a condition) | 55.3% | works; A1 is simpler |
| B1/B2/B3/B4 — every attack consumes the pile at 1/2/5/8 power per stack | 18.8 / 22.5 / 41.3 / 60.0% | **overshoots hard.** Holding N stacks is +N power forever; cashing is one hit once |
| B5 — the pile leaks 1 stack per attack | 66.9% | works, 0 blowouts |
| B6/B7/B8 — `momentum_crash` consumes at 8/12/15 | 82.8 / 86.9 / 86.8% | **not a bound on its own** - one card cannot stop a permanent pile |
| C1/C2 — +1 / +2 Dazed on himself per mint | 73.5 / 58.2% | **works.** The named fallback if the rate cut is unwanted |

**Shipped = the RAMP + the hold-or-cash card.** `momentum_crash` already READ the pile (8 power per
Strengthened stack) without spending it, which under POWER is free upside on a permanent
multiplier. It now consumes. Two bonuses: it escapes `STRENGTH_STACK_CAP` (8) entirely, so a big
pile finally pays in full - **a second cap removed** - and it fixes the card's price (0.8 UNDER ->
2.8, inside its band, printed power unchanged).

**FEEL CALIBRATION SATISFIED.** Henry's round-3 note - *"10 str by turn 2 ... wiped turn 2"* against
him, *"4 -> 14 -> won turn 5 with 22 str, felt fun although a little OP"* piloting him - reads as
**early velocity, not the ceiling**. `scratch/strarc.ts` records the pile at the end of each of his
turns; the AI's arc at the live setting matches his hands (turn-2 peak 10 vs his 10). The flat cut
kills the turn-2 spike AND the turn-4 climb (peak 11); the **ramp at 4** kills the spike (turn-2
peak 8, no 10-stack opener) and keeps the climb (turn-4 peak 16, back in the teens). Thresholds 5
and 6 also land in band (52.0 / 47.8%) if 4 feels too quick in his hands - a one-number change.

## The four decks - all riders, sheds, stats, and one cap deletion

| deck | change | field |
|---|---|---|
| `skoll_v2` | **SOLAR_OVERDRIVE's five-stack cap DELETED** (`Infinity`, not a big number) | 34.3 -> **49.4%**, blowouts 6 -> 3 |
| `kraken_v2` | `capacitor` also grants 3 Sharp | 29.7 -> **45.2%**, blowouts 5 -> 2 |
| `ratatoskr_v1` | `shrug_off` -> shed 1 Weakened, gain 2 Sharp (the Dazed shed traded away to pay for it) | 35.0 -> **44.4%** |
| `audhumbla_v2` | species attack **60 -> 75** (lowest on the roster, median 85) + `purify` also sheds 2 Weakened / 2 Dazed | 31.2 -> **40.9%** |
| `audhumbla_v1` | rides the same species attack buff | 53.6 -> **68.3%**, blowouts 1 -> 0 |

**skoll_v2 is the headline.** She was the worst deck on the roster BECAUSE of a cap: 7 of her 9
cards make Strengthened, and her OS stopped counting at five stacks while every other status deck
got paid uncapped after ticket 102. Deleting the cap and nothing else was worth +15.6 points.

**Negative results worth keeping.** A stat buff alone does not fix `kraken_v2` (58 -> 70 HP is worth
+3.8; her problem is 34% dead cards, not fragility). A `forage` rider actively HURT `ratatoskr_v1`
(35.8 -> 21.3) - it is a self-targeting card. Every `audhumbla_v2` rider arm raised her field rate
and made her matchups MORE binary (blowouts 12 -> 14 -> 18 -> 21); only the cleanse improved them.
Raising `purify` to 2 Energy priced correctly and made her WORSE (27.6%) - on a 2-Energy frame a
2-cost cleanse costs the turn.

## Gates

- **851 tests green, `tsc` clean.** No test needed re-pinning.
- **Band standard: 28/32 -> 31/32 in 35-80.** Only `fafnir_v1` 34.0% falls out (was 36.4, drifted
  -2.4, now 1.0 under the floor). Left deliberately - see the report's section 6.
- **NEUTRAL absolutes 34 -> 30** (0% 15->13, 100% 19->17). All-bucket 0%/100% 42/53 -> 34/46.
  **First time that number has moved the right way since the re-denomination.**
- **FTK 2, unchanged** - the same two cells (`skoll_v2` vs `jormungandr_v1`, `jormungandr_v1` vs
  `skoll_v1`).
- Dead cards 21.0% -> 20.8%. Game length 5.21 -> 5.21 turns. Control frozen.
- **8-DIFF: 23 of 32 rows moved >=1 point.** Eight are the intended targets. The collateral, named:
  `valkyrie_v1` -4.1, `valkyrie_v2` -4.1, `fafnir_v1` -2.4 - all decks that were beating the decks
  this ticket buffed. Nothing else moved more than 3 points.
- **Redlines 66 -> 68**, fully accounted: NEW `capacitor` 7.2 vs 6.5 (**the deliberate overage** -
  the in-band alternative reads 12 points worse and 2 more blowouts), NEW `purify` 3.3 vs 3.0, NEW
  `os:kraken` variance 0.18 (a 2.3 diagnostic - her decks are further apart now that v2 works);
  RESOLVED `os:sleipnir` variance. The 22 failing balance checks are all 2.3 OS-variance, same 22
  before and after.

## Found along the way

**THE CELL CACHE HAS BEEN BLIND TO EVERY `hooks.json` CHANGE SINCE TICKET 97.** `sideHash` read
`FIRMWARE_REGISTRY[os]` directly; that registry is EMPTY until the first `getOSBehavior()` call, and
ticket 97's own fix (hoist every key before the first battle) guarantees nothing has initialised
firmware at key time. The `?? null` fallback fired for all 32 decks, so the firmware component of
every key was the constant `null`. **It served a stale 960-cell grid for this ticket's own OS edit**
- 960 hits, 0 misses, byte-identical output, for a ten-point change. Fixed (`getOSBehavior(os)`),
pinned (`src/debug/balance/cellCache.test.ts`), `cacheproof.ts` still bit-identical. Tickets 102 and
this ticket's first pass are unaffected - both touched hashed engine `.ts` files and recomputed from
cold. **Every grid in the report was re-run after the fix.**

**`isAttack` is declared in `HookSchema.ts` and nothing in the engine reads it.** A hook written
with `when: { isAttack: true }` fires unguarded, silently. No shipped hook uses it (all 46 checked),
so it is dead schema rather than a live bug - but it cost one measurement run that came back
byte-identical to the control. The working key is `actionType: 'ATTACK'`.

## Not done

- `glass_cannon` remains -5.1 UNDER budget, still the worst-priced card in the registry. A one-line
  fix; not bundled because the cap removal alone lands skoll mid-band.
- `audhumbla_v2`'s blowouts went 11 -> 12. Light tuning put her in band; it did not make her a
  better deck, and she still holds no duality card of her own. **Ticket 101's rebuild is still the
  answer.**
- `SKOLL_V2_STRENGTH_CAP` is now a `let` with an exported setter, used only by `scratch/weak.ts`.

## Instruments added

`scratch/sleipnir.ts` (11 mint arms), `scratch/weak.ts` (22 arms across the four decks),
`scratch/pricetune.ts` + `scratch/pricetune2.ts` (find the parameter value that lands a card inside
its band before spending sim time on it), `scratch/audh.ts`, `scratch/kraken103.ts`,
`scratch/audhv1.ts`, `scratch/fieldcheck.ts`, `scratch/pricecards.ts`, **`scratch/strarc.ts`** (the
turn-by-turn Strengthened arc - the only instrument that can see Henry's feel gate).
