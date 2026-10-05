// @vitest-environment jsdom
/**
 * TICKET 194f — a firmware chip with a rune shows ONE tooltip, and no robot-theme footer.
 *
 * Henry, 2026-10-04: "Fenrir OS has two tool tips." The rune letter inside the chip had a native
 * `title` carrying the rune's line, and the chip's own portalled tooltip carries the same line.
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FirmwareChip } from './UnitReadouts';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import { describePatchOn } from '../../engine/data/patchText';
import { getPatch } from '../../engine/data/patchRegistry';
import { plain } from '../labels/labels';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean | undefined; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fenrir = createSparseEntity({ id: 'p1', name: 'Fenrir', activeOS: 'fenrir_v1', patches: ['splitter'] });
const state = createSparseBattleState({ playerParty: [fenrir], enemyParty: [createSparseEntity({ id: 'e1' })] });
const runeLine = plain(describePatchOn('fenrir_v1', 'splitter'));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(<FirmwareChip entity={fenrir} battleState={state} />); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = ''; });

const hover = (): void => {
    const chip = host.querySelector('.hud-os-icon-container') as HTMLElement;
    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    act(() => { chip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })); });
};

describe('194f — one tooltip on the firmware chip', () => {
    it('the rune letter has no native title of its own', () => {
        expect(getPatch('splitter')).toBeTruthy();
        const letter = host.querySelector('.hud-os-patch');
        expect(letter).not.toBeNull();
        expect(letter!.hasAttribute('title')).toBe(false);
        expect(host.querySelectorAll('[title]').length).toBe(host.querySelectorAll('.counter-pip[title]').length);
    });

    it('hovering renders exactly one element carrying the rune description', () => {
        hover();
        const carriers = [...document.querySelectorAll('*')].filter((el) =>
            el.children.length === 0 && (el.textContent ?? '').includes(runeLine));
        const titled = [...document.querySelectorAll('[title]')].filter((el) => (el.getAttribute('title') ?? '').includes(runeLine));
        expect(titled).toHaveLength(0);
        expect(document.querySelectorAll('.os-tooltip-portal')).toHaveLength(1);
        expect(carriers).toHaveLength(1);
    });

    it('the tooltip drops the "TECHNICAL READOUT // SECTOR 0" footer', () => {
        hover();
        expect(document.body.textContent).not.toContain('TECHNICAL READOUT');
    });
});
