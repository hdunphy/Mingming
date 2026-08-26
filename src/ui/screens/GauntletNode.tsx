/**
 * THE PIT STOP — the gym gauntlet's between-fights screen, ticket 18.
 *
 * # WHAT THE PLAYER IS LOOKING AT
 *
 * `exploration-map.md` rules the gym a gauntlet of **three fights with no healing between them**,
 * and ticket 18 asks for the screen that sits in the gaps: *"A between-fights screen (the old 'Pit
 * Stop' idea) showing HP, Macros, and the next opponent's visible types."* Those three things are
 * not a list of widgets, they are the three terms of the only decision on offer here — **is the
 * party healthy enough to walk into what is coming, or is this the moment to spend a consumable?**
 * — so each one is shown in the form that decision needs:
 *
 * 1. **HP as a fraction of max, per member, with DOWN called out.** HP is the resource the gauntlet
 *    is about; a bar with no number cannot be compared against an opponent.
 * 2. **The macro rack, in full, including what each macro will do.** A Revive is only worth holding
 *    if the player knows they are holding one. Battle macros cannot be *fired* from here (they need
 *    a battle to target into), and the buttons say so rather than being absent — a rack that
 *    disappears between fights is a rack the player forgets they bought.
 * 3. **The next opponent's ELEMENTS, and nothing else.** `exploration-map.md`'s visibility rule is
 *    "types visible, contents hidden", and it does not lapse because this is the last node: a
 *    species list would hand over the counter-pick the run was supposed to have already made.
 *    `gauntlet.gauntletOpponentElements` rolls it from the same seed the fight will use, so what is
 *    promised here is what walks out.
 *
 * # WHY THERE IS NO MAP UNDERNEATH IT
 *
 * `MarketplaceNode` and `WorkshopNode` are panels drawn *over* a live map, deliberately: a shop is a
 * thing at the place you are standing and ticket 07 makes leaving it a matter of walking to a
 * neighbour. The gauntlet is the opposite — three fights with no way out but through — so
 * `RunScreen` renders this **instead of** the region map. Leaving the map up would offer a walk the
 * run has no rule for, which is worse than offering nothing.
 *
 * # WHY THE FIGHT STARTS FROM A BUTTON
 *
 * Every other fight in the run starts from an effect on `run.phase` the moment the player steps onto
 * the node. A gauntlet fight does not, because the whole point of this screen is that the player
 * gets to look before the next one starts. The button is the look ending.
 *
 * Follows `WorkshopNode`'s bones: one panel, real `<button>`s, and a disabled control always says
 * what it is short of (ticket 20's precedent, and ticket 38 inherits screens that already work
 * without a mouse).
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { getMacro } from '../../engine/data/macroRegistry';
import { buildBattleSetup, toMingmingState } from '../../engine/run/battleSetup';
import { RUN_ENEMY_MODE } from '../../engine/run/encounter';
import {
    GAUNTLET_ENEMY_COUNT,
    gauntletOpponentElements,
    isBossFight,
    rollGauntletFight,
} from '../../engine/run/gauntlet';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { initializeBattleEntity } from '../../engine/types';
import type { IRanchMember, IRanchState, IRegionNode, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { startBattle } from '../store/battleSlice';
import './GauntletNode.css';

export interface GauntletNodeProps {
    readonly run: IRunState;
    /** The gym node, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    /** The ranch — the party's species, firmware and stat rolls all live on the roster. */
    readonly ranch: IRanchState;
    /**
     * Opens the shared `LoadoutEditor`. Ticket 61 §3's PRE-GAUNTLET surface — see the button for
     * why it is offered before fight one and never between fights. Optional so a test can render
     * the screen without a store behind the editor.
     */
    readonly onEditLoadout?: () => void;
}

/** One party member as this screen has to describe them: who they are, and what they have left. */
interface MemberLine {
    readonly id: string;
    readonly name: string;
    readonly element: string;
    readonly maxHp: number;
    /** Carried HP, or full when nothing is carried — fight 1 opens with the party whole. */
    readonly currentHp: number;
    readonly down: boolean;
}

export default function GauntletNode({ run, node, ranch, onEditLoadout }: GauntletNodeProps): ReactNode {
    const dispatch = useDispatch();
    const gauntlet = run.gauntlet;

    /**
     * The party, priced in HP.
     *
     * Max HP is derived by building the entity the fight will build (`initializeBattleEntity`)
     * rather than by a second stat formula here — the number on this screen has to be the number in
     * the arena, and there is exactly one function that knows it.
     */
    const party = useMemo<MemberLine[]>(() => {
        if (!gauntlet) return [];
        const lines: MemberLine[] = [];
        for (const id of run.partyIds) {
            const member: IRanchMember | undefined = ranch.roster.find((m) => m.id === id);
            if (!member) continue;
            const definition = GetMingmingData(member.definitionId);
            const entity = initializeBattleEntity(toMingmingState(member), definition);
            const carried = gauntlet.persistedHp[id];
            lines.push({
                id,
                name: member.nickname ?? definition.name,
                element: definition.primaryElement,
                maxHp: entity.maxHp,
                // Absent means "not carrying anything yet", which is full — the same distinction
                // `IBattleSetup.persistedHp` makes, and the reason a 0 is not the same as a gap.
                currentHp: carried === undefined ? entity.maxHp : carried,
                down: gauntlet.downedMemberIds.includes(id),
            });
        }
        return lines;
    }, [gauntlet, ranch, run.partyIds]);

    /** The elements walking out next. Rolled from the fight's own seed — see the header. */
    const opponentElements = useMemo(
        () => (gauntlet ? gauntletOpponentElements({ run, node, fightIndex: gauntlet.fightIndex }) : []),
        [gauntlet, run, node],
    );

    // `RunScreen` only renders this under `phase: 'gauntlet'`, which `RunStateSchema` refuses
    // without progress attached. Rendering nothing is the honest answer to a state that cannot
    // happen rather than a fallback worth designing.
    if (!gauntlet) return null;

    const gym = GYM_REGISTRY[run.gymId];
    const fightNumber = gauntlet.fightIndex + 1;
    const boss = isBossFight(gauntlet.fightIndex, gauntlet.totalFights);
    const everyoneDown = party.length > 0 && party.every((m) => m.down);

    /**
     * Start the fight the run is standing in front of.
     *
     * The same three lines every fight in the run starts with (`RunScreen`'s trigger effect), with
     * the encounter rolled by `rollGauntletFight` instead of `rollEncounter` — including seeding the
     * battle from the fight's own seed, which is what makes the shuffle and the opening hand replay
     * along with the enemies when a resumed gauntlet rebuilds this fight.
     */
    const begin = (): void => {
        const encounter = rollGauntletFight({ run, node, fightIndex: gauntlet.fightIndex });
        dispatch(startBattle({
            setup: buildBattleSetup(ranch, run, encounter),
            enemyIds: [],
            options: { seed: encounter.seed, enemyMode: RUN_ENEMY_MODE },
        }));
        playSfx('uiClick');
    };

    return (
        <section className="gn">
            <header className="gn-head">
                <h2 className="gn-title">
                    🏛 {gym?.name ?? run.gymId} gauntlet — fight {fightNumber} of {gauntlet.totalFights}
                </h2>
                <div className="gn-progress" aria-label="Gauntlet progress">
                    {Array.from({ length: gauntlet.totalFights }, (_, i) => (
                        <span
                            key={i}
                            className={`gn-pip ${i < gauntlet.fightIndex ? 'done' : ''} ${i === gauntlet.fightIndex ? 'now' : ''}`}
                        >
                            {i < gauntlet.fightIndex ? '✔' : i + 1}
                        </span>
                    ))}
                </div>
                <p className="gn-note">
                    <strong>No healing between these three fights.</strong> Damage carries; a member
                    who falls stays down until something brings them back, and nothing here is a rest
                    stop. What you spend now is what you have.
                </p>
            </header>

            {/* --- The party: the resource being managed --- */}

            <div className="gn-section-head">
                <h3>Party</h3>
                <span className="gn-tag-note">HP carries between fights</span>
            </div>

            <ul className="gn-list">
                {party.map((member) => {
                    const pct = Math.max(0, Math.min(100, Math.round((member.currentHp / member.maxHp) * 100)));
                    return (
                        <li key={member.id} className={`gn-row ${member.down ? 'down' : ''}`}>
                            <div className="gn-row-card">
                                <span className="gn-row-name">{member.name}</span>
                                <span className="gn-row-meta">{member.element}</span>
                                {member.down && <span className="gn-tag danger">Down — revivable</span>}
                            </div>
                            <div className="gn-hp">
                                <span className="gn-hp-figure">{member.currentHp}/{member.maxHp}</span>
                                <span className="gn-hp-track" aria-hidden="true">
                                    <span className="gn-hp-fill" style={{ width: `${pct}%` }} />
                                </span>
                            </div>
                        </li>
                    );
                })}
                {party.length === 0 && <li className="gn-empty">No party members. There is nothing to field.</li>}
            </ul>

            {/* --- The rack --- */}

            <div className="gn-section-head">
                <h3>Macros</h3>
                <span className="gn-tag-note">single use · fired free on your turn</span>
            </div>

            <ul className="gn-list">
                {run.macros.map((macroId, slot) => {
                    const macro = getMacro(macroId);
                    return (
                        <li key={slot} className={`gn-row ${macro ? '' : 'empty-slot'}`}>
                            <div className="gn-row-card">
                                <span className="gn-row-name">{macro?.name ?? `Slot ${slot + 1}`}</span>
                                <span className="gn-row-meta">{macro?.description ?? 'empty'}</span>
                            </div>
                            {/*
                              * Not a button. Every macro that matters here (Revive, Mend, Surge)
                              * needs a unit to point at, and the units are in the battle — so the
                              * rack is fired from `BattleArena`, and this says which macros are
                              * coming with you rather than offering a click that cannot land.
                              */}
                            <span className="gn-tag">
                                {macro === undefined
                                    ? 'nothing to bring'
                                    : macro.targeting === 'MAP'
                                        ? 'fires on the map — not inside the gauntlet'
                                        : 'fires in the fight'}
                            </span>
                        </li>
                    );
                })}
            </ul>

            {/* --- What is coming --- */}

            <div className="gn-section-head">
                <h3>{boss ? 'The leader’s own team' : 'Next opponent'}</h3>
                <span className="gn-tag-note">{GAUNTLET_ENEMY_COUNT} of them, always</span>
            </div>
            <p className="gn-note">
                {boss
                    ? `One drawn from each of the three biomes you walked, each running signature
                       firmware. The region was the syllabus; this is the exam.`
                    : `Recruited out of the region’s own species — the same pools the biomes you
                       walked field.`}
                {party.length < GAUNTLET_ENEMY_COUNT && (
                    <>
                        {' '}The gauntlet is always {GAUNTLET_ENEMY_COUNT} strong, whatever you bring:
                        you are fielding {party.length}.
                    </>
                )}
            </p>

            <ul className="gn-enemies">
                {opponentElements.map((element, index) => (
                    <li key={index} className={`gn-enemy ${boss ? 'boss' : ''}`}>
                        <span className="gn-enemy-element">{element}</span>
                        <span className="gn-enemy-meta">{boss ? 'signature firmware' : 'type known, name hidden'}</span>
                    </li>
                ))}
            </ul>

            <div className="gn-actions">
                {/*
                  * THE PRE-GAUNTLET EDIT — ticket 61 §3's fourth surface, and the last one there is.
                  *
                  * Offered ONLY before the first fight. `exploration-map.md` makes the gauntlet
                  * three fights with no healing between them, and an editor between rounds two and
                  * three would be the same as a heal: it would let a player answer the boss they
                  * just saw with a deck they did not bring. Before fight one is the moment the
                  * ruling names, and `gauntlet.fightIndex === 0` is that moment exactly.
                  */}
                {onEditLoadout && gauntlet.fightIndex === 0 && (
                    <button type="button" className="gn-button subtle" onClick={onEditLoadout}>
                        Edit loadout — last chance before the gym
                    </button>
                )}
                <button
                    type="button"
                    className="gn-button"
                    disabled={party.length === 0 || everyoneDown}
                    onClick={begin}
                >
                    {party.length === 0
                        ? 'No party to field'
                        : everyoneDown
                            ? 'Every member is down — nothing left to send in'
                            : `Begin fight ${fightNumber} of ${gauntlet.totalFights}`}
                </button>
            </div>
        </section>
    );
}
