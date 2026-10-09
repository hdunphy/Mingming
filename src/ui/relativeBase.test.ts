/**
 * TICKET 181d — the web build loads everything by RELATIVE path.
 *
 * itch.io serves an HTML5 game from its own CDN folder, not from `/Mingming/`, so an `index.html`
 * that asks for `/assets/...` or `/Mingming/assets/...` is a blank page on the restricted test page
 * with no error a tester could report. `scripts/assert-relative-base.mjs` checks the built
 * `dist/index.html` at the end of every `npm run build`; this proves the check catches what it is
 * for, and that the build script really runs it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Script = { absoluteRefs: (html: string) => string[] };

const root = resolve(__dirname, '../..');
const load = async (): Promise<Script> => (await import(/* @vite-ignore */ resolve(root, 'scripts/assert-relative-base.mjs'))) as Script;

describe('assert-relative-base', () => {
    it('flags a src or href that starts at the site root', async () => {
        const { absoluteRefs } = await load();
        const html = '<script type="module" crossorigin src="/Mingming/assets/index-a1.js"></script>'
            + '<link rel="stylesheet" href="/assets/index-b2.css">'
            + "<link rel='icon' href='/favicon.ico'>";
        expect(absoluteRefs(html)).toEqual([
            'src="/Mingming/assets/index-a1.js"',
            'href="/assets/index-b2.css"',
            "href='/favicon.ico'",
        ]);
    });

    it('passes relative paths, full URLs and protocol-relative URLs', async () => {
        const { absoluteRefs } = await load();
        const html = '<script type="module" crossorigin src="./assets/index-a1.js"></script>'
            + '<link rel="stylesheet" href="assets/index-b2.css">'
            + '<link rel="preconnect" href="https://fonts.example">'
            + '<link rel="preconnect" href="//cdn.example">';
        expect(absoluteRefs(html)).toEqual([]);
    });

    it('runs in every build, after the debug-toolkit check', () => {
        const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        const build = pkg.scripts.build;
        expect(build).toContain('node scripts/assert-relative-base.mjs');
        expect(build.indexOf('assert-relative-base')).toBeGreaterThan(build.indexOf('assert-no-debug'));
    });
});
