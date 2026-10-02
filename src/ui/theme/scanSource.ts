/**
 * Test helper for ticket 183a's two source sweeps (`noHex.test.ts`, `theme.test.ts`): every
 * stylesheet and script under `src`, as forward-slash paths from the repo root. Pure file reading;
 * nothing in the app imports it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SourceFile {
    readonly path: string;
    readonly text: string;
}

const EXTENSIONS = /\.(css|ts|tsx)$/;

export function sourceFiles(root = 'src'): SourceFile[] {
    const found: SourceFile[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (EXTENSIONS.test(entry.name)) {
                found.push({ path: full.split('\\').join('/'), text: readFileSync(full, 'utf8') });
            }
        }
    };
    walk(root);
    return found.sort((a, b) => a.path.localeCompare(b.path));
}
