#!/usr/bin/env node
/**
 * Post-build gate: the web build loads everything by RELATIVE path. Ticket 181d.
 *
 * The playtest build is served from itch.io's own CDN folder, not from `/Mingming/` (GitHub Pages)
 * or `/`. An `index.html` that asks for `src="/..."` or `href="/..."` loads nothing there, and the
 * tester sees a blank page with no error they could report. `vite.config.ts` builds with
 * `base: './'`; this proves the built `dist/index.html` really came out relative. Exits non-zero so
 * `npm run build` fails.
 *
 * Full URLs (`https://...`) and protocol-relative ones (`//host/...`) are not paths on this site and
 * pass.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every `src="/..."` or `href="/..."` (either quote) that is not `//`. Exported for the test. */
export function absoluteRefs(html) {
    const found = [];
    const pattern = /\b(?:src|href)\s*=\s*(["'])\/(?!\/)[^"']*\1/g;
    for (const match of html.matchAll(pattern)) found.push(match[0]);
    return found;
}

function main() {
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const indexPath = resolve(projectRoot, 'dist', 'index.html');

    let html;
    try {
        html = readFileSync(indexPath, 'utf8');
    } catch {
        console.error(`[assert-relative-base] FAIL: no build output at ${indexPath}. Run \`vite build\` first.`);
        process.exit(1);
    }

    const offenders = absoluteRefs(html);
    if (offenders.length > 0) {
        console.error('[assert-relative-base] FAIL: dist/index.html loads from an absolute path, which is blank on itch.io.');
        console.error('Check `base` in vite.config.ts (it must be \'./\' for a build).');
        for (const offender of offenders) console.error(`  - ${offender}`);
        process.exit(1);
    }

    console.log('[assert-relative-base] OK: dist/index.html loads everything by relative path.');
}

// Run only when invoked as a script, so the test can import `absoluteRefs` without a build.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
