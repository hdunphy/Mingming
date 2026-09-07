/**
 * DOES THE STATUS ROW ACTUALLY FIT? — Henry, 2026-09-07, with a screenshot of a six-status
 * enemy: *"statuses can go so far and cover the picture."*
 *
 * `.hud-status-badges` was `flex-shrink: 0` with no ceiling inside a `.hud-card` that is
 * `overflow: visible`, so the surplus painted over `.hud-sidebar`. The fix is a COUNT budget,
 * and ticket 22's precedent says a budget in this file is arithmetic, not taste — so this
 * measures the real thing instead of estimating it: the shipped `src/index.css` against a real
 * `.hud-card` in headless Chromium, at every combination of budget, OS chip and name floor.
 *
 * `badge clip` is (natural width of the children) − (width the row actually gets). Anything
 * above 0 is a badge losing its stack count, which is the one thing on a badge a player reads.
 *
 *   node scratch/fitcheck.mjs        (needs playwright; PLAYWRIGHT_BROWSERS_PATH is preset)
 */
import { chromium } from 'playwright';
import fs from 'fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const badge = (i, t) => `<div class="hud-status-badge" style="border-color:#f66;color:#f66">`
    + `<span class="hud-status-icon">${i}</span>${t ? `<span class="hud-status-stacks">${t}</span>` : ''}</div>`;
const more = k => `<div class="hud-status-badge hud-status-more"><span class="hud-status-stacks">+${k}</span></div>`;
// The six from the screenshot plus one, widest realistic stack labels included (`×4.8` is a
// live BarkShield — fractional stacks are why a badge is not one width).
const B = [['\u{1F300}', '×6'], ['⬆', '×3'], ['\u{1F525}', '×2'], ['☠', '×2'], ['\u{1F6E1}', '×4.8'], ['❄', '×2'], ['✦', '×12']];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function trial({ budget, nameMin, os, total }) {
    const vis = B.slice(0, budget).map(a => badge(a[0], a[1])).join('') + (total > budget ? more(total - budget) : '');
    await page.setContent(`<style>${css}\n.hud-name{min-width:${nameMin}px}</style><body style="margin:0;background:#000">
    <div class="hud-card" id="card"><div class="hud-sidebar"><div class="hud-art-placeholder">F</div></div>
    <div class="hud-body"><div class="hud-top-row" id="row">
      <span class="hud-element-dot">N</span><span class="hud-name" id="nm">RATATOSKR</span>
      ${os ? '<div class="hud-os-icon-container"><span class="hud-os-icon">D</span><span class="hud-os-version">V2</span></div>' : ''}
      <div class="hud-status-badges" id="badges">${vis}</div></div></div></div></body>`);
    return page.evaluate(() => {
        const row = document.querySelector('#row').getBoundingClientRect();
        const bg = document.querySelector('#badges').getBoundingClientRect();
        const kids = [...document.querySelectorAll('#badges > div')];
        const need = kids.reduce((s, e) => s + e.getBoundingClientRect().width, 0) + 3 * (kids.length - 1);
        return {
            clip: Math.round(need - bg.width),
            name: Math.round(document.querySelector('#nm').getBoundingClientRect().width),
            spill: Math.round(bg.right - row.right),
        };
    });
}

for (const os of [true, false]) for (const nameMin of [48, 0]) for (const budget of [4, 3, 2]) {
    const t = await trial({ budget, nameMin, os, total: 7 });
    console.log(`os=${os ? 'Y' : 'n'} nameMin=${String(nameMin).padStart(2)} budget=${budget}`
        + ` -> badge clip ${String(t.clip).padStart(4)}px, name ${String(t.name).padStart(3)}px,`
        + ` row spill ${String(t.spill).padStart(4)}px`);
}
await browser.close();
