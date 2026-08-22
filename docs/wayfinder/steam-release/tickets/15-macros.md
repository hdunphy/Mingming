# Macros: the 10 ruled single-use slots, engine + UI (ticket 15)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [13](13-marketplace-node.md)
- Phase: Vertical Slice

## Deliverable

macros-and-drivers.md is a DESIGN, not a session — implement it. 3 slots per run, fired free on your turn: Surge (~30 power damage), Mend (~30 heal), Venom Shot (3 Poison), Kindle (2 Burn), Rally (3 Str), Cripple (3 Weak), Salve (3 Regen); rares: Free Exec (next card costs 0), Echo (replay last card), Cache Pull (draw 2), Recharge (+1 energy), **Revive** (rare; the gauntlet's in-a-pinch answer). Pricing ruled: full 1e-card value, rares 1.5× (marketplace price follows ticket 13's table). Implement as a `MACRO` action source through the existing reducer (`PLAY_PROGRAM`-shaped, no energy cost), a `macros` array on `IRunState`, UI slots beside the hand, and marketplace/event acquisition. Never call them potions.

Engine note: `Recharge` must ADD energy mid-turn — `processPreTurn` SETS `currentEnergy`, the trap that bit three OSes; do not grant via the pre-turn path.

## Done when

All 10 (+Revive) fire correctly with tests, previews show true numbers, and a macro can be bought and used inside one run.

## Resolution

**Closed 2026-08-22.** All of them fire, they can be bought and used inside one run, and the
previews show true numbers. Suite **1235 → 1323**, `tsc -b` clean, build green.

### There are THIRTEEN, and the design doc's arithmetic was off by one

`macros-and-drivers.md` heads its list "The 11" and then names **twelve** (7 commons + 5 rares,
Revive included). The list is what was designed, so all twelve ship. With ticket 07's map-reveal
that is **13 registry entries**. Nothing was cut to make the prose true.

| id | rarity | effect | true number | price |
|---|---|---|---|---|
| `surge` | Common | `ATTACK` 30, element **None** | 3–7 HP | 32 |
| `mend` | Common | `HEAL` 30 | 5 HP (7.5% of max) | 32 |
| `venom_shot` | Common | `STATUS` Poison x3 | 3 | 32 |
| `kindle` | Common | `STATUS` Burn x2 | 2 | 32 |
| `rally` | Common | `STATUS` Strengthened x3 | 3 | 32 |
| `cripple` | Common | `STATUS` Weakened x3 | 3 | 32 |
| `salve` | Common | `STATUS` Regen x3 | 3 | 32 |
| `ping_sweep` | Common | writes `reveal:biome:N` | the whole biome | 32 |
| `free_exec` | Rare | `BUFF_NEXT_PROGRAM` | next card 0 | 48 |
| `echo` | Rare | `PLAY_LAST_CARD` | same damage again | 48 |
| `cache_pull` | Rare | `DRAW` 2 | 2 | 48 |
| `recharge` | Rare | `ENERGY` +1 (**adds**) | +1 | 48 |
| `revive` | Rare | `REVIVE` 50% | half max HP | 48 |

Numbers measured on the launch trio at the frozen level-15 calibration. Surge's 30 sits at the
registry's 75th percentile of printed attack power (median 19); Mend's 30 is just above the median
heal (26). **Prices derive from ticket 13's table at run time**, so a tuning pass on the card table
moves the macros with it. "Ping Sweep" is an unruled naming call — no source names the map-reveal.

### The `Recharge` trap, avoided and tested

The ticket's own engine note: `processPreTurn` **SETS** `currentEnergy`, which is what bit three
OSes. `Recharge` uses the `ENERGY` action, whose mutation is `Math.max(0, currentEnergy + amount)` —
an **add** on the live value, structurally not a set. Tested from a partly spent pool, from empty,
twice in a row (+2), and **past `maxEnergy`** (4 of 3), which no SET can produce.

### One thing the action vocabulary could not express: `REVIVE`

Every resolution loop skips a target at `currentHp <= 0`, which is correct for all 216 cards and is
exactly what a revive must not do. `HEAL` could not be pressed into service — it would restore HP
without being *about* the downing, and every heal card would inherit the ability the day that guard
was relaxed. So `REVIVE` is an ordinary `ActionType` with an ordinary executor, not a parallel
system, and `handleFireMacro` is the only site that lets a target past the alive-check. (`CardHand`
already had a dormant `'REVIVE'` case waiting for it.) **`registryHash` is unchanged** — it hashes
the three registries, not the action enum — so no stored snapshot moved.

Everything else is `ATTACK` / `HEAL` / `STATUS` / `DRAW` / `ENERGY` / `BUFF_NEXT_PROGRAM` /
`PLAY_LAST_CARD` through the existing executor registry.

### Readings, flagged as such

- **A macro does NOT count as a card play.** `cardsPlayedThisTurn`, `playsThisTurn`,
  `lastProgramPlayed`, `elementPlays` and `lastEnergySpent` are all untouched, and
  `nextProgramModifier` is neither consumed nor applied. Three arguments: `CARDS_PLAYED` scalers are
  deliberately uncapped (ticket 74) because they reward playing out of your *deck*, and a bought
  consumable that inflated them would be a purchasable multiplier; an OS card limit should not make
  one player's macros worse than another's; and leaving `lastProgramPlayed` alone is what makes
  Echo's ruled "replay your last **card**" literally true.
- **Hook phases:** `onModifierPhase` / `onPostDamage` fire (they are per-hit), `onActionStart` /
  `onActionEnd` do not (they are per-*program* — hel_v2's stance flip, UNDERWORLD_GATEWAY's blood
  price — and firing them would make a consumable trigger "when you cast a card" firmware). Follows
  `handleExecuteIntent`'s precedent for a non-card action source.
- **Pricing** read as two tiers (32 / 48). The rejected reading — the 1-energy price of a card of the
  macro's *own* rarity, then x1.5 — charges rares for rarity twice and lands a rare at 108, most of a
  market visit.
- **Macros are player-only** and **Surge is element `None`**, so no STAB and no matchup multiplier:
  its number is the same in every biome.

### Echo and a dead target

`lastProgramPlayed` holds a bare **dataId** — no instance, no source, and crucially **no target** —
so there is no stale target to fall back on. Echo is `targeting: 'ENEMY'` and the player re-aims
every time; a dead original is simply not on the board to pick, and aiming at a corpse is refused as
`'bad-target'` with the slot intact. Echo with nothing played yet is refused as `'nothing-to-echo'`
rather than fizzling on a log line — a rare consumable must not be spent on one.

### What ticket 18 needs for Revive

The battle half works: a downed member returns at 50% max HP, is immediately a legal
caster/target/hook owner (death is derived from `currentHp <= 0`, there is no flag to clear), keeps
its statuses, loses its daemons permanently, gets no free energy. Ticket 18 must:

- **write the revive back into `IGauntletProgress`** — out of `downedMemberIds`, into `persistedHp`
  — or the next fight re-downs them;
- **decide whether 50% is right across three unhealed fights** (`REVIVE_PERCENT_MAX_HP` is one
  constant with the argument attached);
- **decide whether a downed member can be revived BETWEEN gauntlet fights**, from the run screen —
  today Revive only fires in a battle, and a between-fights use wants a `runSlice` path like
  `fireMapReveal`'s.

### Also worth knowing

- The map-reveal records itself in **`IRunState.modifiers`** as `reveal:biome:N` rather than needing
  a field — `runTypes.ts` is ratified and did not have to change. It is the fog rule's third clause.
  It refuses a second survey of the same biome rather than burning a consumable for nothing.
- **Ordering of the two dispatches: battle first, then `consumeMacro`.** A crash between them leaves
  a macro that fired and a slot still full, which beats a slot spent on nothing.
- **No dedupe and no sold-out rule on the macro shelf** — macros are fungible, two Surges in two
  slots is a legal rack, and the brake is three slots plus the price. `MACRO_STOCK_SIZE = 2` is a
  proposal derived against the rack rather than the wallet.
- **Event acquisition is wired** (`grantMacro`, free, same rack rules, tested) but nothing dispatches
  it — the event node is still ticket 30's placeholder.
- `Free Exec` does not zero an X-cost card. Inherited from `getEffectiveCardCost` (ticket 22), not
  introduced here.


## Amendments from tickets 07/08 (Henry, 2026-08-21)

Add a MAP-REVEAL consumable (reveals the current biome's node types) to the Macro family or as a marketplace item — Henry asked for 'items and events that reveal more of the map' under 1-layer visibility (ticket 07). Pricing at 1e-card value like the others.
