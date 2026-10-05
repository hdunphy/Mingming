/**
 * TICKET 180f — A NIGHT'S RUNS ADDED UP: findings, and what the agent chose.
 *
 * Everything here is counting. Reasons are the agent's own `--why` lines; the most common few are
 * kept for each card, compared without case so the same sentence in two cases counts once.
 */
import type { Difference } from '../expect/compare';
import type { SurpriseFinding } from '../findings';
import type { RunFact } from './facts';

export const TOP = 10;

export interface InvariantGroup {
    readonly name: string;
    readonly detail: string;
    readonly count: number;
    readonly session: string;
    readonly atMove: number;
}

export interface SurpriseGroup {
    readonly card: string;
    readonly text: string;
    readonly type: 'card' | 'macro';
    readonly count: number;
    readonly prediction: unknown;
    readonly result: Readonly<Record<string, unknown>>;
    readonly differences: ReadonlyArray<Difference>;
    readonly session: string;
    readonly atMove: number;
}

export function invariantGroups(runs: ReadonlyArray<RunFact>): InvariantGroup[] {
    const groups = new Map<string, InvariantGroup>();
    for (const run of runs) {
        for (const f of run.findings) {
            if (f.kind !== 'invariant') continue;
            const key = `${f.name}|${f.detail}`;
            const held = groups.get(key);
            groups.set(key, held ? { ...held, count: held.count + 1 } : { name: f.name, detail: f.detail, count: 1, session: run.session, atMove: f.atMove });
        }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}

export function surpriseGroups(runs: ReadonlyArray<RunFact>): SurpriseGroup[] {
    const groups = new Map<string, SurpriseGroup>();
    for (const run of runs) {
        for (const f of run.findings) {
            if (f.kind !== 'surprise') continue;
            const s: SurpriseFinding = f;
            const key = `${s.subject.type}|${s.subject.id}`;
            const held = groups.get(key);
            groups.set(key, held ? { ...held, count: held.count + 1 } : {
                card: s.subject.name, text: s.subject.text, type: s.subject.type, count: 1,
                prediction: s.prediction, result: s.result, differences: s.differences, session: run.session, atMove: s.atMove,
            });
        }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || (a.card < b.card ? -1 : 1));
}

export interface ExplainedTally {
    readonly total: number;
    /** How many explained differences each firmware, Aura or Driver accounts for. */
    readonly by: ReadonlyMap<string, number>;
}

/** The differences the game's own log explained (193c), which are not surprises and are only counted. */
export function explainedTally(runs: ReadonlyArray<RunFact>): ExplainedTally {
    const by = new Map<string, number>();
    let total = 0;
    for (const run of runs) {
        for (const f of run.findings) {
            if (f.kind !== 'explained') continue;
            total += f.differences.length;
            for (const name of f.by) by.set(name, (by.get(name) ?? 0) + 1);
        }
    }
    return { total, by };
}

export interface CardTally {
    readonly card: string;
    readonly offered: number;
    readonly picked: number;
    readonly stored: number;
    readonly passed: number;
    readonly reasons: ReadonlyArray<string>;
}

/** The agent's most common reasons, case-insensitively, as `reason (n)`. */
export function commonReasons(reasons: ReadonlyArray<string>, keep = 2): string[] {
    const counts = new Map<string, { text: string; n: number }>();
    for (const why of reasons) {
        const key = why.trim().toLowerCase();
        const held = counts.get(key);
        counts.set(key, held ? { ...held, n: held.n + 1 } : { text: why.trim(), n: 1 });
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || (a.text < b.text ? -1 : 1)).slice(0, keep)
        .map((r) => (r.n > 1 ? `${r.text} (${r.n}x)` : r.text));
}

export function cardTallies(runs: ReadonlyArray<RunFact>): CardTally[] {
    const tallies = new Map<string, { offered: number; picked: number; stored: number; reasons: string[] }>();
    const entry = (card: string) => {
        const held = tallies.get(card) ?? { offered: 0, picked: 0, stored: 0, reasons: [] };
        tallies.set(card, held);
        return held;
    };
    for (const run of runs) {
        for (const choice of run.choices) {
            const { verb, items } = choice.about;
            if (verb !== 'take' && verb !== 'store' && verb !== 'skip') continue;
            for (const card of choice.offered) entry(card).offered += 1;
            if (verb === 'skip') {
                for (const card of items) entry(card).reasons.push(`passed: ${choice.why}`);
            } else {
                const held = entry(items[0]);
                if (verb === 'take') held.picked += 1; else held.stored += 1;
                held.reasons.push(choice.why);
            }
        }
    }
    return [...tallies.entries()].map(([card, t]) => ({
        card, offered: t.offered, picked: t.picked, stored: t.stored, passed: t.offered - t.picked - t.stored, reasons: commonReasons(t.reasons),
    }));
}

export interface ShelfTally { readonly item: string; readonly offered: number; readonly bought: number }

export function shelfTallies(runs: ReadonlyArray<RunFact>): ShelfTally[] {
    const tallies = new Map<string, { offered: number; bought: number }>();
    const entry = (item: string) => {
        const held = tallies.get(item) ?? { offered: 0, bought: 0 };
        tallies.set(item, held);
        return held;
    };
    for (const run of runs) {
        for (const item of run.shelfOffers) entry(item).offered += 1;
        for (const choice of run.choices) if (choice.about.verb === 'buy') entry(choice.about.items[0]).bought += 1;
    }
    return [...tallies.entries()].map(([item, t]) => ({ item, ...t }));
}

export function upgradeTallies(runs: ReadonlyArray<RunFact>): Array<{ card: string; count: number }> {
    const counts = new Map<string, number>();
    for (const run of runs) for (const c of run.choices) if (c.about.verb === 'upgrade') counts.set(c.about.items[0], (counts.get(c.about.items[0]) ?? 0) + 1);
    return [...counts.entries()].map(([card, count]) => ({ card, count })).sort((a, b) => b.count - a.count || (a.card < b.card ? -1 : 1));
}
