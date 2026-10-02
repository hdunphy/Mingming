/*
 * BATTLE JUICE LAB - reference prototype for tickets 189 and 190 (2026-10-02).
 *
 * This is the code behind the Battle Juice Lab artifact (https://claude.ai/artifact/QzDRnvRLHquCYnwNPHtm4p).
 * It is NOT game code and is not imported anywhere: one self-contained prototype file, kept so the
 * implementing agent can read the exact timings (PRESETS / TIERS), the clock (wait / play / freeze /
 * speed), the trauma shake, and how each element effect is drawn. Port the ideas into small composed
 * modules under src/ui/vfx/, not this file's structure.
 *
 * It expects a global IMG map of sprite data URIs and the lab page's DOM; it will not run on its own.
 */
(() => {
'use strict';
const W = 1280, H = 546;
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const E = {
  lin: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

/* ------------------------------------------------------------------ data */
const ELEM = {
  Fire:   { rgb: [224, 93, 67],  hot: [255, 238, 170], icon: '🔥', num: [255, 128, 92] },
  Water:  { rgb: [61, 155, 224], hot: [215, 240, 255], icon: '💧', num: [110, 190, 255] },
  Nature: { rgb: [67, 180, 95],  hot: [215, 255, 180], icon: '🍃', num: [110, 225, 130] },
  None:   { rgb: [200, 206, 214], hot: [255, 255, 255], icon: '✦', num: [240, 244, 250] },
};
const STATUS = {
  Burn:     { rgb: [255, 122, 47],  icon: '🔥', buff: false, label: 'Burn',       card: 'Kindle',      el: 'Fire' },
  Poison:   { rgb: [176, 96, 232],  icon: '☠️', buff: false, label: 'Poison',     card: 'Toxic Spores', el: 'Nature' },
  Dazed:    { rgb: [255, 214, 74],  icon: '💫', buff: false, label: 'Dazed',      card: 'Static Pulse', el: 'None' },
  Weakened: { rgb: [150, 160, 182], icon: '🔻', buff: false, label: 'Weakened',   card: 'Sap Strength', el: 'Nature' },
  Strength: { rgb: [255, 84, 84],   icon: '💪', buff: true,  label: 'Strength',   card: 'War Cry',     el: 'Fire' },
  Sharp:    { rgb: [225, 240, 255], icon: '🗡️', buff: true,  label: 'Sharp',      card: 'Whetstone',   el: 'None' },
  Regen:    { rgb: [95, 224, 122],  icon: '✚', buff: true,  label: 'Regen',      card: 'Sap Bloom',   el: 'Nature' },
  Bark:     { rgb: [176, 120, 62],  icon: '🛡️', buff: true,  label: 'Bark Shield', card: 'Bark Skin',   el: 'Nature' },
};
const MOVES = [
  { id: 'flame',    name: 'Flame Column', el: 'Fire',   kind: 'single', cost: 2, note: 'beam' },
  { id: 'jet',      name: 'Water Jet',    el: 'Water',  kind: 'single', cost: 2, note: 'jet' },
  { id: 'vine',     name: 'Vine Lash',    el: 'Nature', kind: 'single', cost: 2, note: 'whip' },
  { id: 'tackle',   name: 'Tackle',       el: 'None',   kind: 'contact', cost: 1, note: 'contact' },
  { id: 'firewall', name: 'Fire Wall',    el: 'Fire',   kind: 'side', cost: 3, note: 'all enemies' },
  { id: 'wave',     name: 'Tidal Wave',   el: 'Water',  kind: 'side', cost: 3, note: 'all enemies' },
  { id: 'pollen',   name: 'Pollen Cloud', el: 'Nature', kind: 'side', cost: 2, note: '+ Poison', rider: 'Poison' },
];
const STATUS_MOVES = Object.entries(STATUS).map(([k, v]) => ({
  id: 'st-' + k, name: v.card, el: v.el, kind: 'status', status: k, cost: 1, note: (v.buff ? '+' : '') + v.label,
}));

const ROSTER = {
  fenrir: { name: 'Fenrir', el: 'Fire', img: 'fenrir', faceRight: true },
  rat:    { name: 'Ratatoskr', el: 'Nature', img: 'rat', faceRight: false },
  kraken: { name: 'Kraken', el: 'Water', img: 'kraken', faceRight: true },
};
const PARTY = {
  1: { ally: ['fenrir'], enemy: ['kraken'] },
  2: { ally: ['fenrir', 'rat'], enemy: ['kraken', 'rat'] },
  3: { ally: ['rat', 'fenrir', 'kraken'], enemy: ['rat', 'kraken', 'fenrir'] },
};
const ROWS = { 1: [213], 2: [128, 298], 3: [48, 213, 378] };

/* ------------------------------------------------------------------ presets
   Every number here is "at 1× speed". The runner and the timeline both read from these,
   so what the timeline says is what the stage does. s = damage scale 0..1 (see dmgScale). */
const PRESETS = {
  current: {
    label: 'Today',
    note: 'A replica of what ships now. Watch the timeline: the number, HP drop, sound, hit-stop and shake all fire the instant the card is played. The trail only lands 0.4 s later.',
  },
  snappy: {
    label: 'A · Snappy',
    note: 'Slay the Spire / Balatro pace. Short wind-up, quick projectile, crisp hit-stop. Screen shake only on hits of 20% max HP or more; smaller hits shake just the target.',
    windup: () => 50, lunge: 100, lungeDist: 34,
    head: (s) => 120 + 60 * s, sustain: (s) => 20 + 180 * s,
    hitstop: (s) => 40 + 70 * s, kill: 140, react: 110, back: 130,
    wiggle: 200, orb: 220, statusLand: 340, cardIn: 150, cardOut: 140, read: 1000,
    screenAt: 0.2, trauma: (s) => 0.25 + 0.45 * s, targetShake: (s) => 3 + 5 * s,
    pmul: 0.85, dim: false, charge: false, dimAt: 1, chargeAt: 1, zoom: 0, num: (s) => 26 + 22 * s,
  },
  showy: {
    label: 'B · Showy',
    note: 'Pokémon pace. Wind-up grows with damage (big hits dim the stage and charge up), the beam pours longer, heavier hit-stop and a camera punch. Screen shake from 12% max HP.',
    windup: (s) => 120 + 100 * s, lunge: 150, lungeDist: 54,
    head: (s) => 180 + 80 * s, sustain: (s) => 120 + 480 * s,
    hitstop: (s) => 60 + 80 * s, kill: 170, react: 170, back: 200,
    wiggle: 300, orb: 320, statusLand: 520, cardIn: 180, cardOut: 160, read: 1000,
    screenAt: 0.12, trauma: (s) => 0.3 + 0.55 * s, targetShake: (s) => 4 + 7 * s,
    pmul: 1.3, dim: true, charge: true, dimAt: 0.6, chargeAt: 0.5, zoom: 0.03, num: (s) => 30 + 30 * s,
  },
};
/* SLOW = a heavier Showy (Henry, 2026-10-02: "slow being a more impactful slower Showy"):
   30% longer beats, 25% more hit-stop, more shake, and the dim + charge-up start on medium hits. */
PRESETS.slow = Object.assign({}, PRESETS.showy, {
  label: 'Slow',
  note: 'A heavier Showy: every beat about 30% longer, more hit-stop and shake, bigger numbers, and the stage dims and charges up from medium hits, not only big ones.',
  windup: (s) => 1.3 * PRESETS.showy.windup(s), lunge: 190, lungeDist: 62,
  head: (s) => 1.3 * PRESETS.showy.head(s), sustain: (s) => 1.3 * PRESETS.showy.sustain(s),
  hitstop: (s) => 1.25 * PRESETS.showy.hitstop(s), kill: 210, react: 220, back: 250,
  wiggle: 380, orb: 400, statusLand: 650, cardIn: 220, cardOut: 200,
  screenAt: 0.08, trauma: (s) => Math.min(1, 0.1 + PRESETS.showy.trauma(s)), targetShake: (s) => 5 + 8 * s,
  pmul: 1.5, dimAt: 0.35, chargeAt: 0.3, zoom: 0.045, num: (s) => 34 + 32 * s,
});
PRESETS.showy.note = 'Pokémon pace. The wind-up grows with damage (big hits dim the stage and charge up), the beam pours longer, heavier hit-stop and a camera punch. Screen shake from 12% max HP.';
PRESETS.snappy.note = 'Slay the Spire / Balatro pace. Short wind-up, quick projectile, crisp hit-stop. Screen shake only from 20% max HP; smaller hits shake just the target.';
const TIERS = {
  slow:    { label: 'Slow',    preset: 'slow',   speed: 1, note: () => PRESETS.slow.note },
  showy:   { label: 'Showy',   preset: 'showy',  speed: 1, note: () => PRESETS.showy.note },
  snappy:  { label: 'Snappy',  preset: 'snappy', speed: 1, note: () => PRESETS.snappy.note },
  fast:    { label: 'Fast',    preset: 'snappy', speed: 2, note: () => 'Snappy at 2×, so the hits keep their shape. Hit-stop shrinks with speed but never drops below 30 ms.' },
  instant: { label: 'Instant', preset: 'snappy', speed: 1, note: () => 'No animation and no waiting: numbers, HP and statuses update at once. Every wait collapses too, not just the effects.' },
};
/* Ticket 146's shipped constants, for the replica. */
const CUR = { flight: 180, trail: 220, stagger: 40, statusGap: 60, playerHold: 1500, enemyPause: 1200,
  hsMin: 30, hsMax: 110, shakeMin: 2, shakeMax: 8, shakeKill: 10, shakeMs: 120 };

/* ------------------------------------------------------------------ settings */
const settings = {
  tier: 'showy', today: false, slowmo: false, party: 3, dmg: 22, eff: 'normal', rider: '',
  shake: 0.6, hitstop: true, flashes: true, particles: true, catchup: true, reduced: false, sound: false,
};
try {
  const saved = JSON.parse(localStorage.getItem('bjl-settings-v2') || 'null');
  if (saved && typeof saved === 'object') Object.assign(settings, saved);
} catch (e) { /* storage blocked: defaults are fine */ }
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) settings.reduced = true;
delete settings.preset; delete settings.speed;
const saveSettings = () => { try { localStorage.setItem('bjl-settings-v2', JSON.stringify(settings)); } catch (e) { /* ignore */ } };

if (!TIERS[settings.tier]) settings.tier = 'showy';
const instant = () => settings.tier === 'instant';
const pkey = () => (settings.today ? 'current' : TIERS[settings.tier].preset);
const baseSpeed = () => TIERS[settings.tier].speed * (settings.slowmo ? 0.25 : 1);
const reduced = () => settings.reduced;
let ffHeld = false;

/* ------------------------------------------------------------------ the clock
   One game clock. Every wait and tween runs on it, so battle speed, hold-to-fast-forward,
   Instant and hit-stop all work in one place (the Temtem lesson: skipping animation must also
   collapse the waits). */
const clock = { t: 0, frozenUntil: 0, pFrozenUntil: 0, waits: [], plays: [] };
let queueLen = 0;
function speed() {
  if (instant()) return 1;
  let s = baseSpeed();
  if (ffHeld) s *= 3;
  if (settings.catchup && queueLen > 1) s *= 1 + 0.2 * Math.min(queueLen - 1, 3);
  return s;
}
function wait(ms) {
  if (instant() || ms <= 0) return Promise.resolve();
  return new Promise((r) => clock.waits.push({ at: clock.t + ms, r }));
}
/** Run fn(p) every frame for ms of game time; resolves at the end. */
function play(ms, fn, ease = E.lin) {
  if (instant() || ms <= 0) { fn(1); return Promise.resolve(); }
  return new Promise((r) => clock.plays.push({ start: clock.t, ms, fn, ease, r }));
}
function tweenU(u, props, ms, ease = E.outCubic) {
  const from = {};
  for (const k in props) from[k] = u[k];
  return play(ms, (p) => { for (const k in props) u[k] = lerp(from[k], props[k], p); }, ease);
}
/** Hit-stop, in real ms. Scaled down at high speed but never below 30 ms (under that it can't be seen). */
function freeze(ms) {
  if (!settings.hitstop || ms <= 0 || instant() || reduced()) return 0;
  const real = Math.max(30, ms / Math.sqrt(baseSpeed() * (ffHeld ? 3 : 1)));
  clock.frozenUntil = Math.max(clock.frozenUntil, performance.now() + real);
  return real;
}

/* ------------------------------------------------------------------ stage + units */
const stage = $('#stage'), cam = $('#cam'), unitsEl = $('#units'), dimEl = $('#dim');
const canvas = $('#fx'), ctx = canvas.getContext('2d');
let DPR = 1;
function fitStage() {
  const k = $('#stageWrap').clientWidth / W;
  stage.style.transform = `scale(${k})`;
  DPR = clamp((window.devicePixelRatio || 1) * k, 0.75, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
}
new ResizeObserver(fitStage).observe($('#stageWrap'));
const backdrop = $('#backdrop');

const state = { units: [], caster: null, target: null, enemyActive: null, dim: 0, zoom: 0, trauma: 0, camKick: null };
function mkUnit(key, side, row) {
  const r = ROSTER[key];
  const u = {
    id: side + row, key, side, row, name: r.name, el: r.el, maxHp: 100, hp: 100, shown: 100, ghost: 100, bark: 0,
    statuses: {}, ox: 0, oy: 0, kx: 0, shakeX: 0, sx: 1, sy: 1, rot: 0, bright: 1, sat: 1, alpha: 1,
    glow: null, glowA: 0, vibUntil: 0, vibAmp: 0, dead: false, bx: 0, by: 0,
  };
  const flip = side === 'ally' ? !r.faceRight : r.faceRight;
  const el = document.createElement('div');
  el.className = 'unit';
  el.innerHTML = `<div class="shadow"></div><div class="sel"></div><div class="sprite"><img alt="${r.name}" class="${flip ? 'flip' : ''}" src="${IMG[r.img]}"></div>`;
  const pl = document.createElement('div');
  pl.className = 'plaque';
  pl.style.setProperty('--elc', `var(--${r.el.toLowerCase()})`);
  pl.innerHTML = `<div class="nm"><span>${r.name}</span><span class="hpn">100/100</span></div><div class="hp"><div class="ghost"></div><div class="fill"></div><div class="bark"></div></div><div class="badges"></div>`;
  u.el = el; u.spr = el.querySelector('.sprite'); u.pl = pl;
  u.hpn = pl.querySelector('.hpn'); u.fill = pl.querySelector('.fill'); u.gh = pl.querySelector('.ghost');
  u.barkEl = pl.querySelector('.bark'); u.badges = pl.querySelector('.badges');
  el.addEventListener('click', () => {
    if (side === 'ally') state.caster = u; else state.target = u;
    layout();
  });
  unitsEl.append(el, pl);
  return u;
}
function buildParty() {
  unitsEl.innerHTML = '';
  state.units = [];
  const n = settings.party, P = PARTY[n];
  P.ally.forEach((k, i) => state.units.push(mkUnit(k, 'ally', i)));
  P.enemy.forEach((k, i) => state.units.push(mkUnit(k, 'enemy', i)));
  const allies = state.units.filter((u) => u.side === 'ally');
  const enemies = state.units.filter((u) => u.side === 'enemy');
  state.caster = allies.find((u) => u.key === 'fenrir') || allies[0];
  state.target = enemies[Math.floor((enemies.length - 1) / 2)];
  state.enemyActive = null;
  // ground lines, one per row
  backdrop.querySelectorAll('.ground').forEach((g) => g.remove());
  ROWS[n].forEach((y) => { const g = document.createElement('div'); g.className = 'ground'; g.style.top = (y + 148) + 'px'; backdrop.append(g); });
  layout();
}
function layout() {
  const rows = ROWS[settings.party];
  for (const u of state.units) {
    u.by = rows[u.row];
    if (u.side === 'ally') u.bx = u === state.caster ? 330 : 270;
    else u.bx = u === state.enemyActive ? 790 : 850;
    u.el.style.left = u.bx + 'px'; u.el.style.top = u.by + 'px';
    u.pl.style.left = (u.side === 'ally' ? u.bx - 176 : u.bx + 158) + 'px';
    u.pl.style.top = (u.by + 34) + 'px';
    u.el.classList.toggle('is-caster', u === state.caster);
    u.el.classList.toggle('is-target', u === state.target);
  }
}
const allies = () => state.units.filter((u) => u.side === 'ally');
const enemies = () => state.units.filter((u) => u.side === 'enemy');
const center = (u) => ({ x: u.bx + 75 + u.ox + u.kx, y: u.by + 62 + u.oy });
const muzzle = (u) => { const d = u.side === 'ally' ? 1 : -1; const c = center(u); return { x: c.x + d * 50, y: c.y - 8 }; };
const feet = (u) => ({ x: u.bx + 75 + u.ox, y: u.by + 114 });
const dirOf = (u) => (u.side === 'ally' ? 1 : -1);

function renderBadges(u, popKey) {
  u.badges.innerHTML = Object.entries(u.statuses).filter(([, n]) => n > 0).map(([k, n]) =>
    `<span class="badge${k === popKey ? ' pop' : ''}" style="--bc:rgb(${STATUS[k].rgb.join(',')})">${STATUS[k].icon} ${n}</span>`).join('');
}
function hpColor(f) { return f > 0.5 ? '#52d273' : f > 0.2 ? '#f2c94c' : '#ff5a4f'; }

/* ------------------------------------------------------------------ particles
   Hand-rolled Canvas2D, additive blending, cached radial-gradient textures — the same family
   as the game's ParticleLayer, so nothing here needs a new library. */
const parts = [];
const MAX_PARTS = 1600;
function P(o) {
  if (!settings.particles || reduced() || instant() || parts.length >= MAX_PARTS) return;
  parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, life: 500, age: 0, size: 6, size2: null,
    rgb: [255, 255, 255], rgb2: null, a: 1, kind: 'glow', rot: 0, vr: 0, add: true, fadeIn: 0 }, o));
}
const texCache = new Map();
function tex(rgb, soft) {
  const r = rgb[0] >> 4, g = rgb[1] >> 4, b = rgb[2] >> 4;
  const key = (r << 8 | g << 4 | b) + (soft ? 's' : '');
  let c = texCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  const R = r * 17, G = g * 17, B = b * 17;
  if (soft) { gr.addColorStop(0, `rgba(${R},${G},${B},1)`); gr.addColorStop(0.5, `rgba(${R},${G},${B},.5)`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`); }
  else { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, `rgba(${R},${G},${B},1)`); gr.addColorStop(0.55, `rgba(${R},${G},${B},.35)`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`); }
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  texCache.set(key, c);
  return c;
}
function stepParts(g) {
  const s = g / 1000;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += g;
    if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vx += p.ax * s; p.vy += p.ay * s;
    if (p.drag) { const k = Math.pow(1 - p.drag, s * 60); p.vx *= k; p.vy *= k; }
    p.x += p.vx * s; p.y += p.vy * s; p.rot += p.vr * s;
  }
}
function star(c, x, y, r, n = 5) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n; const rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
function drawParts(c) {
  for (const p of parts) {
    const t = p.age / p.life;
    const sz = p.size2 == null ? p.size : lerp(p.size, p.size2, t);
    const rgb = p.rgb2 ? [lerp(p.rgb[0], p.rgb2[0], t) | 0, lerp(p.rgb[1], p.rgb2[1], t) | 0, lerp(p.rgb[2], p.rgb2[2], t) | 0] : p.rgb;
    let a = p.a * (1 - t * t);
    if (p.fadeIn && p.age < p.fadeIn) a *= p.age / p.fadeIn;
    if (a <= 0.01 || sz <= 0.2) continue;
    c.globalAlpha = a;
    c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    const col = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    switch (p.kind) {
      case 'glow': c.drawImage(tex(rgb, false), p.x - sz, p.y - sz, sz * 2, sz * 2); break;
      case 'soft': c.drawImage(tex(rgb, true), p.x - sz, p.y - sz, sz * 2, sz * 2); break;
      case 'spark': c.strokeStyle = col; c.lineWidth = sz; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke(); break;
      case 'drop': {
        const ang = Math.atan2(p.vy, p.vx), sp = Math.min(3, 1 + Math.hypot(p.vx, p.vy) / 300);
        c.save(); c.translate(p.x, p.y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, sz * sp, sz, 0, 0, Math.PI * 2); c.fill(); c.restore(); break;
      }
      case 'leaf':
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, sz, sz * 0.45, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(20,70,30,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-sz, 0); c.lineTo(sz, 0); c.stroke(); c.restore(); break;
      case 'star': c.fillStyle = col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); star(c, 0, 0, sz); c.fill(); c.restore(); break;
      case 'glint':
        c.fillStyle = col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath();
        c.moveTo(0, -sz); c.lineTo(sz * 0.18, 0); c.lineTo(0, sz); c.lineTo(-sz * 0.18, 0); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(-sz * 0.6, 0); c.lineTo(0, sz * 0.12); c.lineTo(sz * 0.6, 0); c.lineTo(0, -sz * 0.12); c.closePath(); c.fill(); c.restore(); break;
      case 'plus': c.fillStyle = col; c.fillRect(p.x - sz, p.y - sz * 0.3, sz * 2, sz * 0.6); c.fillRect(p.x - sz * 0.3, p.y - sz, sz * 0.6, sz * 2); break;
      case 'chev': {
        const d = p.vy < 0 ? -1 : 1; c.strokeStyle = col; c.lineWidth = sz * 0.45; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(p.x - sz, p.y - d * sz * 0.5); c.lineTo(p.x, p.y + d * sz * 0.5); c.lineTo(p.x + sz, p.y - d * sz * 0.5); c.stroke(); break;
      }
      case 'bubble': c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, sz, 0, Math.PI * 2); c.stroke(); break;
      case 'ring': c.strokeStyle = col; c.lineWidth = Math.max(0.5, 5 * (1 - t)); c.beginPath(); c.ellipse(p.x, p.y, sz, sz * 0.8, 0, 0, Math.PI * 2); c.stroke(); break;
      case 'plank': c.fillStyle = col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-sz, -sz * 0.3, sz * 2, sz * 0.6); c.restore(); break;
      default: break;
    }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

/* effect objects: things that are a shape over time rather than a cloud of dots */
const fxs = [];
function addFx(o) {
  if (instant() || reduced()) return;
  o.start = clock.t; o.acc = 0; o.acc2 = 0; fxs.push(o);
}
const floats = [];
function floatText(u, text, rgb, size, kind = 'num') {
  const c = center(u);
  const same = floats.filter((f) => f.u === u && clock.t - f.start < 250).length;
  floats.push({ u, x: c.x + rand(-8, 8), y: c.y - 46 - same * 26, text, rgb, size, start: clock.t, life: kind === 'tag' ? 900 : 1050, kind });
}
function drawGlowAt(c, x, y, r, rgb, a = 1) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.drawImage(tex(rgb, false), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }

/* ------------------------------------------------------------------ sound (stand-ins) */
let ac = null;
function sfx(kind, s = 0.5, el = 'None', extra = {}) {
  if (!settings.sound || instant()) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime, out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
    const noise = (dur, freq, q, gain, type = 'lowpass') => {
      const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = ac.createBufferSource(); src.buffer = b; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(out); src.start(t);
    };
    const tone = (f0, f1, dur, gain, type = 'sine') => {
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur);
    };
    if (kind === 'hit') {
      const f = { Fire: 1600, Water: 900, Nature: 2400, None: 1300 }[el];
      noise(0.12 + 0.25 * s, f, el === 'Water' ? 2 : 0.8, 0.5 + 0.5 * s, el === 'Water' ? 'bandpass' : 'lowpass');
      tone(140 + 40 * (1 - s), 42, 0.18 + 0.12 * s, 0.35 + 0.6 * s);
      if (extra.kill) tone(90, 30, 0.5, 0.7, 'triangle');
      if (extra.eff === 'super') tone(880, 1320, 0.12, 0.15, 'square');
    } else if (kind === 'whoosh') {
      noise(0.22, 700 + 900 * s, 1.2, 0.18, 'bandpass');
    } else if (kind === 'status') {
      if (extra.buff) { tone(520, 880, 0.16, 0.18, 'triangle'); } else { tone(600, 300, 0.18, 0.18, 'triangle'); }
    }
  } catch (e) { /* audio refused: silent is fine */ }
}

/* ------------------------------------------------------------------ helpers */
function dmgScale(dmg, maxHp) { return clamp(Math.sqrt((dmg / maxHp) / 0.45), 0, 1); }
function flash(u, b, rgb) {
  if (!settings.flashes || instant()) return;
  if (reduced()) { u.glow = rgb || [255, 255, 255]; play(320, (p) => { u.glowA = 1 - p; }); return; }
  u.bright = b; play(90, (p) => { u.bright = lerp(b, 1, p); });
}
function vibrate(u, amp, realMs) { u.vibAmp = amp; u.vibUntil = performance.now() + realMs; u.vibMs = realMs; }
function addTrauma(x) { if (!reduced() && !instant()) state.trauma = Math.min(1, state.trauma + x); }

function applyDamage(u, dmg) {
  let rest = dmg;
  if (u.bark > 0) { const ab = Math.min(u.bark, rest); u.bark -= ab; rest -= ab; if (ab > 0) floatText(u, `-${ab} 🛡`, STATUS.Bark.rgb, 20); }
  const before = u.hp;
  u.hp = Math.max(0, u.hp - rest);
  const from = u.shown;
  play(240, (p) => { u.shown = lerp(from, u.hp, p); }, E.outCubic);
  const gFrom = Math.max(u.ghost, before);
  u.ghostToken = (u.ghostToken || 0) + 1; const tok = u.ghostToken;
  wait(380).then(() => { if (u.ghostToken === tok) play(420, (p) => { u.ghost = lerp(gFrom, u.hp, p); }, E.inOut); });
  if (instant()) { u.shown = u.hp; u.ghost = u.hp; }
  return rest;
}
async function death(u, dir) {
  u.dead = true;
  burst('None', u, 1, 1.4, dir);
  await play(650, (p) => { u.alpha = 1 - p; u.oy = 22 * p; u.sat = 1 - p; u.bright = 1 + (Math.random() < 0.35 ? 1.6 : 0) * (1 - p); });
  await wait(900);
  // revived so the lab can keep going
  u.hp = u.maxHp; u.shown = u.maxHp; u.ghost = u.maxHp; u.statuses = {}; u.bark = 0; renderBadges(u);
  u.oy = 0; u.sat = 1; u.bright = 1; u.dead = false;
  await play(300, (p) => { u.alpha = p; });
}

/* ------------------------------------------------------------------ impact bursts */
function burst(el, u, s, mul, dir) {
  const c = center(u); const n = Math.round((12 + 26 * s) * mul);
  const away = dir > 0 ? 0 : Math.PI;
  const E2 = ELEM[el];
  if (el === 'Fire') {
    for (let i = 0; i < n; i++) { const a = away + rand(-1.4, 1.4); const sp = rand(120, 420) * (0.7 + 0.6 * s);
      P({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.07, ay: -140, life: rand(280, 620), size: rand(6, 11), size2: 2, rgb: E2.hot, rgb2: E2.rgb }); }
    for (let i = 0; i < 3 + 4 * s; i++) P({ x: c.x + rand(-20, 20), y: c.y + rand(-10, 10), vx: rand(-30, 30) + dir * 30, vy: rand(-60, -20), life: rand(600, 900), size: 16, size2: 46, rgb: [50, 40, 42], kind: 'soft', add: false, a: 0.5 });
    P({ x: c.x, y: c.y, kind: 'ring', size: 12, size2: 60 + 50 * s, life: 260, rgb: [255, 180, 110] });
  } else if (el === 'Water') {
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rand(-1.2, 1.2) + dir * 0.35; const sp = rand(150, 430) * (0.7 + 0.5 * s);
      P({ x: c.x - dir * 10, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 950, life: rand(450, 750), size: rand(2.5, 4.5), rgb: [190, 230, 255], kind: 'drop', add: false, a: 0.95 }); }
    for (let i = 0; i < 5 + 5 * s; i++) P({ x: c.x + rand(-25, 25), y: c.y + rand(-15, 15), vx: rand(-40, 40), vy: rand(-40, 10), life: rand(500, 800), size: 14, size2: 40, rgb: [160, 210, 255], kind: 'soft', a: 0.35 });
    P({ x: c.x, y: c.y + 10, kind: 'ring', size: 14, size2: 70 + 50 * s, life: 320, rgb: [170, 225, 255] });
  } else if (el === 'Nature') {
    const greens = [[78, 190, 90], [120, 210, 90], [52, 150, 70], [170, 220, 100]];
    for (let i = 0; i < n * 0.7; i++) { const a = away + rand(-1.6, 1.6); const sp = rand(100, 330) * (0.7 + 0.6 * s);
      P({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, drag: 0.05, ay: 160, vr: rand(-9, 9), rot: rand(0, 6), life: rand(650, 1050), size: rand(5, 9), rgb: greens[i % 4], kind: 'leaf', add: false }); }
    for (let i = 0; i < n * 0.5; i++) { const a = rand(0, Math.PI * 2); const sp = rand(80, 260);
      P({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.08, life: rand(250, 500), size: rand(4, 7), size2: 1, rgb: [200, 255, 170], rgb2: [67, 180, 95] }); }
    P({ x: c.x, y: c.y, kind: 'ring', size: 12, size2: 60 + 40 * s, life: 260, rgb: [150, 230, 140] });
  } else {
    for (let i = 0; i < n; i++) { const a = away + rand(-1.5, 1.5); const sp = rand(250, 620);
      P({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.08, life: rand(180, 340), size: rand(2, 3.5), kind: 'spark', rgb: [255, 255, 255] }); }
    P({ x: c.x, y: c.y, kind: 'ring', size: 10, size2: 60 + 40 * s, life: 240, rgb: [255, 255, 255] });
  }
}
function superRing(u) {
  const c = center(u);
  P({ x: c.x, y: c.y, kind: 'ring', size: 20, size2: 130, life: 380, rgb: [255, 255, 255] });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P({ x: c.x, y: c.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, drag: 0.1, life: 380, size: 7, kind: 'star', rgb: [255, 240, 170], vr: 6 }); }
}
function fizzle(u) {
  const c = center(u);
  for (let i = 0; i < 6; i++) P({ x: c.x + rand(-15, 15), y: c.y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-50, -20), life: rand(500, 800), size: 10, size2: 30, rgb: [120, 125, 135], kind: 'soft', add: false, a: 0.55 });
}

/* ------------------------------------------------------------------ attack shapes */
function bez2(a, b, c, u) { const m = 1 - u; return { x: m * m * a.x + 2 * m * u * b.x + u * u * c.x, y: m * m * a.y + 2 * m * u * b.y + u * u * c.y }; }
function bez3(a, b, c, d, u) { const m = 1 - u; return { x: m * m * m * a.x + 3 * m * m * u * b.x + 3 * m * u * u * c.x + u * u * u * d.x, y: m * m * m * a.y + 3 * m * m * u * b.y + 3 * m * u * u * c.y + u * u * u * d.y }; }

function fxFlame(cs, tg, head, sus, s, pm) {
  const o = muzzle(cs), t = center(tg); const dx = t.x - o.x, dy = t.y - o.y; const dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const v = dist / head * 1000; const F = ELEM.Fire;
  addFx({ dur: head + sus + 170,
    tick(age, g) {
      if (age < head + sus) {
        this.acc += g * (0.16 + 0.26 * s) * pm;
        while (this.acc >= 1) { this.acc--; const a = ang + rand(-1, 1) * (0.04 + 0.07 * s); const sp = v * rand(0.92, 1.08);
          P({ x: o.x, y: o.y + rand(-3, 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -rand(60, 260), life: dist / sp * 1000 * rand(0.96, 1.03), size: rand(5, 8) + 4 * s, size2: rand(12, 18) + 14 * s, rgb: [255, 200, 110], rgb2: [200, 40, 20], a: 0.55 }); }
      }
      if (age > head && age < head + sus) {
        this.acc2 += g * 0.12 * pm;
        while (this.acc2 >= 1) { this.acc2--; const a = ang + Math.PI + rand(-1.2, 1.2);
          P({ x: t.x, y: t.y, vx: Math.cos(a) * rand(80, 220), vy: Math.sin(a) * rand(80, 220) - 60, drag: 0.06, life: rand(250, 450), size: 5, size2: 1, rgb: F.hot, rgb2: F.rgb }); }
        vibrate(tg, 1 + 2 * s, 40);
      }
    },
    draw(c, age) {
      const hp = Math.min(1, age / head), tail = age > head + sus ? Math.min(1, (age - head - sus) / 170) : 0;
      const x1 = o.x + dx * tail, y1 = o.y + dy * tail, x2 = o.x + dx * hp, y2 = o.y + dy * hp;
      const fl = 0.85 + 0.1 * Math.sin(age * 0.09) + 0.05 * Math.sin(age * 0.23);
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      const line = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
      line((18 + 22 * s) * fl, 'rgba(230,70,25,0.20)');
      line((7 + 9 * s) * fl, 'rgba(255,150,60,0.42)');
      line(2 + 3 * s, 'rgba(255,240,200,0.8)');
      c.globalCompositeOperation = 'source-over';
      if (tail < 1) drawGlowAt(c, o.x, o.y, (22 + 22 * s) * fl, F.rgb, 0.9 * (1 - tail));
    } });
  return [{ target: tg, at: head + sus }];
}

function fxJet(cs, tg, head, sus, s, pm) {
  const o = muzzle(cs), t = center(tg); const ctrl = { x: (o.x + t.x) / 2, y: Math.min(o.y, t.y) - (34 + 30 * s) };
  const d = dirOf(cs);
  addFx({ dur: head + sus + 140,
    pt(u, age) { const p = bez2(o, ctrl, t, u); const n = bez2(o, ctrl, t, Math.min(1, u + 0.01)); const nx = -(n.y - p.y), ny = n.x - p.x; const l = Math.hypot(nx, ny) || 1;
      const w = Math.sin(u * 20 - age * 0.05) * (2 + 3 * s) * (1 - u * 0.4); return { x: p.x + nx / l * w, y: p.y + ny / l * w }; },
    tick(age, g) {
      const hu = E.outQuad(Math.min(1, age / head));
      if (age < head + sus) {
        this.acc += g * (0.25 + 0.35 * s) * pm; const hp = bez2(o, ctrl, t, hu);
        while (this.acc >= 1) { this.acc--;
          P({ x: hp.x, y: hp.y, vx: d * rand(40, 160), vy: rand(-220, -40), ay: 950, life: rand(350, 600), size: rand(2, 4), rgb: [195, 232, 255], kind: 'drop', add: false }); }
      }
      if (age > head && age < head + sus) {
        this.acc2 += g * 0.2 * pm;
        while (this.acc2 >= 1) { this.acc2--;
          P({ x: t.x - d * 20, y: t.y, vx: -d * rand(60, 220), vy: rand(-260, -60), ay: 900, life: rand(400, 650), size: rand(2.5, 4), rgb: [205, 238, 255], kind: 'drop', add: false });
          if (Math.random() < 0.3) P({ x: t.x, y: t.y, vx: rand(-40, 40), vy: rand(-30, 10), life: 600, size: 12, size2: 36, rgb: [170, 215, 255], kind: 'soft', a: 0.3 }); }
        vibrate(tg, 1 + 2 * s, 40);
      }
    },
    draw(c, age) {
      const hu = E.outQuad(Math.min(1, age / head)); const tu = age > head + sus ? E.inQuad(Math.min(1, (age - head - sus) / 140)) : 0;
      if (tu >= hu) return;
      const N = 30, pts = [];
      for (let i = 0; i <= N; i++) pts.push(this.pt(lerp(tu, hu, i / N), age));
      const stroke = (w, col, add) => { c.globalCompositeOperation = add ? 'lighter' : 'source-over'; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); };
      stroke(12 + 12 * s, 'rgba(40,120,210,0.55)');
      stroke(6 + 6 * s, 'rgba(110,190,255,0.85)');
      stroke(2 + 2.5 * s, 'rgba(235,250,255,0.95)', true);
      c.globalCompositeOperation = 'source-over';
      const h = pts[pts.length - 1]; drawGlowAt(c, h.x, h.y, 14 + 10 * s, [150, 210, 255], 0.8);
    } });
  return [{ target: tg, at: head + sus }];
}

function fxVine(cs, tg, head, sus, s, pm) {
  const d = dirOf(cs); const f = feet(cs); const t = center(tg);
  const P0 = { x: f.x + d * 30, y: f.y }, P1 = { x: lerp(f.x, t.x, 0.35), y: f.y + 34 }, P2 = { x: t.x - d * 95, y: t.y + 95 }, P3 = { x: t.x - d * 18, y: t.y + 6 };
  const retract = 190, w0 = 10 + 5 * s;
  addFx({ dur: head + sus + retract,
    tick(age, g) {
      if (age < head && Math.random() < g * 0.05 * pm) { const p = bez3(P0, P1, P2, P3, E.outCubic(age / head));
        P({ x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-90, -30), ay: 140, vr: rand(-8, 8), life: rand(500, 800), size: rand(4, 6), rgb: [90, 200, 100], kind: 'leaf', add: false }); }
      if (age > head && age < head + sus) vibrate(tg, 1 + 1.5 * s, 40);
    },
    draw(c, age) {
      let hu = E.outCubic(Math.min(1, age / head));
      if (age > head + sus) hu = 1 - E.inQuad(Math.min(1, (age - head - sus) / retract));
      if (hu <= 0.001) return;
      const N = 36, pts = [];
      for (let i = 0; i <= N; i++) pts.push(bez3(P0, P1, P2, P3, hu * i / N));
      c.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const k = i / N; const w = lerp(w0, 3, k);
        c.strokeStyle = '#1d5a2b'; c.lineWidth = w; c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke();
        c.strokeStyle = '#6fd47e'; c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y - w * 0.22); c.lineTo(pts[i].x, pts[i].y - w * 0.22); c.stroke();
        if (i % 5 === 0) { const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) + (i % 10 ? 1 : -1) * 0.9;
          c.save(); c.translate(pts[i].x, pts[i].y); c.rotate(a); c.fillStyle = '#3fae55'; c.beginPath(); c.ellipse(7, 0, 7, 3, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      }
      // the wrap: once the tip arrives it coils round the target
      if (age > head && age < head + sus + retract * 0.6) {
        const k = Math.min(1, (age - head) / Math.max(60, sus * 0.7)); const fade = age > head + sus ? 1 - (age - head - sus) / (retract * 0.6) : 1;
        const sq = age > head + sus * 0.8 ? 0.85 : 1;
        c.globalAlpha = Math.max(0, fade); c.lineWidth = 6 + 2 * s; c.strokeStyle = '#2c7a3a';
        c.beginPath(); c.ellipse(t.x, t.y + 12, 54 * sq, 20 * sq, -0.15 * d, Math.PI * 0.9, Math.PI * 0.9 + Math.PI * 2 * 0.9 * k); c.stroke();
        c.lineWidth = 2; c.strokeStyle = '#7ee08b'; c.stroke(); c.globalAlpha = 1;
      }
    } });
  return [{ target: tg, at: head + sus }];
}

function fxFireWall(cs, tgs, head, sus, s, pm) {
  const d = dirOf(cs); const cx = tgs.map((u) => center(u).x), cy = tgs.map((u) => center(u).y);
  const near = d > 0 ? Math.min(...cx) : Math.max(...cx), far = d > 0 ? Math.max(...cx) : Math.min(...cx);
  const x0 = near - d * 150, x1 = far + d * 40; const yTop = Math.min(...cy) - 80, yBot = Math.max(...cy) + 70;
  const total = head + sus; const wx = (age) => (age < head ? x0 : lerp(x0, x1, E.inOut(Math.min(1, (age - head) / Math.max(1, sus)))));
  const F = ELEM.Fire;
  addFx({ dur: total + 260,
    tick(age, g) {
      const inten = age < head ? 0.3 + 0.7 * age / head : age < total ? 1 : Math.max(0, 1 - (age - total) / 260);
      this.acc += g * (0.2 + 0.28 * s) * pm * inten; const x = wx(Math.min(age, total));
      while (this.acc >= 1) { this.acc--;
        P({ x: x + rand(-20, 20), y: rand(yTop, yBot), vx: d * rand(20, 90), vy: -rand(220, 420), drag: 0.03, life: rand(280, 520), size: rand(7, 10) + 4 * s, size2: rand(16, 26), rgb: [255, 190, 100], rgb2: [190, 35, 20], a: 0.55 }); }
    },
    draw(c, age) {
      const inten = age < head ? age / head : age < total ? 1 : Math.max(0, 1 - (age - total) / 260); const x = wx(Math.min(age, total));
      const gr = c.createLinearGradient(x - 50, 0, x + 50, 0); gr.addColorStop(0, 'rgba(255,100,40,0)'); gr.addColorStop(0.5, `rgba(255,140,60,${0.28 * inten})`); gr.addColorStop(1, 'rgba(255,100,40,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.fillRect(x - 50, yTop - 30, 100, yBot - yTop + 60); c.globalCompositeOperation = 'source-over';
    } });
  return tgs.map((u) => ({ target: u, at: Math.min(total, head + sus * clamp(invInOut((center(u).x - x0) / (x1 - x0)), 0, 1)) }));
}
function invInOut(q) { q = clamp(q, 0, 1); let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (E.inOut(m) < q) lo = m; else hi = m; } return (lo + hi) / 2; }

function fxWave(cs, tgs, head, sus, s, pm) {
  const d = dirOf(cs); const cc = center(cs); const cx = tgs.map((u) => center(u).x), cy = tgs.map((u) => center(u).y);
  const far = d > 0 ? Math.max(...cx) : Math.min(...cx);
  const x0 = cc.x + d * 90, x1 = far + d * 130; const yTop = Math.max(10, Math.min(...cy) - 95), yBot = Math.min(H - 6, Math.max(...cy) + 85);
  const total = head + sus; const crest = (age) => lerp(x0, x1, E.inOut(Math.min(1, age / total)));
  addFx({ dur: total + 240,
    edge(age) { const x = crest(Math.min(age, total)); const pts = [];
      for (let y = yTop; y <= yBot; y += 10) { const curl = 34 * Math.max(0, 1 - (y - yTop) / 90); pts.push({ x: x + d * (Math.sin(y * 0.025 + age * 0.012) * 10 + curl), y }); } return pts; },
    tick(age, g) {
      if (age > total) return; this.acc += g * (0.12 + 0.16 * s) * pm; const pts = this.edge(age);
      while (this.acc >= 1) { this.acc--; const p = pts[(Math.random() * pts.length) | 0];
        P({ x: p.x, y: p.y, vx: d * rand(120, 280), vy: rand(-180, 40), ay: 700, life: rand(300, 550), size: rand(2, 3.5), rgb: [215, 240, 255], kind: 'drop', add: false, a: 0.75 }); }
    },
    draw(c, age) {
      const a = age < total ? Math.min(1, age / 120) : Math.max(0, 1 - (age - total) / 240); if (a <= 0) return;
      const pts = this.edge(age); const back = crest(Math.min(age, total)) - d * 260;
      const gr = c.createLinearGradient(back, 0, crest(Math.min(age, total)), 0);
      gr.addColorStop(0, 'rgba(40,110,200,0)'); gr.addColorStop(0.75, `rgba(55,140,220,${0.42 * a})`); gr.addColorStop(1, `rgba(150,215,255,${0.7 * a})`);
      c.fillStyle = gr; c.beginPath(); c.moveTo(back, yTop + 40); pts.forEach((p) => c.lineTo(p.x, p.y)); c.lineTo(back, yBot); c.closePath(); c.fill();
      c.strokeStyle = `rgba(240,250,255,${0.85 * a})`; c.lineWidth = 4; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
    } });
  return tgs.map((u) => ({ target: u, at: Math.min(total, total * invInOut((center(u).x - d * 30 - x0) / (x1 - x0))) }));
}

function fxPollen(cs, tgs, head, sus, s, pm) {
  const o = muzzle(cs);
  const arcs = tgs.map((u) => { const t = center(u); return { t, ctrl: { x: (o.x + t.x) / 2, y: Math.min(o.y, t.y) - 90 } }; });
  addFx({ dur: head + sus + 700,
    tick(age, g) {
      if (age < head) {
        this.acc += g * 0.25 * pm;
        while (this.acc >= 1) { this.acc--; for (const a of arcs) { const p = bez2(o, a.ctrl, a.t, E.outQuad(age / head));
          P({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: rand(300, 500), size: 8, size2: 18, rgb: [225, 225, 110], kind: 'soft', a: 0.55 }); } }
      } else if (age < head + sus + 200) {
        this.acc2 += g * (0.12 + 0.12 * s) * pm;
        while (this.acc2 >= 1) { this.acc2--; for (const a of arcs) {
          P({ x: a.t.x + rand(-45, 45), y: a.t.y + rand(-35, 35), vx: rand(-25, 25), vy: rand(-18, 6), life: rand(700, 1100), size: rand(16, 24), size2: rand(44, 70), rgb: [205, 210, 95], kind: 'soft', add: false, a: 0.24, fadeIn: 150 });
          if (Math.random() < 0.35) P({ x: a.t.x + rand(-50, 50), y: a.t.y + rand(-40, 30), vy: rand(-20, -5), life: 600, size: rand(3, 6), kind: 'glint', rgb: [255, 245, 170], rot: rand(0, 1), fadeIn: 120 }); } }
      }
    },
    draw(c, age) { if (age >= head) return; for (const a of arcs) { const p = bez2(o, a.ctrl, a.t, E.outQuad(age / head)); drawGlowAt(c, p.x, p.y, 16, [230, 230, 120], 0.9); } } });
  return tgs.map((u, i) => ({ target: u, at: head + sus + i * 60 }));
}

function chargeFx(cs, ms, el) {
  const o = muzzle(cs); const E2 = ELEM[el];
  addFx({ dur: ms, tick(age, g) { this.acc += g * 0.35;
    while (this.acc >= 1) { this.acc--; const a = rand(0, Math.PI * 2), r = rand(60, 90), life = rand(180, 260);
      P({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, vx: -Math.cos(a) * r / life * 1000, vy: -Math.sin(a) * r / life * 1000, life, size: 3, size2: 7, rgb: E2.hot, rgb2: E2.rgb }); } },
    draw(c, age) { drawGlowAt(c, o.x, o.y, 10 + 26 * (age / ms), E2.rgb, 0.8); } });
}

/* ------------------------------------------------------------------ status tells */
function statusLand(u, st, stacks = 2, quiet = false) {
  const S = STATUS[st]; const c = center(u); const f = feet(u);
  if (st === 'Bark') u.bark += 20; else u.statuses[st] = (u.statuses[st] || 0) + stacks;
  renderBadges(u, st);
  if (!quiet) floatText(u, st === 'Bark' ? '+20 Bark' : `+${stacks} ${S.label}`, S.rgb, 20, 'tag');
  sfx('status', 0, 'None', { buff: S.buff });
  if (instant()) return;
  u.glow = S.rgb; play(450, (p) => { u.glowA = 1 - p; });
  if (reduced()) return;
  switch (st) {
    case 'Burn':
      for (let i = 0; i < 24; i++) P({ x: c.x + rand(-45, 45), y: f.y - rand(0, 40), vx: rand(-15, 15), vy: -rand(140, 320), drag: 0.03, life: rand(380, 680), size: rand(7, 11), size2: 2, rgb: [255, 230, 150], rgb2: S.rgb, fadeIn: rand(0, 200) });
      break;
    case 'Poison':
      for (let i = 0; i < 14; i++) P({ x: c.x + rand(-40, 40), y: c.y + rand(-5, 40), vy: -rand(40, 90), vx: rand(-10, 10), life: rand(700, 1050), size: rand(3, 8), rgb: S.rgb, kind: 'bubble', add: false, fadeIn: rand(0, 300) });
      for (let i = 0; i < 6; i++) P({ x: c.x + rand(-35, 35), y: c.y + rand(-10, 20), vy: 20, ay: 420, life: rand(500, 800), size: 3, rgb: [150, 230, 110], kind: 'drop', add: false, fadeIn: rand(0, 300) });
      play(500, (p) => { u.sat = 1 - 0.5 * Math.sin(Math.PI * p); });
      break;
    case 'Dazed': {
      const top = { x: c.x, y: u.by - 4 };
      addFx({ dur: 1200, draw(cx, age) { const a = Math.min(1, age / 150) * Math.min(1, (1200 - age) / 250);
        for (let i = 0; i < 3; i++) { const th = age * 0.008 + i * Math.PI * 2 / 3; const x = top.x + Math.cos(th) * 40, y = top.y + Math.sin(th) * 11;
          cx.globalAlpha = a * (Math.sin(th) > 0 ? 1 : 0.55); cx.fillStyle = 'rgb(255,220,90)'; star(cx, x, y, 8); cx.fill(); } cx.globalAlpha = 1; } });
      play(800, (p) => { u.rot = 7 * Math.sin(p * Math.PI * 4) * (1 - p); });
      break;
    }
    case 'Weakened':
      for (let i = 0; i < 6; i++) P({ x: c.x + rand(-40, 40), y: u.by - rand(0, 30), vy: rand(50, 80), life: rand(650, 900), size: rand(7, 10), rgb: S.rgb, kind: 'chev', add: false, fadeIn: i * 60 });
      play(600, (p) => { const k = Math.sin(Math.PI * p); u.sy = 1 - 0.08 * k; u.sx = 1 + 0.03 * k; u.sat = 1 - 0.7 * k; });
      break;
    case 'Strength':
      for (let i = 0; i < 7; i++) P({ x: c.x + rand(-45, 45), y: f.y - rand(0, 30), vy: -rand(110, 160), life: rand(600, 850), size: rand(7, 10), rgb: S.rgb, kind: 'chev', add: false, fadeIn: i * 50 });
      for (let i = 0; i < 12; i++) P({ x: c.x + rand(-40, 40), y: f.y - rand(0, 20), vy: -rand(80, 200), life: rand(400, 700), size: 4, size2: 1, rgb: [255, 200, 150], rgb2: S.rgb });
      play(380, (p) => { const k = Math.sin(Math.PI * p); u.sx = 1 + 0.1 * k; u.sy = 1 + 0.1 * k; });
      break;
    case 'Sharp':
      for (let i = 0; i < 5; i++) P({ x: c.x + rand(-45, 45), y: c.y + rand(-40, 30), life: rand(380, 520), size: rand(9, 15), rgb: S.rgb, kind: 'glint', rot: rand(-0.3, 0.3), fadeIn: 60 + i * 70 });
      addFx({ dur: 220, draw(cx, age) { const p = age / 220; const x0 = c.x - 55, y0 = c.y - 45; cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = `rgba(240,248,255,${1 - p})`; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(lerp(x0, c.x + 55, E.outCubic(Math.min(1, p * 2))), lerp(y0, c.y + 45, E.outCubic(Math.min(1, p * 2)))); cx.stroke(); cx.globalCompositeOperation = 'source-over'; } });
      break;
    case 'Regen':
      for (let i = 0; i < 9; i++) P({ x: c.x + rand(-45, 45), y: f.y - rand(0, 40), vy: -rand(50, 90), life: rand(800, 1100), size: rand(4, 6), rgb: S.rgb, kind: 'plus', fadeIn: rand(0, 300) });
      for (let i = 0; i < 14; i++) P({ x: c.x + rand(-50, 50), y: f.y - rand(0, 60), vy: -rand(30, 70), vx: rand(-10, 10), life: rand(800, 1200), size: 5, size2: 2, rgb: [190, 255, 200], rgb2: S.rgb, fadeIn: rand(0, 300) });
      break;
    case 'Bark': {
      const N = 9;
      addFx({ dur: 820, draw(cx, age) {
        const k = E.outCubic(Math.min(1, age / 320)); const fade = age > 560 ? 1 - (age - 560) / 260 : 1;
        cx.globalAlpha = Math.max(0, fade);
        for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2 + (1 - k) * 1.4; const r = lerp(150, 60, k);
          const x = c.x + Math.cos(th) * r, y = c.y + 6 + Math.sin(th) * r * 0.55;
          cx.save(); cx.translate(x, y); cx.rotate(th + Math.PI / 2); cx.fillStyle = i % 2 ? '#8a5a2c' : '#a87440'; cx.fillRect(-13, -5, 26, 10);
          cx.strokeStyle = 'rgba(40,24,10,.6)'; cx.lineWidth = 1; cx.strokeRect(-13, -5, 26, 10); cx.restore(); }
        cx.globalAlpha = 1; } });
      break;
    }
    default: break;
  }
}

function orbFx(from, to, ms, rgb, selfCast) {
  const ctrl = selfCast ? { x: from.x, y: from.y - 160 } : { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 110 };
  addFx({ dur: ms,
    tick(age, g) { this.acc += g * 0.2; const p = selfCast ? { x: from.x, y: from.y - 90 * Math.sin(Math.PI * age / ms) } : bez2(from, ctrl, to, E.inOut(age / ms));
      while (this.acc >= 1) { this.acc--; P({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 300, size: 6, size2: 1, rgb }); } },
    draw(c, age) { const p = selfCast ? { x: from.x, y: from.y - 90 * Math.sin(Math.PI * age / ms) } : bez2(from, ctrl, to, E.inOut(age / ms)); drawGlowAt(c, p.x, p.y, 16, rgb, 1); } });
}

/* ------------------------------------------------------------------ the card in the lane */
const lcard = $('#lcard');
const LANE = { x: 566, y: 118, rot: -4 };
const card = { x: 0, y: 0, rot: 0, sc: 1, a: 0, on: false };
function cardFace(m, dmg, who) {
  const elc = `var(--${m.el.toLowerCase()})`;
  lcard.style.setProperty('--elc', elc);
  let text;
  if (m.kind === 'status') { const S = STATUS[m.status]; text = m.status === 'Bark' ? 'Gain <b>20</b> Bark Shield.' : `${S.buff ? 'Give' : 'Apply'} <b>2</b> ${S.label}.`; }
  else if (m.kind === 'side') text = `Deal <b>${dmg}</b> damage to all enemies${m.rider ? ' and apply 2 ' + m.rider : ''}.`;
  else text = `Deal <b>${dmg}</b> damage${settings.rider ? ', then apply 2 ' + settings.rider : ''}.`;
  lcard.innerHTML = `<div class="top"><span class="cost">${m.cost}</span><span class="name">${m.name}</span></div><div class="art">${ELEM[m.el].icon}</div><div class="txt">${text}</div><div class="who">${who}</div>${m.kind !== 'status' ? `<div class="foot">${dmg}</div>` : ''}`;
}
function cardIn(m, dmg, enemy, ms, who) {
  cardFace(m, dmg, who);
  const from = enemy ? { x: 1180, y: -220, rot: 14 } : { x: 566, y: 600, rot: 0 };
  Object.assign(card, from, { sc: 0.6, a: 0, on: true });
  if (instant()) { card.on = false; return Promise.resolve(); }
  if (reduced()) { Object.assign(card, LANE, { sc: 1 }); return play(ms, (p) => { card.a = p; }); }
  return play(ms, (p) => { card.x = lerp(from.x, LANE.x, p); card.y = lerp(from.y, LANE.y, p); card.rot = lerp(from.rot, LANE.rot, p); card.sc = lerp(0.6, 1, p); card.a = Math.min(1, p * 3); }, E.outCubic);
}
function cardOut(enemy, ms) {
  if (!card.on) return Promise.resolve();
  const to = enemy ? { x: 1240, y: 40, rot: 20 } : { x: 1160, y: 520, rot: 18 };
  const f = { x: card.x, y: card.y, rot: card.rot, sc: card.sc };
  if (reduced()) return play(ms, (p) => { card.a = 1 - p; }).then(() => { card.on = false; });
  return play(ms, (p) => { card.x = lerp(f.x, to.x, p); card.y = lerp(f.y, to.y, p); card.rot = lerp(f.rot, to.rot, p); card.sc = lerp(f.sc, 0.35, p); card.a = 1 - p * p; }, E.inQuad)
    .then(() => { card.on = false; });
}

/* ------------------------------------------------------------------ timeline */
const tlBar = $('#tlBar'), tlMarks = $('#tlMarks'), playhead = $('#playhead');
const tl = { total: 0, elapsed: 0, live: false };
const SEGC = { read: '#7f8ca6', windup: '#f4c64f', lunge: '#ffb067', travel: '#7cc4ff', impact: '#ffffff', react: '#ff8e7a', back: '#b5a6ff', status: '#9be7a8', card: '#5d6f96', hold: '#5d6f96', flight: '#ffb067', trail: '#7cc4ff' };
function showTimeline(plan) {
  tlBar.querySelectorAll('.tl-seg').forEach((n) => n.remove());
  tlMarks.innerHTML = '';
  const total = plan.segs.reduce((a, s) => a + s.ms, 0);
  for (const s of plan.segs) {
    const d = document.createElement('div'); d.className = 'tl-seg';
    d.style.flex = `${Math.max(s.ms, 1)} 1 0`; d.style.background = SEGC[s.k] || '#999';
    d.innerHTML = `<span>${s.label}</span><span>${Math.round(s.ms)} ms</span>`; d.title = `${s.label}: ${Math.round(s.ms)} ms`;
    tlBar.insertBefore(d, playhead);
  }
  for (const m of plan.marks) {
    const d = document.createElement('div'); const pct = m.at / total * 100;
    d.className = 'tl-mark' + (pct > 60 ? ' right' : ''); d.style.left = pct + '%'; d.style.borderColor = m.c; d.style.color = m.c; d.textContent = m.label;
    tlMarks.appendChild(d);
  }
  tl.total = total; tl.elapsed = 0; tl.live = true;
  const tierLab = settings.today ? 'Today' : TIERS[settings.tier].label;
  const real = instant() ? 0 : total / TIERS[settings.tier].speed;
  const note = TIERS[settings.tier].speed !== 1 && !settings.today ? ` <span style="color:var(--muted);font-size:14px">(bars show 1×, played at ${TIERS[settings.tier].speed}×)</span>` : '';
  $('#tlTot').innerHTML = `<em>${(real / 1000).toFixed(2)} s</em> at ${tierLab}${note}${settings.slowmo ? ' · slow-mo on' : ''}`;
  $('#tlTitle').textContent = `${plan.title} · timeline`;
}
function compareLine() {
  if (settings.today) { $('#tlCompare').innerHTML = '<span>Today: every card holds 1.5 s (yours) or 1.2 s + think time (enemy), whatever its size.</span>'; return; }
  const cols = [['Chip 6', 6], ['Solid 22', 22], ['Heavy 45', 45]];
  const row = (k) => {
    const T = TIERS[k];
    const cells = cols.map(([, dmg]) => {
      if (k === 'instant') return '0 s';
      const saved = settings.tier; settings.tier = k;
      const pl = planFor({ move: MOVES[0], dmg, enemy: false, targets: [{ maxHp: 100, hp: 100 }], rider: '' });
      settings.tier = saved;
      return (pl.segs.reduce((a, x) => a + x.ms, 0) / T.speed / 1000).toFixed(2) + ' s';
    });
    return `<tr${k === settings.tier ? ' class="on"' : ''}><td>${T.label}</td>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  };
  $('#tlCompare').innerHTML = `<div class="tiers"><table><thead><tr><th>Flame Column</th>${cols.map(([l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${Object.keys(TIERS).map(row).join('')}</tbody></table></div>`;
}
function planFor(c) {
  const m = c.move; const t0 = c.targets[0]; const s = dmgScale(c.dmg, t0.maxHp);
  const segs = [], marks = [];
  if (pkey() === 'current') {
    const n = c.targets.length;
    const trailEnd = CUR.flight + CUR.trail + CUR.stagger * (n - 1);
    const statusN = (m.kind === 'status' ? 1 : 0) + (c.rider ? 1 : 0);
    if (c.enemy) segs.push({ k: 'read', label: 'Pause (no card yet)', ms: CUR.enemyPause });
    segs.push({ k: 'flight', label: 'Card flight + 16px lunge', ms: CUR.flight });
    segs.push({ k: 'trail', label: 'Trail', ms: trailEnd - CUR.flight });
    if (statusN) segs.push({ k: 'status', label: 'Status tells', ms: CUR.statusGap * statusN });
    const used = trailEnd + CUR.statusGap * statusN;
    segs.push({ k: 'hold', label: 'Card holds', ms: Math.max(150, (c.enemy ? CUR.enemyPause : CUR.playerHold) - used) });
    const base = c.enemy ? CUR.enemyPause : 0;
    if (m.kind !== 'status') marks.push({ at: base, label: 'Number · HP · sound · hit-stop · shake', c: '#ff7262' });
    marks.push({ at: base + CUR.flight + CUR.trail, label: 'Trail lands', c: '#7cc4ff' });
    return { title: 'Today', segs, marks };
  }
  const Pp = PRESETS[pkey()]; const red = reduced();
  if (c.enemy) segs.push({ k: 'read', label: 'Card hovers (read it)', ms: Pp.read });
  if (m.kind === 'status') {
    segs.push({ k: 'windup', label: 'Wiggle', ms: red ? 0 : Pp.wiggle });
    segs.push({ k: 'travel', label: 'Status orb', ms: red ? 120 : Pp.orb });
    segs.push({ k: 'status', label: 'Status lands', ms: Pp.statusLand });
    segs.push({ k: 'card', label: 'Card out', ms: Pp.cardOut });
    marks.push({ at: segs.slice(0, -2).reduce((a, x) => a + x.ms, 0), label: 'Status applied', c: '#9be7a8' });
    return { title: m.name, segs, marks };
  }
  const head = red ? 120 : Pp.head(s), sus = red ? 0 : Pp.sustain(s);
  const kill = c.targets.some((u) => c.dmg >= u.hp);
  let hs = kill ? Pp.kill : Pp.hitstop(s); if (c.eff === 'super') hs += 20; if (c.eff === 'resisted') hs *= 0.6; if (m.kind === 'side') hs *= 0.6 * c.targets.length;
  if (!settings.hitstop || red) hs = 0;
  segs.push({ k: 'windup', label: 'Wind-up', ms: red ? 0 : Pp.windup(s) });
  if (m.kind === 'contact') segs.push({ k: 'lunge', label: 'Dash in', ms: red ? 0 : Pp.lunge * 1.6 });
  else {
    segs.push({ k: 'lunge', label: 'Lunge', ms: red ? 0 : Pp.lunge });
    segs.push({ k: 'travel', label: m.kind === 'side' ? 'Sweep' : sus > 60 ? 'Projectile + pour' : 'Projectile', ms: head + sus });
  }
  const hitAt = segs.reduce((a, x) => a + x.ms, 0);
  segs.push({ k: 'impact', label: 'Hit-stop', ms: hs });
  segs.push({ k: 'react', label: 'Knockback', ms: Pp.react });
  const rider = c.rider || m.rider;
  segs.push({ k: rider ? 'status' : 'back', label: rider ? 'Return + status' : 'Return + card out', ms: Math.max(Pp.back, rider ? Pp.statusLand : 0) });
  marks.push({ at: hitAt, label: 'Number · HP · sound · hit-stop · shake', c: '#ffffff' });
  return { title: m.name, segs, marks };
}

/* ------------------------------------------------------------------ casting */
async function castCurrent(c) {
  const m = c.move, cs = c.caster, d = dirOf(cs);
  const who = (c.enemy ? 'Enemy ' : '') + cs.name;
  if (c.enemy) await wait(CUR.enemyPause);
  cardIn(m, c.dmg, c.enemy, CUR.flight, who);
  const lungeT = play(240, (p) => { cs.ox = reduced() ? 0 : d * 16 * (p < 0.35 ? E.outQuad(p / 0.35) : 1 - E.outQuad((p - 0.35) / 0.65)); });
  // Today: the hit "happens" here, at t = 0, before anything has travelled.
  if (m.kind !== 'status') {
    for (const t of c.targets) {
      const kill = t.hp > 0 && c.dmg >= t.hp;
      applyDamage(t, c.dmg); floatText(t, `-${c.dmg}`, ELEM[m.el].num, 24);
      sfx('hit', dmgScale(c.dmg, t.maxHp), m.el, { kill });
      const frac = clamp((c.dmg / t.maxHp - 0.05) / 0.3, 0, 1);
      const hs = kill ? CUR.hsMax : CUR.hsMin + (CUR.hsMax - CUR.hsMin) * frac;
      if (settings.hitstop && !reduced() && !instant()) clock.pFrozenUntil = performance.now() + hs; // freezes particles only, of which there are none yet
      const amp = (kill ? CUR.shakeKill : CUR.shakeMin + (CUR.shakeMax - CUR.shakeMin) * frac) * (settings.shake > 0 ? 1 : 0);
      if (!reduced() && !instant()) setTimeout(() => { state.camKick = { amp, start: clock.t, ms: CUR.shakeMs }; }, hs);
      if (kill) death(t, d);
    }
  }
  await wait(CUR.flight);
  const pts = c.targets.map((t, i) => ({ t, i }));
  for (const { t, i } of pts) {
    wait(i * CUR.stagger).then(() => {
      const o = center(cs), to = center(t), rgb = ELEM[m.el].rgb;
      addFx({ dur: CUR.trail, tick(age, g) { this.acc += g * 0.25; const p = age / CUR.trail; const x = lerp(o.x, to.x, p), y = lerp(o.y, to.y, p) - Math.sin(Math.PI * p) * 40;
        while (this.acc >= 1) { this.acc--; P({ x, y, vx: rand(-15, 15), vy: rand(-15, 15), life: 260, size: 4, size2: 1, rgb }); } } });
      wait(CUR.trail).then(() => { const to2 = center(t); for (let k = 0; k < 12; k++) { const a = rand(0, Math.PI * 2); P({ x: to2.x, y: to2.y, vx: Math.cos(a) * rand(60, 200), vy: Math.sin(a) * rand(60, 200), drag: 0.06, life: 320, size: 5, size2: 1, rgb }); } });
    });
  }
  await wait(CUR.trail + CUR.stagger * (pts.length - 1));
  const statuses = [];
  if (m.kind === 'status') statuses.push(m.status);
  if (c.rider) statuses.push(c.rider);
  for (const st of statuses) { for (const t of c.targets) statusLand(t, st, 2, false); await wait(CUR.statusGap); }
  await lungeT;
  const used = CUR.flight + CUR.trail + CUR.stagger * (pts.length - 1) + CUR.statusGap * statuses.length;
  await wait(Math.max(150, (c.enemy ? CUR.enemyPause : CUR.playerHold) - used));
  await cardOut(c.enemy, 140);
}

async function castProposed(c) {
  const Pp = PRESETS[pkey()]; const m = c.move, cs = c.caster, d = dirOf(cs);
  const main = c.targets[0]; const s = dmgScale(c.dmg, main.maxHp); const red = reduced();
  const who = (c.enemy ? 'Enemy ' : '') + cs.name;
  const cin = cardIn(m, c.dmg, c.enemy, Pp.cardIn, who);
  if (c.enemy) { await cin; await wait(Pp.read); }

  if (m.kind === 'status') {
    const tgt = c.targets[0]; const S = STATUS[m.status];
    if (!red) await play(Pp.wiggle, (p) => { cs.oy = -18 * Math.sin(Math.PI * p); cs.rot = 6 * d * Math.sin(p * Math.PI * 3) * (1 - p); const k = Math.sin(Math.PI * 2 * p); cs.sx = 1 + 0.05 * k; cs.sy = 1 - 0.05 * k; });
    cs.oy = 0; cs.rot = 0; cs.sx = 1; cs.sy = 1;
    const from = { x: center(cs).x, y: cs.by + 10 }, to = center(tgt);
    sfx('whoosh', 0.2);
    orbFx(from, to, red ? 120 : Pp.orb, S.rgb, tgt === cs);
    await wait(red ? 120 : Pp.orb);
    statusLand(tgt, m.status);
    await wait(Pp.statusLand);
    await cardOut(c.enemy, Pp.cardOut);
    return;
  }

  // 1 · wind-up: crouch back, card arrives. Big hits on B dim the stage and charge.
  const wu = red ? 0 : Pp.windup(s);
  let dimTo = 0;
  if (Pp.dim && s > Pp.dimAt && settings.flashes && !red) { dimTo = 0.4 * s; play(wu, (p) => { state.dim = dimTo * p; }); }
  if (Pp.charge && s > Pp.chargeAt && !red) chargeFx(cs, wu, m.el);
  if (!red) await tweenU(cs, { ox: -8 * d, sx: 1.06, sy: 0.92 }, wu, E.outQuad);

  // 2 · lunge into the attack position (contact moves dash all the way in)
  let hits;
  sfx('whoosh', s);
  if (m.kind === 'contact') {
    const dist = Math.abs(center(main).x - (cs.bx + 75)) - 115;
    if (!red) {
      addFx({ dur: Pp.lunge * 1.6, tick(age, g) { this.acc += g * 0.25; const cc = center(cs); while (this.acc >= 1) { this.acc--; P({ x: cc.x - d * rand(30, 70), y: cc.y + rand(-40, 40), vx: -d * rand(300, 600), life: 160, size: 2, kind: 'spark', rgb: [235, 240, 255] }); } } });
      await tweenU(cs, { ox: d * dist, sx: 1.08, sy: 0.94 }, Pp.lunge * 1.6, E.inQuad);
    }
    hits = [{ target: main, at: 0 }];
  } else {
    if (!red) await tweenU(cs, { ox: Pp.lungeDist * d, sx: 0.96, sy: 1.05 }, Pp.lunge, E.outCubic);
    if (!red) tweenU(cs, { sx: 1, sy: 1 }, 90);
    // 3 · the element attack, caster → target. Length grows with damage.
    const head = red ? 120 : Pp.head(s), sus = red ? 0 : Pp.sustain(s);
    const tg = c.targets;
    const pm = Pp.pmul;
    if (m.id === 'flame') hits = fxFlame(cs, main, head, sus, s, pm);
    else if (m.id === 'jet') hits = fxJet(cs, main, head, sus, s, pm);
    else if (m.id === 'vine') hits = fxVine(cs, main, head, sus, s, pm);
    else if (m.id === 'firewall') hits = fxFireWall(cs, tg, head, sus, s, pm);
    else if (m.id === 'wave') hits = fxWave(cs, tg, head, sus, s, pm);
    else hits = fxPollen(cs, tg, head, sus, s, pm);
    if (red || instant()) hits = tg.map((u) => ({ target: u, at: head + sus }));
  }

  // 4 · impacts, each on its own beat
  hits.sort((a, b) => a.at - b.at);
  let el0 = 0;
  for (const h of hits) { await wait(h.at - el0); el0 = h.at; impact(c, h.target, hits.length > 1); }
  if (state.dim > 0) { const f = state.dim; play(160, (p) => { state.dim = f * (1 - p); }); }

  // 5 · knockback plays out, then return home; card leaves; rider status lands as its own beat
  await wait(Pp.react);
  const rider = c.rider || m.rider;
  const back = tweenU(cs, { ox: 0, sx: 1, sy: 1 }, red ? 0 : Pp.back, E.inOut);
  const out = cardOut(c.enemy, Pp.cardOut);
  if (rider) { for (const u of c.targets) if (!u.dead) statusLand(u, rider); await wait(Math.max(Pp.back, Pp.statusLand)); }
  await back; await out;
  cs.ox = 0;
}

function impact(c, t, multi) {
  const Pp = PRESETS[pkey()]; const m = c.move, el = m.el, d = dirOf(c.caster);
  const s = dmgScale(c.dmg, t.maxHp); const kill = t.hp > 0 && c.dmg >= t.hp + t.bark;
  const effMul = c.eff === 'super' ? 1.5 : c.eff === 'resisted' ? 0.5 : 1;
  burst(el, t, s, effMul * Pp.pmul, d);
  if (c.eff === 'super' || kill) superRing(t);
  if (c.eff === 'resisted') fizzle(t);
  flash(t, c.eff === 'resisted' ? 1.6 : 3, ELEM[el].rgb);
  const dealt = applyDamage(t, c.dmg);
  if (dealt > 0) floatText(t, `-${dealt}`, ELEM[el].num, Pp.num(s) * (kill ? 1.2 : 1));
  if (c.eff === 'super') floatText(t, 'SUPER EFFECTIVE', [255, 240, 170], 18, 'tag');
  if (c.eff === 'resisted') floatText(t, 'RESISTED', [170, 178, 192], 18, 'tag');
  sfx('hit', s, el, { kill, eff: c.eff });
  let hs = kill ? Pp.kill : Pp.hitstop(s); if (c.eff === 'super') hs += 20; if (c.eff === 'resisted') hs *= 0.6; if (multi) hs *= 0.6;
  const real = freeze(hs);
  if (real && !reduced()) { vibrate(t, 2 + 4 * s, real); vibrate(c.caster, 1 + 1.5 * s, real); }
  if (!reduced() && !instant()) {
    const k = d * (6 + 14 * s) * (c.eff === 'resisted' ? 0.4 : 1); const amp = Pp.targetShake(s);
    play(Pp.react + 60, (p) => { t.kx = p < 0.25 ? k * E.outQuad(p / 0.25) : k * (1 - E.inOut((p - 0.25) / 0.75)); t.shakeX = amp * Math.sin(p * Math.PI * 7) * (1 - p); });
    if ((c.dmg / t.maxHp >= Pp.screenAt || kill) && c.eff !== 'resisted') addTrauma(Pp.trauma(s) * (multi ? 0.6 : 1) + (kill ? 0.25 : 0));
    if (Pp.zoom) { const z = Pp.zoom * s * (kill ? 1.5 : 1); play(260, (p) => { state.zoom = z * (1 - E.outCubic(p)); }); }
  }
  if (kill) death(t, d);
}

/* ------------------------------------------------------------------ queue */
const queue = [];
let running = false;
const qPill = $('#queuePill');
function enqueue(job) { queue.push(job); queueLen = queue.length + (running ? 1 : 0); pump(); }
async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift(); queueLen = queue.length + 1; updatePill();
    try { await job(); } catch (e) { console.error(e); }
  }
  running = false; queueLen = 0; updatePill();
}
function updatePill() { const n = queue.length; qPill.style.display = n ? 'block' : 'none'; qPill.textContent = `${n} queued${settings.catchup && n ? ' · catch-up ' + (1 + 0.2 * Math.min(n, 3)).toFixed(1) + '×' : ''}`; }

function cast(opts) {
  const job = async () => {
    const cs = opts.caster(); const m = opts.move;
    if (!cs || cs.dead) return;
    let targets;
    if (m.kind === 'side') targets = (cs.side === 'ally' ? enemies() : allies()).filter((u) => !u.dead);
    else if (m.kind === 'status' && STATUS[m.status].buff) targets = [cs];
    else { const t = opts.target(); targets = t && !t.dead ? [t] : (cs.side === 'ally' ? enemies() : allies()).filter((u) => !u.dead).slice(0, 1); }
    if (!targets.length) return;
    if (opts.enemy) { state.enemyActive = cs; layout(); await wait(220); }
    const dmg = opts.dmg === 999 ? targets[0].hp + targets[0].bark : opts.dmg;
    const c = { caster: cs, targets, move: m, dmg, eff: opts.eff, rider: m.kind === 'status' || m.kind === 'side' ? '' : opts.rider, enemy: !!opts.enemy };
    showTimeline(planFor(c));
    if (pkey() === 'current') await castCurrent(c); else await castProposed(c);
    if (opts.enemy) { state.enemyActive = null; layout(); }
  };
  enqueue(job);
}
function playerCast(m, dmg) {
  cast({ move: m, caster: () => state.caster, target: () => state.target, dmg: dmg ?? settings.dmg, eff: settings.eff, rider: settings.rider });
}

/* ------------------------------------------------------------------ frame loop */
let last = performance.now();
function noise(t, seed) { return (Math.sin(t * 0.09 + seed) + 0.6 * Math.sin(t * 0.137 + seed * 2.1) + 0.3 * Math.sin(t * 0.213 + seed * 3.7)) / 1.9; }
function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  const frozen = now < clock.frozenUntil;
  const sp = speed();
  const g = frozen ? 0 : dt * sp;
  clock.t += g;
  tl.elapsed += frozen ? dt * Math.sqrt(baseSpeed()) : g;

  for (let i = clock.plays.length - 1; i >= 0; i--) {
    const pl = clock.plays[i]; const p = Math.min(1, (clock.t - pl.start) / pl.ms);
    pl.fn(pl.ease(p));
    if (p >= 1) { clock.plays.splice(i, 1); pl.r(); }
  }
  if (clock.waits.length) {
    const due = clock.waits.filter((w) => w.at <= clock.t);
    if (due.length) { clock.waits = clock.waits.filter((w) => w.at > clock.t); due.forEach((w) => w.r()); }
  }
  for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; const age = clock.t - f.start; if (age >= f.dur) { fxs.splice(i, 1); continue; } if (f.tick && g > 0) f.tick(age, g); }
  stepParts(now < clock.pFrozenUntil ? 0 : g);
  if (!frozen) state.trauma = Math.max(0, state.trauma - g / 1000 * 1.6);

  // camera
  let cx = 0, cy = 0, cr = 0;
  if (!frozen && state.trauma > 0) { const sh = state.trauma * state.trauma * settings.shake; cx = 14 * sh * noise(now, 1.3); cy = 14 * sh * noise(now, 7.1); cr = 1.2 * sh * noise(now, 3.3); }
  if (state.camKick) { const k = state.camKick; const p = (clock.t - k.start) / k.ms; if (p >= 1) state.camKick = null; else cx += k.amp * Math.sin(p * Math.PI * 6) * (1 - p) * (settings.shake > 0 ? 1 : 0); }
  cam.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px) rotate(${cr.toFixed(3)}deg) scale(${1 + state.zoom})`;
  dimEl.style.opacity = state.dim;

  // units
  for (const u of state.units) {
    let vx = 0, vy = 0;
    if (now < u.vibUntil) { const k = (u.vibUntil - now) / (u.vibMs || 100); vx = (Math.random() * 2 - 1) * u.vibAmp * k; vy = (Math.random() * 2 - 1) * u.vibAmp * 0.4 * k; }
    u.spr.style.transform = `translate(${(u.ox + u.kx + u.shakeX + vx).toFixed(2)}px,${(u.oy + vy).toFixed(2)}px) rotate(${u.rot.toFixed(2)}deg) scale(${u.sx.toFixed(3)},${u.sy.toFixed(3)})`;
    let f = `brightness(${u.bright.toFixed(2)}) saturate(${u.sat.toFixed(2)})`;
    if (u.glowA > 0.01 && u.glow) f += ` drop-shadow(0 0 ${(14 * u.glowA).toFixed(1)}px rgba(${u.glow.join(',')},${u.glowA.toFixed(2)}))`;
    u.spr.style.filter = f; u.spr.style.opacity = u.alpha;
    const fr = u.shown / u.maxHp;
    u.fill.style.width = (fr * 100).toFixed(1) + '%'; u.fill.style.background = hpColor(fr);
    u.gh.style.width = (Math.max(u.ghost, u.shown) / u.maxHp * 100).toFixed(1) + '%';
    u.barkEl.style.width = Math.min(100, u.bark) + '%';
    const txt = `${Math.round(u.shown)}/${u.maxHp}`; if (u.hpn.textContent !== txt) u.hpn.textContent = txt;
  }
  // card
  if (card.on) { lcard.style.display = 'block'; lcard.style.opacity = card.a; lcard.style.transform = `translate(${card.x}px,${card.y}px) rotate(${card.rot}deg) scale(${card.sc})`; }
  else lcard.style.display = 'none';

  // canvas
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (const f of fxs) if (f.draw) { ctx.save(); f.draw(ctx, clock.t - f.start); ctx.restore(); }
  drawParts(ctx);
  for (let i = floats.length - 1; i >= 0; i--) {
    const fl = floats[i]; const p = (clock.t - fl.start) / fl.life;
    if (p >= 1) { floats.splice(i, 1); continue; }
    const pop = fl.kind === 'tag' ? 1 : (p < 0.12 ? lerp(1.7, 1, E.outBack(p / 0.12)) : 1);
    const y = fl.y - 50 * E.outCubic(p); const a = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(fl.x, y); ctx.scale(pop, pop);
    ctx.font = `italic 800 ${fl.size}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, fl.size * 0.18); ctx.strokeStyle = 'rgba(6,10,20,.9)'; ctx.strokeText(fl.text, 0, 0);
    ctx.fillStyle = `rgb(${fl.rgb.join(',')})`; ctx.fillText(fl.text, 0, 0); ctx.restore();
  }

  // playhead
  if (tl.live && tl.total > 0) { const p = Math.min(1, tl.elapsed / tl.total); playhead.style.left = `calc(${(p * 100).toFixed(2)}% - 1px)`; if (p >= 1) tl.live = false; }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ UI wiring */
function mkBtn(m, host) {
  const b = document.createElement('button'); b.className = 'mv'; b.style.setProperty('--elc', `var(--${m.el.toLowerCase()})`);
  b.innerHTML = `${m.name}<small>${m.note}</small>`;
  b.addEventListener('click', () => playerCast(m));
  host.appendChild(b);
}
MOVES.filter((m) => m.kind !== 'side').forEach((m) => mkBtn(m, $('#atkBtns')));
MOVES.filter((m) => m.kind === 'side').forEach((m) => mkBtn(m, $('#sideBtns')));
STATUS_MOVES.forEach((m) => mkBtn(m, $('#stBtns')));

function seg(id, key, parse = (v) => v, after) {
  const host = $(id);
  const sync = () => host.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(parse(b.dataset.v) === settings[key])));
  host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings[key] = parse(b.dataset.v); sync(); saveSettings(); after && after(); });
  sync();
  return sync;
}
seg('#segTier', 'tier', String, () => { $('#presetNote').textContent = TIERS[settings.tier].note(); compareLine(); });
seg('#segParty', 'party', Number, () => { queue.length = 0; buildParty(); });
seg('#segEff', 'eff');
seg('#segRider', 'rider');
const syncDmgSeg = seg('#segDmg', 'dmg', Number, () => { if (settings.dmg !== 999) { $('#dmg').value = settings.dmg; } $('#dmgOut').textContent = settings.dmg === 999 ? 'Kill' : settings.dmg; });
$('#dmg').value = settings.dmg === 999 ? 100 : settings.dmg; $('#dmgOut').textContent = settings.dmg === 999 ? 'Kill' : settings.dmg;
$('#dmg').addEventListener('input', (e) => { settings.dmg = +e.target.value; $('#dmgOut').textContent = settings.dmg; syncDmgSeg(); saveSettings(); });
$('#shake').value = Math.round(settings.shake * 100); $('#shakeOut').textContent = Math.round(settings.shake * 100) + '%';
$('#shake').addEventListener('input', (e) => { settings.shake = e.target.value / 100; $('#shakeOut').textContent = e.target.value + '%'; saveSettings(); });
for (const [id, key] of [['#optToday', 'today'], ['#optSlowmo', 'slowmo'], ['#optHitstop', 'hitstop'], ['#optFlash', 'flashes'], ['#optParticles', 'particles'], ['#optCatchup', 'catchup'], ['#optReduced', 'reduced'], ['#optSound', 'sound']]) {
  const el = $(id); el.checked = settings[key];
  el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); compareLine(); });
}
$('#presetNote').textContent = TIERS[settings.tier].note();

$('#btnReset').addEventListener('click', () => { queue.length = 0; for (const u of state.units) { u.hp = u.shown = u.ghost = u.maxHp; u.statuses = {}; u.bark = 0; u.alpha = 1; u.dead = false; renderBadges(u); } });
$('#btnEnemy').addEventListener('click', () => {
  const es = enemies(); const byEl = (el, i) => () => es.find((u) => u.el === el && !u.dead) || es[i % es.length];
  const pick = (i) => byEl(['Water', 'Nature', 'Fire'][i], i);
  const tgt = () => state.caster;
  cast({ move: MOVES[1], caster: pick(0), target: tgt, dmg: 18, eff: 'normal', rider: '', enemy: true });
  cast({ move: STATUS_MOVES.find((m) => m.status === 'Dazed'), caster: pick(1), target: tgt, dmg: 0, eff: 'normal', rider: '', enemy: true });
  cast({ move: MOVES[4], caster: pick(2), target: tgt, dmg: 12, eff: 'normal', rider: '', enemy: true });
});
$('#btnCombo').addEventListener('click', () => {
  playerCast(MOVES[2], 8);
  playerCast(STATUS_MOVES.find((m) => m.status === 'Strength'), 0);
  playerCast(MOVES[0], 34);
});
$('#btnReel').addEventListener('click', () => {
  const S = (k) => STATUS_MOVES.find((m) => m.status === k);
  [[MOVES[0], 6], [MOVES[0], 40], [MOVES[1], 22], [MOVES[2], 30], [MOVES[3], 14], [MOVES[4], 14], [MOVES[5], 18], [MOVES[6], 8],
    [S('Burn'), 0], [S('Dazed'), 0], [S('Weakened'), 0], [S('Strength'), 0], [S('Regen'), 0], [S('Bark'), 0]].forEach(([m, d]) => playerCast(m, d));
});
const ffBtn = $('#btnFF');
const ffOn = (e) => { if (e) e.preventDefault(); ffHeld = true; ffBtn.style.background = 'var(--gold)'; ffBtn.style.color = '#1d1604'; };
const ffOff = () => { ffHeld = false; ffBtn.style.background = ''; ffBtn.style.color = ''; };
ffBtn.addEventListener('pointerdown', ffOn); window.addEventListener('pointerup', ffOff); ffBtn.addEventListener('pointerleave', ffOff);
const typing = () => /TEXTAREA|SELECT/.test(document.activeElement.tagName) || (document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text');
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !typing()) { e.preventDefault(); ffOn(); } });
window.addEventListener('keyup', (e) => { if (e.code === 'Space' && !typing()) { e.preventDefault(); ffOff(); } });

buildParty();
fitStage();
compareLine();
requestAnimationFrame((t) => { last = t; frame(t); });
window.__lab = { settings, state, playerCast, MOVES, STATUS_MOVES, clock, parts };
})();
