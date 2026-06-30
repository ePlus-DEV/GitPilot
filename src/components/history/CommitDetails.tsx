import { GitBranch, GitCompare, RotateCcw, Tag, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { gpPrompt, gpConfirm } from '../common/Dialog';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { CommitFile } from '../../types/git';

export function CommitDetails() {
  const repo = useGitStore(s => s.repo?.path);
  const commit = useGitStore(s => s.selectedCommit);
  const commitFiles = useGitStore(s => s.commitFiles);
  const commitFilesLoading = useGitStore(s => s.commitFilesLoading);
  const commitFilesError = useGitStore(s => s.commitFilesError);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);
  const [fileMenu, setFileMenu] = useState<{ x: number; y: number; file: CommitFile }>();

  if (!commit) return null;

  const short = commit.shortHash;
  const revision = commit.hash.trim() || commit.shortHash.trim();
  const runCommitAction = (label: string, fn: () => Promise<unknown>) => repo && void run(label, fn);
  const openCommitFileDiff = (file: CommitFile) => {
    if (!repo || !revision || !file.path.trim()) return;
    gitService
      .getCommitFileDiff(repo, revision, file.path)
      .then(diff => useGitStore.setState({ diff }))
      .catch(e => log(String((e as Error).message ?? e)));
  };
  const copyText = (label: string, value: string) =>
    void navigator.clipboard.writeText(value).then(() => log(`${label}: ${value}`)).catch(() => log(value));
  const commitFileMenuItems = (file: CommitFile): ContextMenuItem[] => [
    { label: 'Show file diff', action: () => openCommitFileDiff(file) },
    {
      label: 'Restore file from this commit',
      action: async () => {
        if (await gpConfirm(`Restore ${file.path} from ${short} into the working tree?`))
          runCommitAction('restore file from commit', () => gitService.restoreFileFromCommit(repo!, revision, file.path));
      },
    },
    { label: 'file-separator', separator: true, action: () => undefined },
    { label: 'Copy file path', action: () => copyText('Copied file path', file.path) },
    { label: 'Copy commit sha', action: () => copyText('Copied commit sha', revision) },
  ];

  return (
    <section className="flex min-h-0 flex-col bg-[#161b22]">
      <div className="min-w-0 shrink-0 border-b border-pilot-line px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-pilot-blue">Information</h2>
          <span className="shrink-0 rounded bg-[#21262d] px-1.5 py-0.5 font-mono text-[10px] text-pilot-blue">{short}</span>
        </div>

        <div className="break-words text-base font-semibold leading-snug text-slate-100">{commit.message}</div>

        <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[11px]">
          <span className="font-semibold uppercase text-slate-500">Author</span>
          <span className="truncate text-slate-300">{commit.author}</span>
          <span className="font-semibold uppercase text-slate-500">Date</span>
          <span className="truncate text-slate-300">{commit.date}</span>
          <span className="font-semibold uppercase text-slate-500">SHA</span>
          <span className="truncate font-mono text-slate-300" title={revision}>{revision}</span>
          <span className="font-semibold uppercase text-slate-500">Parents</span>
          <span className="truncate text-slate-300">{commit.parents.length ? commit.parents.map(p => p.slice(0, 7)).join(', ') : '0'}</span>
        </div>
      </div>

      <div className="shrink-0 border-b border-pilot-line px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button className="icon-btn accent" title="Create a branch at this commit" onClick={async () => { const name = await gpPrompt('New branch name', `branch-${short}`); if (name) runCommitAction('branch from commit', () => gitService.createBranchFromCommit(repo!, name, revision, true)); }}>
            <GitBranch size={12} /> Branch
          </button>
          <button className="icon-btn" title="Create a lightweight tag at this commit" onClick={async () => { const name = await gpPrompt('New tag name', `tag-${short}`); if (name) runCommitAction('tag commit', () => gitService.createTagFromCommit(repo!, name, revision)); }}>
            <Tag size={12} /> Tag
          </button>
          <button className="icon-btn" title="Cherry-pick this commit" onClick={async () => await gpConfirm(`Cherry-pick ${short}?`) && runCommitAction('cherry-pick', () => gitService.cherryPickCommit(repo!, revision))}>
            <GitCompare size={12} /> Pick
          </button>
          <button className="icon-btn" title="Revert this commit" onClick={async () => await gpConfirm(`Revert ${short}?`) && runCommitAction('revert commit', () => gitService.revertCommit(repo!, revision))}>
            <Undo2 size={12} /> Revert
          </button>
          <button className="icon-btn" title="Checkout this commit in detached HEAD" onClick={async () => await gpConfirm(`Checkout ${short} in detached HEAD?`, true) && runCommitAction('checkout commit', () => gitService.checkoutCommit(repo!, revision))}>
            <RotateCcw size={12} /> Checkout
          </button>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reset current branch</div>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn" title="Keep all changes staged" onClick={async () => await gpConfirm(`Soft reset current branch to ${short}?`) && runCommitAction('soft reset', () => gitService.resetToCommit(repo!, revision, 'soft'))}>Soft</button>
            <button className="btn" title="Keep changes unstaged" onClick={async () => await gpConfirm(`Mixed reset current branch to ${short}?`) && runCommitAction('mixed reset', () => gitService.resetToCommit(repo!, revision, 'mixed'))}>Mixed</button>
            <button className="btn border-red-900/60 text-red-300 hover:bg-red-950/50" title="Discard changes after this commit" onClick={async () => await gpConfirm(`Hard reset current branch to ${short}? This can discard work.`, true) && runCommitAction('hard reset', () => gitService.resetToCommit(repo!, revision, 'hard'))}>Hard</button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3">
        <div className="mb-1 flex shrink-0 items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Files</span>
          <span>{commitFilesLoading ? '...' : commitFiles.length}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto">
          {commitFilesLoading && <div className="py-1 text-xs text-slate-500">Loading files...</div>}
          {commitFilesError && !commitFilesLoading && <div className="py-1 text-xs text-red-300">{commitFilesError}</div>}
          {!commitFilesLoading && !commitFilesError && commitFiles.length === 0 && <div className="py-1 text-xs text-slate-500">No file list for this commit.</div>}
          {commitFiles.map(f => (
            <button
              className="flex h-7 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-xs text-slate-300 hover:bg-[#21262d]"
              key={`${f.status}-${f.path}`}
              title={f.path}
              onClick={() => openCommitFileDiff(f)}
              onContextMenu={event => {
                event.preventDefault();
                setFileMenu({ x: event.clientX, y: event.clientY, file: f });
              }}
            >
              <span className="w-6 shrink-0 text-center font-mono text-[10px] text-pilot-blue">{f.status}</span>
              <span className="truncate">{f.path}</span>
            </button>
          ))}
        </div>
      </div>
      {fileMenu && (
        <ContextMenu
          x={fileMenu.x}
          y={fileMenu.y}
          title={fileMenu.file.path}
          items={commitFileMenuItems(fileMenu.file)}
          onClose={() => setFileMenu(undefined)}
        />
      )}
    </section>
  );
}
