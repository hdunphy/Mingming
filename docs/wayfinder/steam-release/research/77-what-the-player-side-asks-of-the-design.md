# What the player side asks of the design — a handover from ticket 77 (steam-release) to the deck-archetypes design agent

**From:** the steam-release measurement agent, 2026-09-19 · **Tree:** `steam-prep-september` at `b53063d` · **Re:** ticket 77 Tracks A–C
**Status:** report only. Nothing has moved. Henry rules; the n=60 arms for Tracks B and C are still to be run on his machine (research/77 §B.2, ~18 h). This report tells you what is already known, what is still a pilot, and what design questions fall out of it — so the session that follows the arms is not the first time you see them.

Read first if you have not: `docs/wayfinder/steam-release/tickets/77-player-progression-arms.md`, then `research/77-player-side-arms.md` (§1–5 Track A, §B Tracks B + C). Standing rule from this ticket, Henry 2026-09-01: **no caps — nerf by changing the shape.**

---

## 1. Where this started

Every lever measured across steam-release tickets 67–76 was boss-side, because the graded arm fielded a **run-start** player (18-card start deck, no Drivers, no macros) against a **fully-built** boss (tuned kit, OS, Driver, full lookahead). Ticket 77 put the player side into the arm for the first time, in three tracks: A — what deck progression is worth; B — the two ruled slot-free player systems, macros and Drivers; C — ROOT ROT with its trigger geometry changed rather than capped.

Henry's own framing for the ticket is the playtest complaint: *"I haven't felt like I've been able to level up or find a really cool synergy with cards… it's hard to tell if I'm improving my own power scale."*

## 2. What is settled (Track A, n=60, 1,440 battles, 2026-09-02)

**Every arm that adds cards to the 18-card start deck loses, at both gyms, without exception.** Full tuned lists (A1) lose 9 and 22 points of gauntlet compound; the next three cards of each member's own engine (A2 — exactly what a weighted pick track would deal) lose 15 and 29; three blank `water_slap`s (A3) lose 9 and 31; the three counter-cards (75) lose 17 and 18. At Emberfall every loss is significant.

The instruments say why: with the full tuned lists, payoff casts *rise* ~40% (the engine assembles more often) and player damage per turn *falls* anyway, because the tuned list adds three to four cards of filler for every engine piece. The start kit is five tagged cards and nothing else — it *is* the engine, and the tuned list buries it. And the mechanism is not dead draws: the blanks arm has *fewer* dead cards than bare. Added cards displace better cards in the draw whether or not they are situational.

**What this means for design, stated as facts rather than proposals:** at an 18-card deck, "more cards" is a tax. Any reward track that hands the player cards — picks, buys, the toolbox — currently lowers the clear rate unless the card beats the deck's *average* card by more than the dilution costs. Deck size is the first-order lever; card quality is second-order. The one arm that would separate "the added card is worse than average" from "a smaller deck cycles faster" (bare + three *duplicates* of its own cards) has not been run. Removal has not been measured at all.

## 3. What is built and piloted (Tracks B + C, 2026-09-19)

The harness can now hold what the player actually gets in a run. Three flags, all proven to reach the fight (each threading test fails with its line commented out):

- **`--macros surge3|mixed`** — a policy that fires the rack through the same `FIRE_MACRO` the screen uses, deliberately a floor on a human: a lethal if the real reducer says the preview kills; otherwise every unfired macro on turn 1 of the boss fight (Surge at the lowest pool, Cripple at the highest attack, Mend on the lowest-%HP ally); Mend at the start of any turn an ally is under 40%. Every fire passes `canFireMacro` or the harness throws. The rack is per cell — an upper bound, like `gauntletCompound` itself.
- **`--player-driver <id>`** — the eight ticket-16 Drivers, on the player side, one at a time.
- **`--tweak root-rot-c1|c3`** — ROOT ROT's hooks swapped for a candidate shape, hooks.json untouched.

**Two things could not be done, and were not approximated:**

1. **C2 SPREADING ROT** (*"whenever this side's card applies Poison, another enemy gains 1"*) cannot be expressed: the hook targets are `SELF | TARGET | SOURCE | ALLIES | ENEMIES | RANDOM_ENEMY`, and `RANDOM_ENEMY` may pick the context target itself — which at 3v3 would put the extra stack on the pile being built about a third of the time, the quadratic case C2 exists to avoid. A *"random enemy other than the target"* is a new hook target. **If you want C2 measured, that target is an engine request to file, not a knob.**
2. **The tree moved under the baseline.** Forty-five commits since Track A (149b/150/151 card and OS changes, the single-candidate PRNG guard, the Drivers, and a rescale that puts damage at ~600/turn where Track A read ~44). Research/76's ROOT ROT figures (56.7 bare / 83.3 off) and the *scrubber*-card p = 1.00 are cross-tree. Everything below is paired against the day's bare on the current tree, and nothing below is comparable to 76 or 77-A.

### The pilot — Rootfall boss cell, n=12, paired seeds, one tree

Under-powered by design (±25pt intervals); it exists to prove each arm is live and to give you a first direction.

| arm | boss cell | paired flips → win : → loss | p | what fired |
|---|---|---|---|---|
| bare (grading) | **33.3%** | — | — | — |
| ROOT ROT off | 91.7% | 7 : 0 | **0.016** | — |
| C1 Creeping Rot (end of turn, every Poisoned enemy +1) | 83.3% | 6 : 0 | **0.031** | ~every boss turn |
| C3 Festering (attack on a Poisoned target, +1) | 41.7% | 2 : 1 | 1.00 | **~30 procs/fight** |
| B1b macros Surge + Cripple + Mend | 41.7% | 3 : 2 | 1.00 | 3/fight, all turn 1; **0 lethals in 12 fights** |
| B2 ANTIVENOM Driver | 33.3% | 1 : 1 | 1.00 | 1.67 procs/fight |

## 4. What the pilot asks of the design — five observations, each with the question it raises

**4.1 ROOT ROT is still the wall, and a bigger one than 76 measured.** Stripping it is +58pt at 7:0 on twelve battles; boss damage per turn falls 647 → 461. The card changes since 76 did not soften Rootfall's boss; they may have sharpened it. *Question:* is Rootfall's current trio (`huldra_v2 + ratatoskr_v1 + jormungandr_v2`) still the trio you would author knowing the Driver is worth this much?

**4.2 C1 is not a reshaped ROOT ROT — it is ROOT ROT removed.** Per-turn-per-body sits one battle from *off*. That is the cleanest possible demonstration of what the ticket said about price-curve arbitrage: Poison is priced quadratically, so a stack added to the pile being built is worth several stacks added anywhere else. The moment the trigger is decoupled from the application, the value collapses. *Question:* if "+1 per turn per Poisoned body" is worth nothing, what geometry is worth *something but less than +1 per application*? C3 is one answer (below); the design space between them — e.g. "+1 per application, onto the enemy with the FEWEST stacks" — is what C2 was reaching for and could not express.

**4.3 C3 is the only candidate in the between-band, and it fires thirty times a fight.** 41.7% between 33.3 and 91.7, 2:1 flips, a null at n=12 but the only shape that moved the fight *down* from ROOT ROT without deleting it. Thirty procs a fight says the boss trio's attacks on an already-Poisoned player body are most of its actions — which is also a note about the trio's decks. It is the one Track C arm worth n=60. *Question for your session:* is "the wound takes the rot deeper" a Driver Rootfall's leader would *have*, thematically and in the offer-screen telegraph? The measurement says it is the right weight class; only you can say it is the right fantasy.

**4.4 Macros: ~+8pt at the boss cell at zero slot cost, and the floor policy under-reads timing.** *(Struck per REVIEW R1, 2026-09-21: the original paragraph claimed the macro sizing prior was off by an order of magnitude after the rescale. It was not — `NUMBER_SCALE` scales health and the damage divisor together, so a Surge still removes ~8–13% of a body, the original prior. The §7 "absolute or scaling" question is withdrawn. What survives, and what n=60 confirmed in research/77 §B.5:)* three Surges at the Rootfall boss are +16.7pt (15:5, p = 0.041) with every fire on turn 1; the lethal rule fires 1.5–1.9 times a fight in the lead-ins and never at the boss, because the floor spends the rack before a body is under 10%. A human holds Surge for the kill. *Question:* none — this is a harness-policy limit, not a design one.

**4.5 ANTIVENOM is a flat null at the boss, exactly as the scrubber card was.** 4/12 against 4/12, one flip each way, firing 1.67 times a fight. Research/76 asked whether *"counters must not be cards"*; the slot-free version of the same counter answers that the slot was never the problem. Shedding one Poison a turn does not touch a fight the boss wins by rate. *Question:* is the anti-Rootfall answer a *cleanse* at all, or is it the same thing the 73%-control deck at Tidewrack showed — killing a body? The toolbox's five other printings (`reactive_plating`, `discharge`, `scrubber`, `vent`, `drip_feed`) were measured as a basket in 75/76; none has been measured as a Driver.

## 5. What the n=60 arms will add, and what they will not

They will put intervals on everything above, and they add the lead-in fights (fights 1 and 2) and Emberfall, which the pilot did not touch. B2's element Driver (`driver_element_fire` at Rootfall, `driver_element_water` at Emberfall) asks the question 76 arm 3 left open — whether type preparation can pay in the *rolled* fights — and `driver_tenth_strike` is the lean-agnostic edge. B1a (three Surges) against B1b (one of each) separates "three finishers" from "one of each shape".

They will not measure: removal, duplicates, C2, any macro other than Surge/Cripple/Mend, any Driver number other than the shipped ones, or a human-quality macro policy. Nothing in Tracks A–C moved a lever, and by the ticket's terms nothing will before Henry's session.

## 6. What I would put in front of Henry, three lines, numbers only

1. ROOT ROT off is +58.3pt at 7:0 (p = 0.016) on the current tree; C1 at 83.3% is that same removal by another name.
2. C3 FESTERING is +8.3pt at 2:1 firing 30×/fight — the only reshaped ROOT ROT that is still ROOT ROT.
3. The macro floor found no lethal in 12 boss fights: 30 power against ~1,000+ pools, and the slot-free levers (macros +8.3, ANTIVENOM 0.0) do not *cost* where Track A's cards cost 9–31.

## 7. Requests to deck-archetypes, filed here for the record

- **Engine request (if C2 is wanted):** a hook target meaning *a living enemy other than the context target*, in `HookFactory.resolveTarget`, with the single-candidate PRNG guard's discipline (no draw when only one candidate exists).
- ~~Design question: whether macro powers are absolute or scale~~ — withdrawn (REVIEW R1).
- **Nothing else.** No card, OS, Driver number or printing is proposed by this report.

Raw data: `research/77-runs/` (`BARE-*`, `A1-*`, `A2-*`, `A3-*` for Track A; `pilot12-*` for the boss-cell pilot). Run lines for the full arms: research/77 §B.2.

---

## REVIEW (Henry's designer, 2026-09-20) — four corrections before the n=60 arms; Legion's text above stands as written

**R1 — §4.4 misreads the rescale; strike "an order of magnitude" and the §7 macro question.** `NUMBER_SCALE = 10` (`types.ts`) scales health AND the damage divisor together — its own header says *"IT CHANGES NO RELATIVE ECONOMICS"* — and card `power` scales itself. Surge still removes the same fraction of a body it always did. The pilot's own row agrees: three turn-1 macros lift player damage/turn 594 → 691, which over a ~5-turn boss fight is ~90–160 damage per Surge ≈ 8–13% of a body — the macros-and-drivers prior ("~11% of a pool") to the decimal. The lethal rule found no target because a 10%-of-a-body hit is lethal only when a body is already under 10%, which is rare on any tree. **Macro powers already scale; they are not mis-sized.** What survives of §4.4: macros are worth ~+8pt at the boss cell at zero slot cost, and the floor policy under-reads TIMING (a human holds Surge for the kill). The §7 "absolute or scaling" question is withdrawn.

**R2 — two claims outrun n=12 (±25pt).** (a) *"ROOT ROT is a bigger wall than 76 measured"*: +58 at n=12 vs +26.6 at n=60 — the intervals overlap; *"the card changes may have sharpened it"* is not supported yet. (b) *"C1 is ROOT ROT removed"*: 83.3 vs 91.7 is ONE battle apart at n=12; C1 could still be worth 10–25pt, which would make it the between-band candidate, and it is the shape that reads best on the offer screen. **Send C1 to n=60 alongside C3** (one boss cell, ~30 min).

**R3 — the macro rack resets per FIGHT, not per run** (three macros × three fights = nine per gauntlet). The report calls B1 an upper bound, which is honest; at n=60 the compound will overstate macros by up to 3×. Either move the rack to per-run before the arms, or the session reads B1 as a ceiling only. Say which in the B section.

**R4 — the cross-tree caveat cuts both ways: re-take A3.** Track A's deck-size tax was measured 50 commits ago, before 149b/150/151's card changes. Bare + three blanks at n=60 on this tree (~1.5 h) either re-confirms the whole Track A conclusion or says it moved. Add it to the n=60 run list.

**Stands as written:** the C2 stop (a "living enemy other than the context target" hook target is the right engine request, not a knob); §4.5 — ANTIVENOM-as-Driver is a flat null exactly where scrubber-the-card was, so "the slot was never the problem" is a real finding and the right question is whether the anti-Rootfall answer is a cleanse at all or killing a body; C3 firing ~30×/fight is the one new, significant-looking shape and its n=60 is the right next run.

**Revised n=60 list for Henry's machine:** day's bare (both gyms) → A3 re-take → C1 + C3 (Rootfall boss cell) → B2 antivenom / tenth_strike / element (both gyms) → B1a / B1b (both gyms, rack per-run or flagged ceiling).

## n=60 ADDENDUM (2026-09-23) — the arms are in; the reads that changed

research/77 §B has the tables. Against the 2026-09-19 text above: §4.1 — ROOT ROT is +38.3pt at n=60 (25:2), so "bigger than 76 measured" now stands. §4.2 — C1 is NOT ROOT ROT removed: 61.7 against off's 68.3 (0:4, p = 0.125) and bare's 30.0 (21:2); per-turn-per-body keeps about a fifth of the Driver. §4.3 — C3 is a BUFF, not the between-band candidate: 21.7, 8pt under the shipped Driver, at 30 procs/fight; withdrawn. §4.5 stands (ANTIVENOM null at both gyms, every cell). New and larger than any of them: **Emberfall's bare gauntlet is 13.3% today against 62.4% on 2026-09-02** — a 3-turn boss race at 971 dmg/turn — and **FIRE DRIVER at Rootfall is +23pt at the boss (15:1) and +15pt compound**, the largest player-side lever in the ticket. The design question that replaces §4.4's: the element Driver pays because the favourable party is mono — is that the intended reward for leaning, and should the lean-agnostic TENTH STRIKE (+5 / +8 compound) be the floor a non-mono party gets?
