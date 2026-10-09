import type { ReactNode } from 'react';

import { playSfx } from '../audio/AudioEngine';
import { feedbackUrl, type FeedbackRun } from './feedbackLink';

/**
 * TICKET 181c — "Tell Henry how it went". Opens the pre-filled form in a new tab and never blocks
 * anything else on the screen. Renders nothing when the build has no form template (local, dev).
 */
export default function FeedbackButton({ run, className }: { run: FeedbackRun | null; className?: string }): ReactNode {
    const url = feedbackUrl(run);
    if (url === null) return null;
    return (
        <button
            type="button"
            className={className}
            data-testid="feedback-button"
            onClick={() => {
                playSfx('uiClick');
                window.open(url, '_blank', 'noopener');
            }}
        >
            Tell Henry how it went
        </button>
    );
}
