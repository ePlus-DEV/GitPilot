import { open } from '@tauri-apps/plugin-dialog';
import { ArrowDownToLine, Download, FolderOpen, GitBranch, Loader2, RefreshCw, Settings, Upload } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function TopBar() {
  const { repo, status, busy, openRepo, refresh, run } = useGitStore();
  const pick = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) void openRepo(p);
  };
  const branch = status.currentBranch || repo?.currentBranch || 'no branch';
  const ahead = status.ahead ?? 0;
  const behind = status.behind ?? 0;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-pilot-line bg-[#0d1324] px-3">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-pilot-line pr-3">
        <GitBranch size={16} className="text-pilot-blue" />
        <span className="text-sm font-bold text-slate-100">GitPilot</span>
      </div>

      <button onClick={pick} className="icon-btn shrink-0" title="Open Repository">
        <FolderOpen size={15} />
        <span>Open</span>
      </button>

      {repo && (
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-sm font-semibold">{repo.name}</div>
          <div className="truncate text-[10px] text-slate-500">{repo.path}</div>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5 rounded border border-pilot-line bg-slate-800 px-2.5 py-1">
        <GitBranch size={12} className="shrink-0 text-pilot-blue" />
        <span className="max-w-[140px] truncate text-xs font-medium">{branch}</span>
        {behind > 0 && <span className="text-[10px] text-amber-400">down {behind}</span>}
        {ahead > 0 && <span className="text-[10px] text-emerald-400">up {ahead}</span>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button className="icon-btn" title="Fetch" onClick={() => repo && run('fetch', () => gitService.fetch(repo.path))} disabled={busy || !repo}>
          <Download size={14} />
          <span>Fetch</span>
        </button>
        <button className="icon-btn" title="Pull" onClick={() => repo && run('pull', () => gitService.pull(repo.path))} disabled={busy || !repo}>
          <ArrowDownToLine size={14} />
          <span>Pull</span>
        </button>
        <button className="icon-btn accent" title="Push" onClick={() => repo && run('push', () => gitService.push(repo.path))} disabled={busy || !repo}>
          <Upload size={14} />
          <span>Push</span>
        </button>

        <div className="mx-1 h-5 w-px bg-pilot-line" />

        <button className="icon-btn h-8 w-8 justify-center p-0" title="Refresh (Ctrl+R)" onClick={() => void refresh()} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
        <button className="icon-btn h-8 w-8 justify-center p-0" title="Settings" onClick={() => useGitStore.setState({ settingsOpen: true })}>
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
