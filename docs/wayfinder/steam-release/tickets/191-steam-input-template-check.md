# Steam Input template check: load it in Steam, confirm Right Shift, re-export (ticket 191)

- Type: wayfinder:task
- Status: open
- Assignee: Henry
- Blocked by: — (needs the Steam desktop app and a controller; no Steam app ID is needed)
- Phase: Steam

## Why this exists

The game ships a controller template for Steam Input: `steam/controller_config/mingming_keyboard_mouse.vdf`. It maps the controller buttons to the keys the game already listens for. **Nobody has ever loaded it into Steam.** Its README says so: *"Before ship: open it in Steam's controller configurator, confirm it loads without a warning, and re-export it from there so the file is one Steam wrote."*

Ticket 190 (first-impressions map, 2026-10-03) added one more line to it: clicking the **right stick** sends **Right Shift**, and holding Right Shift fast-forwards a fight (x3). The key name written in the file is `key_press RIGHT_SHIFT`. The agent that wrote it could not check that Steam accepts that spelling. A wrong name does not show an error in the game: the controller shortcut would just do nothing. The keyboard shortcut is not affected either way (the game tells Left Shift, which aims at your own mingmings, apart from Right Shift).

Henry's rulings (2026-10-02): hold-to-fast-forward is the **Right** Shift; for the controller, *"I don't really care"*, so if Steam cannot send Right Shift the controller binding is dropped and the keyboard shortcut stays.

## Deliverable: how to do the check (about 15 minutes)

Steam's menus move around between versions, so the names below may differ a little. The idea is the same. You need the Steam desktop app signed in, and a controller (any Xbox, PlayStation or Switch pad; a Steam Deck works too).

**Step 1: add something to Steam to hang the layout on.** In Steam, open the **Games** menu, choose **Add a Non-Steam Game to My Library**, press **Browse**, and pick the Mingming desktop build if you have one. For this check any program works (for example Notepad, `C:\Windows\notepad.exe`), because the check is about the key name, not the game. Press **Add Selected Programs**.

**Step 2: open its controller layout.** Plug the controller in. In your Library, right-click the program, choose **Properties**, then **Controller**. If it asks, turn Steam Input **on** for it. Press **Edit Layout** (older versions call it "Controller Layout" or "Configure").

**Step 3: build the one binding by hand.** In the layout editor, find the **right stick click** (it may be called "Right Stick Click", "R3" or the "Click" of the right joystick). Change its binding to a **keyboard** key and pick **Right Shift** from the key list. Note whether **Right Shift** is offered by that exact name. If you can only find "Shift" with no left or right, write that down: it is an answer.

**Step 4: export it and read what Steam wrote.** In the editor choose **Export Layout** (or "Save as template" and then export locally). Steam keeps local exports in a folder called `Steam Controller Configs` under `steamapps\common` in your Steam folder; the export dialog shows the exact place. If you cannot find it, search that Steam folder for `.vdf` files changed in the last hour. Open the file in Notepad and search for `Shift`. You will see a line like `"binding" "key_press SOMETHING"`. **`SOMETHING` is the spelling Steam uses.**

**Step 5 (optional, but it is the whole point of the README note): load our template.** Copy `steam/controller_config/mingming_keyboard_mouse.vdf` into the same folder as your export, then open the layout list (**Browse Configs**, then your local layouts) and select it. Note whether Steam loads it with no warning, and whether the buttons show the names in the README table (A is Enter, X is Space, and so on). If it warns, copy the warning text.

**Step 6: the real test, in a fight.** Launch the game from Steam with Steam Input on (the Mingming desktop build, or the web build in a browser launched from Steam) and start a fight. Hold the right stick click. The fight should run at about three times speed while you hold it and go back to normal when you let go. Also press Left Shift on the keyboard with a card selected: aiming at your own mingmings should still work.

## What to do with the result

- **Same spelling, and the fast-forward works:** done. Save the file Steam exported over `steam/controller_config/mingming_keyboard_mouse.vdf` (the README asks for a file Steam wrote), run `npx vitest run src/ui/steamInputTemplate.test.ts`, and commit it.
- **Steam spells it differently (say `RSHIFT`):** the fix is one line. Change line 81 of the VDF, the matching two lines in `src/ui/steamInputTemplate.test.ts` (around lines 72 and 73), and the README row. Tell an agent: *"Steam spells Right Shift as X"* and it does all three.
- **Steam cannot send Right Shift, or only plain Shift:** drop the controller binding. Remove line 81 of the VDF, the README row ("Right stick click (hold)") and the test lines. The keyboard Right Shift shortcut stays.
- **Steam warns when it loads the file:** paste the warning to an agent. The mapping is the reviewed part; the file format is what has never been checked.

## Also noticed (decide while you are in there)

The README table says the **left stick** does ally targeting *"via the shift layer"* (W/E/R plus Shift). **The VDF has no such layer**: its only modeshift is the Left Grip layer for enemy targeting and the Draughts. So on a controller today you cannot aim at your own mingmings at all. Either an agent adds the layer, or the README row is deleted. That is your call; say which when you report back.

## Done when

The template has been loaded in Steam (or the one binding built by hand), the Right Shift spelling in the repo matches what Steam writes (or the controller binding is dropped), holding the right stick click fast-forwards a real fight (or the binding is dropped), and the VDF in the repo is one that Steam wrote. The README's "What still needs a human" section is updated to say what was done.

## Resolution

_(open)_
