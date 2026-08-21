# 3v3 breaks on WIDTH, not length — and the archetype web inverts

- Type: wayfinder:research. **Ticket 109.** Branch `archetype-web`. **REPORT-ONLY** — no card,
  price, OS or engine behaviour was changed.
- **COMPLETE.** Part 1 (pricing) and Part 2 (25-comp canary) both done: **504 games at 3v3** plus a
  1,208-game 1v1 baseline.
- Instrument: screening at `AI_LITE=1 AI_BEAM=8`, set per-run. **Every finding below marked
  CONFIRMED was re-run at full beamless lookahead** per the binding ticket-108 rule.
- Part 2 was run on Henry's machine from an isolated clone pinned at commit `a30774c`, so a second
  agent working in the repo could not disturb it mid-run. `run109.mjs` reproduces it.

---

## 0. The short version

**The ticket asked whether 1v1 prices survive length and width. Length barely changes; width changes
everything — and neither turned out to be the thing that actually breaks the game.**

1. **3v3 games are 1.33x longer, not 4-10x. This corrects my own ticket-98 report**, which said
   4-10x and was wrong. Measured on the same decks: 1v1 **5.27** turns, 3v3 **7.03**.
2. **Poison's damage share FALLS at 3v3** — 6.64% to 4.26%. The ticket predicted a quadratic
   runaway. It goes the other way.
3. **Status PILES are 2-4x bigger.** Every consume-payoff constant in `powerscale.ts` was measured
   at 1v1, so every consume payoff is a 2-4x card in team play. This is the real price indictment.
4. **The archetype web inverts. CONFIRMED beamless: zoo takes 87.5% of the panel and beats CONTROL,
   its designated predator, 100%.** Twenty-five designed stress comps could not beat it.
5. **The roster is SAFE on every hard gate.** 0 FTK, 1 truncated game in 504, no comp above 90%,
   and **no unkillable game** — the three-healer stall comp reads a beatable 66.7%.

**The headline for design is #4, not #3.** The pile constants are wrong but they are arithmetic. The
web inversion is structural.

---

## 1. Game length: the ticket-98 correction

| | 1v1 | 3v3 | ratio |
|---|---|---|---|
| mean turns | 5.27 | **7.03** | **1.33x** |
| median | 4.75 | 7.12 | |
| longest pairing | 15.2 | 14.6 | |
| FTK | 0 | 0 | |
| stalls / truncated | 0 | 0 | |

Same 18 decks, same counters, same tier; 120 games at 3v3 and 1,208 at 1v1.

**What I got wrong in ticket 98**, since it reached HANDOFF and map.md: I reported "3v3 runs 11.88
turns against 1v1's 2-3" and concluded that **no** 1v1 status price transfers. The 11.88 came from
four comps and one 27.5-turn outlier, and the "2-3" was never measured — the 1v1 grid's *base-deck*
battles run short, but the panel decks run 5.27. The real multiplier is 1.33x.

The conclusion survives in a different form, which is §2. Length is not the mechanism. Width is.

---

## 2. The prices that break — ranked

### 2.1 Status piles, 2-4x — the strongest price indictment

Stacks landed per game, both sides pooled, panel population:

| status | 1v1 | 3v3 | ratio | what it indicts |
|---|---|---|---|---|
| **Strengthened** | 5.06 | **16.86** | **3.33x** | `ASSUMED_CONSUMED_STACKS.Strengthened = 8`; SOLAR_OVERDRIVE is **uncapped +15%/stack** |
| **Burn** | 1.09 | **4.39** | **4.04x** | `ASSUMED_CONSUMED_STACKS.Burn = 1.5` — the largest relative move |
| Energized | 0.52 | 1.69 | 3.25x | the ramp economies (HOARD, capacitor) |
| Sharp | 5.34 | 13.54 | 2.54x | huldra's pile; `rimebreaker` is priced on `ASSUMED_ANY_STATUS = 2` |
| BarkShield | 4.60 | 11.26 | 2.45x | gullinbursti's shield math |
| Dazed | 3.50 | 7.76 | 2.22x | |
| Poison | 6.27 | 13.01 | 2.07x | `ASSUMED_CONSUMED_STACKS.Poison = 8` |
| Weakened | 4.97 | 9.83 | 1.98x | |
| Regen | 0.84 | 1.43 | 1.70x | `ASSUMED_CONSUMED_STACKS.Regen = 10` |

**Every consume-payoff card in the registry is priced off the 1v1 column.** `momentum_crash` reads
8 power per Strengthened stack against an assumed pile of 8; the measured 3v3 pile is 16.86. None of
these is a bug in 1v1 — they are correct there — but a consume payoff is a **multiplier on pile
size**, so a 2-4x pile is a 2-4x card.

The canary's 384 games corroborate the shape on a different population (Strengthened 19.86/game,
Sharp 16.88, Poison 15.85, BarkShield 14.84). Not a like-for-like ratio — different comps — but the
same ordering, with Strengthened on top.

**Ranked by how wrong the constant is: Burn (4.04x), Strengthened (3.33x), Energized (3.25x), Sharp
(2.54x), Poison (2.07x), Regen (1.70x).**

**Strengthened is the one to look at first** — not the largest ratio, but the only one feeding an
**uncapped percentage multiplier**. §4 shows that has NOT produced a broken comp, which is a
reprieve rather than an acquittal.

### 2.2 Poison at length: the prediction fails, in the opposite direction

| | 1v1 | 3v3 | ratio |
|---|---|---|---|
| Poison share of all damage dealt | **6.64%** | **4.26%** | **0.64x** |
| Burn share | 2.18% | 3.24% | 1.49x |

Two measured reasons: the games are only 1.33x longer, and **damage output scales with body count
faster than a DoT does**. Poison's pile grew 2.07x, but total damage grew faster, so its share fell.

Part 2 confirms it at the comp level: **`tag-poison-at-length` — three Poison appliers built
specifically to exploit long games — reads 50.0%, dead average.** And my pre-registered
Poison-clock-plus-healer comp ranked 22nd of 25.

**Poison is not under-priced at 3v3; it is arguably over-priced there.** No fix proposed.

### 2.3 DoT attribution had to be built

`RunTelemetry` deliberately refuses to attribute DoT — its own header calls that "the documented DoT
attribution trap" — so none of §2.2 was measurable when the ticket was written. The end-of-turn tick
loop iterates **per status effect**, so at that one site the cause is unambiguous. `statusCensus.ts`
taps it, gated on `STATUS_CENSUS=1`, and the 1v1 grid is bit-identical with it off.

**The 0-AI-SIM-COUNTS trap nearly ruined every number here.** `TacticalAI` scores candidates by
running them through the *real* reducer, so a counter in the reducer counts the AI's imagination —
thousands of speculative plays per real one at 3v3. The AI searches with the event bus muted, so
`globalBattleEventBus.isLive` (added for this) is the predicate separating a real tick from an
imagined one. Every counter is behind it or reads `RunTelemetry`, which is real-plays-only.

---

## 3. The archetype web inverts at width — CONFIRMED BEAMLESS

`panel-zoo` (jormungandr_v1 + sleipnir_v1 + hraesvelgr_v1 — the entire zoo role, which has exactly
three decks) against the reference panel, **all five pairings re-run at full beamless lookahead**:

| opponent | screening | **beamless** |
|---|---|---|
| panel-control | 100.0% | **100.0%** |
| panel-ramp | 100.0% | **100.0%** |
| panel-burst | 87.5% | 62.5% |
| panel-mixed-a | 75.0% | 75.0% |
| panel-mixed-b | 100.0% | **100.0%** |
| **mean** | 92.5% | **87.5%** |

Read against research/archetype-web.md:

- **ZOO PREYS ON RAMP: working, but far too hard.** The web calls for soft counters at 65-80%.
  Measured **100%**, beamless.
- **CONTROL PREYS ON ZOO: inverted.** Control is zoo's designated predator. It loses **every game**.

**Part 2 makes this much stronger than a panel artefact.** Twenty-five purpose-built comps played
this exact comp. **The best result against it was 50%; ten of the sixteen new comps scored 0%; the
mean was 14.1%.** Comps built around uncapped multipliers, side-wide Burn stacking and entity-count
abuse all failed to touch it.

**Is it just "velocity wins"? Partly — and the counterexample matters:**

| | n | mean | range |
|---|---|---|---|
| comps fielding ≥1 zoo deck | 4 | **74.0%** | 58.3–87.5 |
| comps fielding none | 21 | 50.2% | 20.8–79.2 |

The signal is real — the top comp is the all-zoo one, and 3 of the top 5 field zoo decks — but
**`stab-earth` reaches 79.2% with no zoo deck at all**, so velocity is not the only route to the top
of this table. I would not state "velocity is the axis" as a finding; I would state that **zoo is
mispriced at width and Earth deserves its own look.**

**A candidate mechanism, unconfirmed:** control's answer to zoo is attrition — debuffs and removal
that punish many small bodies. At 3v3 a control deck spreads the same debuff budget across three
attackers while the zoo side's card-velocity advantage multiplies by three casters drawing one
shared pile. Zoo's plan scales with bodies; control's answer divides among them.

**If that is structural rather than tuning, ticket 72's unbuilt `riptide_daemon` — the roster's only
DESIGNED zoo-killer, salvaged but never built — stops being an at-leisure decision.**

---

## 4. The canary: 25 comps, 504 games

**Hard gates: FTK 0. No comp above 90%. One truncated game in 504** (`guess-4-sharp-wall` vs
`panel-mixed-b`, 26 turns) — a curiosity, not a defect.

| rank | comp | mean vs panel | note |
|---|---|---|---|
| 1 | `triple-zoo` | **87.5%** | the whole zoo role |
| 2 | `stab-earth` | 79.2% | **no zoo decks — the counterexample** |
| 3 | `guess-5-zoo-plus-payoff` | 79.2% | pre-registered; 2 zoo decks |
| 4 | `stab-light` | 70.8% | |
| 5 | `stab-air` | 70.8% | 2 zoo decks |
| 6 | `triple-sustain-STALL` | **66.7%** | **the unkillable-game check — beatable** |
| 7 | `triple-control` | 62.5% | |
| 8–13 | `stab-fire`, `stab-dark`, `guess-2-treachery-engine`, `tag-treachery`, `tag-rebirth-pile`, `tag-energy-ramp` | 58.3% | |
| 14–15 | `stab-water`, `tag-poison-at-length` | 50.0% | |
| 16–20 | `stab-nature`, `stab-ice`, `guess-4-sharp-wall`, `tag-sidewide-burn`, `tag-solar-jackpot` | 45.8% | |
| 21 | `triple-burst` | 41.7% | |
| 22–23 | `guess-1-length-tax`, `triple-ramp` | 33.3% | |
| 24 | `tag-antiheal-vs-stall` | 25.0% | |
| 25 | `guess-3-solar-runaway` | 20.8% | |

### The three comps that mattered most all came back clean

- **`triple-sustain-STALL` — 66.7%, zero stalls. There is no unkillable game.** Three healers is
  strong and beatable; its longest pairing hit 21.5 turns without truncating. **FTK's inverse is not
  a live risk.**
- **`tag-solar-jackpot` — 45.8%.** The daemon+OS compounding jackpot, with an uncapped +15%/stack
  multiplier, lands mid-table. The mandated early revisit finds nothing to fix.
- **`tag-treachery` — 58.3%.** The ~3x ally-damage feed is real and breaks nothing.

### Two results that argue the roster is thin where it should be strong

- **`tag-antiheal-vs-stall` — 25.0%, fourth from bottom.** BLOOD_SCENT is the roster's designed
  anti-heal answer. If stall ever does become a problem, **the designed answer does not work.**
- **`triple-ramp` — 33.3%.** Ramp was supposed to be the role 3v3's longer games rewarded. It is
  among the weakest things measured, which is consistent with §1: the games are barely longer.

### Corrections to this report's own earlier framing

The interim version implied max-STAB was the safe axis and role stacks the risk. **Measured, neither
is true.** Max-STAB spans 45.8–79.2% with nothing at an extreme; role stacks span 33.3–87.5% and
include both the best and the third-worst comp. **The axis that separates comps is not element
density or role purity.**

---

## 5. The pre-registered guesses were mostly wrong — and that is a finding

Written into `teamComps.ts` **before any 3v3 game was run**, per the ticket:

| guess | reasoning at the time | measured | rank |
|---|---|---|---|
| 5 — zoo + TREACHERY payoff | velocity plus a chaos converter | **79.2%** | **3 / 25** |
| 2 — TREACHERY engine | the 3x feed should be enormous | 58.3% | 10 / 25 |
| 4 — "the comp I'd ladder with" | Sharp wall behind shields and a healer | 45.8% | 18 / 25 |
| 1 — Poison clock + healer | long games collect quadratic Poison | 33.3% | 22 / 25 |
| 3 — uncapped SOLAR runaway | "the classic runaway shape" | **20.8%** | **25 / 25 — last** |

**Two of my five were built on the ticket's own hypotheses — that games would be long and that
Poison and uncapped multipliers would run away — and they finished 22nd and last.** The only guess
that worked was the one built on card velocity, which nothing in the ticket predicted.

That is the strongest evidence in the document that **the pre-measurement model of 3v3 was wrong**,
and it is worth more than any single win rate here.

---

## 6. The entity-count tag list, measured — and two tags name nothing

| tagged mechanic | result |
|---|---|
| TREACHERY feed (skoll_v1) | `tag-treachery` **58.3%** — feed is real, breaks nothing |
| side-wide effects (inferno / heat_wave, both `target: 'Side'`) | `tag-sidewide-burn` **45.8%** |
| reshuffle firmware in a 27-card pile (valkyrie_v2 REBIRTH) | `tag-rebirth-pile` **58.3%** |
| energy-ramp stacking | `tag-energy-ramp` **58.3%** |
| **riptide procs** | **UNMEASURABLE — `riptide_daemon` does not exist.** Ticket 72 closed with the design salvaged but unbuilt |
| **RANDOM_ENEMY dilution** | **NO SUCH CARD EXISTS.** The mechanic lives in valkyrie_v2's REBIRTH hook ("attacks a random enemy"), not in any card |

**Two of the five entity-count tags name things the registry does not contain.** The watch list was
written from design intent rather than from the shipped pool, and should be re-derived from the pool
before it is used as a checklist again.

---

## 7. Method notes worth keeping

- **The comp suite is committed** as `src/debug/balance/teamComps.ts` — 6 panel + 25 canary comps,
  each with a one-line intent. It is ready to become a standing gate.
- **`run109.mjs` reproduces Part 2** from an isolated clone pinned to a commit. Pinning earned
  itself: the repo's HEAD moved to a line-ending normalisation pass *during* the run, which would
  otherwise have silently poisoned a 26-minute beamless measurement.
- **The panel is deliberately ordinary.** Every canary result is read against it, so a panel built
  from strong comps would compress everything toward 50%.
- **Screening vs beamless agreed well** where it was checked: zoo read 92.5% screening and 87.5%
  beamless, same ordering, same verdict. Consistent with ticket 108's finding that lite compresses
  the spread without reordering.

---

## 8. Questions for Henry

1. **The web inversion (§3) is the decision on the table.** Control losing 100% to zoo is either
   tuning or structural. If structural, **the riptide salvage from ticket 72 becomes urgent** — it
   is the only designed zoo answer the roster has.
2. **Which pile constants get re-derived at 3v3, and when?** All six are wrong for team play (§2.1).
   Re-deriving them changes 1v1 pricing, so it is a sequencing question.
3. **`tag-antiheal-vs-stall` at 25% (§4)** — the designed anti-heal answer is one of the weakest
   comps measured. Worth knowing now, while stall is *not* a problem, rather than later.
4. **May a comp field two of the same species?** Every comp here is three distinct species. If the
   shipped game allows duplicates, the max-STAB set and several tag comps need re-running.
5. **`stab-earth` at 79.2% with no velocity (§3)** deserves its own look — Earth was already flagged
   HIGH for archetype overlap in the possibility-space audit.
6. **Poison being *over*-priced at 3v3 (§2.2)** is the opposite of the ticket's expectation. Worth a
   design conversation before anyone "fixes" it.
