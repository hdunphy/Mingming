/**
 * TICKET 190f - THE SPRITE'S REACTION TO A STATUS, sent to its `StageSprite`. Same shape as
 * `choreo/poseSignals`: a module, not a hook, because the sender is a timed action with no React tree
 * to reach through.
 */

import type { ReactionKind } from './spriteReaction';

export interface SpriteReactionSignal {
    readonly targetId: string;
    readonly reaction: ReactionKind;
}

type Listener = (signal: SpriteReactionSignal) => void;
const listeners = new Set<Listener>();

export function onSpriteReaction(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emitSpriteReaction(signal: SpriteReactionSignal): void {
    for (const listener of [...listeners]) listener(signal);
}
