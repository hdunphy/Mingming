// T4 / ticket 205 follow-up: writes sheet.html (the icon alternatives) beside this file, from the
// installed @tabler/icons. Usage, from the repo root: node docs/wayfinder/first-impressions/research/205-icon-alternatives/build-sheet.mjs .
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.argv[2];
const PKG = resolve(ROOT, 'node_modules/@tabler/icons');
const OUTLINE = JSON.parse(readFileSync(resolve(PKG, 'tabler-nodes-outline.json'), 'utf8'));
const FILLED = JSON.parse(readFileSync(resolve(PKG, 'tabler-nodes-filled.json'), 'utf8'));
const VERSION = JSON.parse(readFileSync(resolve(PKG, 'package.json'), 'utf8')).version;
const OUT_DIR = resolve(ROOT, 'docs/wayfinder/first-impressions/research/205-icon-alternatives');

// The game's colours (src/ui/theme/tokens.css, src/index.css, statusGlossary.ts).
const C = {
    page: '#0b0e16', panel: '#1e2638', panel2: '#2b3446', panel3: '#3a455a', ink: '#101521',
    text: '#ffffff', textMute: '#9aa6b8', select: '#ffd500', cardBody: '#f4f6f9', cardText: '#1a2130',
    hp: '#4cda64', elFire: '#f25c2a',
    // .card-tooltip: rgba(15, 15, 30, 0.95) over the page.
    tip: '#0f0f1d', tipText: 'rgba(255,255,255,0.85)', tipCond: 'rgba(255,255,255,0.55)', tipGloss: 'rgba(255,255,255,0.72)',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nodes = (list) => list.map(([tag, a]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('');

/** One Tabler glyph exactly as TablerGlyph/InlineIcon draws it: 24 grid, currentColor, round caps. */
function glyph(name, size, { filled = false, stroke = 1.7, inline = false } = {}) {
    const set = filled ? FILLED : OUTLINE;
    if (!set[name]) return `<span class="none">no ${filled ? 'filled' : 'outline'}</span>`;
    const style = inline ? ` style="vertical-align:-0.15em"` : '';
    const body = filled ? `<g fill="currentColor" stroke="none">${nodes(set[name])}</g>` : nodes(set[name]);
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${style}>${body}</svg>`;
}
const hasFilled = (n) => Boolean(FILLED[n]);

const pages = [];
const page = (title, sub, body) => pages.push({ title, sub, body });

// ---------------------------------------------------------------- page 1: the type chart button
const CHART = [
    ['dna', 'today', 'Genetics. Tabler draws it as a small ring with two hooks off opposite corners, so at 12 to 20 px it reads as a crosshair or a satellite, not DNA; and the game\'s enemy-target icon is <code>crosshair</code>.'],
    ['dna-2', '206 B7 lean', 'A vertical helix. At 12 and 16 px (the button draws 16.25) it reads as an HOURGLASS, "wait", not DNA; only at 20 px does the twist show. And it still says "genetics", which Henry does not want.'],
    ['chart-radar', '', 'A spider chart: "stats compared". Reads as a stat screen more than a who-beats-whom table.'],
    ['arrows-exchange', '', 'Two opposed arrows: "this against that". Already the game\'s <code>swap</code> icon (<code>icons.ts</code>), so it would mean two things.'],
    ['swords', '', 'Crossed swords: "matchups, fighting". Already the map\'s <code>rival</code> node icon; the single <code>sword</code> is attack.'],
    ['layout-grid', '', 'Four squares: "a grid". Says "a table opens" but nothing about types; the most neutral pick.'],
    ['target-arrow', '', 'An arrow in a bullseye: "what hits well". Close in meaning and shape to the enemy-target <code>crosshair</code>.'],
    ['triangle', '', 'A plain triangle: "the type triangle", the three-way element cycle. Only says that to a player who knows the cycle; small, it is just a shape, and it is <code>alert-triangle</code> without the "!".'],
    ['table', 'extra', 'A table with a header row: literally what opens (an attacker-by-defender table). Not on the brief\'s list; added as the plainest option.'],
];
{
    const rows = CHART.map(([n, tag, says]) => {
        const sizes = (bg, fg) => `<div class="cell" style="background:${bg};color:${fg}">${[12, 16, 20].map((s) => glyph(n, s)).join('')}</div>`;
        // The real button: 26px tall, panel-2, 13px Barlow Condensed, icon 1.25em = 16.25px; open = select + ink.
        const btn = (open) => `<span class="tcbtn${open ? ' open' : ''}">${glyph(n, 16.25)}</span>`;
        return `<div class="row r1">${sizes(C.panel, C.text)}${sizes(C.cardBody, C.cardText)}<div class="cell btns" style="background:${C.panel}">${btn(false)}${btn(true)}</div>`
            + `<div class="what"><code>${n}</code>${tag ? ` <span class="tag">${tag}</span>` : ''}<div class="note">${says}</div></div></div>`;
    }).join('\r\n');
    page('205 follow-up - the type chart button (1 of 5)',
        'Each candidate at 12, 16 and 20 px on --panel (white icon) and --card-body (card text colour), then the real button at its real size: 26 px tall, --panel-2, the icon at 1.25em of 13 px = 16.25 px; closed, then open (--select, --ink). Stroke 1.7, the game\'s weight.',
        `<div class="legend l1"><div>On --panel - 12 / 16 / 20 px</div><div>On --card-body - 12 / 16 / 20 px</div><div>The button: closed, open</div><div>Tabler name - what it says</div></div>\r\n${rows}`);
}

// ---------------------------------------------------------------- pages 2-3: the tooltip effect icons
// Sizes from src/index.css at the default text size (root 16 px): .tooltip-action 0.7rem = 11.2 px,
// .tooltip-cond 0.62rem = 9.92 px, .tooltip-label 0.55rem = 8.8 px. InlineIcon is 1em.
const EFFECT = [
    ['sword', 'ATTACK', '40 power'],
    ['heart', 'HEAL', 'Heals with 30 power'],
    ['point', 'STATUS', '2× Burn → the target'],
    ['x', 'CLEANSE', 'Clears every status'],
    ['bolt', 'ENERGY, MAX_ENERGY', '+1 Energy'],
    ['cards', 'DRAW', 'Draw 1'],
    ['trash', 'DISCARD, FORCE_DISCARD', 'Discard 1'],
    ['flame', 'EXHAUST', 'Exhausts 1 — gone for the fight'],
    ['arrow-back-up', 'RETURN', 'Returns 1 from the discard'],
    ['search', 'SEARCH', 'Search the deck for a card'],
    ['sparkles', 'GENERATE_CARD', 'Adds a card to your hand'],
    ['multiplier-2x', 'MULTIPLY_STATUS', 'Doubles Burn on the target'],
    ['stopwatch', 'TRIGGER_STATUS', 'Makes Poison tick now'],
    ['repeat', 'PLAY_LAST_CARD', 'Replays the last card you cast'],
    ['shield', 'TAUNT', 'Forces the target to attack the caster'],
    ['arrow-up', 'BUFF_NEXT_PROGRAM', 'Strengthens the next card you play'],
    ['arrow-ramp-right', 'REDIRECT_TARGET', 'Redirects the incoming attack'],
    ['contrast', 'SHIFT_STANCE', 'Shifts stance'],
    ['recycle', 'REVIVE', 'Revives a fallen ally'],
];
const MARKS = [
    ['alert-triangle', 'Requirements heading (MARK_ICON.warning)', 8.8, C.textMute, 'REQUIREMENTS', 'label'],
    ['check', 'a conditional that holds (MARK_ICON.tick)', 9.92, C.hp, 'if the target is below 50% HP', 'cond'],
];
function tipRow(n, where, px, color, words, kind) {
    const line = kind === 'label'
        ? `<span class="tl-label" style="color:${color}">${glyph(n, px, { inline: true })} Requirements</span>`
        : kind === 'cond'
            ? `<span class="tl-action" style="color:${C.tipText}">${glyph('cards', 11.2, { inline: true })} Draw 1<span class="tl-cond" style="color:${color}"> ${esc(words)} ${glyph(n, px, { inline: true })}</span></span>`
            : `<span class="tl-action" style="color:${color}">${glyph(n, px, { inline: true })} ${esc(words)}</span>`;
    const cell = (inner) => `<div class="cell" style="background:${C.tip};color:${color}">${inner}</div>`;
    const filled = hasFilled(n);
    return `<div class="row r2"><div class="cell line" style="background:${C.tip}">${line}</div>`
        + cell(glyph(n, px)) + cell(glyph(n, px, { stroke: 2 })) + cell(glyph(n, 12)) + cell(glyph(n, 14))
        + cell(filled ? glyph(n, px, { filled: true }) : '<span class="none">none</span>')
        + cell(filled ? glyph(n, 14, { filled: true }) : '<span class="none">none</span>')
        + `<div class="what"><code>${n}</code> <span class="px">${px} px</span>${filled ? ' <span class="tag f">filled exists</span>' : ''}<div class="note">${esc(where)}</div></div></div>`;
}
const TIP_LEGEND = `<div class="legend l2"><div>Today, in its line (real px)</div><div>Today</div><div>Today, stroke 2</div><div>12 px</div><div>14 px</div><div>Filled, today</div><div>Filled, 14 px</div><div>Tabler name - today's px - used for</div></div>`;
const TIP_SUB = 'Every icon on the card hover tooltip (CardHand.tsx via TooltipLines.tsx), on the tooltip\'s own background (rgba(15,15,30,.95)) in its own text colour. "Today" is its real size at the default text size: effect lines 0.7rem = 11.2 px, the met tick 0.62rem = 9.92 px, the Requirements triangle 0.55rem = 8.8 px. Stroke 2 is the weight the status chips already use at 12 px. Filled is Tabler\'s own filled drawing, where one exists.';
const effectRows = EFFECT.map(([n, act, words]) => tipRow(n, `card effect line: ${act}`, 11.2, C.tipText, words, 'effect'));
page('205 follow-up - card tooltip icons, effect lines (2 of 5)', TIP_SUB, `${TIP_LEGEND}\r\n${effectRows.slice(0, 10).join('\r\n')}`);
page('205 follow-up - card tooltip icons, effect lines and marks (3 of 5)', TIP_SUB,
    `${TIP_LEGEND}\r\n${effectRows.slice(10).join('\r\n')}\r\n<div class="group">The two marks</div>\r\n${MARKS.map(([n, w, px, col, words, kind]) => tipRow(n, w, px, col, words, kind)).join('\r\n')}`);

// ---------------------------------------------------------------- page 4: the status icons in the tooltip glossary
const STATUS = [
    ['Burn', 'flame', '#ff8a30'], ['Poison', 'skull', '#88cc22'], ['Asleep', 'zzz', '#8888ff'],
    ['Weakened', 'arrow-big-down', '#ff8888'], ['Strengthened', 'arrow-big-up', '#44ddff'], ['Dazed', 'spiral', '#cc88ff'],
    ['Sharp', 'shield-up', '#aaaaaa'], ['Stunned', 'ban', '#ffcc00'], ['Regen', 'heart-plus', '#22cc88'],
    ['Energized', 'recharging', '#00e5ff'], ['Alert', 'eye', '#00d2ff'], ['Bark Shield', 'wood', '#b58d4c'],
    ['Dark Stance', 'moon', '#a347ff'], ['Light Stance', 'sun', '#ffd700'],
];
{
    const rows = STATUS.map(([label, n, col]) => {
        const cell = (inner) => `<div class="cell" style="background:${C.tip};color:${col}">${inner}</div>`;
        const filled = hasFilled(n);
        const line = `<span class="tl-gloss"><span class="tl-gname" style="color:${col}">${glyph(n, 11, { stroke: 2, inline: true })} ${esc(label)}</span> <span style="color:${C.tipGloss}">…its glossary line</span></span>`;
        return `<div class="row r4"><div class="cell line" style="background:${C.tip}">${line}</div>`
            + cell(glyph(n, 11, { stroke: 2 })) + cell(glyph(n, 12, { stroke: 2 })) + cell(glyph(n, 14, { stroke: 2 }))
            + cell(filled ? glyph(n, 11, { filled: true }) : '<span class="none">none</span>')
            + cell(filled ? glyph(n, 14, { filled: true }) : '<span class="none">none</span>')
            + `<div class="what"><code>${n}</code> ${esc(label)}${filled ? ' <span class="tag f">filled exists</span>' : ''}</div></div>`;
    }).join('\r\n');
    page('205 follow-up - status icons in the tooltip\'s "Statuses & keywords" lines (4 of 5)',
        'The tooltip\'s glossary lines draw <code>StatusIcon size={11}</code> (stroke 2, the status colour) beside the name in 0.62rem = 9.92 px. A fixed 11 px: unlike the effect icons it does not grow with the Text size setting. Henry ruled every status pick (2026-10-05/06); this page is about size and weight only.',
        `<div class="legend l4"><div>Today, in its line</div><div>11 px (today)</div><div>12 px</div><div>14 px</div><div>Filled, 11 px</div><div>Filled, 14 px</div><div>Tabler name - status</div></div>\r\n${rows}`);
}

// ---------------------------------------------------------------- page 5: whole tooltips side by side
const COSTS = `<div class="group" style="margin-top:22px">What each fix would cost in code (none of it done; this sheet changes no game file)</div>
<table class="costs"><tr><th>Fix</th><th>Where</th><th>Size of the change</th></tr>
<tr><td>Bigger effect icons</td><td><code>TooltipLines.tsx</code>, <code>EffectLine</code></td><td><code>InlineIcon</code> already takes <code>size</code>: <code>size="1.25em"</code> is 14 px on the 11.2 px line (and still grows with the Text size setting); about <code>1.07em</code> is 12 px. One prop.</td></tr>
<tr><td>Bigger marks</td><td><code>RequirementsLabel</code>, <code>MetMark</code></td><td>The same prop on each (the triangle sits in 8.8 px type, the tick in 9.92 px).</td></tr>
<tr><td>Bigger status icons</td><td><code>CardHand.tsx</code>, the glossary line</td><td><code>&lt;StatusIcon size={11}&gt;</code> becomes 12 or 14. A fixed px, so it does not follow the Text size setting.</td></tr>
<tr><td>Stroke 2</td><td><code>InlineIcon</code></td><td>No stroke prop today. <code>TablerGlyph</code> already accepts <code>strokeWidth</code> (StatusIcon passes it), so a small new prop.</td></tr>
<tr><td>Filled</td><td><code>cardEffectIcons.ts</code>, <code>tabler-icons.names.json</code></td><td>Not one word: <code>EFFECT_ICON</code> holds outline names only, so it would hold <code>InlineIconRef</code>s, and each filled name joins the "filled" list, then <code>npm run icons</code>. Eight of the nineteen effect icons have no filled drawing (sword, the three arrows, multiplier-2x, stopwatch, repeat, recycle), so a filled set would be mixed.</td></tr></table>`;
function tooltip(title, opt) {
    const eff = (n) => opt.effect(n);
    const line = (n, words, extra = '') => `<div class="t-action">${eff(n)} ${esc(words)}${extra}</div>`;
    return `<div class="tipcol"><div class="tiptitle">${title}</div><div class="card-tooltip">`
        + `<div class="t-section"><div class="t-label">${opt.mark('alert-triangle', 8.8)} Requirements</div><div class="t-constraint">Cannot be paid for right now</div></div>`
        + `<div class="t-section"><div class="t-label">Effects</div>`
        + line('sword', '40 power') + line('point', '2× Burn → the target')
        + `<div class="t-action is-met">${eff('cards')} Draw 1<span class="t-cond"> if the target is below 50% HP ${opt.mark('check', 9.92)}</span></div>`
        + line('bolt', '+1 Energy') + line('trash', 'Discard 1') + line('arrow-back-up', 'Returns 1 from the discard') + `</div>`
        + `<div class="t-section"><div class="t-label">Statuses &amp; keywords</div><div class="t-gloss"><span class="t-gname" style="color:#ff8a30">${opt.status('flame')} Burn</span> At end of turn, takes 1.5% / 3% / 5% / 8% of max HP as damage at 1 / 2 / 3 / 4 stacks…</div></div>`
        + `</div><div class="tipnote">${opt.note}</div></div>`;
}
{
    const inl = (n, px, o = {}) => glyph(n, px, { ...o, inline: true });
    const filledOr = (n, px) => (hasFilled(n) ? inl(n, px, { filled: true }) : inl(n, px));
    const cols = [
        tooltip('Today', { effect: (n) => inl(n, 11.2), mark: (n, px) => inl(n, px), status: (n) => inl(n, 11, { stroke: 2 }), note: 'Effects 11.2 px, tick 9.92, triangle 8.8, status 11 (stroke 2).' }),
        tooltip('Today\'s size, stroke 2', { effect: (n) => inl(n, 11.2, { stroke: 2 }), mark: (n, px) => inl(n, px, { stroke: 2 }), status: (n) => inl(n, 11, { stroke: 2 }), note: 'Weight only: the status chips\' stroke 2 on every icon.' }),
        tooltip('Effect icons 12 px', { effect: (n) => inl(n, 12), mark: (n, px) => inl(n, px), status: (n) => inl(n, 12, { stroke: 2 }), note: 'Effects and status 12 px; marks unchanged.' }),
        tooltip('Effect icons 14 px', { effect: (n) => inl(n, 14), mark: (n, px) => inl(n, Math.max(px, 12)), status: (n) => inl(n, 14, { stroke: 2 }), note: 'Effects and status 14 px (1.25em of the line); marks 12 px.' }),
        tooltip('Filled where Tabler has one', { effect: (n) => filledOr(n, 11.2), mark: (n, px) => filledOr(n, px), status: (n) => filledOr(n, 11), note: 'Today\'s sizes. Filled here: point, bolt, cards, trash, the triangle, check, flame. Sword and the return arrow have no filled drawing.' }),
    ];
    page('205 follow-up - the whole tooltip, five ways (5 of 5)',
        'One sample tooltip (the words are the game\'s own strings from cardEffectText.ts and cardConditionals.ts; the card itself is made up), drawn with the real CSS values: 240 px wide, Barlow, the same font sizes and colours. Only the icons change between columns. At the 1.3 Text size setting the effect icons are already 14.7 px; at 0.9 they are 9.8 px.',
        `<div class="tips">${cols.join('\r\n')}</div>\r\n${COSTS}`);
}

// ---------------------------------------------------------------- assemble
const FONT = '../../../../../public/fonts';
const css = `
@font-face{font-family:'Barlow';font-weight:600;src:url('${FONT}/Barlow-SemiBold.woff2') format('woff2')}
@font-face{font-family:'Barlow';font-weight:700;src:url('${FONT}/Barlow-Bold.woff2') format('woff2')}
@font-face{font-family:'Barlow Condensed';font-style:italic;font-weight:800;src:url('${FONT}/BarlowCondensed-ExtraBoldItalic.woff2') format('woff2')}
*{box-sizing:border-box}
body{margin:0;background:${C.page};color:#dfe5ee;font:13px/1.35 system-ui,'Segoe UI',Arial,sans-serif}
.page{width:1280px;height:800px;padding:20px 24px;overflow:hidden;border-bottom:2px solid #000;position:relative}
.page h1{margin:0 0 2px;font-size:20px;font-weight:700;color:#fff}
.page .sub{margin:0 0 10px;color:#9aa6b8;font-size:12px;max-width:1220px}
.page .sub code,.what code{background:#161c2a;padding:1px 5px;border-radius:4px;color:#ffd500;font-size:12px}
.legend,.row{display:grid;gap:8px;align-items:center}
.l1,.r1{grid-template-columns:200px 200px 150px 1fr;gap:12px}
.l2,.r2{grid-template-columns:270px 62px 62px 62px 62px 62px 62px 1fr}
.l4,.r4{grid-template-columns:270px 70px 70px 70px 70px 70px 1fr}
.legend{margin:2px 0 4px;color:#6b778c;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.row{padding:3px 0;border-top:1px solid #1c2230}
.r1 .cell{height:58px}.r2 .cell{height:44px}.r4 .cell{height:36px}
.cell{display:flex;align-items:center;justify-content:center;gap:12px;padding:0 10px;border-radius:6px}
.cell.line{justify-content:flex-start}
.tag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:9px;background:#5b4310;color:#ffd47a}
.tag.f{background:#17402a;color:#8be0a8}
.px{color:#8fb4d8;font-size:11px}
.note{color:#9aa6b8;font-size:11.5px;margin-top:2px}
.none{color:#4b5568;font-size:10px}
.group{margin:8px 0 2px;font-size:11px;color:#8fb4d8;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
.foot{position:absolute;left:24px;right:24px;bottom:10px;color:#6b778c;font-size:11px}
.tcbtn{display:inline-flex;align-items:center;height:26px;padding:0 16px;background:${C.panel2};color:${C.text};clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)}
.tcbtn.open{background:${C.select};color:${C.ink}}
.tl-action,.tl-label,.tl-gloss{font-family:'Barlow',system-ui,sans-serif;line-height:1.5;white-space:nowrap;overflow:hidden}
.tl-action{font-size:11.2px;font-weight:600}
.tl-label{font-size:8.8px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.tl-cond{font-size:9.92px;font-weight:700}
.tl-gloss{font-size:9.92px;font-weight:600}
.tl-gname,.t-gname{font-weight:800;letter-spacing:.4px;text-transform:uppercase}
.tips{display:flex;gap:8px;margin-top:6px}
.tipcol{width:240px}
.tiptitle{font-size:12px;font-weight:700;color:#fff;margin:0 0 6px}
.tipnote{font-size:11px;color:#9aa6b8;margin-top:6px}
.card-tooltip{width:240px;background:rgba(15,15,30,.95);border:1px solid ${C.select};border-radius:10px;padding:10px;font-family:'Barlow',system-ui,sans-serif;font-weight:600;line-height:1.5;box-shadow:0 8px 30px rgba(0,0,0,.7)}
.t-section{margin-bottom:6px}.t-section:last-child{margin-bottom:0}
.t-label{font-size:8.8px;text-transform:uppercase;letter-spacing:1px;color:${C.textMute};margin-bottom:3px;font-weight:700}
.t-action,.t-constraint{font-size:11.2px;color:${C.tipText};padding:2px 0}
.t-constraint{color:${C.elFire}}
.t-cond{color:${C.tipCond};font-size:9.92px}
.t-action.is-met .t-cond{color:${C.hp};font-weight:700}
.t-gloss{font-size:9.92px;line-height:1.35;color:${C.tipGloss};padding:2px 0}
table.costs{border-collapse:collapse;width:100%;font-size:12px}
.costs td,.costs th{border-top:1px solid #1c2230;padding:5px 8px;text-align:left;vertical-align:top}
.costs th{color:#8fb4d8;font-size:11px;text-transform:uppercase}
.costs code{background:#161c2a;padding:1px 4px;border-radius:4px;color:#ffd500;font-size:11.5px}
body.single .page{display:none}body.single .page.on{display:block}
`.trim();

const FOOT = `Tabler Icons ${VERSION} (MIT, Paweł Kuna), drawn from node_modules/@tabler/icons as the game draws them; nothing hand-drawn. Ticket 205 follow-up (206 B7, B10). Open with ?page=N for one page.`;
const html = [
    '<!doctype html><html><head><meta charset="utf-8"><title>Icon alternatives sheet</title><style>',
    css,
    '</style></head><body>',
    ...pages.map((p, i) => `<section class="page" id="p${i + 1}"><h1>${p.title}</h1><p class="sub">${p.sub}</p>\r\n${p.body}\r\n<div class="foot">${FOOT}</div></section>`),
    `<script>var m=/[?&]page=(\\d+)/.exec(location.search);if(m){document.body.className='single';var e=document.getElementById('p'+m[1]);if(e)e.className+=' on';}</script>`,
    '</body></html>',
    '',
].join('\r\n').replace(/\r?\n/g, '\r\n');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'sheet.html'), html);
console.log(`wrote sheet.html, ${pages.length} pages, Tabler ${VERSION}`);
