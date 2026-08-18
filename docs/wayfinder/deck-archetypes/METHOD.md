# The balancing method

What we have learned doing this, written down so the next pass runs the same way. Compiled
2026-08-17 from tickets 60-79. **This is the process document; `HANDOFF.md` is the findings log.**
When they disagree, HANDOFF is newer.

---

## 0. The one-paragraph version

Measure before you touch anything. Diagnose at the MECHANISM, not the symptom. Change one thing,
measure it against the full field, and diff the whole roster to see what else moved. Prefer fixing
the ENGINE that feeds a payoff over capping the payoff. Re-sweep every knob after any other change
lands, because knobs measured against a broken baseline do not survive fixing the baseline. Write
down what you measured, including the numbers that disproved your own hypothesis.

---

## 1. Diagnose before you tune

### 1.1 Damage share does not diagnose anything

Henry, 2026-08-17: *"damage share itself doesn't identify the issue as some decks are literally
built around one card payoff. What we want to understand is how easy is it to get that payoff and
is it hitting too hard."*

A deck where one card does 76% of the damage may be working exactly as designed. The three
questions that actually separate a healthy payoff deck from a broken one:

1. **How EASY is the payoff to reach?** Turn of first cast, casts per game, how often the gate is
   open when it is checked.
2. **How HARD does it hit?** Damage as a share of the target's **whole health bar**, as a
   distribution - median, p90, max. Absolute damage numbers mean nothing across different frames.
3. **How much of the win rate is the OS?** Measured by turning the OS off and re-running the field.

A payoff that lands on turn 4, once a game, for 39% of a health bar is a deck working. One that
lands on turn 1.8, twice a game, for 32% each is an economy problem.

### 1.2 Turning the OS off is the single most useful measurement

It separates "this deck is strong" from "this OS is strong", and the answers have been wildly
different per deck:

| deck | with OS | OS off | the OS is worth |
|---|---|---|---|
| `hel_v2` | 81.4% | **1.8%** | +79.6 - the OS **IS** her economy, not a bonus |
| `ymir_v2` | 81.3% | 60.1% | +21.2, and still top-tier without it |
| `nidhoggr_v2` | 75.7% | 66.9% | +8.8 |
| `nidhoggr_v1` | 78.2% | 70.9% | +7.3 |

**Gotcha that cost a re-run:** an OS can live in TWO places. `initFirmwareHooks` concatenates
`hooks.json`'s `hooks` array with `CustomFirmware[key]`. Clearing only the JSON side measured
hel_v2's healing bonus alone (+11.3) and measured **nothing at all** for ymir_v2. Clear both.

### 1.3 OS contribution runs from +7 to +64 - measure it, do not assume it

Across seven decks: `hraesvelgr_v2` **+64.4** (74.6% -> 10.2% with the OS off), `hel_v2` +79.6,
`ymir_v1` +55.7, `valkyrie_v2` +34.5, `ymir_v2` +21.2, `nidhoggr_v2` +8.8, `nidhoggr_v1` +7.3.
**A deck whose OS is worth +7 cannot be fixed by an OS knob; one worth +64 cannot be fixed by
anything else.** The number tells you which lever exists before you sweep any of them.

A useful sub-signal: if the payoff card's damage **barely moves** with the OS off
(`valkyrie_v2`, 14% -> 13%), the OS is not enabling the payoff - it is adding value directly,
and the knob is the OS's own numbers rather than anything about the card.

### 1.4 Read the code comments first

Twice now the diagnosis was already written down by a previous ticket. `ymir_v2`'s
`maxCardsPerTurn: 2` drawback is documented in `CustomFirmware.ts` as **inert** - "at 2 Energy
with no 0-cost cards the most Ymir can play in a turn is already 2, so the cap never binds" - and
the Ice bonus had already been walked 50% -> 35% -> 25% without fixing it. Ten minutes of reading
saves a sweep.

---

## 2. Fix the mechanism, not the symptom

### 2.1 Brake the ENGINE that feeds a scaler, never the scaler

Henry, 2026-08-17: *"I don't like caps, that makes playing smart feel bad and you'll end turn with
energy. You should be rewarded for playing smart."*

Ticket 73 stopped `jormungandr_v1`'s first-turn kill by capping the draw scaler. It worked and it
was the wrong fix: the scaler is shared, so it cost `kraken_v1` 3 points of field to slow
Jormungandr by 13. Ticket 74 fixed the same kill at OUROBOROS_LOOP - the OS handing her a free
Energy and a free draw on turn one - and cost Kraken nothing.

**A shared card cannot be tuned for one deck.** List a card's carriers and their engine rates
before touching its number. `ink_stream` is carried by a deck that earns 3 triggered draws a turn
and one that earns 1; every change to the card lands hardest on the deck least able to use it.

### 2.2 The recurring pathology: a 0-cost engine feeding an unbounded multiplier

Found three times, in three species, by three different tickets:

| deck | engine | payoff |
|---|---|---|
| `jormungandr_v1` | `undertow` x2 at 0e, each drawing | `ink_stream`, power x cards drawn |
| `ratatoskr_v1` | four 0-cost cards + `echo_chamber_v2` minting more | `seed_bomb_v2`, 15 power per card played |
| `ymir_v1` | `frost_ward` x2 at 0e, each +3 Bark Shield | `avalanche`, 9 power per Bark Shield stack |

**When a deck is over-performing, check whether its payoff scales off something 0-cost cards
generate.** It is the most common broken shape in this game.

### 2.3 A self-damage cost only works if the healing cannot out-earn it

Henry, 2026-08-18, on `hel_v2`: *"if she has a bonus to healing it should definitely be nerfed.
Otherwise the HP as costs doesn't work."* An OS that charges HP and boosts healing is charging
nothing - the cost becomes a loan. That is why removing her turn cap made her STRONGER (2.4).

**The design note that follows, for the next pass:** heals in such a deck **should all be
RIDERS** on attacks, never standalone cards, so a heal is never a blank when the incoming damage
exceeds it - and *"that change might allow us to lift the cap"*. `pale_mercy` is the one pure
heal left in `hel_v2`; `dawnstrike` and `leech_strike` are already riders. The cap machinery is
kept in `CustomFirmware.ts` for exactly this experiment.

### 2.4 A cap on a REGENERATING resource is not arbitrary - it is the bound

Henry dislikes arbitrary caps and is right about card scalers, where a cap punishes the turn
you built toward. **A resource cap is a different animal.** Removing `hel_v2`'s 20% blood
budget - while RAISING the price 5% -> 6% - made her **stronger, 81.4% -> 87.0%**, because her
OS's +50% healing refunds blood faster than the price takes it. Uncapped, the loop has no
bound at all. **Before removing a cap, ask what regenerates the thing it caps.**

Related: such a cap moves in RESOURCE-UNIT steps, not percent steps. At a 6% price, caps of
18% and 20% are identical - both allow exactly three Energy-points.

### 2.5 Henry's preferred nerf shape, in order of preference

1. **Add a condition to the OS so it triggers LESS** (OUROBOROS: 3rd Water card -> 5th).
2. **Make the OS hit less hard when it does trigger** (OUROBOROS: drop the Energy, keep the draw).
3. **Raise the price the OS charges** (UNDERWORLD_GATEWAY: 5% -> 6% maxHP per Energy).
4. Only then cards, then the deck list, then stats.

**Preserve the shape.** The OS and deck were designed together and deliberately. A change that
makes a deck stop doing the thing it was built to do is a failure even if the win rate lands.

### 2.6 Every scaler needs a ceiling, EXCEPT where Henry has ruled otherwise

`STRENGTH_STACK_CAP` 8, `MISSING_HP_PCT_CAP` 50, status percentages 25%. The per-event-count
scalers (`CARDS_PLAYED`, `CARDS_DRAWN`, `CARDS_DISCARDED`) were the only ones with none, and that
is what made a first-turn kill reachable - 99 power from a 1-Energy card. **Caps as a design shape
are now rejected** (2.1); the lesson survives as *know which of your scalers is unbounded and what
feeds it*.

---

## 3. Measuring

### 3.1 Which instrument answers which question

| question | instrument | cost |
|---|---|---|
| where does every deck sit? | `scratch/deckgrid.ts` -> `docs/balance/deck_grid.json` | 960 cells, ~32 min |
| does a hard gate still hold everywhere? | `field-census.shard{1,2}.balance.ts` in `npm run balance` | ~8 min at default |
| what does one deck's card do? | `npm run balance:deck -- --subjects <os>` | ~4 min |
| is this change safe for the roster? | `npm run balance` + `scratch/diffreport.py` (the 8-DIFF) | ~10 min |
| why is THIS deck strong? | `scratch/offenders.ts` | ~3 min an arm |

### 3.2 The 8-DIFF is non-negotiable

Diff the matchup table before and after. **Only the rows you intended should move.** It has caught
three roster-scale accidents that no single-deck measurement would have: a play-count cap driving
`os:ratatoskr` 31% -> 0%, ticket 71's collateral, and ticket 78's confinement to hel alone.

### 3.3 Deck grid vs species census - they answer different questions

Ticket 69's census runs 32 decks against 15 opponent SPECIES, each on `availableOS[0]`. That finds
0%/100% cells. It **cannot** test anything role-related, because half of every archetype is never
on the board as an opponent. Anything about archetypes needs the full deck-vs-deck grid.

### 3.4 Sample sizes and what a number is worth

- 60 games a cell: 1-sigma is ~6 points mid-band. **Counts of 0%/100% cells are solid; a cell
  reading 88 vs 92 is not a distinction.**
- Ranking arms: 15 iterations is fine. **Certifying a shipped value: re-read at 30.**
- Independent seed bases disagree by a few points. Confirm a shipped lane on two.
- A statistic measured on the OLD behaviour does not describe the NEW behaviour, even when it is
  the exact quantity you are switching to. Ticket 71 predicted 41.5% zero-damage casts; the real
  answer after the change was 12.9%, because the AI re-sequenced.

### 3.5 Test simultaneous changes SIMULTANEOUSLY

Single-deck arms systematically **over-state** a nerf that ships alongside others. Ticket 80's
four knobs measured individually predicted 67.6 / 65.9 / 67.0 / 67.3; shipped together they
landed 71.0 / 69.0 / 68.2 / 69.1 - every one 2-3 points higher, because each deck's nerf makes
its former rivals slightly easier for the others. Use single-deck arms to RANK knobs, then
measure the chosen set together before believing a number.

### 3.6 Net damage per turn is not comparable across clock speeds

`hel_v2` is net-NEGATIVE against 9 of 15 opponents - including -4.57 against a kraken she beats
92% - and is the strongest deck in the game. Ticket 67 used net/turn correctly on kraken because
it compared decks of similar pace. **Across paces, compare THROUGHPUT (damage dealt per turn), not
the difference.**

### 3.7 The AI is not a fixed sampler

`getBestAction` pushes candidates through the reducer and prices a card as it will actually
resolve. Change a card's payoff and the AI re-sequences around it. Compensation is therefore a
**fixed point, not a ratio**: ticket 71's naive "multiply the power by the ratio" over-delivered by
77%, because raising the power made the AI feed the card harder. **Sweep the knob and read the
delivered result back.**

---

## 4. Failure modes we have actually hit

### 4.1 The gate that was looking the wrong way

`npm run balance` reported **FTK 0** for months while the full field had **43 first-turn kills** -
the suite ran 67 matchups and the offending deck appeared in one of them. Every aggregate gate has
this failure mode. When a gate has read the same number for a long time, ask what it is not
looking at.

### 4.2 The AI could not see the thing you are tuning

`TacticalAI.statusValue` had `default: return 0` swallowing both stances, so ending a turn in the
defensive stance scored identically to not doing it. The deck was not badly designed and the AI was
not sequencing badly - **the eval was blind**. Before concluding a mechanic does not work, check
that the AI can see it. The `default` branch still swallows StableOS, Awoken and every marker
status.

### 4.3 Knobs measured against a broken baseline

Ticket 77 measured a stance bonus of 0.50 on top of a broken AI and a deck carrying a dead card.
With both fixed, 0.50 overshot to 74% field. **Re-sweep after every other change lands.**

### 4.4 An arm that was never legal

A `purify` replacement measured +7.2 points - by putting a third copy of a card in a deck where the
rulebook caps copies at 2. **Check a candidate against the deck rulebook before quoting its
number.** (8 cards base, up to 12; max 2 copies; the tier split; one 3e payoff.)

### 4.5 A sweep harness that ignored what you asked for

An arm parser derived one cap from another and silently overwrote the explicit value, so every arm
labelled "play 5" ran at 3 and reported a clean zero. **Set each knob independently, and confirm a
zero on the full field before believing it.**

### 4.6 Tests that pin a number nobody ships

A config change left `AdvancedCombat.test.ts` green while its title asserted values that were no
longer live, because it read the config for its arithmetic. **Do both: read the knob for the
arithmetic AND pin the shipped value in a separate assertion.**

---

## 5. Shipping discipline

- **One ticket, one commit.** Author `Henry Dunphy <hdunphy15@gmail.com>`.
- **Never ship red.** Full unit suite, `npm run balance`, and the 8-DIFF before committing.
- **Line endings:** engine `.ts` and `docs/wayfinder` are CRLF; tests, `src/debug` and JSON are LF.
  `programs.json` round-trips byte-exact under `json.dumps(d, indent=4, ensure_ascii=False)`;
  **`hooks.json` does NOT** - edit it as text. If `git diff --stat` shows a whole file changed, you
  converted its endings.
- **Report the thing that disproved you.** Ticket 75 called an OS "structurally inverted" and
  ticket 77 retracted it; ticket 77 predicted `eclipse`'s conditional never landed and it lands 83%
  of the time. Both retractions are in the reports. This is the most useful habit in the log,
  because the wrong hypotheses are the ones that get repeated.
- **State the collateral.** If a fix moves other decks, put the table in the report rather than the
  win rate you were aiming at.

---

## 6. Standing numbers

- **Type advantage is worth 67 points** (ADV 83.7% / NEU 50.2% / DIS 16.7%, deck-level). Perfectly
  one-directional. **The type chart needs no work.**
- **The archetype wheel does not turn** - it is a ladder. RAMP 58.5% > BURST 51.9% > ZOO 40.0% >
  CONTROL 35.0% on neutral cells. Root cause is role size: ZOO 3 decks, RAMP 9, CONTROL 7, BURST
  13. Reassign decks before tuning the wheel.
- **Bucket-band standard:** neutral cells are the balance bugs; typed cells are exempt by design.
  Near-term hard gate is no absolute 0%/100% in a NEUTRAL cell; direction of travel is 10-90.
- **Field band 0.35-0.80**, control floor 0.60, dead cards <= 0.35, FTK 0 everywhere.
- **Section 2.3 (OS variance) is a demoted diagnostic.** Field win rate wins when they conflict.
