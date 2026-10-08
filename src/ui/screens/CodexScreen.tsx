import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
    CODEX_MILESTONES,
    codexCardIds,
    codexAllSpeciesIds,
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
import { ElementMark } from '../theme/kit/ElementMark';
import './CodexScreen.css';
import { Icon } from '../theme/Icon';
import { instinctName, plain } from '../labels/labels';
import { InstinctGlyph } from '../components/InstinctGlyph';
import { StatusIcon } from '../theme/kit/StatusIcon';

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
    { id: 'firmware', label: 'Instinct' },
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
                <h2><Icon name="codex" size={18} /> Codex</h2>
            </div>
            <p className="ranch-note">
                What you have met. <strong>Nothing here makes you stronger.</strong>
            </p>

            <nav className="codex-tabs" aria-label="Codex pages">
                {PAGES.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        className={`codex-tab k-button is-quiet ${page === p.id ? 'active is-on' : ''}`}
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
                        <span className="codex-bar-label">{plain(line.label)}</span>
                        <span className="codex-bar-track k-slant">
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
                Species counts only the <strong>{launch}</strong> in this build.
            </p>

            <h3 className="codex-subhead k-display">Milestones</h3>
            <ul className="codex-milestones">
                {CODEX_MILESTONES.map((milestone) => {
                    const done = firedSet.has(milestone.id);
                    return (
                        <li key={milestone.id} className={`codex-milestone ${done ? 'done' : ''}`}>
                            <span className="codex-milestone-mark" aria-hidden="true">
                                {done ? '★' : '☆'}
                            </span>
                            <span className="codex-milestone-label">{plain(milestone.label)}</span>
                        </li>
                    );
                })}
            </ul>
            <p className="codex-note">
                Milestones <strong>pay nothing yet</strong>.
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
                <strong>Seen</strong>: it has been on screen. <strong>Cast</strong>: you played it yourself.
            </p>
            <ul className="codex-grid">
                {ids.map((id, index) => {
                    const isSeen = seen.has(id);
                    const data = isSeen ? GetProgramData(id) : null;
                    return (
                        <li
                            key={id}
                            className={`codex-cell k-slant ${isSeen ? 'found' : 'unknown'} ${played.has(id) ? 'played' : ''}`}
                        >
                            <span className="codex-cell-index">{index + 1}</span>
                            {data ? (
                                <>
                                    <span className="codex-cell-icon">
                                        <ElementMark element={data.element} size={20} />
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
    /*
     * TICKET 31a — **the GRID shows the whole roster; the DENOMINATOR is the EA six.**
     *
     * `codexSpeciesIds` used to be all sixteen and is now the six Early Access ships, which is what
     * a completion percentage has to count against (162a parked the other ten on the archived pool).
     * If the grid followed it the ten would vanish from the screen entirely, and a collection that
     * silently hides content is worse at being a collection than one that shows it greyed.
     *
     * So: `codexAllSpeciesIds` draws the cells, `codexSpeciesIds` marks which of them count today,
     * and the ten that do not wear `post-launch`. Both numbers are on the screen and neither is
     * pretending to be the other — which is the shape the old comment here asked for and did not get
     * once the two lists became the same list.
     */
    const launch = new Set(codexSpeciesIds());
    const ids = useMemo(() => codexAllSpeciesIds(), []);

    return (
        <>
            <p className="codex-note">
                <strong>Met</strong>: it stood on a battlefield. <strong>Built</strong>: you summoned one.
            </p>
            <ul className="codex-grid">
                {ids.map((id) => {
                    const isMet = met.has(id);
                    const definition = isMet ? GetMingmingData(id) : null;
                    return (
                        <li
                            key={id}
                            className={`codex-cell k-slant ${isMet ? 'found' : 'unknown'} ${built.has(id) ? 'played' : ''}`}
                        >
                            {definition ? (
                                <>
                                    <span className="codex-cell-icon">
                                        <ElementMark element={definition.primaryElement} size={20} />
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
                Recorded when you equip one, at summon or by retraining. Gym boss instincts are not counted.
            </p>
            <ul className="codex-list">
                {ids.map((id) => {
                    const has = held.has(id);
                    // `getOSBehavior` is what populates the lazily-built registry, so calling it is
                    // also the only safe way to read a definition out of it.
                    const os = has ? getOSBehavior(id) : null;
                    return (
                        <li key={id} className={`codex-row k-plate ${has ? 'found is-on' : 'unknown'}`}>
                            <span className="codex-row-name k-display">{has && os && <InstinctGlyph instinct={os.name} size={18} className="instinct-glyph-lead" />}{has && os ? instinctName(os.name) : '— — —'}</span>
                            <span className="codex-row-desc">
                                {has && os ? plain(os.description) : 'Not yet equipped.'}
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
                Every status, worded as the battle tooltips word it.
            </p>
            <ul className="codex-list">
                {entries.map(([type, entry]) => (
                    <li key={type} className="codex-row k-plate found">
                        <span className="codex-row-name k-display" style={{ color: STATUS_COLORS[type] }}>
                            <StatusIcon status={type} size={13} /> {entry.name}
                        </span>
                        <span className="codex-row-desc">{entry.description}</span>
                    </li>
                ))}
            </ul>

            <h3 className="codex-subhead k-display">Elements</h3>
            <TypeChartPanel />
        </>
    );
}
