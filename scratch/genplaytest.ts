/**
 * Ticket 89: authors the playtest scenario pack. Deck lists come from the LIVE registry so a
 * scenario cannot drift from the shipped deck, and the registry hash is stamped so the launcher
 * does not warn on load.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { computeRegistryHash } from '../src/debug/scenarios/registryHash';

const REG = MingmingRegistry as unknown as Record<string, { decks: Record<string, string[]> }>;
const hash = computeRegistryHash();
const speciesOf = (deck: string) => deck.replace(/_v[12]$/, '');
const unit = (species: string, os: string) => ({
    definitionId: species, level: 15, attackIV: 15, defenseIV: 15, hpIV: 15, activeOS: os,
});
const CONTROL_DECK = ['baseline_jab', 'baseline_jab', 'baseline_scuff', 'baseline_scuff',
    'baseline_strike', 'baseline_strike', 'baseline_snare', 'baseline_snare', 'baseline_slam', 'baseline_purge'];

interface Match { file: string; name: string; you: string; foe: string; ask: string }
const MATCHES: Match[] = [
    { file: 'A1-wide-sleipnir_v1', name: 'A1 - the WIDE deck', you: 'sleipnir_v1', foe: 'control',
      ask: 'The AI plays 3.6 cards a turn with this deck. Play A2 straight after: did these feel like two different decks, or one deck with different cards?' },
    { file: 'A2-narrow-fenrir_v1', name: 'A2 - the NARROW deck', you: 'fenrir_v1', foe: 'control',
      ask: '1.8 cards a turn on the lowest HP frame in the game. Same question as A1.' },
    { file: 'B1-kraken_v1-vs-audhumbla_v1', name: 'B1 - a cell the AI never wins', you: 'kraken_v1', foe: 'audhumbla_v1',
      ask: 'The AI loses this 0 games out of 60, with no type disadvantage. If YOU can win it even once, the zero is a pilot problem, not a balance problem.' },
    { file: 'B2-draugr_v2-vs-huldra_v1', name: 'B2 - a second 0% cell', you: 'draugr_v2', foe: 'huldra_v1',
      ask: 'Also 0 of 60. Note the turn at which you felt the game was already lost.' },
    { file: 'B3-fafnir_v2-vs-gullinbursti_v1', name: 'B3 - a third 0% cell', you: 'fafnir_v2', foe: 'gullinbursti_v1',
      ask: 'Also 0 of 60. Three is enough to tell whether the zeros are a pilot artifact.' },
    { file: 'C1-fast-hel_v2-vs-ratatoskr_v2', name: 'C1 - the fastest game on the roster', you: 'hel_v2', foe: 'ratatoskr_v2',
      ask: 'The AI ends this in 2.9 turns. Does a three-turn game feel like a game?' },
    { file: 'C2-slow-audhumbla_v2-vs-valkyrie_v1', name: 'C2 - the longest game on the roster', you: 'audhumbla_v2', foe: 'valkyrie_v1',
      ask: 'The AI takes 17 turns over this. Does it drag - and if so, from roughly which turn?' },
    { file: 'D1-fafnir_v1-dead-cards', name: 'D1 - the deck with the deadest card', you: 'fafnir_v1', foe: 'control',
      ask: 'hoardbreaker sits unplayed in the AI hand 89% of the time. Did you find a use for it, and when?' },
    { file: 'D2-ymir_v2-one-card-a-turn', name: 'D2 - one card a turn', you: 'ymir_v2', foe: 'control',
      ask: 'Her OS caps you at ONE card a turn, so most of the hand is unplayable by design. Does that read as a cost you are paying, or as the game being broken?' },
];

mkdirSync('playtest-pack', { recursive: true });
const deckFor = (d: string) => (d === 'control' ? CONTROL_DECK : REG[speciesOf(d)].decks[d]);
for (const m of MATCHES) {
    const foeSpecies = m.foe === 'control' ? 'control' : speciesOf(m.foe);
    const foeOS = m.foe === 'control' ? 'control_v1' : m.foe;
    const scenario = {
        version: 1, kind: 'composed', name: m.name,
        description: `${m.ask}   [you: ${m.you} | opponent: ${m.foe}]`,
        tags: ['playtest', 'ticket-89', m.you],
        registryHash: hash, createdAt: '2026-08-19T00:00:00.000Z',
        setup: {
            seed: m.file, enemyMode: 'CARDS',
            player: { party: [unit(speciesOf(m.you), m.you)], deck: deckFor(m.you), relics: [] },
            enemies: [{ ...unit(foeSpecies, foeOS), deck: deckFor(m.foe) }],
        },
    };
    writeFileSync(`playtest-pack/${m.file}.scenario.json`, JSON.stringify(scenario, null, 2) + '\n');
    console.log(`wrote ${m.file.padEnd(38)} ${m.you} (${deckFor(m.you).length} cards) vs ${m.foe}`);
}
console.log('registry hash', hash);
