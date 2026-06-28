import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function ConsolePanel() {
  const consoleLines = useGitStore(s => s.console);
  const repo = useGitStore(s => s.repo?.path);
  const run = useGitStore(s => s.run);

  return (
    <footer className="h-36 shrink-0 border-t border-pilot-line bg-black">
      <div className="flex h-10 items-center gap-2 border-b border-pilot-line px-3 text-xs">
        <button className="btn shrink-0" onClick={() => repo && run('validation', () => gitService.runValidation(repo), 'none')}>
          Run Validation
        </button>
        <span className="min-w-0 truncate text-slate-400">Git Output - Validation - Problems - AI</span>
      </div>
      <pre className="h-[calc(100%-40px)] overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed text-slate-300">
        {consoleLines.join('\n\n') || 'Git output console'}
      </pre>
    </footer>
  );
}
