import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
    CODEX_MILESTONES,
    codexCardIds,
    codexLaunchSpeciesIds,
    codexOsIds,
    codexPercent,
    codexProgress,
    codexSpeciesIds,
} from '../../engine/codex';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import type { ICodex } from '../../engine/runTypes';
import type { StatusType } from '../../engine/types';
import { TypeChartPanel } from '../components/TypeChart';
import { getElementIcon } from '../components/cardIcons';
import './CodexScreen.css';

/**
 * THE CODEX SCREEN — ticket 31.
 *
 * # WHAT AN UNSEEN ENTRY LOOKS LIKE, AND WHY THAT IS THE WHOLE DESIGN QUESTION
 *
 * A collection screen has one real decision: does it show you the shape of what you have not found?
 * Both answers are defensible and they teach different games. This one **shows every slot and names
 * only what you have met** — an unseen card is a numbered blank, not an absence.
 *
 * The argument is that this codex has **zero power attached** (`economy-session.md`), so hiding the
 * silhouette protects nothing: there is no advantage to be had from knowing a card exists, and a
 * player who cannot see that 212 is the target cannot pursue it. What is hidden is the only thing
 * worth hiding — what the card *does*.
 *
 * # REFERENCE PAGES, REUSED RATHER THAN REWRITTEN
 *
 * The ticket asks to "reuse `statusGlossary`/`TypeChart` as the codex's reference pages", and they
 * are used directly: `TypeChartPanel` is the same component the roster tab mounts, and the status
 * page renders `statusGlossary` entries whose text for the four duality statuses is *derived from
 * `STATUS_MODEL` at import time*. Copying either into codex-shaped prose would have made a second
 * description that could disagree with combat.
 *
 * # PROGRESS IS COMPUTED, NEVER STORED
 *
 * Every count comes from `engine/codex.ts` against the live registries. A stored "212 total" would
 * be a number that goes stale the first time a card is added.
 */
export interface CodexScreenProps {
    readonly codex: ICodex;
    readonly firedMilestones: ReadonlyArray<string>;
    /** Test seam — `renderToStaticMarkup` cannot click a tab. Same shape as `RanchScreen`'s. */
    readonly initialPage?: CodexPage;
}

export type CodexPage = 'overview' | 'cards' | 'species' | 'firmware' | 'statuses';

const PAGES: ReadonlyArray<{ id: CodexPage; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'cards', label: 'Cards' },
    { id: 'species', label: 'Species' },
    { id: 'firmware', label: 'Firmware' },
    { id: 'statuses', label: 'Statuses' },
];

export default function CodexScreen({
    codex,
    firedMilestones,
    initialPage = 'overview',
}: CodexScreenProps): ReactNode {
    const [page, setPage] = useState<CodexPage>(initialPage);
    const lines = useMemo(() => codexProgress(codex), [codex]);

    return (
        <section className="ranch-section ranch-section-wide codex">
            <div className="ranch-section-head">
                <h2>📖 Codex</h2>
            </div>
            <p className="ranch-note">
                A record of what you have met. <strong>Nothing here makes you stronger</strong> — it is
                the collection, not an upgrade tree.
            </p>

            <nav className="codex-tabs" aria-label="Codex pages">
                {PAGES.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        className={`codex-tab ${page === p.id ? 'active' : ''}`}
                        aria-current={page === p.id ? 'page' : undefined}
                        onClick={() => setPage(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </nav>

            {page === 'overview' && <Overview lines={lines} fired={firedMilestones} />}
            {page === 'cards' && <Cards codex={codex} />}
            {page === 'species' && <Species codex={codex} />}
            {page === 'firmware' && <Firmware codex={codex} />}
            {page === 'statuses' && <Statuses />}
        </section>
    );
}

// --- Overview -------------------------------------------------------------------------------

function Overview({
    lines,
    fired,
}: {
    lines: ReturnType<typeof codexProgress>;
    fired: ReadonlyArray<string>;
}): ReactNode {
    const firedSet = new Set(fired);
    const launch = codexLaunchSpeciesIds().length;

    return (
        <>
            <div className="codex-bars">
                {lines.map((line) => (
                    <div key={line.id} className="codex-bar-row">
                        <span className="codex-bar-label">{line.label}</span>
                        <span className="codex-bar-track">
                            <span
                                className="codex-bar-fill"
                                style={{ width: `${codexPercent(line)}%` }}
                            />
                        </span>
                        <span className="codex-bar-count">
                            {line.held} / {line.total}
                        </span>
                    </div>
                ))}
            </div>
            <p className="codex-note">
                {/*
                  * Two species denominators exist and conflating them would misreport progress in
                  * both directions, so the screen names the one it is using and mentions the other.
                  */}
                Species counts are against the whole roster; <strong>{launch}</strong> of them ship at
                Early Access, so a full bestiary is not reachable yet.
            </p>

            <h3 className="codex-subhead">Milestones</h3>
            <ul className="codex-milestones">
                {CODEX_MILESTONES.map((milestone) => {
                    const done = firedSet.has(milestone.id);
                    return (
                        <li key={milestone.id} className={`codex-milestone ${done ? 'done' : ''}`}>
                            <span className="codex-milestone-mark" aria-hidden="true">
                                {done ? '★' : '☆'}
                            </span>
                            <span className="codex-milestone-label">{milestone.label}</span>
                        </li>
                    );
                })}
            </ul>
            <p className="codex-note">
                Milestones are recorded but <strong>pay nothing yet</strong>. What completion is worth
                is an economy decision, and blueprints — the only thing a run leaves behind — are the
                one currency a collection log must not hand out by accident.
            </p>
        </>
    );
}

// --- Cards ----------------------------------------------------------------------------------

function Cards({ codex }: { codex: ICodex }): ReactNode {
    const seen = new Set(codex.seen);
    const played = new Set(codex.played);
    const ids = useMemo(() => codexCardIds(), []);

    return (
        <>
            <p className="codex-note">
                A card is <strong>seen</strong> once it has been on screen — in a deck you finished a
                run holding, or cast by either side. It is <strong>played</strong> only when you cast
                it yourself.
            </p>
            <ul className="codex-grid">
                {ids.map((id, index) => {
                    const isSeen = seen.has(id);
                    const data = isSeen ? GetProgramData(id) : null;
                    return (
                        <li
                            key={id}
                            className={`codex-cell ${isSeen ? 'found' : 'unknown'} ${played.has(id) ? 'played' : ''}`}
                        >
                            <span className="codex-cell-index">{index + 1}</span>
                            {data ? (
                                <>
                                    <span className="codex-cell-icon" aria-hidden="true">
                                        {getElementIcon(data.element)}
                                    </span>
                                    <span className="codex-cell-name">{data.name}</span>
                                    {played.has(id) && <span className="codex-cell-flag">cast</span>}
                                </>
                            ) : (
                                <span className="codex-cell-name codex-unknown">— — —</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

// --- Species --------------------------------------------------------------------------------

function Species({ codex }: { codex: ICodex }): ReactNode {
    const met = new Set(codex.species);
    const built = new Set(codex.assembled);
    const launch = new Set(codexLaunchSpeciesIds());
    const ids = useMemo(() => codexSpeciesIds(), []);

    return (
        <>
            <p className="codex-note">
                <strong>Met</strong> means it stood on a battlefield, yours or the enemy&apos;s.{' '}
                <strong>Built</strong> means you assembled one from a blueprint.
            </p>
            <ul className="codex-grid">
                {ids.map((id) => {
                    const isMet = met.has(id);
                    const definition = isMet ? GetMingmingData(id) : null;
                    return (
                        <li
                            key={id}
                            className={`codex-cell ${isMet ? 'found' : 'unknown'} ${built.has(id) ? 'played' : ''}`}
                        >
                            {definition ? (
                                <>
                                    <span className="codex-cell-icon" aria-hidden="true">
                                        {getElementIcon(definition.primaryElement)}
                                    </span>
                                    <span className="codex-cell-name">{definition.name}</span>
                                    {built.has(id) && <span className="codex-cell-flag">built</span>}
                                </>
                            ) : (
                                <span className="codex-cell-name codex-unknown">— — —</span>
                            )}
                            {!launch.has(id) && <span className="codex-cell-note">post-launch</span>}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

// --- Firmware -------------------------------------------------------------------------------

function Firmware({ codex }: { codex: ICodex }): ReactNode {
    const held = new Set(codex.os);
    const ids = useMemo(() => codexOsIds(), []);

    return (
        <>
            <p className="codex-note">
                Firmware is recorded when you equip it — at assembly, or by reflashing. The three gym
                boss signatures are not counted: you can meet them, but never run them.
            </p>
            <ul className="codex-list">
                {ids.map((id) => {
                    const has = held.has(id);
                    // `getOSBehavior` is what populates the lazily-built registry, so calling it is
                    // also the only safe way to read a definition out of it.
                    const os = has ? getOSBehavior(id) : null;
                    return (
                        <li key={id} className={`codex-row ${has ? 'found' : 'unknown'}`}>
                            <span className="codex-row-name">{has && os ? os.name : '— — —'}</span>
                            <span className="codex-row-desc">
                                {has && os ? os.description : 'Not yet equipped.'}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

// --- Reference ------------------------------------------------------------------------------

function Statuses(): ReactNode {
    const entries = Object.entries(statusGlossary) as Array<[StatusType, { name: string; icon?: string; description: string }]>;

    return (
        <>
            <p className="codex-note">
                Reference, not collection — every status is listed whether or not you have met it. The
                text is the same one the battle tooltips read, so it cannot drift from what the
                statuses do.
            </p>
            <ul className="codex-list">
                {entries.map(([type, entry]) => (
                    <li key={type} className="codex-row found">
                        <span className="codex-row-name" style={{ color: STATUS_COLORS[type] }}>
                            {entry.icon ? `${entry.icon} ` : ''}
                            {entry.name}
                        </span>
                        <span className="codex-row-desc">{entry.description}</span>
                    </li>
                ))}
            </ul>

            <h3 className="codex-subhead">Elements</h3>
            <TypeChartPanel />
        </>
    );
}
