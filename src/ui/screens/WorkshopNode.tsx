/**
 * THE WORKSHOP — ticket 14, rebuilt to ticket 65's ruled mockups.
 *
 * `research/65-workshop-proto/workshop_I_bay.html` is the bay and `workshop_J_reflash.html` is the
 * reflash view. Three columns: the **blueprint rack** on the left, the lit **assembly stage** in the
 * middle, the **party and bench** on the right. Reflash replaces the whole body with a side-by-side
 * comparison of the two firmwares and the two engines, which is mockup J's central point — a reflash
 * is a choice between two decks, and a picker that named only the OS was asking the player to choose
 * blind.
 *
 * # THE FOUR VERBS
 *
 * **ASSEMBLE → PARTY** spends a blueprint and 25 scrap, and the new member's **five-card engine goes
 * straight to the active deck** (ticket 65, ruled). **ASSEMBLE → BENCH** costs the same and parks
 * both the member and its engine — see `runSlice.recruitToBench` for why that is a verb rather than
 * an inconvenience. **REFLASH** swaps the OS *and* its engine, 5 for 5, old set to the collection
 * (`workshop.planReflash`). **EDIT LOADOUT** opens the editor all four surfaces share.
 *
 * Paid removal used to be a fifth, at 20 scrap. Henry deleted it on 2026-08-26: editing the deck is
 * free at this screen and three others, and a card you will never play is *sold* at a marketplace.
 *
 * # THE STAT ROLL IS REVEALED HERE, AND IT IS STILL NOT PREVIEWED
 *
 * Mockup I puts VIT/PWR/DEF on the stage under *"stats roll at assembly — this is the reveal
 * moment"*. That reads two ways, and only one of them survives contact with the standing ruling in
 * `workshop.planRecruit`: **the roll is never previewed — the player sees the stats after paying,
 * exactly as at the ranch**, and the consequence (walking away and back re-rolls the individual, at
 * the price of re-fighting the wilds between) is the mid-run echo of `vision.md`'s *"re-assembly is
 * the re-roll"*. A previewed roll would make that free, and would turn every workshop into a
 * re-roll button the player is expected to mash.
 *
 * So the stage is where the reveal *happens* — the three stat boxes are there before you assemble,
 * reading `??`, and they fill in the moment you do. Layout is the mockup's; the ruling holds.
 * **Flagged for Henry**: if the intent was a genuine preview, this is a one-line change here plus a
 * ruling in `planRecruit`, and the economy consequence above is the thing to weigh.
 *
 * # THE ORDER OF THE TWO DISPATCHES IS LOAD-BEARING
 *
 * An assembly and a reflash each write both slices, and no reducer can. `runSlice.recruitIntoParty`
 * carries the argument in full; the short version is **the ranch half goes first**, because dying
 * between the two then leaves the player holding an assembled individual on their permanent roster —
 * the ranch transaction, exactly — instead of a run whose party names a member that does not exist,
 * which `reconcileLoadedState` is obliged to throw the whole run away over.
 *
 * `useStore` is here for the one check that follows from that: after the ranch dispatch, this reads
 * the store back and only charges the run **if the ranch actually changed**. That is the single
 * cross-slice guard no reducer can make, made in the only place that can see both halves.
 *
 * # A FULL PARTY ASKS WHO TO BENCH
 *
 * Mockup I: *"Party is full — ASSEMBLE → PARTY asks who to bench."* It does. The right column's
 * chips become the question, rather than a fourth modal on a screen that already has one — and the
 * bench-then-recruit pair is safe to split because the intermediate state (a party of two, five
 * cards in the collection) is a perfectly ordinary run the player could have reached in the editor.
 *
 * # KEYBOARD
 *
 * Every affordance is a real `<button>` — `RegionMap` and `MarketplaceNode` set that precedent, and
 * ticket 38 should inherit screens that already work without a mouse.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useStore } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { PARTY_SIZE } from '../../engine/party';
import { minimumActiveDeck, RECRUIT_KIT_SIZE } from '../../engine/run/createRun';
import {
    WORKSHOP_ASSEMBLY_SCRAP,
    WORKSHOP_REFLASH_SCRAP,
    engineIdsFor,
    engineIdsForSpecies,
    planRecruit,
    planReflash,
    reflashBlockFor,
    reflashOptionsFor,
    workshopSpecies,
    type WorkshopBlock,
} from '../../engine/run/workshop';
import type { IRanchMember, IRanchState, IRegionNode, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { assembleMingming, swapOS } from '../store/gameSlice';
import { benchPartyMember, recruitIntoParty, recruitToBench, reflashEngine } from '../store/runSlice';
import type { RootState } from '../store/store';
import { ElementMark } from './CardChassis';
import { cardFace, colorFor } from './runShell';
import './runShell.css';
import './WorkshopNode.css';
import { Icon } from '../theme/Icon';

/** Which member the reflash view is open for, and which firmware it is offering. */
export interface ReflashTarget {
    readonly memberId: string;
    readonly targetOS: string;
}

export interface WorkshopNodeProps {
    readonly run: IRunState;
    /** The workshop being stood in, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** The ranch — this screen spends blueprints and writes the roster, so it needs both. */
    readonly ranch: IRanchState;
    /** For the context line. */
    readonly biomeName?: string;
    /** Opens the shared `LoadoutEditor`. One of ticket 61 §3's four doors. */
    readonly onEditLoadout: () => void;
    /** Closes the bay back to the map. See `RunScreen` for why leaving is a UI state, not a move. */
    readonly onLeave: () => void;
    /**
     * Test seams. `renderToStaticMarkup` cannot click, and the stage and the reflash comparison are
     * where the prices and the engines are confirmed — so both have to be renderable in a test.
     */
    readonly initialSpeciesId?: string;
    readonly initialReflash?: ReflashTarget;
}

/** Why an assembly row is refused, in the player's words rather than the type's. */
function blockLabel(block: WorkshopBlock): string {
    switch (block) {
        case 'no-blueprint':
            return 'no blueprints';
        case 'duplicate-species':
            // The standing species clause (map § Notes): the roster may hold ten krakens, the TEAM
            // may field one — party and bench together. Said in those terms, because "illegal"
            // explains nothing.
            return 'already on the team';
        case 'party-full':
            // Not a refusal any more: the bench takes the overflow, and ASSEMBLE → PARTY asks who
            // to swap out. Kept in the label table because `workshopSpecies` still reports it.
            return `party ${PARTY_SIZE}/${PARTY_SIZE} — bench or swap`;
    }
}

/** A list of data ids as rows, duplicates collapsed to ×N, payoff first and tagged. */
function EngineRows({ ids }: { ids: ReadonlyArray<string> }): ReactNode {
    const counted: Array<{ dataId: string; n: number }> = [];
    for (const id of ids) {
        const seen = counted.find((entry) => entry.dataId === id);
        if (seen) seen.n += 1;
        else counted.push({ dataId: id, n: 1 });
    }
    return (
        <div className="rs-cards">
            {counted.map(({ dataId, n }, index) => {
                const face = cardFace(dataId);
                return (
                    <div key={dataId} className="rs-row static" style={{ ['--el' as string]: colorFor(face.element) }}>
                        <span className="rs-g">{face.cost}</span>
                        <ElementMark element={face.element} compact />
                        <span className="rs-rnm">{face.name}</span>
                        {/* Ticket 61's engine table puts the payoff first, so position IS the tag. */}
                        {index === 0 && <span className="rs-t">payoff</span>}
                        {n > 1 && <span className="rs-x">×{n}</span>}
                    </div>
                );
            })}
        </div>
    );
}

export default function WorkshopNode({
    run, node, ranch, biomeName, onEditLoadout, onLeave, initialSpeciesId, initialReflash,
}: WorkshopNodeProps): ReactNode {
    const dispatch = useDispatch();
    // Read-back access for the cross-slice checks below. `useSelector`'s value is the one this
    // render closed over, which is a render behind the dispatch it has to verify.
    const store = useStore<RootState>();

    const [speciesId, setSpeciesId] = useState<string | null>(initialSpeciesId ?? null);
    const [osId, setOsId] = useState<string | null>(null);
    const [built, setBuilt] = useState<IRanchMember | null>(null);
    /** True while ASSEMBLE → PARTY is waiting for the player to name who leaves the field. */
    const [swappingOut, setSwappingOut] = useState(false);
    const [reflash, setReflash] = useState<ReflashTarget | null>(initialReflash ?? null);

    const scrap = run.scrap;
    const floor = minimumActiveDeck(run.partyIds.length);
    const bench = useMemo(() => run.bench ?? [], [run.bench]);
    const species = useMemo(() => workshopSpecies(ranch, run), [ranch, run]);

    const memberOf = (id: string): IRanchMember | undefined => ranch.roster.find((m) => m.id === id);
    const partyMembers = run.partyIds.map(memberOf).filter((m): m is IRanchMember => m !== undefined);
    const benchMembers = bench.map(memberOf).filter((m): m is IRanchMember => m !== undefined);

    const selected = speciesId ? species.find((entry) => entry.speciesId === speciesId) ?? null : null;
    const definition = speciesId ? GetMingmingData(speciesId) : null;
    const chosenOS = osId ?? definition?.availableOS[0] ?? null;
    const partyFull = run.partyIds.length >= PARTY_SIZE;

    /** The shortfall, in the words the player needs: what they are short, not that they are short. */
    const shortBy = (price: number): number => Math.max(0, price - scrap);

    /**
     * Build the selected species. **Two dispatches, ranch first** — see the header, and
     * `runSlice.recruitIntoParty` for the argument in full.
     *
     * `benchOut` is the party member stepping aside, when the party was already full. It is benched
     * BEFORE the plan is made, in the plan's own view of the run rather than in the store, because
     * `planRecruit` refuses a full party outright — and the plan is unchanged by the bench either
     * way (its seed reads the run seed, the node and the roster, none of which a bench touches).
     */
    const assemble = (destination: 'party' | 'bench', benchOut?: string): void => {
        if (!speciesId || !chosenOS) return;

        const runForPlan = benchOut
            ? { ...run, partyIds: run.partyIds.filter((id) => id !== benchOut) }
            : run;
        const plan = planRecruit({ ranch, run: runForPlan, node, speciesId, osId: chosenOS });
        // `planRecruit` returns null for everything the species clause and the party ceiling refuse,
        // so an illegal recruit never reaches a dispatch at all.
        if (!plan) return;
        // Checked BEFORE the ranch half, because the ranch half cannot be undone: the run reducer
        // would refuse the payment and leave the player holding an individual they did not get.
        if (scrap < plan.scrap) return;

        if (benchOut) dispatch(benchPartyMember(benchOut));

        dispatch(assembleMingming(plan.member));

        // The cross-slice verification. `assembleMingming` is a silent no-op with no blueprint (the
        // slice convention), and a second click carrying stale props would otherwise charge the run
        // for a member the ranch refused to build.
        if (!store.getState().game.roster.some((m) => m.id === plan.member.id)) return;

        dispatch(destination === 'party'
            ? recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap })
            : recruitToBench({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap }));

        playSfx('rewardClaim');
        setBuilt(plan.member);
        setSwappingOut(false);
    };

    /**
     * Reflash a member's firmware AND its engine. Same ordering and the same verification, keyed on
     * the **blueprint count falling** rather than on the OS having changed: after a double click the
     * OS already reads as the target, so "did it change?" would answer yes and charge twice.
     */
    const doReflash = (target: ReflashTarget): void => {
        const member = memberOf(target.memberId);
        if (!member) return;
        const plan = planReflash({ ranch, run, node, member, targetOS: target.targetOS });
        if (!plan) return;
        if (scrap < plan.scrap) return;

        const before = ranch.blueprints[member.definitionId] ?? 0;
        if (before < 1) return;

        dispatch(swapOS({ id: member.id, targetOS: target.targetOS }));

        const after = store.getState().game.blueprints[member.definitionId] ?? 0;
        if (after >= before) return;

        dispatch(reflashEngine({
            memberId: member.id,
            retireIds: plan.retireIds,
            cards: plan.cards,
            price: plan.scrap,
        }));
        playSfx('rewardClaim');
        setReflash(null);
    };

    const topBar = (
        <div className="rs-top">
            <span className="rs-title">
                {reflash
                    ? `WORKSHOP — REFLASH — ${(memberOf(reflash.memberId)
                        ? GetMingmingData(memberOf(reflash.memberId)!.definitionId).name
                        : reflash.memberId).toUpperCase()}`
                    : 'WORKSHOP'}
            </span>
            <span className="rs-ctx">{(biomeName ?? 'THIS').toUpperCase()} BIOME · ASSEMBLY BAY</span>
            <span className="rs-spacer" />
            <span className="rs-scrap" aria-label="Scrap held">{scrap} <Icon name="scrap" size={12} /></span>
            <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onEditLoadout(); }}>
                EDIT LOADOUT
            </button>
            <button
                type="button"
                className="rs-btn primary"
                onClick={() => { playSfx('uiClick'); if (reflash) setReflash(null); else onLeave(); }}
            >
                {reflash ? 'BACK' : 'LEAVE'}
            </button>
        </div>
    );

    // --- the reflash comparison: mockup J replaces the whole body with it ---

    if (reflash) {
        const member = memberOf(reflash.memberId);
        const options = member ? reflashOptionsFor(member) : [];
        const targetOS = options.includes(reflash.targetOS) ? reflash.targetOS : options[0] ?? '';
        const plan = member
            ? planReflash({ ranch, run, node, member, targetOS })
            : null;
        const short = shortBy(WORKSHOP_REFLASH_SCRAP);

        return (
            <section className="ws rs-frame rs-fixed">
                {topBar}
                <div className="ws-body reflash">
                    <div className="rs-panel ws-cmpwrap">
                        <h2>REFLASH — swaps the OS <b>and</b> its {RECRUIT_KIT_SIZE}-card engine in your deck</h2>
                        <div className="ws-cmp">
                            <div className="ws-oscard current">
                                <h3>
                                    {member ? getOSBehavior(member.activeOS)?.name ?? member.activeOS : '—'}
                                    <span className="ws-tagcur"> · CURRENT</span>
                                </h3>
                                <p className="ws-osdesc">
                                    {(member && getOSBehavior(member.activeOS)?.description) ?? 'No firmware description.'}
                                </p>
                                <h4>ENGINE IN DECK NOW</h4>
                                {member && <EngineRows ids={engineIdsFor(member)} />}
                            </div>

                            <span className="ws-vs" aria-hidden="true">⇄</span>

                            <div className="ws-oscard offer">
                                <h3>
                                    {getOSBehavior(targetOS)?.name ?? (targetOS || '—')}
                                    <span className="ws-tagnew"> · AFTER REFLASH</span>
                                </h3>
                                <p className="ws-osdesc">
                                    {getOSBehavior(targetOS)?.description ?? 'No firmware description.'}
                                </p>
                                <h4>ENGINE THAT REPLACES IT</h4>
                                {member && <EngineRows ids={engineIdsForSpecies(member.definitionId, targetOS)} />}
                            </div>
                        </div>

                        {/* More than two firmwares is not reachable today, and will be: the picker is
                            rendered whenever there is a second option so it does not have to be
                            invented later on a screen that has already been ruled. */}
                        {options.length > 1 && (
                            <div className="ws-actions">
                                {options.map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`rs-f ${id === targetOS ? 'on' : ''}`}
                                        onClick={() => setReflash({ ...reflash, targetOS: id })}
                                    >
                                        {getOSBehavior(id)?.name ?? id}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="ws-actions">
                            <span className="rs-hint">
                                old engine cards → run collection · new engine → deck (floor unchanged:{' '}
                                {RECRUIT_KIT_SIZE} for {RECRUIT_KIT_SIZE})
                            </span>
                            <span className="rs-chip">
                                1 × {member ? GetMingmingData(member.definitionId).name.toUpperCase() : ''} BLUEPRINT
                            </span>
                            <span className="rs-chip">{WORKSHOP_REFLASH_SCRAP} <Icon name="scrap" size={11} /></span>
                            <button
                                type="button"
                                className="rs-btn primary"
                                disabled={!plan || short > 0}
                                onClick={() => doReflash({ memberId: reflash.memberId, targetOS })}
                            >
                                {short > 0 ? `REFLASH — ${short} SHORT` : 'REFLASH'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // --- the bay ---

    return (
        <section className="ws rs-frame rs-fixed">
            {topBar}
            <div className="ws-body">
                <div className="rs-panel">
                    <h2>BLUEPRINTS</h2>
                    <div className="ws-scroll">
                        {species.map((entry) => {
                            const data = GetMingmingData(entry.speciesId);
                            const none = entry.blueprints < 1;
                            return (
                                <button
                                    key={entry.speciesId}
                                    type="button"
                                    className={`ws-bpc ${speciesId === entry.speciesId ? 'sel' : ''}`}
                                    style={{ ['--el' as string]: colorFor(data.primaryElement) }}
                                    disabled={none}
                                    aria-pressed={speciesId === entry.speciesId}
                                    onClick={() => {
                                        playSfx('uiClick');
                                        setSpeciesId(entry.speciesId);
                                        setOsId(null);
                                        setBuilt(null);
                                        setSwappingOut(false);
                                    }}
                                >
                                    <span className="ws-bpdot">{data.name.charAt(0)}</span>
                                    <span className="ws-bptext">
                                        <span className="ws-bpnm">{data.name}</span>
                                        <span className="ws-bpct">
                                            {/* Mockup I's greyed Skoll row. `workshopSpecies` lists
                                                a species spent down to zero rather than hiding it,
                                                because a rack that shows only what you can spend
                                                cannot tell you what you have run out of. */}
                                            {none ? 'no blueprints' : `blueprints ×${entry.blueprints}`}
                                            {entry.block !== null && entry.block !== 'no-blueprint'
                                                ? ` · ${blockLabel(entry.block)}`
                                                : ''}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                        {species.length === 0 && (
                            <span className="rs-hint">
                                No species in the registry offer blueprints yet.
                            </span>
                        )}
                    </div>
                    <p className="rs-hint ws-foot">
                        Blueprints are consumable — assembling spends one. Extra copies re-roll stats
                        via re-assembly at the ranch.
                    </p>
                </div>

                <div className="ws-stage">
                    <h2>{definition ? `ASSEMBLE — ${definition.name.toUpperCase()}` : 'SELECT A BLUEPRINT'}</h2>

                    <div
                        className={`ws-silhouette ${built ? '' : 'blank'}`}
                        style={{
                            ['--el' as string]: colorFor(definition?.primaryElement ?? 'None'),
                            ['--glow' as string]: `${colorFor(definition?.primaryElement ?? 'None')}44`,
                        }}
                    >
                        {definition?.name.charAt(0) ?? '?'}
                    </div>

                    {/*
                      * THE REVEAL. Unrolled before the assembly, filled in after — see the header
                      * for why this is not a preview, and what the standing ruling in `planRecruit`
                      * is protecting by keeping it that way.
                      */}
                    <div className="ws-roll" role="status">
                        {([
                            ['VIT', built?.hpIV],
                            ['PWR', built?.attackIV],
                            ['DEF', built?.defenseIV],
                        ] as const).map(([key, value]) => (
                            <div key={key} className={`ws-stat ${value === undefined ? 'unrolled' : ''}`}>
                                <span className="ws-stat-v">{value ?? '??'}</span>
                                <span className="ws-stat-k">{key}</span>
                            </div>
                        ))}
                    </div>
                    <p className="rs-hint">
                        {built
                            ? `${GetMingmingData(built.definitionId).name} is on your permanent roster — its stats are fixed for good.`
                            : 'Stats roll at assembly and never change. They are not shown before you pay: walking away and back builds a different individual, at the price of the road in between.'}
                    </p>

                    {definition && (
                        <div className="ws-cols">
                            <div className="ws-col">
                                <h3>OS — CHOOSE AT ASSEMBLY</h3>
                                <div className="rs-cards">
                                    {definition.availableOS.map((id) => (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`rs-row ${id === chosenOS ? 'on' : ''}`}
                                            style={{ ['--el' as string]: colorFor(definition.primaryElement) }}
                                            aria-pressed={id === chosenOS}
                                            onClick={() => { setOsId(id); playSfx('uiClick'); }}
                                        >
                                            <span className="rs-g">◈</span>
                                            <span className="rs-rnm">{getOSBehavior(id)?.name ?? id}</span>
                                            {id === chosenOS && <span className="rs-t">chosen</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="ws-col">
                                <h3>
                                    ITS {RECRUIT_KIT_SIZE}-CARD ENGINE →{' '}
                                    {partyFull && !swappingOut ? 'DECK OR COLLECTION' : 'DECK'}
                                </h3>
                                <EngineRows ids={engineIdsForSpecies(speciesId!, chosenOS ?? undefined)} />
                            </div>
                        </div>
                    )}

                    {definition && (
                        <div className="ws-cost">
                            <span className="rs-chip">1 × BLUEPRINT</span>
                            <span className="rs-chip">{WORKSHOP_ASSEMBLY_SCRAP} <Icon name="scrap" size={11} /></span>
                            <button
                                type="button"
                                className="rs-btn primary"
                                disabled={
                                    !selected
                                    || selected.blueprints < 1
                                    || selected.block === 'duplicate-species'
                                    || shortBy(WORKSHOP_ASSEMBLY_SCRAP) > 0
                                }
                                onClick={() => {
                                    playSfx('uiClick');
                                    if (partyFull) { setSwappingOut(true); return; }
                                    assemble('party');
                                }}
                            >
                                {selected?.block === 'duplicate-species'
                                    ? 'ALREADY ON THE TEAM'
                                    : shortBy(WORKSHOP_ASSEMBLY_SCRAP) > 0
                                        ? `ASSEMBLE → PARTY — ${shortBy(WORKSHOP_ASSEMBLY_SCRAP)} SHORT`
                                        : partyFull ? 'ASSEMBLE → PARTY (SWAP)' : 'ASSEMBLE → PARTY'}
                            </button>
                            <button
                                type="button"
                                className="rs-btn"
                                disabled={
                                    !selected
                                    || selected.blueprints < 1
                                    || selected.block === 'duplicate-species'
                                    || shortBy(WORKSHOP_ASSEMBLY_SCRAP) > 0
                                }
                                onClick={() => { playSfx('uiClick'); assemble('bench'); }}
                            >
                                ASSEMBLE → BENCH
                            </button>
                        </div>
                    )}

                    {!definition && (
                        <p className="rs-hint">
                            Pick a blueprint on the left. This is the only place the party grows — a
                            blueprint <em>and</em> {WORKSHOP_ASSEMBLY_SCRAP} scrap, so recruiting
                            competes with the marketplace for the same purse.
                        </p>
                    )}
                </div>

                <div className="rs-panel">
                    <h2>
                        PARTY {run.partyIds.length}/{PARTY_SIZE} · BENCH {bench.length}
                    </h2>
                    <div className="ws-scroll">
                        {partyMembers.map((member) => {
                            const data = GetMingmingData(member.definitionId);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    className={`ws-bpc ${swappingOut ? 'sel' : ''}`}
                                    style={{ ['--el' as string]: colorFor(data.primaryElement) }}
                                    onClick={() => {
                                        if (swappingOut) { assemble('party', member.id); return; }
                                        playSfx('uiClick');
                                        const options = reflashOptionsFor(member);
                                        if (options.length > 0) setReflash({ memberId: member.id, targetOS: options[0] });
                                    }}
                                >
                                    <span className="ws-bpdot">{data.name.charAt(0)}</span>
                                    <span className="ws-bptext">
                                        <span className="ws-bpnm">{member.nickname ?? data.name}</span>
                                        <span className="ws-bpct">
                                            {swappingOut
                                                ? 'bench this one ⇄'
                                                : `${getOSBehavior(member.activeOS)?.name ?? member.activeOS} · ${reflashBlockFor(member, ranch) === null ? 'reflash' : blockLabel('no-blueprint')}`}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                        {benchMembers.map((member) => {
                            const data = GetMingmingData(member.definitionId);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    className="ws-bpc benched"
                                    style={{ ['--el' as string]: colorFor(data.primaryElement) }}
                                    onClick={() => {
                                        playSfx('uiClick');
                                        const options = reflashOptionsFor(member);
                                        if (options.length > 0) setReflash({ memberId: member.id, targetOS: options[0] });
                                    }}
                                >
                                    <span className="ws-bpdot">{data.name.charAt(0)}</span>
                                    <span className="ws-bptext">
                                        <span className="ws-bpnm">{member.nickname ?? data.name}</span>
                                        <span className="ws-bpct">benched · reflash</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <p className="rs-hint ws-foot">
                        {swappingOut
                            ? 'Pick who steps off the field. Their cards go to the collection with them, and the new engine takes their place in the deck.'
                            : partyFull
                                ? `Party is full — ASSEMBLE → PARTY asks who to bench. Species clause: no duplicate species across party + bench. Click a member to reflash. 1 blueprint + ${WORKSHOP_REFLASH_SCRAP} scrap.`
                                : `Click a member to reflash — 1 blueprint + ${WORKSHOP_REFLASH_SCRAP} scrap, and it swaps the whole ${RECRUIT_KIT_SIZE}-card engine, not just the firmware.`}
                    </p>
                    <div className={`rs-pill ${run.deck.length <= floor ? 'at-floor' : ''}`}>
                        DECK <b>{run.deck.length}</b> / floor {floor}
                    </div>
                </div>
            </div>
        </section>
    );
}
