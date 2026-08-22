/**
 * The workshop — ticket 14 (steam-release map).
 *
 * # WHAT THE PLAYER IS LOOKING AT
 *
 * The one place a run's party grows. Three sections over two currencies: **assemble** a blueprint
 * plus scrap into a new party member, **reflash** a member's firmware for a blueprint plus scrap,
 * and **strip** a card out of the run deck for scrap — Henry's 2026-08-21 amendment, priced at
 * ticket 13's `REMOVAL_PRICE` so there is one sink at one price wherever you buy it.
 *
 * Everything about *what things cost* and *what can legally be built* lives in
 * `engine/run/workshop.ts`. This file renders it and dispatches, the same split `MarketplaceNode`
 * keeps with `engine/run/marketplace.ts`, and it is why the prices can be ratified without anyone
 * opening a `.tsx` file.
 *
 * # THE FIVE THINGS THIS SCREEN HAS TO SHOW, NOT JUST OBEY
 *
 * 1. **`N/3`, and that this is the only place it moves.** Ticket 06 rules the party grows at a
 *    workshop and nowhere else ("recruiting IS drafting"). A player who does not know that has no
 *    reason to spend scrap here instead of at the shop two nodes away, which is precisely the route
 *    decision the ruling is built around.
 * 2. **Both halves of the price, every time.** A blueprint *and* scrap. The ranch charges only the
 *    first, so a screen that printed one number would look like the ranch and behave differently.
 * 3. **Why a button is dead.** Ticket 20's precedent: a disabled control says what it is short of —
 *    the scrap, the blueprint, the party slot, or the species clause. A silently inert button is
 *    indistinguishable from a bug to whoever is holding the controller.
 * 4. **Scrap, always.** It is the currency every button here competes with the marketplace for.
 * 5. **That the recruit brings four cards.** Ticket 08's ruled recruit kit (3 `startKit` + 1
 *    generic) is the difference between "a body" and "a draft pick", and it is what makes 75 scrap
 *    read as a purchase rather than a toll.
 *
 * # THE ORDER OF THE TWO DISPATCHES IS LOAD-BEARING
 *
 * An assembly writes both slices and no reducer can. `runSlice.recruitIntoParty` carries the full
 * argument; the short version is **the ranch half goes first**, because dying between the two then
 * leaves the player holding an assembled individual on their permanent roster — the ranch
 * transaction, exactly — instead of a run whose party names a member that does not exist, which
 * `reconcileLoadedState` is obliged to throw the whole run away over.
 *
 * `useStore` is here for the one check that follows from that: after the ranch dispatch, this reads
 * the store back and only charges the run **if the ranch actually changed**. That is the single
 * cross-slice guard no reducer can make, made in the only place that can see both halves.
 *
 * # KEYBOARD
 *
 * Every affordance is a real `<button>` — `RegionMap` and `MarketplaceNode` set that precedent, and
 * ticket 38 should inherit screens that already work without a mouse.
 */

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDispatch, useStore } from 'react-redux';

import { GetMingmingData, GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { PARTY_SIZE } from '../../engine/party';
import {
    WORKSHOP_ASSEMBLY_SCRAP,
    WORKSHOP_REFLASH_SCRAP,
    WORKSHOP_REMOVAL_PRICE,
    planRecruit,
    reflashBlockFor,
    reflashOptionsFor,
    workshopSpecies,
    type WorkshopBlock,
} from '../../engine/run/workshop';
import { numericBaseCost } from '../../engine/types';
import type { IRanchMember, IRanchState, IRegionNode, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { assembleMingming, swapOS } from '../store/gameSlice';
import { recruitIntoParty, removeRunCardForScrap, spendRunScrap } from '../store/runSlice';
import type { RootState } from '../store/store';
import './WorkshopNode.css';

/** What the OS picker is open for. `null` is the ordinary state — no modal. */
export type WorkshopPending =
    | { readonly kind: 'assemble'; readonly speciesId: string; readonly osId: string }
    | { readonly kind: 'reflash'; readonly memberId: string; readonly osId: string };

export interface WorkshopNodeProps {
    readonly run: IRunState;
    /** The workshop being stood in, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** The ranch — this screen spends blueprints and writes the roster, so it needs both. */
    readonly ranch: IRanchState;
    /**
     * Opens the firmware picker straight away. A prop rather than click-only state for
     * `RanchScreen`'s reason: `renderToStaticMarkup` cannot click, and the picker is where the price
     * is confirmed, so it has to be renderable in a test.
     */
    readonly initialPending?: WorkshopPending;
}

/** Why an assembly row is refused, in the player's words rather than the type's. */
function blockLabel(block: WorkshopBlock): string {
    switch (block) {
        case 'no-blueprint':
            return 'No blueprint';
        case 'duplicate-species':
            // The standing species clause (map § Notes): the roster may hold ten krakens, the party
            // may field one. Said in those terms, because "illegal" explains nothing.
            return 'Already on the team — one of each species';
        case 'party-full':
            return `Party full — ${PARTY_SIZE}/${PARTY_SIZE}`;
    }
}

export default function WorkshopNode({ run, node, ranch, initialPending }: WorkshopNodeProps): ReactNode {
    const dispatch = useDispatch();
    // Read-back access for the cross-slice check below. `useSelector`'s value is the one this render
    // closed over, which is a render behind the dispatch it has to verify.
    const store = useStore<RootState>();

    const [pending, setPending] = useState<WorkshopPending | null>(initialPending ?? null);
    const [built, setBuilt] = useState<IRanchMember | null>(null);

    const scrap = run.scrap;
    const species = useMemo(() => workshopSpecies(ranch, run), [ranch, run]);
    const party = useMemo(
        () => run.partyIds
            .map((id) => ranch.roster.find((m) => m.id === id))
            .filter((m): m is IRanchMember => m !== undefined),
        [ranch, run],
    );

    /** The shortfall, in the words the player needs: what they are short, not that they are short. */
    const shortBy = (price: number): number => Math.max(0, price - scrap);

    /**
     * Build a species into the party. **Two dispatches, ranch first** — see the header, and
     * `runSlice.recruitIntoParty` for the argument in full.
     */
    const assemble = (speciesId: string, osId: string): void => {
        const plan = planRecruit({ ranch, run, node, speciesId, osId });
        // `planRecruit` returns null for everything the species clause and the party ceiling refuse,
        // so an illegal recruit never reaches a dispatch at all.
        if (!plan) return;
        // Checked BEFORE the ranch half, because the ranch half cannot be undone: the run reducer
        // would refuse the payment and leave the player holding an individual they did not get into
        // the party. That is the benign end of the failure, but it is still not what they clicked.
        if (scrap < plan.scrap) return;

        dispatch(assembleMingming(plan.member));

        // The cross-slice verification. `assembleMingming` is a silent no-op with no blueprint (the
        // slice convention), and a second click carrying stale props would otherwise charge the run
        // for a member the ranch refused to build.
        if (!store.getState().game.roster.some((m) => m.id === plan.member.id)) return;

        dispatch(recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap }));
        playSfx('rewardClaim');
        setBuilt(plan.member);
        setPending(null);
    };

    /**
     * Reflash a party member's firmware. Same ordering and the same verification, keyed on the
     * **blueprint count falling** rather than on the OS having changed: after a double click the OS
     * already reads as the target, so "did it change?" would answer yes and charge twice.
     */
    const reflash = (memberId: string, targetOS: string): void => {
        const member = ranch.roster.find((m) => m.id === memberId);
        if (!member) return;
        if (scrap < WORKSHOP_REFLASH_SCRAP) return;

        const before = store.getState().game.blueprints[member.definitionId] ?? 0;
        if (before < 1) return;

        dispatch(swapOS({ id: memberId, targetOS }));

        const after = store.getState().game.blueprints[member.definitionId] ?? 0;
        if (after >= before) return;

        dispatch(spendRunScrap(WORKSHOP_REFLASH_SCRAP));
        playSfx('rewardClaim');
        setPending(null);
    };

    const strip = (instanceId: string): void => {
        dispatch(removeRunCardForScrap({ instanceId, price: WORKSHOP_REMOVAL_PRICE }));
        playSfx('uiClick');
    };

    return (
        <section className="ws">
            <header className="ws-head">
                <h2 className="ws-title">🔧 Workshop</h2>
                <div className="ws-balance">
                    <span className="ws-scrap" aria-label="Scrap held">{scrap} scrap</span>
                    <span className="ws-party">party: {run.partyIds.length}/{PARTY_SIZE}</span>
                </div>
                <p className="ws-note">
                    <strong>This is the only place the party grows.</strong> A blueprint <em>and</em>{' '}
                    {WORKSHOP_ASSEMBLY_SCRAP} scrap assembles a mingming straight into the team — the ranch
                    charges the blueprint alone, the road charges both, so recruiting competes with the
                    marketplace for the same purse. The recruit joins with <strong>4 cards</strong>: three
                    from its start kit and one generic.
                </p>
            </header>

            {/* --- Assemble --- */}

            <div className="ws-section-head">
                <h3>Assemble</h3>
                <span className="ws-price-tag">1 blueprint + {WORKSHOP_ASSEMBLY_SCRAP} scrap</span>
            </div>
            <p className="ws-note">
                Stats roll at assembly and never change, and the individual goes on your{' '}
                <strong>permanent roster</strong> — it survives this run whatever happens to the run. One
                of each species on a team: the roster may hold ten krakens, the party fields one.
            </p>

            {species.length === 0 && (
                <div className="ws-empty">
                    No blueprints. They drop from fights and are guaranteed by alpha nodes — until then
                    there is nothing to assemble, but the deck bench below is open.
                </div>
            )}

            <ul className="ws-list">
                {species.map((entry) => {
                    const definition = GetMingmingData(entry.speciesId);
                    const short = shortBy(WORKSHOP_ASSEMBLY_SCRAP);
                    const refused = entry.block !== null;
                    return (
                        <li key={entry.speciesId} className={`ws-row ${refused ? 'blocked' : ''}`}>
                            <div className="ws-row-card">
                                <span className="ws-row-name">{definition.name}</span>
                                <span className="ws-row-meta">
                                    {definition.primaryElement} · blueprints ×{entry.blueprints}
                                </span>
                                {refused && <span className="ws-tag">{blockLabel(entry.block!)}</span>}
                            </div>
                            <button
                                type="button"
                                className="ws-button"
                                disabled={refused || short > 0}
                                onClick={() => {
                                    playSfx('uiClick');
                                    setBuilt(null);
                                    setPending({
                                        kind: 'assemble',
                                        speciesId: entry.speciesId,
                                        osId: definition.availableOS[0] ?? '',
                                    });
                                }}
                            >
                                {refused
                                    ? blockLabel(entry.block!)
                                    : short > 0
                                        ? `Assemble (${WORKSHOP_ASSEMBLY_SCRAP}) — ${short} scrap short`
                                        : `Assemble — 1 blueprint + ${WORKSHOP_ASSEMBLY_SCRAP} scrap`}
                            </button>
                        </li>
                    );
                })}
            </ul>

            {built && (
                <div className="ws-built" role="status">
                    <div className="ws-built-title">
                        {GetMingmingData(built.definitionId).name} joined the party
                    </div>
                    <div className="ws-ivs" title="Stat roll — fixed at assembly, 0-31 each">
                        <span>⚔ {built.attackIV}</span>
                        <span>🛡 {built.defenseIV}</span>
                        <span>💚 {built.hpIV}</span>
                    </div>
                    <div className="ws-note">
                        Its four cards are in the shared deck, and the individual is on your ranch roster
                        for good.
                    </div>
                </div>
            )}

            {/* --- Reflash --- */}

            <div className="ws-section-head">
                <h3>Reflash firmware</h3>
                <span className="ws-price-tag">1 blueprint + {WORKSHOP_REFLASH_SCRAP} scrap</span>
            </div>
            <p className="ws-note">
                A reflash swaps which OS a member runs. It grants no cards — but the firmware decides
                which lists the marketplace and every reward pick draw from, so it re-aims the rest of
                the run.
            </p>

            <ul className="ws-list">
                {party.map((member) => {
                    const block = reflashBlockFor(member, ranch);
                    const short = shortBy(WORKSHOP_REFLASH_SCRAP);
                    const label = block === 'no-blueprint'
                        ? `No ${GetMingmingData(member.definitionId).name} blueprint`
                        : block === 'no-other-firmware'
                            ? 'Only one firmware'
                            : null;
                    return (
                        <li key={member.id} className={`ws-row ${block ? 'blocked' : ''}`}>
                            <div className="ws-row-card">
                                <span className="ws-row-name">
                                    {member.nickname ?? GetMingmingData(member.definitionId).name}
                                </span>
                                <span className="ws-row-meta">
                                    {getOSBehavior(member.activeOS)?.name ?? member.activeOS}
                                </span>
                                {label && <span className="ws-tag">{label}</span>}
                            </div>
                            <button
                                type="button"
                                className="ws-button subtle"
                                disabled={block !== null || short > 0}
                                onClick={() => {
                                    playSfx('uiClick');
                                    setPending({
                                        kind: 'reflash',
                                        memberId: member.id,
                                        osId: reflashOptionsFor(member)[0] ?? '',
                                    });
                                }}
                            >
                                {label
                                    ?? (short > 0
                                        ? `Reflash (${WORKSHOP_REFLASH_SCRAP}) — ${short} scrap short`
                                        : `Reflash — 1 blueprint + ${WORKSHOP_REFLASH_SCRAP} scrap`)}
                            </button>
                        </li>
                    );
                })}
                {party.length === 0 && <li className="ws-empty">No party members to reflash.</li>}
            </ul>

            {/* --- Strip a card --- */}

            <div className="ws-section-head">
                <h3>Strip a card ({run.deck.length})</h3>
                <span className="ws-price-tag">{WORKSHOP_REMOVAL_PRICE} scrap</span>
            </div>
            <p className="ws-note">
                Removal costs the same {WORKSHOP_REMOVAL_PRICE} scrap here as at a marketplace — one sink,
                one price, two counters. It pays nothing back; what it buys is a thinner deck. The generic{' '}
                <em>Tackle</em> filler every member and every recruit brings is what it is for.
            </p>

            <ul className="ws-list ws-deck-list">
                {run.deck.map((card) => {
                    const data = ProgramRegistry[card.dataId];
                    const short = shortBy(WORKSHOP_REMOVAL_PRICE);
                    return (
                        <li
                            key={card.instanceId}
                            className={`ws-row ${card.dataId === GENERIC_HIT ? 'generic' : ''}`}
                        >
                            <div className="ws-row-card">
                                <span className="ws-row-name">{data?.name ?? card.dataId}</span>
                                {/*
                                  * Name, element, rarity and energy cost — never the description.
                                  * Standing law (map § Notes): power dies at the surface, and several
                                  * card descriptions quote the internal number out loud.
                                  */}
                                <span className="ws-row-meta">
                                    {data?.element ?? 'None'} · {(data?.rarity as string) ?? 'Common'} ·{' '}
                                    {numericBaseCost(data?.baseCost ?? 0)}⚡
                                </span>
                                {card.dataId === GENERIC_HIT && <span className="ws-tag">generic filler</span>}
                            </div>
                            <button
                                type="button"
                                className="ws-button danger"
                                disabled={short > 0}
                                onClick={() => strip(card.instanceId)}
                            >
                                {short > 0
                                    ? `Strip (${WORKSHOP_REMOVAL_PRICE}) — ${short} short`
                                    : `Strip — ${WORKSHOP_REMOVAL_PRICE} scrap`}
                            </button>
                        </li>
                    );
                })}
                {run.deck.length === 0 && <li className="ws-empty">No cards. Nothing to strip.</li>}
            </ul>

            {pending && (
                <OsPicker
                    pending={pending}
                    ranch={ranch}
                    onPick={(osId) => setPending({ ...pending, osId })}
                    onCancel={() => setPending(null)}
                    onConfirm={() => {
                        if (pending.kind === 'assemble') assemble(pending.speciesId, pending.osId);
                        else reflash(pending.memberId, pending.osId);
                    }}
                />
            )}
        </section>
    );
}

/**
 * Firmware choice, read from the registry rather than assumed.
 *
 * The same picker the ranch's assembly bay uses, for the reason ticket 14 asks for it: a player who
 * has learned that a blueprint plus an OS choice makes an individual should not meet a different
 * ritual halfway through a run. It is a local copy rather than a shared component because the two
 * differ in the sentence that matters — the ranch's says "reflashing later costs another blueprint",
 * this one has to name the scrap as well — and lifting a component to share a `<div>` while
 * parameterising the only load-bearing text is how a shared component stops being shared.
 */
function OsPicker({
    pending,
    ranch,
    onPick,
    onCancel,
    onConfirm,
}: {
    pending: WorkshopPending;
    ranch: IRanchState;
    onPick: (osId: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}): ReactNode {
    const member = pending.kind === 'reflash'
        ? ranch.roster.find((m) => m.id === pending.memberId)
        : undefined;
    const speciesId = pending.kind === 'assemble' ? pending.speciesId : member?.definitionId ?? '';
    const options = pending.kind === 'assemble'
        ? GetMingmingData(speciesId).availableOS
        : member ? reflashOptionsFor(member) : [];
    const price = pending.kind === 'assemble' ? WORKSHOP_ASSEMBLY_SCRAP : WORKSHOP_REFLASH_SCRAP;

    const overlay: CSSProperties = { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 40 };

    return (
        <div style={overlay} className="ws-modal-backdrop">
            <div className="ws-modal" role="dialog" aria-modal="true" aria-label="Choose firmware">
                <h3>
                    {pending.kind === 'assemble' ? 'Choose firmware for ' : 'Reflash '}
                    {speciesId ? GetMingmingData(speciesId).name : 'unit'}
                </h3>
                <p className="ws-note">
                    {pending.kind === 'assemble'
                        ? 'The OS is active from the moment it joins, and it decides which cards the rest of the run offers you.'
                        : 'The cards already in the deck stay. What changes is the firmware and every list drawn from it.'}
                </p>
                <div className="ws-os-options">
                    {options.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={`ws-os-option ${pending.osId === id ? 'selected' : ''}`}
                            onClick={() => onPick(id)}
                            aria-pressed={pending.osId === id}
                        >
                            <strong>{getOSBehavior(id)?.name ?? id}</strong>
                            <span>{getOSBehavior(id)?.description ?? 'No firmware description.'}</span>
                        </button>
                    ))}
                    {options.length === 0 && <span className="ws-empty">No other firmware for this species.</span>}
                </div>
                <div className="ws-modal-actions">
                    <button type="button" className="ws-button subtle" onClick={onCancel}>Cancel</button>
                    <button type="button" className="ws-button" disabled={!pending.osId} onClick={onConfirm}>
                        Spend 1 blueprint + {price} scrap
                    </button>
                </div>
            </div>
        </div>
    );
}
