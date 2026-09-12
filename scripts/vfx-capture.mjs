/**
 * VFX CAPTURE — ticket 146's proof, one row at a time.
 *
 * §6: *"Each row: reduced-motion off-switch verified, the frame budget measured ... Henry judges
 * each row on the GIF."* This script produces all three artifacts from one browser session, so the
 * still, the animation and the number all describe the same board rather than three attempts.
 *
 *     npx vite --port 5199 --strictPort &
 *     node scripts/vfx-capture.mjs 146a
 *
 * Writes into /tmp/vfx: `<row>-still.png`, `<row>-reduced.png`, `<row>.gif`, and prints the frame
 * measurement to stdout.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pkg from '/tmp/node_modules/playwright/index.js';

const { chromium } = pkg;
const ROW = process.argv[2] ?? '146a';
const OUT = '/tmp/vfx';
const BASE = 'http://localhost:5199/Mingming/scripts/vfx-stage.html';
const W = 1280, H = 800;
const GIF_SECONDS = 5, FPS = 12;

mkdirSync(OUT, { recursive: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });

// ── 1. The still: 3v3, three Burn stacks each. ──────────────────────────────
await page.goto(`${BASE}?burn=3&units=3`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);   // let the tongues reach full height
await page.screenshot({ path: `${OUT}/${ROW}-still.png` });
console.log('[vfx] still captured');

// ── 2. The canvas is real and is being painted. ─────────────────────────────
const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas.stage-particles');
    if (!c) return { present: false };
    const ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) lit += 1;
    return { present: true, w: c.width, h: c.height, litPixels: lit };
});
console.log('[vfx] canvas:', JSON.stringify(painted));

// ── 3. THE FRAME BUDGET, measured on the board §6 names. ────────────────────
const budget = await page.evaluate(() => new Promise((resolve) => {
    const frames = [];
    let last = performance.now();
    const n = 180;
    const tick = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        if (frames.length < n) requestAnimationFrame(tick);
        else {
            const sorted = [...frames].slice(1).sort((a, b) => a - b);
            resolve({
                frames: sorted.length,
                medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
                p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
                maxMs: +sorted[sorted.length - 1].toFixed(2),
            });
        }
    };
    requestAnimationFrame(tick);
}));
console.log('[vfx] frame budget (3v3, 3 stacks each):', JSON.stringify(budget));

// ── 4. THE IDLE RULE: no Burn on the board means no frames scheduled. ───────
await page.goto(`${BASE}?burn=0&units=3`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const idle = await page.evaluate(() => new Promise((resolve) => {
    // Count rAF callbacks the PAGE schedules over a second. The layer parks itself when nothing is
    // alive and nothing is burning, so the only frames left are the ones this probe asks for.
    let ours = 0;
    const native = window.requestAnimationFrame.bind(window);
    let others = 0;
    window.requestAnimationFrame = (cb) => { others += 1; return native(cb); };
    const t0 = performance.now();
    const probe = () => { ours += 1; if (performance.now() - t0 < 1000) native(probe); else resolve({ probeFrames: ours, layerFrames: others }); };
    native(probe);
}));
console.log('[vfx] idle rule (no burn, 1s):', JSON.stringify(idle));

// ── 5. THE OFF-SWITCH: reduced motion removes the canvas entirely. ──────────
await page.goto(`${BASE}?burn=3&units=3&reduced=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const off = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas.stage-particles').length,
    plaqueBadges: document.querySelectorAll('.stage-plaque-statuses .hud-status-badge, .stage-plaque-statuses [class*="badge"]').length,
}));
console.log('[vfx] reduced motion:', JSON.stringify(off));
await page.screenshot({ path: `${OUT}/${ROW}-reduced.png` });

// ── 6. THE GIF: five seconds of the same board as the still. ───────────────
await page.goto(`${BASE}?burn=3&units=3`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const total = GIF_SECONDS * FPS;
for (let i = 0; i < total; i += 1) {
    await page.screenshot({ path: `${OUT}/frames/f${String(i).padStart(3, '0')}.png` });
    await page.waitForTimeout(Math.max(0, Math.round(1000 / FPS) - 55));
}
console.log('[vfx]', total, 'frames captured');
// ── 7. THE VOCABULARY SHEET: one crop per kind, side by side. ──────────────
/*
 * §2a's seven kinds are 146a's actual deliverable, and only `flame` has been judged on a capture.
 * A contact sheet is how the other six stop being assumed: each one gets the same unit, the same
 * intensity and the same moment, so they can be compared rather than described.
 */
const KINDS = ['flame', 'drop', 'leaf', 'spark', 'puff', 'ring', 'streak'];
mkdirSync(`${OUT}/kinds`, { recursive: true });
for (const kind of KINDS) {
    await page.goto(`${BASE}?kind=${kind}&burn=4&units=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/kinds/${kind}.png` });
}
console.log('[vfx] vocabulary sheet captured for', KINDS.length, 'kinds');

// ── 8. THE TRAIL SHEET: the four authored elements, mid-flight. ────────────
const TRAIL_ELEMENTS = ['Fire', 'Water', 'Nature', 'None'];
mkdirSync(`${OUT}/trails`, { recursive: true });
for (const element of TRAIL_ELEMENTS) {
    await page.goto(`${BASE}?trail=${element}&units=1&burn=0`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    /*
     * A FILMSTRIP, not a still. A trail is 220ms of travel on a 520ms loop, so a single screenshot
     * is a coin toss between "mid-flight" and "nothing there" — the first attempt at this caught
     * all four elements after their heads had landed and photographed an empty board. Six frames
     * across one loop always contains the flight, and the SHAPE of a path is a thing you can only
     * see across frames anyway.
     */
    for (let i = 0; i < 6; i += 1) {
        await page.screenshot({ path: `${OUT}/trails/${element}-${i}.png` });
        await page.waitForTimeout(20);
    }
}
console.log('[vfx] trail sheet captured for', TRAIL_ELEMENTS.length, 'elements');

await browser.close();

/*
 * Pillow rather than ffmpeg: the ffmpeg that ships with Playwright is built `--disable-everything`
 * with only the muxers it needs for video recording, and has no GIF encoder at all. Pillow is
 * already installed, writes an animated GIF in four lines, and quantizes per-frame — which on a
 * board this dark is the difference between flames and banding.
 */
execFileSync('python3', ['-c', `
import glob
from PIL import Image
paths = sorted(glob.glob('${OUT}/frames/f*.png'))
frames = [Image.open(p).convert('RGB').resize((800, 500), Image.LANCZOS).quantize(colors=128, dither=Image.Dither.NONE) for p in paths]
frames[0].save('${OUT}/${ROW}.gif', save_all=True, append_images=frames[1:], duration=int(1000/${FPS}), loop=0, optimize=True)
print('gif frames:', len(frames))
`], { stdio: 'inherit' });
console.log('[vfx] gif written to', `${OUT}/${ROW}.gif`);
