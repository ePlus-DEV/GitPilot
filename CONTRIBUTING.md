# Contributing to GitPilot

## Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand, Monaco Editor
- **Backend**: Tauri v2, Rust (`std::process::Command` — no shell strings for git operations)
- **Build**: Vite

## Setup

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Project layout

```
src/
  components/      React UI components
  store/           Zustand store (gitStore.ts)
  services/        IPC wrappers (gitService.ts)
  types/           Shared TypeScript types (git.ts)
  utils/           Helpers (repoConfig, etc.)

src-tauri/
  src/commands/    Tauri commands exposed to frontend
  src/services/    Rust git service logic
  src/models/      Serde models (git.rs, settings.rs)
```

## Store shape

| Field | Type | Purpose |
| --- | --- | --- |
| `busy` | `boolean` | Any operation in flight |
| `refreshing` | `boolean` | Explicit refresh only (drives Refresh button spinner) |
| `runningOp` | `string \| null` | Label of active operation (drives per-button spinners) |
| `undoStack` | `UndoEntry[]` | Undo history, max 20 entries |
| `redoStack` | `UndoEntry[]` | Redo history |

### `run(label, fn, refreshMode?, undoable?)`

Sets `busy + runningOp`, calls `fn`, optionally pushes to undo stack, then calls `refresh(silent=true)`.

### `refresh(silent?)`

`silent=true` skips the `refreshing` flag so the Refresh button spinner does not fire during background refreshes triggered by `run()`.

## Commit graph virtualization

`GitGraph` uses a `ResizeObserver` attached via a **callback ref** (`useState` + `useCallback`) so the observer re-registers whenever the list DOM element mounts or changes. `svgH = rows.length * ROW_H + ROW_H` adds a one-row buffer so lane lines of the last loaded commit do not clip at the SVG boundary.

## Release process

Tags matching `v*` trigger the GitHub Actions release workflow:

- Detects pre-release from tag suffix (`-alpha`, `-beta`, `-rc`)
- Syncs version from tag into `tauri.conf.json`
- Builds for Windows x64, macOS arm64, macOS x64, Linux
- `includeUpdaterJson: true` on all builds
- Alpha builds push `latest.json` to the permanent `alpha-channel` release via `gh release upload --clobber`

Update channels:

- **Stable**: `releases/latest/download/latest.json`
- **Alpha**: `releases/download/alpha-channel/latest.json`
