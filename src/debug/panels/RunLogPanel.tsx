/**
 * RUN LOG PANEL — ticket 59's read side.
 *
 * The ticket's own gate is three questions: *"how did the deck grow"*, *"where did the scrap go"*
 * and *"what did he skip"*. This panel answers those three in one screen and does not try to be a
 * general log viewer — the raw rows are at the bottom, and the export button in Settings is what
 * you use when you want to look properly.
 *
 * It reads STORAGE, not the store: the interesting log is usually the one from the run that just
 * ended, and by then the run is torn down and nothing about it is in Redux any more.
 *
 * The two curves are drawn as inline SVG polylines with no library, for the reason every other
 * debug surface here gives: this ships inside the DEV-only `DebugRoot` chunk, and a charting
 * dependency in `package.json` is a lockfile change (forbidden) plus weight in a bundle that must
 * be provably absent from `dist/`.
 */

import { useMemo, useState, type CSSProperties } from 'react';

import {
    cardFlow,
    readRunLogs,
    runCurves,
    scrapByReason,
    type IRunEvent,
    type IRunLog,
} from '../../engine/run/runLog';

const RAW_ROW_LIMIT = 60;

const boxStyle: CSSProperties = {
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 10,
};

const labelStyle: CSSProperties = {
    fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6,
};

const monoStyle: CSSProperties = { font: '0.7rem/1.45 monospace' };

/**
 * One curve, normalised to its own maximum.
 *
 * Two separate charts rather than one with two axes: deck size runs 8-40 and scrap runs 0-260, so a
 * shared axis would flatten the deck curve into a line along the bottom — which is the curve the
 * ticket cares most about.
 */
function Curve({ points, color, label, max }: {
    points: ReadonlyArray<number>; color: string; label: string; max: number;
}) {
    const width = 320;
    const height = 56;
    if (points.length < 2 || max <= 0) {
        return <div style={{ ...labelStyle, padding: '6px 0' }}>{label}: not enough points</div>;
    }
    const step = width / (points.length - 1);
    const path = points
        .map((value, i) => `${(i * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`)
        .join(' ');
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={labelStyle}>{label} — peak {max}</div>
            <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
                <polyline points={path} fill="none" stroke={color} strokeWidth={1.5} />
            </svg>
        </div>
    );
}

/** One raw row, rendered as its kind plus whatever else it carries. */
function rawLine(event: IRunEvent): string {
    const { seq, fightIndex, deckSize, scrap, kind, ...rest } = event as IRunEvent & Record<string, unknown>;
    const detail = Object.entries(rest)
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('/') : String(value)}`)
        .join(' ');
    return `#${seq} f${fightIndex} d${deckSize} $${scrap}  ${kind}${detail ? '  ' + detail : ''}`;
}

export default function RunLogPanel() {
    // Read once per mount. A live subscription would be lying anyway: the file on disk only changes
    // on a microtask after a dispatch, and the run that matters is usually already over.
    const logs = useMemo(() => readRunLogs(), []);
    const [index, setIndex] = useState(() => Math.max(0, logs.length - 1));
    const log: IRunLog | undefined = logs[index];

    if (!log) {
        return (
            <div style={{ ...monoStyle, padding: 12, opacity: 0.7 }}>
                No runs recorded yet. Start a run — every node, purchase and pick is logged from the
                first dispatch, and the transcript survives a reload.
            </div>
        );
    }

    const curves = runCurves(log);
    const sinks = scrapByReason(log);
    const flow = cardFlow(log);
    const ended = log.events.find((event) => event.kind === 'RUN_ENDED');
    const rows = log.events.slice(-RAW_ROW_LIMIT);

    return (
        <div style={{ padding: 10, ...monoStyle }}>
            <div style={{ ...boxStyle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={labelStyle}>Run</span>
                <select
                    value={index}
                    onChange={(e) => setIndex(Number(e.target.value))}
                    style={{ background: '#111', color: '#ddd', border: '1px solid #333', font: 'inherit' }}
                >
                    {logs.map((entry, i) => (
                        <option key={entry.runKey} value={i}>
                            {i === logs.length - 1 ? '(latest) ' : ''}{entry.runKey}
                        </option>
                    ))}
                </select>
                <span style={{ opacity: 0.7 }}>
                    {log.events.length} events
                    {log.droppedEvents > 0 && (
                        // Never silent: a truncated transcript that looks complete is worse than no
                        // transcript, because it answers the questions confidently and wrongly.
                        <strong style={{ color: '#ffcc66' }}> · {log.droppedEvents} DROPPED (capped)</strong>
                    )}
                    {ended?.kind === 'RUN_ENDED' && ` · ${ended.outcome} at biome ${ended.biomeReached}`}
                </span>
            </div>

            <div style={boxStyle}>
                <div style={labelStyle}>How the deck grew, and where the scrap went</div>
                <Curve
                    label="Deck size"
                    color="#7fd1ff"
                    points={curves.map((p) => p.deckSize)}
                    max={Math.max(...curves.map((p) => p.deckSize), 0)}
                />
                <Curve
                    label="Scrap held"
                    color="#ffcc66"
                    points={curves.map((p) => p.scrap)}
                    max={Math.max(...curves.map((p) => p.scrap), 0)}
                />
                <div style={{ opacity: 0.75 }}>
                    {/* economy-session.md's gate, quoted so the number on screen has something to
                        be judged against. A curve with no target is a decoration. */}
                    Final deck {curves.length > 0 ? curves[curves.length - 1].deckSize : 0} — the gate is 20-25 at the gauntlet.
                </div>
            </div>

            <div style={boxStyle}>
                <div style={labelStyle}>Scrap by cause</div>
                {sinks.length === 0 ? <div style={{ opacity: 0.6 }}>none</div> : sinks.map((sink) => (
                    <div key={sink.reason} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{sink.reason}</span>
                        <span style={{ color: sink.total < 0 ? '#ff9c9c' : '#9ad9a0' }}>
                            {sink.total > 0 ? '+' : ''}{sink.total}
                        </span>
                    </div>
                ))}
            </div>

            <div style={boxStyle}>
                <div style={labelStyle}>Cards</div>
                <div>picked {flow.picked.length} · skipped {flow.skipped} · bought {flow.bought.length} · removed {flow.removed.length}</div>
                {flow.picked.length > 0 && <div style={{ opacity: 0.7 }}>took: {flow.picked.join(', ')}</div>}
                {flow.bought.length > 0 && <div style={{ opacity: 0.7 }}>bought: {flow.bought.join(', ')}</div>}
                {flow.removed.length > 0 && <div style={{ opacity: 0.7 }}>removed: {flow.removed.join(', ')}</div>}
            </div>

            <div style={boxStyle}>
                <div style={labelStyle}>
                    Raw — last {Math.min(RAW_ROW_LIMIT, log.events.length)} of {log.events.length}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {rows.map((event) => (
                        <div key={event.seq} style={{ whiteSpace: 'pre-wrap', opacity: 0.85 }}>
                            {rawLine(event)}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...labelStyle, opacity: 0.5 }}>
                Settings → Playtest → Export run log writes all of this to a file.
            </div>
        </div>
    );
}
