/**
 * TICKET 168f — **which firmware is this body running, in this run?**
 *
 * One answer for every run-time read of a party member's OS. The ranch member's `activeOS` is the
 * firmware it carries between runs; an event (Firmware Reflash) can switch it for THIS run only, and
 * that switch lives in `run.osOverrides` so the ranch is never written. Anything that shows or uses
 * a party member's firmware during a run reads it through here, so the fight, the shop, the patch
 * bench and the party screens cannot disagree about it.
 *
 * Not for the ranch: the ranch screen, the workshop's permanent reflash and run start read the
 * roster member's own `activeOS`, because there the run does not exist yet or is not the subject.
 *
 * Engine module: no React, no Redux.
 */

import type { IRunState } from '../runTypes';

type RunOverrides = Pick<IRunState, 'osOverrides'>;

/** The firmware the run has this body on: the run's override, else the member's own. */
export function effectiveOS(run: RunOverrides, member: { readonly id: string; readonly activeOS: string }): string;
export function effectiveOS(run: RunOverrides, member: { readonly id: string; readonly activeOS?: string }): string | undefined;
export function effectiveOS(run: RunOverrides, member: { readonly id: string; readonly activeOS?: string }): string | undefined {
    return run.osOverrides?.[member.id] ?? member.activeOS;
}

/** The member with its `activeOS` replaced by the effective one. Returns the same object when nothing changes. */
export function withEffectiveOS<T extends { readonly id: string; readonly activeOS?: string }>(run: RunOverrides, member: T): T {
    const os = effectiveOS(run, member);
    return os === member.activeOS ? member : { ...member, activeOS: os };
}
