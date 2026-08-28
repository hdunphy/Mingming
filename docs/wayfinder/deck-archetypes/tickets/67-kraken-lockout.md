# Kraken lockout check (ticket 67): are the eight zeros unwinnable, or just unfavourable?

- Type: wayfinder:research - REPORT-ONLY. No card, deck, OS, or engine changes; probe arms
  mutate in memory only (ticket-60 style).
- Status: **closed** (2026-08-16) - report delivered, nothing changed. Ran BEFORE the kraken design session;
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


---

## Resolution (2026-08-16) — delivered, report-only, Amendment 1 answered first

[research/kraken-lockout.md](../research/kraken-lockout.md). **~3,700 real battles**: 960
autopsy, 1,280 pool probes, 1,440 type decomposition across five decks. **No changes of any
kind.**

**Q0 (Amendment 1) — Henry's confound is CONFIRMED and larger than suspected.** Kraken is Water;
`ElementalMatrix` is asymmetric (x1.5 advantage, no resistance). **Her four wins are exactly her
four type-advantaged matchups** (fenrir/skoll Fire, fafnir/gullinbursti Earth) and **every
disadvantaged matchup is a zero** (ratatoskr/huldra Nature, ymir/draugr Ice). Damage/turn splits
**16.32 advantaged / 12.70 neutral / 9.88 disadvantaged** against ticket 65's confounded 13.0
aggregate, with a ~48% type lift in the advantaged cell. **Her win rate was confounded far more
than her damage: the neutral-bucket rate is 7.1% (v1) / 12.5% (v2) against the reported 26.6%.**

**THE VERDICT, written explicitly per the decision rule: both stories are partially true, and
neither named the actual deficit.**

| NEUTRAL bucket | frame HP | dmg/turn | taken/turn | **net/turn** | win% |
|---|---|---|---|---|---|
| kraken_v1 | 72 | 12.72 | 14.21 | **-1.49** | 10.7% |
| valkyrie_v2 | 82 | 12.51 | 12.53 | **-0.01** | 64.4% |
| skoll_v1 | 76 | 16.84 | 16.39 | +0.45 | 46.4% |
| hel_v2 | 80 | 21.99 | 26.41 | -4.43 | 75.5% |

**Kraken deals the SAME damage per turn as valkyrie_v2 in neutral matchups and wins 10.7% where
valkyrie wins 64.4%.** Her offense is not bottom-tier - it is level with a 64%-winning deck. She
takes 14.21 where valkyrie takes 12.53, on a frame 12% smaller. **The deficit is NET, -1.49 a
turn, of which offense contributes ~0.2 and defence ~1.3.** hel_v2 is the control that proves
the game pays for rate: worst damage taken in the roster, three turns of life, 75.5% win.

- Henry's confound: **CONFIRMED**, and bigger than suspected.
- Henry's "underpowered": **directionally right, wrongly located** - not output, net.
- Ticket 65's "missing tools": **survives only for the sustain subset**, and the pool cannot reach it.

**Actionable number for the session: closing -1.49/turn, roughly +12% damage rate or the
equivalent in damage taken.**

**Q1-3 - NO STRUCTURAL LOCKOUT EXISTS.** Seven of eight zeros have been dragged below 26% of max
HP and **five of eight have been taken to 0.0%** - kraken has killed them; v2 won at least one
game against five of the eight in-sample. **ymir is the closest and still is not one** (mean
minimum 72.8%, best case 30.4%): 5.80 damage/turn into 7.75 sustain is the only cell where the
arithmetic genuinely does not close. **Sustain is NOT the common cause** - jormungandr and
nidhoggr sustain **0.00**, huldra 1.93, draugr 3.39. She is **out-damaged in every zero
matchup** and **out-raced rather than out-scaled**: the two longest matchups are where she comes
closest. Energy on non-damage cards: v1 **0.0%**, v2 **36.8%**.

**Q4 - THE POOL DOES NOT CONTAIN HER ANSWER.** Three arms per deck: **not one moves a single
zero off zero for v1**; for v2 poison nudges 2.5% -> 3.1% and **both energy arms make it WORSE,
to 0.0%**. Removing `capacitor` pushes her mean-minimum-opponent-HP UP (53.4 -> 64.5 vs
audhumbla) because the ramp was buying her 3-energy payoff turns. The cheap fix is measurably
unavailable.

**Q5 - `surge_protection` is NEARLY conditionless, and the "nearly" is real.** Chain cited:
`card_drawn_check` -> `constraints.json:42` `{CARDS_DRAWN, value 1}` -> `ConditionValidator.ts:199`
-> `resolutionEngine.ts:531` (`executeDraw` increments the counter; **`isNatural` is passed but
never consulted for it**) -> `battleReducer.ts:943` (the draw phase calls the same function). So
the draw-phase draw satisfies it for every species. **BUT** `cardsToDraw` is clamped by
`HAND_SIZE_LIMIT - hand.length`, so a full hand draws nothing: measured, **8.8% / 9.6% of plays
happen on a zero-draw turn**. It is a net-1e 40-power attack on ~91% of turns for anyone, and a
true 2e one on the rest - dropped-condition family in effect, not by construction.

Five questions returned; the load-bearing one is **offensive or defensive fix for the -1.49**.
