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
  const s = useGitStore();

  useEffect(() => {
    void gitService.getSettings().then(settings =>
      useGitStore.setState({ settings, recent: settings.recentRepositories })
    );
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); void s.refresh(); }
      if (mod && e.key === 'Enter') document.dispatchEvent(new CustomEvent('gitpilot-commit'));
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p' && s.repo)
        void s.run('push', () => gitService.push(s.repo!.path));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  return (
    <div className="flex h-full flex-col bg-pilot-bg text-slate-100 overflow-hidden">
      <TopBar />

      {/* Main 3-column layout like GitKraken */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Column 1: Sidebar — branches, remotes, tags, stashes */}
        <Sidebar />

        {/* Column 2 (center): Commit graph — largest area */}
        <div className="flex min-h-0 flex-col flex-1 min-w-0 border-r border-pilot-line">
          <GitGraph />
          {/* Commit details panel (slides in below graph when commit selected) */}
          {s.selectedCommit && (
            <div className="shrink-0 border-t border-pilot-line max-h-48 overflow-auto">
              <CommitDetails />
            </div>
          )}
        </div>

        {/* Column 3 (right): Staged/unstaged files + diff viewer */}
        <aside className="flex min-h-0 flex-col bg-[#080d19] w-[380px] shrink-0">
          <StatusPanel />
          {s.conflict ? <MergeResolver /> : <DiffViewer />}
          <CommitPanel />
          <AiPanel />
          <SettingsPanel />
        </aside>
      </div>

      <ConsolePanel />
    </div>
  );
}
