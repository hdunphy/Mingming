# Ticket 118 playtest — findings triage

Henry played all six scenarios 2026-08-28. Twenty-odd observations; this sorts them into what got
fixed, what I can fix, what needs a ruling, and what is working as designed.

**The headline answers to the four questions the run sheet asked:**

1. **Is side-wide control fun?** *"First match was fun. I liked applying all the debuffs. It was a
   bit of a puzzle to figure out which cards to play first."* — **Yes.** Tickets 115/116 stand.
2. **Does "to side" read badly at 1v1?** Not raised. **No.**
3. **Should control sit at 40%?** He crushed the zoo panel. **Probably lower than 40% is not the
   problem** — see the snowball item, which likely explains the win better than the debuffs do.
4. **Stacking or the scaler?** **The scaler.** `stampede` was the complaint in both stacked runs,
   and it is now fixed. The duplicate ruling itself is not implicated.

---

## Fixed already

**`stampede` / `serpents_coil` scaled off the whole side's cards** — ticket 123, shipped. All three
`CARDS_PLAYED` cards already said "you played" / "by host" in their text while the code counted every
ally's cast. `triple-sleipnir` vs the control panel dropped 93.3% → 76.7%. It also nerfs zoo panels
generally, since `panel-zoo` runs both scalers.

---

## Bugs and clear improvements

**`rimebreaker` snowballs at 1v1 — FIXED, ticket 124.** It reads `ANY_STATUS`, every distinct status
on the target, and paid nothing for it, so the pile only grew and each cast was bigger than the last.
It now takes **one stack of each type it counted**. Henry offered "consume or maybe just reduce some
stacks"; a stack is the right half, because `StatusExecutor`'s own hexbloom note records that
consuming turns a card into a hoard dump priced off how long you saved up (×3 measured 13.90 against
a 6.5 band) while reading without consuming keeps it a rate. A stack keeps the rate and still kills
the snowball.

**`hexbloom` has no preview — FIXED, ticket 125.** It failed *both* of the preview's gates: no ATTACK
action, and no HP lost. The preview now diffs the target's statuses out of the same simulated play
that produces the damage number, so it covers **every** status card rather than hexbloom alone, and
there is no second implementation to drift from. A chip row renders the deltas. **Caveat: I cannot
see the UI from here — the data layer and the chip are test-covered, but you should eyeball the
rendering.**

**Regen is dead on arrival** (*"I just put it on there, it triggered for no gain"*). Regen fires at
**end of turn** — your own turn — so you heal *before* the enemy hits you, then lose a stack. Henry:
*"I feel like it should be start of your turn."* He is right — start of turn means it heals the damage
you just took, which is what a regeneration effect is for.

**NOT DONE, and I was wrong to call it a one-line move.** Regen ticks inside the shared end-of-turn
loop that also runs Burn and Poison, alongside defeat detection, HP-threshold crossings and
`STATUS_REMOVED` events. Moving only Regen needs that per-entity processing extracted so it can run a
second pass over the party that is about to act. That is a real reducer refactor, and it moves
`audhumbla_v2`'s Regen battery — which ticket 101 measured on a knife edge, 3 per heal accumulating
where 1 exactly cancels decay — plus `huldra_v1`. **It needs the refactor, tests, and a 1v1
re-baseline.** Worth doing, but not something to slip in beside three other fixes.

**Enemy turns are slow** (*"taking a couple seconds to even play a card"*, *"3v3 enemies take a long
time"*). Not cosmetic — it is the same cost that has been blowing my own 10-minute run budgets all
week, and it got worse with side-scoped cards. The AI scores candidate plays through the real
reducer, so a 3-body side with side-wide effects multiplies the search. This is `0-AI-SIM-COUNTS`
territory and wants its own performance ticket. **NOT DONE** — it is an investigation, not a fix, and
it deserves a real profiling pass rather than a guess.

---

## Needs your ruling

**The 3v2 snowball** (*"Once it was 3v2 it was a landslide. That's something we might have to fix.
We need something to help balance when the first mingming dies"*). **This is the most important item
in the whole playtest** and it is bigger than any card.

> **CORRECTION.** This section first claimed the shared hand stays the same size when a body dies.
> **That is wrong, and Henry said so.** `battleReducer` recomputes the draw from `aliveUnits` every
> turn — `sum(cardDraw) − aliveUnits + 1` — so with 3 cardDraw each it is **7 cards at three bodies,
> 5 at two, 3 at one**. Energy is per-mingming, so that scales down too. Losing a body costs you
> cards, energy and damage roughly in proportion. I asserted a mechanism without reading the code.

So the snowball is not an asymmetry in the resources — it is that **there is no comeback mechanism at
all.** Both sides scale down proportionally, which means the side that lands the first kill
permanently removes a third of the incoming damage and nothing pushes back. Ordinary focus-fire
dynamics with nothing damping them, which is why every 3v3 measurement in this arc has been lopsided
in both directions. Options worth considering: a comeback
bonus on the down side (extra energy or draw while behind on bodies), a scaling defensive buff, or
accepting it as the intended shape of a fight. What is NOT an option is the one I first suggested —
shrinking the hand on death — because that already happens.

**Sharp at 5–6 stacks blocks everything.** Working exactly as specified, and the specification is the
problem. Under ticket 102 the duality statuses are **flat power, uncapped**:
`effectivePower = power + (Str − Weak) + (Dazed − Sharp)`, floored at 0. With 6 Sharp on you and 5
Weakened on the attacker, an 11-power card lands at **zero**. That is the mirror of the finding from
the debuff work — 2 Weakened halves a spam deck, 5 zeroes it — seen from the receiving end. The model
note in `Hooks.ts` already says *"the bound belongs on generation, not on the effect"*; this playtest
is the evidence that generation is unbounded in practice.

**The AI does not prioritise lethal** (*"I lost because I got everyone low... You need to prioritize
kills not weakening. I don't really like that strategy it feels bad to use 45 damage to kill a 4 HP
enemy"*). Two separate things in one complaint, and they pull in opposite directions: the AI should
take a kill when a kill is available (a straightforward scorer fix), but it should *also* not dump 45
damage into a 4 HP target (overkill waste). Both are scorer changes and they interact — worth deciding
which you want weighted harder before I touch it.

**Kraken cannot find its draw** (*"didn't have enough draw cards or I couldn't get to them enough due
to the deck size"*) and **card starvation generally** (*"I was constantly running out of cards. I
either played them all or had energy left over"*). At 3v3 the deck is shared and 27 cards deep while
draw is `sum(cardDraw) − (N−1)`. This is a deck-construction question rather than a bug, and it is
the same complaint from the other direction as *"some turns I had huge draws other turns I got only
the payoff cards. It felt inconsistent"*.

---

## Working as designed — no action

**Same opening hand after restart** (*"I thought it was random"*). Deliberate: a scenario file pins
its seed, so a battle replays identically every time. That is what makes it a controlled experiment
rather than a demo. If you want variety, clear the seed field in the launcher and it rolls one.

**"Why would I play 1v3?"** (scenario 02). You would not — it was built unfair on purpose, as the
fastest way to *see* a side-wide card hit three bodies. That it ends in one turn is the point, not a
balance finding. My run sheet should have said so more plainly.

**`serpents_coil` scaling** (*"Not sure if its a problem yet"*) — same card family as `stampede`,
fixed by ticket 123.

---

## Not yet measured

`panel-control` vs `panel-zoo` at full tier after ticket 123. The last reading was 40.0% and it
should now be higher, since the fix nerfs zoo's own scalers. Every attempt exceeded the run budget —
which is itself the AI-performance item above.
