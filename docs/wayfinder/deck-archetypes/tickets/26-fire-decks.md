# Fire decks: fenrir berserker vs burn engine, skoll sharp-scaling

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Commit: `a0eebbc`

## Question

Fire is the third element pass. fenrir wants a below-50%-HP berserker v1 against a Burn
engine v2; skoll wants its Sharp/Strength scaling made legible.

## Resolution

Nine new Fire cards on the rev 3.3 curve: `berserk_rush`, `battle_rhythm`, `crimson_draw`,
`ragnarok_edge`, `bloodlust`, `slag_strike`, `pyre_sacrifice`, `ash_communion`,
`cinder_lance`. The design was costed against **rev 3.2** while the repo had already moved
to rev 3.3, so all nine were re-priced x0.857 on the way in. Flagged at the time; the
ticket number also collided (the prompt said 25, which was taken by pace completion).

Two scalers made power-side: `MISSING_HP` adds `scalingPower x pctMissing` capped at 50%
(`ragnarok_edge`), `STRENGTH_STACKS` multiplies raw power capped at 8 stacks. powerscale
scores MISSING_HP at the cap.

`fenrir_v1_daemon` renamed **`core_overclock_daemon`** — the old id named the species, not
the effect. Test fixture id updated with it (this was a section 8 STOP; Henry authorised).

### Burn rescale

Burn was the only damage source tickets 23/24/25 never touched. It is %maxHP, so it bypasses
`calculateDamage` entirely — three successive attack cuts left status far stronger than its
price. Tiers rescaled x0.665 to **1.5 / 3.5 / 8%**, with `BURN_TIER_POWER` following at the
unchanged 3-power-per-1%-maxHP rate.

## What this ticket did NOT resolve

fenrir_v1 gated at **§2.3 = 0.00** and both knob rounds were spent. That is what ticket 28
went after, and the cause turned out to be three model/engine bugs rather than the deck.
