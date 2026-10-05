/**
 * TICKET 193j — the agent's forewarning: the run forecast, on the first screen of a session only.
 *
 * The tool starts on the map, so this block is the agent's whole equivalent of the run-start screen.
 * It is the game's own text (`runForecast`), never worded here, and later screens do not repeat it.
 */
import { describe, expect, it } from 'vitest';
import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { renderScreen } from './render';
import { forecastFor } from './forecastBlock';
import { runForecast } from '../../engine/run/runForecast';
import { currentScreen } from './screen';
import { freshWorld, starter, tempRoot } from './testKit';
import { applyMove } from './world';
import { runOf } from './types';

describe('193j — the RUN FORECAST block', () => {
    it('is on the first screen, built from the game\'s sentence and the gym\'s boss rule', () => {
        const world = freshWorld();
        const run = runOf(world);
        const forecast = runForecast(run.biomes, run.gymId);
        const out = renderScreen(world);
        expect(out).toContain('RUN FORECAST');
        expect(out).toContain(forecast.sentence);
        expect(out).toMatch(/Boss rule, /);
        expect(forecastFor(world)).toContain(forecast.sentence);
    });

    it('is not on the second screen, nor on any later one', () => {
        const world = freshWorld();
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
        expect(renderScreen(world)).not.toContain('RUN FORECAST');
        expect(forecastFor(world)).toBeNull();
    });

    it('at the command line: new and a state before any move show it; after a move it is gone; replay to 0 shows it again', () => {
        const root = tempRoot();
        const run = (line: string) => {
            const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
            const args = parseArgs(tokens);
            return COMMANDS[args.command!](root, args);
        };
        expect(run(`new --session s1 --seed ps1 --starter ${starter()} --gym 0 --mode run`).out).toContain('RUN FORECAST');
        expect(run('state --session s1').out).toContain('RUN FORECAST');
        expect(run('move --session s1 1 --why "first step"').out).not.toContain('RUN FORECAST');
        expect(run('state --session s1').out).not.toContain('RUN FORECAST');
        expect(run('replay --session s1 --to 0').out).toContain('RUN FORECAST');
    });
});
