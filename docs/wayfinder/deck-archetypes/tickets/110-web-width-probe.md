# Ticket 110 — the web-inversion probe: body count, or type dilution?

**Status:** OPEN, measuring. Opened 2026-08-21 on `legion/balance`.
**Ruled by Henry 2026-08-21:** the web inversion is the first item off ticket 109's open list.
**Report:** `research/web-width.md` (written when the probe lands).

---

## 1. What ticket 109 found, and what it did not

`panel-zoo` (jormungandr_v1 + sleipnir_v1 + hraesvelgr_v1 — the entire zoo role) takes 87.5% of the
reference panel at 3v3 and beats `panel-control` **100%, confirmed beamless**. `research/archetype-web.md`
says control is zoo's designated predator. Twenty-five purpose-built stress comps could not beat zoo:
best 50%, ten at 0%, mean 14.1%.

109 proposed a mechanism and correctly labelled it UNCONFIRMED: *zoo's plan scales with bodies while
control's answer divides among them — the same debuff budget spread over three attackers.* It also
recorded the consequence: if that is structural, ticket 72's unbuilt `riptide_daemon` — the roster's
only designed zoo-killer — stops being an at-leisure salvage.

**Nothing has confirmed that mechanism, and a second one fits the same evidence.**

## 2. The competing explanation, from data we already had

Read off `docs/balance/deck_grid.json` (960 cells, 30 iterations per order, no new sims):

| ZOO vs CONTROL at 1v1 | zoo's win rate | cells |
|---|---|---|
| all cells | **38.0%** | 21 |
| NEUTRAL cells only (elemental advantage removed) | **59.4%** | 3 |

**The web leg reverses when the type chart is taken out of it.** Control never preyed on zoo as a
role; huldra_v1 is type-advantaged into all three zoo decks and beats them 3.3 / 5.0 / 3.3%, and
that is what the 38.0% is made of. On neutral ground zoo already wins. The whole neutral role matrix
says the same thing — CONTROL is the *worst* role once type is removed (41.4% vs RAMP, 43.9% vs ZOO,
47.6% vs BURST), which is `0-WHEEL-DOES-NOT-TURN` and `0-THE-WHEEL-IS-A-LADDER` restated: **not one
leg of the wheel holds.**

At 3v3 both sides field three elements simultaneously and STAB is by caster, so elemental advantage
largely **cancels** and the matchup reverts toward the neutral matrix. If that is the whole story:

- the "inversion" is not an inversion, it is the type chart ceasing to mask a ladder we already knew about;
- no entity-count mechanism is implicated;
- **`riptide_daemon` is aimed at the wrong thing** — it punishes cards per turn, which is not what changed.

Caveat stated plainly: the neutral sample is **3 cells**. It is directionally strong and statistically
thin, which is exactly why this is a probe and not a finding.

## 3. What the probe measures

Hold the deck population **fixed** and vary only how many of them are on the field at once, so body
count is the single moving part. `scratch/webwidth.ts`:

| width | pairings | construction |
|---|---|---|
| 1 | 9 | each zoo deck vs each control deck |
| 2 | 9 | each 2-subset vs each 2-subset |
| 3 | 1 | the full `panel-zoo` vs `panel-control` |

30 iterations per pairing, both orders (60 games), two seed bases. **The AI tier is identical at every
width** — beam and lite bias with branching, and branching is itself a function of width (~6 candidates
at 1v1, ~20 at 3v3), so mixing tiers across widths would confound the thing being measured. Screening
pass at `AI_LITE=1 AI_BEAM=8`; confirm pass full and beamless.

Secondary quantity, and the direct fingerprint of 109's hypothesis: **debuff stacks landed per enemy
body.** If a fixed control answer budget is being spread over more attackers, this must fall as width
rises. If it holds flat, the answers-divide story is wrong however the win rate moves.

## 4. Pre-registered predictions

Per ticket 109's own methodological result — five comps pre-registered, finishing 3rd, 10th, 18th,
22nd and last, with the two built on the ticket's hypotheses coming 22nd and 25th — **the predictions
go in writing before the numbers.**

Known at the time of writing (so this is registration, not hindsight): the 1v1 anchor from the grid
(38.0% all cells / 59.4% neutral), the screening width-1 mean re-measured here (**35.6%**, which
agrees with the grid), and **one** width-2 pairing (68.3%). Everything below is unseen.

**H-TYPE (type dilution — my primary, ~60% confidence).** The sign flip is the type chart cancelling.
Width 2 lands near the neutral 1v1 figure, ~55-65%. Width 3 lands **materially below 100%** —
somewhere in 65-85% — and the gap from 59% to there is the real, much smaller, width term. Debuff
stacks per enemy body stay roughly flat.

**H-ENTITY (109's mechanism — ~30%).** Win rate climbs smoothly and steeply with body count:
~36% → ~65-70% → ~95-100%, and debuff stacks per enemy body **fall** roughly as 1/N. This is the
outcome in which `riptide_daemon` is the right *class* of answer — though its 3-cards-a-turn trigger
would still need re-deriving at width, since three cards a turn is close to universal at 3v3.

**H-THREE (something specific to three bodies — ~10%).** Width 1 and width 2 both sit near the neutral
number and width 3 jumps to ~100%. Then it is not smooth entity scaling but a threshold — the 27-card
shared pile, a specific card, or an interaction that needs a third body — and riptide is aimed wrong.

**Falsifier for all three:** if width 3 reproduces ~100% while debuff stacks per body stay flat AND
width 2 shows no climb, none of these three explain it and the probe has found a fourth thing.

## 5. What each outcome buys

- **H-TYPE** → the roster is not broken and the *document* is. `research/archetype-web.md`'s role wheel
  gets retired or rewritten as a type-gated ladder; the design question becomes whether 3v3 wants a
  role wheel at all, given that at width the type chart — worth 67 points at 1v1 — stops deciding
  matchups. `riptide_daemon` stays parked. This is the cheapest outcome and the most likely.
- **H-ENTITY** → structural. Entity-count auditing becomes a real gate (ticket 98 deliverable 4), and
  the missing predator has to be designed against *bodies*, not against *cards per turn*.
- **H-THREE** → find the threshold before designing anything.

## 6. Open questions this probe does NOT answer, recorded so they are not lost

1. **Duplicate species.** Every 109 comp is three distinct species, so a mono-element comp is
   unreachable — there are two species per element and duplicates are illegal by that construction
   rule. **That makes duplicates the direct test of H-TYPE:** a triple-huldra comp is the only way to
   keep a type advantage against all three zoo decks at width. If it beats `panel-zoo` at 3v3, the
   inversion is type dilution and the web is intact-but-type-gated; if it still loses, there is a
   genuine entity effect. Henry has said he does not mind duplicates being legal — recorded here as the
   working assumption, with the copy-cap consequence in item 2.
2. **The shared-deck copy cap.** The rulebook allows ≤2 copies of a card. Two members of the same
   species contribute the same deck twice, so a duplicate comp can put 4 — a triple, 6 — copies of a
   card into the shared pile. Legal duplicates therefore force a ruling: dedupe on assembly, cap at 2
   in the shared pile, or accept the multiplication. **This is a design question, not a balance one,
   and it is upstream of any duplicate-comp measurement.**
3. Whether `panel-zoo` is even the worst case. If duplicates are legal, a mono-element triple probably
   is, and the stress set needs rebuilding before anyone calls the roster safe at width.


---

## 7. FOLLOW-UP A — with duplicates legal, `panel-zoo` is NOT the worst case (2026-08-22)

Henry removed the copy cap and legalised duplicate species on 2026-08-21, which voids
`teamComps.ts` construction rule 1 and every claim resting on it. Measured, 30 games a pairing,
screening tier (`scratch/dupcomps.ts`):

| stacked comp | vs `panel-zoo` | vs `panel-control` |
|---|---|---|
| **`triple-jormungandr`** | **86.7%** | 93.3% |
| **`triple-sleipnir`** | **80.0%** | **100%** |
| **`triple-hel`** | **70.0%** | 83.3% |
| `triple-ymir` | 50.0% | **100%** |
| `triple-huldra` | 26.7% | 83.3% |

**Ticket 109's headline is superseded.** It reported twenty-five purpose-built stress comps against
`panel-zoo` with a best result of 50% and a mean of 14.1% — but none of them could stack a species.
**Three of the five tried here beat it, the top at 86.7%**, and two of them beat `panel-control`
outright at 100%. The roster's worst case at width is materially worse than the canary ever measured,
and it is worse because of a rules change rather than anything in the card pool.

**The likely mechanism, and the design consequence: the copy cap was what bounded scaler density in
the shared pile.** `jormungandr_v1` carries `ink_stream`, the uncapped per-card-played scaler that
`0-SCALER-IS-SHARED` and `0-RATATOSKR-V1-UNCAPPED` both flag; stacking the deck three times puts three
copies of it into one 27-card pile. `0-NO-CAPS` rules out capping the scaler — so if this shape is not
wanted, the lever is a CONDITION on the scaler, or a rule about pile composition, not a ceiling.

Hard gates still clean across all ten pairings: **FTK 0, truncated 0.**

**Caveats:** 30 games a pairing at the screening tier, one seed base; 86.7% and 80.0% are far outside
noise, 50.0% and 70.0% are less certain. These runs are post-ticket-111, so they are not directly
comparable to 109's numbers. `huldra-wall-mixed` was not run.

## 8. FOLLOW-UP B — CONTROL is the weak role at 1v1 too, and its hole is RAMP not ZOO

The width probe's by-product needed checking, because the CONTROL-vs-ZOO leg rested on **three**
neutral cells. Every neutral CONTROL cell re-measured at a fresh seed base — 98 cells, 60 games each
(`scratch/neutralcontrol.ts`):

| CONTROL vs | cells | committed grid | fresh sample | mean abs delta |
|---|---|---|---|---|
| BURST | 30 | 47.6% | 49.8% | 6.1 |
| CONTROL | 24 | 51.2% | 49.0% | 6.6 |
| **RAMP** | **41** | 41.4% | **37.6%** | 11.1 |
| ZOO | 3 | 43.9% | 41.7% | 2.2 |
| **overall** | **98** | — | **44.2%** | — |

The two independent samples agree inside the MAD 6-13 the three-tier doc quotes, so **the reading is
real: control is the weakest role at 1v1 once elemental advantage is removed.**

**And it reframes the target.** I have been treating control-vs-zoo as the problem; on the largest
sample here control's actual 1v1 hole is **against RAMP at 37.6%, on 41 cells**, while the zoo leg
rests on three. So the coverage question from §6 is **half the job at most** — a fix that made
control's answers reach three attackers at 3v3 would still leave a role sitting six points under even
on neutral ground at 1v1, and losing hardest to a role that is not zoo.
