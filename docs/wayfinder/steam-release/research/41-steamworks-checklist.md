# Steamworks account checklist (ticket 41) — verified against Valve's pages 2026-08-30

Source of truth: https://partner.steamgames.com/steamdirect — re-check before acting; Valve moves
these numbers.

## The three clocks this starts (why tonight beats next month)

- **30-day waiting period** between paying the app fee and the earliest possible release.
- **Coming Soon page must be publicly visible at least 2 weeks** before release (practically:
  months, for wishlists — the map targets the page ~Dec 2026).
- **Verification takes days**, and the store-page draft (ticket 45) cannot start until the
  partner account exists.

## Before you sit down (10 minutes of gathering)

1. **Entity decision:** sole proprietor (you, personally) or an LLC (ticket 54's question).
   As an individual US filer the tax interview is a **W-9** — legal name, address, **SSN**.
   *Not legal advice: most solo hobbyist devs ship as individuals and restructure later if revenue
   justifies it; if you want an LLC instead, form it BEFORE this signup, because the bank account
   and legal identity must match the entity.* If in doubt, this can be a 5-minute question to an
   accountant — but do not let it stall the ticket for weeks.
2. **Bank details** — routing number, account number, bank address. **The account holder name must
   match your legal identification** (Valve checks this).
3. A **Steam account** (your normal one works; it becomes the partner-account login), its password,
   and Steam Guard access.
4. **$100** on a Steam-supported payment method.
5. Legal name + address as they appear on your ID.

## The steps (Valve's flow, in order)

1. Go to https://partner.steamgames.com/steamdirect → start the sign-up.
2. **Sign the Steamworks Subscriber Agreement** (digital paperwork — legal name, address). Minutes.
3. **Pay the $100 app fee.** Non-refundable; recouped in the payment after the game reaches
   $1,000 adjusted gross revenue. Only partner-account Admins can pay. **This starts the 30-day
   release clock — pay it now even though launch is far away.**
4. **Bank + tax + identity verification.** W-9 interview, bank fields above, ID confirmation.
   Takes DAYS on Valve's side — this is the step you cannot compress, which is why it happens
   months before anything needs it.
5. Once verified: **create the app** in Steamworks. Note the **App ID** — record it in ticket 41's
   Resolution. (App ID is public; the **secret keys are not — never commit them**, and nothing
   with `steam_appid` secrets goes in the repo.)
6. Store page (ticket 45), build upload via SteamPipe (ticket 43), and their reviews (1–5 business
   days each) come later — nothing else is needed tonight.

## Done when (ticket 41's bar)

Partner account verified, App ID recorded in the ticket Resolution, store-page draft unblocked.

## Facts snapshot (2026-08-30, from partner.steamgames.com)

$100/product, recoup at $1,000 AGR · 30-day fee-to-release wait · Coming Soon public ≥2 weeks ·
build + page review 1–5 days · W-9 (US individual) / W-8BEN (non-US) · bank name must match legal ID.
