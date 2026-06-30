import { FolderOpen, GitFork, Plus } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function NewTabPanel() {
  const recent = useGitStore(s => s.recent);
  const openRepo = useGitStore(s => s.openRepo);

  const close = () => useGitStore.setState({ newTabOpen: false });

  const handleOpen = async () => {
    const p = await open({ directory: true, multiple: false });
    if (p && !Array.isArray(p)) { await openRepo(p); close(); }
  };

  const handleClone = () => {
    const url = prompt('Clone URL:')?.trim();
    if (!url) return;
    open({ directory: true, multiple: false, title: 'Clone into folder' }).then(async parent => {
      if (!parent || Array.isArray(parent)) return;
      const state = useGitStore.getState();
      const folder = url.split('/').pop()?.replace(/\.git$/, '') ?? 'repo';
      void state.run('clone', () =>
        gitService.cloneRepository(url, `${parent}/${folder}`).then(async r => {
          await gitService.saveRecentRepository(r.path);
          await openRepo(r.path);
          close();
          return r;
        })
      );
    });
  };

  const handleInit = async () => {
    const p = await open({ directory: true, multiple: false, title: 'Init repo in folder' });
    if (!p || Array.isArray(p)) return;
    const state = useGitStore.getState();
    void state.run('init', () =>
      gitService.initRepository(p).then(async r => {
        await gitService.saveRecentRepository(r.path);
        await openRepo(r.path);
        close();
        return r;
      })
    );
  };

  const handleRecent = async (path: string) => {
    await openRepo(path);
    close();
  };

  const ACTION_BTN = 'flex items-center gap-2.5 rounded-lg border border-[#30363d] bg-[#161b22] px-6 py-3.5 text-sm font-medium text-slate-200 transition-all hover:border-pilot-blue/50 hover:bg-[#1c2128] hover:text-white';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#0d1117] px-20 py-14">
      <h2 className="mb-8 text-xl font-semibold text-slate-100">Repositories</h2>

      {/* Action buttons */}
      <div className="mb-10 flex gap-4">
        <button className={ACTION_BTN} onClick={() => void handleOpen()}>
          <FolderOpen size={18} className="text-pilot-blue" />
          Open
        </button>
        <button className={ACTION_BTN} onClick={handleClone}>
          <GitFork size={18} className="text-pilot-blue" />
          Clone
        </button>
        <button className={ACTION_BTN} onClick={() => void handleInit()}>
          <Plus size={18} className="text-pilot-blue" />
          Create
        </button>
      </div>

      {/* Recent repos */}
      {recent.length > 0 && (
        <>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Recent</div>
          <div className="flex flex-col">
            {recent.map(path => {
              const name = path.split(/[\\/]/).pop() ?? path;
              const dir = path.slice(0, path.length - name.length - 1);
              return (
                <button
                  key={path}
                  onClick={() => void handleRecent(path)}
                  className="flex items-baseline gap-4 rounded-md px-3 py-2 text-left transition-colors hover:bg-[#161b22]"
                >
                  <span className="w-36 shrink-0 truncate text-sm font-semibold text-pilot-blue">{name}</span>
                  <span className="truncate text-xs text-slate-500">{dir}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
