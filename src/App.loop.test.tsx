// @vitest-environment jsdom
/**
 * THE FIRST FIVE MINUTES, ONE CLICK AT A TIME (steam-release ticket 58).
 *
 * Seven tests over the spine of the loop — starter, assembly, run start, node, card, end turn,
 * reward — each asserting that a click changed the STORE, not that a string rendered. The class of
 * bug this catches is the one that shipped twice on 2026-08-24: a click that dispatches, renders a
 * correct frame, and leaves the game somewhere else than the player is. A static render cannot see
 * it; `renderToStaticMarkup` runs no effects and has no event loop.
 *
 * Deliberately shallow: one test per screen, not one per control, and each test walks to its screen
 * through the real clicks of the ones before it rather than through a fixture. If an earlier step
 * breaks, several tests fail — that is the point, the loop IS the fixture.
 *
 * The enemy turn runs on real `setTimeout`s (a 1.2 s beat per action), so the END TURN test drives
 * fake timers. Everything else is instantaneous.
 */
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';

import { makeStore, mountApp, click, clickText, findText, fire, flush } from './testing/interaction';
import type { TestStore } from './testing/interaction';
import { setBattleState } from './ui/store/battleSlice';
import { setRun } from './ui/store/runSlice';
import { GetProgramData } from './engine/data/programRegistry';

/*
 * One seed, so the offer, the graph and the opening hand are the same every run. The engine never
 * reads the clock or `Math.random` itself; `rollSeed` is the one place the UI does, at Begin run.
 */
vi.mock('./engine/core/SeedStream', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./engine/core/SeedStream')>()),
    rollSeed: () => 'ticket-58-interaction',
}));

/** The starter cards are `motion.div`s, not buttons, so they are found by their test id. */
async function pickStarter(host: HTMLElement, name: string): Promise<void> {
    // TICKET 182d: a new save plays the intro first; these tests walk the ordinary loop, so they
    // tick "Skip intro" before choosing (App.intro.test.tsx walks the intro itself).
    const skip = findText(host, 'Skip intro', 'label').querySelector<HTMLInputElement>('input')!;
    if (!skip.checked) await click(skip);
    // TICKET 172: the card no longer prints a "starter card"; it is found by its test id.
    const card = host.querySelector<HTMLElement>(`[data-testid="starter-${name.toLowerCase()}"]`);
    if (!card) throw new Error(`no starter card for ${name}`);
    await click(card);
}

async function assembleFirstBlueprint(host: HTMLElement): Promise<void> {
    // TICKET 182a (R3): the starter is built on its v1 firmware at once, with no firmware modal.
    await clickText(host, 'Summon (1 trace)');
}

async function beginRunWithFirstOffer(host: HTMLElement): Promise<void> {
    await clickText(host, 'Expedition');
    await click(host.querySelector('.ranch-offer')!);
    // TICKET 182b: one Mingming on the roster is the party - there is no picker to click.
    await clickText(host, 'Start run');
}

/** Biome 0's layer 1 is always a fight (ticket 24), so the first travel button is a battle. */
async function enterFirstNode(host: HTMLElement): Promise<void> {
    await click(host.querySelector('.rm-travel-button')!);
    await flush();
}

/**
 * Mouse play, as the player does it: click a caster, press on a card, release on the enemy. Plays
 * the first ATTACK in hand that may be aimed at an enemy, and returns its instance id.
 */
async function playAnAttackAtTheEnemy(host: HTMLElement, store: TestStore): Promise<string> {
    const hand = store.getState().battle.battle!.playerDeck.hand;
    const index = hand.findIndex((card) => {
        const data = GetProgramData(card.dataId);
        return data.target !== 'Self' && data.actions.some((a) => a.type === 'ATTACK');
    });
    if (index < 0) throw new Error(`no attack in hand: ${hand.map((c) => c.dataId).join(', ')}`);
    /*
     * THE STAGE SLOTS, NOT THE OLD HUD CARDS. This harness was written against the sidebar
     * columns of `.hud-card`s; ticket 145b turned those off (`SHOW_LEGACY_HUD_COLUMNS = false`,
     * on Henry's ruling that the plaque carries the firmware chip, daemons and preview), so the
     * battle screen draws `BattleStage`'s slots and `querySelector('.hud-card')` is null.
     *
     * `.stage-slot-ally` / `.stage-slot-enemy` are ticket 145 §3's published interface - the same
     * anchors ticket 146 fires particles at - so they are the stable thing to click, and a future
     * chassis change has to keep them.
     */
    await click(host.querySelector('.stage-slot-ally')!);
    await fire(host.querySelectorAll('.hand-card')[index], 'pointerdown');
    expect(store.getState().battle.selectedCardId).toBe(hand[index].id);
    await fire(host.querySelector('.stage-slot-enemy')!, 'pointerup');
    await flush();
    return hand[index].id;
}

/** A fresh save walked to the region map. */
async function atTheMap(store: TestStore): Promise<HTMLElement> {
    const host = await mountApp(store);
    await pickStarter(host, 'KRAKEN');
    await assembleFirstBlueprint(host);
    await beginRunWithFirstOffer(host);
    return host;
}

/** A fresh save walked into its first fight, on the player's turn. */
async function inTheFirstFight(store: TestStore): Promise<HTMLElement> {
    const host = await atTheMap(store);
    await enterFirstNode(host);
    expect(store.getState().battle.battle?.activeSide).toBe('PLAYER');
    return host;
}

describe('the core loop, click by click', () => {
    it('starter picked → the picker is gone and the trace is held', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        expect(host.textContent).toContain('Choose your starter');

        await pickStarter(host, 'KRAKEN');

        expect(store.getState().game.blueprints.kraken).toBe(1);
        expect(host.textContent).not.toContain('Choose your starter');
        expect(host.textContent).toContain('Summon bay');
    });

    it('Trace spent at the Summon bay → the roster gains a member and the trace is gone', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        await pickStarter(host, 'KRAKEN');
        expect(store.getState().game.roster).toHaveLength(0);

        await assembleFirstBlueprint(host);

        const { roster, blueprints } = store.getState().game;
        expect(roster).toHaveLength(1);
        expect(roster[0].definitionId).toBe('kraken');
        expect(blueprints.kraken).toBeUndefined();
        expect(host.textContent).toContain('Summoned');
    });

    it('a gym offer, a party, Begin run → a run exists with the chosen party, on the map', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        await pickStarter(host, 'KRAKEN');
        await assembleFirstBlueprint(host);
        expect(store.getState().run.run).toBeNull();

        await beginRunWithFirstOffer(host);

        const run = store.getState().run.run;
        expect(run).not.toBeNull();
        expect(run!.partyIds).toEqual([store.getState().game.roster[0].id]);
        expect(run!.phase).toBe('map');
        expect(host.querySelector('.rm-travel-button')).not.toBeNull();
    });

    it('a node clicked on the region map → a battle exists and the run is in its encounter', async () => {
        const store = makeStore();
        const host = await atTheMap(store);
        expect(store.getState().battle.battle).toBeNull();

        await enterFirstNode(host);

        const battle = store.getState().battle.battle;
        expect(battle).not.toBeNull();
        expect(battle!.playerParty[0].definitionId).toBe('kraken');
        expect(store.getState().run.run!.phase).toBe('encounter');
        expect(host.querySelector('.battle-screen')).not.toBeNull();
    });

    it('a card played → it leaves the hand and the target loses HP', async () => {
        const store = makeStore();
        const host = await inTheFirstFight(store);
        const enemyBefore = store.getState().battle.battle!.enemyParty[0];
        expect(enemyBefore.currentHp).toBe(enemyBefore.maxHp);

        const played = await playAnAttackAtTheEnemy(host, store);

        const after = store.getState().battle.battle!;
        // Not "the hand is one shorter" — a cantrip draws its replacement. The card that was played
        // is gone, and the hit landed and STAYED (the 2026-08-24 bug animated a hit and kept none).
        expect(after.playerDeck.hand.map((c) => c.id)).not.toContain(played);
        expect(after.enemyParty[0].currentHp).toBeLessThan(enemyBefore.maxHp);
        expect(store.getState().battle.selectedCardId).toBeNull();
    });

    it('END TURN → the enemy acts and the turn comes back to the player', async () => {
        const store = makeStore();
        const host = await inTheFirstFight(store);
        const before = store.getState().battle.battle!;

        vi.useFakeTimers();
        try {
            // TICKET 171h: the opening hand still has Energy to spend, so the first press only
            // nudges (the button flashes, the playable cards light) and the second ends the turn.
            await clickText(host, 'End turn');
            expect(store.getState().battle.battle!.activeSide).toBe('PLAYER');
            expect(store.getState().battle.endTurnNudge?.cardIds.length).toBeGreaterThan(0);
            await clickText(host, 'End turn');
            expect(store.getState().battle.battle!.activeSide).toBe('ENEMY');

            // The AI beats are 1.2 s each and a turn is a handful of them; cap the wait rather than
            // spinning forever if the turn never returns.
            for (let i = 0; i < 40 && store.getState().battle.battle!.activeSide !== 'PLAYER'; i += 1) {
                await act(async () => { await vi.advanceTimersByTimeAsync(300); });
            }
        } finally {
            vi.useRealTimers();
        }

        const after = store.getState().battle.battle!;
        expect(after.activeSide).toBe('PLAYER');
        expect(after.turn).toBe(before.turn + 1);
        // The enemy did something with its turn — the player was hit, or the enemy at least played.
        const playerHp = (b: typeof after) => b.playerParty.reduce((sum, p) => sum + p.currentHp, 0);
        expect(playerHp(after) < playerHp(before) || after.logs.length > before.logs.length).toBe(true);
    });

    it('a fight won → VIEW REWARDS, the report, CONTINUE → the run advances back to the map', async () => {
        const store = makeStore();
        const host = await inTheFirstFight(store);
        // Put the enemy on its last hit point so the next card wins; the loop, not the balance, is
        // what is under test here.
        const live = store.getState().battle.battle!;
        const weakened = { ...live, enemyParty: live.enemyParty.map((enemy) => ({ ...enemy, currentHp: 1 })) };
        await act(async () => { store.dispatch(setBattleState(weakened)); });
        const fightsBefore = store.getState().run.run!.fightsResolved;

        await playAnAttackAtTheEnemy(host, store);
        expect(store.getState().battle.battle!.enemyParty.every((e) => e.currentHp <= 0)).toBe(true);
        await clickText(host, 'VIEW REWARDS');
        await flush();
        for (const skip of [...host.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'SKIP')) {
            await click(skip);
        }
        await clickText(host, 'CONTINUE SYNCHRONIZATION');
        await flush();

        const run = store.getState().run.run!;
        expect(store.getState().battle.battle).toBeNull();
        expect(run.phase).toBe('map');
        expect(run.fightsResolved).toBe(fightsBefore + 1);
        expect(host.querySelector('.rm-travel-button')).not.toBeNull();
    });

    it('an ELITE won → the report shows the Totem the map promised, CONTINUE → the party holds it (ticket 17)', async () => {
        /*
         * The stake is READ off the node, never rolled at the win, so the test plants one on the
         * first reachable node and asks whether it reaches the run. The node kind is changed too:
         * an elite's encounter is built by kind (tuned deck, OS, lite AI) and the claim is that the
         * whole path — node → bundle → report → CONTINUE → `run.drivers` — carries one id through.
         */
        const store = makeStore();
        const host = await atTheMap(store);
        const run = store.getState().run.run!;
        const here = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const first = run.nodes.find((n) => here.edges.includes(n.id))!;
        await act(async () => {
            store.dispatch(setRun({
                ...run,
                nodes: run.nodes.map((n) => (n.id === first.id
                    ? { ...n, kind: 'elite' as const, driverStake: 'driver_first_blood' }
                    : n)),
            }));
        });
        await flush();
        // The map says it before the click: the stake is on the travel button's own label.
        expect(host.querySelector('.rm-travel-button')!.textContent).toContain('stakes: FIRST BLOOD');
        expect(host.querySelector('.rm-node-stake-ring')).not.toBeNull();

        await enterFirstNode(host);
        expect(store.getState().run.run!.drivers).toEqual([]);
        const live = store.getState().battle.battle!;
        const weakened = { ...live, enemyParty: live.enemyParty.map((enemy) => ({ ...enemy, currentHp: 1 })) };
        await act(async () => { store.dispatch(setBattleState(weakened)); });

        await playAnAttackAtTheEnemy(host, store);
        // An elite fields the player's own party size; one hit at 1 HP kills one body. Finish the rest.
        for (let guard = 0; guard < 4 && !store.getState().battle.battle!.enemyParty.every((e) => e.currentHp <= 0); guard += 1) {
            await playAnAttackAtTheEnemy(host, store);
        }
        expect(store.getState().battle.battle!.enemyParty.every((e) => e.currentHp <= 0)).toBe(true);
        await clickText(host, 'VIEW REWARDS');
        await flush();
        expect(host.querySelector('[data-testid="reward-driver"]')!.textContent).toContain('FIRST BLOOD');
        for (const skip of [...host.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'SKIP')) {
            await click(skip);
        }
        await clickText(host, 'CONTINUE SYNCHRONIZATION');
        await flush();

        expect(store.getState().run.run!.drivers).toEqual(['driver_first_blood']);
        expect(store.getState().run.run!.phase).toBe('map');
    });
});
