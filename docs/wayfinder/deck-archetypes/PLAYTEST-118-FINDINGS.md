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

## Bugs and clear improvements — I can do these, none need a design call

**`rimebreaker` snowballs at 1v1** (*"consistently did above 25 damage after one turn of setup"*).
It reads `ANY_STATUS` — every distinct status on the target, **buffs, debuffs, anyone's** — uncapped,
and a control deck applying four different debuffs arms the opponent's own payoff. Henry's proposal
(*"should probably consume or maybe just reduce some stacks"*) is the right shape and matches the
ticket-26 law that a payoff should pay for what it eats. **Recommend: consume the statuses it counts.**

**`hexbloom` has no damage preview** (*"no indication what it will do"*). It scales off the target's
Weakened. `computeDamagePreview` handles ATTACK scalers; hexbloom's payoff is a STATUS action, so it
falls outside the preview path. Fixable in the same shared-helper shape as ticket 90.

**Regen is dead on arrival** (*"I just put it on there, it triggered for no gain"*). Regen fires at
**end of turn** — your own turn — so you heal *before* the enemy hits you, then lose a stack. Henry:
*"I feel like it should be start of your turn."* **He is right and it is a one-line move.** Start of
turn means it heals the damage you just took, which is what a regeneration effect is for. Worth
checking it does not break `audhumbla_v1`'s overheal ramp, which keys off healing.

**Enemy turns are slow** (*"taking a couple seconds to even play a card"*, *"3v3 enemies take a long
time"*). Not cosmetic — it is the same cost that has been blowing my own 10-minute run budgets all
week, and it got worse with side-scoped cards. The AI scores candidate plays through the real
reducer, so a 3-body side with side-wide effects multiplies the search. This is `0-AI-SIM-COUNTS`
territory and wants its own performance ticket.

---

## Needs your ruling

**The 3v2 snowball** (*"Once it was 3v2 it was a landslide. That's something we might have to fix.
We need something to help balance when the first mingming dies"*). **This is the most important item
in the whole playtest** and it is bigger than any card. Losing a body costs you a share of the
damage, but the shared deck and hand stay the same size, so the survivors get *more* cards each while
the enemy's output falls by a third. The advantage compounds instead of decaying — which is why every
3v3 measurement in this arc has been so lopsided in both directions. Options worth considering: a
comeback bonus on the down side, per-mingming draw so losing a body shrinks your hand, or reduced
energy. Each changes the shape of 3v3 substantially, so it is yours.

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
