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
import { useDispatch, useSelector } from 'react-redux';
import { useFirstTraceLine } from '../hooks/useFirstTraceLine';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { bankedBlueprintCounts, summarizeRun } from '../../engine/run/runSummary';
import { findRunLog, runLogKeyFor } from '../../engine/run/runLog';
import { recordRunEnd, runTelemetryEntryFor } from '../../engine/run/runTelemetry';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { activeModifierNames } from '../../engine/run/modifiers/modifierRegistry';
import type { IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { autoSaveRunLog } from '../settings/exportRunLog';
import { loadSettings } from '../settings/settings';
import { teardownRun } from '../store/runTeardown';
import { introRules } from '../../engine/run/intro/introRules';
import { unlockedTiers } from '../../engine/run/tiers/tierUnlocks';
import { clearLine } from '../../engine/run/tiers/tierUnlockLine';
import type { RootState } from '../store/store';
import './RunSummary.css';
import { Icon } from '../theme/Icon';
import type { IconName } from '../theme/icons';

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
}

/**
 * The one place the outcome changes anything. Deliberately only words: the numbers below, the
 * telemetry entry and the teardown are identical for all three, which is what stops the three
 * endings drifting apart.
 */
function headlineFor(run: IRunState): HeadlineCopy {
    switch (run.outcome) {
        case 'victory':
            return {
                icon: 'gym',
                // TICKET 182: the intro run is a warm-up, not a gym, so it claims no gym.
                title: introRules(run).intro ? 'Intro complete' : 'Gym cleared',
            };
        case 'abandoned':
            return {
                icon: 'door',
                title: 'Run abandoned',
            };
        default:
            return {
                icon: 'skull',
                title: 'Run over',
            };
    }
}

export default function RunSummary({ run, endedAt }: RunSummaryProps): ReactNode {
    const dispatch = useDispatch();
    // Ticket 185f: the tiers the ranch has open, for the line that says what this clear unlocked.
    const ranch = useSelector((state: RootState) => state.game);

    /**
     * One clock reading for the life of this panel. Lazy `useState` rather than a bare `Date.now()`
     * in the body: the latter would tick up on every re-render, so the duration would change while
     * the player read it and would not match the number already written to telemetry.
     */
    const [clock] = useState<number>(() => endedAt ?? Date.now());

    /**
     * ACTIVE TIME COMES FROM THE RUN LOG — ticket 156 §2.
     *
     * Read once, beside the clock, and for the same reason: this panel's numbers must not move
     * while the player reads them. The log is keyed by `<seed>@<startedAt>`, the same identity the
     * telemetry store joins on. Missing — a run played before 156, or a transcript the cap ate —
     * reads as 0, and `summarizeRun` falls back to wall clock for the headline.
     */
    const [activeMs] = useState<number>(() => {
        try {
            return findRunLog(runLogKeyFor(run.seed, run.startedAt))?.activeMs ?? 0;
        } catch {
            return 0;
        }
    });

    const summary = useMemo(() => summarizeRun(run, clock, activeMs), [run, clock, activeMs]);
    const banked = useMemo(() => bankedBlueprintCounts(run.modifiers), [run.modifiers]);
    // Ticket 169f: the modifiers this run was played with, named next to the tier.
    const modifierNames = useMemo(() => activeModifierNames(run), [run]);

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
    const headline = headlineFor(run);
    const bankedEntries = Object.entries(banked);
    // TICKET 195b: the gym's payout can be a save's first Trace; say where to use it.
    const firstTraceLine = useFirstTraceLine(bankedEntries.length > 0);

    /**
     * Leave. **The single teardown path** — see `store/runTeardown.ts`: the codex merge, the
     * victory-only unlock, then `clearRun`, which is what removes the run save key. Defeat and
     * abandon reach exactly this function and unlock nothing.
     */
    const leave = (): void => {
        playSfx('uiClick');
        teardownRun({ run, dispatch });
    };

    /*
     * TICKET 182a — THREE LARGE LINES AND ONE BUTTON.
     *
     * Line one is what the player kept, because that is what a run is for. Line two is how far it
     * got (with the tier and modifiers only when there are some), line three is what it unlocked.
     * The pacing grid and the two reassurance paragraphs are gone from the screen; the telemetry
     * entry written on mount still carries the clock, the fights and the deck.
     */
    const kept = bankedEntries.length === 0
        ? 'nothing this time'
        : bankedEntries
            .map(([speciesId, count]) => {
                const name = MingmingRegistry[speciesId]?.name ?? speciesId;
                return count > 1 ? `${name} trace ×${count}` : `${name} trace`;
            })
            .join(', ');
    const hasTier = run.tier > 0 || modifierNames.length > 0;
    const reached = `Reached biome ${summary.biomeReached} of ${run.biomes.length} · ${summary.fightsResolved} ${summary.fightsResolved === 1 ? 'fight' : 'fights'}`
        + (hasTier ? ` · tier ${run.tier}` : '')
        + (modifierNames.length > 0 ? ` · ${modifierNames.join(', ')}` : '');
    const unlocked = introRules(run).intro
        ? (run.outcome === 'victory' ? 'The real gyms are open' : 'The real gyms are still open to you')
        : run.outcome === 'victory'
            ? clearLine(gymName, run.tier, unlockedTiers(ranch))
            : `${gymName} not cleared`;

    return (
        <div className="ranch-screen">
            <header className="ranch-header">
                <h1><Icon name={headline.icon} size={22} /> {headline.title}</h1>
            </header>

            <section className="ranch-section ranch-section-wide">
                <ul className="rs-big">
                    <li
                        className="rs-big-line k-plate"
                        // The reassurance paragraph, as a hover: nothing here can be lost by closing the screen.
                        title="Traces were banked at the ranch as they dropped, not now. Your roster, codex and cleared gyms are a separate save and were never at risk."
                    >
                        You kept: {kept}
                    </li>
                    {firstTraceLine && <li className="rs-big-line k-plate" data-testid="first-trace-line">{firstTraceLine}</li>}
                    <li className="rs-big-line k-plate">{reached}</li>
                    <li className="rs-big-line k-plate">{unlocked}</li>
                </ul>

                <button type="button" className="ranch-button k-button rs-leave" onClick={leave}>
                    Back to ranch
                </button>
            </section>
        </div>
    );
}
