/**
 * TICKET 202a — the tool's town screen carries the Den's tag line, ahead of the shop line.
 *
 * Same words as the game's Den tile ("N Traces held · summon here"), from the same function. The Den line is listed
 * first so an agent reads it before it reads about the shop.
 */
import { describe, it, expect } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { currentScreen } from './screen';
import { renderScreen } from './render';
import { freshWorld } from './testKit';
import { giveBlueprint, standAt } from './walkKit';
import type { World } from './types';

function townWith(traces: number): World {
    const world = freshWorld();
    const [a, b] = Object.keys(MingmingRegistry);
    if (traces > 0) giveBlueprint(world, a);
    if (traces > 1) giveBlueprint(world, b);
    standAt(world, 'town');
    return world;
}

describe('202a — the tool’s town screen', () => {
    it('is the town screen', () => {
        expect(currentScreen(townWith(2)).id).toBe('town');
    });

    it('says "2 Traces held · summon here" with two Traces held', () => {
        expect(renderScreen(townWith(2))).toContain('2 Traces held · summon here');
    });

    it('does not say "summon here" with none held', () => {
        expect(renderScreen(townWith(0))).not.toContain('summon here');
    });

    it('lists the Den line on an earlier line than the shop line', () => {
        const lines = currentScreen(townWith(2)).body;
        const den = lines.findIndex((l) => l.includes('summon here'));
        const shop = lines.findIndex((l) => /\bshop\b/.test(l));
        expect(den).toBeGreaterThanOrEqual(0);
        expect(shop).toBeGreaterThanOrEqual(0);
        expect(den).toBeLessThan(shop);
    });
});
