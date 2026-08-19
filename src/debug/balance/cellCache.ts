/**
 * Deterministic cell cache - ticket 97, piece 1.
 *
 * A balance pass re-runs all 960 grid cells every time, and after a typical change 57 of every 67
 * rows come back bit-identical (HANDOFF 8-DIFF, every pass since ticket 71). That is roughly 45
 * minutes of wall clock spent proving that a deck nobody touched still plays the same.
 *
 * The cache stores each cell's result under a key that captures EVERYTHING the result depends on.
 * Get the key wrong in the safe direction and you waste time; get it wrong in the unsafe direction
 * and you ship a balance number that was never measured. So the key is deliberately over-broad:
 *
 *   - the two decks' card lists and the resolved data of every card in them,
 *   - the two species' stat blocks,
 *   - the two OSes' firmware definitions (hooks.json AND the hand-written CustomFirmware ids),
 *   - the ENGINE SOURCE of every file that can change a damage number,
 *   - the seed and the iteration count.
 *
 * The engine-source term is the blunt one: editing `combatUtils.ts` invalidates all 960 cells, even
 * though most of them do not use the line that changed. That is correct rather than clever - the
 * alternative is a model of which constants reach which cells, which is exactly the kind of
 * cleverness that produces a silently stale number. Passes that only touch a deck list or a card -
 * the common case - keep the whole cache.
 *
 * CORRECTNESS GATE (the ticket's, and it is the right one): `FORCE_FULL=1` bypasses every lookup,
 * and the assembled output must be bit-identical to the cached assembly. `scratch/cacheproof.ts`
 * runs exactly that comparison.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { FIRMWARE_REGISTRY } from '../../engine/data/firmwareRegistry';
import { CustomFirmware } from '../../engine/core/CustomFirmware';

/** Bump when the KEY's input set changes, so an old cache can never be read by new rules. */
const CACHE_VERSION = 1;

export const CELL_CACHE_PATH = 'docs/balance/.cell-cache.json';

/**
 * Engine files whose contents can move a cell's result. Hashed as SOURCE TEXT, so a constant, a
 * formula or a whole mechanic all invalidate identically and nobody has to remember to add a knob
 * to a list. Missing files are skipped rather than throwing: the hash only has to be STABLE and
 * SENSITIVE, and a renamed file changes it either way.
 */
const ENGINE_FILES = [
    'src/engine/combatUtils.ts',
    'src/engine/core/Hooks.ts',
    'src/engine/core/HookFactory.ts',
    'src/engine/core/CustomFirmware.ts',
    'src/engine/StatusBehaviors.ts',
    'src/engine/actions/ActionExecutors.ts',
    'src/engine/battleReducer.ts',
    'src/engine/resolutionEngine.ts',
    'src/engine/effectHandlers.ts',
    'src/engine/ai/TacticalAI.ts',
    'src/engine/data/gameConfig.ts',
    'src/debug/balance/balanceScenarios.ts',
    'src/debug/balance/runBatch.ts',
];

/** FNV-1a, 32-bit - the same hash `registryHash.ts` uses, for the same reason: short and stable. */
function fnv1a32(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

let engineHashCache: string | undefined;

/** One hash over every engine file that can move a number. Computed once per process. */
export function engineHash(): string {
    if (engineHashCache) return engineHashCache;
    const parts: string[] = [];
    for (const file of ENGINE_FILES) {
        try {
            parts.push(`${file} ${readFileSync(file, 'utf8')}`);
        } catch {
            parts.push(`${file} <missing>`);
        }
    }
    engineHashCache = fnv1a32(parts.join(''));
    return engineHashCache;
}

const deckHashCache = new Map<string, string>();

/** Everything about ONE side: its species frame, its card list, and its firmware. */
function sideHash(species: string, os: string): string {
    const memo = `${species}:${os}`;
    const hit = deckHashCache.get(memo);
    if (hit) return hit;

    const definition = MingmingRegistry[species] as unknown as {
        baseStats: Record<string, number>; cardDraw: number; primaryElement: string;
        secondaryElement: string; decks: Record<string, string[]>; moves?: unknown;
    };
    const cards = definition.decks[os] ?? [];
    const parts = [
        `stats:${JSON.stringify(definition.baseStats)}`,
        `draw:${definition.cardDraw}`,
        `elem:${definition.primaryElement}/${definition.secondaryElement}`,
        `moves:${JSON.stringify(definition.moves ?? null)}`,
        `deck:${cards.join(',')}`,
        // Card DATA, not just ids: a power change on a shared card has to invalidate every deck
        // that runs it. Sorted-unique so hand order can never perturb the key.
        ...[...new Set(cards)].sort().map(id => {
            try { return `card:${id}:${JSON.stringify(GetProgramData(id))}`; }
            catch { return `card:${id}:<missing>`; }
        }),
        `firmware:${JSON.stringify((FIRMWARE_REGISTRY as Record<string, unknown>)[os] ?? null)}`,
        // CustomFirmware holds FUNCTIONS, which do not serialize - the engine-source hash covers
        // their bodies, so the id list is enough to catch one being added or removed.
        `custom:${((CustomFirmware as Record<string, unknown[]>)[os] ?? [])
            .map(h => (h as { id?: string }).id ?? '?').join(',')}`,
    ];
    const hash = fnv1a32(parts.join(''));
    deckHashCache.set(memo, hash);
    return hash;
}

/** The full key for one cell. */
export function cellKey(args: {
    playerSpecies: string; playerOS: string;
    enemySpecies: string; enemyOS: string;
    seed: string; iterations: number;
}): string {
    return [
        `v${CACHE_VERSION}`,
        engineHash(),
        sideHash(args.playerSpecies, args.playerOS),
        sideHash(args.enemySpecies, args.enemyOS),
        `seed:${args.seed}`,
        `iter:${args.iterations}`,
    ].join('|');
}

type CacheFile = { version: number; entries: Record<string, unknown> };

export class CellCache {
    private entries: Record<string, unknown> = {};
    private hits = 0;
    private misses = 0;
    /** `FORCE_FULL=1` skips every lookup - the correctness gate's switch. */
    readonly forced = process.env.FORCE_FULL === '1';

    constructor(private readonly path: string = CELL_CACHE_PATH) {
        if (!existsSync(path)) return;
        try {
            const parsed = JSON.parse(readFileSync(path, 'utf8')) as CacheFile;
            if (parsed.version === CACHE_VERSION) this.entries = parsed.entries ?? {};
        } catch {
            this.entries = {};   // a corrupt cache is a cold cache, never an error
        }
    }

    get<T>(key: string): T | undefined {
        if (this.forced) { this.misses++; return undefined; }
        const hit = this.entries[key] as T | undefined;
        if (hit === undefined) this.misses++; else this.hits++;
        return hit;
    }

    set(key: string, value: unknown): void {
        this.entries[key] = value;
    }

    /** Hit rate over this run, as the ticket asks the pass to report. */
    stats(): { hits: number; misses: number; rate: number; forced: boolean } {
        const total = this.hits + this.misses;
        return { hits: this.hits, misses: this.misses, rate: total ? this.hits / total : 0, forced: this.forced };
    }

    save(): void {
        mkdirSync(dirname(this.path), { recursive: true });
        // Sorted keys so the file is diffable and two runs of the same pass produce the same bytes.
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(this.entries).sort()) sorted[k] = this.entries[k];
        writeFileSync(this.path, `${JSON.stringify({ version: CACHE_VERSION, entries: sorted }, null, 0)}\n`);
    }
}
