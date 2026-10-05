# Ticket 196: The cards nobody takes

**Type:** measurement first, then a design session with Henry, then card changes he rules. **Status:** written 2026-10-05 from four agent nights (2026-10-04 haiku and sonnet, Kraken v1 only; 2026-10-05 haiku and sonnet, every starter). **Blocked by [195](195-overnight-night-fixes.md)'s Trace rows (195b–d) and one night played after them** (see *Why wait*; Henry ruled 2026-10-05: *"Wait"*). The shop's prices are their own ticket, [197](197-shop-buys-vs-upgrades.md). Nothing here changes a card until Henry rules it. He reviews every card change before it reaches the registry.

**Where it comes from.** Henry, 2026-10-05, after the overnight review: *"Ticket to address the unused cards."* Each night's report lists only its top ten passed-over and never-bought cards. The numbers below are the full tallies, built with the report's own `cardTallies` and `shelfTallies` (`src/debug/playtest/report/tally.ts`) over every session's facts.

**Coverage.** 63 sessions with moves: 33 sonnet and 15 haiku from 2026-10-05, and 9 sonnet and 6 haiku from 2026-10-04. Three 2026-10-05 sonnet gym runs (r02, r04, r33) are missing because their replay was too slow to finish (ticket 195m). The 2026-10-04 nights were Kraken-only, so Water cards are offered most (373 Water reward offers against 169 Fire and 76 Nature).

---

## What the nights show

### 1. Card rewards: offered at least 4 times, taken 10% of the time or less

| Card | Taken / offered | Kind | Cost | Rules text (short) |
|---|---|---|---|---|
| Wisdom's Price | 0 / 22 | Aura, Rare | 2 | an enemy that draws outside its draw phase… |
| Discharge | 0 / 13 | Skill | 1 | strip up to 4 Strengthened, Burn per 2 removed |
| Corrosive Bolt | 0 / 11 | Water attack | 1 | apply 3 Poison |
| Corrosive Leak | 0 / 10 | Water skill, Rare | 0 | poison yourself 2, gain 1 Energized |
| Idunn's Apples | 0 / 10 | Aura | 2 | each poisoned ally gains 1 Regen |
| Berserkergang | 0 / 10 | Aura | 2 | an ally hit by an enemy attack gains… |
| Tidal Wave | 0 / 8 | Water attack | 3 | 55 power to the enemy side |
| Ember Jab | 0 / 8 | Fire attack | 0 | 8 power, 1 Burn |
| Tidal Battery | 0 / 8 | Water skill | 2 | every ally gains 1 Energized |
| Wildfire | 0 / 7 | Fire attack | 3 | 45 power to the enemy side, 1 Burn each |
| Scald | 0 / 6 | Water attack | 0 | 2 Burn, you gain 1 Dazed |
| Sun Devourer | 0 / 6 | Fire attack, Rare | 2 | consume Strength, 15 a stack |
| Pack Tactics | 0 / 5 | Fire attack | 2 | 23 power three times |
| Snap | 0 / 5 | Fire attack | 1 | 20 power, +12 if Weakened |
| Bark Lash, Shell Share, Brute Force, Slander | 0 / 4 each | | | |
| Forage | 2 / 32 | Skill | 0 | draw 1, take 15 power |
| Vent | 2 / 26 | Skill | 0 | remove 3 Poison from an ally |
| Undertow | 1 / 21 | Water skill | 0 | draw 1, gain 1 Weakened |
| Hoarder's Toll | 1 / 20 | Aura | 2 | |
| Frigg's Oath | 2 / 20 | Aura | 2 | |
| Capacitor | 2 / 20 | Skill | 2 | gain 3 Energized |
| Soothe | 1 / 15 | Skill | 0 | remove 1 debuff stack from an ally |
| Toxic Surge, Eir's Remedy | 1 / 10 each | | | |

**By kind:** Auras were taken 38 times in 213 offers (18%). Cards with no element were taken 58 in 354 (16%), against Water 28%, Fire 31% and Nature 38%. The agent's usual reason was a lean deck: *"Deck is 12 cards already; these are filler"*, *"None help the deck; 13 cards is enough"*, *"I have no poison plan, and the aura is slow."*

### 2. The shop: on a shelf 30 times or more, never bought

Mend 50, Adrenaline 47, Berserkergang 45, Wisdom's Price 44, Riptide 42, Dwarf-Forged 41, Vent 39, Eir's Remedy 39, Hamstring 38, Soothe 37, Discharge 36, Idunn's Apples 35, Forage 33, Frigg's Oath 30.

**But the shop's real finding is that nothing is bought** (that is ticket [197](197-shop-buys-vs-upgrades.md)). Across all sessions there were **22 card purchases and 180 upgrades.** One agent wrote: *"Upgrade prices (25-30) vs a card (15-35) make upgrading Glass Cannon feel obviously best."* "Never bought" on its own therefore says more about the shop's prices than about each card. The tally also shows no Draught bought at all (Ping Sweep 27 shelf appearances, Free Exec 24, …). 196a checks whether that is real or a gap in what the report counts.

### 3. Why wait: the agent played alone

31 of 36 sonnet runs, and every haiku run, ended with a party of one (ticket 195's reason). Many of the unused cards are **ally** or **width** cards that a single body can't use: Tidal Battery ("every ally"), Shell Share ("an ally gains"), Eir's Remedy and Idunn's Apples ("each ally"), Berserkergang ("when an ally takes damage"), Vent and Soothe (cleanse an ally), and the 3-cost hits to the enemy side (Tidal Wave, Wildfire) against mostly single enemies. The fights were also auto-played (run mode), so the agent never saw what an Aura did. Judging these cards on solo runs would mark the 3v3 cards as dead for the wrong reason. **The real tally comes from a night played after 195b–d,** when the agent summons a team.

---

## How to work this ticket

1. **One commit per row,** gate green first, authored as Henry, not pushed (`HANDOFF.md`).
2. **196a and 196b are instrument rows:** bit-identical outputs, except where they add a new file.
3. **196c is a meeting, not code.** Run it with Henry using the `mingming-deck-pass` skill's format. He sketches, the agent costs.
4. **196d only builds what Henry ruled in 196c.**

| Row | What | Kind |
|---|---|---|
| 196a | The report writes the full tallies, not just the top ten | Tool report |
| 196b | Measure each never-taken card in the sims, at 1v1 and 3v3 | Measurement |
| 196c | Design session: Auras, cleanse cards, self-cost cards, the 3-cost sweeps | Henry's rulings |
| 196d | Build the ruled changes | Card data |

## 196a: The report writes the full tallies

1. `writeReport` (`src/debug/playtest/report/write.ts`) also writes `docs/playtest/agent-runs/<date>-cards.csv`, with one row per card: offered, taken, stored, passed, on a shelf, bought, upgraded, the card's element, kind and cost, and the share of offers made while the deck's main element matched the card. LF endings.
2. Check that a Draught bought in the shop is counted as a buy (`choice.about.verb === 'buy'` in `shelfTallies`). If the market's Draught move uses another verb, count it, and say so in the commit.
3. A merge command, `npm run playtest:report -- --cards <date> <date> …`, adds several nights into one table, so this ticket's numbers can be rebuilt in one line.
4. **Test.** The CSV for a two-session fixture has every card the sessions saw, and its totals equal the Markdown report's.

## 196b: Measure each never-taken card in the sims

For each card in section 1's table with 0 takes, measure it with the existing sim tools: the comp grid at 3v3, and the 1v1 grid only for the opening. Swap it into the deck of the starter whose element it shares, replacing that deck's weakest card. Report one row per card: the field number with and without it, at 1v1 and 3v3. This separates "too weak" from "only good at width" from "the agent doesn't value it". No card changes in this row.

## 196c: Design session with Henry

Bring four buckets, each with the 196a numbers from the night after 195 and the 196b measurement:

1. **Auras** (18% taken, almost never bought). Wisdom's Price, Berserkergang, Idunn's Apples, Hoarder's Toll, Frigg's Oath, Eir's Remedy, Riptide, Dwarf-Forged.
2. **Cleanse and utility skills.** Vent, Soothe, Discharge, Capacitor, Tidal Battery, Shell Share.
3. **Cards that cost you something.** Forage (take 15 power), Corrosive Leak (poison yourself), Scald (gain Dazed), Undertow (gain Weakened).
4. **The 3-cost sweeps.** Tidal Wave, Wildfire.

Henry's standing rulings apply: no hidden math, no arbitrary caps, numbers move in 5s. Shop prices are not part of this session (ticket 197).

## 196d: Build the ruled changes

One commit per ruled card or price change, with the before/after line Henry approved in the message.

---

## Rulings (2026-10-05, Henry)

- Wait for a night played after 195b–d before the design session. *"Wait."*
- The shop's card-vs-upgrade prices are their own ticket (197). *"It's own ticket."*

## Decisions for Henry

None until the post-195 night is in. 196a and 196b can be built before then.

## Resolution

(open)
