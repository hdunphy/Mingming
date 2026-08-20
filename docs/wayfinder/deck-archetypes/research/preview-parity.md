# The preview stopped predicting and started simulating

- Type: wayfinder:implementation. **Ticket 104**, P0 from playtest round 3. Branch `archetype-web`.
- **856 tests green, `tsc` clean, build clean.** Parity suite: 914 checks, 0 mismatches.

---

## 0. The short version

The hover preview was a **second implementation of the damage rules**, and it had drifted from the
first one once per mechanic. You hit three of those drifts in a single evening.

It no longer predicts. It plays the card through the real engine on a throwaway copy of the battle
state and reports what actually happened. There is no second implementation left to drift.

A sweep of every attack card across eight battle states found **52 mismatches across 13 cards**
before the change and **0** after.

---

## 1. What was actually wrong

The old preview found the card's **first `ATTACK` action**, computed its damage analytically, and
multiplied by the scalings it happened to know about. Everything outside that one action was
invisible. Sweeping the registry sorted the breaks into five classes:

| class | example | previewed | dealt |
|---|---|---|---|
| **multi-hit** | `stone_flurry` (one action, `count: 3`) | 2 | 6 |
| | `crag_barrage` | 3 | 9 |
| **consume-scaling** | `sun_devourer` (spends the Strengthened pile) | 4 | 0 with an empty pile, **25** with a full one |
| | `momentum_crash` | 2 | 0 / 13 |
| **self-aimed attacks** | `forage` (its ATTACK hits its own caster) | 1 | **0** — it never touches the enemy |
| | `desperate_strike` | 2 | 0 |
| **conditional branches** | `blood_rite` — **your report** | 3 | **8** (5 + 5) |
| | `berserk_rush` below 50% HP | 5 | 10 |
| **firmware bonuses** | `ragnarok_edge` + fenrir's missing-HP kernel | 21 | 23 |
| | `cinder_lance` | 10 | 12 |
| | `deep_vein` — **your report** | 9 | 36 |

Ticket 90 had already fixed one of these classes (the turn-history scalings) by teaching the
preview about them. That is exactly why this needed a different approach: teaching the preview
about the other four would have left five places to drift instead of one.

---

## 2. The fix

`computeDamagePreview` now does this:

```ts
const before = pool(state, targetId);
const after = globalBattleEventBus.runMuted(() => battleReducer(state, {
    type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId: cardId },
}));
const damage = before - pool(after, targetId);
```

That is the whole thing. The returned state is thrown away.

**This is not a novel risk.** `TacticalAI.getBestAction` already pushes entire candidate card
sequences through the reducer under a muted event bus, dozens of times per turn — running one card
for a hover is a far smaller version of a pattern the engine has relied on for a long time.

Three details that make it safe rather than merely clever:

- **The event bus is muted, and muting is now nest-safe.** `mute()`/`unmute()` were a plain boolean,
  so a preview computed from inside an AI simulation would have un-muted the AI's remaining work
  and leaked real events into the UI. `runMuted()` saves and restores the previous state instead.
- **Purity is asserted, not assumed.** The suite snapshots the caller's state before every one of
  the 914 previews and compares after. A hover silently mutating the real game would be a far worse
  bug than the one being fixed, so it is pinned rather than trusted.
- **The cheap playability gate stays in front.** Energy and SELF-side constraints are still checked
  analytically, so hovering an uncastable card does not pay for a card resolution.

### The two definitions the ticket asked me to pick and document

- **The number is HP LOST, not raw damage.** On a lethal blow it shows the target's remaining HP
  and sets a `lethal` flag, which the UI renders as a red **LETHAL** chip. This is also what makes
  the parity assertion meaningful: preview and executor are compared on the same quantity.
- **Multi-hit shows the TOTAL, plus a chip.** `blood_rite` reads **8**, not "4" followed by a
  surprise second 4 — with an **×2 HITS** chip beside it saying how the 8 arrives. That was the
  half of the information you were missing when you wrote *"it did 5 damage + another 5 dmg."*

---

## 3. The suite

`src/ui/utils/previewParity.test.ts`. For every attack card in every species' decks, across eight
sampled battle states, it asserts `preview === HP the target loses`.

The eight states are not decoration — each one switches on a class of mechanic that was previously
invisible, and without them most scaling cards resolve to zero damage and get skipped:

| state | what it turns on |
|---|---|
| `fresh` | the control |
| `hurt` | below-50% conditional branches, missing-HP firmware |
| `piles` | duality stacks on both sides (+1 power each since ticket 102) |
| `midturn` | cards-played and energy-spent scalers |
| `hoard` | banked Energized — what `deep_vein` reads |
| `counters` | triggered draws, discards |
| `loaded` | Dazed / Burn / Poison / Weakened on the target |
| `shielded` | BarkShield on the caster |

Three assertions: zero mismatches, zero state leaks, and **coverage floors** (>600 checks, >40
distinct cards) so the suite cannot pass by quietly skipping everything.

It runs in about a second, so it joins the standing unit gates rather than the balance suite. I
verified it can fail: sabotaging the preview by one point produced 605 mismatches with a readable
per-card report.

---

## 4. What this does not cover

- **Only the hovered target.** A card that also hits other party members previews the hovered one.
  Correct for 1v1; worth revisiting when 3v3 lands (ticket 98).
- **Cards that deal the target no damage show no preview** — pure buffs, empty consume piles, a
  scaler with nothing to read. That is the pre-existing contract (`damage: 0` means "no preview")
  and I left it alone. It is arguably worth showing an explicit "0" for an empty `sun_devourer`,
  since "no chip at all" and "this will do nothing" look the same to a player. Small, separate.
- **Randomness.** A card with a random element resolves once for the preview and again for real. In
  1v1 with a single enemy there is nothing to disagree about, but it is not a guarantee in 3v3.
