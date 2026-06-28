import { FilePlus2, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { GitFileStatus } from '../../types/git';

export function StatusPanel() {
  const s = useGitStore();
  const repo = s.repo?.path;
  const act = (label: string, fn: () => Promise<unknown>) => repo && s.run(label, fn);
  const total =
    s.status.staged.length +
    s.status.unstaged.length +
    s.status.untracked.length +
    s.status.conflicted.length;

  return (
    <section className="flex h-[34%] min-h-[168px] max-h-[280px] shrink-0 flex-col overflow-hidden border-b border-pilot-line bg-pilot-panel">
      <div className="flex items-center justify-between gap-3 border-b border-pilot-line px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Changes</h2>
          <p className="text-[11px] text-slate-500">{total} file{total === 1 ? '' : 's'} changed</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="icon-btn" title="Stage all" onClick={() => act('stage all', () => gitService.stageAll(repo!))}>
            <Plus size={13} />
          </button>
          <button className="icon-btn" title="Unstage all" onClick={() => act('unstage all', () => gitService.unstageAll(repo!))}>
            <Minus size={13} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-2">
        <Group title="Staged" files={s.status.staged} action="Unstage" onAction={f => act('unstage', () => gitService.unstageFile(repo!, f.path))} cached />
        <Group title="Unstaged" files={s.status.unstaged} action="Stage" onAction={f => act('stage', () => gitService.stageFile(repo!, f.path))} />
        <Group title="Untracked" files={s.status.untracked} action="Add" onAction={f => act('stage', () => gitService.stageFile(repo!, f.path))} />
        <Group title="Conflicted" files={s.status.conflicted} action="Resolve" onAction={f => void s.loadConflict(f.path)} />
      </div>
    </section>
  );
}

function Group({
  title,
  files,
  action,
  onAction,
  cached = false,
}: {
  title: string;
  files: GitFileStatus[];
  action: string;
  onAction: (f: GitFileStatus) => void;
  cached?: boolean;
}) {
  const select = useGitStore(st => st.setSelectedFile);
  const repo = useGitStore(st => st.repo?.path);
  const run = useGitStore(st => st.run);

  if (files.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>{title}</span>
        <span>{files.length}</span>
      </div>
      <div className="space-y-0.5">
        {files.map(f => (
          <div className="group flex h-8 items-center gap-2 px-3 hover:bg-slate-800/60" key={title + f.path}>
            <button
              onClick={() => void select(f, cached)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-slate-300"
              title={f.path}
            >
              <span className="w-5 shrink-0 text-center font-mono text-[10px] text-pilot-blue">
                {f.displayStatus || f.indexStatus + f.worktreeStatus}
              </span>
              <span className="truncate">{f.path}</span>
            </button>

            <button className="icon-btn h-6 w-6 justify-center p-0 opacity-0 group-hover:opacity-100" title={action} onClick={() => onAction(f)}>
              <FilePlus2 size={12} />
            </button>
            {title !== 'Staged' && title !== 'Untracked' ? (
              <button
                className="icon-btn h-6 w-6 justify-center p-0 opacity-0 group-hover:opacity-100"
                title="Discard changes"
                onClick={() => repo && confirm(`Discard ${f.path}?`) && run('discard', () => gitService.discardFile(repo, f.path))}
              >
                <RotateCcw size={12} />
              </button>
            ) : null}
            {title === 'Untracked' ? (
              <button
                className="icon-btn h-6 w-6 justify-center p-0 text-red-300 opacity-0 group-hover:opacity-100"
                title="Delete untracked file"
                onClick={() => repo && confirm(`Delete ${f.path}?`) && run('delete', () => gitService.deleteUntrackedFile(repo, f.path))}
              >
                <Trash2 size={12} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
