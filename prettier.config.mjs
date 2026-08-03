/** @type {import('prettier').Config} */
const config = {
  printWidth: 120,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: 'packages/subgraph/subgraph.yaml',
      options: {
        // Graph CLI rewrites manifest addresses with double quotes during codegen.
        singleQuote: false,
      },
    },
  ],
};

export default config;
