/**
 * Scenario launcher — compose a battle field by field and drop into it.
 *
 * Ticket: `docs/wayfinder/debug-toolkit/tickets/23-scenario-launcher-panel.md`.
 * Visual spec: `docs/wayfinder/debug-toolkit/prototypes/04-scenario-launcher.html`, whose
 * locked layout decisions are listed in ticket 04's resolution — three columns
 * (player | enemies | live `ComposedSetup` JSON), per-unit `▸ more` disclosure,
 * `Mirror my save party` as the primary player action, `Match player level` opt-in on the
 * enemy column, blank seed = rolled at launch.
 *
 * WHERE THIS DEVIATES FROM THE MOCKUP — ticket 23's "Changes from the approved prototype":
 *   - the JSON column has a show/hide button, visible by default;
 *   - ad-hoc deck mode is CUT. Deck modes are base decks / saved deck. Ticket 11 retargeted
 *     "saved deck" at the RUN's deck (`IRunState.deck`), since the persistent deck and its
 *     builder are both gone;
 *   - relics stay here and take precedence over anything in the store, because
 *     `ComposedSetup.player.relics` is an explicit list that is never read from game state.
 *
 * THE DESTINATION-SLOT LINE ABOVE THE LAUNCH BUTTON IS LOAD-BEARING. Ending a scenario
 * battle writes blueprints and gym clears into whatever save slot is active — see
 * `destinationSlot()` in `../scenarios/composeScenario` for the mechanism. `Mirror my save
 * party` makes it very easy to be composing against your real run without noticing, so the
 * slot is named in plain words, in a warning banner, immediately above Launch.
 *
 * All composition logic lives in `../scenarios/composeScenario`; this file is controls and
 * `useState`. Load and save route through `loadScenario` / `saveScenario` so the
 * registry-hash mismatch warning fires (ticket 02 §2).
 */

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { rollSeed } from '../../engine/core/SeedStream';
import { Statuses, type StatusType } from '../../engine/types';
import type { RootState } from '../../ui/store/store';
import { useDebugUI } from '../debugUI';
import {
    MAX_PARTY,
    applySpecies,
    cardOptions,
    cardsModeWarning,
    createDraft,
    createEnemyUnit,
    createPlayerUnit,
    destinationSlot,
    draftFromSetup,
    launchBlockers,
    launchScenario,
    makeStatus,
    mirrorSaveParty,
    osOptions,
    relicOptions,
    resolveDeck,
    speciesOptions,
    toComposedSetup,
    type DeckMode,
    type LauncherDraft,
    type LauncherUnit,
} from '../scenarios/composeScenario';
import { createSlotOp, switchToSlot } from '../saveSlots';
import { listSlots } from '../../engine/SaveSlots';
import { describeRegistryMismatch, loadScenario, saveScenario } from '../scenarios/scenarioIO';
import { SCENARIO_FILE_EXTENSION } from '../scenarios/scenarioSchema';
import { triggerDownload } from '../snapshotIO';
import type { DebugPanelProps } from './types';

// --- Styles (inline, matching SaveEditorPanel/SaveSlotsPanel — no panel stylesheet) ---

const OK = '#6ee7a8';
const WARN = '#ffcc66';
const BAD = '#ff6b6b';
const LINE = 'rgba(122, 92, 255, 0.35)';

const columnStyle: CSSProperties = {
    border: `1px solid ${LINE}`,
    borderRadius: '6px',
    padding: '10px 12px',
    minWidth: 0,
};

const headingStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    marginBottom: '8px',
    font: '700 11px/1.6 monospace',
    letterSpacing: '0.1em',
    color: '#cfc4ff',
};

const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '5px',
    marginBottom: '5px',
};

const noteStyle: CSSProperties = {
    marginTop: '4px',
    opacity: 0.55,
    font: '11px/1.5 monospace',
};

const labelStyle: CSSProperties = {
    font: '600 10px/1.6 monospace',
    letterSpacing: '0.08em',
    opacity: 0.7,
};

const controlStyle: CSSProperties = {
    background: 'rgba(0, 0, 0, 0.35)',
    color: '#e6e0ff',
    border: `1px solid ${LINE}`,
    borderRadius: '4px',
    padding: '3px 6px',
    font: '11px/1.4 monospace',
};

const numberStyle: CSSProperties = { ...controlStyle, width: '56px' };

const unitStyle: CSSProperties = {
    border: `1px solid rgba(122, 92, 255, 0.2)`,
    borderRadius: '5px',
    padding: '7px 8px',
    marginBottom: '6px',
};

const advStyle: CSSProperties = {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: `1px dashed ${LINE}`,
};

const preStyle: CSSProperties = {
    margin: 0,
    padding: '8px',
    borderRadius: '4px',
    border: `1px solid ${LINE}`,
    background: 'rgba(0, 0, 0, 0.35)',
    font: '10.5px/1.5 monospace',
    maxHeight: '460px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
};

function buttonStyle(danger = false): CSSProperties {
    return {
        padding: '4px 10px',
        borderRadius: '4px',
        border: `1px solid ${danger ? BAD : '#7a5cff'}`,
        background: danger ? 'rgba(255, 107, 107, 0.14)' : 'rgba(122, 92, 255, 0.2)',
        color: danger ? '#ffd9d9' : '#e6e0ff',
        font: '600 11px/1.4 monospace',
        letterSpacing: '0.05em',
        cursor: 'pointer',
    };
}

function segmentStyle(active: boolean): CSSProperties {
    return {
        ...buttonStyle(),
        background: active ? 'rgba(122, 92, 255, 0.35)' : 'transparent',
        borderColor: active ? '#7a5cff' : LINE,
        color: active ? '#e6e0ff' : '#a79ccc',
    };
}

function pillStyle(active: boolean): CSSProperties {
    return {
        padding: '2px 9px',
        borderRadius: '999px',
        border: `1px solid ${active ? '#7a5cff' : 'rgba(122, 92, 255, 0.25)'}`,
        background: active ? 'rgba(122, 92, 255, 0.28)' : 'transparent',
        color: active ? '#e6e0ff' : '#a79ccc',
        font: '11px/1.5 monospace',
        cursor: 'pointer',
    };
}

function bannerStyle(tone: string): CSSProperties {
    return {
        border: `1px solid ${tone}`,
        borderLeft: `4px solid ${tone}`,
        borderRadius: '4px',
        padding: '8px 10px',
        marginBottom: '10px',
        background: 'rgba(0, 0, 0, 0.25)',
        color: tone,
        font: '11px/1.6 monospace',
        whiteSpace: 'pre-wrap',
    };
}

const launchButtonStyle: CSSProperties = {
    width: '100%',
    padding: '11px',
    borderRadius: '6px',
    border: 'none',
    background: 'linear-gradient(135deg, #7a5cff, #a78bfa)',
    color: '#fff',
    font: '700 14px/1.2 monospace',
    letterSpacing: '0.08em',
    cursor: 'pointer',
};

const launchDisabledStyle: CSSProperties = {
    ...launchButtonStyle,
    background: 'transparent',
    border: `1px solid ${LINE}`,
    color: '#6f688c',
    cursor: 'not-allowed',
};

// --- Small pieces ------------------------------------------------------------

/** Parse a numeric field, keeping "" meaningful (blank = omit the schema field). */
function readOptionalNumber(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? Math.trunc(value) : null;
}

function readNumber(raw: string, fallback: number): number {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
}

interface UnitEditorProps {
    unit: LauncherUnit;
    index: number;
    isEnemy: boolean;
    cardIds: string[];
    onChange: (next: LauncherUnit) => void;
    onRemove: () => void;
}

/**
 * One unit. Species / level / OS always visible; everything else behind `▸ more`, because
 * three party units plus enemies otherwise puts ~30 controls on screen at once (ticket 04).
 */
function UnitEditor({ unit, index, isEnemy, cardIds, onChange, onRemove }: UnitEditorProps): ReactNode {
    const species = useMemo(() => speciesOptions(), []);
    const [statusType, setStatusType] = useState<StatusType>(Statuses[0]);
    const [statusStacks, setStatusStacks] = useState('1');
    const [cardToAdd, setCardToAdd] = useState(cardIds[0] ?? '');

    const patch = (fields: Partial<LauncherUnit>) => onChange({ ...unit, ...fields });
    const side = isEnemy ? 'enemy' : 'party';

    return (
        <div style={unitStyle}>
            <div style={rowStyle}>
                <select
                    style={{ ...controlStyle, flex: '1 1 120px' }}
                    aria-label={`${side} ${index + 1} species`}
                    value={unit.definitionId}
                    onChange={(e) => onChange(applySpecies(unit, e.target.value))}
                >
                    {species.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name} · {option.element}
                        </option>
                    ))}
                </select>
                <button type="button" style={buttonStyle(true)} onClick={onRemove} title="remove">
                    ×
                </button>
            </div>
            <div style={rowStyle}>
                <span style={labelStyle}>OS</span>
                <select
                    style={{ ...controlStyle, flex: '1 1 120px' }}
                    aria-label={`${side} ${index + 1} OS`}
                    value={unit.activeOS}
                    onChange={(e) => patch({ activeOS: e.target.value })}
                >
                    {osOptions(unit.definitionId).map((os) => (
                        <option key={os} value={os}>
                            {os}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    style={{ ...buttonStyle(), background: 'transparent', borderColor: LINE }}
                    onClick={() => patch({ expanded: !unit.expanded })}
                >
                    {unit.expanded ? '▾ less' : '▸ more'}
                </button>
            </div>

            {unit.expanded && (
                <div style={advStyle}>
                    <div style={rowStyle}>
                        <span style={labelStyle}>IVS</span>
                        <input
                            style={numberStyle}
                            type="number"
                            min={0}
                            max={31}
                            title="Attack IV"
                            aria-label={`${side} ${index + 1} attack IV`}
                            value={unit.attackIV}
                            onChange={(e) => patch({ attackIV: readNumber(e.target.value, unit.attackIV) })}
                        />
                        <input
                            style={numberStyle}
                            type="number"
                            min={0}
                            max={31}
                            title="Defense IV"
                            aria-label={`${side} ${index + 1} defense IV`}
                            value={unit.defenseIV}
                            onChange={(e) => patch({ defenseIV: readNumber(e.target.value, unit.defenseIV) })}
                        />
                        <input
                            style={numberStyle}
                            type="number"
                            min={0}
                            max={31}
                            title="HP IV"
                            aria-label={`${side} ${index + 1} hp IV`}
                            value={unit.hpIV}
                            onChange={(e) => patch({ hpIV: readNumber(e.target.value, unit.hpIV) })}
                        />
                        <span style={{ ...labelStyle, opacity: 0.45 }}>atk / def / hp · 0–31</span>
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>HP</span>
                        <input
                            style={numberStyle}
                            type="number"
                            min={0}
                            placeholder="full"
                            aria-label={`${side} ${index + 1} current hp`}
                            value={unit.currentHp ?? ''}
                            onChange={(e) => patch({ currentHp: readOptionalNumber(e.target.value) })}
                        />
                        {isEnemy && (
                            <>
                                <span style={labelStyle}>MAX</span>
                                <input
                                    style={numberStyle}
                                    type="number"
                                    min={1}
                                    placeholder="calc"
                                    aria-label={`enemy ${index + 1} max hp override`}
                                    value={unit.maxHpOverride ?? ''}
                                    onChange={(e) => patch({ maxHpOverride: readOptionalNumber(e.target.value) })}
                                />
                            </>
                        )}
                        <span style={{ ...labelStyle, opacity: 0.45 }}>blank = full / derived</span>
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>STATUS</span>
                        <select
                            style={controlStyle}
                            aria-label={`${side} ${index + 1} status type`}
                            value={statusType}
                            onChange={(e) => setStatusType(e.target.value as StatusType)}
                        >
                            {Statuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                        <input
                            style={numberStyle}
                            type="number"
                            min={1}
                            aria-label={`${side} ${index + 1} status stacks`}
                            value={statusStacks}
                            onChange={(e) => setStatusStacks(e.target.value)}
                        />
                        <button
                            type="button"
                            style={buttonStyle()}
                            onClick={() =>
                                patch({
                                    statusEffects: [
                                        ...unit.statusEffects,
                                        makeStatus(
                                            statusType,
                                            Math.max(1, readNumber(statusStacks, 1)),
                                            unit.statusEffects.length,
                                        ),
                                    ],
                                })
                            }
                        >
                            + status
                        </button>
                    </div>
                    {unit.statusEffects.length > 0 && (
                        <div style={{ ...rowStyle, gap: '4px' }}>
                            {unit.statusEffects.map((status, statusIndex) => (
                                <button
                                    key={status.id}
                                    type="button"
                                    style={pillStyle(true)}
                                    title="remove"
                                    onClick={() =>
                                        patch({
                                            statusEffects: unit.statusEffects.filter((_, i) => i !== statusIndex),
                                        })
                                    }
                                >
                                    {status.type} ×{status.stacks} ✕
                                </button>
                            ))}
                        </div>
                    )}

                    {isEnemy && (
                        <>
                            <div style={rowStyle}>
                                <span style={labelStyle}>DECK</span>
                                <select
                                    style={{ ...controlStyle, flex: '1 1 120px' }}
                                    aria-label={`enemy ${index + 1} card to add`}
                                    value={cardToAdd}
                                    onChange={(e) => setCardToAdd(e.target.value)}
                                >
                                    {cardIds.map((id) => (
                                        <option key={id} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    style={buttonStyle()}
                                    disabled={cardToAdd === ''}
                                    onClick={() => patch({ deck: [...unit.deck, cardToAdd] })}
                                >
                                    + card
                                </button>
                            </div>
                            {unit.deck.length > 0 && (
                                <div style={{ ...rowStyle, gap: '4px' }}>
                                    {unit.deck.map((cardId, cardIndex) => (
                                        <button
                                            key={`${cardId}-${cardIndex}`}
                                            type="button"
                                            style={pillStyle(false)}
                                            title="remove"
                                            onClick={() =>
                                                patch({ deck: unit.deck.filter((_, i) => i !== cardIndex) })
                                            }
                                        >
                                            {cardId} ✕
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div style={noteStyle}>
                                Only played in CARDS mode. In MOVES mode enemies use their signature
                                moves and this list is inert.
                            </div>
                        </>
                    )}

                    {unit.moves !== undefined && (
                        <div style={noteStyle}>
                            carries {unit.moves.length} custom move(s) from the loaded file — preserved
                            verbatim, not editable here.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Panel -------------------------------------------------------------------

interface PanelStatus {
    ok: boolean;
    text: string;
}

export default function ScenarioLauncherPanel({ presentation }: DebugPanelProps): ReactNode {
    const dispatch = useDispatch();
    const ranch = useSelector((state: RootState) => state.game);
    // Ticket 11: the deck the "saved deck" mode reads is the RUN's, and so is the party that
    // `Mirror my save party` mirrors when there is one. Null is the normal state — you are at the
    // ranch — and the panel says so rather than pointing at a screen that no longer exists.
    const run = useSelector((state: RootState) => state.run.run);
    const { setOpen, setLastScenarioName } = useDebugUI();

    // Boots mirrored-plus-one-enemy, the state the approved mockup opens in: the party you
    // are actually running is the overwhelmingly common starting point, and an empty form
    // makes `Mirror my save party` look like an extra step rather than the default.
    const [draft, setDraft] = useState<LauncherDraft>(() => ({
        ...createDraft(),
        party: mirrorSaveParty(ranch, run),
        enemies: [createEnemyUnit()],
    }));
    const [showJson, setShowJson] = useState(true);
    // Bumped after a slot operation. `listSlots()` reads localStorage, which is not reactive, so
    // without this the dropdown would keep showing the pre-switch list.
    const [slotRevision, setSlotRevision] = useState(0);
    const [status, setStatus] = useState<PanelStatus | null>(null);
    const [mismatchBanner, setMismatchBanner] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const cardIds = useMemo(() => cardOptions(), []);
    const relics = useMemo(() => relicOptions(), []);

    const setup = toComposedSetup(draft, run);
    const deck = resolveDeck(draft, run);
    const blockers = launchBlockers(draft);
    const cardsWarning = cardsModeWarning(draft);
    // Read at render time, not memoized: localStorage is not reactive, and switching slots in
    // the Slots panel must be reflected the next time this panel draws.
    const slot = destinationSlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slotRevision is the invalidator
    const slots = useMemo(() => listSlots(), [slotRevision, ranch]);

    /**
     * Retarget the launch without leaving the panel.
     *
     * Delegates to `switchToSlot` rather than reimplementing the pointer move, so the containment
     * ordering (clear the live battle while the old slot is still active, then switch, then load)
     * has exactly one implementation. A refusal there changes nothing, so surfacing it is enough.
     *
     * The draft is deliberately left alone: a mirrored party still holds the *previous* slot's
     * roster ids, and silently rewriting someone's composition on a slot change would be worse
     * than telling them.
     */
    const onSwitchSlot = (slotId: string) => {
        if (slotId === slot.id) return;
        const result = switchToSlot(slotId, dispatch);
        setSlotRevision((n) => n + 1);
        setStatus(
            result.ok
                ? {
                      ok: true,
                      text:
                          `Now launching into ${slotId}. Your composition was kept — but a mirrored ` +
                          `party still holds the previous slot's roster ids, so re-run "Mirror my ` +
                          `save party" if you want this slot's roster.`,
                  }
                : { ok: false, text: `Slot switch refused — nothing changed:\n${result.issues.join('\n')}` },
        );
    };

    /** Create an empty scratch slot and switch to it — the two-step you almost always want here. */
    const onNewScratchSlot = () => {
        const taken = new Set(slots.map((s) => s.name));
        let name = 'scratch';
        for (let n = 2; taken.has(name); n += 1) name = `scratch ${n}`;

        const created = createSlotOp(name);
        if (!created.ok || !created.slot) {
            setSlotRevision((n) => n + 1);
            setStatus({ ok: false, text: `Could not create a slot:\n${created.issues.join('\n')}` });
            return;
        }
        onSwitchSlot(created.slot.id);
    };

    const patch = (fields: Partial<LauncherDraft>) => setDraft((current) => ({ ...current, ...fields }));

    const patchUnit = (isEnemy: boolean, index: number, next: LauncherUnit) =>
        setDraft((current) => {
            const list = isEnemy ? current.enemies : current.party;
            const updated = list.map((unit, i) => (i === index ? next : unit));
            return isEnemy ? { ...current, enemies: updated } : { ...current, party: updated };
        });

    const removeUnit = (isEnemy: boolean, index: number) =>
        setDraft((current) => {
            const list = isEnemy ? current.enemies : current.party;
            const updated = list.filter((_, i) => i !== index);
            return isEnemy ? { ...current, enemies: updated } : { ...current, party: updated };
        });

    // --- Actions ---

    const onLaunch = () => {
        // The ranch is passed so an *empty* slot is seeded with this battle's party — otherwise the
        // battle ends into a rosterless ranch and `App.tsx` falls through to the starter picker
        // (no nav bar, no way back to Debug). A slot that already has a roster is never touched.
        const result = launchScenario(setup, dispatch, ranch);
        if (!result.ok) {
            setStatus({ ok: false, text: result.error ?? 'Launch failed.' });
            return;
        }
        // Pin the seed that actually ran: a scenario you cannot re-run identically is not a repro.
        patch({ seed: result.seed! });
        setLastScenarioName(draft.name);
        // Rewriting someone's save, even an empty one, is never allowed to be invisible.
        const lines = [`Launched "${draft.name}" with seed ${result.seed}.`];
        if (result.seeded) {
            lines.push(
                `Seeded the empty "${slot.name}" ranch from this battle: ${setup.player.party.length} ` +
                    'mingming(s), with the battle\'s own roster ids. The deck and the drivers are NOT ' +
                    'seeded — they are run-scoped (ticket 11) and a scratch slot has no run. ' +
                    'Finish the battle and you land at the ranch with those individuals.',
            );
        } else if (result.seedIssues) {
            lines.push(
                `⚠ NOT seeded — the resulting ranch failed RanchStateSchema, so nothing was written ` +
                    `(a bad ranch wedges every autosave after it):\n${result.seedIssues.join('\n')}`,
            );
        }
        setStatus({ ok: true, text: lines.join('\n') });
        // Closes the floating layer. The docked Debug tab needs no close: `App.tsx` renders
        // `BattleArena` instead of the tab chain the moment `state.battle.battle` is non-null.
        setOpen(false);
    };

    const onSave = () => {
        const result = saveScenario({
            kind: 'composed',
            name: draft.name,
            description: `Composed in the scenario launcher against slot ${slot.id}.`,
            tags: ['launcher'],
            setup,
        });
        if (!result.success || result.json === undefined) {
            setStatus({ ok: false, text: result.error ?? 'saveScenario produced no output.' });
            return;
        }
        const fileName = `${slugify(draft.name)}${SCENARIO_FILE_EXTENSION}`;
        if (typeof document !== 'undefined') triggerDownload(fileName, result.json);
        setStatus({ ok: true, text: `Saved ${fileName}. Move it into src/debug/scenarios/.` });
    };

    const onLoadFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Re-picking the same file must re-fire `change`.
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file) return;

        setMismatchBanner(null);

        const result = loadScenario(await file.text());
        if (!result.scenario) {
            setStatus({ ok: false, text: result.error ?? 'Scenario failed to load.' });
            return;
        }
        if (result.scenario.kind !== 'composed') {
            setStatus({
                ok: false,
                text: `${file.name} is a snapshot, not a composed setup. Load it from the Snapshot panel.`,
            });
            return;
        }
        if (result.registryHashMismatch && result.currentRegistryHash) {
            setMismatchBanner(
                describeRegistryMismatch(result.scenario.registryHash, result.currentRegistryHash),
            );
        }

        setDraft(draftFromSetup(result.scenario.setup, result.scenario.name));
        setLastScenarioName(result.scenario.name);
        setStatus({ ok: true, text: `Loaded "${result.scenario.name}" from ${file.name}.` });
    };

    // --- Columns ---

    const playerColumn = (
        <div style={columnStyle}>
            <div style={headingStyle}>
                <span>PLAYER</span>
                <span style={{ opacity: 0.55 }}>
                    {draft.party.length} / {MAX_PARTY}
                </span>
            </div>
            <div style={rowStyle}>
                <button
                    type="button"
                    style={{ ...buttonStyle(), flex: '1 1 auto' }}
                    onClick={() => patch({ party: mirrorSaveParty(ranch, run) })}
                >
                    ⤓ Mirror my save party
                </button>
                <button
                    type="button"
                    style={buttonStyle()}
                    disabled={draft.party.length >= MAX_PARTY}
                    onClick={() => patch({ party: [...draft.party, createPlayerUnit()] })}
                >
                    + Unit
                </button>
            </div>
            {draft.party.length === 0 ? (
                <div style={noteStyle}>
                    No units. `Mirror my save party` copies the run's party — or the head of the ranch
                    roster when there is no run — species, IVs and activeOS verbatim.
                </div>
            ) : (
                draft.party.map((unit, index) => (
                    <UnitEditor
                        key={index}
                        unit={unit}
                        index={index}
                        isEnemy={false}
                        cardIds={cardIds}
                        onChange={(next) => patchUnit(false, index, next)}
                        onRemove={() => removeUnit(false, index)}
                    />
                ))
            )}

            <div style={{ ...headingStyle, marginTop: '12px' }}>
                <span>DECK</span>
            </div>
            <div style={rowStyle}>
                {(['base', 'saved'] as DeckMode[]).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        style={segmentStyle(draft.deckMode === mode)}
                        onClick={() => patch({ deckMode: mode })}
                    >
                        {mode === 'base' ? 'Base decks' : 'Run deck'}
                    </button>
                ))}
                {draft.deckMode === 'loaded' && (
                    <span style={{ ...labelStyle, color: WARN }}>from file</span>
                )}
            </div>
            <div style={noteStyle}>
                {deck.source}
                {draft.deckMode === 'base' &&
                    ' — one shared pool across the party, per schema v1. Changing species rebuilds it.'}
                {draft.deckMode === 'saved' && ' — the deck the run in progress is carrying.'}
                {draft.deckMode === 'loaded' &&
                    ' — kept read-only so loading and re-saving a scenario does not rewrite its deck. Pick a mode above to replace it.'}
            </div>
            <div style={noteStyle}>
                No ad-hoc deck builder here, by decision. Ticket 11 deleted the persistent deck and its
                builder along with it: a deck belongs to a run, so the two honest sources are the party's
                base decks and whatever a live run has built up.
            </div>
            {deck.issues.map((issue) => (
                <div key={issue} style={{ ...noteStyle, color: WARN, opacity: 1 }}>
                    {issue}
                </div>
            ))}

            <div style={{ ...headingStyle, marginTop: '12px' }}>
                <span>RELICS</span>
            </div>
            <div style={{ ...rowStyle, gap: '4px' }}>
                {relics.map((relic) => (
                    <button
                        key={relic.id}
                        type="button"
                        style={pillStyle(draft.relics.includes(relic.id))}
                        title={relic.description}
                        onClick={() =>
                            patch({
                                relics: draft.relics.includes(relic.id)
                                    ? draft.relics.filter((id) => id !== relic.id)
                                    : [...draft.relics, relic.id],
                            })
                        }
                    >
                        {relic.name}
                    </button>
                ))}
            </div>
            <div style={noteStyle}>
                This list is the scenario's relics outright — `ComposedSetup.player.relics` is never
                read from game state, so what is picked here is what the battle starts with, whatever
                the ranch or the run in progress holds.
            </div>
        </div>
    );

    const enemyColumn = (
        <div style={columnStyle}>
            <div style={headingStyle}>
                <span>ENEMIES</span>
                <span style={{ opacity: 0.55 }}>{draft.enemies.length}</span>
            </div>
            <div style={rowStyle}>
                <button
                    type="button"
                    style={{ ...buttonStyle(), flex: '1 1 auto' }}
                    onClick={() => patch({ enemies: [...draft.enemies, createEnemyUnit()] })}
                >
                    + Enemy
                </button>
            </div>
            {draft.enemies.length === 0 ? (
                <div style={noteStyle}>No enemies yet. A battle needs at least one.</div>
            ) : (
                draft.enemies.map((unit, index) => (
                    <UnitEditor
                        key={index}
                        unit={unit}
                        index={index}
                        isEnemy
                        cardIds={cardIds}
                        onChange={(next) => patchUnit(true, index, next)}
                        onRemove={() => removeUnit(true, index)}
                    />
                ))
            )}
            {cardsWarning && <div style={bannerStyle(WARN)}>{cardsWarning}</div>}
        </div>
    );

    const jsonColumn = (
        <div style={columnStyle}>
            <div style={headingStyle}>
                <span>ComposedSetup</span>
                <button type="button" style={buttonStyle()} onClick={() => setShowJson(false)}>
                    hide
                </button>
            </div>
            <pre style={preStyle}>{JSON.stringify(setup, null, 2)}</pre>
            <div style={noteStyle}>
                Live. This is exactly what `save` writes to a <code>{SCENARIO_FILE_EXTENSION}</code>,
                minus the stamped envelope.
            </div>
        </div>
    );

    const gridColumns = presentation === 'docked' ? (showJson ? '1fr 1fr 340px' : '1fr 1fr') : '1fr';

    return (
        <div>
            {mismatchBanner && (
                <div style={bannerStyle(WARN)} role="alert">
                    {mismatchBanner}
                </div>
            )}
            {status && (
                <div style={bannerStyle(status.ok ? OK : BAD)}>
                    <strong>{status.ok ? 'OK' : 'FAILED'}</strong>
                    {`\n${status.text}`}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: '10px', alignItems: 'start' }}>
                {playerColumn}
                {enemyColumn}
                {showJson ? (
                    jsonColumn
                ) : (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button type="button" style={buttonStyle()} onClick={() => setShowJson(true)}>
                            show ComposedSetup JSON
                        </button>
                    </div>
                )}
            </div>

            <div style={{ ...columnStyle, marginTop: '10px' }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>SEED</span>
                    <input
                        style={{ ...controlStyle, flex: '1 1 200px' }}
                        aria-label="seed"
                        placeholder="blank = roll a random seed on launch"
                        value={draft.seed}
                        onChange={(e) => patch({ seed: e.target.value })}
                    />
                    <button type="button" style={buttonStyle()} onClick={() => patch({ seed: rollSeed() })}>
                        ⟳ Roll
                    </button>

                    <span style={{ ...labelStyle, marginLeft: '10px' }}>ENEMY MODE</span>
                    {(['MOVES', 'CARDS'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            style={segmentStyle(draft.enemyMode === mode)}
                            onClick={() => patch({ enemyMode: mode })}
                        >
                            {mode}
                        </button>
                    ))}

                    <label style={{ ...labelStyle, marginLeft: '10px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={draft.gauntlet !== null}
                            onChange={(e) =>
                                patch({
                                    gauntlet: e.target.checked
                                        ? {
                                              type: 'Gym',
                                              element: 'Fire',
                                              currentBattleIndex: 0,
                                              totalBattles: 3,
                                              persistedStats: {},
                                          }
                                        : null,
                                })
                            }
                        />{' '}
                        GAUNTLET CONTEXT
                    </label>
                </div>

                {draft.gauntlet && (
                    <div style={rowStyle}>
                        <span style={labelStyle}>TYPE</span>
                        <select
                            style={controlStyle}
                            aria-label="gauntlet type"
                            value={draft.gauntlet.type}
                            onChange={(e) =>
                                patch({ gauntlet: { ...draft.gauntlet!, type: e.target.value as 'Gym' | 'Sector' } })
                            }
                        >
                            <option value="Gym">Gym</option>
                            <option value="Sector">Sector</option>
                        </select>
                        <span style={labelStyle}>ELEMENT</span>
                        <input
                            style={{ ...controlStyle, width: '90px' }}
                            aria-label="gauntlet element"
                            value={draft.gauntlet.element}
                            onChange={(e) => patch({ gauntlet: { ...draft.gauntlet!, element: e.target.value } })}
                        />
                        <span style={labelStyle}>BATTLE</span>
                        <input
                            style={numberStyle}
                            type="number"
                            min={0}
                            aria-label="gauntlet battle index"
                            value={draft.gauntlet.currentBattleIndex}
                            onChange={(e) =>
                                patch({
                                    gauntlet: {
                                        ...draft.gauntlet!,
                                        currentBattleIndex: readNumber(e.target.value, 0),
                                    },
                                })
                            }
                        />
                        <span style={labelStyle}>OF</span>
                        <input
                            style={numberStyle}
                            type="number"
                            min={1}
                            aria-label="gauntlet total battles"
                            value={draft.gauntlet.totalBattles}
                            onChange={(e) =>
                                patch({
                                    gauntlet: { ...draft.gauntlet!, totalBattles: readNumber(e.target.value, 1) },
                                })
                            }
                        />
                        <span style={{ ...labelStyle, opacity: 0.45 }}>
                            run context for the injection layer — `IBattleState` has no gauntlet field
                        </span>
                    </div>
                )}

                <div style={rowStyle}>
                    <span style={labelStyle}>NAME</span>
                    <input
                        style={{ ...controlStyle, flex: '1 1 200px' }}
                        aria-label="scenario name"
                        value={draft.name}
                        onChange={(e) => patch({ name: e.target.value })}
                    />
                    <label style={buttonStyle()}>
                        📂 Load {SCENARIO_FILE_EXTENSION}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            onChange={onLoadFile}
                            style={{ display: 'none' }}
                        />
                    </label>
                    <button type="button" style={buttonStyle()} onClick={onSave}>
                        💾 Save composition
                    </button>
                </div>
                <div style={noteStyle}>
                    Both routes go through `loadScenario` / `saveScenario`, so a file authored against a
                    different data registry loads with the drift warning rather than silently.
                </div>
            </div>

            {/* The safety affordance. Named slot, plain words, immediately above Launch. */}
            <div style={{ ...bannerStyle(WARN), marginTop: '10px', marginBottom: '6px' }}>
                <strong>⚠ {slot.headline}</strong>
                {'\n'}
                Finishing this battle writes blueprints and gym clears into that save, and its scrap,
                cards and drivers into whatever run is in progress. A mirrored party reuses real
                roster ids. To break things safely, launch into a scratch slot.
                <div
                    style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: '8px',
                    }}
                >
                    <span style={labelStyle}>launch into</span>
                    <select
                        value={slot.id}
                        onChange={(event) => onSwitchSlot(event.target.value)}
                        style={{ ...controlStyle, flex: '0 1 220px' }}
                        aria-label="destination save slot"
                        title="Switch the save slot this battle will end into"
                    >
                        {slots.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name} ({option.id})
                            </option>
                        ))}
                    </select>
                    <button type="button" style={buttonStyle()} onClick={onNewScratchSlot}>
                        + new scratch slot
                    </button>
                    <span style={{ ...noteStyle, margin: 0 }}>
                        Switching clears any live battle first. Branch / rename / delete live in the
                        Slots panel.
                    </span>
                </div>
            </div>

            {blockers.length > 0 && <div style={bannerStyle(BAD)}>{blockers.join('\n')}</div>}

            <button
                type="button"
                style={blockers.length === 0 ? launchButtonStyle : launchDisabledStyle}
                disabled={blockers.length > 0}
                onClick={onLaunch}
                title={`Launch into ${slot.name} (${slot.id})`}
            >
                ▶ LAUNCH BATTLE INTO {slot.name.toUpperCase()}
            </button>
        </div>
    );
}
