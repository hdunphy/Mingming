/**
 * `globalSetup` for `vitest.balance.config.ts` - the two ends of the auditor.
 *
 * Both hooks run in the main process, once per `npm run balance`, on either side of the
 * whole suite. That is the only place the report can be assembled from: each `*.balance.ts`
 * file runs in its own isolated worker, so no in-memory collector survives across them.
 *
 * `setup` clears the fragment cache so a suite that is not part of *this* run cannot leave
 * yesterday's numbers in today's report. `teardown` merges what the suites published, adds
 * the static card-budget audit, and overwrites `docs/balance/balance_report.json`.
 *
 * Teardown runs after a failing run too, which is the important case: `npm run balance` is
 * red by design whenever a redline is breached, and the red run is exactly the one whose
 * report you want to read.
 */

import { clearFragments, summarizeReport, writeBalanceReport } from './balanceReport';

export function setup(): void {
    clearFragments();
}

export function teardown(): void {
    // Ticket 17: BALANCE_ONLY=<species,species> scopes the whole suite to named species
    // for fast deck-tuning loops. A scoped run never touches docs/balance/ - the
    // committed report only ever reflects a full run.
    const scoped = (process.env.BALANCE_ONLY ?? '').trim().length > 0;
    const report = writeBalanceReport({ commitToDocs: !scoped });
    // Deliberately console.log rather than a reporter hook: this is the last line of the
    // run and it has to survive vitest's failure output, which a custom reporter's
    // ordering does not guarantee.
    console.log(
        scoped
            ? `\n[balance-report] SCOPED RUN (BALANCE_ONLY=${process.env.BALANCE_ONLY}) - ` +
              `docs/balance/ untouched.\n  ${report.summary.matchupRedlines} matchup redline(s) ` +
              `across ${report.summary.matchupsAudited} matchup(s) in scope.`
            : summarizeReport(report),
    );
}
