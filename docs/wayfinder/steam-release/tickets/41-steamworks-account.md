# Steamworks account, $100 app fee, tax and identity, app ID (Henry checklist) (ticket 41)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [05](05-release-shape.md)
- Phase: Steam

## Deliverable (HITL — Henry does this, the agent prepares the checklist)

Steam Direct: $100 per app, non-refundable, recouped after $1,000 adjusted gross revenue; paid from an account with Admin permission; identity + tax interview (W-9 as a US sole proprietor unless Henry forms an entity — see ticket 54). Create the partner account, pay the fee, create the app, note the App ID. **Do this EARLY**: the Coming Soon page must be public well before launch and Valve reviews both the page and the build; new partner accounts also face a waiting period before a first release (verify the current number on the Steamworks docs at the time — it has been 30 days). The checklist lives in `research/41-steamworks-checklist.md` with every link.

## Done when

App ID recorded in the resolution (not the secret keys), partner account verified, and the store-page draft (ticket 45) can begin.

## Progress

**2026-09-08 — signup done through the tax interview; NOT closable yet.** Henry ran the Steam
Direct flow tonight: Steamworks Subscriber Agreement signed, **$100 app fee paid** (the 30-day
fee-to-release clock therefore starts 2026-09-07, Valve's Pacific date on the W-9 — earliest
possible release ~2026-10-07), and the **W-9 tax interview submitted**.

### The entity question the ticket deferred to [54](54-legal-and-licenses.md) is now answered

**He signed up as Dunphy LLC, not as a sole proprietor.** The checklist's LLC branch was taken.
Confirmed against the formation documents: Dunphy LLC is a **Delaware LLC, certificate of
formation filed 2021-08-02** (Harvard Business Services), and the initial-members resolution names
**Henry Dunphy alone** — a genuine single-member LLC. No K-1 has ever been issued, consistent with
default disregarded-entity treatment. Ticket 54's sole-proprietor-vs-LLC question is settled by
this act and should be updated to match.

Tax interview as filed: "single member of a Limited Liability Company" radio; Name `Henry Dunphy`,
Business/Single-Member LLC Name `Dunphy LLC`; **SSN, not EIN** (correct for a disregarded entity —
the W-9 carries the owner's TIN); BWHT unchecked; no exempt payee code; no FATCA code.

### One thing to watch, recorded because it was surprising

Valve's certification page **would not enable Submit unless all four W-9 certification checkboxes
were ticked, including item 2** ("I am subject to backup withholding because I have been notified
by the IRS..."), which is false for Henry. The paper W-9 instructs you to *strike* item 2 when it
does not apply; the vendor (valvesoftware.taxidentity.com) does not implement that and blocks
submission. The structured backup-withholding answer was given separately and correctly on the
earlier screen (BWHT box left unchecked), so that is most likely the field that drives withholding
— **but verify the applied withholding rate on the Steamworks tax-status page once the interview
processes.** If it shows 24%, the tax interview can be retaken; catch it before the first payout.

### What still blocks the Done-when

1. **Bank details not yet entered, and the account-name question is live.** Valve requires the
   payout account holder name to match the partner account's legal identity. Because the W-9
   beneficial owner is *Henry Dunphy* (the LLC being disregarded) while the partner account is
   *Dunphy LLC*, it is genuinely unclear whether a personal account passes — the checklist's LLC
   branch assumes a **Dunphy LLC business bank account is required**. Assume it is until Valve
   accepts otherwise; opening one needs the certificate of formation and probably an EIN.
2. **Verification is pending on Valve's side** (days).
3. **No app created, so no App ID** — the ticket's primary artefact.

Housekeeping surfaced by the LLC path, for [54](54-legal-and-licenses.md): Delaware franchise tax
is $300/yr due June 1 (a lapsed LLC can go void, which is awkward for KYC), and a Delaware LLC
operating from Massachusetts is generally expected to foreign-qualify there. Neither blocks Steam.

## Resolution

_(open)_

