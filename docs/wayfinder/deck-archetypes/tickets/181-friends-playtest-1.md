# Ticket 181: Friends and family playtest 1 — prep and release (SOP)

**Type:** release procedure, plus two small build changes. **Status:** OPEN. **Owner:** Henry. The agent builds only the two code rows (181a, 181b), once Henry rules on the decisions below.

**Henry (2026-10-01):**

> *"I'm going to give it to them via the GitHub pages so they can access it on their web browser and I would also like to add them all to my discord which I just started so they can give feedback. Not ready for public feedback yet."*

**Goal:** 5–8 trusted people (family, cousins, friends) play the current build in a browser over about two weeks, and report bugs and impressions through a private Discord. Henry ends with:

- a list of bugs
- answers to a short survey
- exported run logs that Claude can analyse like Henry's own playtests

**This is not a public test.** Section 1, D1 covers what "not public" can and can't mean with GitHub Pages.

---

## 0. What you need to know first

These are the facts checked in the repo on 2026-10-01.

- **GitHub Pages already works.**
  - `.github/workflows/deploy.yml` builds and publishes **every push to `main`** to `https://hdunphy.github.io/Mingming/`.
  - It runs the full CI gate first: typecheck, tests, lint, and the build with the debug-toolkit check.
  - So today, **merging to `main` *is* releasing**, and every later merge silently changes what your testers are playing.
- **The repository is public.** Anyone can see the source, the tickets and the docs, and a GitHub Pages site is public to anyone who has (or finds) its URL. GitHub Pages has no password or invite-only option on a free personal account.
- **Saves live in the browser.**
  - The web build keeps saves in the browser's own storage.
  - A tester loses their progress if they clear browsing data, use a private window, or switch browser or computer.
  - A build that changes the save format discards in-progress runs (for example ticket 176, M5).
- **Run logs can already be exported.** Settings → **Export run log** downloads a `mingming-run-log-<date>.json` file in the browser. Testers can drop that file in Discord.
- **The version label is hard-coded.** The main menu says `ALPHA v0.3.5 | ROGUELIKE LOOP SYSTEM` (`MainMenuView.tsx`). It never changes, so it can't tell you which build a bug report came from (181a fixes this).
- **Monster art is off.** `MONSTER_ART_ENABLED = false` (`monsterArtPolicy.ts`), so no AI-generated monster art is drawn; placeholders are shown instead.
- **`main` is behind.** `playtest-polish` is 303 commits ahead of `main` and 0 behind (a clean merge), and has 96 unpushed commits.

---

## 1. Decisions to make before release

Each decision has a recommended default. Mark each one **yes** or write your choice.

| # | Decision | Recommended default | Your call |
|---|---|---|---|
| D1 | **Privacy of the game link.** Pages can't be password-protected. Options: (a) Pages, and simply don't post the link anywhere public ("unlisted", not private); (b) an itch.io page set to *restricted* with a password, which hosts browser games free and is private; (c) a private repo (needs a paid GitHub plan, and the Pages site is still public anyway). | **(a) Pages, unlisted**, as you asked, plus a "please don't share the link" line in the invite. Move to (b) if you ever need real privacy. | |
| D2 | **What triggers a deploy.** Today every push to `main` redeploys. | **181b:** deploy only from a branch named `playtest`. `main` keeps running CI but no longer publishes, so testers only see a new build when you push to `playtest` on purpose. | |
| D3 | **What's in the build.** | Today's `playtest-polish` (171–174 built) **plus ticket 179** (one card pick per fight). Not 175 (localization) or 176 (map and towns). | |
| D4 | **First-run experience.** Ship as is, or do the Tier 0 cut list first (hide macros, firmware, patches etc. until first use; one sentence of copy per screen)? | **Ship as is.** What confuses new players *is* the test of the cut list. Ask about it directly in the survey (§4.4). | |
| D5 | **Testers.** | **5–8 people.** Mix in some deckbuilder players (Slay the Spire), some Pokémon fans, and one or two who play neither. Include your brother and the two who haven't played yet. | |
| D6 | **Test window.** | **2 weeks**, asking for **at least 2 full runs** each. | |
| D7 | **Builds during the test.** | **At most one hotfix**, for blockers only (crashes, soft-locks, lost saves), and **no balance changes mid-test**, so everyone's feedback is about the same game. | |
| D8 | **Where feedback goes.** | **Discord:** a forum channel for bugs and a channel for run logs. **One short Google Form** after each run, for answers you can tally. | |
| D9 | **Run logs.** | Ask everyone to export the run log after **each** run and post it in `#run-logs`. | |
| D10 | **Confidentiality.** | A plain request ("please don't share the link or post screenshots publicly yet"), not an NDA. | |
| D11 | **Supported setup.** | Desktop or laptop browser (Chrome, Edge or Firefox), window at least 1280×800. **Phones and tablets not supported**; say so up front. | |
| D12 | **Build label.** | **181a:** the main menu and Settings show `PLAYTEST 1 · <commit>` (the short git hash at build time), so every bug report names the build. | |

---

## 2. Build changes (agent rows)

Usual rules: test first, see it fail on the parent, `npm run gate` green, commits authored as Henry with no `Co-Authored-By`, last line `HANDOFF: …`, and **do not push.**

| Row | What |
|---|---|
| 181a | A build label from the commit |
| 181b | Publish to Pages only from the `playtest` branch |

### 181a: A build label from the commit

1. `vite.config.ts`: `define` two constants at build time:
   - `__BUILD_LABEL__`: from the env var `VITE_BUILD_LABEL`, defaulting to `dev`
   - `__BUILD_COMMIT__`: `git rev-parse --short HEAD`, or `unknown` if git isn't available
2. Replace the hard-coded `ALPHA v0.3.5` in `MainMenuView.tsx` with `{label} · {commit}`, e.g. `PLAYTEST 1 · 5557bbb`. Keep the rest of the line's styling.
3. Show the same text at the bottom of `SettingsScreen.tsx`, next to **Export run log**.
4. **Write the label into exported run logs** as `build: { label, commit }`, so every log names its build.
5. **Tests:**
   - the menu renders the injected label
   - an exported log carries `build`
   - with no env var the label reads `dev`

### 181b: Publish to Pages only from the `playtest` branch

1. `.github/workflows/deploy.yml`: change the trigger from `branches: [ main ]` to `branches: [ playtest ]`, and set `VITE_BUILD_LABEL` for the build step from a repository variable (`vars.PLAYTEST_LABEL`, default `PLAYTEST`).
2. `.github/workflows/ci.yml`: it currently skips `main` (`branches-ignore: [ main ]`) because deploy used to call it. Remove `main` from `branches-ignore`, so `main` still gets the full gate on every push, and add `playtest` there instead (deploy calls CI for it).
3. Update the comments in both files to say why: *"Ticket 181: testers only get a new build when Henry pushes to `playtest` on purpose."*
4. **No test is possible for workflow files.** Instead, the commit message lists the exact `on:` blocks before and after.

---

## 3. Release procedure (Henry)

Do these in order and tick them off. Rough times are in brackets.

### Phase 1: Freeze the build (about 1–2 hours, mostly your own run)

- [ ] **1.1** Rule on D1–D12 above.
- [ ] **1.2** The agent builds **179**, **181a** and **181b**. Check the reports.
- [ ] **1.3** Play **one full run yourself** on the build (the 174 check from `playtest-results/2026-10-01/playtest-strategy.md`). Anything that blocks a run gets fixed before you continue.
- [ ] **1.4** Run `npm run release-check`. It must be green: all gates, no debug toolkit in the build, plus the asset weight.
- [ ] **1.5** Check that no AI-generated image ships. Search the built `dist/` for the species art files and confirm none are referenced. Monster art is switched off, but files can still be bundled.
- [ ] **1.6** Push the work branch: `git push origin playtest-polish`.
- [ ] **1.7** Merge `playtest-polish` into `main` through a pull request (CI runs on it).
- [ ] **1.8** Tag the release commit: `git tag playtest-1 && git push origin playtest-1`.
- [ ] **1.9** In GitHub → Settings → Secrets and variables → Actions → Variables, set `PLAYTEST_LABEL` to `PLAYTEST 1`, so the first deploy carries the label.
- [ ] **1.10** Create the release branch from the tag and push it. **This publishes the build:** `git branch playtest playtest-1 && git push origin playtest`.

### Phase 2: Check the live site (about 45 minutes)

- [ ] **2.1** The deploy finished: GitHub → Actions → "Deploy to GitHub Pages" is green.
- [ ] **2.2** Open `https://hdunphy.github.io/Mingming/` in a **private window** (a fresh browser, like a tester's). The main menu shows `PLAYTEST 1 · <commit>`.
- [ ] **2.3** In that window, play: pick a starter, assembly, choose a gym, the map, the first fight, rewards, a shop visit, and one more fight.
- [ ] **2.4** **Reload the page mid-run.** The run resumes where you were.
- [ ] **2.5** Settings → **Export run log**. A `.json` file downloads, and it contains `build`.
- [ ] **2.6** Open the browser console (F12). There should be no red errors during 2.3–2.5.
- [ ] **2.7** Repeat 2.2–2.3 quickly in a **second browser** (Edge if you used Chrome, or Firefox).
- [ ] **2.8** Try a **1280×800 window**: nothing important is cut off.
- [ ] **2.9** Note the time from opening the link to the main menu on a normal connection. Over about 10 seconds, mention it in the invite.

### Phase 3: Set up the Discord (about 1 hour)

- [ ] **3.1** Server settings:
  - **not** a Community server
  - verification level **Low**
  - **turn off** "@everyone can create invites"
  - in the default @everyone role, turn off **Mention @everyone** and **Manage** permissions
- [ ] **3.2** **Roles:**
  - `Dev` (you): all permissions
  - `Playtester`: given to everyone you invite, allowed to post in the feedback channels
- [ ] **3.3** **Channels** (create a category **MINGMING PLAYTEST** for them):

  | Channel | Type | Who can post | Purpose |
  |---|---|---|---|
  | `#welcome` | text | Dev only | rules and the game link (§4.2) |
  | `#announcements` | text | Dev only | new builds, reminders |
  | `#how-to-play` | text | Dev only | the quick start (§4.3) |
  | `#known-issues` | text | Dev only | what's already known or changing (§4.5) |
  | `#bug-reports` | **forum** | Playtester | one post per bug, using the template (§4.6) |
  | `#run-logs` | text | Playtester | drop exported `.json` run logs, one message per run |
  | `#feedback` | text | Playtester | impressions, ideas, "this felt amazing / awful" |
  | `#general` | text | Playtester | chat |

- [ ] **3.4** In `#bug-reports`, add **tags**: `crash`, `stuck`, `card text wrong`, `UI`, `balance`, `other`. Set the **post guidelines** to the template in §4.6.
- [ ] **3.5** Post and pin §4.2 in `#welcome`, §4.3 in `#how-to-play` and §4.5 in `#known-issues`.
- [ ] **3.6** Create the **Google Form** from §4.4 (responses to a Google Sheet) and put its link in `#welcome` and `#how-to-play`.
- [ ] **3.7** Create **one invite link** from `#welcome`: expires after **7 days**, max uses **testers + 2**. Don't post it anywhere public.
- [ ] **3.8** *(Optional)* A Discord webhook in `#announcements` that the deploy workflow calls, to post "New build: PLAYTEST N · commit" automatically. Not needed for round 1; announce by hand.

### Phase 4: Launch (about 30 minutes)

- [ ] **4.1** Send each tester the invite message (§4.1) personally: text or DM.
- [ ] **4.2** As each joins, give them the `Playtester` role.
- [ ] **4.3** Post a kick-off in `#announcements`: the test is open, the dates, "two runs each, form after each run, logs in #run-logs".
- [ ] **4.4** Write the tester list and start date in `playtest-results/friends-1/README.md` (create the folder).

### Phase 5: During the test (about 10 minutes a day)

- [ ] **5.1** **Daily triage** of `#bug-reports`:
  - reply to each new post (even just "got it")
  - add the `confirmed` or `need info` tag
  - move confirmed bugs to a ticket list in `playtest-results/friends-1/bugs.md`
- [ ] **5.2** Save run logs from `#run-logs` into `playtest-results/friends-1/logs/<tester>/` (download each file). Use first names or nicknames only.
- [ ] **5.3** **Hotfix rule (D7):** blockers only. Fix on a branch, merge to `main`, then push `playtest` to the fix (`git push origin <fix>:playtest`). Bump `PLAYTEST_LABEL` to `PLAYTEST 1.1` first, and announce it.
- [ ] **5.4** Mid-test nudge (around day 7) in `#announcements` for anyone who hasn't played or filled in the form.
- [ ] **5.5** Bring Claude the logs and form answers whenever there's a batch. Ask for the same write-up as your own playtests: the scrap curve and fight table from the logs, plus a summary of the survey answers and bug list.

### Phase 6: Close (about 1 hour)

- [ ] **6.1** Post a thank-you and say what happens next.
- [ ] **6.2** Export the form responses to `playtest-results/friends-1/survey.csv`.
- [ ] **6.3** Ask Claude for the round summary, `playtest-results/friends-1/summary.md`:
  - top bugs
  - what confused people on the first screens (D4)
  - which Mingmings and cards felt strong or weak
  - would they play again
  - what to change before round 2
- [ ] **6.4** Decide round 2's scope (likely after 176 and the UI rework) and whether it moves to Steam Playtest or a password-protected itch.io page.

---

## 4. Copy and templates

Edit to your own voice; these are drafts.

### 4.1 Invite message (personal text or DM)

> Hey! I've been building a game called **Mingming: Midgard Circuit**: a roguelike deckbuilder where you collect Norse-inspired robot monsters and build a deck around your team. It's early and the art is placeholder, but it's playable, and I'd love your honest feedback before anyone else sees it.
>
> It runs in your web browser on a computer (not phone): [game link]
> Feedback happens on my Discord: [invite link] (expires in a week)
>
> If you can, play **two full runs** over the next two weeks and fill in the short form after each one (link in Discord). Please don't share the link or post screenshots publicly yet. Thank you!

### 4.2 `#welcome` (pinned)

> **Welcome to the Mingming playtest!** Thanks for helping.
>
> **Play:** [game link] (desktop browser, Chrome/Edge/Firefox, window at least 1280×800)
> **After each run:** fill in the form: [form link] (2 minutes)
> **Also after each run:** Settings → **Export run log**, then drop the file in #run-logs
> **Bugs:** one post each in #bug-reports (there's a template)
> **Anything else:** #feedback
>
> Your save lives in your browser, so don't clear browsing data or use a private window, or you'll lose progress.
> This is private for now: please don't share the link or screenshots publicly.

### 4.3 `#how-to-play` (pinned)

Keep this short; part of the test is whether the game explains itself.

> - You start with one Mingming and its cards. Win fights to earn **scrap**, **cards** and **blueprints** (new Mingmings).
> - Each card costs **energy**. Elements beat elements (**Fire > Nature > Water > Fire**).
> - Walk the map through three areas to the **gym**: three fights in a row with no full heal between them.
> - Spend scrap at the **market** (cards, macros) and the **workshop** (build new Mingmings, upgrade cards).
> - Losing ends the run. That's normal; it's a roguelike.

### 4.4 Google Form (after each run)

1. Your name (first name is fine)
2. Which run is this? (1st / 2nd / 3rd+)
3. Which starter did you pick, and how far did you get? (died in area 1 / 2 / 3 / at the gym / beat the gym)
4. **What confused you, especially on the first screens?** (long answer)
5. Best moment of the run? (short answer)
6. Worst or most frustrating moment? (short answer)
7. Any Mingming or card that felt **too strong** or **too weak**? Why? (long answer)
8. How long did the run take? (under 20 min / 20–40 / 40–60 / over 60)
9. How much do you want to play another run? (1–5 scale)
10. Anything that looked broken? (or post it in #bug-reports)

### 4.5 `#known-issues` (pinned)

> Already known, no need to report:
> - The art is placeholder, including the monster pictures (real art is being commissioned).
> - The **map** and the **shop/workshop screens** are being redesigned.
> - The overall visual style (colours, fonts) is getting a full rework.
> - Phones and tablets aren't supported yet.
>
> Still worth reporting about these: anything that's **broken**, **confusing**, or that makes you stop playing.

### 4.6 `#bug-reports` post guidelines (template)

> **Title:** short description (e.g. "Ink Stream did no damage")
> **What happened:**
> **What you expected:**
> **Steps** (what you clicked just before):
> **Build:** the text at the bottom of the main menu (e.g. PLAYTEST 1 · 5557bbb)
> **Browser:** Chrome / Edge / Firefox / other
> **Screenshot or run log** if you can (Settings → Export run log)

---

## Done when

- D1–D12 are ruled, and 179, 181a and 181b are built.
- `playtest` deploys `PLAYTEST 1 · <commit>` to Pages, and it passed the §3 Phase 2 checks.
- The Discord is set up as in Phase 3, testers are invited, and the form is live.
- At the end, `playtest-results/friends-1/` holds the bugs, the logs, the survey and the summary.
