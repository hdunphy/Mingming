# HANDOFF — deck-archetypes map (keep this current every session)

*Last updated: 2026-08-07, after tickets 26-33 landed. **Nature COMPLETE: 16/32 decks live.** **All six tuned species are inside the first-pass band on BOTH §2.3 and dead cards - there is no open first-pass breach.** If you are a fresh session (any model): read this, then map.md, then the ticket you're assigned.*

## Read this first: which band applies

There are TWO bands and they are not the same bar.

- **First-pass band, 0.30–0.70 §2.3.** This is the working bar while every species gets its initial pass. **Use this one.**
- **Strict ±15% (0.35–0.65).** The auditor's own `osMaxGap` assertion in `balanceReport.ts`. It will redline species that are fine by first-pass standards. **Henry's instruction: ignore it for now — it is for the final tuning pass once all elements are in.** Do not spend knob rounds chasing it.

Dead cards ≤0.35 **per side**, FTK 0, and mirror ≤30 turns still apply at first pass.

## Where things stand

- Branch **card-dev**. Tickets 01–33 closed. **8 of 16 species tuned** (kraken, jormungandr, sleipnir, hraesvelgr, fenrir, sköll, ratatoskr, huldra). **Water, Air, Fire and Nature are all complete.** The other 8 are placeholders — **do not read their numbers as balance signal.**
- **Latest full gate (after ticket 33), tuned species only:**

  | species | §2.3 | mirror turns | dead cards |
  |---|---|---|---|
  | huldra | **0.790** ✗ | 20.6 | 0.2% |
  | sköll | 0.640 | 3.7 | 32.3% |
  | ratatoskr | 0.590 | 4.7 | 3.8% |
  | kraken | 0.540 | 5.1 | 10.1% |
  | fenrir | 0.394 | 5.2 | 25.4% |
  | jormungandr | 0.390 | 6.4 | 5.6% |
  | sleipnir | 0.330 | 4.5 | 14.7% |
  | hraesvelgr | 0.310 | 3.2 | 4.0% |

- **THE CURVE IS rev 3.7: `10 / 30 / 65 / 105`, bands `1.0 / 3.0 / 6.5 / 10.5`.** The constants have not moved since rev 3.3 — rev 3.4 is five *pricing* corrections, all documented in `power_curve_spec.md`. **`powerscale.ts` is the executable truth; where the prose disagrees, powerscale wins.**
- **Cards STAY on-curve — fix enablers (OS/deck structure), never bend card economics.** Henry's law, proven three times now (kraken OS decomposition, MOMENTUM_DRIVE, and Burn overflow).

## Three engine/AI bugs found in ticket 28 — do not re-derive these

1. **Lifesteal cards attacked their own Mingming.** `TacticalAI` bucketed any card containing a `HEAL` action as ally-targeting, so `crimson_draw`, `blood_rite`, `leech_strike`, `drain_life` were played with `targetId === sourceId` and their TARGET-scoped ATTACK landed on the caster. Fixed. If you see a lifesteal card measuring 0 damage, this is not a balance number — check targeting first.
2. **The card-advantage eval term double-charged every play.** The search books a card's effect in the leaf state AND books −1 card, so a play only beat ending the turn if it beat the *stock* value of the card it spent — a 7.5-point toll on a 75 HP frame, which made every sub-4-damage card in the registry worse than passing. Fixed by counting cards cast this turn as still held.
3. **Burn overflow dealt a full 3-stack turn per excess stack, instantly, bypassing defense.** `molten_core` was a 1-energy card worth up to 18 damage (24% of a pool) while scoring 2.60 against a 3.00 cap — static analysis cannot know the target already holds stacks. Repriced 0.08 → **0.01** of maxHP per overflow stack. Note `floor(75 × 0.01) = 0`, so overflow is a **no-op at today's 75–79 HP pools** and only starts biting at 100+ max HP. Intentional headroom; `Math.max(1, ...)` is the one-line change if it should always cost something.

## Measurement facts a fresh session needs

- **Per-card damage attribution misses damage-over-time.** The harness measures the HP delta across a single `PLAY_PROGRAM` dispatch, so Burn ticks (which resolve at end of turn) are attributed to nothing. A Burn card will read `0.0 dmg/play` and look dead when it is carrying the deck. Always compare `dmg/game from cards` against `HP/game taken` — the residual is the DoT.
- **The scoped run prints the PLAYER-side dead-card figure only.** A v2 breach can hide behind an in-band v1 number. This has bitten once already (sleipnir was reported in band at 0.384 vs a 0.35 ceiling).
- Scoped run: `BALANCE_ONLY=<species> npm run balance` — 20–60s, never writes `docs/balance/`. Full run ≈ 15–18 min and is the commit gate.
- Measured conversions: **damage = 0.30 × power**; a pool ≈ 79 HP ≈ 263 power; turns ≈ `263 / power_per_turn × 0.90`.
- §2.3 noise ±4 pts at 150 seeds, ±2.8 at 300.

## Two curve rules proved earlier, still binding

- **An exponential curve is incompatible with a turn-count floor.** Every v1 lost 0/100 — the ramp deck becomes the fastest deck. Structural to the shape, not the constants.
- **A curve change under ~20% is invisible to status cards**, because stacks are whole numbers. Status decks must be re-gated by hand after any curve move, and buffing the attack side is the finer instrument.

## Open items, in the order they should be taken

1. **OPEN — huldra_v1 §2.3 = 0.790, breaching from the HIGH side.** The design expected v1 to be the *weakest* deck in the roster; it came out the strongest. The enabler is **ALLURE_PROXY generating Weakened for free** — no positive-status filter, and ALLY includes self, so `thorn_tithe`'s self-debuff mirrors too (**that is load-bearing, do not "fix" it**) — which `hexbloom` then cashes quadratically: **6.8 Weakened consumed per cast**, hand-pricing to **7.96 against a 6.5 band**. Every authorised knob is exhausted; see ticket 33. **This is an OS decision, not a card one.**
2. **Read ticket 33's knob round before touching `hexbloom`.** Halving the conversion barely moved the skew (0.790 → 0.740) and **collapsed the mirror from 20.6 turns back to 47.7, decided 368/400 → 176/400**. `hexbloom` is not the imbalance, it is the CLOCK — it is what resolves huldra's stall. Enabler, not economics, arrived at from the other direction.
3. **BarkShield decay is NOT the binding constraint.** Swept 0.8 / 0.9 / 0.95: §2.3 moves five points and the mirror not at all — the enemy chips the pool faster than it decays. Left at 0.8. Re-test at the Earth/Ice passes, which inherit it via `glacier_wall`, `stone_bark`, `spiked_carapace`, `shield_shards`.
4. **The budget band is a TARGET, not a law (Henry, ticket 33).** Some cards ship over and some under and that spread is intended — `thorn_tithe` +0.1 and `thornguard` +0.3 are accepted, not redlines to chase. This does not loosen the rule that *imbalance* is fixed at the enabler; it means ±0.3 around a band is normal.
5. **Next species: hel or draugr.** Hel is the most broken thing left — **0/400 decided** at the 61-turn cap.
6. **Sköll is CLOSED (ticket 31).** The cause was the deck's cost curve against a 2-Energy economy, not the stat line and not the daemon: three 2e cards in a 9-card deck makes "0e + one 2e" the whole turn, every turn, locking out all five 1e cards. Fixed by cutting `overdrive`, re-costing `brute_force` 2e → 1e (25 power, +8 with Strength), and softening the stat line to 70/95/55. **0.690 → 0.640, dead 50.9% → 32.3%.** Two useful negatives: a SINGLE 2e swap never clears the band (best is 43.0%), and enlarging the deck moves §2.3 a lot but dead cards barely — the metric counts instances that reached a hand, so a bigger deck just means more instances seen.
7. **STILL OPEN — TREACHERY_KERNEL over-feeds.** Peak Strength on skoll_v1 measures **13.7 stacks in 3.4-turn games** (16.5 at 4.1) against a 12.5-stack damage cap and an 8-stack cap on `CORE_OVERCLOCK`'s scaler. The ramp is pinned by turn 2 and the rest is discarded — which is why dropping that multiplier 1.2 → 1.10 moved the mirror by 0.02 turns. "Gets scarier the more it is hurt" never plays as a *curve*. Nothing in the card layer can fix that; it is a firmware-generosity question and it is the natural next sköll ticket.
8. **`brute_force`'s OS-guaranteed-conditional redline is closed** by the re-cost. It took the 0.7 uncertainty discount while the OS made Strength near-certain — priced as certain it was 72 power against a 65 cap; at 25+8 it is 33 against 30. **The general problem remains:** powerscale is per-card static analysis with no deck or OS context and will never flag this class. Check it by hand whenever a conditional's trigger is something the firmware supplies.
9. **Henry's law for per-stack scaling attacks (ticket 32):** they should **underperform early and overperform late** — that is the shape, not a bug. **Never cap pre-emptively.** `STRENGTH_STACKS`' cap was added AFTER measurement showed `momentum_crash` at 29.3 dmg/play; `DAZED_STACKS` shipped uncapped and needed no cap (`slander` measured 13.7 stacks at cast for 16.8 dmg/play — on rate). Corollary: **a scaling card's static score is a FLOOR, not a price** — powerscale prices at `ASSUMED_STATUS_COUNT = 3` while the deck built around the card sees 13.7. Always hand-price against the deck's realistic count and say so in the ticket.
10. **powerscale scores daemons now (ticket 32).** They carry empty `actions`, so all nine used to score 0.00 and the "Daemon Premium ×1.5" multiplied nothing. Hook `do` actions are scored once × `EXPECTED_DAEMON_PROCS = 4`; `GENERATE_CARD` is priced as the generated card's own score, recursively, with a `seen` guard. Also a floor — `echo_chamber_v2` scores 4.90 but runs at ~2× that in the deck built for it. **Hooks with no `do` array still score 0 and that is correct** (`core_overclock_daemon` is a multiplier, `einherjar_standard` a passive — the model declines to invent a number). **One new redline: `fertile_ground_daemon` 7.60 vs a 6.5 band** — follow-up ticket, not re-tuned.
11. **Check the prompt's baseline before trusting it.** Ticket 32's prompt said ratatoskr failed three of five bands; at HEAD it failed none, because ticket 30 had given `pollen_cloud` (in his placeholder list) real damage. It also sized `slander` against a `crippling_vine` that ticket 30 had reverted 8 Dazed → 2. Re-baseline first; a prompt written against an older commit ages fast right now.
12. **`scorch` was collateral damage from the Burn overflow fix** — a 2e card applying 4 Burn, whose 4th stack now overflows for nothing. skoll_v2's whole Burn plan delivers only 4.9 HP/game residual. Re-cost it.
13. **CORRECTION to ticket 29's "model blind spot" list.** `scry`, `keen_edge`, `soothe`, `spiked_carapace`, `equilibrium`, `acid_splash`, `curse_mark` are NOT blind spots — DRAW (15 power/card), ENERGY (20/point), HEAL, BarkShield and Poison are all priced, and all seven return an empty `manualReview`. They are ordinary rework candidates. The genuinely unpriced set is three cards using `MANUAL_REVIEW_TYPES`: `scavenge_data` (SEARCH), `reprogram` (PLAY_LAST_CARD), `purify` (CLEANSE) — they score 0.00 and flag themselves.
14. **Scoring bug, found and NOT fixed:** `soothe` removes a debuff via negative stacks, but the scorer takes `Math.abs(stacks)` before the debuff-on-self sign flip, so removing a debuff is priced as applying one. `soothe` scores **-0.80** against a 1.0 cap. Any cleanse-by-negative-stacks card is mispriced the same way.
15. **The status-percentage question is CLOSED — do not reopen it.** 2%/stack and the 25% cap stay. Raising to 4.5% was derived, built, measured and reverted: it shrinks the cap from 12.5 stacks to 5.6, and it silently multiplies **13 OS/daemon hooks by 2.25x** with none of it visible to powerscale, because firmware is not card data and is never audited. Status cards that cannot fill a budget on stacks spend the rest on a SECOND EFFECT — riders are cheap: ATTACK 10 power = 1.0 score, HEAL 10 = 0.75, DRAW 15/card, ENERGY 20/point, BarkShield 4/%maxHP, Stunned 55.
16. **`Side` scope on a debuff is dangerous.** The AI's targeting bucket sends `Side`/`All` cards to BOTH parties, so a side-scoped debuff can be aimed at your own Mingming. A 0e side-wide Daze draft of `disorienting_gust` cost sleipnir 0.310 → 0.260 before it was re-cut single-target.
17. `corrosive_leak` +1.8 budget redline, open since ticket 20.
18. **Deferred by decision:** type-matrix tuning + AI-determinism (blowouts are legacy deck quality, not the matrix); valkyrie v1 team measurement (needs ticket 05 team scenarios); fafnir/gullinbursti split (settles in the Earth pass).

## Process

- **Sequencing (Henry):** every remaining deck gets a FIRST PASS before any deep tuning. Process + lightweight gate: [research/first-pass-process.md](research/first-pass-process.md). 10-80-10 division: design/analysis on the primary model, mechanical work delegated via prompts with exact anchors + tolerances + STOP conditions.
- Deck rulebook (ticket 04): 8 cards base (up to 12), ≤2 copies, three tiers (None/neutral = no STAB by design; element-shared; 30–50% OS-specific), one 3e payoff where the OS wants it. Each element pass retires its 0e poke twin into Tackle (`water_slap` id).
- **Henry's rules:** numbers move in 5s; ONE change per sim; he reviews ALL deck lists and card changes before registry commits; reports need a card appendix (in-game text for every referenced card) + archetype framing.
- **Repo law:** CRLF for engine `.ts` and `docs/wayfinder`; LF for tests, `src/debug`, and JSON. `programs.json` round-trips byte-exact under `json.dumps(d, indent=4, ensure_ascii=False)` with no trailing newline. **`hooks.json` does NOT** — its inline arrays expand on a JSON round-trip, so edit it surgically as text. If `git diff --stat` shows a whole file changed, you converted its endings; fix before committing.
- One commit per ticket, author `Henry Dunphy <hdunphy15@gmail.com>` via `git -c user.name=... -c user.email=... commit --author=...`. Never stage `package-lock.json` or `node_modules`. Balance re-baselines commit **only** `docs/balance/balance_report.json` — the CSVs are deliberately stale (precedent `868dd9a`).
- If git locks are un-deletable ("Operation not permitted"), `mv` them into `_to_delete/git-locks/`.

## Design notes captured mid-flight

- **Water daemon gap (Henry):** Water shipped with no daemon card — add one in a later Water polish pass.
- **Air pricing principle (Henry):** both Air OSes generate free value (Str stacks / free tokens), so Air cards may want to be DELIBERATELY under-curve — test during the deep pass, don't "fix" under-curve Air cards to budget blindly.
- **Enabler-first is proven three times** (kraken OS decomposition, MOMENTUM_DRIVE, Burn overflow). When a §2.3 gap resists the card knobs, suspect a capped or under-paying OS — or a mechanic the auditor cannot price — before touching card economics.
- **Anti-deadlock margin to watch (ticket 23):** capped Weakened × Sharp now floors to 1 damage instead of 2. The 25% cap still prevents a true stall, but re-check that case if the pace divisor is ever raised again.
