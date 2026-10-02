/**
 * TICKET 168f — what the Firmware Reflash station offers: every party body, the OS it would be
 * switched to, and — for a body that cannot be — why not.
 *
 * The switch is for the run only; `run.osOverrides` holds it and the ranch is never written. The
 * deck does not change either: a body keeps the cards the run built for it.
 *
 * Engine module: no React, no Redux.
 */

import { MingmingRegistry } from '../../data/mingmingRegistry';
import type { EventContext } from './eventContext';
import { partyMembersOf } from './eventContext';

/** Why a body cannot be reflashed here. */
export type ReflashBlock = 'patched' | 'no-other-os' | 'duplicate-build';

/** The words the greyed row prints. */
export const REFLASH_BLOCK_REASON: Readonly<Record<ReflashBlock, string>> = {
    patched: 'A patch is fitted to its firmware.',
    'no-other-os': 'It has no other OS.',
    'duplicate-build': 'Your party already runs that build.',
};

export interface ReflashRow {
    readonly memberId: string;
    readonly definitionId: string;
    /** The OS the body runs now, overrides included. */
    readonly fromOS: string | undefined;
    /** The OS it would switch to; `null` when its species has no other. */
    readonly toOS: string | null;
    readonly blocked: ReflashBlock | null;
}

/** One row per party body, in party order. */
export function reflashRows(ctx: EventContext): ReflashRow[] {
    const party = partyMembersOf(ctx);
    return party.map((member) => {
        const toOS = (MingmingRegistry[member.definitionId]?.availableOS ?? []).find((os) => os !== member.activeOS) ?? null;
        const blocked = reflashBlockFor(ctx, member, toOS, party);
        return { memberId: member.id, definitionId: member.definitionId, fromOS: member.activeOS, toOS, blocked };
    });
}

function reflashBlockFor(
    ctx: EventContext,
    member: { readonly id: string; readonly definitionId: string },
    toOS: string | null,
    party: ReadonlyArray<{ readonly id: string; readonly definitionId: string; readonly activeOS?: string }>,
): ReflashBlock | null {
    if ((ctx.run.patches?.[member.id] ?? []).length > 0) return 'patched';
    if (toOS === null) return 'no-other-os';
    // The duplicate clause (species + firmware) holds after the switch too.
    if (party.some((other) => other.id !== member.id && other.definitionId === member.definitionId && other.activeOS === toOS)) {
        return 'duplicate-build';
    }
    return null;
}

/** The OS this body would be switched to, or `null` when it cannot be reflashed here. */
export function reflashTargetFor(ctx: EventContext, memberId: string): string | null {
    const row = reflashRows(ctx).find((candidate) => candidate.memberId === memberId);
    return row && row.blocked === null ? row.toOS : null;
}

/** Whether any party body can be reflashed right now. */
export function canReflashAny(ctx: EventContext): boolean {
    return reflashRows(ctx).some((row) => row.blocked === null);
}
