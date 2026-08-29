/**
 * `npm run decks` — generate the deck browser (`docs/balance/deck_browser.html`).
 *
 * A reference page for the twelve tuned decks: what each one holds, what its firmware does, which
 * five cards are its ratified engine, and — borrowed from the last balance report and badged when
 * stale — how it performs. See `deckBrowser.ts` for why this exists beside `balance:deck` rather
 * than inside it.
 *
 * Deliberately NOT a vitest suite and not part of any build. It reads the registry, writes one
 * self-contained HTML file and exits in well under a second; there is nothing to gate on and
 * nothing to schedule. Open the file by double-clicking it — no server, no `npm run dev`.
 *
 * Usage:
 *
 *     npm run decks                             # regenerate against the current registry
 *     npm run decks -- --out /tmp/decks.html    # somewhere else
 *     npm run decks -- --report none            # ignore the balance report; deck reference only
 *     npm run decks -- --report path/to.json    # join stats from a different report
 *
 * Flags rather than environment variables, and that is forced rather than chosen: `vite.config.ts`
 * carries `define: { 'process.env': {} }`, so under `vite-node` every `process.env` read is
 * substituted to `{}` before the script starts. `process.argv` is untouched.
 */

import {
    DECK_BROWSER_HTML_PATH,
    DECK_REPORT_SOURCE_PATH,
    buildBrowserPayload,
    readDeckReport,
    writeDeckBrowser,
} from './deckBrowser';

function main(argv: string[]): void {
    const get = (flag: string): string | undefined => {
        const at = argv.indexOf(flag);
        return at >= 0 ? argv[at + 1] : undefined;
    };

    const out = get('--out') ?? DECK_BROWSER_HTML_PATH;
    const reportFlag = get('--report');
    // `--report none` is the escape hatch for reading the decks without any borrowed numbers at all,
    // which is the honest thing to want when the report is badly out of date.
    const report = reportFlag === 'none'
        ? null
        : readDeckReport(reportFlag ?? DECK_REPORT_SOURCE_PATH);

    const payload = buildBrowserPayload(report);
    const path = writeDeckBrowser(payload, out);

    const launch = payload.decks.filter((deck) => deck.launch).length;
    console.log(`[decks] ${path}`);
    console.log(`[decks]   ${payload.decks.length} decks (${launch} tuned, ${payload.decks.length - launch} untuned)`);
    console.log(`[decks]   registry ${payload.registryHash}`);

    if (!payload.stats) {
        console.log('[decks]   no balance report joined — deck reference only.');
        console.log('[decks]   run `npm run balance:deck` for win rates, then regenerate.');
    } else if (payload.stats.stale) {
        // Loud, because a silently stale number is the failure this whole feature exists to prevent.
        console.log('');
        console.log(`[decks]   STALE STATS: the report was measured against ${payload.stats.registryHash}`);
        console.log(`[decks]   and the registry is now ${payload.registryHash}. Deck lists, card text and`);
        console.log('[decks]   firmware are live and correct; every win rate is marked stale on the page.');
        console.log('[decks]   `npm run balance:deck` refreshes them.');
    } else {
        console.log(`[decks]   stats current (${payload.stats.generatedAt}).`);
    }
}

main(process.argv.slice(2));
