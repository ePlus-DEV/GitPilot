import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
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
import { AiPanel } from './components/ai/AiPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { gitService } from './services/gitService';

export function App() {
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const conflict = useGitStore(s => s.conflict);
  const settingsOpen = useGitStore(s => s.settingsOpen);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(430);
  const [consoleHeight, setConsoleHeight] = useState(144);

  useEffect(() => {
    void gitService.getSettings().then(settings => {
      useGitStore.setState({ settings, recent: settings.recentRepositories });
      const state = useGitStore.getState();
      if (!state.repo && settings.recentRepositories[0]) void state.openRepo(settings.recentRepositories[0]);
    });
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const state = useGitStore.getState();
      if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); void state.refresh(); }
      if (mod && e.key === 'Enter') document.dispatchEvent(new CustomEvent('gitpilot-commit'));
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p' && state.repo)
        void state.run('push', () => gitService.push(state.repo!.path));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      <TopBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 shrink-0" style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>
        <div
          className="w-1 shrink-0 cursor-col-resize border-r border-pilot-line bg-[#0d1324] hover:bg-pilot-blue/60"
          onMouseDown={startResize(event => setSidebarWidth(Math.min(360, Math.max(190, event.clientX))))}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-pilot-line bg-[#090e1b]">
          <GitGraph />
        </main>

        <div
          className="w-1 shrink-0 cursor-col-resize bg-[#0d1324] hover:bg-pilot-blue/60"
          onMouseDown={startResize(event => setRightWidth(Math.min(640, Math.max(360, window.innerWidth - event.clientX))))}
        />
        <aside className="relative flex min-h-0 shrink-0 flex-col bg-[#080d19]" style={{ width: rightWidth }}>
          <StatusPanel />
          {selectedCommit && !conflict && (
            <div className="max-h-[45%] shrink-0 overflow-auto border-b border-pilot-line bg-[#0b1120]">
              <CommitDetails />
            </div>
          )}
          {conflict ? <MergeResolver /> : <DiffViewer />}
          <div className="shrink-0 border-t border-pilot-line bg-pilot-panel">
            <CommitPanel />
            <AiPanel />
          </div>
          {settingsOpen && <SettingsPanel />}
        </aside>
      </div>

      <ConsolePanel
        height={consoleHeight}
        onResizeStart={startResize(event => setConsoleHeight(Math.min(360, Math.max(80, window.innerHeight - event.clientY))))}
      />
    </div>
  );
}
