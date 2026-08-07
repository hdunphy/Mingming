# HANDOFF — deck-archetypes map (keep this current every session)

*Last updated: 2026-08-07, after ticket 22 (hraesvelgr / Air complete) landed. **RUN THE AIR PROMPT NEXT** - hraesvelgr (ticket 22) and sleipnir both need re-gating under the new pace. If you are a fresh session (any model): read this, then map.md, then the ticket you're assigned.*

## Where things stand

- Branch **card-dev**. Tickets 01–25 closed. **Air is complete — 8/32 decks live.** **Ticket 22 (hraesvelgr) is written and its patch exists but is NOT committed** - it stopped on the dead-card band under the OLD pace; re-run it under rev 3.1.
- **THE CURVE IS NOW rev 3.3 (ticket 25): `10 / 30 / 65 / 105`, budget bands `1.0 / 3.0 / 6.5 / 10.5`.** Tuned §2.3 kraken 0.57 / jorm 0.33 / sleipnir 0.38; mirrors 5.1 / 6.6 / 4.4 — **average 5.40 turns, floor 3.8, FTK 0 registry-wide.** Pace target met. Two hard-won rules live in the spec's rev-3.2 note: an **exponential curve is incompatible with a turn-count floor** (every v1 lost 0/100 — the ramp deck becomes the fastest deck), and **a curve change under ~20% is invisible to status cards** because stacks are whole numbers, so status decks must be re-gated by hand and buffing the attack side is the finer instrument.
- **`powerscale.ts` is the executable truth; `power_curve_spec.md` prose is rev 3 with rev-3.1 and rev-3.2 amendments appended.** Where they disagree, powerscale wins.
- Pace history (ticket 23, rev 3.1): `calculateDamage` divisor `/35` -> `/45`. A full turn was removing 60-70% of a health pool, so evens ended in 3-4.5 turns and every build-over-time archetype was dead on arrival. Evens now land at **4.4-6.0 turns**, routs ~3, FTK still 0 registry-wide. **Card budgets and prices are UNCHANGED and should stay that way** - a global divisor moves absolute pace only, never relative card economics. Any number measured before 2026-08-06 evening is stale.
- **Water complete and re-gated under the new pace** (ticket 23): kraken §2.3 **0.62** with no knobs, jorm **0.33** after the predicted v2-ward flip (corrosive_bolt 5→4, acid_splash 2→1 - poison attrition finally has the turns to build). Mirrors 400/400 decided at 4.4 / 6.0 turns.
- **Sleipnir complete** (ticket 21: §2.3 0.00 → 0.59, no knob rounds spent) but **drifted to 0.55 / 3.2 turns under the new pace** - still in band, re-confirm it in the Air pass. The lesson worth carrying: the gap was the OS, not the cards — MOMENTUM_DRIVE paid 1 Strengthened per 0-cost card into a ±25% status cap, so v1's whole engine was invisible. Fixed by 1→2 stacks plus a `STRENGTH_STACKS` power scaler that reads RAW stacks, and a payoff card (Momentum Crash).
- **`DISCARD` action exists** (`{"type":"DISCARD","count":N}`, own hand, deterministic priority: discardEffect cards → cheapest → hand order). Two engine gotchas are documented in ticket 21: `action.count` was already the reducer's multi-hit repeat, and DISCARD must self-target or a lethal hit skips its own cost. `hraesvelgr_v1 GALE_FORCE_OS` already listens on `onDiscarded`.
- **Hraesvelgr is the other half of Air** — ticket 22, STOPPED and not committed. Under the OLD pace its blocker was the **dead-card band** (v1 0.49-0.53 vs a 0.35 ceiling), not §2.3: hraesvelgr draws 4 cards a turn on 2 Energy, so it sees roughly twice what it can cast. Longer games under rev 3.1 should help that directly - re-measure before touching the deck. 11 species remain after it.
- **Sequencing (Henry):** every remaining deck gets a FIRST PASS before any deep tuning. Process + lightweight gate: [research/first-pass-process.md](research/first-pass-process.md). 10-80-10 division: design/analysis on the primary model, mechanical work delegated via prompts with exact anchors + tolerances + STOP conditions.
- **Deferred by decision:** type-matrix tuning + AI-determinism work (blowouts persist at 1.05× effectiveness — legacy deck quality, not the matrix); valkyrie v1 team measurement (needs ticket 05 team scenarios); fafnir/gullinbursti split (settles in the Earth pass).

## Key facts a fresh session needs

- Measurement stack: ticket 19's AI (mechanics eval + 1-turn lookahead + IV jitter 15±5). §2.3 noise ±4pts at 150 seeds, ±2.8 at 300. Scoped runs: `set BALANCE_ONLY=<species>&& npm run balance` (seconds; never writes docs/balance). Full run = the commit gate.
- Rev-3 curve UNCHANGED by the pace amendment: damage 50E−10 (0e=10, 1e=40, 2e=90, 3e=140); status prices in powerscale.ts; budget bands 1.0/4.0/9.0/14.0. Only the global divisor moved. Cards STAY on-curve — fix enablers (OS/deck structure), never bend card economics (Henry's law, proven by the kraken OS decomposition).
- Deck rulebook (ticket 04): 8 cards base (up to 12), ≤2 copies, three tiers (None/neutral = no STAB by design; element-shared; 30–50% OS-specific), one 3e payoff where the OS wants it. Each element pass retires its 0e poke twin (gust_jab/frost_jab/rock_throw/radiant_spark/shadow_claw/leaf_blade) into Tackle (`water_slap` id).
- Henry's rules: numbers move in 5s; he reviews ALL deck lists and card changes before registry commits; reports need a card appendix (in-game text for every referenced card) + archetype framing (see memory: feedback_report_format).
- Repo law: CRLF for engine .ts and docs/wayfinder; LF for tests, src/debug, and json files. One commit per ticket, author Henry Dunphy <hdunphy15@gmail.com>, never commit package-lock.json. If git locks are un-deletable ("Operation not permitted"), mv them into `_to_delete/git-locks/`.
- Overnight sim evidence (~200 measurements) lives in the primary session's workspace; conclusions are in ticket 20's resolution and [research/first-pass-process.md](research/first-pass-process.md). Reference decks drafted for fenrir/draugr/valkyrie/ratatoskr (uncalibrated, in report appendices) are starting points for those passes.

## Next actions

1. **Run the Air prompt NEXT** — it re-gates sleipnir and lands ticket 22 (hraesvelgr) under the rev-3.1 pace: v1 GALE_FORCE discard windmill, v2 UPDRAFT burn-X ramp, X-cost mechanic, `gust_jab` retired into Tackle. Its patch (engine + cards + decks, 17 files) applies to `e627fe6`.
2. Then run the propose-3 step (research/first-pass-process.md) for the next species — **hel / fenrir / draugr** are the standing candidates (hel's 100%-draws are the most broken; fenrir is near-balanced with the biggest card pool).
3. After each pass: update this file, the ticket, and the map decision line in the same commit.

## Design notes captured mid-flight (2026-08-06, sleipnir session)

- **Water daemon gap (Henry):** Water shipped with no daemon card - add one in a later Water polish pass.
- **Air pricing principle (Henry):** both Air OSes generate free value (Str stacks / free tokens), so Air cards may want to be DELIBERATELY under-curve - test during the deep pass, don't "fix" under-curve Air cards to budget blindly.
- Sleipnir first pass DONE (ticket 21) — discard-cost cavalry was the right call for v2: WAR_STEED_OS never changed and its tokens became the fodder currency.
- **Enabler-first is now proven twice** (kraken OS decomposition, then MOMENTUM_DRIVE). When a §2.3 gap resists the card knobs, suspect a capped or under-paying OS before touching card economics.

- **Anti-deadlock margin to watch (ticket 23):** capped Weakened × Sharp now floors to 1 damage instead of 2. The 25% cap still prevents a true stall, but re-check that specific case if the pace divisor is ever raised again.
