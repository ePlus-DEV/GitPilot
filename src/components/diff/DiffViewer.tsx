import { PatchDiff } from '@pierre/diffs/react';
import { Columns2, Maximize2, Minimize2, Rows3 } from 'lucide-react';
import { useState } from 'react';
import { useGitStore } from '../../store/gitStore';

export function DiffViewer() {
  const diff = useGitStore(s => s.diff);
  const [mode, setMode] = useState<'side' | 'inline'>('side');
  const [expanded, setExpanded] = useState(false);
  const canShowSplit = Boolean(diff?.patch || diff?.oldText || diff?.newText);
  const viewMode = mode === 'side' ? 'split' : 'unified';

  if (!diff) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
        Select a changed file or commit file to view its diff.
      </div>
    );
  }

  if (diff.binary) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-amber-300">
        Binary file diff cannot be displayed: {diff.filePath}
      </div>
    );
  }

  const renderEditor = () => (
    <div className="min-h-0 flex-1 overflow-auto bg-[#0b1020]">
      {diff.patch ? (
        <PatchDiff
          key={`${diff.filePath}-${viewMode}`}
          patch={diff.patch}
          disableWorkerPool
          className="min-h-full text-xs"
          options={{
            diffStyle: viewMode,
            theme: 'github-dark',
            themeType: 'dark',
            overflow: 'wrap',
            lineDiffType: 'word',
            diffIndicators: 'bars',
            hunkSeparators: 'line-info-basic',
            stickyHeader: true,
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
          No textual diff available.
        </div>
      )}
    </div>
  );

  const renderToolbar = () => (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-pilot-line px-3 py-2">
      <span className="min-w-0 truncate text-xs font-medium text-slate-200" title={diff.filePath}>
        {diff.filePath}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          className="icon-btn shrink-0"
          title={mode === 'side' ? 'Show inline diff' : 'Show side-by-side diff'}
          disabled={!canShowSplit}
          onClick={() => setMode(mode === 'side' ? 'inline' : 'side')}
        >
          {mode === 'side' ? <Rows3 size={13} /> : <Columns2 size={13} />}
          <span>{mode === 'side' ? 'Inline' : 'Split'}</span>
        </button>
        <button
          className="icon-btn shrink-0"
          title={expanded ? 'Exit full view' : 'Open full view'}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span>{expanded ? 'Exit' : 'Full'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-[#090e1b]">
        {renderToolbar()}
        {renderEditor()}
      </div>
      {expanded && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#090e1b]">
          {renderToolbar()}
          {renderEditor()}
        </div>
      )}
    </>
  );
}
