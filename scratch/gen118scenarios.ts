/**
 * TICKET 118 — generate the playtest scenario files.
 *
 * Henry, 2026-08-26: *"I can't playtest until tomorrow anything to do balance wise before then? If
 * not just write up the scenarios so I can easily just load them in and use my time efficiently."*
 *
 * Deck lists are pulled from `MingmingRegistry` rather than typed by hand - six scenarios at up to
 * 27 cards each is a lot of card ids to get wrong silently, and a wrong id would either throw on
 * load or, worse, quietly build a smaller deck. The `registryHash` is stamped from the live
 * registries so the launcher shows no mismatch banner today; it will start warning after the next
 * card change, which is the banner doing its job rather than the file being broken.
 *
 * Every file is validated through `ComposedScenarioSchema` before it is written, so nothing lands
 * on disk that the launcher would reject.
 *
 * Run: npx vite-node scratch/gen118scenarios.ts
 */
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ComposedScenarioSchema, CURRENT_SCENARIO_VERSION } from '../src/debug/scenarios/scenarioSchema';
import { computeRegistryHash } from '../src/debug/scenarios/registryHash';
import fs from 'node:fs';
import path from 'node:path';
import { ENV } from './_env';

const OUTDIR = ENV.OUTDIR ?? 'src/debug/scenarios/playtest/ticket-118';
const HASH = computeRegistryHash();

const deckOf = (os: string): string[] => {
    const species = os.replace(/_v\d$/, '');
    const def = MingmingRegistry[species] as unknown as { decks?: Record<string, string[]> };
    const d = def?.decks?.[os];
    if (!d?.length) throw new Error(`no deck list for ${os}`);
    return [...d];
};

const member = (os: string) => ({
    definitionId: os.replace(/_v\d$/, ''),
    level: 15, attackIV: 15, defenseIV: 15, hpIV: 15,
    activeOS: os,
});

/** An enemy carries its own deck; `buildScenarioState` flattens the enemy side into one shared pile. */
const enemy = (os: string) => ({ ...member(os), deck: deckOf(os) });

const ZOO = ['jormungandr_v1', 'sleipnir_v1', 'hraesvelgr_v1'];
const CONTROL = ['kraken_v1', 'huldra_v1', 'draugr_v2'];

interface Spec {
    file: string; name: string; description: string; tags: string[];
    player: string[];            // player OS list; shared deck is the concatenation
    enemies: string[];
    /** Override the shared player deck (used by the stacked comps). */
    playerDeck?: string[];
}

const SPECS: Spec[] = [
    {
        file: '01-control-panel-vs-zoo-3v3',
        name: 'Q2 — the control panel vs zoo, 3v3',
        description:
            'THE matchup tickets 115 and 116 moved: 10% -> 40% for control. Every side-scoped card '
            + 'is in here (draugr\'s five) plus kraken\'s side-wide Abyssal Ink. Question is not '
            + 'whether it wins - it is whether the turns feel good or feel like chores.',
        tags: ['playtest', 'ticket-118', 'control', '3v3', 'feel'],
        player: CONTROL, enemies: ZOO,
    },
    {
        file: '02-draugr-alone-vs-three',
        name: 'Q2 — one draugr against three, side cards isolated',
        description:
            'One draugr_v2 facing the whole zoo panel. Deliberately unfair; the point is to SEE a '
            + 'side card land. killing_frost puts 2 Weakened and 2 Dazed on all three at once for '
            + '1 Energy. This is the change in its purest form - and the fastest way to judge '
            + 'whether side-wide resolution is satisfying or just slow.',
        tags: ['playtest', 'ticket-118', 'control', 'side-cards', 'feel'],
        player: ['draugr_v2'], enemies: ZOO,
    },
    {
        file: '03-draugr-v2-vs-jormungandr-1v1',
        name: 'Q2 — the same cards at 1v1, where the buff is invisible',
        description:
            'The control claim behind the whole change: a side-wide card facing ONE body is just a '
            + 'single-target card, so the 1v1 game is untouched. Measured at 96.7% -> 98.3% and '
            + 'confirmed across all 960 grid cells (mean delta +0.00). Play it and check the cards '
            + 'read the same as they always did.',
        tags: ['playtest', 'ticket-118', 'control', '1v1', 'control-check'],
        player: ['draugr_v2'], enemies: ['jormungandr_v1'],
    },
    {
        file: '04-triple-jormungandr-vs-zoo',
        name: 'Q1 — triple jormungandr vs zoo (sim: 86.7%)',
        description:
            'Three of one species, legal since the copy cap came off. Twenty-five hand-built stress '
            + 'comps failed to beat this zoo panel; this one beats it 86.7%. Suspected mechanism: '
            + 'three copies of ink_stream, an uncapped per-card scaler, in one 24-card shared pile. '
            + 'The question playtesting answers is whether it is FUN and whether a run could '
            + 'realistically assemble it.',
        tags: ['playtest', 'ticket-118', 'stacked-species', '3v3'],
        player: ['jormungandr_v1', 'jormungandr_v1', 'jormungandr_v1'], enemies: ZOO,
        playerDeck: [...deckOf('jormungandr_v1'), ...deckOf('jormungandr_v1'), ...deckOf('jormungandr_v1')],
    },
    {
        file: '05-triple-sleipnir-vs-control-panel',
        name: 'Q1 — triple sleipnir vs the control panel (sim: 100%)',
        description:
            'The most extreme number in the stacked-comp set: 100% over 30 games, FTK 0, truncated '
            + '0. Nothing is broken - the ceiling just moved. Worth feeling what a 100% matchup '
            + 'actually looks like from both sides before deciding whether the copy cap needs a '
            + 'replacement.',
        tags: ['playtest', 'ticket-118', 'stacked-species', '3v3'],
        player: ['sleipnir_v1', 'sleipnir_v1', 'sleipnir_v1'], enemies: CONTROL,
        playerDeck: [...deckOf('sleipnir_v1'), ...deckOf('sleipnir_v1'), ...deckOf('sleipnir_v1')],
    },
    {
        file: '06-triple-huldra-vs-zoo',
        name: 'Q1 — triple huldra vs zoo (sim: 26.7%) — the one that FAILS',
        description:
            'The control for question 1, and the reason "stacking is broken" is the wrong '
            + 'conclusion. Same rule, same legality, and it loses badly - 26.7% - despite holding '
            + 'an elemental advantage against all three opponents. Play this next to 04 and 05: '
            + 'whatever separates them is the thing that actually needs a condition, not the '
            + 'stacking itself.',
        tags: ['playtest', 'ticket-118', 'stacked-species', '3v3', 'control-check'],
        player: ['huldra_v1', 'huldra_v1', 'huldra_v1'], enemies: ZOO,
        playerDeck: [...deckOf('huldra_v1'), ...deckOf('huldra_v1'), ...deckOf('huldra_v1')],
    },
];

fs.mkdirSync(OUTDIR, { recursive: true });

for (const s of SPECS) {
    const scenario = {
        version: CURRENT_SCENARIO_VERSION,
        kind: 'composed' as const,
        name: s.name,
        description: s.description,
        tags: s.tags,
        registryHash: HASH,
        createdAt: '2026-08-26T00:00:00.000Z',
        setup: {
            seed: `t118-${s.file}`,
            enemyMode: 'CARDS' as const,
            player: {
                party: s.player.map(member),
                deck: s.playerDeck ?? s.player.flatMap(deckOf),
                relics: [],
            },
            enemies: s.enemies.map(enemy),
            gauntlet: null,
        },
    };

    // Validate BEFORE writing - a file the launcher rejects is worse than no file.
    const parsed = ComposedScenarioSchema.safeParse(scenario);
    if (!parsed.success) {
        console.error(`FAILED ${s.file}:`, JSON.stringify(parsed.error.issues, null, 1));
        process.exitCode = 1;
        continue;
    }
    const out = path.join(OUTDIR, `${s.file}.scenario.json`);
    fs.writeFileSync(out, JSON.stringify(scenario, null, 2) + '\n');
    console.log(`${out}\n   party ${scenario.setup.player.party.length}  `
        + `shared deck ${scenario.setup.player.deck.length} cards  `
        + `enemies ${scenario.setup.enemies.length} `
        + `(${scenario.setup.enemies.reduce((n, e) => n + e.deck.length, 0)} cards)`);
}
console.log(`\nregistryHash stamped: ${HASH}`);
