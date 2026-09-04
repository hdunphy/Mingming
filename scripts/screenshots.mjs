/**
 * SCREEN CAPTURE — ticket 34's *"screenshots of every screen at 1280x800 and 1920x1080"*, and
 * ticket 45's source material for the store page.
 *
 * Not a test and not part of any build. It drives a real production build through a real cold-start
 * playthrough — pick a starter, assemble it, walk the ranch, choose a gym, take a party out, travel,
 * fight — and photographs each screen on the way. Nothing is mocked, so what it captures is what
 * ships.
 *
 * Usage, from the repo root:
 *
 *     npm run build && npx vite preview --port 4173 --strictPort &
 *     node scripts/screenshots.mjs
 *
 * Output lands in `/tmp/shots`; the committed copies under
 * `docs/wayfinder/steam-release/research/34-screens/` are quantized to 192 colours (flat UI, so it
 * is visually lossless and about four times smaller).
 *
 * # WHY A SCRIPTED PLAYTHROUGH RATHER THAN A SEEDED SAVE
 *
 * A save fixture would photograph a state no player can reach if the save format drifts, and it
 * would need maintaining alongside `save-v4`. Clicking through is slower and occasionally brittle —
 * a renamed button is a missed shot — but a shot it MISSES is a screen it could not reach, which is
 * information rather than a stale picture. It logs every miss for that reason.
 *
 * Two shots this cannot currently reach and ticket 34's resolution records as gaps: the marketplace
 * and workshop nodes (they need a run walked to one), and the run summary (it needs a run finished).
 *
 * The two viewport sizes are the ones ticket 37 rules for: 1280x800 is the Steam Deck, 1920x1080 is
 * the desktop default. A screen that only reads at one of them is a bug this script is meant to
 * surface — it is how ticket 34 caught the wild node's crossed-swords icon collapsing into an X.
 */

// Playwright is not a dependency of this repo — install it on demand:
//     npm install playwright --no-save --prefix /tmp
import pkg from '/tmp/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://localhost:4173/Mingming/';
const SIZES = [{ w: 1280, h: 800, tag: '1280x800' }, { w: 1920, h: 1080, tag: '1920x1080' }];
const OUT = '/tmp/shots';
const log = (...a) => console.log('[shot]', ...a);

async function tryClick(page, locator, label) {
    try { await locator.first().click({ timeout: 3500 }); return true; }
    catch { log('  miss:', label); return false; }
}
const byText = (page, t, exact = false) => page.getByText(t, { exact });

async function shoot(page, name, tag) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}__${tag}.png` });
    log('captured', name, tag);
}

/** Dismiss any onboarding callout so the screenshot shows the screen, not the tip. */
async function dismissTips(page) {
    for (const label of ['Skip tips', 'Got it']) {
        const el = page.getByRole('button', { name: label });
        if (await el.count() > 0) { try { await el.first().click({ timeout: 1500 }); } catch { /* fine */ } }
    }
    await page.waitForTimeout(200);
}

const section = (page, name) => page.locator('.ranch-nav-tab').filter({ hasText: name });

for (const { w, h, tag } of SIZES) {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await shoot(page, '01-main-menu', tag);
    await tryClick(page, byText(page, 'FENRIR', true), 'starter FENRIR');
    await page.waitForTimeout(1200);

    // Assemble the starter, or there is no party to take on a run.
    await tryClick(page, section(page, 'Assembly'), 'Assembly tab');
    await dismissTips(page);
    await shoot(page, '02-assembly', tag);
    await tryClick(page, page.getByRole('button', { name: /Assemble/i }), 'Assemble');
    await page.waitForTimeout(700);
    // Assembly opens a firmware chooser — the OS is picked at assembly, not later.
    await shoot(page, '02b-firmware-choice', tag);
    await tryClick(page, page.getByRole('button', { name: /Spend blueprint/i }), 'confirm assemble');
    await page.waitForTimeout(900);

    await tryClick(page, section(page, 'Roster'), 'Roster tab');
    await dismissTips(page);
    await shoot(page, '03-roster', tag);

    await tryClick(page, section(page, 'Vault'), 'Vault tab');
    await dismissTips(page);
    await shoot(page, '04-vault', tag);

    await tryClick(page, section(page, 'Codex'), 'Codex tab');
    await dismissTips(page);
    await shoot(page, '05-codex', tag);

    await tryClick(page, page.locator('.nav-settings'), 'Settings');
    await page.waitForTimeout(500);
    await shoot(page, '06-settings', tag);
    await tryClick(page, page.getByRole('button', { name: /^Close$/i }), 'Close settings');
    await page.waitForTimeout(400);

    await tryClick(page, section(page, 'Expedition'), 'Expedition tab');
    await dismissTips(page);
    await shoot(page, '07-gym-offers', tag);

    await tryClick(page, page.locator('.ranch-offer'), 'first offer');
    await page.waitForTimeout(500);
    await shoot(page, '08-party-pick', tag);

    await tryClick(page, page.locator('.ranch-roster-grid .ranch-card'), 'party member');
    await page.waitForTimeout(400);
    await tryClick(page, page.locator('.ranch-modal-actions .ranch-button'), 'start run');
    await page.waitForTimeout(1400);
    await dismissTips(page);
    await shoot(page, '09-region-map', tag);

    await tryClick(page, page.locator('.rm-travel-button'), 'travel');
    await page.waitForTimeout(1500);
    await dismissTips(page);
    await shoot(page, '10-encounter', tag);

    await tryClick(page, page.getByRole('button', { name: /fight|enter|engage/i }), 'fight');
    await page.waitForTimeout(1800);
    await dismissTips(page);
    await shoot(page, '11-battle', tag);

    await browser.close();
}
console.log('ok');
