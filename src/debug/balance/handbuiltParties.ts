/**
 * HAND-BUILT PARTIES — a deck somebody designed, measured against a real gym boss.
 *
 * # WHY THIS EXISTS
 *
 * Henry, 2026-08-30, on the first three-gym table:
 *
 * > *"you just threw together all V1 decks and the v1s going against the water boss do not have any
 * > synergy. also, part of the boss deck building was we added a bunch of neutral cards that are
 * > supposed to counter those boss decks. you don't have any of those cards in there... the whole
 * > point of 3v3 and the boss set up is that type advantage cannot carry a win by itself. you also
 * > have to have decks, energy and some counter cards."*
 *
 * He was right on both counts, and both are structural rather than oversights in one run:
 *
 *  1. **`lineupAgainst` cannot build a mixed-firmware team.** `drawFromElement` picks each slot as
 *     `firmwares[index % firmwares.length]` using the SAME `index` for every slot, so a sample is
 *     all-v1 or all-v2 and nothing else. Every real party is a mix.
 *  2. **`deckFor` deals the 18-card START deck only** — no drafted picks, no market buys, no
 *     removals. A party arrives at a gym after ~8 fights of pick-1-of-3 and three market visits, so
 *     the measured deck is not a deck anyone would take into a boss fight.
 *
 * Those two together mean the `favourable` arm measures **type preparation and nothing else**. This
 * module measures the other thing: a party and a deck chosen on purpose.
 *
 * # WHAT IS AND IS NOT SUBSTITUTED
 *
 * ONLY the lineup, the party instances and the deck. The offer, the run seed, the region graph, the
 * node, the encounter roll, the boss, its Driver, its IVs and the enemy AI tier are all built by the
 * same code path as every other arm, from the same seed stride. So a hand-built number is directly
 * comparable to the `favourable` and `control` numbers at the same cell and gym — the party is the
 * one variable.
 *
 * # DECK SIZE IS A DESIGN PARAMETER, NOT A CONTAINER
 *
 * A 3-member party draws `sum(cardDraw) - alive + 1` a turn, which at the launch statlines is
 * **7 cards a turn**. A boss fight that lasts 3.5 turns therefore sees about **25 cards**. At 26 the
 * deck cycles almost exactly once and every card is drawn; past that, each extra card is a card the
 * fight never reaches AND a dilution of the ones that matter. That is the arithmetic behind Henry's
 * *"that's too many cards"* — it is not a preference, the fight is simply shorter than a big deck.
 */

export interface HandbuiltParty {
    readonly id: string;
    /** One line for the report header — what this build is trying to do. */
    readonly label: string;
    /** OS ids in party order. Species must be distinct (the no-duplicate-species law). */
    readonly lineup: ReadonlyArray<string>;
    /**
     * The WHOLE deck, as card dataIds. Not validated against `minimumActiveDeck` — see above.
     *
     * **Omit it to use the run-dealt start deck for this lineup.** That is the right choice when the
     * party is the variable under test and the deck is not: a playtested team should be measured with
     * the cards the run actually hands it, not with a list somebody transcribed from a save.
     */
    readonly deck?: ReadonlyArray<string>;
}

/**
 * TIDEWRACK COUNTER, build 1 — the 2-1 shape with an actual plan behind it.
 *
 * # THE READ ON THE FIGHT
 *
 * Tidewrack does **55.8 damage a turn** against Emberfall's 32.3, and it does it by converting its
 * own card flow into damage twice inside one turn: `ink_stream` x4 at 33 power per TRIGGERED draw,
 * `serpents_coil` x2 at 10 power per card PLAYED, on a side that plays 5-7 cards a turn. Then
 * `skoll_v2` closes with `overdrive` (54) and `glass_cannon` (45) riding stacked Strength, at 1.5x
 * into the two Nature bodies the 2-1 shape asks you to bring.
 *
 * **Mitigation cannot answer that.** `STATUS_MODEL` pays 1 power per stack, so three Sharp against a
 * 33-power hit is a 9% reduction. The only lever that reaches the payoff is the flow itself.
 *
 * # THE PARTY, AND WHY EACH SLOT
 *
 *  - **huldra_v1** (Nature) — the converter. `hexbloom` reads *"1 Poison per stack of Weakened on
 *    the target, then remove the Weakened"* (ticket 136c; it was x2 and left the pile standing),
 *    which turns every Weakened into poison once. Nothing else in the launch pool does that.
 *  - **ratatoskr_v2** (Nature) — the applier that feeds it. `pollen_cloud` is 0-energy Weakened, and
 *    `crippling_vine` is the single best launch card into this boss: 2 Weakened (blunts), 2 Dazed
 *    (target-Dazed is +1 power per stack to MY hits) and 3 Poison, all on one card.
 *  - **kraken_v2** (Water) — the energy plan and the answer to `skoll_v2`. `capacitor` is +2 energy
 *    next turn AND 3 Sharp on one card; `hydro_blast` is 105 power at 1.5x into Fire, which is a
 *    body that can actually kill the closer rather than merely not being eaten by it.
 *
 * Deliberately **not kraken_v1**: that is a draw engine that mirrors the boss's own plan and loses
 * the mirror. And deliberately **mixed firmware** — v1 on huldra, v2 on the other two — which is
 * exactly the team shape `lineupAgainst` cannot produce.
 *
 * # THE COUNTERS, WHICH IS THE POINT
 *
 * `riptide` and `short_circuit` are ticket 69's ruled Tidewrack answers, printed 2026-08-30. They
 * tax the two halves of the engine separately — breadth (cards played) and depth (engine draws) — so
 * a zoo pays both. `hamstring` x2 is the third counter flavor and doubles as `hexbloom` fuel.
 *
 * # THE POISON CLOCK IS NOT INCIDENTAL
 *
 * Poison is not reduced by Sharp and does not care that the boss out-damages you, and the boss is
 * already helping: `corrosive_leak` poisons ITSELF 2 stacks for an Energized. So the Weakened the
 * deck applies for mitigation converts into a clock that runs while you survive.
 *
 * # THE HONEST RISK
 *
 * This is a 2-energy-heavy deck against a boss that currently kills in 3.4 turns. The bet is that
 * Sharp, Weakened and the two taxes buy turns 4-6 and the clock closes inside them. If it does not,
 * that is evidence the answer is not a deck at all.
 */
const TIDEWRACK_COUNTER_V1: HandbuiltParty = {
    id: 'tidewrack_counter_v1',
    label: 'Weakened->Poison conversion behind Sharp, with both flow taxes (2 Nature + 1 Water)',
    lineup: ['huldra_v1', 'ratatoskr_v2', 'kraken_v2'],
    deck: [
        // huldra_v1 — the converter, plus the forced generics
        'growth', 'growth', 'iron_bark', 'thorn_tithe', 'hexbloom',
        'water_slap', 'water_slap', 'water_slap',
        // ratatoskr_v2 — the Weakened/Dazed applier
        'pollen_cloud', 'pollen_cloud', 'nagging_bite', 'nagging_bite', 'crippling_vine',
        // kraken_v2 — energy, and the answer to skoll_v2
        'capacitor', 'capacitor', 'surge_protection', 'surge_protection', 'hydro_blast',
        // Bought and drafted: the counters, the second copies, and the two pieces of insurance.
        // `shrug_off` is not filler — `thorn_tithe` self-inflicts 3 Weakened and huldra_v1's kit
        // forces it, so the deck needs a way to take it back off.
        'riptide', 'short_circuit', 'hamstring', 'hamstring',
        'hexbloom', 'crippling_vine', 'shrug_off', 'soothe',
    ],
};

/**
 * THE PLAYTEST PARTY — Henry beat Tidewrack with this on 2026-08-31, and it is the first team that
 * has.
 *
 * `ratatoskr_v2` + `huldra_v1` + `kraken_v2`. Henry, after the win: *"it was rough at times."* He
 * finished on one body at turn 7.
 *
 * # WHY IT IS WORTH A MEASURED ARM
 *
 * It won the way the data said this fight has to be won — by REMOVING BODIES, not by surviving.
 * From his log: `Surge Protection -> Skoll -> 32 damage DEFEATED` on turn 2, and Maelstrom kills
 * their kraken on turn 4. Two of three boss bodies gone before turn 5, which cuts the boss's rate
 * without touching the player's. The hand-built mitigation deck (13.3%) never removed one.
 *
 * It also **runs no `ink_stream`**, which matters for the arms: the card is in both the generated
 * player deck and the boss pile, so every previous nerf to it hit both sides. Against this party a
 * cut to `ink_stream` is finally a one-sided change.
 *
 * # NO DECK LIST, DELIBERATELY
 *
 * `deck` is omitted so the arm is dealt the ordinary run start deck for this lineup — which is what
 * Henry played. The variable under test is the PARTY. Transcribing his deck would freeze one
 * shuffle's worth of drafting into a constant and quietly make the arm about that instead.
 */
const TIDEWRACK_PLAYTEST_V1: HandbuiltParty = {
    id: 'tidewrack_playtest_v1',
    label: "Henry's playtest team — the first party to beat Tidewrack (2 Nature + 1 Water, run-dealt deck)",
    lineup: ['ratatoskr_v2', 'huldra_v1', 'kraken_v2'],
};

export const HANDBUILT_PARTIES: Readonly<Record<string, HandbuiltParty>> = {
    [TIDEWRACK_COUNTER_V1.id]: TIDEWRACK_COUNTER_V1,
    [TIDEWRACK_PLAYTEST_V1.id]: TIDEWRACK_PLAYTEST_V1,
};

export function handbuiltParty(id: string): HandbuiltParty | undefined {
    return HANDBUILT_PARTIES[id];
}
