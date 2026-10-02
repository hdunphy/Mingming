// @vitest-environment jsdom
/**
 * TICKET 182a — THE BATTLE SCREEN, CUT.
 *
 * One battle, mounted for real, and each row of the ticket's battle table asserted against what
 * the player can SEE (the screen-reader-only text and `title=` hovers do not count, per the
 * ticket). The old tests that pinned the labels this file removes were changed in the same commit.
 */
import { describe, expect, it } from 'vitest';
import BattleArena from './BattleArena';
import { makeStore, mount, click, flush } from '../../testing/interaction';
import { setBattleState } from '../store/battleSlice';
import { createBattleState, type IBattleSetup } from '../../engine/data/battleFactories';
import type { IBattleState, ProgramEntity } from '../../engine/types';
import { budgetProblem, readCopy } from '../copyBudget/copyBudget';

type Member = IBattleSetup['party'][number];
const FENRIR: Member = { id: 'p1', definitionId: 'fenrir', blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15 };
const SKOLL: Member = { id: 'p2', definitionId: 'skoll', blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15 };

function makeBattle(party: Member[]): IBattleState {
    const battle = createBattleState(
        { party, deck: [], drivers: [], persistedHp: {}, encounter: null },
        ['kraken'],
        undefined,
        { seed: 'cut-182a', enemyMode: 'CARDS' },
    );
    const cards: ProgramEntity[] = [
        { id: 'card_ember', dataId: 'ember_jab', currentCost: 1, isPlayable: true },
        { id: 'card_lance', dataId: 'cinder_lance', currentCost: 1, isPlayable: true },
    ];
    return { ...battle, playerDeck: { ...battle.playerDeck, hand: cards } };
}

/** What a player reads: the element's text with the screen-reader-only parts taken out. */
function visible(el: Element): string {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll('.sr-only').forEach((n) => n.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function open(party: Member[]) {
    const store = makeStore();
    store.dispatch(setBattleState(makeBattle(party)));
    const host = await mount(store, <BattleArena />);
    return { store, host };
}

describe('182a battle - the top bar', () => {
    it('shows a small turn badge, and no "your move" / "enemy move" pill', async () => {
        const { host } = await open([FENRIR]);
        const bar = host.querySelector('[data-testid="battle-topbar"]')!;
        expect(visible(bar)).toMatch(/TURN\s*1/);
        expect(visible(bar)).not.toMatch(/YOUR MOVE|ENEMY MOVE/i);
    });

    it('keeps "whose move" for screen readers', async () => {
        const { host } = await open([FENRIR]);
        expect(host.querySelector('[data-testid="battle-topbar"] .sr-only')?.textContent).toMatch(/your move/i);
    });

    it('has no place pill ("EMBERFALL - WILD") on an ordinary fight', async () => {
        const { host } = await open([FENRIR]);
        expect(host.querySelector('.battle-topbar-place')).toBeNull();
    });

    it('has no volume slider in the battle header (it lives in Settings)', async () => {
        const { host } = await open([FENRIR]);
        const bar = host.querySelector('[data-testid="battle-topbar"]')!;
        expect(bar.querySelector('.audio-controls')).toBeNull();
        expect(bar.querySelector('input[type="range"]')).toBeNull();
    });
});

describe('182a battle - the monster plate', () => {
    it('has no V1 chip', async () => {
        const { host } = await open([FENRIR]);
        expect(host.querySelector('.stage-plaque .hud-os-version')).toBeNull();
    });

    it('shows energy as pips, with no "N/N EP" text', async () => {
        const { host } = await open([FENRIR]);
        const plaque = host.querySelector('[data-testid="stage-plaque-p1"]')!;
        expect(plaque.querySelector('.stage-plaque-pips')).not.toBeNull();
        expect(visible(plaque)).not.toMatch(/\bEP\b/);
    });
});

describe('182a battle - the hand', () => {
    it('drops the "+N/turn" formula but keeps the count', async () => {
        const { host } = await open([FENRIR]);
        expect(host.querySelector('.pile-formula')).toBeNull();
        expect(host.querySelector('.draw-pile .pile-count')).not.toBeNull();
    });

    it('never says "NO CASTER - PRESS W / E / R" and has no "?" key hint', async () => {
        const { host } = await open([FENRIR, SKOLL]);
        expect(host.textContent).not.toContain('NO CASTER');
        expect(host.querySelector('.hand-hotkeys-hint')).toBeNull();
    });

    it('picks the caster itself when there is one monster', async () => {
        const { store } = await open([FENRIR]);
        await flush();
        expect(store.getState().battle.selectedSourceId).toBe('p1');
    });

    it('leaves the caster to the player with two monsters', async () => {
        const { store } = await open([FENRIR, SKOLL]);
        await flush();
        expect(store.getState().battle.selectedSourceId).toBeNull();
    });

    it('does not let a click on the only monster un-pick it', async () => {
        const { store, host } = await open([FENRIR]);
        await flush();
        await click(host.querySelector('[data-testid="stage-slot-p1"]')!);
        expect(store.getState().battle.selectedSourceId).toBe('p1');
    });

    it('with two monsters a click on the picked one still un-picks it (as today)', async () => {
        const { store, host } = await open([FENRIR, SKOLL]);
        await click(host.querySelector('[data-testid="stage-slot-p1"]')!);
        expect(store.getState().battle.selectedSourceId).toBe('p1');
        await click(host.querySelector('[data-testid="stage-slot-p1"]')!);
        expect(store.getState().battle.selectedSourceId).toBeNull();
    });
});

describe('182a battle - the card face', () => {
    it('shows the element as an icon, not a word', async () => {
        const { host } = await open([FENRIR]);
        const mark = host.querySelector('.hand-card .rs-elw')!;
        expect(mark).not.toBeNull();
        expect(mark.querySelector('svg')).not.toBeNull();
        expect(visible(mark)).toBe('');
        expect(mark.getAttribute('title')).toMatch(/element/i);
    });

    it('shows the target as an icon, not "ENEMY" / "SELF"', async () => {
        const { host } = await open([FENRIR]);
        const tags = Array.from(host.querySelectorAll('.hand-card .rs-tgt'));
        expect(tags.length).toBeGreaterThan(0);
        for (const t of tags) {
            expect(t.querySelector('svg')).not.toBeNull();
            expect(visible(t)).toBe('');
        }
    });
});

describe('182a battle - the copy budget', () => {
    it('has at most one short paragraph on the whole battle screen', async () => {
        const { host } = await open([FENRIR]);
        expect(budgetProblem(readCopy(host.innerHTML))).toBeNull();
    });
});

/*
 * 182b: "closed by default, not hidden". These two were already closed when 182 began (stale rows);
 * the cases pin it so the first battle never opens with a drawer or a panel in the way.
 */
describe('182b battle - closed by default', () => {
    it('the combat log drawer is closed, and its button is there to open it', async () => {
        const { host } = await open([FENRIR]);
        expect(host.querySelector('.battle-topbar-log')?.getAttribute('aria-expanded')).toBe('false');
    });

    it('the enemy-hand panel is closed, with only its tab showing', async () => {
        const { host } = await open([FENRIR]);
        const panel = host.querySelector('.ehp');
        if (panel) expect(panel.classList.contains('open')).toBe(false);
    });
});
