/**
 * TICKET 193k — a night can be played again on the same seeds.
 *
 * The seed was named `pt<date>:<i>` and the date is also the results folder, so the only way to play
 * the same seeds again was the same date, and then every finished session was skipped. `seedDate` is
 * the date the seed is named after; it defaults to the night's own date, so nothing changes without it.
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { parseArgs } from './args';
import { cmdPlan } from './commands';
import { planNight, type NightEntry } from './night/plan';

const STARTERS = Array.from({ length: 12 }, (_, i) => `starter_${i}`);

describe('193k — the seed date', () => {
    it('a night on another date with the old seed date is the same worlds: seeds, starters, gyms and modes', () => {
        const baseline = planNight('2026-10-04', STARTERS, { runs: 9, cardRuns: 0 });
        const again = planNight('2026-10-06', STARTERS, { runs: 9, cardRuns: 0, seedDate: '2026-10-04' });
        expect(again.map((e) => e.seed)).toEqual(baseline.map((e) => e.seed));
        expect(again.map((e) => [e.starter, e.gym, e.mode, e.tier])).toEqual(baseline.map((e) => [e.starter, e.gym, e.mode, e.tier]));
        // the sessions keep their names: the results folder follows --date, not the seed
        expect(again.map((e) => e.session)).toEqual(baseline.map((e) => e.session));
    });

    it('without a seed date the plan is what it was', () => {
        const plan = planNight('2026-10-04', STARTERS, { runs: 3 });
        expect(plan.map((e) => e.seed)).toEqual(['pt2026-10-04:1', 'pt2026-10-04:2', 'pt2026-10-04:3']);
        expect(planNight('2026-10-04', STARTERS, { runs: 3, seedDate: undefined })).toEqual(plan);
    });

    it('the plan command takes --seed-date, and refuses a value that is not a date-like name', () => {
        const run = (line: string) => cmdPlan('unused', parseArgs(line.split(' ')));
        const plan = JSON.parse(run('plan --date 2026-10-06 --seed-date 2026-10-04 --runs 2 --card-runs 0').out) as NightEntry[];
        expect(plan.map((e) => e.seed)).toEqual(['pt2026-10-04:1', 'pt2026-10-04:2']);
        expect(run('plan --date 2026-10-06 --seed-date has/slash').code).toBe(1);
    });

    it('the night script reads --seed-date, and passes it to the plan', async () => {
        const script = (await import(/* @vite-ignore */ resolve(__dirname, '../../../scripts/playtest-night.mjs'))) as {
            parseNightArgs(argv: string[], today?: string): { seedDate?: string; date: string };
            planArgs(options: { date: string; runs: number; cardRuns: number; turnRuns: number; starter?: string; seedDate?: string }): string[];
        };
        expect(script.parseNightArgs(['--date', '2026-10-06', '--seed-date', '2026-10-04'], '2026-10-05')).toMatchObject({ date: '2026-10-06', seedDate: '2026-10-04' });
        expect(script.parseNightArgs([], '2026-10-05').seedDate).toBeUndefined();
        const args = script.planArgs({ date: '2026-10-06', runs: 9, cardRuns: 0, turnRuns: 0, seedDate: '2026-10-04' });
        expect(args.join(' ')).toContain('--seed-date 2026-10-04');
        expect(script.planArgs({ date: '2026-10-06', runs: 9, cardRuns: 0, turnRuns: 0 }).join(' ')).not.toContain('--seed-date');
    });
});
