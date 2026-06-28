import { GitBranch, GitCompare, RotateCcw, Tag, Undo2 } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function CommitDetails() {
  const repo = useGitStore(s => s.repo?.path);
  const commit = useGitStore(s => s.selectedCommit);
  const commitFiles = useGitStore(s => s.commitFiles);
  const commitFilesLoading = useGitStore(s => s.commitFilesLoading);
  const run = useGitStore(s => s.run);

  if (!commit) return null;

  const short = commit.shortHash;
  const ask = (message: string, fallback: string) => prompt(message, fallback)?.trim();
  const runCommitAction = (label: string, fn: () => Promise<unknown>) => repo && void run(label, fn);

  return (
    <section className="bg-[#0b1120]">
      <div className="border-b border-pilot-line px-3 py-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">Commit</h2>
          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-pilot-blue">{short}</span>
        </div>
        <div className="break-words text-sm font-semibold leading-snug text-slate-100">{commit.message}</div>
        <div className="mt-1 truncate text-[11px] text-slate-500" title={commit.hash}>{commit.hash}</div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
          <span>{commit.author}</span>
          <span>{commit.date}</span>
          {commit.parents.length > 0 && <span>{commit.parents.length} parent{commit.parents.length > 1 ? 's' : ''}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-pilot-line px-3 py-2">
        <button className="icon-btn accent" title="Create a branch at this commit" onClick={() => { const name = ask('New branch name', `branch-${short}`); if (name) runCommitAction('branch from commit', () => gitService.createBranchFromCommit(repo!, name, commit.hash, true)); }}>
          <GitBranch size={12} /> Branch
        </button>
        <button className="icon-btn" title="Create a lightweight tag at this commit" onClick={() => { const name = ask('New tag name', `tag-${short}`); if (name) runCommitAction('tag commit', () => gitService.createTagFromCommit(repo!, name, commit.hash)); }}>
          <Tag size={12} /> Tag
        </button>
        <button className="icon-btn" title="Cherry-pick this commit" onClick={() => confirm(`Cherry-pick ${short}?`) && runCommitAction('cherry-pick', () => gitService.cherryPickCommit(repo!, commit.hash))}>
          <GitCompare size={12} /> Pick
        </button>
        <button className="icon-btn" title="Revert this commit" onClick={() => confirm(`Revert ${short}?`) && runCommitAction('revert commit', () => gitService.revertCommit(repo!, commit.hash))}>
          <Undo2 size={12} /> Revert
        </button>
        <button className="icon-btn" title="Checkout this commit in detached HEAD" onClick={() => confirm(`Checkout ${short} in detached HEAD?`) && runCommitAction('checkout commit', () => gitService.checkoutCommit(repo!, commit.hash))}>
          <RotateCcw size={12} /> Checkout
        </button>
      </div>

      <div className="border-b border-pilot-line px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reset current branch</div>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn" title="Keep all changes staged" onClick={() => confirm(`Soft reset current branch to ${short}?`) && runCommitAction('soft reset', () => gitService.resetToCommit(repo!, commit.hash, 'soft'))}>Soft</button>
          <button className="btn" title="Keep changes unstaged" onClick={() => confirm(`Mixed reset current branch to ${short}?`) && runCommitAction('mixed reset', () => gitService.resetToCommit(repo!, commit.hash, 'mixed'))}>Mixed</button>
          <button className="btn border-red-900/60 text-red-300 hover:bg-red-950/50" title="Discard changes after this commit" onClick={() => confirm(`Hard reset current branch to ${short}? This can discard work.`) && runCommitAction('hard reset', () => gitService.resetToCommit(repo!, commit.hash, 'hard'))}>Hard</button>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Files</span>
          <span>{commitFiles.length}</span>
        </div>
        <div className="space-y-0.5">
          {commitFilesLoading && <div className="py-1 text-xs text-slate-500">Loading files...</div>}
          {!commitFilesLoading && commitFiles.length === 0 && <div className="py-1 text-xs text-slate-500">No file list for this commit.</div>}
          {commitFiles.map(f => (
            <button
              className="flex h-7 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-xs text-slate-300 hover:bg-slate-800"
              key={f.path}
              title={f.path}
              onClick={() => repo && gitService.getCommitFileDiff(repo, commit.hash, f.path).then(diff => useGitStore.setState({ diff }))}
            >
              <span className="w-6 shrink-0 text-center font-mono text-[10px] text-pilot-blue">{f.status}</span>
              <span className="truncate">{f.path}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
