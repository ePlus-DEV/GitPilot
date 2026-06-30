import { FolderOpen, FolderPlus, GitFork, Trash2, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import { gpPrompt } from '../common/Dialog';

export function RepoManagementPanel() {
  const recent = useGitStore(s => s.recent);
  const repo = useGitStore(s => s.repo);

  const close = () => useGitStore.setState({ repoMgmtOpen: false });

  const handleOpen = async (path: string) => {
    await useGitStore.getState().openRepo(path);
    close();
  };

  const handleRemove = async (path: string) => {
    await gitService.removeRecentRepository(path);
    useGitStore.setState(s => ({ recent: s.recent.filter(r => r !== path) }));
  };

  const handleBrowse = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) {
      await useGitStore.getState().openRepo(p);
      close();
    }
  };

  const handleClone = async () => {
    const url = await gpPrompt('Clone URL:');
    if (!url) return;
    open({ directory: true, multiple: false, title: 'Clone into folder' }).then(async parent => {
      if (!parent || Array.isArray(parent)) return;
      const state = useGitStore.getState();
      const folder = url.split('/').pop()?.replace(/\.git$/, '') ?? 'repo';
      void state.run('clone', () =>
        gitService.cloneRepository(url, `${parent}/${folder}`).then(async r => {
          await gitService.saveRecentRepository(r.path);
          await state.openRepo(r.path);
          return r;
        })
      );
      close();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[520px] w-[640px] flex-col overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl shadow-black/70">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#21262d] px-6">
          <div className="flex items-center gap-2.5">
            <GitFork size={18} className="text-pilot-blue" />
            <h2 className="text-base font-semibold text-slate-100">Repo Management</h2>
          </div>
          <button
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-[#21262d] hover:text-slate-200"
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-2 border-b border-[#21262d] px-6 py-3">
          <button className="btn flex items-center gap-1.5" onClick={handleBrowse}>
            <FolderOpen size={13} />
            Open Repo
          </button>
          <button className="btn flex items-center gap-1.5" onClick={() => void handleClone()}>
            <GitFork size={13} />
            Clone Repo
          </button>
        </div>

        {/* Recent repos list */}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
          {recent.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No recent repositories
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {recent.map(path => {
                const name = path.split(/[\\/]/).pop() ?? path;
                const dir = path.slice(0, path.length - name.length - 1);
                const isActive = repo?.path === path;
                return (
                  <div
                    key={path}
                    className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      isActive
                        ? 'border-pilot-blue/30 bg-pilot-blue/10'
                        : 'border-transparent hover:border-[#30363d] hover:bg-[#161b22]'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-pilot-blue/20 text-pilot-blue' : 'bg-[#161b22] text-slate-500'}`}>
                      <FolderPlus size={15} />
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => void handleOpen(path)}>
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-200">{name}</span>
                        {isActive && (
                          <span className="shrink-0 rounded-full bg-pilot-blue/20 px-2 py-0.5 text-[10px] font-semibold text-pilot-blue">
                            active
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">{dir || path}</div>
                    </button>
                    <button
                      className="shrink-0 rounded p-1.5 text-slate-500 opacity-0 transition-all hover:bg-red-900/30 hover:text-red-400 group-hover:opacity-100"
                      title="Remove from list"
                      onClick={() => void handleRemove(path)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-[#21262d] px-6 py-3">
          <button className="btn" onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}
