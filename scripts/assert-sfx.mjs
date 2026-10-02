#!/usr/bin/env node
/**
 * Post-build gate for the sampled SFX — ticket 147a: *"a build check fails on anything larger."*
 *
 * The 61 cues Henry picked live in `public/sfx/`, which Vite copies verbatim into `dist/`. Three
 * things can go wrong between a picked sound and a shipped one, and none of them is visible in a
 * green test run:
 *
 *   1. a cue in the manifest with no file beside it — a silent cue in the shipped game;
 *   2. a file that grew past the 60 KB budget, usually by being re-cut at a higher bitrate;
 *   3. a file in `dist/sfx/` that the manifest never names — dead weight in the download.
 *
 * The suite checks the same things against `public/`; this checks what actually SHIPPED, which is
 * the only copy a player gets. Same shape as `assert-no-debug.mjs`: read `dist/`, exit non-zero,
 * fail `npm run build`.
 *
 * A build with no `dist/sfx` at all passes. That is deliberate: the samples are optional by
 * design — every cue has a synth fallback — so their absence is a smaller game, not a broken one.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 147a: `.ogg`/`.mp3`, mono, and "≤ 60 KB each". The suite uses the same number. */
const MAX_BYTES = 60 * 1024;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sfxDir = join(root, 'dist', 'sfx');
const manifestPath = join(sfxDir, 'manifest.json');

if (!existsSync(sfxDir) || !existsSync(manifestPath)) {
    console.log('[assert-sfx] no dist/sfx — nothing to check (the synth recipes cover every cue).');
    process.exit(0);
}

const problems = [];
let manifest;
try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
    console.error(`[assert-sfx] dist/sfx/manifest.json will not parse: ${error.message}`);
    process.exit(1);
}

const cues = manifest?.cues;
if (!cues || typeof cues !== 'object') {
    console.error('[assert-sfx] dist/sfx/manifest.json has no "cues" object.');
    process.exit(1);
}

const named = new Set();
let total = 0;

for (const [cue, entry] of Object.entries(cues)) {
    if (!entry?.file) {
        problems.push(`${cue}: manifest entry has no "file"`);
        continue;
    }
    if (entry.file.startsWith('/')) {
        // The web build serves from /Mingming/ and the desktop build from ./ over file://.
        problems.push(`${cue}: "${entry.file}" is absolute — it must be relative to the base path`);
    }

    const filePath = join(root, 'dist', entry.file);
    if (!existsSync(filePath)) {
        problems.push(`${cue}: ${entry.file} is in the manifest but not in dist/`);
        continue;
    }

    named.add(entry.file.replace(/^sfx\//, ''));
    const { size } = statSync(filePath);
    total += size;
    if (size > MAX_BYTES) {
        problems.push(`${cue}: ${entry.file} is ${(size / 1024).toFixed(1)} KB, over the ${MAX_BYTES / 1024} KB cap`);
    }
    if (typeof entry.bytes === 'number' && entry.bytes !== size) {
        problems.push(`${cue}: manifest says ${entry.bytes} bytes, the file is ${size}`);
    }
}

for (const name of readdirSync(sfxDir)) {
    if (name === 'manifest.json' || named.has(name)) continue;
    problems.push(`${name} ships but no cue names it — dead weight in the download`);
}

if (problems.length > 0) {
    console.error('[assert-sfx] FAILED:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}

console.log(
    `[assert-sfx] OK: ${named.size} cue(s) in dist/sfx, ${(total / 1024).toFixed(0)} KB total, `
    + `none over ${MAX_BYTES / 1024} KB.`,
);
