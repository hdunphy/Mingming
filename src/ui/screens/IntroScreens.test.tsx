// @vitest-environment jsdom
/**
 * TICKET 182c — THE INTRO'S SCREENS, mounted and clicked.
 *
 * The intro is the ordinary game's screens asked a different question (`introRules`), so what is
 * tested here is each screen's answer for an intro run against its answer for an ordinary one: the
 * stray Mingming (free, v1, the vault ends where it started), the market (a card stall and an
 * upgrade bench, nothing else), the leader's gate (no macros, no patches, one fight) and the fight
 * itself (no combat log, no enemy-hand tab).
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';

import EventNode from './EventNode';
import GauntletNode from './GauntletNode';
import MarketplaceNode from './MarketplaceNode';
import BattleArena from '../components/BattleArena';
import { makeStore, mount, click, clickText, findText, flush, type TestStore } from '../../testing/interaction';
import { addToRoster } from '../store/gameSlice';
import { beginGauntlet, enterNode, startRun } from '../store/runSlice';
import { startBattle } from '../store/battleSlice';
import { SeedStream } from '../../engine/core/SeedStream';
import { createRanchMember } from '../../engine/gameTypes';
import { toMingmingState, buildBattleSetup } from '../../engine/run/battleSetup';
import { createRun } from '../../engine/run/createRun';
import { createIntroRun } from '../../engine/run/intro/createIntroRun';
import { offerGyms } from '../../engine/run/gyms';
import { rollGauntletFight } from '../../engine/run/gauntlet';
import { RUN_ENEMY_MODE } from '../../engine/run/encounter';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';

function starterFor(species: string): IRanchMember {
    return { ...createRanchMember(species, `${species}_v1`, new SeedStream(`${species}-roll`)), id: 'mm1' };
}

/** A store holding a ranch with the starter on its roster and a run of the given kind, standing at `at`. */
function storeFor(kind: 'intro' | 'ordinary', walk: string[] = [], species = 'kraken'): TestStore {
    const store = makeStore();
    const member = starterFor(species);
    store.dispatch(addToRoster(member));
    const state = toMingmingState(member);
    store.dispatch(startRun(kind === 'intro'
        ? createIntroRun({ seed: 'intro-screens', starter: state, startedAt: 1 })
        : createRun({ seed: 'ordinary-screens', offer: offerGyms('ordinary-offer')[0], party: [state], startedAt: 1 })));
    for (const id of walk) store.dispatch(enterNode(id));
    return store;
}

const view = (s: { run: { run: IRunState | null }; game: IRanchState }) => {
    const run = s.run.run!;
    return { run, ranch: s.game, node: run.nodes.find((n) => n.id === run.currentNodeId)! };
};

/** Two selectors, not one that builds an object: a fresh object every call trips react-redux's stability warning. */
function useScreen() {
    const run = useSelector((s: { run: { run: IRunState | null } }) => s.run.run)!;
    const ranch = useSelector((s: { game: IRanchState }) => s.game);
    return { run, ranch, node: run.nodes.find((n) => n.id === run.currentNodeId)! };
}

function EventHarness(): ReactNode {
    const { run, ranch, node } = useScreen();
    return <EventNode run={run} node={node} ranch={ranch} biomeName="Test Biome" onLeave={() => {}} />;
}
function MarketHarness(): ReactNode {
    const { run, ranch, node } = useScreen();
    const party = ranch.roster.filter((m) => run.partyIds.includes(m.id)).map((m) => ({ id: m.id, definitionId: m.definitionId, activeOS: m.activeOS }));
    return <MarketplaceNode run={run} node={node} party={party} ranch={ranch} biomeName="Test Biome" onEditLoadout={() => {}} onLeave={() => {}} />;
}
function GateHarness(): ReactNode {
    const { run, ranch, node } = useScreen();
    return <GauntletNode run={run} node={node} ranch={ranch} onEditLoadout={() => {}} />;
}

/** What a player reads: the screen-reader-only text is not on screen. */
function visible(el: Element): string {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll('.sr-only').forEach((n) => n.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('182c the stray Mingming', () => {
    const toStray = ['b0l1n0', 'b0l2n0'];

    it('is a recruit with no Leave, and offers the two starters not picked, on v1', async () => {
        const store = storeFor('intro', toStray);
        const host = await mount(store, <EventHarness />);
        expect(visible(host)).toContain('Recruit');
        expect(() => findText(host, 'Leave')).toThrow();
        await clickText(host, 'Recruit');
        const names = [...host.querySelectorAll('.ev-choice')].map((el) => visible(el));
        expect(names).toHaveLength(2);
        expect(names.join(' ')).toMatch(/Fenrir/);
        expect(names.join(' ')).toMatch(/Ratatoskr/);
        expect(names.join(' ')).not.toMatch(/Kraken/);
    });

    it('builds the pick for free and leaves the vault where it started', async () => {
        const store = storeFor('intro', toStray);
        const host = await mount(store, <EventHarness />);
        const before = store.getState();
        await clickText(host, 'Recruit');
        await click(host.querySelectorAll('.ev-choice')[0]);
        await clickText(host, 'RECRUIT');
        await flush();

        const after = store.getState();
        expect(after.run.run!.partyIds).toHaveLength(2);
        expect(after.run.run!.scrap).toBe(before.run.run!.scrap);
        expect(after.game.roster).toHaveLength(2);
        expect(after.game.roster[1].activeOS).toMatch(/_v1$/);
        expect(after.game.blueprints).toEqual(before.game.blueprints);
        expect(after.game.runsCompleted).toBe(0);
    });

    it.each([['kraken', 'Fenrir', 'Ratatoskr'], ['fenrir', 'Kraken', 'Ratatoskr'], ['ratatoskr', 'Kraken', 'Fenrir']])(
        'a %s player is offered %s and %s', async (starter, a, b) => {
            const store = storeFor('intro', toStray, starter);
            const host = await mount(store, <EventHarness />);
            await clickText(host, 'Recruit');
            const text = [...host.querySelectorAll('.ev-choice')].map((el) => visible(el)).join(' ');
            expect(text).toContain(a);
            expect(text).toContain(b);
        });
});

describe('182c the market', () => {
    const toMarket = ['b0l1n0', 'b0l2n0', 'b0l3n0'];

    it('is a card stall and an upgrade bench in the intro, and nothing else', async () => {
        const host = await mount(storeFor('intro', toMarket), <MarketHarness />);
        const text = visible(host);
        expect(text).toContain('STOCK');
        expect(text).toContain('UPGRADE');
        for (const gone of ['MACROS', 'BLUEPRINT', 'SELL', 'REFRESH', 'EDIT LOADOUT', 'PATCH']) {
            expect(text, `the intro market shows "${gone}"`).not.toContain(gone);
        }
        expect(host.querySelector('.mk-rack')).toBeNull();
        expect(host.querySelector('.mk-sell')).toBeNull();
    });

    it('still has the stall, the shelves and the sell panel in an ordinary run', async () => {
        const store = storeFor('ordinary');
        const run = store.getState().run.run!;
        const market = run.nodes.find((n) => n.kind === 'marketplace')!;
        store.dispatch(enterNode(market.id));
        const host = await mount(store, <MarketHarness />);
        const text = visible(host);
        for (const here of ['STOCK', 'MACROS', 'SELL', 'REFRESH', 'EDIT LOADOUT']) {
            expect(text, `the ordinary market lost "${here}"`).toContain(here);
        }
    });
});

describe('182c the leader\'s gate', () => {
    const toGate = ['b0l1n0', 'b0l2n0', 'b0l3n1', 'b0l4n0'];

    it('is one fight with no macro list and no patch bench', async () => {
        const store = storeFor('intro', toGate);
        store.dispatch(beginGauntlet());
        const host = await mount(store, <GateHarness />);
        const text = visible(host);
        expect(text).toContain('Begin fight 1 of 1');
        expect(text).toContain('2 of them');
        expect(text).not.toContain('Macros');
        expect(text).not.toContain('PATCH');
        expect(text).toContain('ONE FREE UPGRADE');
    });

    it('is the three-fight gauntlet with its macro list in an ordinary run', async () => {
        const store = storeFor('ordinary');
        const run = store.getState().run.run!;
        store.dispatch(enterNode(run.nodes.find((n) => n.kind === 'gym')!.id));
        store.dispatch(beginGauntlet());
        const host = await mount(store, <GateHarness />);
        const text = visible(host);
        expect(text).toContain('Begin fight 1 of 3');
        expect(text).toContain('Macros');
        expect(text).toContain('3 of them');
    });
});

describe('182c the fight', () => {
    function fightStore(kind: 'intro' | 'ordinary'): TestStore {
        const store = storeFor(kind, kind === 'intro' ? ['b0l1n0', 'b0l2n0', 'b0l3n1', 'b0l4n0'] : []);
        if (kind === 'ordinary') {
            const run = store.getState().run.run!;
            store.dispatch(enterNode(run.nodes.find((n) => n.kind === 'gym')!.id));
        }
        store.dispatch(beginGauntlet());
        const { run, ranch, node } = view(store.getState());
        const encounter = rollGauntletFight({ run, node, fightIndex: 0 });
        store.dispatch(startBattle({
            setup: buildBattleSetup(ranch, run, encounter),
            enemyIds: [],
            options: { seed: encounter.seed, enemyMode: RUN_ENEMY_MODE, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam },
        }));
        return store;
    }

    it('has no combat log and no enemy-hand tab in the intro', async () => {
        const host = await mount(fightStore('intro'), <BattleArena />);
        expect(host.querySelector('.battle-topbar-log')).toBeNull();
        expect(host.querySelector('.combat-log')).toBeNull();
        expect(host.querySelector('[data-testid="enemy-hand"]')).toBeNull();
    });

    it('keeps the log chevron and the enemy-hand tab in an ordinary run', async () => {
        const host = await mount(fightStore('ordinary'), <BattleArena />);
        expect(host.querySelector('.battle-topbar-log')).not.toBeNull();
        expect(host.querySelector('[data-testid="enemy-hand"]')).not.toBeNull();
    });
});
