/**
 * Save slots — pick which save the session writes to.
 *
 * WHY THIS PANEL IS THE POINT OF THE WHOLE TICKET
 *
 * Injecting a debug battle is safe. *Ending* one is not: `BattleArena` dispatches
 * `syncPartyStats`, `applyRewardBundle`, `addRelic` and the gauntlet actions into `gameSlice`,
 * and `src/ui/store/store.ts:43-54` autosaves every game-state change straight to localStorage.
 * `syncPartyStats` matches roster members by id and the scenario launcher's primary preset
 * reuses real roster ids, so a fabricated debug level lands on a real mingming. Slots are the
 * containment: switch to a scratch slot, break whatever you like, switch back.
 *
 * Every mutation here goes through `../saveSlots`, which vets a slot's payload with
 * `parseSaveFileText` (the same `migrateSave` + `PlayerSaveSchema` path `loadGame` and the save
 * editor's file import use) *before* moving anything, and clears any live battle before the
 * active pointer moves. Nothing in this file writes localStorage or dispatches directly.
 *
 * The player-facing slot picker in `MainMenuView` is explicitly out of scope — this is an
 * operator tool, and the storage layer it sits on is what a player-facing picker would reuse.
 */

import { useReducer, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
    FIRST_SLOT_ID,
    LEGACY_SAVE_KEY,
    getActiveSlotId,
    listSlots,
    readLegacySaveRaw,
    renameSlot,
    slotStorageKey,
    type SaveSlot,
} from '../../engine/SaveSlots';
import { loadGame } from '../../engine/SaveSystem';
import type { RootState } from '../../ui/store/store';
import { savesAreIdentical, validateSave } from '../saveEdit';
import { createSlotOp, deleteSlotOp, readSlotSave, switchToSlot, type SlotOpResult } from '../saveSlots';
import type { DebugPanelProps } from './types';

// --- Styles (inline, matching SaveEditorPanel/DebugRoot — the toolkit ships no stylesheet) ---

const OK = '#6ee7a8';
const WARN = '#ffcc66';
const BAD = '#ff6b6b';
const LINE = 'rgba(122, 92, 255, 0.35)';

const sectionStyle: CSSProperties = {
    border: `1px solid ${LINE}`,
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '10px',
};

const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
};

const labelStyle: CSSProperties = {
    minWidth: '160px',
    font: '600 11px/1.6 monospace',
    letterSpacing: '0.06em',
};

const noteStyle: CSSProperties = {
    marginTop: '4px',
    opacity: 0.55,
    font: '11px/1.5 monospace',
};

const controlStyle: CSSProperties = {
    background: 'rgba(0, 0, 0, 0.35)',
    color: '#e6e0ff',
    border: `1px solid ${LINE}`,
    borderRadius: '4px',
    padding: '3px 6px',
    font: '11px/1.4 monospace',
};

const textStyle: CSSProperties = { ...controlStyle, width: '180px' };

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

function slotRowStyle(isActive: boolean): CSSProperties {
    return {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px',
        marginBottom: '4px',
        borderRadius: '4px',
        border: `1px solid ${isActive ? '#7a5cff' : 'rgba(122, 92, 255, 0.2)'}`,
        background: isActive ? 'rgba(122, 92, 255, 0.18)' : 'transparent',
    };
}

interface OpResult {
    readonly ok: boolean;
    readonly verb: string;
    readonly detail: ReadonlyArray<string>;
}

/** One line of "what is actually in this slot", read straight from storage. */
function describeSlot(slotId: string): { tone: string; text: string } {
    const read = readSlotSave(slotId);
    if (read.kind === 'empty') return { tone: WARN, text: 'empty — switching here starts a fresh run' };
    if (read.kind === 'invalid') return { tone: BAD, text: `INVALID: ${read.issues.join(' · ')}` };
    const save = read.save;
    return {
        tone: OK,
        text: `roster ${save.roster.length} · scrap ${save.scrapCount} · relics ${save.relics.length} · ${
            save.gauntlet ? `gauntlet ${save.gauntlet.element}` : 'no gauntlet'
        }`,
    };
}

export default function SaveSlotsPanel({ presentation }: DebugPanelProps): ReactNode {
    const dispatch = useDispatch();
    const save = useSelector((state: RootState) => state.game);
    const battle = useSelector((state: RootState) => state.battle.battle);

    // localStorage is not reactive and a slot mutation changes nothing Redux can observe, so
    // every mutation below bumps this to force a re-render. The reads themselves are
    // deliberately un-memoized: they are cheap localStorage hits, and a memo keyed on a
    // cache-buster would only be a slower way of saying "read it every render".
    const [, bumpRevision] = useReducer((n: number) => n + 1, 0);
    const [result, setResult] = useState<OpResult | null>(null);
    const [newName, setNewName] = useState('');
    const [renameTarget, setRenameTarget] = useState('');
    const [renameValue, setRenameValue] = useState('');
    const [armedDelete, setArmedDelete] = useState<string | null>(null);

    const slots: ReadonlyArray<SaveSlot> = listSlots();
    const activeId = getActiveSlotId();
    const legacyPresent = readLegacySaveRaw() !== null;

    // Same readout the save editor shows: is what is on disk in this slot what the store holds?
    // It matters here because "Copy current save" duplicates the *stored* bytes.
    const persisted = ((): { data: unknown; error?: string } => {
        try {
            return loadGame();
        } catch (err) {
            return { data: null, error: String(err) };
        }
    })();
    const liveValid = validateSave(save);
    const inSync = persisted.data !== null && savesAreIdentical(persisted.data, save);

    const report = (verb: string, op: SlotOpResult): void => {
        bumpRevision();
        setResult({ ok: op.ok, verb, detail: op.issues });
    };

    const onSwitch = (slotId: string): void => {
        const hadBattle = battle !== null;
        const op = switchToSlot(slotId, dispatch);
        bumpRevision();
        setResult({
            ok: op.ok,
            verb: `switch to ${slotId}`,
            detail: op.ok && hadBattle
                ? ['the live battle was cleared first, so it cannot end into this slot']
                : op.issues,
        });
    };

    const onRename = (): void => {
        const target = renameTarget || activeId;
        const done = renameSlot(target, renameValue);
        bumpRevision();
        setResult({
            ok: done,
            verb: `rename ${target}`,
            detail: done ? [] : ['rename refused — unknown slot or the index write failed'],
        });
        if (done) setRenameValue('');
    };

    // --- Readouts ---

    const header = (
        <div style={bannerStyle(liveValid.valid ? (inSync ? OK : WARN) : BAD)}>
            <strong>ACTIVE SLOT: {activeId}</strong> ({slots.find((s) => s.id === activeId)?.name ?? '?'})
            {'\n'}
            key {slotStorageKey(activeId)} — every autosave, defeat wipe and hub restart hits this key
            and nothing else.
            {!liveValid.valid && `\nlive state fails PlayerSaveSchema, so this slot is NOT persisting.`}
            {liveValid.valid && !inSync && `\nstored copy is behind the live state — the last autosave did not land.`}
        </div>
    );

    const resultBanner = result && (
        <div style={bannerStyle(result.ok ? OK : BAD)}>
            <strong>
                {result.ok ? 'APPLIED' : 'REFUSED — NOTHING CHANGED'}: {result.verb}
            </strong>
            {result.detail.length > 0 && `\n${result.detail.join('\n')}`}
        </div>
    );

    const slotList = (
        <div>
            {slots.map((slot) => {
                const isActive = slot.id === activeId;
                const detail = describeSlot(slot.id);
                return (
                    <div key={slot.id} style={slotRowStyle(isActive)}>
                        <span style={{ ...labelStyle, minWidth: '150px' }}>
                            {isActive ? '▶ ' : '  '}
                            {slot.name}
                        </span>
                        <span style={{ opacity: 0.5, font: '11px/1.4 monospace', minWidth: '70px' }}>{slot.id}</span>
                        <span style={{ color: detail.tone, font: '11px/1.4 monospace', flex: '1 1 240px' }}>
                            {detail.text}
                        </span>
                        {!isActive && (
                            <button type="button" style={buttonStyle()} onClick={() => onSwitch(slot.id)}>
                                switch
                            </button>
                        )}
                        {presentation === 'docked' && slots.length > 1 && (
                            armedDelete === slot.id ? (
                                <>
                                    <button
                                        type="button"
                                        style={buttonStyle(true)}
                                        onClick={() => {
                                            setArmedDelete(null);
                                            report(`delete ${slot.id}`, deleteSlotOp(slot.id, dispatch));
                                        }}
                                    >
                                        confirm delete — not undoable
                                    </button>
                                    <button type="button" style={buttonStyle()} onClick={() => setArmedDelete(null)}>
                                        cancel
                                    </button>
                                </>
                            ) : (
                                <button type="button" style={buttonStyle(true)} onClick={() => setArmedDelete(slot.id)}>
                                    delete
                                </button>
                            )
                        )}
                    </div>
                );
            })}
        </div>
    );

    // Rendered in both presentations. Creating a slot mid-battle is an odd moment to want one,
    // but "odd" is not "never" — and a control that exists or vanishes depending on how you
    // opened the layer is worse than a slightly crowded overlay.
    const createSection = (
        <section style={sectionStyle}>
            <div style={rowStyle}>
                <span style={labelStyle}>+ new save slot</span>
                <input
                    style={textStyle}
                    value={newName}
                    placeholder="name"
                    aria-label="new slot name"
                    onChange={(e) => setNewName(e.target.value)}
                />
                <button
                    type="button"
                    style={buttonStyle()}
                    onClick={() => {
                        report('create fresh save', createSlotOp(newName));
                        setNewName('');
                    }}
                >
                    Create fresh save
                </button>
                <button
                    type="button"
                    style={buttonStyle()}
                    onClick={() => {
                        report(`copy ${activeId}`, createSlotOp(newName || 'copy', activeId));
                        setNewName('');
                    }}
                >
                    Copy current save
                </button>
            </div>
            <div style={noteStyle}>
                "Copy current save" duplicates the active slot's <em>stored</em> save, so the copy starts
                byte-identical and diverges from there. Neither button switches — do that from the list
                above, deliberately, because switching discards the live battle.
                {!inSync && liveValid.valid && (
                    <span style={{ color: WARN }}>
                        {' '}
                        The stored copy is currently behind the live state, so a copy taken now would miss
                        the newest changes.
                    </span>
                )}
            </div>
        </section>
    );

    if (presentation === 'floating') {
        return (
            <div>
                {header}
                {resultBanner}
                {slotList}
                {createSection}
                <p style={{ ...noteStyle, margin: 0 }}>
                    Switching clears the live battle first, so a battle started here can never end into
                    another slot. Rename and delete are docked-only — open the Debug tab.
                </p>
            </div>
        );
    }

    return (
        <div>
            {header}
            {resultBanner}

            <section style={sectionStyle}>
                <div style={{ ...labelStyle, marginBottom: '6px' }}>save slots</div>
                {slotList}
                <div style={noteStyle}>
                    Switching clears any live battle *before* the active pointer moves. Otherwise a debug
                    battle started in one slot could end after the switch and write its levels, HP and
                    rewards into the other one — syncPartyStats matches roster members by id, and debug
                    scenarios reuse real ids.
                </div>
            </section>

            {createSection}

            <section style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>rename</span>
                    <select
                        style={controlStyle}
                        value={renameTarget || activeId}
                        onChange={(e) => setRenameTarget(e.target.value)}
                    >
                        {slots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                                {slot.name} ({slot.id})
                            </option>
                        ))}
                    </select>
                    <input
                        style={textStyle}
                        value={renameValue}
                        placeholder="new name"
                        onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <button type="button" style={buttonStyle()} onClick={onRename}>
                        rename
                    </button>
                </div>
                <div style={noteStyle}>Name only — the slot id and its storage key never change.</div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...labelStyle, marginBottom: '4px' }}>legacy save</div>
                <div style={noteStyle}>
                    {legacyPresent ? (
                        <>
                            <code>{LEGACY_SAVE_KEY}</code> still exists. It was <em>copied</em> into{' '}
                            <code>{FIRST_SLOT_ID}</code> when slots were first read and has not been written
                            since — it is a frozen snapshot of the save as it stood before slots existed, kept
                            deliberately as a recovery net.
                        </>
                    ) : (
                        <>
                            No <code>{LEGACY_SAVE_KEY}</code> — this browser never held a pre-slot save.
                        </>
                    )}
                </div>
            </section>

            <div style={noteStyle}>
                No player-facing slot picker: that is a separate, deferred piece of work on the main menu.
                This panel is the operator surface for the same storage layer.
            </div>
        </div>
    );
}
