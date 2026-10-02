# Deck-archetypes ticket audit — 2026-09-07

149 files in `tickets/`. 102 are marked closed in their own status line. This audit reads the rest
against what has actually shipped since (tickets 131–148, the 141/143/144 write-backs, the two comp
grids) and recommends a disposition for each. Nothing here is applied — Henry flips the status
lines, or tells Legion to.

## 1. The ones Henry asked about

| # | title | what it is | recommendation |
|---|---|---|---|
| 05 | Team-battle OS-variance scenario design | Design the 2v2/3v3 measurement for the three firmwares that were dead at 1v1 (valkyrie_v1/v2, one more) | **Close — superseded.** 98 built the 3v3 sim, 112 measured firmware at width, 140/141 measured every EA OS at width, and both valkyrie OSes were reworked (53/56/61). Nothing left to design. |
| 37 | Resource conversion | Design law: *a card that does nothing for an OS must do something else.* Concrete case: hel_v2 zeroed Energy, so Energy cards were blank for her | **Close — premise gone.** 57 rebuilt UNDERWORLD_GATEWAY as "Dark spells cost HP, 25% cap a turn"; her non-Dark cards spend Energy again, so Energy cards are not blank. The Energized→heal hook was never shipped and is not needed. **Keep the law** — it belongs in HANDOFF's design principles if it is not already there. |
| 49 | Roster floor pass | Backlog of decks that lost to the control floor, numbers from 2026-08-12 | **Close — superseded.** Every deck listed got its pass (55, 57, 64, 82, 136); the current instrument is the deck grid (76/85) and the roster is 32/32 in band. |
| 54 | Deep-phase queue | The 2026-08-12 priority list: jormungandr, Light polish, hel_v2, Fire pair, kraken_v2, winners' dead cards | **Close — done.** Items 1–6 became tickets 55, 56, 57, 58/64, 82 and 81 respectively; all closed. |
| 59 | Registry triage | Annotate the 53 orphan cards (in no deck) for Henry's deletion review; `research/registry-inventory.md` exists | **Keep — still true, and it matters more now.** Orphans reach players as run drops, and 148 says every added card is a power cost, so a stale orphan is a trap. Lower-tier job, no design. Do it before 148's policy arms so the reward pool is honest. |
| 63 | Firmware payoff power-rate census | Report-only: what a printed "power" on an OS payoff is worth per frame (61 found 0.19 HP/power vs the 0.30 folklore) | **Keep, but fold into one scorer ticket** with 119, 120, 121 and 130 (§3, "149"). All five are the same complaint: `powerscale` prices things by constants that were never measured. |
| 96 | Fenrir berserk range | Raise the below-50% threshold and add a recoil enabler | **Close — superseded.** 136 rebuilt fenrir_v1 (OS 2 Str + recoil, missing-HP scaler), 143 fixed his two attacks, he is 54.8 at 1v1 and the strongest Fire pair at 3v3. The threshold idea can come back through 148 if progression wants it. |
| 98 | Team-sim skeleton + canary | Build the 3v3 runner, the caster-owner rule, a canary suite | **Close — delivered.** `teamScenario`, `runPairedBatch`, STAB-by-caster, `teamcanary.ts`, and the comp grid all exist and have been used for three grids. |
| 108 | Pipeline optimization | "The 3-hour run becomes minutes" | **Close — done in two pieces.** `research/three-tier-ai.md` (1.9×, process pool, cell cache) and 144 (2.1× on exact rows, beam ladder). The remaining optional rows live in 144 (e/f/g). |
| 109 | 3v3 pricing check + comp canary | Do 1v1 prices survive 12-turn, 6-body games; ~30 stress comps | **Close — superseded.** The mid-flight answers already reframed Part 1 ("the fear was aimed at a game that doesn't exist; the real finding is width multiplying stacks"), and Part 2 is the 144-comp grid (140 §7–§8). |
| 110 | Web-inversion probe | Body count or type dilution? | **Close — measured and acted on.** Findings (control is the weakest role at 1v1, its hole is ramp) went into 114 → 115/116 → 141. |
| 111 | Self-draw loop | A 0-cost card could draw itself forever | **Close — shipped**, grid re-baselined (114 "blocker cleared"). Record Henry's ruling on the ticket: *players may break their decks; base enemy decks may not loop.* That ruling also closes the loop question in 113 and 122. |
| 114 | Rebalance design session | Three questions for a session | **Close — the session happened**: it is the 134 → 136 arc (four rounds, sd 19.4 → 9.6). |
| 118 | Playtest session | Stacked-species comps; is control fun | **Close — done.** `PLAYTEST-118-FINDINGS.md` exists and produced 123, 127, 128. Later playtests are their own tickets (143). |
| 120 | Consume-aware pricing (hexbloom) | Is the scorer double-counting consumed stacks | **Close as a hexbloom problem** (Henry: it plays fine); the scorer question goes into "149". |
| 122 | hraesvelgr_v2's 10.9-point drop | Confirmed real on 08-26, cause never found | **Close — moot.** 136 rebuilt hraesvelgr_v2 (Plunge 2e/45, Talon 25); she is in band on the valk rebaseline. The old cause is under a rework. |
| 127 | AI decision cost | Pause/search reorder shipped; **the ruling it wanted was the beam** | **Close — ruled.** 144 §2: beam is a rung of the enemy ladder (wild 8, elite 8, gym 0), harness beamless by default, `aiBeam` per battle. The "still needs an eyeball" item was the played-card reveal, which Henry has played. |
| 128 | Firmware caster at 3v3 | Henry ruled `source: SELF` stays (later reversed by 141 for nine OSes); the UI half — make the caster unmistakable — is open | **Close into 145.** 145's per-caster affordability dimming, caster badge on the reveal, and the stepped-forward active slot are exactly option 1. Note it in 145 so the lineage survives. |

## 2. The other open tickets, with the same treatment

| # | title | recommendation |
|---|---|---|
| 112 | OS width audit | **Close — measured** (08-22); its alarm was retired by its own §6, and 141 is the eventual answer. |
| 113 | valkyrie_v2's self-draw deck | **Close — superseded.** Her deck and REBIRTH were rebuilt (136, then the valk rebaseline at 49.5). |
| 116 | Side-wide firmware for kraken/huldra | **Close.** Kraken half shipped 08-26 (and was then re-shaped by 141a); huldra half was "not taken" and 141f/141g did huldra properly. |
| 119 | Side-scope multiplier is width-blind | **Fold into "149"** (scorer). |
| 121 | Cost-band tolerance | **Fold into "149".** Henry already ruled the shape (±15%, not sd); the ticket's proposal is ready. |
| 130 | Daemon pricing + `DRAW` mispriced | **Fold into "149".** |
| 140 | EA 3v3 comps | **Close as the baseline doc.** §8 is current state; further comp work is new tickets. Flip status to "measured, baseline 2026-09-07". |
| 141 | Ally-triggered OS | **Close — shipped**, gate rows and ship read on file (141-SHIP-READ). Status line still says "ready for Legion"; flip it. |
| 142 | Route to the gym | **Keep open until Henry's playtest** — shipped in `4f0f5c2`; acceptance is the feel, and §5 holds the alternative. |
| 143 | Playtest: fenrir cards + log | **Close — shipped**, gate rows on file. |
| 144 | Sim speed piece 4 | **Close**; note e/f/g (bundled lanes, comp-grid cache, transposition table) as optional follow-ups for Henry's box. |
| 145 | Battle scene redesign | **Open — needs Henry's A/B pick before the mock.** |
| 146 | Game juice | **Open**, after 145's anchors (146a/b can start now). |
| 147 | SFX pass | **Open.** |
| 148 | Progression curve | **Open — P0–P3 for Legion, then Henry's session.** |

Files that are not tickets and need no status: `136-IMPLEMENTATION-PROMPT`, `136-ROUND3-PROMPT`,
`141-GYM-CHECK`, `141-SHIP-READ`, `94-decision-density` (renumbered stub → delete).

## 3. One new ticket to absorb five: "149 — the scorer prices what it can measure"

63 (firmware power-rate census), 119 (Side ×2.2 is width-blind), 120 (consume double-count),
121 (band tolerance ±15%), 130 (daemon constant + `DRAW` mispriced) are all `powerscale.ts`
constants that were guessed and then became load-bearing in the card-budget gate. One ticket:
measure each rate the way 61 measured valkyrie's frame, replace the constant, re-run the budget
sweep, and apply Henry's ±15% band ruling. Report-first; Henry rules any card that moves out of
band as a result. This is instrument work with no balance change until he says so.

## 4. The open list after this audit

Genuinely open, in the order they should be worked:

1. **145 — battle scene** (Henry: pick A or B; then Legion mocks, then builds).
2. **146 — juice** and **147 — SFX** (after 145's anchors; 146b's Burn flames can start now).
3. **148 — progression curve** (Legion: P0–P3 arms; then Henry's session).
4. **59 — registry triage** (lower-tier; before 148's policy arms).
5. **149 — scorer pricing** (new; absorbs 63/119/120/121/130; report-first).
6. **142 — route to the gym** (open only for Henry's playtest sign-off).

Everything else in this wayfinder can be marked closed with the one-line reason in the tables
above. That takes the lane from 47 "open-looking" files to six real items.
