# EcoLingo agent guide

## Product and scope

EcoLingo is a desktop language-learning app for practicing shadowing with local audio and timed transcripts. The core workflow is to open a lesson folder, listen to a sentence, repeat it aloud during the shadowing interval, and replay the learner's recording.

Prioritize accurate sentence timing, reliable playback and recording, readable transcripts, and quick keyboard navigation. Keep the core workflow local and usable without an account or network connection. Add cloud services, speech assessment, or recording uploads only when requested.

## Stack and code map

- Vue 3 with JavaScript and Composition API (`<script setup>`), Quasar 2, and Quasar CLI with Vite.
- Electron provides the desktop window, native folder picker, and filesystem access.
- Howler handles lesson playback; browser `MediaRecorder` and `getUserMedia` handle microphone recording.
- `src/layouts/MainLayout.vue`: active learning interface, `Player` class, SRT parsing, shortcuts, shadowing, and recording lifecycle. Start here for playback changes.
- `src/utils/lyrics-util.js`: LRC parsing into sentence objects.
- `src-electron/electron-main.js`: window configuration, menus, and IPC handlers.
- `src-electron/electron-preload.js`: `window.fileAPI` bridge (`openFolder`, `onFolderSelected`, `readTextFile`).
- `src-electron/fileSystem.js`: audio/transcript pairing and transcript encoding detection with `jschardet`.
- `src/router/`: routes; `src/pages/IndexPage.vue` is still a starter page, not the learning interface.
- `src/css/`: shared styles and Quasar theme variables.
- `resources/`: sample audio and LRC files for manual checks.
- `quasar.config.js`: build and Electron packaging configuration.

Check imports before editing `src-electron/player.js`; the active player implementation is in `MainLayout.vue`.

## Development commands

Use the scripts in `package.json` as the source of truth; the README still contains generic Quasar starter instructions.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies when needed |
| `npm run dev` | Launch Quasar in Electron development mode |
| `npm run lint` | Run ESLint on JavaScript and Vue files |
| `npm run build` | Build and package the Electron app |
| `npm run format` | Format the entire repository; prefer targeting changed files |
| `npm test` | Placeholder only; does not run a test suite |

`package.json` declares Node 16/18/20 support, while the Quasar build targets Node 20. Match the project's configured runtime when diagnosing compatibility; do not upgrade the stack as part of unrelated work.

Both `package-lock.json` and `yarn.lock` exist. Follow the package manager used for the task and avoid incidental lockfile changes. Do not delete or regenerate either lockfile merely to standardize tooling.

## Implementation conventions

- Keep changes focused and preserve unrelated user edits. Avoid whole-file formatting of existing code.
- Follow `.editorconfig`, `.prettierrc`, and `.eslintrc.cjs`: two-space indentation, LF, semicolons, and single quotes in formatted JavaScript.
- Reuse Quasar components and existing visual conventions. Give icon controls accessible names and keep focus and keyboard behavior usable.
- Keep filesystem operations in the Electron main process and expose narrowly scoped operations through the preload bridge. Do not expose raw IPC or Node APIs to the renderer.
- Preserve `contextIsolation` and sandboxing. The current window sets `webSecurity: false`; treat this as existing technical debt, not a pattern to extend. Verify local audio loading when changing this setting.
- As playback work grows, extract cohesive parsing or lifecycle logic into utilities or Vue composables instead of adding more unrelated responsibilities to `MainLayout.vue`. Avoid broad rewrites for small fixes.
- Do not hand-edit generated files in `.quasar/`, `dist/`, or `node_modules/`.

## Lesson and timing rules

- Lessons pair audio and transcript files by basename. Recognized audio extensions are MP3, WAV, OGG, AAC, FLAC, and M4A; transcripts use LRC or SRT. Preserve existing formats when extending import behavior.
- Sentence objects use `{ start, end, text }`, with times in seconds. LRC parsing derives each end from the next start; the player currently fills the final sentence end from audio duration.
- Preserve Unicode, multilingual text, and encoding detection. Render imported transcripts as text rather than executable HTML.
- When changing import or parsing, handle empty files, malformed timestamps, missing pairs, inaccessible paths, and filenames with spaces or non-Latin characters. Surface actionable errors without crashing playback.
- Keep highlighting, seeking, repeat-one behavior, and shadowing aligned with the audio clock. Account for playback speed when converting sentence duration into recording timers.
- Cancel stale asynchronous work on lesson changes so an earlier file load or microphone request cannot overwrite the active session.
- Sentence transitions use a single 20 ms timer reading the audio clock, with an audio-end callback for the final sentence. Keep them independent of animation frames and transcript scrolling. Electron background throttling is disabled so minimized windows can continue shadowing; this does not prevent system sleep.

## Playback and recording rules

- Preserve the listen-then-shadow cycle: play the reference sentence, pause reference audio, wait 500 ms, then record; advance or repeat only after MediaRecorder's final stop event. `src/utils/voice-activity.js` uses local Web Audio RMS detection with a low-noise adaptive threshold: 120 ms of speech (including brief single words), 1.2 seconds trailing silence, and up to 8 seconds to start speaking. The recording limit is a fixed 10 seconds starting when recording actually begins; this also bounds the no-speech wait. No-speech pauses without saving. Takes finish automatically on trailing silence or the sentence time limit; there is no manual completion button. The recording microphone floats at the bottom center above the footer: it starts red, then turns green with outward-diffusing green particles while the local detector receives voice activity; respect reduced-motion preferences. There is no REC badge or visible status text. Sentence recording-preview buttons are hidden while recording. No-speech uses the same floating position with an amber mic-off icon and a brief amber particle diffusion for one second, without a popup, while playback stays paused; navigation or retry clears it; other microphone and recording errors use a persistent dialog dismissed with its Close button; playback shortcuts are disabled while it is open. Space still cancels/pauses. Recording timing is independent of audio-end events and scrolling.
- After building, run `node_modules/.bin/electron.cmd tests/learning-ui-smoke.cjs` for an isolated, muted built-UI check of the empty state, progress, click menus, follow control, and preview toggle using sample files. This uses no real microphone or user recordings.
- Recording feedback uses a 60 px floating disc with a soft red breathing ring, green ripples and small staggered particles during speech, and a single amber diffusion on no-speech timeout. Entry and exit fade gently; reduced-motion disables transitions and looping effects.
- Run `node --test tests/voice-activity.test.cjs` for detector and playback/recording lifecycle regression checks. Run `node_modules/.bin/electron.cmd tests/voice-activity-smoke.cjs` for a hidden Chromium synthetic-audio check; neither substitutes for real microphone testing.
- Ensure pause, seek, sentence navigation, lesson switching, and disabling shadowing leave playback and recording in a consistent state. Avoid overlapping reference audio and recording previews.
- Request microphone access through an explicit learning action, show recording state clearly, and handle denied permission or missing devices gracefully.
- Stop media tracks, unload replaced sounds, cancel timers/animation loops, remove listeners, and revoke object URLs when their owning session ends.
- Completed recordings are persisted by `src-electron/recording-store.cjs` under Electron `userData/recordings`: audio files plus `index.sqlite` (sql.js). Each take has a UUID; lesson identity hashes audio and transcript contents so moving a folder preserves associations. The lesson list remains in `localStorage`; object URLs are temporary previews only.
- The top toolbar keeps Open Course, recording history, and a More menu. More contains ZIP backup export/merge restore (SQLite plus audio, versioned and checksum-validated, 512 MB limit), and current-lesson WAV export (latest take per sentence in chronological order, mono 24 kHz, 30-minute limit). WAV is listening-only; restore uses ZIP. Original lesson files are not included in recording backups and must be kept separately.
- Store operations remain in Electron main through narrow preload methods. Write audio before atomically replacing the index; never extract arbitrary archive paths. Run `npm run test:recordings` for persistence, merge, rollback and lesson-identity regression coverage.
- When changing recording storage, associate clips with both lesson identity and sentence identity. A timestamp alone can collide across lessons.
- Playback preferences (volume, mute, speed, shadowing, repeat-one, and course drawer state) are saved immediately in localStorage under ecolingo.settings.v1 through src/utils/settings.js. Restore preferences without requesting microphone access at startup. Run node --test tests/settings.test.cjs for validation and storage failure coverage.
- Keep learner audio local unless an explicitly requested feature requires otherwise.
- The learning view offers a folder-opening empty state and a sticky course title/sentence counter. Automatic scrolling centers sentence transitions; wheel, touch, navigation keys, or scrollbar dragging pause following until “回到当前句” is clicked. The footer uses a labeled shadowing toggle and click-open volume/speed menus. Recording previews toggle between play and stop, highlight their sentence, and cancel pending loads when stopped. Controls and native menus use Chinese, with shortcuts under Help.
- The footer emphasizes previous sentence, play/pause, and next sentence; lesson selection is in the course drawer. Sentence rows reserve a fixed action slot for the microphone or recording preview and use one pale-blue active highlight without recording-history background colors.
- Preserve existing shortcuts unless the task changes them: Space play/pause; S shadowing; A/D previous/next sentence; Q/E previous/next lesson; C/X increase/decrease speed; Z reset speed; M mute.
- Shortcut handlers should ignore editable controls, preserve normal focus behavior, and prevent default actions only for shortcuts they handle. Guard controls when no lesson is loaded.

## Validation and delivery

For code changes, run `npm run lint`. Run `npm run build` for changes affecting runtime behavior, dependencies, Electron, or packaging. For documentation-only changes, review the content and diff; an application build is unnecessary.

`npm test` remains a placeholder. Run `npm run test:recordings` for the focused storage regression suite and `node_modules/.bin/electron tests/recording-audio-smoke.cjs` (use `electron.cmd` on Windows) for real Chromium WAV decoding/merging checks in a hidden window. These checks do not cover microphone permissions or the full desktop workflow. For parser or playback bug fixes, add focused regression coverage when practical and state how it was run.

Manually exercise the affected desktop workflow where possible:

1. Open `resources/` and check matched lessons and the incomplete-lesson warning; also check folder-picker cancellation and an empty folder when touching import code.
2. Play, pause, select sentences, navigate lessons, and verify transcript highlighting near sentence boundaries and the final sentence.
3. Check repeat-one, volume, mute, and playback speeds below and above 1x when changing playback.
4. Enable shadowing, allow microphone access, record a sentence, and replay it. Exercise denied access when changing recording initialization.
5. Seek or switch lessons during recording, disable shadowing, and close/reopen the app when changing lifecycle behavior. Check for stale clips and lingering audio or microphone use.
6. Verify shortcuts and readable transcripts when changing the interface.

Report what changed, which checks ran, and any failures or checks that could not be performed. Do not claim microphone or desktop behavior was verified solely from lint or a successful build. Update this guide when architecture, commands, or the learning workflow change.
