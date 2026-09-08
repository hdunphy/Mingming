#!/usr/bin/env python3
"""TICKET 149 (3b) — stitch score.md + rates.md + the whirlpool field run into results/t149_daemons/FINDINGS.md."""
import json, re, statistics, subprocess, sys
from pathlib import Path

R = Path('results/t149_daemons')
score = (R / 'score.md').read_text()
rates = (R / 'rates.md').read_text()

def section(md, start, end=None):
    i = md.index(start)
    j = md.index(end, i) if end else len(md)
    return md[i:j].rstrip() + '\n'

# whirlpool field table
rows = [json.loads(l) for l in (R / 'whirlpool.jsonl').read_text().splitlines() if l.strip()]
by = {}
for r in rows:
    a = by.setdefault(r['arm'], dict(w=0, d=0, g=0, casts=0, dmg=0, dazed=0, turns=0))
    a['w'] += r['win'] * r['decisive']; a['d'] += r['decisive']; a['g'] += r['games']
    a['casts'] += r['casts']; a['dmg'] += r['dmg']; a['dazed'] += r['dazed']; a['turns'] += r['turns'] * r['games']
wp = ['| arm | printing | score | field win (kraken_v1, 1v1, 30 opps) | n games | casts/game | direct dmg/cast (HP) | Dazed landed/cast | mean turns |', '|---|---|---|---|---|---|---|---|---|']
labels = {'SHIPPED': ('8 power, draw 1, 2 Dazed', 3.2), 'DRAW2': ('draw 2, 1 Dazed, no power', 2.8)}
for arm in ('SHIPPED', 'DRAW2'):
    a = by.get(arm)
    if not a: continue
    wp.append(f"| {arm} | {labels[arm][0]} | {labels[arm][1]} | {100*a['w']/a['d']:.1f}% | {a['g']} | {a['casts']/a['g']:.2f} | {a['dmg']/max(1,a['casts']):.1f} | {a['dazed']/max(1,a['casts']):.2f} | {a['turns']/a['g']:.2f} |")
s = {r['opponent']: r['win'] for r in rows if r['arm'] == 'SHIPPED'}
d = {r['opponent']: r['win'] for r in rows if r['arm'] == 'DRAW2'}
diffs = sorted(((d[o] - s[o]) * 100 for o in s if o in d))
per_opp = ' '.join(f"{o}:{(d[o]-s[o])*100:+.0f}" for o in s if o in d)
wp_note = (f"DRAW2 minus SHIPPED per opponent (win-rate points, n 40 each): min {diffs[0]:+.0f}, median {statistics.median(diffs):+.0f}, max {diffs[-1]:+.0f}; "
           f"positive against {sum(1 for x in diffs if x > 0)} of {len(diffs)} opponents.\n\n`{per_opp}`")

w3 = sum(1 for f in R.glob('w3*.jsonl') for l in f.read_text().splitlines() if l.strip())
w1 = sum(1 for f in R.glob('w1_*.jsonl') for l in f.read_text().splitlines() if l.strip())

out = f"""# Ticket 149 — 3b: DAEMONS and DRAW ("the scorer prices what it can measure")

Instrument-only. No card, deck, engine or `powerscale.ts` number was changed. Scripts: `scratch/t149_daemon_score.ts`
(static: inventory, pricing, DRAW, guard), `scratch/t149_daemon_procs.ts` (battles + proc counting),
`scratch/t149_daemon_report.ts` (fold to tables + `rates.json`), `scratch/t149_whirlpool.ts` (the in-memory
whirlpool_v2 arm), `scratch/t149_daemon_findings.py` (this file). Raw rows: `results/t149_daemons/w1_*.jsonl`
({w1} 1v1 games), `results/t149_daemons/w3*.jsonl` ({w3} 3v3 games), `results/t149_daemons/whirlpool.jsonl`.

## Headline

- **Only 3 of 14 daemons are in a shipped deck**: `echo_chamber_v2` (ratatoskr_v1, ratatoskr_v2) and `hoofbeat_daemon` (sleipnir_v1). `core_overclock_daemon`, `feedback_loop_daemon` and `fertile_ground_daemon` appear only in `battleFactories.ts` archetype (encounter) decks; the other eight are in no deck at all.
- **`EXPECTED_DAEMON_PROCS = 4` is wrong in both directions, by trigger.** Measured procs per unit-turn (the rate the daemon SEES, `source: SELF` respected) at 1v1 on the 30-deck field: `onTurnStart`/`onTurnEnd` 0.79-0.80 (one per own turn, ~3.9 per game = 4 is right by accident of game length); 0-cost plays (`echo_chamber_v2`, `hoofbeat_daemon`) 1.0 on an average deck but **2.3-3.3 on the decks that ship them** (10-23 procs per game from turn 1; installed and measured: 21.8 procs per cast on ratatoskr_v1, 9.5 on sleipnir_v1 = 5.4x and 2.4x the constant); non-natural self-draw (`feedback_loop_daemon`) 0.33 on the field, zero for 67% of units (1.4 on kraken_v1); `onStatusApplied Burn` 0.14 (zero for 84% of units); `einherjar_standard` 0.000 (no Light attacker in any shipped deck); `riptide` (`onActionEnd` OPPONENT) 4.2 per round = 20 procs a game, 5x the constant.
- **At 3v3 the same daemon is a different card**: `echo_chamber_v2` in the zoo/control comps was cast in 16 of 27 games, by whichever unit drew it (ratatoskr_v1 4, huldra_v1 4, jormungandr_v2 4, others 4), on turn 2.6 mean, and made 4.75 procs per cast (2.05 per turn alive, 2.3 turns alive) - the constant 4 is about right there, for the wrong reason: the SELF gate (ticket 128) and the caster's short life cancel the deck's 0-cost density. ratatoskr_v2 units at 3v3 made a 0-cost non-token play on only 37% of unit-games.
- **The play-turn table**: priced at rate x (len - castTurn), no daemon in the pool is "in band (0.8-1.0x) when cast on turn 3" on the field rate; `echo_chamber_v2`/`hoofbeat_daemon` on ratatoskr_v1 are 2-2.5x OVER the ceiling even at t3 and `riptide` is over at t3 on the field; everything else is under. The AI casts the shipped daemons on turn 1.9 mean (median 2), and skips the 2e `echo_chamber_v2` in 63% of ratatoskr_v2 games.
- **DRAW: the flat 15 power (1.5 score) buys a card whose mean powerscale score across the 33 shipped decks is 3.39 (2.26x the charge)**; range 1.39 (nidhoggr_v1) to 7.09 (ymir_v2). The ticket-131 whirlpool_v2 field number: **"draw 2, 1 Dazed, no power" wins {100*by['DRAW2']['w']/by['DRAW2']['d']:.1f}% vs shipped {100*by['SHIPPED']['w']/by['SHIPPED']['d']:.1f}%** for kraken_v1 at 1v1 over 1200 games each - the scorer has them 2.8 vs 3.2 the other way. Deck context the scorer cannot see: kraken_v1's OS turns every non-natural draw into 2 Dazed.
- **The `score === 0` guard is confirmed**: an in-memory `feedback_loop_daemon` given an on-cast ATTACK 10 scores 1.2 instead of 3.2 - its hook branch is skipped entirely (powerscale.ts L959). No shipped daemon trips it today (`battery_pack` has an action but no hook; every hooked daemon has empty `actions`).
- Bonus scorer reads from the inventory: `scrubber` scores **-1.6** (removing Poison from allies is priced as a downside), `core_overclock_daemon` and `einherjar_standard` score 0.0 (modifier hooks with no `do`).

## Method

- **1v1**: each of ratatoskr_v1, ratatoskr_v2, sleipnir_v1 (the daemon decks), kraken_v1 and fenrir_v1 (the `battleFactories` daemon archetypes) on its own species frame vs every other species x every OS (26-27 opponents), 20 seeds x both turn orders = 40 games per opponent, beamless, IV jitter as `runOne`. {w1} games.
- **3v3**: ticket-140 panel comps, beamless, 5 seeds x both orders = 10 games a cell; cells done in the budget: zoo vs fire_pair (10), control vs ref_solo_a (10), zoo vs control and control vs fire_pair (partial; still appending to w3c/w3d.jsonl when this was written - re-run report -> score --rates -> findings.py to refresh). {w3} games. A zoo/control 3v3 game costs 4-6 minutes on this shared box with the probes attached.
- **Counting**: for each of the 14 daemon hooks in `hooks.json` a probe twin (`probe_<id>`, same trigger + `when`, empty `do` / multiplier 1) is registered and put on every unit's `hooks` on both sides. Its wrapper counts each condition pass outside AI lookahead (`isSimulating()` false). That is "would this daemon have fired here, on this unit", i.e. `source: SELF` gating and the `isToken`/`baseCost`/`isNaturalDraw` filters are exactly the daemon's. The real daemon hooks are wrapped the same way, so installed daemons report casts, cast turn and actual procs. Probes verified not to change outcomes (identical win rates and turn counts with `--noprobe 1`; ~30% slower at 1v1).
- **Unit-turn** = one living unit during one round (`state.turn`). Rates are procs / unit-turns; "implied procs from t1" = rate x mean game length.

{section(score, '## 1. Daemon inventory', '## 3.')}
Notes on the inventory: `reactive_plating` carries a second hook (`reactive_plating_reset`) that is bookkeeping, not value. `drip_feed`'s Poison gate (`targetHasStatus`) sits on the `do` action, not the `when`, so its probe counts every own turn-end; the real value is that times the share of turns an ally is poisoned (not measured here). `scrubber` is the same shape.

{section(rates, '## 2. Per-trigger proc rates')}
Reading the rates: the 1v1 "pool" is weighted toward the five owner decks (each is the PLAYER in every game of its file); the **FIELD** table (ENEMY side only = the standard opponent set, one game each) is the clean "average shipped deck" rate. Would-be damage for the two modifier daemons is the damage the multiplier WOULD have added, summed per unit-game, as a fraction of that unit's maxHp — `core_overclock_daemon` on the field would add ~0.5 of a health bar per unit-game averaged over ALL units, i.e. ~1.1 health bars for the 46% of units that ever carry Strengthened and 0 for the rest.

{section(score, '## 3. Play-turn pricing', '## 4.')}
How to read: `per-proc` is what the scorer already prices one `do` at (score / (4 x 1.5 x 0.9)); the columns t1/t2/t3 replace the constant 4 with rate x (mean game length - castTurn) and re-apply the 1.5 daemon premium and 0.9 exhaust discount. "band at t3" is Henry's bar (0.8-1.0x of the ceiling when cast on turn 3). Modifier daemons and `scrubber` have per-proc 0 in the scorer, so they stay 0 at any rate - the rate for them is in the table above (they DO fire; the scorer has no price for a multiplier or a removal on allies).

Direct check against the installed measurement (procs the real daemon actually made, cast turn inclusive): echo_chamber_v2 on ratatoskr_v1 4.04 procs per turn alive x 5.4 turns = 21.8 per cast (the table's rate x (len - 2) = 3.34 x 4.98 = 16.6 is the same order); hoofbeat on sleipnir_v1 3.34 x 2.85 = 9.5 per cast. Both are far above 4, and both are the deck-built case ticket 32 flagged.

{section(score, '## 4. DRAW', '## 5.')}
Reading: "mean score" is gross card value. Ticket 129 measured the hand emptying and energy left over at 3v3, so at width 3 a drawn card is close to worth its whole score; at 1v1 the energy cap binds more and the 0e column ("mean 0e-card score") is the floor of what a draw is worth there. The flat 1.5 is under the mean in 31 of 33 decks; it is only right for hraesvelgr_v1 (1.51) and nidhoggr_v1 (1.39).

### The ticket-131 whirlpool_v2 case, in the field

{chr(10).join(wp)}

{wp_note}

Method: `scratch/t149_whirlpool.ts`, kraken_v1 on kraken vs the standard 1v1 set (30 opponents), 20 seeds x both orders = 40 games per opponent, `runPairedBatch` with telemetry; the arm patches `ProgramRegistry.whirlpool_v2.actions` in memory + `clearProgramDataCache()` and asserts it took. "Dazed landed/cast" includes the 2 Dazed per non-natural draw that kraken_v1's ABYSSAL_INK OS adds, which is why the shipped card (printed 2 Dazed) lands 3.3 and the arm (printed 1) lands 4.7: on this frame each draw is also 2 Dazed, and the arm draws two.

{section(score, '## 5.')}
Code path: `calculatePowerscale` scores `card.actions` first; the daemon branch at L959 is `if (card.category === 'Daemon' && score === 0)`, so any daemon whose own actions score non-zero (positive OR negative) never reaches `daemonHookActions`. A daemon with a self-debuff on cast (negative score) would ALSO skip its hook value. `battery_pack` (ENERGY +1, no hook) scores 4.9 through the ordinary path and is unaffected.

## Caveats

- 3v3 coverage is thin: {w3} games over three cells (zoo vs fire_pair complete; control vs ref_solo_a and zoo vs control as far as they got in the budget - each game is 4-6 min on this box with the probes and another agent on the same two cores). The 3v3 pool rates are usable for the always-on triggers (turn start/end, opponent card plays, damage taken) and directional for the rest; the installed-daemon rows at 3v3 are n = 10 casts. ink_loop and the remaining round-robin pairs were not run.
- At 3v3 the deck is shared, so `echo_chamber_v2` is cast by whichever unit draws it (huldra_v1 cast it more often than ratatoskr_v1 in the zoo games) and then sees only that caster's 0-cost plays: the `source: SELF` cost ticket 128 described, visible in the "caster deck" column.
- `reactive_plating` probe: its `counter LT 3` gate reads a counter only the real daemon increments, so the raw probe is uncapped; the table applies min(3, hits) per owner-turn after the fact (`platingCapped`), which is what the real card would do on a single-daemon side.
- Probe would-be damage for `core_overclock_daemon` uses the hook's own `multiplier`/`scaling` on the pre-hook damage; it does not model the (unpriced) interaction with the 8-stack cap beyond what `resolveScaling` applies.
- The play-turn table uses the ticket's `len - castTurn` (cast turn's own procs excluded); the installed table uses cast-turn-inclusive turns alive. The two differ by one turn's procs.
- DRAW value is the scorer's own number for the drawn card; it says nothing about whether the scorer is right about that card.
"""
(R / 'FINDINGS.md').write_text(out)
print(out)
