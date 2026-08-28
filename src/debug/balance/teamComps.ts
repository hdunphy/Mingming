/**
 * TICKET 109: the 3v3 comp suite - the reference panel and the designed stress canary.
 *
 * This is a DELIVERABLE, not scratch: the ticket wants the comp set committed as a reusable suite
 * file, because it becomes a standing gate once the 3v3 game stabilises. Every comp carries its
 * INTENT in one line, so a later reader knows what a comp was built to break rather than having to
 * infer it from the species list.
 *
 * TWO CONSTRUCTION RULES, both assumptions worth stating rather than burying:
 *
 *  1. **One member per SPECIES.** A comp is three different species. The ticket implies this when it
 *     says a max-STAB comp is "2+1 splash" - with two species per element, mono-element is only
 *     reachable if you may not duplicate. Whether the shipped game lets a player field two Skolls is
 *     a design question for Henry; if it does, several comps here get stronger and the max-STAB set
 *     needs re-running.
 *  2. **Decks are the shipped per-OS decks.** `extras` adds cards to a comp's shared pile for the
 *     tag-abuse probes ONLY, in the scenario, never in the registry - the ticket is report-only.
 */

/** `[species, os]`. */
export type Member = readonly [string, string];

export interface Comp {
    /** Stable id - it keys results, so do not rename one without re-running. */
    id: string;
    members: readonly Member[];
    /** One line: what this comp is built to do or to break. */
    intent: string;
    /** Tag-abuse probes only: cards added to the shared pile in-scenario, never to the registry. */
    extras?: readonly string[];
}

/**
 * PART 1's reference panel: six comps, mixed roles and elements, deliberately ORDINARY.
 *
 * The panel is a measuring stick, so it must not itself be a stress test - every canary comp's win
 * rate is read against it, and a panel built from the strongest comps would compress every result
 * toward 50% and hide exactly what the canary is for. Roles are from research/archetype-web.md.
 */
export const REFERENCE_PANEL: readonly Comp[] = [
    {
        id: 'panel-zoo',
        members: [['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']],
        intent: 'The whole zoo/velocity role - it has exactly three decks, so this is the role, not a sample of it.',
    },
    {
        id: 'panel-control',
        members: [['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2']],
        intent: 'Control/attrition: the designated zoo-killer plus the two debuff decks that beat it in 1v1.',
    },
    {
        id: 'panel-ramp',
        members: [['audhumbla', 'audhumbla_v1'], ['ymir', 'ymir_v1'], ['fafnir', 'fafnir_v1']],
        intent: 'Ramp/sustain: heal engine, shield wall, and the Energized banker - the role zoo is supposed to prey on.',
    },
    {
        id: 'panel-burst',
        members: [['fenrir', 'fenrir_v2'], ['hel', 'hel_v2'], ['nidhoggr', 'nidhoggr_v1']],
        intent: 'Burst/berserk, the flex spoke: three decks that convert resources into damage now.',
    },
    {
        id: 'panel-mixed-a',
        members: [['valkyrie', 'valkyrie_v1'], ['ratatoskr', 'ratatoskr_v2'], ['skoll', 'skoll_v1']],
        intent: 'A plausible ladder team rather than a role stack - the team-buff OS with a control body and a bruiser.',
    },
    {
        id: 'panel-mixed-b',
        members: [['gullinbursti', 'gullinbursti_v2'], ['kraken', 'kraken_v2'], ['draugr', 'draugr_v1']],
        intent: 'Second mixed baseline, drawn from the decks the other five panel comps do not use.',
    },
];

/**
 * PART 2's canary. Grouped by what each group is trying to break.
 *
 * `group` is not decoration - the report reads results per group, because "max-STAB is fine but role
 * stacks are not" is a different finding from "one comp is broken".
 */
export interface CanaryComp extends Comp {
    group: 'max-stab' | 'role-stack' | 'tag-abuse' | 'best-guess';
}

export const CANARY_COMPS: readonly CanaryComp[] = [
    // --- Max-STAB: the closest-to-mono team each element allows (2 same-element + 1 splash). ---
    {
        group: 'max-stab', id: 'stab-fire',
        members: [['fenrir', 'fenrir_v1'], ['skoll', 'skoll_v2'], ['hel', 'hel_v1']],
        intent: 'Fire STAB density with a Dark splash - Burn permanence concentrated in one side.',
    },
    {
        group: 'max-stab', id: 'stab-water',
        members: [['kraken', 'kraken_v2'], ['jormungandr', 'jormungandr_v2'], ['ymir', 'ymir_v2']],
        intent: 'Water STAB with an Ice splash - the Poison clock plus ramp, the long-game pairing.',
    },
    {
        group: 'max-stab', id: 'stab-earth',
        members: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1'], ['ratatoskr', 'ratatoskr_v1']],
        intent: 'Earth STAB - the element flagged HIGH for overlap in the archetype-space audit.',
    },
    {
        group: 'max-stab', id: 'stab-air',
        members: [['hraesvelgr', 'hraesvelgr_v1'], ['sleipnir', 'sleipnir_v1'], ['ratatoskr', 'ratatoskr_v2']],
        intent: 'Air STAB - two of the three zoo decks, on the roster\'s two highest cardDraw frames.',
    },
    {
        group: 'max-stab', id: 'stab-nature',
        members: [['ratatoskr', 'ratatoskr_v1'], ['huldra', 'huldra_v1'], ['gullinbursti', 'gullinbursti_v2']],
        intent: 'Nature STAB - huldra\'s Sharp pile alongside ratatoskr control.',
    },
    {
        group: 'max-stab', id: 'stab-ice',
        members: [['ymir', 'ymir_v1'], ['draugr', 'draugr_v2'], ['kraken', 'kraken_v1']],
        intent: 'Ice STAB - shields plus GRAVE_CHILL, the slowest pairing the roster allows.',
    },
    {
        group: 'max-stab', id: 'stab-light',
        members: [['valkyrie', 'valkyrie_v1'], ['audhumbla', 'audhumbla_v1'], ['hel', 'hel_v2']],
        intent: 'Light STAB - the team-buff OS finally has allies, plus hel\'s Light secondary.',
    },
    {
        group: 'max-stab', id: 'stab-dark',
        members: [['hel', 'hel_v1'], ['nidhoggr', 'nidhoggr_v2'], ['draugr', 'draugr_v1']],
        intent: 'Dark STAB - BLOOD_SCENT beside hel\'s self-damage, which should arm it constantly.',
    },

    // --- Role stacks: the wheel taken to its extreme. ---
    {
        group: 'role-stack', id: 'triple-zoo',
        members: [['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']],
        intent: 'Triple zoo - identical to the panel zoo comp by necessity (the role has exactly three decks); run here to read it as a stress comp.',
    },
    {
        group: 'role-stack', id: 'triple-control',
        members: [['ratatoskr', 'ratatoskr_v1'], ['huldra', 'huldra_v2'], ['draugr', 'draugr_v2']],
        intent: 'Triple control - three debuff engines stacking on six bodies; the status-pile width test.',
    },
    {
        group: 'role-stack', id: 'triple-ramp',
        members: [['audhumbla', 'audhumbla_v2'], ['valkyrie', 'valkyrie_v2'], ['fafnir', 'fafnir_v1']],
        intent: 'Triple ramp - if 3v3 games really run 12 turns, ramp gets the time it never had in 1v1.',
    },
    {
        group: 'role-stack', id: 'triple-burst',
        members: [['fenrir', 'fenrir_v2'], ['skoll', 'skoll_v2'], ['nidhoggr', 'nidhoggr_v1']],
        intent: 'Triple burst - the FTK check at width: can three burst decks kill before anything sets up?',
    },
    {
        group: 'role-stack', id: 'triple-sustain-STALL',
        members: [['audhumbla', 'audhumbla_v1'], ['valkyrie', 'valkyrie_v1'], ['gullinbursti', 'gullinbursti_v1']],
        intent: 'THE HEADLINE: three healers/shields - does the roster contain an unkillable game? (FTK\'s inverse.)',
    },

    // --- Tag-abuse: the entity-count watch list, built into comps that maximise each tag. ---
    {
        group: 'tag-abuse', id: 'tag-treachery',
        members: [['skoll', 'skoll_v1'], ['hel', 'hel_v2'], ['fenrir', 'fenrir_v1']],
        intent: 'TREACHERY host + ally-damage feeders: skoll_v1 gains Strength whenever an ALLY is hit, so two more bodies should ~3x the feed - and hel/fenrir damage themselves besides.',
    },
    {
        group: 'tag-abuse', id: 'tag-sidewide-burn',
        members: [['fenrir', 'fenrir_v1'], ['skoll', 'skoll_v2'], ['nidhoggr', 'nidhoggr_v1']],
        intent: 'Side-wide Burn stacking: inferno and heat_wave are Side-target, so their value should scale with enemy count; heat_wave doubles a pile that three appliers built.',
        extras: ['inferno', 'heat_wave'],
    },
    {
        group: 'tag-abuse', id: 'tag-solar-jackpot',
        members: [['skoll', 'skoll_v2'], ['fenrir', 'fenrir_v2'], ['gullinbursti', 'gullinbursti_v1']],
        intent: 'The mandated early revisit: SOLAR_OVERDRIVE (+15% damage per Strength stack, NO CAP) hosting core_overclock_daemon - the daemon+OS compounding jackpot the pool watch-item flagged.',
        extras: ['core_overclock_daemon'],
    },
    {
        group: 'tag-abuse', id: 'tag-rebirth-pile',
        members: [['valkyrie', 'valkyrie_v2'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']],
        intent: 'REBIRTH fires on reshuffle and is predicted ~0 in a 27-card shared pile; paired with the two fastest drawers to give it its best possible chance of proccing.',
    },
    {
        group: 'tag-abuse', id: 'tag-energy-ramp',
        members: [['fafnir', 'fafnir_v1'], ['kraken', 'kraken_v2'], ['hel', 'hel_v2']],
        intent: 'Energy-ramp stacking: HOARD banks Energized, kraken_v2 ramps, hel_v2 makes Energy a dead stat - three ramp economies on three separate pools.',
    },
    {
        group: 'tag-abuse', id: 'tag-antiheal-vs-stall',
        members: [['nidhoggr', 'nidhoggr_v2'], ['jormungandr', 'jormungandr_v2'], ['huldra', 'huldra_v1']],
        intent: 'BLOOD_SCENT is anti-heal by construction (healing re-arms it) - pointed at the stall comp, it is the roster\'s own answer to an unkillable game.',
    },
    {
        group: 'tag-abuse', id: 'tag-poison-at-length',
        members: [['jormungandr', 'jormungandr_v2'], ['kraken', 'kraken_v1'], ['draugr', 'draugr_v2']],
        intent: 'Poison is quadratic and was priced on 5-turn games; three appliers in a 12-turn game is the price indictment Part 1 predicts.',
    },

    // --- Best-guess strongest: PRE-REGISTERED before any 3v3 game was run (ticket requirement). ---
    {
        group: 'best-guess', id: 'guess-1-length-tax',
        members: [['jormungandr', 'jormungandr_v2'], ['audhumbla', 'audhumbla_v1'], ['huldra', 'huldra_v1']],
        intent: 'GUESS 1. A Poison clock that cannot be outrun, behind a healer that makes the game long enough to collect it. Long games are the 3v3 default, and Poison is the status whose value grows fastest with length.',
    },
    {
        group: 'best-guess', id: 'guess-2-treachery-engine',
        members: [['skoll', 'skoll_v1'], ['gullinbursti', 'gullinbursti_v1'], ['fenrir', 'fenrir_v1']],
        intent: 'GUESS 2. TREACHERY behind two high-HP bodies that WANT to be hit. The tag is predicted to feed ~3x; if entity-count scaling is real anywhere, it is here.',
    },
    {
        group: 'best-guess', id: 'guess-3-solar-runaway',
        members: [['skoll', 'skoll_v2'], ['valkyrie', 'valkyrie_v1'], ['audhumbla', 'audhumbla_v2']],
        intent: 'GUESS 3. An uncapped percentage multiplier (SOLAR_OVERDRIVE) given a team buffer and a healer to survive the ramp. Uncapped multipliers plus long games is the classic runaway shape.',
    },
    {
        group: 'best-guess', id: 'guess-4-sharp-wall',
        members: [['huldra', 'huldra_v1'], ['ymir', 'ymir_v1'], ['audhumbla', 'audhumbla_v1']],
        intent: 'GUESS 4. The comp I would ladder with: huldra\'s Sharp pile is what beat draugr in 1v1, behind a shield wall and a heal engine. Wins by not losing.',
    },
    {
        group: 'best-guess', id: 'guess-5-zoo-plus-payoff',
        members: [['sleipnir', 'sleipnir_v1'], ['jormungandr', 'jormungandr_v1'], ['skoll', 'skoll_v1']],
        intent: 'GUESS 5. Post-103 sleipnir plays 3.4 cards a turn; two zoo decks feeding a TREACHERY host that converts the whole board\'s chaos into Strength.',
    },
];

// =================================================================================================
// TICKET 18: the gym gauntlet's boss teams
// =================================================================================================

/**
 * THE EIGHT BOSS TEAMS THE GAME CAN ACTUALLY FIELD.
 *
 * Ticket 18's Done-when: *"FTK/stall gates hold for the boss comps (`teamComps.ts` reused)"*. This
 * is that reuse — the boss teams expressed in the same `Comp` shape as everything above, so
 * `gauntlet-boss.balance.ts` can run them through `teamScenario` with no new machinery.
 *
 * # WHY EXACTLY EIGHT, AND WHY THESE
 *
 * `engine/run/gauntlet.rollGauntletFight` builds the boss team as **one species drawn from each of
 * the run's three biomes**, and every Early Access run walks all three launch elements exactly once
 * (`gyms.offerGyms` rule 3). The launch roster is two species per element — Fire: fenrir/skoll,
 * Water: kraken/jormungandr, Nature: ratatoskr/huldra — so the set of teams the generator can
 * produce is precisely the 2x2x2 product below. This is not a sample of the boss space; it IS the
 * boss space, which is what makes a gate over it meaningful rather than indicative.
 *
 * # THE OS COLUMN IS THE SIGNATURE FIRMWARE, AND THAT IS NOT A CHEAT
 *
 * `Member` is `[species, os]` and a boss's `os` is its `boss_relic_*` id, because that is literally
 * what the shipped entity runs. Its DECK still resolves correctly: no species has a deck keyed by a
 * relic, so `getDeckForOS` falls back to `availableOS[0]`'s tuned list — the same fallback the engine
 * relies on, so `teamScenario(BOSS_COMPS[i].members)` reproduces the shipped boss exactly, deck and
 * firmware both. One shape, one resolution rule, nothing to keep in step by hand.
 *
 * The relic per element is `gauntlet.BOSS_RELIC_BY_ELEMENT`: Fire and Water have signatures named
 * after them and Nature takes the element-neutral ice relic (an Energy tax on programs aimed at a
 * poisoned target — the only one of the three whose effect names no element).
 *
 * # TICKET 68 MADE THIS TABLE PARTIAL, AND KNOWINGLY LEFT IT THAT WAY
 *
 * **These comps now describe Tidewrack and Rootfall only.** Emberfall's boss is hand-authored — a
 * fixed trio running their own tuned OSes behind the side-level Driver WAR FOOTING (`run/bosses.ts`)
 * — so it is not in the 2x2x2 product at all, and no `[species, os]` pair can express it: a Driver
 * is not an `activeOS`, which is the whole of ruling 2.
 *
 * This file is **not** the instrument for the authored bosses and should not grow into one. The
 * right measurement for a hand-authored fight is the run gate pinned to its gym
 * (`npm run balance:run-gate -- --cells gauntlet:fight2 --gym gym_emberfall`), which fights the
 * shipped entity through the shipped roll rather than a reconstruction of it. What this gate is
 * still exactly right for is the FORMULA boss space, and that space shrinks by one gym per authoring
 * session until it is empty — at which point this table goes, rather than being ported.
 *
 * # WHAT A GATE OVER THESE IS WATCHING FOR
 *
 * Two shapes, both of which the relics make plausible rather than theoretical:
 *
 * - **FTK.** FIRE ignites the whole enemy side at the end of every boss turn, and three bosses means
 *   three ticks per round. The player arrives on carried HP with no heal between fights, so a boss
 *   team that can kill on turn one is a run-ender nobody can play around.
 * - **STALL.** WATER heals the boss side 5% max HP *whenever any of them is hit*, which is an
 *   anti-damage engine that scales with how hard the player swings. Three bodies behind it is the
 *   classic unkillable shape, and `triple-sustain-STALL` above is the same watch item on the player
 *   side.
 */
export const BOSS_COMPS: readonly Comp[] = [
    {
        id: 'boss-fenrir-kraken-ratatoskr',
        members: [['fenrir', 'boss_relic_fire'], ['kraken', 'boss_relic_water'], ['ratatoskr', 'boss_relic_ice']],
        intent: 'The default draw: burst Fire, the Poison clock, and control — the fire relic\'s side-wide tick behind a heal engine.',
    },
    {
        id: 'boss-fenrir-kraken-huldra',
        members: [['fenrir', 'boss_relic_fire'], ['kraken', 'boss_relic_water'], ['huldra', 'boss_relic_ice']],
        intent: 'Fire burst plus huldra\'s Sharp pile — the shape that beat draugr in 1v1, now with a team heal under it.',
    },
    {
        id: 'boss-fenrir-jormungandr-ratatoskr',
        members: [['fenrir', 'boss_relic_fire'], ['jormungandr', 'boss_relic_water'], ['ratatoskr', 'boss_relic_ice']],
        intent: 'Poison at length behind the water relic: the ice relic taxes programs aimed at poisoned targets, so the two compound.',
    },
    {
        id: 'boss-fenrir-jormungandr-huldra',
        members: [['fenrir', 'boss_relic_fire'], ['jormungandr', 'boss_relic_water'], ['huldra', 'boss_relic_ice']],
        intent: 'The attrition draw — Poison, Sharp and a reactive team heal. The stall candidate of the eight.',
    },
    {
        id: 'boss-skoll-kraken-ratatoskr',
        members: [['skoll', 'boss_relic_fire'], ['kraken', 'boss_relic_water'], ['ratatoskr', 'boss_relic_ice']],
        intent: 'skoll on the fire relic: SHARP_STACKS scaling meets a Strength engine, the FTK candidate of the eight.',
    },
    {
        id: 'boss-skoll-kraken-huldra',
        members: [['skoll', 'boss_relic_fire'], ['kraken', 'boss_relic_water'], ['huldra', 'boss_relic_ice']],
        intent: 'skoll burst with two debuff bodies — the draw that punishes a player arriving on low carried HP.',
    },
    {
        id: 'boss-skoll-jormungandr-ratatoskr',
        members: [['skoll', 'boss_relic_fire'], ['jormungandr', 'boss_relic_water'], ['ratatoskr', 'boss_relic_ice']],
        intent: 'Both clocks at once: Burn from the fire relic and Poison from jormungandr, against a party that cannot heal between fights.',
    },
    {
        id: 'boss-skoll-jormungandr-huldra',
        members: [['skoll', 'boss_relic_fire'], ['jormungandr', 'boss_relic_water'], ['huldra', 'boss_relic_ice']],
        intent: 'The meanest draw on paper — burst, Poison and Sharp with a reactive heal. If any boss team is over the line, expect it here.',
    },
];

/**
 * Every comp the suite knows about, for harnesses that want to iterate the lot.
 *
 * **`BOSS_COMPS` is deliberately NOT in here.** This list is the player-side corpus — comps built to
 * be *measured against each other* — and a boss team is an opponent the game fields, not a team a
 * player can build (nothing in the run grants a `boss_relic_*` OS). Folding them in would silently
 * change what every existing harness iterating `ALL_COMPS` measures.
 */
export const ALL_COMPS: readonly Comp[] = [...REFERENCE_PANEL, ...CANARY_COMPS];
