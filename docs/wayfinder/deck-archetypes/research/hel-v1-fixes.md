# hel_v1 fixes (ticket 78): the AI could not see a stance at all

Henry approved all four recommendations from ticket 77. This ships three of them; the fourth was
"leave `eclipse` and `shadow_claw` alone", which is what happened.

**Result: `hel_v1` goes from 24.7% field to 59.8%, from five 0% cells to none, and from eight
band violations to four - measured on the full 31-deck grid.** The roster as a whole got healthier,
not just her.

## 1. The AI fix, and why it was smaller than a heuristic

Ticket 77 proved correct play was worth +5.3 points using a `reserve` policy that forced the
line. The obvious next step was to teach the AI that heuristic. **That is not what the defect
was.**

`TacticalAI.statusValue` prices every status the AI can see. Stances fell through to:

```
default:
    // StableOS, stances, Awoken, marker statuses: situational, valued 0.
    return 0;
```

**Stances were worth ZERO to the search.** The AI was not making a sequencing mistake - it could
not see any reason to end a turn holding a stance, because holding one scored the same as not
holding one. Every other status in the game is priced in that table; these two were not.

The fix is two cases in the same table, not a heuristic:

- **`LightStance`** = one opponent turn of throughput x the reduction. One turn, not
  `STATUS_HORIZON_TURNS`, because a stance is not durational - it survives exactly until its
  holder casts a card of the other element, typically their very next action.
- **`DarkStance`** = the same, halved. The asymmetry is real rather than a thumb on the scale:
  Light pays on the opponent's *next* turn, which is certain and immediate; Dark pays only on your
  own next turn, only if you attack first, and only if you are alive. Same-turn Dark damage needs
  no term at all - the search simulates the attack and sees the bigger number directly, so pricing
  it at full value would count it twice.

**The real fix beat the hand-written policy:**

| | field | ends turn in Light | damage taken in Light |
|---|---|---|---|
| before | 23.9% | 34.6% | 25.1% |
| `reserve` policy (ticket 77) | 29.2% | 60.5% | 48.3% |
| **AI fix** | **31.4%** | 52.5% | 39.9% |

It wins because it *weighs* the stance against everything else instead of blindly reserving a
card. Turns that end out of Light while holding a castable Light card fell from **5.5% to 0.7%**.

**This is a general fix and its blast radius is genuinely one deck**: `hel_v1` is the only deck in
the registry that can hold a stance (`nightfall_edge` and `dawns_respite` are the only other
stance cards and neither is in any deck list). If a stance card is ever drafted elsewhere, the AI
now knows what it is worth.

## 2. `purify` cut - and the replacement is not the one ticket 77 measured

Ticket 77's +7.2-point measurement swapped `purify` for a third `nights_bite`. **That arm was
illegal**: the deck rulebook caps copies at 2. Re-swept across legal replacements, with the AI fix
in place:

| replacement for `purify` | field |
|---|---|
| **a second `eclipse`** | **46.7%** |
| `dawnstrike` | 42.5% |
| `lumen_surge` | 36.4% |
| `hamstring` | 34.7% |
| *keep `purify`* | 31.4% |

A second `eclipse` it is - consistent with ticket 77's finding that it is her best card by damage
per Energy (9.4, 1.5x her next). Her curve stays sane at five 0e, four 1e, two 2e.

## 3. The stance bonus is 0.35, not the 0.50 Henry first picked

**0.50 was chosen off a table measured on the broken AI with `purify` still in the deck.** All
three changes stack, and with the other two shipped, 0.50 overshoots badly - 74.0% field, from
second-worst deck to fourth-best, with **eight cells above 90%**. It trades her low-end blowouts
for high-end ones, which is the same pathology in a mirror.

Re-swept against the same 31-deck opponent set the grid uses:

| bonus | field | <10% cells | >90% cells | 0% | 100% |
|---|---|---|---|---|---|
| 0.50 | 74.0% | 0 | **8** | 0 | 1 |
| 0.40 | 64.9% | 1 | 3 | 0 | 1 |
| **0.35** | **59.8%** | 2 | 2 | **0** | **0** |
| 0.30 (unchanged) | 53.1% | 3 | 1 | 1 | 0 |
| 0.25 | 48.1% | 5 | 1 | 1 | 0 |

**0.35 is the only setting with no absolute in either direction.** Henry picked it off this sweep.

Worth noting: 0.50 *clears* the section-2.3 redline on `os:hel` and 0.35 does not (2.0% -> 17.0%,
still outside the 15% gap). That is the deliberate trade - §2.3 is a demoted diagnostic and field
win rate is a primary instrument, so her field number wins.

## 4. Gates

**Balance 8-DIFF: 3 of 67 rows moved, all of them hel.**

| row | before | after |
|---|---|---|
| `os:hel` | 2.0% | **17.0%** |
| `mirror:hel` | 46.0% | 50.5% |
| `gauntlet:control-vs-hel:hel_v1` | 4.0% | **0.0%** |

`hel_v1` now beats the control deck 100% (she was at 96%) and her mirror is dead even. Redlines
54 -> 54, no card-budget change.

**Full 960-cell grid re-run - the roster is healthier, not just hel:**

| | before | after |
|---|---|---|
| absolute 0% cells | 84 | **80** |
| absolute 100% cells | 83 | **78** |
| NEUTRAL absolutes (0 / 100) | 38 / 38 | **34 / 33** |
| band violations | 420 (43.8%) | **411 (42.8%)** |
| FTK | 2 | 2 |

`hel_v1`: **24.7% -> 59.8%**, 5 zero cells -> **0**, 8 band violations -> **4**, range 3%-98%.

Every other deck moved between -1.0 and -2.0 points, which is the arithmetic of one deck getting
stronger rather than anything happening to them: they each now lose a bit more to her.

Unit suite **842/842**. `StanceSystem.test.ts` asserted 30% in three places; it now reads
`STANCE_BONUS` for the arithmetic **and** pins the shipped 0.35 separately, so a future config
change cannot leave a green test asserting a number nobody ships - the ticket-62 burn lesson.

## 5. What this leaves open

1. **`os:hel` is still a 2.3 redline** at 17% (v1 wins 17 of 100 against v2). `hel_v2` at 81.4%
   field with four 100% cells is the remaining half of this species and has not been touched.
2. **`shadow_claw`** is untouched per Henry - 1,611 casts at 0.9 damage each, her most-played card
   doing effectively nothing. It is still the worst card in the deck.
3. **The AI fix only helps decks that hold statuses the eval can price.** The `default: return 0`
   branch still swallows StableOS, Awoken and every marker status. Nothing else there is currently
   load-bearing, but the same class of bug is one drafted card away.
