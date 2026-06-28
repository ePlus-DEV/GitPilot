# GitPilot Production Audit and GitKraken-Parity Roadmap

## Executive summary
GitPilot has a promising Tauri/Rust command boundary, a React/Zustand frontend, and broad Git porcelain coverage, but it is not yet production-ready or at GitKraken parity. The strongest areas are local status/staging/commit/history/branch/merge/rebase/stash/tag/worktree primitives and an initial AI service. The main gaps are product depth: credential management, hosted-provider workflows, advanced graph UX, partial hunk staging, robust diff modes, multi-repo workspace semantics, crash/updater/telemetry controls, and performance instrumentation.

This audit added backend contracts for previously missing core Git workflows: clone, init, reflog, submodule status/update, and bisect lifecycle. These are intentionally implemented in Rust/Tauri IPC so frontend screens can remain thin.

## Feature comparison table
| Feature | GitPilot | GitKraken | Status | Gap severity |
|---|---|---|---|---|
| Open existing repo | Yes | Yes | Usable | P3 |
| Clone repository | Backend IPC added; UI pending | Yes | Partial | P1 |
| Init repository | Backend IPC added; UI pending | Yes | Partial | P1 |
| Status/stage/commit/amend | Yes | Yes | Usable | P2 |
| Partial hunk staging | Limited/no dedicated hunk model | Yes | Missing | P0 |
| Branch create/delete/switch | Yes | Yes | Usable | P2 |
| Merge/rebase/cherry-pick/revert/reset | Yes, porcelain-backed | Yes | Partial UX | P1 |
| Interactive rebase squash/fixup | Backend exists; UX basic | Yes | Partial | P1 |
| Stash manager | Basic list/apply/pop/drop/rename | Yes | Partial | P2 |
| Tags | Yes | Yes | Usable | P2 |
| Reflog | Backend IPC added; UI pending | Yes/undo history | Partial | P1 |
| Detached HEAD | Checkout commit exists | Yes | Partial | P2 |
| Worktrees | Backend exists | Limited | Competitive | P2 |
| Submodules | Backend IPC added; UI pending | Yes | Partial | P1 |
| Bisect | Backend IPC added; UI pending | No/limited | GitPilot+ potential | P2 |
| Commit graph | Basic graph string/rendering | Advanced lanes/labels | Gap | P1 |
| Search/filter/blame/file history | Search and blame exist | Yes | Partial | P1 |
| GitHub/GitLab/Bitbucket PRs | Not implemented | Yes | Missing | P0 |
| SSH/HTTPS auth and token vault | Relies on system git; no vault UI | Yes | Missing | P0 |
| Command palette/shortcuts | Limited settings type only | Yes | Missing | P1 |
| Multi-repo workspace | Recent repos only | Yes | Missing | P1 |
| Conflict resolver | Marker parser/editor exists | Visual 3-way | Partial | P1 |
| AI commit/diff/conflict help | Initial AI commands | Limited | Differentiator | P2 |
| Updater/crash/telemetry toggle | Not productionized | Yes | Missing | P0 |

## Missing features list
### Core Git
- Partial hunk and line staging with reverse patch safety.
- Multi-commit cherry-pick and queued revert flows.
- First-class reflog browser and one-click undo built on reflog/reset/revert.
- UI for clone/init/submodule/bisect commands added in this patch.
- Visual 3-way conflict resolver with base/current/incoming panes.

### Visualization
- Commit graph lane assignment, stable lane colors, branch/tag pills, avatars, selection virtualization, and drag/drop branch/rebase operations.

### Productivity
- Global command palette (`Ctrl+Shift+P`), fuzzy repo/action search, configurable keyboard shortcuts, and quick actions.

### Repository management
- Workspace model with repo groups, favorites, pinned/recent repos, per-repo settings, and tab persistence.

### AI
- PR summary generation and hosted-provider posting.
- Diff risk summarization and review checklists.
- Conflict explanation that references parsed conflict blocks.

### Enterprise
- Secure credential/token storage using OS keychain plugins.
- Crash logging with opt-in telemetry toggle.
- Signed auto-updater and release channels.

## Bug list / risks
- `git pull` could not be run in this checkout because the current branch has no configured remote tracking branch.
- CI intentionally builds and uploads Linux, Windows, and macOS desktop bundles on every PR so reviewers can download platform artifacts; the tradeoff is slower validation until a separate opt-in fast-check workflow exists.
- Git operations are porcelain subprocess calls; acceptable for breadth, but long-running commands need cancellation/progress streaming.
- Recent repository storage is flat and not a workspace schema.
- AI key is represented in settings and should move to secure storage before production.

## Refactor proposals
1. Introduce a typed Git operation layer that owns argument validation, command execution, cancellation, progress, and audit events.
2. Split Tauri commands into fast read commands and long-running task commands with progress events.
3. Add a frontend feature shell: command palette, workspace navigator, repository tabs, settings, and hosted-provider account area.
4. Replace graph string rendering with a lane-layout engine that can be benchmarked independently.
5. Add integration tests that create temporary repositories and exercise each command.

## Roadmap
### MVP
- Wire clone/init/reflog/submodule/bisect IPC into UI.
- Add partial hunk staging and visual conflict improvements.
- Add command palette and keyboard shortcuts.

### Beta
- Multi-repo workspaces, pinned/favorites, graph lanes, file history, PR checkout, credential vault.
- Add smoke/integration tests and performance baselines.

### Production
- Signed updater, crash logging, telemetry toggle, hardened secret storage, provider integrations, release channels.
- Keep PR artifact builds for reviewer access, then add an optional fast-check workflow or label-gated packaging path if CI minutes become a bottleneck.

### GitKraken+ parity
- Drag/drop rebase/branch operations, advanced PR review, author avatars, AI summaries, bisect UI, and repository insights dashboards.
