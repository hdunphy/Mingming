/**
 * Snapshot panel — export the board you are looking at, import one back over it.
 *
 * See `docs/wayfinder/debug-toolkit/tickets/16-snapshot-export-import.md`.
 *
 * The panel is the *discoverable* surface; the fast path is Ctrl+Shift+E, registered by
 * `useSnapshotExportHotkey()` in `DebugRoot` so it fires with this panel closed. This file
 * deliberately does NOT call that hook — two registrations means two downloads per press.
 *
 * Import has no confirm step, by decision (ticket 06 §3): a confirm you always accept just
 * trains you to stop reading it, and load-mid-battle is the loop that runs most often.
 *
 * A registry-hash mismatch is loud but non-blocking — the banner renders, the battle still
 * loads. An imported `tape` is *displayed and not replayed*: replay needs a deterministic
 * initial state, which is `09-determinism-groundwork.md`, not this ticket.
 */

import { useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { setBattleState } from '../../ui/store/battleSlice';
import type { RootState } from '../../ui/store/store';
import { useDebugUI } from '../debugUI';
import { buildScenarioState } from '../scenarios/buildScenarioState';
import { describeRegistryMismatch, loadScenario } from '../scenarios/scenarioIO';
import { SCENARIO_FILE_EXTENSION } from '../scenarios/scenarioSchema';
import { SNAPSHOT_EXPORT_HOTKEY_LABEL, exportSnapshot } from '../snapshotIO';
import type { DebugPanelProps } from './types';

type StatusTone = 'ok' | 'error';

interface PanelStatus {
    tone: StatusTone;
    text: string;
}

/** How many tape entries to render before collapsing to a count. */
const TAPE_PREVIEW_LIMIT = 40;

// --- Styles (inline, matching the DebugRoot chrome rather than a panel stylesheet) ---

const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
};

const buttonStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid #7a5cff',
    background: 'rgba(122, 92, 255, 0.25)',
    color: '#e6e0ff',
    font: '600 11px/1.4 monospace',
    letterSpacing: '0.06em',
    cursor: 'pointer',
};

const disabledButtonStyle: CSSProperties = {
    ...buttonStyle,
    borderColor: 'rgba(122, 92, 255, 0.3)',
    background: 'transparent',
    color: '#6f688c',
    cursor: 'not-allowed',
};

const hintStyle: CSSProperties = { opacity: 0.55 };

const bannerStyle: CSSProperties = {
    margin: '0 0 10px',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid #ff5c7a',
    background: 'rgba(255, 92, 122, 0.14)',
    color: '#ffc9d4',
    font: '600 11px/1.5 monospace',
    whiteSpace: 'pre-wrap',
};

const tapeStyle = (presentation: string): CSSProperties => ({
    margin: '10px 0 0',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px dashed rgba(122, 92, 255, 0.5)',
    maxHeight: presentation === 'docked' ? '320px' : '160px',
    overflow: 'auto',
});

function statusStyle(tone: StatusTone): CSSProperties {
    return {
        margin: '0 0 10px',
        color: tone === 'error' ? '#ff9db0' : '#a5f0c4',
        whiteSpace: 'pre-wrap',
    };
}

/** One tape entry as a single greppable line. Actions are `unknown` on purpose. */
function describeTapeEntry(entry: unknown): string {
    if (entry !== null && typeof entry === 'object' && 'type' in entry) {
        const type = (entry as { type?: unknown }).type;
        if (typeof type === 'string') return type;
    }
    return typeof entry === 'string' ? entry : JSON.stringify(entry);
}

export default function SnapshotPanel({ presentation }: DebugPanelProps) {
    const battle = useSelector((state: RootState) => state.battle.battle);
    const dispatch = useDispatch();
    const { setLastScenarioName } = useDebugUI();

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [status, setStatus] = useState<PanelStatus | null>(null);
    const [mismatchBanner, setMismatchBanner] = useState<string | null>(null);
    const [importedTape, setImportedTape] = useState<readonly unknown[] | null>(null);

    const handleExport = () => {
        // `tape` is intentionally omitted: the recorder is ticket 17 and lands separately.
        const result = exportSnapshot(battle);
        setStatus(
            result.success
                ? { tone: 'ok', text: `Exported ${result.fileName}` }
                : { tone: 'error', text: result.error ?? 'Export failed.' },
        );
    };

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Re-picking the same file must re-fire `change`, so the input is cleared either way.
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file) return;

        setMismatchBanner(null);
        setImportedTape(null);

        let text: string;
        try {
            text = await file.text();
        } catch (err) {
            setStatus({ tone: 'error', text: `Could not read ${file.name}: ${String(err)}` });
            return;
        }

        const result = loadScenario(text);
        if (!result.scenario) {
            setStatus({ tone: 'error', text: result.error ?? 'Scenario failed to load.' });
            return;
        }

        const scenario = result.scenario;
        if (result.registryHashMismatch && result.currentRegistryHash) {
            setMismatchBanner(
                describeRegistryMismatch(scenario.registryHash, result.currentRegistryHash),
            );
        }

        // A `composed` file has to be materialized first; a `snapshot` is already a state.
        // Either way the injection is the same one `setBattleState` call, mid-battle or not,
        // with no confirm.
        let nextState;
        try {
            nextState =
                scenario.kind === 'snapshot' ? scenario.state : buildScenarioState(scenario.setup);
        } catch (err) {
            setStatus({ tone: 'error', text: `Could not build battle state: ${String(err)}` });
            return;
        }

        dispatch(setBattleState(nextState));
        setLastScenarioName(scenario.name);
        setImportedTape(scenario.kind === 'snapshot' ? scenario.tape ?? null : null);
        setStatus({
            tone: 'ok',
            text: `Loaded ${scenario.kind} "${scenario.name}" from ${file.name}.`,
        });
    };

    const tapePreview = importedTape?.slice(0, TAPE_PREVIEW_LIMIT) ?? [];

    return (
        <div>
            <p style={{ marginTop: 0, ...hintStyle }}>
                Capture the board as of right now, or drop a <code>{SCENARIO_FILE_EXTENSION}</code>{' '}
                over the battle in progress. No prompts, no confirms.
            </p>

            {mismatchBanner && (
                <div style={bannerStyle} role="alert">
                    {mismatchBanner}
                </div>
            )}

            {status && <p style={statusStyle(status.tone)}>{status.text}</p>}

            <div style={rowStyle}>
                <button
                    type="button"
                    style={battle ? buttonStyle : disabledButtonStyle}
                    onClick={handleExport}
                    disabled={!battle}
                    title={
                        battle
                            ? `Download a snapshot of the current battle (${SNAPSHOT_EXPORT_HOTKEY_LABEL})`
                            : 'No battle in progress'
                    }
                >
                    EXPORT SNAPSHOT
                </button>
                <span style={hintStyle}>{SNAPSHOT_EXPORT_HOTKEY_LABEL} — works with this panel closed</span>
            </div>

            <div style={rowStyle}>
                <label style={buttonStyle}>
                    IMPORT SCENARIO
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFile}
                        style={{ display: 'none' }}
                    />
                </label>
                <span style={hintStyle}>replaces the battle in progress</span>
            </div>

            <div style={hintStyle}>
                {battle
                    ? `current battle: turn ${battle.turn}, ${battle.phase}, seed ${battle.seed}`
                    : 'current battle: none'}
            </div>

            {importedTape && (
                <div style={tapeStyle(presentation)}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                        IMPORTED TAPE — {importedTape.length} action
                        {importedTape.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ ...hintStyle, marginBottom: '6px' }}>
                        Displayed, not replayed. Replay is gated on determinism groundwork.
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '20px' }}>
                        {tapePreview.map((entry, index) => (
                            <li key={index}>{describeTapeEntry(entry)}</li>
                        ))}
                    </ol>
                    {importedTape.length > tapePreview.length && (
                        <div style={hintStyle}>
                            …{importedTape.length - tapePreview.length} more
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
