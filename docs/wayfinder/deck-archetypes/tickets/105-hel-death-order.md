# Hel death-order bug + the 999 sentinel leak (ticket 105): P0 correctness

- Type: wayfinder:task - P0 from playtest round 3. Branch archetype-web.
- Status: **open**

Two findings from Henry's hel_v2 game (snapshot t5-17820999, turn 5):

1. **'I died first yet still got the victory.'** Simultaneous-death / lethal-ordering
   defect: reproduce from the snapshot, name the resolution order (self-damage cast ->
   enemy death -> own death?), and pin the intended rule with Henry if ambiguous. A game
   where the dead win is a correctness bug at any rate of occurrence.
2. **Last Rites displayed 'costs 999 energy/HP' at 23 HP.** That is the 0-COSTHOOK-BLOCK
   sentinel (a cost the frame cannot pay) leaking raw into the UI. Replace with a proper
   disabled state + reason ('would exceed your remaining HP' / 'blood budget spent this
   turn'). Grep for other sentinel leaks while there.

Design answer recorded for Henry: yes - the block fires when the HP cost cannot be paid
(lethal or over the 20%/turn budget); the UI just failed to say so. Gates: repro test for
the death ordering, UI state for the sentinel, suite green. ONE commit.
