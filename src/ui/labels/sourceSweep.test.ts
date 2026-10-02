/**
 * TICKET 183h — the source sweep. No string a component prints may still carry an old word: every
 * string literal, template piece and JSX text under `src/ui` is read, and one that names a firmware,
 * a blueprint, a scrap, and so on fails the build.
 *
 * What it skips, and why it is safe to:
 *   - class lists and ids (`os-tooltip-portal`, `map:workshop`): lowercase words with no sentence in
 *     them are the code's own names, which the ruling keeps;
 *   - an ALL-CAPS identifier (`DAEMON`, `REFLASH`): a union member or an action type;
 *   - import paths and property keys.
 * The listed exceptions below are code, not copy: a category id, a console warning, a CSS selector.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { OLD_WORDS } from './labels';

const ROOT = join(__dirname, '..');

const CODE_NOT_COPY: ReadonlySet<string> = new Set([
    'components/UnitReadouts.tsx::[UnitReadouts] Daemon at index ',
    'components/cardKeywords.ts::Daemon',
    'screens/runShell.ts::Daemon',
    'vfx/osTells.ts::[data-os-chip="',
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) sourceFiles(path, out);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
    }
    return out;
}

function printedLiterals(file: string): string[] {
    const source = readFileSync(file, 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
        let text: string | null = null;
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            const parent = node.parent;
            const skipped = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent)
                || (ts.isPropertyAssignment(parent) && parent.name === node);
            if (!skipped) text = node.text;
        } else if (ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            text = node.text;
        }
        if (text !== null) {
            const trimmed = text.trim();
            OLD_WORDS.lastIndex = 0;
            const isCode = /^[a-z0-9_:.\- ]+$/.test(trimmed) || /^[A-Z_]+$/.test(trimmed);
            if (trimmed.length > 0 && !isCode && OLD_WORDS.test(trimmed)) found.push(text.replace(/\s+/g, ' '));
        }
        ts.forEachChild(node, visit);
    };
    visit(tree);
    return found;
}

describe('183h source sweep', () => {
    it('no component prints an old word', () => {
        const offenders: string[] = [];
        for (const file of sourceFiles(ROOT)) {
            const rel = relative(ROOT, file).replace(/\\/g, '/');
            for (const text of printedLiterals(file)) {
                if (!CODE_NOT_COPY.has(`${rel}::${text}`)) offenders.push(`${rel}: ${text.slice(0, 100)}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
