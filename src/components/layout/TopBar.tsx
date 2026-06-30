import { ArrowDownToLine, Download, GitBranch, GitMerge, Loader2, RefreshCw, Settings, Upload } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import { GitPilotIcon } from '../common/GitPilotIcon';
import { RepoSwitcher } from './RepoSwitcher';
import { BranchSwitcher } from './BranchSwitcher';

export function TopBar() {
  const repo = useGitStore(s => s.repo);
  const busy = useGitStore(s => s.busy);
  const run = useGitStore(s => s.run);
  const branches = useGitStore(s => s.branches);
  const status = useGitStore(s => s.status);

  const mergeBranch = () => {
    if (!repo) return;
    const candidate = branches.find(b => !b.current)?.name ?? '';
    const branch = status.currentBranch || repo.currentBranch || '';
    const branchName = prompt('Merge branch into current branch', candidate)?.trim();
    if (!branchName) return;
    if (confirm(`Merge ${branchName} into ${branch}?`)) {
      void run('merge branch', () => gitService.mergeBranch(repo.path, branchName));
    }
  };

  const createBranch = () => {
    if (!repo) return;
    const name = prompt('New branch name')?.trim();
    if (!name) return;
    void run('create branch', () => gitService.createBranch(repo.path, name, true));
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-pilot-line bg-[#161b22] px-3">
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-2 border-r border-pilot-line pr-3">
        <GitPilotIcon size={26} />
        <span className="text-sm leading-none tracking-wide">
          <span className="font-light text-slate-500">git</span>
          <span className="font-bold text-slate-100">PILOT</span>
        </span>
      </div>

      {/* Repo switcher */}
      <RepoSwitcher />

      {/* Branch switcher */}
      {repo && <BranchSwitcher />}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {repo && (
        <div className="flex shrink-0 items-center gap-1">
          <button className="icon-btn" title="Fetch" onClick={() => run('fetch', () => gitService.fetch(repo.path))} disabled={busy}>
            <Download size={14} />
            <span>Fetch</span>
          </button>
          <button className="icon-btn" title="Pull" onClick={() => run('pull', () => gitService.pull(repo.path))} disabled={busy}>
            <ArrowDownToLine size={14} />
            <span>Pull</span>
          </button>
          <button className="icon-btn accent" title="Push" onClick={() => run('push', () => gitService.push(repo.path))} disabled={busy}>
            <Upload size={14} />
            <span>Push</span>
          </button>
          <button className="icon-btn" title="Create and checkout a new branch" onClick={createBranch} disabled={busy}>
            <GitBranch size={14} />
            <span>Branch</span>
          </button>
          <button className="icon-btn" title="Merge branch into current branch" onClick={mergeBranch} disabled={busy}>
            <GitMerge size={14} />
            <span>Merge</span>
          </button>

          <div className="mx-1 h-5 w-px bg-pilot-line" />

          <button className="icon-btn h-8 w-8 justify-center p-0" title="Refresh (Ctrl+R)" onClick={() => void useGitStore.getState().refresh()} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      )}

      <button className="icon-btn h-8 w-8 justify-center p-0" title="Settings" onClick={() => useGitStore.setState({ settingsOpen: true, settingsTab: 'general' })}>
        <Settings size={14} />
      </button>
    </div>
  );
}
