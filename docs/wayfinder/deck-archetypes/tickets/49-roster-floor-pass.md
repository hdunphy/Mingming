# The decks that lose to the floor — a roster-wide pass

- Type: wayfinder:task
- Status: **open** — this is a backlog record, not an implementation. Nothing here has been actioned.
- Assignee:
- Blocked by: the ymir deck pass, then [50-cleanse-rework](50-cleanse-rework.md) — ticket 50 changes
  the control deck, so every control number below is re-read after it lands. Henry's sequencing:
  ymir → 50 → this.

*Every number below was read from the committed report at **`cfa4306`, registryHash `1:4d47138a`** —
the first run in which the gauntlet measured both firmwares (ticket 47 §"The gauntlet only ever
measured `availableOS[0]`"). **This file exists so those numbers survive the conversation that
produced them.** Re-measure before acting: draugr moves in ticket 48 and ymir in the one after.*

---

## 1. Why this ticket exists

Ticket 47 extended the archetype gauntlet to every firmware slot and found that **half the roster had
never been measured against the control floor at all.** The result is a list of decks that lose to a
deck with no firmware and every card exactly on curve — and §2.3 cannot see any of it, because it
reports the *gap* between two firmwares and is blind to where either one sits.

Ticket 45 set the control as the FLOOR at ~0.235, so **read any number above ~0.25 as "this deck is at
or below the worst deck in the game."**

## 2. The table — control's win rate against every deck

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

## 3. §2.3 and mirrors at the same commit, for context

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

## 4. Henry's open question: is the control's cleanse inflating its wins?

**LARGELY SUPERSEDED by [ticket 50](50-cleanse-rework.md)** — Henry's answer was to remove the
confound rather than measure it: `baseline_purge`'s CLEANSE becomes a Poison/Burn shed, and cleanse
stops being printable on any card. **Run the before/after per-deck comparison anyway** when 50 lands;
it is the same measurement and it finally quantifies how much of this floor was cleanse. The
reasoning below is why that question was worth asking, and it stands.

**Raised by Henry, not yet measured. Do not tune any deck against a control number until 50 lands.**

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

Cheap experiment that settles it, and it needs no card changes:

1. Re-run the gauntlet with `baseline_purge` swapped back to `baseline_slam` (its ticket-45
   predecessor). Compare per-deck, not just the aggregate.
2. If the status decks move and the rest do not, the cleanse is the confound.
3. Options if it is: price the cleanse out of the control entirely (the control is meant to be the
   worst deck, not a well-built one); make it a *partial* shed like ticket 47's `shrug_off`, which is
   a dial rather than a switch; or keep it and recalibrate the floor knowing what it is.

**Do not re-tune any deck against a control number until this is answered** — otherwise a status deck
gets nerfed for losing to an instrument artifact, which is precisely the ticket-39 nidhoggr mistake.

## 5. Related standing items

- **`ash_communion` 7.10 / 6.5**, in fenrir_v2. Wants the fenrir polish pass (open since ticket 43).
- **`umbral_feast` now reads under its 1e floor** at 2.00 after ticket 47's removal cap. A reading,
  not a defect.
- **TREACHERY_KERNEL over-feeds** — peak Strength 13.7 stacks in 3.4-turn games against a 12.5 cap
  (HANDOFF 7). Likely part of any sköll_v2 pass.
- **A standardised balance report** is already listed in `map.md` as not-yet-specified and needs a
  grill-me session first. This ticket is the strongest argument for it: the gauntlet reported
  `hræsvelgr_v2` at 48.4% dead cards for several tickets and nobody read it.
