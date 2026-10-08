/**
 * TICKET 202f — the primed brief: the naive brief plus what every human tester has read.
 *
 * Henry (2026-10-07): "If the 'what you already know' isn't in the brief make sure to add it. I think
 * we can do some testing with it on and off" — "through the --brief parameter". So the default brief
 * stays naive (it measures the screens), and `--brief docs/playtest/agent-player-primed.md` runs the
 * primed arm. The primed brief must be the naive one with one section added, never a fork of it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const docs = resolve(__dirname, '../../../docs/playtest');
const naive = readFileSync(resolve(docs, 'agent-player.md'), 'utf8');
const primed = readFileSync(resolve(docs, 'agent-player-primed.md'), 'utf8');
const SECTION = /## What you already know\n[\s\S]*?(?=\n## )/;

describe('202f — the primed brief', () => {
    it('is the naive brief with one section added, so the two arms differ in that section only', () => {
        expect(primed.match(SECTION)).not.toBeNull();
        expect(primed.replace(SECTION, '').replace(/\n{3,}/g, '\n\n')).toBe(naive.replace(/\n{3,}/g, '\n\n'));
        expect(naive).not.toMatch(SECTION);
    });

    it('says what the gym asks for and how the team grows, in the game’s own words', () => {
        const section = primed.match(SECTION)![0];
        for (const word of ['three', 'Trace', 'Summon', 'Den', 'Amber', 'gym']) expect(section).toContain(word);
    });

    it('is LF, like everything under docs/playtest', () => {
        expect(primed).not.toContain('\r');
    });
});
