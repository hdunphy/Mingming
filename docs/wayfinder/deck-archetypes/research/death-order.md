# The dead do not win, and 999 was never a price

- Type: wayfinder:implementation. **Ticket 105**, P0 from playtest round 3. Branch `archetype-web`.
- **862 tests green** (6 new), `tsc` clean, build clean.

---

## 0. The short version

Both of your hel_v2 findings were the same bug wearing two faces, and the battle log named it
exactly.

You wrote: *"I could play Last Rites at the end of the game, but I died first yet still got the
victory"* and *"I'm at 23 HP and Last Rites says it costs 999 energy/HP? Would it kill me and thats
why I can't play it?"*

Yes — and the reason you couldn't play it is the reason you shouldn't have been able to play the
one before it either.

---

## 1. The repro, from your own snapshot

The ticket pointed at `snapshot-t5-17820999`, which is actually the Sleipnir game. The hel one is
**`snapshot-t4-77031961`: Hel 0/80 against Control 0/87.** Both at zero. Its log:

```
Hel plays Pale Mercy → Hel
  → Hel heals 2 HP
  → Hel takes 10 damage ☠️ DEFEATED
  ✨ 144 XP split among 1 allies
Hel's UNDERWORLD_GATEWAY pays 10 HP in blood!
Hel plays Last Rites → Control
  → Control takes 17 damage ☠️ DEFEATED
```

Read it in resolution order rather than print order: **Last Rites' blood toll killed Hel, her death
was fully processed — XP and all — and then Last Rites resolved anyway and killed Control.**

UNDERWORLD_GATEWAY charges HP for Dark spells during `onActionStart`, which is *inside* the card it
is paying for. `handlePlayProgram` checked that the caster was alive before the card started and
never checked again. So a corpse finished its cast.

---

## 2. Two fixes, because they protect different things

### The specific one: a price you cannot survive is a price you cannot pay

This is the design answer already recorded on the ticket — *"the block fires when the HP cost cannot
be paid (lethal or over the 20%/turn budget); the UI just failed to say so."* Only half of it was
implemented. The cost hook knew how to refuse a cast for being over the blood budget, and did not
know how to refuse one for being lethal.

```ts
if (spent + pct > OS_KNOBS.hel.capPct) return UNAFFORDABLE_COST;
if (helBloodHpCost(pct, owner) >= owner.currentHp) return UNAFFORDABLE_COST;   // new
```

`>=`, not `>`: paying your last point of HP is death, not a bargain.

The HP-price formula also moved into a shared `helBloodHpCost()` helper. The cost hook and the toll
hook were computing the same number in two places, which is exactly how one of them ended up
knowing about lethality and the other not.

Because the AI prices every candidate through the same cost path, this also stops the AI proposing
suicide casts — which is the other half of ticket 38's finding arriving from the engine side rather
than the evaluation side.

### The general one: the dead do not get to finish their turn

`handlePlayProgram` now re-checks the caster after `onActionStart` and bails if it died:

```ts
const casterAfterStart = afterStart[activePartyKey].find(e => e.id === sourceId);
if (!casterAfterStart || casterAfterStart.currentHp <= 0) {
    return applyMutations(afterStart, [{ type: 'LOG', targetId: '',
        payload: `${sourceEntity.name} falls paying for ${programData.name} - the cast fizzles.` }]);
}
```

Hel can no longer reach this, because her cost hook stops her first. It is here so the **next**
mechanic that can kill its own caster mid-cast does not have to rediscover the bug. The card is
already paid for and already in the discard by this point, which is the right outcome for a cast
whose price killed you: it is spent, and it fizzles.

---

## 3. The 999

`HEL_BLOOD_BLOCKED_COST = 999` was an internal sentinel meaning "the frame cannot pay this" — it
exists so the AI never proposes the card and the reducer would reject it anyway. `CardHand` rendered
the cost pip as `{effectiveCost}` with no idea it might be handed a sentinel, so the number went
straight to you.

Now:

- `UNAFFORDABLE_COST` and `isUnaffordableCost()` are exported, so the UI can recognise a sentinel
  rather than print one.
- `blockedCostReason(state, source, program)` returns the reason **in words**, and lives next to the
  rule that produces the block so the two cannot drift. At 3 HP, `venom_shade` reports
  *"Would cost 5 HP in blood — more than you have left"*; over budget it reports
  *"Blood budget spent this turn (24% of 25%)"*.
- The card face shows the card's **real printed cost**, struck through in red, with the reason in
  its tooltip.

I grepped for other sentinel leaks while I was in there. This was the only one — the remaining
`Infinity` uses are animation loops, TTK arithmetic, and skoll's now-removed cap.

---

## 4. A third damage preview, found on the way

While fixing the cost pip I found that `CardHand` had **its own** damage preview:

```ts
cardPreviewDamage = calculateDamage(source, target, data, attackAction.power || 0, battleState);
```

That is the exact shape ticket 104 just replaced on the unit face — first `ATTACK` action, computed
analytically. So the number printed on the **card** and the number printed on the **target**
disagreed on every card 104 fixed: multi-hit, consume-scaling, conditional branches, firmware
bonuses. Ticket 104's parity suite did not catch it because the suite tests the shared helper, and
this code never called it.

It calls `computeDamagePreview` now. There is one damage preview in the game, and the parity suite
covers it.

---

## 5. One thing I did NOT change, because it is your call

`BattleArena` decides the end screen like this:

```ts
const isVictory = enemyParty.every(e => e.currentHp <= 0);
// Victory takes precedence: if both sides fall in the same resolution, count it as a win
// so the defeat overlay never renders and the save is never wiped.
const isDefeat = !isVictory && playerParty.every(p => p.currentHp <= 0);
```

So a genuine mutual kill shows **VICTORY**. That is deliberate and it has a good reason behind it —
not wiping a run on a tie. But it disagrees with the engine's own accounting: **ticket 38 explicitly
records that a mutual kill "is a draw, not a win"**, and every balance number in this project treats
it that way (`decisiveWinRate` excludes draws).

With this ticket's fixes your specific case cannot recur — hel can't kill herself paying for a card.
But mutual kills are still reachable through recoil cards and damage-over-time, and when they happen
the sim will call it a draw while the screen says VICTORY.

Three options, and I'd rather you picked than guessed:

1. **Leave it.** A tie is a win, the run continues, the sim's stricter accounting stays an internal
   detail. Simplest, and no save ever gets wiped on a technicality.
2. **A DRAW screen.** Honest, matches ticket 38, and needs a design answer for what a draw *does* —
   does the run continue?
3. **A tie is a loss.** Consistent with "the dead do not win", and the harshest.

---

## 6. Gates

- **862 tests green** (6 new in `src/engine/DeathOrder.test.ts`), `tsc` clean, `npm run build` clean.
- **Both fixes are pinned by tests that fail without them.** I removed the general guard and
  confirmed the test fails (a dead caster landed 4 damage); the lethal-cost tests fail against the
  old cost hook by construction.
- The general-guard test drives a **test-only hook built through `HookFactory`** rather than hel, so
  it tests the guard rather than hel's cost path. (A raw object handed to `registerHook` is inert —
  it has to go through the factory, which cost one confused test run to learn.)
- **Full 960-cell grid re-run. Exactly one row moved: `hel_v2` 45.3% → 43.1%.** Band 31/32,
  neutral blowouts 30, FTK 2, dead cards 20.8%, game length 5.21 turns — all identical. A
  correctness fix that touches exactly the deck it was aimed at and nothing else is the best
  possible 8-DIFF, and the 2.2 points are the AI no longer trading Hel's life for a kill that the
  sim was already scoring as a draw.
