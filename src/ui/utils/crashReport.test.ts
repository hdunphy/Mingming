/**
 * Ticket 04 (steam-release map). `buildCrashReport` runs inside a catch block on a tree that has
 * already failed, so the contract is narrow and absolute: **it never throws**, whatever it is
 * handed. Every case below is a way the input can be hostile.
 */

import { describe, expect, it } from 'vitest';

import {
    buildCrashReport,
    crashReportName,
    CRASH_REPORT_VERSION,
    serializeCrashReport,
} from './crashReport';

const NOW = () => '2026-08-21T03:30:00.000Z';

describe('buildCrashReport', () => {
    it('carries the error, the component stack and the state', () => {
        const report = buildCrashReport({
            error: new Error('battle screen exploded'),
            componentStack: '\n  at BattleArena',
            state: { game: { scrapCount: 42 } },
            now: NOW,
            userAgent: 'test-agent',
        });

        expect(report.version).toBe(CRASH_REPORT_VERSION);
        expect(report.createdAt).toBe('2026-08-21T03:30:00.000Z');
        expect(report.userAgent).toBe('test-agent');
        expect(report.error.message).toBe('battle screen exploded');
        expect(report.error.stack).toBeTruthy();
        expect(report.componentStack).toContain('BattleArena');
        expect((report.state as { game: { scrapCount: number } }).game.scrapCount).toBe(42);
        expect(report.stateError).toBeUndefined();
    });

    it('names the report the way snapshots are named: stamped, slugged, no dialog', () => {
        expect(crashReportName(new Error('battle screen exploded'), '2026-08-21T03:30:00.000Z'))
            .toBe('crash-20260821033000-battlesc');
    });

    it('falls back to a usable name when the message has no alphanumerics', () => {
        expect(crashReportName(new Error('!!!'), '2026-08-21T03:30:00.000Z'))
            .toBe('crash-20260821033000-nomessage');
    });

    it('handles a thrown string', () => {
        const report = buildCrashReport({ error: 'plain string throw', now: NOW });
        expect(report.error.name).toBe('Error');
        expect(report.error.message).toBe('plain string throw');
    });

    it('handles a thrown non-Error object', () => {
        const report = buildCrashReport({ error: { code: 7 }, now: NOW });
        expect(report.error.message).toContain('7');
    });

    it('degrades to `stateError` instead of throwing on circular state', () => {
        const circular: Record<string, unknown> = { a: 1 };
        circular.self = circular;

        const report = buildCrashReport({ error: new Error('boom'), state: circular, now: NOW });

        expect(report.state).toBeUndefined();
        expect(report.stateError).toBeTruthy();
        expect(report.error.message).toBe('boom');
    });

    it('omits state cleanly when none was given', () => {
        const report = buildCrashReport({ error: new Error('boom'), now: NOW });
        expect(report.state).toBeUndefined();
        expect(report.stateError).toBeUndefined();
    });

    it('survives a clock that throws', () => {
        const report = buildCrashReport({
            error: new Error('boom'),
            now: () => {
                throw new Error('no clock');
            },
        });
        expect(report.createdAt).toBe('unknown');
        expect(report.name).toContain('crash-unknown');
    });
});

describe('serializeCrashReport', () => {
    it('produces parseable, indented JSON', () => {
        const text = serializeCrashReport(
            buildCrashReport({ error: new Error('boom'), state: { a: 1 }, now: NOW }),
        );
        expect(text).toContain('\n  ');
        expect(JSON.parse(text).error.message).toBe('boom');
    });
});
