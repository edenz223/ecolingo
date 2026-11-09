// https://quasar.dev/quasar-cli-vite/quasar-config-file
import { defineConfig } from '#q-app';

export default defineConfig(() => {
  return {
    css: ['app.scss'],

    extras: ['material-icons'],

    build: {
      target: {
        // Electron 45 ships Chromium 156 and Node 24.
        browser: ['chrome156'],
        node: 'node24',
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
      // Paths below are relative to src-electron/, electron-builder's project folder.
      builder: {
        appId: 'com.edenz223.ecolingo',
        artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
        // Releases are uploaded by .github/workflows/release.yml.
        publish: null,
        win: {
          target: [{ target: 'portable', arch: ['x64'] }],
          icon: 'electron-assets/icons/icon.ico',
        },
        mac: {
          target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
          icon: 'electron-assets/icons/icon.icns',
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
          icon: 'electron-assets/icons/icon.png',
          category: 'Education',
        },
      },
    },
  };
});
