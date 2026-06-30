import { GitBranch, Plus, X } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();

function Tab({
  label,
  icon,
  isActive,
  onClick,
  onClose,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex h-full cursor-pointer items-center gap-2 border-r border-[#21262d] pl-3.5 pr-2 text-xs select-none transition-colors ${
        isActive
          ? 'bg-[#161b22] text-slate-100'
          : 'bg-transparent text-slate-400 hover:bg-[#0d1117] hover:text-slate-200'
      }`}
    >
      {isActive && <span className="absolute inset-x-0 top-0 h-[2px] bg-pilot-blue" />}
      {icon}
      <span className="max-w-[120px] truncate font-medium">{label}</span>
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        className={`ml-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded transition-colors ${
          isActive
            ? 'text-slate-500 hover:bg-[#30363d] hover:text-slate-100'
            : 'text-transparent group-hover:text-slate-500 hover:!bg-[#21262d] hover:!text-slate-200'
        }`}
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function RepoTabs() {
  const repo = useGitStore(s => s.repo);
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);
  const newTabOpen = useGitStore(s => s.newTabOpen);

  const closeTab = async (path: string) => {
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
    <div className="flex h-[42px] shrink-0 items-stretch border-b border-pilot-line bg-[#0d1117]">
      {tabs.map(path => {
        const name = path.split(/[\\/]/).pop() ?? path;
        const isActive = !newTabOpen && !!repo && norm(repo.path) === norm(path);
        return (
          <Tab
            key={path}
            label={name}
            icon={
              <GitBranch
                size={12}
                className={`shrink-0 ${isActive ? 'text-pilot-blue' : 'text-slate-500 group-hover:text-slate-300'}`}
              />
            }
            isActive={isActive}
            onClick={() => { useGitStore.setState({ newTabOpen: false }); void openRepo(path); }}
            onClose={() => void closeTab(path)}
          />
        );
      })}

      {newTabOpen && (
        <Tab
          label="New Tab"
          icon={<Plus size={12} className="shrink-0 text-pilot-blue" />}
          isActive
          onClick={() => {}}
          onClose={() => useGitStore.setState({ newTabOpen: false })}
        />
      )}

      <button
        onClick={() => useGitStore.setState({ newTabOpen: true })}
        title="New tab"
        className="flex w-9 shrink-0 items-center justify-center text-slate-500 transition-colors hover:bg-[#161b22] hover:text-slate-300"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
