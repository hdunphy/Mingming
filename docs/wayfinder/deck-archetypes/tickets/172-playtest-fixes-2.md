# Ticket 172: Follow-ups from the 2026-09-30 Emberfall playtest

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 172a–172f (`9fd5f2e..8612c83`). The status line below is kept as history.

**Type:** bug fixes, kit changes and one investigation. **Status:** RULED by Henry 2026-09-30, in progress.

**Source.** Henry's answers to the ticket 171 report, plus three new notes at the end of `playtest-results/2026-29-09/firefall-kraken_v2/notes.md` (he reached the gym and lost in gauntlet fight 2).

**Henry's rulings (2026-09-30), in his words:**

1. kraken_v2 kit: *"Capacitor is not good. I want another damaging card. Maybe something like venom fang just a 1e 30p card or maybe forage for card draw?"*
2. Tackle out of the shop too: *"This is fine, not buyable."*
3. END TURN nudge and 0e cards: *"I think it still should trigger."*
4. Every status-applying hook gets the separate beat: *"Yes."*
5. The starter screen: *"The text here like starter card and the descriptions don't make sense. Either remove them or replace them with better info. Something closer to our current assemble UI."*
6. Jormungandr: *"I think Jorm needs to replace the tackle. If we don't have one add a 0e poison card for both v1 and v2."*

New notes: *"I got a Nature Driver on my run with no nature mingmings"*, *"I can't revive, because I can't select my terminated mingming. So the revive macro doesn't work"*, *"I lost why do you think I lost?"*, and in chat: *"I lost two mingming's early on which made it impossible. One potential fix could be that between the gauntlet fights we heal some amount like 10%."*

One commit per row, test first, authored by Henry, no push.

| Row | What |
|---|---|
| 172a | Revive can target a downed ally |
| 172b | An Element Driver stake pays for an element the party fields |
| 172c | kraken_v2 kit: the second Capacitor becomes Surge Protection; Jormungandr's Tackle becomes Poison Injection (0e, Apply 1 Poison) in both decks |
| 172d | The END TURN nudge counts 0e cards |
| 172e | The starter screen shows each species' two firmware instead of the alpha's "starter card" |
| 172f | Investigation: was the gauntlet loss fair, and what would a heal between fights buy? A report and the harness, no game change |

---

## 172a: Revive can target a downed ally

Revive's targeting is `DOWNED_ALLY`, but the stage refuses every click on a unit at 0 HP, and an ally click selects a caster anyway. Its only legal target could never be picked, so the rack greyed it.

- New `ui/utils/macroTarget.ts`, used by both the rack and the fire handler: `ALLY` defaults to the firing unit (unchanged); `DOWNED_ALLY` takes the picked downed ally, or the first downed ally in party order; everything else needs a pick.
- With a Revive in the rack, clicking a downed ally picks it (how you choose when two are down).

## 172b: Element Driver stakes

Stakes are rolled at run creation from the biomes' elements, when the party is one body. An Element Driver stake for an element nobody on the team runs now pays the first member's primary element instead (`resolveDriverStake`). The map shows the resolved Driver for the team as it stands, so what the node says is what a win pays. The rolled stake on the node is unchanged.

## 172c: Kit changes

- **kraken_v2:** kit = capacitor, tide_pool, boiling_surge, scald, **surge_protection** (1e, 25 power, Water, refund rides on Tide Pool's draw). Added to the deck as a 9th card. `venom_fang` (30 power) is tagged a scalar and would make two payoffs against 157-r1; forage is 0e and deals no damage.
- **Jormungandr v1 and v2:** `tackle` → `poison_injection` in both decks and in v2's kit. The card already existed (from before collection v2); its text becomes "Apply 1 Poison." and it gets a design-record entry (enabler, Poison).

## 172d: The nudge counts 0e cards

`playsLeft` counts any card a living ally can cast, whatever it costs.

## 172e: The starter screen

The card drops the flavour line and "STARTER CARD: SQUIRT / SPICY BREATH / QUICK LEAF", and shows each firmware's name and one-line rule from the registry, the way the assembly bay's firmware picker does. The subtitle reads "CHOOSE YOUR FIRST MINGMING". Tightened so it fits 1280x800.

## 172f: The gauntlet loss

Replay of Henry's own gate state (party, IVs, firmware, patches, Drivers, 26-card deck) against the three fights his run rolls, HP carried between fights as the game does, no macros fired, at 0% and 10% heal between fights. Harness: `scratch/t172_gauntlet.ts`. Findings in `docs/balance/gauntlet-172.md`.

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`9fd5f2e..8612c83`), merged to `main` in PR #13.
