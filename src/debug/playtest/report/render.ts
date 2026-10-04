/**
 * TICKET 180f — THE MORNING REPORT, as plain-English markdown.
 *
 * Top of the page: what is most likely a bug (invariant failures), then surprises. Then the runs,
 * the agent's notes, and the patterns in what it chose. Short on purpose: every list stops at its
 * top ten and says how many more there were; the full logs stay in `results/playtest/<date>/`.
 * Every section is always present, with "None." when there is nothing to say, so a reader can tell
 * a quiet night from a missing section.
 */
import type { RunFact } from './facts';
import { groupNotes } from './notes';
import { TOP, cardTallies, commonReasons, explainedTally, invariantGroups, shelfTallies, surpriseGroups, upgradeTallies } from './tally';

const more = (total: number): string[] => (total > TOP ? [`- ...and ${total - TOP} more (see the logs in results).`] : []);
const none = (items: ReadonlyArray<unknown>): string[] => (items.length === 0 ? ['None.'] : []);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const json = (v: unknown): string => JSON.stringify(v);

export const replayCommand = (date: string, session: string, atMove: number): string =>
    `npm run playtest -- replay --results results/playtest/${date} --session ${session} --to ${atMove + 1}`;

function summary(date: string, runs: ReadonlyArray<RunFact>): string[] {
    const count = (outcome: string) => runs.filter((r) => r.outcome === outcome).length;
    const parts = [
        `${plural(runs.length, 'run')} played`,
        `${count('victory')} won`, `${count('defeat')} lost`, `${count('budget')} stopped by the decision budget`,
        `${count('abandoned') + count('unfinished')} cut short or unfinished`,
    ];
    const tokens = runs.reduce((n, r) => n + (r.driver?.tokens ?? 0), 0);
    const minutes = runs.reduce((n, r) => n + (r.driver?.minutes ?? 0), 0);
    const cost = runs.reduce((n, r) => n + (r.driver?.costUsd ?? 0), 0);
    const spend = tokens > 0 || minutes > 0
        ? ` The driver reported ${tokens.toLocaleString('en-US')} tokens, ${Math.round(minutes)} minutes${cost > 0 ? ` and about $${cost.toFixed(2)}` : ''} in all.`
        : '';
    return [`# Agent playtest night, ${date}`, '', `${parts.join(', ')}.${spend}`, ''];
}

function invariantSection(date: string, runs: ReadonlyArray<RunFact>): string[] {
    const groups = invariantGroups(runs);
    return [
        '## Invariant failures (most likely bugs)', '',
        ...none(groups),
        ...groups.slice(0, TOP).map((g) => `- ${g.name}: ${g.detail}${g.count > 1 ? ` (${g.count} times)` : ''}. First seen in ${g.session}; replay it with \`${replayCommand(date, g.session, g.atMove)}\`.`),
        ...more(groups.length), '',
    ];
}

/** One line for the differences a firmware or Aura accounted for (193c): counted, never listed as bugs. */
function explainedLine(runs: ReadonlyArray<RunFact>): string[] {
    const { total, by } = explainedTally(runs);
    if (total === 0) return [];
    const names = [...by.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([name, n]) => `${name} (${n})`);
    return [`${total} explained by a firmware or Aura (not bugs, so not listed above): ${names.join(', ')}. Ticket 186d: card text stays clean and the combat log says what a firmware adds.`, ''];
}

function surpriseSection(date: string, runs: ReadonlyArray<RunFact>): string[] {
    const groups = surpriseGroups(runs);
    return [
        '## Surprises (a bug, or wording that misled)', '',
        ...none(groups),
        ...groups.slice(0, TOP).flatMap((g) => [
            `- ${g.card} (${g.type}), ${plural(g.count, 'time')}. Printed text: "${g.text}"`,
            `  Typical case: the agent expected ${json(g.prediction)} and got ${json(g.result)}. Replay: \`${replayCommand(date, g.session, g.atMove)}\``,
        ]),
        ...more(groups.length), '',
        ...explainedLine(runs),
    ];
}

function runsSection(runs: ReadonlyArray<RunFact>): string[] {
    return [
        '## Runs', '',
        ...none(runs),
        ...runs.map((r) => {
            const driver = r.driver;
            const spend = [
                driver?.tokens === undefined ? null : `${driver.tokens.toLocaleString('en-US')} tokens`,
                driver?.minutes === undefined ? null : `${Math.round(driver.minutes)} minutes${driver.timedOut ? ' (hit the time limit)' : ''}`,
            ].filter(Boolean).join(', ');
            return `- ${r.session}: ${r.starter}, gym ${r.gym}, ${r.header.mode} mode. ${r.outcome}; ${plural(r.fights, 'fight')} won, biome ${r.biome}, ${plural(r.deckSize, 'card')} in the deck, ${r.scrap} scrap left, ${plural(r.decisions, 'decision')}${spend ? `, ${spend}` : ''}.`;
        }), '',
    ];
}

function notesSection(runs: ReadonlyArray<RunFact>): string[] {
    const groups = groupNotes(runs.flatMap((r) => r.notes));
    return [
        "## The agent's notes", '',
        ...none(groups),
        ...groups.slice(0, TOP).flatMap((g) => [
            `- ${g.label} (${plural(g.notes.length, 'note')})`,
            ...g.notes.slice(0, 2).map((text) => `  - "${text}"`),
        ]),
        ...more(groups.length), '',
    ];
}

function patternsSection(runs: ReadonlyArray<RunFact>): string[] {
    const cards = cardTallies(runs);
    const taken = cards.filter((c) => c.picked > 0).sort((a, b) => b.picked - a.picked || (a.card < b.card ? -1 : 1));
    const passed = cards.filter((c) => c.passed > 0).sort((a, b) => b.passed - a.passed || (a.card < b.card ? -1 : 1));
    const shelf = shelfTallies(runs).filter((s) => s.bought === 0).sort((a, b) => b.offered - a.offered || (a.item < b.item ? -1 : 1));
    const upgrades = upgradeTallies(runs);
    const reasonLine = (reasons: ReadonlyArray<string>) => (reasons.length > 0 ? ` Reasons: ${reasons.join('; ')}.` : '');
    return [
        '## Decision patterns', '',
        '### Cards taken most often', '', ...none(taken),
        ...taken.slice(0, TOP).map((c) => `- ${c.card}: taken ${c.picked} of ${c.offered} times offered.${reasonLine(c.reasons.filter((r) => !r.startsWith('passed:')))}`), ...more(taken.length), '',
        '### Cards passed over most often', '', ...none(passed),
        ...passed.slice(0, TOP).map((c) => `- ${c.card}: passed over ${c.passed} of ${c.offered} times offered.${reasonLine(commonReasons(c.reasons.filter((r) => r.startsWith('passed:')).map((r) => r.slice(8))))}`), ...more(passed.length), '',
        '### Shop items never bought', '', ...none(shelf),
        ...shelf.slice(0, TOP).map((s) => `- ${s.item}: on a shelf ${s.offered} times, never bought.`), ...more(shelf.length), '',
        '### Upgrades taken', '', ...none(upgrades),
        ...upgrades.slice(0, TOP).map((u) => `- ${u.card}: ${plural(u.count, 'time')}.`), ...more(upgrades.length), '',
    ];
}

export function renderReport(date: string, runs: ReadonlyArray<RunFact>): string {
    return [
        ...summary(date, runs),
        ...invariantSection(date, runs),
        ...surpriseSection(date, runs),
        ...runsSection(runs),
        ...notesSection(runs),
        ...patternsSection(runs),
    ].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
