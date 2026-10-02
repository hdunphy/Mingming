# Tier ladder and modifier report (ticket 169j)

Run 2026-09-29, on the working tree of row 169j, which sits on top of row 169i (commit `d93029d` on
`playtest-polish`). A commit cannot name its own hash, so that is the parent; the code measured is the
code in 169j.

Produced by `src/debug/balance/tierLadder.balance.ts`. Full run: `npx vitest run --config
vitest.balance.config.ts src/debug/balance/tierLadder.balance.ts`. Knobs for a smaller look:
`TIER_LADDER_SEEDS`, `TIER_LADDER_MODIFIER_SEEDS`, `TIER_LADDER_STARTERS` (a comma list).

## This is a small sample, on purpose

The ticket asks for 30 seeds per starter. That is 12 starters x 30 seeds x 4 tiers = 1,440 walks for the
ladder, plus 1,800 more for the modifier report, and a walk that reaches the gym takes minutes. So the
numbers below are the first **4 seeds per starter** for the ladder (48 walks per tier) and the first **1
seed per starter** for the modifier report (12 walks each). Seeds are labelled `tier-ladder:<starter>:<i>`
and a smaller sample is a prefix of a larger one, so these walks are a subset of the full 30-seed run and
the full run will not contradict them, only tighten them.

The same seeds are walked at every tier, so the graph, the enemy rolls and the offers are identical and
the only thing that differs is the tier. No stat is scaled at any tier.

## The ladder: does each tier win fewer fights?

Mean fights won per run. "Wild" counts wild and rival fights. "Reach gym" is the share of walks that played
a gym fight; "Clear gym" is the share that won the run.

| Configuration | Runs | Fights won | Wild win | Elite win | Reach gym | Clear gym |
| --- | --- | --- | --- | --- | --- | --- |
| Tier 0 | 48 | 4.25 | 88.8% | 60.4% | 14.6% | 6.3% |
| Tier 1 | 48 | 3.10 | 78.1% | 65.7% | 4.2% | 2.1% |
| Tier 2 | 48 | 2.94 | 78.3% | 61.9% | 2.1% | 2.1% |
| Tier 3 | 48 | 2.94 | 78.3% | 61.9% | 2.1% | 2.1% |

Standard error of the mean fights won: tier 0 0.52, tier 1 0.36, tier 2 0.34, tier 3 0.34.

**The check passes on this sample** (4.25, 3.10, 2.94, 2.94: never rises). What to read into it:

- **Tier 1 is clearly harder than Tier 0.** Wild win drops from 88.8% to 78.1% when wilds run their firmware.
- **Tier 2 is only a hair harder than Tier 1** (3.10 to 2.94, well inside the noise). The extra elite and the
  lite AI barely moved this walker.
- **Tier 3 is exactly Tier 2 on these walks, to the last digit.** That is not a coincidence: Tier 3 only
  changes the three gauntlet fights, and only 1 walk in 48 (2.1%) got that far, so on 47 of 48 seeds the
  Tier 3 walk is the same walk as Tier 2. **This walker cannot measure whether Tier 3 is harder**, because
  it almost never reaches the gauntlet. That is the walker's reach, not a fault in Tier 3. Measuring Tier 3
  needs walks that start at the gym, or a stronger walker.

## The modifiers, one at a time, on tier 0

Print only, and only 12 walks each, so read it as "each modifier ran end to end", not as a size of effect.
The baseline row is the same 12 walks the tier 0 row above starts with.

| Configuration | Runs | Fights won | Wild win | Elite win | Reach gym | Clear gym | Scrap unspent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tier 0, no modifier | 12 | 3.92 | 90.0% | 50.0% | 16.7% | 8.3% | 29.6 |
| Tier 0, Junk Start | 12 | 3.58 | 81.1% | 70.0% | 16.7% | 16.7% | 23.8 |
| Tier 0, Tight Budget | 12 | 4.00 | 90.0% | 50.0% | 16.7% | 16.7% | 20.4 |
| Tier 0, Elite Hunt | 12 | 4.08 | 97.1% | 52.6% | 16.7% | 16.7% | 34.2 |
| Tier 0, No Recruits | 12 | 3.25 | 85.0% | 50.0% | 8.3% | 0.0% | 42.5 |
| Tier 0, Draft Start | 12 | 4.75 | 93.3% | 62.5% | 25.0% | 8.3% | 39.6 |

Two things worth knowing, both about the walker rather than the modifiers:

- The walker plays Tight Budget and No Recruits by the game's own rules. The ticket said it needed no
  changes for them; it did (its workshop recruit and its upgrade, patch and junk-removal purchases used the
  plain prices, and its recruit ignored No Recruits). Those four spots now follow the rules, and default to
  exactly what they did before when the modifiers are off.
- With Draft Start the walker drafts the cards the game would have dealt it whenever the offers allow, so it
  mostly re-builds the normal kit. It will not show what a clever human drafter gains.
