import type { BattleAction } from '../../engine/battleReducer';
import type { IBattleState } from '../../engine/types';

/** Main thread → worker. */
export type AiWorkerRequest =
    | { readonly kind: 'ping' }
    | { readonly kind: 'decide'; readonly requestId: number; readonly state: IBattleState };

/** Worker → main thread. */
export type AiWorkerResponse =
    | { readonly kind: 'pong' }
    | { readonly kind: 'decided'; readonly requestId: number; readonly action: BattleAction }
    | { readonly kind: 'failed'; readonly requestId: number; readonly message: string };
