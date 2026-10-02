/**
 * TICKET 180a — SESSIONS ON DISK: `results/playtest/<session>/session.json`.
 *
 * Only the header, the move log and the notes are written. Nothing else is saved, because everything
 * else is rebuilt from them. `results/playtest/` is gitignored (the other folders under `results/`
 * are committed). Writes go to a temporary file and are renamed over the real one, so a crash
 * mid-write cannot leave half a session behind.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SessionFile } from './types';

export const DEFAULT_ROOT = join('results', 'playtest');

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export function sessionPath(root: string, name: string): string {
    if (!SAFE_NAME.test(name)) throw new Error(`session names may use letters, digits, dot, dash and underscore: "${name}"`);
    return join(root, name, 'session.json');
}

export function sessionExists(root: string, name: string): boolean {
    return existsSync(sessionPath(root, name));
}

export function readSession(root: string, name: string): SessionFile {
    const path = sessionPath(root, name);
    if (!existsSync(path)) throw new Error(`no session "${name}" (looked in ${path})`);
    return JSON.parse(readFileSync(path, 'utf8')) as SessionFile;
}

export function writeSession(root: string, name: string, session: SessionFile): void {
    const path = sessionPath(root, name);
    mkdirSync(join(root, name), { recursive: true });
    const temp = `${path}.tmp`;
    writeFileSync(temp, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
    renameSync(temp, path);
}
