# Ticket 149 (3c) — the consume family: what the pile is at cast, and what the scorer charges for it

Instrument-only. Scripts: `scratch/t149_castprobe.ts` (plays beamless games, logs every cast of a watched card with the piles read BEFORE the reducer runs, `state.lastStatusConsumed` after, the owner's HP delta, the enemy party's HP delta and the action's `damageLedger`, plus a once-a-turn census sample of the same piles and which watched cards are in hand), `scratch/t149_consume_report.ts` (folds the rows into the tables and re-derives each card's score with the measured pile), `scratch/t149_consume_score.ts` (shipped scores + the scorer's tables). Data: `results/t149_consume/w1_<deck>[_s].jsonl` (one JSON line per game; `_s` = re-run with the census samples), `results/t149_consume/w3_huldra_v1.jsonl`.

Method: owning deck on its own species, PLAYER side, vs every other species x every OS (30 opponents), 20 paired seeds = 40 games/opponent = 1200 games/deck, beamless (no `aiBeam`), stat jitter 5, max 60 turns. 3v3: the ticket-140 panel comp holding the deck vs a panel opponent, 5 paired seeds = 10 battles/cell. Numbers are means unless stated; n is casts.

## Which shipped decks run them

| card | shipped deck(s) (`mingmingRegistry.ts`) | in a panel comp? |
|---|---|---|
| umbral_feast | nidhoggr_v2 | no |
| contagion | jormungandr_v2 | control (huldra_v2+ratatoskr_v2+jormungandr_v2) |
| hexbloom | huldra_v1 | zoo (ratatoskr_v1+huldra_v1+kraken_v1) |
| corrosive_leak | jormungandr_v1 | ink_loop, fire_pair |
| ash_communion | fenrir_v2 | no |
| (bonus) bloodwrath — same shape as umbral_feast, +573%, the pool's furthest-over card | nidhoggr_v2 | no |

## Pile at cast vs the constant (1v1, 1200 games per deck)

"pile census" = the same pile sampled once on every owner turn (zeros included); "held, pile>0, not cast" = turns the card sat in hand with a non-empty pile and was NOT cast — the direct test of "held for a big pile".

| card | deck | casts | casts/game | games w/ a cast | pile READ at cast: mean / median / p90 / max | empty at cast | CONSUMED mean | pile when held, pile>0, not cast (n) | pile census, all owner turns (n) | output per cast | output per game |
|---|---|---|---|---|---|---|---|---|---|---|---|
| umbral_feast | nidhoggr_v2 | 719 | 0.60 | 425/1200 | self Poison 4.72 / 2 / 12 / 25 | 0% (`self_poisoned` constraint) | 4.72 | 2.94 (651) | 1.34 (7203) | heal 74.8 HP = 5.73% maxHp | 44.8 HP |
| bloodwrath | nidhoggr_v2 | 1043 | 0.87 | 673/1200 | self Poison 4.42 / 2 / 11 / 24 | 7% | 4.42 | 2.53 (465) | 1.34 (7203) | 110.8 HP raw dmg = 9.23% target maxHp | 96.3 HP |
| ash_communion | fenrir_v2 | 416 | 0.35 | 380/1200 | self Burn 2.82 / 3 / 3 / 4 | 6% | 2.82 | 2.64 (394) | 0.91 (4887) | heal 229.2 HP = 20.29% maxHp | 79.5 HP |
| contagion | jormungandr_v2 | 859 | 0.72 | 652/1200 | target Poison 8.89 / 8 / 14 / 27 | 0% | (doubles, no consume) | 5.68 (895) | 5.45 (4851) | +8.89 Poison on target | +6.36 Poison |
| hexbloom | huldra_v1 | 2738 | 2.28 | 1066/1200 | target Weakened 10.21 / 10 / 17 / 41 | 1% | 10.16 | 4.95 (916) | 4.30 (11413) | +10.21 Poison on target, -10.21 Weakened | +23.3 Poison |
| corrosive_leak | jormungandr_v1 | 2201 | 1.83 | 1190/1200 | self Poison (pile it adds to) 1.04 / 0 / 2 / 23 | 69% | (adds 2, no consume) | 3.88 (75) | 1.35 (3425) | +2 self Poison, +1 Energized | +3.67 self Poison |

3v3 (zoo vs control, 11 battles completed before the lane was cut off): hexbloom cast once in 11 battles (0.09/battle), pile read 7, Weakened census on the first living enemy 5.26 (n 23 owner turns). The contagion (control comp) and corrosive_leak (ink_loop comp) 3v3 cells did not run — the box was at load 6 on 2 cores and the 3v3 lane got ~5 CPU-minutes an hour; no 3v3 number is claimed for them.

### Constant vs measured, and the score at the measured pile

| card | cost / band | shipped score (over band) | constant the scorer uses | measured pile at cast | score with the constant replaced by the measured pile | over band at measured |
|---|---|---|---|---|---|---|
| umbral_feast | 1e / 3.0 | 14.9 (+397%) | `ASSUMED_CONSUMED_STACKS.Poison` 8 (L565) | 4.72 | 6.15 | +105% |
| bloodwrath | 1e / 3.0 | 20.2 (+573%) | Poison 8 (L565) | 4.42 | 8.45 | +182% |
| ash_communion | 2e / 6.5 | 4.6 (-29%) | `ASSUMED_CONSUMED_STACKS.Burn` 1.5 (L565) | 2.82 | 8.83 | +36% |
| contagion | 2e / 6.5 | 20.4 (+214%) | `MEASURED_BOARD_PILE.Poison` 6.57 (L404, used at L826) | 8.89 | 36.9 | +467% |
| hexbloom | 2e / 6.5 | 3.5 (-46%) | `ASSUMED_WEAKENED_STACKS` 5 for the Poison read (L556, L760); `ASSUMED_STATUS_COUNT` 3 for the Weakened consume (L520 via L566-569) | 10.21 | 16.1 with the read at 10.21 and the consume still at 3; 13.6 with both terms at 10.21 | +148% / +109% |
| corrosive_leak | 0e / 1.0 | 2.3 (+130%) | none — no pile constant on this card; the score is Energized 35 power x0.9 (L303, L786, L871) = 3.15 minus 2 self Poison 9 power x0.9 (L365-369, L782, L871, L898) = 0.81 | 1.04 (the pile it adds to) | 2.3 (unchanged) | +130% |

Every "score at measured pile" is the scorer's own path re-run with the pile as the free variable (`scratch/t149_consume_report.ts` `scoreAt`); each formula reproduces the shipped score at the shipped constant to 0.05.

Note on the ticket's "+154%" for hexbloom: the shipped static scorer gives hexbloom **3.5 (-46%)**; 16.1 (+148%) is what it reads with the measured pile-at-cast substituted for `ASSUMED_WEAKENED_STACKS`. The other three figures in the ticket (+397% / +214% / +130%) are the static scores (`scratch/bandspread.ts` today: umbral_feast +397%, contagion +214%, corrosive_leak +130%; bloodwrath +573% and sun_devourer +214% sit above them in the same list).

### How much of the priced Poison lifetime the games actually have room for

`poisonPower(S) = 1.5 S (S+1)` prices a pile as its whole triangular lifetime (S + (S-1) + ... + 1 ticks of 1% maxHp). Poison ticks at its holder's turn start and loses 1 stack a turn, so a pile of S needs S more holder-turns to pay out. Measured against the turns each game actually had left after the cast:

| card | priced lifetime of the stacks the cast adds/removes (% maxHp per cast) | realized within the game's remaining turns | share |
|---|---|---|---|
| umbral_feast (removal of the self pile) | 25.4% | 21.8% | 86% |
| bloodwrath (removal of the self pile) | 22.2% | 14.6% | 66% |
| contagion (stacks added to the enemy) | 145.5% | 16.1% | 11% (mean game 4.6 turns) |
| hexbloom (stacks added to the enemy) | 115.6% | 43.0% | 37% (mean game 10.0 turns) |
| corrosive_leak (2 self stacks added) | 5.1% | 1.6% | 32% (mean game 3.4 turns) |

So contagion's 20.4 is not just a pile-size question: at the measured pile (8.9 -> 17.8) the triangular table charges 145% of a health pool per cast for a doubling that ticks 16% before the game ends. The removal side of umbral_feast is closer to honest (86%) because nidhoggr_v2 removes a smaller pile early.

## The two questions, read off the code path

### (1) Is the pile at cast the census mean, or larger — is the card held for a big pile?

Larger than the census for every card that reads an existing pile; smaller than the constant for the two Poison-consume cards:

- **hexbloom**: 10.21 at cast vs 4.30 on all owner turns and 4.95 when held with a live pile and not cast — the AI holds it for 2x the pile it sees on an ordinary turn, and 2x `ASSUMED_WEAKENED_STACKS` (5). The constant was the ticket-66 board mean; the card is cast at the top of the pile, not at the mean. The pile is free (huldra_v1's ALLURE_PROXY lands ~18 Weakened a game on its own — `results/t149_oscensus/FINDINGS.md`).
- **contagion**: 8.89 at cast vs 5.45 census and 5.68 held-not-cast — held for ~1.35x `MEASURED_BOARD_PILE.Poison` (6.57). Median 8, p90 14.
- **umbral_feast / bloodwrath**: 4.72 / 4.42 at cast vs 2.94 / 2.53 held-with-pile-not-cast and 1.34 census — held for a bigger pile than a random turn, but the pile is HALF the constant 8 (the L534-536 comment's 7.58 mean was measured on an earlier pool; this pool's mean is 4.7 with median 2 and the same long right tail, p90 12, max 25). The constant is 1.7x the measured cast.
- **ash_communion**: 2.82 at cast vs 2.64 held-not-cast and 0.91 census; Burn caps at 4, so the AI waits for 3 (median 3, p90 3). The constant 1.5 is now HALF the measured pile — ticket 58's 1.5 no longer describes fenrir_v2, whose list feeds Burn onto herself (`pyre_sacrifice`, `molten_core`). At 2.82 the card heals 20% of her pool per cast (229 HP) and prices at 8.8, +36% over its 2e band, not -29% under.
- **corrosive_leak**: 69% of casts on an empty self-Poison pile, mean 1.04 — it is played as a 0-cost Energized card, not as a pile builder; its +130% is entirely the Energized price (35 power = 3.15 score against a 1.0 band), with the self-Poison charged 0.81. Measured, the 2 self stacks tick 1.6% maxHp before the game ends.

### (2) Does the NON-consuming path get priced as though it also cashed the stacks — is any term counted twice?

**hexbloom — no double count in the shipped code; the two actions are priced against two DIFFERENT constants and the consume is a negative term.** Exact path in `src/debug/balance/powerscale.ts`:

- Action 1 `{STATUS Poison stacks 1 scaling WEAKENED_STACKS target TARGET}`: L754 `isConsume = false`; L755-761 `stacks = (action.stacks || 1) * ASSUMED_WEAKENED_STACKS` = 1 x 5 (L757-760); L769-771 `priorPile` 0; L781-782 `marginal(poisonPower)` = `poisonPower(5)/10` = 45/10 = **4.5**; L867-874 scope `Single` x1.0; L895-909 no sign flip (Poison is a debuff, action is enemy-facing, not a consume, stacks positive); L917-926 `score += 4.5`. Nothing here touches Weakened — the read is priced as if the target holds 5, and the stacks are NOT charged as removed.
- Action 2 `{STATUS Weakened consume true target TARGET}`: L754 `isConsume = true`; L755-756 `stacks = consumedCount('Weakened')` -> L566-569: Weakened is absent from `ASSUMED_CONSUMED_STACKS` (L565), so the fallback `ASSUMED_STATUS_COUNT` = **3** (L520); L777-778 `marginal(streamStacks(n) * DEFENSE_STREAM_POWER_PER_STACK)` = 3 x 3.5 / 10 = 1.05; L871-874 scope Single x1; L903 `consume === true` -> `actionScore *= -1` = **-1.05**; L917-920 `removesOwnDebuff` is false (not self-facing), L923 `score += -1.05`.
- Total 4.5 - 1.05 = **3.45 -> 3.5**. The card's one pile is read as 5 stacks on the way in and 3 stacks on the way out, in the same card, and the removal is subtracted (correct sign: eating the enemy's debuff is a loss). What the scorer misses is not a double count but the pile itself: the read is 2x the constant, and the removed Weakened was free (OS-granted), so its subtraction over-corrects. With the read at the measured 10.21 and the consume still at 3 the card is 16.1; with both at 10.21 it is 13.6 (the Weakened removal at 10 stacks is -3.6).
- History, for the record: the "reads x2 and leaves the pile" concern in the L454-459 comment of `ActionExecutors.ts` describes the pre-136c engine; the shipped engine reads at x1 (`scaledStacks = stacks * weakenedOnTarget`, L474-478) and the second action strips the pile (L483-514) — the probe confirms `+10.21 Poison, -10.21 Weakened` per cast.

**umbral_feast / bloodwrath — the consumed pile IS charged twice, in the sense that the same stacks generate two positive terms, and the first of them is a removal premium that does not fit the card.** Path:

- L574-575 `consumedStatusOnThisCard = 'Poison'`.
- Action 1 `{STATUS Poison consume true target SELF}`: L754-756 `stacks = consumedCount('Poison')` = 8 (L565); L781-782 `poisonPower(8)/10` = 108/10 = 10.8; L871 scope SELF x0.9 = 9.72; L898 self-facing debuff -> x-1; L903 consume -> x-1 (back to +9.72); L917-922 `removesOwnDebuff` -> `removalScore += 9.72`; L951-953 `chargedRemoval = removalScore * REMOVAL_PREMIUM` = 9.72 x 1.25 = **12.15** (all of `statusPortion` 12.2).
- Action 2 `{HEAL 5 scaling STATUS_CONSUMED target SELF}`: L738-742 `power = 5 * consumedCount('Poison')` = 40 -> 40/10 x 0.75 = 3.0; L871 x0.9 = **2.7**.
- Total 14.85. 82% of the score is the shed, priced as the full triangular lifetime of an 8-stack pile (36% of a pool) with the ticket-51 x1.25 premium on top — a premium whose stated rationale (L343-361: "an answer cheaper than the threat it answers") is about neutralising a card the OPPONENT paid for. Here the pile is the deck's own fuel (bloodletting, leech_strike put it there) and cashing it is the deck's plan, so the answer/threat argument does not apply; and the pile is 4.7 not 8. bloodwrath is the same path with `ATTACK 10 x consumedCount` (L687) = 8.0 in place of the heal: 12.15 + 8.0 = 20.15.
- The scorer's own comment (L522-539) says the CONSUMED-pile number is "a different question" from the board pile; it is, but the shed premium then prices the consumed pile a second time as avoided damage. If the removal term were dropped and only the payoff priced at the measured pile: umbral_feast 5 x 4.72 = 23.6 power -> 1.59 (1e band 3.0, UNDER); bloodwrath 10 x 4.42 = 44 -> 4.4 (+47%).

**contagion**: L818-829 prices `statusPileValue(Poison, 6.57 x 2) - statusPileValue(Poison, 6.57)` = 20.4 and flags `MULTIPLY_STATUS` for manual review. No double count; the over-band is (a) the pile at cast being 8.9 not 6.57 and (b) the triangular lifetime (11% realized, above).

**corrosive_leak**: no consume, no scaling — L786 Energized 35/stack x0.9 (3.15) and L782 self-Poison 9 x0.9, flipped at L898 (-0.81). Whether 35 power for one Energized is the right price on a 0-cost is a question about `ENERGIZED_POWER_PER_STACK` (L303), not about a pile.

## What each card would score with its constant replaced by the measured pile at cast (1v1)

umbral_feast 6.15 (+105%) · bloodwrath 8.45 (+182%) · ash_communion 8.83 (+36%) · contagion 36.9 (+467%) · hexbloom 16.1 (+148%; 13.6 with the consume also at the measured pile) · corrosive_leak 2.3 (no pile term). The measured pile makes two of the four "over-band" cards LESS over and two MORE over; it brings none of them into band, because for the Poison cards the triangular lifetime table is the larger term.

## Caveats

- 1v1 only for four of the five; the 3v3 lane completed 11 of the planned 60 battles (hexbloom in zoo vs control) before the run was cut off. The one 3v3 hexbloom cast read a pile of 7.
- "Pile when held, pile>0, not cast" is sampled once per owner turn at turn start; a card drawn mid-turn is not in that sample.
- The probe's enemy-HP delta and `damageLedger` per cast include OS procs fired inside the same action (e.g. TOXIN_FANG on jormungandr_v2); for the consume family only the heal / stack numbers are used, which are not affected.
- Poison "realized" turns count game turns remaining after the cast; in 1v1 the target's death is the game's end, so this is exact for enemy piles and slightly generous for self piles (the owner can die first).
- The `_s` re-runs (nidhoggr_v2, huldra_v1) used the same seeds as the originals and differ only by the census samples and the enemy-side stack tracking; the non-`_s` files are kept for reference.

## Addendum 2026-09-09 — 3v3 cells (hexbloom in zoo 25 games; contagion in control 20; corrosive_leak in ink_loop 26)

| card | games | casts | casts/game | pile read at cast mean / median / max | empty at cast | enemy pile census at width |
|---|---|---|---|---|---|---|
| hexbloom | 25 | 5 | 0.20 | 6.0 / 7 / 7 | 0% | 0.93 Weakened (spread over three bodies) |
| contagion | 20 | 6 | 0.30 | 15.7 / 12 / 44 | 0% | 1.05 Poison |
| corrosive_leak | 26 | 13 | 0.50 | 0 / 0 / 0 (adds 2) | 100% | 3.15 self Poison |

Files: `w3_huldra_v1_all.jsonl`, `w3_jormungandr_v2.jsonl`, `w3_jormungandr_v1_all.jsonl`. The cards are cast 4–10× less often at width; contagion is held for an even bigger pile (one cast at 44).
