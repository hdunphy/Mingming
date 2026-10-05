/**
 * Call `flush` when the page is about to go away: hidden (tab switch, minimise, and the last event
 * a closing window reliably delivers), `pagehide`, or `beforeunload`. Returns the unbinder.
 *
 * Pairs with `TrailingFlush`: a deferred write is only safe if the moments that end the page
 * drain it.
 */
export function flushOnPageLeave(flush: () => void, win: Window, doc: Document): () => void {
    const onVisibility = (): void => { if (doc.visibilityState === 'hidden') flush(); };
    doc.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('pagehide', flush);
    win.addEventListener('beforeunload', flush);
    return () => {
        doc.removeEventListener('visibilitychange', onVisibility);
        win.removeEventListener('pagehide', flush);
        win.removeEventListener('beforeunload', flush);
    };
}
