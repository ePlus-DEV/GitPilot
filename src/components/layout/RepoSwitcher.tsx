import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, GitFork, Search } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function RepoSwitcher() {
  const repo = useGitStore(s => s.repo);
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const pick = async () => {
    setIsOpen(false);
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) void openRepo(p);
  };

  const inferRepoName = (url: string) => (url.split(/[\\/]/).pop() ?? 'repository').replace(/\.git$/, '') || 'repository';
  const joinPath = (parent: string, child: string) =>
    `${parent.replace(/[\\/]+$/, '')}${parent.includes('\\') ? '\\' : '/'}${child.replace(/^[\\/]+/, '')}`;

  const cloneRepo = async () => {
    setIsOpen(false);
    const url = prompt('Clone URL')?.trim();
    if (!url) return;
    const parent = await open({ directory: true, multiple: false, title: 'Choose clone parent folder' });
    if (!parent || Array.isArray(parent)) return;
    const folder = prompt('Destination folder name', inferRepoName(url))?.trim();
    if (!folder) return;
    useGitStore.setState({ busy: true });
    const log = useGitStore.getState().log;
    try {
      const cloned = await gitService.cloneRepository(url, joinPath(parent, folder));
      await gitService.saveRecentRepository(cloned.path);
      await openRepo(cloned.path);
    } catch (e) {
      log(String((e as Error).message ?? e));
    } finally {
      useGitStore.setState({ busy: false });
    }
  };

  const q = search.toLowerCase();
  const filtered = recent.filter(p => {
    const name = p.split(/[\\/]/).pop() ?? '';
    return name.toLowerCase().includes(q) || p.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative flex shrink-0 items-center gap-2 border-r border-pilot-line pr-3">
      {/* Logo area */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setIsOpen(v => !v)}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-[#21262d]"
        >
          {repo ? (
            <>
              <span className="max-w-[120px] truncate text-sm font-semibold text-slate-200">{repo.name}</span>
              <ChevronDown size={11} className={`shrink-0 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </>
          ) : (
            <>
              <span className="text-sm text-slate-600">Open repo</span>
              <ChevronDown size={11} className="text-slate-700" />
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/60">
          {/* Search */}
          <div className="border-b border-[#21262d] p-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search repositories…"
                className="h-8 w-full rounded bg-[#21262d] pl-8 pr-3 text-xs text-slate-200 placeholder-slate-600 outline-none focus:ring-1 focus:ring-pilot-blue/50"
              />
            </div>
          </div>

          {/* Recent list */}
          <div className="max-h-[300px] overflow-auto p-1">
            {filtered.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Recently opened
                </div>
                {filtered.slice(0, 12).map(path => {
                  const name = path.split(/[\\/]/).pop() ?? path;
                  const dir = path.slice(0, path.length - name.length - 1);
                  const isActive = repo?.path === path;
                  return (
                    <button
                      key={path}
                      onClick={() => { void openRepo(path); setIsOpen(false); setSearch(''); }}
                      className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-[#21262d]' : 'hover:bg-[#21262d]'
                      }`}
                    >
                      <FolderOpen size={13} className={isActive ? 'text-pilot-blue shrink-0' : 'text-slate-600 shrink-0'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-200">{name}</span>
                        <span className="block truncate text-[10px] text-slate-600">{dir}</span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-700">No repositories found</div>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-[#21262d] p-1">
            <button
              onClick={() => void pick()}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-[#21262d] hover:text-slate-200"
            >
              <FolderOpen size={13} className="text-slate-600" />
              Open folder…
            </button>
            <button
              onClick={() => void cloneRepo()}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-[#21262d] hover:text-slate-200"
            >
              <GitFork size={13} className="text-slate-600" />
              Clone repository…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
