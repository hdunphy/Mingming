// @vitest-environment jsdom
/**
 * TICKET 199 — the firmware chip draws its owner's Instinct glyph, and the tooltip header shows the
 * glyph beside the Norse name with no "v1.0" / "v2.0" (194f left that text for this row).
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { FirmwareChip } from './UnitReadouts';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean | undefined; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(activeOS: string): void {
    const entity = createSparseEntity({ id: 'p1', name: 'Body', activeOS });
    const state = createSparseBattleState({ playerParty: [entity], enemyParty: [createSparseEntity({ id: 'e1' })] });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root!.render(<FirmwareChip entity={entity} battleState={state} />); });
}

const hover = (): void => {
    const chip = host!.querySelector('.hud-os-icon-container') as HTMLElement;
    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    act(() => { chip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })); });
};

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
    host = null;
    root = null;
});

describe('199 the firmware chip', () => {
    it("draws the owner's Instinct glyph, not the generic firmware icon", () => {
        mount('fenrir_v1');
        const glyph = host!.querySelector('.hud-os-icon-container .hud-os-icon');
        expect(glyph).not.toBeNull();
        expect(glyph!.getAttribute('data-instinct-glyph')).toBe('UNBOUND_KERNEL');
    });

    it('each of the twelve species Instincts of the 1.0 species draws its own', () => {
        const drawn = new Set<string>();
        for (const id of ['fenrir_v1', 'fenrir_v2', 'kraken_v1', 'kraken_v2', 'skoll_v1', 'skoll_v2',
            'jormungandr_v1', 'jormungandr_v2', 'ratatoskr_v1', 'ratatoskr_v2', 'huldra_v1', 'huldra_v2']) {
            mount(id);
            drawn.add(host!.querySelector('.hud-os-icon')!.getAttribute('data-instinct-glyph')!);
            act(() => root!.unmount()); host!.remove(); document.body.innerHTML = '';
        }
        expect(drawn.size).toBe(12);
        expect(drawn.has('generic')).toBe(false);
    });

    it('keeps the generic firmware icon for an Instinct that has no glyph yet', () => {
        mount('ymir_v1');
        expect(host!.querySelector('.hud-os-icon')!.getAttribute('data-instinct-glyph')).toBe('generic');
    });

    it('the tooltip header shows the glyph beside the Norse name', () => {
        mount('fenrir_v1');
        hover();
        const header = document.querySelector('.os-tooltip-portal .tooltip-header');
        expect(header).not.toBeNull();
        expect(header!.querySelector('[data-instinct-glyph="UNBOUND_KERNEL"]')).not.toBeNull();
        expect(header!.textContent).toContain('Unbound');
    });

    it('the tooltip has no "v1.0" or "v2.0" text', () => {
        for (const id of ['fenrir_v1', 'fenrir_v2', 'ymir_v2']) {
            mount(id);
            hover();
            const text = document.querySelector('.os-tooltip-portal')!.textContent ?? '';
            expect(text, id).not.toMatch(/v[12]\.0/);
            expect(document.querySelector('.tooltip-os-version'), id).toBeNull();
            act(() => root!.unmount()); host!.remove(); document.body.innerHTML = '';
        }
    });
});
