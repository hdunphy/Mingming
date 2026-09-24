# Ticket 151 — EA deck rework: two independent damage paths per deck (frame RULED 2026-09-09)

> **Status: CLOSED 2026-09-24 — SUPERSEDED by 160 → 162; the two-paths frame lives on as 158 §2.6's counter rule.**
> **Per-deck sessions superseded by [160](160-ea-deck-recut.md) (2026-09-21).** The two-paths frame survives as 158 §2.6's counter rule.

**Type:** wayfinder:grilling (frame ruled) → one `task` session per deck, Henry designing, assistant costing.
**Asked by Henry, 2026-09-02:** *"I think we need to fix the decks. It's clear the card size was getting
too large and impacting it. We also need to create synergies. The later decks I had a rule you need two
paths to win so another deck can't just hard counter your damage source."*
**Depends on:** nothing to start. **Relates to:** steam-release 77 (Track A — the deck-size tax),
78 (party synergy tags + bridges — HELD until this pass lands), 73 (the launch triangle — DEFERRED;
its Nature corner is this ticket's first five decks). **Branch:** Henry's call at the first session.

---

## 1. Why — the two numbers that make this a rework and not a tuning pass

1. **steam-release 77 Track A (2026-09-02):** at the 18-card run-start deck, **every card added lowers
   the win rate** — full tuned decks −8.7 / −22.1, engine+3 −14.7 / −28.5, three blank generics −9.2 /
   −31.3 (Rootfall / Emberfall), all significant at Emberfall. The 5-card `startKit` IS the engine; the
   tuned list's 6th–12th cards were 1v1 pacing filler, and in a merged party deck filler is a tax.
2. **The EA grid (73's numbers, 2026-09-02):** advantaged-side mean 74.9% (on Henry's 75/25 target) but
   median 85.8%, **26 of 48 advantaged cells ≥90%**, 19 exact 0/100. Nature is the weak corner both
   ways: huldra_v2 / rat_v1 / rat_v2 win **3–5%** disadvantaged, and huldra_v1 ↔ rat_v1 is 0/100
   same-element. Every one of those is a **one-path deck meeting its counter**.

So a reworked deck must (a) carry no filler beyond its engine and (b) not die to one status being
answered. Both are the same design constraint, which is why this is one pass.

## 2. Rulings (Henry, 2026-09-09 session)

**R1 — THE LAW: two independent damage paths.** A deck has two damage sources scaling on DIFFERENT
things (two statuses, or one status + flat/energy/draw). Test: *remove any one status from the game and
the deck still has a damage plan.* Sustain and stall do **not** count as a path. (Henry's original
example: a Sharp-stack deck shut off entirely by a Dazed applier.)

**R2 — WHERE PATH 2 LIVES: "it depends", per deck, and the kit must play fine on its own.** Henry:
> *"Some decks we want to have two paths to damage and a kit can have both engines but with one payoff
> — or two payoffs with small ways to get to both. Kraken: you start with a bunch of draw cards and pay
> off with draw-scaling; a card that scales on cards played per turn is another way to get damage
> since you play a lot of 0-cost cards. The cards-played card can be FOUND and the kit plays fine.
> Other decks that use statuses probably want two ways to damage IN THE KIT — a Burn and a Str for
> Fire who pays off with both, or maybe either. Then you look for more engine cards to feed both."*

Operationally, each deck is classified at its session as one of:
- **Shared-enabler / found payoff** (kraken shape): the kit's enablers already feed path 2; path 2's
  payoff is a **pick** (cards 6–9 of the tuned list). The kit is unchanged or nearly so.
- **Two-status kit** (Fire shape): the kit itself carries both engines (3 + 2, or a dual payoff that
  reads either status); cards 6–9 deepen whichever path the run finds.
The classification is written into the ticket row so the reviewer knows what "found" vs "in kit"
means for that deck.

**R3 — ORDER: the Rootfall trio first, then the rest of Nature, then Fire, then Water.**
`huldra_v2 → ratatoskr_v1 → jormungandr_v2 → huldra_v1 → ratatoskr_v2 → fenrir_v1 → fenrir_v2 →
skoll_v1 → skoll_v2 → kraken_v1 → kraken_v2 → jormungandr_v1`. Fixes the worst gym (27.7%) and the
weak corner in the first five; kraken (Henry's "plays fine" example) is last.

**R4 — GATE B: each deck ships on the 1v1 grid alone; the gyms are re-taken once all 12 are done.**
Per deck: field WR 0.35–0.80, dead ≤0.35/side, FTK 0, and **no EA cell ≤3% or ≥97%** (the corner
number). Gauntlet compound (77) and engine+3 ≥ bare are re-measured **after the pass**, not per deck.
Named risk, accepted: a bad path-2 shape could be copied before the gym numbers see it — mitigated
by re-reading the grid after the Rootfall trio (deck 3) before continuing.

**Standing laws that apply, restated so the sessions don't re-argue them:** cards stay on curve
(fix at the enabler); **NO CAPS — nerf by changing shape** (77); per-stack scalers underperform early
and overperform late, priced against the real trigger count; numbers move in 5s, one change per sim;
huldra_v1 may stay deliberately weak — but "weak" is not "one-path", it still needs R1.

## 3. What each deck session produces (the `mingming-deck-pass` shape)

Henry sketches, the assistant costs against `powerscale.ts` (re-read every session; port re-validated
≥10 cards), and the row records:

| deck | class (R2) | path 1 (status/scaler → payoff) | path 2 (→ payoff) | kit (5) | picks (6–9) | grid after | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| huldra_v2 | two-status kit? → **fast flat path added** | Poison (nettle/thornguard/blightbloom) → ticks | BarkShield → `bark_lash` (**0e**, 1/stack) | unchanged | tuned +2 `bark_lash` | 1e: field 52.5→37.1 (AI played it 18%); **0e: 52.6, EA mean 30.7→37.9**, rat_v2 cell 10→35; Fire still 0–19 | candidate (0e) — Henry to rule |
| ratatoskr_v1 | shared-enabler (0-cost chain) | cards played → `seed_bomb_v2` | Poison → `seed_spit` (0e) + nettle | unchanged | `seed_spit` ×2 **replaces** `water_slap` ×2 | field 54.1→63.6; EA adv .70→.65, dis .05→.06 (Fire = pace) | candidate |
| jormungandr_v2 | shared-status, two readers → **flat multi-hit** | Poison → ticks / contagion | flat 3-hit → `serpent_flurry` (1e, 3×9; OS cashes per hit) | unchanged | tuned +2 | field 50.0→55.6; **adv .42→.58, same .42→.60**; anti-triangle cells gone (vs fenrir_v1 53→82) | candidate — watch knob hit power 9→8 |
| huldra_v1 | two-status kit | Weakened → `hexbloom` → Poison | Sharp → `thorn_whip` (1e, 15+5/stack) | unchanged | tuned +2 | EA flat (adv .33→.32); field +8.4 via **102 dmg/play runaway** vs slow decks | **needs shape change: consume Sharp** (no caps) |
| ratatoskr_v2 | | | | | | | |
| fenrir_v1 | | | | | | | |
| fenrir_v2 | | | | | | | |
| skoll_v1 | | | | | | | |
| skoll_v2 | | | | | | | |
| kraken_v1 | shared-enabler / found | draw → `ink_stream` | cards-played → (found) | unchanged? | | | |
| kraken_v2 | | | | | | | |
| jormungandr_v1 | | | | | | | |

Each row's printing goes to an implementation prompt with exact anchors, tolerances and STOP
conditions (10-80-10 rule); the implementer moves numeric knobs only.

## 3b. First measurement (2026-09-09)

See [research/151-path2-first-arms.md](../research/151-path2-first-arms.md): four cards added to the
tuned decks (not the kits), EA grid re-run on the committed seeds (bit-identical baseline reproduced),
one knob round (`bark_lash` 1e→0e). **19 exact 0/100 EA cells before, 19 after** — the cards moved the
decks, not the triangle. Three lessons carried to the remaining eight rows: path-2 cards on a 2-Energy
frame default to **0e or replace** (never "add a 1e"); the Nature-into-Fire corner is **pace, not
paths** (0–19% before and after) and no on-curve path-2 card fixes a 3-turn fight; a per-stack payoff
that does not consume is a runaway in long fights (thorn_whip 102 dmg/play). Edits are in the tree,
UNCOMMITTED, for Henry to rule.


**Full 32-deck grid re-run and PROMOTED (Henry, 2026-09-09):** `docs/balance/deck_grid.json` now
carries the four cards (bark_lash at 0e). Field band 35–80: **31/32 in band**; the one out is
nidhoggr_v2 at 34.2 (was 35.0, sat on the edge already; −0.8 from huldra_v1's new cell). Roster
mean 50.3 unchanged; highest field still jormungandr_v1 70.2. Changed decks: rat_v1 63.6 (+9.5),
huldra_v1 60.3 (+8.4 — the thorn_whip long-fight runaway: ymir_v1 3→60, fafnir_v2 23→78), jorm_v2
54.1 (+4.1), huldra_v2 52.6 (+0.1). 199 of 960 cells moved. Rows: `research/151-runs/full/`.
**Renumbered 148 → 151** on Henry's instruction (another branch already holds 149).
## 4. Held / not in this ticket

- **78's pair matrix is HELD** until all 12 rows land — measuring synergy on decks about to change is
  wasted battles. 78's `synergy {produces, reads}` tags ARE written per row here (the "path" columns
  are the tags), so 78 starts with them ratified.
- **73's constant (`TYPE_CHART` 1.5)** does not move; Henry is taking 73 on another branch. This pass
  is expected to fix the corner without it; if the median is still ≥85 after Nature, 73 re-opens with
  that number.
- **77 Track B** (macros, player Drivers) runs in parallel; it is slot-free and orthogonal.
- No OS changes unless a deck cannot reach R1 without one — then it is its own row.

## 5. Done when

All 12 rows filled and shipped under R4; the EA grid re-run (target: advantaged median ≤80, zero
≤3/≥97 cells); the three gyms re-taken bare (77's table) and 78 un-held.
