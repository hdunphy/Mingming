/**
 * TICKET 197a — WHERE A RUN'S AMBER CAME FROM AND WENT.
 *
 * Read off the replay: the run's Amber before and after every move. A move that raised it earned that much
 * (fights, events, selling a card); a move that lowered it spent it, filed by the kind of move it was. The
 * kinds are the playtester's own move keys, never on-screen words:
 *
 *   - cards:    `market:buy:...`      a card off the shop's shelf
 *   - upgrades: `...:upgrade:...`     a paid upgrade (a free one spends nothing)
 *   - Draughts: `market:macro:...`
 *   - Traces:   `market:blueprint`
 *   - Runes:    `patch:...`           a paid Rune bench (the gate's free one spends nothing)
 *   - other:    anything else that cost Amber (a paid shelf refresh, the den, an event's price)
 *
 * Nothing is estimated: start + earned - every spend = Amber left, to the coin.
 */
export type AmberSpend = 'cards' | 'upgrades' | 'draughts' | 'traces' | 'runes' | 'other';

export const AMBER_SPENDS: ReadonlyArray<AmberSpend> = ['cards', 'upgrades', 'draughts', 'traces', 'runes', 'other'];

export interface AmberLedger {
    /** The Amber the run began with. */
    readonly start: number;
    readonly earned: number;
    readonly spent: Readonly<Record<AmberSpend, number>>;
    /** The Amber the run ended with (or stood at when the session stopped). */
    readonly left: number;
}

export function amberSpendOf(moveKey: string): AmberSpend {
    if (moveKey.startsWith('market:buy:')) return 'cards';
    if (moveKey.includes(':upgrade:')) return 'upgrades';
    if (moveKey.startsWith('market:macro:')) return 'draughts';
    if (moveKey === 'market:blueprint' || moveKey.startsWith('market:blueprint:')) return 'traces';
    if (moveKey.startsWith('patch:')) return 'runes';
    return 'other';
}

export const openLedger = (start: number): AmberLedger => ({
    start, earned: 0, spent: { cards: 0, upgrades: 0, draughts: 0, traces: 0, runes: 0, other: 0 }, left: start,
});

/** The ledger after one move that took the run's Amber from `before` to `after`. */
export function recordMove(ledger: AmberLedger, moveKey: string, before: number, after: number): AmberLedger {
    const change = after - before;
    if (change === 0) return { ...ledger, left: after };
    if (change > 0) return { ...ledger, earned: ledger.earned + change, left: after };
    const kind = amberSpendOf(moveKey);
    return { ...ledger, spent: { ...ledger.spent, [kind]: ledger.spent[kind] - change }, left: after };
}
