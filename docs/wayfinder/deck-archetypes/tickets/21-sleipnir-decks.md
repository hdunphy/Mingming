# Sleipnir per-OS decks (Air first pass)

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-06
- Blocked by: [13-per-os-deck-data-model](13-per-os-deck-data-model.md) (closed) + [research/first-pass-process.md](../research/first-pass-process.md)

## Question

Sleipnir §2.3 was **0/100**: both OS slots held the same legacy under-curve 10-card
list, so the head-to-head measured nothing but turn order. Give each OS a deck that
plays its firmware, to first-pass bands (§2.3 0.30-0.70, mirror >=60% decided within
30 turns, per-side deadCardRatio <=0.35), and build the DISCARD action the design needs.

## Resolution

Landed 2026-08-06. Gates: 749 vitest, tsc, build, full committed balance.

### The decks

**v1 MOMENTUM_DRIVE - zoo momentum (12 cards).** Four 0-cost cards (Tackle x2,
Slipstream x2) plus Disorienting Gust feed the Strengthened engine; Stampede x2 and the
new Momentum Crash cash it. Hoofbeat Daemon converts the same 0-cost plays into chip
damage.

    water_slap x2, slipstream x2, disorienting_gust, adrenaline, tailwind,
    zephyr_strike, stampede x2, momentum_crash, hoofbeat_daemon

**v2 WAR_STEED_OS - discard-cost cavalry (8 cards).** The OS needed NO rework: its free
0-cost Hoof Strike tokens became the fodder currency that Lance and Cavalry Charge spend,
which is what lets those two sit deliberately above the rev-3 curve.

    lance x2, cavalry_charge, zephyr_strike x2, dust_devil, tailwind, water_slap

`gust_jab` left both decks; the CARD stayed in programs.json for hraesvelgr (retired in
ticket 22). `trample` and `hamstring` were designed for v1, cut from the final list, and
also stay in the registry.

### The enabler diagnosis (why the first attempt stopped)

The first implementation pass hit §2.3 **0.00** as designed and **0.08** with every
sanctioned knob at its limit (stampede 10->15, lance 55->50, cavalry_charge 100->90,
hoofbeat 5->10), so it stopped rather than reach for unauthorized numbers. Two probes
localized the gap:

- Nerfing v2 far past authorization (lance 40, cavalry_charge 60) reached only **0.14**.
- Buffing the v1 side alone reached **0.57**.

**The shortfall was v1's, worth ~49 points, and it was the ENABLER, not the cards** -
exactly the kraken-OS lesson. MOMENTUM_DRIVE paid 1 Strengthened per 0-cost card, and
Strengthened's own damage bonus is capped at +-25%, so in a ~2.5-turn game the engine
produced almost nothing no matter how many 0-costs v1 played. The fix:

1. **MOMENTUM_DRIVE 1 -> 2 Strengthened per 0-cost card.**
2. **New `STRENGTH_STACKS` scaling** in `getEffectiveAttackPower` - power MULTIPLIED by
   raw Strengthened stacks, deliberately bypassing the +-25% status cap (same slot as
   SHARP_STACKS, so the UI damage preview cannot drift from the reducer).
3. **New card Momentum Crash** (1e Air, 10 power x Strengthened stacks) as the payoff.
   `trample` and `hamstring` came out of the deck to make room at 12 cards.

No card economics were bent to get here: the cards stayed on curve and the OS moved.

### The DISCARD action (built once; hraesvelgr's windmill reuses it)

`{"type": "DISCARD", "count": N}` removes N cards from the ACTING side's own hand.

Two collisions with existing engine behaviour had to be resolved, both worth knowing:

- `battleReducer` already read `action.count` as its **generic multi-hit repeat**, so a
  literal `count: 2` would have run the whole action twice instead of discarding twice.
  DISCARD is now exempt from that loop.
- DISCARD resolves its target to the **source** regardless of the card's declared target.
  Without this, Lance (which targets an enemy) would have discarded the *enemy's* hand,
  and a lethal hit would have skipped the cost entirely via the dead-target `continue`.

The pile-move half already existed in `resolutionEngine.ts` and already used the seeded
`PRNG(seed) -> nextSeed` chain. **The cost form is now deterministic rather than random**:
cards with a `discardEffect` go first (shedding them is upside), then lowest `baseCost`,
then hand order - no RNG at all. `FORCE_DISCARD` and any caller that sets `isRandom`
explicitly are untouched. `hraesvelgr_v1 GALE_FORCE_OS` already listens on `onDiscarded`,
so ticket 22's windmill needed no further engine work.

### Numbers

| | §2.3 (v1 win rate) | mirror decided | mirror avgTurns | deadCards | ftk | kraken gauntlet slice |
|---|---|---|---|---|---|---|
| Band | 0.30-0.70 | >=60% | <=30 | <=0.35 | 0 | - |
| Legacy (before) | 0.00 | - | - | - | - | 100/0 |
| **Committed** | **0.59** | 400/400 | 2.5 | 0.230 | 0 | 75/25 |

**Knob rounds used: none.** The enabler fix landed in band on the first scoped run, so
none of the sanctioned knobs (momentum_crash 10->15, MOMENTUM_DRIVE 2->3, stampede
15->10) were spent.

Deferred to the deep pass: Momentum Crash is a raw-stack scaler and will read as a static
budget exception; sleipnir_v1 still loses the kraken gauntlet slice 25/75, which is a
cross-element question, not an Air one.
