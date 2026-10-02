# Registry triage (ticket 59): annotate the 53 orphans for Henry's deletion review

- Type: wayfinder:task — suitable for a lower-tier model. ANNOTATION ONLY: no deletions,
  no card edits, no deck edits, no commits beyond the annotated document itself.
- Status: **closed** (2026-09-08)
- Assignee: —
- Blocked by: none. Input: `research/registry-inventory.md` (exists — ticket 55's Part 3
  deliverable, 53 cards in no deck, pre-sorted into draft-pool / retired twins / orphans).

## Task

For EVERY card in the inventory, produce one annotated line:

`id | name | cost/element | in-game text | static score vs band | recommendation | one-sentence rationale`

Recommendation is one of: **KEEP-DRAFT** (healthy draft/reward-pool card), **KEEP-FLAGGED**
(mechanically interesting for a future deck — daemons especially; say which archetype it
could serve), **RETIRED-TWIN** (the ticket-04 poke twins — keep, they are supposed to be
here), **KILL-CANDIDATE** (orphaned mechanic, enabler never shipped, or fully superseded —
say by what), or **REWORK-CANDIDATE** (the mechanic is sound but the numbers/element
placement are stale; name the mismatch).

Rules: read each card's actual JSON (do not trust the inventory's summaries); check
whether anything references it (hooks, GENERATE_CARD, moves, boss relics) before calling
it a KILL-CANDIDATE — a referenced card is never a kill; `shatter` and `capacitor` are
documented intentional keeps (ticket 50 / ticket 55); when unsure, KEEP-FLAGGED with a
question mark, never guess toward KILL.

## Deliverable

Append the annotated table to `research/registry-inventory.md` under a "## Triage
(ticket 59)" heading, flip this ticket closed, ONE commit, author
`Henry Dunphy <hdunphy15@gmail.com>`, CRLF for the research file. Henry reviews the
KILL-CANDIDATE and REWORK-CANDIDATE rows; the deletion itself will be its own ticket
after his sign-off.

## Outcome (2026-09-08)

Table appended to `research/registry-inventory.md` under "## Triage (ticket 59)". Two
findings change the ticket's own premise:

1. **The inventory's list was stale.** Re-derived from the shipped JSON: the registry is
   239 cards (was 213), and **71** non-token cards sit in no deck, not 53.
2. **Nothing is unreachable, so there are no KILL-CANDIDATE rows.** `isRewardable` is true
   for all 71. Henry's 2026-08-28 ruling made `rewardCardPool` the party's ELEMENTS rather
   than its deck lists, and the sixteen playable species cover all eight real elements, so a
   card in no deck is draft-pool content by construction. The premise for deletion is gone;
   the follow-up deletion ticket the Deliverable anticipates is not needed.

Counts: KEEP-DRAFT 32, KEEP-FLAGGED 19, RETIRED-TWIN 3, REWORK-CANDIDATE 17, KILL-CANDIDATE 0.

One row needs a ruling beyond a number: `core_overclock_daemon` carries three contradictory
self-descriptions (card text "+20% per stack, max 8 stacks"; `hooks.json` "Strength bonus is
doubled"; engine `1 + 0.2n` UNCAPPED since 136h retired `STRENGTH_STACK_CAP`).
