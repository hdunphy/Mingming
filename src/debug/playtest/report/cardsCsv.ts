/**
 * TICKET 196a — THE FULL CARD TALLIES, one row per card, as CSV.
 *
 * The morning report stops every list at its top ten. This table has every card (and Draught) a night's
 * sessions saw: offered and taken, stored or passed at a card reward; on a shelf and bought in the shop;
 * upgraded. The numbers are the report's own tallies (`cardTallies`, `shelfTallies`, `upgradeTallies`), so the
 * two agree. "On a shelf" counts what `shelfTallies` counts: each shop screen that offered it at a price the
 * run could pay. A Draught bought in the shop is a `buy` like a card (`macroShelf`), so it is counted; it gets
 * its own row, kind `Draught`, even where a card has the same name (Mend).
 *
 * The last two columns: how many of a card's reward offers came while the deck's main element (`mainElementOf`)
 * was the card's own, and that as a share of its offers. Blank for a card with no element, or one never offered.
 */
import type { RunFact } from './facts';
import { DRAUGHT_META, cardMeta, isDraughtOnly } from './itemMeta';
import { NO_ELEMENT } from './mainElement';
import { cardTallies, shelfTallies, upgradeTallies } from './tally';

export const CARDS_CSV_HEADER = [
    'card', 'kind', 'element', 'cost', 'offered', 'taken', 'stored', 'passed', 'on a shelf', 'bought', 'upgraded',
    'offers on main element', 'main element share',
] as const;

const REWARD_VERBS: ReadonlySet<string> = new Set(['take', 'store', 'skip']);

const bump = (counts: Map<string, number>, name: string): void => { counts.set(name, (counts.get(name) ?? 0) + 1); };

/** Per card, the reward offers made while the deck's main element was the card's element. */
export function mainElementOffers(runs: ReadonlyArray<RunFact>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const run of runs) {
        for (const choice of run.choices) {
            if (!REWARD_VERBS.has(choice.about.verb) || choice.mainElement === undefined) continue;
            for (const card of choice.offered) if (cardMeta(card).element === choice.mainElement) bump(counts, card);
        }
    }
    return counts;
}

/** The Draughts' part of the shelf tallies: on a shelf, and bought. */
export function draughtShelf(runs: ReadonlyArray<RunFact>): { offered: Map<string, number>; bought: Map<string, number> } {
    const offered = new Map<string, number>();
    const bought = new Map<string, number>();
    for (const run of runs) {
        for (const name of run.draughtOffers ?? run.shelfOffers.filter(isDraughtOnly)) bump(offered, name);
        for (const c of run.choices) if (c.about.verb === 'buy' && (c.draught ?? isDraughtOnly(c.about.items[0]))) bump(bought, c.about.items[0]);
    }
    return { offered, bought };
}

const cell = (value: string | number): string => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function cardsCsv(runs: ReadonlyArray<RunFact>): string {
    const rewards = new Map(cardTallies(runs).map((t) => [t.card, t]));
    const shelves = new Map(shelfTallies(runs).map((t) => [t.item, t]));
    const upgrades = new Map(upgradeTallies(runs).map((t) => [t.card, t.count]));
    const draughts = draughtShelf(runs);
    const matched = mainElementOffers(runs);

    // A shelf name is a card's row for whatever of its count was not on the Draught shelf.
    const cardShelf = (name: string) => (shelves.get(name)?.offered ?? 0) - (draughts.offered.get(name) ?? 0);
    const cardBought = (name: string) => (shelves.get(name)?.bought ?? 0) - (draughts.bought.get(name) ?? 0);
    const cardNames = [...new Set([...rewards.keys(), ...upgrades.keys(), ...[...shelves.keys()].filter((n) => cardShelf(n) > 0 || cardBought(n) > 0)])].sort(byName);
    const draughtNames = [...new Set([...draughts.offered.keys(), ...draughts.bought.keys()])].sort(byName);

    const cardRows = cardNames.map((name) => {
        const meta = cardMeta(name);
        const reward = rewards.get(name);
        const offered = reward?.offered ?? 0;
        const share = meta.element !== '' && meta.element !== NO_ELEMENT && offered > 0;
        const onMain = matched.get(name) ?? 0;
        return [
            name, meta.kind, meta.element, meta.cost,
            offered, reward?.picked ?? 0, reward?.stored ?? 0, reward?.passed ?? 0,
            cardShelf(name), cardBought(name), upgrades.get(name) ?? 0,
            share ? onMain : '', share ? (onMain / offered).toFixed(2) : '',
        ];
    });
    const draughtRows = draughtNames.map((name) => [
        name, DRAUGHT_META.kind, DRAUGHT_META.element, DRAUGHT_META.cost,
        0, 0, 0, 0, draughts.offered.get(name) ?? 0, draughts.bought.get(name) ?? 0, 0, '', '',
    ]);
    return [CARDS_CSV_HEADER, ...cardRows, ...draughtRows].map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
