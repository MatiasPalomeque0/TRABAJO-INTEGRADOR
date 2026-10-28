// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // TechFix intentionally loads remote data inside effects; the calls are async and state updates occur after await.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
