import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from './store/gitStore';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusPanel } from './components/status/StatusPanel';
import { DiffViewer } from './components/diff/DiffViewer';
import { CommitPanel } from './components/commit/CommitPanel';
import { ConsolePanel } from './components/console/ConsolePanel';
import { CommitDetails } from './components/history/CommitDetails';
import { MergeResolver } from './components/merge/MergeResolver';
import { GitGraph } from './components/graph/GitGraph';
import { MergeConflictPanel } from './components/merge-conflict/MergeConflictPanel';
import { AiPanel } from './components/ai/AiPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { RepoTabs } from './components/layout/RepoTabs';
import { RepoManagementPanel } from './components/layout/RepoManagementPanel';
import { GitPilotIcon } from './components/common/GitPilotIcon';
import { UpdateDialog } from './components/update/UpdateDialog';
import { gitService } from './services/gitService';

export function App() {
  const repo = useGitStore(s => s.repo);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const conflict = useGitStore(s => s.conflict);
  const diff = useGitStore(s => s.diff);
  const status = useGitStore(s => s.status);
  const showMergePanel = status.conflicted.length > 0 || status.mergeState.isMerging || status.mergeState.isRebasing;
  const aiText = useGitStore(s => s.aiText);
  const settingsOpen = useGitStore(s => s.settingsOpen);
  const repoMgmtOpen = useGitStore(s => s.repoMgmtOpen);
  const [appVersion, setAppVersion] = useState('');
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateTestMode, setUpdateTestMode] = useState(false);
  const rightPanelTab = useGitStore(s => s.rightPanelTab);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(430);
  const [consoleHeight, setConsoleHeight] = useState(144);

  useEffect(() => {
    let cancelled = false;
    getVersion().then(v => { if (!cancelled) setAppVersion(v); });

    // Auto-check update on startup — only show dialog if update available
    import('@tauri-apps/plugin-updater').then(({ check }) =>
      check().then(u => { if (!cancelled && u) setUpdateOpen(true); }).catch(() => {})
    );

    void gitService.getSettings().then(settings => {
      if (cancelled) return;
      useGitStore.setState({ settings, recent: settings.recentRepositories });
      const state = useGitStore.getState();
      if (!state.repo && settings.recentRepositories[0]) void state.openRepo(settings.recentRepositories[0]);
    });
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const state = useGitStore.getState();
      if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); void state.refresh(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'u') { e.preventDefault(); setUpdateTestMode(true); setUpdateOpen(true); }
      if (mod && e.key === 'Enter') document.dispatchEvent(new CustomEvent('gitpilot-commit'));
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p' && state.repo)
        void state.run('push', () => gitService.push(state.repo!.path));
    };
    window.addEventListener('keydown', onKey);

    // Native menu event handlers
    const unlistens: (() => void)[] = [];
    const on = (event: string, handler: () => void) => {
      listen(event, handler).then(u => unlistens.push(u));
    };

    on('menu://open_repo', () => {
      open({ directory: true, multiple: false }).then(p => {
        if (p && !Array.isArray(p)) void useGitStore.getState().openRepo(p);
      });
    });

    on('menu://clone_repo', () => {
      const url = prompt('Clone URL:')?.trim();
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
      });
    });

    on('menu://init_repo', () => {
      open({ directory: true, multiple: false, title: 'Init repo in folder' }).then(async p => {
        if (!p || Array.isArray(p)) return;
        const state = useGitStore.getState();
        void state.run('init', () =>
          gitService.initRepository(p).then(async r => {
            await gitService.saveRecentRepository(r.path);
            await state.openRepo(r.path);
            return r;
          })
        );
      });
    });

    on('menu://repo_management', () => {
      useGitStore.setState({ repoMgmtOpen: true });
    });

    on('menu://check_update', () => {
      setUpdateOpen(true);
    });

    on('menu://about', () => {
      useGitStore.setState({ settingsInitialTab: 'about', settingsOpen: true });
    });

    on('menu://open_terminal', () => {
      const { repo } = useGitStore.getState();
      if (repo) void invoke('open_in_terminal', { path: repo.path });
    });

    on('menu://open_file_manager', () => {
      const { repo } = useGitStore.getState();
      if (repo) void invoke('open_in_file_manager', { path: repo.path });
    });

    on('menu://preferences', () => {
      useGitStore.setState({ settingsOpen: true });
    });

    on('menu://refresh', () => {
      void useGitStore.getState().refresh();
    });

    on('menu://relaunch', () => {
      import('@tauri-apps/plugin-process').then(({ relaunch }) => void relaunch());
    });

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      unlistens.forEach(u => u());
    };
  }, []);

  const startResize = (move: (event: MouseEvent) => void) => (event: ReactMouseEvent) => {
    event.preventDefault();
    document.body.style.cursor = event.currentTarget.classList.contains('cursor-col-resize') ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    const stop = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  return (
    <div className="flex h-full min-w-[980px] flex-col overflow-hidden bg-pilot-bg text-slate-100">
      {settingsOpen && <SettingsPanel />}
      {repoMgmtOpen && <RepoManagementPanel />}
      {updateOpen && <UpdateDialog onClose={() => { setUpdateOpen(false); setUpdateTestMode(false); }} testMode={updateTestMode} />}
      {appVersion && (
        <button
          className="fixed bottom-2 right-3 z-40 flex items-center gap-1.5 rounded border border-[#30363d] bg-[#161b22] px-2 py-0.5 text-[10px] font-mono text-slate-500 transition-colors hover:border-pilot-blue/40 hover:text-slate-300"
          title="Check for update"
          onClick={() => setUpdateOpen(true)}
        >
          <GitPilotIcon size={13} />
          <span className="text-slate-600">git</span><span className="font-bold text-slate-400">PILOT</span>
          <span className="mx-0.5 text-[#30363d]">·</span>v{appVersion}
        </button>
      )}
      <RepoTabs />
      <TopBar />
      {!repo && <WelcomeScreen />}

      {repo && <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 shrink-0" style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>
        <div
          className="w-1 shrink-0 cursor-col-resize border-r border-pilot-line bg-[#161b22] hover:bg-pilot-blue/60"
          onMouseDown={startResize(event => setSidebarWidth(Math.min(360, Math.max(190, event.clientX))))}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-pilot-line bg-pilot-bg">
          {showMergePanel ? <MergeConflictPanel /> : <GitGraph />}
        </main>

        <div
          className="w-1 shrink-0 cursor-col-resize bg-[#161b22] hover:bg-pilot-blue/60"
          onMouseDown={startResize(event => setRightWidth(Math.min(640, Math.max(360, window.innerWidth - event.clientX))))}
        />
        <aside className="relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-[#0d1117]" style={{ width: rightWidth }}>
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-pilot-line bg-[#161b22]">
            <button
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${rightPanelTab === 'working' ? 'border-b-2 border-pilot-blue text-pilot-blue' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => useGitStore.setState({ rightPanelTab: 'working' })}
            >
              Working Directory
            </button>
            <button
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${rightPanelTab === 'review' ? 'border-b-2 border-pilot-blue text-pilot-blue' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => useGitStore.setState({ rightPanelTab: 'review' })}
            >
              Code Review
            </button>
          </div>

          {rightPanelTab === 'working' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <StatusPanel />
              <CommitPanel />
              {aiText && <AiPanel />}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {selectedCommit && !conflict && (
                <div className={`${diff ? 'basis-[42%]' : 'flex-1'} min-h-[180px] overflow-auto border-b border-pilot-line bg-pilot-panel`}>
                  <CommitDetails />
                </div>
              )}
              {conflict ? <MergeResolver /> : diff ? <DiffViewer /> : null}
              {!selectedCommit && !conflict && !diff && (
                <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
                  Select a commit to inspect it.
                </div>
              )}
              {aiText && <AiPanel />}
            </div>
          )}
        </aside>
      </div>}

      {repo && <ConsolePanel
        height={consoleHeight}
        onResizeStart={startResize(event => setConsoleHeight(Math.min(360, Math.max(80, window.innerHeight - event.clientY))))}
      />}
    </div>
  );
}
