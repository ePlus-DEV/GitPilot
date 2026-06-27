# GitPilot

GitPilot is a desktop Git GUI client built with Tauri v2, Rust, React, TypeScript, Tailwind CSS, Zustand, and Monaco Editor.

## Features

- Repository management with validation, current branch display, and recent repositories.
- Git status from `git status --porcelain=v1 -b` grouped as staged, unstaged, untracked, and conflicted.
- Stage, unstage, discard, delete untracked files, stage all, and unstage all.
- Monaco side-by-side and inline diff viewer with binary-file handling.
- Commit staged files, amend last commit, and generate command output.
- Branch, remote, history, graph, merge, rebase, stash, tag, validation, AI assistant, settings, and keyboard shortcut support.
- 3-pane merge conflict resolver with conflict marker parsing and save + git add workflow.

## Install

```bash
npm install
```

## Run development app

```bash
npm run tauri dev
```

## Build desktop app

```bash
npm run tauri build
```

## Architecture

Rust commands live in `src-tauri/src/commands`, shared services in `src-tauri/src/services`, and serialized models in `src-tauri/src/models`. The backend uses native Git CLI through `std::process::Command` with argument arrays; shell strings are not used for Git operations.

React UI lives in `src/components`, state in `src/store/gitStore.ts`, IPC services in `src/services/gitService.ts`, and shared TypeScript types in `src/types/git.ts`.

## GitPilot feature coverage

GitPilot now includes first-pass production workflows for the highest-priority Git operations:

- Visual conflict resolution parses conflict markers, presents current/incoming/result panes, supports accept-current, accept-incoming, accept-both, manual edits, and stages files after all markers are removed.
- Rebase tooling supports normal rebase, paused-state detection, continue, abort, skip, and an interactive todo editor for pick, reword, edit, squash, fixup, drop, and reorder operations.
- Cherry-pick commands support applying a selected commit and aborting an in-progress cherry-pick so conflicts can route through the same resolver.
- Stash management supports list, push, apply, pop, drop, and rename from the stash panel.
- Productivity primitives are available for blame, fuzzy smart search, and worktree list/create/remove commands.

Some larger roadmap items, such as provider-backed pull-request review, CI aggregation, enterprise telemetry, and release signing, are intentionally exposed as modular command/service seams for follow-up hardening rather than hard-coded into the UI.
