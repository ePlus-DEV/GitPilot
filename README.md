# GitPilot

GitPilot is a dark-mode-first desktop Git GUI client built with Tauri v2, React, TypeScript, Tailwind CSS, Zustand, Monaco Editor, and a Rust backend.

## Tauri setup commands

```bash
npm install
npm run dev
npm run tauri dev
npm run build
```

## Architecture

- `src-tauri/src/commands`: Tauri command boundary grouped by Git capability.
- `src-tauri/src/services`: safe Git CLI wrapper, conflict parser, and settings model.
- `src-tauri/src/models`: strongly typed serializable Rust models.
- `src/components`: React feature components by UI area.
- `src/store`: Zustand application state.
- `src/services`: typed frontend Tauri API adapter.
- `src/types`: shared frontend Git and conflict parser types.

The backend prefers the native `git` executable for compatibility and uses `std::process::Command` with explicit argument arrays instead of shell strings.

## Roadmap

### Phase 1 — MVP
- Open local repositories and validate `.git`.
- Show status grouped by staged, unstaged, untracked, and conflicted files.
- Stage, unstage, discard, commit, and inspect diffs in Monaco.

### Phase 2 — Collaboration
- Branch create/checkout/rename/delete flows.
- Fetch, pull, push, push-with-upstream.
- Rich command output and authentication error display.

### Phase 3 — Merge safety
- Merge workflow state, conflict detection, abort/continue actions.
- Full 3-pane conflict resolver wired to file IO.
- PHP, JS/TS, and Laravel validation in the bottom console.

### Phase 4 — History power tools
- Visual commit graph and commit detail view.
- Compare commits and read-only checkout.
- Rebase, stash, and tag management.

### Phase 5 — AI assistance
- Provider abstraction for OpenAI, Claude, Gemini, OpenRouter, and Ollama.
- Explain diffs, generate commit messages, suggest branches, and propose conflict resolutions.
- Require explicit user confirmation before applying AI suggestions.
