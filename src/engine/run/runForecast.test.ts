/**
 * TICKET 193j — THE RUN FORECAST: one sentence of what to expect, and the detail lines behind it.
 *
 * The sentence is on the run-start screen (one paragraph, so the copy budget applies) and the details
 * are on the gym card's hover. Nothing in it is typed in: the counts come from the same constants and
 * tables the run is built from, so a redrawn map (ticket 176) or a longer gauntlet changes the text.
 */
import { describe, expect, it } from 'vitest';
import { offerGyms, GYM_REGISTRY } from './gyms';
import { runForecast, DEFAULT_SHAPE, word } from './runForecast';
import { forecastBlock, forecastHover } from './forecastText';
import { GAUNTLET_FIGHTS } from './gauntlet';
import { REGION_PARAMS } from './regionGraph';
import { gymSignatures } from './gauntlet';
import { MAX_PARAGRAPH_CHARS } from '../../ui/copyBudget/copyBudget';

const offers = offerGyms('forecast-seed');
const biomes = offers[0].biomes;

describe('193j — the sentence', () => {
    it('fits the copy budget for each of the three gyms', () => {
        for (const gymId of Object.keys(GYM_REGISTRY)) {
            const { sentence } = runForecast(biomes, gymId);
            expect(sentence.length, `${gymId}: ${sentence}`).toBeLessThanOrEqual(MAX_PARAGRAPH_CHARS);
            expect(sentence.length).toBeGreaterThan(40);
        }
    });

    it('is built from the run, not typed in: the gauntlet length, the biome count and the repair all change it', () => {
        const base = runForecast(biomes, 'gym_emberfall').sentence;
        const longer = runForecast(biomes, 'gym_emberfall', { ...DEFAULT_SHAPE, fights: GAUNTLET_FIGHTS + 2 }).sentence;
        expect(longer).not.toBe(base);
        const fewerBiomes = runForecast(biomes.slice(0, 2), 'gym_emberfall').sentence;
        expect(fewerBiomes).not.toBe(base);
        const noRepair = runForecast(biomes, 'gym_emberfall', { ...DEFAULT_SHAPE, repairPercent: 0 }).sentence;
        expect(noRepair).not.toBe(base);
    });

    it('its default shape is the game\'s own constants', () => {
        expect(DEFAULT_SHAPE.fights).toBe(GAUNTLET_FIGHTS);
        // one elite gate per biome except the last, which ends at the gym
        const gates = REGION_PARAMS.biomesPerRun - 1;
        expect(runForecast(biomes, 'gym_emberfall').sentence.toLowerCase()).toContain(gates === 2 ? 'two elites' : String(gates));
    });
});

describe('193j — the details', () => {
    it('name the gauntlet\'s shape from the same constants', () => {
        const { details } = runForecast(biomes, 'gym_emberfall');
        const joined = details.join('\n');
        expect(joined).toMatch(new RegExp(`${word(GAUNTLET_FIGHTS)} fights`));
        expect(joined).toMatch(/30%/);
    });

    it('give an authored gym\'s boss rule from the table the gauntlet fields', () => {
        for (const gymId of Object.keys(GYM_REGISTRY)) {
            const [signature] = gymSignatures(gymId, biomes);
            const { details } = runForecast(biomes, gymId);
            expect(details.join('\n'), gymId).toContain(signature.name);
            expect(details.join('\n'), gymId).toContain(signature.description);
        }
    });

    it('for a gym with no authored boss state the one-per-biome rule and name no species', () => {
        const { details } = runForecast(biomes, 'gym_not_authored');
        const joined = details.join('\n');
        expect(joined).toMatch(/one .* from each biome/i);
        expect(joined).not.toMatch(/fenrir|skoll|huldra|kraken/i);
    });

    it('the hover is the details, one to a line, and the block is a headed list led by the sentence', () => {
        const forecast = runForecast(biomes, 'gym_emberfall');
        expect(forecastHover(forecast).split('\n')).toEqual([...forecast.details]);
        const block = forecastBlock(forecast).split('\n');
        expect(block[0]).toBe('RUN FORECAST');
        expect(block[1]).toBe(forecast.sentence);
        expect(block.slice(2)).toEqual(forecast.details.map((d) => `- ${d}`));
    });
});
