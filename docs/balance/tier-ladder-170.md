# Ticket 170: the tier ladder, the gauntlet by tier, and Draft Start with a better drafter

**The one line.** **Tier 3 is harder than Tier 2 in the gym gauntlet, but only just:** from the same 360 parties standing at the gym gate, Tier 2 wins **0.47 of the three gauntlet fights** on average and Tier 3 wins **0.42** (7 parties clear the gauntlet at Tier 2, 6 at Tier 3; 24 parties do worse at Tier 3, 8 do better, 328 are unchanged). The gap is small but it is not noise (a sign test on the 24 against 8 gives p = 0.007). Every one of those 360 parties actually reached the gate.

Everything below is from the full sample: **12 starters x 30 seeds**, no shortcuts.

## How it was run

| Table | Commit (in your repository) | Run date | Seeds |
| --- | --- | --- | --- |
| Gauntlet only (170b) | `a851a8c` | 2026-10-01 | `tier-ladder-gym:<starter>:<i>`, 30 per starter |
| Whole-run ladder and Draft Start rows | `586f8e0` (the 170e commit) | 2026-10-01 | `tier-ladder:<starter>:<i>`, 30 per starter (the same seeds as 169j and as the walker-deaths report) |

The walker changes between those two commits (170c's `reportLeftovers`, 170e's `draftPolicy`) are off unless asked for, and 170a's golden-hash tests and 170e's pin that default walks are byte-for-byte what they were, so the two commits play the same default walks.

Reproduce, from a fresh cache directory per commit (a full run is many hours on two cores; the cache makes it stoppable and splittable):

```
BALANCE_CACHE_DIR=/tmp/cache npx vitest run --config vitest.balance.config.ts --testTimeout=86400000 src/debug/balance/tierLadder.balance.ts
```

`TIER_LADDER_GYM_SEEDS`, `TIER_LADDER_SEEDS`, `TIER_LADDER_STARTERS` and `TIER_LADDER_MODIFIERS` (comma lists) make smaller looks. The gauntlet table took about 8 hours on two cores, the whole-run ladder about 4, the Draft Start rows about 1.5.

## Table 1: the whole-run ladder (fights won per run)

Same seeds at every tier, so the only thing that differs is the tier. "Wild" counts wild and rival fights. "Reach gym" is the share of walks that played a gym fight.

| Configuration | Runs | Fights won | Wild win | Elite win | Reach gym | Clear gym |
| --- | --- | --- | --- | --- | --- | --- |
| Tier 0 | 360 | 3.90 | 89.9% | 53.6% | 10.0% | 0.8% |
| Tier 1 | 360 | 2.73 | 76.7% | 60.4% | 2.8% | 0.0% |
| Tier 2 | 360 | 2.75 | 77.2% | 63.5% | 3.6% | 0.0% |
| Tier 3 | 360 | 2.75 | 77.2% | 63.5% | 3.6% | 0.0% |

**The 169j check ("fights won never rises") fails on this sample: Tier 2 (2.75) is higher than Tier 1 (2.73).** I did not change anything. The size of the miss is 0.02 of a fight, and the paired difference over the 360 shared seeds is +0.022 with a standard error of 0.042, so it is noise: Tier 1 and Tier 2 are not distinguishable by this walker. The things that are clear:

- **Tier 1 is much harder than Tier 0**: 1.17 fewer fights won per run (standard error 0.11); wild wins fall from 89.9% to 76.7%.
- **Tier 2 is no harder than Tier 1** on this walker (see above). Tier 2's extra elite and its lighter AI do not show up.
- **Tier 3 is exactly Tier 2 in all 360 walks.** That is by design: Tier 3 changes only the gauntlet, and only 13 of 360 walks (3.6%) reach it. This is why the gauntlet table below exists.
- The elite win rate goes *up* with the tier (53.6%, 60.4%, 63.5%). That is not the elites getting easier. At higher tiers fewer walks live long enough to meet an elite, and the ones that do are the strong ones.

## Table 2: the gauntlet only (170b)

Each seed is walked to the gym gate once (with the ghost rule, so a fight lost on the way counts as won for the purposes of the walk), and **every tier plays the three gauntlet fights from that same party**: same deck, same Mingmings, same scrap, only the tier differs.

| Configuration | Parties | Clear gauntlet | Gauntlet fights won (0-3) |
| --- | --- | --- | --- |
| Tier 0 | 360 | 1.9% | 0.47 |
| Tier 1 | 360 | 1.9% | 0.47 |
| Tier 2 | 360 | 1.9% | 0.47 |
| Tier 3 | 360 | 1.7% | 0.42 |

**The 170b check passes**: gauntlet fights won never rises from one tier to the next (0.47, 0.47, 0.47, 0.42), and Tier 3 is not a wall (it still wins some).

What the table says, in plain terms:

- **Tiers 0, 1 and 2 are identical in the gauntlet, party for party.** Not "close": the same result for all 360. Tiers 1 and 2 only change fights before the gym (firmware, the lite AI, the extra elite), so under a shared party the gauntlet cannot see them. That is expected, and it is why this table is not a replacement for Table 1.
- **Tier 3 is the only tier that changes the gauntlet, and it makes it a little harder**: by fight count, 244 parties win no gauntlet fight at Tier 3 against 236 at Tier 2.

| Gauntlet fights won | 0 | 1 | 2 | 3 (clear) |
| --- | --- | --- | --- | --- |
| Tier 0, 1 and 2 (identical) | 236 | 87 | 30 | 7 |
| Tier 3 | 244 | 86 | 24 | 6 |

- **The gauntlet is hard for this walker at every tier**: two parties in three win no gauntlet fight at all, and only 7 in 360 clear it at Tier 0. When the floor is this close, a tier that is "much harder" has almost nowhere to go, which is part of why Tier 3 looks only slightly harder. It says as much about the walker's parties (see the next point) as about Tier 3.
- **Where the party came from matters.** 360 parties each won 7.10 fights for real and were carried through 2.87 lost ones on average, and only 36 of 360 (10.0%) needed no carrying at all. The parties that needed none won 0.83 gauntlet fights at Tier 0 (3 clears); the parties carried through 1 or 2 lost fights won 0.55; through 3 or 4, 0.41; through 5 or more, 0.19. So a party's deck, built from "wins" it did not earn, is not the deck that a run which really kept winning would have: it is weaker the more it was carried.

### Gauntlet fights won by starter (mean, 0-3)

| Starter | Parties | Tier 0 | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- | --- | --- |
| fenrir_v1 | 30 | 0.63 | 0.63 | 0.63 | 0.60 |
| fenrir_v2 | 30 | 0.47 | 0.47 | 0.47 | 0.40 |
| skoll_v1 | 30 | 0.53 | 0.53 | 0.53 | 0.47 |
| skoll_v2 | 30 | 0.83 | 0.83 | 0.83 | 0.77 |
| kraken_v1 | 30 | 0.53 | 0.53 | 0.53 | 0.47 |
| kraken_v2 | 30 | 0.47 | 0.47 | 0.47 | 0.47 |
| jormungandr_v1 | 30 | 0.43 | 0.43 | 0.43 | 0.33 |
| jormungandr_v2 | 30 | 0.20 | 0.20 | 0.20 | 0.17 |
| ratatoskr_v1 | 30 | 0.43 | 0.43 | 0.43 | 0.43 |
| ratatoskr_v2 | 30 | 0.27 | 0.27 | 0.27 | 0.27 |
| huldra_v1 | 30 | 0.37 | 0.37 | 0.37 | 0.33 |
| huldra_v2 | 30 | 0.43 | 0.43 | 0.43 | 0.37 |

Tier 3 is no easier than Tier 2 for any starter, and harder for nine of the twelve.

## Table 3: Draft Start, with two drafters (170e)

Tier 0, same 360 seeds, Draft Start on. The **kit** drafter is 169j's (take the dealt kit whenever the offers allow). The **best** drafter (new in 170e) takes the offered card with the highest card score, and when two offers are within 5 power points it prefers a card that adds an element or a role the cards picked so far lack.

| Configuration | Runs | Fights won | Wild win | Elite win | Reach gym | Clear gym | Scrap unspent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tier 0, no modifier | 360 | 3.90 | 89.9% | 53.6% | 10.0% | 0.8% | 61.0 |
| Tier 0, Draft Start (kit drafter) | 360 | 3.94 | 89.5% | 56.3% | 11.1% | 0.6% | 58.0 |
| Tier 0, Draft Start (best drafter) | 360 | 3.28 | 84.9% | 52.7% | 7.2% | 0.3% | 57.1 |

**The best-card drafter does worse than the kit drafter**, by 0.66 fights won per run (paired difference over the 360 seeds, standard error 0.15). Against no Draft Start at all it is 0.62 worse (standard error 0.15), while the kit drafter is level with no Draft Start (+0.04, standard error 0.13). So the game's own tuned kit is about as good as the walker can do, and the walker's idea of "best" is worse.

This is a finding about the card score (`scoreOf`), not a bug in the drafter, and I changed nothing. The draft the two drafters build, over the same 360 offers, is different in a way that points at the score:

| | Kit drafter | Best drafter |
| --- | --- | --- |
| Mean card score | 2.74 | 3.45 |
| Mean energy cost | 0.73 | 1.04 |
| Attack cards | 66.9% | 73.3% |
| Skill cards | 19.0% | 14.1% |
| Kits identical to the other drafter's | 17 of 360 | |

The best drafter picks higher-scoring cards, but the score rises with energy cost, so it ends up with a kit that costs about 40% more energy per card and has fewer cheap skills. That is consistent with the score rewarding raw power and not "can I actually play this hand". It is a reading of these numbers, not a tested cause.

The other modifiers were not re-run for this ticket; `tier-ladder-169.md` still has their (12-walk) rows.

## What I need from you

1. **The 169j assertion fails on 360 walks, by noise.** Tier 2 beats Tier 1 by 0.02 of a fight (standard error 0.04). I left it as it is, so `npm run balance` is red on this check. Do you want it left strict, or compared with a tolerance (for example, "no more than one standard error above the tier before")? Either is a small change to `firstEasierStep`, and neither is a tuning change.
2. **Is "Tier 3 only slightly harder" what you wanted?** In the gauntlet Tier 3 costs about 0.05 of a fight and one clear in seven. If Tier 3 is meant to be a clear step up, the tier rule (the leader's driver in every gauntlet fight) is doing little against these parties, or the parties are too weak at the gate for any rule to show.
3. **The ghost walk's parties are weaker the more they were carried** (0.83 gauntlet fights for the 36 uncarried parties, 0.19 for those carried through 5 or more). The alternative from the 170a ticket, a fixed reference deck per starter, would remove that. Do you want me to build it as a second source of parties and put the two side by side? I used the ghost walk as you said.
4. **The 5 in 170e's tie rule.** I read "5 points" as 5 power points, which is **0.5 on the card score's scale** (the score is power divided by ten). If you meant 5.0 on the score, the rule would put novelty ahead of the score on almost every pick, and it is one constant (`DRAFT_TIE_WINDOW`) to change. The best drafter did worse under my reading; I have not run the other.
