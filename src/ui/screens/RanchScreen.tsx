/**
 * The ranch — ticket 20 (steam-release map), retargeted by ticket 11.
 *
 * # WHAT THIS REPLACES, AND WHY IT IS ONE SCREEN
 *
 * The pre-roguelike game spread permanent progression across five tabs: Hub, Terminal, Deck, Lab
 * and Relics. Under ticket 06's ratified model the ranch holds only four things — **assembled
 * individuals, blueprint counts, the codex, and what gyms/tiers are cleared** — and everything else
 * those tabs managed (cards, decks, scrap, relics-as-loadout) is run-scoped. Five tabs for four
 * nouns is four tabs too many, so ticket 20 collapses them into this one screen with three
 * sections.
 *
 * # THE THREE RULINGS THIS SCREEN IMPLEMENTS
 *
 * 1. **Assembly costs ONE BLUEPRINT and no scrap.** `vision.md` says "spend SCRAP to assemble";
 *    `economy-session.md` says "assembly (ranch AND workshop) costs blueprints only". Henry's
 *    ticket-06 ruling makes both true of the place each was describing: **a blueprint at the ranch,
 *    a blueprint PLUS scrap at a mid-run workshop** (ticket 14 proposed that price and ticket 56
 *    ruled it: `WORKSHOP_ASSEMBLY_SCRAP` — 25, about two and a half won wilds, roughly a quarter of
 *    a run's scrap across the two recruits). So the ranch has no
 *    scrap economy at all — the flat 100-scrap `compileCost` and the deconstruct-cards-for-scrap
 *    panel are both gone, the latter because cards are run-scoped and there are none here to melt.
 *
 * 2. **Re-assembly IS the re-roll.** Blueprints are consumable and stats roll at first assembly, so
 *    spending a second kraken blueprint gives you a second, differently-rolled kraken. That is the
 *    entire collection depth `vision.md` asks for ("two krakens are not the same kraken"), and the
 *    Assembly section says so in as many words rather than leaving the player to infer it.
 *
 * 3. **No duplicate species in a party.** A standing law (map § Notes) that until ticket 20 lived
 *    only as a comment in `debug/balance/teamComps.ts` calling it an open question. Ticket 11 moved
 *    the enforcement to where the party is now actually chosen — `RunStart`, via
 *    `engine/party.ts`'s `partyBlockFor` — because the ranch no longer holds a party at all.
 *
 * # WHAT TICKET 11 TOOK OUT OF THE ROSTER SECTION
 *
 * **Party management.** `IRanchState` has no `activeParty`, and that is the ruling rather than an
 * omission: the party is picked at run start (`IRunState.partyIds`), from the roster, for that run
 * only. A persistent ranch party would be a second, staler answer to the same question — and the
 * one the player last touched before a run would silently lose to whatever they picked in the
 * launch screen. So the Roster section is a list plus the firmware terminal, and the slot grid went
 * with the concept.
 *
 * # WHAT IS DELIBERATELY NOT HERE
 *
 * No deck builder (cards are run-scoped — the team is the deck), no scrap counter, no XP bar
 * (ticket 21 deleted levelling outright; the stat roll is the whole of an individual's identity).
 */

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData, MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { createRanchMember } from '../../engine/gameTypes';
import type { IRanchMember, IRunState } from '../../engine/runTypes';
import { assembleMingming } from '../store/gameSlice';
import type { RootState } from '../store/store';
import FirmwareTerminal from '../components/FirmwareTerminal';
import { TypeChartPanel } from '../components/TypeChart';
import CodexScreen from './CodexScreen';
import Callout from '../components/Callout';
import { RANCH_BLUEPRINT_TIP } from '../../engine/tips';
import RunStart from './RunStart';
import { playSfx } from '../audio/AudioEngine';
import '../theme/kit/kit.css';
import './RanchScreen.css';
import { Icon } from '../theme/Icon';
import { RuneTag } from '../components/RuneTag';
import { runeIdsOf } from '../components/runeIds';
import type { IconName } from '../theme/icons';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import { instinctName, plain } from '../labels/labels';
import { driverText } from '../labels/driverText';


type Section = 'expedition' | 'roster' | 'assembly' | 'vault' | 'codex';

/** Stable empty array, so the `no run in progress` selector does not re-render on every dispatch. */
const EMPTY_DRIVERS: ReadonlyArray<string> = [];
const EMPTY_TEMP_DRIVERS: ReadonlyArray<{ readonly driverId: string }> = [];

// Ticket 34: emoji out. `IconName` is a closed union, so a section cannot ask for a glyph that
// does not exist, and the icons take the section's own colour when it is active.
const SECTIONS: ReadonlyArray<{ id: Section; label: string; icon: IconName }> = [
    { id: 'expedition', label: 'Expedition', icon: 'expedition' },
    { id: 'roster', label: 'Roster', icon: 'roster' },
    { id: 'assembly', label: 'Summon', icon: 'assembly' },
    { id: 'vault', label: 'Vault', icon: 'vault' },
    { id: 'codex', label: 'Codex', icon: 'codex' },
];

export interface RanchScreenProps {
    /**
     * Which section to open on. Defaults to Expedition, because starting a run is the thing the
     * player came here to do — the roster and the assembly bay are what you visit *between* runs.
     * A prop rather than a hardcoded constant so tests can render one section directly:
     * `renderToStaticMarkup` cannot click a tab.
     */
    readonly initialSection?: Section;
}

export default function RanchScreen({ initialSection = 'expedition' }: RanchScreenProps = {}): ReactNode {
    const { roster, blueprints, seenTips, codex, codexMilestones } = useSelector((s: RootState) => s.game);
    // Ticket 11: drivers are run-scoped (`IRunState.drivers`). The Vault shows the run's, when
    // there is one — see `VaultSection` for why it is still here at all.
    const drivers = useSelector((s: RootState) => s.run.run?.drivers ?? EMPTY_DRIVERS);
    // Ticket 168b: the ones that last for the next fight only, listed after the permanent ones.
    const tempDrivers = useSelector((s: RootState) => s.run.run?.tempDrivers ?? EMPTY_TEMP_DRIVERS);

    // 194p: the runes the active run's bodies hold, shown on their roster cards (a ranch with no run has none).
    const run = useSelector((s: RootState) => s.run.run);

    const [section, setSection] = useState<Section>(initialSection);
    const [showFirmware, setShowFirmware] = useState(false);

    /*
     * TICKET 182b — a tab whose screen would be empty is not drawn. Expedition is what the ranch is
     * for, so it is always there; the open tab is always there too, so finishing the last build does
     * not pull the tab out from under its own confirmation. Show advanced content draws all five.
     */
    const advanced = useAdvancedContent();
    const hasBlueprints = Object.values(blueprints).some((count) => count > 0);
    const hasCodex = Object.values(codex).some((ledger) => ledger.length > 0) || codexMilestones.length > 0;
    const emptyTab: Readonly<Record<Section, boolean>> = {
        expedition: false,
        roster: roster.length === 0,
        assembly: !hasBlueprints,
        vault: drivers.length === 0 && tempDrivers.length === 0,
        codex: !hasCodex,
    };
    const visibleSections = SECTIONS.filter((s) => advanced || s.id === section || !emptyTab[s.id]);

    return (
        <div className="ranch-screen">
            <header className="ranch-header">
                <h1><Icon name="ranch" size={20} /> Ranch</h1>
                <nav className="ranch-nav" aria-label="Ranch sections">
                    {visibleSections.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className={`ranch-nav-tab k-button is-quiet ${section === s.id ? 'active is-on' : ''}`}
                            aria-current={section === s.id ? 'page' : undefined}
                            onClick={() => { playSfx('uiClick'); setSection(s.id); }}
                        >
                            <Icon name={s.icon} size={17} /> {s.label}
                        </button>
                    ))}
                </nav>
            </header>

            {section === 'expedition' && <RunStart />}
            {section === 'roster' && (
                <RosterSection
                    roster={roster}
                    run={run}
                    onOpenFirmware={() => setShowFirmware(true)}
                />
            )}
            {section === 'assembly' && (
                <AssemblySection blueprints={blueprints} seenTips={seenTips} rosterCount={roster.length} />
            )}
            {section === 'vault' && <VaultSection drivers={drivers} tempDrivers={tempDrivers} />}
            {/* Ticket 31. Props rather than its own `useSelector`, so the screen is renderable in a
                test from a plain object and the ranch stays the only thing that reads the store. */}
            {section === 'codex' && <CodexScreen codex={codex} firedMilestones={codexMilestones} />}

            {showFirmware && <FirmwareTerminal onClose={() => setShowFirmware(false)} />}
        </div>
    );
}

// --- Roster ------------------------------------------------------------------------------------

function RosterSection({
    roster,
    run,
    onOpenFirmware,
}: {
    roster: ReadonlyArray<IRanchMember>;
    run: IRunState | null | undefined;
    onOpenFirmware: () => void;
}): ReactNode {
    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Roster ({roster.length})</h2>
                <button type="button" className="ranch-button k-button" onClick={onOpenFirmware}>
                    <Icon name="firmware" size={15} /> Retrain
                </button>
            </div>
            {roster.length === 0 && (
                <div className="ranch-empty k-slant">
                    No mingmings yet. Spend a trace in <strong>Summon</strong> to build one.
                </div>
            )}
            <div className="ranch-roster-grid">
                {roster.map((member) => (
                    <div key={member.id} className="ranch-card k-plate">
                        <div className="ranch-card-name">{member.nickname ?? GetMingmingData(member.definitionId).name}</div>
                        <div className="ranch-card-species">{GetMingmingData(member.definitionId).name}</div>
                        <StatRoll member={member} />
                        <div className="ranch-card-os">
                            <strong>{instinctName(getOSBehavior(member.activeOS)?.name ?? member.activeOS)}</strong>
                            <span>{plain(getOSBehavior(member.activeOS)?.description)}</span>
                            <RuneTag patchIds={runeIdsOf(run, member.id)} osId={member.activeOS} />
                        </div>
                    </div>
                ))}
            </div>

            <TypeChartPanel />
        </section>
    );
}

/**
 * The individual's stat roll — the ONLY thing that distinguishes two members of a species now that
 * ticket 21 has deleted levelling. There is deliberately no XP bar to replace.
 */
function StatRoll({ member }: { member: IRanchMember }): ReactNode {
    return (
        <div className="ranch-ivs" title="Stat roll — fixed at summon, 0-31 each">
            <span><Icon name="attack" size={12} /> {member.attackIV}</span>
            <span><Icon name="defense" size={12} /> {member.defenseIV}</span>
            <span><Icon name="hp" size={12} /> {member.hpIV}</span>
        </div>
    );
}

// --- Assembly ----------------------------------------------------------------------------------

function AssemblySection({
    blueprints,
    seenTips,
    rosterCount,
}: {
    blueprints: Readonly<Record<string, number>>;
    seenTips: ReadonlyArray<string>;
    rosterCount: number;
}): ReactNode {
    const dispatch = useDispatch();
    const [pending, setPending] = useState<{ speciesId: string; osId: string } | null>(null);
    const [built, setBuilt] = useState<IRanchMember | null>(null);

    // Sorted so the list does not reshuffle as counts change — a species dropping to zero should
    // vanish from its place, not resort everything around it.
    const held = useMemo(
        () =>
            Object.entries(blueprints)
                .filter(([, count]) => count > 0)
                .sort(([a], [b]) => (GetMingmingData(a).name < GetMingmingData(b).name ? -1 : 1)),
        [blueprints],
    );

    const build = (choice: { speciesId: string; osId: string }): void => {
        // The component mints the individual because it owns the RNG for the stat roll; the reducer
        // spends the blueprint and pushes in one step, so the two cannot come apart.
        const member: IRanchMember = createRanchMember(choice.speciesId, choice.osId);
        dispatch(assembleMingming(member));
        playSfx('rewardClaim');
        setBuilt(member);
        setPending(null);
    };
    const confirm = (): void => {
        if (pending) build(pending);
    };
    /**
     * TICKET 182a (R3): v1 for everyone. The player's very first build, their starter, goes in on
     * its v1 firmware with no firmware modal; later builds keep the choice, with v1 picked.
     */
    const startAssembly = (speciesId: string): void => {
        const definition = MingmingRegistry[speciesId];
        const defaultOS = definition?.availableOS[0] ?? '';
        setBuilt(null);
        if (rosterCount === 0) {
            build({ speciesId, osId: defaultOS });
            return;
        }
        setPending({ speciesId, osId: defaultOS });
    };

    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Summon bay</h2>
            </div>

            {/*
              * ONBOARDING — ticket 24, the one ranch tip. It sits here rather than on the roster
              * tab because this is the screen where the sentence is actionable: the blueprints the
              * run banked are in front of you and the button spends one.
              */}
            <Callout tip={seenTips.includes(RANCH_BLUEPRINT_TIP.id) ? null : RANCH_BLUEPRINT_TIP} />

            {held.length === 0 && (
                <div className="ranch-empty k-slant">
                    No traces. They drop from fights and from alpha nodes; each one builds exactly one
                    mingming.
                </div>
            )}

            <div className="ranch-blueprint-grid">
                {held.map(([speciesId, count]) => {
                    const definition = MingmingRegistry[speciesId];
                    return (
                        <div key={speciesId} className="ranch-blueprint k-plate">
                            <div className="ranch-blueprint-head">
                                <span className="ranch-blueprint-name">{definition?.name ?? speciesId}</span>
                                <span className="ranch-blueprint-count" title="Traces held">×{count}</span>
                            </div>
                            <div className="ranch-blueprint-element">{definition?.primaryElement ?? '—'}</div>
                            <button
                                type="button"
                                className="ranch-button k-button"
                                onClick={() => { playSfx('uiClick'); startAssembly(speciesId); }}
                            >
                                Summon (1 trace)
                            </button>
                        </div>
                    );
                })}
            </div>

            {pending && (
                <OsPicker
                    speciesId={pending.speciesId}
                    osId={pending.osId}
                    onPick={(osId) => setPending({ ...pending, osId })}
                    onCancel={() => setPending(null)}
                    onConfirm={confirm}
                />
            )}

            {built && (
                <div className="ranch-built k-plate" role="status">
                    <div className="ranch-built-title">
                        Summoned {GetMingmingData(built.definitionId).name}
                    </div>
                    <StatRoll member={built} />
                    <div className="ranch-note">
                        This roll is permanent. Another trace of the same species rolls again.
                    </div>
                </div>
            )}
        </section>
    );
}

/**
 * OS choice, read from the registry rather than assumed.
 *
 * The old Synthesis Lab built the option list as `[`${species}_v1`, `${species}_v2`]`, which is true
 * of every species shipped so far and is not a rule. `FirmwareTerminal` was already fixed to read
 * `availableOS` (ticket 15); this is the same fix on the assembly side.
 */
function OsPicker({
    speciesId,
    osId,
    onPick,
    onCancel,
    onConfirm,
}: {
    speciesId: string;
    osId: string;
    onPick: (osId: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}): ReactNode {
    const options = GetMingmingData(speciesId).availableOS;
    const overlay: CSSProperties = { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 40 };

    return (
        <div style={overlay} className="ranch-modal-backdrop">
            <div className="ranch-modal k-plate" role="dialog" aria-modal="true" aria-label="Choose instinct">
                <h3>Choose instinct for {GetMingmingData(speciesId).name}</h3>
                <p className="ranch-note">
                    The instinct is active from the moment the individual joins a run. Retraining it later costs
                    another trace.
                </p>
                <div className="ranch-os-options">
                    {options.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={`ranch-os-option k-plate ${osId === id ? 'selected is-on' : ''}`}
                            onClick={() => onPick(id)}
                            aria-pressed={osId === id}
                        >
                            <strong>{instinctName(getOSBehavior(id)?.name ?? id)}</strong>
                            <span>{plain(getOSBehavior(id)?.description ?? 'No instinct description.')}</span>
                        </button>
                    ))}
                </div>
                <div className="ranch-modal-actions">
                    <button type="button" className="ranch-button k-button is-quiet subtle" onClick={onCancel}>Cancel</button>
                    <button type="button" className="ranch-button k-button" disabled={!osId} onClick={onConfirm}>
                        Spend trace
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Vault -------------------------------------------------------------------------------------

function VaultSection({ drivers, tempDrivers }: {
    drivers: ReadonlyArray<string>;
    tempDrivers: ReadonlyArray<{ readonly driverId: string }>;
}): ReactNode {
    const tempIds = tempDrivers.map((entry) => entry.driverId);
    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Vault</h2>
            </div>
            <p className="ranch-note">
                Party-wide passives won from elites. They end with the run that won them.
            </p>
            {drivers.length === 0 && tempIds.length === 0 && (
                <div className="ranch-empty k-slant">
                    No totems yet. Win one from an elite.
                </div>
            )}
            <div className="ranch-driver-grid">
                {drivers.map((driverId) => {
                    // `describeDriver` never throws: a run carrying a Driver that has since been
                    // renamed prints its id rather than taking the whole screen down with it.
                    const { name, description } = driverText(driverId);
                    return (
                        <div key={driverId} className="ranch-driver k-plate">
                            <div className="ranch-driver-name">{name}</div>
                            <div className="ranch-driver-desc">{description}</div>
                        </div>
                    );
                })}
                {tempIds.map((driverId) => {
                    // Ticket 168b: an event's penalty, gone after the next fight.
                    const { name, description } = driverText(driverId);
                    return (
                        <div key={`temp:${driverId}`} className="ranch-driver k-plate" data-temporary="true">
                            <div className="ranch-driver-name">{name} · next fight</div>
                            <div className="ranch-driver-desc">{description}</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
