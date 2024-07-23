const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node, // Add Node.js globals
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
]
