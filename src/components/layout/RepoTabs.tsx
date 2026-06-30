import { Plus } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useGitStore } from '../../store/gitStore';

export function RepoTabs() {
  const repo = useGitStore(s => s.repo);
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);

  const pick = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) void openRepo(p);
  };

  const tabs = recent.slice(0, 10);
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-[30px] shrink-0 items-end gap-0 border-b border-pilot-line bg-[#080d14] pl-1 pr-2">
      {tabs.map(path => {
        const name = path.split(/[\\/]/).pop() ?? path;
        const isActive = repo?.path === path;
        return (
          <button
            key={path}
            onClick={() => void openRepo(path)}
            title={path}
            className={`relative flex h-[26px] items-center gap-1.5 rounded-t-md px-3 text-[11px] font-medium transition-colors select-none ${
              isActive
                ? 'bg-[#161b22] text-slate-200 border border-b-0 border-pilot-line'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-[#161b22]" />
            )}
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-pilot-blue' : 'bg-slate-500'}`} />
            {name}
          </button>
        );
      })}
      <button
        onClick={() => void pick()}
        title="Open repository"
        className="ml-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center self-center rounded text-slate-500 transition-colors hover:bg-[#161b22] hover:text-slate-300"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
