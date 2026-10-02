import React from 'react';

import type { CounterReading } from '../counters/counterTypes';

/**
 * TICKET 184c — the counter pip: a few characters beside a firmware chip, a daemon tag or a Driver
 * chip. `3/5` while counting, lit when the next play fires it, `USED` until the turn resets, `ARMED`
 * for a one-time effect, or a live number. Its sentence is the hover text. What it says is decided
 * entirely by the reading (`ui/counters`); this only draws it.
 */
export const CounterPip: React.FC<{ reading: CounterReading | null }> = ({ reading }) => {
    if (!reading) return null;
    return (
        <span
            className={`counter-pip counter-pip-${reading.state}`}
            title={reading.tooltip}
            data-testid="counter-pip"
            data-state={reading.state}
        >
            {reading.text}
        </span>
    );
};

export default CounterPip;
