# Status top-up, description sweep, and the sköll pace diagnosis

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [28-balance-model-bugs](28-balance-model-bugs.md) (closed - this finishes it)

## Question

Ticket 28's status reprice (Strengthened/Dazed 15 -> 5, Weakened/Sharp 10 -> 3.5) left 32
stream-status cards reading under budget. Henry's call: **add more to the cards**, keeping the
2%/stack status mechanic as it is. Also: fix the stale description strings, and find out why
sköll's dead-card ratio will not come down.

## Resolution

### Two more pricing bugs found first

- **Priced stacks are now capped at the engine's cap.** `Hooks.ts` applies 2%/stack to a net
  cap of 25%, so the 13th stack does nothing - but the price was linear and uncapped. Without
  this guardrail the top-up below would have "fixed" cards by piling on stacks the engine
  throws away.
- **`BURN_OVERFLOW_POWER_PER_STACK` 24 -> 3.** Ticket 28 repriced the engine's overflow burst
  from 8% of maxHP to 0.01, but left the *price* at 24. `scorch` was scoring 6.40 against a
  6.50 cap while its 4th Burn stack did literally nothing. This was self-inflicted by ticket 28
  and is the reason to always re-derive a price when its mechanic moves.

### The top-up: 21 cards

Attack power raised where the card already had an attack; stacks raised where the status IS the
card. **Stack counts get noticeably larger** - `cold_snap` 2 -> 8 Weakened, `shield_shards`
2 -> 9 Sharp, `winters_grasp` 2 -> 8. That is the honest consequence of pricing a 2%/stack
effect at 3.5 power and it changes the texture of status numbers across the registry.

**Eleven cards deliberately NOT topped up** (listed in `power_curve_spec.md` rev 3.4): seven
model blind spots whose score is dominated by an action powerscale prices at zero (DRAW,
CLEANSE, SEARCH, shields - `scry`, `keen_edge`, `soothe`, `spiked_carapace`, `equilibrium`,
`acid_splash`, `curse_mark`), and five drawback cards under budget because their self-harm is
now priced honestly (`desperate_strike`, `dark_pact`, `all_in`, `reckless_charge`,
`glass_cannon`). Buffing a card to "curve" when the model cannot see half of it buffs it past.

### Descriptions

**51 corrected**, all mechanically from action data. `hydro_blast` still said 140 power against
an action of 105; `supernova_v2` said 150 against 108. False positives were left alone:
daemons carry empty `actions` and describe hook behaviour, `healOverride` cards state literal
HP, and percentage/scaling text ("+0.7 power per 1%") is not an action field.

### Sköll: the dead cards are a stat line, not a card list

The 47-51% dead-card ratio does not respond to card tuning because it is a **pace symptom**,
and sköll's pace comes from its species stats:

| species | hp | atk | def | hp x def | mirror turns | dead cards |
|---|---|---|---|---|---|---|
| **sköll** | **60** | **105** | **55** | **3300** | **3.3** | **51.2%** |
| hraesvelgr | 70 | 85 | 65 | 4550 | 3.2 | 4.0% |
| fenrir | 66 | 91 | 69 | 4554 | 5.2 | 25.4% |
| kraken | 58 | 80 | 87 | 5046 | 5.1 | 10.1% |
| sleipnir | 75 | 90 | 70 | 5250 | 4.5 | 15.3% |
| jormungandr | 110 | 75 | 75 | 8250 | 6.7 | 5.5% |

Sköll has the **lowest HP and lowest defense with the highest attack** of any tuned species.
Games end in 3.3-3.4 turns, which buys about 10 energy of casting against a hand that has seen
8-9 card instances - so roughly half of everything drawn rots by construction. v1 play rates:
`adrenaline` 28%, `fire_punch_v2` 38%, `fury_strike` 42%, daemon 49%, while `brute_force` and
`overdrive` (28 damage each on a 60 HP pool) close the game.

**Things ruled out by measurement, so nobody re-tries them:**

- **The daemon is not the driver.** `CORE_OVERCLOCK` multiplies damage by `1 + 0.20 x min(stacks, 8)`
  - up to x2.6 - and powerscale scores daemons at **0.00** because they carry empty `actions`.
  It looked like the obvious culprit. Dropping the multiplier 1.2 -> 1.15 -> 1.10 moved the
  mirror 3.33 -> 3.35 turns and total damage 65.9 -> 64.4. It is played only 49% of the time and
  the stacks are rarely near the cap. Reverted.
- **Card-level trims do not reach it either.** The two changes that DID land (below) took §2.3
  from 0.880 to 0.690 without touching the turn count.

The fix is the stat line, or a decision that sköll is the designated glass cannon and its
dead-card band should differ. **Left open deliberately - it is Henry's call, not a knob.**

### Two on-curve corrections that did land

- **`brute_force` +22 -> +15.** Its rider takes the 0.7 uncertainty discount, but skoll_v1's
  TREACHERY_KERNEL grants Strengthened every time sköll is hit, so the condition is near-certain.
  Priced as certain it was 72 power against a 65 cap. This is the OS-guaranteed-conditional blind
  spot: powerscale is per-card static analysis with no deck or OS context and will never flag it.
- **`scorch` 4 Burn -> 25 power + 3 Burn.** The 4th stack overflowed into nothing after ticket 28.
  Play rate **36% -> 83%**, damage 0.0 -> 10.0 per play, and skoll_v2's whole Burn plan comes back.

### Gate

Sköll §2.3 **0.880 -> 0.690** (in the 0.30-0.70 first-pass band). Dead cards still breach.
