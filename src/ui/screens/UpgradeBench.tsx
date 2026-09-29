/**
 * TICKET 163b — THE UPGRADE BENCH. One component, three venues.
 *
 * 163 §2: *"Where: the workshop (142's static shop), one upgrade per visit, price band 25–40 scrap,
 * and a free upgrade at the gym gate (the rest-site venue)."* Henry ruled on 2026-09-24 that "the
 * workshop" means BOTH stops the code has — the market stall and the workshop node — so the bench
 * has three homes and this is the only place it is written.
 *
 * ONE COMPONENT RATHER THAN THREE SECTIONS, for the same reason `upgradeDeckCard` is one reducer:
 * the venues differ in exactly two facts — what it costs, and what spends the allowance — and
 * everything else about the surface (which cards qualify, what a row says, what the player is told
 * when nothing does) is the same question asked in three rooms. Three copies of it would be three
 * chances for the stall to learn something the gate did not.
 *
 * WHAT IT DOES NOT DECIDE. The reducer refuses an unaffordable, ineligible or already-spent
 * upgrade on its own; the disabled button here is a courtesy to the player, not the enforcement.
 * That is the marketplace suite's standing argument and it matters more here, because a bench
 * rendered in three places would otherwise need the check to be right in three places.
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';

import { ElementMark } from './CardChassis';
import { cardFace, colorFor, groupByData } from './runShell';
import { CardPeek } from './CardPeek';
import { useCardPeek } from '../hooks/useCardPeek';
import { Icon } from '../theme/Icon';
import { upgradeDeckCard } from '../store/runSlice';
import { upgradeIdFor } from '../../engine/data/plusRegistry';
import { upgradePrice } from '../../engine/run/marketplace';
import { shopPrice } from '../../engine/run/modifiers/shopPrice';
import type { IRunState } from '../../engine/runTypes';

export interface UpgradeBenchProps {
    readonly run: IRunState;
    /**
     * `nodeId:visitCount` — which bench's once-per-visit allowance this is. Every shipped venue
     * passes one, the gym gate included: a gym walked back into is a new attempt and a new
     * allowance, which is ticket 07's answer to every other revisit too.
     */
    readonly benchKey?: string;
    /** The gym gate's upgrade is free (163 §2). The only fact a venue is allowed to name. */
    readonly free?: boolean;
    /**
     * TICKET 168c: how many upgrades this bench key may spend. Default 1, which is every venue
     * before the Overclock Rig event (two).
     */
    readonly allowance?: number;
    /** What the venue calls itself in the one-per line. */
    readonly heading: string;
}

export function UpgradeBench({ run, benchKey, free, heading, allowance = 1 }: UpgradeBenchProps): ReactNode {
    const dispatch = useDispatch();
    const { peek, at, peekHandlers } = useCardPeek();

    /*
     * ONE ROW PER UNIQUE CARD — Henry's duplicate amendment, *"one tile per unique card,
     * everywhere"*. The row upgrades the FIRST instance of its stack, which is the right read of a
     * stack of identical copies: they differ only by an id the player cannot see, so "upgrade a
     * Venom Fang" has to mean "one of them" and any of them is the same answer.
     *
     * An already-upgraded copy stacks separately, because its `dataId` is a different card — so a
     * player who has upgraded one of two sees one row offering the upgrade and one that no longer
     * does, which is the truth about their deck.
     */
    const rows = useMemo(
        () => groupByData(run.deck)
            .map((stack) => ({ stack, to: upgradeIdFor(stack.dataId) }))
            .filter((row): row is { stack: typeof row.stack; to: string } => row.to !== undefined),
        [run.deck],
    );

    const used = benchKey === undefined ? 0 : (run.upgradesTaken ?? []).filter((key) => key === benchKey).length;
    const spent = benchKey !== undefined && used >= allowance;

    return (
        <div className="rs-panel mk-upgrade">
            <h2>{heading} <span className="mk-sub">({free === true ? (allowance > 1 ? `free, ${allowance} cards` : 'free, once') : 'one per visit'})</span></h2>
            <div className="mk-rows">
                {rows.map(({ stack, to }) => {
                    const face = cardFace(stack.dataId);
                    const plus = cardFace(to);
                    const price = free === true ? 0 : shopPrice(run, upgradePrice(stack.dataId));
                    const short = price - run.scrap;
                    const blocked = spent || short > 0;
                    return (
                        <div
                            key={stack.dataId}
                            className="rs-wrap"
                            tabIndex={blocked ? 0 : undefined}
                            {...peekHandlers({ face: plus, count: stack.instances.length })}
                        >
                            <button
                                type="button"
                                className="rs-row"
                                style={{ ['--el' as string]: colorFor(face.element) }}
                                disabled={blocked}
                                onClick={() => dispatch(upgradeDeckCard({
                                    instanceId: stack.instances[0].instanceId,
                                    benchKey,
                                    free,
                                    allowance,
                                }))}
                                /*
                                 * TICKET 165a — THE HOVER PEEK.
                                 *
                                 * Henry, 2026-09-26: *"From the screenshot I need to be able to see
                                 * the full card on hover. For the upgrades it should show what my
                                 * upgraded card looks like."*
                                 *
                                 * Supersedes the previous workshop bay rule ("NO CARD DESCRIPTION, not
                                 * even in a title"). The row itself still obeys the one-line row law
                                 * (name and cost only), but hovering or focusing any row — even a
                                 * greyed-out one — reveals the full upgraded card (+ face with changed
                                 * numbers highlighted) beside the MOUSE via `<CardPeek>` (167f: a tooltip drawn
                                 * into <body>, no longer a block under the list).
                                 */
                            >
                                <span className="rs-g">{face.cost}</span>
                                <ElementMark element={face.element} compact />
                                <span className="rs-rnm">{face.name} → <b>{plus.name}</b></span>
                                {stack.instances.length > 1 && <span className="rs-x">×{stack.instances.length}</span>}
                                <span className="rs-sellp">
                                    {price === 0 ? 'FREE' : <>−{price} <Icon name="scrap" size={11} /></>}
                                </span>
                            </button>
                        </div>
                    );
                })}
                {rows.length === 0 && (
                    <span className="mk-empty">
                        Nothing in the deck has an upgrade yet.
                    </span>
                )}
            </div>
            <CardPeek peek={peek} at={at} className="upg-peek" />
            <p className="rs-hint mk-foot">
                {spent
                    ? 'Already used this visit — come back after a fight, or find another bench.'
                    : 'Upgrades replace one copy in your active deck. One rung only; there is no second.'}
            </p>
        </div>
    );
}
