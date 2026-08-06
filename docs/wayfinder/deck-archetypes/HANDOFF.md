# HANDOFF — deck-archetypes map (keep this current every session)

*Last updated: 2026-08-06, after ticket 20 design + overnight sims. If you are a fresh session (any model): read this, then map.md, then the ticket you're assigned.*

## Where things stand

- Branch **card-dev**. Tickets 01–19 closed. **Ticket 20 (Water retune) implementation is delegated** to a secondary-model session via a crafted prompt (TIDAL_CRUSH 30→20%, kraken v1 ink_cloud→surge_protection, ink_stream 15, corrosive_bolt 5, hydro_blast description fix, ticket 20/map/ticket-17-timing docs, one commit). If its commit (message starts "Water retune (ticket 20)") is NOT in git log, that work may still be pending — do not duplicate it.
- **Water complete after ticket 20 lands** (kraken §2.3 ≈48, jorm ≈53.5, mirrors clean). 12 species remain.
- **Sequencing (Henry):** every remaining deck gets a FIRST PASS before any deep tuning. Process + lightweight gate: [research/first-pass-process.md](research/first-pass-process.md). 10-80-10 division: design/analysis on the primary model, mechanical work delegated via prompts with exact anchors + tolerances + STOP conditions.
- **Deferred by decision:** type-matrix tuning + AI-determinism work (blowouts persist at 1.05× effectiveness — legacy deck quality, not the matrix); valkyrie v1 team measurement (needs ticket 05 team scenarios); fafnir/gullinbursti split (settles in the Earth pass).

## Key facts a fresh session needs

- Measurement stack: ticket 19's AI (mechanics eval + 1-turn lookahead + IV jitter 15±5). §2.3 noise ±4pts at 150 seeds, ±2.8 at 300. Scoped runs: `set BALANCE_ONLY=<species>&& npm run balance` (seconds; never writes docs/balance). Full run = the commit gate.
- Rev-3 curve: damage 50E−10 (0e=10, 1e=40, 2e=90, 3e=140); status prices in powerscale.ts; budget bands 1.0/4.0/9.0/14.0. Cards STAY on-curve — fix enablers (OS/deck structure), never bend card economics (Henry's law, proven by the kraken OS decomposition).
- Deck rulebook (ticket 04): 8 cards base (up to 12), ≤2 copies, three tiers (None/neutral = no STAB by design; element-shared; 30–50% OS-specific), one 3e payoff where the OS wants it. Each element pass retires its 0e poke twin (gust_jab/frost_jab/rock_throw/radiant_spark/shadow_claw/leaf_blade) into Tackle (`water_slap` id).
- Henry's rules: numbers move in 5s; he reviews ALL deck lists and card changes before registry commits; reports need a card appendix (in-game text for every referenced card) + archetype framing (see memory: feedback_report_format).
- Repo law: CRLF for engine .ts and docs/wayfinder; LF for tests, src/debug, and json files. One commit per ticket, author Henry Dunphy <hdunphy15@gmail.com>, never commit package-lock.json. If git locks are un-deletable ("Operation not permitted"), mv them into `_to_delete/git-locks/`.
- Overnight sim evidence (~200 measurements) lives in the primary session's workspace; conclusions are in ticket 20's resolution and [research/first-pass-process.md](research/first-pass-process.md). Reference decks drafted for fenrir/draugr/valkyrie/ratatoskr (uncalibrated, in report appendices) are starting points for those passes.

## Next actions

1. Verify the ticket-20 commit landed; if its docs placeholders are unfilled, finish them from docs/balance/balance_report.json.
2. Run the first-pass loop (research/first-pass-process.md) for the next species Henry picks. Fire/fenrir, Air/sleipnir, Dark/hel were proposed as the first trio (sleipnir §2.3 0/100 and hel 100%-draws are the most broken; fenrir near-balanced with the biggest card pool).
3. After each pass: update this file, the ticket, and the map decision line in the same commit.

## Design notes captured mid-flight (2026-08-06, sleipnir session)

- **Water daemon gap (Henry):** Water shipped with no daemon card - add one in a later Water polish pass.
- **Air pricing principle (Henry):** both Air OSes generate free value (Str stacks / free tokens), so Air cards may want to be DELIBERATELY under-curve - test during the deep pass, don't "fix" under-curve Air cards to budget blindly.
- Sleipnir first pass in progress: v1 = zoo aggro (12 cards, 4-5 zero-costs, Henry's spec); v2 direction under discussion (token-buff cavalry vs discard-cost cavalry - recommendation: discard-cost, keeps WAR_STEED_OS unchanged, tokens become fodder currency; needs a DISCARD-cost action handler which hraesvelgr's windmill will reuse).
