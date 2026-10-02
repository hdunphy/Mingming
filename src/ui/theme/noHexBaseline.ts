/**
 * TICKET 183a — the hex-literal ratchet's baseline: how many `#rrggbb` literals each file still
 * holds. See `noHex.test.ts`. Counts only go DOWN: repaint a screen onto tokens, then lower (or
 * delete) its line here in the same commit. Today's numbers are the count as of 183a; nothing in
 * the kit is listed because the kit holds none.
 */

export const NO_HEX_BASELINE: Readonly<Record<string, number>> = {
    'src/index.css': 141,
    'src/ui/components/AudioControls.tsx': 2,
    'src/ui/components/BattleArena.tsx': 3,
    'src/ui/components/BattleReport.tsx': 26,
    'src/ui/components/BattleStage.tsx': 4,
    'src/ui/components/Callout.css': 2,
    'src/ui/components/ElementMatchupTooltip.tsx': 2,
    'src/ui/components/ErrorBoundary.tsx': 13,
    'src/ui/components/FirmwareTerminal.tsx': 2,
    'src/ui/components/MacroRack.css': 10,
    'src/ui/components/MacroRewardPick.tsx': 8,
    'src/ui/components/MainMenuView.tsx': 8,
    'src/ui/components/MingmingUnit.tsx': 16,
    'src/ui/components/OSGrammarRow.tsx': 1,
    'src/ui/components/PatchHolders.tsx': 1,
    'src/ui/components/PlayedCardReveal.tsx': 2,
    'src/ui/components/ProgramCard.tsx': 3,
    'src/ui/components/RevealCard.tsx': 4,
    'src/ui/components/SaveHealthBanner.tsx': 6,
    'src/ui/components/cardKeywords.ts': 3,
    'src/ui/hooks/useBattleVfx.ts': 9,
    'src/ui/screens/BoundaryAlert.css': 15,
    'src/ui/screens/CardChassis.tsx': 4,
    'src/ui/screens/CardForm.css': 11,
    'src/ui/screens/CodexScreen.css': 3,
    'src/ui/screens/EventNode.css': 8,
    'src/ui/screens/GauntletNode.css': 10,
    'src/ui/screens/LoadoutEditor.css': 7,
    'src/ui/screens/MarketplaceNode.css': 31,
    'src/ui/screens/RanchScreen.css': 23,
    'src/ui/screens/RegionMap.css': 18,
    'src/ui/screens/RegionMap.tsx': 8,
    'src/ui/screens/SettingsScreen.css': 5,
    'src/ui/screens/WorkshopNode.css': 30,
    'src/ui/screens/runShell.css': 74,
    'src/ui/utils/contrastText.ts': 14,
    'src/ui/vfx/statusTells.ts': 1,
};
