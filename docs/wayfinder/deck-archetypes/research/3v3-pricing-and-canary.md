# 3v3 breaks on WIDTH, not length — and the archetype web inverts

- Type: wayfinder:research. **Ticket 109.** Branch `archetype-web`. **REPORT-ONLY** — no card,
  price, OS or engine behaviour was changed.
- **INTERIM: Part 1 is complete, Part 2 is 10 of 25 comps.** Committed early because the design
  agent is waiting on it; the remaining 15 comps land in a follow-up commit. Every incomplete
  section says so in place.
- Instrument: screening at `AI_LITE=1 AI_BEAM=8`, set per-run. **Findings marked CONFIRMED were
  re-run at full beamless lookahead** per the binding ticket-108 rule; anything marked SCREENING has
  not been, and is a ranking rather than a verdict.

---

## 0. The short version

**The ticket asked whether 1v1 prices survive length and width. The answer is that length barely
changes and width changes everything.**

1. **3v3 games are 1.33x longer, not 4-10x. This corrects my own ticket-98 report**, which said
   4-10x and is wrong — it read 16 games with one 27.5-turn outlier against a *remembered* 1v1
   figure. Measured on the same decks: 1v1 **5.27** turns, 3v3 **7.03**.
2. **Poison's damage share FALLS at 3v3** — 6.64% to 4.26%. The ticket predicted a quadratic
   runaway over long games. It goes the other way, because the games are not much longer and there
   are three times as many bodies to spread the same appliers across.
3. **Status PILES are 2-4x bigger.** This is the real indictment: every consume-payoff constant in
   `powerscale.ts` was measured at 1v1.
4. **`panel-zoo` beats the field 92.5%, and beats CONTROL 100% — CONFIRMED beamless.** Under
   research/archetype-web.md, control preys on zoo. **At width, the wheel turns the other way.**
5. **Nothing stalled and nothing FTK'd** in 174 games so far. The 3-healer stall comp — the ticket's
   headline unkillable-game check — has not run yet.

---

## 1. Game length: the ticket-98 correction

| | 1v1 | 3v3 | ratio |
|---|---|---|---|
| mean turns | 5.27 | **7.03** | **1.33x** |
| median | 4.75 | 7.12 | |
| longest pairing | 15.2 | 14.6 | |
| FTK | 0 | 0 | |
| stalls / truncated | 0 | 0 | |

Same 18 decks, same counters, same tier, 120 games at 3v3 and 1,208 at 1v1.

**What I got wrong in ticket 98**, since it is now in HANDOFF and map.md and should be corrected
there: I reported "3v3 runs 11.88 turns against 1v1's 2-3" and concluded that **no** 1v1 status price
transfers. The 11.88 came from four comps and one 27.5-turn outlier, and the "2-3" was never
measured in that session at all — the 1v1 grid's *base-deck* battles run short, but the panel decks
run 5.27. The correct multiplier is 1.33x, and the conclusion built on it was too strong.

The conclusion survives in a different form, which is what section 2 is about. Length is not the
mechanism. Width is.

---

## 2. The prices that break — ranked

### 2.1 Status piles, 2-4x — the strongest indictment

Stacks landed per game, both sides pooled:

| status | 1v1 | 3v3 | ratio | what it indicts |
|---|---|---|---|---|
| **Strengthened** | 5.06 | **16.86** | **3.33x** | `ASSUMED_CONSUMED_STACKS.Strengthened = 8`, and skoll_v2's SOLAR_OVERDRIVE is **uncapped +15%/stack** |
| **Burn** | 1.09 | **4.39** | **4.04x** | `ASSUMED_CONSUMED_STACKS.Burn = 1.5` — the largest relative move on the board |
| Energized | 0.52 | 1.69 | 3.25x | the ramp economies (HOARD, capacitor) |
| Sharp | 5.34 | 13.54 | 2.54x | huldra's pile — and `rimebreaker`, which is priced on `ASSUMED_ANY_STATUS = 2` |
| BarkShield | 4.60 | 11.26 | 2.45x | gullinbursti's shield math |
| Dazed | 3.50 | 7.76 | 2.22x | |
| Poison | 6.27 | 13.01 | 2.07x | `ASSUMED_CONSUMED_STACKS.Poison = 8` |
| Weakened | 4.97 | 9.83 | 1.98x | |
| Regen | 0.84 | 1.43 | 1.70x | `ASSUMED_CONSUMED_STACKS.Regen = 10` |

**Every consume-payoff card in the registry is priced off the 1v1 column.** `momentum_crash` reads
8 power per Strengthened stack against an assumed pile of 8; the measured 3v3 pile is 16.86.
`drink_deep` reads 15 per Regen stack. `rimebreaker` reads 20 per distinct status against an assumed
2. None of these is a bug in 1v1 — they are correct there — but a consume payoff is a **multiplier on
pile size**, so a 2-4x pile is a 2-4x card.

**Ranked by how badly the constant is wrong: Burn (4.04x), Strengthened (3.33x), Energized (3.25x),
Sharp (2.54x), Poison (2.07x), Regen (1.70x).**

The one I would look at first is **Strengthened**, not because its ratio is the largest but because
SOLAR_OVERDRIVE converts it into an **uncapped percentage multiplier**. A 3.33x pile behind an
uncapped multiplier is the classic runaway shape, and the `tag-solar-jackpot` comp built to test it
has not run yet (section 4).

### 2.2 Poison at length: the prediction fails, in the opposite direction

| | 1v1 | 3v3 | ratio |
|---|---|---|---|
| Poison share of all damage dealt | **6.64%** | **4.26%** | **0.64x** |
| Burn share | 2.18% | 3.24% | 1.49x |

The ticket expected Poison's quadratic value to dominate long games. Two measured reasons it does
not: the games are only 1.33x longer, and **damage output scales with body count faster than a DoT
does**. Poison's *pile* did grow (2.07x), but total damage grew faster, so its share fell.

**Burn moved the other way** — 1.49x share on a 4.04x pile — which is consistent with Burn being the
status whose per-stack tier table rewards concentration.

**This is a price indictment in the reverse direction and should be read carefully: Poison is not
under-priced at 3v3, it is arguably OVER-priced there.** No fix is proposed; the ticket is
report-only.

### 2.3 DoT attribution had to be built, and it did not exist before

`RunTelemetry` deliberately refuses to attribute DoT — its own header calls that "the documented DoT
attribution trap" — so none of §2.2 was measurable when the ticket was written. The end-of-turn tick
loop iterates **per status effect**, so at that one site the cause is unambiguous. `statusCensus.ts`
taps it, gated on `STATUS_CENSUS=1`.

**The 0-AI-SIM-COUNTS trap is real and nearly ruined every number here.** `TacticalAI` scores
candidates by running them through the *real* reducer, so a counter placed in the reducer counts the
AI's imagination alongside the battle — at 3v3 that is thousands of speculative plays per real one.
The AI searches with the event bus muted, so `globalBattleEventBus.isLive` (added for this) is
exactly the predicate that separates a real tick from an imagined one. Every counter in this ticket
is behind it or reads `RunTelemetry`, which is real-plays-only by construction.

---

## 3. The archetype web inverts at width — CONFIRMED

`panel-zoo` (jormungandr_v1 + sleipnir_v1 + hraesvelgr_v1 — the entire zoo role, which has exactly
three decks) against the reference panel:

| opponent | screening | **beamless confirm** |
|---|---|---|
| panel-control | 100.0% | **100.0%** |
| panel-ramp | 100.0% | **100.0%** |
| panel-burst | 87.5% | 62.5% |
| panel-mixed-a | 75.0% | *pending* |
| panel-mixed-b | 100.0% | *pending* |
| **mean vs panel** | **92.5%** | *3 of 5 confirmed* |

**This trips two of the ticket's flags at once** (">90% vs the whole panel" and a role behaving
outside its web license), and it is the finding I am most confident in because the two most extreme
cells were re-run at full beamless lookahead and did not move.

Read against research/archetype-web.md:

- **ZOO PREYS ON RAMP: working, but far too hard.** The web calls for soft counters at roughly
  65-80%. Measured: **100%**.
- **CONTROL PREYS ON ZOO: inverted.** Control is supposed to be zoo's predator. It loses **100%**.

**A candidate mechanism, unconfirmed and worth someone testing directly:** control's answer to zoo is
attrition — debuffs and removal that punish many small bodies. At 3v3 a control deck must spread the
same number of debuff applications across three attackers, while the zoo side's card-velocity
advantage multiplies by three casters drawing from one shared pile. Zoo's plan scales with bodies;
control's answer divides among them. If that is right, it is not a tuning problem but a structural
one, and **kraken_v1's unbuilt `riptide_daemon` — the designated zoo-killer, salvaged in ticket 72 —
is the roster's only designed answer to exactly this.** That raises the priority of the salvage
decision considerably.

The panel's full ordering (screening): zoo 92.5%, ramp 67.5%, mixed-a 45.0%, burst 37.5%,
control 35.0%, mixed-b 22.5%.

---

## 4. The canary — 10 of 25 comps

**No stalls and no FTK in any comp measured so far.** No comp has exceeded the 90% flag line.

### Max-STAB (all 8 complete, screening)

| comp | mean vs panel | turns |
|---|---|---|
| stab-earth | 79.2% | 7.8 |
| stab-light | 70.8% | 8.2 |
| stab-air | 70.8% | 5.0 |
| stab-fire | 58.3% | 6.0 |
| stab-dark | 58.3% | 8.5 |
| stab-water | 50.0% | 7.4 |
| stab-nature | 45.8% | 9.3 |
| stab-ice | 45.8% | 8.2 |

**A 33-point spread with nothing at an extreme — max-STAB density is not a broken axis.** That is a
real negative result: stacking an element does not break the game. `stab-earth` at the top is
consistent with Earth being the element the archetype-space audit flagged HIGH for overlap, and it
is worth a beamless confirm before anyone acts on it.

`triple-zoo` (necessarily the same three decks as `panel-zoo`) reads **87.5%** as a canary comp
against the panel, corroborating §3 from the other direction.

### Not yet run — 15 comps

Including three the ticket calls out specifically:

- **`triple-sustain-STALL`** (audhumbla_v1 + valkyrie_v1 + gullinbursti_v1) — **the headline
  unkillable-game check**, and the single most important comp still outstanding.
- **`tag-solar-jackpot`** — SOLAR_OVERDRIVE hosting `core_overclock_daemon`, the pool watch-item's
  mandated early revisit. §2.1 raises the stakes on this one.
- **`tag-treachery`** — skoll_v1's ally-damage feed, predicted ~3x at width.
- The four remaining role stacks and all five pre-registered best guesses.

---

## 5. Two of the ticket's tagged mechanics cannot be measured

| tagged mechanic | status |
|---|---|
| TREACHERY feed rate | skoll_v1. Comp built, **not yet run** |
| side-wide effects (inferno / heat_wave) | both are `target: 'Side'`; comp built with them as scenario extras, **not yet run** |
| reshuffle firmware in a 27-card pile | valkyrie_v2 REBIRTH. Comp built, **not yet run** |
| **riptide procs** | **UNMEASURABLE — `riptide_daemon` does not exist.** Ticket 72 closed as superseded with the design salvaged but unbuilt |
| **RANDOM_ENEMY dilution** | **NO SUCH CARD EXISTS.** The mechanic is real but lives in valkyrie_v2's REBIRTH hook ("attacks a random enemy"), not in any card — so the dilution is a *property of that hook*, not a pool-wide tag |

**Two of the five entity-count tags name things the registry does not contain.** The watch list was
written from design intent rather than from the shipped pool, and should be re-derived from the pool
before it is used as a checklist again.

---

## 6. Method notes worth keeping

- **The comp suite is committed** as `src/debug/balance/teamComps.ts` — 6 panel + 25 canary comps,
  each with a one-line intent, so it can become a standing gate.
- **Two construction assumptions need Henry's ruling.** (1) **One member per species.** The ticket's
  "2+1 splash" phrasing implies duplicates are not allowed; if the shipped game lets a player field
  two Skolls, several comps get stronger and the max-STAB set must be re-run. (2) Tag-abuse `extras`
  are injected into the scenario only, never the registry — that is what keeps this report-only.
- **The panel is deliberately ordinary.** Every canary result is read against it, so a panel built
  from strong comps would compress everything toward 50% and hide what the canary is for.

---

## 7. Questions for Henry

1. **The web inversion (§3) is the decision.** Control losing 100% to zoo at 3v3 is either a tuning
   problem or a structural one. If structural, **the riptide salvage from ticket 72 stops being an
   at-leisure decision** — it is the roster's only designed zoo answer.
2. **Which pile constants do you want re-derived at 3v3, and when?** All six are wrong for team play
   (§2.1). Re-deriving them changes 1v1 pricing, so this is a sequencing question, not just a
   measurement one.
3. **Poison being *over*-priced at 3v3 (§2.2)** is the opposite of what the ticket expected. Worth a
   design conversation before anyone "fixes" it.
4. **May a comp field two of the same species?** (§6.) It changes what the canary is measuring.
5. **Ticket 98's length finding needs correcting in HANDOFF and map.md** — I have corrected it here;
   say if you want me to amend the two indexes in the follow-up commit.
