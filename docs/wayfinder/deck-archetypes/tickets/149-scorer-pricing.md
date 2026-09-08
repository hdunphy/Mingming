# Ticket 149 — The scorer prices what it can measure

> **149b DELIVERED 2026-09-08** — all five measurements ran (3a/3b/3c/3e complete; 3d complete for 8 of ~14 lanes, the rest listed in the report). Read `../research/scorer-pricing.md` (short form, §6 = the §4 rulings with numbers) and `../research/firmware-power-census.md`; per-measurement findings in `results/t149_*/FINDINGS.md`; scripts `scratch/t149_*.ts`. Two findings not on the ticket: `hel_v2 lifeblood` ships at ×1.0 (inert) and `carrion_swoop` has no scorer branch (scores 1.1, delivers 2.2 fire-punches a cast). Next: Henry's §4 rulings, then 149c.

**Type:** instrument work (`powerscale.ts` and the budget report). **Report-first: no card, deck,
OS or engine number changes in this ticket.** A card that moves out of band because its price
became honest goes to Henry with the measurement; it is not "corrected".
**Status:** written 2026-09-08 off the ticket audit; Henry and the design session take the rulings
in §4 together, then Legion runs the rows in §5. **Absorbs and closes** 63, 119, 120 (the scorer
half), 121 and 130.
**Branch:** current working branch, one commit per lettered row, authored as Henry.
**Method precedent:** ticket 61 (measured 0.19 HP per printed power on valkyrie's frame against the
0.30 folklore), ticket 66 (the census constants — every number cites `research/status-pile-census.md`).

---

## 1. Why one ticket

Five open tickets are the same complaint: `powerscale.ts` prices something with a constant that was
guessed, the constant became load-bearing in the card-budget gate, and now the gate flags cards that
are fine and waves through cards that are not. Ticket 66 already fixed the status-pile family this
way — measure the pile, cite the census, replace the constant — and the roster did not move. This
ticket does the same for the five that are left, in one pass, so the budget report can be trusted
again before ticket 148's progression arms and ticket 59's registry triage start reading it.

| folded ticket | the guessed constant | what it costs us today |
|---|---|---|
| 119 | `scope === 'SIDE'` → `×2.2` (`powerscale.ts:872`) | five ticket-115 Ice cards sit permanently 87–143% "over band" while being bit-identical at 1v1; the ledger is set up to undo a change that works |
| 130 | `EXPECTED_DAEMON_PROCS = 4` (L470); `DRAW: 15` (L102); the `Daemon && score === 0` guard (L959) | every daemon is a turn-1 best case at a guessed rate (`feedback_loop_daemon` says 2.7, measured turn-3 value 1.7); a 1e "draw 2" cantrip moved kraken_v1 33 field points while scoring 2.8 |
| 120 | `ASSUMED_CONSUMED_STACKS` vs the non-consuming scaling path (L565) | the four most over-band cards in the pool (`umbral_feast` +397%, `contagion` +214%, `hexbloom` +154%, `corrosive_leak` +130%) are all one family — the tell that it is the scorer |
| 63 | the 0.30 HP-per-power folklore under every OS payoff | ticket 61 measured 0.19 on valkyrie's frame; no other frame has been measured, so every power-denominated firmware payoff is priced on an unverified rate |
| 121 | `IN BAND` / `OVER` with no distance | `frost_bite` at +10% prints the same word as `umbral_feast` at +397%; Henry already ruled the shape (*"3 is not a hard cut off … +/- 15%"*) |

Not in this ticket: the drawback tail (`desperate_strike` −410%, `dark_pact` −410%, `wither_feast`
−266%). It is real, it is the same *kind* of problem, but ticket 138's `damageOverride` finding means
the recoil numbers themselves are still moving; price them after that settles. Recorded in §6.

## 2. What "measured" means here

Each constant gets replaced by a number with a citation, produced by a scratch census that is
committed with the ticket (the way `scratch/stackcensus.ts` backs ticket 66). The instrument for
all of them exists: `scratch/bandspread.ts` (the pool as % of band ceiling), `scratch/handeconomy.ts`
(draws per unit-turn at 3v3), `scratch/oscensus.ts`, and `teamScenario()` for anything that needs
width. **Beamless** (144 §2: the harness default is gym-grade; beam is a rung of the enemy ladder,
not an instrument setting). 1v1 at 60 iterations on the deck's own frame; 3v3 on the ticket-140 §8
panel (`ink_loop`, `fire_pair`, `control`, `zoo`, `ref_solo_a`) at 40 battles a cell.

A constant is replaced only when the measurement and the constant disagree by more than the pool's
own noise (median absolute deviation 10% of ceiling, ticket 121). A constant that measures within
that keeps its value and gains its citation.

## 3. The five measurements

### 3a. Side scope — what ×2.2 should be, and at which width (119)

Measure the same five cards (`frost_bite`, `numbing_gale`, `killing_frost`, `rimefrost`,
`ice_spear`) plus the kraken side-scope package from 116 under `Single` and `Side`, at 1v1 and
3v3, in real field points. Report the ratio Side/Single at each width. The known answer is
"1.0 at width 1, ~3.0 at width 3"; what the measurement adds is the *field* value of that, which is
what the scorer is supposed to predict.

The scorer has no width today. Three shapes, Henry picks one in §4:
(i) **two scores per card** — `score1v1` and `score3v3`, bands checked at both, the report
prints both; (ii) **one blended score** at the run's true width mix (the run is 1v1 on the road and
3v3 at gyms and elites; the mix is measurable from `pathAndScout` — count encounters by width over a
sampled run); (iii) **keep ×2.2 and exempt by measurement** (ticket 119's option c; cheapest, least
honest).

### 3b. Daemons and `DRAW` (130)

Per-trigger proc rates, measured, in one table keyed by hook trigger: `onCardDraw`,
`onProgramPlayed`, `onTurnStart`, `onTurnEnd`, `onStatusApplied`, `onDamageDealt`, `onDeckShuffled`
(any others the daemons in the pool actually use — grep `hooks.json` and `programs.json` for
`category: 'Daemon'`). Procs per unit-turn at 1v1 and 3v3 (the `source: SELF` gate halves the 3v3
rate — ticket 128 — so the 3v3 number is the *seen* rate, not the side-wide one). `handeconomy.ts`
already gives the draw trigger (0.75 per unit-turn at 3v3); the others want the same instrument.

Then the play-turn axis: price a daemon at the turn it is realistically cast. Measure when the AI
actually plays each daemon (turn of first cast, mean, over the panel); the price is
`proc.score × rate × (gameLength − castTurn)`. Report every daemon at cast turns 1, 2 and 3 so
Henry's bar — *"positive even when played on turn 3"* — is a column, not a hope.

`DRAW: 15` becomes a deck-independent floor plus a per-deck term the report prints separately: a
draw is worth roughly the deck's mean card value, which `bandspread` already computes per deck.
Until that lands the ticket-130 rule stands: **any card that draws more than one is unpriced and is
gated on a field arm, not a score.**

And the plain bug: the `card.category === 'Daemon' && score === 0` guard means a daemon with its own
on-cast action loses its hook's value. Price actions and hooks additively. This is the one change in
the ticket that is unambiguously a fix, and it is a no-op on today's pool (every daemon has empty
`actions`), so it can ship in the first commit.

### 3c. The consume family (120)

Score `WEAKENED_STACKS`, `STATUS_CONSUMED` and `DAZED_STACKS` scaling cards against what they
convert in real games — the ticket-64 method for Strengthened, applied to the rest. Specifically:
for each of `hexbloom`, `umbral_feast`, `contagion`, `corrosive_leak`, `ash_communion`, log at cast
time the stacks read and the stacks consumed, mean over the panel. Two questions the log answers:
is the pile at cast time the census mean (5.04 Weakened) or the board the card is *held for* (it is
cast when the pile is big, so the truth is probably higher, not lower); and is the non-consuming
path ("the Weakened remains") priced as though it also cashed the stacks. If the second is true it
is a bug and ships with 3b's; if only the first is true the constant moves and the four cards
re-score, and Henry rules on whatever is still over.

### 3d. The firmware power-rate census (63, unchanged in scope)

For every OS payoff denominated in power or %-maxHp — REBIRTH 15/15, NOURISH 50%, the hel Gateway
costs, hel_v2 lifeblood +50% healing, GALE_FORCE 10, UPDRAFT, GENESIS maxEnergy, TOXIN_FANG +10 (the
131c flat bonus), KINETIC_RAM 2.5, TIDAL_CRUSH 1.2×, OUROBOROS, TREACHERY grants, and anything a
grep of `hooks.json` + `CustomFirmware.ts` adds — delivered HP (or HP-equivalent) per proc and per
game on its own frame. One table: OS · payoff text · printed value · delivered/proc · procs/game ·
delivered/game · implied HP-per-power · flag when it diverges >2× from the 0.19–0.30 range. The
companion table from 63 (the scaling cards `starfall`, `stampede`, `serpents_coil`,
`carrion_swoop`, `momentum_crash` against the `fire_punch_v2` benchmark) comes with it. The output
is `research/firmware-power-census.md`; the scorer does not read it in this ticket — it is the
input to any later OS ticket and to 148's frame arms.

### 3e. Band tolerance (121 — proposal ready, needs only the ruling)

Adopt **±15% of the band ceiling** (1.5× the pool's median absolute deviation) and report three
states, always with the percentage printed: `IN BAND`, `WITHIN TOLERANCE (+n%)`, `OUT OF BAND
(+n%)`. Not standard deviation — the pool's sd is 67.5% because drawback cards score negative; MAD
ignores the outliers instead of being defined by them. `weak.ts`, `bandspread.ts` and §1.3 of the
balance report all move to the same three words.

## 4. Rulings for Henry (the design session)

1. **Width (3a):** two scores per card, one blended score, or exempt-by-measurement?
   Recommendation: **two scores**. The run is two games; pretending it is one is how 119 happened,
   and the report already has room for a second column. Blending needs the encounter mix and goes
   stale every time 142/148 change the route.
2. **Daemon play-turn (3b):** which turn is a daemon priced at? Recommendation: **turn 2**, and the
   report prints turns 1–3. Turn 1 is the best case the current constant silently assumes; turn 3
   is Henry's floor; turn 2 is the median first-cast if the measurement lands where 129 suggests.
3. **Tolerance (3e):** confirm ±15%. (Henry's number; the data says 10–15.)
4. **What happens to a card that moves out of band under an honest price.** Recommendation: it is
   *reported*, never auto-tuned; each one is a one-line entry for Henry with the old score, the new
   score, and the field measurement. Henry's law (*cards stay on-curve; fix enablers, never bend
   card economics*) still governs what the fix is once he rules.
5. **The drawback tail** (§6): take it here after 138 settles, or leave it for its own ticket?

## 5. Order of work (Legion, after §4)

- **149a — the guard.** Daemon actions + hooks price additively. Tests: a daemon with an on-cast
  draw and a hook scores both. No score in the pool changes (assert it: byte-identical §1.3).
- **149b — the censuses.** `scratch/proccensus.ts` (per-trigger rates, 1v1 and 3v3, cast turns),
  `scratch/consumecensus.ts` (3c), the width arm (3a) as a `compgrid --panel` run with the scope
  flipped, and `scratch/oscensus.ts` extended for 3d. Outputs under `results/t149_*`; the tables in
  `research/scorer-pricing.md` and `research/firmware-power-census.md`. **Report to Henry here.**
- **149c — the constants.** Replace each constant that failed the §2 test with its measured value
  and citation; add the width axis in the ruled shape; `DRAW` floor + per-deck term. §1.3 ledger of
  every card that moved, with old/new/field. **Nothing else changes.** Henry rules the ledger.
- **149d — tolerance.** ±15%, three states, percentage printed everywhere; `weak.ts` and the audit
  scripts updated; `TICKET-AUDIT` style lists stop mixing +10% with +397%.
- **149e — close-out.** Tickets 63/119/120/121/130 get their close lines pointing here; HANDOFF's
  0-ASSUMED-STACKS and 8-DIFF notes updated; the "treat any draw-2 as unpriced" rule stays until
  149c ships and is deleted then.

Tests: `powerscale.test.ts` gains one case per replaced constant (the measured value, cited), the
guard case, and a width case (a `Side` card scores 1.0× at width 1). `npm run balance` §2–3
byte-identical through 149a–b (instrument-only); §1.3 churn expected at 149c with the ledger.

## 6. Parked, with the reason

- Drawback cards priced at full self-harm (`desperate_strike`, `dark_pact` −410%; `wither_feast`
  −266%): wait for 138's `damageOverride` → power conversion to settle, then measure recoil the way
  3d measures payoffs.
- `hexbloom`'s *design* (side-scope it for control, worth ~15 panel points per ticket 115): a
  balance lever, not a scorer question; it needs 3c's answer first and then its own ruling.
