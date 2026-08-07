# HANDOFF — deck-archetypes map (keep this current every session)

*Last updated: 2026-08-07, after tickets 26 (Fire decks), 27 (AI eval) and 28 (balance-model bug fixes) landed; ticket 29 (status top-up + descriptions) is in the working tree. If you are a fresh session (any model): read this, then map.md, then the ticket you're assigned.*

## Read this first: which band applies

There are TWO bands and they are not the same bar.

- **First-pass band, 0.30–0.70 §2.3.** This is the working bar while every species gets its initial pass. **Use this one.**
- **Strict ±15% (0.35–0.65).** The auditor's own `osMaxGap` assertion in `balanceReport.ts`. It will redline species that are fine by first-pass standards. **Henry's instruction: ignore it for now — it is for the final tuning pass once all elements are in.** Do not spend knob rounds chasing it.

Dead cards ≤0.35 **per side**, FTK 0, and mirror ≤30 turns still apply at first pass.

## Where things stand

- Branch **card-dev**. Tickets 01–28 closed; 29 in flight. **6 of 16 species tuned** (kraken, jormungandr, sleipnir, hraesvelgr, fenrir, sköll). The other 10 are placeholders — **do not read their numbers as balance signal.**
- **Latest full gate (after ticket 28), tuned species only:**

  | species | §2.3 | mirror turns | dead cards |
  |---|---|---|---|
  | kraken | 0.540 | 5.1 | 10.1% |
  | fenrir | 0.394 | 5.2 | 25.4% |
  | sleipnir | 0.360 | 4.5 | 15.3% |
  | jormungandr | 0.340 | 6.7 | 5.5% |
  | hraesvelgr | 0.310 | 3.2 | 4.0% |
  | sköll | 0.650 | 3.7 | **45.9%** ← only open band breach |

- **THE CURVE IS rev 3.4: `10 / 30 / 65 / 105`, bands `1.0 / 3.0 / 6.5 / 10.5`.** The constants have not moved since rev 3.3 — rev 3.4 is five *pricing* corrections, all documented in `power_curve_spec.md`. **`powerscale.ts` is the executable truth; where the prose disagrees, powerscale wins.**
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

1. **Sköll dead cards 45.9%** (band 0.35) — the only open first-pass breach. Diagnosis is done, see below.
2. **`brute_force` is the sköll pace driver**: 2e, **33.0 damage per play** against a 19.5 rate for its cost, cast 1.25×/game. It scores exactly at cap (6.50) only because its `+22 power if you have Strength` takes the 0.7 conditional discount — while skoll_v1's TREACHERY_KERNEL grants Strengthened every time sköll is hit, making the condition near-certain. **powerscale cannot see OS-guaranteed conditionals and never will**; this needs a manual call.
3. **Sköll's dead cards are a pace symptom, not bad cards.** The game ends in 3.73 turns having drawn ~40 card instances against ~11 energy of casting. v1 play rates: `adrenaline` 27%, `overdrive` 46%, `fire_punch_v2` 48%, `fury_strike` 49%, `core_overclock_daemon` 50%. Slow the deck (brute_force) before touching the cards.
4. **`scorch` was collateral damage from the Burn overflow fix** — a 2e card applying 4 Burn, whose 4th stack now overflows for nothing. skoll_v2's whole Burn plan delivers only 4.9 HP/game residual. Re-cost it.
5. **The 11 cards ticket 29 deliberately did not top up** — 7 model blind spots (DRAW/CLEANSE/shield priced at zero) and 5 drawback cards. Listed in `power_curve_spec.md` rev 3.4. Do not "fix" them mechanically.
6. **Are 2%/stack statuses under-powered?** At the honest price a pure status card cannot fill a 2e budget without hitting the 25% cap. Either statuses get stronger than 2%/stack, or status cards always need a rider. Open design question — decide before the remaining 10 species get their first pass, not after.
7. `corrosive_leak` +1.8 budget redline, open since ticket 20.
8. **Deferred by decision:** type-matrix tuning + AI-determinism (blowouts are legacy deck quality, not the matrix); valkyrie v1 team measurement (needs ticket 05 team scenarios); fafnir/gullinbursti split (settles in the Earth pass).

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
