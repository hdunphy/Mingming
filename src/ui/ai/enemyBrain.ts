import { getBestAction } from '../../engine/ai/TacticalAI';
import type { BattleAction } from '../../engine/battleReducer';
import type { IBattleState } from '../../engine/types';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';

/** The part of a Worker this module uses. A test passes a fake with the same shape. */
export interface AiWorkerLike {
    onmessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null;
    onerror: ((event: Event) => void) | null;
    postMessage(message: AiWorkerRequest): void;
    terminate(): void;
}

export type AiWorkerFactory = () => AiWorkerLike | null;

/** How long to wait for the worker's first `pong` before thinking on the main thread instead. */
export const WORKER_READY_TIMEOUT_MS = 1000;

export interface EnemyBrain {
    /** Resolves with the same action `getBestAction(state)` would return. */
    decide(state: IBattleState): Promise<BattleAction>;
    /** Stops the worker. Any decision still pending never settles; its caller has been cancelled. */
    dispose(): void;
}

export function defaultAiWorkerFactory(): AiWorkerLike | null {
    if (typeof Worker === 'undefined') return null; // jsdom, vitest, very old browsers
    try {
        return new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' }) as unknown as AiWorkerLike;
    } catch (error) {
        console.warn('[ai] worker unavailable; the enemy will think on the main thread', error);
        return null;
    }
}

export function createEnemyBrain(factory: AiWorkerFactory = defaultAiWorkerFactory): EnemyBrain {
    const worker = factory();
    const onMainThread: EnemyBrain = {
        decide: (state) => Promise.resolve(getBestAction(state)),
        dispose: () => undefined,
    };
    if (!worker) return onMainThread;

    let status: 'pending' | 'ready' | 'broken' | 'disposed' = 'pending';
    let nextRequestId = 1;
    const waiting = new Map<number, (action: BattleAction | null) => void>();
    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => { markReady = resolve; });

    worker.onmessage = (event) => {
        const message = event.data;
        if (message.kind === 'pong') {
            if (status === 'pending') status = 'ready';
            markReady();
            return;
        }
        const settle = waiting.get(message.requestId);
        if (!settle) return;
        waiting.delete(message.requestId);
        settle(message.kind === 'decided' ? message.action : null);
    };

    worker.onerror = (event) => {
        event.preventDefault?.();
        console.warn('[ai] worker failed; the enemy will think on the main thread from now on', event);
        status = 'broken';
        markReady();
        for (const settle of waiting.values()) settle(null);
        waiting.clear();
    };

    worker.postMessage({ kind: 'ping' });

    return {
        async decide(state) {
            if (status === 'pending') {
                await Promise.race([ready, new Promise((r) => setTimeout(r, WORKER_READY_TIMEOUT_MS))]);
            }
            if (status !== 'ready') return getBestAction(state);
            const requestId = nextRequestId++;
            const action = await new Promise<BattleAction | null>((resolve) => {
                waiting.set(requestId, resolve);
                worker.postMessage({ kind: 'decide', requestId, state });
            });
            // `null` means the worker failed on this state. Think here instead, which is exactly
            // what the game did before this row - including throwing, if the engine throws.
            return action ?? getBestAction(state);
        },
        dispose() {
            status = 'disposed';
            waiting.clear();
            worker.terminate();
        },
    };
}
