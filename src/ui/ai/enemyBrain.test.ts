import { describe, it, expect, vi } from 'vitest';
import { createEnemyBrain, WORKER_READY_TIMEOUT_MS, type AiWorkerLike } from './enemyBrain';
import * as workerCore from './aiWorkerCore';
import { answerAiRequest } from './aiWorkerCore';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { battleReducer } from '../../engine/battleReducer';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { rollGauntletFight } from '../../engine/run/gauntlet';
import { RUN_ENEMY_MODE } from '../../engine/run/encounter';
import { BALANCE_IV, BALANCE_STAT_JITTER } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleState } from '../../engine/types';

function createTestBattleState(): IBattleState {
    const PARTY: Array<[string, string]> = [['fenrir', 'fenrir_v2'], ['skoll', 'skoll_v2'], ['huldra', 'huldra_v1']];
    const party = PARTY.map(([sp, os], i) => ({
        id: `mm${i}`,
        definitionId: sp,
        activeOS: os,
        blueprintsCollected: 0,
        attackIV: BALANCE_IV,
        defenseIV: BALANCE_IV,
        hpIV: BALANCE_IV,
    }));
    const offer = offerGyms('probe:gyms').find((o) => o.gym.id === 'gym_rootfall')!;
    const run = createRun({ seed: 'probe:rootfall', offer, party, startedAt: 1 });
    const node = run.nodes.find((n) => n.kind === 'gym')!;
    const enc = rollGauntletFight({ run, node, fightIndex: 0 });
    const state = buildScenarioState({
        seed: 'probe:0',
        enemyMode: RUN_ENEMY_MODE,
        player: {
            party: party.map((m) => ({
                definitionId: m.definitionId,
                activeOS: m.activeOS,
                attackIV: m.attackIV,
                defenseIV: m.defenseIV,
                hpIV: m.hpIV,
            })),
            deck: run.deck.map((c) => c.dataId),
            drivers: [],
        },
        enemies: enc.enemyParty.map((e, i) => ({
            definitionId: e.definitionId,
            activeOS: e.activeOS ?? 'run-gate:no-firmware',
            attackIV: e.attackIV ?? BALANCE_IV,
            defenseIV: e.defenseIV ?? BALANCE_IV,
            hpIV: e.hpIV ?? BALANCE_IV,
            deck: i === 0 ? [...enc.enemyDeckIds] : [],
        })),
        ...(enc.enemyDrivers && enc.enemyDrivers.length > 0 ? { enemyDrivers: [...enc.enemyDrivers] } : {}),
        statJitter: BALANCE_STAT_JITTER,
    });
    return { ...state, activeSide: 'ENEMY', aiBeam: 8 };
}

describe('166a — enemyBrain and AI Web Worker', () => {
    it('1. Same decision through the worker\'s code path for at least three consecutive decisions', () => {
        let state = createTestBattleState();
        for (let i = 1; i <= 3; i++) {
            const expectedAction = getBestAction(state);
            const response = answerAiRequest({
                kind: 'decide',
                requestId: i,
                state: structuredClone(state),
            });
            expect(response).toEqual({
                kind: 'decided',
                requestId: i,
                action: expectedAction,
            });
            state = battleReducer(state, expectedAction);
        }
    });

    it('2. Falls back when there is no Worker', async () => {
        const state = createTestBattleState();
        const brain = createEnemyBrain(() => null);
        const action = await brain.decide(state);
        expect(action).toEqual(getBestAction(state));
    });

    it('3. Uses the worker once it has answered the ping', async () => {
        const state = createTestBattleState();
        const spy = vi.spyOn(workerCore, 'answerAiRequest');
        let workerOnMessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null = null;

        const fakeWorker: AiWorkerLike = {
            set onmessage(fn) {
                workerOnMessage = fn;
            },
            get onmessage() {
                return workerOnMessage;
            },
            onerror: null,
            postMessage: (req: AiWorkerRequest) => {
                queueMicrotask(() => {
                    const res = workerCore.answerAiRequest(req);
                    workerOnMessage?.({ data: res } as MessageEvent<AiWorkerResponse>);
                });
            },
            terminate: vi.fn(),
        };

        const brain = createEnemyBrain(() => fakeWorker);
        const action = await brain.decide(state);
        expect(action).toEqual(getBestAction(state));
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ kind: 'decide', state }));
        spy.mockRestore();
    });

    it('4. Falls back when the worker errors', async () => {
        const state = createTestBattleState();
        let workerOnMessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null = null;
        let workerOnError: ((event: Event) => void) | null = null;
        const postMessageSpy = vi.fn();

        const fakeWorker: AiWorkerLike = {
            set onmessage(fn) {
                workerOnMessage = fn;
            },
            get onmessage() {
                return workerOnMessage;
            },
            set onerror(fn) {
                workerOnError = fn;
            },
            get onerror() {
                return workerOnError;
            },
            postMessage: (req: AiWorkerRequest) => {
                postMessageSpy(req);
                if (req.kind === 'ping') {
                    queueMicrotask(() => {
                        workerOnMessage?.({ data: { kind: 'pong' } } as MessageEvent<AiWorkerResponse>);
                    });
                } else if (req.kind === 'decide') {
                    queueMicrotask(() => {
                        workerOnError?.(new Event('error'));
                    });
                }
            },
            terminate: vi.fn(),
        };

        const brain = createEnemyBrain(() => fakeWorker);
        const action1 = await brain.decide(state);
        expect(action1).toEqual(getBestAction(state));

        postMessageSpy.mockClear();
        const action2 = await brain.decide(state);
        expect(action2).toEqual(getBestAction(state));
        expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('5. Falls back when the worker never answers the ping', async () => {
        vi.useFakeTimers();
        try {
            const state = createTestBattleState();
            const fakeWorker: AiWorkerLike = {
                onmessage: null,
                onerror: null,
                postMessage: vi.fn(),
                terminate: vi.fn(),
            };

            const brain = createEnemyBrain(() => fakeWorker);
            const decidePromise = brain.decide(state);

            await vi.advanceTimersByTimeAsync(WORKER_READY_TIMEOUT_MS);
            const action = await decidePromise;
            expect(action).toEqual(getBestAction(state));
        } finally {
            vi.useRealTimers();
        }
    });

    it('6. dispose terminates the worker', () => {
        const terminateSpy = vi.fn();
        const fakeWorker: AiWorkerLike = {
            onmessage: null,
            onerror: null,
            postMessage: vi.fn(),
            terminate: terminateSpy,
        };

        const brain = createEnemyBrain(() => fakeWorker);
        brain.dispose();
        expect(terminateSpy).toHaveBeenCalledTimes(1);
    });
});
