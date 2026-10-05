// @vitest-environment jsdom
/**
 * TICKET 194g — the plaque that looks selected is the caster the hand uses.
 *
 * Henry, 2026-10-04: "First mingming UI shows as selected at battle start, but it isn't really
 * selected." The stage lit the first living body as active while the store held no caster.
 */
import { describe, expect, it } from 'vitest';
import BattleArena from './BattleArena';
import { makeStore, mount, click, flush } from '../../testing/interaction';
import { setBattleState } from '../store/battleSlice';
import { createBattleState, type IBattleSetup } from '../../engine/data/battleFactories';
import { defaultCasterId } from '../utils/defaultCaster';

type Member = IBattleSetup['party'][number];
const member = (id: string, definitionId: string): Member =>
    ({ id, definitionId, blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15 });
const PARTY = [member('p1', 'fenrir'), member('p2', 'skoll'), member('p3', 'ratatoskr')];

async function open() {
    const store = makeStore();
    store.dispatch(setBattleState(createBattleState(
        { party: PARTY, deck: [], drivers: [], persistedHp: {}, encounter: null }, ['kraken'], undefined,
        { seed: 'caster-194g', enemyMode: 'CARDS' },
    )));
    const host = await mount(store, <BattleArena />);
    await flush();
    return { store, host };
}

/** The ally whose plaque wears the active look. */
const activeAlly = (host: HTMLElement): string[] =>
    [...host.querySelectorAll('.stage-plaque-active')].map((el) => el.getAttribute('data-testid') ?? '');

describe('194g — one source of truth for the caster', () => {
    it('at battle start the plaque that looks selected is the store\'s caster', async () => {
        const { store, host } = await open();
        const casterId = store.getState().battle.selectedSourceId;
        expect(casterId).toBe('p1');
        expect(activeAlly(host)).toEqual([`stage-plaque-${casterId}`]);
    });

    it('after the player picks another body, the look and the store still agree', async () => {
        const { store, host } = await open();
        await click(host.querySelector('[data-testid="stage-slot-p3"]')!);
        expect(store.getState().battle.selectedSourceId).toBe('p3');
        expect(activeAlly(host)).toEqual(['stage-plaque-p3']);
    });

    it('defaultCasterId: keeps a living pick, replaces a dead or missing one, and is null with nobody standing', () => {
        const party = [{ id: 'a', currentHp: 0 }, { id: 'b', currentHp: 5 }, { id: 'c', currentHp: 9 }];
        expect(defaultCasterId(party, 'c')).toBeNull();
        expect(defaultCasterId(party, 'a')).toBe('b');
        expect(defaultCasterId(party, null)).toBe('b');
        expect(defaultCasterId([{ id: 'a', currentHp: 0 }], null)).toBeNull();
    });
});
