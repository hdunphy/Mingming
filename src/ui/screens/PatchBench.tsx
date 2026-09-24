/**
 * TICKET 163d — **THE PATCH OFFER**, at the gym gate and in the shop.
 *
 * 163 §3's "where", minus the elite (which pays through the reward screen, where every other fight
 * prize is claimed): *"the gym gate offers a choice of two; the shop stocks Amplifier."*
 *
 * One component for both, the way `UpgradeBench` is one component for three venues, and the two
 * differ in exactly what the ticket says they differ in: WHICH riders are on offer, and whether
 * they cost anything. Everything else — one row per body that can still take one, the slot that
 * closes when it is full, the sentence when nobody can — is the same surface.
 *
 * WHY A ROW PER BODY RATHER THAN A ROW PER PATCH. A patch is fitted to a FIRMWARE, and the same
 * rider is a gift on one body and a no-op on another (`patchTouchCount` is the measure, and
 * `bestPatchFor` is what keeps a dead offer off the shelf). So the player's decision is *which
 * Mingming*, and the screen asks it that way. Offering six ids and making the player work out who
 * they fit is the shape 163 §3 rejected when it rejected the twelve-times-six table.
 */
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { Icon } from '../theme/Icon';
import { fitPatch } from '../store/runSlice';
import { getPatch, gatePatchChoices, PATCH_SLOTS, SHOP_STOCK_PATCH } from '../../engine/data/patchRegistry';
import { rawFirmwareHooks } from '../../engine/data/firmwareRegistry';
import type { IRanchState, IRunState } from '../../engine/runTypes';

/**
 * What the shop charges for a patch.
 *
 * MINE, NOT HENRY'S — 163 §3 says the shop stocks Amplifier and names no price. Set level with
 * `MARKET_BLUEPRINT_PRICE` and `MARKET_REFRESH_PRICE` (both 50), which is the rung this shelf
 * already uses for "a thing that changes the run rather than the deck". `PATCH_TAKEN` records
 * nothing about price, so the number to tune it from is the take-rate 163e measures.
 */
export const SHOP_PATCH_PRICE = 50;

export interface PatchBenchProps {
    readonly run: IRunState;
    readonly ranch: IRanchState;
    /** The gate offers a CHOICE OF TWO per body, free. The shop stocks Amplifier, for scrap. */
    readonly venue: 'gate' | 'shop';
}

export function PatchBench({ run, ranch, venue }: PatchBenchProps): ReactNode {
    const dispatch = useDispatch();
    const byId = new Map(ranch.roster.map((member) => [member.id, member]));

    const rows = run.partyIds
        .map((memberId) => ({ memberId, member: byId.get(memberId) }))
        .filter((row): row is { memberId: string; member: NonNullable<typeof row.member> } => row.member !== undefined)
        // A full slot is not a dead row, it is no row. One per body and no replacing (163 §5), so
        // a greyed-out offer would be a control that can never become live — ticket 20's complaint.
        .filter((row) => (run.patches?.[row.memberId] ?? []).length < PATCH_SLOTS)
        .map((row) => ({
            ...row,
            offers: venue === 'gate'
                ? gatePatchChoices(rawFirmwareHooks(row.member.activeOS), run.patches?.[row.memberId] ?? [])
                : [SHOP_STOCK_PATCH],
        }));

    const free = venue === 'gate';
    const affordable = free || run.scrap >= SHOP_PATCH_PRICE;

    return (
        <div className="rs-panel mk-patch">
            <h2>
                {free ? 'THE GATE — A PATCH FOR ONE BODY' : 'FIRMWARE PATCH'}
                <span className="mk-sub">({free ? 'choice of two, free' : `${SHOP_PATCH_PRICE} scrap`})</span>
            </h2>
            <div className="mk-rows">
                {rows.map(({ memberId, member, offers }) => offers.map((patchId) => {
                    const patch = getPatch(patchId);
                    if (!patch) return null;
                    return (
                        <button
                            key={`${memberId}:${patchId}`}
                            type="button"
                            className="rs-row"
                            disabled={!affordable}
                            // The price rides the action: the reducer charges and fits in one
                            // step, so an unaffordable click cannot half-happen.
                            onClick={() => dispatch(fitPatch({ memberId, patchId, price: free ? 0 : SHOP_PATCH_PRICE }))}
                        >
                            <span className="rs-rnm">{member.nickname ?? member.definitionId} · <b>{patch.name}</b></span>
                            <span className="rs-t">{patch.text}</span>
                            <span className="rs-sellp">
                                {free ? 'FREE' : <>−{SHOP_PATCH_PRICE} <Icon name="scrap" size={11} /></>}
                            </span>
                        </button>
                    );
                }))}
                {rows.length === 0 && (
                    <span className="mk-empty">Every body is already running a patch.</span>
                )}
            </div>
            <p className="rs-hint mk-foot">
                A patch rides your firmware — one slot per body, and it stays fitted for the run.
                {free && ' Each body is offered the two that change the most about its own OS.'}
            </p>
        </div>
    );
}
