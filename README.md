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


## Test

```bash
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

The Rust test suite exercises repository management, status grouping, staging, diff, commit, branch, remote, history, merge conflict parsing/resolution, rebase commands, stash, tags, validation, AI helpers, and settings persistence.

## Build desktop app

```bash
npm run tauri build
```

## Architecture

Rust commands live in `src-tauri/src/commands`, shared services in `src-tauri/src/services`, and serialized models in `src-tauri/src/models`. The backend uses native Git CLI through `std::process::Command` with argument arrays; shell strings are not used for Git operations.

React UI lives in `src/components`, state in `src/store/gitStore.ts`, IPC services in `src/services/gitService.ts`, and shared TypeScript types in `src/types/git.ts`.
