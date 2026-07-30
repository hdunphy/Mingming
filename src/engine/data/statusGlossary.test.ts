import { describe, it, expect } from 'vitest';
import { statusGlossary, STATUS_COLORS } from './statusGlossary';
import { Statuses } from '../types';

describe('statusGlossary', () => {
    it('covers every StatusType with a name and non-empty description', () => {
        for (const status of Statuses) {
            const entry = statusGlossary[status];
            expect(entry, `Missing glossary entry for status "${status}"`).toBeDefined();
            expect(entry.name.trim().length, `Empty name for status "${status}"`).toBeGreaterThan(0);
            expect(entry.description.trim().length, `Empty description for status "${status}"`).toBeGreaterThan(0);
        }
    });

    it('has no stale entries for statuses that no longer exist', () => {
        for (const key of Object.keys(statusGlossary)) {
            expect(Statuses).toContain(key);
        }
    });

    it('defines a badge color for every StatusType', () => {
        for (const status of Statuses) {
            expect(STATUS_COLORS[status], `Missing color for status "${status}"`).toMatch(/^#/);
        }
    });
});
