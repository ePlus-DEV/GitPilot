# GitKraken parity audit: context menus

Reviewed against GitKraken Desktop documentation on June 29, 2026, with emphasis on right-click workflows.

## Covered in GitPilot

- Commit graph context menu: checkout, branch, tag, cherry-pick, rebase, reset, revert, patch, copy SHA.
- Branch context menu: checkout, worktree, branch, merge, compare, reset, rename, push/fetch, delete, copy name.
- Working tree file context menu: stage/unstage, show diff, discard, delete untracked file, copy relative path.
- Commit file context menu: show historical diff, restore a file from the selected commit, copy path/SHA.
- Stash actions: create, apply, pop, rename, drop from the stash panel and sidebar quick actions.

## Still missing vs GitKraken

- Multi-select context menus for files, branches, and commits (for example cherry-pick multiple commits or delete multiple branches).
- Partial stash by selected file(s), and applying selected files from a stash.
- Drag-and-drop branch-to-branch merge/rebase workflows.
- Hide/show stash visibility controls in the graph.
- Sparse checkout UI and pin/smart branch visibility controls.
- Diff word-wrap toggle and richer diff preferences.

## Prioritized next work

1. Add multi-selection state and bulk right-click actions in the working tree, commit graph, and branch list.
2. Add backend commands for file-level stash creation/application.
3. Add branch drag targets for merge/rebase, using confirmation dialogs to avoid accidental history changes.
4. Add diff display preferences, starting with word wrap.
