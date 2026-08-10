# Cleanse becomes a shed — and Poison and Burn get an answer

- Type: wayfinder:task
- Status: **open** — specified, not implemented. Henry's sequencing: **after the ymir pass.**
- Assignee:
- Blocked by: the ymir deck pass (not yet ticketed)
- Blocks: [49-roster-floor-pass](49-roster-floor-pass.md) — this changes the control deck, so every
  control number in 49 must be re-read after this lands

*Design agreed with Henry 2026-08-10. Load measurements below were taken at `5b4e1e0`, registryHash
`1:5fa91002`, over **7,686 side-turns across all 22 tuned decks and both firmware slots**.*

---

## 1. The problem

Henry: *"it does too much — it can wipe 3 turns of status application."*

That is measurably true, and it has now cost three tickets:

| ticket | what a full cleanse did |
|---|---|
| 45 | Henry priced the control's cleanse at **2 Energy** specifically to stop it being a hard counter to poison. It was not enough. |
| 47 | Giving ratatoskr_v1 a `purify` swung its §2.3 **0.21 → 0.65** with nothing in between. A partial shed was monotonic across the whole band. |
| 48 | `deathless_slumber`'s cleanse was worth **36 points of §2.3 and 20 of field on one clause** — more than every other knob in that ticket combined. |

**A full cleanse is a switch. A shed is a dial.** The rework makes every removal effect a shed.

## 2. The rule

> **All card-facing status removal is "shed N stacks of a named group."** No card removes an
> unbounded set.

`CLEANSE` **stays in the engine as a primitive** (Henry's call) — no card uses it, but it remains
available for a relic, a boss mechanic or a future design, and `CLEANSE_POWER` stays as the pricing
anchor described in §5.

## 3. Groups — and why Poison + Burn go together

Henry: *"you will rarely have both so it feels bad to have a dead card for burn only that becomes a
single counter."*

**Measured, and it is a stronger argument than it looked:**

| carried by the acting unit | share of turns | median | p75 | p90 | max |
|---|---|---|---|---|---|
| **Poison** | 29.3% | 5 | 10 | 15 | **60** |
| **Burn** | **12.0%** | 3 | 3 | 3 | **3** |
| **Poison or Burn (grouped)** | **40.4%** | 3 | 8 | 13 | 60 |
| Weakened | 29.6% | 4 | 7 | 11 | 49 |
| Dazed | 26.4% | 2 | 4 | 8 | 26 |
| Weakened or Dazed (the existing group) | 45.2% | 3 | 8 | 13 | 49 |

**Grouping takes the card from live on 12% of turns to live on 40%** — from a narrow counter to
something as reliable as the Weakened/Dazed sheds that already exist. And it is never dead against
anyone: the *least* DoT-afflicted deck in the roster (huldra_v1) still carries one on **31%** of its
turns, the most (nidhoggr_v2) on **63%**.

**The two halves are completely different shapes, and that is fine.** Burn never exceeds **3 stacks**
in 7,686 samples — it decays faster than anything applies it — while Poison piles to 60. So a shed of
3 is a *total* answer to Burn and a *partial* answer to Poison. That asymmetry matches what the two
statuses are: Burn is the fast clock, Poison is the slow one.

Final groups:

1. **Weakened + Dazed** — the stat debuffs. Already served by `soothe` (−1/−1, 0e) and `shrug_off`
   (−2/−2, 0e).
2. **Poison + Burn** — the damage-over-time debuffs. **This ticket adds it.**
3. **Stunned / Asleep** — hard CC, deliberately **not** sheddable. They are short-lived by
   construction, StableOS already answers them, and after ticket 48 Asleep is a resource draugr wants.

## 4. Card changes

| card | from | to | who holds it |
|---|---|---|---|
| `purify` | 1e Light, *"Cleanse all debuffs"* | **1e Light, shed Poison and Burn** | `hel_v1`, `audhumbla_v1/v2` (placeholders) |
| `baseline_purge` | 2e, 30 power + cleanse | **2e, 30 power + shed Poison and Burn** | `control_v1` only |

Both keep their slots, so no deck loses a card. `purify` becoming the DoT shed is deliberate — it is
already the "clean yourself up" card, Light is the support element, and it gives the new group a home
without inventing a card.

**`baseline_purge` sheds the DoT family specifically** (Henry's call) because that is precisely the
hole ticket 45 opened it to fill: the control had no cleanse and no heal and simply absorbed a
compounding poison clock until it died. A DoT shed answers exactly that and nothing else — it stops
being an answer to Weakened, Dazed and everything else it was never meant to counter.

**Starting size, to be confirmed by sim: 3.** It fully clears Burn in every observed case and removes
3 of a median 5 Poison. Knobs in §8.

## 5. The pricing problem — read this before touching the scorer

Ticket 46 priced `CLEANSE` at **10 power** from the measured debuff *load*. Ticket 47 then capped a
card's **total self-facing removal at `CLEANSE_POWER`**, on a dominance argument: *removing everything
costs 10, so removing some of it cannot cost more.*

**That argument gets weaker the moment no card can print a full cleanse.** The anchor becomes
hypothetical — "what a cleanse would cost if one existed" — and it has a consequence:

> Under the cap, **any** shed scores at most **1.0**. A 1e card whose only effect is a shed can
> therefore never reach its 2.4–3.0 band, and a 2e one can never approach 6.5.

So the cap silently makes shed cards **riders rather than standalones**. `purify` as a pure 1e shed
would score **1.0 against a 2.4 floor** and read as a badly under-budget card forever.

Three ways out, and **this is the ticket's real design decision, not the card edits**:

1. **Accept it and say so** — sheds are riders; `purify` gets a second clause (a small heal, a draw)
   to reach its band, exactly as `baseline_purge` staples one to 30 power. Cheapest, and consistent
   with ticket 47's finding that "a cleanse wants to be stapled to something."
2. **Replace the anchor with a measured per-stack removal price**, derived the way ticket 46 derived
   CLEANSE — the load table in §3 is the raw material. The cap then scales with what is actually
   being removed instead of with a card that no longer exists.
3. **Make the cap band-relative** (e.g. removal may not exceed the card's own budget band), which
   keeps the dominance intuition while letting a 2e shed be worth more than a 0e one.

**Do not just delete the cap.** Without it the status tables price `shrug_off`'s −2/−2 at **1.70
against a 0e band of 1.0**, and three currently-legal cards become redlines the day it goes.

## 6. Blast radius

- **`control_v1` changes**, so **every gauntlet number moves** and ticket 49's whole table has to be
  re-read. That is the sequencing reason this ticket precedes the floor pass.
- **This largely dissolves ticket 49 §4** rather than answering it. That section asks whether the
  control's cleanse is a hard counter inflating every "loses to the control" reading for status decks.
  The experiment it proposes (swap `baseline_purge` back to `baseline_slam` and compare per-deck)
  becomes unnecessary — but **run the before/after per-deck comparison anyway**, because it is the
  same measurement and it finally quantifies how much of the floor was cleanse.
- `hel_v1` holds `purify` and is a **tuned** deck — expect its rows to move. `audhumbla_v1/v2` also
  hold it and are placeholders; report, do not tune.
- No engine change beyond leaving `CLEANSE` unused, unless §5 option 2 or 3 is chosen.

## 7. Gates

| gate | expectation |
|---|---|
| `gauntlet:control-vs-*` (all 32) | **re-baselined, not compared** — the control deck changed. Record the per-deck before/after; the status decks are the ones to watch. |
| `gauntlet:control-overall:slot1 / slot2` | re-record. Note HANDOFF 8-FLOOR-MOVES: the aggregate moves on its own as placeholders get real decks. |
| `os:hel`, `mirror:hel` | must stay in band (0.30–0.70, ≤30 turns) |
| card redlines | `purify` and `baseline_purge` must not become over-budget; expect `purify` **under** band unless §5 is resolved |
| everything else | byte-identical — no other deck holds either card |

## 8. Knobs

1. **Shed size 3 → 2 / 4 / 5.** At 2 it no longer fully clears Burn; at 5 it clears a median Poison pile.
2. **Asymmetric shed** — e.g. −5 Poison / −3 Burn, matching the two statuses' measured shapes rather
   than pretending they are the same. More honest, harder to write on a card.
3. **`baseline_purge`'s attack half** 30 power → 20 / 40, to keep the control's total power where
   ticket 45 calibrated it once the utility half changes value.
4. **`purify`'s second clause** if §5 option 1 is taken: a small heal or a draw, sized to band.

## 9. STOP and report

- Any card outside `purify` / `baseline_purge` changes score. Nothing else uses `CLEANSE`.
- The control's slot-1 aggregate moves by more than ~0.10. That would mean the cleanse was carrying
  far more of the floor than expected, which is a finding for ticket 49, not something to tune away.
- `hel_v1` leaves its band. She is tuned; `purify` is her only removal effect.
- A shed card measures a 0% play rate — the AI values held debuffs through the same status tables the
  scorer uses, so a shed the search never plays means the eval, not the card.
