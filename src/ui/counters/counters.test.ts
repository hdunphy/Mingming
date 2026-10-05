/**
 * TICKET 184c — the counter pips.
 *
 * Henry, 2026-10-01: *"jorm draw on 5th water card needs a counter next to his OS. Any other OS
 * that have a counter or something should have visual feedback."* Ruled: all of them, this ticket.
 *
 * The integration tests play REAL cards through the reducer and read the pip after each, so a pip
 * reading a different key from the one the hook writes fails here rather than showing a frozen 0/5.
 */

import { describe, expect, it } from 'vitest';

import HOOKS_DATA from '../../engine/data/lib/hooks.json';
import { battleReducer } from '../../engine/battleReducer';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';
import { DAEMON_COUNTERS, DRIVER_COUNTERS, FIRMWARE_COUNTERS } from './counterDisplays';
import { readDaemonCounter, readDriverCounter, readFirmwareCounter } from './readCounter';

// ─── helpers ─────────────────────────────────────────────────────────────────────────────────────

function arena(opts: { os: string; patches?: string[]; drivers?: string[] }): IBattleState {
    const species = opts.os.replace(/_v\d$/, '');
    const setup = matchupScenario({ player: species, enemy: 'kraken', playerOS: opts.os, enemyOS: 'kraken_v2', seed: 'counters-184c' });
    const state = buildScenarioState({
        ...setup,
        seed: setup.seed,
        player: { ...setup.player, drivers: opts.drivers ?? [] },
    }) as IBattleState;
    return {
        ...state,
        activeSide: 'PLAYER',
        playerParty: state.playerParty.map((e, i) => (i === 0
            ? { ...e, currentEnergy: 50, maxEnergy: 50, patches: opts.patches ?? [] }
            : e)),
    } as IBattleState;
}

let nextId = 0;
/** Put one named card in the player's hand and play it, the way a click does. */
function play(state: IBattleState, dataId: string): IBattleState {
    const card: ProgramEntity = { id: `t184c_${nextId++}`, dataId, currentCost: 0, isPlayable: true };
    const armed = {
        ...state,
        playerDeck: { ...state.playerDeck, hand: [...state.playerDeck.hand, card] },
        playerParty: state.playerParty.map((e, i) => (i === 0 ? { ...e, currentEnergy: 50 } : e)),
    } as IBattleState;
    return battleReducer(armed, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: armed.playerParty[0].id, programId: card.id, targetId: armed.enemyParty[0].id },
    } as never) as IBattleState;
}

const firmwarePip = (s: IBattleState) => readFirmwareCounter(s.playerParty[0], s);

// ─── OUROBOROS_LOOP, the one Henry named ─────────────────────────────────────────────────────────

describe('184c - jormungandr_v1 counts its Water cards', () => {
    it('reads 0/5, 1/5 ... 4/5 (lit), then USED after the 5th draws', () => {
        let state = arena({ os: 'jormungandr_v1' });
        expect(firmwarePip(state)).toMatchObject({ text: '0/5', state: 'counting' });
        const seen: string[] = [];
        for (let i = 0; i < 5; i++) {
            state = play(state, 'undertow');
            seen.push(`${firmwarePip(state)!.text}:${firmwarePip(state)!.state}`);
        }
        expect(seen).toEqual(['1/5:counting', '2/5:counting', '3/5:counting', '4/5:ready', 'USED:spent']);
        expect(state.logs.some((l) => l.includes('OUROBOROS_LOOP triggers'))).toBe(true);
        expect(firmwarePip(state)!.tooltip).toContain('back next turn');
    });

    it('does not count a non-Water card', () => {
        const state = play(arena({ os: 'jormungandr_v1' }), 'tackle');
        expect(firmwarePip(state)!.text).toBe('0/5');
    });

    it('with REPEATER it draws on the 3rd and the 5th Water card, and the pip walks both (Henry, 184d)', () => {
        let state = arena({ os: 'jormungandr_v1', patches: ['repeater'] });
        const seen: string[] = [];
        for (let i = 0; i < 6; i++) {
            state = play(state, 'undertow');
            seen.push(firmwarePip(state)!.text);
        }
        expect(seen).toEqual(['1/3', '2/3', '3/5', '4/5', 'USED', 'USED']);
        expect(state.logs.filter((l) => l.includes('OUROBOROS_LOOP triggers')).length).toBe(2);
    });

    it('with SPLITTER any card counts, and the words say so', () => {
        let state = arena({ os: 'jormungandr_v1', patches: ['splitter'] });
        state = play(state, 'tackle');
        expect(firmwarePip(state)!.text).toBe('1/5');
        expect(firmwarePip(state)!.tooltip).toBe('Cards this turn: 1 of 5. Card 5 draws a card.');
    });

    it('with AMPLIFIER the words say it draws 2', () => {
        expect(firmwarePip(arena({ os: 'jormungandr_v1', patches: ['amplifier'] }))!.tooltip)
            .toBe('Water cards this turn: 0 of 5. Water card 5 draws 2 cards.');
    });

    it('the hover sentence says what the count is for', () => {
        expect(firmwarePip(arena({ os: 'jormungandr_v1' }))!.tooltip)
            .toBe('Water cards this turn: 0 of 5. Water card 5 draws a card.');
    });
});

// ─── the rest of the launch firmware ─────────────────────────────────────────────────────────────

describe('184c - the other launch firmware', () => {
    it('huldra_v2 is ARMED until her first turn ends, then the pip is gone', () => {
        const state = arena({ os: 'huldra_v2' });
        expect(firmwarePip(state)).toMatchObject({ text: 'ARMED', state: 'armed' });
        const fired = { ...state, counters: { ...state.counters, [`huldra_shield_init:${state.playerParty[0].id}`]: 1 } };
        expect(firmwarePip(fired)).toBeNull();
    });

    it('194a - the huldra_v2 pip names the turn her wall goes up, for each side', () => {
        const player = firmwarePip(arena({ os: 'huldra_v2' }))!;
        expect(player.tooltip).toContain('when your first turn ends');
        const base = arena({ os: 'huldra_v2' });
        // The same body on the enemy side: the words must not promise the player's end-turn.
        const enemySide = { ...base, playerParty: [], enemyParty: base.playerParty } as IBattleState;
        const enemyPip = readFirmwareCounter(enemySide.enemyParty[0], enemySide)!;
        expect(enemyPip.tooltip).toContain('end of the enemy');
    });

    it('fenrir_v1 shows his live Fire bonus, and nothing at full HP', () => {
        const state = arena({ os: 'fenrir_v1' });
        expect(firmwarePip(state)).toBeNull();
        const hurt = {
            ...state,
            playerParty: state.playerParty.map((e, i) => (i === 0 ? { ...e, currentHp: Math.floor(e.maxHp / 2) } : e)),
        } as IBattleState;
        const pip = firmwarePip(hurt)!;
        expect(pip.state).toBe('live');
        expect(pip.text).toMatch(/^\+2[45]%$/);
        expect(pip.tooltip).toContain('up to 50%');
    });

    it('the nine event-driven launch firmware have no pip', () => {
        for (const os of ['fenrir_v2', 'skoll_v1', 'skoll_v2', 'kraken_v1', 'kraken_v2', 'jormungandr_v2', 'huldra_v1', 'ratatoskr_v1', 'ratatoskr_v2']) {
            expect(FIRMWARE_COUNTERS[os], os).toBeUndefined();
        }
    });
});

// ─── Drivers ─────────────────────────────────────────────────────────────────────────────────────

describe('184c - Drivers', () => {
    it('TIDAL SURGE counts every card the side plays toward 10', () => {
        let state = arena({ os: 'kraken_v2', drivers: ['driver_tidal_surge'] });
        expect(readDriverCounter('driver_tidal_surge', state)).toMatchObject({ text: '0/10', state: 'counting' });
        for (let i = 0; i < 3; i++) state = play(state, 'tackle');
        expect(readDriverCounter('driver_tidal_surge', state)!.text).toBe('3/10');
    });

    it('TENTH STRIKE counts attack cards only', () => {
        let state = arena({ os: 'kraken_v2', drivers: ['driver_tenth_strike'] });
        state = play(state, 'tackle');
        state = play(state, 'undertow');
        expect(readDriverCounter('driver_tenth_strike', state)!.text).toBe('1/10');
    });

    it('FIRST BLOOD is READY until the first attack of the turn, then USED', () => {
        let state = arena({ os: 'kraken_v2', drivers: ['driver_first_blood'] });
        expect(readDriverCounter('driver_first_blood', state)).toMatchObject({ text: 'READY', state: 'ready' });
        state = play(state, 'tackle');
        expect(readDriverCounter('driver_first_blood', state)).toMatchObject({ text: 'USED', state: 'spent' });
    });

    it('DEEP CACHE is READY until the first bonus draw of the turn', () => {
        let state = arena({ os: 'kraken_v2', drivers: ['driver_deep_cache'] });
        expect(readDriverCounter('driver_deep_cache', state)!.text).toBe('READY');
        state = play(state, 'undertow');
        expect(readDriverCounter('driver_deep_cache', state)!.text).toBe('USED');
    });

    it('BULWARK REFLEX counts the members still armed', () => {
        const state = arena({ os: 'kraken_v2', drivers: ['driver_bulwark_reflex'] });
        expect(readDriverCounter('driver_bulwark_reflex', state)!.text).toBe('1 ARMED');
        const spent = { ...state, counters: { ...state.counters, [`bulwark_reflex:${state.playerParty[0].id}`]: 1 } };
        expect(readDriverCounter('driver_bulwark_reflex', spent)).toBeNull();
    });
});

// ─── Daemons ─────────────────────────────────────────────────────────────────────────────────────

describe('184c - daemons', () => {
    const host = createSparseEntity({ id: 'p1', name: 'Host' });
    const withCounters = (counters: Record<string, number>): IBattleState =>
        createSparseBattleState({ playerParty: [host], enemyParty: [createSparseEntity({ id: 'e1' })], counters });

    it('REACTIVE PLATING shows how much of its 3 a turn is left', () => {
        expect(readDaemonCounter(host, 'reactive_plating', withCounters({}))!.text).toBe('3 LEFT');
        expect(readDaemonCounter(host, 'reactive_plating', withCounters({ 'reactive_plating_grants@PLAYER': 2 }))!.text).toBe('1 LEFT');
        expect(readDaemonCounter(host, 'reactive_plating', withCounters({ 'reactive_plating_grants@PLAYER': 3 }))!.text).toBe('USED');
        expect(readDaemonCounter(host, 'reactive_plating+', withCounters({}))!.text).toBe('5 LEFT');
    });

    it('ECHO CHAMBER+ shows its once-a-turn double token', () => {
        expect(readDaemonCounter(host, 'echo_chamber+', withCounters({}))!.text).toBe('READY');
        expect(readDaemonCounter(host, 'echo_chamber+', withCounters({ 'echo_chamber_plus_encore:p1': 1 }))!.text).toBe('USED');
    });

    it('a daemon with nothing to count has no pip', () => {
        expect(readDaemonCounter(host, 'feedback_loop', withCounters({}))).toBeNull();
    });
});

// ─── post-launch firmware ────────────────────────────────────────────────────────────────────────

describe('184c - post-launch firmware (same pip, so enemies running them show it)', () => {
    const body = (os: string, extra: Partial<IBattleEntity> = {}) => createSparseEntity({ id: 'p1', name: 'Body', activeOS: os, ...extra });
    const stateOf = (b: IBattleEntity, counters: Record<string, number> = {}) =>
        createSparseBattleState({ playerParty: [b], enemyParty: [createSparseEntity({ id: 'e1' })], counters });

    it('audhumbla_v1: READY / USED once a turn', () => {
        const b = body('audhumbla_v1');
        expect(readFirmwareCounter(b, stateOf(b))!.text).toBe('READY');
        expect(readFirmwareCounter(b, stateOf(b, { 'audhumbla_genesis_used:p1': 1 }))!.text).toBe('USED');
    });

    it('hraesvelgr_v2: shuffles toward 2, gone once it has paid', () => {
        const b = body('hraesvelgr_v2');
        expect(readFirmwareCounter(b, stateOf(b, { deck_shuffles: 1 }))).toMatchObject({ text: '1/2', state: 'ready' });
        expect(readFirmwareCounter(b, stateOf(b, { deck_shuffles: 2, 'hraesvelgr_max_energy:p1': 1 }))).toBeNull();
    });

    it('hel_v2: HP spent this turn of her 25%', () => {
        const b = body('hel_v2');
        expect(readFirmwareCounter(b, stateOf(b, { 'hel_blood_spent:p1': 10 }))).toMatchObject({ text: '10/25%', state: 'counting' });
        expect(readFirmwareCounter(b, stateOf(b, { 'hel_blood_spent:p1': 25 }))!.state).toBe('spent');
    });

    it('fafnir_v1: the hoard, only while there is one', () => {
        const b = body('fafnir_v1');
        expect(readFirmwareCounter(b, stateOf(b))).toBeNull();
        expect(readFirmwareCounter(b, stateOf(b, { 'fafnir_hoard:p1': 2 }))!.text).toBe('HOARD 2');
    });
});

// ─── coverage: a new counter cannot be missed ────────────────────────────────────────────────────

/**
 * Every hooks.json entry that keeps a COUNTER either has a pip or is named here with the reason it
 * has none. A new Driver, daemon or firmware with a counter fails this until someone decides.
 */
const NO_PIP: Record<string, string> = {
    driver_frayed_signal: 'fires at the start of the first turn, before the player can act',
    driver_static_haze: 'fires at the start of the first turn, before the player can act',
    driver_root_rot: 'its counter is a re-entry guard, not a number the player plays toward',
};

describe('184c - coverage', () => {
    it('every hooks.json entry with a COUNTER has a pip or a stated reason', () => {
        const library = HOOKS_DATA as unknown as Record<string, { hooks?: Array<{ do?: Array<{ type?: string }> }> }>;
        const declared = new Set([...Object.keys(FIRMWARE_COUNTERS), ...Object.keys(DRIVER_COUNTERS), ...Object.keys(DAEMON_COUNTERS)]);
        const missing = Object.entries(library)
            .filter(([, entry]) => (entry.hooks ?? []).some((h) => (h.do ?? []).some((a) => a.type === 'COUNTER')))
            .map(([id]) => id)
            .filter((id) => !declared.has(id) && !(id in NO_PIP));
        expect(missing).toEqual([]);
    });

    it('every data-driven declaration finds its gate in a fresh battle (no silently blank pips)', () => {
        const b = createSparseEntity({ id: 'p1', name: 'Body' });
        const fresh = createSparseBattleState({ playerParty: [b], enemyParty: [createSparseEntity({ id: 'e1' })], counters: {} });
        for (const id of Object.keys(DRIVER_COUNTERS)) expect(readDriverCounter(id, fresh), id).not.toBeNull();
        for (const id of Object.keys(DAEMON_COUNTERS)) expect(readDaemonCounter(b, id, fresh), id).not.toBeNull();
    });
});
