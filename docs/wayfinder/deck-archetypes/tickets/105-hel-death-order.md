# Hel death-order bug + the 999 sentinel leak (ticket 105): P0 correctness

- Type: wayfinder:task - P0 from playtest round 3. Branch archetype-web.
- Status: **CLOSED 2026-08-20** - both findings fixed and pinned. 862 tests, tsc + build clean.

Two findings from Henry's hel_v2 game (snapshot t5-17820999, turn 5):

1. **'I died first yet still got the victory.'** Simultaneous-death / lethal-ordering
   defect: reproduce from the snapshot, name the resolution order (self-damage cast ->
   enemy death -> own death?), and pin the intended rule with Henry if ambiguous. A game
   where the dead win is a correctness bug at any rate of occurrence.
2. **Last Rites displayed 'costs 999 energy/HP' at 23 HP.** That is the 0-COSTHOOK-BLOCK
   sentinel (a cost the frame cannot pay) leaking raw into the UI. Replace with a proper
   disabled state + reason ('would exceed your remaining HP' / 'blood budget spent this
   turn'). Grep for other sentinel leaks while there.

Design answer recorded for Henry: yes - the block fires when the HP cost cannot be paid
(lethal or over the 20%/turn budget); the UI just failed to say so. Gates: repro test for
the death ordering, UI state for the sentinel, suite green. ONE commit.

---

# Resolution

Report: [research/death-order.md](../research/death-order.md). ONE commit.

**Both findings were the same bug wearing two faces.** Correction to the ticket: the repro snapshot
is **`t4-77031961`** (Hel 0/80 vs Control 0/87), not `t5-17820999` - that one is the Sleipnir game.

## The mechanism, from the snapshot's own log

```
Hel plays Pale Mercy -> Hel
  -> Hel heals 2 HP
  -> Hel takes 10 damage  DEFEATED
  144 XP split among 1 allies
Hel's UNDERWORLD_GATEWAY pays 10 HP in blood!
Hel plays Last Rites -> Control
  -> Control takes 17 damage  DEFEATED
```

In resolution order: **Last Rites' blood toll killed Hel, her death was fully processed (XP and
all), and Last Rites resolved anyway.** UNDERWORLD_GATEWAY charges HP during `onActionStart` -
INSIDE the card it pays for - and `handlePlayProgram` checked the caster was alive only BEFORE the
card started. A corpse finished its cast.

## Fix 1 (specific): a price you cannot survive is a price you cannot pay

The ticket's own recorded design answer, only half implemented - the cost hook knew how to refuse a
cast for the blood BUDGET and not for LETHALITY.

```ts
if (spent + pct > OS_KNOBS.hel.capPct) return UNAFFORDABLE_COST;
if (helBloodHpCost(pct, owner) >= owner.currentHp) return UNAFFORDABLE_COST;   // new
```

`>=` not `>`: paying your last HP is death, not a bargain. The HP-price formula moved into a shared
`helBloodHpCost()` - the cost hook and the toll hook computed it in two places, which is exactly how
one learned about lethality and the other did not. **The AI prices through the same path, so it also
stops proposing suicide casts** - ticket 38's finding arriving from the engine side.

## Fix 2 (general): the dead do not get to finish their turn

`handlePlayProgram` re-checks the caster after `onActionStart` and fizzles the card if it died. Hel
can no longer reach it (fix 1 stops her first); it is there so the NEXT mechanic that can kill its
own caster mid-cast does not rediscover this. The card is already paid for and in the discard by
that point - spent, and fizzled, which is the right outcome.

## Fix 3: the 999

`UNAFFORDABLE_COST` + `isUnaffordableCost()` are exported, and `blockedCostReason()` returns the
reason IN WORDS next to the rule that produces it. The card face now shows the card's real printed
cost, struck through in red, with the reason in the tooltip: *"Would cost 5 HP in blood - more than
you have left"* / *"Blood budget spent this turn (24% of 25%)"*. **Grepped for other sentinel leaks:
this was the only one** (remaining `Infinity` uses are animation loops, TTK arithmetic, skoll's
removed cap).

## Fix 4, found on the way: A THIRD DAMAGE PREVIEW

`CardHand` had its own `calculateDamage(source, target, data, firstAttack.power)` - the exact shape
ticket 104 replaced on the unit face. **So the number on the CARD and the number on the TARGET
disagreed on every card 104 fixed.** 104's parity suite missed it because the suite tests the shared
helper and this code never called it. It calls `computeDamagePreview` now; there is one preview in
the game and the suite covers it.

## HENRY'S CALL, not changed: mutual kill = VICTORY

`BattleArena` gives victory precedence when both sides fall, deliberately, so a tie never wipes the
run. But **ticket 38 records that a mutual kill "is a draw, not a win"** and every balance number
treats it that way. This ticket's fixes make Henry's case unreachable, but recoil and DoT can still
produce a tie - where the sim says draw and the screen says VICTORY. Options: (1) leave it, (2) a
DRAW screen (needs a ruling on what a draw DOES to the run), (3) a tie is a loss.

## Gates

- **862 tests green** (6 new, `src/engine/DeathOrder.test.ts`), `tsc` clean, `npm run build` clean.
- **Both fixes pinned by tests that FAIL without them** - verified by removing the general guard
  (a dead caster landed 4 damage).
- The general-guard test drives a **test-only hook built through `HookFactory`**, not hel, so it
  tests the guard rather than the cost path. **A raw object handed to `registerHook` is inert** - it
  must go through the factory. Worth knowing before writing the next engine test.
- **Full 960-cell grid re-run. EXACTLY ONE ROW MOVED: `hel_v2` 45.3 -> 43.1%.** Band 31/32, NEU
  absolutes 30, FTK 2, dead 20.8%, turns 5.21 - all identical. The 2.2 points are the AI no longer
  trading Hel's life for a kill the sim already scored as a draw.
