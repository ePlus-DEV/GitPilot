# GitPilot

A desktop Git GUI client built with Tauri v2 + Rust + React.

## Features

### Repository management

- Recent-repository list with quick switching
- Per-repo auto-fetch interval override (Sidebar › Repositories › ⚙)
- Open, clone, or init repositories from the top bar or native menu
- Tab-based multi-repo interface

### History & commit graph

- Virtualized commit graph with branch lanes, bezier merge curves, and HEAD indicator
- Filter by branch, author, date range, file path, or free-text search
- Dim/hide merge commits toggle; load-more pagination
- Commit details: author `name <email>`, date, SHA, parents — click any field to copy
- Right-click commit: checkout, cherry-pick, rebase, reset (soft/mixed/hard), revert, create branch/tag/worktree, copy SHA, create patch

### Branch management

- Branch switcher with right-click context menu: Pull, Push, Rename, Delete, Copy, Create tag
- Sidebar branch list with full context menu: Checkout, Merge, Rebase, Reset, Push, Pull, Fetch, Delete, Rename
- Correct display of branch names containing dots (e.g. `feature/v1.2.0`)

### Working directory & commits

- Stage, unstage, discard, delete untracked; stage all / unstage all
- Monaco side-by-side and inline diff viewer with binary-file handling
- Commit with message, amend last commit
- Commit is undoable — Undo runs `git reset HEAD~1 --soft`; Redo re-commits

### Undo / Redo

- Dedicated Undo and Redo buttons in the top bar (separate from Refresh)
- 20-entry undo/redo history

### Conflict resolution & rebase

- 3-pane merge conflict resolver (current / incoming / result) with accept-current, accept-incoming, accept-both, and manual edit
- Rebase: start, continue, abort, skip; interactive todo editor for pick, reword, edit, squash, fixup, drop, reorder
- Cherry-pick: apply commit, abort in-progress cherry-pick

### Stash, tags, worktrees

- Stash: list, push, pop, apply, drop
- Tags: list, create lightweight and annotated, delete
- Worktrees: list, create from branch or commit, remove

### AI assistant

- Configurable provider (Ollama, OpenAI, Anthropic, Groq), API key, and model
- Generate commit message from staged diff; explain diff in natural language

### Auto-updates

- **Stable channel**: official releases only
- **Alpha channel**: opt-in in Settings › General › Update Channel for early test builds
- In-app update dialog with download progress and one-click install + relaunch

### Settings

- General: global auto-fetch interval, update channel
- Git: custom git binary path
- AI: provider, API key, model, default target branch
- About: version info

## Download

See [Releases](https://github.com/ePlus-DEV/GitPilot/releases) for the latest build.

## License

[MIT](LICENSE)
