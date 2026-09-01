# Ticket 128 — CINDER_WALL_OS works. 16 of 33 firmwares still go quiet at 3v3

**Status:** DIAGNOSED, no fix shipped — the mechanism is sound and the fix is a ruling.
Henry, mid-run: *"fenrir_v2 doesn't seem to work. I'm at the elite and he doesn't gain any sharp."*

---

## The firmware is not broken

`src/engine/cinderWall.test.ts` fires CINDER_WALL through **every Burn card in fenrir_v2's real deck
list**, through the real program registry, with no hand-registered hooks:

| card | Burn applied | Sharp gained |
|---|---|---|
| `ignite` | 1 to target | **1** |
| `molten_core` | 2 to target | **1** |
| `molten_core` with Sharp up | 4 to target (the conditional second apply) | **2 more** |
| `pyre_sacrifice` | 3 to target **and** 3 to self | **2** — it pays twice |
| `slag_strike` | — | 1, from the card's own text |
| `water_slap` | — | 0 |

All green. The registry, the hook, the `when: { source: SELF, statusApplied: Burn }` gate and the
`onStatusApplied` dispatch are all wired correctly.

**Why the existing test proved nothing.** `OSSystem.test.ts` already asserted this OS works and has
been passing all along — but it fires the hook with `card_burn_test`, which exists only in
`TestProgramRegistry`, and it registers the firmware hooks by hand at module scope. Neither is the
game. A green test over a synthetic card and a hand-wired registry is not evidence about the shipped
deck, and this is the second time in this arc a passing test has covered a path nobody plays.

## Two ways a working CINDER_WALL shows no Sharp, and both are silent

### 1. Dazed eats it

Sharp is the duality partner of Dazed. `effectHandlers.DUALITY_MAP` cancels an incoming status
against its opposite **before the behaviour runs**, so 1 Sharp arriving on a unit holding Dazed
removes 1 Dazed and leaves nothing behind. Working as specified (ticket 102), invisible from outside.

An elite runs its firmware and stacks debuffs. If it is dazing Fenrir, his OS output is being spent
paying that down and he will never show a stack.

### 2. A different body cast the card

The hook is gated `source: SELF` — it pays **the unit that applied the Burn**. At 3v3 the deck is
one shared pile drawn across the whole party, the player picks the caster, and `BattleArena.handlePlay`
**persists the source selection between plays** ("Persist source selection", line ~594). So a caster
picked for one card stays picked for the next, and an `ignite` cast off an ally spends the card and
pays Fenrir nothing.

### The discriminator, for the combat log

Both cases are covered by tests, and they differ in exactly one observable:

- **"Fenrir feeds on the flames!" in the log, but no Sharp** → duality. The OS fired; Dazed ate the
  stack. Check whether his Dazed went *down*.
- **no log line at all** → the wrong body cast the card. The OS never fired.

## The general problem, which is bigger than Fenrir

**16 of the 33 firmwares gate on `source: SELF` at a trigger the player chooses the caster for**
(`onActionStart`, `onStatusApplied`, `onDamageCalculated`, `onActionEnd`, `onHeal`, `onDiscarded`,
`onHealCalculated`):

fenrir_v1, fenrir_v2, kraken_v2, ratatoskr_v1, ratatoskr_v2, jormungandr_v1, jormungandr_v2,
gullinbursti_v1, gullinbursti_v2, hraesvelgr_v1, sleipnir_v1, sleipnir_v2, huldra_v1, audhumbla_v2,
hel_v1, hel_v2.

Every one of them was written for 1v1, where "whenever this unit plays a card" and "whenever a card
is played" are the same sentence. **At 3v3 they are not**, and the difference is invisible: nothing
tells the player that casting `ignite` off the kraken instead of off Fenrir silently costs them the
engine of their deck.

Fenrir v2 is the sharpest case because his whole deck is a loop that assumes he casts his own cards —
`ignite` earns Sharp, `molten_core` doubles when Sharp is up, `cinder_lance` scales on Sharp. Cast
two of those off the wrong body and the loop never starts.

## Three fixes, and they are not alternatives

1. **UI — make the caster unmistakable, and reconsider the sticky selection.** This is the systemic
   one: it fixes all sixteen at once and changes no balance. The caster is currently a highlight the
   player has to be watching for, and it persists across plays.
2. **Widen the OS to the side** — `source: SELF` → `source: ALLY` on CINDER_WALL, so any ally's Burn
   pays Fenrir. One-line JSON change, and a real buff that wants measuring before it ships. It also
   contradicts the printed text (*"whenever Fenrir applies"*), so the card text moves with it.
3. **Leave it as play skill.** Defensible — but only once (1) makes the choice legible. Right now the
   information needed to play it correctly is not on screen.

My recommendation is (1) regardless, and (2) only if 3v3 measurement says v2 is weak with the loop
played correctly. It is worth deciding before EA, because EA is Fire/Nature/Water and 3v3-focused —
fenrir_v2 is a Fire deck in the shipping set.
