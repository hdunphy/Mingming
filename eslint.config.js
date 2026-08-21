import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `scratch/` is 76 one-off measurement scripts, imported by nothing. They stay tracked
  // (ticket 02, Henry's ruling) because six comments in powerscale.ts, cellCache.ts,
  // CustomFirmware.ts and statusCensus.ts cite them as the provenance of live constants —
  // but they are throwaway harnesses, so holding them to the app's lint bar is noise.
  // They accounted for 76 of the 588 problems the tree reported before ticket 03.
  globalIgnores(['dist', 'scratch']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
