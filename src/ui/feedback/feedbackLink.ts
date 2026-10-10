/**
 * TICKET 181c — "TELL HENRY HOW IT WENT": the pre-filled feedback form link.
 *
 * Henry's playtesters are mostly new to the genre and doing him a favour, so feedback is one click
 * from the end of a run rather than something to remember. The Google Form's pre-filled link is a
 * TEMPLATE with five placeholders, `{build}`, `{starter}`, `{reached}`, `{run}` and `{minutes}`,
 * passed in at build time as `VITE_FEEDBACK_FORM_URL` (the deploy workflow sets it). Each value is
 * URL-encoded into its slot.
 *
 * No template, no link: `feedbackUrl` returns null and the buttons do not render, so a local or dev
 * build never sends anyone to the real form.
 *
 * The run's values come from `feedbackRun.ts`; this module only fills the template.
 */

import { BUILD_INFO, buildText } from '../buildInfo';

/** The four values a run fills. Strings, already formatted; blank means "not known here". */
export interface FeedbackRun {
    readonly starter: string;
    readonly reached: string;
    readonly run: string;
    readonly minutes: string;
}

/**
 * The template this build was given, or null. Read on every call rather than once at import, so a
 * test can stub the env var; Vite replaces the expression with a literal in a production build.
 */
export function feedbackTemplate(): string | null {
    const raw: unknown = import.meta.env.VITE_FEEDBACK_FORM_URL;
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/**
 * The form URL with every placeholder filled, or null when there is no template.
 *
 * `run` null is the Settings button: only the build is known there, so the other four are blank.
 */
export function feedbackUrl(
    run: FeedbackRun | null,
    template: string | null = feedbackTemplate(),
    build: string = buildText(BUILD_INFO),
): string | null {
    if (template === null || template.trim() === '') return null;
    const values: Record<string, string> = {
        build,
        starter: run?.starter ?? '',
        reached: run?.reached ?? '',
        run: run?.run ?? '',
        minutes: run?.minutes ?? '',
    };
    return template.trim().replace(/\{(build|starter|reached|run|minutes)\}/g, (_, key: string) => encodeURIComponent(values[key]));
}
