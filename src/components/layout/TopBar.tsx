import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, RefreshCw, Download, Upload, ArrowDownToLine, Settings, GitBranch, Loader2 } from 'lucide-react';
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
    <div className="h-12 flex items-center gap-2 border-b border-pilot-line bg-[#0d1324] px-3 shrink-0">
      {/* Logo / app name */}
      <div className="flex items-center gap-1.5 pr-3 border-r border-pilot-line">
        <GitBranch size={16} className="text-pilot-blue" />
        <span className="text-sm font-bold text-slate-100">GitPilot</span>
      </div>

      {/* Open repo */}
      <button onClick={pick} className="icon-btn" title="Open Repository">
        <FolderOpen size={15} />
        <span className="text-xs">Open</span>
      </button>

      {/* Repo info */}
      {repo && (
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-sm font-semibold">{repo.name}</div>
          <div className="truncate text-[10px] text-slate-500">{repo.path}</div>
        </div>
      )}

      <div className="flex-1" />

      {/* Branch badge */}
      <div className="flex items-center gap-1.5 rounded bg-slate-800 border border-pilot-line px-2.5 py-1">
        <GitBranch size={12} className="text-pilot-blue shrink-0" />
        <span className="text-xs font-medium truncate max-w-[140px]">{branch}</span>
        {behind > 0 && <span className="text-[10px] text-amber-400">↓{behind}</span>}
        {ahead > 0 && <span className="text-[10px] text-emerald-400">↑{ahead}</span>}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 ml-2">
        <button
          className="icon-btn"
          title="Fetch"
          onClick={() => repo && run('fetch', () => gitService.fetch(repo.path))}
          disabled={busy || !repo}
        >
          <Download size={14} />
          <span className="text-xs">Fetch</span>
        </button>
        <button
          className="icon-btn"
          title="Pull"
          onClick={() => repo && run('pull', () => gitService.pull(repo.path))}
          disabled={busy || !repo}
        >
          <ArrowDownToLine size={14} />
          <span className="text-xs">Pull</span>
        </button>
        <button
          className="icon-btn accent"
          title="Push"
          onClick={() => repo && run('push', () => gitService.push(repo.path))}
          disabled={busy || !repo}
        >
          <Upload size={14} />
          <span className="text-xs">Push</span>
        </button>

        <div className="w-px h-5 bg-pilot-line mx-1" />

        <button
          className="icon-btn"
          title="Refresh (Ctrl+R)"
          onClick={() => void refresh()}
          disabled={busy}
        >
          {busy
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />
          }
        </button>
        <button
          className="icon-btn"
          title="Settings"
          onClick={() => useGitStore.setState({ settingsOpen: true } as never)}
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
