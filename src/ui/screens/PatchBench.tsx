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
import { getPatch, PATCH_SLOTS } from '../../engine/data/patchRegistry';
import { describePatchOn } from '../../engine/data/patchText';
import { gatePatchChoices, offerablePatchIds, SHOP_STOCK_PATCH } from '../../engine/data/patchRanking';
import { effectiveOS } from '../../engine/run/effectiveOS';
import { shopPrice } from '../../engine/run/modifiers/shopPrice';
import type { IRanchState, IRunState } from '../../engine/runTypes';

/**
 * What the shop charges for a patch. **45 — tuned by ticket 163e, 2026-09-24.**
 *
 * MINE, NOT HENRY'S: 163 §3 says the shop stocks Amplifier and names no price. It was 50, set level
 * with `MARKET_BLUEPRINT_PRICE` and `MARKET_REFRESH_PRICE`, and the note here said the number to
 * tune it from was the take-rate 163e would measure. It has been measured, so here is the number
 * and here is what it is and is not based on.
 *
 * # THE CONDITION, WHICH IS WHAT SETS THE NUMBER
 *
 * A patch is a permanent, run-long rider, **one slot per body and no replacing** (163 §5). That
 * places it exactly between the two things either side of it on the same shelves:
 *
 *   - an **upgrade** is permanent too, but it is ONE CARD — 25–40 by energy (`UPGRADE_PRICE_BY_ENERGY`);
 *   - a **blueprint** is a whole BODY and its five-card engine — 50 (`MARKET_BLUEPRINT_PRICE`).
 *
 * So `upgrade ceiling < patch < blueprint`, which in this economy's fives is **45**. At 50 a patch
 * cost the same as a body, which is the one thing it certainly is not.
 *
 * # WHAT THE TAKE-RATE MEASURED, AND WHY IT DID NOT SET THE PRICE
 *
 * 157's walker, 120 runs per point (`results/t163e/`):
 *
 * | shelf price | upgrades competing for the purse | take-rate |
 * |---|---|---|
 * | 50 | no  | 8 of 46 — **17%** |
 * | 50 | yes | 3 of 47 — **6%**  |
 * | 25 | yes | 9 of 51 — **18%** |
 *
 * Halving the price triples the take-rate, so the shelf is price-sensitive and 50 was above what
 * the run can pay. But the slope also says 45 will read about 8% — barely different from 50 — and
 * **that is not a reason to go lower.** The binding constraint is the PURSE, not the price: 157
 * measured that 100 of 120 runs die in biome 0, having banked one or two fights' scrap. A shelf
 * almost nobody reaches cannot be tuned by its own take-rate without pricing it against a run that
 * does not exist yet.
 *
 * **So: 45 on the ordering condition, and re-measure after the opening-fight ruling 157 asks for.**
 * Pricing to hit a take-rate now would be fitting this number to a brokenness somewhere else.
 */
export const SHOP_PATCH_PRICE = 45;

export interface PatchBenchProps {
    readonly run: IRunState;
    readonly ranch: IRanchState;
    /** The gate offers a CHOICE OF TWO per body, free. The shop stocks Amplifier, for scrap. */
    readonly venue: 'gate' | 'shop';
    /** TICKET 166e: the gate's visit key, e.g. `patch:nodeId:visited`. Ignored by the shop. */
    readonly benchKey?: string;
}

export function PatchBench({ run, ranch, venue, benchKey }: PatchBenchProps): ReactNode {
    const dispatch = useDispatch();
    const byId = new Map(ranch.roster.map((member) => [member.id, member]));

    const free = venue === 'gate';
    const isGateUsed = free && !!benchKey && (run.patchBenchesUsed ?? []).includes(benchKey);

    const rows = run.partyIds
        .map((memberId) => ({ memberId, member: byId.get(memberId) }))
        .filter((row): row is { memberId: string; member: NonNullable<typeof row.member> } => row.member !== undefined)
        // A full slot is not a dead row, it is no row. One per body and no replacing (163 §5), so
        // a greyed-out offer would be a control that can never become live — ticket 20's complaint.
        .filter((row) => (run.patches?.[row.memberId] ?? []).length < PATCH_SLOTS)
        .map((row) => ({
            ...row,
            offers: venue === 'gate'
                ? gatePatchChoices(effectiveOS(run, row.member), run.patches?.[row.memberId] ?? [])
                // 184d: the shop's stock patch is hidden from a body it does nothing for.
                : offerablePatchIds(effectiveOS(run, row.member)).filter((id) => id === SHOP_STOCK_PATCH),
        }));

    // TICKET 169g: Tight Budget raises the shop's price; the gate is free and stays free.
    const patchPrice = shopPrice(run, SHOP_PATCH_PRICE);
    const affordable = free || run.scrap >= patchPrice;

    return (
        <div
            className="rs-panel mk-patch"
            // TICKET 182a: the foot paragraph is a hover on the whole bench.
            title={`A patch rides your firmware - one slot per body, and it stays fitted for the run.${free ? ' Each body is offered the two that change the most about its own OS.' : ''}`}
        >
            <h2>
                {free ? 'Pick a bonus' : 'FIRMWARE PATCH'}
                <span className="mk-sub">({free ? 'choice of two, free' : `${patchPrice} scrap`})</span>
            </h2>
            <div className="mk-rows">
                {isGateUsed ? (
                    <span className="mk-empty">Patch fitted — the gate offers one.</span>
                ) : (
                    <>
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
                                    onClick={() => dispatch(fitPatch({
                                        memberId,
                                        patchId,
                                        price: free ? 0 : patchPrice,
                                        benchKey: free ? benchKey : undefined,
                                    }))}
                                >
                                    <span className="rs-rnm">{member.nickname ?? member.definitionId} · <b>{patch.name}</b></span>
                                    <span className="rs-t">{describePatchOn(effectiveOS(run, member), patchId)}</span>
                                    <span className="rs-sellp">
                                        {free ? 'FREE' : <>−{patchPrice} <Icon name="scrap" size={11} /></>}
                                    </span>
                                </button>
                            );
                        }))}
                        {rows.length === 0 && (
                            <span className="mk-empty">Every body is already running a patch.</span>
                        )}
                    </>
                )}
            </div>

        </div>
    );
}
