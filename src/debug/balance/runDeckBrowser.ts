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
import { writeCollectionExport } from './collectionExport';

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

    /*
     * TICKET 162d — the collection browser's data, exported in the same breath.
     *
     * `npm run decks` is the one command whose job is "regenerate a browser against the current
     * registry", so it is where the collection-v2 export belongs. Writing the JSON here rather than
     * rendering the HTML keeps the two browsers' presentation separate while giving them one
     * source: `collection-v2/build.py` reads this file in preference to the design `collection.py`,
     * so the page Henry prices cards off cannot show a number the registry has moved past.
     */
    const exported = writeCollectionExport();

    const launch = payload.decks.filter((deck) => deck.launch).length;
    console.log(`[decks] ${path}`);
    console.log(`[decks] ${exported.path}`);
    console.log(`[decks]   ${exported.cards} collection cards, ${exported.os} OS — run \`python build.py\` in that folder to render browser.html`);
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
