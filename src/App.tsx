import { useEffect } from 'react';
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

  useEffect(() => {
    void gitService.getSettings().then(settings => {
      useGitStore.setState({ settings, recent: settings.recentRepositories });
      if (!('__TAURI_INTERNALS__' in window) && settings.recentRepositories[0]) void useGitStore.getState().openRepo(settings.recentRepositories[0]);
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

  return (
    <div className="flex h-full min-w-[980px] flex-col overflow-hidden bg-pilot-bg text-slate-100">
      <TopBar />

      {/* Main 3-column layout like GitKraken */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Column 1: Sidebar — branches, remotes, tags, stashes */}
        <Sidebar />

        {/* Column 2 (center): Commit graph — largest area */}
        <div className="flex min-h-0 flex-col flex-1 min-w-0 border-r border-pilot-line">
          <GitGraph />
        </div>

        {/* Column 3: changes, diff, commit tools */}
        <aside className="relative flex min-h-0 w-[400px] shrink-0 flex-col bg-[#080d19] xl:w-[440px]">
          <StatusPanel />
          {conflict ? (
            <MergeResolver />
          ) : (
            <>
              {selectedCommit && (
                <div className="max-h-[42%] shrink-0 overflow-auto border-b border-pilot-line">
                  <CommitDetails />
                </div>
              )}
              <DiffViewer />
            </>
          )}
          <div className="shrink-0 border-t border-pilot-line bg-pilot-panel">
            <CommitPanel />
            <AiPanel />
          </div>
          {settingsOpen && <SettingsPanel />}
        </aside>
      </div>

      <ConsolePanel />
    </div>
  );
}
