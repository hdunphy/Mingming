# What the playtest actually told us (ticket 93)

Eight matches, one human. This is the first non-simulated data the project has ever had, and it
does not say what I expected it to say.

## 1. The single strongest signal: fun tracked RESOURCE DECISIONS, not power

Sorting his own "real choices" score against everything else we know:

| match | deck | choices | result | what the deck asks you to decide |
|---|---|---|---|---|
| D2 | `ymir_v2` | **5** | win | **one card a turn** - which one? |
| D1 | `fafnir_v1` | **4** | win | **bank Energy or spend it** - how long do you hold? |
| B1 | `kraken_v1` | **4** | loss | when to commit to a combo |
| C1 | `hel_v2` | 3 | win | **pay HP or pay Energy** |
| A2 | `fenrir_v1` | 2 | loss | nothing - play the best card |
| B2 | `draugr_v2` | 2 | loss | nothing - the payoff was being cancelled |
| B3 | `fafnir_v2` | 1 | loss | nothing - *"not much strategy in the cards"* |
| C2 | `audhumbla_v2` | **1** | loss | nothing - *"very boring"*, 16 turns |

**Winning is not what made a deck fun.** He lost B1 and rated its choices 4; he won A2's sibling
matchups and rated fenrir 2. What separates the top of that table from the bottom is whether the
deck makes you spend a resource against yourself:

- `ymir_v2`: **one card a turn.** In ticket 85 I flagged her 0.605 dead-card ratio as a measurement
  artifact of `maxCardsPerTurn: 1`. **I had it backwards.** The constraint I was treating as a
  defect is the reason she scored the highest "real choices" of the eight, and Henry called her
  fun. A card left unplayed is not waste - it is the decision.
- `fafnir_v1`: *"Fafnir can skip a turn to give him a big ramp. There were turns where I could get
  to 5-6 energy then hit a huge attack with the x per energy card."* **That is the ramp archetype
  ticket 87 said could not exist in this engine**, and he found it by playing. It does exist - it
  just lives in firmware (HOARD_PROTOCOL) rather than in the stat block, which is exactly where
  ticket 88 concluded it should live.
- `hel_v2`: HP as a currency. Rated **distinct 5/5** - *"this was the most fun"*.

And his own summary of the boring ones is the sharpest line in the whole report:

> *"each deck feels like they have a specific card hierarchy so each hand is decided for itself"*

**A deck with a strict best-card ordering has no gameplay.** Every deck he enjoyed had a rule that
breaks the ordering: a cap on plays, a bank, a cost paid in something other than Energy. That is a
better design principle than anything in tickets 86-88, and it comes with a test he applied himself.

## 2. The archetype question just got a different answer

Tickets 86-88 asked how to make ZOO/RAMP/CONTROL/BURST mean something, and concluded the axes did
not exist because every deck has the same 2 Energy and 3 cards. The playtest says the axis that
matters is not *how much* resource a deck has but **whether it has a decision about one**:

| deck | resource decision | choices score |
|---|---|---|
| `ymir_v2` | plays per turn (capped) | 5 |
| `fafnir_v1` | Energy (bankable) | 4 |
| `hel_v2` | HP (spendable) | 3 |
| everyone else | none | 1-2 |

**Three decks out of 32 have one.** That is a far cheaper thing to fix than the resource line: it
does not need every species re-statted, it needs each deck to be given one rule that makes its hand
a question instead of a queue. And it is measurable in the existing harness - cards left unplayed
with Energy to spare is a proxy for "the cap bound", which is exactly what `ymir_v2`'s dead-card
ratio is.

## 3. Statuses are numerically invisible

> *"the statuses don't feel very noticeable. Like a very small change in damage output maybe 1-2 dmg
> once you hit the cap."*

He is exactly right, and the number is checkable: Strengthened/Weakened/Dazed/Sharp are **2% per
stack capped at +-25%**, and at his level a full 25% swing is 1-2 damage on a 2-3 damage card. He
spent cards to apply them and got nothing he could see.

This is the same root as the tooltip bug in ticket 90 - the glossary claimed 20% per stack, which
would have been visible. **Someone decided statuses should matter ten times more than they do, and
the UI has been describing that game ever since.**

Two ways out, and this is Henry's call:

1. **Raise the rate.** The +-25% cap exists because uncapped status scaling was measured broken -
   but the cap is not the problem, 2% per stack is: it takes 13 stacks to reach a cap that most
   decks can reach in 3-4 cards' worth of application. 5% per stack with the same 25% cap makes a
   status card visible in two applications and cannot run away.
2. **Reprice them as riders.** If statuses are worth 1-2 damage, they should cost about that, and a
   status card that costs a whole card is mis-sold either way.

I would try (1) first, because it needs one constant and the cap already bounds the risk.

## 4. What the zeros are made of

Confirmed in ticket 92 - a human loses them too - and his notes name three distinct causes, which
is three different fixes rather than one:

- **B1, `audhumbla_v1`:** an Energy engine reaching a 3-cost payoff nobody else can afford. A
  POWER problem.
- **B2, `draugr_v2` vs `huldra_v1`:** his payoff counts DISTINCT negative statuses and huldra's
  Sharp **annihilates his Dazed stack for stack**, so the payoff read 4 damage. **A MECHANIC
  problem** - and one no aggregate can see, because it looks like a card underperforming.
- **B3, `fafnir_v2`:** no payoff card at all against a deck with a real one. A DESIGN problem.

## 5. Two smaller things he noticed that are worth answering

- *"Sometimes cards still take energy?"* (hel_v2) - **working as designed, badly explained.**
  UNDERWORLD_GATEWAY zeroes the cost of her **Dark** cards only; her Light and None cards still pay
  Energy. That is deliberate (it is what stops the blood cap being a hard stop on her turn) but
  nothing in the UI says so.
- *"Hoard breaker is rarely needed... the other card that spends all the energy comes up more and
  is stronger."* - he independently found the 89%-dead card from the ticket-85 audit, and gave the
  reason the audit could not: `deep_vein` does the same job better, so `hoardbreaker` is redundant
  rather than weak.

## 6. What I got wrong

- I treated `ymir_v2`'s play cap as a measurement artifact. It is the best-rated mechanic in the
  roster.
- I built the B block out of the three worst matchups in the game and handed them to him back to
  back. It answered the question, and it was a miserable hour.
- Ticket 87 said ramp could not exist here. `fafnir_v1` is ramp, and it is fun, and it shipped
  before I said it was impossible.
