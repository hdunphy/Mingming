# Ticket 181: Playtest round 2 (friends and family) — prep and release (SOP)

**Type:** release procedure, plus three small build changes. **Status:** OPEN, **waiting on ticket 182** (the text cut, hide-when-empty and the intro run) **and ticket 183** (the art direction and UI rework). Henry, 2026-10-02: *"The playtest can wait on 182"*, and the UI is reworked before the playtest. Release nothing until both are built. 179, 181a and 181b are built (181b was amended, see its row); 181c waits on the form. **Owner:** Henry. The agent builds only the code rows (181a, 181b, 181c), once Henry rules on the decisions below.

**Round 1** was Henry's brother. **Round 2** is this one.

**Henry (2026-10-01):**

> *"I'm going to give it to them via the GitHub pages so they can access it on their web browser and I would also like to add them all to my discord which I just started so they can give feedback. Not ready for public feedback yet."*

**Henry's brainstorm notes (2026-10-01, handwritten):**

- *"Send individual message for better responses."* A personal message to each person, not one group message.
- About **13 people**: friends and cousins (and Dad). Only **3–4 of the 13 play this genre**, so *"it's a favor to me to playtest"*, and *"I want the playtesting to be as frictionless as possible."*
- *"The game currently looks like a generic Claude web app and is AI sloppy because of all the heavy text. I don't want a bad 1st impression."*
- *"I'm going away from the futuristic robot theme and try to lean into the Pokémon nostalgic feeling w/o crossing the 'clone' line. I think I want it to be **Slay the Spire dressed as Pokémon**."*
- On Discord: post a **vision**, **gameplay rules**, **how to get started**, a **roadmap**, maybe a **bestiary / Pokédex**, and a survey *"or make it part of the game"*.
- *"See if I can go through the cut list of text before playtesting."*
- A **video devlog** would excite people more, but *"I want the UI rework before video; don't want to be labeled AI slop."*

**Goal:** about 13 people (friends, cousins, family) play the current build in a browser over about two weeks, and report bugs and impressions through a private Discord. Most of them are new to deckbuilders, so the round is built around **one easy run each**, with more welcome. Henry ends with:

- a list of bugs
- answers to a short survey
- exported run logs (optional for testers) that Claude can analyse like Henry's own playtests

**This is the last browser-based round.** Later rounds move to a desktop build (Steam Playtest or similar). Henry's rule for this round: **the least friction for testers** (a link to play and Discord to talk), so every ask of testers is kept as small as possible.

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
| D2 | **What triggers a deploy.** Every push to `main` redeploys. | **Keep it** (Henry, 2026-10-01: deploy from `main`, no separate release branch). So merging to `main` *is* releasing. Merge the round's build when you're ready, and **during the test merge nothing to `main` except a blocker hotfix**; keep other work on branches until the round closes. | |
| D3 | **What's in the build.** | Today's `playtest-polish` (171–174 built) **plus ticket 179** (one card pick per fight). Not 175 (localization) or 176 (map and towns). | |
| D4 | **First-run experience.** The Tier 0 cut list (the Claude project doc "Tier 0 cut list + UI direction") has three layers: (1) **cut the text**: one sentence of copy per screen, tips as short toasts instead of "Got it / Skip tips" panels; (2) **hide systems until first use** (macros, firmware, patches, tiers); (3) **the new visual style**. | **Do layer 1 before release (ticket 182, to be written from the cut list).** It's mostly copy, it's what makes the game read as "AI slop", and 9 of 13 testers are new to the genre. Layer 2 only if 182 comes in quick. **Layer 3 waits for the UI rework.** | **Ruled 2026-10-02: all three layers before release.** Ticket 182 does layers 1 and 2 (the text cut, and hide-when-empty), plus a short **intro run** for new saves, with two switches, "Skip intro" and "Show advanced content". **Layer 3 is ticket 183** (the UI rework), and the playtest waits for it too. |
| D5 | **Testers.** | **Henry's list of about 13** (friends, cousins, Dad). A **personal message to each** (§4.1, two versions). **Keep the names out of this repo:** it's public, so the list lives in your own notes, and logs and reports use first initials. Expect about half to play; that's normal for a favour. | |
| D6 | **Test window and the ask.** | **2 weeks.** The ask is **one run (about 30–45 minutes)**; a second is welcome. *(Since 182: a new save starts with the intro run, about 15–20 minutes. So the ask becomes "the intro, then one full run if you enjoyed it", see §4.1.)* The 3–4 deckbuilder players are asked for **two or more**, because their balance feedback is the part the others can't give. | **Confirmed 2026-10-02:** the intro, then one full run if they enjoyed it. |
| D7 | **Builds during the test.** | **At most one hotfix**, for blockers only (crashes, soft-locks, lost saves), and **no balance changes mid-test**, so everyone's feedback is about the same game. Because `main` publishes (D2), the hotfix is the only thing merged to `main` while the test runs. | |
| D8 | **Where feedback goes.** | **The form is part of the game (181c):** when a run ends, the run summary shows **"Tell Henry how it went"**, which opens the short Google Form with the build, starter and how far they got already filled in. Settings has the same button. **Discord** is for bugs, chat and anything longer. One form per run is fine now, because it's one click from the game, not something to remember. | |
| D9 | **Run logs.** | **Optional.** "If you can, export the run log after a run and drop it in `#run-logs`; it helps a lot." Never required. | |
| D10 | **Confidentiality.** | A plain request ("please don't share the link or post screenshots publicly yet"), not an NDA. | |
| D11 | **Supported setup.** | Desktop or laptop browser (Chrome, Edge or Firefox), window at least 1280×800. **Phones and tablets not supported**; say so up front. | |
| D12 | **Build label.** | **181a:** the main menu and Settings show `PLAYTEST 2 · <commit>` (the short git hash at build time), so every bug report names the build. The label is a literal in `deploy.yml`, so **nothing has to be set in GitHub**; bump it in the commit that ships a hotfix. | |
| D13 | **What goes in the Discord.** | Keep it short, since most testers won't read much: **welcome + how to start** (§4.2), a **3-line vision** (§4.7), **gameplay basics** (§4.3), and a **5-line roadmap** without dates (§4.8). **Bestiary / Pokédex: not this round.** The art is placeholder and the theme is moving, so it would need rewriting; point to the in-game **Codex** instead. | |
| D14 | **Video devlog.** | **Not part of this round.** As you said: after the UI rework, as the first piece of public marketing (Steam wishlists). Friends and family come in through your personal message, not a video. | |
| D15 | **Theme words this round.** | **Changed by Henry, 2026-10-02: rename the on-screen words in ticket 183 (row 183h, decision D1), before this release,** since the playtest now waits on the UI rework anyway. Testers learn one vocabulary. Code names, data ids and saves keep the old words. *(Was: don't rename anything for this round.)* The vision post (§4.7) sells the new direction ("Slay the Spire dressed as Pokémon", Norse monsters) and not robots, so testers aren't told one thing now and another later. | |

---

## 2. Build changes (agent rows)

Usual rules: test first, see it fail on the parent, `npm run gate` green, commits authored as Henry with no `Co-Authored-By`, last line `HANDOFF: …`, and **do not push.**

| Row | What |
|---|---|
| 181a | A build label from the commit |
| 181b | The build label comes from the deploy workflow (amended: deploy stays on `main`) |
| 181c | "Tell Henry how it went": the feedback form, one click from the end of a run |

### 181a: A build label from the commit

1. `vite.config.ts`: `define` two constants at build time:
   - `__BUILD_LABEL__`: from the env var `VITE_BUILD_LABEL`, defaulting to `dev`
   - `__BUILD_COMMIT__`: `git rev-parse --short HEAD`, or `unknown` if git isn't available
2. Replace the hard-coded `ALPHA v0.3.5` in `MainMenuView.tsx` with `{label} · {commit}`, e.g. `PLAYTEST 2 · 5557bbb`. Keep the rest of the line's styling.
3. Show the same text at the bottom of `SettingsScreen.tsx`, next to **Export run log**.
4. **Write the label into exported run logs** as `build: { label, commit }`, so every log names its build.
5. **Tests:**
   - the menu renders the injected label
   - an exported log carries `build`
   - with no env var the label reads `dev`

### 181b: The build label comes from the deploy workflow (amended: deploy stays on `main`)

**Built twice.** 181b first moved the deploy to a `playtest` branch (commit 491d7cb). On 2026-10-01 Henry switched it back to `main` and asked for the label to set itself with no GitHub setting (commit a009ceb). That is the version that stands:

1. `.github/workflows/deploy.yml`: the trigger is `branches: [ main ]`, as it always was. The build step sets `VITE_BUILD_LABEL: ${{ vars.PLAYTEST_LABEL || 'PLAYTEST 2' }}`. The literal `PLAYTEST 2` is the label; to change it (a hotfix, round 3), edit it in the commit that ships the build. A repository variable `PLAYTEST_LABEL` would override it, but nothing needs to be set.
2. `.github/workflows/ci.yml`: unchanged from before 181 (`branches-ignore: [ main ]`, because deploy calls it for `main`).
3. **No test is possible for workflow files.** Both files parse as YAML and the `on:` blocks are the pre-181 ones.

**Cost of staying on `main`:** every merge to `main` changes what testers play. That is why D2 and D7 say to merge nothing else to `main` while the test runs.

### 181c: "Tell Henry how it went", one click from the end of a run

1. **Henry makes the form first** (§4.4) and uses Google Forms' **Get pre-filled link** to find the field ids for: build, starter, how far, and run number.
2. **`src/ui/feedback/feedbackLink.ts`** (new, small): `feedbackUrl(run | null): string | null` builds the form URL from `import.meta.env.VITE_FEEDBACK_FORM_URL`. The env var is a template with `{build}`, `{starter}`, `{reached}` and `{run}` placeholders. Each value is URL-encoded:
   - `{build}`: 181a's label and commit
   - `{starter}`: the starter's species name
   - `{reached}`: "area 1 / 2 / 3 / gym / beat the gym", from the ended run
   - `{run}`: the ranch's completed-run count
   - **For the intro run (182c):** `{reached}` is "intro (won)" or "intro (lost)", and `{run}` is "intro" (the intro does not count as a completed run)
   It returns `null` when the env var isn't set, and **the buttons then don't render** (local and dev builds show nothing).
3. **Run summary** (`RunSummary.tsx`): a button **"Tell Henry how it went"** next to the existing leave button. It opens the URL in a new tab (`window.open(url, '_blank', 'noopener')`). It's the most prominent thing after the result, but it never blocks leaving.
4. **Settings** (`SettingsScreen.tsx`): the same button, without run details (build only), beside **Export run log**.
5. **Deploy** (the same step that sets the label): pass `VITE_FEEDBACK_FORM_URL` as a literal in `deploy.yml`, with `vars.FEEDBACK_FORM_URL` as an optional override, the same pattern as the label. Henry pastes the form link template into that line; nothing needs setting in GitHub. (The link ends up in the public bundle either way, so a variable would not keep it private.)
6. **Tests:**
   - the URL fills each placeholder, encoded
   - no env var: no button on either screen
   - the run summary shows the button for both a win and a loss

---

## 3. Release procedure (Henry)

Do these in order and tick them off. Rough times are in brackets.

### Phase 1: Freeze the build (about 1–2 hours, mostly your own run)

- [ ] **1.1** Rule on D1–D15 above.
- [ ] **1.0** **Wait for tickets 182 and 183 to be built.** 182 is written and ruled (2026-10-02). 183 is still a placeholder: the art direction and UI kit get chosen first, then built.
- [x] **1.2** Claude wrote **ticket 182** (the text cut, hide-when-empty, the intro run, the two switches) and you ruled on it (2026-10-02).
- [ ] **1.3a** Make the **Google Form** (§4.4) and its pre-filled link. Paste the link template (from 181c) into the `VITE_FEEDBACK_FORM_URL` line of `.github/workflows/deploy.yml`. The label there already says `PLAYTEST 2`. **Nothing to set in GitHub.**
- [ ] **1.3b** **179, 181a and 181b are built** (reports: `docs/balance/card-picks-179.md` and the commit messages). The agent still builds **181c** (once the form exists), **182** and **183**. Check the reports, including `docs/balance/intro-run-182.md` (the intro's win rate and estimated length).
- [ ] **1.3c** On a **new save slot**, play **the intro** and **time it** (target 15–20 minutes; 182c only estimates it). Then play **one full run yourself** on the build (the 174 check from `playtest-results/2026-10-01/playtest-strategy.md`). Anything that blocks a run gets fixed before you continue.
- [ ] **1.4** Run `npm run release-check`. It must be green: all gates, no debug toolkit in the build, plus the asset weight.
- [ ] **1.5** Check that no AI-generated image ships. Search the built `dist/` for the species art files and confirm none are referenced. Monster art is switched off, but files can still be bundled.
- [ ] **1.6** Push the work branch: `git push origin playtest-polish`.
- [ ] **1.7** Open a pull request `playtest-polish` into `main` (CI runs on it). **Before you merge,** check that `.github/workflows/deploy.yml` says `PLAYTEST 2` and, once 181c is built, carries the form link. Steps 1.3c to 1.5 must be done: the merge publishes.
- [ ] **1.8** **Merge the pull request. This publishes the build:** the deploy runs on every push to `main`, after the full CI gate.
- [ ] **1.9** Tag the release commit, so you can always find what testers played: `git checkout main && git pull && git tag playtest-2 && git push origin playtest-2`.

### Phase 2: Check the live site (about 45 minutes)

- [ ] **2.1** The deploy finished (it started when you merged): GitHub → Actions → "Deploy to GitHub Pages" is green.
- [ ] **2.2** Open `https://hdunphy.github.io/Mingming/` in a **private window** (a fresh browser, like a tester's). The main menu shows `PLAYTEST 2 · <commit>`.
- [ ] **2.3** In that window, play: pick a starter (both switches off), **the intro run to the end**, then back at the ranch choose a gym, the map, the first fight, rewards, a shop visit, and one more fight.
- [ ] **2.3b** In a second private window, pick a starter with **Skip intro** on: it goes straight to the ranch. Turn **Show advanced content** on in Settings: the empty macro slots and other hidden panels appear.
- [ ] **2.4** **Reload the page mid-run.** The run resumes where you were.
- [ ] **2.5** Settings → **Export run log**. A `.json` file downloads, and it contains `build`.
- [ ] **2.5b** Lose or abandon a run. On the run summary, **"Tell Henry how it went"** opens the form with build, starter and how far already filled in. Submit a test answer, then delete it from the responses.
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
- [ ] **3.5** Post and pin: §4.2 and §4.7 (vision) in `#welcome`, §4.3 in `#how-to-play`, §4.8 (roadmap) in `#announcements`, and §4.5 in `#known-issues`. **No bestiary this round (D13);** the in-game Codex covers it.
- [ ] **3.6** Put the plain form link (not pre-filled) in `#welcome`, for anyone who'd rather not use the in-game button.
- [ ] **3.7** Create **one invite link** from `#welcome`: expires after **7 days**, max uses **testers + 2**. Don't post it anywhere public.
- [ ] **3.8** *(Optional)* A Discord webhook in `#announcements` that the deploy workflow calls, to post "New build: PLAYTEST N · commit" automatically. Not needed this round; announce by hand.

### Phase 4: Launch (about 30 minutes)

- [ ] **4.1** Send each tester a **personal** message (§4.1): version A for most people, version B for the 3–4 deckbuilder players. Add one line that's just for them. Personal messages get far more replies than a group message.
- [ ] **4.2** As each joins, give them the `Playtester` role.
- [ ] **4.3** Post a kick-off in `#announcements`: the test is open, the dates, "one run is all I'm asking, more is a bonus; the game asks for feedback when a run ends; run logs welcome in #run-logs".
- [ ] **4.4** Write the start date and the **number** of testers in `playtest-results/round-2-friends/README.md` (create the folder). Keep names out of the repo (it's public): use first initials.

### Phase 5: During the test (about 10 minutes a day)

- [ ] **5.0** **Merge nothing to `main` except a blocker hotfix until the round closes** (D2, D7): every merge to `main` publishes.
- [ ] **5.1** **Daily triage** of `#bug-reports`:
  - reply to each new post (even just "got it")
  - add the `confirmed` or `need info` tag
  - move confirmed bugs to a ticket list in `playtest-results/round-2-friends/bugs.md`
- [ ] **5.2** Save run logs from `#run-logs` into `playtest-results/round-2-friends/logs/<initial>/` (download each file).
- [ ] **5.3** **Hotfix rule (D7):** blockers only. Fix on a branch, and in the same commit bump the label in `deploy.yml` to `PLAYTEST 2.1`. Merge to `main` (that publishes it), then announce it.
- [ ] **5.4** Mid-test nudge (around day 7): a short **personal** follow-up to anyone who hasn't played yet. No pressure; it's a favour.
- [ ] **5.5** Bring Claude the logs and form answers whenever there's a batch. Ask for the same write-up as your own playtests: the scrap curve and fight table from the logs, plus a summary of the survey answers and bug list.

### Phase 6: Close (about 1 hour)

- [ ] **6.1** Post a thank-you and say what happens next.
- [ ] **6.2** Export the form responses to `playtest-results/round-2-friends/survey.csv`.
- [ ] **6.3** Ask Claude for the round summary, `playtest-results/round-2-friends/summary.md`:
  - top bugs
  - what confused people on the first screens (D4)
  - which Mingmings and cards felt strong or weak
  - would they play again
  - what to change before round 3
  - deckbuilder players and new players reported separately
- [ ] **6.4** Decide round 3's scope (likely after 176, on a desktop build through Steam Playtest), whether the intro stays, is scrapped, or becomes the demo (182, R10), and the devlog video's timing (D14).

---

## 4. Copy and templates

Edit to your own voice; these are drafts.

### 4.1 Invite message (personal, one person at a time)

Write a line of your own at the top for each person; that's what gets the reply.

**Version A (most people, new to this kind of game):**

> Hey [name]! Favour to ask. I've been making a video game in my spare time, **Mingming: Midgard Circuit**. You collect monsters from Norse myth and battle with a deck of cards (think Pokémon, but the moves are cards). It's early, but it's playable.
>
> Would you play **the intro** (about 15–20 minutes), and **one full run** after it if you enjoy it, in the next two weeks? It runs in a web browser on a computer, not a phone: [game link]
> When the run ends, the game has a button to tell me how it went. That's all I need.
> If you want to chat or report anything weird, here's my Discord: [invite link]
>
> Please don't share the link yet. Thank you, it really helps!

**Version B (the 3–4 deckbuilder players):**

> Hey [name]! I've been building a roguelike deckbuilder: **Slay the Spire dressed as Pokémon**, with Norse-myth monsters you recruit into a three-monster team that shares one deck. It's early (the monster art is placeholder), but the systems are all in, and I'd love feedback from someone who knows the genre.
>
> If you can, play **two or three runs** over the next two weeks: [game link] (desktop browser)
> The game asks for quick feedback when a run ends, and the Discord has a bug forum: [invite link]. Balance opinions are gold: which monsters and cards felt broken or useless, and why.
>
> Please don't share the link yet. Thanks!

### 4.2 `#welcome` (pinned)

> **Welcome to the Mingming playtest!** Thanks for helping.
>
> **Play:** [game link] (desktop browser, Chrome/Edge/Firefox, window at least 1280×800)
> **When a run ends:** press **"Tell Henry how it went"** on the summary screen (about 3 minutes). Or use this link: [form link]
> **One run is all I'm asking.** More is a bonus.
> **Optional, but it helps a lot:** after a run, Settings → **Export run log**, then drop the file in #run-logs
> **Bugs:** one post each in #bug-reports (there's a template)
> **Anything else:** #feedback
>
> Your save lives in your browser, so don't clear browsing data or use a private window, or you'll lose progress.
> This is private for now: please don't share the link or screenshots publicly.

### 4.3 `#how-to-play` (pinned)

Keep this short; part of the test is whether the game explains itself.

> - Your first run is a **short intro** (about 15–20 minutes). After that, the full game opens.
> - You start with one Mingming and its cards. Win fights to earn **scrap**, **cards** and **blueprints** (new Mingmings).
> - Each card costs **energy**. Elements beat elements (**Fire > Nature > Water > Fire**).
> - Walk the map through three areas to the **gym**: three fights in a row with no full heal between them.
> - Spend scrap at the **market** (cards, macros) and the **workshop** (build new Mingmings, upgrade cards).
> - Losing ends the run. That's normal; it's a roguelike.

### 4.4 Google Form (opened from the end of a run; build, starter, how far and run number come pre-filled)

1. Your name (first name is fine)
2. **Build** (pre-filled) · **Starter** (pre-filled) · **How far** (pre-filled: area 1 / 2 / 3 / gym / beat the gym) · **Run number** (pre-filled)
3. Have you played games like Slay the Spire before? (yes / a little / no)
4. **What confused you, especially on the first screens?** (long answer)
5. Best moment? (short answer)
6. Worst or most frustrating moment? (short answer)
7. Any Mingming or card that felt **too strong** or **too weak**? Why? (long answer)
8. Roughly how long did a run take? (under 20 min / 20–40 / 40–60 / over 60)
9. How much do you want to play another run? (1–5 scale)
10. Anything that looked broken? (or post it in #bug-reports)

### 4.5 `#known-issues` (pinned)

> Already known, no need to report:
> - The art is placeholder, including the monster pictures (real art is being commissioned).
> - The **map** and the **shop/workshop screens** are being redesigned.
> - The overall visual style (colours, fonts) is getting a full rework.
> - Phones and tablets aren't supported yet.
- Some words (firmware, OS, macro) are old names that are being simplified.
>
> Still worth reporting about these: anything that's **broken**, **confusing**, or that makes you stop playing.

### 4.6 `#bug-reports` post guidelines (template)

> **Title:** short description (e.g. "Ink Stream did no damage")
> **What happened:**
> **What you expected:**
> **Steps** (what you clicked just before):
> **Build:** the text at the bottom of the main menu (e.g. PLAYTEST 2 · 5557bbb)
> **Browser:** Chrome / Edge / Firefox / other
> **Screenshot or run log** if you can (Settings → Export run log)

### 4.7 Vision (pinned in `#welcome`, three lines)

> **Mingming: Midgard Circuit** is Slay the Spire dressed as Pokémon.
> Recruit monsters from Norse myth, build one deck around your team of three, and battle your way through three regions to the gym.
> Every run is different: new monsters, new cards, new routes.

### 4.8 Roadmap (pinned in `#announcements`, no dates)

> 1. **Now:** friends-and-family playtest (that's you, thank you!)
> 2. **Next:** real monster art, and a redesigned map with towns and routes
> 3. **Then:** a Steam page and a short devlog video
> 4. **Later:** a bigger playtest on Steam, then Early Access

---

## Done when

- D1–D15 are ruled, and 179, 181a, 181b, 181c, **182 and 183** are built.
- `main` deploys `PLAYTEST 2 · <commit>` to Pages, and it passed the §3 Phase 2 checks.
- The Discord is set up as in Phase 3, testers are invited, and the form opens pre-filled from the game.
- At the end, `playtest-results/round-2-friends/` holds the bugs, the logs, the survey and the summary.
