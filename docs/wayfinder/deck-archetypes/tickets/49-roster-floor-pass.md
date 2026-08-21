# The decks that lose to the floor — a roster-wide pass

- Type: wayfinder:task
- Status: **open** — still a backlog record, not an implementation. Nothing here has been actioned.
  **The numbers are now current:** regenerated 2026-08-12 at registry `1:e2f392b8`, after ticket 53
  completed the last element. §4's question is ANSWERED.
- Assignee:
- Blocked by: **nothing any more.** Henry's sequencing was ymir → [51-cleanse-rework](51-cleanse-rework.md)
  → this, and all three have landed. Every species has had its deck pass. Ready to be worked.

*The original numbers were read from the committed report at **`cfa4306`, registryHash `1:4d47138a`** —
the first run in which the gauntlet measured both firmwares (ticket 47 §"The gauntlet only ever
measured `availableOS[0]`"). **This file exists so those numbers survive the conversation that
produced them,** which is why they are kept below rather than overwritten.*

---

> **REGENERATED 2026-08-12 at registry `1:e2f392b8`.** §2 and §3 below are the ORIGINAL readings at
> `cfa4306`, kept because the priority order was argued from them. **The current numbers are in §2b,
> §2c and §3b, and those are the ones to tune against.** Ticket 51 (retiring the control's cleanse)
> is what invalidated the originals; §4 records what that measurement found.

## 1. Why this ticket exists

Ticket 47 extended the archetype gauntlet to every firmware slot and found that **half the roster had
never been measured against the control floor at all.** The result is a list of decks that lose to a
deck with no firmware and every card exactly on curve — and §2.3 cannot see any of it, because it
reports the *gap* between two firmwares and is blind to where either one sits.

Ticket 45 set the control as the FLOOR at ~0.235, so **read any number above ~0.25 as "this deck is at
or below the worst deck in the game."**

## 2. The table — control's win rate against every deck *(ORIGINAL, `cfa4306`)*

| species | tuned? | ctrl vs slot 1 | ctrl vs slot 2 |
|---|---|---|---|
| **jormungandr** | tuned | **0.71** | **0.99** |
| valkyrie | placeholder | 0.94 | 0.95 |
| **hel** | tuned | 0.07 | **0.94** |
| ~~draugr~~ | **tuned, ticket 48** | ~~0.79~~ → **0.00** | ~~0.77~~ → **0.07** |
| **sköll** | tuned | 0.20 | **0.64** |
| **kraken** | tuned | 0.20 | **0.53** |
| **ratatoskr** | tuned | 0.00 | **0.50** |
| **fenrir** | tuned | 0.30 | 0.44 |
| **hræsvelgr** | tuned | 0.30 | 0.00 |
| **huldra** | tuned | 0.09 | 0.17 |
| **sleipnir** | tuned | 0.08 | 0.01 |
| **nidhoggr** | tuned | 0.08 | 0.00 |
| fafnir | placeholder | 0.00 | 0.01 |
| ymir | placeholder | 0.00 | 0.00 |
| gullinbursti | placeholder | 0.00 | 0.00 |
| audhumbla | placeholder | 0.00 | 0.00 |

Aggregates *(at `cfa4306`; ticket 48 moved them to 0.185 / 0.323 / 0.254)*: **slot 1 = 0.235** (ticket 45 calibrated the control to 0.237 against exactly this set, so
the floor is still where it was put), **slot 2 = 0.367**, pooled 0.301.

**Six TUNED decks are at or above the floor**, in priority order (draugr's two were a seventh and an
eighth until ticket 48 closed them):

1. **jormungandr_v2 (0.99) and jormungandr_v1 (0.71)** — the only tuned species where *both* decks
   lose, and the only one outside the working §2.3 band (0.240). The obvious first target.
2. **hel_v2 (0.94)** — the uncomfortable one. Hel shipped in ticket 36 passing every first-pass band,
   and every one of those bands was blind to this. Suspect the UNDERWORLD_GATEWAY HP toll against a
   slow opponent: ticket 38 measured 61% mutual kills, reduced to 35%, and a deck that pays HP for
   cards has no way to win a long game it cannot end.
3. **sköll_v2 (0.64)** — TREACHERY_KERNEL over-feeding is a standing open item (HANDOFF 7).
4. **kraken_v2 (0.53)**
5. **ratatoskr_v2 (0.50)** — diagnosed in ticket 47 and deliberately left: it is the *weaker* of
   ratatoskr's two decks against the field (0.416 vs 0.469) and nerfing it to satisfy §2.3 would have
   made this worse. Fixing it means raising it, not lowering v1.
6. **fenrir_v2 (0.44)** — also holds `ash_communion` at 7.10 against a 6.5 band.

**And the opposite problem is now on the list too.** Ticket 48 took draugr from 0.79/0.77 to
0.00/0.07 — from one of the roster's weakest species to one of its strongest, at **0.573 against the
field** for v1 (ratatoskr_v1 is 0.469). Every first-pass gate passes, so it shipped; but a floor pass
that only ever pushes decks UP will end with a roster the control cannot discriminate at all. Record
field numbers, not just control numbers.

## 2b. The same table, regenerated at `1:e2f392b8` (2026-08-12)

Every species is now tuned — there are no placeholder rows left, so unlike the original table every
number here is balance signal.

| species | ctrl vs slot 1 | ctrl vs slot 2 | change | was |
|---|---|---|---|---|
| **hel** | 0.04 | **0.81** | ↓ 13 pts on v2 | 0.07 / 0.94 |
| **jormungandr** | **0.71** | 0.04 | **v2 collapsed, v1 did not move** | 0.71 / 0.99 |
| **sköll** | 0.20 | **0.61** | | 0.20 / 0.64 |
| **kraken** | 0.20 | **0.53** | unchanged, both slots | 0.20 / 0.53 |
| **fenrir** | **0.29** | **0.45** | | 0.30 / 0.44 |
| **hræsvelgr** | **0.30** | 0.00 | unchanged | 0.30 / 0.00 |
| sleipnir | 0.08 | 0.01 | | 0.08 / 0.01 |
| fafnir | 0.00 | 0.06 | *(ticket 52)* | 0.00 / 0.01 |
| ratatoskr | 0.00 | 0.02 | **↓ from 0.50** | 0.00 / 0.50 |
| draugr | 0.01 | 0.00 | *(ticket 48)* | 0.79 / 0.77 |
| huldra | 0.00 | 0.00 | | 0.09 / 0.17 |
| nidhoggr | 0.00 | 0.00 | | 0.08 / 0.00 |
| gullinbursti | 0.00 | 0.00 | *(ticket 52)* | 0.00 / 0.00 |
| ymir | 0.00 | 0.00 | *(ticket 50)* | 0.00 / 0.00 |
| **valkyrie** | **0.00** | **0.00** | **↓ from 0.94 / 0.95** *(ticket 53)* | 0.94 / 0.95 |
| audhumbla | 0.00 | 0.00 | *(ticket 53)* | 0.00 / 0.00 |

Aggregates: **slot 1 = 0.114** (was 0.235), **slot 2 = 0.158** (was 0.367), **pooled 0.136** (was
0.301), over 3200 games. FTK **0/3200**.

**The list is down from eight to seven, and its composition changed completely.** Ranked:

1. **hel_v2 — 0.81.** Still the worst, and now the only deck the control beats outright. It was
   0.94; ticket 51's cleanse removal took 13 points off, and §2's diagnosis (the UNDERWORLD_GATEWAY
   HP toll against an opponent it cannot end) is still unaddressed.
2. **jormungandr_v1 — 0.71.** **The interesting change.** The original table read this species as
   "the only tuned species where *both* decks lose", 0.71 and 0.99, and made it the obvious first
   target. Ticket 51 took **v2 from 0.99 to 0.04** without anyone touching jormungandr — the cleanse
   WAS the reading — while **v1 did not move at all.** The priority was half instrument artifact and
   half real, and the real half is v1 alone.
3. **sköll_v2 — 0.61.** Barely moved (was 0.64). TREACHERY_KERNEL over-feeding, HANDOFF item 7.
4. **kraken_v2 — 0.53.** **Did not move by a single game.** Not a status deck, so ticket 51 had
   nothing to give it. The cleanest genuinely-real entry on the list.
5. **fenrir_v2 — 0.45** and **fenrir_v1 — 0.29.** Both essentially unmoved.
6. **hræsvelgr_v1 — 0.30.** Unmoved.

**The floor moved down, not just the decks.** Slot-1 aggregate fell 0.235 → 0.114, and ticket 45
calibrated the control TO 0.237 against the then-roster. The control now beats the roster half as
often as it was built to — partly ticket 51 taking its cleanse, partly six species having had deck
passes since. **Before tuning anything on this list, decide whether the floor still sits where ticket
45 put it**, because "loses to the control" means something different at 0.114 than it did at 0.235.

## 2c. Field round robin — the check §2 asked for and never got

§2 closes with *"Record field numbers, not just control numbers"*, because a floor pass that only
ever pushes decks UP ends with a roster the control cannot discriminate. Here is that table: every
deck against all fifteen other species, 10 seeds × 2 turn orders per pairing (~300 decided games
each), at `1:e2f392b8`.

| deck | field | | deck | field |
|---|---|---|---|---|
| **valkyrie_v2** | **93.7%** | | hraesvelgr_v1 | 48.0% |
| hraesvelgr_v2 | 86.3% | | gullinbursti_v2 | 46.0% |
| ymir_v2 | 85.0% | | sleipnir_v2 | 45.3% |
| nidhoggr_v1 | 83.3% | | ratatoskr_v1 | 42.7% |
| ymir_v1 | 79.3% | | skoll_v1 | 37.0% |
| nidhoggr_v2 | 73.7% | | hel_v1 | 36.3% |
| audhumbla_v1 | 69.0% | | fafnir_v2 | 34.3% |
| gullinbursti_v1 | 62.3% | | kraken_v1 | 33.0% |
| huldra_v1 | 59.0% | | draugr_v2 | 32.7% |
| valkyrie_v1 | 56.3% | | fafnir_v1 | 31.7% |
| ratatoskr_v2 | 52.3% | | hel_v2 | 28.2% |
| huldra_v2 | 49.0% | | fenrir_v1 | 28.1% |
| draugr_v1 | 49.0% | | fenrir_v2 | 27.7% |
| sleipnir_v1 | 48.3% | | kraken_v2 | 26.7% |
| | | | skoll_v2 | 25.8% |
| | | | jormungandr_v1 | 25.0% |
| | | | audhumbla_v2 | 24.3% |
| | | | **jormungandr_v2** | **9.0%** |

**Three readings the control table cannot give you:**

- **The two tables disagree about jormungandr_v2.** Ticket 51 took its control number 0.99 → 0.04 —
  it now clears the floor comfortably — and it is nonetheless **dead last in the roster against the
  field, at 9.0%.** The control is a status-vulnerable deck; the field is not. **Fixing a control
  number does not fix a deck.** Same lesson as ticket 47's ratatoskr counter, and the strongest
  argument in this ticket for reading both tables together.
- **The spread is 9.0% to 93.7%, and the top is not where the control says it is.** `valkyrie_v2`
  and `hraesvelgr_v2` beat the control 100% AND the field ~90%. The control cannot tell them apart
  from `audhumbla_v2`, which also beats it 100% and manages 24.3% of the field.
- **Four decks clear the floor and sit in the bottom quartile of the field** — `audhumbla_v2` 24.3%,
  `fafnir_v1` 31.7%, `draugr_v2` 32.7%, `kraken_v1` 33.0%. That is exactly the failure mode §2
  predicted when it asked for this table.

## 3. §2.3 and mirrors at the same commit, for context *(ORIGINAL, `cfa4306`)*

| species | §2.3 | mirror turns | decided | dead v1 / v2 |
|---|---|---|---|---|
| kraken | 0.550 | 5.2 | 400/400 | 9.6% / 13.8% |
| **jormungandr** | **0.240** | 6.4 | 400/400 | 7.4% / 24.2% |
| sleipnir | 0.330 | 4.5 | 400/400 | 16.8% / 14.8% |
| hræsvelgr | 0.310 | 3.2 | 400/400 | 4.2% / **48.4%** |
| fenrir | 0.400 | 5.1 | 380/400 | 27.8% / 23.6% |
| sköll | 0.640 | 3.7 | 400/400 | 33.1% / 20.0% |
| ratatoskr | 0.510 | 4.6 | 400/400 | 3.3% / 5.9% |
| huldra | 0.370 | 7.3 | 400/400 | 1.0% / 2.3% |
| hel | 0.609 | 5.4 | 400/400 | 25.4% / 34.2% |
| nidhoggr | 0.320 | 4.5 | 400/400 | 12.9% / 10.3% |

**jormungandr at 0.240 is the only tuned species outside the working 0.30–0.70 band.**

**`hræsvelgr_v2` sits at 48.4% dead cards**, past the 0.35 per-side bar, and it is *unchanged across
tickets 46 and 47* — so it is a silent regression from some earlier ticket, not new. HANDOFF still
claims ticket 28 closed that breach to 4.0%; that line is stale. **The suite reports dead cards without
redlining them (§2.2 gives no threshold), which is why nobody noticed.** Worth deciding whether the
per-side 0.35 bar should become an actual redline.

## 3b. §2.3, mirrors and dead cards regenerated at `1:e2f392b8`

| species | §2.3 | in 0.30–0.70? | mirror turns | decided | dead v1 / v2 |
|---|---|---|---|---|---|
| kraken | 0.550 | yes | 5.2 | 400/400 | 9.6% / 13.8% |
| **jormungandr** | **0.240** | **NO** | 6.4 | 400/400 | 7.4% / 24.2% |
| sleipnir | 0.330 | yes | 4.5 | 400/400 | 16.8% / 14.8% |
| hræsvelgr | 0.310 | yes | 3.2 | 400/400 | 4.2% / **48.4%** |
| fenrir | 0.400 | yes | 5.1 | 380/400 | 27.8% / 23.6% |
| sköll | 0.640 | yes | 3.7 | 400/400 | **33.1%** / 20.0% |
| ratatoskr | 0.310 | yes | 4.6 | 400/400 | 2.1% / 6.2% |
| huldra | 0.370 | yes | 7.3 | 400/400 | 1.0% / 2.3% |
| hel | 0.598 | yes | 5.4 | 400/400 | 25.6% / **34.2%** |
| nidhoggr | 0.320 | yes | 4.5 | 400/400 | 12.9% / 10.3% |
| draugr | 0.340 | yes | 6.3 | 400/400 | 18.1% / 10.3% |
| ymir | 0.620 | yes | 14.1 | 400/400 | 11.0% / 27.7% |
| fafnir | 0.606 | yes | 6.5 | 400/400 | 25.8% / 18.6% |
| gullinbursti | 0.490 | yes | 10.1 | 400/400 | 10.1% / 6.3% |
| **valkyrie** | **0.170** | **NO** | 13.6 | 400/400 | 5.5% / 0.6% |
| **audhumbla** | **0.000** | **NO** | 13.1 | 400/400 | 3.8% / 8.2% |

**Three species are outside the working band, not one.** jormungandr 0.240 is unchanged from the
original reading; valkyrie 0.170 and audhumbla 0.000 arrived with ticket 53, both with their knob
budgets already spent. See ticket 53 §7 for the diagnoses — audhumbla's is a **unit error** in
NOURISH_ROUTINE's dial (it converts a percentage of heal POWER, while the engine converts power to HP
at `maxHp × power / 400`), not a tuning miss, so no percentage knob can close it.

**`hræsvelgr_v2` is still at 48.4% dead cards.** It has now survived tickets 46, 47, 48, 50, 51, 52
and 53 unread, which is this ticket's own argument for making the per-side bar an actual redline.
**The deck report can now name the cards, which the deck-level ratio never could:** `tailwind` 79%
dead, `cinder_gust` 58%, `zephyr_strike` 56%, `firestorm_talon` 55%.

**Every mirror on the roster now decides.** `mirror:audhumbla` was the last stall and ticket 53 closed
it (61.0 turns / 0-of-400 → 13.1 turns / 400-of-400). No `TURN_COUNT` redline exists any more.

## 4. Henry's open question: is the control's cleanse inflating its wins?

**ANSWERED — the cleanse WAS carrying almost the whole reading, and it was specific rather than
general.** Ticket 51 removed the confound rather than measuring it (`baseline_purge`'s CLEANSE became
a Poison/Burn shed, and cleanse stopped being printable on any card), and the per-deck before/after
this section asked for was run:

- **jormungandr_v2 0.99 → 0.04.** **ratatoskr_v2 0.50 → 0.02.** **hel_v2 0.94 → 0.81.**
- **26 of 32 decks moved by ±0.01 or less.**
- Slot-2 aggregate fell **0.326 → 0.219** while slot 1 barely moved (0.185 → 0.174). At `1:e2f392b8`,
  after six further deck passes, they are 0.158 and 0.114.

**So the worry was right, but narrower than feared: the floor was not a status-deck hoser across the
board — it was a hoser of the two decks whose entire plan is stacking a removable status.** Everything
else was reading its real strength. The consequence for this ticket is §2b's item 2 — jormungandr's
priority was half artifact — and §2b's item 4, `kraken_v2` at 0.53 having moved by zero games, which
makes it the entry that was always real.

The reasoning below is preserved because it is why the question was worth asking, and it stands.

`baseline_purge` (2e, 30 power + CLEANSE) went into the control in ticket 45, deliberately at 2 Energy
so it would be "a real answer at a real price" rather than a hard counter to poison. Ticket 47 found
evidence that the price is not doing the work:

- Against ratatoskr_v2 the AI played `baseline_purge` **1.89 times a game against 0.68** versus
  ratatoskr_v1, and `slander`'s Dazed-at-cast fell from a median of 13 to 9 with damage per play
  dropping 16.2 → 7.8. The control **beat** ratatoskr_v2 while losing 100% to v1.
- Ticket 47 separately measured that a full cleanse is a **switch, not a dial** — giving ratatoskr_v1
  a `purify` swung that matchup 0.21 → 0.65 with nothing in between.

**The worry, stated plainly: if the control's cleanse is a hard counter to every status deck, then the
floor is not a floor — it is a status-deck hoser, and every "this deck loses to the control" reading
in §2 above is inflated for the status decks specifically.** Note the shape of the table is consistent
with that: the decks the control beats skew toward debuff-based plans.

The experiment that was designed to settle it, kept because ticket 51 ran the equivalent of step 1
by removing the card rather than swapping it, and the answer came out at step 2:

1. Re-run the gauntlet with `baseline_purge` swapped back to `baseline_slam` (its ticket-45
   predecessor). Compare per-deck, not just the aggregate.
2. If the status decks move and the rest do not, the cleanse is the confound. **They did, and it
   was — two of them, by 95 and 48 points, against ±0.01 for 26 of 32.**
3. Options if it is: price the cleanse out of the control entirely (the control is meant to be the
   worst deck, not a well-built one); make it a *partial* shed like ticket 47's `shrug_off`, which
   is a dial rather than a switch; or keep it and recalibrate the floor knowing what it is.
   **Ticket 51 took option two** — `baseline_purge` is now a Poison/Burn shed — **and option three
   is now unavoidable anyway**, because §2b shows the floor has moved to 0.114 regardless.

**The standing warning still applies to every OTHER instrument in the suite:** do not re-tune a deck
against a number until you know what the number is measuring, or a deck gets nerfed for losing to an
instrument artifact — precisely the ticket-39 nidhoggr mistake. §2c exists so the control is never
again the only instrument in the room.

## 5. Related standing items

- **`ash_communion` 7.10 / 6.5**, in fenrir_v2. Wants the fenrir polish pass (open since ticket 43).
  The deck report now shows it is also **71% dead in hand** — the deck does not want it either.
- **`umbral_feast` now reads under its 1e floor** at 2.00 after ticket 47's removal cap. A reading,
  not a defect.
- **TREACHERY_KERNEL over-feeds** — peak Strength 13.7 stacks in 3.4-turn games against a 12.5 cap
  (HANDOFF 7). Likely part of any sköll_v2 pass.
- **A standardised balance report — BUILT** (tickets 25/26, `npm run balance:deck`). This ticket was
  the strongest argument for it, and the first full 32-deck run confirms the argument: the deck
  report names `tailwind` at 79% dead inside hræsvelgr_v2's 48.4%, which is the card the deck-level
  number was hiding. It also surfaces things nothing else reports — 21 `POWER_DIVERGENCE` rows where
  a card's measured value is far from its static score (`hexbloom` prices 6.3 and measures 63.0 in
  huldra_v1; `wither_feast` prices **−1.8** and measures 12.8 in nidhoggr_v1), and **3 FTKs each for
  hel_v1 and hel_v2 over 480 games**, which the balance suite's 100-game sample reports as 0.
  HANDOFF's "reduced, not eliminated, ~1.6%" line now measures at ~0.6%.

## 6. What a first work session on this ticket should do

Nothing here has been actioned, and the regeneration changes what the first move should be:

1. **Decide where the floor is** before tuning anything, per §2b. The control now wins 11.4% of
   slot-1 games against the 23.7% ticket 45 calibrated it to. Either the control gets re-calibrated,
   or "loses to the control" gets redefined.
2. **Take `kraken_v2` first, not jormungandr.** It is the only entry on the §2b list that moved by
   zero games across every ticket since the original reading, so it is the one with no instrument
   artifact in it at all.
3. **Read jormungandr as a FIELD problem, not a floor problem.** v2 clears the floor at 0.04 and is
   last in the roster at 9.0% of the field; v1 is 0.71 against the floor and 25.0% of the field. The
   species is weak in both directions, and §2.3 at 0.240 says the two decks are not even evenly weak.
4. **Make the 0.35 per-side dead-card bar an actual redline.** Three sides are at or over it right
   now — hræsvelgr_v2 48.4%, hel_v2 34.2%, sköll_v1 33.1% — and the suite reports all three without
   flagging any.
