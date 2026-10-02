import React from 'react';
import { useSelector } from 'react-redux';

import type { RootState } from '../store/store';
import type { IBattleState } from '../../engine/types';
import { CounterPip } from './CounterPip';
import { readDriverCounter } from '../counters/readCounter';
import { globalBattleEventBus } from '../../engine/events';

import { BiomeSign } from './topbar/BiomeSign';
import { PlayedChip } from './topbar/PlayedChip';
import { SettingsGear } from './topbar/SettingsGear';
import { TurnChip } from './topbar/TurnChip';
import './topbar/topbar.css';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import { introRules } from '../../engine/run/intro/introRules';
import { deckScalesWithCardsPlayed } from '../utils/cardsPlayedScaling';
import { driverText } from '../labels/driverText';


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
    /*
     * TICKET 16: the PLAYER's Drivers, read off the BATTLE rather than the run. They are the same
     * list — `buildBattleSetup` copies `run.drivers` into `setup.drivers` and `createBattleState`
     * into `activeDrivers` — but the battle's copy is the one that is actually fighting, and it is
     * also the only one a debug scenario has (no run, so the row used to be blank there, which is
     * exactly where a Driver gets tried out until ticket 17 wires the elite drop).
     */
    const drivers = battleState.activeDrivers ?? [];

    /*
     * TICKET 16 — PROC-VISIBLE, the chip's half. A `DRIVER_PROC` on the bus re-keys that Driver's
     * chip, so its `is-proc` animation restarts on every firing rather than once. Held as a counter
     * per Driver id, not a boolean: two procs in one second must flash twice. The bus is muted under
     * a preview and silent inside the AI's search, so nothing here can flash for a fight that is
     * not happening.
     */
    const [procKeys, setProcKeys] = React.useState<Record<string, number>>({});
    React.useEffect(() => {
        const unsubscribe = globalBattleEventBus.subscribe((event) => {
            if (event.type !== 'DRIVER_PROC' || !event.fromPlayer) return;
            const id = event.driverId;
            setProcKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
        });
        return unsubscribe;
    }, []);

    const advanced = useAdvancedContent();
    const isPlayerTurn = battleState.activeSide === 'PLAYER';

    /*
     * The right-hand label. A gauntlet fight says WHICH fight, because ticket 18's reason still
     * holds — the last one is the leader's own team and that is the fight where holding a Revive
     * rather than spending it is a real decision. Everywhere else it is the gym and the rung, which
     * is what the mock shows: `ROOTFALL · ELITE`.
     */
    /*
     * TICKET 182a: the "EMBERFALL · WILD" pill is cut. Only a gauntlet keeps its label, because
     * "which fight of the gauntlet is this" is not shown anywhere else and the last one is the
     * leader's own team.
     */
    const place = gauntlet
        ? `GAUNTLET ${Math.min(gauntlet.fightIndex + 1, gauntlet.totalFights)}/${gauntlet.totalFights}`
        : '';
    const grade = gauntlet && gauntlet.fightIndex >= gauntlet.totalFights - 1 ? 'LEADER' : '';

    const latest = latestLogLine(battleState);

    return (
        <>
            <div className="battle-topbar" data-testid="battle-topbar">
                <TurnChip turn={battleState.turn} />
                {/*
                  * TICKET 182a — the "YOUR MOVE / ENEMY MOVE" pill is gone from the screen: the hand
                  * being playable already says it. Screen readers still get it, as a polite
                  * announcement, because the hand's state is not something they can see.
                  */}
                <span className="sr-only" aria-live="polite">{isPlayerTurn ? 'Your move' : 'Enemy move'}</span>
                {/*
                  * Ticket 90's counter, kept because `stampede` and `momentum_crash` scale on it and
                  * the deck's whole plan is invisible without it. Gold when it is above zero, so a
                  * player running a per-card scaler can read it without looking at it.
                  */}
                {/* TICKET 182b: drawn only when a card in the deck scales with it (or Show advanced content). */}
                {(advanced || deckScalesWithCardsPlayed(battleState)) && (
                    <PlayedChip played={battleState.cardsPlayedThisTurn} />
                )}

                {/* TICKET 182c: the intro has no combat log, so no chevron to open one. */}
                {introRules(run).showBattleLogs && (
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
                )}

                {/* TICKET 182a: no volume slider here - volume lives in Settings (the gear, right). */}
                {place && (
                    <span className="k-slant k-display battle-topbar-place" style={{ ['--k-cut' as string]: '5px' }}>
                        {place}{grade ? <> · <b>{grade}</b></> : null}
                    </span>
                )}
                {/* TICKET 183b: the biome's name, said once, in words (it was a faint line on the backdrop). */}
                {battleState.biomeName && (
                    <BiomeSign name={battleState.biomeName} element={battleState.biomeElement ?? 'None'} />
                )}
                {/*
                  * TICKET 155, DEEP DIVE 3 — the gear was a `<span>` with no handler: a settings
                  * button that looked like a settings button and did nothing. A fight is exactly
                  * where a player reaches for the motion switches (146a's three), so it is worth
                  * more here than on any other screen.
                  */}
                <SettingsGear onOpen={onOpenSettings} />
            </div>

            {/*
              * THE DRIVERS ROW, under the bar on the left (§2a). The PLAYER's party-wide passives
              * for this run (ticket 16) — a standing rule the whole party runs under, and a rule you
              * cannot see is a rule you cannot play around. Each chip carries its rule text as the
              * tooltip and flashes when its Driver procs. NOT the same thing as a unit's daemons,
              * which live on its plaque.
              */}
            {drivers.length > 0 && (
                <div className="battle-drivers" data-testid="battle-drivers">
                    <span className="battle-drivers-label">TOTEMS</span>
                    {drivers.map((id) => {
                        const { name, description } = driverText(id);
                        const procKey = procKeys[id] ?? 0;
                        return (
                            <span
                                // The proc count is part of the key ON PURPOSE: a re-mount is what
                                // restarts a CSS animation, and toggling a class off and on again
                                // within one commit does not.
                                key={`${id}:${procKey}`}
                                className={`battle-driver-chip${procKey > 0 ? ' is-proc' : ''}`}
                                title={description}
                                data-testid={`battle-driver-${id}`}
                                data-procs={procKey}
                            >
                                <i />
                                {name}
                                {/* 184c: a Driver that counts toward something shows where it is. */}
                                <CounterPip reading={readDriverCounter(id, battleState)} />
                            </span>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default BattleTopBar;
