# Fire investigation (ticket 58): measure before anyone designs

- Type: wayfinder:research — REPORT-ONLY. No card, deck, OS, or price changes of any kind.
  Findings feed a design session with Henry (the jormungandr-v1 attribution study,
  research/jormungandr-v1-attribution.md, is the quality bar and the template).
- Status: **closed** — investigation run 2026-08-14, `research/fire-investigation.md`.
  Nothing was changed. Six questions returned for Henry's design session.
- Assignee: —
- Blocked by: none (runs read-only against HEAD; note the registryHash you read).

## Why

The Fire pair is deep-queue item #4 and every prior fix here was blind: skoll_v2 sits at
~26% field / 0.580 control-wins with a Burn plan that delivers ~5 HP/game since the
overflow fix; fenrir_v2 at ~27% field / 0.340 with `ash_communion` at **10.6 vs a 6.5
band** (the loudest card redline in the registry since ticket 51's removal premium
repriced its self-Burn consume) and ~71% dead; fenrir_v1 just came OFF the floor list
without anyone touching it. Henry wants a full investigation before a single number moves.

## Questions to answer, each with measurements

1. **Where does each Fire deck's damage actually come from?** Per-card attribution
   (damage/play, share, dead rate) for fenrir_v1, fenrir_v2, skoll_v2 — and the DoT
   residual (per-card attribution misses Burn ticks; compare card-attributed damage vs
   HP/game taken, per HANDOFF "Measurement facts").
2. **`scorch` (2e, 4 Burn):** how many of its stacks land vs overflow-for-nothing under
   the 3-stack cap? What is its real delivered damage per cast?
3. **`ash_communion`:** WHY is it 71% dead — unaffordable when drawn, outbid by the eval,
   or conditions unmet? (The lifesteal-targeting and cost-hook traps are fixed; verify
   neither regressed for it.) What would it deliver when actually cast?
4. **TREACHERY_KERNEL feed rate (skoll_v1, HANDOFF item 7):** re-measure peak Strength vs
   the 12.5-stack damage cap and CORE_OVERCLOCK's 8-stack scaler cap at current pace.
   How many granted stacks are wasted above the caps, per game?
5. **fenrir_v1's silent recovery:** what moved it off the floor list? Diff its matchup
   profile against the ticket-49-era reading (the 8-DIFF rule — per matchup, not sets).
6. **Burn's systemic ceiling:** across ALL decks that apply Burn, what fraction of applied
   stacks exceed the 3-cap and deliver nothing? (This bounds any "more Burn" design.)
7. **First-mover and game-length context** for the three decks (the roster census, if
   already run, supplies it — else measure locally).

## Deliverable

`research/fire-investigation.md` (CRLF), findings ranked by decision-relevance, each with
the measurement that supports it, plus a "questions for Henry" list — NO recommendations
disguised as facts. One commit (the research file + ticket status flip to closed).

---

## Result — [research/fire-investigation.md](../research/fire-investigation.md)

Read at registry `1:3466b533`. **No card, deck, OS or price changed; no engine or data file was
written.** All seven questions answered. The three findings that should shape the session:

**1. Burn's cap eats a third of all Burn in the game, and the overflow pays zero.** Roster-wide:
**32.1% of applied stacks wasted, and 0 overflow damage across 54,767 requested stacks** —
`BURN_OVERFLOW_PERCENT = 0.01` floors to zero on every frame under 100 max HP. **fenrir_v2 wastes
53.8%**; `molten_core` alone throws away **64%** of what it applies. This bounds any "more Burn"
design: fenrir_v2 already applies 26,667 stacks to land 12,313.

**2. `ash_communion` is OUTBID, not unaffordable — and it is priced for a deck fenrir_v2 does not
run.** In hand on 281 turns: **outbid 144 (51%), unaffordable 107 (38%), constraint-blocked ZERO.**
Neither known trap regressed. When cast it heals **7.3 HP — about 1.5 stacks consumed against the 3
that `ASSUMED_STATUS_COUNT` prices it at**, which is the whole of its 10.6-vs-6.5 redline. It
consumes Fenrir's OWN Burn, and two of his three Burn cards apply to the target.

**3. `fenrir_v1` never recovered — the floor list's 0.25 line runs through its sampling
distribution.** Nothing touched fenrir or the control between the two readings. Measured on the
identical matchup: **150 iterations gives 0.205; five seed bases at 50 iterations give
0.255 / 0.235 / 0.182 / 0.232 / 0.283, a spread of 0.101.** The entire 0.29 → 0.194 "recovery" fits
inside one seed-base spread. `fenrir_v2` at 0.387 over 150 iterations is genuinely on the list.

Also measured: **the DoT plans deliver more than the brief assumed** — fenrir_v2's Burn is **39% of
its damage (~25 HP/game)** and skoll_v2's is **18% (~11.6 HP/game**, not the ~5 on record).
**TREACHERY over-feeds the 8-stack CORE_OVERCLOCK scaler in 57.5% of games** (mean game peak 9.78,
peak-ever 25) rather than primarily the 12.5-stack damage cap at 21.3%. `scorch` is the *least*
wasteful Burn card at 14.1%, and the ticket's "2e, 4 Burn" is a **data discrepancy** — the registry
card is 2e, 25 power, **3** Burn. And `fire_punch_v2`, a plain 30-power card with no text, is the
top damage source in **both** skoll decks.
