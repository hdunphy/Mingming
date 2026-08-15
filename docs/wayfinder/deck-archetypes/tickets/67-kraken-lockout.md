# Kraken lockout check (ticket 67): are the eight zeros unwinnable, or just unfavourable?

- Type: wayfinder:research - REPORT-ONLY. No card, deck, OS, or engine changes; probe arms
  mutate in memory only (ticket-60 style).
- Status: **open** - authorized by Henry 2026-08-16. Runs BEFORE the kraken design session;
  its verdict table is that session's opening exhibit.
- Assignee: -
- Blocked by: none (tree-free etiquette applies).
- Input: research/kraken-diagnostic.md (ticket 65). Template: fire-investigation.md.

## Why

Ticket 65 found kraken_v1 at 0% in 60 decided games against EIGHT species (jormungandr,
huldra, ymir, draugr, valkyrie, audhumbla, nidhoggr, ratatoskr) while matching a 45%-deck's
damage rate. Before designing her answer cards we need to know, per matchup, whether she
loses because the game is UNWINNABLE BY CONSTRUCTION (their sustain exceeds her ceiling -
a defect to fix) or merely unfavourable (a power/tool gap - a design space). The fix for
each is different; do not design blind.

## Questions, each with measurements

1. **Throughput ceiling vs sustain floor, per zero-matchup.** Kraken's THEORETICAL max
   sustainable damage/turn (best-case energy line + OS, computed not simmed) vs each zero
   opponent's measured steady-state sustain per turn (heal + shields + conversion, from
   battle logs). Verdict column: ceiling > sustain (winnable in principle) or ceiling <=
   sustain (STRUCTURAL LOCKOUT).
2. **Loss autopsy, per zero-matchup** (60 games each exist; re-run with logging): how does
   she actually die - out-raced on her 58 HP, or out-scaled in long games? Report
   turns-to-loss, damage absorbed/turn vs dealt/turn, and energy spent on non-damage
   (capacitor/whirlpool share) in losses.
3. **Near-win margins**: minimum opponent HP reached, per zero-matchup, across the sample.
   Opponents regularly dragged under ~40% = power gap; never under ~80% = structural.
4. **Existing-pool probes** (in-memory, diagnostic ONLY - not deck proposals): three arms
   per deck against the zero-set: (a) +2 Water Poison cards (venom_fang/corrosive_bolt -
   quadratic, defense-ignoring - the classic anti-sustain), (b) capacitor x2 ->
   2 one-cost attacks (energy actually spent attacking), (c) both together. Which zeros
   move off 0, and to what? This tells the design session whether pool tools suffice or
   new cards are needed.
5. **surge_protection condition grep** (verification, 5 minutes): does "if you drew a card
   this turn" count the DRAW-PHASE draw? If yes it is conditionless for every species (the
   dropped-condition family) and the card is a net-1e 40-power attack everywhere. Read the
   implementation, cite the line, test one non-draw deck's uptake if ambiguous.

## Deliverable

research/kraken-lockout.md (CRLF): the per-matchup verdict table (STRUCTURAL / POWER-GAP /
WINNABLE-MISPLAYED) with the margin numbers, probe results, the surge_protection answer,
questions for Henry, card appendix. ONE commit (research file + ticket closed). No
recommendations executed - the design session follows this report.
