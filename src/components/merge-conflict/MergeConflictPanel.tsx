import { useState, useCallback } from 'react';
import { GitMerge, GitBranch, AlertTriangle, CheckCircle } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { ConflictFileData } from '../../types/git';
import { ConflictFileList } from './ConflictFileList';
import { MergeEditor } from './MergeEditor';

export function MergeConflictPanel() {
  const { repo, status, run } = useGitStore();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileData, setFileData] = useState<ConflictFileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvedPaths, setResolvedPaths] = useState<Set<string>>(new Set());

  const isMerging = status.mergeState.isMerging;
  const isRebasing = status.mergeState.isRebasing;
  const conflicted = status.conflicted;
  const allResolved = conflicted.length === 0 && (isMerging || isRebasing);

  const selectFile = useCallback(async (path: string) => {
    if (!repo) return;
    setSelectedPath(path);
    setFileData(null);
    setLoading(true);
    try {
      const data = await gitService.getConflictFile(repo.path, path);
      setFileData(data);
    } catch (e) {
      useGitStore.getState().log(String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  const handleSave = useCallback(async (content: string) => {
    if (!repo || !selectedPath) return;
    try {
      await gitService.saveResolvedFile(repo.path, selectedPath, content);
      setResolvedPaths(prev => new Set([...prev, selectedPath]));
      await useGitStore.getState().refreshStatus();
      // Move to next unresolved file
      const remaining = useGitStore.getState().status.conflicted;
      const next = remaining.find(f => f.path !== selectedPath && !resolvedPaths.has(f.path));
      if (next) {
        void selectFile(next.path);
      } else {
        setSelectedPath(null);
        setFileData(null);
      }
    } catch (e) {
      useGitStore.getState().log(String(e));
    }
  }, [repo, selectedPath, resolvedPaths, selectFile]);

  const handleContinue = () => {
    if (!repo) return;
    if (isRebasing) {
      void run('rebase continue', () => gitService.continueRebase(repo.path));
    } else {
      void run('merge continue', () => gitService.continueMerge(repo.path));
    }
  };

  const handleAbort = () => {
    if (!repo) return;
    if (isRebasing) {
      void run('rebase abort', () => gitService.abortRebase(repo.path));
    } else {
      void run('merge abort', () => gitService.abortMerge(repo.path));
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      {/* Banner */}
      <div className="flex shrink-0 items-center gap-3 border-b border-pilot-line bg-[#161b22] px-4 py-2">
        <GitMerge size={15} className={allResolved ? 'text-teal-400' : 'text-orange-400'} />
        <div className="flex-1">
          <span className="text-xs font-semibold text-slate-200">
            {isRebasing ? 'Rebase in progress' : 'Merge in progress'}
          </span>
          {conflicted.length > 0 && (
            <span className="ml-2 text-[10px] text-slate-500">
              {conflicted.length} file{conflicted.length !== 1 ? 's' : ''} with conflicts
            </span>
          )}
        </div>
        {allResolved ? (
          <button className="btn-primary h-7 gap-1 text-xs" onClick={handleContinue}>
            <CheckCircle size={12} /> Continue {isRebasing ? 'Rebase' : 'Merge'}
          </button>
        ) : (
          <button className="btn h-7 text-xs" onClick={handleContinue} disabled={conflicted.length > 0} title={conflicted.length > 0 ? 'Resolve all conflicts first' : ''}>
            Continue
          </button>
        )}
        <button className="btn h-7 text-xs text-red-400 hover:border-red-500/50 hover:bg-red-900/20" onClick={handleAbort}>
          Abort {isRebasing ? 'Rebase' : 'Merge'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* File list */}
        <div className="flex w-52 shrink-0 flex-col border-r border-pilot-line">
          <div className="flex shrink-0 items-center gap-2 border-b border-pilot-line px-3 py-1.5">
            <AlertTriangle size={11} className="text-orange-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conflicts</span>
          </div>
          <ConflictFileList
            files={conflicted}
            resolvedPaths={resolvedPaths}
            selectedPath={selectedPath}
            onSelect={selectFile}
          />
        </div>

        {/* Editor area */}
        <div className="min-w-0 flex-1">
          {loading && (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Loading…
            </div>
          )}
          {!loading && fileData && (
            <MergeEditor
              key={fileData.path}
              fileData={fileData}
              onSave={handleSave}
              onClose={() => { setSelectedPath(null); setFileData(null); }}
            />
          )}
          {!loading && !fileData && !selectedPath && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              {allResolved ? (
                <>
                  <CheckCircle size={32} className="text-teal-400" />
                  <div className="text-sm text-teal-300">All conflicts resolved</div>
                  <div className="text-xs text-slate-500">Click Continue {isRebasing ? 'Rebase' : 'Merge'} to finish</div>
                </>
              ) : (
                <>
                  <GitBranch size={32} className="text-slate-600" />
                  <div className="text-sm text-slate-400">Select a conflicted file to resolve</div>
                  <div className="text-xs text-slate-600">{conflicted.length} file{conflicted.length !== 1 ? 's' : ''} remaining</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
