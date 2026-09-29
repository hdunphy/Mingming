/**
 * TICKET 168e — `spendBlueprint`: one blueprint leaves the ranch, and nothing is built.
 */
import { describe, expect, it } from 'vitest';

import reducer, { addBlueprint, spendBlueprint } from './gameSlice';
import type { IRanchState } from '../../engine/runTypes';

const start = (): IRanchState => reducer(undefined, { type: '@@init' });

describe('spendBlueprint', () => {
    it('refuses at zero, and leaves the ranch as it was', () => {
        const before = start();
        const after = reducer(before, spendBlueprint('kraken'));
        expect(after.blueprints).toEqual({});
        expect(after.roster).toEqual(before.roster);
    });

    it('takes one from a stack of two', () => {
        let state = reducer(start(), addBlueprint('kraken'));
        state = reducer(state, addBlueprint('kraken'));
        state = reducer(state, spendBlueprint('kraken'));
        expect(state.blueprints.kraken).toBe(1);
    });

    it('drops the key at zero, so the ranch never holds a 0 entry, and leaves other species alone', () => {
        let state = reducer(start(), addBlueprint('kraken'));
        state = reducer(state, addBlueprint('fenrir'));
        state = reducer(state, spendBlueprint('kraken'));
        expect(state.blueprints).toEqual({ fenrir: 1 });
    });

    it('builds nothing: the roster is untouched', () => {
        const state = reducer(reducer(start(), addBlueprint('kraken')), spendBlueprint('kraken'));
        expect(state.roster).toHaveLength(0);
    });
});
