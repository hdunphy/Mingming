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
 *    a blueprint PLUS scrap at a mid-run workshop** (ticket 14 set that price at
 *    `WORKSHOP_ASSEMBLY_SCRAP` — 75, one market visit's scrap shared between the run's two
 *    recruits). So the ranch has no
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
import { RelicRegistry } from '../../engine/data/relicRegistry';
import { createRanchMember } from '../../engine/gameTypes';
import type { IRanchMember } from '../../engine/runTypes';
import { assembleMingming } from '../store/gameSlice';
import type { RootState } from '../store/store';
import FirmwareTerminal from '../components/FirmwareTerminal';
import { TypeChartPanel } from '../components/TypeChart';
import CodexScreen from './CodexScreen';
import Callout from '../components/Callout';
import { RANCH_BLUEPRINT_TIP } from '../../engine/tips';
import RunStart from './RunStart';
import { playSfx } from '../audio/AudioEngine';
import './RanchScreen.css';

type Section = 'expedition' | 'roster' | 'assembly' | 'vault' | 'codex';

/** Stable empty array, so the `no run in progress` selector does not re-render on every dispatch. */
const EMPTY_DRIVERS: ReadonlyArray<string> = [];

const SECTIONS: ReadonlyArray<{ id: Section; label: string; icon: string }> = [
    { id: 'expedition', label: 'Expedition', icon: '🗺' },
    { id: 'roster', label: 'Roster', icon: '🤖' },
    { id: 'assembly', label: 'Assembly', icon: '🔬' },
    { id: 'vault', label: 'Vault', icon: '💎' },
    { id: 'codex', label: 'Codex', icon: '📖' },
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

    const [section, setSection] = useState<Section>(initialSection);
    const [showFirmware, setShowFirmware] = useState(false);

    return (
        <div className="ranch-screen">
            <header className="ranch-header">
                <h1>🏡 Ranch</h1>
                <nav className="ranch-nav" aria-label="Ranch sections">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className={`ranch-nav-tab ${section === s.id ? 'active' : ''}`}
                            aria-current={section === s.id ? 'page' : undefined}
                            onClick={() => { playSfx('uiClick'); setSection(s.id); }}
                        >
                            <span aria-hidden="true">{s.icon}</span> {s.label}
                        </button>
                    ))}
                </nav>
            </header>

            {section === 'expedition' && <RunStart />}
            {section === 'roster' && (
                <RosterSection
                    roster={roster}
                    onOpenFirmware={() => setShowFirmware(true)}
                />
            )}
            {section === 'assembly' && <AssemblySection blueprints={blueprints} seenTips={seenTips} />}
            {section === 'vault' && <VaultSection drivers={drivers} />}
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
    onOpenFirmware,
}: {
    roster: ReadonlyArray<IRanchMember>;
    onOpenFirmware: () => void;
}): ReactNode {
    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Roster ({roster.length})</h2>
                <button type="button" className="ranch-button" onClick={onOpenFirmware}>
                    💾 Firmware terminal
                </button>
            </div>
            <p className="ranch-note">
                Everything you have ever assembled lives here, and none of it is committed to anything.
                <strong> The party is chosen at run start</strong> — up to three, one per species — so this
                list is your collection rather than a loadout. The team is the deck: each member brings its
                own start kit when a run begins.
            </p>

            {roster.length === 0 && (
                <div className="ranch-empty">
                    No mingmings yet. Spend a blueprint in <strong>Assembly</strong> to build one.
                </div>
            )}
            <div className="ranch-roster-grid">
                {roster.map((member) => (
                    <div key={member.id} className="ranch-card">
                        <div className="ranch-card-name">{member.nickname ?? GetMingmingData(member.definitionId).name}</div>
                        <div className="ranch-card-species">{GetMingmingData(member.definitionId).name}</div>
                        <StatRoll member={member} />
                        <div className="ranch-card-os">
                            <strong>{getOSBehavior(member.activeOS)?.name ?? member.activeOS}</strong>
                            <span>{getOSBehavior(member.activeOS)?.description}</span>
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
        <div className="ranch-ivs" title="Stat roll — fixed at assembly, 0-31 each">
            <span>⚔ {member.attackIV}</span>
            <span>🛡 {member.defenseIV}</span>
            <span>💚 {member.hpIV}</span>
        </div>
    );
}

// --- Assembly ----------------------------------------------------------------------------------

function AssemblySection({
    blueprints,
    seenTips,
}: {
    blueprints: Readonly<Record<string, number>>;
    seenTips: ReadonlyArray<string>;
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

    const confirm = (): void => {
        if (!pending) return;
        // The component mints the individual because it owns the RNG for the stat roll; the reducer
        // spends the blueprint and pushes in one step, so the two cannot come apart.
        const member: IRanchMember = createRanchMember(pending.speciesId, pending.osId);
        dispatch(assembleMingming(member));
        playSfx('rewardClaim');
        setBuilt(member);
        setPending(null);
    };

    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Assembly bay</h2>
            </div>

            {/*
              * ONBOARDING — ticket 24, the one ranch tip. It sits here rather than on the roster
              * tab because this is the screen where the sentence is actionable: the blueprints the
              * run banked are in front of you and the button spends one.
              */}
            <Callout tip={seenTips.includes(RANCH_BLUEPRINT_TIP.id) ? null : RANCH_BLUEPRINT_TIP} />

            <p className="ranch-note">
                Assembly costs <strong>one blueprint</strong> of the species and nothing else — scrap is
                run-scoped and buys nothing here. Stats roll once, at assembly, and never change:
                spending a second blueprint of the same species builds a second, differently-rolled
                individual. <strong>Re-assembly is the re-roll.</strong>
            </p>

            {held.length === 0 && (
                <div className="ranch-empty">
                    No blueprints. They drop from fights and from alpha nodes; each one builds exactly one
                    mingming.
                </div>
            )}

            <div className="ranch-blueprint-grid">
                {held.map(([speciesId, count]) => {
                    const definition = MingmingRegistry[speciesId];
                    return (
                        <div key={speciesId} className="ranch-blueprint">
                            <div className="ranch-blueprint-head">
                                <span className="ranch-blueprint-name">{definition?.name ?? speciesId}</span>
                                <span className="ranch-blueprint-count" title="Blueprints held">×{count}</span>
                            </div>
                            <div className="ranch-blueprint-element">{definition?.primaryElement ?? '—'}</div>
                            <button
                                type="button"
                                className="ranch-button"
                                onClick={() => { playSfx('uiClick'); setBuilt(null); setPending({ speciesId, osId: definition?.availableOS[0] ?? '' }); }}
                            >
                                Assemble (1 blueprint)
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
                <div className="ranch-built" role="status">
                    <div className="ranch-built-title">
                        Assembled {GetMingmingData(built.definitionId).name}
                    </div>
                    <StatRoll member={built} />
                    <div className="ranch-note">
                        This roll is permanent. Another blueprint of the same species rolls again.
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
            <div className="ranch-modal" role="dialog" aria-modal="true" aria-label="Choose firmware">
                <h3>Choose firmware for {GetMingmingData(speciesId).name}</h3>
                <p className="ranch-note">
                    The OS is active from the moment the individual joins a run. Reflashing it later costs
                    another blueprint.
                </p>
                <div className="ranch-os-options">
                    {options.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={`ranch-os-option ${osId === id ? 'selected' : ''}`}
                            onClick={() => onPick(id)}
                            aria-pressed={osId === id}
                        >
                            <strong>{getOSBehavior(id)?.name ?? id}</strong>
                            <span>{getOSBehavior(id)?.description ?? 'No firmware description.'}</span>
                        </button>
                    ))}
                </div>
                <div className="ranch-modal-actions">
                    <button type="button" className="ranch-button subtle" onClick={onCancel}>Cancel</button>
                    <button type="button" className="ranch-button" disabled={!osId} onClick={onConfirm}>
                        Spend blueprint
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Vault -------------------------------------------------------------------------------------

function VaultSection({ drivers }: { drivers: ReadonlyArray<string> }): ReactNode {
    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Vault</h2>
            </div>
            <p className="ranch-note">
                Drivers held by the run in progress — party-wide passives won from elites. Ticket 11 moved
                them to <code>IRunState.drivers</code>, which is where ticket 06 rules they belong: a
                driver dies with the run that won it, so there is nothing here to carry into the next one.
                This section is a readout, not a loadout, and ticket 16 gives drivers their own surface.
            </p>
            {drivers.length === 0 && (
                <div className="ranch-empty">
                    Nothing installed. Drivers are won from elites inside a run and are lost when it ends.
                </div>
            )}
            <div className="ranch-relic-grid">
                {drivers.map((driverId) => {
                    // Indexed, not `GetRelic`, which throws on an unknown id. A run carrying a driver
                    // that has since been renamed must not take the whole screen down with it.
                    const relic = RelicRegistry[driverId];
                    if (!relic) return null;
                    return (
                        <div key={driverId} className="ranch-relic">
                            <div className="ranch-relic-name">{relic.name}</div>
                            <div className="ranch-relic-desc">{relic.description}</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
