import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ChevronRight, Clock, FolderOpen, GitFork, Keyboard } from 'lucide-react';
import { gitService } from '../../services/gitService';
import { useGitStore } from '../../store/gitStore';
import { GitPilotIcon } from '../common/GitPilotIcon';

const SHORTCUTS = [
  { keys: 'Ctrl R', label: 'Refresh' },
  { keys: 'Ctrl ↵', label: 'Commit' },
  { keys: 'Ctrl ⇧ P', label: 'Push' },
];

function RecentItem({ path, onClick }: { path: string; onClick: () => void }) {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dir = path.slice(0, path.length - name.length - 1);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#21262d]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#161b22] text-slate-500 transition-colors group-hover:text-pilot-blue">
        <FolderOpen size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-200 group-hover:text-white">{name}</span>
        <span className="block truncate text-[11px] text-slate-600">{dir}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-slate-700 transition-colors group-hover:text-slate-400" />
    </button>
  );
}

export function WelcomeScreen() {
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);
  const busy = useGitStore(s => s.busy);
  const [cloning, setCloning] = useState(false);
  const log = useGitStore(s => s.log);

  const pick = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) void openRepo(p);
  };

  const inferRepoName = (url: string) => (url.split(/[\\/]/).pop() ?? 'repository').replace(/\.git$/, '') || 'repository';
  const joinPath = (parent: string, child: string) =>
    `${parent.replace(/[\\/]+$/, '')}${parent.includes('\\') ? '\\' : '/'}${child.replace(/^[\\/]+/, '')}`;

  const cloneRepo = async () => {
    const url = prompt('Clone URL')?.trim();
    if (!url) return;
    const parent = await open({ directory: true, multiple: false, title: 'Choose clone parent folder' });
    if (!parent || Array.isArray(parent)) return;
    const folder = prompt('Destination folder name', inferRepoName(url))?.trim();
    if (!folder) return;
    setCloning(true);
    try {
      const cloned = await gitService.cloneRepository(url, joinPath(parent, folder));
      await gitService.saveRecentRepository(cloned.path);
      await openRepo(cloned.path);
    } catch (e) {
      log(String((e as Error).message ?? e));
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0d1117]">
      {/* Background: subtle animated git graph decoration */}
      <BackgroundGraph />

      {/* Main card */}
      <div className="relative z-10 flex w-full max-w-[820px] items-stretch gap-0 overflow-hidden rounded-2xl border border-[#21262d] bg-[#0d1117] shadow-2xl shadow-black/60">

        {/* Left panel — logo + actions */}
        <div className="flex flex-1 flex-col justify-between p-10">
          {/* Logo */}
          <div>
            <div className="mb-8 flex items-center gap-4">
              <GitPilotIcon size={56} />
              <div>
                <div className="text-3xl font-light leading-none tracking-wide text-slate-100">
                  <span className="text-slate-500">git</span>
                  <span className="font-bold">PILOT</span>
                </div>
                <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-600">
                  Visual Git Client
                </div>
              </div>
            </div>

            <p className="mb-8 max-w-[280px] text-sm leading-relaxed text-slate-500">
              Open a local repository or clone one from a remote to get started.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={pick}
                disabled={busy}
                className="flex items-center gap-3 rounded-lg bg-pilot-blue px-5 py-2.5 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <FolderOpen size={16} />
                Open Repository
              </button>
              <button
                type="button"
                onClick={() => void cloneRepo()}
                disabled={busy || cloning}
                className="flex items-center gap-3 rounded-lg border border-[#30363d] px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-[#484f58] hover:text-white disabled:opacity-50"
              >
                <GitFork size={16} />
                {cloning ? 'Cloning…' : 'Clone Repository'}
              </button>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="mt-10">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-700">
              <Keyboard size={11} />
              Shortcuts
            </div>
            <div className="flex flex-col gap-1">
              {SHORTCUTS.map(s => (
                <div key={s.keys} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{s.label}</span>
                  <kbd className="rounded bg-[#161b22] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[#21262d]" />

        {/* Right panel — recent repos */}
        <div className="flex w-[300px] shrink-0 flex-col p-6">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            <Clock size={11} />
            Recent
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-700">
              No recent repositories
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 overflow-auto">
              {recent.slice(0, 12).map(path => (
                <RecentItem
                  key={path}
                  path={path}
                  onClick={() => void openRepo(path)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackgroundGraph() {
  const lanes = [
    { x: '12%',  color: '#38bdf8', delay: '0s',    dur: '8s'  },
    { x: '28%',  color: '#a78bfa', delay: '1.2s',  dur: '11s' },
    { x: '44%',  color: '#34d399', delay: '0.5s',  dur: '9s'  },
    { x: '60%',  color: '#fb923c', delay: '2s',    dur: '13s' },
    { x: '76%',  color: '#38bdf8', delay: '0.8s',  dur: '10s' },
    { x: '88%',  color: '#a78bfa', delay: '1.8s',  dur: '7s'  },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.07]">
      {lanes.map((l, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: l.x,
            background: `linear-gradient(to bottom, transparent 0%, ${l.color} 30%, ${l.color} 70%, transparent 100%)`,
            animation: `gpWelcomePulse ${l.dur} ${l.delay} ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
