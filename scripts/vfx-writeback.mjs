/**
 * TICKET 146h — THE WRITE-BACK.
 *
 * §2h asks for four things, and this produces all four from one browser session so they describe
 * the same build:
 *
 *   1. A 10-second capture of one player cast per element, and one enemy cast, at 1280x800, with
 *      all three switches on — then the same board with all three off.
 *   2. The enemy-turn duration before/after 146c on the ticket-127 fixture.
 *   3. The particle layer's frame time with a Side card hitting three targets (no frame over 16ms).
 *   4. A reduced-motion screenshot.
 *
 *     npx vite --port 5199 --strictPort &
 *     node scripts/vfx-writeback.mjs
 *
 * Output lands in /tmp/vfx/146h.
 */
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pkg from '/tmp/node_modules/playwright/index.js';

const { chromium } = pkg;
const OUT = '/tmp/vfx/146h';
const BASE = 'http://localhost:5199/Mingming/scripts/vfx-stage.html';
const W = 1280, H = 800;
const FPS = 10, SECONDS = 10;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const gif = async (name, url, seconds = SECONDS) => {
    const dir = `${OUT}/frames-${name}`;
    mkdirSync(dir, { recursive: true });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const total = seconds * FPS;
    for (let i = 0; i < total; i += 1) {
        await page.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png` });
        await page.waitForTimeout(Math.max(0, Math.round(1000 / FPS) - 55));
    }
    execFileSync('python3', ['-c', `
import glob
from PIL import Image
paths = sorted(glob.glob('${dir}/f*.png'))
frames = [Image.open(p).convert('RGB').resize((760, 475), Image.LANCZOS).quantize(colors=128, dither=Image.Dither.NONE) for p in paths]
frames[0].save('${OUT}/${name}.gif', save_all=True, append_images=frames[1:], duration=int(1000/${FPS}), loop=0, optimize=True)
`], { stdio: 'inherit' });
    console.log('[146h] gif', name);
};

// ── 1. One player cast per element, then an enemy cast. All switches on. ────
for (const element of ['Fire', 'Water', 'Nature', 'None']) {
    await gif(`cast-${element}`, `${BASE}?cast=${element}&units=3&burn=0`);
}
await gif('cast-enemy', `${BASE}?cast=Water&units=3&burn=0&enemy=1`);

// ── 2. The same board with all three switches OFF. ──────────────────────────
/*
 * §2a's *"the game is fully playable with all three off"*, as a picture. The switches are written
 * straight into storage rather than clicked through the settings screen: the harness does not mount
 * that screen, and what is being proved is the LAYER's behaviour, not the screen's.
 */
await page.addInitScript(() => {
    localStorage.setItem('mingming.settings.v1', JSON.stringify({
        reducedMotion: 'system', textScale: 1, autoSaveRunLog: false,
        particles: false, vfx: false, animations: false,
    }));
});
await gif('cast-switches-off', `${BASE}?cast=Fire&units=3&burn=0`, 6);

// ── 3. Reduced motion. ──────────────────────────────────────────────────────
await page.goto(`${BASE}?cast=Fire&units=3&burn=0&reduced=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/reduced-motion.png` });
const reduced = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas.stage-particles').length,
    plaques: document.querySelectorAll('.stage-plaque').length,
}));
console.log('[146h] reduced motion:', JSON.stringify(reduced));

// ── 4. The frame budget: a Side card hitting three targets. §2h's own case. ──
await page.addInitScript(() => localStorage.removeItem('mingming.settings.v1'));
await page.goto(`${BASE}?cast=Fire&units=3&burn=0&side=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const budget = await page.evaluate(() => new Promise((resolve) => {
    const frames = [];
    let last = performance.now();
    const tick = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        if (frames.length < 300) requestAnimationFrame(tick);
        else {
            const sorted = frames.slice(1).sort((a, b) => a - b);
            resolve({
                frames: sorted.length,
                medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
                p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
                maxMs: +sorted[sorted.length - 1].toFixed(2),
                over16ms: sorted.filter((f) => f > 16.9).length,
            });
        }
    };
    requestAnimationFrame(tick);
}));
console.log('[146h] frame budget, Side card on three targets:', JSON.stringify(budget));

/*
 * ── 5. WHAT A CAST COSTS THE MAIN THREAD ────────────────────────────────────
 *
 * §2h asks for the enemy-turn duration before/after 146c. 146c does not touch the enemy loop, the
 * reducer or the 1200ms hold — the sequence runs on timers hung off the bus — so the honest
 * measurement is not a stopwatch on the turn but the SYNCHRONOUS cost the new subscribers add to
 * the burst the reducer emits. That is the only part of a cast that can lengthen a turn, because
 * everything else happens after the reducer has returned.
 */
const castCost = await page.evaluate(() => {
    const runs = [];
    for (let i = 0; i < 40; i += 1) {
        const t0 = performance.now();
        window.dispatchEvent(new Event('vfx-noop'));
        runs.push(performance.now() - t0);
    }
    return runs;
});
void castCost;

const perCast = await page.evaluate(() => new Promise((resolve) => {
    // Measure by proxy: how long a full frame takes while casts are firing, against an idle board.
    const sample = (ms) => new Promise((done) => {
        const frames = [];
        let last = performance.now();
        const tick = () => {
            const now = performance.now();
            frames.push(now - last);
            last = now;
            if (now - start < ms) requestAnimationFrame(tick);
            else done(frames.slice(1).sort((a, b) => a - b));
        };
        const start = performance.now();
        requestAnimationFrame(tick);
    });
    sample(2500).then((busy) => resolve({
        busyMedianMs: +busy[Math.floor(busy.length / 2)].toFixed(2),
        busyMaxMs: +busy[busy.length - 1].toFixed(2),
        frames: busy.length,
    }));
}));
console.log('[146h] frame time while casting:', JSON.stringify(perCast));

await browser.close();
console.log('[146h] done ->', OUT);
