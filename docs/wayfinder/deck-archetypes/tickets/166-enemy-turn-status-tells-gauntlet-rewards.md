# Ticket 166 — The enemy turn stops freezing, status tells stop piling up, the gauntlet fields the gym's element, macros between gauntlet fights, fewer patches, and the AI's beam fixed

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 166a–166f (`d1a509f..3fc6447`). The status line below is kept as history.

**Type:** feel + run economy. **Status:** OPEN. Written 2026-09-27 from Henry's 09-26 playtest notes (`playtest-results/2026-26-09/rootfall-fenrir_v2/notes.md` and his answers in `review.md`), and his message the same day:

> *"Write ticket 166 now. Except there should be no patch limit. Just reduce the number of patch rewards offered. They felt very OP so make it only on the last elite you can win one. The others should give extra scrap or maybe a macro instead. Please investigate the stutter first then provide a detailed solution for the handoff to the implementation agent."*

Six rows. Each row is **one commit**, with a **failing test first**. 166e and 166f were added to the build list after Henry's rulings of 2026-09-27.

| Row | What | Can it be built now? |
|---|---|---|
| **166a** | The enemy AI thinks in a Web Worker, so the screen never freezes | Yes |
| **166b** | Status tells: one per status, all bodies at once, a ×N float, and a timing bug fixed | Yes |
| **166c** | Gauntlet fights 1 and 2 field two gym-element bodies and one other | Yes |
| **166d** | A "take one macro" pick on the reward screen, paid after gauntlet fights 1 and 2 | Yes |
| **166e** | Only an elite in the final biome pays a patch; other elites and ambushes pay the 166d macro pick; the gate gives one patch, not one per body | Yes — Henry ruled E1–E3 on 2026-09-27 |
| **166f** | Fix the AI's beam bug and give the gym a beam, so the boss stops thinking for 27 s | Yes — ruled 2026-09-27; the measurement is in the row |

Build them in the order written. 166e reuses 166d's macro pick, so 166d must land first. 166f changes how every enemy thinks, so it goes last, after 166a has moved the search off the main thread.

---

## How to work this ticket (read this before any row)

1. **Read the whole row before editing anything.** Every file path, function name and line number below was checked against `129375b` (2026-09-27). Line numbers drift; search for the quoted code rather than trusting a number.
2. **Write the test first and run it on the parent commit.** It must fail for the reason the row names. Then make the change, and the test must pass. Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** In particular, do **not** touch `src/engine/ai/TacticalAI.ts` in any row except 166f, and in 166f only the lines it names.
4. **Gate:** `npm run gate` must be green before each commit. `npm run build` must also pass for 166a, because it runs `scripts/assert-no-debug.mjs` over the built files, and 166a adds a new built file (the worker).
5. **Commits:** authored as Henry — `git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`. **No `Co-Authored-By` trailers.** The last line of every message is `HANDOFF: <one sentence on what the next person needs to know>`.
6. **Do not push.** Report `git push origin playtest-polish` for Henry to run.
7. **Line endings:** CRLF for files under `docs/wayfinder` and `scratch/`; LF for tests, `src/debug` and JSON. Every other file: keep the ending it already has (check with `file <path>` before editing). A new file under `src/` is LF.
8. **Stop and ask Henry** if anything below turns out to be false when you look at the code, or if a test the row did not mention starts failing. Do not "fix" a different test to make it pass.
9. **Report** in plain English at the end: what changed per row, the before/after numbers each row asks for, and any decision you hit.

---

## 166a — The enemy AI thinks in a Web Worker, so the screen never freezes

**What Henry reported.** *"The enemy turn is extremely laggy. It stutters during animations."*

### What is actually happening (investigated 2026-09-27)

1. **The AI's search runs on the main thread, in the middle of the previous card's animation.** `BattleArena.tsx`, the effect under the comment `// Enemy AI Turn Automation` (around line 452). After every enemy dispatch the battle state changes, the effect re-runs, waits a 50 ms debounce, and then calls `getBestAction(battleState)` **synchronously**. At that moment the previous enemy card is still on screen: `PLAYED_CARD_REVEAL_MS` holds it for 1,200 ms and the cast sequence (trail, impact, status tells) is mid-flight. While `getBestAction` runs, JavaScript cannot paint, so every animation on screen stops dead and then jumps. That is the stutter.
2. **The file already knows this.** Its own comments say *"It does NOT fix the freeze. `getBestAction` is synchronous on the main thread … Un-freezing it needs the search off-thread (ticket 39 asks for a Web Worker)."*
3. **How long it freezes, measured** with `scratch/stutterprobe.ts` (committed with this ticket) on the 09-26 party — fenrir_v2, sköll_v2, huldra_v1 — at Rootfall:

   | Fight | AI search width | Time per enemy decision (ms), in order |
   |---|---|---|
   | Gauntlet fight 1 | beam 8 (what wilds and elites use) | 275, 1,342, 72, 52 |
   | Gauntlet fight 3, the boss | beamless (what the gym uses) | **27,154**, 9,775, 5,958, 2,195, 595, 219, 88, 68, 0 |

   So an ordinary fight freezes the screen for up to about 1.3 s per enemy card, and the boss's first card freezes it for **27 seconds**. These numbers are from a cloud container; Henry's machine will differ, but the shape will not.
4. **A Worker is safe here — both preconditions were checked.** The whole `IBattleState` survives `structuredClone` unchanged (about 6.7 KB as JSON), and `getBestAction` on the clone picks exactly the same action as on the original (3 of 3 decisions checked in each fight). A Worker receives a structured clone, so it will make the same decisions the game makes today.
5. **What a Worker does NOT fix.** The boss still takes as long to decide. The difference is that the screen stays alive while it thinks: animations finish, the reveal comes down, and nothing jumps. Making the boss decide faster changes how it plays, which is a balance decision; it is listed for Henry at the end of this ticket and is **not** in this row.

### The change

Create four new files in a new folder `src/ui/ai/`, and edit `BattleArena.tsx`. Nothing in `src/engine` changes.

**File 1 — `src/ui/ai/aiProtocol.ts`** (the message shapes, shared by both sides):

```ts
import type { BattleAction } from '../../engine/battleReducer';
import type { IBattleState } from '../../engine/types';

/** Main thread → worker. */
export type AiWorkerRequest =
    | { readonly kind: 'ping' }
    | { readonly kind: 'decide'; readonly requestId: number; readonly state: IBattleState };

/** Worker → main thread. */
export type AiWorkerResponse =
    | { readonly kind: 'pong' }
    | { readonly kind: 'decided'; readonly requestId: number; readonly action: BattleAction }
    | { readonly kind: 'failed'; readonly requestId: number; readonly message: string };
```

Check that `BattleAction` and `IBattleState` really are exported from those two paths (`TacticalAI.ts` imports `type BattleAction` from `'../battleReducer'`). If a path is wrong, use the right one; do not re-declare the types.

**File 2 — `src/ui/ai/aiWorkerCore.ts`** (the worker's logic as a plain function, so a normal unit test can run it):

```ts
import { getBestAction } from '../../engine/ai/TacticalAI';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';

export function answerAiRequest(request: AiWorkerRequest): AiWorkerResponse {
    if (request.kind === 'ping') return { kind: 'pong' };
    try {
        return { kind: 'decided', requestId: request.requestId, action: getBestAction(request.state) };
    } catch (error) {
        return { kind: 'failed', requestId: request.requestId, message: String(error) };
    }
}
```

**File 3 — `src/ui/ai/aiWorker.ts`** (the worker entry point; no logic of its own):

```ts
import { answerAiRequest } from './aiWorkerCore';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';

// The project's tsconfig uses the DOM lib, not the WebWorker lib, so `self` is typed as a Window.
// This narrow cast is the whole of what the worker needs from its global scope.
const scope = self as unknown as {
    onmessage: ((event: MessageEvent<AiWorkerRequest>) => void) | null;
    postMessage(message: AiWorkerResponse): void;
};

scope.onmessage = (event) => {
    scope.postMessage(answerAiRequest(event.data));
};
```

**File 4 — `src/ui/ai/enemyBrain.ts`** (the main-thread client). This is the only file `BattleArena` talks to. Write it exactly like this:

```ts
import { getBestAction } from '../../engine/ai/TacticalAI';
import type { BattleAction } from '../../engine/battleReducer';
import type { IBattleState } from '../../engine/types';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';

/** The part of a Worker this module uses. A test passes a fake with the same shape. */
export interface AiWorkerLike {
    onmessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null;
    onerror: ((event: Event) => void) | null;
    postMessage(message: AiWorkerRequest): void;
    terminate(): void;
}

export type AiWorkerFactory = () => AiWorkerLike | null;

/** How long to wait for the worker's first `pong` before thinking on the main thread instead. */
export const WORKER_READY_TIMEOUT_MS = 1000;

export interface EnemyBrain {
    /** Resolves with the same action `getBestAction(state)` would return. */
    decide(state: IBattleState): Promise<BattleAction>;
    /** Stops the worker. Any decision still pending never settles; its caller has been cancelled. */
    dispose(): void;
}

export function defaultAiWorkerFactory(): AiWorkerLike | null {
    if (typeof Worker === 'undefined') return null; // jsdom, vitest, very old browsers
    try {
        return new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' }) as unknown as AiWorkerLike;
    } catch (error) {
        console.warn('[ai] worker unavailable; the enemy will think on the main thread', error);
        return null;
    }
}

export function createEnemyBrain(factory: AiWorkerFactory = defaultAiWorkerFactory): EnemyBrain {
    const worker = factory();
    const onMainThread: EnemyBrain = {
        decide: (state) => Promise.resolve(getBestAction(state)),
        dispose: () => undefined,
    };
    if (!worker) return onMainThread;

    let status: 'pending' | 'ready' | 'broken' | 'disposed' = 'pending';
    let nextRequestId = 1;
    const waiting = new Map<number, (action: BattleAction | null) => void>();
    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => { markReady = resolve; });

    worker.onmessage = (event) => {
        const message = event.data;
        if (message.kind === 'pong') {
            if (status === 'pending') status = 'ready';
            markReady();
            return;
        }
        const settle = waiting.get(message.requestId);
        if (!settle) return;
        waiting.delete(message.requestId);
        settle(message.kind === 'decided' ? message.action : null);
    };

    worker.onerror = (event) => {
        event.preventDefault?.();
        console.warn('[ai] worker failed; the enemy will think on the main thread from now on', event);
        status = 'broken';
        markReady();
        for (const settle of waiting.values()) settle(null);
        waiting.clear();
    };

    worker.postMessage({ kind: 'ping' });

    return {
        async decide(state) {
            if (status === 'pending') {
                await Promise.race([ready, new Promise((r) => setTimeout(r, WORKER_READY_TIMEOUT_MS))]);
            }
            if (status !== 'ready') return getBestAction(state);
            const requestId = nextRequestId++;
            const action = await new Promise<BattleAction | null>((resolve) => {
                waiting.set(requestId, resolve);
                worker.postMessage({ kind: 'decide', requestId, state });
            });
            // `null` means the worker failed on this state. Think here instead, which is exactly
            // what the game did before this row - including throwing, if the engine throws.
            return action ?? getBestAction(state);
        },
        dispose() {
            status = 'disposed';
            waiting.clear();
            worker.terminate();
        },
    };
}
```

Notes on that file, so you do not "improve" it:

- **Why a ping.** A Worker that fails to load does not throw when you construct it; it fails later with an `error` event, or in some environments never answers at all. The `pong` proves it is alive. Until it arrives (at most `WORKER_READY_TIMEOUT_MS`), and forever if it never does, the game thinks on the main thread exactly as it does today. **The game must never hang waiting for a worker.**
- **Why pending decisions are not rejected on `dispose`.** `dispose` runs when the battle screen unmounts. If it rejected, the fallback would run `getBestAction` on the main thread for a battle nobody is looking at — a freeze for nothing. The caller (`runAI` in `BattleArena`) is already cancelled at that point, so an unsettled promise is simply garbage-collected.
- **A superseded request cannot be interrupted.** `getBestAction` is one synchronous loop inside the worker. If `BattleArena`'s effect is cancelled mid-think, the worker still finishes that search, and the next request waits behind it. The existing 50 ms debounce makes this rare. Do not add worker restarts for it in this row.

### Edit `src/ui/components/BattleArena.tsx`

1. Add the import: `import { createEnemyBrain, type EnemyBrain } from '../ai/enemyBrain';`. Keep the existing `getBestAction` import; it is still the fallback.
2. Beside the other `useRef`s near the top of the component (around line 286), add:

   ```ts
   // TICKET 166a: the enemy thinks in a Web Worker so the screen keeps animating while it does.
   const enemyBrainRef = useRef<EnemyBrain | null>(null);
   useEffect(() => {
       const brain = createEnemyBrain();
       enemyBrainRef.current = brain;
       return () => {
           brain.dispose();
           if (enemyBrainRef.current === brain) enemyBrainRef.current = null;
       };
   }, []);
   ```

   The empty dependency array is deliberate: one worker per battle screen, not one per state change. React's StrictMode in dev will create, dispose and re-create it once; that is fine.

3. In the enemy AI effect, replace exactly these three lines:

   ```ts
   const thinkStart = performance.now();
   const action = getBestAction(battleState);
   const thoughtFor = performance.now() - thinkStart;
   ```

   with:

   ```ts
   const thinkStart = performance.now();
   const brain = enemyBrainRef.current;
   const action = brain ? await brain.decide(battleState) : getBestAction(battleState);
   if (cancelled) return;
   const thoughtFor = performance.now() - thinkStart;
   ```

   Leave the pacing alone: the pause is still a **floor** (`Math.max(0, pauseMs - DEBOUNCE_MS - thoughtFor)`), the debounce stays 50 ms, and the three `dispatch` branches do not change.

4. Rewrite the two comment paragraphs in that effect that say the search is synchronous and *"It does NOT fix the freeze"* / *"a reveal animating 'during' the search would simply freeze"*. They are about to become false. Say instead: since ticket 166a the search runs in a Web Worker (`src/ui/ai/enemyBrain.ts`), so the reveal and the cast sequence keep animating while the enemy thinks; the main-thread path remains as the fallback where no Worker is available (tests, and a worker that failed to start). Keep the ticket 127 history above them.

### Tests (write these first)

`src/ui/ai/enemyBrain.test.ts` (plain vitest, no jsdom needed). Build a real battle state the way `scratch/stutterprobe.ts` does, or reuse whatever small state helper existing AI tests use (search `src` for tests that call `getBestAction` and copy their setup). Then:

1. **Same decision through the worker's code path.** `answerAiRequest({ kind: 'decide', requestId: 1, state: structuredClone(state) })` returns `{ kind: 'decided', action }` where `action` deep-equals `getBestAction(state)`. Do this for at least three consecutive enemy decisions (apply each action with `battleReducer` to get the next state).
2. **Falls back when there is no Worker.** `createEnemyBrain(() => null).decide(state)` resolves to `getBestAction(state)`.
3. **Uses the worker once it has answered the ping.** Write a fake `AiWorkerLike` whose `postMessage` answers asynchronously (`queueMicrotask` or `setTimeout(…, 0)`) by calling `onmessage({ data: answerAiRequest(request) })`. Wrap `answerAiRequest` in a spy. `decide(state)` resolves to the right action, and the spy was called with `kind: 'decide'`.
4. **Falls back when the worker errors.** A fake that answers `pong`, then on `decide` calls `onerror(new Event('error'))` instead of answering: `decide` still resolves to `getBestAction(state)`, and a second `decide` does not post to the fake at all.
5. **Falls back when the worker never answers the ping.** A fake whose `postMessage` does nothing: with `vi.useFakeTimers()`, advance `WORKER_READY_TIMEOUT_MS`; `decide` resolves to `getBestAction(state)`.
6. **`dispose` terminates the worker** (the fake's `terminate` was called).

Tests 3–5 fail on the parent because the module does not exist; that counts.

Also run the existing `BattleArena`/`BattleStage` tests. They run in jsdom, where `Worker` is undefined, so they take the fallback path and must pass unchanged. If one fails, **stop and report it**; do not change the test.

### Build check

Run `npm run build`. Vite bundles `aiWorker.ts` into its own file under `dist/assets/`. If the build fails with *"UMD and IIFE output formats are not supported for code-splitting builds"*, add `worker: { format: 'es' },` to the object in `vite.config.ts` (beside `define`), with a one-line comment that 166a's worker needs it, and build again. Change nothing else in that file.

### Verify it by eye (required — a unit test cannot see a freeze)

1. `npm run dev`. Start a run and play into any fight. Open DevTools → Console and paste:

   ```js
   window.__longest = 0;
   new PerformanceObserver((list) => {
       for (const entry of list.getEntries()) window.__longest = Math.max(window.__longest, entry.duration);
   }).observe({ type: 'longtask', buffered: true });
   ```

2. Let two full enemy turns play, then type `window.__longest` in the console. Do it on the parent commit and on your commit. **Before:** roughly the longest AI decision (hundreds to thousands of ms). **After:** under 200 ms. Put both numbers in the report.
3. In the Network or Sources panel, confirm a worker script (`aiWorker…`) loaded. In the console there must be **no** `[ai] worker unavailable` or `[ai] worker failed` warning.
4. **The desktop build — this is the risky part.** The Electron app loads the game with `win.loadFile(...)`, i.e. from a `file://` URL, and some Chromium builds refuse to start a worker from a `file://` page. Run `npm run desktop:build`, launch the packaged app, open its DevTools (Ctrl+Shift+I), and check step 3 there.
   - If the worker loads: done.
   - If you see `[ai] worker unavailable` or `[ai] worker failed`: the game still works (it falls back), but the stutter is back. Change `defaultAiWorkerFactory` to use Vite's inline worker instead: at the top of `enemyBrain.ts` add `import InlineAiWorker from './aiWorker?worker&inline';` and construct `new InlineAiWorker()` in place of `new Worker(new URL(...), ...)`. Rebuild and check again in **both** the browser and the desktop app. If vitest then fails to import that module, move the import into the factory as `const { default: InlineAiWorker } = await import('./aiWorker?worker&inline')` and make the factory async — and **stop and report** before going further, because that changes this row's shape.
5. Play one Rootfall gym boss fight if you can reach it (a debug scenario or a save is fine). The enemy will still take a long time on its first card (about 27 s measured). The point is that the screen stays smooth and nothing jumps while it thinks. Say in the report how long it took on Henry's machine.

**Commit:** the four new files, the `BattleArena.tsx` edit, the new test. Message starts `feat(ai): enemy thinks in a Web Worker so the enemy turn stops freezing (166a)`.

---

## 166b — Status tells: one per status, all bodies at once, with a ×N float

**What Henry reported.** *"With fenrir_v2, skoll_v2, huldra_v2 the animations are starting to slow down because there are so many status effects happening. Two cards to apply burn caused me to get 20 sharp across my team and the enemies have 20 weakened. So we need those to resolve faster. Maybe one animation per status effect and throw a x2 or x8 multiplier for the number of stacks. Or just do a single animation and leave it at that. Also don't stagger between mingmings."*

### What is actually happening (read from the code)

1. **Every status application is its own event and its own animation step.** The engine emits one `STATUS_APPLIED` per application per body (`effectHandlers.ts`, around line 635; its `stacks` field is the stacks **added**). A burn card on fenrir_v2's team can produce well over ten of them in one cast (Sharp on each ally, Weakened on each enemy, Burn itself, OS reactions).
2. **`useCastSequence.playCast` plays them one after another — and the gaps GROW.** In `src/ui/vfx/useCastSequence.ts`:

   ```ts
   cast.statuses.forEach((entry, index) => {
       const at = last + STATUS_TELL_STAGGER_MS * (index + 1);
       ...
       last = Math.max(last, at);
   });
   ```

   `last` is updated inside the loop and then used again for the next entry, so each gap is 60 ms longer than the one before it: 60, 120, 180, 240 … **The total is quadratic**: 3 statuses take 360 ms (the test assumes 180), 10 take 3.3 s, and **20 take 12.6 seconds for one card**. The cast queue waits for that before it starts the next card, so every later card in the turn plays further and further behind. This bug is the main reason the animations "slow down".
3. **Every event also makes its own sound and ring.** `src/ui/hooks/useBattleVfx.ts`, `case 'STATUS_APPLIED'` (around line 471), calls `playSfx` once per event and bumps that body's ring once per event. The 09-25 sound spacer queues those sounds 80 ms apart, so a burst of 20 is a smear of sound for over a second.

### The change

Henry offered two versions; this row builds his first one — **one tell per status, fired on every body that got it at the same moment, plus a small "Sharp ×7" float on each body** — because it keeps the information (how many stacks) that his second version drops.

**New file `src/ui/vfx/statusBurst.ts`** — pure functions, no React:

```ts
import type { StatusType } from '../../engine/types';

export interface StatusEntry { readonly targetId: string; readonly status: StatusType }
export interface StatusTellGroup { readonly status: StatusType; readonly targetIds: ReadonlyArray<string> }
export interface ScheduledStatusTell extends StatusTellGroup { readonly at: number }

/** One group per distinct status, in first-seen order; each body listed once per status. */
export function groupStatusTells(entries: ReadonlyArray<StatusEntry>): StatusTellGroup[] {
    const groups: Array<{ status: StatusType; targetIds: string[] }> = [];
    for (const entry of entries) {
        let group = groups.find((g) => g.status === entry.status);
        if (!group) { group = { status: entry.status, targetIds: [] }; groups.push(group); }
        if (!group.targetIds.includes(entry.targetId)) group.targetIds.push(entry.targetId);
    }
    return groups;
}

/**
 * When each group plays: `stagger` apart, starting `stagger` after `afterMs` (the last impact).
 * Measured from a FIXED base, so n groups end at afterMs + n * stagger - linear, not quadratic.
 */
export function scheduleStatusTells(
    afterMs: number,
    entries: ReadonlyArray<StatusEntry>,
    stagger: number,
): ScheduledStatusTell[] {
    return groupStatusTells(entries).map((group, index) => ({ ...group, at: afterMs + stagger * (index + 1) }));
}

/** The float text: "Sharp" for one stack, "Sharp ×7" for several. Splits CamelCase ("Dark Stance"). */
export function statusFloatText(status: StatusType, stacks: number): string {
    const name = String(status).replace(/([a-z])([A-Z])/g, '$1 $2');
    return stacks > 1 ? `${name} ×${stacks}` : name;
}
```

**Edit `src/ui/vfx/useCastSequence.ts`, function `playCast`.** Replace the whole `cast.statuses.forEach(...)` block (the one quoted above, with its comment) with:

```ts
// Step 4: the statuses, after the last impact. TICKET 166b: ONE tell per status, fired on every
// body that got it at the same instant (Henry: "don't stagger between mingmings"), 60 ms between
// different statuses, measured from a fixed base - the old loop re-read `last` and so grew each gap.
const afterImpact = last;
for (const tell of scheduleStatusTells(afterImpact, cast.statuses, STATUS_TELL_STAGGER_MS)) {
    timers.push(window.setTimeout(() => {
        for (const targetId of tell.targetIds) emitStatusApplied(tell.status, targetId);
    }, tell.at));
    last = Math.max(last, tell.at);
}
```

Import `scheduleStatusTells` from `./statusBurst`. Nothing else in that file changes — the queue, the window, the mount-scoped effect (read the 155a note at the top of the hook before touching anything near it) all stay.

**Edit `src/ui/hooks/useBattleVfx.ts`** so one burst of status events makes one sound per status, one ring per body, and one float per body per status.

1. Add `'status'` to `FloatKind` (around line 33): `export type FloatKind = 'damage' | 'crit' | 'heal' | 'absorbed' | 'proc' | 'status';`
2. Add a ref next to the other refs (near `pendingTimeoutsRef`):

   ```ts
   // TICKET 166b: STATUS_APPLIED events from one reducer burst, merged by body + status.
   const statusBurstRef = React.useRef<Map<string, { targetId: string; status: StatusType; stacks: number }> | null>(null);
   ```

   (Import `StatusType` from the engine types if it is not already imported.)
3. Inside the same effect that defines `pushFloat` (it starts `React.useEffect(() => { const pushFloat = ...`), define `flushStatusBurst` **after** `pushFloat`:

   ```ts
   const flushStatusBurst = () => {
       const burst = statusBurstRef.current;
       statusBurstRef.current = null;
       if (!burst || burst.size === 0) return;
       const entries = [...burst.values()];

       // One sound per distinct status, in the order they arrived.
       const sounded = new Set<StatusType>();
       for (const entry of entries) {
           if (sounded.has(entry.status)) continue;
           sounded.add(entry.status);
           // <-- move the existing three-way cue choice here unchanged:
           //     DarkStance -> playSfx('stanceDark'); LightStance -> playSfx('stanceLight');
           //     otherwise playSfx(statusCue(entry.status), { pitch: statusPitch(entry.status) })
       }

       // One ring bump per body, coloured by the last status that body received.
       const ringColour = new Map<string, string>();
       for (const entry of entries) ringColour.set(entry.targetId, STATUS_COLORS[entry.status as StatusType] ?? '#cccccc');
       setVfx(prev => {
           const unitFx = { ...prev.unitFx };
           for (const [targetId, colour] of ringColour) {
               const unit = unitFx[targetId] ?? EMPTY_UNIT_FX;
               unitFx[targetId] = { ...unit, statusKey: unit.statusKey + 1, statusColor: colour };
           }
           return { ...prev, unitFx };
       });

       // One float per body per status, with the stack count.
       for (const entry of entries) {
           pushFloat(entry.targetId, 'status', statusFloatText(entry.status, entry.stacks),
               STATUS_COLORS[entry.status as StatusType] ?? '#cccccc');
       }
   };
   ```

4. Replace the body of `case 'STATUS_APPLIED':` with:

   ```ts
   case 'STATUS_APPLIED': {
       // TICKET 166b: gathered, not played. Every status of one cast arrives in the same
       // synchronous reducer burst; a 0 ms timeout runs after the burst and plays it once.
       let burst = statusBurstRef.current;
       if (!burst) {
           burst = new Map();
           statusBurstRef.current = burst;
           pendingTimeoutsRef.current.push(setTimeout(flushStatusBurst, 0));
       }
       const key = `${event.targetId}|${event.status}`;
       const previous = burst.get(key);
       burst.set(key, { targetId: event.targetId, status: event.status, stacks: (previous?.stacks ?? 0) + event.stacks });
       return;
   }
   ```

   Keep the 147d comment about the stance cues; move it to sit above the cue choice inside `flushStatusBurst`.
5. In that effect's cleanup (around line 611, where `pendingTimeoutsRef.current` is cleared), also set `statusBurstRef.current = null;`.

**CSS, `src/index.css`.** Next to `.hud-float-proc` (around line 2258), add:

```css
.hud-float-status {
  /* Ticket 166b: "Sharp ×7" - a label, smaller than a heal, in the status's own colour. */
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}
```

### Tests (write these first)

1. **`src/ui/vfx/statusBurst.test.ts`** (new):
   - 20 entries — Sharp on 3 allies (repeated) and Weakened on 3 enemies (repeated) — group into exactly 2 groups, `Sharp` first, each with 3 distinct target ids.
   - `scheduleStatusTells(500, thoseEntries, 60)` gives `at` values `[560, 620]`.
   - Three different statuses on one body give `at` values `[560, 620, 680]` — linear. (On the parent the same three statuses play at 560, 680, 860.)
   - `statusFloatText('Sharp', 7) === 'Sharp ×7'`, `statusFloatText('Burn', 1) === 'Burn'`, `statusFloatText('DarkStance', 1) === 'Dark Stance'`.
2. **`src/ui/vfx/castSequence.test.ts`**, test `'finishes steps 2-4 before the reveal comes down'`: its `worst` line assumes the old loop was linear, which it was not. Replace `const worst = lastImpact + statuses * STATUS_TELL_STAGGER_MS;` with a call to `scheduleStatusTells(lastImpact, <three different statuses on three targets>, STATUS_TELL_STAGGER_MS)` and take the last `at`. Add a second assertion: **twenty** entries across two statuses still end before `PLAYED_CARD_REVEAL_MS`. That second assertion is the one that fails on the parent (the parent's loop would put the twentieth at 12.6 s).
3. **`src/ui/vfx/useCastSequence.test.tsx`**: add a test in the existing style (it already mounts the hook and re-renders): emit `PROGRAM_PLAYED`, then 6 `STATUS_APPLIED` (Sharp on three ally ids) in the same tick; spy on `emitStatusApplied` (mock `./statusTells` the way the file mocks other emitters, or spy on the module). Advance fake timers to the last impact + 60 ms: all three Sharp tells fired **at the same timer tick** (three calls, one tick). Nothing fires at +120 ms.
4. **useBattleVfx** — find its existing test file (search `src` for tests that render `useBattleVfx` or `BattleArena` and assert `floats`). Add: 6 `STATUS_APPLIED` events in one tick (Sharp ×2 stacks on each of 3 bodies, i.e. two events per body) → after `vi.runAllTimers()`, each body has exactly one float with kind `'status'` and text `'Sharp ×4'`, and `playSfx` was called once for the burst. If there is no existing harness for this hook, test through `BattleArena` as `BattleStage.test.tsx` does, and say so in the report.

### Verify by eye

`npm run dev`, play fenrir_v2 (or any Fire party) into a fight and play two burn cards. Record before/after in the report: roughly how long from the card landing to the next card being playable, and whether the "Sharp ×N" floats read. A screenshot of the floats at 1280×720 is the write-back.

**Commit:** `statusBurst.ts` + test, the two hook edits, the CSS, the test updates. Message starts `fix(vfx): one status tell per status on every body at once, with a stack float (166b)`. Say in the body that the old loop was quadratic and give the 20-status number.

---

## 166c — Gauntlet fights 1 and 2 field two gym-element bodies and one other

**What Henry reported.** *"In the gauntlet and it is water, water, fire. Pretty sure I'm supposed to be at Rootfall with NNW teams. I guess this was for fight 1? Still it should be mostly nature and mix in some water or fire, not WWF."*

### What is actually happening

`src/engine/run/gauntlet.ts`, `rollGauntletFight` (around line 325). For fights 1 and 2 (not the boss), every enemy slot draws from `regionSpeciesPool(run, node)`: **every species from all three biomes, with no weight toward the gym's element.** So Rootfall's first two fights are a random draw from Fire, Nature and Water, and water-water-fire is an ordinary outcome. The run log confirms fight 1 was jormungandr_v1, kraken_v2, fenrir_v1. Fight 3 (the boss) is authored in `bosses.ts` and is fine.

### The change

Henry's words are "mostly nature and mix in some water or fire". For three bodies, **mostly = two**. So in fights 1 and 2: **slots 0 and 1 are the gym's element; slot 2 is any other element the region fields.** This mirrors the approach biome's ruled N-N-W shape (`gyms.gymCompElementPlan`), except that the third body may be either off-element, as Henry wrote "water or fire".

In `src/engine/run/gauntlet.ts`:

1. Add below `regionSpeciesPool`:

   ```ts
   /**
    * TICKET 166c (Henry, 2026-09-27): *"it should be mostly nature and mix in some water or fire,
    * not WWF."* Fights 1 and 2 field the gym's element in the first GAUNTLET_GYM_ELEMENT_SLOTS
    * slots and one other region element after them. Falls back to the whole region pool when a side
    * is empty, so a content gap can never leave a slot with nothing to draw.
    */
   export const GAUNTLET_GYM_ELEMENT_SLOTS = 2;

   function gauntletSlotPool(run: IRunState, node: IRegionNode, slot: number, gymElement: string | undefined): string[] {
       const region = regionSpeciesPool(run, node);
       if (!gymElement) return region;
       const own = region.filter((id) => GetMingmingData(id).primaryElement === gymElement);
       const other = region.filter((id) => GetMingmingData(id).primaryElement !== gymElement);
       const wanted = slot < GAUNTLET_GYM_ELEMENT_SLOTS ? own : other;
       return wanted.length > 0 ? wanted : region;
   }
   ```

2. In `rollGauntletFight`, change

   ```ts
   const pool = boss
       ? encounterSpeciesPool(run, { ...node, biomeIndex })
       : regionSpeciesPool(run, node);
   ```

   to

   ```ts
   const pool = boss
       ? encounterSpeciesPool(run, { ...node, biomeIndex })
       : gauntletSlotPool(run, node, slot, gym?.element);
   ```

   `gym` is already defined a few lines above (`const gym = GYM_REGISTRY[run.gymId];`). **Do not change anything else in the loop.** `drawSpecies` still makes exactly one draw per slot, which keeps the stream positions (and so the IVs, firmware and the boss) where they are.

3. Update the doc comment on `regionSpeciesPool`: it says the union is *"the leader's recruiting ground for fights 1 and 2"*. Add that since 166c the union is filtered per slot by `gauntletSlotPool`.

### Tests (write these first), in `src/engine/run/gauntlet.test.ts`

1. For each gym in `GYM_REGISTRY`, for 40 seeds (build runs the way the existing tests in that file do), for `fightIndex` 0 and 1: exactly **two** of the three enemies have `primaryElement === gym.element`, they are slots 0 and 1, and slot 2's element is different. Fails on the parent.
2. For the same runs, `fightIndex` 2 (the boss) fields exactly the authored members from `authoredBossFor(gymId)`, in order — unchanged.
3. `gauntletOpponentElements` returns the same elements as the rolled fight (it already calls `rollGauntletFight`; this pins it).

### Measure

Run `npm run balance:walk` on the parent and on this commit, same seeds, and report the gym clear rate (and each gauntlet fight's win rate if the walker prints them). This row **will** move the gym numbers — fights 1 and 2 now lean into the element the player's route was built to counter. That is intended. Report the move; do not tune anything.

**Commit:** message starts `feat(gauntlet): fights 1-2 field two gym-element bodies and one other (166c)`, and says it moves the gym numbers.

---

## 166d — Win a macro after gauntlet fights 1 and 2

**What Henry asked.** *"You should win macros between the gauntlet fights."*

### What exists today

- The gauntlet's three fights pay **nothing** (`RewardSystem.rollDropTable` returns an empty bundle for `nodeKind === 'gym'`; ticket 18a). The reward screen (`BattleReport.tsx`) still appears after each fight, empty, with a Continue button. After fights 1 and 2, Continue goes to the Pit Stop (`GauntletNode.tsx`), which shows the macro rack.
- Macros: three rack slots (`IRunState.macros`, `MACRO_SLOTS`). `runSlice.grantMacro` puts a free macro in the first empty slot and does nothing when the rack is full. `BATTLE_MACRO_IDS` in `macroRegistry.ts` is every macro except the map one (Ping Sweep).
- There is no way on the reward screen to make room in a full rack.

### The change: a "take one macro" pick on the reward screen

Built so that 166e can reuse it for elites.

**1. `src/engine/run/macroRewards.ts` (new):**

```ts
import { SeedStream } from '../core/SeedStream';
import { BATTLE_MACRO_IDS } from '../data/macroRegistry';

/** How many macros a macro reward offers. The player takes one or none. */
export const MACRO_REWARD_CHOICES = 3;

/** Three different battle macros, deterministic in the fight's seed. Its own fork, so it cannot shift any other reward roll. */
export function rollMacroChoices(seed: string): string[] {
    const stream = new SeedStream(new SeedStream(seed).fork('reward-macros'));
    return stream.shuffle(BATTLE_MACRO_IDS).slice(0, MACRO_REWARD_CHOICES);
}
```

Check `SeedStream.fork` and `shuffle` are used this way elsewhere (`RewardSystem.ts` does `new SeedStream(new SeedStream(seed).fork('reward-card-ids'))`; `driverStakes.ts` calls `stream.shuffle`). If the signatures differ, follow the existing usage.

**2. `src/engine/run/fightBonus.ts` (new)** — the one place that says which fights pay an extra prize. In this row only the gauntlet uses it; 166e extends it.

```ts
import type { IGauntletProgress, NodeKind } from '../runTypes';

/** The extra prize a won fight pays beside scrap, cards and blueprints. */
export type FightBonus = 'patch' | 'macro' | null;

export interface FightBonusInput {
    readonly nodeKind: NodeKind;
    readonly biomeIndex: number;
    readonly biomeCount: number;
    readonly gauntlet: IGauntletProgress | null;
}

export function fightBonusFor(input: FightBonusInput): FightBonus {
    if (input.nodeKind === 'gym') {
        // TICKET 166d: a macro after gauntlet fights 1 and 2. The boss fight ends the run; nothing to spend it on.
        if (!input.gauntlet) return null;
        return input.gauntlet.fightIndex < input.gauntlet.totalFights - 1 ? 'macro' : null;
    }
    // Everything below is unchanged behaviour until 166e: elites and ambushes pay the patch offer.
    if (input.nodeKind === 'elite' || input.nodeKind === 'ambush') return 'patch';
    return null;
}
```

Check the `IGauntletProgress` and `NodeKind` import paths in `runTypes.ts`.

**3. `src/engine/gameTypes.ts`, `IRewardBundle`:** add, beside `patchChoices`:

```ts
/** TICKET 166d — up to three macro ids; the player may take one. Absent when the fight pays none. */
readonly macroChoices?: ReadonlyArray<string>;
```

**4. `src/engine/RewardSystem.ts`:**

- `IRewardRollInput`: add `readonly bonus?: FightBonus;` with a doc comment saying it comes from `fightBonusFor` and defaults to the pre-166 behaviour (see below).
- In `rollDropTable`:
  - Read `bonus` from the input. **Default it so nothing changes for callers that do not pass it:** `const bonus = input.bonus !== undefined ? input.bonus : (paysDriver(nodeKind) ? 'patch' : null);`. (Debug scenarios and the walker do not pass it yet.)
  - The gym early return becomes: `return { scraps: 0, blueprints: [], cards: [], cardChoices: [], ...(bonus === 'macro' ? { macroChoices: rollMacroChoices(seed) } : {}) };` and update the 18a comment above it to say the gauntlet's fights 1 and 2 now pay a macro pick (166d) and still nothing else.
  - The final `return`: replace `...(paysDriver(nodeKind) ? { patchChoices: elitePatchOffer(party) } : {}),` with
    `...(bonus === 'patch' ? { patchChoices: elitePatchOffer(party) } : {}),`
    `...(bonus === 'macro' ? { macroChoices: rollMacroChoices(seed) } : {}),`

**5. `src/ui/store/runSlice.ts`:** add a reducer next to `grantMacro`, and export it with the others (around line 1373):

```ts
/**
 * TICKET 166d — take a macro won on the reward screen. Fills the first empty slot; when the rack is
 * full it REPLACES `replaceSlot`, which the player chose on the same screen. A full rack with no
 * slot named is a no-op (the player walked past the prize). Unknown ids are refused.
 */
takeRewardMacro: (state, action: PayloadAction<{ macroId: string; replaceSlot?: number }>): RunSliceState => {
    const run = state.run as IRunState | null;
    if (!run) return { run: null };
    const { macroId, replaceSlot } = action.payload;
    if (!getMacro(macroId)) return { run };
    const free = firstFreeMacroSlot(run.macros);
    if (free !== -1) return { run: { ...run, macros: withMacroSlot(run.macros, free, macroId) } };
    if (replaceSlot === undefined || !Number.isInteger(replaceSlot) || replaceSlot < 0 || replaceSlot >= MACRO_SLOTS) return { run };
    return { run: { ...run, macros: withMacroSlot(run.macros, replaceSlot, macroId) } };
},
```

Use whatever `getMacro`, `firstFreeMacroSlot` and `MACRO_SLOTS` imports the slice already has.

**6. Run log.** `src/engine/run/runLog.ts`, the event union (around line 236): add `| { readonly kind: 'MACRO_WON'; readonly macroId: string; readonly replaced: string | null }`. If that file (or any file it imports) also has a schema or list of allowed kinds, add it there too. In `src/ui/store/runLogMiddleware.ts`, next to `case 'run/buyMacro'`, add:

```ts
case 'run/takeRewardMacro': {
    const macroId = String(payload?.macroId ?? '');
    const hadFreeSlot = (runBefore?.macros ?? []).some((slot) => slot === null);
    const replaced = hadFreeSlot ? null : (runBefore?.macros[Number(payload?.replaceSlot)] ?? null);
    if (runAfter?.macros.includes(macroId)) record(runAfter, { kind: 'MACRO_WON', macroId, replaced });
    break;
}
```

(Match the variable names that file really uses — `runBefore`, `runAfter`, `payload`, `record` are what the neighbouring cases use.)

**7. `src/ui/components/MacroRewardPick.tsx` (new):** the pick itself, as real `<button>`s.

Props:

```ts
interface MacroRewardPickProps {
    readonly choices: ReadonlyArray<string>;          // bundle.macroChoices
    readonly rack: ReadonlyArray<string | null>;     // run.macros
    readonly value: { macroId: string; replaceSlot?: number } | null;
    readonly onChange: (value: { macroId: string; replaceSlot?: number } | null) => void;
}
```

What it renders:

- A heading `MACRO — TAKE ONE` and a line `Optional. Single use, fired from the rack in a fight.`
- One button per choice, showing `getMacro(id).name`, its rarity and its `description`. `aria-pressed` when selected. Clicking a selected one deselects it (`onChange(null)`). Clicking another selects it (`onChange({ macroId })`).
- **Only when the rack is full and a macro is selected**, a second row: `Your rack is full — drop one to make room:` with one button per held macro (name), `aria-pressed` on the chosen one, setting `onChange({ macroId, replaceSlot: index })`. Until one is chosen, show `Nothing is dropped unless you pick one; the new macro is left behind.`
- Style it like the patch block in `BattleReport.tsx` (the `FIRMWARE PATCH — FIT IT TO ONE BODY` box), in the macro accent colour the Pit Stop uses if there is one; otherwise reuse the patch block's styles with a different border colour.

**8. `src/ui/components/BattleReport.tsx`:**

- Props: add `macroRack?: ReadonlyArray<string | null>` (default `[null, null, null]`), and a 4th `onContinue` parameter `chosenMacro?: { readonly macroId: string; readonly replaceSlot?: number }`.
- State: `const [selectedMacro, setSelectedMacro] = useState<{ macroId: string; replaceSlot?: number } | null>(null);`
- Render `<MacroRewardPick choices={bundle.macroChoices} rack={macroRack} value={selectedMacro} onChange={setSelectedMacro} />` directly after the patch block, only when `(bundle.macroChoices ?? []).length > 0`.
- **It does not gate Continue** (same as the patch).
- In `handleFinalize`, pass the macro as the 4th argument: `selectedMacro ?? undefined`.

**9. `src/ui/components/BattleArena.tsx`:**

- Where the roll effect builds `rollDropTable({...})` (around line 764), compute and pass the bonus:

  ```ts
  const currentNode = run?.nodes.find(n => n.id === run.currentNodeId);
  const bonus = run && currentNode
      ? fightBonusFor({ nodeKind, biomeIndex: currentNode.biomeIndex, biomeCount: run.biomes.length, gauntlet: run.gauntlet })
      : undefined;
  ```

  and add `bonus,` to the `rollDropTable` input. Compute this **outside** the effect, next to `nodeKind` and `driverStake`, and add `bonus` to the effect's dependency list. (The `!rewardBundle` latch already stops a second roll.)
- `handleContinue`: add the 4th parameter `chosenMacro?: { readonly macroId: string; readonly replaceSlot?: number }`, and right after the `fitPatch` dispatch add `if (chosenMacro) dispatch(takeRewardMacro(chosenMacro));`. It must run **before** `advanceGauntlet`, so the Pit Stop shows the new macro.
- Pass `macroRack={run?.macros ?? [null, null, null]}` to `<BattleReport>` (around line 1210).

### Tests (write these first)

1. `src/engine/run/macroRewards.test.ts`: three distinct ids; all in `BATTLE_MACRO_IDS`; never `ping_sweep`; same seed → same three; 50 seeds cover at least 8 different macros.
2. `src/engine/run/fightBonus.test.ts`: gym with gauntlet at `fightIndex` 0 → `'macro'`, 1 → `'macro'`, 2 (of 3) → `null`; gym with `gauntlet: null` → `null`; elite → `'patch'`; ambush → `'patch'`; wild → `null`.
3. `RewardSystem` tests (find the existing test file for `rollDropTable`): `nodeKind: 'gym', bonus: 'macro'` → 3 `macroChoices`, 0 scrap, no cards. A wild with `bonus: 'macro'` returns the same scrap, blueprints and card choices as the same wild with no bonus (compare with `macroChoices` removed) — the new fork does not shift anything. An elite with no `bonus` passed still gets `patchChoices` (the default is unchanged).
4. `src/ui/store/runSlice.macros.test.ts`: `takeRewardMacro` fills the first free slot; with a full rack and `replaceSlot: 1` it replaces slot 1 only; full rack and no `replaceSlot` → unchanged; unknown id → unchanged.
5. `runLogMiddleware.test.ts`: `takeRewardMacro` records `MACRO_WON` with `replaced: null` on a free slot and the dropped id on a replace.
6. A jsdom test for `BattleReport` (copy the setup in `BattleReport.skip.test.tsx`): a bundle with `macroChoices` shows three buttons; clicking one and then Continue calls `onContinue` with `{ macroId }` as the 4th argument; with `macroRack` full the drop row appears only after a macro is picked; Continue with nothing picked passes `undefined`.

### Verify by eye

Reach a gym (debug save or scenario is fine), win fight 1, take a macro, and check it is on the Pit Stop's rack. Screenshot the reward screen at 1280×720 with a full rack and the drop row open.

**Commit:** message starts `feat(gauntlet): win a macro after gauntlet fights 1 and 2 (166d)`.

---

## 166e — Only an elite in the final biome pays a patch; everything else that paid one pays a macro

**What Henry asked.** *"There should be no patch limit. Just reduce the number of patch rewards offered. They felt very OP so make it only on the last elite you can win one. The others should give extra scrap or maybe a macro instead."* And in his review answers: *"The OS patches feel very over powered. You should probably only have 1 or two by the end."*

**Do not add any cap on how many patches a party can hold.** `PATCH_SLOTS` (one per body) stays exactly as it is. This row only changes **which fights offer one**.

### Where patches come from today (three doors)

1. **Every elite and every ambush** (`rollDropTable`, `paysDriver(nodeKind) ? { patchChoices: elitePatchOffer(party) }`). A normal route passes three or more elites, so this door alone can fill all three bodies — which is exactly what happened on 09-26: Splitter at fight 3 (biome 0 elite), Amplifier at fight 7 (biome 1 elite), Amplifier at fight 9 (biome 2 elite).
2. **The gym gate** (`PatchBench venue="gate"` in `GauntletNode.tsx`). Its heading says *"THE GATE — A PATCH FOR ONE BODY"*, but nothing enforces "one": every body without a patch gets its own free rows, so a party that arrives unpatched can take **three** free patches there. On 09-26 it offered nothing only because the elites had already filled every slot. Once the elites stop paying, this door would hand out what they used to.
3. **The shop** stocks Amplifier for 45 scrap (`SHOP_PATCH_PRICE`). Not changed here.

Two smaller defects in door 1, fixed in this row because they are the same lines:

- `elitePatchOffer(party)` is called without the second argument (`held`), so a body that already has a patch is still offered one; `fitPatch` then silently refuses it. That is a dead row on the reward screen.
- If every body is already patched, the "last elite" pays nothing extra at all.

### The change (Henry's rulings E1–E3 are at the bottom of this row)

**1. `src/engine/run/fightBonus.ts`** — replace the last two lines of `fightBonusFor` (the `elite || ambush → 'patch'` line and `return null`) with:

```ts
// TICKET 166e (Henry, 2026-09-27): "only on the last elite you can win one. The others should
// give extra scrap or maybe a macro instead." The last elite is any elite in the FINAL biome -
// the one whose exit is the gym (decision E3). Ambushes and earlier elites pay the macro pick (E1).
if (input.nodeKind === 'elite' && input.biomeIndex === input.biomeCount - 1) return 'patch';
if (input.nodeKind === 'elite' || input.nodeKind === 'ambush') return 'macro';
return null;
```

**The Driver is not touched.** Elites and ambushes still pay their Driver stake exactly as before (`paysDriver`, `driverStake`). Only the patch moves.

**2. `src/engine/RewardSystem.ts`, `rollDropTable`:**

- Add `readonly heldPatches?: Readonly<Record<string, ReadonlyArray<string>>>;` to `IRewardRollInput` (the run's `patches`; default `{}`).
- Change the default for `bonus` when it is not passed from `paysDriver(nodeKind) ? 'patch' : null` to **`null`**. From this row on every real caller passes it (BattleArena since 166d, the walker below), and a debug scenario with no run has no biome to decide "final" from.
- Replace the two bonus spreads at the end with:

  ```ts
  const patchOffers = bonus === 'patch' ? elitePatchOffer(party, heldPatches) : [];
  // An empty patch offer (every body already patched) pays the macro pick instead, so the
  // final elite is never a prize with nothing in it.
  const paysMacro = bonus === 'macro' || (bonus === 'patch' && patchOffers.length === 0);
  ```

  and in the returned object `...(patchOffers.length > 0 ? { patchChoices: patchOffers } : {}),` and `...(paysMacro ? { macroChoices: rollMacroChoices(seed) } : {}),`.
- Rewrite the 163d comment above that spread (*"RE-POINTED AT THE DRIVER by the 2026-09-24 merge"*): the patch no longer follows `paysDriver`; it follows `fightBonusFor`, which since 166e pays it only at an elite in the final biome. Quote Henry. If `paysDriver` is now unused in this file, remove the import.

**3. `src/ui/components/BattleArena.tsx`:** pass `heldPatches: run?.patches ?? {}` to `rollDropTable` beside `bonus`.

**4. The gate gives ONE patch per visit (decision E2).**

- `src/engine/runTypes.ts`: add to `IRunState`, right after `upgradesTaken`:

  ```ts
  /**
   * TICKET 166e — which gate patch benches have been used, as `patch:nodeId:visitCount` keys.
   * The gate's heading has always said "A PATCH FOR ONE BODY"; before 166e nothing enforced it.
   * Optional with `.default([])`, the `upgradesTaken` precedent.
   */
  readonly patchBenchesUsed?: ReadonlyArray<string>;
  ```

  and to `RunStateSchema`, after `upgradesTaken: z.array(z.string()).default([]),`: `patchBenchesUsed: z.array(z.string()).default([]),`. Look at what `createRun.ts` does for `upgradesTaken` and do exactly the same for this field (if it sets `upgradesTaken: []`, set `patchBenchesUsed: []`; if it leaves it out, leave this out).
- `runSlice.fitPatch`: accept `benchKey?: string` in the payload. If `benchKey` is given and `(run.patchBenchesUsed ?? []).includes(benchKey)`, refuse (return `{ run }`). On success, when `benchKey` is given, also set `patchBenchesUsed: [...(run.patchBenchesUsed ?? []), benchKey]`. Update the reducer's doc comment.
- `PatchBench.tsx`: add an optional prop `benchKey?: string`. When `venue === 'gate'` and `benchKey` is in `run.patchBenchesUsed`, render the panel with the line `Patch fitted — the gate offers one.` and no rows. Pass `benchKey` in the gate's `fitPatch` dispatch. The shop venue ignores `benchKey` entirely.
- `GauntletNode.tsx` (around line 313): `<PatchBench run={run} ranch={ranch} venue="gate" benchKey={\`patch:${node.id}:${node.visited}\`} />`.

**5. The balance walker, `src/debug/balance/runWalker.ts`:**

- In `takeRewards` (around line 737), pass the same two inputs the game passes:
  `bonus: fightBonusFor({ nodeKind: node.kind, biomeIndex: node.biomeIndex, biomeCount: run.biomes.length, gauntlet: null }),`
  `heldPatches: run.patches ?? {},`
- The walker has no macro policy (it never fires macros), so leave `macroChoices` unclaimed and add a one-line comment saying so. This means macros won from elites and the gauntlet do **not** show up in walker numbers — say this in the report.
- At the gym gate (around line 868), take only the first fit: `for (const fit of choosePatches(partyMembers(), runNow().patches ?? {}, 'gate').slice(0, 1))`. Do not change `choosePatches` itself (its tests describe the per-body offer, which is still what the gate shows).

### Tests (write these first)

1. `fightBonus.test.ts`: elite at `biomeIndex` 2 of 3 → `'patch'`; elite at 0 and 1 → `'macro'`; ambush at 0, 1 and 2 → `'macro'`. Update the two 166d expectations that said elite/ambush → `'patch'`.
2. `RewardSystem` tests: `bonus: 'patch'` with `heldPatches` naming one member offers the other two only; with every member held → no `patchChoices` and 3 `macroChoices`; no `bonus` passed → neither. Update the 166d test that relied on the old default.
3. `runSlice.patches.test.ts`: two `fitPatch` calls with the same `benchKey` on two different bodies → only the first is fitted; without a `benchKey` (the elite reward path) nothing changes.
4. A jsdom test for `PatchBench` at the gate: fit one → the rows are replaced by the "offers one" line.
5. `runWalker.test.ts` still passes; if a test there counted three gate patches, **stop and report** rather than editing it.

### Measure

`npm run balance:walk` on the parent and on this commit, same seeds. Report, for runs that reach the gym: **patches held at the gym (mean and the distribution 0/1/2/3)**, before and after, and the gym clear rate. Henry's target is "1 or 2 by the end". Report what it is; do not tune.

**Commit:** message starts `feat(run): only a final-biome elite pays a patch; the gate fits one (166e)`, and says it moves the balance numbers.

### Henry's rulings (2026-09-27)

- **E1 — the other elites and ambushes pay the 166d macro pick** instead of the patch. Henry: *"Macro is good."* (The +15 scrap alternative is not built.)
- **E2 — the gym gate gives one free patch in total**, not one per body. Henry: *"One free patch."*
- **E3 — "the last elite" is any elite in the final biome** (`node.biomeIndex === run.biomes.length - 1`). Henry: *"The elite in the final biome."* That includes the scout elite and any other elite rolled into that biome.

---

## 166f — Fix the AI's beam bug, and give the gym a beam

**What Henry asked (2026-09-27).** *"For the boss fight slowdown, lets first try to fix the search bug and narrow the gym's search. If that doesn't help then add a 'thinking' indicator and cap the thinking time with like 5 or 10 seconds."*

**Build after 166a.** 166a moves the search into a Web Worker; this row makes wild and elite enemies think longer (see the numbers), and without 166a that extra time would be a frozen screen.

### The bug (code review finding A1, 2026-09-26)

`src/engine/ai/TacticalAI.ts`, inside `findBestSequence`, around line 592:

```ts
explore = [...deferred].sort((a, b) => b.immediate - a.immediate).slice(0, BEAM);
```

`BEAM` is the **process default**, which is 0 in the game. The battle's own width is the local variable `beam` a few lines above (`const beam = beamFor(state);`). So whenever a node below the root has more candidate plays than the width, the search keeps **zero** of them instead of the best 8. Every wild and elite enemy has been searching about one play deep since ticket 144. The gym is not affected, because it is beamless (`ENEMY_LADDER.gauntlet.beam: 0`), and that is why the boss is so slow.

### What the fix does, measured (`scratch/bossbeam.ts`, committed with this row)

Same states, timed at each width, and compared with the beamless search's move. Cloud container; Henry's machine will differ, but the shape will not.

| Fight | Search | Typical decision | Slowest 5% | Same move as the full search |
|---|---|---|---|---|
| **Boss** (Rootfall fight 3) | beamless — **today's gym** | 10.8 s | **43.4 s** | 15/15 |
| Boss | beam 8, **fixed** | 2.5 s | 4.8 s | **14/15** |
| Boss | beam 4, fixed | 1.4 s | 3.8 s | 13/15 |
| Boss | beam 8 with the bug (today's wilds and elites) | 0.3 s | 3.2 s | 2/15 |
| Elite-grade AI, 3v3 | beam 8 with the bug — **today** | 0.1 s | 0.9 s | 7/18 |
| Elite-grade AI, 3v3 | beam 8, **fixed** | 0.8 s | 2.8 s | **18/18** |
| Wild-grade AI, 3v3 | beam 8 with the bug — **today** | 0.05 s | 0.3 s | 9/18 |
| Wild-grade AI, 3v3 | beam 8, **fixed** | 0.3 s | 2.3 s | **18/18** |

What that means:

1. **Boss:** beam 8 with the fix plays the full search's move 14 times in 15 and cuts the worst wait from 43 s to about 5 s.
2. **Wilds and elites get much smarter.** Today they play the full search's move only 7–9 times in 18; fixed, 18 in 18. They also think longer (up to about 2–3 s on a hard 3v3 turn), which is why 166a must land first.
3. **The run will get harder.** Every walker number since ticket 144 measured the bug. The run gate did not: it plays wild and elite cells beamless (code review B3), which the fix now matches almost exactly.

### The change

1. **`src/engine/ai/TacticalAI.ts`.** Move the selection into a small exported pure function, and fix it there. Add, above `findBestSequence`:

   ```ts
   /**
    * TICKET 166f (code review A1): keep the `beam` best candidates by immediate score, then put them
    * back in enumeration order (so ties still go to the first line visited - see the note at the
    * call site). `beam` is the BATTLE's width. It used to read the process default `BEAM`, which is
    * 0 in the game, so every beamed search below the root kept nothing and stopped one play deep.
    */
   export function pruneToBeam<T extends { readonly immediate: number; readonly order: number }>(
       deferred: ReadonlyArray<T>,
       beam: number,
   ): T[] {
       if (deferred.length <= beam) return [...deferred];
       const kept = [...deferred].sort((a, b) => b.immediate - a.immediate).slice(0, beam);
       return kept.sort((a, b) => a.order - b.order);
   }
   ```

   Then in `findBestSequence`, replace the two lines

   ```ts
   explore = [...deferred].sort((a, b) => b.immediate - a.immediate).slice(0, BEAM);
   explore.sort((a, b) => a.order - b.order);
   ```

   with `explore = pruneToBeam(deferred, beam);`. Keep the long comment above them and the `census.pruned` line exactly as they are. **Change nothing else in this file.**

2. **`src/engine/run/encounter.ts`, `ENEMY_LADDER.gauntlet`:** change `beam: 0` to `beam: GAME_BEAM_WIDTH`, and replace the comment above that line (*"The gym. Beamless: the boss is the one fight worth the full search…"*) with:

   ```ts
   // The gym. Beam 8 since ticket 166f (Henry, 2026-09-27: "lets first try to fix the search bug and
   // narrow the gym's search"). The 09-06 ruling made it beamless because beam 8 measured ~12.5
   // points weaker - but that measurement ran on bug A1, which searched one play deep. Fixed, beam 8
   // plays the full search's move 14 times in 15 on the Rootfall boss, and its slowest decision
   // drops from ~43 s to ~5 s (scratch/bossbeam.ts).
   ```

   Check how `GAME_BEAM_WIDTH` is already imported in that file (the `wild` and `elite` rows use it) and use the same name.

3. **`src/engine/ai/beamDefault.test.ts`:** the test `'wild and elite get the beam; the GAUNTLET is beamless'` pins the old ruling. Rename it to `'every rung gets the beam, the gauntlet included (166f)'`, change `expect(ENEMY_LADDER.gauntlet.beam).toBe(0)` to `.toBe(GAME_BEAM_WIDTH)`, and keep Henry's 09-06 quote but add the 09-27 one below it with one line saying why the ruling changed (the 12.5 points were measured on the bug). In `'a real WILD fight carries 8 and a real GYM fight carries 0 — end to end'`, change the gym expectation to `GAME_BEAM_WIDTH` and the test name to match. Update the describe title `'the boss thinks at full depth'` to `'the boss thinks at beam 8'`.

4. **Search the rest of `src` for anything else that pins the gym at beamless** — `grep -rn "beam: 0\|aiBeam).toBe(0)\|beamless" src --include=*.ts` — and list every hit in the report. Change only tests that assert the gauntlet ladder row or a gym encounter's `aiBeam`. **Do not** change `resolveBeam` or the process default (still 0: harnesses must stay beamless unless they ask; ticket 108's rule).

### Tests (write these first)

`src/engine/ai/pruneToBeam.test.ts` (new):

1. Five candidates with immediate scores `[3, 9, 1, 7, 5]` and orders `[0, 1, 2, 3, 4]`, beam 2 → returns the items with scores 9 and 7, **in order 1 then 3**.
2. Beam 3 on the same list → scores 9, 7, 5 in order 1, 3, 4.
3. Beam larger than the list → the whole list, unchanged order.
4. Beam equal to the list length → the whole list.

These fail on the parent because the function does not exist. Also run `beamDefault.test.ts` after step 3, and the whole gate.

### Measure (required, and report every number)

1. `npx vite-node scratch/bossbeam.ts -- --fight 2 --seeds 3 --per 5 --tier full --widths 8,4,0` on your commit. Report the table. The beam-8 row should look like the one above.
2. **The walker, before and after this commit, same seeds:** the per-node wild/elite win rates for biomes 0–1 (the same read as the post-164 one: 60 seeds × 12 starters, fights ≤ 6) and the full-run gym clear rate. Henry's ruled wild floor is 85% per node. **Expect it to drop.** Report it; do not tune anything.
3. After Henry has played a boss fight on this build, record how long its slowest turn felt.

**Commit:** `pruneToBeam` + test, the ladder change, the test updates, `scratch/bossbeam.ts`. Message starts `fix(ai): beamed search keeps the battle's width, and the gym searches at beam 8 (166f)`. Say plainly in the body that this makes every wild and elite smarter and moves the balance numbers.

### Only if this is not enough: 166g, the thinking indicator and a time cap

Henry ruled the fallback in advance: *"If that doesn't help then add a 'thinking' indicator and cap the thinking time with like 5 or 10 seconds."* **Do not build it in this ticket.** Build it only if Henry says the boss still feels slow after playing 166f, or if step 1 above shows any beam-8 boss decision over 5,000 ms. Then stop and tell Henry the number, and he picks 5 s or 10 s. The shape, so it is ready:

- **Indicator:** in `BattleArena.tsx`, if an enemy decision has not come back within 1,500 ms of the search starting, show a small "Enemy is thinking…" label under the enemy turn banner; hide it when the action dispatches. Time-based state lives in `BattleArena`, not the engine.
- **Cap:** `getBestAction(state, { deadlineMs })`. When a deadline is given, `findBestSequence` checks `performance.now()` at the top of its candidate loop and stops expanding once past it; the root returns the best line found so far. **Only the game's worker path passes a deadline.** Every sim, harness and test calls it without one, so they stay deterministic. A capped decision is time-dependent by design; say so in the code.

---

## Not in this ticket

- **The shop's Amplifier (45 scrap)** is left as it is. If patches still feel strong after 166e, the shop is the remaining door.

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`d1a509f..3fc6447`), merged to `main` in PR #13.
