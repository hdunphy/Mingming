# Fire investigation (ticket 58): measure before anyone designs

- Type: wayfinder:research — REPORT-ONLY. No card, deck, OS, or price changes of any kind.
  Findings feed a design session with Henry (the jormungandr-v1 attribution study,
  research/jormungandr-v1-attribution.md, is the quality bar and the template).
- Status: **open**
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
