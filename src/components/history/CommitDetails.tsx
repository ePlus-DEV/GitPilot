import { GitBranch, GitCompare, RotateCcw, Tag, Undo2 } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function CommitDetails() {
  const s = useGitStore();
  const repo = s.repo?.path;
  const commit = s.selectedCommit;
  if (!commit) return null;

  const short = commit.shortHash;
  const run = (label: string, fn: () => Promise<unknown>) => repo && void s.run(label, fn);
  const ask = (message: string, fallback: string) => prompt(message, fallback)?.trim();

  return (
    <div className="border-b border-pilot-line bg-[#0b1120] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{commit.message}</div>
          <div className="mt-0.5 text-xs text-slate-500">{commit.hash}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-400">
            <span>{commit.author}</span><span>·</span><span>{commit.date}</span>
            {commit.parents.length > 0 && <><span>·</span><span>{commit.parents.length} parent{commit.parents.length > 1 ? 's' : ''}</span></>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <button className="icon-btn accent" title="Create a branch at this commit" onClick={() => { const name = ask('New branch name', `branch-${short}`); if (name) run('branch from commit', () => gitService.createBranchFromCommit(repo!, name, commit.hash, true)); }}><GitBranch size={12} /> Branch</button>
          <button className="icon-btn" title="Create a lightweight tag at this commit" onClick={() => { const name = ask('New tag name', `tag-${short}`); if (name) run('tag commit', () => gitService.createTagFromCommit(repo!, name, commit.hash)); }}><Tag size={12} /> Tag</button>
          <button className="icon-btn" title="Cherry-pick this commit onto the current branch" onClick={() => confirm(`Cherry-pick ${short}?`) && run('cherry-pick', () => gitService.cherryPickCommit(repo!, commit.hash))}><GitCompare size={12} /> Pick</button>
          <button className="icon-btn" title="Revert this commit with a new inverse commit" onClick={() => confirm(`Revert ${short}?`) && run('revert commit', () => gitService.revertCommit(repo!, commit.hash))}><Undo2 size={12} /> Revert</button>
          <button className="icon-btn" title="Checkout this commit in detached HEAD" onClick={() => confirm(`Checkout ${short} in detached HEAD?`) && run('checkout commit', () => gitService.checkoutCommit(repo!, commit.hash))}><RotateCcw size={12} /> Checkout</button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-y border-pilot-line/70 py-2 text-[11px] text-slate-400">
        <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500">Reset current branch to this commit</span>
        <button className="btn" title="Keep all changes staged" onClick={() => confirm(`Soft reset current branch to ${short}?`) && run('soft reset', () => gitService.resetToCommit(repo!, commit.hash, 'soft'))}>Soft</button>
        <button className="btn" title="Keep changes unstaged" onClick={() => confirm(`Mixed reset current branch to ${short}?`) && run('mixed reset', () => gitService.resetToCommit(repo!, commit.hash, 'mixed'))}>Mixed</button>
        <button className="btn border-red-900/60 text-red-300 hover:bg-red-950/50" title="Discard changes after this commit" onClick={() => confirm(`Hard reset current branch to ${short}? This can discard work.`) && run('hard reset', () => gitService.resetToCommit(repo!, commit.hash, 'hard'))}>Hard</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {s.commitFiles.length === 0 && <span className="text-xs text-slate-500">No file list for this commit.</span>}
        {s.commitFiles.map(f => (
          <button
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
            key={f.path}
            onClick={() => repo && gitService.getCommitFileDiff(repo, commit.hash, f.path).then(diff => useGitStore.setState({ diff }))}
          >
            <span className="mr-1 text-pilot-blue">{f.status}</span>{f.path}
          </button>
        ))}
      </div>
    </div>
  );
}
