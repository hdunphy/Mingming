import React from 'react';
import { useSelector } from 'react-redux';

import type { RootState } from '../store/store';
import type { IBattleState } from '../../engine/types';
import { describeDriver } from '../../engine/data/driverRegistry';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { Icon } from '../theme/Icon';
import AudioControls from './AudioControls';

/**
 * THE TOP BAR — ticket 145c. 44px, and everything a player used to hunt for.
 *
 * # WHAT IT REPLACED
 *
 * Three fixed-position islands, each added by a different ticket and none aware of the others: the
 * gauntlet progress banner (ticket 18, top centre), the TURN / CARDS PLAYED pills (ticket 90, top
 * left, added because *"Henry had no way to see the turn number or how many cards he had played"*),
 * and a floating `AudioControls` in the top-right corner. They overlapped the party columns at some
 * widths and each other at others, because nothing owned the strip they all lived in.
 *
 * # WHAT IS DELIBERATELY NOT HERE
 *
 * The deck, hand and discard COUNTS. Ticket 145 §1 lists them among the things Henry rejected from
 * the bar, and 145d gives them their honest home — a count belongs on the pile it counts, not in a
 * row of numbers at the top of the screen.
 *
 * `PLAYED n` is a plain gold number rather than pips, and that is §2a being precise rather than
 * lazy: draws mean there is no known maximum, so a pip row would be drawing a denominator the game
 * does not have. Ticket 22 chose pips for ENERGY for the mirror-image reason — there the maximum is
 * the whole point.
 *
 * # THE LOG LINE
 *
 * The bar carries the LATEST line only, with a chevron that opens the full log. That is ticket
 * 143c's collapsed/expanded model moved into the chrome: the log is a thing you consult, and a
 * consultable thing that is always open is a wall. The chevron is the affordance; the one line is
 * the reason to press it.
 */

/* Not exported: `react-refresh/only-export-components` allows a constant beside a component
   but not a function, and the only caller is the bar itself. Same shape `combatLogModel` took. */
/** The most recent line of either stream, or null. Combat first — an OS proc is a footnote to it. */
function latestLogLine(battleState: IBattleState): string | null {
    const osLogs = (battleState as unknown as { osLogs?: ReadonlyArray<string> }).osLogs ?? [];
    const logs = battleState.logs ?? [];
    return osLogs[osLogs.length - 1] ?? logs[logs.length - 1] ?? null;
}

export interface BattleTopBarProps {
    battleState: IBattleState;
    /** Opens the settings overlay. Optional — a bar rendered outside a fight has nowhere to send it. */
    readonly onOpenSettings?: () => void;
    /**
     * TOGGLES the combat log. The bar owns the chevron; `CombatLog` owns the panel.
     *
     * It was `onOpenLog` and it only ever opened — Henry, 2026-09-22: *"I cannot close the combat
     * log."* `BattleArena` passed `() => setLogOpen(true)`, so pressing the chevron on an open log
     * did nothing, and the panel's own header (the only other way out) sits under this bar at
     * z-index 50 against the bar's 1500, unreachable. Between them there was no way to close it.
     */
    onToggleLog: () => void;
    /** Whether the panel is open, so the chevron can point the way it will move. */
    logOpen?: boolean;
}

const BattleTopBar: React.FC<BattleTopBarProps> = ({ battleState, onToggleLog, logOpen = false, onOpenSettings }) => {
    const run = useSelector((state: RootState) => state.run.run);
    const gauntlet = run?.gauntlet ?? null;
    const drivers = run?.drivers ?? [];

    const isPlayerTurn = battleState.activeSide === 'PLAYER';
    const gym = run ? GYM_REGISTRY[run.gymId] : undefined;
    const nodeKind = run?.nodes.find(n => n.id === run.currentNodeId)?.kind;

    /*
     * The right-hand label. A gauntlet fight says WHICH fight, because ticket 18's reason still
     * holds — the last one is the leader's own team and that is the fight where holding a Revive
     * rather than spending it is a real decision. Everywhere else it is the gym and the rung, which
     * is what the mock shows: `ROOTFALL · ELITE`.
     */
    const place = gauntlet
        ? `GAUNTLET ${Math.min(gauntlet.fightIndex + 1, gauntlet.totalFights)}/${gauntlet.totalFights}`
        : gym?.name.toUpperCase() ?? '';
    const grade = gauntlet
        ? (gauntlet.fightIndex >= gauntlet.totalFights - 1 ? 'LEADER' : '')
        : (nodeKind ?? '').toUpperCase();

    const latest = latestLogLine(battleState);

    return (
        <>
            <div className="battle-topbar" data-testid="battle-topbar">
                <span className="pill">TURN <b>{battleState.turn}</b></span>
                <span className="pill">{isPlayerTurn ? 'YOUR MOVE' : 'ENEMY MOVE'}</span>
                {/*
                  * Ticket 90's counter, kept because `stampede` and `momentum_crash` scale on it and
                  * the deck's whole plan is invisible without it. Gold when it is above zero, so a
                  * player running a per-card scaler can read it without looking at it.
                  */}
                <span
                    className={`pill battle-topbar-played ${battleState.cardsPlayedThisTurn > 0 ? 'is-live' : ''}`}
                    title="Cards you have played this turn — what stampede, momentum crash and the other per-card scalers multiply by."
                >
                    PLAYED <b>{battleState.cardsPlayedThisTurn}</b>
                </span>

                <button
                    type="button"
                    className="battle-topbar-log"
                    onClick={onToggleLog}
                    aria-expanded={logOpen}
                    title={logOpen ? 'Close the combat log' : 'Open the combat log'}
                >
                    {/*
                      * TICKET 155, DEEP DIVE 3 — a placeholder, not an empty string.
                      *
                      * On turn 1 there is nothing in the log yet, and `latest ?? ''` rendered a
                      * button containing a lone chevron: an affordance with no label, which reads
                      * as a rendering fault rather than as "nothing has happened yet".
                      */}
                    <span className="battle-topbar-log-text">{latest ?? 'COMBAT LOG'}</span>
                    {/* The glyph points where the panel will GO, not where it is: a chevron that
                        never changes reads as decoration, and this one is the only close control
                        most players will find. */}
                    <span className="battle-topbar-chevron" aria-hidden="true">{logOpen ? '▴' : '▾'}</span>
                </button>

                <AudioControls inline />
                {place && (
                    <span className="pill battle-topbar-place">
                        {place}{grade ? <> · <b>{grade}</b></> : null}
                    </span>
                )}
                {/*
                  * TICKET 155, DEEP DIVE 3 — the gear was a `<span>` with no handler: a settings
                  * button that looked like a settings button and did nothing. A fight is exactly
                  * where a player reaches for the motion switches (146a's three), so it is worth
                  * more here than on any other screen.
                  */}
                <button
                    type="button"
                    className="battle-topbar-gear"
                    title="Settings"
                    aria-label="Settings"
                    onClick={onOpenSettings}
                >
                    <Icon name="settings" />
                </button>
            </div>

            {/*
              * THE DRIVERS ROW, under the bar on the left (§2a). A Driver is the gym leader's
              * standing rule for this whole run — ticket 68 ruling 4 put it on the offer screen
              * because the route is irreversible, and this is the other half of that: it is still
              * true while you are fighting, and a rule you cannot see is a rule you cannot play
              * around. NOT the same thing as a unit's daemons, which live on its plaque.
              */}
            {drivers.length > 0 && (
                <div className="battle-drivers" data-testid="battle-drivers">
                    <span className="battle-drivers-label">DRIVERS</span>
                    {drivers.map((id) => {
                        const { name, description } = describeDriver(id);
                        return (
                            <span key={id} className="battle-driver-chip" title={description}>
                                <i />
                                {name}
                            </span>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default BattleTopBar;
