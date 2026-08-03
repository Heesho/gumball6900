import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typedSourceFiles = ['**/*.{ts,tsx}'];
const javascriptSourceFiles = ['**/*.{js,mjs,cjs}'];

// The subgraph is AssemblyScript, not TypeScript. `graph build` is its parser and
// static-analysis gate; feeding those sources to TypeScript ESLint is unsound.
const nonEslintSources = [
  'apps/web/**',
  'packages/subgraph/src/**',
  'packages/subgraph/tests/**',
  'packages/subgraph/generated/**',
];

export const baseConfig = [
  {
    name: 'gumball/global-ignores',
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.storybook-cache/**',
      '**/artifacts/**',
      '**/build/**',
      '**/cache/**',
      '**/coverage/**',
      '**/dist/**',
      '**/generated/**',
      '**/out/**',
      '**/playwright-report/**',
      '**/storybook-static/**',
      '**/test-results/**',
      '**/typechain-types/**',
      'packages/contracts/lib/**',
      'packages/contracts/audit/reports/**',
      ...nonEslintSources,
    ],
  },
  {
    ...js.configs.recommended,
    name: 'gumball/javascript-recommended',
    files: javascriptSourceFiles,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended.map((config, index) => ({
    ...config,
    name: `gumball/typescript-recommended-${index + 1}`,
    files: typedSourceFiles,
    ignores: nonEslintSources,
    languageOptions: {
      ...config.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  })),
  {
    name: 'gumball/security-baseline',
    files: [...javascriptSourceFiles, ...typedSourceFiles],
    ignores: nonEslintSources,
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-throw-literal': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-rename': 'error',
      'prefer-const': 'error',
    },
  },
];

export default baseConfig;
