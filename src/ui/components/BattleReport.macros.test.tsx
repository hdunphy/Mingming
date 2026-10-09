// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import BattleReport from './BattleReport';
import type { IRewardBundle } from '../../engine/gameTypes';
import type { IBattleEntity } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WINNERS: ReadonlyArray<IBattleEntity> = [];

let host: HTMLDivElement;
let root: Root;
let onContinue: ReturnType<typeof vi.fn>;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onContinue = vi.fn();
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('166d — BattleReport draught reward pick', () => {
    const bundleWithMacros: IRewardBundle = {
        scraps: 0,
        blueprints: [],
        cards: [],
        cardChoices: [],
        macroChoices: ['revive', 'mend', 'surge'],
    };

    it('shows three buttons for choices; clicking one and Continue passes { macroId } as 4th arg', () => {
        act(() => {
            root.render(
                <BattleReport
                    bundle={bundleWithMacros}
                    winners={WINNERS}
                    macroRack={[null, null, null]}
                    onContinue={onContinue}
                />,
            );
        });

        // Heading exists
        expect(host.textContent).toContain('DRAUGHT — TAKE ONE');

        // Look for buttons corresponding to the three macros
        const buttons = Array.from(host.querySelectorAll('button'));
        const reviveBtn = buttons.find((b) => b.textContent?.includes('Revive'));
        expect(reviveBtn).toBeDefined();

        act(() => {
            reviveBtn?.click();
        });

        // Click CONTINUE button
        const continueBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('CONTINUE'));
        expect(continueBtn).toBeDefined();

        act(() => {
            continueBtn?.click();
        });

        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(onContinue).toHaveBeenCalledWith([], [], undefined, { macroId: 'revive' });
    });

    it('with full rack, drop row appears after a macro is picked', () => {
        act(() => {
            root.render(
                <BattleReport
                    bundle={bundleWithMacros}
                    winners={WINNERS}
                    macroRack={['surge', 'recharge', 'salve']}
                    onContinue={onContinue}
                />
            );
        });

        // Before selection, drop row is not shown
        expect(host.textContent).not.toContain('Your rack is full — drop one to make room');

        const buttons = Array.from(host.querySelectorAll('button'));
        const mendBtn = buttons.find((b) => b.textContent?.includes('Mend'));
        act(() => {
            mendBtn?.click();
        });

        // Now drop row appears
        expect(host.textContent).toContain('Your rack is full — drop one to make room');

        // Click slot 1 (Second Wind) to drop it
        const rechargeBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Second Wind'));
        expect(rechargeBtn).toBeDefined();
        act(() => {
            rechargeBtn?.click();
        });

        const continueBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('CONTINUE'));
        act(() => {
            continueBtn?.click();
        });

        expect(onContinue).toHaveBeenCalledWith([], [], undefined, { macroId: 'mend', replaceSlot: 1 });
    });

    it('passes undefined for chosenMacro when nothing is picked', () => {
        act(() => {
            root.render(
                <BattleReport
                    bundle={bundleWithMacros}
                    winners={WINNERS}
                    macroRack={[null, null, null]}
                    onContinue={onContinue}
                />,
            );
        });

        const continueBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('CONTINUE'));
        act(() => {
            continueBtn?.click();
        });

        expect(onContinue).toHaveBeenCalledWith([], [], undefined, undefined);
    });
});
