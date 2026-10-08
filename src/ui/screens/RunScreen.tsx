/**
 * The run shell — ticket 09, with ticket 10's map and ticket 11's node trigger.
 *
 * This is the frame around a run: which leader you are challenging, where you are, the party and
 * its deck, and the way out. `RegionMap` (ticket 10) is the map itself and owns everything about
 * how the graph is drawn and travelled.
 *
 * # TRAVEL NOW TRIGGERS (ticket 11, part 2)
 *
 * Ticket 07, RULED: *"Entering a node triggers it again, always."* Until this ticket, travel moved
 * `currentNodeId`, bumped `visited` and deliberately fired nothing. The move itself is now
 * `runSlice.enterNode` — one action that walks, increments and sets the phase — and this component
 * is what the phase talks to.
 *
 * **The battle starts from an effect on `run.phase`, not from inside the click handler.** Two
 * reasons, and the second is the one that matters:
 *
 * 1. The encounter is rolled from the visit count *after* the increment (ticket 07's re-roll rule),
 *    so a handler firing the battle would have to duplicate the increment locally to know what to
 *    roll from. Reading the phase back out of the store means there is exactly one increment.
 * 2. It makes the fight a **property of the run's state rather than of a click**. An app close
 *    between stepping onto a wild and winning it resumes with `phase: 'encounter'`, and this effect
 *    re-rolls the identical fight from the identical seed — ticket 23's resume contract extended to
 *    encounters, for free, because nothing about the fight was ever held in a component.
 *
 * # THE MARKETPLACE AND THE WORKSHOP ARE FULL SCREENS NOW — TICKETS 63 AND 65
 *
 * They were panels rendered inside this screen with the map still underneath, on the argument that
 * *"a market is not a mode you are trapped in, it is a thing at the place you are standing"* — and
 * so there was no "leave the shop" button, because there was nothing to leave.
 *
 * The ruled mockups replaced that. `market_G_stall.html` and `workshop_I_bay.html` are both full
 * frames with their own top bar, a scrap readout, EDIT LOADOUT and LEAVE, and they have to be: a
 * stall with an always-visible sell column and a bay with a lit assembly stage do not fit beside a
 * map, and squeezing them in would cost exactly the legibility both tickets were run to buy.
 *
 * **So what does LEAVE mean, when there is nothing to leave?** It closes the screen back to the map
 * you are still standing on. `closedNodeId` below is that one bit of state, and the argument above
 * survives intact: leaving is not a move, the node is not spent, and the map offers a way straight
 * back in. The old shape said "there is nothing to leave" by never opening; this one says it by
 * making the door swing both ways.
 *
 * # ONE EDITOR, FOUR DOORS — TICKET 61 §3
 *
 * `LoadoutEditor` is rendered from HERE and from nowhere else, over whatever is beneath it. The four
 * surfaces Henry ruled — marketplace, workshop, the biome-boundary alert, pre-gauntlet — each ask
 * this component to open it, and the editor itself knows only a context label. That is deliberate:
 * a component that checked the node kind would have to be taught every new surface, and the list of
 * surfaces is a design decision that has already moved twice.
 *
 * # THE GYM IS THE EXCEPTION, AND IT IS AN EXCEPTION ON PURPOSE (ticket 18)
 *
 * `GauntletNode` renders **instead of** the map, not over it. The gauntlet is three fights with no
 * way out but through (`exploration-map.md`: *"three fights, NO healing between them"*), so leaving
 * the region map on screen would offer a walk the run has no rule for. It is also the one node whose
 * fight does not start by itself: stepping on it calls `beginGauntlet` and the Pit Stop takes over,
 * because the whole value of a between-fights screen is that the player gets to look first.
 *
 * The one remaining non-fight kind does nothing yet and says so on screen. A node that fired and
 * produced no visible change is indistinguishable from a node that failed to fire.
 *
 * # THE RUN ENDS IN ONE PLACE (ticket 19)
 *
 * `phase: 'ended'` renders `RunSummary`, whatever ended it. Ticket 11's placeholder panel is gone,
 * and so is abandon's private exit: **abandoning now dispatches `endRun('abandoned')`** and arrives
 * at the same screen a defeat and a gym clear do. That is the ticket's central instruction — three
 * endings that unwind separately are three endings that drift — and it is why nothing in this file
 * touches the ranch on the way out any more. `ui/store/runTeardown.ts` is the only thing that does.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { buildBattleSetup, toMingmingState } from '../../engine/run/battleSetup';
import { effectiveOS, withEffectiveOS } from '../../engine/run/effectiveOS';
import { fightNodeFor, isEventFight } from '../../engine/run/eventFight';
import { RUN_ENEMY_MODE, isFightNode, rollEncounter, rivalElementPlan, surveyedEncounters } from '../../engine/run/encounter';
import { isMarketNode } from '../../engine/run/marketplace';
import { isWorkshopNode, tracesHeld } from '../../engine/run/workshop';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { PARTY_SIZE } from '../../engine/party';
import type { IRegionNode, IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { getMacro, isBiomeRevealed, revealedBiomesFrom } from '../../engine/data/macroRegistry';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import { startBattle } from '../store/battleSlice';
import { beginGauntlet, dismissBoundaryAlert, enterNode, fireMapReveal } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';
import BoundaryAlert from './BoundaryAlert';
import SettingsButton from '../components/SettingsButton';
import GauntletNode from './GauntletNode';
import LoadoutEditor from './LoadoutEditor';
import TownNode from './town/TownNode';
import MarketplaceNode from './MarketplaceNode';
import RegionMap from './RegionMap';
import Callout from '../components/Callout';
import { nextMapTip } from '../../engine/tips';
import RunSummary from './RunSummary';
import WorkshopNode from './WorkshopNode';
import EventNode from './EventNode';
import { NODE_ICON, NODE_LABEL } from './regionLayout';
import { Icon } from '../theme/Icon';
import RunMeta from './RunMeta';
import PartyFaces from './PartyFaces';
import type { Element as MingmingElement } from '../../engine/types';
import { partyElementsOf } from '../../engine/run/driverStakes';
import { plain } from '../labels/labels';

export default function RunScreen(): ReactNode {
    const dispatch = useDispatch();
    const run = useSelector((s: RootState) => s.run.run);
    const ranch = useSelector((s: RootState) => s.game);
    const roster = ranch.roster;

    /**
     * Which node's stall or bay the player has closed with LEAVE. Component state rather than run
     * state: it is a window the player shut, not a fact about the
     * run, and persisting it would resume a run with a shop mysteriously closed. Keyed on the node
     * id so that walking anywhere else — or walking back — opens the next one normally.
     */
    const [closedNodeId, setClosedNodeId] = useState<string | null>(null);

    /**
     * The event node the player has left, as `nodeId:visit`. Per VISIT rather than per node (unlike
     * `closedNodeId`): a spent event node shows "The relay is dark" each time it is walked into, so
     * walking back in must reopen that panel.
     */
    const [leftEventKey, setLeftEventKey] = useState<string | null>(null);

    /**
     * Whether the shared `LoadoutEditor` is open, and what its context line should read. Null is
     * the ordinary state. The four surfaces all set this and nothing else, which is what keeps
     * "exactly four doors" checkable by reading one file.
     */
    const [editorContext, setEditorContext] = useState<string | null>(null);

    const byId = useMemo(() => new Map((run?.nodes ?? []).map((n) => [n.id, n])), [run]);
    const current = run ? byId.get(run.currentNodeId) : undefined;

    /**
     * The party, for anything that needs to know what species are on the team — today the
     * marketplace's stock pool (ticket 13), which draws by the same rule as a reward pick.
     *
     * Memoised because it is a fresh array every render otherwise, and `MarketplaceNode` keys its
     * stock roll on it: a new array identity every render would re-roll a deterministic stock over
     * and over for nothing. Declared above the early return, as hooks must be.
     */
    const marketParty = useMemo(
        () => (run?.partyIds ?? [])
            .map((id) => roster.find((m) => m.id === id))
            .filter((m): m is (typeof roster)[number] => m !== undefined)
            // TICKET 168f: the shop rolls its stock for the OS a body runs in this run.
            .map((m) => withEffectiveOS(run!, m)),
        [run, roster],
    );
    /** TICKET 172: the elements this team fields, so the map names the Driver a win really pays. */
    const partyElements = useMemo(
        () => partyElementsOf(marketParty.map((m) => GetMingmingData(m.definitionId))),
        [marketParty],
    );

    /**
     * Which biomes a map-reveal macro has surveyed (ticket 15).
     *
     * Memoised for `marketParty`'s reason and one more: `RegionMap` keys its layout `useMemo` on
     * this array, so a fresh identity every render would re-lay-out the whole graph on every render
     * for nothing. Declared above the early return, as hooks must be.
     */
    /** The party as the run holds it, in party order (the header's row of faces). */
    const partyMembers = useMemo(
        () => (run?.partyIds ?? [])
            .map((id) => roster.find((m) => m.id === id))
            .filter((m): m is (typeof roster)[number] => m !== undefined),
        [run, roster],
    );

    const revealedBiomes = useMemo(() => revealedBiomesFrom(run?.modifiers ?? []), [run]);

    /**
     * TICKET 176d: who waits in every fight of a surveyed biome. Rolled here, from the current party,
     * because the map takes nodes and names and no run. Empty until a Heimdall's Gaze or a Heimdall's Watch
     * Survey has been fired, so an unsurveyed map prints no species anywhere.
     */
    const surveyedFights = useMemo(
        () => (run && revealedBiomes.length > 0
            ? surveyedEncounters(run, marketParty.map((m) => toMingmingState(m)), revealedBiomes)
            : {}),
        [run, revealedBiomes, marketParty],
    );

    /**
     * Fire the encounter the run's phase is asking for.
     *
     * Guarded on `phase === 'encounter'` alone: `App` renders `BattleArena` instead of this screen
     * for the whole life of the battle, so there is no window in which this component is mounted
     * with a battle already up. The victory path (`resolveEncounter`) puts the phase back to
     * `'map'` in the same batch that clears the battle, so remounting does not re-fire.
     *
     * A party that resolves to nobody cannot start a fight — `createBattleState` throws on an empty
     * party. `reconcileLoadedState` makes that unreachable at load, so bailing quietly here is
     * guarding against a state nothing can produce rather than swallowing a real case.
     */
    useEffect(() => {
        if (!run || run.phase !== 'encounter') return;

        const node = run.nodes.find((n) => n.id === run.currentNodeId);
        // TICKET 168g: an event node fights too while Ambush Bait's fight is on (as a wild).
        if (!node || !(isFightNode(node.kind) || isEventFight(run, node))) return;

        /*
         * TICKET 18: THE GYM IS A FIGHT KIND, BUT IT IS NOT *A* FIGHT.
         *
         * `enterNode` sets `phase: 'encounter'` for every kind in `FIGHT_KINDS`, the gym included —
         * which was right when the gym was one battle. It is three now, so the gym's arm of this
         * effect hands the run to `beginGauntlet` instead of rolling an encounter: that reducer sets
         * `phase: 'gauntlet'` and the Pit Stop below takes it from there. Rolling a fight here as
         * well would start battle one twice over.
         *
         * `beginGauntlet` is idempotent (it refuses when a gauntlet is already in progress), which
         * is what makes this safe under `StrictMode`'s double-invoked effects.
         */
        if (node.kind === 'gym') {
            dispatch(beginGauntlet());
            return;
        }

        const party: IMingmingState[] = [];
        for (const id of run.partyIds) {
            const member = roster.find((m) => m.id === id);
            if (member) party.push(toMingmingState(withEffectiveOS(run, member)));
        }
        if (party.length === 0) return;

        const encounter = rollEncounter({ run, node: fightNodeFor(run, node), party });

        // 155 deep dive 6: the backdrop's two fields, from the map this node sits on.
        const nodeBiome = run.biomes[node.biomeIndex];

        dispatch(startBattle({
            setup: buildBattleSetup(ranch, run, encounter),
            biome: nodeBiome
                // `Element` unqualified here is the DOM's, not the engine's — hence the alias.
                ? { name: nodeBiome.name, element: (nodeBiome.elements[0] ?? 'None') as MingmingElement }
                : undefined,
            // The pre-rolled encounter answers both of these; they are the pre-run generator's
            // parameters and this path does not use it.
            enemyIds: [],
            // Seeding the battle from the encounter's own seed is what makes the whole fight — the
            // shuffle and the opening hand included, not just the enemies — replay from the node.
            options: {
                seed: encounter.seed,
                enemyMode: RUN_ENEMY_MODE,
                // Ticket 60's ladder, third column. Carried on the encounter rather than
                // re-derived here — this screen has no business knowing the tier rules.
                enemyAiTier: encounter.enemyAiTier,
                // Ticket 144 §2: the fight's beam width, off the same ladder row as the grade.
                aiBeam: encounter.aiBeam,
            },
        }));
    }, [run, ranch, roster, dispatch]);

    if (!run || !current) return null;

    const gym = GYM_REGISTRY[run.gymId];
    const biome = run.biomes[current.biomeIndex];

    /**
     * Travel. Everything the move means lives in the reducer (`runSlice.enterNode`): the walk, the
     * visit increment ticket 07 rolls contents from, and the phase that starts the fight.
     */
    const travel = (target: IRegionNode): void => {
        dispatch(enterNode(target.id));
        playSfx('uiClick');
    };

    /*
     * TICKET 182a (R5): "Abandon run" moved to Settings (`AbandonRunSetting`), which keeps ticket 19's
     * two-step confirm and its teardown (`endRun('abandoned')`, the same ending a defeat takes). The
     * map header carries a small Settings button instead (`SettingsButton`).
     */

    /**
     * The run is over — victory, defeat or abandon, all three land here.
     *
     * Ticket 11 left a placeholder panel that said the run was over and that the ranch was intact,
     * and pointed at this ticket for the rest. `RunSummary` is the rest: what the run cost, what it
     * banked, how long it took, and the one path back to the ranch. The outcome only changes the
     * words — the teardown behind that button is identical for all three, which is the whole reason
     * they share a screen.
     */
    if (run.phase === 'ended') {
        return <RunSummary run={run} />;
    }

    /**
     * The editor, over whatever is beneath it. Rendered as a sibling rather than inside each
     * surface so that all four doors open the identical screen — and so that "which surfaces may
     * edit" is a question answered by reading the four `setEditorContext` calls in this file.
     */
    const editor = editorContext !== null ? (
        <LoadoutEditor
            run={run}
            ranch={ranch}
            context={editorContext}
            onClose={() => setEditorContext(null)}
        />
    ) : null;

    /** The mockups' context line: where you are, and what you are holding while you decide. */
    const contextLine = (where: string): string =>
        `${where} · ${(biome?.name ?? 'BIOME').toUpperCase()} · ${run.scrap} AMBER`;

    const stallOpen = closedNodeId !== run.currentNodeId;

    /*
     * TICKET 176c: a town is one node that is both the market and the workshop, so it is answered
     * BEFORE the two kind checks below (`isMarketNode` and `isWorkshopNode` both say yes to it).
     * `TownNode` owns the square, the tabs and the loadout editor; this only supplies the party.
     */
    if (current.kind === 'town' && stallOpen) {
        return (
            <TownNode
                run={run}
                node={current}
                party={marketParty}
                ranch={ranch}
                biomeName={biome?.name}
                onLeave={() => setClosedNodeId(current.id)}
            />
        );
    }

    if (isMarketNode(current.kind) && stallOpen) {
        return (
            <>
                <MarketplaceNode
                    run={run}
                    node={current}
                    party={marketParty}
                    biomeName={biome?.name}
                    ranch={ranch}
                    onEditLoadout={() => setEditorContext(contextLine('MARKETPLACE'))}
                    onLeave={() => setClosedNodeId(current.id)}
                />
                {editor}
            </>
        );
    }

    if (isWorkshopNode(current.kind) && stallOpen) {
        return (
            <>
                <WorkshopNode
                    run={run}
                    node={current}
                    ranch={ranch}
                    biomeName={biome?.name}
                    onEditLoadout={() => setEditorContext(contextLine('DEN'))}
                    onLeave={() => setClosedNodeId(current.id)}
                />
                {editor}
            </>
        );
    }

    /**
     * The event node — **ticket 168.** Opens on entry, like the stall and the bay, and closes only
     * once it is spent: an unresolved event has no Leave of its own.
     */
    if (current.kind === 'event' && leftEventKey !== `${current.id}:${current.visited}`) {
        return (
            <EventNode
                run={run}
                node={current}
                ranch={ranch}
                biomeName={biome?.name}
                onLeave={() => setLeftEventKey(`${current.id}:${current.visited}`)}
            />
        );
    }

    /**
     * The gauntlet takes the whole screen — **ticket 18.**
     *
     * Not a panel over the map like the shop and the bench, because the gauntlet is the one node you
     * cannot walk away from: `exploration-map.md` makes the gym three fights with no healing
     * between them, and a live map underneath would offer a walk that has no rule behind it. The
     * header stays (which gym, how far in, how much scrap) and so does the Settings button — quitting a
     * run (Settings → Abandon run) is always allowed, it just costs the run.
     */
    if (run.phase === 'gauntlet') {
        return (
            <div className="ranch-screen">
                <header className="ranch-header">
                    <h1><Icon name="gym" size={20} /> {gym?.name ?? run.gymId}</h1>
                    <RunMeta run={run} biomeName={biome?.name} traces={tracesHeld(ranch, run)} />
                    <SettingsButton />
                </header>

                <section className="ranch-section ranch-section-wide">
                    <GauntletNode
                        run={run}
                        node={current}
                        ranch={ranch}
                        onEditLoadout={() => setEditorContext(contextLine('PRE-GAUNTLET'))}
                    />
                </section>
                {editor}
            </div>
        );
    }

    /** The biome the alert is about, or undefined when no alert is owed. */
    const boundaryBiome = run.boundaryBiome !== undefined ? run.biomes[run.boundaryBiome] : undefined;

    return (
        <div className="ranch-screen">
            <header className="ranch-header">
                <h1>{gym?.name ?? run.gymId}</h1>
                <RunMeta run={run} biomeName={biome?.name} traces={tracesHeld(ranch, run)} />
                <PartyFaces members={partyMembers} patches={run?.patches} osOf={run ? (m) => effectiveOS(run, m) : undefined} />
                <SettingsButton />
            </header>

            <section className="ranch-section ranch-section-wide">
                <div className="ranch-section-head">
                    <h2><Icon name={NODE_ICON[current.kind]} size={18} /> {NODE_LABEL[current.kind]}{current.detour ? ' (detour)' : ''}</h2>
                </div>

                {/*
                  * The stall and the bay took the whole screen above. What is left here is the way
                  * back into one you closed with LEAVE: the node is not spent, you are still
                  * standing on it, and ticket 07's "entering a node triggers it again" is about
                  * walking IN rather than about re-opening a window you shut by accident.
                  */}
                {(isMarketNode(current.kind) || isWorkshopNode(current.kind)) && (
                    <button
                        type="button"
                        className="ranch-button"
                        onClick={() => { setClosedNodeId(null); playSfx('uiClick'); }}
                    >
                        {current.kind === 'town'
                            ? 'Back into town'
                            : isMarketNode(current.kind) ? 'Back to the stall' : 'Back to the summon bay'}
                    </button>
                )}

                {/*
                  * THE MACRO RACK, ON THE MAP — ticket 15.
                  *
                  * Battle macros are fired from `BattleArena`'s rack; what belongs *here* is the one
                  * macro that has no battle behaviour at all. Ticket 07's amendment: a map-reveal
                  * consumable, *"reveals the current biome's node types"*. `canFireMacro` refuses it
                  * inside a battle on purpose, so this button is its only firing path.
                  *
                  * The rest of the rack is still listed rather than hidden, because a consumable the
                  * player cannot see is a consumable they forget they bought — the same argument
                  * behind naming the pending node's ticket above.
                  */}
                <MapMacros run={run} biomeIndex={current.biomeIndex} biomeName={biome?.name} />

                {/*
                  * ONBOARDING — ticket 24. Above the map rather than inside it: `RegionMap` takes
                  * props and touches no store (its test renders it with no `<Provider>` at all), and
                  * reaching into the store from in there to read `seenTips` would spend that
                  * property on one strip.
                  */}
                <Callout tip={nextMapTip(run, ranch.seenTips)} />

                <RegionMap
                    nodes={run.nodes}
                    currentNodeId={run.currentNodeId}
                    partyElements={partyElements}
                    biomeNames={run.biomes.map((b) => b.name)}
                    biomeElements={run.biomes.map((b) => b.elements[0])}
                    // Ticket 142c: what a rival fields in each biome, off-biome element first — the
                    // same order `rivalElementPlan` deals the bodies in, so the map and the fight
                    // agree by construction rather than by two copies of one rule.
                    rivalElements={run.biomes.map((_, i) => rivalElementPlan(
                        run,
                        { biomeIndex: i, kind: 'rival' } as IRegionNode,
                        PARTY_SIZE,
                    ))}
                    // Ticket 176d: the species of every fight in a surveyed biome, rolled above.
                    encounters={surveyedFights}
                    onTravel={travel}
                />

                {/* TICKET 182a: the Party section and the deck/seed line are gone. The party is a
                    row of faces in the header, and the seed is in the exported run log. */}
            </section>

            {/*
              * THE BIOME BOUNDARY — ticket 61 §3's fourth surface, and the one Henry added after
              * the other three. `runSlice.resolveEncounter` raises `boundaryBiome` when the exit
              * elite dies; this is what it raises it FOR.
              *
              * Rendered here rather than from an effect for the reason the reducer's block gives:
              * the alert is a debt the run owes, so it survives a reload and cannot double-fire
              * under `StrictMode`. Both buttons clear the debt; only one of them opens the editor.
              */}
            {boundaryBiome !== undefined && (
                <BoundaryAlert
                    run={run}
                    ranch={ranch}
                    nextBiomeName={boundaryBiome.name}
                    nextBiomeElements={boundaryBiome.elements}
                    onIgnore={() => dispatch(dismissBoundaryAlert())}
                    onEdit={() => {
                        dispatch(dismissBoundaryAlert());
                        setEditorContext(`BIOME BOUNDARY · ${boundaryBiome.name.toUpperCase()} AHEAD · ${run.scrap} AMBER`);
                    }}
                />
            )}

            {editor}
        </div>
    );
}

/**
 * TICKET 182b — the macro slots on the map. Not drawn while all three are empty (a rack with
 * nothing in it is a panel with nothing to say); Show advanced content draws it anyway. A component
 * of its own so the hook is not called after one of `RunScreen`'s early returns.
 */
function MapMacros({ run, biomeIndex, biomeName }: {
    readonly run: IRunState;
    readonly biomeIndex: number;
    readonly biomeName: string | undefined;
}): ReactNode {
    const dispatch = useDispatch();
    const advanced = useAdvancedContent();
    if (!advanced && run.macros.every((id) => id === null)) return null;
    return (
        <>
            <h2 className="ranch-subhead">Draughts</h2>
            <div className="ranch-roster-grid">
                {run.macros.map((macroId, slot) => {
                    const macro = getMacro(macroId);
                    if (!macro) {
                        return (
                            <div key={slot} className="ranch-card">
                                <div className="ranch-card-name">Slot {slot + 1}</div>
                                <div className="ranch-card-species">empty</div>
                            </div>
                        );
                    }
                    const isMap = macro.targeting === 'MAP';
                    const alreadySurveyed = isMap && isBiomeRevealed(run, biomeIndex);
                    return (
                        <div key={slot} className="ranch-card">
                            <div className="ranch-card-name">{macro.name}</div>
                            <div className="ranch-card-species">{plain(macro.description)}</div>
                            {isMap && (
                                <button
                                    type="button"
                                    className="ranch-button"
                                    disabled={alreadySurveyed}
                                    onClick={() => {
                                        dispatch(fireMapReveal(slot));
                                        playSfx('rewardClaim');
                                    }}
                                >
                                    {alreadySurveyed
                                        ? 'This biome is already surveyed'
                                        : `Survey ${biomeName ?? 'this biome'}`}
                                </button>
                            )}
                            {!isMap && <div className="ranch-card-species">Fires in battle.</div>}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

