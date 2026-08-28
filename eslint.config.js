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
  // TICKET 42: `desktop/app` is a COPY of `dist` and `desktop/release` is the packaged Electron
  // build. Both are generated, both contain minified bundles, and `dist` is ignored above for
  // exactly the same reason — they are only listed separately because the pattern is a path.
  globalIgnores(['dist', 'scratch', 'desktop/app', 'desktop/release']),
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
    rules: {
      /*
       * TICKET 55, STEP 2. An underscore means "this parameter is part of the signature and this
       * implementation does not need it" — and 71 of the 141 `no-unused-vars` errors were exactly
       * that, already written with the prefix by whoever wrote them.
       *
       * `StatusBehaviors.ts` (35) and `ActionExecutors.ts` (36) are the whole argument. Every
       * behaviour implements one interface, so `onApply(_source, _target, _power)` has to accept
       * three arguments whether or not Burn cares about the source. Deleting the parameters is
       * impossible (position is meaning), renaming them loses what they are, and `void _source` at
       * the top of eleven functions is noise that exists solely to satisfy a linter. The convention
       * is already in the code; this teaches the linter to read it.
       *
       * `ignoreRestSiblings` is on for one idiom the codebase uses deliberately and cannot write any
       * other way: `const { nextProgramModifier, ...rest } = e` is how `battleReducer` STRIPS a
       * field from an entity. The binding exists precisely so the value is left behind, and it has
       * to carry the real property name — an underscore would change which field is removed.
       *
       * Deliberately NOT a blanket downgrade: an unused *local* is still an error unless it is
       * named with a leading underscore, which keeps the rule doing the job it is here for.
       */
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
])
