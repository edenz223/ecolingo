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
      bundler: 'builder',
      builder: {
        appId: 'com.edenz223.ecolingo',
        artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
        // Releases are uploaded by .github/workflows/release.yml.
        publish: null,
        win: {
          target: [{ target: 'portable', arch: ['x64'] }],
          icon: 'src-electron/icons/icon.ico',
        },
        mac: {
          target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
          icon: 'src-electron/icons/icon.icns',
          category: 'public.app-category.education',
          // No Developer ID yet: ad-hoc sign so Apple Silicon will launch it.
          identity: '-',
          hardenedRuntime: false,
          extendInfo: {
            NSMicrophoneUsageDescription: 'EcoLingo 需要使用麦克风录制跟读。',
          },
        },
        linux: {
          target: [{ target: 'AppImage', arch: ['x64'] }],
          icon: 'src-electron/icons/icon.png',
          category: 'Education',
        },
      },
    },
  };
});
