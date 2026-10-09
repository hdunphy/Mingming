/**
 * TICKET 197a — THE AMBER TABLE at the end of the morning report: per run, what it earned and where it went.
 *
 * One row per run (a session that played two runs has two), then a row of totals. Additions only: the
 * report above it is unchanged. A run read without a ledger (the report's older stand-ins) is left out.
 */
import type { RunFact } from './facts';
import { legsOf } from './runLeg';
import { AMBER_SPENDS, openLedger, type AmberLedger } from './amber';

export const AMBER_HEADING = '## Amber';
export const AMBER_COLUMNS = ['Session', 'Run', 'Start', 'Earned', 'Cards', 'Upgrades', 'Draughts', 'Traces', 'Runes', 'Other', 'Left'] as const;

const numbers = (l: AmberLedger): number[] => [l.start, l.earned, ...AMBER_SPENDS.map((k) => l.spent[k]), l.left];

function sum(ledgers: ReadonlyArray<AmberLedger>): AmberLedger {
    return ledgers.reduce((t, l) => ({
        start: t.start + l.start, earned: t.earned + l.earned, left: t.left + l.left,
        spent: Object.fromEntries(AMBER_SPENDS.map((k) => [k, t.spent[k] + l.spent[k]])) as AmberLedger['spent'],
    }), openLedger(0));
}

export function amberSection(runs: ReadonlyArray<RunFact>): string[] {
    const rows = runs.flatMap((r) => legsOf(r).filter((l) => l.amber !== undefined).map((l) => ({ session: r.session, number: l.number, amber: l.amber! })));
    const line = (cells: ReadonlyArray<string | number>) => `| ${cells.join(' | ')} |`;
    return [
        AMBER_HEADING, '',
        ...(rows.length === 0 ? ['None.'] : [
            line(AMBER_COLUMNS), `|${AMBER_COLUMNS.map(() => '---').join('|')}|`,
            ...rows.map((r) => line([r.session, r.number, ...numbers(r.amber)])),
            line(['All', '', ...numbers(sum(rows.map((r) => r.amber)))]),
            '',
            'Earned is every Amber a run gained (fights, events, cards sold). Cards, Upgrades, Draughts, Traces and Runes are what the shop and the Rune bench were paid; Other is any other price (a shelf refresh, the den, an event). Start + Earned - the five spends - Other = Left.',
        ]),
        '',
    ];
}
