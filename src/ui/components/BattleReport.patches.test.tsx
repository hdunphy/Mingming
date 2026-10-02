// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import BattleReport from './BattleReport';
import type { IRewardBundle } from '../../engine/gameTypes';
import { createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * TICKET 167j — Henry, 2026-09-27: *"I need to see which Mingmings already have a patch in the
 * rewards screen."* Since 166e the screen only offers the patch to bodies without one, but it said
 * nothing about who already had what.
 */
const WINNERS = [
    createSparseEntity({ id: 'm1', name: 'Fenrir' }),
    createSparseEntity({ id: 'm2', name: 'Skoll' }),
    createSparseEntity({ id: 'm3', name: 'Huldra' }),
];
/** The offer is for Fenrir; Skoll already runs a patch. */
const BUNDLE: IRewardBundle = {
    scraps: 0, blueprints: [], cards: [], cardChoices: [],
    patchChoices: [{ memberId: 'm1', patchId: 'repeater' }],
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
});

function render(heldPatches?: Readonly<Record<string, ReadonlyArray<string>>>) {
    act(() => {
        root.render(
            <BattleReport bundle={BUNDLE} winners={WINNERS} heldPatches={heldPatches} onContinue={vi.fn()} />,
        );
    });
}
const holderLines = () => Array.from(host.querySelectorAll('[data-testid="patch-holder"]')).map(e => e.textContent ?? '');

describe('167j — the rune offer says who already runs a rune', () => {
    it('names the body that holds a rune, and the rune, inside the rune block', () => {
        render({ m2: ['amplifier'] });
        const lines = holderLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('Skoll');
        expect(lines[0].toLowerCase()).toContain('amplifier');
        expect(lines[0]).toMatch(/Skoll\s+—\s+/);
        expect(host.textContent).toContain('INSTINCT RUNE');
    });

    it('lists each holder once, in party order', () => {
        render({ m3: ['amplifier'], m2: ['relay'] });
        const lines = holderLines();
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('Skoll');
        expect(lines[1]).toContain('Huldra');
    });

    it('adds no line when nobody holds a patch', () => {
        render({});
        expect(holderLines()).toHaveLength(0);
        render(undefined);
        expect(holderLines()).toHaveLength(0);
    });

    it('ignores a body with an empty patch list', () => {
        render({ m2: [] });
        expect(holderLines()).toHaveLength(0);
    });
});
