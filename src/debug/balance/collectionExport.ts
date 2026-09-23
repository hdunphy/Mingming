/**
 * TICKET 162d — collection v2's browser, regenerated FROM THE REGISTRY.
 *
 * # THE PROBLEM
 *
 * `collection-v2/browser.html` and `collection-v2/collection.json` are both built by
 * `collection-v2/build.py` from `collection-v2/collection.py` — the DESIGN source, which was the
 * right source while the collection was a proposal Henry was reviewing. Since 162a it is not a
 * proposal: the registry is. Two files that describe the same 98 cards and are written from
 * different sources is a drift waiting to happen, and the direction of the drift is the bad one —
 * the browser would keep showing the draft's numbers after the registry moved, which is exactly
 * the surface Henry reads a pricing decision off.
 *
 * # THE SHAPE, AND WHY IT IS AN EXPORT RATHER THAN A REWRITE
 *
 * `build.py` is 20 KB of presentation — lane colours, currency census, the change log, the tile
 * layout Henry reviews from. Porting that into TypeScript to reach the registry would be a rewrite
 * of a working page for no gain. Making PYTHON read the registry is worse: it would have to parse
 * `mingmingRegistry.ts` and `speciesPools.ts`, which is a TypeScript parser in a build script.
 *
 * So the data crosses once, in the direction that has a natural reader. This module writes
 * `collection-v2/registry.json` in exactly the shape `collection.py` exposes — `cards`, `os`,
 * `run_only` — from `programs.json`, the twelve kits, the start kits and `SPECIES_CARD_POOLS`.
 * `build.py` prefers it over `collection.py` when it is present. `npm run decks` runs the export,
 * so the one command that regenerates a browser regenerates this one's data too.
 *
 * # WHAT IS DERIVED AND WHAT IS CARRIED
 *
 * Everything a card SHOWS is derived from the registry: id, name, cost, element, category, target,
 * text. Two design-only fields have no registry home and are carried from `collection.json` when it
 * is there — `shape` (enabler / scalar / consume / glue) and `cur` (the currency), which are 158
 * §2's vocabulary and live nowhere in the engine. They are carried, never invented: a card the
 * design file has never heard of gets an empty shape rather than a guess, and the browser shows it
 * as unclassified, which is the honest rendering of "somebody added a card and did not tag it".
 */
import fs from 'node:fs';
import path from 'node:path';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import { SPECIES_CARD_POOLS, RUN_ONLY_CARDS } from '../../engine/data/speciesPools';
import { MingmingRegistry, LAUNCH_SPECIES, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { numericBaseCost, type ProgramData } from '../../engine/types';

export const COLLECTION_DIR = path.join('docs', 'wayfinder', 'deck-archetypes', 'collection-v2');
export const REGISTRY_EXPORT_PATH = path.join(COLLECTION_DIR, 'registry.json');
const DESIGN_JSON_PATH = path.join(COLLECTION_DIR, 'collection.json');

/** The design-only tags 158 §2 uses and the engine has no field for. */
interface DesignTags { shape: string; cur: string; status: string; why?: string }

export interface ExportedCard {
    id: string; name: string; cost: number; el: string; cat: string; tgt: string;
    text: string; shape: string; cur: string; status: string; why?: string;
}

export interface ExportedOS {
    sp: string; el: string; id: string; os: string; text: string;
    /** `[id, copies, lane, startCopies]` — `build.py`'s tuple, lane carried from the design file. */
    kit: Array<[string, number, string, number]>;
    pool: string[];
}

export interface CollectionExport {
    cards: ExportedCard[];
    os: ExportedOS[];
    run_only: string[];
    /** Stamped so a stale browser is visible rather than merely wrong. */
    generated: { from: 'registry'; cards: number; os: number };
}

function readDesignTags(): Map<string, DesignTags & { lanes: Map<string, string> }> {
    const out = new Map<string, DesignTags & { lanes: Map<string, string> }>();
    if (!fs.existsSync(DESIGN_JSON_PATH)) return out;
    try {
        const design = JSON.parse(fs.readFileSync(DESIGN_JSON_PATH, 'utf8')) as {
            cards?: Array<{ id: string } & Partial<DesignTags>>;
            os?: Array<{ id: string; kit?: Array<[string, number, string, number]> }>;
        };
        for (const c of design.cards ?? []) {
            out.set(c.id, {
                shape: c.shape ?? '', cur: c.cur ?? '—', status: c.status ?? '', why: c.why,
                lanes: new Map(),
            });
        }
        // Lanes are a property of a card IN A KIT, so they are keyed by `os:id`.
        for (const o of design.os ?? []) {
            for (const [cardId, , lane] of o.kit ?? []) {
                const tags = out.get(cardId);
                if (tags) tags.lanes.set(o.id, lane);
            }
        }
    } catch {
        // A malformed design file costs the tags and nothing else — the cards still export.
    }
    return out;
}

const speciesOf = (osId: string): string | undefined =>
    LAUNCH_SPECIES.find((s) => (MingmingRegistry[s]?.availableOS ?? []).includes(osId));

export function buildCollectionExport(): CollectionExport {
    const registry = getInflatedProgramRegistry();
    const tags = readDesignTags();

    const osRows: ExportedOS[] = [];
    const wanted = new Set<string>(RUN_ONLY_CARDS);

    for (const osId of Object.keys(SPECIES_CARD_POOLS)) {
        const species = speciesOf(osId);
        if (!species) continue;
        const def = MingmingRegistry[species];
        const deck = getDeckForOS(species, osId);
        const startKit = def.startKits?.[osId] ?? [];

        const counts = new Map<string, number>();
        for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
        const startCounts = new Map<string, number>();
        for (const id of startKit) startCounts.set(id, (startCounts.get(id) ?? 0) + 1);

        const kit: Array<[string, number, string, number]> = [];
        for (const [id, copies] of counts) {
            kit.push([id, copies, tags.get(id)?.lanes.get(osId) ?? '?', startCounts.get(id) ?? 0]);
            wanted.add(id);
        }
        const pool = [...(SPECIES_CARD_POOLS[osId] ?? [])];
        for (const id of pool) wanted.add(id);

        const firmware = getOSBehavior(osId);
        osRows.push({
            sp: species, el: def.primaryElement ?? 'None', id: osId,
            os: firmware?.name ?? osId,
            text: firmware?.description ?? '',
            kit, pool,
        });
    }

    const cards: ExportedCard[] = [...wanted].sort().map((id) => {
        const data = registry[id] as ProgramData | undefined;
        const t = tags.get(id);
        if (!data) {
            return { id, name: id, cost: 0, el: 'None', cat: 'Skill', tgt: 'Self', text: '(not in the registry)', shape: '', cur: '—', status: 'MISSING' };
        }
        return {
            id,
            name: data.name,
            cost: numericBaseCost(data.baseCost),
            el: data.element,
            cat: data.category,
            // The browser's vocabulary, not the engine's: `allyTarget` is a second field in the
            // engine (160-e1) and one word here, which is what a reader of a card wants.
            tgt: data.allyTarget ? (data.target === 'Side' ? 'AllySide' : 'Ally') : data.target,
            text: data.description,
            shape: t?.shape ?? '',
            cur: t?.cur ?? '—',
            status: t?.status ?? '',
            ...(t?.why ? { why: t.why } : {}),
        };
    });

    return {
        cards, os: osRows, run_only: [...RUN_ONLY_CARDS],
        generated: { from: 'registry', cards: cards.length, os: osRows.length },
    };
}

export function writeCollectionExport(out: string = REGISTRY_EXPORT_PATH): { path: string; cards: number; os: number } {
    const payload = buildCollectionExport();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    return { path: out, cards: payload.cards.length, os: payload.os.length };
}
