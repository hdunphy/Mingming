/**
 * DOES THE CARD ACTUALLY FIT? — Henry, 2026-09-07, with a screenshot of a six-status enemy:
 * *"statuses can go so far and cover the picture."*
 *
 * `.hud-status-badges` lived in `.hud-top-row` with `flex-shrink: 0` and no ceiling inside a
 * `.hud-card` that is `overflow: visible`, so N statuses were N badges wide however wide that came
 * out and the surplus painted over `.hud-sidebar`. Offered a 2-badge budget or a taller card,
 * Henry took the taller card (ticket 145).
 *
 * Ticket 22's precedent says a budget in this codebase is arithmetic, not taste — so this measures
 * the real thing: the REAL `MingmingUnit` rendered to markup, dropped into headless Chromium with
 * the REAL `src/index.css`, at every combination of status count and daemon row. An estimate would
 * have been wrong: the first pass of this fix guessed a compacted badge at 26px and it is 28.
 *
 *   badgeNeed   natural width of the row's children + gaps. Must stay under badgeHas (195px).
 *   natural     the body's rows summed with their gaps and padding. Must stay under the card.
 *   spillOntoArt  how far the badge row reaches back over `.hud-sidebar`. Must be 0.
 *
 *   npx vite-node scratch/fitcheck.ts
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
// Same import shape `scripts/screenshots.mjs` uses: playwright is not a repo dependency (it would
// drag a browser download into every `npm ci`), so it is installed beside the checkout when a
// measurement needs it —  `npm i playwright --no-save --prefix /tmp`.
import pkg from '/tmp/node_modules/playwright/index.js';
const { chromium } = pkg as unknown as { chromium: typeof import('playwright').chromium };
import MingmingUnit from '../src/ui/components/MingmingUnit';
import type { IBattleEntity, IBattleState, Element, StatusType } from '../src/engine/types';

/* Eight so the overflow chip has something to hide; six is the deepest pile ever measured. */
const ALL = ['Dazed', 'Sharp', 'Burn', 'Poison', 'Strengthened', 'Weakened', 'Regen', 'BarkShield'] as StatusType[];

function unit(id: string, statuses: number, daemons: boolean): IBattleEntity {
    return {
        id, name: 'RATATOSKR', definitionId: 'ratatoskr', blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: 1230, currentHp: 1008,
        cardDraw: 3, maxEnergy: 2, currentEnergy: 0, attack: 45, defense: 30, speed: 10,
        primaryElement: 'Nature' as Element, secondaryElement: 'None' as Element,
        speciesId: 'ratatoskr', level: 15, activeOS: 'ratatoskr_v2',
        daemons: daemons ? ['fertile_ground_daemon'] : [],
        // Index 4 is fractional on purpose: BarkShield stacks are a %maxHp float, and `×4.8` is the
        // WIDEST label a badge can carry (35px against 28px for `×6`). A fit proved on `×2` is not
        // a fit.
        statusEffects: Array.from({ length: statuses }, (_, i) => ({
            id: `s${i}`, type: ALL[i % ALL.length], stacks: i === 4 ? 4.8 : i + 2, duration: 3, sourceId: 'e1',
        })) as never,
    } as unknown as IBattleEntity;
}

const state = (u: IBattleEntity): IBattleState => ({
    playerParty: [u], enemyParty: [], activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
    playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    counters: {}, seed: 'x', log: [],
} as unknown as IBattleState);

const css = fs.readFileSync('src/index.css', 'utf8');
const cards: string[] = [];
const labels: string[] = [];
for (const daemons of [true, false]) for (const n of [0, 2, 4, 6, 7, 8]) {
    const u = unit(`u${n}${daemons}`, n, daemons);
    cards.push(renderToStaticMarkup(React.createElement(MingmingUnit as never, {
        entity: u, isPlayer: true, isSelected: false, isTargeted: false,
        battleState: state(u), selectedCardId: null, selectedSourceId: null, onClick: () => undefined,
    } as never)));
    labels.push(`daemon=${daemons ? 'Y' : 'n'} statuses=${n}`);
}

// `vite.config.ts` sets `define: { 'process.env': {} }`, which blanks the environment inside every
// vite-node lane — the same trap that kept AI_BEAM and AI_CENSUS from ever reaching a shard. So
// PLAYWRIGHT_BROWSERS_PATH does not reach playwright here and the default launch cannot find the
// browser. Try it anyway (Henry's box has a normal install), then fall back to the container's.
const browser = await chromium.launch().catch(
    () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }),
);
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
// `flex: 0 0 auto` on the body's children so the rows report their NATURAL heights. Without it the
// column silently squeezes them to fit and every card measures as exactly the card height, which is
// how the first pass of this harness "proved" a layout that did not fit.
await page.setContent(`<style>${css}\n.hud-body > *{flex:0 0 auto}</style>`
    + `<body style="margin:0;background:#07070c;padding:16px;display:flex;flex-wrap:wrap;gap:24px">`
    + cards.map((c, i) => `<div><div style="color:#888;font:700 10px system-ui;margin-bottom:6px">${labels[i]}</div>`
        + `<div class="probe">${c}</div></div>`).join('') + `</body>`);

const out = await page.evaluate(() => [...document.querySelectorAll('.probe')].map(pr => {
    const body = pr.querySelector('.hud-body')!;
    const cs = getComputedStyle(body);
    const rows = [...body.children].map(e => Math.round(e.getBoundingClientRect().height));
    const natural = rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * parseFloat(cs.rowGap || '0')
        + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const bg = pr.querySelector('.hud-status-badges');
    const kids = bg ? [...bg.children] : [];
    const gap = bg ? parseFloat(getComputedStyle(bg).columnGap || '0') : 0;
    const need = kids.reduce((s, e) => s + e.getBoundingClientRect().width, 0) + gap * Math.max(0, kids.length - 1);
    const sidebar = pr.querySelector('.hud-sidebar')!.getBoundingClientRect();
    return {
        cardH: Math.round(pr.querySelector('.hud-card')!.getBoundingClientRect().height),
        natural: Math.round(natural), rows,
        badges: kids.length, badgeNeed: Math.round(need),
        each: kids.map(e => Math.round(e.getBoundingClientRect().width)),
        badgeHas: bg ? Math.round(bg.getBoundingClientRect().width) : 0,
        spillOntoArt: bg
            ? Math.round(Math.max(0, sidebar.right - bg.getBoundingClientRect().left))
            : 0,
    };
}));

let bad = 0;
out.forEach((r, i) => {
    const fits = r.badgeNeed <= r.badgeHas && r.natural <= r.cardH && r.spillOntoArt === 0;
    if (!fits) bad += 1;
    console.log(`${fits ? 'ok  ' : 'FAIL'} ${labels[i].padEnd(26)} ${JSON.stringify(r)}`);
});
console.log(bad === 0 ? '\nall cases fit' : `\n${bad} case(s) do not fit`);
await page.screenshot({ path: 'results/cardfit.png' });
await browser.close();
