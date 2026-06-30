import { FormEvent, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderOpen,
  GitBranchPlus,
  GitFork,
  Keyboard,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import { gitService } from '../../services/gitService';
import { useGitStore } from '../../store/gitStore';
import { GitPilotIcon } from '../common/GitPilotIcon';
import {
  getDestinationPreview,
  getSuggestedRepoName,
  inferRepoName,
  joinPath,
  HIGHLIGHTS,
  SETUP_STEPS,
  SHORTCUTS,
} from './welcomeSetupUtils.js';

function RecentItem({ path, onClick }: { path: string; onClick: () => void }) {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dir = path.slice(0, path.length - name.length - 1);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-[#30363d] hover:bg-[#21262d]/80"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#161b22] text-slate-500 ring-1 ring-[#21262d] transition-colors group-hover:text-pilot-blue">
        <FolderOpen size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-200 group-hover:text-white">{name}</span>
        <span className="block truncate text-[11px] text-slate-500">{dir || path}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-slate-700 transition-colors group-hover:text-slate-400" />
    </button>
  );
}

const ICONS = { FolderOpen, GitBranchPlus, Rocket, ShieldCheck, Layers3, TerminalSquare };

function WelcomeIcon({ name, size, className }: { name: keyof typeof ICONS; size: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon size={size} className={className} />;
}

export function WelcomeScreen() {
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);
  const busy = useGitStore(s => s.busy);
  const [cloning, setCloning] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [destinationParent, setDestinationParent] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const log = useGitStore(s => s.log);

  const suggestedName = useMemo(() => getSuggestedRepoName(cloneUrl), [cloneUrl]);
  const destinationPreview = getDestinationPreview(destinationParent, destinationName, suggestedName);

  const pick = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) void openRepo(p);
  };

  const chooseCloneParent = async () => {
    const parent = await open({ directory: true, multiple: false, title: 'Choose clone parent folder' });
    if (parent && !Array.isArray(parent)) setDestinationParent(parent);
  };

  const cloneRepo = async (event?: FormEvent) => {
    event?.preventDefault();
    const url = cloneUrl.trim();
    if (!url) return;
    let parent = destinationParent;
    if (!parent) {
      const selected = await open({ directory: true, multiple: false, title: 'Choose clone parent folder' });
      if (!selected || Array.isArray(selected)) return;
      parent = selected;
      setDestinationParent(selected);
    }
    const folder = (destinationName.trim() || inferRepoName(url)).trim();
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
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#070b12] px-8 py-10">
      <BackgroundGraph />
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-pilot-blue/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-pilot-purple/10 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-[1120px] grid-cols-[1.05fr_0.95fr] overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1117]/92 shadow-2xl shadow-black/70 backdrop-blur">
        <section className="relative overflow-hidden border-r border-white/10 p-10">
          <div className="absolute right-8 top-8 rounded-full border border-pilot-blue/20 bg-pilot-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pilot-blue">
            Setup
          </div>

          <div className="mb-10 flex items-center gap-4">
            <GitPilotIcon size={60} />
            <div>
              <div className="text-4xl font-light leading-none tracking-wide text-slate-100">
                <span className="text-slate-500">git</span>
                <span className="font-bold">PILOT</span>
              </div>
              <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-600">
                Visual Git Client
              </div>
            </div>
          </div>

          <div className="mb-10 max-w-[520px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#30363d] bg-[#161b22]/80 px-3 py-1 text-xs text-slate-400">
              <Sparkles size={13} className="text-pilot-blue" />
              Quick app setup
            </div>
            <h1 className="mb-4 text-4xl font-semibold leading-tight text-white">
              Install your Git workspace in seconds.
            </h1>
            <p className="text-sm leading-7 text-slate-500">
              Open a local repository or clone a remote project, then GitPilot will load the graph, working tree, command log, and review tools automatically.
            </p>
          </div>

          <div className="mb-10 grid grid-cols-3 gap-3">
            {SETUP_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-[#21262d] bg-[#161b22]/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pilot-blue/10 text-pilot-blue">
                    <WelcomeIcon name={step.icon} size={17} />
                  </span>
                  <span className="text-[10px] font-bold text-slate-700">0{index + 1}</span>
                </div>
                <div className="mb-1 text-sm font-semibold text-slate-200">{step.title}</div>
                <p className="text-xs leading-5 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="group flex w-full items-center justify-between rounded-2xl bg-pilot-blue px-5 py-4 text-sm font-bold text-[#061017] shadow-lg shadow-pilot-blue/10 transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:opacity-50"
          >
            <span className="flex items-center gap-3"><FolderOpen size={18} /> Open local repository</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>

          <div className="mt-8 grid grid-cols-3 gap-2">
            {HIGHLIGHTS.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-slate-500">
                <WelcomeIcon name={item.icon} size={14} className="text-slate-600" />
                {item.label}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[660px] flex-col bg-[#0a0f16]/80 p-8">
          <div className="mb-6 rounded-2xl border border-[#21262d] bg-[#0d1117] p-5 shadow-xl shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Clone a remote repository</div>
                <div className="mt-1 text-xs text-slate-600">Paste a URL and choose where GitPilot should install it.</div>
              </div>
              <span className="rounded-full bg-pilot-purple/10 p-2 text-pilot-purple"><GitFork size={17} /></span>
            </div>

            <form className="space-y-3" onSubmit={cloneRepo}>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Repository URL</span>
                <input
                  className="input h-10 w-full rounded-xl px-3"
                  value={cloneUrl}
                  onChange={event => {
                    setCloneUrl(event.target.value);
                    if (!destinationName) setDestinationName(inferRepoName(event.target.value.trim()));
                  }}
                  placeholder="https://github.com/team/project.git"
                  disabled={busy || cloning}
                />
              </label>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Destination folder</span>
                  <input
                    className="input h-10 w-full rounded-xl px-3"
                    value={destinationParent}
                    onChange={event => setDestinationParent(event.target.value)}
                    placeholder="/Users/me/Projects"
                    disabled={busy || cloning}
                  />
                </label>
                <button type="button" className="btn mt-6 h-10 rounded-xl px-4" onClick={chooseCloneParent} disabled={busy || cloning}>
                  Browse
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Project name</span>
                <input
                  className="input h-10 w-full rounded-xl px-3"
                  value={destinationName}
                  onChange={event => setDestinationName(event.target.value)}
                  placeholder={suggestedName}
                  disabled={busy || cloning}
                />
              </label>

              <div className="rounded-xl border border-[#21262d] bg-[#070b12] px-3 py-2 text-xs text-slate-600">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700"><CheckCircle2 size={12} /> Install path</div>
                <div className="truncate text-slate-400">{destinationPreview}</div>
              </div>

              <button
                type="submit"
                disabled={busy || cloning || !cloneUrl.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-pilot-blue/30 bg-pilot-blue/10 px-4 py-3 text-sm font-bold text-pilot-blue transition-all hover:bg-pilot-blue hover:text-[#061017] disabled:border-[#30363d] disabled:bg-[#161b22] disabled:text-slate-600"
              >
                <GitFork size={16} />
                {cloning ? 'Cloning repository…' : 'Clone and open'}
              </button>
            </form>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#21262d] bg-[#0d1117] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                <Clock size={12} /> Recent repositories
              </div>
              <span className="text-[11px] text-slate-700">{recent.length} saved</span>
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#21262d] px-8 text-center">
                <FolderOpen size={26} className="mb-3 text-slate-700" />
                <div className="text-sm font-medium text-slate-500">No recent repositories yet</div>
                <p className="mt-1 text-xs leading-5 text-slate-700">Open or clone a repository to pin it here for the next launch.</p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-col gap-1 overflow-auto pr-1">
                {recent.slice(0, 12).map(path => (
                  <RecentItem key={path} path={path} onClick={() => void openRepo(path)} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#21262d] bg-[#0d1117]/80 px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-700">
              <Keyboard size={12} /> Shortcuts
            </div>
            <div className="flex gap-3">
              {SHORTCUTS.map(s => (
                <div key={s.keys} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600">{s.label}</span>
                  <kbd className="rounded bg-[#161b22] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function BackgroundGraph() {
  const lanes = [
    { x: '10%', color: '#38bdf8', delay: '0s', dur: '8s' },
    { x: '23%', color: '#a78bfa', delay: '1.2s', dur: '11s' },
    { x: '39%', color: '#34d399', delay: '0.5s', dur: '9s' },
    { x: '58%', color: '#fb923c', delay: '2s', dur: '13s' },
    { x: '74%', color: '#38bdf8', delay: '0.8s', dur: '10s' },
    { x: '90%', color: '#a78bfa', delay: '1.8s', dur: '7s' },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.09]">
      {lanes.map((l, i) => (
        <div
          key={i}
          className="absolute bottom-0 top-0 w-px"
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
