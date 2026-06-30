import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, KeyboardEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronRight, Terminal, ScrollText } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

type ConsolePanelProps = {
  height: number;
  onResizeStart: (event: ReactMouseEvent) => void;
};

type TerminalEntry = {
  id: number;
  cmd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
};

type ShellOutput = {
  stdout: string;
  stderr: string;
  exit_code: number;
};

let entryId = 0;

export function ConsolePanel({ height, onResizeStart }: ConsolePanelProps) {
  const consoleLines = useGitStore(s => s.console);
  const repo = useGitStore(s => s.repo?.path);
  const run = useGitStore(s => s.run);
  const [tab, setTab] = useState<'output' | 'terminal'>('output');
  const hasOutput = consoleLines.length > 0;

  return (
    <footer
      className="relative shrink-0 border-t border-pilot-line bg-[#080d14]"
      style={{ height: tab === 'terminal' ? height : hasOutput ? height : 40 }}
    >
      {(hasOutput || tab === 'terminal') && (
        <div
          className="absolute left-0 right-0 top-0 z-10 h-1 cursor-row-resize hover:bg-pilot-blue/60"
          onMouseDown={onResizeStart}
        />
      )}

      {/* Tab bar */}
      <div className={`flex h-10 shrink-0 items-center gap-0 border-b ${hasOutput || tab === 'terminal' ? 'border-pilot-line' : 'border-transparent'}`}>
        <button
          className={`flex items-center gap-1.5 border-r border-pilot-line px-4 h-full text-xs font-medium transition-colors ${
            tab === 'output' ? 'bg-[#161b22] text-slate-200' : 'text-slate-400 hover:bg-[#161b22]/60 hover:text-slate-200'
          }`}
          onClick={() => setTab('output')}
        >
          <ScrollText size={12} />
          Output
          {hasOutput && (
            <span className="ml-0.5 rounded bg-[#21262d] px-1 py-px text-[10px] font-bold text-slate-400">
              {consoleLines.length}
            </span>
          )}
        </button>
        <button
          className={`flex items-center gap-1.5 border-r border-pilot-line px-4 h-full text-xs font-medium transition-colors ${
            tab === 'terminal' ? 'bg-[#161b22] text-slate-200' : 'text-slate-400 hover:bg-[#161b22]/60 hover:text-slate-200'
          }`}
          onClick={() => setTab('terminal')}
        >
          <Terminal size={12} />
          Terminal
        </button>

        {tab === 'output' && (
          <div className="ml-2 flex items-center gap-2">
            <button
              className="btn shrink-0 text-xs"
              onClick={() => repo && run('validation', () => gitService.runValidation(repo), 'none')}
            >
              Run Validation
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'output' && hasOutput && (
        <pre className="h-[calc(100%-40px)] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-slate-300">
          {consoleLines.join('\n\n')}
        </pre>
      )}

      {tab === 'terminal' && (
        <TerminalPane cwd={repo ?? ''} height={height - 40} />
      )}
    </footer>
  );
}

function TerminalPane({ cwd, height }: { cwd: string; height: number }) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries]);

  const submit = async () => {
    const c = cmd.trim();
    if (!c || !cwd || running) return;
    setHistory(h => [c, ...h.filter(x => x !== c)].slice(0, 100));
    setHistIdx(-1);
    setCmd('');
    setRunning(true);
    try {
      const result = await invoke<ShellOutput>('run_shell_command', { path: cwd, command: c });
      setEntries(e => [
        ...e,
        { id: ++entryId, cmd: c, stdout: result.stdout, stderr: result.stderr, exitCode: result.exit_code, cwd },
      ]);
    } catch (err) {
      setEntries(e => [
        ...e,
        { id: ++entryId, cmd: c, stdout: '', stderr: String(err), exitCode: -1, cwd },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(i => {
        const next = Math.min(i + 1, history.length - 1);
        if (history[next] !== undefined) setCmd(history[next]);
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(i => {
        const next = Math.max(i - 1, -1);
        setCmd(next === -1 ? '' : history[next] ?? '');
        return next;
      });
    }
  };

  const promptLabel = cwd ? cwd.split(/[\\/]/).pop() ?? cwd : '~';

  return (
    <div
      className="flex flex-col bg-[#080d14] font-mono text-xs"
      style={{ height }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output */}
      <div ref={outputRef} className="min-h-0 flex-1 overflow-auto p-2 space-y-2">
        {entries.length === 0 && (
          <div className="text-slate-600 px-1 pt-1 select-none">
            {cwd ? `$ ${cwd}` : 'Open a repository to use the terminal.'}
          </div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="space-y-0.5">
            {/* Command line */}
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-pilot-blue">{promptLabel}</span>
              <ChevronRight size={10} className="text-slate-600" />
              <span>{entry.cmd}</span>
            </div>
            {/* stdout */}
            {entry.stdout.trim() && (
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed pl-4">
                {entry.stdout.trimEnd()}
              </pre>
            )}
            {/* stderr */}
            {entry.stderr.trim() && (
              <pre className="whitespace-pre-wrap text-red-400 leading-relaxed pl-4">
                {entry.stderr.trimEnd()}
              </pre>
            )}
            {/* exit code (only show if non-zero) */}
            {entry.exitCode !== 0 && (
              <div className="pl-4 text-red-500">exit {entry.exitCode}</div>
            )}
          </div>
        ))}
        {running && (
          <div className="text-slate-500 animate-pulse px-1">running…</div>
        )}
      </div>

      {/* Input */}
      <div className="flex shrink-0 items-center gap-1.5 border-t border-pilot-line bg-[#0d1117] px-3 py-2">
        <span className="text-pilot-blue shrink-0">{promptLabel}</span>
        <ChevronRight size={10} className="shrink-0 text-slate-600" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-slate-200 caret-pilot-blue outline-none placeholder:text-slate-700"
          value={cmd}
          onChange={e => { setCmd(e.target.value); setHistIdx(-1); }}
          onKeyDown={onKey}
          placeholder={cwd ? 'Enter command…' : 'Open a repo first'}
          disabled={!cwd || running}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        {running && <span className="shrink-0 text-[10px] text-slate-600 animate-pulse">running</span>}
      </div>
    </div>
  );
}
