/**
 * Round-trip proof for the snapshot loop.
 *
 * The load-bearing assertion is `export -> import` deep-equality, and it is written with
 * `toEqual` rather than by comparing `JSON.stringify` output on purpose: the normalizer
 * canonicalizes the *presence* of ~9 optional fields, not the key ORDER of the object it
 * builds, so two states that are structurally identical serialize to different strings.
 * A stringify comparison here would fail for a reason that has nothing to do with fidelity.
 *
 * Runs in the default `node` environment — no `document`, no `KeyboardEvent`. That is the
 * reason `exportSnapshot` returns its built file instead of only downloading it, and the
 * reason the hotkey predicate takes a structural event rather than a DOM one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    SNAPSHOT_EXPORT_HOTKEY_LABEL,
    buildSnapshotFile,
    exportSnapshot,
    isSnapshotExportHotkey,
    snapshotFileName,
    snapshotName,
    snapshotSeedPrefix,
} from './snapshotIO';
import { loadScenario } from './scenarios/scenarioIO';
import { normalizeBattleState } from './scenarios/normalizeBattleState';
import { computeRegistryHash } from './scenarios/registryHash';
import { CURRENT_SCENARIO_VERSION } from './scenarios/scenarioSchema';
import type { SnapshotScenario } from './scenarios/scenarioSchema';
import { createRichBattleState, createSparseBattleState } from './scenarios/scenarioTestSupport';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('snapshot naming', () => {
    it('auto-names `snapshot-t<turn>-<seed prefix>.scenario.json`', () => {
        const state = createSparseBattleState({ turn: 14, seed: 'a3f9c02b-6d41-4d0e-9e6a-1f' });

        expect(snapshotFileName(state)).toBe('snapshot-t14-a3f9c02b.scenario.json');
        expect(snapshotName(state)).toBe('snapshot-t14-a3f9c02b');
    });

    it('strips separators rather than truncating through them', () => {
        expect(snapshotSeedPrefix('seed-0001')).toBe('seed0001');
        expect(snapshotSeedPrefix('ab')).toBe('ab');
    });

    it('falls back for a seed with no alphanumerics', () => {
        expect(snapshotSeedPrefix('')).toBe('noseed');
        expect(snapshotSeedPrefix('---')).toBe('noseed');
    });
});

describe('buildSnapshotFile', () => {
    it('stamps the ticket-02 envelope with kind snapshot and the current registry hash', () => {
        const result = buildSnapshotFile(createSparseBattleState());

        expect(result.success).toBe(true);
        expect(result.scenario!.kind).toBe('snapshot');
        expect(result.scenario!.version).toBe(CURRENT_SCENARIO_VERSION);
        expect(result.scenario!.registryHash).toBe(computeRegistryHash());
        expect(result.scenario!.createdAt).toBeTruthy();
    });

    it('normalizes the state before serializing', () => {
        const sparse = createSparseBattleState();
        const result = buildSnapshotFile(sparse);

        // The fill class is present on the exported state even though the input omitted it.
        expect(result.scenario!.state).toEqual(normalizeBattleState(sparse));
        expect(result.scenario!.state.enemyMode).toBe('MOVES');
        expect(result.scenario!.state.playerParty[0].hooks).toEqual([]);
    });

    it('omits `tape` entirely when no recorder supplied one', () => {
        const result = buildSnapshotFile(createSparseBattleState());

        expect('tape' in result.scenario!).toBe(false);
        expect(JSON.parse(result.json!).tape).toBeUndefined();
    });

    it('carries a supplied tape into the envelope untouched', () => {
        const tape = [{ type: 'battle/endTurn' }, { type: 'battle/playProgram', payload: { id: 'x' } }];
        const result = buildSnapshotFile(createSparseBattleState(), tape);

        expect(result.scenario!.tape).toEqual(tape);
        expect(JSON.parse(result.json!).tape).toEqual(tape);
    });

    it('reports failure instead of throwing on an unserializable state', () => {
        const broken = createSparseBattleState({ turn: 'not-a-number' as unknown as number });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = buildSnapshotFile(broken);

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    });
});

describe('export -> import round trip', () => {
    it('round-trips a sparse state to a deep-equal normalized state', () => {
        const original = createSparseBattleState();
        const exported = buildSnapshotFile(original);

        const loaded = loadScenario(exported.json!);

        expect(loaded.scenario).not.toBeNull();
        expect(loaded.registryHashMismatch).toBe(false);
        expect(loaded.scenario!.kind).toBe('snapshot');
        // Structural, never JSON.stringify — see the file header.
        expect((loaded.scenario as SnapshotScenario).state).toEqual(normalizeBattleState(original));
    });

    it('round-trips a state whose optional fields all carry real values', () => {
        const original = createRichBattleState();
        const exported = buildSnapshotFile(original);

        const loaded = loadScenario(exported.json!);

        expect((loaded.scenario as SnapshotScenario).state).toEqual(normalizeBattleState(original));
    });

    it('is idempotent — a second export of the loaded state matches the first', () => {
        const first = buildSnapshotFile(createRichBattleState());
        const loaded = loadScenario(first.json!);
        const second = buildSnapshotFile((loaded.scenario as SnapshotScenario).state);

        expect(second.scenario!.state).toEqual(first.scenario!.state);
        expect(second.fileName).toBe(first.fileName);
    });

    it('round-trips the tape alongside the state', () => {
        const tape = [{ type: 'battle/endTurn' }, { type: 'battle/selectCard', payload: 'c1' }];
        const exported = buildSnapshotFile(createSparseBattleState(), tape);

        const loaded = loadScenario(exported.json!);

        expect((loaded.scenario as SnapshotScenario).tape).toEqual(tape);
    });

    it('flags registry drift loudly without refusing the load', () => {
        const exported = buildSnapshotFile(createSparseBattleState());
        const drifted = { ...JSON.parse(exported.json!), registryHash: '1:deadbeef' };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const loaded = loadScenario(drifted);

        expect(loaded.registryHashMismatch).toBe(true);
        expect(loaded.scenario).not.toBeNull();
        expect(warn).toHaveBeenCalled();
    });
});

describe('exportSnapshot', () => {
    it('no-ops with a warning when there is no battle in progress', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = exportSnapshot(null);

        expect(result.success).toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    it('builds the file headlessly when there is no document', () => {
        // Stubbed rather than assumed, so the assertion still describes the headless branch
        // if this suite is ever moved to a jsdom environment.
        vi.stubGlobal('document', undefined);
        vi.spyOn(console, 'info').mockImplementation(() => {});

        const result = exportSnapshot(createSparseBattleState());

        expect(result.success).toBe(true);
        expect(result.fileName).toBe('snapshot-t1-seed0001.scenario.json');
    });

    it('downloads via a Blob and a synthetic anchor click, then revokes the URL', () => {
        const link: Record<string, unknown> = { style: {}, setAttribute: vi.fn(), click: vi.fn() };
        const documentStub = {
            createElement: vi.fn(() => link),
            body: { appendChild: vi.fn(), removeChild: vi.fn() },
        };
        const createObjectURL = vi.fn(() => 'blob:snapshot');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('document', documentStub);
        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
        vi.spyOn(console, 'info').mockImplementation(() => {});

        const result = exportSnapshot(createSparseBattleState({ turn: 7 }));

        expect(result.success).toBe(true);
        expect(link.setAttribute).toHaveBeenCalledWith('href', 'blob:snapshot');
        expect(link.setAttribute).toHaveBeenCalledWith(
            'download',
            'snapshot-t7-seed0001.scenario.json',
        );
        expect(link.click).toHaveBeenCalledTimes(1);
        expect(documentStub.body.removeChild).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:snapshot');
    });
});

describe('isSnapshotExportHotkey', () => {
    const event = (overrides: Record<string, unknown> = {}) => ({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: 'E',
        code: 'KeyE',
        target: null,
        ...overrides,
    });

    it('is advertised as Ctrl+Shift+E', () => {
        expect(SNAPSHOT_EXPORT_HOTKEY_LABEL).toBe('Ctrl+Shift+E');
    });

    it('matches Ctrl+Shift+E', () => {
        expect(isSnapshotExportHotkey(event())).toBe(true);
        expect(isSnapshotExportHotkey(event({ key: 'e', code: undefined }))).toBe(true);
        expect(isSnapshotExportHotkey(event({ key: 'Dead', code: 'KeyE' }))).toBe(true);
    });

    it('rejects the wrong modifier soup', () => {
        expect(isSnapshotExportHotkey(event({ ctrlKey: false }))).toBe(false);
        expect(isSnapshotExportHotkey(event({ shiftKey: false }))).toBe(false);
        expect(isSnapshotExportHotkey(event({ altKey: true }))).toBe(false);
        expect(isSnapshotExportHotkey(event({ metaKey: true }))).toBe(false);
        expect(isSnapshotExportHotkey(event({ key: 'd', code: 'KeyD' }))).toBe(false);
    });

    it('no-ops while focus is in a text entry, same guard as Ctrl+Shift+D', () => {
        expect(isSnapshotExportHotkey(event({ target: { tagName: 'INPUT' } }))).toBe(false);
        expect(isSnapshotExportHotkey(event({ target: { tagName: 'TEXTAREA' } }))).toBe(false);
        expect(
            isSnapshotExportHotkey(event({ target: { tagName: 'DIV', isContentEditable: true } })),
        ).toBe(false);
        expect(isSnapshotExportHotkey(event({ target: { tagName: 'DIV' } }))).toBe(true);
    });
});
