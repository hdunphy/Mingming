import { describe, it, expect } from 'vitest';
import { pruneToBeam } from './TacticalAI';

describe('pruneToBeam (ticket 166f)', () => {
    const candidates = [
        { id: 'c0', immediate: 3, order: 0 },
        { id: 'c1', immediate: 9, order: 1 },
        { id: 'c2', immediate: 1, order: 2 },
        { id: 'c3', immediate: 7, order: 3 },
        { id: 'c4', immediate: 5, order: 4 },
    ];

    it('beam 2 selects the top 2 by immediate score and preserves original order', () => {
        const result = pruneToBeam(candidates, 2);
        expect(result.map((c) => c.immediate)).toEqual([9, 7]);
        expect(result.map((c) => c.order)).toEqual([1, 3]);
        expect(result.map((c) => c.id)).toEqual(['c1', 'c3']);
    });

    it('beam 3 selects the top 3 by immediate score and preserves original order', () => {
        const result = pruneToBeam(candidates, 3);
        expect(result.map((c) => c.immediate)).toEqual([9, 7, 5]);
        expect(result.map((c) => c.order)).toEqual([1, 3, 4]);
        expect(result.map((c) => c.id)).toEqual(['c1', 'c3', 'c4']);
    });

    it('beam larger than list returns the whole list in unchanged order', () => {
        const result = pruneToBeam(candidates, 10);
        expect(result).toEqual(candidates);
    });

    it('beam equal to list length returns the whole list in unchanged order', () => {
        const result = pruneToBeam(candidates, 5);
        expect(result).toEqual(candidates);
    });
});
