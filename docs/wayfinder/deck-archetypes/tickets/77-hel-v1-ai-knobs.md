# hel_v1 follow-up (ticket 77): AI or OS? - and the three knobs

- Type: wayfinder:task - Henry-directed, 2026-08-17. Measurement + one shipped knob.
- Status: **closed** (2026-08-17)
- Supersedes ticket 75's central conclusion.

## Ask

Henry, on reading ticket 75: *"I'm thinking the hel issue is an AI problem. The idea of the deck
is to prioritize your cards and play damage dealers in a group then end with a light card to give
you extra defense. I don't think the AI is thinking about that. If we change it to effect first
then you just get a flat bonus to dark attacks and the defense doesn't change... I'm not
convinced it is an OS problem yet. Maybe she needs a higher bonus, but I still like the
mechanics."* Plus: add the stance bonus as a knob, prove whether `purify` is needed, and tune
`eclipse`.

## Resolution

Report: [research/hel-v1-ai-and-knobs.md](../research/hel-v1-ai-and-knobs.md). Instrument
`scratch/helturn.ts`. Shipped: **`STANCE_BONUS` in `core/Hooks.ts`** - the +30%/-30% were two
literals inside `applyDamageModifiers` and are now a dial, left at 0.30/0.30.

**Ticket 75's headline is RETRACTED.** It called the OS "structurally inverted"; that was a
conclusion drawn without separating "the OS is inverted" from "the AI never closes on Light",
which the same measurement supports equally. Henry's reading is correct, including his point that
setting stance on CAST would make the defensive half unreachable.

**1. It is the AI.** Correct play - reserve the last Light card and close the turn on it - moves
her **23.9% -> 29.2%** and takes damage absorbed in Light stance from **25.1% to 48.3%**. The
symptom disappears. The specific defect: she ends out of Light while HOLDING a castable Light card
on only 5.5% of turns; the other ~60% she has already spent her Light cards. **The AI has no
concept of end-of-turn state, so it spends its closer.** Not shipped - it is a `TacticalAI` change
touching every deck, and it is the recommended next ticket.

**2. The bonus is too low, and Light matters more than Dark.** On top of correct play: Dark 30->50
is +10.5 points, Light 30->50 is **+16.6**, both is **+27.2, taking her to 56.4%**. Awaiting
Henry's number.

**3. `purify` is proven unnecessary and is costing her +7.2 points.** Swapped for a second
`nights_bite`: 29.2% -> 36.4%. The premise is also disproved - **she does BETTER against DoT decks
without it** (36.7% vs 30.8%).

**4. `eclipse` is correctly priced and is her best card.** Score 6.10 against a 2e budget of 6.50,
and the conditional **over**-delivers: the scorer assumes a conditional lands 70% of the time and
this one lands **82.9%**. At **9.4 damage per energy it is her best card by 1.5x**. The
correctly-priced 1e version (20 power, +15 conditional) measured worse, 28.1%. **The bad card is
`shadow_claw`** - 1,611 casts at 0.9 damage each.
