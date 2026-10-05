/**
 * TICKET 198 — the capture sheet: play one card on the stage sheet and photograph the moments after.
 *
 *     npx vite --port 5199 --strictPort &
 *     node scripts/vfx-sheet.mjs flame "hand=cinder_lance&biome=Fire&biomeName=Cinderreach&foeDefs=nidhoggr,nidhoggr,nidhoggr&foe1=1&foe2=1&foe3=1" cinder_lance e1 /tmp/vfx/flame
 *
 * Arguments: a name, the stage-sheet query, the card's data id, the target's entity id (e1..e3 or
 * p1..p3), and the folder to write into. Writes `<name>-<ms>.png` at each moment after the card is
 * played (the clock is the browser's; a software-rendered headless frame is approximate). The
 * Playwright module path and the Chromium executable are the container's.
 */
import { mkdirSync } from 'node:fs';
import pkg from '/tmp/pw/node_modules/playwright/index.js';

const { chromium } = pkg;
const [name, query, cardId, targetId, out] = process.argv.slice(2);
const MOMENTS = (process.env.MOMENTS ?? '250,550,850,1150,1500,1900').split(',').map(Number);
const BASE = 'http://localhost:5199/Mingming/stage.html';

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 200)); });
await page.goto(`${BASE}?${query}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('.hand-card', { timeout: 60000 });
await page.waitForTimeout(800);

// Play the card: click it in the hand, then click the target's slot.
const cardName = cardId.replace(/_/g, ' ');
const card = page.locator(`.hand-card[aria-label^="${cardName}" i]`).first();
if (await card.count() === 0) {
    const cards = await page.locator('.hand-card').allTextContents();
    console.log('hand:', JSON.stringify(cards));
}
await card.click();
await page.waitForTimeout(120);
// `e1`..`e3` / `p1`..`p3` name the slots in order; the entity ids are the factory's.
const side = targetId[0] === 'e' ? '.stage-slot-enemy' : '.stage-slot-ally';
const slot = page.locator(side).nth(Number(targetId.slice(1)) - 1);
await slot.click();
await page.waitForTimeout(120);
// The CAST key (Enter) plays the selected card on the selected target.
const t0 = Date.now();
await page.keyboard.press('Enter');
let last = 0;
for (const ms of MOMENTS) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/${name}-${ms}.png` });
    last = Date.now() - t0;
}
console.log(`[vfx-sheet] ${name}: ${MOMENTS.length} frames, last at +${last} ms`);
await browser.close();
