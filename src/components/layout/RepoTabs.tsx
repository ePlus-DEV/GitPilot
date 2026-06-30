import { GitBranch, Plus, X } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function RepoTabs() {
  const repo = useGitStore(s => s.repo);
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);
  const newTabOpen = useGitStore(s => s.newTabOpen);

  const pick = () => useGitStore.setState({ newTabOpen: true });

  const closeTab = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await gitService.removeRecentRepository(path);
    const next = recent.filter(r => r !== path);
    useGitStore.setState({ recent: next });
    if (repo?.path === path) {
      if (next.length > 0) void openRepo(next[0]);
      else useGitStore.setState({ repo: undefined });
    }
  };

  const tabs = recent.slice(0, 12);
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-[48px] shrink-0 items-stretch gap-0 border-b border-pilot-line bg-[#080d14] pr-1">
      {tabs.map(path => {
        const name = path.split(/[\\/]/).pop() ?? path;
        const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
        const isActive = !newTabOpen && !!repo && norm(repo.path) === norm(path);
        return (
          <div
            key={path}
            onClick={() => { useGitStore.setState({ newTabOpen: false }); void openRepo(path); }}
            title={path}
            className={`group relative flex cursor-pointer items-center gap-1.5 border-r border-[#30363d] px-3 text-[11px] select-none transition-colors ${
              isActive
                ? 'bg-[#1c2128] font-semibold text-white'
                : 'bg-[#080d14] font-normal text-slate-500 hover:bg-[#0d1117] hover:text-slate-300'
            }`}
          >
            {/* active indicator top bar */}
            {isActive && (
              <span className="absolute inset-x-0 top-0 h-[2px] bg-pilot-blue" />
            )}

            <GitBranch
              size={11}
              className={`shrink-0 ${isActive ? 'text-pilot-blue' : 'text-slate-600 group-hover:text-slate-400'}`}
            />
            <span className="max-w-[120px] truncate">{name}</span>

            {/* close button */}
            <button
              onClick={e => void closeTab(e, path)}
              className={`-mr-1 ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
                isActive
                  ? 'text-slate-400 hover:bg-[#30363d] hover:text-slate-100'
                  : 'text-transparent group-hover:text-slate-500 hover:!text-slate-200 hover:bg-[#21262d]'
              }`}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}

      {/* New Tab tab */}
      {newTabOpen && (
        <div className="group relative flex items-center gap-1.5 border-r border-[#30363d] bg-[#1c2128] px-3 text-[11px] font-semibold text-white select-none">
          <span className="absolute inset-x-0 top-0 h-[2px] bg-pilot-blue" />
          <Plus size={11} className="text-pilot-blue shrink-0" />
          <span>New Tab</span>
          <button
            onClick={() => useGitStore.setState({ newTabOpen: false })}
            className="ml-0.5 -mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-[#30363d] hover:text-slate-100 transition-colors"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* New tab button */}
      <button
        onClick={pick}
        title="New tab"
        className="flex w-9 shrink-0 items-center justify-center text-slate-600 transition-colors hover:bg-[#0d1117] hover:text-slate-300"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
