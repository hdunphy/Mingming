# Fire investigation — measure before anyone designs

- Type: wayfinder:research — **REPORT-ONLY.** No card, deck, OS or price changed. No engine or
  data file was written; every measurement ran read-only against HEAD.
- Ticket 58. Read at registry **`1:3466b533`**, 2026-08-14.
- Instrument: `npm run balance:deck` at 60 iterations for attribution; a stepped battle driver
  with `BurnBehavior.onApply` wrapped for stack accounting; paired batches for control reads.
- Template and quality bar: `jormungandr-v1-attribution.md`.

---

## The three findings that should shape the design session

**1. Burn's cap eats a third of all Burn played in the game, and the overflow that is supposed
to compensate pays literally zero.** Across every deck in the roster that applies Burn:
**32.1% of applied stacks are wasted, and overflow damage totalled 0 across 54,767 requested
stacks.** `fenrir_v2` wastes **53.8%** of the Burn it applies — more than half. This is not a
tuning gap; `BURN_OVERFLOW_PERCENT = 0.01` rounds to zero on every frame under 100 max HP, and
the code comment says so explicitly ("intentional headroom, not an oversight").

**2. `ash_communion` is not unaffordable — it is OUTBID, and it is mispriced by a factor of two
because the scorer assumes a stack count the deck cannot supply.** In hand on 281 player turns,
cast 26 times. **Outbid on 144 turns (51%), unaffordable on 107 (38%), blocked by a constraint on
ZERO.** When cast it heals **7.3 HP** — about 1.5 stacks consumed, against the 3 that
`ASSUMED_STATUS_COUNT` prices it at. Its 10.6 static score is an artefact of that assumption.

**3. `fenrir_v1` never recovered. The floor list's 0.25 line runs through its sampling
distribution.** Nothing touched fenrir or the control between the two readings that moved it
0.29 → 0.194. Measured on the identical matchup: **150 iterations gives 0.205, and five different
seed bases at 50 iterations give 0.255 / 0.235 / 0.182 / 0.232 / 0.283 — a spread of 0.101.** The
whole "silent recovery" fits inside one seed-base spread.

---

## Q1 — Where does each Fire deck's damage come from?

60 iterations, 360 decided games per deck. **Residual = total HP dealt minus the sum of
card-attributed damage**, i.e. damage-over-time and other non-play sources.

| deck | field¹ | dmg/turn | game length | **DoT residual** | dead cards |
|---|---|---|---|---|---|
| fenrir_v1 | 29.1% | 13.32 | 5.52 | **~0%** | 22.8% |
| fenrir_v2 | 25.7% | 11.50 | 5.56 | **39%** | 20.6% |
| skoll_v1 | 36.9% | 17.90 | 4.13 | **~0%** | 28.0% |
| skoll_v2 | 24.2% | 14.34 | 4.48 | **18%** | 19.1% |

¹ 30-iteration census, `roster-census.md`.

**The Burn plans do deliver — more than the ticket's brief assumed.** skoll_v2's DoT is **~11.6 HP
per game** (18% of 64.2 HP dealt), not the ~5 on record. fenrir_v2's is **~25 HP per game** (39% of
63.9), which is the largest DoT share in the roster.

**Per-card, ranked by damage dealt:**

| deck | card | casts | dead | dmg/cast | share | static → measured |
|---|---|---|---|---|---|---|
| **fenrir_v1** | `ragnarok_edge` | 765 | 0.224 | **17.6** | **50.8%** | 6.5 → 7.16 |
| | `blood_rite` | 731 | 0.225 | 6.4 | 17.7% | 3.4 → 4.83 |
| | `berserk_rush` | 481 | **0.460** | 6.7 | 12.3% | 2.9 → 3.06 |
| | `battle_rhythm` | 460 | 0.089 | 6.8 | 11.9% | 3.1 → 4.49 |
| | `crimson_draw` | 430 | 0.139 | 4.6 | 7.4% | 4.1 → 4.53 |
| | `ember_mend` | 644 | 0.006 | 0.0 | 0% | 0.7 → 0.7 |
| **fenrir_v2** | `pyre_sacrifice` | 398 | 0.050 | **16.3** | 28.3% | 6.4 → 11.2 |
| | `cinder_lance` | 330 | 0.083 | 15.8 | 22.6% | 3.4 → 5.99 |
| | `slag_strike` | 274 | 0.200 | 5.6 | 6.7% | 2.4 → 2.53 |
| | `water_slap` | 455 | 0.000 | 2.0 | 3.9% | 1.2 → 0.75 |
| | `ignite` | 879 | 0.000 | 0.0 | 0%² | 0.5 → 0.9 |
| | `molten_core` | 464 | **0.300** | 0.0 | 0%² | 2.6 → 2.2 |
| | **`ash_communion`** | 78 | **0.700** | 0.0 | 0% | **10.6 → 6.1** |
| **skoll_v1** | `fire_punch_v2` | 824 | 0.125 | 13.5 | 41.9% | 3.0 → 5.65 |
| | `fury_strike` | 643 | 0.269 | 10.6 | 25.7% | 3.0 → 4.54 |
| | `brute_force` | 408 | 0.142 | 13.2 | 20.2% | 3.1 → 5.51 |
| | `water_slap` | 476 | 0.003 | 3.5 | 6.2% | 1.2 → 1.82 |
| | `adrenaline` | 329 | **0.578** | 4.8 | 5.9% | 2.7 → 2.82 |
| | `core_overclock_daemon` | 207 | **0.425** | 0.0 | 0% | 0 → 0 |
| **skoll_v2** | `fire_punch_v2` | 867 | 0.096 | 10.5 | 39.2% | 3.0 → 4.47 |
| | `fire_poke` | 540 | 0.181 | 6.4 | 15.0% | 2.7 → 3.43 |
| | `cinder_slash` | 464 | 0.250 | 6.0 | 12.0% | 2.4 → 2.77 |
| | `scorch` | 319 | 0.029 | 7.2 | 9.9% | 6.5 → 7.23 |
| | `water_slap` | 506 | 0.000 | 2.7 | 5.9% | 1.2 → 1.53 |
| | `ignite` | 342 | 0.038 | 0.0 | 0%² | 0.5 → 1.0 |

² A pure Burn applier's output lands in the residual row, not in its own attribution.

**Reading it:** three of the four decks are carried by one or two cards. `ragnarok_edge` is over
half of fenrir_v1 on its own. `fire_punch_v2` — a plain 30-power card with no text — is the top
damage source in **both** skoll decks. And **`skoll_v1`'s highest-dead card is `adrenaline` at
57.8%**, with the daemon second at 42.5%.

---

## Q2 — `scorch`: how much of it lands?

> **Data discrepancy, flagged not corrected:** the ticket describes `scorch` as **"2e, 4 Burn"**.
> The card in the registry is **2e, 25 power, 3 Burn**. All measurements below are of the 3-Burn
> card that exists.

| | measured |
|---|---|
| casts | 85 (over 80 games) |
| stacks requested | 255 (3 × 85 ✓) |
| **stacks landed** | **219 — 2.58 of 3 per cast** |
| **stacks wasted at the cap** | **36 (14.1%)** |
| **overflow damage delivered** | **0** |
| direct damage / cast | 6.9 |

`scorch` is the *least* wasteful Burn card in the game — it applies 3 at once, usually to a clean
target. Its problem is not overflow; at 6.9 direct damage plus roughly 2.6 stacks of DoT it is a
2-Energy card competing with `fire_punch_v2` (1e, 10.5 direct).

**The whole Burn suite, per card:**

| card | deck | casts | requested | landed | **wasted** | overflow dmg |
|---|---|---|---|---|---|---|
| **`molten_core`** | fenrir_v2 | 119 | 450 | 162 | **288 (64.0%)** | 0 |
| `ignite` | fenrir_v2 | 226 | 226 | 176 | 50 (22.1%) | 0 |
| `pyre_sacrifice` | fenrir_v2 | 101 | 576 | 452 | 124 (21.5%) | 0 |
| `ignite` | skoll_v2 | 100 | 100 | 79 | 21 (21.0%) | 0 |
| `fire_poke` | skoll_v2 | 171 | 167 | 140 | 27 (16.2%) | 0 |
| `scorch` | skoll_v2 | 85 | 255 | 219 | 36 (14.1%) | 0 |

**`molten_core` throws away 64% of what it applies** — it is the worst-wasting card in the
registry. It applies 2 Burn, or 4 when Fenrir holds Sharp, into a 3-stack ceiling that
`ignite` and `pyre_sacrifice` are already filling.

---

## Q3 — `ash_communion`: why is it dead?

**Not unaffordable-first. Outbid-first.** Over 80 games it was in hand on **281 player turns**:

| outcome | turns | share |
|---|---|---|
| **outbid** — affordable, legal, AI chose another card | **144** | **51%** |
| unaffordable — 2 Energy on a 2-Energy frame | 107 | 38% |
| **blocked by a constraint** | **0** | **0%** |
| cast | 26 | 9% |

**Neither known trap regressed.** Zero constraint failures means the condition path is clean, and
all 26 casts resolved to a real heal, so the lifesteal-targeting fix (ticket 28) still holds for
it — it self-targets correctly.

**What it delivers when cast: 7.3 HP.** On fenrir's 66-max-HP frame `calculateHeal` gives
`66 × 30 / 400 = 4.95 HP per stack consumed`, so **7.3 HP is about 1.5 stacks**. The scorer prices
it at `ASSUMED_STATUS_COUNT = 3` stacks — hence 10.6 against a 6.5 band, **the loudest card redline
in the registry** — and the deck supplies half that.

**Why the deck cannot supply 3:** `ash_communion` consumes **Fenrir's own** Burn. Of his three Burn
cards, `ignite` and `molten_core` apply Burn to the **target**. Only `pyre_sacrifice` self-burns
(3 stacks), and it is cast 101 times against `ash_communion`'s 78 draws — they do not reliably
co-occur. The card is priced for a self-Burn engine the deck does not run.

---

## Q4 — TREACHERY_KERNEL feed rate (HANDOFF item 7), re-measured

80 games of skoll_v1 at current pace (4.13-turn games):

| | measured | cap |
|---|---|---|
| peak Strengthened, ever | **25** | — |
| mean game peak | **9.78** | — |
| mean stacks held per turn | 4.78 | — |
| **games peaking above the CORE_OVERCLOCK scaler cap (8)** | **46 / 80 (57.5%)** | `STRENGTH_STACK_CAP = 8` |
| games peaking above the damage cap (12.5) | 17 / 80 (21.3%) | 2%/stack to a 25% ceiling |

HANDOFF item 7 recorded "13.7 stacks in 3.4-turn games". At today's pace the **mean** game peak is
**9.78** — below the 12.5 damage cap — but **the binding ceiling in practice is the 8-stack
CORE_OVERCLOCK scaler, exceeded in 57.5% of games.** The over-feed is real; it is the daemon's
scaler that is being wasted, not primarily the status cap.

Consistent with that: `core_overclock_daemon` sits at **42.5% dead** in hand.

---

## Q5 — fenrir_v1's "silent recovery" did not happen

Nothing touched fenrir or the control between the ticket-49-era reading (**0.29** control-wins) and
the post-ticket-55 floor re-read (**0.194**), which is what moved it across the 0.25 floor line.

**Measured on the identical, untouched matchup:**

| read | control-wins |
|---|---|
| **150 iterations** | **0.205** (297 decided) |
| 50 iterations, seed base *a* | 0.255 |
| 50 iterations, seed base *b* | 0.235 |
| 50 iterations, seed base *c* | **0.182** |
| 50 iterations, seed base *d* | 0.232 |
| 50 iterations, seed base *e* | **0.283** |
| | **spread 0.101** |

**The 0.29 → 0.194 "recovery" is smaller than the spread between two seed bases on the same
matchup.** fenrir_v1 did not move; the floor list's 0.25 threshold runs straight through its
sampling distribution, so its membership flips with the seed.

`fenrir_v2` at 150 iterations reads **0.387** — comfortably above the line, so its floor-list
membership is real.

---

## Q6 — Burn's systemic ceiling, roster-wide

Every deck that applies Burn, all opponents:

| deck | applications | requested | landed | **wasted** | wasted % | overflow dmg |
|---|---|---|---|---|---|---|
| **fenrir_v2** | 14,202 | 26,667 | 12,313 | **14,354** | **53.8%** | **0** |
| skoll_v2 | 7,652 | 10,020 | 8,051 | 1,969 | 19.7% | **0** |
| hraesvelgr_v2 | 10,148 | 13,286 | 12,034 | 1,252 | 9.4% | **0** |
| draugr_v2 | 2,397 | 4,794 | 4,794 | 0 | 0.0% | **0** |
| **TOTAL** | 34,399 | **54,767** | 37,192 | **17,575** | **32.1%** | **0** |

**A third of all Burn played in the game is thrown away, and not one point of overflow damage was
delivered in 54,767 requested stacks.** `BURN_OVERFLOW_PERCENT = 0.01` × a 66–95 HP frame floors to
zero; the mechanic only starts paying at 100+ max HP, which no current frame reaches.

**This bounds any "more Burn" design.** fenrir_v2 already applies 26,667 stacks to land 12,313 —
adding application rate to that deck buys nothing.

---

## Q7 — pace context

From `roster-census.md` (100 seeds × 2 orders per species):

| species | first-mover edge | mirror length | field (30-iteration) |
|---|---|---|---|
| fenrir | +7.8% | 5.16 turns | v1 29.1% · v2 25.7% |
| **skoll** | **+24.5%** | **3.73 turns** | v1 36.9% · v2 24.2% |

**`skoll` holds the roster's largest first-mover edge, and it is the only species above the +20%
diagnostic flag in the positive direction.** Its 3.73-turn mirror is the third-shortest in the
roster — the same fast-mirror/large-edge pattern the census identified.

---

## Questions for Henry

1. **Is the Burn cap the design, or the bug?** 32.1% roster-wide waste with a zero-paying overflow
   is either an intentional ceiling on a status that bypasses defence, or a silent tax on every
   Fire deck. The code comment says the zero is deliberate headroom for 100+ HP frames; no current
   frame reaches 100.
2. **`molten_core` at 64% waste** — is that a card problem, a sequencing problem (it is cast into a
   ceiling `ignite` already filled), or the intended cost of an OS that pays Sharp per Burn applied
   regardless of whether the stack lands?
3. **`ash_communion` is priced for a self-Burn deck fenrir_v2 does not run.** Does the card change,
   the deck change to feed it, or the scorer stop assuming 3 stacks for `STATUS_CONSUMED`?
4. **TREACHERY over-feeds the 8-stack scaler in 57.5% of games**, not primarily the 12.5-stack
   damage cap. Is the fix the feed rate, the scaler cap, or the daemon that reads it (42.5% dead)?
5. **The floor list's 0.25 line is not stable at 50–100 iterations** — fenrir_v1's membership flips
   on the seed base alone. Should floor-list membership be decided at 150 iterations, or should the
   line have a hysteresis band?
6. **`fire_punch_v2` — a plain 30-power card with no text — is the top damage source in both skoll
   decks.** Is that a Fire identity problem worth naming before any Burn work?
