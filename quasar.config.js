/* eslint-env node */

// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js
const { configure } = require('quasar/wrappers');

module.exports = configure(function () {
  return {
    css: ['app.scss'],

    extras: ['material-icons'],

    build: {
      target: {
        // Electron 29 ships Chromium 122.
        browser: ['chrome122'],
        node: 'node20',
      },
      vueRouterMode: 'hash',
    },

    framework: {
      config: {},
      plugins: [],
    },

    animations: [],

    electron: {
      inspectPort: 5858,
      bundler: 'packager',
      packager: {},
    },
  };
});
