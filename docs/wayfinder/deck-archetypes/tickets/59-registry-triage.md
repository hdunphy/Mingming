# Registry triage (ticket 59): annotate the 53 orphans for Henry's deletion review

- Type: wayfinder:task — suitable for a lower-tier model. ANNOTATION ONLY: no deletions,
  no card edits, no deck edits, no commits beyond the annotated document itself.
- Status: **open**
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
