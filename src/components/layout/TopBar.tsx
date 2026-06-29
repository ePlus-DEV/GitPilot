import { open } from '@tauri-apps/plugin-dialog';
import { ArrowDownToLine, Download, FolderOpen, GitBranch, GitFork, GitMerge, Loader2, RefreshCw, Settings, Upload } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

function GitPilotIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id="gp-bg" cx="44%" cy="36%" r="65%">
          <stop offset="0%" stopColor="#16223a"/>
          <stop offset="100%" stopColor="#080d16"/>
        </radialGradient>
        <linearGradient id="gp-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.8"/>
          <stop offset="50%"  stopColor="#a78bfa" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.5"/>
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="72" fill="url(#gp-bg)"/>
      <circle cx="80" cy="80" r="72" fill="none" stroke="url(#gp-rim)" strokeWidth="1.5"/>
      {/* Lane lines */}
      <line x1="68" y1="14"  x2="68" y2="50"  stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <line x1="68" y1="62"  x2="68" y2="100" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <line x1="68" y1="113" x2="68" y2="146" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <line x1="96" y1="70"  x2="96" y2="92"  stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      {/* Fork bezier */}
      <path d="M 68 50 C 82 50 82 70 96 70" stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.72"/>
      {/* Merge bezier */}
      <path d="M 96 92 C 82 92 82 113 68 113" stroke="#a78bfa" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.72"/>
      {/* Node: top main */}
      <circle cx="68" cy="30" r="5.5" fill="#38bdf8"/>
      <circle cx="68" cy="30" r="3.2" fill="#080d16"/>
      <circle cx="68" cy="30" r="3.2" fill="#38bdf8" opacity="0.55"/>
      {/* Node: fork */}
      <circle cx="68" cy="56" r="5.5" fill="#38bdf8"/>
      <circle cx="68" cy="56" r="3.2" fill="#080d16"/>
      <circle cx="68" cy="56" r="3.2" fill="#38bdf8" opacity="0.55"/>
      {/* Node: feature HEAD — violet, larger, HEAD ring */}
      <circle cx="96" cy="81" r="7"   fill="#a78bfa" opacity="0.15"/>
      <circle cx="96" cy="81" r="6"   fill="#a78bfa"/>
      <circle cx="96" cy="81" r="3.8" fill="#080d16"/>
      <circle cx="96" cy="81" r="3.8" fill="#a78bfa" opacity="0.55"/>
      <circle cx="96" cy="81" r="9.5" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.85"/>
      {/* Node: merge */}
      <circle cx="68" cy="106" r="5.5" fill="#38bdf8"/>
      <circle cx="68" cy="106" r="3.2" fill="#080d16"/>
      <circle cx="68" cy="106" r="3.2" fill="#38bdf8" opacity="0.55"/>
      <circle cx="68" cy="106" r="8.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.4"/>
      {/* Node: bottom main */}
      <circle cx="68" cy="130" r="5.5" fill="#38bdf8"/>
      <circle cx="68" cy="130" r="3.2" fill="#080d16"/>
      <circle cx="68" cy="130" r="3.2" fill="#38bdf8" opacity="0.55"/>
      {/* Emerald status dot */}
      <circle cx="116" cy="118" r="5" fill="#34d399" opacity="0.9"/>
    </svg>
  );
}

export function TopBar() {
  const repo = useGitStore(s => s.repo);
  const status = useGitStore(s => s.status);
  const branches = useGitStore(s => s.branches);
  const busy = useGitStore(s => s.busy);
  const openRepo = useGitStore(s => s.openRepo);
  const refresh = useGitStore(s => s.refresh);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);
  const pick = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) void openRepo(p);
  };
  const joinPath = (parent: string, child: string) => `${parent.replace(/[\\/]+$/, '')}${parent.includes('\\') ? '\\' : '/'}${child.replace(/^[\\/]+/, '')}`;
  const inferRepoName = (url: string) => (url.split(/[\\/]/).pop() || 'repository').replace(/\.git$/, '') || 'repository';
  const cloneRepo = async () => {
    const url = prompt('Clone URL')?.trim();
    if (!url) return;
    const parent = await open({ directory: true, multiple: false, title: 'Choose clone parent folder' });
    if (!parent || Array.isArray(parent)) return;
    const folder = prompt('Destination folder name', inferRepoName(url))?.trim();
    if (!folder) return;
    const destination = joinPath(parent, folder);
    useGitStore.setState({ busy: true });
    try {
      const cloned = await gitService.cloneRepository(url, destination);
      await gitService.saveRecentRepository(cloned.path);
      await openRepo(cloned.path);
    } catch (e) {
      log(String((e as Error).message ?? e));
    } finally {
      useGitStore.setState({ busy: false });
    }
  };
  const mergeBranch = () => {
    if (!repo) return;
    const candidate = branches.find(b => !b.current)?.name ?? '';
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
  const branch = status.currentBranch || repo?.currentBranch || 'no branch';
  const ahead = status.ahead ?? 0;
  const behind = status.behind ?? 0;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-pilot-line bg-[#161b22] px-3">
      <div className="flex shrink-0 items-center gap-2 border-r border-pilot-line pr-3">
        <GitPilotIcon size={28} />
        <span className="text-sm leading-none tracking-wide">
          <span className="font-light text-slate-500">git</span>
          <span className="font-bold text-slate-100">PILOT</span>
        </span>
      </div>

      <button onClick={pick} className="icon-btn shrink-0" title="Open Repository">
        <FolderOpen size={15} />
        <span>Open</span>
      </button>
      <button onClick={() => void cloneRepo()} className="icon-btn shrink-0" title="Clone Repository" disabled={busy}>
        <GitFork size={15} />
        <span>Clone</span>
      </button>

      {repo && (
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-sm font-semibold">{repo.name}</div>
          <div className="truncate text-[10px] text-slate-500">{repo.path}</div>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5 rounded border border-pilot-line bg-[#21262d] px-2.5 py-1">
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
        <button className="icon-btn" title="Create and checkout a new branch" onClick={createBranch} disabled={busy || !repo}>
          <GitBranch size={14} />
          <span>Branch</span>
        </button>
        <button className="icon-btn" title="Merge branch into current branch" onClick={mergeBranch} disabled={busy || !repo}>
          <GitMerge size={14} />
          <span>Merge</span>
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
