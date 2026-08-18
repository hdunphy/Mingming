# Why jormungandr_v1 got strong: an attribution study

- Type: wayfinder:research
- Written: 2026-08-12, for ticket 55 (deep pass #1), at Henry's request.
- Question: **"Was it simply the broken OS that was fixed?"**
- Short answer: **No. The OS fix is the largest single term, but it is 47% of the move, not
  100% — and the two halves multiply rather than add.**

---

## 0. The defect, first, because everything below is downstream of it

`OUROBOROS_LOOP` had never fired. Not in this build, not in any build since ticket 16 shipped it.

`jorm_v1_count`'s `COUNTER` action in `hooks.json` carried no `"target"` field, and
`HookFactory.executeActions` early-`continue`s any non-LOG action whose target resolves to null.
So `jorm_water` was never incremented, the `EQ 3` condition never matched, and the OS was inert.
Measured directly before the fix: a six-turn game ends with `counters: {"deck_shuffles": 4}` and
zero OUROBOROS log lines.

This is the **second** occurrence of the trap recorded in HANDOFF after ticket 53 (GENESIS_FIRMWARE
hit it too, and looked like a broken guard rather than a dropped action). A registry-wide sweep says
jormungandr_v1 is the only other victim — but all four of its actions were affected, including the
`DRAW` and both `RESET`s. `jorm_v1_reset` additionally had no `when` clause at all, so once fixed it
would have wiped the count on the *opponent's* turn end; it is now scoped to `source: SELF`.

## 1. The 2x2

Four arms, each measured the same way: `jormungandr_v1` against all fifteen other species, 10 seeds
x 2 turn orders per pairing (~300 decided games), plus 30 seeds x 2 orders against the frozen
control.

**Everything except the two varied factors is held constant at ticket 55's state** — including
`surge_protection`'s rework, which also sits in kraken's decks. That is deliberate: it keeps the
opponents identical across all four arms. It also means arm A is a *controlled* baseline, not the
historical one (see §4).

| | OS broken | OS fixed | deck effect |
|---|---|---|---|
| **old deck** | **A** — field 22.3%, control 45.0%, 7.5 turns | **B** — field 55.7%, control 96.7%, 5.2 turns | **+33.4** |
| **new deck** | **C** — field 44.7%, control 90.0%, 6.5 turns | **D** — field 92.7%, control 100.0%, 3.2 turns | **+48.0** |
| **OS effect** | **+22.4** | **+37.0** | |

Decomposing the full +70.4-point move from A to D:

| term | points | share |
|---|---|---|
| **OS fix** (main effect, averaged over both decks) | **+33.4** | 47% |
| **deck rebuild** (main effect, averaged over both OS states) | **+22.4** | 32% |
| **interaction** | **+14.6** | 21% |

**The interaction is the interesting number.** If the two changes were independent the deck would
have been worth +22.4 in both rows; it is worth +48.0 once the loop works. The deck was designed to
feed the OS, so the OS working makes the deck worth more than twice what it is worth alone. Neither
half explains the result on its own, and neither half is a rounding error.

**The control axis tells a blunter story.** The OS fix alone takes the control matchup from 45.0% to
96.7% — with the *old* deck, unchanged. That is worth stating plainly: **ticket 49 listed
jormungandr_v1 at 0.71 against the control as a top-priority "genuinely real" floor entry, and it
was a dead hook the whole time.** The deck was never the reason it lost to a deck with no firmware.

## 2. Which part of the deck did the work

Knockouts from the full build (arm D, 92.7%), each one change, everything else held:

| change | field | delta |
|---|---|---|
| **remove BOTH cantrips** (`undertow` + `tide_reading` -> `poison_injection` x2) | **55.0%** | **-37.7** |
| remove `tide_reading` only (deck goes to 8) | 78.7% | -14.0 |
| remove `undertow` only (deck goes to 8) | 82.0% | -10.7 |
| `tide_reading` draw 2 -> 1 (deck stays 9) | 83.0% | -9.7 |
| remove `ink_stream` x2 (-> `poison_injection` x2) | 90.7% | -2.0 |
| revert `surge_protection` to its old 1e / 15 power | **95.7%** | **+3.0** |

Two conclusions, and the second one is a surprise:

- **The cantrips ARE the deck change.** They are worth -37.7 of the deck's contribution; everything
  else in the list is noise by comparison. That is the loop's own logic showing up in the numbers:
  a cantrip is a Water card that counts toward the 3rd-card proc *and* replaces itself, so it
  advances the chain without shortening the hand. Nothing else in the deck does both.
- **`ink_stream` is nearly free (-2.0), and `surge_protection` at 2e/40 is a NERF to jormungandr
  (+3.0 when reverted).** The payoff cards are not what makes this deck strong. `ink_stream` is its
  biggest damage source at 14.1 damage per play and 60% of v1's output, and removing both copies
  costs two points of field — because the chain finds damage somewhere regardless. And spending 2
  of 2 Energy on `surge_protection` competes directly with the chain it is supposed to support.

**If the goal is to land the 35-80% window, the lever is cantrip count, not payoff power.** Removing
`tide_reading` alone lands **78.7%**, inside the window, at 8 cards. That is a deck-list change
rather than a number, so it is Henry's call, not a knob.

## 3. What it actually looks like at the table

The mechanism, in one sentence: **the deck plays 4-5 cards a turn where two Energy should buy two.**

Loop-watch, across every opponent: the modal side-turn is **5 cards played**, the distribution runs
0 / 2 / 3 / 4 / 5 / 7 / 8 / 10, and the maximum observed is **10** — right at the ticket's STOP line
of >10, and only after `undertow` was already cut from 2 copies to 1 (it was **11** before that).

The mirror is now **2.3 turns** at 400/400 decided, the fastest on the roster by a wide margin
(next: hraesvelgr at 3.2), with a **-28.5% first-mover edge** — moving *second* wins. That is what a
deck looks like when the whole game is one explosive turn and the player who takes it last takes it
with more information.

## 4. Footnote on the baselines

The committed pre-ticket-55 numbers are **25.0% field** and **0.71 control** (i.e. jormungandr won
29%), read at registry `1:e2f392b8`. Arm A above reads 22.3% / 45.0% instead, because arm A holds
`surge_protection` at its ticket-55 2e/40 form so that kraken — an opponent in the round robin —
stays identical across all four arms. The field figures agree within three points; the control
figures do not, and the gap is `surge_protection` itself, which is worth roughly 16 points of
control matchup to the *old* jormungandr deck. Use the 2x2 for attribution and the committed
numbers for history.
