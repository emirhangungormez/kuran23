import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.tmp',
    'tmp_constants.js',
    'tmp_portalconfig.js',
    'tmp_mushaf_css/**',
    'tmp_mushaf_js/**',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['src/context/**/*.jsx', 'src/contexts/**/*.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/utils/security.js', 'src/utils/tafsirFormatting.js', 'src/utils/textEncoding.js'],
    rules: {
      'no-control-regex': 'off',
      'no-misleading-character-class': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: [
      'src/context/PlaylistsContext.jsx',
      'src/contexts/BookmarksContext.jsx',
    ],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: [
      'src/contexts/BookmarksContext.jsx',
      'src/pages/HomePage.jsx',
      'src/pages/SurahPage.jsx',
      'src/pages/VersePage.jsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
