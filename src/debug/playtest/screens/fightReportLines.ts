/** TICKET 180a — the fight outcome as text lines: result, HP left, foes, the five biggest hits. */
import { nodeKindLabel } from '../gameText';
import type { FightReport } from '../types';

export function fightReportLines(report: FightReport): string[] {
    const lines: string[] = [];
    const result = report.truncated ? 'DID NOT FINISH (turn cap)' : report.won ? 'WON' : 'LOST';
    lines.push(`FIGHT ${result}: ${nodeKindLabel(report.kind)} against ${report.foes.map((f) => f.name).join(', ')}, ${report.turns} turns.`);
    lines.push(`HP left: ${report.party.map((m) => `${m.name} ${m.hp}/${m.maxHp}`).join(', ')}.`);
    if (report.hits.length > 0) {
        lines.push('Biggest hits:');
        for (const hit of report.hits) {
            lines.push(`  ${hit.source}'s ${hit.label} on ${hit.target}: ${hit.total}${hit.times > 1 ? ` (${hit.times} hits)` : ''}`);
        }
    }
    return lines;
}
