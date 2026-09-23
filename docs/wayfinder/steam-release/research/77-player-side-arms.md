# Track A: the 18-card deck is the strongest deck in the game, and everything else is dilution

**Date:** 2026-09-02 · **Ticket:** [77](../tickets/77-player-progression-arms.md) Track A · 8 arms, 1,440 battles
**Conditions:** n=60 per cell, all three gauntlet cells, `--matchup favourable`, **bare arm grades**
(75 ruling 2), Rally live, paired seeds, one tree. Bare rows re-taken on the day as the ticket asks.

**Report only. Nothing has moved.** `--deck` is a harness flag; no card, deck list or registry entry
was edited.

---

## 1. The headline

Ticket 77 opened on the observation that every lever measured across 67–76 was boss-side, because the
graded arm fields a **run-start** player against a **fully-built** boss. Track A puts the player side
in the arm for the first time. The answer is not the one the ticket expected.

| arm | deck | Rootfall | vs bare | Emberfall | vs bare |
|---|---|---|---|---|---|
| **bare — the grading arm** | 18 | **27.7%** | — | **62.4%** | — |
| A1 — full tuned decks | 25–28 | 19.0% | −8.7 · p = 0.15 | 40.3% | −22.1 · **p = 0.0046** |
| A2 — engine +3 | 27 | 13.0% | −14.7 · **p = 0.015** | 33.9% | −28.5 · **p = 0.00006** |
| A3 — bare + 3 **blanks** | 21 | 18.5% | −9.2 · p = 0.096 | 31.1% | −31.3 · **p = 0.00003** |
| *(75) — bare + 3 counters* | 21 | 11.1% | −16.6 · **p = 0.0002** | 44.0% | −18.4 · **p = 0.023** |

**Every arm that adds cards loses, at both gyms, without exception.** Completing the engine loses.
Adding the next three engine cards loses. Adding three blank generics loses. Adding three
counter-cards loses. **At every deck size tried, the 18-card run-start deck is the best deck
measured**, and at Emberfall every one of those losses is statistically significant.

**A2 is the arm that matters most for design, and it is the worst of the four.** "The next three
cards of your own engine" — precisely what a pick track weighted toward your missing tuned cards
would deal — costs **14.7 points at Rootfall and 28.5 at Emberfall**. The targeted version of
progression is worse than the wholesale version (A1) at both gyms.

---

## 2. A1 — kit completion is a downgrade, and the instruments say why

Per fight, bare → full tuned:

| | Rootfall | Emberfall |
|---|---|---|
| payoff casts / fight | 1.65–2.03 → **2.60–2.80** | 2.13–2.52 → **2.98–3.70** |
| dead cards | 3.9–5.4% → **10.9–11.7%** | 5.1–8.0% → **13.0–18.1%** |
| player damage / turn | 42.0–44.4 → **37.0–40.8** | 41.7–56.6 → **36.2–49.5** |
| enemy damage / turn | 33.0–35.9 → 32.5–36.1 | 26.9–34.7 → 28.4–36.3 |

**The engine fires more often and the deck deals less damage.** Payoff casts rise by ~40%, exactly as
"complete your engine" promises — and output falls anyway, because the tuned list adds three to four
times as many cards as it adds engine pieces. The enemy's rate barely moves, so this is a pure loss
of player tempo rather than a longer fight.

The start kit **is** the engine: five tagged cards, no filler (`startKitIdsFor`, ticket 60 — *"there
is no front and back any more: four tags, all of them"*). The tuned per-OS list is that engine plus
the filler that smooths it out for an enemy that plays a nine-card deck from turn one. Handing the
player the whole list does not complete an engine; it buries one.

---

## 3. A3 — the dilution control, and the question ticket 76 could not close

Ticket 76 §2.3 ended on two gyms with opposite toolbox curves and no mechanism that fitted both. A3
replaces the three counter-cards with three copies of `water_slap` — same deck size, zero situational
text — and it resolves that, though not the way the ticket predicted.

| | bare | +3 blanks | +3 counters |
|---|---|---|---|
| Rootfall | 27.7% | **18.5%** | 11.1% |
| Emberfall | 62.4% | **31.1%** | 44.0% |

**At Rootfall the counters cost 7 points more than blanks; at Emberfall they cost 13 points LESS.**
So the counters are not uniformly bad cards and never were — at Emberfall they are meaningfully
*better* than a vanilla attack in the same slot; they simply do not pay for the slot at all.

**Deck size is the lever. Card quality is a second-order correction on top of it.** Three cards
added to an 18-card deck cost between 9 and 31 points of clear rate depending on the gym, and which
three cards they are moves that by about a third either way.

**And the mechanism is not dead draws.** The blanks arm has *fewer* dead cards than bare (Rootfall
3.0% vs 4.1%; Emberfall 4.4% vs 5.6%) — `water_slap` is always playable. Its damage per turn simply
falls, 44.4 → 40.9 and 46.3 → 42.1. The added cards **displace better cards in the draw**, whether or
not they are situational. That is a simpler story than the one tickets 75 and 76 were reaching for,
and it fits both gyms without an epicycle.

---

## 4. What this means for the ticket's premise

Ticket 77's framing was that the player side has never been in the graded arm, and that the fights
look hard because the player is measured at run start. That framing is right. **The conclusion it
anticipated is wrong**: the run-start deck is not an impoverished version of a finished one, it is
the most concentrated deck the game currently offers, and every progression path measured so far
makes it worse.

Which relocates the design question rather than answering it:

- **"More cards" is not progression.** Any reward track that hands the player cards — picks, buys,
  the toolbox — is currently a tax unless the cards it hands beat the *average* card already in the
  deck by more than the dilution costs. At an 18-card deck that bar is high.
- **Removal may be worth more than addition.** Nothing here measures it, and nothing should assume
  it, but the shape of every arm above points at deck *thinning* as the untested direction.
- **Ticket 60's ruled player edges are still untested.** Macros (Track B1) and player Drivers
  (Track B2) add power **without adding cards**, which is now the interesting property rather than an
  incidental one. A1's result raises their value rather than lowering it — they are the only measured
  route to player power that does not dilute.

**No mechanism beyond dilution is asserted**, and Track A cannot separate "the added card is worse
than the average card" from "a smaller deck cycles its engine faster". Both predict everything above.
Distinguishing them needs a deck-size arm that holds card quality fixed — bare plus three *duplicates
of the deck's own cards* — which is one more arm and is not run.

---

## 5. For Henry's session

1. **The 18-card deck outperforms every larger deck measured**, including the completed tuned lists.
   Before any pick-track design, this needs a ruling: is the start deck accidentally the strongest
   configuration, and if so is that a bug in the tuned lists, in `minimumActiveDeck`, or in what
   "progression" should mean in this game?
2. **The toolbox question is answered as far as measurement can take it** (§3): dilution dominates,
   the printings are a second-order correction, and at Emberfall the counters beat blanks. There is
   nothing here that a reprice fixes.
3. **Track B is now the more interesting half of this ticket, not the fallback.** Macros and Drivers
   are the only player-side power that does not cost a card slot.

## 6. Reproducing

```
npx vite-node src/debug/balance/runRunGate.ts --bands gauntlet --gym <gym> \
  --matchup favourable --iterations 60 [--deck full|engine-plus-3|bare-plus-generics]
```

Raw reports in `77-runs/`. Every cell line carries the ticket's new diagnostics —
`payoff` (casts of a `scaling` card per fight, the engine assembling), `dead` (share of cards that
reached hand unplayed), `deck` (size), and both damage rates.

**A determinism note worth keeping.** The re-taken Rootfall bare row came back **byte-identical** to
research/76's — all 180 battles, same wins, same losses — which is the seed contract holding and
confirms that adding telemetry collection perturbed nothing. Re-taking a bare row is still correct
whenever the tree moved; this is the evidence that it is a no-op when it has not.


---

# TRACK B + C: the harness can now hold a rack, a Driver and a reshaped ROOT ROT — BUILT, PILOTED AT n=12, FULL ARMS PENDING ON HENRY'S MACHINE

**Date:** 2026-09-19 · **Ticket:** [77](../tickets/77-player-progression-arms.md) Tracks B + C · tree at start `6c61a4b`, code commits `1dc712a` (Track B) and `e53198b` (Track C)
**Conditions for every arm:** `--bands gauntlet --gym <gym> --matchup favourable`, bare arm grades (75 R2), Rally live, paired seeds, one tree.
**Report only. Nothing has moved.** `--macros`, `--player-driver` and `--tweak root-rot-c*` are harness flags; no card, Driver number, OS, deck list, `programs.json` or `hooks.json` entry was edited.

## B.0 What was built, and how each flag was proven to reach the fight

Three flags, two commits, all threaded through the two functions `measureCell` actually calls — `sampleFightFor` and `batchOptionsFor` — which are new. Before this ticket `optionsThreading.test.ts` called `sampleFight` by hand with the right arguments, which tests `sampleFight` and not the arm; the `--toolbox` bug lived precisely in that gap. Each new case was run with its threading line commented out and **failed** (player-driver 1 test, macros 2 tests, root-rot knob 2 tests), then restored.

| flag | what it does | where it lands | guard |
|---|---|---|---|
| `--macros surge3\|mixed` | `macroPolicy.ts` fires the rack through the same `FIRE_MACRO` action the screen dispatches | `BatchOptions.playerPolicy`, consulted before every player action in `runOne` | every fire passes `canFireMacro` or the policy THROWS; a reducer refusal after that throws too |
| `--player-driver <id>` | `setup.player.drivers = [id]`; `createBattleState` applies it through the game's `applyDrivers` | `sampleFight`'s new last parameter | validated against `DRIVER_IDS` at parse AND at `sampleFightFor`; unknown id throws |
| `--tweak root-rot-c1\|c3` | replaces `driver_root_rot`'s HOOKS in `FIRMWARE_REGISTRY` for the run | `applyRegistryTweaks`, once at script start | through `HookLibraryItemSchema`; refuses to stack on another candidate; `root-rot-c2` throws (below) |

New cell-line instruments, beside Track A's: **`macros=N/fight (rule counts)`** and **`procs: player=N/fight enemy=N/fight`**, the latter counted off `DRIVER_PROC` events per side (the same event the chip flashes on; the AI's search emits none).

**The macro policy is a floor on a human, as the ticket asked.** Lethal first (the real reducer run muted, so shields and Weakened count), then boss-turn-1 empties the rack (Surge → lowest pool, Cripple → highest attack, Mend → lowest %HP ally), then Mend at the start of any turn an ally is under 40%. **The rack is per CELL** — `runGate` fights each gauntlet cell from full HP and now from a full rack; `gauntletCompound` already prints itself as an UPPER BOUND for the first reason and the same applies to the second. Read the boss cell as *"three macros brought to the boss"*.

**Track C's two candidates**, both proc-visible and uncapped, neither touching `onStatusApplied` so neither needs ROOT ROT's re-entry guard:

- **C1 CREEPING ROT** — `onTurnEnd`, every Poisoned enemy +1 Poison. A Driver's hooks sit on every member, so "once per turn" for the SIDE is a SIDE-scoped flag reset at `onTurnStart` (DEEP CACHE's exact shape) — the mechanics of a side-level effect, not a cap. Measured in a 1v1 arena: 3 Poison → end of enemy turn → the player's tick deals **4 stacks** of damage and decays to 3 (bare: 3 then 2). The +1 lands BEFORE the victim's tick. One caveat the report must read correctly: the proc is announced when the `when` passes, before the `targetHasStatus` filter finds no Poisoned enemy, so **C1's procs/fight ≈ the boss side's turn-ends while it lives**, not stacks landed.
- **C3 FESTERING** — `onPostDamage`, program has an ATTACK action, target already Poisoned → +1 Poison. Fires on hits, never on a Poison-only card. `onPostDamage` fires once per ACTION of a card and `actionType` is a property of the PROGRAM, so an attack card that also applies a status fires once per action — uncapped on purpose; the proc count shows it.

### STOP 1 — C2 SPREADING ROT is NOT BUILT

*"Whenever this side's card applies Poison, another enemy gains 1 Poison."* The hook targets are `SELF | TARGET | SOURCE | ALLIES | ENEMIES | RANDOM_ENEMY`, and `RANDOM_ENEMY` may resolve to the context target itself (`HookFactory.resolveTarget`). There is no *"a living enemy other than the target"*. Approximating with `RANDOM_ENEMY` would land the extra stack on the pile being built about a third of the time at 3v3 — the exact quadratic case the candidate exists to avoid — so, per the ticket, it was not approximated. `--tweak root-rot-c2` throws with this paragraph. Building it needs a new hook target in the engine, which is engine work for a ruling, not a knob.

### STOP 2 — the bare row does NOT match research/77's, and the tree is why

Research/77's Rootfall boss-cell sequence (2026-09-02, tree `6bafc12`) opens `WIN WIN WIN loss loss WIN WIN WIN WIN WIN loss loss`; today's opens `loss loss loss loss WIN WIN WIN loss loss loss WIN loss`. The tree moved under the row: **45 commits, `6bafc12..6c61a4b`**, among them card and OS changes that reach the gauntlet — `eefd078` (acid_splash to 20 power), `1c9fdf2` (overheat / stunning_strike / sleep_powder rework), `cab8ec7` (CORE_OVERCLOCK +20%/stack), `bc62e4a` (TOXIN_FANG, KINETIC_RAM ride power), `3d0552a` + `1d1f685` (ticket 151: jormungandr_v1 undertow swap, path-2 cards in the tuned decks), `4182922` (the single-candidate PRNG guard, which shifts every seed sequence after a 1-candidate draw), and `fe6a565`/`38e2fb1` (the eight Drivers). Damage and HP are also on a different scale than the 2026-09-02 rows (~600 dmg/turn against ~44) — so **no number below is comparable to research/76 or research/77 Track A**, including the *56.7 / 83.3* Track C was specified against and the *scrubber-card p = 1.00* B2 was to be paired with. Every comparison is to the day's bare on this tree, which the ticket requires anyway.

## B.1 The pilot — Rootfall boss cell, n=12, six arms, one tree, paired seeds

Run in a cloud container (two lanes, ~90 s/battle) to prove every arm is LIVE and to give the session a first read. **n=12 is under-powered by design; the ±5 window needs n=60 and these intervals are ±25pt.** Raw reports: `77-runs/pilot12-*.txt`.

| arm | boss cell | vs bare | paired flips (→win : →loss) | McNemar p | player dmg/turn | boss dmg/turn | payoff/fight | instrument |
|---|---|---|---|---|---|---|---|---|
| **bare (grading)** | **4/12 = 33.3%** | — | — | — | 594 | 647 | 3.33 | — |
| `--boss-driver off` | 11/12 = 91.7% | +58.3 | 7 : 0 | **0.016** | 752 | 461 | 3.42 | — |
| **C1** Creeping Rot | 10/12 = 83.3% | +50.0 | 6 : 0 | **0.031** | 761 | 509 | 3.42 | 3.83 procs/fight (≈ every boss turn) |
| **C3** Festering | 5/12 = 41.7% | +8.3 | 2 : 1 | 1.00 | 629 | 700 | 2.92 | **29.75 procs/fight** |
| **B1b** macros `mixed` | 5/12 = 41.7% | +8.3 | 3 : 2 | 1.00 | 691 | 648 | 3.50 | 3.00 macros/fight, all `boss-turn-1`; **0 lethals in 12 fights** |
| **B2** `driver_antivenom` | 4/12 = 33.3% | 0.0 | 1 : 1 | 1.00 | 614 | 690 | 3.08 | 1.67 procs/fight |

Sequences, sample 0→11 (W/L), for the pairing: bare `LLLLWWWLLLWL` · off `WWWWWWWWLWWW` · C1 `WWWWWWWWLWWL` · C3 `LLLLWWWLWWLL` · B1b `LLWLLWWLWWLL` · B2 `LLWLWWWLLLLL`.

**What the pilot can and cannot say:**

1. **ROOT ROT is still the wall on this tree, and by more than research/76 measured.** Off is +58.3pt at 7:0, p = 0.016 even at n=12 (76: +26.6). Boss damage/turn falls 647 → 461 with the Driver stripped.
2. **C1 is not a reshaped ROOT ROT; it is ROOT ROT removed.** 83.3% sits 8pt under *off* and 50pt over bare, and the two sequences differ in one battle. Its procs land every boss turn (3.83/fight over 4.8-turn fights), so it IS firing — one stack per Poisoned body per turn is simply worth almost nothing against a Poison pile the boss already builds 5–8 applications deep. Per-turn-per-body removes the quadratic term entirely.
3. **C3 is the only candidate in the "between" band the ticket named** — 41.7% between 33.3 and 91.7 — and it fires **~30 times a fight**, because the boss trio's attacks on an already-Poisoned player body are most of its actions. Two flips to one is a null at this n; the direction is *lighter than ROOT ROT*. It is the one Track C arm worth n=60.
4. **Three macros brought to the boss are worth ~+8pt at the boss cell, null at n=12** (3:2). Every one of the 36 fires was rule 2 on turn 1; **the lethal rule never fired in 12 fights** — a 30-power Surge against pools in the thousands is not a finisher on this tree, which is the macro sizing prior (*"~30 power ≈ 9 HP ≈ 11% of a pool"*) being off by an order of magnitude after the rescale. Player damage/turn rises 594 → 691 with the rack; the boss's is unchanged.
5. **ANTIVENOM, the slot-free Rootfall counter, is a flat null at the boss cell** (4/12 = 4/12, 1:1), firing 1.67 times a fight. Against research/76's *scrubber*-the-card at p = 1.00 this is the same answer from the other end: **shedding one Poison a turn does not touch a fight the boss wins by rate**, whether it costs a card slot or not. So "counters must not be cards" is not what this measures — it measures that this counter does not matter in either form.

## B.2 The full arms — run lines for Henry's machine

Every line is one cell set, `--out` incremental (Node block-buffers stdout to a pipe; the container reclaims idle processes), n=60. Re-take the two bare rows FIRST, same day, same tree, before any arm. A bare row is ~80 min; a boss cell alone ~30 min.

```
# Bare rows — the day's grading arms (~80 min each)
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60 --out research/77-runs/BC-BARE-rootfall.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60 --out research/77-runs/BC-BARE-emberfall.txt

# Track B1 — macros (4 arms, ~80 min each)
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60 --macros surge3 --out research/77-runs/B1a-rootfall-surge3.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60 --macros mixed  --out research/77-runs/B1b-rootfall-mixed.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60 --macros surge3 --out research/77-runs/B1a-emberfall-surge3.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60 --macros mixed  --out research/77-runs/B1b-emberfall-mixed.txt

# Track B2 — player Drivers (6 arms, ~80 min each; the element Driver is the favourable arm's lean)
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60 --player-driver driver_antivenom      --out research/77-runs/B2-rootfall-antivenom.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60 --player-driver driver_tenth_strike   --out research/77-runs/B2-rootfall-tenth.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60 --player-driver driver_element_fire   --out research/77-runs/B2-rootfall-fire.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60 --player-driver driver_antivenom      --out research/77-runs/B2-emberfall-antivenom.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60 --player-driver driver_tenth_strike   --out research/77-runs/B2-emberfall-tenth.txt
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60 --player-driver driver_element_water  --out research/77-runs/B2-emberfall-water.txt
# optional, same cells: --player-driver driver_bulwark_reflex   /   --player-driver driver_static_field

# Track C — Rootfall boss cell only (~30 min each)
npm run balance:run-gate -- --bands gauntlet --cells gauntlet:fight2 --gym gym_rootfall --matchup favourable --iterations 60 --out research/77-runs/C-BARE-rootfall-boss.txt
npm run balance:run-gate -- --bands gauntlet --cells gauntlet:fight2 --gym gym_rootfall --matchup favourable --iterations 60 --boss-driver off      --out research/77-runs/C-OFF-rootfall-boss.txt
npm run balance:run-gate -- --bands gauntlet --cells gauntlet:fight2 --gym gym_rootfall --matchup favourable --iterations 60 --tweak root-rot-c1   --out research/77-runs/C1-rootfall-boss.txt
npm run balance:run-gate -- --bands gauntlet --cells gauntlet:fight2 --gym gym_rootfall --matchup favourable --iterations 60 --tweak root-rot-c3   --out research/77-runs/C3-rootfall-boss.txt
```

Total ≈ 12 × 80 min + 4 × 30 min ≈ **18 h**. Order if time is short: the two bare rows, then C3, then B1b at both gyms, then B2 tenth_strike. The `registry` stamp in the banner changes under a `--tweak root-rot-*` run (the hash covers `FIRMWARE_REGISTRY`) — that is the fingerprint working, not a mismatch.

## B.3 For Henry's session — what the build and the pilot put in front of him

1. **Slot-free vs slot-cost.** Track A: +3 cards = −9 to −31pt compound. Pilot, boss cell only: three macros +8.3 (3:2, null), ANTIVENOM 0.0 (1:1). The slot-free levers do not COST — that much is measured — but neither moved the boss cell at n=12. The n=60 arms decide whether +8 is real.
2. **Antivenom-Driver vs scrubber-card, Rootfall boss.** Card (research/76, old tree): p = 1.00. Driver (pilot, this tree): 4/12 vs 4/12, 1:1. Same null from both ends; this counter is not about the slot.
3. **Which of C1–C3 lands between bare and off.** C3 only: 41.7% between 33.3 and 91.7, 29.75 procs/fight. C1 at 83.3% is indistinguishable from *off* (one battle apart) — it removes the Driver rather than reshaping it. C2 cannot be expressed with the hook targets that exist.
4. **Three lines, numbers only, no lever moved:** ROOT ROT off is +58.3pt at 7:0 (p = 0.016) on the current tree · C3 FESTERING is +8.3pt at 2:1 firing 30×/fight · the macro floor never found a lethal in 12 boss fights, so Surge's 30 power is not a finisher against pools of ~1,000+.

## B.4 Gates and reproducing

`npx tsc -b` clean · `eslint .` 0 · `npx vitest run` **179 files / 2394 tests** (was 177 / 2372) · `npx vite build` + `assert-no-debug` OK. New tests: `macroPolicy.test.ts` (8), `rootRotCandidates.test.ts` (7), `optionsThreading.test.ts` +7 (Track B 4, Track C 3). Tree at start `6c61a4b`; commits `1dc712a` (B), `e53198b` (C), plus this report.


---

# TRACK B + C AT n=60 — 17 arms, 2,700 battles, one tree, paired seeds (2026-09-21 → 23)

**Tree:** `steam-prep-september` at `e14cfd0` (the same tree as the review block; `6c61a4b` + the Track B/C commits, which touch `src/debug` only) · **Conditions:** `--bands gauntlet --matchup favourable --iterations 60`, bare arm grades (75 R2), Rally live, paired seeds, **the day's bare beside every arm**, McNemar both ways · **Where:** a cloud container, two lanes, ~60–90 s a battle (Henry's machine does ~27 s). `npm run balance:77` (new, `scripts/ticket77-arms.mjs`) is the same 17 arms as a resumable batch for whoever re-takes them.
**Report only. Nothing has moved.** Raw reports in `77-runs/` under the names in the tables (`BC-BARE-*`, `A3-*-blanks.retake-n60`, `C*-rootfall-boss`, `B2-*`, `B1*`). The seed contract held: the Rootfall bare boss row's first twelve battles came back byte-identical to the 2026-09-19 pilot's.

The review's four corrections were applied: R1's macro-scale claim is struck and the §7 question withdrawn (§B.5); C1 ran to n=60 beside C3 (R2); the rack stayed per-fight and B1 is labelled a ceiling with the boss cell as the per-run number (R3, §B.5); A3 was re-taken (R4, §B.2).

## B.1 The day's bare rows — and Emberfall has collapsed since Track A

| gym | fight 1 | fight 2 | boss | **compound** | Track A (2026-09-02) |
|---|---|---|---|---|---|
| Rootfall | 86.7 | 85.0 | 30.0 | **22.1%** | 27.7% |
| Emberfall | 60.0 | 63.3 | 35.0 | **13.3%** | 62.4% |

Rootfall is within noise of Track A. **Emberfall is not: 62.4 → 13.3.** Every one of its three fights moved down, and the boss cell now reads like Tidewrack did in research/72: **3.1 turns, boss 971 dmg/turn against the player's 864, 18% dead cards** — a race the player loses by rate, not a fight ROOT ROT-style. This is the largest single number in this report and it is not a Track B or C finding; it is what the 45 commits since research/77 did to Emberfall's gauntlet. Nothing here identifies which commit (the candidates are in the 2026-09-19 §B.0 list — the 149b/150/151 card and OS changes are the ones that reach Emberfall's trio). **A ticket-68-style "who moved Emberfall" measurement is the first thing this report asks for, ahead of any Track B/C ruling.**

## B.2 A3 re-take — the deck-size tax survives in direction and shrinks to noise

| arm | Rootfall f1 / f2 / boss | compound | vs bare | Emberfall f1 / f2 / boss | compound | vs bare |
|---|---|---|---|---|---|---|
| bare | 86.7 / 85.0 / 30.0 | 22.1 | — | 60.0 / 63.3 / 35.0 | 13.3 | — |
| bare + 3 blanks (21 cards) | 73.3 / 81.7 / 31.7 | 19.0 | −3.1 | 60.0 / 65.0 / 26.7 | 10.4 | −2.9 |

Paired: Rootfall f1 2:10 (**p = 0.039**), f2 5:7, boss 12:11; Emberfall f1 10:10, f2 7:6, boss 7:12 (p = 0.36). Track A measured −9.2 and −31.3 compound for the same arm; on this tree it is −3 at both gyms, significant in one lead-in cell only. The direction holds — three blanks never help — but **the size of the tax is tree-dependent and it is now small.** Emberfall's −31 has evaporated with Emberfall's bare itself: a 13% gauntlet has little left to lose. Dead cards fall with the blanks as before (Rootfall 8.6 → 6.0%), so the mechanism reading — displacement, not dead draws — is unchanged.

## B.3 Track C — ROOT ROT reshaped, Rootfall boss cell, n=60

| arm | boss | vs bare | flips →win : →loss | p | boss dmg/turn | player dmg/turn | Driver procs/fight |
|---|---|---|---|---|---|---|---|
| bare (ROOT ROT as shipped) | **30.0** | — | — | — | 661 | 615 | (not proc-flagged) |
| `--boss-driver off` | 68.3 | +38.3 | 25 : 2 | **< 0.001** | 535 | 726 | 0 |
| **C1 Creeping Rot** | 61.7 | +31.7 | 21 : 2 | **< 0.001** | 565 | 717 | 3.75 (≈ every boss turn) |
| **C3 Festering** | 21.7 | −8.3 | 3 : 8 | 0.23 | 743 | 637 | 30.0 |

C1 against off, paired: 0 : 4, p = 0.125. C3 against C1: 1 : 25.

**ROOT ROT is worth +38pt at this boss on this tree** (76 measured +26.6 on the old one; the intervals overlap at their edges, and this is the number to use now). Boss damage falls 661 → 535 with it stripped.

**C1 is in the between-band, but near its top.** The review was right that n=12 could not separate C1 from off; n=60 does, just: C1 gives back 4 of off's wins and none the other way, p = 0.125, and sits 6.6pt under off, 31.7 over bare. So per-turn-per-body is not *nothing* — it is worth about a fifth of what per-application is worth. Its procs land every boss turn (3.75/fight over 4.8-turn fights).

**C3 is HEAVIER than ROOT ROT, not lighter.** The pilot's 41.7 was noise; at n=60 Festering is 8pt *under* the shipped Driver (3:8, p = 0.23), and the instruments say why: it fires 30 times a fight and raises the boss's rate 661 → 743, the highest of any arm. "Every attack on a Poisoned body adds a stack" on a trio whose attacks are mostly on Poisoned bodies is +1 per hit rather than +1 per application, and the trio hits more than it poisons. **Withdraw C3 as a nerf candidate.** If the fantasy is wanted it is a *buff* shape.

**Neither built candidate lands mid-band.** The gap between C1 (61.7) and bare (30.0) is where a reshaped ROOT ROT would have to sit, and nothing measured is in it. The one shape that structurally targets that gap is C2 — breadth onto a fresh pile — and it needs the engine target the 2026-09-19 report asked for.

## B.4 Track B2 — player Drivers, both gyms, n=60

| Driver | Rootfall f1 / f2 / boss | compound (bare 22.1) | boss flips, p | Emberfall f1 / f2 / boss | compound (bare 13.3) | boss flips, p | procs/fight |
|---|---|---|---|---|---|---|---|
| ANTIVENOM | 86.7 / 85.0 / 33.3 | 24.6 (+2.5) | 3:1, 0.63 | 60.0 / 63.3 / 35.0 | 13.3 (0.0) | 1:1, 1.00 | 0.5–1.7 |
| TENTH STRIKE | 81.7 / 83.3 / 40.0 | 27.2 (+5.1) | 7:1, 0.070 | 61.7 / 73.3 / 46.7 | 21.1 (+7.8) | **8:1, 0.039** (f2 6:0, 0.031) | 1.0–1.8 |
| FIRE DRIVER (Rootfall lean) | 83.3 / 83.3 / **53.3** | **37.0 (+14.9)** | **15:1, 0.001** | — | — | — | 11.2–11.7 |
| WATER DRIVER (Emberfall lean) | — | — | — | 65.0 / 70.0 / 41.7 | 19.0 (+5.7) | 7:3, 0.34 | 6.9–9.3 |

**FIRE DRIVER at Rootfall is the largest player-side lever measured in this ticket**: the boss cell 30.0 → 53.3 at 15:1, and the compound 22.1 → 37.0 — +15pt of gauntlet clear from a 10% multiplier on one element's attacks. It procs 11 times a fight because a favourable Rootfall party is two Fire bodies and most of its attacks are Fire. This is 76 arm 3's open question answered from the Driver side: type preparation *can* pay in the rolled fights — not through the type chart's 1.5x (which is already in the bare arm) but through a Driver that rewards the lean the party already has. The lead-ins are flat (2:4, 3:4 — the party wins them anyway); all of it lands on the boss.

**WATER DRIVER at Emberfall is the same shape at a third the size** (+5.7 compound, 7:3 at every cell, none significant) — fewer procs (7–9 a fight; an Emberfall favourable party is less mono) into a gauntlet with less to give.

**TENTH STRIKE is the lean-agnostic edge, and it is real at Emberfall** (+7.8 compound; f2 6:0 and boss 8:1 both significant) and directional at Rootfall (+5.1; boss 7:1, p = 0.07). ~1.5 procs a fight — the tenth attack lands once or twice — and each is 1.5x on a card that is usually a payoff.

**ANTIVENOM is a null at both gyms, every cell.** The Rootfall boss is 3:1 (p = 0.63) at 1.7 procs a fight; Emberfall is 0:0 / 0:0 / 1:1, the lead-ins byte-identical to bare. The 2026-09-19 reading stands, now at n=60: the slot was never the problem, and shedding a Poison a turn does not touch a fight the boss wins by rate.

## B.5 Track B1 — macros, both gyms, n=60. THE RACK IS PER FIGHT: A CEILING, and the boss cell is the per-run number

Moving the rack to per-run was not a small change — `runGate` fights each cell as an independent sample with its own run seed, so "three macros across this gauntlet" has no gauntlet to live in without restructuring how cells are sampled — so it stayed per-fight, as the review allowed. Read the lead-in cells as *"a player who spends macros here"* and the compound as a ceiling (up to 3× the macros a run holds); **the boss cell alone is the honest per-run number** — three macros brought to the boss, which a player who saved them would have.

| arm | Rootfall f1 / f2 / boss | compound | boss flips, p | Emberfall f1 / f2 / boss | compound | boss flips, p | macros/fight (rule) |
|---|---|---|---|---|---|---|---|
| bare | 86.7 / 85.0 / 30.0 | 22.1 | — | 60.0 / 63.3 / 35.0 | 13.3 | — | — |
| B1a 3× Surge | 86.7 / 86.7 / **46.7** | 35.1 (ceiling) | **15:5, 0.041** | 66.7 / 70.0 / 33.3 | 15.6 (ceiling) | 4:5, 1.00 | lead-ins 1.5–1.9 (all lethal); boss 3.0 (all turn 1) |
| B1b Surge + Cripple + Mend | 83.3 / 86.7 / 36.7 | 26.5 (ceiling) | 13:9, 0.52 | 66.7 / **75.0** / 36.7 | 18.3 (ceiling) | 4:3, 1.00 (f2 **7:0, 0.016**) | lead-ins 1.6–1.8 (≈half lethal, half mend-under-40); boss 3.0 (all turn 1) |

**Three Surges at the Rootfall boss are +16.7pt at zero slot cost** (15:5, p = 0.041), the second-largest player-side lever after FIRE DRIVER, and this cell is per-run-faithful. At the Emberfall boss they are −1.7 (4:5): the turn-1 dump buys nothing in a 3-turn race the boss wins by rate.

**The lethal rule fires in the lead-ins — 1.5–1.9 times a fight — and never at the boss.** R1 was right about the scale: a Surge is ~10% of a body, which is lethal when a body is already under 10%, and in a 4-turn lead-in against three bodies that happens once or twice a fight. At the boss the policy never *reaches* a lethal because rule 2 spends the rack on turn 1. That is the policy under-reading timing, exactly as R1 said: **a human holds Surge for the kill, and the floor does not.** The lead-in cells, which do hold (no rule 2 there), gain +6.7 / +6.7 at Emberfall — the held-Surge value the boss cell cannot see.

**One of each shape is worth less at the Rootfall boss than three Surges** (36.7 vs 46.7; 13:9 against bare, p = 0.52) — a Cripple and a Mend on turn 1 do not shorten the boss's life the way a third 10%-of-a-body hit does — **and more in the Emberfall lead-ins** (fight 2: 75.0, 7:0, p = 0.016), where Mend-under-40 fires as often as the lethal does (≈0.9 each per fight) and keeps a body alive through a 4.5-turn fight. So the loadouts split by fight length: the boss cell wants damage, the lead-ins want the heal. Neither loadout moves Emberfall's boss (+1.7 / −1.7): that fight is over in 3 turns whatever the rack holds.

## B.6 What the session opens on — four questions, numbers only

1. **Slot-free vs slot-cost.** Track A on the old tree: +3 cards = −9 to −31 compound. On this tree, A3: −3 at both gyms. Slot-free, this tree, compound: FIRE DRIVER +14.9, three Surges +13.0 (ceiling; boss cell +16.7), TENTH STRIKE +5.1 / +7.8, WATER DRIVER +5.7, ANTIVENOM +2.5 / 0.0. **Every slot-free lever is ≥ 0 and the two big ones are worth 5× what the dilution tax costs.**
2. **Antivenom-Driver vs scrubber-card at Rootfall's boss.** Card (research/76, old tree): p = 1.00. Driver (n=60, this tree): 33.3 vs 30.0, 3:1, p = 0.63. Both null.
3. **Which of C1–C3 lands between bare (30.0) and off (68.3).** C1 at 61.7 — in the band, 6.6pt under off (0:4, p = 0.125), procs every turn. C3 at 21.7 is BELOW bare (3:8) at 30 procs/fight — a buff, withdrawn. C2 not expressible.
4. **What I would put in front of Henry:** Emberfall's gauntlet is 13.3% today and was 62.4% three weeks ago — find the commit before ruling on anything below · FIRE DRIVER at Rootfall: boss 30 → 53 (15:1), compound 22 → 37 · ROOT ROT is +38pt; C1 keeps 7 of those points, C3 adds 8 more to the boss.

## B.7 Deviations from the prompt, stated

- The arms ran in a cloud container, not on Henry's machine: the device bridge cannot keep a process alive between calls (tested), so the container was the only host that could run 2,700 battles. Two lanes at ~60–90 s a battle; the batch took ~45 lane-hours over three days, including one restart of both lanes (an interrupted turn killed them mid-A3 and again mid-B1b; `77-runs/partial/` keeps the killed reports).
- The rack is per-fight (R3, second option). `npm run balance:77` and `scripts/ticket77-arms.mjs` are new — a resumable runner for exactly these 17 arms, so a re-take on Henry's machine is one command.
- Gates on the tree the arms ran on: tsc -b, eslint 0, 179 files / 2394 tests, vite build (unchanged from `b53063d`; the runner script is lint-clean and touches no test).
