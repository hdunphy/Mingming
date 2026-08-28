/**
 * THE RUN SUMMARY — ticket 19. What replaces ticket 11's placeholder ended-panel.
 *
 * # THIS SCREEN REPORTS. IT DOES NOT PAY.
 *
 * That sentence is the design, and it is printed on the screen as well as written here. Every
 * durable thing a run produced has **already** been written to the ranch by the time this renders:
 * ticket 12 banks a blueprint the instant it drops, precisely so that a dead run — or an app closed
 * on the reward screen — still pays forward, and `BattleArena` records the gym clear the moment the
 * leader falls. A player who reads "you earned 3 blueprints" here and then loses them to a crash on
 * this screen would be right to be furious, and they cannot, because the payment already happened.
 * Saying so out loud is not decoration: it is the only way the player can know it.
 *
 * The one thing teardown itself writes is the **codex merge**, and it is additive and idempotent
 * (`gameSlice.recordCodexSeen`). See `store/runTeardown.ts` for what leaving this screen does, and
 * why the ranch writes are ordered before `clearRun`.
 *
 * # ALL THREE ENDINGS LAND HERE
 *
 * Victory at the gym, defeat in any fight, and abandon-from-the-map all set `phase: 'ended'` with an
 * outcome and all three render this. The copy branches on the outcome; the numbers, the teardown and
 * the telemetry do not. That is the ticket's central instruction — three endings that unwind
 * separately are three endings that drift — and it is why the outcome only ever reaches a headline
 * and a sentence, never a code path that changes what is saved.
 *
 * # THE TWO NUMBERS THAT ARE NOT THE OBVIOUS ONES
 *
 * Both are `runSummary.ts`'s doing and both are printed the way they are because the honest number
 * is not the one the phrase suggests:
 *
 *  - **"Scrap spent" is shown as scrap LEFT.** `IRunState` keeps a balance, not a ledger — one
 *    field that `addRunScrap` and `spendRunScrap` both write — so a spend total is not derivable,
 *    and `runTypes.ts` is ratified so this ticket may not add one. The screen says what is true.
 *  - **"Cards picked" is the `ownerId: null` count.** `runTypes.IRunCard` reserves that for cards
 *    "bought, drafted, or granted by an event", which is exactly the deck-building track; the rest
 *    is what the party walked in with. The deck total is printed against
 *    `economy-session.md`'s 20-25 target because **this is the one screen where the player learns
 *    what that track was for** — a shop tells you the number, only the end tells you whether it was
 *    enough.
 *
 * # THE RUN CLOCK IS READ ONCE, HERE
 *
 * `endedAt` is injected into everything downstream (`summarizeRun`, `runTelemetryEntryFor`) because
 * engine modules do not read `Date.now()`. This component is the boundary where the clock is read —
 * once, at mount, held in state — so the duration the player sees and the duration ticket 25 reads
 * out of telemetry are the same measurement rather than two readings a render apart.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import {
    DECK_TARGET_MAX,
    DECK_TARGET_MIN,
    SOLO_START_DECK,
    bankedBlueprintCounts,
    formatRunDuration,
    summarizeRun,
} from '../../engine/run/runSummary';
import { recordRunEnd, runTelemetryEntryFor } from '../../engine/run/runTelemetry';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import type { IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { autoSaveRunLog } from '../settings/exportRunLog';
import { loadSettings } from '../settings/settings';
import { teardownRun } from '../store/runTeardown';
import './RunSummary.css';
import { Icon } from '../theme/Icon';
import type { IconName } from '../theme/icons';

/**
 * `exploration-map.md`'s run-length target, printed beside the clock.
 *
 * A duration with nothing to compare it against is a number nobody can act on, and the entire
 * reason ticket 19 records the clock at all is that ticket 25 has to find out whether this band
 * holds. Showing it to the player as well costs nothing and makes every run a data point they can
 * read themselves.
 */
export const RUN_MINUTES_MIN = 35;
export const RUN_MINUTES_MAX = 45;

/** `exploration-map.md`: 8-10 battles plus the three-fight gauntlet. */
export const RUN_FIGHTS_MIN = 10;
export const RUN_FIGHTS_MAX = 13;

export interface RunSummaryProps {
    /** The ended run — `phase: 'ended'`, with an outcome. Read, never written. */
    readonly run: IRunState;
    /**
     * The clock reading for "now", injected only by tests. Production leaves it undefined and the
     * component reads `Date.now()` once at mount; a test passes a fixed value so the duration on
     * screen is deterministic. Same seam `createRun` uses for `startedAt`, at the other end.
     */
    readonly endedAt?: number;
}

interface HeadlineCopy {
    readonly icon: IconName;
    readonly title: string;
    readonly lead: string;
}

/**
 * The one place the outcome changes anything. Deliberately only words: the numbers below, the
 * telemetry entry and the teardown are identical for all three, which is what stops the three
 * endings drifting apart.
 */
function headlineFor(run: IRunState, gymName: string, biomeName: string): HeadlineCopy {
    switch (run.outcome) {
        case 'victory':
            return {
                icon: 'gym',
                title: 'Gym cleared',
                lead: `You beat ${gymName}. The clear and the tier are recorded at the ranch.`,
            };
        case 'abandoned':
            return {
                icon: 'door',
                title: 'Run abandoned',
                lead: `You walked out of ${biomeName}. The run is over; everything you banked on the way is not.`,
            };
        default:
            return {
                icon: 'skull',
                title: 'Run over',
                lead: `Your party fell in ${biomeName}. A defeat costs the run and only the run.`,
            };
    }
}

export default function RunSummary({ run, endedAt }: RunSummaryProps): ReactNode {
    const dispatch = useDispatch();

    /**
     * One clock reading for the life of this panel. Lazy `useState` rather than a bare `Date.now()`
     * in the body: the latter would tick up on every re-render, so the duration would change while
     * the player read it and would not match the number already written to telemetry.
     */
    const [clock] = useState<number>(() => endedAt ?? Date.now());

    const summary = useMemo(() => summarizeRun(run, clock), [run, clock]);
    const banked = useMemo(() => bankedBlueprintCounts(run.modifiers), [run.modifiers]);

    /**
     * Write the run clock to the local playtest log — ticket 19's Done-when, and **local only**.
     *
     * Fires on mount rather than on the way out, so the recorded duration is the run's length and
     * not the run plus however long the player spent reading this. `recordRunEnd` is idempotent per
     * run (`runKey` = seed + startedAt), which is what makes this safe under `StrictMode`'s
     * double-invoked effects *and* under an app closed on this screen and reopened — the run save
     * is not removed until teardown, so this component legitimately mounts twice for one run.
     *
     * Deliberately unreported on failure: a full or unavailable store costs a playtest data point,
     * and telemetry is the last thing in the game entitled to put a banner in front of a player.
     */
    useEffect(() => {
        const entry = runTelemetryEntryFor(run, clock);
        const firstTime = recordRunEnd(entry);

        /*
         * AUTO-SAVE THE RUN LOG (ticket 59, extended 2026-08-24).
         *
         * Henry: *"Having to export at the right time doesn't work. I often forget."* So the file
         * writes itself here, when the run is over and its transcript is complete.
         *
         * **`firstTime` is the whole of the idempotency**, and it is load-bearing rather than
         * tidy. This component legitimately mounts more than once for one run — StrictMode
         * double-invokes effects, and the run save is not removed until teardown, so closing the
         * app on this screen and reopening lands here again. Without the guard a tester would get
         * a duplicate download every time, and the browser's "allow multiple downloads" prompt on
         * top of it. `recordRunEnd` returns false on a run it has already seen, which makes it the
         * one signal in the codebase that already means "this run just ended, once".
         *
         * Off by default and silent either way: a failed or blocked download costs a playtest data
         * point, and nothing on this screen may put an error in front of a player who just lost.
         */
        if (firstTime && loadSettings().autoSaveRunLog) {
            // The outcome comes from here rather than from the log: this is where it is known for
            // certain, and a capped transcript may have dropped its own `RUN_ENDED` row.
            autoSaveRunLog(entry.runKey, entry.outcome);
        }
    }, [run, clock]);

    const gym = GYM_REGISTRY[run.gymId];
    const gymName = gym?.name ?? run.gymId;
    const headline = headlineFor(run, gymName, summary.biomeName);
    const bankedEntries = Object.entries(banked);

    /**
     * Leave. **The single teardown path** — see `store/runTeardown.ts`: the codex merge, the
     * victory-only unlock, then `clearRun`, which is what removes the run save key. Defeat and
     * abandon reach exactly this function and unlock nothing.
     */
    const leave = (): void => {
        playSfx('uiClick');
        teardownRun({ run, dispatch });
    };

    return (
        <div className="ranch-screen">
            <header className="ranch-header">
                <h1><Icon name={headline.icon} size={22} /> {headline.title}</h1>
            </header>

            <section className="ranch-section ranch-section-wide">
                <p className="rs-lead">{headline.lead}</p>

                {/* --- The five numbers, each against the target it was aimed at --- */}

                <div className="rs-grid">
                    <div className="rs-stat">
                        <span className="rs-stat-label">Time</span>
                        <span className="rs-stat-figure">{formatRunDuration(summary.durationMs)}</span>
                        <span className="rs-stat-note">target {RUN_MINUTES_MIN}–{RUN_MINUTES_MAX} min</span>
                    </div>

                    <div className="rs-stat">
                        <span className="rs-stat-label">Fights</span>
                        <span className="rs-stat-figure">{summary.fightsResolved}</span>
                        <span className="rs-stat-note">target {RUN_FIGHTS_MIN}–{RUN_FIGHTS_MAX}</span>
                    </div>

                    <div className="rs-stat">
                        <span className="rs-stat-label">Deck</span>
                        <span className="rs-stat-figure">{summary.deckSize} cards</span>
                        <span className="rs-stat-note">target {DECK_TARGET_MIN}–{DECK_TARGET_MAX}</span>
                    </div>

                    <div className="rs-stat">
                        <span className="rs-stat-label">Cards picked</span>
                        <span className="rs-stat-figure">{summary.pickedCards}</span>
                        {/*
                          * The other half of the deck, and the rule it started from. A solo run
                          * opens at `SOLO_START_DECK`, and each further member adds its four tagged
                          * cards — stated as the rule rather than multiplied out, because a party
                          * that grew mid-run started smaller than it ended and `IRunState` does not
                          * record where the boundary was. See `runSummary.ts`: the exact figures are
                          * this split, not a guessed opening size.
                          */}
                        <span className="rs-stat-note">
                            + {summary.kitCards} kit · a solo run opens at {SOLO_START_DECK}
                        </span>
                    </div>

                    <div className="rs-stat">
                        <span className="rs-stat-label">Scrap left</span>
                        <span className="rs-stat-figure">{summary.scrapRemaining}</span>
                        {/*
                          * Not "scrap spent". `IRunState.scrap` is a balance and there is no ledger
                          * behind it, so a spend total would be a number this screen made up. The
                          * note says which one it is rather than letting the label imply the other.
                          */}
                        <span className="rs-stat-note">balance at the end, not a spend total</span>
                    </div>

                    <div className="rs-stat">
                        <span className="rs-stat-label">Reached</span>
                        <span className="rs-stat-figure">biome {summary.biomeReached} of {run.biomes.length}</span>
                        <span className="rs-stat-note">{summary.biomeName} · tier {run.tier}</span>
                    </div>
                </div>

                {/* --- What is already at the ranch --- */}

                <h2 className="ranch-subhead">Banked at the ranch</h2>

                <p className="rs-banked-note">
                    <strong>These were banked as they dropped, not now.</strong> A blueprint is
                    written to the ranch the moment it falls out of a fight, so a run that ended
                    badly has already paid you and nothing on this screen can be lost by closing it.
                    This is the receipt.
                </p>

                <ul className="rs-list">
                    <li className="rs-row">
                        <span className="rs-row-name">Blueprints</span>
                        <span className="rs-row-value">
                            {bankedEntries.length === 0
                                ? 'none this run'
                                : bankedEntries
                                    .map(([speciesId, count]) => {
                                        const name = MingmingRegistry[speciesId]?.name ?? speciesId;
                                        return count > 1 ? `${name} ×${count}` : name;
                                    })
                                    .join(', ')}
                        </span>
                    </li>
                    <li className="rs-row">
                        <span className="rs-row-name">Codex</span>
                        <span className="rs-row-value">
                            {summary.codexSeen.length} card{summary.codexSeen.length === 1 ? '' : 's'} recorded as seen
                        </span>
                    </li>
                    <li className="rs-row">
                        <span className="rs-row-name">Gym</span>
                        <span className="rs-row-value">
                            {run.outcome === 'victory'
                                ? `${gymName} cleared · tier ${run.tier} unlocked`
                                : `${gymName} not cleared — nothing unlocked`}
                        </span>
                    </li>
                </ul>

                {/* --- The line ticket 06 drew, restated where it matters most --- */}

                <h2 className="ranch-subhead">What the run took with it</h2>
                <p className="rs-lost-note">
                    The deck, the scrap, the macros, the drivers and the region die with the run —
                    that is what keeps the next one from starting rich. Your roster, your blueprints,
                    your codex and every gym you have cleared are a separate save and were never at
                    risk here.
                </p>

                <button type="button" className="ranch-button rs-leave" onClick={leave}>
                    Return to the ranch
                </button>
            </section>
        </div>
    );
}
