// @vitest-environment jsdom
/**
 * TICKET 179 (Henry, 2026-10-01): *"we should always offer one set of card rewards per battle.
 * Right now it is one set per Mingming."*
 *
 * The end-to-end shape of the change as the player sees it: the bundle a real 3-body win rolls goes
 * into the real reward screen, and the screen shows ONE pick row (one SKIP button, one row of three
 * cards), not three. `BattleReport.skip.test.tsx` keeps a hand-built two-pick bundle because the
 * screen is generic over `cardChoices`; this file is the one that ties the screen to what a fight
 * actually pays.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import BattleReport from './BattleReport';
import { rollDropTable } from '../../engine/RewardSystem';
import type { IBattleEntity } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function deadFoe(n: number): IBattleEntity {
    return {
        id: `e${n}`, name: `Foe ${n}`,
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        maxHp: 100, attack: 15, defense: 5,
        maxEnergy: 10, cardDraw: 1,
        currentHp: 0, currentEnergy: 0,
        primaryElement: 'Fire',
        statusEffects: [],
        definitionId: 'fyrbot',
        tempHp: 0, speed: 10,
        daemons: [],
    };
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
});

const skipButtons = (): HTMLButtonElement[] =>
    [...host.querySelectorAll('button')].filter(b => (b.textContent ?? '').includes('SKIP'));

describe('the reward screen after a 3-body win (ticket 179)', () => {
    it('shows one pick row of three cards, not one per defeated body', async () => {
        const bundle = rollDropTable({
            defeated: [deadFoe(0), deadFoe(1), deadFoe(2)],
            nodeKind: 'wild',
            party: [{ definitionId: 'fenrir', activeOS: 'fenrir_v1' }],
            seed: 'three-bodies-one-row',
        });
        expect(bundle.cardChoices).toHaveLength(1);

        await act(async () => {
            root.render(<BattleReport bundle={bundle} winners={[]} onContinue={vi.fn()} />);
        });

        expect(host.querySelectorAll('.reward-card-row')).toHaveLength(1);
        expect(host.querySelectorAll('.reward-card-row > *')).toHaveLength(3);
        expect(skipButtons()).toHaveLength(1);
    });
});
