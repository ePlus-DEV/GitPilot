import { GitBranch, GitCompare, RotateCcw, Tag, Undo2 } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function CommitDetails() {
  const repo = useGitStore(s => s.repo?.path);
  const commit = useGitStore(s => s.selectedCommit);
  const commitFiles = useGitStore(s => s.commitFiles);
  const commitFilesLoading = useGitStore(s => s.commitFilesLoading);
  const commitFilesError = useGitStore(s => s.commitFilesError);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);

  if (!commit) return null;

  const short = commit.shortHash;
  const revision = commit.hash.trim() || commit.shortHash.trim();
  const ask = (message: string, fallback: string) => prompt(message, fallback)?.trim();
  const runCommitAction = (label: string, fn: () => Promise<unknown>) => repo && void run(label, fn);

  return (
    <section className="grid min-h-full grid-cols-[minmax(0,1fr)_340px] bg-[#0b1120]">
      <div className="min-w-0 border-r border-pilot-line px-4 py-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-pilot-blue">Information</h2>
          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-pilot-blue">{short}</span>
        </div>

        <div className="break-words text-sm font-semibold leading-snug text-slate-100">{commit.message}</div>

        <div className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
          <span className="text-right font-semibold uppercase text-slate-500">Author</span>
          <span className="truncate text-slate-300">{commit.author}</span>
          <span className="text-right font-semibold uppercase text-slate-500">Date</span>
          <span className="truncate text-slate-300">{commit.date}</span>
          <span className="text-right font-semibold uppercase text-slate-500">SHA</span>
          <span className="truncate font-mono text-slate-300" title={commit.hash}>{commit.hash}</span>
          <span className="text-right font-semibold uppercase text-slate-500">Parents</span>
          <span className="truncate text-slate-300">{commit.parents.length || 0}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
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

        <div className="mt-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reset current branch</div>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn" title="Keep all changes staged" onClick={() => confirm(`Soft reset current branch to ${short}?`) && runCommitAction('soft reset', () => gitService.resetToCommit(repo!, commit.hash, 'soft'))}>Soft</button>
            <button className="btn" title="Keep changes unstaged" onClick={() => confirm(`Mixed reset current branch to ${short}?`) && runCommitAction('mixed reset', () => gitService.resetToCommit(repo!, commit.hash, 'mixed'))}>Mixed</button>
            <button className="btn border-red-900/60 text-red-300 hover:bg-red-950/50" title="Discard changes after this commit" onClick={() => confirm(`Hard reset current branch to ${short}? This can discard work.`) && runCommitAction('hard reset', () => gitService.resetToCommit(repo!, commit.hash, 'hard'))}>Hard</button>
          </div>
        </div>
      </div>

      <div className="min-w-0 px-3 py-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Files</span>
          <span>{commitFilesLoading ? '...' : commitFiles.length}</span>
        </div>
        <div className="max-h-[205px] space-y-0.5 overflow-auto">
          {commitFilesLoading && <div className="py-1 text-xs text-slate-500">Loading files...</div>}
          {commitFilesError && !commitFilesLoading && <div className="py-1 text-xs text-red-300">{commitFilesError}</div>}
          {!commitFilesLoading && !commitFilesError && commitFiles.length === 0 && <div className="py-1 text-xs text-slate-500">No file list for this commit.</div>}
          {commitFiles.map(f => (
            <button
              className="flex h-7 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-xs text-slate-300 hover:bg-slate-800"
              key={`${f.status}-${f.path}`}
              title={f.path}
              onClick={() => {
                if (!repo || !revision || !f.path.trim()) return;
                gitService
                  .getCommitFileDiff(repo, revision, f.path)
                  .then(diff => useGitStore.setState({ diff }))
                  .catch(e => log(String((e as Error).message ?? e)));
              }}
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
