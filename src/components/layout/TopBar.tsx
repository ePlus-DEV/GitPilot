import { type ReactNode } from 'react';
import { Archive, ArchiveRestore, ArrowDownToLine, GitBranch, GitMerge, RefreshCw, Search, Settings, Terminal, Undo2, Upload } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import { GitPilotIcon } from '../common/GitPilotIcon';
import { RepoSwitcher } from './RepoSwitcher';
import { BranchSwitcher } from './BranchSwitcher';
import { invoke } from '@tauri-apps/api/core';
import { gpPrompt, gpConfirm, gpAlert } from '../common/Dialog';

export function TopBar() {
  const repo = useGitStore(s => s.repo);
  const busy = useGitStore(s => s.busy);
  const refreshing = useGitStore(s => s.refreshing);
  const run = useGitStore(s => s.run);
  const branches = useGitStore(s => s.branches);
  const stashes = useGitStore(s => s.stashes);
  const status = useGitStore(s => s.status);
  const ahead = status.ahead ?? 0;
  const behind = status.behind ?? 0;

  const mergeBranch = async () => {
    if (!repo) return;
    const candidate = branches.find(b => !b.current)?.name ?? '';
    const branch = status.currentBranch || repo.currentBranch || '';
    const branchName = await gpPrompt('Merge branch into current branch', candidate);
    if (!branchName) return;
    if (await gpConfirm(`Merge ${branchName} into ${branch}?`)) {
      void run('merge branch', () => gitService.mergeBranch(repo.path, branchName));
    }
  };

  const createBranch = async () => {
    if (!repo) return;
    const name = await gpPrompt('New branch name');
    if (!name) return;
    void run('create branch', () => gitService.createBranch(repo.path, name, true));
  };

  const createStash = async () => {
    if (!repo) return;
    const msg = (await gpPrompt('Stash message (optional)', '')) ?? '';
    void run('stash', () => gitService.createStash(repo.path, msg || 'GitPilot stash'));
  };

  const popStash = async () => {
    if (!repo) return;
    const top = stashes[0];
    if (!top) { await gpAlert('No stashes to pop.'); return; }
    void run('pop stash', () => gitService.popStash(repo.path, top.name));
  };

  const openTerminal = () => {
    if (repo) void invoke('open_in_terminal', { path: repo.path });
  };

  const p = repo?.path;

  return (
    <header className="flex h-11 shrink-0 items-center border-b border-pilot-line bg-[#161b22] px-2">
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-1.5 border-r border-pilot-line pr-3 mr-1.5">
        <GitPilotIcon size={22} />
        <span className="text-xs leading-none tracking-wide">
          <span className="font-light text-slate-500">git</span>
          <span className="font-bold text-slate-100">PILOT</span>
        </span>
      </div>

      {/* Repo + Branch — shrink-0, natural width */}
      <RepoSwitcher />
      {repo && <BranchSwitcher />}

      {/* Divider */}
      <div className="mx-2 h-6 w-px shrink-0 bg-[#30363d]" />

      {/* Action buttons */}
      {repo && (
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Undo / Redo group */}
          <Btn icon={<Undo2 size={15} />} label="Undo" disabled={busy} title="Undo last action" onClick={() => p && run('undo', () => gitService.resetToCommit(p, 'HEAD~1', 'soft'))} />
          <Btn icon={<RefreshCw size={15} className={refreshing ? 'animate-spin text-pilot-blue' : ''} />} label="Redo" disabled={busy} title="Refresh" onClick={() => void useGitStore.getState().refresh()} />

          <Sep />

          {/* Pull / Push */}
          <Btn icon={<ArrowDownToLine size={15} />} label="Pull" badge={behind || undefined} disabled={busy} title={`Pull${behind ? ` (${behind} behind)` : ''}`} onClick={() => p && run('pull', () => gitService.pull(p))} />
          <Btn icon={<Upload size={15} />} label="Push" badge={ahead || undefined} disabled={busy} title={`Push${ahead ? ` (${ahead} ahead)` : ''}`} accent onClick={() => p && run('push', () => gitService.push(p))} />

          <Sep />

          {/* Branch / Merge / Stash / Pop */}
          <Btn icon={<GitBranch size={15} />} label="Branch" disabled={busy} title="Create new branch" onClick={createBranch} />
          <Btn icon={<GitMerge size={15} />} label="Merge" disabled={busy} title="Merge branch into current" onClick={mergeBranch} />

          <Sep />

          <Btn icon={<Archive size={15} />} label="Stash" disabled={busy} title="Stash working changes" onClick={createStash} />
          <Btn icon={<ArchiveRestore size={15} />} label="Pop" disabled={busy || stashes.length === 0} title="Pop top stash" onClick={popStash} />

          <Sep />

          {/* Terminal */}
          <Btn icon={<Terminal size={15} />} label="Terminal" disabled={!repo} title="Open in terminal" onClick={openTerminal} />
        </div>
      )}

      <div className="flex-1" />

      {/* Right: Search + Settings */}
      <div className="flex shrink-0 items-center gap-0.5">
        {repo && (
          <Btn
            icon={<Search size={15} />}
            label="Search"
            title="Smart search (commits, files, authors)"
            onClick={async () => {
              const q = await gpPrompt('Search commits, files, authors…');
              if (q && repo) void gitService.smartSearch(repo.path, q).then(r => useGitStore.getState().log(`Search "${q}": ${r.length} result(s)`));
            }}
          />
        )}
        <Btn icon={<Settings size={15} />} label="Settings" title="Settings" onClick={() => useGitStore.setState({ settingsOpen: true, settingsTab: 'general' })} />
      </div>
    </header>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function Btn({ icon, label, title, onClick, disabled, accent, badge }: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
  badge?: number;
}) {
  return (
    <button
      className={`relative flex flex-col items-center justify-center gap-[2px] rounded px-2.5 py-1 transition-colors disabled:opacity-40
        ${accent
          ? 'text-pilot-blue hover:bg-teal-900/40 hover:text-teal-300'
          : 'text-slate-400 hover:bg-[#21262d] hover:text-slate-100'}`}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="flex items-center gap-1 text-[9px] font-medium leading-none tracking-wide">
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-pilot-blue px-1 py-px text-[8px] font-bold leading-none text-slate-950">
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-[#30363d]" />;
}
