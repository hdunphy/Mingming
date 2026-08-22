/**
 * Ranch editor — the docked Debug tab's save surface.
 *
 * Every button here routes through `commitEdit` (`../saveEdit`), which projects the prospective
 * ranch with the real `gameSlice` reducer, validates it against `RanchStateSchema`, and only then
 * dispatches. Nothing in this file may dispatch directly: a schema-invalid ranch wedges the
 * autosave in `src/ui/store/store.ts` with nothing but a `console.error`, and validating after the
 * fact would be racing that subscription.
 *
 * TICKET 11 TOOK FOUR BUTTONS OUT, AND THAT IS THE HONEST OUTCOME RATHER THAN A REGRESSION. `grant
 * scraps`, `grant cards`, `grant relic` and `unlock sector` wrote fields that are `IRunState`'s
 * now, and `heal party` was an explicit no-op. A ranch is four things — individuals, blueprint
 * counts, the codex, and what gyms/tiers are cleared — so the editor offers exactly the verbs that
 * write those. Granting a run-scoped resource wants a *run* editor, which is a different panel.
 *
 * Naming here is deliberately literal about what the ranch can represent — "grant blueprint",
 * not "unlock species"; "set activeOS", not "unlock OS". Neither is a flag: species
 * availability derives from `blueprints` and OS availability from the definition's static
 * `availableOS`, with only the per-instance `activeOS` persisted. The panel must not promise
 * a concept the ranch cannot hold.
 *
 * Save editing is docked-only in spirit — nothing save-related belongs in the mid-battle
 * floating overlay — so the floating presentation degrades to the validity readout alone.
 */

import { useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { loadGameState } from '../../engine/SaveSystem';
import type { RootState } from '../../ui/store/store';
import {
    buildAddToRoster,
    buildGrantBlueprint,
    buildReplaceSave,
    buildSetActiveOS,
    buildWipeSave,
    commitEdit,
    parseSaveFileText,
    savesAreIdentical,
    validateSave,
    type SaveEditAction,
} from '../saveEdit';
import type { DebugPanelProps } from './types';

// --- Styles (inline, matching DebugRoot's chrome — the toolkit ships no stylesheet) ---

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

// --- Result of the most recent edit attempt ---

interface EditResult {
    readonly ok: boolean;
    readonly verb: string;
    readonly detail: ReadonlyArray<string>;
}

export default function SaveEditorPanel({ presentation }: DebugPanelProps): ReactNode {
    const dispatch = useDispatch();
    // The rendered save (re-renders on every game-state change) drives the readouts; the
    // store is read again at click time so a projection can never be built from a stale
    // render if something dispatched in between.
    const store = useStore<RootState>();
    const save = useSelector((state: RootState) => state.game);

    const [result, setResult] = useState<EditResult | null>(null);
    const [wipeArmed, setWipeArmed] = useState(false);

    const speciesIds = useMemo(() => Object.keys(MingmingRegistry), []);

    const [blueprintId, setBlueprintId] = useState(speciesIds[0] ?? '');
    const [newSpeciesId, setNewSpeciesId] = useState(speciesIds[0] ?? '');
    const [targetId, setTargetId] = useState('');
    const [osId, setOsId] = useState('');

    // --- Validity readout: is the live state savable, and did the last autosave land? ---

    const liveValidity = useMemo(() => validateSave(save), [save]);
    // Ticket 11: the live slice IS the ranch that gets written, so "in sync" is a direct
    // comparison. Ticket 23 had to project the slice through `toRanchState` first, and the two
    // shapes drifting apart was exactly the failure mode that projection could hide.
    const persisted = useMemo(() => {
        try {
            return loadGameState();
        } catch (err) {
            return { ranch: null, run: null, error: String(err) };
        }
    }, [save]);
    const persistedInSync = persisted.ranch !== null && savesAreIdentical(persisted.ranch, save);

    // --- The one path from a button to the store ---

    const target = save.roster.find((member) => member.id === targetId) ?? save.roster[0];
    const osOptions = target ? (MingmingRegistry[target.definitionId]?.availableOS ?? []) : [];
    const effectiveOs = osOptions.includes(osId) ? osId : (osOptions[0] ?? '');

    const run = (verb: string, action: SaveEditAction | null): void => {
        if (!action) {
            setResult({ ok: false, verb, detail: ['no action built — unknown id, nothing dispatched'] });
            return;
        }
        const current = store.getState().game;
        const prepared = commitEdit(current, action, dispatch);
        if (prepared.ok) {
            setResult({
                ok: true,
                verb,
                detail: prepared.changed ? [] : ['reducer was a no-op — the save did not change'],
            });
        } else {
            setResult({ ok: false, verb, detail: prepared.issues });
        }
    };

    const onReplaceFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = event.target.files?.[0];
        // Reset so re-picking the same file fires onChange again.
        event.target.value = '';
        if (!file) return;

        const parsed = parseSaveFileText(await file.text());
        if (!parsed.ok) {
            setResult({ ok: false, verb: 'replace save from file', detail: parsed.issues });
            return;
        }
        run('replace save from file', buildReplaceSave(parsed.save));
    };

    // --- Readouts ---

    const validityBanner = (() => {
        if (!liveValidity.valid) {
            return (
                <div style={bannerStyle(BAD)}>
                    <strong>AUTOSAVE WEDGED</strong> — the live game state fails RanchStateSchema, so
                    every autosave since it broke has been refused and progress is NOT persisting.
                    {'\n'}
                    {liveValidity.issues.join('\n')}
                </div>
            );
        }
        if (persisted.ranch === null) {
            return (
                <div style={bannerStyle(WARN)}>
                    <strong>SAVE VALID</strong> — but nothing is stored yet
                    {persisted.error ? `: ${persisted.error}` : ' (no ranch in storage).'}
                </div>
            );
        }
        if (!persistedInSync) {
            return (
                <div style={bannerStyle(WARN)}>
                    <strong>SAVE VALID, STORED COPY IS BEHIND</strong> — the live state is savable but
                    the stored copy does not match it. The last autosave did not land.
                </div>
            );
        }
        return (
            <div style={bannerStyle(OK)}>
                <strong>SAVE VALID AND IN SYNC</strong> — live state passes RanchStateSchema and matches
                the stored copy.
            </div>
        );
    })();

    const resultBanner = result && (
        <div style={bannerStyle(result.ok ? OK : BAD)}>
            <strong>
                {result.ok ? 'APPLIED' : 'REFUSED — NOT DISPATCHED'}: {result.verb}
            </strong>
            {result.detail.length > 0 && `\n${result.detail.join('\n')}`}
        </div>
    );

    // Ticket 11: the four things a ranch is. `blueprints` is a count per species, so this sums
    // them — the previous line read `save.blueprints.length` on a Record and printed `undefined`,
    // which is what a display that outlives its shape looks like.
    const blueprintTotal = Object.values(save.blueprints).reduce((sum, n) => sum + n, 0);
    const summary = (
        <div style={{ ...noteStyle, marginBottom: '10px' }}>
            roster {save.roster.length} · blueprints {blueprintTotal} · codex {save.codex.seen.length} seen
            / {save.codex.played.length} played · gyms {save.gymsCleared.join(', ') || 'none'} · highest
            tier {save.highestTierCleared}
        </div>
    );

    if (presentation === 'floating') {
        return (
            <div>
                {validityBanner}
                {summary}
                <p style={{ ...noteStyle, margin: 0 }}>
                    Save editing is docked-only — open the Debug tab. Nothing save-related belongs in the
                    mid-battle overlay; the validity readout stays here so a wedged autosave is still
                    visible from anywhere.
                </p>
            </div>
        );
    }

    return (
        <div>
            {validityBanner}
            {resultBanner}
            {summary}

            <section style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>grant blueprint</span>
                    <select style={controlStyle} value={blueprintId} onChange={(e) => setBlueprintId(e.target.value)}>
                        {speciesIds.map((id) => (
                            <option key={id} value={id}>{MingmingRegistry[id].name}</option>
                        ))}
                    </select>
                    <button type="button" style={buttonStyle()} onClick={() => run('grant blueprint', buildGrantBlueprint(blueprintId))}>
                        grant
                    </button>
                </div>
                <div style={noteStyle}>
                    Not "unlock species": there is no species flag. Synthesis availability is derived from
                    the blueprints in the save.
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>add to roster</span>
                    <select style={controlStyle} value={newSpeciesId} onChange={(e) => setNewSpeciesId(e.target.value)}>
                        {speciesIds.map((id) => (
                            <option key={id} value={id}>{MingmingRegistry[id].name}</option>
                        ))}
                    </select>
                    <button type="button" style={buttonStyle()} onClick={() => run('add to roster', buildAddToRoster(newSpeciesId))}>
                        add
                    </button>
                </div>
                <div style={noteStyle}>
                    Free — no blueprint spent. Ticket 11 removed this reducer's base-deck grant: cards are
                    run-scoped, so adding a roster member adds a roster member and nothing else.
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>roster target</span>
                    <select
                        style={controlStyle}
                        value={target?.id ?? ''}
                        onChange={(e) => setTargetId(e.target.value)}
                        disabled={save.roster.length === 0}
                    >
                        {save.roster.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.nickname ?? MingmingRegistry[member.definitionId]?.name ?? member.definitionId}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ ...rowStyle, marginTop: '8px' }}>
                    <span style={labelStyle}>set activeOS</span>
                    <select
                        style={controlStyle}
                        value={effectiveOs}
                        onChange={(e) => setOsId(e.target.value)}
                        disabled={osOptions.length === 0}
                    >
                        {osOptions.map((id) => (
                            <option key={id} value={id}>{id}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        style={buttonStyle()}
                        disabled={!target || effectiveOs === ''}
                        onClick={() => target && run('set activeOS', buildSetActiveOS(target.id, effectiveOs))}
                    >
                        set
                    </button>
                </div>
                <div style={noteStyle}>
                    Not "unlock OS": the candidate list is the definition's static availableOS, and only
                    the per-instance activeOS is stored. The schema types it as a bare string, so this
                    select — not the dry run — is what keeps the value meaningful.
                </div>

                {save.roster.length === 0 && (
                    <div style={{ ...noteStyle, color: WARN }}>Roster is empty — add a unit first.</div>
                )}
            </section>

            <section style={{ ...sectionStyle, borderColor: BAD }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>wipe save</span>
                    {wipeArmed ? (
                        <>
                            <button
                                type="button"
                                style={buttonStyle(true)}
                                onClick={() => {
                                    setWipeArmed(false);
                                    run('wipe save', buildWipeSave());
                                }}
                            >
                                confirm wipe — this is not undoable
                            </button>
                            <button type="button" style={buttonStyle()} onClick={() => setWipeArmed(false)}>
                                cancel
                            </button>
                        </>
                    ) : (
                        <button type="button" style={buttonStyle(true)} onClick={() => setWipeArmed(true)}>
                            wipe
                        </button>
                    )}
                </div>
                <div style={noteStyle}>Resets to createEmptyRanch(): empty roster, no blueprints, no progress.</div>

                <div style={{ ...rowStyle, marginTop: '8px' }}>
                    <span style={labelStyle}>replace ranch from file</span>
                    <input style={controlStyle} type="file" accept="application/json,.json" onChange={onReplaceFile} />
                </div>
                <div style={noteStyle}>
                    The file is a bare IRanchState, not an envelope. Read path is parse then validate —
                    ticket 23 removed the upgrade step, so a file that does not already describe a legal
                    ranch is reported and never dispatched.
                </div>
            </section>

            <div style={noteStyle}>
                No "max everything" preset by design — a composite of many writes is the likeliest way to
                construct an invalid ranch, which is the failure this panel exists to prevent.
                {' '}Scrap, cards and drivers are not editable here at all: ticket 11 moved them to the
                run, and a run editor is a different panel.
            </div>
        </div>
    );
}
