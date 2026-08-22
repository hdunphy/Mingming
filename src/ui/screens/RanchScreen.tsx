/**
 * The ranch — ticket 20 (steam-release map).
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
 *    a blueprint PLUS scrap at a mid-run workshop** (ticket 14 owns that price). So the ranch has no
 *    scrap economy at all — the flat 100-scrap `compileCost` and the deconstruct-cards-for-scrap
 *    panel are both gone, the latter because cards are run-scoped and there are none here to melt.
 *
 * 2. **Re-assembly IS the re-roll.** Blueprints are consumable and stats roll at first assembly, so
 *    spending a second kraken blueprint gives you a second, differently-rolled kraken. That is the
 *    entire collection depth `vision.md` asks for ("two krakens are not the same kraken"), and the
 *    Assembly section says so in as many words rather than leaving the player to infer it.
 *
 * 3. **No duplicate species in a party.** A standing law (map § Notes) that until ticket 20 lived
 *    only as a comment in `debug/balance/teamComps.ts` calling it an open question. `setActiveParty`
 *    enforces it now; this screen shows *why* a card is unavailable rather than ignoring the click,
 *    because a silently-dropped dispatch is indistinguishable from a bug.
 *
 * # WHAT IS DELIBERATELY NOT HERE
 *
 * No deck builder (cards are run-scoped — the team is the deck), no scrap counter, no XP bar
 * (ticket 21 deleted levelling outright; the stat roll is the whole of an individual's identity).
 * `DeckTerminal`, `HubScreen` and `SectorTerminal` survive as DEV-only tabs so the debug scenario
 * launcher keeps working; tickets 09 and 10 delete them when the run loop replaces what they do.
 */

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData, MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { RelicRegistry } from '../../engine/data/relicRegistry';
import { createMingmingInstance } from '../../engine/gameTypes';
import { PARTY_SIZE, partyBlockFor, type PartyBlock } from '../../engine/party';
import type { IMingmingState } from '../../engine/types';
import { assembleMingming, setActiveParty } from '../store/gameSlice';
import type { RootState } from '../store/store';
import FirmwareTerminal from '../components/FirmwareTerminal';
import { TypeChartPanel } from '../components/TypeChart';
import { playSfx } from '../audio/AudioEngine';
import './RanchScreen.css';

type Section = 'roster' | 'assembly' | 'vault';

const SECTIONS: ReadonlyArray<{ id: Section; label: string; icon: string }> = [
    { id: 'roster', label: 'Roster', icon: '🤖' },
    { id: 'assembly', label: 'Assembly', icon: '🔬' },
    { id: 'vault', label: 'Vault', icon: '💎' },
];

const BLOCK_TEXT: Record<PartyBlock, string> = {
    'party-full': 'Party is full',
    'duplicate-species': 'Already fielding this species',
};

export default function RanchScreen(): ReactNode {
    const dispatch = useDispatch();
    const { roster, activeParty, blueprints, relics } = useSelector((s: RootState) => s.game);

    const [section, setSection] = useState<Section>('roster');
    const [showFirmware, setShowFirmware] = useState(false);

    const party = useMemo(
        () => activeParty.map((id) => roster.find((m) => m.id === id)).filter((m): m is IMingmingState => !!m),
        [activeParty, roster],
    );

    const toggleParty = (member: IMingmingState): void => {
        if (activeParty.includes(member.id)) {
            dispatch(setActiveParty(activeParty.filter((id) => id !== member.id)));
            playSfx('uiClick');
            return;
        }
        if (partyBlockFor(member, party) !== null) {
            playSfx('uiError');
            return;
        }
        dispatch(setActiveParty([...activeParty, member.id]));
        playSfx('uiClick');
    };

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

            {section === 'roster' && (
                <RosterSection
                    roster={roster}
                    party={party}
                    activeParty={activeParty}
                    onToggle={toggleParty}
                    onOpenFirmware={() => setShowFirmware(true)}
                />
            )}
            {section === 'assembly' && <AssemblySection blueprints={blueprints} />}
            {section === 'vault' && <VaultSection relics={relics} />}

            {showFirmware && <FirmwareTerminal onClose={() => setShowFirmware(false)} />}
        </div>
    );
}

// --- Roster ------------------------------------------------------------------------------------

function RosterSection({
    roster,
    party,
    activeParty,
    onToggle,
    onOpenFirmware,
}: {
    roster: ReadonlyArray<IMingmingState>;
    party: ReadonlyArray<IMingmingState>;
    activeParty: ReadonlyArray<string>;
    onToggle: (member: IMingmingState) => void;
    onOpenFirmware: () => void;
}): ReactNode {
    const activeSet = new Set(activeParty);

    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Active party {party.length} / {PARTY_SIZE}</h2>
                <button type="button" className="ranch-button" onClick={onOpenFirmware}>
                    💾 Firmware terminal
                </button>
            </div>
            <p className="ranch-note">
                One member per species — a party of three is three different species. The team is the deck:
                each member brings its own start kit when a run begins.
            </p>

            <div className="ranch-party-grid">
                {Array.from({ length: PARTY_SIZE }, (_, slot) => {
                    const member = party[slot];
                    return (
                        <div
                            key={slot}
                            className={`ranch-slot ${member ? 'filled' : 'empty'}`}
                            onClick={() => member && onToggle(member)}
                        >
                            {member ? (
                                <>
                                    <div className="ranch-slot-name">{member.nickname ?? GetMingmingData(member.definitionId).name}</div>
                                    <StatRoll member={member} />
                                    <div className="ranch-slot-action">Click to remove</div>
                                </>
                            ) : (
                                <div className="ranch-slot-empty">Empty slot</div>
                            )}
                        </div>
                    );
                })}
            </div>

            <h2 className="ranch-subhead">Roster ({roster.length})</h2>
            {roster.length === 0 && (
                <div className="ranch-empty">
                    No mingmings yet. Spend a blueprint in <strong>Assembly</strong> to build one.
                </div>
            )}
            <div className="ranch-roster-grid">
                {roster.map((member) => {
                    const isActive = activeSet.has(member.id);
                    const block = isActive ? null : partyBlockFor(member, party);
                    return (
                        <button
                            key={member.id}
                            type="button"
                            className={`ranch-card ${isActive ? 'active' : ''} ${block ? 'blocked' : ''}`}
                            onClick={() => onToggle(member)}
                            aria-pressed={isActive}
                        >
                            <div className="ranch-card-name">{member.nickname ?? GetMingmingData(member.definitionId).name}</div>
                            <div className="ranch-card-species">{GetMingmingData(member.definitionId).name}</div>
                            <StatRoll member={member} />
                            {member.activeOS && (
                                <div className="ranch-card-os">
                                    <strong>{getOSBehavior(member.activeOS)?.name ?? member.activeOS}</strong>
                                    <span>{getOSBehavior(member.activeOS)?.description}</span>
                                </div>
                            )}
                            {isActive && <div className="ranch-card-badge">In party</div>}
                            {block && <div className="ranch-card-block">{BLOCK_TEXT[block]}</div>}
                        </button>
                    );
                })}
            </div>

            <TypeChartPanel />
        </section>
    );
}

/**
 * The individual's stat roll — the ONLY thing that distinguishes two members of a species now that
 * ticket 21 has deleted levelling. There is deliberately no XP bar to replace.
 */
function StatRoll({ member }: { member: IMingmingState }): ReactNode {
    return (
        <div className="ranch-ivs" title="Stat roll — fixed at assembly, 0-31 each">
            <span>⚔ {member.attackIV}</span>
            <span>🛡 {member.defenseIV}</span>
            <span>💚 {member.hpIV}</span>
        </div>
    );
}

// --- Assembly ----------------------------------------------------------------------------------

function AssemblySection({ blueprints }: { blueprints: Readonly<Record<string, number>> }): ReactNode {
    const dispatch = useDispatch();
    const [pending, setPending] = useState<{ speciesId: string; osId: string } | null>(null);
    const [built, setBuilt] = useState<IMingmingState | null>(null);

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
        const member: IMingmingState = { ...createMingmingInstance(pending.speciesId), activeOS: pending.osId };
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

function VaultSection({ relics }: { relics: ReadonlyArray<string> }): ReactNode {
    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>Vault</h2>
            </div>
            <p className="ranch-note">
                Relics found in past runs. Ticket 16 replaces these with <em>Drivers</em> — party-wide
                passives that live on the run, not the ranch — so this section is a holding pen, not a
                loadout.
            </p>
            {relics.length === 0 && <div className="ranch-empty">Nothing recovered yet.</div>}
            <div className="ranch-relic-grid">
                {relics.map((relicId) => {
                    // Indexed, not `GetRelic`, which throws on an unknown id. A save carrying a relic
                    // that has since been renamed must not take the whole screen down with it.
                    const relic = RelicRegistry[relicId];
                    if (!relic) return null;
                    return (
                        <div key={relicId} className="ranch-relic">
                            <div className="ranch-relic-name">{relic.name}</div>
                            <div className="ranch-relic-desc">{relic.description}</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
