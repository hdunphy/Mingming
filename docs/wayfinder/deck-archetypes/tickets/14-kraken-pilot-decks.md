# Kraken pilot: two per-OS decks end-to-end

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: [13-per-os-deck-data-model](13-per-os-deck-data-model.md)

## Question

Run the first species end-to-end through the [template](04-archetype-identity-template.md): design → rev-3 pricing → `npm run balance` → registry, proving the pipeline before the per-element passes fan out. Kraken was picked as the thorough test: a kept deck, a fresh build, an authored card, and two real redlines to move (kraken's ~100% OS gap; the kraken mirror at 54.7 avg turns / 354 draws).

- **kraken_v1 ABYSSAL_INK deck** — his current draw/daze deck, re-sized to the 8–12 window (likely 8) and re-tiered per the template (which cards become element-shared Water vs OS-specific to the ink engine). ~half the deck should feed non-natural draws.
- **kraken_v2 TIDAL_CRUSH deck** — fresh build around 3e+ Water damage: the **new 3e Water payoff card** (priced at the 140-power 3e budget, +30% under the OS — mind the ceiling), ramp/Energized enablers to reach 3 energy on a 2-energy species, and cheap Water attacks that keep him alive to cast it. 30–50% OS-specific.
- **Card work** — the new 3e payoff plus any neutral-tier moves the template implies for cards these decks touch; every new/changed card through `powerscale.ts` grading. No cross-element reskins.
- **Mirror clock** — both decks must carry a win condition that beats the 354-draw stall shape (the audit's known fix directions: less pure daze/draw circling, more closing damage).
- **Sim gate** — §2.3 kraken (v1 deck vs v2 deck — the first *fair* firmware measurement in the project), kraken mirror, and the archetype gauntlet; deck lists + numbers presented to Henry for sign-off before the registry commit.

Done when: both decks in `decks` in the registry, gates green, the kraken §2.3 gap is inside 15% (or the residual is explained and accepted by Henry), the mirror resolves, and the template is confirmed (or amended) as the pattern for the remaining 15 species.
