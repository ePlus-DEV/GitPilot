import type { MouseEvent as ReactMouseEvent } from 'react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

type Props = {
  height: number;
  onResizeStart: (event: ReactMouseEvent) => void;
};

export function ConsolePanel({ height, onResizeStart }: Props) {
  const consoleLines = useGitStore(s => s.console);
  const repo = useGitStore(s => s.repo?.path);
  const run = useGitStore(s => s.run);
  const hasOutput = consoleLines.length > 0;

  return (
    <footer className="relative shrink-0 border-t border-pilot-line bg-black" style={{ height: hasOutput ? height : 40 }}>
      {hasOutput && (
        <div
          className="absolute left-0 right-0 top-0 z-10 h-1 cursor-row-resize hover:bg-pilot-blue"
          onMouseDown={onResizeStart}
        />
      )}
      <div className={`flex h-10 items-center gap-2 px-3 text-xs ${hasOutput ? 'border-b border-pilot-line' : ''}`}>
        <button className="btn shrink-0" onClick={() => repo && run('validation', () => gitService.runValidation(repo), 'none')}>
          Run Validation
        </button>
        <span className="min-w-0 truncate text-slate-400">Git Output - Validation - Problems - AI</span>
      </div>
      {hasOutput && (
        <pre className="h-[calc(100%-40px)] overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed text-slate-300">
          {consoleLines.join('\n\n')}
        </pre>
      )}
    </footer>
  );
}
